# SpiralDine Web Application — End-to-End Workflows
## Document 03: End-to-End Business Workflows

This document models and traces the complete multi-actor, multi-tenant workflows across the SpiralDine web application from user inception to system fulfillment.

---

### Workflow 1: User & Staff Authentication Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Staff
    participant UI as Web Login / Activation UI
    participant Auth as Firebase Auth
    participant Guard as WorkspaceGuard / RoleGuard
    participant DB as Firestore (users & employees)

    User->>UI: Enters Credentials (Email & Password)
    UI->>Auth: signInWithEmailAndPassword()
    Auth-->>UI: Returns UserCredential (UID, Token)
    UI->>DB: Query users/{uid} for role & tenantId
    DB-->>UI: Returns User Profile Document
    UI->>Guard: Validate role, tenantId, & active status
    alt Valid Tenant & Active Staff
        Guard-->>UI: Grant Access
        UI-->>User: Navigate to authorized workspace (/owner/dashboard or /dashboard/kitchen)
    else Missing Tenant or Deactivated
        Guard-->>UI: DENY_WORKSPACE
        UI-->>User: Redirect to /workspace-error or /unauthorized
    end
```

#### Detailed Workflow Steps:
1. **Diner Registration & Session Restoration:**
   * Diner navigates to `/customer/register` or `/customer/login`.
   * Enters email/password or selects "Sign in with Google" (`signInWithPopup`).
   * On authentication success, `AuthContext` initializes listener on `users/{uid}`.
   * If user profile doesn't exist, a customer profile is committed with `{ role: 'customer', createdAt: serverTimestamp() }`.
   * `CustomerGuard` validates role and allows entry to `/customer/home`, `/customer/orders`, and `/customer/profile`.
2. **Staff Invitation & Cryptographic Onboarding:**
   * Owner opens `/owner/staff` and clicks "Invite Team Member".
   * Submits invite form (Name, Email, Role, Branch).
   * Client calls `/api/send-staff-invitation`. Serverless function generates HMAC token signed with server secret, writes document to `restaurants/{tenantId}/invitations/{token}`, and dispatches branded email via Resend API.
   * Employee clicks email link: `https://spiraldine.com/staff/activate?token=...`.
   * `/staff/activate` verifies token against `/api/verify-invitation`. Employee sets password.
   * System creates Firebase Auth user, assigns custom claims or writes `users/{uid}` with `{ role, tenantId, branchId }`, and transitions invitation state to `accepted`.
   * Staff member is automatically authenticated and routed to their work portal.
3. **Password Reset Flow:**
   * User navigates to `/forgot-password`, enters registered email address.
   * Client triggers `sendPasswordResetEmail(auth, email)`.
   * Firebase Auth delivers secure action link with OOB code.
   * User updates password and logs in.

---

### Workflow 2: Restaurant Discovery, Ordering & Payment (B2C)

```mermaid
sequenceDiagram
    autonumber
    actor Diner as Customer Diner
    participant Discovery as Discover Page (/customer/discover)
    participant Menu as Menu & Cart (/customer/cart)
    participant API as Serverless Order API (/api/orders/create)
    participant DB as Firestore
    participant Pay as Razorpay Gateway
    participant KDS as Kitchen KDS (/dashboard/kitchen)

    Diner->>Discovery: Browse restaurants & cuisines
    Discovery-->>Diner: Display restaurants list
    Diner->>Menu: Open restaurant menu & add dishes to cart
    Menu-->>Diner: Calculate subtotal, discounts, & GST
    Diner->>Menu: Proceed to Checkout (/customer/payment)
    Diner->>Pay: Submit online payment (UPI/Card)
    Pay-->>Diner: Payment Success (razorpay_payment_id)
    Diner->>API: POST /api/orders/create with order payload
    Note over API: Server validates item prices, stock, & taxes
    API->>DB: Commit order to restaurants/{tenantId}/orders/{orderId}
    API->>DB: Deduct inventory stock
    API-->>Diner: Return confirmed orderId
    DB--)KDS: Realtime onSnapshot fires new ticket alert
    Diner->>Diner: Redirect to Order Tracking (/order/{orderId})
```

#### Detailed Workflow Steps:
1. **Discovery & Item Selection:**
   * Diner searches by cuisine or geolocated distance on `/customer/discover`.
   * Clicks restaurant card $\rightarrow$ routes to `/customer/restaurant/:tenantId`.
   * Browses categories on `/customer/restaurant/:tenantId/menu`.
   * Selects dishes. If customizable, modal collects spice levels and add-ons.
   * Items added to `CartContext` stored in browser session.
2. **Checkout & Authoritative Order Validation:**
   * Diner reviews cart on `/customer/cart`, adds special kitchen instructions, applies promo code.
   * Navigates to `/customer/payment`. Chooses Dining Option (`Dine In`, `Takeaway`) and Payment Mode (`Online Gateway` or `Pay at Counter`).
   * If Online Payment: Razorpay SDK initiates modal. On capture, signature is verified.
   * Payload dispatched to `/api/orders/create`.
   * **Server-Side Security Check:** The backend retrieves live menu records from Firestore, re-calculates exact item costs, recalculates applicable percentage/fixed promo discounts, adds configured GST/service charge, and confirms transaction balance matches.
   * Order written to `restaurants/{tenantId}/orders/{orderId}` with status `PENDING`.
3. **Fulfillment & Real-Time Tracking:**
   * Kitchen line cooks receive real-time ticket on `KitchenQueue.tsx`.
   * Cook taps "Start Preparing" (status updates to `PREPARING`).
   * When cooking finishes, cook bumps ticket (status updates to `READY`).
   * Waiter delivers food to table (status updates to `SERVED`).
   * Customer tracking stepper on `/customer/restaurant/:tenantId/order/:orderId` synchronizes via Firestore `onSnapshot` without manual page reload.

---

### Workflow 3: Contactless QR Table Ordering

```mermaid
sequenceDiagram
    autonumber
    actor Diner as Guest Diner
    participant Camera as Physical Camera / QR Scanner
    participant Portal as QR Portal (/r/:tenantId/table/:tableId)
    participant Session as Active Table Session (/session)
    participant KDS as Kitchen Queue
    participant Waiter as Waiter Matrix & Billing

    Diner->>Camera: Scans table sticker QR code
    Camera->>Portal: Opens URL /r/{tenantId}/table/{tableNumber}
    Portal->>Session: Validates table & initializes active dining session
    Session-->>Diner: Displays table menu with auto-bound Table #
    Diner->>Session: Submits order ticket
    Session->>KDS: Commits order with tableNumber
    KDS-->>Waiter: Food ready alert on POS
    Diner->>Session: Taps "Request Bill" / "Call Waiter"
    Session->>Waiter: Emits table notification
    Waiter->>Waiter: Settles invoice in WaiterBillingPage
    Waiter-->>Session: Session closed, table marked AVAILABLE
```

#### Detailed Workflow Steps:
1. **QR Scanning & Validation:**
   * Diner scans sticker on table using native phone camera or web QR scanner (`QrScannerModal.tsx`).
   * Route `/r/:tenantId/table/:tableId` mounts [`CustomerPortal.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/CustomerPortal.tsx).
   * Validates `tenantId` exists in `restaurants` collection and table exists in `restaurants/{tenantId}/tables/{tableId}`.
   * Auto-binds table number into `CartContext` and sets dining option to `Dine-In`.
2. **Dining Session Maintenance:**
   * Diner orders multiple rounds of drinks or appetizers without re-entering details.
   * Live order status streams on [`ActiveDiningSessionPage.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/apps/customer/pages/ActiveDiningSessionPage.tsx).
   * Diner can tap "Call Waiter" (dispatches instant alert to `WaiterAlerts.tsx`) or "Request Bill".
   * Waiter brings POS terminal or accepts cash, marks bill settled on `WaiterBillingPage.tsx`, and closes the session.

---

### Workflow 4: Executive Owner Operations & Business Health

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Restaurant Owner
    participant Dash as Owner Dashboard (/owner/dashboard)
    participant Health as Business Health Engine (businessHealthService.ts)
    participant Annual as Annual Revenue Explorer
    participant DB as Firestore (transactions & orders)

    Owner->>Dash: Logs in & views Executive Overview
    Dash->>DB: Streams transactions, orders, inventory, ratings
    DB-->>Dash: Live database snapshots
    Dash->>Health: Executes calculateBusinessHealth()
    Note over Health: Evaluates 5 pillars: Revenue (25%), Ops (25%), CSAT (20%), Inventory (15%), Kitchen (15%)
    Health-->>Dash: Returns Health Score (out of 100) & dimensions
    Dash->>Annual: Computes Fiscal Year net revenue & monthly breakdown
    Owner->>Dash: Taps "Details" on Business Health Card
    Dash-->>Owner: Displays Architecture Breakdown Modal
    Owner->>Dash: Taps "Explore" on Annual Revenue Card
    Dash-->>Owner: Opens Fiscal Year Explorer Modal
```

#### Detailed Workflow Steps:
1. **Real-Time Data Compilation:**
   * Upon mounting, `OwnerOverview.tsx` (Desktop) or `MobileHomeDashboard.tsx` (Mobile) establishes real-time Firestore listeners for:
     * `restaurants/{tenantId}/transactions` (limit 500)
     * `restaurants/{tenantId}/orders` (limit 500)
     * `restaurants/{tenantId}/inventory`
     * `restaurants/{tenantId}/satisfactionRatings` (limit 100)
2. **Canonical Business Health Calculation:**
   * Reused service [`calculateBusinessHealth()`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/services/businessHealthService.ts) executes across 5 operational pillars:
     1. **Revenue Health (25%)**: 7-day transaction pace, gross revenue consistency, AOV integrity.
     2. **Operations Health (25%)**: Order completion rate vs cancellation rate, delayed orders.
     3. **Customer Health (20%)**: Diner CSAT survey ratings, sentiment averages.
     4. **Inventory Health (15%)**: Active ingredients count, out-of-stock / 86'd items.
     5. **Kitchen Health (15%)**: Preparation times against standard SLA targets.
   * If a dimension lacks minimum transaction history (e.g., $< 3$ orders), it is labeled `insufficient_data` and its baseline weight is dynamically renormalized so the owner's score is never penalized by missing historical data.
3. **Annual Revenue Explorer:**
   * Calculates current fiscal year based on April 1st boundary ($M \ge 3 \implies \text{Year}-\text{NextYear}$; $M < 3 \implies \text{PrevYear}-\text{Year}$).
   * Filters confirmed transactions to the selected FY window.
   * Computes Gross, Tax (GST), Net ($\text{Gross} - \text{Tax}$), and Average Monthly Revenue.
   * Maps 12 fiscal months (April through March) with percentage trend compared to the preceding month.

---

### Workflow 5: Staff Table Management & POS Billing (Waiter / Cashier)

```mermaid
sequenceDiagram
    autonumber
    actor Waiter as Floor Server / Waiter
    participant Matrix as Waiter Matrix (/dashboard/waiter)
    participant Billing as Waiter Billing (/dashboard/waiter/billing)
    participant DB as Firestore (tables, orders, bills)
    participant Printer as Print Bridge / Web Print

    Waiter->>Matrix: Views live floor plan
    Matrix-->>Waiter: Color-coded table status & live guest count
    Waiter->>Matrix: Selects table to open action sheet
    alt Take Order
        Waiter->>Matrix: Punches items for table & submits KOT
        Matrix->>DB: Writes new order with diningOption = Dine-In
        DB->>Printer: Generates Kitchen Order Ticket (KOT) print
    else Settle Bill
        Waiter->>Billing: Clicks "Generate Bill"
        Billing->>DB: Reads authentic order items & verifies totals
        Billing-->>Waiter: Displays Canonical Bill Modal
        Waiter->>Billing: Collects payment (Cash / Card / Split) & confirms settlement
        Billing->>DB: Updates paymentStatus = paid, marks table AVAILABLE
        Billing->>Printer: Prints Tax Invoice Receipt
    end
```

#### Detailed Workflow Steps:
1. **Floor Management:**
   * Server logs in at `/staff/login`, routes to `/dashboard/waiter`.
   * Floor matrix displays live table cards with assigned waiter badges and elapsed seating time.
2. **Order Taking & KOT Dispatch:**
   * Waiter taps table card, opens order taking modal.
   * Adds dishes requested verbally by guests.
   * Submitting writes order to `restaurants/{tenantId}/orders`.
   * Kitchen KDS chimes immediately.
3. **Canonical Bill Settlement:**
   * Waiter opens `WaiterBillingPage.tsx` or taps "Settle Bill".
   * System mounts [`CanonicalBillModal.tsx`](file:///c:/Users/Geetha%20Krishna/OneDrive/Desktop/Project%20Saas%20for%20all/src/shared/ui/billing/CanonicalBillModal.tsx).
   * Computes subtotal, GST (e.g. 5%), service charge (optional), and discounts.
   * Supports multi-tender payment: Cash, Card, UPI, or Split tender.
   * Commits invoice to `restaurants/{tenantId}/bills` and creates confirmed transaction record in `restaurants/{tenantId}/transactions`.
   * Marks table status back to `AVAILABLE`.
