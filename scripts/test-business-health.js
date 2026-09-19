import { 
  calculateBusinessHealth, 
  calculateRevenueHealth, 
  calculateOperationsHealth, 
  calculateCustomerHealth, 
  calculateInventoryHealth, 
  calculateKitchenHealth 
} from '../src/shared/services/businessHealthService.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ Passed: ${message}`);
  }
}

console.log('=== RUNNING BUSINESS HEALTH SERVICE TESTS ===\n');

// CASE 1: Empty workspace (no data at all)
const case1 = calculateBusinessHealth({
  orders: [],
  paidTransactions: [],
  inventory: [],
  satisfactionRatings: []
});
assert(case1.overallScore === null, 'Case 1: Score is null when no data exists');
assert(case1.label === 'Limited Data', 'Case 1: Label is Limited Data when coverage is 0%');
assert(case1.dataCoveragePercentage === 0, 'Case 1: Data coverage is 0%');

// CASE 2: Today revenue is 0 but solid 7-day transactions exist
const now = Date.now();
const pastTrans = [
  { createdAt: new Date(now - 2 * 24 * 3600 * 1000).toISOString(), total: 1500 },
  { createdAt: new Date(now - 3 * 24 * 3600 * 1000).toISOString(), total: 2200 },
  { createdAt: new Date(now - 4 * 24 * 3600 * 1000).toISOString(), total: 3000 },
  { createdAt: new Date(now - 5 * 24 * 3600 * 1000).toISOString(), total: 1800 },
];
const case2Rev = calculateRevenueHealth({ paidTransactions: pastTrans, orders: [], inventory: [], satisfactionRatings: [] });
assert(case2Rev.status === 'available', 'Case 2: Revenue status is available');
assert(case2Rev.score > 60, 'Case 2: Revenue score is healthy despite zero today revenue');

// CASE 3: High cancellations
const mixedOrders = [
  { status: 'COMPLETED', createdAt: new Date(now - 100000).toISOString() },
  { status: 'CANCELLED', createdAt: new Date(now - 200000).toISOString() },
  { status: 'CANCELLED', createdAt: new Date(now - 300000).toISOString() },
  { status: 'CANCELLED', createdAt: new Date(now - 400000).toISOString() },
];
const case3Ops = calculateOperationsHealth({ orders: mixedOrders, paidTransactions: [], inventory: [], satisfactionRatings: [] });
assert(case3Ops.score < 50, 'Case 3: Operations score drops with 75% cancellations');

// CASE 4: 100% completed orders
const perfectOrders = Array.from({ length: 10 }, (_, i) => ({
  status: 'COMPLETED',
  createdAt: new Date(now - i * 3600 * 1000).toISOString()
}));
const case4Ops = calculateOperationsHealth({ orders: perfectOrders, paidTransactions: [], inventory: [], satisfactionRatings: [] });
assert(case4Ops.score === 100, 'Case 4: Operations score is 100 with 100% completion');

// CASE 5: Zero customer reviews
const case5Cust = calculateCustomerHealth({ satisfactionRatings: [], orders: [], paidTransactions: [], inventory: [] });
assert(case5Cust.status === 'insufficient_data', 'Case 5: Customer health is insufficient_data when 0 reviews');
assert(case5Cust.score === null, 'Case 5: Customer score is null when 0 reviews');

// CASE 6: Only 1 review (insufficient sample size)
const case6Cust = calculateCustomerHealth({
  satisfactionRatings: [{ rating: 5, createdAt: new Date().toISOString() }],
  orders: [],
  paidTransactions: [],
  inventory: []
});
assert(case6Cust.status === 'insufficient_data', 'Case 6: Single review is classified as insufficient_data');

// CASE 7: 15 verified positive reviews
const manyRatings = Array.from({ length: 15 }, () => ({ rating: 5 }));
const case7Cust = calculateCustomerHealth({ satisfactionRatings: manyRatings, orders: [], paidTransactions: [], inventory: [] });
assert(case7Cust.status === 'available', 'Case 7: 15 positive reviews gives available status');
assert(case7Cust.score >= 95, 'Case 7: 15 positive reviews produces high score');

// CASE 8: Zero inventory items
const case8Inv = calculateInventoryHealth({ inventory: [], orders: [], paidTransactions: [], satisfactionRatings: [] });
assert(case8Inv.status === 'insufficient_data', 'Case 8: Zero inventory items gives insufficient_data');

// CASE 9: Real inventory items with low stock
const invItems = [
  { currentStock: 20, minStock: 10 },
  { currentStock: 30, minStock: 15 },
  { currentStock: 2, minStock: 10 }, // low
  { currentStock: 0, minStock: 5 },  // out of stock
];
const case9Inv = calculateInventoryHealth({ inventory: invItems, orders: [], paidTransactions: [], satisfactionRatings: [] });
assert(case9Inv.status === 'available', 'Case 9: Tracked inventory is available');
assert(case9Inv.score >= 50 && case9Inv.score <= 75, 'Case 9: Partial low/out stock items score appropriately');

// CASE 10: Renormalization check
const case10 = calculateBusinessHealth({
  orders: perfectOrders,
  paidTransactions: pastTrans,
  inventory: [], // unavailable (weight 15)
  satisfactionRatings: [] // unavailable (weight 20)
});
// Available weights: Revenue (25) + Operations (25) + Kitchen (unavailable = 0) = 50%
assert(case10.dataCoveragePercentage === 50, 'Case 10: Data coverage is exactly 50%');
assert(case10.overallScore !== null && case10.overallScore >= 75, 'Case 10: Renormalized score accurately computed from available dimensions');
assert(case10.label === 'Healthy' || case10.label === 'Excellent', 'Case 10: Label reflects available score');

console.log('\n🎉 ALL 10 TESTS PASSED SUCCESSFULLY!');
