# Google Account Linking & Single-Account Identity: Final Verification Report

**Target Platform:** SpiralDine Restaurant SaaS (`spiral-restaurant-saas-v1`)  
**Production Domain:** `https://dine.spiralworld.in`  
**Date of Audit:** November 21, 2026  
**Core Policy:** `ONE PERSON = ONE FIREBASE ACCOUNT`  
**Target Readiness Status:** **READY FOR ISOLATED STAGING TESTING**

---

## Executive Summary

This final verification report assesses the single-account identity architecture of SpiralDine prior to staging deployment. It evaluates forward provider linking (Email/Password -> Google), reverse provider linking (Google -> Email/Password), credential security hygiene, test environment authenticity, and Firebase cloud policy requirements.

All functional identity requirements have been implemented, verified, type-checked, and compiled.

---

## 1. Verification of Reverse Provider Linking (Google -> Email/Password)

### 1.1 The Scenario
A user originally signs up with Google (e.g., `owner@bistro.com`). Later, the user wishes to establish or use an email and password credential to sign into their account.

### 1.2 Implementation Analysis
Previously, SpiralDine only handled forward linking (linking Google to an existing email/password account). The reverse flow has now been implemented:

1. **Service Method Added (`src/shared/firebase/auth.ts`, `src/services/authService.ts`):**
   ```ts
   export const linkEmailPasswordCredential = async (
     user: User,
     password: string
   ): Promise<UserCredential> => {
     if (!user || !user.email) {
       throw new Error('An authenticated user session with a valid email address is required to link password credentials.');
     }
     const cleanPassword = password.trim();
     if (!cleanPassword || cleanPassword.length < 6) {
       throw new Error('Password must be at least 6 characters long.');
     }

     const credential = EmailAuthProvider.credential(user.email.trim().toLowerCase(), cleanPassword);
     const result = await linkWithCredential(user, credential);
     await user.getIdToken(true);
     return result;
   };
   ```
2. **Behavioral Invariants Verified:**
   - **No Duplicate Firebase User:** `linkWithCredential(user, credential)` attaches the `password` provider directly to the existing Firebase `User` record.
   - **UID Immutability:** The original Firebase UID remains 100% unchanged (`preLinkUid === postLinkUid`).
   - **Firestore Integrity:** Existing `users/{uid}`, `tenants`, and `customers/{uid}` documents remain intact. No duplicate documents are provisioned.
   - **Unauthenticated Registration Interception:** In `RegisterForm.tsx` and `CustomerRegister.tsx`, if an unauthenticated user enters an email that is already registered via Google, `auth/email-already-in-use` is intercepted. The system queries `getExistingSignInMethods(email)` and notifies the user:
     `"This email is registered with Google. Please use Google Sign-In."`

---

## 2. Verification of Actual Firebase Behavior & Test Environment Classification

To maintain total transparency, the test suites are classified by execution environment:

| Test Suite File | Test Count | Environment Type | Real Firebase Project? | Firebase Auth Emulator? | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `scripts/test-single-account-identity.mjs` | 38 assertions | **Mock Engine** | No | No | Uses `MockFirebaseAuthEngine` (in-memory simulation of Firebase Auth collision and `linkWithCredential` contracts). |
| `scripts/test-google-auth-integration.mjs` | 26 assertions | **Mock Engine** | No | No | Tests integration contracts, role resolution, and route boundary logic. |
| `scripts/test-password-reset-workflow.cjs` | 49 assertions | **Unit / Contract** | No | No | Validates action code URL extraction, input validation, and Firebase error code mapping. |
| `scripts/test-auth-full-regression.mjs` | 17 assertions | **Unit / Contract** | No | No | Validates phone OTP format, password validation, and forward/reverse provider linking logic. |

### Critical Distinction:
- **`linkWithCredential()` in automated tests:** Executed within Node.js unit mocks asserting Firebase contract compliance.
- **Firebase Emulator Configuration:** `firebase.json` in the repository only configures the Firestore emulator (`port: 8088`), **not** the Firebase Auth emulator.
- **Real Firebase Execution:** In accordance with deployment restrictions (*"No production Firebase user modifications. No production Firestore modifications. Do not deploy to production"*), live cloud execution of `linkWithCredential()` has not been run against the production Firebase project (`spiral-restaurant-saas-v1`).
- **Conclusion:** Automated tests verify architectural correctness, API signatures, error handling, and state transitions. End-to-end cloud behavior must be verified on an **isolated staging Firebase project**.

---

## 3. Pending Google Credential Handling & Security Verification

A line-by-line inspection of `src/components/ui/AccountLinkingModal.tsx`, `LoginForm.tsx`, `RegisterForm.tsx`, `CustomerLogin.tsx`, and `MobileSplashLogin.tsx` confirms:

| Security Requirement | Status | Evidence & Code Path |
| :--- | :---: | :--- |
| **Pending credentials not stored in localStorage / sessionStorage** | **PASS** | `pendingCredential` is held strictly in React component memory (`linkingModalState`). No browser storage writes exist. |
| **Credentials not logged** | **PASS** | Console logs output static tracking strings and public UIDs only (`[AUTH] Successfully linked Google credential to existing UID: ${uid}`). Tokens and passwords are never logged. |
| **Credentials not exposed in URLs** | **PASS** | Neither passwords, tokens, nor credentials are serialized into query parameters, hash fragments, or history state. |
| **Credentials discarded on cancel or close** | **PASS** | `onClose` calls `setLinkingModalState({ isOpen: false, email: '', credential: null })`. The reference is immediately released to garbage collection. |
| **Failed password authentication blocks linking** | **PASS** | `verifyAndLinkGoogleAccount()` calls `signInWithEmailAndPassword()` *before* `linkWithCredential()`. If password verification fails, the function throws immediately; linking is never reached. |
| **Rapid repeated clicks blocked** | **PASS** | 1. Button has `disabled={isLoading}`.<br/>2. Form submission handler has `if (isLoading) return;` guard preventing duplicate invocations. |

---

## 4. Firebase Account Policy Confirmation

### 4.1 Required Setting
To enforce `ONE PERSON = ONE FIREBASE ACCOUNT`, the following setting must be active in the Firebase Console for project `spiral-restaurant-saas-v1`:

- **Location:** **Firebase Console** -> **Authentication** -> **Settings** -> **User account linking**
- **Required Selection:** **"Link accounts that use the same email"** (*Prevent creating multiple accounts for the same email address*)

### 4.2 Why This Must Not Be Changed:
If "Create multiple accounts for each provider using the same email" were enabled, Firebase would silently create separate Firebase UIDs for the same email address when signing in with different providers. This would fragment diner order history, split restaurant tenant ownership, and destroy role-based access control.

---

## 5. Final Regression Check Results

### 5.1 Test Suites Execution
All automated regression suites were executed in sequence:
- **`scripts/test-auth-full-regression.mjs`:** 17 / 17 Passed (100%)
- **`scripts/test-single-account-identity.mjs`:** 38 / 38 Passed (100%)
- **`scripts/test-google-auth-integration.mjs`:** 26 / 26 Passed (100%)
- **`scripts/test-password-reset-workflow.cjs`:** 49 / 49 Passed (100%)
- **Total Assertions Passed:** **130 / 130 (100%)**

### 5.2 TypeScript Compilation
- **Command:** `npx tsc --noEmit`
- **Result:** **0 errors**. Type checks passed completely.

### 5.3 Production Bundle Build
- **Command:** `npm run build`
- **Result:** **Success in 11.30 seconds**. 2,201 modules transformed into production assets in `dist/`.

---

## 6. Readiness Determination

### Assessment: **READY FOR ISOLATED STAGING TESTING**

The codebase meets all requirements for single-account identity handling:
1. Forward provider linking (Email/Password -> Google) is implemented and guarded by mandatory password verification.
2. Reverse provider linking (Google -> Email/Password) is implemented via `linkEmailPasswordCredential()`.
3. In both linking directions, the Firebase UID remains identical and zero duplicate Firestore documents are generated.
4. Pending credentials are secure, transient in memory, and never logged or persisted.
5. All 130 regression tests, TypeScript checks, and production builds pass cleanly.

**Next Step:** Deploy to an isolated staging environment with staging Firebase credentials to perform interactive browser end-to-end validation before production release.
