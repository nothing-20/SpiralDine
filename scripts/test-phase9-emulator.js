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
console.log('SPIRALDINE PHASE 9: REAL FIRESTORE EMULATOR TEST SUITE');
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
          values: value.map(item => {
            if (typeof item === 'string') return { stringValue: item };
            if (typeof item === 'object') return { mapValue: { fields: toFirestoreFields(item) } };
            return { stringValue: String(item) };
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

// Convert Firestore REST document to plain JS object
function fromFirestoreFields(fields) {
  if (!fields) return {};
  const res = {};
  for (const [key, val] of Object.entries(fields)) {
    if ('stringValue' in val) res[key] = val.stringValue;
    else if ('integerValue' in val) res[key] = Number(val.integerValue);
    else if ('doubleValue' in val) res[key] = Number(val.doubleValue);
    else if ('booleanValue' in val) res[key] = val.booleanValue;
    else if ('nullValue' in val) res[key] = null;
    else if ('arrayValue' in val) res[key] = (val.arrayValue.values || []).map(fromFirestoreFields);
    else if ('mapValue' in val) res[key] = fromFirestoreFields(val.mapValue.fields);
  }
  return res;
}

async function runEmulatorTestSuite() {
  console.log('--- TEST GROUP 1: SETUP SYNTHETIC FIXTURES VIA EMULATOR ADMIN ---');
  
  // Super admin / system payload to seed documents without restriction
  const adminToken = {
    sub: 'super_admin_seed',
    role: 'super_admin',
    super_admin: true
  };

  const tenantA = 'tenant_rest_A';
  const tenantB = 'tenant_rest_B';

  // Seed Users
  await firestoreRequest({
    path: 'users/waiter_A',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ uid: 'waiter_A', tenantId: tenantA, role: 'waiter', email: 'waiterA@spiraldine.test' }) }
  });

  await firestoreRequest({
    path: 'users/waiter_B',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ uid: 'waiter_B', tenantId: tenantB, role: 'waiter', email: 'waiterB@spiraldine.test' }) }
  });

  await firestoreRequest({
    path: 'users/manager_A',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ uid: 'manager_A', tenantId: tenantA, role: 'manager', email: 'managerA@spiraldine.test' }) }
  });

  await firestoreRequest({
    path: 'users/customer_alice',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ uid: 'customer_alice', tenantId: tenantA, role: 'customer', email: 'alice@spiraldine.test' }) }
  });

  // Seed Tenant A Restaurant profile
  await firestoreRequest({
    path: `restaurants/${tenantA}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ id: tenantA, name: 'Bistro Spiral A', ownerUid: 'owner_A' }) }
  });

  // Seed Menu Items
  await firestoreRequest({
    path: `restaurants/${tenantA}/menu/main/items/pizza_margherita`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ id: 'pizza_margherita', name: 'Pizza Margherita', price: 1200, isAvailable: true }) }
  });

  // Seed Table
  await firestoreRequest({
    path: `restaurants/${tenantA}/tables/table_1`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ id: 'table_1', tableNumber: 'T1', status: 'Available', minCapacity: 2, maxCapacity: 4, qrCode: 'https://test/qr/1' }) }
  });

  // Seed Orders
  // Registered Customer Alice Order
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-ALICE-1`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      orderId: 'ORD-ALICE-1',
      tenantId: tenantA,
      customerId: 'customer_alice',
      customerName: 'Alice Test',
      total: 2500,
      subtotal: 2200,
      tax: 300,
      serviceCharge: 0,
      discount: 0,
      status: 'DINING_COMPLETED',
      paymentStatus: 'pending',
      items: [{ name: 'Pizza', quantity: 1, price: 2200 }]
    }) }
  });

  // Guest A Order
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-GUEST-A`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      orderId: 'ORD-GUEST-A',
      tenantId: tenantA,
      customerId: 'guest-uid',
      customerName: 'Guest Diner A',
      total: 1500,
      subtotal: 1350,
      tax: 150,
      serviceCharge: 0,
      discount: 0,
      status: 'DINING_COMPLETED',
      paymentStatus: 'pending',
      items: [{ name: 'Pasta', quantity: 1, price: 1350 }]
    }) }
  });

  // Guest B Order
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-GUEST-B`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      orderId: 'ORD-GUEST-B',
      tenantId: tenantA,
      customerId: 'guest-uid',
      customerName: 'Guest Diner B',
      total: 3000,
      subtotal: 2700,
      tax: 300,
      serviceCharge: 0,
      discount: 0,
      status: 'DINING_COMPLETED',
      paymentStatus: 'pending',
      items: [{ name: 'Risotto', quantity: 1, price: 2700 }]
    }) }
  });

  // Tenant B Order
  await firestoreRequest({
    path: `restaurants/${tenantB}/orders/ORD-TENANT-B`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      orderId: 'ORD-TENANT-B',
      tenantId: tenantB,
      customerId: 'customer_bob',
      customerName: 'Bob Test',
      total: 4000,
      subtotal: 3600,
      tax: 400,
      serviceCharge: 0,
      discount: 0,
      status: 'DINING_COMPLETED',
      paymentStatus: 'pending',
      items: [{ name: 'Steak', quantity: 1, price: 3600 }]
    }) }
  });

  // Seed Canonical Bills
  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-ALICE-1',
      orderId: 'ORD-ALICE-1',
      tenantId: tenantA,
      customerId: 'customer_alice',
      customerName: 'Alice Test',
      total: 2500,
      subtotal: 2200,
      tax: 300,
      serviceCharge: 0,
      discount: 0,
      paymentStatus: 'pending',
      items: [{ name: 'Pizza', quantity: 1, price: 2200 }]
    }) }
  });

  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-GUEST-A',
      orderId: 'ORD-GUEST-A',
      tenantId: tenantA,
      customerId: 'guest_A',
      customerName: 'Guest Diner A',
      total: 1500,
      subtotal: 1350,
      tax: 150,
      serviceCharge: 0,
      discount: 0,
      paymentStatus: 'pending',
      items: [{ name: 'Pasta', quantity: 1, price: 1350 }]
    }) }
  });

  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-B`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-GUEST-B',
      orderId: 'ORD-GUEST-B',
      tenantId: tenantA,
      customerId: 'guest-uid',
      customerName: 'Guest Diner B',
      total: 3000,
      subtotal: 2700,
      tax: 300,
      serviceCharge: 0,
      discount: 0,
      paymentStatus: 'pending',
      items: [{ name: 'Risotto', quantity: 1, price: 2700 }]
    }) }
  });

  await firestoreRequest({
    path: `restaurants/${tenantB}/bills/BILL-ORD-TENANT-B`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-TENANT-B',
      orderId: 'ORD-TENANT-B',
      tenantId: tenantB,
      customerId: 'customer_bob',
      customerName: 'Bob Test',
      total: 4000,
      subtotal: 3600,
      tax: 400,
      serviceCharge: 0,
      discount: 0,
      paymentStatus: 'pending',
      items: [{ name: 'Steak', quantity: 1, price: 3600 }]
    }) }
  });

  // Seed Malformed Bill
  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-MALFORMED`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      billId: 'BILL-MALFORMED',
      orderId: 'ORD-MALFORMED',
      tenantId: tenantA,
      customerId: 'INVALID-UNKNOWN-NON-GUEST-ID-999',
      customerName: 'Malformed Ownership',
      total: 1000,
      subtotal: 1000,
      tax: 0,
      serviceCharge: 0,
      discount: 0,
      paymentStatus: 'pending',
      items: []
    }) }
  });

  // Seed Dining Session
  await firestoreRequest({
    path: `restaurants/${tenantA}/diningSessions/SES-GUEST-A`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      sessionId: 'SES-GUEST-A',
      tenantId: tenantA,
      status: 'active',
      billingStatus: 'pending'
    }) }
  });

  // Seed KOT
  await firestoreRequest({
    path: `restaurants/${tenantA}/kitchenTickets/KOT-GUEST-A-1`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      ticketId: 'KOT-GUEST-A-1',
      orderId: 'ORD-GUEST-A',
      tenantId: tenantA,
      status: 'NEW',
      items: [{ name: 'Pasta', quantity: 1 }]
    }) }
  });

  console.log('Synthetic fixtures created in emulator.\n');


  // ================================================================
  // STEP 4: GUEST BILL OWNERSHIP & CANONICAL BILL PERMISSIONS
  // ================================================================
  console.log('--- TEST GROUP 2: GUEST BILL OWNERSHIP & CANONICAL BILLS ---');

  // 4.1 Anonymous Diner Fetching Own Guest Bill
  const guestFetchA = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'GET',
    tokenPayload: { sub: 'guest_A' } // Authenticated anonymous guest
  });
  recordResult({
    testName: 'Guest can get their own guest bill document',
    identity: 'Authenticated Guest (auth.uid = guest_A)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'GET',
    expected: '200 OK',
    actual: guestFetchA.statusCode === 200 ? '200 OK' : `${guestFetchA.statusCode} REJECTED`,
    pass: guestFetchA.statusCode === 200
  });

  // 4.2 Anonymous Diner Attempting to Fetch Registered Customer Alice Bill
  const guestFetchAlice = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'GET',
    tokenPayload: null // Unauthenticated anonymous
  });
  recordResult({
    testName: 'Anonymous guest CANNOT get registered customer Alice bill',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    operation: 'GET',
    expected: '403 Forbidden',
    actual: guestFetchAlice.statusCode === 403 ? '403 Forbidden' : `${guestFetchAlice.statusCode} ALLOWED`,
    pass: guestFetchAlice.statusCode === 403
  });

  // 4.3 Registered Customer Alice Fetching Own Bill
  const aliceFetchOwn = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'GET',
    tokenPayload: { sub: 'customer_alice' }
  });
  recordResult({
    testName: 'Registered customer Alice CAN get her own bill',
    identity: 'Customer Alice (auth.uid = customer_alice)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    operation: 'GET',
    expected: '200 OK',
    actual: aliceFetchOwn.statusCode === 200 ? '200 OK' : `${aliceFetchOwn.statusCode} REJECTED`,
    pass: aliceFetchOwn.statusCode === 200
  });

  // 4.4 Registered Customer Alice Attempting to Fetch Bob Bill in Tenant B
  const aliceFetchBob = await firestoreRequest({
    path: `restaurants/${tenantB}/bills/BILL-ORD-TENANT-B`,
    method: 'GET',
    tokenPayload: { sub: 'customer_alice' }
  });
  recordResult({
    testName: 'Customer Alice CANNOT get Bob bill in Tenant B',
    identity: 'Customer Alice',
    path: `restaurants/${tenantB}/bills/BILL-ORD-TENANT-B`,
    operation: 'GET',
    expected: '403 Forbidden',
    actual: aliceFetchBob.statusCode === 403 ? '403 Forbidden' : `${aliceFetchBob.statusCode} ALLOWED`,
    pass: aliceFetchBob.statusCode === 403
  });

  // 4.4b Anonymous Guest Attempting to Fetch Tenant B Bill
  const anonFetchTenantBBill = await firestoreRequest({
    path: `restaurants/${tenantB}/bills/BILL-ORD-TENANT-B`,
    method: 'GET',
    tokenPayload: null
  });
  recordResult({
    testName: 'Anonymous guest CANNOT get bill from another tenant (Tenant B)',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantB}/bills/BILL-ORD-TENANT-B`,
    operation: 'GET',
    expected: '403 Forbidden',
    actual: anonFetchTenantBBill.statusCode === 403 ? '403 Forbidden' : `${anonFetchTenantBBill.statusCode} ALLOWED`,
    pass: anonFetchTenantBBill.statusCode === 403
  });

  // 4.4c Anonymous Guest Attempting to Fetch Bill with Malformed Ownership
  const anonFetchMalformed = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-MALFORMED`,
    method: 'GET',
    tokenPayload: null
  });
  recordResult({
    testName: 'Missing or malformed bill ownership does NOT authorize access',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/bills/BILL-MALFORMED`,
    operation: 'GET',
    expected: '403 Forbidden',
    actual: anonFetchMalformed.statusCode === 403 ? '403 Forbidden' : `${anonFetchMalformed.statusCode} ALLOWED`,
    pass: anonFetchMalformed.statusCode === 403
  });

  // 4.5 Anonymous User Attempting to List Canonical Bills Collection (Enumeration Prevention)
  const anonListBills = await firestoreRequest({
    path: `restaurants/${tenantA}/bills`,
    method: 'GET',
    tokenPayload: null
  });
  recordResult({
    testName: 'Anonymous user CANNOT list canonical bills collection (Enumeration Prevented)',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/bills`,
    operation: 'LIST',
    expected: '403 Forbidden',
    actual: anonListBills.statusCode === 403 ? '403 Forbidden' : `${anonListBills.statusCode} ALLOWED`,
    pass: anonListBills.statusCode === 403
  });

  // 4.6 Staff Waiter A Listing Canonical Bills
  const staffListBills = await firestoreRequest({
    path: `restaurants/${tenantA}/bills`,
    method: 'GET',
    tokenPayload: { sub: 'waiter_A' }
  });
  recordResult({
    testName: 'Authorized Tenant Staff CAN list canonical bills',
    identity: 'Waiter A (Tenant A staff)',
    path: `restaurants/${tenantA}/bills`,
    operation: 'LIST',
    expected: '200 OK',
    actual: staffListBills.statusCode === 200 ? '200 OK' : `${staffListBills.statusCode} REJECTED`,
    pass: staffListBills.statusCode === 200
  });

  // 4.7 Cross-Tenant Waiter B Listing Tenant A Bills
  const waiterBCrossList = await firestoreRequest({
    path: `restaurants/${tenantA}/bills`,
    method: 'GET',
    tokenPayload: { sub: 'waiter_B' }
  });
  recordResult({
    testName: 'Cross-Tenant Waiter B CANNOT list Tenant A canonical bills',
    identity: 'Waiter B (Tenant B staff)',
    path: `restaurants/${tenantA}/bills`,
    operation: 'LIST',
    expected: '403 Forbidden',
    actual: waiterBCrossList.statusCode === 403 ? '403 Forbidden' : `${waiterBCrossList.statusCode} ALLOWED`,
    pass: waiterBCrossList.statusCode === 403
  });


  // ================================================================
  // STEP 5: CROSS-TENANT ISOLATION
  // ================================================================
  console.log('\n--- TEST GROUP 3: CROSS-TENANT ISOLATION ---');

  // 5.1 Tenant A Waiter Attempting to Update Tenant B KOT
  const crossKotUpdate = await firestoreRequest({
    path: `restaurants/${tenantB}/kitchenTickets/KOT-B-1`,
    method: 'PATCH',
    tokenPayload: { sub: 'waiter_A' },
    body: { fields: toFirestoreFields({ status: 'COMPLETED' }) }
  });
  recordResult({
    testName: 'Tenant A Waiter CANNOT update Tenant B KOT record',
    identity: 'Waiter A',
    path: `restaurants/${tenantB}/kitchenTickets/KOT-B-1`,
    operation: 'UPDATE',
    expected: '403 Forbidden',
    actual: crossKotUpdate.statusCode === 403 ? '403 Forbidden' : `${crossKotUpdate.statusCode} ALLOWED`,
    pass: crossKotUpdate.statusCode === 403
  });

  // 5.2 Tenant A Customer Attempting to Access Tenant B Order
  const crossOrderRead = await firestoreRequest({
    path: `restaurants/${tenantB}/orders/ORD-TENANT-B`,
    method: 'GET',
    tokenPayload: { sub: 'customer_alice' }
  });
  // Note: in public read orders, check update protection:
  const crossOrderUpdate = await firestoreRequest({
    path: `restaurants/${tenantB}/orders/ORD-TENANT-B`,
    method: 'PATCH',
    tokenPayload: { sub: 'customer_alice' },
    body: { fields: toFirestoreFields({ status: 'DINING_COMPLETED' }) }
  });
  recordResult({
    testName: 'Customer Alice CANNOT update Tenant B Order',
    identity: 'Customer Alice',
    path: `restaurants/${tenantB}/orders/ORD-TENANT-B`,
    operation: 'UPDATE',
    expected: '403 Forbidden',
    actual: crossOrderUpdate.statusCode === 403 ? '403 Forbidden' : `${crossOrderUpdate.statusCode} ALLOWED`,
    pass: crossOrderUpdate.statusCode === 403
  });

  // 5.3 User Attempting to Grant Themselves Super-Admin Privileges via User Profile Write
  const selfPrivilegeEscalation = await firestoreRequest({
    path: 'users/customer_alice',
    method: 'PATCH',
    tokenPayload: { sub: 'customer_alice' },
    body: { fields: toFirestoreFields({ role: 'super_admin' }) }
  });
  recordResult({
    testName: 'Customer Alice CANNOT grant herself super_admin role in user profile',
    identity: 'Customer Alice',
    path: 'users/customer_alice',
    operation: 'UPDATE (role: super_admin)',
    expected: '403 Forbidden',
    actual: selfPrivilegeEscalation.statusCode === 403 ? '403 Forbidden' : `${selfPrivilegeEscalation.statusCode} ALLOWED`,
    pass: selfPrivilegeEscalation.statusCode === 403
  });

  // Verify that Alice still cannot write systemSettings
  const aliceTouchSettings = await firestoreRequest({
    path: 'systemSettings/global',
    method: 'PATCH',
    tokenPayload: { sub: 'customer_alice' },
    body: { fields: toFirestoreFields({ maintenance: false }) }
  });
  recordResult({
    testName: 'Customer Alice CANNOT write system settings (Super-Admin isolation)',
    identity: 'Customer Alice',
    path: 'systemSettings/global',
    operation: 'WRITE',
    expected: '403 Forbidden',
    actual: aliceTouchSettings.statusCode === 403 ? '403 Forbidden' : `${aliceTouchSettings.statusCode} ALLOWED`,
    pass: aliceTouchSettings.statusCode === 403
  });


  // ================================================================
  // STEP 6: PAYMENT AND SETTLEMENT RULES EVALUATION
  // ================================================================
  console.log('\n--- TEST GROUP 4: PAYMENT AND SETTLEMENT DIRECT WRITE LOCK ---');

  // 6.1 Anonymous Guest Attempting to Directly Mark Bill Paid
  const anonDirectPayBill = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'PATCH',
    tokenPayload: null,
    body: { fields: toFirestoreFields({ paymentStatus: 'paid' }) }
  });
  recordResult({
    testName: 'Anonymous guest CANNOT directly mark a bill paid in Firestore',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'UPDATE (paymentStatus: paid)',
    expected: '403 Forbidden',
    actual: anonDirectPayBill.statusCode === 403 ? '403 Forbidden' : `${anonDirectPayBill.statusCode} ALLOWED`,
    pass: anonDirectPayBill.statusCode === 403
  });

  // 6.2 Registered Customer Alice Attempting to Directly Mark Her Bill Paid
  const aliceDirectPayBill = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'PATCH',
    tokenPayload: { sub: 'customer_alice' },
    body: { fields: toFirestoreFields({ paymentStatus: 'paid' }) }
  });
  recordResult({
    testName: 'Registered Customer Alice CANNOT directly mark her bill paid',
    identity: 'Customer Alice',
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    operation: 'UPDATE (paymentStatus: paid)',
    expected: '403 Forbidden',
    actual: aliceDirectPayBill.statusCode === 403 ? '403 Forbidden' : `${aliceDirectPayBill.statusCode} ALLOWED`,
    pass: aliceDirectPayBill.statusCode === 403
  });

  // 6.3 Customer Alice Attempting to Modify Authoritative Bill Totals
  const aliceTamperBillTotal = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'PATCH',
    tokenPayload: { sub: 'customer_alice' },
    body: { fields: toFirestoreFields({ total: 100 }) }
  });
  recordResult({
    testName: 'Customer Alice CANNOT modify authoritative bill total',
    identity: 'Customer Alice',
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    operation: 'UPDATE (total: 100)',
    expected: '403 Forbidden',
    actual: aliceTamperBillTotal.statusCode === 403 ? '403 Forbidden' : `${aliceTamperBillTotal.statusCode} ALLOWED`,
    pass: aliceTamperBillTotal.statusCode === 403
  });

  // 6.4 Anonymous Guest Attempting to Set Dining Session billingStatus to Paid
  const guestPaySession = await firestoreRequest({
    path: `restaurants/${tenantA}/diningSessions/SES-GUEST-A`,
    method: 'PATCH',
    tokenPayload: null,
    body: { fields: toFirestoreFields({ billingStatus: 'paid' }) }
  });
  recordResult({
    testName: 'Anonymous guest CANNOT mark dining session billingStatus as paid',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/diningSessions/SES-GUEST-A`,
    operation: 'UPDATE (billingStatus: paid)',
    expected: '403 Forbidden',
    actual: guestPaySession.statusCode === 403 ? '403 Forbidden' : `${guestPaySession.statusCode} ALLOWED`,
    pass: guestPaySession.statusCode === 403
  });

  // 6.5 Customer Attempting to Delete Canonical Bill
  const aliceDeleteBill = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'DELETE',
    tokenPayload: { sub: 'customer_alice' }
  });
  recordResult({
    testName: 'Customer Alice CANNOT delete canonical bill (bills are permanent records)',
    identity: 'Customer Alice',
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    operation: 'DELETE',
    expected: '403 Forbidden',
    actual: aliceDeleteBill.statusCode === 403 ? '403 Forbidden' : `${aliceDeleteBill.statusCode} ALLOWED`,
    pass: aliceDeleteBill.statusCode === 403
  });

  // 6.6 Staff Attempting to Delete Canonical Bill (Forbidden even for staff)
  const staffDeleteBill = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'DELETE',
    tokenPayload: { sub: 'manager_A' }
  });
  recordResult({
    testName: 'Manager CANNOT delete canonical bill (bills deletion forbidden for all)',
    identity: 'Manager A',
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    operation: 'DELETE',
    expected: '403 Forbidden',
    actual: staffDeleteBill.statusCode === 403 ? '403 Forbidden' : `${staffDeleteBill.statusCode} ALLOWED`,
    pass: staffDeleteBill.statusCode === 403
  });


  // ================================================================
  // STEP 7: LEGITIMATE QR ORDERING & WORKFLOW PERMISSIONS
  // ================================================================
  console.log('\n--- TEST GROUP 5: LEGITIMATE ANONYMOUS QR ORDERING WORKFLOW ---');

  // 7.1 Reading Public Menu Items
  const publicMenuRead = await firestoreRequest({
    path: `restaurants/${tenantA}/menu/main/items/pizza_margherita`,
    method: 'GET',
    tokenPayload: null
  });
  recordResult({
    testName: 'Anonymous guest CAN read public menu item',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/menu/main/items/pizza_margherita`,
    operation: 'GET',
    expected: '200 OK',
    actual: publicMenuRead.statusCode === 200 ? '200 OK' : `${publicMenuRead.statusCode} REJECTED`,
    pass: publicMenuRead.statusCode === 200
  });

  // 7.2 Creating Legitimate Guest Order
  const validGuestOrderCreate = await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-GUEST-VALID-99`,
    method: 'PATCH',
    tokenPayload: null,
    body: { fields: toFirestoreFields({
      orderId: 'ORD-GUEST-VALID-99',
      tenantId: tenantA,
      customerId: 'guest-uid',
      customerName: 'Guest QR Diner',
      total: 1200,
      subtotal: 1200,
      tax: 0,
      serviceCharge: 0,
      discount: 0,
      status: 'NEW',
      paymentStatus: 'pending',
      items: [{ name: 'Pizza Margherita', quantity: 1, price: 1200 }]
    }) }
  });
  recordResult({
    testName: 'Anonymous guest CAN create legitimate new order with status NEW and pending payment',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/orders/ORD-GUEST-VALID-99`,
    operation: 'CREATE',
    expected: '200 OK',
    actual: validGuestOrderCreate.statusCode === 200 ? '200 OK' : `${validGuestOrderCreate.statusCode} REJECTED`,
    pass: validGuestOrderCreate.statusCode === 200
  });

  // 7.3 Guest Updating Table to Occupied during Dining
  const guestTableOccupy = await firestoreRequest({
    path: `restaurants/${tenantA}/tables/table_1`,
    method: 'PATCH',
    tokenPayload: null,
    body: { fields: toFirestoreFields({
      id: 'table_1',
      tableNumber: 'T1',
      status: 'Occupied',
      minCapacity: 2,
      maxCapacity: 4,
      qrCode: 'https://test/qr/1',
      activeOrderId: 'ORD-GUEST-VALID-99',
      customerName: 'Guest QR Diner'
    }) }
  });
  recordResult({
    testName: 'Anonymous guest CAN update table occupancy status to Occupied',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/tables/table_1`,
    operation: 'UPDATE (status: Occupied)',
    expected: '200 OK',
    actual: guestTableOccupy.statusCode === 200 ? '200 OK' : `${guestTableOccupy.statusCode} REJECTED`,
    pass: guestTableOccupy.statusCode === 200
  });

  // 7.4 Guest Attempting to Overwrite Table MaxCapacity (Administrative field)
  const guestTableAdminTamper = await firestoreRequest({
    path: `restaurants/${tenantA}/tables/table_1`,
    method: 'PATCH',
    tokenPayload: null,
    body: { fields: toFirestoreFields({
      id: 'table_1',
      tableNumber: 'T1',
      status: 'Occupied',
      minCapacity: 2,
      maxCapacity: 100, // Tampered administrative field
      qrCode: 'https://test/qr/1'
    }) }
  });
  recordResult({
    testName: 'Anonymous guest CANNOT alter table administrative capacity',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/tables/table_1`,
    operation: 'UPDATE (maxCapacity: 100)',
    expected: '403 Forbidden',
    actual: guestTableAdminTamper.statusCode === 403 ? '403 Forbidden' : `${guestTableAdminTamper.statusCode} ALLOWED`,
    pass: guestTableAdminTamper.statusCode === 403
  });

  // 7.5 Guest Requesting Bill on Dining Session
  const guestRequestSessionBill = await firestoreRequest({
    path: `restaurants/${tenantA}/diningSessions/SES-GUEST-A`,
    method: 'PATCH',
    tokenPayload: null,
    body: { fields: toFirestoreFields({
      sessionId: 'SES-GUEST-A',
      tenantId: tenantA,
      status: 'active',
      billingStatus: 'requested'
    }) }
  });
  recordResult({
    testName: 'Anonymous guest CAN update dining session billingStatus to requested',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/diningSessions/SES-GUEST-A`,
    operation: 'UPDATE (billingStatus: requested)',
    expected: '200 OK',
    actual: guestRequestSessionBill.statusCode === 200 ? '200 OK' : `${guestRequestSessionBill.statusCode} REJECTED`,
    pass: guestRequestSessionBill.statusCode === 200
  });

  // 7.6 Customer/Guest Attempting to Update KOT Status (Forbidden - Kitchen Staff only)
  const guestUpdateKot = await firestoreRequest({
    path: `restaurants/${tenantA}/kitchenTickets/KOT-GUEST-A-1`,
    method: 'PATCH',
    tokenPayload: null,
    body: { fields: toFirestoreFields({
      ticketId: 'KOT-GUEST-A-1',
      orderId: 'ORD-GUEST-A',
      tenantId: tenantA,
      status: 'READY'
    }) }
  });
  recordResult({
    testName: 'Anonymous guest CANNOT update KOT ticket status',
    identity: 'Anonymous Guest',
    path: `restaurants/${tenantA}/kitchenTickets/KOT-GUEST-A-1`,
    operation: 'UPDATE (status: READY)',
    expected: '403 Forbidden',
    actual: guestUpdateKot.statusCode === 403 ? '403 Forbidden' : `${guestUpdateKot.statusCode} ALLOWED`,
    pass: guestUpdateKot.statusCode === 403
  });

  // 7.7 Authorized Staff Updating KOT Status
  const staffUpdateKot = await firestoreRequest({
    path: `restaurants/${tenantA}/kitchenTickets/KOT-GUEST-A-1`,
    method: 'PATCH',
    tokenPayload: { sub: 'waiter_A' },
    body: { fields: toFirestoreFields({
      ticketId: 'KOT-GUEST-A-1',
      orderId: 'ORD-GUEST-A',
      tenantId: tenantA,
      status: 'PREPARING'
    }) }
  });
  recordResult({
    testName: 'Authorized Tenant Staff CAN update KOT ticket status',
    identity: 'Waiter A',
    path: `restaurants/${tenantA}/kitchenTickets/KOT-GUEST-A-1`,
    operation: 'UPDATE (status: PREPARING)',
    expected: '200 OK',
    actual: staffUpdateKot.statusCode === 200 ? '200 OK' : `${staffUpdateKot.statusCode} REJECTED`,
    pass: staffUpdateKot.statusCode === 200
  });


  // ================================================================
  // FINAL EMULATOR RESULTS SUMMARY
  // ================================================================
  console.log('\n================================================================');
  console.log('REAL FIRESTORE EMULATOR TEST SUMMARY');
  console.log(`TOTAL REAL EMULATOR TESTS : ${totalTests}`);
  console.log(`PASSED                    : ${passedTests}`);
  console.log(`FAILED                    : ${failedTests}`);
  console.log('================================================================');

  if (failedTests === 0) {
    console.log('\n🎉 ALL REAL FIRESTORE EMULATOR SECURITY TESTS PASSED CLEANLY!\n');
    process.exit(0);
  } else {
    console.error(`\n❌ ${failedTests} EMULATOR TESTS FAILED!\n`);
    process.exit(1);
  }
}

runEmulatorTestSuite().catch(err => {
  console.error('[FATAL EMULATOR TEST ERROR]:', err);
  process.exit(1);
});
