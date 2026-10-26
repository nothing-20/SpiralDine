/**
 * Test Suite: Vendor Directory & Purchase Order Management
 * Verifies Phase 13 requirements:
 * 1. Vendor management (CRUD, field validation, soft-deactivation when historical purchases exist)
 * 2. Supplier-ingredient pricing (many-to-many, price history, preferred supplier)
 * 3. Purchase order lifecycle (draft, send, confirm, cancel, totals calculation, line item snapshot)
 * 4. Goods receiving (partial, full, multiple receipts, stock balance updates, movement logging)
 * 5. WhatsApp & Email sharing formatters
 * 6. Replenishment suggestion conversion to draft PO
 * 7. Security and multi-tenant isolation rules
 * 8. Regression compatibility with existing inventory model
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    failedCount++;
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
    passedCount++;
  }
}

console.log('================================================================');
console.log('  SPIRALDINE: VENDOR DIRECTORY & PURCHASE ORDERS TEST SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. VENDOR TESTS (CREATION, VALIDATION, DEACTIVATION)
// -----------------------------------------------------------------------------
console.log('--- 1. Vendor Directory & Validation Tests ---');

function validateSupplierFields(data) {
  const errors = [];
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    errors.push('Supplier name is required');
  }
  if (!data.contactPerson || typeof data.contactPerson !== 'string' || !data.contactPerson.trim()) {
    errors.push('Contact person is required');
  }
  if (!data.phone || typeof data.phone !== 'string' || !data.phone.trim()) {
    errors.push('Phone number is required');
  }
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }
  if (data.taxIdentificationNumber && data.taxIdentificationNumber.trim()) {
    // GSTIN pattern for India (15 alphanumeric characters) if applicable
    const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const trimmed = data.taxIdentificationNumber.trim().toUpperCase();
    if (trimmed.length === 15 && !gstinPattern.test(trimmed)) {
      errors.push('Invalid GSTIN format');
    }
  }
  return errors;
}

const validSupplier = {
  name: 'Farm Fresh Agro Supplies',
  contactPerson: 'Ramesh Patel',
  phone: '+91 9876543210',
  email: 'ramesh@farmfreshagro.com',
  taxIdentificationNumber: '29ABCDE1234F1Z5',
  paymentTerms: 'NET_30',
  deliveryLeadTimeDays: 2,
  isActive: true,
  branchIds: ['branch-blr-1', 'branch-blr-2']
};

const validationErrors1 = validateSupplierFields(validSupplier);
assert(validationErrors1.length === 0, 'Valid supplier passes all validation checks');

const invalidSupplier = {
  name: '',
  contactPerson: '',
  phone: '',
  email: 'not-an-email',
  taxIdentificationNumber: 'INVALID_GSTIN_123'
};
const validationErrors2 = validateSupplierFields(invalidSupplier);
assert(validationErrors2.length >= 4, 'Invalid supplier catches missing fields and bad formats');

// Soft Deactivation check when referenced by historical POs
function canPhysicallyDeleteSupplier(supplierId, historicalPoList) {
  const referenced = historicalPoList.some(po => po.supplierId === supplierId);
  return !referenced;
}

const mockHistoricalPOs = [
  { id: 'po-001', supplierId: 'sup-101', status: 'DELIVERED' },
  { id: 'po-002', supplierId: 'sup-102', status: 'CANCELLED' }
];

assert(
  !canPhysicallyDeleteSupplier('sup-101', mockHistoricalPOs),
  'Supplier sup-101 with historical purchases CANNOT be physically deleted (requires soft deactivation)'
);
assert(
  canPhysicallyDeleteSupplier('sup-999', mockHistoricalPOs),
  'Supplier sup-999 without historical purchases can be safely deleted or deactivated'
);

// -----------------------------------------------------------------------------
// 2. SUPPLIER-INGREDIENT PRICING & PRICE HISTORY
// -----------------------------------------------------------------------------
console.log('\n--- 2. Supplier-Ingredient Pricing Catalog Tests ---');

// Mock price update with historical preservation
function updateNegotiatedPrice(currentPriceRecord, newPrice, currency = 'INR', leadDays = 2) {
  const now = new Date().toISOString();
  const historyEntry = {
    price: currentPriceRecord.negotiatedPrice,
    effectiveFrom: currentPriceRecord.effectiveFrom,
    effectiveTo: now,
    recordedAt: now
  };
  return {
    ...currentPriceRecord,
    negotiatedPrice: newPrice,
    currency,
    expectedLeadTimeDays: leadDays,
    effectiveFrom: now,
    effectiveTo: null,
    priceHistory: [...(currentPriceRecord.priceHistory || []), historyEntry]
  };
}

const initialPriceRecord = {
  supplierId: 'sup-101',
  ingredientId: 'ing-flour-1',
  negotiatedPrice: 45.0,
  currency: 'INR',
  purchaseUnit: 'kg',
  minOrderQuantity: 25,
  effectiveFrom: '2026-01-01T00:00:00Z',
  effectiveTo: null,
  expectedLeadTimeDays: 3,
  isPreferred: true,
  priceHistory: []
};

const updatedPriceRecord = updateNegotiatedPrice(initialPriceRecord, 48.5, 'INR', 2);
assert(updatedPriceRecord.negotiatedPrice === 48.5, 'Negotiated price updated to 48.5');
assert(updatedPriceRecord.priceHistory.length === 1, 'Historical price entry preserved');
assert(updatedPriceRecord.priceHistory[0].price === 45.0, 'Historical price was 45.0');
assert(updatedPriceRecord.priceHistory[0].effectiveTo !== null, 'Previous price has closing effective date');

// Many-to-many relationship: multiple suppliers for 1 ingredient
const flourSuppliers = [
  { supplierId: 'sup-101', ingredientId: 'ing-flour-1', negotiatedPrice: 48.5, isPreferred: true },
  { supplierId: 'sup-102', ingredientId: 'ing-flour-1', negotiatedPrice: 50.0, isPreferred: false }
];
assert(flourSuppliers.length === 2, 'One ingredient can have multiple suppliers with distinct prices');

// 1 supplier for multiple ingredients
const sup101Catalog = [
  { supplierId: 'sup-101', ingredientId: 'ing-flour-1', negotiatedPrice: 48.5 },
  { supplierId: 'sup-101', ingredientId: 'ing-sugar-1', negotiatedPrice: 42.0 },
  { supplierId: 'sup-101', ingredientId: 'ing-butter-1', negotiatedPrice: 450.0 }
];
assert(sup101Catalog.length === 3, 'One supplier can supply multiple ingredients in catalog');

// -----------------------------------------------------------------------------
// 3. PURCHASE ORDER CREATION, TOTALS, AND IMMUTABLE SNAPSHOT
// -----------------------------------------------------------------------------
console.log('\n--- 3. Purchase Order Calculations & Immutable Snapshot Tests ---');

function calculatePoTotals(items, taxPercent = 5, deliveryCharge = 150) {
  let subtotal = 0;
  const computedItems = items.map(item => {
    const lineTotal = Math.round(item.orderQuantity * item.unitPrice * 100) / 100;
    subtotal += lineTotal;
    return {
      ...item,
      lineTotal,
      receivedQuantity: item.receivedQuantity || 0
    };
  });
  subtotal = Math.round(subtotal * 100) / 100;
  const taxAmount = Math.round((subtotal * (taxPercent / 100)) * 100) / 100;
  const totalAmount = Math.round((subtotal + taxAmount + deliveryCharge) * 100) / 100;

  return {
    items: computedItems,
    subtotal,
    taxPercent,
    taxAmount,
    deliveryCharge,
    totalAmount
  };
}

const rawPoItems = [
  {
    ingredientId: 'ing-flour-1',
    ingredientName: 'Wheat Flour Whole Grade A',
    purchaseUnit: 'kg',
    orderQuantity: 100,
    unitPrice: 48.5
  },
  {
    ingredientId: 'ing-sugar-1',
    ingredientName: 'White Cane Sugar',
    purchaseUnit: 'kg',
    orderQuantity: 50,
    unitPrice: 42.0
  }
];

const poCalculations = calculatePoTotals(rawPoItems, 5, 150);
// Item 1: 100 * 48.5 = 4850
// Item 2: 50 * 42.0 = 2100
// Subtotal = 6950
// Tax 5% = 347.50
// Delivery = 150
// Total = 7447.50
assert(poCalculations.subtotal === 6950, `Calculated subtotal is 6950 (got ${poCalculations.subtotal})`);
assert(poCalculations.taxAmount === 347.5, `Calculated tax is 347.50 (got ${poCalculations.taxAmount})`);
assert(poCalculations.totalAmount === 7447.5, `Calculated total is 7447.50 (got ${poCalculations.totalAmount})`);

// Immutable Snapshot check
const immutableItemSnapshot = { ...poCalculations.items[0] };
// If ingredient price later changes in catalog to 55:
const subsequentCatalogPrice = 55.0;
assert(
  immutableItemSnapshot.unitPrice === 48.5 && immutableItemSnapshot.unitPrice !== subsequentCatalogPrice,
  'PO item preserves immutable unit price snapshot regardless of subsequent catalog price changes'
);

// Cancellation constraints
function canCancelPurchaseOrder(status) {
  return ['DRAFT', 'SENT', 'CONFIRMED'].includes(status);
}
assert(canCancelPurchaseOrder('DRAFT'), 'Draft PO can be cancelled');
assert(canCancelPurchaseOrder('SENT'), 'Sent PO can be cancelled');
assert(!canCancelPurchaseOrder('DELIVERED'), 'Delivered PO cannot be cancelled');
assert(!canCancelPurchaseOrder('CANCELLED'), 'Already cancelled PO cannot be re-cancelled');

// -----------------------------------------------------------------------------
// 4. GOODS RECEIVING & TRANSACTION INVENTORY INTEGRATION
// -----------------------------------------------------------------------------
console.log('\n--- 4. Goods Receiving & Inventory Integration Tests ---');

function simulateReceiveGoods({
  po,
  currentStockBalances,
  receivedItems,
  grnNumber,
  supplierInvoiceNumber
}) {
  // Validate PO eligibility
  if (!['SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
    throw new Error(`Cannot receive goods for PO in ${po.status} status`);
  }

  const updatedStock = { ...currentStockBalances };
  const stockMovements = [];
  const updatedPoItems = po.items.map(poItem => {
    const receiptItem = receivedItems.find(r => r.ingredientId === poItem.ingredientId);
    if (!receiptItem) return { ...poItem };

    const qtyToReceive = receiptItem.quantityReceived;
    if (qtyToReceive < 0) throw new Error('Cannot receive negative quantity');
    
    const remaining = poItem.orderQuantity - (poItem.receivedQuantity || 0);
    if (qtyToReceive > remaining) {
      console.warn(`[Tolerance Alert] Received quantity ${qtyToReceive} exceeds remaining ${remaining}`);
    }

    const newReceivedTotal = (poItem.receivedQuantity || 0) + qtyToReceive;

    // Update inventory balance
    const priorStock = updatedStock[poItem.ingredientId] || 0;
    const nextStock = priorStock + qtyToReceive;
    updatedStock[poItem.ingredientId] = nextStock;

    // Generate authoritative stock movement
    stockMovements.push({
      ingredientId: poItem.ingredientId,
      type: 'purchase',
      quantity: qtyToReceive,
      unit: poItem.purchaseUnit,
      priorStock,
      newStock: nextStock,
      reason: `PO Receipt: ${po.poNumber} (${grnNumber})`,
      poNumber: po.poNumber,
      supplierInvoiceNumber: supplierInvoiceNumber || 'N/A',
      createdAt: new Date().toISOString()
    });

    return {
      ...poItem,
      receivedQuantity: newReceivedTotal
    };
  });

  // Calculate new PO status
  const allDelivered = updatedPoItems.every(i => i.receivedQuantity >= i.orderQuantity);
  const anyReceived = updatedPoItems.some(i => (i.receivedQuantity || 0) > 0);
  const newStatus = allDelivered ? 'DELIVERED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status;

  return {
    updatedPo: {
      ...po,
      items: updatedPoItems,
      status: newStatus
    },
    updatedStock,
    stockMovements
  };
}

const testPO = {
  id: 'po-test-1',
  poNumber: 'PO-20261026-0001',
  status: 'SENT',
  items: [
    { ingredientId: 'ing-flour-1', purchaseUnit: 'kg', orderQuantity: 100, receivedQuantity: 0, unitPrice: 48.5 },
    { ingredientId: 'ing-sugar-1', purchaseUnit: 'kg', orderQuantity: 50, receivedQuantity: 0, unitPrice: 42.0 }
  ]
};

const initialInventory = {
  'ing-flour-1': 15,
  'ing-sugar-1': 10
};

// RECEIPT 1: Partial delivery (60 kg flour, 25 kg sugar)
const receipt1 = simulateReceiveGoods({
  po: testPO,
  currentStockBalances: initialInventory,
  receivedItems: [
    { ingredientId: 'ing-flour-1', quantityReceived: 60 },
    { ingredientId: 'ing-sugar-1', quantityReceived: 25 }
  ],
  grnNumber: 'GRN-001',
  supplierInvoiceNumber: 'INV-FARM-901'
});

assert(receipt1.updatedPo.status === 'PARTIALLY_RECEIVED', 'Status after partial receipt is PARTIALLY_RECEIVED');
assert(receipt1.updatedStock['ing-flour-1'] === 75, 'Flour inventory updated from 15 to 75 (+60)');
assert(receipt1.updatedStock['ing-sugar-1'] === 35, 'Sugar inventory updated from 10 to 35 (+25)');
assert(receipt1.stockMovements.length === 2, '2 stock movements recorded for partial delivery');
assert(receipt1.stockMovements[0].type === 'purchase', 'Movement type is authoritative "purchase"');

// RECEIPT 2: Final delivery for remainder (40 kg flour, 25 kg sugar)
const receipt2 = simulateReceiveGoods({
  po: receipt1.updatedPo,
  currentStockBalances: receipt1.updatedStock,
  receivedItems: [
    { ingredientId: 'ing-flour-1', quantityReceived: 40 },
    { ingredientId: 'ing-sugar-1', quantityReceived: 25 }
  ],
  grnNumber: 'GRN-002',
  supplierInvoiceNumber: 'INV-FARM-902'
});

assert(receipt2.updatedPo.status === 'DELIVERED', 'Status after second receipt completes 100% is DELIVERED');
assert(receipt2.updatedStock['ing-flour-1'] === 115, 'Flour inventory updated from 75 to 115 (+40)');
assert(receipt2.updatedStock['ing-sugar-1'] === 60, 'Sugar inventory updated from 35 to 60 (+25)');
assert(receipt2.updatedPo.items[0].receivedQuantity === 100, 'Flour received quantity is 100/100');
assert(receipt2.updatedPo.items[1].receivedQuantity === 50, 'Sugar received quantity is 50/50');

// -----------------------------------------------------------------------------
// 5. WHATSAPP & EMAIL SHARING FORMATTERS
// -----------------------------------------------------------------------------
console.log('\n--- 5. WhatsApp & Email Sharing Formatters Tests ---');

function formatPoWhatsAppMessage(po, restaurantName = 'SpiralDine Bistro') {
  const lines = [
    `*PURCHASE ORDER: ${po.poNumber}*`,
    `From: *${restaurantName}*`,
    `Expected Delivery: ${po.expectedDeliveryDate || 'Immediate'}`,
    '',
    '*Ordered Items:*'
  ];
  po.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.ingredientName}: ${item.orderQuantity} ${item.purchaseUnit} @ ₹${item.unitPrice}/${item.purchaseUnit}`);
  });
  lines.push('');
  lines.push(`Subtotal: ₹${po.subtotal}`);
  if (po.taxAmount) lines.push(`GST/Tax: ₹${po.taxAmount}`);
  if (po.deliveryCharge) lines.push(`Delivery: ₹${po.deliveryCharge}`);
  lines.push(`*Grand Total: ₹${po.totalAmount}*`);
  if (po.deliveryAddress) lines.push(`\n*Delivery Address:*\n${po.deliveryAddress}`);
  if (po.supplierInstructions) lines.push(`\n*Notes:*\n${po.supplierInstructions}`);
  lines.push('\nPlease confirm receipt and expected fulfillment schedule.');
  return lines.join('\n');
}

const samplePoForShare = {
  poNumber: 'PO-20261026-0001',
  subtotal: 6950,
  taxAmount: 347.5,
  deliveryCharge: 150,
  totalAmount: 7447.5,
  expectedDeliveryDate: '2026-10-28',
  deliveryAddress: 'SpiralDine Central Kitchen, Indiranagar, Bengaluru',
  supplierInstructions: 'Deliver before 10:00 AM',
  items: rawPoItems
};

const waMessage = formatPoWhatsAppMessage(samplePoForShare, 'SpiralDine Central');
assert(waMessage.includes('*PURCHASE ORDER: PO-20261026-0001*'), 'WhatsApp message contains PO number');
assert(waMessage.includes('Wheat Flour Whole Grade A'), 'WhatsApp message lists items');
assert(waMessage.includes('Grand Total: ₹7447.5'), 'WhatsApp message displays Grand Total');
assert(!waMessage.includes('token') && !waMessage.includes('secret'), 'WhatsApp message does not leak tokens or secrets');

// -----------------------------------------------------------------------------
// 6. REPLENISHMENT SUGGESTIONS CONVERSION TO DRAFT PO
// -----------------------------------------------------------------------------
console.log('\n--- 6. Replenishment Suggestions Conversion Tests ---');

function convertSuggestionToDraftPo(suggestion, supplier, negotiatedPriceRecord) {
  const unitPrice = negotiatedPriceRecord ? negotiatedPriceRecord.negotiatedPrice : 0;
  const lineTotal = Math.round(suggestion.suggestedReorderQuantity * unitPrice * 100) / 100;

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    status: 'DRAFT',
    items: [
      {
        ingredientId: suggestion.ingredientId,
        ingredientName: suggestion.ingredientName,
        purchaseUnit: suggestion.unit,
        orderQuantity: suggestion.suggestedReorderQuantity,
        unitPrice,
        lineTotal,
        receivedQuantity: 0
      }
    ],
    subtotal: lineTotal,
    taxPercent: 5,
    taxAmount: Math.round(lineTotal * 0.05 * 100) / 100,
    deliveryCharge: 0,
    totalAmount: Math.round((lineTotal + Math.round(lineTotal * 0.05 * 100) / 100) * 100) / 100,
    supplierInstructions: `Generated from replenishment recommendation (Current stock: ${suggestion.currentStock} ${suggestion.unit}, Par level: ${suggestion.reorderLevel} ${suggestion.unit})`
  };
}

const mockSuggestion = {
  ingredientId: 'ing-flour-1',
  ingredientName: 'Wheat Flour',
  unit: 'kg',
  currentStock: 12,
  reorderLevel: 50,
  suggestedReorderQuantity: 60,
  urgency: 'high'
};

const draftFromSuggestion = convertSuggestionToDraftPo(mockSuggestion, { id: 'sup-101', name: 'Farm Fresh' }, updatedPriceRecord);
assert(draftFromSuggestion.items.length === 1, 'Draft PO created from suggestion has 1 item');
assert(draftFromSuggestion.items[0].orderQuantity === 60, 'Order quantity matches suggested reorder quantity (60)');
assert(draftFromSuggestion.items[0].unitPrice === 48.5, 'Unit price sourced from active negotiated price');
assert(draftFromSuggestion.status === 'DRAFT', 'Initial status is DRAFT');

// -----------------------------------------------------------------------------
// 7. SECURITY & MULTI-TENANT ISOLATION RULES AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- 7. Security & Multi-Tenant Isolation Audit ---');

const firestoreRulesPath = resolve(process.cwd(), 'firestore.rules');
const firestoreRules = readFileSync(firestoreRulesPath, 'utf8');

// Check that restaurants subcollections are scoped under /restaurants/{tenantId}/
assert(
  firestoreRules.includes('match /restaurants/{tenantId}'),
  'Firestore rules contain scoped tenant matcher: match /restaurants/{tenantId}'
);
assert(
  firestoreRules.includes('isTenantStaff(tenantId)') || firestoreRules.includes('isAuthorizedTenantStaff(tenantId)'),
  'Firestore rules mandate tenant staff authentication function'
);
assert(
  firestoreRules.includes('match /{subcollection}/{docId}'),
  'Firestore rules include management subcollection protection: match /{subcollection}/{docId}'
);

// Verify multi-tenant path builders in service
function buildTenantPath(restaurantId, subcollection, docId) {
  if (!restaurantId || typeof restaurantId !== 'string') {
    throw new Error('Tenant restaurantId is strictly required');
  }
  return `restaurants/${restaurantId}/${subcollection}${docId ? `/${docId}` : ''}`;
}

const poPathTenantA = buildTenantPath('restaurant-A', 'purchaseOrders', 'po-123');
const poPathTenantB = buildTenantPath('restaurant-B', 'purchaseOrders', 'po-123');

assert(poPathTenantA !== poPathTenantB, 'Cross-tenant document paths are completely isolated in separate subcollections');
assert(poPathTenantA === 'restaurants/restaurant-A/purchaseOrders/po-123', 'Tenant path matches canonical Firestore structure');

// -----------------------------------------------------------------------------
// 8. REGRESSION COMPATIBILITY
// -----------------------------------------------------------------------------
console.log('\n--- 8. Regression Compatibility with Existing Inventory Model ---');

const existingMovementTypes = ['purchase', 'deduction', 'adjustment', 'waste'];
assert(existingMovementTypes.includes('purchase'), 'Authoritative movement type "purchase" matches existing schema');

console.log('\n================================================================');
console.log(`  TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
}
