import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const {
  normalizeEnvName,
  parseCliFlags,
  loadScriptEnvironment,
  resolveScriptFirebaseConfig,
  resolveRunnerCredentials,
} = require('./_lib/envGuard.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const flags = parseCliFlags();
const targetEnv = normalizeEnvName(flags.env || process.env.APP_ENV || 'development');

loadScriptEnvironment({ rootDir: resolve(__dirname, '..'), envName: targetEnv });

const firebaseConfig = resolveScriptFirebaseConfig(process.env, { expectedEnv: targetEnv });
const runnerCreds = resolveRunnerCredentials(process.env);

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

async function inspectAsAuth() {
  await signInWithEmailAndPassword(auth, runnerCreds.email, runnerCreds.password);
  console.log('Signed in as admin. Fetching employees/de1NBlrKBeshTSj611v2...');
  const snap = await getDoc(doc(db, 'employees', 'de1NBlrKBeshTSj611v2'));
  if (snap.exists()) {
    const d = snap.data();
    console.log('CONFIRMED DOCUMENT DATA:');
    console.log('  fullName:        ', d.fullName);
    console.log('  email:           ', d.email);
    console.log('  role:            ', d.role);
    console.log('  tenantId:        ', d.tenantId);
    console.log('  status:          ', d.status);
    console.log('  activationStatus:', d.activationStatus);
    console.log('  firebaseUid:     ', d.firebaseUid);
    console.log('  expiresAt:       ', d.expiresAt);
  } else {
    console.log('Document does not exist');
  }
}

inspectAsAuth();
