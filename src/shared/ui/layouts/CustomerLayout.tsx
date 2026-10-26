import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useCart } from '../../../context/CartContext';
import { Coffee, Calendar, User, Bell, Check, QrCode, X, Camera, ShieldAlert, ShoppingBag, Utensils, Compass, MapPin, Search, ChevronDown } from 'lucide-react';
import { collection, query, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import toast from 'react-hot-toast';
import QrScannerModal from '../components/QrScannerModal';

interface INotification {
  id: string;
  category: string;
  title: string;
  desc: string;
  timestamp: string;
  read: boolean;
}

export const CustomerLayout: React.FC = () => {
  const { user } = useAuth();
  const { cartItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Compute live cart quantity adhering to existing cart semantics
  const totalCartCount = cartItems.reduce((acc, item) => acc + (item.count || 0), 0);

  // Notification and QR states
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  
  const notificationRef = useRef<HTMLDivElement>(null);

  // Dynamic dining city state
  const [currentCityLabel, setCurrentCityLabel] = useState(() => {
    try {
      const saved = localStorage.getItem('diner_location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.city && parsed.city !== 'Bengaluru') {
          return `${parsed.city}${parsed.state ? ', ' + (parsed.state === 'Telangana' ? 'TS' : parsed.state.slice(0, 2).toUpperCase()) : ''}`;
        }
      }
    } catch (_) {}
    return 'Hyderabad, TS';
  });

  useEffect(() => {
    const updateLocation = () => {
      try {
        const saved = localStorage.getItem('diner_location');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.city) {
            setCurrentCityLabel(`${parsed.city}${parsed.state ? ', ' + (parsed.state === 'Telangana' ? 'TS' : parsed.state.slice(0, 2).toUpperCase()) : ''}`);
          }
        }
      } catch (_) {}
    };

    window.addEventListener('diner_location_changed', updateLocation);
    window.addEventListener('storage', updateLocation);
    return () => {
      window.removeEventListener('diner_location_changed', updateLocation);
      window.removeEventListener('storage', updateLocation);
    };
  }, []);

  // Real customer notifications from Firestore (customers/{uid} with fallback)
  const [notifications, setNotifications] = useState<INotification[]>([]);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      return;
    }

    let unsub = () => {};

    const setupNotifications = async () => {
      let targetCollection = 'customers';
      try {
        const custSnap = await getDoc(doc(db, 'customers', user.uid));
        if (!custSnap.exists()) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            targetCollection = 'users';
          }
        }
      } catch (_e) {
        targetCollection = 'customers';
      }

      try {
        const notifRef = collection(db, targetCollection, user.uid, 'notifications');
        unsub = onSnapshot(query(notifRef), (snap) => {
          const notifList: INotification[] = [];
          snap.forEach(d => {
            const data = d.data();
            notifList.push({
              id: d.id,
              category: data.category || 'Notification',
              title: data.title || 'Alert',
              desc: data.desc || data.description || '',
              timestamp: data.timestamp || 'Just now',
              read: !!data.read
            });
          });
          setNotifications(notifList);
        }, (err) => {
          console.error('Failed to subscribe to customer notifications:', err);
          setNotifications([]);
        });
      } catch (e) {
        setNotifications([]);
      }
    };

    setupNotifications();
    return () => unsub();
  }, [user?.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close notifications on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setIsNotificationOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationOpen(false);
        setIsQrScannerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Ensure body has customer warm cream background class while on customer routes
  useEffect(() => {
    document.body.classList.add('customer-theme-bg');
    return () => {
      document.body.classList.remove('customer-theme-bg');
    };
  }, []);

  // Close notifications and scanner on route changes
  useEffect(() => {
    setIsNotificationOpen(false);
    setIsQrScannerOpen(false);
  }, [location.pathname]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#FFFFFF] flex flex-col font-sans antialiased relative select-none">
      
      {/* Ambient soft green background glow constrained to viewport */}
      <div className="absolute top-0 left-1/4 w-[500px] max-w-[70vw] h-[300px] rounded-full bg-[#F0FDF4]/80 blur-[100px] pointer-events-none z-0" />

      {/* TOP APP BAR */}
      <header className="bg-white/95 border-b border-[#E5E7EB] sticky top-0 z-40 backdrop-blur-md px-2 min-[360px]:px-4 md:px-6 lg:px-8 py-2 sm:py-2.5 sm:py-3 shrink-0 flex items-center justify-between relative z-10 shadow-xs w-full max-w-full min-w-0">
        
        {/* LEFT: Branding & Logo & Desktop Navigation */}
        <div className="flex items-center gap-1.5 min-[340px]:gap-2 sm:gap-3 md:gap-5 min-w-0">
          <div className="flex items-center space-x-1.5 sm:space-x-2 cursor-pointer shrink-0" onClick={() => navigate('/customer/home')}>
            <div className="w-7 h-7 min-[340px]:w-8 min-[340px]:h-8 sm:w-9 sm:h-9 bg-[#F0FDF4] border border-[#E5E7EB] rounded-xl flex items-center justify-center shadow-xs shrink-0">
              <Utensils className="w-3.5 h-3.5 min-[340px]:w-4 min-[340px]:h-4 sm:w-5 sm:h-5 text-[#16A34A]" />
            </div>
            <div className="min-w-0 hidden min-[220px]:block">
              <h1 className="text-[11px] min-[320px]:text-xs sm:text-sm font-poppins font-extrabold text-[#111827] tracking-tight leading-tight whitespace-nowrap">
                Spiral <span className="text-[#16A34A]">Dine</span>
              </h1>
              <p className="text-[9px] font-medium text-[#6B7280] hidden lg:block leading-none truncate">
                Good Food Brings People Together
              </p>
            </div>
          </div>

          {/* Location Context Pill - Primary Location Selector (adaptive: visible at >= 420px, on smaller screens the Customer Home page has dedicated location selector) */}
          <button 
            type="button"
            onClick={() => {
              if (location.pathname !== '/customer/home') {
                navigate('/customer/home');
                setTimeout(() => window.dispatchEvent(new Event('open_location_modal')), 100);
              } else {
                window.dispatchEvent(new Event('open_location_modal'));
              }
            }}
            className="hidden min-[420px]:flex items-center space-x-1 sm:space-x-1.5 bg-[#F0FDF4] border border-[#E5E7EB] px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-xs text-[#111827] font-medium shadow-xs cursor-pointer hover:border-[#16A34A]/50 hover:bg-[#F0FDF4]/90 transition-all group shrink min-w-0 max-w-[140px] sm:max-w-[180px] md:max-w-none"
            title="Click to choose dining location"
          >
            <MapPin className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
            <span className="font-bold text-[#111827] group-hover:text-[#16A34A] transition-colors truncate text-[11px] sm:text-xs">{currentCityLabel}</span>
            <ChevronDown className="w-3 h-3 text-[#6B7280] group-hover:text-[#16A34A] transition-colors shrink-0" />
          </button>

          {/* Desktop Navigation links - Adaptive spacing for tablets and desktops */}
          <nav className="hidden md:flex items-center space-x-0.5 lg:space-x-1 min-w-0">
            <NavLink
              to="/customer/home"
              className={({ isActive }) => `px-2.5 lg:px-4 py-1.5 rounded-full text-[11px] lg:text-xs font-poppins font-extrabold transition-all whitespace-nowrap ${isActive ? 'text-[#16A34A] bg-[#F0FDF4] shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              Home
            </NavLink>
            <NavLink
              to="/customer/explore"
              className={({ isActive }) => `px-2.5 lg:px-4 py-1.5 rounded-full text-[11px] lg:text-xs font-poppins font-extrabold transition-all whitespace-nowrap ${isActive ? 'text-[#16A34A] bg-[#F0FDF4] shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              Explore
            </NavLink>
            <NavLink
              to="/customer/orders"
              className={({ isActive }) => `px-2.5 lg:px-4 py-1.5 rounded-full text-[11px] lg:text-xs font-poppins font-extrabold transition-all whitespace-nowrap ${isActive ? 'text-[#16A34A] bg-[#F0FDF4] shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              My Orders
            </NavLink>
            <NavLink
              to="/customer/booking"
              className={({ isActive }) => `px-2.5 lg:px-4 py-1.5 rounded-full text-[11px] lg:text-xs font-poppins font-extrabold transition-all whitespace-nowrap ${isActive ? 'text-[#16A34A] bg-[#F0FDF4] shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              Book Table
            </NavLink>
            <NavLink
              to="/customer/profile"
              className={({ isActive }) => `px-2.5 lg:px-4 py-1.5 rounded-full text-[11px] lg:text-xs font-poppins font-extrabold transition-all whitespace-nowrap ${isActive ? 'text-[#16A34A] bg-[#F0FDF4] shadow-xs' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              Profile
            </NavLink>
          </nav>
        </div>

        {/* RIGHT: Cart access, Notifications bell, Profile Avatar, and Desktop QR trigger */}
        <div className="flex items-center gap-1 min-[340px]:gap-1.5 sm:gap-2 md:gap-3 shrink-0">
          
          {/* Desktop QR Scan button */}
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="hidden xl:flex px-4 py-2 bg-[#16A34A] hover:bg-[#166534] text-white font-poppins font-extrabold text-xs rounded-full transition-all shadow-md shadow-[#16A34A]/20 items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Scan</span>
          </button>

          {/* Cart Access Button */}
          <button
            type="button"
            onClick={() => navigate('/customer/cart')}
            aria-label={`Shopping Cart, ${totalCartCount} ${totalCartCount === 1 ? 'item' : 'items'}`}
            className={`p-1.5 min-[340px]:p-2 sm:p-2.5 rounded-full text-[#6B7280] hover:text-[#111827] transition-all border relative cursor-pointer ${
              location.pathname === '/customer/cart'
                ? 'bg-[#F0FDF4] border-[#16A34A] text-[#16A34A]'
                : 'bg-white border-[#E5E7EB] hover:border-[#16A34A]/40'
            }`}
            title="View Cart"
          >
            <ShoppingBag className="w-3.5 h-3.5 min-[340px]:w-4 min-[340px]:h-4" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] min-[340px]:min-w-[18px] min-[340px]:h-[18px] px-0.5 min-[340px]:px-1 bg-[#F97316] text-white text-[9px] min-[340px]:text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
                {totalCartCount > 99 ? '99+' : totalCartCount}
              </span>
            )}
          </button>

          {/* Notification Bell */}
          <div className="relative" ref={notificationRef}>
            <button 
              type="button"
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              aria-label={`Notifications, ${unreadCount} unread`}
              className={`p-1.5 min-[340px]:p-2 sm:p-2.5 rounded-full text-[#6B7280] hover:text-[#111827] transition-all border cursor-pointer ${
                isNotificationOpen 
                  ? 'bg-[#F0FDF4] border-[#16A34A] text-[#16A34A]' 
                  : 'bg-white border-[#E5E7EB] hover:border-[#16A34A]/40'
              }`}
            >
              <Bell className="w-3.5 h-3.5 min-[340px]:w-4 min-[340px]:h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-[340px]:top-1.5 min-[340px]:right-1.5 w-1.5 h-1.5 min-[340px]:w-2 min-[340px]:h-2 bg-[#F97316] rounded-full animate-pulse" />
              )}
            </button>

            {/* Notification dropdown panel */}
            {isNotificationOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white border border-[#E5E7EB] rounded-2xl shadow-xl z-50 text-left overflow-hidden">
                <div className="p-3.5 border-b border-[#E5E7EB] bg-[#F0FDF4]/60 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-poppins font-extrabold text-[#111827]">Notifications</h4>
                    <span className="text-[9px] text-[#6B7280] font-semibold">{unreadCount} unread logs</span>
                  </div>
                  {notifications.length > 0 && (
                    <button 
                      type="button"
                      onClick={markAllRead}
                      className="text-[9px] text-[#16A34A] font-bold hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-[#F0FDF4]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#6B7280] font-medium">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="p-3.5 hover:bg-[#F0FDF4]/50 transition-colors">
                        <h5 className="text-xs font-bold text-[#111827]">{n.title}</h5>
                        <p className="text-[10.5px] text-[#6B7280] mt-0.5">{n.desc}</p>
                        <span className="text-[8.5px] text-[#6B7280]/70 mt-1 block">
                          {n.timestamp}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar Trigger */}
          <button
            type="button"
            onClick={() => navigate('/customer/profile')}
            aria-label="Customer Profile"
            className={`w-7 h-7 min-[340px]:w-8 min-[340px]:h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[10px] min-[340px]:text-xs font-poppins font-extrabold transition-all border cursor-pointer shrink-0 ${
              location.pathname === '/customer/profile'
                ? 'bg-[#16A34A] text-white border-[#16A34A]'
                : 'bg-[#F0FDF4] text-[#16A34A] border-[#E5E7EB] hover:border-[#16A34A]/40'
            }`}
          >
            {(user?.displayName || user?.email || (user?.isAnonymous ? 'GD' : 'U')).substring(0, 2).toUpperCase()}
          </button>

        </div>
      </header>

      <main className="flex-1 overflow-x-hidden px-3 sm:px-4 pt-3 sm:pt-4 pb-24 md:pb-8 md:px-8 relative bg-[#FFFFFF] w-full max-w-7xl mx-auto z-10 min-w-0">
        <Outlet />
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (md:hidden) WITH 5 PRESERVED DESTINATIONS AND CENTERED SCAN QR BUTTON */}
      <nav 
        aria-label="Mobile Navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/98 border-t border-[#E5E7EB] backdrop-blur-md flex items-center justify-between px-1 min-[340px]:px-2 shadow-lg h-16 w-full max-w-full min-w-0"
      >
        {/* 1. HOME */}
        <NavLink
          to="/customer/home"
          aria-label="Home"
          title="Home"
          className={({ isActive }) => `flex flex-col items-center justify-center flex-1 min-w-0 h-full transition-all ${isActive ? 'text-[#16A34A]' : 'text-[#6B7280] hover:text-[#111827]'}`}
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-full ${isActive ? 'bg-[#F0FDF4]' : ''}`}>
                <Coffee className="w-4 h-4 min-[340px]:w-5 min-[340px]:h-5 shrink-0" />
              </div>
              <span className={`text-[9px] min-[340px]:text-[10px] font-medium font-sans mt-0.5 truncate max-w-full hidden min-[260px]:block ${isActive ? 'font-bold text-[#16A34A]' : ''}`}>Home</span>
            </>
          )}
        </NavLink>

        {/* 2. EXPLORE */}
        <NavLink
          to="/customer/explore"
          aria-label="Explore"
          title="Explore"
          className={({ isActive }) => `flex flex-col items-center justify-center flex-1 min-w-0 h-full transition-all ${isActive ? 'text-[#16A34A]' : 'text-[#6B7280] hover:text-[#111827]'}`}
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-full ${isActive ? 'bg-[#F0FDF4]' : ''}`}>
                <Compass className="w-4 h-4 min-[340px]:w-5 min-[340px]:h-5 shrink-0" />
              </div>
              <span className={`text-[9px] min-[340px]:text-[10px] font-medium font-sans mt-0.5 truncate max-w-full hidden min-[260px]:block ${isActive ? 'font-bold text-[#16A34A]' : ''}`}>Explore</span>
            </>
          )}
        </NavLink>

        {/* 3. CENTRAL SCAN QR ACTION */}
        <div className="flex flex-col items-center justify-center flex-1 min-w-0 h-full">
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            aria-label="Scan Table QR Code"
            title="Scan Table QR Code"
            className="w-10 h-10 min-[340px]:w-11 min-[340px]:h-11 bg-[#16A34A] hover:bg-[#166534] text-white rounded-full flex items-center justify-center shadow-md shadow-[#16A34A]/30 border-2 border-white transition-transform active:scale-95 cursor-pointer shrink-0"
          >
            <QrCode className="w-5 h-5 min-[340px]:w-5.5 min-[340px]:h-5.5 shrink-0" />
          </button>
          <span className="text-[9px] min-[340px]:text-[10px] font-bold text-[#16A34A] font-sans mt-0.5 truncate max-w-full hidden min-[260px]:block">Scan QR</span>
        </div>

        {/* 4. ORDERS */}
        <NavLink
          to="/customer/orders"
          aria-label="Orders"
          title="Orders"
          className={({ isActive }) => `flex flex-col items-center justify-center flex-1 min-w-0 h-full transition-all ${isActive ? 'text-[#16A34A]' : 'text-[#6B7280] hover:text-[#111827]'}`}
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-full ${isActive ? 'bg-[#F0FDF4]' : ''}`}>
                <Utensils className="w-4 h-4 min-[340px]:w-5 min-[340px]:h-5 shrink-0" />
              </div>
              <span className={`text-[9px] min-[340px]:text-[10px] font-medium font-sans mt-0.5 truncate max-w-full hidden min-[260px]:block ${isActive ? 'font-bold text-[#16A34A]' : ''}`}>Orders</span>
            </>
          )}
        </NavLink>

        {/* 5. PROFILE */}
        <NavLink
          to="/customer/profile"
          aria-label="Profile"
          title="Profile"
          className={({ isActive }) => `flex flex-col items-center justify-center flex-1 min-w-0 h-full transition-all ${isActive ? 'text-[#16A34A]' : 'text-[#6B7280] hover:text-[#111827]'}`}
        >
          {({ isActive }) => (
            <>
              <div className={`p-1 rounded-full ${isActive ? 'bg-[#F0FDF4]' : ''}`}>
                <User className="w-4 h-4 min-[340px]:w-5 min-[340px]:h-5 shrink-0" />
              </div>
              <span className={`text-[9px] min-[340px]:text-[10px] font-medium font-sans mt-0.5 truncate max-w-full hidden min-[260px]:block ${isActive ? 'font-bold text-[#16A34A]' : ''}`}>Profile</span>
            </>
          )}
        </NavLink>
      </nav>

      {/* REAL CAMERA QR SCANNER MODAL */}
      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
      />

    </div>
  );
};

export default CustomerLayout;

