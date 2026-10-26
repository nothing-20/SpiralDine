/**
 * Automated Firestore Rules Test Suite against Firebase Local Emulator
 * Tests all 10 security audit requirements:
 * 1. Unauthenticated user cannot read an order.
 * 2. Customer A can read Customer A's order.
 * 3. Customer A cannot read Customer B's order.
 * 4. Customer A cannot query all orders in a restaurant.
 * 5. Authorized tenant staff can access orders according to their role.
 * 6. Staff from Tenant A cannot read Tenant B's private orders.
 * 7. Unauthenticated user cannot read kitchen tickets.
 * 8. Authorized kitchen staff can read tickets for their own tenant.
 * 9. Unauthorized users cannot read customer profile data.
 * 10. Existing legitimate operational permissions remain functional.
 */

import http from 'http';

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8088';
const [HOST, PORT] = EMULATOR_HOST.split(':');
const PROJECT_ID = 'spiral-restaurant-saas-v1';
const BASE_PATH = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function makeRequest(method, path, authHeader, body = null) {
  return new Promise((resolve, reject) => {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const req = http.request({
      hostname: HOST,
      port: Number(PORT),
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({
          status: res.statusCode,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function makeAuthHeader(uid) {
  if (!uid) return null;
  // Firebase Emulator (Firebear) requires a standard 3-part dot-separated JWT:
  // Base64URL(header).Base64URL(payload).signature
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    user_id: uid,
    sub: uid,
    aud: PROJECT_ID,
    email: `${uid}@example.com`,
    auth_time: Math.floor(Date.now() / 1000),
    iss: `https://securetoken.google.com/${PROJECT_ID}`
  })).toString('base64url');
  return `Bearer ${header}.${payload}.`;
}

// Admin write to seed emulator data directly via emulator admin endpoint
async function seedDoc(docPath, fields) {
  const adminHeader = 'Bearer owner';
  const url = `${BASE_PATH}/${docPath}`;
  const res = await makeRequest('PATCH', url, adminHeader, { fields });
  if (res.status >= 300) {
    throw new Error(`Failed to seed ${docPath}: ${res.status} ${res.raw}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log(`Starting Firestore Rules Verification against Emulator (${EMULATOR_HOST})`);
  console.log('====================================================\n');

  // Step 1: Seed Test Fixtures (via Admin bypass)
  console.log('[Setup] Seeding test database fixtures in emulator...');
  
  // Seed Users (Staff profiles in /users)
  await seedDoc('users/staff_tenant_a', {
    uid: { stringValue: 'staff_tenant_a' },
    tenantId: { stringValue: 'tenant_a' },
    role: { stringValue: 'kitchen' },
    email: { stringValue: 'kitchen@tenanta.com' }
  });

  await seedDoc('users/staff_tenant_b', {
    uid: { stringValue: 'staff_tenant_b' },
    tenantId: { stringValue: 'tenant_b' },
    role: { stringValue: 'kitchen' },
    email: { stringValue: 'kitchen@tenantb.com' }
  });

  // Seed Customers (/customers)
  await seedDoc('customers/cust_a', {
    uid: { stringValue: 'cust_a' },
    displayName: { stringValue: 'Alice Diner' },
    email: { stringValue: 'alice@example.com' }
  });

  await seedDoc('customers/cust_b', {
    uid: { stringValue: 'cust_b' },
    displayName: { stringValue: 'Bob Diner' },
    email: { stringValue: 'bob@example.com' }
  });

  // Seed Tenant A Orders
  await seedDoc('restaurants/tenant_a/orders/ord_alice', {
    orderId: { stringValue: 'ord_alice' },
    tenantId: { stringValue: 'tenant_a' },
    customerId: { stringValue: 'cust_a' },
    status: { stringValue: 'NEW' },
    total: { integerValue: '500' }
  });

  await seedDoc('restaurants/tenant_a/orders/ord_bob', {
    orderId: { stringValue: 'ord_bob' },
    tenantId: { stringValue: 'tenant_a' },
    customerId: { stringValue: 'cust_b' },
    status: { stringValue: 'NEW' },
    total: { integerValue: '350' }
  });

  // Seed Tenant B Orders
  await seedDoc('restaurants/tenant_b/orders/ord_tenant_b', {
    orderId: { stringValue: 'ord_tenant_b' },
    tenantId: { stringValue: 'tenant_b' },
    customerId: { stringValue: 'cust_b' },
    status: { stringValue: 'NEW' },
    total: { integerValue: '750' }
  });

  // Seed Kitchen Tickets
  await seedDoc('restaurants/tenant_a/kitchenTickets/kot_tenant_a', {
    id: { stringValue: 'kot_tenant_a' },
    orderId: { stringValue: 'ord_alice' },
    tenantId: { stringValue: 'tenant_a' },
    status: { stringValue: 'NEW' }
  });

  await seedDoc('restaurants/tenant_b/kitchenTickets/kot_tenant_b', {
    id: { stringValue: 'kot_tenant_b' },
    orderId: { stringValue: 'ord_tenant_b' },
    tenantId: { stringValue: 'tenant_b' },
    status: { stringValue: 'NEW' }
  });

  // Seed Anonymous Guest Order
  await seedDoc('restaurants/tenant_a/orders/ord_guest_1', {
    orderId: { stringValue: 'ord_guest_1' },
    tenantId: { stringValue: 'tenant_a' },
    customerId: { stringValue: 'guest_uid_1' },
    status: { stringValue: 'NEW' },
    total: { integerValue: '420' }
  });

  console.log('[Setup] Test fixtures successfully seeded.\n');

  const results = [];

  function record(id, title, passed, detail) {
    results.push({ id, title, passed, detail });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [Test ${id}] ${title}: ${detail}`);
  }

  // Test 1: Unauthenticated user cannot read an order
  {
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/orders/ord_alice`, null);
    const passed = (res.status === 403);
    record(1, 'Unauthenticated user cannot read an order', passed, `HTTP status ${res.status} (expected 403 Forbidden)`);
  }

  // Test 2: Customer A can read Customer A's order
  {
    const auth = makeAuthHeader('cust_a');
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/orders/ord_alice`, auth);
    const passed = (res.status === 200 && res.data?.fields?.customerId?.stringValue === 'cust_a');
    record(2, "Customer A can read Customer A's order", passed, `HTTP status ${res.status} (expected 200 OK)`);
  }

  // Test 3: Customer A cannot read Customer B's order
  {
    const auth = makeAuthHeader('cust_a');
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/orders/ord_bob`, auth);
    const passed = (res.status === 403);
    record(3, "Customer A cannot read Customer B's order", passed, `HTTP status ${res.status} (expected 403 Forbidden)`);
  }

  // Test 4: Customer A cannot query all orders in a restaurant
  {
    const auth = makeAuthHeader('cust_a');
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/orders`, auth);
    const passed = (res.status === 403);
    record(4, 'Customer A cannot query all orders in a restaurant', passed, `HTTP status ${res.status} (expected 403 Forbidden)`);
  }

  // Test 5: Authorized tenant staff can access orders according to their role
  {
    const auth = makeAuthHeader('staff_tenant_a');
    const resAlice = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/orders/ord_alice`, auth);
    const resBob = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/orders/ord_bob`, auth);
    const passed = (resAlice.status === 200 && resBob.status === 200);
    record(5, 'Authorized tenant staff can access orders within their tenant', passed, `Alice: HTTP ${resAlice.status}, Bob: HTTP ${resBob.status} (expected 200 OK)`);
  }

  // Test 6: Staff from Tenant A cannot read Tenant B's private orders
  {
    const auth = makeAuthHeader('staff_tenant_a');
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_b/orders/ord_tenant_b`, auth);
    const passed = (res.status === 403);
    record(6, "Staff from Tenant A cannot read Tenant B's orders", passed, `HTTP status ${res.status} (expected 403 Forbidden)`);
  }

  // Test 7: Unauthenticated user cannot read kitchen tickets
  {
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/kitchenTickets/kot_tenant_a`, null);
    const passed = (res.status === 403);
    record(7, 'Unauthenticated user cannot read kitchen tickets', passed, `HTTP status ${res.status} (expected 403 Forbidden)`);
  }

  // Test 8: Authorized kitchen staff can read tickets for their own tenant
  {
    const authStaffA = makeAuthHeader('staff_tenant_a');
    const resOwn = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/kitchenTickets/kot_tenant_a`, authStaffA);
    const resOther = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_b/kitchenTickets/kot_tenant_b`, authStaffA);
    const passed = (resOwn.status === 200 && resOther.status === 403);
    record(8, 'Kitchen staff can read own tenant tickets, blocked from other tenants', passed, `Own: HTTP ${resOwn.status} (200), Other: HTTP ${resOther.status} (403)`);
  }

  // Test 9: Unauthorized users cannot read customer profile data
  {
    const authCustA = makeAuthHeader('cust_a');
    const resOwnProfile = await makeRequest('GET', `${BASE_PATH}/customers/cust_a`, authCustA);
    const resOtherProfile = await makeRequest('GET', `${BASE_PATH}/customers/cust_b`, authCustA);
    const passed = (resOwnProfile.status === 200 && resOtherProfile.status === 403);
    record(9, 'Customer can read own profile but is blocked from reading other profiles', passed, `Own: HTTP ${resOwnProfile.status} (200), Other: HTTP ${resOtherProfile.status} (403)`);
  }

  // Test 10: Authorized existing operational permissions remain functional
  {
    await seedDoc('restaurants/tenant_a/tables/tbl_1', {
      id: { stringValue: 'tbl_1' },
      name: { stringValue: 'Table 1' },
      status: { stringValue: 'Available' }
    });
    await seedDoc('restaurants/tenant_a/inventory/ing_1', {
      id: { stringValue: 'ing_1' },
      name: { stringValue: 'Tomato' },
      quantity: { integerValue: '50' }
    });

    const resPublicTable = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/tables/tbl_1`, null);
    const authStaffA = makeAuthHeader('staff_tenant_a');
    const resStaffInventory = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/inventory/ing_1`, authStaffA);
    const passed = (resPublicTable.status === 200 && resStaffInventory.status === 200);
    record(10, 'Authorized existing operational permissions remain functional', passed, `Table: HTTP ${resPublicTable.status} (200), Staff Inventory: HTTP ${resStaffInventory.status} (200)`);
  }

  // Test 11: Customer cannot read kitchen tickets
  {
    const authCustA = makeAuthHeader('cust_a');
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/kitchenTickets/kot_tenant_a`, authCustA);
    const passed = (res.status === 403);
    record(11, 'Customer cannot read kitchen tickets', passed, `HTTP status ${res.status} (expected 403 Forbidden)`);
  }

  // Test 12: Anonymous guest diner can read their own placed order
  {
    const authGuest1 = makeAuthHeader('guest_uid_1');
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/orders/ord_guest_1`, authGuest1);
    const passed = (res.status === 200 && res.data?.fields?.customerId?.stringValue === 'guest_uid_1');
    record(12, 'Anonymous guest diner can read their own placed order', passed, `HTTP status ${res.status} (expected 200 OK)`);
  }

  // Test 13: Anonymous guest diner cannot read another guest's or customer's order
  {
    const authGuest2 = makeAuthHeader('guest_uid_2');
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/orders/ord_guest_1`, authGuest2);
    const passed = (res.status === 403);
    record(13, "Anonymous guest diner cannot read another guest's order", passed, `HTTP status ${res.status} (expected 403 Forbidden)`);
  }

  // Test 14: Anonymous guest diner cannot query all orders in a restaurant
  {
    const authGuest1 = makeAuthHeader('guest_uid_1');
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/orders`, authGuest1);
    const passed = (res.status === 403);
    record(14, 'Anonymous guest diner cannot list all orders in a restaurant', passed, `HTTP status ${res.status} (expected 403 Forbidden)`);
  }

  // Test 15: Anonymous guest diner cannot read kitchen tickets
  {
    const authGuest1 = makeAuthHeader('guest_uid_1');
    const res = await makeRequest('GET', `${BASE_PATH}/restaurants/tenant_a/kitchenTickets/kot_tenant_a`, authGuest1);
    const passed = (res.status === 403);
    record(15, 'Anonymous guest diner cannot read kitchen tickets', passed, `HTTP status ${res.status} (expected 403 Forbidden)`);
  }

  console.log('\n====================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`Summary: ${results.filter(r => r.passed).length}/${results.length} tests passed.`);
  if (allPassed) {
    console.log('✅ ALL FIRESTORE SECURITY RULES TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED!');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('FATAL TEST RUN ERROR:', err);
  process.exit(1);
});
