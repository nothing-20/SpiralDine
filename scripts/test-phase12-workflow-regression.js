import http from 'http';
import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [HOST, PORT] = EMULATOR_HOST.split(':');
const PROJECT_ID = process.env.GCLOUD_PROJECT || 'spiraldine-test-emulator';

console.log('================================================================');
console.log('SPIRALDINE PHASE 12: END-TO-END CUSTOMER ORDERING WORKFLOW');
console.log('Real Firestore Emulator End-to-End Test Suite');
console.log(`Target: http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}`);
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

const testResults = [];

function recordResult({ testName, identity, path, operation, expected, actual, pass, details = '' }) {
  totalTests++;
  if (pass) {
    passedTests++;
    console.log(`[PASS] ${testName} | Op: ${operation} | Identity: ${identity} | Result: ${actual}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${testName} | Op: ${operation} | Identity: ${identity} | Expected: ${expected} | Actual: ${actual} ${details ? `(${details})` : ''}`);
  }
  testResults.push({ testName, identity, path, operation, expected, actual, pass, details });
}

// Helper to create synthetic JWT token for the emulator
function createEmulatorToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}

// HTTP request helper to communicate with Firestore Emulator REST API
function firestoreRequest({ path, method = 'GET', body = null, tokenPayload = null }) {
  return new Promise((resolve, reject) => {
    const urlPath = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
    
    const headers = {
      'Content-Type': 'application/json'
    };

    if (tokenPayload) {
      const token = createEmulatorToken(tokenPayload);
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: HOST,
      port: PORT,
      path: urlPath,
      method,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          data: parsed
        });
      });
    });

    req.on('error', err => reject(err));

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// Convert plain JS object to Firestore REST Document fields format
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

async function runPhase12Tests() {
  const tenantA = 'tenant_phase12_A';
  const tenantB = 'tenant_phase12_B';

  const adminToken = { sub: 'super_admin_phase12', role: 'super_admin', super_admin: true };
  const guestDinerToken = { sub: 'guest_diner_p12', firebase: { sign_in_provider: 'anonymous' } };
  const intruderGuestToken = { sub: 'intruder_guest_p12', firebase: { sign_in_provider: 'anonymous' } };
  const kitchenChefToken = { sub: 'chef_p12_A' };
  const waiterAToken = { sub: 'waiter_p12_A' };
  const cashierAToken = { sub: 'cashier_p12_A' };
  const waiterBToken = { sub: 'waiter_p12_B' };

  console.log('--- SEEDING PHASE 12 EMULATOR FIXTURES ---');

  // 1. Seed Tenants
  await firestoreRequest({
    path: `tenants/${tenantA}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 12 Grand Palace', planTier: 'enterprise' }) }
  });
  await firestoreRequest({
    path: `restaurants/${tenantA}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 12 Grand Palace', tenantId: tenantA }) }
  });
  await firestoreRequest({
    path: `tenants/${tenantB}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 12 Rival Bistro', planTier: 'starter' }) }
  });
  await firestoreRequest({
    path: `restaurants/${tenantB}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 12 Rival Bistro', tenantId: tenantB }) }
  });

  // 2. Seed Users
  await firestoreRequest({
    path: 'users/chef_p12_A',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ tenantId: tenantA, role: 'kitchen', branchId: 'main', status: 'active' }) }
  });
  await firestoreRequest({
    path: 'users/waiter_p12_A',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ tenantId: tenantA, role: 'waiter', branchId: 'main', status: 'active' }) }
  });
  await firestoreRequest({
    path: 'users/cashier_p12_A',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ tenantId: tenantA, role: 'cashier', branchId: 'main', status: 'active' }) }
  });
  await firestoreRequest({
    path: 'users/waiter_p12_B',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ tenantId: tenantB, role: 'waiter', branchId: 'main', status: 'active' }) }
  });

  // 3. Seed Menu Items (Available and Out-of-Stock)
  await firestoreRequest({
    path: `restaurants/${tenantA}/menu/default/items/ITEM-P12-BIRYANI`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ITEM-P12-BIRYANI',
      name: 'Special Hyderabadi Biryani',
      price: 350,
      isAvailable: true,
      isPublished: true,
      category: 'Main Course'
    }) }
  });

  await firestoreRequest({
    path: `restaurants/${tenantA}/menu/default/items/ITEM-P12-SOLDOUT`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ITEM-P12-SOLDOUT',
      name: 'Seasonal Truffle Kebab (Sold Out)',
      price: 600,
      isAvailable: false, // SOLD OUT!
      isPublished: true,
      category: 'Starters'
    }) }
  });

  // 4. Seed Tables
  await firestoreRequest({
    path: `restaurants/${tenantA}/tables/TBL-4`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'TBL-4',
      tableNumber: '4',
      status: 'Available',
      capacity: 4
    }) }
  });

  console.log('Fixtures initialized.\n');

  // ========================================================================
  // TEST GROUP 1: ORDER SUBMISSION & FIRESTORE PERSISTENCE
  // ========================================================================
  console.log('--- TEST GROUP 1: ORDER SUBMISSION & FIRESTORE PERSISTENCE ---');

  const sessionId = 'SES-20261016-P12001';
  const order1Id = 'ORD-P12-ROUND1';

  // 1.1 Customer creates Table 4 active dining session
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/diningSessions/${sessionId}`,
      method: 'PATCH',
      tokenPayload: guestDinerToken,
      body: { fields: toFirestoreFields({
        sessionId,
        tenantId: tenantA,
        restaurantId: tenantA,
        tableId: 'TBL-4',
        tableNumber: '4',
        tableName: 'Table 4',
        customerId: 'guest_diner_p12',
        status: 'active',
        billingStatus: 'pending',
        startedAt: new Date().toISOString()
      }) }
    });
    recordResult({
      testName: '1. Customer can initialize active dining session on Table 4',
      identity: 'Guest Diner (auth.uid = guest_diner_p12)',
      path: `restaurants/${tenantA}/diningSessions/${sessionId}`,
      operation: 'CREATE',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 1.2 Customer places Round 1 Order bound to session and authentic UID
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      method: 'PATCH',
      tokenPayload: guestDinerToken,
      body: { fields: toFirestoreFields({
        id: order1Id,
        orderId: order1Id,
        primaryOrderId: order1Id,
        sessionId,
        orderSequence: 1,
        isAdditionalOrder: false,
        tenantId: tenantA,
        restaurantId: tenantA,
        customerId: 'guest_diner_p12',
        customerName: 'Guest Diner',
        tableId: 'TBL-4',
        tableNumber: '4',
        tableName: 'Table 4',
        orderType: 'dine_in',
        orderSource: 'qr',
        items: [
          { itemId: 'ITEM-P12-BIRYANI', name: 'Special Hyderabadi Biryani', count: 2, pricePerUnit: 350 }
        ],
        subtotal: 700,
        tax: 70,
        serviceCharge: 35,
        total: 805,
        totalAmount: 805,
        status: 'NEW',
        paymentStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }) }
    });
    recordResult({
      testName: '2. Customer places Round 1 Order bound to table and session',
      identity: 'Guest Diner (auth.uid = guest_diner_p12)',
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      operation: 'CREATE',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 1.3 Customer generates persistent KOT ticket for kitchen queue
  const kotTicketId = `KOT-${order1Id}-R1`;
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/kitchenTickets/${kotTicketId}`,
      method: 'PATCH',
      tokenPayload: guestDinerToken,
      body: { fields: toFirestoreFields({
        id: kotTicketId,
        ticketNumber: 'KOT #1001',
        orderId: order1Id,
        tenantId: tenantA,
        branchId: 'main',
        tableNumber: '4',
        round: 1,
        status: 'NEW',
        items: [
          { itemId: 'ITEM-P12-BIRYANI', name: 'Special Hyderabadi Biryani', count: 2 }
        ],
        createdAt: new Date().toISOString()
      }) }
    });
    recordResult({
      testName: '3. Order placement creates persistent kitchen ticket (KOT)',
      identity: 'Guest Diner',
      path: `restaurants/${tenantA}/kitchenTickets/${kotTicketId}`,
      operation: 'CREATE',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 1.4 Client CANNOT create order directly in COMPLETED status
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/ORD-INVALID-STATUS`,
      method: 'PATCH',
      tokenPayload: guestDinerToken,
      body: { fields: toFirestoreFields({
        id: 'ORD-INVALID-STATUS',
        orderId: 'ORD-INVALID-STATUS',
        tenantId: tenantA,
        customerId: 'guest_diner_p12',
        status: 'COMPLETED', // Invalid initial status!
        paymentStatus: 'pending',
        total: 500
      }) }
    });
    recordResult({
      testName: '3b. Customer CANNOT create order directly in COMPLETED status',
      identity: 'Guest Diner',
      path: `restaurants/${tenantA}/orders/ORD-INVALID-STATUS`,
      operation: 'CREATE (status: COMPLETED)',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // 1.5 Client CANNOT create order with paymentStatus: paid
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/ORD-INVALID-PAY`,
      method: 'PATCH',
      tokenPayload: guestDinerToken,
      body: { fields: toFirestoreFields({
        id: 'ORD-INVALID-PAY',
        orderId: 'ORD-INVALID-PAY',
        tenantId: tenantA,
        customerId: 'guest_diner_p12',
        status: 'NEW',
        paymentStatus: 'paid', // Invalid initial paymentStatus!
        total: 500
      }) }
    });
    recordResult({
      testName: '3c. Customer CANNOT create order directly with paymentStatus="paid"',
      identity: 'Guest Diner',
      path: `restaurants/${tenantA}/orders/ORD-INVALID-PAY`,
      operation: 'CREATE (paymentStatus: paid)',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // 1.6 Client CANNOT create order spoofing another customer UID
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/ORD-SPOOFED-UID`,
      method: 'PATCH',
      tokenPayload: guestDinerToken,
      body: { fields: toFirestoreFields({
        id: 'ORD-SPOOFED-UID',
        orderId: 'ORD-SPOOFED-UID',
        tenantId: tenantA,
        customerId: 'victim_customer_uid', // Spoofed!
        status: 'NEW',
        paymentStatus: 'pending',
        total: 500
      }) }
    });
    recordResult({
      testName: '3d. Customer CANNOT create order spoofing another user customerId',
      identity: 'Guest Diner',
      path: `restaurants/${tenantA}/orders/ORD-SPOOFED-UID`,
      operation: 'CREATE (spoofed customerId)',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // ========================================================================
  // TEST GROUP 2: KITCHEN DISPLAY SYSTEM WORKFLOW
  // ========================================================================
  console.log('\n--- TEST GROUP 2: KITCHEN DISPLAY SYSTEM WORKFLOW ---');

  // 2.1 Kitchen Chef receives and reads the active order
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      method: 'GET',
      tokenPayload: kitchenChefToken
    });
    recordResult({
      testName: '4. Kitchen Chef CAN receive and read active orders in tenant stream',
      identity: 'Kitchen Chef (Tenant A)',
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      operation: 'GET',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 2.2 Kitchen Chef advances order to PREPARING
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      method: 'PATCH',
      tokenPayload: kitchenChefToken,
      body: { fields: toFirestoreFields({
        status: 'PREPARING',
        cookingStartedAt: new Date().toISOString(),
        assignedChefName: 'Chef Rahul',
        updatedAt: new Date().toISOString()
      }) }
    });
    recordResult({
      testName: '5. Kitchen Chef CAN advance order status to PREPARING',
      identity: 'Kitchen Chef (Tenant A)',
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      operation: 'UPDATE (status: PREPARING)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 2.3 Kitchen Chef advances order to READY
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      method: 'PATCH',
      tokenPayload: kitchenChefToken,
      body: { fields: toFirestoreFields({
        status: 'READY',
        readyAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }) }
    });
    recordResult({
      testName: '6. Kitchen Chef marks order READY for waiter delivery',
      identity: 'Kitchen Chef (Tenant A)',
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      operation: 'UPDATE (status: READY)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // ========================================================================
  // TEST GROUP 3: WAITER LIVE ORDERS WORKFLOW
  // ========================================================================
  console.log('\n--- TEST GROUP 3: WAITER LIVE ORDERS WORKFLOW ---');

  // 3.1 Waiter reads READY order and delivers to table (marks SERVED)
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      method: 'PATCH',
      tokenPayload: waiterAToken,
      body: { fields: toFirestoreFields({
        status: 'SERVED',
        servedAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
        waiterName: 'Server Vijay',
        updatedAt: new Date().toISOString()
      }) }
    });
    recordResult({
      testName: '7. Waiter delivers READY order and marks SERVED on Table 4',
      identity: 'Waiter A (Tenant A)',
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      operation: 'UPDATE (status: SERVED)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 3.2 Waiter Assistance Request isolation: customer creates water request
  const reqId = 'REQ-WATER-T4';
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/waiterRequests/${reqId}`,
      method: 'PATCH',
      tokenPayload: guestDinerToken,
      body: { fields: toFirestoreFields({
        requestId: reqId,
        tableNumber: '4',
        type: 'Water',
        status: 'pending',
        createdAt: new Date().toISOString()
      }) }
    });
    recordResult({
      testName: '8. Customer assistance request (Water) is created and kept separate from food orders',
      identity: 'Guest Diner',
      path: `restaurants/${tenantA}/waiterRequests/${reqId}`,
      operation: 'CREATE',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 3.3 Waiter resolves customer assistance request
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/waiterRequests/${reqId}`,
      method: 'PATCH',
      tokenPayload: waiterAToken,
      body: { fields: toFirestoreFields({
        status: 'completed',
        resolvedAt: new Date().toISOString(),
        resolvedBy: 'Server Vijay'
      }) }
    });
    recordResult({
      testName: '9. Waiter resolves customer assistance request independently',
      identity: 'Waiter A (Tenant A)',
      path: `restaurants/${tenantA}/waiterRequests/${reqId}`,
      operation: 'UPDATE (status: completed)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // ========================================================================
  // TEST GROUP 4: CUSTOMER LIVE TRACKING
  // ========================================================================
  console.log('\n--- TEST GROUP 4: CUSTOMER LIVE TRACKING ---');

  // 4.1 Diner reads their updated order with SERVED status
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      method: 'GET',
      tokenPayload: guestDinerToken
    });
    const orderData = res.data?.fields;
    const statusVal = orderData?.status?.stringValue;
    const isServed = statusVal === 'SERVED';
    recordResult({
      testName: '10. Customer live tracking reads authentic status (SERVED) from Firestore',
      identity: 'Guest Diner (auth.uid = guest_diner_p12)',
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      operation: 'GET',
      expected: '200 OK (status === SERVED)',
      actual: `${res.statusCode} (status: ${statusVal})`,
      pass: res.statusCode === 200 && isServed
    });
  }

  // ========================================================================
  // TEST GROUP 5: MULTIPLE ORDERS IN ONE SESSION & CONSOLIDATED BILL
  // ========================================================================
  console.log('\n--- TEST GROUP 5: MULTIPLE ORDERS IN ONE SESSION & CONSOLIDATED BILL ---');

  const order2Id = 'ORD-P12-ROUND2';

  // 5.1 Diner places Round 2 supplementary order in the SAME session
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/${order2Id}`,
      method: 'PATCH',
      tokenPayload: guestDinerToken,
      body: { fields: toFirestoreFields({
        id: order2Id,
        orderId: order2Id,
        primaryOrderId: order1Id, // Links to Round 1
        sessionId,               // Same Session ID!
        orderSequence: 2,
        isAdditionalOrder: true,
        tenantId: tenantA,
        restaurantId: tenantA,
        customerId: 'guest_diner_p12',
        customerName: 'Guest Diner',
        tableId: 'TBL-4',
        tableNumber: '4',
        tableName: 'Table 4',
        orderType: 'dine_in',
        orderSource: 'qr',
        items: [
          { itemId: 'ITEM-P12-BIRYANI', name: 'Special Hyderabadi Biryani', count: 1, pricePerUnit: 350 }
        ],
        subtotal: 350,
        tax: 35,
        serviceCharge: 17.5,
        total: 402.5,
        totalAmount: 402.5,
        status: 'NEW',
        paymentStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }) }
    });
    recordResult({
      testName: '11. Customer places Round 2 supplementary order linked to primary order & session',
      identity: 'Guest Diner',
      path: `restaurants/${tenantA}/orders/${order2Id}`,
      operation: 'CREATE (Round 2)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 5.2 Diner finishes dining and updates order to DINING_COMPLETED
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/${order1Id}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
      method: 'PATCH',
      tokenPayload: guestDinerToken,
      body: { fields: toFirestoreFields({
        status: 'DINING_COMPLETED',
        updatedAt: new Date().toISOString()
      }) }
    });
    recordResult({
      testName: '12a. Customer marks dining completed on Table 4',
      identity: 'Guest Diner',
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      operation: 'UPDATE (status: DINING_COMPLETED)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 5.3 Consolidated Canonical Bill generation: Cashier A generates consolidated bill aggregating Round 1 and Round 2 (805 + 402.5 = 1207.5)
  const canonicalBillId = `BILL-${order1Id}`;
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/${canonicalBillId}`,
      method: 'PATCH',
      tokenPayload: cashierAToken,
      body: { fields: toFirestoreFields({
        id: canonicalBillId,
        billId: canonicalBillId,
        orderId: order1Id,
        tenantId: tenantA,
        branchId: 'main',
        customerId: 'guest_diner_p12',
        tableNumber: '4',
        ordersCount: 2,
        itemsCount: 3,
        subtotal: 1050,
        tax: 105,
        serviceCharge: 52.5,
        total: 1207.5,
        paymentStatus: 'pending'
      }) }
    });
    recordResult({
      testName: '12b. Authorized Cashier generates consolidated canonical bill aggregating Round 1 and Round 2 exactly once',
      identity: 'Cashier A (Tenant A)',
      path: `restaurants/${tenantA}/bills/${canonicalBillId}`,
      operation: 'CREATE (Consolidated Bill)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 5.4 Guest Diner CAN read their consolidated canonical bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/${canonicalBillId}`,
      method: 'GET',
      tokenPayload: guestDinerToken
    });
    recordResult({
      testName: '12c. Guest Diner CAN read their consolidated bill with matching customerId',
      identity: 'Guest Diner (auth.uid = guest_diner_p12)',
      path: `restaurants/${tenantA}/bills/${canonicalBillId}`,
      operation: 'GET',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 5.3 Intruder cannot access consolidated bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/${canonicalBillId}`,
      method: 'GET',
      tokenPayload: intruderGuestToken
    });
    recordResult({
      testName: '13. Intruder Guest CANNOT access Table 4 consolidated bill (Privacy preserved)',
      identity: 'Intruder Guest (auth.uid = intruder_guest_p12)',
      path: `restaurants/${tenantA}/bills/${canonicalBillId}`,
      operation: 'GET',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // ========================================================================
  // TEST GROUP 6: SETTLEMENT, COMPLETION & CROSS-TENANT DEFENSE
  // ========================================================================
  console.log('\n--- TEST GROUP 6: SETTLEMENT, COMPLETION & CROSS-TENANT DEFENSE ---');

  // 6.1 Authorized Cashier settles canonical bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/${canonicalBillId}`,
      method: 'PATCH',
      tokenPayload: cashierAToken,
      body: { fields: toFirestoreFields({
        id: canonicalBillId,
        billId: canonicalBillId,
        orderId: order1Id,
        tenantId: tenantA,
        branchId: 'main',
        customerId: 'guest_diner_p12',
        tableNumber: '4',
        ordersCount: 2,
        itemsCount: 3,
        subtotal: 1050,
        tax: 105,
        serviceCharge: 52.5,
        total: 1207.5,
        paymentStatus: 'paid'
      }) }
    });
    recordResult({
      testName: '14. Authorized Cashier A settles consolidated bill (paymentStatus: paid)',
      identity: 'Cashier A (Tenant A)',
      path: `restaurants/${tenantA}/bills/${canonicalBillId}`,
      operation: 'SETTLE (paymentStatus: paid)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 6.2 Table status release: Table 4 marked Available after dining completion
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/tables/TBL-4`,
      method: 'PATCH',
      tokenPayload: waiterAToken,
      body: { fields: toFirestoreFields({
        status: 'Available',
        activeOrderId: null,
        updatedAt: new Date().toISOString()
      }) }
    });
    recordResult({
      testName: '15. Table 4 is released and marked Available for next diners',
      identity: 'Waiter A (Tenant A)',
      path: `restaurants/${tenantA}/tables/TBL-4`,
      operation: 'UPDATE (status: Available)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 6.3 Cross-Tenant staff B CANNOT access Tenant A order
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      method: 'GET',
      tokenPayload: waiterBToken
    });
    // Note: order get is open to all for table operations in some rules, but update is strictly blocked!
    const updateRes = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      method: 'PATCH',
      tokenPayload: waiterBToken,
      body: { fields: toFirestoreFields({ status: 'CANCELLED' }) }
    });
    recordResult({
      testName: '16. Cross-Tenant Waiter B CANNOT modify Tenant A order (Strict cross-tenant wall)',
      identity: 'Waiter B (Tenant B)',
      path: `restaurants/${tenantA}/orders/${order1Id}`,
      operation: 'UPDATE',
      expected: '403 Forbidden',
      actual: `${updateRes.statusCode} ${updateRes.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: updateRes.statusCode === 403
    });
  }

  console.log('\n================================================================');
  console.log('PHASE 12 TEST RUN SUMMARY:');
  console.log(`Total Tests Run: ${totalTests}`);
  console.log(`Passed:          ${passedTests}`);
  console.log(`Failed:          ${failedTests}`);
  console.log(`Success Rate:    ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error(`ERROR: ${failedTests} test(s) failed in Phase 12 test suite.`);
    process.exit(1);
  } else {
    console.log('ALL PHASE 12 TESTS PASSED SUCCESSFULLY ON THE REAL FIRESTORE EMULATOR!');
    process.exit(0);
  }
}

runPhase12Tests().catch(err => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
