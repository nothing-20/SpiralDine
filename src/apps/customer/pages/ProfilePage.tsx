import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import { 
  User, Settings, Check, Award, Heart, Bell, ChevronRight, 
  ChevronLeft, MapPin, Calendar, Clock, CreditCard, Wallet, 
  ShieldAlert, BookOpen, LogOut, ArrowRight, Star, Plus, Trash2, Navigation,
  ShoppingBag, Utensils
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
  seatingPreference?: string;
  directions?: string;
  lat?: number;
  lng?: number;
}

interface IReward {
  title: string;
  desc: string;
  cost: number;
}

interface ITransaction {
  id: string;
  desc: string;
  amount: number;
  type: 'debit' | 'credit';
  date: string;
}

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formatCurrency } = useCurrency();

  // Navigation controller for sub-sections
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

  // State: Saved Addresses
  const [addresses, setAddresses] = useState<IAddress[]>([]);
  const [newAddrName, setNewAddrName] = useState('');
  const [newAddrDetail, setNewAddrDetail] = useState('');

  // State: Reservations
  const [reservations, setReservations] = useState<IReservation[]>([]);
  const [isReservationsLoading, setIsReservationsLoading] = useState(false);

  // State: Rewards
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const rewardsList: IReward[] = [];

  // State: Wallet & Transactions
  const [walletBalance, setWalletBalance] = useState(0);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [transactions, setTransactions] = useState<ITransaction[]>([]);

  // State: Favourites & Dining History
  const [favourites, setFavourites] = useState<any[]>([]);
  const [diningHistory, setDiningHistory] = useState<any[]>([]);

  // State: Notifications preferences
  const [notifSms, setNotifSms] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [notifPush, setNotifPush] = useState(true);

  // State: Settings
  const [appLang, setAppLang] = useState('English');
  const [appPrivacy, setAppPrivacy] = useState(true);

  // Stream user document (Wallet, Loyalty, Profile Data) from Firestore
  // Stream customer document (Wallet, Loyalty, Profile Data) from Firestore (customers/{uid} with fallback)
  useEffect(() => {
    if (!user?.uid) return;

    let unsubUser = () => {};
    let unsubAddr = () => {};
    let unsubTx = () => {};
    let unsubHist = () => {};

    const setupCustomerStreams = async () => {
      // 1. Determine profile path: check customers/{uid} first, fallback to users/{uid}
      let profileCollection = 'customers';
      try {
        const custSnap = await getDoc(doc(db, 'customers', user.uid));
        if (!custSnap.exists()) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            profileCollection = 'users';
          }
        }
      } catch (_e) {
        profileCollection = 'customers';
      }

      const userDocRef = doc(db, profileCollection, user.uid);
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
        }
      }, (err) => {
        console.error('Error fetching customer profile:', err);
      });

      // Stream addresses (from customers/{uid}/addresses with fallback)
      const addrRef = collection(db, profileCollection, user.uid, 'addresses');
      unsubAddr = onSnapshot(addrRef, (snap) => {
        const list: IAddress[] = [];
        snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() } as IAddress));
        setAddresses(list);
      }, () => setAddresses([]));

      // Stream transactions
      const txRef = collection(db, profileCollection, user.uid, 'transactions');
      unsubTx = onSnapshot(txRef, (snap) => {
        const list: ITransaction[] = [];
        snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() } as ITransaction));
        setTransactions(list);
      }, () => setTransactions([]));

      // Stream dining history
      const histRef = collection(db, profileCollection, user.uid, 'diningHistory');
      unsubHist = onSnapshot(histRef, (snap) => {
        const list: any[] = [];
        snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
        setDiningHistory(list);
      }, () => setDiningHistory([]));
    };

    setupCustomerStreams();

    return () => {
      unsubUser();
      unsubAddr();
      unsubTx();
      unsubHist();
    };
  }, [user?.uid]);

  // Stream reservations from Firestore in real-time
  useEffect(() => {
    if (!user?.uid) return;
    
    setIsReservationsLoading(true);
    let unsubscribe = () => {};

    const setupReservationStream = async () => {
      let targetCollection = 'customers';
      try {
        const custSnap = await getDoc(doc(db, 'customers', user.uid));
        if (!custSnap.exists()) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            targetCollection = 'users';
          }
        }
      } catch (_e) {}

      const colRef = collection(db, targetCollection, user.uid, 'reservations');
      unsubscribe = onSnapshot(colRef, (snap) => {
        const list: IReservation[] = [];
        snap.forEach(d => {
          list.push({ id: d.id, ...d.data() } as IReservation);
        });
        list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setReservations(list);
        setIsReservationsLoading(false);
      }, (error) => {
        console.error('Error streaming customer reservations:', error);
        setReservations([]);
        setIsReservationsLoading(false);
      });
    };

    setupReservationStream();

    return () => unsubscribe();
  }, [user?.uid]);

  // Fetch Favourites
  useEffect(() => {
    if (activeSection === 'favorites') {
      const savedFavs = localStorage.getItem('diner_favourites');
      if (savedFavs) {
        try {
          const parsed = JSON.parse(savedFavs);
          setFavourites(parsed.map((id: string) => ({
            id,
            name: id === 'l-ambroisie' ? "L'Ambroisie" : id === 'shuko' ? "Shuko Sushi" : "Osteria Francescana",
            cuisine: id === 'l-ambroisie' ? "French Haute" : id === 'shuko' ? "Japanese Omakase" : "Italian Fine"
          })));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [activeSection]);

  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.uid) {
      try {
        await setDoc(doc(db, 'customers', user.uid), {
          displayName,
          fullName: displayName,
          phoneNumber,
          phone: phoneNumber,
          dietaryPrefs,
          allergens,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        toast.success('Personal profile details synced successfully.');
      } catch (err: any) {
        console.error('Error saving personal info to customers/{uid}:', err);
        try {
          await setDoc(doc(db, 'users', user.uid), {
            displayName,
            fullName: displayName,
            phoneNumber,
            dietaryPrefs,
            allergens,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          toast.success('Personal profile details synced successfully.');
        } catch (_fallbackErr) {
          toast.error('Failed to sync profile details.');
        }
      }
    }
    handleSectionChange('menu');
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

  const handleRedeemReward = (reward: IReward) => {
    if (loyaltyPoints >= reward.cost) {
      setLoyaltyPoints(l => l - reward.cost);
      toast.success(`Redeemed ${reward.title}! Coupon saved to wallet.`, { icon: '🎁' });
    } else {
      toast.error('Insufficient loyalty points balance.');
    }
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
  }  // Helper menu row builder
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
    <div className="max-w-4xl mx-auto space-y-6 select-none text-left px-4 sm:px-6">
      
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
          <div className="bg-white border border-[#EEE7E1] p-6 rounded-3xl flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-[#E85D3F] rounded-2xl flex items-center justify-center text-lg font-extrabold text-white shadow-md shadow-[#E85D3F]/20">
                {displayName.substring(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-[#242424]">{displayName}</h3>
                <span className="text-[9px] bg-[#FFF8F2] text-[#E85D3F] border border-[#EEE7E1] px-2.5 py-0.5 rounded-full uppercase tracking-wider font-extrabold block w-fit">
                  {loyaltyPoints > 500 ? 'Gold VIP Member' : loyaltyPoints > 0 ? 'Member' : 'Verified Account'}
                </span>
              </div>
            </div>
            <Award className="w-8 h-8 text-[#E85D3F] shrink-0" />
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

          {/* Profile Navigation Hub List */}
          <div className="space-y-3">
            {/* Active Live Dining entrance if there is a Confirmed or Pending reservation */}
            {reservations.some(r => r.status === 'Confirmed' || r.status === 'Pending') && (
              <button 
                type="button"
                onClick={() => navigate('/customer/portal')}
                className="w-full p-4 bg-[#FFF8F2] border border-[#E85D3F]/40 hover:border-[#E85D3F] rounded-2xl flex items-center justify-between transition-all select-none shadow-xs cursor-pointer"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 bg-[#E85D3F] text-white rounded-xl flex items-center justify-center shadow-xs">
                    <Clock className="w-4.5 h-4.5" />
                  </div>
                  <div className="text-left space-y-0.5">
                    <h4 className="text-xs font-extrabold text-[#E85D3F]">Enter Active Live Dining</h4>
                    <p className="text-[10px] text-[#6B6B6B] font-semibold">Your session is active. Tap to view menu & order.</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#E85D3F]" />
              </button>
            )}

            <MenuRow 
              icon={ShoppingBag} 
              title="My Orders" 
              desc="Track active kitchen orders and view dining receipt history" 
              onClick={() => navigate('/customer/orders')}
            />
            <MenuRow 
              icon={User} 
              title="Personal Information" 
              desc="Update name, mobile number, dietary profile filters" 
              onClick={() => handleSectionChange('personal')}
            />
            <MenuRow 
              icon={MapPin} 
              title="Saved Addresses" 
              desc="Manage home, corporate, and dining locations" 
              onClick={() => handleSectionChange('addresses')}
            />
            <MenuRow 
              icon={Calendar} 
              title="My Reservations" 
              desc="View, modify, cancel table bookings slots" 
              onClick={() => handleSectionChange('reservations')}
            />
            <MenuRow 
              icon={Award} 
              title="Rewards & Coupons" 
              desc="Claim wine, dessert coupons with loyalty points" 
              onClick={() => handleSectionChange('rewards')}
            />
            <MenuRow 
              icon={Wallet} 
              title="Digital Wallet Ledger" 
              desc="Recharge dining wallet and check checkout logs" 
              onClick={() => handleSectionChange('wallet')}
            />
            <MenuRow 
              icon={Heart} 
              title="Favorite Restaurants" 
              desc="Manage bookmarked eateries & premium bistros" 
              onClick={() => handleSectionChange('favorites')}
            />
            <MenuRow 
              icon={BookOpen} 
              title="Dining History & Past Orders" 
              desc="Logs of past checks, dates, and live order tracking" 
              onClick={() => navigate('/customer/orders')}
            />
            <MenuRow 
              icon={CreditCard} 
              title="Payment Methods" 
              desc="Saved debit/credit cards, UPI aliases" 
              onClick={() => handleSectionChange('payments')}
            />
            <MenuRow 
              icon={Bell} 
              title="Notification Settings" 
              desc="SMS, Email, and Push notifications options" 
              onClick={() => handleSectionChange('notifications')}
            />
            <MenuRow 
              icon={Settings} 
              title="Settings & Privacy" 
              desc="App language, location access permissions" 
              onClick={() => handleSectionChange('settings')}
            />

            {/* Logout button */}
            <button
              onClick={triggerLogout}
              className="w-full p-4 bg-red-50 hover:bg-red-100/60 border border-red-200 rounded-2xl flex items-center justify-between text-red-600 font-extrabold transition-all cursor-pointer shadow-xs"
            >
              <div className="flex items-center space-x-3.5">
                <LogOut className="w-5 h-5 text-red-600" />
                <span>Logout</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 1. PERSONAL INFORMATION */}
      {activeSection === 'personal' && (
        <form onSubmit={handleSavePersonalInfo} className="bg-slate-900/40 border border-slate-900 p-5 rounded-3xl space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold text-white">Personal Information</h3>
            <p className="text-[10px] text-slate-500">Edit your display name, SMS numbers, and dietary profiles.</p>
          </div>

          <Input 
            label="Display Name" 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)} 
            required 
            className="bg-slate-950 border-slate-900"
          />
          <Input 
            label="SMS Phone Number" 
            value={phoneNumber} 
            onChange={(e) => setPhoneNumber(e.target.value)} 
            required 
            className="bg-slate-950 border-slate-900"
          />

          {/* Dietary Prefs */}
          <div className="space-y-2">
            <label className="text-[10px] text-slate-550 font-extrabold uppercase tracking-wider block">Dietary Profile Filters</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {['Vegetarian', 'Vegan', 'Gluten-Free', 'Organic'].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDietaryPrefs(prev => prev.includes(d) ? prev.filter(item => item !== d) : [...prev, d])}
                  className={`py-2.5 px-3 border rounded-xl font-bold flex items-center justify-between transition-all ${
                    dietaryPrefs.includes(d)
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-slate-950 border-slate-900 text-slate-450'
                  }`}
                >
                  <span>{d}</span>
                  {dietaryPrefs.includes(d) && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Allergens warning lists */}
          <div className="space-y-2">
            <label className="text-[10px] text-slate-555 font-extrabold uppercase tracking-wider block">Allergen Safety Alerts</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {['Peanuts', 'Shellfish', 'Dairy', 'Gluten'].map(all => (
                <button
                  key={all}
                  type="button"
                  onClick={() => setAllergens(prev => prev.includes(all) ? prev.filter(a => a !== all) : [...prev, all])}
                  className={`py-2.5 px-3 border rounded-xl font-bold flex items-center justify-between transition-all ${
                    allergens.includes(all)
                      ? 'bg-red-500/10 border-red-500/30 text-red-400 font-extrabold'
                      : 'bg-slate-950 border-slate-900 text-slate-450'
                  }`}
                >
                  <span>{all}</span>
                  {allergens.includes(all) && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full bg-primary text-slate-950 font-bold py-3.5 rounded-xl">
            Save and Sync Profile
          </Button>
        </form>
      )}

      {/* 2. SAVED ADDRESSES */}
      {activeSection === 'addresses' && (
        <div className="space-y-6">
          <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-3xl space-y-4">
            <h3 className="text-sm font-extrabold text-white">Address Book</h3>
            <div className="space-y-3">
              {addresses.map(a => (
                <div key={a.id} className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[9px] bg-slate-900 border border-slate-850 px-2 py-0.5 rounded text-primary font-bold uppercase">{a.name}</span>
                    <p className="text-xs text-slate-350 mt-1">{a.detail}</p>
                  </div>
                  <button onClick={() => handleDeleteAddress(a.id)} className="text-red-450 hover:text-red-400 p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleAddAddress} className="bg-slate-900/40 border border-slate-900 p-5 rounded-3xl space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Register New Address</h4>
            <Input 
              label="Address Label (e.g. Home, Cabin)" 
              value={newAddrName} 
              onChange={e => setNewAddrName(e.target.value)} 
              placeholder="e.g. Work, Studio" 
              required
              className="bg-slate-955 bg-slate-950 border-slate-900"
            />
            <Input 
              label="Address Detail" 
              value={newAddrDetail} 
              onChange={e => setNewAddrDetail(e.target.value)} 
              placeholder="Enter complete door no, area, landmarks..." 
              required
              className="bg-slate-955 bg-slate-950 border-slate-900"
            />
            <Button type="submit" className="w-full bg-primary text-slate-950 font-bold py-3">
              <Plus className="w-3.5 h-3.5 mr-1 inline-block" /> Add to Address Book
            </Button>
          </form>
        </div>
      )}

      {/* 3. RESERVATIONS LIST */}
      {activeSection === 'reservations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h3 className="text-sm font-extrabold text-white">Your Reservations</h3>
              <p className="text-[10px] text-slate-550">Active and past reservations logs.</p>
            </div>
            <button 
              onClick={() => navigate('/customer/booking')}
              className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-xl font-bold"
            >
              Book Table
            </button>
          </div>

          {isReservationsLoading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Accessing Reservation Ledger...</div>
          ) : reservations.length === 0 ? (
            <div className="py-12 text-center border border-slate-900 border-dashed rounded-3xl bg-slate-900/10 text-slate-500 text-xs">
              No reservation logs found.
            </div>
          ) : (
            <div className="space-y-3.5">
              {reservations.map(res => (
                <Card key={res.id} className="p-4 bg-slate-900/30 border-slate-900 rounded-2xl flex flex-col justify-between gap-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-extrabold text-white">{res.restaurantName}</h4>
                      <p className="text-[10px] text-slate-450 font-medium flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{res.date} @ {res.time}</span>
                      </p>
                      <p className="text-[10px] text-slate-450 font-medium flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{res.guests} Guests</span>
                      </p>
                      {res.seatingPreference && (
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mt-1">Preference: {res.seatingPreference}</span>
                      )}
                    </div>
                    <Badge variant="warning" className="text-[8px] tracking-wider uppercase font-bold py-0.5 px-2 bg-amber-400/10 text-primary border-0">{res.status}</Badge>
                  </div>

                  {res.directions && (
                    <div className="pt-2.5 border-t border-slate-950 flex flex-col gap-1 text-[10.5px]">
                      <span className="text-slate-500 font-bold uppercase text-[9px]">Location Address</span>
                      <div className="flex items-center justify-between text-slate-350">
                        <span className="truncate max-w-[200px]">{res.directions}</span>
                        {res.lat && res.lng && (
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${res.lat},${res.lng}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-[9.5px] font-bold flex items-center gap-1 bg-primary/5 px-2 py-1 rounded-lg border border-primary/20"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Map</span>
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {res.status === 'Pending' && (
                    <div className="flex justify-end gap-2 pt-1.5 border-t border-slate-950">
                      <button 
                        onClick={() => navigate(`/customer/booking?tenantId=${res.restaurantId}`)}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-800 text-[9.5px] font-bold text-slate-300 rounded-lg"
                      >
                        Modify
                      </button>
                      <button 
                        onClick={() => handleCancelBooking(res.id, res.restaurantId)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-[9.5px] font-bold text-red-400 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. REWARDS & COUPONS */}
      {activeSection === 'rewards' && (
        <div className="space-y-6">
          <div className="relative p-6 bg-gradient-to-br from-amber-500/15 to-orange-600/5 border border-primary/20 rounded-3xl overflow-hidden flex flex-col justify-between h-40 shadow-2xl">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[9px] text-slate-450 font-extrabold uppercase tracking-widest block">VIP Tier Status</span>
                <h4 className="text-sm font-extrabold text-white">Silver Diner Member</h4>
              </div>
              <Award className="w-8 h-8 text-primary" />
            </div>

            <div className="space-y-0.5">
              <span className="text-[8.5px] text-slate-500 uppercase tracking-widest font-extrabold block">Loyalty Points Balance</span>
              <h3 className="text-xl font-display font-extrabold text-white">{loyaltyPoints} Pts</h3>
            </div>
          </div>

          {/* Tier progression */}
          <div className="p-4 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-2">
            <div className="flex justify-between text-[10px] text-slate-450 font-bold">
              <span>Bronze Status</span>
              <span className="text-primary font-extrabold">Next Goal: 1000 Pts</span>
              <span>Gold VIP</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
              <div className="bg-primary h-full rounded-full" style={{ width: `${(loyaltyPoints/1000)*100}%` }} />
            </div>
          </div>

          {/* Catalog */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-slate-450 uppercase tracking-wider block">Redeem Loyalty Catalog</h4>
            <div className="space-y-3">
              {rewardsList.map((reward, i) => (
                <div key={i} className="p-4 bg-slate-900/30 border border-slate-900 rounded-2xl flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h5 className="text-xs font-bold text-white">{reward.title}</h5>
                    <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">{reward.desc}</p>
                  </div>
                  <button 
                    onClick={() => handleRedeemReward(reward)}
                    className="px-3.5 py-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-[10px] font-extrabold rounded-xl shrink-0 transition-all"
                  >
                    Claim {reward.cost} Pts
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. WALLET */}
      {activeSection === 'wallet' && (
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-900 rounded-3xl space-y-4 shadow-xl">
            <div>
              <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Available Balance</span>
              <h3 className="text-2xl font-display font-extrabold text-white">{formatCurrency(walletBalance)}</h3>
            </div>

            <form onSubmit={handleWalletTopUp} className="flex gap-2">
              <input 
                type="number" 
                value={topUpAmount}
                onChange={e => setTopUpAmount(e.target.value)}
                placeholder={`Enter recharge amount (e.g. ${formatCurrency(500)})`}
                className="flex-1 bg-slate-950 border border-slate-850 focus:border-primary/40 focus:outline-none rounded-xl text-xs px-3.5 py-3 text-white placeholder-slate-550"
              />
              <button 
                type="submit" 
                className="bg-primary hover:bg-amber-500 text-slate-950 text-xs font-extrabold px-4 rounded-xl transition-all shadow shadow-primary/10"
              >
                Top Up
              </button>
            </form>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-slate-450 uppercase tracking-wider block">Transaction Ledger</h4>
            <div className="space-y-2.5">
              {transactions.map(tx => (
                <div key={tx.id} className="p-3 bg-slate-900/30 border border-slate-900 rounded-xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-bold text-white">{tx.desc}</h5>
                    <span className="text-[9px] text-slate-550 font-bold">{tx.date} | {tx.id}</span>
                  </div>
                  <span className={`text-xs font-extrabold ${tx.type === 'credit' ? 'text-emerald-450 text-emerald-400' : 'text-red-400'}`}>
                    {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. FAVORITE RESTAURANTS */}
      {activeSection === 'favorites' && (
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-white">Favorite Restaurants</h3>
          {favourites.length === 0 ? (
            <div className="py-12 text-center border border-slate-900 border-dashed rounded-3xl bg-slate-900/10 text-slate-500 text-xs">
              No bookmarked restaurants yet.
            </div>
          ) : (
            <div className="space-y-3">
              {favourites.map(fav => (
                <div 
                  key={fav.id} 
                  className="p-4 bg-slate-900/30 border border-slate-900 rounded-2xl flex items-center justify-between cursor-pointer hover:border-slate-800 transition-all"
                  onClick={() => navigate(`/customer/restaurant/${fav.id}`)}
                >
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-extrabold text-white">{fav.name}</h4>
                    <p className="text-[10px] text-slate-500 font-semibold">{fav.cuisine}</p>
                  </div>
                  <Heart className="w-4 h-4 text-red-500 fill-current shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. DINING HISTORY */}
      {activeSection === 'history' && (
        <div className="space-y-4">
          <h3 className="text-sm font-extrabold text-white">Dine History Logs</h3>
          <div className="space-y-3">
            {diningHistory.map(h => (
              <div key={h.id} className="p-4 bg-slate-900/30 border border-slate-900 rounded-2xl flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-slate-200">{h.restaurant}</h4>
                  <div className="flex items-center space-x-2 text-[9.5px] text-slate-500 font-bold">
                    <span>{h.date}</span>
                    <span>•</span>
                    <span>{h.diners} Diners</span>
                  </div>
                </div>
                <div className="text-right space-y-0.5">
                  <span className="text-xs font-extrabold text-white">{formatCurrency(h.spend)}</span>
                  <Badge variant="success" className="text-[7.5px] uppercase font-bold py-0.5 bg-emerald-500/10 text-emerald-400 border-0 block w-fit ml-auto">Paid</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. PAYMENT METHODS */}
      {activeSection === 'payments' && (
        <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-3xl space-y-4">
          <h3 className="text-sm font-extrabold text-white">Payment Methods</h3>
          <div className="space-y-3">
            <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CreditCard className="w-5 h-5 text-slate-400" />
                <div>
                  <h5 className="text-xs font-bold text-white">SBI Credit Card</h5>
                  <span className="text-[9px] text-slate-500 font-semibold">Saved Card ending in **** 4920</span>
                </div>
              </div>
              <span className="text-[9px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-450 font-bold">Primary</span>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Wallet className="w-5 h-5 text-slate-400" />
                <div>
                  <h5 className="text-xs font-bold text-white">UPI Pay Handle</h5>
                  <span className="text-[9px] text-slate-500 font-semibold">Linked UPI: sarah@okaxis</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. NOTIFICATIONS */}
      {activeSection === 'notifications' && (
        <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-3xl space-y-4">
          <h3 className="text-sm font-extrabold text-white">Notification Settings</h3>
          <div className="space-y-3 text-xs text-slate-350">
            <div className="flex justify-between items-center py-2 border-b border-slate-950">
              <div>
                <h5 className="font-bold text-white">SMS Updates</h5>
                <p className="text-[9.5px] text-slate-550 font-semibold mt-0.5">Receive table ready alerts over SMS.</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifSms} 
                onChange={e => setNotifSms(e.target.checked)} 
                className="w-4 h-4 accent-primary"
              />
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-950">
              <div>
                <h5 className="font-bold text-white">Email Receipts</h5>
                <p className="text-[9.5px] text-slate-555 font-semibold mt-0.5">Receive booking logs and check invoices.</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifEmail} 
                onChange={e => setNotifEmail(e.target.checked)} 
                className="w-4 h-4 accent-primary"
              />
            </div>

            <div className="flex justify-between items-center py-2">
              <div>
                <h5 className="font-bold text-white">Push Alert Broadcasts</h5>
                <p className="text-[9.5px] text-slate-555 font-semibold mt-0.5">Instant alerts from onboarding restaurants.</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifPush} 
                onChange={e => setNotifPush(e.target.checked)} 
                className="w-4 h-4 accent-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* 10. SETTINGS */}
      {activeSection === 'settings' && (
        <div className="bg-slate-900/40 border border-slate-900 p-5 rounded-3xl space-y-4">
          <h3 className="text-sm font-extrabold text-white">App Settings</h3>
          <div className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="text-[9.5px] text-slate-500 font-extrabold uppercase tracking-wider block">App Language</label>
              <select 
                value={appLang} 
                onChange={e => setAppLang(e.target.value)}
                className="w-full bg-slate-950 border border-slate-900 text-white p-3 rounded-xl focus:outline-none"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi (हिन्दी)</option>
                <option value="Telugu">Telugu (తెలుగు)</option>
                <option value="Tamil">Tamil (தமிழ்)</option>
              </select>
            </div>

            <div className="flex justify-between items-center pt-2">
              <div>
                <h5 className="font-bold text-white">Share Location Data</h5>
                <p className="text-[9.5px] text-slate-550 font-semibold">Enable dynamic distance calculation alerts.</p>
              </div>
              <input 
                type="checkbox" 
                checked={appPrivacy} 
                onChange={e => setAppPrivacy(e.target.checked)} 
                className="w-4 h-4 accent-primary"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfilePage;
