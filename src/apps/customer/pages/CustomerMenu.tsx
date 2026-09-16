import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  onSnapshot,
  where
} from 'firebase/firestore';
import { db } from '../../../shared/firebase/config';
import {
  getMenuItemPath,
  getMenuCategoryPath,
  getMenuVariantPath,
  getMenuAddonPath
} from '../../../shared/firebase/collections';
import { IMenuItem, IOrderItem } from '../../../shared/types';
import { useCart } from '../../../shared/services/CartContext';
import { useAuth } from '../../../context/AuthContext';
import { formatPrice, setGlobalCurrencyConfig } from '../../../shared/utils/format';
import { customerService } from '../../../shared/services/customerService';
import { generateUniqueOrderId, isOrderActive } from '../../../shared/utils/orderUtils';
import { 
  getActiveDiningSession, 
  saveActiveDiningSession, 
  generateSessionId, 
  syncDiningSessionToFirestore 
} from '../../../shared/utils/diningSession';

// Navigation & Header
import CustomerHeader from '../../../shared/ui/navigation/CustomerHeader';

// Icons
import {
  Search,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Clock,
  Star,
  MapPin,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Utensils,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  X,
  ExternalLink,
  ChevronDown,
  Info,
  Eye,
  Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';

export const CustomerMenu: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Cart operations
  const {
    cartItems,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    cartSubtotal,
  } = useCart();

  // Session & Table State
  const [session, setSession] = useState<any>(null);
  const [tableNumber, setTableNumber] = useState('');

  // Restaurant Branding & Details State
  const [restaurantName, setRestaurantName] = useState('Restaurant');
  const [coverImage, setCoverImage] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [cuisines, setCuisines] = useState<string>('');
  const [rating, setRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState<string | number | null>(null);
  const [locality, setLocality] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [avgPrepTime, setAvgPrepTime] = useState<number | null>(null);

  // Menu Data States (Streamed from Firestore canonical paths)
  const [menuItems, setMenuItems] = useState<IMenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; displayOrder: number }[]>([]);
  const [variantsList, setVariantsList] = useState<any[]>([]);
  const [addonsList, setAddonsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [dietaryFilter, setDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [sortBy, setSortBy] = useState<'recommended' | 'price-asc' | 'price-desc' | 'rating'>('recommended');

  // Active Orders in this Session
  const [activeOrders, setActiveOrders] = useState<any[]>([]);

  // Customization Modal State (for items with real variants / add-ons)
  const [customizingItem, setCustomizingItem] = useState<IMenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<any[]>([]);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [specialItemNotes, setSpecialItemNotes] = useState<string>('');

  // Cart Drawer / Modal for Mobile
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Order Placement States
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderInstructions, setOrderInstructions] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isOrderSuccess, setIsOrderSuccess] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState('');
  const [placedOrderPrepTime, setPlacedOrderPrepTime] = useState('15-20 mins');

  // Cross-tenant cart guard state
  const [cartTenantId, setCartTenantId] = useState<string | null>(() => {
    return localStorage.getItem('restaurantos_cart_tenantId');
  });

  // Track category section refs for smooth navigation
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({});

  // -------------------------------------------------------------
  // 1. Fetch Tenant Details, Menu, Categories, Variants, & Addons
  // -------------------------------------------------------------
  useEffect(() => {
    if (!tenantId) {
      setLoadError('No restaurant specified.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);

    // Reset previous restaurant states to avoid cross-tenant contamination
    setMenuItems([]);
    setCategories([]);
    setVariantsList([]);
    setAddonsList([]);
    setRestaurantName('Loading...');
    setCoverImage('');
    setLogoUrl('');
    setCuisines('');
    setRating(null);
    setReviewCount(null);
    setLocality('');

    // 1. Reconcile active dining session and table parameter
    const tableParam = searchParams.get('table') || searchParams.get('tableId') || searchParams.get('t');
    const activeSession = getActiveDiningSession(tenantId);

    if (activeSession) {
      setSession(activeSession);
      if (!tableParam && activeSession.tableNumber) {
        setTableNumber(activeSession.tableNumber);
      }
    }

    if (tableParam) {
      const cleanParam = tableParam.replace(/^TBL-/i, '');
      setTableNumber(cleanParam);

      if (!activeSession || activeSession.tableNumber !== cleanParam) {
        // Establish new active dining session for this table
        const newSession = {
          sessionId: generateSessionId(),
          restaurantId: tenantId,
          tenantId,
          branchId: 'main',
          tableId: tableParam.startsWith('TBL-') ? tableParam : `TBL-${cleanParam}`,
          tableNumber: cleanParam,
          tableName: `Table ${cleanParam}`,
          orderSource: searchParams.get('source') === 'qr' ? ('qr' as const) : ('app' as const),
          status: 'active' as const,
          startedAt: new Date().toISOString()
        };
        setSession(newSession);
        saveActiveDiningSession(newSession);
        syncDiningSessionToFirestore(newSession).catch(() => {});
      }
    }

    // Fetch Tenant Info from Firestore (tenants/{tenantId})
    const fetchTenantData = async () => {
      try {
        let tenantDoc = await getDoc(doc(db, 'tenants', tenantId));
        if (!tenantDoc.exists()) {
          // Fallback to restaurants collection if stored there
          tenantDoc = await getDoc(doc(db, 'restaurants', tenantId));
        }

        if (tenantDoc.exists()) {
          const data = tenantDoc.data();
          const name = data.restaurantName || data.name || data.title || 'Restaurant';
          setRestaurantName(name);
          setCoverImage(data.coverImageUrl || data.coverImage || data.bannerImage || data.image || '');
          setLogoUrl(data.logoUrl || data.logo || '');

          // Cuisines
          if (data.cuisines && Array.isArray(data.cuisines)) {
            setCuisines(data.cuisines.slice(0, 3).join(' · '));
          } else if (typeof data.cuisine === 'string' && data.cuisine) {
            setCuisines(data.cuisine.split(/[/,]/).map((s: string) => s.trim()).slice(0, 3).join(' · '));
          }

          // Rating and Review Count
          if (typeof data.rating === 'number' && data.rating > 0) {
            setRating(data.rating);
          } else if (typeof data.avgRating === 'number' && data.avgRating > 0) {
            setRating(data.avgRating);
          }
          if (data.reviewCount || data.reviewsCount || data.totalReviews) {
            setReviewCount(data.reviewCount || data.reviewsCount || data.totalReviews);
          }

          // Locality & City
          const city = typeof data.address === 'object' && data.address?.city
            ? data.address.city
            : (data.city || '');
          const street = typeof data.address === 'string'
            ? data.address
            : (data.address?.street || data.street || '');
          const area = (typeof data.address === 'object' && data.address?.area) || data.area || '';
          const locationStr = [area || street, city].filter(Boolean).join(', ');
          setLocality(locationStr);

          // Open status
          setIsOpen(data.status !== 'inactive' && data.status !== 'suspended' && data.isOpen !== false);

          // Average Prep Time
          if (data.avgPrepTime || data.prepTime) {
            setAvgPrepTime(data.avgPrepTime || data.prepTime);
          }

          // Currency config
          if (data.currency) {
            setGlobalCurrencyConfig(data.currency);
          }
        }
      } catch (err) {
        console.error('[CustomerMenu] Failed to fetch tenant info', err);
      }
    };
    fetchTenantData();

    // Stream Categories in real-time from canonical Firestore path
    // restaurants/{tenantId}/menu/default/categories
    const catColRef = collection(db, getMenuCategoryPath(tenantId));
    const unsubCats = onSnapshot(query(catColRef), (catSnap) => {
      const catList: { id: string; name: string; displayOrder: number }[] = [];
      catSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isActive !== false) {
          catList.push({
            id: docSnap.id,
            name: data.name || 'Category',
            displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : 99
          });
        }
      });
      catList.sort((a, b) => a.displayOrder - b.displayOrder);
      setCategories(catList);
    }, (err) => {
      console.warn('[CustomerMenu] Category subscription error:', err);
    });

    // Stream Menu Items in real-time from canonical Firestore path
    // restaurants/{tenantId}/menu/default/items
    const itemsColRef = collection(db, getMenuItemPath(tenantId));
    const unsubItems = onSnapshot(query(itemsColRef), (itemSnap) => {
      const items: IMenuItem[] = [];
      itemSnap.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({ id: docSnap.id, ...data } as IMenuItem);
      });
      setMenuItems(items);
      setIsLoading(false);
    }, (err) => {
      console.error('[CustomerMenu] Menu items subscription error:', err);
      setLoadError('Unable to load restaurant menu. Please check your connection and try again.');
      setIsLoading(false);
    });

    // Fetch Variants in real-time (restaurants/{tenantId}/menu/default/variants)
    const variantsColRef = collection(db, getMenuVariantPath(tenantId));
    const unsubVariants = onSnapshot(query(variantsColRef), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setVariantsList(list);
    }, () => {});

    // Fetch Addons in real-time (restaurants/{tenantId}/menu/default/addons)
    const addonsColRef = collection(db, getMenuAddonPath(tenantId));
    const unsubAddons = onSnapshot(query(addonsColRef), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setAddonsList(list);
    }, () => {});

    // Log Menu Viewed Event (non-blocking)
    customerService.logCustomerEvent(tenantId, 'Menu Viewed', `Customer opened menu for ${tenantId}`, {
      tenantId,
      tableNumber,
      deviceId: localStorage.getItem('restaurantos_device_id') || 'unknown'
    }).catch(() => {});

    return () => {
      unsubCats();
      unsubItems();
      unsubVariants();
      unsubAddons();
    };
  }, [tenantId, searchParams]);

  // -------------------------------------------------------------
  // 2. Real-time Listener for Active Orders in this Session
  // -------------------------------------------------------------
  useEffect(() => {
    if (!tenantId || (!session?.sessionId && !tableNumber)) {
      setActiveOrders([]);
      return;
    }

    const ordersColRef = collection(db, 'restaurants', tenantId, 'orders');
    const cleanTableNum = String(tableNumber || session?.tableNumber || '').replace(/^TBL-/i, '');

    let q = query(ordersColRef);
    if (cleanTableNum) {
      q = query(ordersColRef, where('tableNumber', '==', cleanTableNum));
    } else if (session?.sessionId) {
      q = query(ordersColRef, where('sessionId', '==', session.sessionId));
    }

    const unsubActiveOrders = onSnapshot(q, (snap) => {
      const list: any[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (isOrderActive(data)) {
          if (
            !session?.sessionId ||
            data.sessionId === session.sessionId ||
            !data.sessionId ||
            data.sessionId === 'GUEST-SESSION'
          ) {
            list.push({ id: docSnap.id, ...data });
          }
        }
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActiveOrders(list);
    }, (err) => {
      console.warn('[CustomerMenu] Active orders subscription error:', err);
    });

    return () => unsubActiveOrders();
  }, [tenantId, session?.sessionId, tableNumber, session?.tableNumber]);

  // Combined dining bill total for all active orders in session
  const activeOrdersTotal = useMemo(() => {
    return activeOrders.reduce((sum, o) => sum + (Number(o.total || o.totalAmount) || 0), 0);
  }, [activeOrders]);

  // -------------------------------------------------------------
  // 3. Cart Tenant Validation Guard
  // -------------------------------------------------------------
  const isCartFromDifferentRestaurant = useMemo(() => {
    if (cartItems.length === 0) return false;
    const storedTenant = localStorage.getItem('restaurantos_cart_tenantId');
    return Boolean(storedTenant && tenantId && storedTenant !== tenantId);
  }, [cartItems.length, tenantId]);

  const handleClearCrossRestaurantCart = () => {
    clearCart();
    if (tenantId) {
      localStorage.setItem('restaurantos_cart_tenantId', tenantId);
      setCartTenantId(tenantId);
    }
    toast.success(`Basket cleared. You can now order from ${restaurantName}.`);
  };

  // -------------------------------------------------------------
  // 4. Filter & Search Logic
  // -------------------------------------------------------------
  const filteredItems = useMemo(() => {
    let result = [...menuItems];

    // Filter by Category
    if (activeCategory !== 'all') {
      result = result.filter(item => item.category === activeCategory || item.categoryId === activeCategory);
    }

    // Filter by Dietary preference
    if (dietaryFilter === 'veg') {
      result = result.filter(item => item.isVeg || item.veg || item.vegetarian);
    } else if (dietaryFilter === 'non-veg') {
      result = result.filter(item => !(item.isVeg || item.veg || item.vegetarian));
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item =>
        (item.name || '').toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.tags || []).some(t => t.toLowerCase().includes(q)) ||
        (item.spiceLevel || '').toLowerCase().includes(q)
      );
    }

    // Sort items
    result.sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return (a.discountPrice || a.price) - (b.discountPrice || b.price);
        case 'price-desc':
          return (b.discountPrice || b.price) - (a.discountPrice || a.price);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'recommended':
        default:
          return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0);
      }
    });

    return result;
  }, [menuItems, activeCategory, dietaryFilter, searchQuery, sortBy]);

  // Group items by category for structured sections
  const categorizedMenu = useMemo(() => {
    const groups: Record<string, IMenuItem[]> = {};

    // First initialize from real Firestore categories to keep order
    categories.forEach(cat => {
      groups[cat.name] = [];
    });

    // Populate with filtered items
    filteredItems.forEach(item => {
      const catName = item.category || 'Other';
      if (!groups[catName]) {
        groups[catName] = [];
      }
      groups[catName].push(item);
    });

    // Remove empty categories when filtering or searching
    const nonEmptyGroups: Record<string, IMenuItem[]> = {};
    Object.entries(groups).forEach(([name, items]) => {
      if (items.length > 0) {
        nonEmptyGroups[name] = items;
      }
    });

    return nonEmptyGroups;
  }, [categories, filteredItems]);

  // Handle smooth scroll to category section
  const scrollToCategory = (catName: string) => {
    setActiveCategory(catName);
    if (catName === 'all') {
      window.scrollTo({ top: 250, behavior: 'smooth' });
      return;
    }
    const sectionEl = document.getElementById(`cat-sec-${catName.replace(/\s+/g, '-').toLowerCase()}`);
    if (sectionEl) {
      const yOffset = -90;
      const y = sectionEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // -------------------------------------------------------------
  // 5. Variants & Addons Detection for Menu Items
  // -------------------------------------------------------------
  const getItemVariants = (item: IMenuItem): any[] => {
    // Check item-level variants first
    if ((item as any).variants && Array.isArray((item as any).variants) && (item as any).variants.length > 0) {
      return (item as any).variants;
    }
    // Check Firestore variants subcollection
    return variantsList.filter(v => v.itemId === item.id || v.menuItemId === item.id);
  };

  const getItemAddons = (item: IMenuItem): any[] => {
    // Check item-level addons first
    if ((item as any).addons && Array.isArray((item as any).addons) && (item as any).addons.length > 0) {
      return (item as any).addons;
    }
    // Check Firestore addons subcollection
    return addonsList.filter(a => a.itemId === item.id || a.applicableItems?.includes(item.id) || a.isGlobal);
  };

  // -------------------------------------------------------------
  // 6. Cart Addition & Quantity Actions
  // -------------------------------------------------------------
  const getItemCartQuantity = (itemId: string): number => {
    const match = cartItems.find(ci => ci.itemId === itemId);
    return match ? match.count : 0;
  };

  const handleQuickAdd = (item: IMenuItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Check cross-restaurant cart
    if (isCartFromDifferentRestaurant) {
      toast((t) => (
        <div className="text-xs space-y-2">
          <p className="font-bold text-[#202124]">Basket contains items from another restaurant.</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                toast.dismiss(t.id);
                handleClearCrossRestaurantCart();
              }}
              className="px-3 py-1 bg-[#C85A3F] text-white font-bold rounded-lg"
            >
              Clear & Add
            </button>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1 bg-[#F3E8DF] text-[#756B64] font-bold rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      ), { duration: 6000 });
      return;
    }

    const variants = getItemVariants(item);
    const addons = getItemAddons(item);

    // If item has real variants or real addons, open customization modal
    if (variants.length > 0 || addons.length > 0) {
      setCustomizingItem(item);
      setSelectedVariant(variants.length > 0 ? variants[0] : null);
      setSelectedAddons([]);
      setItemQuantity(1);
      setSpecialItemNotes('');
      return;
    }

    // Otherwise directly add to cart
    if (tenantId) {
      localStorage.setItem('restaurantos_cart_tenantId', tenantId);
      setCartTenantId(tenantId);
    }
    addItem(item, 1);
    toast.success(`Added ${item.name} to order`);
  };

  const handleCustomizedAdd = () => {
    if (!customizingItem) return;

    if (tenantId) {
      localStorage.setItem('restaurantos_cart_tenantId', tenantId);
      setCartTenantId(tenantId);
    }

    let priceOffset = 0;
    if (selectedVariant && typeof selectedVariant.priceOffset === 'number') {
      priceOffset += selectedVariant.priceOffset;
    } else if (selectedVariant && typeof selectedVariant.price === 'number') {
      priceOffset += (selectedVariant.price - (customizingItem.price || 0));
    }

    const addonPrice = selectedAddons.reduce((sum, a) => sum + (a.price || 0), 0);
    const finalItemPrice = (customizingItem.discountPrice || customizingItem.price) + priceOffset + addonPrice;

    const notesParts: string[] = [];
    if (selectedVariant) {
      notesParts.push(`Size: ${selectedVariant.name || selectedVariant.label}`);
    }
    if (selectedAddons.length > 0) {
      notesParts.push(`Add-ons: ${selectedAddons.map(a => a.name || a.label).join(', ')}`);
    }
    if (specialItemNotes.trim()) {
      notesParts.push(specialItemNotes.trim());
    }

    const customizedItemObj: IMenuItem = {
      ...customizingItem,
      price: finalItemPrice,
      discountPrice: undefined
    };

    addItem(customizedItemObj, itemQuantity, notesParts.join(' | '));
    toast.success(`Added ${customizingItem.name} to order`);

    setCustomizingItem(null);
  };

  // -------------------------------------------------------------
  // 7. Bill Breakdown Calculation
  // -------------------------------------------------------------
  const totalCartCount = cartItems.reduce((acc, curr) => acc + curr.count, 0);
  const gstCharge = Math.round(cartSubtotal * 0.05);
  const serviceCharge = Math.round(cartSubtotal * 0.05);
  const totalCartCost = cartSubtotal + gstCharge + serviceCharge;

  // -------------------------------------------------------------
  // 8. Order Placement Flow (QR / Table Session)
  // -------------------------------------------------------------
  const handlePlaceOrder = async () => {
    if (!tenantId) {
      toast.error('Invalid restaurant session. Please scan table QR code again.');
      return;
    }
    if (cartItems.length === 0) {
      toast.error('Your basket is empty. Please add dishes to order.');
      return;
    }

    setIsPlacingOrder(true);
    try {
      const resolvedBranchId = session?.branchId || 'main';
      const cleanTableNum = String(tableNumber || session?.tableNumber || '').replace(/^TBL-/i, '');
      const resolvedTableId = session?.tableId || (cleanTableNum ? `TBL-${cleanTableNum}` : '');

      if (!resolvedTableId || !cleanTableNum) {
        toast.error('Please select a table to place a dine-in order.');
        setIsPlacingOrder(false);
        return;
      }

      // Security: Validate table existence and tenant ownership
      try {
        const tableDocRef = doc(db, 'restaurants', tenantId, 'tables', resolvedTableId);
        const tableSnap = await getDoc(tableDocRef);
        if (!tableSnap.exists()) {
          const tablesColRef = collection(db, 'restaurants', tenantId, 'tables');
          const q1 = query(tablesColRef, where('tableNumber', '==', cleanTableNum));
          let qSnap = await getDocs(q1);
          if (qSnap.empty) {
            const q2 = query(tablesColRef, where('number', '==', cleanTableNum));
            qSnap = await getDocs(q2);
          }
          if (qSnap.empty) {
            // Non-blocking table registration to prevent blocking diner orders
            try {
              await setDoc(tableDocRef, {
                id: resolvedTableId,
                tableId: resolvedTableId,
                tableNumber: cleanTableNum,
                tableName: `Table ${cleanTableNum}`,
                number: cleanTableNum,
                floor: 'Ground Floor',
                section: 'Main Dining',
                capacity: 4,
                status: 'Occupied',
                shape: 'square',
                branchId: resolvedBranchId,
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }, { merge: true });
            } catch (initErr) {
              console.warn('[CustomerMenu] Auto-provision table context warning:', initErr);
            }
          }
        }
      } catch (tableCheckErr) {
        console.warn('[CustomerMenu] Table check warning:', tableCheckErr);
      }

      // Validate restaurant table session if session credentials exist
      if (session?.secureToken) {
        const qrParams = {
          r: tenantId,
          b: resolvedBranchId,
          t: resolvedTableId,
          s: session.secureToken
        };
        const valRes = await customerService.validateDiningSessionQR(qrParams, true);
        if (!valRes.valid) {
          toast.error(`Order Validation Failed: ${(valRes.errorType || 'session invalid').replace('-', ' ').toUpperCase()}`);
          setIsPlacingOrder(false);
          return;
        }
      }

      // Check item availability
      const unavailableItem = cartItems.find(ci => {
        const matching = menuItems.find(m => m.id === ci.itemId);
        return matching && (matching.available === false || matching.isAvailable === false);
      });

      if (unavailableItem) {
        toast.error(`"${unavailableItem.name}" is currently sold out. Please remove it from basket.`);
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
          tableNumber: cleanTableNum,
          tableName: `Table ${cleanTableNum}`,
          orderSource: searchParams.get('source') === 'qr' ? 'qr' : 'app',
          status: 'active',
          startedAt: new Date().toISOString()
        };
        setSession(currentSession);
        saveActiveDiningSession(currentSession);
        syncDiningSessionToFirestore(currentSession).catch(() => {});
      }

      const isAdditional = activeOrders.length > 0;
      const orderSequence = activeOrders.length + 1;
      const orderId = generateUniqueOrderId();
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', orderId);

      const orderPayload = {
        id: orderId,
        orderId,
        customerId: user?.uid || 'guest-uid',
        customerName: customerName.trim() || user?.displayName || 'Guest Diner',
        customerEmail: user?.email || '',
        phone: customerPhone.trim() || user?.phoneNumber || '+91 98765 43210',
        tenantId,
        restaurantId: tenantId,
        branchId: resolvedBranchId,
        tableId: resolvedTableId,
        tableNumber: cleanTableNum,
        tableName: currentSession?.tableName || `Table ${cleanTableNum}`,
        orderType: 'dine_in',
        orderSource: currentSession?.orderSource || (searchParams.get('source') === 'qr' ? 'qr' : 'app'),
        items: cartItems.map(item => ({
          itemId: item.itemId,
          name: item.name,
          count: item.count,
          notes: item.notes || '',
          pricePerUnit: item.pricePerUnit,
          image: item.image || item.imageUrl || '',
          isVeg: item.isVeg ?? item.veg
        })),
        subtotal: cartSubtotal,
        tax: gstCharge,
        serviceCharge: serviceCharge,
        discount: 0,
        totalAmount: totalCartCost,
        total: totalCartCost,
        status: 'NEW',
        paymentStatus: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        specialInstructions: orderInstructions.trim(),
        sessionId: currentSession.sessionId,
        orderSequence,
        isAdditionalOrder: isAdditional
      };

      await setDoc(orderRef, orderPayload);

      // Persist order reference to customer profile if authenticated
      if (user?.uid) {
        try {
          await setDoc(doc(db, 'customers', user.uid, 'orders', orderId), {
            id: orderId,
            orderId,
            tenantId,
            restaurantName: restaurantName || tenantId,
            tableNumber: cleanTableNum,
            total: totalCartCost,
            status: 'NEW',
            itemsCount: cartItems.length,
            createdAt: orderPayload.createdAt,
            updatedAt: orderPayload.updatedAt
          });
        } catch (custOrderErr) {
          console.warn('[CustomerMenu] Failed to save customer profile order ref:', custOrderErr);
        }
      }

      // Persist recent order index in localStorage for resilient cross-tab active orders view
      try {
        const existingRecentStr = localStorage.getItem('restaurantos_customer_orders') || '[]';
        const existingRecent = JSON.parse(existingRecentStr);
        const updatedRecent = [
          {
            orderId,
            tenantId,
            restaurantName: restaurantName || tenantId,
            tableNumber: cleanTableNum,
            total: totalCartCost,
            status: 'NEW',
            itemsCount: cartItems.length,
            createdAt: orderPayload.createdAt
          },
          ...existingRecent.filter((o: any) => o.orderId !== orderId)
        ].slice(0, 20);
        localStorage.setItem('restaurantos_customer_orders', JSON.stringify(updatedRecent));
        window.dispatchEvent(new Event('storage'));
      } catch (storageErr) {
        console.warn('[CustomerMenu] Failed to update local recent orders index:', storageErr);
      }

      // Non-blocking table status update
      try {
        const tableRef = doc(db, 'restaurants', tenantId, 'tables', resolvedTableId);
        await updateDoc(tableRef, {
          status: 'Occupied',
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('[CustomerMenu] Table status update ignored:', err);
      }

      // Calculate estimated prep time
      const prepTimes = cartItems.map(ci => {
        const item = menuItems.find(m => m.id === ci.itemId);
        return item?.preparationTime || item?.prepTime || 15;
      });
      const maxPrep = prepTimes.length > 0 ? Math.max(...prepTimes) : 15;
      setPlacedOrderPrepTime(`${maxPrep} mins`);

      setPlacedOrderId(orderId);
      setIsMobileCartOpen(false);
      clearCart();
      toast.success('Order successfully sent to kitchen!');

      // Operational audit log
      customerService.logCustomerEvent(tenantId, 'Order Created', `Customer placed order ${orderId} on table ${cleanTableNum}`, {
        orderId,
        tableNumber: cleanTableNum,
        itemsCount: cartItems.length,
        total: totalCartCost
      }).catch(() => {});

      // Navigate immediately to Live Order Tracking
      navigate(`/customer/restaurant/${tenantId}/order/${orderId}`);
    } catch (err: any) {
      console.error('[CustomerMenu] Place order error:', err);
      const msg = err?.code === 'permission-denied'
        ? 'Permission denied submitting order. Please check session and try again.'
        : 'Failed to submit order to kitchen. Please try again.';
      toast.error(msg);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  // Helper for item badge (strictly max ONE promo badge, NO fake badges)
  const getItemPromoBadge = (item: IMenuItem): string | null => {
    if (item.isBestSeller || item.bestseller) return 'Bestseller';
    if (item.isRecommended || item.recommended) return 'Popular';
    if (item.tags?.includes("Chef's Special") || item.tags?.includes('Chefs Special')) return "Chef's Special";
    return null;
  };

  // -------------------------------------------------------------
  // Loading & Error States
  // -------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] text-[#202124] antialiased">
        <CustomerHeader tableNumber={tableNumber} restaurantName={restaurantName} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Hero skeleton */}
          <div className="w-full h-48 sm:h-56 bg-[#F3E8DF] animate-pulse rounded-3xl" />
          {/* Search skeleton */}
          <div className="h-12 bg-[#F3E8DF] animate-pulse rounded-2xl max-w-xl mx-auto" />
          {/* Categories chips skeleton */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-9 w-24 bg-[#F3E8DF] animate-pulse rounded-full shrink-0" />
            ))}
          </div>
          {/* Main 3-col skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-4">
            <div className="hidden lg:block lg:col-span-3 space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 bg-[#F3E8DF] animate-pulse rounded-xl" />
              ))}
            </div>
            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-72 bg-[#F3E8DF] animate-pulse rounded-2xl" />
              ))}
            </div>
            <div className="hidden lg:block lg:col-span-3 h-80 bg-[#F3E8DF] animate-pulse rounded-3xl" />
          </div>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] text-[#202124] flex flex-col antialiased">
        <CustomerHeader tableNumber={tableNumber} restaurantName={restaurantName} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#C85A3F]/10 border border-[#C85A3F]/20 flex items-center justify-center text-[#C85A3F]">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-display font-extrabold text-[#202124]">Unable to load menu</h2>
          <p className="text-xs text-[#756B64]">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold text-xs rounded-full shadow-md shadow-[#C85A3F]/20 transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#202124] antialiased selection:bg-[#F3E8DF]">
      {/* 1. Global Customer Header */}
      <CustomerHeader tableNumber={tableNumber} restaurantName={restaurantName} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        {/* 2. Restaurant Hero / Identity Section */}
        <div className="relative w-full rounded-3xl overflow-hidden border border-[#E5DCD5] shadow-xs bg-[#202124] text-white">
          {/* Background Image / Fallback */}
          <div className="w-full h-44 sm:h-52 md:h-56 relative overflow-hidden">
            {coverImage ? (
              <img
                src={coverImage}
                alt={restaurantName}
                className="w-full h-full object-cover brightness-[0.75]"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-[#202124] via-[#3a2820] to-[#202124] flex items-center justify-center">
                <Utensils className="w-16 h-16 text-[#F3E8DF]/20" />
              </div>
            )}
            {/* Subtle gradient for text contrast */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          </div>

          {/* Hero Content Overlay */}
          <div className="absolute bottom-0 inset-x-0 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="space-y-1.5 text-left max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-extrabold text-white tracking-tight">
                  {restaurantName}
                </h1>
                {isOpen ? (
                  <span className="inline-flex items-center gap-1 bg-[#2E8B57] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Open Now
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-[#756B64] text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                    Closed
                  </span>
                )}
              </div>

              {/* Rating + Cuisines */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#F3E8DF]">
                {rating !== null && (
                  <div className="flex items-center gap-1 bg-[#C85A3F] text-white px-2 py-0.5 rounded-md font-extrabold text-[11px]">
                    <Star className="w-3 h-3 fill-current" />
                    <span>{rating.toFixed(1)}</span>
                    {reviewCount !== null && (
                      <span className="text-[10px] text-white/80 font-normal">({reviewCount})</span>
                    )}
                  </div>
                )}
                {cuisines && (
                  <span className="font-medium text-white/90">{cuisines}</span>
                )}
                {locality && (
                  <span className="flex items-center gap-1 text-white/80">
                    <MapPin className="w-3 h-3 text-[#F3E8DF]" />
                    <span>{locality}</span>
                  </span>
                )}
                {avgPrepTime !== null && (
                  <span className="flex items-center gap-1 text-white/80">
                    <Clock className="w-3 h-3 text-[#F3E8DF]" />
                    <span>~{avgPrepTime} mins wait</span>
                  </span>
                )}
              </div>
            </div>

            {/* View Restaurant link / Table Badge */}
            <div className="flex items-center gap-2 shrink-0">
              {tableNumber && (
                <div className="bg-white/15 backdrop-blur-md border border-white/20 px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#F3E8DF]" />
                  <span>Ordering at Table {tableNumber}</span>
                </div>
              )}
              <button
                onClick={() => navigate(`/customer/restaurant/${tenantId}`)}
                className="bg-white/90 hover:bg-white text-[#202124] hover:text-[#C85A3F] px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer shadow-sm"
              >
                <span>View Restaurant</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 2.b. Persistent Active Dining Session Component */}
        {activeOrders.length > 0 && (
          <div className="bg-white border-2 border-emerald-500/25 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider bg-emerald-100/70 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span>🟢</span>
                    <span>ACTIVE ORDER</span>
                  </span>
                  <span className="text-xs font-bold text-[#202124]">
                    Table {tableNumber || session?.tableNumber || '1'}
                  </span>
                </div>
                <p className="text-xs text-[#756B64]">
                  <strong className="text-[#202124]">
                    {activeOrders.length} {activeOrders.length === 1 ? 'order' : 'orders'}
                  </strong>
                  {' '}• Current total:{' '}
                  <strong className="text-emerald-700 font-extrabold">{formatPrice(activeOrdersTotal)}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate(`/customer/restaurant/${tenantId}/active-order`)}
                className="px-4 py-2.5 bg-[#202124] hover:bg-[#333] text-white text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>View Active Order</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Search Bar + Quick Dietary Filters */}
        <div className="bg-white border border-[#E5DCD5] rounded-2xl p-3 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            {/* Search Input */}
            <div className="flex-1 bg-[#FCFAF7] border border-[#E5DCD5] focus-within:border-[#C85A3F] focus-within:ring-2 focus-within:ring-[#C85A3F]/10 rounded-xl px-3.5 py-2 flex items-center gap-2.5 transition-all">
              <Search className="w-4 h-4 text-[#756B64] shrink-0" />
              <input
                type="text"
                placeholder="Search dishes, biryani, chicken, paneer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#202124] placeholder-[#756B64] w-full outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-[#756B64] hover:text-[#202124] font-bold px-1"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Dietary Toggle Pills */}
            <div className="flex items-center gap-1.5 shrink-0 select-none">
              <button
                onClick={() => setDietaryFilter('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                  dietaryFilter === 'all'
                    ? 'bg-[#202124] text-white border-[#202124]'
                    : 'bg-[#FCFAF7] text-[#756B64] border-[#E5DCD5] hover:text-[#202124]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDietaryFilter(dietaryFilter === 'veg' ? 'all' : 'veg')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  dietaryFilter === 'veg'
                    ? 'bg-[#2E8B57] text-white border-[#2E8B57]'
                    : 'bg-[#FCFAF7] text-[#2E8B57] border-[#E5DCD5] hover:bg-[#2E8B57]/5'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#2E8B57] border border-white" />
                Veg
              </button>
              <button
                onClick={() => setDietaryFilter(dietaryFilter === 'non-veg' ? 'all' : 'non-veg')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  dietaryFilter === 'non-veg'
                    ? 'bg-[#C85A3F] text-white border-[#C85A3F]'
                    : 'bg-[#FCFAF7] text-[#C85A3F] border-[#E5DCD5] hover:bg-[#C85A3F]/5'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#C85A3F] border border-white" />
                Non-Veg
              </button>
            </div>
          </div>

          {/* Horizontal Quick Category Filters (Scrollable Chips) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none select-none pt-1">
            <button
              onClick={() => scrollToCategory('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all border cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-[#C85A3F] border-[#C85A3F] text-white shadow-xs'
                  : 'bg-white border-[#E5DCD5] text-[#202124] hover:border-[#C85A3F]/40'
              }`}
            >
              All Items ({menuItems.length})
            </button>
            {categories.map((cat) => {
              const count = menuItems.filter(m => m.category === cat.name || m.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.name)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                    activeCategory === cat.name
                      ? 'bg-[#C85A3F] border-[#C85A3F] text-white shadow-xs'
                      : 'bg-white border-[#E5DCD5] text-[#202124] hover:border-[#C85A3F]/40'
                  }`}
                >
                  {cat.name} {count > 0 && <span className="opacity-80 font-normal">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Main 3-Column Content Layout (Desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* LEFT: Category Navigation Sidebar (Desktop lg:col-span-2 or 3) */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-24 self-start bg-white border border-[#E5DCD5] rounded-3xl p-4 shadow-xs space-y-2 text-left">
            <div className="pb-2 border-b border-[#E5DCD5]">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#756B64]">
                Categories
              </h3>
            </div>
            <nav className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              <button
                onClick={() => scrollToCategory('all')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-between cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-[#F3E8DF] text-[#C85A3F]'
                    : 'text-[#202124] hover:bg-[#FCFAF7]'
                }`}
              >
                <span>All Dishes</span>
                <span className="text-[10px] font-bold text-[#756B64]">{menuItems.length}</span>
              </button>
              {categories.map((cat) => {
                const count = menuItems.filter(m => m.category === cat.name || m.categoryId === cat.id).length;
                const isSelected = activeCategory === cat.name;
                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.name)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#F3E8DF] text-[#C85A3F] font-extrabold'
                        : 'text-[#202124] hover:bg-[#FCFAF7]'
                    }`}
                  >
                    <span className="truncate pr-2">{cat.name}</span>
                    <span className="text-[10px] text-[#756B64] font-semibold">{count}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* CENTER: Menu Items Grid (lg:col-span-6) */}
          <div className="lg:col-span-6 space-y-8 text-left">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center bg-white border border-[#E5DCD5] rounded-3xl p-8 space-y-3 shadow-xs">
                <Utensils className="w-10 h-10 text-[#756B64] mx-auto opacity-40" />
                <h3 className="text-sm font-extrabold text-[#202124]">No dishes found</h3>
                <p className="text-xs text-[#756B64]">
                  {searchQuery ? `No menu dishes match "${searchQuery}".` : 'This restaurant has not listed any dishes under this category yet.'}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategory('all');
                      setDietaryFilter('all');
                    }}
                    className="px-4 py-2 bg-[#F3E8DF] hover:bg-[#E5DCD5] text-[#C85A3F] font-extrabold text-xs rounded-full transition-all"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              Object.entries(categorizedMenu).map(([categoryName, items]) => (
                <section
                  key={categoryName}
                  id={`cat-sec-${categoryName.replace(/\s+/g, '-').toLowerCase()}`}
                  className="space-y-4 pt-1"
                >
                  {/* Category Section Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#E5DCD5]">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-display font-extrabold text-[#202124]">
                        {categoryName}
                      </h2>
                      <span className="text-[11px] font-bold text-[#756B64] bg-[#F3E8DF] px-2 py-0.5 rounded-full">
                        {items.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards Grid: 3 cards per row desktop, 2 on tablet, 1 on mobile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {items.map((item) => {
                      const isVeg = item.isVeg || item.veg || item.vegetarian;
                      const isAvailable = item.isAvailable !== false && item.available !== false;
                      const promoBadge = getItemPromoBadge(item);
                      const prepTime = item.preparationTime || item.prepTime;
                      const cartCount = getItemCartQuantity(item.id);
                      const hasVariantsOrAddons = getItemVariants(item).length > 0 || getItemAddons(item).length > 0;

                      return (
                        <div
                          key={item.id}
                          className={`bg-white border border-[#E5DCD5] rounded-2xl p-3.5 flex flex-col justify-between shadow-xs hover:border-[#C85A3F]/40 hover:shadow-md transition-all duration-200 group ${
                            !isAvailable ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="space-y-3">
                            {/* 1. Dish Image + Badges */}
                            <div className="w-full h-36 sm:h-38 rounded-xl overflow-hidden bg-[#FCFAF7] border border-[#E5DCD5] relative shrink-0">
                              {(item.imageUrl || item.image) ? (
                                <img
                                  src={item.imageUrl || item.image}
                                  alt={item.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-[#756B64] bg-[#F3E8DF]/40">
                                  <Utensils className="w-8 h-8 text-[#C85A3F]/40 mb-1" />
                                  <span className="text-[10px] font-semibold text-[#756B64]">House Specialty</span>
                                </div>
                              )}

                              {/* Single Promo Badge (Top Left) */}
                              {promoBadge && (
                                <span className="absolute top-2 left-2 bg-[#C85A3F] text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md shadow-xs">
                                  {promoBadge}
                                </span>
                              )}

                              {/* Preparation Time (Bottom Right) ONLY if real */}
                              {prepTime && (
                                <span className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-[#F3E8DF]" />
                                  <span>{prepTime}m</span>
                                </span>
                              )}

                              {/* Sold out overlay */}
                              {!isAvailable && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center">
                                  <span className="text-white text-[11px] font-extrabold bg-[#202124]/90 px-3 py-1 rounded-md uppercase tracking-wider">
                                    Sold Out
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* 2. Dish Name + Dietary Indicator */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                {isVeg !== undefined && (
                                  <span
                                    className={`inline-flex items-center justify-center w-3.5 h-3.5 border rounded-xs shrink-0 ${
                                      isVeg
                                        ? 'border-[#2E8B57]'
                                        : 'border-[#C85A3F]'
                                    }`}
                                    title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full ${
                                        isVeg ? 'bg-[#2E8B57]' : 'bg-[#C85A3F]'
                                      }`}
                                    />
                                  </span>
                                )}
                                <h3 className="font-extrabold text-sm text-[#202124] leading-snug line-clamp-2">
                                  {item.name}
                                </h3>
                              </div>

                              {/* 3. Short Description (omitted if not present) */}
                              {item.description && (
                                <p className="text-[11px] text-[#756B64] line-clamp-2 leading-relaxed">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* 4. Price & Add / Stepper Action */}
                          <div className="pt-3 mt-2 border-t border-[#F3E8DF] flex items-center justify-between gap-2">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-sm font-extrabold text-[#202124]">
                                {formatPrice(item.discountPrice || item.price)}
                              </span>
                              {item.discountPrice && item.discountPrice < item.price && (
                                <span className="text-[10px] text-[#756B64] line-through">
                                  {formatPrice(item.price)}
                                </span>
                              )}
                            </div>

                            {/* Add / Stepper Button */}
                            {!isAvailable ? (
                              <span className="text-[10px] font-bold text-[#756B64] bg-[#F3E8DF] px-2.5 py-1 rounded-lg uppercase">
                                Unavailable
                              </span>
                            ) : cartCount > 0 ? (
                              <div className="flex items-center gap-1.5 bg-[#F3E8DF] p-1 rounded-xl border border-[#E5DCD5]">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, cartCount - 1)}
                                  className="w-6 h-6 bg-white hover:bg-[#E5DCD5] text-[#202124] font-extrabold rounded-lg flex items-center justify-center text-xs shadow-xs cursor-pointer transition-colors"
                                  aria-label={`Decrease ${item.name} quantity`}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-xs font-extrabold text-[#202124] w-4 text-center">
                                  {cartCount}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, cartCount + 1)}
                                  className="w-6 h-6 bg-white hover:bg-[#E5DCD5] text-[#202124] font-extrabold rounded-lg flex items-center justify-center text-xs shadow-xs cursor-pointer transition-colors"
                                  aria-label={`Increase ${item.name} quantity`}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => handleQuickAdd(item, e)}
                                className="px-3.5 py-1.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-extrabold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95"
                                aria-label={`Add ${item.name} to cart`}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add</span>
                                {hasVariantsOrAddons && (
                                  <span className="text-[9px] opacity-80">+</span>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>

          {/* RIGHT: Desktop Sticky "Your Order" Panel (lg:col-span-3) */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-24 self-start bg-white border border-[#E5DCD5] rounded-3xl p-5 shadow-xs space-y-4 text-left">
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DCD5]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#C85A3F]" />
                <h3 className="text-sm font-extrabold text-[#202124]">Your Order</h3>
              </div>
              <span className="text-[11px] bg-[#F3E8DF] text-[#C85A3F] font-extrabold px-2.5 py-0.5 rounded-full">
                {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Cross-tenant cart alert */}
            {isCartFromDifferentRestaurant && (
              <div className="bg-[#FFF5F2] border border-[#C85A3F]/30 p-3 rounded-2xl space-y-2 text-xs">
                <p className="text-[#C85A3F] font-bold">
                  Your basket contains items from another restaurant.
                </p>
                <button
                  onClick={handleClearCrossRestaurantCart}
                  className="w-full py-1.5 bg-[#C85A3F] text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  Clear & Order Here
                </button>
              </div>
            )}

            {/* Empty Cart State vs Active Dining Session */}
            {cartItems.length === 0 ? (
              activeOrders.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50/70 border border-emerald-500/25 rounded-2xl p-4 text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>ACTIVE DINING</span>
                      </div>
                      <span className="text-[10px] bg-white border border-emerald-200 text-emerald-800 font-extrabold px-2 py-0.5 rounded-md">
                        Table {tableNumber || session?.tableNumber || '1'}
                      </span>
                    </div>

                    <div className="space-y-1.5 border-t border-emerald-100 pt-2 text-xs">
                      <div className="flex justify-between text-[#756B64]">
                        <span>Submitted Orders:</span>
                        <span className="font-bold text-[#202124]">{activeOrders.length}</span>
                      </div>
                      <div className="flex justify-between text-[#756B64]">
                        <span>Current Total:</span>
                        <span className="font-extrabold text-emerald-700">{formatPrice(activeOrdersTotal)}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {activeOrders.slice(0, 3).map((ord, idx) => (
                        <div key={ord.id || ord.orderId} className="text-[11px] bg-white/90 border border-emerald-100 p-2 rounded-xl flex items-center justify-between">
                          <span className="font-bold text-[#202124]">Order #{ord.orderSequence || (activeOrders.length - idx)}</span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {ord.status || 'Received'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => navigate(`/customer/restaurant/${tenantId}/active-order`)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>View Active Order</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-3 bg-[#FCFAF7] border border-[#E5DCD5] rounded-xl text-center">
                    <p className="text-[11px] text-[#756B64] font-medium">
                      Select dishes from the menu to add more food to your table visit.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center space-y-2.5">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#FCFAF7] border border-[#E5DCD5] flex items-center justify-center text-[#756B64]">
                    <ShoppingBag className="w-6 h-6 opacity-40" />
                  </div>
                  <h4 className="text-xs font-extrabold text-[#202124]">Your order is empty</h4>
                  <p className="text-[11px] text-[#756B64] max-w-[200px] mx-auto leading-relaxed">
                    Select delicious dishes from the menu to get started.
                  </p>
                </div>
              )
            ) : (
              <>
                {/* Active Dining compact reminder above Current Cart */}
                {activeOrders.length > 0 && (
                  <div className="bg-emerald-50/60 border border-emerald-500/20 p-2.5 rounded-xl flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[11px] text-emerald-800 font-bold">
                        Table {tableNumber || session?.tableNumber}: {activeOrders.length} {activeOrders.length === 1 ? 'order' : 'orders'} ({formatPrice(activeOrdersTotal)})
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/customer/restaurant/${tenantId}/active-order`)}
                      className="text-[10px] font-extrabold text-emerald-700 hover:underline cursor-pointer"
                    >
                      View
                    </button>
                  </div>
                )}

                {/* Cart Items List */}
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1 divide-y divide-[#F3E8DF]">
                  {cartItems.map((ci) => {
                    const matchedItem = menuItems.find(m => m.id === ci.itemId);
                    const itemThumb = matchedItem?.imageUrl || matchedItem?.image;

                    return (
                      <div key={ci.itemId} className="flex items-start justify-between pt-2.5 first:pt-0 gap-2">
                        {itemThumb && (
                          <img
                            src={itemThumb}
                            alt={ci.name}
                            className="w-11 h-11 rounded-lg object-cover border border-[#E5DCD5] shrink-0"
                          />
                        )}
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <h4 className="text-xs font-extrabold text-[#202124] truncate">
                            {ci.name}
                          </h4>
                          {ci.notes && (
                            <p className="text-[10px] text-[#C85A3F] truncate">
                              {ci.notes}
                            </p>
                          )}
                          <span className="text-[11px] font-extrabold text-[#202124]">
                            {formatPrice(ci.pricePerUnit * ci.count)}
                          </span>
                        </div>

                        {/* Stepper + Delete */}
                        <div className="flex items-center gap-1 bg-[#F3E8DF] p-1 rounded-xl shrink-0">
                          <button
                            type="button"
                            onClick={() => updateQuantity(ci.itemId, ci.count - 1)}
                            className="w-5 h-5 bg-white hover:bg-[#E5DCD5] text-[#202124] font-bold rounded flex items-center justify-center text-xs cursor-pointer"
                            aria-label={`Decrease ${ci.name} quantity`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-extrabold text-[#202124] w-3.5 text-center">
                            {ci.count}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(ci.itemId, ci.count + 1)}
                            className="w-5 h-5 bg-white hover:bg-[#E5DCD5] text-[#202124] font-bold rounded flex items-center justify-center text-xs cursor-pointer"
                            aria-label={`Increase ${ci.name} quantity`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Clear All subtle link */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={clearCart}
                    className="text-[10px] text-[#756B64] hover:text-[#C85A3F] font-bold transition-colors cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                {/* Bill Breakdown */}
                <div className="bg-[#FCFAF7] border border-[#E5DCD5] p-3.5 rounded-2xl text-xs space-y-1.5 font-semibold text-[#756B64]">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-[#202124] font-bold">{formatPrice(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes & Fees (5% GST)</span>
                    <span className="text-[#202124] font-bold">{formatPrice(gstCharge)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service Fee (5%)</span>
                    <span className="text-[#202124] font-bold">{formatPrice(serviceCharge)}</span>
                  </div>
                  <div className="flex justify-between text-[#202124] font-extrabold text-sm pt-2 border-t border-[#E5DCD5]">
                    <span>Total Amount</span>
                    <span className="text-[#C85A3F] font-extrabold">{formatPrice(totalCartCost)}</span>
                  </div>
                </div>

                {/* Table Dining Checkout Form (if ordering in table context) */}
                {tableNumber ? (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      placeholder="Your Name *"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-white border border-[#E5DCD5] focus:border-[#C85A3F] rounded-xl px-3 py-2 text-xs text-[#202124] placeholder-[#756B64] outline-none"
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number (Optional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-white border border-[#E5DCD5] focus:border-[#C85A3F] rounded-xl px-3 py-2 text-xs text-[#202124] placeholder-[#756B64] outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Special instructions (e.g. Less spicy)"
                      value={orderInstructions}
                      onChange={(e) => setOrderInstructions(e.target.value)}
                      className="w-full bg-white border border-[#E5DCD5] focus:border-[#C85A3F] rounded-xl px-3 py-2 text-xs text-[#202124] placeholder-[#756B64] outline-none"
                    />
                    <button
                      onClick={handlePlaceOrder}
                      disabled={isPlacingOrder || isCartFromDifferentRestaurant}
                      className="w-full bg-[#C85A3F] hover:bg-[#A94332] disabled:opacity-50 text-white font-extrabold text-xs py-3.5 rounded-xl shadow-md shadow-[#C85A3F]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isPlacingOrder 
                        ? 'Sending to Kitchen...' 
                        : (activeOrders.length > 0 
                            ? `Confirm Add-on Order • ${formatPrice(totalCartCost)}` 
                            : `Confirm Order • ${formatPrice(totalCartCost)}`
                          )
                      }
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => navigate('/customer/cart')}
                    className="w-full bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold text-xs py-3.5 rounded-xl shadow-md shadow-[#C85A3F]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>View Cart & Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
          </aside>
        </div>

        {/* 5. Bottom Consumer Reassurance Strip */}
        <div className="border-t border-[#E5DCD5] pt-8 pb-12 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-[#756B64] font-semibold">
            <ShieldCheck className="w-4 h-4 text-[#2E8B57]" />
            <span>Safe & Contactless Ordering</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-[#756B64] font-semibold">
            <Sparkles className="w-4 h-4 text-[#C85A3F]" />
            <span>Freshly Prepared to Order</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-[#756B64] font-semibold">
            <Utensils className="w-4 h-4 text-[#202124]" />
            <span>Direct Kitchen Dispatch</span>
          </div>
        </div>
      </main>

      {/* 6. Floating Bottom Cart Bar for Mobile (< 1024px) */}
      {totalCartCount > 0 ? (
        <div className="lg:hidden fixed bottom-4 inset-x-4 z-40 max-w-lg mx-auto">
          <button
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-[#C85A3F] hover:bg-[#A94332] text-white px-5 py-3.5 rounded-2xl shadow-xl shadow-[#C85A3F]/30 flex items-center justify-between font-extrabold transition-transform active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5" />
              <span className="text-xs">
                {totalCartCount} {totalCartCount === 1 ? 'item' : 'items'} · {formatPrice(totalCartCost)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span>View Order</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      ) : activeOrders.length > 0 ? (
        <div className="lg:hidden fixed bottom-4 inset-x-4 z-40 max-w-lg mx-auto">
          <button
            onClick={() => navigate(`/customer/restaurant/${tenantId}/active-order`)}
            className="w-full bg-[#202124] hover:bg-[#333] text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center justify-between font-extrabold transition-transform active:scale-[0.98] cursor-pointer border border-white/10"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs">
                Table {tableNumber || session?.tableNumber}: {activeOrders.length} {activeOrders.length === 1 ? 'order' : 'orders'} · {formatPrice(activeOrdersTotal)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <span>View Active Order</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      ) : null}

      {/* 7. Mobile Cart Drawer / Bottom Sheet */}
      {isMobileCartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white border border-[#E5DCD5] rounded-t-3xl sm:rounded-3xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 text-left relative shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DCD5]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#C85A3F]" />
                <h3 className="text-sm font-extrabold text-[#202124]">Your Order Summary</h3>
              </div>
              <button
                onClick={() => setIsMobileCartOpen(false)}
                className="p-1.5 bg-[#F3E8DF] hover:bg-[#E5DCD5] rounded-full text-[#756B64] hover:text-[#202124]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items list */}
            <div className="space-y-3 divide-y divide-[#F3E8DF] max-h-52 overflow-y-auto pr-1">
              {cartItems.map((ci) => (
                <div key={ci.itemId} className="flex items-start justify-between pt-2.5 first:pt-0 gap-2">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <h4 className="text-xs font-extrabold text-[#202124]">{ci.name}</h4>
                    {ci.notes && <p className="text-[10px] text-[#C85A3F]">{ci.notes}</p>}
                    <span className="text-[11px] font-bold text-[#756B64]">{formatPrice(ci.pricePerUnit * ci.count)}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-[#F3E8DF] p-1 rounded-xl shrink-0">
                    <button
                      onClick={() => updateQuantity(ci.itemId, ci.count - 1)}
                      className="w-5 h-5 bg-white text-[#202124] font-bold rounded flex items-center justify-center text-xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-extrabold text-[#202124] w-3.5 text-center">{ci.count}</span>
                    <button
                      onClick={() => updateQuantity(ci.itemId, ci.count + 1)}
                      className="w-5 h-5 bg-white text-[#202124] font-bold rounded flex items-center justify-center text-xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Invoicing summary */}
            <div className="bg-[#FCFAF7] border border-[#E5DCD5] p-3.5 rounded-2xl text-xs space-y-1.5 font-semibold text-[#756B64]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-[#202124] font-bold">{formatPrice(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes & Fees (5% GST)</span>
                <span className="text-[#202124] font-bold">{formatPrice(gstCharge)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Fee (5%)</span>
                <span className="text-[#202124] font-bold">{formatPrice(serviceCharge)}</span>
              </div>
              <div className="flex justify-between text-[#202124] font-extrabold text-sm pt-2 border-t border-[#E5DCD5]">
                <span>Total Amount</span>
                <span className="text-[#C85A3F] font-extrabold">{formatPrice(totalCartCost)}</span>
              </div>
            </div>

            {/* Table Details */}
            {tableNumber ? (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="Your Name *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-white border border-[#E5DCD5] rounded-xl px-3 py-2 text-xs text-[#202124] outline-none"
                />
                <input
                  type="text"
                  placeholder="Cooking instructions (e.g. Less spicy)"
                  value={orderInstructions}
                  onChange={(e) => setOrderInstructions(e.target.value)}
                  className="w-full bg-white border border-[#E5DCD5] rounded-xl px-3 py-2 text-xs text-[#202124] outline-none"
                />
                <button
                  onClick={handlePlaceOrder}
                  disabled={isPlacingOrder}
                  className="w-full bg-[#C85A3F] text-white font-extrabold text-xs py-3.5 rounded-xl transition-all shadow-md shadow-[#C85A3F]/20 cursor-pointer"
                >
                  {isPlacingOrder ? 'Sending to Kitchen...' : `Confirm Order • ${formatPrice(totalCartCost)}`}
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/customer/cart')}
                className="w-full bg-[#C85A3F] text-white font-extrabold text-xs py-3.5 rounded-xl shadow-md shadow-[#C85A3F]/20 flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>View Cart & Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 8. Item Customization Modal (for items with real variants/addons) */}
      {customizingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-[#E5DCD5] rounded-3xl p-6 max-w-md w-full text-left space-y-4 relative shadow-2xl my-6">
            <button
              onClick={() => setCustomizingItem(null)}
              className="absolute top-4 right-4 p-1.5 bg-[#F3E8DF] hover:bg-[#E5DCD5] rounded-full text-[#756B64] hover:text-[#202124]"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Customizing Item Header */}
            <div className="space-y-1 pr-6">
              <h3 className="text-base font-display font-extrabold text-[#202124]">
                {customizingItem.name}
              </h3>
              <p className="text-xs font-extrabold text-[#C85A3F]">
                {formatPrice(customizingItem.discountPrice || customizingItem.price)}
              </p>
            </div>

            {/* Real Variants (Portion / Size) if present */}
            {getItemVariants(customizingItem).length > 0 && (
              <div className="space-y-2 border-t border-[#F3E8DF] pt-3">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#756B64] block">
                  Choose Portion / Size
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {getItemVariants(customizingItem).map((v: any) => {
                    const isSelected = selectedVariant?.id === v.id || selectedVariant?.name === v.name;
                    const offset = v.priceOffset || (v.price ? v.price - (customizingItem.price || 0) : 0);
                    return (
                      <button
                        key={v.id || v.name}
                        onClick={() => setSelectedVariant(v)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#F3E8DF] border-[#C85A3F] text-[#C85A3F] font-extrabold'
                            : 'bg-[#FCFAF7] border-[#E5DCD5] text-[#202124] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <span className="block text-xs font-bold">{v.name || v.label}</span>
                        {offset !== 0 && (
                          <span className="text-[10px] text-[#756B64]">
                            {offset > 0 ? `+${formatPrice(offset)}` : formatPrice(offset)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Real Addons if present */}
            {getItemAddons(customizingItem).length > 0 && (
              <div className="space-y-2 border-t border-[#F3E8DF] pt-3">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#756B64] block">
                  Choose Add-ons
                </label>
                <div className="space-y-2">
                  {getItemAddons(customizingItem).map((addon: any) => {
                    const isChecked = selectedAddons.some(a => a.id === addon.id || a.name === addon.name);
                    return (
                      <button
                        key={addon.id || addon.name}
                        onClick={() => {
                          setSelectedAddons(prev =>
                            isChecked ? prev.filter(a => (a.id || a.name) !== (addon.id || addon.name)) : [...prev, addon]
                          );
                        }}
                        className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-[#F3E8DF] border-[#C85A3F] text-[#202124] font-bold'
                            : 'bg-[#FCFAF7] border-[#E5DCD5] text-[#756B64] hover:border-[#C85A3F]/50'
                        }`}
                      >
                        <span>{addon.name || addon.label}</span>
                        <span className="font-extrabold text-[#C85A3F]">
                          +{formatPrice(addon.price || 0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special Instructions */}
            <div className="space-y-1.5 border-t border-[#F3E8DF] pt-3">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#756B64] block">
                Cooking instructions
              </label>
              <textarea
                placeholder="E.g. Less spicy, no onions, extra crispy..."
                value={specialItemNotes}
                onChange={(e) => setSpecialItemNotes(e.target.value)}
                rows={2}
                className="w-full bg-[#FCFAF7] border border-[#E5DCD5] focus:border-[#C85A3F] rounded-xl p-2.5 text-xs text-[#202124] placeholder-[#756B64] outline-none resize-none"
              />
            </div>

            {/* Quantity Stepper & Submit */}
            <div className="flex items-center gap-3 pt-2 border-t border-[#F3E8DF]">
              <div className="flex items-center gap-2 bg-[#F3E8DF] p-1.5 rounded-xl shrink-0">
                <button
                  onClick={() => setItemQuantity(prev => Math.max(1, prev - 1))}
                  className="w-7 h-7 bg-white text-[#202124] font-bold rounded-lg flex items-center justify-center text-xs cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-extrabold text-[#202124] w-4 text-center">{itemQuantity}</span>
                <button
                  onClick={() => setItemQuantity(prev => prev + 1)}
                  className="w-7 h-7 bg-white text-[#202124] font-bold rounded-lg flex items-center justify-center text-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={handleCustomizedAdd}
                className="flex-1 py-3 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#C85A3F]/20 cursor-pointer transition-all"
              >
                Add to Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Order Placed Confirmation Modal */}
      {isOrderSuccess && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#E5DCD5] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl relative">
            <div className="w-16 h-16 bg-[#2E8B57]/10 border border-[#2E8B57]/30 rounded-2xl flex items-center justify-center mx-auto text-[#2E8B57]">
              <CheckCircle2 className="w-9 h-9 animate-bounce" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-lg font-display font-extrabold text-[#202124]">
                Order Sent to Kitchen!
              </h3>
              <p className="text-xs text-[#756B64]">
                The kitchen staff has received your order and is preparing it.
              </p>
            </div>

            <div className="bg-[#FCFAF7] border border-[#E5DCD5] p-3.5 rounded-2xl text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-[#756B64]">Order ID:</span>
                <span className="font-mono font-bold text-[#202124]">#{placedOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#756B64]">Est. Preparation:</span>
                <span className="font-bold text-[#C85A3F]">{placedOrderPrepTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#756B64]">Status:</span>
                <span className="font-bold text-[#2E8B57]">Received</span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setIsOrderSuccess(false);
                  navigate(`/customer/restaurant/${tenantId}/order/${placedOrderId}`);
                }}
                className="w-full py-3 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold text-xs rounded-xl shadow-md shadow-[#C85A3F]/20 transition-all cursor-pointer"
              >
                Track Live Order →
              </button>
              <button
                onClick={() => setIsOrderSuccess(false)}
                className="w-full py-2.5 bg-[#FCFAF7] hover:bg-[#F3E8DF] border border-[#E5DCD5] text-[#202124] font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Continue Browsing Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
