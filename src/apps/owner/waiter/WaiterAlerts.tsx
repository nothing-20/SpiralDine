import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  limit,
  arrayUnion 
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { IServiceRequest, IOrder } from '../../../types';
import { formatPrice } from '../../../utils/format';
import toast from 'react-hot-toast';
import { billingService } from '../../../shared/services/billingService';
import CanonicalBillModal from '../../../shared/ui/billing/CanonicalBillModal';
import { 
  Coffee, 
  DollarSign, 
  User, 
  AlertTriangle, 
  Check, 
  Clock, 
  UtensilsCrossed, 
  Bell, 
  Trash2, 
  AlertOctagon,
  Users,
  CheckCircle,
  History,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Flame,
  XCircle,
  CheckCircle2
} from 'lucide-react';

type TAlertsTab = 'orders' | 'assistance' | 'history';

export const WaiterAlerts: React.FC = () => {
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TAlertsTab>('assistance');
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [activeAssistance, setActiveAssistance] = useState<any[]>([]);
  const [historyAssistance, setHistoryAssistance] = useState<any[]>([]);
  const [legacyRequests, setLegacyRequests] = useState<IServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBillOrder, setSelectedBillOrder] = useState<{ orderId: string; tableNumber: string; requestId?: string } | null>(null);
  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [isConfirmingCashId, setIsConfirmingCashId] = useState<string | null>(null);

  // Live ticking clock for Front of House service status
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Filters state
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // 1. Subscribe to Kitchen / Food Orders (Orders Queue)
  useEffect(() => {
    if (!user?.tenantId) return;

    const colRef = collection(db, 'restaurants', user.tenantId, 'orders');
    const qOrders = query(colRef, limit(50));

    const unsubscribe = onSnapshot(
      qOrders,
      (snapshot) => {
        const list: IOrder[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Keep active orders (placed, preparing, ready, served, dining)
          const st = (data.status || '').toUpperCase();
          if (st !== 'ARCHIVED' && st !== 'CANCELLED') {
            list.push({ ...data, orderId: data.orderId || docSnap.id } as IOrder);
          }
        });
        // Sort: READY first, then newer orders
        list.sort((a, b) => {
          if (a.status === 'READY' && b.status !== 'READY') return -1;
          if (b.status === 'READY' && a.status !== 'READY') return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setOrders(list);
        setIsLoading(false);
      },
      (error) => {
        console.error(error);
        toast.error('Failed to connect to kitchen orders stream.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // 2. Subscribe to Customer Assistance Requests (Assistance Queue + History)
  useEffect(() => {
    if (!user?.tenantId) return;

    const colRef = collection(db, 'restaurants', user.tenantId, 'waiterRequests');
    const qWaiterReq = query(colRef, limit(80));

    const unsubscribe = onSnapshot(
      qWaiterReq,
      (snapshot) => {
        const activeList: any[] = [];
        const histList: any[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Strict separation: Exclude food orders from customer assistance requests
          if (data.requestType === 'New Order Placed' || data.type === 'New Order Placed') {
            return;
          }

          const item = { id: docSnap.id, ...data };
          const status = (data.status || 'Pending').toLowerCase();

          if (status === 'completed' || status === 'cancelled' || status === 'rejected') {
            histList.push(item);
          } else {
            activeList.push(item);
          }
        });

        // Active sorted oldest first (urgent attention), History sorted newest first
        activeList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        histList.sort((a, b) => new Date(b.resolvedAt || b.createdAt).getTime() - new Date(a.resolvedAt || a.createdAt).getTime());

        setActiveAssistance(activeList);
        setHistoryAssistance(histList);
      },
      (error) => {
        console.error(error);
        toast.error('Failed to load customer assistance stream.');
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // 3. Subscribe to Legacy QR Table Alerts (for backwards compatibility)
  useEffect(() => {
    if (!user?.tenantId) return;

    const colRef = collection(db, 'restaurants', user.tenantId, 'requests');
    const qReq = query(colRef, limit(20));

    const unsubscribe = onSnapshot(
      qReq,
      (snapshot) => {
        const list: IServiceRequest[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as IServiceRequest);
        });
        setLegacyRequests(list);
      },
      (error) => {
        console.warn('Legacy requests listener warning:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // Combined Active Assistance stream (waiterRequests + legacyRequests)
  const combinedActiveAssistance = useMemo(() => {
    const list: any[] = [...activeAssistance];

    legacyRequests.forEach((r: any) => {
      if (r.type === 'New Order Placed' || r.requestType === 'New Order Placed') return;
      // Don't duplicate if already in waiterRequests
      const exists = list.some(a => a.id === r.id || (a.tableNumber === r.tableNumber && a.requestType === r.type));
      if (!exists) {
        list.push({
          id: r.id || `qr-${r.createdAt}`,
          orderId: r.orderId || '—',
          tableNumber: String(r.tableNumber),
          requestType: r.type || 'Need Waiter',
          priority: r.type === 'Bill' ? 'high' : 'normal',
          createdAt: r.createdAt,
          description: r.description || `Table QR alert: ${r.type}`,
          status: 'Pending',
          acceptedBy: 'Unassigned',
          rawType: 'qr_request'
        });
      }
    });

    return list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [activeAssistance, legacyRequests]);

  // ── Actions ────────────────────────────────────────────────────────
  const handleDeliverOrder = async (order: IOrder) => {
    if (!user?.tenantId) return;
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'orders', order.orderId);
      const timestamp = new Date().toISOString();
      const serverName = user.displayName || user.email || 'Waiter';
      const timelineEvent = {
        type: 'SERVED',
        title: 'Food Served to Table',
        description: `Delivered by Server ${serverName}`,
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
      console.error(e);
      toast.error('Failed to update order delivery status.');
    }
  };

  const handleAcceptAssistance = async (item: any) => {
    if (!user?.tenantId) return;
    try {
      if (item.rawType === 'qr_request') {
        toast.success(`Assistance claimed for Table ${item.tableNumber}`);
        return;
      }
      const docRef = doc(db, 'restaurants', user.tenantId, 'waiterRequests', item.id);
      await updateDoc(docRef, { 
        status: 'Accepted',
        acceptedBy: user.displayName || user.email || 'Waiter',
        acceptedAt: new Date().toISOString()
      });
      toast.success(`Assistance request for Table ${item.tableNumber} accepted.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to accept request.');
    }
  };

  const handleResolveAssistance = async (item: any) => {
    if (!user?.tenantId) return;
    try {
      if (item.rawType === 'qr_request') {
        const docRef = doc(db, 'restaurants', user.tenantId, 'requests', item.id);
        await deleteDoc(docRef);
        toast.success(`Assistance for Table ${item.tableNumber} resolved.`);
        return;
      }
      const docRef = doc(db, 'restaurants', user.tenantId, 'waiterRequests', item.id);
      await updateDoc(docRef, { 
        status: 'Completed',
        resolvedBy: user.displayName || user.email || 'Waiter',
        resolvedAt: new Date().toISOString()
      });
      toast.success(`Assistance for Table ${item.tableNumber} resolved.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to resolve request.');
    }
  };

  const handleCancelAssistance = async (item: any) => {
    if (!user?.tenantId) return;
    try {
      if (item.rawType === 'qr_request') {
        const docRef = doc(db, 'restaurants', user.tenantId, 'requests', item.id);
        await deleteDoc(docRef);
      } else {
        const docRef = doc(db, 'restaurants', user.tenantId, 'waiterRequests', item.id);
        await updateDoc(docRef, { 
          status: 'Cancelled',
          cancelledBy: user.displayName || user.email || 'Waiter',
          cancelledAt: new Date().toISOString()
        });
      }
      toast.success('Assistance request dismissed.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to dismiss request.');
    }
  };

  const handleConfirmCashReceived = async (item: any) => {
    if (!user?.tenantId) {
      toast.error('Restaurant context missing. Please re-login.');
      return;
    }
    const orderId = item.orderId || item.id.replace(/^CASH-/, '');
    const billId = item.billId || billingService.getCanonicalBillId(orderId);

    setIsConfirmingCashId(item.id);
    try {
      await billingService.settleBillPayment(user.tenantId, billId, {
        method: 'cash',
        transactionRef: `CASH-WAITER-${Date.now().toString(36).toUpperCase()}`,
        requestId: item.id,
        actor: {
          uid: user.uid || 'waiter',
          displayName: user.displayName || user.email || 'Staff Waiter',
          email: user.email || '',
          role: 'waiter'
        }
      });

      // Update waiterRequest doc to Completed
      try {
        const docRef = doc(db, 'restaurants', user.tenantId, 'waiterRequests', item.id);
        await updateDoc(docRef, {
          status: 'Completed',
          resolvedBy: user.displayName || user.email || 'Waiter',
          resolvedAt: new Date().toISOString()
        });
      } catch (_) {}

      // Immediately update local state without needing manual reload
      setActiveAssistance(prev => prev.filter(a => a.id !== item.id));
      setHistoryAssistance(prev => [{
        ...item,
        status: 'Completed',
        resolvedBy: user.displayName || user.email || 'Waiter',
        resolvedAt: new Date().toISOString()
      }, ...prev]);

      toast.success(`Cash payment confirmed for Table ${item.tableNumber}! Bill settled.`, { icon: '✅' });
    } catch (err: any) {
      console.error('[WaiterAlerts] Cash confirmation error:', err);
      toast.error(err.message || 'Failed to confirm cash payment.');
    } finally {
      setIsConfirmingCashId(null);
    }
  };

  const handleEscalateAssistance = async (item: any) => {
    if (!user?.tenantId) return;
    try {
      const docRef = collection(db, 'restaurants', user.tenantId, 'waiterRequests');
      await addDoc(docRef, {
        tenantId: user.tenantId,
        tableNumber: Number(item.tableNumber) || item.tableNumber,
        requestType: 'Manager Call',
        status: 'Pending',
        priority: 'critical',
        createdAt: new Date().toISOString(),
        description: `CRITICAL ESCALATION for Table ${item.tableNumber}: ${item.requestType}`,
        acceptedBy: '',
        resolvedAt: '',
        orderId: item.orderId || '—'
      });
      toast.success('Escalated to manager console.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to escalate request.');
    }
  };

  // ── Derived Filter Lists ──────────────────────────────────────────
  const uniqueTables = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => o.tableNumber && set.add(String(o.tableNumber)));
    combinedActiveAssistance.forEach(a => a.tableNumber && set.add(String(a.tableNumber)));
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [orders, combinedActiveAssistance]);

  const uniqueAssistanceTypes = useMemo(() => {
    const set = new Set<string>();
    combinedActiveAssistance.forEach(a => set.add(a.requestType || a.type));
    return Array.from(set).sort();
  }, [combinedActiveAssistance]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesTable = filterTable === 'all' || String(o.tableNumber) === filterTable;
      const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
      return matchesTable && matchesStatus;
    });
  }, [orders, filterTable, filterStatus]);

  // Filtered Assistance
  const filteredAssistance = useMemo(() => {
    return combinedActiveAssistance.filter(a => {
      const p = (a.priority || 'normal').toLowerCase();
      const matchesPriority = filterPriority === 'all' || p === filterPriority;
      const matchesTable = filterTable === 'all' || String(a.tableNumber) === filterTable;
      const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
      const matchesType = filterType === 'all' || (a.requestType || a.type) === filterType;
      return matchesPriority && matchesTable && matchesStatus && matchesType;
    });
  }, [combinedActiveAssistance, filterPriority, filterTable, filterStatus, filterType]);

  // Metrics
  const readyOrdersCount = orders.filter(o => o.status === 'READY').length;
  const activeAssistanceCount = combinedActiveAssistance.length;
  const activeTablesCount = uniqueTables.length;
  const pendingBillsCount = combinedActiveAssistance.filter(a => 
    (a.requestType || a.type || '').toLowerCase().includes('bill')
  ).length;

  const getMinutesElapsed = (isoStr: string) => {
    if (!isoStr) return 'Just now';
    const diff = (Date.now() - new Date(isoStr).getTime()) / 60000;
    if (diff < 1) return 'Just now';
    return `${Math.round(diff)}m ago`;
  };

  const getAssistanceIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('cash')) return <DollarSign className="w-4 h-4 text-[#2E8B57]" />;
    if (t.includes('water')) return <Coffee className="w-4 h-4 text-[#287A55]" />;
    if (t.includes('bill')) return <DollarSign className="w-4 h-4 text-[#287A55]" />;
    if (t.includes('plate') || t.includes('cutlery') || t.includes('spoon')) return <UtensilsCrossed className="w-4 h-4 text-[#D79A24]" />;
    if (t.includes('manager') || t.includes('emergency')) return <AlertOctagon className="w-4 h-4 text-[#C7463A]" />;
    return <Bell className="w-4 h-4 text-[#D79A24]" />;
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
              Service Desk
            </h1>
            <p className="text-xs md:text-sm text-[#5F6762] mt-1 font-normal font-sans">
              Separated operations for food delivery and customer assistance.
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
              <span>Service Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Service Operational Metrics Row ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 select-none font-sans">
        {/* Kitchen Ready Orders */}
        <div 
          onClick={() => setActiveTab('orders')}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all cursor-pointer ${
            activeTab === 'orders' ? 'border-[#C84A38] ring-2 ring-[#C84A38]/15' : 'border-[#E3DED5] hover:border-[#D1C9BC]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Food Orders
            </span>
            <div className="w-6 h-6 rounded-md bg-[#F9E8E4] flex items-center justify-center text-[#C84A38]">
              <UtensilsCrossed className="w-3.5 h-3.5 text-[#C84A38]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#18201D] tabular-nums tracking-tight font-sans">
              {readyOrdersCount}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">Ready for table delivery</p>
          </div>
        </div>

        {/* Customer Assistance Requests */}
        <div 
          onClick={() => setActiveTab('assistance')}
          className={`bg-white border rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all cursor-pointer ${
            activeTab === 'assistance' ? 'border-[#287A55] ring-2 ring-[#287A55]/15' : 'border-[#E3DED5] hover:border-[#D1C9BC]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Assistance Requests
            </span>
            <div className="w-6 h-6 rounded-md bg-[#E8F3ED] flex items-center justify-center text-[#287A55]">
              <Bell className="w-3.5 h-3.5 text-[#287A55]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#18201D] tabular-nums tracking-tight font-sans">
              {activeAssistanceCount}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">Active service calls</p>
          </div>
        </div>

        {/* Bill Requests */}
        <div 
          onClick={() => setActiveTab('assistance')}
          className="bg-white border border-[#E3DED5] rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between hover:border-[#D1C9BC] transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Bill Invoices
            </span>
            <div className="w-6 h-6 rounded-md bg-[#F7F4EE] flex items-center justify-center text-[#287A55]">
              <DollarSign className="w-3.5 h-3.5 text-[#287A55]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#18201D] tabular-nums tracking-tight font-sans">
              {pendingBillsCount}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">Checkout requests</p>
          </div>
        </div>

        {/* Active Tables */}
        <div className="bg-white border border-[#E3DED5] rounded-xl p-4 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between hover:border-[#D1C9BC] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-[#5F6762] tracking-wide uppercase">
              Active Tables
            </span>
            <div className="w-6 h-6 rounded-md bg-[#F7F4EE] flex items-center justify-center text-[#18201D]">
              <Users className="w-3.5 h-3.5 text-[#18201D]" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-[#18201D] tabular-nums tracking-tight font-sans">
              {activeTablesCount}
            </div>
            <p className="text-xs text-[#5F6762] mt-1 font-medium">In dining floor</p>
          </div>
        </div>
      </div>

      {/* ── 3. STRICT OPERATIONAL SEPARATION TABS ────────────────────── */}
      <div className="bg-[#F7F4EE] border border-[#E3DED5] p-1.5 rounded-2xl flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center space-x-1.5">
          {/* ORDERS QUEUE TAB */}
          <button
            onClick={() => {
              setActiveTab('orders');
              setFilterStatus('all');
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all border outline-none cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-white border-[#E3DED5] text-[#C84A38] shadow-xs'
                : 'text-[#5F6875] border-transparent hover:text-[#18201D] hover:bg-white/60'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-[#C84A38]" />
            <span>Customer Food Orders</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'orders' ? 'bg-[#F9E8E4] text-[#C84A38]' : 'bg-[#E3DED5] text-[#5F6762]'
            }`}>
              {orders.length}
            </span>
          </button>

          {/* ASSISTANCE QUEUE TAB */}
          <button
            onClick={() => {
              setActiveTab('assistance');
              setFilterStatus('all');
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all border outline-none cursor-pointer ${
              activeTab === 'assistance'
                ? 'bg-white border-[#E3DED5] text-[#287A55] shadow-xs'
                : 'text-[#5F6875] border-transparent hover:text-[#18201D] hover:bg-white/60'
            }`}
          >
            <Bell className="w-4 h-4 text-[#287A55]" />
            <span>Customer Assistance</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeAssistanceCount > 0 ? 'bg-[#E8F3ED] text-[#287A55] ring-1 ring-[#287A55]/30' : 'bg-[#E3DED5] text-[#5F6762]'
            }`}>
              {activeAssistanceCount}
            </span>
          </button>

          {/* ASSISTANCE HISTORY TAB */}
          <button
            onClick={() => {
              setActiveTab('history');
              setFilterStatus('all');
            }}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all border outline-none cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white border-[#E3DED5] text-[#18201D] shadow-xs'
                : 'text-[#5F6875] border-transparent hover:text-[#18201D] hover:bg-white/60'
            }`}
          >
            <History className="w-4 h-4 text-[#5F6762]" />
            <span>Assistance History</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E3DED5] text-[#5F6762]">
              {historyAssistance.length}
            </span>
          </button>
        </div>

        <span className="hidden sm:inline-block text-[11px] font-bold uppercase tracking-wider text-[#5F6762] px-3">
          {activeTab === 'orders' ? 'Food & Drink Transactions' : activeTab === 'assistance' ? 'Table Service & Help' : 'Completed Log'}
        </span>
      </div>

      {/* ── 4. Filter Toolbar ─────────────────────────────────────────── */}
      <div className="bg-white border border-[#E3DED5] rounded-xl p-4 shadow-[0_1px_3px_rgba(30,30,20,0.04)] grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-[#5F6762] font-extrabold uppercase tracking-wider">Table</label>
          <select
            value={filterTable}
            onChange={e => setFilterTable(e.target.value)}
            className="w-full bg-[#F7F4EE] border border-[#E3DED5] rounded-lg px-3 py-2 text-xs font-semibold text-[#18201D] outline-none cursor-pointer focus:border-[#13241F]"
          >
            <option value="all">All Tables</option>
            {uniqueTables.map(num => (
              <option key={num} value={num}>Table {num}</option>
            ))}
          </select>
        </div>

        {activeTab === 'orders' ? (
          <div className="space-y-1">
            <label className="text-[10px] text-[#5F6762] font-extrabold uppercase tracking-wider">Order Status</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full bg-[#F7F4EE] border border-[#E3DED5] rounded-lg px-3 py-2 text-xs font-semibold text-[#18201D] outline-none cursor-pointer focus:border-[#13241F]"
            >
              <option value="all">All Order Statuses</option>
              <option value="READY">🍳 READY (Kitchen Pickup)</option>
              <option value="PREPARING">🔥 PREPARING (Cooking)</option>
              <option value="ACCEPTED">✅ ACCEPTED</option>
              <option value="DELIVERED">🍽️ DELIVERED</option>
              <option value="SERVED">✨ SERVED</option>
            </select>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-[10px] text-[#5F6762] font-extrabold uppercase tracking-wider">Priority</label>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="w-full bg-[#F7F4EE] border border-[#E3DED5] rounded-lg px-3 py-2 text-xs font-semibold text-[#18201D] outline-none cursor-pointer focus:border-[#13241F]"
              >
                <option value="all">All Priorities</option>
                <option value="critical">💥 Critical (Emergency/Manager)</option>
                <option value="high">🔴 High (Bill/Invoice)</option>
                <option value="normal">🟢 Normal (Water, Plates, Cutlery)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-[#5F6762] font-extrabold uppercase tracking-wider">Request Type</label>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="w-full bg-[#F7F4EE] border border-[#E3DED5] rounded-lg px-3 py-2 text-xs font-semibold text-[#18201D] outline-none cursor-pointer focus:border-[#13241F]"
              >
                <option value="all">All Assistance Types</option>
                {uniqueAssistanceTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      {/* ── 5. QUEUE CONTENT RENDERING ────────────────────────────────── */}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* QUEUE 1: CUSTOMER FOOD ORDERS                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl md:text-2xl font-bold text-[#18201D] tracking-tight">
                Customer Food Orders
              </h2>
              <p className="text-xs text-[#5F6762] mt-0.5">
                Food and drink transactions dispatched from kitchen.
              </p>
            </div>
            <span className="text-xs font-semibold text-[#5F6762] bg-white border border-[#E3DED5] px-3 py-1 rounded-lg">
              Showing <strong className="text-[#18201D]">{filteredOrders.length}</strong> food orders
            </span>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-[#E3DED5] rounded-2xl p-12 text-center shadow-[0_1px_3px_rgba(30,30,20,0.04)]">
              <UtensilsCrossed className="w-8 h-8 text-[#5F6762] mx-auto mb-2.5 opacity-60" />
              <h3 className="font-serif text-base font-bold text-[#18201D]">No Food Orders Found</h3>
              <p className="text-xs text-[#5F6762] mt-0.5">There are no orders matching the selected filter criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {filteredOrders.map(order => {
                const isReady = order.status === 'READY';
                const isDelivered = order.status === 'DELIVERED' || order.status === 'SERVED';
                const isPreparing = order.status === 'PREPARING';
                const elapsed = getMinutesElapsed(order.updatedAt || order.createdAt);

                return (
                  <div
                    key={order.orderId}
                    className={`bg-white border rounded-2xl p-5 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all text-left font-sans ${
                      isReady 
                        ? 'border-[#C84A38] border-t-4 ring-2 ring-[#C84A38]/10' 
                        : 'border-[#E3DED5] hover:border-[#D1C9BC]'
                    }`}
                  >
                    <div className="space-y-3.5">
                      {/* Top Header: Table Number + Order Status */}
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
                            Customer: {order.customerName || 'Dine-In Guest'}
                          </span>
                        </div>

                        {/* Kitchen Status Badge */}
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0 ${
                          isReady 
                            ? 'bg-[#F9E8E4] text-[#C84A38] border-[#C84A38]/30 font-extrabold animate-pulse'
                            : isPreparing
                            ? 'bg-[#F8EED8] text-[#D79A24] border-[#D79A24]/30 font-bold'
                            : isDelivered
                            ? 'bg-[#E8F3ED] text-[#287A55] border-[#287A55]/30'
                            : 'bg-[#F7F4EE] text-[#5F6762] border-[#E3DED5]'
                        }`}>
                          {isReady ? '🍳 Ready for Table' : order.status}
                        </span>
                      </div>

                      {/* Items & Quantities List */}
                      <div className="bg-[#FCFAF7] border border-[#E3DED5] rounded-xl p-3 space-y-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F6762] block">
                          Ordered Items ({order.items?.length || 0})
                        </span>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="font-medium text-[#18201D] truncate mr-2">
                                <strong className="text-[#C84A38] font-bold mr-1.5">{item.count || item.quantity}×</strong>
                                {item.name || item.itemName}
                              </span>
                              <span className="text-[11px] font-mono text-[#5F6762] shrink-0">
                                {item.pricePerUnit ? formatPrice((item.pricePerUnit || 0) * (item.count || 1)) : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Special Instructions / Notes */}
                      {(order.notes || order.customerNotes || order.kitchenNotes || (order as any).specialInstructions) && (
                        <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-amber-900">
                          <strong className="block text-[10px] uppercase font-bold text-amber-800">Special Instructions / Notes:</strong>
                          <p className="mt-0.5 italic">"{order.notes || order.customerNotes || order.kitchenNotes || (order as any).specialInstructions}"</p>
                        </div>
                      )}

                      {/* Financial & Elapsed Summary */}
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
                          className="w-full py-2.5 bg-[#C84A38] hover:bg-[#A93928] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Deliver Food to Table {order.tableNumber}</span>
                        </button>
                      ) : (
                        <div className="w-full py-2 bg-[#F7F4EE] border border-[#E3DED5] rounded-xl text-center text-xs font-semibold text-[#5F6762]">
                          {isDelivered ? '✅ Delivered to Table' : `Status: ${order.status}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* QUEUE 2: CUSTOMER ASSISTANCE REQUESTS                            */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'assistance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl md:text-2xl font-bold text-[#18201D] tracking-tight">
                Customer Assistance Requests
              </h2>
              <p className="text-xs text-[#5F6762] mt-0.5">
                Active service requests: water, plates, cutlery, condiments, bills, table cleaning.
              </p>
            </div>
            <span className="text-xs font-semibold text-[#5F6762] bg-white border border-[#E3DED5] px-3 py-1 rounded-lg">
              Showing <strong className="text-[#18201D]">{filteredAssistance.length}</strong> active requests
            </span>
          </div>

          {filteredAssistance.length === 0 ? (
            <div className="bg-white border border-[#E3DED5] rounded-2xl p-12 text-center shadow-[0_1px_3px_rgba(30,30,20,0.04)]">
              <CheckCircle className="w-8 h-8 text-[#287A55] mx-auto mb-2.5 opacity-80" />
              <h3 className="font-serif text-base font-bold text-[#18201D]">All Tables Assisted</h3>
              <p className="text-xs text-[#5F6762] mt-0.5">No pending customer assistance calls right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {filteredAssistance.map(item => {
                const reqType = item.requestType || item.type || 'Assistance';
                const isBill = reqType.toLowerCase().includes('bill');
                const isAccepted = item.status === 'Accepted';
                const priority = (item.priority || (isBill ? 'high' : 'normal')).toLowerCase();
                const isCritical = priority === 'critical';
                const isHigh = priority === 'high';

                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-2xl p-5 shadow-[0_2px_10px_rgba(30,30,20,0.06)] flex flex-col justify-between transition-all text-left font-sans ${
                      isCritical
                        ? 'border-t-4 border-t-[#C7463A] border-[#E3DED5]'
                        : isHigh
                        ? 'border-t-4 border-t-[#D79A24] border-[#E3DED5]'
                        : 'border-t-4 border-t-[#287A55] border-[#E3DED5]'
                    }`}
                  >
                    <div className="space-y-3.5">
                      {/* Top Header: Table + Icon + Type + Priority */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-start space-x-3 min-w-0">
                          <div className={`p-2.5 rounded-xl border shrink-0 ${
                            isBill 
                              ? 'bg-[#E8F3ED] border-[#287A55]/30 text-[#287A55]' 
                              : isCritical 
                              ? 'bg-[#F9E8E4] border-[#C7463A]/30 text-[#C7463A]' 
                              : 'bg-[#FBF9F5] border-[#E3DED5] text-[#18201D]'
                          }`}>
                            {getAssistanceIcon(reqType)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <span className="font-bold text-base md:text-lg text-[#18201D] tracking-tight">
                                TABLE {item.tableNumber}
                              </span>
                              <span className="text-[10px] font-mono text-[#5F6762] bg-[#F7F4EE] px-1.5 py-0.5 rounded border border-[#E3DED5]">
                                {item.id.substring(0, 10)}
                              </span>
                            </div>
                            <h4 className="text-sm font-extrabold text-[#18201D] truncate mt-0.5">
                              {reqType}
                            </h4>
                          </div>
                        </div>

                        {/* Priority Badge */}
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 border ${
                          isCritical
                            ? 'bg-[#F9E8E4] text-[#C7463A] border-[#C7463A]/30 font-black'
                            : isHigh
                            ? 'bg-[#F8EED8] text-[#D79A24] border-[#D79A24]/30'
                            : 'bg-[#E8F3ED] text-[#287A55] border-[#287A55]/30'
                        }`}>
                          {priority}
                        </span>
                      </div>

                      {/* Customer Message / Description */}
                      <div className="bg-[#FCFAF7] border border-[#E3DED5] rounded-xl p-3 text-xs text-[#18201D]">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#5F6762] block mb-1">
                          Request Details
                        </span>
                        <p className="font-medium leading-relaxed">
                          {item.description || `Customer at Table ${item.tableNumber} requested ${reqType}.`}
                        </p>
                      </div>

                      {/* Lifecycle Status & Server Assignment */}
                      <div className="grid grid-cols-2 gap-2 text-xs border-t border-[#F7F4EE] pt-2">
                        <div>
                          <span className="text-[10px] font-bold text-[#5F6762] uppercase block">Status</span>
                          <span className={`inline-block font-extrabold text-xs mt-0.5 ${
                            isAccepted ? 'text-[#287A55]' : 'text-[#D79A24]'
                          }`}>
                            {isAccepted ? '● Accepted' : '● Requested (Pending)'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-[#5F6762] uppercase block">Assigned Staff</span>
                          <span className="font-semibold text-xs text-[#18201D] mt-0.5 block truncate">
                            {item.acceptedBy || 'Unassigned'}
                          </span>
                        </div>
                      </div>

                      {/* Time Requested */}
                      <div className="flex items-center space-x-1.5 text-[11px] text-[#5F6762]">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Requested {getMinutesElapsed(item.createdAt)}</span>
                      </div>
                    </div>

                    {/* Assistance Lifecycle Action Controls */}
                    <div className="flex items-center gap-2 pt-4 mt-3 border-t border-[#E3DED5]">
                      {reqType.toLowerCase().includes('cash') ? (
                        <>
                          <button
                            onClick={() => handleConfirmCashReceived(item)}
                            disabled={isConfirmingCashId === item.id}
                            className="flex-1 py-2.5 bg-[#2E8B57] hover:bg-[#246B43] text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isConfirmingCashId === item.id ? 'Settling...' : 'Confirm Cash Received'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedBillOrder({ 
                                orderId: item.orderId || item.id.replace(/^CASH-/, ''), 
                                tableNumber: item.tableNumber,
                                requestId: item.id
                              });
                              setIsBillModalOpen(true);
                            }}
                            className="py-2.5 px-3 bg-white hover:bg-[#F3E8DF] border border-[#E5DCD5] text-[#202124] text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                            title="Open Bill"
                          >
                            <span>View Bill</span>
                          </button>
                        </>
                      ) : (
                        <>
                          {!isAccepted ? (
                            <button
                              onClick={() => handleAcceptAssistance(item)}
                              className="flex-1 py-2 bg-[#287A55] hover:bg-[#206345] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Accept</span>
                            </button>
                          ) : null}

                          <button
                            onClick={() => handleResolveAssistance(item)}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all text-center cursor-pointer ${
                              isAccepted
                                ? 'bg-[#287A55] hover:bg-[#206345] text-white shadow-sm'
                                : 'bg-white hover:bg-[#E8F3ED] text-[#287A55] border border-[#287A55]'
                            }`}
                          >
                            Resolve
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => handleEscalateAssistance(item)}
                        className="py-2 px-3 bg-[#F9E8E4] hover:bg-[#F2D7D2] border border-[#E3DED5] text-[#C7463A] text-xs font-bold rounded-xl transition-all text-center cursor-pointer"
                        title="Escalate to Manager"
                      >
                        Escalate
                      </button>

                      <button
                        onClick={() => handleCancelAssistance(item)}
                        className="p-2 bg-white hover:bg-[#F9E8E4] border border-[#E3DED5] text-[#5F6762] hover:text-[#C7463A] rounded-xl transition-all shrink-0 cursor-pointer"
                        title="Dismiss / Cancel"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* QUEUE 3: ASSISTANCE HISTORY (RESOLVED REQUESTS)                  */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl md:text-2xl font-bold text-[#18201D] tracking-tight">
                Assistance History
              </h2>
              <p className="text-xs text-[#5F6762] mt-0.5">
                Archived log of resolved and completed customer assistance requests.
              </p>
            </div>
            <span className="text-xs font-semibold text-[#5F6762] bg-white border border-[#E3DED5] px-3 py-1 rounded-lg">
              Total Logged: <strong className="text-[#18201D]">{historyAssistance.length}</strong>
            </span>
          </div>

          {historyAssistance.length === 0 ? (
            <div className="bg-white border border-[#E3DED5] rounded-2xl p-12 text-center shadow-[0_1px_3px_rgba(30,30,20,0.04)]">
              <History className="w-8 h-8 text-[#5F6762] mx-auto mb-2.5 opacity-60" />
              <h3 className="font-serif text-base font-bold text-[#18201D]">No History Records</h3>
              <p className="text-xs text-[#5F6762] mt-0.5">Resolved requests will appear here after completion.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E3DED5] rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F7F4EE] border-b border-[#E3DED5] text-[#5F6762] font-bold uppercase text-[10px]">
                      <th className="p-3.5">Request</th>
                      <th className="p-3.5">Table</th>
                      <th className="p-3.5">Customer / Device</th>
                      <th className="p-3.5">Assigned Waiter</th>
                      <th className="p-3.5">Requested</th>
                      <th className="p-3.5">Resolved</th>
                      <th className="p-3.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3DED5]/60 font-medium">
                    {historyAssistance.map((item) => {
                      const isCancelled = item.status?.toLowerCase() === 'cancelled';
                      return (
                        <tr key={item.id} className="hover:bg-[#FCFAF7] transition-all">
                          <td className="p-3.5">
                            <span className="font-bold text-[#18201D] block">{item.requestType || item.type}</span>
                            <span className="text-[10px] text-[#5F6762] font-mono">{item.id.substring(0, 10)}</span>
                          </td>
                          <td className="p-3.5">
                            <span className="font-extrabold text-[#18201D] bg-[#F7F4EE] border border-[#E3DED5] px-2 py-0.5 rounded">
                              Table {item.tableNumber}
                            </span>
                          </td>
                          <td className="p-3.5 text-[#5F6762]">
                            {item.customerId || item.deviceId || 'Diner'}
                          </td>
                          <td className="p-3.5 text-[#18201D] font-semibold">
                            {item.resolvedBy || item.acceptedBy || 'Staff'}
                          </td>
                          <td className="p-3.5 text-[#5F6762]">
                            {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-3.5 text-[#5F6762]">
                            {item.resolvedAt ? new Date(item.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </td>
                          <td className="p-3.5 text-right">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isCancelled
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-[#287A55] border-emerald-200'
                            }`}>
                              {item.status || 'Completed'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Canonical Bill Modal for Waiter */}
      {selectedBillOrder && isBillModalOpen && user?.tenantId && (
        <CanonicalBillModal
          isOpen={isBillModalOpen}
          onClose={() => {
            setIsBillModalOpen(false);
            setSelectedBillOrder(null);
          }}
          tenantId={user.tenantId}
          orderId={selectedBillOrder.orderId}
          requestId={selectedBillOrder.requestId}
          mode="waiter"
          restaurantName="Spiral Dine"
          onPaymentSettled={(_settledBill) => {
            // Immediate real-time update: remove from active assistance and add to history
            setActiveAssistance(prev => prev.filter(a => 
              a.id !== selectedBillOrder.requestId &&
              a.orderId !== selectedBillOrder.orderId &&
              a.id !== `CASH-${selectedBillOrder.orderId}`
            ));
            setHistoryAssistance(prev => [{
              id: selectedBillOrder.requestId || `CASH-${selectedBillOrder.orderId}`,
              orderId: selectedBillOrder.orderId,
              tableNumber: selectedBillOrder.tableNumber,
              requestType: 'Cash Payment',
              status: 'Completed',
              resolvedBy: user?.displayName || user?.email || 'Waiter',
              resolvedAt: new Date().toISOString(),
              createdAt: new Date().toISOString()
            }, ...prev]);
          }}
        />
      )}

    </div>
  );
};

export default WaiterAlerts;
