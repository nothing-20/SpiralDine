import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Receipt, 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Percent, 
  Lock, 
  Unlock, 
  Search, 
  RefreshCw, 
  FileText, 
  Printer, 
  Share2, 
  AlertCircle,
  X,
  PlusCircle,
  Check,
  RotateCcw
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  doc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../../../../shared/firebase/config';
import { useAuth } from '../../../../context/AuthContext';
import { useCurrency } from '../../../../context/CurrencyContext';
import MobileLoadingSkeleton from '../components/MobileLoadingSkeleton';
import MobileEmptyState from '../components/MobileEmptyState';

export const MobileBilling: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { formatCurrency, formatPrice, currencySymbol } = useCurrency();
  const tenantId = user?.tenantId;

  // Real-time collections
  const [orders, setOrders] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active section tab
  // 'queue' | 'open' | 'paid' | 'refunds' | 'transactions' | 'shifts' | 'summary'
  const [activeTab, setActiveTab] = useState<string>('queue');
  const [searchQuery, setSearchQuery] = useState('');

  // Shift Drawer States
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('500');
  const [openingNotes, setOpeningNotes] = useState('Standard morning float');
  const [closingCash, setClosingCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [shiftSaving, setShiftSaving] = useState(false);

  // Settle Bill Modal
  const [billToSettle, setBillToSettle] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('upi');
  const [settling, setSettling] = useState(false);

  // Refund Modal
  const [billToRefund, setBillToRefund] = useState<any | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('Customer dissatisfaction');
  const [refunding, setRefunding] = useState(false);

  // Receipt Modal
  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);

  // Listen to Firestore
  useEffect(() => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const ordersCol = collection(db, 'restaurants', tenantId, 'orders');
    const qOrders = query(ordersCol, orderBy('createdAt', 'desc'), limit(100));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setOrders(list);
      setLoading(false);
    }, (err) => {
      console.warn('[MobileBilling] Orders snapshot warning:', err);
      setLoading(false);
    });

    const shiftsCol = collection(db, 'restaurants', tenantId, 'shifts');
    const qShifts = query(shiftsCol, orderBy('openedAt', 'desc'), limit(20));
    const unsubShifts = onSnapshot(qShifts, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setShifts(list);
    });

    const refundsCol = collection(db, 'restaurants', tenantId, 'refunds');
    const qRefunds = query(refundsCol, orderBy('createdAt', 'desc'), limit(50));
    const unsubRefunds = onSnapshot(qRefunds, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setRefunds(list);
    });

    return () => {
      unsubOrders();
      unsubShifts();
      unsubRefunds();
    };
  }, [tenantId]);

  // Current active shift
  const activeShift = useMemo(() => {
    return shifts.find((s) => s.status === 'open' || !s.closedAt) || null;
  }, [shifts]);

  // Financial KPIs
  const metrics = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let todayRev = 0;
    let todayTax = 0;
    let todayDiscounts = 0;
    let paidCount = 0;

    orders.forEach((o) => {
      const createdDay = (o.createdAt || '').slice(0, 10);
      const isPaid = o.paymentStatus === 'paid' || o.isPaid === true;

      if (createdDay === today && isPaid) {
        const total = Number(o.total || o.totalAmount || 0);
        const tax = Number(o.tax || o.taxes || total * 0.05);
        const discount = Number(o.discount || o.discounts || 0);

        todayRev += total;
        todayTax += tax;
        todayDiscounts += discount;
        paidCount++;
      }
    });

    const avgBill = paidCount > 0 ? todayRev / paidCount : 0;

    return {
      todayRev,
      todayTax,
      todayDiscounts,
      avgBill,
      paidCount,
    };
  }, [orders]);

  // Categorized order sections
  const queueOrders = useMemo(() => {
    return orders.filter((o) => {
      const isPaid = o.paymentStatus === 'paid' || o.isPaid === true;
      const status = (o.status || '').toLowerCase();
      return !isPaid && status !== 'cancelled' && status !== 'refunded';
    });
  }, [orders]);

  const paidOrders = useMemo(() => {
    return orders.filter((o) => o.paymentStatus === 'paid' || o.isPaid === true);
  }, [orders]);

  // Filtered by current tab and search
  const displayedOrders = useMemo(() => {
    let baseList = orders;
    if (activeTab === 'queue' || activeTab === 'open') {
      baseList = queueOrders;
    } else if (activeTab === 'paid') {
      baseList = paidOrders;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return baseList.filter((o) => {
        const num = String(o.orderNumber || o.id).toLowerCase();
        const table = String(o.tableNumber || '').toLowerCase();
        const customer = String(o.customerName || '').toLowerCase();
        return num.includes(q) || table.includes(q) || customer.includes(q);
      });
    }

    return baseList;
  }, [orders, activeTab, queueOrders, paidOrders, searchQuery]);

  // Open shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    setShiftSaving(true);
    try {
      const sId = `shift-${Date.now()}`;
      await setDoc(doc(db, 'restaurants', tenantId, 'shifts', sId), {
        id: sId,
        cashierName: user?.email?.split('@')[0] || 'Manager',
        openedAt: new Date().toISOString(),
        openingCash: Number(openingCash) || 0,
        notes: openingNotes.trim(),
        status: 'open',
        tenantId,
      });
      setShowOpenShiftModal(false);
    } catch (err) {
      console.error('[MobileBilling] Open shift error:', err);
    } finally {
      setShiftSaving(false);
    }
  };

  // Close shift
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !activeShift) return;

    setShiftSaving(true);
    try {
      const actual = Number(closingCash) || 0;
      const expected = (Number(activeShift.openingCash) || 0) + metrics.todayRev;
      const variance = actual - expected;

      await updateDoc(doc(db, 'restaurants', tenantId, 'shifts', activeShift.id), {
        closedAt: new Date().toISOString(),
        actualCash: actual,
        expectedCash: expected,
        variance,
        closingNotes: closingNotes.trim(),
        status: 'closed',
        totalSales: metrics.todayRev,
        orderCount: metrics.paidCount,
      });
      setShowCloseShiftModal(false);
    } catch (err) {
      console.error('[MobileBilling] Close shift error:', err);
    } finally {
      setShiftSaving(false);
    }
  };

  // Settle bill
  const handleSettleBill = async () => {
    if (!tenantId || !billToSettle) return;

    setSettling(true);
    try {
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', billToSettle.id);
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        isPaid: true,
        paymentMethod: paymentMode,
        settledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setBillToSettle(null);
    } catch (err) {
      console.error('[MobileBilling] Settle error:', err);
    } finally {
      setSettling(false);
    }
  };

  // Refund order
  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !billToRefund) return;

    setRefunding(true);
    try {
      const refAmt = Number(refundAmount) || Number(billToRefund.total || billToRefund.totalAmount || 0);
      const refundId = `ref-${Date.now()}`;

      // 1. Record in refunds subcollection
      await setDoc(doc(db, 'restaurants', tenantId, 'refunds', refundId), {
        id: refundId,
        orderId: billToRefund.id,
        orderNumber: billToRefund.orderNumber || `#${billToRefund.id.slice(-5)}`,
        amount: refAmt,
        reason: refundReason,
        processedBy: user?.email || 'Owner',
        createdAt: new Date().toISOString(),
        tenantId,
      });

      // 2. Update order status
      await updateDoc(doc(db, 'restaurants', tenantId, 'orders', billToRefund.id), {
        status: 'refunded',
        paymentStatus: 'refunded',
        refundAmount: refAmt,
        refundReason,
        updatedAt: new Date().toISOString(),
      });

      setBillToRefund(null);
    } catch (err) {
      console.error('[MobileBilling] Refund error:', err);
    } finally {
      setRefunding(false);
    }
  };

  // Share receipt
  const handleShareReceipt = async (bill: any) => {
    const total = Number(bill.total || bill.totalAmount || 0);
    const summary = `SpiralDine Receipt\nOrder: ${bill.orderNumber || bill.id}\nTable: ${bill.tableNumber || 'Takeout'}\nTotal: ${formatPrice(total)}\nStatus: ${bill.paymentStatus || 'Pending'}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${bill.orderNumber || bill.id}`,
          text: summary,
        });
      } catch (_) {}
    } else {
      navigator.clipboard.writeText(summary);
      alert('Receipt summary copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F7] flex flex-col pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#EBEBEB] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/business')}
          className="w-9 h-9 rounded-full bg-[#F7F7F7] flex items-center justify-center text-[#202124] hover:bg-[#EBEBEB]"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h1 className="font-extrabold text-sm text-[#202124]">Billing & POS Hub</h1>
          <p className="text-[11px] text-[#707070]">
            {activeShift ? '🟢 Shift Active' : '🔴 Shift Closed'}
          </p>
        </div>

        <button
          onClick={() => {
            if (activeShift) {
              setClosingCash(String((Number(activeShift.openingCash) || 0) + metrics.todayRev));
              setShowCloseShiftModal(true);
            } else {
              setShowOpenShiftModal(true);
            }
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm ${
            activeShift
              ? 'bg-[#FEE2E2] text-[#DC2626]'
              : 'bg-[#DCFCE7] text-[#16A34A]'
          }`}
        >
          {activeShift ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span>{activeShift ? 'Close Shift' : 'Open Shift'}</span>
        </button>
      </header>

      {/* Financial KPIs Banner */}
      <div className="bg-white border-b border-[#EBEBEB] p-4">
        <div className="grid grid-cols-2 gap-2">
          {/* Today's Revenue */}
          <div className="p-3 rounded-2xl bg-[#FFF4EE] border border-[#FFE0CE]">
            <div className="flex items-center justify-between text-[#FF7518]">
              <span className="text-[10px] font-extrabold uppercase">Today's Sales</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="font-black text-base text-[#202124] mt-1">
              {formatPrice(metrics.todayRev)}
            </div>
            <span className="text-[10px] text-[#707070]">{metrics.paidCount} paid tickets</span>
          </div>

          {/* Average Ticket Value */}
          <div className="p-3 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0]">
            <div className="flex items-center justify-between text-[#16A34A]">
              <span className="text-[10px] font-extrabold uppercase">Avg Bill Value</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="font-black text-base text-[#202124] mt-1">
              {formatPrice(metrics.avgBill)}
            </div>
            <span className="text-[10px] text-[#707070]">Per settled table</span>
          </div>

          {/* Tax Collected */}
          <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[10px] font-extrabold text-[#64748B] uppercase">Tax Collected</span>
            <div className="font-black text-sm text-[#202124] mt-1">
              {formatPrice(metrics.todayTax)}
            </div>
          </div>

          {/* Discounts */}
          <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="text-[10px] font-extrabold text-[#64748B] uppercase">Discounts Given</span>
            <div className="font-black text-sm text-[#202124] mt-1">
              {formatPrice(metrics.todayDiscounts)}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sections Bar */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-[#EBEBEB] overflow-x-auto no-scrollbar flex items-center gap-2">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'queue'
              ? 'bg-[#202124] text-white'
              : 'bg-[#F7F7F7] text-[#707070] hover:bg-[#EBEBEB]'
          }`}
        >
          Queue ({queueOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('open')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'open'
              ? 'bg-[#D97706] text-white'
              : 'bg-[#FEF3C7] text-[#D97706]'
          }`}
        >
          Open Bills
        </button>
        <button
          onClick={() => setActiveTab('paid')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'paid'
              ? 'bg-[#16A34A] text-white'
              : 'bg-[#DCFCE7] text-[#16A34A]'
          }`}
        >
          Paid Bills ({paidOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('refunds')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'refunds'
              ? 'bg-[#DC2626] text-white'
              : 'bg-[#FEE2E2] text-[#DC2626]'
          }`}
        >
          Refunds ({refunds.length})
        </button>
        <button
          onClick={() => setActiveTab('shifts')}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            activeTab === 'shifts'
              ? 'bg-[#2563EB] text-white'
              : 'bg-[#EFF6FF] text-[#2563EB]'
          }`}
        >
          Shift Reports ({shifts.length})
        </button>
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Search */}
        {activeTab !== 'shifts' && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9E9E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order #, table number, or diner..."
              className="w-full h-9 pl-8 pr-3 bg-white rounded-xl border border-[#EBEBEB] text-xs text-[#202124] focus:outline-none focus:border-[#FF7518]"
            />
          </div>
        )}

        {loading ? (
          <MobileLoadingSkeleton count={3} />
        ) : activeTab === 'shifts' ? (
          /* Shift Reports List */
          shifts.length === 0 ? (
            <MobileEmptyState
              icon={Clock}
              title="No Shifts Recorded"
              description="Open and close cash register shifts to generate daily drawer audits."
            />
          ) : (
            shifts.map((shift) => {
              const isOpen = shift.status === 'open' || !shift.closedAt;
              return (
                <div
                  key={shift.id}
                  className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-xs text-[#202124]">
                        Cashier: {shift.cashierName || 'Staff'}
                      </h4>
                      <span className="text-[10px] text-[#707070]">
                        Opened: {new Date(shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isOpen ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F3F4F6] text-[#6B7280]'
                    }`}>
                      {isOpen ? 'Active Drawer' : 'Closed'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#F5F5F5] text-center">
                    <div>
                      <span className="text-[9px] font-bold text-[#707070] uppercase">Float</span>
                      <p className="font-bold text-xs text-[#202124]">{formatCurrency(Number(shift.openingCash || 0))}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-[#707070] uppercase">Sales</span>
                      <p className="font-bold text-xs text-[#16A34A]">{formatCurrency(Number(shift.totalSales || 0))}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-[#707070] uppercase">Variance</span>
                      <p className={`font-bold text-xs ${Number(shift.variance || 0) < 0 ? 'text-[#DC2626]' : 'text-[#202124]'}`}>
                        {formatCurrency(Number(shift.variance || 0))}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : activeTab === 'refunds' ? (
          /* Refunds List */
          refunds.length === 0 ? (
            <MobileEmptyState
              icon={RotateCcw}
              title="No Refunds Processed"
              description="Authoritative payment refunds and reversals will appear in this audit log."
            />
          ) : (
            refunds.map((ref) => (
              <div
                key={ref.id}
                className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#202124]">{ref.orderNumber || ref.orderId}</span>
                    <span className="text-[10px] font-bold text-[#DC2626] bg-[#FEE2E2] px-2 py-0.5 rounded-full">
                      Refunded
                    </span>
                  </div>
                  <div className="text-[11px] text-[#707070] mt-0.5">
                    Reason: {ref.reason || 'Not specified'}
                  </div>
                  <div className="text-[10px] text-[#9E9E9E] mt-0.5">
                    {new Date(ref.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-sm text-[#DC2626]">
                    -{formatCurrency(Number(ref.amount || 0))}
                  </div>
                  <span className="text-[10px] text-[#707070]">by {ref.processedBy}</span>
                </div>
              </div>
            ))
          )
        ) : (
          /* Orders / Bills List */
          displayedOrders.length === 0 ? (
            <MobileEmptyState
              icon={Receipt}
              title="No Bills in Section"
              description="Orders matching this tab criteria will appear here."
            />
          ) : (
            displayedOrders.map((bill) => {
              const isPaid = bill.paymentStatus === 'paid' || bill.isPaid === true;
              const isRefunded = bill.status === 'refunded' || bill.paymentStatus === 'refunded';
              const total = Number(bill.total || bill.totalAmount || 0);
              const num = bill.orderNumber || `#${bill.id.slice(-5).toUpperCase()}`;

              return (
                <div
                  key={bill.id}
                  className="bg-white rounded-2xl border border-[#EBEBEB] p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#202124]">{num}</span>
                        <span className="text-[11px] text-[#707070]">
                          • {bill.tableNumber ? `Table ${bill.tableNumber}` : (bill.diningOption || 'Dine-In')}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#9E9E9E] mt-0.5">
                        {bill.items?.length || 1} items • {bill.paymentMethod || 'UPI / Cash'} • {bill.createdAt ? new Date(bill.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-sm text-[#202124]">
                        {formatPrice(total)}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold mt-1 ${
                        isRefunded ? 'bg-[#FEE2E2] text-[#DC2626]' :
                        isPaid ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEF3C7] text-[#D97706]'
                      }`}>
                        {isRefunded ? 'Refunded' : isPaid ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2 border-t border-[#F5F5F5] flex items-center justify-between gap-2">
                    {!isPaid && !isRefunded ? (
                      <button
                        onClick={() => setBillToSettle(bill)}
                        className="flex-1 py-1.5 px-3 bg-[#FF7518] hover:bg-[#e06412] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Settle Bill</span>
                      </button>
                    ) : isPaid && !isRefunded ? (
                      <button
                        onClick={() => {
                          setBillToRefund(bill);
                          setRefundAmount(String(total));
                        }}
                        className="flex-1 py-1.5 px-2 bg-[#FEE2E2] hover:bg-[#FECACA] text-[#DC2626] text-xs font-bold rounded-xl flex items-center justify-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Refund</span>
                      </button>
                    ) : null}

                    <button
                      onClick={() => setViewingReceipt(bill)}
                      className="p-2 bg-[#F7F7F7] text-[#202124] rounded-xl hover:bg-[#EBEBEB]"
                      title="View Receipt"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleShareReceipt(bill)}
                      className="p-2 bg-[#F7F7F7] text-[#202124] rounded-xl hover:bg-[#EBEBEB]"
                      title="Share Summary"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Settle Bill Modal */}
      {billToSettle && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="font-extrabold text-base text-[#202124]">Settle Bill</h3>
              <p className="text-xs text-[#707070] mt-0.5">
                {billToSettle.orderNumber || `#${billToSettle.id.slice(-5)}`} • Table {billToSettle.tableNumber || 'Takeout'}
              </p>
            </div>

            <div className="p-3 bg-[#FFF4EE] rounded-2xl border border-[#FFE0CE] text-center">
              <span className="text-[10px] font-bold text-[#FF7518] uppercase">Total Due</span>
              <div className="font-black text-2xl text-[#202124] mt-0.5">
                {formatPrice(Number(billToSettle.total || billToSettle.totalAmount || 0))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#202124] mb-1.5">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('upi')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    paymentMode === 'upi'
                      ? 'bg-[#FF7518] text-white border-[#FF7518]'
                      : 'bg-[#F7F7F7] text-[#707070] border-transparent'
                  }`}
                >
                  UPI / QR
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('cash')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    paymentMode === 'cash'
                      ? 'bg-[#FF7518] text-white border-[#FF7518]'
                      : 'bg-[#F7F7F7] text-[#707070] border-transparent'
                  }`}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('card')}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    paymentMode === 'card'
                      ? 'bg-[#FF7518] text-white border-[#FF7518]'
                      : 'bg-[#F7F7F7] text-[#707070] border-transparent'
                  }`}
                >
                  Card
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBillToSettle(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={settling}
                onClick={handleSettleBill}
                className="flex-1 py-2.5 rounded-xl bg-[#16A34A] text-white text-xs font-bold shadow-sm"
              >
                {settling ? 'Settling...' : 'Confirm Paid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {billToRefund && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="font-extrabold text-base text-[#202124]">Authoritative Refund</h3>
              <p className="text-xs text-[#707070] mt-0.5">
                Reversing charge for order {billToRefund.orderNumber || billToRefund.id}
              </p>
            </div>

            <form onSubmit={handleProcessRefund} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Refund Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#DC2626] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Reason for Reversal</label>
                <input
                  type="text"
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="e.g. Returned dish, billing error"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#DC2626] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBillToRefund(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refunding}
                  className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-bold shadow-sm"
                >
                  {refunding ? 'Processing...' : 'Authorize Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-extrabold text-base text-[#202124]">Open Register Shift</h3>

            <form onSubmit={handleOpenShift} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Opening Cash Float ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Shift Notes</label>
                <input
                  type="text"
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOpenShiftModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={shiftSaving}
                  className="flex-1 py-2.5 rounded-xl bg-[#16A34A] text-white text-xs font-bold shadow-sm"
                >
                  {shiftSaving ? 'Opening...' : 'Start Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShiftModal && activeShift && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="font-extrabold text-base text-[#202124]">Close Shift & Balance Drawer</h3>
              <p className="text-xs text-[#707070] mt-0.5">
                Reconcile physical cash with expected drawer revenue.
              </p>
            </div>

            <div className="p-3 bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] space-y-1 text-xs">
              <div className="flex justify-between text-[#707070]">
                <span>Opening Cash Float:</span>
                <span className="font-bold text-[#202124]">{formatCurrency(Number(activeShift.openingCash || 0))}</span>
              </div>
              <div className="flex justify-between text-[#707070]">
                <span>Today's Total Sales:</span>
                <span className="font-bold text-[#16A34A]">+{formatCurrency(metrics.todayRev)}</span>
              </div>
              <div className="flex justify-between text-[#202124] font-extrabold pt-1 border-t border-[#E2E8F0]">
                <span>Expected Drawer Total:</span>
                <span>{formatCurrency((Number(activeShift.openingCash) || 0) + metrics.todayRev)}</span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Counted Physical Cash ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#202124] mb-1">Reconciliation Notes</label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="e.g. All receipts tallied correctly"
                  className="w-full h-10 px-3.5 rounded-xl bg-[#F7F7F7] border border-transparent focus:border-[#FF7518] focus:bg-white text-xs text-[#202124] outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseShiftModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#D1D5DB] text-xs font-bold text-[#707070]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={shiftSaving}
                  className="flex-1 py-2.5 rounded-xl bg-[#DC2626] text-white text-xs font-bold shadow-sm"
                >
                  {shiftSaving ? 'Closing...' : 'Close & Finalize'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-6 text-center space-y-4 shadow-xl relative">
            <button
              onClick={() => setViewingReceipt(null)}
              className="absolute top-4 right-4 text-[#9E9E9E]"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h3 className="font-extrabold text-base text-[#202124]">SpiralDine Tax Invoice</h3>
              <p className="text-[11px] text-[#707070]">
                {viewingReceipt.orderNumber || viewingReceipt.id} • Table {viewingReceipt.tableNumber || 'Dine-In'}
              </p>
            </div>

            <div className="p-3 bg-[#F7F7F7] rounded-2xl border border-[#EBEBEB] text-left text-xs space-y-1.5 max-h-48 overflow-y-auto">
              {(viewingReceipt.items || []).map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between text-[11px]">
                  <span>{it.quantity || 1}x {it.name || it.itemName}</span>
                  <span className="font-bold">{formatCurrency(Number(it.price || 0) * Number(it.quantity || 1))}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-[#EBEBEB] flex justify-between font-extrabold text-xs">
                <span>Total Amount:</span>
                <span>{formatCurrency(Number(viewingReceipt.total || viewingReceipt.totalAmount || 0))}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleShareReceipt(viewingReceipt)}
                className="flex-1 py-2.5 bg-[#FF7518] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileBilling;
