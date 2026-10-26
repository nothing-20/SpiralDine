# SpiralDine Web Application — Functional Specification
## Document 02: Screen-by-Screen Functional Specification

This specification documents the interactive elements, forms, event handlers, data queries, validation rules, error handling, and runtime behavior for each screen across the SpiralDine web application.

---

### Part 1: Public Marketing & Informational Screens

#### 1.1 Screen: Landing Page (`PUB-001` — Route: `/`)
* **Component Path:** [`src/features/landing-page/LandingPage.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/features/landing-page/LandingPage.tsx)
* **Preconditions:** Publicly accessible. Authenticated users hitting `/` are auto-redirected by `RootRedirect` in `AppRoutes.tsx` to their role dashboard (`/owner/dashboard`, `/customer/home`, `/dashboard/waiter`, etc.).
* **Interactive Elements:**
  * `LAND-NAV-001` (Navbar Link "Features"): `Link` to `/features`. Navigates to Features showcase. Works on mobile (hamburger menu).
  * `LAND-NAV-002` (Navbar Link "Pricing"): `Link` to `/pricing`. Navigates to subscription pricing comparison.
  * `LAND-NAV-003` (Navbar Link "About"): `Link` to `/about`. Navigates to company background.
  * `LAND-NAV-004` (Navbar Link "Contact"): `Link` to `/contact`. Navigates to sales inquiry form.
  * `LAND-BTN-001` (CTA "Start Free Trial" / "Get Started"): `button` navigating to `/register`.
  * `LAND-BTN-002` (Secondary CTA "Explore Dining" / "Find Restaurants"): `Link` to `/customer`. Launches customer portal gateway.
  * `LAND-BTN-003` (Header "Sign In" Button): `Link` to `/login`. Opens Owner/Staff authentication portal.
  * `LAND-FOOT-001` to `008` (Footer Legal Links): Clickable links to `/terms`, `/privacy`, `/refund-policy`, `/cookie-policy`, `/accessibility`, `/account-deletion`, `/faq`.
* **Data Read / Written:** Read-only marketing copy. No Firestore queries.
* **Loading / Empty States:** Instantaneous load; wrapped in Suspense fallback `<LoadingSpinner />`.
* **Mobile Web Responsiveness:** Tested on 320px, 375px, 430px. Hero typography scales fluidly; navigation collapses into an animated mobile drawer.

---

#### 1.2 Screen: Contact & Sales Inquiry (`PUB-005` — Route: `/contact`)
* **Component Path:** [`src/features/public-pages/ContactPage.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/features/public-pages/ContactPage.tsx)
* **Preconditions:** Publicly accessible.
* **Interactive Elements:**
  * `CONT-INPUT-001` ("Full Name"): `input[type="text"]`. Required. Validation: $\ge 2$ characters.
  * `CONT-INPUT-002` ("Work Email"): `input[type="email"]`. Required. Validates email format.
  * `CONT-INPUT-003` ("Restaurant / Business Name"): `input[type="text"]`. Required.
  * `CONT-SELECT-001` ("Inquiry Type"): `select` dropdown (`Sales & Pricing`, `Demo Request`, `Technical Support`, `Partnership`).
  * `CONT-TEXTAREA-001` ("Message"): `textarea`. Required. Minimum 10 characters.
  * `CONT-BTN-SUBMIT` ("Send Message"): `button[type="submit"]`.
    * **Action:** Submits POST payload to `/api/contact`.
    * **Success Behavior:** Clears form, displays green success banner ("Thank you for reaching out! Our team will contact you within 24 hours.").
    * **Error Behavior:** Catches network failure, renders toast error banner.
* **Backend Endpoint:** [`api/contact.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/contact.ts). Delivers notification email via Resend API.

---

### Part 2: Authentication & Onboarding Screens

#### 2.1 Screen: Owner / Admin Sign In (`AUTH-001` — Route: `/login`, `/owner/login`)
* **Component Path:** [`src/features/auth/components/LoginForm.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/features/auth/components/LoginForm.tsx) & [`ResponsiveOwnerPages.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/pages/ResponsiveOwnerPages.tsx)
* **Preconditions:** Unauthenticated. Gated by `PublicGuard` (authenticated owners automatically forwarded to `/owner/dashboard`).
* **Interactive Elements:**
  * `AUTH-INP-EMAIL` ("Email Address"): `input[type="email"]`. Validation: Zod `z.string().email()`. Sanitized against credential leakage in console logs.
  * `AUTH-INP-PASS` ("Password"): `input[type="password"]`. Required. Min 6 characters. Includes toggle visibility eye button (`AUTH-BTN-EYE`).
  * `AUTH-BTN-LOGIN` ("Sign In to Dashboard"): `button[type="submit"]`.
    * **Handler:** `signInWithEmailAndPassword(auth, email, password)`.
    * **Post-Auth Flow:** Triggers `AuthContext.tsx` onAuthStateChanged $\rightarrow$ fetches `users/{uid}` $\rightarrow$ runs `roleResolver.ts` $\rightarrow$ verifies `tenantId` $\rightarrow$ navigates to `/owner/dashboard`.
    * **Error Handling:** Firebase error codes `auth/user-not-found`, `auth/wrong-password`, `auth/invalid-credential` display user-facing message "Invalid email or password" without crashing.
  * `AUTH-LINK-FORGOT` ("Forgot Password?"): `Link` to `/forgot-password`.
  * `AUTH-LINK-REGISTER` ("Register your restaurant"): `Link` to `/register`.
  * `AUTH-LINK-STAFF` ("Staff Login"): Direct link to `/staff/login`.
* **Mobile Web Behavior:** Mobile layout uses single-column card with touch targets $\ge 48\text{px}$.

---

#### 2.2 Screen: Staff Invitation Activation (`AUTH-003` — Route: `/staff/activate`)
* **Component Path:** [`src/features/auth/components/StaffActivate.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/features/auth/components/StaffActivate.tsx)
* **Preconditions:** Invitee accesses URL containing query parameter `?token=<invitationToken>`.
* **Interactive Elements:**
  * `ACT-BANNER-INFO`: Displays invited restaurant name, assigned role (e.g., `waiter`, `kitchen`, `cashier`), and pre-filled email address.
  * `ACT-INP-NAME` ("Your Full Name"): `input[type="text"]`. Editable display name.
  * `ACT-INP-PASS` ("Create Password"): `input[type="password"]`. Validation: Min 8 chars, 1 uppercase, 1 digit.
  * `ACT-INP-CONFIRM` ("Confirm Password"): Matches password.
  * `ACT-BTN-ACTIVATE` ("Activate Account & Sign In"):
    * **Handler:** Validates token against `/api/verify-invitation` $\rightarrow$ creates Firebase Auth credentials $\rightarrow$ writes `users/{uid}` with assigned `role` and `tenantId` $\rightarrow$ marks `invitations/{id}` as accepted.
    * **Success Behavior:** Shows celebratory confirmation, signs user in, and forwards to designated staff workspace (`/dashboard/kitchen` for chefs, `/dashboard/waiter` for servers).

---

### Part 3: Customer Dining & Discovery Portal (B2C)

#### 3.1 Screen: Customer Home (`CUST-002` — Route: `/customer/home`)
* **Component Path:** [`src/apps/customer/pages/CustomerHome.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerHome.tsx)
* **Preconditions:** Authenticated `customer`.
* **Interactive Elements:**
  * `CUST-HOME-SEARCH` (Search Bar): `input[type="search"]` searching restaurants by name, dish, or cuisine tag. Debounced 300ms.
  * `CUST-HOME-LOC` (Location Dropdown): Allows selecting current dining city/neighborhood.
  * `CUST-HOME-SCAN` ("Scan Table QR"): Launches in-browser camera modal (`QrScannerModal.tsx`) using `jsqr` to scan physical QR codes.
  * `CUST-HOME-CARD-REST` (Restaurant Cards): Clickable cards displaying hero image, average rating, cuisine tags, delivery/dine-in status. Navigates to `/customer/restaurant/:tenantId`.
  * `CUST-HOME-BOOKING-BTN` ("Book a Table"): Direct quick-action navigating to `/customer/booking`.
  * `CUST-HOME-ACTIVE-ORDER`: Floating sticky notification banner displayed when the customer has an active dining session or uncompleted order. Navigates to `/customer/session` or `/order/:id`.
* **Data Sources:** Subscribes to Firestore collection `restaurants` (where `active == true`) and customer's recent orders `users/{uid}/orders`.

---

#### 3.2 Screen: Interactive Digital Menu (`CUST-005` — Route: `/customer/restaurant/:tenantId/menu`)
* **Component Path:** [`src/apps/customer/pages/CustomerMenu.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerMenu.tsx)
* **Interactive Elements:**
  * `MENU-CAT-TABS`: Horizontal scrolling category pills (`All`, `Starters`, `Mains`, `Breads`, `Desserts`, `Beverages`). Active tab highlights in brand emerald.
  * `MENU-FILTER-DIET`: Dietary toggles (`Pure Veg`, `Vegan`, `Gluten-Free`, `Chef Special`). Filters items instantly in client memory.
  * `MENU-ITEM-CARD`: Displays dish title, description, high-res image, price, allergen tags, and calories.
  * `MENU-BTN-ADD` ("Add to Cart"):
    * If dish has variants/modifiers: Opens `ItemCustomizerModal` with radio options (e.g., Spice Level: Mild / Medium / Spicy; Add-ons: Extra Cheese).
    * If simple dish: Dispatches directly to `CartContext`. Increments quantity badge.
  * `MENU-BTN-VIEW-CART`: Sticky bottom floating bar showing item count, total price, and "View Cart $\rightarrow$" button. Navigates to `/customer/cart`.
* **Data Sources:** Subscribes in real time to `restaurants/{tenantId}/menu/default/items` and `categories`. Items with `available == false` automatically show an "Out of Stock / 86'd" badge and disable the Add button.

---

#### 3.3 Screen: Shopping Cart & Checkout (`CUST-006` & `CUST-007` — Routes: `/customer/cart`, `/customer/payment`)
* **Component Paths:** [`src/apps/customer/pages/CartPage.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CartPage.tsx) & [`PaymentPage.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/PaymentPage.tsx)
* **Interactive Elements:**
  * `CART-QTY-INC` / `CART-QTY-DEC`: Updates item quantity; reducing below 1 prompts deletion confirmation.
  * `CART-INPUT-NOTES` ("Cooking Instructions / Special Requests"): `textarea` for allergy or preparation notes.
  * `CART-INPUT-COUPON` ("Promo Code"): `input[type="text"]` with "Apply" button. Validates code against `restaurants/{tenantId}/promotions`. Computes percentage/fixed discount.
  * `CART-BTN-CHECKOUT` ("Proceed to Checkout"): Navigates to `/customer/payment`.
  * `PAY-OPTION-DINEIN` / `PAY-OPTION-TAKEAWAY`: Radio buttons toggling dining option.
  * `PAY-INPUT-TABLE` ("Table Number"): Auto-populated if arrived from QR scan (`CustomerPortal`), or editable for dine-in.
  * `PAY-BTN-RAZORPAY` ("Pay via UPI / Card / NetBanking"): Initializes Razorpay checkout modal via `api/payments/create-order.ts`.
  * `PAY-BTN-COUNTER` ("Pay at Counter / Cash"): Submits order with `paymentStatus = "pending"`, navigates directly to Order Tracking.
* **Server-Side Verification:** Order creation dispatches to [`api/orders/create.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/orders/create.ts). Subtotals, taxes (GST), and discounts are verified server-side against Firestore before the order document is committed.

---

#### 3.4 Screen: Real-Time Order Tracking (`CUST-011` — Route: `/customer/restaurant/:tenantId/order/:orderId`)
* **Component Path:** [`src/apps/customer/pages/OrderTracking.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/OrderTracking.tsx)
* **Interactive Elements:**
  * `TRACK-STEPPER`: Real-time 5-stage graphical progress stepper driven by Firestore `onSnapshot`:
    1. **Order Placed**: Ticket acknowledged by backend.
    2. **Kitchen Preparing**: Cook accepted ticket on KDS.
    3. **Order Ready**: Bumped by line chef.
    4. **Served at Table / Out for Delivery**: Server marked delivered.
    5. **Completed**: Payment settled.
  * `TRACK-ESTIMATED-TIME`: Dynamic countdown timer derived from max item `prepTime`.
  * `TRACK-BTN-CALL-WAITER`: Sends urgent assistance alert to `restaurants/{tenantId}/alerts` (received instantly by servers on `WaiterAlerts.tsx`).
  * `TRACK-BTN-RECEIPT`: Opens digital receipt modal with breakdown of items, tax, and payment reference.
  * `TRACK-BTN-FEEDBACK`: Once status reaches `SERVED` or `COMPLETED`, prompts diner to complete 5-star review.

---

### Part 4: Owner Management & Operations Dashboard (B2B Executive)

#### 4.1 Screen: Unified Owner Dashboard (`OWN-001` — Route: `/owner/dashboard`)
* **Component Paths:** Desktop: [`src/apps/owner/pages/OwnerOverview.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/pages/OwnerOverview.tsx), Mobile: [`src/apps/owner/mobile/pages/MobileHomeDashboard.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/mobile/pages/MobileHomeDashboard.tsx)
* **Interactive Elements:**
  * `OWN-KPI-SALES` (Today's Sales Card): Displays total sales computed strictly from confirmed `paidTransactions` for today. Includes sparkline trend.
  * `OWN-KPI-ORDERS` (Total Orders Card): Total count of today's orders across all dining channels.
  * `OWN-KPI-HEALTH` (Business Health Card):
    * Displays overall score (out of 100), health classification label, data coverage %, and trend text.
    * Tapping card or "Details" button opens `isHealthModalOpen` modal.
    * Health details modal displays all 5 operational pillars (Revenue 25%, Operations 25%, Customers 20%, Inventory 15%, Kitchen 15%), baseline weights, scores, status, progress bars, explanations, and supporting metric badges.
  * `OWN-KPI-ANNUAL` (Annual Revenue Analysis Card):
    * Displays fiscal year (e.g. `FY 2026-27`), Net Revenue ($\text{Gross} - \text{GST}$), order count, and monthly average.
    * Tapping card or "View Annual Analysis" button opens the fiscal explorer displaying period selector (`FY 2026-27`, `FY 2025-26`, `FY 2024-25`), 6 macro metrics, and 12-month breakdown (April through March).
  * `OWN-QA-ORDERS` (Quick Action: Live Orders): Navigates to `/owner/orders`.
  * `OWN-QA-ADD-ITEM` (Quick Action: Add Item): Navigates to `/owner/menu/add`.
  * `OWN-QA-TABLES` (Quick Action: QR Tables): Navigates to `/owner/tables`.
  * `OWN-QA-ANALYTICS` (Quick Action: Analytics): Navigates to `/owner/analytics`.
  * `OWN-QA-STAFF` (Quick Action: Manage Staff): Navigates to `/owner/staff`.
  * `OWN-ALERT-ATTENTION`: Needs Your Attention banner indicating pending orders needing kitchen action or unavailable menu items.
  * `OWN-FEED-ORDERS`: Real-time streaming list of incoming live orders with status badges and quick view actions.

---

#### 4.2 Screen: Menu Management & Item Editor (`OWN-004`, `OWN-005`, `OWN-006` — Routes: `/owner/menu/*`)
* **Component Path:** [`src/apps/owner/pages/MenuManagement.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/pages/MenuManagement.tsx)
* **Interactive Elements:**
  * `MENU-BTN-ADD-NEW`: Navigates to `/owner/menu/add`.
  * `MENU-SEARCH-INPUT`: Filters dish catalog by title, ingredient, or category.
  * `MENU-TOGGLE-AVAIL`: Instant toggle switch updating Firestore `available` field (`updateDoc`). Synchronizes immediately with customer menus and kitchen bump screens.
  * `MENU-BTN-EDIT`: Navigates to `/owner/menu/edit/:itemId`.
  * `MENU-BTN-DELETE`: Prompts confirmation dialog before deleting dish record.
  * `MENU-FORM-INPUTS` (Add/Edit Form):
    * Dish Name (`input[type="text"]`, required).
    * Category (`select` linked to `menu/default/categories`).
    * Price (`input[type="number"]`, required, $> 0$).
    * Type (`radio`: Veg, Non-Veg, Vegan).
    * Preparation Time (`input[type="number"]` in minutes, used by kitchen SLAs).
    * Image Upload (`input[type="file"]`, uploads to Firebase Storage `restaurants/{tenantId}/menu/` via [`storageService.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/services/storageService.ts)).
    * Description (`textarea`).
    * Save Button: Writes document to `restaurants/{tenantId}/menu/default/items`.

---

#### 4.3 Screen: Table & QR Floor Management (`OWN-008` — Route: `/owner/tables`)
* **Component Path:** [`src/apps/owner/pages/OwnerTablesManager.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/pages/OwnerTablesManager.tsx)
* **Interactive Elements:**
  * `TAB-BTN-ADD`: Opens modal to define Table Number, Seating Capacity, and Section (Main Hall, Patio, VIP).
  * `TAB-CARD`: Displays live table occupancy (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `BILLING`), active diner count, and elapsed dining duration.
  * `TAB-BTN-QR`: Generates SVG/PNG QR code encoding URL:
    `https://spiraldine.com/r/{tenantId}/table/{tableNumber}`
  * `TAB-BTN-PRINT`: Triggers browser print window for professional high-res table display stand cards.
  * `TAB-TOGGLE-STATUS`: Manual status override for servers and hosts.

---

#### 4.4 Screen: Staff & Team Roster Manager (`OWN-009` — Route: `/owner/staff`)
* **Component Path:** [`src/apps/owner/pages/OwnerStaffManager.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/pages/OwnerStaffManager.tsx)
* **Interactive Elements:**
  * `STAFF-BTN-INVITE`: Opens "Invite New Team Member" modal.
    * Fields: Full Name, Email Address, Role (`manager`, `waiter`, `kitchen`, `cashier`, `reception`), Assigned Branch.
    * Submission Handler: Calls [`api/send-staff-invitation.ts`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/api/send-staff-invitation.ts), generating cryptographically signed HMAC token and sending invitation email with activation link `/staff/activate?token=...`.
  * `STAFF-TOGGLE-ACTIVE`: Enables or disables employee system access. Deactivation immediately revokes workspace access in `WorkspaceGuard.tsx`.
  * `STAFF-FILTER-ROLE`: Filter staff roster by role pills (`All`, `Waiters`, `Kitchen Staff`, `Cashiers`).

---

### Part 5: Kitchen KDS & Waiter POS Workspaces

#### 5.1 Screen: Kitchen Live Queue KDS (`KDS-001` — Route: `/dashboard/kitchen`)
* **Component Path:** [`src/apps/owner/kitchen/KitchenQueue.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/kitchen/KitchenQueue.tsx)
* **Interactive Elements:**
  * `KDS-TICKET-CARD`: Live order ticket displaying ticket number, table number, order time, elapsed countdown timer, and items list with custom cooking notes.
  * `KDS-BTN-PREPARE` ("Start Preparing"): Updates order status to `PREPARING` in Firestore. Changes ticket card accent to amber.
  * `KDS-BTN-BUMP` ("Ready to Serve"): Updates order status to `READY`. Triggers audio chime on Waiter Alerts screen.
  * `KDS-ITEM-STRIKE`: Allows line cooks to check off individual items within a large ticket as they are plated.
  * `KDS-BTN-RECALL`: Recalls the last bumped ticket within 60 seconds if marked ready by mistake.

---

#### 5.2 Screen: Waiter Table Matrix & Floor POS (`POS-001` — Route: `/dashboard/waiter`)
* **Component Path:** [`src/apps/owner/waiter/WaiterMatrix.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/owner/waiter/WaiterMatrix.tsx)
* **Interactive Elements:**
  * `POS-TABLE-GRID`: Visual floor plan. Color coded: Green = Free, Blue = Seated, Orange = Food Ready, Purple = Bill Requested.
  * `POS-BTN-TAKE-ORDER`: Opens order taking modal allowing waiter to punch items on behalf of diners.
  * `POS-BTN-BILL`: Opens `CanonicalBillModal` to review itemized charges, calculate discounts, and trigger cash/card settlement.
  * `POS-BTN-CALLS`: Bell icon with badge displaying customer assistance calls from table QR sessions.

---

### Part 6: SaaS Platform Super Administration

#### 6.1 Screen: Super Admin Overview (`ADM-001` — Route: `/super-admin/dashboard`)
* **Component Path:** [`src/apps/super-admin/pages/SuperAdminOverview.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/super-admin/pages/SuperAdminOverview.tsx)
* **Preconditions:** Gated by `AdminGuard` (verifies `isSuperAdmin()`).
* **Interactive Elements:**
  * `SADM-KPI-TENANTS`: Total provisioned restaurants.
  * `SADM-KPI-REVENUE`: Global platform gross sales volume.
  * `SADM-KPI-ORDERS`: Total platform orders processed today.
  * `SADM-TABLE-TENANTS`: Live table of restaurants with status pills (`Active`, `Suspended`, `Pending Setup`), plan tiers, and "Manage" action.
  * `SADM-BTN-PROVISION`: Opens modal to onboard and initialize a new restaurant franchise tenant.
