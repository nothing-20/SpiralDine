# Google Sign-In Security & Integration Audit Report

**Target Platform:** SpiralDine Restaurant SaaS (`spiral-restaurant-saas-v1`)  
**Production Domain:** `https://dine.spiralworld.in`  
**Date of Audit:** November 20, 2026  
**Audit Scope:** Pre-deployment security, tenant isolation, role governance, and integration verification for Google Sign-In implementation.

---

## Executive Summary

A comprehensive code-level security and integration audit was conducted across frontend authentication flows, shared role resolvers, routing guards, Firestore security rules, and serverless backend API handlers.

During the audit, **one critical authorization vulnerability** was identified in `src/shared/services/roleResolver.ts` (email-based employee role assignment bypassing the staff invitation and token activation workflow) along with a duplicate tenant edge case in `src/shared/firebase/auth.ts`. Both issues were immediately remediated in the source code and verified with comprehensive integration tests, TypeScript type checks, and a full production build.

### Classification Breakdown
- **PASS:** 18 items (Code-level verified & tested)
- **FAIL:** 0 items (All discovered vulnerabilities fixed)
- **NEEDS MANUAL VERIFICATION:** 4 items (Firebase Console settings requiring cloud administrator access)

---

## 1. Owner Registration Security

| Requirement | Code Verification | Status | Evidence & Inspection Path |
| :--- | :--- | :---: | :--- |
| **New Google accounts cannot obtain owner privileges through ordinary login** | Inspected `src/features/auth/components/LoginForm.tsx` and `src/apps/owner/mobile/pages/MobileSplashLogin.tsx`. | **PASS** | `LoginForm.tsx` (lines 180–193, 250–260) calls `roleResolver.resolveUserRole()`. If no profile or tenant exists, the user is signed out (`authService.signOutUser()`), an error toast is displayed, and unearned owner documents are never created. |
| **Owner registration follows intended workflow** | Inspected `src/features/auth/components/RegisterForm.tsx` and `src/shared/firebase/auth.ts`. | **PASS** | Onboarding requires explicit restaurant name submission on `/register` (`restaurantName.trim().length >= 2`). Google signup calls `signUpOwnerWithGoogle()`, creating tenant, restaurant, and user profile records in a structured sequence. |
| **Tenant, restaurant, and owner profile creation cannot produce duplicate records** | Inspected `signUpOwnerWithGoogle` in `src/shared/firebase/auth.ts`. | **PASS** | Hardened `signUpOwnerWithGoogle()`: Queries both `users/{uid}` and `tenants` where `ownerUid == googleUser.uid`. If an existing tenant document is found, it reuses the existing `tenantId` instead of generating a new random ID, preventing duplicate restaurant records. |
| **Existing owners retain existing tenant IDs, roles, and permissions** | Inspected `src/shared/services/roleResolver.ts` and `src/shared/firebase/auth.ts`. | **PASS** | Profile document lookup takes precedence. If `users/{uid}` exists, `roleResolver` preserves `role` and `tenantId` without mutation. Existing tenant associations remain immutable. |
| **Unauthorized users cannot create privileged Firestore documents directly** | Inspected `firestore.rules` (lines 192–205). | **PASS** | `match /users/{userId}` explicitly blocks unauthorized role writes: `!('role' in request.resource.data && request.resource.data.role in ['super_admin', 'super-admin', 'owner', 'admin'])`. Ordinary clients cannot grant themselves privileged roles in Firestore. |

---

## 2. Staff Invitation Security

| Requirement | Code Verification | Status | Evidence & Inspection Path |
| :--- | :--- | :---: | :--- |
| **Google authentication cannot bypass staff invitations** | Inspected `src/shared/services/roleResolver.ts` and `src/features/auth/components/StaffActivate.tsx`. | **PASS** *(Remediated)* | **Vulnerability Found & Fixed:** Previously, `roleResolver.ts` had a fallback query `where('email', '==', cleanEmail)`. If an employee was invited but had not activated their invitation token, signing in with Google with that email auto-provisioned a staff profile, bypassing the invitation token and activation flow. **Fix:** Removed email matching fallback entirely. Matching is strictly by `firebaseUid == fUser.uid`. |
| **Staff roles retrieved from authoritative server-side records** | Inspected `src/shared/services/roleResolver.ts`. | **PASS** | Staff roles are resolved only from verified Firestore documents (`users/{uid}` or `employees` where `firebaseUid == fUser.uid`). Client-provided role hints or localStorage claims are ignored. |
| **Email matching alone cannot grant employee role** | Inspected `roleResolver.ts` (lines 251–280). | **PASS** | Verified that email alone never links or promotes an account to staff status. Only an explicit activation via `StaffActivate.tsx` with a verified token links `firebaseUid` to the employee record. |
| **Invitation status, tenant association, and account activation are validated** | Inspected `roleResolver.ts` lines 265–278. | **PASS** | Explicit validation added in `roleResolver.ts`: `empData.status === 'active'`, `empData.activationStatus === 'activated'`, and valid non-empty `empData.tenantId`. Pending, unactivated, or suspended records are rejected (`return null`). |
| **Customers cannot access staff or owner dashboards** | Inspected `src/routes/OwnerGuard.tsx` (lines 30–33) and `src/features/auth/components/LoginForm.tsx` (lines 208–219). | **PASS** | If `profile.role === 'customer'`, `LoginForm.tsx` immediately signs out the user with `'This account is registered as a diner account.'`. If a customer navigates directly to `/owner/*`, `OwnerGuard.tsx` redirects them to `/customer/home`. `RoleGuard.tsx` further enforces `allowedRoles` per sub-route. |

---

## 3. Firebase Authentication Security

| Requirement | Code Verification | Status | Evidence & Inspection Path |
| :--- | :--- | :---: | :--- |
| **Firebase authentication tokens are correctly handled** | Inspected `src/shared/firebase/auth.ts` and `api/send-staff-invitation.ts`. | **PASS** | Standard Firebase Auth ID tokens are generated by `User.getIdToken()`. Client-side token state is managed with `browserSessionPersistence` (tab-isolated). |
| **Backend APIs use Firebase Admin / Identity Toolkit verification** | Inspected `api/orders/create.ts`, `api/send-staff-invitation.ts`, `api/_lib/firebaseAdminAuth.ts`. | **PASS** | Serverless endpoints verify incoming `Authorization: Bearer <token>` via Google Identity Toolkit (`accounts:lookup`) or Firebase Admin SDK. Cryptographically validates token expiry, signature, and UID. |
| **No client-provided role or tenant ID is trusted by backend** | Inspected `api/orders/create.ts` (lines 100–120). | **PASS** | The backend verifies `customerId === tokenUser.uid`. Requests attempting to spoof customer ID or inject unearned roles are rejected with `403 Forbidden`. |
| **Redirect authentication correctly restores authentication result** | Inspected `getGoogleRedirectResult()` in `src/shared/firebase/auth.ts`, `LoginForm.tsx`, and `RegisterForm.tsx`. | **PASS** | `getRedirectResult(auth)` is invoked on mount in `useEffect`. If a redirect credential returns, it passes through the same role validation and registration workflow as popups, restoring registration drafts via `sessionStorage`. |
| **Popup and redirect flows do not create duplicate user records** | Inspected `signInWithGoogle` and `getGoogleRedirectResult`. | **PASS** | Both popup and redirect return the same Firebase `User` object with identical UID. Firestore writes use document ID `= user.uid` (`users/{uid}` and `customers/{uid}`), making profile creation strictly idempotent. |
| **Existing email/password and phone authentication remain unaffected** | Inspected `src/services/authService.ts`, `LoginForm.tsx`, and regression tests. | **PASS** | `signInWithEmailAndPassword`, `signInWithPhoneNumber`, and OTP verification functions remain completely intact with zero code modifications to their core logic. |

---

## 4. Firebase Configuration & Environment

| Requirement | Inspection / Action | Status | Evidence & Instructions |
| :--- | :--- | :---: | :--- |
| **No OAuth secrets exposed in frontend code** | Executed code search across `src/` for `client_secret`, `clientSecret`, and `private_key`. | **PASS** | Verified zero occurrences. Only standard public identifiers (`apiKey`, `authDomain`, `projectId`, `appId`) exist in frontend bundle. |
| **Google provider enabled in Firebase Console** | Cloud console setting in `spiral-restaurant-saas-v1`. | **NEEDS MANUAL VERIFICATION** | **Action Required:** Open Firebase Console -> Authentication -> Sign-in method -> Google -> Ensure provider status is **Enabled**. |
| **dine.spiralworld.in included in Firebase Authorized Domains** | Cloud console setting in `spiral-restaurant-saas-v1`. | **NEEDS MANUAL VERIFICATION** | **Action Required:** Open Firebase Console -> Authentication -> Settings -> Authorized domains -> Verify `dine.spiralworld.in` is listed. |
| **OAuth redirect URI configured in Google Cloud Console** | Google Cloud Console OAuth Credentials. | **NEEDS MANUAL VERIFICATION** | **Action Required:** In Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs -> Ensure authorized redirect URIs includes `https://spiral-restaurant-saas-v1.firebaseapp.com/__/auth/handler`. |
| **Production environment variables configured on Vercel** | Vercel Project Environment Variables. | **NEEDS MANUAL VERIFICATION** | **Action Required:** Ensure Vercel production environment has `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, and `VITE_FIREBASE_PROJECT_ID` set. |

---

## 5. Vulnerabilities Discovered & Fixes Applied

### Vulnerability 1: Staff Invitation Bypass via Email Matching (CWE-287 / CWE-863)
- **File:** `src/shared/services/roleResolver.ts`
- **Location:** Lines 251–270
- **Severity:** High
- **Description:**  
  When resolving an authenticated user whose `users/{uid}` document did not exist, `roleResolver` performed a fallback lookup in the `employees` collection:
  ```ts
  else if (cleanEmail) {
    const qEmail = query(empRef, where('email', '==', cleanEmail));
    const snapEmail = await getDocs(qEmail);
    if (!snapEmail.empty) { empData = snapEmail.docs[0].data(); }
  }
  ```
  If an employee had been invited by email (e.g., `chef@example.com`) but had not yet accepted the invite or verified their token via `/staff/activate`, anyone logging into Google with that email address was immediately provisioned a staff role and granted access to the restaurant's operational dashboard. Furthermore, suspended employees whose `status` was `inactive` were not explicitly checked.
- **Fix Applied:**
  1. Removed `where('email', '==', cleanEmail)` query fallback completely.
  2. Enforced lookup strictly by `where('firebaseUid', '==', fUser.uid)`.
  3. Added explicit state validation requiring:
     - `empData.status === 'active'`
     - `empData.activationStatus === 'activated'`
     - `empData.tenantId` is non-empty and valid.
  4. Any record failing these checks is immediately rejected with `return null`.

### Vulnerability 2: Potential Duplicate Tenant Generation on Google Owner Signup
- **File:** `src/shared/firebase/auth.ts`
- **Location:** Lines 428–450
- **Severity:** Medium
- **Description:**  
  In `signUpOwnerWithGoogle()`, the function checked if `users/{googleUser.uid}` existed. However, if an owner's user document was absent or wiped, but a tenant record had already been provisioned with `ownerUid == googleUser.uid`, a new random `tenantId` would be generated, spawning duplicate tenant and restaurant documents.
- **Fix Applied:**
  Added a query to `tenants` matching `ownerUid == googleUser.uid`. If an existing tenant document is found, `signUpOwnerWithGoogle()` reuses that `tenantId`, prevents duplicate document creation, and reconciles the user profile.

---

## 6. Testing & Build Verification

### 6.1 Automated Integration Test Suite
The automated test runner (`scripts/test-google-auth-integration.mjs`) was executed:
```
====================================================
SPIRALDINE GOOGLE AUTHENTICATION INTEGRATION SUITE
====================================================

--- Test Group 1: Existing Profile Preservation ---
  [PASS] Existing user role is preserved as "owner"
  [PASS] Existing tenantId is preserved and not overwritten
  [PASS] UID remains strictly tied to the Firebase user
  [PASS] Staff member role ("kitchen") is preserved upon Google Sign-In
  [PASS] Staff tenant binding is strictly maintained

--- Test Group 2: Privilege Escalation Prevention ---
  [PASS] Unregistered user signing in via Google does NOT receive default owner role
  [PASS] Unregistered user signing in via Google does NOT receive default staff role

--- Test Group 3: Owner Google Registration Workflow ---
  [PASS] Tenant document correctly references the Google owner UID
  [PASS] Registered owner has explicit "owner" role
  [PASS] Registered owner profile is bound to the created tenantId

--- Test Group 4: Customer Portal & Portal Isolation ---
  [PASS] Customer account signing in with Google is blocked from Owner/Staff portal
  [PASS] Owner account signing in with Google is redirected away from diner portal
  [PASS] Waiter account signing in with Google is redirected away from diner portal

--- Test Group 5: Authentication Edge Cases ---
  [PASS] User closing popup is handled cleanly without intrusive error
  [PASS] Blocked popup initiates fallback to full-page redirect
  [PASS] Existing email/password account collision provides clear guidance

--- Test Group 6: Authentication Non-Regression ---
  [PASS] Password reset URL remains configured for SpiralDine
  [PASS] Password reset continues handling codes in-app

--- Test Group 7: Serverless Backend Token Verification ---
  [PASS] Backend ID token parser extracts Google User UID identical to email/password users
  [PASS] Google sign-in provider is recognized by standard Firebase JWT verification

--- Test Group 8: Staff Invitation Security & Email Matching Rejection ---
  [PASS] Unactivated staff invitation matching email alone CANNOT grant staff role
  [PASS] Suspended or inactive employee CANNOT access staff dashboard via Google auth
  [PASS] Properly activated employee with matching firebaseUid is granted staff role

--- Test Group 9: Owner Duplicate Tenant Prevention ---
  [PASS] Returning owner with existing profile preserves existing tenant ID
  [PASS] Returning owner without users/{uid} profile document reuses existing tenant ID without duplication
  [PASS] Brand new owner creates a single new tenant record

====================================================
RESULTS: 26/26 tests passed (100%)
====================================================
```

### 6.2 TypeScript Compilation Check
- **Command:** `npx tsc --noEmit`
- **Result:** **0 errors**. Type checks passed completely.

### 6.3 Vite Production Build
- **Command:** `npm run build`
- **Result:** **Success**.
  - 2,200 modules transformed.
  - Production bundles generated cleanly in `dist/` within 14.06 seconds.

---

## 7. Files Inspected & Modified

### Modified Files:
1. [src/shared/services/roleResolver.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/services/roleResolver.ts) — Eliminated email matching bypass; enforced `firebaseUid`, `status === 'active'`, and `activationStatus === 'activated'`.
2. [src/shared/firebase/auth.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas/Project%20Saas%20for%20all/src/shared/firebase/auth.ts) — Added duplicate tenant prevention in `signUpOwnerWithGoogle()`; added graceful Firestore error handling.
3. [src/features/auth/components/LoginForm.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/features/auth/components/LoginForm.tsx) — Added Google Sign-In button, popup/redirect handling, and unassigned user rejection.
4. [src/features/auth/components/RegisterForm.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/features/auth/components/RegisterForm.tsx) — Added Google Sign-Up with restaurant validation and redirect draft restoration.
5. [src/apps/owner/mobile/pages/MobileSplashLogin.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/mobile/pages/MobileSplashLogin.tsx) — Added mobile Google Sign-In with staff verification.
6. [src/apps/customer/pages/CustomerLogin.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerLogin.tsx) — Added Google authentication with staff account redirection.
7. [src/apps/customer/pages/CustomerRegister.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerRegister.tsx) — Added customer Google registration.
8. [src/routes/AppRoutes.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/routes/AppRoutes.tsx) — Added auth paths to `isAuthAction` to prevent premature `ProfileErrorScreen` interrupts.
9. [src/services/authService.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/services/authService.ts) & [src/shared/services/authService.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/services/authService.ts) — Exposed Google auth methods.

### New Test & Component Files:
1. [src/components/ui/GoogleSignInButton.tsx](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/components/ui/GoogleSignInButton.tsx) — Official Google branding compliant button.
2. [scripts/test-google-auth-integration.mjs](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/scripts/test-google-auth-integration.mjs) — 26-assertion security and integration test suite.

---

## 8. Deployment Checklist & Next Steps

Before triggering production deployment to `https://dine.spiralworld.in`:

- [ ] **Verify in Firebase Console (`spiral-restaurant-saas-v1`):**
  1. Under **Authentication > Sign-in method**, confirm **Google** provider is toggled **Enabled**.
  2. Under **Authentication > Settings > Authorized domains**, confirm `dine.spiralworld.in` is listed.
- [ ] **Verify in Google Cloud Console:**
  1. Under **APIs & Services > Credentials > OAuth 2.0 Client IDs**, verify that `https://spiral-restaurant-saas-v1.firebaseapp.com/__/auth/handler` is listed under Authorized redirect URIs.
- [ ] **Production Rules & Data:**
  1. No modifications made to production Firestore data.
  2. No modifications made to `firestore.rules`.
  3. No secrets pushed to repository.
