import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs } from 'firebase/firestore';
import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  const tenantId = 'yummy-yummy-3p65';
  console.log('=== RESERVATIONS ===');
  const resSnap = await getDocs(collection(db, 'restaurants', tenantId, 'reservations'));
  console.log(`Found ${resSnap.size} reservations:`);
  resSnap.forEach(d => {
    console.log(d.id, JSON.stringify(d.data(), null, 2));
  });

  console.log('=== TABLE TBL-2 ===');
  const tblSnap = await getDoc(doc(db, 'restaurants', tenantId, 'tables', 'TBL-2'));
  if (tblSnap.exists()) {
    console.log('TBL-2:', JSON.stringify(tblSnap.data(), null, 2));
  } else {
    console.log('TBL-2 does not exist, checking all tables:');
    const allTables = await getDocs(collection(db, 'restaurants', tenantId, 'tables'));
    allTables.forEach(t => console.log(t.id, JSON.stringify(t.data(), null, 2)));
  }

  console.log('=== ORDERS ===');
  const ordersSnap = await getDocs(collection(db, 'restaurants', tenantId, 'orders'));
  console.log(`Found ${ordersSnap.size} orders:`);
  ordersSnap.forEach(o => {
    const data = o.data();
    console.log(o.id, data.orderId, data.status, data.paymentStatus, data.total, data.tableNumber, data.tableId);
  });
}

inspect().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
