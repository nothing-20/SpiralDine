import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../config/firebase';
import { featureFlags } from '../../../config/featureFlags';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDocs 
} from 'firebase/firestore';
import { 
  LogOut, 
  Bell, 
  User, 
  Search, 
  Terminal, 
  AlertTriangle,
  X,
  ChevronRight,
  ChevronDown,
  Database,
  Menu
} from 'lucide-react';
import toast from 'react-hot-toast';

interface NavbarProps {
  onMenuClick?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const tenantId = user?.tenantId;

  // Search & Command Palette Modal state
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Notification states
  const [showNotifications, setShowNotifications] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  // Search Data States (cached on focus/open)
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  // References
  const searchInputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  // Listen to alerts for notification bell
  useEffect(() => {
    if (!tenantId) return;

    const q = query(collection(db, 'restaurants', tenantId, 'alerts'), where('read', '==', false));
    const unsub = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setAlerts(list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });

    return () => unsub();
  }, [tenantId]);

  // Load search pool data when search is initialized
  const loadSearchData = async () => {
    if (!tenantId || hasLoadedData) return;
    try {
      // 1. Menu items
      const menuSnap = await getDocs(collection(db, 'restaurants', tenantId, 'menu/default/items'));
      const menuList: any[] = [];
      menuSnap.forEach(d => menuList.push({ id: d.id, type: 'Menu Item', label: d.data().name, path: '/dashboard/owner/menu' }));
      setMenuItems(menuList);

      // 2. Tables
      const tablesSnap = await getDocs(collection(db, 'restaurants', tenantId, 'tables'));
      const tablesList: any[] = [];
      tablesSnap.forEach(d => tablesList.push({ id: d.id, type: 'Table', label: `Table ${d.data().number} (${d.data().status})`, path: '/dashboard/owner/tables' }));
      setTables(tablesList);

      // 3. Employees
      const empSnap = await getDocs(query(collection(db, 'employees'), where('tenantId', '==', tenantId)));
      const empList: any[] = [];
      empSnap.forEach(d => empList.push({ id: d.id, type: 'Employee', label: `${d.data().name} (${d.data().role})`, path: '/dashboard/owner/staff' }));
      setEmployees(empList);

      // 4. Inventory
      const invSnap = await getDocs(collection(db, 'restaurants', tenantId, 'inventory'));
      const invList: any[] = [];
      invSnap.forEach(d => invList.push({ id: d.id, type: 'Inventory', label: `${d.data().name} (${d.data().currentStock} ${d.data().unit})`, path: '/dashboard/owner/inventory' }));
      setInventory(invList);

      setHasLoadedData(true);
    } catch (err) {
      console.error('Failed to pre-fetch search options', err);
    }
  };

  // Keyboard shortcut listener Ctrl + K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setShowNotifications(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pre-load data on search open
  useEffect(() => {
    if (isOpen) {
      loadSearchData();
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Define static commands
  const commands = useMemo(() => [
    { id: 'cmd-order', type: 'Quick Action', label: 'Tables Matrix / New Order', action: () => navigate('/dashboard/waiter') },
    { id: 'cmd-assigned', type: 'Navigation', label: 'My Assigned Tables', action: () => navigate('/dashboard/waiter/assigned-tables') },
    { id: 'cmd-live-orders', type: 'Navigation', label: 'Live Orders', action: () => navigate('/dashboard/waiter/live-orders') },
    { id: 'cmd-waiter-alerts', type: 'Navigation', label: 'Customer Alerts & Requests', action: () => navigate('/dashboard/waiter/alerts') },
    { id: 'cmd-waiter-billing', type: 'Navigation', label: 'Waiter Billing POS', action: () => navigate('/dashboard/waiter/billing') },
    { id: 'cmd-kitchen', type: 'Navigation', label: 'Open Kitchen Display System (KDS)', action: () => navigate('/dashboard/kitchen') },
    { id: 'cmd-billing', type: 'Navigation', label: 'Open Owner Billing POS Register', action: () => navigate('/owner/billing') },
    { id: 'cmd-inventory', type: 'Navigation', label: 'Open Inventory Manager', action: () => navigate('/owner/inventory') },
    { id: 'cmd-staff', type: 'Navigation', label: 'Manage Staff Profiles', action: () => navigate('/owner/staff') },
    { id: 'cmd-menu', type: 'Navigation', label: 'Menu Editor', action: () => navigate('/owner/menu') },
    { id: 'cmd-analytics', type: 'Navigation', label: 'Open BI Analytics & Reports', action: () => navigate('/owner/analytics') },
    { id: 'cmd-settings', type: 'Navigation', label: 'Open Settings Panel', action: () => navigate('/owner/settings') },
  ], [navigate]);

  // Combine and filter search results
  const filteredResults = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const searchPool = [...commands, ...menuItems, ...tables, ...employees, ...inventory];
    if (!q) return commands.slice(0, 6); // default commands list

    return searchPool.filter(item => 
      item.label.toLowerCase().includes(q) || 
      item.type.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, commands, menuItems, tables, employees, inventory]);

  // Navigate keyboard controls
  const handleNavKeys = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => (prev + 1) % filteredResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => (prev - 1 + filteredResults.length) % filteredResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults[selectedIdx]) {
        executeResult(filteredResults[selectedIdx]);
      }
    }
  };

  const executeResult = (item: any) => {
    setIsOpen(false);
    setSearchQuery('');
    if (item.action) {
      item.action();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  // Notification resolve triggers
  const handleDismissAlert = async (alertId: string) => {
    if (!tenantId) return;
    try {
      const docRef = doc(db, 'restaurants', tenantId, 'alerts', alertId);
      await updateDoc(docRef, { read: true });
      toast.success('Alert dismissed');
    } catch (err) {
      console.error(err);
      toast.error('Failed to dismiss alert.');
    }
  };

  const handleResolveAlert = async (alert: any) => {
    if (!tenantId) return;
    try {
      const docRef = doc(db, 'restaurants', tenantId, 'alerts', alert.id);
      await deleteDoc(docRef);
      toast.success('Alert resolved!');
      
      // Auto-route to resolve action
      if (alert.title.includes('Stock')) {
        window.location.href = '/dashboard/owner/inventory';
      } else if (alert.title.includes('CSAT')) {
        window.location.href = featureFlags.strategy ? '/dashboard/owner/strategy' : '/dashboard/owner';
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to resolve alert.');
    }
  };

  const location = useLocation();
  const isKitchen = location.pathname.startsWith('/dashboard/kitchen') || role === 'kitchen';
  const isWaiter = location.pathname.startsWith('/dashboard/waiter') || role === 'waiter';
  const isOwner = location.pathname.startsWith('/owner') || location.pathname.startsWith('/dashboard/owner') || (role === 'owner' && !isKitchen && !isWaiter);
  const isLightService = isKitchen || isWaiter;
  const isLightHeader = isLightService || isOwner;

  return (
    <header className={`h-16 flex items-center justify-between px-6 z-20 transition-colors ${
      isLightHeader 
        ? 'border-b border-[#E5E0D9] bg-white text-[#17202A]' 
        : 'border-b border-slate-800/40 bg-slate-950/40 backdrop-blur-md text-textPearl'
    }`}>
      
      {/* Search Input trigger on left */}
      <div className="flex items-center space-x-3 flex-1 max-w-md">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className={`p-2 -ml-2 lg:hidden rounded-lg transition-colors ${
              isLightService 
                ? 'text-[#5F6762] hover:text-[#18201D] bg-[#F7F4EE] border border-[#E3DED5]' 
                : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-855'
            }`}
            title="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {isLightHeader ? (
          <button 
            onClick={() => {
              loadSearchData();
              setIsOpen(true);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2 rounded-lg border text-xs transition-all duration-150 text-left select-none group shadow-none ${
              isOwner 
                ? 'border-[#E5E0D9] bg-[#F8F6F2] hover:bg-white hover:border-[#C9533B] text-[#52606D] hover:text-[#17202A]' 
                : 'border-[#E3DED5] bg-white hover:bg-[#FBF9F5] hover:border-[#D1C9BC] text-[#5F6762] hover:text-[#18201D]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Search className={`w-4 h-4 transition-colors ${isOwner ? 'text-[#7B8794] group-hover:text-[#C9533B]' : 'text-[#5F6762] group-hover:text-[#18201D]'}`} />
              <span className="text-[12px] font-medium truncate">
                {isOwner ? 'Search menu, tables, staff, inventory or type action...' : 'Search by table, order ID, item or customer name...'}
              </span>
            </div>
            <kbd className={`border px-1.5 py-0.5 rounded text-[10px] font-mono leading-none tracking-normal shadow-none font-semibold ${
              isOwner ? 'bg-white border-[#E5E0D9] text-[#52606D]' : 'bg-[#F7F4EE] border-[#E3DED5] text-[#5F6762]'
            }`}>
              {typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent || navigator.platform) ? '⌘ K' : 'Ctrl + K'}
            </kbd>
          </button>
        ) : (
          <>
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 hidden sm:inline-block">
              Tenant: {user?.tenantId || 'SaaS Global'}
            </span>
            <button 
              onClick={() => setIsOpen(true)}
              className="flex items-center space-x-2.5 px-3 py-1.5 rounded-full border border-slate-800 bg-slate-955/40 hover:border-slate-700/60 text-slate-400 hover:text-slate-300 text-xs font-semibold select-none transition-all duration-200"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Quick Search...</span>
              <kbd className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-[9px] font-mono leading-none tracking-normal">
                Ctrl K
              </kbd>
            </button>
          </>
        )}
      </div>

      <div className="flex items-center space-x-4">
        
        {/* Unified Notification Center dropdown */}
        <div className="relative" ref={notificationsRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`p-2 transition-colors relative rounded-lg ${
              isLightHeader 
                ? 'text-[#52606D] hover:text-[#17202A] hover:bg-[#F8F6F2]' 
                : 'text-mutedAsh hover:text-primary hover:bg-slate-900/60'
            }`}
          >
            <Bell className="w-4 h-4" />
            {alerts.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#D64545] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {alerts.length}
              </span>
            ) : isLightService ? (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#D64545] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                2
              </span>
            ) : null}
          </button>

          {showNotifications && (
            <div className={`absolute right-0 mt-2.5 w-80 rounded-xl shadow-xl p-4 space-y-3 z-50 text-left ${
              isLightHeader 
                ? 'border border-[#E5E0D9] bg-white text-[#17202A]' 
                : 'border border-slate-855 bg-slate-955/95 shadow-2xl backdrop-blur-lg text-textPearl'
            }`}>
              <div className={`flex items-center justify-between pb-2 border-b ${
                isLightHeader ? 'border-[#E5E0D9]' : 'border-slate-855'
              }`}>
                <span className={`text-xs font-bold flex items-center gap-1.5 ${
                  isLightHeader ? 'text-[#17202A]' : 'text-textPearl'
                }`}>
                  <Bell className={`w-4 h-4 ${isOwner ? 'text-[#C9533B]' : isLightService ? 'text-[#C84A38]' : 'text-primary'}`} />
                  <span>Unread Notifications</span>
                </span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  isLightHeader ? 'bg-[#FBEAE5] text-[#C9533B]' : 'bg-slate-900 border border-slate-800 text-slate-400'
                }`}>
                  {alerts.length || 2} New
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2.5 scrollbar-thin">
                {alerts.map((a) => (
                  <div key={a.id} className={`p-2.5 rounded-lg space-y-2 text-xs border ${
                    isLightHeader 
                      ? 'bg-[#F8F6F2] border-[#E5E0D9]' 
                      : 'bg-slate-950/40 border border-slate-855'
                  }`}>
                    <div className="flex justify-between items-start">
                      <span className="font-bold flex items-center gap-1">
                        <AlertTriangle className={`w-3.5 h-3.5 ${a.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'}`} />
                        {a.title}
                      </span>
                      <button 
                        onClick={() => handleDismissAlert(a.id)}
                        className="text-slate-400 hover:text-slate-600"
                        title="Dismiss alert"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className={`text-[10px] font-semibold ${isLightHeader ? 'text-[#52606D]' : 'text-slate-400'}`}>{a.message}</p>
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={() => handleResolveAlert(a)}
                        className={`text-[9px] font-black uppercase tracking-wider hover:underline ${
                          isOwner ? 'text-[#C9533B]' : isLightService ? 'text-[#C84A38]' : 'text-primary'
                        }`}
                      >
                        Resolve Issue
                      </button>
                    </div>
                  </div>
                ))}

                {alerts.length === 0 && (
                  <div className={`text-center py-6 italic text-xs font-semibold ${isLightHeader ? 'text-[#52606D]' : 'text-slate-500'}`}>
                    No active unread notifications.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile details */}
        <div className={`flex items-center space-x-3 pl-3 border-l ${
          isLightHeader ? 'border-[#E5E0D9]' : 'border-slate-800/60'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
            isOwner 
              ? 'bg-[#12352D] text-white border border-[#12352D]' 
              : isLightService 
              ? 'bg-[#13241F] text-white border border-[#13241F]' 
              : 'bg-slate-900 border border-slate-800 text-slate-350'
          }`}>
            {user?.displayName 
              ? user.displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() 
              : (user?.email ? user.email.slice(0, 2).toUpperCase() : (isOwner ? 'OW' : isKitchen ? 'KS' : (isWaiter ? 'SC' : <User className="w-4 h-4" />)))}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className={`text-xs font-bold truncate max-w-[120px] ${
              isLightHeader ? 'text-[#17202A]' : 'text-textPearl'
            }`}>
              {user?.displayName || user?.email?.split('@')[0] || (isOwner ? 'Owner' : isKitchen ? 'Kitchen Staff' : (isWaiter ? 'Sri Charan' : 'User'))}
            </span>
            <span className={`text-[9px] uppercase font-extrabold tracking-widest ${
              isOwner ? 'text-[#C9533B]' : isLightService ? 'text-[#5F6762]' : 'text-primary'
            }`}>
              {role === 'owner' ? 'Owner' : role === 'kitchen' ? 'Head Chef' : (role === 'waiter' ? 'WAITER' : (role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'Staff'))}
            </span>
          </div>
          {isLightService && (
            <ChevronDown className="w-3.5 h-3.5 text-[#5F6762] hidden md:block cursor-pointer" />
          )}
        </div>

        {/* Logout */}
        <button 
          onClick={logout} 
          className={`p-2 rounded-lg transition-all ${
            isOwner 
              ? 'text-[#52606D] hover:text-[#D64545] hover:bg-[#FBEAE5]' 
              : isLightService 
              ? 'text-[#5F6762] hover:text-[#C7463A] hover:bg-[#F9E8E4]' 
              : 'text-mutedAsh hover:text-red-500 hover:bg-red-500/10'
          }`}
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Global Command Palette Overlay Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-24 px-4 backdrop-blur-sm">
          <div 
            ref={paletteRef}
            className={`w-full max-w-xl rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[420px] ${
              isLightHeader 
                ? 'bg-white border border-[#E5E0D9] text-[#17202A]' 
                : 'bg-slate-955 border border-slate-850 text-textPearl'
            }`}
          >
            {/* Header Input */}
            <div className={`p-4 border-b flex items-center space-x-3 ${isLightHeader ? 'bg-[#F8F6F2] border-[#E5E0D9]' : 'border-slate-850 bg-slate-950/40'}`}>
              <Search className={`w-4 h-4 ${isLightHeader ? 'text-[#7B8794]' : 'text-slate-400'}`} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search menu, tables, staff, inventory or type action..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIdx(0);
                }}
                onKeyDown={handleNavKeys}
                className={`w-full bg-transparent outline-none border-none text-xs ${isLightHeader ? 'text-[#17202A] placeholder-[#7B8794]' : 'text-textPearl placeholder-slate-500'}`}
              />
              <button 
                onClick={() => setIsOpen(false)}
                className={`p-1 rounded ${isLightHeader ? 'bg-white border border-[#E5E0D9] text-[#52606D] hover:text-[#17202A]' : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300'}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Results body */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 block ${isLightHeader ? 'text-[#7B8794]' : 'text-slate-550'}`}>
                {searchQuery ? 'Matching entries' : 'Recommended actions'}
              </span>

              {filteredResults.map((item, idx) => {
                const isSelected = idx === selectedIdx;
                let badgeColor = isLightHeader ? 'bg-[#F8F6F2] border-[#E5E0D9] text-[#52606D]' : 'bg-slate-900 border-slate-800 text-slate-400';
                if (item.type === 'Quick Action') badgeColor = isLightHeader ? 'bg-[#FBEAE5] border-[#F5CBC4] text-[#C9533B]' : 'bg-primary/10 border-primary/20 text-primary';
                if (item.type === 'Demo Reset') badgeColor = isLightHeader ? 'bg-[#FFF4DC] border-[#FDE6B0] text-[#9A6200]' : 'bg-amber-500/10 border-amber-500/20 text-amber-500';

                return (
                  <div
                    key={item.id}
                    onClick={() => executeResult(item)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer select-none border transition-all ${
                      isSelected 
                        ? isLightHeader ? 'border-[#C9533B] bg-[#FBEAE5] text-[#17202A]' : 'border-primary/40 bg-primary/5 text-textPearl'
                        : isLightHeader ? 'border-transparent text-[#52606D] hover:bg-[#F8F6F2]' : 'border-transparent text-slate-450 hover:bg-slate-950/30'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <Terminal className={`w-3.5 h-3.5 ${isSelected ? (isLightHeader ? 'text-[#C9533B]' : 'text-primary') : 'text-slate-400'}`} />
                      <span className="text-xs font-semibold truncate">{item.label}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2 shrink-0">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-mono ${badgeColor}`}>
                        {item.type}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                );
              })}

              {filteredResults.length === 0 && (
                <div className={`text-center py-8 italic text-xs font-semibold ${isLightHeader ? 'text-[#7B8794]' : 'text-slate-500'}`}>
                  No matching items or actions found.
                </div>
              )}
            </div>

            {/* Palette Footer */}
            <div className={`p-3 border-t flex justify-between items-center text-[10px] font-bold font-mono ${isLightHeader ? 'border-[#E5E0D9] bg-[#F8F6F2] text-[#52606D]' : 'border-slate-850 bg-slate-950/20 text-slate-550'}`}>
              <span className="flex items-center gap-1.5">
                <span>↑↓ Navigate</span>
                <span>•</span>
                <span>↵ Select</span>
              </span>
              <span>ESC to Close</span>
            </div>

          </div>
        </div>
      )}

    </header>
  );
};

export default Navbar;
