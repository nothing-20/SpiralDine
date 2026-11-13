import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);
const { PRODUCTION_PROJECT_ID } = require('./_lib/envGuard.cjs');

const ROOT = process.cwd();
const TMP_BUILD_DIR = fs.mkdtempSync(path.join(ROOT, '.tmp-wave2a-test-'));

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
  const res = {
    statusCode: 200,
    body: null,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.ended = true;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
  return res;
}

function makeFakeJwt(payloadObj) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  return `${header}.${payload}.unsigned_forged_sig`;
}

async function compileModules() {
  await esbuild.build({
    entryPoints: [
      path.join(ROOT, 'api/_lib/firebaseAdmin.ts'),
      path.join(ROOT, 'api/_lib/authMiddleware.ts'),
      path.join(ROOT, 'api/_lib/resendHelper.ts'),
      path.join(ROOT, 'api/super-admin/review-application.ts'),
      path.join(ROOT, 'api/super-admin/setup.ts'),
      path.join(ROOT, 'api/orders/create.ts'),
      path.join(ROOT, 'api/send-email.ts'),
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
}

async function importBuilt(relPath) {
  const fullPath = path.join(TMP_BUILD_DIR, relPath);
  return import(pathToFileURL(fullPath).href);
}

try {
  console.log('\n==============================================================');
  console.log('Wave 2A: Firebase Admin & Authentication Hardening Test Suite');
  console.log('==============================================================\n');

  await compileModules();

  const firebaseAdmin = await importBuilt('api/_lib/firebaseAdmin.js');
  const authMiddleware = await importBuilt('api/_lib/authMiddleware.js');
  const resendHelper = await importBuilt('api/_lib/resendHelper.js');
  const reviewAppHandler = (await importBuilt('api/super-admin/review-application.js')).default;
  const setupHandler = (await importBuilt('api/super-admin/setup.js')).default;
  const orderCreateHandler = (await importBuilt('api/orders/create.js')).default;
  const sendEmailHandler = (await importBuilt('api/send-email.js')).default;
  const staffInviteHandler = (await importBuilt('api/send-staff-invitation.js')).default;

  // ------------------------------------------------------------------
  // 1. Firebase Admin Credential & Environment Validation Tests
  // ------------------------------------------------------------------
  await runCase('FirebaseAdmin: throws MISSING_CREDENTIALS when no credentials configured', () => {
    assert.throws(
      () => firebaseAdmin.resolveAdminCredentials({ NODE_ENV: 'production' }),
      (err) => err instanceof firebaseAdmin.FirebaseAdminInitError && err.code === 'MISSING_CREDENTIALS'
    );
  });

  await runCase('FirebaseAdmin: rejects VERCEL_ENV=preview targeting production project', () => {
    assert.throws(
      () =>
        firebaseAdmin.resolveAdminCredentials({
          VERCEL_ENV: 'preview',
          FIREBASE_CLIENT_EMAIL: 'svc@test.iam.gserviceaccount.com',
          FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
          FIREBASE_PROJECT_ID: PRODUCTION_PROJECT_ID,
        }),
      (err) => err instanceof firebaseAdmin.FirebaseAdminInitError && err.code === 'INVALID_ENVIRONMENT'
    );
  });

  await runCase('FirebaseAdmin: rejects APP_ENV=staging targeting production via FIREBASE_SERVICE_ACCOUNT', () => {
    const saJson = JSON.stringify({
      project_id: PRODUCTION_PROJECT_ID,
      client_email: 'svc@test.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
    });
    assert.throws(
      () =>
        firebaseAdmin.resolveAdminCredentials({
          APP_ENV: 'staging',
          FIREBASE_SERVICE_ACCOUNT: Buffer.from(saJson).toString('base64'),
        }),
      (err) => err instanceof firebaseAdmin.FirebaseAdminInitError && err.code === 'INVALID_ENVIRONMENT'
    );
  });

  await runCase('FirebaseAdmin: rejects mismatched FIREBASE_PROJECT_ID vs service account project_id', () => {
    const saJson = JSON.stringify({
      project_id: 'spiraldine-staging-demo',
      client_email: 'svc@test.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
    });
    assert.throws(
      () =>
        firebaseAdmin.resolveAdminCredentials({
          APP_ENV: 'staging',
          FIREBASE_PROJECT_ID: 'other-project-id',
          FIREBASE_SERVICE_ACCOUNT: saJson,
        }),
      (err) => err instanceof firebaseAdmin.FirebaseAdminInitError && err.code === 'PROJECT_MISMATCH'
    );
  });

  await runCase('FirebaseAdmin: rejects emulator host in production environment', () => {
    assert.throws(
      () =>
        firebaseAdmin.resolveAdminCredentials({
          APP_ENV: 'production',
          VERCEL_ENV: 'production',
          FIRESTORE_EMULATOR_HOST: '127.0.0.1:8088',
          FIREBASE_PROJECT_ID: PRODUCTION_PROJECT_ID,
        }),
      (err) => err instanceof firebaseAdmin.FirebaseAdminInitError && err.code === 'INVALID_ENVIRONMENT'
    );
  });

  await runCase('FirebaseAdmin: constantTimeEqual uses timing-safe SHA-256 digest matching', () => {
    assert.equal(firebaseAdmin.constantTimeEqual('secret-key-123', 'secret-key-123'), true);
    assert.equal(firebaseAdmin.constantTimeEqual('secret-key-123', 'secret-key-124'), false);
    assert.equal(firebaseAdmin.constantTimeEqual('short', 'much-longer-secret'), false);
    assert.equal(firebaseAdmin.constantTimeEqual('', ''), false);
  });

  // ------------------------------------------------------------------
  // 2. Auth Middleware Verification & RBAC/Tenant/Branch Guards
  // ------------------------------------------------------------------
  await runCase('AuthMiddleware: missing Authorization header throws 401 MISSING_AUTH_HEADER', async () => {
    await assert.rejects(
      () => authMiddleware.verifyRequestAuth(createMockReq({ headers: {} })),
      (err) => err.statusCode === 401 && err.code === 'MISSING_AUTH_HEADER'
    );
  });

  await runCase('AuthMiddleware: non-Bearer Authorization header throws 401 INVALID_AUTH_HEADER', async () => {
    await assert.rejects(
      () =>
        authMiddleware.verifyRequestAuth(
          createMockReq({ headers: { Authorization: 'Basic dXNlcjpwYXNz' } })
        ),
      (err) => err.statusCode === 401 && err.code === 'INVALID_AUTH_HEADER'
    );
  });

  await runCase('AuthMiddleware: valid verified token resolves UID and claims + requests revocation check', async () => {
    let observedCheckRevoked = false;
    const req = createMockReq({ headers: { Authorization: 'Bearer valid-signed-token' } });
    const ctx = await authMiddleware.verifyRequestAuth(
      req,
      { allowAnonymous: false },
      {
        verifyIdToken: async (token, checkRevoked) => {
          assert.equal(token, 'valid-signed-token');
          observedCheckRevoked = Boolean(checkRevoked);
          return {
            uid: 'uid-owner-1',
            email: 'Owner@Restaurant.com',
            email_verified: true,
            role: 'owner',
            tenantId: 'tenant-alpha',
            firebase: { sign_in_provider: 'password' },
          };
        },
        loadUserDoc: async () => null,
      }
    );
    assert.equal(observedCheckRevoked, true);
    assert.equal(ctx.uid, 'uid-owner-1');
    assert.equal(ctx.email, 'owner@restaurant.com');
    assert.equal(ctx.role, 'owner');
    assert.equal(ctx.tenantId, 'tenant-alpha');
    assert.equal(ctx.isAnonymous, false);
  });

  await runCase('AuthMiddleware: invalid token signature rejects with 401 INVALID_TOKEN', async () => {
    const req = createMockReq({ headers: { Authorization: 'Bearer bad-signature-token' } });
    await assert.rejects(
      () =>
        authMiddleware.verifyRequestAuth(
          req,
          {},
          {
            verifyIdToken: async () => {
              const e = new Error('Firebase ID token has invalid signature.');
              e.code = 'auth/argument-error';
              throw e;
            },
            loadUserDoc: async () => null,
          }
        ),
      (err) => err.statusCode === 401 && err.code === 'INVALID_TOKEN'
    );
  });

  await runCase('AuthMiddleware: expired token rejects with 401 TOKEN_EXPIRED', async () => {
    const req = createMockReq({ headers: { Authorization: 'Bearer expired-token' } });
    await assert.rejects(
      () =>
        authMiddleware.verifyRequestAuth(
          req,
          {},
          {
            verifyIdToken: async () => {
              const e = new Error('Firebase ID token has expired.');
              e.code = 'auth/id-token-expired';
              throw e;
            },
            loadUserDoc: async () => null,
          }
        ),
      (err) => err.statusCode === 401 && err.code === 'TOKEN_EXPIRED'
    );
  });

  await runCase('AuthMiddleware: revoked token rejects with 401 TOKEN_REVOKED', async () => {
    const req = createMockReq({ headers: { Authorization: 'Bearer revoked-token' } });
    await assert.rejects(
      () =>
        authMiddleware.verifyRequestAuth(
          req,
          { checkRevoked: true },
          {
            verifyIdToken: async () => {
              const e = new Error('Firebase ID token has been revoked.');
              e.code = 'auth/id-token-revoked';
              throw e;
            },
            loadUserDoc: async () => null,
          }
        ),
      (err) => err.statusCode === 401 && err.code === 'TOKEN_REVOKED'
    );
  });

  await runCase('AuthMiddleware: anonymous user rejected (403) when allowAnonymous=false', async () => {
    const req = createMockReq({ headers: { Authorization: 'Bearer anon-token' } });
    await assert.rejects(
      () =>
        authMiddleware.requireNonAnonymousUser(
          req,
          {},
          {
            verifyIdToken: async () => ({
              uid: 'anon-123',
              firebase: { sign_in_provider: 'anonymous' },
            }),
            loadUserDoc: async () => null,
          }
        ),
      (err) => err.statusCode === 403 && err.code === 'ANONYMOUS_FORBIDDEN'
    );
  });

  await runCase('AuthMiddleware: customer attempting super_admin operation rejected (403 SUPER_ADMIN_REQUIRED)', async () => {
    const req = createMockReq({ headers: { Authorization: 'Bearer customer-token' } });
    await assert.rejects(
      () =>
        authMiddleware.requireSuperAdmin(req, {
          verifyIdToken: async () => ({
            uid: 'cust-1',
            email: 'diner@example.com',
            firebase: { sign_in_provider: 'password' },
          }),
          loadUserDoc: async () => ({ role: 'customer', status: 'active' }),
        }),
      (err) => err.statusCode === 403 && err.code === 'SUPER_ADMIN_REQUIRED'
    );
  });

  await runCase('AuthMiddleware: cross-tenant access rejected (403 TENANT_ACCESS_DENIED)', async () => {
    const req = createMockReq({ headers: { Authorization: 'Bearer tenant-a-staff' } });
    await assert.rejects(
      () =>
        authMiddleware.requireTenantAccess(
          req,
          'tenant-b',
          {},
          {
            verifyIdToken: async () => ({
              uid: 'staff-a1',
              firebase: { sign_in_provider: 'password' },
            }),
            loadUserDoc: async () => ({ role: 'manager', tenantId: 'tenant-a', status: 'active' }),
          }
        ),
      (err) => err.statusCode === 403 && err.code === 'TENANT_ACCESS_DENIED'
    );
  });

  await runCase('AuthMiddleware: cross-branch staff access rejected (403 BRANCH_ACCESS_DENIED)', async () => {
    const req = createMockReq({ headers: { Authorization: 'Bearer waiter-branch-1' } });
    await assert.rejects(
      () =>
        authMiddleware.requireBranchAccess(
          req,
          'tenant-a',
          'branch-2',
          {},
          {
            verifyIdToken: async () => ({
              uid: 'waiter-1',
              firebase: { sign_in_provider: 'password' },
            }),
            loadUserDoc: async () => ({
              role: 'waiter',
              tenantId: 'tenant-a',
              branchId: 'branch-1',
              status: 'active',
            }),
          }
        ),
      (err) => err.statusCode === 403 && err.code === 'BRANCH_ACCESS_DENIED'
    );
  });

  await runCase('AuthMiddleware: inactive/suspended user rejected (403 USER_INACTIVE)', async () => {
    const req = createMockReq({ headers: { Authorization: 'Bearer suspended-admin' } });
    await assert.rejects(
      () =>
        authMiddleware.requireSuperAdmin(req, {
          verifyIdToken: async () => ({
            uid: 'admin-suspended',
            role: 'super_admin',
            super_admin: true,
            firebase: { sign_in_provider: 'password' },
          }),
          loadUserDoc: async () => ({ role: 'super_admin', status: 'suspended' }),
        }),
      (err) => err.statusCode === 403 && err.code === 'USER_INACTIVE'
    );
  });

  // ------------------------------------------------------------------
  // 3. HTTP Endpoint Fail-Closed & Anti-Forgery Tests (No Admin Creds)
  // ------------------------------------------------------------------
  const savedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const savedClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const savedPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  const savedSetupSecret = process.env.SUPER_ADMIN_SETUP_SECRET;
  const savedFirestoreEmu = process.env.FIRESTORE_EMULATOR_HOST;
  const savedAuthEmu = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  delete process.env.FIREBASE_CLIENT_EMAIL;
  delete process.env.FIREBASE_PRIVATE_KEY;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;

  await runCase('Endpoint: forged unsigned super_admin JWT rejected on /api/super-admin/review-application', async () => {
    const forgedJwt = makeFakeJwt({
      uid: 'attacker-uid',
      role: 'super_admin',
      super_admin: true,
      email: 'attacker@evil.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = createMockReq({
      method: 'POST',
      headers: { Authorization: `Bearer ${forgedJwt}` },
      body: { applicationId: 'app-1', action: 'approve' },
    });
    const res = createMockRes();
    await reviewAppHandler(req, res);
    assert.ok(res.statusCode === 401 || res.statusCode === 500, `Unexpected status ${res.statusCode}`);
    assert.notEqual(res.statusCode, 200);
  });

  await runCase('Endpoint: x-super-admin-secret bypass header rejected on /api/super-admin/review-application', async () => {
    process.env.SUPER_ADMIN_SETUP_SECRET = 'test-setup-secret-xyz';
    const req = createMockReq({
      method: 'POST',
      headers: { 'x-super-admin-secret': 'test-setup-secret-xyz' },
      body: { applicationId: 'app-1', action: 'approve' },
    });
    const res = createMockRes();
    await reviewAppHandler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body?.code, 'MISSING_AUTH_HEADER');
  });

  await runCase('Endpoint: GET /api/super-admin/setup fails closed (503) when Admin SDK unavailable', async () => {
    const req = createMockReq({ method: 'GET' });
    const res = createMockRes();
    await setupHandler(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body?.isSetupComplete, undefined);
  });

  await runCase('Endpoint: POST /api/super-admin/setup rejects wrong setupKey with 401 (constantTimeEqual)', async () => {
    process.env.SUPER_ADMIN_SETUP_SECRET = 'correct-setup-secret-123';
    const req = createMockReq({
      method: 'POST',
      body: {
        fullName: 'Admin User',
        email: 'admin@spiralworld.in',
        password: 'StrongPassword#123',
        setupKey: 'wrong-setup-secret-123',
      },
    });
    const res = createMockRes();
    await setupHandler(req, res);
    assert.equal(res.statusCode, 401);
  });

  await runCase('Endpoint: forged unsigned JWT rejected on /api/orders/create without Admin verification', async () => {
    const forgedJwt = makeFakeJwt({
      uid: 'guest-uid',
      firebase: { sign_in_provider: 'anonymous' },
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const req = createMockReq({
      method: 'POST',
      headers: { Authorization: `Bearer ${forgedJwt}` },
      body: {
        tenantId: 'demo-tenant',
        tableNumber: '1',
        customerId: 'guest-uid',
        items: [{ itemId: 'item-1', count: 1 }],
      },
    });
    const res = createMockRes();
    await orderCreateHandler(req, res);
    assert.ok(res.statusCode === 401 || res.statusCode === 500, `Unexpected status ${res.statusCode}`);
    assert.notEqual(res.statusCode, 200);
  });

  await runCase('Endpoint: forged unsigned JWT rejected on /api/send-email Case 5 & Case 6', async () => {
    const forgedJwt = makeFakeJwt({
      uid: 'fake-user',
      role: 'super_admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    for (const type of ['admin_registration', 'restaurant_application_approved']) {
      const req = createMockReq({
        method: 'POST',
        headers: { Authorization: `Bearer ${forgedJwt}` },
        body: {
          type,
          applicationId: 'app-1',
          ownerEmail: 'owner@example.com',
          restaurantName: 'Test Bistro',
        },
      });
      const res = createMockRes();
      await sendEmailHandler(req, res);
      assert.ok(res.statusCode === 401 || res.statusCode === 500, `Expected rejection for ${type}, got ${res.statusCode}`);
    }
  });

  await runCase('Endpoint: missing Authorization rejected (401) on /api/send-staff-invitation', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { fullName: 'Staff One', email: 'staff@example.com' },
    });
    const res = createMockRes();
    await staffInviteHandler(req, res);
    assert.equal(res.statusCode, 401);
  });

  // Restore env vars
  if (savedServiceAccount !== undefined) process.env.FIREBASE_SERVICE_ACCOUNT = savedServiceAccount;
  if (savedClientEmail !== undefined) process.env.FIREBASE_CLIENT_EMAIL = savedClientEmail;
  if (savedPrivateKey !== undefined) process.env.FIREBASE_PRIVATE_KEY = savedPrivateKey;
  if (savedSetupSecret !== undefined) process.env.SUPER_ADMIN_SETUP_SECRET = savedSetupSecret;
  else delete process.env.SUPER_ADMIN_SETUP_SECRET;
  if (savedFirestoreEmu !== undefined) process.env.FIRESTORE_EMULATOR_HOST = savedFirestoreEmu;
  if (savedAuthEmu !== undefined) process.env.FIREBASE_AUTH_EMULATOR_HOST = savedAuthEmu;

  // ------------------------------------------------------------------
  // 4. Email Dispatch Logging Isolation Test (No Duplicate Sends)
  // ------------------------------------------------------------------
  await runCase('ResendHelper: logging failure AFTER send succeeds does NOT retry or resend email', async () => {
    const prevKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = 're_test_dummy_key';
    let sendCount = 0;
    let sleepCount = 0;

    try {
      const result = await resendHelper.sendMailWithLogging(
        {
          to: 'owner@example.com',
          subject: 'Test Subject',
          html: '<p>Hello</p>',
          type: 'test_email',
          retries: 3,
        },
        {
          sendEmail: async () => {
            sendCount += 1;
            return { data: { id: 'email_123' }, error: null };
          },
          writeLog: async () => {
            throw new Error('Simulated Firestore write outage');
          },
          sleep: async () => {
            sleepCount += 1;
          },
        }
      );

      assert.equal(result.success, true);
      assert.equal(result.id, 'email_123');
      assert.equal(sendCount, 1, 'Expected email to be sent exactly once');
      assert.equal(sleepCount, 0, 'Expected zero retries when send itself succeeded');
    } finally {
      if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey;
      else delete process.env.RESEND_API_KEY;
    }
  });

  // ------------------------------------------------------------------
  // 5. Static Security & Hygiene Scan
  // ------------------------------------------------------------------
  await runCase('Static scan: zero unsigned JWT base64 decoding fallbacks remain in api/', () => {
    const apiFiles = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) apiFiles.push(full);
      }
    };
    walk(path.join(ROOT, 'api'));

    const offending = [];
    for (const file of apiFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes("base64url") && content.includes("parts[1]")) {
        offending.push(path.relative(ROOT, file));
      }
    }
    assert.deepStrictEqual(offending, [], `Unsigned JWT decode still present in: ${offending.join(', ')}`);
  });

  await runCase('Static scan: zero ensureServerAuth or client auth SDK calls remain in api routes', () => {
    const apiFiles = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts')) apiFiles.push(full);
      }
    };
    walk(path.join(ROOT, 'api'));

    const offending = [];
    for (const file of apiFiles) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (rel === 'api/_lib/firebaseServer.ts') continue;
      const content = fs.readFileSync(file, 'utf8');
      if (
        content.includes('ensureServerAuth') ||
        content.includes('firebaseServer') ||
        content.includes('signInWithEmailAndPassword') ||
        content.includes('createUserWithEmailAndPassword')
      ) {
        offending.push(rel);
      }
    }
    assert.deepStrictEqual(offending, [], `Legacy client-SDK server auth still imported in: ${offending.join(', ')}`);
  });

  await runCase('Static scan: WorkspaceContext mock-uid- shortcut is gated by import.meta.env.DEV', () => {
    const ws = fs.readFileSync(path.join(ROOT, 'src/shared/services/WorkspaceContext.tsx'), 'utf8');
    assert.ok(
      ws.includes("import.meta.env.DEV && user.uid.startsWith('mock-uid-')"),
      'WorkspaceContext mock-uid- bypass must require import.meta.env.DEV'
    );
  });

  console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
} finally {
  fs.rmSync(TMP_BUILD_DIR, { recursive: true, force: true });
}
