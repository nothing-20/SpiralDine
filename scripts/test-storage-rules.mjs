/**
 * SPIRALDINE: FIREBASE STORAGE SECURITY RULES & MULTI-TENANT TEST SUITE
 * 
 * Verifies all required security & multi-tenant requirements using the official
 * Firebase modular SDK connected to live Auth, Firestore, and Storage emulators.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from 'firebase/auth';
import { 
  getStorage, 
  connectStorageEmulator, 
  ref, 
  uploadBytes, 
  deleteObject, 
  getBytes,
  listAll
} from 'firebase/storage';

const PROJECT_ID = 'spiral-restaurant-saas-v1';
const FIRESTORE_URL = `http://127.0.0.1:8088/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const base64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function createAdminMockToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = base64({ alg: 'none', typ: 'JWT' });
  const payload = base64({ 
    sub: 'system_super_admin', 
    user_id: 'system_super_admin', 
    aud: PROJECT_ID, 
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    auth_time: now,
    iat: now,
    exp: now + 3600,
    role: 'super_admin',
    super_admin: true,
  });
  return `${header}.${payload}.`;
}

const adminSeedToken = createAdminMockToken();

async function setFirestoreDoc(collection, docId, data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'number') fields[k] = { integerValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
  }
  
  const res = await fetch(`${FIRESTORE_URL}/${collection}/${docId}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminSeedToken}`
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`[Firestore Seed Error] ${collection}/${docId}: ${res.status} ${errText}`);
  }
}

// Initialize Firebase SDK
const app = initializeApp({
  projectId: PROJECT_ID,
  apiKey: 'fake-api-key',
  storageBucket: `${PROJECT_ID}.firebasestorage.app`,
});

const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099');

const storage = getStorage(app);
connectStorageEmulator(storage, '127.0.0.1', 9199);

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (details) console.error(`     Details: ${details}`);
    throw new Error(`Test failed: ${testName} - ${details}`);
  }
}

async function runStorageSuite() {
  console.log('===============================================================');
  console.log('SPIRALDINE: FIREBASE STORAGE MULTI-TENANT TEST SUITE');
  console.log('===============================================================\n');

  // Step 1: Create test users in Auth Emulator
  console.log('1. Creating test users in Auth Emulator...');
  const users = {
    ownerAlpha: { email: `owner_alpha_${Date.now()}@test.com`, pass: 'TestPassword123!', uid: '' },
    ownerBeta: { email: `owner_beta_${Date.now()}@test.com`, pass: 'TestPassword123!', uid: '' },
    ownerGamma: { email: `owner_gamma_${Date.now()}@test.com`, pass: 'TestPassword123!', uid: '' },
    ownerSuspended: { email: `owner_suspended_${Date.now()}@test.com`, pass: 'TestPassword123!', uid: '' },
    ownerSuspendedTenant: { email: `owner_susptenant_${Date.now()}@test.com`, pass: 'TestPassword123!', uid: '' },
    waiter: { email: `waiter_${Date.now()}@test.com`, pass: 'TestPassword123!', uid: '' },
    customer: { email: `customer_${Date.now()}@test.com`, pass: 'TestPassword123!', uid: '' },
    superAdmin: { email: `superadmin_${Date.now()}@test.com`, pass: 'TestPassword123!', uid: '' },
  };

  for (const [key, user] of Object.entries(users)) {
    const cred = await createUserWithEmailAndPassword(auth, user.email, user.pass);
    user.uid = cred.user.uid;
  }
  console.log('   Test users created successfully.\n');

  // Step 2: Seed Firestore state
  console.log('2. Seeding Firestore Emulator with authoritative test state...');
  // Owner Alpha: users.tenantId == 'tenant_alpha', tenants.ownerUid == ownerAlpha.uid
  await setFirestoreDoc('users', users.ownerAlpha.uid, {
    uid: users.ownerAlpha.uid,
    role: 'owner',
    tenantId: 'tenant_alpha',
    status: 'active',
  });
  await setFirestoreDoc('tenants', 'tenant_alpha', {
    id: 'tenant_alpha',
    name: 'Alpha Bistro',
    ownerUid: users.ownerAlpha.uid,
    status: 'active',
  });

  // Owner Beta: users.tenantId == 'tenant_beta', tenants.ownerUid == ownerBeta.uid
  await setFirestoreDoc('users', users.ownerBeta.uid, {
    uid: users.ownerBeta.uid,
    role: 'owner',
    tenantId: 'tenant_beta',
    status: 'active',
  });
  await setFirestoreDoc('tenants', 'tenant_beta', {
    id: 'tenant_beta',
    name: 'Beta Diner',
    ownerUid: users.ownerBeta.uid,
    status: 'active',
  });

  // Owner Gamma: users.tenantId == '' (not on user doc), but tenants.ownerUid == ownerGamma.uid
  await setFirestoreDoc('users', users.ownerGamma.uid, {
    uid: users.ownerGamma.uid,
    role: 'owner',
    tenantId: '',
    status: 'active',
  });
  await setFirestoreDoc('tenants', 'tenant_gamma', {
    id: 'tenant_gamma',
    name: 'Gamma Cafe',
    ownerUid: users.ownerGamma.uid,
    status: 'active',
  });

  // Suspended Owner: user status is suspended
  await setFirestoreDoc('users', users.ownerSuspended.uid, {
    uid: users.ownerSuspended.uid,
    role: 'owner',
    tenantId: 'tenant_alpha',
    status: 'suspended',
  });

  // Owner of Suspended Tenant: tenant status is suspended
  await setFirestoreDoc('users', users.ownerSuspendedTenant.uid, {
    uid: users.ownerSuspendedTenant.uid,
    role: 'owner',
    tenantId: 'tenant_suspended',
    status: 'active',
  });
  await setFirestoreDoc('tenants', 'tenant_suspended', {
    id: 'tenant_suspended',
    name: 'Suspended Bistro',
    ownerUid: users.ownerSuspendedTenant.uid,
    status: 'suspended',
  });

  // Waiter staff in tenant_alpha
  await setFirestoreDoc('users', users.waiter.uid, {
    uid: users.waiter.uid,
    role: 'waiter',
    tenantId: 'tenant_alpha',
    status: 'active',
  });

  // Customer
  await setFirestoreDoc('users', users.customer.uid, {
    uid: users.customer.uid,
    role: 'customer',
    tenantId: '',
    status: 'active',
  });

  // Super Admin
  await setFirestoreDoc('users', users.superAdmin.uid, {
    uid: users.superAdmin.uid,
    role: 'super_admin',
    tenantId: '',
    status: 'active',
  });
  console.log('   Authoritative Firestore state seeded successfully.\n');

  // Payloads
  const validLogoBytes = new Uint8Array(100 * 1024); // 100 KB
  const validCoverBytes = new Uint8Array(1024 * 1024); // 1 MB
  const oversizedLogoBytes = new Uint8Array(2.5 * 1024 * 1024); // 2.5 MB (limit 2 MB)
  const oversizedCoverBytes = new Uint8Array(5.5 * 1024 * 1024); // 5.5 MB (limit 5 MB)

  console.log('3. Executing Storage Security Rules Scenarios...\n');

  // Scenario 1: Authorized restaurant owner can upload their own logo
  await signInWithEmailAndPassword(auth, users.ownerAlpha.email, users.ownerAlpha.pass);
  const logoAlphaRef = ref(storage, 'restaurants/tenant_alpha/branding/logo_1731665000000.png');
  let err1 = null;
  try {
    await uploadBytes(logoAlphaRef, validLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err1 = e;
  }
  assert(!err1, 'Scenario 1: Authorized owner can upload their own logo (<= 2MB, PNG)', err1?.message);

  // Scenario 2: Authorized owner can upload their own cover image
  const coverAlphaRef = ref(storage, 'restaurants/tenant_alpha/branding/cover_1731665000000.jpg');
  let err2 = null;
  try {
    await uploadBytes(coverAlphaRef, validCoverBytes, { contentType: 'image/jpeg' });
  } catch (e) {
    err2 = e;
  }
  assert(!err2, 'Scenario 2: Authorized owner can upload their own cover image (<= 5MB, JPEG)', err2?.message);

  // Scenario 3: Owner cannot upload to another tenant's directory (Cross-tenant denied)
  const crossTenantRef = ref(storage, 'restaurants/tenant_beta/branding/logo_hack.png');
  let err3 = null;
  try {
    await uploadBytes(crossTenantRef, validLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err3 = e;
  }
  assert(err3?.code === 'storage/unauthorized', 'Scenario 3: Owner cannot upload to another tenant (Cross-tenant denied)', `Code: ${err3?.code}`);

  // Scenario 4: Customer cannot upload branding assets
  await signInWithEmailAndPassword(auth, users.customer.email, users.customer.pass);
  const custUploadRef = ref(storage, 'restaurants/tenant_alpha/branding/logo_cust.png');
  let err4 = null;
  try {
    await uploadBytes(custUploadRef, validLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err4 = e;
  }
  assert(err4?.code === 'storage/unauthorized', 'Scenario 4: Customer cannot upload branding assets (Denied)', `Code: ${err4?.code}`);

  // Scenario 5: Unauthorized / unauthenticated user cannot upload
  await signOut(auth);
  const anonUploadRef = ref(storage, 'restaurants/tenant_alpha/branding/logo_anon.png');
  let err5 = null;
  try {
    await uploadBytes(anonUploadRef, validLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err5 = e;
  }
  assert(err5?.code === 'storage/unauthorized', 'Scenario 5: Unauthenticated user cannot upload assets (Denied)', `Code: ${err5?.code}`);

  // Scenario 6: Unauthorized staff (waiter) cannot upload or delete restaurant branding
  await signInWithEmailAndPassword(auth, users.waiter.email, users.waiter.pass);
  const waiterUploadRef = ref(storage, 'restaurants/tenant_alpha/branding/logo_waiter.png');
  let err6a = null;
  try {
    await uploadBytes(waiterUploadRef, validLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err6a = e;
  }
  assert(err6a?.code === 'storage/unauthorized', 'Scenario 6a: Waiter staff cannot upload branding (Denied)', `Code: ${err6a?.code}`);

  let err6b = null;
  try {
    await deleteObject(logoAlphaRef);
  } catch (e) {
    err6b = e;
  }
  assert(err6b?.code === 'storage/unauthorized', 'Scenario 6b: Waiter staff cannot delete branding assets (Denied)', `Code: ${err6b?.code}`);

  // Scenario 7: Invalid file types are rejected (PDF, SVG, HTML)
  await signInWithEmailAndPassword(auth, users.ownerAlpha.email, users.ownerAlpha.pass);
  const pdfRef = ref(storage, 'restaurants/tenant_alpha/branding/logo_test.pdf');
  let err7a = null;
  try {
    await uploadBytes(pdfRef, validLogoBytes, { contentType: 'application/pdf' });
  } catch (e) {
    err7a = e;
  }
  assert(err7a?.code === 'storage/unauthorized', 'Scenario 7a: PDF file type rejected (Denied)', `Code: ${err7a?.code}`);

  const svgRef = ref(storage, 'restaurants/tenant_alpha/branding/logo_test.svg');
  let err7b = null;
  try {
    await uploadBytes(svgRef, validLogoBytes, { contentType: 'image/svg+xml' });
  } catch (e) {
    err7b = e;
  }
  assert(err7b?.code === 'storage/unauthorized', 'Scenario 7b: SVG file type rejected (Denied)', `Code: ${err7b?.code}`);

  const htmlRef = ref(storage, 'restaurants/tenant_alpha/branding/logo_test.html');
  let err7c = null;
  try {
    await uploadBytes(htmlRef, validLogoBytes, { contentType: 'text/html' });
  } catch (e) {
    err7c = e;
  }
  assert(err7c?.code === 'storage/unauthorized', 'Scenario 7c: HTML file type rejected (Denied)', `Code: ${err7c?.code}`);

  // Scenario 8: Files exceeding size limits are rejected (>2MB logo, >5MB cover)
  const oversizedLogoRef = ref(storage, 'restaurants/tenant_alpha/branding/logo_oversized.png');
  let err8a = null;
  try {
    await uploadBytes(oversizedLogoRef, oversizedLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err8a = e;
  }
  assert(err8a?.code === 'storage/unauthorized', 'Scenario 8a: Logo exceeding 2 MB is rejected (Denied)', `Code: ${err8a?.code}`);

  const oversizedCoverRef = ref(storage, 'restaurants/tenant_alpha/branding/cover_oversized.jpg');
  let err8b = null;
  try {
    await uploadBytes(oversizedCoverRef, oversizedCoverBytes, { contentType: 'image/jpeg' });
  } catch (e) {
    err8b = e;
  }
  assert(err8b?.code === 'storage/unauthorized', 'Scenario 8b: Cover photo exceeding 5 MB is rejected (Denied)', `Code: ${err8b?.code}`);

  // Scenario 9: Published images can be viewed publicly by unauthenticated customers
  await signOut(auth);
  let readErr = null;
  let readBytesData = null;
  try {
    readBytesData = await getBytes(logoAlphaRef);
  } catch (e) {
    readErr = e;
  }
  assert(!readErr && readBytesData?.byteLength === validLogoBytes.byteLength, 'Scenario 9: Published images are publicly readable by customers (Allowed)', readErr?.message);

  // Scenario 10: Multi-restaurant owner resolved via tenants collection can upload
  await signInWithEmailAndPassword(auth, users.ownerGamma.email, users.ownerGamma.pass);
  const logoGammaRef = ref(storage, 'restaurants/tenant_gamma/branding/logo_gamma.png');
  let err10 = null;
  try {
    await uploadBytes(logoGammaRef, validLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err10 = e;
  }
  assert(!err10, 'Scenario 10: Multi-restaurant owner resolved via tenants collection is authorized (Allowed)', err10?.message);

  // Scenario 11: Super Admin can manage restaurant assets across tenants
  await signInWithEmailAndPassword(auth, users.superAdmin.email, users.superAdmin.pass);
  const logoAdminRef = ref(storage, 'restaurants/tenant_alpha/branding/logo_admin_override.png');
  let err11 = null;
  try {
    await uploadBytes(logoAdminRef, validLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err11 = e;
  }
  assert(!err11, 'Scenario 11: Super Admin authorized across all tenants (Allowed)', err11?.message);

  // Scenario 12: Menu items, categories, and gallery asset uploads
  await signInWithEmailAndPassword(auth, users.ownerAlpha.email, users.ownerAlpha.pass);
  const itemRef = ref(storage, 'restaurants/tenant_alpha/items/item_burger_123');
  let err12a = null;
  try {
    await uploadBytes(itemRef, validCoverBytes, { contentType: 'image/webp' });
  } catch (e) {
    err12a = e;
  }
  assert(!err12a, 'Scenario 12a: Menu item image upload authorized (Allowed)', err12a?.message);

  const catRef = ref(storage, 'restaurants/tenant_alpha/categories/cat_beverages_456');
  let err12b = null;
  try {
    await uploadBytes(catRef, validCoverBytes, { contentType: 'image/webp' });
  } catch (e) {
    err12b = e;
  }
  assert(!err12b, 'Scenario 12b: Menu category image upload authorized (Allowed)', err12b?.message);

  const galleryRef = ref(storage, 'restaurants/tenant_alpha/gallery/photo_dining_789');
  let err12c = null;
  try {
    await uploadBytes(galleryRef, validCoverBytes, { contentType: 'image/webp' });
  } catch (e) {
    err12c = e;
  }
  assert(!err12c, 'Scenario 12c: Gallery image upload authorized (Allowed)', err12c?.message);

  // Scenario 13: Authorized owner can delete superseded branding asset
  let err13 = null;
  try {
    await deleteObject(logoAlphaRef);
  } catch (e) {
    err13 = e;
  }
  assert(!err13, 'Scenario 13: Authorized owner can delete superseded branding asset (Allowed)', err13?.message);

  // Scenario 14: Frontend upload path contract in storageService.ts
  const storageServiceSource = readFileSync(
    resolve('src/shared/services/storageService.ts'),
    'utf8'
  );
  const pathMatchesContract = storageServiceSource.includes('restaurants/${tenantId}/branding/${type}_');
  assert(pathMatchesContract, 'Scenario 14: Frontend storageService path matches branding rule pattern');

  // Scenario 15: Public unauthenticated directory listing is REJECTED (allow get vs list)
  await signOut(auth);
  const brandingFolderRef = ref(storage, 'restaurants/tenant_alpha/branding');
  let err15 = null;
  try {
    await listAll(brandingFolderRef);
  } catch (e) {
    err15 = e;
  }
  assert(err15?.code === 'storage/unauthorized', 'Scenario 15: Public unauthenticated directory listing is rejected (Denied)', `Code: ${err15?.code}`);

  // Scenario 16: Suspended owner account cannot upload branding assets
  await signInWithEmailAndPassword(auth, users.ownerSuspended.email, users.ownerSuspended.pass);
  const suspendedOwnerUploadRef = ref(storage, 'restaurants/tenant_alpha/branding/logo_suspended.png');
  let err16 = null;
  try {
    await uploadBytes(suspendedOwnerUploadRef, validLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err16 = e;
  }
  assert(err16?.code === 'storage/unauthorized', 'Scenario 16: Suspended owner account upload is rejected (Denied)', `Code: ${err16?.code}`);

  // Scenario 17: Owner of a suspended restaurant tenant cannot upload branding assets
  await signInWithEmailAndPassword(auth, users.ownerSuspendedTenant.email, users.ownerSuspendedTenant.pass);
  const suspendedTenantUploadRef = ref(storage, 'restaurants/tenant_suspended/branding/logo_susptenant.png');
  let err17 = null;
  try {
    await uploadBytes(suspendedTenantUploadRef, validLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err17 = e;
  }
  assert(err17?.code === 'storage/unauthorized', 'Scenario 17: Suspended restaurant tenant upload is rejected (Denied)', `Code: ${err17?.code}`);

  // Scenario 18: Arbitrary branding filename without logo_ or cover_ prefix is REJECTED
  await signInWithEmailAndPassword(auth, users.ownerAlpha.email, users.ownerAlpha.pass);
  const arbitraryBrandingRef = ref(storage, 'restaurants/tenant_alpha/branding/banner_photo.png');
  let err18 = null;
  try {
    await uploadBytes(arbitraryBrandingRef, validLogoBytes, { contentType: 'image/png' });
  } catch (e) {
    err18 = e;
  }
  assert(err18?.code === 'storage/unauthorized', 'Scenario 18: Arbitrary branding filename without logo_/cover_ prefix is rejected (Denied)', `Code: ${err18?.code}`);

  console.log(`\n===============================================================`);
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('STATUS: ALL FIREBASE STORAGE SECURITY RULES & MULTI-TENANT AUDIT CHECKS PASSED');
  console.log('===============================================================\n');
}

runStorageSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ TEST SUITE RUNNER ERROR:', err);
    process.exit(1);
  });
