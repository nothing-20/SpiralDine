import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import Card from '../../../components/ui/Card/Card';
import Button from '../../../components/ui/Button/Button';
import Badge from '../../../components/ui/Badge/Badge';
import Modal from '../../../components/ui/Modal/Modal';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import { formatPrice } from '../../../utils/format';
import { 
  Star, MapPin, Clock, ArrowLeft, Heart, Check, 
  Phone, Compass, Calendar, Coffee, Utensils, Search, 
  AlertCircle, ExternalLink, ChevronRight, X, ShieldAlert, Flame
} from 'lucide-react';
import toast from 'react-hot-toast';
import TableSelectionModal, { ITableData } from '../components/TableSelectionModal';
import { 
  generateSessionId, 
  getActiveDiningSession, 
  saveActiveDiningSession, 
  syncDiningSessionToFirestore 
} from '../../../shared/utils/diningSession';
import { tableService } from '../../../shared/services/tableService';
import { useAuth } from '../../../context/AuthContext';

interface IRestaurantInfo {
  id: string;
  name: string;
  cuisine: string;
  rating: number | null;
  reviewsCount: number | null;
  priceRange: string | null;
  address: string;
  city: string;
  state: string;
  country: string;
  hours: string | null;
  coverImage: string | null;
  logoUrl: string | null;
  description: string | null;
  phone: string | null;
  googleMapsUrl: string | null;
  currency: string;
  currencySymbol: string;
  facilities: string[];
}

interface IMenuCategoryItem {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

interface IMenuItemData {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  category: string;
  price: number;
  discountPrice?: number;
  imageUrl?: string;
  image?: string;
  isAvailable: boolean;
  available: boolean;
  isVeg: boolean;
  foodType?: string;
  spiceLevel?: string;
  preparationTime?: number;
  rating?: number;
}

export const RestaurantDetails: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // State reset per tenantId to prevent any cross-tenant data leakage
  const [restaurant, setRestaurant] = useState<IRestaurantInfo | null>(null);
  const [categories, setCategories] = useState<IMenuCategoryItem[]>([]);
  const [menuItems, setMenuItems] = useState<IMenuItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'menu' | 'info'>('menu');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [nonVegOnly, setNonVegOnly] = useState(false);

  // Item details modal
  const [selectedItem, setSelectedItem] = useState<IMenuItemData | null>(null);

  const { user } = useAuth();

  // Table selection modal for Dine-In ordering
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);

  const handleOrderNow = () => {
    if (!restaurant) return;
    // 1. Direct URL table parameter (e.g. from QR scan) bypasses table modal
    const urlTable = searchParams.get('table') || searchParams.get('t');
    if (urlTable) {
      navigate(`/customer/restaurant/${restaurant.id}/menu?table=${urlTable}`);
      return;
    }
    // 2. Active session explicitly initiated from a QR scan
    const existingSession = getActiveDiningSession(restaurant.id);
    if (existingSession && existingSession.orderSource === 'qr' && (existingSession.tableNumber || existingSession.tableId)) {
      navigate(`/customer/restaurant/${restaurant.id}/menu?table=${existingSession.tableNumber || existingSession.tableId}`);
      return;
    }
    // 3. Otherwise, always prompt for table selection to prevent stale table assignments
    setIsTableModalOpen(true);
  };

  const handleSelectTable = (table: ITableData) => {
    if (!restaurant) return;
    const cleanNum = String(table.tableNumber || table.number || '').replace(/^TBL-/i, '');
    const tableId = table.tableId || table.id;

    // Release any previous browsing table if the user picked a different table
    const existingSession = getActiveDiningSession(restaurant.id);
    if (existingSession && (existingSession.tableNumber || existingSession.tableId)) {
      const prevTable = existingSession.tableNumber || existingSession.tableId;
      if (prevTable !== cleanNum && prevTable !== tableId) {
        tableService.releaseTableBrowsing(restaurant.id, prevTable, {
          customerId: user?.uid,
          customerName: user?.displayName || undefined
        }).catch(err => console.warn('Failed to release previous table browsing:', err));
      }
    }
    
    // Create new explicit dining session for this table
    const sessionId = generateSessionId();
    const session = {
      sessionId,
      restaurantId: restaurant.id,
      tenantId: restaurant.id,
      branchId: table.branchId || 'main',
      tableId: tableId,
      tableNumber: cleanNum,
      tableName: table.tableName || `Table ${cleanNum}`,
      orderSource: 'app' as const,
      isLocked: false,
      status: 'active' as const,
      startedAt: new Date().toISOString()
    };
    saveActiveDiningSession(session);
    syncDiningSessionToFirestore(session).catch(() => {});

    setIsTableModalOpen(false);
    navigate(`/customer/restaurant/${restaurant.id}/menu?table=${session.tableNumber}`);
  };

  useEffect(() => {
    let isMounted = true;
    if (!tenantId) {
      setLoadError('No restaurant specified.');
      setIsLoading(false);
      return;
    }

    const fetchAllData = async () => {
      setIsLoading(true);
      setLoadError(null);
      // Reset data immediately to guarantee zero stale data when switching restaurants
      setRestaurant(null);
      setCategories([]);
      setMenuItems([]);
      setSelectedCategory('All');
      setSearchQuery('');
      setVegOnly(false);
      setNonVegOnly(false);
      setSelectedItem(null);

      try {
        // 1. Fetch Restaurant Info from canonical tenants/{tenantId}
        const tenantRef = doc(db, 'tenants', tenantId);
        const tenantSnap = await getDoc(tenantRef);

        if (!tenantSnap.exists()) {
          if (isMounted) {
            setLoadError('Restaurant profile not found.');
            setIsLoading(false);
          }
          return;
        }

        const data = tenantSnap.data();
        const cover = data.coverImageUrl || data.coverImage || null;
        const logo = data.logoUrl || data.logo || null;
        const name = data.restaurantName || data.name || 'Restaurant';
        const street = (data.address && data.address.street) || data.street || '';
        const city = (data.address && data.address.city) || data.city || '';
        const state = (data.address && data.address.state) || data.state || '';
        const country = (data.address && data.address.country) || data.country || 'India';
        const formattedAddress = [street, city, state, country].filter(Boolean).join(', ') || 'Address not listed';

        const hours = data.businessHours 
          ? (typeof data.businessHours === 'string' ? data.businessHours : `${data.businessHours.openingTime || '09:00'} - ${data.businessHours.closingTime || '22:00'}`)
          : (data.hours || null);

        const restInfo: IRestaurantInfo = {
          id: tenantId,
          name,
          cuisine: data.cuisine || 'Dining',
          rating: typeof data.rating === 'number' && data.rating > 0 ? data.rating : null,
          reviewsCount: typeof data.reviewsCount === 'number' && data.reviewsCount > 0 ? data.reviewsCount : null,
          priceRange: data.priceRange || null,
          address: formattedAddress,
          city,
          state,
          country,
          hours,
          coverImage: cover,
          logoUrl: logo,
          description: data.description || null,
          phone: data.phone || null,
          googleMapsUrl: data.googleMapsUrl || null,
          currency: data.currency || 'INR',
          currencySymbol: data.currencySymbol || '₹',
          facilities: Array.isArray(data.facilities) ? data.facilities : []
        };

        // 2. Fetch canonical Menu Categories: restaurants/{tenantId}/menu/default/categories
        const catCol = collection(db, 'restaurants', tenantId, 'menu', 'default', 'categories');
        const catSnap = await getDocs(catCol);
        const catList: IMenuCategoryItem[] = [];
        catSnap.forEach(d => {
          const cdata = d.data();
          catList.push({
            id: d.id,
            name: cdata.name || 'Category',
            displayOrder: typeof cdata.displayOrder === 'number' ? cdata.displayOrder : 99,
            isActive: cdata.isActive !== false
          });
        });
        catList.sort((a, b) => a.displayOrder - b.displayOrder);

        // 3. Fetch canonical Menu Items: restaurants/{tenantId}/menu/default/items
        const itemCol = collection(db, 'restaurants', tenantId, 'menu', 'default', 'items');
        const itemSnap = await getDocs(itemCol);
        const itemList: IMenuItemData[] = [];
        itemSnap.forEach(d => {
          const idata = d.data();
          const isAvailable = idata.isAvailable !== false && idata.available !== false;
          const isVeg = idata.isVeg === true || idata.veg === true || idata.foodType === 'veg' || idata.vegetarian === true;
          itemList.push({
            id: d.id,
            name: idata.name || 'Untitled Item',
            description: idata.description || '',
            categoryId: idata.categoryId || '',
            category: idata.category || '',
            price: typeof idata.price === 'number' ? idata.price : 0,
            discountPrice: typeof idata.discountPrice === 'number' ? idata.discountPrice : undefined,
            imageUrl: idata.imageUrl || idata.image || '',
            image: idata.image || idata.imageUrl || '',
            isAvailable,
            available: isAvailable,
            isVeg,
            foodType: idata.foodType || (isVeg ? 'veg' : 'non-veg'),
            spiceLevel: idata.spiceLevel || '',
            preparationTime: idata.preparationTime || idata.prepTime || 15,
            rating: typeof idata.rating === 'number' ? idata.rating : undefined
          });
        });

        if (isMounted) {
          setRestaurant(restInfo);
          setCategories(catList.filter(c => c.isActive));
          setMenuItems(itemList);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('[RestaurantDetails] Firestore load error:', err);
        if (isMounted) {
          setLoadError(err.message || 'Unable to load restaurant details.');
          setIsLoading(false);
        }
      }
    };

    fetchAllData();

    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  // Derived category list combining registered categories and items
  const categoryOptions = useMemo(() => {
    const list = new Set<string>();
    categories.forEach(c => list.add(c.name));
    menuItems.forEach(i => {
      if (i.category && i.category.trim()) list.add(i.category.trim());
    });
    return ['All', ...Array.from(list)];
  }, [categories, menuItems]);

  // Filtered menu items
  const filteredMenuItems = useMemo(() => {
    let list = [...menuItems];

    // Category filter: match either category name or categoryId
    if (selectedCategory !== 'All') {
      const activeCatObj = categories.find(c => c.name.toLowerCase() === selectedCategory.toLowerCase());
      const activeCatId = activeCatObj ? activeCatObj.id : null;

      list = list.filter(item => {
        const matchesName = item.category && item.category.toLowerCase() === selectedCategory.toLowerCase();
        const matchesId = activeCatId && item.categoryId === activeCatId;
        return matchesName || matchesId;
      });
    }

    // Search query: match dish name or description
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => 
        item.name.toLowerCase().includes(q) || 
        (item.description && item.description.toLowerCase().includes(q))
      );
    }

    // Dietary filter
    if (vegOnly) {
      list = list.filter(item => item.isVeg);
    } else if (nonVegOnly) {
      list = list.filter(item => !item.isVeg);
    }

    return list;
  }, [menuItems, selectedCategory, searchQuery, vegOnly, nonVegOnly, categories]);

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <LoadingSpinner label="Loading restaurant and menu..." />
      </div>
    );
  }

  if (loadError || !restaurant) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
        <div className="w-14 h-14 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl flex items-center justify-center text-[#E85D3F]">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-extrabold text-[#242424]">Unable to Load Restaurant</h3>
          <p className="text-xs text-[#6B6B6B]">{loadError || 'The requested dining venue could not be found.'}</p>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#E85D3F] hover:bg-[#D04B2F] text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-xs"
          >
            Retry
          </button>
          <button
            onClick={() => navigate('/customer/home')}
            className="px-4 py-2 bg-[#FFF8F2] border border-[#EEE7E1] text-xs font-bold text-[#242424] rounded-xl transition-all cursor-pointer"
          >
            Back to Restaurants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto pb-16 select-none">
      
      {/* 1. Hero Cover Banner */}
      <div className="h-60 md:h-72 w-full relative rounded-3xl overflow-hidden shadow-md border border-[#EEE7E1] bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center">
        {restaurant.coverImage ? (
          <img src={restaurant.coverImage} alt={restaurant.name} className="h-full w-full object-cover" />
        ) : (
          <div className="text-center p-6 space-y-2 select-none">
            <div className="w-16 h-16 rounded-2xl bg-[#E85D3F]/20 border border-[#E85D3F]/40 flex items-center justify-center text-[#E85D3F] mx-auto mb-2">
              <Utensils className="w-8 h-8" />
            </div>
            <h1 className="text-2xl md:text-3xl font-display font-extrabold text-white tracking-wide">{restaurant.name}</h1>
            <p className="text-xs text-slate-300 font-medium">{restaurant.cuisine}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent pointer-events-none" />
        
        {/* Back Navigation Button */}
        <button 
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-white/90 hover:bg-white border border-[#EEE7E1] rounded-2xl flex items-center justify-center text-[#242424] hover:text-[#E85D3F] transition-all shadow-md z-20 cursor-pointer"
          title="Back"
        >
          <ArrowLeft className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* 2. Restaurant Basic Info Section */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 p-6 bg-white border border-[#EEE7E1] rounded-3xl relative -mt-16 mx-4 z-10 shadow-sm">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl overflow-hidden shrink-0 flex items-center justify-center text-[#E85D3F] font-display font-extrabold text-xl shadow-inner">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} className="h-full w-full object-cover" />
            ) : (
              <span>{restaurant.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-display font-extrabold text-[#242424]">{restaurant.name}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B6B] font-semibold">
              <span>{restaurant.cuisine}</span>
              {restaurant.priceRange && (
                <>
                  <span>•</span>
                  <span>{restaurant.priceRange}</span>
                </>
              )}
              {restaurant.rating !== null && (
                <>
                  <span>•</span>
                  <span className="text-[#242424] flex items-center gap-0.5 font-bold">
                    <Star className="w-3.5 h-3.5 text-[#F4B942] fill-current" /> {restaurant.rating}
                    {restaurant.reviewsCount !== null && ` (${restaurant.reviewsCount})`}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center text-xs text-[#888888] font-medium pt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#E85D3F] mr-1 shrink-0" />
              <span className="truncate max-w-md">{restaurant.address}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto pt-2 md:pt-0">
          {restaurant.googleMapsUrl && (
            <a 
              href={restaurant.googleMapsUrl}
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-[#FFF8F2] border border-[#EEE7E1] hover:border-[#E85D3F]/40 text-xs font-bold text-[#E85D3F] rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>View on Maps</span>
              <ExternalLink className="w-3 h-3 text-[#E85D3F]/70" />
            </a>
          )}
          <Button 
            onClick={() => navigate(`/customer/booking?tenantId=${restaurant.id}`)}
            className="px-4 py-2.5 bg-[#FFF8F2] border border-[#EEE7E1] hover:border-[#E85D3F]/40 text-xs font-extrabold text-[#242424] rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-[#E85D3F]" /> Book Table
          </Button>
          <Button 
            onClick={handleOrderNow}
            className="px-5 py-2.5 bg-[#E85D3F] hover:bg-[#D04B2F] text-white font-extrabold rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs shadow-xs cursor-pointer"
          >
            <Coffee className="w-3.5 h-3.5" /> Order Now
          </Button>
        </div>
      </div>

      {/* 3. Section Tabs */}
      <div className="flex space-x-2 border-b border-[#EEE7E1] px-4">
        {[
          { key: 'menu', label: `Menu (${menuItems.length})`, icon: Utensils },
          { key: 'info', label: 'Info & Facilities', icon: Compass }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === tab.key 
                ? 'border-[#E85D3F] text-[#E85D3F]' 
                : 'border-transparent text-[#6B6B6B] hover:text-[#242424]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 4. Tab Contents Panel */}
      <div className="px-4">
        
        {/* TAB 1: MENU */}
        {activeTab === 'menu' && (
          <div className="space-y-6">
            
            {/* Search and Dietary Filter Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B6B]" />
                <input 
                  type="text" 
                  placeholder="Search dishes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#EEE7E1] rounded-xl text-xs text-[#242424] placeholder:text-[#888888] focus:outline-none focus:border-[#E85D3F]/50 transition-all shadow-xs"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#242424]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Dietary Toggles */}
              <div className="flex items-center space-x-2 w-full md:w-auto">
                <button
                  onClick={() => { setVegOnly(v => !v); setNonVegOnly(false); }}
                  className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    vegOnly 
                      ? 'bg-[#22A06B] border-[#22A06B] text-white' 
                      : 'bg-white border-[#EEE7E1] text-[#6B6B6B] hover:border-[#22A06B]/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#22A06B]" />
                  <span>Veg Only</span>
                </button>
                <button
                  onClick={() => { setNonVegOnly(v => !v); setVegOnly(false); }}
                  className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    nonVegOnly 
                      ? 'bg-[#E85D3F] border-[#E85D3F] text-white' 
                      : 'bg-white border-[#EEE7E1] text-[#6B6B6B] hover:border-[#E85D3F]/50'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#E85D3F]" />
                  <span>Non-Veg Only</span>
                </button>
              </div>
            </div>

            {/* Category Pills Bar */}
            {categoryOptions.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-none">
                {categoryOptions.map(catName => (
                  <button
                    key={catName}
                    onClick={() => setSelectedCategory(catName)}
                    className={`px-4 py-2 rounded-full border text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer shadow-xs ${
                      selectedCategory === catName 
                        ? 'bg-[#E85D3F] border-[#E85D3F] text-white' 
                        : 'bg-white border-[#EEE7E1] text-[#242424] hover:border-[#E85D3F]/40'
                    }`}
                  >
                    {catName}
                  </button>
                ))}
              </div>
            )}

            {/* Menu Items Grid */}
            {filteredMenuItems.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-[#EEE7E1] rounded-3xl bg-white p-8 space-y-3 shadow-xs">
                <div className="w-12 h-12 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl flex items-center justify-center text-[#E85D3F] mx-auto">
                  <Utensils className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-extrabold text-[#242424]">
                    {menuItems.length === 0 
                      ? "This restaurant hasn't published its menu yet." 
                      : "No dishes match your selected filter."}
                  </h4>
                  <p className="text-xs text-[#6B6B6B] max-w-sm mx-auto">
                    {menuItems.length === 0 
                      ? "Please check back soon or explore our other verified dining venues." 
                      : "Try clearing search or selecting 'All' categories to see more options."}
                  </p>
                </div>
                {(selectedCategory !== 'All' || searchQuery || vegOnly || nonVegOnly) && (
                  <button 
                    onClick={() => { setSelectedCategory('All'); setSearchQuery(''); setVegOnly(false); setNonVegOnly(false); }}
                    className="px-4 py-2 bg-[#FFF8F2] border border-[#EEE7E1] text-xs font-bold text-[#E85D3F] rounded-xl transition-all cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMenuItems.map(item => (
                  <Card 
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`bg-white border border-[#EEE7E1] hover:border-[#E85D3F]/40 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-md transition-all cursor-pointer relative ${
                      !item.isAvailable ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Item Image */}
                    <div className="h-36 w-full overflow-hidden relative bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex items-center justify-center">
                      {(item.imageUrl || item.image) ? (
                        <img 
                          src={item.imageUrl || item.image} 
                          alt={item.name} 
                          loading="lazy" 
                          className="h-full w-full object-cover group-hover:scale-103 transition-transform" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-3 select-none text-white">
                          <div className="w-10 h-10 rounded-xl bg-[#E85D3F]/20 border border-[#E85D3F]/30 flex items-center justify-center text-[#E85D3F] mb-1">
                            <Utensils className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] text-slate-300 font-bold truncate max-w-[140px]">{item.category || 'Specialty'}</span>
                        </div>
                      )}

                      {/* Dietary indicator badge */}
                      <div className="absolute top-2.5 left-2.5 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded-full border border-[#EEE7E1] text-[9px] font-extrabold flex items-center gap-1 shadow-xs">
                        <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-[#22A06B]' : 'bg-[#E85D3F]'}`} />
                        <span className={item.isVeg ? 'text-[#22A06B]' : 'text-[#E85D3F]'}>
                          {item.isVeg ? 'Veg' : 'Non-Veg'}
                        </span>
                      </div>

                      {/* Availability status badge if unavailable */}
                      {!item.isAvailable && (
                        <span className="absolute bottom-2.5 left-2.5 bg-[#242424]/90 backdrop-blur-md text-white px-2 py-0.5 rounded-lg text-[9px] font-extrabold">
                          Currently Unavailable
                        </span>
                      )}
                    </div>

                    {/* Item Content */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-1 text-left">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-sm font-extrabold text-[#242424] line-clamp-1">{item.name}</h4>
                          <span className="text-xs font-extrabold text-[#E85D3F] shrink-0">
                            {formatPrice(item.price, restaurant.currency || 'INR')}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-[#6B6B6B] line-clamp-2 font-medium leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#EEE7E1] text-xs">
                        <span className="text-[10px] text-[#888888] font-semibold">
                          {item.preparationTime ? `${item.preparationTime} mins prep` : 'Freshly prepared'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (item.isAvailable) {
                              handleOrderNow();
                            }
                          }}
                          disabled={!item.isAvailable}
                          className={`text-xs font-extrabold px-3 py-1 rounded-lg transition-all ${
                            item.isAvailable 
                              ? 'text-[#E85D3F] hover:bg-[#FFF8F2]' 
                              : 'text-[#888888] cursor-not-allowed'
                          }`}
                        >
                          {item.isAvailable ? 'Order +' : 'Out of stock'}
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

          </div>
        )}

        {/* TAB 2: INFO & FACILITIES */}
        {activeTab === 'info' && (
          <div className="space-y-6 bg-white border border-[#EEE7E1] rounded-3xl p-6 shadow-xs text-left">
            {restaurant.description && (
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase text-[#242424] tracking-wider">About the Restaurant</h4>
                <p className="text-xs text-[#6B6B6B] leading-relaxed font-medium">{restaurant.description}</p>
              </div>
            )}
            
            <hr className="border-[#EEE7E1]" />
            
            {/* Contact & Hours Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold text-[#242424]">
              {restaurant.hours && (
                <div className="flex items-center space-x-3">
                  <Clock className="w-4.5 h-4.5 text-[#E85D3F] shrink-0" />
                  <span>Operating Hours: {restaurant.hours}</span>
                </div>
              )}
              <div className="flex items-center space-x-3">
                <MapPin className="w-4.5 h-4.5 text-[#E85D3F] shrink-0" />
                <span>{restaurant.address}</span>
              </div>
              {restaurant.phone && (
                <div className="flex items-center space-x-3">
                  <Phone className="w-4.5 h-4.5 text-[#E85D3F] shrink-0" />
                  <span>Contact: {restaurant.phone}</span>
                </div>
              )}
            </div>

            {/* Facilities / Amenities */}
            {restaurant.facilities.length > 0 && (
              <>
                <hr className="border-[#EEE7E1]" />
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold uppercase text-[#242424] tracking-wider">Amenities & Features</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {restaurant.facilities.map((fac, i) => (
                      <div key={i} className="flex items-center space-x-2 text-xs text-[#242424] font-semibold bg-[#FFF8F2] border border-[#EEE7E1] p-2.5 rounded-xl">
                        <Check className="w-3.5 h-3.5 text-[#E85D3F] shrink-0" />
                        <span>{fac}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Location & Directions */}
            {restaurant.googleMapsUrl && (
              <>
                <hr className="border-[#EEE7E1]" />
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold uppercase text-[#242424] tracking-wider">Location & Navigation</h4>
                  <div className="p-4 bg-[#FFF8F2] border border-[#EEE7E1] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <MapPin className="w-6 h-6 text-[#E85D3F] shrink-0" />
                      <div>
                        <span className="text-xs font-extrabold text-[#242424] block">{restaurant.name}</span>
                        <span className="text-[11px] text-[#6B6B6B] block mt-0.5">{restaurant.address}</span>
                      </div>
                    </div>
                    <a
                      href={restaurant.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-[#E85D3F] hover:bg-[#D04B2F] text-xs font-extrabold text-white rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <span>Open in Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>

      {/* 5. Item Details Modal */}
      {selectedItem && (
        <Modal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          title={selectedItem.name}
          className="max-w-lg"
        >
          <div className="space-y-4 text-left text-xs">
            {/* Dish Image */}
            {(selectedItem.imageUrl || selectedItem.image) ? (
              <div className="w-full h-48 rounded-2xl overflow-hidden bg-slate-900 border border-[#EEE7E1]">
                <img 
                  src={selectedItem.imageUrl || selectedItem.image} 
                  alt={selectedItem.name} 
                  className="w-full h-full object-cover" 
                />
              </div>
            ) : (
              <div className="w-full h-32 rounded-2xl bg-[#FFF8F2] border border-[#EEE7E1] flex flex-col items-center justify-center text-[#E85D3F]">
                <Utensils className="w-8 h-8 mb-1" />
                <span className="text-[11px] font-bold text-[#242424]">{selectedItem.category || 'Specialty Dish'}</span>
              </div>
            )}

            {/* Dish Title & Price */}
            <div className="flex justify-between items-start gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-[#242424]">{selectedItem.name}</h3>
                <div className="flex items-center space-x-2 text-[11px] font-bold">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${selectedItem.isVeg ? 'bg-[#22A06B]/15 text-[#22A06B]' : 'bg-[#E85D3F]/15 text-[#E85D3F]'}`}>
                    {selectedItem.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                  </span>
                  {selectedItem.category && (
                    <span className="text-[#6B6B6B]">{selectedItem.category}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-base font-extrabold text-[#E85D3F]">
                  {formatPrice(selectedItem.price, restaurant.currency || 'INR')}
                </span>
              </div>
            </div>

            {/* Description */}
            {selectedItem.description && (
              <p className="text-xs text-[#6B6B6B] leading-relaxed font-medium">
                {selectedItem.description}
              </p>
            )}

            {/* Preparation Details */}
            <div className="flex items-center gap-4 py-2 border-y border-[#EEE7E1] text-[11px] text-[#6B6B6B]">
              <span className="flex items-center gap-1 font-semibold">
                <Clock className="w-3.5 h-3.5 text-[#E85D3F]" />
                {selectedItem.preparationTime ? `${selectedItem.preparationTime} mins preparation` : 'Freshly made'}
              </span>
              {selectedItem.spiceLevel && (
                <span className="flex items-center gap-1 font-semibold">
                  <Flame className="w-3.5 h-3.5 text-[#E85D3F]" />
                  Spice: {selectedItem.spiceLevel}
                </span>
              )}
            </div>

            {/* Availability / Order Action */}
            <div className="pt-2">
              {selectedItem.isAvailable ? (
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    handleOrderNow();
                  }}
                  className="w-full py-3 bg-[#E85D3F] hover:bg-[#D04B2F] text-white font-extrabold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Coffee className="w-4 h-4" />
                  <span>Order in Full Menu</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <div className="p-3 bg-slate-100 rounded-xl text-center text-xs font-bold text-slate-500">
                  This dish is currently out of stock or unavailable.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {restaurant && (
        <TableSelectionModal
          isOpen={isTableModalOpen}
          onClose={() => setIsTableModalOpen(false)}
          tenantId={restaurant.id}
          restaurantName={restaurant.name}
          branchId="main"
          onSelectTable={handleSelectTable}
        />
      )}

    </div>
  );
};

export default RestaurantDetails;
