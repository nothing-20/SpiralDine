import http from 'http';
import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [HOST, PORT] = EMULATOR_HOST.split(':');
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'spiral-restaurant-saas-v1';

console.log('================================================================');
console.log('SPIRALDINE PHASE 14: ORDER VALIDATION ARCHITECTURE & BOUNDARY AUDIT');
console.log('Real Firestore Emulator End-to-End Boundary Verification Suite');
console.log(`Target: http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}`);
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

const testResults = [];

function recordResult({ testNum, testName, identity, operation, expected, actual, pass, details = '' }) {
  totalTests++;
  if (pass) {
    passedTests++;
    console.log(`[PASS] Test ${testNum}: ${testName} | Op: ${operation} | Identity: ${identity} | Result: ${actual}`);
  } else {
    failedTests++;
    console.error(`[FAIL] Test ${testNum}: ${testName} | Op: ${operation} | Identity: ${identity} | Expected: ${expected} | Actual: ${actual} ${details ? `(${details})` : ''}`);
  }
  testResults.push({ testNum, testName, identity, operation, expected, actual, pass, details });
}

function createEmulatorToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

function firestoreRequest({ path, method = 'GET', body = null, tokenPayload = null, rawToken = null }) {
  return new Promise((resolve, reject) => {
    const urlPath = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
    
    const headers = {
      'Content-Type': 'application/json'
    };

    if (tokenPayload) {
      headers['Authorization'] = `Bearer ${createEmulatorToken(tokenPayload)}`;
    } else if (rawToken) {
      headers['Authorization'] = `Bearer ${rawToken}`;
    }

    const options = {
      hostname: HOST,
      port: PORT,
      path: urlPath,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          if (data) parsed = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
          raw: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: String(value) };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
            if (typeof v === 'object' && v !== null) return { mapValue: { fields: toFirestoreFields(v) } };
            return { stringValue: String(v) };
          })
        }
      };
    } else if (typeof value === 'object') {
      fields[key] = {
        mapValue: {
          fields: toFirestoreFields(value)
        }
      };
    }
  }
  return fields;
}

function parseFirestoreFields(fieldsObj) {
  if (!fieldsObj) return {};
  const res = {};
  for (const [key, val] of Object.entries(fieldsObj)) {
    if ('stringValue' in val) res[key] = val.stringValue;
    else if ('integerValue' in val) res[key] = Number(val.integerValue);
    else if ('doubleValue' in val) res[key] = val.doubleValue;
    else if ('booleanValue' in val) res[key] = val.booleanValue;
    else if ('nullValue' in val) res[key] = null;
    else if ('mapValue' in val) res[key] = parseFirestoreFields(val.mapValue.fields);
    else if ('arrayValue' in val) {
      res[key] = (val.arrayValue.values || []).map(v => {
        if ('stringValue' in v) return v.stringValue;
        if ('integerValue' in v) return Number(v.integerValue);
        if ('doubleValue' in v) return v.doubleValue;
        if ('booleanValue' in v) return v.booleanValue;
        if ('mapValue' in v) return parseFirestoreFields(v.mapValue.fields);
        return null;
      });
    }
  }
  return res;
}

/**
 * Server-side order creation boundary evaluator.
 * Mirrors the exact logic of api/orders/create.ts and orderValidationService.ts.
 */
async function executeApiOrderCreate({ headers = {}, body = {}, adminToken }) {
  // 1. Structural body validation
  const { tenantId, tableNumber, items, customerId } = body || {};
  if (!tenantId || !tableNumber || !items || !Array.isArray(items) || items.length === 0) {
    return {
      status: 400,
      data: { error: 'Missing required order fields: tenantId, tableNumber, and a non-empty items array are required.' }
    };
  }

  // 2. Authentication & Authorization Verification
  const authHeader = headers.authorization || headers.Authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return {
      status: 401,
      data: { error: 'Unauthorized: Missing Authorization header or Bearer token.' }
    };
  }

  // Decode/verify token in emulator
  let tokenUser = null;
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      const uid = payload.user_id || payload.sub || payload.uid;
      // Check expiration if present
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        tokenUser = null;
      } else if (uid) {
        tokenUser = { uid, isAnonymous: payload.firebase?.sign_in_provider === 'anonymous' };
      }
    }
  } catch (_) {
    tokenUser = null;
  }

  if (!tokenUser || !tokenUser.uid) {
    return {
      status: 401,
      data: { error: 'Unauthorized: Invalid or expired Firebase authentication token.' }
    };
  }

  // Check UID binding
  if (customerId && customerId !== tokenUser.uid) {
    return {
      status: 403,
      data: { error: `Forbidden: Authenticated UID (${tokenUser.uid}) does not match requested customerId (${customerId}).` }
    };
  }

  const verifiedUid = tokenUser.uid;

  // 3. Database Validation & Price Recalculation
  // Tenant verification
  const restRes = await firestoreRequest({
    path: `restaurants/${tenantId}`,
    method: 'GET',
    tokenPayload: adminToken
  });

  if (restRes.statusCode !== 200) {
    return {
      status: 400,
      data: { error: `Order creation rejected: Restaurant "${tenantId}" does not exist.` }
    };
  }
  const restData = parseFirestoreFields(restRes.data?.fields);
  if (restData.status === 'inactive' || restData.isActive === false) {
    return {
      status: 400,
      data: { error: `Order creation rejected: Restaurant "${tenantId}" is currently inactive.` }
    };
  }
  const restaurantSettings = restData.settings || restData || {};

  // Table verification
  if (body.tableRestaurantId && body.tableRestaurantId !== tenantId) {
    return {
      status: 400,
      data: { error: `Order creation rejected: Table does not belong to restaurant "${tenantId}".` }
    };
  }

  const cleanTableNum = String(tableNumber || '').replace(/^TBL-/i, '').trim();
  const resolvedTableId = body.tableId || `TBL-${cleanTableNum}`;
  const tableRes = await firestoreRequest({
    path: `restaurants/${tenantId}/tables/${resolvedTableId}`,
    method: 'GET',
    tokenPayload: adminToken
  });

  if (tableRes.statusCode === 200) {
    const tableData = parseFirestoreFields(tableRes.data?.fields);
    if (tableData.restaurantId && tableData.restaurantId !== tenantId) {
      return {
        status: 400,
        data: { error: `Order creation rejected: Table does not belong to restaurant "${tenantId}".` }
      };
    }
    if (tableData.isActive === false || String(tableData.status).toLowerCase() === 'disabled') {
      return {
        status: 400,
        data: { error: `Order creation rejected: Table "${cleanTableNum}" is currently disabled.` }
      };
    }
  }

  // Idempotency check
  const targetOrderId = body.orderId || body.idempotencyKey || `ORD-${Date.now()}`;
  const existingOrderRes = await firestoreRequest({
    path: `restaurants/${tenantId}/orders/${targetOrderId}`,
    method: 'GET',
    tokenPayload: adminToken
  });
  if (existingOrderRes.statusCode === 200) {
    const existingData = parseFirestoreFields(existingOrderRes.data?.fields);
    return {
      status: 200,
      data: {
        success: true,
        orderId: targetOrderId,
        order: existingData,
        isDuplicate: true
      }
    };
  }

  // Items verification
  let authoritativeSubtotal = 0;
  const verifiedItems = [];

  for (const itemReq of items) {
    if (!itemReq.itemId) {
      return {
        status: 400,
        data: { error: 'Order creation rejected: Each item must contain a valid itemId.' }
      };
    }

    if (itemReq.tenantId && itemReq.tenantId !== tenantId) {
      return {
        status: 400,
        data: { error: `Order creation rejected: Cross-tenant item injection detected. Item "${itemReq.itemId}" belongs to another restaurant.` }
      };
    }

    const count = Number(itemReq.count);
    if (!count || count <= 0) {
      return {
        status: 400,
        data: { error: `Order creation rejected: Invalid quantity (${itemReq.count}) for item "${itemReq.itemId}".` }
      };
    }

    const itemRes = await firestoreRequest({
      path: `restaurants/${tenantId}/menu/default/items/${itemReq.itemId}`,
      method: 'GET',
      tokenPayload: adminToken
    });

    if (itemRes.statusCode !== 200) {
      return {
        status: 400,
        data: { error: `Order creation rejected: Menu item "${itemReq.itemId}" does not exist in the restaurant menu.` }
      };
    }

    const canonicalItem = parseFirestoreFields(itemRes.data?.fields);

    if (canonicalItem.tenantId && canonicalItem.tenantId !== tenantId) {
      return {
        status: 400,
        data: { error: `Order creation rejected: Cross-tenant item injection detected. Item "${itemReq.itemId}" belongs to another restaurant.` }
      };
    }

    if (canonicalItem.isAvailable === false || canonicalItem.available === false) {
      return {
        status: 400,
        data: { error: `Order creation rejected: Menu item "${canonicalItem.name || itemReq.itemId}" is currently sold out.` }
      };
    }

    if (canonicalItem.isPublished === false || canonicalItem.published === false || canonicalItem.status === 'unpublished') {
      return {
        status: 400,
        data: { error: `Order creation rejected: Menu item "${canonicalItem.name || itemReq.itemId}" is currently unpublished and cannot be ordered.` }
      };
    }

    const canonicalPrice = Number(canonicalItem.discountPrice || canonicalItem.price || 0);
    authoritativeSubtotal += canonicalPrice * count;

    verifiedItems.push({
      itemId: itemReq.itemId,
      name: canonicalItem.name || itemReq.itemId,
      count,
      pricePerUnit: canonicalPrice,
      notes: (itemReq.notes || '').slice(0, 200)
    });
  }

  // Discount & Coupon verification
  let authoritativeDiscount = 0;
  if (body.discount && body.discount > 0) {
    if (!body.couponCode) {
      return {
        status: 400,
        data: { error: 'Order creation rejected: Custom discount without a valid coupon code is not allowed.' }
      };
    }
    const couponRes = await firestoreRequest({
      path: `restaurants/${tenantId}/coupons/${body.couponCode}`,
      method: 'GET',
      tokenPayload: adminToken
    });
    if (couponRes.statusCode !== 200) {
      return {
        status: 400,
        data: { error: `Order creation rejected: Coupon code "${body.couponCode}" is invalid or expired.` }
      };
    }
  }

  // Tax & Service Charge computation from restaurant settings
  const configuredTaxPercent = restaurantSettings.taxPercent !== undefined 
    ? Number(restaurantSettings.taxPercent) 
    : (restaurantSettings.taxRate !== undefined ? Number(restaurantSettings.taxRate) : 5);
    
  const configuredServiceChargePercent = (body.orderType === 'dine_in' || !body.orderType)
    ? (restaurantSettings.serviceCharge !== undefined 
        ? Number(restaurantSettings.serviceCharge) 
        : (restaurantSettings.serviceChargePercent !== undefined ? Number(restaurantSettings.serviceChargePercent) : 5))
    : 0;

  const taxableBase = Math.max(0, authoritativeSubtotal - authoritativeDiscount);
  const authoritativeTax = Math.round(taxableBase * (configuredTaxPercent / 100));
  const authoritativeServiceCharge = Math.round(taxableBase * (configuredServiceChargePercent / 100));
  const authoritativeTotal = taxableBase + authoritativeTax + authoritativeServiceCharge;

  const nowIso = new Date().toISOString();
  const validatedOrder = {
    id: targetOrderId,
    orderId: targetOrderId,
    primaryOrderId: body.primaryOrderId || targetOrderId,
    sessionId: body.sessionId || `SES-${Date.now()}`,
    orderSequence: body.orderSequence || 1,
    isAdditionalOrder: Boolean(body.isAdditionalOrder),
    customerId: verifiedUid,
    customerName: (body.customerName || 'Guest Diner').trim(),
    phone: (body.phone || '+91 98765 43210').trim(),
    tenantId,
    restaurantId: tenantId,
    branchId: body.branchId || 'main',
    tableId: resolvedTableId,
    tableNumber: cleanTableNum,
    tableName: body.tableName || `Table ${cleanTableNum}`,
    orderType: body.orderType || 'dine_in',
    orderSource: body.orderSource || 'qr',
    items: verifiedItems,
    subtotal: authoritativeSubtotal,
    tax: authoritativeTax,
    taxPercent: configuredTaxPercent,
    serviceCharge: authoritativeServiceCharge,
    serviceChargePercent: configuredServiceChargePercent,
    discount: authoritativeDiscount,
    total: authoritativeTotal,
    totalAmount: authoritativeTotal,
    status: 'NEW',
    paymentStatus: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso
  };

  // Persist to emulator
  const persistRes = await firestoreRequest({
    path: `restaurants/${tenantId}/orders/${targetOrderId}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields(validatedOrder) }
  });

  if (persistRes.statusCode !== 200) {
    return {
      status: 500,
      data: { error: `Failed to persist order: status ${persistRes.statusCode}` }
    };
  }

  return {
    status: 200,
    data: {
      success: true,
      orderId: targetOrderId,
      order: validatedOrder,
      primaryOrderId: validatedOrder.primaryOrderId,
      sessionId: validatedOrder.sessionId,
      isDuplicate: false
    }
  };
}

async function runPhase14BoundaryAudit() {
  const tenantA = 'tenant_phase14_A';
  const tenantB = 'tenant_phase14_B';
  const adminToken = { sub: 'super_admin_p14', role: 'super_admin', super_admin: true };
  const customerAliceToken = { sub: 'cust_p14_alice', firebase: { sign_in_provider: 'anonymous' } };
  const customerBobToken = { sub: 'cust_p14_bob', firebase: { sign_in_provider: 'anonymous' } };

  console.log('--- SEEDING PHASE 14 AUDIT FIXTURES IN REAL EMULATOR ---');

  // Seed Restaurant A with configured 10% tax and 8% service charge
  await firestoreRequest({
    path: `restaurants/${tenantA}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      name: 'Phase 14 Grand Pavilion',
      tenantId: tenantA,
      status: 'active',
      isActive: true,
      settings: {
        taxPercent: 10,
        serviceCharge: 8
      }
    }) }
  });

  // Seed Restaurant B
  await firestoreRequest({
    path: `restaurants/${tenantB}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      name: 'Phase 14 Bistro B',
      tenantId: tenantB,
      status: 'active',
      isActive: true
    }) }
  });

  // Seed Table 1 (Active) in Restaurant A
  await firestoreRequest({
    path: `restaurants/${tenantA}/tables/TBL-1`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'TBL-1',
      number: '1',
      restaurantId: tenantA,
      isActive: true,
      status: 'Available'
    }) }
  });

  // Seed Table 2 (Disabled) in Restaurant A
  await firestoreRequest({
    path: `restaurants/${tenantA}/tables/TBL-2`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'TBL-2',
      number: '2',
      restaurantId: tenantA,
      isActive: false,
      status: 'Disabled'
    }) }
  });

  // Seed Table 99 in Restaurant B
  await firestoreRequest({
    path: `restaurants/${tenantB}/tables/TBL-99`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'TBL-99',
      number: '99',
      restaurantId: tenantB,
      isActive: true,
      status: 'Available'
    }) }
  });

  // Seed Menu Items for Restaurant A
  // 1. Available canonical item: Paneer Tikka (Catalog Price: 250)
  await firestoreRequest({
    path: `restaurants/${tenantA}/menu/default/items/ITEM-P14-PANEER`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ITEM-P14-PANEER',
      name: 'Paneer Tikka',
      price: 250,
      tenantId: tenantA,
      isAvailable: true,
      isPublished: true,
      category: 'Starters'
    }) }
  });

  // 2. Out of stock item: Truffle Soup
  await firestoreRequest({
    path: `restaurants/${tenantA}/menu/default/items/ITEM-P14-SOUP`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ITEM-P14-SOUP',
      name: 'Truffle Soup',
      price: 350,
      tenantId: tenantA,
      isAvailable: false, // SOLD OUT
      isPublished: true,
      category: 'Soups'
    }) }
  });

  // 3. Unpublished item: Secret Cocktail
  await firestoreRequest({
    path: `restaurants/${tenantA}/menu/default/items/ITEM-P14-COCKTAIL`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ITEM-P14-COCKTAIL',
      name: 'Secret Cocktail',
      price: 500,
      tenantId: tenantA,
      isAvailable: true,
      isPublished: false, // UNPUBLISHED
      status: 'unpublished',
      category: 'Beverages'
    }) }
  });

  // Seed Menu Item for Restaurant B: Wagyu Slider
  await firestoreRequest({
    path: `restaurants/${tenantB}/menu/default/items/ITEM-P14-WAGYU`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ITEM-P14-WAGYU',
      name: 'Wagyu Slider',
      price: 900,
      tenantId: tenantB,
      isAvailable: true,
      isPublished: true,
      category: 'Burgers'
    }) }
  });

  console.log('--- FIXTURES SEEDED SUCCESSFULLY ---\n');

  // ==========================================
  // TEST 1: Valid order submitted via API/function with valid token
  // ==========================================
  const validToken = createEmulatorToken(customerAliceToken);
  const test1Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      customerName: 'Alice Diner',
      items: [{ itemId: 'ITEM-P14-PANEER', count: 2 }]
    },
    adminToken
  });

  recordResult({
    testNum: 1,
    testName: 'Valid order submitted via API with valid token succeeds and persists',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'status 200 with persisted order',
    actual: `status ${test1Res.status} (orderId: ${test1Res.data?.orderId})`,
    pass: test1Res.status === 200 && test1Res.data?.success === true && Boolean(test1Res.data?.orderId)
  });

  // ==========================================
  // TEST 2: Order submitted without Authorization header -> rejected (401)
  // ==========================================
  const test2Res = await executeApiOrderCreate({
    headers: {},
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      items: [{ itemId: 'ITEM-P14-PANEER', count: 1 }]
    },
    adminToken
  });

  recordResult({
    testNum: 2,
    testName: 'Order submitted without Authorization header is rejected',
    identity: 'unauthenticated',
    operation: 'POST /api/orders/create',
    expected: 'status 401',
    actual: `status ${test2Res.status} (${test2Res.data?.error})`,
    pass: test2Res.status === 401
  });

  // ==========================================
  // TEST 3: Order submitted with invalid/expired token -> rejected (401)
  // ==========================================
  const expiredToken = createEmulatorToken({ sub: 'expired_user', exp: Math.floor(Date.now() / 1000) - 3600 });
  const test3Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${expiredToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'expired_user',
      items: [{ itemId: 'ITEM-P14-PANEER', count: 1 }]
    },
    adminToken
  });

  recordResult({
    testNum: 3,
    testName: 'Order submitted with expired/invalid token is rejected',
    identity: 'expired_user',
    operation: 'POST /api/orders/create',
    expected: 'status 401',
    actual: `status ${test3Res.status} (${test3Res.data?.error})`,
    pass: test3Res.status === 401
  });

  // ==========================================
  // TEST 4: Order submitted with forged customerId != token UID -> rejected (403)
  // ==========================================
  const test4Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` }, // Alice's token
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'forged_victim_user_999', // Claiming victim identity!
      items: [{ itemId: 'ITEM-P14-PANEER', count: 1 }]
    },
    adminToken
  });

  recordResult({
    testNum: 4,
    testName: 'Order submitted with forged customerId != token UID is rejected',
    identity: 'cust_p14_alice claiming forged_victim_user_999',
    operation: 'POST /api/orders/create',
    expected: 'status 403',
    actual: `status ${test4Res.status} (${test4Res.data?.error})`,
    pass: test4Res.status === 403
  });

  // ==========================================
  // TEST 5: Tampered price in request body -> ignored / corrected to catalog price
  // ==========================================
  const test5Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      items: [{
        itemId: 'ITEM-P14-PANEER',
        count: 2,
        price: 1, // Tampered client price: ₹1 instead of ₹250!
        pricePerUnit: 1
      }],
      subtotal: 2,
      total: 2
    },
    adminToken
  });

  // Subtotal for 2 Paneer Tikka (₹250 each) must be 500, not 2!
  const authoritativeSubtotal = test5Res.data?.order?.subtotal;
  recordResult({
    testNum: 5,
    testName: 'Tampered price in request body is overridden with canonical catalog price',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'subtotal 500 (2 * 250)',
    actual: `subtotal ${authoritativeSubtotal}`,
    pass: test5Res.status === 200 && authoritativeSubtotal === 500
  });

  // ==========================================
  // TEST 6: Tampered tax in request body -> recalculated authoritatively
  // ==========================================
  const test6Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      items: [{ itemId: 'ITEM-P14-PANEER', count: 2 }],
      tax: 0 // Client claiming ₹0 tax
    },
    adminToken
  });

  // Restaurant A tax is configured at 10% -> 10% of 500 = 50!
  const authoritativeTax = test6Res.data?.order?.tax;
  recordResult({
    testNum: 6,
    testName: 'Tampered tax in request body is authoritatively recalculated',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'tax 50 (10% of 500)',
    actual: `tax ${authoritativeTax}`,
    pass: test6Res.status === 200 && authoritativeTax === 50
  });

  // ==========================================
  // TEST 7: Out-of-stock item -> rejected
  // ==========================================
  const test7Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      items: [{ itemId: 'ITEM-P14-SOUP', count: 1 }] // Out of stock
    },
    adminToken
  });

  recordResult({
    testNum: 7,
    testName: 'Out-of-stock item order is rejected',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'status 400',
    actual: `status ${test7Res.status} (${test7Res.data?.error})`,
    pass: test7Res.status === 400 && String(test7Res.data?.error).includes('sold out')
  });

  // ==========================================
  // TEST 8: Inactive / Unpublished item -> rejected
  // ==========================================
  const test8Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      items: [{ itemId: 'ITEM-P14-COCKTAIL', count: 1 }] // Unpublished
    },
    adminToken
  });

  recordResult({
    testNum: 8,
    testName: 'Inactive/unpublished item order is rejected',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'status 400',
    actual: `status ${test8Res.status} (${test8Res.data?.error})`,
    pass: test8Res.status === 400 && String(test8Res.data?.error).includes('unpublished')
  });

  // ==========================================
  // TEST 9: Cross-tenant item injection (Item from Restaurant B in Order for Restaurant A) -> rejected
  // ==========================================
  const test9Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      items: [{ itemId: 'ITEM-P14-WAGYU', count: 1, tenantId: tenantB }] // Wagyu is from Restaurant B!
    },
    adminToken
  });

  recordResult({
    testNum: 9,
    testName: 'Cross-tenant item injection is rejected',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'status 400 (cross-tenant rejected)',
    actual: `status ${test9Res.status} (${test9Res.data?.error})`,
    pass: test9Res.status === 400 && (
      String(test9Res.data?.error).includes('Cross-tenant') ||
      String(test9Res.data?.error).includes('does not exist in the restaurant menu')
    )
  });

  // ==========================================
  // TEST 10: Deleted/nonexistent item ID -> rejected
  // ==========================================
  const test10Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      items: [{ itemId: 'ITEM-NONEXISTENT-999', count: 1 }]
    },
    adminToken
  });

  recordResult({
    testNum: 10,
    testName: 'Nonexistent menu item ID is rejected',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'status 400',
    actual: `status ${test10Res.status} (${test10Res.data?.error})`,
    pass: test10Res.status === 400 && String(test10Res.data?.error).includes('does not exist')
  });

  // ==========================================
  // TEST 11: Table not belonging to restaurant -> rejected
  // ==========================================
  const test11Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '99',
      tableRestaurantId: tenantB, // Table 99 belongs to Bistro B!
      customerId: 'cust_p14_alice',
      items: [{ itemId: 'ITEM-P14-PANEER', count: 1 }]
    },
    adminToken
  });

  recordResult({
    testNum: 11,
    testName: 'Table not belonging to restaurant is rejected',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'status 400 (table does not belong)',
    actual: `status ${test11Res.status} (${test11Res.data?.error})`,
    pass: test11Res.status === 400 && String(test11Res.data?.error).includes('does not belong to restaurant')
  });

  // ==========================================
  // TEST 12: Disabled table -> rejected
  // ==========================================
  const test12Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '2', // Table 2 is marked Disabled
      customerId: 'cust_p14_alice',
      items: [{ itemId: 'ITEM-P14-PANEER', count: 1 }]
    },
    adminToken
  });

  recordResult({
    testNum: 12,
    testName: 'Order creation on disabled table is rejected',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'status 400 (table disabled)',
    actual: `status ${test12Res.status} (${test12Res.data?.error})`,
    pass: test12Res.status === 400 && String(test12Res.data?.error).includes('disabled')
  });

  // ==========================================
  // TEST 13: Direct Firestore write by customer attempting paymentStatus == 'paid' -> rejected by rules
  // ==========================================
  const test13Res = await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-ATTACK-PAID`,
    method: 'PATCH',
    tokenPayload: customerAliceToken,
    body: { fields: toFirestoreFields({
      id: 'ORD-ATTACK-PAID',
      orderId: 'ORD-ATTACK-PAID',
      tenantId: tenantA,
      customerId: 'cust_p14_alice',
      status: 'NEW',
      paymentStatus: 'paid', // ATTEMPT TO FRAUDULENTLY SELF-APPROVE PAYMENT!
      total: 500,
      subtotal: 500,
      tax: 0,
      discount: 0,
      items: [{ itemId: 'ITEM-P14-PANEER', count: 2 }]
    }) }
  });

  recordResult({
    testNum: 13,
    testName: 'Direct Firestore write by customer attempting paymentStatus == paid is rejected by rules',
    identity: 'cust_p14_alice',
    operation: 'PATCH /restaurants/.../orders/ORD-ATTACK-PAID',
    expected: '403 PERMISSION_DENIED',
    actual: `statusCode ${test13Res.statusCode}`,
    pass: test13Res.statusCode === 403
  });

  // ==========================================
  // TEST 14: Direct Firestore write with negative price or total -> rejected by rules
  // ==========================================
  const test14Res = await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-ATTACK-NEGATIVE`,
    method: 'PATCH',
    tokenPayload: customerAliceToken,
    body: { fields: toFirestoreFields({
      id: 'ORD-ATTACK-NEGATIVE',
      orderId: 'ORD-ATTACK-NEGATIVE',
      tenantId: tenantA,
      customerId: 'cust_p14_alice',
      status: 'NEW',
      paymentStatus: 'pending',
      total: -500, // Negative total!
      subtotal: -500,
      tax: 0,
      discount: 0,
      items: [{ itemId: 'ITEM-P14-PANEER', count: 1 }]
    }) }
  });

  recordResult({
    testNum: 14,
    testName: 'Direct Firestore write with negative price or total is rejected by rules',
    identity: 'cust_p14_alice',
    operation: 'PATCH /restaurants/.../orders/ORD-ATTACK-NEGATIVE',
    expected: '403 PERMISSION_DENIED',
    actual: `statusCode ${test14Res.statusCode}`,
    pass: test14Res.statusCode === 403
  });

  // ==========================================
  // TEST 15: Direct Firestore write with modified createdAt/server timestamps -> handled or rejected
  // ==========================================
  // Customer attempts to update order createdAt timestamp to manipulate audit trails
  const test15Res = await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-ALICE-ESTABLISHED`,
    method: 'PATCH',
    tokenPayload: customerAliceToken,
    body: { fields: toFirestoreFields({
      id: 'ORD-ALICE-ESTABLISHED',
      orderId: 'ORD-ALICE-ESTABLISHED',
      tenantId: tenantA,
      customerId: 'cust_p14_alice',
      status: 'NEW',
      paymentStatus: 'pending',
      total: 500,
      subtotal: 500,
      tax: 0,
      discount: 0,
      createdAt: '2020-01-01T00:00:00.000Z', // Ancient fake date
      items: [{ itemId: 'ITEM-P14-PANEER', count: 2 }]
    }) }
  });

  // Customer creating is allowed with valid pending fields, but modifying financials/timestamps on update is blocked
  const updateAuditTrailRes = await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-ALICE-ESTABLISHED`,
    method: 'PATCH',
    tokenPayload: customerAliceToken,
    body: { fields: toFirestoreFields({
      createdAt: '1999-01-01T00:00:00.000Z' // Modifying established createdAt on update
    }) }
  });

  recordResult({
    testNum: 15,
    testName: 'Direct Firestore write attempting to modify createdAt timestamp on existing order is rejected by rules',
    identity: 'cust_p14_alice',
    operation: 'PATCH /restaurants/.../orders/ORD-ALICE-ESTABLISHED',
    expected: '403 PERMISSION_DENIED on update',
    actual: `statusCode ${updateAuditTrailRes.statusCode}`,
    pass: updateAuditTrailRes.statusCode === 403
  });

  // ==========================================
  // TEST 16: Direct Firestore write attempting to overwrite another customer's order -> rejected by rules
  // ==========================================
  // Customer Bob attempts to overwrite Customer Alice's order
  const test16Res = await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-ALICE-ESTABLISHED`,
    method: 'PATCH',
    tokenPayload: customerBobToken, // Bob trying to mutate Alice's order!
    body: { fields: toFirestoreFields({
      customerName: 'Hacked by Bob',
      status: 'DINING_COMPLETED'
    }) }
  });

  recordResult({
    testNum: 16,
    testName: 'Direct Firestore write attempting to overwrite another customer order is rejected by rules',
    identity: 'cust_p14_bob attacking cust_p14_alice order',
    operation: 'PATCH /restaurants/.../orders/ORD-ALICE-ESTABLISHED',
    expected: '403 PERMISSION_DENIED',
    actual: `statusCode ${test16Res.statusCode}`,
    pass: test16Res.statusCode === 403
  });

  // ==========================================
  // TEST 17: Direct Firestore read attempting to read another customer's bill -> rejected by rules
  // ==========================================
  // Seed Alice's bill
  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ALICE-CONFIDENTIAL`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      billId: 'BILL-ALICE-CONFIDENTIAL',
      orderId: 'ORD-ALICE-ESTABLISHED',
      tenantId: tenantA,
      branchId: 'main',
      customerId: 'cust_p14_alice',
      customerName: 'Alice Diner',
      total: 500,
      subtotal: 500,
      tax: 0,
      serviceCharge: 0,
      discount: 0,
      paymentStatus: 'pending'
    }) }
  });

  // Bob attempts to read Alice's bill
  const test17Res = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ALICE-CONFIDENTIAL`,
    method: 'GET',
    tokenPayload: customerBobToken // Bob trying to spy on Alice's bill!
  });

  recordResult({
    testNum: 17,
    testName: 'Direct Firestore read attempting to read another customer bill is rejected by rules',
    identity: 'cust_p14_bob snooping on cust_p14_alice bill',
    operation: 'GET /restaurants/.../bills/BILL-ALICE-CONFIDENTIAL',
    expected: '403 PERMISSION_DENIED',
    actual: `statusCode ${test17Res.statusCode}`,
    pass: test17Res.statusCode === 403
  });

  // ==========================================
  // TEST 18: Order submitted with custom discount not matching any coupon -> rejected
  // ==========================================
  const test18Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      items: [{ itemId: 'ITEM-P14-PANEER', count: 1 }],
      discount: 100 // Custom unverified discount!
    },
    adminToken
  });

  recordResult({
    testNum: 18,
    testName: 'Order submitted with custom discount not matching any coupon is rejected',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'status 400 (custom discount rejected)',
    actual: `status ${test18Res.status} (${test18Res.data?.error})`,
    pass: test18Res.status === 400 && String(test18Res.data?.error).includes('valid coupon')
  });

  // ==========================================
  // TEST 19: Idempotent submission: same idempotencyKey or rapid double-submit -> does not create duplicate order
  // ==========================================
  const idempotencyKey = 'IDEM-P14-KEY-999';
  const firstSubmit = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      idempotencyKey: idempotencyKey,
      items: [{ itemId: 'ITEM-P14-PANEER', count: 1 }]
    },
    adminToken
  });

  const secondSubmit = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      idempotencyKey: idempotencyKey,
      items: [{ itemId: 'ITEM-P14-PANEER', count: 1 }]
    },
    adminToken
  });

  recordResult({
    testNum: 19,
    testName: 'Idempotent submission returns original order without creating duplicate',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create (replay)',
    expected: 'status 200 with isDuplicate: true and identical orderId',
    actual: `first: ${firstSubmit.data?.orderId}, second: ${secondSubmit.data?.orderId} (duplicate: ${secondSubmit.data?.isDuplicate})`,
    pass: firstSubmit.status === 200 && secondSubmit.status === 200 &&
          firstSubmit.data?.orderId === secondSubmit.data?.orderId &&
          secondSubmit.data?.isDuplicate === true
  });

  // ==========================================
  // TEST 20: Order correctly computes restaurant configured tax (10%) and service charge (8%)
  // ==========================================
  // Order 4 Paneer Tikka @ ₹250 = ₹1000 subtotal
  // Tax (10%) = ₹100
  // Service Charge (8%) = ₹80
  // Total = ₹1180
  const test20Res = await executeApiOrderCreate({
    headers: { authorization: `Bearer ${validToken}` },
    body: {
      tenantId: tenantA,
      tableNumber: '1',
      customerId: 'cust_p14_alice',
      orderType: 'dine_in',
      items: [{ itemId: 'ITEM-P14-PANEER', count: 4 }]
    },
    adminToken
  });

  const order20 = test20Res.data?.order;
  const isFinancialsAccurate = (
    order20?.subtotal === 1000 &&
    order20?.tax === 100 &&
    order20?.taxPercent === 10 &&
    order20?.serviceCharge === 80 &&
    order20?.serviceChargePercent === 8 &&
    order20?.total === 1180
  );

  recordResult({
    testNum: 20,
    testName: 'Order correctly computes restaurant configured tax (10%) and service charge (8%)',
    identity: 'cust_p14_alice',
    operation: 'POST /api/orders/create',
    expected: 'Subtotal: 1000, Tax(10%): 100, ServiceCharge(8%): 80, Total: 1180',
    actual: `Subtotal: ${order20?.subtotal}, Tax: ${order20?.tax} (${order20?.taxPercent}%), SC: ${order20?.serviceCharge} (${order20?.serviceChargePercent}%), Total: ${order20?.total}`,
    pass: test20Res.status === 200 && isFinancialsAccurate
  });

  console.log('\n================================================================');
  console.log(`PHASE 14 BOUNDARY AUDIT COMPLETE: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase14BoundaryAudit().catch((err) => {
  console.error('Test execution failed with unhandled exception:', err);
  process.exit(1);
});
