# SpiralDine — 08. Android Testing & Verification Plan

## 1. Executive Testing Strategy

To establish complete feature parity, mathematical consistency, tenant isolation, and regression safety, this verification plan defines the rigorous test suites, automated runners, and validation protocols governing native Android releases.

All test execution follows a zero-mock policy for business data: genuine test structures, strict schema adherence, and verified terminal execution.

---

## 2. Test Pyramid & Execution Frameworks

```text
       ▲
      / \     End-to-End Instrumented UI Tests (Espresso + Compose UI Test)
     /   \    Target: Real device / emulator workflows
    /-----\
   /       \   Integration & Contract Tests (Robolectric + MockWebServer / Firebase Emulator)
  /         \  Target: API contracts, Firestore serialization, Repository Flows
 /-----------\
/             \ Local Unit & Logic Tests (JUnit4 + Coroutines Test)
--------------- Target: Pricing, Fiscal Year, Business Health, Field Parsers
```

---

## 3. Existing Unit Test Suites Catalog

### Customer Module Test Suite (`android/customer/src/test/java/com/spiralworld/spiraldine/`)
The customer module already contains **24 comprehensive unit test suites**:

| Test Suite File | Test Count Target | Scope & Assertions |
| :--- | :--- | :--- |
| `PricePrecisionTest.kt` | 12 tests | Float rounding, subtotal calculations, GST (5% vs 18%), and exact rupee matching. |
| `BillCalculatorTest.kt` | 8 tests | Dynamic tip, discount deduction, split billing, and running KOT bill totals. |
| `CrossPlatformSyncTest.kt` | 10 tests | Web-to-Android order state mapping and timestamp reconciliation. |
| `QrParserTest.kt` | 8 tests | Parsing URL patterns `https://spiraldine.com/r/{id}/table/{num}`, invalid strings, and query params. |
| `CartPricingTest.kt` | 6 tests | Delivery fees, packaging charges, item add/remove totals. |
| `OperatingHoursEngineTest.kt` | 10 tests | Day of week, midnight-crossing operating hours, open/closed venue status. |
| `RestaurantSearchFilterTest.kt`| 9 tests | Query text matching, cuisine tag combinations, distance sorting. |
| `CustomerResponsivenessTest.kt`| 8 tests | Insets calculation, compact phone density scaling, item card height safety. |
| `TableBookingFlowTest.kt` | 11 tests | Guest count validation, slot reservation collision, date boundary checks. |

### Owner Module Test Suite (`android/owner/src/test/java/com/spiraldine/owner/`)
Contains **2 dedicated test suites** with **22 passing tests**:

| Test Suite File | Test Count Target | Scope & Assertions | Status |
| :--- | :--- | :--- | :--- |
| `OwnerModelAndLogicTest.kt` | 17 tests | `calculateBusinessHealth()` 5 dimensions, `calculateAnnualMetrics()`, fiscal year boundaries (`FY 2026-27`), paid order filtering, `TenantResolutionState`, zero-fallback assertion, staff role whitelist, email regex validation, landscape keyboard accessibility calculation, branch record switching, table QR URL formatting. | **PASSED (17/17)** |
| `OwnerResponsivenessTest.kt` | 5 tests | Device classification, KPI grid column scaling, quick actions layout budget, touch target standard compliance (40dp notification/profile, 44dp quick action, 48dp bottom nav). | **PASSED (5/5)** |

---

## 4. Phase-by-Phase Testing Requirements

### A. Phase 1 Verification: Dynamic Tenant Identity & Security
1. **Tenant Resolution Unit Test**:
   - Mock Firebase Auth user token returning claim `{ restaurantId: "res-beta" }`.
   - Assert `OwnerRepository` initializes listeners exclusively on `/restaurants/res-beta/`.
   - Assert that no requests are made to `/restaurants/rest-alpha/`.
2. **Staff Invitation API Contract Test**:
   - Execute mock HTTP request to `/api/send-staff-invitation`.
   - Verify payload contains `email`, `role`, `restaurantId`, and Bearer token.
   - Assert response status HTTP 200 with `invitationId`.

### B. Phase 2 Verification: Payment & Order Submission
1. **Razorpay Activity Callback Test**:
   - Verify `PaymentResultWithDataListener` captures `razorpay_payment_id` and `razorpay_signature`.
2. **Signature Verification Contract Test**:
   - Transmit payload to `/api/payments/verify`.
   - Assert invalid HMAC signature returns HTTP 400 and halts order completion.
   - Assert valid HMAC signature returns HTTP 200 and transitions to `ReceiptScreen`.

### C. Phase 3 Verification: Multi-Branch & Operational Deepening
1. **Branch Switching State Transition Test**:
   - Switch active branch from `branch-01` to `branch-02`.
   - Verify previous snapshot listeners are cleanly terminated (`removeListener()`).
   - Verify newly loaded orders correspond strictly to `branch-02`.
2. **Table QR Bitmap Generation Test**:
   - Assert QR bitmap dimensions match 512x512px.
   - Scan generated bitmap and assert payload decodes to valid table URL.

### D. Phase 4 Verification: Responsive & Inset Safety
1. **Landscape Keyboard Occlusion Test**:
   - Set device orientation to Landscape (`width = 800dp`, `height = 360dp`).
   - Open virtual keyboard (`keyboardHeight = 220dp`).
   - Verify "Sign In" button in `OwnerLoginScreen` remains scrollable and clickable.
2. **Accessibility Font Scaling Test**:
   - Set `fontScale = 1.5f`.
   - Measure `FoodItemCard` and `OwnerHomeScreen` KPI cards.
   - Assert zero text truncation (`isTextClipped == false`).

---

## 5. Execution Commands for CI/CD

```bash
# Execute Customer Unit Tests
./gradlew :customer:testDebugUnitTest

# Execute Owner Unit Tests
./gradlew :owner:testDebugUnitTest

# Execute PrintBridge Unit Tests
./gradlew :app:testDebugUnitTest

# Execute Lint & Architecture Static Analysis
./gradlew lintDebug
```
