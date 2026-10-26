# SpiralDine — 09. Unverified Features & Environmental Boundaries

## 1. Executive Summary

This document transparently lists all Android features, peripheral integrations, and external gateway interactions that could not be verified end-to-end during this non-destructive gap analysis phase.

In compliance with instructions, **no destructive tests, real bank debits, or production database mutations were executed.**

---

## 2. Unverified Feature Inventory

### 1. Physical Bluetooth & LAN Thermal Printer Hardware
* **Affected Module**: `:app` (`com.spiraldine.printbridge`)
* **Components**: `BluetoothTransport.kt`, `NetworkTransport.kt`, `HomeScreen.kt`
* **What Could Be Inspected**:
  - Byte-level ESC/POS formatter code (`GS V 66 0` paper cut commands, double-height headers).
  - RFCOMM socket lifecycle, connect timeouts, and automatic retry queues.
* **Why Unverified**:
  - Requires physical ESC/POS thermal printer hardware (e.g., Epson TM-T82, Sunmi V2, Xprinter XP-N160II) paired via Bluetooth or connected to a local Ethernet subnet.
* **Required Environment**:
  - Physical Android test hardware connected to a hardware thermal receipt printer in a staging environment.

---

### 2. Live Bank UPI & Card Debits via Razorpay Gateway
* **Affected Module**: `:customer` (`com.spiralworld.spiraldine`)
* **Components**: `PaymentCheckoutModal.kt`, `CartScreen.kt`
* **What Could Be Inspected**:
  - Order calculation logic (`CartPricingTest.kt`), subtotal and GST formulas.
  - Integration contracts with `api/payments/verify.ts`.
* **Why Unverified**:
  - Live production payment transactions were deliberately bypassed to prevent financial charges against personal or business bank accounts.
* **Required Environment**:
  - Razorpay Test Mode API keys (`rzp_test_...`) and test UPI VPA handles (`success@razorpay`).

---

### 3. Optical Camera Scanning Under Physical Glare Conditions
* **Affected Module**: `:customer` (`com.spiralworld.spiraldine`)
* **Components**: `QrScannerScreen.kt`, `QrParser.kt`
* **What Could Be Inspected**:
  - CameraX lifecycle binding, barcode scanner analyzer, and URL regex parsing in `QrParserTest.kt`.
* **Why Unverified**:
  - Unit tests verify QR string resolution, but optical camera performance under real restaurant lighting (glare on laminated tabletop acrylic stands, dim ambient dining light) requires manual physical device testing.
* **Required Environment**:
  - Physical Android smartphone with physical camera aimed at printed acrylic tabletop QR stands.

---

### 4. Background Push Notification Delivery in Android Doze Mode
* **Affected Modules**: `:customer` and `:owner`
* **Components**: `SpiralDineMessagingService.kt`, `FcmTokenManager.kt`
* **What Could Be Inspected**:
  - FCM payload parser, notification channel creation (`"Order Updates"`, `"Kitchen Alerts"`), and deep-link intent routing.
* **Why Unverified**:
  - Verification of background wake-up and high-priority heads-up notification display while the device is in Deep Doze (screen off, unplugged) requires a physical device with Google Play Services and a live FCM backend trigger.
* **Required Environment**:
  - Physical Android device with Google Play Services and automated test script triggering FCM Cloud Messaging API.

---

### 5. Multi-Tenant Cross-Branch Realtime Synchronization Under High Concurrency
* **Affected Module**: `:owner` (`com.spiraldine.owner`)
* **Components**: `OwnerRepository.kt`, `OwnerHomeScreen.kt`, `OwnerOrdersScreen.kt`
* **What Could Be Inspected**:
  - Single-tenant snapshot listeners, Kotlin Coroutine StateFlow emission, and business calculations (`OwnerModelAndLogicTest.kt`).
* **Why Unverified**:
  - Simultaneous multi-cashier order creation (e.g. 50 orders/minute across 4 concurrent branches) was not load-tested to avoid overwhelming development Firestore instances.
* **Required Environment**:
  - Firebase Local Emulator Suite executing concurrent simulated POS clients.

---

## 3. Certification of Gap Analysis Boundaries

* **No Production Data Altered**: Confirmed.
* **No Deployments Executed**: Confirmed.
* **No Unverified Features Claimed as Passed**: Confirmed.
