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
console.log('SPIRALDINE PHASE 10: SECURE GUEST IDENTITY AND BILL OWNERSHIP');
console.log('Real Firestore Emulator Test Suite');
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

async function runPhase10Tests() {
  const tenantA = 'tenant_phase10_A';
  const tenantB = 'tenant_phase10_B';

  const adminToken = { sub: 'super_admin_phase10', role: 'super_admin', super_admin: true };

  console.log('--- SEEDING PHASE 10 EMULATOR FIXTURES ---');

  // 1. Seed Tenants
  await firestoreRequest({
    path: `tenants/${tenantA}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 10 Restaurant A', planTier: 'starter' }) }
  });
  await firestoreRequest({
    path: `restaurants/${tenantA}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 10 Restaurant A', tenantId: tenantA }) }
  });

  await firestoreRequest({
    path: `tenants/${tenantB}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 10 Restaurant B', planTier: 'pro' }) }
  });
  await firestoreRequest({
    path: `restaurants/${tenantB}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 10 Restaurant B', tenantId: tenantB }) }
  });

  // 2. Seed Users
  await firestoreRequest({
    path: 'users/waiter_p10_A',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ tenantId: tenantA, role: 'waiter', branchId: 'main', status: 'active' }) }
  });

  await firestoreRequest({
    path: 'users/cashier_p10_A',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ tenantId: tenantA, role: 'cashier', branchId: 'main', status: 'active' }) }
  });

  await firestoreRequest({
    path: 'users/waiter_p10_B',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ tenantId: tenantB, role: 'waiter', branchId: 'main', status: 'active' }) }
  });

  await firestoreRequest({
    path: 'customers/customer_alice',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ fullName: 'Alice Wonderland', role: 'customer', status: 'active' }) }
  });

  // 3. Seed Completed Orders
  // Order for Anonymous Guest A
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-GUEST-A`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      orderId: 'ORD-GUEST-A',
      tenantId: tenantA,
      branchId: 'main',
      tableId: 'TBL-1',
      customerId: 'anon_guest_a',
      customerName: 'Guest Diner A',
      status: 'DINING_COMPLETED',
      paymentStatus: 'pending',
      total: 1500,
      subtotal: 1350,
      tax: 150,
      serviceCharge: 0,
      discount: 0,
      items: [{ itemId: 'item-1', name: 'Pasta', count: 1, pricePerUnit: 1350 }]
    }) }
  });

  // Order for Anonymous Guest B
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-GUEST-B`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      orderId: 'ORD-GUEST-B',
      tenantId: tenantA,
      branchId: 'main',
      tableId: 'TBL-2',
      customerId: 'anon_guest_b',
      customerName: 'Guest Diner B',
      status: 'DINING_COMPLETED',
      paymentStatus: 'pending',
      total: 2500,
      subtotal: 2250,
      tax: 250,
      serviceCharge: 0,
      discount: 0,
      items: [{ itemId: 'item-2', name: 'Pizza', count: 1, pricePerUnit: 2250 }]
    }) }
  });

  // Order for Registered Customer Alice
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-ALICE-1`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      orderId: 'ORD-ALICE-1',
      tenantId: tenantA,
      branchId: 'main',
      tableId: 'TBL-3',
      customerId: 'customer_alice',
      customerName: 'Alice Wonderland',
      status: 'DINING_COMPLETED',
      paymentStatus: 'pending',
      total: 5000,
      subtotal: 4500,
      tax: 500,
      serviceCharge: 0,
      discount: 0,
      items: [{ itemId: 'item-3', name: 'Curry', count: 2, pricePerUnit: 2250 }]
    }) }
  });

  // 4. Seed Canonical Bills
  // Bill for Anonymous Guest A
  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-GUEST-A',
      orderId: 'ORD-GUEST-A',
      tenantId: tenantA,
      branchId: 'main',
      customerId: 'anon_guest_a',
      customerName: 'Guest Diner A',
      total: 1500,
      subtotal: 1350,
      tax: 150,
      serviceCharge: 0,
      discount: 0,
      paymentStatus: 'pending',
      items: [{ itemId: 'item-1', name: 'Pasta', count: 1, pricePerUnit: 1350 }]
    }) }
  });

  // Bill for Anonymous Guest B
  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-B`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-GUEST-B',
      orderId: 'ORD-GUEST-B',
      tenantId: tenantA,
      branchId: 'main',
      customerId: 'anon_guest_b',
      customerName: 'Guest Diner B',
      total: 2500,
      subtotal: 2250,
      tax: 250,
      serviceCharge: 0,
      discount: 0,
      paymentStatus: 'pending',
      items: [{ itemId: 'item-2', name: 'Pizza', count: 1, pricePerUnit: 2250 }]
    }) }
  });

  // Bill for Registered Customer Alice
  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-ALICE-1',
      orderId: 'ORD-ALICE-1',
      tenantId: tenantA,
      branchId: 'main',
      customerId: 'customer_alice',
      customerName: 'Alice Wonderland',
      total: 5000,
      subtotal: 4500,
      tax: 500,
      serviceCharge: 0,
      discount: 0,
      paymentStatus: 'pending',
      items: [{ itemId: 'item-3', name: 'Curry', count: 2, pricePerUnit: 2250 }]
    }) }
  });

  // Bill for Tenant B Bob
  await firestoreRequest({
    path: `restaurants/${tenantB}/bills/BILL-ORD-TENANT-B`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-TENANT-B',
      orderId: 'ORD-TENANT-B',
      tenantId: tenantB,
      branchId: 'main',
      customerId: 'customer_bob',
      customerName: 'Bob B',
      total: 3000,
      subtotal: 2700,
      tax: 300,
      serviceCharge: 0,
      discount: 0,
      paymentStatus: 'pending',
      items: [{ itemId: 'item-b', name: 'Steak', count: 1, pricePerUnit: 2700 }]
    }) }
  });

  console.log('Fixtures initialized.\n');

  // ================================================================
  // GROUP 1: CANONICAL BILL READ & OWNERSHIP SECURITY
  // ================================================================
  console.log('--- TEST GROUP 1: CANONICAL BILL READ & GUEST IDENTITY ISOLATION ---');

  // Test 1: Anonymous Guest A CAN fetch their own canonical bill
  const guestAFetchOwn = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'GET',
    tokenPayload: { sub: 'anon_guest_a' }
  });
  recordResult({
    testName: '1. Anonymous Guest A CAN fetch their own canonical bill',
    identity: 'Guest A (auth.uid = anon_guest_a)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'GET',
    expected: '200 OK',
    actual: guestAFetchOwn.statusCode === 200 ? '200 OK' : `${guestAFetchOwn.statusCode} REJECTED`,
    pass: guestAFetchOwn.statusCode === 200
  });

  // Test 2: Anonymous Guest B CANNOT fetch Guest A canonical bill (Known ID attack blocked!)
  const guestBFetchGuestA = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'GET',
    tokenPayload: { sub: 'anon_guest_b' }
  });
  recordResult({
    testName: '2. Anonymous Guest B CANNOT fetch Guest A canonical bill (Bill ID Known)',
    identity: 'Guest B (auth.uid = anon_guest_b)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'GET',
    expected: '403 Forbidden',
    actual: guestBFetchGuestA.statusCode === 403 ? '403 Forbidden' : `${guestBFetchGuestA.statusCode} ALLOWED`,
    pass: guestBFetchGuestA.statusCode === 403
  });

  // Test 3: Unauthenticated visitor CANNOT fetch Guest A canonical bill
  const unauthFetchGuestA = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'GET',
    tokenPayload: null
  });
  recordResult({
    testName: '3. Unauthenticated visitor CANNOT fetch Guest A canonical bill',
    identity: 'Unauthenticated (request.auth = null)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'GET',
    expected: '403 Forbidden',
    actual: unauthFetchGuestA.statusCode === 403 ? '403 Forbidden' : `${unauthFetchGuestA.statusCode} ALLOWED`,
    pass: unauthFetchGuestA.statusCode === 403
  });

  // Test 4: Anonymous Guest A CANNOT fetch registered Customer Alice bill
  const guestAFetchAlice = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'GET',
    tokenPayload: { sub: 'anon_guest_a' }
  });
  recordResult({
    testName: '4. Anonymous Guest A CANNOT fetch registered Customer Alice bill',
    identity: 'Guest A (auth.uid = anon_guest_a)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    operation: 'GET',
    expected: '403 Forbidden',
    actual: guestAFetchAlice.statusCode === 403 ? '403 Forbidden' : `${guestAFetchAlice.statusCode} ALLOWED`,
    pass: guestAFetchAlice.statusCode === 403
  });

  // Test 5: Registered Customer Alice CAN fetch her own bill
  const aliceFetchOwn = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'GET',
    tokenPayload: { sub: 'customer_alice' }
  });
  recordResult({
    testName: '5. Registered Customer Alice CAN fetch her own bill',
    identity: 'Customer Alice (auth.uid = customer_alice)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    operation: 'GET',
    expected: '200 OK',
    actual: aliceFetchOwn.statusCode === 200 ? '200 OK' : `${aliceFetchOwn.statusCode} REJECTED`,
    pass: aliceFetchOwn.statusCode === 200
  });

  // Test 6: Registered Customer Alice CANNOT fetch Guest A bill
  const aliceFetchGuestA = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'GET',
    tokenPayload: { sub: 'customer_alice' }
  });
  recordResult({
    testName: '6. Registered Customer Alice CANNOT fetch Guest A bill',
    identity: 'Customer Alice (auth.uid = customer_alice)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'GET',
    expected: '403 Forbidden',
    actual: aliceFetchGuestA.statusCode === 403 ? '403 Forbidden' : `${aliceFetchGuestA.statusCode} ALLOWED`,
    pass: aliceFetchGuestA.statusCode === 403
  });

  // Test 7: Anonymous Guest A CANNOT list bills collection (Enumeration prevention)
  const guestAListBills = await firestoreRequest({
    path: `restaurants/${tenantA}/bills`,
    method: 'GET',
    tokenPayload: { sub: 'anon_guest_a' }
  });
  recordResult({
    testName: '7. Anonymous Guest A CANNOT list bills collection (Enumeration Prevented)',
    identity: 'Guest A (auth.uid = anon_guest_a)',
    path: `restaurants/${tenantA}/bills`,
    operation: 'LIST',
    expected: '403 Forbidden',
    actual: guestAListBills.statusCode === 403 ? '403 Forbidden' : `${guestAListBills.statusCode} ALLOWED`,
    pass: guestAListBills.statusCode === 403
  });

  // Test 8: Anonymous Guest B CANNOT list bills collection
  const guestBListBills = await firestoreRequest({
    path: `restaurants/${tenantA}/bills`,
    method: 'GET',
    tokenPayload: { sub: 'anon_guest_b' }
  });
  recordResult({
    testName: '8. Anonymous Guest B CANNOT list bills collection',
    identity: 'Guest B (auth.uid = anon_guest_b)',
    path: `restaurants/${tenantA}/bills`,
    operation: 'LIST',
    expected: '403 Forbidden',
    actual: guestBListBills.statusCode === 403 ? '403 Forbidden' : `${guestBListBills.statusCode} ALLOWED`,
    pass: guestBListBills.statusCode === 403
  });

  // Test 9: Unauthenticated visitor CANNOT list bills collection
  const unauthListBills = await firestoreRequest({
    path: `restaurants/${tenantA}/bills`,
    method: 'GET',
    tokenPayload: null
  });
  recordResult({
    testName: '9. Unauthenticated visitor CANNOT list bills collection',
    identity: 'Unauthenticated',
    path: `restaurants/${tenantA}/bills`,
    operation: 'LIST',
    expected: '403 Forbidden',
    actual: unauthListBills.statusCode === 403 ? '403 Forbidden' : `${unauthListBills.statusCode} ALLOWED`,
    pass: unauthListBills.statusCode === 403
  });

  // Test 10: Authorized staff (Waiter A) CAN fetch Guest A bill
  const waiterFetchGuestA = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'GET',
    tokenPayload: { sub: 'waiter_p10_A' }
  });
  recordResult({
    testName: '10. Authorized staff (Waiter A) CAN fetch Guest A bill',
    identity: 'Waiter A (Tenant A)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'GET',
    expected: '200 OK',
    actual: waiterFetchGuestA.statusCode === 200 ? '200 OK' : `${waiterFetchGuestA.statusCode} REJECTED`,
    pass: waiterFetchGuestA.statusCode === 200
  });

  // Test 11: Authorized staff (Cashier A) CAN fetch Customer Alice bill
  const cashierFetchAlice = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    method: 'GET',
    tokenPayload: { sub: 'cashier_p10_A' }
  });
  recordResult({
    testName: '11. Authorized staff (Cashier A) CAN fetch Customer Alice bill',
    identity: 'Cashier A (Tenant A)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-ALICE-1`,
    operation: 'GET',
    expected: '200 OK',
    actual: cashierFetchAlice.statusCode === 200 ? '200 OK' : `${cashierFetchAlice.statusCode} REJECTED`,
    pass: cashierFetchAlice.statusCode === 200
  });

  // Test 12: Cross-tenant staff (Waiter B of Tenant B) CANNOT fetch Tenant A bill
  const waiterBCrossFetch = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'GET',
    tokenPayload: { sub: 'waiter_p10_B' }
  });
  recordResult({
    testName: '12. Cross-tenant staff (Waiter B of Tenant B) CANNOT fetch Tenant A bill',
    identity: 'Waiter B (Tenant B)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'GET',
    expected: '403 Forbidden',
    actual: waiterBCrossFetch.statusCode === 403 ? '403 Forbidden' : `${waiterBCrossFetch.statusCode} ALLOWED`,
    pass: waiterBCrossFetch.statusCode === 403
  });

  // Test 13: Authorized staff (Waiter A) CAN list Tenant A bills
  const waiterListBills = await firestoreRequest({
    path: `restaurants/${tenantA}/bills`,
    method: 'GET',
    tokenPayload: { sub: 'waiter_p10_A' }
  });
  recordResult({
    testName: '13. Authorized staff (Waiter A) CAN list Tenant A bills',
    identity: 'Waiter A (Tenant A)',
    path: `restaurants/${tenantA}/bills`,
    operation: 'LIST',
    expected: '200 OK',
    actual: waiterListBills.statusCode === 200 ? '200 OK' : `${waiterListBills.statusCode} REJECTED`,
    pass: waiterListBills.statusCode === 200
  });


  // ================================================================
  // GROUP 2: CANONICAL BILL CREATION VERIFICATION
  // ================================================================
  console.log('\n--- TEST GROUP 2: CANONICAL BILL CREATION VERIFICATION ---');

  // Test 14: Anonymous Guest A CAN create canonical bill matching their own authentic order
  const guestACreateOwnBill = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A-NEW`,
    method: 'POST',
    tokenPayload: { sub: 'anon_guest_a' }
  });
  // Note: we test with a newly placed completed order ORD-GUEST-A-2
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-GUEST-A-2`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      orderId: 'ORD-GUEST-A-2',
      tenantId: tenantA,
      customerId: 'anon_guest_a',
      status: 'DINING_COMPLETED',
      paymentStatus: 'pending',
      total: 1000,
      subtotal: 900,
      tax: 100,
      serviceCharge: 0,
      discount: 0,
      items: [{ itemId: 'item-1', name: 'Soup', count: 1, pricePerUnit: 900 }]
    }) }
  });

  const guestACreateBill2 = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A-2`,
    method: 'PATCH',
    tokenPayload: { sub: 'anon_guest_a' },
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-GUEST-A-2',
      orderId: 'ORD-GUEST-A-2',
      tenantId: tenantA,
      customerId: 'anon_guest_a',
      paymentStatus: 'pending',
      total: 1000,
      subtotal: 900,
      tax: 100,
      serviceCharge: 0,
      discount: 0,
      items: [{ itemId: 'item-1', name: 'Soup', count: 1, pricePerUnit: 900 }]
    }) }
  });
  recordResult({
    testName: '14. Anonymous Guest A CAN create canonical bill for their authentic order',
    identity: 'Guest A (auth.uid = anon_guest_a)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A-2`,
    operation: 'CREATE',
    expected: '200 OK',
    actual: guestACreateBill2.statusCode === 200 ? '200 OK' : `${guestACreateBill2.statusCode} REJECTED`,
    pass: guestACreateBill2.statusCode === 200
  });

  // Test 15: Anonymous Guest B CANNOT create bill for Guest A order
  const guestBCreateGuestABill = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A-3`,
    method: 'PATCH',
    tokenPayload: { sub: 'anon_guest_b' },
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-GUEST-A-3',
      orderId: 'ORD-GUEST-A-2',
      tenantId: tenantA,
      customerId: 'anon_guest_b',
      paymentStatus: 'pending',
      total: 1000,
      subtotal: 900,
      tax: 100,
      serviceCharge: 0,
      discount: 0,
      items: [{ itemId: 'item-1', name: 'Soup', count: 1, pricePerUnit: 900 }]
    }) }
  });
  recordResult({
    testName: '15. Anonymous Guest B CANNOT create bill for Guest A order',
    identity: 'Guest B (auth.uid = anon_guest_b)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A-3`,
    operation: 'CREATE',
    expected: '403 Forbidden',
    actual: guestBCreateGuestABill.statusCode === 403 ? '403 Forbidden' : `${guestBCreateGuestABill.statusCode} ALLOWED`,
    pass: guestBCreateGuestABill.statusCode === 403
  });

  // Test 16: Unauthenticated visitor CANNOT create canonical bill
  const unauthCreateBill = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A-4`,
    method: 'PATCH',
    tokenPayload: null,
    body: { fields: toFirestoreFields({
      billId: 'BILL-ORD-GUEST-A-4',
      orderId: 'ORD-GUEST-A-2',
      tenantId: tenantA,
      customerId: 'anon_guest_a',
      paymentStatus: 'pending',
      total: 1000,
      subtotal: 900,
      tax: 100,
      serviceCharge: 0,
      discount: 0,
      items: [{ itemId: 'item-1', name: 'Soup', count: 1, pricePerUnit: 900 }]
    }) }
  });
  recordResult({
    testName: '16. Unauthenticated visitor CANNOT create canonical bill',
    identity: 'Unauthenticated',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A-4`,
    operation: 'CREATE',
    expected: '403 Forbidden',
    actual: unauthCreateBill.statusCode === 403 ? '403 Forbidden' : `${unauthCreateBill.statusCode} ALLOWED`,
    pass: unauthCreateBill.statusCode === 403
  });


  // ================================================================
  // GROUP 3: PAYMENT SETTLEMENT TAMPER RESISTANCE
  // ================================================================
  console.log('\n--- TEST GROUP 3: PAYMENT SETTLEMENT TAMPER RESISTANCE ---');

  // Test 17: Anonymous Guest A CANNOT directly mark their bill as paid
  const guestAMarkPaid = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'PATCH',
    tokenPayload: { sub: 'anon_guest_a' },
    body: { fields: toFirestoreFields({ paymentStatus: 'paid' }) }
  });
  recordResult({
    testName: '17. Anonymous Guest A CANNOT directly mark their bill as paid',
    identity: 'Guest A (auth.uid = anon_guest_a)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'UPDATE (paymentStatus: paid)',
    expected: '403 Forbidden',
    actual: guestAMarkPaid.statusCode === 403 ? '403 Forbidden' : `${guestAMarkPaid.statusCode} ALLOWED`,
    pass: guestAMarkPaid.statusCode === 403
  });

  // Test 18: Anonymous Guest B CANNOT directly mark Guest A bill as paid
  const guestBMarkPaid = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'PATCH',
    tokenPayload: { sub: 'anon_guest_b' },
    body: { fields: toFirestoreFields({ paymentStatus: 'paid' }) }
  });
  recordResult({
    testName: '18. Anonymous Guest B CANNOT directly mark Guest A bill as paid',
    identity: 'Guest B (auth.uid = anon_guest_b)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'UPDATE (paymentStatus: paid)',
    expected: '403 Forbidden',
    actual: guestBMarkPaid.statusCode === 403 ? '403 Forbidden' : `${guestBMarkPaid.statusCode} ALLOWED`,
    pass: guestBMarkPaid.statusCode === 403
  });

  // Test 19: Unauthenticated visitor CANNOT mark bill as paid
  const unauthMarkPaid = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'PATCH',
    tokenPayload: null,
    body: { fields: toFirestoreFields({ paymentStatus: 'paid' }) }
  });
  recordResult({
    testName: '19. Unauthenticated visitor CANNOT mark bill as paid',
    identity: 'Unauthenticated',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'UPDATE (paymentStatus: paid)',
    expected: '403 Forbidden',
    actual: unauthMarkPaid.statusCode === 403 ? '403 Forbidden' : `${unauthMarkPaid.statusCode} ALLOWED`,
    pass: unauthMarkPaid.statusCode === 403
  });

  // Test 20: Authorized Cashier A CAN settle bill payment (financials unchanged)
  const cashierSettleBill = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A?updateMask.fieldPaths=paymentStatus&updateMask.fieldPaths=paymentMethod&updateMask.fieldPaths=paidAt&updateMask.fieldPaths=processedBy&updateMask.fieldPaths=processedByName`,
    method: 'PATCH',
    tokenPayload: { sub: 'cashier_p10_A' },
    body: { fields: toFirestoreFields({
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      paidAt: new Date().toISOString(),
      processedBy: 'cashier_p10_A',
      processedByName: 'Cashier A'
    }) }
  });
  recordResult({
    testName: '20. Authorized Cashier A CAN settle bill payment (financials unchanged)',
    identity: 'Cashier A (Tenant A)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'SETTLE (paymentStatus: paid)',
    expected: '200 OK',
    actual: cashierSettleBill.statusCode === 200 ? '200 OK' : `${cashierSettleBill.statusCode} REJECTED`,
    pass: cashierSettleBill.statusCode === 200
  });

  // Test 21: Once bill is marked paid, NO ONE can modify it (sealed record)
  const modifyPaidBill = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'PATCH',
    tokenPayload: { sub: 'cashier_p10_A' },
    body: { fields: toFirestoreFields({ total: 9999 }) }
  });
  recordResult({
    testName: '21. Once bill is marked PAID, it cannot be modified (sealed financial record)',
    identity: 'Cashier A (Tenant A)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'UPDATE (total: 9999)',
    expected: '403 Forbidden',
    actual: modifyPaidBill.statusCode === 403 ? '403 Forbidden' : `${modifyPaidBill.statusCode} ALLOWED`,
    pass: modifyPaidBill.statusCode === 403
  });

  // Test 22: Canonical bill CANNOT be deleted by guest or staff
  const deleteBillAttempt = await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    method: 'DELETE',
    tokenPayload: { sub: 'waiter_p10_A' }
  });
  recordResult({
    testName: '22. Canonical bill CANNOT be deleted (Permanent legal record)',
    identity: 'Waiter A (Tenant A)',
    path: `restaurants/${tenantA}/bills/BILL-ORD-GUEST-A`,
    operation: 'DELETE',
    expected: '403 Forbidden',
    actual: deleteBillAttempt.statusCode === 403 ? '403 Forbidden' : `${deleteBillAttempt.statusCode} ALLOWED`,
    pass: deleteBillAttempt.statusCode === 403
  });


  // ================================================================
  // GROUP 4: GUEST ORDER & DINING SESSION BINDING
  // ================================================================
  console.log('\n--- TEST GROUP 4: GUEST ORDER & DINING SESSION BINDING ---');

  // Test 23: Anonymous Guest A CAN create order with authentic customerId
  const guestACreateOrder = await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-ANON-NEW-1`,
    method: 'PATCH',
    tokenPayload: { sub: 'anon_guest_a' },
    body: { fields: toFirestoreFields({
      orderId: 'ORD-ANON-NEW-1',
      tenantId: tenantA,
      branchId: 'main',
      tableId: 'TBL-1',
      customerId: 'anon_guest_a',
      customerName: 'Guest Diner A',
      status: 'NEW',
      paymentStatus: 'pending',
      total: 800,
      subtotal: 750,
      tax: 50,
      serviceCharge: 0,
      discount: 0,
      items: [{ itemId: 'item-4', name: 'Garlic Bread', count: 1, pricePerUnit: 750 }]
    }) }
  });
  recordResult({
    testName: '23. Anonymous Guest A CAN create order bound to their authentic UID',
    identity: 'Guest A (auth.uid = anon_guest_a)',
    path: `restaurants/${tenantA}/orders/ORD-ANON-NEW-1`,
    operation: 'CREATE',
    expected: '200 OK',
    actual: guestACreateOrder.statusCode === 200 ? '200 OK' : `${guestACreateOrder.statusCode} REJECTED`,
    pass: guestACreateOrder.statusCode === 200
  });

  // Test 24: Anonymous Guest B CANNOT create order pretending to be Guest A
  const guestBSpoofOrder = await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-SPOOF-1`,
    method: 'PATCH',
    tokenPayload: { sub: 'anon_guest_b' },
    body: { fields: toFirestoreFields({
      orderId: 'ORD-SPOOF-1',
      tenantId: tenantA,
      branchId: 'main',
      tableId: 'TBL-1',
      customerId: 'anon_guest_a', // Spoofed!
      customerName: 'Imposter',
      status: 'NEW',
      paymentStatus: 'pending',
      total: 800,
      items: []
    }) }
  });
  recordResult({
    testName: '24. Anonymous Guest B CANNOT create order spoofing Guest A customerId',
    identity: 'Guest B (auth.uid = anon_guest_b)',
    path: `restaurants/${tenantA}/orders/ORD-SPOOF-1`,
    operation: 'CREATE (spoofed customerId)',
    expected: '403 Forbidden',
    actual: guestBSpoofOrder.statusCode === 403 ? '403 Forbidden' : `${guestBSpoofOrder.statusCode} ALLOWED`,
    pass: guestBSpoofOrder.statusCode === 403
  });

  // Test 25: Anonymous Guest A CAN create dining session with pending status
  const guestACreateSession = await firestoreRequest({
    path: `restaurants/${tenantA}/diningSessions/SES-ANON-1`,
    method: 'PATCH',
    tokenPayload: { sub: 'anon_guest_a' },
    body: { fields: toFirestoreFields({
      sessionId: 'SES-ANON-1',
      tenantId: tenantA,
      restaurantId: tenantA,
      customerId: 'anon_guest_a',
      status: 'active',
      billingStatus: 'pending'
    }) }
  });
  recordResult({
    testName: '25. Anonymous Guest A CAN create dining session bound to authentic UID',
    identity: 'Guest A (auth.uid = anon_guest_a)',
    path: `restaurants/${tenantA}/diningSessions/SES-ANON-1`,
    operation: 'CREATE',
    expected: '200 OK',
    actual: guestACreateSession.statusCode === 200 ? '200 OK' : `${guestACreateSession.statusCode} REJECTED`,
    pass: guestACreateSession.statusCode === 200
  });

  // Test 26: Anonymous Guest A CANNOT mark dining session billingStatus as paid
  const guestAMarkSessionPaid = await firestoreRequest({
    path: `restaurants/${tenantA}/diningSessions/SES-ANON-1`,
    method: 'PATCH',
    tokenPayload: { sub: 'anon_guest_a' },
    body: { fields: toFirestoreFields({ billingStatus: 'paid' }) }
  });
  recordResult({
    testName: '26. Anonymous Guest A CANNOT mark dining session billingStatus as paid',
    identity: 'Guest A (auth.uid = anon_guest_a)',
    path: `restaurants/${tenantA}/diningSessions/SES-ANON-1`,
    operation: 'UPDATE (billingStatus: paid)',
    expected: '403 Forbidden',
    actual: guestAMarkSessionPaid.statusCode === 403 ? '403 Forbidden' : `${guestAMarkSessionPaid.statusCode} ALLOWED`,
    pass: guestAMarkSessionPaid.statusCode === 403
  });

  console.log('\n================================================================');
  console.log(`PHASE 10 TEST RUN SUMMARY:`);
  console.log(`Total Tests Run: ${totalTests}`);
  console.log(`Passed:          ${passedTests}`);
  console.log(`Failed:          ${failedTests}`);
  console.log(`Success Rate:    ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error(`ERROR: ${failedTests} test(s) failed in Phase 10 test suite.`);
    process.exit(1);
  } else {
    console.log('ALL PHASE 10 TESTS PASSED SUCCESSFULLY ON THE REAL FIRESTORE EMULATOR!');
    process.exit(0);
  }
}

runPhase10Tests().catch(err => {
  console.error('Fatal test suite exception:', err);
  process.exit(1);
});
