import React from 'react';
import { useIsMobile } from '../../../hooks/useViewport';

// Mobile implementations
import MobileHomeDashboard from '../mobile/pages/MobileHomeDashboard';
import MobileOrdersList from '../mobile/pages/MobileOrdersList';
import MobileOrderDetails from '../mobile/pages/MobileOrderDetails';
import MobileMenuList from '../mobile/pages/MobileMenuList';
import MobileAddEditMenuItem from '../mobile/pages/MobileAddEditMenuItem';
import MobileMenuCategories from '../mobile/pages/MobileMenuCategories';
import MobileBusinessDashboard from '../mobile/pages/MobileBusinessDashboard';
import MobileAnalytics from '../mobile/pages/MobileAnalytics';
import MobileTablesQRCodes from '../mobile/pages/MobileTablesQRCodes';
import MobileStaffManagement from '../mobile/pages/MobileStaffManagement';
import MobilePromotions from '../mobile/pages/MobilePromotions';
import MobileInventory from '../mobile/pages/MobileInventory';
import MobileBilling from '../mobile/pages/MobileBilling';
import MobileMoreMenu from '../mobile/pages/MobileMoreMenu';
import MobileSettingsLegal from '../mobile/pages/MobileSettingsLegal';

// Desktop implementations
import OwnerOverview from './OwnerOverview';
import MenuManagement from './MenuManagement';
import OwnerTablesManager from './OwnerTablesManager';
import OwnerStaffManager from './OwnerStaffManager';
import OwnerInventoryManager from './OwnerInventoryManager';
import OwnerBilling from './OwnerBilling';
import OwnerAnalytics from './OwnerAnalytics';
import OwnerPromotions from './OwnerPromotions';
import OwnerSettings from './OwnerSettings';

// Responsive Home Dashboard (Canonical /owner/dashboard)
export const ResponsiveOwnerDashboard: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileHomeDashboard /> : <OwnerOverview />;
};

// Responsive Orders List (Canonical /owner/orders)
export const ResponsiveOwnerOrders: React.FC = () => {
  const isMobile = useIsMobile(768);
  if (isMobile) {
    return <MobileOrdersList />;
  }
  return (
    <div className="max-w-5xl mx-auto py-2">
      <MobileOrdersList />
    </div>
  );
};

// Responsive Order Details (Canonical /owner/orders/:orderId)
export const ResponsiveOwnerOrderDetails: React.FC = () => {
  const isMobile = useIsMobile(768);
  if (isMobile) {
    return <MobileOrderDetails />;
  }
  return (
    <div className="max-w-4xl mx-auto py-2">
      <MobileOrderDetails />
    </div>
  );
};

// Responsive Menu (Canonical /owner/menu)
export const ResponsiveOwnerMenu: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileMenuList /> : <MenuManagement />;
};

// Responsive Menu Add Item (Canonical /owner/menu/add)
export const ResponsiveOwnerMenuAdd: React.FC = () => {
  const isMobile = useIsMobile(768);
  if (isMobile) {
    return <MobileAddEditMenuItem />;
  }
  return (
    <div className="max-w-2xl mx-auto py-4">
      <MobileAddEditMenuItem />
    </div>
  );
};

// Responsive Menu Edit Item (Canonical /owner/menu/edit/:itemId)
export const ResponsiveOwnerMenuEdit: React.FC = () => {
  const isMobile = useIsMobile(768);
  if (isMobile) {
    return <MobileAddEditMenuItem />;
  }
  return (
    <div className="max-w-2xl mx-auto py-4">
      <MobileAddEditMenuItem />
    </div>
  );
};

// Responsive Menu Categories (Canonical /owner/categories or /owner/menu/categories)
export const ResponsiveOwnerMenuCategories: React.FC = () => {
  const isMobile = useIsMobile(768);
  if (isMobile) {
    return <MobileMenuCategories />;
  }
  return (
    <div className="max-w-3xl mx-auto py-4">
      <MobileMenuCategories />
    </div>
  );
};

// Responsive Business Dashboard (Canonical /owner/business)
export const ResponsiveOwnerBusiness: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileBusinessDashboard /> : <OwnerOverview />;
};

// Responsive Analytics (Canonical /owner/analytics)
export const ResponsiveOwnerAnalytics: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileAnalytics /> : <OwnerAnalytics />;
};

// Responsive Tables & QR (Canonical /owner/tables)
export const ResponsiveOwnerTables: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileTablesQRCodes /> : <OwnerTablesManager />;
};

// Responsive Staff (Canonical /owner/staff)
export const ResponsiveOwnerStaff: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileStaffManagement /> : <OwnerStaffManager />;
};

// Responsive Promotions (Canonical /owner/promotions)
export const ResponsiveOwnerPromotions: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobilePromotions /> : <OwnerPromotions />;
};

// Responsive Inventory (Canonical /owner/inventory)
export const ResponsiveOwnerInventory: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileInventory /> : <OwnerInventoryManager />;
};

// Responsive Billing (Canonical /owner/billing)
export const ResponsiveOwnerBilling: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileBilling /> : <OwnerBilling />;
};

// Responsive More Menu (Canonical /owner/more)
export const ResponsiveOwnerMore: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileMoreMenu /> : <OwnerSettings />;
};

// Responsive Settings & Legal (Canonical /owner/settings)
export const ResponsiveOwnerSettings: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileSettingsLegal /> : <OwnerSettings />;
};

// Responsive Login (Canonical /login and /owner/login)
const LoginForm = React.lazy(() => import('../../../features/auth/components/LoginForm'));
const MobileSplashLogin = React.lazy(() => import('../mobile/pages/MobileSplashLogin'));

export const ResponsiveOwnerLogin: React.FC = () => {
  const isMobile = useIsMobile(768);
  return isMobile ? <MobileSplashLogin /> : <LoginForm />;
};

// Safe legacy parameter redirects
import { useParams, Navigate } from 'react-router-dom';

export const LegacyOrderRedirect: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  return <Navigate to={`/owner/orders/${orderId || ''}`} replace />;
};

export const LegacyMenuEditRedirect: React.FC = () => {
  const { itemId } = useParams<{ itemId: string }>();
  return <Navigate to={`/owner/menu/edit/${itemId || ''}`} replace />;
};

