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
    <div className="min-h-screen w-full bg-[#FCFAF7] flex flex-col font-sans antialiased relative select-none">
      
      {/* Ambient warm background glow */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full bg-[#F3E8DF]/60 blur-[100px] pointer-events-none z-0" />

      {/* TOP APP BAR */}
      <header className="bg-[#FCFAF7]/95 border-b border-[#F3E8DF] sticky top-0 z-40 backdrop-blur-md px-4 py-3 shrink-0 flex items-center justify-between md:px-8 relative z-10 shadow-xs">
        
        {/* LEFT: Branding & Logo & Desktop Navigation */}
        <div className="flex items-center space-x-6 shrink-0">
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => navigate('/customer/home')}>
            <div className="w-9 h-9 bg-[#C85A3F] rounded-xl flex items-center justify-center shadow-md shadow-[#C85A3F]/20">
              <span className="text-white font-display font-extrabold text-xl">S</span>
            </div>
            <div>
              <h1 className="text-sm font-display font-extrabold text-[#202124] tracking-tight">Spiral <span className="text-[#C85A3F]">Dine</span></h1>
            </div>
          </div>

          {/* Location Context Pill - Primary Location Selector */}
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
            className="flex items-center space-x-1.5 bg-[#F3E8DF] border border-[#E5DCD5] px-3.5 py-1.5 rounded-full text-xs text-[#202124] font-medium shadow-xs cursor-pointer hover:border-[#C85A3F]/50 hover:bg-[#F3E8DF]/80 transition-all group"
            title="Click to choose dining location"
          >
            <MapPin className="w-3.5 h-3.5 text-[#C85A3F] shrink-0" />
            <span className="font-bold text-[#202124] group-hover:text-[#C85A3F] transition-colors">{currentCityLabel}</span>
            <ChevronDown className="w-3 h-3 text-[#756B64] group-hover:text-[#C85A3F] transition-colors shrink-0" />
          </button>

          {/* Desktop Navigation links */}
          <nav className="hidden md:flex items-center space-x-1">
            <NavLink
              to="/customer/home"
              className={({ isActive }) => `px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${isActive ? 'text-[#C85A3F] bg-[#F3E8DF] shadow-xs' : 'text-[#756B64] hover:text-[#202124]'}`}
            >
              Home
            </NavLink>
            <NavLink
              to="/customer/explore"
              className={({ isActive }) => `px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${isActive ? 'text-[#C85A3F] bg-[#F3E8DF] shadow-xs' : 'text-[#756B64] hover:text-[#202124]'}`}
            >
              Explore
            </NavLink>
            <NavLink
              to="/customer/orders"
              className={({ isActive }) => `px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${isActive ? 'text-[#C85A3F] bg-[#F3E8DF] shadow-xs' : 'text-[#756B64] hover:text-[#202124]'}`}
            >
              My Orders
            </NavLink>
            <NavLink
              to="/customer/booking"
              className={({ isActive }) => `px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${isActive ? 'text-[#C85A3F] bg-[#F3E8DF] shadow-xs' : 'text-[#756B64] hover:text-[#202124]'}`}
            >
              Book Table
            </NavLink>
            <NavLink
              to="/customer/profile"
              className={({ isActive }) => `px-4 py-1.5 rounded-full text-xs font-extrabold transition-all ${isActive ? 'text-[#C85A3F] bg-[#F3E8DF] shadow-xs' : 'text-[#756B64] hover:text-[#202124]'}`}
            >
              Profile
            </NavLink>
          </nav>
        </div>

        {/* RIGHT: Cart access, Notifications bell, Profile Avatar, and Desktop QR trigger */}
        <div className="flex items-center space-x-2 md:space-x-3 shrink-0">
          
          {/* Desktop QR Scan button */}
          <button
            type="button"
            onClick={() => setIsQrScannerOpen(true)}
            className="hidden md:flex px-4 py-2 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold text-xs rounded-full transition-all shadow-md shadow-[#C85A3F]/20 items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Scan</span>
          </button>

          {/* Cart Access Button (Mobile & Desktop with Live Item Count Badge) */}
          <button
            type="button"
            onClick={() => navigate('/customer/cart')}
            aria-label={`Shopping Cart, ${totalCartCount} ${totalCartCount === 1 ? 'item' : 'items'}`}
            className={`p-2.5 rounded-full text-[#756B64] hover:text-[#202124] transition-all border relative cursor-pointer ${
              location.pathname === '/customer/cart'
                ? 'bg-[#F3E8DF] border-[#C85A3F] text-[#C85A3F]'
                : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/40'
            }`}
            title="View Cart"
          >
            <ShoppingBag className="w-4 h-4" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#C85A3F] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs">
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
              className={`p-2.5 rounded-full text-[#756B64] hover:text-[#202124] transition-all border cursor-pointer ${
                isNotificationOpen 
                  ? 'bg-[#F3E8DF] border-[#C85A3F] text-[#C85A3F]' 
                  : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/40'
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#C85A3F] rounded-full animate-pulse" />
              )}
            </button>

            {/* Notification dropdown panel */}
            {isNotificationOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border border-[#E5DCD5] rounded-2xl shadow-xl z-50 text-left overflow-hidden">
                <div className="p-3.5 border-b border-[#F3E8DF] bg-[#F3E8DF]/50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-[#202124]">Notifications</h4>
                    <span className="text-[9px] text-[#756B64] font-semibold">{unreadCount} unread logs</span>
                  </div>
                  {notifications.length > 0 && (
                    <button 
                      type="button"
                      onClick={markAllRead}
                      className="text-[9px] text-[#C85A3F] font-bold hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-[#F3E8DF]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#756B64] font-medium">
                      No notifications yet.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className="p-3.5 hover:bg-[#F3E8DF]/40 transition-colors">
                        <h5 className="text-xs font-bold text-[#202124]">{n.title}</h5>
                        <p className="text-[10.5px] text-[#756B64] mt-0.5">{n.desc}</p>
                        <span className="text-[8.5px] text-[#756B64]/70 mt-1 block">
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
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold transition-all border cursor-pointer ${
              location.pathname === '/customer/profile'
                ? 'bg-[#C85A3F] text-white border-[#C85A3F]'
                : 'bg-[#F3E8DF] text-[#C85A3F] border-[#E5DCD5] hover:border-[#C85A3F]/40'
            }`}
          >
            {(user?.displayName || user?.email || 'GC').substring(0, 2).toUpperCase()}
          </button>

        </div>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pt-6 pb-28 md:pb-8 md:px-8 relative bg-[#FCFAF7] w-full max-w-7xl mx-auto z-10">
        <Outlet />
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR (md:hidden) FIXED TO BOTTOM VIEWPORT WITH SAFE-AREA INSET SUPPORT */}
      <nav 
        aria-label="Mobile Navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FCFAF7]/95 border-t border-[#F3E8DF] backdrop-blur-md flex items-center justify-around px-2 shadow-lg"
      >
        {/* 1. QR SCANNER */}
        <button
          type="button"
          onClick={() => setIsQrScannerOpen(true)}
          aria-label="Scan Table QR Code"
          className="flex flex-col items-center justify-center flex-1 h-14 text-[#C85A3F] hover:text-[#A94332] transition-transform active:scale-95 cursor-pointer"
        >
          <div className="w-8 h-8 bg-[#C85A3F] text-white rounded-full flex items-center justify-center shadow-md shadow-[#C85A3F]/30 border border-[#C85A3F]">
            <QrCode className="w-4.5 h-4.5" />
          </div>
          <span className="text-[8.5px] font-extrabold font-sans mt-0.5">QR Scanner</span>
        </button>

        {/* 2. HOME */}
        <NavLink
          to="/customer/home"
          className={({ isActive }) => `flex flex-col items-center justify-center flex-1 h-14 transition-all ${isActive ? 'text-[#C85A3F]' : 'text-[#756B64] hover:text-[#202124]'}`}
        >
          <Coffee className="w-5 h-5 mb-0.5" />
          <span className="text-[8.5px] font-extrabold font-sans">Home</span>
        </NavLink>

        {/* 3. CART WITH LIVE COUNT BADGE */}
        <NavLink
          to="/customer/cart"
          aria-label={`Shopping Cart, ${totalCartCount} ${totalCartCount === 1 ? 'item' : 'items'}`}
          className={({ isActive }) => `flex flex-col items-center justify-center flex-1 h-14 transition-all relative ${isActive ? 'text-[#C85A3F]' : 'text-[#756B64] hover:text-[#202124]'}`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 mb-0.5" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-[#C85A3F] text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs">
                {totalCartCount > 99 ? '99+' : totalCartCount}
              </span>
            )}
          </div>
          <span className="text-[8.5px] font-extrabold font-sans">Cart</span>
        </NavLink>

        {/* 4. ORDERS */}
        <NavLink
          to="/customer/orders"
          className={({ isActive }) => `flex flex-col items-center justify-center flex-1 h-14 transition-all ${isActive ? 'text-[#C85A3F]' : 'text-[#756B64] hover:text-[#202124]'}`}
        >
          <Utensils className="w-5 h-5 mb-0.5" />
          <span className="text-[8.5px] font-extrabold font-sans">Orders</span>
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
