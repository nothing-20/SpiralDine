import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Building2, Search, ExternalLink, Calendar, MapPin } from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

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

  const filtered = restaurants.filter(r => {
    const q = searchTerm.toLowerCase();
    return (
      (r.name || '').toLowerCase().includes(q) ||
      (r.id || '').toLowerCase().includes(q) ||
      (r.city || '').toLowerCase().includes(q) ||
      (r.ownerEmail || '').toLowerCase().includes(q)
    );
  });

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
          ))}
        </div>
      )}
    </div>
  );
};

export default SuperAdminRestaurants;
