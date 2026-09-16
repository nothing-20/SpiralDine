import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { 
  getActiveDiningSession, 
  IDiningSession 
} from '../../../shared/utils/diningSession';
import { isOrderActive } from '../../../shared/utils/orderUtils';
import { formatPrice } from '../../../utils/format';
import CustomerHeader from '../../../shared/ui/navigation/CustomerHeader';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import Modal from '../../../components/ui/Modal/Modal';
import toast from 'react-hot-toast';
import { 
  Utensils, 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  ChefHat, 
  Coffee, 
  Receipt, 
  ChevronRight, 
  Plus, 
  AlertCircle, 
  Sparkles, 
  Bell, 
  FileText,
  HelpCircle,
  TrendingUp,
  CreditCard,
  ShieldCheck
} from 'lucide-react';

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  NEW:           { label: 'Received',   bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-600', dot: 'bg-blue-500' },
  PLACED:        { label: 'Received',   bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-600', dot: 'bg-blue-500' },
  ACCEPTED:      { label: 'Accepted',   bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-600', dot: 'bg-purple-500' },
  CHEF_ASSIGNED: { label: 'Assigned',   bg: 'bg-violet-500/10 border-violet-500/30', text: 'text-violet-600', dot: 'bg-violet-500' },
  PREPARING:     { label: 'Preparing',  bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-600', dot: 'bg-orange-500 animate-pulse' },
  READY:         { label: 'Ready',      bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  PICKED_UP:     { label: 'Picked Up',  bg: 'bg-indigo-500/10 border-indigo-500/30', text: 'text-indigo-600', dot: 'bg-indigo-500' },
  DELIVERED:     { label: 'Served',     bg: 'bg-teal-500/10 border-teal-500/30', text: 'text-teal-700', dot: 'bg-teal-500' },
  SERVED:        { label: 'Served',     bg: 'bg-teal-500/10 border-teal-500/30', text: 'text-teal-700', dot: 'bg-teal-500' },
  BILL_REQUESTED:{ label: 'Billing',    bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-700', dot: 'bg-purple-500' },
  COMPLETED:     { label: 'Completed',  bg: 'bg-slate-100 border-slate-300', text: 'text-slate-600', dot: 'bg-slate-500' }
};

export const ActiveDiningSessionPage: React.FC = () => {
  const { tenantId: routeTenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();

  const [activeSession, setActiveSession] = useState<IDiningSession | null>(null);
  const [resolvedTenantId, setResolvedTenantId] = useState<string>(routeTenantId || '');
  const [restaurantName, setRestaurantName] = useState<string>('Restaurant');
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCallingWaiter, setIsCallingWaiter] = useState<boolean>(false);
  const [isRequestingBill, setIsRequestingBill] = useState<boolean>(false);
  const [isBillModalOpen, setIsBillModalOpen] = useState<boolean>(false);

  // 1. Resolve active session from storage / parameters
  useEffect(() => {
    let tId = routeTenantId || '';
    const storedSession = getActiveDiningSession(tId || undefined);

    if (storedSession) {
      setActiveSession(storedSession);
      if (!tId) {
        tId = storedSession.tenantId || storedSession.restaurantId;
      }
    }
    setResolvedTenantId(tId);
  }, [routeTenantId]);

  // 2. Fetch Restaurant Info
  useEffect(() => {
    if (!resolvedTenantId) return;

    const fetchInfo = async () => {
      try {
        let snap = await getDoc(doc(db, 'tenants', resolvedTenantId));
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'restaurants', resolvedTenantId));
        }
        if (snap.exists()) {
          const d = snap.data();
          setRestaurantName(d.restaurantName || d.name || 'Restaurant');
        }
      } catch (err) {
        console.warn('[ActiveDiningSessionPage] Error loading restaurant details:', err);
      }
    };
    fetchInfo();
  }, [resolvedTenantId]);

  // 3. Subscribe to real-time orders for this session & table
  useEffect(() => {
    if (!resolvedTenantId) {
      setIsLoading(false);
      return;
    }

    const tableNum = activeSession?.tableNumber;
    const ordersCol = collection(db, 'restaurants', resolvedTenantId, 'orders');

    // Query orders for this table
    let q = query(ordersCol);
    if (tableNum) {
      q = query(ordersCol, where('tableNumber', '==', String(tableNum).replace(/^TBL-/i, '')));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (isOrderActive(data)) {
          // If sessionId is present on session, match it or match table orders within dining window
          if (
            !activeSession?.sessionId ||
            data.sessionId === activeSession.sessionId ||
            !data.sessionId ||
            data.sessionId === 'GUEST-SESSION'
          ) {
            list.push({ id: docSnap.id, ...data });
          }
        }
      });

      // Sort chronological: oldest first for sequence #1, #2...
      list.sort((a, b) => {
        const tA = new Date(a.createdAt || 0).getTime();
        const tB = new Date(b.createdAt || 0).getTime();
        return tA - tB;
      });

      setOrders(list);
      setIsLoading(false);
    }, (err) => {
      console.error('[ActiveDiningSessionPage] Orders error:', err);
      setIsLoading(false);
    });

    return () => unsub();
  }, [resolvedTenantId, activeSession?.tableNumber, activeSession?.sessionId]);

  // Financial aggregates across all orders in session
  const { combinedSubtotal, combinedTax, combinedServiceCharge, grandTotal, totalItemsCount } = useMemo(() => {
    let sub = 0;
    let tax = 0;
    let sc = 0;
    let total = 0;
    let itemsCount = 0;

    orders.forEach((o) => {
      sub += Number(o.subtotal) || 0;
      tax += Number(o.tax) || 0;
      sc += Number(o.serviceCharge) || 0;
      total += Number(o.total || o.totalAmount) || 0;

      if (Array.isArray(o.items)) {
        o.items.forEach((item: any) => {
          itemsCount += Number(item.count || item.quantity || 1);
        });
      }
    });

    return {
      combinedSubtotal: sub,
      combinedTax: tax,
      combinedServiceCharge: sc,
      grandTotal: total,
      totalItemsCount: itemsCount
    };
  }, [orders]);

  // Service Request: Call Waiter
  const handleCallWaiter = async () => {
    if (!resolvedTenantId) return;
    setIsCallingWaiter(true);
    try {
      const tableNumber = activeSession?.tableNumber || 'Table';
      const reqId = `REQ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const reqRef = doc(db, 'restaurants', resolvedTenantId, 'waiterRequests', reqId);
      await setDoc(reqRef, {
        id: reqId,
        requestId: reqId,
        tableNumber: String(tableNumber).replace(/^TBL-/i, ''),
        type: 'Assistance',
        requestType: 'Assistance Requested',
        status: 'Pending',
        createdAt: new Date().toISOString()
      });
      toast.success(`Waiter notified! Someone will assist Table ${tableNumber} shortly.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to notify waiter.');
    } finally {
      setIsCallingWaiter(false);
    }
  };

  // Service Request: Request Bill
  const handleRequestBill = async () => {
    if (!resolvedTenantId) return;
    setIsRequestingBill(true);
    try {
      const tableNumber = activeSession?.tableNumber || 'Table';
      const reqId = `REQ-BILL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const reqRef = doc(db, 'restaurants', resolvedTenantId, 'waiterRequests', reqId);
      await setDoc(reqRef, {
        id: reqId,
        requestId: reqId,
        tableNumber: String(tableNumber).replace(/^TBL-/i, ''),
        type: 'Bill',
        requestType: 'Bill Requested',
        status: 'Pending',
        createdAt: new Date().toISOString(),
        totalAmount: grandTotal
      });

      // Also set table status to bill_requested if tableId known
      if (activeSession?.tableId) {
        try {
          const tRef = doc(db, 'restaurants', resolvedTenantId, 'tables', activeSession.tableId);
          await setDoc(tRef, { status: 'bill_requested' }, { merge: true });
        } catch (_) {}
      }

      toast.success(`Bill requested! The server has been notified.`);
      setIsBillModalOpen(true);
    } catch (e) {
      console.error(e);
      toast.error('Failed to request bill.');
    } finally {
      setIsRequestingBill(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] flex flex-col items-center justify-center p-6 space-y-4">
        <LoadingSpinner label="Loading active dining session..." />
      </div>
    );
  }

  const currentTable = activeSession?.tableNumber || 'Your Table';

  return (
    <div className="min-h-screen bg-[#FCFAF7] text-[#202124] antialiased selection:bg-[#F3E8DF] pb-24">
      {/* Header */}
      <CustomerHeader tableNumber={currentTable} restaurantName={restaurantName} />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Navigation & Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/customer/restaurant/${resolvedTenantId}/menu`)}
              className="w-10 h-10 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] rounded-2xl flex items-center justify-center text-[#202124] hover:text-[#C85A3F] transition-all cursor-pointer shadow-xs"
              title="Back to Menu"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active Dining Session
                </span>
                <span className="text-xs font-bold text-[#756B64] font-mono">
                  Table {currentTable}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#202124] tracking-tight mt-0.5">
                Current Table Session
              </h1>
            </div>
          </div>

          {/* Quick Action: Add More Food */}
          <button
            onClick={() => navigate(`/customer/restaurant/${resolvedTenantId}/menu`)}
            className="px-4 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add More Food</span>
          </button>
        </div>

        {/* 1. Dining Session Overview Banner */}
        <div className="bg-white border border-[#E5DCD5] rounded-3xl p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#C85A3F]/5 to-transparent rounded-bl-full pointer-events-none" />
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
            <div>
              <span className="text-[10px] text-[#756B64] font-extrabold uppercase tracking-wider block">
                Table Context
              </span>
              <span className="text-lg font-extrabold text-[#202124]">
                Table {currentTable}
              </span>
              <span className="text-[11px] text-[#756B64] block">
                {activeSession?.tableName || `Dine-In Table ${currentTable}`}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-[#756B64] font-extrabold uppercase tracking-wider block">
                Total Orders
              </span>
              <span className="text-lg font-extrabold text-[#202124]">
                {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
              </span>
              <span className="text-[11px] text-[#756B64] block">
                {totalItemsCount} total items
              </span>
            </div>

            <div>
              <span className="text-[10px] text-[#756B64] font-extrabold uppercase tracking-wider block">
                Session Started
              </span>
              <span className="text-lg font-extrabold text-[#202124]">
                {activeSession?.startedAt 
                  ? new Date(activeSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Active Now'}
              </span>
              <span className="text-[11px] text-[#756B64] block">
                Live Visit
              </span>
            </div>

            <div>
              <span className="text-[10px] text-[#756B64] font-extrabold uppercase tracking-wider block">
                Current Total
              </span>
              <span className="text-xl font-extrabold text-[#C85A3F]">
                {formatPrice(grandTotal)}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold block">
                Incl. taxes & fees
              </span>
            </div>
          </div>
        </div>

        {/* 2. Chronological Orders Breakdown */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#202124] flex items-center gap-2">
              <Utensils className="w-4 h-4 text-[#C85A3F]" />
              <span>Orders Placed in this Visit</span>
            </h2>
            <span className="text-xs text-[#756B64] font-semibold">
              Updated live from kitchen & waitstaff
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white border border-[#E5DCD5] rounded-3xl p-10 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FCFAF7] border border-[#E5DCD5] flex items-center justify-center text-[#756B64]">
                <Utensils className="w-6 h-6 opacity-40" />
              </div>
              <h3 className="text-sm font-extrabold text-[#202124]">No Orders Placed Yet</h3>
              <p className="text-xs text-[#756B64] max-w-sm mx-auto">
                You are currently seated at Table {currentTable}. Browse the menu and submit your first order.
              </p>
              <button
                onClick={() => navigate(`/customer/restaurant/${resolvedTenantId}/menu`)}
                className="px-5 py-2.5 bg-[#C85A3F] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order, index) => {
                const seqNumber = order.orderSequence || (index + 1);
                const statusInfo = STATUS_BADGES[order.status] || STATUS_BADGES['NEW'];
                const orderTime = order.createdAt 
                  ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <div
                    key={order.id || order.orderId}
                    className="bg-white border border-[#E5DCD5] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 text-left transition-all hover:border-[#C85A3F]/40"
                  >
                    {/* Order Ticket Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#F3E8DF]">
                      <div className="flex items-center gap-2.5">
                        <span className="w-8 h-8 rounded-xl bg-[#FCFAF7] border border-[#E5DCD5] text-xs font-black text-[#202124] flex items-center justify-center font-mono">
                          #{String(seqNumber).padStart(2, '0')}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-[#202124]">
                              Order #{order.orderId || order.id}
                            </h3>
                            {seqNumber > 1 && (
                              <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-800 font-extrabold px-2 py-0.5 rounded-md">
                                Add-on Order
                              </span>
                            )}
                          </div>
                          {orderTime && (
                            <span className="text-[11px] text-[#756B64] flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>Placed at {orderTime}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status + Individual Tracker Link */}
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${statusInfo.bg} ${statusInfo.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                          <span>{statusInfo.label}</span>
                        </span>
                        <button
                          onClick={() => navigate(`/customer/restaurant/${resolvedTenantId}/order/${order.orderId || order.id}`)}
                          className="px-3 py-1.5 bg-[#FCFAF7] hover:bg-[#F3E8DF] border border-[#E5DCD5] text-[#202124] hover:text-[#C85A3F] text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>Track</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Order Items Table / List */}
                    <div className="space-y-2">
                      {Array.isArray(order.items) && order.items.map((item: any, iIdx: number) => {
                        const qty = Number(item.count || item.quantity || 1);
                        const price = Number(item.pricePerUnit || item.price || 0);

                        return (
                          <div key={iIdx} className="flex items-start justify-between text-xs py-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-5 h-5 rounded-md bg-[#F3E8DF] text-[#C85A3F] font-black text-[11px] flex items-center justify-center shrink-0">
                                {qty}×
                              </span>
                              <span className="font-bold text-[#202124] truncate">
                                {item.name || 'Dish'}
                              </span>
                              {item.notes && (
                                <span className="text-[10px] text-[#756B64] italic truncate max-w-[150px]">
                                  ({item.notes})
                                </span>
                              )}
                            </div>
                            <span className="font-extrabold text-[#202124] shrink-0 ml-2">
                              {formatPrice(price * qty)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Order Financial Footer */}
                    <div className="pt-3 border-t border-[#F3E8DF] flex items-center justify-between text-xs">
                      <span className="text-[#756B64] font-semibold">
                        Order #{seqNumber} Total
                      </span>
                      <span className="font-extrabold text-[#202124] text-sm">
                        {formatPrice(order.total || order.totalAmount || 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Overall Bill Summary & Final Checkout Bar */}
        {orders.length > 0 && (
          <div className="bg-white border border-[#E5DCD5] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 text-left">
            <h3 className="text-sm font-extrabold text-[#202124] border-b border-[#F3E8DF] pb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#C85A3F]" />
              <span>Current Dining Bill Breakdown</span>
            </h3>

            <div className="space-y-2 text-xs font-semibold text-[#756B64]">
              <div className="flex justify-between">
                <span>Items Subtotal ({totalItemsCount} items)</span>
                <span className="text-[#202124] font-bold">{formatPrice(combinedSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes & GST</span>
                <span className="text-[#202124] font-bold">{formatPrice(combinedTax)}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Fee</span>
                <span className="text-[#202124] font-bold">{formatPrice(combinedServiceCharge)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-[#202124] pt-3 border-t border-[#F3E8DF]">
                <span>Current Dining Total</span>
                <span className="text-[#C85A3F] font-black">{formatPrice(grandTotal)}</span>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => navigate(`/customer/restaurant/${resolvedTenantId}/menu`)}
                className="py-3 px-4 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add More Food</span>
              </button>

              <button
                onClick={handleCallWaiter}
                disabled={isCallingWaiter}
                className="py-3 px-4 bg-white hover:bg-[#FCFAF7] border border-[#E5DCD5] text-[#202124] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Bell className="w-4 h-4 text-amber-500" />
                <span>{isCallingWaiter ? 'Calling Server...' : 'Call Waiter'}</span>
              </button>

              <button
                onClick={handleRequestBill}
                disabled={isRequestingBill}
                className="py-3 px-4 bg-[#202124] hover:bg-[#333] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>{isRequestingBill ? 'Requesting Bill...' : 'Request Bill'}</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* Bill Preview Modal */}
      {isBillModalOpen && (
        <Modal
          isOpen={isBillModalOpen}
          onClose={() => setIsBillModalOpen(false)}
          title={`Bill for Table ${currentTable}`}
        >
          <div className="p-4 space-y-4 text-left text-xs">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Your waiter has been notified and will bring your invoice shortly.</span>
            </div>

            <div className="border border-[#E5DCD5] rounded-2xl p-4 space-y-3 bg-[#FCFAF7]">
              <div className="text-center pb-2 border-b border-[#E5DCD5]">
                <h4 className="font-extrabold text-sm text-[#202124]">{restaurantName}</h4>
                <p className="text-[11px] text-[#756B64]">Table {currentTable} • Dining Session</p>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {orders.map((o, idx) => (
                  <div key={o.id} className="border-b border-[#E5DCD5]/60 pb-1.5 last:border-0">
                    <span className="font-bold text-[#202124] block">Order #{o.orderSequence || (idx + 1)}:</span>
                    {Array.isArray(o.items) && o.items.map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-[#756B64]">
                        <span>{it.count || it.quantity || 1}× {it.name}</span>
                        <span>{formatPrice((Number(it.pricePerUnit || it.price) || 0) * Number(it.count || it.quantity || 1))}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="border-t border-[#E5DCD5] pt-2 space-y-1">
                <div className="flex justify-between text-[#756B64]">
                  <span>Subtotal</span>
                  <span>{formatPrice(combinedSubtotal)}</span>
                </div>
                <div className="flex justify-between text-[#756B64]">
                  <span>Taxes & GST</span>
                  <span>{formatPrice(combinedTax)}</span>
                </div>
                <div className="flex justify-between text-[#756B64]">
                  <span>Service Charge</span>
                  <span>{formatPrice(combinedServiceCharge)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-[#202124] pt-1 border-t border-[#E5DCD5]">
                  <span>Grand Total</span>
                  <span className="text-[#C85A3F]">{formatPrice(grandTotal)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsBillModalOpen(false)}
              className="w-full py-2.5 bg-[#C85A3F] text-white font-extrabold rounded-xl"
            >
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ActiveDiningSessionPage;
