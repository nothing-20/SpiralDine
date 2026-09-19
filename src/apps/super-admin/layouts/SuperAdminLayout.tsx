import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Contact2, 
  ChefHat, 
  Receipt, 
  CreditCard, 
  FileSpreadsheet, 
  TrendingUp, 
  ShieldCheck, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ShieldAlert
} from 'lucide-react';
import toast from 'react-hot-toast';

interface INavItem {
  to: string;
  label: string;
  icon: React.ComponentType<any>;
  badge?: string;
}

const navItems: INavItem[] = [
  { to: '/super-admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/super-admin/restaurants', label: 'Restaurants', icon: Building2 },
  { to: '/super-admin/owners', label: 'Owners', icon: Users },
  { to: '/super-admin/customers', label: 'Customers', icon: Contact2 },
  { to: '/super-admin/staff', label: 'Staff', icon: ChefHat },
  { to: '/super-admin/orders', label: 'Orders', icon: Receipt },
  { to: '/super-admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/super-admin/reports', label: 'Reports', icon: FileSpreadsheet, badge: 'Soon' },
  { to: '/super-admin/analytics', label: 'Platform Analytics', icon: TrendingUp, badge: 'Soon' },
  { to: '/super-admin/audit-logs', label: 'Audit Logs', icon: ShieldAlert, badge: 'Soon' },
  { to: '/super-admin/settings', label: 'Settings', icon: Settings, badge: 'Soon' },
];

export const SuperAdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out of Super Admin portal.');
      navigate('/super-admin/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
      navigate('/super-admin/login', { replace: true });
    }
  };

  return (
    <div className="flex h-screen bg-[#070B11] text-slate-100 overflow-hidden font-sans">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#0A0F17] border-r border-slate-800/70 flex flex-col transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-800/70 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="font-display font-bold text-sm tracking-tight text-white leading-tight">
                SpiralDine
              </div>
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                Super Admin
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isOverview = item.to === '/super-admin/dashboard';
            const isActive = isOverview 
              ? (location.pathname === '/super-admin/dashboard' || location.pathname === '/super-admin') 
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all
                  ${isActive 
                    ? 'bg-primary text-slate-950 font-bold shadow-md shadow-primary/10' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/70'
                  }
                `}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`
                    text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md
                    ${isActive 
                      ? 'bg-slate-950/20 text-slate-900' 
                      : 'bg-slate-900 text-slate-500 border border-slate-800'
                    }
                  `}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Info & Sign Out Footer */}
        <div className="p-3 border-t border-slate-800/70 bg-[#070B11]/50 shrink-0 space-y-2">
          <div className="px-2 py-1.5 flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-primary shrink-0">
              {(user?.displayName || user?.email || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">
                {user?.displayName || 'Super Admin'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-transparent hover:border-red-900/40 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800/70 px-4 lg:px-8 flex items-center justify-between bg-[#0A0F17]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-slate-300">Live Platform Session</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span>Role: <strong className="text-primary font-mono">super_admin</strong></span>
            </div>
          </div>
        </header>

        {/* Page View Outlet */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 lg:p-8 bg-[#070B11]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
