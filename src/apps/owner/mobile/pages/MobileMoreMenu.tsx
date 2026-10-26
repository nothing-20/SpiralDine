import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Store, 
  ArrowLeftRight,
  Users, 
  MessageSquareWarning,
  Star, 
  Tag,
  Megaphone,
  Bell,
  BarChart3, 
  Shield,
  Layers,
  CalendarCheck,
  UserCheck,
  Settings, 
  HelpCircle, 
  FileText, 
  LogOut, 
  ChevronRight,
  Power,
  Sparkles,
  Cpu,
  Target
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { useRestaurant } from '../../../../context/RestaurantContext';
import MobileOwnerHeader from '../components/MobileOwnerHeader';
import MobileCard from '../components/MobileCard';

export const MobileMoreMenu: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { activeRestaurant } = useRestaurant();
  const tenantId = user?.tenantId;

  const [isOpen, setIsOpen] = useState((activeRestaurant as any)?.isOpen ?? true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const toggleOperatingStatus = async () => {
    if (!tenantId) return;
    setUpdatingStatus(true);
    const nextState = !isOpen;
    try {
      const restDoc = doc(db, 'restaurants', tenantId);
      await updateDoc(restDoc, {
        isOpen: nextState,
        updatedAt: new Date().toISOString(),
      });
      setIsOpen(nextState);
    } catch (e) {
      console.warn('[MobileMoreMenu] Toggle error:', e);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (e) {
      console.error('[MobileMoreMenu] Logout error:', e);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7]">
      <MobileOwnerHeader />

      <div className="p-4 space-y-5 pb-24">
        {/* Operating Status Card */}
        <MobileCard className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isOpen ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'
            }`}>
              <Power className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#202124]">
                Accepting Orders: {isOpen ? 'OPEN' : 'CLOSED'}
              </div>
              <div className="text-[11px] text-[#707070]">
                {isOpen ? 'Diners can browse menu & place orders' : 'Ordering temporarily paused'}
              </div>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isOpen}
              disabled={updatingStatus}
              onChange={toggleOperatingStatus}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#16A34A]"></div>
          </label>
        </MobileCard>

        {/* Group A: Business Management */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider px-1">
            Group A: Business Management
          </h3>
          <div className="bg-white rounded-2xl border border-[#EBEBEB] divide-y divide-[#F5F5F5] overflow-hidden shadow-sm">
            <div
              onClick={() => navigate('/owner/restaurants')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Store className="w-4 h-4 text-[#FF7518]" />
                <div>
                  <div className="text-xs font-bold text-[#202124]">Restaurants & Branches</div>
                  <div className="text-[10px] text-[#707070]">Multi-unit locations & configuration</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/branch-transfers')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <ArrowLeftRight className="w-4 h-4 text-[#FF7518]" />
                <div>
                  <div className="text-xs font-bold text-[#202124]">Branch Inventory Transfers</div>
                  <div className="text-[10px] text-[#707070]">Stock requisitions, dispatch & receipts</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>
          </div>
        </div>

        {/* Group B: Customers & Engagement */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider px-1">
            Group B: Customers & Engagement
          </h3>
          <div className="bg-white rounded-2xl border border-[#EBEBEB] divide-y divide-[#F5F5F5] overflow-hidden shadow-sm">
            <div
              onClick={() => navigate('/owner/customers')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-[#2563EB]" />
                <div>
                  <div className="text-xs font-bold text-[#202124]">Customer CRM & Intelligence</div>
                  <div className="text-[10px] text-[#707070]">Diner profiles, visit habits & lifetime spend</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/feedback')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageSquareWarning className="w-4 h-4 text-[#DC2626]" />
                <div>
                  <div className="text-xs font-bold text-[#202124]">Customer Feedback & Complaints</div>
                  <div className="text-[10px] text-[#707070]">Service issues & resolution ticketing</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/reviews')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Star className="w-4 h-4 text-[#D97706]" />
                <div>
                  <div className="text-xs font-bold text-[#202124]">Customer Reviews</div>
                  <div className="text-[10px] text-[#707070]">Verified star ratings & recommendations</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>
          </div>
        </div>

        {/* Group C: Growth & Marketing */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider px-1">
            Group C: Growth & Marketing
          </h3>
          <div className="bg-white rounded-2xl border border-[#EBEBEB] divide-y divide-[#F5F5F5] overflow-hidden shadow-sm">
            <div
              onClick={() => navigate('/owner/promotions')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Tag className="w-4 h-4 text-[#7C3AED]" />
                <div>
                  <div className="text-xs font-bold text-[#202124]">Offers & Promotions</div>
                  <div className="text-[10px] text-[#707070]">Coupons, percentage discounts & deals</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/marketing')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Megaphone className="w-4 h-4 text-[#7C3AED]" />
                <div>
                  <div className="text-xs font-bold text-[#202124]">Marketing & Campaigns</div>
                  <div className="text-[10px] text-[#707070]">Audience targeting & campaign reach</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>
          </div>
        </div>

        {/* Group D: Operations & Insights */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider px-1">
            Group D: Operations & Insights
          </h3>
          <div className="bg-white rounded-2xl border border-[#EBEBEB] divide-y divide-[#F5F5F5] overflow-hidden shadow-sm">
            <div
              onClick={() => navigate('/owner/alerts')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-[#DC2626]" />
                <div>
                  <div className="text-xs font-bold text-[#202124]">Alerts & Notifications</div>
                  <div className="text-[10px] text-[#707070]">Critical events & operational alerts</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/reports')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-[#16A34A]" />
                <div>
                  <div className="text-xs font-bold text-[#202124]">Reports & Business Exports</div>
                  <div className="text-[10px] text-[#707070]">12 canonical financial, tax & order reports</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/audit-logs')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-[#202124]" />
                <div>
                  <div className="text-xs font-bold text-[#202124]">Audit Logs</div>
                  <div className="text-[10px] text-[#707070]">Security event trail & actor timestamps</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>
          </div>
        </div>

        {/* Group E: AI & Autonomous Operations */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider px-1">
            Group E: AI & Autonomous Operations
          </h3>
          <div className="bg-white rounded-2xl border border-[#EBEBEB] divide-y divide-[#F5F5F5] overflow-hidden shadow-sm">
            <div
              onClick={() => navigate('/owner/intelligence')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#202124]">AI Intelligence & Copilot</div>
                  <div className="text-[10px] text-[#707070]">Real-time recommendations & operational advice</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/automation')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#FAF5FF] flex items-center justify-center text-[#7C3AED]">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#202124]">Automation Center</div>
                  <div className="text-[10px] text-[#707070]">Autonomous trigger rules, scheduled cron & daily briefs</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/strategy')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#FFF4EE] flex items-center justify-center text-[#FF7518]">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#202124]">Strategy & Goals</div>
                  <div className="text-[10px] text-[#707070]">Business targets, growth milestones & playbooks</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>
          </div>
        </div>

        {/* Dining Operations & Settings */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-[#707070] uppercase tracking-wider px-1">
            Dining & Service Operations
          </h3>
          <div className="bg-white rounded-2xl border border-[#EBEBEB] divide-y divide-[#F5F5F5] overflow-hidden shadow-sm">
            <div
              onClick={() => navigate('/owner/tables')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-[#707070]" />
                <span className="text-xs font-bold text-[#202124]">Tables & Live Seating</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/reservations')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <CalendarCheck className="w-4 h-4 text-[#707070]" />
                <span className="text-xs font-bold text-[#202124]">Table Reservations & Waitlist</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/staff')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <UserCheck className="w-4 h-4 text-[#707070]" />
                <span className="text-xs font-bold text-[#202124]">Staff & Team Access</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/owner/settings')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-4 h-4 text-[#707070]" />
                <span className="text-xs font-bold text-[#202124]">Settings & Preferences</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/support')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-[#707070]" />
                <span className="text-xs font-bold text-[#202124]">Help & Support Center</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>

            <div
              onClick={() => navigate('/privacy')}
              className="p-3.5 flex items-center justify-between cursor-pointer active:bg-[#F9F9F9] transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-[#707070]" />
                <span className="text-xs font-bold text-[#202124]">Privacy Policy & Legal</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#9E9E9E]" />
            </div>
          </div>
        </div>

        {/* Sign Out Action */}
        <div className="pt-2">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full p-3.5 rounded-2xl bg-white border border-[#FCA5A5] text-[#DC2626] text-xs font-bold flex items-center justify-center gap-2 hover:bg-[#FEE2E2]/30 active:scale-[0.99] transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Workspace</span>
          </button>
        </div>

        <div className="text-center text-[10px] text-[#9E9E9E] pt-2">
          SpiralDine Restaurant OS • v1.0.0
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
                Are you sure you want to log out of your SpiralDine restaurant owner session?
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

export default MobileMoreMenu;
