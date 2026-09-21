import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useCurrency } from '../../../context/CurrencyContext';
import { 
  Utensils, Clock, ChevronRight, ShoppingBag, 
  CheckCircle2, ArrowRight, RefreshCw, Calendar,
  MapPin, Search, Sparkles, ExternalLink, RotateCcw,
  Receipt, ShieldCheck, Heart, Star
} from 'lucide-react';
import { isOrderActive, isOrderTerminal } from '../../../shared/utils/orderUtils';

interface OrderItem {
  itemId?: string;
  name: string;
  count?: number;
  quantity?: number;
  pricePerUnit?: number;
  price?: number;
  notes?: string;
  isVeg?: boolean;
  image?: string;
}

interface CustomerOrder {
  id: string;
  orderId?: string;
  tenantId?: string;
  restaurantId?: string;
  restaurantName?: string;
  tableNumber?: string;
  tableId?: string;
  items?: OrderItem[];
  subtotal?: number;
  tax?: number;
  serviceCharge?: number;
  discount?: number;
  tip?: number;
  total?: number;
  totalAmount?: number;
  status?: string;
  paymentStatus?: string;
  specialInstructions?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const CustomerOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { formatPrice } = useCurrency();

  // Unified orders storage map keyed by orderId/id
  const [ordersMap, setOrdersMap] = useState<Record<string, CustomerOrder>>({});
  const [restaurantMeta, setRestaurantMeta] = useState<Record<string, { name: string; locality?: string; logo?: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'past'>('all');
  const [searchFilter, setSearchFilter] = useState('');

  // 1. Unified Multi-Source Real-Time Subscriptions
  useEffect(() => {
    setIsLoading(true);
    const unsubs: Array<() => void> = [];
    const activeDocSubs = new Set<string>();

    // Helper to merge newly fetched orders into state
    const mergeOrders = (incoming: CustomerOrder[], isAuthoritative = false) => {
      setOrdersMap(prev => {
        const next = { ...prev };
        incoming.forEach(order => {
          const key = order.orderId || order.id;
          if (!key) return;

          const existing = next[key];
          if (!existing) {
            next[key] = order;
          } else if (isAuthoritative) {
            // Authoritative update from restaurants/{tenantId}/orders/{orderId}
            next[key] = {
              ...existing,
              ...order
            };
          } else {
            // Non-authoritative snapshot (from customers/{uid}/orders or initial localStorage cache)
            // NEVER allow a stale status (e.g. 'NEW') to overwrite an already terminal order!
            if (isOrderTerminal(existing) && !isOrderTerminal(order)) {
              next[key] = {
                ...order,
                ...existing, // preserve terminal status and paymentStatus
                restaurantName: order.restaurantName || existing.restaurantName
              };
            } else {
              next[key] = {
                ...existing,
                ...order
              };
            }
          }
        });
        return next;
      });
    };

    // Attach authoritative real-time listener to restaurant order document
    const attachAuthoritativeOrderListener = (tenantId: string, orderId: string) => {
      if (!tenantId || !orderId || activeDocSubs.has(orderId)) return;
      activeDocSubs.add(orderId);

      const orderDocRef = doc(db, 'restaurants', tenantId, 'orders', orderId);
      const unsubDoc = onSnapshot(orderDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as CustomerOrder;
          const mergedItem: CustomerOrder = {
            ...data,
            id: snap.id,
            orderId: snap.id,
            tenantId
          };
          mergeOrders([mergedItem], true);

          // Real-time synchronization: sync terminal status into local storage index
          // so CustomerHome and other tabs immediately update without page reload
          try {
            const localOrdersStr = localStorage.getItem('restaurantos_customer_orders');
            if (localOrdersStr) {
              const list = JSON.parse(localOrdersStr);
              if (Array.isArray(list)) {
                let changed = false;
                const updated = list.map((it: any) => {
                  if (it.orderId === snap.id) {
                    changed = true;
                    return {
                      ...it,
                      status: data.status,
                      paymentStatus: data.paymentStatus
                    };
                  }
                  return it;
                });
                if (changed) {
                  localStorage.setItem('restaurantos_customer_orders', JSON.stringify(updated));
                  window.dispatchEvent(new Event('storage'));
                }
              }
            }
          } catch (_) {}
        }
      }, (err) => {
        console.warn(`[OrdersPage] Document stream warning for ${orderId}:`, err);
      });
      unsubs.push(unsubDoc);
    };

    // Source A: Active Table Session in sessionStorage / localStorage
    const savedSessionStr = sessionStorage.getItem('restaurantos_dining_session') || localStorage.getItem('restaurantos_dining_session');
    let sessionTenantId = '';
    if (savedSessionStr) {
      try {
        const parsed = JSON.parse(savedSessionStr);
        sessionTenantId = parsed.restaurantId || parsed.tenantId || '';
      } catch (e) {
        console.error('Failed to parse cached session', e);
      }
    }

    if (sessionTenantId) {
      try {
        const ordersRef = collection(db, 'restaurants', sessionTenantId, 'orders');
        const qOrders = user?.uid ? query(ordersRef, where('customerId', '==', user.uid)) : ordersRef;
        const unsubSession = onSnapshot(qOrders, (snap) => {
          const fetched: CustomerOrder[] = [];
          snap.forEach(d => {
            const data = d.data() as CustomerOrder;
            fetched.push({ ...data, id: d.id, tenantId: sessionTenantId });
          });
          mergeOrders(fetched, true); // Authoritative: directly from restaurants/{tenantId}/orders
          setIsLoading(false);
        }, (err) => {
          console.warn('[OrdersPage] Session tenant orders stream warning:', err);
          setIsLoading(false);
        });
        unsubs.push(unsubSession);
      } catch (e) {
        console.warn('[OrdersPage] Could not listen to session tenant orders:', e);
      }
    }

    // Source B: Authenticated User Orders collection (customers/{uid}/orders)
    if (user?.uid) {
      try {
        const userOrdersRef = collection(db, 'customers', user.uid, 'orders');
        const unsubUser = onSnapshot(userOrdersRef, (snap) => {
          const fetched: CustomerOrder[] = [];
          snap.forEach(d => {
            const data = d.data() as CustomerOrder;
            fetched.push({ ...data, id: d.id });

            // Attach authoritative real-time listener to the actual restaurant order document!
            const tId = data.tenantId || data.restaurantId;
            const oId = data.orderId || d.id;
            if (tId && oId) {
              attachAuthoritativeOrderListener(tId, oId);
            }
          });
          mergeOrders(fetched, false);
          setIsLoading(false);
        }, (err) => {
          console.warn('[OrdersPage] User orders stream warning:', err);
          setIsLoading(false);
        });
        unsubs.push(unsubUser);
      } catch (e) {
        console.warn('[OrdersPage] Could not listen to user orders collection:', e);
      }
    }

    // Source C: Stored recent orders in localStorage (Resilience for guests & cross-page navigation)
    try {
      const localOrdersStr = localStorage.getItem('restaurantos_customer_orders');
      if (localOrdersStr) {
        const parsedList = JSON.parse(localOrdersStr);
        if (Array.isArray(parsedList) && parsedList.length > 0) {
          // Pre-populate with cached snapshots
          mergeOrders(parsedList.map(item => ({
            id: item.orderId,
            orderId: item.orderId,
            tenantId: item.tenantId,
            restaurantName: item.restaurantName,
            tableNumber: item.tableNumber,
            total: item.total,
            status: item.status || 'NEW',
            createdAt: item.createdAt
          })), false);

          // Attach individual real-time listeners to the actual restaurant orders
          parsedList.slice(0, 15).forEach(item => {
            const tId = item.tenantId || item.restaurantId;
            const oId = item.orderId || item.id;
            if (tId && oId) {
              attachAuthoritativeOrderListener(tId, oId);
            }
          });
        }
      }
    } catch (storageErr) {
      console.warn('[OrdersPage] Failed reading local storage orders:', storageErr);
    }

    // Fallback timer to disable loading spinner even if no data exists
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);

    return () => {
      clearTimeout(timer);
      unsubs.forEach(fn => fn());
    };
  }, [user]);

  // 2. Fetch missing restaurant names/metadata for orders
  useEffect(() => {
    const tenantsToFetch = new Set<string>();
    Object.values(ordersMap).forEach(order => {
      const t = order.tenantId || order.restaurantId;
      if (t && !restaurantMeta[t] && !order.restaurantName) {
        tenantsToFetch.add(t);
      }
    });

    if (tenantsToFetch.size === 0) return;

    tenantsToFetch.forEach(async (tenantId) => {
      try {
        const snap = await getDoc(doc(db, 'restaurants', tenantId));
        if (snap.exists()) {
          const data = snap.data();
          setRestaurantMeta(prev => ({
            ...prev,
            [tenantId]: {
              name: data.name || tenantId,
              locality: data.area || data.address || data.city || '',
              logo: data.logoUrl || data.coverImage || ''
            }
          }));
        }
      } catch (err) {
        console.warn(`[OrdersPage] Could not fetch meta for ${tenantId}:`, err);
      }
    });
  }, [ordersMap, restaurantMeta]);

  // 3. Process and Categorize Orders
  const allOrdersList = useMemo(() => {
    const list = Object.values(ordersMap);
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [ordersMap]);

  // Active Orders: Orders currently in progress (not terminal and not paid)
  const activeOrders = useMemo(() => {
    return allOrdersList.filter(o => isOrderActive(o));
  }, [allOrdersList]);

  // Past Orders: Successfully completed, paid, or cancelled historical orders
  const pastOrders = useMemo(() => {
    return allOrdersList.filter(o => isOrderTerminal(o));
  }, [allOrdersList]);

  // Filtered list based on active tab and search filter
  const displayedOrders = useMemo(() => {
    let list = allOrdersList;
    if (activeTab === 'active') list = activeOrders;
    if (activeTab === 'past') list = pastOrders;

    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(o => {
        const orderIdMatch = (o.orderId || o.id || '').toLowerCase().includes(q);
        const nameMatch = (o.restaurantName || restaurantMeta[o.tenantId || '']?.name || '').toLowerCase().includes(q);
        const itemsMatch = o.items?.some(it => (it.name || '').toLowerCase().includes(q));
        return orderIdMatch || nameMatch || itemsMatch;
      });
    }

    return list;
  }, [allOrdersList, activeOrders, pastOrders, activeTab, searchFilter, restaurantMeta]);

  // Helpers
  const formatOrderTime = (isoString?: string) => {
    if (!isoString) return 'Recent order';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Recent order';
    }
  };

  const getStatusDisplay = (status?: string, paymentStatus?: string) => {
    const s = (status || 'NEW').toUpperCase();
    const p = (paymentStatus || 'pending').toLowerCase();
    const isPaid = p === 'paid';

    // 1. Determine Order / Food Lifecycle Label & Styling
    let label = 'Order Received';
    let bg = 'bg-blue-50 text-blue-800 border-blue-200';
    let dot = 'bg-blue-500';
    let pulse = false;

    if (s === 'CANCELLED') {
      label = 'Cancelled';
      bg = 'bg-rose-50 text-rose-800 border-rose-200';
      dot = 'bg-rose-500';
    } else if (s === 'COMPLETED' || s === 'CLOSED' || s === 'ARCHIVED') {
      label = '✓ Completed';
      bg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      dot = 'bg-[#2E8B57]';
    } else if (s === 'DINING_COMPLETED') {
      label = 'Dining Finished';
      bg = 'bg-amber-50 text-amber-900 border-amber-200';
      dot = 'bg-amber-500';
    } else if (s === 'BILL_REQUESTED') {
      label = 'Bill Requested';
      bg = 'bg-amber-50 text-amber-900 border-amber-200';
      dot = 'bg-amber-500';
      pulse = true;
    } else if (s === 'SERVED' || s === 'DELIVERED') {
      label = '✓ Served';
      bg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      dot = 'bg-[#2E8B57]';
    } else if (s === 'READY' || s === 'PICKED_UP') {
      label = '🟢 Ready to Serve';
      bg = 'bg-teal-50 text-teal-800 border-teal-200';
      dot = 'bg-teal-500';
      pulse = true;
    } else if (s === 'PREPARING' || s === 'CHEF_ASSIGNED' || s === 'COOKING') {
      label = '🍳 In Kitchen';
      bg = 'bg-[#F3E8DF] text-[#C85A3F] border-[#E5DCD5]';
      dot = 'bg-[#C85A3F]';
      pulse = true;
    } else if (s === 'ACCEPTED' || s === 'CONFIRMED') {
      label = 'Confirmed';
      bg = 'bg-blue-50 text-blue-800 border-blue-200';
      dot = 'bg-blue-500';
    } else {
      label = 'Order Received';
      bg = 'bg-blue-50 text-blue-800 border-blue-200';
      dot = 'bg-blue-500';
      pulse = true;
    }

    // 2. Determine Payment Lifecycle Label & Styling (Never display ambiguous "Completed")
    const paymentLabel = isPaid 
      ? '✓ Paid' 
      : p === 'refunded' 
      ? 'Refunded' 
      : '⚠ Payment Pending';

    const paymentBadge = isPaid
      ? 'bg-emerald-50 text-[#2E8B57] border-emerald-200'
      : p === 'refunded'
      ? 'bg-slate-50 text-slate-700 border-slate-200'
      : 'bg-amber-50 text-amber-800 border-amber-200';

    return {
      label,
      paymentLabel,
      bg,
      dot,
      paymentBadge,
      pulse
    };
  };

  if (isLoading && allOrdersList.length === 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 text-left select-none pb-16 py-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-8 w-44 bg-[#F3E8DF] rounded-xl" />
          <div className="h-4 w-72 bg-[#F3E8DF]/60 rounded-lg" />
        </div>
        <div className="h-12 bg-white border border-[#E5DCD5] rounded-2xl" />
        <div className="space-y-4 pt-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 bg-white border border-[#E5DCD5] rounded-3xl p-6" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left select-none pb-20 pt-2">
      
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#F3E8DF] text-[#C85A3F] border border-[#E5DCD5]">
            <Utensils className="w-3 h-3" />
            <span>Dining Journey</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-[#202124] tracking-tight">
            My Orders
          </h1>
          <p className="text-xs md:text-sm text-[#756B64] font-medium">
            Track active kitchen preparations and view dining receipt logs.
          </p>
        </div>

        {/* Live sync status pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E5DCD5] text-[11px] font-extrabold text-[#756B64] shadow-xs self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-[#2E8B57] animate-pulse" />
          <span>Real-time Live Sync</span>
        </div>
      </div>

      {/* 2. FILTER TABS & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2 border border-[#E5DCD5] rounded-2xl shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-[#C85A3F] text-white shadow-xs'
                : 'text-[#756B64] hover:bg-[#F3E8DF]/60 hover:text-[#202124]'
            }`}
          >
            All Orders ({allOrdersList.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-[#C85A3F] text-white shadow-xs'
                : 'text-[#756B64] hover:bg-[#F3E8DF]/60 hover:text-[#202124]'
            }`}
          >
            <span>Active</span>
            {activeOrders.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                activeTab === 'active' ? 'bg-white text-[#C85A3F]' : 'bg-[#F3E8DF] text-[#C85A3F]'
              }`}>
                {activeOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('past')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'past'
                ? 'bg-[#C85A3F] text-white shadow-xs'
                : 'text-[#756B64] hover:bg-[#F3E8DF]/60 hover:text-[#202124]'
            }`}
          >
            Past History ({pastOrders.length})
          </button>
        </div>

        {/* Search inside orders */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-[#756B64] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search dish or restaurant..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#FCFAF7] border border-[#E5DCD5] focus:border-[#C85A3F] rounded-xl text-xs text-[#202124] placeholder-[#756B64]/70 outline-none transition-colors"
          />
        </div>
      </div>

      {/* 3. ACTIVE ORDERS SPOTLIGHT (If tab is 'all' or 'active') */}
      {activeOrders.length > 0 && activeTab === 'all' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#C85A3F] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#C85A3F] animate-ping" />
              <span>In-Kitchen Live Orders ({activeOrders.length})</span>
            </h2>
            <span className="text-[11px] text-[#756B64] font-medium">Click order to track live kitchen status</span>
          </div>

          <div className="space-y-4">
            {activeOrders.map(order => {
              const targetTenant = order.tenantId || order.restaurantId || 'bawarchi-restaurant';
              const targetOrderId = order.orderId || order.id;
              const rName = order.restaurantName || restaurantMeta[targetTenant]?.name || targetTenant.replace(/-/g, ' ');
              const statusInfo = getStatusDisplay(order.status, order.paymentStatus);
              const rawTable = order.tableNumber || (order.tableId ? order.tableId.replace(/^TBL-/i, '') : '');
              const tableNum = rawTable && !String(rawTable).toLowerCase().includes('walk') ? `Table #${rawTable}` : 'Walk-in';

              return (
                <div
                  key={targetOrderId}
                  onClick={() => navigate(`/customer/restaurant/${targetTenant}/order/${targetOrderId}`)}
                  className="p-5 md:p-6 bg-gradient-to-r from-[#FFF8F2] via-white to-[#FFF8F2] border-2 border-[#C85A3F]/30 hover:border-[#C85A3F] rounded-3xl space-y-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-[#E5DCD5]">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-[#202124] capitalize group-hover:text-[#C85A3F] transition-colors">
                          {rName}
                        </h3>
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-[#F3E8DF] text-[#C85A3F] rounded-full border border-[#E5DCD5]">
                          {tableNum}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#756B64] font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#C85A3F]" />
                        <span>Order #{targetOrderId} · {formatOrderTime(order.createdAt)}</span>
                      </p>
                    </div>

                    {/* Status badges */}
                    <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${statusInfo.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} ${statusInfo.pulse ? 'animate-ping' : ''}`} />
                        <span>{statusInfo.label}</span>
                      </div>
                      {statusInfo.paymentLabel && (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.paymentBadge}`}>
                          {statusInfo.paymentLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items Preview */}
                  <div className="space-y-1.5">
                    {order.items && order.items.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {order.items.slice(0, 4).map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1 px-2.5 bg-white/80 border border-[#E5DCD5] rounded-xl font-medium text-[#202124]">
                            <span className="truncate max-w-[200px] font-bold">
                              {it.name} <span className="text-[#756B64] font-normal">x{it.count || it.quantity || 1}</span>
                            </span>
                            <span className="font-mono text-[11px] text-[#756B64] shrink-0">
                              {formatPrice((it.pricePerUnit || it.price || 0) * (it.count || it.quantity || 1))}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#756B64] italic">Dishes routed to kitchen prep queue</p>
                    )}
                    {order.items && order.items.length > 4 && (
                      <span className="text-[11px] text-[#C85A3F] font-bold block pt-0.5">
                        +{order.items.length - 4} more dish{order.items.length - 4 === 1 ? '' : 'es'}
                      </span>
                    )}
                  </div>

                  {/* Footer & CTA */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E5DCD5]">
                    <div>
                      <span className="text-[9px] text-[#756B64] font-extrabold uppercase tracking-wider block">Total Bill</span>
                      <strong className="text-lg font-extrabold text-[#202124]">
                        {formatPrice(order.total || order.totalAmount || 0)}
                      </strong>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/customer/restaurant/${targetTenant}/order/${targetOrderId}`);
                      }}
                      className="px-5 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-[#C85A3F]/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>{((order.paymentStatus || '').toLowerCase() !== 'paid' && ['SERVED', 'DELIVERED', 'DINING_COMPLETED', 'BILL_REQUESTED', 'COMPLETED'].includes((order.status || '').toUpperCase())) ? 'Pay Now' : ['SERVED', 'DINING_COMPLETED', 'BILL_REQUESTED'].includes((order.status || '').toUpperCase()) ? 'View Bill' : 'Track Live Status'}</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. ORDERS LIST (Based on Tab) */}
      <div className="space-y-4">
        {activeTab !== 'all' && (
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#756B64] flex items-center gap-1.5 px-1">
            <Calendar className="w-3.5 h-3.5 text-[#C85A3F]" />
            <span>
              {activeTab === 'active' ? `Active Orders (${activeOrders.length})` : `Past Orders History (${pastOrders.length})`}
            </span>
          </h2>
        )}

        {displayedOrders.length === 0 ? (
          <div className="p-12 text-center bg-white border border-[#E5DCD5] rounded-3xl space-y-4 shadow-xs">
            <div className="w-14 h-14 bg-[#F3E8DF] border border-[#E5DCD5] rounded-2xl flex items-center justify-center text-[#C85A3F] mx-auto shadow-2xs">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-extrabold text-[#202124]">
                {searchFilter ? 'No orders match your search' : 'No orders found'}
              </h3>
              <p className="text-xs text-[#756B64] leading-relaxed">
                {searchFilter 
                  ? 'Try searching with a different dish or restaurant keyword.'
                  : 'Your delicious food orders and dining history will appear right here.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {searchFilter ? (
                <button
                  onClick={() => setSearchFilter('')}
                  className="px-4 py-2 bg-[#F3E8DF] text-[#C85A3F] text-xs font-extrabold rounded-xl hover:bg-[#E5DCD5] transition-colors cursor-pointer"
                >
                  Clear Search Filter
                </button>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/customer/explore')}
                    className="px-5 py-2.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-xs font-extrabold rounded-xl transition-all shadow-md shadow-[#C85A3F]/20 cursor-pointer"
                  >
                    Explore Restaurants
                  </button>
                  <button
                    onClick={() => navigate('/customer/home')}
                    className="px-5 py-2.5 bg-white border border-[#E5DCD5] hover:border-[#C85A3F] text-[#202124] text-xs font-extrabold rounded-xl transition-all cursor-pointer"
                  >
                    Return Home
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* If tab is 'all', only show past orders in this sub-list since active are spotlighted above */}
            {(activeTab === 'all' ? pastOrders : displayedOrders).map(order => {
              const targetTenant = order.tenantId || order.restaurantId || 'bawarchi-restaurant';
              const targetOrderId = order.orderId || order.id;
              const rName = order.restaurantName || restaurantMeta[targetTenant]?.name || targetTenant.replace(/-/g, ' ');
              const statusInfo = getStatusDisplay(order.status, order.paymentStatus);
              const rawTable = order.tableNumber || (order.tableId ? order.tableId.replace(/^TBL-/i, '') : '');
              const tableNum = rawTable && !String(rawTable).toLowerCase().includes('walk') ? `Table #${rawTable}` : 'Walk-in';
              const isPaid = (order.paymentStatus || '').toLowerCase() === 'paid';
              const isCancelled = (order.status || '').toUpperCase() === 'CANCELLED';
              const orderIsActive = isOrderActive(order);
              const orderIsTerminal = isOrderTerminal(order);

              return (
                <div
                  key={targetOrderId}
                  onClick={() => {
                    if (orderIsTerminal && !isCancelled) {
                      navigate(`/customer/restaurant/${targetTenant}/order/${targetOrderId}?view=receipt`);
                    } else if (isCancelled) {
                      navigate(`/customer/restaurant/${targetTenant}/menu`);
                    } else {
                      navigate(`/customer/restaurant/${targetTenant}/order/${targetOrderId}`);
                    }
                  }}
                  className="p-4 sm:p-5 bg-white border border-[#E5DCD5] hover:border-[#C85A3F]/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:shadow-sm transition-all cursor-pointer group"
                >
                  {/* Left: Info & Items summary */}
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-extrabold text-[#202124] capitalize group-hover:text-[#C85A3F] transition-colors truncate">
                        {rName}
                      </h4>
                      <span className="text-[10px] bg-[#FCFAF7] border border-[#E5DCD5] px-2 py-0.5 rounded-full text-[#756B64] font-bold">
                        {tableNum}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                        <span>{statusInfo.label}</span>
                      </span>
                      {statusInfo.paymentLabel && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.paymentBadge}`}>
                          {statusInfo.paymentLabel}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#756B64] font-medium flex items-center space-x-2">
                      <span>Order #{targetOrderId}</span>
                      <span>•</span>
                      <span>{formatOrderTime(order.createdAt)}</span>
                      {order.items && order.items.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{order.items.length} item{order.items.length === 1 ? '' : 's'}</span>
                        </>
                      )}
                    </div>

                    {/* Dish names preview */}
                    {order.items && order.items.length > 0 && (
                      <p className="text-xs text-[#756B64] truncate max-w-lg font-normal">
                        {order.items.map(it => `${it.name} (x${it.count || it.quantity || 1})`).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Right: Price and Action Buttons */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E5DCD5]">
                    <span className="text-sm sm:text-base font-extrabold text-[#202124]">
                      {formatPrice(order.total || order.totalAmount || 0)}
                    </span>

                    <div className="flex items-center gap-2">
                      {orderIsActive ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/customer/restaurant/${targetTenant}/order/${targetOrderId}`);
                          }}
                          className="px-3 py-1.5 bg-[#C85A3F] hover:bg-[#A94332] text-white text-[11px] font-extrabold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <span>{((order.paymentStatus || '').toLowerCase() !== 'paid' && ['SERVED', 'DELIVERED', 'DINING_COMPLETED', 'BILL_REQUESTED', 'COMPLETED'].includes((order.status || '').toUpperCase())) ? 'Pay Now' : ['SERVED', 'DINING_COMPLETED'].includes((order.status || '').toUpperCase()) ? 'View Bill' : 'Track Live'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : orderIsTerminal && !isCancelled ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/customer/restaurant/${targetTenant}/order/${targetOrderId}`);
                            }}
                            className="px-3 py-1.5 bg-[#FFF8F2] border border-[#C85A3F]/30 hover:border-[#C85A3F] text-[#C85A3F] text-[11px] font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Star className="w-3 h-3 fill-[#C85A3F]" />
                            <span>Rate</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/customer/restaurant/${targetTenant}/order/${targetOrderId}?view=receipt`);
                            }}
                            className="px-3 py-1.5 bg-[#FCFAF7] border border-[#E5DCD5] hover:border-[#C85A3F]/50 text-[#202124] text-[11px] font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Receipt className="w-3 h-3 text-[#756B64]" />
                            <span>Receipt</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/customer/restaurant/${targetTenant}/menu`);
                            }}
                            className="px-3 py-1.5 bg-[#FFF8F2] border border-[#E5DCD5] hover:border-[#C85A3F]/40 text-[#C85A3F] text-[11px] font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3 text-[#C85A3F]" />
                            <span>Order Again</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/customer/restaurant/${targetTenant}/menu`);
                          }}
                          className="px-3 py-1.5 bg-[#FFF8F2] border border-[#E5DCD5] hover:border-[#C85A3F]/40 text-[#C85A3F] text-[11px] font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3 text-[#C85A3F]" />
                          <span>Order Again</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. BOTTOM REASSURANCE STRIP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-[#E5DCD5]">
        <div className="p-4 bg-white border border-[#E5DCD5] rounded-2xl flex items-start gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-[#F3E8DF] flex items-center justify-center shrink-0 text-[#C85A3F]">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#202124]">Fresh Preparation</h4>
            <p className="text-[11px] text-[#756B64] mt-0.5 leading-relaxed">
              Every dish prepared to order using quality kitchen ingredients.
            </p>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E5DCD5] rounded-2xl flex items-start gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-[#F3E8DF] flex items-center justify-center shrink-0 text-[#C85A3F]">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#202124]">Real-time Updates</h4>
            <p className="text-[11px] text-[#756B64] mt-0.5 leading-relaxed">
              Direct live sync between your phone and the kitchen display.
            </p>
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E5DCD5] rounded-2xl flex items-start gap-3 shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-[#F3E8DF] flex items-center justify-center shrink-0 text-[#C85A3F]">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#202124]">Contactless & Safe</h4>
            <p className="text-[11px] text-[#756B64] mt-0.5 leading-relaxed">
              Seamless digital ordering with transparent digital billing receipts.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default CustomerOrdersPage;
