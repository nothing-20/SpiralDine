import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  query, 
  limit,
  arrayUnion 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { IOrder } from '../../../types';
import { ITimelineEvent } from '../../../shared/domain/orders/types';
import { formatPrice } from '../../../utils/format';
import toast from 'react-hot-toast';
import { 
  UtensilsCrossed, 
  Check, 
  Clock, 
  Users, 
  Search, 
  AlertCircle, 
  ChefHat, 
  Eye, 
  X, 
  Sparkles, 
  Flame, 
  CheckCircle2, 
  Table as TableIcon,
  Archive,
  History
} from 'lucide-react';

/**
 * Status Categorization:
 * Completed/Terminal statuses:
 * - Cancelled, refunded, archived, closed.
 * - Explicit COMPLETED, PAID, PAYMENT_COMPLETED.
 * - SERVED / DELIVERED / DINING_COMPLETED when payment is completed (paymentStatus === 'paid').
 * 
 * Active statuses:
 * - NEW, PLACED, ACCEPTED, CHEF_ASSIGNED, PREPARING, PAUSED (Kitchen preparation)
 * - READY, PICKED_UP (Awaiting waiter service)
 * - SERVED, DELIVERED, DINING, DINING_COMPLETED, BILL_REQUESTED (Served to table, payment still pending)
 */
export const isCompletedOrderStatus = (status?: string, paymentStatus?: string): boolean => {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  const p = (paymentStatus || '').toLowerCase().trim();

  // Cancelled or refunded orders are completed/terminal
  if (s === 'CANCELLED' || p === 'refunded' || p === 'cancelled') {
    return true;
  }

  // Archived or Closed orders
  if (s === 'ARCHIVED' || s === 'CLOSED') {
    return true;
  }

  // Explicit terminal status with paid
  if (s === 'PAID' || s === 'PAYMENT_COMPLETED') {
    return true;
  }

  // Food served / dining finished AND paid = Completed
  if (p === 'paid' && (s === 'SERVED' || s === 'DELIVERED' || s === 'DINING_COMPLETED' || s === 'COMPLETED')) {
    return true;
  }

  // Completed status fallback if not explicitly pending
  if (s === 'COMPLETED' && p !== 'pending') {
    return true;
  }

  return false;
};

export const isActiveOrderStatus = (status?: string, paymentStatus?: string): boolean => {
  return !isCompletedOrderStatus(status, paymentStatus);
};

export const WaiterLiveOrdersPage: React.FC = () => {
  const { user } = useAuth();
  
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [servingOrderId, setServingOrderId] = useState<string | null>(null);

  // Tab State: 'active' | 'completed' (default: 'active')
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Live ticking clock for Front of House service status
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTable, setFilterTable] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Realtime Orders Listener
  useEffect(() => {
    if (!user?.tenantId) return;

    const colRef = collection(db, 'restaurants', user.tenantId, 'orders');
    const qOrders = query(colRef, limit(100));

    const unsubscribe = onSnapshot(
      qOrders,
      (snapshot) => {
        const list: IOrder[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({ ...data, orderId: data.orderId || docSnap.id } as IOrder);
        });

        setOrders(list);
        setIsLoading(false);
      },
      (error) => {
        console.error('WaiterLiveOrdersPage onSnapshot error:', error);
        toast.error('Failed to connect to kitchen order stream.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // Handle Mark Served / Deliver to Table (Manual Waiter Action)
  const handleDeliverOrder = async (order: IOrder) => {
    if (!user?.tenantId || servingOrderId) return;
    setServingOrderId(order.orderId);
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'orders', order.orderId);
      const timestamp = new Date().toISOString();
      const serverName = user.displayName || user.email || 'Waiter';

      const timelineEvent: ITimelineEvent = {
        type: 'SERVED',
        title: 'Food Served to Table',
        description: `Delivered and served to Table ${order.tableNumber} by Server ${serverName}`,
        timestamp,
        performedBy: serverName
      };

      await updateDoc(docRef, { 
        status: 'SERVED', 
        servedAt: timestamp,
        deliveredAt: timestamp,
        waiterId: user.uid,
        waiterName: serverName,
        timeline: arrayUnion(timelineEvent)
      });

      toast.success(`🍽️ Order #${order.orderId.substring(0, 8)} served to Table ${order.tableNumber}!`);
    } catch (e) {
      console.error('handleDeliverOrder error:', e);
      toast.error('Failed to update order status.');
    } finally {
      setServingOrderId(null);
    }
  };

  // 1. Separate Active vs Completed Datasets
  const activeOrders = useMemo(() => {
    return orders
      .filter(o => isActiveOrderStatus(o.status, o.paymentStatus))
      .sort((a, b) => {
        // Priority sort for active: READY first, then PREPARING, then newest
        const aReady = a.status === 'READY';
        const bReady = b.status === 'READY';
        if (aReady && !bReady) return -1;
        if (!aReady && bReady) return 1;

        const aPrep = a.status === 'PREPARING';
        const bPrep = b.status === 'PREPARING';
        if (aPrep && !bPrep) return -1;
        if (!aPrep && bPrep) return 1;

        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
  }, [orders]);

  const completedOrders = useMemo(() => {
    return orders
      .filter(o => isCompletedOrderStatus(o.status, o.paymentStatus))
      .sort((a, b) => {
        const timeA = new Date((a as any).completedAt || a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date((b as any).completedAt || b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
  }, [orders]);

  // Current dataset according to selected tab
  const currentTabOrders = activeTab === 'active' ? activeOrders : completedOrders;

  // Derive unique tables for current tab
  const uniqueTables = useMemo(() => {
    const set = new Set<string>();
    currentTabOrders.forEach(o => o.tableNumber && set.add(String(o.tableNumber)));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [currentTabOrders]);

  // Filtered orders list for the current tab
  const filteredOrders = useMemo(() => {
    return currentTabOrders.filter(o => {
      const matchesTable = filterTable === 'all' || String(o.tableNumber) === filterTable;
      const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
      
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        (o.orderId || '').toLowerCase().includes(q) ||
        String(o.tableNumber || '').includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        o.items?.some((i: any) => (i.name || i.itemName || '').toLowerCase().includes(q));

      return matchesTable && matchesStatus && matchesQuery;
    });
  }, [currentTabOrders, filterTable, filterStatus, searchQuery]);

  // Dynamic KPI Metrics
  const readyOrdersCount = useMemo(() => activeOrders.filter(o => o.status === 'READY').length, [activeOrders]);
  const preparingOrdersCount = useMemo(() => activeOrders.filter(o => o.status === 'PREPARING').length, [activeOrders]);

  const formatElapsedOrCompleted = (order: IOrder, isCompletedTab: boolean) => {
    if (isCompletedTab) {
      const timestamp = (order as any).completedAt || order.updatedAt || order.createdAt;
      if (!timestamp) return 'Completed';
      try {
        const d = new Date(timestamp);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      } catch {
        return 'Completed';
      }
    }

    const isoStr = order.updatedAt || order.createdAt;
    if (!isoStr) return 'Just now';
    const diff = (Date.now() - new Date(isoStr).getTime()) / 60000;
    if (diff < 1) return 'Just now';
    return `${Math.round(diff)}m ago`;
  };

  return (
    <div className="space-y-6 text-left select-none pb-24 font-sans">
      
      {/* ── 1. Front of House Hero Header ─────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-[#E3DED5] p-5 md:p-6 shadow-[0_2px_10px_rgba(30,30,20,0.06)]">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#5F6762]">
              SPIRALDINE · WAITER OPERATIONS
            </span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#18201D] tracking-tight mt-0.5">
              Live Orders
            </h1>
            <p className="text-xs md:text-sm text-[#5F6762] mt-1 font-normal font-sans">
              Real-time food order tracking, kitchen preparation statuses, and completed table service records.
            </p>
          </div>

          <div className="flex items-center space-x-4 shrink-0 bg-[#F7F4EE] px-4 py-3 rounded-xl border border-[#E3DED5]">
            <div className="text-right">
              <div className="text-xs font-medium text-[#5F6762]">
                {currentTime.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div className="text-lg font-serif font-bold text-[#18201D] tracking-tight leading-none mt-0.5">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
            </div>
            <div className="h-7 w-[1px] bg-[#E3DED5]" />
            <div className="flex items-center space-x-1.5 text-xs font-bold text-[#287A55]">
              <span className="w-2 h-2 rounded-full bg-[#287A55] animate-pulse" />
              <span>Live Sync</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Operational Metrics Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 select-none font-sans">
        {/* Ready For Table Delivery */}
        <div 
          onClick={() => {
            setActiveTab('active');
            setFilterStatus(activeTab === 'active' && filterStatus === 'READY' ? 'all' : 'READY');
          }}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all cursor-pointer ${
            activeTab === 'active' && filterStatus === 'READY'
              ? 'border-[#287A55] ring-2 ring-[#287A55]/20 bg-[#FCFAF7]' 
              : 'border-[#E3DED5] hover:border-[#D1C9BC]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Ready for Delivery
            </span>
            <div className="w-6 h-6 rounded-md bg-[#E8F3ED] flex items-center justify-center text-[#287A55]">
              <UtensilsCrossed className="w-3.5 h-3.5 text-[#287A55]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#287A55] tabular-nums tracking-tight font-sans">
              {readyOrdersCount}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">Food ready in kitchen</p>
          </div>
        </div>

        {/* Cooking in Kitchen */}
        <div 
          onClick={() => {
            setActiveTab('active');
            setFilterStatus(activeTab === 'active' && filterStatus === 'PREPARING' ? 'all' : 'PREPARING');
          }}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all cursor-pointer ${
            activeTab === 'active' && filterStatus === 'PREPARING'
              ? 'border-[#D79A24] ring-2 ring-[#D79A24]/20 bg-[#FEFAF2]' 
              : 'border-[#E3DED5] hover:border-[#D1C9BC]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Cooking
            </span>
            <div className="w-6 h-6 rounded-md bg-[#FEF5E7] flex items-center justify-center text-[#D79A24]">
              <Flame className="w-3.5 h-3.5 text-[#D79A24]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#18201D] tabular-nums tracking-tight font-sans">
              {preparingOrdersCount}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">Currently on the line</p>
          </div>
        </div>

        {/* Active Orders (Accurate Active Count) */}
        <div 
          onClick={() => {
            setActiveTab('active');
            setFilterStatus('all');
          }}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all cursor-pointer ${
            activeTab === 'active' && filterStatus === 'all'
              ? 'border-[#18201D] ring-2 ring-[#18201D]/15 bg-[#FCFAF7]' 
              : 'border-[#E3DED5] hover:border-[#D1C9BC]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Active Orders
            </span>
            <div className="w-6 h-6 rounded-md bg-[#F7F4EE] flex items-center justify-center text-[#18201D]">
              <Clock className="w-3.5 h-3.5 text-[#18201D]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#C84A38] tabular-nums tracking-tight font-sans">
              {activeOrders.length}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">Requires table attention</p>
          </div>
        </div>

        {/* Completed Orders */}
        <div 
          onClick={() => {
            setActiveTab('completed');
            setFilterStatus('all');
          }}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all cursor-pointer ${
            activeTab === 'completed'
              ? 'border-[#287A55] ring-2 ring-[#287A55]/15 bg-[#FCFAF7]' 
              : 'border-[#E3DED5] hover:border-[#D1C9BC]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Completed Orders
            </span>
            <div className="w-6 h-6 rounded-md bg-[#E8F3ED] flex items-center justify-center text-[#287A55]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#287A55]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#18201D] tabular-nums tracking-tight font-sans">
              {completedOrders.length}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">Historical settled orders</p>
          </div>
        </div>
      </div>

      {/* ── 3. Quick Tabs: Active Orders vs Completed Orders ───────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white border border-[#E3DED5] rounded-2xl p-2 shadow-[0_1px_3px_rgba(30,30,20,0.04)]">
        <div className="flex items-center space-x-2">
          {/* Active Orders Tab */}
          <button
            onClick={() => {
              setActiveTab('active');
              setFilterStatus('all');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'active'
                ? 'bg-[#18201D] text-white shadow-sm'
                : 'bg-[#F7F4EE] text-[#5F6762] hover:text-[#18201D] hover:bg-[#EAE5DC]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Active Orders</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all ${
              activeTab === 'active' ? 'bg-[#C84A38] text-white' : 'bg-[#E3DED5] text-[#5F6762]'
            }`}>
              {activeOrders.length}
            </span>
          </button>

          {/* Completed Orders Tab */}
          <button
            onClick={() => {
              setActiveTab('completed');
              setFilterStatus('all');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 ${
              activeTab === 'completed'
                ? 'bg-[#18201D] text-white shadow-sm'
                : 'bg-[#F7F4EE] text-[#5F6762] hover:text-[#18201D] hover:bg-[#EAE5DC]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed Orders</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all ${
              activeTab === 'completed' ? 'bg-[#287A55] text-white' : 'bg-[#E3DED5] text-[#5F6762]'
            }`}>
              {completedOrders.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-[#5F6762] px-2 font-medium hidden sm:block">
          {activeTab === 'active' 
            ? '🔥 Live kitchen & service tickets' 
            : '✓ Historical completed table records'}
        </div>
      </div>

      {/* ── 4. Filters Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white border border-[#E3DED5] rounded-xl p-4 shadow-[0_1px_3px_rgba(30,30,20,0.04)] grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F6762] pointer-events-none" />
          <input
            type="text"
            placeholder={activeTab === 'active' ? "Search active order ID, dish, table..." : "Search completed order ID, dish, table..."}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F7F4EE] border border-[#E3DED5] rounded-lg text-xs font-medium text-[#18201D] placeholder:text-[#5F6762]/60 outline-none focus:border-[#13241F]"
          />
        </div>

        {/* Table Filter */}
        <div>
          <select
            value={filterTable}
            onChange={e => setFilterTable(e.target.value)}
            className="w-full bg-[#F7F4EE] border border-[#E3DED5] rounded-lg px-3 py-2 text-xs font-semibold text-[#18201D] outline-none cursor-pointer focus:border-[#13241F]"
          >
            <option value="all">All Tables ({uniqueTables.length})</option>
            {uniqueTables.map(num => (
              <option key={num} value={num}>Table {num}</option>
            ))}
          </select>
        </div>

        {/* Status Filter (Context-Aware for Tab) */}
        <div>
          {activeTab === 'active' ? (
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full bg-[#F7F4EE] border border-[#E3DED5] rounded-lg px-3 py-2 text-xs font-semibold text-[#18201D] outline-none cursor-pointer focus:border-[#13241F]"
            >
              <option value="all">All Active Statuses ({activeOrders.length})</option>
              <option value="READY">🍳 READY (Ready for Delivery)</option>
              <option value="PREPARING">🔥 PREPARING (Cooking)</option>
              <option value="ACCEPTED">✅ ACCEPTED</option>
              <option value="NEW">🔔 NEW / PLACED</option>
              <option value="DELIVERED">🍽️ DELIVERED / SERVED</option>
            </select>
          ) : (
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full bg-[#F7F4EE] border border-[#E3DED5] rounded-lg px-3 py-2 text-xs font-semibold text-[#18201D] outline-none cursor-pointer focus:border-[#13241F]"
            >
              <option value="all">All Completed Statuses ({completedOrders.length})</option>
              <option value="COMPLETED">✓ COMPLETED</option>
              <option value="PAID">💳 PAID</option>
              <option value="CLOSED">🔒 CLOSED</option>
              <option value="CANCELLED">❌ CANCELLED</option>
            </select>
          )}
        </div>
      </div>

      {/* ── 5. Orders Cards Grid ───────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#5F6762]">
            Showing <strong className="text-[#18201D]">{filteredOrders.length}</strong> {activeTab === 'active' ? 'active' : 'completed'} food orders
          </span>
          {filterStatus !== 'all' && (
            <button 
              onClick={() => setFilterStatus('all')}
              className="text-xs text-[#C84A38] hover:underline font-bold"
            >
              Reset Status Filter
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="bg-white border border-[#E3DED5] rounded-2xl p-12 text-center shadow-[0_1px_3px_rgba(30,30,20,0.04)]">
            <Clock className="w-8 h-8 text-[#5F6762] mx-auto mb-2.5 animate-spin" />
            <p className="text-xs text-[#5F6762]">Connecting to real-time order stream...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white border border-[#E3DED5] rounded-2xl p-12 text-center shadow-[0_1px_3px_rgba(30,30,20,0.04)]">
            <UtensilsCrossed className="w-8 h-8 text-[#5F6762] mx-auto mb-2.5 opacity-60" />
            <h3 className="font-serif text-base font-bold text-[#18201D]">
              {activeTab === 'active' ? 'No Active Orders' : 'No Completed Orders'}
            </h3>
            <p className="text-xs text-[#5F6762] mt-0.5">
              {searchQuery || filterTable !== 'all' || filterStatus !== 'all' 
                ? 'No orders match your filter criteria.'
                : activeTab === 'active'
                ? 'There are currently no active food orders requiring table service.'
                : 'There are no completed orders in this session yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filteredOrders.map(order => {
              const isCompleted = isCompletedOrderStatus(order.status, order.paymentStatus);
              const isReady = order.status === 'READY';
              const isPreparing = order.status === 'PREPARING';
              const isDelivered = order.status === 'DELIVERED' || order.status === 'SERVED';
              const isNew = order.status === 'NEW' || order.status === 'PLACED';
              const timeDisplay = formatElapsedOrCompleted(order, isCompleted);

              return (
                <div
                  key={order.orderId}
                  className={`bg-white border rounded-2xl p-5 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all text-left font-sans ${
                    isReady 
                      ? 'border-[#287A55] border-t-4 ring-2 ring-[#287A55]/15 bg-[#FCFAF7]' 
                      : isPreparing
                      ? 'border-[#D79A24] border-t-4'
                      : isCompleted
                      ? 'border-[#E3DED5] bg-white opacity-95 hover:border-[#287A55]/40'
                      : 'border-[#E3DED5] hover:border-[#D1C9BC]'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Header: Table Number + Order Status */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-bold text-base md:text-lg text-[#18201D] tracking-tight">
                            TABLE {order.tableNumber}
                          </span>
                          <span className="text-[10px] font-mono text-[#5F6762] bg-[#F7F4EE] px-1.5 py-0.5 rounded border border-[#E3DED5]">
                            #{order.orderId.substring(0, 8)}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#5F6762] block mt-0.5">
                          {order.customerName ? `Guest: ${order.customerName}` : 'Dine-In Guest'}
                          {order.assignedChefName && ` · Chef: ${order.assignedChefName}`}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${
                        isReady 
                          ? 'bg-[#E8F3ED] text-[#287A55] border-[#287A55]/30 font-extrabold animate-pulse'
                          : isPreparing
                          ? 'bg-[#FEF5E7] text-[#D79A24] border-[#D79A24]/30 font-bold'
                          : isCompleted
                          ? 'bg-[#E8F3ED] text-[#287A55] border-[#287A55]/30 font-bold'
                          : isDelivered
                          ? 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0] font-bold'
                          : isNew
                          ? 'bg-[#E8F0FE] text-[#1A73E8] border-[#1A73E8]/30 font-bold'
                          : 'bg-[#F7F4EE] text-[#5F6762] border-[#E3DED5]'
                      }`}>
                        {isReady 
                          ? '🟢 Ready to Serve' 
                          : isPreparing 
                          ? '🔥 Cooking' 
                          : isCompleted 
                          ? '✓ COMPLETED' 
                          : isDelivered
                          ? ((order.paymentStatus || '').toLowerCase() === 'paid' ? '✓ Served & Paid' : '🍽️ Served · Payment Pending')
                          : order.status}
                      </span>
                    </div>

                    {/* Ready Banner Announcement for Active Orders */}
                    {isReady && !isCompleted && (
                      <div className="bg-[#E8F3ED] border border-[#287A55]/30 rounded-xl p-2.5 flex items-center space-x-2 text-[#287A55]">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span className="text-xs font-bold leading-tight">
                          Kitchen marked order ready! Deliver to Table {order.tableNumber}.
                        </span>
                      </div>
                    )}

                    {/* Ordered Items List */}
                    <div className="bg-[#FCFAF7] border border-[#E3DED5] rounded-xl p-3 space-y-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F6762] block">
                        Items ({order.items?.length || 0})
                      </span>
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {order.items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="font-medium text-[#18201D] truncate mr-2">
                              <strong className="text-[#C84A38] font-bold mr-1.5">{item.count || item.quantity || 1}×</strong>
                              {item.name || item.itemName}
                            </span>
                            <span className="text-[11px] font-mono text-[#5F6762] shrink-0">
                              {item.pricePerUnit ? formatPrice((item.pricePerUnit || 0) * (item.count || item.quantity || 1)) : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Special Instructions / Notes */}
                    {(order.notes || order.customerNotes || order.kitchenNotes || (order as any).specialInstructions) && (
                      <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-900">
                        <strong className="block text-[10px] uppercase font-bold text-amber-800">Special Instructions:</strong>
                        <p className="mt-0.5 italic">"{order.notes || order.customerNotes || order.kitchenNotes || (order as any).specialInstructions}"</p>
                      </div>
                    )}

                    {/* Financial Summary & Timestamp */}
                    <div className="flex justify-between items-center text-xs border-t border-[#F7F4EE] pt-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#5F6762] uppercase font-bold block">Bill Total</span>
                        <span className="font-extrabold text-sm text-[#18201D] font-mono">
                          {formatPrice(order.total || 0)}
                        </span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] text-[#5F6762] uppercase font-bold block">
                          {isCompleted ? 'Completed At' : 'Elapsed'}
                        </span>
                        <span className="font-semibold text-xs text-[#5F6762] flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {timeDisplay}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Operational Actions */}
                  <div className="pt-4 mt-3 border-t border-[#E3DED5] flex items-center gap-2">
                    {isCompleted ? (
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="w-full py-2.5 bg-[#F7F4EE] hover:bg-[#EAE5DC] border border-[#E3DED5] text-[#18201D] text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#5F6762]" />
                        <span>View Details</span>
                      </button>
                    ) : isReady ? (
                      <>
                        <button
                          onClick={() => handleDeliverOrder(order)}
                          disabled={servingOrderId === order.orderId}
                          className="flex-1 py-2.5 bg-[#287A55] hover:bg-[#1E6B47] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {servingOrderId === order.orderId ? (
                            <>
                              <Clock className="w-3.5 h-3.5 animate-spin" />
                              <span>Serving Food...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Serve Food (Table {order.tableNumber})</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2.5 bg-white border border-[#E3DED5] hover:bg-[#F7F4EE] text-[#18201D] rounded-xl transition-all cursor-pointer"
                          title="View Order Details"
                        >
                          <Eye className="w-4 h-4 text-[#5F6762]" />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 py-2 bg-[#F7F4EE] border border-[#E3DED5] rounded-xl text-center text-xs font-semibold text-[#5F6762]">
                          {isDelivered 
                            ? ((order.paymentStatus || '').toLowerCase() === 'paid' ? '✅ Served & Paid' : '✅ Served · 💳 Payment Pending')
                            : isPreparing 
                            ? '🍳 Cooking in Kitchen' 
                            : `Status: ${order.status}`}
                        </div>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2.5 bg-white border border-[#E3DED5] hover:bg-[#F7F4EE] text-[#18201D] rounded-xl transition-all cursor-pointer"
                          title="View Order Details"
                        >
                          <Eye className="w-4 h-4 text-[#5F6762]" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 6. Order Details Modal ─────────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-[#18201D]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3DED5] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-left">
            <div className="flex justify-between items-start border-b border-[#E3DED5] pb-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#5F6762]">
                  ORDER DETAILS
                </span>
                <h3 className="font-serif text-xl font-bold text-[#18201D]">
                  Table {selectedOrder.tableNumber} · #{selectedOrder.orderId.substring(0, 8)}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-1 rounded-lg text-[#5F6762] hover:text-[#18201D] hover:bg-[#F7F4EE] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#F7F4EE] p-3 rounded-xl">
                <div>
                  <span className="text-[10px] text-[#5F6762] block font-bold uppercase">Status</span>
                  <span className="font-bold text-[#18201D]">{selectedOrder.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5F6762] block font-bold uppercase">Placed At</span>
                  <span className="font-medium text-[#18201D]">
                    {new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5F6762] block font-bold uppercase">Assigned Chef</span>
                  <span className="font-medium text-[#18201D]">{selectedOrder.assignedChefName || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5F6762] block font-bold uppercase">Total Bill</span>
                  <span className="font-extrabold text-[#18201D] font-mono">{formatPrice(selectedOrder.total || 0)}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="font-bold text-[#18201D] block uppercase text-[10px] tracking-wider text-[#5F6762]">
                  Ordered Items ({selectedOrder.items?.length || 0})
                </span>
                <div className="divide-y divide-[#E3DED5] border border-[#E3DED5] rounded-xl p-3 bg-white">
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="py-2 flex justify-between items-center text-xs first:pt-0 last:pb-0">
                      <div>
                        <span className="font-bold text-[#18201D]">
                          {item.count || item.quantity || 1}× {item.name || item.itemName}
                        </span>
                        {item.notes && <p className="text-[11px] text-[#D79A24] italic">Note: "{item.notes}"</p>}
                      </div>
                      <span className="font-mono font-semibold text-[#18201D]">
                        {item.pricePerUnit ? formatPrice((item.pricePerUnit || 0) * (item.count || item.quantity || 1)) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Instructions */}
              {(selectedOrder.notes || selectedOrder.customerNotes || (selectedOrder as any).specialInstructions) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
                  <strong className="block text-[10px] uppercase font-bold text-amber-800">Special Instructions:</strong>
                  <p className="mt-0.5 italic">"{selectedOrder.notes || selectedOrder.customerNotes || (selectedOrder as any).specialInstructions}"</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-[#E3DED5] flex space-x-2">
              {selectedOrder.status === 'READY' && isActiveOrderStatus(selectedOrder.status, selectedOrder.paymentStatus) && (
                <button
                  disabled={servingOrderId === selectedOrder.orderId}
                  onClick={async () => {
                    await handleDeliverOrder(selectedOrder);
                    setSelectedOrder(null);
                  }}
                  className="flex-1 py-2.5 bg-[#287A55] hover:bg-[#1E6B47] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Serve Food to Table {selectedOrder.tableNumber}</span>
                </button>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 py-2.5 bg-white border border-[#E3DED5] text-[#18201D] text-xs font-bold rounded-xl hover:bg-[#F7F4EE] transition-all cursor-pointer"
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

export default WaiterLiveOrdersPage;
