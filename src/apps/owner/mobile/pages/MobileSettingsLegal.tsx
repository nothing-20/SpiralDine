import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Store, 
  Bell, 
  ShieldCheck, 
  Lock, 
  FileText, 
  ExternalLink, 
  LogOut,
  ChevronRight,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { useRestaurant } from '../../../../context/RestaurantContext';
import { useCurrency } from '../../../../context/CurrencyContext';
import MobileCard from '../components/MobileCard';

export const MobileSettingsLegal: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeRestaurant } = useRestaurant();
  const { currency, currencySymbol } = useCurrency();

  const [orderNotifications, setOrderNotifications] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (e) {
      console.error('[MobileSettingsLegal] Logout error:', e);
    }
  };

  const legalLinks = [
    { title: 'Terms of Service', path: '/terms' },
    { title: 'Privacy Policy', path: '/privacy' },
    { title: 'Refund & Cancellation Policy', path: '/refund-policy' },
    { title: 'Accessibility Statement', path: '/accessibility' },
    { title: 'Cookie Policy', path: '/cookie-policy' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/more')}
          className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB]"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <h1 className="font-extrabold text-sm text-[#202124]">Settings & Legal</h1>

        <div className="w-9" />
      </header>

      <div className="p-4 space-y-4">
        {/* User Account / Identity Card */}
        <MobileCard className="space-y-3">
          <div className="flex items-center gap-3">
            {((user as any)?.photoURL || (user as any)?.photoUrl) ? (
              <img
                src={(user as any)?.photoURL || (user as any)?.photoUrl}
                alt={user?.displayName || 'User Avatar'}
                className="w-12 h-12 rounded-2xl object-cover ring-4 ring-[#FFF4EE]"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FF7518] to-[#FF5500] text-white font-extrabold text-base flex items-center justify-center ring-4 ring-[#FFF4EE] shadow-sm">
                {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-sm text-[#202124] truncate">
                {user?.displayName || (user?.email ? user.email.split('@')[0] : 'Authorized User')}
              </h2>
              <p className="text-xs text-[#707070] truncate font-medium">
                {user?.email || 'No account email'}
              </p>
              <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[#FFF4EE] text-[#FF7518] text-[10px] font-bold">
                <ShieldCheck className="w-3 h-3" />
                <span>
                  {user?.role === 'owner' ? 'Verified Workspace Owner' :
                   user?.role === 'manager' ? 'Verified Manager' :
                   user?.role === 'kitchen' ? 'Verified Kitchen Staff' :
                   user?.role === 'waiter' ? 'Verified Service Staff' :
                   user?.role === 'cashier' ? 'Verified Billing Staff' :
                   user?.role ? `Verified ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}` : 'Verified Account'}
                </span>
              </div>
            </div>
          </div>
        </MobileCard>

        {/* Restaurant Association Card */}
        <MobileCard className="space-y-2.5">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider">Restaurant Association</h3>
          <div className="divide-y divide-[#F5F5F5] text-xs">
            <div className="py-2 flex justify-between">
              <span className="text-[#707070]">Restaurant Name</span>
              <span className="font-bold text-[#202124]">{activeRestaurant?.name || 'SpiralDine Restaurant'}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-[#707070]">Branch</span>
              <span className="font-bold text-[#202124]">{(activeRestaurant as any)?.branch || (activeRestaurant as any)?.branchName || 'Main Dining'}</span>
            </div>
            <div className="py-2 flex justify-between">
              <span className="text-[#707070]">Operating Currency</span>
              <span className="font-bold text-[#202124]">{currency || 'INR'} ({currencySymbol || '₹'})</span>
            </div>
          </div>
        </MobileCard>

        {/* Notification Preferences */}
        <MobileCard className="space-y-3">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider">Notification Preferences</h3>
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-[#202124]">Live Order Push Alerts</div>
                <div className="text-[11px] text-[#707070]">Notify for new incoming diner orders</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={orderNotifications}
                  onChange={(e) => setOrderNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF7518]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F5]">
              <div>
                <div className="text-xs font-bold text-[#202124]">Audio Bell Alerts</div>
                <div className="text-[11px] text-[#707070]">Chime when a kitchen order is placed</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={soundAlerts}
                  onChange={(e) => setSoundAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF7518]"></div>
              </label>
            </div>
          </div>
        </MobileCard>

        {/* Legal Policies */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider px-1">
            Policies & Legal Terms
          </h3>
          <div className="bg-white rounded-2xl border border-[#EBEBEB] divide-y divide-[#F5F5F5] overflow-hidden shadow-sm">
            {legalLinks.map((item, idx) => (
              <div
                key={idx}
                onClick={() => navigate(item.path)}
                className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
              >
                <span className="text-xs font-medium text-[#202124]">{item.title}</span>
                <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
              </div>
            ))}
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="pt-2">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full p-3.5 rounded-2xl bg-white border border-[#FCA5A5] text-[#DC2626] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#FEE2E2]/30 active:scale-[0.99] transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 space-y-3 shadow-xl">
            <div className="w-10 h-10 rounded-2xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center mx-auto">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-sm text-[#202124]">Sign Out?</h3>
              <p className="text-xs text-[#707070] mt-1">
                Are you sure you want to end your current session?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-bold"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileSettingsLegal;
