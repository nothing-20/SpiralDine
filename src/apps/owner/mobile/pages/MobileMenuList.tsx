import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  UtensilsCrossed, 
  FolderTree, 
  Edit3, 
  SlidersHorizontal,
  Flame,
  TrendingUp,
  Sparkles,
  ShoppingBag,
  Layers,
  BarChart3,
  Check,
  X
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { useCurrency } from '../../../../context/CurrencyContext';
import MobileFilterTabs, { FilterTabOption } from '../components/MobileFilterTabs';
import MobileLoadingSkeleton from '../components/MobileLoadingSkeleton';
import MobileEmptyState from '../components/MobileEmptyState';
import { MenuCombosTab } from '../../pages/menu/MenuCombosTab';
import { MenuAnalyticsTab } from '../../pages/menu/MenuAnalyticsTab';
import toast from 'react-hot-toast';

export const MobileMenuList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { formatCurrency, currencySymbol } = useCurrency();
  const tenantId = user?.tenantId;

  // Active top-level subtab: 'items' | 'availability' | 'pricing' | 'preview' | 'combos' | 'analytics'
  const activeTab = searchParams.get('tab') || 'items';

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Subscribe to menu items
    const itemsCol = collection(db, 'restaurants', tenantId, 'menu', 'default', 'items');
    const unsubItems = onSnapshot(itemsCol, (snap) => {
      const items: any[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      setMenuItems(items);
      setLoading(false);
    }, (err) => {
      console.warn('[MobileMenuList] Items listener error:', err);
      setLoading(false);
    });

    // 2. Subscribe to categories
    const catCol = collection(db, 'restaurants', tenantId, 'menu', 'default', 'categories');
    const unsubCat = onSnapshot(catCol, (snap) => {
      const cats: any[] = [];
      snap.forEach((d) => cats.push({ id: d.id, ...d.data() }));
      cats.sort((a, b) => (Number(a.order ?? a.displayOrder ?? 999)) - (Number(b.order ?? b.displayOrder ?? 999)));
      setCategories(cats);
    }, (err) => {
      console.warn('[MobileMenuList] Categories listener error:', err);
    });

    return () => {
      unsubItems();
      unsubCat();
    };
  }, [tenantId]);

  // Build filter tabs for Items catalog
  const filterTabs: FilterTabOption[] = useMemo(() => {
    const list: FilterTabOption[] = [{ id: 'all', label: 'All Items', count: menuItems.length }];
    
    const catMap = new Map<string, number>();
    menuItems.forEach((it) => {
      const cat = it.category || 'General';
      catMap.set(cat, (catMap.get(cat) || 0) + 1);
    });

    catMap.forEach((count, catName) => {
      list.push({ id: catName, label: catName, count });
    });

    return list;
  }, [menuItems]);

  // Filtered list
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (selectedCategory !== 'all' && (item.category || 'General') !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = String(item.name || '').toLowerCase();
        const desc = String(item.description || '').toLowerCase();
        return name.includes(q) || desc.includes(q);
      }
      return true;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Toggle in-stock availability for item
  const toggleAvailability = async (item: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!tenantId || !item.id) return;
    const currentStatus = item.available !== false && item.isAvailable !== false;
    setUpdatingId(item.id);

    try {
      const itemRef = doc(db, 'restaurants', tenantId, 'menu', 'default', 'items', item.id);
      await updateDoc(itemRef, {
        available: !currentStatus,
        isAvailable: !currentStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[MobileMenuList] Toggle availability error:', err);
      toast.error('Failed to update item availability');
    } finally {
      setUpdatingId(null);
    }
  };

  // Toggle category active/inactive master switch
  const toggleCategoryActive = async (cat: any) => {
    if (!tenantId || !cat.id) return;
    const current = cat.isActive !== false;
    try {
      const catRef = doc(db, 'restaurants', tenantId, 'menu', 'default', 'categories', cat.id);
      await updateDoc(catRef, {
        isActive: !current,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Category "${cat.name}" is now ${!current ? 'active' : 'inactive'}`);
    } catch (err) {
      console.error('[MobileMenuList] Toggle category active error:', err);
      toast.error('Failed to update category status');
    }
  };

  // Toggle bestseller flag
  const toggleItemBestseller = async (item: any) => {
    if (!tenantId || !item.id) return;
    const nextVal = !(item.isBestSeller ?? item.bestseller ?? false);
    try {
      const itemRef = doc(db, 'restaurants', tenantId, 'menu', 'default', 'items', item.id);
      await updateDoc(itemRef, {
        isBestSeller: nextVal,
        bestseller: nextVal,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('[MobileMenuList] Toggle bestseller error:', err);
    }
  };

  // Toggle recommended flag
  const toggleItemRecommended = async (item: any) => {
    if (!tenantId || !item.id) return;
    const nextVal = !(item.isRecommended ?? item.recommended ?? false);
    try {
      const itemRef = doc(db, 'restaurants', tenantId, 'menu', 'default', 'items', item.id);
      await updateDoc(itemRef, {
        isRecommended: nextVal,
        recommended: nextVal,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('[MobileMenuList] Toggle recommended error:', err);
    }
  };

  // Update price on blur
  const handlePriceBlur = async (item: any, rawValue: string, field: 'price' | 'discountPrice') => {
    if (!tenantId || !item.id) return;
    const val = parseFloat(rawValue);
    if (isNaN(val) && field === 'price') return;

    try {
      const itemRef = doc(db, 'restaurants', tenantId, 'menu', 'default', 'items', item.id);
      const updates: any = { updatedAt: new Date().toISOString() };
      if (field === 'price') {
        updates.price = Math.round(val * 100);
      } else {
        updates.discountPrice = isNaN(val) || val <= 0 ? null : Math.round(val * 100);
      }
      await updateDoc(itemRef, updates);
      toast.success('Price updated');
    } catch (err) {
      console.error('[MobileMenuList] Price update error:', err);
      toast.error('Failed to update price');
    }
  };

  const setTab = (t: string) => {
    setSearchParams({ tab: t });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7] pb-20">
      {/* Sticky Header with Navigation Tools */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 pt-3 pb-2 select-none shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <h1 className="font-extrabold text-lg text-[#202124]">Menu Management</h1>
            <p className="text-[11px] text-[#707070]">
              {menuItems.length} items • {categories.length} categories
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate('/owner/categories')}
              className="p-2 rounded-xl bg-[#F7F7F7] border border-[#EBEBEB] text-[#202124] hover:bg-[#EBEBEB] text-xs font-semibold flex items-center gap-1"
              title="Categories"
            >
              <FolderTree className="w-3.5 h-3.5 text-[#FF7518]" />
              <span className="hidden min-[360px]:inline">Categories</span>
            </button>

            <button
              onClick={() => navigate('/owner/menu/add')}
              className="px-3 py-1.5 rounded-xl bg-[#FF7518] hover:bg-[#E05D07] text-white text-xs font-bold shadow-sm shadow-[#FF7518]/25 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Feature Tools Sub-tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-xs">
          {[
            { id: 'items', label: 'Items' },
            { id: 'availability', label: 'Availability' },
            { id: 'pricing', label: 'Pricing' },
            { id: 'preview', label: 'Preview' },
            { id: 'combos', label: 'Combos' },
            { id: 'analytics', label: 'Analytics' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#FF7518] text-white shadow-xs'
                  : 'bg-[#F7F7F7] text-[#707070] hover:text-[#202124]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: ITEMS CATALOG */}
      {activeTab === 'items' && (
        <>
          <div className="bg-white border-b border-[#EBEBEB] px-4 py-2 space-y-2">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#9E9E9E] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search menu by name or ingredient..."
                className="w-full h-9 pl-9 pr-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all placeholder:text-[#9E9E9E]"
              />
            </div>

            {/* Filter Categories Tabs */}
            <MobileFilterTabs
              tabs={filterTabs}
              activeTab={selectedCategory}
              onSelectTab={setSelectedCategory}
            />
          </div>

          <div className="p-4 space-y-3">
            {loading ? (
              <MobileLoadingSkeleton count={4} />
            ) : filteredItems.length === 0 ? (
              <MobileEmptyState
                icon={UtensilsCrossed}
                title={searchQuery ? 'No Matching Items' : 'No Menu Items Added'}
                description={
                  searchQuery
                    ? 'Try a different keyword or category.'
                    : 'Start crafting your restaurant digital menu by adding food items.'
                }
                actionLabel="Add First Item"
                onAction={() => navigate('/owner/menu/add')}
              />
            ) : (
              filteredItems.map((item) => {
                const isAvailable = item.available !== false && item.isAvailable !== false;
                const rawPrice = Number(item.price || 0);
                const price = rawPrice >= 100 ? rawPrice / 100 : rawPrice;
                const rawDiscount = item.discountPrice != null ? Number(item.discountPrice) : 0;
                const discountPrice = rawDiscount >= 100 ? rawDiscount / 100 : rawDiscount;
                const isVeg = item.type === 'veg' || item.isVegetarian === true || item.isVeg === true;
                const isBatchMode = item.productionMode === 'Batch Production';

                return (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/owner/menu/edit/${item.id}`)}
                    className="bg-white rounded-2xl border border-[#EBEBEB] p-3.5 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform cursor-pointer shadow-sm hover:border-[#FF7518]/30"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#FAF4F0] border border-[#EBEBEB] flex items-center justify-center flex-shrink-0 relative">
                      {item.image || item.imageUrl ? (
                        <img
                          src={item.image || item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <UtensilsCrossed className="w-6 h-6 text-[#FF7518]/60" />
                      )}
                      <span
                        className={`absolute bottom-1 left-1 w-3.5 h-3.5 rounded-sm bg-white/90 border flex items-center justify-center p-0.5 ${
                          isVeg ? 'border-[#16A34A]' : 'border-[#DC2626]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-xs text-[#202124] truncate">{item.name}</h3>
                      </div>
                      <div className="text-[11px] text-[#707070] truncate mt-0.5">
                        {item.category || 'General'} {item.preparationTime || item.prepTime ? `• ${item.preparationTime || item.prepTime} min` : ''}
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-[#9E9E9E] line-clamp-1 mt-0.5">
                          {item.description}
                        </p>
                      )}

                      {/* Tag Badges with Wrap Protection */}
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {(item.isBestSeller || item.bestseller) && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FFF4EE] text-[#FF7518] border border-[#FFE0CE] whitespace-nowrap">
                            ★ BESTSELLER
                          </span>
                        )}
                        {(item.isRecommended || item.recommended) && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EFF6FF] text-[#2563EB] border border-[#DBEAFE] whitespace-nowrap">
                            RECOMMENDED
                          </span>
                        )}
                        {item.isPublished !== false && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#D1FAE5] whitespace-nowrap">
                            PUBLISHED
                          </span>
                        )}
                        {isBatchMode && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F0F9FF] text-[#0284C7] border border-[#E0F2FE] whitespace-nowrap">
                            BATCH: {item.availableServings ?? 50}/{item.defaultBatchSize ?? 50}
                          </span>
                        )}
                      </div>

                      {/* Price and Discount */}
                      <div className="flex items-baseline gap-1.5 mt-1.5">
                        <span className="text-xs font-black text-[#16A34A]">
                          {formatCurrency(discountPrice > 0 ? discountPrice : price)}
                        </span>
                        {discountPrice > 0 && (
                          <span className="text-[11px] text-[#9E9E9E] line-through font-semibold">
                            {formatCurrency(price)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => toggleAvailability(item, e)}
                        disabled={updatingId === item.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                          isAvailable
                            ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'
                            : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isAvailable ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
                        <span>{isAvailable ? 'In Stock' : 'Out of Stock'}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/owner/menu/edit/${item.id}`);
                        }}
                        className="p-1 text-[#9E9E9E] hover:text-[#202124]"
                        aria-label="Edit item"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* TAB 2: AVAILABILITY (Category master switches & Dish in-stock switches) */}
      {activeTab === 'availability' && (
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm space-y-3">
            <h2 className="text-xs font-extrabold text-[#202124] uppercase tracking-wider">
              Category Master Switches
            </h2>
            <div className="divide-y divide-[#F5F5F5]">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between py-2">
                  <span className="text-xs font-bold text-[#202124]">{cat.name}</span>
                  <input
                    type="checkbox"
                    checked={cat.isActive !== false}
                    onChange={() => toggleCategoryActive(cat)}
                    className="w-5 h-5 accent-[#16A34A] rounded cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xs font-extrabold text-[#202124] uppercase tracking-wider px-1">
              Dish In-Stock Controls
            </h2>
            {categories.map((cat) => {
              const catItems = menuItems.filter((i) => i.categoryId === cat.id || i.category === cat.name);
              if (catItems.length === 0) return null;

              return (
                <div key={cat.id} className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between border-b border-[#F5F5F5] pb-2">
                    <h3 className="font-extrabold text-xs text-[#FF7518]">{cat.name}</h3>
                    <span className="text-[10px] text-[#707070] font-bold">{catItems.length} Dishes</span>
                  </div>

                  <div className="divide-y divide-[#F5F5F5]">
                    {catItems.map((dish) => {
                      const isAvailable = dish.available !== false && dish.isAvailable !== false;
                      return (
                        <div key={dish.id} className="flex items-center justify-between py-2">
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-bold text-[#202124] truncate">{dish.name}</p>
                            <p className="text-[10px] text-[#707070]">
                              {formatCurrency(dish.price > 1000 && dish.price % 100 === 0 ? dish.price / 100 : dish.price || 0)}
                            </p>
                          </div>
                          <button
                            onClick={() => toggleAvailability(dish)}
                            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                              isAvailable
                                ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'
                                : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]'
                            }`}
                          >
                            {isAvailable ? 'In Stock' : 'Out of Stock'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: PRICING (Responsive Base Price, Discount Price, Badges) */}
      {activeTab === 'pricing' && (
        <div className="p-4 space-y-3">
          <div className="bg-[#FFF4EE] border border-[#FF7518]/20 rounded-2xl p-3 text-xs text-[#63351F]">
            Tap on any price to edit. Changes save automatically on blur.
          </div>

          <div className="space-y-3">
            {menuItems.map((item) => {
              const displayPrice = item.price > 1000 && item.price % 100 === 0 ? item.price / 100 : item.price || 0;
              const displayDiscount = item.discountPrice ? (item.discountPrice > 1000 && item.discountPrice % 100 === 0 ? item.discountPrice / 100 : item.discountPrice) : '';
              const isBest = item.isBestSeller ?? item.bestseller ?? false;
              const isRec = item.isRecommended ?? item.recommended ?? false;

              return (
                <div key={item.id} className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#202124]">{item.name}</h3>
                      <p className="text-[11px] text-[#707070]">{item.category || 'General'}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleItemBestseller(item)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                          isBest ? 'bg-[#FFF4EE] text-[#FF7518] border-[#FF7518]' : 'bg-[#F7F7F7] text-[#9E9E9E] border-[#EBEBEB]'
                        }`}
                      >
                        Bestseller
                      </button>
                      <button
                        onClick={() => toggleItemRecommended(item)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${
                          isRec ? 'bg-[#FEF3C7] text-[#D97706] border-[#FDE68A]' : 'bg-[#F7F7F7] text-[#9E9E9E] border-[#EBEBEB]'
                        }`}
                      >
                        Rec
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#707070] mb-1">Base Price ({currencySymbol})</label>
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={displayPrice}
                        onBlur={(e) => handlePriceBlur(item, e.target.value, 'price')}
                        className="w-full h-8 px-2.5 bg-[#F7F7F7] rounded-xl text-xs font-bold text-[#202124] outline-none border border-transparent focus:border-[#FF7518] focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#707070] mb-1">Discount Price ({currencySymbol})</label>
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={displayDiscount}
                        placeholder="None"
                        onBlur={(e) => handlePriceBlur(item, e.target.value, 'discountPrice')}
                        className="w-full h-8 px-2.5 bg-[#F7F7F7] rounded-xl text-xs font-bold text-[#202124] outline-none border border-transparent focus:border-[#FF7518] focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: PREVIEW (2-column Category-wise Mobile Customer Grid) */}
      {activeTab === 'preview' && (
        <div className="p-4 space-y-5">
          <div className="bg-[#FFF4EE] border border-[#FF7518]/20 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold text-[#FF7518] uppercase">Customer Preview Mode</h3>
              <p className="text-[10px] text-[#707070]">Table-side 2-column mobile experience.</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#FF7518] border border-[#FF7518]/30">
              Live Preview
            </span>
          </div>

          {categories.filter((c) => c.isActive !== false).map((cat) => {
            const catItems = menuItems.filter((i) => (i.categoryId === cat.id || i.category === cat.name) && (i.available !== false && i.isAvailable !== false));
            if (catItems.length === 0) return null;

            return (
              <div key={cat.id} className="space-y-3">
                <div className="border-b border-[#EBEBEB] pb-1.5">
                  <h3 className="font-extrabold text-sm text-[#202124]">{cat.name}</h3>
                  {cat.description && <p className="text-[11px] text-[#707070]">{cat.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {catItems.map((item) => {
                    const price = item.price > 1000 && item.price % 100 === 0 ? item.price / 100 : item.price || 0;
                    const discount = item.discountPrice ? (item.discountPrice > 1000 && item.discountPrice % 100 === 0 ? item.discountPrice / 100 : item.discountPrice) : null;
                    const isVeg = item.type === 'veg' || item.isVegetarian === true || item.isVeg === true;

                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-2xl border border-[#EBEBEB] overflow-hidden shadow-xs flex flex-col justify-between"
                      >
                        <div className="relative h-28 w-full bg-[#FAF4F0]">
                          {item.image || item.imageUrl ? (
                            <img
                              src={item.image || item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#FF7518]/50">
                              <UtensilsCrossed className="w-8 h-8" />
                            </div>
                          )}
                          <span
                            className={`absolute top-2 left-2 w-3.5 h-3.5 rounded-sm bg-white/95 border flex items-center justify-center p-0.5 shadow-xs ${
                              isVeg ? 'border-[#16A34A]' : 'border-[#DC2626]'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
                          </span>
                        </div>

                        <div className="p-2.5 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-bold text-xs text-[#202124] line-clamp-1">{item.name}</h4>
                            <p className="text-[10px] text-[#707070] line-clamp-2 mt-0.5">{item.description}</p>
                          </div>

                          <div className="mt-2 pt-2 border-t border-[#F5F5F5] flex items-center justify-between">
                            <div>
                              <span className="font-extrabold text-xs text-[#FF7518]">{formatCurrency(price)}</span>
                              {discount && (
                                <span className="block text-[9px] text-[#9E9E9E] line-through">{formatCurrency(discount)}</span>
                              )}
                            </div>
                            <button
                              onClick={() => toast.success(`Simulated added ${item.name}`)}
                              className="px-2 py-1 bg-[#FF7518] text-white text-[10px] font-bold rounded-lg flex items-center gap-0.5"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 5: COMBOS & BUNDLES */}
      {activeTab === 'combos' && user?.tenantId && (
        <div className="p-4">
          <MenuCombosTab tenantId={user.tenantId} menuItems={menuItems} />
        </div>
      )}

      {/* TAB 6: MENU ANALYTICS */}
      {activeTab === 'analytics' && user?.tenantId && (
        <div className="p-4">
          <MenuAnalyticsTab tenantId={user.tenantId} menuItems={menuItems} categories={categories} />
        </div>
      )}
    </div>
  );
};

export default MobileMenuList;
