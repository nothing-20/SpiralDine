# SpiralDine Personal Data Inventory & Privacy Governance

**Version:** 1.0  
**Effective Date:** October 2026  
**Scope:** Customer Web Application, Native Android Application, Restaurant Owner Portal, Staff Portals (Waiter & Kitchen), and Super Admin Administration.

---

## 1. Regulatory Context & Legal Basis

SpiralDine operates as a SaaS multi-tenant digital restaurant operating system. Processing of personal data complies with:
- **Digital Personal Data Protection (DPDP) Act, 2023 (India)**: Legitimate use for order fulfillment and express consent for telemetry and marketing communications.
- **Information Technology Act, 2000 & SPDI Rules, 2011 (India)**: Implementation of reasonable security practices and procedures for sensitive personal data.
- **Central Goods and Services Tax (CGST) Act, 2017 (India)**: Statutory tax retention requirements under Section 36 (72 months for invoices and transaction records).
- **General Data Protection Regulation (GDPR)** / **California Consumer Privacy Act (CCPA)**: Principles of data minimization, storage limitation, purpose limitation, and user rights (access, rectification, erasure).

---

## 2. Personal Data Inventory by User Role

### 2.1 Diners / Customers (Web & Android)

| Category | Data Fields Collected | Source | Purpose of Processing | Legal Basis | Systems / Storage | Retention Period | Deletion / Anonymization Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Account Identity** | Full Name, Email Address, Phone Number, Firebase UID | Self-entered during checkout / registration | Customer authentication, order notification, account identity | Contractual necessity & DPDP Consent | Firebase Auth, Firestore `/users/{uid}` | Duration of account lifecycle + 30 days grace | Complete erasure upon verified deletion request |
| **Dining Preferences** | Dietary flags (Veg, Non-Veg, Vegan), Allergen notes, Favorite items | Profile settings & Checkout customization | Tailoring menu filtering and alerting kitchen of allergens | Consent | Firestore `/users/{uid}/preferences`, Android DataStore | Until updated or account deletion | Immediate deletion on request |
| **Table Booking** | Name, Phone Number, Party Size, Booking Date & Time, Seating Area | Table booking flow | Table allocation, restaurant reservation management | Contractual necessity | Firestore `/tableBookings/{bookingId}`, `/restaurants/{tenantId}/reservations` | 90 days after reservation completion | Auto-archived; PII removed after 90 days |
| **Orders & Invoices** | Order Items, Special Instructions, Order Total, Table #, GST Breakdown | Cart submission & QR dine-in ordering | Order fulfillment, kitchen preparation, KOT dispatch, billing | Contractual necessity & Legal obligation | Firestore `/restaurants/{tenantId}/orders/{orderId}`, `/orders/{orderId}` | **72 Months** (Mandatory CGST Act Sec 36) | After account deletion, order records are **anonymized**: Name/Phone replaced with `ANONYMIZED_DINER`, keeping tax & total figures intact |
| **Payments** | Payment Method, Transaction ID, Razorpay Order/Payment ID | Razorpay Checkout SDK | Payment reconciliation, refund verification, fraud prevention | Legal obligation & Contractual necessity | Firestore `/payments/{paymentId}`, Razorpay PCI-DSS Vault | 72 Months (Statutory audit retention) | PII scrubbed; transaction hash and ledger values retained |
| **Telemetry & Consent** | Essential cookies, Analytics consent, Dietary local storage | Cookie Consent Banner / App Settings | Remembering privacy choices, UX optimization | Express Consent | Browser `localStorage` (`spiraldine_cookie_consent_v1`), Android SharedPreferences | Persistent until user clears data or revokes consent | Instant reset via Settings > Cookie & Storage |

---

### 2.2 Restaurant Owners & Managers

| Category | Data Fields Collected | Source | Purpose of Processing | Legal Basis | Systems / Storage | Retention Period | Deletion / Anonymization Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Identity & Business** | Owner Name, Business Email, Phone, Restaurant Name, FSSAI License, GSTIN | Restaurant Onboarding | Platform verification, invoicing, legal compliance | Contract & Legal obligation | Firestore `/restaurants/{tenantId}`, `/users/{uid}` | Active subscription + 7 years | Retained for tax audits; access revoked on contract termination |
| **Bank & Payouts** | Bank Account Number, IFSC Code, Razorpay Linked Account ID | Billing Settings | Automated settlement and commission handling | Legal obligation | Razorpay Route / Server-side encrypted storage | Active contract + statutory financial period | Subject to financial audit retention regulations |
| **Staff Management** | Staff Name, Email, Role (`owner`, `manager`, `waiter`, `kitchen`), Assigned PIN | Owner Dashboard | Role-based access control, audit logging | Legitimate interest | Firestore `/restaurants/{tenantId}/staff/{staffId}`, Firebase Auth | Active employment period | Deleted immediately upon staff termination by Owner |

---

### 2.3 Restaurant Staff (Waiters, Captains, Kitchen Chefs)

| Category | Data Fields Collected | Source | Purpose of Processing | Legal Basis | Systems / Storage | Retention Period | Deletion / Anonymization Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Staff Profile** | Name, Assigned Tables, Role, Login PIN/Credential | Owner assignment | Order taking, KOT tracking, shift reporting | Legitimate interest | Firestore `/restaurants/{tenantId}/staff` | Active employment | Erased on staff deletion |
| **Operational Activity** | KOT status updates, Order dispatch timestamps, Table assignment history | Operational POS events | Performance tracking, error triage, shift auditing | Legitimate interest | Firestore `/restaurants/{tenantId}/kot/{kotId}`, `/auditLogs` | 180 days | Retained in write-only audit collection |

---

### 2.4 Super Administrators

| Category | Data Fields Collected | Source | Purpose of Processing | Legal Basis | Systems / Storage | Retention Period | Deletion / Anonymization Rule |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Admin Credentials** | Admin Email, Firebase UID, MFA status, IP log | Environment configuration & SuperAdmin Login | SaaS tenant management, subscription management | Legitimate interest & Security | Firebase Auth, Server access logs | Duration of admin tenure | Revoked on role termination |

---

## 3. Third-Party Data Disclosures & Sub-Processors

| Service Provider | Role / Purpose | Data Transmitted | Location / Processing Region | Security Controls |
| :--- | :--- | :--- | :--- | :--- |
| **Google Cloud / Firebase** | Authentication, Firestore Database, Storage, Hosting | Encrypted user records, menu assets, order documents | `asia-south1` (Mumbai) & Global CDN | TLS 1.3, AES-256 at rest, SOC 2, ISO 27001, HIPAA compliant |
| **Razorpay Payments** | Payment Gateway, UPI, Card, Netbanking processing | Payment Order ID, Amount, Currency, Customer Phone (masked) | India | PCI-DSS Level 1 compliant, HMAC-SHA256 signature verification |
| **Vercel** | Web Platform Edge Hosting & Serverless Functions | HTTP request metadata, IP address (ephemeral access logs) | Edge Global Network | ISO 27001, SOC 2 Type 2, DDoS Mitigation |
| **Google Fonts** | Typography delivery (fallback when not local) | Font request IP, User-Agent | Global CDN | Zero cookie transmission, no PII transmitted |

---

## 4. User Rights & Data Subject Requests

Diners and users are provided comprehensive mechanisms to exercise their privacy rights:
1. **Right to Access & Portability**: Diners can view their entire order history, favorite items, and profile details anytime via the Customer Profile (`/profile` on Web, Profile screen on Android).
2. **Right to Rectification**: Diners can update phone numbers, names, and dining preferences directly in settings.
3. **Right to Erasure / Deletion**:
   - Web: Accessible at `/account-deletion` with authenticated identity verification and clear disclosure of statutory tax retention.
   - Android: Accessible via **Settings > Account Deletion** with interactive confirmation modal.
   - Statutory Safeguard: Tax invoices under CGST Act Section 36 are retained in an anonymized state (`ANONYMIZED_DINER`), scrubbing all direct contact and identity identifiers.
4. **Right to Withdraw Consent**:
   - Diners can revoke non-essential cookie/storage consent at any time via the Cookie Consent Banner or app settings.
5. **Data Protection Grievance Officer**:
   - Designated Contact: `privacy@restaurantos.com` (Grievance Redressal Officer under DPDP Act 2023).
   - Response SLA: Within 72 hours of inquiry receipt.
