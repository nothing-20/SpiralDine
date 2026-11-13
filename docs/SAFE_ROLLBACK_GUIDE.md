# SpiralDine Safe Rollback and Disaster Recovery Guide
**Document Version:** 1.1.0 *(Updated in Wave 0 Governance)*  
**Primary Production Domain:** `https://dine.spiralworld.in` *(alias redirect preserved from `https://spiral-dine.vercel.app`)*  
**Firebase Project:** `spiral-restaurant-saas-v1`  
**Git Repository:** `https://github.com/nothing-20/RestaurantOS.git`

---

## 1. Overview and Rollback Philosophy

When deploying changes to SpiralDine, production stability, diner experience, and financial integrity take absolute priority. If a defect or unexpected behavior occurs in a newly deployed version, this guide provides the exact, multi-tier procedure to return the application to the previous known-good state.

A complete rollback must consider all seven architectural layers:
1. **Frontend Hosting & Edge Static Assets (Vercel CDN — `https://dine.spiralworld.in`)**
2. **Serverless API Endpoints (Vercel Node Functions under `api/`)**
3. **Firebase Cloud Functions (when enabled under `functions/`)**
4. **Source Control (Git Repositories & Branches)**
5. **Database Security Rules & Indexes (`firestore.rules`, `storage.rules`, `firestore.indexes.json`)**
6. **Database State & Records (Cloud Firestore Data — NOT reverted by code rollbacks)**
7. **Authentication & Payment Gateway State (Firebase Auth, Custom Claims, & Razorpay Transactions)**

---

## 2. Layer A: Frontend & Domain Rollback (Vercel)

SpiralDine's frontend SPA and Vercel `/api/*` endpoints deploy atomically on Vercel serving canonical production **`https://dine.spiralworld.in`** (with `https://spiral-dine.vercel.app` preserved as a redirect domain).

### Option 1: Instant Rollback via Vercel Dashboard (Recommended)
1. Open the [Vercel Dashboard](https://vercel.com) and navigate to the SpiralDine production project.
2. Open the **Deployments** tab and filter to **Production**.
3. Locate the verified previous known-good Production deployment (never deploy or alias an unverified Preview build onto `dine.spiralworld.in`).
4. Select **`...` -> Instant Rollback / Promote to Production**, verifying both `https://dine.spiralworld.in` and `/api/health` (or primary public route) immediately afterward.

### Option 2: Instant Rollback via Vercel CLI
Identify the previous known-good Production deployment URL via `npx vercel ls`, then execute:
```bash
# Instant rollback of both frontend SPA and api/ serverless routes together
npx vercel rollback <known-good-deployment-url> --yes
```
*(Do not overwrite production domain routing for `https://dine.spiralworld.in` or break the `spiral-dine.vercel.app` redirect configuration.)*

---

## 3. Layer B: Git Source Code Rollback

### Rule: Never Rewrite Shared Git History
On shared branches (`main`, `feature/*`), **never** execute `git push --force` or `git reset --hard` to rollback. Rewriting history can cause loss of uncommitted work or merge conflicts for other collaborators.

### Procedure for Clean Git Rollback
To undo an unintended commit on a shared branch, create a clean revert commit:
```bash
# 1. Ensure you are on the target branch (e.g. main)
git checkout main
git pull origin main

# 2. Identify the commit to revert (e.g. <bad-commit-sha>)
# 3. Create a clean revert commit
git revert <bad-commit-sha> --no-edit

# 4. Run build and security emulator checks to verify clean reversal
npm run build
powershell -ExecutionPolicy Bypass -File scripts/run-emulator-test.ps1 "node scripts/test-phase9-emulator.js"

# 5. Push the revert commit safely
git push origin main
```

### Reference Governance Checkpoints:
- Tag every production release commit (`vX.Y.Z-prod`) in Git alongside its verified Vercel deployment ID and `firestore.rules` hash before promotion.

---

## 4. Layer C: API & Serverless Function Rollback

SpiralDine's serverless endpoints (located in [`api/`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/)) execute as Vercel Serverless Functions.

### Critical Version Parity Note:
Because Vercel packages the frontend SPA and the `api/` serverless functions together as a single atomic deployment bundle:
- Reverting the Vercel deployment (Layer A) **automatically reverts both the frontend client and the serverless API functions simultaneously**.
- There is no version drift between the frontend client bundle and `/api/orders/create` when using Vercel instant deployment rollback.

If deploying independent Cloud Functions (`functions/src/index.ts`), ensure that API route signatures are backwards-compatible so older client versions can still communicate during deployment propagation.

---

## 5. Layer D: Firestore Security Rules Rollback

### Current Safety Status:
During Phase 14 and mobile testing preparation, **no Firestore rules were deployed to production**. Production Firebase continues to run the active ruleset.

### If Security Rules Must Be Reverted:
1. Identify the desired rules commit in git history:
   ```bash
   git log -n 5 --oneline firestore.rules
   ```
2. Inspect the historical rules to ensure you are **not restoring known vulnerabilities** (e.g., rules without non-negative checks or without bill isolation):
   ```bash
   git diff <target-commit>:firestore.rules firestore.rules
   ```
3. Checkout the target rules file:
   ```bash
   git checkout <target-commit> -- firestore.rules
   ```
4. Verify rules locally on the Firestore Emulator before deploying:
   ```bash
   powershell -ExecutionPolicy Bypass -File scripts/run-emulator-test.ps1 "node scripts/test-phase8-security-regression.js"
   ```
5. Deploy to Firebase explicitly:
   ```bash
   firebase deploy --only firestore:rules --project spiral-restaurant-saas-v1
   ```

---

## 6. Layer E: Database & Firestore Data Rollback

### Critical Distinction: Code Rollback != Data Rollback
Reverting a Git commit or a Vercel deployment **does NOT revert, restore, or modify documents in Cloud Firestore**. Any documents written to the production database (`restaurants/{tenantId}/orders`, `bills`, `tables`) remain in Firestore.

### Data Protection Policies:
1. **Google Cloud Firestore Backups:**
   - Verify whether automated point-in-time recovery (PITR) or scheduled Firestore export is active in Google Cloud Console (`gcloud firestore backups`).
   - If PITR is enabled, Firestore allows restoring data to any point within the retention window (e.g., 7 days).
2. **Safe Test Data Segregation:**
   - Never use real customer records or production restaurant tenants for mobile testing.
   - Always run mobile tests against a dedicated demo/test tenant (e.g., `tenant_demo_1` or a dedicated test restaurant) so that operational records of live restaurants are never modified.

---

## 7. Layer F: Authentication Rollback

1. **Anonymous Guests:**
   - Anonymous Firebase UIDs created during testing persist in Firebase Auth. They do not conflict with registered customers because they carry no email or phone collisions.
2. **Registered Accounts:**
   - Rolling back frontend code does not delete accounts registered during testing.
   - To clean up test accounts, use the Firebase Authentication Console.

---

## 8. Layer G: Payment Gateway Rollback

1. **Payment Transactions are Immutable:**
   - Reverting code does **not** trigger automatic refunds or reverse payment transactions on Razorpay.
2. **Sandbox Isolation:**
   - All staging and mobile QA testing must strictly use **test/sandbox gateway keys** (`rzp_test_*`). Live Razorpay keys (`rzp_live_*`) must never be active on preview deployments.
3. **Manual Refunds:**
   - If a test transaction is erroneously executed with live funds, it must be refunded manually via the Razorpay merchant dashboard and recorded in the audit ledger.

---

## 9. Layer H: Post-Rollback Validation Checklist

After executing any rollback procedure, execute the following verification steps on `https://dine.spiralworld.in`:

| Verification Area | Expected Behavior | Verification Method |
| :--- | :--- | :--- |
| **1. Customer Portal / Menu** | Public menu loads without authentication; categories and items render. | Visit `/r/:restaurantId/t/:tableNumber` in mobile browser. |
| **2. Contact / Lead Capture** | Support contact form validates and responds via GoDaddy SMTP (`support@spiralworld.in`). | Smoke test `/contact` validation rules cleanly. |
| **3. Cart & Order Placement** | Cart calculates correct totals via `/api/orders/create`; order submits cleanly. | Add item, open cart, submit order (staging/test tenant). |
| **4. Order Tracking** | Order appears in tracking view with status `NEW` / `PLACED`. | Check tracking view after submission. |
| **5. KDS (Kitchen Display)** | Kitchen dashboard receives the order ticket in real time. | Log in as kitchen staff; verify ticket queue. |
| **6. Waiter Dashboard** | Waiter matrix displays table as Occupied; live order listed. | Log in as waiter; verify table status. |
| **7. Active Dining Session** | Multi-round orders bind to primary order and session. | Place supplementary item; verify round increment. |
| **8. Billing & Settlement** | Consolidated bill matches total; Razorpay `/verify` + cashier settle payment cleanly. | Open bill modal; verify breakdown and single ledger entry. |
| **9. Security Isolation** | Cross-tenant orders, unauthenticated admin calls, or snooping on another table's bill are blocked. | Verify `401`/`403` response on tampered token or mismatched tenant. |
| **10. Console / Network** | Zero unhandled runtime errors or 500 API responses. | Inspect browser DevTools console & Vercel runtime logs. |

---

## 10. Emergency Contact & Escalation Protocol

In the event of an unresolved production issue:
1. **Immediate Action:** Execute Layer A Instant Rollback to the last verified Production deployment in Vercel (`https://dine.spiralworld.in`).
2. **Notification:** Alert the programme lead with deployment IDs, Vercel function runtime logs, GoDaddy/Resend error traces, and affected restaurant tenant IDs.
3. **Investigation:** Replicate in local Firestore Emulator (`scripts/run-emulator-test.ps1`) and **`spiraldine-staging`** — never test directly against live restaurant tenants.
