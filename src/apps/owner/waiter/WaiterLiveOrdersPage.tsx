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
  Table as TableIcon
} from 'lucide-react';

export const WaiterLiveOrdersPage: React.FC = () => {
  const { user } = useAuth();
  
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);

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
    const qOrders = query(colRef, limit(60));

    const unsubscribe = onSnapshot(
      qOrders,
      (snapshot) => {
        const list: IOrder[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const st = (data.status || '').toUpperCase();
          // Keep active orders: NEW, PLACED, ACCEPTED, PREPARING, READY, PICKED_UP, DELIVERED, SERVED
          if (st !== 'ARCHIVED' && st !== 'CANCELLED') {
            list.push({ ...data, orderId: data.orderId || docSnap.id } as IOrder);
          }
        });

        // Priority sort: READY first, then newest
        list.sort((a, b) => {
          const aReady = a.status === 'READY';
          const bReady = b.status === 'READY';
          if (aReady && !bReady) return -1;
          if (!aReady && bReady) return 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
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

  // Handle Mark Served / Deliver to Table
  const handleDeliverOrder = async (order: IOrder) => {
    if (!user?.tenantId) return;
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'orders', order.orderId);
      const timelineEvent = {
        type: 'DELIVERED',
        title: 'Food Served to Table',
        description: `Delivered by Server ${user.displayName || user.email || 'Waiter'}`,
        timestamp: new Date().toISOString(),
        performedBy: user.displayName || user.email || 'Waiter'
      };

      await updateDoc(docRef, { 
        status: 'DELIVERED', 
        deliveredAt: new Date().toISOString(),
        timeline: arrayUnion(timelineEvent)
      });

      toast.success(`🍽️ Order #${order.orderId.substring(0, 8)} served to Table ${order.tableNumber}!`);
    } catch (e) {
      console.error('handleDeliverOrder error:', e);
      toast.error('Failed to update order status.');
    }
  };

  // Derive unique tables for filter
  const uniqueTables = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => o.tableNumber && set.add(String(o.tableNumber)));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesTable = filterTable === 'all' || String(o.tableNumber) === filterTable;
      const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
      
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery = !q || 
        o.orderId.toLowerCase().includes(q) ||
        String(o.tableNumber).includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        o.items?.some((i: any) => (i.name || i.itemName || '').toLowerCase().includes(q));

      return matchesTable && matchesStatus && matchesQuery;
    });
  }, [orders, filterTable, filterStatus, searchQuery]);

  // Metrics
  const readyOrdersCount = useMemo(() => orders.filter(o => o.status === 'READY').length, [orders]);
  const preparingOrdersCount = useMemo(() => orders.filter(o => o.status === 'PREPARING').length, [orders]);
  const activeTablesCount = uniqueTables.length;

  const getMinutesElapsed = (isoStr: string) => {
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
              Real-time food order tracking, kitchen status updates, and table delivery service.
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
          onClick={() => setFilterStatus(filterStatus === 'READY' ? 'all' : 'READY')}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all cursor-pointer ${
            filterStatus === 'READY' 
              ? 'border-[#C84A38] ring-2 ring-[#C84A38]/20 bg-[#FCFAF7]' 
              : 'border-[#E3DED5] hover:border-[#D1C9BC]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Ready for Delivery
            </span>
            <div className="w-6 h-6 rounded-md bg-[#F9E8E4] flex items-center justify-center text-[#C84A38]">
              <UtensilsCrossed className="w-3.5 h-3.5 text-[#C84A38]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#C84A38] tabular-nums tracking-tight font-sans">
              {readyOrdersCount}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">Food ready in kitchen</p>
          </div>
        </div>

        {/* Cooking in Kitchen */}
        <div 
          onClick={() => setFilterStatus(filterStatus === 'PREPARING' ? 'all' : 'PREPARING')}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all cursor-pointer ${
            filterStatus === 'PREPARING' 
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

        {/* Total Active Tickets */}
        <div 
          onClick={() => setFilterStatus('all')}
          className="bg-white border border-[#E3DED5] rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between hover:border-[#D1C9BC] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Active Tickets
            </span>
            <div className="w-6 h-6 rounded-md bg-[#F7F4EE] flex items-center justify-center text-[#18201D]">
              <Clock className="w-3.5 h-3.5 text-[#18201D]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#18201D] tabular-nums tracking-tight font-sans">
              {orders.length}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">Orders in workflow</p>
          </div>
        </div>

        {/* Active Dining Tables */}
        <div className="bg-white border border-[#E3DED5] rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between hover:border-[#D1C9BC] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Dining Tables
            </span>
            <div className="w-6 h-6 rounded-md bg-[#E8F3ED] flex items-center justify-center text-[#287A55]">
              <TableIcon className="w-3.5 h-3.5 text-[#287A55]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#18201D] tabular-nums tracking-tight font-sans">
              {activeTablesCount}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">Tables with food</p>
          </div>
        </div>
      </div>

      {/* ── 3. Filters Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white border border-[#E3DED5] rounded-xl p-4 shadow-[0_1px_3px_rgba(30,30,20,0.04)] grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5F6762] pointer-events-none" />
          <input
            type="text"
            placeholder="Search order ID, dish, table..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F7F4EE] border border-[#E3DED5] rounded-lg text-xs font-medium text-[#18201D] placeholder:text-[#5F6762]/60 outline-none focus:border-[#13241F]"
          />
        </div>

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

        <div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full bg-[#F7F4EE] border border-[#E3DED5] rounded-lg px-3 py-2 text-xs font-semibold text-[#18201D] outline-none cursor-pointer focus:border-[#13241F]"
          >
            <option value="all">All Statuses ({orders.length})</option>
            <option value="READY">🍳 READY (Ready to Serve)</option>
            <option value="PREPARING">🔥 PREPARING (Cooking)</option>
            <option value="ACCEPTED">✅ ACCEPTED</option>
            <option value="NEW">🔔 NEW / PLACED</option>
            <option value="DELIVERED">🍽️ DELIVERED / SERVED</option>
          </select>
        </div>
      </div>

      {/* ── 4. Orders Cards Grid ───────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#5F6762]">
            Showing <strong className="text-[#18201D]">{filteredOrders.length}</strong> active food orders
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
            <h3 className="font-serif text-base font-bold text-[#18201D]">No Live Orders</h3>
            <p className="text-xs text-[#5F6762] mt-0.5">
              {searchQuery || filterTable !== 'all' || filterStatus !== 'all' 
                ? 'No orders match your filter criteria.'
                : 'There are currently no active food orders in the kitchen workflow.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filteredOrders.map(order => {
              const isReady = order.status === 'READY';
              const isPreparing = order.status === 'PREPARING';
              const isDelivered = order.status === 'DELIVERED' || order.status === 'SERVED';
              const isNew = order.status === 'NEW' || order.status === 'PLACED';
              const elapsed = getMinutesElapsed(order.updatedAt || order.createdAt);

              return (
                <div
                  key={order.orderId}
                  className={`bg-white border rounded-2xl p-5 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all text-left font-sans ${
                    isReady 
                      ? 'border-[#287A55] border-t-4 ring-2 ring-[#287A55]/15 bg-[#FCFAF7]' 
                      : isPreparing
                      ? 'border-[#D79A24] border-t-4'
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
                          : isDelivered
                          ? 'bg-[#F7F4EE] text-[#5F6762] border-[#E3DED5]'
                          : isNew
                          ? 'bg-[#E8F0FE] text-[#1A73E8] border-[#1A73E8]/30 font-bold'
                          : 'bg-[#F7F4EE] text-[#5F6762] border-[#E3DED5]'
                      }`}>
                        {isReady ? '🟢 Ready for Table' : isPreparing ? '🔥 Cooking' : order.status}
                      </span>
                    </div>

                    {/* Ready Banner Announcement */}
                    {isReady && (
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

                    {/* Financial Summary & Elapsed Time */}
                    <div className="flex justify-between items-center text-xs border-t border-[#F7F4EE] pt-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-[#5F6762] uppercase font-bold block">Bill Total</span>
                        <span className="font-extrabold text-sm text-[#18201D] font-mono">
                          {formatPrice(order.total || 0)}
                        </span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] text-[#5F6762] uppercase font-bold block">Elapsed</span>
                        <span className="font-semibold text-xs text-[#5F6762] flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3" />
                          {elapsed}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Operational Actions */}
                  <div className="pt-4 mt-3 border-t border-[#E3DED5] flex items-center gap-2">
                    {isReady ? (
                      <button
                        onClick={() => handleDeliverOrder(order)}
                        className="flex-1 py-2.5 bg-[#287A55] hover:bg-[#1E6B47] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Deliver to Table {order.tableNumber}</span>
                      </button>
                    ) : (
                      <div className="flex-1 py-2 bg-[#F7F4EE] border border-[#E3DED5] rounded-xl text-center text-xs font-semibold text-[#5F6762]">
                        {isDelivered ? '✅ Served to Table' : isPreparing ? '🍳 Cooking in Kitchen' : `Status: ${order.status}`}
                      </div>
                    )}

                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="p-2.5 bg-white border border-[#E3DED5] hover:bg-[#F7F4EE] text-[#18201D] rounded-xl transition-all"
                      title="View Order Details"
                    >
                      <Eye className="w-4 h-4 text-[#5F6762]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 5. Order Details Modal ─────────────────────────────────────── */}
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
                className="p-1 rounded-lg text-[#5F6762] hover:text-[#18201D] hover:bg-[#F7F4EE]"
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
                  <span className="font-medium text-[#18201D]">{new Date(selectedOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
              {selectedOrder.status === 'READY' && (
                <button
                  onClick={() => {
                    handleDeliverOrder(selectedOrder);
                    setSelectedOrder(null);
                  }}
                  className="flex-1 py-2.5 bg-[#287A55] hover:bg-[#1E6B47] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Deliver Food to Table {selectedOrder.tableNumber}</span>
                </button>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="flex-1 py-2.5 bg-white border border-[#E3DED5] text-[#18201D] text-xs font-bold rounded-xl hover:bg-[#F7F4EE] transition-all"
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
