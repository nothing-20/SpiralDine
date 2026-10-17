import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardRoute } from '../utils/navigation';

export const CustomerGuard: React.FC = () => {
  const { user, role, authStatus } = useAuth();
  const location = useLocation();

  if (authStatus === 'AUTH_LOADING' || authStatus === 'PROFILE_LOADING') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-primary animate-spin" />
        <span className="text-mutedAsh text-sm font-medium">Validating diner clearance...</span>
      </div>
    );
  }

  if (authStatus === 'UNAUTHORIZED' || !user || user.isAnonymous) {
    return <Navigate to="/customer/login" state={{ from: location }} replace />;
  }

  if (authStatus === 'PROFILE_MISSING' || !role) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (role !== 'customer') {
    const destination = getDashboardRoute(role);
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
};

export default CustomerGuard;
