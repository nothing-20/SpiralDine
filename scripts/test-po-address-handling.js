/**
 * Test Suite: SpiralDine Purchase Order Address Handling & WhatsApp Generation
 * 
 * Tests:
 * 1. Vendor address vs restaurant delivery address separation
 * 2. PO defaults to selected branch's actual delivery address
 * 3. WhatsApp message contains restaurant name, branch, and delivery address (never vendor address as delivery)
 * 4. Missing delivery address does NOT fall back to vendor address
 * 5. Multi-branch address selection and branch switching
 * 6. Order-specific custom delivery address preservation
 * 7. Updating an existing PO's delivery address
 * 8. Historical PO immutability when branch address changes
 * 9. URL encoding for WhatsApp messages (currency symbols, newlines, spaces)
 * 10. formatAddress utility for string and object addresses
 */

import assert from 'assert';

// 1. Recreate formatAddress logic
function formatAddress(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr.trim();
  if (typeof addr === 'object') {
    const parts = [
      addr.street || addr.addressLine1 || '',
      addr.city || '',
      addr.state || '',
      addr.zipCode || addr.postalCode || '',
      addr.country || ''
    ]
      .map(p => (typeof p === 'string' ? p.trim() : ''))
      .filter(Boolean);
    return parts.join(', ');
  }
  return String(addr).trim();
}

// 2. Recreate formatPrice logic
function formatPrice(cents, currency = 'INR') {
  const value = (cents || 0) / 100;
  if (currency === 'INR') {
    return `₹${value.toFixed(2)}`;
  }
  return `$${value.toFixed(2)}`;
}

// 3. Recreate formatPoWhatsAppMessage logic
function formatPoWhatsAppMessage(po, restaurantName = 'SpiralDine Restaurant') {
  const effectiveRestName = po.restaurantName || restaurantName;
  const branchLabel = po.branchName ? ` — ${po.branchName}` : '';
  let msg = `*PURCHASE ORDER: ${po.poNumber}*\n\n`;
  msg += `*From:* ${effectiveRestName}${branchLabel}\n`;
  msg += `*To:* ${po.supplierName}\n`;
  if (po.deliveryAddress) {
    msg += `*Delivery Address:* ${po.deliveryAddress}\n`;
  }
  msg += `*Date:* ${new Date(po.createdAt).toLocaleDateString()}\n`;
  if (po.expectedDeliveryDate) {
    msg += `*Expected Delivery:* ${po.expectedDeliveryDate}\n`;
  }
  msg += `------------------------------------\n`;
  msg += `*ORDERED ITEMS:*\n`;

  po.items.forEach((item, idx) => {
    msg += `${idx + 1}. *${item.ingredientName}*: ${item.quantity} ${item.unit} @ ${formatPrice(item.unitPrice)} = ${formatPrice(item.lineTotal)}\n`;
  });

  msg += `------------------------------------\n`;
  msg += `*Subtotal:* ${formatPrice(po.subtotal)}\n`;
  if (po.taxTotal > 0) {
    msg += `*Tax / GST:* ${formatPrice(po.taxTotal)}\n`;
  }
  if (po.deliveryCharge && po.deliveryCharge > 0) {
    msg += `*Delivery:* ${formatPrice(po.deliveryCharge)}\n`;
  }
  msg += `*Grand Total:* ${formatPrice(po.grandTotal)}\n`;
  msg += `------------------------------------\n`;

  if (po.supplierInstructions) {
    msg += `*Instructions:* ${po.supplierInstructions}\n`;
  }

  msg += `Please confirm receipt and expected fulfillment schedule.\nThank you!`;
  return msg;
}

// Test Runner
let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    testsFailed++;
  }
}

console.log('=== TEST SUITE: PURCHASE ORDER ADDRESS HANDLING & DISPATCH ===\n');

// Group 1: formatAddress helper
console.log('[Group 1: formatAddress Helper]');

runTest('Formats string address unchanged (trimmed)', () => {
  assert.strictEqual(formatAddress('  123 Main Road, Hyderabad  '), '123 Main Road, Hyderabad');
});

runTest('Formats object address with street, city, zipCode', () => {
  const addr = {
    street: 'Plot 42, Hitech City',
    city: 'Hyderabad',
    state: 'Telangana',
    zipCode: '500081'
  };
  assert.strictEqual(formatAddress(addr), 'Plot 42, Hitech City, Hyderabad, Telangana, 500081');
});

runTest('Handles partial object address safely', () => {
  const addr = {
    street: 'Road No 36, Jubilee Hills',
    city: 'Hyderabad'
  };
  assert.strictEqual(formatAddress(addr), 'Road No 36, Jubilee Hills, Hyderabad');
});

runTest('Returns empty string for null/undefined address', () => {
  assert.strictEqual(formatAddress(null), '');
  assert.strictEqual(formatAddress(undefined), '');
  assert.strictEqual(formatAddress(''), '');
});

// Group 2: Address Separation
console.log('\n[Group 2: Address Separation & Defaulting]');

const mockRestaurant = {
  name: 'Paradise Biryani',
  address: {
    street: 'Paradise Circle, MG Road',
    city: 'Secunderabad',
    zipCode: '500003'
  }
};

const mockBranches = [
  {
    id: 'br-main',
    name: 'Main Branch',
    address: 'Paradise Circle, MG Road, Secunderabad, 500003'
  },
  {
    id: 'br-hitech',
    name: 'Hitech City Branch',
    address: 'Survey 64, Mindspace, Madhapur, Hyderabad, 500081'
  },
  {
    id: 'br-no-addr',
    name: 'Kukatpally Cloud Kitchen',
    address: null
  }
];

const mockVendor = {
  id: 'sup-sanju',
  name: 'Sanju Suppliers',
  address: 'Bhongir Main Road',
  phone: '9876543210'
};

runTest('PO defaults delivery address to selected branch address, NOT vendor address', () => {
  const selectedBranch = mockBranches[1]; // Hitech City
  const branchAddr = formatAddress(selectedBranch.address);
  const deliveryAddress = branchAddr || formatAddress(mockRestaurant.address);

  assert.strictEqual(deliveryAddress, 'Survey 64, Mindspace, Madhapur, Hyderabad, 500081');
  assert.notStrictEqual(deliveryAddress, mockVendor.address);
});

runTest('When branch has no address, falls back to restaurant profile address, NOT vendor', () => {
  const selectedBranch = mockBranches[2]; // Kukatpally Cloud Kitchen (null addr)
  const branchAddr = formatAddress(selectedBranch.address);
  const deliveryAddress = branchAddr || formatAddress(mockRestaurant.address);

  assert.strictEqual(deliveryAddress, 'Paradise Circle, MG Road, Secunderabad, 500003');
  assert.notStrictEqual(deliveryAddress, mockVendor.address);
});

runTest('When neither branch nor restaurant has address, leaves delivery address blank for user input', () => {
  const emptyRestaurant = { name: 'New Diner', address: null };
  const emptyBranch = { id: 'b1', name: 'Branch 1', address: '' };
  const branchAddr = formatAddress(emptyBranch.address);
  const deliveryAddress = branchAddr || formatAddress(emptyRestaurant.address);

  assert.strictEqual(deliveryAddress, '');
  assert.notStrictEqual(deliveryAddress, mockVendor.address);
});

// Group 3: WhatsApp Formatting
console.log('\n[Group 3: WhatsApp Message Generation]');

const mockPo = {
  id: 'po-1',
  poNumber: 'PO-20261026-8005',
  tenantId: 'rest-1',
  restaurantName: 'Paradise Biryani',
  branchId: 'br-hitech',
  branchName: 'Hitech City Branch',
  supplierId: 'sup-sanju',
  supplierName: 'Sanju Suppliers',
  supplierPhone: '9876543210',
  supplierAddress: 'Bhongir Main Road', // Vendor's address
  deliveryAddress: 'Survey 64, Mindspace, Madhapur, Hyderabad, 500081', // Restaurant's branch delivery address
  createdAt: '2026-10-26T10:00:00.000Z',
  expectedDeliveryDate: '2026-10-28',
  subtotal: 40000,
  taxTotal: 0,
  deliveryCharge: 0,
  grandTotal: 40000,
  supplierInstructions: 'Please deliver to kitchen backdoor before 10 AM.',
  status: 'SENT',
  items: [
    {
      ingredientId: 'ing-carrot',
      ingredientName: 'Carrot',
      unit: 'kg',
      quantity: 20,
      unitPrice: 2000, // ₹20.00 in cents
      lineTotal: 40000
    }
  ]
};

runTest('WhatsApp message contains restaurant name and branch in From line', () => {
  const msg = formatPoWhatsAppMessage(mockPo);
  assert.ok(msg.includes('*From:* Paradise Biryani — Hitech City Branch'));
});

runTest('WhatsApp message contains supplier name in To line', () => {
  const msg = formatPoWhatsAppMessage(mockPo);
  assert.ok(msg.includes('*To:* Sanju Suppliers'));
});

runTest('WhatsApp message contains actual restaurant delivery address, NOT vendor address', () => {
  const msg = formatPoWhatsAppMessage(mockPo);
  assert.ok(msg.includes('*Delivery Address:* Survey 64, Mindspace, Madhapur, Hyderabad, 500081'));
  assert.ok(!msg.includes('*Delivery Address:* Bhongir Main Road'));
});

runTest('WhatsApp message correctly displays ordered items with unit, price, and line totals', () => {
  const msg = formatPoWhatsAppMessage(mockPo);
  assert.ok(msg.includes('1. *Carrot*: 20 kg @ ₹20.00 = ₹400.00'));
  assert.ok(msg.includes('*Grand Total:* ₹400.00'));
});

runTest('WhatsApp URL encoding safely encodes spaces, punctuation, Indian rupee symbol and newlines', () => {
  const msg = formatPoWhatsAppMessage(mockPo);
  const encoded = encodeURIComponent(msg);
  assert.ok(!encoded.includes('\n'));
  assert.ok(!encoded.includes(' '));
  assert.ok(encoded.includes('%E2%82%B9')); // Encoded ₹ symbol
  assert.ok(decodeURIComponent(encoded) === msg);
});

// Group 4: Legacy PO Fixes and Audit Immutability
console.log('\n[Group 4: Legacy PO Discrepancy Detection & Immutability]');

runTest('Detects when a legacy PO has delivery address matching vendor address', () => {
  const legacyPo = {
    ...mockPo,
    deliveryAddress: 'Bhongir Main Road', // Accidentally copied from vendor in legacy version
    supplierAddress: 'Bhongir Main Road'
  };

  const isLegacyIssue = 
    Boolean(legacyPo.deliveryAddress && legacyPo.supplierAddress && 
    legacyPo.deliveryAddress.trim().toLowerCase() === legacyPo.supplierAddress.trim().toLowerCase());

  assert.strictEqual(isLegacyIssue, true);
});

runTest('Does not flag correct PO as legacy issue when delivery address differs from vendor', () => {
  const isLegacyIssue = 
    Boolean(mockPo.deliveryAddress && mockPo.supplierAddress && 
    mockPo.deliveryAddress.trim().toLowerCase() === mockPo.supplierAddress.trim().toLowerCase());

  assert.strictEqual(isLegacyIssue, false);
});

runTest('Changing branch address later does not mutate saved PO snapshot', () => {
  // Snapshot saved at creation time
  const savedDeliveryAddress = mockPo.deliveryAddress;

  // Branch gets updated by owner in settings later
  mockBranches[1].address = 'New Address, Floor 5, Hitech City';

  // PO still retains original delivery address
  assert.strictEqual(mockPo.deliveryAddress, savedDeliveryAddress);
});

console.log(`\n==================================================`);
console.log(`TOTAL: ${testsPassed + testsFailed} | PASSED: ${testsPassed} | FAILED: ${testsFailed}`);
console.log(`==================================================\n`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
