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

function cleanTableIdentifier(val) {
  return String(val || '')
    .trim()
    .replace(/^(table|tbl)[-\s]*/i, '')
    .trim();
}

function matchesTable(res, table) {
  if (!res || !table) return false;
  const cleanTableNum = cleanTableIdentifier(table.number || table.tableNumber || table.id);

  if (table.reservationId && (table.reservationId === res.id || table.reservationId === res.bookingId)) {
    return true;
  }
  if (res.assignedTableId && (res.assignedTableId === table.id || res.assignedTableId === `TBL-${cleanTableNum}`)) {
    return true;
  }
  if (res.tableId && (res.tableId === table.id || res.tableId === `TBL-${cleanTableNum}`)) {
    return true;
  }
  const resAssignedNum = cleanTableIdentifier(res.assignedTableNumber || res.tableNumber);
  if (resAssignedNum && cleanTableNum && resAssignedNum === cleanTableNum) {
    return true;
  }
  return false;
}

async function executeTableReleaseAndReservationCompletion(tenantId, tableIdentifier) {
  console.log(`Executing table release for tenant: ${tenantId}, table: ${tableIdentifier}`);
  
  const cleanNum = cleanTableIdentifier(tableIdentifier);
  const targetTableId = String(tableIdentifier).startsWith('TBL-') ? String(tableIdentifier) : `TBL-${cleanNum}`;
  const tableRef = doc(db, 'restaurants', tenantId, 'tables', targetTableId);

  // 1. Fetch current table state
  const currentSnap = await getDoc(tableRef);
  if (!currentSnap.exists()) {
    console.error('Table does not exist!');
    return false;
  }
  const tableData = currentSnap.data();
  const associatedResId = tableData.reservationId || null;
  const hadBillPaidAt = tableData.billPaidAt || null;

  console.log(`Current Table State: status=${tableData.status}, resId=${associatedResId}, billPaidAt=${hadBillPaidAt}`);

  // 2. Set table to Available
  const nowIso = new Date().toISOString();
  await setDoc(tableRef, {
    status: 'Available',
    tableStatus: 'Available',
    subStatus: null,
    diningStatus: null,
    customerPresent: false,
    activeOrderId: null,
    currentOrderId: null,
    guestsCount: 0,
    tableNotes: '',
    cleaningCompletedAt: nowIso,
    cleaningStartedAt: null,
    cleaningDurationMinutes: null,
    seatedAt: null,
    occupiedAt: null,
    billPaidAt: null,
    customerName: null,
    customerPhone: null,
    reservationId: null,
    updatedAt: nowIso
  }, { merge: true });

  console.log('Table set to Available successfully.');

  // 3. Find candidate reservation
  const resCol = collection(db, 'restaurants', tenantId, 'reservations');
  let candidateRes = null;

  if (associatedResId) {
    const directSnap = await getDoc(doc(db, 'restaurants', tenantId, 'reservations', associatedResId));
    if (directSnap.exists() && directSnap.data().status === 'Seated') {
      candidateRes = { id: directSnap.id, ...directSnap.data() };
    }
  }

  if (!candidateRes) {
    const qSeated = query(resCol, where('status', '==', 'Seated'), limit(20));
    const seatedSnap = await getDocs(qSeated);
    seatedSnap.forEach(d => {
      const r = { id: d.id, ...d.data() };
      if (matchesTable(r, { id: targetTableId, ...tableData })) {
        candidateRes = r;
      }
    });
  }

  if (!candidateRes) {
    console.log('No candidate seated reservation found for this table.');
    return false;
  }

  console.log(`Found candidate seated reservation: ${candidateRes.id} (${candidateRes.customerName})`);

  // 4. Verify payment
  const ordersCol = collection(db, 'restaurants', tenantId, 'orders');
  const ordersSnap = await getDocs(ordersCol);
  const tableOrders = [];
  ordersSnap.forEach(d => {
    const o = { id: d.id, ...d.data() };
    const ordTableNum = cleanTableIdentifier(o.tableNumber || o.tableId);
    const isMatchingTable = ordTableNum && cleanNum && ordTableNum === cleanNum;
    const isMatchingCustomer = candidateRes.customerId && o.customerId && candidateRes.customerId === o.customerId && candidateRes.customerId !== 'guest-uid';
    const isMatchingOrder = (candidateRes.orderId && candidateRes.orderId === o.orderId);
    const isMatchingRes = o.reservationId && (o.reservationId === candidateRes.id || o.reservationId === candidateRes.bookingId);

    if (isMatchingRes || isMatchingOrder || isMatchingTable || isMatchingCustomer) {
      tableOrders.push(o);
    }
  });

  const activeUnpaidOrder = tableOrders.find(o => {
    const pStatus = (o.paymentStatus || '').toLowerCase();
    const oStatus = (o.status || '').toUpperCase();
    const hasBalance = (o.total || 0) > 0;
    return oStatus !== 'CANCELLED' && oStatus !== 'ARCHIVED' && pStatus !== 'paid' && hasBalance;
  });

  if (activeUnpaidOrder) {
    console.warn('Active unpaid order found, cannot complete reservation:', activeUnpaidOrder.id);
    return false;
  }

  const hasPaidOrder = tableOrders.some(o => (o.paymentStatus || '').toLowerCase() === 'paid');
  const hasTableBillPaid = Boolean(hadBillPaidAt);
  const isPlaceholderCheckInOnly = tableOrders.length === 0 || tableOrders.every(o => (o.total || 0) === 0);

  if (!hasPaidOrder && !hasTableBillPaid && !isPlaceholderCheckInOnly) {
    console.warn('Payment not satisfied!');
    return false;
  }

  console.log('Payment verified as satisfied.');

  // 5. Transition reservation to COMPLETED
  const updatePayload = {
    status: 'Completed',
    completedAt: nowIso,
    diningCompleted: true,
    updatedAt: nowIso
  };

  const resDocRef = doc(db, 'restaurants', tenantId, 'reservations', candidateRes.id);
  await updateDoc(resDocRef, updatePayload);
  console.log(`Reservation ${candidateRes.id} successfully updated to Completed!`);

  if (candidateRes.customerId && candidateRes.customerId !== 'guest-uid') {
    try {
      const custResRef = doc(db, 'customers', candidateRes.customerId, 'reservations', candidateRes.id);
      await updateDoc(custResRef, updatePayload).catch(() => {});
    } catch (_) {}
    try {
      const userResRef = doc(db, 'users', candidateRes.customerId, 'reservations', candidateRes.id);
      await updateDoc(userResRef, updatePayload).catch(() => {});
    } catch (_) {}
  }

  return true;
}

executeTableReleaseAndReservationCompletion('yummy-yummy-3p65', 'TBL-2')
  .then((res) => {
    console.log('Result:', res);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
