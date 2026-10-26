# Customer Home Page: Section Order Reordering Report (Popular Dishes Before Popular Restaurants)

## 1. Executive Summary

This update reorders the Customer Home screen sections so that **Popular Dishes appears immediately above Popular Restaurants** across both:
1. **Native Android Customer Application** (Kotlin + Jetpack Compose)
2. **Customer Web Application** (React + TypeScript + Vite)

All branding, clean white theme tokens, Poppins/Inter typography, card dimensions, button alignments, bottom navigation parity, and authoritative Firebase backend data sources have been strictly preserved.

Both platforms have been built, validated, and deployed:
* **Web Production URL**: `https://spiral-dine.vercel.app` (Deployment ID: `dpl_HthPUbzU2YhuK41ESSmGixerVrZ4`)
* **Android Customer Debug APK**: `android/customer/build/outputs/apk/debug/customer-debug.apk` (49.9 MB)

---

## 2. Updated Customer Home Page Section Order

The Customer Home experience on both Android and Web now follows this exact section layout:

| Section # | Section Name | Details | Status |
|---|---|---|---|
| **1** | Header & SpiralDine Branding | Logo, Brand text, Active dining session pill indicator, Cart button with real-time badge | Preserved |
| **2** | Location Selector | City & Locality picker with GPS detection and manual selector modal | Preserved |
| **3** | Search Bar | Restaurant and dish search input with real-time filtering and filter drawer | Preserved |
| **4** | Promotional Carousel | Auto-rotating promotional banners with discount codes | Preserved |
| **5** | Explore by Cuisine | Horizontal category cards (Biryani, North Indian, South Indian, Desserts, Chinese, Italian, Beverages, etc.) | Preserved |
| **6** | Quick Actions | Scan QR, My Orders, Book a Table 3-column action cards | Preserved |
| **7** | **Popular Dishes (Section F)** | **Horizontal scrollable dish cards with real dishes from backend, prices, restaurant names, and add-to-cart actions** | **Moved above Popular Restaurants** |
| **8** | **Popular Restaurants (Section G)** | **Compact horizontal restaurant cards with open/closed status, ratings, distance, cuisines, price for two, and favorites toggle** | **Moved below Popular Dishes** |
| **9** | Remaining Sections | Active dining session banner / empty state / coming soon state | Preserved |

---

## 3. Files Changed

### 3.1 Android Customer Application
* **`android/customer/src/main/java/com/spiralworld/spiraldine/ui/screens/HomeScreen.kt`**:
  * Relocated `SECTION: POPULAR DISHES` (LazyRow containing `PopularDishCard` items) from bottom of `LazyColumn` to immediately follow Section E (Quick Actions) and precede Section G (Popular Restaurants).
  * Maintained consistent vertical spacing (`Spacer(modifier = Modifier.height(20.dp))`) between the dish row and restaurant listings.
  * Preserved `onDishClick` handler, restaurant linking, image fallbacks, and real price formatting with `CurrencyFormatter`.

### 3.2 Web Customer Application
* **`src/apps/customer/pages/CustomerHome.tsx`**:
  * Moved the `<section>` for Popular Dishes (`SECTION F — POPULAR DISHES / EXPLORE DISHES`) to immediately follow Quick Actions (`SECTION E — QUICK ACTIONS`) and precede Popular Restaurants (`SECTION G — RESTAURANT LISTINGS`).
  * Preserved horizontal scrolling with `overflow-x-auto`, `snap-x`, and `scrollbar-none`.
  * Preserved dish add actions, canonical currency formatting (`formatPrice`), restaurant detail routing, and skeleton loaders.

---

## 4. Authoritative Backend & Data Integrity

1. **Popular Dishes Data**:
   * Sourced directly from live Firestore menus across active restaurants.
   * Neither platform creates mock dishes or fabricated popularity rankings.
   * If a restaurant updates a menu item's price or availability, both platforms synchronize automatically.
2. **Popular Restaurants Data**:
   * Sourced from Firestore `restaurants` collection, filtered by active status and user location.
   * Distance calculation and open/closed badges reflect actual business hours and user coordinates.

---

## 5. Verification & Testing

### 5.1 Android Application Verification
* **Unit Tests**:
  * Ran `gradlew.bat :customer:testDebugUnitTest`.
  * Result: `BUILD SUCCESSFUL in 15s`, all unit tests passed.
* **Compilation & APK Assembly**:
  * Ran `gradlew.bat :customer:assembleDebug`.
  * Result: `BUILD SUCCESSFUL in 28s`.
  * Output APK: `android/customer/build/outputs/apk/debug/customer-debug.apk`.

### 5.2 Web Application Verification
* **TypeScript & Vite Build**:
  * Ran `npm run build`.
  * Result: Built successfully in 9.11s with zero errors.
* **Production Deployment**:
  * Deployed using `npx vercel --prod --yes`.
  * Deployment ID: `dpl_HthPUbzU2YhuK41ESSmGixerVrZ4`.
  * Live URL: `https://spiral-dine.vercel.app`.
  * Aliased Production URL: `https://spiral-dine.vercel.app`.

---

## 6. Remaining Issues / Notes

* None. The section order has been unified and verified across both platforms. Popular Dishes is rendered above Popular Restaurants on both mobile Compose and web layouts without regression.
