# SpiralDine — Free-Tier (Spark Plan) Firebase Setup & Environment Isolation Guide

This guide explains how to create and configure isolated **Development** and **Staging** Firebase projects on the **Firebase Spark (Free) Plan** without incurring cloud billing charges or risking the confirmed live production project (`spiral-restaurant-saas-v1`).

> **Strict Isolation Rule:** Never connect `development` or `staging` builds, emulators, or maintenance scripts (`reset-dev-db.js`, `migrate-customers.js`) to `spiral-restaurant-saas-v1`. Both Web (`src/shared/firebase/envConfig.ts`), Serverless APIs (`api/_lib/firebaseEnv.ts`), Scripts (`scripts/_lib/envGuard.cjs`), and Android (`android/build.gradle.kts`, `FirebaseConfig.kt`, `FirebaseAuthManager.kt`) enforce hard fail-fast checks rejecting cross-environment access to production.

---

## 1. Create Isolated Free-Tier Firebase Projects

Create two separate Firebase projects under your Google account (one for daily development/testing, one for pre-release staging verification):

1. Open [Firebase Console](https://console.firebase.google.com/) -> **Add project**.
2. Create your **Development** project (for example, choose a unique project ID owned by your team, on the **Spark Plan — No-cost**).
   - Google Analytics may be disabled for Dev to simplify setup.
3. Repeat for your **Staging** project (also **Spark Plan — No-cost**).
4. Record the actual Firebase Project IDs you created. Do **not** share or reuse `spiral-restaurant-saas-v1`.

### Register Aliases in Firebase CLI (Optional, Local Developer Only)

Instead of keeping guessed IDs in Git, add your real project aliases locally via Firebase CLI:

```powershell
firebase login
firebase use --add   # select your Dev project ID and alias it as `dev`
firebase use --add   # select your Staging project ID and alias it as `staging`
```

Notice `.firebaserc` intentionally omits a `"default"` alias and only pins `"prod": "spiral-restaurant-saas-v1"`, forcing explicit `--project` selection and reducing accidental production deploys.

---

## 2. Configure Firebase Authentication (Free on Spark)

Repeat these steps in both **Development** and **Staging** consoles (**Build -> Authentication -> Sign-in method**):

1. Enable **Email/Password** provider (used by owners, managers, kitchen staff, waiters, cashiers, Print Bridge, and optional test accounts).
2. Enable **Anonymous** sign-in provider (required for guest dine-in QR ordering sessions before optional account linking).
3. Under **Authentication -> Settings -> Authorized domains**, verify `localhost`, `127.0.0.1`, and (for Staging) your Vercel Preview domain are authorized.
4. If local scripts (`reset-dev-db.js`, `migrate-customers.js`, E2E test scripts) require an authenticated test user, create a dedicated non-production test account inside your **Dev/Staging** Auth panel and store its credentials only in `.env.development.local` / `.env.staging.local` as `FIREBASE_SERVER_EMAIL` and `FIREBASE_SERVER_PASSWORD`.
   - **Never** create or reuse `dev-admin-reset@restaurantos.internal`. Hardcoded credentials have been permanently removed.

---

## 3. Configure Cloud Firestore & Indexes

In both **Development** and **Staging** Firebase Consoles (**Build -> Firestore Database**):

1. Click **Create database**.
2. Choose **Native mode** (`Standard edition` free tier) and select the same low-latency region (e.g., `asia-south1`).
3. Start in **production mode** (locked down by default).
4. Deploy SpiralDine's Security Rules and Composite Indexes explicitly to Dev/Staging:

```powershell
firebase deploy --only firestore:rules,firestore:indexes --project <your-dev-or-staging-project-id>
```

---

## 4. Configure Firebase Storage (Free Tier Bucket)

In both **Development** and **Staging** consoles (**Build -> Storage**):

1. Initialize the default Cloud Storage bucket (`No-cost / Spark` rules-protected bucket).
   - **Note on Spark Plan availability:** As of late 2024+, Firebase Storage for *brand-new* projects in some billing configurations may prompt for Blaze; if Firebase Console allows Spark Storage setup without upgrading, deploy `storage.rules`:
   ```powershell
   firebase deploy --only storage --project <your-dev-or-staging-project-id>
   ```
   - If your Dev workflow only exercises Firestore/Auth and image uploads are tested via data-URLs/mocked Storage in Dev, **do not upgrade to Blaze** just for Dev Storage unless explicitly approved.

---

## 5. Web Environment Configuration (`.env.*.local`)

1. Register a **Web App (`</>`)** inside **Project Settings** of your **Dev** project (and another inside **Staging**).
2. Copy the Web config template:

```powershell
Copy-Item .env.development.example .env.development.local
Copy-Item .env.staging.example .env.staging.local
```

3. Fill `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID` with the values from each isolated project.
4. Keep `VITE_APP_ENV=development` (or `staging`) and use Razorpay **Test Mode** (`rzp_test_*`) only.
5. For Vercel **Preview** deployments (Staging), configure the Staging project's `VITE_FIREBASE_*` and `FIREBASE_*` variables under Vercel **Preview** scope ONLY — **never** map Vercel Preview to `spiral-restaurant-saas-v1`. Keep Vercel **Production** pointing exclusively to `spiral-restaurant-saas-v1` and `https://dine.spiralworld.in`.

---

## 6. Android Environment Configuration (`dev`, `staging`, `prod` Flavors)

All three Android modules (`:app` Print Bridge, `:customer` Spiral Dine, `:owner` SpiralDine Owner) use Gradle `flavorDimensions += "env"` with three product flavors:

| Flavor | Application ID Suffix | App Label Suffix | Config Source |
|---|---|---|---|
| `dev` | `.dev` | `(Dev)` | `android/config/firebase-dev.properties` or `src/dev/google-services.json` |
| `staging` | `.staging` | `(Staging)` | `android/config/firebase-staging.properties` or `src/staging/google-services.json` |
| `prod` | *(none)* | *(none)* | Confirmed `spiral-restaurant-saas-v1` production config |

### Setup Steps for Dev / Staging Android Builds

1. Register Android apps in your **Dev** (and/or **Staging**) Firebase project with matching flavor package names:
   - Print Bridge: `com.spiraldine.printbridge.dev` / `.staging`
   - Customer App: `com.spiralworld.spiraldine.dev` / `.staging`
   - Owner App: `com.spiraldine.owner.dev` / `.staging`
2. Configure **Option A (Single Shared Properties File — Easiest)** or **Option B (`google-services.json` per flavor)**:
   - **Option A**: Copy `android/config/firebase-dev.properties.example` to `android/config/firebase-dev.properties` (gitignored) and populate `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_GCM_SENDER_ID`, and per-module App IDs (`FIREBASE_APPLICATION_ID_APP`, `FIREBASE_APPLICATION_ID_CUSTOMER`, `FIREBASE_APPLICATION_ID_OWNER`).
   - **Option B**: Place downloaded `google-services.json` inside `android/<module>/src/dev/google-services.json` (or `src/staging/`). Both `.properties` and `google-services.json` are gitignored so non-prod credentials stay local.
3. Attempting `assembleDevDebug` or `assembleStagingDebug` **without** an isolated config intentionally fails the Gradle build (`verifyDevFirebaseConfig` / `verifyStagingFirebaseConfig`) and refuses to fall back to `spiral-restaurant-saas-v1`.

---

## 7. Local Firebase Emulator Setup (Zero Cloud Quotas / 100% Free)

SpiralDine configures a local Firestore emulator in `firebase.json` (`127.0.0.1:8088`, rules-enforced):

1. Ensure JDK 21 is installed (expected by `scripts/run-emulator-test.ps1` at `$HOME\.jdk-21\jdk-21.0.6+7`, or run `firebase emulators:start --project demo-spiraldine-emulator --only firestore` with Java 21 on `PATH`).
2. Run the automated Firestore Security Rules emulator verification suite:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-emulator-test.ps1 "node scripts/test-phase9-emulator.js"
```

3. For local browser testing against the emulator without a cloud Dev project, set in `.env.development.local`:

```env
VITE_APP_ENV=development
VITE_USE_FIREBASE_EMULATOR=true
VITE_FIREBASE_PROJECT_ID=demo-spiraldine-emulator
```

---

## 8. Wave 1 Verification Commands

Run these checks locally after configuring Dev or Staging:

```powershell
# 1. TypeScript static check
npx tsc --noEmit

# 2. Production Vite bundle check (requires production VITE_FIREBASE_* in .env or CI)
npm run build

# 3. ESLint check
npm run lint

# 4. Environment isolation & safeguard test suite
node scripts/test-wave1-environment-isolation.mjs

# 5. Android unit tests across dev, staging, and prod variants
Set-Location android; .\gradlew.bat testDebugUnitTest --no-daemon

# 6. Android production APK verification (succeeds)
.\gradlew.bat :app:assembleProdDebug :customer:assembleProdDebug :owner:assembleProdDebug --no-daemon

# 7. Android unconfigured dev APK verification (MUST fail cleanly without falling back to prod)
.\gradlew.bat :app:assembleDevDebug --no-daemon
```

---

## 9. Spark (Free Tier) Quotas vs. Blaze (Pay-As-You-Go) Boundaries & Cost Cautions

Always review the official [Firebase Pricing](https://firebase.google.com/pricing) page before changing billing plans, as Google periodically updates free-tier entitlements. Key architectural distinctions for SpiralDine:

### Works on Free Spark Plan (No Billing Card Required for Supported Services)
- **Firebase Authentication**: Email/Password and Anonymous accounts remain generous for normal daily Dev/Staging QA (Phone/SMS MFA incurs tight free caps / requires Blaze beyond low test volumes).
- **Cloud Firestore (Standard Edition Free Quotas)**: Suitable for low-to-moderate manual & automated Dev/Staging testing (typical daily Spark free limits are on the order of tens of thousands of reads/writes/deletes and ~1 GiB stored; runaway `onSnapshot` listeners or infinite loops can exhaust daily quotas quickly, which simply returns quota-exceeded errors instead of charging a card on Spark!).
- **Local Firebase Emulator Suite**: Completely free, unlimited local reads/writes/rules runs.

### Requires Blaze (Pay-As-You-Go) & Cost Cautions
- **Cloud Functions (Gen 2 / Cloud Run / Artifact Registry)**: Deploying `functions/` requires the Blaze plan (Cloud Build container storage + runtime invocations). **Never** deploy `functions/` without setting Google Cloud Billing Budgets & Alerts.
- **Managed Scheduled Firestore Backups / Exports (`gcloud firestore export` to GCS)**: Requires Cloud Billing + GCS storage bucket costs.
- **High-Traffic Production Scaling**: Once multiple live restaurants generate high concurrent KDS/order/listener traffic, Production (`spiral-restaurant-saas-v1`) should monitor Firestore read/write amplification closely (Wave 3/4 listener & index optimizations) and keep billing alerts configured before any Blaze upgrade.
- **Cost Caution on Staging**: Keep Staging on **Spark** unless testing Cloud Functions specifically, and set daily alert thresholds or shut down test loops after QA runs so background tabs cannot burn quotas or dollars.

