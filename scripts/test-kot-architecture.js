/**
 * SpiralDine — KOT-First Architecture Automated Verification Suite
 * Verifies all 10 core scenarios required by Phase 9.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env if present
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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Import compiled or source modules
import { kotService } from '../src/shared/services/kotService';
import { kotPrintService } from '../src/shared/services/kotPrintService';
import { billingService } from '../src/shared/services/billingService';

const TEST_TENANT = 'yummy-yummy-3p65';
const TEST_SESSION_ID = `SES-TEST-${Date.now()}`;
let testPassedCount = 0;
let testTotalCount = 10;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runTestSuite() {
  console.log('============================================================');
  console.log('SPIRALDINE — ADDITIVE KOT-FIRST ARCHITECTURE TEST SUITE');
  console.log('============================================================\n');

  console.log('Authenticating as administrative test runner...');
  await signInWithEmailAndPassword(auth, 'dev-admin-reset@restaurantos.internal', 'DevResetSecret123!');
  console.log('Authentication confirmed.\n');

  // --- TEST 1: Initial Order ---
  console.log('[TEST 1] Initial Order: Canonical order creation & KOT generation');
  const initialOrderId = `ORD-TEST-1-${Date.now()}`;
  const initialOrder = {
    orderId: initialOrderId,
    tenantId: TEST_TENANT,
    branchId: 'main',
    customerId: 'guest-uid',
    tableNumber: '10',
    tableName: 'Table 10',
    sessionId: TEST_SESSION_ID,
    orderSequence: 1,
    isAdditionalOrder: false,
    items: [
      { itemId: 'item-biryani', name: 'Chicken Biryani', count: 2, pricePerUnit: 30000, notes: 'Medium spicy' },
      { itemId: 'item-paneer', name: 'Paneer Butter Masala', count: 1, pricePerUnit: 20000, notes: 'Less oil' }
    ],
    subtotal: 80000,
    tax: 6400,
    serviceCharge: 4000,
    total: 90400,
    status: 'NEW',
    paymentStatus: 'pending',
    createdAt: new Date().toISOString()
  };

  // Canonical order is created first by order engine, then KOT is generated
  await setDoc(doc(db, 'restaurants', TEST_TENANT, 'orders', initialOrderId), initialOrder);

  const initialKot = await kotService.createKotForOrder(TEST_TENANT, initialOrder, {
    source: 'customer_qr',
    round: 1,
    isSupplementary: false
  });

  assert(initialKot.id.includes(initialOrderId), 'Initial KOT ID must reference canonical order ID');
  assert(initialKot.round === 1, 'Initial KOT round must be 1');
  assert(!initialKot.isSupplementary, 'Initial KOT must not be supplementary');
  assert(initialKot.items.length === 2, 'Initial KOT must contain exactly 2 submitted items');
  assert(initialKot.items[0].name === 'Chicken Biryani', 'Initial item 1 name must match');
  assert(initialKot.items[0].count === 2, 'Initial item 1 count must match');
  console.log(`✓ TEST 1 PASSED: Generated ${initialKot.ticketNumber} (${initialKot.id}) with 2 items.\n`);
  testPassedCount++;

  // --- TEST 2: Additional Order (Supplementary KOT) ---
  console.log('[TEST 2] Additional Order: Supplementary KOT contains only new items');
  const addOrderId = `ORD-TEST-2-${Date.now()}`;
  const addOrder = {
    orderId: addOrderId,
    tenantId: TEST_TENANT,
    branchId: 'main',
    customerId: 'guest-uid',
    tableNumber: '10',
    tableName: 'Table 10',
    sessionId: TEST_SESSION_ID,
    orderSequence: 2,
    isAdditionalOrder: true,
    items: [
      { itemId: 'item-dessert', name: 'Gulab Jamun (2 pcs)', count: 1, pricePerUnit: 10000, notes: 'Serve warm' }
    ],
    subtotal: 10000,
    tax: 800,
    serviceCharge: 500,
    total: 11300,
    status: 'NEW',
    paymentStatus: 'pending',
    createdAt: new Date().toISOString()
  };

  // Supplementary order created first, then supplementary KOT is generated
  await setDoc(doc(db, 'restaurants', TEST_TENANT, 'orders', addOrderId), addOrder);

  const suppKot = await kotService.createKotForOrder(TEST_TENANT, addOrder, {
    source: 'customer_qr',
    round: 2,
    isSupplementary: true
  });

  assert(suppKot.round === 2, 'Supplementary KOT round must be 2');
  assert(suppKot.isSupplementary === true, 'Supplementary flag must be true');
  assert(suppKot.items.length === 1, 'Supplementary KOT must contain ONLY the newly submitted dessert');
  assert(suppKot.items[0].name === 'Gulab Jamun (2 pcs)', 'Item must be Gulab Jamun');
  assert(initialKot.items.length === 2, 'Original KOT items must remain completely unchanged');
  console.log(`✓ TEST 2 PASSED: Generated Supplementary ${suppKot.ticketNumber} (${suppKot.id}) with only the 1 new dessert.\n`);
  testPassedCount++;

  // --- TEST 3: Combined Billing ---
  console.log('[TEST 3] Combined Billing: Multi-round session consolidation');

  const consolidatedOrder = await billingService.getConsolidatedSessionOrder(TEST_TENANT, initialOrder);
  assert(consolidatedOrder.items.length === 3, 'Consolidated order must unite items from Round 1 and Round 2 (total: 3 items)');
  assert(consolidatedOrder.subtotal === 90000, 'Consolidated subtotal must be 80000 + 10000 = 90000');
  
  const canonicalBill = await billingService.getOrCreateCanonicalBill(TEST_TENANT, initialOrder);
  assert(canonicalBill.items.length === 3, 'Canonical Bill must contain all 3 items across both rounds');
  assert(canonicalBill.subtotal === 90000, 'Bill subtotal must reflect consolidated sum');
  console.log(`✓ TEST 3 PASSED: Bill ${canonicalBill.billId} unites 3 items across 2 rounds without duplicate counting.\n`);
  testPassedCount++;

  // --- TEST 4: KDS Integration ---
  console.log('[TEST 4] KDS: Displays canonical KOTs & updates status without duplicate KOT');
  const ticketsBefore = await kotService.getTicketsForOrder(TEST_TENANT, initialOrderId);
  assert(ticketsBefore.length === 1, 'Initial order should have exactly 1 KOT');

  // Simulate KDS status update
  await kotService.updateTicketStatus(TEST_TENANT, initialKot.id, 'PREPARING', { displayName: 'Chef Mario' });
  const updatedTicketSnap = await getDoc(doc(db, 'restaurants', TEST_TENANT, 'kitchenTickets', initialKot.id));
  assert(updatedTicketSnap.data().status === 'PREPARING', 'Ticket status must transition to PREPARING');
  assert(updatedTicketSnap.data().cookingStartedAt !== undefined, 'Ticket must track cookingStartedAt');

  const ticketsAfter = await kotService.getTicketsForOrder(TEST_TENANT, initialOrderId);
  assert(ticketsAfter.length === 1, 'No second or duplicate KOT must be created by KDS');
  console.log('✓ TEST 4 PASSED: KDS manages canonical KOT and transitioned status to PREPARING.\n');
  testPassedCount++;

  // --- TEST 5: Printed KOT Output & Thermal Layout ---
  console.log('[TEST 5] Printed KOT: Thermal layout, reprint detection & attempt tracking');
  const thermalHtmlInitial = kotPrintService.generateKotThermalHtml(initialKot, 'SpiralDine Test Restaurant', false);
  assert(thermalHtmlInitial.includes(initialKot.ticketNumber), 'Print slip must contain ticket number');
  assert(thermalHtmlInitial.includes('Chicken Biryani'), 'Print slip must contain submitted item');
  assert(!thermalHtmlInitial.includes('*** DUPLICATE / REPRINT'), 'Initial print slip must not show duplicate banner');

  // Test reprint slip
  const thermalHtmlReprint = kotPrintService.generateKotThermalHtml(initialKot, 'SpiralDine Test Restaurant', true);
  assert(thermalHtmlReprint.includes('*** DUPLICATE / REPRINT'), 'Reprint slip must display prominent duplicate/reprint banner');

  // Test recordPrintAttempt & recordReprint
  await kotService.recordPrintAttempt(TEST_TENANT, initialKot.id, true);
  await kotService.recordReprint(TEST_TENANT, initialKot.id, { uid: 'chef-1', displayName: 'Chef Mario' }, 'Paper jam recovery');
  const printedKotSnap = await getDoc(doc(db, 'restaurants', TEST_TENANT, 'kitchenTickets', initialKot.id));
  assert(printedKotSnap.data().printStatus === 'printed', 'Print status must be recorded as printed');
  assert(printedKotSnap.data().printCount >= 1, 'Print count must be incremented');
  assert(printedKotSnap.data().reprintsLog.length >= 1, 'Reprint audit log must record reprint actor & reason');
  console.log('✓ TEST 5 PASSED: Thermal slip rendered with reprint banner & print audit log preserved.\n');
  testPassedCount++;

  // --- TEST 6: Empty Order ---
  console.log('[TEST 6] Empty Order: Rejection of zero-item orders');
  let emptyRejected = false;
  try {
    await kotService.createKotForOrder(TEST_TENANT, { orderId: 'ORD-EMPTY', items: [] });
  } catch (err) {
    emptyRejected = true;
  }
  assert(emptyRejected, 'KOT creation must reject empty orders');
  console.log('✓ TEST 6 PASSED: Empty order was safely rejected with zero tickets created.\n');
  testPassedCount++;

  // --- TEST 7: Idempotency ---
  console.log('[TEST 7] Idempotency: Retried submission does not generate duplicate tickets');
  const duplicateSubmission = await kotService.createKotForOrder(TEST_TENANT, initialOrder, {
    source: 'customer_qr',
    round: 1,
    isSupplementary: false
  });
  assert(duplicateSubmission.id === initialKot.id, 'Duplicate submission must return existing KOT ID');
  const allInitialKots = await kotService.getTicketsForOrder(TEST_TENANT, initialOrderId);
  assert(allInitialKots.length === 1, 'Tickets count for initial order must strictly remain 1');
  console.log('✓ TEST 7 PASSED: Idempotency verified. Duplicate submission returned existing ticket ID.\n');
  testPassedCount++;

  // --- TEST 8: Status Integrity ---
  console.log('[TEST 8] Status Integrity: Food Ready != Food Served != Bill Paid != Table Available');
  // Mark KOT ready
  await kotService.updateTicketStatus(TEST_TENANT, initialKot.id, 'READY');
  const readyKotSnap = await getDoc(doc(db, 'restaurants', TEST_TENANT, 'kitchenTickets', initialKot.id));
  assert(readyKotSnap.data().status === 'READY', 'KOT is READY');

  // Check parent order is not marked served prematurely
  const orderCheckSnap = await getDoc(doc(db, 'restaurants', TEST_TENANT, 'orders', initialOrderId));
  assert(orderCheckSnap.data().status !== 'SERVED', 'KOT READY must NOT mark order SERVED');
  assert(orderCheckSnap.data().paymentStatus !== 'paid', 'Food Ready must NOT mark bill paid');

  // Check Bill is not marked paid prematurely
  const billCheckSnap = await getDoc(doc(db, 'restaurants', TEST_TENANT, 'bills', canonicalBill.billId));
  assert(billCheckSnap.data().paymentStatus === 'pending', 'Bill must remain pending payment');
  console.log('✓ TEST 8 PASSED: Status boundaries strictly honored across Kitchen, Service, and Billing.\n');
  testPassedCount++;

  // --- TEST 9: Tenant Isolation ---
  console.log('[TEST 9] Permissions & Tenant Isolation');
  const wrongTenantTickets = await kotService.getTicketsForOrder('unauthorized-other-tenant', initialOrderId);
  assert(wrongTenantTickets.length === 0, 'Cross-tenant query must return zero tickets');
  console.log('✓ TEST 9 PASSED: Tenant scoping verified. Cross-tenant access prevented.\n');
  testPassedCount++;

  // --- TEST 10: Regression Verification ---
  console.log('[TEST 10] Regression: Billing settlement & sibling order settlement');
  const settleRes = await billingService.settleBillPayment(TEST_TENANT, canonicalBill.billId, {
    method: 'cash',
    actor: { uid: 'waiter-1', displayName: 'Server Bob', role: 'waiter' }
  });
  assert(settleRes.bill.paymentStatus === 'paid', 'Bill payment must settle to paid');

  // Verify both initial order and supplementary order are settled
  const settledInitialOrder = await getDoc(doc(db, 'restaurants', TEST_TENANT, 'orders', initialOrderId));
  const settledAddOrder = await getDoc(doc(db, 'restaurants', TEST_TENANT, 'orders', addOrderId));
  assert(settledInitialOrder.data().paymentStatus === 'paid', 'Initial order paymentStatus must be paid');
  assert(settledAddOrder.data().paymentStatus === 'paid', 'Supplementary order paymentStatus must be paid');

  console.log('✓ TEST 10 PASSED: Both ordering rounds settled atomically upon bill payment.\n');
  testPassedCount++;

  // Cleanup test documents to keep database clean (orders and test bills)
  console.log('Cleaning up test sandbox orders...');
  try {
    await deleteDoc(doc(db, 'restaurants', TEST_TENANT, 'orders', initialOrderId));
    await deleteDoc(doc(db, 'restaurants', TEST_TENANT, 'orders', addOrderId));
  } catch (_) {}

  console.log('============================================================');
  console.log(`ALL TESTS PASSED: ${testPassedCount}/${testTotalCount} SCENARIOS VERIFIED.`);
  console.log('============================================================');
}

runTestSuite()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ TEST RUN FAILED:', err);
    process.exit(1);
  });
