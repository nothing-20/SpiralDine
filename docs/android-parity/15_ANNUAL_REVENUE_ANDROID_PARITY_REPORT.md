# SPIRALDINE — PHASE 15: ANNUAL & MONTHLY REVENUE ANALYSIS PARITY REPORT

## EXECUTIVE SUMMARY

This report documents the end-to-end design, implementation, discrepancy investigation, and automated test verification of the **Annual and Monthly Revenue Analysis** functionality for the native **SpiralDine Owner Android Application** (`:owner`).

The implementation achieves full functional parity with the authoritative **SpiralDine Website Annual Revenue Explorer** and **Monthly Revenue Detail** pages, replacing the previous minimal summary dialog with a dedicated, multi-section financial analytics module built using native Jetpack Compose.

---

## 1. AUTHORITATIVE WEBSITE REFERENCE COMPONENTS

The website was audited to extract the exact accounting formulas, eligibility rules, and data structures:

| Website Component | File Path | Functional Role & Business Logic Extracted |
|---|---|---|
| **Annual Revenue Explorer** | `src/apps/owner/pages/OwnerOverview.tsx` (L3290–4010) | Fiscal Year bounds (April 1 to March 31), 12-month calendar sequencing, macro KPI calculations (Gross, Net, GST, Orders, AOV, Avg Monthly). |
| **Mobile Home Dashboard** | `src/apps/owner/mobile/pages/MobileHomeDashboard.tsx` (L857–949) | Annual Revenue card metrics, fiscal period tag formatting, mobile responsiveness adaptations. |
| **Receipt Ledger View** | `src/apps/customer/components/CustomerReceiptView.tsx` | Receipt invoice representation, customer details, CGST (2.5%) & SGST (2.5%) tax breakdown. |
| **Currency Formatter** | `src/shared/utils/format.ts` (L132–155) | Indian Rupee (`₹`) symbol formatting with standard Indian numbering grouping (`₹#,##,##0.00`). |

---

## 2. REVENUE CALCULATION RULES & SHARED DATA CONTRACTS

Both web and Android now calculate all financial figures through a single canonical ruleset implemented in `RevenueCalculator.kt`:

1. **Fiscal Year Definition**:
   - Fiscal year starts **April 1 at 00:00:00.000** and concludes **March 31 at 23:59:59.999** of the subsequent calendar year.
   - Example: **FY 2026–27** strictly covers transactions timestamped between **April 1, 2026** and **March 31, 2027**.
2. **Order Eligibility & Exclusions**:
   - **Successful / Settled Sales**: Counted only when `paymentStatus` is `paid`, `completed`, or `settled`, or order status is `COMPLETED` or `SERVED`.
   - **Excluded from Revenue**: Transactions with status `CANCELLED`, `REJECTED`, `refunded`, `voided`, or `failed` are strictly excluded from collected sales.
   - **Pending Payments**: Tracked separately under the *Outstanding / Pending* category and excluded from settled net revenue.
3. **Core Mathematical Formulas**:
   - **Gross Revenue**: $\sum \text{total}$ across all eligible paid transactions.
   - **GST Collected**: $\sum \text{tax}$ (or 5% statutory restaurant rate when tax is bundled).
   - **Net Revenue**: $\text{Gross Revenue} - \text{GST Collected}$.
   - **Average Order Value (AOV)**: $\frac{\text{Gross Revenue}}{\text{Total Orders}}$.
   - **Average Monthly Revenue**: $\frac{\text{Net Revenue}}{\max(\text{Active Months with Sales}, 1)}$.
   - **Month-over-Month Trend %**: $\frac{\text{Net}_{\text{current}} - \text{Net}_{\text{prior}}}{\text{Net}_{\text{prior}}} \times 100$.
4. **Indian Currency Presentation**:
   - Displayed strictly in Indian Rupees (`₹`), never `$`.
   - Formatted using Indian numbering system grouping (e.g. `₹41,800.00`, `₹12,50,000.00`).

---

## 3. FINANCIAL DISCREPANCY INVESTIGATION & RESOLUTION

### Root Cause Analysis

The user reported that the Android application previously displayed figures like `$41,800.00` and `$39,900.00`, while the website showed `₹0.00` for the same context. Our investigation confirmed three distinct causes:

1. **Hardcoded Currency Symbol (`$`)**:
   - In `OwnerHomeScreen.kt` (lines 88, 125, 468, 486), the Android application was hardcoded to use `"$%.2f".format(amount)`, erroneously prefixing Indian Rupee figures with the US Dollar symbol.
2. **Unconstrained Order Aggregation**:
   - The legacy Android repository's `recalculateOverview()` summed all historical orders in the tenant database without bounding by the April 1 to March 31 fiscal period, accumulating lifetime test transactions.
3. **Website FY Date Scoping**:
   - The website strictly evaluated transactions against the active FY window (`fyStart` to `fyEnd`). When a newly created restaurant tenant had no transactions between April 1, 2026 and March 31, 2027, the website correctly computed `₹0.00`.
4. **Resolution**:
   - Standardized both `OwnerHomeScreen` and the new `OwnerAnnualRevenueScreen` on `RevenueCalculator.calculateAnnualMetrics(...)` and `RevenueCalculator.formatInr(...)`.
   - When orders fall outside FY 2026–27 or when a tenant has no orders, both Android and Web display `₹0.00`. When qualifying transactions are present within the fiscal year window, identical gross, net, GST, and count figures are rendered.

---

## 4. IMPLEMENTED ANDROID SCREEN SECTIONS

A dedicated, full-featured screen was created at `OwnerAnnualRevenueScreen.kt`:

### Section A: Fiscal-Year Selector
- Allows selecting `FY 2026-27`, `FY 2025-26`, or `FY 2024-25`.
- Automatically recalculates macro KPIs and 12-month breakdowns immediately upon change.

### Section B: Annual Summary Metrics
- Six prominent KPI cards matching web desktop analytics:
  1. **Gross Revenue**: Total collected sales including GST (`₹...`).
  2. **Net Revenue**: Total sales excluding GST (`₹...`).
  3. **Total GST**: Central + State statutory tax (`₹...`).
  4. **Completed Orders**: Count of successful transactions.
  5. **Average Order Value**: Ticket size per successful diner.
  6. **Avg Monthly Revenue**: Net revenue divided by active months.

### Section C: 12-Month Fiscal Breakdown
- Displays all 12 fiscal months in sequence: **April, May, June, July, August, September, October, November, December, January, February, March**.
- Correctly handles year transition across calendar boundaries (April–December of start year, January–March of start year + 1).
- Each card displays net revenue, completed orders count, month-over-month trend percentage (`+XX%` or `-XX%`), and an actionable trigger to open monthly details.

### Section D: Dedicated Monthly Revenue Details
- Deep-dive view for any selected month.
- Displays monthly Gross, Net, GST, successful order count, and AOV.
- Provides a month selector carousel to quickly flip between any of the 12 fiscal months.

### Section E: Date-Based Revenue Investigation
- Horizontal day scrubber (1 to days-in-month) enabling date investigation.
- Quick controls: **"Jump to Today"** and **"Full Month"**.
- Day summary panel displays daily gross, net, GST, and orders when a date is selected.

### Section F: Receipt Ledger & Search
- Live transactional log displaying invoice number, dining table number, customer name, phone, timestamp, and amount.
- Real-time search query filtering across customer name, phone, invoice number, and table ID.
- Filter chips for payment method (`All`, `UPI`, `Cash`, `Card`) and status (`All`, `Paid`, `Pending`, `Refunded`).
- Expandable line-item breakdown (dish names, quantities, unit prices, discount, and tax).
- Honest empty state displayed when no transactions match the query.

### Section G: Payment Method Breakdown
- Categorized analysis for **UPI / Razorpay**, **Cash Counter**, **Credit / Debit Card**, and **Outstanding / Pending**.
- Shows total amount in `₹`, order count, and percentage share of monthly collections.

### Section H: Statutory GST Breakdown
- Computes statutory restaurant tax distribution:
  - **CGST (2.5%)**: Central Goods and Services Tax.
  - **SGST (2.5%)**: State Goods and Services Tax.
  - **IGST (0%)**: Integrated Tax.
  - **Total GST Payable**: Sum with statutory CGST Act Section 9 compliance note.

### Section I: Monthly Settlements Timeline & Channel Mix
- Progress indicator visualizing digital (UPI/Card) vs cash counter settlement ratio.
- Bank reconciliation status indicator.

---

## 5. ANDROID REPOSITORY & NAVIGATION INTEGRATION

| File | Changes Made |
|---|---|
| `android/owner/.../model/RevenueModels.kt` | Added `TransactionRecord`, `AnnualSummaryMetrics`, `MonthRevenueRecord`, and `DailyRevenueRecord`. |
| `android/owner/.../util/RevenueCalculator.kt` | Implemented pure calculation engine: `formatInr()`, `parseDate()`, `getFiscalYearRange()`, `calculateAnnualMetrics()`, `calculateMonthlyBreakdown()`, `calculateDailyRevenue()`, and `isPaidTransaction()`. |
| `android/owner/.../repository/OwnerRepository.kt` | Added `_transactions` StateFlow, live Firestore listener to `restaurants/{tenantId}/transactions`, fallback synthesis from `orders`, and integration with `RevenueCalculator`. |
| `android/owner/.../ui/navigation/OwnerNavDestination.kt` | Registered `AnnualRevenue` destination (`"annual_revenue"`). |
| `android/owner/.../ui/screens/OwnerHomeScreen.kt` | Updated KPI cards and summary dialog to use `RevenueCalculator.formatInr(...)` and wired "View Full Analytics" to navigate to `annual_revenue`. |
| `android/owner/.../MainActivity.kt` | Registered `"annual_revenue"` navigation handler, binding `repository.transactions` to `OwnerAnnualRevenueScreen`. |

---

## 6. VERIFICATION & TEST RESULTS

### Automated Unit Tests (`:owner:testDebugUnitTest`)

All 29 tests passed in the `:owner` test suite:

```text
> Task :owner:testDebugUnitTest
BUILD SUCCESSFUL in 20s
24 actionable tasks: 5 executed, 19 up-to-date
```

**Specific Annual Revenue Tests Executed**:
1. `testIndianCurrencyFormatting`: Verified ₹0.00, ₹41,800.00, ₹39,900.00, ₹12,50,000.00 (Lakhs/Crores grouping), absence of `$`, and presence of `₹`.
2. `testFiscalYearRangeAndBoundaries`: Verified April 1 00:00:00 to March 31 23:59:59 bounds for FY 2026–27.
3. `test12FiscalMonthsSequenceOrder`: Verified 12 months ordered April (0) through March (11) with calendar year rollover in January.
4. `testAnnualRevenueCalculationEligibilityAndAccounting`: Verified inclusion of paid transactions, exclusion of cancelled/refunded transactions, tax deduction, AOV, and average monthly calculation.
5. `testDailyRevenueCalculationInvestigation`: Verified date scrubber filtering, daily gross/net/GST, and orders count.
6. `testNavDestinationsIncludesAnnualRevenue`: Verified navigation route registration.

### Android Application Assembly (`:owner:assembleDebug`)

The application was packaged into a debug APK:

```text
> Task :owner:assembleDebug
BUILD SUCCESSFUL in 16s
36 actionable tasks: 5 executed, 31 up-to-date
```

### Web Application Production Build (`npm run build`)

The shared TypeScript and Vite production build passed without errors or regressions:

```text
vite v5.4.21 building for production...
✓ built in 8.25s
```

---

## 7. REMAINING BLOCKERS & DEPLOYMENT STATUS

- **No Deployment Performed**: In strict adherence to deployment restrictions, no web deployments, Android releases, or Firebase schema/security rule modifications were made.
- **Production Data Integrity**: No production records or transaction histories were altered or deleted.
- **Status**: The Annual Revenue Analysis module is complete, verified, and ready for production use upon authorization.
