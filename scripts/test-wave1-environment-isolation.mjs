#!/usr/bin/env node

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

async function runCase(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] ${name}: ${err?.message || err}`);
  }
}

function loadTsModule(relPath) {
  const fullPath = path.resolve(rootDir, relPath);
  const source = fs.readFileSync(fullPath, 'utf-8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: fullPath,
  });

  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', transpiled.outputText);
  fn(mod.exports, require, mod, fullPath, path.dirname(fullPath));
  return mod.exports;
}

function runScriptSubprocess(scriptRelPath, args = [], extraEnv = {}) {
  const cleanEnv = { ...process.env };
  for (const key of Object.keys(cleanEnv)) {
    if (
      key.startsWith('VITE_FIREBASE_') ||
      key.startsWith('FIREBASE_') ||
      key === 'VITE_APP_ENV' ||
      key === 'APP_ENV' ||
      key === 'RESET_DEVELOPMENT_DATABASE' ||
      key === 'ALLOW_PRODUCTION_MIGRATION'
    ) {
      delete cleanEnv[key];
    }
  }
  Object.assign(cleanEnv, extraEnv);

  return spawnSync(process.execPath, [path.resolve(rootDir, scriptRelPath), ...args], {
    cwd: rootDir,
    env: cleanEnv,
    encoding: 'utf-8',
  });
}

function walkFiles(dirRel, extensions) {
  const results = [];
  const skipDirs = new Set(['node_modules', '.git', 'dist', '.vercel', 'build', '.gradle', 'docs']);
  const rootTarget = path.resolve(rootDir, dirRel);
  if (!fs.existsSync(rootTarget)) return results;

  function recurse(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (skipDirs.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        recurse(fullPath);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }
  recurse(rootTarget);
  return results;
}

console.log('================================================================');
console.log('SPIRALDINE — WAVE 1 ENVIRONMENT ISOLATION AUTOMATED TEST SUITE');
console.log('================================================================\n');

const webEnvMod = loadTsModule('src/shared/firebase/envConfig.ts');
const serverEnvMod = loadTsModule('api/_lib/firebaseEnv.ts');
const scriptGuard = require('./_lib/envGuard.cjs');

// -----------------------------------------------------------------------------
// 1. Static Codebase & Configuration Hygiene Checks
// -----------------------------------------------------------------------------
await runCase('Static scan: zero hardcoded DevResetSecret123! anywhere in code/scripts', () => {
  const files = [
    ...walkFiles('src', ['.ts', '.tsx', '.js', '.jsx']),
    ...walkFiles('api', ['.ts', '.js']),
    ...walkFiles('scripts', ['.js', '.cjs', '.mjs']),
    ...walkFiles('android', ['.kt', '.kts']),
  ].filter((p) => !p.endsWith('test-wave1-environment-isolation.mjs'));

  const hits = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('DevResetSecret123!')) {
      hits.push(path.relative(rootDir, file));
    }
  }
  assert.deepStrictEqual(hits, [], `Found forbidden password literal in: ${hits.join(', ')}`);
});

await runCase('Static scan: dev-admin-reset@restaurantos.internal removed outside explicit rejection filters', () => {
  const files = [
    ...walkFiles('src', ['.ts', '.tsx', '.js', '.jsx']),
    ...walkFiles('api', ['.ts', '.js']),
    ...walkFiles('scripts', ['.js', '.cjs', '.mjs']),
  ].filter((p) => !p.endsWith('test-wave1-environment-isolation.mjs'));

  const hits = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('dev-admin-reset@restaurantos.internal')) {
      hits.push(path.relative(rootDir, file));
    }
  }
  assert.deepStrictEqual(hits, [], `Found hardcoded dev-admin-reset email in: ${hits.join(', ')}`);
});

await runCase('Static scan: zero silent AIzaSyCKE... or spiral-restaurant-saas-v1 fallbacks in runtime web/api/Kotlin source & utility scripts', () => {
  const runtimeFiles = [
    ...walkFiles('src', ['.ts', '.tsx', '.js', '.jsx']),
    ...walkFiles('api', ['.ts', '.js']),
    ...walkFiles('android/app/src/main', ['.kt']),
    ...walkFiles('android/customer/src/main', ['.kt']),
    ...walkFiles('android/owner/src/main', ['.kt']),
  ];

  const hits = [];
  for (const file of runtimeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg')) {
      hits.push(`${path.relative(rootDir, file)} (hardcoded API key)`);
    }
  }

  const allowedProdIdFiles = new Set([
    path.join('scripts', '_lib', 'envGuard.cjs'),
    path.join('scripts', 'reset-dev-db.js'),
    path.join('scripts', 'migrate-customers.js'),
    path.join('scripts', 'test-wave1-environment-isolation.mjs'),
  ]);
  for (const scriptFile of walkFiles('scripts', ['.js', '.cjs', '.mjs'])) {
    const rel = path.relative(rootDir, scriptFile);
    if (allowedProdIdFiles.has(rel)) continue;
    const content = fs.readFileSync(scriptFile, 'utf-8');
    if (content.includes('spiral-restaurant-saas-v1') || content.includes('AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg')) {
      hits.push(`${rel} (hardcoded prod reference)`);
    }
  }

  assert.deepStrictEqual(hits, [], `Found forbidden hardcoded prod refs/keys: ${hits.join(', ')}`);
});

await runCase('.firebaserc has confirmed prod alias only and zero invented dev/staging project IDs', () => {
  const rc = JSON.parse(fs.readFileSync(path.resolve(rootDir, '.firebaserc'), 'utf-8'));
  assert.strictEqual(rc.projects.prod, 'spiral-restaurant-saas-v1');
  assert.strictEqual(rc.projects.default, undefined, '.firebaserc must not silently alias default to production');
  assert.strictEqual(rc.projects.dev, undefined, '.firebaserc must not invent unconfirmed dev project IDs');
  assert.strictEqual(rc.projects.staging, undefined, '.firebaserc must not invent unconfirmed staging project IDs');
});

await runCase('.gitignore protects secrets while allowing .env*.example & android/config/*.example', () => {
  const gi = fs.readFileSync(path.resolve(rootDir, '.gitignore'), 'utf-8');
  for (const rule of ['!.env.example', '!.env.*.example', 'android/**/google-services*.json', 'android/config/*.properties', '!android/config/*.properties.example']) {
    assert.ok(gi.includes(rule), `Missing .gitignore rule: ${rule}`);
  }
});

// -----------------------------------------------------------------------------
// 2. Web Firebase Config Validation (src/shared/firebase/envConfig.ts)
// -----------------------------------------------------------------------------
const validProdWebEnv = {
  MODE: 'production',
  VITE_APP_ENV: 'production',
  VITE_FIREBASE_API_KEY: 'test-valid-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'spiral-restaurant-saas-v1.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'spiral-restaurant-saas-v1',
  VITE_FIREBASE_STORAGE_BUCKET: 'spiral-restaurant-saas-v1.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  VITE_FIREBASE_APP_ID: '1:123456789:web:abcdef',
};

await runCase('Web envConfig: throws clearly when Firebase env vars are missing', () => {
  assert.throws(() => webEnvMod.resolveWebFirebaseConfig({ MODE: 'production' }), /Missing or invalid required Firebase environment variable/);
});

await runCase('Web envConfig: rejects placeholder and [SENSITIVE] values', () => {
  assert.throws(
    () =>
      webEnvMod.resolveWebFirebaseConfig({
        ...validProdWebEnv,
        VITE_FIREBASE_PROJECT_ID: 'your_project_id',
      }),
    /Missing or invalid required Firebase environment variable/
  );
  assert.throws(
    () =>
      webEnvMod.resolveWebFirebaseConfig({
        ...validProdWebEnv,
        VITE_FIREBASE_API_KEY: '[SENSITIVE]',
      }),
    /Missing or invalid required Firebase environment variable/
  );
});

await runCase('Web envConfig: blocks development & staging from connecting to spiral-restaurant-saas-v1', () => {
  assert.throws(
    () => webEnvMod.resolveWebFirebaseConfig({ ...validProdWebEnv, MODE: 'development', VITE_APP_ENV: 'development' }),
    /Environment isolation violation/
  );
  assert.throws(
    () => webEnvMod.resolveWebFirebaseConfig({ ...validProdWebEnv, MODE: 'staging', VITE_APP_ENV: 'staging' }),
    /Environment isolation violation/
  );
  assert.throws(
    () =>
      webEnvMod.resolveWebFirebaseConfig({
        ...validProdWebEnv,
        MODE: 'development',
        VITE_APP_ENV: 'development',
        VITE_FIREBASE_PROJECT_ID: 'isolated-dev-id',
      }),
    /Environment isolation violation/
  );
});

await runCase('Web envConfig: accepts valid production config & explicit emulator demo config', () => {
  const prod = webEnvMod.resolveWebFirebaseConfig(validProdWebEnv);
  assert.strictEqual(prod.projectId, 'spiral-restaurant-saas-v1');

  const emu = webEnvMod.resolveWebFirebaseConfig({
    MODE: 'development',
    VITE_APP_ENV: 'development',
    VITE_USE_FIREBASE_EMULATOR: 'true',
  });
  assert.strictEqual(emu.projectId, 'demo-spiraldine-emulator');

  assert.throws(
    () =>
      webEnvMod.resolveWebFirebaseConfig({
        MODE: 'development',
        VITE_USE_FIREBASE_EMULATOR: 'true',
        VITE_FIREBASE_PROJECT_ID: 'spiral-restaurant-saas-v1',
      }),
    /cannot use production project/
  );
});

// -----------------------------------------------------------------------------
// 3. Server Env Config & Credentials Validation (api/_lib/firebaseEnv.ts)
// -----------------------------------------------------------------------------
await runCase('Server env: throws when Firebase server env vars are missing (no prod fallback)', () => {
  assert.throws(() => serverEnvMod.resolveServerFirebaseConfig({}), /Silent production fallback is disabled/);
});

await runCase('Server env: blocks Vercel preview / staging / development targeting spiral-restaurant-saas-v1', () => {
  const baseProdVars = {
    VITE_FIREBASE_API_KEY: 'key',
    VITE_FIREBASE_AUTH_DOMAIN: 'spiral-restaurant-saas-v1.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID: 'spiral-restaurant-saas-v1',
    VITE_FIREBASE_STORAGE_BUCKET: 'spiral-restaurant-saas-v1.firebasestorage.app',
    VITE_FIREBASE_MESSAGING_SENDER_ID: '123',
    VITE_FIREBASE_APP_ID: '1:123:web:abc',
  };

  for (const envPair of [
    { VERCEL_ENV: 'preview' },
    { APP_ENV: 'staging' },
    { NODE_ENV: 'development' },
  ]) {
    assert.throws(
      () => serverEnvMod.resolveServerFirebaseConfig({ ...baseProdVars, ...envPair }),
      /refuses to connect to production Firebase project/
    );
  }

  const prodResolved = serverEnvMod.resolveServerFirebaseConfig({ ...baseProdVars, VERCEL_ENV: 'production' });
  assert.strictEqual(prodResolved.projectId, 'spiral-restaurant-saas-v1');
});

await runCase('Server auth: throws without FIREBASE_SERVER_EMAIL/PASSWORD and forbids dev-admin-reset', () => {
  assert.throws(() => serverEnvMod.resolveServerAuthCredentials({}), /Missing FIREBASE_SERVER_EMAIL or FIREBASE_SERVER_PASSWORD/);
  assert.throws(
    () =>
      serverEnvMod.resolveServerAuthCredentials({
        FIREBASE_SERVER_EMAIL: 'dev-admin-reset@restaurantos.internal',
        FIREBASE_SERVER_PASSWORD: 'some-password',
      }),
    /forbidden/
  );
});

// -----------------------------------------------------------------------------
// 4. scripts/reset-dev-db.js Protection Gates
// -----------------------------------------------------------------------------
await runCase('reset-dev-db.js: aborts cleanly when RESET_DEVELOPMENT_DATABASE is missing', () => {
  const res = runScriptSubprocess('scripts/reset-dev-db.js', ['--project=some-dev-id']);
  assert.notStrictEqual(res.status, 0);
  assert.ok(res.stderr.includes('RESET_DEVELOPMENT_DATABASE=true is missing'), `Unexpected stderr: ${res.stderr}`);
});

await runCase('reset-dev-db.js: permanently refuses --project=spiral-restaurant-saas-v1', () => {
  const res = runScriptSubprocess(
    'scripts/reset-dev-db.js',
    ['--project=spiral-restaurant-saas-v1'],
    { RESET_DEVELOPMENT_DATABASE: 'true' }
  );
  assert.notStrictEqual(res.status, 0);
  assert.ok(res.stderr.includes('PRODUCTION SAFEGUARD'), `Unexpected stderr: ${res.stderr}`);
});

await runCase('reset-dev-db.js: permanently refuses production project in process.env even with dev flag', () => {
  const res = runScriptSubprocess(
    'scripts/reset-dev-db.js',
    ['--env=dev', '--project=my-dev-proj'],
    {
      RESET_DEVELOPMENT_DATABASE: 'true',
      VITE_FIREBASE_PROJECT_ID: 'spiral-restaurant-saas-v1',
    }
  );
  assert.notStrictEqual(res.status, 0);
  assert.ok(res.stderr.includes('PRODUCTION SAFEGUARD'), `Unexpected stderr: ${res.stderr}`);
});

await runCase('reset-dev-db.js: aborts on --env=production or --env=staging', () => {
  const resProd = runScriptSubprocess('scripts/reset-dev-db.js', ['--env=production']);
  const resStage = runScriptSubprocess('scripts/reset-dev-db.js', ['--env=staging']);
  assert.notStrictEqual(resProd.status, 0);
  assert.notStrictEqual(resStage.status, 0);
});

await runCase('reset-dev-db.js: aborts when dev env vars are unconfigured (never loads root prod .env)', () => {
  const res = runScriptSubprocess(
    'scripts/reset-dev-db.js',
    ['--project=isolated-dev-proj'],
    { RESET_DEVELOPMENT_DATABASE: 'true' }
  );
  assert.notStrictEqual(res.status, 0);
  assert.ok(res.stderr.includes('ENV VALIDATION ERROR'), `Unexpected stderr: ${res.stderr}`);
});

// -----------------------------------------------------------------------------
// 5. scripts/migrate-customers.js Protection Gates
// -----------------------------------------------------------------------------
await runCase('migrate-customers.js: aborts without explicit --env and --project arguments', () => {
  const res1 = runScriptSubprocess('scripts/migrate-customers.js', []);
  assert.notStrictEqual(res1.status, 0);
  assert.ok(res1.stderr.includes('--env'), `Unexpected stderr: ${res1.stderr}`);

  const res2 = runScriptSubprocess('scripts/migrate-customers.js', ['--env=dev']);
  assert.notStrictEqual(res2.status, 0);
  assert.ok(res2.stderr.includes('--project'), `Unexpected stderr: ${res2.stderr}`);
});

await runCase('migrate-customers.js: blocks --env=dev/staging targeting spiral-restaurant-saas-v1', () => {
  for (const envName of ['dev', 'staging']) {
    const res = runScriptSubprocess('scripts/migrate-customers.js', [
      `--env=${envName}`,
      '--project=spiral-restaurant-saas-v1',
    ]);
    assert.notStrictEqual(res.status, 0);
    assert.ok(res.stderr.includes('cannot target production project'), `Unexpected stderr: ${res.stderr}`);
  }
});

await runCase('migrate-customers.js: blocks live prod writes (--execute) without ALLOW_PRODUCTION_MIGRATION confirmation', () => {
  const res = runScriptSubprocess('scripts/migrate-customers.js', [
    '--env=prod',
    '--project=spiral-restaurant-saas-v1',
    '--execute',
  ]);
  assert.notStrictEqual(res.status, 0);
  assert.ok(
    res.stderr.includes('ALLOW_PRODUCTION_MIGRATION'),
    `Expected ALLOW_PRODUCTION_MIGRATION safeguard error, got: ${res.stderr}`
  );
});

await runCase('migrate-customers.js: rejects mismatched --project against loaded config', () => {
  const res = runScriptSubprocess('scripts/migrate-customers.js', [
    '--env=prod',
    '--project=wrong-project-id',
  ]);
  assert.notStrictEqual(res.status, 0);
  assert.ok(res.stderr.includes('does not match'), `Unexpected stderr: ${res.stderr}`);
});

// -----------------------------------------------------------------------------
// 6. scriptGuard unit checks
// -----------------------------------------------------------------------------
await runCase('scriptGuard: resolveRunnerCredentials requires explicit env credentials and rejects dev-admin-reset', () => {
  assert.throws(() => scriptGuard.resolveRunnerCredentials({}), /Missing explicit credentials/);
  assert.throws(
    () =>
      scriptGuard.resolveRunnerCredentials({
        FIREBASE_ADMIN_EMAIL: 'dev-admin-reset@restaurantos.internal',
        FIREBASE_ADMIN_PASSWORD: 'secret',
      }),
    /forbidden/
  );
});

console.log('\n================================================================');
console.log(`WAVE 1 ISOLATION RESULTS: ${passed} Passed | ${failed} Failed`);
console.log('================================================================');
if (failed > 0) process.exit(1);
