import React from 'react';
import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardRoute } from '../utils/navigation';
import OwnerGuard from './OwnerGuard';
import AdminGuard from './AdminGuard';
import CustomerGuard from './CustomerGuard';
import PublicGuard from './PublicGuard';
import WorkspaceGuard from './WorkspaceGuard';
import RoleGuard from './RoleGuard';
import AuthLayout from '../components/layout/AuthLayout';
import CustomerLayout from '../components/layout/CustomerLayout';
import LandingPage from '../features/landing-page/LandingPage';
import LoadingSpinner from '../components/ui/LoadingSpinner/LoadingSpinner';

const DashboardLayout = React.lazy(() => import('../components/layout/DashboardLayout'));

// Public Website Pages
const FeaturesPage = React.lazy(() => import('../features/public-pages/FeaturesPage'));
const PricingPage = React.lazy(() => import('../features/public-pages/PricingPage'));
const AboutPage = React.lazy(() => import('../features/public-pages/AboutPage'));
const ContactPage = React.lazy(() => import('../features/public-pages/ContactPage'));
const NotFoundPage = React.lazy(() => import('../features/public-pages/NotFoundPage'));
const PrivacyPage = React.lazy(() => import('../features/public-pages/PrivacyPage'));
const TermsPage = React.lazy(() => import('../features/public-pages/TermsPage'));
const RefundPolicyPage = React.lazy(() => import('../features/public-pages/RefundPolicyPage'));
const FAQPage = React.lazy(() => import('../features/public-pages/FAQPage'));
const CookiePolicyPage = React.lazy(() => import('../features/public-pages/CookiePolicyPage'));
const AccessibilityPage = React.lazy(() => import('../features/public-pages/AccessibilityPage'));
const AccountDeletionPage = React.lazy(() => import('../features/public-pages/AccountDeletionPage'));

// Authentication
const LoginForm = React.lazy(() => import('../features/auth/components/LoginForm'));
const StaffLogin = React.lazy(() => import('../features/auth/components/StaffLogin'));
const StaffActivate = React.lazy(() => import('../features/auth/components/StaffActivate'));
const WorkspaceError = React.lazy(() => import('../features/auth/components/WorkspaceError'));
const ApplicationPendingPage = React.lazy(() => import('../features/auth/components/ApplicationPendingPage'));
const RegisterForm = React.lazy(() => import('../features/auth/components/RegisterForm'));
const ForgotPasswordForm = React.lazy(() => import('../features/auth/components/ForgotPasswordForm'));
const VerifyEmail = React.lazy(() => import('../features/auth/components/VerifyEmail'));
const SessionExpired = React.lazy(() => import('../features/auth/components/SessionExpired'));
const Maintenance = React.lazy(() => import('../features/auth/components/Maintenance'));

// Owner
const MenuManagement = React.lazy(() => import('../apps/owner/pages/MenuManagement'));
const OwnerOverview = React.lazy(() => import('../apps/owner/pages/OwnerOverview'));
const OwnerStaffManager = React.lazy(() => import('../apps/owner/pages/OwnerStaffManager'));
const OwnerTablesManager = React.lazy(() => import('../apps/owner/pages/OwnerTablesManager'));
const OwnerInventoryManager = React.lazy(() => import('../apps/owner/pages/OwnerInventoryManager'));
const OwnerSettings = React.lazy(() => import('../apps/owner/pages/OwnerSettings'));
const OwnerBilling = React.lazy(() => import('../apps/owner/pages/OwnerBilling'));
const OwnerAnalytics = React.lazy(() => import('../apps/owner/pages/OwnerAnalytics'));
const OwnerAutomationCenter = React.lazy(() => import('../apps/owner/pages/OwnerAutomationCenter'));
const OwnerStrategyCenter = React.lazy(() => import('../apps/owner/pages/OwnerStrategyCenter'));
const OwnerIntelligence = React.lazy(() => import('../apps/owner/pages/OwnerIntelligence'));
const OwnerRestaurants = React.lazy(() => import('../apps/owner/pages/OwnerRestaurants'));
const OwnerReservations = React.lazy(() => import('../apps/owner/pages/OwnerReservations'));
const OwnerCustomers = React.lazy(() => import('../apps/owner/pages/OwnerCustomers'));
const OwnerFeedback = React.lazy(() => import('../apps/owner/pages/OwnerFeedback'));
const OwnerReviews = React.lazy(() => import('../apps/owner/pages/OwnerReviews'));
const OwnerMarketing = React.lazy(() => import('../apps/owner/pages/OwnerMarketing'));
const OwnerAlerts = React.lazy(() => import('../apps/owner/pages/OwnerAlerts'));
const OwnerReports = React.lazy(() => import('../apps/owner/pages/OwnerReports'));
const OwnerBranchTransfers = React.lazy(() => import('../apps/owner/pages/OwnerBranchTransfers'));
const OwnerAuditLogs = React.lazy(() => import('../apps/owner/pages/OwnerAuditLogs'));
const OwnerPromotions = React.lazy(() => import('../apps/owner/pages/OwnerPromotions'));

// Unified Responsive Owner Layout and Page Switchers
const ResponsiveOwnerLayout = React.lazy(() => import('../apps/owner/layouts/ResponsiveOwnerLayout'));
import {
  ResponsiveOwnerDashboard,
  ResponsiveOwnerOrders,
  ResponsiveOwnerOrderDetails,
  ResponsiveOwnerMenu,
  ResponsiveOwnerMenuAdd,
  ResponsiveOwnerMenuEdit,
  ResponsiveOwnerMenuCategories,
  ResponsiveOwnerBusiness,
  ResponsiveOwnerAnalytics,
  ResponsiveOwnerTables,
  ResponsiveOwnerStaff,
  ResponsiveOwnerPromotions,
  ResponsiveOwnerInventory,
  ResponsiveOwnerBilling,
  ResponsiveOwnerMore,
  ResponsiveOwnerSettings,
  ResponsiveOwnerLogin,
  LegacyOrderRedirect,
  LegacyMenuEditRedirect
} from '../apps/owner/pages/ResponsiveOwnerPages';

// Kitchen
const KitchenQueue = React.lazy(() => import('../apps/owner/kitchen/KitchenQueue'));
const KitchenInventoryPage = React.lazy(() => import('../apps/owner/kitchen/KitchenInventoryPage'));
const KitchenMenuControl = React.lazy(() => import('../apps/owner/kitchen/KitchenMenuControl'));
const KitchenOrderHistoryPage = React.lazy(() => import('../apps/owner/kitchen/KitchenOrderHistoryPage'));
const KitchenItemHistoryPage = React.lazy(() => import('../apps/owner/kitchen/KitchenItemHistoryPage'));
const KitchenChefPerformancePage = React.lazy(() => import('../apps/owner/kitchen/KitchenChefPerformancePage'));
const KitchenTimelinePage = React.lazy(() => import('../apps/owner/kitchen/KitchenTimelinePage'));
const KitchenSettingsPage = React.lazy(() => import('../apps/owner/kitchen/KitchenSettingsPage'));

// Waiter
const WaiterMatrix = React.lazy(() => import('../apps/owner/waiter/WaiterMatrix'));
const WaiterAlerts = React.lazy(() => import('../apps/owner/waiter/WaiterAlerts'));
const WaiterLiveOrdersPage = React.lazy(() => import('../apps/owner/waiter/WaiterLiveOrdersPage'));
const WaiterAssignedTablesPage = React.lazy(() => import('../apps/owner/waiter/WaiterAssignedTablesPage'));
const WaiterOrderHistoryPage = React.lazy(() => import('../apps/owner/waiter/WaiterOrderHistoryPage'));
const WaiterItemHistoryPage = React.lazy(() => import('../apps/owner/waiter/WaiterItemHistoryPage'));
const WaiterPerformancePage = React.lazy(() => import('../apps/owner/waiter/WaiterPerformancePage'));
const WaiterTimelinePage = React.lazy(() => import('../apps/owner/waiter/WaiterTimelinePage'));
const WaiterShiftReportPage = React.lazy(() => import('../apps/owner/waiter/WaiterShiftReportPage'));
const WaiterBillingPage = React.lazy(() => import('../apps/owner/waiter/WaiterBillingPage'));
const WaiterMenuAvailabilityPage = React.lazy(() => import('../apps/owner/waiter/WaiterMenuAvailabilityPage'));

// Super Admin
const SuperAdminLayout = React.lazy(() => import('../apps/super-admin/layouts/SuperAdminLayout'));
const SuperAdminLogin = React.lazy(() => import('../apps/super-admin/pages/SuperAdminLogin'));
const SuperAdminSetup = React.lazy(() => import('../apps/super-admin/pages/SuperAdminSetup'));
const SuperAdminOverview = React.lazy(() => import('../apps/super-admin/pages/SuperAdminOverview'));
const SuperAdminApplications = React.lazy(() => import('../apps/super-admin/pages/SuperAdminApplications'));
const SuperAdminRestaurants = React.lazy(() => import('../apps/super-admin/pages/SuperAdminRestaurants'));
const SuperAdminOwners = React.lazy(() => import('../apps/super-admin/pages/SuperAdminOwners'));
const SuperAdminCustomers = React.lazy(() => import('../apps/super-admin/pages/SuperAdminCustomers'));
const SuperAdminStaff = React.lazy(() => import('../apps/super-admin/pages/SuperAdminStaff'));
const SuperAdminOrders = React.lazy(() => import('../apps/super-admin/pages/SuperAdminOrders'));
const SuperAdminPayments = React.lazy(() => import('../apps/super-admin/pages/SuperAdminPayments'));
const SuperAdminSupport = React.lazy(() => import('../apps/super-admin/pages/SuperAdminSupport'));
const SuperAdminAnalytics = React.lazy(() => import('../apps/super-admin/pages/SuperAdminAnalytics'));
const SuperAdminAuditLogs = React.lazy(() => import('../apps/super-admin/pages/SuperAdminAuditLogs'));
const SuperAdminSettings = React.lazy(() => import('../apps/super-admin/pages/SuperAdminSettings'));
const SuperAdminComingSoon = React.lazy(() => import('../apps/super-admin/pages/SuperAdminComingSoon'));

// Customer
const CustomerHome = React.lazy(() => import('../apps/customer/pages/CustomerHome'));
const CustomerLogin = React.lazy(() => import('../apps/customer/pages/CustomerLogin'));
const CustomerRegister = React.lazy(() => import('../apps/customer/pages/CustomerRegister'));
const RestaurantDetails = React.lazy(() => import('../apps/customer/pages/RestaurantDetails'));
const CustomerMenu = React.lazy(() => import('../apps/customer/pages/CustomerMenu'));
const OrderTracking = React.lazy(() => import('../apps/customer/pages/OrderTracking'));
const CustomerFeedback = React.lazy(() => import('../apps/customer/pages/Feedback'));
const CustomerPortal = React.lazy(() => import('../apps/customer/pages/CustomerPortal'));
const CustomerWelcome = React.lazy(() => import('../apps/customer/pages/CustomerWelcome'));
const TableBooking = React.lazy(() => import('../apps/customer/pages/TableBooking'));
const CartPage = React.lazy(() => import('../apps/customer/pages/CartPage'));
const PaymentPage = React.lazy(() => import('../apps/customer/pages/PaymentPage'));
const ProfilePage = React.lazy(() => import('../apps/customer/pages/ProfilePage'));
const CustomerOrdersPage = React.lazy(() => import('../apps/customer/pages/CustomerOrdersPage'));
const DiscoverPage = React.lazy(() => import('../apps/customer/pages/DiscoverPage'));
const ActiveDiningSessionPage = React.lazy(() => import('../apps/customer/pages/ActiveDiningSessionPage'));

// Guard / wrapper for root customer page
const CustomerWelcomeRoute: React.FC = () => {
  const { user, role } = useAuth();
  if (user && role && role !== 'customer') {
    return <Navigate to={getDashboardRoute(role)} replace />;
  }
  return <CustomerWelcome />;
};

// Role-aware root redirect component
const RootRedirect: React.FC = () => {
  const { user, role, authStatus } = useAuth();

  if (authStatus === 'AUTH_LOADING' || authStatus === 'PROFILE_LOADING') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 space-y-4">
        <LoadingSpinner label="Authenticating session..." />
      </div>
    );
  }

  if (authStatus === 'PROFILE_MISSING') {
    return <Navigate to="/unauthorized" replace />;
  }

  if (authStatus === 'UNAUTHORIZED' || !user || !role) {
    return <LandingPage />;
  }

  const destination = getDashboardRoute(role);
  return <Navigate to={destination} replace />;
};

const ProfileErrorScreen: React.FC<{ message: string; onLogout: () => void }> = ({ message, onLogout }) => (
  <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none">
    <div className="max-w-md w-full glass-panel p-8 rounded-3xl border-red-900/50 bg-slate-900/60 space-y-6">
      <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mx-auto text-red-500">
        <span className="text-2xl font-bold">!</span>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-display font-extrabold text-textPearl">Profile Resolution Error</h2>
        <p className="text-xs text-slate-400 leading-relaxed font-semibold">{message}</p>
      </div>
      <button
        onClick={onLogout}
        className="w-full py-3 bg-red-500 hover:bg-red-600 text-slate-950 font-bold text-xs rounded-xl transition-all"
      >
        Sign Out & Try Again
      </button>
    </div>
  </div>
);

// Mock UI Pages (Operational Dashboards)
const ManagerDashboard: React.FC = () => (
  <div className="space-y-4 text-left">
    <h1 className="text-2xl font-display font-extrabold text-textPearl">Manager Workspace</h1>
    <div className="glass-panel p-6 rounded-2xl border border-slate-800/50">
      <p className="text-sm text-mutedAsh">Operational branch analytics and dashboard panels are loading...</p>
    </div>
  </div>
);

const CashierDashboard: React.FC = () => (
  <div className="space-y-4 text-left">
    <h1 className="text-2xl font-display font-extrabold text-textPearl">Cashier Desk</h1>
    <div className="glass-panel p-6 rounded-2xl border border-slate-800/50">
      <p className="text-sm text-mutedAsh">Point of sale and checkout billing panels are loading...</p>
    </div>
  </div>
);

const ReceptionDashboard: React.FC = () => (
  <div className="space-y-4 text-left">
    <h1 className="text-2xl font-display font-extrabold text-textPearl">Reception / Seating</h1>
    <div className="glass-panel p-6 rounded-2xl border border-slate-800/50">
      <p className="text-sm text-mutedAsh">Diner queue seating registries are loading...</p>
    </div>
  </div>
);

const AdminAnalytics: React.FC = () => (
  <div className="space-y-4">
    <h1 className="text-2xl font-display font-extrabold text-textPearl">Manager System Logs</h1>
    <div className="glass-panel p-6 rounded-2xl border-slate-800/50">
      <p className="text-sm text-mutedAsh">Branch configuration analytics.</p>
    </div>
  </div>
);

const AdminLogs: React.FC = () => (
  <div className="space-y-4">
    <h1 className="text-2xl font-display font-extrabold text-textPearl">Immutable Audit Trails</h1>
    <div className="glass-panel p-6 rounded-2xl border-slate-800/50">
      <p className="text-sm text-mutedAsh">Audit logs viewer.</p>
    </div>
  </div>
);

const Unauthorized: React.FC = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
    <h1 className="text-3xl font-display font-extrabold text-red-500">Access Denied</h1>
    <p className="text-mutedAsh mt-2 max-w-sm">Your security credentials do not grant permission to view this dashboard.</p>
    <Link to="/" className="mt-6 px-4 py-2 bg-primary text-background font-bold text-xs rounded-xl">Go Home</Link>
  </div>
);

const NotFound: React.FC = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
    <h1 className="text-3xl font-display font-extrabold text-primary">404 - Not Found</h1>
    <p className="text-mutedAsh mt-2">The route or workspace slug you entered does not exist.</p>
    <Link to="/" className="mt-6 px-4 py-2 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl">Go Home</Link>
  </div>
);

export const AppRoutes: React.FC = () => {
  const { profileError, logout } = useAuth();
  const isActivatingStaff = typeof window !== 'undefined' && window.location.pathname.startsWith('/staff/activate');

  if (profileError && !isActivatingStaff) {
    return <ProfileErrorScreen message={profileError} onLogout={logout} />;
  }

  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <LoadingSpinner label="Loading page..." />
      </div>
    }>
      <Routes>
        {/* 1. Public Front facing routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/privacy-policy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/terms-of-service" element={<TermsPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route path="/cancellation-policy" element={<RefundPolicyPage />} />
        <Route path="/cookie-policy" element={<CookiePolicyPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="/account-deletion" element={<AccountDeletionPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/help" element={<FAQPage />} />
        <Route path="/support" element={<FAQPage />} />
        <Route path="/customer" element={<CustomerWelcomeRoute />} />
        <Route path="/customer/dashboard" element={<Navigate to="/customer/home" replace />} />
        <Route path="/customer/restaurant/:tenantId/menu" element={<CustomerMenu />} />
        <Route path="/customer/restaurant/:tenantId/order/:orderId" element={<OrderTracking />} />
        <Route path="/customer/restaurant/:tenantId/order/:orderId/review" element={<CustomerFeedback />} />
        <Route path="/customer/restaurant/:tenantId/feedback" element={<CustomerFeedback />} />
        <Route path="/customer/restaurant/:tenantId/active-order" element={<ActiveDiningSessionPage />} />
        <Route path="/customer/restaurant/:tenantId/session" element={<ActiveDiningSessionPage />} />
        <Route path="/customer/active-order" element={<ActiveDiningSessionPage />} />
        <Route path="/customer/login" element={<CustomerLogin />} />
        <Route path="/customer/register" element={<CustomerRegister />} />
        {/* Staff activation — public, no auth guard needed (employee activates before they have an account) */}
        <Route path="/staff/activate" element={<StaffActivate />} />
        
        {/* Customer routes with layout */}
        <Route element={<CustomerLayout />}>
          {/* Public customer routes inside layout (accessible to guest diners and customers) */}
          <Route path="/customer/cart" element={<CartPage />} />
          <Route path="/customer/restaurant/:tenantId" element={<RestaurantDetails />} />
          
          {/* Protected customer routes requiring authentication */}
          <Route element={<CustomerGuard />}>
            <Route path="/customer/home" element={<CustomerHome />} />
            <Route path="/customer/explore" element={<DiscoverPage />} />
            <Route path="/customer/discover" element={<DiscoverPage />} />
            <Route path="/customer/restaurants" element={<Navigate to="/customer/home" replace />} />
            <Route path="/customer/booking" element={<TableBooking />} />
            <Route path="/customer/orders" element={<CustomerOrdersPage />} />
            <Route path="/customer/payment" element={<PaymentPage />} />
            <Route path="/customer/reservations" element={<Navigate to="/customer/profile?section=reservations" replace />} />
            <Route path="/customer/profile" element={<ProfilePage />} />
            <Route path="/customer/settings" element={<Navigate to="/customer/profile?section=settings" replace />} />
            <Route path="/customer/rewards" element={<Navigate to="/customer/profile?section=rewards" replace />} />
          </Route>
        </Route>
        
        {/* Backward compatibility redirects for operational staff login sub-routes */}
        <Route path="/waiter/login" element={<Navigate to="/staff/login" replace />} />
        <Route path="/kitchen/login" element={<Navigate to="/staff/login" replace />} />
        <Route path="/cashier/login" element={<Navigate to="/staff/login" replace />} />
        <Route path="/admin/login" element={<Navigate to="/staff/login" replace />} />

        {/* Super Admin Direct Administrative Login & Controlled Setup */}
        <Route path="/super-admin/login" element={<SuperAdminLogin />} />
        <Route path="/super-admin/setup" element={<SuperAdminSetup />} />

        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="/workspace-error" element={<WorkspaceError />} />
        <Route path="/application-pending" element={<ApplicationPendingPage />} />

        {/* 2. Public Auth sub-routes gated by PublicGuard redirect interceptor */}
        <Route element={<PublicGuard />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<ResponsiveOwnerLogin />} />
            <Route path="/owner/login" element={<ResponsiveOwnerLogin />} />
            <Route path="/owner/mobile/login" element={<Navigate to="/login" replace />} />
            <Route path="/staff/login" element={<StaffLogin />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/forgot-password" element={<ForgotPasswordForm />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/session-expired" element={<SessionExpired />} />
            <Route path="/maintenance" element={<Maintenance />} />
          </Route>
        </Route>

        {/* 3. Customer tables QR portal routes */}
        <Route path="/r/:tenantId/table/:tableId" element={<CustomerPortal />} />

        {/* 4. Protected B2B Restaurant Staff & Owner routes gated by Workspace Validation */}
        <Route element={<OwnerGuard />}>
          <Route element={<WorkspaceGuard />}>
            {/* Unified Responsive Owner Portal (Adapts automatically to Phone, Tablet, Laptop, and Desktop Viewports) */}
            <Route element={<RoleGuard allowedRoles={['owner', 'admin']} />}>
              <Route element={<ResponsiveOwnerLayout />}>
                {/* Canonical Owner Routes */}
                <Route path="/owner" element={<Navigate to="/owner/dashboard" replace />} />
                <Route path="/owner/dashboard" element={<ResponsiveOwnerDashboard />} />
                <Route path="/owner/orders" element={<ResponsiveOwnerOrders />} />
                <Route path="/owner/orders/:orderId" element={<ResponsiveOwnerOrderDetails />} />
                <Route path="/owner/menu" element={<ResponsiveOwnerMenu />} />
                <Route path="/owner/menu/add" element={<ResponsiveOwnerMenuAdd />} />
                <Route path="/owner/menu/edit/:itemId" element={<ResponsiveOwnerMenuEdit />} />
                <Route path="/owner/menu/categories" element={<ResponsiveOwnerMenuCategories />} />
                <Route path="/owner/categories" element={<ResponsiveOwnerMenuCategories />} />
                <Route path="/owner/business" element={<ResponsiveOwnerBusiness />} />
                <Route path="/owner/analytics" element={<ResponsiveOwnerAnalytics />} />
                <Route path="/owner/tables" element={<ResponsiveOwnerTables />} />
                <Route path="/owner/staff" element={<ResponsiveOwnerStaff />} />
                <Route path="/owner/promotions" element={<ResponsiveOwnerPromotions />} />
                <Route path="/owner/inventory" element={<ResponsiveOwnerInventory />} />
                <Route path="/owner/inventory/purchase-orders" element={<OwnerInventoryManager />} />
                <Route path="/owner/billing" element={<ResponsiveOwnerBilling />} />
                <Route path="/owner/more" element={<ResponsiveOwnerMore />} />
                <Route path="/owner/settings" element={<ResponsiveOwnerSettings />} />

                {/* Additional Desktop Owner Workspaces (Accessible and reflowed on all devices) */}
                <Route path="/owner/automation" element={<OwnerAutomationCenter />} />
                <Route path="/owner/strategy" element={<OwnerStrategyCenter />} />
                <Route path="/owner/intelligence" element={<OwnerIntelligence />} />
                <Route path="/owner/restaurants" element={<OwnerRestaurants />} />
                <Route path="/owner/reservations" element={<OwnerReservations />} />
                <Route path="/owner/customers" element={<OwnerCustomers />} />
                <Route path="/owner/feedback" element={<OwnerFeedback />} />
                <Route path="/owner/reviews" element={<OwnerReviews />} />
                <Route path="/owner/marketing" element={<OwnerMarketing />} />
                <Route path="/owner/alerts" element={<OwnerAlerts />} />
                <Route path="/owner/reports" element={<OwnerReports />} />
                <Route path="/owner/branch-transfers" element={<OwnerBranchTransfers />} />
                <Route path="/owner/audit-logs" element={<OwnerAuditLogs />} />

                {/* Legacy /dashboard/owner/* aliases -> redirect to canonical /owner/* */}
                <Route path="/dashboard/owner" element={<Navigate to="/owner/dashboard" replace />} />
                <Route path="/dashboard/owner/menu" element={<Navigate to="/owner/menu" replace />} />
                <Route path="/dashboard/owner/staff" element={<Navigate to="/owner/staff" replace />} />
                <Route path="/dashboard/owner/tables" element={<Navigate to="/owner/tables" replace />} />
                <Route path="/dashboard/owner/billing" element={<Navigate to="/owner/billing" replace />} />
                <Route path="/dashboard/owner/inventory" element={<Navigate to="/owner/inventory" replace />} />
                <Route path="/dashboard/owner/inventory/purchase-orders" element={<Navigate to="/owner/inventory/purchase-orders" replace />} />
                <Route path="/dashboard/owner/analytics" element={<Navigate to="/owner/analytics" replace />} />
                <Route path="/dashboard/owner/automation" element={<Navigate to="/owner/automation" replace />} />
                <Route path="/dashboard/owner/strategy" element={<Navigate to="/owner/strategy" replace />} />
                <Route path="/dashboard/owner/intelligence" element={<Navigate to="/owner/intelligence" replace />} />
                <Route path="/dashboard/owner/settings" element={<Navigate to="/owner/settings" replace />} />
                <Route path="/dashboard/owner/restaurants" element={<Navigate to="/owner/restaurants" replace />} />
                <Route path="/dashboard/owner/reservations" element={<Navigate to="/owner/reservations" replace />} />
                <Route path="/dashboard/owner/customers" element={<Navigate to="/owner/customers" replace />} />
                <Route path="/dashboard/owner/feedback" element={<Navigate to="/owner/feedback" replace />} />
                <Route path="/dashboard/owner/reviews" element={<Navigate to="/owner/reviews" replace />} />
                <Route path="/dashboard/owner/marketing" element={<Navigate to="/owner/marketing" replace />} />
                <Route path="/dashboard/owner/alerts" element={<Navigate to="/owner/alerts" replace />} />
                <Route path="/dashboard/owner/reports" element={<Navigate to="/owner/reports" replace />} />
                <Route path="/dashboard/owner/branch-transfers" element={<Navigate to="/owner/branch-transfers" replace />} />
                <Route path="/dashboard/owner/audit-logs" element={<Navigate to="/owner/audit-logs" replace />} />
                <Route path="/dashboard/owner/promotions" element={<Navigate to="/owner/promotions" replace />} />
              </Route>

              {/* Backward-compatible legacy /owner/mobile/* redirects */}
              <Route path="/owner/mobile" element={<Navigate to="/owner/dashboard" replace />} />
              <Route path="/owner/mobile/home" element={<Navigate to="/owner/dashboard" replace />} />
              <Route path="/owner/mobile/orders" element={<Navigate to="/owner/orders" replace />} />
              <Route path="/owner/mobile/orders/:orderId" element={<LegacyOrderRedirect />} />
              <Route path="/owner/mobile/menu" element={<Navigate to="/owner/menu" replace />} />
              <Route path="/owner/mobile/menu/add" element={<Navigate to="/owner/menu/add" replace />} />
              <Route path="/owner/mobile/menu/edit/:itemId" element={<LegacyMenuEditRedirect />} />
              <Route path="/owner/mobile/categories" element={<Navigate to="/owner/categories" replace />} />
              <Route path="/owner/mobile/business" element={<Navigate to="/owner/business" replace />} />
              <Route path="/owner/mobile/analytics" element={<Navigate to="/owner/analytics" replace />} />
              <Route path="/owner/mobile/tables" element={<Navigate to="/owner/tables" replace />} />
              <Route path="/owner/mobile/staff" element={<Navigate to="/owner/staff" replace />} />
              <Route path="/owner/mobile/promotions" element={<Navigate to="/owner/promotions" replace />} />
              <Route path="/owner/mobile/inventory" element={<Navigate to="/owner/inventory" replace />} />
              <Route path="/owner/mobile/billing" element={<Navigate to="/owner/billing" replace />} />
              <Route path="/owner/mobile/more" element={<Navigate to="/owner/more" replace />} />
              <Route path="/owner/mobile/settings" element={<Navigate to="/owner/settings" replace />} />
              <Route path="/owner/mobile/*" element={<Navigate to="/owner/dashboard" replace />} />
            </Route>

            {/* Existing Protected Staff Dashboard Layout (Kitchen, Waiter, Manager, Cashier, Reception) */}
            <Route element={<DashboardLayout />}>
              <Route element={<RoleGuard allowedRoles={['owner', 'admin', 'manager']} />}>
                <Route path="/dashboard/manager" element={<ManagerDashboard />} />
              </Route>

              {/* Cashier Dashboard */}
              <Route element={<RoleGuard allowedRoles={['owner', 'admin', 'manager', 'cashier']} />}>
                <Route path="/dashboard/cashier" element={<CashierDashboard />} />
              </Route>

              {/* Reception Dashboard */}
              <Route element={<RoleGuard allowedRoles={['owner', 'admin', 'manager', 'reception']} />}>
                <Route path="/dashboard/reception" element={<ReceptionDashboard />} />
              </Route>

              {/* Kitchen Dashboards */}
              <Route element={<RoleGuard allowedRoles={['owner', 'admin', 'manager', 'kitchen']} />}>
                <Route path="/dashboard/kitchen" element={<KitchenQueue />} />
                <Route path="/dashboard/kitchen/inventory" element={<KitchenInventoryPage />} />
                <Route path="/dashboard/kitchen/menu-control" element={<KitchenMenuControl />} />
                <Route path="/dashboard/kitchen/order-history" element={<KitchenOrderHistoryPage />} />
                <Route path="/dashboard/kitchen/item-history" element={<KitchenItemHistoryPage />} />
                <Route path="/dashboard/kitchen/chef-performance" element={<KitchenChefPerformancePage />} />
                <Route path="/dashboard/kitchen/timeline" element={<KitchenTimelinePage />} />
                <Route path="/dashboard/kitchen/settings" element={<KitchenSettingsPage />} />
              </Route>

              {/* Waiter Dashboards */}
              <Route element={<RoleGuard allowedRoles={['owner', 'admin', 'manager', 'waiter']} />}>
                <Route path="/dashboard/waiter" element={<WaiterMatrix />} />
                <Route path="/dashboard/waiter/alerts" element={<WaiterAlerts />} />
                <Route path="/dashboard/waiter/live-orders" element={<WaiterLiveOrdersPage />} />
                <Route path="/dashboard/waiter/menu-availability" element={<WaiterMenuAvailabilityPage />} />
                <Route path="/dashboard/waiter/orders" element={<Navigate to="/dashboard/waiter/live-orders" replace />} />
                <Route path="/dashboard/waiter/assigned-tables" element={<WaiterAssignedTablesPage />} />
                <Route path="/dashboard/waiter/order-history" element={<WaiterOrderHistoryPage />} />
                <Route path="/dashboard/waiter/item-history" element={<WaiterItemHistoryPage />} />
                <Route path="/dashboard/waiter/performance" element={<WaiterPerformancePage />} />
                <Route path="/dashboard/waiter/timeline" element={<WaiterTimelinePage />} />
                <Route path="/dashboard/waiter/kitchen-timeline" element={<Navigate to="/dashboard/waiter/timeline" replace />} />
                <Route path="/dashboard/waiter/tables" element={<Navigate to="/dashboard/waiter" replace />} />
                <Route path="/dashboard/waiter/matrix" element={<Navigate to="/dashboard/waiter" replace />} />
                <Route path="/dashboard/waiter/pos" element={<Navigate to="/dashboard/waiter/billing" replace />} />
                <Route path="/dashboard/waiter/shift-report" element={<WaiterShiftReportPage />} />
                <Route path="/dashboard/waiter/billing" element={<WaiterBillingPage />} />
              </Route>

              {/* Branch Admin/Logs Dashboards */}
              <Route element={<RoleGuard allowedRoles={['owner', 'admin']} />}>
                <Route path="/dashboard/admin" element={<AdminAnalytics />} />
                <Route path="/dashboard/admin/logs" element={<AdminLogs />} />
              </Route>
            </Route>
          </Route>
        </Route>

        {/* 5. Protected SaaS Super Admin routes */}
        <Route element={<AdminGuard />}>
          <Route element={<SuperAdminLayout />}>
            <Route path="/super-admin" element={<Navigate to="/super-admin/dashboard" replace />} />
            <Route path="/super-admin/dashboard" element={<SuperAdminOverview />} />
            <Route path="/super-admin/applications" element={<SuperAdminApplications />} />
            <Route path="/super-admin/restaurants" element={<SuperAdminRestaurants />} />
            <Route path="/super-admin/tenants" element={<Navigate to="/super-admin/restaurants" replace />} />
            <Route path="/super-admin/owners" element={<SuperAdminOwners />} />
            <Route path="/super-admin/customers" element={<SuperAdminCustomers />} />
            <Route path="/super-admin/staff" element={<SuperAdminStaff />} />
            <Route path="/super-admin/orders" element={<SuperAdminOrders />} />
            <Route path="/super-admin/payments" element={<SuperAdminPayments />} />
            <Route path="/super-admin/support" element={<SuperAdminSupport />} />
            <Route path="/super-admin/reports" element={<SuperAdminComingSoon title="Platform Reports" description="Comprehensive cross-tenant financial, operational, and inventory performance reports." />} />
            <Route path="/super-admin/analytics" element={<SuperAdminAnalytics />} />
            <Route path="/super-admin/audit-logs" element={<SuperAdminAuditLogs />} />
            <Route path="/super-admin/settings" element={<SuperAdminSettings />} />
          </Route>
        </Route>

        {/* 9. Catch-all 404 Route */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </React.Suspense>
  );
};
export default AppRoutes;
