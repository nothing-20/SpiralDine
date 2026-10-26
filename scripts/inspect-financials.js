import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query, doc, getDoc } from 'firebase/firestore';
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

async function inspectFinancials() {
  const tenantId = 'spiral-restaurant-ilpc';
  console.log(`=== Inspecting Tenant: ${tenantId} ===`);

  // 1. Check orders
  const ordersSnap = await getDocs(collection(db, `restaurants/${tenantId}/orders`));
  console.log(`\nFound ${ordersSnap.size} orders:`);
  ordersSnap.forEach(d => {
    const data = d.data();
    console.log(`Order ID: ${d.id}`);
    console.log(`  orderNumber: ${data.orderNumber}, status: ${data.status}, paymentStatus: ${data.paymentStatus}`);
    console.log(`  createdAt: ${data.createdAt}`);
    console.log(`  total: ${data.total}, subtotal: ${data.subtotal}, tax: ${data.tax}`);
    console.log(`  items:`, JSON.stringify(data.items));
  });

  // 2. Check transactions
  const transSnap = await getDocs(collection(db, `restaurants/${tenantId}/transactions`));
  console.log(`\nFound ${transSnap.size} transactions:`);
  transSnap.forEach(d => {
    const data = d.data();
    console.log(`Tx ID: ${d.id}`);
    console.log(`  invoiceNumber: ${data.invoiceNumber}, status: ${data.orderStatus || data.status}, paymentStatus: ${data.paymentStatus}`);
    console.log(`  createdAt / orderTime: ${data.createdAt || data.orderTime}`);
    console.log(`  total: ${data.total}, subtotal: ${data.subtotal}, tax: ${data.tax}`);
  });
}

inspectFinancials().catch(console.error);
