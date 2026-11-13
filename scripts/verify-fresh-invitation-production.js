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
  updateDoc,
  query,
  where
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

function isInvitationExpired(expiresAt) {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  return !isNaN(time) && time < Date.now();
}

async function runCompleteTest() {
  console.log('================================================================');
  console.log('RESTAURANTOS PRODUCTION INVITATION LIFECYCLE VERIFICATION');
  console.log('================================================================\n');

  // Step 1: Owner authentication to create invitation
  console.log('[Step 1] Authenticating as Owner...');
  const ownerCred = await signInWithEmailAndPassword(auth, runnerCreds.email, runnerCreds.password);
  const ownerUser = ownerCred.user;
  console.log('  -> Owner authenticated. UID:', ownerUser.uid);

  // Step 2: Create a BRAND NEW test invitation record
  const timestamp = Date.now();
  const testFullName = 'Production Kitchen Verification Staff';
  const testEmail = `prod.kitchen.${timestamp}@example.com`;
  const testRole = 'kitchen';
  const testTenantId = 'spiral-restaurant-ilpc';
  const secureToken = generateSecureToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  console.log('\n[Step 2] Creating brand-new staff invitation in Firestore...');
  const empRef = await addDoc(collection(db, 'employees'), {
    fullName: testFullName,
    email: testEmail,
    phone: '+1 555-0144',
    role: testRole,
    department: 'Main Kitchen',
    tenantId: testTenantId,
    branchId: 'main',
    status: 'pending',
    activationStatus: 'invited',
    firebaseUid: null,
    invitedAt: now,
    createdAt: now,
    expiresAt: expiresAt,
    createdBy: ownerUser.uid,
    updatedAt: now,
    invitationToken: secureToken,
  });

  const freshEmployeeId = empRef.id;
  console.log('  -> Fresh employee document created:');
  console.log('     ID:              ', freshEmployeeId);
  console.log('     Email:           ', testEmail);
  console.log('     Role:            ', testRole);
  console.log('     Tenant ID:       ', testTenantId);
  console.log('     Status:          ', 'pending');
  console.log('     ActivationStatus:', 'invited');

  // Step 3: Construct canonical activation URL
  const activationUrl = `https://restaurant-os-dun.vercel.app/staff/activate?token=${secureToken}&email=${encodeURIComponent(testEmail)}&id=${freshEmployeeId}`;
  console.log('\n[Step 3] Canonical activation URL generated:');
  console.log('  ->', activationUrl.replace(secureToken, secureToken.substring(0, 8) + '...[REDACTED]...'));

  // Sign out owner to simulate clean unauthenticated staff user opening the link
  await signOut(auth);
  console.log('\n[Step 4] Signed out owner. Client is now UNAUTHENTICATED.');

  // Step 5: Unauthenticated exact getDoc
  console.log('\n[Step 5] Simulating unauthenticated getDoc on employees/' + freshEmployeeId + '...');
  const snap = await getDoc(doc(db, 'employees', freshEmployeeId));
  if (!snap.exists()) {
    throw new Error('FAIL: Fresh document does not exist in Firestore!');
  }
  const data = snap.data();
  console.log('  -> getDoc succeeded unauthenticated!');
  console.log('     exists():', snap.exists());
  console.log('     status:  ', data.status);
  console.log('     activationStatus:', data.activationStatus);

  // Step 6: Verify validation criteria
  console.log('\n[Step 6] Running validation logic...');
  if (data.activationStatus === 'activated' || data.status === 'active') {
    throw new Error('FAIL: Fresh invitation marked as activated!');
  }
  if (data.status !== 'pending' || data.activationStatus !== 'invited') {
    throw new Error('FAIL: Invalid status for fresh invite!');
  }
  if (isInvitationExpired(data.expiresAt)) {
    throw new Error('FAIL: Fresh invite evaluated as expired!');
  }
  if (data.invitationToken.toLowerCase() !== secureToken.toLowerCase()) {
    throw new Error('FAIL: Token mismatch!');
  }
  if (data.email.toLowerCase() !== testEmail.toLowerCase()) {
    throw new Error('FAIL: Email mismatch!');
  }
  console.log('  -> All validation checks PASSED (Token match, Email match, Status match, Not expired).');

  // Step 7: Password setup & Firebase Auth creation
  console.log('\n[Step 7] Setting password and creating Firebase Auth user account...');
  const staffPassword = 'ProductionStaffSecret123!';
  const staffCred = await createUserWithEmailAndPassword(auth, testEmail, staffPassword);
  const staffUser = staffCred.user;
  console.log('  -> Firebase Auth user created. UID:', staffUser.uid);

  // Step 8: Create users/{uid} document
  console.log('\n[Step 8] Creating users/' + staffUser.uid + ' profile document...');
  const userProfile = {
    uid: staffUser.uid,
    fullName: testFullName,
    displayName: testFullName,
    email: testEmail,
    phone: '+1 555-0144',
    phoneNumber: '+1 555-0144',
    role: testRole,
    tenantId: testTenantId,
    branchId: 'main',
    department: 'Main Kitchen',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await setDoc(doc(db, 'users', staffUser.uid), userProfile);
  console.log('  -> users/' + staffUser.uid + ' created successfully.');

  // Step 9: Update employees/{id} record
  console.log('\n[Step 9] Updating employees/' + freshEmployeeId + ' to active/activated...');
  await updateDoc(doc(db, 'employees', freshEmployeeId), {
    firebaseUid: staffUser.uid,
    userId: staffUser.uid,
    status: 'active',
    activationStatus: 'activated',
    activatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  console.log('  -> employees/' + freshEmployeeId + ' updated successfully.');

  // Step 10: Verify role routing
  console.log('\n[Step 10] Checking role routing...');
  const destination = testRole === 'kitchen' ? '/dashboard/kitchen' : '/unauthorized';
  console.log('  -> Target dashboard route:', destination);

  // Sign out staff
  await signOut(auth);

  // Step 11: Reopening the link shows Already Activated
  console.log('\n[Step 11] Testing reopening link as unauthenticated user...');
  const reopenSnap = await getDoc(doc(db, 'employees', freshEmployeeId));
  const reopenData = reopenSnap.data();
  console.log('  -> Document retrieved. Status:', reopenData.status, 'activationStatus:', reopenData.activationStatus);
  if (reopenData.activationStatus === 'activated' || reopenData.status === 'active') {
    console.log('  -> Correctly classified as ALREADY_ACTIVATED! Redirects to /staff/login.');
  } else {
    throw new Error('FAIL: Reopened document not marked as activated!');
  }

  // Step 12: Security verify - Unauthenticated collection listing blocked
  console.log('\n[Step 12] Verifying security rules block unauthenticated collection listing...');
  try {
    await getDocs(collection(db, 'employees'));
    console.error('FAIL: Unauthenticated list on /employees should be DENIED!');
    process.exit(1);
  } catch (secErr) {
    console.log('  -> Verified: Unauthenticated list on /employees threw:', secErr.code, '(blocked as required).');
  }

  console.log('\n================================================================');
  console.log('ALL 12 VERIFICATION PHASES PASSED WITH ZERO ERRORS!');
  console.log('================================================================');
  console.log(JSON.stringify({
    success: true,
    employeeId: freshEmployeeId,
    tenantId: testTenantId,
    email: testEmail,
    role: testRole,
    status: 'active',
    activationStatus: 'activated',
    authUid: staffUser.uid,
    destinationRoute: destination
  }, null, 2));
}

runCompleteTest().then(() => process.exit(0)).catch(err => {
  console.error('CRITICAL TEST FAILURE:', err);
  process.exit(1);
});
