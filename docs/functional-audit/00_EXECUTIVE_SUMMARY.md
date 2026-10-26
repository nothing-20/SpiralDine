# SpiralDine Web Application — Comprehensive Functional Audit
## Document 00: Executive Summary

**Project:** SpiralDine Multi-Tenant Restaurant OS & Customer Dining Platform  
**Audit Date:** October 2026  
**Auditor:** Antigravity AI Senior Systems Architect & Security Engineering Team  
**Audit Purpose:** Comprehensive evidence-based functional audit of the entire existing web application to establish definitive behavioral specifications, business logic, calculations, and data architecture prior to implementing native Android feature parity.

---

### 1. Application Architecture & Technology Stack

The SpiralDine web application is an enterprise-grade multi-tenant Restaurant Operating System (B2B SaaS) coupled with an omni-channel Customer Dining & Discovery Portal (B2C).

* **Frontend Framework:** React `18.3.1` with TypeScript `5.2.2`.
* **Build System & Tooling:** Vite `5.3.1` with ES Modules (`"type": "module"`), PostCSS `8.4.38`, and Autoprefixer `10.4.19`.
* **Styling System:** TailwindCSS `3.4.4` customized with a rich design token system (Emerald/Terracotta brand palette, deep slate dark-mode panels, fluid glassmorphism, micro-animations, and responsive typography).
* **State Management:**
  * **Global / Auth / Multi-Tenant Contexts:** React Context API (`AuthContext`, `WorkspaceContext`, `RestaurantContext`, `TenantContext`, `CartContext`, `ThemeContext`, `CurrencyContext`).
  * **Specialized Client Stores:** Zustand `4.5.2` for offline/transient caching and Cart states.
* **Forms & Schema Validation:** React Hook Form `7.51.5` paired with Zod `3.23.8` schema validation (`src/utils/zodResolver.ts`).
* **Routing Architecture:** React Router DOM `6.23.1` utilizing hierarchical layout routes, code-split lazy loading (`React.lazy` + `Suspense`), and fine-grained authorization guards (`PublicGuard`, `CustomerGuard`, `OwnerGuard`, `WorkspaceGuard`, `RoleGuard`, `AdminGuard`).
* **Backend & Serverless Infrastructure:**
  * **Database:** Google Cloud Firestore (Multi-Tenant schema with tenant root isolation under `restaurants/{tenantId}/` and global index collections).
  * **Authentication:** Firebase Authentication (Email/Password, Google OAuth, Cryptographic Staff Invitation Tokens).
  * **Serverless Compute:** Vercel Serverless Functions (`api/` directory using `@vercel/node` and `firebase-admin 14.4.0` for authoritative order calculation, stock deduction, and payment verification).
  * **Email & Communications:** Resend API (`resend 6.18.0`) for transactional receipts, staff onboarding invitations, and booking confirmations.
  * **Payment Gateway:** Razorpay SDK integration with server-side HMAC-SHA256 signature verification (`api/payments/verify.ts`).

---

### 2. Major Application Areas & Portals

The SpiralDine codebase encompasses 6 distinct application sectors spanning **95+ unique routes**:

1. **Public Marketing & Legal Website:**
   * High-converting landing page (`/`), product features showcase (`/features`), tier pricing (`/pricing`), corporate about page (`/about`), lead generation contact page (`/contact`), and complete regulatory compliance documents (`/privacy`, `/terms`, `/refund-policy`, `/cookie-policy`, `/accessibility`, `/account-deletion`, `/faq`).
2. **Unified Authentication & Onboarding:**
   * Dual authentication pipelines: B2C Diner authentication (`/customer/login`, `/customer/register`) and B2B Staff/Owner authentication (`/login`, `/staff/login`, `/staff/activate`, `/super-admin/login`).
   * Password reset (`/forgot-password`), session expiration recovery (`/session-expired`), and email verification (`/verify-email`).
3. **Customer Dining & Discovery Portal (B2C):**
   * Geolocation restaurant discovery (`/customer/discover`), restaurant showcase & story (`/customer/restaurant/:tenantId`), interactive digital menu with allergens & dietary tagging (`/customer/restaurant/:tenantId/menu`).
   * Table reservation engine (`/customer/booking`), dynamic live cart (`/customer/cart`), checkout & gateway payment (`/customer/payment`).
   * Contactless QR Table Ordering (`/r/:tenantId/table/:tableId` $\rightarrow$ `CustomerPortal`), active table session sync (`/customer/session`), real-time kitchen progress order tracking (`/customer/restaurant/:tenantId/order/:orderId`), post-dining CSAT reviews (`/customer/feedback`), and diner profile & order history (`/customer/profile`).
4. **Owner Management & Operations Dashboard (B2B Executive):**
   * Unified responsive dashboard (`/owner/dashboard` $\leftrightarrow$ Desktop: `OwnerOverview`, Mobile: `MobileHomeDashboard`).
   * Live orders management (`/owner/orders`), menu & pricing manager (`/owner/menu`, `/owner/menu/add`, `/owner/menu/edit/:itemId`, `/owner/categories`).
   * Business health calculation engine (100-point scale across 5 operational dimensions), Annual Revenue Analysis (fiscal period boundaries, monthly breakdown, tax analytics).
   * QR table generation & floor mapping (`/owner/tables`), team roster & cryptographic staff invitation manager (`/owner/staff`), marketing & promo campaigns (`/owner/promotions`), real-time stock & inventory management (`/owner/inventory`, `/owner/inventory/purchase-orders`), tax invoices & cash register settlements (`/owner/billing`), AI intelligence & automation centers (`/owner/intelligence`, `/owner/automation`), reservations registry (`/owner/reservations`), branch transfers (`/owner/branch-transfers`), and audit logging (`/owner/audit-logs`).
5. **Kitchen Display System (KDS) & Waiter POS Portals (B2B Staff):**
   * **Kitchen / Chef KDS (`/dashboard/kitchen/*`):** Live KOT queue with SLA countdowns (`KitchenQueue`), menu 86'd stock controls (`KitchenMenuControl`), inventory batch tracking (`KitchenInventoryPage`), chef performance analytics (`KitchenChefPerformancePage`), preparation timeline audits (`KitchenTimelinePage`).
   * **Waiter POS (`/dashboard/waiter/*`):** Interactive floor matrix (`WaiterMatrix`), live service alerts (`WaiterAlerts`), assigned table tracking (`WaiterAssignedTablesPage`), table billing & invoice settlement (`WaiterBillingPage`), shift handover reports (`WaiterShiftReportPage`).
6. **SaaS Super Administrator Portal (`/super-admin/*`):**
   * Multi-tenant oversight (`SuperAdminOverview`), restaurant provisioning & onboarding (`SuperAdminRestaurants`), tenant owner management (`SuperAdminOwners`), cross-tenant customer & staff auditing (`SuperAdminCustomers`, `/super-admin/staff`), global order streams (`SuperAdminOrders`), payment processing audits (`SuperAdminPayments`), platform analytics (`SuperAdminAnalytics`), and administrative audit trails (`SuperAdminAuditLogs`).

---

### 3. Supported User Roles & Hierarchy

Role authorization is resolved through [`roleResolver.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/services/roleResolver.ts) and strictly enforced at both client navigation guards and Firestore backend security rules:

| User Role | Target Domain | Multi-Tenant Scoping | Primary Authorized Workspace |
| :--- | :--- | :--- | :--- |
| `super_admin` | Platform Owner | Global across all tenants | `/super-admin/dashboard` |
| `owner` | Restaurant Franchisee | Strict `tenantId` isolation | `/owner/dashboard` |
| `admin` | Branch General Manager | Strict `tenantId` + `branchId` | `/owner/dashboard` or `/dashboard/admin` |
| `manager` | Shift Operations Manager| Strict `tenantId` + `branchId` | `/dashboard/manager` & `/dashboard/waiter` |
| `kitchen` / `chef` | Culinary & Line Cooks | Strict `tenantId` + `branchId` | `/dashboard/kitchen` |
| `waiter` | Table Captains & Servers| Strict `tenantId` + `branchId` | `/dashboard/waiter` |
| `cashier` | Billing Desk Staff | Strict `tenantId` + `branchId` | `/dashboard/cashier` & `/dashboard/waiter/billing` |
| `reception` | Hostess & Front-of-House| Strict `tenantId` + `branchId` | `/dashboard/reception` & `/customer/booking` |
| `customer` | Guest & Registered Diner| Self-owned orders & profiles | `/customer/home` & `/r/:tenantId/table/:tableId` |

---

### 4. Existing Native Android Implementations

The repository contains two distinct native Android sub-projects configured in `android/settings.gradle.kts`:
1. **Android Customer Application (`:customer` in `android/customer/`):**
   * Package: `com.spiralworld.spiraldine`
   * Target SDK: 36 (Android 15), Min SDK: 24, Compose BOM `2024.06.00`.
   * Existing screens: `HomeScreen`, `ExploreScreen`, `RestaurantMenuScreen`, `CartScreen`, `BookingScreen`, `OrdersScreen`, `ReceiptScreen`, `ProfileScreen`, `QrScannerScreen`, `FavouritesScreen`, `NotificationsScreen`, `SplashScreen`.
2. **Android Owner Application (`:owner` in `android/owner/`):**
   * Package: `com.spiraldine.owner`
   * Target SDK: 36, Min SDK: 24, Compose BOM `2024.06.00`.
   * Existing screens: `OwnerHomeScreen`, `OwnerOrdersScreen`, `OwnerOrderDetailsScreen`, `OwnerMenuScreen`, `OwnerAddEditItemScreen`, `OwnerCategoriesScreen`, `OwnerBusinessScreen`, `OwnerAnalyticsScreen`, `OwnerTablesScreen`, `OwnerStaffScreen`, `OwnerPromotionsScreen`, `OwnerSettingsScreen`, `OwnerLoginScreen`, `OwnerMoreScreen`.

---

### 5. Critical Findings & Architectural Highlights

1. **Strict Financial Separation & Authoritative Order Engine:**
   * Orders created through `/api/orders/create` are calculated on the trusted serverless backend. Client total calculations are validated against authoritative item prices fetched from Firestore. Unauthorized client discounts or price manipulations are rejected.
2. **Canonical Paid Transactions vs Unpaid Orders:**
   * Both desktop `OwnerOverview.tsx` and `MobileHomeDashboard.tsx` derive actual gross/net revenue strictly from settled transaction records (`paymentStatus` in `['paid', 'completed', 'settled']` with valid positive totals), strictly filtering out cancelled, refunded, or voided transactions.
3. **Multi-Tenant Security Hardening:**
   * Firestore security rules (`firestore.rules`) enforce tenant isolation using `isTenantStaff(tenantId)`, `isTenantManager(tenantId)`, and `isBranchAllowed(branchId)` predicates.
   * Client context (`WorkspaceGuard.tsx`) blocks tenant hopping and ensures staff accounts belong to an active, registered restaurant.
4. **Fluid Viewport Responsiveness:**
   * The web application uses responsive layouts that adapt automatically across mobile ($320\text{px}$–$513\text{px}$), tablets ($768\text{px}$), laptops ($1024\text{px}$–$1440\text{px}$), and ultrawide monitors ($1920\text{px}$+) without requiring a segregated `/mobile` URL.

---

### 6. Scope & Limitations of this Functional Audit

* This audit is **read-only, non-destructive, and strictly analytical**.
* No production data was created, mutated, or removed.
* No application source files, security rules, database schemas, or routing structures were modified during this task.
* All findings are supported by static inspection of the actual source code, runtime test assertions, and build verifications.
