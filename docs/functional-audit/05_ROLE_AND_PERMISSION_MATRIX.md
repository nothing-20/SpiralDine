# SpiralDine Web Application — Role & Permission Matrix
## Document 05: Role & Permission Matrix

This document defines the Role-Based Access Control (RBAC) model of SpiralDine, mapping user roles to authorized client routes, permissible business actions, multi-tenant boundaries, and Firestore security rule enforcement.

---

### 1. User Roles Taxonomy

| Role Identifier | User Category | Scope of Authority | Description |
| :--- | :--- | :--- | :--- |
| `super_admin` | Platform Operator | Global (Cross-Tenant) | Full access to platform management, tenant provisioning, global order firehose, and system settings. |
| `owner` | Franchisee / Restaurant Owner | Tenant-Wide (`tenantId`) | Full executive authority over restaurant branding, menus, pricing, staff roster, banking/billing, and AI analytics. |
| `admin` | General / Branch Manager | Tenant + Assigned Branch | Operational authority over daily branch orders, table floor plans, staff scheduling, and inventory intake. |
| `manager` | Shift Operations Manager | Assigned Branch (`branchId`) | Superintends kitchen lines, handles table billing overrides, server assignments, and customer escalation. |
| `waiter` | Floor Captain / Server | Assigned Branch (`branchId`) | Interacts with table floor matrix, punches KOT orders, marks orders served, and processes customer bills. |
| `kitchen` / `chef` | Line Cook / Head Chef | Assigned Branch (`branchId`) | Manages KDS order queue, bumps tickets, controls dish 86'd availability, monitors recipe specs. |
| `cashier` | Checkout Desk Attendant | Assigned Branch (`branchId`) | Operates cash register, validates payment vouchers, generates printed tax invoices. |
| `reception` | Hostess / Door Greeter | Assigned Branch (`branchId`) | Manages walk-in table queues, seats guests, confirms table reservations. |
| `customer` | Registered Diner | Self-Owned (`customerId`) | Browses restaurants, books tables, places orders, makes online payments, reviews dining history. |
| `guest` | Unauthenticated Diner | Ephemeral Table Session | Scans table QR sticker, browses menu, adds items to table order, requests bill. |

---

### 2. Route Access Permissions Matrix

| Route Category / Path | `super_admin` | `owner` | `admin` | `manager` | `waiter` | `kitchen` | `cashier` | `reception` | `customer` | `guest` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Public Landing & Legal** (`/`, `/about`, `/pricing`, `/terms`) | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Customer Portal** (`/customer/home`, `/customer/discover`) | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | REDIRECT |
| **Restaurant Profile & Menu** (`/customer/restaurant/:id/menu`) | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Cart & Payment** (`/customer/cart`, `/customer/payment`) | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | ALLOW |
| **QR Table Session** (`/r/:tenantId/table/:tableId`) | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| **Diner Orders & Profile** (`/customer/orders`, `/customer/profile`)| DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | ALLOW | DENY |
| **Owner Executive Dashboard** (`/owner/dashboard`, `/owner`) | DENY | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| **Owner Orders & Menu** (`/owner/orders`, `/owner/menu/*`) | DENY | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| **Owner Tables & Staff** (`/owner/tables`, `/owner/staff`) | DENY | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| **Owner Financials** (`/owner/billing`, `/owner/analytics`) | DENY | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| **Owner Settings & Automation** (`/owner/settings`, `/owner/automation`)| DENY | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| **KDS Kitchen Queue** (`/dashboard/kitchen`) | DENY | ALLOW | ALLOW | ALLOW | DENY | ALLOW | DENY | DENY | DENY | DENY |
| **KDS Menu Availability** (`/dashboard/kitchen/menu-control`) | DENY | ALLOW | ALLOW | ALLOW | DENY | ALLOW | DENY | DENY | DENY | DENY |
| **Waiter Floor Matrix** (`/dashboard/waiter`) | DENY | ALLOW | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY |
| **Waiter POS Billing** (`/dashboard/waiter/billing`) | DENY | ALLOW | ALLOW | ALLOW | ALLOW | DENY | ALLOW | DENY | DENY | DENY |
| **Manager Workspace** (`/dashboard/manager`) | DENY | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY |
| **Cashier Desk** (`/dashboard/cashier`) | DENY | ALLOW | ALLOW | ALLOW | DENY | DENY | ALLOW | DENY | DENY | DENY |
| **Reception & Seating** (`/dashboard/reception`) | DENY | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY | ALLOW | DENY | DENY |
| **Super Admin Platform** (`/super-admin/*`) | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY |

---

### 3. Business Actions Permission Matrix

| Operational Action | `super_admin` | `owner` | `admin` | `manager` | `waiter` | `kitchen` | `customer` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Create Dish / Update Price** | DENY | ALLOW | ALLOW | DENY | DENY | DENY | DENY |
| **Toggle Dish 86'd Availability** | DENY | ALLOW | ALLOW | ALLOW | DENY | ALLOW | DENY |
| **Place Dine-in / Takeaway Order** | DENY | ALLOW | ALLOW | ALLOW | ALLOW | DENY | ALLOW |
| **Bump KDS Ticket (Prepare $\rightarrow$ Ready)** | DENY | ALLOW | ALLOW | ALLOW | DENY | ALLOW | DENY |
| **Mark Order Delivered / Served** | DENY | ALLOW | ALLOW | ALLOW | ALLOW | DENY | DENY |
| **Void / Cancel Unpaid Order** | DENY | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY |
| **Process Payment / Settle Invoice** | DENY | ALLOW | ALLOW | ALLOW | ALLOW | DENY | ALLOW |
| **Apply Manager Override Discount** | DENY | ALLOW | ALLOW | ALLOW | DENY | DENY | DENY |
| **Invite Staff / Manage Team Roster** | DENY | ALLOW | ALLOW | DENY | DENY | DENY | DENY |
| **Generate & Print Table QR Codes** | DENY | ALLOW | ALLOW | DENY | DENY | DENY | DENY |
| **Modify Tax / GST / Service Charge Rates**| DENY | ALLOW | DENY | DENY | DENY | DENY | DENY |
| **View Annual Revenue / Business Health**| DENY | ALLOW | ALLOW | DENY | DENY | DENY | DENY |
| **Provision New Restaurant Tenant** | ALLOW | DENY | DENY | DENY | DENY | DENY | DENY |
| **Suspend / Deactivate Restaurant Tenant**| ALLOW | DENY | DENY | DENY | DENY | DENY | DENY |

---

### 4. Multi-Tenant Isolation & Security Enforcement

#### 4.1 Tenant Scoping Mechanisms
1. **Firestore Hierarchical Isolation:**
   All operational data resides under `restaurants/{tenantId}/...`.
   Firestore security rules verify:
   ```javascript
   function isTenantStaff(tenantId) {
     return isAuth() && (
       isSuperAdmin() ||
       (userExists() && getUserData().get('tenantId', '') == tenantId && 
        getUserData().get('role', '') in ['super_admin', 'super-admin', 'owner', 'admin', 'manager', 'waiter', 'cashier', 'reception', 'kitchen', 'chef'])
     );
   }
   ```
2. **Client-Side Guard Enforcement (`WorkspaceGuard.tsx`):**
   * Inspects authenticated user's `tenantId` against active URL parameters.
   * If an authenticated waiter or owner attempts to access another tenant's URL (e.g. `/owner/orders` while belonging to a different `tenantId`), `WorkspaceGuard` intercepts the route and navigates to `/workspace-error`.
   * Diner accounts (`role === 'customer'`) are permitted to browse across public menus of different restaurants, but cannot query private collections (`transactions`, `staff`, `inventory`).
3. **Branch Isolation (`branchId`):**
   * Multi-branch franchises enforce branch isolation via `isBranchAllowed(branchId)`. Staff members assigned to a specific branch cannot modify orders or shift reports belonging to other branches.

---

### 5. Sensitive Operations Protection

1. **Staff Invitations:**
   * Generated only via serverless endpoint [`api/send-staff-invitation.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/send-staff-invitation.ts).
   * Requesting user must possess `owner` or `admin` role for the specified `tenantId`.
   * Invitation tokens expire after 48 hours and can only be used once.
2. **Order Financial Integrity:**
   * Client-side orders cannot declare self-determined totals. `api/orders/create.ts` re-computes subtotal, tax, and discount against canonical menu prices.
   * Customers cannot alter order financials via Firestore updates (`isValidCustomerOrderUpdate()` restricts customer modifications strictly to non-financial fields: `notes`, `specialInstructions`, `status = 'DINING_COMPLETED'`).
3. **Payment Verification:**
   * Razorpay payments require server-side signature verification with the secret key (`api/payments/verify.ts`). Fake transaction references or altered payment IDs are rejected.
