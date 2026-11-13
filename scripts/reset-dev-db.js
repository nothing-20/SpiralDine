#!/usr/bin/env node

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const {
  PRODUCTION_PROJECT_ID,
  normalizeEnvName,
  parseCliFlags,
  loadScriptEnvironment,
  assertNotProductionProject,
  resolveScriptFirebaseConfig,
  resolveRunnerCredentials,
} = require('./_lib/envGuard.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const flags = parseCliFlags();
const requestedEnv = normalizeEnvName(flags.env || process.env.APP_ENV || process.env.VITE_APP_ENV || 'development');

console.log('----------------------------------------------------');
console.log('SPIRALDINE — DEVELOPMENT DATABASE RESET SCRIPT');
console.log('----------------------------------------------------');

// 0. PERMANENT PRODUCTION REFUSAL
if (requestedEnv === 'production' || requestedEnv === 'staging') {
  console.error(`\n[SAFETY ABORT] reset-dev-db.js only operates on isolated "development" environments (received "${requestedEnv}").`);
  process.exit(1);
}

if (flags.project) {
  try {
    assertNotProductionProject(flags.project, 'reset-dev-db.js (--project)');
  } catch (err) {
    console.error(`\n${err.message}`);
    process.exit(1);
  }
}

try {
  assertNotProductionProject(
    {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    },
    'reset-dev-db.js (process.env)'
  );
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}

// 1. SAFETY SAFEGUARD CHECK #1: Explicit confirmation env var
if (process.env.RESET_DEVELOPMENT_DATABASE !== 'true') {
  console.error('\n[SAFETY ABORT] Environment variable RESET_DEVELOPMENT_DATABASE=true is missing!');
  console.error('Usage:\n  $env:RESET_DEVELOPMENT_DATABASE="true"; node scripts/reset-dev-db.js --project <dev-project-id>\n');
  process.exit(1);
}

// 2. Load ONLY development env files (never root .env) and validate config strictly
loadScriptEnvironment({ rootDir, envName: 'development' });

let firebaseConfig;
try {
  firebaseConfig = resolveScriptFirebaseConfig(process.env, { expectedEnv: 'development' });
  assertNotProductionProject(firebaseConfig, 'reset-dev-db.js (resolved config)');
} catch (err) {
  console.error(`\n[SAFETY ABORT] ${err.message}`);
  console.error(`Confirmed production project "${PRODUCTION_PROJECT_ID}" is permanently blocked from reset-dev-db.js.`);
  process.exit(1);
}

// 3. SAFETY SAFEGUARD CHECK #2: Explicit --project must match loaded dev project
if (!flags.project) {
  console.error('\n[SAFETY ABORT] Explicit --project <dev-project-id> CLI flag is required to prevent accidental resets.');
  process.exit(1);
}

if (flags.project !== firebaseConfig.projectId) {
  console.error(
    `\n[SAFETY ABORT] --project "${flags.project}" does not match configured development project "${firebaseConfig.projectId}".`
  );
  process.exit(1);
}

let runnerCreds;
try {
  runnerCreds = resolveRunnerCredentials(process.env);
} catch (err) {
  console.error(`\n[SAFETY ABORT] ${err.message}`);
  process.exit(1);
}

console.log('Environment:      development');
console.log('Verified Project:', firebaseConfig.projectId);
console.log('\n[SAFETY VERIFIED] Development project verified and non-production guarantees passed.');
console.log('Beginning development database reset...\n');

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ROOT_COLLECTIONS = [
  'users',
  'tenants',
  'employees',
  'restaurants',
  'supportTickets',
  'auditLogs',
];

const TENANT_SUBCOLLECTIONS = [
  'branches',
  'tables',
  'orders',
  'menu',
  'employees',
  'inventory',
  'diningSessions',
  'waiterRequests',
  'requests',
  'billing',
  'reservations',
  'analytics',
  'notifications',
  'events',
  'automationRules',
  'tasks',
];

async function deleteCollectionDocs(collectionPath) {
  let count = 0;
  try {
    const colRef = collection(db, collectionPath);
    const snap = await getDocs(colRef);
    if (snap.empty) return 0;

    for (const docSnap of snap.docs) {
      await deleteDoc(docSnap.ref);
      count++;
    }
  } catch (err) {
    console.warn(`[Reset] Note while deleting ${collectionPath}:`, err.message);
  }
  return count;
}

async function performReset() {
  const cred = await signInWithEmailAndPassword(auth, runnerCreds.email, runnerCreds.password);
  console.log('[AUTH] Authenticated reset runner as:', cred.user.email);

  const stats = {};

  // 1. Delete subcollections inside restaurants/{tenantId}
  try {
    const rSnap = await getDocs(collection(db, 'restaurants'));
    for (const rDoc of rSnap.docs) {
      const tenantId = rDoc.id;
      for (const sub of TENANT_SUBCOLLECTIONS) {
        const subPath = `restaurants/${tenantId}/${sub}`;
        const deletedSub = await deleteCollectionDocs(subPath);
        stats[subPath] = (stats[subPath] || 0) + deletedSub;
      }
    }
  } catch (err) {
    console.warn('[Reset] Error querying restaurants subcollections:', err.message);
  }

  // 2. Delete root collections
  for (const rootCol of ROOT_COLLECTIONS) {
    const deletedCount = await deleteCollectionDocs(rootCol);
    stats[rootCol] = deletedCount;
  }

  console.log('----------------------------------------------------');
  console.log('DEVELOPMENT DATABASE RESET SUMMARY RESULT');
  console.log('----------------------------------------------------');
  for (const [key, count] of Object.entries(stats)) {
    console.log(`- ${key}: ${count} document(s) deleted`);
  }
  console.log('----------------------------------------------------');
  console.log('✅ Development Firestore database reset completed cleanly.');
  console.log('----------------------------------------------------');
  process.exit(0);
}

performReset().catch((err) => {
  console.error('Fatal error during development reset:', err?.message || err);
  process.exit(1);
});
