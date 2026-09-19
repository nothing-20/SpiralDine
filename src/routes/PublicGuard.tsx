import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardRoute } from '../utils/navigation';

export const PublicGuard: React.FC = () => {
  const { user, role, authStatus } = useAuth();
  const location = useLocation();

  if (authStatus === 'AUTH_LOADING' || authStatus === 'PROFILE_LOADING') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-primary animate-spin" />
        <span className="text-mutedAsh text-sm font-medium">Loading session...</span>
      </div>
    );
  }

  // If already authenticated
  if (authStatus === 'AUTHORIZED' && user && role) {
    if (role === 'super_admin' || role === 'super-admin') {
      return <Navigate to="/super-admin/dashboard" replace />;
    }

    const isOwnerOrAdmin = ['owner', 'admin'].includes(role);
    const path = location.pathname;

    // If authenticated owner/admin visits owner login, go directly to owner dashboard
    if (isOwnerOrAdmin && (path === '/owner/login' || path === '/login')) {
      return <Navigate to="/owner/dashboard" replace />;
    }

    // If authenticated customer visits customer login, go to customer home
    if (role === 'customer' && path === '/customer/login') {
      return <Navigate to="/customer/home" replace />;
    }

    // Critical: If customer navigates to owner or staff login portal, do NOT trap them
    // and bounce them back to /customer/home. Let them enter owner credentials!
    if (role === 'customer' && (path === '/owner/login' || path === '/staff/login' || path === '/login')) {
      return <Outlet />;
    }

    const destination = getDashboardRoute(role);
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
};

export default PublicGuard;
