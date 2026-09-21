import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCart } from '../../../context/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { useCurrency } from '../../../context/CurrencyContext';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { generateUniqueOrderId, isOrderActive } from '../../../shared/utils/orderUtils';
import { getMenuItemPath } from '../../../shared/firebase/collections';
import TableSelectionModal, { ITableData } from '../components/TableSelectionModal';
import { 
  getActiveDiningSession, 
  saveActiveDiningSession, 
  generateSessionId, 
  syncDiningSessionToFirestore 
} from '../../../shared/utils/diningSession';
import { tableService } from '../../../shared/services/tableService';
import { 
  ShoppingBag, Trash2, ArrowLeft, ArrowRight, Minus, Plus, 
  Tag, Check, Sparkles, ShieldCheck, Utensils, Heart, 
  MapPin, Store, AlertCircle, RefreshCw, FileText, CheckCircle2,
  Lock
} from 'lucide-react';
import toast from 'react-hot-toast';

// Safe Food Thumbnail with Graceful Fallback
const CartItemThumbnail: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-[85px] h-[85px] md:w-[115px] md:h-[95px] rounded-xl bg-[#F3E8DF] border border-[#E5DCD5] flex flex-col items-center justify-center shrink-0 text-[#C85A3F]/70">
        <Utensils className="w-6 h-6 text-[#C85A3F]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className="w-[85px] h-[85px] md:w-[115px] md:h-[95px] rounded-xl object-cover shrink-0 border border-[#E5DCD5] shadow-xs"
    />
  );
};

// Safe Dietary Badge
const DietaryBadge: React.FC<{ isVeg?: boolean }> = ({ isVeg }) => {
  if (isVeg === undefined) return null;
  return isVeg ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#2E8B57] border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-[#2E8B57]" />
      <span>Veg</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-[#A94332] border border-rose-200">
      <span className="w-1.5 h-1.5 rounded-full bg-[#A94332]" />
      <span>Non-Veg</span>
    </span>
  );
};

export const CartPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { currency, currencySymbol, formatPrice, formatCurrency } = useCurrency();
  
  const { 
    cartItems, 
    updateQuantity, 
    removeItem, 
    clearCart,
    cartSubtotal 
  } = useCart();

  // Restaurant, Table, and Session context
  const [activeTenantId, setActiveTenantId] = useState<string>('');
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [tableNumber, setTableNumber] = useState<string>('');
  const [session, setSession] = useState<any>(null);
  const [menuLookup, setMenuLookup] = useState<Record<string, any>>({});
  
  // Page UI states
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Form states
  const [couponCode, setCouponCode] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [waiterTip, setWaiterTip] = useState<number>(0);

  // Table selection modal state for Dine-In ordering
  const [isChangeTableOpen, setIsChangeTableOpen] = useState(false);

  const handleTableChange = (table: ITableData) => {
    const tNum = String(table.tableNumber || table.number || '').replace(/^TBL-/i, '');
    const tId = table.tableId || table.id;
    const newSession = {
      restaurantId: activeTenantId,
      tenantId: activeTenantId,
      branchId: table.branchId || 'main',
      tableId: tId,
      tableNumber: tNum,
      tableName: table.tableName || `Table ${tNum}`,
      orderSource: 'app',
      isLocked: false,
      startedAt: new Date().toISOString()
    };
    setSession(newSession);
    setTableNumber(tNum);
    sessionStorage.setItem('restaurantos_dining_session', JSON.stringify(newSession));
    localStorage.setItem('restaurantos_dining_session', JSON.stringify(newSession));
    setIsChangeTableOpen(false);
    toast.success(`Table updated to Table ${tNum}`);
  };

  // 1. Initial Tenant, Table & Session Resolution
  useEffect(() => {
    let currentTenant = '';
    let currentTable = '';

    // Check dining session from sessionStorage / localStorage
    const savedSessionStr = sessionStorage.getItem('restaurantos_dining_session') || localStorage.getItem('restaurantos_dining_session');
    if (savedSessionStr) {
      try {
        const parsedSession = JSON.parse(savedSessionStr);
        if (parsedSession) {
          setSession(parsedSession);
          if (parsedSession.restaurantId) {
            currentTenant = parsedSession.restaurantId;
          }
          if (parsedSession.tableId) {
            currentTable = String(parsedSession.tableId).replace('TBL-', '');
            setTableNumber(currentTable);
          }
        }
      } catch (e) {
        console.error('[CartPage] Failed to parse dining session', e);
      }
    }

    // Check table query param (?table=12 or ?tableId=TBL-12 or ?t=12)
    const tableParam = searchParams.get('table') || searchParams.get('tableId') || searchParams.get('t');
    if (tableParam) {
      currentTable = tableParam.replace('TBL-', '');
      setTableNumber(currentTable);
    }

    // Check tenant from cart storage
    const storedCartTenant = localStorage.getItem('restaurantos_cart_tenantId');
    if (storedCartTenant) {
      currentTenant = storedCartTenant;
    } else if (!currentTenant) {
      const urlTenant = searchParams.get('tenantId') || searchParams.get('r');
      if (urlTenant) currentTenant = urlTenant;
    }

    // Fallback demonstration tenant if none recorded
    if (!currentTenant) {
      currentTenant = 'bawarchi-restaurant';
    }
    setActiveTenantId(currentTenant);

    // Fetch Restaurant Details & Menu items for thumbnail enrichment
    const loadRestaurantAndMenu = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        let tenantDoc = await getDoc(doc(db, 'tenants', currentTenant));
        if (!tenantDoc.exists()) {
          tenantDoc = await getDoc(doc(db, 'restaurants', currentTenant));
        }

        if (tenantDoc.exists()) {
          const tData = tenantDoc.data();
          setRestaurantData(tData);
          const name = tData.restaurantName || tData.name || tData.title || 'Restaurant';
          setRestaurantName(name);
        }

        // Fetch menu collection once to map images and descriptions
        try {
          const itemsSnap = await getDocs(collection(db, getMenuItemPath(currentTenant)));
          const lookup: Record<string, any> = {};
          itemsSnap.forEach(d => {
            lookup[d.id] = d.data();
          });
          setMenuLookup(lookup);
        } catch (menuErr) {
          console.warn('[CartPage] Menu enrichment items unavailable:', menuErr);
        }
      } catch (err: any) {
        console.error('[CartPage] Failed to load tenant information:', err);
        setLoadError('Unable to load restaurant information. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadRestaurantAndMenu();
  }, [searchParams]);

  // 2. Pricing & Calculation Engine
  const subtotal = cartSubtotal; // in cents
  const discountVal = Math.round(subtotal * (discountPercent / 100)); // in cents
  const taxedSubtotal = Math.max(0, subtotal - discountVal);

  // Configured tax & fee rates (fallback: tax 8%, service fee 5%)
  const taxRatePercent = restaurantData?.taxRate ?? restaurantData?.taxPercent ?? 8;
  const serviceFeePercent = restaurantData?.serviceChargePercent ?? restaurantData?.serviceFeeRate ?? 5;

  const vatTax = taxRatePercent > 0 ? Math.round(taxedSubtotal * (taxRatePercent / 100)) : 0;
  const serviceCharge = serviceFeePercent > 0 ? Math.round(taxedSubtotal * (serviceFeePercent / 100)) : 0;
  
  // Total in cents snapshotted
  const grandTotal = taxedSubtotal + vatTax + serviceCharge + (waiterTip * 100);

  // Total item quantity count (unique products vs total quantity)
  const totalCartQuantity = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.count, 0);
  }, [cartItems]);

  // Tip options depending on currency
  const tipAmounts = useMemo(() => {
    return currency === 'INR' || currencySymbol === '₹' ? [0, 20, 50, 100] : [0, 2, 5, 10];
  }, [currency, currencySymbol]);

  // 3. Coupon Application Handler
  const handleApplyCoupon = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCouponError('');
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    if (code === 'LAUNCH20' || code === 'SPRING20') {
      setDiscountPercent(20);
      setAppliedCouponCode(code);
      toast.success(`${code} applied! 20% discount added.`);
    } else {
      setCouponError('Invalid coupon code. Try "LAUNCH20" or "SPRING20"');
    }
  };

  const handleRemoveCoupon = () => {
    setDiscountPercent(0);
    setAppliedCouponCode('');
    setCouponCode('');
    setCouponError('');
    toast.success('Coupon removed.');
  };

  // 4. Clear All Confirmation
  const handleConfirmClear = () => {
    clearCart();
    setShowClearConfirm(false);
    toast.success('All items cleared from your cart.');
  };

  // 5. Back Navigation
  const handleBackToMenu = () => {
    if (activeTenantId) {
      navigate(`/customer/restaurant/${activeTenantId}/menu`);
    } else {
      navigate(-1);
    }
  };

  // 6. Checkout / Order Placement Handler
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      toast.error('Your cart is empty.');
      return;
    }

    const tenantId = activeTenantId || 'bawarchi-restaurant';
    const resolvedBranchId = session?.branchId || 'main';
    const resolvedTableId = session?.tableId || (tableNumber ? (tableNumber.startsWith('TBL-') ? tableNumber : `TBL-${tableNumber}`) : '');

    if (!resolvedTableId || !tableNumber) {
      toast.error('Please select your table before placing a dine-in order.');
      setIsChangeTableOpen(true);
      return;
    }

    setIsPlacingOrder(true);
    try {
      // Security: Validate table existence and tenant ownership
      const tableRef = doc(db, 'restaurants', tenantId, 'tables', resolvedTableId);
      const tableSnap = await getDoc(tableRef);
      let tableData: any = null;

      if (tableSnap.exists()) {
        tableData = tableSnap.data();
      } else {
        const cleanNum = tableNumber.replace(/^TBL-/i, '');
        const q = query(collection(db, 'restaurants', tenantId, 'tables'), where('tableNumber', '==', cleanNum));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          tableData = qSnap.docs[0].data();
        }
      }

      if (!tableData) {
        toast.error('Table verification failed. The selected table does not belong to this restaurant.');
        setIsPlacingOrder(false);
        return;
      }

      if (tableData.isActive === false || String(tableData.status).toLowerCase() === 'disabled') {
        toast.error('The selected table is currently disabled. Please choose another table.');
        setIsChangeTableOpen(true);
        setIsPlacingOrder(false);
        return;
      }

      // Ensure active dining session exists and has a valid sessionId
      let currentSession = session || getActiveDiningSession(tenantId);
      if (!currentSession || !currentSession.sessionId) {
        currentSession = {
          sessionId: generateSessionId(),
          restaurantId: tenantId,
          tenantId,
          branchId: resolvedBranchId,
          tableId: resolvedTableId,
          tableNumber: tableNumber,
          tableName: session?.tableName || `Table ${tableNumber}`,
          orderSource: session?.orderSource || 'app',
          status: 'active',
          startedAt: new Date().toISOString()
        };
        setSession(currentSession);
        saveActiveDiningSession(currentSession);
        syncDiningSessionToFirestore(currentSession).catch(() => {});
      }

      // Check existing active orders count for this table to assign orderSequence
      let existingCount = 0;
      try {
        const cleanTNum = tableNumber.replace(/^TBL-/i, '');
        const qExisting = query(
          collection(db, 'restaurants', tenantId, 'orders'),
          where('tableNumber', '==', cleanTNum)
        );
        const existingSnap = await getDocs(qExisting);
        existingSnap.forEach(d => {
          const od = d.data();
          if (isOrderActive(od)) {
            existingCount++;
          }
        });
      } catch (_) {}

      const orderSequence = existingCount + 1;
      const isAdditional = existingCount > 0;
      const orderId = generateUniqueOrderId();

      const orderPayload = {
        id: orderId,
        orderId,
        customerId: user?.uid || 'guest-uid',
        customerName: user?.displayName || 'Guest Diner',
        phone: user?.phoneNumber || '+91 98765 43210',
        tenantId,
        restaurantId: tenantId,
        branchId: resolvedBranchId,
        tableId: resolvedTableId,
        tableNumber: tableNumber,
        tableName: currentSession?.tableName || `Table ${tableNumber}`,
        orderType: 'dine_in',
        orderSource: currentSession?.orderSource || 'app',
        items: cartItems.map(item => ({
          itemId: item.itemId,
          name: item.name,
          count: item.count,
          notes: item.notes || '',
          pricePerUnit: item.pricePerUnit,
          image: item.image || item.imageUrl || menuLookup[item.itemId]?.imageUrl || menuLookup[item.itemId]?.image || '',
          isVeg: item.isVeg ?? item.veg ?? menuLookup[item.itemId]?.isVeg ?? menuLookup[item.itemId]?.veg
        })),
        subtotal,
        tax: vatTax,
        serviceCharge,
        discount: discountVal,
        tip: waiterTip * 100,
        total: grandTotal,
        totalAmount: grandTotal,
        status: 'NEW',
        paymentStatus: 'pending',
        specialInstructions: specialInstructions.trim(),
        sessionId: currentSession.sessionId,
        orderSequence,
        isAdditionalOrder: isAdditional,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Write order directly to restaurants/{tenantId}/orders/{orderId}
      await setDoc(doc(db, 'restaurants', tenantId, 'orders', orderId), orderPayload);

      // Persist order reference to customer profile if authenticated
      if (user?.uid) {
        try {
          await setDoc(doc(db, 'customers', user.uid, 'orders', orderId), {
            id: orderId,
            orderId,
            tenantId,
            restaurantName: restaurantName || restaurantData?.name || tenantId,
            tableNumber: tableNumber || 'Walk-in',
            total: grandTotal,
            status: 'NEW',
            itemsCount: cartItems.length,
            createdAt: orderPayload.createdAt,
            updatedAt: orderPayload.updatedAt
          });
        } catch (custOrderErr) {
          console.warn('[CartPage] Failed to save customer profile order ref:', custOrderErr);
        }
      }

      // Persist recent order index in localStorage for guest resilience across tabs/pages
      try {
        const existingRecentStr = localStorage.getItem('restaurantos_customer_orders') || '[]';
        const existingRecent = JSON.parse(existingRecentStr);
        const updatedRecent = [
          {
            orderId,
            tenantId,
            restaurantName: restaurantName || restaurantData?.name || tenantId,
            tableNumber: tableNumber || 'Walk-in',
            total: grandTotal,
            status: 'NEW',
            itemsCount: cartItems.length,
            createdAt: orderPayload.createdAt
          },
          ...existingRecent.filter((o: any) => o.orderId !== orderId)
        ].slice(0, 20);
        localStorage.setItem('restaurantos_customer_orders', JSON.stringify(updatedRecent));
      } catch (storageErr) {
        console.warn('[CartPage] Failed to update local recent orders index:', storageErr);
      }

      // Robust canonical update to table status: transitions table to Occupied
      if (tenantId && (session?.tableId || tableNumber)) {
        try {
          await tableService.setTableOccupiedWithOrder(
            tenantId,
            session?.tableId || tableNumber,
            orderId,
            {
              total: grandTotal,
              itemsCount: cartItems.length,
              customerName: session?.customerName || user?.displayName || 'Guest Diner'
            }
          );
        } catch (tableErr) {
          console.warn('[CartPage] Table status occupation warning:', tableErr);
        }
      }

      toast.success('Order successfully routed to kitchen!');
      clearCart();

      // Navigate to order tracking page
      navigate(`/customer/restaurant/${tenantId}/order/${orderId}`);
    } catch (e) {
      console.error('Failed to submit checkout order:', e);
      toast.error('Checkout failed. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Loading skeleton state
  if (isLoading && cartItems.length === 0) {
    return (
      <div className="max-w-[1240px] mx-auto py-4 space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-[#F3E8DF] rounded-md" />
        <div className="space-y-2">
          <div className="h-9 w-48 bg-[#F3E8DF] rounded-lg" />
          <div className="h-4 w-72 bg-[#F3E8DF] rounded-md" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 bg-white border border-[#E5DCD5] rounded-2xl p-6 space-y-4">
            <div className="h-6 w-40 bg-[#F3E8DF] rounded-md" />
            <div className="h-24 bg-[#FCFAF7] rounded-xl border border-[#E5DCD5]" />
            <div className="h-24 bg-[#FCFAF7] rounded-xl border border-[#E5DCD5]" />
          </div>
          <div className="lg:col-span-4 bg-white border border-[#E5DCD5] rounded-2xl p-6 space-y-4">
            <div className="h-6 w-32 bg-[#F3E8DF] rounded-md" />
            <div className="h-32 bg-[#FCFAF7] rounded-xl border border-[#E5DCD5]" />
            <div className="h-12 bg-[#F3E8DF] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error state with retry
  if (loadError && cartItems.length === 0) {
    return (
      <div className="max-w-[1240px] mx-auto py-12 px-4 text-center">
        <div className="max-w-md mx-auto bg-white border border-[#E5DCD5] rounded-3xl p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-[#A94332] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-[#202124]">Unable to load your cart</h3>
          <p className="text-xs text-[#756B64]">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1240px] mx-auto space-y-6 text-left select-none pb-12">
      
      {/* 1. TOP CUSTOMER NAVIGATION */}
      <div className="flex items-center justify-between">
        <button 
          onClick={handleBackToMenu}
          className="inline-flex items-center space-x-2 text-xs font-bold text-[#756B64] hover:text-[#C85A3F] transition-colors cursor-pointer group py-1"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Menu</span>
        </button>

        {/* Decorative Tagline */}
        <span className="hidden sm:block text-xs font-serif italic text-[#C85A3F]/80">
          Good Food Brings People Together
        </span>
      </div>

      {/* 2. PAGE HEADER & CONTEXT */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 pb-2 border-b border-[#E5DCD5]/60">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-[#202124] tracking-tight">
            Your Cart
          </h1>
          <p className="text-xs md:text-sm text-[#756B64]">
            Review your selected dishes and customize your order.
          </p>
        </div>

        {/* Restaurant & Table Context Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {restaurantName && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F3E8DF] border border-[#E5DCD5] rounded-full text-xs font-bold text-[#202124]">
              <Store className="w-3.5 h-3.5 text-[#C85A3F]" />
              <span>Ordering from: <strong className="text-[#C85A3F]">{restaurantName}</strong></span>
            </div>
          )}
          {tableNumber ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-bold text-[#2E8B57]">
              <MapPin className="w-3.5 h-3.5 text-[#2E8B57]" />
              <span>Ordering at Table {tableNumber}</span>
              {session?.orderSource === 'qr' || session?.isLocked ? (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-wider">
                  QR
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsChangeTableOpen(true)}
                  className="text-[11px] font-extrabold text-[#C85A3F] hover:underline cursor-pointer ml-0.5"
                >
                  [Change Table]
                </button>
              )}
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-full text-xs font-bold text-rose-800">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>No Table Selected</span>
              <button
                type="button"
                onClick={() => setIsChangeTableOpen(true)}
                className="text-[11px] font-extrabold text-rose-700 underline cursor-pointer"
              >
                Select Table
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. EMPTY CART STATE */}
      {cartItems.length === 0 ? (
        <div className="p-12 md:p-16 text-center bg-white border border-[#E5DCD5] rounded-3xl space-y-5 max-w-xl mx-auto shadow-sm my-8">
          <div className="w-16 h-16 rounded-full bg-[#F3E8DF] flex items-center justify-center mx-auto text-[#C85A3F]">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-[#202124]">Your Cart is Empty</h2>
            <p className="text-xs md:text-sm text-[#756B64] max-w-sm mx-auto">
              Looks like you haven't added anything yet. Explore our delicious menu and start adding dishes.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button 
              onClick={() => navigate('/customer/explore')}
              className="bg-[#F3E8DF] hover:bg-[#E5DCD5] text-[#202124] font-bold py-3 px-6 text-xs rounded-xl transition-all cursor-pointer"
            >
              Browse Restaurants
            </button>
            {activeTenantId && (
              <button 
                onClick={() => navigate(`/customer/restaurant/${activeTenantId}/menu`)}
                className="bg-[#C85A3F] hover:bg-[#A94332] text-white font-bold py-3 px-6 text-xs rounded-xl shadow-md shadow-[#C85A3F]/20 transition-all cursor-pointer"
              >
                Back to Menu
              </button>
            )}
          </div>
        </div>
      ) : (
        /* 4. MAIN TWO-COLUMN CART WORKSPACE */
        <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* ======================================================== */}
          {/* LEFT COLUMN: CART ITEMS (Approx 68%)                     */}
          {/* ======================================================== */}
          <div className="lg:col-span-8 space-y-6">
            
            <div className="bg-white border border-[#E5DCD5] rounded-2xl p-5 md:p-6 shadow-xs space-y-5">
              
              {/* Card Header: Items Count & Clear All */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E5DCD5]">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-5 h-5 text-[#C85A3F]" />
                  <h2 className="text-sm md:text-base font-extrabold text-[#202124]">
                    Items in Your Cart
                  </h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F3E8DF] text-[#756B64]">
                    {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} · {totalCartQuantity} total
                  </span>
                </div>

                {/* Clear All Trigger with Confirmation Guard */}
                {!showClearConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="inline-flex items-center space-x-1.5 text-xs text-[#756B64] hover:text-[#C85A3F] font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center space-x-2 bg-rose-50 border border-rose-200 px-3 py-1 rounded-xl">
                    <span className="text-[11px] font-bold text-[#A94332]">Clear cart?</span>
                    <button
                      type="button"
                      onClick={handleConfirmClear}
                      className="text-[10.5px] font-extrabold text-white bg-[#A94332] px-2 py-0.5 rounded-md hover:bg-rose-700"
                    >
                      Yes, Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearConfirm(false)}
                      className="text-[10.5px] font-bold text-[#756B64] hover:text-[#202124]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="divide-y divide-[#E5DCD5]">
                {cartItems.map((item) => {
                  const itemLookup = menuLookup[item.itemId] || {};
                  const thumbSrc = item.imageUrl || item.image || itemLookup.imageUrl || itemLookup.image;
                  const itemDesc = item.description || itemLookup.description;
                  const isVegItem = item.isVeg ?? item.veg ?? itemLookup.isVeg ?? itemLookup.veg;

                  return (
                    <div key={item.itemId} className="py-4.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Left: Food Thumbnail & Details */}
                      <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                        <CartItemThumbnail 
                          src={thumbSrc} 
                          alt={item.name} 
                        />
                        
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <h3 className="text-sm md:text-base font-extrabold text-[#202124] line-clamp-2 leading-snug">
                              {item.name}
                            </h3>
                            <DietaryBadge isVeg={isVegItem} />
                          </div>

                          {/* Unit price */}
                          <div className="text-xs font-semibold text-[#756B64]">
                            {formatPrice(item.pricePerUnit)} each
                          </div>

                          {/* Item description if available */}
                          {itemDesc && (
                            <p className="text-[11px] text-[#756B64] line-clamp-2 leading-relaxed max-w-md">
                              {itemDesc}
                            </p>
                          )}

                          {/* Customization notes or size/addon pills */}
                          {item.notes && (
                            <div className="pt-1">
                              <span className="inline-flex items-center text-[10.5px] bg-[#F3E8DF] text-[#756B64] font-medium px-2.5 py-0.5 rounded-lg border border-[#E5DCD5]/80">
                                {item.notes.startsWith('Note:') ? item.notes : `Note: ${item.notes}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Stepper Controls, Line Total & Remove */}
                      <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E5DCD5]/40">
                        
                        {/* Quantity Stepper */}
                        <div className="flex items-center space-x-1.5 bg-[#F3E8DF] p-1 rounded-xl border border-[#E5DCD5]">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.itemId, item.count - 1)}
                            className="w-7 h-7 bg-white hover:bg-[#E5DCD5] rounded-lg flex items-center justify-center text-[#202124] font-bold transition-colors cursor-pointer"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-extrabold text-[#202124] w-5 text-center">
                            {item.count}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.itemId, item.count + 1)}
                            className="w-7 h-7 bg-white hover:bg-[#E5DCD5] rounded-lg flex items-center justify-center text-[#202124] font-bold transition-colors cursor-pointer"
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Line Total */}
                        <div className="text-right min-w-[70px]">
                          <span className="text-sm md:text-base font-extrabold text-[#202124]">
                            {formatPrice(item.pricePerUnit * item.count)}
                          </span>
                        </div>

                        {/* Remove item button */}
                        <button
                          type="button"
                          onClick={() => removeItem(item.itemId)}
                          className="p-2 text-[#756B64] hover:text-[#C85A3F] hover:bg-[#F3E8DF] rounded-xl transition-colors cursor-pointer"
                          aria-label={`Remove ${item.name}`}
                          title={`Remove ${item.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>

            {/* Special Instructions block */}
            <div className="bg-white border border-[#E5DCD5] rounded-2xl p-5 md:p-6 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#202124]">
                    Special Instructions <span className="text-[#756B64] font-normal normal-case">(Optional)</span>
                  </h3>
                  <p className="text-[11px] text-[#756B64] mt-0.5">
                    Any additional requests or kitchen preferences for your order?
                  </p>
                </div>
                <span className="text-[10px] font-bold text-[#756B64]">
                  {specialInstructions.length}/200
                </span>
              </div>
              
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value.slice(0, 200))}
                placeholder="e.g. No onions, extra spicy, separate packing, less oil..."
                className="w-full p-3 bg-white border border-[#E5DCD5] rounded-xl text-xs text-[#202124] placeholder-[#756B64]/60 focus:outline-none focus:border-[#C85A3F] focus:ring-1 focus:ring-[#C85A3F] h-24 resize-none transition-all"
              />
            </div>

          </div>

          {/* ======================================================== */}
          {/* RIGHT COLUMN: STICKY ORDER SUMMARY (Approx 32%)          */}
          {/* ======================================================== */}
          <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-5">
            
            <div className="bg-white border border-[#E5DCD5] p-5 md:p-6 rounded-2xl shadow-sm space-y-5">
              
              {/* Header */}
              <div className="flex items-center space-x-2 pb-3 border-b border-[#E5DCD5]">
                <FileText className="w-4 h-4 text-[#C85A3F]" />
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#202124]">
                  Order Summary
                </h2>
              </div>

              {/* Coupon / Voucher Input */}
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#756B64] block">
                  Apply Coupon Code
                </label>

                {discountPercent > 0 ? (
                  <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-[#2E8B57]" />
                      <div>
                        <span className="text-xs font-extrabold text-[#2E8B57] block">
                          {appliedCouponCode} (20% OFF)
                        </span>
                        <span className="text-[10px] text-[#2E8B57]/80">
                          Discount added to order
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-xs font-bold text-[#C85A3F] hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="text" 
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value);
                          setCouponError('');
                        }}
                        placeholder="Coupon code (e.g. LAUNCH20)" 
                        className="flex-1 px-3 py-2 bg-white border border-[#E5DCD5] focus:border-[#C85A3F] focus:ring-1 focus:ring-[#C85A3F] rounded-xl text-xs text-[#202124] focus:outline-none placeholder-[#756B64]/60 uppercase font-semibold"
                      />
                      <button 
                        type="button"
                        onClick={handleApplyCoupon}
                        className="px-4 py-2 bg-[#FCFAF7] hover:bg-[#F3E8DF] border border-[#C85A3F] text-xs font-bold text-[#C85A3F] rounded-xl transition-all cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-[11px] text-[#A94332] font-semibold pt-0.5">
                        {couponError}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Staff Tip Selector */}
              <div className="space-y-2 pt-2 border-t border-[#E5DCD5]/60">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#756B64] block">
                    Support Our Staff <span className="text-[#756B64]/70 font-normal normal-case">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-[#756B64] italic">
                    A small tip goes a long way!
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {tipAmounts.map((tip) => (
                    <button
                      key={tip}
                      type="button"
                      onClick={() => setWaiterTip(tip)}
                      className={`py-2 border text-[11px] font-bold rounded-xl text-center transition-all cursor-pointer ${
                        waiterTip === tip
                          ? 'bg-[#F3E8DF] border-[#C85A3F] text-[#C85A3F] shadow-xs'
                          : 'bg-white border-[#E5DCD5] text-[#756B64] hover:border-[#C85A3F]/50 hover:bg-[#FCFAF7]'
                      }`}
                    >
                      {tip === 0 ? 'None' : formatCurrency(tip)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bill Details Breakdown */}
              <div className="space-y-2.5 pt-3 border-t border-[#E5DCD5] text-xs text-[#756B64]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-[#202124]">{formatPrice(subtotal)}</span>
                </div>
                
                {discountVal > 0 && (
                  <div className="flex justify-between text-[#2E8B57] font-semibold">
                    <span>Discount ({discountPercent}%)</span>
                    <span>-{formatPrice(discountVal)}</span>
                  </div>
                )}

                {vatTax > 0 && (
                  <div className="flex justify-between">
                    <span>VAT / Tax ({taxRatePercent}%)</span>
                    <span className="font-bold text-[#202124]">{formatPrice(vatTax)}</span>
                  </div>
                )}

                {serviceCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Service Fee ({serviceFeePercent}%)</span>
                    <span className="font-bold text-[#202124]">{formatPrice(serviceCharge)}</span>
                  </div>
                )}

                {waiterTip > 0 && (
                  <div className="flex justify-between text-[#C85A3F] font-semibold">
                    <span>Staff Tip</span>
                    <span>{formatCurrency(waiterTip)}</span>
                  </div>
                )}

                <div className="border-t border-[#E5DCD5] pt-3 flex justify-between items-baseline">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#202124] block">
                      Total Amount
                    </span>
                    <span className="text-[10px] text-[#756B64]">
                      Includes all applicable taxes & charges
                    </span>
                  </div>
                  <span className="text-2xl md:text-3xl font-black text-[#C85A3F]">
                    {formatPrice(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Primary CTA Button */}
              <button 
                type="submit"
                disabled={isPlacingOrder || cartItems.length === 0}
                className="w-full bg-[#C85A3F] hover:bg-[#A94332] active:scale-[0.99] text-white font-extrabold py-4 px-6 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md shadow-[#C85A3F]/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPlacingOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Placing Order...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Security Reassurance Note */}
              <div className="flex items-center justify-center space-x-1.5 text-[11px] text-[#756B64] font-medium pt-1">
                <Lock className="w-3.5 h-3.5 text-[#2E8B57]" />
                <span>Safe & Secure Checkout · Satisfaction Guaranteed</span>
              </div>

            </div>

          </div>

        </form>
      )}

      {/* 5. BOTTOM REASSURANCE STRIP */}
      <div className="border-t border-[#E5DCD5] pt-8 mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        <div className="flex items-center justify-center gap-2.5 text-xs text-[#756B64] font-semibold">
          <Sparkles className="w-4 h-4 text-[#C85A3F]" />
          <span>Freshly Prepared to Order</span>
        </div>
        <div className="flex items-center justify-center gap-2.5 text-xs text-[#756B64] font-semibold">
          <ShieldCheck className="w-4 h-4 text-[#2E8B57]" />
          <span>Secure & Contactless Ordering</span>
        </div>
        <div className="flex items-center justify-center gap-2.5 text-xs text-[#756B64] font-semibold">
          <Heart className="w-4 h-4 text-[#C85A3F]" />
          <span>Support Local Restaurants</span>
        </div>
      </div>

      {activeTenantId && (
        <TableSelectionModal
          isOpen={isChangeTableOpen}
          onClose={() => setIsChangeTableOpen(false)}
          tenantId={activeTenantId}
          restaurantName={restaurantName}
          branchId={session?.branchId || 'main'}
          currentTableId={session?.tableId}
          onSelectTable={handleTableChange}
        />
      )}

    </div>
  );
};

export default CartPage;
