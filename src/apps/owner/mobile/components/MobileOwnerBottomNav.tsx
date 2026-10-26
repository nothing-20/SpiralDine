import React from 'react';
import { Home, ClipboardList, UtensilsCrossed, LayoutGrid, MoreHorizontal } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface MobileOwnerBottomNavProps {
  pendingOrdersCount?: number;
}

export const MobileOwnerBottomNav: React.FC<MobileOwnerBottomNavProps> = ({
  pendingOrdersCount = 0,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      path: '/owner/dashboard',
      isActive: currentPath === '/owner' || 
                currentPath === '/owner/' || 
                currentPath.startsWith('/owner/dashboard') || 
                currentPath === '/owner/mobile' || 
                currentPath.startsWith('/owner/mobile/home'),
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: ClipboardList,
      path: '/owner/orders',
      badge: pendingOrdersCount > 0 ? pendingOrdersCount : undefined,
      isActive: currentPath.startsWith('/owner/orders') || currentPath.startsWith('/owner/mobile/orders'),
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: UtensilsCrossed,
      path: '/owner/menu',
      isActive: currentPath.startsWith('/owner/menu') || 
                currentPath.startsWith('/owner/categories') || 
                currentPath.startsWith('/owner/mobile/menu') || 
                currentPath.startsWith('/owner/mobile/categories'),
    },
    {
      id: 'business',
      label: 'Business',
      icon: LayoutGrid,
      path: '/owner/business',
      isActive: currentPath.startsWith('/owner/business') || 
                currentPath.startsWith('/owner/analytics') || 
                currentPath.startsWith('/owner/tables') || 
                currentPath.startsWith('/owner/staff') || 
                currentPath.startsWith('/owner/promotions') ||
                currentPath.startsWith('/owner/mobile/business'),
    },
    {
      id: 'more',
      label: 'More',
      icon: MoreHorizontal,
      path: '/owner/more',
      isActive: currentPath.startsWith('/owner/more') || 
                currentPath.startsWith('/owner/settings') || 
                currentPath.startsWith('/owner/mobile/more') ||
                currentPath.startsWith('/owner/mobile/settings'),
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#EBEBEB] pb-safe select-none shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
      <div className="grid grid-cols-5 h-16 max-w-xl mx-auto px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.isActive;

          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className="flex flex-col items-center justify-center relative py-1 focus:outline-none transition-colors group"
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-150 ${
                    active ? 'text-[#FF7518] scale-110' : 'text-[#707070] group-hover:text-[#202124]'
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
                {tab.badge && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#FF7518] text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-sm">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-1 font-medium tracking-tight transition-colors ${
                  active ? 'text-[#FF7518] font-bold' : 'text-[#707070]'
                }`}
              >
                {tab.label}
              </span>
              {active && (
                <span className="absolute bottom-1 w-6 h-0.5 rounded-full bg-[#FF7518]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileOwnerBottomNav;
