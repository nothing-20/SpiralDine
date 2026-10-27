import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardRoute } from '../utils/navigation';

export const OwnerGuard: React.FC = () => {
  const { user, role, authStatus } = useAuth();

  if (authStatus === 'AUTH_LOADING' || authStatus === 'PROFILE_LOADING') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-primary animate-spin" />
        <span className="text-mutedAsh text-sm font-medium">Validating merchant clearance...</span>
      </div>
    );
  }

  if (authStatus === 'UNAUTHORIZED' || !user) {
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/owner') || currentPath.startsWith('/dashboard/owner')) {
      return <Navigate to="/owner/login" replace />;
    }
    return <Navigate to="/staff/login" replace />;
  }

  if (authStatus === 'PROFILE_MISSING' || !role) {
    return <Navigate to="/unauthorized" replace />;
  }

  // A customer must never be able to access Owner Dashboard
  if (role === 'customer') {
    return <Navigate to="/customer/home" replace />;
  }

  // Pending, rejected, or more_info_required application applicants cannot access owner dashboard
  if (user?.status && ['pending_approval', 'rejected', 'more_info_required'].includes(user.status)) {
    return <Navigate to="/application-pending" replace />;
  }

  // Allowed roles for OwnerGuard: owner, admin, manager, waiter, kitchen, cashier, reception
  const allowedRoles = ['owner', 'admin', 'manager', 'waiter', 'kitchen', 'cashier', 'reception'];
  if (!allowedRoles.includes(role)) {
    const destination = getDashboardRoute(role);
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
};

export default OwnerGuard;
