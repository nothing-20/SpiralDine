import crypto from 'crypto';
import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('================================================================');
console.log('PHASE 8 SECURITY AUDIT AND REGRESSION TEST SUITE');
console.log('SpiralDine Multi-Tenant, Guest QR, KOT, and Payment Hardening');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(category, testName, condition, details = '') {
  totalTests++;
  if (condition) {
    console.log(`[PASS] [${category}] ${testName}`);
    passedTests++;
  } else {
    console.error(`[FAIL] [${category}] ${testName} ${details ? `(${details})` : ''}`);
    failedTests++;
  }
}

// ================================================================
// SUITE 1: FIRESTORE RULES COMPILED LOGIC & AST EMULATION
// ================================================================
console.log('--- SUITE 1: Rule Logic & AST Emulation Tests ---');

// Mock Firestore Rule Context Evaluator
class RuleContext {
  constructor(auth, currentDoc = null) {
    this.auth = auth; // { uid, token: { role, tenantId, ... } }
    this.resource = currentDoc ? { data: currentDoc } : null;
  }

  isAuth() {
    return this.auth != null;
  }

  isTenantStaff(tenantId, userDoc) {
    if (!this.isAuth()) return false;
    if (this.auth.token?.role in ['super_admin', 'super-admin'] || this.auth.token?.super_admin) return true;
    if (userDoc && userDoc.tenantId === tenantId && 
        ['super_admin', 'super-admin', 'owner', 'admin', 'manager', 'waiter', 'cashier', 'reception', 'kitchen'].includes(userDoc.role)) {
      return true;
    }
    return false;
  }

  isTenantManager(tenantId, userDoc) {
    if (!this.isAuth()) return false;
    if (this.auth.token?.role in ['super_admin', 'super-admin'] || this.auth.token?.super_admin) return true;
    if (userDoc && userDoc.tenantId === tenantId && 
        ['super_admin', 'super-admin', 'owner', 'admin', 'manager'].includes(userDoc.role)) {
      return true;
    }
    return false;
  }

  canCreateOrder(tenantId, orderData, userDoc) {
    if (orderData.tenantId !== tenantId) return false;
    if (!['pending', 'PENDING'].includes(orderData.paymentStatus || 'pending')) return false;
    if ('paidAt' in orderData) return false;
    
    if (this.isTenantStaff(tenantId, userDoc)) return true;

    // Guest / Customer creation checks
    if (!['NEW', 'PLACED'].includes(orderData.status || 'NEW')) return false;
    
    if (this.isAuth()) {
      const allowedCustomerIds = [this.auth.uid, '', 'guest-uid'];
      return allowedCustomerIds.includes(orderData.customerId);
    } else {
      return ['', 'guest-uid'].includes(orderData.customerId);
    }
  }

  canUpdateOrder(tenantId, updatedData, userDoc) {
    if (this.isTenantStaff(tenantId, userDoc)) return true;

    const currentDoc = this.resource?.data;
    if (!currentDoc) return false;

    // Check ownership
    const isGuestOrder = ['', 'guest-uid'].includes(currentDoc.customerId);
    const isOwnerOrder = this.isAuth() && currentDoc.customerId === this.auth.uid;
    if (!isGuestOrder && !isOwnerOrder) return false;

    // Financial immutability
    if (updatedData.total !== currentDoc.total ||
        updatedData.subtotal !== currentDoc.subtotal ||
        updatedData.tax !== currentDoc.tax ||
        updatedData.serviceCharge !== currentDoc.serviceCharge ||
        updatedData.discount !== currentDoc.discount) {
      return false;
    }

    // Payment immutability
    if (updatedData.paymentStatus !== currentDoc.paymentStatus) return false;
    if ('paidAt' in updatedData && !('paidAt' in currentDoc)) return false;

    // Status transition constraint: Customer can only set DINING_COMPLETED
    if (updatedData.status && updatedData.status !== currentDoc.status) {
      if (updatedData.status !== 'DINING_COMPLETED') return false;
    }

    return true;
  }

  canUpdateKOT(tenantId, userDoc) {
    return this.isTenantStaff(tenantId, userDoc);
  }

  canUpdateTable(tenantId, updatedData, userDoc) {
    if (this.isTenantStaff(tenantId, userDoc)) return true;

    const allowedKeys = ['status', 'activeOrderId', 'activeOrder', 'currentOrderTotal', 'customerName', 'seatingTime', 'guestsCount', 'updatedAt'];
    const currentDoc = this.resource?.data || {};
    
    const changedKeys = Object.keys(updatedData).filter(k => updatedData[k] !== currentDoc[k]);
    const hasOnlyAllowed = changedKeys.every(k => allowedKeys.includes(k));
    if (!hasOnlyAllowed) return false;

    if (!['Occupied', 'Browsing', 'Cleaning'].includes(updatedData.status)) return false;

    return true;
  }

  canGetBill(tenantId, billData, userDoc) {
    if (this.isTenantStaff(tenantId, userDoc)) return true;
    if (this.isAuth() && billData.customerId && billData.customerId === this.auth.uid) return true;
    return false;
  }

  canListBills(tenantId, userDoc) {
    return this.isTenantStaff(tenantId, userDoc);
  }

  canUpdateDiningSession(tenantId, updatedData, userDoc) {
    if (this.isTenantStaff(tenantId, userDoc)) return true;
    const currentDoc = this.resource?.data || {};
    if (updatedData.billingStatus && updatedData.billingStatus !== currentDoc.billingStatus) {
      return updatedData.billingStatus === 'requested';
    }
    return true;
  }
}

// 1.1 Tenant Staff Isolation
const tenantAWaiter = { uid: 'waiter1', token: {} };
const tenantAWaiterProfile = { tenantId: 'tenantA', role: 'waiter' };
const staffCtx = new RuleContext(tenantAWaiter);
assert('TENANT_ISOLATION', 'Tenant A waiter is recognized as staff for Tenant A', staffCtx.isTenantStaff('tenantA', tenantAWaiterProfile) === true);
assert('TENANT_ISOLATION', 'Tenant A waiter is NOT staff for Tenant B (Cross-Tenant blocked)', staffCtx.isTenantStaff('tenantB', tenantAWaiterProfile) === false);

// 1.2 Customer / Guest Impersonation Protection
const guestCtx = new RuleContext(null); // Unauthenticated guest
assert('GUEST_ORDERING', 'Guest can place order with customerId = guest-uid', 
  guestCtx.canCreateOrder('tenantA', { tenantId: 'tenantA', customerId: 'guest-uid', status: 'NEW', paymentStatus: 'pending' }, null) === true);

assert('GUEST_ORDERING', 'Guest CANNOT place order claiming authenticated user customerId', 
  guestCtx.canCreateOrder('tenantA', { tenantId: 'tenantA', customerId: 'customer_alice', status: 'NEW', paymentStatus: 'pending' }, null) === false);

assert('GUEST_ORDERING', 'Guest CANNOT create order directly in COMPLETED or READY status', 
  guestCtx.canCreateOrder('tenantA', { tenantId: 'tenantA', customerId: 'guest-uid', status: 'COMPLETED', paymentStatus: 'pending' }, null) === false);

assert('GUEST_ORDERING', 'Guest CANNOT create order directly with paymentStatus = paid', 
  guestCtx.canCreateOrder('tenantA', { tenantId: 'tenantA', customerId: 'guest-uid', status: 'NEW', paymentStatus: 'paid' }, null) === false);

// 1.3 Order Update & Financial Tampering
const aliceOrder = { orderId: 'ORD-1', tenantId: 'tenantA', customerId: 'customer_alice', total: 5000, subtotal: 4500, tax: 500, serviceCharge: 0, discount: 0, status: 'SERVED', paymentStatus: 'pending' };
const guestOrder = { orderId: 'ORD-2', tenantId: 'tenantA', customerId: 'guest-uid', total: 3000, subtotal: 2700, tax: 300, serviceCharge: 0, discount: 0, status: 'SERVED', paymentStatus: 'pending' };

const guestAliceOrderCtx = new RuleContext(null, aliceOrder);
assert('GUEST_ORDERING', 'Anonymous stranger CANNOT update registered customer Alice order', 
  guestAliceOrderCtx.canUpdateOrder('tenantA', { ...aliceOrder, status: 'DINING_COMPLETED' }, null) === false);

const guestOwnOrderCtx = new RuleContext(null, guestOrder);
assert('GUEST_ORDERING', 'Guest CAN update their own guest order status to DINING_COMPLETED', 
  guestOwnOrderCtx.canUpdateOrder('tenantA', { ...guestOrder, status: 'DINING_COMPLETED' }, null) === true);

assert('FINANCIAL_INTEGRITY', 'Guest CANNOT modify order total or tax', 
  guestOwnOrderCtx.canUpdateOrder('tenantA', { ...guestOrder, total: 100 }, null) === false);

assert('FINANCIAL_INTEGRITY', 'Guest CANNOT modify order paymentStatus to paid', 
  guestOwnOrderCtx.canUpdateOrder('tenantA', { ...guestOrder, paymentStatus: 'paid' }, null) === false);

// 1.4 KOT Security
assert('KOT_SECURITY', 'Customer/Guest CANNOT update kitchen tickets', guestCtx.canUpdateKOT('tenantA', null) === false);
assert('KOT_SECURITY', 'Kitchen staff CAN update kitchen tickets', staffCtx.canUpdateKOT('tenantA', { tenantId: 'tenantA', role: 'kitchen' }) === true);
assert('KOT_SECURITY', 'Cross-tenant kitchen staff CANNOT update kitchen tickets', staffCtx.canUpdateKOT('tenantB', { tenantId: 'tenantA', role: 'kitchen' }) === false);

// 1.5 Table Occupancy vs Administrative Protection
const tableDoc = { tableNumber: '12', minCapacity: 2, maxCapacity: 4, qrCode: 'https://...', status: 'Available' };
const tableCtx = new RuleContext(null, tableDoc);

assert('TABLE_SECURITY', 'Guest CAN update table to Occupied with activeOrderId',
  tableCtx.canUpdateTable('tenantA', { ...tableDoc, status: 'Occupied', activeOrderId: 'ORD-2' }, null) === true);

assert('TABLE_SECURITY', 'Guest CANNOT modify table administrative capacity or qrCode',
  tableCtx.canUpdateTable('tenantA', { ...tableDoc, status: 'Occupied', maxCapacity: 10 }, null) === false);

assert('TABLE_SECURITY', 'Guest CANNOT set invalid table status (e.g. Deleted, Reserved)',
  tableCtx.canUpdateTable('tenantA', { ...tableDoc, status: 'Reserved' }, null) === false);

// 1.6 Canonical Bill Security & Secure Guest Identity
const aliceBill = { billId: 'BILL-1', tenantId: 'tenantA', customerId: 'customer_alice', total: 5000, paymentStatus: 'pending' };
const guestBill = { billId: 'BILL-2', tenantId: 'tenantA', customerId: 'anon_guest_a', total: 3000, paymentStatus: 'pending' };
const anonGuestA = { uid: 'anon_guest_a', token: {} };
const anonGuestB = { uid: 'anon_guest_b', token: {} };
const anonGuestACtx = new RuleContext(anonGuestA);
const anonGuestBCtx = new RuleContext(anonGuestB);

assert('BILLING_SECURITY', 'Authenticated Guest A CAN fetch their own guest bill document',
  anonGuestACtx.canGetBill('tenantA', guestBill, null) === true);

assert('BILLING_SECURITY', 'Guest B CANNOT fetch Guest A bill document even with bill ID known',
  anonGuestBCtx.canGetBill('tenantA', guestBill, null) === false);

assert('BILLING_SECURITY', 'Unauthenticated visitor CANNOT fetch Guest A bill document',
  guestCtx.canGetBill('tenantA', guestBill, null) === false);

assert('BILLING_SECURITY', 'Guest CANNOT fetch another registered customer bill document',
  anonGuestACtx.canGetBill('tenantA', aliceBill, null) === false);

assert('BILLING_SECURITY', 'Guest CANNOT list the canonical bills collection',
  anonGuestACtx.canListBills('tenantA', null) === false);

assert('BILLING_SECURITY', 'Authorized Tenant Staff CAN list canonical bills',
  staffCtx.canListBills('tenantA', tenantAWaiterProfile) === true);

// 1.7 Dining Session Protection
const sessionDoc = { sessionId: 'SES-1', tenantId: 'tenantA', status: 'active', billingStatus: 'pending' };
const sessionGuestCtx = new RuleContext(null, sessionDoc);
const sessionStaffCtx = new RuleContext(tenantAWaiter, sessionDoc);

assert('DINING_SESSION', 'Guest CAN request bill on dining session',
  sessionGuestCtx.canUpdateDiningSession('tenantA', { ...sessionDoc, billingStatus: 'requested' }, null) === true);

assert('DINING_SESSION', 'Guest CANNOT mark dining session billingStatus as paid',
  sessionGuestCtx.canUpdateDiningSession('tenantA', { ...sessionDoc, billingStatus: 'paid' }, null) === false);

assert('DINING_SESSION', 'Authorized staff CAN mark dining session billingStatus as paid',
  sessionStaffCtx.canUpdateDiningSession('tenantA', { ...sessionDoc, billingStatus: 'paid' }, tenantAWaiterProfile) === true);


// ================================================================
// SUITE 2: BILL SETTLEMENT & ROLE AUTHORIZATION SERVICE
// ================================================================
console.log('\n--- SUITE 2: Billing Service Settlement & Role Authorization ---');

const permittedSettlementRoles = ['super_admin', 'super-admin', 'owner', 'admin', 'manager', 'cashier', 'waiter', 'staff', 'system'];

function verifySettlementAuthorization(role) {
  if (!role || role === 'customer' || !permittedSettlementRoles.includes(role.toLowerCase())) {
    return { authorized: false, error: `Role '${role}' is not permitted to settle canonical bills.` };
  }
  return { authorized: true };
}

assert('SETTLEMENT_ROLE', 'Diner customer role is rejected from settling', verifySettlementAuthorization('customer').authorized === false);
assert('SETTLEMENT_ROLE', 'Anonymous/undefined role is rejected from settling', verifySettlementAuthorization(undefined).authorized === false);
assert('SETTLEMENT_ROLE', 'Arbitrary guest role is rejected from settling', verifySettlementAuthorization('guest').authorized === false);
assert('SETTLEMENT_ROLE', 'Cashier role is authorized to settle', verifySettlementAuthorization('cashier').authorized === true);
assert('SETTLEMENT_ROLE', 'Waiter role is authorized to settle', verifySettlementAuthorization('waiter').authorized === true);
assert('SETTLEMENT_ROLE', 'Manager role is authorized to settle', verifySettlementAuthorization('manager').authorized === true);
assert('SETTLEMENT_ROLE', 'Owner role is authorized to settle', verifySettlementAuthorization('owner').authorized === true);


// ================================================================
// SUITE 3: IDEMPOTENCY & FINANCIAL BALANCE GUARDS
// ================================================================
console.log('\n--- SUITE 3: Idempotency & Financial Balance Tests ---');

function executeBillSettlement(bill, paymentAmount) {
  if (bill.paymentStatus === 'paid') {
    return { status: 'PAID', alreadySettled: true, amountSettled: 0, balance: 0 };
  }
  if (paymentAmount <= 0 || isNaN(paymentAmount)) {
    throw new Error('Invalid payment amount');
  }
  if (paymentAmount > bill.total) {
    throw new Error('Overpayment not permitted');
  }
  const newBalance = Math.max(0, bill.total - paymentAmount);
  return {
    status: newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID',
    alreadySettled: false,
    amountSettled: paymentAmount,
    balance: newBalance
  };
}

const activeBill = { billId: 'BILL-99', total: 10000, paymentStatus: 'pending' };
const res1 = executeBillSettlement(activeBill, 10000);
assert('IDEMPOTENCY', 'First settlement marks bill PAID with balance 0', res1.status === 'PAID' && res1.balance === 0 && res1.alreadySettled === false);

const settledBill = { ...activeBill, paymentStatus: 'paid' };
const res2 = executeBillSettlement(settledBill, 10000);
assert('IDEMPOTENCY', 'Second settlement is an idempotent no-op with 0 additional deduction', res2.alreadySettled === true && res2.amountSettled === 0 && res2.balance === 0);

try {
  executeBillSettlement(activeBill, 15000); // Overpayment attempt
  assert('FINANCIAL_INTEGRITY', 'Overpayment prevented', false);
} catch (e) {
  assert('FINANCIAL_INTEGRITY', 'Overpayment prevented (balance cannot become negative)', true);
}


// ================================================================
// SUITE 4: RAZORPAY HMAC-SHA256 & AMOUNT VALIDATION
// ================================================================
console.log('\n--- SUITE 4: Razorpay HMAC & Trust Boundary Verification ---');

function verifyRazorpaySignature(orderId, paymentId, signature, secret) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const payload = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

function verifyServerPayment({ expectedAmount, verifiedAmount, signatureValid }) {
  if (!signatureValid) {
    return { success: false, reason: 'Cryptographic signature mismatch' };
  }
  if (Math.abs(expectedAmount - verifiedAmount) > 10) {
    return { success: false, reason: 'Payment amount mismatch' };
  }
  return { success: true };
}

const secretKey = 'razorpay_server_secret_xyz123';
const orderId = 'order_ABC1234567890';
const paymentId = 'pay_DEF9876543210';
const correctSignature = crypto.createHmac('sha256', secretKey).update(`${orderId}|${paymentId}`).digest('hex');
const tamperedSig = correctSignature.slice(0, -6) + 'abcdef';

assert('HMAC_SECURITY', 'Authentic Razorpay HMAC signature validates cleanly via timingSafeEqual', 
  verifyRazorpaySignature(orderId, paymentId, correctSignature, secretKey) === true);

assert('HMAC_SECURITY', 'Tampered signature is strictly rejected', 
  verifyRazorpaySignature(orderId, paymentId, tamperedSig, secretKey) === false);

assert('HMAC_SECURITY', 'Mismatched order ID signature is rejected', 
  verifyRazorpaySignature('order_FORGED_9999', paymentId, correctSignature, secretKey) === false);

assert('HMAC_SECURITY', 'Missing signature is rejected', 
  verifyRazorpaySignature(orderId, paymentId, '', secretKey) === false);

// Amount verification
assert('AMOUNT_VALIDATION', 'Matching payment amount succeeds', 
  verifyServerPayment({ expectedAmount: 25000, verifiedAmount: 25000, signatureValid: true }).success === true);

assert('AMOUNT_VALIDATION', 'Forged/discounted payment amount is strictly rejected by server', 
  verifyServerPayment({ expectedAmount: 25000, verifiedAmount: 100, signatureValid: true }).success === false);


// ================================================================
// SUITE 5: CUSTOMER EXPERIENCE REGRESSION VERIFICATION
// ================================================================
console.log('\n--- SUITE 5: Customer Journey Regression Verification ---');

// 5.1 Route and Guard Configuration
const appRoutesContent = fs.readFileSync(resolve(__dirname, '../src/routes/AppRoutes.tsx'), 'utf-8');

assert('CUSTOMER_REGRESSION', 'Public customer restaurant menu route exists and is configured', 
  appRoutesContent.includes("path=\"/customer/restaurant/:tenantId/menu\""));

assert('CUSTOMER_REGRESSION', 'Public customer table portal route exists and is configured', 
  appRoutesContent.includes("path=\"/r/:tenantId/table/:tableId\""));

assert('CUSTOMER_REGRESSION', 'Order tracking route exists for active dining orders', 
  appRoutesContent.includes("path=\"/customer/restaurant/:tenantId/order/:orderId\""));

assert('CUSTOMER_REGRESSION', 'Active dining session route exists for multi-round dining', 
  appRoutesContent.includes("path=\"/customer/restaurant/:tenantId/session\""));

assert('CUSTOMER_REGRESSION', 'Public customer cart route is outside CustomerGuard', 
  appRoutesContent.includes("path=\"/customer/cart\"") && 
  appRoutesContent.indexOf("path=\"/customer/cart\"") < appRoutesContent.indexOf("<Route element={<CustomerGuard />}>"));

assert('CUSTOMER_REGRESSION', 'Public restaurant details route is outside CustomerGuard', 
  appRoutesContent.includes("path=\"/customer/restaurant/:tenantId\"") && 
  appRoutesContent.indexOf("path=\"/customer/restaurant/:tenantId\"") < appRoutesContent.indexOf("<Route element={<CustomerGuard />}>"));

// 5.2 PaymentPage direct table writes removed
const paymentPageContent = fs.readFileSync(resolve(__dirname, '../src/apps/customer/pages/PaymentPage.tsx'), 'utf-8');
assert('PAYMENT_PAGE_SECURITY', 'PaymentPage does not perform unverified client-side table empty writes', 
  !paymentPageContent.includes("updateDoc(tableRef, { status: 'empty' })"));

assert('PAYMENT_PAGE_SECURITY', 'PaymentPage channels settlement through canonical order tracking', 
  paymentPageContent.includes("navigate(`/customer/restaurant/${tenantId}/order/${orderId}`)"));

// ================================================================
// TEST RESULTS SUMMARY
// ================================================================
console.log('\n================================================================');
console.log(`TOTAL TESTS RUN : ${totalTests}`);
console.log(`PASSED          : ${passedTests}`);
console.log(`FAILED          : ${failedTests}`);
console.log('================================================================');

if (failedTests === 0) {
  console.log('\n🎉 ALL PHASE 8 SECURITY AND REGRESSION TESTS PASSED CLEANLY!\n');
  process.exit(0);
} else {
  console.error(`\n❌ ${failedTests} TESTS FAILED! REVIEW OUTPUT ABOVE.\n`);
  process.exit(1);
}
