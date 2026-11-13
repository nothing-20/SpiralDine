# SpiralDine Commercial SaaS Engineering Governance Standard

**Document Status**: Active Baseline (Programme Phase 1 / Wave 0)  
**Production Domain**: `https://dine.spiralworld.in` *(alias redirect preserved from `spiral-dine.vercel.app`)*  
**Production Firebase Project**: `spiral-restaurant-saas-v1`  
**Audit Backlog Source**: [MASTER_ISSUE_REGISTER.md](./MASTER_ISSUE_REGISTER.md) (**33 findings**: `8 CRITICAL`, `13 HIGH`, `9 MEDIUM`, `3 LOW`)

---

## 1. Strategic Mandate & Non-Negotiable Execution Rules

SpiralDine is governed as a commercial multi-tenant SaaS platform. All changes MUST obey these controls:
1. **Small Reviewable Phases**: Never merge or deploy multiple high-blast-radius changes simultaneously. Complete and verify one wave before starting the next.
2. **No Production Testing**: Live restaurant tenants and `spiral-restaurant-saas-v1` MUST NOT be used for automated tests, load tests, or reset scripts.
3. **No Secret Exposure**: Never commit credentials, service accounts, or app passwords to Git, client bundles, or `VITE_*` variables.
4. **Backward Compatibility & Data Preservation**: Existing live restaurant documents, orders, bills, KOTs, and active Android APKs (`versionCode >= 1`) must remain operational across schema/rules transitions via additive dual-reads before cleanup.
5. **No Silent Security Relaxation**: Never weaken `firestore.rules` or API auth checks to make broken client code work; fix the client/server workflow instead.
6. **Explicit Deployment & Cost Gate**: Paid cloud tiers (Firebase Blaze triggers/PITR, Vercel Pro, Upstash Redis, paid Sentry tiers) and production deployments require explicit human change approval.

---

## 2. Severity & Priority Classification

| Severity | Definition & Business Risk | Remediation Wave & Target Gate | Merge / Release Policy |
| :--- | :--- | :--- | :--- |
| **CRITICAL** (`C-01`–`C-08`) | Platform-wide auth bypass, cross-tenant PII/financial breach, payment spoofing, webhook/ledger loss, live-DB destruction risk, or unbounded cross-tenant queries (`O(tenants * N)`). | **Wave 1** (`C-08` isolation) & **Waves 2A–2C** (`C-01`–`C-06`) + **Wave 4A** (`C-07`) | Zero commercial expansion or Phase 7 billing launch permitted while any `CRITICAL` remains `OPEN`. |
| **HIGH** (`H-01`–`H-13`) | Concurrency lost updates (`items[]`, double settlement, $N$-tab polling storms), Android–Web schema/currency drift, missing composite indexes, missing App Check, `2.34 MB` bundle / `3.82 MB` hero assets, Hobby limits, zero APM/Crashlytics. | **Wave 3** (Concurrency & Parity) -> **Wave 4A/4B** (Scale & Indexes) -> **Wave 5** (App Check & APM) | Must be mitigated with regression coverage before onboarding commercial cohorts at scale. |
| **MEDIUM** (`M-01`–`M-09`) | Single-instance RAM throttling, missing HTTP timeouts, rule lookup amplification (`get()`/`exists()`), table heartbeat write spam, disabled Web IndexedDB persistence, non-atomic KOT numbering, PrintBridge multi-device duplicate slips & missing encryption/R8, dead FCM tokens, `super_admin` casing drift. | **Waves 2C, 3, 4A/4B, 5** (aligned with parent workflow) | Resolved prior to SLA-backed Enterprise launch. |
| **LOW** (`L-01`–`L-03`) | Unescaped legacy Resend template variables, dead-code callable `createValidatedOrder` + stale architecture docs, hardcoded `'spiraldine@upi'` VPA fallback. | **Waves 3, 4A** (opportunistic cleanup alongside owning module) | Tracked to closure without blocking emergency security patches. |

### Phased Programme Execution Sequence
- **Wave 0 (Governance)**: Issue register, ops/dependency map, rollback sync, automated check baseline. *(`$0` cost)*
- **Wave 1 (Environment Isolation)**: Separate `spiraldine-dev` & `spiraldine-staging`, harden `reset-dev-db.js` / `migrate-customers.js` against `spiral-restaurant-saas-v1`, Vercel Preview & Android flavors. *(`$0` Spark initially)*
- **Wave 2A (Auth & Admin JWTs)**: Remove unsigned JWT bypasses & hardcoded `dev-admin-reset`, move server to `firebase-admin` (`C-01`, `C-02`).
- **Wave 2B (APIs, Payments & Webhooks)**: Caller RBAC on `/api/payments/*` & `/api/send-*` & `functions/`, `webhook.ts` `collectionGroup` + `400`, atomic `TXN-${billId}` settlement (`C-05`, `C-06`).
- **Wave 2C (Guest QR Parity & Rules Lockdown)**: Upgrade `/api/orders/create` for variants/addons/combos/staff-walk-in, remove direct client fallbacks, verify guest QR flow, then tighten `firestore.rules` (`C-03`, `C-04`, `M-02`).
- **Wave 3 (Concurrency & Android–Web Parity)**: Transactional `itemStates`, atomic `counters/kot`, PrintBridge ticket leases, Android schema/paise/domain (`dine.spiralworld.in`) + Razorpay Android SDK (`H-01`, `H-02` txn, `H-05`, `M-05`, `M-09`, `L-03`).
- **Wave 4A (Low-Risk Scale — `$0`)**: Ref-counted Web listener store (`6x -> 1x`), `startAfter` cursors, `firestore.indexes.json`, Vite chunks + WebP, IndexedDB cache, ViewModel `stateIn`, `db.getAll` (`C-07`, `H-03`, `H-04`, `H-06`, `H-08`, `H-10`, `H-13`, `M-04`, `M-08`, `L-01`, `L-02`).
- **Wave 4B (Server Offload — Requires Paid Approval)**: Cloud Functions v2 triggers/daily rollups (`H-02`, `H-12`), Cloud Tasks async email/Vercel Pro (`H-09`), Upstash Redis + HTTP timeouts (`M-01`, `M-03`).
- **Wave 5 (Reliability, Observability & DR)**: App Check (`H-07`), `/api/health`, Sentry + Crashlytics + GCP budget alerts (`H-11`), FCM triggers (`M-07`), PrintBridge security/R8 (`M-06`), PITR & scheduled GCS restore drills (`C-08`).
- **Wave 6 (Commercial SaaS Readiness — Phase 7)**: Subscription billing webhooks, trial lifecycle fixes, plan entitlements/quotas, real `SuperAdminSettings`/`Reports`, SLA support routing, immutable server `auditLogs`.

---

## 3. Release & Rollback Strategy

Canonical recovery procedures are maintained in [docs/SAFE_ROLLBACK_GUIDE.md](../SAFE_ROLLBACK_GUIDE.md) and verified against [docs/RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md). Every wave follows these structural rules:
1. **Additive-First Rule & Index Rollouts**: Deploy new `firestore.indexes.json` indexes *before* queries that need them, and support additive backwards-compatible rules (e.g., JWT custom claim OR verified doc) during multi-client cutovers before removing legacy fallbacks.
2. **Atomic Web + API Rollback**: Vercel bundles the SPA (`dist/`) and Vercel Serverless Functions (`api/`) atomically. Promoting a known-good Vercel deployment immediately restores `https://dine.spiralworld.in` SPA + `/api/*` together without client/server API mismatch.
3. **Database & Financial Irreversibility Guard**: Git/Vercel rollbacks never revert Firestore writes or Razorpay settlements. Schema migrations MUST run idempotent scripts tested in `spiraldine-staging` first with a recorded backup/export checkpoint and reverse-mapping plan.
4. **Android Release Safety**: Protect Firestore schema changes against old APK installs (`versionCode = 1+`) using server adapters / dual-reads during transition and Remote Config minimum-version gating prior to deprecation.

---

## 4. Critical Workflow Test Strategy

| Workflow | Current Tooling & Gap Observed (Wave 0) | Required Verification Gate Per Change |
| :--- | :--- | :--- |
| **TypeScript & Static Lint** | `npm run build` (`tsc && vite build`) passes cleanly; **`npm run lint` currently fails because ESLint configuration file (`.eslintrc.*`) is missing from repo**. | Fix ESLint config early (Wave 1/2), run `tsc --noEmit` + `npm run build` + `eslint` with zero errors before every merge. |
| **Firestore Rules & Multi-Tenant Isolation** | `scripts/test-phase8-security-regression.js` (`49/49`) uses an **in-memory JS mock class**, not real Firestore HTTP evaluation. `scripts/test-phase9-emulator.js` (`26/26`) hits real Firestore Emulator (`scripts/run-emulator-test.ps1`), but lacks `C-03`/`C-04` exploit cases. | Expand real Firestore Emulator HTTP suite (`test-phase2-security-gates.js`) covering all 9 roles (`guest`, `customer`, `waiter`, `kitchen`, `chef`, `cashier`, `manager`, `owner`, `super_admin`) and unauthenticated denial cases. |
| **Customer QR Ordering & Cart Validation** | `scripts/test-phase13-order-validation.js`, `scripts/test-dining-session-workflow.js`, `android/customer/.../OrderIntegrationTest.kt`. | Playwright E2E QR scan -> variant/addon order -> `/api/orders/create` price check -> rejected price tamper -> promo redemption count concurrency test. |
| **Payments, Webhooks & Settlement** | `scripts/test-razorpay-integration.js`, `scripts/test-cross-platform-financial-sync.mjs`, `PaymentRepositoryTest.kt`. | Simultaneous `/api/payments/verify` + `/api/payments/razorpay/webhook` race verifying single `TXN-${billId}` ledger doc, invalid HMAC `401`, missing signature `400`. |
| **KDS, Waiter Matrix & PrintBridge** | `scripts/test-kot-architecture.js`, `scripts/test-floorplan.cjs`, `PrintJobRepositoryTest.kt`, `PrintQueueProcessorTest.kt`. | Concurrent Chef (`READY`) + Waiter (`SERVED`) update test (`0` reverted states); dual PrintBridge device claim test (`1` print/KOT); Room migration `v1->v2`. |
| **Onboarding, Invites & Super Admin** | `scripts/test-staff-invitation-e2e.js`, `scripts/test-super-admin-auth.js`, `scripts/test-registration-approval-workflow.cjs`, `FirebaseAuthManagerTest.kt`. | Unsigned forged JWT `401`/`403` tests on `review-application`; cross-tenant invite enumeration denial; custom claim propagation test. |
| **Contact & Transactional Email** | `scripts/test-contact-email-workflow.mjs` (`20/20` contact tests on mock/test runner). | Template XSS unit tests (`L-01`); staging SMTP sink (Mailpit/Ethereal) verification ensuring prod GoDaddy relay isn't stressed during CI/QA. |
| **Load & Latency** *(Post-Wave 1 only)* | None present (`package.json` lacks `test` script & Playwright/k6). | Run `k6` HTTP load tests & multi-tab Playwright listener-count tests strictly against **`spiraldine-staging`**. |

---

## 5. Production Change Approval Process

No PR affecting production Firebase (`spiral-restaurant-saas-v1`), `firestore.rules`, `/api/*`, `functions/`, Android releases, or billing configuration may deploy without an approved **Production Change Record**:

```markdown
### Production Change Request — [Wave / Ticket ID]
- **Author & Reviewer**: 
- **Target Git Commit / PR**: 
- **Audit Finding IDs Addressed**: 
- **Affected Platforms**: [ ] Web  [ ] Vercel API  [ ] Cloud Functions  [ ] Firestore Rules/Indexes  [ ] Android Customer/Owner/PrintBridge
- **Schema / Data Migration Needed?**: Yes/No — attach staging migration output & backup snapshot ID
- **Legacy Client Compatibility Verified?**: Confirm behavior of active QR sessions & Android v1 APKs during rollout
- **Pre-Production Verification Evidence**:
  - [ ] TypeScript & Vite build clean (`npm run build`)
  - [ ] Real Firestore Emulator Security Suite pass log attached
  - [ ] Staging E2E verification (`spiraldine-staging` + Vercel Preview + `rzp_test_*`)
- **Rollback Plan**: Exact Vercel deployment ID / Git revert SHA / Rules fallback commit & ETA
- **Explicit Deployment Approval**: [Approved by User / Timestamp]
```

