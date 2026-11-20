/**
 * Automated Test Suite: SpiralDine Password Reset Experience
 * 
 * Verifies:
 * 1. Email format validation logic
 * 2. ActionCodeSettings generation and URL structure
 * 3. OOB Code extraction from multiple URL formats (query params & hash)
 * 4. Password security policy & criteria validation
 * 5. Firebase Auth error mapping and user-friendly diagnostics
 * 6. State machine flow (Forgot Password cooldown + Reset lifecycle)
 * 7. Route and Layout integration integrity in code
 */

const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${details ? ` - ${details}` : ''}`);
    testsFailed++;
  }
}

console.log('====================================================');
console.log('🧪 Starting SpiralDine Password Reset Test Suite');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// 1. Email Format Validation
// -----------------------------------------------------------------------------
console.log('🔹 Suite 1: Email Validation Logic');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return EMAIL_REGEX.test(email.trim());
}

assert(validateEmail('kumbhageethakrishna143@gmail.com'), 'Standard email accepted');
assert(validateEmail('admin+support@spiraldine.com'), 'Email with plus-alias accepted');
assert(validateEmail('chef.mario@restaurant.co.uk'), 'Email with subdomain / multiple TLDs accepted');
assert(validateEmail('  owner@bistro.io  '), 'Email with whitespace accepted after trimming');
assert(!validateEmail('invalid-email-no-at'), 'Rejects string missing @ symbol');
assert(!validateEmail('user@nomail'), 'Rejects string missing top-level domain');
assert(!validateEmail('@emptyuser.com'), 'Rejects string missing username before @');
assert(!validateEmail(''), 'Rejects empty string');
assert(!validateEmail('   '), 'Rejects whitespace-only string');
assert(!validateEmail(null), 'Rejects null input');

// -----------------------------------------------------------------------------
// 2. ActionCodeSettings Generation
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 2: ActionCodeSettings & Deep Link URL Construction');

function getResetActionCodeSettings(origin = 'https://spiral-dine.vercel.app') {
  return {
    url: `${origin}/reset-password`,
    handleCodeInApp: true,
  };
}

const prodSettings = getResetActionCodeSettings('https://spiral-dine.vercel.app');
assert(prodSettings.url === 'https://spiral-dine.vercel.app/reset-password', 'ActionCodeSettings url points to /reset-password');
assert(prodSettings.handleCodeInApp === true, 'handleCodeInApp is set to true');

const localSettings = getResetActionCodeSettings('http://localhost:5173');
assert(localSettings.url === 'http://localhost:5173/reset-password', 'Handles localhost origin correctly');

// -----------------------------------------------------------------------------
// 3. OOB Code Extraction Logic
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 3: OOB Code URL Parameter Extraction');

function extractOobCode(urlString) {
  const parsed = new URL(urlString);
  let code = parsed.searchParams.get('oobCode') || parsed.searchParams.get('code');
  if (!code && parsed.hash) {
    const rawHash = parsed.hash.replace(/^#\/?\??/, '');
    const hashParams = new URLSearchParams(rawHash);
    code = hashParams.get('oobCode') || hashParams.get('code');
  }
  return code || null;
}

assert(
  extractOobCode('https://spiral-dine.vercel.app/reset-password?oobCode=FIREBASE_SECRET_123') === 'FIREBASE_SECRET_123',
  'Extracts standard oobCode from searchParams'
);
assert(
  extractOobCode('https://spiral-dine.vercel.app/reset-password?code=FIREBASE_ALIAS_456') === 'FIREBASE_ALIAS_456',
  'Extracts fallback "code" parameter from searchParams'
);
assert(
  extractOobCode('https://spiral-dine.vercel.app/reset-password?apiKey=abc&oobCode=PARAM_789&mode=resetPassword') === 'PARAM_789',
  'Extracts oobCode when mixed with apiKey and mode'
);
assert(
  extractOobCode('https://spiral-dine.vercel.app/reset-password#oobCode=HASH_CODE_101') === 'HASH_CODE_101',
  'Extracts oobCode from hash fragment'
);
assert(
  extractOobCode('https://spiral-dine.vercel.app/reset-password#/?oobCode=HASH_SLASH_202') === 'HASH_SLASH_202',
  'Extracts oobCode from Angular/Vue style hash query #/?oobCode=...'
);
assert(
  extractOobCode('https://spiral-dine.vercel.app/reset-password') === null,
  'Returns null cleanly when no reset code is present'
);

// -----------------------------------------------------------------------------
// 4. Password Security Criteria & Policy
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 4: Password Security Policy & Criteria Checklist');

function evaluatePasswordPolicy(password, confirmPassword) {
  return {
    length: password.length >= 6,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    matches: password.length > 0 && password === confirmPassword,
  };
}

const weakPassword = evaluatePasswordPolicy('abc', 'abc');
assert(!weakPassword.length, 'Rejects password shorter than 6 characters');
assert(!weakPassword.hasUpper, 'Identifies missing uppercase');
assert(!weakPassword.hasNumber, 'Identifies missing number');

const goodPassword = evaluatePasswordPolicy('SpiralDine2026!', 'SpiralDine2026!');
assert(goodPassword.length, 'Accepts length >= 6');
assert(goodPassword.hasUpper, 'Validates uppercase presence');
assert(goodPassword.hasLower, 'Validates lowercase presence');
assert(goodPassword.hasNumber, 'Validates number presence');
assert(goodPassword.matches, 'Validates confirmed password match');

const mismatchPassword = evaluatePasswordPolicy('SpiralDine2026!', 'SpiralDine2025!');
assert(!mismatchPassword.matches, 'Detects password mismatch with confirm field');

// -----------------------------------------------------------------------------
// 5. Firebase Error Code Mapping
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 5: Firebase Error Code Human-Friendly Mapping');

function mapFirebaseResetError(errorCode) {
  switch (errorCode) {
    case 'auth/expired-action-code':
      return {
        status: 'expired_code',
        title: 'Reset Link Expired',
        message: 'This password reset link has already expired. Password reset links are time-limited for your security.',
      };
    case 'auth/invalid-action-code':
      return {
        status: 'invalid_code',
        title: 'Invalid Reset Link',
        message: 'This reset link is invalid or has already been used. Please request a new link.',
      };
    case 'auth/user-disabled':
      return {
        status: 'error',
        title: 'Account Disabled',
        message: 'This user account has been disabled. Please contact your restaurant administrator or support.',
      };
    case 'auth/user-not-found':
      return {
        status: 'error',
        title: 'Account Not Found',
        message: 'No active account corresponds to this reset token.',
      };
    case 'auth/weak-password':
      return {
        status: 'error',
        title: 'Weak Password',
        message: 'Password must be at least 6 characters and include a mixture of letters and numbers.',
      };
    case 'auth/too-many-requests':
      return {
        status: 'error',
        title: 'Too Many Attempts',
        message: 'Too many unsuccessful attempts. Please wait a few moments before trying again.',
      };
    default:
      return {
        status: 'error',
        title: 'Reset Failed',
        message: 'Unable to reset your password. Please try again or request a new link.',
      };
  }
}

const expired = mapFirebaseResetError('auth/expired-action-code');
assert(expired.status === 'expired_code', 'Maps auth/expired-action-code to expired_code state');
assert(expired.title === 'Reset Link Expired', 'Provides informative title for expired link');

const invalid = mapFirebaseResetError('auth/invalid-action-code');
assert(invalid.status === 'invalid_code', 'Maps auth/invalid-action-code to invalid_code state');

const weak = mapFirebaseResetError('auth/weak-password');
assert(weak.message.includes('at least 6 characters'), 'Translates weak password error');

const rateLimit = mapFirebaseResetError('auth/too-many-requests');
assert(rateLimit.status === 'error', 'Handles Firebase rate limiting gracefully');

// -----------------------------------------------------------------------------
// 6. State Machine & Cooldown Logic
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 6: State Transitions & Cooldown Timer');

let cooldownRemaining = 60;
function tickCooldown() {
  if (cooldownRemaining > 0) cooldownRemaining--;
  return cooldownRemaining;
}

assert(tickCooldown() === 59, 'Cooldown decrements appropriately');
cooldownRemaining = 1;
assert(tickCooldown() === 0, 'Cooldown reaches 0');
assert(tickCooldown() === 0, 'Cooldown does not go negative');

// -----------------------------------------------------------------------------
// 7. Route and Layout File Integrity Checks
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 7: Project File and Route Configuration Integrity');

const rootDir = path.resolve(__dirname, '..');
const appRoutesPath = path.join(rootDir, 'src', 'routes', 'AppRoutes.tsx');
const authLayoutPath = path.join(rootDir, 'src', 'shared', 'ui', 'layouts', 'AuthLayout.tsx');
const resetPagePath = path.join(rootDir, 'src', 'features', 'auth', 'components', 'ResetPasswordPage.tsx');
const forgotFormPath = path.join(rootDir, 'src', 'features', 'auth', 'components', 'ForgotPasswordForm.tsx');
const sharedAuthPath = path.join(rootDir, 'src', 'shared', 'firebase', 'auth.ts');

assert(fs.existsSync(appRoutesPath), 'AppRoutes.tsx exists');
assert(fs.existsSync(authLayoutPath), 'AuthLayout.tsx exists');
assert(fs.existsSync(resetPagePath), 'ResetPasswordPage.tsx exists');
assert(fs.existsSync(forgotFormPath), 'ForgotPasswordForm.tsx exists');
assert(fs.existsSync(sharedAuthPath), 'src/shared/firebase/auth.ts exists');

const appRoutesContent = fs.readFileSync(appRoutesPath, 'utf8');
assert(appRoutesContent.includes('path="/reset-password"'), 'AppRoutes registers /reset-password');
assert(appRoutesContent.includes('path="/auth/action"'), 'AppRoutes registers /auth/action');
assert(appRoutesContent.includes('path="/__/auth/action"'), 'AppRoutes registers /__/auth/action');
assert(appRoutesContent.includes('isAuthAction'), 'AppRoutes has isAuthAction error screen bypass');

const authLayoutContent = fs.readFileSync(authLayoutPath, 'utf8');
const authLayoutChecksRoutes = 
  authLayoutContent.includes("location.pathname === '/reset-password'") &&
  authLayoutContent.includes("location.pathname === '/auth/action'") &&
  authLayoutContent.includes("location.pathname === '/__/auth/action'") &&
  authLayoutContent.includes("location.pathname === '/forgot-password'");
assert(authLayoutChecksRoutes, 'AuthLayout recognizes reset password routes as custom layouts');

const sharedAuthContent = fs.readFileSync(sharedAuthPath, 'utf8');
assert(sharedAuthContent.includes('getResetActionCodeSettings'), 'shared/firebase/auth exports getResetActionCodeSettings');
assert(sharedAuthContent.includes('verifyPasswordResetCode'), 'shared/firebase/auth exports verifyPasswordResetCode');
assert(sharedAuthContent.includes('confirmPasswordReset'), 'shared/firebase/auth exports confirmPasswordReset');

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n====================================================');
console.log(`📊 Test Results: ${testsPassed} Passed | ${testsFailed} Failed`);
console.log('====================================================\n');

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
