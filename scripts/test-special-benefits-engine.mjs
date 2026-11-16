import assert from 'node:assert';
import {
  normalizeMemberPhone,
  normalizeMemberEmail,
  calculateMembershipDiscount,
} from '../api/_lib/specialBenefitsService.js';

console.log('====================================================');
console.log('TEST SUITE: SpiralDine Special Benefits Engine Tests');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] T${String(totalTests).padStart(2, '0')}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] T${String(totalTests).padStart(2, '0')}: ${name}`);
    console.error(`   Error: ${err.message}\n`);
  }
}

// ---------------------------------------------------------
// 1. Phone Normalization Tests
// ---------------------------------------------------------
runTest('Normalize 10-digit Indian phone number', () => {
  const normalized = normalizeMemberPhone('8096791778');
  assert.strictEqual(normalized, '+918096791778');
});

runTest('Normalize phone number with leading 0', () => {
  const normalized = normalizeMemberPhone('08096791778');
  assert.strictEqual(normalized, '+918096791778');
});

runTest('Normalize phone number with spaces, hyphens and parentheses', () => {
  const normalized = normalizeMemberPhone('+91 (809) 679-1778');
  assert.strictEqual(normalized, '+918096791778');
});

runTest('Normalize international E.164 phone number', () => {
  const normalized = normalizeMemberPhone('+14155552671');
  assert.strictEqual(normalized, '+14155552671');
});

// ---------------------------------------------------------
// 2. Email Normalization Tests
// ---------------------------------------------------------
runTest('Normalize mixed-case email with surrounding whitespace', () => {
  const normalized = normalizeMemberEmail('  Member.User@Domain.COM  ');
  assert.strictEqual(normalized, 'member.user@domain.com');
});

// ---------------------------------------------------------
// 3. Discount Calculation Engine Tests
// ---------------------------------------------------------
runTest('50% discount on ₹1,000 subtotal (100,000 paise)', () => {
  const benefit = {
    id: 'BENEFIT-TEST-1',
    memberName: 'Eligible Member #1',
    discountPercentage: 50,
    status: 'active',
    scope: 'all_restaurants',
    fundingModel: 'platform_funded',
    platformContributionPercent: 100,
    restaurantContributionPercent: 0,
    usageFrequency: 'once_per_day',
    redemptionCount: 0,
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const calc = calculateMembershipDiscount(100000, benefit);
  assert.strictEqual(calc.discountPercentage, 50);
  assert.strictEqual(calc.discountAmount, 50000); // ₹500.00
  assert.strictEqual(calc.platformFundedAmount, 50000); // 100% platform subsidy
  assert.strictEqual(calc.restaurantFundedAmount, 0); // 0% restaurant deduction
  assert.strictEqual(calc.fundingModel, 'platform_funded');
});

runTest('Configurable 25% discount on ₹2,000 subtotal (200,000 paise)', () => {
  const benefit = {
    id: 'BENEFIT-TEST-2',
    memberName: 'Eligible Member #2',
    discountPercentage: 25,
    status: 'active',
    scope: 'all_restaurants',
    fundingModel: 'restaurant_funded',
    platformContributionPercent: 0,
    restaurantContributionPercent: 100,
    usageFrequency: 'once_per_day',
    redemptionCount: 0,
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const calc = calculateMembershipDiscount(200000, benefit);
  assert.strictEqual(calc.discountPercentage, 25);
  assert.strictEqual(calc.discountAmount, 50000); // ₹500.00
  assert.strictEqual(calc.platformFundedAmount, 0); // 0% platform subsidy
  assert.strictEqual(calc.restaurantFundedAmount, 50000); // 100% restaurant funded
});

runTest('Joint funded model (50% / 50% split) on 50% discount', () => {
  const benefit = {
    id: 'BENEFIT-TEST-3',
    memberName: 'Eligible Member #3',
    discountPercentage: 50,
    status: 'active',
    scope: 'all_restaurants',
    fundingModel: 'joint_funded',
    platformContributionPercent: 50,
    restaurantContributionPercent: 50,
    usageFrequency: 'once_per_day',
    redemptionCount: 0,
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const calc = calculateMembershipDiscount(100000, benefit);
  assert.strictEqual(calc.discountAmount, 50000); // ₹500.00
  assert.strictEqual(calc.platformFundedAmount, 25000); // ₹250.00 platform
  assert.strictEqual(calc.restaurantFundedAmount, 25000); // ₹250.00 restaurant
});

runTest('100% maximum discount boundary test (Complimentary Order)', () => {
  const benefit = {
    id: 'BENEFIT-TEST-4',
    memberName: 'Eligible Member #4',
    discountPercentage: 100,
    status: 'active',
    scope: 'all_restaurants',
    fundingModel: 'platform_funded',
    platformContributionPercent: 100,
    restaurantContributionPercent: 0,
    usageFrequency: 'once_per_day',
    redemptionCount: 0,
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const calc = calculateMembershipDiscount(50000, benefit);
  assert.strictEqual(calc.discountAmount, 50000);
  const taxableBase = Math.max(0, 50000 - calc.discountAmount);
  assert.strictEqual(taxableBase, 0);
});

runTest('Max discount per order cap enforcement', () => {
  const benefit = {
    id: 'BENEFIT-TEST-5',
    memberName: 'Eligible Member #5',
    discountPercentage: 50,
    maxDiscountPerOrder: 30000, // Capped at ₹300.00 (30,000 paise)
    status: 'active',
    scope: 'all_restaurants',
    fundingModel: 'platform_funded',
    platformContributionPercent: 100,
    restaurantContributionPercent: 0,
    usageFrequency: 'once_per_day',
    redemptionCount: 0,
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Subtotal is ₹1,000 (100,000 paise). 50% would be ₹500, but capped at ₹300
  const calc = calculateMembershipDiscount(100000, benefit);
  assert.strictEqual(calc.discountAmount, 30000);
  assert.strictEqual(calc.platformFundedAmount, 30000);
});

runTest('Zero or negative subtotal returns 0 discount', () => {
  const benefit = {
    id: 'BENEFIT-TEST-6',
    memberName: 'Eligible Member #6',
    discountPercentage: 50,
    status: 'active',
    scope: 'all_restaurants',
    fundingModel: 'platform_funded',
    platformContributionPercent: 100,
    restaurantContributionPercent: 0,
    usageFrequency: 'once_per_day',
    redemptionCount: 0,
    createdBy: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const calcZero = calculateMembershipDiscount(0, benefit);
  assert.strictEqual(calcZero.discountAmount, 0);

  const calcNegative = calculateMembershipDiscount(-500, benefit);
  assert.strictEqual(calcNegative.discountAmount, 0);
});

console.log('\n====================================================');
console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
