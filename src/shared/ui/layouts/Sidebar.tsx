import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { featureFlags } from '../../../config/featureFlags';
import { db } from '../../firebase/config';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Menu, 
  Users, 
  QrCode, 
  Activity, 
  DollarSign, 
  ChefHat, 
  ClipboardList, 
  TrendingUp, 
  Server, 
  Settings,
  Sparkles,
  Target,
  History,
  ListOrdered,
  X,
  ChevronDown,
  ArrowLeft,
  Flame,
  Clock,
  SlidersHorizontal,
  Package,
  PackageX,
  Utensils,
  Building2,
  CalendarCheck,
  Contact2,
  MessageSquareQuote,
  Megaphone,
  Bell,
  FileSpreadsheet,
  ArrowLeftRight,
  ShieldCheck,
  UtensilsCrossed
} from 'lucide-react';

interface ISidebarLink {
  to: string;
  label: string;
  icon: React.ComponentType<any>;
  badge?: number | string;
  disabled?: boolean;
}

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { role, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const tenantId = user?.tenantId;

  const isKitchen = location.pathname.startsWith('/dashboard/kitchen') || role === 'kitchen';
  const isWaiter = location.pathname.startsWith('/dashboard/waiter') || role === 'waiter';
  const isOperational = isKitchen || isWaiter;
  const isOwner = location.pathname.startsWith('/owner') || location.pathname.startsWith('/dashboard/owner') || (role === 'owner' && !isOperational);

  // Live active counts for badges
  const [activeCookingCount, setActiveCookingCount] = useState<number>(0);
  const [activeWaiterAlertsCount, setActiveWaiterAlertsCount] = useState<number>(0);
  const [restaurantName, setRestaurantName] = useState<string>('Bawarchi Restaurant');
  const [restaurantCity, setRestaurantCity] = useState<string>('Hyderabad');
  const [unreadAlertsCount, setUnreadAlertsCount] = useState<number>(0);

  useEffect(() => {
    if (!tenantId) return;

    // 1. Listen for active kitchen orders count
    const qOrders = query(
      collection(db, 'restaurants', tenantId, 'orders'),
      where('status', 'in', ['NEW', 'PLACED', 'ACCEPTED', 'CHEF_ASSIGNED', 'PREPARING', 'READY'])
    );
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      setActiveCookingCount(snap.size);
    }, (err) => {
      console.warn('Sidebar orders count listener:', err);
    });

    // 2. Listen for active waiter alerts count
    const qRequests = query(
      collection(db, 'restaurants', tenantId, 'waiterRequests')
    );
    const unsubRequests = onSnapshot(qRequests, (snap) => {
      let count = 0;
      snap.forEach(d => {
        const data = d.data();
        if (data.requestType === 'New Order Placed' || data.type === 'New Order Placed') return;
        const s = (data.status || '').toLowerCase();
        if (s !== 'completed' && s !== 'cancelled' && s !== 'rejected') {
          count++;
        }
      });
      setActiveWaiterAlertsCount(count);
    }, (err) => {
      console.warn('Sidebar waiter requests listener:', err);
    });

    // 3. Fetch restaurant profile name and city if available
    const fetchRestInfo = async () => {
      try {
        const rDoc = await getDoc(doc(db, 'restaurants', tenantId));
        if (rDoc.exists()) {
          const data = rDoc.data();
          if (data.name) setRestaurantName(data.name);
          if (data.city || data.location) setRestaurantCity(data.city || data.location);
        }
      } catch (err) {
        console.warn('Sidebar restaurant info fetch:', err);
      }
    };
    fetchRestInfo();

    // 4. Listen for unread alerts for owner
    const qAlerts = query(
      collection(db, 'restaurants', tenantId, 'alerts'),
      where('read', '==', false)
    );
    const unsubAlerts = onSnapshot(qAlerts, (snap) => {
      setUnreadAlertsCount(snap.size);
    }, (err) => {
      console.warn('Sidebar alerts count listener:', err);
    });

    return () => {
      unsubOrders();
      unsubRequests();
      unsubAlerts();
    };
  }, [tenantId]);

  const getLinks = (): ISidebarLink[] => {
    // When in Kitchen context (either role=kitchen or viewing kitchen dashboard)
    if (isKitchen) {
      return [
        { 
          to: '/dashboard/kitchen', 
          label: 'Cooking Tickets', 
          icon: ChefHat, 
          badge: activeCookingCount > 0 ? activeCookingCount : undefined 
        },
        { to: '/dashboard/kitchen/inventory', label: 'Inventory', icon: Package },
        { to: '/dashboard/kitchen/menu-control', label: 'Menu Operations', icon: PackageX },
        { to: 'divider-1', label: '', icon: () => null },
        { to: '/dashboard/kitchen/order-history', label: 'Order History', icon: History },
        { to: '/dashboard/kitchen/item-history', label: 'Item History', icon: ListOrdered },
        { to: '/dashboard/kitchen/chef-performance', label: 'Chef Performance', icon: Sparkles },
        { to: '/dashboard/kitchen/timeline', label: 'Kitchen Timeline', icon: Clock },
        { to: 'divider-2', label: '', icon: () => null },
        { to: '/dashboard/kitchen/settings', label: 'Kitchen Settings', icon: Settings },
      ];
    }

    // When in Waiter context (either role=waiter or viewing waiter dashboard)
    if (isWaiter) {
      return [
        { to: '/dashboard/waiter', label: 'Tables Matrix', icon: LayoutDashboard },
        { 
          to: '/dashboard/waiter/alerts', 
          label: 'Customer Alerts', 
          icon: ClipboardList, 
          badge: activeWaiterAlertsCount > 0 ? activeWaiterAlertsCount : undefined 
        },
        { to: '/dashboard/waiter/assigned-tables', label: 'My Assigned Tables', icon: QrCode },
        { 
          to: '/dashboard/waiter/live-orders', 
          label: 'Live Orders', 
          icon: Utensils, 
          badge: activeCookingCount > 0 ? activeCookingCount : undefined 
        },
        { to: '/dashboard/waiter/menu-availability', label: 'Menu Availability', icon: UtensilsCrossed },
        { to: 'divider-waiter-1', label: '', icon: () => null },
        { to: '/dashboard/waiter/billing', label: 'Billing', icon: DollarSign },
        { to: '/dashboard/waiter/order-history', label: 'Order History', icon: History },
        { to: '/dashboard/waiter/item-history', label: 'Item History', icon: ListOrdered },
        { to: '/dashboard/waiter/performance', label: 'Waiter Performance', icon: Sparkles },
        { to: '/dashboard/waiter/timeline', label: 'Kitchen Timeline', icon: Clock },
        { to: 'divider-waiter-2', label: '', icon: () => null },
        { to: '/dashboard/waiter/shift-report', label: 'Daily Shift Report', icon: ClipboardList },
      ];
    }

    if (isOwner || role === 'owner') {
      const ownerLinks: ISidebarLink[] = [
        { to: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/owner/menu', label: 'Menu', icon: Menu },
        { to: '/owner/tables', label: 'Tables', icon: QrCode },
        { to: '/owner/staff', label: 'Staff', icon: Users },
        { to: '/owner/billing', label: 'Billing', icon: DollarSign },
        { to: '/owner/inventory', label: 'Inventory', icon: ClipboardList },
      ];
      
      if (featureFlags.analytics) {
        ownerLinks.push({ to: '/owner/analytics', label: 'Reports', icon: TrendingUp });
      }
      if (featureFlags.automation) {
        ownerLinks.push({ to: '/owner/automation', label: 'Automation', icon: Activity });
      }
      if (featureFlags.intelligence) {
        ownerLinks.push({ to: '/owner/intelligence', label: 'Intelligence', icon: Sparkles });
      }
      if (featureFlags.strategy) {
        ownerLinks.push({ to: '/owner/strategy', label: 'Strategy', icon: Target });
      }

      // ── New Owner Sections (Appended while strictly preserving existing order) ──
      ownerLinks.push(
        { to: 'divider-new-owner-sections', label: '', icon: () => null },
        { to: '/owner/restaurants', label: 'Restaurants', icon: Building2 },
        { to: '/owner/reservations', label: 'Reservations', icon: CalendarCheck },
        { to: '/owner/customers', label: 'Customers', icon: Contact2 },
        { to: '/owner/feedback', label: 'Feedback', icon: MessageSquareQuote },
        { to: '/owner/marketing', label: 'Marketing', icon: Megaphone },
        { to: '/owner/alerts', label: 'Alerts', icon: Bell, badge: unreadAlertsCount > 0 ? unreadAlertsCount : undefined },
        { to: '/owner/reports', label: 'Reports', icon: FileSpreadsheet },
        { to: '/owner/branch-transfers', label: 'Branch Transfers', icon: ArrowLeftRight },
        { to: '/owner/audit-logs', label: 'Audit Logs', icon: ShieldCheck }
      );
      
      return ownerLinks;
    }

    switch (role) {
      case 'super-admin':
        return [
          { to: '/super-admin', label: 'MRR Metrics', icon: DollarSign },
          { to: '/super-admin/tenants', label: 'Manage Tenants', icon: Server },
        ];
      case 'admin':
        return [
          { to: '/dashboard/admin', label: 'Analytics', icon: LayoutDashboard },
          { to: '/dashboard/owner/menu', label: 'Menu Editor', icon: Menu },
          { to: '/dashboard/admin/logs', label: 'System Logs', icon: Activity },
        ];
      default:
        return [];
    }
  };

  const links = getLinks();

  // ── Operational Front-of-House / Kitchen Sidebar (Dark Green Design System) ──────
  if (isOperational) {
    const roleTitle = isKitchen ? 'Kitchen' : 'Waiter';
    const RoleIcon = isKitchen ? ChefHat : Utensils;
    const onlineLabel = isKitchen ? 'Kitchen Online' : 'Service Online';
    const baseRoute = isKitchen ? '/dashboard/kitchen' : '/dashboard/waiter';

    return (
      <aside className="w-full h-full bg-[#13241F] text-[#F7F4EE] flex flex-col justify-between select-none z-20 font-sans border-r border-[#1E3B33]">
        {/* Top brand + restaurant info */}
        <div>
          {/* Top Branding Header */}
          <div className="h-16 flex items-center px-5 border-b border-[#1E3B33] justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-md bg-[#C84A38] flex items-center justify-center text-white shadow-sm">
                <RoleIcon className="w-4 h-4 text-white" strokeWidth={2.2} />
              </div>
              <div className="text-left">
                <div className="flex items-center space-x-1.5 leading-none">
                  <span className="font-serif text-[15px] font-bold tracking-tight text-white">Spiral Dine</span>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#C84A38] bg-[#C84A38]/15 px-1.5 py-0.5 rounded">
                    {roleTitle}
                  </span>
                </div>
              </div>
            </div>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1 rounded-lg text-[#8D9B95] hover:text-white transition-colors lg:hidden hover:bg-[#1A312B]"
                title="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Restaurant & Branch Selector Context */}
          <div className="px-4 py-3.5 border-b border-[#1E3B33] bg-[#0E1B17]/60">
            <div className="flex items-center justify-between text-left cursor-default">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-white truncate leading-tight font-serif tracking-wide">
                  {restaurantName}
                </p>
                <p className="text-[11px] text-[#8D9B95] truncate mt-0.5 flex items-center space-x-1 font-sans">
                  <span>{restaurantCity}</span>
                  <span>·</span>
                  <span className="text-[#287A55] font-semibold">Active Shift</span>
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#8D9B95] shrink-0 opacity-70" />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-4 space-y-1 overflow-y-auto max-h-[calc(100vh-230px)]">
            {links.map((link) => {
              if (link.to.startsWith('divider-')) {
                return <hr key={link.to} className="border-[#1E3B33] my-2.5 mx-2" />;
              }
              const IconComponent = link.icon;

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === baseRoute}
                  onClick={() => onClose?.()}
                  className={({ isActive }) => `
                    group flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150
                    ${isActive 
                      ? 'bg-white text-[#18201D] font-bold shadow-sm' 
                      : 'text-[#8D9B95] hover:text-white hover:bg-[#1A312B]'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <IconComponent 
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#C84A38]' : 'text-[#8D9B95] group-hover:text-white'
                          }`} 
                          strokeWidth={isActive ? 2.2 : 1.8} 
                        />
                        <span className="truncate">{link.label}</span>
                      </div>

                      {/* Badge (e.g. active tickets or alerts count) */}
                      {link.badge !== undefined && (
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full transition-all ${
                          isActive 
                            ? 'bg-[#C84A38] text-white' 
                            : 'bg-[#C84A38]/20 text-[#E87E71] group-hover:bg-[#C84A38] group-hover:text-white'
                        }`}>
                          {link.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Online status & Exit to Owner if role is owner/admin */}
        <div className="p-3 border-t border-[#1E3B33] bg-[#0E1B17]/60 space-y-2">
          {/* Owner Return Button */}
          {(role === 'owner' || role === 'admin' || role === 'manager') && (
            <button
              onClick={() => navigate('/owner/dashboard')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-[#8D9B95] hover:text-white hover:bg-[#1A312B] transition-colors"
            >
              <div className="flex items-center space-x-1.5">
                <ArrowLeft className="w-3 h-3" />
                <span>Exit to Owner Portal</span>
              </div>
              <span className="text-[9px] uppercase tracking-wider text-[#6F746F]">Owner</span>
            </button>
          )}

          {/* Service Online indicator */}
          <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-[#8D9B95]">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#287A55] animate-pulse" />
              <span className="font-semibold text-white">{onlineLabel}</span>
            </div>
            <span className="font-mono text-[10px] text-[#6F746F]">v1.0.0</span>
          </div>
        </div>
      </aside>
    );
  }

  // ── Owner Portal Sidebar (Deep Green & Terracotta Design System) ──────
  if (isOwner) {
    return (
      <aside className="w-full h-full bg-[#12352D] text-[#F8F6F2] flex flex-col justify-between select-none z-20 font-sans border-r border-[#1A473C]">
        {/* Top brand + restaurant info + navigation */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Top Branding Header */}
          <div className="h-16 flex items-center px-5 border-b border-[#1A473C] justify-between shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#C9533B] flex items-center justify-center text-white shadow-sm">
                <LayoutDashboard className="w-4 h-4 text-white" strokeWidth={2.2} />
              </div>
              <div className="text-left">
                <div className="flex items-center space-x-1.5 leading-none">
                  <span className="font-serif text-[16px] font-bold tracking-tight text-white">Spiral Dine</span>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#FBEAE5] bg-[#C9533B]/30 border border-[#C9533B]/40 px-1.5 py-0.5 rounded">
                    Owner
                  </span>
                </div>
              </div>
            </div>
            {onClose && (
              <button 
                onClick={onClose}
                className="p-1 rounded-lg text-[#8FA59F] hover:text-white transition-colors lg:hidden hover:bg-[#1A473C]"
                title="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Restaurant & Branch Selector Context */}
          <div className="px-4 py-3 border-b border-[#1A473C] bg-[#0E221C]/70 shrink-0">
            <div className="flex items-center justify-between text-left cursor-default">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-white truncate leading-tight font-serif tracking-wide">
                  {restaurantName}
                </p>
                <p className="text-[11px] text-[#8FA59F] truncate mt-0.5 flex items-center space-x-1 font-sans">
                  <span>{restaurantCity}</span>
                  <span>·</span>
                  <span className="text-[#16845B] font-semibold">Active</span>
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#8FA59F] shrink-0 opacity-70" />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {links.map((link) => {
              if (link.to.startsWith('divider-')) {
                return <hr key={link.to} className="border-[#1A473C] my-2.5 mx-2" />;
              }
              const IconComponent = link.icon;

              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/owner/dashboard' || link.to === '/dashboard/owner'}
                  onClick={() => onClose?.()}
                  className={({ isActive }) => `
                    group flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150
                    ${isActive 
                      ? 'bg-[#C9533B] text-white font-bold shadow-sm' 
                      : 'text-[#A2B5AF] hover:text-white hover:bg-[#1A473C]'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <IconComponent 
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-white' : 'text-[#8FA59F] group-hover:text-white'
                          }`} 
                          strokeWidth={isActive ? 2.2 : 1.8} 
                        />
                        <span className="truncate">{link.label}</span>
                      </div>

                      {link.badge !== undefined && (
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full transition-all ${
                          isActive 
                            ? 'bg-white/20 text-white' 
                            : 'bg-[#C9533B]/25 text-[#FBEAE5] group-hover:bg-[#C9533B] group-hover:text-white'
                        }`}>
                          {link.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Settings link and Online status */}
        <div className="p-3 border-t border-[#1A473C] bg-[#0E221C]/70 space-y-2 shrink-0">
          <NavLink 
            to="/owner/settings"
            onClick={() => onClose?.()}
            className={({ isActive }) => 
              `flex items-center space-x-2.5 w-full px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
                isActive 
                  ? 'bg-[#C9533B] text-white font-bold shadow-sm' 
                  : 'text-[#A2B5AF] hover:text-white hover:bg-[#1A473C]'
              }`
            }
          >
            <Settings className="w-4 h-4 text-[#8FA59F] group-hover:text-white" />
            <span>Settings</span>
          </NavLink>

          <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-[#8FA59F]">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-[#16845B] animate-pulse" />
              <span className="font-semibold text-white">Owner Portal</span>
            </div>
            <span className="font-mono text-[10px] text-[#6F746F]">v1.0.0</span>
          </div>
        </div>
      </aside>
    );
  }

  // ── Standard SaaS Sidebar for Non-Kitchen Dashboards (Owner, Waiter, Admin) ───
  return (
    <aside className="w-full h-full bg-slate-950 flex flex-col z-20">
      <div className="h-16 flex items-center px-6 border-b border-slate-800/40 justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-primary font-display font-extrabold text-lg">S</span>
          </div>
          <span className="font-display font-bold text-base text-textPearl">Spiral Dine</span>
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 rounded-xl text-slate-500 hover:text-white transition-colors lg:hidden border border-slate-850 hover:bg-slate-900"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {links.map((link) => {
          if (link.to.startsWith('divider-')) {
            return <hr key={link.to} className="border-slate-800/40 my-3" />;
          }
          const IconComponent = link.icon;
          if (link.disabled) {
            return (
              <div
                key={link.to + link.label}
                className="flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 cursor-not-allowed select-none"
                title="Coming Soon"
              >
                <IconComponent className="w-4 h-4" />
                <span>{link.label}</span>
                <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-slate-700 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-md">Soon</span>
              </div>
            );
          }
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/owner/dashboard' || link.to === '/dashboard/owner' || link.to === '/dashboard/waiter' || link.to === '/dashboard/kitchen'}
              onClick={() => onClose?.()}
              className={({ isActive }) => `
                flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300
                ${isActive 
                  ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                  : 'text-mutedAsh hover:text-textPearl hover:bg-slate-900/60'
                }
              `}
            >
              <IconComponent className="w-4 h-4" />
              <span>{link.label}</span>
              {link.badge !== undefined && (
                <span className="ml-auto text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  {link.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {(role === 'owner' || role === 'admin') && (
        <div className="p-4 border-t border-slate-800/40 bg-slate-950/20">
          <NavLink 
            to="/owner/settings"
            onClick={() => onClose?.()}
            className={({ isActive }) => 
              `flex items-center space-x-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-primary text-background font-bold shadow-lg shadow-primary/10' 
                  : 'text-mutedAsh hover:text-textPearl hover:bg-slate-900/60'
              }`
            }
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </NavLink>
        </div>
      )}
    </aside>
  );
};
export default Sidebar;
