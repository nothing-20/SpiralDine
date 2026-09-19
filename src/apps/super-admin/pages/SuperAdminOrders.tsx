import React, { useEffect, useState } from 'react';
import { collectionGroup, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { Receipt, Search, Calendar, DollarSign, Building2, Tag } from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import { formatPrice } from '../../../utils/format';

interface IPlatformOrder {
  id: string;
  orderNumber?: string | number;
  tenantId?: string;
  tableId?: string | number;
  tableName?: string;
  status?: string;
  paymentStatus?: string;
  total?: number;
  createdAt?: string;
  items?: any[];
}

export const SuperAdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<IPlatformOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    // Query platform-wide orders via collectionGroup
    try {
      const q = query(
        collectionGroup(db, 'orders'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      const unsub = onSnapshot(q, (snap) => {
        const list: IPlatformOrder[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setOrders(list);
        setIsLoading(false);
      }, (err) => {
        console.warn('[SuperAdminOrders] collectionGroup ordered query fallback:', err);
        // Fallback without orderBy in case composite index is building
        const fallbackQ = query(collectionGroup(db, 'orders'), limit(100));
        onSnapshot(fallbackQ, (fallbackSnap) => {
          const list: IPlatformOrder[] = [];
          fallbackSnap.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          setOrders(list);
          setIsLoading(false);
        }, (fallbackErr) => {
          console.error('[SuperAdminOrders] Fallback listener error:', fallbackErr);
          setIsLoading(false);
        });
      });

      return () => unsub();
    } catch (e) {
      console.error('[SuperAdminOrders] Query setup error:', e);
      setIsLoading(false);
    }
  }, []);

  const filtered = orders.filter(o => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (
      (o.id || '').toLowerCase().includes(q) ||
      (o.tenantId || '').toLowerCase().includes(q) ||
      String(o.orderNumber || '').toLowerCase().includes(q) ||
      String(o.tableId || '').toLowerCase().includes(q)
    );

    const matchesStatus = statusFilter === 'ALL' || (o.status || '').toUpperCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Platform Orders</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real orders logged across tenant workspaces ({orders.length} loaded)
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PREPARING">Preparing</option>
            <option value="READY">Ready</option>
            <option value="SERVED">Served</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID or tenant..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <LoadingSpinner label="Loading orders from Firestore..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-12 text-center">
          <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No Orders Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'ALL' 
              ? 'No orders match your filter criteria.' 
              : 'No orders recorded yet across the platform.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Order</th>
                  <th className="px-5 py-3.5">Restaurant Tenant</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Payment</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-2.5">
                        <Receipt className="w-4 h-4 text-primary shrink-0" />
                        <div>
                          <div className="font-semibold text-white">
                            #{item.orderNumber || item.id.slice(0, 8)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Table: {item.tableName || item.tableId || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-1.5 font-mono text-slate-300">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>{item.tenantId || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.status === 'COMPLETED'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                          : item.status === 'CANCELLED'
                          ? 'bg-red-950/60 text-red-400 border border-red-800/60'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                      }`}>
                        {item.status || 'NEW'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        item.paymentStatus === 'paid'
                          ? 'bg-emerald-950/50 text-emerald-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.paymentStatus || 'pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-white">
                      {formatPrice(item.total || 0)}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-400">
                      <div className="flex items-center justify-end space-x-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>
                          {item.createdAt 
                            ? new Date(item.createdAt).toLocaleString() 
                            : '—'}
                        </span>
                      </div>
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

export default SuperAdminOrders;
