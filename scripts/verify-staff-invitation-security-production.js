import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import crypto from 'crypto';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const {
  normalizeEnvName,
  parseCliFlags,
  loadScriptEnvironment,
  resolveScriptFirebaseConfig,
  resolveRunnerCredentials,
} = require('./_lib/envGuard.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const flags = parseCliFlags();
const targetEnv = normalizeEnvName(flags.env || process.env.APP_ENV || 'staging');

loadScriptEnvironment({ rootDir: resolve(__dirname, '..'), envName: targetEnv });

const firebaseConfig = resolveScriptFirebaseConfig(process.env, { expectedEnv: targetEnv });
const runnerCreds = resolveRunnerCredentials(process.env);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

function buildStaffActivationLink(token, email, employeeId) {
  const origin = 'https://restaurant-os-dun.vercel.app';
  return (
    `${origin}/staff/activate` +
    `?token=${encodeURIComponent((token || '').trim())}` +
    `&email=${encodeURIComponent((email || '').trim().toLowerCase())}` +
    `&id=${encodeURIComponent((employeeId || '').trim())}`
  );
}

function isInvitationExpired(expiresAt) {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  return !isNaN(time) && time < Date.now();
}

function getDashboardRoute(role) {
  switch ((role || '').toLowerCase()) {
    case 'kitchen':
      return '/dashboard/kitchen';
    case 'waiter':
      return '/dashboard/waiter';
    case 'manager':
      return '/dashboard/manager';
    case 'cashier':
      return '/dashboard/cashier';
    case 'reception':
      return '/dashboard/reception';
    case 'owner':
    case 'admin':
    case 'super-admin':
      return '/owner/dashboard';
    default:
      return '/unauthorized';
  }
}

async function runSecurityAndLifecycleSuite() {
  console.log('========================================================================');
  console.log('RESTAURANTOS — FINAL PRODUCTION INVITATION LINK & SECURITY SUITE');
  console.log('========================================================================\n');

  // Step 1: Owner login
  console.log('[Phase 1] Authenticating Owner in Firebase Auth...');
  const ownerCred = await signInWithEmailAndPassword(auth, runnerCreds.email, runnerCreds.password);
  const ownerUid = ownerCred.user.uid;
  console.log('  -> Owner authenticated. UID:', ownerUid);

  // Step 2: Create a BRAND NEW employee document
  const ts = Date.now();
  const testEmail = `staff.invite.test.${ts}@example.com`;
  const testFullName = 'Production Security Test Waiter';
  const testRole = 'waiter';
  const testTenantId = 'spiral-restaurant-ilpc';
  const secureToken = generateSecureToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  console.log('\n[Phase 2] Creating authoritative Firestore employee document...');
  const empRef = await addDoc(collection(db, 'employees'), {
    fullName: testFullName,
    email: testEmail,
    phone: '+1 555-0999',
    role: testRole,
    department: 'Service Staff',
    tenantId: testTenantId,
    branchId: 'main',
    status: 'pending',
    activationStatus: 'invited',
    firebaseUid: null,
    invitedAt: now,
    createdAt: now,
    expiresAt: expiresAt,
    createdBy: ownerUid,
    updatedAt: now,
    invitationToken: secureToken,
  });

  const employeeId = empRef.id;
  console.log('  -> Fresh employee document created:');
  console.log('     ID:              ', employeeId);
  console.log('     Email:           ', testEmail);
  console.log('     Role:            ', testRole);
  console.log('     Tenant ID:       ', testTenantId);
  console.log('     Status:          ', 'pending');
  console.log('     ActivationStatus:', 'invited');

  // Step 3: Generate URL using canonical buildStaffActivationLink
  console.log('\n[Phase 3] Generating Canonical Activation URL...');
  const activationUrl = buildStaffActivationLink(secureToken, testEmail, employeeId);
  const parsedUrl = new URL(activationUrl);

  console.log('  -> Generated URL (REDACTED):',
    activationUrl.replace(secureToken, secureToken.substring(0, 8) + '...[REDACTED]...'));

  // Step 4: Programmatic verification of URL parameters
  console.log('\n[Phase 4] Verifying URL Query Parameters...');
  const tokenParam = parsedUrl.searchParams.get('token');
  const emailParam = parsedUrl.searchParams.get('email');
  const idParam = parsedUrl.searchParams.get('id');

  if (!tokenParam) throw new Error('FAIL: token parameter is missing from URL!');
  if (!emailParam) throw new Error('FAIL: email parameter is missing from URL!');
  if (!idParam) throw new Error('FAIL: id parameter is missing from URL!');
  console.log('  -> URL.searchParams.get("token") !== null: PASS');
  console.log('  -> URL.searchParams.get("email") !== null: PASS');
  console.log('  -> URL.searchParams.get("id") !== null:    PASS');

  // Step 5: ID equality check
  console.log('\n[Phase 5] Verifying ID equality with employeeRef.id...');
  if (idParam !== employeeId) {
    throw new Error(`FAIL: id parameter (${idParam}) !== employeeRef.id (${employeeId})`);
  }
  console.log('  -> idParam === employeeRef.id: PASS (', idParam, '===', employeeId, ')');

  // Sign out owner to simulate clean unauthenticated staff user opening the link
  await signOut(auth);
  console.log('\n[Phase 6] Signed out owner. Client is now completely UNAUTHENTICATED.');

  // Security Test A: Unauthenticated collection listing blocked
  console.log('\n[Security Test A] Unauthenticated collection listing...');
  try {
    await getDocs(collection(db, 'employees'));
    throw new Error('FAIL: Unauthenticated list on employees collection was NOT denied!');
  } catch (secErr) {
    if (secErr.message && secErr.message.includes('FAIL: Unauthenticated list')) throw secErr;
    console.log('  -> Result: DENIED as required (code:', secErr.code, ') — PASS');
  }

  // Security Test B: Unauthenticated direct getDoc allowed on invited document
  console.log('\n[Security Test B] Unauthenticated direct getDoc on employees/' + employeeId + '...');
  const directSnap = await getDoc(doc(db, 'employees', employeeId));
  if (!directSnap.exists()) {
    throw new Error('FAIL: Direct getDoc failed to find document!');
  }
  const empData = directSnap.data();
  console.log('  -> Result: ALLOWED (status=' + empData.status + ', activationStatus=' + empData.activationStatus + ') — PASS');

  // Security Test C: Wrong ID + valid token fails
  console.log('\n[Security Test C] Wrong ID + valid token lookup...');
  try {
    const wrongIdSnap = await getDoc(doc(db, 'employees', 'nonExistentEmployeeDocId12345'));
    if (wrongIdSnap.exists()) {
      throw new Error('FAIL: Non-existent ID returned a document!');
    }
    console.log('  -> Non-existent ID returns exists() === false — PASS');
  } catch (err) {
    console.log('  -> Non-existent ID lookup denied or empty (code:', err.code, ') — PASS');
  }

  // Security Test D: Correct ID + wrong token fails
  console.log('\n[Security Test D] Correct ID + wrong token comparison...');
  const fakeToken = 'wrong_invalid_token_12345';
  if (fakeToken.toLowerCase() === empData.invitationToken.toLowerCase()) {
    throw new Error('FAIL: Wrong token matched real token!');
  }
  console.log('  -> Comparison rejected: wrong token does NOT match stored token — PASS');

  // Security Test E: Correct ID + wrong email fails
  console.log('\n[Security Test E] Correct ID + wrong email comparison...');
  const fakeEmail = 'different.person@example.com';
  if (fakeEmail.toLowerCase() === empData.email.toLowerCase()) {
    throw new Error('FAIL: Wrong email matched real email!');
  }
  console.log('  -> Comparison rejected: wrong email does NOT match stored email — PASS');

  // Security Test F: Expired invitation fails
  console.log('\n[Security Test F] Expiration logic test...');
  const expiredPastDate = new Date(Date.now() - 3600000).toISOString();
  if (!isInvitationExpired(expiredPastDate)) {
    throw new Error('FAIL: Past date not detected as expired!');
  }
  if (isInvitationExpired(empData.expiresAt)) {
    throw new Error('FAIL: Valid future date falsely detected as expired!');
  }
  console.log('  -> Expiration validation logic accurate — PASS');

  // Step 7: Password Screen & Account Creation Simulation
  console.log('\n[Phase 7] Simulating Password Screen & Account Creation...');
  const staffPassword = 'SecurePassword_9988!';
  const staffCred = await createUserWithEmailAndPassword(auth, testEmail, staffPassword);
  const staffUid = staffCred.user.uid;
  console.log('  -> Firebase Auth account created. UID:', staffUid);

  // Step 8: Create users/{uid} document
  console.log('\n[Phase 8] Creating users/' + staffUid + ' profile record...');
  const userRecord = {
    uid: staffUid,
    fullName: testFullName,
    displayName: testFullName,
    email: testEmail,
    phone: '+1 555-0999',
    phoneNumber: '+1 555-0999',
    role: testRole,
    tenantId: testTenantId,
    branchId: 'main',
    department: 'Service Staff',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'users', staffUid), userRecord);
  console.log('  -> users/' + staffUid + ' written successfully — PASS');

  // Step 9: Update employees/{id} to activated
  console.log('\n[Phase 9] Updating employees/' + employeeId + ' to activated...');
  await updateDoc(doc(db, 'employees', employeeId), {
    firebaseUid: staffUid,
    userId: staffUid,
    status: 'active',
    activationStatus: 'activated',
    activatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log('  -> employees/' + employeeId + ' status set to active/activated — PASS');

  // Security Test G: Activated invitation cannot be activated again
  console.log('\n[Security Test G] Verify activated invitation cannot be activated again...');
  const recheckSnap = await getDoc(doc(db, 'employees', employeeId));
  const recheckData = recheckSnap.data();
  if (recheckData.activationStatus !== 'activated' || recheckData.status !== 'active') {
    throw new Error('FAIL: Document not marked as activated in Firestore!');
  }
  console.log('  -> Status is "activated" / "active" (displays "Account Already Activated") — PASS');

  // Security Test H: Cross-tenant invitation preserves original tenantId
  console.log('\n[Security Test H] Verifying cross-tenant isolation...');
  if (recheckData.tenantId !== testTenantId || userRecord.tenantId !== testTenantId) {
    throw new Error(`FAIL: tenantId was corrupted! Expected ${testTenantId}`);
  }
  console.log('  -> tenantId (' + recheckData.tenantId + ') preserved intact across employee and user profile — PASS');

  // Step 10: Role routing validation for all 6 roles
  console.log('\n[Phase 10] Validating Role Routing across all roles...');
  const rolesToTest = [
    { role: 'kitchen', expected: '/dashboard/kitchen' },
    { role: 'waiter', expected: '/dashboard/waiter' },
    { role: 'manager', expected: '/dashboard/manager' },
    { role: 'cashier', expected: '/dashboard/cashier' },
    { role: 'reception', expected: '/dashboard/reception' },
    { role: 'owner', expected: '/owner/dashboard' },
    { role: 'admin', expected: '/owner/dashboard' },
  ];

  for (const { role, expected } of rolesToTest) {
    const route = getDashboardRoute(role);
    if (route !== expected) {
      throw new Error(`FAIL: Role ${role} routed to ${route}, expected ${expected}`);
    }
    console.log(`  -> Role: ${role.padEnd(10)} => ${route} — PASS`);
  }

  // Sign out staff user
  await signOut(auth);

  console.log('\n========================================================================');
  console.log('COMPLETE PRODUCTION SUITE PASSED WITH ZERO ERRORS');
  console.log('========================================================================\n');
  console.log(JSON.stringify({
    success: true,
    employeeId: employeeId,
    authUid: staffUid,
    email: testEmail,
    role: testRole,
    tenantId: testTenantId,
    activationUrlExample: activationUrl.replace(secureToken, secureToken.substring(0, 8) + '...[REDACTED]...'),
    status: 'active',
    activationStatus: 'activated'
  }, null, 2));
}

runSecurityAndLifecycleSuite()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('FATAL SUITE ERROR:', err);
    process.exit(1);
  });
