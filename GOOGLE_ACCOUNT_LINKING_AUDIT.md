# Single-Account Identity & Google Provider Linking Audit

**Target Platform:** SpiralDine Restaurant SaaS (`spiral-restaurant-saas-v1`)  
**Production Domain:** `https://dine.spiralworld.in`  
**Date of Audit:** November 21, 2026  
**Core Policy:** `ONE PERSON = ONE FIREBASE ACCOUNT`

---

## Executive Summary

SpiralDine enforces strict single-account identity governance across all portals (Desktop/Tablet Owner & Staff Login, Owner Registration, Mobile Splash Login, Customer Login, and Customer Registration).

When an individual who previously registered using an email and password subsequent attempts to sign in or register with Google using that same email address, SpiralDine intercepts the account collision (`auth/account-exists-with-different-credential`), validates proof of ownership via password authentication, and links the Google credential to the user's **existing Firebase UID**.

At no point does the system create a second Firebase user, a duplicate Firestore user document, or an orphan restaurant/customer record.

### Key Audit Metrics
- **Identity Integrity:** 100% — Authenticated Firebase UID is strictly preserved across provider linking (`preLinkUid === postLinkUid`).
- **Security Standard:** No account linking is performed based on email equality alone. Password authentication is mandatory.
- **Portals Covered:** 5 / 5 authentication entry points unified with the `AccountLinkingModal` component.
- **Automated Tests:** 30 / 30 test assertions passed (100%) in `scripts/test-single-account-identity.mjs`.
- **Integration Tests:** 26 / 26 test assertions passed (100%) in `scripts/test-google-auth-integration.mjs`.
- **TypeScript & Build:** 0 compilation errors; production build succeeded in 12.96 seconds.

---

## 1. Architecture: The Account-Linking & Identity Flow

```
User clicks "Sign in with Google" (abc@gmail.com)
                       │
                       ▼
Firebase Auth checks account-per-email policy
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
Account already exists?         No existing account
(e.g., password account)              │
        │                             ▼
        ▼                      Create standard user
Throws `auth/account-exists-   with role onboarding
with-different-credential`
        │
        ▼
SpiralDine intercepts error & extracts:
- Colliding email: `err.customData.email`
- Pending credential: `GoogleAuthProvider.credentialFromError(err)`
        │
        ▼
Presents <AccountLinkingModal />:
"An account already exists for abc@gmail.com.
 Please confirm your password to link your Google account."
        │
        ▼
User submits password
        │
        ├─────────────────────────────┐
        ▼                             ▼
Password INCORRECT             Password CORRECT
        │                             │
        ▼                             ▼
Abort linking immediately      1. Authenticate existing user:
Show "Incorrect password"         `signInWithEmailAndPassword()`
Do NOT link or merge           2. Link pending credential:
                                  `linkWithCredential(existingUser, pendingCred)`
                               3. Refresh user token claims:
                                  `getIdToken(true)`
                               4. Resolve existing profile:
                                  `resolveAuthenticatedUser(existingUser)`
                                       │
                                       ▼
                       Same Firebase UID preserved!
                       Same Firestore profile preserved!
                       Same tenantId & role preserved!
```

---

## 2. Implementation Details

### 2.1 Core Authentication Services (`src/shared/firebase/auth.ts`)
Four specialized identity primitives were added to ensure secure provider linking:
1. `getGoogleCredentialFromError(error: any): AuthCredential | null`  
   Extracts the pending `AuthCredential` from `auth/account-exists-with-different-credential` errors via `GoogleAuthProvider.credentialFromError(error)`.
2. `getExistingSignInMethods(email: string): Promise<string[]>`  
   Queries `fetchSignInMethodsForEmail(auth, email)` to determine what sign-in methods exist for an account.
3. `linkGoogleCredential(user: User, credential: AuthCredential): Promise<UserCredential>`  
   Calls `linkWithCredential(user, credential)` to bind Google as an authorized provider directly to an active `User` session.
4. `verifyAndLinkGoogleAccount(email: string, password: string, credential: AuthCredential): Promise<UserCredential>`  
   Enforces proof of ownership:
   - Validates non-empty email and password.
   - Signs into the existing account using `signInWithEmailAndPassword(auth, email, password)`.
   - Links the pending Google credential to that exact user record (`linkWithCredential`).
   - Forces an ID token refresh to ensure `providerData` includes Google.
   - Rejects with `auth/wrong-password` if ownership is unproven.

### 2.2 Reusable UI Component (`src/components/ui/AccountLinkingModal.tsx`)
A unified modal dialogue adhering to SpiralDine branding guidelines:
- Shows the target email in a secured badge.
- Requests the user's existing account password with show/hide password toggling.
- Shows real-time error feedback (wrong password, account lockout, rate limiting).
- Directly executes `verifyAndLinkGoogleAccount` upon form submission.
- Calls `onSuccess(linkedUser)` upon successful linking, triggering portal routing.

### 2.3 Portal Integrations

#### A. Staff & Owner Login (`src/features/auth/components/LoginForm.tsx`)
- Detects `auth/account-exists-with-different-credential` in both popup (`signInWithGoogle`) and redirect (`getGoogleRedirectResult`).
- Opens `AccountLinkingModal`.
- On successful linking, runs `handleAuthenticatedUser(linkedUser, 'google')`.
- Preserves existing `users/{uid}` role, `tenantId`, and branch assignments.
- If the linked account is a diner account (`role === 'customer'`), immediately prevents access to the business portal and directs them to the Customer Portal.

#### B. Owner Registration (`src/features/auth/components/RegisterForm.tsx`)
- Detects account collisions on registration.
- Upon linking verification, checks if the user already has an existing restaurant owner profile (`resolveAuthenticatedUser(linkedUser)`):
  - If existing owner profile found: Welcomes them back and navigates directly to `/owner/dashboard`, preventing duplicate restaurant creation.
  - If brand-new restaurant owner: Associates their newly created restaurant with their existing authenticated UID.

#### C. Diner Login (`src/apps/customer/pages/CustomerLogin.tsx`)
- Intercepts `auth/account-exists-with-different-credential`.
- Opens `AccountLinkingModal`.
- Upon successful linking, checks `users/{uid}`:
  - If user is owner or staff, notifies them to use the Business Portal.
  - If customer, verifies `customers/{uid}`, preserves existing wallet balance, loyalty points, and order history, and routes to `/customer/home`.

#### D. Diner Registration (`src/apps/customer/pages/CustomerRegister.tsx`)
- Handles collision when a user previously registered via email/password attempts customer registration with Google.
- Links Google credential to existing customer profile, avoiding duplicate profile creation.

#### E. Mobile Owner Login (`src/apps/owner/mobile/pages/MobileSplashLogin.tsx`)
- Fully supports popup and redirect collision handling for mobile browsers.
- Links account via modal and routes to `/owner/dashboard`.

---

## 3. Firestore & Database Integrity

| Rule / Invariant | Implementation Mechanism | Verification Result |
| :--- | :--- | :---: |
| **UID Preservation** | `linkWithCredential` binds credentials to existing Firebase UID. | **PASS** (`uid` unchanged) |
| **No Duplicate User Documents** | Firestore profiles are indexed by UID (`users/{uid}` and `customers/{uid}`). | **PASS** (Zero duplicate docs) |
| **Role Immutability During Linking** | Linking does not write or overwrite `role` in Firestore. | **PASS** (Role unchanged) |
| **Tenant Binding Preservation** | `tenantId` is immutable during provider linking. | **PASS** (Tenant ID preserved) |
| **Customer Data Preservation** | Existing `walletBalance`, `loyaltyPoints`, and orders remain bound to `customers/{uid}`. | **PASS** (Preserved 100%) |
| **Duplicate Tenant Prevention** | `signUpOwnerWithGoogle` checks existing `tenants` matching `ownerUid == googleUser.uid`. | **PASS** (No orphan tenants) |

---

## 4. Security & Access Control Analysis

### 4.1 Rejection of Unproven Email Merging
SpiralDine **never** links or merges accounts based on email equality alone. If an attacker creates a Google account with an unverified email matching a victim's email, the attacker cannot sign into the victim's account without knowing the victim's SpiralDine password. If the password check fails, `linkWithCredential` is never invoked.

### 4.2 Cross-Portal Role Isolation
A user with an existing diner account who links their Google account through the customer login cannot access owner or manager dashboards. The route guards (`OwnerGuard.tsx`, `RoleGuard.tsx`, and `WorkspaceGuard.tsx`) continue evaluating authoritative roles from Firestore and custom claims.

### 4.3 Zero Client-Side Role Trust
All backend APIs (`api/orders/create.ts`, `api/send-staff-invitation.ts`) independently verify ID tokens using Google Identity Toolkit and extract authoritative UIDs server-side.

---

## 5. Verification & Test Results

### 5.1 Single-Account Identity Test Suite (`scripts/test-single-account-identity.mjs`)
Executed command: `node scripts/test-single-account-identity.mjs`

```
====================================================
SPIRALDINE SINGLE-ACCOUNT IDENTITY AUDIT TEST SUITE
Core Requirement: ONE PERSON = ONE FIREBASE ACCOUNT
====================================================

--- Test 1: Email/Password Registration Followed by Google Sign-In ---
  [PASS] User successfully registered with email/password
  [PASS] Firebase detects collision with auth/account-exists-with-different-credential
  [PASS] Error retains colliding email address for verification
  [PASS] Error provides pending Google credential for account linking
  [PASS] Post-linking Firebase UID strictly matches original UID (NO duplicate user created)
  [PASS] Total Firebase users count remains exactly 1 (ONE PERSON = ONE FIREBASE ACCOUNT)
  [PASS] Google provider is successfully linked to existing Firebase user
  [PASS] Subsequent Google Sign-In signs directly into existing UID without prompting

--- Test 2: Google Registration Followed by Another Google Sign-In ---
  [PASS] Returning Google user resolves to the exact same Firebase UID
  [PASS] No duplicate Firebase user is spawned on repeated Google sign-ins
  [PASS] Existing tenantId and restaurant binding remain intact
  [PASS] Existing user role remains intact

--- Test 3: Existing Owner Account Provider Linking ---
  [PASS] Owner retains identical Firebase UID after linking
  [PASS] Owner role is not overwritten or downgraded during linking
  [PASS] Owner tenant binding is 100% preserved
  [PASS] Branch assignments remain intact
  [PASS] Tenant document retains ownership association without duplication

--- Test 4: Existing Customer Account Provider Linking ---
  [PASS] Customer UID is preserved across linking
  [PASS] Customer wallet balance ($25.00) is strictly preserved
  [PASS] Customer loyalty points (340 pts) are strictly preserved
  [PASS] Zero duplicate customer profile documents created

--- Test 5: Different Email Isolation ---
  [PASS] Attacker receives user associated solely with attacker@gmail.com
  [PASS] Different Google email cannot collide with or claim victim account
  [PASS] Different emails create distinct, non-overlapping accounts

--- Test 6: Failed Password Verification Prevents Linking ---
  [PASS] Rejected with auth/wrong-password
  [PASS] Account linking rejected upon failed password authentication
  [PASS] Google credential was NOT linked to user account after failed verification

--- Test 7: Duplicate Document Prevention Verification ---
  [PASS] Firestore users collection contains exactly 1 document for this person
  [PASS] Firestore tenants collection contains exactly 1 tenant document
  [PASS] Resolved tenantId matches the single authoritative tenant

====================================================
RESULTS: 30/30 tests passed (100%)
====================================================
```

### 5.2 Google Auth Integration Test Suite (`scripts/test-google-auth-integration.mjs`)
Executed command: `node scripts/test-google-auth-integration.mjs`

```
====================================================
SPIRALDINE GOOGLE AUTHENTICATION INTEGRATION SUITE
====================================================
RESULTS: 26/26 tests passed (100%)
====================================================
```

### 5.3 TypeScript Compilation Check
- Command: `npx tsc --noEmit`
- Result: **0 errors**. Type checks passed completely.

### 5.4 Production Build Verification
- Command: `npm run build`
- Result: **Success in 12.96 seconds** (2,201 modules transformed into production chunks).

---

## 6. Firebase Console Configuration Requirements

The following cloud-level configuration must be verified in the Firebase Console (`spiral-restaurant-saas-v1`):

1. **One Account Per Email Setting:**
   - Navigate to: **Firebase Console** -> **Authentication** -> **Settings** -> **User account linking**.
   - Confirm that **"Link accounts that use the same email"** (Prevent creating multiple accounts for the same email address) is **ENABLED**.
   - *Important:* Do NOT select "Create multiple accounts for each provider using the same email", as this would break the single-account identity model.
2. **Authorized Domains:**
   - Under **Authentication** -> **Settings** -> **Authorized domains**, confirm that `dine.spiralworld.in` is listed.

---

## 7. Compliance with Project Restrictions

- [x] **No deployment to production:** Code built locally, not deployed.
- [x] **No git push:** Git working directory remains un-pushed.
- [x] **No modification of production Firestore data or rules:** `firestore.rules` remained completely untouched.
- [x] **No automatic merging of accounts without proof of ownership:** Password proof required.
- [x] **No modification of unrelated modules:** Edits strictly isolated to auth flow components and services.
