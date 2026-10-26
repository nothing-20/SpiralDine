import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, ShoppingBag, Clock, ChefHat, CheckCircle2, ArrowRight } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { useCurrency } from '../../../../context/CurrencyContext';
import MobileFilterTabs, { FilterTabOption } from '../components/MobileFilterTabs';
import MobileStatusBadge from '../components/MobileStatusBadge';
import MobileLoadingSkeleton from '../components/MobileLoadingSkeleton';
import MobileEmptyState from '../components/MobileEmptyState';

export const MobileOrdersList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency, formatPrice } = useCurrency();
  const tenantId = user?.tenantId;

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const ordersCol = collection(db, 'restaurants', tenantId, 'orders');
    const q = query(ordersCol, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setOrders(list);
      setLoading(false);
    }, (err) => {
      console.warn('[MobileOrdersList] Real-time orders listener error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tenantId]);

  // Status Counts for filter tabs
  const tabCounts = useMemo(() => {
    const counts = { all: orders.length, new: 0, preparing: 0, ready: 0, completed: 0, cancelled: 0 };
    orders.forEach((o) => {
      const s = String(o.status || '').toUpperCase();
      if (s === 'PENDING' || s === 'NEW') counts.new++;
      else if (s === 'PREPARING') counts.preparing++;
      else if (s === 'READY') counts.ready++;
      else if (s === 'COMPLETED' || s === 'SERVED') counts.completed++;
      else if (s === 'CANCELLED' || s === 'REJECTED') counts.cancelled++;
    });
    return counts;
  }, [orders]);

  const tabs: FilterTabOption[] = [
    { id: 'all', label: 'All', count: tabCounts.all },
    { id: 'new', label: 'New', count: tabCounts.new },
    { id: 'preparing', label: 'Preparing', count: tabCounts.preparing },
    { id: 'ready', label: 'Ready', count: tabCounts.ready },
    { id: 'completed', label: 'Completed', count: tabCounts.completed },
    { id: 'cancelled', label: 'Cancelled', count: tabCounts.cancelled },
  ];

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Tab filter
      const s = String(order.status || '').toUpperCase();
      if (activeTab === 'new' && s !== 'PENDING' && s !== 'NEW') return false;
      if (activeTab === 'preparing' && s !== 'PREPARING') return false;
      if (activeTab === 'ready' && s !== 'READY') return false;
      if (activeTab === 'completed' && s !== 'COMPLETED' && s !== 'SERVED') return false;
      if (activeTab === 'cancelled' && s !== 'CANCELLED' && s !== 'REJECTED') return false;

      // 2. Search query filter (order number, table number, customer name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const num = String(order.orderNumber || order.id || '').toLowerCase();
        const table = String(order.tableNumber || '').toLowerCase();
        const customer = String(order.customerName || order.dinerName || '').toLowerCase();
        return num.includes(q) || table.includes(q) || customer.includes(q);
      }

      return true;
    });
  }, [orders, activeTab, searchQuery]);

  // Valid state transitions
  const handleAdvanceStatus = async (order: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tenantId || !order.id) return;

    let nextStatus = '';
    const current = String(order.status || '').toUpperCase();
    if (current === 'PENDING' || current === 'NEW') nextStatus = 'PREPARING';
    else if (current === 'PREPARING') nextStatus = 'READY';
    else if (current === 'READY') nextStatus = 'COMPLETED';

    if (!nextStatus) return;

    setUpdatingId(order.id);
    try {
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', order.id);
      await updateDoc(orderRef, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[MobileOrdersList] Update status error:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const getTimeElapsed = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ago`;
    } catch {
      return 'Just now';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F7F7]">
      {/* Top Header with Search Bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 pt-3 pb-2 select-none">
        <div className="flex items-center justify-between mb-2.5">
          <h1 className="font-extrabold text-lg text-[#202124]">Orders</h1>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FFF4EE] text-[#FF7518]">
            {filteredOrders.length} {filteredOrders.length === 1 ? 'Order' : 'Orders'}
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#9E9E9E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order #, table #, or customer..."
            className="w-full h-10 pl-9 pr-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none transition-all placeholder:text-[#9E9E9E]"
          />
        </div>

        {/* Filter Tabs */}
        <MobileFilterTabs
          tabs={tabs}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          className="mt-1"
        />
      </div>

      {/* Orders List Content */}
      <div className="p-4 space-y-3">
        {loading ? (
          <MobileLoadingSkeleton count={4} />
        ) : filteredOrders.length === 0 ? (
          <MobileEmptyState
            icon={ShoppingBag}
            title={searchQuery ? 'No Matching Orders' : 'No Orders In This Category'}
            description={
              searchQuery
                ? 'Try a different search term or order number.'
                : 'Orders placed by diners or staff will appear here.'
            }
            actionLabel={searchQuery ? 'Clear Search' : undefined}
            onAction={searchQuery ? () => setSearchQuery('') : undefined}
          />
        ) : (
          filteredOrders.map((order) => {
            const orderNum = order.orderNumber || (order.id ? `#${order.id.slice(-5).toUpperCase()}` : '#ORD');
            const tableText = order.tableNumber ? `Table ${order.tableNumber}` : (order.diningOption || 'Dine-In');
            const total = Number(order.total || order.totalAmount || 0);
            const itemsCount = Array.isArray(order.items) ? order.items.reduce((s: number, it: any) => s + (it.count || it.quantity || 1), 0) : 0;
            const statusUpper = String(order.status || '').toUpperCase();

            return (
              <div
                key={order.id}
                onClick={() => navigate(`/owner/orders/${order.id}`)}
                className="bg-white rounded-2xl border border-[#EBEBEB] p-4 active:scale-[0.99] transition-transform cursor-pointer shadow-sm hover:border-[#FF7518]/30 space-y-3"
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[#202124]">{orderNum}</span>
                    <span className="text-xs font-semibold text-[#707070]">• {tableText}</span>
                  </div>
                  <MobileStatusBadge status={order.status || 'PENDING'} size="sm" />
                </div>

                {/* Items summary */}
                <div className="text-xs text-[#707070] leading-snug">
                  {order.items && order.items.length > 0 ? (
                    <span className="line-clamp-1">
                      {order.items.map((it: any) => `${it.count || it.quantity || 1}x ${it.name}`).join(', ')}
                    </span>
                  ) : (
                    <span>{itemsCount} {itemsCount === 1 ? 'item' : 'items'}</span>
                  )}
                </div>

                {/* Footer and Actions */}
                <div className="flex items-center justify-between pt-2.5 border-t border-[#F5F5F5]">
                  <div>
                    <div className="text-[10px] text-[#9E9E9E]">{getTimeElapsed(order.createdAt)}</div>
                    <div className="text-sm font-black text-[#202124]">
                      {formatPrice(total)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(statusUpper === 'PENDING' || statusUpper === 'NEW') && (
                      <button
                        onClick={(e) => handleAdvanceStatus(order, e)}
                        disabled={updatingId === order.id}
                        className="px-3.5 py-1.5 bg-[#FF7518] hover:bg-[#E05D07] text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-[#FF7518]/25 flex items-center gap-1.5"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Start Cooking</span>
                      </button>
                    )}

                    {statusUpper === 'PREPARING' && (
                      <button
                        onClick={(e) => handleAdvanceStatus(order, e)}
                        disabled={updatingId === order.id}
                        className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-blue-500/25 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Ready</span>
                      </button>
                    )}

                    {statusUpper === 'READY' && (
                      <button
                        onClick={(e) => handleAdvanceStatus(order, e)}
                        disabled={updatingId === order.id}
                        className="px-3.5 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-green-500/25 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Complete</span>
                      </button>
                    )}

                    <div className="p-1 text-[#9E9E9E]">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MobileOrdersList;
