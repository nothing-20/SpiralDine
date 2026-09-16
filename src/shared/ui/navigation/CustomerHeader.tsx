import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  Coffee,
  Calendar,
  User,
  Bell,
  QrCode,
  X,
  Camera,
  Utensils,
  Compass,
  MapPin,
  ChevronDown,
  Layers
} from 'lucide-react';
import { collection, query, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import toast from 'react-hot-toast';

interface INotification {
  id: string;
  category: string;
  title: string;
  desc: string;
  timestamp: string;
  read: boolean;
}

interface CustomerHeaderProps {
  tableNumber?: string;
  restaurantName?: string;
  onLocationClick?: () => void;
}

export const CustomerHeader: React.FC<CustomerHeaderProps> = ({
  tableNumber,
  restaurantName,
  onLocationClick
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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

  // Real customer notifications from Firestore
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

  useEffect(() => {
    setIsNotificationOpen(false);
    setIsQrScannerOpen(false);
  }, [location.pathname]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  const handleScanSimulation = (tenantId: string, tableId: string, token: string) => {
    if (!token || token.length < 6) {
      toast.error('Invalid QR Token signature.');
      return;
    }
    if (!tenantId || !tableId) {
      toast.error('Could not map scanned table to any active branch.');
      return;
    }

    setIsQrScannerOpen(false);
    toast.success(`Table QR Verified! Opening session for ${tableId.replace('TBL-', 'Table ')}...`, { icon: '🍽️' });
    navigate(`/r/${tenantId}/table/${tableId}`);
  };

  return (
    <>
      <header className="bg-[#FCFAF7]/95 border-b border-[#E5DCD5] sticky top-0 z-40 backdrop-blur-md px-4 py-3 shrink-0 flex items-center justify-between md:px-8 relative shadow-xs">
        {/* LEFT: Branding & Navigation */}
        <div className="flex items-center space-x-5 lg:space-x-6 shrink-0">
          <div
            className="flex items-center space-x-2.5 cursor-pointer select-none"
            onClick={() => navigate('/customer/home')}
          >
            <div className="w-9 h-9 bg-[#C85A3F] rounded-xl flex items-center justify-center shadow-md shadow-[#C85A3F]/20">
              <span className="text-white font-display font-extrabold text-xl">S</span>
            </div>
            <div>
              <h1 className="text-sm font-display font-extrabold text-[#202124] tracking-tight">
                Spiral <span className="text-[#C85A3F]">Dine</span>
              </h1>
            </div>
          </div>

          {/* Location Context Pill */}
          <button
            type="button"
            onClick={() => {
              if (onLocationClick) {
                onLocationClick();
              } else if (location.pathname !== '/customer/home') {
                navigate('/customer/home');
                setTimeout(() => window.dispatchEvent(new Event('open_location_modal')), 100);
              } else {
                window.dispatchEvent(new Event('open_location_modal'));
              }
            }}
            className="hidden sm:flex items-center space-x-1.5 bg-[#F3E8DF] border border-[#E5DCD5] px-3.5 py-1.5 rounded-full text-xs text-[#202124] font-medium shadow-xs cursor-pointer hover:border-[#C85A3F]/50 hover:bg-[#F3E8DF]/80 transition-all group"
            title="Click to choose dining location"
          >
            <MapPin className="w-3.5 h-3.5 text-[#C85A3F] shrink-0" />
            <span className="font-bold text-[#202124] group-hover:text-[#C85A3F] transition-colors">
              {currentCityLabel}
            </span>
            <ChevronDown className="w-3 h-3 text-[#756B64] group-hover:text-[#C85A3F] transition-colors shrink-0" />
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <NavLink
              to="/customer/home"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                  isActive
                    ? 'text-[#C85A3F] bg-[#F3E8DF] shadow-xs'
                    : 'text-[#756B64] hover:text-[#202124]'
                }`
              }
            >
              Home
            </NavLink>
            <NavLink
              to="/customer/explore"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                  isActive
                    ? 'text-[#C85A3F] bg-[#F3E8DF] shadow-xs'
                    : 'text-[#756B64] hover:text-[#202124]'
                }`
              }
            >
              Explore
            </NavLink>
            <NavLink
              to="/customer/orders"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                  isActive
                    ? 'text-[#C85A3F] bg-[#F3E8DF] shadow-xs'
                    : 'text-[#756B64] hover:text-[#202124]'
                }`
              }
            >
              My Orders
            </NavLink>
            <NavLink
              to="/customer/booking"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                  isActive
                    ? 'text-[#C85A3F] bg-[#F3E8DF] shadow-xs'
                    : 'text-[#756B64] hover:text-[#202124]'
                }`
              }
            >
              Book Table
            </NavLink>
            <NavLink
              to="/customer/profile"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all ${
                  isActive
                    ? 'text-[#C85A3F] bg-[#F3E8DF] shadow-xs'
                    : 'text-[#756B64] hover:text-[#202124]'
                }`
              }
            >
              Profile
            </NavLink>
          </nav>
        </div>

        {/* RIGHT: Table Context / QR Scan / Notifications / Profile */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
          {/* Active Table Context Pill (if dining context exists) */}
          {tableNumber && (
            <div className="flex items-center space-x-1.5 bg-[#2E8B57]/10 border border-[#2E8B57]/30 text-[#2E8B57] px-3 py-1 rounded-full text-xs font-bold">
              <Layers className="w-3.5 h-3.5" />
              <span>Table {tableNumber}</span>
              {restaurantName && (
                <span className="hidden sm:inline text-[11px] font-semibold text-[#202124]">
                  · {restaurantName}
                </span>
              )}
            </div>
          )}

          {/* QR Scan Button */}
          <button
            onClick={() => setIsQrScannerOpen(true)}
            className="hidden sm:flex px-3.5 py-1.5 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold text-xs rounded-full transition-all shadow-md shadow-[#C85A3F]/20 items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Scan</span>
          </button>

          {/* Notification Bell */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className={`p-2 rounded-full text-[#756B64] hover:text-[#202124] transition-all border ${
                isNotificationOpen
                  ? 'bg-[#F3E8DF] border-[#C85A3F] text-[#C85A3F]'
                  : 'bg-white border-[#E5DCD5] hover:border-[#C85A3F]/40'
              }`}
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#C85A3F] rounded-full animate-pulse" />
              )}
            </button>

            {/* Notification Dropdown */}
            {isNotificationOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border border-[#E5DCD5] rounded-2xl shadow-xl z-50 text-left overflow-hidden">
                <div className="p-3.5 border-b border-[#F3E8DF] bg-[#F3E8DF]/50 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-[#202124]">Notifications</h4>
                    <span className="text-[9px] text-[#756B64] font-semibold">{unreadCount} unread logs</span>
                  </div>
                  {notifications.length > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-[9px] text-[#C85A3F] font-bold hover:underline"
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
                    notifications.map((n) => (
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
            onClick={() => navigate('/customer/profile')}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-extrabold transition-all border ${
              location.pathname === '/customer/profile'
                ? 'bg-[#C85A3F] text-white border-[#C85A3F]'
                : 'bg-[#F3E8DF] text-[#C85A3F] border-[#E5DCD5] hover:border-[#C85A3F]/40'
            }`}
            aria-label="View profile"
          >
            {(user?.displayName || user?.email || 'GC').substring(0, 2).toUpperCase()}
          </button>
        </div>
      </header>

      {/* QR Scanner Viewfinder Modal */}
      {isQrScannerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 overflow-hidden shadow-2xl">
          <div className="bg-white border border-[#E5DCD5] rounded-3xl p-6 max-w-xs w-full text-center relative shadow-2xl space-y-5">
            <button
              onClick={() => setIsQrScannerOpen(false)}
              className="absolute top-4 right-4 p-1.5 bg-[#F3E8DF] hover:bg-[#E5DCD5] rounded-full text-[#756B64] hover:text-[#202124] transition-colors"
              aria-label="Close QR scanner"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 pt-2">
              <h3 className="text-sm font-extrabold text-[#202124]">Scan Table QR Code</h3>
              <p className="text-[11px] text-[#756B64]">Position the table QR code inside the camera viewfinder.</p>
            </div>

            <div className="w-44 h-44 mx-auto border-2 border-[#C85A3F] rounded-2xl relative overflow-hidden flex items-center justify-center bg-[#FCFAF7]">
              <div className="absolute left-0 right-0 h-0.5 bg-[#C85A3F] shadow-md shadow-[#C85A3F]/80 animate-bounce" />
              <Camera className="w-10 h-10 text-[#C85A3F]/40 animate-pulse" />
            </div>

            <div className="space-y-2 text-left">
              <span className="text-[10px] text-[#756B64] font-extrabold uppercase tracking-wider block">
                Quick Table Sessions
              </span>
              <div className="space-y-1.5">
                <button
                  onClick={() => handleScanSimulation('bawarchi-restaurant', 'TBL-12', 'QR-TOKEN-BW-12')}
                  className="w-full py-2 px-3 bg-[#FCFAF7] hover:bg-[#F3E8DF] border border-[#E5DCD5] rounded-xl text-[11px] text-[#202124] font-bold transition-all flex justify-between items-center"
                >
                  <span>Bawarchi (Table 12)</span>
                  <span className="text-[#C85A3F] font-extrabold text-[10px]">Test QR →</span>
                </button>
                <button
                  onClick={() => handleScanSimulation('paradise-biryani', 'TBL-5', 'QR-TOKEN-PB-5')}
                  className="w-full py-2 px-3 bg-[#FCFAF7] hover:bg-[#F3E8DF] border border-[#E5DCD5] rounded-xl text-[11px] text-[#202124] font-bold transition-all flex justify-between items-center"
                >
                  <span>Paradise (Table 5)</span>
                  <span className="text-[#C85A3F] font-extrabold text-[10px]">Test QR →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerHeader;
