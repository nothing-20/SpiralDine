# SpiralDine Google Sign-In & Single-Account Identity Production Deployment Report

**Date:** November 21, 2026  
**Target Environment:** Production  
**Production Domain:** [https://dine.spiralworld.in](https://dine.spiralworld.in)  
**Secondary Production Domain:** [https://spiraldine-no-one-0.vercel.app](https://spiraldine-no-one-0.vercel.app)  
**Authorized Firebase Project:** `spiral-restaurant-saas-v1`  
**GitHub Branch:** `feature/google-signin-and-identity`  
**Latest Production Deployment ID:** `dpl_AZPwrd8VPwMbxwCCib5QEn4k7cjU`  
**Git Commit SHA:** `a2afd03`  
**Deployment Status:** **● READY & LIVE IN PRODUCTION**  

---

## Executive Summary

The Google Sign-In and Single-Account Identity architecture is live in **Production** on Vercel at [https://dine.spiralworld.in](https://dine.spiralworld.in).

Two client-side lifecycle and routing issues observed during initial live testing have been resolved, verified, and deployed:
1. `auth/argument-error`: Resolved by configuring `browserPopupRedirectResolver` in `initializeAuth` and all auth helper methods.
2. Post-Login Redirect Loop: Resolved by converting `AuthContext` to a concurrent dual-snapshot listener (`customers/{uid}` and `users/{uid}`) and implementing smart role-based dashboard routing from the Diner Portal.

---

## 1. Post-Login Redirect Loop & Role Routing Resolution

### 1.1 Root Cause Analysis
1. **One-Shot Listener Race in `AuthContext`:**
   - Previously, `AuthContext` checked whether `customers/{uid}` existed at the exact moment `onAuthStateChanged` fired.
   - For a user signing in via Google on `/customer/login`, the document `customers/{uid}` was created a few milliseconds later by the component.
   - Because `customers/{uid}` did not exist at the initial check, `AuthContext` attached its real-time listener to `users/{uid}` instead. It never listened to `customers/{uid}`, leaving `AuthContext` in a `PROFILE_MISSING` state with `user === null`.
   - When the component navigated to `/customer/home`, `CustomerGuard` saw `user === null` and immediately redirected back to `/customer/login`.
2. **Owner/Staff Sign-Out on Diner Portal:**
   - If an account with restaurant owner or staff clearance signed in on `/customer/login`, the handler previously executed `signOutUser()` and blocked them with an alert. This immediately destroyed their authenticated session and reset them to the login screen.

### 1.2 Implemented Fix
1. **Dual Snapshot Profile Resolution ([AuthContext.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/services/AuthContext.tsx)):**
   - `AuthContext` now listens concurrently to both `users/{fUser.uid}` and `customers/{fUser.uid}` using live Firestore snapshots.
   - As soon as `signInOrRegisterCustomerWithGoogle` creates or updates `customers/{uid}`, `AuthContext` immediately receives the profile and authorizes the session.
2. **Smart Role Routing ([CustomerLogin.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerLogin.tsx) & [CustomerRegister.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerRegister.tsx)):**
   - If a restaurant owner or staff member signs in with Google via the diner portal, SpiralDine no longer signs them out. Instead, it recognizes their role and seamlessly routes them to their dashboard (`/owner/dashboard` or staff workspace).
   - If a diner signs in, they are smoothly routed to `/customer/home`.

---

## 2. Production Deployment Details

| Deployment Parameter | Live Production Value |
| :--- | :--- |
| **Vercel Project** | `spiraldine` (Team: `no-one-0`) |
| **Vercel Deployment ID** | `dpl_AZPwrd8VPwMbxwCCib5QEn4k7cjU` |
| **Target Environment** | `Production` |
| **Status** | **● Ready** |
| **Primary Production URL** | [https://dine.spiralworld.in](https://dine.spiralworld.in) |
| **Vercel Production Canonical** | [https://spiraldine-no-one-0.vercel.app](https://spiraldine-no-one-0.vercel.app) |
| **Vercel Inspection Dashboard** | [https://vercel.com/no-one-0/spiraldine/AZPwrd8VPwMbxwCCib5QEn4k7cjU](https://vercel.com/no-one-0/spiraldine/AZPwrd8VPwMbxwCCib5QEn4k7cjU) |
| **Branch** | `feature/google-signin-and-identity` |
| **Deployed Git Commit** | `a2afd03` |
| **Active Live Bundle** | `https://dine.spiralworld.in/assets/index-C_5vm0si.js` |
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
The updated live bundle (`/assets/index-C_5vm0si.js`) was fetched from the production CDN and verified:
1. **Target Project Identity:** Bound to Firebase project `spiral-restaurant-saas-v1`.
2. **Dual-Snapshot Profile Wiring:** Live in `AuthContext`.
3. **Google Sign-In Components:** Active and operational.
4. **Account-Linking Logic:** Active for `auth/account-exists-with-different-credential`.

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
   - Click **"Sign in with Google"** and select your Google account.
   - If signing in with a customer account: You are authenticated and routed into `/customer/home`.
   - If signing in with an owner/staff account: You are welcomed back and routed directly into `/owner/dashboard`.
2. **Owner Login ([https://dine.spiralworld.in/login](https://dine.spiralworld.in/login)):**
   - Click **"Continue with Google"**: Authenticates and routes into the merchant workspace.
