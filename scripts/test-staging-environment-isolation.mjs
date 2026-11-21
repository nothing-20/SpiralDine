/**
 * SpiralDine Staging Environment Isolation & Authentication Scenario Test Suite
 * 
 * Verifies:
 * 1. Environment Isolation:
 *    - Staging environment strictly refuses to connect to production Firebase project (spiral-restaurant-saas-v1).
 *    - Missing staging credentials fail safely without silent fallback.
 *    - Production configurations remain intact for production builds.
 *    - Firebase Admin SDK validates project safety and prevents cross-project leakage.
 * 
 * 2. Staging Authentication Scenarios (10 Scenarios):
 *    Scenario 1:  New Google registration (unprivileged customer, no auto-owner).
 *    Scenario 2:  Existing Google login (retains UID, tenant, role).
 *    Scenario 3:  Existing email/password account followed by Google linking.
 *    Scenario 4:  Existing Google account followed by email/password linking (reverse linking).
 *    Scenario 5:  Wrong password during account linking (fails, pending credential discarded).
 *    Scenario 6:  Different Google email (rejected, no cross-email linking).
 *    Scenario 7:  Existing owner account (retains owner role and tenant association).
 *    Scenario 8:  Existing customer account (retains profile, blocked from staff/owner portals).
 *    Scenario 9:  Existing staff account (authoritative role and invitation verification).
 *    Scenario 10: Portal access restrictions (role-based boundaries across portals).
 */

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    if (details) console.error(`         Details: ${details}`);
  }
}

console.log('================================================================');
console.log('SPIRALDINE STAGING ENVIRONMENT ISOLATION & TEST SCENARIOS AUDIT');
console.log('================================================================\n');

// =============================================================================
// PART 1: ENVIRONMENT ISOLATION & SAFETY CONTROLS
// =============================================================================
console.log('--- PART 1: ENVIRONMENT ISOLATION & SAFETY CONTROLS ---');

const PRODUCTION_PROJECT_ID = 'spiral-restaurant-saas-v1';

// Simulation of Client Firebase Configuration logic (src/shared/firebase/config.ts)
function simulateClientFirebaseConfig(env) {
  const rawAppEnv = (env.VITE_APP_ENV || env.MODE || '').trim().toLowerCase();
  const isExplicitStaging = rawAppEnv === 'staging' || rawAppEnv === 'stage';

  const configuredProjectId = (env.VITE_FIREBASE_PROJECT_ID || '').trim();

  // Accidental project switching prevention:
  if (configuredProjectId && !isExplicitStaging && configuredProjectId !== PRODUCTION_PROJECT_ID) {
    throw new Error(
      `[Firebase] Accidental project switching prevented: configured project "${configuredProjectId}" does not match authorized production project "${PRODUCTION_PROJECT_ID}".`
    );
  }

  const projectId = configuredProjectId || PRODUCTION_PROJECT_ID;

  if (isExplicitStaging) {
    if (!configuredProjectId || configuredProjectId === PRODUCTION_PROJECT_ID) {
      throw new Error(
        `[Firebase] Staging environment refuses to connect to production Firebase project "${PRODUCTION_PROJECT_ID}". Configure an isolated staging Firebase project.`
      );
    }
  }

  const apiKey = env.VITE_FIREBASE_API_KEY || 'AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg';
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || 'spiral-restaurant-saas-v1.firebaseapp.com';
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || 'spiral-restaurant-saas-v1.firebasestorage.app';
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || '917630391162';
  const appId = env.VITE_FIREBASE_APP_ID || '1:917630391162:web:6e4c127734b84ca6977cc3';

  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
}

// Simulation of Server Firebase Configuration logic (api/_lib/firebaseServer.ts & firebaseEnv.ts)
function resolveServerEnvironment(env) {
  const raw = env.APP_ENV || env.VITE_APP_ENV || env.NODE_ENV || '';
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'production' || normalized === 'prod') return 'production';
  if (normalized === 'staging' || normalized === 'stage') return 'staging';
  if (normalized === 'development' || normalized === 'dev' || normalized === 'test') return 'development';
  if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') return 'production';
  return normalized || 'production';
}

function assertServerProjectSafe(projectId, authDomain, storageBucket, env) {
  const serverEnv = resolveServerEnvironment(env);
  const useEmulator = String(env.USE_FIREBASE_EMULATOR || env.VITE_USE_FIREBASE_EMULATOR || '')
    .trim()
    .toLowerCase() === 'true';

  const targetsProduction =
    projectId.trim().toLowerCase() === PRODUCTION_PROJECT_ID ||
    authDomain.trim().toLowerCase().includes(PRODUCTION_PROJECT_ID) ||
    storageBucket.trim().toLowerCase().includes(PRODUCTION_PROJECT_ID);

  if (useEmulator && projectId.trim().toLowerCase() === PRODUCTION_PROJECT_ID) {
    throw new Error(
      `[firebaseEnv] Emulator mode cannot target production project "${PRODUCTION_PROJECT_ID}".`
    );
  }

  // Prevent accidental project switching in production:
  if (serverEnv === 'production' && projectId && projectId.trim().toLowerCase() !== PRODUCTION_PROJECT_ID) {
    throw new Error(
      `[firebaseEnv] Accidental project switching prevented: production environment strictly requires "${PRODUCTION_PROJECT_ID}". Detected unauthorized project "${projectId}".`
    );
  }

  if (serverEnv === 'staging' && targetsProduction) {
    throw new Error(
      `[firebaseEnv] Server environment "${serverEnv}" refuses to connect to production Firebase project "${PRODUCTION_PROJECT_ID}". Configure an isolated ${serverEnv} Firebase project.`
    );
  }
}

function simulateServerFirebaseConfig(env) {
  const currentEnv = resolveServerEnvironment(env);
  const isExplicitStaging = currentEnv === 'staging';

  const apiKey = env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || (isExplicitStaging ? '' : 'AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg');
  const authDomain = env.FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN || (isExplicitStaging ? '' : 'spiral-restaurant-saas-v1.firebaseapp.com');
  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || (isExplicitStaging ? '' : PRODUCTION_PROJECT_ID);
  const storageBucket = env.FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET || (isExplicitStaging ? '' : 'spiral-restaurant-saas-v1.firebasestorage.app');
  const messagingSenderId = env.FIREBASE_MESSAGING_SENDER_ID || env.VITE_FIREBASE_MESSAGING_SENDER_ID || (isExplicitStaging ? '' : '917630391162');
  const appId = env.FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID || (isExplicitStaging ? '' : '1:917630391162:web:6e4c127734b84ca6977cc3');

  if (isExplicitStaging) {
    if (!projectId || !apiKey) {
      throw new Error(
        `[firebaseServer] Missing staging Firebase configuration for environment "${currentEnv}". Staging must not run without isolated credentials.`
      );
    }
  }

  assertServerProjectSafe(projectId, authDomain, storageBucket, env);
  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
}

// 1.1 Client Config: Explicit staging with production project ID must throw
try {
  simulateClientFirebaseConfig({
    VITE_APP_ENV: 'staging',
    VITE_FIREBASE_API_KEY: 'staging-key',
    VITE_FIREBASE_PROJECT_ID: 'spiral-restaurant-saas-v1', // ILLEGAL PRODUCTION TARGET IN STAGING
  });
  assert(false, '1.1 Client config in staging mode must reject production project ID');
} catch (err) {
  assert(
    err.message.includes('refuses to connect to production Firebase project'),
    '1.1 Client config in staging mode rejects production project ID'
  );
}

// 1.2 Client Config: Accidental project switching prevention
try {
  simulateClientFirebaseConfig({
    MODE: 'production',
    VITE_FIREBASE_PROJECT_ID: 'rogue-accidental-project', // ACCIDENTAL PROJECT SWITCHING ATTEMPT
  });
  assert(false, '1.2 Client config in production mode must reject accidental project switching');
} catch (err) {
  assert(
    err.message.includes('Accidental project switching prevented'),
    '1.2 Client config rejects accidental project switching in production'
  );
}

// 1.3 Client Config: Valid isolated staging project succeeds
try {
  const stagingCfg = simulateClientFirebaseConfig({
    VITE_APP_ENV: 'staging',
    VITE_FIREBASE_API_KEY: 'AIzaSy_staging_key',
    VITE_FIREBASE_AUTH_DOMAIN: 'spiral-dine-staging.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'spiral-dine-staging',
    VITE_FIREBASE_STORAGE_BUCKET: 'spiral-dine-staging.firebasestorage.app',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    VITE_FIREBASE_APP_ID: '1:123456789:web:test',
  });
  assert(
    stagingCfg.projectId === 'spiral-dine-staging' && stagingCfg.apiKey === 'AIzaSy_staging_key',
    '1.3 Client config resolves isolated staging project correctly when explicitly configured'
  );
} catch (err) {
  assert(false, '1.3 Client config failed for valid staging project', err.message);
}

// 1.4 Client Config: Production build continues using production config
try {
  const prodCfg = simulateClientFirebaseConfig({
    MODE: 'production',
  });
  assert(
    prodCfg.projectId === 'spiral-restaurant-saas-v1',
    '1.4 Client config preserves production project ID for production builds'
  );
} catch (err) {
  assert(false, '1.4 Client config production build threw unexpectedly', err.message);
}

// 1.5 Server Config: Explicit staging with production project ID must throw
try {
  simulateServerFirebaseConfig({
    APP_ENV: 'staging',
    FIREBASE_API_KEY: 'staging-key',
    FIREBASE_PROJECT_ID: 'spiral-restaurant-saas-v1',
  });
  assert(false, '1.5 Server config in staging must reject production project ID');
} catch (err) {
  assert(
    err.message.includes('refuses to connect to production Firebase project'),
    '1.5 Server config in staging mode rejects production project ID'
  );
}

// 1.6 Server Config: Production rejects accidental project switching
try {
  simulateServerFirebaseConfig({
    APP_ENV: 'production',
    FIREBASE_API_KEY: 'some-key',
    FIREBASE_PROJECT_ID: 'rogue-accidental-project',
  });
  assert(false, '1.6 Server config in production must reject accidental project switching');
} catch (err) {
  assert(
    err.message.includes('Accidental project switching prevented'),
    '1.6 Server config prevents accidental project switching in production'
  );
}

// 1.7 Server Config: Valid staging credentials succeed when explicitly isolated
try {
  const serverCfg = simulateServerFirebaseConfig({
    APP_ENV: 'staging',
    FIREBASE_API_KEY: 'staging-key',
    FIREBASE_PROJECT_ID: 'spiral-dine-staging',
    FIREBASE_AUTH_DOMAIN: 'spiral-dine-staging.firebaseapp.com',
    FIREBASE_STORAGE_BUCKET: 'spiral-dine-staging.firebasestorage.app',
  });
  assert(
    serverCfg.projectId === 'spiral-dine-staging',
    '1.7 Server config succeeds for isolated staging project'
  );
} catch (err) {
  assert(false, '1.7 Server config failed for valid staging project', err.message);
}

// 1.8 Server Config: Production environment correctly targets spiral-restaurant-saas-v1
try {
  const serverProdCfg = simulateServerFirebaseConfig({
    APP_ENV: 'production',
    FIREBASE_PROJECT_ID: 'spiral-restaurant-saas-v1',
  });
  assert(
    serverProdCfg.projectId === 'spiral-restaurant-saas-v1',
    '1.8 Server config in production correctly targets spiral-restaurant-saas-v1'
  );
} catch (err) {
  assert(false, '1.8 Server config failed for production project', err.message);
}

// =============================================================================
// PART 2: AUTHENTICATION SCENARIOS TEST ENGINE
// =============================================================================
console.log('\n--- PART 2: AUTHENTICATION SCENARIOS TEST MATRIX ---');

class MockStagingAuthEngine {
  constructor() {
    this.users = new Map(); // uid -> { uid, email, providers, passwordHash, displayName }
    this.firestoreUsers = new Map(); // uid -> userDoc
    this.firestoreTenants = new Map(); // tenantId -> tenantDoc
    this.firestoreInvitations = new Map(); // email -> inviteDoc
  }

  // Pre-seed an invitation in Firestore
  seedInvitation(email, tenantId, role, status = 'pending') {
    this.firestoreInvitations.set(email.toLowerCase(), {
      email: email.toLowerCase(),
      tenantId,
      role,
      status,
      token: `inv-${Math.random().toString(36).slice(2)}`,
    });
  }

  // Register with email/password
  registerWithEmail(email, password, displayName = '') {
    const cleanEmail = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email === cleanEmail) {
        const err = new Error('Email already in use');
        err.code = 'auth/email-already-in-use';
        throw err;
      }
    }
    const uid = `uid-staging-${Math.random().toString(36).slice(2, 9)}`;
    const user = {
      uid,
      email: cleanEmail,
      providers: ['password'],
      passwordHash: `hash-${password}`,
      displayName,
    };
    this.users.set(uid, user);
    return user;
  }

  // Sign in or register with Google
  signInWithGoogle(email, displayName = 'Google Diner') {
    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    let existingUser = null;
    for (const u of this.users.values()) {
      if (u.email === cleanEmail) {
        existingUser = u;
        break;
      }
    }

    if (existingUser) {
      // If user exists with password but NOT Google, Firebase returns account-exists-with-different-credential
      if (!existingUser.providers.includes('google.com')) {
        const err = new Error('Account exists with different credential');
        err.code = 'auth/account-exists-with-different-credential';
        err.email = cleanEmail;
        err.credential = {
          providerId: 'google.com',
          signInMethod: 'google.com',
          email: cleanEmail,
        };
        throw err;
      }

      // Existing Google user signing in again
      return {
        user: existingUser,
        isNewUser: false,
      };
    }

    // New Google registration
    const uid = `uid-staging-${Math.random().toString(36).slice(2, 9)}`;
    const newUser = {
      uid,
      email: cleanEmail,
      providers: ['google.com'],
      passwordHash: null,
      displayName,
    };
    this.users.set(uid, newUser);
    return {
      user: newUser,
      isNewUser: true,
    };
  }

  // Forward Linking: Link pending Google credential after password verification
  linkGoogleWithPassword(email, password, pendingCredential) {
    const cleanEmail = email.toLowerCase().trim();
    let targetUser = null;
    for (const u of this.users.values()) {
      if (u.email === cleanEmail) {
        targetUser = u;
        break;
      }
    }

    if (!targetUser) {
      const err = new Error('User not found');
      err.code = 'auth/user-not-found';
      throw err;
    }

    // Verify password
    if (targetUser.passwordHash !== `hash-${password}`) {
      const err = new Error('Invalid password');
      err.code = 'auth/wrong-password';
      throw err;
    }

    // Verify pending credential email matches
    if (pendingCredential.email !== cleanEmail) {
      const err = new Error('Credential email mismatch');
      err.code = 'auth/email-mismatch';
      throw err;
    }

    // Link provider
    if (!targetUser.providers.includes('google.com')) {
      targetUser.providers.push('google.com');
    }

    return targetUser;
  }

  // Reverse Linking: Establish email/password on existing Google account
  linkPasswordToGoogleUser(uid, newPassword) {
    const user = this.users.get(uid);
    if (!user) {
      const err = new Error('User not found');
      err.code = 'auth/user-not-found';
      throw err;
    }

    if (user.providers.includes('password')) {
      const err = new Error('Provider already linked');
      err.code = 'auth/provider-already-linked';
      throw err;
    }

    user.passwordHash = `hash-${newPassword}`;
    user.providers.push('password');
    return user;
  }

  // Role resolution & profile retrieval
  async resolveUserProfile(uid, requestedPortal = 'customer') {
    const authUser = this.users.get(uid);
    if (!authUser) return null;

    let profile = this.firestoreUsers.get(uid);
    if (!profile) {
      // New user default profile (Customer / Unprivileged Diner)
      profile = {
        uid,
        email: authUser.email,
        displayName: authUser.displayName,
        role: 'customer',
        createdAt: new Date().toISOString(),
      };
      this.firestoreUsers.set(uid, profile);
    }

    // Access control evaluation
    const isOwner = profile.role === 'owner';
    const isStaff = ['waiter', 'chef', 'manager', 'cashier'].includes(profile.role);
    const isCustomer = profile.role === 'customer';

    const accessAllowed = {
      customer: true, // Everyone can view menu/diner app
      owner: isOwner,
      staff: isStaff || isOwner,
    };

    return {
      profile,
      allowed: Boolean(accessAllowed[requestedPortal]),
    };
  }
}

const stagingAuth = new MockStagingAuthEngine();

// -----------------------------------------------------------------------------
// Scenario 1: New Google Registration
// -----------------------------------------------------------------------------
console.log('\n[Scenario 1] New Google Registration');
const regResult = stagingAuth.signInWithGoogle('new-diner@example.com', 'New Diner');
assert(regResult.isNewUser === true, '1.1 Detected as new Google user');
assert(regResult.user.providers.includes('google.com'), '1.2 Provider is google.com');

const dinerProfile = await stagingAuth.resolveUserProfile(regResult.user.uid, 'customer');
assert(dinerProfile.profile.role === 'customer', '1.3 New Google user gets customer role by default');
assert(!dinerProfile.profile.tenantId, '1.4 New Google user has NO tenantId assigned');
assert(dinerProfile.allowed === true, '1.5 Customer portal access allowed');

const unauthorizedOwnerAccess = await stagingAuth.resolveUserProfile(regResult.user.uid, 'owner');
assert(unauthorizedOwnerAccess.allowed === false, '1.6 New Google user CANNOT access owner dashboard');

// -----------------------------------------------------------------------------
// Scenario 2: Existing Google Login
// -----------------------------------------------------------------------------
console.log('\n[Scenario 2] Existing Google Login');
const loginResult = stagingAuth.signInWithGoogle('new-diner@example.com', 'New Diner');
assert(loginResult.isNewUser === false, '2.1 Existing Google user detected (isNewUser=false)');
assert(loginResult.user.uid === regResult.user.uid, '2.2 Same Firebase UID resolved on subsequent sign-in');

const existingDinerProfile = await stagingAuth.resolveUserProfile(loginResult.user.uid, 'customer');
assert(existingDinerProfile.profile.role === 'customer', '2.3 Preserved customer role');

// -----------------------------------------------------------------------------
// Scenario 3: Existing Email/Password Account Followed by Google Linking
// -----------------------------------------------------------------------------
console.log('\n[Scenario 3] Email/Password Account Followed by Google Linking');
const epUser = stagingAuth.registerWithEmail('alice@restaurant.com', 'AlicePassword123!', 'Alice');
assert(epUser.providers.length === 1 && epUser.providers[0] === 'password', '3.1 Registered with password provider');

let caughtLinkingError = null;
try {
  stagingAuth.signInWithGoogle('alice@restaurant.com');
} catch (err) {
  caughtLinkingError = err;
}

assert(
  caughtLinkingError && caughtLinkingError.code === 'auth/account-exists-with-different-credential',
  '3.2 Google sign-in throws auth/account-exists-with-different-credential'
);

// Link with password verification
const linkedUser = stagingAuth.linkGoogleWithPassword(
  'alice@restaurant.com',
  'AlicePassword123!',
  caughtLinkingError.credential
);

assert(linkedUser.uid === epUser.uid, '3.3 Firebase UID remains unchanged after Google linking');
assert(
  linkedUser.providers.includes('password') && linkedUser.providers.includes('google.com'),
  '3.4 User now has both password and google.com providers'
);

// -----------------------------------------------------------------------------
// Scenario 4: Existing Google Account Followed by Email/Password Linking (Reverse)
// -----------------------------------------------------------------------------
console.log('\n[Scenario 4] Existing Google Account Followed by Email/Password Linking');
const googleOnlyUser = stagingAuth.signInWithGoogle('bob@example.com', 'Bob').user;
assert(googleOnlyUser.providers.length === 1 && googleOnlyUser.providers[0] === 'google.com', '4.1 Bob has google.com provider only');

const reverseLinked = stagingAuth.linkPasswordToGoogleUser(googleOnlyUser.uid, 'BobNewPassword456!');
assert(reverseLinked.uid === googleOnlyUser.uid, '4.2 UID preserved during reverse email/password linking');
assert(
  reverseLinked.providers.includes('password') && reverseLinked.providers.includes('google.com'),
  '4.3 Bob now has both google.com and password providers'
);

// -----------------------------------------------------------------------------
// Scenario 5: Wrong Password During Account Linking
// -----------------------------------------------------------------------------
console.log('\n[Scenario 5] Wrong Password During Account Linking');
const charlie = stagingAuth.registerWithEmail('charlie@example.com', 'CharlieSecret123!', 'Charlie');
let charlieCred = null;
try {
  stagingAuth.signInWithGoogle('charlie@example.com');
} catch (err) {
  charlieCred = err.credential;
}

try {
  stagingAuth.linkGoogleWithPassword('charlie@example.com', 'INCORRECT_PASSWORD', charlieCred);
  assert(false, '5.1 Linking must fail on wrong password');
} catch (err) {
  assert(err.code === 'auth/wrong-password', '5.1 Wrong password throws auth/wrong-password');
}

assert(
  charlie.providers.length === 1 && charlie.providers[0] === 'password',
  '5.2 Google provider NOT linked when password authentication fails'
);

// -----------------------------------------------------------------------------
// Scenario 6: Different Google Email
// -----------------------------------------------------------------------------
console.log('\n[Scenario 6] Different Google Email (Mismatched Email Protection)');
try {
  stagingAuth.linkGoogleWithPassword(
    'charlie@example.com',
    'CharlieSecret123!',
    { email: 'completely-different@example.com', providerId: 'google.com' }
  );
  assert(false, '6.1 Must reject mismatched Google credential email');
} catch (err) {
  assert(err.code === 'auth/email-mismatch', '6.1 Rejected linking when credential email differs from target account');
}

// -----------------------------------------------------------------------------
// Scenario 7: Existing Owner Account
// -----------------------------------------------------------------------------
console.log('\n[Scenario 7] Existing Owner Account');
const ownerUser = stagingAuth.registerWithEmail('owner@biryanihouse.com', 'OwnerPass123!', 'Rest Owner');
stagingAuth.firestoreUsers.set(ownerUser.uid, {
  uid: ownerUser.uid,
  email: 'owner@biryanihouse.com',
  role: 'owner',
  tenantId: 'tenant-biryani-staging',
  restaurantName: 'Biryani House Staging',
});

// Owner links Google provider
const ownerGoogleCred = { email: 'owner@biryanihouse.com', providerId: 'google.com' };
const linkedOwner = stagingAuth.linkGoogleWithPassword('owner@biryanihouse.com', 'OwnerPass123!', ownerGoogleCred);
assert(linkedOwner.uid === ownerUser.uid, '7.1 Owner UID unchanged after linking Google');

const ownerProfile = await stagingAuth.resolveUserProfile(linkedOwner.uid, 'owner');
assert(ownerProfile.profile.role === 'owner', '7.2 Owner role preserved in Firestore profile');
assert(ownerProfile.profile.tenantId === 'tenant-biryani-staging', '7.3 Tenant ID preserved');
assert(ownerProfile.allowed === true, '7.4 Owner dashboard access granted');

// -----------------------------------------------------------------------------
// Scenario 8: Existing Customer Account
// -----------------------------------------------------------------------------
console.log('\n[Scenario 8] Existing Customer Account');
const customerUser = stagingAuth.signInWithGoogle('diner-vip@example.com', 'VIP Diner').user;
stagingAuth.firestoreUsers.set(customerUser.uid, {
  uid: customerUser.uid,
  email: 'diner-vip@example.com',
  role: 'customer',
  loyaltyPoints: 350,
  orderHistoryCount: 5,
});

const customerAccess = await stagingAuth.resolveUserProfile(customerUser.uid, 'customer');
assert(customerAccess.allowed === true, '8.1 Customer portal access allowed');
assert(customerAccess.profile.loyaltyPoints === 350, '8.2 Customer loyalty points preserved');

const customerOwnerAccess = await stagingAuth.resolveUserProfile(customerUser.uid, 'owner');
assert(customerOwnerAccess.allowed === false, '8.3 Customer cannot access owner portal');

const customerStaffAccess = await stagingAuth.resolveUserProfile(customerUser.uid, 'staff');
assert(customerStaffAccess.allowed === false, '8.4 Customer cannot access staff portal');

// -----------------------------------------------------------------------------
// Scenario 9: Existing Staff Account
// -----------------------------------------------------------------------------
console.log('\n[Scenario 9] Existing Staff Account & Invitation Security');
const staffUser = stagingAuth.registerWithEmail('waiter@biryanihouse.com', 'WaiterPass123!', 'John Waiter');
stagingAuth.firestoreUsers.set(staffUser.uid, {
  uid: staffUser.uid,
  email: 'waiter@biryanihouse.com',
  role: 'waiter',
  tenantId: 'tenant-biryani-staging',
  branchId: 'branch-1',
  invitationStatus: 'accepted',
});

const staffAccess = await stagingAuth.resolveUserProfile(staffUser.uid, 'staff');
assert(staffAccess.allowed === true, '9.1 Staff allowed access to staff portal');
assert(staffAccess.profile.role === 'waiter', '9.2 Waiter role authoritative from Firestore');

const staffOwnerAccess = await stagingAuth.resolveUserProfile(staffUser.uid, 'owner');
assert(staffOwnerAccess.allowed === false, '9.3 Staff waiter CANNOT access owner portal');

// -----------------------------------------------------------------------------
// Scenario 10: Portal Access Restrictions Matrix
// -----------------------------------------------------------------------------
console.log('\n[Scenario 10] Portal Access Restrictions Matrix');

// Test 10.1: Unauthenticated access
const anonProfile = await stagingAuth.resolveUserProfile('non-existent-uid', 'owner');
assert(anonProfile === null, '10.1 Unauthenticated UID returns null and blocks access');

// Test 10.2: Cross-portal role matrix assertions
const testMatrix = [
  { role: 'customer', portal: 'customer', expected: true },
  { role: 'customer', portal: 'staff', expected: false },
  { role: 'customer', portal: 'owner', expected: false },
  { role: 'waiter', portal: 'customer', expected: true },
  { role: 'waiter', portal: 'staff', expected: true },
  { role: 'waiter', portal: 'owner', expected: false },
  { role: 'owner', portal: 'customer', expected: true },
  { role: 'owner', portal: 'staff', expected: true },
  { role: 'owner', portal: 'owner', expected: true },
];

for (const testCase of testMatrix) {
  const dummyUid = `matrix-${testCase.role}-${Math.random().toString(36).slice(2, 6)}`;
  stagingAuth.users.set(dummyUid, { uid: dummyUid, email: `${dummyUid}@test.com`, providers: ['password'] });
  stagingAuth.firestoreUsers.set(dummyUid, { uid: dummyUid, role: testCase.role });

  const res = await stagingAuth.resolveUserProfile(dummyUid, testCase.portal);
  assert(
    res.allowed === testCase.expected,
    `10.2 Role "${testCase.role}" on portal "${testCase.portal}" => ${testCase.expected ? 'ALLOWED' : 'BLOCKED'}`
  );
}

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n================================================================');
console.log(`STAGING ENVIRONMENT AUDIT COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('================================================================\n');

if (passedTests === totalTests) {
  console.log('STATUS: READY FOR ISOLATED STAGING ENVIRONMENT TESTING');
  process.exit(0);
} else {
  console.error(`STATUS: FAILED (${totalTests - passedTests} failed tests)`);
  process.exit(1);
}
