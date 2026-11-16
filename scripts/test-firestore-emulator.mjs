/**
 * SPIRALDINE: COMPREHENSIVE FIRESTORE EMULATOR TEST SUITE
 * 
 * Target: 127.0.0.1:8088 (Live Standard Firestore Emulator)
 * Rules: firestore.rules (Hardened)
 * 
 * Verifies all 16 required security & integration scenarios:
 * 1. New customer profile creation
 * 2. Existing customer profile update (name, phone)
 * 3. Customer changing own role to owner (Denied)
 * 4. Customer changing own role to super_admin (Denied)
 * 5. Customer changing own tenantId (Denied)
 * 6. Customer changing own account status (Denied)
 * 7. Customer modifying walletBalance (Denied)
 * 8. Customer modifying loyaltyPoints (Denied)
 * 9. Customer updating permitted dietary preferences (Allowed)
 * 10. Customer reading another customer's profile (Denied)
 * 11. Customer writing another customer's profile (Denied)
 * 12. Unauthorized staff role creation (Denied)
 * 13. Authorized staff account access (Allowed)
 * 14. Owner permissions (Allowed)
 * 15. Five concurrent customer provisioning requests (Allowed, zero corruption)
 * 16. Anonymous QR ordering (Allowed)
 */

const base64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function createMockToken(uid, claims = {}) {
  const header = base64({ alg: 'none', typ: 'JWT' });
  const payload = base64({ 
    sub: uid, 
    user_id: uid, 
    aud: 'spiral-restaurant-saas-v1', 
    iss: 'https://securetoken.google.com/spiral-restaurant-saas-v1',
    ...claims 
  });
  return header + '.' + payload + '.';
}

const BASE_URL = 'http://127.0.0.1:8088/v1/projects/spiral-restaurant-saas-v1/databases/(default)/documents';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
    if (details) console.error(`    ${details}`);
    failedTests++;
  }
}

// REST helper to convert simple JS object to Firestore document fields
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === null) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: val.toString() };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (Array.isArray(val)) {
      fields[key] = { arrayValue: { values: val.map(v => ({ stringValue: String(v) })) } };
    } else if (typeof val === 'object') {
      fields[key] = { mapValue: { fields: toFirestoreFields(val) } };
    }
  }
  return fields;
}

// REST helper to decode Firestore document fields to simple JS object
function fromFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = {};
  for (const [key, f] of Object.entries(doc.fields)) {
    if ('stringValue' in f) obj[key] = f.stringValue;
    else if ('integerValue' in f) obj[key] = parseInt(f.integerValue, 10);
    else if ('doubleValue' in f) obj[key] = f.doubleValue;
    else if ('booleanValue' in f) obj[key] = f.booleanValue;
    else if ('nullValue' in f) obj[key] = null;
    else if ('arrayValue' in f) {
      obj[key] = (f.arrayValue.values || []).map(v => v.stringValue || Object.values(v)[0]);
    } else if ('mapValue' in f) {
      obj[key] = fromFirestoreDoc({ fields: f.mapValue.fields });
    }
  }
  return obj;
}

async function getFirestoreDoc(collectionPath, id, token) {
  const res = await fetch(`${BASE_URL}/${collectionPath}/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (res.status === 404) return null;
  if (!res.ok) throw { status: res.status, data: await res.json() };
  const data = await res.json();
  return fromFirestoreDoc(data);
}

async function setFirestoreDoc(collectionPath, id, data, token, updateMask = null) {
  const fields = toFirestoreFields(data);
  let url = `${BASE_URL}/${collectionPath}/${id}`;
  if (updateMask && Array.isArray(updateMask)) {
    const maskParams = updateMask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
    url += `?${maskParams}`;
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw { status: res.status, data: await res.json() };
  return fromFirestoreDoc(await res.json());
}

async function postFirestoreDoc(collectionPath, data, token, customDocId = null) {
  const fields = toFirestoreFields(data);
  let url = `${BASE_URL}/${collectionPath}`;
  if (customDocId) {
    url += `?documentId=${encodeURIComponent(customDocId)}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw { status: res.status, data: await res.json() };
  return fromFirestoreDoc(await res.json());
}

console.log('===============================================================');
console.log('SPIRALDINE — LIVE FIRESTORE EMULATOR 16-SCENARIO SUITE');
console.log('Endpoint: 127.0.0.1:8088 | Rules: firestore.rules (Hardened)');
console.log('===============================================================\n');

async function runTestSuite() {
  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: New Customer Profile Creation (Allowed)
    // -------------------------------------------------------------------------
    console.log('--- 1. New Customer Profile Creation ---');
    const cust1Uid = 'cust_scene_01';
    const cust1Token = createMockToken(cust1Uid);
    const now = new Date().toISOString();

    const newCustPayload = {
      uid: cust1Uid,
      fullName: 'Ananya Roy',
      displayName: 'Ananya Roy',
      email: 'ananya@example.com',
      phoneNumber: '+919133496171',
      role: 'customer',
      tenantId: null,
      walletBalance: 0,
      loyaltyPoints: 0,
      status: 'active',
      isAnonymous: false,
      createdAt: now,
      updatedAt: now
    };

    const newUserPayload = {
      uid: cust1Uid,
      email: 'ananya@example.com',
      displayName: 'Ananya Roy',
      fullName: 'Ananya Roy',
      role: 'customer',
      tenantId: '',
      branchId: '',
      department: '',
      status: 'active',
      phoneNumber: '+919133496171',
      createdAt: now,
      updatedAt: now
    };

    await setFirestoreDoc('customers', cust1Uid, newCustPayload, cust1Token);
    await setFirestoreDoc('users', cust1Uid, newUserPayload, cust1Token);

    const docCust1 = await getFirestoreDoc('customers', cust1Uid, cust1Token);
    const docUser1 = await getFirestoreDoc('users', cust1Uid, cust1Token);

    assert(docCust1 !== null && docCust1.role === 'customer', 'New customer profile created in customers/{uid}');
    assert(docUser1 !== null && docUser1.role === 'customer', 'New customer directory entry created in users/{uid}');
    assert(docCust1.walletBalance === 0 && docCust1.loyaltyPoints === 0, 'Customer financial fields initialized to 0');
    assert(docUser1.tenantId === '', 'Tenant isolation preserved (tenantId: "")');

    // -------------------------------------------------------------------------
    // SCENARIO 2: Existing Customer Profile Update (Allowed)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Existing Customer Profile Update ---');
    const updatedName = 'Ananya Roy Chowdhury';
    const updatedPhone = '+919133496172';
    const updateTime = new Date().toISOString();

    await setFirestoreDoc('customers', cust1Uid, {
      ...docCust1,
      displayName: updatedName,
      fullName: updatedName,
      phoneNumber: updatedPhone,
      updatedAt: updateTime
    }, cust1Token);

    await setFirestoreDoc('users', cust1Uid, {
      ...docUser1,
      displayName: updatedName,
      fullName: updatedName,
      phoneNumber: updatedPhone,
      updatedAt: updateTime
    }, cust1Token);

    const postUpdateCust1 = await getFirestoreDoc('customers', cust1Uid, cust1Token);
    assert(postUpdateCust1.displayName === updatedName, 'Customer successfully updated own displayName');
    assert(postUpdateCust1.phoneNumber === updatedPhone, 'Customer successfully updated own phoneNumber');

    // -------------------------------------------------------------------------
    // SCENARIO 3: Customer Changing Own Role to Owner (Denied)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Customer Changing Own Role to Owner (Denied) ---');
    let roleElevationToOwnerBlocked = false;
    try {
      await setFirestoreDoc('users', cust1Uid, {
        ...docUser1,
        role: 'owner'
      }, cust1Token);
    } catch (e) {
      if (e.status === 403) roleElevationToOwnerBlocked = true;
    }
    assert(roleElevationToOwnerBlocked === true, 'firestore.rules blocks customer changing own role to "owner" (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 4: Customer Changing Own Role to Super Admin (Denied)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Customer Changing Own Role to Super Admin (Denied) ---');
    let roleElevationToSuperAdminBlocked = false;
    try {
      await setFirestoreDoc('users', cust1Uid, {
        ...docUser1,
        role: 'super_admin'
      }, cust1Token);
    } catch (e) {
      if (e.status === 403) roleElevationToSuperAdminBlocked = true;
    }
    assert(roleElevationToSuperAdminBlocked === true, 'firestore.rules blocks customer changing own role to "super_admin" (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 5: Customer Changing Own tenantId (Denied)
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Customer Changing Own tenantId (Denied) ---');
    let tenantHoppingBlocked = false;
    try {
      await setFirestoreDoc('users', cust1Uid, {
        ...docUser1,
        tenantId: 'tenant-victim-restaurant'
      }, cust1Token);
    } catch (e) {
      if (e.status === 403) tenantHoppingBlocked = true;
    }
    assert(tenantHoppingBlocked === true, 'firestore.rules blocks customer changing tenantId to access restaurant data (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 6: Customer Changing Own Account Status (Denied)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Customer Changing Own Account Status (Denied) ---');
    // Pre-seed a suspended customer using Super Admin token
    const suspendedUid = 'cust_suspended_06';
    const saToken = createMockToken('super_admin_user', { role: 'super_admin' });
    await setFirestoreDoc('users', suspendedUid, {
      uid: suspendedUid,
      role: 'customer',
      status: 'suspended',
      tenantId: '',
      email: 'badactor@example.com'
    }, saToken);

    await setFirestoreDoc('customers', suspendedUid, {
      uid: suspendedUid,
      role: 'customer',
      status: 'suspended',
      tenantId: null,
      walletBalance: 0,
      loyaltyPoints: 0
    }, saToken);

    let reactivationBlocked = false;
    const suspendedToken = createMockToken(suspendedUid);
    try {
      await setFirestoreDoc('customers', suspendedUid, {
        uid: suspendedUid,
        role: 'customer',
        status: 'active', // Attempted self-reactivation
        tenantId: null,
        walletBalance: 0,
        loyaltyPoints: 0
      }, suspendedToken);
    } catch (e) {
      if (e.status === 403) reactivationBlocked = true;
    }
    assert(reactivationBlocked === true, 'firestore.rules blocks suspended customer reactivating status to active (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 7: Customer Modifying walletBalance (Denied)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Customer Modifying walletBalance (Denied) ---');
    let walletInjectionBlocked = false;
    try {
      await setFirestoreDoc('customers', cust1Uid, {
        ...postUpdateCust1,
        walletBalance: 999999
      }, cust1Token);
    } catch (e) {
      if (e.status === 403) walletInjectionBlocked = true;
    }
    assert(walletInjectionBlocked === true, 'firestore.rules blocks client-side walletBalance modification (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 8: Customer Modifying loyaltyPoints (Denied)
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Customer Modifying loyaltyPoints (Denied) ---');
    let loyaltyInjectionBlocked = false;
    try {
      await setFirestoreDoc('customers', cust1Uid, {
        ...postUpdateCust1,
        loyaltyPoints: 50000
      }, cust1Token);
    } catch (e) {
      if (e.status === 403) loyaltyInjectionBlocked = true;
    }
    assert(loyaltyInjectionBlocked === true, 'firestore.rules blocks client-side loyaltyPoints modification (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 9: Customer Updating Permitted Dietary Preferences (Allowed)
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Customer Updating Permitted Dietary Preferences (Allowed) ---');
    const updatedDietaryPrefs = ['vegan', 'jain', 'gluten-free'];
    const updatedFavorites = ['dish_001', 'dish_009'];

    await setFirestoreDoc('customers', cust1Uid, {
      ...postUpdateCust1,
      dietaryPreferences: updatedDietaryPrefs,
      favoriteDishes: updatedFavorites,
      updatedAt: new Date().toISOString()
    }, cust1Token);

    const postDietaryCust1 = await getFirestoreDoc('customers', cust1Uid, cust1Token);
    assert(
      Array.isArray(postDietaryCust1.dietaryPreferences) && postDietaryCust1.dietaryPreferences.length === 3,
      'Customer successfully updated permitted dietary preferences'
    );
    assert(
      Array.isArray(postDietaryCust1.favoriteDishes) && postDietaryCust1.favoriteDishes.length === 2,
      'Customer successfully updated favorite dishes'
    );

    // -------------------------------------------------------------------------
    // SCENARIO 10: Customer Reading Another Customer's Profile (Denied)
    // -------------------------------------------------------------------------
    console.log('\n--- 10. Customer Reading Another Customer\'s Profile (Denied) ---');
    const cust2Uid = 'cust_scene_02';
    // Seed existing customer with wallet balance using Super Admin token (trusted backend role)
    await setFirestoreDoc('customers', cust2Uid, {
      uid: cust2Uid,
      fullName: 'Private Customer',
      phoneNumber: '+919877700000',
      role: 'customer',
      tenantId: null,
      walletBalance: 1500,
      loyaltyPoints: 200,
      status: 'active'
    }, saToken);

    let crossCustReadBlocked = false;
    try {
      await getFirestoreDoc('customers', cust2Uid, cust1Token); // Cust 1 reading Cust 2
    } catch (e) {
      if (e.status === 403) crossCustReadBlocked = true;
    }
    assert(crossCustReadBlocked === true, 'firestore.rules denies customer reading another customer profile (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 11: Customer Writing Another Customer\'s Profile (Denied)
    // -------------------------------------------------------------------------
    console.log('\n--- 11. Customer Writing Another Customer\'s Profile (Denied) ---');
    let crossCustWriteBlocked = false;
    try {
      await setFirestoreDoc('customers', cust2Uid, {
        displayName: 'Overwritten By Hacker'
      }, cust1Token); // Cust 1 writing Cust 2
    } catch (e) {
      if (e.status === 403) crossCustWriteBlocked = true;
    }
    assert(crossCustWriteBlocked === true, 'firestore.rules denies customer overwriting another customer profile (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 12: Unauthorized Staff Role Creation (Denied)
    // -------------------------------------------------------------------------
    console.log('\n--- 12. Unauthorized Staff Role Creation (Denied) ---');
    const attackerUid = 'attacker_staff_fake';
    const attackerToken = createMockToken(attackerUid);

    let waiterCreationBlocked = false;
    try {
      await setFirestoreDoc('users', attackerUid, {
        uid: attackerUid,
        role: 'waiter',
        tenantId: 'tenant-spice-paradise',
        status: 'active'
      }, attackerToken);
    } catch (e) {
      if (e.status === 403) waiterCreationBlocked = true;
    }

    let managerCreationBlocked = false;
    try {
      await setFirestoreDoc('users', attackerUid, {
        uid: attackerUid,
        role: 'manager',
        tenantId: 'tenant-spice-paradise',
        status: 'active'
      }, attackerToken);
    } catch (e) {
      if (e.status === 403) managerCreationBlocked = true;
    }

    assert(waiterCreationBlocked === true, 'firestore.rules blocks unauthorized self-creation of "waiter" role (403)');
    assert(managerCreationBlocked === true, 'firestore.rules blocks unauthorized self-creation of "manager" role (403)');

    // -------------------------------------------------------------------------
    // SCENARIO 13: Authorized Staff Account Access (Allowed)
    // -------------------------------------------------------------------------
    console.log('\n--- 13. Authorized Staff Account Access (Allowed) ---');
    const tenantId = 'tenant_rest_13';
    const waiterUid = 'staff_waiter_valid';
    const waiterToken = createMockToken(waiterUid);

    // Seed waiter user profile via Super Admin
    await setFirestoreDoc('users', waiterUid, {
      uid: waiterUid,
      role: 'waiter',
      tenantId: tenantId,
      branchId: 'branch_main',
      status: 'active',
      email: 'waiter@restaurant.com'
    }, saToken);

    // Waiter creates and manages order in tenant orders subcollection
    const orderId13 = 'ORDER-13001';
    await setFirestoreDoc(`restaurants/${tenantId}/orders`, orderId13, {
      orderId: orderId13,
      tenantId: tenantId,
      branchId: 'branch_main',
      status: 'NEW',
      paymentStatus: 'pending',
      total: 540,
      subtotal: 500,
      tax: 40,
      discount: 0,
      items: [{ id: 'dish_01', name: 'Butter Chicken', quantity: 1, price: 500 }],
      createdAt: new Date().toISOString()
    }, waiterToken);

    const fetchedOrder = await getFirestoreDoc(`restaurants/${tenantId}/orders`, orderId13, waiterToken);
    assert(fetchedOrder !== null && fetchedOrder.orderId === orderId13, 'Authorized waiter successfully created and read tenant order');

    // -------------------------------------------------------------------------
    // SCENARIO 14: Owner Permissions (Allowed)
    // -------------------------------------------------------------------------
    console.log('\n--- 14. Owner Permissions (Allowed) ---');
    const ownerUid = 'owner_valid_14';
    const ownerToken = createMockToken(ownerUid);

    // Seed owner user profile via Super Admin
    await setFirestoreDoc('users', ownerUid, {
      uid: ownerUid,
      role: 'owner',
      tenantId: tenantId,
      status: 'active',
      email: 'owner@restaurant.com'
    }, saToken);

    // Owner creates restaurant table
    const tableId14 = 'TABLE-14';
    await setFirestoreDoc(`restaurants/${tenantId}/tables`, tableId14, {
      id: tableId14,
      tableNumber: '14',
      capacity: 4,
      status: 'Available',
      tenantId: tenantId
    }, ownerToken);

    const fetchedTable = await getFirestoreDoc(`restaurants/${tenantId}/tables`, tableId14, ownerToken);
    assert(fetchedTable !== null && fetchedTable.tableNumber === '14', 'Authorized owner created and managed restaurant table configuration');

    // Owner reads customer list profile
    const ownerReadCustomer = await getFirestoreDoc('customers', cust1Uid, ownerToken);
    assert(ownerReadCustomer !== null, 'Authorized restaurant owner permitted to read customer diner profiles');

    // -------------------------------------------------------------------------
    // SCENARIO 15: Five Concurrent Customer Provisioning Requests (Allowed)
    // -------------------------------------------------------------------------
    console.log('\n--- 15. Five Concurrent Customer Provisioning Requests ---');
    const concUid = 'cust_concurrent_15';
    const concToken = createMockToken(concUid);

    // Execute 5 simultaneous provisioning calls
    const concCalls = [1, 2, 3, 4, 5].map(i => {
      const ts = new Date().toISOString();
      return Promise.all([
        setFirestoreDoc('customers', concUid, {
          uid: concUid,
          fullName: `Concurrent Diner ${i}`,
          displayName: `Concurrent Diner ${i}`,
          phoneNumber: '+919876543219',
          role: 'customer',
          tenantId: null,
          walletBalance: 0,
          loyaltyPoints: 0,
          status: 'active',
          updatedAt: ts
        }, concToken),
        setFirestoreDoc('users', concUid, {
          uid: concUid,
          fullName: `Concurrent Diner ${i}`,
          displayName: `Concurrent Diner ${i}`,
          role: 'customer',
          tenantId: '',
          branchId: '',
          department: '',
          status: 'active',
          phoneNumber: '+919876543219',
          updatedAt: ts
        }, concToken)
      ]);
    });

    const concResults = await Promise.all(concCalls);
    assert(concResults.length === 5, 'All 5 concurrent requests resolved without conflict');

    const finalConcCust = await getFirestoreDoc('customers', concUid, concToken);
    const finalConcUser = await getFirestoreDoc('users', concUid, concToken);
    assert(finalConcCust.role === 'customer' && finalConcCust.walletBalance === 0, 'Canonical customer doc consistent after concurrency');
    assert(finalConcUser.role === 'customer' && finalConcUser.tenantId === '', 'Synchronized user doc consistent after concurrency');

    // -------------------------------------------------------------------------
    // SCENARIO 16: Anonymous Guest QR Ordering (Allowed)
    // -------------------------------------------------------------------------
    console.log('\n--- 16. Anonymous Guest QR Ordering (Allowed) ---');
    const guestOrderId = 'ORDER-GUEST-16';
    
    // Unauthenticated diner creating initial NEW order linked to table
    const guestOrderDoc = await setFirestoreDoc(`restaurants/${tenantId}/orders`, guestOrderId, {
      orderId: guestOrderId,
      tenantId: tenantId,
      status: 'NEW',
      paymentStatus: 'pending',
      customerId: 'guest-uid',
      total: 350,
      subtotal: 320,
      tax: 30,
      discount: 0,
      items: [{ id: 'dish_guest_01', name: 'Spring Rolls', quantity: 2, price: 160 }],
      createdAt: new Date().toISOString()
    }, null); // null token = unauthenticated guest QR diner

    assert(guestOrderDoc !== null && guestOrderDoc.orderId === guestOrderId, 'Anonymous guest placed initial QR order successfully');

    console.log('\n===============================================================');
    console.log(`EMULATOR TEST SUMMARY: ${passedTests}/${passedTests + failedTests} TESTS PASSED`);
    if (failedTests === 0) {
      console.log('STATUS: ALL 16 SCENARIOS PASSED WITH HARDENED FIRESTORE RULES');
    } else {
      console.log(`STATUS: ${failedTests} CHECKS FAILED`);
    }
    console.log('===============================================================\n');

    if (failedTests > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error('Fatal Emulator Test Error:', err);
    process.exit(1);
  }
}

runTestSuite();
