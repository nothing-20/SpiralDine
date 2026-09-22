import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { 
  Building2, 
  Search, 
  ExternalLink, 
  Calendar, 
  MapPin, 
  UtensilsCrossed, 
  X, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  ChefHat 
} from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import { getMenuItemPath, getMenuCategoryPath } from '../../../firebase/collections';
import { formatPrice } from '../../../utils/format';

interface IRestaurantTenant {
  id: string;
  name?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerUid?: string;
  status?: string;
  city?: string;
  address?: string;
  createdAt?: string;
  phone?: string;
}

export const SuperAdminRestaurants: React.FC = () => {
  const [restaurants, setRestaurants] = useState<IRestaurantTenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Diagnostic Menu Visibility Modal State
  const [viewMenuTenant, setViewMenuTenant] = useState<IRestaurantTenant | null>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isMenuLoading, setIsMenuLoading] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tenants'), (snap) => {
      const list: IRestaurantTenant[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRestaurants(list);
      setIsLoading(false);
    }, (err) => {
      console.error('[SuperAdminRestaurants] Listener error:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  // Fetch canonical menu for selected tenant
  const handleOpenMenuModal = (tenant: IRestaurantTenant) => {
    setViewMenuTenant(tenant);
    setIsMenuLoading(true);
    setMenuSearch('');

    const itemsRef = collection(db, getMenuItemPath(tenant.id));
    const catsRef = collection(db, getMenuCategoryPath(tenant.id));

    Promise.all([
      getDocs(query(itemsRef)),
      getDocs(query(catsRef))
    ]).then(([itemsSnap, catsSnap]) => {
      const itemsList: any[] = [];
      itemsSnap.forEach((d) => itemsList.push({ id: d.id, ...d.data() }));

      const catsList: any[] = [];
      catsSnap.forEach((d) => catsList.push({ id: d.id, ...d.data() }));

      setMenuItems(itemsList);
      setCategories(catsList.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)));
      setIsMenuLoading(false);
    }).catch((err) => {
      console.error('[SuperAdminRestaurants] Failed to fetch menu items:', err);
      setIsMenuLoading(false);
    });
  };

  const filtered = restaurants.filter(r => {
    const q = searchTerm.toLowerCase();
    return (
      (r.name || '').toLowerCase().includes(q) ||
      (r.id || '').toLowerCase().includes(q) ||
      (r.city || '').toLowerCase().includes(q) ||
      (r.ownerEmail || '').toLowerCase().includes(q)
    );
  });

  const filteredMenuItems = menuItems.filter(item => {
    if (!menuSearch.trim()) return true;
    const q = menuSearch.toLowerCase().trim();
    return (
      (item.name || '').toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q) ||
      (item.id || '').toLowerCase().includes(q)
    );
  });

  const publishedCount = menuItems.filter(i => i.isPublished !== false && i.status !== 'unpublished').length;
  const availableCount = menuItems.filter(i => i.isAvailable !== false && i.available !== false).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Restaurants</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real registered restaurant tenants across the platform ({restaurants.length} total)
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search restaurants..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <LoadingSpinner label="Loading restaurants from Firestore..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-12 text-center">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No Restaurants Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm ? 'No restaurants matched your search criteria.' : 'No restaurant workspaces are currently registered in the Firestore database.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-white truncate font-display">
                      {item.name || 'Unnamed Restaurant'}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                      ID: {item.id}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    item.status === 'active' 
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' 
                      : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                  }`}>
                    {item.status || 'Active'}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs text-slate-300">
                  {item.city && (
                    <div className="flex items-center space-x-2 text-slate-400">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      <span className="truncate">{item.city} {item.address ? `· ${item.address}` : ''}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800/50">
                    <span className="text-[11px] text-slate-500 block">Owner Information</span>
                    <p className="text-xs font-medium text-slate-300 truncate mt-0.5">
                      {item.ownerName || 'Not Assigned'}
                    </p>
                    {item.ownerEmail && (
                      <p className="text-[11px] text-slate-400 truncate">
                        {item.ownerEmail}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {item.createdAt 
                      ? new Date(item.createdAt).toLocaleDateString() 
                      : 'Date not available'}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => handleOpenMenuModal(item)}
                    className="flex items-center space-x-1 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <UtensilsCrossed className="w-3 h-3" />
                    <span>View Menu</span>
                  </button>
                  <a
                    href={`/r/${item.id}/table/1`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center space-x-1 text-primary hover:text-primary/80 transition-colors"
                  >
                    <span>Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Super Admin Menu Diagnostics Modal */}
      {viewMenuTenant && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0A0F17] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                    Platform Menu Visibility
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    ID: {viewMenuTenant.id}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {viewMenuTenant.name || 'Restaurant'} — Canonical Menu
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewMenuTenant(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diagnostic Counters & Search */}
            <div className="p-6 pb-3 border-b border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Total Dishes</span>
                  <span className="text-sm font-bold text-white">{menuItems.length}</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Categories</span>
                  <span className="text-sm font-bold text-white">{categories.length}</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-800/40 text-center">
                  <span className="text-[10px] text-emerald-400 uppercase block">Published</span>
                  <span className="text-sm font-bold text-emerald-400">{publishedCount}</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-blue-950/40 border border-blue-800/40 text-center">
                  <span className="text-[10px] text-blue-400 uppercase block">Available</span>
                  <span className="text-sm font-bold text-blue-400">{availableCount}</span>
                </div>
              </div>

              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Filter dishes..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Modal Body: Items List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {isMenuLoading ? (
                <div className="py-16 flex items-center justify-center">
                  <LoadingSpinner label="Fetching canonical menu from Firestore..." />
                </div>
              ) : filteredMenuItems.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  {menuSearch ? 'No dishes matched your filter.' : 'No menu items found in canonical Firestore collection.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMenuItems.map((item) => {
                    const isAvailable = item.isAvailable !== false && item.available !== false;
                    const isPublished = item.isPublished !== false && item.status !== 'unpublished';

                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 shrink-0 overflow-hidden">
                            {(item.imageUrl || item.image) ? (
                              <img src={item.imageUrl || item.image} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <ChefHat className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-white truncate">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="font-mono text-slate-300">
                                {formatPrice(item.price)}
                              </span>
                              <span>·</span>
                              <span>{item.category || 'Other'}</span>
                              <span>·</span>
                              <span className="font-mono text-slate-500 truncate max-w-[120px]">
                                {item.id}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isPublished ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                              Published
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              Unpublished
                            </span>
                          )}

                          {isAvailable ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950/60 text-blue-400 border border-blue-800/50">
                              Available
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-400 border border-rose-800/50">
                              Out of Stock
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/60 text-[11px] text-slate-400">
              <span>Read-only diagnostics view · Zero mock data · Sourced from Firestore</span>
              <button
                type="button"
                onClick={() => setViewMenuTenant(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminRestaurants;

