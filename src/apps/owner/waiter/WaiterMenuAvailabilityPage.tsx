import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { IMenuItem, IMenuCategory } from '../../../types';
import { formatPrice } from '../../../utils/format';
import { getMenuItemPath, getMenuCategoryPath } from '../../../firebase/collections';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import { 
  UtensilsCrossed, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChefHat, 
  Search, 
  AlertCircle 
} from 'lucide-react';

export const WaiterMenuAvailabilityPage: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;

  const [menuItems, setMenuItems] = useState<IMenuItem[]>([]);
  const [categories, setCategories] = useState<IMenuCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'out_of_stock'>('all');

  useEffect(() => {
    if (!tenantId) return;
    setIsLoading(true);

    // Stream live canonical menu items
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
        console.error('[WaiterMenuAvailability] Items read error:', err);
        setIsLoading(false);
      }
    );

    // Stream canonical categories
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
      () => {}
    );

    return () => {
      unsubItems();
      unsubCats();
    };
  }, [tenantId]);

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const matchesId = item.categoryId === selectedCategory;
        const matchesName = item.category === selectedCategory;
        if (!matchesId && !matchesName) return false;
      }

      // Availability filter
      const isItemAvailable = item.isAvailable !== false && item.available !== false;
      if (availabilityFilter === 'available' && !isItemAvailable) return false;
      if (availabilityFilter === 'out_of_stock' && isItemAvailable) return false;

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
  }, [menuItems, selectedCategory, availabilityFilter, searchQuery]);

  const totalCount = menuItems.length;
  const availableCount = menuItems.filter((i) => i.isAvailable !== false && i.available !== false).length;
  const outOfStockCount = totalCount - availableCount;

  return (
    <div className="space-y-6 text-left select-none pb-24 font-sans max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#E3DED5] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-4 h-4 text-[#C85A3F]" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#6F746F]">
              WAITER SERVICE · LIVE AVAILABILITY LOOKUP
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#18201D] tracking-tight mt-1">
            Menu Availability
          </h1>
          <p className="text-xs text-[#6F746F] mt-1 font-normal max-w-2xl">
            Live operational dish availability streamed directly from the Kitchen and Master Menu. Use this to inform diners about sold-out dishes before taking orders.
          </p>
        </div>

        {/* Status Counts */}
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-center shrink-0">
            <span className="block text-[10px] font-bold uppercase text-emerald-700">Available</span>
            <span className="text-base font-extrabold text-emerald-700">{availableCount}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-center shrink-0">
            <span className="block text-[10px] font-bold uppercase text-rose-700">Sold Out</span>
            <span className="text-base font-extrabold text-rose-700">{outOfStockCount}</span>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="p-4 border border-[#E3DED5] bg-white rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <SearchBar 
              placeholder="Search menu by dish name, category, or station..." 
              value={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </div>

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

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-[#F3E8DF]">
          <button
            type="button"
            onClick={() => setAvailabilityFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              availabilityFilter === 'all'
                ? 'bg-[#18201D] text-white shadow-xs'
                : 'bg-[#FCFAF7] text-[#6F746F] hover:bg-[#F3E8DF] border border-[#E3DED5]'
            }`}
          >
            All Dishes ({totalCount})
          </button>

          <button
            type="button"
            onClick={() => setAvailabilityFilter('available')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              availabilityFilter === 'available'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Available Now ({availableCount})
          </button>

          <button
            type="button"
            onClick={() => setAvailabilityFilter('out_of_stock')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              availabilityFilter === 'out_of_stock'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50/60 text-rose-800 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Sold Out ({outOfStockCount})
          </button>
        </div>
      </div>

      {/* Dishes Grid */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-white border border-[#E3DED5] rounded-2xl">
          <LoadingSpinner label="Loading menu items..." />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-center border border-dashed border-[#E3DED5] rounded-2xl bg-white p-8">
          <AlertCircle className="w-10 h-10 text-[#6F746F]/40 mb-2" />
          <h3 className="text-sm font-bold text-[#18201D]">No dishes match your query</h3>
          <p className="text-xs text-[#6F746F] mt-1 max-w-sm">
            Try adjusting your search query or selecting a different category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => {
            const isAvailable = item.isAvailable !== false && item.available !== false;
            const isVeg = item.isVeg ?? item.veg ?? item.vegetarian;
            const prepTime = item.preparationTime || item.prepTime;

            return (
              <div
                key={item.id}
                className={`p-4 border rounded-2xl bg-white shadow-xs flex flex-col justify-between transition-all ${
                  !isAvailable ? 'border-rose-200 bg-rose-50/30 opacity-75' : 'border-[#E3DED5]'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
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
                        <h3 className="font-bold text-sm text-[#18201D] truncate">
                          {item.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-[#6F746F] flex-wrap">
                        <span className="font-bold font-mono text-[#18201D]">
                          {formatPrice(item.discountPrice || item.price)}
                        </span>
                        <span>·</span>
                        <span className="text-[10px] font-semibold text-[#6F746F]">
                          {item.category || 'Other'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-[11px] text-[#6F746F] line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[#6F746F]">
                    {prepTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#6F746F]" />
                        <span>{prepTime} mins</span>
                      </span>
                    )}
                    {item.station && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-bold">
                        {item.station}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status indicator (read-only for Waiter) */}
                <div className="mt-4 pt-3 border-t border-[#F3E8DF] flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-[#6F746F]">
                    Status
                  </span>
                  {isAvailable ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Available
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide bg-rose-100 text-rose-800 border border-rose-300">
                      <XCircle className="w-3 h-3 text-rose-600" />
                      Sold Out
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WaiterMenuAvailabilityPage;
