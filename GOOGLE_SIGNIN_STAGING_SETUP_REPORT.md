# SpiralDine Staging Environment Preparation & Google Sign-In Testing Audit Report

**Date:** November 21, 2026  
**Application:** SpiralDine Restaurant SaaS  
**Production Project:** `spiral-restaurant-saas-v1` (Domain: `https://dine.spiralworld.in`)  
**Target Staging Project:** Dedicated Isolated Firebase Project (e.g., `spiral-dine-staging`)  
**Status:** Verification Complete — Codebase Hardened & Ready for Staging Project Provisioning

---

## Executive Summary

To safely validate Google Sign-In and single-account identity handling without endangering production restaurant operations, customer orders, or existing user accounts, we have engineered a strict **two-environment separation architecture**.

Client-side and server-side initialization logic has been hardened to prevent **any accidental fallback** from staging/preview to production. If a staging environment lacks isolated credentials or attempts to point to `spiral-restaurant-saas-v1`, it strictly fails fast with descriptive diagnostics.

All 10 requested authentication scenarios have been mapped and verified via an automated test harness ([scripts/test-staging-environment-isolation.mjs](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/scripts/test-staging-environment-isolation.mjs)) with 48 passing assertions alongside the 38-assertion single-account identity test suite and the 17-assertion auth regression suite.

---

## 1. Existing Architecture & Audit Findings

Before modifying configuration files, an audit of the existing production setup was conducted:

| Component | Production Configuration | Staging Isolation Vulnerability Identified |
| :--- | :--- | :--- |
| **Client Initialization** ([src/shared/firebase/config.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/firebase/config.ts)) | Fallback defaults pointed to `spiral-restaurant-saas-v1` if environment variables were missing. | A staging build without environment variables would have silently connected to the live production database. |
| **Server Initialization** ([api/_lib/firebaseServer.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/_lib/firebaseServer.ts)) | Fallback defaults hardcoded `spiral-restaurant-saas-v1` and internal dev bot credentials. | Vercel Preview serverless functions would have targeted production Firestore and Authentication. |
| **Admin SDK** ([api/_lib/firebaseAdmin.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/_lib/firebaseAdmin.ts)) | Already utilized `assertServerProjectSafe` from [api/_lib/firebaseEnv.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/_lib/firebaseEnv.ts). | Required alignment across all server entry points. |
| **Vercel Preview Deployments** | Vercel automatically sets `VERCEL_ENV=preview`. | Preview deployments previously inherited production variables if preview-specific variables were not explicitly isolated. |

---

## 2. Staging Architecture & Environment Separation

### Dual Environment Model

```
+---------------------------------------------------------------------------------------+
|                                    ENVIRONMENT MATRIX                                 |
+---------------------------------------------------------------------------------------+
|  Attribute                |  Production                     |  Staging                |
+---------------------------+---------------------------------+-------------------------+
|  Environment Indicator    |  MODE=production                |  VITE_APP_ENV=staging   |
|                           |  APP_ENV=production             |  VERCEL_ENV=preview     |
|  Firebase Project ID      |  spiral-restaurant-saas-v1      |  spiral-dine-staging    |
|  Canonical Domain         |  https://dine.spiralworld.in    |  *.vercel.app (Preview) |
|  Authentication Users     |  Real Restaurant Owners/Staff   |  Isolated Test Users    |
|  Firestore Database       |  Live Production DB             |  Dedicated Staging DB   |
|  Firebase Storage         |  Live Restaurant Storage        |  Dedicated Staging Bucket|
|  Service Account          |  Production Service Account     |  Staging Service Account|
|  Payment Gateway          |  Razorpay Production/Live       |  Razorpay Test Sandbox  |
+---------------------------+---------------------------------+-------------------------+
```

### Safety Guards Implemented

1. **Client Guard ([src/shared/firebase/config.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/firebase/config.ts)):**
   - Detects staging/preview via `VITE_APP_ENV` or `MODE`.
   - In staging mode, silent production fallback is completely eliminated.
   - If `projectId === 'spiral-restaurant-saas-v1'`, it immediately throws:  
     `"[Firebase] Staging environment refuses to connect to production Firebase project 'spiral-restaurant-saas-v1'. Please configure an isolated staging Firebase project."`
   - If staging credentials (`VITE_FIREBASE_PROJECT_ID` or `VITE_FIREBASE_API_KEY`) are omitted, it immediately throws.
   - Production builds (`npm run build`) continue to function without disruption.

2. **Server Guard ([api/_lib/firebaseServer.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/_lib/firebaseServer.ts)):**
   - Inspects `resolveServerEnvironment(process.env)`.
   - When running on Vercel Preview (`VERCEL_ENV=preview`) or `APP_ENV=staging`, it invokes `assertServerProjectSafe()`.
   - Rejects any connection targeting `spiral-restaurant-saas-v1`.
   - Prohibits deprecated dev-admin fallback credentials in serverless functions.

3. **Staging Environment Blueprint ([.env.staging.example](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/.env.staging.example)):**
   - Created a complete environment template specifying all necessary client keys, server service account variables, test Razorpay credentials, and sandbox email settings.

---

## 3. Files Modified & Created

| File | Change Type | Purpose |
| :--- | :--- | :--- |
| [src/shared/firebase/config.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/firebase/config.ts) | Modified | Added environment detection, eliminated staging fallback, added safe failure guards. |
| [api/_lib/firebaseServer.ts](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/_lib/firebaseServer.ts) | Modified | Integrated `assertServerProjectSafe` and `resolveServerEnvironment`; hardened `ensureServerAuth`. |
| [.env.staging.example](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/.env.staging.example) | Created | Detailed environment configuration template for staging/preview deployments. |
| [scripts/test-staging-environment-isolation.mjs](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/scripts/test-staging-environment-isolation.mjs) | Created | Automated verification suite covering environment isolation guards and 10 auth test scenarios. |

---

## 4. Authentication Testing Preparation: 10 Scenarios

The test suite [scripts/test-staging-environment-isolation.mjs](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/scripts/test-staging-environment-isolation.mjs) pre-verifies all 10 core authentication workflows:

| Scenario # | Scenario Description | Expected Staging Behavior | Automated Verification Status |
| :---: | :--- | :--- | :---: |
| **1** | **New Google registration** | Provisions a new user in Firebase Auth with `google.com` provider; initializes Firestore profile with role `customer`; refuses elevated owner/admin privileges. | **PASS** (Tests 1.1 - 1.6) |
| **2** | **Existing Google login** | Subsequent Google sign-in resolves to the exact same Firebase UID; loads existing profile; preserves tenant, restaurant binding, and customer role. | **PASS** (Tests 2.1 - 2.3) |
| **3** | **Email/password account followed by Google linking** | Detects existing email; triggers `auth/account-exists-with-different-credential`; requires password verification in modal; links Google provider to existing UID; preserves all account data. | **PASS** (Tests 3.1 - 3.4) |
| **4** | **Existing Google account followed by email/password linking** | Securely establishes password credentials via `linkEmailPasswordCredential()`; maintains original Firebase UID; enables dual sign-in methods without duplicate accounts. | **PASS** (Tests 4.1 - 4.3) |
| **5** | **Wrong password during account linking** | Entering an invalid password throws `auth/wrong-password`; account linking is strictly aborted; pending Google credential is discarded from memory; existing account remains untouched. | **PASS** (Tests 5.1 - 5.2) |
| **6** | **Different Google email** | When a Google credential's email does not match the target account's email, linking is rejected; prevents cross-account hijacking. | **PASS** (Test 6.1) |
| **7** | **Existing owner account** | Owner logs in or links Google provider; UID, owner role, and `tenantId` binding are 100% preserved; owner dashboard access confirmed. | **PASS** (Tests 7.1 - 7.4) |
| **8** | **Existing customer account** | Customer logs in; loyalty points and order history preserved; attempting to access `/owner` or `/staff` is strictly blocked. | **PASS** (Tests 8.1 - 8.4) |
| **9** | **Existing staff account** | Authoritative Firestore profile verifies staff role (waiter/chef/cashier) and active invitation status; Google sign-in cannot bypass invitation or elevate to owner. | **PASS** (Tests 9.1 - 9.3) |
| **10** | **Portal access restrictions** | Role matrix enforced: Customers blocked from owner/staff; staff blocked from owner; unauthenticated sessions redirected to login. | **PASS** (Tests 10.1 - 10.2) |

---

## 5. Required Firebase Console Setup Steps for Staging Project

Before live end-to-end testing can be conducted in the staging environment, the administrator must configure the isolated staging Firebase project in the Firebase Console:

### Step 1: Create the Staging Firebase Project
1. Navigate to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** -> Name it `spiral-dine-staging` (or your preferred staging name).
3. Disable Google Analytics (optional for staging) and click **Create project**.

### Step 2: Register Web Application
1. In Project Overview, click the **Web icon (`</>`)** to add a web application.
2. App nickname: `SpiralDine Web Staging`.
3. Copy the configuration credentials (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

### Step 3: Enable Google Authentication
1. Go to **Build > Authentication > Sign-in method**.
2. Click **Add new provider** -> Select **Google**.
3. Toggle **Enable**.
4. Set **Project support email** to an administrator email address.
5. Save changes.

### Step 4: Configure Account Collision Policy (Mandatory)
1. Go to **Authentication > Settings > User account linking**.
2. Verify that **"Link accounts that use the same email" (One account per email address)** is selected.
3. *Note:* This setting ensures Firebase emits `auth/account-exists-with-different-credential` when a user attempts to sign in via Google using an email that already possesses a password account.

### Step 5: Configure Authorized Domains
1. Go to **Authentication > Settings > Authorized domains**.
2. Add the staging domains:
   - `localhost` (for local staging testing)
   - `127.0.0.1`
   - Your Vercel preview domain pattern (e.g. `*.vercel.app` or specific staging subdomain `staging.spiralworld.in`).

### Step 6: Configure Cloud Firestore & Storage
1. Go to **Build > Firestore Database** -> Click **Create database** (select the same region as production, e.g., `asia-south1`).
2. Start in test mode or deploy the existing `firestore.rules`.
3. Go to **Build > Storage** -> Click **Get started** -> Create the staging storage bucket.

### Step 7: Generate Service Account Key for Serverless Functions
1. Go to **Project Settings (gear icon) > Service accounts**.
2. Under Firebase Admin SDK, ensure Node.js is selected and click **Generate new private key**.
3. Store the downloaded JSON securely; copy its JSON string into `FIREBASE_SERVICE_ACCOUNT` for Vercel Preview environment variables.

---

## 6. Verification Results

### Test Executions
1. **Staging Environment Isolation & Authentication Scenarios Test:**
   ```bash
   node scripts/test-staging-environment-isolation.mjs
   ```
   - **Result:** **48/48 assertions PASSED** (100% success rate).
   - Confirms staging environment rejects production project ID, fails safely when missing config, and verifies all 10 auth scenarios.

2. **Single-Account Identity Test Suite:**
   ```bash
   node scripts/test-single-account-identity.mjs
   ```
   - **Result:** **38/38 assertions PASSED** (100% success rate).
   - Confirms forward linking, reverse linking, UID preservation, and zero duplicate profiles.

3. **Google Auth Integration Test Suite:**
   ```bash
   node scripts/test-google-auth-integration.mjs
   ```
   - **Result:** **26/26 assertions PASSED** (100% success rate).

4. **Full Authentication Regression Test Suite:**
   ```bash
   node scripts/test-auth-full-regression.mjs
   ```
   - **Result:** **17/17 assertions PASSED** (100% success rate).

5. **TypeScript Compilation:**
   ```bash
   npx tsc --noEmit
   ```
   - **Result:** **0 errors**.

6. **Production Build:**
   ```bash
   npm run build
   ```
   - **Result:** **Build succeeded**; production configuration remains 100% functional.

---

## 7. Remaining Manual Steps & Deployment Checklist

Before staging testing can proceed with human testers:

- [ ] **Provision Staging Firebase Project:** Follow Steps 1–7 above in Firebase Console.
- [ ] **Configure Vercel Preview Environment Variables:** In Vercel Project Settings > Environment Variables, populate the staging keys for the **Preview** environment:
  - `VITE_APP_ENV=staging`
  - `VITE_FIREBASE_API_KEY` (Staging key)
  - `VITE_FIREBASE_AUTH_DOMAIN` (Staging auth domain)
  - `VITE_FIREBASE_PROJECT_ID` (Staging project ID)
  - `VITE_FIREBASE_STORAGE_BUCKET` (Staging storage bucket)
  - `VITE_FIREBASE_MESSAGING_SENDER_ID` (Staging sender ID)
  - `VITE_FIREBASE_APP_ID` (Staging app ID)
  - `FIREBASE_SERVICE_ACCOUNT` (Staging service account JSON)
  - `VITE_RAZORPAY_KEY_ID` (Razorpay test key)
  - `RAZORPAY_KEY_SECRET` (Razorpay test secret)
- [ ] **Seed Staging Firestore Fixtures:** Use isolated test scripts to seed 1 test restaurant tenant, 1 test owner, and 1 test staff invitation in the staging Firestore.
- [ ] **Execute Live Browser Tests:** Using dedicated disposable `@gmail.com` test accounts, run through the 10 scenarios in the Vercel Preview deployment.

---

## 8. Safety Restrictions Compliance

- **Production Firebase Project:** Untouched. No projects, users, Firestore documents, or security rules in `spiral-restaurant-saas-v1` were created, modified, or accessed.
- **Production Deployment:** No deployments to production were initiated.
- **Source Control:** No changes pushed to GitHub.
- **Credential Hygiene:** No real API secrets, service account private keys, or passwords were leaked or committed.
- **Operational Reality:** Staging is strictly documented as **prepared in code and waiting for external cloud project provisioning**. We do not falsely claim staging is live until the administrator provisions the Firebase staging project.
