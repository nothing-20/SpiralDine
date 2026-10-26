# SpiralDine — Menu & Table Management Feature Parity Audit & Implementation Report
**Document ID:** `15_MENU_AND_TABLES_PARITY_REPORT.md`  
**Date:** October 23, 2026  
**Platforms Covered:** Mobile Web Browser (`src/apps/owner/mobile/`) & Native Android Owner Application (`android/owner/`)  
**Reference Platform:** Canonical Desktop Web Application (`src/apps/owner/pages/MenuManagement.tsx`)  
**Deployment Status:** Authorized & Production Ready  

---

## 1. Executive Summary

SpiralDine is a comprehensive restaurant operations platform serving business owners, floor staff, kitchen display systems, and table-side diners. This report documents the full implementation, end-to-end audit, and automated validation of complete feature parity between the **Mobile Web Application** (optimized for mobile browsers) and the **Native Android Application** for:
- **Menu Management** (Categories, Items, Combos, Availability, Pricing, Live Preview, and Order Telemetry Analytics)
- **Table & Seating Management** (Floor plan positioning, interactive rearranging, table metadata, and scannable QR code generation)

All implementations adhere strictly to the canonical Firestore schemas, live snapshot listeners, authenticated multi-tenant partitioning (`restaurants/{tenantId}/...`), and production-grade reactive UI architectures (React 18 + Tailwind CSS on Mobile Web; Jetpack Compose + Kotlin Coroutines/StateFlow on Native Android).

---

## 2. Architecture & Data Model Parity

Both mobile clients communicate directly with the canonical Firestore collections using consistent schemas:

| Entity | Firestore Path | Key Schema Fields | Mobile Web Support | Android Support |
| :--- | :--- | :--- | :---: | :---: |
| **Categories** | `restaurants/{tenantId}/menu/default/categories/{catId}` | `name`, `description`, `order` / `displayOrder`, `isActive`, `image`, `tenantId` | ✅ Complete | ✅ Complete |
| **Menu Items** | `restaurants/{tenantId}/menu/default/items/{itemId}` | `name`, `description`, `categoryId`, `category`, `price`, `discountPrice`, `preparationTime`, `spiceLevel`, `productionMode`, `isVeg`, `isAvailable`, `available`, `isPublished`, `isBestSeller`, `isRecommended`, `image`, `imageUrl` | ✅ Complete | ✅ Complete |
| **Combos** | `restaurants/{tenantId}/menu/default/combos/{comboId}` | `name`, `description`, `price`, `items: [{itemId, itemName, quantity}]`, `isAvailable`, `isPublished`, `image`, `tenantId` | ✅ Complete | ✅ Complete |
| **Tables** | `restaurants/{tenantId}/tables/{tableId}` | `tableNumber`, `number`, `tableName`, `name`, `capacity`, `floor`, `section`, `shape`, `status`, `positionX`, `positionY`, `notes`, `tenantId` | ✅ Complete | ✅ Complete |
| **Orders** | `restaurants/{tenantId}/orders/{orderId}` | `orderNumber`, `tableNumber`, `diningOption`, `status`, `items`, `subtotal`, `tax`, `discount`, `total`, `createdAt` | ✅ Real-time Telemetry | ✅ Real-time Telemetry |

---

## 3. Module-by-Module Implementation Breakdown

### 3.1 Category Management (Section 4 Parity)
- **Field Completeness:** Both platforms provide forms and dialogs to configure:
  1. `name`: Mandatory category name.
  2. `description`: Optional explanatory text.
  3. `image`: Custom image URL and direct image upload support.
  4. `order`: Numerical display order controlling sorting across the catalog.
  5. `isActive`: Master visibility toggle to disable an entire menu section.
- **Validation:** Both platforms enforce duplicate category name detection across existing categories, rejecting collisions case-insensitively before persistence.
- **Operations:** Create, edit (preserving Firestore ID and nested item relations), sort order reordering, and confirmed deletion.
- **Artifacts:**
  - Mobile Web: `src/apps/owner/mobile/pages/MobileMenuCategories.tsx`
  - Android: `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerCategoriesScreen.kt`

### 3.2 Menu Item Management (Section 5 Parity)
- **Field Completeness:**
  1. `name`: Item title.
  2. `categoryId`: Dynamic selection dropdown populated from live Firestore categories.
  3. `price`: Base selling price.
  4. `discountPrice`: Optional discounted price, strictly validated to ensure `discountPrice < basePrice`.
  5. `preparationTime`: Kitchen preparation duration in minutes (validated `>= 1`).
  6. `spiceLevel`: `none`, `mild`, `medium`, `hot`, `extra-hot` with flame indicators.
  7. `type` / `isVeg`: Vegetarian vs Non-Vegetarian toggle with canonical green/red square indicators.
  8. `productionMode`: `On Demand` (made-to-order) vs `Batch Production` (pre-cooked inventory with stock refills).
  9. Badges: `isBestSeller` and `isRecommended` flags.
  10. Statuses: `isAvailable` (in-stock switch) and `isPublished` (customer-facing visibility).
  11. Photo: Custom image URL and image file upload preview.
- **Artifacts:**
  - Mobile Web: `src/apps/owner/mobile/pages/MobileAddEditMenuItem.tsx`
  - Android: `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerAddEditItemScreen.kt`

### 3.3 Combos & Bundles (Section 6 Parity)
- **Full Capabilities:**
  1. Combo name and description.
  2. Bundled package price.
  3. Real item selector pulling from active Firestore menu items.
  4. Quantity increments/decrements per bundled dish, storing dish IDs, names, and unit quantities.
  5. Availability and published switches.
- **Artifacts:**
  - Mobile Web: `src/apps/owner/pages/menu/MenuCombosTab.tsx` embedded directly in `MobileMenuList.tsx` under the "Combos" tab.
  - Android: `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerMenuToolsScreen.kt` (`CombosToolPanel`).

### 3.4 Menu Analytics (Section 7 Parity)
- **Real Telemetry Metrics:** Eliminating mock placeholders, analytics are calculated from canonical `restaurants/{tenantId}/orders` records:
  1. Gross Revenue (INR formatted).
  2. Total Completed Orders.
  3. In-Stock Dish Ratio (e.g., `85% (17/20 in stock)`).
  4. Top Category by order volume.
  5. Most Ordered Dishes (ranked by order velocity).
  6. Least Ordered Dishes (underperforming menu items needing marketing or revision).
- **Artifacts:**
  - Mobile Web: `src/apps/owner/pages/menu/MenuAnalyticsTab.tsx` embedded in `MobileMenuList.tsx` ("Analytics" tab).
  - Android: `OwnerMenuToolsScreen.kt` (`AnalyticsToolPanel`).

### 3.5 Menu Availability (Section 8 Parity)
- **Category-Grouped Architecture:**
  1. Category Master Switches: Top-level switch toggling category `isActive`, instantly activating/deactivating all dishes in that group.
  2. Dish In-Stock Switches: Individual item switches toggling `available` / `isAvailable` with instant color-coded status badges (`In Stock` vs `Out of Stock`).
- **Artifacts:**
  - Mobile Web: `MobileMenuList.tsx` ("Availability" tab).
  - Android: `OwnerMenuToolsScreen.kt` (`AvailabilityToolPanel`).

### 3.6 Menu Pricing (Section 9 Parity)
- **Responsive Price Management:**
  1. Responsive tabular/card list showing Item Name, Category, Base Price, Discount Price, and Promotion Flags.
  2. Blur-based automatic Firestore updates for rapid menu-wide price revisions.
  3. One-tap toggle buttons for `Bestseller` and `Recommended` badges.
- **Artifacts:**
  - Mobile Web: `MobileMenuList.tsx` ("Pricing" tab).
  - Android: `OwnerMenuToolsScreen.kt` (`PricingToolPanel`).

### 3.7 Menu Preview (Section 10 Parity)
- **Mobile Customer Experience Preview:**
  1. Category-wise layout mirroring diner view.
  2. 2-column card grid (`grid grid-cols-2` / `chunked(2)`) optimized for mobile viewports.
  3. Shows dietary square indicator (veg/non-veg dot), food photography, dish name, description, active price, struck-through original price, and interactive "+ Add" simulation button.
- **Artifacts:**
  - Mobile Web: `MobileMenuList.tsx` ("Preview" tab).
  - Android: `OwnerMenuToolsScreen.kt` (`MenuPreviewToolPanel`).

### 3.8 Real Scannable QR Code Generation (Section 11 Parity)
- **Authoritative URL Pattern:** `/r/:tenantId/table/:tableNum` (using `table.tableNumber` with fallback to `table.id`).
- **Real Scannable QR Images:** High-density 260x260 scannable QR matrix rendered via QR API and Coil `AsyncImage`.
- **Diner Actions:**
  1. One-tap Copy Link to clipboard.
  2. Native Android / Web Share Sheet invocation (`navigator.share` / `Intent.ACTION_SEND`).
  3. Direct PNG image download.
  4. Direct browser test preview.
- **Artifacts:**
  - Mobile Web: `src/apps/owner/mobile/pages/MobileTablesQRCodes.tsx` (`activeQRTable` modal).
  - Android: `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerTablesScreen.kt` (`TableQrDialog`).

### 3.9 Editable Table Floor Plan (Section 12 Parity)
- **Visual Drag-and-Drop Floor Map:**
  1. Touch-gesture canvas tap & repositioning (`positionX`, `positionY`).
  2. Boundary clamping ensuring tables cannot be placed off-canvas.
  3. Real-time Firestore coordinate synchronization (`updateDoc(..., { positionX, positionY })` / `updateTablePosition`).
  4. Clear separation between layout coordinates and operational table statuses (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `DISABLED`).
- **Artifacts:**
  - Mobile Web: `MobileTablesQRCodes.tsx` (`isRepositioning` mode + touch coordinates).
  - Android: `OwnerTablesScreen.kt` (interactive grid map with coordinate saving).

---

## 4. Verification & Build Evidence

### 4.1 Android Gradle Verification
- **Compilation:**
  ```powershell
  .\gradlew.bat :owner:compileDebugKotlin
  ```
  *Result:* `BUILD SUCCESSFUL in 47s` (0 errors).
- **Unit Tests:**
  ```powershell
  .\gradlew.bat :owner:testDebugUnitTest
  ```
  *Result:* `BUILD SUCCESSFUL in 23s` (All unit tests passed).
- **Release/Debug APK Assembly:**
  ```powershell
  .\gradlew.bat :owner:assembleDebug
  ```
  *Result:* `BUILD SUCCESSFUL in 25s`.
  *Artifact:* `android/owner/build/outputs/apk/debug/owner-debug.apk` (26,075,244 bytes).

### 4.2 Web Application Verification & Live Deployment
- **Production Bundle Build:**
  ```powershell
  npm run build
  ```
  *Result:* TypeScript typecheck and Vite production build verified (`dist/assets/index-CMxGJ9rw.js`).
- **Vercel Production Deployment:**
  ```powershell
  npx --yes vercel --prod --yes
  ```
  *Result:* `▲ Aliased https://spiral-dine.vercel.app` (`readyState: READY`).
  *Live Production URL:* [https://spiral-dine.vercel.app](https://spiral-dine.vercel.app)
  *Deployment Inspection:* [https://vercel.com/no-one-0/spiraldine/2RrrPU1UBFZtm8AXVW4SKMZBbe13](https://vercel.com/no-one-0/spiraldine/2RrrPU1UBFZtm8AXVW4SKMZBbe13)

---

## 5. Parity Matrix Summary

| Capability | Canonical Desktop Web | Mobile Web Browser | Native Android App | Parity Status |
| :--- | :---: | :---: | :---: | :---: |
| Category CRUD & Sort Order | ✅ | ✅ | ✅ | **100% Parity** |
| Duplicate Category Name Check | ✅ | ✅ | ✅ | **100% Parity** |
| Menu Item Full Fields & Flags | ✅ | ✅ | ✅ | **100% Parity** |
| Dynamic Category Dropdown | ✅ | ✅ | ✅ | **100% Parity** |
| Discount Price `< Base Price` Validation | ✅ | ✅ | ✅ | **100% Parity** |
| Production Mode (On Demand / Batch) | ✅ | ✅ | ✅ | **100% Parity** |
| Combos with Real Item Selector | ✅ | ✅ | ✅ | **100% Parity** |
| Order Telemetry Menu Analytics | ✅ | ✅ | ✅ | **100% Parity** |
| Category-Grouped Availability Master Switches | ✅ | ✅ | ✅ | **100% Parity** |
| Responsive Pricing & Badge Toggles | ✅ | ✅ | ✅ | **100% Parity** |
| 2-Column Mobile Customer Preview | ✅ | ✅ | ✅ | **100% Parity** |
| Scannable `/r/:tenantId/table/:tableNum` QR | ✅ | ✅ | ✅ | **100% Parity** |
| Touch Drag/Tap Table Coordinates Repositioning | ✅ | ✅ | ✅ | **100% Parity** |
