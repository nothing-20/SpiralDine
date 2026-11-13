import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';
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

async function auditRealKot() {
  const tenantId = 'yummy-yummy-3p65';
  const orderId = 'ORD-20261011-CNH6HU';
  const expectedKotId = `KOT-${orderId}-R1`;

  console.log('Authenticating as admin...');
  await signInWithEmailAndPassword(auth, runnerCreds.email, runnerCreds.password);
  console.log('Admin authenticated.');

  console.log(`\n=== 1. VERIFY ORDER: restaurants/${tenantId}/orders/${orderId} ===`);
  const orderSnap = await getDoc(doc(db, `restaurants/${tenantId}/orders`, orderId));
  if (orderSnap.exists()) {
    console.log('ORDER EXISTS. Data:');
    console.log(JSON.stringify(orderSnap.data(), null, 2));
  } else {
    console.log('ORDER DOES NOT EXIST!');
  }

  console.log(`\n=== 2. VERIFY EXPECTED KOT: restaurants/${tenantId}/kitchenTickets/${expectedKotId} ===`);
  const kotSnap = await getDoc(doc(db, `restaurants/${tenantId}/kitchenTickets`, expectedKotId));
  if (kotSnap.exists()) {
    console.log('KOT DOCUMENT EXISTS! Full Fields:');
    console.log(JSON.stringify(kotSnap.data(), null, 2));
  } else {
    console.log(`KOT DOCUMENT ${expectedKotId} DOES NOT EXIST!`);
  }

  console.log(`\n=== 3. LIST ALL KOTS IN restaurants/${tenantId}/kitchenTickets ===`);
  const allKotsSnap = await getDocs(collection(db, `restaurants/${tenantId}/kitchenTickets`));
  console.log(`Total documents: ${allKotsSnap.size}`);
  allKotsSnap.forEach(d => {
    const data = d.data();
    console.log(`\nTicket Document ID: ${d.id}`);
    console.log(`  tenantId:        ${data.tenantId}`);
    console.log(`  orderId:         ${data.orderId}`);
    console.log(`  ticketNumber:    ${data.ticketNumber} (numeric: ${data.numericTicketNumber})`);
    console.log(`  round:           ${data.round} (isSupplementary: ${data.isSupplementary})`);
    console.log(`  tableNumber:     ${data.tableNumber} (tableName: ${data.tableName})`);
    console.log(`  source:          ${data.source}`);
    console.log(`  station:         ${data.station}`);
    console.log(`  status:          ${data.status}`);
    console.log(`  printStatus:     ${data.printStatus}`);
    console.log(`  createdAt:       ${data.createdAt}`);
    console.log(`  items count:     ${data.items ? data.items.length : 0}`);
    if (data.items) {
      data.items.forEach(it => console.log(`    - Item: ${it.name} x${it.count} [${it.station || 'no station'}]`));
    }
  });
}

auditRealKot().catch(console.error);
