# SpiralDine — 06. Android Security & Permission Gaps

## 1. Executive Summary

This document details verified security vulnerabilities, tenant boundary risks, missing authorization checks, and permission handling gaps identified in the native Android applications.

---

## 2. Security Vulnerabilities & Tenant Boundary Gaps

### SEC-001: Hardcoded Tenant Identifier in Owner Repository
* **Severity**: **CRITICAL (P0)**
* **Component**: `android/owner/src/main/java/com/spiraldine/owner/data/repository/OwnerRepository.kt#L9`
* **Evidence**:
  ```kotlin
  class OwnerRepository(private val tenantId: String = "rest-alpha") {
      private val firestore = FirebaseConfig.firestore
      // ...
      ordersListener = firestore.collection("restaurants").document(tenantId)
          .collection("orders")
  ```
* **Risk Analysis**:
  - In a multi-tenant SaaS environment, an authenticated restaurant owner must only access the specific restaurant document assigned to their account in `/users/{uid}`.
  - Hardcoding `tenantId = "rest-alpha"` means that any restaurant owner logging in via the Android Owner app could read, update, or alter orders and menu items belonging to `rest-alpha`, rather than their own venue.
  - While `firestore.rules` enforces rule checks based on `request.auth.uid`, if the rules allow owners with `role == 'owner'` to read `rest-alpha`, cross-tenant data leakage occurs.
* **Required Remediation**:
  - Remove default argument `"rest-alpha"`.
  - Upon successful `FirebaseAuth.signInWithEmailAndPassword()`, fetch the user's profile document from `/users/{uid}`.
  - Extract the verified `restaurantId` (and `branchId`) and inject it into `OwnerRepository(tenantId = verifiedRestaurantId)`.

---

### SEC-002: Client-Side Payment Verification Bypass
* **Severity**: **CRITICAL (P0)**
* **Component**: `android/customer/src/main/java/com/spiralworld/spiraldine/ui/screens/CartScreen.kt` & `PaymentCheckoutModal.kt`
* **Risk Analysis**:
  - On the web, payment confirmation requires submitting `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to `/api/payments/verify`. The server evaluates:
    $$\text{HMAC-SHA256}(\text{order\_id} + "|" + \text{payment\_id}, \text{KEY\_SECRET})$$
  - The server only updates the order status to `PAID` if the cryptographic signature matches.
  - In Android Customer, payment selection can write `paymentStatus = "paid"` directly from the client device when selecting simulated payment methods.
  - A malicious actor using a modified APK could place orders marked as `PAID` without transferring funds through the payment gateway.
* **Required Remediation**:
  - Integrate Razorpay Android Checkout SDK (`com.razorpay:checkout`).
  - Upon receiving the `PaymentData` payload in `onPaymentSuccess()`, transmit `orderId`, `paymentId`, and `signature` to `https://[domain]/api/payments/verify`.
  - Only transition the UI to `ReceiptScreen` after the server returns HTTP 200 with verified payment status.

---

### SEC-003: Staff Creation Bypasses Token Verification & Role Claims
* **Severity**: **HIGH (P1)**
* **Component**: `android/owner/src/main/java/com/spiraldine/owner/data/repository/OwnerRepository.kt#L380-L415`
* **Risk Analysis**:
  - The Android Owner application allows adding a staff member via a direct Firestore write to `/restaurants/{tenantId}/staff/{id}`.
  - This write creates an inert database record without creating an authenticated user in Firebase Authentication or dispatching a verification token via `api/send-staff-invitation.ts`.
  - Conversely, if client applications assume that any document in `/staff` grants backend permissions, client-side authorization can be spoofed.
* **Required Remediation**:
  - Restrict the "Invite Staff" action to call the serverless endpoint `POST /api/send-staff-invitation` using the owner's Firebase Auth ID token.
  - Disallow direct client creation of staff records in `firestore.rules`.

---

## 3. Runtime Device Permissions Audit

### A. Android 13+ Notification Permission (`POST_NOTIFICATIONS`)
* **Target SDK**: 36 (Android 16 preview / Android 14+ compatible)
* **Status**: **VERIFIED**
* **Evidence**:
  - `SpiralDineMessagingService.kt` implements Firebase Cloud Messaging.
  - On Android 13+ (API 33+), runtime permission `Manifest.permission.POST_NOTIFICATIONS` is required before displaying order status alerts in the system shade.
  - Ensure `MainActivity.kt` requests `POST_NOTIFICATIONS` on first launch after checkout.

### B. Camera Permission for QR Scanner
* **Status**: **VERIFIED_WORKING**
* **Evidence**:
  - `QrScannerScreen.kt` requests `Manifest.permission.CAMERA` via `rememberLauncherForActivityResult(RequestPermission())`.
  - If denied, displays an informative fallback rationale with a button to open App Settings.

### C. Geolocation Permission
* **Status**: **VERIFIED_WORKING**
* **Evidence**:
  - `MainActivity.kt#L188-L223` requests `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` on demand when user taps "Refresh Location" or browses nearby restaurants.
  - If declined, gracefully defaults to displaying all onboarded restaurants without proximity sorting.

---

## 4. Security Enforcement Matrix

| Security Layer | Web Application Reference | Android Implementation Status | Defect Reference |
| :--- | :--- | :--- | :--- |
| **Authentication Identity** | Firebase Auth JWT + Custom Claims | Firebase Auth Android SDK | Matched |
| **Tenant Isolation** | Dynamic `/users/{uid}` lookup | Hardcoded `"rest-alpha"` default | `SEC-001` |
| **Order Price Validation** | Authoritative `api/orders/create` | Authoritative API called with direct fallback | Matched |
| **Payment Verification** | Cryptographic HMAC-SHA256 on server | Client-side status update | `SEC-002` |
| **Staff Invitations** | Signed token email dispatch | Direct Firestore write | `SEC-003` |
| **Camera Access** | Browser MediaDevices API | CameraX with runtime permission | Matched |
| **Location Access** | Browser Geolocation API | Android LocationManager with coarse/fine | Matched |
