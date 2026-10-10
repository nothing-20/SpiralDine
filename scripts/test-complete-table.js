import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, limit } from 'firebase/firestore';
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

async function testComplete() {
  const tenantId = 'yummy-yummy-3p65';
  const tableId = 'TBL-2';

  // Check Table 2
  const tblSnap = await getDoc(doc(db, 'restaurants', tenantId, 'tables', tableId));
  console.log('Current Table 2 status:', tblSnap.data()?.status, 'reservationId:', tblSnap.data()?.reservationId);

  // Check RES-821720
  const resSnap = await getDoc(doc(db, 'restaurants', tenantId, 'reservations', 'RES-821720'));
  console.log('Current RES-821720 status:', resSnap.data()?.status);
}

testComplete().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
