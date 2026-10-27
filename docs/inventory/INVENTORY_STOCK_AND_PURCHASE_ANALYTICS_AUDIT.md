# SpiralDine — Inventory Stock and Purchase Analytics Audit Report

**Date:** October 26, 2026  
**Auditor:** Antigravity Autonomous Agent  
**Module:** Inventory Automation (`OwnerInventoryManager.tsx`, `PurchaseOrdersTab.tsx`, `vendorPurchaseOrderService.ts`, `inventoryService.ts`)  
**Scope:** Data-flow, Calculation Logic, Receiving Safeguards, Metrics Synchronization, and Financial-Year Analytics  

---

## 1. Executive Summary & Problem Statement

Restaurant owners observed that while the **Purchase Orders** page displays delivered purchase orders, the **Inventory Overview** dashboard did not accurately reflect those purchases in **Monthly Purchases**, and the **Kitchen Stock Value** and related operational metrics showed calculation gaps. Additionally, a delivered purchase order in the Purchase Orders table displayed an anomalous `34 / 17 units` alongside a misleading `100% received` indicator.

This audit report identifies the root causes across data structures, transaction flows, and metric calculations before making modifications.

---

## 2. Inventory Overview Component & Data-Loading Audit

### Component: `src/apps/owner/pages/OwnerInventoryManager.tsx`
- **Data Subscriptions (Lines 175–256):**
  Currently subscribes to:
  1. `restaurants/{tenantId}/inventory` (Ingredients)
  2. `restaurants/{tenantId}/recipes` (Recipes)
  3. `restaurants/{tenantId}/stockMovements` (Movements ledger)
  4. `restaurants/{tenantId}/suppliers` (Suppliers)
  5. `restaurants/{tenantId}/purchaseSuggestions` (Suggestions)
  6. `restaurants/{tenantId}/waste` (Waste logs)
  7. `restaurants/{tenantId}/menuItems` (Menu batch items)

- **Critical Architectural Blindspot:**
  `OwnerInventoryManager.tsx` **does not subscribe to `purchaseOrders` or `goodsReceipts`**.
  As a result:
  - The Overview tab attempts to calculate `monthlyPurchases` indirectly by filtering `movements` where `type === 'purchase'`.
  - In `stockMovements`, records historically stored only `quantity` without `unitPrice` or total financial transaction value.
  - The calculation in `stockMetrics.monthlyPurchases` (lines 318–325) attempted to multiply `m.quantity` by `ing.purchaseCost` (the current ingredient catalog cost), rather than using the actual receipt price. If `ing.purchaseCost` was missing or zero, the purchase value collapsed to ₹0.00.
  - Taxes, shipping/delivery charges, and invoice adjustments from purchase receipts were completely lost.

---

## 3. The "34 / 17 units" and "100% received" Discrepancy

### Component: `src/apps/owner/inventory/PurchaseOrdersTab.tsx` (Lines 572–595)
```tsx
const totalQty = row.items.reduce((acc, i) => acc + i.quantity, 0);
const receivedQty = row.items.reduce((acc, i) => acc + (i.receivedQuantity || 0), 0);
const percent = totalQty > 0 ? Math.min(100, Math.round((receivedQty / totalQty) * 100)) : 0;
```

### Root Cause Breakdown:
1. **Hardcoded Percentage Clamping:**
   Because `Math.min(100, ...)` is applied, any fulfillment ratio exceeding 1.0 (such as 34 / 17 = 200%) is clamped to **`100% received`**.
2. **Absence of Over-receipt Discrepancy Indicator:**
   When a vendor delivers excess units (or if receiving is duplicated), the UI displays `34 / 17 units` next to a green `100% received` bar, presenting an over-delivery or duplicate check-in as normal full fulfillment rather than an operational discrepancy.
3. **Lack of Receiving Idempotency Key:**
   In `receivePurchaseOrderGoods` (`vendorPurchaseOrderService.ts`), there is no idempotency token or unique client operation identifier. A rapid double-click on the submit button or a network retry could process the same goods receipt twice, adding 17 + 17 = 34 units to `receivedQuantity` and duplicating inventory stock additions.

---

## 4. Kitchen Stock Value Audit

### Current Calculation:
```tsx
const value = ingredients.reduce((sum, item) => sum + (Number(item.currentStock) * (Number(item.purchaseCost) || 0)), 0);
```

### Gaps Identified:
1. **Monetary Unit Consistency:**
   `purchaseCost` in `IStockIngredient` is specified in cents/paise (e.g. 4850 for ₹48.50). Multiplying `currentStock * purchaseCost` yields cents, and `formatPrice(value)` divides by 100. However, if an ingredient record has `purchaseCost` undefined, missing, or zero, the ingredient is valued at ₹0 without alerting the owner to unvalued stock.
2. **Unit Conversion Gaps:**
   If an ingredient stock is tracked in grams (`g`) while purchase price is per kilogram (`kg`), raw multiplication distorts the total valuation unless normalized.
3. **Price Basis:**
   If `purchaseCost` is not set on the ingredient document, the valuation should fall back to the active negotiated price in `supplierPrices` for preferred vendors, rather than defaulting to zero.
4. **Loading & Empty State:**
   If the Firestore snapshot is loading or returns an empty array, the dashboard immediately rendered `₹0.00`, giving the false impression that inventory is worthless rather than indicating data retrieval.

---

## 5. Monthly & Annual Purchases Definitions & Policy

### Policy Definition:
- **Monthly Purchases:** Total value of goods **actually received** during the selected calendar month, derived from authoritative `goodsReceipts` records and verified `purchase` stock movements. Draft, sent, confirmed, or cancelled purchase orders do not constitute completed purchasing expenditure.
- **Annual Purchases:** Total value of goods actually received during the **selected financial year** (April 1 to March 31 for Indian restaurants).

### Accounting & Calculation Invariants:
1. Only goods that have passed through receiving (`goodsReceipts` / received items) are counted.
2. Unreceived quantities from partially received POs are strictly excluded from expenditure.
3. Cancelled orders are excluded; previously received goods on a cancelled PO remain counted as received unless formally returned.
4. Timezone convention: Evaluated based on the restaurant's local timezone (Asia/Kolkata by default) at midnight boundaries.

---

## 6. Action Plan for Remediation

1. **Phase 2 — Idempotent Receiving & Discrepancy Handling:**
   - Add client-generated `idempotencyKey` to `receivePurchaseOrderGoods`.
   - Prevent duplicate submissions via button locks and transaction-level idempotency checks.
   - Refactor `PurchaseOrdersTab.tsx` fulfillment rendering: if `receivedQty > totalQty`, flag as **Over-received (+X excess)** with a distinct warning badge rather than hiding under 100%.
2. **Phase 3 — Fix Kitchen Stock Value:**
   - Establish unit normalization and robust cost fallback to `supplierPrices`.
   - Distinguish zero stock from unvalued items or loading state.
3. **Phase 4 — Fix Monthly Purchases:**
   - Subscribe `OwnerInventoryManager.tsx` to `goodsReceipts` and `purchaseOrders`.
   - Calculate Monthly Purchases directly from authoritative receipt line totals and movement records.
4. **Phase 5 — Implement Annual Purchases & Financial Year Selector:**
   - Add financial-year selector (`FY 2026–27`, `FY 2025–26`, `FY 2024–25`) using April 1 to March 31 boundaries.
   - Filter receipt records by financial year and compute annual expenditure with prior-year comparison.
5. **Phase 6 & 7 — Metrics Refinement & Real-Time Synchronization:**
   - Ensure Today's Consumption, Waste, Accuracy, and Turnover reflect authoritative records.
   - Synchronize `OwnerInventoryManager` and `PurchaseOrdersTab` via unified real-time Firestore subscriptions.
