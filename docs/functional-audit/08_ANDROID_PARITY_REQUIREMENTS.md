# SpiralDine — 08. Android Feature Parity Specification

## 1. Overview & Architectural Baseline

This document specifies the feature parity requirements between the SpiralDine Web Application and the Native Android platform. The Android project is structured as a multi-module Gradle project:
* **Customer Android Module**: `:customer` (`android/customer/src/main/java/com/spiralworld/spiraldine/`)
* **Owner Android Module**: `:owner` (`android/owner/src/main/java/com/spiraldine/owner/`)
* **Android Architecture**: Jetpack Compose, Kotlin Coroutines, StateFlow, Material 3, Firebase Android SDK (Firestore, Auth, Storage).

---

## 2. Customer Application Parity Requirements (`:customer`)

### PARITY-CUST-001: Customer Splash & Auto-Session Restore
* **Web Route / Screen**: `/` (`CustomerWelcome.tsx`)
* **Business Purpose**: Instant launch, branding, and silent restoration of stored Firebase auth sessions or guest dining tokens.
* **Web Implementation**: Reads `authStatus` from `AuthContext`; redirects existing authenticated customers to `/home` and active diners to `/r/:restaurantId/dining`.
* **Existing Data Source**: Firebase Auth local cache & `localStorage('spiraldine_guest_session')`.
* **Required Android Screen**: `SplashScreen.kt`
* **Required Android Interactions**: Animated SpiralDine vector logo, check `FirebaseAuth.getInstance().currentUser`. If authenticated, navigate to `HomeScreen`; if active table session exists in SharedPreferences, navigate to `ActiveDiningSession`; else proceed to `ExploreScreen`.
* **Required Backend Operations**: `FirebaseAuth.getCurrentUser()` check; Firestore `customers/{uid}` profile fetch.
* **States**:
  - *Loading*: Center pulsing logo with circular progress.
  - *Success*: Seamless NavHost transition with no screen flicker.
  - *Error*: Fallback to guest onboarding.
* **Android Status**: **PARTIALLY_WORKING** (Splash screen exists, auto-session redirect partially wired).

---

### PARITY-CUST-002: Restaurant Discovery & Location Filtering
* **Web Route / Screen**: `/explore`, `/discover` (`DiscoverPage.tsx`, `RestaurantDiscovery.tsx`)
* **Business Purpose**: Search and discover nearby verified dining partners with cuisine, dietary, and rating filters.
* **Web Implementation**: Real-time query to `/restaurants` where `status == 'active'` and `isPublished == true`.
* **Existing Data Source**: Collection `restaurants`
* **Required Android Screen**: `ExploreScreen.kt`
* **Required Android Interactions**: Sticky search bar, category chips horizontal scroll, restaurant cards with hero image, cuisine tags, distance badge, and rating stars. Tap opens `RestaurantMenuScreen`.
* **Required Backend Operations**: Query `restaurants.whereEqualTo("status", "active")`.
* **States**:
  - *Loading*: Shimmer skeleton cards.
  - *Empty*: "No restaurants found matching filters" with reset button.
  - *Success*: LazyColumn with pull-to-refresh.
* **Android Status**: **VERIFIED_WORKING** (ExploreScreen displays restaurant cards with image loading via Coil).

---

### PARITY-CUST-003: Digital Menu Browsing & Item Customization
* **Web Route / Screen**: `/r/:restaurantId/menu` (`CustomerMenu.tsx`)
* **Business Purpose**: Browse menu categories, search items, view allergens/dietary icons, and configure item modifiers.
* **Web Implementation**: Real-time listener on `/restaurants/{restaurantId}/menu/default/items` and `/categories`.
* **Existing Data Source**: Subcollections `menu/default/items` and `menu/default/categories`.
* **Required Android Screen**: `RestaurantMenuScreen.kt`
* **Required Android Interactions**: Category sticky tabs, Veg/Non-Veg filter toggles, Item add/remove counter (`- 1 +`), Item bottom sheet for notes and variant selection.
* **Required Backend Operations**: Snapshot listeners on menu items and active branch promotions.
* **States**:
  - *Loading*: Category tab skeletons and item shimmer rows.
  - *Empty*: "Menu currently unavailable" alert.
  - *Success*: Smooth scrolling with sticky category headers.
* **Android Status**: **VERIFIED_WORKING** (RestaurantMenuScreen renders categorized items with quantity controls).

---

### PARITY-CUST-004: Cart & Dining Mode Selection
* **Web Route / Screen**: `/cart` (`CartPage.tsx`)
* **Business Purpose**: Review selected items, select dining option (Dine-In, Takeaway, Delivery), input table number, and apply promo codes.
* **Web Implementation**: Zustand cart store syncs to local state; validates item availability against Firestore.
* **Existing Data Source**: In-memory cart state + Firestore coupon collection `/restaurants/{resId}/promotions`.
* **Required Android Screen**: `CartScreen.kt`
* **Required Android Interactions**: Item quantity adjustment, item swipe-to-delete, promo code input with "Apply" button, dining mode selector segmented button, "Proceed to Payment" primary CTA.
* **Required Backend Operations**: Calculate subtotal, dynamic GST (5% / 18%), discount, and packaging fees.
* **States**:
  - *Loading*: Price recalculation spinner.
  - *Empty*: "Your cart is empty" graphic with "Browse Menu" button.
  - *Success*: Itemized bill breakdown with total amount.
* **Android Status**: **VERIFIED_WORKING** (CartScreen with dining option toggle and breakdown).

---

### PARITY-CUST-005: Razorpay Payment & Order Submission
* **Web Route / Screen**: `/cart` & `/customer/payment` (`PaymentPage.tsx`)
* **Business Purpose**: Secure payment processing via Razorpay Gateway (UPI, Cards, NetBanking, Cash at Counter) and server-side order generation.
* **Web Implementation**: Invokes `POST /api/payments/create-order` -> Razorpay SDK modal -> `POST /api/payments/verify` -> writes to `/orders`.
* **Existing Data Source**: Razorpay Orders API + Firestore `orders` and `transactions`.
* **Required Android Screen**: `CartScreen.kt` -> Razorpay Android Checkout SDK integration.
* **Required Android Interactions**: Trigger Razorpay CustomTabs / SDK checkout; on payment success, record payment ID and redirect to `ReceiptScreen`.
* **Required Backend Operations**: Serverless verification API call or direct Firestore transaction with signed verification token.
* **States**:
  - *Loading*: Full-screen processing modal "Securing your order...".
  - *Success*: Audio confirmation chime and transition to `ReceiptScreen`.
  - *Error*: "Payment was cancelled or failed" with retry option.
* **Android Status**: **PARTIALLY_WORKING** (Order creation works for cash/mock; Razorpay Android SDK activity bridge requires production key injection).

---

### PARITY-CUST-006: QR Code Scanning & Dining Session Join
* **Web Route / Screen**: `/r/:restaurantId/table/:tableNumber` (`QRValidation.tsx`, `ActiveDiningSessionPage.tsx`)
* **Business Purpose**: Seamless instant table check-in by scanning tabletop QR code without manual restaurant search.
* **Web Implementation**: Parses URL query parameters, validates table document in Firestore, establishes guest session token.
* **Existing Data Source**: Firestore `/restaurants/{resId}/tables/{tableId}`.
* **Required Android Screen**: `QrScannerScreen.kt` -> `ActiveDiningSessionPage`
* **Required Android Interactions**: CameraX barcode scanner overlay; auto-detects `spiraldine.com/r/...` URLs; resolves table ID and immediately opens restaurant menu in Dine-In mode locked to scanned table.
* **Required Backend Operations**: Firestore `tables/{tableId}` status verification (`AVAILABLE` or `OCCUPIED`).
* **States**:
  - *Loading*: Camera viewfinder with scan laser animation.
  - *Error*: "Invalid QR code" or "Table not found" alert dialog.
* **Android Status**: **VERIFIED_WORKING** (CameraX scanner implemented in `QrScannerScreen.kt`).

---

### PARITY-CUST-007: Real-Time Order Tracking & KOT Status
* **Web Route / Screen**: `/customer/track/:orderId` (`OrderTracking.tsx`)
* **Business Purpose**: Live visual tracking of order progress through kitchen stages (Placed -> Confirmed -> Cooking -> Ready -> Served).
* **Web Implementation**: Real-time snapshot listener on `/restaurants/{resId}/orders/{orderId}`.
* **Existing Data Source**: Document `/restaurants/{resId}/orders/{orderId}`.
* **Required Android Screen**: `OrdersScreen.kt` & `ReceiptScreen.kt`
* **Required Android Interactions**: Live status progress stepper, estimated preparation countdown timer, itemized order review, "Call Waiter" action button.
* **Required Backend Operations**: `addSnapshotListener` on order document.
* **States**:
  - *Success*: Real-time animation as status transitions from `IN_KITCHEN` to `READY`.
* **Android Status**: **VERIFIED_WORKING** (OrdersScreen tracks order items and status chips).

---

## 3. Owner Application Parity Requirements (`:owner`)

### PARITY-OWNER-001: Owner Authentication & Workspace Resolution
* **Web Route / Screen**: `/login`, `/owner/login` (`ResponsiveOwnerLogin.tsx`, `LoginForm.tsx`)
* **Business Purpose**: Secure credential login for restaurant owners and staff with automatic workspace/tenant resolution.
* **Web Implementation**: Firebase Email/Password auth; reads `users/{uid}` -> `role: 'owner'` -> loads `restaurants/{restaurantId}`.
* **Existing Data Source**: Firebase Auth + Firestore `users/{uid}`.
* **Required Android Screen**: `OwnerLoginScreen.kt`
* **Required Android Interactions**: Email and password input fields with visibility toggle, "Sign In" button, error banner on invalid credentials.
* **Required Backend Operations**: `FirebaseAuth.signInWithEmailAndPassword()`; load user profile from Firestore.
* **States**:
  - *Loading*: Disabled button with circular spinner.
  - *Error*: Shake animation and red error message.
  - *Success*: Transition to `OwnerHomeScreen`.
* **Android Status**: **VERIFIED_WORKING** (`OwnerLoginScreen.kt` handles Firebase Auth).

---

### PARITY-OWNER-002: Owner Home Dashboard & Executive KPIs
* **Web Route / Screen**: `/owner/dashboard` (`MobileHomeDashboard.tsx` & `OwnerOverview.tsx`)
* **Business Purpose**: High-level daily executive overview: Today's Gross Sales, Total Orders, Business Health Score, Annual Revenue, and quick action shortcuts.
* **Web Implementation**: Aggregates today's orders in real-time, computes Business Health across 5 operational dimensions, and calculates fiscal-year net revenue.
* **Existing Data Source**: Subcollection `/restaurants/{resId}/orders` + `calculateBusinessHealth()` logic.
* **Required Android Screen**: `OwnerHomeScreen.kt`
* **Required Android Interactions**:
  1. Top App Bar with restaurant name and branch indicator.
  2. 2-column KPI Grid (Today's Sales & Total Orders).
  3. Interactive Business Health Card with score (0–100), health label ("Healthy", "Fair", "Critical"), and coverage percentage.
  4. Annual Revenue Card showing current fiscal year (FY 2026-27), Net Revenue (Gross - GST), and Order Count.
  5. Quick Action Grid (Live Orders, Manage Menu, Tables & QR, Manage Staff).
* **Required Backend Operations**: Real-time snapshot listener on orders collection; calculation of fiscal year boundaries and health dimensions in Kotlin.
* **States**:
  - *Loading*: Shimmer placeholders on KPI cards.
  - *Success*: Dynamic live values updating automatically on order creation.
* **Android Status**: **VERIFIED_WORKING** (`OwnerHomeScreen.kt` recently updated with Business Health, Annual Revenue, and Manage Staff).

---

### PARITY-OWNER-003: Live Orders Management & Status Transitions
* **Web Route / Screen**: `/owner/orders`, `/owner/orders/:orderId` (`MobileOrdersList.tsx`, `MobileOrderDetails.tsx`)
* **Business Purpose**: View active restaurant orders, filter by status (`ALL`, `PENDING`, `PREPARING`, `READY`, `COMPLETED`), and advance order workflows.
* **Web Implementation**: Real-time listener on `/restaurants/{resId}/orders`, status transition buttons (`Accept`, `Cook`, `Mark Ready`, `Serve`, `Settle`).
* **Existing Data Source**: Collection `/restaurants/{resId}/orders`.
* **Required Android Screen**: `OwnerOrdersScreen.kt` & `OwnerOrderDetailsScreen.kt`
* **Required Android Interactions**: Filter chips, order card with table number, time elapsed badge, items summary, and primary action button to advance status.
* **Required Backend Operations**: `ordersRef.document(orderId).update("status", newStatus)`.
* **States**:
  - *Empty*: "No active orders" graphic.
  - *Success*: Real-time list reordering when orders are updated.
* **Android Status**: **VERIFIED_WORKING** (`OwnerOrdersScreen.kt` and `OwnerOrderDetailsScreen.kt` implemented).

---

### PARITY-OWNER-004: Menu Management & Item CRUD
* **Web Route / Screen**: `/owner/menu`, `/owner/menu/add`, `/owner/menu/edit/:id` (`MobileMenuList.tsx`, `MobileAddEditMenuItem.tsx`)
* **Business Purpose**: Create, edit, toggle availability, and organize food and beverage offerings.
* **Web Implementation**: Real-time listener on `/menu/default/items`, form validation for price, category, and food type.
* **Existing Data Source**: Subcollections `/menu/default/items` and `/menu/default/categories`.
* **Required Android Screen**: `OwnerMenuScreen.kt`, `OwnerAddEditItemScreen.kt`, `OwnerCategoriesScreen.kt`
* **Required Android Interactions**: Category filter tabs, in-stock / out-of-stock toggle switch, FAB to add item, item edit form with image preview and price input.
* **Required Backend Operations**: Firestore `set`, `update`, and `delete` on item documents.
* **States**:
  - *Success*: Instant UI update with optimistic state.
* **Android Status**: **VERIFIED_WORKING** (All 3 screens implemented in Compose).

---

### PARITY-OWNER-005: Table & QR Code Management
* **Web Route / Screen**: `/owner/tables` (`MobileTablesQRCodes.tsx`, `OwnerTablesManager.tsx`)
* **Business Purpose**: Manage restaurant dining tables, view real-time occupancy status, and generate/download printable QR codes.
* **Web Implementation**: Firestore `/tables` listener; QR code generator canvas; table capacity and assignment editing.
* **Existing Data Source**: Subcollection `/restaurants/{resId}/tables`.
* **Required Android Screen**: `OwnerTablesScreen.kt`
* **Required Android Interactions**: Table grid with status colors (Green = Available, Red = Occupied, Yellow = Billed), add table dialog, QR code full-screen preview with share/print action.
* **Required Backend Operations**: `tables` collection listener and updates.
* **States**:
  - *Empty*: "No tables configured. Tap + to add Table 1."
* **Android Status**: **VERIFIED_WORKING** (`OwnerTablesScreen.kt` implemented).

---

### PARITY-OWNER-006: Staff Management & Multi-Role Invitations
* **Web Route / Screen**: `/owner/staff` (`MobileStaffManagement.tsx`, `OwnerStaffManager.tsx`)
* **Business Purpose**: View current staff roster, invite new staff members with designated roles (`waiter`, `kitchen`, `manager`, `cashier`), and deactivate credentials.
* **Web Implementation**: Calls serverless API `POST /api/send-staff-invitation` with tenant and role claims; reads `/restaurants/{resId}/staff`.
* **Existing Data Source**: Subcollection `/restaurants/{resId}/staff` and `/invitations`.
* **Required Android Screen**: `OwnerStaffScreen.kt`
* **Required Android Interactions**: Staff list displaying name, role badge, email, active toggle; Floating Action Button opening "Invite Staff" dialog with email, role dropdown, and "Send Invitation" button.
* **Required Backend Operations**: HTTP call to `/api/send-staff-invitation` or Firestore invitation document creation.
* **States**:
  - *Loading*: Invitation sending spinner.
  - *Success*: Toast "Invitation email sent to [email]".
* **Android Status**: **PARTIALLY_WORKING** (`OwnerStaffScreen.kt` renders existing staff; invitation dialog API call requires integration).

---

### PARITY-OWNER-007: Annual Revenue & Multi-Year Financial Analysis
* **Web Route / Screen**: `/owner/analytics` (`MobileAnalytics.tsx`, `OwnerAnalytics.tsx`)
* **Business Purpose**: In-depth financial reporting across fiscal years (FY 2024-25, FY 2025-26, FY 2026-27), monthly breakdown, and Net vs Tax reconciliation.
* **Web Implementation**: Reads all paid orders, applies canonical financial filter (`paid`, `completed`, `settled` excluding `refunded`), calculates GST and Net revenue.
* **Existing Data Source**: Collection `/restaurants/{resId}/orders`.
* **Required Android Screen**: `OwnerBusinessScreen.kt` & `OwnerAnalyticsScreen.kt`
* **Required Android Interactions**: Fiscal year selector dropdown, monthly bar chart / revenue summary table, average ticket size, and gross-to-net waterfall.
* **Required Backend Operations**: Coroutine-based aggregation in `OwnerRepository.kt`.
* **States**:
  - *Success*: Accurate calculation matching web application down to the rupee.
* **Android Status**: **VERIFIED_WORKING** (`OwnerBusinessScreen.kt` and `OwnerAnalyticsScreen.kt` implemented).

---

## 4. Android Parity Summary Matrix

| Feature ID | Feature Name | Android Target Module | Target Compose Screen | Parity Status | Blocking Issues |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PARITY-CUST-001** | Splash & Session Restore | `:customer` | `SplashScreen.kt` | PARTIALLY_WORKING | Wire guest token check |
| **PARITY-CUST-002** | Restaurant Discovery | `:customer` | `ExploreScreen.kt` | VERIFIED_WORKING | None |
| **PARITY-CUST-003** | Menu & Modifiers | `:customer` | `RestaurantMenuScreen.kt` | VERIFIED_WORKING | None |
| **PARITY-CUST-004** | Cart & Dining Mode | `:customer` | `CartScreen.kt` | VERIFIED_WORKING | None |
| **PARITY-CUST-005** | Razorpay Payment | `:customer` | `CartScreen.kt` | PARTIALLY_WORKING | SDK Activity Result |
| **PARITY-CUST-006** | QR Table Scanner | `:customer` | `QrScannerScreen.kt` | VERIFIED_WORKING | Camera permissions |
| **PARITY-CUST-007** | Order Tracking & KOT | `:customer` | `OrdersScreen.kt` | VERIFIED_WORKING | None |
| **PARITY-OWNER-001** | Owner Authentication | `:owner` | `OwnerLoginScreen.kt` | VERIFIED_WORKING | None |
| **PARITY-OWNER-002** | Executive Dashboard | `:owner` | `OwnerHomeScreen.kt` | VERIFIED_WORKING | None |
| **PARITY-OWNER-003** | Live Orders Workflow | `:owner` | `OwnerOrdersScreen.kt` | VERIFIED_WORKING | None |
| **PARITY-OWNER-004** | Menu Management | `:owner` | `OwnerMenuScreen.kt` | VERIFIED_WORKING | None |
| **PARITY-OWNER-005** | Tables & QR Codes | `:owner` | `OwnerTablesScreen.kt` | VERIFIED_WORKING | None |
| **PARITY-OWNER-006** | Staff Management | `:owner` | `OwnerStaffScreen.kt` | PARTIALLY_WORKING | Invitation API call |
| **PARITY-OWNER-007** | Revenue & Health | `:owner` | `OwnerBusinessScreen.kt` | VERIFIED_WORKING | None |
