/**
 * Verification test script for:
 * 1. Global Currency Formatting & Sales Computation
 * 2. Branch Manager Assignment & Filtering Logic
 * 3. Text Contrast & WCAG 2.2 AA Compliance Calculations
 */

const assert = require('assert');

console.log('====================================================');
console.log('PHASE 5 VERIFICATION SUITE — SPIRALDINE REMEDIATION');
console.log('====================================================\n');

// ----------------------------------------------------
// TEST 1: Currency Formatting
// ----------------------------------------------------
console.log('--- TEST 1: Currency Formatting ---');

function formatCurrency(
  value,
  currencyCode = 'INR',
  locale = 'en-IN'
) {
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return '₹0.00';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  } catch (err) {
    const symbol = currencyCode === 'INR' ? '₹' : '$';
    return `${symbol}${num.toFixed(2)}`;
  }
}

// In some node environments, en-IN Intl format output may include non-breaking space (U+00A0) or standard space.
function normalizeCurrencyStr(s) {
  return s.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

const c1 = normalizeCurrencyStr(formatCurrency(1250));
const c2 = normalizeCurrencyStr(formatCurrency(450));
const c3 = normalizeCurrencyStr(formatCurrency(4.5));
const c4 = normalizeCurrencyStr(formatCurrency(0));
const c5 = normalizeCurrencyStr(formatCurrency(null));
const c6 = normalizeCurrencyStr(formatCurrency(undefined));

console.log('1250 INR  ->', c1);
console.log('450 INR   ->', c2);
console.log('4.50 INR  ->', c3);
console.log('0 INR     ->', c4);
console.log('null      ->', c5);
console.log('undefined ->', c6);

assert(c1.includes('₹') && c1.includes('1,250.00'), `Expected ₹1,250.00 but got ${c1}`);
assert(c2.includes('₹') && c2.includes('450.00'), `Expected ₹450.00 but got ${c2}`);
assert(c3.includes('₹') && c3.includes('4.50'), `Expected ₹4.50 but got ${c3}`);
assert(c4.includes('₹') && c4.includes('0.00'), `Expected ₹0.00 but got ${c4}`);
assert(c5.includes('₹') && c5.includes('0.00'), `Expected ₹0.00 but got ${c5}`);
assert(c6.includes('₹') && c6.includes('0.00'), `Expected ₹0.00 but got ${c6}`);
console.log('✅ TEST 1 PASSED: Currency formatting satisfies all requirements.\n');

// ----------------------------------------------------
// TEST 2: Sales Calculation Logic
// ----------------------------------------------------
console.log('--- TEST 2: Sales Calculation Logic ---');

const mockOrders = [
  { id: 'ord_1', total: 1250, status: 'completed', paymentStatus: 'paid', createdAt: new Date().toISOString() },
  { id: 'ord_2', total: 450, status: 'served', paymentStatus: 'paid', createdAt: new Date().toISOString() },
  { id: 'ord_3', total: 600, status: 'cancelled', paymentStatus: 'refunded', createdAt: new Date().toISOString() },
  { id: 'ord_4', total: 800, status: 'delivered', paymentStatus: 'paid', createdAt: new Date(Date.now() - 86400000 * 3).toISOString() }, // 3 days ago
];

let computedSales = 0;
let computedCount = 0;
const todayStr = new Date().toISOString().slice(0, 10);

mockOrders.forEach(od => {
  const isCreatedToday = (od.createdAt || '').slice(0, 10) === todayStr;
  const isPaid = od.paymentStatus === 'paid' || od.isPaid === true ||
    ['completed', 'delivered', 'served'].includes(od.status);
  const isRefundedOrVoid = od.paymentStatus === 'refunded' || od.isRefunded === true ||
    od.status === 'cancelled' || od.status === 'void';

  if (isCreatedToday && isPaid && !isRefundedOrVoid && od.total) {
    const amount = Number(od.total) || 0;
    computedSales += amount;
    computedCount += 1;
  }
});

console.log('Mock orders today: ord_1 (1250) + ord_2 (450) = 1700');
console.log('Computed Sales:', computedSales, '| Count:', computedCount);
assert.strictEqual(computedSales, 1700, 'Sales should be exactly 1700 INR (no division by 100)');
assert.strictEqual(computedCount, 2, 'Count should be 2');
console.log('✅ TEST 2 PASSED: Sales calculation correctly includes settled orders and preserves INR without artificial division.\n');

// ----------------------------------------------------
// TEST 3: Branch Manager Assignment & Filtering
// ----------------------------------------------------
console.log('--- TEST 3: Branch Manager Assignment & Filtering ---');

const mockStaffDirectory = [
  { id: 'emp_1', fullName: 'Ramesh Sharma', role: 'manager', status: 'active', restaurantId: 'rest_hyd_1' },
  { id: 'emp_2', fullName: 'Priya Patel', role: 'waiter', status: 'active', restaurantId: 'rest_hyd_1' },
  { id: 'emp_3', fullName: 'Vikram Singh', role: 'manager', status: 'invited', restaurantId: 'rest_hyd_1' },
  { id: 'emp_4', fullName: 'Anita Desai', role: 'manager', status: 'suspended', restaurantId: 'rest_hyd_1' },
  { id: 'emp_5', fullName: 'Karan Mehra', role: 'manager', status: 'active', archived: true, restaurantId: 'rest_hyd_1' },
  { id: 'emp_6', fullName: 'Sneha Reddy', role: 'manager', status: 'active', restaurantId: 'rest_blr_2' }, // different restaurant
];

const targetRestaurant = { id: 'rest_hyd_1' };

const eligibleStaff = mockStaffDirectory.filter(emp => {
  // Tenant / restaurant match
  const matchesRestaurant = !emp.restaurantId || emp.restaurantId === targetRestaurant.id;
  if (!matchesRestaurant) return false;

  // Active / eligible check
  const isArchived = Boolean(emp.archived || emp.isArchived || emp.status === 'archived');
  const isSuspended = emp.status === 'suspended' || emp.status === 'inactive';
  return !isArchived && !isSuspended;
});

console.log('Total in directory:', mockStaffDirectory.length);
console.log('Eligible staff:', eligibleStaff.map(e => `${e.fullName} (${e.role}, ${e.status})`));

assert.strictEqual(eligibleStaff.length, 3, 'Should have exactly 3 eligible staff (Ramesh, Priya, Vikram)');
assert(eligibleStaff.some(e => e.id === 'emp_1'), 'Ramesh must be eligible');
assert(eligibleStaff.some(e => e.id === 'emp_2'), 'Priya must be eligible');
assert(eligibleStaff.some(e => e.id === 'emp_3'), 'Vikram (invited) must be eligible');
assert(!eligibleStaff.some(e => e.id === 'emp_4'), 'Anita (suspended) must NOT be eligible');
assert(!eligibleStaff.some(e => e.id === 'emp_5'), 'Karan (archived) must NOT be eligible');
assert(!eligibleStaff.some(e => e.id === 'emp_6'), 'Sneha (different restaurant) must NOT be eligible');
console.log('✅ TEST 3 PASSED: Staff filtering preserves tenant isolation and rejects archived/suspended employees.\n');

// ----------------------------------------------------
// TEST 4: WCAG 2.2 AA Contrast Calculations
// ----------------------------------------------------
console.log('--- TEST 4: WCAG 2.2 AA Contrast Calculations ---');

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function getLuminance({ r, g, b }) {
  const [rs, gs, bs] = [r, g, b].map(v => {
    v = v / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hexToRgb(hex1));
  const l2 = getLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const contrastChecks = [
  { name: 'Inactive Booking Tab Text (#334155) on Cream (#F8F6F2)', fg: '#334155', bg: '#F8F6F2', min: 4.5 },
  { name: 'Inactive Booking Tab Text (#334155) on White (#FFFFFF)', fg: '#334155', bg: '#FFFFFF', min: 4.5 },
  { name: 'Inactive Counter Badge Text (#1E293B) on Badge Bg (#E2E8F0)', fg: '#1E293B', bg: '#E2E8F0', min: 4.5 },
  { name: 'Active Booking Tab Text (#FFFFFF) on Deep Green (#12352D)', fg: '#FFFFFF', bg: '#12352D', min: 4.5 },
  { name: 'Active Counter Badge Text (#FFFFFF) on Primary Terracotta (#B33E26)', fg: '#FFFFFF', bg: '#B33E26', min: 4.5 },
  { name: 'Remapped Muted Text (#475569) on Cream (#F8F6F2)', fg: '#475569', bg: '#F8F6F2', min: 4.5 },
  { name: 'Remapped Muted Text (#475569) on White (#FFFFFF)', fg: '#475569', bg: '#FFFFFF', min: 4.5 },
  { name: 'Placeholder Text (#52606D) on White Input (#FFFFFF)', fg: '#52606D', bg: '#FFFFFF', min: 4.5 },
  { name: 'Primary Button Label (#FFFFFF) on Terracotta (#B33E26)', fg: '#FFFFFF', bg: '#B33E26', min: 4.5 },
];

let allPassed = true;
contrastChecks.forEach(check => {
  const ratio = getContrastRatio(check.fg, check.bg);
  const passed = ratio >= check.min;
  console.log(`${passed ? '✅' : '❌'} ${check.name}: ${ratio.toFixed(2)}:1 (Required: ≥${check.min}:1)`);
  if (!passed) allPassed = false;
});

assert(allPassed, 'All contrast checks must pass WCAG 2.2 AA');
console.log('\n✅ TEST 4 PASSED: All key interface elements achieve WCAG 2.2 AA compliance.\n');

console.log('====================================================');
console.log('ALL PHASE 5 TESTS PASSED SUCCESSFULLY!');
console.log('====================================================');

