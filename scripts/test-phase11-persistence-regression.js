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
console.log('SPIRALDINE PHASE 11: GUEST PERSISTENCE & REGRESSION SUITE');
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

async function runPhase11Tests() {
  const tenantA = 'tenant_phase11_A';
  const tenantB = 'tenant_phase11_B';

  const adminToken = { sub: 'super_admin_phase11', role: 'super_admin', super_admin: true };
  const guestTab1Token = { sub: 'guest_tab_1_uid', firebase: { sign_in_provider: 'anonymous' } };
  const guestTab2Token = { sub: 'guest_tab_2_uid', firebase: { sign_in_provider: 'anonymous' } };
  const returningGuestToken = { sub: 'returning_guest_new_uid', firebase: { sign_in_provider: 'anonymous' } };
  const customerAliceToken = { sub: 'customer_alice_p11', email: 'alice@p11.com' };
  const waiterAToken = { sub: 'waiter_p11_A' };
  const cashierAToken = { sub: 'cashier_p11_A' };
  const waiterBToken = { sub: 'waiter_p11_B' };

  console.log('--- SEEDING PHASE 11 EMULATOR FIXTURES ---');

  // 1. Seed Tenants
  await firestoreRequest({
    path: `tenants/${tenantA}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 11 Bistro A', planTier: 'pro' }) }
  });
  await firestoreRequest({
    path: `restaurants/${tenantA}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 11 Bistro A', tenantId: tenantA }) }
  });
  await firestoreRequest({
    path: `tenants/${tenantB}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 11 Bistro B', planTier: 'starter' }) }
  });
  await firestoreRequest({
    path: `restaurants/${tenantB}`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ name: 'Phase 11 Bistro B', tenantId: tenantB }) }
  });

  // 2. Seed Users
  await firestoreRequest({
    path: 'users/waiter_p11_A',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ tenantId: tenantA, role: 'waiter', branchId: 'main', status: 'active' }) }
  });
  await firestoreRequest({
    path: 'users/cashier_p11_A',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ tenantId: tenantA, role: 'cashier', branchId: 'main', status: 'active' }) }
  });
  await firestoreRequest({
    path: 'users/waiter_p11_B',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ tenantId: tenantB, role: 'waiter', branchId: 'main', status: 'active' }) }
  });
  await firestoreRequest({
    path: 'customers/customer_alice_p11',
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({ fullName: 'Alice P11', role: 'customer', status: 'active' }) }
  });

  // 3. Seed Tab 1 Order & Canonical Bill
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-TAB1-ROUND1`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ORD-TAB1-ROUND1',
      orderId: 'ORD-TAB1-ROUND1',
      tenantId: tenantA,
      customerId: 'guest_tab_1_uid',
      status: 'PLACED',
      paymentStatus: 'pending',
      total: 500,
      totalAmount: 500
    }) }
  });

  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ORD-TAB1-ROUND1',
      billId: 'ORD-TAB1-ROUND1',
      tenantId: tenantA,
      orderId: 'ORD-TAB1-ROUND1',
      customerId: 'guest_tab_1_uid',
      branchId: 'main',
      total: 500,
      paymentStatus: 'pending',
      ordersCount: 1
    }) }
  });

  // 4. Seed Pre-Phase 10 Legacy Records
  // Legacy Order 1: customerId is empty string
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-LEGACY-EMPTY-CUST`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ORD-LEGACY-EMPTY-CUST',
      orderId: 'ORD-LEGACY-EMPTY-CUST',
      tenantId: tenantA,
      customerId: '',
      status: 'PLACED',
      paymentStatus: 'pending',
      total: 350
    }) }
  });

  // Legacy Order 2: customerId is 'guest-uid'
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-LEGACY-GUEST-UID`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ORD-LEGACY-GUEST-UID',
      orderId: 'ORD-LEGACY-GUEST-UID',
      tenantId: tenantA,
      customerId: 'guest-uid',
      status: 'PLACED',
      paymentStatus: 'pending',
      total: 420
    }) }
  });

  // Legacy Canonical Bill: customerId is 'guest-uid'
  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-LEGACY-GUEST`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'BILL-LEGACY-GUEST',
      billId: 'BILL-LEGACY-GUEST',
      tenantId: tenantA,
      orderId: 'ORD-LEGACY-GUEST-UID',
      customerId: 'guest-uid',
      branchId: 'main',
      total: 420,
      paymentStatus: 'pending'
    }) }
  });

  // Legacy Dining Session without customerId
  await firestoreRequest({
    path: `restaurants/${tenantA}/diningSessions/SES-LEGACY-NO-CUST`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      sessionId: 'SES-LEGACY-NO-CUST',
      tenantId: tenantA,
      tableId: 'TBL-1',
      status: 'active',
      billingStatus: 'pending'
    }) }
  });

  // Registered Customer Alice Existing Prior Order & Bill
  await firestoreRequest({
    path: `restaurants/${tenantA}/orders/ORD-ALICE-PRIOR`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'ORD-ALICE-PRIOR',
      orderId: 'ORD-ALICE-PRIOR',
      tenantId: tenantA,
      customerId: 'customer_alice_p11',
      status: 'SERVED',
      paymentStatus: 'pending',
      total: 800
    }) }
  });

  await firestoreRequest({
    path: `restaurants/${tenantA}/bills/BILL-ALICE-PRIOR`,
    method: 'PATCH',
    tokenPayload: adminToken,
    body: { fields: toFirestoreFields({
      id: 'BILL-ALICE-PRIOR',
      billId: 'BILL-ALICE-PRIOR',
      tenantId: tenantA,
      orderId: 'ORD-ALICE-PRIOR',
      customerId: 'customer_alice_p11',
      branchId: 'main',
      total: 800,
      paymentStatus: 'pending'
    }) }
  });

  console.log('Fixtures initialized.\n');

  // ========================================================================
  // TEST GROUP 1: MULTI-TAB ISOLATION AND IDENTITY INTEGRITY
  // ========================================================================
  console.log('--- TEST GROUP 1: MULTI-TAB ISOLATION AND IDENTITY INTEGRITY ---');

  // 1.1 Same Tab (Tab 1) guest can fetch their own bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      method: 'GET',
      tokenPayload: guestTab1Token
    });
    recordResult({
      testName: '1. Tab 1 Guest CAN fetch their own canonical bill (Same-Tab Persistence)',
      identity: 'Tab 1 Guest (auth.uid = guest_tab_1_uid)',
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      operation: 'GET',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 1.2 New Tab (Tab 2) guest CANNOT fetch Tab 1 guest's bill even with known Bill ID
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      method: 'GET',
      tokenPayload: guestTab2Token
    });
    recordResult({
      testName: '2. Tab 2 Guest CANNOT fetch Tab 1 Guest bill (Cross-Tab Isolation / No Impersonation)',
      identity: 'Tab 2 Guest (auth.uid = guest_tab_2_uid)',
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      operation: 'GET',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // 1.3 Returning Guest (New Session UID) CANNOT fetch previous guest session bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      method: 'GET',
      tokenPayload: returningGuestToken
    });
    recordResult({
      testName: '3. Returning Guest with new UID CANNOT claim previous session bill (No silent re-assignment)',
      identity: 'Returning Guest (auth.uid = returning_guest_new_uid)',
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      operation: 'GET',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // 1.4 Cleared Browser Storage (Unauthenticated) CANNOT fetch bill using bill ID
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      method: 'GET',
      tokenPayload: null
    });
    recordResult({
      testName: '4. Cleared Storage Visitor (Unauthenticated) CANNOT access bill via Bill ID',
      identity: 'Unauthenticated Visitor',
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      operation: 'GET',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // ========================================================================
  // TEST GROUP 2: MULTI-ROUND DINING SESSION CONTINUITY
  // ========================================================================
  console.log('\n--- TEST GROUP 2: MULTI-ROUND DINING SESSION CONTINUITY ---');

  // 2.1 Tab 1 Guest can submit supplementary order (Round 2) under same UID
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/ORD-TAB1-ROUND2`,
      method: 'PATCH',
      tokenPayload: guestTab1Token,
      body: { fields: toFirestoreFields({
        id: 'ORD-TAB1-ROUND2',
        orderId: 'ORD-TAB1-ROUND2',
        tenantId: tenantA,
        customerId: 'guest_tab_1_uid',
        primaryOrderId: 'ORD-TAB1-ROUND1',
        status: 'NEW',
        paymentStatus: 'pending',
        total: 250,
        totalAmount: 250
      }) }
    });
    recordResult({
      testName: '5. Tab 1 Guest CAN submit Round 2 supplementary order under same UID',
      identity: 'Tab 1 Guest (auth.uid = guest_tab_1_uid)',
      path: `restaurants/${tenantA}/orders/ORD-TAB1-ROUND2`,
      operation: 'CREATE',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 2.2 Tab 1 Guest CANNOT spoof Tab 2's UID on Round 2 order
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/ORD-TAB1-SPOOF`,
      method: 'PATCH',
      tokenPayload: guestTab1Token,
      body: { fields: toFirestoreFields({
        id: 'ORD-TAB1-SPOOF',
        orderId: 'ORD-TAB1-SPOOF',
        tenantId: tenantA,
        customerId: 'guest_tab_2_uid', // Spoofed UID!
        status: 'NEW',
        paymentStatus: 'pending',
        total: 100
      }) }
    });
    recordResult({
      testName: '6. Guest CANNOT spoof another guest UID when submitting order',
      identity: 'Tab 1 Guest spoofing Tab 2 UID',
      path: `restaurants/${tenantA}/orders/ORD-TAB1-SPOOF`,
      operation: 'CREATE (spoofed customerId)',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // 2.3 Guest CANNOT change tenantId to escape restaurant boundary
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/orders/ORD-ESCAPED-TENANT`,
      method: 'PATCH',
      tokenPayload: guestTab1Token,
      body: { fields: toFirestoreFields({
        id: 'ORD-ESCAPED-TENANT',
        orderId: 'ORD-ESCAPED-TENANT',
        tenantId: tenantB, // Wrong tenant in payload!
        customerId: 'guest_tab_1_uid',
        status: 'NEW',
        paymentStatus: 'pending',
        total: 150
      }) }
    });
    recordResult({
      testName: '7. Guest CANNOT specify mismatched tenantId in order payload',
      identity: 'Tab 1 Guest',
      path: `restaurants/${tenantA}/orders/ORD-ESCAPED-TENANT`,
      operation: 'CREATE (mismatched tenantId)',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // ========================================================================
  // TEST GROUP 3: LEGACY RECORD COMPATIBILITY & SECURITY ENFORCEMENT
  // ========================================================================
  console.log('\n--- TEST GROUP 3: LEGACY RECORD COMPATIBILITY & SECURITY ENFORCEMENT ---');

  // 3.1 Unauthenticated/arbitrary guest CANNOT access legacy bill with customerId: 'guest-uid'
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/BILL-LEGACY-GUEST`,
      method: 'GET',
      tokenPayload: guestTab1Token
    });
    recordResult({
      testName: '8. Anonymous Guest CANNOT read legacy bill with customerId="guest-uid" (No legacy loophole)',
      identity: 'Guest Tab 1 (auth.uid = guest_tab_1_uid)',
      path: `restaurants/${tenantA}/bills/BILL-LEGACY-GUEST`,
      operation: 'GET',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // 3.2 Authorized staff CAN access and audit legacy bill with customerId: 'guest-uid'
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/BILL-LEGACY-GUEST`,
      method: 'GET',
      tokenPayload: cashierAToken
    });
    recordResult({
      testName: '9. Authorized Cashier A CAN access legacy bill with customerId="guest-uid" for audit/settlement',
      identity: 'Cashier A (Tenant A)',
      path: `restaurants/${tenantA}/bills/BILL-LEGACY-GUEST`,
      operation: 'GET',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 3.3 Cashier CAN settle legacy bill (paymentStatus -> paid) without financials change
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/BILL-LEGACY-GUEST`,
      method: 'PATCH',
      tokenPayload: cashierAToken,
      body: { fields: toFirestoreFields({
        id: 'BILL-LEGACY-GUEST',
        billId: 'BILL-LEGACY-GUEST',
        tenantId: tenantA,
        orderId: 'ORD-LEGACY-GUEST-UID',
        customerId: 'guest-uid',
        branchId: 'main',
        total: 420,
        paymentStatus: 'paid'
      }) }
    });
    recordResult({
      testName: '10. Authorized Cashier A CAN settle legacy bill payment status',
      identity: 'Cashier A (Tenant A)',
      path: `restaurants/${tenantA}/bills/BILL-LEGACY-GUEST`,
      operation: 'SETTLE (paymentStatus: paid)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 3.4 Anonymous Guest CANNOT mark legacy bill as paid
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/BILL-LEGACY-GUEST`,
      method: 'PATCH',
      tokenPayload: guestTab1Token,
      body: { fields: toFirestoreFields({
        paymentStatus: 'paid'
      }) }
    });
    recordResult({
      testName: '11. Anonymous Guest CANNOT mark legacy bill as paid',
      identity: 'Guest Tab 1',
      path: `restaurants/${tenantA}/bills/BILL-LEGACY-GUEST`,
      operation: 'UPDATE (paymentStatus: paid)',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // 3.5 Registered Customer Alice CAN access her legacy pre-Phase 10 bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/BILL-ALICE-PRIOR`,
      method: 'GET',
      tokenPayload: customerAliceToken
    });
    recordResult({
      testName: '12. Registered Customer Alice CAN access her existing pre-Phase 10 bill',
      identity: 'Customer Alice (auth.uid = customer_alice_p11)',
      path: `restaurants/${tenantA}/bills/BILL-ALICE-PRIOR`,
      operation: 'GET',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 3.6 Anonymous Guest CANNOT access Alice's legacy bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/BILL-ALICE-PRIOR`,
      method: 'GET',
      tokenPayload: guestTab1Token
    });
    recordResult({
      testName: '13. Anonymous Guest CANNOT access Alice legacy bill',
      identity: 'Guest Tab 1',
      path: `restaurants/${tenantA}/bills/BILL-ALICE-PRIOR`,
      operation: 'GET',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // ========================================================================
  // TEST GROUP 4: AUTHENTICATED CUSTOMER INTEGRITY & ISOLATION
  // ========================================================================
  console.log('\n--- TEST GROUP 4: AUTHENTICATED CUSTOMER INTEGRITY & ISOLATION ---');

  // 4.1 Alice CANNOT access Tab 1 Guest's bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      method: 'GET',
      tokenPayload: customerAliceToken
    });
    recordResult({
      testName: '14. Registered Customer Alice CANNOT access Tab 1 Guest bill',
      identity: 'Customer Alice (auth.uid = customer_alice_p11)',
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      operation: 'GET',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // 4.2 Alice CAN access her own customer profile at customers/{customer_alice_p11}
  {
    const res = await firestoreRequest({
      path: 'customers/customer_alice_p11',
      method: 'GET',
      tokenPayload: customerAliceToken
    });
    recordResult({
      testName: '15. Registered Customer Alice CAN access her own customer profile',
      identity: 'Customer Alice',
      path: 'customers/customer_alice_p11',
      operation: 'GET',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 4.3 Anonymous Guest CANNOT access Alice's customer profile
  {
    const res = await firestoreRequest({
      path: 'customers/customer_alice_p11',
      method: 'GET',
      tokenPayload: guestTab1Token
    });
    recordResult({
      testName: '16. Anonymous Guest CANNOT access Alice customer profile',
      identity: 'Guest Tab 1',
      path: 'customers/customer_alice_p11',
      operation: 'GET',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // ========================================================================
  // TEST GROUP 5: PAYMENT SETTLEMENT BOUNDARY REGRESSION
  // ========================================================================
  console.log('\n--- TEST GROUP 5: PAYMENT SETTLEMENT BOUNDARY REGRESSION ---');

  // 5.1 Tab 1 Guest CANNOT mark Tab 1 Bill as paid
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      method: 'PATCH',
      tokenPayload: guestTab1Token,
      body: { fields: toFirestoreFields({
        paymentStatus: 'paid'
      }) }
    });
    recordResult({
      testName: '17. Tab 1 Guest CANNOT mark own bill as paid (Direct client tamper prevented)',
      identity: 'Guest Tab 1',
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      operation: 'UPDATE (paymentStatus: paid)',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // 5.2 Cross-Tenant Waiter B CANNOT fetch or settle Tenant A bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      method: 'GET',
      tokenPayload: waiterBToken
    });
    recordResult({
      testName: '18. Cross-Tenant Waiter B CANNOT access Tenant A bill',
      identity: 'Waiter B (Tenant B)',
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      operation: 'GET',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  // 5.3 Authorized Cashier A CAN settle Tab 1 bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      method: 'PATCH',
      tokenPayload: cashierAToken,
      body: { fields: toFirestoreFields({
        id: 'ORD-TAB1-ROUND1',
        billId: 'ORD-TAB1-ROUND1',
        tenantId: tenantA,
        orderId: 'ORD-TAB1-ROUND1',
        customerId: 'guest_tab_1_uid',
        branchId: 'main',
        total: 500,
        paymentStatus: 'paid',
        ordersCount: 1
      }) }
    });
    recordResult({
      testName: '19. Authorized Cashier A CAN settle Tab 1 bill (paymentStatus: paid)',
      identity: 'Cashier A (Tenant A)',
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      operation: 'SETTLE (paymentStatus: paid)',
      expected: '200 OK',
      actual: `${res.statusCode} ${res.statusCode === 200 ? 'OK' : 'Error'}`,
      pass: res.statusCode === 200
    });
  }

  // 5.4 Once PAID, neither Cashier nor Guest can modify the bill
  {
    const res = await firestoreRequest({
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      method: 'PATCH',
      tokenPayload: cashierAToken,
      body: { fields: toFirestoreFields({
        total: 1000 // Attempt to modify sealed financial record
      }) }
    });
    recordResult({
      testName: '20. Once settled/paid, canonical bill is sealed and CANNOT be modified',
      identity: 'Cashier A (Tenant A)',
      path: `restaurants/${tenantA}/bills/ORD-TAB1-ROUND1`,
      operation: 'UPDATE (total: 1000 on paid bill)',
      expected: '403 Forbidden',
      actual: `${res.statusCode} ${res.statusCode === 403 ? 'Forbidden' : 'Unexpected'}`,
      pass: res.statusCode === 403
    });
  }

  console.log('\n================================================================');
  console.log('PHASE 11 TEST RUN SUMMARY:');
  console.log(`Total Tests Run: ${totalTests}`);
  console.log(`Passed:          ${passedTests}`);
  console.log(`Failed:          ${failedTests}`);
  console.log(`Success Rate:    ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    console.error(`ERROR: ${failedTests} test(s) failed in Phase 11 test suite.`);
    process.exit(1);
  } else {
    console.log('ALL PHASE 11 TESTS PASSED SUCCESSFULLY ON THE REAL FIRESTORE EMULATOR!');
    process.exit(0);
  }
}

runPhase11Tests().catch(err => {
  console.error('Unhandled test execution error:', err);
  process.exit(1);
});
