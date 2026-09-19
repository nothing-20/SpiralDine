import React, { useEffect, useState } from 'react';
import { collectionGroup, query, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { CreditCard, Search, Calendar, Building2, CheckCircle, Clock } from 'lucide-react';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import { formatPrice } from '../../../utils/format';

interface IPaymentRecord {
  id: string;
  tenantId?: string;
  orderId?: string;
  billId?: string;
  total?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  paidAt?: string;
  createdAt?: string;
}

export const SuperAdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<IPaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    try {
      // Query bills collectionGroup for authentic payment records
      const q = query(collectionGroup(db, 'bills'), limit(100));
      const unsub = onSnapshot(q, (snap) => {
        const list: IPaymentRecord[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setPayments(list);
        setIsLoading(false);
      }, (err) => {
        console.warn('[SuperAdminPayments] bills collectionGroup listener:', err);
        // Fallback: listen to paid orders
        const qOrders = query(collectionGroup(db, 'orders'), limit(100));
        onSnapshot(qOrders, (orderSnap) => {
          const list: IPaymentRecord[] = [];
          orderSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.paymentStatus || data.total) {
              list.push({
                id: docSnap.id,
                tenantId: data.tenantId,
                orderId: docSnap.id,
                total: data.total || 0,
                paymentStatus: data.paymentStatus || 'pending',
                paymentMethod: data.paymentMethod || 'Cash',
                createdAt: data.createdAt
              });
            }
          });
          setPayments(list);
          setIsLoading(false);
        }, () => {
          setIsLoading(false);
        });
      });

      return () => unsub();
    } catch (e) {
      console.error('[SuperAdminPayments] Query error:', e);
      setIsLoading(false);
    }
  }, []);

  const filtered = payments.filter(p => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (
      (p.id || '').toLowerCase().includes(q) ||
      (p.tenantId || '').toLowerCase().includes(q) ||
      (p.orderId || '').toLowerCase().includes(q) ||
      (p.paymentMethod || '').toLowerCase().includes(q)
    );

    const matchesStatus = statusFilter === 'ALL' || (p.paymentStatus || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const totalPaidRevenue = payments
    .filter(p => (p.paymentStatus || '').toLowerCase() === 'paid')
    .reduce((sum, p) => sum + (Number(p.total) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Platform Payments</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real settlements and transaction records across all restaurant workspaces ({payments.length} loaded)
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-primary"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search payments..."
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-400">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Settled Platform Revenue</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">{formatPrice(totalPaidRevenue)}</div>
          </div>
        </div>

        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Settled Payments</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">
              {payments.filter(p => (p.paymentStatus || '').toLowerCase() === 'paid').length}
            </div>
          </div>
        </div>

        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-4 flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pending Settlement</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">
              {payments.filter(p => (p.paymentStatus || '').toLowerCase() === 'pending').length}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="min-h-[300px] flex items-center justify-center">
          <LoadingSpinner label="Loading payments from Firestore..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl p-12 text-center">
          <CreditCard className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No Payments Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'ALL'
              ? 'No payment records match your filters.'
              : 'No payment or billing records found.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#0A0F17] border border-slate-800/80 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Payment ID</th>
                  <th className="px-5 py-3.5">Tenant</th>
                  <th className="px-5 py-3.5">Method</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-white">
                      {item.billId || item.id}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>{item.tenantId || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-200 uppercase">
                        {item.paymentMethod || 'Razorpay / Cash'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        (item.paymentStatus || '').toLowerCase() === 'paid'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                          : (item.paymentStatus || '').toLowerCase() === 'failed'
                          ? 'bg-red-950/60 text-red-400 border border-red-800/60'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                      }`}>
                        {item.paymentStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-white">
                      {formatPrice(item.total || 0)}
                    </td>
                    <td className="px-5 py-4 text-right text-slate-400">
                      <div className="flex items-center justify-end space-x-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>
                          {item.paidAt || item.createdAt 
                            ? new Date(item.paidAt || item.createdAt || '').toLocaleDateString()
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

export default SuperAdminPayments;
