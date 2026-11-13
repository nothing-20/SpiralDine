# Release Checklist: SpiralDine Production Deployment Protocol

**Canonical Production Domain:** `https://dine.spiralworld.in`  
**Governance Reference:** [docs/governance/ENGINEERING_GOVERNANCE.md](./governance/ENGINEERING_GOVERNANCE.md)

---

## 1. Pre-Release Code Integrity Checkpoints
- [ ] **TypeScript & Vite Build**: Run `npm run build` (`tsc && vite build`) with zero errors.
- [ ] **ESLint Verification**: Run `npm run lint` cleanly once ESLint config is restored under governance hardening *(note: missing `.eslintrc.*` tracked in Wave 0 baseline)*.
- [ ] **Secrets & Config Scan**: Confirm zero hardcoded credentials, service accounts, or `SMTP_PASS` / live Razorpay secrets appear in Git or `VITE_*` variables.
- [ ] **Approval Record**: Change Request completed and explicitly approved per `ENGINEERING_GOVERNANCE.md` Section 5.

---

## 2. Multi-Tenant Database & Backend Security Audits
- [ ] **Real Firestore Emulator Security Suite**: Execute `powershell -ExecutionPolicy Bypass -File scripts/run-emulator-test.ps1 "node scripts/test-phase9-emulator.js"` (plus Wave 2 security gates suite) with `0` failures.
- [ ] **Composite Indexes & Backward Compatibility**: Verify `firestore.indexes.json` deploys cleanly to `spiraldine-staging` *before* dependent code ships, and older active clients/Android APKs remain compatible.
- [ ] **Payment & Webhook Verification**: Verify Razorpay `/api/payments/create-order`, `/api/payments/verify`, and `/api/payments/razorpay/webhook` pass idempotency and signature tests under `rzp_test_*` on staging.

---

## 3. Critical Operations User Journey Verifications (Staging Only)
- [ ] **Guest QR Ordering**: Scan QR -> anonymous session initialized cleanly -> `/api/orders/create` validates canonical menu prices/modifiers -> KDS receives ticket in real time.
- [ ] **Kitchen & Waiter Sync**: Concurrent Chef `READY` & Waiter `SERVED` state transitions preserve all item statuses cleanly; table release returns table to `Available`.
- [ ] **Billing & Settlement**: Bill breakdown matches server totals; cash/Razorpay payment writes exactly one immutable ledger transaction and updates dining session.
- [ ] **Contact Email / Staff Invites**: Contact workflow & approval notifications dispatch cleanly without leaking PII or blocking tenant DB mutations.

---

## 4. Production Deployment & Rollback Readiness
- [ ] **Staging Pass Verified**: All automated and manual E2E checks green on `spiraldine-staging` + Vercel Preview.
- [ ] **Database & Rules**: Run `firebase deploy --only firestore:rules,firestore:indexes --project spiral-restaurant-saas-v1` only after verifying zero `PERMISSION_DENIED` regressions on staging.
- [ ] **Frontend & API Promotion**: Deploy verified build to Vercel Production preserving `https://dine.spiralworld.in` and `spiral-dine.vercel.app` redirect, plus smoke check `/api/health` / `/contact`.
- [ ] **Rollback Target Recorded**: Previous verified Vercel deployment URL and `firestore.rules` git commit SHA logged before promotion per [SAFE_ROLLBACK_GUIDE.md](./SAFE_ROLLBACK_GUIDE.md).
