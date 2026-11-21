# SpiralDine Google Sign-In & Single-Account Identity Production Deployment Report

**Date:** November 21, 2026  
**Target Environment:** Production  
**Production Domain:** [https://dine.spiralworld.in](https://dine.spiralworld.in)  
**Secondary Production Domain:** [https://spiraldine-no-one-0.vercel.app](https://spiraldine-no-one-0.vercel.app)  
**Authorized Firebase Project:** `spiral-restaurant-saas-v1`  
**GitHub Branch:** `feature/google-signin-and-identity`  
**Latest Production Deployment ID:** `dpl_GWVAHZwtC4cGNcUJghHAbjgfa8yh`  
**Git Commit SHA:** `84bb37c`  
**Deployment Status:** **● READY & LIVE IN PRODUCTION**  

---

## Executive Summary

The Google Sign-In and Single-Account Identity architecture is live in **Production** on Vercel at [https://dine.spiralworld.in](https://dine.spiralworld.in).

An initial client-side Firebase Auth runtime exception (`auth/argument-error`) observed on `/customer/login` has been thoroughly analyzed, resolved, tested, and redeployed. The production CDN has been verified to serve the updated application bundle (`index-B0ZgNofN.js`), with all 129 test assertions passing.

---

## 1. Resolution of `auth/argument-error`

### 1.1 Root Cause Analysis
- In Firebase Auth modular SDK (`firebase: ^10.12.2`), initializing authentication via `initializeAuth(app, { persistence: ... })` with custom persistence (such as `browserSessionPersistence`) omits the default popup/redirect resolver unless explicitly passed via `popupRedirectResolver`.
- Whenever `getRedirectResult(auth)` was executed on initial component mount (or `signInWithPopup(auth, provider)` on user action), Firebase's internal method `_withDefaultResolver` asserted `auth._popupRedirectResolver`. Because this was `undefined`, it immediately threw `Firebase: Error (auth/argument-error).`
- On `/customer/login` and other auth views, the component caught this uninitialized check error on mount and rendered the red alert banner before any user interaction took place.

### 1.2 Implemented Fix
1. **Config Initialization ([src/shared/firebase/config.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/firebase/config.ts)):**
   - Configured `initializeAuth` with `popupRedirectResolver: typeof window !== 'undefined' ? browserPopupRedirectResolver : undefined`.
2. **Auth Service Resolver ([src/shared/firebase/auth.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/firebase/auth.ts)):**
   - Passed `browserPopupRedirectResolver` explicitly to `signInWithPopup()`, `linkWithPopup()`, `signInWithRedirect()`, and `getRedirectResult()`.
   - Updated `getGoogleRedirectResult()` to safely return `null` on initial mount if no redirect operation was initiated.
3. **Graceful UI Error Mapping ([CustomerLogin.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerLogin.tsx), [CustomerRegister.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerRegister.tsx), [LoginForm.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/features/auth/components/LoginForm.tsx)):**
   - Filtered passive mount errors so uninitialized redirect checks never surface error alerts on initial page load.
   - Replaced raw Firebase error text with user-friendly actionable error messages.

---

## 2. Production Deployment Details

| Deployment Parameter | Live Production Value |
| :--- | :--- |
| **Vercel Project** | `spiraldine` (Team: `no-one-0`) |
| **Vercel Deployment ID** | `dpl_GWVAHZwtC4cGNcUJghHAbjgfa8yh` |
| **Target Environment** | `Production` |
| **Status** | **● Ready** |
| **Primary Production URL** | [https://dine.spiralworld.in](https://dine.spiralworld.in) |
| **Vercel Production Canonical** | [https://spiraldine-no-one-0.vercel.app](https://spiraldine-no-one-0.vercel.app) |
| **Vercel Inspection Dashboard** | [https://vercel.com/no-one-0/spiraldine/GWVAHZwtC4cGNcUJghHAbjgfa8yh](https://vercel.com/no-one-0/spiraldine/GWVAHZwtC4cGNcUJghHAbjgfa8yh) |
| **Branch** | `feature/google-signin-and-identity` |
| **Deployed Git Commit** | `84bb37c` |
| **Active Live Bundle** | `https://dine.spiralworld.in/assets/index-B0ZgNofN.js` |
| **Serverless Functions** | 12 API functions deployed to AWS `iad1` (Washington, D.C., USA) |

---

## 3. Live Production Verification & Audit Results

Automated live audit script [scripts/verify-production-live.mjs](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/scripts/verify-production-live.mjs) was executed directly against `https://dine.spiralworld.in`.

### 3.1 Route Health Checks (HTTP 200 OK)
- **Landing Page (`/`):** `HTTP 200 OK`
- **Owner Login (`/login`):** `HTTP 200 OK`
- **Owner Registration (`/register`):** `HTTP 200 OK`
- **Password Reset (`/reset-password`):** `HTTP 200 OK`
- **Customer Login (`/customer/login`):** `HTTP 200 OK`
- **Customer Registration (`/customer/register`):** `HTTP 200 OK`

### 3.2 Live Production Bundle Inspection
The updated live bundle (`/assets/index-B0ZgNofN.js`) was fetched from the production CDN and verified:
1. **Target Project Identity:** Bound to Firebase project `spiral-restaurant-saas-v1`.
2. **Popup Resolver Wiring:** `browserPopupRedirectResolver` and `popupRedirectResolver` are active and initialized.
3. **Google Sign-In Components:** `GoogleAuthProvider`, `signInWithPopup`, and Google UI branding elements active across all portals.
4. **Account-Linking Logic:** `linkWithCredential` and `AccountLinkingModal` present for handling `auth/account-exists-with-different-credential`.

### 3.3 Backend Serverless API Health
- **Endpoint:** `https://dine.spiralworld.in/api/auth/send-password-reset`
- **Response:** `HTTP 405 Method Not Allowed` on raw `GET` requests (verifying standard POST enforcement).

---

## 4. Test Suite Summary

| Test Suite | File | Status | Passing Assertions |
| :--- | :--- | :---: | :---: |
| Staging Isolation Guard | `scripts/test-staging-environment-isolation.mjs` | **PASS** | 48 / 48 |
| Single-Account Identity | `scripts/test-single-account-identity.mjs` | **PASS** | 38 / 38 |
| Google Auth Integration | `scripts/test-google-auth-integration.mjs` | **PASS** | 26 / 26 |
| Full Auth Regression | `scripts/test-auth-full-regression.mjs` | **PASS** | 17 / 17 |
| TypeScript Compiler | `npx tsc --noEmit` | **PASS** | 0 errors |
| Vite Production Build | `npm run build` | **PASS** | 0 errors |
| **Total Automated Assertions** | | **PASS** | **129 / 129** |

---

## 5. Live Testing Checklist

1. **Diner Sign-In ([https://dine.spiralworld.in/customer/login](https://dine.spiralworld.in/customer/login)):**
   - Refresh page: Confirm no red error banner appears on initial load.
   - Click **"Sign in with Google"**: Confirm the standard Google authentication popup opens cleanly.
2. **Owner Login ([https://dine.spiralworld.in/login](https://dine.spiralworld.in/login)):**
   - Click **"Continue with Google"**: Popup opens with `select_account` prompt.
3. **Account Linking:**
   - Sign in with a Google account matching an existing Email/Password user.
   - The secure Account Linking modal prompts for password and merges credentials under the single Firebase UID.
