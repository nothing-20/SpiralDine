/**
 * SPIRALDINE COMMERCIAL SAAS — CSP CONFIGURATION & RECAPTCHA INTEGRITY TEST
 * 
 * Verifies:
 * 1. vercel.json is valid JSON
 * 2. script-src allows required Google reCAPTCHA origins (google.com/recaptcha/, gstatic.com/recaptcha/)
 * 3. frame-src allows required Google reCAPTCHA frame origins
 * 4. connect-src allows Google reCAPTCHA telemetry and verification endpoints
 * 5. Preservation of Razorpay (checkout.razorpay.com, api.razorpay.com, lumberjack.razorpay.com)
 * 6. Preservation of Firebase endpoints (*.firebaseio.com, *.googleapis.com, identitytoolkit, securetoken, firestore, firebasestorage)
 * 7. Preservation of baseline security (object-src 'none', base-uri 'self', form-action 'self', no unsafe-eval, no broad wildcards)
 * 8. All other security headers (HSTS, nosniff, SAMEORIGIN, X-XSS-Protection, Referrer-Policy, Permissions-Policy) intact
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('===============================================================');
console.log('SPIRALDINE — CONTENT SECURITY POLICY & RECAPTCHA INTEGRITY TEST');
console.log('===============================================================\n');

let total = 0;
let passed = 0;
let failed = 0;

function run(name, fn) {
  total += 1;
  try {
    fn();
    passed += 1;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    ${err.message}`);
  }
}

const vercelPath = path.resolve('vercel.json');
const rawVercel = fs.readFileSync(vercelPath, 'utf-8');
let vercelConfig = null;

run('vercel.json is valid and parseable JSON', () => {
  vercelConfig = JSON.parse(rawVercel);
  assert.ok(vercelConfig);
});

const headers = vercelConfig?.headers?.[0]?.headers || [];
const cspHeader = headers.find(h => h.key === 'Content-Security-Policy');

run('Content-Security-Policy header exists in vercel.json', () => {
  assert.ok(cspHeader, 'Content-Security-Policy header must be configured');
  assert.ok(cspHeader.value, 'CSP value must not be empty');
});

// Parse CSP directives into a map
const directives = {};
cspHeader?.value?.split(';').forEach(part => {
  const trimmed = part.trim();
  if (!trimmed) return;
  const [dir, ...vals] = trimmed.split(/\s+/);
  directives[dir] = vals;
});

run("script-src allows 'self', 'unsafe-inline', Razorpay, and Google reCAPTCHA origins", () => {
  const scriptSrc = directives['script-src'] || [];
  assert.ok(scriptSrc.includes("'self'"), "Must include 'self'");
  assert.ok(scriptSrc.includes("'unsafe-inline'"), "Must include 'unsafe-inline'");
  assert.ok(scriptSrc.includes('https://checkout.razorpay.com'), 'Must preserve Razorpay checkout');
  assert.ok(scriptSrc.includes('https://apis.google.com'), 'Must preserve apis.google.com');
  assert.ok(scriptSrc.includes('https://www.google.com/recaptcha/'), 'Must allow https://www.google.com/recaptcha/');
  assert.ok(scriptSrc.includes('https://www.gstatic.com/recaptcha/'), 'Must allow https://www.gstatic.com/recaptcha/');
});

run("script-src strictly omits unsafe-eval and broad wildcards", () => {
  const scriptSrc = directives['script-src'] || [];
  assert.strictEqual(scriptSrc.includes("'unsafe-eval'"), false, "Must NOT include 'unsafe-eval'");
  assert.strictEqual(scriptSrc.includes('*'), false, "Must NOT include wildcard '*'");
  assert.strictEqual(scriptSrc.includes('https:'), false, "Must NOT include wildcard 'https:'");
});

run("frame-src allows 'self', Razorpay, and Google reCAPTCHA frame origins", () => {
  const frameSrc = directives['frame-src'] || [];
  assert.ok(frameSrc.includes("'self'"), "Must include 'self'");
  assert.ok(frameSrc.includes('https://api.razorpay.com'), 'Must preserve Razorpay frame');
  assert.ok(frameSrc.includes('https://www.google.com/recaptcha/'), 'Must allow https://www.google.com/recaptcha/');
  assert.ok(frameSrc.includes('https://recaptcha.google.com/recaptcha/'), 'Must allow https://recaptcha.google.com/recaptcha/');
});

run("connect-src allows reCAPTCHA telemetry while preserving Firebase and Razorpay endpoints", () => {
  const connectSrc = directives['connect-src'] || [];
  assert.ok(connectSrc.includes("'self'"), "Must include 'self'");
  // reCAPTCHA
  assert.ok(connectSrc.includes('https://www.google.com/recaptcha/'), 'Must allow https://www.google.com/recaptcha/');
  assert.ok(connectSrc.includes('https://recaptcha.google.com/recaptcha/'), 'Must allow https://recaptcha.google.com/recaptcha/');
  // Firebase
  assert.ok(connectSrc.includes('https://*.firebaseio.com'), 'Must preserve https://*.firebaseio.com');
  assert.ok(connectSrc.includes('https://*.googleapis.com'), 'Must preserve https://*.googleapis.com');
  assert.ok(connectSrc.includes('https://identitytoolkit.googleapis.com'), 'Must preserve identitytoolkit');
  assert.ok(connectSrc.includes('https://securetoken.googleapis.com'), 'Must preserve securetoken');
  assert.ok(connectSrc.includes('https://firestore.googleapis.com'), 'Must preserve firestore');
  assert.ok(connectSrc.includes('https://firebasestorage.googleapis.com'), 'Must preserve firebasestorage');
  // Razorpay
  assert.ok(connectSrc.includes('https://api.razorpay.com'), 'Must preserve api.razorpay.com');
  assert.ok(connectSrc.includes('https://lumberjack.razorpay.com'), 'Must preserve lumberjack.razorpay.com');
});

run("Preserves strict defense-in-depth directives (object-src 'none', base-uri 'self', form-action 'self')", () => {
  assert.deepStrictEqual(directives['object-src'], ["'none'"], "object-src must be 'none'");
  assert.deepStrictEqual(directives['base-uri'], ["'self'"], "base-uri must be 'self'");
  assert.deepStrictEqual(directives['form-action'], ["'self'"], "form-action must be 'self'");
  assert.deepStrictEqual(directives['default-src'], ["'self'"], "default-src must be 'self'");
});

run('Preserves all standard HTTP security headers in vercel.json', () => {
  const requiredHeaders = [
    { key: 'Strict-Transport-Security', check: v => v.includes('max-age=63072000') },
    { key: 'X-Content-Type-Options', check: v => v === 'nosniff' },
    { key: 'X-Frame-Options', check: v => v === 'SAMEORIGIN' },
    { key: 'X-XSS-Protection', check: v => v === '1; mode=block' },
    { key: 'Referrer-Policy', check: v => v === 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', check: v => v.includes('camera=(self)') }
  ];

  for (const req of requiredHeaders) {
    const found = headers.find(h => h.key === req.key);
    assert.ok(found, `Header ${req.key} must be present`);
    assert.ok(req.check(found.value), `Header ${req.key} value '${found.value}' failed check`);
  }
});

console.log('\n===============================================================');
console.log(`CSP INTEGRITY SUMMARY: ${passed}/${total} TESTS PASSED`);
if (passed === total) {
  console.log('STATUS: ALL CSP & RECAPTCHA SECURITY POLICY CHECKS PASSED');
} else {
  console.error(`STATUS: ${failed} CHECKS FAILED`);
  process.exit(1);
}
console.log('===============================================================\n');

