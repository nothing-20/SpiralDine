import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { 
  collection, getDocs, getDoc, doc, setDoc, deleteDoc, onSnapshot, query, where, orderBy, addDoc 
} from 'firebase/firestore';
import { sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import { db, auth } from '../../../config/firebase';
import { getResetActionCodeSettings } from '../../../shared/firebase/auth';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import { 
  User, Settings, Check, Award, Heart, Bell, ChevronRight, 
  ChevronLeft, MapPin, Calendar, Clock, CreditCard, Wallet, 
  ShieldAlert, BookOpen, LogOut, ArrowRight, Star, Plus, Trash2, Navigation,
  ShoppingBag, Utensils, Receipt, HelpCircle, AlertCircle, FileText, Lock,
  Globe, ShieldCheck, MessageSquare, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCurrency } from '../../../context/CurrencyContext';

interface IAddress {
  id: string;
  name: string;
  detail: string;
}

interface IReservation {
  id: string;
  restaurantId: string;
  restaurantName: string;
  date: string;
  time: string;
  guests: number;
  status: string;
  tableNumber?: string;
  specialNotes?: string;
  seatingPreference?: string;
  directions?: string;
  lat?: number;
  lng?: number;
}

interface IReview {
  id: string;
  restaurantName: string;
  starRating: number;
  rating?: string;
  notes: string;
  createdAt: string;
  status: string;
}

interface IReceiptOrder {
  id: string;
  orderId: string;
  restaurantName: string;
  total: number;
  subtotal?: number;
  tax?: number;
  serviceCharge?: number;
  discount?: number;
  paymentStatus: string;
  paymentMethod?: string;
  createdAt: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}

interface ISupportTicket {
  id: string;
  ticketId: string;
  category: string;
  description: string;
  status: string;
  orderId?: string;
  bookingId?: string;
  createdAt: string;
  responseMessage?: string;
}

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatCurrency } = useCurrency();

  const [activeSection, setActiveSection] = useState<string>(() => {
    return searchParams.get('section') || 'menu';
  });

  useEffect(() => {
    const section = searchParams.get('section');
    if (section) {
      setActiveSection(section);
    } else {
      setActiveSection('menu');
    }
  }, [searchParams]);

  const handleSectionChange = (section: string) => {
    if (section === 'menu') {
      searchParams.delete('section');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ section });
    }
    setActiveSection(section);
  };

  // State: Personal Information
  const [displayName, setDisplayName] = useState(user?.displayName || user?.email?.split('@')[0] || 'Customer');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [dietaryPrefs, setDietaryPrefs] = useState<string[]>([]);
  const [allergens, setAllergens] = useState<string[]>([]);
  const [preferredCuisines, setPreferredCuisines] = useState<string[]>([]);
  const [diningMethod, setDiningMethod] = useState('Dine In');
  const [isVeg, setIsVeg] = useState(false);

  // State: Saved Addresses
  const [addresses, setAddresses] = useState<IAddress[]>([]);
  const [newAddrName, setNewAddrName] = useState('');
  const [newAddrDetail, setNewAddrDetail] = useState('');

  // State: Reservations
  const [reservations, setReservations] = useState<IReservation[]>([]);
  const [isReservationsLoading, setIsReservationsLoading] = useState(false);

  // State: Wallet
  const [walletBalance, setWalletBalance] = useState(0);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState(120);

  // State: Favourites
  const [favourites, setFavourites] = useState<any[]>([]);
  const [isFavouritesLoading, setIsFavouritesLoading] = useState(false);

  // State: Reviews
  const [customerReviews, setCustomerReviews] = useState<IReview[]>([]);

  // State: Receipts
  const [receiptOrders, setReceiptOrders] = useState<IReceiptOrder[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<IReceiptOrder | null>(null);

  // State: Notifications preferences
  const [notifOrder, setNotifOrder] = useState(true);
  const [notifBooking, setNotifBooking] = useState(true);
  const [notifBill, setNotifBill] = useState(true);
  const [notifPromo, setNotifPromo] = useState(false);
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);

  // State: App Settings
  const [appTheme, setAppTheme] = useState('System');
  const [appLang, setAppLang] = useState('English');
  const [appTextSize, setAppTextSize] = useState('Medium');

  // State: Support Tickets
  const [supportTickets, setSupportTickets] = useState<ISupportTicket[]>([]);
  const [supportCategory, setSupportCategory] = useState('Order Issue');
  const [supportDesc, setSupportDesc] = useState('');
  const [supportRefId, setSupportRefId] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Modals
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Stream profile document
  useEffect(() => {
    if (!user?.uid) return;

    let unsubUser = () => {};
    let unsubAddr = () => {};

    const setupProfileStream = async () => {
      let targetCol = 'customers';
      try {
        const custSnap = await getDoc(doc(db, 'customers', user.uid));
        if (!custSnap.exists()) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) targetCol = 'users';
        }
      } catch (_e) {}

      const userDocRef = doc(db, targetCol, user.uid);
      unsubUser = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          if (d.displayName) setDisplayName(d.displayName);
          else if (d.fullName) setDisplayName(d.fullName);
          if (d.phoneNumber || d.phone) setPhoneNumber(d.phoneNumber || d.phone);
          if (d.walletBalance !== undefined) setWalletBalance(d.walletBalance);
          if (d.loyaltyPoints !== undefined) setLoyaltyPoints(d.loyaltyPoints);
          if (d.dietaryPrefs) setDietaryPrefs(d.dietaryPrefs);
          if (d.allergens) setAllergens(d.allergens);
          if (d.preferredCuisines) setPreferredCuisines(d.preferredCuisines);
          if (d.diningMethod) setDiningMethod(d.diningMethod);
          if (d.isVeg !== undefined) setIsVeg(d.isVeg);
          if (d.theme) setAppTheme(d.theme);
          if (d.language) setAppLang(d.language);
          if (d.textSize) setAppTextSize(d.textSize);
          if (d.notificationPreferences) {
            const np = d.notificationPreferences;
            if (np.orderUpdates !== undefined) setNotifOrder(np.orderUpdates);
            if (np.bookingUpdates !== undefined) setNotifBooking(np.bookingUpdates);
            if (np.billUpdates !== undefined) setNotifBill(np.billUpdates);
            if (np.promotionalOffers !== undefined) setNotifPromo(np.promotionalOffers);
            if (np.pushEnabled !== undefined) setNotifPush(np.pushEnabled);
            if (np.emailEnabled !== undefined) setNotifEmail(np.emailEnabled);
          }
        }
      });

      // Stream addresses
      const addrRef = collection(db, targetCol, user.uid, 'addresses');
      unsubAddr = onSnapshot(addrRef, (snap) => {
        const list: IAddress[] = [];
        snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() } as IAddress));
        setAddresses(list);
      }, () => setAddresses([]));
    };

    setupProfileStream();

    return () => {
      unsubUser();
      unsubAddr();
    };
  }, [user?.uid]);

  // Stream reservations
  useEffect(() => {
    if (!user?.uid) return;
    setIsReservationsLoading(true);

    const colRef = collection(db, 'customers', user.uid, 'reservations');
    const unsub = onSnapshot(colRef, (snap) => {
      const list: IReservation[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as IReservation);
      });
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setReservations(list);
      setIsReservationsLoading(false);
    }, () => {
      // Fallback to users/{uid}/reservations
      const fallbackRef = collection(db, 'users', user.uid, 'reservations');
      onSnapshot(fallbackRef, (fSnap) => {
        const list: IReservation[] = [];
        fSnap.forEach(d => list.push({ id: d.id, ...d.data() } as IReservation));
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setReservations(list);
        setIsReservationsLoading(false);
      }, () => {
        setReservations([]);
        setIsReservationsLoading(false);
      });
    });

    return () => unsub();
  }, [user?.uid]);

  // Stream favourites in real-time from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    setIsFavouritesLoading(true);

    const favRef = collection(db, 'customers', user.uid, 'favorites');
    const unsub = onSnapshot(favRef, async (snap) => {
      const favList: any[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const restId = d.id;
        let restName = data.restaurantName || data.name || '';
        let restCuisine = data.cuisine || '';
        let restRating = data.rating || 4.5;

        // Attempt to fetch name/cuisine from restaurant document if missing
        if (!restName) {
          try {
            const restSnap = await getDoc(doc(db, 'restaurants', restId));
            if (restSnap.exists()) {
              const rData = restSnap.data();
              restName = rData.name || 'Restaurant';
              restCuisine = (rData.cuisines && rData.cuisines[0]) || rData.cuisine || '';
              restRating = rData.rating || 4.5;
            }
          } catch (_e) {}
        }

        favList.push({
          id: restId,
          name: restName || 'Spiral Partner Bistro',
          cuisine: restCuisine || 'Multi-Cuisine',
          rating: restRating
        });
      }
      setFavourites(favList);
      setIsFavouritesLoading(false);
    }, () => {
      setFavourites([]);
      setIsFavouritesLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  // Stream reviews
  useEffect(() => {
    if (!user?.uid) return;

    const revRef = collection(db, 'customers', user.uid, 'reviews');
    const unsub = onSnapshot(revRef, (snap) => {
      const list: IReview[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          restaurantName: data.restaurantName || 'Restaurant',
          starRating: data.starRating || 5,
          rating: data.rating || 'Excellent',
          notes: data.notes || data.comments || '',
          createdAt: data.createdAt || '',
          status: data.status || 'Published'
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCustomerReviews(list);
    }, () => setCustomerReviews([]));

    return () => unsub();
  }, [user?.uid]);

  // Stream Receipts / Orders
  useEffect(() => {
    if (!user?.uid) return;

    const ordersRef = collection(db, 'customers', user.uid, 'orders');
    const unsub = onSnapshot(ordersRef, (snap) => {
      const list: IReceiptOrder[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          orderId: data.orderId || d.id,
          restaurantName: data.restaurantName || 'Spiral Dine Partner',
          total: data.total || 0,
          subtotal: data.subtotal || data.total || 0,
          tax: data.tax || 0,
          serviceCharge: data.serviceCharge || 0,
          discount: data.discount || 0,
          paymentStatus: data.paymentStatus || 'paid',
          paymentMethod: data.paymentMethod || 'Online',
          createdAt: data.createdAt || '',
          items: data.items || []
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReceiptOrders(list);
    }, () => setReceiptOrders([]));

    return () => unsub();
  }, [user?.uid]);

  // Stream Support Tickets
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'supportTickets'),
      where('customerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: ISupportTicket[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          ticketId: data.ticketId || d.id,
          category: data.category || 'General Inquiry',
          description: data.description || '',
          status: data.status || 'open',
          orderId: data.orderId,
          bookingId: data.bookingId,
          createdAt: data.createdAt || '',
          responseMessage: data.responseMessage
        });
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSupportTickets(list);
    }, () => setSupportTickets([]));

    return () => unsub();
  }, [user?.uid]);

  // Handlers
  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        displayName,
        fullName: displayName,
        phoneNumber,
        phone: phoneNumber,
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'customers', user.uid), payload, { merge: true });
      await setDoc(doc(db, 'users', user.uid), payload, { merge: true }).catch(() => {});
      toast.success('Profile updated successfully.');
      handleSectionChange('menu');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update profile.');
    }
  };

  const handleSaveDiningPreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        dietaryPrefs,
        allergens,
        preferredCuisines,
        diningMethod,
        isVeg,
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'customers', user.uid), payload, { merge: true });
      await setDoc(doc(db, 'users', user.uid), payload, { merge: true }).catch(() => {});
      toast.success('Dining preferences synchronized.');
      handleSectionChange('menu');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save dining preferences.');
    }
  };

  const handleSaveNotificationPreferences = async () => {
    if (!user?.uid) return;

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        notificationPreferences: {
          orderUpdates: notifOrder,
          bookingUpdates: notifBooking,
          billUpdates: notifBill,
          promotionalOffers: notifPromo,
          pushEnabled: notifPush,
          emailEnabled: notifEmail
        },
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'customers', user.uid), payload, { merge: true });
      toast.success('Notification preferences updated.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update notifications.');
    }
  };

  const handleSaveAppSettings = async () => {
    if (!user?.uid) return;

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        theme: appTheme,
        language: appLang,
        textSize: appTextSize,
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'customers', user.uid), payload, { merge: true });
      toast.success('App preferences saved.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save settings.');
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast.error('No registered email found.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, user.email, getResetActionCodeSettings());
      toast.success(`Password reset instructions sent to ${user.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send password reset email.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    try {
      const nowIso = new Date().toISOString();
      await setDoc(doc(db, 'customers', user.uid), {
        displayName: 'Deleted User',
        phoneNumber: null,
        isDeleted: true,
        deletedAt: nowIso,
        updatedAt: nowIso
      }, { merge: true });

      if (auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
      setShowDeleteModal(false);
      toast.success('Account permanently deleted.');
      navigate('/customer/login');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Please sign in again before deleting your account.');
    }
  };

  const handleRemoveFavourite = async (restaurantId: string) => {
    if (!user?.uid) return;
    try {
      await deleteDoc(doc(db, 'customers', user.uid, 'favorites', restaurantId));
      setFavourites(prev => prev.filter(f => f.id !== restaurantId));
      toast.success('Removed from favourites.');
    } catch (e) {
      toast.error('Failed to remove favourite.');
    }
  };

  const handleCancelBooking = async (resId: string, restId: string) => {
    try {
      if (user?.uid) {
        await deleteDoc(doc(db, 'customers', user.uid, 'reservations', resId)).catch(() => {});
        await deleteDoc(doc(db, 'users', user.uid, 'reservations', resId)).catch(() => {});
      }
      await deleteDoc(doc(db, 'restaurants', restId, 'reservations', resId));
      setReservations(reservations.filter(r => r.id !== resId));
      toast.success('Reservation booking cancelled.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to cancel reservation.');
    }
  };

  const handleSubmitSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    if (!supportDesc.trim()) {
      toast.error('Please describe your issue.');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const nowIso = new Date().toISOString();
      const ticketId = `TICK-${Math.floor(100000 + Math.random() * 900000)}`;

      await setDoc(doc(db, 'supportTickets', ticketId), {
        id: ticketId,
        ticketId,
        customerId: user.uid,
        customerName: displayName,
        customerEmail: user.email || '',
        category: supportCategory,
        description: supportDesc.trim(),
        orderId: supportRefId.trim() || null,
        status: 'open',
        createdAt: nowIso,
        updatedAt: nowIso
      });

      toast.success('Support request logged. We will get back to you!');
      setSupportDesc('');
      setSupportRefId('');
      setIsSubmittingTicket(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit support request.');
      setIsSubmittingTicket(false);
    }
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrName.trim() || !newAddrDetail.trim()) return;
    const newAddr: IAddress = {
      id: Date.now().toString(),
      name: newAddrName,
      detail: newAddrDetail
    };
    setAddresses([...addresses, newAddr]);
    setNewAddrName('');
    setNewAddrDetail('');
    toast.success('New address book location registered.');
  };

  const handleDeleteAddress = (id: string) => {
    setAddresses(addresses.filter(a => a.id !== id));
    toast.success('Address removed.');
  };

  const handleWalletTopUp = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(topUpAmount);
    if (isNaN(val) || val <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setWalletBalance(b => b + val);
    setTopUpAmount('');
    toast.success(`Top Up of ${formatCurrency(val)} completed successfully!`);
  };

  const triggerLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully.');
      navigate('/customer/login');
    } catch (e) {
      console.error(e);
      toast.error('Failed to sign out.');
    }
  };

  const MenuRow = ({ icon: Icon, title, desc, onClick }: { icon: any, title: string, desc: string, onClick: () => void }) => (
    <button 
      onClick={onClick}
      className="w-full p-4 bg-white border border-[#EEE7E1] hover:border-[#E85D3F]/40 rounded-2xl flex items-center justify-between transition-all select-none shadow-xs hover:shadow-md cursor-pointer"
    >
      <div className="flex items-center space-x-3.5">
        <div className="w-10 h-10 bg-[#FFF8F2] border border-[#EEE7E1] rounded-xl flex items-center justify-center text-[#E85D3F]">
          <Icon className="w-4.5 h-4.5" />
        </div>
        <div className="text-left space-y-0.5">
          <h4 className="text-xs font-extrabold text-[#242424]">{title}</h4>
          <p className="text-[10px] text-[#6B6B6B] font-medium">{desc}</p>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-[#6B6B6B]" />
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 select-none text-left px-4 sm:px-6 py-6">
      
      {/* HEADER SECTION */}
      {activeSection !== 'menu' && (
        <button 
          onClick={() => handleSectionChange('menu')}
          className="flex items-center space-x-1.5 text-xs text-[#E85D3F] hover:underline font-extrabold transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Profile Hub</span>
        </button>
      )}

      {/* RENDER DYNAMIC SUB-SECTIONS */}
      {activeSection === 'menu' && (
        <div className="space-y-6">
          {/* Profile Quick Summary */}
          <div className="bg-white border border-[#EEE7E1] p-4 sm:p-6 rounded-3xl flex items-center justify-between gap-3 sm:gap-4 shadow-xs">
            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#E85D3F] rounded-2xl flex items-center justify-center text-base sm:text-lg font-extrabold text-white shadow-md shadow-[#E85D3F]/20 shrink-0">
                {displayName.substring(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-extrabold text-[#242424] truncate">{displayName}</h3>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-[9px] bg-[#FFF8F2] text-[#E85D3F] border border-[#EEE7E1] px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold block shrink-0">
                    Verified Customer
                  </span>
                  {user?.email && (
                    <span className="text-[10.5px] sm:text-[11px] text-[#6B6B6B] font-medium truncate max-w-[150px] xs:max-w-[220px] sm:max-w-none">{user.email}</span>
                  )}
                </div>
              </div>
            </div>
            <Award className="w-7 h-7 sm:w-8 sm:h-8 text-[#E85D3F] shrink-0" />
          </div>

          {/* Wallet Balance Card Teaser */}
          <div className="p-5 bg-gradient-to-br from-[#FFF8F2] via-[#FFFCF9] to-[#FFF3EB] border border-[#EEE7E1] rounded-3xl flex items-center justify-between shadow-xs">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 bg-[#E85D3F]/10 border border-[#E85D3F]/20 rounded-2xl flex items-center justify-center text-[#E85D3F]">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[9px] text-[#6B6B6B] font-extrabold uppercase block tracking-wider">Spiral Dine Pay Balance</span>
                <span className="text-base font-extrabold text-[#242424]">{formatCurrency(walletBalance)}</span>
              </div>
            </div>
            <button 
              onClick={() => handleSectionChange('wallet')}
              className="text-xs bg-[#E85D3F] hover:bg-[#D04B2F] text-white font-extrabold px-4 py-2 rounded-xl shadow-md shadow-[#E85D3F]/20 cursor-pointer transition-all"
            >
              Add Money
            </button>
          </div>

          {/* 1. MY ACTIVITY */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-[#242424] uppercase tracking-wider px-1">My Activity</h4>
            <div className="space-y-2.5">
              <MenuRow 
                icon={ShoppingBag} 
                title="My Orders" 
                desc="Track active kitchen orders and view completed dining sessions" 
                onClick={() => navigate('/customer/orders')}
              />
              <MenuRow 
                icon={Calendar} 
                title="My Table Bookings" 
                desc="Upcoming, confirmed & past table reservations" 
                onClick={() => handleSectionChange('reservations')}
              />
              <MenuRow 
                icon={Heart} 
                title="My Favourites" 
                desc="Saved dining spots & quick access to menus" 
                onClick={() => handleSectionChange('favorites')}
              />
              <MenuRow 
                icon={Star} 
                title="My Reviews & Ratings" 
                desc="Your submitted dining feedback and restaurant ratings" 
                onClick={() => handleSectionChange('reviews')}
              />
              <MenuRow 
                icon={Receipt} 
                title="My Receipts" 
                desc="Verified tax invoices and payment summaries" 
                onClick={() => handleSectionChange('receipts')}
              />
            </div>
          </div>

          {/* 2. PREFERENCES & SETTINGS */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-[#242424] uppercase tracking-wider px-1">Preferences & Personalization</h4>
            <div className="space-y-2.5">
              <MenuRow 
                icon={User} 
                title="Personal Information" 
                desc="Update name, registered email, and contact phone" 
                onClick={() => handleSectionChange('personal')}
              />
              <MenuRow 
                icon={Utensils} 
                title="Dining Preferences" 
                desc="Pure veg toggle, preferred cuisines, food allergies & dietary habits" 
                onClick={() => handleSectionChange('dining_prefs')}
              />
              <MenuRow 
                icon={Settings} 
                title="App Settings" 
                desc="Theme selection (Light/Dark), app language, and text size" 
                onClick={() => handleSectionChange('settings')}
              />
              <MenuRow 
                icon={Bell} 
                title="Notification Preferences" 
                desc="Order status alerts, table booking reminders, bills & offers" 
                onClick={() => handleSectionChange('notifications')}
              />
              <MenuRow 
                icon={CreditCard} 
                title="Payment Preferences" 
                desc="Payment security protocols and billing options" 
                onClick={() => handleSectionChange('payments')}
              />
              <MenuRow 
                icon={MapPin} 
                title="Saved Addresses" 
                desc="Home, work, and dining delivery locations" 
                onClick={() => handleSectionChange('addresses')}
              />
            </div>
          </div>

          {/* 3. HELP & SUPPORT */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-[#242424] uppercase tracking-wider px-1">Help & Information</h4>
            <div className="space-y-2.5">
              <MenuRow 
                icon={HelpCircle} 
                title="Help Centre & Support" 
                desc="Frequently asked questions, report an issue, and ticket history" 
                onClick={() => handleSectionChange('support')}
              />
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={triggerLogout}
            className="w-full p-4 bg-red-50 hover:bg-red-100/60 border border-red-200 rounded-2xl flex items-center justify-between text-red-600 font-extrabold transition-all cursor-pointer shadow-xs"
          >
            <div className="flex items-center space-x-3.5">
              <LogOut className="w-5 h-5 text-red-600" />
              <span>Sign Out</span>
            </div>
            <ArrowRight className="w-4 h-4 text-red-600" />
          </button>
        </div>
      )}

      {/* SUB-SECTION 1: PERSONAL INFORMATION */}
      {activeSection === 'personal' && (
        <form onSubmit={handleSavePersonalInfo} className="bg-white border border-[#EEE7E1] p-6 rounded-3xl space-y-5 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-[#242424]">Personal Information</h3>
            <p className="text-[10px] text-[#6B6B6B]">Update your authoritative customer profile details.</p>
          </div>

          <Input 
            label="Full Name" 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)} 
            required 
            className="bg-[#FAFAFA] border-[#EEE7E1] text-[#242424]"
          />
          <Input 
            label="Phone Number" 
            value={phoneNumber} 
            onChange={(e) => setPhoneNumber(e.target.value)} 
            placeholder="+91 98765 43210"
            className="bg-[#FAFAFA] border-[#EEE7E1] text-[#242424]"
          />

          <div>
            <label className="text-[10px] text-[#6B6B6B] font-extrabold uppercase tracking-wider block mb-1">Registered Email Address</label>
            <input 
              type="email" 
              value={user?.email || ''} 
              disabled 
              className="w-full bg-[#F5F5F5] border border-[#EEE7E1] text-[#6B6B6B] text-xs p-3 rounded-xl cursor-not-allowed"
            />
            <span className="text-[9px] text-[#6B6B6B] mt-1 block">Account authentication email managed via Firebase.</span>
          </div>

          <Button type="submit" className="w-full bg-[#E85D3F] hover:bg-[#D04B2F] text-white font-extrabold py-3.5 rounded-xl shadow-md shadow-[#E85D3F]/20">
            Save Profile Changes
          </Button>
        </form>
      )}

      {/* SUB-SECTION 2: DINING PREFERENCES */}
      {activeSection === 'dining_prefs' && (
        <form onSubmit={handleSaveDiningPreferences} className="bg-white border border-[#EEE7E1] p-6 rounded-3xl space-y-6 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-[#242424]">Dining Preferences & Allergens</h3>
            <p className="text-[10px] text-[#6B6B6B]">Personalize your restaurant menus and record kitchen allergy precautions.</p>
          </div>

          {/* Pure Veg Toggle */}
          <div className="p-4 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl flex items-center justify-between">
            <div>
              <h5 className="text-xs font-extrabold text-[#242424]">Pure Vegetarian Preference</h5>
              <p className="text-[10px] text-[#6B6B6B]">Filter restaurants and dishes to show only vegetarian choices.</p>
            </div>
            <input 
              type="checkbox" 
              checked={isVeg} 
              onChange={e => setIsVeg(e.target.checked)} 
              className="w-5 h-5 accent-[#2E7D32]"
            />
          </div>

          {/* Dining Method */}
          <div className="space-y-2">
            <label className="text-[10px] text-[#6B6B6B] font-extrabold uppercase tracking-wider block">Preferred Dining Method</label>
            <div className="grid grid-cols-3 gap-2">
              {['Dine In', 'Takeaway', 'Delivery'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDiningMethod(m)}
                  className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                    diningMethod === m 
                      ? 'bg-[#E85D3F] border-[#E85D3F] text-white shadow-xs' 
                      : 'bg-white border-[#EEE7E1] text-[#242424] hover:border-[#E85D3F]/40'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Cuisines */}
          <div className="space-y-2">
            <label className="text-[10px] text-[#6B6B6B] font-extrabold uppercase tracking-wider block">Preferred Cuisines</label>
            <div className="flex flex-wrap gap-2 text-xs">
              {['North Indian', 'South Indian', 'Italian', 'Chinese', 'Continental', 'Mexican', 'Japanese', 'Thai', 'Mughlai', 'Bakery'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPreferredCuisines(prev => prev.includes(c) ? prev.filter(item => item !== c) : [...prev, c])}
                  className={`py-1.5 px-3 border rounded-full font-bold transition-all ${
                    preferredCuisines.includes(c)
                      ? 'bg-[#E85D3F] border-[#E85D3F] text-white'
                      : 'bg-[#FAFAFA] border-[#EEE7E1] text-[#242424] hover:border-[#E85D3F]/30'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Dietary Habits */}
          <div className="space-y-2">
            <label className="text-[10px] text-[#6B6B6B] font-extrabold uppercase tracking-wider block">Dietary Profile</label>
            <div className="flex flex-wrap gap-2 text-xs">
              {['Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Jain', 'Keto', 'Nut-Free', 'Dairy-Free'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDietaryPrefs(prev => prev.includes(d) ? prev.filter(item => item !== d) : [...prev, d])}
                  className={`py-1.5 px-3 border rounded-full font-bold transition-all ${
                    dietaryPrefs.includes(d)
                      ? 'bg-[#2E7D32] border-[#2E7D32] text-white'
                      : 'bg-[#FAFAFA] border-[#EEE7E1] text-[#242424] hover:border-[#2E7D32]/30'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Allergens warning lists */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              <label className="text-[10px] font-extrabold uppercase tracking-wider">Food Allergies & Intolerances</label>
            </div>
            <p className="text-[10px] text-[#6B6B6B]">Allergy information is forwarded to restaurant kitchen tickets as a precaution. Always confirm with staff before eating.</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {['Peanuts', 'Tree Nuts', 'Milk / Dairy', 'Eggs', 'Shellfish', 'Fish', 'Soy', 'Wheat / Gluten', 'Mustard', 'Sesame'].map(all => (
                <button
                  key={all}
                  type="button"
                  onClick={() => setAllergens(prev => prev.includes(all) ? prev.filter(a => a !== all) : [...prev, all])}
                  className={`py-1.5 px-3 border rounded-full font-bold transition-all ${
                    allergens.includes(all)
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'bg-[#FAFAFA] border-[#EEE7E1] text-[#242424] hover:border-red-300'
                  }`}
                >
                  {all}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full bg-[#E85D3F] hover:bg-[#D04B2F] text-white font-extrabold py-3.5 rounded-xl shadow-md shadow-[#E85D3F]/20">
            Save Dining Preferences
          </Button>
        </form>
      )}

      {/* SUB-SECTION 3: RESERVATIONS */}
      {activeSection === 'reservations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h3 className="text-sm font-extrabold text-[#242424]">My Table Bookings</h3>
              <p className="text-[10px] text-[#6B6B6B]">Manage upcoming and completed table reservations.</p>
            </div>
            <button 
              onClick={() => navigate('/customer/booking')}
              className="text-xs bg-[#E85D3F] hover:bg-[#D04B2F] text-white px-3.5 py-1.5 rounded-xl font-extrabold transition-all"
            >
              Book a Table
            </button>
          </div>

          {isReservationsLoading ? (
            <div className="py-12 text-center text-[#6B6B6B] text-xs">Loading reservations...</div>
          ) : reservations.length === 0 ? (
            <div className="py-12 text-center border border-[#EEE7E1] border-dashed rounded-3xl bg-white p-6 space-y-3">
              <Calendar className="w-10 h-10 text-[#6B6B6B] mx-auto opacity-50" />
              <h4 className="text-sm font-bold text-[#242424]">No table bookings found</h4>
              <p className="text-xs text-[#6B6B6B]">Reserve tables ahead of time at partner restaurants.</p>
              <button 
                onClick={() => navigate('/customer/booking')}
                className="mt-2 px-4 py-2 bg-[#E85D3F] text-white text-xs font-bold rounded-xl"
              >
                Explore Restaurants & Book
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {reservations.map(res => (
                <div key={res.id} className="p-5 bg-white border border-[#EEE7E1] rounded-2xl flex flex-col justify-between gap-3 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="text-sm font-extrabold text-[#242424]">{res.restaurantName}</h4>
                      <div className="flex items-center gap-3 text-xs text-[#6B6B6B] font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#E85D3F]" />
                          {res.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#E85D3F]" />
                          {res.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-[#E85D3F]" />
                          {res.guests} Diners
                        </span>
                      </div>
                      {res.tableNumber && (
                        <p className="text-xs text-[#2E7D32] font-bold">Assigned Table: #{res.tableNumber}</p>
                      )}
                      {res.specialNotes && (
                        <p className="text-[11px] text-[#6B6B6B]">Special Note: {res.specialNotes}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                      res.status === 'Confirmed' ? 'bg-green-100 text-green-700' :
                      res.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {res.status}
                    </span>
                  </div>

                  {(res.status === 'Pending' || res.status === 'Confirmed') && (
                    <div className="flex justify-end gap-2 pt-2 border-t border-[#EEE7E1]">
                      <button 
                        onClick={() => handleCancelBooking(res.id, res.restaurantId)}
                        className="px-3.5 py-1.5 border border-red-300 hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl transition-all"
                      >
                        Cancel Reservation
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 4: FAVOURITES */}
      {activeSection === 'favorites' && (
        <div className="space-y-4">
          <div className="px-1">
            <h3 className="text-sm font-extrabold text-[#242424]">My Favourites</h3>
            <p className="text-[10px] text-[#6B6B6B]">Saved dining destinations across your devices.</p>
          </div>

          {isFavouritesLoading ? (
            <div className="py-12 text-center text-[#6B6B6B] text-xs">Loading saved favourites...</div>
          ) : favourites.length === 0 ? (
            <div className="py-12 text-center border border-[#EEE7E1] border-dashed rounded-3xl bg-white p-6 space-y-3">
              <Heart className="w-10 h-10 text-[#6B6B6B] mx-auto opacity-40" />
              <h4 className="text-sm font-bold text-[#242424]">No favourite restaurants yet.</h4>
              <p className="text-xs text-[#6B6B6B]">Save your go-to dining venues to access them quickly.</p>
              <button 
                onClick={() => navigate('/customer')}
                className="mt-2 px-4 py-2 bg-[#E85D3F] text-white text-xs font-bold rounded-xl"
              >
                Explore Restaurants
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {favourites.map(fav => (
                <div 
                  key={fav.id} 
                  className="p-4 bg-white border border-[#EEE7E1] hover:border-[#E85D3F]/40 rounded-2xl flex items-center justify-between shadow-xs transition-all"
                >
                  <div 
                    onClick={() => navigate(`/customer/restaurant/${fav.id}`)}
                    className="flex items-center space-x-3.5 cursor-pointer flex-1"
                  >
                    <div className="w-10 h-10 bg-[#FFF8F2] border border-[#EEE7E1] rounded-xl flex items-center justify-center text-[#E85D3F]">
                      <Utensils className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-[#242424]">{fav.name}</h4>
                      <p className="text-[10px] text-[#6B6B6B] font-medium">{fav.cuisine}</p>
                      {fav.rating && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-[#242424] mt-0.5">
                          <Star className="w-3 h-3 text-[#FFB300] fill-current" />
                          <span>{fav.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button 
                    onClick={() => handleRemoveFavourite(fav.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Remove from favourites"
                  >
                    <Heart className="w-4.5 h-4.5 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 5: REVIEWS */}
      {activeSection === 'reviews' && (
        <div className="space-y-4">
          <div className="px-1">
            <h3 className="text-sm font-extrabold text-[#242424]">My Reviews & Ratings</h3>
            <p className="text-[10px] text-[#6B6B6B]">Feedback and ratings submitted from your orders.</p>
          </div>

          {customerReviews.length === 0 ? (
            <div className="py-12 text-center border border-[#EEE7E1] border-dashed rounded-3xl bg-white p-6 space-y-2">
              <Star className="w-10 h-10 text-[#6B6B6B] mx-auto opacity-40" />
              <h4 className="text-sm font-bold text-[#242424]">No reviews submitted yet.</h4>
              <p className="text-xs text-[#6B6B6B]">Rate dishes after completing dining orders to help improve service.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customerReviews.map(rev => (
                <div key={rev.id} className="p-5 bg-white border border-[#EEE7E1] rounded-2xl space-y-2 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-extrabold text-[#242424]">{rev.restaurantName}</h4>
                      <span className="text-[10px] text-[#6B6B6B]">{rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : 'Recent'}</span>
                    </div>
                    <div className="flex items-center text-[#FFB300]">
                      {Array.from({ length: rev.starRating || 5 }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                  </div>
                  {rev.notes && (
                    <p className="text-xs text-[#242424] bg-[#FAFAFA] p-3 rounded-xl border border-[#EEE7E1]">
                      "{rev.notes}"
                    </p>
                  )}
                  <div className="flex justify-end">
                    <span className="text-[9px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded">
                      {rev.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 6: RECEIPTS */}
      {activeSection === 'receipts' && (
        <div className="space-y-4">
          <div className="px-1">
            <h3 className="text-sm font-extrabold text-[#242424]">My Order Receipts</h3>
            <p className="text-[10px] text-[#6B6B6B]">Verified invoices for completed and settled dining sessions.</p>
          </div>

          {receiptOrders.length === 0 ? (
            <div className="py-12 text-center border border-[#EEE7E1] border-dashed rounded-3xl bg-white p-6 space-y-2">
              <Receipt className="w-10 h-10 text-[#6B6B6B] mx-auto opacity-40" />
              <h4 className="text-sm font-bold text-[#242424]">No receipts available yet.</h4>
              <p className="text-xs text-[#6B6B6B]">Tax receipts are generated when orders are completed and bills paid.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receiptOrders.map(order => (
                <div key={order.id} className="p-5 bg-white border border-[#EEE7E1] rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-[#242424]">{order.restaurantName}</h4>
                    <p className="text-[10px] text-[#6B6B6B]">
                      Order #{order.orderId.substring(order.orderId.length - 6).toUpperCase()} • {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''}
                    </p>
                    <span className="text-xs font-extrabold text-[#242424] block">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                  <div className="text-right space-y-2">
                    <span className="text-[9px] bg-green-50 text-green-700 font-bold px-2.5 py-1 rounded-full uppercase block">
                      {order.paymentStatus}
                    </span>
                    <button 
                      onClick={() => setSelectedReceipt(order)}
                      className="text-xs text-[#E85D3F] font-bold hover:underline"
                    >
                      View Invoice →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Receipt Modal */}
          {selectedReceipt && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#EEE7E1]">
                <div className="flex justify-between items-center border-b border-[#EEE7E1] pb-3">
                  <div>
                    <h4 className="text-sm font-extrabold text-[#242424]">Tax Invoice & Receipt</h4>
                    <span className="text-[10px] text-[#6B6B6B]">ID: {selectedReceipt.orderId}</span>
                  </div>
                  <button 
                    onClick={() => setSelectedReceipt(null)}
                    className="text-[#6B6B6B] hover:text-[#242424] text-xs font-bold"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1">
                    <span className="text-[#6B6B6B]">Restaurant</span>
                    <span className="font-bold text-[#242424]">{selectedReceipt.restaurantName}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#6B6B6B]">Date</span>
                    <span className="font-bold text-[#242424]">{new Date(selectedReceipt.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#6B6B6B]">Payment Method</span>
                    <span className="font-bold text-[#242424]">{selectedReceipt.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#6B6B6B]">Payment Status</span>
                    <span className="font-bold text-green-600 uppercase">{selectedReceipt.paymentStatus}</span>
                  </div>

                  <div className="border-t border-[#EEE7E1] pt-2 mt-2 space-y-1">
                    <div className="flex justify-between text-[#6B6B6B]">
                      <span>Subtotal</span>
                      <span>{formatCurrency(selectedReceipt.subtotal || selectedReceipt.total)}</span>
                    </div>
                    {selectedReceipt.tax ? (
                      <div className="flex justify-between text-[#6B6B6B]">
                        <span>Taxes & GST</span>
                        <span>{formatCurrency(selectedReceipt.tax)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-extrabold text-[#242424] text-sm pt-2 border-t border-[#EEE7E1]">
                      <span>Total Paid</span>
                      <span>{formatCurrency(selectedReceipt.total)}</span>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedReceipt(null)}
                  className="w-full bg-[#E85D3F] text-white py-2.5 rounded-xl font-bold text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 7: APP SETTINGS */}
      {activeSection === 'settings' && (
        <div className="bg-white border border-[#EEE7E1] p-6 rounded-3xl space-y-6 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-[#242424]">App Preferences & Privacy</h3>
            <p className="text-[10px] text-[#6B6B6B]">Configure appearance, language, and security policies.</p>
          </div>

          <div className="space-y-4">
            {/* Theme */}
            <div className="space-y-2">
              <label className="text-[10px] text-[#6B6B6B] font-extrabold uppercase tracking-wider block">Theme Preference</label>
              <div className="grid grid-cols-3 gap-2">
                {['System', 'Light', 'Dark'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAppTheme(t)}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                      appTheme === t
                        ? 'bg-[#E85D3F] border-[#E85D3F] text-white shadow-xs'
                        : 'bg-[#FAFAFA] border-[#EEE7E1] text-[#242424]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="space-y-2">
              <label className="text-[10px] text-[#6B6B6B] font-extrabold uppercase tracking-wider block">Language</label>
              <select 
                value={appLang} 
                onChange={e => setAppLang(e.target.value)}
                className="w-full bg-[#FAFAFA] border border-[#EEE7E1] text-[#242424] p-3 rounded-xl text-xs font-bold focus:outline-none"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
                <option value="Spanish">Spanish (Español)</option>
                <option value="Telugu">Telugu (తెలుగు)</option>
              </select>
            </div>

            {/* Text Size */}
            <div className="space-y-2">
              <label className="text-[10px] text-[#6B6B6B] font-extrabold uppercase tracking-wider block">Text Size</label>
              <div className="grid grid-cols-3 gap-2">
                {['Small', 'Medium', 'Large'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAppTextSize(s)}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                      appTextSize === s
                        ? 'bg-[#E85D3F] border-[#E85D3F] text-white shadow-xs'
                        : 'bg-[#FAFAFA] border-[#EEE7E1] text-[#242424]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSaveAppSettings} className="w-full bg-[#E85D3F] text-white font-bold py-3 rounded-xl">
              Save App Preferences
            </Button>

            <div className="border-t border-[#EEE7E1] pt-4 space-y-3">
              <h5 className="text-xs font-extrabold text-[#242424]">Security & Legal</h5>
              <div className="space-y-2">
                <button 
                  onClick={handlePasswordReset}
                  className="w-full p-3 bg-[#FAFAFA] border border-[#EEE7E1] hover:border-[#E85D3F]/30 rounded-xl text-xs font-bold text-[#242424] flex items-center justify-between"
                >
                  <span>Reset / Change Password</span>
                  <Lock className="w-4 h-4 text-[#6B6B6B]" />
                </button>
                <button 
                  onClick={() => setShowPrivacyModal(true)}
                  className="w-full p-3 bg-[#FAFAFA] border border-[#EEE7E1] hover:border-[#E85D3F]/30 rounded-xl text-xs font-bold text-[#242424] flex items-center justify-between"
                >
                  <span>Privacy Policy</span>
                  <FileText className="w-4 h-4 text-[#6B6B6B]" />
                </button>
                <button 
                  onClick={() => setShowTermsModal(true)}
                  className="w-full p-3 bg-[#FAFAFA] border border-[#EEE7E1] hover:border-[#E85D3F]/30 rounded-xl text-xs font-bold text-[#242424] flex items-center justify-between"
                >
                  <span>Terms & Conditions</span>
                  <FileText className="w-4 h-4 text-[#6B6B6B]" />
                </button>
                <button 
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full p-3 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl text-xs font-bold text-red-600 flex items-center justify-between"
                >
                  <span>Delete Customer Account</span>
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-SECTION 8: NOTIFICATION PREFERENCES */}
      {activeSection === 'notifications' && (
        <div className="bg-white border border-[#EEE7E1] p-6 rounded-3xl space-y-5 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-[#242424]">Notification Preferences</h3>
            <p className="text-[10px] text-[#6B6B6B]">Select which updates you want to receive across devices.</p>
          </div>

          <div className="space-y-3 text-xs text-[#242424]">
            <div className="flex justify-between items-center py-2.5 border-b border-[#EEE7E1]">
              <div>
                <h5 className="font-extrabold">Order Status Updates</h5>
                <p className="text-[10px] text-[#6B6B6B]">Live notifications as dishes are prepared and served.</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifOrder} 
                onChange={e => setNotifOrder(e.target.checked)} 
                className="w-4.5 h-4.5 accent-[#E85D3F]"
              />
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-[#EEE7E1]">
              <div>
                <h5 className="font-extrabold">Table Booking Alerts</h5>
                <p className="text-[10px] text-[#6B6B6B]">Reminders, confirmations, and modifications for reservations.</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifBooking} 
                onChange={e => setNotifBooking(e.target.checked)} 
                className="w-4.5 h-4.5 accent-[#E85D3F]"
              />
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-[#EEE7E1]">
              <div>
                <h5 className="font-extrabold">Bill & Payment Receipts</h5>
                <p className="text-[10px] text-[#6B6B6B]">Invoices and payment settlement confirmations.</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifBill} 
                onChange={e => setNotifBill(e.target.checked)} 
                className="w-4.5 h-4.5 accent-[#E85D3F]"
              />
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-[#EEE7E1]">
              <div>
                <h5 className="font-extrabold">Promotional Offers</h5>
                <p className="text-[10px] text-[#6B6B6B]">Discounts, happy hours, and dining perks.</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifPromo} 
                onChange={e => setNotifPromo(e.target.checked)} 
                className="w-4.5 h-4.5 accent-[#E85D3F]"
              />
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-[#EEE7E1]">
              <div>
                <h5 className="font-extrabold">Push Notifications</h5>
                <p className="text-[10px] text-[#6B6B6B]">Instant browser and device push alerts.</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifPush} 
                onChange={e => setNotifPush(e.target.checked)} 
                className="w-4.5 h-4.5 accent-[#E85D3F]"
              />
            </div>

            <div className="flex justify-between items-center py-2.5">
              <div>
                <h5 className="font-extrabold">Email Notifications</h5>
                <p className="text-[10px] text-[#6B6B6B]">Receive receipts and reservation confirmations via email.</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifEmail} 
                onChange={e => setNotifEmail(e.target.checked)} 
                className="w-4.5 h-4.5 accent-[#E85D3F]"
              />
            </div>
          </div>

          <Button onClick={handleSaveNotificationPreferences} className="w-full bg-[#E85D3F] text-white font-bold py-3 rounded-xl">
            Save Notification Settings
          </Button>
        </div>
      )}

      {/* SUB-SECTION 9: PAYMENT PREFERENCES */}
      {activeSection === 'payments' && (
        <div className="bg-white border border-[#EEE7E1] p-6 rounded-3xl space-y-5 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-[#242424]">Payment Preferences & Security</h3>
            <p className="text-[10px] text-[#6B6B6B]">Secure transaction gateways and invoice receipts.</p>
          </div>

          <div className="p-4 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl flex items-center space-x-3 text-xs text-[#242424]">
            <ShieldCheck className="w-6 h-6 text-[#2E7D32] shrink-0" />
            <p className="text-[11px] text-[#6B6B6B]">
              SpiralDine does not store raw credit/debit card numbers, CVVs, or UPI PINs on any database. All transactions are securely processed through RBI-compliant, PCI-DSS certified payment gateways.
            </p>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs font-extrabold text-[#242424]">Supported Payment Methods</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-[#FAFAFA] border border-[#EEE7E1] rounded-xl flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#E85D3F]" />
                <span className="font-bold">UPI / QR Pay</span>
              </div>
              <div className="p-3 bg-[#FAFAFA] border border-[#EEE7E1] rounded-xl flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#E85D3F]" />
                <span className="font-bold">Cards (Visa / Master)</span>
              </div>
              <div className="p-3 bg-[#FAFAFA] border border-[#EEE7E1] rounded-xl flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#E85D3F]" />
                <span className="font-bold">Spiral Dine Wallet</span>
              </div>
              <div className="p-3 bg-[#FAFAFA] border border-[#EEE7E1] rounded-xl flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#E85D3F]" />
                <span className="font-bold">Cash at Counter</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => handleSectionChange('receipts')}
            className="w-full p-3 bg-[#FAFAFA] border border-[#EEE7E1] hover:border-[#E85D3F]/40 text-xs font-bold text-[#E85D3F] rounded-xl flex items-center justify-center gap-1.5"
          >
            <Receipt className="w-4 h-4" />
            <span>View All Payment Receipts & Invoices</span>
          </button>
        </div>
      )}

      {/* SUB-SECTION 10: SAVED ADDRESSES */}
      {activeSection === 'addresses' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#EEE7E1] p-6 rounded-3xl space-y-4 shadow-xs">
            <h3 className="text-sm font-extrabold text-[#242424]">Saved Address Book</h3>
            <div className="space-y-3">
              {addresses.map(a => (
                <div key={a.id} className="p-3 bg-[#FAFAFA] border border-[#EEE7E1] rounded-xl flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[9px] bg-white border border-[#EEE7E1] px-2 py-0.5 rounded text-[#E85D3F] font-bold uppercase">{a.name}</span>
                    <p className="text-xs text-[#242424] mt-1">{a.detail}</p>
                  </div>
                  <button onClick={() => handleDeleteAddress(a.id)} className="text-red-500 hover:text-red-700 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleAddAddress} className="bg-white border border-[#EEE7E1] p-6 rounded-3xl space-y-3 shadow-xs">
            <h4 className="text-xs font-bold text-[#242424] uppercase tracking-wider">Register New Address</h4>
            <Input 
              label="Address Label (e.g. Home, Office)" 
              value={newAddrName} 
              onChange={e => setNewAddrName(e.target.value)} 
              placeholder="e.g. Work, Residence" 
              required
              className="bg-[#FAFAFA] border-[#EEE7E1]"
            />
            <Input 
              label="Complete Address Detail" 
              value={newAddrDetail} 
              onChange={e => setNewAddrDetail(e.target.value)} 
              placeholder="Door number, street, area..." 
              required
              className="bg-[#FAFAFA] border-[#EEE7E1]"
            />
            <Button type="submit" className="w-full bg-[#E85D3F] text-white font-bold py-3">
              <Plus className="w-3.5 h-3.5 mr-1 inline-block" /> Add to Address Book
            </Button>
          </form>
        </div>
      )}

      {/* SUB-SECTION 11: HELP & SUPPORT */}
      {activeSection === 'support' && (
        <div className="space-y-6">
          {/* FAQ Accordion */}
          <div className="bg-white border border-[#EEE7E1] p-6 rounded-3xl space-y-4 shadow-xs">
            <h3 className="text-sm font-extrabold text-[#242424]">Frequently Asked Questions</h3>
            <div className="space-y-2.5 text-xs">
              {[
                { q: "How do I place an order at my table?", a: "Scan the QR code placed on your table to open the live digital menu, select items, and send orders straight to the restaurant kitchen." },
                { q: "How do I request my bill and pay?", a: "Tap 'Request Bill' on your active session. You can pay online via UPI / Cards or request cash payment from your waiter." },
                { q: "Can I cancel or modify my table reservation?", a: "Yes, upcoming bookings can be cancelled under My Table Bookings prior to the reserved dining time." },
                { q: "How are food allergies communicated?", a: "Food allergies recorded under Dining Preferences are automatically shown on kitchen tickets for your orders." }
              ].map((faq, i) => (
                <details key={i} className="p-3 bg-[#FAFAFA] border border-[#EEE7E1] rounded-xl cursor-pointer">
                  <summary className="font-extrabold text-[#242424]">{faq.q}</summary>
                  <p className="mt-2 text-[#6B6B6B] leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>

          {/* Report an Issue Form */}
          <form onSubmit={handleSubmitSupportTicket} className="bg-white border border-[#EEE7E1] p-6 rounded-3xl space-y-4 shadow-xs">
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold text-[#242424]">Report an Issue / Contact Support</h3>
              <p className="text-[10px] text-[#6B6B6B]">Submit a request to the SpiralDine helpdesk.</p>
            </div>

            <div>
              <label className="text-[10px] text-[#6B6B6B] font-extrabold uppercase tracking-wider block mb-1">Issue Category</label>
              <select 
                value={supportCategory} 
                onChange={e => setSupportCategory(e.target.value)}
                className="w-full bg-[#FAFAFA] border border-[#EEE7E1] text-[#242424] p-3 rounded-xl text-xs font-bold focus:outline-none"
              >
                <option value="Order Issue">Order Issue</option>
                <option value="Payment Issue">Payment Issue</option>
                <option value="Table Booking">Table Booking</option>
                <option value="Restaurant Service">Restaurant Service</option>
                <option value="App Bug">App Bug</option>
                <option value="General Inquiry">General Inquiry</option>
              </select>
            </div>

            <Input 
              label="Related Order ID or Booking ID (Optional)"
              value={supportRefId}
              onChange={e => setSupportRefId(e.target.value)}
              placeholder="e.g. ORD-12345 or RES-67890"
              className="bg-[#FAFAFA] border-[#EEE7E1]"
            />

            <div>
              <label className="text-[10px] text-[#6B6B6B] font-extrabold uppercase tracking-wider block mb-1">Describe what happened</label>
              <textarea 
                rows={3}
                value={supportDesc}
                onChange={e => setSupportDesc(e.target.value)}
                placeholder="Provide details about the issue..."
                required
                className="w-full bg-[#FAFAFA] border border-[#EEE7E1] text-[#242424] p-3 rounded-xl text-xs focus:outline-none"
              />
            </div>

            <Button 
              type="submit" 
              disabled={isSubmittingTicket} 
              className="w-full bg-[#E85D3F] text-white font-extrabold py-3 rounded-xl shadow-md shadow-[#E85D3F]/20"
            >
              {isSubmittingTicket ? 'Submitting...' : 'Submit Support Request'}
            </Button>
          </form>

          {/* My Support Tickets */}
          {supportTickets.length > 0 && (
            <div className="bg-white border border-[#EEE7E1] p-6 rounded-3xl space-y-4 shadow-xs">
              <h3 className="text-sm font-extrabold text-[#242424]">My Support Tickets</h3>
              <div className="space-y-3">
                {supportTickets.map(ticket => (
                  <div key={ticket.id} className="p-4 bg-[#FAFAFA] border border-[#EEE7E1] rounded-2xl space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="text-xs font-extrabold text-[#242424]">{ticket.ticketId}</h5>
                        <span className="text-[10px] text-[#6B6B6B] font-medium">{ticket.category}</span>
                      </div>
                      <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#242424]">{ticket.description}</p>
                    {ticket.responseMessage && (
                      <p className="text-xs text-[#2E7D32] bg-green-50 p-2.5 rounded-xl border border-green-200">
                        Response: {ticket.responseMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-SECTION 12: WALLET */}
      {activeSection === 'wallet' && (
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-r from-[#FFF8F2] via-[#FFFCF9] to-[#FFF3EB] border border-[#EEE7E1] rounded-3xl space-y-4 shadow-xs">
            <div>
              <span className="text-[9px] text-[#6B6B6B] font-extrabold uppercase tracking-wider block">Available Balance</span>
              <h3 className="text-2xl font-extrabold text-[#242424]">{formatCurrency(walletBalance)}</h3>
            </div>

            <form onSubmit={handleWalletTopUp} className="flex gap-2">
              <input 
                type="number" 
                value={topUpAmount}
                onChange={e => setTopUpAmount(e.target.value)}
                placeholder={`Enter amount (e.g. ${formatCurrency(500)})`}
                className="flex-1 bg-white border border-[#EEE7E1] focus:border-[#E85D3F] focus:outline-none rounded-xl text-xs px-3.5 py-3 text-[#242424]"
              />
              <button 
                type="submit" 
                className="bg-[#E85D3F] hover:bg-[#D04B2F] text-white text-xs font-extrabold px-5 rounded-xl transition-all shadow-md shadow-[#E85D3F]/20"
              >
                Top Up
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PRIVACY POLICY MODAL */}
      {showPrivacyModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#EEE7E1]">
            <h4 className="text-sm font-extrabold text-[#242424]">Privacy Policy</h4>
            <div className="text-xs text-[#6B6B6B] space-y-2 max-h-60 overflow-y-auto leading-relaxed">
              <p>SpiralDine respects your privacy. We collect minimal personal details (name, email, phone number) to deliver dining orders, verify table reservations, and provide receipts.</p>
              <p>We do not sell customer data to third parties. Raw card credentials and UPI PINs are processed via certified payment gateways and are never stored on our servers.</p>
            </div>
            <button onClick={() => setShowPrivacyModal(false)} className="w-full bg-[#E85D3F] text-white py-2.5 rounded-xl font-bold text-xs">
              Close
            </button>
          </div>
        </div>
      )}

      {/* TERMS MODAL */}
      {showTermsModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-[#EEE7E1]">
            <h4 className="text-sm font-extrabold text-[#242424]">Terms & Conditions</h4>
            <div className="text-xs text-[#6B6B6B] space-y-2 max-h-60 overflow-y-auto leading-relaxed">
              <p>By using SpiralDine dining features, you agree that table allocations are subject to restaurant capacity.</p>
              <p>Dietary and allergen records are communicated to kitchens as a helpful precaution. Diners must independently verify allergens with restaurant servers prior to consumption.</p>
            </div>
            <button onClick={() => setShowTermsModal(false)} className="w-full bg-[#E85D3F] text-white py-2.5 rounded-xl font-bold text-xs">
              Close
            </button>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#EEE7E1]">
            <h4 className="text-sm font-extrabold text-red-600">Delete Account Permanently?</h4>
            <p className="text-xs text-[#6B6B6B] leading-relaxed">
              This action cannot be undone. Your login credentials and personal profile fields will be cleared immediately. Historical tax receipts and restaurant transaction ledgers are retained anonymously for legal compliance.
            </p>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setShowDeleteModal(false)} 
                className="flex-1 bg-[#FAFAFA] border border-[#EEE7E1] text-[#242424] py-2.5 rounded-xl font-bold text-xs"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAccount} 
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-bold text-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfilePage;
