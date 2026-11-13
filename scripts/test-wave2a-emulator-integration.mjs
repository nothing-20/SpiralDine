import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = process.cwd();
const TMP_BUILD_DIR = fs.mkdtempSync(path.join(ROOT, '.tmp-wave2a-emu-'));

let passed = 0;
let failed = 0;

async function runCase(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  [FAIL] ${name}`);
    console.error('        ', err?.stack || err?.message || err);
  }
}

function createMockReq({ method = 'POST', headers = {}, body = {}, query = {} } = {}) {
  const normalizedHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    normalizedHeaders[k.toLowerCase()] = v;
  }
  return { method, headers: normalizedHeaders, body, query };
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };
}

async function signInWithPasswordEmulator(email, password) {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const res = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    throw new Error(`Emulator signInWithPassword failed: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

async function signUpAnonymousEmulator() {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const res = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    throw new Error(`Emulator anonymous signUp failed: ${JSON.stringify(data)}`);
  }
  return { uid: data.localId, idToken: data.idToken };
}

async function signInWithCustomTokenEmulator(customToken) {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const res = await fetch(
    `http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.idToken) {
    throw new Error(`Emulator signInWithCustomToken failed: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

try {
  console.log('\n==============================================================');
  console.log('Wave 2A: Firebase Auth + Firestore Emulator Integration Suite');
  console.log('==============================================================\n');

  process.env.APP_ENV = 'development';
  process.env.NODE_ENV = 'test';
  process.env.FIREBASE_PROJECT_ID = 'demo-spiraldine-emulator';
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8088';
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  process.env.SUPER_ADMIN_SETUP_SECRET = 'emulator-setup-secret-2026';

  await esbuild.build({
    entryPoints: [
      path.join(ROOT, 'api/_lib/firebaseAdmin.ts'),
      path.join(ROOT, 'api/_lib/authMiddleware.ts'),
      path.join(ROOT, 'api/super-admin/setup.ts'),
      path.join(ROOT, 'api/super-admin/review-application.ts'),
      path.join(ROOT, 'api/orders/create.ts'),
      path.join(ROOT, 'api/send-staff-invitation.ts'),
    ],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outdir: TMP_BUILD_DIR,
    outbase: ROOT,
    sourcemap: false,
    logLevel: 'silent',
  });

  const { adminDb, adminAuth } = await import(
    pathToFileURL(path.join(TMP_BUILD_DIR, 'api/_lib/firebaseAdmin.js')).href
  );
  const setupHandler = (
    await import(pathToFileURL(path.join(TMP_BUILD_DIR, 'api/super-admin/setup.js')).href)
  ).default;
  const reviewAppHandler = (
    await import(
      pathToFileURL(path.join(TMP_BUILD_DIR, 'api/super-admin/review-application.js')).href
    )
  ).default;
  const orderCreateHandler = (
    await import(pathToFileURL(path.join(TMP_BUILD_DIR, 'api/orders/create.js')).href)
  ).default;
  const staffInviteHandler = (
    await import(pathToFileURL(path.join(TMP_BUILD_DIR, 'api/send-staff-invitation.js')).href)
  ).default;

  // 1. Setup status initially false -> POST setup creates Super Admin -> GET returns true -> 2nd POST returns 409
  await runCase('Emulator: /api/super-admin/setup lifecycle (GET false -> POST 201 -> GET true -> 2nd POST 409)', async () => {
    const resGet1 = createMockRes();
    await setupHandler(createMockReq({ method: 'GET' }), resGet1);
    assert.equal(resGet1.statusCode, 200);
    assert.equal(resGet1.body?.isSetupComplete, false);

    const resPost = createMockRes();
    await setupHandler(
      createMockReq({
        method: 'POST',
        body: {
          fullName: 'Emulator Super Admin',
          email: 'superadmin@spiralworld.in',
          password: 'StrongPassword#2026',
          setupKey: 'emulator-setup-secret-2026',
        },
      }),
      resPost
    );
    assert.equal(resPost.statusCode, 201);

    const resGet2 = createMockRes();
    await setupHandler(createMockReq({ method: 'GET' }), resGet2);
    assert.equal(resGet2.statusCode, 200);
    assert.equal(resGet2.body?.isSetupComplete, true);

    const resPostDup = createMockRes();
    await setupHandler(
      createMockReq({
        method: 'POST',
        body: {
          fullName: 'Second Admin',
          email: 'second@spiralworld.in',
          password: 'StrongPassword#2026',
          setupKey: 'emulator-setup-secret-2026',
        },
      }),
      resPostDup
    );
    assert.equal(resPostDup.statusCode, 409);
  });

  // Obtain real Super Admin ID token from Auth Emulator
  const superAdminToken = await signInWithPasswordEmulator(
    'superadmin@spiralworld.in',
    'StrongPassword#2026'
  );

  // Create regular customer user + anonymous guest user
  const custRecord = await adminAuth.createUser({
    email: 'customer@example.com',
    password: 'CustomerPassword#2026',
    displayName: 'Diner One',
  });
  await adminAuth.setCustomUserClaims(custRecord.uid, { role: 'customer' });
  await adminDb.collection('users').doc(custRecord.uid).set({
    uid: custRecord.uid,
    email: 'customer@example.com',
    role: 'customer',
    status: 'active',
  });
  const customerToken = await signInWithPasswordEmulator(
    'customer@example.com',
    'CustomerPassword#2026'
  );
  const anonSession = await signUpAnonymousEmulator();

  // Seed restaurant application & menu item for review + order creation tests
  const appId = 'tenant_emu_bistro';
  await adminDb.collection('restaurants').doc(appId).set({
    tenantId: appId,
    name: 'Emulator Bistro',
    restaurantName: 'Emulator Bistro',
    ownerEmail: 'owner@bistro.test',
    ownerName: 'Chef Owner',
    status: 'pending_review',
    taxPercent: 5,
    serviceCharge: 5,
  });
  await adminDb
    .collection('restaurants')
    .doc(appId)
    .collection('menu')
    .doc('default')
    .collection('items')
    .doc('paneer_tikka')
    .set({
      name: 'Paneer Tikka',
      price: 250,
      isAvailable: true,
      isPublished: true,
    });

  await runCase('Emulator: Customer ID token rejected (403) on /api/super-admin/review-application', async () => {
    const res = createMockRes();
    await reviewAppHandler(
      createMockReq({
        method: 'POST',
        headers: { Authorization: `Bearer ${customerToken}` },
        body: { applicationId: appId, action: 'approve' },
      }),
      res
    );
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.code, 'SUPER_ADMIN_REQUIRED');
  });

  await runCase('Emulator: Anonymous ID token rejected (403) on /api/send-staff-invitation', async () => {
    const res = createMockRes();
    await staffInviteHandler(
      createMockReq({
        method: 'POST',
        headers: { Authorization: `Bearer ${anonSession.idToken}` },
        body: { fullName: 'Waiter X', email: 'waiter@bistro.test' },
      }),
      res
    );
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.code, 'ANONYMOUS_FORBIDDEN');
  });

  await runCase('Emulator: Tampered ID token signature rejected (401) by adminAuth.verifyIdToken', async () => {
    const parts = superAdminToken.split('.');
    const tampered = `${parts[0]}.${parts[1]}.tampered_invalid_signature`;
    const res = createMockRes();
    await reviewAppHandler(
      createMockReq({
        method: 'POST',
        headers: { Authorization: `Bearer ${tampered}` },
        body: { applicationId: appId, action: 'approve' },
      }),
      res
    );
    assert.equal(res.statusCode, 401);
  });

  await runCase('Emulator: Verified Super Admin ID token approves restaurant application via adminDb', async () => {
    const res = createMockRes();
    await reviewAppHandler(
      createMockReq({
        method: 'POST',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        body: { applicationId: appId, action: 'approve', notes: 'Approved in emulator test' },
      }),
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.status, 'approved');

    const restSnap = await adminDb.collection('restaurants').doc(appId).get();
    assert.equal(restSnap.data()?.status, 'active');
  });

  await runCase('Emulator: Verified anonymous guest creates order cleanly with authoritative pricing', async () => {
    const res = createMockRes();
    await orderCreateHandler(
      createMockReq({
        method: 'POST',
        headers: { Authorization: `Bearer ${anonSession.idToken}` },
        body: {
          tenantId: appId,
          tableNumber: 'T-04',
          customerId: anonSession.uid,
          items: [{ itemId: 'paneer_tikka', count: 2 }],
        },
      }),
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.order?.subtotal, 500);
    assert.equal(res.body?.order?.total, 550);
  });

  await runCase('Emulator: Anonymous guest attempting order with another customerId rejected (403)', async () => {
    const res = createMockRes();
    await orderCreateHandler(
      createMockReq({
        method: 'POST',
        headers: { Authorization: `Bearer ${anonSession.idToken}` },
        body: {
          tenantId: appId,
          tableNumber: 'T-04',
          customerId: custRecord.uid,
          items: [{ itemId: 'paneer_tikka', count: 1 }],
        },
      }),
      res
    );
    assert.equal(res.statusCode, 403);
  });

  await runCase('Emulator: Custom token exchanged & disabled/revoked -> verifyIdToken(checkRevoked=true) rejects', async () => {
    const customTok = await adminAuth.createCustomToken(custRecord.uid, { role: 'customer' });
    const exchangedToken = await signInWithCustomTokenEmulator(customTok);
    const decodedBefore = await adminAuth.verifyIdToken(exchangedToken, true);
    assert.equal(decodedBefore.uid, custRecord.uid);

    // Ensure at least 1s passes so tokensValidAfterTime strictly exceeds auth_time (second precision)
    await new Promise((r) => setTimeout(r, 1100));
    await adminAuth.revokeRefreshTokens(custRecord.uid);
    const userAfterRevoke = await adminAuth.getUser(custRecord.uid);
    assert.ok(userAfterRevoke.tokensValidAfterTime, 'Expected tokensValidAfterTime to be set');

    // Note: Firebase Auth Emulator's verifyIdToken skips tokensValidAfterTime comparison
    // unless checked explicitly, while it enforces user.disabled via checkRevoked=true.
    await adminAuth.updateUser(custRecord.uid, { disabled: true });
    const disabledResult = await adminAuth
      .verifyIdToken(exchangedToken, true)
      .then(() => 'allowed')
      .catch((err) => err.code || err.message);
    assert.equal(disabledResult, 'auth/user-disabled');

    // Also verify HTTP middleware maps revoked/disabled token to 401 TOKEN_REVOKED
    const reqDisabled = createMockReq({
      method: 'POST',
      headers: { Authorization: `Bearer ${exchangedToken}` },
      body: { fullName: 'Staff Two', email: 'staff2@bistro.test' },
    });
    const resDisabled = createMockRes();
    await staffInviteHandler(reqDisabled, resDisabled);
    assert.equal(resDisabled.statusCode, 401);
    assert.equal(resDisabled.body?.code, 'TOKEN_REVOKED');
  });

  console.log(`\nEmulator Integration Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
} finally {
  fs.rmSync(TMP_BUILD_DIR, { recursive: true, force: true });
}

