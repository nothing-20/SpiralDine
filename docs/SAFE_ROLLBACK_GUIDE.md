# SpiralDine Safe Rollback and Disaster Recovery Guide
**Document Version:** 1.0.0  
**Target Production Domain:** `https://spiral-dine.vercel.app`  
**Firebase Project:** `spiral-restaurant-saas-v1`  
**Git Repository:** `https://github.com/nothing-20/RestaurantOS.git`

---

## 1. Overview and Rollback Philosophy

When deploying changes to SpiralDine, production stability, diner experience, and financial integrity take absolute priority. If a defect or unexpected behavior occurs in a newly deployed version, this guide provides the exact, multi-tier procedure to return the application to the previous known-good state.

A complete rollback must consider all six independent architectural layers:
1. **Frontend Hosting (Vercel CDN)**
2. **Serverless API Endpoints (Vercel Functions)**
3. **Source Control (Git Repositories & Branches)**
4. **Database Security Rules (Cloud Firestore Rules)**
5. **Database State & Records (Cloud Firestore Data)**
6. **User Authentication & Payment State (Firebase Auth & Gateway Transactions)**

---

## 2. Layer A: Frontend Rollback (Vercel)

SpiralDine's frontend is hosted on Vercel under the canonical alias `https://spiral-dine.vercel.app`.

### Active vs Rollback Production Deployment Records:
- **Active Live Production Deployment:** `dpl_9UDvMZJPyfcMZTrxHNGN9oDGtyMk` (`https://spiraldine-1xogf4j2u-no-one-0.vercel.app`)
  - **Release Commit:** `4174506` (`build(vercel): add .vercelignore to comply with Hobby plan function limit`)
  - **Status:** `● Ready`
- **Known-Good Rollback Target Deployment:** `dpl_Gm6JNQXC3PoAttGnJk4j978bPRFR` (`https://spiraldine-apz9syk5k-no-one-0.vercel.app`)
  - **Base Commit:** `f76c49e` / `1f31e76`
  - **Status:** `● Ready`

### Option 1: Instant Rollback via Vercel Dashboard (Recommended)
1. Open the [Vercel Dashboard](https://vercel.com) and navigate to project **`spiraldine`** (Team: `no-one-0`).
2. Go to the **Deployments** tab.
3. Locate the previous production deployment:
   - **Target Deployment ID:** `dpl_Gm6JNQXC3PoAttGnJk4j978bPRFR`
   - **Target Deployment URL:** `https://spiraldine-apz9syk5k-no-one-0.vercel.app`
4. Click the three dots (`...`) next to that deployment and select **"Assign Domain"** or **"Promote to Production"**.
5. Vercel instantly remaps the traffic for `https://spiral-dine.vercel.app` to the previous build in zero seconds with zero downtime.

### Option 2: Instant Rollback via Vercel CLI
Run the following command from the project root:
```bash
# Instant rollback to the previous production deployment
npx vercel rollback https://spiraldine-apz9syk5k-no-one-0.vercel.app --yes
```
Or alias reassignment:
```bash
npx vercel alias set https://spiraldine-apz9syk5k-no-one-0.vercel.app spiral-dine.vercel.app
```

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

# 4. Run build and tests to verify clean reversal
npm run build
node scripts/test-phase14-boundary-audit.js

# 5. Push the revert commit safely
git push origin main
```

### Known Checkpoint Reference Points:
- **Baseline Production Commit:** `1f31e76` (Merge PR #6)
- **Pre-Mobile Testing Commit:** `969b773` (`fix(auth): statically import roleResolver...`)
- **Testing Feature Branch:** `feature/mobile-customer-experience`

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
   - Reverting code does **not** trigger automatic refunds or reverse payment transactions on payment gateways (Razorpay, Stripe, etc.).
2. **Sandbox Isolation:**
   - All mobile testing must strictly use **test/sandbox gateway keys** (`rzp_test_*`). Live production keys must never be active on preview deployments.
3. **Manual Refunds:**
   - If a test transaction is erroneously executed with real funds, it must be refunded manually via the payment gateway merchant dashboard.

---

## 9. Layer H: Post-Rollback Validation Checklist

After executing any rollback procedure, execute the following verification steps on `https://spiral-dine.vercel.app`:

| Verification Area | Expected Behavior | Verification Method |
| :--- | :--- | :--- |
| **1. Customer Portal / Menu** | Public menu loads without authentication; categories and items render. | Visit `/r/:restaurantId/t/:tableNumber` in mobile browser. |
| **2. Cart & Order Placement** | Cart calculates correct totals; order submits cleanly. | Add item, open cart, submit order. |
| **3. Order Tracking** | Order appears in tracking page with status `NEW` / `PLACED`. | Check tracking view after submission. |
| **4. KDS (Kitchen Display)** | Kitchen dashboard receives the order ticket in real time. | Log in as kitchen staff; verify ticket queue. |
| **5. Waiter Dashboard** | Waiter matrix displays table as Occupied; live order listed. | Log in as waiter; verify table status. |
| **6. Active Dining Session** | Multi-round orders bind to primary order and session. | Place supplementary item; verify round increment. |
| **7. Billing & Settlement** | Consolidated bill matches total; cashier can settle payment. | Open bill modal; verify breakdown and status. |
| **8. Security Isolation** | Cross-tenant orders or snooping on another table's bill is blocked. | Verify 403 response on mismatched table or tenant. |
| **9. Console / Network** | Zero unhandled runtime errors or 500 API responses. | Inspect browser DevTools console & network tab. |

---

## 10. Emergency Contact & Escalation Protocol

In the event of an unresolved production issue:
1. **Immediate Action:** Promote previous Vercel deployment (`dpl_Gm6JNQXC3PoAttGnJk4j978bPRFR`).
2. **Notification:** Alert the engineering lead with deployment IDs, error logs from Vercel Functions, and affected restaurant tenant IDs.
3. **Investigation:** Replicate in local Firestore Emulator before making hotfix commits.
