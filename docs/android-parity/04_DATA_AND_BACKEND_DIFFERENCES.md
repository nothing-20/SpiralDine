# SpiralDine — 04. Data Architecture & Backend Differences

## 1. Executive Summary

This document provides a field-by-field and endpoint-by-endpoint analysis comparing data models, Firestore collection paths, serverless API interactions, and mathematical calculations between the SpiralDine Web Application and the Native Android platform.

---

## 2. Firestore Collection Paths & Tenant Boundaries

| Entity | Canonical Web Path | Android Customer (`:customer`) | Android Owner (`:owner`) | Android PrintBridge (`:app`) | Consistency Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Restaurants** | `/restaurants/{resId}` | `/restaurants/{resId}` | `/restaurants/{tenantId}` | `/restaurants/{tenantId}` | **MATCHES** |
| **Orders** | `/restaurants/{resId}/orders/{id}` | `/restaurants/{resId}/orders/{id}` | `/restaurants/{tenantId}/orders/{id}` | `/restaurants/{tenantId}/orders/{id}` | **MATCHES** |
| **Customer Ledger** | `/customers/{uid}/orders/{id}` | `/customers/{uid}/orders/{id}` | Not read | Not read | **MATCHES** |
| **Menu Items** | `/restaurants/{resId}/menu/default/items/{id}` | `/restaurants/{resId}/menu/default/items/{id}` | `/restaurants/{tenantId}/menu/default/items/{id}` | Local cache / Firestore | **MATCHES** |
| **Menu Categories** | `/restaurants/{resId}/menu/default/categories/{id}` | Subcollection `categories` | Subcollection `categories` | Not read | **MATCHES** |
| **Tables** | `/restaurants/{resId}/tables/{id}` | Subcollection `tables` | Subcollection `tables` | Not read | **MATCHES** |
| **Staff Roster** | `/restaurants/{resId}/staff/{id}` | Not accessible | `/restaurants/{tenantId}/staff/{id}` | Not read | **MATCHES** |
| **Staff Invitations** | `/invitations/{id}` | Not accessible | **MISSING IN ANDROID** | Not read | **DIFFERENCE** |
| **Dining Sessions** | `/restaurants/{resId}/sessions/{id}` | Subcollection `sessions` | Implicit in Orders | Implicit in Orders | **PARTIAL** |
| **User Roles** | `/users/{uid}` | `/users/{uid}` | Not explicitly read | Not explicitly read | **DIFFERENCE** |

---

## 3. Data Model Schema Comparison

### A. Order Record Schema

| Field Name | Web Type | Android Customer Type | Android Owner Type | Schema Consistency Notes |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | `String` | `String` | Consistent document ID |
| `orderNumber` | `string` (`#ORD-...`) | `String` | `String` | Consistent human-readable identifier |
| `tableNumber` | `string` | `String` | `String` | Consistent (normalized table string) |
| `diningOption`| `enum` (`Dine-In`/`Takeaway`/`Delivery`) | `DiningOption` enum | `String` (defaults to `"Dine-In"`) | Structurally aligned |
| `status` | `string` (`PENDING`, `PREPARING`, `READY`, `SERVED`, `COMPLETED`, `PAID`) | `OrderStatus` enum | `String` | Status string values match canonical web flow |
| `items` | `Array<OrderItem>` | `List<OrderItemRecord>` | `List<OrderItemRecord>` | List of name, qty, price, notes |
| `subtotal` | `number` (Float) | `Double` | `Double` | Matched |
| `tax` | `number` (Float) | `Double` | `Double` | Matched (GST total) |
| `discount` | `number` (Float) | `Double` | `Double` | Matched |
| `total` | `number` (Float) | `Double` | `Double` | Matched (Subtotal + Tax - Discount) |
| `paymentStatus`| `string` (`pending`, `paid`, `refunded`, `failed`) | `String` | `String` | Matched |
| `printed` | `boolean` (optional) | Not tracked | `Boolean` | Tracked by `:app` PrintBridge to prevent duplicate KOT prints |

### B. Menu Item Schema

| Field Name | Web Type | Android Type (`MenuItemRecord`) | Schema Consistency Notes |
| :--- | :--- | :--- | :--- |
| `id` | `string` | `String` | Matched |
| `name` | `string` | `String` | Matched |
| `description` | `string` | `String` | Matched |
| `category` | `string` | `String` | Matched |
| `price` | `number` | `Double` | Matched |
| `type` / `isVeg` | `string` (`'veg'` / `'non-veg'`) or `boolean` | `String` (`"veg"` / `"non-veg"`) | Android normalizes both string and boolean representations |
| `prepTime` | `number` (minutes) | `Int` | Matched |
| `available` | `boolean` | `Boolean` | Matched |
| `image` | `string` (URL) | `String` | Matched |

### C. Staff Record Schema

| Field Name | Web Type | Android Type (`StaffRecord`) | Schema Consistency Notes |
| :--- | :--- | :--- | :--- |
| `id` | `string` | `String` | Matched |
| `name` | `string` | `String` | Web accepts `name` or `displayName`; Android checks both |
| `email` | `string` | `String` | Matched |
| `role` | `enum` (`'waiter'`, `'kitchen'`, `'manager'`, `'cashier'`) | `String` | Matched |
| `active` | `boolean` | `Boolean` | Matched |
| `invitationId`| `string` (Reference to `/invitations`) | **Omitted** | **Android currently writes staff directly without invitation token** |

---

## 4. Mathematical & Business Logic Comparison

### A. Business Health Score Calculation

#### Canonical Web Formula:
Implemented in [`src/utils/businessHealth.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/utils/businessHealth.ts):
$$\text{Score} = \sum_{i=1}^{5} (\text{Dimension Score}_i \times \text{Weight}_i)$$
* **5 Dimensions (Weight: 20 points each)**:
  1. *Revenue Consistency*: Day-over-day sales variance.
  2. *Order Velocity*: Average time elapsed between order creation and `SERVED` status.
  3. *Staff Availability*: Ratio of active staff on shift to assigned tables.
  4. *Table Utilization*: Ratio of occupied tables to total dining capacity.
  5. *Promotion Effectiveness*: Ratio of discount-attributed revenue to gross sales.
* **Coverage**: Percentage of dimensions having sufficient data (e.g. 4/5 available = 80% coverage).
* **Thresholds**:
  - Score >= 80: `"Healthy"` (Green)
  - Score 60–79: `"Fair"` (Amber)
  - Score < 60: `"Critical"` (Red)

#### Android Implementation (`OwnerRepository.kt`):
- Android implements `calculateBusinessHealth()` matching the web formula:
  - Produces an integer score out of 100.
  - Computes `businessHealthCoverage` (80%).
  - Emits the identical string labels (`"Healthy"`, `"Fair"`, `"Critical"`).
  - Status: **100% MATHEMATICAL PARITY VERIFIED**.

---

### B. Annual Revenue Analysis & Fiscal Year Calculation

#### Canonical Web Formula:
Implemented in [`src/apps/owner/mobile/pages/MobileHomeDashboard.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/mobile/pages/MobileHomeDashboard.tsx):
- **Fiscal Year Definition**: April 1 to March 31.
  - If current month >= April (month index >= 3), FY is `YYYY-(YY+1)` (e.g., April 2026 -> `2026-27`).
  - Else FY is `(YYYY-1)-YY` (e.g., January 2026 -> `2025-26`).
- **Eligible Paid Transaction Filter**:
  ```typescript
  const isPaid = status === 'paid' || status === 'completed' || status === 'settled';
  const isRefundedOrVoid = status === 'refunded' || status === 'voided' || status === 'failed';
  return isPaid && !isRefundedOrVoid && hasValidTotal;
  ```
- **Net Revenue**:
  $$\text{Net Revenue} = \sum (\text{Order Total}) - \sum (\text{Order Tax / GST})$$

#### Android Implementation (`OwnerRepository.kt`):
- Implements identical fiscal year boundary parsing (`recalculateOverview()`):
  - Correctly evaluates `2026-27` as current fiscal year.
  - Filters strictly for `paid`, `completed`, and `settled` orders.
  - Excludes `refunded`, `failed`, and `voided` transactions.
  - Subtracts `tax` to compute Net Revenue.
  - Status: **100% MATHEMATICAL PARITY VERIFIED**.

---

## 5. Backend Serverless API Interactions

| API Endpoint | Method | Web Implementation | Android Implementation | Parity Status |
| :--- | :--- | :--- | :--- | :--- |
| `/api/orders/create` | `POST` | Primary ordering path; authoritatively computes totals and validates live stock. | Invoked in `OrderRepository.kt#L100` with `idToken`; falls back to direct Firestore write on network failure. | **ALIGNED** |
| `/api/payments/create-order` | `POST` | Initializes Razorpay Order ID for checkout popup. | Omitted in Android; uses mock or direct counter cash. | **GAP** |
| `/api/payments/verify` | `POST` | Verifies cryptographic HMAC-SHA256 signature before marking order as `PAID`. | Omitted in Android; marks payment status client-side. | **CRITICAL GAP** |
| `/api/send-staff-invitation`| `POST` | Dispatches cryptographic invitation email with role claims via Resend. | Omitted in Android; writes directly to `/staff` collection. | **SECURITY GAP** |
| `/api/verify-invitation` | `POST` | Validates token during staff activation. | Not applicable to Android (staff activation occurs on web). | **NOT APPLICABLE** |

---

## 6. Summary of Data Gaps

1. **Payment Signature Verification**:
   - Web verifies payments on the serverless backend via `api/payments/verify.ts`.
   - Android customer app lacks integration with the Razorpay Android SDK callback and verification API.
2. **Staff Invitation Mechanism**:
   - Android Owner directly inserts staff records into Firestore without creating invitation records or sending activation tokens.
3. **Hardcoded Tenant Reference in Owner App**:
   - `OwnerRepository.kt` defaults to `private val tenantId: String = "rest-alpha"`. In multi-tenant deployments, `tenantId` must be extracted from the authenticated user's profile in `users/{uid}`.
