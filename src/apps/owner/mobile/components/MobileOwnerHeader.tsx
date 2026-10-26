import React, { useState, useEffect } from 'react';
import { Bell, ChevronRight, Store, ChevronDown, Check, MapPin, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { useRestaurant } from '../../../../context/RestaurantContext';

interface IBranchRecord {
  id: string;
  name: string;
  city?: string;
  isDefault?: boolean;
  address?: string;
}

interface MobileOwnerHeaderProps {
  title?: string;
  subtitle?: string;
  showRestaurantInfo?: boolean;
  onNotificationsClick?: () => void;
  onProfileClick?: () => void;
  unreadCount?: number;
}

export const MobileOwnerHeader: React.FC<MobileOwnerHeaderProps> = ({
  title,
  subtitle,
  showRestaurantInfo = true,
  onNotificationsClick,
  onProfileClick,
  unreadCount = 2,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeRestaurant } = useRestaurant();
  const tenantId = user?.tenantId;

  const [branches, setBranches] = useState<IBranchRecord[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    return localStorage.getItem('spiraldine_active_branch_id') || '';
  });
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

  // Subscribe to real-time branches collection for multi-branch restaurants
  useEffect(() => {
    if (!tenantId) return;

    try {
      const branchesCol = collection(db, 'restaurants', tenantId, 'branches');
      const unsub = onSnapshot(branchesCol, (snap) => {
        const list: IBranchRecord[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as IBranchRecord);
        });
        setBranches(list);

        // Auto-select default if none selected
        if (!selectedBranchId && list.length > 0) {
          const defaultBranch = list.find(b => b.isDefault) || list[0];
          setSelectedBranchId(defaultBranch.id);
        }
      }, (err) => {
        console.warn('[MobileOwnerHeader] Branches listener notice:', err);
      });

      return () => unsub();
    } catch (e) {
      console.warn('[MobileOwnerHeader] Error setting up branches listener:', e);
    }
  }, [tenantId]);

  const restaurantName = activeRestaurant?.name || 'SpiralDine Restaurant';
  const isOpen = (activeRestaurant as any)?.isOpen ?? true;

  // Derive active branch label
  const activeBranch = branches.find(b => b.id === selectedBranchId);
  const restaurantCity = (activeRestaurant as any)?.city || (activeRestaurant as any)?.address?.city;
  const branchName = activeBranch?.name || (activeRestaurant as any)?.branch || (restaurantCity ? `${restaurantCity} Branch` : 'Main Dining');

  const handleSelectBranch = (branch: IBranchRecord) => {
    setSelectedBranchId(branch.id);
    localStorage.setItem('spiraldine_active_branch_id', branch.id);
    setIsBranchDropdownOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 select-none shadow-xs">
        <div className="flex items-center justify-between">
          {showRestaurantInfo ? (
            <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
              <div 
                onClick={() => navigate('/owner/more')}
                className="w-10 h-10 rounded-xl bg-[#FFF4EE] border border-[#FFE0CE] flex items-center justify-center flex-shrink-0 text-[#FF7518] cursor-pointer active:scale-95 transition-transform"
                title="Restaurant Hub"
              >
                <Store className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div 
                  onClick={() => navigate('/owner/more')}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <h1 className="font-bold text-[15px] text-[#202124] truncate leading-tight">
                    {restaurantName}
                  </h1>
                  <ChevronRight className="w-3.5 h-3.5 text-[#9E9E9E] flex-shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {/* Dynamic Branch Switcher trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      if (branches.length > 0) {
                        setIsBranchDropdownOpen(!isBranchDropdownOpen);
                      }
                    }}
                    className={`inline-flex items-center gap-1 text-[11px] font-medium text-[#707070] truncate ${
                      branches.length > 0 ? 'hover:text-[#FF7518] cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span className="truncate max-w-[120px]">{branchName}</span>
                    {branches.length > 1 && (
                      <ChevronDown className="w-3 h-3 text-[#9E9E9E] shrink-0" />
                    )}
                  </button>

                  <span className="inline-block w-1 h-1 rounded-full bg-[#D1D5DB]" />

                  {/* Open / Closed Status Badge */}
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                    isOpen ? 'text-[#16A34A]' : 'text-[#DC2626]'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-[#16A34A] animate-pulse' : 'bg-[#DC2626]'}`} />
                    {isOpen ? 'Open' : 'Closed'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg text-[#202124] truncate leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-[#707070] truncate mt-0.5">{subtitle}</p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onNotificationsClick || (() => navigate('/owner/alerts'))}
              className="relative w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB] active:scale-95 transition-all"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF7518] ring-2 ring-white" />
              )}
            </button>

            <button
              onClick={onProfileClick || (() => navigate('/owner/settings'))}
              className="w-9 h-9 rounded-full bg-[#63351F] text-white flex items-center justify-center text-xs font-bold ring-2 ring-[#FF7518]/20 active:scale-95 transition-all"
              aria-label="Profile Settings"
            >
              {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic Branch Selector Dropdown Modal (Parity with Android OwnerTopBar) */}
      {isBranchDropdownOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center pt-16 px-4 animate-in fade-in duration-150"
          onClick={() => setIsBranchDropdownOpen(false)}
        >
          <div 
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-[#EBEBEB] p-3 space-y-2 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F0F0F0] px-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#FF7518]" />
                <h3 className="text-xs font-bold text-[#202124] uppercase tracking-wider">Select Branch</h3>
              </div>
              <button 
                onClick={() => setIsBranchDropdownOpen(false)}
                className="p-1 rounded-lg text-[#9E9E9E] hover:text-[#202124] hover:bg-[#F5F5F5]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {branches.map((b) => {
                const isCurrent = b.id === selectedBranchId || (!selectedBranchId && b.isDefault);
                return (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBranch(b)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors ${
                      isCurrent 
                        ? 'bg-[#FFF4EE] text-[#FF7518] font-bold border border-[#FFE2D1]' 
                        : 'text-[#202124] hover:bg-[#F9F9F9] font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-[#FF7518]' : 'text-[#9E9E9E]'}`} />
                      <div className="min-w-0">
                        <div className="truncate">{b.name}</div>
                        {b.address && <div className="text-[10px] text-[#9E9E9E] truncate">{b.address}</div>}
                      </div>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-[#FF7518] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileOwnerHeader;
