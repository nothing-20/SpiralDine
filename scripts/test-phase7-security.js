import crypto from 'crypto';
import fs from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('========================================================');
console.log('PHASE 7 SECURITY AND PAYMENT SETTLEMENT TEST SUITE');
console.log('========================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(description, condition) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${description}`);
  }
}

// TEST SUITE 1: FIRESTORE RULES SYNTAX & STRUCTURAL INTEGRITY
console.log('--- TEST SUITE 1: Firestore Rules Validation ---');
const rulesPath = resolve(__dirname, '../firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf-8');

assert('firestore.rules exists and is non-empty', rulesContent.length > 5000);
assert('rules version 2 declared', rulesContent.includes("rules_version = '2';"));
assert('KOT updates strictly restricted to tenant staff', rulesContent.includes("match /kitchenTickets/{ticketId}") && rulesContent.includes("allow update: if isTenantStaff(tenantId);"));
assert('KOT creation requires initial status for non-staff', rulesContent.includes("request.resource.data.get('status', 'NEW') in ['NEW', 'QUEUED', 'PLACED', 'WAITING']"));
assert('Orders creation restricts status to NEW/PLACED for customers', rulesContent.includes("request.resource.data.get('status', 'NEW') in ['NEW', 'PLACED']"));
assert('Table creation and deletion restricted to tenant managers', rulesContent.includes("allow create, delete: if isTenantManager(tenantId);"));
assert('Table updates permit diner occupancy without changing administrative fields', rulesContent.includes("request.resource.data.get('status', '') in ['Occupied', 'Browsing', 'Cleaning']"));
assert('Canonical bills allow single document get for authentic owner', rulesContent.includes("resource.data.get('customerId', '') == request.auth.uid"));
assert('Canonical bills listing remains strictly restricted to tenant staff', rulesContent.includes("allow list: if isTenantStaff(tenantId);"));
assert('Dining sessions block unauthorized client from marking billingStatus paid', rulesContent.includes("request.resource.data.get('billingStatus', '') == 'requested'"));

// TEST SUITE 2: BILLING & PAYMENT AUTHORIZATION GUARDS
console.log('\n--- TEST SUITE 2: Billing & Role Settlement Guards ---');

const validStaffRoles = ['super_admin', 'super-admin', 'owner', 'admin', 'manager', 'cashier', 'waiter', 'staff', 'system'];

function simulateSettlementAuthCheck(actorRole) {
  if (actorRole === 'customer' || !validStaffRoles.includes(actorRole)) {
    return { allowed: false, error: `Unauthorized settlement attempt: Role '${actorRole}' is not permitted to settle canonical bills directly.` };
  }
  return { allowed: true };
}

assert('Unauthorized diner role "customer" is rejected from settling bills', simulateSettlementAuthCheck('customer').allowed === false);
assert('Unauthorized arbitrary role "guest" is rejected from settling bills', simulateSettlementAuthCheck('guest').allowed === false);
assert('Unauthorized undefined role is rejected from settling bills', simulateSettlementAuthCheck(undefined).allowed === false);
assert('Authorized role "cashier" is permitted to settle bills', simulateSettlementAuthCheck('cashier').allowed === true);
assert('Authorized role "waiter" is permitted to settle bills', simulateSettlementAuthCheck('waiter').allowed === true);
assert('Authorized role "owner" is permitted to settle bills', simulateSettlementAuthCheck('owner').allowed === true);
assert('Authorized role "admin" is permitted to settle bills', simulateSettlementAuthCheck('admin').allowed === true);

// TEST SUITE 3: IDEMPOTENCY & DOUBLE SETTLEMENT PREVENTION
console.log('\n--- TEST SUITE 3: Idempotency & Financial Balance Integrity ---');

function simulateBillSettlement(currentBill, paymentAmount) {
  if (currentBill.paymentStatus === 'paid') {
    return { success: true, alreadySettled: true, newBalance: 0 };
  }
  if (paymentAmount <= 0 || isNaN(paymentAmount)) {
    throw new Error('Invalid payment amount');
  }
  if (paymentAmount < currentBill.total) {
    throw new Error('Underpayment not permitted without authorized split');
  }
  return {
    success: true,
    alreadySettled: false,
    newBalance: Math.max(0, currentBill.total - paymentAmount)
  };
}

const mockUnpaidBill = { billId: 'BILL-100', total: 15000, paymentStatus: 'pending' };
const initialSettlement = simulateBillSettlement(mockUnpaidBill, 15000);
assert('Initial settlement successfully marks bill paid with 0 outstanding balance', initialSettlement.success === true && initialSettlement.newBalance === 0 && initialSettlement.alreadySettled === false);

const mockPaidBill = { billId: 'BILL-100', total: 15000, paymentStatus: 'paid' };
const duplicateSettlement = simulateBillSettlement(mockPaidBill, 15000);
assert('Duplicate settlement request is idempotent and does not double charge or create negative balance', duplicateSettlement.success === true && duplicateSettlement.alreadySettled === true && duplicateSettlement.newBalance === 0);

// TEST SUITE 4: HMAC SIGNATURE VERIFICATION (SERVER-SIDE GATEWAY INTEGRITY)
console.log('\n--- TEST SUITE 4: Server-Side HMAC Signature Verification ---');

function verifyRazorpayHmac(orderId, paymentId, signature, secret) {
  const payload = `${orderId}|${paymentId}`;
  const generatedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return generatedSignature === signature;
}

const testSecret = 'test_secret_key_12345';
const testOrderId = 'order_DA789XYZ';
const testPaymentId = 'pay_98765ABC';
const validSignature = crypto.createHmac('sha256', testSecret).update(`${testOrderId}|${testPaymentId}`).digest('hex');
const tamperedSignature = validSignature.slice(0, -4) + '0000';

assert('Authentic Razorpay HMAC signature is verified successfully', verifyRazorpayHmac(testOrderId, testPaymentId, validSignature, testSecret) === true);
assert('Tampered/forged Razorpay signature is strictly rejected', verifyRazorpayHmac(testOrderId, testPaymentId, tamperedSignature, testSecret) === false);
assert('Mismatched order ID signature is strictly rejected', verifyRazorpayHmac('order_FORGED999', testPaymentId, validSignature, testSecret) === false);

// SUMMARY
console.log('\n========================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('========================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
