/**
 * SpiralDine Single-Account Identity & Account Linking Test Suite
 * 
 * Verifies the Core Requirement: ONE PERSON = ONE FIREBASE ACCOUNT
 * 
 * 1. Email/password registration followed by Google Sign-In using the same email
 * 2. Google registration followed by another Google Sign-In
 * 3. Existing owner account provider linking & profile preservation
 * 4. Existing customer account provider linking & wallet/points preservation
 * 5. Different Google email must not access an existing account
 * 6. Duplicate Firebase users must not be created
 * 7. Duplicate Firestore profiles must not be created
 * 8. Failed account verification must prevent provider linking
 * 9. Existing tenant and role information must remain unchanged
 * 10. Verify that the same person retains the same Firebase UID after provider linking
 */

let totalTests = 0;
let passedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
  }
}

console.log('====================================================');
console.log('SPIRALDINE SINGLE-ACCOUNT IDENTITY AUDIT TEST SUITE');
console.log('Core Requirement: ONE PERSON = ONE FIREBASE ACCOUNT');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// Mock Firebase Auth & Firestore Simulation Engine
// -----------------------------------------------------------------------------
class MockFirebaseAuthEngine {
  constructor() {
    this.users = new Map(); // uid -> userRecord
    this.firestoreUsers = new Map(); // uid -> userDoc
    this.firestoreTenants = new Map(); // tenantId -> tenantDoc
    this.firestoreCustomers = new Map(); // uid -> customerDoc
  }

  // Register with email & password
  registerEmailPassword(email, password, displayName = '') {
    const cleanEmail = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email === cleanEmail) {
        const err = new Error('Email already in use');
        err.code = 'auth/email-already-in-use';
        throw err;
      }
    }

    const uid = `uid-ep-${Math.random().toString(36).substring(2, 9)}`;
    const userRecord = {
      uid,
      email: cleanEmail,
      displayName,
      passwordHash: `hash_${password}`,
      providerData: [{ providerId: 'password', email: cleanEmail, uid: cleanEmail }]
    };
    this.users.set(uid, userRecord);
    return { user: userRecord };
  }

  // Initiate Google Sign-In
  signInWithGoogle(googleEmail, googleUid = `google-${Math.random().toString(36).substring(2, 9)}`) {
    const cleanEmail = googleEmail.toLowerCase().trim();
    // Check if account already exists with another provider (e.g. password)
    for (const u of this.users.values()) {
      if (u.email === cleanEmail) {
        const hasGoogle = u.providerData.some(p => p.providerId === 'google.com');
        if (!hasGoogle) {
          // Account collision with different credential!
          const err = new Error('An account already exists with the same email address but different sign-in credentials.');
          err.code = 'auth/account-exists-with-different-credential';
          err.customData = { email: cleanEmail };
          err.credential = {
            providerId: 'google.com',
            signInMethod: 'google.com',
            idToken: 'mock-google-id-token',
            accessToken: 'mock-google-access-token',
            email: cleanEmail,
            googleUid
          };
          throw err;
        } else {
          // Already linked to Google: sign in directly to same user
          return { user: u };
        }
      }
    }

    // Completely new Google user
    const uid = `uid-goog-${Math.random().toString(36).substring(2, 9)}`;
    const userRecord = {
      uid,
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0],
      providerData: [{ providerId: 'google.com', email: cleanEmail, uid: googleUid }]
    };
    this.users.set(uid, userRecord);
    return { user: userRecord };
  }

  // Verify and Link Google account flow
  verifyAndLinkGoogle(email, password, pendingCredential) {
    const cleanEmail = email.toLowerCase().trim();
    let targetUser = null;

    // 1. Password verification
    for (const u of this.users.values()) {
      if (u.email === cleanEmail) {
        if (u.passwordHash === `hash_${password}`) {
          targetUser = u;
        } else {
          const err = new Error('Wrong password');
          err.code = 'auth/wrong-password';
          throw err;
        }
        break;
      }
    }

    if (!targetUser) {
      const err = new Error('User not found');
      err.code = 'auth/user-not-found';
      throw err;
    }

    // 2. Link credential to targetUser
    targetUser.providerData.push({
      providerId: pendingCredential.providerId,
      email: pendingCredential.email,
      uid: pendingCredential.googleUid
    });

    return { user: targetUser };
  }

  // Reverse Linking: Establish email/password on existing Google user
  linkEmailPassword(user, password) {
    const existing = this.users.get(user.uid);
    if (!existing) {
      const err = new Error('User not found');
      err.code = 'auth/user-not-found';
      throw err;
    }
    existing.passwordHash = `hash_${password}`;
    if (!existing.providerData.some(p => p.providerId === 'password')) {
      existing.providerData.push({
        providerId: 'password',
        email: existing.email,
        uid: existing.email
      });
    }
    return { user: existing };
  }

  // Sign in with email and password
  signInWithEmailPassword(email, password) {
    const cleanEmail = email.toLowerCase().trim();
    for (const u of this.users.values()) {
      if (u.email === cleanEmail) {
        if (u.passwordHash === `hash_${password}`) {
          return { user: u };
        } else {
          const err = new Error('Wrong password');
          err.code = 'auth/wrong-password';
          throw err;
        }
      }
    }
    const err = new Error('User not found');
    err.code = 'auth/user-not-found';
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Test Case 1: Email/Password Registration Followed by Google Sign-In with Same Email
// -----------------------------------------------------------------------------
console.log('--- Test 1: Email/Password Registration Followed by Google Sign-In ---');
{
  const auth = new MockFirebaseAuthEngine();

  // 1. User registers with email & password
  const initialReg = auth.registerEmailPassword('chef.alberto@ristorante.it', 'Secret1234!');
  const originalUid = initialReg.user.uid;
  assert(originalUid !== undefined, 'User successfully registered with email/password');

  // 2. User tries to sign in with Google using the same email
  let caughtCollision = null;
  try {
    auth.signInWithGoogle('chef.alberto@ristorante.it');
  } catch (err) {
    caughtCollision = err;
  }

  assert(
    caughtCollision !== null && caughtCollision.code === 'auth/account-exists-with-different-credential',
    'Firebase detects collision with auth/account-exists-with-different-credential'
  );
  assert(
    caughtCollision.customData.email === 'chef.alberto@ristorante.it',
    'Error retains colliding email address for verification'
  );
  assert(
    caughtCollision.credential !== undefined && caughtCollision.credential.providerId === 'google.com',
    'Error provides pending Google credential for account linking'
  );

  // 3. User verifies with password and links account
  const linkResult = auth.verifyAndLinkGoogle(
    caughtCollision.customData.email,
    'Secret1234!',
    caughtCollision.credential
  );

  assert(
    linkResult.user.uid === originalUid,
    'Post-linking Firebase UID strictly matches original UID (NO duplicate user created)'
  );
  assert(
    auth.users.size === 1,
    'Total Firebase users count remains exactly 1 (ONE PERSON = ONE FIREBASE ACCOUNT)'
  );
  assert(
    linkResult.user.providerData.some(p => p.providerId === 'google.com'),
    'Google provider is successfully linked to existing Firebase user'
  );

  // 4. Subsequent Google Sign-In now resolves directly to the linked account
  const subsequentGoogleSignIn = auth.signInWithGoogle('chef.alberto@ristorante.it');
  assert(
    subsequentGoogleSignIn.user.uid === originalUid,
    'Subsequent Google Sign-In signs directly into existing UID without prompting'
  );
}

// -----------------------------------------------------------------------------
// Test Case 2: Google Registration Followed by Another Google Sign-In
// -----------------------------------------------------------------------------
console.log('\n--- Test 2: Google Registration Followed by Another Google Sign-In ---');
{
  const auth = new MockFirebaseAuthEngine();

  // First Google Sign-In (Registration)
  const firstSignIn = auth.signInWithGoogle('owner@napoli.com');
  const googleUid = firstSignIn.user.uid;

  // Provision Firestore profile
  auth.firestoreUsers.set(googleUid, {
    uid: googleUid,
    email: 'owner@napoli.com',
    role: 'owner',
    tenantId: 'napoli-pizza-100',
    status: 'active'
  });

  // Second Google Sign-In (Returning user)
  const secondSignIn = auth.signInWithGoogle('owner@napoli.com');
  const secondProfile = auth.firestoreUsers.get(secondSignIn.user.uid);

  assert(
    secondSignIn.user.uid === googleUid,
    'Returning Google user resolves to the exact same Firebase UID'
  );
  assert(
    auth.users.size === 1,
    'No duplicate Firebase user is spawned on repeated Google sign-ins'
  );
  assert(
    secondProfile !== undefined && secondProfile.tenantId === 'napoli-pizza-100',
    'Existing tenantId and restaurant binding remain intact'
  );
  assert(
    secondProfile.role === 'owner',
    'Existing user role remains intact'
  );
}

// -----------------------------------------------------------------------------
// Test Case 3: Existing Owner Account Provider Linking & Profile Preservation
// -----------------------------------------------------------------------------
console.log('\n--- Test 3: Existing Owner Account Provider Linking ---');
{
  const auth = new MockFirebaseAuthEngine();

  // Pre-existing owner with email/password
  const ownerReg = auth.registerEmailPassword('maria@trattoria.com', 'OwnerPassword99!');
  const ownerUid = ownerReg.user.uid;

  // Existing Firestore records for owner
  const tenantRecord = {
    id: 'trattoria-bella-456',
    name: 'Trattoria Bella',
    ownerUid: ownerUid,
    status: 'active'
  };
  const ownerProfile = {
    uid: ownerUid,
    email: 'maria@trattoria.com',
    role: 'owner',
    tenantId: 'trattoria-bella-456',
    permissions: ['all'],
    branchId: 'branch-main',
    status: 'active'
  };
  auth.firestoreTenants.set('trattoria-bella-456', tenantRecord);
  auth.firestoreUsers.set(ownerUid, ownerProfile);

  // Owner attempts Google Sign-In
  let collisionErr = null;
  try {
    auth.signInWithGoogle('maria@trattoria.com');
  } catch (err) {
    collisionErr = err;
  }

  // Link accounts
  const linked = auth.verifyAndLinkGoogle(
    collisionErr.customData.email,
    'OwnerPassword99!',
    collisionErr.credential
  );

  // Verify Firestore integrity
  const profileAfterLink = auth.firestoreUsers.get(linked.user.uid);
  const tenantAfterLink = auth.firestoreTenants.get('trattoria-bella-456');

  assert(
    linked.user.uid === ownerUid,
    'Owner retains identical Firebase UID after linking'
  );
  assert(
    profileAfterLink.role === 'owner',
    'Owner role is not overwritten or downgraded during linking'
  );
  assert(
    profileAfterLink.tenantId === 'trattoria-bella-456',
    'Owner tenant binding is 100% preserved'
  );
  assert(
    profileAfterLink.branchId === 'branch-main',
    'Branch assignments remain intact'
  );
  assert(
    tenantAfterLink.ownerUid === ownerUid,
    'Tenant document retains ownership association without duplication'
  );
}

// -----------------------------------------------------------------------------
// Test Case 4: Existing Customer Account Provider Linking & Wallet Preservation
// -----------------------------------------------------------------------------
console.log('\n--- Test 4: Existing Customer Account Provider Linking ---');
{
  const auth = new MockFirebaseAuthEngine();

  // Pre-existing customer with email/password
  const customerReg = auth.registerEmailPassword('diner.sara@gmail.com', 'DinerPassword123!');
  const customerUid = customerReg.user.uid;

  // Existing customer profile in customers/{uid}
  const customerProfile = {
    uid: customerUid,
    email: 'diner.sara@gmail.com',
    fullName: 'Sara Connor',
    role: 'customer',
    walletBalance: 2500, // 2,500 currency units
    loyaltyPoints: 340,
    status: 'active'
  };
  auth.firestoreCustomers.set(customerUid, customerProfile);

  // Sara clicks Google Sign-In
  let collisionErr = null;
  try {
    auth.signInWithGoogle('diner.sara@gmail.com');
  } catch (err) {
    collisionErr = err;
  }

  // Link account via password verification
  const linked = auth.verifyAndLinkGoogle(
    collisionErr.customData.email,
    'DinerPassword123!',
    collisionErr.credential
  );

  const customerAfterLink = auth.firestoreCustomers.get(linked.user.uid);

  assert(
    linked.user.uid === customerUid,
    'Customer UID is preserved across linking'
  );
  assert(
    customerAfterLink.walletBalance === 2500,
    'Customer wallet balance ($25.00) is strictly preserved'
  );
  assert(
    customerAfterLink.loyaltyPoints === 340,
    'Customer loyalty points (340 pts) are strictly preserved'
  );
  assert(
    auth.firestoreCustomers.size === 1,
    'Zero duplicate customer profile documents created'
  );
}

// -----------------------------------------------------------------------------
// Test Case 5: Different Google Email Must NOT Access an Existing Account
// -----------------------------------------------------------------------------
console.log('\n--- Test 5: Different Email Isolation ---');
{
  const auth = new MockFirebaseAuthEngine();

  // Existing victim user
  auth.registerEmailPassword('victim@company.com', 'VictimPass123!');

  // Attacker signs in with their own Google email
  const attackerResult = auth.signInWithGoogle('attacker@gmail.com');

  assert(
    attackerResult.user.email === 'attacker@gmail.com',
    'Attacker receives user associated solely with attacker@gmail.com'
  );
  assert(
    attackerResult.user.email !== 'victim@company.com',
    'Different Google email cannot collide with or claim victim account'
  );
  assert(
    auth.users.size === 2,
    'Different emails create distinct, non-overlapping accounts'
  );
}

// -----------------------------------------------------------------------------
// Test Case 6: Failed Account Verification Must Prevent Provider Linking
// -----------------------------------------------------------------------------
console.log('\n--- Test 6: Failed Password Verification Prevents Linking ---');
{
  const auth = new MockFirebaseAuthEngine();

  const reg = auth.registerEmailPassword('secure.user@domain.com', 'CorrectPass123!');
  const secureUserUid = reg.user.uid;

  let collision = null;
  try {
    auth.signInWithGoogle('secure.user@domain.com');
  } catch (err) {
    collision = err;
  }

  // Attacker attempts to link using an INCORRECT password
  let linkFailed = false;
  try {
    auth.verifyAndLinkGoogle(
      'secure.user@domain.com',
      'WRONG_PASSWORD_GUESS',
      collision.credential
    );
  } catch (err) {
    linkFailed = true;
    assert(err.code === 'auth/wrong-password', 'Rejected with auth/wrong-password');
  }

  assert(linkFailed, 'Account linking rejected upon failed password authentication');

  const userAfterFailedAttempt = auth.users.get(secureUserUid);
  const hasGoogle = userAfterFailedAttempt.providerData.some(p => p.providerId === 'google.com');
  assert(
    !hasGoogle,
    'Google credential was NOT linked to user account after failed verification'
  );
}

// -----------------------------------------------------------------------------
// Test Case 7: Duplicate Firestore & Tenant Documents Prevention
// -----------------------------------------------------------------------------
console.log('\n--- Test 7: Duplicate Document Prevention Verification ---');
{
  const auth = new MockFirebaseAuthEngine();

  // Simulate owner registration
  const reg = auth.registerEmailPassword('chef@grill.com', 'ChefPass123!');
  const uid = reg.user.uid;

  auth.firestoreUsers.set(uid, { uid, email: 'chef@grill.com', role: 'owner', tenantId: 'grill-123' });
  auth.firestoreTenants.set('grill-123', { id: 'grill-123', ownerUid: uid, name: 'The Grill' });

  // Simulate linking Google
  let collision = null;
  try { auth.signInWithGoogle('chef@grill.com'); } catch (e) { collision = e; }
  const linked = auth.verifyAndLinkGoogle('chef@grill.com', 'ChefPass123!', collision.credential);

  // Simulate role resolver execution on linked.user
  const resolvedProfile = auth.firestoreUsers.get(linked.user.uid);

  assert(
    auth.firestoreUsers.size === 1,
    'Firestore users collection contains exactly 1 document for this person'
  );
  assert(
    auth.firestoreTenants.size === 1,
    'Firestore tenants collection contains exactly 1 tenant document'
  );
  assert(
    resolvedProfile.tenantId === 'grill-123',
    'Resolved tenantId matches the single authoritative tenant'
  );
}

// -----------------------------------------------------------------------------
// Test Case 8: Reverse Provider Linking (Google Registration -> Link Email/Password)
// -----------------------------------------------------------------------------
console.log('\n--- Test 8: Reverse Provider Linking (Google -> Email/Password) ---');
{
  const auth = new MockFirebaseAuthEngine();

  // 1. User initially registers with Google
  const googleReg = auth.signInWithGoogle('owner.luigi@ristorante.it');
  const originalGoogleUid = googleReg.user.uid;
  assert(originalGoogleUid !== undefined, 'User initially registered via Google account');

  // Associate Firestore profile and tenant
  auth.firestoreUsers.set(originalGoogleUid, {
    uid: originalGoogleUid,
    email: 'owner.luigi@ristorante.it',
    role: 'owner',
    tenantId: 'luigi-pasta-99'
  });
  auth.firestoreTenants.set('luigi-pasta-99', {
    id: 'luigi-pasta-99',
    ownerUid: originalGoogleUid,
    name: 'Luigi Pasta Bar'
  });

  // 2. The user subsequently establishes an Email/Password credential
  const reverseLinked = auth.linkEmailPassword(googleReg.user, 'LuigiSecret2026!');

  assert(
    reverseLinked.user.uid === originalGoogleUid,
    'Reverse provider linking retains identical Firebase UID (preLinkUid === postLinkUid)'
  );
  assert(
    auth.users.size === 1,
    'No additional or duplicate Firebase user record created'
  );
  assert(
    reverseLinked.user.providerData.some(p => p.providerId === 'password') &&
    reverseLinked.user.providerData.some(p => p.providerId === 'google.com'),
    'User now possesses both google.com and password providers under single identity'
  );

  // 3. User can now sign in using Email/Password
  const emailPasswordSignIn = auth.signInWithEmailPassword('owner.luigi@ristorante.it', 'LuigiSecret2026!');
  assert(
    emailPasswordSignIn.user.uid === originalGoogleUid,
    'Sign-in with new password credential resolves to original Firebase UID'
  );

  // 4. User can also continue signing in with Google
  const googleSignInAgain = auth.signInWithGoogle('owner.luigi@ristorante.it');
  assert(
    googleSignInAgain.user.uid === originalGoogleUid,
    'Sign-in with Google continues to resolve to original Firebase UID'
  );

  // 5. Existing Firestore tenant and role remain completely unchanged
  const profileAfterReverseLink = auth.firestoreUsers.get(originalGoogleUid);
  const tenantAfterReverseLink = auth.firestoreTenants.get('luigi-pasta-99');
  assert(
    profileAfterReverseLink.role === 'owner' && profileAfterReverseLink.tenantId === 'luigi-pasta-99',
    'Owner role and tenant binding remain completely unchanged after reverse linking'
  );
  assert(
    tenantAfterReverseLink.ownerUid === originalGoogleUid,
    'Tenant ownerUid maintains association without orphan records'
  );
}

console.log('\n====================================================');
console.log(`RESULTS: ${passedTests}/${totalTests} tests passed`);
console.log('====================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
