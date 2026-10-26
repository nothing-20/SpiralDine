# SpiralDine Web Application — Data & Backend Architecture
## Document 04: Data & Backend Mapping

This document provides a technical map of Firestore database paths, serverless API endpoints, service functions, and data schemas across the SpiralDine platform.

---

### 1. Canonical Firestore Collections & Document Paths

SpiralDine enforces a strict multi-tenant database hierarchy. All restaurant-specific operational documents are rooted under the restaurant document.

#### 1.1 Tenant-Scoped Sub-Collections: `restaurants/{tenantId}/...`

| Collection Path | Primary Document ID Scheme | Entity Description | Primary Consumers / Updaters | Security Rule Enforcement |
| :--- | :--- | :--- | :--- | :--- |
| `restaurants/{tenantId}` | String slug or auto-id (`rest-alpha`, `rest_...`) | Restaurant profile: business name, logo, currency, tax rates, operating hours, active status | Owner Settings, Customer Details, Super Admin | `isTenantStaff(tenantId)` for write; public read if `active == true` |
| `restaurants/{tenantId}/orders` | Auto-id or custom (`ORD-...`) | Live orders, items, subtotal, tax, tip, status, diningOption, tableNumber, customerId | Customer Menu, KDS Queue, Waiter Matrix, Owner Dashboard | Read: `isTenantStaff` or authenticated owning `customerId`. Write: serverless or `isValidCustomerOrderUpdate()` |
| `restaurants/{tenantId}/menu/default/items` | Auto-id (`item_...`) | Dishes: name, price, category, veg/non-veg type, prepTime, image, available, allergens | Customer Menu, Owner Menu, KDS Menu Control | Read: public if restaurant active. Write: `isTenantManager(tenantId)` |
| `restaurants/{tenantId}/menu/default/categories` | Auto-id (`cat_...`) | Menu categories: name, order index, active | Customer Menu, Owner Menu | Read: public. Write: `isTenantManager` |
| `restaurants/{tenantId}/tables` | Table ID (`T-1`, `T-2`, or auto-id) | Table definition: tableNumber, capacity, status (`AVAILABLE`, `OCCUPIED`, `RESERVED`), section | Customer QR Portal, Waiter Matrix, Owner Tables | Read: public read for table validation. Write: `isTenantStaff(tenantId)` |
| `restaurants/{tenantId}/staff` | Auto-id (`staff_...`) | Employee profiles: name, email, phone, role, active, branchId | Owner Staff Manager, Super Admin | Read/Write: `isTenantManager(tenantId)` |
| `restaurants/{tenantId}/inventory` | Auto-id (`inv_...`) | Raw ingredients & supplies: name, stockQuantity, unit, reorderThreshold, costPerUnit | Owner Inventory, KDS Quick Stock | Read/Write: `isTenantStaff(tenantId)` |
| `restaurants/{tenantId}/transactions` | Auto-id (`txn_...`) | Confirmed financial settlements: orderId, total, tax, paymentMethod, paymentStatus, paidAt | Owner Overview, Annual Revenue Explorer, Super Admin | Read: `isTenantManager(tenantId)` or `isSuperAdmin()`. Write: `isTenantStaff` |
| `restaurants/{tenantId}/bills` | `BILL-{orderId}` or auto-id | Tax invoices: invoiceNumber, itemized breakdown, tax details, discount, tender breakdown | Waiter POS Billing, Owner Billing, Customer Receipt | Read: `isTenantStaff` or customer. Write: `isValidCustomerBillCreation()` or `isValidBillUpdate()` |
| `restaurants/{tenantId}/reservations` | Auto-id (`res_...`) | Table booking records: guestName, partySize, date, timeSlot, status (`CONFIRMED`, `CANCELLED`) | Customer Booking, Owner Reservations, Reception Desk | Read: owning customer or staff. Write: customer creates, staff updates |
| `restaurants/{tenantId}/promotions` | Auto-id (`promo_...`) | Coupon codes: code, discountType (`percentage`, `fixed`), discountValue, minOrder, active | Cart Page, Owner Promotions | Read: public active promos. Write: `isTenantManager` |
| `restaurants/{tenantId}/satisfactionRatings` | Auto-id (`csat_...`) | Post-dining ratings: orderId, rating (1-5), foodRating, serviceRating, comment | Customer Feedback, Business Health Engine, Owner Reviews | Read: public read. Write: customer creates for their order |
| `restaurants/{tenantId}/alerts` | Auto-id (`alert_...`) | Real-time staff notifications: message, type (`CALL_WAITER`, `FOOD_READY`, `SLA_BREACH`), resolved | Waiter Alerts, Owner Alerts, Kitchen Queue | Read/Write: `isTenantStaff(tenantId)` |
| `restaurants/{tenantId}/automationRules` | Auto-id (`rule_...`) | Automation configurations: name, trigger, conditions, actions, enabled | Owner Automation Center | Read/Write: `isTenantManager` |
| `restaurants/{tenantId}/jobsHistory` | Auto-id (`job_...`) | Execution logs of background jobs and automation triggers | Owner Automation Center | Read/Write: `isTenantManager` |
| `restaurants/{tenantId}/strategyPlans` | Auto-id (`strat_...`) | AI operational recommendations and strategy plans | Owner Strategy Center | Read/Write: `isTenantManager` |
| `restaurants/{tenantId}/branchTransfers` | Auto-id (`trans_...`) | Inter-branch inventory transfer manifests and sign-offs | Owner Branch Transfers | Read/Write: `isTenantManager` |
| `restaurants/{tenantId}/auditLogs` | Auto-id (`audit_...`) | Audit trail entries of sensitive operational changes | Owner Audit Logs | Read: `isTenantManager`. Write: system/staff |

---

#### 1.2 Global Collections

| Collection Path | Primary Document ID Scheme | Entity Description | Security Rule Enforcement |
| :--- | :--- | :--- | :--- |
| `users` | Firebase Auth UID (`request.auth.uid`) | User profile: email, displayName, role (`customer`, `owner`, `admin`, `waiter`, etc.), tenantId, branchId | Read: self, tenant staff, or super_admin. Write: self (non-role fields) or Super Admin |
| `employees` | Auto-id or employee UID | Fast index of staff roster linking employees to tenant restaurants | Read: `isTenantStaff(tenantId)` |
| `super_admin` | Firebase Auth UID | Privileged super administrator profile records | Read/Write: `isSuperAdmin()` only |
| `platformSettings` | `config` / `features` | Global SaaS toggles, maintenance mode, platform payment keys | Read: public/authenticated; Write: `isSuperAdmin()` |

---

### 2. Serverless API Endpoints (`api/`)

| Endpoint Route | HTTP Method | Implementation File | Primary Purpose | Authorization / Security Controls |
| :--- | :--- | :--- | :--- | :--- |
| `/api/orders/create` | `POST` | [`api/orders/create.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/orders/create.ts) | Authoritative order creation. Verifies dish prices from DB, applies server-side coupon calculations, computes taxes, verifies online payment signatures, deducts inventory, commits order. | Validates Firebase Auth token or verified guest session. Invariant pricing check. |
| `/api/payments/create-order` | `POST` | [`api/payments/create-order.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/payments/create-order.ts) | Creates Razorpay order instance with exact currency and amount. | Authenticated customer or dining session. |
| `/api/payments/verify` | `POST` | [`api/payments/verify.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/payments/verify.ts) | Verifies Razorpay payment signature using server-side HMAC-SHA256 secret key. | Razorpay signature verification. Prevents forged payments. |
| `/api/send-staff-invitation` | `POST` | [`api/send-staff-invitation.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/send-staff-invitation.ts) | Generates cryptographically signed invitation token, commits invitation record, dispatches email via Resend. | Restricted to authenticated `owner` or `admin` of target `tenantId`. |
| `/api/verify-invitation` | `GET` | [`api/verify-invitation.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/verify-invitation.ts) | Validates invitation token validity, checks expiration (48h), returns restaurant metadata. | Public token lookup with rate-limiting. |
| `/api/contact` | `POST` | [`api/contact.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/contact.ts) | Sends lead inquiry or support message to platform operations inbox via Resend. | Public with reCAPTCHA validation. |
| `/api/send-order-confirmation`| `POST` | [`api/send-order-confirmation.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/send-order-confirmation.ts)| Dispatches HTML order confirmation receipt email to diner. | Authenticated diner or order creation hook. |
| `/api/send-invoice` | `POST` | [`api/send-invoice.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/send-invoice.ts) | Generates tax invoice PDF and sends via email upon bill settlement. | Tenant staff or customer owner. |
| `/api/send-reservation` | `POST` | [`api/send-reservation.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/send-reservation.ts) | Dispatches table booking confirmation email. | Customer or restaurant host. |
| `/api/super-admin/setup` | `POST` | [`api/super-admin/setup.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/super-admin/setup.ts) | First-run setup of Super Admin account. | Gated by `SETUP_SECRET` environment variable. |

---

### 3. Core Domain Entities & Schemas

#### 3.1 Order Entity (`IOrder` / `restaurants/{tenantId}/orders/{orderId}`)
```typescript
interface IOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number; // Unit price in standard currency unit
  type?: 'veg' | 'non-veg' | 'vegan';
  notes?: string;
  selectedModifiers?: Array<{ name: string; price: number }>;
}

interface IOrder {
  id: string;
  orderNumber: string; // e.g. #ORD-8492
  tenantId: string;
  branchId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  tableNumber?: string;
  diningOption: 'Dine-In' | 'Takeaway' | 'Delivery';
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED' | 'COMPLETED' | 'CANCELLED';
  items: IOrderItem[];
  subtotal: number;
  tax: number; // GST
  serviceCharge: number;
  discount: number;
  tip?: number;
  total: number; // Subtotal + Tax + ServiceCharge + Tip - Discount
  paymentMethod: 'razorpay' | 'cash' | 'card' | 'upi';
  paymentStatus: 'pending' | 'paid' | 'completed' | 'settled' | 'failed' | 'refunded';
  specialInstructions?: string;
  createdAt: string; // ISO 8601
  updatedAt?: string;
  preparedAt?: string;
  servedAt?: string;
  completedAt?: string;
}
```

#### 3.2 Menu Item Entity (`IMenuItem` / `restaurants/{tenantId}/menu/default/items/{itemId}`)
```typescript
interface IMenuItem {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  type: 'veg' | 'non-veg' | 'vegan';
  prepTime: number; // in minutes (used for kitchen SLA countdowns)
  image?: string; // Firebase Storage URL
  available: boolean; // 86'd status toggle
  isChefSpecial?: boolean;
  allergens?: string[];
  spiceLevel?: 'Mild' | 'Medium' | 'Spicy';
  createdAt: string;
}
```

#### 3.3 Transaction Entity (`ITransaction` / `restaurants/{tenantId}/transactions/{txnId}`)
```typescript
interface ITransaction {
  id: string;
  orderId: string;
  tenantId: string;
  branchId?: string;
  total: number;
  tax: number;
  subtotal: number;
  discount: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'completed' | 'settled' | 'refunded' | 'voided';
  invoiceNumber?: string;
  transactionRef?: string;
  createdAt: string; // ISO 8601
}
```

---

### 4. Canonical Financial & Operational Calculations

#### 4.1 Today's Sales Calculation
Strictly derived from confirmed payment settlements:
$$\text{Today's Sales} = \sum_{t \in \text{Transactions}} t.\text{total}$$
Where:
* $t.\text{paymentStatus} \in \{\text{'paid'}, \text{'completed'}, \text{'settled'}\}$
* $t.\text{paymentStatus} \notin \{\text{'refunded'}, \text{'voided'}, \text{'failed'}\}$
* $t.\text{total} > 0$
* $\text{toDateString}(t.\text{createdAt}) == \text{toDateString}(\text{now})$

#### 4.2 Fiscal Year Boundaries & Net Revenue
$$\text{FY Start} = \text{April 1}, \quad \text{FY End} = \text{March 31 (following year)}$$
$$\text{Gross Revenue} = \sum_{t \in \text{FY}} t.\text{total}, \quad \text{GST} = \sum_{t \in \text{FY}} t.\text{tax}$$
$$\text{Net Revenue} = \text{Gross Revenue} - \text{GST}$$
$$\text{Avg Monthly Revenue} = \frac{\text{Net Revenue}}{\max(\text{Active Months with Transactions}, 1)}$$

#### 4.3 Business Health Engine Formulation
$$\text{Overall Health Score} = \sum_{i=1}^{5} \left( \frac{\text{NormalizedWeight}_i}{100} \times \text{DimensionScore}_i \right)$$
Where baseline weights are:
1. **Revenue Health ($25\%$)**: 7-day volume pace and AOV stability.
2. **Operations Health ($25\%$)**: $\text{Completion Rate} = \frac{\text{Completed Orders}}{\text{Total Orders}} \times 100$.
3. **Customer Health ($20\%$)**: Mean CSAT rating mapped to 100-point scale.
4. **Inventory Health ($15\%$)**: Percentage of active menu items with adequate pantry stock.
5. **Kitchen Health ($15\%$)**: Percentage of tickets bumped within standard SLA prep time.

If any dimension has insufficient data ($< 3$ transactions), it is designated `insufficient_data`, excluded from the numerator, and the remaining available dimension weights are dynamically renormalized:
$$\text{NormalizedWeight}_j = \frac{\text{Weight}_j}{\sum_{k \in \text{Available}} \text{Weight}_k} \times 100$$
Ensuring the restaurant's operational health score is never artificially penalized due to lack of historical activity.
