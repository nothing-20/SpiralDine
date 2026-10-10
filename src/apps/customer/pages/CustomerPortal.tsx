import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc, 
  updateDoc,
  query, 
  where, 
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { getMenuItemPath } from '../../../firebase/collections';
import { IMenuItem, IOrderItem } from '../../../types';
import { useCart } from '../../../context/CartContext';
import { formatPrice } from '../../../utils/format';
import { useAuth } from '../../../context/AuthContext';
import { customerService } from '../../../shared/services/customerService';
import { generateUniqueOrderId } from '../../../shared/utils/orderUtils';
import { 
  generateSessionId, 
  getActiveDiningSession, 
  saveActiveDiningSession, 
  syncDiningSessionToFirestore 
} from '../../../shared/utils/diningSession';

// UI Kit components
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import TextArea from '../../../components/ui/TextArea/TextArea';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import Modal from '../../../components/ui/Modal/Modal';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

// Hot Toast notifications
import toast from 'react-hot-toast';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Check,
  User,
  Coffee,
  Star,
  Flame,
  ChevronRight
} from 'lucide-react';

export const CustomerPortal: React.FC = () => {
  const { tenantId, tableId } = useParams<{ tenantId: string; tableId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { 
    cartItems, 
    addItem, 
    updateQuantity, 
    removeItem, 
    clearCart,
    cartSubtotal, 
    cartTax, 
    cartTotal 
  } = useCart();

  // Database States
  const [menuItems, setMenuItems] = useState<IMenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<IMenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState('Gourmet Bistro');
  const [coverImage, setCoverImage] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandingColors, setBrandingColors] = useState<{ primary?: string; secondary?: string }>({});
  const [isInvalidSession, setIsInvalidSession] = useState(false);
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [showVegOnly, setShowVegOnly] = useState(false);

  // Modal / Panel States
  const [selectedItem, setSelectedItem] = useState<IMenuItem | null>(null);
  const [addItemCount, setAddItemCount] = useState(1);
  const [itemNotes, setItemNotes] = useState('');
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isOrderSuccess, setIsOrderSuccess] = useState(false);
  const [lastPlacedOrderId, setLastPlacedOrderId] = useState<string>('');
  
  // Checkout Input States
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [tableNumber, setTableNumber] = useState(
    tableId ? tableId.replace(/^TBL-/i, '') : ''
  );
  const [tableError, setTableError] = useState<string>('');
  const [showQrWelcome, setShowQrWelcome] = useState<boolean>(true);
  const [verifiedBranchId, setVerifiedBranchId] = useState<string>('main');

  const resolvedTableId = tableId
    ? (tableId.startsWith('TBL-') ? tableId : `TBL-${tableId}`)
    : (tableNumber ? `TBL-${tableNumber}` : '');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  useEffect(() => {
    if (user) {
      setCustomerName(user.displayName || '');
      setPhoneNumber(user.phoneNumber || '');
    }
  }, [user]);

  // Call Waiter / Assistance Request states
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [isCallingService, setIsCallingService] = useState(false);

  const handleRequestService = async (type: string) => {
    if (!tenantId) return;
    setIsCallingService(true);
    try {
      const requestId = `REQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const docRef = doc(db, 'restaurants', tenantId, 'waiterRequests', requestId);
      await setDoc(docRef, {
        id: requestId,
        requestId,
        tableNumber: tableId ? tableId.replace(/^TBL-/i, '') : 'Bar',
        tableNum: tableId ? tableId.replace(/^TBL-/i, '') : 'Bar',
        type,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      toast.success(`${type} request sent to waiter!`);
      setIsServiceOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to submit request.');
    } finally {
      setIsCallingService(false);
    }
  };

  // Subscribe to Menu, Tenant branding details, and handle QR table check-in
  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);

    // 1. Fetch Tenant details
    const fetchTenantInfo = async () => {
      try {
        const tenantRef = doc(db, 'tenants', tenantId);
        const tenantSnap = await getDoc(tenantRef);
        if (tenantSnap.exists()) {
          const tenantData = tenantSnap.data();
          setRestaurantName(tenantData.restaurantName || tenantData.name || 'Gourmet Bistro');
          setCoverImage(tenantData.coverImage || tenantData.coverImageUrl || '');
          setLogoUrl(tenantData.logoUrl || tenantData.logo || '');
          setBrandingColors({
            primary: tenantData.primaryColor,
            secondary: tenantData.secondaryColor
          });
          if (tenantData.primaryColor) {
            document.documentElement.style.setProperty('--color-primary', tenantData.primaryColor);
          }
          if (tenantData.secondaryColor) {
            document.documentElement.style.setProperty('--color-secondary', tenantData.secondaryColor);
          }
        } else {
          setIsInvalidSession(true);
        }
      } catch (err) {
        console.error(err);
        setIsInvalidSession(true);
      }
    };
    fetchTenantInfo();

    // 2. Subscribe to Menu items in real-time
    const colRef = collection(db, getMenuItemPath(tenantId));
    const unsubMenu = onSnapshot(query(colRef), (querySnap) => {
      const items: IMenuItem[] = [];
      const catSet = new Set<string>();

      querySnap.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() } as IMenuItem;
        items.push(item);
        if (item.category) catSet.add(item.category);
      });

      setMenuItems(items);
      setCategories(Array.from(catSet));
      setIsLoading(false);
    }, (err) => {
      console.error(err);
      setIsLoading(false);
    });

    // 3. Verify Table and Lock QR Context (non-destructive)
    const verifyAndLockTable = async () => {
      if (!tableId || !tenantId) return;
      try {
        let tableData: any = null;
        const directTableRef = doc(db, 'restaurants', tenantId, 'tables', tableId);
        const directSnap = await getDoc(directTableRef);
        if (directSnap.exists()) {
          tableData = { ...directSnap.data(), id: directSnap.id };
        } else {
          // Fallback search by tableNumber/number
          const cleanNum = tableId.replace(/^TBL-/i, '');
          const q1 = query(collection(db, 'restaurants', tenantId, 'tables'), where('tableNumber', '==', cleanNum));
          let querySnap = await getDocs(q1);
          if (querySnap.empty) {
            const q2 = query(collection(db, 'restaurants', tenantId, 'tables'), where('number', '==', cleanNum));
            querySnap = await getDocs(q2);
          }
          if (!querySnap.empty) {
            tableData = { ...querySnap.docs[0].data(), id: querySnap.docs[0].id };
          }
        }

        if (!tableData) {
          setIsInvalidSession(true);
          setTableError('Table not found or does not belong to this restaurant.');
          return;
        }

        if (tableData.isActive === false || tableData.status === 'Disabled') {
          setIsInvalidSession(true);
          setTableError('This table is currently disabled. Please contact restaurant staff.');
          return;
        }

        const tNum = String(tableData.tableNumber || tableData.number || tableId.replace(/^TBL-/i, ''));
        const tId = tableData.id || tableId;
        const bId = tableData.branchId || 'main';
        const tName = tableData.tableName || `Table ${tNum}`;

        setTableNumber(tNum);
        setVerifiedBranchId(bId);

        // Check for existing active session for this table or establish a new one
        const existingSession = getActiveDiningSession(tenantId);
        let qrSession = existingSession;

        if (!qrSession || (qrSession.tableNumber !== tNum && qrSession.tableId !== tId)) {
          const sessionId = generateSessionId();
          qrSession = {
            sessionId,
            restaurantId: tenantId,
            tenantId,
            branchId: bId,
            tableId: tId,
            tableNumber: tNum,
            tableName: tName,
            orderSource: 'qr',
            isLocked: true,
            status: 'active',
            startedAt: new Date().toISOString()
          };
          saveActiveDiningSession(qrSession);
          syncDiningSessionToFirestore(qrSession).catch(() => {});
        } else {
          // Refresh locked QR source
          qrSession.orderSource = 'qr';
          qrSession.isLocked = true;
          saveActiveDiningSession(qrSession);
        }

        // Log non-blocking QR scan event
        customerService.logCustomerEvent(tenantId, 'QR Scanned', `QR verified for ${tName}`, {
          tenantId,
          tableId: tId,
          tableNumber: tNum,
          branchId: bId
        }).catch(() => {});
      } catch (err: any) {
        console.error('[CustomerPortal] Table verification error:', err);
        setIsInvalidSession(true);
        setTableError('Failed to verify table context.');
      }
    };
    verifyAndLockTable();

    return () => {
      unsubMenu();
    };
  }, [tenantId, tableId, user]);

  // Filters logic
  useEffect(() => {
    let filtered = [...menuItems];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.description.toLowerCase().includes(q)
      );
    }

    if (activeCategory !== 'all') {
      filtered = filtered.filter(item => item.category === activeCategory);
    }

    if (showVegOnly) {
      filtered = filtered.filter(item => item.veg);
    }

    setFilteredItems(filtered);
  }, [searchQuery, activeCategory, showVegOnly, menuItems]);

  const handleSelectItem = (item: IMenuItem) => {
    if (!item.available) {
      toast.error('This dish is currently out of stock.', { id: 'out-of-stock-alert' });
      return;
    }
    setSelectedItem(item);
    setAddItemCount(1);
    setItemNotes('');
  };

  const handleAddToCart = () => {
    if (!selectedItem) return;
    addItem(selectedItem, addItemCount, itemNotes);
    toast.success(`${selectedItem.name} added to cart!`);
    setSelectedItem(null);
  };

  // Place Order transaction writing restaurants/{tenantId}/orders
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlacingOrder) return;
    console.log('[STEP 1] Confirm button clicked');

    if (!tenantId) {
      toast.error('Restaurant session is invalid.');
      return;
    }
    if (!cartItems || cartItems.length === 0) {
      toast.error('Your cart is empty.');
      return;
    }
    if (cartSubtotal <= 0 || cartTotalVal <= 0) {
      toast.error('Order total must be greater than ₹0.00 to place an order.');
      return;
    }

    if (!customerName.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    if (!phoneNumber.trim() || phoneNumber.length < 8) {
      toast.error('Please enter a valid phone number.');
      return;
    }
    if (!tableNumber.trim()) {
      toast.error('Please verify your table number.');
      return;
    }

    const orderTableId = resolvedTableId || `TBL-${tableNumber}`;

    setIsPlacingOrder(true);
    try {
      console.log('[STEP 2] Validation passed');

      const orderId = generateUniqueOrderId();
      const docRef = doc(db, 'restaurants', tenantId, 'orders', orderId);

      const itemsList = cartItems.map(item => ({
        itemId: item.itemId,
        name: item.name,
        count: item.count,
        notes: item.notes,
        pricePerUnit: item.pricePerUnit
      }));

      const orderPayload = {
        id: orderId,
        orderId,
        customerId: user?.uid || 'guest-uid',
        customerName,
        phone: phoneNumber,
        restaurantId: tenantId,
        tenantId,
        branchId: verifiedBranchId || 'main',
        tableId: orderTableId,
        tableNumber,
        tableName: `Table ${tableNumber}`,
        orderType: 'dine_in',
        orderSource: 'qr',
        items: itemsList,
        subtotal: cartSubtotal,
        tax: gstCharge + serviceCharge,
        discount: 0,
        totalAmount: cartTotalVal,
        total: cartTotalVal,
        status: 'NEW',
        paymentStatus: 'pending',
        specialInstructions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      console.log('[STEP 3] Order object created', { orderId, tenantId, tableId: orderTableId, itemCount: cartItems.length, total: cartTotalVal });
      console.log('[STEP 4] Writing to Firestore', `restaurants/${tenantId}/orders/${orderId}`);

      await setDoc(docRef, orderPayload);

      console.log('[STEP 5] Firestore write successful');

      // Persist order reference to customer profile if authenticated
      if (user?.uid) {
        try {
          await setDoc(doc(db, 'customers', user.uid, 'orders', orderId), {
            id: orderId,
            orderId,
            tenantId,
            restaurantName: restaurantName || tenantId,
            tableNumber: tableNumber || 'Walk-in',
            total: cartTotalVal,
            status: 'NEW',
            itemsCount: cartItems.length,
            createdAt: orderPayload.createdAt,
            updatedAt: orderPayload.updatedAt
          });
        } catch (custErr) {
          console.warn('[CustomerPortal] Could not save order to customer collection:', custErr);
        }
      }

      // Persist recent order in localStorage
      try {
        const existingRecentStr = localStorage.getItem('restaurantos_customer_orders') || '[]';
        const existingRecent = JSON.parse(existingRecentStr);
        const updatedRecent = [
          {
            orderId,
            tenantId,
            restaurantName: restaurantName || tenantId,
            tableNumber: tableNumber || 'Walk-in',
            total: cartTotalVal,
            status: 'NEW',
            itemsCount: cartItems.length,
            createdAt: orderPayload.createdAt
          },
          ...existingRecent.filter((o: any) => o.orderId !== orderId)
        ].slice(0, 20);
        localStorage.setItem('restaurantos_customer_orders', JSON.stringify(updatedRecent));
      } catch (storageErr) {
        console.warn('[CustomerPortal] Failed to update localStorage orders:', storageErr);
      }

      setLastPlacedOrderId(orderId);

      // Update table status — non-blocking
      try {
        const tableRef = doc(db, 'restaurants', tenantId, 'tables', orderTableId);
        await updateDoc(tableRef, {
          status: 'Occupied',
          updatedAt: new Date().toISOString()
        });
      } catch (tableErr) {
        console.warn('[CustomerPortal] Table status update failed (order still placed):', tableErr);
      }

      console.log('[STEP 6] Showing confirmation dialog');
      setIsCheckoutOpen(false);
      setIsOrderSuccess(true);
      toast.success('Order placed successfully!', { id: 'order-success-toast' });

      console.log('[STEP 7] Clearing cart');
      clearCart();

      // Fire operational event logs — non-blocking
      customerService.logCustomerEvent(tenantId, 'Order Created', `Diner placed order ${orderId} on table ${tableNumber} for ${formatPrice(cartTotalVal)}`, {
        orderId,
        tableNumber,
        itemsCount: cartItems.length,
        total: cartTotalVal
      }).catch(err => console.warn('[CustomerPortal] Event log failed:', err));

      customerService.logCustomerEvent(tenantId, 'Order Sent To Kitchen', `Order ${orderId} routed successfully to KDS kitchen queue`, {
        orderId,
        tableNumber,
        itemsCount: cartItems.length
      }).catch(err => console.warn('[CustomerPortal] Event log failed:', err));
    } catch (err: any) {
      console.error('[CustomerPortal] Place order error:', err);
      toast.error(err.message || 'Failed to place order. Try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const totalItemsCount = cartItems.reduce((acc, curr) => acc + curr.count, 0);
  const gstCharge = Math.round(cartSubtotal * 0.05);
  const serviceCharge = Math.round(cartSubtotal * 0.05);
  const cartTotalVal = cartSubtotal + gstCharge + serviceCharge;

  if (!tenantId || isInvalidSession) {
    return (
      <div className="min-h-screen bg-slate-955 flex items-center justify-center p-6 text-center select-none">
        <div className="max-w-md w-full glass-panel p-8 rounded-3xl border-amber-500/20 bg-slate-900/80 space-y-6">
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto text-amber-500">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-display font-extrabold text-white">Table Session Unavailable</h2>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              {tableError || "We couldn't verify your restaurant or table session. Please scan your table QR code again or browse available restaurants."}
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/customer/home')}
              className="w-full py-3 bg-primary hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow"
            >
              Explore Restaurants & Menus
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner label="Fetching restaurant menu..." />
      </div>
    );
  }

  // QR Welcome Hero (Requirement 30: Scan QR -> Restaurant -> Ordering at Table X -> Explore Menu)
  if (showQrWelcome) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] flex items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-white border border-[#E5DCD5] p-8 rounded-3xl shadow-xl space-y-6">
          <div className="w-16 h-16 bg-[#FFF8F2] border border-[#E5DCD5] rounded-2xl flex items-center justify-center mx-auto text-[#C85A3F] shadow-xs">
            <Coffee className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              <span>QR Verified Table</span>
            </div>
            <h1 className="text-2xl font-display font-extrabold text-[#202124]">
              {restaurantName}
            </h1>
            <p className="text-xl font-black text-[#C85A3F]">
              Ordering at Table {tableNumber || tableId?.replace(/^TBL-/i, '')}
            </p>
            <p className="text-xs text-[#756B64] leading-relaxed max-w-xs mx-auto">
              Welcome! Your table is verified and locked. Browse our freshly prepared menu and order directly to your table.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <button
              onClick={() => navigate(`/customer/restaurant/${tenantId}/menu?table=${tableNumber || tableId?.replace(/^TBL-/i, '')}&source=qr`)}
              className="w-full py-4 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold text-sm rounded-xl transition-all shadow-md shadow-[#C85A3F]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Explore Menu</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowQrWelcome(false)}
              className="w-full py-2.5 text-xs font-bold text-[#756B64] hover:text-[#202124] transition-all cursor-pointer"
            >
              Stay in quick portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-24 text-left">
      {/* Mobile-friendly banner */}
      <div className="bg-slate-900 border-b border-slate-800/60 p-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {logoUrl ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shrink-0 flex items-center justify-center">
              <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="text-primary font-display font-extrabold text-xl">R</span>
            </div>
          )}
          <div>
            <h1 className="text-lg font-display font-extrabold text-textPearl leading-tight">{restaurantName}</h1>
            <p className="text-[10px] text-primary font-bold uppercase tracking-wider mt-0.5">Table #{tableId || 'Bar'}</p>
          </div>
        </div>
        <button
          onClick={() => setIsServiceOpen(true)}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-slate-355 hover:text-textPearl text-xs font-bold rounded-xl transition-all"
        >
          Call Waiter
        </button>
      </div>

      {/* Menu Filters */}
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <SearchBar 
          placeholder="Search dishes..."
          value={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Categories Horizontal Scroll */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 select-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
              activeCategory === 'all'
                ? 'bg-primary text-background font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-textPearl border border-slate-850'
            }`}
          >
            All Items
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-300 ${
                activeCategory === cat
                  ? 'bg-primary text-background font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-textPearl border border-slate-850'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Veg/Nonveg quick filter toggle */}
        <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
          <span className="text-xs text-slate-405">Show Vegetarian Items Only</span>
          <button
            onClick={() => setShowVegOnly(!showVegOnly)}
            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 ${showVegOnly ? 'bg-accent' : 'bg-slate-800'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transform transition-transform duration-300 ${showVegOnly ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Menu Cards List Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          {filteredItems.length === 0 ? (
            <div className="col-span-full py-12 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
              <AlertTriangle className="w-8 h-8 text-slate-655 mx-auto mb-2" />
              <p className="text-sm text-slate-400 font-semibold">No items match your filters.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <Card 
                key={item.id} 
                className={`p-4 border-slate-850 bg-slate-900/40 flex flex-col space-y-3.5 cursor-pointer hover:border-slate-805 hover:bg-slate-900/60 ${!item.available ? 'opacity-55' : ''}`}
                onClick={() => handleSelectItem(item)}
              >
                {/* 1. Food Image + Preparation Time Badge */}
                <div className="w-full h-40 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 relative shrink-0 flex items-center justify-center">
                  {(item.imageUrl || item.image) ? (
                    <img 
                      src={item.imageUrl || item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover" 
                      loading="lazy" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500">
                      <span className="text-[10px] font-semibold text-slate-400">Freshly Prepared</span>
                    </div>
                  )}
                  {/* Preparation Time Badge overlaid absolute */}
                  <div className="absolute bottom-2.5 right-2.5 bg-slate-950/80 backdrop-blur-md text-[10px] text-slate-350 font-bold px-2 py-0.5 rounded-lg border border-slate-800/40 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{item.preparationTime || 15} mins</span>
                  </div>
                </div>

                {/* 2. Title + Price */}
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-display font-bold text-sm text-textPearl leading-tight line-clamp-1">{item.name}</h3>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    {item.discountPrice && item.discountPrice < item.price ? (
                      <>
                        <span className="text-sm font-semibold text-textPearl">{formatPrice(item.discountPrice)}</span>
                        <span className="text-xs text-primary line-through">{formatPrice(item.price)}</span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-textPearl">{formatPrice(item.price)}</span>
                    )}
                  </div>
                </div>

                {/* 3. Description */}
                <p className="text-xs text-mutedAsh line-clamp-2 pr-2">{item.description || 'Tasty house-crafted gourmet specialty.'}</p>

                {/* 4. Badges (Veg, Non-Veg, Bestseller, Recommended, Category, Spice) */}
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {/* Veg / Non-Veg */}
                  {item.veg ? (
                    <span className="h-7 px-3 rounded-full inline-flex items-center justify-center text-[12px] font-semibold tracking-wide shrink-0 transition-all select-none animate-in fade-in duration-200" style={{ backgroundColor: '#14532D', color: '#BBF7D0' }}>
                      🟢 Veg
                    </span>
                  ) : (
                    <span className="h-7 px-3 rounded-full inline-flex items-center justify-center text-[12px] font-semibold tracking-wide shrink-0 transition-all select-none animate-in fade-in duration-200" style={{ backgroundColor: '#7F1D1D', color: '#FECACA' }}>
                      🔴 Non-Veg
                    </span>
                  )}

                  {/* Bestseller */}
                  {(item.isBestSeller || (item.rating || 0) >= 4.7) && (
                    <span className="h-7 px-3 rounded-full inline-flex items-center justify-center text-[12px] font-semibold tracking-wide shrink-0 transition-all select-none animate-in fade-in duration-200" style={{ backgroundColor: '#78350F', color: '#FDE68A' }}>
                      ⭐ Bestseller
                    </span>
                  )}

                  {/* Recommended */}
                  {item.isRecommended && (
                    <span className="h-7 px-3 rounded-full inline-flex items-center justify-center text-[12px] font-semibold tracking-wide shrink-0 transition-all select-none animate-in fade-in duration-200" style={{ backgroundColor: '#1E3A8A', color: '#BFDBFE' }}>
                      👍 Recommended
                    </span>
                  )}

                  {/* Category */}
                  {item.category && (
                    <span className="h-7 px-3 rounded-full inline-flex items-center justify-center text-[12px] font-semibold tracking-wide shrink-0 transition-all select-none animate-in fade-in duration-200" style={{ backgroundColor: '#374151', color: '#E5E7EB' }}>
                      🍽 {item.category}
                    </span>
                  )}

                  {/* Spice Level */}
                  {item.spiceLevel && item.spiceLevel !== 'none' && (
                    <span className="h-7 px-3 rounded-full inline-flex items-center justify-center text-[12px] font-semibold tracking-wide shrink-0 transition-all select-none animate-in fade-in duration-200" style={{ backgroundColor: '#7F1D1D', color: '#FECACA' }}>
                      🌶 {item.spiceLevel}
                    </span>
                  )}
                </div>

                {/* 5. Availability + Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-900/60 mt-auto">
                  <div className="flex items-center text-amber-500 font-semibold">
                    <Star className="w-3.5 h-3.5 fill-current mr-0.5" />
                    <span>{item.rating?.toFixed(1) || '4.5'}</span>
                  </div>

                  {!item.available ? (
                    <span className="text-[9px] font-bold bg-slate-900 border border-slate-800 text-slate-500 px-2 py-1 rounded-lg uppercase">
                      Sold Out
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold uppercase px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-primary">
                      + Add
                    </span>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Floating View Cart bar */}
      {totalItemsCount > 0 ? (
        <div className="fixed bottom-6 inset-x-4 z-40 max-w-xl mx-auto">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-primary hover:bg-primary-hover text-background font-display font-bold p-4 rounded-2xl flex items-center justify-between shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom-4 duration-300"
          >
            <div className="flex items-center space-x-3">
              <ShoppingBag className="w-5 h-5" />
              <span>View Cart ({totalItemsCount} items)</span>
            </div>
            <div className="flex items-center space-x-1">
              <span>{formatPrice(cartTotal)}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      ) : null}

      {/* Modal Item Details & Notes */}
      <Modal
        isOpen={selectedItem !== null}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.name || 'Dish Details'}
      >
        {selectedItem && (
          <div className="space-y-4 text-left">
            {selectedItem.imageUrl ? (
              <div className="w-full h-44 rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                <img src={selectedItem.imageUrl} alt={selectedItem.name} className="w-full h-full object-cover" />
              </div>
            ) : null}
            
            <p className="text-xs text-mutedAsh">{selectedItem.description}</p>
            
            <div className="flex items-center justify-between py-2 border-y border-slate-800/40">
              <span className="text-xs text-slate-405 font-semibold">Quantity</span>
              <div className="flex items-center space-x-3.5">
                <button
                  onClick={() => setAddItemCount(prev => Math.max(1, prev - 1))}
                  className="p-1 bg-slate-800 text-slate-400 hover:text-textPearl rounded-lg"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-semibold text-textPearl">{addItemCount}</span>
                <button
                  onClick={() => setAddItemCount(prev => prev + 1)}
                  className="p-1 bg-slate-800 text-slate-400 hover:text-textPearl rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <TextArea 
              label="Preparation Instructions (optional)"
              placeholder="E.g. Extra spicy, No onions, Sauce on the side."
              value={itemNotes}
              onChange={(e) => setItemNotes(e.target.value)}
              rows={2}
            />

            <Button 
              onClick={handleAddToCart}
              className="w-full"
            >
              Add to Basket • {formatPrice((selectedItem.discountPrice || selectedItem.price) * addItemCount)}
            </Button>
          </div>
        )}
      </Modal>

      {/* Slide-out Cart details page */}
      <Modal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        title="Your Basket"
      >
        <div className="space-y-4 text-left">
          {cartItems.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-500">Your basket is empty.</p>
          ) : (
            <div className="space-y-3 divide-y divide-slate-850">
              {cartItems.map((item) => (
                <div key={item.itemId} className="flex items-start justify-between pt-3 first:pt-0">
                  <div className="flex-1 space-y-1">
                    <h4 className="text-xs font-semibold text-textPearl">{item.name}</h4>
                    {item.notes ? (
                      <p className="text-[10px] text-primary">Note: {item.notes}</p>
                    ) : null}
                    <div className="text-xs text-slate-400">{formatPrice(item.pricePerUnit)} each</div>
                  </div>

                  <div className="flex items-center space-x-3.5 ml-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateQuantity(item.itemId, item.count - 1)}
                        className="p-1 bg-slate-800 text-slate-400 hover:text-textPearl rounded-lg"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-semibold text-textPearl w-4 text-center">{item.count}</span>
                      <button
                        onClick={() => updateQuantity(item.itemId, item.count + 1)}
                        className="p-1 bg-slate-800 text-slate-400 hover:text-textPearl rounded-lg"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.itemId)}
                      className="p-1 text-slate-500 hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pricing calculations details */}
          <div className="border-t border-slate-805 pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span>{formatPrice(cartSubtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>GST (5%)</span>
              <span>{formatPrice(gstCharge)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Service Charge (5%)</span>
              <span>{formatPrice(serviceCharge)}</span>
            </div>
            <div className="flex justify-between text-textPearl font-semibold text-sm pt-2 border-t border-slate-800/20">
              <span>Grand Total</span>
              <span>{formatPrice(cartTotalVal)}</span>
            </div>
          </div>

          <Button
            className="w-full mt-4"
            disabled={cartItems.length === 0}
            onClick={() => {
              setIsCartOpen(false);
              setIsCheckoutOpen(true);
            }}
          >
            Proceed to Checkout
          </Button>
        </div>
      </Modal>

      {/* Checkout Input panel */}
      <Modal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        title="Diner Checkout"
      >
        <form onSubmit={handlePlaceOrder} className="space-y-4 text-left">
          <Input 
            label="Your Name"
            type="text"
            placeholder="John Doe"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            disabled={isPlacingOrder}
            required
          />

          <Input 
            label="Phone Number"
            type="tel"
            placeholder="123-456-7890"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={isPlacingOrder}
            required
          />

          <Input 
            label="Table Number"
            type="text"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            disabled={isPlacingOrder}
            required
          />

          <TextArea 
            label="Special Cooking Instructions"
            placeholder="E.g. Ring once ready, Sauce separately."
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            disabled={isPlacingOrder}
            rows={2}
          />

          {/* Order Summary box */}
          <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Order Summary</span>
            <div className="text-xs space-y-1">
              {cartItems.map((item) => (
                <div key={item.itemId} className="flex justify-between text-slate-300">
                  <span>{item.name} x{item.count}</span>
                  <span>{formatPrice(item.pricePerUnit * item.count)}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            isLoading={isPlacingOrder}
          >
            Confirm & Place Order • {formatPrice(cartTotalVal)}
          </Button>
        </form>
      </Modal>

      {/* Order Success visual screen */}
      <Modal
        isOpen={isOrderSuccess}
        onClose={() => setIsOrderSuccess(false)}
        title="Order Dispatched"
      >
        <div className="py-6 text-center space-y-4 text-left">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-display font-extrabold text-base text-textPearl">✅ ORDER CONFIRMED</h3>
            <p className="text-xs text-mutedAsh">
              Your order has been placed successfully.
            </p>
            <p className="text-xs text-mutedAsh font-bold text-primary">
              Your order has been sent to the kitchen.
            </p>
          </div>
          <div className="space-y-2 pt-2">
            <Button 
              onClick={() => {
                setIsOrderSuccess(false);
                if (tenantId && lastPlacedOrderId) {
                  navigate(`/customer/restaurant/${tenantId}/order/${lastPlacedOrderId}`);
                }
              }}
              className="w-full bg-[#C85A3F] hover:bg-[#A94332] text-white"
            >
              Track Live Status →
            </Button>
            <Button 
              variant="outline"
              onClick={() => setIsOrderSuccess(false)}
              className="w-full"
            >
              Browse More Dishes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Call Service Modal */}
      <Modal
        isOpen={isServiceOpen}
        onClose={() => setIsServiceOpen(false)}
        title="Request Assistance"
      >
        <div className="space-y-3.5 text-center">
          <p className="text-xs text-mutedAsh mb-4">
            Select a service request below. Your table waiter will be notified immediately.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleRequestService('Call Waiter')}
              disabled={isCallingService}
              className="p-4 bg-slate-900 border border-slate-800 hover:border-primary text-slate-300 hover:text-primary text-xs font-semibold rounded-2xl flex flex-col items-center gap-2 transition-all"
            >
              <User className="w-5 h-5 text-primary" />
              <span>Call Waiter</span>
            </button>
            <button
              onClick={() => handleRequestService('Water')}
              disabled={isCallingService}
              className="p-4 bg-slate-900 border border-slate-800 hover:border-primary text-slate-300 hover:text-primary text-xs font-semibold rounded-2xl flex flex-col items-center gap-2 transition-all"
            >
              <Coffee className="w-5 h-5 text-primary" />
              <span>Request Water</span>
            </button>
            <button
              onClick={() => handleRequestService('Bill')}
              disabled={isCallingService}
              className="p-4 bg-slate-900 border border-slate-800 hover:border-primary text-slate-300 hover:text-primary text-xs font-semibold rounded-2xl flex flex-col items-center gap-2 transition-all"
            >
              <ShoppingBag className="w-5 h-5 text-primary" />
              <span>Request Bill</span>
            </button>
            <button
              onClick={() => handleRequestService('General Help')}
              disabled={isCallingService}
              className="p-4 bg-slate-900 border border-slate-800 hover:border-primary text-slate-300 hover:text-primary text-xs font-semibold rounded-2xl flex flex-col items-center gap-2 transition-all"
            >
              <AlertTriangle className="w-5 h-5 text-primary" />
              <span>General Help</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default CustomerPortal;
