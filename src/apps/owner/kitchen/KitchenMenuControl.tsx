import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  query 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { IMenuItem, IMenuCategory } from '../../../types';
import { formatPrice } from '../../../utils/format';
import { 
  getMenuItemPath, 
  getMenuCategoryPath 
} from '../../../firebase/collections';
import { menuService } from '../../../shared/services/menuService';

// UI Kit components
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

// Hot Toast notifications
import toast from 'react-hot-toast';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChefHat, 
  AlertCircle, 
  Flame, 
  Layers, 
  Filter 
} from 'lucide-react';

export const KitchenMenuControl: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  
  // Realtime menu state
  const [menuItems, setMenuItems] = useState<IMenuItem[]>([]);
  const [categories, setCategories] = useState<IMenuCategory[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'out_of_stock' | 'low_stock'>('all');
  const [togglingItemId, setTogglingItemId] = useState<string | null>(null);

  // 1. Realtime Listeners for Canonical Items, Categories, Recipes, and Inventory
  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);

    // Canonical Items listener (restaurants/{tenantId}/menu/default/items)
    const itemsColRef = collection(db, getMenuItemPath(tenantId));
    const unsubItems = onSnapshot(
      query(itemsColRef),
      (snap) => {
        const items: IMenuItem[] = [];
        snap.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as IMenuItem);
        });
        setMenuItems(items);
        setIsLoading(false);
      },
      (err) => {
        console.error('[KitchenMenuControl] Items snapshot error:', err);
        toast.error('Failed to stream live menu items.');
        setIsLoading(false);
      }
    );

    // Canonical Categories listener (restaurants/{tenantId}/menu/default/categories)
    const catColRef = collection(db, getMenuCategoryPath(tenantId));
    const unsubCats = onSnapshot(
      query(catColRef),
      (snap) => {
        const cats: IMenuCategory[] = [];
        snap.forEach((d) => {
          cats.push({ id: d.id, ...d.data() } as IMenuCategory);
        });
        setCategories(cats.sort((a, b) => a.displayOrder - b.displayOrder));
      },
      (err) => {
        console.warn('[KitchenMenuControl] Categories listener warning:', err);
      }
    );

    // Inventory listener for ingredient warnings
    const invColRef = collection(db, 'restaurants', tenantId, 'inventory');
    const unsubInv = onSnapshot(
      query(invColRef),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setInventoryItems(list);
      },
      () => {}
    );

    // Recipes mapping listener
    const recipesColRef = collection(db, 'restaurants', tenantId, 'recipes');
    const unsubRecipes = onSnapshot(
      query(recipesColRef),
      (snap) => {
        const list: any[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setRecipes(list);
      },
      () => {}
    );

    return () => {
      unsubItems();
      unsubCats();
      unsubInv();
      unsubRecipes();
    };
  }, [tenantId]);

  // Map low-stock ingredient warnings for each menu item
  const itemInventoryWarnings = useMemo(() => {
    const warnings: Record<string, string[]> = {};
    if (recipes.length === 0 || inventoryItems.length === 0) return warnings;

    menuItems.forEach((item) => {
      const recipe = recipes.find((r) => r.menuItemId === item.id || r.id === item.id);
      if (recipe && Array.isArray(recipe.ingredients)) {
        const itemWarns: string[] = [];
        recipe.ingredients.forEach((ing: any) => {
          const invItem = inventoryItems.find((inv) => inv.id === ing.ingredientId || inv.name?.toLowerCase() === ing.name?.toLowerCase());
          if (invItem) {
            const currentStock = Number(invItem.quantity ?? invItem.currentStock ?? 0);
            const minStock = Number(invItem.minStockLevel ?? invItem.reorderPoint ?? 5);
            if (currentStock <= 0) {
              itemWarns.push(`${invItem.name || 'Ingredient'} is zero stock`);
            } else if (currentStock <= minStock) {
              itemWarns.push(`${invItem.name || 'Ingredient'} low stock (${currentStock} ${invItem.unit || ''})`);
            }
          }
        });
        if (itemWarns.length > 0) {
          warnings[item.id] = itemWarns;
        }
      }
    });

    return warnings;
  }, [menuItems, recipes, inventoryItems]);

  // Operational Availability Toggle Handler
  const handleToggleAvailability = async (item: IMenuItem, setAvailable: boolean) => {
    if (!tenantId) return;
    setTogglingItemId(item.id);

    try {
      await menuService.updateItem(
        item.id,
        {
          isAvailable: setAvailable,
          available: setAvailable,
          availability: setAvailable,
          status: setAvailable ? 'active' : 'inactive',
          updatedAt: new Date().toISOString(),
          updatedBy: user?.email || 'Kitchen'
        },
        tenantId
      );

      toast.success(
        setAvailable
          ? `🟢 "${item.name}" marked Available. Diners and waiters can now order.`
          : `🔴 "${item.name}" marked Out of Stock. Customer menu and ordering disabled.`
      );
    } catch (err: any) {
      console.error('[KitchenMenuControl] Toggle error:', err);
      toast.error(`Failed to update status: ${err.message || 'Permission denied'}`);
    } finally {
      setTogglingItemId(null);
    }
  };

  // Filter and Search logic
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const matchesId = item.categoryId === selectedCategory;
        const matchesName = item.category === selectedCategory;
        if (!matchesId && !matchesName) return false;
      }

      // Operational status filter
      const isItemAvailable = item.isAvailable !== false && item.available !== false;
      const hasLowStock = Boolean(itemInventoryWarnings[item.id]?.length);

      if (statusFilter === 'available' && !isItemAvailable) return false;
      if (statusFilter === 'out_of_stock' && isItemAvailable) return false;
      if (statusFilter === 'low_stock' && !hasLowStock) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (item.name || '').toLowerCase().includes(q);
        const matchesCategory = (item.category || '').toLowerCase().includes(q);
        const matchesStation = (item.station || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCategory && !matchesStation) return false;
      }

      return true;
    });
  }, [menuItems, selectedCategory, statusFilter, searchQuery, itemInventoryWarnings]);

  // Metrics summary
  const totalCount = menuItems.length;
  const availableCount = menuItems.filter((i) => i.isAvailable !== false && i.available !== false).length;
  const outOfStockCount = totalCount - availableCount;
  const lowStockCount = Object.keys(itemInventoryWarnings).length;

  return (
    <div className="space-y-6 text-left select-none pb-24 font-sans max-w-7xl mx-auto">
      {/* Header section */}
      <div className="bg-white border border-[#E3DED5] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#6F746F]">
              KITCHEN OPERATIONS · REALTIME SYNCHRONIZATION
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#18201D] tracking-tight mt-1">
            Menu Operations & Availability
          </h1>
          <p className="text-xs text-[#6F746F] mt-1 font-normal max-w-2xl">
            Operational stock control for day-to-day kitchen readiness. Changes update canonical Firestore records instantly across Owner dashboards, Waiter apps, and Customer QR menus.
          </p>
        </div>

        {/* Quick Stat Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <div className="px-3.5 py-2 rounded-xl bg-[#FCFAF7] border border-[#E3DED5] text-center shrink-0">
            <span className="block text-[10px] font-bold uppercase text-[#6F746F]">Total Dishes</span>
            <span className="text-base font-extrabold text-[#18201D]">{totalCount}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-center shrink-0">
            <span className="block text-[10px] font-bold uppercase text-emerald-700">Available</span>
            <span className="text-base font-extrabold text-emerald-700">{availableCount}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-center shrink-0">
            <span className="block text-[10px] font-bold uppercase text-rose-700">Out of Stock</span>
            <span className="text-base font-extrabold text-rose-700">{outOfStockCount}</span>
          </div>
          {lowStockCount > 0 && (
            <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-center shrink-0">
              <span className="block text-[10px] font-bold uppercase text-amber-700">Stock Warnings</span>
              <span className="text-base font-extrabold text-amber-700">{lowStockCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Query filters and Status Tabs */}
      <div className="p-4 border border-[#E3DED5] bg-white rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <SearchBar 
              placeholder="Search dishes by name, category, or station (e.g. Grill, Curry, Biryani)..." 
              value={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>

          {/* Dynamic Categories Dropdown */}
          <div className="w-full md:w-64">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#FCFAF7] border border-[#E3DED5] rounded-xl text-xs font-semibold text-[#18201D] focus:outline-none focus:border-[#C85A3F]"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Operational Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-[#F3E8DF]">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#18201D] text-white shadow-xs'
                : 'bg-[#FCFAF7] text-[#6F746F] hover:bg-[#F3E8DF] border border-[#E3DED5]'
            }`}
          >
            All Items ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('available')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'available'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Available ({availableCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('out_of_stock')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'out_of_stock'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50/60 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Out of Stock ({outOfStockCount})
          </button>

          {lowStockCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter('low_stock')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'low_stock'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50/60 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Low Stock Warnings ({lowStockCount})
            </button>
          )}
        </div>
      </div>

      {/* Stock list cards */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-white border border-[#E3DED5] rounded-2xl">
          <LoadingSpinner label="Connecting to canonical Firestore menu stream..." />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-[#E3DED5] rounded-2xl bg-white p-8">
          <AlertTriangle className="w-10 h-10 text-[#6F746F]/40 mb-2" />
          <h3 className="text-sm font-bold text-[#18201D]">No dishes match your operational criteria</h3>
          <p className="text-xs text-[#6F746F] mt-1 max-w-sm">
            {searchQuery || selectedCategory !== 'all' || statusFilter !== 'all'
              ? 'Try resetting the search or category filters.'
              : 'No menu items have been added to this restaurant by the Owner yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isAvailable = item.isAvailable !== false && item.available !== false;
            const isVeg = item.isVeg ?? item.veg ?? item.vegetarian;
            const prepTime = item.preparationTime || item.prepTime;
            const isToggling = togglingItemId === item.id;
            const warnings = itemInventoryWarnings[item.id] || [];

            return (
              <div 
                key={item.id} 
                className={`p-5 border rounded-2xl bg-white shadow-xs transition-all duration-200 flex flex-col justify-between ${
                  !isAvailable 
                    ? 'border-rose-300 bg-rose-50/25' 
                    : warnings.length > 0 
                      ? 'border-amber-300 bg-amber-50/15' 
                      : 'border-[#E3DED5] hover:border-[#C85A3F]/30'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Dish image + info */}
                  <div className="flex items-start gap-3">
                    {/* Item Thumbnail */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#FCFAF7] border border-[#E3DED5] shrink-0 relative">
                      {(item.imageUrl || item.image) ? (
                        <img 
                          src={item.imageUrl || item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover" 
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#6F746F]/40 bg-[#F7F4EE]">
                          <ChefHat className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    {/* Dish details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isVeg !== undefined && (
                          <span
                            className={`inline-flex items-center justify-center w-3 h-3 border rounded-xs shrink-0 ${
                              isVeg ? 'border-emerald-600' : 'border-rose-600'
                            }`}
                            title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                              }`}
                            />
                          </span>
                        )}
                        <h3 className="font-serif font-bold text-base text-[#18201D] truncate">
                          {item.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-[#6F746F] flex-wrap">
                        <span className="font-bold font-mono text-[#18201D]">
                          {formatPrice(item.discountPrice || item.price)}
                        </span>
                        <span>·</span>
                        <span className="px-1.5 py-0.5 bg-[#F7F4EE] border border-[#E3DED5] rounded text-[10px] font-semibold">
                          {item.category || 'Other'}
                        </span>
                        {item.station && (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                            {item.station}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Preparation time info & Batch production servings */}
                  <div className="flex items-center justify-between text-[11px] text-[#6F746F] pt-1">
                    {prepTime ? (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#6F746F]" />
                        <span>Prep: {prepTime} mins</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#6F746F]">Standard prep</span>
                    )}

                    {item.productionMode === 'Batch Production' && (
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Batch: {item.availableServings ?? 0} left
                      </span>
                    )}
                  </div>

                  {/* Inventory Warning Banner if applicable */}
                  {warnings.length > 0 && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-0.5">
                      <div className="flex items-center gap-1 font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Inventory Alert</span>
                      </div>
                      <p className="text-[10px] text-amber-800 leading-tight">
                        {warnings.join(', ')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom Action Section: Explicit Operational Buttons */}
                <div className="mt-4 pt-3 border-t border-[#F3E8DF] flex items-center justify-between gap-2">
                  {/* Current Status Badge */}
                  <div className="flex items-center gap-1.5">
                    {isAvailable ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-300">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        Out of Stock
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div>
                    {isAvailable ? (
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleAvailability(item, false)}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        {isToggling ? 'Updating...' : 'Mark Out of Stock'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isToggling}
                        onClick={() => handleToggleAvailability(item, true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                      >
                        {isToggling ? 'Updating...' : 'Mark Available'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KitchenMenuControl;
