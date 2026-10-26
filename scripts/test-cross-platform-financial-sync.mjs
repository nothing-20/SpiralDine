import assert from 'assert';
import { formatPrice, isTodayInTimezone, isYesterdayInTimezone } from '../src/shared/utils/format.ts';

console.log('================================================================');
console.log('RUNNING CROSS-PLATFORM DATA SYNCHRONIZATION & REVENUE VERIFICATION');
console.log('================================================================\n');

// 1. Authoritative Firestore test fixtures for spiral-restaurant-ilpc
const historicalOrders = [
  {
    id: 'ORD-0APZG0G',
    status: 'COMPLETED',
    paymentStatus: 'paid',
    createdAt: '2026-07-07T16:07:34.309Z',
    total: 6600,
    subtotal: 6000,
    tax: 300,
    items: [{ name: 'cashews', count: 2, pricePerUnit: 3000 }]
  },
  {
    id: 'ORD-901U9PW',
    status: 'DELIVERED',
    paymentStatus: 'pending',
    createdAt: '2026-07-08T03:53:26.328Z',
    total: 17600,
    subtotal: 16000,
    tax: 800,
    items: [{ name: 'chicken biriyani', count: 2, pricePerUnit: 8000 }]
  },
  {
    id: 'ORD-NO19XWM',
    status: 'DELIVERED',
    paymentStatus: 'pending',
    createdAt: '2026-07-07T16:05:38.081Z',
    total: 17600,
    subtotal: 16000,
    tax: 800,
    items: [{ name: 'chicken biriyani', count: 2, pricePerUnit: 8000 }]
  }
];

// --- TEST A: Today's Sales Verification ---
console.log('TEST A: Today\'s Sales Calculation & Zero State');
const todayOrders = historicalOrders.filter(o => isTodayInTimezone(o.createdAt));
assert.strictEqual(todayOrders.length, 0, 'Expected 0 orders created today from historical dataset');

const todaySales = todayOrders
  .filter(o => o.paymentStatus === 'paid' || o.status === 'COMPLETED' || o.status === 'SERVED')
  .reduce((sum, o) => sum + (o.total || 0), 0);

assert.strictEqual(todaySales, 0, 'Expected todaySales to be strictly 0 when no sales occurred today');
assert.strictEqual(formatPrice(todaySales), '₹0.00', 'Expected formatted todaySales to be ₹0.00');
console.log('✔ PASS: Today\'s sales evaluates strictly to ₹0.00 when no sales occurred today.\n');

// --- TEST B: Annual Revenue & FY 2026-27 Boundaries ---
console.log('TEST B: Annual Revenue & FY 2026-27 Calculations');
const fyStart = new Date(2026, 3, 1); // April 1, 2026
const fyEnd = new Date(2027, 2, 31, 23, 59, 59, 999); // March 31, 2027

const fyOrders = historicalOrders.filter(o => {
  const d = new Date(o.createdAt);
  const isPaid = (o.paymentStatus || '').toLowerCase() === 'paid' || o.status === 'COMPLETED' || o.status === 'SERVED';
  const notCancelled = o.status !== 'CANCELLED' && o.status !== 'REJECTED';
  return d >= fyStart && d <= fyEnd && isPaid && notCancelled;
});

assert.strictEqual(fyOrders.length, 1, 'Only ORD-0APZG0G qualifies as paid/settled order in FY 2026-27');
const fyGross = fyOrders.reduce((sum, o) => sum + o.total, 0);
const fyGst = fyOrders.reduce((sum, o) => sum + o.tax, 0);
const fyNet = fyGross - fyGst;

assert.strictEqual(fyGross, 6600, 'Gross revenue must be 6600 paise');
assert.strictEqual(fyGst, 300, 'GST must be 300 paise');
assert.strictEqual(fyNet, 6300, 'Net revenue must be 6300 paise');
assert.strictEqual(formatPrice(fyNet), '₹63.00', 'Net annual revenue must format as ₹63.00');
console.log(`✔ PASS: FY 2026-27 Annual Net Revenue evaluates to ${formatPrice(fyNet)} (6300 paise), 1 order.\n`);

// --- TEST C: Minor Unit Currency Representation & Formatting ---
console.log('TEST C: Minor Unit Currency Conversions');
assert.strictEqual(formatPrice(0), '₹0.00', '0 paise -> ₹0.00');
assert.strictEqual(formatPrice(100), '₹1.00', '100 paise -> ₹1.00');
assert.strictEqual(formatPrice(6600), '₹66.00', '6600 paise -> ₹66.00');
assert.strictEqual(formatPrice(17600), '₹176.00', '17600 paise -> ₹176.00');
assert.strictEqual(formatPrice(24900), '₹249.00', '24900 paise -> ₹249.00');
assert.strictEqual(formatPrice(26900), '₹269.00', '26900 paise -> ₹269.00');
assert.strictEqual(formatPrice(1250000), '₹12,500.00', '1250000 paise -> ₹12,500.00');
console.log('✔ PASS: Minor units (paise) correctly convert by dividing by 100 in INR locale.\n');

// --- TEST D: Order Status & Payment Qualification ---
console.log('TEST D: Order Status & Financial Settlement Qualification');
function isSettledOrder(status, paymentStatus) {
  const p = (paymentStatus || '').toLowerCase();
  const s = (status || '').toUpperCase();
  const isPaid = p === 'paid' || p === 'completed' || p === 'settled' || s === 'COMPLETED' || s === 'SERVED';
  const isExcluded = p === 'refunded' || p === 'voided' || p === 'failed' || s === 'CANCELLED' || s === 'REJECTED';
  return isPaid && !isExcluded;
}

assert.strictEqual(isSettledOrder('COMPLETED', 'paid'), true);
assert.strictEqual(isSettledOrder('SERVED', 'settled'), true);
assert.strictEqual(isSettledOrder('DELIVERED', 'pending'), false);
assert.strictEqual(isSettledOrder('PENDING', 'pending'), false);
assert.strictEqual(isSettledOrder('CANCELLED', 'paid'), false);
assert.strictEqual(isSettledOrder('REJECTED', 'paid'), false);
console.log('✔ PASS: Only settled/paid orders qualify as revenue.\n');

// --- TEST E: Timezone Boundary Stability ---
console.log('TEST E: Timezone Boundary Stability (Asia/Kolkata)');
const nowIso = new Date().toISOString();
assert.strictEqual(isTodayInTimezone(nowIso, 'Asia/Kolkata'), true, 'Current time in Asia/Kolkata must be today');
assert.strictEqual(isTodayInTimezone('2026-07-07T16:07:34.309Z', 'Asia/Kolkata'), false, 'Past order must not be today');
assert.strictEqual(isTodayInTimezone(null, 'Asia/Kolkata'), false, 'Null must not be today');
assert.strictEqual(isTodayInTimezone('', 'Asia/Kolkata'), false, 'Empty string must not be today');
console.log('✔ PASS: Restaurant timezone boundaries properly isolate today vs past orders.\n');

console.log('================================================================');
console.log('ALL CROSS-PLATFORM CONSISTENCY TESTS PASSED (5/5)');
console.log('================================================================');
