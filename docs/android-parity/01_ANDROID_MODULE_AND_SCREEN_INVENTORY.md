# SpiralDine — 01. Android Module & Screen Inventory

## 1. Project Organization & Gradle Structure

The native Android codebase resides in the root directory `android/` and is managed via Gradle Kotlin DSL (`settings.gradle.kts` and `libs.versions.toml`).

```text
android/
├── app/         (:app)       -> com.spiraldine.printbridge (Hardware Print Bridge)
├── customer/    (:customer)  -> com.spiralworld.spiraldine (Customer / Diner Application)
├── owner/       (:owner)     -> com.spiraldine.owner (Owner Management Application)
└── gradle/      (libs.versions.toml) -> Shared version catalog
```

---

## 2. Customer Application Module (`:customer`)

* **Application ID**: `com.spiralworld.spiraldine`
* **Package Root**: `com.spiralworld.spiraldine`
* **Entry Point Activity**: [`MainActivity.kt`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/customer/src/main/java/com/spiralworld/spiraldine/MainActivity.kt)
* **Application Class**: [`SpiralDineApplication.kt`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/customer/src/main/java/com/spiralworld/spiraldine/SpiralDineApplication.kt)
* **Target / Min SDK**: Target SDK 36, Min SDK 24 (Android 7.0+)

### A. Navigation Destinations
Defined in [`NavDestination.kt`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/customer/src/main/java/com/spiralworld/spiraldine/ui/navigation/NavDestination.kt):
1. `HOME` (`"home"`): Primary consumer dashboard with promotions, nearby restaurants, and popular dishes.
2. `EXPLORE` (`"explore"`): Search & discovery catalog with cuisine filtering.
3. `QR_SCAN` (`"qr_scan"`): CameraX barcode scanner for instant table dining check-in.
4. `ORDERS` (`"orders"`): Active order timeline, order history, and live KOT tracking.
5. `PROFILE` (`"profile"`): User profile, address management, dietary preferences, and account controls.

### B. Screen Inventory (`ui/screens/`)

| Screen File | Composable Identifier | Purpose & Interactions | Data Source & Repositories | Web Route Equivalent |
| :--- | :--- | :--- | :--- | :--- |
| `SplashScreen.kt` | `SplashScreen` | Animated brand splash, auto-restores Firebase Auth session and cached guest dining token. | `AuthRepository`, `DiningSessionRepository` | `/` (`CustomerWelcome.tsx`) |
| `HomeScreen.kt` | `HomeScreen` | Featured banners, quick reorder, active dining session banner, nearby restaurants list. | `RestaurantRepository`, `DiningSessionRepository` | `/home` (`CustomerHome.tsx`) |
| `ExploreScreen.kt` | `ExploreScreen` | Search by query text, cuisine filter chips, distance badges, and sorting. | `RestaurantRepository` | `/explore`, `/discover` (`DiscoverPage.tsx`) |
| `RestaurantMenuScreen.kt` | `RestaurantMenuScreen` | Sticky category tabs, Veg/Non-Veg toggles, item modifier selection sheet, bottom cart bar. | `MenuRepository`, `CartRepository` | `/r/:resId/menu` (`CustomerMenu.tsx`) |
| `CartScreen.kt` | `CartScreen` | Quantity adjust, dining mode selector (Dine-In, Takeaway, Delivery), table input, coupon code, checkout CTA. | `CartRepository`, `PaymentRepository` | `/cart` (`CartPage.tsx`) |
| `OrdersScreen.kt` | `OrdersScreen` | Live KOT progress stepper (`IN_KITCHEN`, `READY`, `SERVED`), order history tabs, and receipt re-display. | `OrderRepository`, `DiningSessionRepository` | `/orders`, `/customer/track/:id` |
| `ReceiptScreen.kt` | `ReceiptScreen` | Itemized bill breakdown, GST taxes, payment confirmation ID, and print receipt action. | `OrderRepository` | `/payment/receipt` |
| `BookingScreen.kt` | `BookingScreen` | Table reservation date picker, guest count stepper, time slot chips, dietary notes, submission CTA. | `ReservationRepository` | `/table-booking` (`TableBooking.tsx`) |
| `ProfileScreen.kt` | `ProfileScreen` | Edit personal details, saved delivery addresses, dietary restrictions, logout action. | `AuthRepository` | `/profile` (`ProfilePage.tsx`) |
| `NotificationsScreen.kt` | `NotificationsScreen` | List of push notifications received via Firebase Cloud Messaging. | `CustomerNotificationRepository` | `/notifications` |
| `QrScannerScreen.kt` | `QrScannerScreen` | CameraX full-screen viewfinder, parses `https://spiraldine.com/r/{id}/table/{no}` deep links. | `QrParser` | `/qr` (`QRValidation.tsx`) |
| `FavouritesScreen.kt` | `FavouritesScreen` | Bookmarked restaurants and starred menu items. | `FavouritesRepository` | `/saved` |

### C. Specialized Reusable Components (`ui/components/`)
* `CanonicalBillModal.kt`: Comprehensive multi-item bill breakdown matching web pricing algorithms.
* `ItemCustomizationModal.kt`: Radio and checkbox modifier selector for menu items.
* `CustomerReviewModal.kt`: Star rating and qualitative feedback submission dialog.
* `LocationSelectionModal.kt`: On-demand GPS location or manual address picker.
* `PaymentCheckoutModal.kt`: Payment method selection (UPI, Credit/Debit Card, Counter Cash).
* `TableSelectionModal.kt`: Interactive table number assignment dialog.
* `ServiceAssistanceModal.kt`: Immediate "Call Waiter", "Request Water", or "Request Bill" actions.
* `Skeletons.kt`: Shimmer placeholders for restaurant cards, categories, and order lists.

---

## 3. Owner Application Module (`:owner`)

* **Application ID**: `com.spiraldine.owner`
* **Package Root**: `com.spiraldine.owner`
* **Entry Point Activity**: [`MainActivity.kt`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/owner/src/main/java/com/spiraldine/owner/MainActivity.kt)
* **Application Class**: `SpiralDineOwnerApplication.kt`
* **Target / Min SDK**: Target SDK 36, Min SDK 24 (Android 7.0+)

### A. Navigation Destinations
Defined in [`OwnerNavDestination.kt`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/owner/src/main/java/com/spiraldine/owner/ui/navigation/OwnerNavDestination.kt):
1. `Home` (`"home"`): Executive overview, today's KPIs, Business Health, Annual Revenue, and quick actions.
2. `Orders` (`"orders"`): Filterable live orders kanban/list.
3. `OrderDetails` (`"order_details"`): Deep inspection of order items and workflow state advancement.
4. `Menu` (`"menu"`): Menu item list with real-time stock availability toggles.
5. `AddEditItem` (`"add_edit_item"`): Form to create or modify dish details, pricing, and category.
6. `Categories` (`"categories"`): Manage menu taxonomy and category sequence order.
7. `Business` (`"business"`): Hub for operational management modules.
8. `Analytics` (`"analytics"`): Annual and monthly revenue breakdown across fiscal years.
9. `Tables` (`"tables"`): Interactive table occupancy grid and QR code preview.
10. `Staff` (`"staff"`): Employee roster and role assignments.
11. `Promotions` (`"promotions"`): Discount coupons and marketing campaigns.
12. `More` (`"more"`): Restaurant operating status switch and administrative links.
13. `Settings` (`"settings"`): Profile and logout actions.
14. `Login` (`"login"`): Owner and staff credential authentication.

### B. Screen Inventory (`ui/screens/`)

| Screen File | Composable Identifier | Purpose & Interactions | Data Source & Repositories | Web Route Equivalent |
| :--- | :--- | :--- | :--- | :--- |
| `OwnerHomeScreen.kt` | `OwnerHomeScreen` | 2-col KPI grid (Sales, Orders), Business Health card (0–100 score), Annual Net Revenue card (`FY 2026-27`), Quick Actions (Live Orders, Menu, Tables, Staff). | `OwnerRepository.overview` | `/owner/dashboard` (`MobileHomeDashboard.tsx`) |
| `OwnerOrdersScreen.kt` | `OwnerOrdersScreen` | Live order cards with status badges (`PENDING`, `PREPARING`, `READY`, `COMPLETED`), swipe/button status advancement. | `OwnerRepository.orders` | `/owner/orders` (`MobileOrdersList.tsx`) |
| `OwnerOrderDetailsScreen.kt`| `OwnerOrderDetailsScreen` | Detailed view of items, table #, dining mode, customer name, notes, and transition triggers. | `OwnerRepository.orders` | `/owner/orders/:id` (`MobileOrderDetails.tsx`) |
| `OwnerMenuScreen.kt` | `OwnerMenuScreen` | Categorized item cards, instant in-stock/out-of-stock switch, FAB to add item, edit shortcut. | `OwnerRepository.menuItems` | `/owner/menu` (`MobileMenuList.tsx`) |
| `OwnerAddEditItemScreen.kt` | `OwnerAddEditItemScreen` | Form: Name, Description, Category, Price, Veg/Non-Veg toggle, Prep time, Save/Delete actions. | `OwnerRepository` | `/owner/menu/add`, `/owner/menu/edit/:id` |
| `OwnerCategoriesScreen.kt` | `OwnerCategoriesScreen` | Create category dialog, sequence ordering, and delete confirmation. | `OwnerRepository.categories` | `/owner/categories` |
| `OwnerBusinessScreen.kt` | `OwnerBusinessScreen` | Hub navigation to Analytics, Tables, Staff, Promotions, and Billing. | `OwnerRepository` | `/owner/business` |
| `OwnerAnalyticsScreen.kt` | `OwnerAnalyticsScreen` | Fiscal-year selector (`FY 2026-27`, `FY 2025-26`), Net Revenue, GST total, Monthly averages. | `OwnerRepository.orders` | `/owner/analytics` (`MobileAnalytics.tsx`) |
| `OwnerTablesScreen.kt` | `OwnerTablesScreen` | Table status cards (Green=Available, Red=Occupied), Add Table dialog, QR code modal preview. | `OwnerRepository.tables` | `/owner/tables` (`MobileTablesQRCodes.tsx`) |
| `OwnerStaffScreen.kt` | `OwnerStaffScreen` | Staff roster list, role badges (`waiter`, `kitchen`, `manager`), active toggle, Invite dialog. | `OwnerRepository.staff` | `/owner/staff` (`MobileStaffManagement.tsx`) |
| `OwnerPromotionsScreen.kt` | `OwnerPromotionsScreen` | Promo code cards, discount percentage, min order validation, active campaign toggle. | `OwnerRepository.promotions` | `/owner/promotions` (`MobilePromotions.tsx`) |
| `OwnerMoreScreen.kt` | `OwnerMoreScreen` | Restaurant Open/Closed toggle, quick navigation to settings and analytics. | `OwnerRepository` | `/owner/more` (`MobileMoreMenu.tsx`) |
| `OwnerSettingsScreen.kt` | `OwnerSettingsScreen` | Business profile details, app version, and secure logout. | `OwnerRepository` | `/owner/settings` (`MobileSettingsLegal.tsx`) |
| `OwnerLoginScreen.kt` | `OwnerLoginScreen` | Email and password input fields, sign-in CTA, error toast handling. | `FirebaseAuth` | `/login` (`ResponsiveOwnerLogin.tsx`) |

---

## 4. Hardware Print Bridge Module (`:app`)

* **Application ID**: `com.spiraldine.printbridge`
* **Package Root**: `com.spiraldine.printbridge`
* **Entry Point Activity**: [`MainActivity.kt`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/app/src/main/java/com/spiraldine/printbridge/MainActivity.kt)
* **Application Class**: `PrintBridgeApplication.kt`

### Architecture & Key Subsystems:
1. **`ui/HomeScreen.kt`** (1,551 lines):
   - Comprehensive dashboard managing paired Bluetooth printers, network IP printer endpoints, and USB OTG devices.
   - Provides live print job logs, retry queues, and printer status indicators.
2. **`transport/`**:
   - `BluetoothTransport.kt`: Bluetooth RFCOMM SPP socket manager for wireless mobile belt printers.
   - `NetworkTransport.kt`: Raw TCP socket connection (port 9100) for Ethernet/Wi-Fi kitchen printers.
3. **`formatter/`**:
   - ESC/POS byte generator formatting order metadata, table numbers, item lists, KOT special instructions, and double-width bold typography.
4. **`queue/`**:
   - Resilient background print spooler ensuring offline print jobs are automatically queued and retried when paper is restored or connection re-establishes.
