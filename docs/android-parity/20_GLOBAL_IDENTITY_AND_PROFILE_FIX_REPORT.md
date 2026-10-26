# SpiralDine — Global Account Identity, Profile Navigation, and Cross-Platform Consistency Remediation Report

**Document ID:** `20_GLOBAL_IDENTITY_AND_PROFILE_FIX_REPORT.md`  
**Date:** October 26, 2026  
**Status:** COMPLETE & DEPLOYED  
**Target Environments:** Web Application (Production), Android Owner Application (`:owner`), Android Customer Application (`:customer`)  
**Production URL:** [https://spiral-dine.vercel.app](https://spiral-dine.vercel.app)  

---

## 1. Executive Summary

This remediation addresses incorrect profile identity, hardcoded account fallbacks, missing home-page profile navigation, and cross-session data leakage across SpiralDine's web and native Android applications. 

Prior to this fix, the Settings & Legal screen presented a static name ("Restaurant Owner" or hardcoded "Paradise Biryani"), a static email ("owner@spiraldine.com" or hardcoded developer test email), a hardcoded initial avatar ("O" or "P"), and an unconditional verification label ("Verified Workspace Owner") regardless of the authenticated user's actual role (owner vs. manager vs. waiter vs. cashier). Furthermore, profile icons on the dashboard were either non-navigable or completely missing (such as on the native Customer home header), and logging out in native Android detached Firestore snapshot listeners without resetting cached state flows, leaving previous user records in memory.

All defects have been resolved systematically across the React/TypeScript website, the native Kotlin/Compose Owner application, and the native Kotlin/Compose Customer application without altering framework architecture, Firebase project IDs, or package names.

---

## 2. Root Cause Analysis

Investigation revealed four interconnected factors causing the reported defects:

1. **Hardcoded Fallbacks in Presentation Components**:
   - In `MobileSettingsLegal.tsx`, the profile card displayed `activeRestaurant?.name || user?.displayName || 'Paradise Biryani'`, overwriting the authenticated user's identity with the venue name, and defaulted email to `geethakrishnakumbha123@gmail.com`.
   - In `MobileOwnerHeader.tsx`, avatar initials defaulted to `'O'` and restaurant name defaulted to `'Paradise Biryani'`.
   - In `Navbar.tsx`, waiter fallback name was hardcoded to `'Sri Charan'` with initial `'SC'`.
   - In `CustomerHeader.tsx` and `CustomerLayout.tsx`, avatar initial fallback was hardcoded to `'GC'`.
   - In `android/owner/.../Models.kt`, `RestaurantOverview` defaulted `email` to `geethakrishnakumbha123@gmail.com` and `name` to `Paradise Biryani`.

2. **Absence of Dedicated User Profile Model in Android Owner Module**:
   - The native Owner module only modeled `RestaurantOverview`, conflating restaurant identity with personal account identity. When staff members or non-owner operators signed in, their personal identity was neither resolved nor tracked in a distinct state flow.

3. **Incomplete Session Invalidation on Logout / Account Switch**:
   - In `OwnerRepository.kt`, `clearListeners()` removed active Firestore listeners, but left all 33 `StateFlow` streams (`_orders`, `_transactions`, `_overview`, `_tables`, etc.) populated in memory with the previous tenant's data.

4. **Missing Profile Navigation in Home Headers**:
   - In `android/customer/ui/screens/HomeScreen.kt`, the header action row only provided Favourite and Notification buttons, omitting a Profile avatar button entirely.
   - In web `Navbar.tsx`, the profile trigger lacked an `onClick` navigation handler.

---

## 3. Actual Authenticated Identity Resolution Flow

The identity resolution architecture now enforces a unified, role-aware, multi-tier resolution mechanism across web and Android:

```
[Firebase Authentication]
          │
          ▼
   (fUser.uid)
          │
    ┌─────┴────────────────────────────────────────────────────────┐
    │                                                              │
    ▼                                                              ▼
1. Direct User Lookup                              2. Direct Customer Lookup
   (Firestore: users/{uid})                           (Firestore: customers/{uid})
    │                                                              │
    ├─► Found?                                                     ├─► Found?
    │   Bind dynamic UserProfile                                   │   Bind CustomerProfile
    │                                                              │
    ▼ Not Found                                                    │
3. Employee Record Lookup                                          │
   (Firestore: employees where firebaseUid == uid)                 │
    ├─► Found? Bind role, branchId, tenantId                       │
    ▼ Not Found                                                    │
   (Firestore: employees where email == cleanEmail)                │
    ├─► Found? Auto-link UID and bind profile                      │
    ▼ Not Found                                                    │
4. Venue Ownership Lookup                                          │
   (Firestore: restaurants where ownerUid == uid)                  │
    ├─► Found? Bind as Owner for tenantId                          │
    ▼ Not Found                                                    │
   (Firestore: tenants where ownerUid == uid)                      │
    ├─► Found? Bind as Owner for tenantId                          │
    ▼ Not Found                                                    │
5. No Tenant Assigned State                                        ▼
   (Safe failure state; no hardcoded defaults)       (Guest or Registered Diner)
```

### Neutral Fallback Rules
- **Display Name**: `user.displayName` ➔ `user.email.split('@')[0]` ➔ `"Authorized User"` (never a fabricated name).
- **Email**: `user.email` ➔ `"No account email"` (never an owner's email substituted for a staff member).
- **Avatar Initial**: First character of display name, email, or `"U"` (`"GD"` for anonymous guest diners).
- **Role Badge**: Dynamically evaluated based on authoritative role:
  - `owner` ➔ `"Verified Workspace Owner"`
  - `manager` ➔ `"Verified Manager"`
  - `kitchen` ➔ `"Verified Kitchen Staff"`
  - `waiter` ➔ `"Verified Service Staff"`
  - `cashier` ➔ `"Verified Billing Staff"`
  - Other ➔ `"Verified Staff Member"` / `"Verified Account"`

---

## 4. Remediation Implementation Summary

### 4.1 Native Android Owner Application (`:owner`)

1. **[Models.kt](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/owner/src/main/java/com/spiraldine/owner/data/model/Models.kt)**:
   - Added `UserProfile` data class (`uid`, `email`, `displayName`, `role`, `tenantId`, `branchId`, `photoUrl`, `isVerified`).
   - Cleaned `RestaurantOverview` defaults: replaced hardcoded test email with `""` and venue name with `"SpiralDine Restaurant"`.

2. **[OwnerRepository.kt](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/owner/src/main/java/com/spiraldine/owner/data/repository/OwnerRepository.kt)**:
   - Added `_currentUserProfile` and exposed `currentUserProfile: StateFlow<UserProfile?>`.
   - Updated `resolveTenantForUser(uid)` to inspect `users/{uid}`, `employees` (by `firebaseUid` and `email`), `restaurants` (by `ownerUid`), and `tenants` (by `ownerUid`).
   - Implemented `resetSession()`: cancels all 33 Firestore listeners and resets all cached StateFlows to neutral empty states on sign-out/switch.

3. **[OwnerSettingsScreen.kt](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerSettingsScreen.kt)**:
   - Accepts `userProfile: UserProfile?` and displays actual authenticated credentials.
   - Dynamically evaluates verification role badges (`Verified Workspace Owner`, `Verified Manager`, `Verified Kitchen Staff`, etc.).
   - Renders a separate Restaurant Association card showing venue and assigned branch.

4. **[OwnerComponents.kt](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/owner/src/main/java/com/spiraldine/owner/ui/components/OwnerComponents.kt)** & **[OwnerHomeScreen.kt](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerHomeScreen.kt)**:
   - Updated `OwnerTopBar` and `OwnerHomeScreen` to take `userProfile` and compute avatar initials dynamically from user credentials.

5. **[MainActivity.kt](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/owner/src/main/java/com/spiraldine/owner/MainActivity.kt)**:
   - Added reactive `AuthStateListener` with `DisposableEffect`.
   - Connected `currentUserProfile` to `OwnerHomeScreen` and `OwnerSettingsScreen`.
   - Calls `repository.resetSession()` on logout.

### 4.2 Native Android Customer Application (`:customer`)

1. **[HomeScreen.kt](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/customer/src/main/java/com/spiralworld/spiraldine/ui/screens/HomeScreen.kt)**:
   - Added `user: CustomerUser?`, `userProfile: CustomerProfile?`, and `onProfileClick: (() -> Unit)?` parameters.
   - Added Profile Avatar button to the top header action row alongside Favourite and Notification buttons.
   - Computes initial dynamically (`userProfile?.displayName` ➔ `user?.displayName` ➔ `user?.email` ➔ `"G"` / `"U"`).

2. **[MainActivity.kt](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/android/customer/src/main/java/com/spiralworld/spiraldine/MainActivity.kt)**:
   - Passed `user`, `userProfile`, and `onProfileClick = { currentTab = NavDestination.PROFILE }` into `HomeScreen`.

### 4.3 Web Application (React + Vite)

1. **[MobileSettingsLegal.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/mobile/pages/MobileSettingsLegal.tsx)**:
   - Replaced hardcoded owner email and fallback names with dynamic `user.displayName`, `user.email`, and role-based badge.
   - Separated User Profile from Restaurant Association.

2. **[MobileOwnerHeader.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/mobile/components/MobileOwnerHeader.tsx)**:
   - Removed hardcoded fallback `'Paradise Biryani'` and static avatar initial `'O'`.

3. **[Navbar.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/ui/layouts/Navbar.tsx)**:
   - Made profile avatar card clickable: navigates to `/owner/settings` for owners.
   - Replaced hardcoded `'Sri Charan'` waiter name with `user?.email?.split('@')[0] || 'Staff Waiter'`.

4. **[CustomerLayout.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/ui/layouts/CustomerLayout.tsx)** & **[CustomerHeader.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/ui/navigation/CustomerHeader.tsx)**:
   - Replaced hardcoded `'GC'` fallback with `(user?.isAnonymous ? 'GD' : 'U')`.

5. **[roleResolver.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/services/roleResolver.ts)**:
   - Replaced hardcoded `'Restaurant Owner'` fallbacks with email username derivations.
   - Added secondary email lookup for employee provisioning when `firebaseUid` is unlinked.

---

## 5. Verification & Test Execution Results

### 5.1 Android Unit Tests
Command: `gradlew.bat testDebugUnitTest`  
Result: **BUILD SUCCESSFUL (73 actionable tasks, 0 failures)**

New and regression tests verified in `android/owner/src/test/java/com/spiraldine/owner/OwnerModelAndLogicTest.kt`:
- `testUserProfileDataModelAndRoleBadgeDerivation`: PASSED
- `testAccountSwitchingDataIsolation`: PASSED
- `testAvatarInitialComputation`: PASSED
- `testOwnerAnalyticsAndSettingsProfileModel`: PASSED
- All existing tests in `:app`, `:customer`, and `:owner`: PASSED

### 5.2 Android Build Artifacts
Command: `gradlew.bat assembleDebug`  
Result: **BUILD SUCCESSFUL (109 actionable tasks, 0 failures)**

Installable APK artifacts produced:
- `:owner`: `android/owner/build/outputs/apk/debug/owner-debug.apk`
- `:customer`: `android/customer/build/outputs/apk/debug/customer-debug.apk`
- `:app`: `android/app/build/outputs/apk/debug/app-debug.apk`

### 5.3 Web Production Build
Command: `tsc && vite build`  
Result: **SUCCESSFUL (built in 8.85s, zero TypeScript or build errors)**

### 5.4 Production Deployment
Command: `npx vercel --prod --yes`  
Result: **DEPLOYED & ALIASED**
- Production URL: [https://spiral-dine.vercel.app](https://spiral-dine.vercel.app)
- Deployment URL: `https://spiraldine-kg7fkc0pz-no-one-0.vercel.app`
- Target: `production`
- Verification: HTTP 200 OK via live content check.

---

## 6. Security and Isolation Compliance

1. **Role-Based Access Control**: No UI label grants backend privileges. Authoritative claims and Firestore security rules remain enforced.
2. **Tenant and Branch Isolation**: Account switching invokes `resetSession()`, completely clearing previous tenant order, transaction, inventory, and profile records from memory.
3. **No Credential Leakage**: Hardcoded emails, names, and credentials have been eliminated from presentation layers.

---

## 7. Status & Sign-off

- [x] Authenticated Identity Resolution across Web & Android
- [x] Dynamic User Name, Email, and Avatar Initials
- [x] Role-specific Verification Badges
- [x] Complete Cache Invalidation and StateFlow Reset on Sign-out
- [x] Home Page Profile Navigation on Web and Android (`:owner` & `:customer`)
- [x] Android Unit Tests Passing (73 tasks)
- [x] Android Debug APKs Built
- [x] Web TypeScript & Production Build Passing
- [x] Production Vercel Deployment Live
