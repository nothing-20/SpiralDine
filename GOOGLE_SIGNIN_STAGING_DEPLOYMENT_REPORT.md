# SpiralDine Vercel Preview Staging Deployment & Readiness Audit Report

**Date:** November 21, 2026  
**Application:** SpiralDine Restaurant SaaS  
**Production Project:** `spiral-restaurant-saas-v1` (Domain: `https://dine.spiralworld.in`)  
**Current Git Branch:** `chore/password-reset-custom-domain`  
**Latest Commit SHA:** `3a0c743 fix(auth): update Content-Security-Policy to allow Google reCAPTCHA and harden RecaptchaManager`  
**Status:** **DEPLOYMENT HALTED AT SAFETY CHECKPOINT** — Environment Isolation Guards Active

---

## Executive Summary

Authorization was granted to prepare and deploy the Google Sign-In and single-account identity implementation to Vercel Preview for isolated staging validation. 

In strict compliance with the deployment instructions:
> *"The staging Firebase project must NOT be spiral-restaurant-saas-v1.*  
> *If the staging Firebase project has not yet been created or configured, STOP and report the exact manual steps required.*  
> *If required Preview variables are missing, STOP and report the missing variable NAMES only.*  
> *If the current branch is not the intended implementation branch, report this before proceeding.*  
> *Do not proceed if staging isolation cannot be guaranteed."*

We conducted the pre-deployment verification, ran all 6 mandatory automated test suites, inspected Git status, and inspected Vercel Preview environment variables via the Vercel CLI.

**Result:** All automated test suites and builds passed 100% (129/129 assertions, 0 TypeScript errors, successful production build). However, **deployment to Vercel Preview has been intentionally halted** due to three critical prerequisite blocks:
1. **No isolated staging Firebase project has been provisioned** in Google Cloud / Firebase Console.
2. **Required Preview environment variables are missing or misconfigured** in Vercel (production credentials currently shared with Preview).
3. **Current Git branch** is `chore/password-reset-custom-domain` rather than a dedicated Google Sign-In implementation branch.

---

## 1. Pre-Deployment Verification

### 1.1 Git Branch & Commit Status
- **Current Branch:** `chore/password-reset-custom-domain`
- **Latest Commit:** `3a0c743` (`fix(auth): update Content-Security-Policy to allow Google reCAPTCHA and harden RecaptchaManager`)
- **Branch Notice:** This is a legacy branch for password reset customization. A dedicated implementation branch (e.g., `feature/google-signin-and-identity`) should be established for this work before pushing to GitHub.

### 1.2 Working Tree Status & Included Implementation Files
All implementation and hardening files are present in the working tree:
- **Google Sign-In Components:**
  - `src/components/ui/GoogleSignInButton.tsx` (Official Google branding, loading spinner, error handling)
- **Single-Account Identity & Account Linking:**
  - `src/components/ui/AccountLinkingModal.tsx` (In-memory credential handling, password proof-of-ownership)
  - `src/shared/firebase/auth.ts` (Forward `linkWithCredential` and reverse `linkEmailPasswordCredential`)
  - `src/services/authService.ts` & `src/shared/services/authService.ts` (Centralized auth methods)
- **Portal Integration:**
  - `src/features/auth/components/LoginForm.tsx` (Owner login + account linking)
  - `src/features/auth/components/RegisterForm.tsx` (Owner registration + account linking)
  - `src/apps/customer/pages/CustomerLogin.tsx` (Customer login + account linking)
  - `src/apps/customer/pages/CustomerRegister.tsx` (Customer registration + account linking)
  - `src/apps/owner/mobile/pages/MobileSplashLogin.tsx` (Mobile owner login + account linking)
- **Staging Environment Isolation:**
  - `src/shared/firebase/config.ts` (Anti-fallback guard: rejects production ID in staging; fails safely if keys missing)
  - `api/_lib/firebaseServer.ts` (Integrated with `assertServerProjectSafe` and `resolveServerEnvironment`)
  - `.env.staging.example` (Template specification for isolated staging credentials)

### 1.3 Test Suite Execution Results

All 6 required test suites and builds were executed sequentially and passed completely:

| Test Command | Scope | Assertions / Status | Result |
| :--- | :--- | :---: | :---: |
| `node scripts/test-staging-environment-isolation.mjs` | Environment isolation guards & 10 auth scenarios | 48 / 48 | **PASS** |
| `node scripts/test-single-account-identity.mjs` | Single-account identity & reverse linking | 38 / 38 | **PASS** |
| `node scripts/test-google-auth-integration.mjs` | Google Sign-In integration & tenant preservation | 26 / 26 | **PASS** |
| `node scripts/test-auth-full-regression.mjs` | Email, password, phone, reset regression suite | 17 / 17 | **PASS** |
| `npx tsc --noEmit` | Strict TypeScript compilation | 0 errors | **PASS** |
| `npm run build` | Full production bundle compilation | Built in 12.44s | **PASS** |
| **Total Automated Assertions** | | **129 / 129** | **100% PASS** |

---

## 2. Staging Firebase Configuration Inspection

### Checkpoint Status: **BLOCKED — Action Required**
The staging Firebase project must be completely independent from `spiral-restaurant-saas-v1`.
Inspection confirms that **no secondary Firebase project has been created yet**.

### Exact Manual Steps Required to Provision Staging Firebase:
1. **Create Staging Firebase Project:**
   - Go to [Firebase Console](https://console.firebase.google.com/).
   - Click **Add project** -> Name it `spiral-dine-staging` (or your preferred staging identifier).
   - Disable Google Analytics (optional for staging) and click **Create project**.
2. **Register Staging Web App:**
   - In Project Overview, click the **Web icon (`</>`)**.
   - App nickname: `SpiralDine Staging`.
   - Note the generated client SDK keys (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
3. **Enable Google Sign-In Provider:**
   - Go to **Build > Authentication > Sign-in method**.
   - Click **Google** -> Toggle **Enable**.
   - Set **Project support email** to an admin email address and click **Save**.
4. **Configure One-Account-Per-Email Policy (Mandatory):**
   - Go to **Authentication > Settings > User account linking**.
   - Ensure **"Link accounts that use the same email" (One account per email address)** is selected.
5. **Configure Authorized Domains:**
   - Go to **Authentication > Settings > Authorized domains**.
   - Add:
     - `localhost`
     - `127.0.0.1`
     - `*.vercel.app` (to allow Vercel Preview deployments)
6. **Create Firestore Database & Storage Bucket:**
   - Go to **Build > Firestore Database** -> Click **Create database** (select region matching production, e.g., `asia-south1`).
   - Go to **Build > Storage** -> Click **Get started** -> Initialize the default storage bucket.
7. **Generate Firebase Admin Service Account Key:**
   - Go to **Project Settings > Service accounts**.
   - Click **Generate new private key**.
   - Keep the downloaded JSON key secure.

---

## 3. Vercel Preview Configuration Inspection

### Checkpoint Status: **BLOCKED — Action Required**
We inspected the environment variables configured in Vercel for project `no-one-0/spiraldine` via `vercel env ls`.

### Missing Variable Names in Vercel Preview:
In accordance with instructions (*"report the missing variable NAMES only"*), the following required staging environment variables are **MISSING** from the Vercel **Preview** environment:
- `VITE_APP_ENV`
- `APP_ENV`
- `FIREBASE_SERVICE_ACCOUNT` *(currently configured for Production ONLY; completely missing in Preview)*
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVER_EMAIL`
- `FIREBASE_SERVER_PASSWORD`

### Critical Misconfiguration in Vercel Preview:
The following client-side Firebase variables are currently configured with scope `Production, Preview` (created 123 days ago) pointing to the **live production project** (`spiral-restaurant-saas-v1`):
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

> [!CAUTION]
> **Why Deployment Was Blocked:**
> Deploying to Vercel Preview with the current Vercel settings would either:
> 1. Trigger our newly installed client-side anti-fallback guard, crashing the app at startup (`"[Firebase] Staging environment refuses to connect to production Firebase project 'spiral-restaurant-saas-v1'"`).
> 2. Fail serverless API calls due to missing `FIREBASE_SERVICE_ACCOUNT` in Preview.
> 
> Deploying without isolated staging variables violates staging isolation.

---

## 4. GitHub and Branch Safety

- **Current Branch:** `chore/password-reset-custom-domain`
- **Recommended Action:** Before staging deployment, create and switch to a dedicated branch:
  ```bash
  git checkout -b feature/google-signin-and-identity
  ```
- No changes have been pushed to GitHub.
- Production `main` branch remains untouched and preserved.

---

## 5. Deployment & Test Status Matrix

| Component | Status | Details |
| :--- | :---: | :--- |
| **Pre-Deployment Tests** | **PASSED** | 129/129 automated assertions passed; build clean. |
| **Staging Firebase Project** | **NOT PROVISIONED** | Staging Firebase project does not exist yet. |
| **Vercel Preview Environment** | **INCOMPLETE** | Missing 6 variables; 6 variables pointing to production. |
| **Git Implementation Branch** | **PENDING** | On `chore/password-reset-custom-domain`; needs dedicated branch. |
| **Vercel Preview Deployment** | **HALTED** | Blocked until staging project and Vercel variables are configured. |
| **Live Staging Smoke Tests** | **PENDING** | Cannot test live against staging until deployment is unblocked. |

---

## 6. Exact Action Items to Unblock Deployment

1. **Administrator:** Follow the steps in Section 2 to create the isolated `spiral-dine-staging` Firebase project.
2. **Administrator:** In Vercel Project Settings > Environment Variables, add the following variables specifically for the **Preview** environment:
   - `VITE_APP_ENV=staging`
   - `APP_ENV=staging`
   - `VITE_FIREBASE_API_KEY` (Staging API key)
   - `VITE_FIREBASE_AUTH_DOMAIN` (Staging auth domain, e.g. `spiral-dine-staging.firebaseapp.com`)
   - `VITE_FIREBASE_PROJECT_ID` (Staging project ID, e.g. `spiral-dine-staging`)
   - `VITE_FIREBASE_STORAGE_BUCKET` (Staging bucket, e.g. `spiral-dine-staging.firebasestorage.app`)
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` (Staging sender ID)
   - `VITE_FIREBASE_APP_ID` (Staging app ID)
   - `FIREBASE_SERVICE_ACCOUNT` (Staging private key JSON string)
   - `FIREBASE_PROJECT_ID` (Staging project ID)
   - `FIREBASE_SERVER_EMAIL` (Staging bot email)
   - `FIREBASE_SERVER_PASSWORD` (Staging bot password)
3. **Agent:** Once variables are configured and the dedicated branch is confirmed, trigger `vercel deploy --preview` and perform live smoke testing on the provisioned Preview URL.
