import assert from 'node:assert/strict';
import {
  buildCustomDomainResetLink,
  dispatchCustomDomainPasswordReset,
} from '../api/_lib/email/passwordResetDispatcher';
import {
  getPasswordResetHtml,
  getPasswordResetText,
  escapeHtml,
} from '../api/_lib/email/passwordResetTemplate';
import passwordResetHandler, {
  resolvePublicAppUrl,
} from '../api/auth/send-password-reset';
import { _resetRateLimitStore } from '../api/_lib/rateLimiter';
import type { VercelRequest, VercelResponse } from '@vercel/node';

console.log('🧪 Starting SpiralDine Custom Domain Password Reset Suite...\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err: unknown) {
    console.error(`  ❌ [FAIL] ${name}`);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`     Error: ${message}\n`);
    throw err;
  }
}

async function runAsyncTest(name: string, fn: () => Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err: unknown) {
    console.error(`  ❌ [FAIL] ${name}`);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`     Error: ${message}\n`);
    throw err;
  }
}

// --------------------------------------------------------------------------
// 1. LINK GENERATION & DOMAIN ROUTING
// --------------------------------------------------------------------------
runTest('buildCustomDomainResetLink extracts oobCode from Firebase action URL', () => {
  const rawFirebaseLink =
    'https://spiral-restaurant-saas-v1.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=TEST_OOB_CODE_12345&apiKey=AIzaFakeKey&lang=en';
  const customUrl = buildCustomDomainResetLink(
    rawFirebaseLink,
    'https://dine.spiralworld.in'
  );
  assert.equal(
    customUrl,
    'https://dine.spiralworld.in/reset-password?oobCode=TEST_OOB_CODE_12345'
  );
  assert.ok(!customUrl.includes('firebaseapp.com'));
});

runTest('buildCustomDomainResetLink preserves already-formatted custom domain links', () => {
  const existingCustom = 'https://dine.spiralworld.in/reset-password?oobCode=ABC_XYZ';
  const customUrl = buildCustomDomainResetLink(
    existingCustom,
    'https://dine.spiralworld.in'
  );
  assert.equal(customUrl, existingCustom);
});

runTest('resolvePublicAppUrl prioritizes APP_PUBLIC_URL environment variable', () => {
  const prev = process.env.APP_PUBLIC_URL;
  try {
    process.env.APP_PUBLIC_URL = 'https://custom.dine.spiralworld.in/';
    const url = resolvePublicAppUrl();
    assert.equal(url, 'https://custom.dine.spiralworld.in');
  } finally {
    if (prev !== undefined) process.env.APP_PUBLIC_URL = prev;
    else delete process.env.APP_PUBLIC_URL;
  }
});

runTest('resolvePublicAppUrl falls back to authoritative production domain', () => {
  const prevApp = process.env.APP_PUBLIC_URL;
  const prevUrl = process.env.APP_URL;
  const prevVite = process.env.VITE_APP_URL;
  try {
    delete process.env.APP_PUBLIC_URL;
    delete process.env.APP_URL;
    delete process.env.VITE_APP_URL;
    const url = resolvePublicAppUrl();
    assert.equal(url, 'https://dine.spiralworld.in');
  } finally {
    if (prevApp !== undefined) process.env.APP_PUBLIC_URL = prevApp;
    else delete process.env.APP_PUBLIC_URL;
    if (prevUrl !== undefined) process.env.APP_URL = prevUrl;
    else delete process.env.APP_URL;
    if (prevVite !== undefined) process.env.VITE_APP_URL = prevVite;
    else delete process.env.VITE_APP_URL;
  }
});

// --------------------------------------------------------------------------
// 2. TEMPLATE SANITIZATION & BRAND INTEGRITY
// --------------------------------------------------------------------------
runTest('escapeHtml correctly sanitizes special characters to prevent XSS', () => {
  const dirty = '<script>alert("xss")</script>&"\'';
  const clean = escapeHtml(dirty);
  assert.ok(!clean.includes('<script>'));
  assert.ok(!clean.includes('</script>'));
  assert.ok(clean.includes('&lt;script&gt;'));
});

runTest('getPasswordResetHtml renders authoritative brand and support email', () => {
  const html = getPasswordResetHtml({
    email: 'diner@example.com',
    resetLink: 'https://dine.spiralworld.in/reset-password?oobCode=SECURE_CODE',
    brandName: 'SpiralDine',
    supportEmail: 'support@spiralworld.in',
    expirationMinutes: 60,
  });

  assert.ok(html.includes('SpiralDine'), 'Must include SpiralDine brand name');
  assert.ok(html.includes('support@spiralworld.in'), 'Must include support email');
  assert.ok(
    html.includes('https://dine.spiralworld.in/reset-password?oobCode=SECURE_CODE'),
    'Must include the custom domain reset link'
  );
  assert.ok(html.includes('60 minutes'), 'Must state 60 minute expiration');
  assert.ok(html.includes('Security Advisory'), 'Must include security advisory');
  assert.ok(!html.includes('firebaseapp.com'), 'Must not reference default firebase domain');
});

runTest('getPasswordResetText renders clean plain text with correct links', () => {
  const text = getPasswordResetText({
    email: 'diner@example.com',
    resetLink: 'https://dine.spiralworld.in/reset-password?oobCode=SECURE_CODE',
    brandName: 'SpiralDine',
    supportEmail: 'support@spiralworld.in',
    expirationMinutes: 60,
  });

  assert.ok(text.includes('SpiralDine — Password Reset Request'));
  assert.ok(text.includes('https://dine.spiralworld.in/reset-password?oobCode=SECURE_CODE'));
  assert.ok(text.includes('support@spiralworld.in'));
});

// --------------------------------------------------------------------------
// 3. DISPATCHER & DELIVERY FALLBACK
// --------------------------------------------------------------------------
await runAsyncTest('dispatchCustomDomainPasswordReset uses SMTP when configured', async () => {
  let smtpCalled = false;
  let sentMailOptions: Record<string, unknown> | null = null;

  const mockEnv = {
    SMTP_HOST: 'smtpout.secureserver.net',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'support@spiralworld.in',
    SMTP_PASS: 'secret_godaddy_pwd',
    CONTACT_FROM_EMAIL: 'support@spiralworld.in',
    CONTACT_FROM_NAME: 'SpiralDine',
    CONTACT_TO_EMAIL: 'support@spiralworld.in',
  };

  const result = await dispatchCustomDomainPasswordReset(
    {
      email: 'customer@example.com',
      resetLink: 'https://dine.spiralworld.in/reset-password?oobCode=MOCK_OOB',
    },
    {
      env: mockEnv,
      sendSmtpMail: async (_transporter, opts) => {
        smtpCalled = true;
        sentMailOptions = opts;
        return { messageId: '<msg-123@spiralworld.in>' };
      },
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.provider, 'smtp');
  assert.equal(smtpCalled, true);
  assert.equal(sentMailOptions?.to, 'customer@example.com');
  assert.ok(String(sentMailOptions?.from).includes('support@spiralworld.in'));
});

await runAsyncTest('dispatchCustomDomainPasswordReset falls back to Resend when SMTP fails', async () => {
  let resendCalled = false;
  let resendPayload: Record<string, unknown> | null = null;

  const mockEnv = {
    SMTP_HOST: 'smtpout.secureserver.net',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'support@spiralworld.in',
    SMTP_PASS: 'wrong_pwd',
    RESEND_API_KEY: 're_test_key_123',
    CONTACT_FROM_EMAIL: 'support@spiralworld.in',
    CONTACT_FROM_NAME: 'SpiralDine',
  };

  const result = await dispatchCustomDomainPasswordReset(
    {
      email: 'customer@example.com',
      resetLink: 'https://dine.spiralworld.in/reset-password?oobCode=MOCK_OOB',
    },
    {
      env: mockEnv,
      sendSmtpMail: async () => {
        const err = new Error('Invalid login 535') as Error & { code: string; responseCode: number };
        err.code = 'EAUTH';
        err.responseCode = 535;
        throw err;
      },
      sendResendMail: async (opts) => {
        resendCalled = true;
        resendPayload = opts as unknown as Record<string, unknown>;
        return { success: true, id: 'resend_id_456' };
      },
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.provider, 'resend');
  assert.equal(resendCalled, true);
  assert.equal(resendPayload?.to, 'customer@example.com');
  assert.ok(String(resendPayload?.from).includes('support@spiralworld.in'));
});

// --------------------------------------------------------------------------
// 4. SERVERLESS HANDLER API & SECURITY
// --------------------------------------------------------------------------
interface MockRes extends Partial<VercelResponse> {
  statusCode: number;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
  status: (code: number) => MockRes;
  setHeader: (k: string, v: string) => MockRes;
  json: (obj: Record<string, unknown>) => MockRes;
  end: () => MockRes;
}

function createMockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(k: string, v: string) {
      this.headers[k.toLowerCase()] = v;
      return this;
    },
    json(obj: Record<string, unknown>) {
      this.body = obj;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

await runAsyncTest('Serverless handler responds 200 to OPTIONS preflight', async () => {
  const req = {
    method: 'OPTIONS',
    headers: {},
  } as unknown as VercelRequest;
  const res = createMockRes();

  await passwordResetHandler(req, res as unknown as VercelResponse);
  assert.equal(res.statusCode, 200);
  assert.ok(res.headers['access-control-allow-methods'].includes('POST'));
});

await runAsyncTest('Serverless handler rejects GET with 405 Method Not Allowed', async () => {
  const req = {
    method: 'GET',
    headers: {},
  } as unknown as VercelRequest;
  const res = createMockRes();

  await passwordResetHandler(req, res as unknown as VercelResponse);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body?.code, 'auth/method-not-allowed');
});

await runAsyncTest('Serverless handler rejects invalid email with 400 auth/invalid-email', async () => {
  _resetRateLimitStore();
  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': '192.168.1.1' },
    body: { email: 'not-an-email' },
  } as unknown as VercelRequest;
  const res = createMockRes();

  await passwordResetHandler(req, res as unknown as VercelResponse);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.code, 'auth/invalid-email');
});

await runAsyncTest('Serverless handler protects against user enumeration for non-existent email', async () => {
  _resetRateLimitStore();
  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': '192.168.1.2' },
    body: { email: 'nonexistent-user@spiralworld.in' },
  } as unknown as VercelRequest;
  const res = createMockRes();

  await passwordResetHandler(req, res as unknown as VercelResponse, {
    generateResetLink: async () => {
      const err = new Error('USER_NOT_FOUND') as Error & { code: string };
      err.code = 'auth/user-not-found';
      throw err;
    },
  });

  // OWASP standard: Return 200 generic success so callers cannot enumerate accounts
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
  assert.ok(String(res.body?.message).includes('If an account is associated'));
});

await runAsyncTest('Serverless handler dispatches custom domain reset successfully', async () => {
  _resetRateLimitStore();
  let capturedLink: string | null = null;
  let capturedEmail: string | null = null;

  const req = {
    method: 'POST',
    headers: {
      'x-forwarded-for': '192.168.1.3',
      origin: 'https://dine.spiralworld.in',
    },
    body: { email: 'registered.user@spiralworld.in' },
  } as unknown as VercelRequest;
  const res = createMockRes();

  await passwordResetHandler(req, res as unknown as VercelResponse, {
    generateResetLink: async (email, _settings) => {
      capturedEmail = email;
      return 'https://spiral-restaurant-saas-v1.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=VALID_OOB_999';
    },
    dispatchEmail: async (opts) => {
      capturedLink = opts.resetLink;
      return { success: true, provider: 'smtp', messageId: 'msg-999' };
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.success, true);
  assert.equal(capturedEmail, 'registered.user@spiralworld.in');
  assert.equal(
    capturedLink,
    'https://dine.spiralworld.in/reset-password?oobCode=VALID_OOB_999'
  );
  assert.ok(!capturedLink!.includes('firebaseapp.com'));
});

await runAsyncTest('Serverless handler enforces email rate limiting (max 3 per email)', async () => {
  _resetRateLimitStore();
  const req = {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.40' },
    body: { email: 'repeated.email@spiralworld.in' },
  } as unknown as VercelRequest;

  const fakeDeps = {
    generateResetLink: async () => 'https://mock.firebase.link?oobCode=123',
    dispatchEmail: async () => ({ success: true as const, provider: 'mock' as const }),
  };

  // 3 requests allowed for same email
  for (let i = 0; i < 3; i++) {
    const res = createMockRes();
    await passwordResetHandler(req, res as unknown as VercelResponse, fakeDeps);
    assert.equal(res.statusCode, 200);
  }

  // 4th request must be blocked by email rate limiter
  const blockedRes = createMockRes();
  await passwordResetHandler(req, blockedRes as unknown as VercelResponse, fakeDeps);
  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.body?.code, 'RATE_LIMIT_EXCEEDED');
});

await runAsyncTest('Serverless handler enforces IP rate limiting (max 5 per IP)', async () => {
  _resetRateLimitStore();
  const fakeDeps = {
    generateResetLink: async () => 'https://mock.firebase.link?oobCode=123',
    dispatchEmail: async () => ({ success: true as const, provider: 'mock' as const }),
  };

  // Exhaust 5 allowed requests for IP using distinct emails
  for (let i = 0; i < 5; i++) {
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.50' },
      body: { email: `unique.user.${i}@spiralworld.in` },
    } as unknown as VercelRequest;
    const res = createMockRes();
    await passwordResetHandler(req, res as unknown as VercelResponse, fakeDeps);
    assert.equal(res.statusCode, 200);
  }

  // 6th request from same IP must be blocked by IP rate limiter
  const blockedReq = {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.50' },
    body: { email: 'unique.user.6@spiralworld.in' },
  } as unknown as VercelRequest;
  const blockedRes = createMockRes();
  await passwordResetHandler(blockedReq, blockedRes as unknown as VercelResponse, fakeDeps);
  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.body?.code, 'RATE_LIMIT_EXCEEDED');
  assert.ok(Number(blockedRes.headers['retry-after']) > 0);
});

console.log(`\n🎉 All ${passedTests}/${totalTests} Custom Domain Password Reset tests passed successfully!`);
