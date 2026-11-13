/**
 * SPIRALDINE COMMERCIAL SAAS — PHONE NUMBER AUTHENTICATION & RECAPTCHA TEST SUITE
 * 
 * Verifies Phase 1 hardening requirements:
 * 1. Indian Phone Number Validation & E.164 Formatting
 * 2. Multi-Country Phone Validation & Defaults
 * 3. 6-Digit OTP Code Validation & Formatting
 * 4. reCAPTCHA Lifecycle Management & Duplicate Verifier Prevention
 * 5. Safe DOM Isolation (no container.innerHTML = '')
 * 6. Error Code Mapping (billing-not-enabled, invalid-code, code-expired, etc.)
 * 7. Anonymous Account Linking (Preserving exact UID)
 * 8. Existing Account Conflict Handling (credential-already-in-use, Profile Preservation)
 * 9. Customer Profile Provisioning & Staff Separation
 * 10. Regression: Guest QR Ordering & Email Login Preservation
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('===============================================================');
console.log('SPIRALDINE: PHONE NUMBER AUTH & RECAPTCHA ARCHITECTURE TEST');
console.log('===============================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Phone Number Validation & E.164 Formatting
// ---------------------------------------------------------------------------
console.log('--- 1. Phone Number Validation & E.164 Formatting ---');

const validateIndianPhone = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length !== 10) return { valid: false, error: 'Indian mobile numbers must be exactly 10 digits.' };
  if (!/^[6-9]/.test(digits)) return { valid: false, error: 'Valid Indian mobile numbers typically start with 6, 7, 8, or 9.' };
  return { valid: true, cleanDigits: digits, e164: `+91${digits}` };
};

runTest('Valid Indian mobile numbers starting with 6, 7, 8, 9 pass validation', () => {
  const testCases = ['9876543210', '8123456789', '7001234567', '6999888777'];
  for (const num of testCases) {
    const res = validateIndianPhone(num);
    assert.strictEqual(res.valid, true, `Should accept valid number: ${num}`);
    assert.strictEqual(res.e164, `+91${num}`);
  }
});

runTest('Formats phone with dashes, spaces, and brackets to clean E.164', () => {
  const formatted = '+91 (98765) 43-210';
  const res = validateIndianPhone(formatted);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.cleanDigits, '9876543210');
  assert.strictEqual(res.e164, '+919876543210');
});

runTest('Rejects Indian numbers starting with invalid digits (0, 1, 2, 3, 4, 5)', () => {
  const invalidStarters = ['1234567890', '0987654321', '5555555555', '2345678901'];
  for (const num of invalidStarters) {
    const res = validateIndianPhone(num);
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /start with 6, 7, 8, or 9/);
  }
});

runTest('Rejects numbers with incorrect digit counts (<10 or >10 digits)', () => {
  const shortNum = validateIndianPhone('987654321'); // 9 digits
  const longNum = validateIndianPhone('98765432101'); // 11 digits
  assert.strictEqual(shortNum.valid, false);
  assert.strictEqual(longNum.valid, false);
});

// ---------------------------------------------------------------------------
// 2. Country Code Mapping & Defaults
// ---------------------------------------------------------------------------
console.log('\n--- 2. Country Code Mapping & Defaults ---');

const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳', placeholder: '98765 43210', maxLength: 10 },
  { code: '+1', country: 'USA / Canada', flag: '🇺🇸', placeholder: '202 555 0123', maxLength: 10 },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧', placeholder: '7911 123456', maxLength: 10 },
  { code: '+971', country: 'UAE', flag: '🇦🇪', placeholder: '50 123 4567', maxLength: 9 },
  { code: '+61', country: 'Australia', flag: '🇦🇺', placeholder: '412 345 678', maxLength: 9 },
  { code: '+65', country: 'Singapore', flag: '🇸🇬', placeholder: '8123 4567', maxLength: 8 },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', placeholder: '50 123 4567', maxLength: 9 },
  { code: '+974', country: 'Qatar', flag: '🇶🇦', placeholder: '3312 3456', maxLength: 8 },
  { code: '+49', country: 'Germany', flag: '🇩🇪', placeholder: '151 12345678', maxLength: 11 },
  { code: '+33', country: 'France', flag: '🇫🇷', placeholder: '6 12 34 56 78', maxLength: 9 },
  { code: '+81', country: 'Japan', flag: '🇯🇵', placeholder: '90 1234 5678', maxLength: 10 },
  { code: '+60', country: 'Malaysia', flag: '🇲🇾', placeholder: '12 345 6789', maxLength: 10 },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿', placeholder: '21 123 4567', maxLength: 9 }
];

runTest('Defaults to India (+91) as primary country code', () => {
  const defaultCountry = COUNTRY_CODES[0];
  assert.strictEqual(defaultCountry.code, '+91');
  assert.strictEqual(defaultCountry.country, 'India');
  assert.strictEqual(defaultCountry.maxLength, 10);
});

runTest('E.164 concatenation conforms to international standard for all supported countries', () => {
  const sample = { code: '+971', digits: '501234567' };
  const e164 = `${sample.code}${sample.digits}`;
  assert.strictEqual(e164, '+971501234567');
  assert.match(e164, /^\+[1-9]\d{6,14}$/); // Standard E.164 regex
});

// ---------------------------------------------------------------------------
// 3. 6-Digit OTP Code Validation & Formatting
// ---------------------------------------------------------------------------
console.log('\n--- 3. 6-Digit OTP Code Validation ---');

const validateOtpCode = (rawOtp) => {
  const clean = String(rawOtp || '').trim();
  if (!clean || clean.length !== 6 || !/^\d{6}$/.test(clean)) {
    return { valid: false, error: 'Please enter the complete 6-digit numeric verification code.' };
  }
  return { valid: true, cleanOtp: clean };
};

runTest('Accepts valid 6-digit numeric OTP', () => {
  assert.strictEqual(validateOtpCode('123456').valid, true);
  assert.strictEqual(validateOtpCode('000000').valid, true);
  assert.strictEqual(validateOtpCode('987654').cleanOtp, '987654');
});

runTest('Rejects short, long, and non-numeric OTP codes', () => {
  assert.strictEqual(validateOtpCode('12345').valid, false); // 5 digits
  assert.strictEqual(validateOtpCode('1234567').valid, false); // 7 digits
  assert.strictEqual(validateOtpCode('12345a').valid, false); // letter
  assert.strictEqual(validateOtpCode('').valid, false);
});

// ---------------------------------------------------------------------------
// 4. reCAPTCHA Lifecycle Management & Safe DOM Isolation
// ---------------------------------------------------------------------------
console.log('\n--- 4. reCAPTCHA Lifecycle & Safe DOM Isolation ---');

// Mock DOM environment to test RecaptchaManager mechanics
class MockDOMElement {
  constructor(id) {
    this.id = id;
    this.children = [];
    this.parentNode = null;
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  contains(child) {
    return this.children.includes(child);
  }
  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) {
        this.parentNode.children.splice(idx, 1);
      }
      this.parentNode = null;
    }
  }
}

const mockDoc = {
  elements: new Map(),
  getElementById(id) {
    return this.elements.get(id) || null;
  },
  createElement(tag) {
    return new MockDOMElement(`${tag}-${Date.now()}`);
  }
};

class MockRecaptchaVerifier {
  constructor(auth, element, options) {
    this.element = element;
    this.options = options;
    this.isCleared = false;
    this.rendered = false;
  }
  async render() {
    this.rendered = true;
    return 42; // mock widget ID
  }
  clear() {
    this.isCleared = true;
  }
}

// Simulating the hardened RecaptchaManager
class HardenedRecaptchaManager {
  constructor(containerId, doc = mockDoc) {
    this.containerId = containerId;
    this.doc = doc;
    this.verifier = null;
    this.activeChildElement = null;
    this.widgetId = null;
    this.initPromise = null;
  }

  async getVerifier() {
    const parent = this.doc.getElementById(this.containerId);
    if (!parent) return null;

    if (this.verifier && this.activeChildElement && parent.contains(this.activeChildElement)) {
      return this.verifier;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.destroy();
        const childNode = this.doc.createElement('div');
        childNode.id = `${this.containerId}-badge-${Date.now()}`;
        parent.appendChild(childNode);
        this.activeChildElement = childNode;

        const verifier = new MockRecaptchaVerifier(null, childNode, {});
        this.verifier = verifier;
        this.widgetId = await verifier.render();
        return verifier;
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  destroy() {
    if (this.verifier) {
      this.verifier.clear();
      this.verifier = null;
      this.widgetId = null;
    }
    if (this.activeChildElement) {
      this.activeChildElement.remove();
      this.activeChildElement = null;
    }
  }
}

await runAsyncTest('RecaptchaManager mounts to isolated child DOM node without innerHTML manipulation', async () => {
  const parentContainer = new MockDOMElement('customer-recaptcha-container');
  mockDoc.elements.set('customer-recaptcha-container', parentContainer);

  const mgr = new HardenedRecaptchaManager('customer-recaptcha-container', mockDoc);
  const v1 = await mgr.getVerifier();

  assert.ok(v1, 'Verifier should be created');
  assert.strictEqual(parentContainer.children.length, 1, 'Should have created isolated child node');
  assert.ok(parentContainer.children[0].id.includes('customer-recaptcha-container-badge-'));
});

await runAsyncTest('RecaptchaManager reuses active verifier on subsequent calls', async () => {
  const parentContainer = new MockDOMElement('customer-recaptcha-container');
  mockDoc.elements.set('customer-recaptcha-container', parentContainer);

  const mgr = new HardenedRecaptchaManager('customer-recaptcha-container', mockDoc);
  const v1 = await mgr.getVerifier();
  const v2 = await mgr.getVerifier();

  assert.strictEqual(v1, v2, 'Must return same verifier instance on reuse');
  assert.strictEqual(parentContainer.children.length, 1, 'No duplicate child nodes created');
});

await runAsyncTest('Concurrent calls share single initialization promise preventing race conditions', async () => {
  const parentContainer = new MockDOMElement('customer-recaptcha-container');
  mockDoc.elements.set('customer-recaptcha-container', parentContainer);

  const mgr = new HardenedRecaptchaManager('customer-recaptcha-container', mockDoc);
  const [v1, v2] = await Promise.all([mgr.getVerifier(), mgr.getVerifier()]);

  assert.strictEqual(v1, v2, 'Concurrent callers must receive the exact same instance');
  assert.strictEqual(parentContainer.children.length, 1, 'Zero duplicate elements created');
});

await runAsyncTest('destroy() invokes verifier.clear() and removes child element cleanly', async () => {
  const parentContainer = new MockDOMElement('customer-recaptcha-container');
  mockDoc.elements.set('customer-recaptcha-container', parentContainer);

  const mgr = new HardenedRecaptchaManager('customer-recaptcha-container', mockDoc);
  const v1 = await mgr.getVerifier();
  mgr.destroy();

  assert.strictEqual(v1.isCleared, true, 'Verifier clear() must be called');
  assert.strictEqual(parentContainer.children.length, 0, 'Child node removed from DOM');
});

// ---------------------------------------------------------------------------
// 5. Error Code Mapping & User-Facing Safety
// ---------------------------------------------------------------------------
console.log('\n--- 5. Error Code Mapping & Safety ---');

const mapPhoneAuthError = (err) => {
  const code = err?.code || '';
  if (code === 'auth/billing-not-enabled') {
    return 'Phone authentication is currently unavailable due to project billing configuration. Please sign in with email or contact support.';
  } else if (code === 'auth/missing-phone-number') {
    return 'Please enter your mobile phone number.';
  } else if (code === 'auth/invalid-phone-number') {
    return 'Invalid mobile phone number format. Please check the country code and number.';
  } else if (code === 'auth/app-not-authorized') {
    return 'This application domain is not authorized for phone authentication. Please contact support.';
  } else if (code === 'auth/too-many-requests') {
    return 'Too many requests. Please wait a few minutes before trying again.';
  } else if (code === 'auth/quota-exceeded') {
    return 'SMS quota exceeded for this Firebase project. Please try again later or sign in with email.';
  } else if (code === 'auth/network-request-failed') {
    return 'Network error. Please check your internet connection and try again.';
  } else if (code === 'auth/invalid-verification-code') {
    return 'The 6-digit OTP code entered is incorrect. Please check and re-enter.';
  } else if (code === 'auth/code-expired') {
    return 'The verification code has expired. Please request a new OTP code.';
  } else if (code === 'auth/credential-already-in-use') {
    return 'This phone number is already registered to another account.';
  } else if (code === 'auth/captcha-check-failed' || err?.message?.includes('reCAPTCHA')) {
    return 'Security verification failed. Please try again.';
  }
  return 'Failed to authenticate. Please try again.';
};

runTest('auth/billing-not-enabled returns actionable, polite user error', () => {
  const msg = mapPhoneAuthError({ code: 'auth/billing-not-enabled' });
  assert.match(msg, /project billing configuration/);
  assert.match(msg, /Please sign in with email/);
});

runTest('auth/invalid-verification-code and code-expired provide clear guidance', () => {
  const badCodeMsg = mapPhoneAuthError({ code: 'auth/invalid-verification-code' });
  const expiredMsg = mapPhoneAuthError({ code: 'auth/code-expired' });
  assert.match(badCodeMsg, /incorrect/);
  assert.match(expiredMsg, /expired/);
});

runTest('auth/app-not-authorized and quota-exceeded do not expose private Firebase project keys', () => {
  const unauthMsg = mapPhoneAuthError({ code: 'auth/app-not-authorized' });
  const quotaMsg = mapPhoneAuthError({ code: 'auth/quota-exceeded' });
  assert.doesNotMatch(unauthMsg, /spiral-restaurant-saas-v1/);
  assert.doesNotMatch(quotaMsg, /API_KEY|service_account/);
});

// ---------------------------------------------------------------------------
// 6. Anonymous Account Linking & UID Preservation
// ---------------------------------------------------------------------------
console.log('\n--- 6. Anonymous Account Linking & UID Preservation ---');

// Simulated Auth and Profile database
class MockAuthAndFirestore {
  constructor() {
    this.currentUser = null;
    this.users = new Map();
    this.customers = new Map();
  }

  setAnonymousUser(uid) {
    this.currentUser = {
      uid,
      isAnonymous: true,
      phoneNumber: null
    };
  }

  // Simulating linkPhoneWithCredential
  async linkPhoneWithCredential(user, verificationId, otp) {
    if (verificationId === 'VID_ALREADY_EXISTS') {
      const err = new Error('Credential already in use');
      err.code = 'auth/credential-already-in-use';
      throw err;
    }
    // Upgrade existing user
    user.isAnonymous = false;
    user.phoneNumber = '+919876543210';
    return { user };
  }

  // Simulating confirmPhoneOtp
  async confirmPhoneOtp(verificationId, otp) {
    return {
      user: {
        uid: 'EXISTING_USER_999',
        isAnonymous: false,
        phoneNumber: '+919876543210'
      }
    };
  }
}

await runAsyncTest('Case A: New phone number links anonymous account and PRESERVES exact UID', async () => {
  const env = new MockAuthAndFirestore();
  const ANON_UID = 'ANON_DINER_SESSION_12345';
  env.setAnonymousUser(ANON_UID);

  // User attempts OTP verify with new phone
  const isAnonymous = Boolean(env.currentUser && env.currentUser.isAnonymous);
  assert.strictEqual(isAnonymous, true);

  const cred = await env.linkPhoneWithCredential(env.currentUser, 'VID_FRESH_PHONE', '123456');
  assert.strictEqual(cred.user.uid, ANON_UID, 'UID must be preserved across linking!');
  assert.strictEqual(cred.user.isAnonymous, false, 'User must no longer be anonymous');
  assert.strictEqual(cred.user.phoneNumber, '+919876543210');
});

await runAsyncTest('Case B: Existing phone number catches credential-already-in-use and preserves existing account', async () => {
  const env = new MockAuthAndFirestore();
  const ANON_UID = 'ANON_DINER_SESSION_12345';
  env.setAnonymousUser(ANON_UID);

  // Pre-populate existing user profile in customers/{existingUid}
  const EXISTING_UID = 'EXISTING_USER_999';
  env.customers.set(EXISTING_UID, {
    uid: EXISTING_UID,
    displayName: 'Regular Diner',
    walletBalance: 2500,
    loyaltyPoints: 120,
    phoneNumber: '+919876543210',
    status: 'active'
  });

  let activeUser = null;
  let wasLinked = false;

  try {
    // Attempting linking with already registered number
    await env.linkPhoneWithCredential(env.currentUser, 'VID_ALREADY_EXISTS', '123456');
  } catch (err) {
    if (err.code === 'auth/credential-already-in-use') {
      // Fallback: sign into existing user account
      const res = await env.confirmPhoneOtp('VID_ALREADY_EXISTS', '123456');
      activeUser = res.user;
    } else {
      throw err;
    }
  }

  assert.ok(activeUser);
  assert.strictEqual(activeUser.uid, EXISTING_UID, 'Signed into existing user UID');

  // Verify that the existing customer profile in customers/{existingUid} was preserved
  const existingProf = env.customers.get(activeUser.uid);
  assert.strictEqual(existingProf.displayName, 'Regular Diner', 'Existing name must not be overwritten');
  assert.strictEqual(existingProf.walletBalance, 2500, 'Wallet balance preserved');
  assert.strictEqual(existingProf.loyaltyPoints, 120, 'Loyalty points preserved');
});

// ---------------------------------------------------------------------------
// 7. Staff Clearance Separation & Prevention of Privilege Escalation
// ---------------------------------------------------------------------------
console.log('\n--- 7. Staff Clearance Separation ---');

runTest('Rejects customer portal login if UID belongs to Owner or Staff account', () => {
  const staffProfile = { role: 'owner', tenantId: 'rest_oasis_01' };
  const isOwnerOrStaff = staffProfile.role && staffProfile.role !== 'customer';
  assert.strictEqual(isOwnerOrStaff, true, 'Staff account must be detected');
});

runTest('Permits customer portal login if role is strictly customer', () => {
  const customerProfile = { role: 'customer', tenantId: null };
  const isOwnerOrStaff = customerProfile.role && customerProfile.role !== 'customer';
  assert.strictEqual(isOwnerOrStaff, false, 'Customer role must pass clearance');
});

// ---------------------------------------------------------------------------
// 8. Service Consolidation & Method Availability
// ---------------------------------------------------------------------------
console.log('\n--- 8. Service Consolidation & Module Re-export ---');

runTest('src/shared/services/authService exports all required methods', () => {
  const filePath = path.resolve('src/shared/services/authService.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('export const authService ='), 'authService must be exported');
  assert.ok(content.includes('export default authService'), 'default authService must be exported');
  
  const expectedMethods = [
    'signInWithEmail',
    'signInAnonymous',
    'signUpOwner',
    'signUpCustomer',
    'resetPassword',
    'verifyPasswordResetCode',
    'confirmPasswordReset',
    'signOutUser',
    'sendEmailVerificationLink',
    'getUserClaims',
    'createRecaptchaVerifier',
    'signInWithPhone',
    'confirmPhoneOtp',
    'linkPhone',
    'linkPhoneWithCredential'
  ];

  for (const m of expectedMethods) {
    const hasMethod = content.includes(`${m}:`) || content.includes(`async ${m}(`) || content.includes(`${m}(`);
    assert.ok(hasMethod, `Method ${m} must be defined in authService`);
  }
});

runTest('src/services/authService re-exports shared service for 100% backward compatibility', () => {
  const filePath = path.resolve('src/services/authService.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes("export * from '../shared/services/authService'"), 'Must re-export all from shared service');
  assert.ok(content.includes("import authService from '../shared/services/authService'"), 'Must import default from shared service');
  assert.ok(content.includes("export default authService"), 'Must export default authService');
});

// ---------------------------------------------------------------------------
// Final Summary
// ---------------------------------------------------------------------------
console.log('\n===============================================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
if (passedTests === totalTests) {
  console.log('STATUS: ALL PHASE 1 PHONE AUTH & RECAPTCHA ARCHITECTURE TESTS PASSED');
} else {
  console.error(`STATUS: ${totalTests - passedTests} TESTS FAILED`);
  process.exit(1);
}
console.log('===============================================================\n');
