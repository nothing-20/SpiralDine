import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Users, Search, Mail, Building2, Calendar, Phone } from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

interface IOwnerUser {
  id: string;
  email?: string;
  displayName?: string;
  fullName?: string;
  role?: string;
  tenantId?: string;
  status?: string;
  phoneNumber?: string;
  createdAt?: string;
}

export const SuperAdminOwners: React.FC = () => {
  const [owners, setOwners] = useState<IOwnerUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Query users collection where role is owner
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['owner', 'admin'])
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: IOwnerUser[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setOwners(list);
      setIsLoading(false);
    }, (err) => {
      console.error('[SuperAdminOwners] Listener error:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = owners.filter(o => {
    const q = searchTerm.toLowerCase();
    return (
      (o.displayName || o.fullName || '').toLowerCase().includes(q) ||
      (o.email || '').toLowerCase().includes(q) ||
      (o.tenantId || '').toLowerCase().includes(q) ||
      (o.id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Restaurant Owners</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real registered owner accounts with tenant management clearance ({owners.length} total)
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search owners..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <LoadingSpinner label="Loading owners from Firestore..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No Owners Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm ? 'No owner accounts matched your search criteria.' : 'No owner records found in the users collection.'}
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
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {((item.displayName || item.fullName || item.email || 'O')[0]).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">
                        {item.displayName || item.fullName || 'Unnamed Owner'}
                      </h3>
                      <p className="text-[11px] font-mono text-slate-500 truncate">
                        UID: {item.id}
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    {item.role || 'Owner'}
                  </span>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  {item.email && (
                    <div className="flex items-center space-x-2 text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{item.email}</span>
                    </div>
                  )}

                  {item.phoneNumber && (
                    <div className="flex items-center space-x-2 text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{item.phoneNumber}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 text-slate-400 pt-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">
                      Workspace: <strong className="text-slate-200 font-mono">{item.tenantId || 'Unassigned'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {item.createdAt 
                      ? new Date(item.createdAt).toLocaleDateString() 
                      : 'Created date unavailable'}
                  </span>
                </div>
                <span className="text-emerald-400 font-medium">Verified Account</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuperAdminOwners;
