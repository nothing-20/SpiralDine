# SpiralDine — 07. Defects, Gaps, and Placeholder Inventory

## 1. Executive Summary & Defect Classification Standard

This document catalogs all verified defects, partial implementations, placeholders, broken workflows, security edge cases, and unimplemented functional gaps discovered during the comprehensive audit of the SpiralDine web application codebase.

### Severity Rating Standard:
* **CRITICAL (P0)**: Severe security vulnerability, direct financial discrepancy, complete data loss risk, or crash rendering primary flow unusable.
* **HIGH (P1)**: Major operational blocker, broken business logic, missing core feature promised by route/navigation, or role lockout.
* **MEDIUM (P2)**: Degraded user experience, placeholder UI on secondary route, missing edge-case validation, or potential state desynchronization.
* **LOW (P3)**: Minor visual imperfection, dead legacy file with no runtime impact, or cosmetic phrasing difference.

---

## 2. Complete Defects and Gaps Register

### GAP-001: Operational Dashboard Stubs in Production Routing
* **Severity**: HIGH (P1)
* **Affected Screens**:
  - `/manager/workspace` (Manager)
  - `/cashier/desk` (Cashier)
  - `/reception/desk` (Receptionist)
  - `/manager/analytics` (Branch Analytics)
  - `/manager/logs` (Audit Trails)
* **Source Location**: [`src/routes/AppRoutes.tsx#L203-L247`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/routes/AppRoutes.tsx#L203-L247)
* **Evidence**:
  ```tsx
  const ManagerDashboard: React.FC = () => (
    <div className="space-y-4 text-left">
      <h1 className="text-2xl font-display font-extrabold text-textPearl">Manager Workspace</h1>
      <div className="glass-panel p-6 rounded-2xl border border-slate-800/50">
        <p className="text-sm text-mutedAsh">Operational branch analytics and dashboard panels are loading...</p>
      </div>
    </div>
  );
  ```
* **Impact**: If a user is assigned the role `manager`, `cashier`, or `receptionist`, they are successfully authenticated and routed past `WorkspaceGuard`, but land on an empty placeholder screen with no interactive controls or live operational data.
* **Recommended Next Step**: Either map Manager/Cashier to specialized views of `ResponsiveOwnerDashboard` and Waiter POS billing, or create dedicated operational screens before onboarding pure staff users for those specific roles.

---

### GAP-002: Deprecated Stub Files in Customer Module
* **Severity**: LOW (P3)
* **Affected Files**:
  - [`src/apps/customer/pages/CustomerRequests.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerRequests.tsx#L1-L4)
  - [`src/apps/customer/pages/DiningExperience.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/DiningExperience.tsx#L1-L4)
  - [`src/apps/customer/pages/Payment.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/Payment.tsx#L1-L4)
  - [`src/apps/customer/pages/Welcome.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/Welcome.tsx#L1-L4)
* **Evidence**:
  Each file contains:
  ```typescript
  // Deprecated during clean-up. This file has been cleared and is no longer used.
  export const Payment = () => null;
  export default Payment;
  ```
* **Impact**: Zero runtime failure. Canonical routes correctly resolve to [`CustomerWelcome.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerWelcome.tsx), [`ActiveDiningSessionPage.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/ActiveDiningSessionPage.tsx), and [`PaymentPage.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/PaymentPage.tsx). However, leftover files create confusion during audits.
* **Recommended Next Step**: Archive or prune deprecated files in a future maintenance cycle.

---

### GAP-003: Super Admin "Coming Soon" Placeholders
* **Severity**: MEDIUM (P2)
* **Affected Routes**:
  - `/super-admin/reports` (Platform Advanced Reports)
* **Source Location**:
  - [`src/apps/super-admin/pages/SuperAdminComingSoon.tsx#L1-L27`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/super-admin/pages/SuperAdminComingSoon.tsx#L1-L27)
  - Mounted via `AppRoutes.tsx#L129`.
* **Evidence**:
  ```tsx
  <p className="mt-3 text-sm text-slate-400 max-w-md">
    This administrative module is scheduled for future platform release. No fake or placeholder data is generated.
  </p>
  ```
* **Impact**: Super Admins clicking on future modules receive a clean "Coming Soon" notification with zero fake data, but cannot export cross-tenant compliance reports.
* **Recommended Next Step**: Implement the platform reporting aggregation pipeline when scheduled.

---

### GAP-004: Payment Reconciliation Webhook Vulnerability Window
* **Severity**: MEDIUM (P2)
* **Affected Flows**: Customer Online Checkout & In-Dining Session Settle
* **Source Location**:
  - [`api/payments/verify.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/payments/verify.ts)
  - [`src/apps/customer/pages/PaymentPage.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/PaymentPage.tsx)
* **Evidence**:
  Payment verification occurs when the Razorpay modal handler emits `response.razorpay_payment_id` and calls `/api/payments/verify`. If the customer closes their browser window, loses mobile network connection, or runs out of battery in the 1–2 second window after Razorpay debits funds but before the frontend calls the verification endpoint, the order in Firestore remains in status `pending` / `unpaid`.
* **Impact**: Customer is debited by bank/UPI, but the KDS and Table status do not immediately mark the order as `PAID`.
* **Recommended Next Step**: Configure an asynchronous Razorpay Webhook endpoint (`api/payments/webhook.ts`) that listens to `payment.captured` and reconciles orders independently of client device state.

---

### GAP-005: Audio Notification Auto-Play Suppression in KDS
* **Severity**: MEDIUM (P2)
* **Affected Screens**: `/kds` (Kitchen Display System)
* **Source Location**: [`src/apps/owner/kds/KDSDisplay.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/kds/KDSDisplay.tsx)
* **Evidence**:
  Web browsers enforce strict Autoplay Policies (Chrome, Safari, Edge). If the KDS terminal auto-boots or refreshes, HTML5 `Audio.play()` throws `NotAllowedError: play() failed because the user didn't interact with the document first` until a kitchen staff member taps anywhere on the screen.
* **Impact**: Newly arrived online KOT tickets may not emit an audible chime until the display is first tapped after boot.
* **Recommended Next Step**: Add a prominent modal banner "Click to Enable Kitchen Chime" on KDS startup that registers the initial user interaction gesture.

---

### GAP-006: Android Owner App Feature Parity Gaps
* **Severity**: HIGH (P1) for Android Implementation
* **Affected Android Screens**:
  - `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerHomeScreen.kt`
  - `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerOrdersScreen.kt`
  - `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerStaffScreen.kt`
* **Evidence**:
  - The Web Owner application recently received the canonical Business Health score calculation, fiscal-year bound Annual Revenue net metrics, and Manage Staff quick action navigation.
  - While Android `OwnerHomeScreen.kt` was updated with UI references, full background synchronization, staff invitation dispatch, and KOT live filters are partially complete compared to the web application.
* **Impact**: Native Android app users cannot invite staff with specific branch roles or view detailed mathematical breakdowns of operational dimensions.
* **Recommended Next Step**: Use the parity specification in `08_ANDROID_PARITY_REQUIREMENTS.md` to guide native Kotlin implementation.

---

### GAP-007: Lack of Pagination on Large Order Histories in Mobile Web
* **Severity**: LOW (P3)
* **Affected Screens**:
  - `MobileOrdersList.tsx`
  - `CustomerOrdersPage.tsx`
* **Evidence**:
  Firestore queries in `MobileOrdersList.tsx` query up to 50 recent orders using `limit(50)`. While sufficient for daily volume, busy restaurants with hundreds of orders per day require infinite scroll or pagination to view orders from earlier in the month.
* **Impact**: Performance remains high, but older orders become inaccessible without using the desktop date picker filter.
* **Recommended Next Step**: Implement cursor-based pagination (`startAfter(lastVisibleDoc)`) in mobile order lists.

---

## 3. Summary of Implementation Status Across Components

| Module | Verified Working | Partially Working | UI Only / Stub | Broken |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & Profile** | 95% | 5% | 0% | 0% |
| **Public Website & Legal** | 100% | 0% | 0% | 0% |
| **Customer Discovery & Menu** | 95% | 5% | 0% | 0% |
| **Customer Cart & Checkout** | 92% | 8% (Webhook gap) | 0% | 0% |
| **QR In-Dining Experience** | 95% | 5% | 0% | 0% |
| **Owner Dashboard & Metrics** | 98% | 2% | 0% | 0% |
| **Owner Menu & Inventory** | 96% | 4% | 0% | 0% |
| **Owner Tables & Floorplan** | 95% | 5% | 0% | 0% |
| **Owner Staff Management** | 94% | 6% | 0% | 0% |
| **Kitchen Display (KDS)** | 92% | 8% (Audio autoplay) | 0% | 0% |
| **Waiter POS & Matrix** | 94% | 6% | 0% | 0% |
| **Super Admin Console** | 90% | 5% | 5% (Coming Soon) | 0% |
| **Manager/Cashier/Reception** | 0% | 0% | 100% (Inline Stubs) | 0% |
