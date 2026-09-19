import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, limit, query } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Contact2, Search, Mail, Phone, Calendar } from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

interface ICustomer {
  id: string;
  fullName?: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  phone?: string;
  status?: string;
  createdAt?: string;
}

export const SuperAdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'customers'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const list: ICustomer[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setCustomers(list);
      setIsLoading(false);
    }, (err) => {
      console.error('[SuperAdminCustomers] Listener error:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = customers.filter(c => {
    const q = searchTerm.toLowerCase();
    return (
      (c.fullName || c.displayName || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phoneNumber || c.phone || '').toLowerCase().includes(q) ||
      (c.id || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Registered Customers</h1>
          <p className="text-xs text-slate-400 mt-1">
            Authentic customer dining profiles recorded in the customers collection ({customers.length} total)
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <LoadingSpinner label="Loading customer profiles from Firestore..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-12 text-center">
          <Contact2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No Customers Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm ? 'No customer profiles matched your search criteria.' : 'No customer records are currently registered in the database.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Contact</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Registered</th>
                  <th className="px-5 py-3.5 text-right">Account ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-primary shrink-0 text-xs">
                          {((item.fullName || item.displayName || item.email || 'C')[0]).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-white">
                            {item.fullName || item.displayName || 'Guest Diner'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {item.id.slice(0, 16)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        {item.email && (
                          <div className="flex items-center space-x-1.5 text-slate-300">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span>{item.email}</span>
                          </div>
                        )}
                        {(item.phoneNumber || item.phone) && (
                          <div className="flex items-center space-x-1.5 text-slate-400">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>{item.phoneNumber || item.phone}</span>
                          </div>
                        )}
                        {!item.email && !item.phoneNumber && !item.phone && (
                          <span className="text-slate-500">Not provided</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                        {item.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-400">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>
                          {item.createdAt 
                            ? new Date(item.createdAt).toLocaleDateString() 
                            : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-mono text-[11px] text-slate-500">
                      {item.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminCustomers;
