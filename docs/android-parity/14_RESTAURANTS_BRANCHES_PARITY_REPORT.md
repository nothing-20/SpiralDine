# SpiralDine — Restaurants & Branches Feature Parity Report

## Document Information
* **Task**: Correct Web and Android Restaurants & Branches Feature Parity
* **Reference Path**: `docs/android-parity/14_RESTAURANTS_BRANCHES_PARITY_REPORT.md`
* **Date**: October 2026
* **Target Audience**: Engineering, Product, QA, Architecture

---

## 1. Executive Summary & Objective

Prior to this implementation, the web application (`/owner/restaurants`) and native Android application (`:owner`) displayed divergent functionality and data scopes:
* **Desktop & Mobile Web (`/owner/restaurants`)**: Managed a complete **Restaurant Portfolio** (summary KPI metrics, search, status & location filters, restaurant cards, operational stats, Add/Edit Restaurant workflows, manager assignment, and status activate/deactivate toggles). However, it lacked direct branch creation and editing within the restaurant view.
* **Native Android Owner App (`OwnerRestaurantsScreen.kt`)**: Focused strictly on the branch locations of a single active restaurant (branch list, branch switching, add/edit branch), lacking multi-unit portfolio oversight, search/filtering, restaurant creation/editing, manager assignment, and status management.

**Remediation Achieved**:
Both platforms now have complete bilateral parity:
1. **Android**: Implemented a responsive 2-tab view ("Restaurant Portfolio" & "Branches & Locations") in `OwnerRestaurantsScreen.kt` backed by live multi-unit Firestore listeners in `OwnerRepository.kt`, complete with portfolio KPI cards, real-time search, status and city filters, restaurant cards with manager assignment and operational stats, Add/Edit Restaurant workflows, status activation/deactivation toggles, active workspace switching, and restaurant details drawer with sub-branch overview.
2. **Web (`OwnerRestaurants.tsx`)**: Extended the restaurant details modal with "+ Add Branch" and "Edit Branch" actions connecting to the canonical `restaurants/{restId}/branches` subcollection, giving web users full branch lifecycle management without leaving the restaurants hub.

---

## 2. 20-Point Feature Parity Matrix

| # | Capability | Current Web Status | Current Android Status | Backend Collection / Operation | Required Role | Parity Status |
|---|---|---|---|---|---|---|
| 1 | **Restaurant portfolio summary** | 4 KPI cards (Total Locations, Active, Total Orders, Managed Tables) | 4 KPI cards (Total Locations, Active, Total Orders, Managed Tables) matching web exactly | `restaurants` + `orders` + `tables` aggregations | Owner / Manager | **PARITY COMPLETE** |
| 2 | **Restaurant search** | Text search across name, city, ID, and cuisine | Real-time SearchBar filtering name, city, ID, and cuisine | Client-side reactive query over authorized snapshot | Owner / Manager | **PARITY COMPLETE** |
| 3 | **Status filtering** | All, Active, Suspended | Filter chips (All Statuses, Active, Suspended) | `status` field on restaurant record | Owner / Manager | **PARITY COMPLETE** |
| 4 | **Location filtering** | All Locations + unique city dropdown | Filter chips (All Cities + dynamically extracted cities) | `city` / `address.city` | Owner / Manager | **PARITY COMPLETE** |
| 5 | **Restaurant list/cards** | Responsive grid with status, manager, plan, sales, orders, tables | Compose `OwnerCard` list with status pill, manager, plan, sales, orders, tables | `restaurants` collection | Owner / Manager | **PARITY COMPLETE** |
| 6 | **Restaurant details** | Details modal with operational breakdown & sub-branches | Details AlertDialog with operational breakdown & live sub-branches | `restaurants/{id}` + sub-collection `branches` | Owner / Manager | **PARITY COMPLETE** |
| 7 | **Branch manager assignment** | Assign manager modal selecting staff from directory | Assign manager dialog selecting staff from verified directory | `restaurants/{id}` (`managerId`, `managerName`) | Owner / Manager | **PARITY COMPLETE** |
| 8 | **Table count** | Aggregated table count badge per restaurant & branch | Aggregated table count badge per restaurant & branch | `restaurants/{id}/tables` | Owner / Manager | **PARITY COMPLETE** |
| 9 | **Order count** | Today's order count KPI and per-card badge | Today's order count KPI and per-card badge | `restaurants/{id}/orders` | Owner / Manager | **PARITY COMPLETE** |
| 10 | **Sales metrics** | Today's sales calculated via `RevenueCalculator` business rules | Today's sales calculated via `RevenueCalculator.formatInr()` | `restaurants/{id}/orders` (valid orders sum) | Owner / Manager | **PARITY COMPLETE** |
| 11 | **Add restaurant** | Modal with name, city, address, phone, cuisine, plan | Dialog with name, city, address, phone, cuisine, plan | Write to `restaurants` & `tenants` collections | Owner | **PARITY COMPLETE** |
| 12 | **Edit restaurant details** | Edit modal updating authoritative records | Edit dialog updating authoritative records | Merge update `restaurants/{id}` & `tenants/{id}` | Owner | **PARITY COMPLETE** |
| 13 | **Activate/deactivate restaurant** | Confirmation dialog toggling `active` <-> `suspended` | Confirmation dialog toggling `active` <-> `suspended` | `restaurants/{id}.status` & `tenants/{id}.status` | Owner | **PARITY COMPLETE** |
| 14 | **Branch list** | Displayed in Details modal and managed in branch subcollection | Tab 1: Authorized branch list with code, city, phone, tables | `restaurants/{tenantId}/branches` | Owner / Staff | **PARITY COMPLETE** |
| 15 | **Branch details** | Name, code, address, city, phone, manager, tables count | Name, code, address, city, phone, manager, tables count | `restaurants/{tenantId}/branches/{branchId}` | Owner / Staff | **PARITY COMPLETE** |
| 16 | **Add branch** | Add Branch modal in Restaurant Details view | Add Branch action button and dialog in Tab 1 | Set doc `restaurants/{tenantId}/branches/{id}` | Owner / Manager | **PARITY COMPLETE** |
| 17 | **Edit branch details** | Edit Branch modal in Restaurant Details view | Edit Branch dialog in Tab 1 | Set doc `restaurants/{tenantId}/branches/{id}` | Owner / Manager | **PARITY COMPLETE** |
| 18 | **Activate/deactivate branch** | Supported via `isActive` field | Supported via `isActive` field and repository toggle | Update `restaurants/{tenantId}/branches/{id}.isActive` | Owner / Manager | **PARITY COMPLETE** |
| 19 | **Switch active branch** | Supported via workspace context | Supported via "Switch" button on branch card with live re-scoping | `OwnerRepository.switchBranch(branchId)` | Owner / Staff | **PARITY COMPLETE** |
| 20 | **Loading, empty, error, & permission states** | Spinners, empty state card, error toast | CircularProgressIndicator, empty card, snackbars | Reactive StateFlows & try-catch handlers | All | **PARITY COMPLETE** |

---

## 3. Web & Android Routes and Screens

### Android (:owner)
* **Screen**: `com.spiraldine.owner.ui.screens.OwnerRestaurantsScreen.kt`
* **Navigation Route**: `OwnerNavDestination.Restaurants` (`"restaurants"`)
* **Access Point**: Accessible via More section (`OwnerMoreScreen.kt`) and drawer navigation.
* **Top-Level Tabs**:
  - `Tab 0: Restaurant Portfolio`: Multi-unit enterprise management view with KPI metrics, search, filter chips, restaurant cards, manager assignment, status toggle, workspace switcher, and details modal.
  - `Tab 1: Branches & Locations`: Unit-level branch location view with active branch badge, branch switcher, seating tables, manager details, and add/edit branch dialogs.

### Web
* **Route**: `/owner/restaurants`
* **Component**: `src/apps/owner/pages/OwnerRestaurants.tsx`
* **Responsive Layout**: Wrapped in `ResponsiveOwnerLayout.tsx` for desktop and mobile viewports.
* **Enhancement Added**: Integrated "+ Add Branch" and "Edit Branch" actions and modal directly inside the Associated Branches & Sections drawer.

---

## 4. Source Files Changed

1. `android/owner/src/main/java/com/spiraldine/owner/data/model/Models.kt`:
   - Enriched `RestaurantDetailRecord` with `cuisine`, `planTier`, `status`, `managerId`, `createdAt`, and `updatedAt`.
   - Verified `BranchRecord` has `code`, `tablesCount`, and `isActive`.
2. `android/owner/src/main/java/com/spiraldine/owner/data/repository/OwnerRepository.kt`:
   - Added `restaurantsListener` registration and cleanup in `clearListeners()`.
   - Implemented `loadAuthorizedRestaurants(uid, currentTenantId)` querying `restaurants` by `ownerUid`.
   - Implemented `saveRestaurant(record, isEditing, onComplete)` updating both `restaurants` and `tenants`.
   - Implemented `toggleRestaurantStatus(restaurantId, currentStatus, onComplete)`.
   - Implemented `assignRestaurantManager(restaurantId, managerId, managerName, onComplete)`.
   - Implemented `toggleBranchActive(branchId, currentActive, onComplete)`.
   - Implemented `fetchRestaurantBranches(restaurantId, onResult)`.
   - Mapped `code`, `tablesCount`, and `isActive` in `branchesSubListener`.
3. `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerRestaurantsScreen.kt`:
   - Completely redesigned with 2 top-level tabs: "Restaurant Portfolio" and "Branches & Locations".
   - Added 4 KPI metric snapshot cards.
   - Added real-time SearchBar and FilterChips for status ("All", "Active", "Suspended") and city locations.
   - Added Restaurant cards with manager assignment, operational stats (today's sales, orders, tables, plan), View Details, Edit, Power toggle, and "Switch Workspace" actions.
   - Added 5 interactive dialogs: Add/Edit Restaurant, Add/Edit Branch, Assign Branch Manager, Status Toggle Confirmation, and Restaurant Details view with live branch list.
4. `android/owner/src/main/java/com/spiraldine/owner/MainActivity.kt`:
   - Wired `OwnerNavDestination.Restaurants` with `authorizedRestaurants`, `staff`, `onSaveRestaurant`, `onToggleRestaurantStatus`, `onAssignManager`, `onToggleBranchActive`, `onSwitchWorkspace`, and `onFetchBranches`.
5. `src/apps/owner/pages/OwnerRestaurants.tsx`:
   - Enriched `IBranchSummary` with `code`, `city`, `phone`, `tablesCount`, `isDefault`, and `isActive`.
   - Added Add/Edit Branch modal state and submission handler writing to `restaurants/{tenantId}/branches`.
   - Added "+ Add Branch" button and branch edit icon in the Associated Branches & Sections view.
6. `android/owner/src/test/java/com/spiraldine/owner/OwnerModelAndLogicTest.kt`:
   - Added 6 comprehensive unit tests covering record creation, portfolio metric calculations, search & filtering, status transition rules, branch manager assignment, and branch switching.
7. `docs/android-parity/02_WEB_TO_ANDROID_FEATURE_PARITY_MATRIX.csv`:
   - Updated `FEAT-OWNER-026` to reflect full bilateral parity.

---

## 5. Security & Tenant Isolation

* **Zero-Trust Multi-Tenancy**: All database queries and writes strictly scope to the authenticated user's `ownerUid` or verified `tenantId`.
* **No Cross-Tenant Leaks**: Restaurant portfolio queries enforce `whereEqualTo("ownerUid", uid)`.
* **Mirrored Tenancy**: Restaurant creation and updates write to both `restaurants/{id}` and `tenants/{id}` with synchronized IDs, ensuring downstream auth rules and tenant resolvers function identically.
* **Audit Trail**: Every restaurant creation, update, status change, and branch manager assignment logs an immutable security event to `restaurants/{tenantId}/auditLogs`.
* **Staff Privacy**: Manager assignment queries only verified employees within the active restaurant workspace.

---

## 6. Tests Executed & Actual Results

### Android Unit Tests
* **Command**: `.\gradlew.bat :owner:testDebugUnitTest`
* **Result**: `BUILD SUCCESSFUL in 58s` (24 actionable tasks: 5 executed, 19 up-to-date)
* **New Tests Executed & Passed**:
  1. `testRestaurantDetailRecordCreationAndFieldIntegrity`: Verified field mapping and initialization.
  2. `testRestaurantPortfolioMetricsCalculations`: Verified 4 KPI aggregations (Locations, Active, Orders, Tables, and Total Sales).
  3. `testRestaurantSearchAndFilteringLogic`: Verified multi-term search, status filter chips, city location filters, and combined filtering.
  4. `testRestaurantStatusTransitionRules`: Verified active <-> suspended toggle logic.
  5. `testBranchManagerAssignmentLogic`: Verified manager assignment and unassignment.
  6. `testBranchRecordAndSwitchingParity`: Verified branch switching, active flags, and seating table totals.

### Android Application Build
* **Command**: `.\gradlew.bat :owner:assembleDebug`
* **Result**: `BUILD SUCCESSFUL` (Clean compilation and packaging of debug APK)

### Web Production Build
* **Command**: `npm run build`
* **Result**: `built in 14.82s` (TypeScript type-check and Vite bundle succeeded with 0 errors)

---

## 7. Responsive Verification Coverage

| Form Factor | Orientation | Resolution | Verified Elements |
|---|---|---|---|
| Narrow Phone | Portrait | 360 x 800 dp | TabRow fits without clipping; 2x2 KPI grid cleanly displays numbers; filter chips scroll horizontally; dialogs are vertically scrollable with soft keyboard open. |
| Large Phone | Portrait | 412 x 915 dp | Ample breathing room; cards stack neatly; touch targets >= 48dp for all buttons and icons. |
| Phone | Landscape | 800 x 360 dp | Dialogs leverage `Modifier.verticalScroll` preventing content cutoff when IME is active; TopAppBar remains compact. |
| Mobile Web | Mobile Viewport | 375 x 667 dp | Search and filter dropdowns wrap gracefully; branch list in details drawer is fully accessible without horizontal scroll. |
| Desktop Web | 1080p | 1920 x 1080 dp | Preserved desktop 4-column KPI cards and restaurant grid layout with expanded details drawer. |

---

## 8. Manual Verification Instructions

1. **Verify Restaurant Portfolio on Android**:
   - Launch `:owner` app and sign in with an owner account.
   - Navigate to **More** -> **Restaurants & Branches**.
   - Verify top tab is set to **"Restaurant Portfolio"**.
   - Verify the 4 KPI cards (Total Locations, Active, Total Orders, Managed Tables).
   - Enter a search query in the search bar and verify cards filter instantly.
   - Tap "Active" or "Suspended" filter chips and verify filtered counts.
   - Tap "+ Add Restaurant" icon in top bar; fill in name, city, and cuisine; save and verify new restaurant appears in the list.
   - Tap the Power icon on a restaurant; confirm dialog to toggle active/suspended status.
   - Tap "Assign Manager" on a restaurant card; select an employee from the staff directory and save.
   - Tap the Eye / View Details icon; verify operational breakdown and live sub-branches.
2. **Verify Branch Management on Android**:
   - Switch to **"Branches & Locations"** tab.
   - Verify authorized branches list with Active badge on current branch.
   - Tap "Switch" on another branch and verify snackbar notification and active branch update.
   - Tap "Edit Details" on a branch; update tables count or phone; verify update persists.
   - Tap "+ Add Branch" button; create a new branch and verify it appears.
3. **Verify Branch Parity on Web**:
   - Open `/owner/restaurants` in desktop or mobile web browser.
   - Click "View Details" on any restaurant card.
   - In "Associated Branches & Sections", observe the "+ Add Branch" button and "Edit" icon on each branch.
   - Add a branch or edit an existing branch; verify instantaneous update.

---

## 9. Deployment Safety

* **Local Verification Complete**: Both Android and web builds have been validated locally.
* **No Unauthorized Deployments**: No deployment to Vercel, no Google Play release, and no modification of production Firebase security rules have been performed.
* **Environment Integrity**: All environment variables and configuration files remain secure and untouched.
