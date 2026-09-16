import React, { useEffect, useState, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  updateDoc, 
  addDoc, 
  getDoc,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { IOrder, IOrderItem, ITable, IPaymentBreakdown, TPaymentStatus, IShiftReport } from '../../../types';
import { formatPrice, formatTimestamp, getElapsedMinutes } from '../../../utils/format';
import { useCurrency } from '../../../context/CurrencyContext';
import { logEvent } from '../../../services/eventEngine';
import { billingService } from '../../../shared/services/billingService';
import CanonicalBillModal from '../../../shared/ui/billing/CanonicalBillModal';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Modal from '../../../components/ui/Modal/Modal';
import Dialog from '../../../components/ui/Dialog/Dialog';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import Tabs from '../../../components/ui/Tabs/Tabs';
import SearchBar from '../../../components/ui/SearchBar/SearchBar';
import Input from '../../../components/ui/Input/Input';
import Select from '../../../components/ui/Select/Select';

// Hot Toast notifications
import toast from 'react-hot-toast';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CreditCard, 
  Wallet, 
  Smartphone, 
  Receipt, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  FileText, 
  RefreshCcw, 
  CheckCircle,
  Eye,
  Gift,
  Play,
  Pause,
  FolderOpen,
  Sparkles,
  Lock
} from 'lucide-react';

export const OwnerBilling: React.FC = () => {
  const { user } = useAuth();
  const { currencySymbol } = useCurrency();
  const [activeTab, setActiveTab] = useState('billing_queue');
  const [isLoading, setIsLoading] = useState(true);

  // Core data states
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [tables, setTables] = useState<ITable[]>([]);
  const [tenantSettings, setTenantSettings] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  
  // v1.1 Cash Drawer & Shift Closing states
  const [shifts, setShifts] = useState<IShiftReport[]>([]);
  const [activeShift, setActiveShift] = useState<IShiftReport | null>(null);
  const [isOpeningShiftOpen, setIsOpeningShiftOpen] = useState(false);
  const [isClosingShiftOpen, setIsClosingShiftOpen] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [actualClosingCashInput, setActualClosingCashInput] = useState('');
  const [selectedShiftReport, setSelectedShiftReport] = useState<IShiftReport | null>(null);

  // v1.1 Held Bills & Voids states
  const [isHoldBillOpen, setIsHoldBillOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('Customer Ordering More');
  const [customHoldReason, setCustomHoldReason] = useState('');
  
  // v1.1 Complimentary Item states
  const [isComplimentaryModalOpen, setIsComplimentaryModalOpen] = useState(false);
  const [complimentaryItemTarget, setComplimentaryItemTarget] = useState<IOrderItem | null>(null);
  const [complimentaryReason, setComplimentaryReason] = useState('');
  
  // v1.1 Reprint modal state
  const [isReprintModalOpen, setIsReprintModalOpen] = useState(false);
  const [reprintReason, setReprintReason] = useState('');

  // Selection states for drawers/workspaces
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [viewingOrderDetails, setViewingOrderDetails] = useState<IOrder | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  
  // Canonical Authoritative Bill Modal states
  const [canonicalBillOrder, setCanonicalBillOrder] = useState<IOrder | null>(null);
  const [isCanonicalBillOpen, setIsCanonicalBillOpen] = useState(false);
  
  // Refund Flow states
  const [refundTargetOrder, setRefundTargetOrder] = useState<IOrder | null>(null);
  const [refundType, setRefundType] = useState<'full' | 'partial' | 'void'>('full');
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);

  // Search queries
  const [searchQuery, setSearchQuery] = useState('');

  // Discount states
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | 'coupon' | 'manager' | 'staff'>('percentage');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountFixed, setDiscountFixed] = useState<number>(0);
  const [couponCode, setCouponCode] = useState('');
  const [managerDiscountApproved, setManagerDiscountApproved] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pendingDiscountValue, setPendingDiscountValue] = useState<number>(0);
  const [pendingDiscountType, setPendingDiscountType] = useState<any>(null);

  // Mixed Payment state
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card' | 'wallet' | 'mixed'>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [walletAmount, setWalletAmount] = useState('');

  // Configurable values
  const taxRate = tenantSettings?.taxPercent ?? 5;
  const serviceChargeRate = tenantSettings?.serviceCharge ?? 5;

  const isAuthorizedOwner = user?.role === 'owner' || user?.role === 'admin';

  useEffect(() => {
    if (!user?.tenantId) return;

    setIsLoading(true);

    const tenantRef = doc(db, 'tenants', user.tenantId);
    getDoc(tenantRef).then((snap) => {
      if (snap.exists()) {
        setTenantSettings(snap.data());
      }
    });

    const tablesRef = collection(db, 'restaurants', user.tenantId, 'tables');
    const unsubTables = onSnapshot(tablesRef, (snap) => {
      const list: ITable[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) } as ITable));
      setTables(list);
    });

    const ordersRef = collection(db, 'restaurants', user.tenantId, 'orders');
    const unsubOrders = onSnapshot(ordersRef, (snap) => {
      const list: IOrder[] = [];
      snap.forEach((d) => list.push({ orderId: d.id, id: d.id, ...(d.data() as any) } as IOrder));
      setOrders(list);
      setIsLoading(false);
    });

    const transRef = collection(db, 'restaurants', user.tenantId, 'transactions');
    const unsubTrans = onSnapshot(transRef, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setTransactions(list.sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return isNaN(tA) || isNaN(tB) ? 0 : tB - tA;
      }));
    });

    const refundsRef = collection(db, 'restaurants', user.tenantId, 'refunds');
    const unsubRefunds = onSnapshot(refundsRef, (snap) => {
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setRefunds(list.sort((a, b) => {
        const rA = a.refundedAt ? new Date(a.refundedAt).getTime() : 0;
        const rB = b.refundedAt ? new Date(b.refundedAt).getTime() : 0;
        return isNaN(rA) || isNaN(rB) ? 0 : rB - rA;
      }));
    });

    const shiftsRef = collection(db, 'restaurants', user.tenantId, 'shifts');
    const unsubShifts = onSnapshot(shiftsRef, (snap) => {
      const list: IShiftReport[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as IShiftReport);
      });
      const sortedShifts = list.sort((a, b) => {
        const sA = a.openingTime ? new Date(a.openingTime).getTime() : 0;
        const sB = b.openingTime ? new Date(b.openingTime).getTime() : 0;
        return isNaN(sA) || isNaN(sB) ? 0 : sB - sA;
      });
      setShifts(sortedShifts);

      const openShift = sortedShifts.find(s => s.status === 'open');
      setActiveShift(openShift || null);
    });

    return () => {
      unsubTables();
      unsubOrders();
      unsubTrans();
      unsubRefunds();
      unsubShifts();
    };
  }, [user]);

  const pendingBillingQueue = useMemo(() => {
    const queueList: Array<{
      id: string;
      tableNumber: string;
      orderId: string;
      order: IOrder;
      waiterName: string;
      elapsedMinutes: number;
      reason: string;
      total: number;
    }> = [];

    const processedOrderIds = new Set<string>();

    // 1. Tables with status bill_requested
    tables.filter(t => t.status === 'bill_requested').forEach(table => {
      const activeOrder = orders.find(o => 
        o.orderId === table.activeOrderId || 
        o.orderId === table.currentOrderId || 
        String(o.tableNumber) === String(table.number)
      );
      if (activeOrder) {
        processedOrderIds.add(activeOrder.orderId);
        const elapsed = table.billRequestedAt ? getElapsedMinutes(table.billRequestedAt) : getElapsedMinutes(activeOrder.createdAt);
        queueList.push({
          id: table.id || `tbl-${table.number}`,
          tableNumber: String(table.number),
          orderId: activeOrder.orderId,
          order: activeOrder,
          waiterName: table.assignedWaiterName || activeOrder.waiterName || 'Not Assigned',
          elapsedMinutes: elapsed,
          reason: 'Bill Requested',
          total: activeOrder.total || 0
        });
      }
    });

    // 2. Orders with DINING_COMPLETED or BILL_REQUESTED that are unpaid
    orders.forEach(o => {
      if (processedOrderIds.has(o.orderId)) return;
      if (o.status === 'CANCELLED' || o.status === 'COMPLETED') return;
      const isPaid = (o.paymentStatus || '').toLowerCase() === 'paid';
      if (isPaid) return;

      const st = (o.status || '').toUpperCase();
      if (st === 'DINING_COMPLETED' || st === 'BILL_REQUESTED' || o.billRequestedAt) {
        processedOrderIds.add(o.orderId);
        const elapsed = o.diningCompletedAt 
          ? getElapsedMinutes(o.diningCompletedAt) 
          : (o.billRequestedAt ? getElapsedMinutes(o.billRequestedAt) : getElapsedMinutes(o.createdAt));
        const matchedTable = tables.find(t => String(t.number) === String(o.tableNumber));
        queueList.push({
          id: matchedTable?.id || `ord-${o.orderId}`,
          tableNumber: String(o.tableNumber || 'Walk-in'),
          orderId: o.orderId,
          order: o,
          waiterName: matchedTable?.assignedWaiterName || o.waiterName || 'Not Assigned',
          elapsedMinutes: elapsed,
          reason: st === 'DINING_COMPLETED' ? 'Dining Completed' : 'Bill Requested',
          total: o.total || 0
        });
      }
    });

    return queueList;
  }, [tables, orders]);

  const openBillsOrders = useMemo(() => {
    return orders.filter(o => 
      o.status !== 'CANCELLED' && 
      o.status !== 'COMPLETED' && 
      o.paymentStatus !== 'paid' && 
      o.paymentStatus !== 'refunded' &&
      !o.isHeld
    );
  }, [orders]);

  const heldBillsOrders = useMemo(() => {
    return orders.filter(o => o.isHeld);
  }, [orders]);

  const paidBillsOrders = useMemo(() => {
    return orders.filter(o => 
      o.paymentStatus === 'paid' || 
      o.status === 'COMPLETED'
    ).sort((a, b) => {
      const dA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return isNaN(dA) || isNaN(dB) ? 0 : dB - dA;
    });
  }, [orders]);

  const shiftCalculations = useMemo(() => {
    if (!activeShift) return {
      cashSales: 0, upiSales: 0, cardSales: 0, walletSales: 0,
      totalRefunds: 0, totalDiscounts: 0, totalComplimentaryValue: 0, expectedClosingCash: 0
    };

    const openingTime = new Date(activeShift.openingTime).getTime();

    const shiftTransactions = transactions.filter(t => new Date(t.createdAt).getTime() >= openingTime);
    const shiftRefunds = refunds.filter(r => new Date(r.refundedAt).getTime() >= openingTime);

    let cash = 0, upi = 0, card = 0, wallet = 0;
    let discounts = 0, complimentary = 0;

    shiftTransactions.forEach(t => {
      const m = t.paymentMethods || {};
      cash += m.cash || 0;
      upi += m.upi || 0;
      card += m.card || 0;
      wallet += m.wallet || 0;
      discounts += t.discount || 0;

      const items = t.items || [];
      items.forEach((it: IOrderItem) => {
        if (it.isComplimentary) {
          complimentary += (it.pricePerUnit * it.count);
        }
      });
    });

    let totalRefundAmt = 0;
    let cashRefundAmt = 0;
    shiftRefunds.forEach(r => {
      totalRefundAmt += r.refundAmount || 0;
      if (r.paymentMethod === 'cash' || r.paymentMethod === 'original') {
        cashRefundAmt += r.refundAmount || 0;
      }
    });

    const expectedCash = (activeShift.openingCash) + cash - cashRefundAmt;

    return {
      cashSales: cash,
      upiSales: upi,
      cardSales: card,
      walletSales: wallet,
      totalRefunds: totalRefundAmt,
      totalDiscounts: discounts,
      totalComplimentaryValue: complimentary,
      expectedClosingCash: expectedCash
    };
  }, [activeShift, transactions, refunds]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayPaidOrders = orders.filter(o => {
      const orderDate = new Date(o.createdAt).toDateString();
      const isPaid = o.paymentStatus === 'paid' || o.status === 'COMPLETED';
      return isPaid && orderDate === today;
    });

    const todayRev = todayPaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const todayTax = todayPaidOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
    const todayDiscount = todayPaidOrders.reduce((sum, o) => sum + (o.discount || 0), 0);
    const avgValue = todayPaidOrders.length > 0 ? todayRev / todayPaidOrders.length : 0;

    return {
      revenue: todayRev,
      tax: todayTax,
      discount: todayDiscount,
      avgBill: avgValue,
      queueCount: pendingBillingQueue.length + heldBillsOrders.length,
      paidCount: todayPaidOrders.length
    };
  }, [orders, pendingBillingQueue, heldBillsOrders]);

  const tabsList = [
    { id: 'billing_queue', label: `Queue (${pendingBillingQueue.length + heldBillsOrders.length})`, icon: Clock },
    { id: 'open_bills', label: 'Open Bills', icon: Sparkles },
    { id: 'paid_bills', label: 'Paid Bills', icon: CheckCircle },
    { id: 'refunds', label: 'Refunds', icon: RefreshCcw },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'shift_reports', label: 'Shift Reports', icon: FolderOpen },
    { id: 'sales_summary', label: 'Sales Summary', icon: TrendingUp }
  ];

  const formatVal = (valInCents: number) => {
    return formatPrice(valInCents, currencySymbol);
  };

  const orderSubtotal = useMemo(() => {
    if (!selectedOrder) return 0;
    return selectedOrder.items.reduce((sum, item) => {
      if (item.isComplimentary) return sum;
      return sum + (item.pricePerUnit * item.count);
    }, 0);
  }, [selectedOrder]);

  const complimentaryValueTotal = useMemo(() => {
    if (!selectedOrder) return 0;
    return selectedOrder.items.reduce((sum, item) => {
      if (item.isComplimentary) {
        return sum + (item.pricePerUnit * item.count);
      }
      return sum;
    }, 0);
  }, [selectedOrder]);

  const discountAmount = useMemo(() => {
    if (!selectedOrder) return 0;
    if (discountType === 'percentage') {
      return Math.round((orderSubtotal * discountPercent) / 100);
    } else if (discountType === 'fixed') {
      return discountFixed * 100;
    } else if (discountType === 'coupon') {
      const multiplier = couponCode === 'SAVE10' ? 0.1 : couponCode === 'SAVE20' ? 0.2 : couponCode === 'FIFTY' ? 0.5 : 0;
      return Math.round(orderSubtotal * multiplier);
    } else if (discountType === 'manager') {
      return managerDiscountApproved ? Math.round((orderSubtotal * discountPercent) / 100) : 0;
    } else if (discountType === 'staff') {
      return Math.round((orderSubtotal * 15) / 100);
    }
    return 0;
  }, [selectedOrder, discountType, discountPercent, discountFixed, couponCode, managerDiscountApproved]);

  const finalTax = useMemo(() => {
    const afterDiscount = Math.max(0, orderSubtotal - discountAmount);
    return Math.round((afterDiscount * taxRate) / 100);
  }, [orderSubtotal, discountAmount, taxRate]);

  const finalServiceCharge = useMemo(() => {
    const afterDiscount = Math.max(0, orderSubtotal - discountAmount);
    return Math.round((afterDiscount * serviceChargeRate) / 100);
  }, [orderSubtotal, discountAmount, serviceChargeRate]);

  const computedTotal = useMemo(() => {
    return Math.max(0, orderSubtotal - discountAmount) + finalTax + finalServiceCharge;
  }, [orderSubtotal, discountAmount, finalTax, finalServiceCharge]);

  const roundedTotal = useMemo(() => {
    return Math.round(computedTotal / 100) * 100;
  }, [computedTotal]);

  const roundOffAmount = useMemo(() => {
    return roundedTotal - computedTotal;
  }, [roundedTotal, computedTotal]);

  const totalPaidInMixed = useMemo(() => {
    const cash = parseFloat(cashAmount || '0') * 100;
    const upi = parseFloat(upiAmount || '0') * 100;
    const card = parseFloat(cardAmount || '0') * 100;
    const wallet = parseFloat(walletAmount || '0') * 100;
    return cash + upi + card + wallet;
  }, [cashAmount, upiAmount, cardAmount, walletAmount]);

  const handleOpenShift = async () => {
    if (!user?.tenantId || !openingCashInput.trim()) return;
    try {
      const openingCents = parseFloat(openingCashInput) * 100;
      if (isNaN(openingCents) || openingCents < 0) {
        toast.error('Please enter a valid positive opening cash amount.');
        return;
      }
      const shiftsCol = collection(db, 'restaurants', user.tenantId, 'shifts');
      
      const newShift: Omit<IShiftReport, 'id'> = {
        tenantId: user.tenantId,
        openedBy: user.uid,
        openedByName: user.displayName || user.email || 'Owner',
        openingCash: openingCents,
        openingTime: new Date().toISOString(),
        status: 'open',
        cashSales: 0,
        upiSales: 0,
        cardSales: 0,
        walletSales: 0,
        totalRefunds: 0,
        totalDiscounts: 0,
        totalComplimentaryValue: 0,
        expectedClosingCash: openingCents,
        operator: user.displayName || user.email || 'Owner'
      };

      await addDoc(shiftsCol, newShift);
      toast.success('Cash Drawer Shift opened! POS desk active.');
      setIsOpeningShiftOpen(false);
      setOpeningCashInput('');

      logEvent(user.tenantId, {
        eventType: 'Shift Opened',
        eventCategory: 'Billing',
        performedBy: user.displayName || user.email || 'Owner',
        performedByRole: user.role || 'owner',
        title: 'POS Shift Drawer Opened',
        description: `Operator ${newShift.openedByName} opened a new shift drawer with ${formatPrice(openingCents, currencySymbol)} cash.`
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to open shift.');
    }
  };

  const handleCloseShift = async () => {
    if (!user?.tenantId || !activeShift?.id || !actualClosingCashInput.trim()) return;
    try {
      const actualCents = parseFloat(actualClosingCashInput) * 100;
      if (isNaN(actualCents) || actualCents < 0) {
        toast.error('Please enter a valid positive closing cash amount.');
        return;
      }
      const diff = actualCents - shiftCalculations.expectedClosingCash;
      
      const shiftRef = doc(db, 'restaurants', user.tenantId, 'shifts', activeShift.id);
      
      const updatedShift = {
        status: 'closed' as const,
        closingTime: new Date().toISOString(),
        closedBy: user.uid,
        closedByName: user.displayName || user.email || 'Owner',
        cashSales: shiftCalculations.cashSales,
        upiSales: shiftCalculations.upiSales,
        cardSales: shiftCalculations.cardSales,
        walletSales: shiftCalculations.walletSales,
        totalRefunds: shiftCalculations.totalRefunds,
        totalDiscounts: shiftCalculations.totalDiscounts,
        totalComplimentaryValue: shiftCalculations.totalComplimentaryValue,
        expectedClosingCash: shiftCalculations.expectedClosingCash,
        actualClosingCash: actualCents,
        difference: diff,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(shiftRef, updatedShift);
      toast.success('Shift drawer closed. Summary report generated.');
      setIsClosingShiftOpen(false);
      setActualClosingCashInput('');

      logEvent(user.tenantId, {
        eventType: 'Shift Closed',
        eventCategory: 'Billing',
        performedBy: user.displayName || user.email || 'Owner',
        performedByRole: user.role || 'owner',
        title: 'POS Shift Drawer Closed',
        description: `Operator completed shift. Expected Cash: ${formatVal(shiftCalculations.expectedClosingCash)}. Actual: ${formatVal(actualCents)}. Diff: ${formatVal(diff)}.`
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to close shift.');
    }
  };

  const handleHoldBill = async () => {
    if (!selectedOrder || !user?.tenantId) return;
    
    const reason = holdReason === 'Custom' ? customHoldReason : holdReason;
    if (!reason.trim()) {
      toast.error('Please enter a hold reason.');
      return;
    }

    try {
      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', selectedOrder.orderId);
      await updateDoc(orderRef, {
        isHeld: true,
        holdReason: reason,
        heldAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      toast.success(`Bill for Table ${selectedOrder.tableNumber} is put on hold.`);
      setIsHoldBillOpen(false);
      setIsCheckoutOpen(false);
      setSelectedOrder(null);

      logEvent(user.tenantId, {
        eventType: 'Bill Held',
        eventCategory: 'Billing',
        performedBy: user.displayName || user.email || 'Owner',
        performedByRole: user.role || 'owner',
        orderId: selectedOrder.orderId,
        tableNumber: selectedOrder.tableNumber,
        title: 'Bill Put on Hold',
        description: `Order check paused. Reason: ${reason}`
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to hold bill.');
    }
  };

  const handleResumeBill = async (order: IOrder) => {
    if (!user?.tenantId) return;
    try {
      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', order.orderId);
      await updateDoc(orderRef, {
        isHeld: false,
        resumedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      toast.success(`Resumed bill for Table ${order.tableNumber}.`);
      setSelectedOrder({ ...order, isHeld: false });
      
      setDiscountPercent(order.discountPercent || 0);
      setDiscountFixed(0);
      setDiscountType(order.discountType || 'percentage');
      setPaymentMode('cash');
      setCashAmount('');
      setUpiAmount('');
      setCardAmount('');
      setWalletAmount('');
      setIsCheckoutOpen(true);

      logEvent(user.tenantId, {
        eventType: 'Bill Resumed',
        eventCategory: 'Billing',
        performedBy: user.displayName || user.email || 'Owner',
        performedByRole: user.role || 'owner',
        orderId: order.orderId,
        tableNumber: order.tableNumber,
        title: 'Bill Resumed',
        description: `Held bill for Table ${order.tableNumber} was resumed for payment processing.`
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to resume bill.');
    }
  };

  const handleMarkItemComplimentary = async () => {
    if (!selectedOrder || !complimentaryItemTarget || !user?.tenantId) return;
    if (!complimentaryReason.trim()) {
      toast.error('Please input an audit reason.');
      return;
    }

    try {
      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', selectedOrder.orderId);
      const updatedItems = selectedOrder.items.map(it => {
        if (it.itemId === complimentaryItemTarget.itemId) {
          return {
            ...it,
            isComplimentary: true,
            complimentaryReason: complimentaryReason,
            complimentaryApprovedBy: user.uid,
            complimentaryApprovedByName: user.displayName || user.email || 'Owner',
            complimentaryAt: new Date().toISOString()
          };
        }
        return it;
      });

      const newSubtotal = updatedItems.reduce((sum, it) => {
        if (it.isComplimentary) return sum;
        return sum + (it.pricePerUnit * it.count);
      }, 0);
      const newTax = Math.round(newSubtotal * taxRate / 100);
      const newService = Math.round(newSubtotal * serviceChargeRate / 100);
      const newTotal = newSubtotal + newTax + newService;

      await updateDoc(orderRef, {
        items: updatedItems,
        subtotal: newSubtotal,
        tax: newTax,
        serviceCharge: newService,
        total: newTotal,
        updatedAt: new Date().toISOString()
      });

      const updatedOrder = { 
        ...(selectedOrder as IOrder), 
        items: updatedItems, 
        subtotal: newSubtotal, 
        tax: newTax, 
        serviceCharge: newService,
        total: newTotal 
      };

      setSelectedOrder(updatedOrder);
      setIsComplimentaryModalOpen(false);
      setComplimentaryReason('');
      setComplimentaryItemTarget(null);
      toast.success(`${complimentaryItemTarget.name} marked complimentary!`);

      logEvent(user.tenantId, {
        eventType: 'Complimentary Item Added',
        eventCategory: 'Billing',
        performedBy: user.displayName || user.email || 'Owner',
        performedByRole: user.role || 'owner',
        orderId: selectedOrder.orderId,
        tableNumber: selectedOrder.tableNumber,
        title: 'Complimentary Item Approved',
        description: `${complimentaryItemTarget.name} marked as free. Reason: ${complimentaryReason}`
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to mark item complimentary.');
    }
  };

  const handleReprintInvoice = async () => {
    if (!selectedOrder || !user?.tenantId) return;
    
    try {
      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', selectedOrder.orderId);
      const currentReprints = selectedOrder.reprintCount || 0;
      const nextCount = currentReprints + 1;
      
      const newLog = {
        reprintedBy: user.uid,
        reprintedByName: user.displayName || user.email || 'Owner',
        timestamp: new Date().toISOString(),
        reason: reprintReason || 'Standard Reprint'
      };

      const updatedLogs = [...(selectedOrder.reprintsLog || []), newLog];

      await updateDoc(orderRef, {
        reprintCount: nextCount,
        reprintsLog: updatedLogs,
        updatedAt: new Date().toISOString()
      });

      const updatedOrder = {
        ...(selectedOrder as IOrder),
        reprintCount: nextCount,
        reprintsLog: updatedLogs
      };

      setSelectedOrder(updatedOrder);
      setIsReprintModalOpen(false);
      setReprintReason('');
      
      toast.success(`Reprint counter incremented. Print instruction dispatched.`);
      
      logEvent(user.tenantId, {
        eventType: 'Invoice Reprinted',
        eventCategory: 'Billing',
        performedBy: user.displayName || user.email || 'Owner',
        performedByRole: user.role || 'owner',
        orderId: selectedOrder.orderId,
        tableNumber: selectedOrder.tableNumber,
        title: 'Invoice Reprinted',
        description: `Invoice ${selectedOrder.invoiceNumber} reprinted (Total copies: ${nextCount}). Reason: ${newLog.reason}`
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to log reprint.');
    }
  };

  const requestDiscountApproval = (percent: number, type: any) => {
    setPendingDiscountValue(percent);
    setPendingDiscountType(type);
    setIsPinModalOpen(true);
  };

  const handleVerifyManagerPin = () => {
    if (managerPin === '1234' || managerPin === '0000') {
      toast.success('Manager discount approved!');
      setManagerDiscountApproved(true);
      setDiscountPercent(pendingDiscountValue);
      setDiscountType(pendingDiscountType);
      setIsPinModalOpen(false);
      setManagerPin('');

      if (user?.tenantId && selectedOrder) {
        logEvent(user.tenantId, {
          eventType: 'Discount Approved',
          eventCategory: 'Billing',
          performedBy: user.displayName || user.email || 'Owner',
          performedByRole: user.role || 'owner',
          orderId: selectedOrder.orderId,
          tableNumber: selectedOrder.tableNumber,
          title: 'Large Discount Authorized',
          description: `Supervisor approved a ${pendingDiscountValue}% discount on Order #${selectedOrder.orderId.substring(0, 8)}.`
        });
      }
    } else {
      toast.error('Invalid PIN code! Approval rejected.');
    }
  };

  const handleDiscountChange = (type: any, val: number) => {
    const isLarge = type === 'percentage' && val > 20;
    const isManagerDiscount = type === 'manager';
    
    if (isLarge || isManagerDiscount) {
      requestDiscountApproval(val, type);
    } else {
      setDiscountType(type);
      if (type === 'percentage') setDiscountPercent(val);
      else if (type === 'fixed') setDiscountFixed(val);
      else if (type === 'coupon') setDiscountPercent(0);
      else if (type === 'staff') setDiscountPercent(15);
    }
  };

  const handleModifyQuantity = async (item: IOrderItem, change: number) => {
    if (!selectedOrder || !user?.tenantId) return;
    
    const newCount = item.count + change;
    if (newCount < 1) {
      toast.error('Quantity cannot be less than 1. Remove the item instead.');
      return;
    }

    const confirmChange = window.confirm(`Confirm editing quantity of ${item.name} from ${item.count} to ${newCount}?`);
    if (!confirmChange) return;

    try {
      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', selectedOrder.orderId);
      const updatedItems = selectedOrder.items.map(it => {
        if (it.itemId === item.itemId) {
          return { ...it, count: newCount };
        }
        return it;
      });

      const subtotal = updatedItems.reduce((sum, it) => {
        if (it.isComplimentary) return sum;
        return sum + (it.pricePerUnit * it.count);
      }, 0);
      const tax = Math.round(subtotal * taxRate / 100);
      const total = subtotal + tax;

      await updateDoc(orderRef, {
        items: updatedItems,
        subtotal,
        tax,
        total,
        updatedAt: new Date().toISOString()
      });

      setSelectedOrder(prev => prev ? { ...prev, items: updatedItems, subtotal, tax, total } : null);
      toast.success('Quantity updated successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update item quantity.');
    }
  };

  const handleRemoveItem = async (item: IOrderItem) => {
    if (!selectedOrder || !user?.tenantId) return;

    const confirmRemove = window.confirm(`Are you sure you want to remove ${item.name} from this bill?`);
    if (!confirmRemove) return;

    try {
      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', selectedOrder.orderId);
      const updatedItems = selectedOrder.items.filter(it => it.itemId !== item.itemId);

      if (updatedItems.length === 0) {
        toast.error('An order must contain at least one item. You can cancel the order instead.');
        return;
      }

      const subtotal = updatedItems.reduce((sum, it) => {
        if (it.isComplimentary) return sum;
        return sum + (it.pricePerUnit * it.count);
      }, 0);
      const tax = Math.round(subtotal * taxRate / 100);
      const total = subtotal + tax;

      await updateDoc(orderRef, {
        items: updatedItems,
        subtotal,
        tax,
        total,
        updatedAt: new Date().toISOString()
      });

      setSelectedOrder(prev => prev ? { ...prev, items: updatedItems, subtotal, tax, total } : null);
      toast.success('Item removed from order.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to remove item.');
    }
  };

  const handleCompletePayment = async () => {
    if (!selectedOrder || !user?.tenantId) return;
    if (!activeShift) {
      toast.error('Cash Drawer shift must be open to settle transactions!');
      return;
    }

    let paymentBreakdown: IPaymentBreakdown = { cash: 0, upi: 0, card: 0, wallet: 0 };

    if (paymentMode === 'mixed') {
      const cashVal = parseFloat(cashAmount || '0') * 100;
      const upiVal = parseFloat(upiAmount || '0') * 100;
      const cardVal = parseFloat(cardAmount || '0') * 100;
      const walletVal = parseFloat(walletAmount || '0') * 100;
      if (isNaN(cashVal) || isNaN(upiVal) || isNaN(cardVal) || isNaN(walletVal) || cashVal < 0 || upiVal < 0 || cardVal < 0 || walletVal < 0) {
        toast.error('Please enter valid positive numeric breakdown amounts.');
        return;
      }
      const totalPaid = cashVal + upiVal + cardVal + walletVal;
      if (Math.abs(totalPaid - roundedTotal) > 2) {
        toast.error(`Total breakdown sum (${formatVal(totalPaid)}) must match grand total (${formatVal(roundedTotal)})`);
        return;
      }
      paymentBreakdown = {
        cash: cashVal,
        upi: upiVal,
        card: cardVal,
        wallet: walletVal
      };
    } else {
      paymentBreakdown[paymentMode as 'cash' | 'upi' | 'card' | 'wallet'] = roundedTotal;
    }

    try {
      const timestampPart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const invoiceNo = `INV-${timestampPart}-${randomSeq}`;

      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', selectedOrder.orderId);

      const updatedOrderData = {
        status: 'COMPLETED',
        paymentStatus: 'paid' as TPaymentStatus,
        paymentMethods: paymentBreakdown,
        invoiceNumber: invoiceNo,
        subtotal: orderSubtotal,
        discount: discountAmount,
        discountType: discountType,
        discountPercent: discountPercent,
        discountLabel: discountType === 'percentage' ? `${discountPercent}%` : discountType === 'fixed' ? `${formatVal(discountAmount)}` : discountType,
        tax: finalTax,
        serviceCharge: finalServiceCharge,
        roundOff: roundOffAmount,
        total: roundedTotal,
        paidAt: new Date().toISOString(),
        processedBy: user.uid,
        processedByName: user.displayName || user.email || 'Owner',
        updatedAt: new Date().toISOString()
      };

      await updateDoc(orderRef, updatedOrderData);

      const tableObj = tables.find(t => String(t.number) === String(selectedOrder.tableNumber));
      if (tableObj) {
        const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', tableObj.id);
        await updateDoc(tableRef, {
          status: 'cleaning',
          cleaningStartedAt: new Date().toISOString()
        });
      }

      const transCol = collection(db, 'restaurants', user.tenantId, 'transactions');
      await addDoc(transCol, {
        orderId: selectedOrder.orderId,
        tenantId: user.tenantId,
        tableNumber: selectedOrder.tableNumber,
        waiterName: selectedOrder.waiterName || 'Server',
        waiterId: selectedOrder.waiterId || '',
        invoiceNumber: invoiceNo,
        items: selectedOrder.items,
        subtotal: orderSubtotal,
        discount: discountAmount,
        tax: finalTax,
        serviceCharge: finalServiceCharge,
        roundOff: roundOffAmount,
        total: roundedTotal,
        paymentStatus: 'paid',
        paymentMethods: paymentBreakdown,
        processedBy: user.uid,
        processedByName: user.displayName || user.email || 'Owner',
        createdAt: new Date().toISOString()
      });

      logEvent(user.tenantId, {
        eventType: 'Payment Completed',
        eventCategory: 'Payment',
        performedBy: user.displayName || user.email || 'Owner',
        performedByRole: user.role || 'owner',
        orderId: selectedOrder.orderId,
        tableNumber: selectedOrder.tableNumber,
        title: 'Payment Completed',
        description: `Grand total of ${formatVal(roundedTotal)} settled for Table ${selectedOrder.tableNumber}. Invoice ${invoiceNo} generated.`
      });

      // Synchronize with canonical bill for real-time customer and waiter updates
      try {
        await billingService.settleBillPayment(user.tenantId, selectedOrder.orderId, {
          method: (paymentMode as any) || 'cash',
          breakdown: paymentBreakdown,
          processedBy: user.uid,
          processedByName: user.displayName || user.email || 'Reception / Owner',
          processedByRole: 'owner',
          invoiceNumber: invoiceNo,
          roundOff: roundOffAmount
        });
      } catch (billErr) {
        console.warn('[OwnerBilling] Canonical bill settlement sync warning:', billErr);
      }

      toast.success('Invoice settled and table closed!', { icon: '💰' });
      setIsCheckoutOpen(false);
      
      const refreshedOrder = { ...(selectedOrder as IOrder), ...updatedOrderData } as IOrder;
      setSelectedOrder(refreshedOrder);
      setIsInvoicePreviewOpen(true);
    } catch (e) {
      console.error(e);
      toast.error('Failed to complete transaction.');
    }
  };

  const handleProcessRefund = async () => {
    if (!refundTargetOrder || !user?.tenantId || !refundReason.trim()) {
      toast.error('Please enter a valid reason for the refund action.');
      return;
    }

    setIsRefunding(true);
    try {
      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', refundTargetOrder.orderId);
      const isFull = refundType === 'full' || refundType === 'void';
      const refAmt = isFull ? (refundTargetOrder.total || 0) : parseFloat(refundAmountInput || '0') * 100;

      if (isNaN(refAmt) || (!isFull && (refAmt <= 0 || refAmt > (refundTargetOrder.total || 0)))) {
        toast.error('Partial refund amount must be greater than zero and less than the bill total.');
        setIsRefunding(false);
        return;
      }

      const nextStatus = refundType === 'void' ? 'cancelled' : 'refunded';

      await updateDoc(orderRef, {
        paymentStatus: nextStatus as TPaymentStatus,
        updatedAt: new Date().toISOString()
      });

      const refundCol = collection(db, 'restaurants', user.tenantId, 'refunds');
      await addDoc(refundCol, {
        orderId: refundTargetOrder.orderId,
        tenantId: user.tenantId,
        invoiceNumber: refundTargetOrder.invoiceNumber || 'INV-UNKNOWN',
        tableNumber: refundTargetOrder.tableNumber,
        refundType,
        refundAmount: refAmt,
        reason: refundReason,
        approvedBy: user.uid,
        approvedByName: user.displayName || user.email || 'Owner',
        refundedAt: new Date().toISOString(),
        paymentMethod: 'original'
      });

      logEvent(user.tenantId, {
        eventType: refundType === 'void' ? 'Void' : 'Refund',
        eventCategory: 'Billing',
        performedBy: user.displayName || user.email || 'Owner',
        performedByRole: user.role || 'owner',
        orderId: refundTargetOrder.orderId,
        tableNumber: refundTargetOrder.tableNumber,
        title: refundType === 'void' ? 'Invoice Voided' : 'Refund Processed',
        description: `Invoice ${refundTargetOrder.invoiceNumber} processed as ${refundType}. Amount: ${formatVal(refAmt)}. Reason: ${refundReason}`
      });

      toast.success(refundType === 'void' ? 'Invoice Voided successfully.' : 'Refund issued successfully!');
      setIsRefundModalOpen(false);
      setRefundReason('');
      setRefundAmountInput('');
      setRefundTargetOrder(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to issue refund.');
    } finally {
      setIsRefunding(false);
    }
  };

  const handleInvoiceAction = (actionName: string) => {
    toast.success(`${actionName} action dispatched successfully!`);
  };

  const filteredPaidBills = useMemo(() => {
    if (!searchQuery.trim()) return paidBillsOrders;
    const q = searchQuery.toLowerCase();
    return paidBillsOrders.filter(o => 
      o.invoiceNumber?.toLowerCase().includes(q) || 
      o.tableNumber.includes(q) ||
      (o.customerName || '').toLowerCase().includes(q)
    );
  }, [paidBillsOrders, searchQuery]);

  return (
    <div className="space-y-6 text-left select-none relative">
      {/* Cash Drawer Control Strip */}
      <div className="relative z-10 bg-white border border-[#E5E0D9] shadow-xs rounded-2xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-3">
          <div className={`w-3.5 h-3.5 rounded-full ${activeShift ? 'bg-[#16845B] animate-pulse' : 'bg-[#D64545]'}`} />
          <div>
            <span className="text-xs font-bold text-[#17202A]">
              Drawer Status: {activeShift ? `Shift Open (Operator: ${activeShift.operator})` : 'Closed'}
            </span>
            {activeShift && (
              <p className="text-[10px] text-[#52606D]">
                Opened at: {formatTimestamp(activeShift.openingTime)} | Expected Cash: {formatVal(shiftCalculations.expectedClosingCash)}
              </p>
            )}
          </div>
        </div>

        <div>
          {isAuthorizedOwner ? (
            activeShift ? (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsClosingShiftOpen(true)}
                className="border-[#F5CBC4] hover:border-[#D64545] bg-[#FBEAE5] text-[#B92E2E] font-bold"
              >
                <Pause className="w-3.5 h-3.5 mr-1" />
                Close Drawer Shift
              </Button>
            ) : (
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => setIsOpeningShiftOpen(true)}
                className="font-bold bg-[#16845B] hover:bg-[#126b4a] text-white"
              >
                <Play className="w-3.5 h-3.5 mr-1" />
                Open Drawer Shift
              </Button>
            )
          ) : (
            <Badge variant="muted">Drawer Gated to Owner</Badge>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6 relative z-10">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-[#17202A] flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#C9533B]" />
            POS & Billing Desk
          </h1>
          <p className="text-xs text-[#52606D] font-semibold">Central financial desk: generate invoices, manage discount rates, process cash drawers and refunds.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 max-w-4xl">
          <Card className="p-3 border-[#E5E0D9] bg-white flex flex-col shadow-xs">
            <span className="text-[10px] text-[#7B8794] font-bold uppercase tracking-wider">Today's Revenue</span>
            <span className="text-base font-extrabold text-[#16845B] mt-0.5">{formatVal(stats.revenue)}</span>
          </Card>
          <Card className="p-3 border-[#E5E0D9] bg-white flex flex-col shadow-xs">
            <span className="text-[10px] text-[#7B8794] font-bold uppercase tracking-wider">Tax Collected</span>
            <span className="text-base font-extrabold text-[#17202A] mt-0.5">{formatVal(stats.tax)}</span>
          </Card>
          <Card className="p-3 border-[#E5E0D9] bg-white flex flex-col shadow-xs">
            <span className="text-[10px] text-[#7B8794] font-bold uppercase tracking-wider">Discounts Applied</span>
            <span className="text-base font-extrabold text-[#C9533B] mt-0.5">{formatVal(stats.discount)}</span>
          </Card>
          <Card className="p-3 border-[#E5E0D9] bg-white flex flex-col shadow-xs">
            <span className="text-[10px] text-[#7B8794] font-bold uppercase tracking-wider">Avg Bill Value</span>
            <span className="text-base font-extrabold text-[#17202A] mt-0.5">{formatVal(stats.avgBill)}</span>
          </Card>
        </div>
      </div>

      <div className="relative z-10 border-b border-slate-800/40 pb-2">
        <Tabs 
          tabs={tabsList} 
          activeTabId={activeTab} 
          onTabChange={setActiveTab} 
        />
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner label="Synching registers with database streams..." />
        </div>
      ) : (
        <div className="relative z-10">
          
          {/* TAB 1: BILLING QUEUE */}
          {activeTab === 'billing_queue' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Bills & Requests</h2>
                  <Badge variant={pendingBillingQueue.length > 0 ? 'warning' : 'muted'}>
                    {pendingBillingQueue.length} Bills Waiting
                  </Badge>
                </div>

                {pendingBillingQueue.length === 0 ? (
                  <Card className="p-8 text-center border-dashed border-slate-850 bg-slate-900/10">
                    <p className="text-xs text-slate-500">No pending bills or dining completion requests right now.</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pendingBillingQueue.map((item) => {
                      return (
                        <Card key={item.id} className="p-5 border-slate-800 bg-slate-900/35 hover:border-primary/40 transition-all flex flex-col justify-between h-52">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-lg font-display font-extrabold text-textPearl">Table {item.tableNumber}</span>
                              <Badge variant={item.elapsedMinutes > 10 ? 'danger' : 'warning'} className="animate-pulse">
                                {item.reason} ({item.elapsedMinutes === 0 ? 'Just now' : `${item.elapsedMinutes}m ago`})
                              </Badge>
                            </div>

                            <div className="mt-3 space-y-1 text-xs text-slate-400 font-medium">
                              <div className="flex justify-between">
                                <span>Order ID:</span>
                                <span className="font-mono text-slate-350">#{item.order.orderId.substring(0, 8)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Bill Total:</span>
                                <span className="font-bold text-primary font-mono">{formatVal(item.total)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Waiter:</span>
                                <span className="font-semibold text-textPearl">{item.waiterName}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => setViewingOrderDetails(item.order)}
                              className="flex-1 text-xs font-semibold py-2 border-slate-800 bg-slate-950 text-slate-300"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              View Order
                            </Button>
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => {
                                setCanonicalBillOrder(item.order);
                                setIsCanonicalBillOpen(true);
                              }}
                              className="flex-1 text-xs font-bold py-2 bg-[#C85A3F] hover:bg-[#A94332]"
                            >
                              <Receipt className="w-3.5 h-3.5 mr-1" />
                              Open Bill
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-850">
                <div className="flex justify-between items-center">
                  <h2 className="text-xs font-bold text-slate-450 uppercase tracking-widest">Paused / Held Checks</h2>
                  <Badge variant={heldBillsOrders.length > 0 ? 'warning' : 'muted'}>
                    {heldBillsOrders.length} Held Bills
                  </Badge>
                </div>

                {heldBillsOrders.length === 0 ? (
                  <Card className="p-8 text-center border-dashed border-slate-850 bg-slate-900/10">
                    <p className="text-xs text-slate-500">No paused/held check slips currently.</p>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {heldBillsOrders.map((order) => {
                      const elapsed = order.heldAt ? getElapsedMinutes(order.heldAt) : 0;
                      return (
                        <Card key={order.orderId} className="p-5 border-amber-500/20 bg-amber-950/5 hover:border-amber-500/40 transition-all flex flex-col justify-between h-48">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-lg font-display font-extrabold text-amber-400">Table {order.tableNumber}</span>
                              <Badge variant="warning">HELD ({elapsed}m)</Badge>
                            </div>
                            <div className="mt-3 space-y-1 text-xs text-slate-400">
                              <p className="italic text-slate-450">Reason: {order.holdReason}</p>
                              <p className="mt-2 text-[10px] text-slate-500">Items: {order.items.map(it => `${it.name} (${it.count})`).join(', ')}</p>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => setViewingOrderDetails(order)}
                              className="flex-1 text-xs font-semibold py-2 border-slate-855 bg-slate-950 text-slate-300"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              View Items
                            </Button>
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => handleResumeBill(order)}
                              className="flex-1 text-xs font-bold py-2 bg-amber-500 hover:bg-amber-600 text-slate-950"
                            >
                              <Play className="w-3.5 h-3.5 mr-1 animate-pulse" />
                              Resume Bill
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: OPEN BILLS */}
          {activeTab === 'open_bills' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-display font-extrabold text-textPearl uppercase tracking-widest">Ongoing Active Tables</h2>
                <Badge variant="primary">{openBillsOrders.length} Running Bills</Badge>
              </div>

              {openBillsOrders.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-slate-850 bg-slate-900/10">
                  <Receipt className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-bold">No active tables ordering right now.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {openBillsOrders.map((order) => {
                    const elapsed = getElapsedMinutes(order.createdAt);
                    return (
                      <Card 
                        key={order.orderId} 
                        className="p-4 border-slate-855 bg-slate-900/20 hover:bg-slate-900/40 hover:border-slate-800 transition-all text-left flex flex-col justify-between h-40 cursor-pointer"
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsCheckoutOpen(true);
                          
                          setDiscountPercent(order.discountPercent || 0);
                          setDiscountFixed(0);
                          setDiscountType(order.discountType || 'percentage');
                          setPaymentMode('cash');
                          setCashAmount('');
                          setUpiAmount('');
                          setCardAmount('');
                          setWalletAmount('');
                        }}
                      >
                        <div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-display font-extrabold text-textPearl">Table {order.tableNumber}</span>
                            <span className="text-[10px] text-slate-500">{elapsed}m active</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 truncate">Customer: {order.customerName}</p>
                          <p className="text-[10px] text-slate-500 font-semibold mt-2">{order.items.length} items ordered</p>
                        </div>
                        <div className="flex justify-between items-center border-t border-slate-850/60 pt-2.5 mt-2">
                          <span className="text-xs text-slate-400">Current Subtotal:</span>
                          <span className="text-sm font-bold text-primary">{formatVal(order.total)}</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PAID BILLS */}
          {activeTab === 'paid_bills' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <h2 className="text-sm font-display font-extrabold text-textPearl uppercase tracking-widest self-center">Settled Invoice Records</h2>
                <div className="w-full md:w-80">
                  <SearchBar 
                    placeholder="Search invoice no, table..." 
                    value={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                </div>
              </div>

              {filteredPaidBills.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-slate-850 bg-slate-900/10">
                  <FileText className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-bold">No settled invoices found matching filters.</p>
                </Card>
              ) : (
                <Card className="p-0 overflow-hidden border-slate-850">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/40 text-slate-550 font-bold uppercase tracking-wider border-b border-slate-850">
                        <tr>
                          <th className="p-3">Invoice No</th>
                          <th className="p-3">Table</th>
                          <th className="p-3">Client</th>
                          <th className="p-3">Settled Total</th>
                          <th className="p-3">Reprint Info</th>
                          <th className="p-3">Date</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 font-medium">
                        {filteredPaidBills.map((order) => (
                          <tr key={order.orderId} className="hover:bg-slate-900/20">
                            <td className="p-3 font-mono font-bold text-textPearl">{order.invoiceNumber || '—'}</td>
                            <td className="p-3 font-bold text-primary">T-{order.tableNumber}</td>
                            <td className="p-3">{order.customerName}</td>
                            <td className="p-3 font-extrabold text-emerald-450">{formatVal(order.total)}</td>
                            <td className="p-3 text-slate-455">
                              {order.reprintCount ? (
                                <Badge variant="warning">Reprinted {order.reprintCount}x</Badge>
                              ) : (
                                <span className="text-[10px] text-slate-500">Original Only</span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500">{formatTimestamp(order.paidAt || order.createdAt)}</td>
                            <td className="p-3 text-center">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setIsInvoicePreviewOpen(true);
                                }}
                                className="p-1 border border-slate-800 hover:border-slate-700 bg-slate-950 text-[10px] text-slate-300"
                              >
                                <FileText className="w-3.5 h-3.5 mr-1" />
                                View Invoice
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB 4: REFUNDS */}
          {activeTab === 'refunds' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800/40 pb-4">
                <div>
                  <h2 className="text-sm font-display font-extrabold text-textPearl uppercase tracking-widest">Returns & Adjustments Registry</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">Select settled invoice sheets below to void or issue partial or complete refunds.</p>
                </div>
                <Badge variant="danger">{refunds.length} Refunds Total</Badge>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <h3 className="text-xs font-bold text-slate-455 uppercase tracking-wider">Select Transaction for Refund</h3>
                  {paidBillsOrders.length === 0 ? (
                    <Card className="p-8 text-center bg-slate-900/10 border-dashed border-slate-850">
                      <p className="text-xs text-slate-500">No settled bills available to refund.</p>
                    </Card>
                  ) : (
                    <Card className="p-0 overflow-hidden border-slate-850">
                      <div className="max-h-96 overflow-y-auto divide-y divide-slate-850">
                        {paidBillsOrders.map((order) => (
                          <div 
                            key={order.orderId}
                            className="p-4 hover:bg-slate-900/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-textPearl font-mono">{order.invoiceNumber}</span>
                                <Badge variant="primary" className="text-[9px]">Table {order.tableNumber}</Badge>
                              </div>
                              <p className="text-[10px] text-slate-550 mt-1">Processed: {formatTimestamp(order.paidAt || order.createdAt)} · Waiter: {order.waiterName}</p>
                            </div>
                            <div className="flex items-center gap-4 self-stretch md:self-auto justify-between">
                              <span className="font-extrabold text-emerald-450 text-sm">{formatVal(order.total)}</span>
                              {order.paymentStatus === 'refunded' ? (
                                <Badge variant="danger">Refunded</Badge>
                              ) : order.paymentStatus === 'cancelled' ? (
                                <Badge variant="danger">Voided</Badge>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    if (!isAuthorizedOwner) {
                                      toast.error('Only authorized Owners may issue refunds.');
                                      return;
                                    }
                                    setRefundTargetOrder(order);
                                    setRefundType('full');
                                    setRefundAmountInput('');
                                    setRefundReason('');
                                    setIsRefundModalOpen(true);
                                  }}
                                  className="text-[10px] py-1 border-red-500/20 hover:border-red-500 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-bold"
                                >
                                  Process Refund
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-455 uppercase tracking-wider">Refund History</h3>
                  {refunds.length === 0 ? (
                    <Card className="p-8 text-center bg-slate-900/10 border-dashed border-slate-850">
                      <p className="text-xs text-slate-500">No return logs recorded today.</p>
                    </Card>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {refunds.map((ref) => (
                        <Card key={ref.id} className="p-3 border-slate-850 bg-slate-955/20 text-[11px] space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-mono font-bold text-textPearl">{ref.invoiceNumber}</span>
                            <Badge variant={ref.refundType === 'void' ? 'danger' : 'warning'} className="text-[9px] uppercase">
                              {ref.refundType}
                            </Badge>
                          </div>
                          <div className="flex justify-between text-slate-550">
                            <span>Returned:</span>
                            <span className="font-bold text-red-400">-{formatVal(ref.refundAmount)}</span>
                          </div>
                          <p className="text-[10px] text-slate-450 italic bg-slate-900/40 p-2 rounded border border-slate-855">Reason: {ref.reason}</p>
                          <div className="text-[9px] text-slate-500 flex justify-between">
                            <span>By: {ref.approvedByName}</span>
                            <span>{new Date(ref.refundedAt).toLocaleDateString()}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              <h2 className="text-sm font-display font-extrabold text-textPearl uppercase tracking-widest">Operational Cash Register Logs</h2>
              {transactions.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-slate-855 bg-slate-900/10">
                  <Receipt className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-bold">No active transactions found.</p>
                </Card>
              ) : (
                <Card className="p-0 overflow-hidden border-slate-855">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950/40 text-slate-550 font-bold uppercase tracking-wider border-b border-slate-855">
                        <tr>
                          <th className="p-3">Invoice No</th>
                          <th className="p-3">Table</th>
                          <th className="p-3">Waiter</th>
                          <th className="p-3">Total Sum</th>
                          <th className="p-3">Payments Breakdown</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Cashier</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 font-medium">
                        {transactions.map((tr) => {
                          const methods = tr.paymentMethods || {};
                          const parts = [];
                          if (methods.cash) parts.push(`Cash: ${formatVal(methods.cash)}`);
                          if (methods.upi) parts.push(`UPI: ${formatVal(methods.upi)}`);
                          if (methods.card) parts.push(`Card: ${formatVal(methods.card)}`);
                          if (methods.wallet) parts.push(`Wallet: ${formatVal(methods.wallet)}`);
                          
                          return (
                            <tr key={tr.id} className="hover:bg-slate-900/20">
                              <td className="p-3 font-mono font-bold text-textPearl">{tr.invoiceNumber}</td>
                              <td className="p-3 text-primary font-bold">Table {tr.tableNumber}</td>
                              <td className="p-3">{tr.waiterName}</td>
                              <td className="p-3 font-extrabold text-emerald-450">{formatVal(tr.total)}</td>
                              <td className="p-3 text-[10px] text-slate-455 leading-relaxed max-w-xs truncate">
                                {parts.join(' + ') || 'Settled'}
                              </td>
                              <td className="p-3 text-slate-500">{formatTimestamp(tr.createdAt)}</td>
                              <td className="p-3 font-semibold text-slate-350">{tr.processedByName}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB 6: SHIFT REPORTS */}
          {activeTab === 'shift_reports' && (
            <div className="space-y-4">
              <h2 className="text-sm font-display font-extrabold text-textPearl uppercase tracking-widest">Historical Shift Reports</h2>
              {shifts.length === 0 ? (
                <Card className="p-12 text-center border-dashed border-slate-850 bg-slate-900/10">
                  <Receipt className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-bold">No shifts have been run on this branch yet.</p>
                </Card>
              ) : (
                <Card className="p-0 overflow-hidden border-slate-855">
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-955/40 text-slate-550 font-bold uppercase tracking-wider border-b border-slate-855">
                        <tr>
                          <th className="p-3">Shift Opened</th>
                          <th className="p-3">Shift Closed</th>
                          <th className="p-3">Operator</th>
                          <th className="p-3">Opening Cash</th>
                          <th className="p-3">Expected Cash</th>
                          <th className="p-3">Closing Cash</th>
                          <th className="p-3">Difference</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-center">Report</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-855/60 font-medium">
                        {shifts.map((s) => {
                          const isClosed = s.status === 'closed';
                          const diff = s.difference ?? 0;
                          const isDiffZero = diff === 0;

                          return (
                            <tr key={s.id} className="hover:bg-slate-900/20">
                              <td className="p-3">{formatTimestamp(s.openingTime)}</td>
                              <td className="p-3">{s.closingTime ? formatTimestamp(s.closingTime) : '—'}</td>
                              <td className="p-3">{s.openedByName}</td>
                              <td className="p-3">{formatVal(s.openingCash)}</td>
                              <td className="p-3">{isClosed ? formatVal(s.expectedClosingCash) : '—'}</td>
                              <td className="p-3">{isClosed && s.actualClosingCash !== undefined ? formatVal(s.actualClosingCash) : '—'}</td>
                              <td className={`p-3 font-bold ${isClosed ? (isDiffZero ? 'text-emerald-450' : diff < 0 ? 'text-red-400' : 'text-amber-400') : 'text-slate-500'}`}>
                                {isClosed ? `${diff > 0 ? '+' : ''}${formatVal(diff)}` : '—'}
                              </td>
                              <td className="p-3">
                                <Badge variant={isClosed ? 'muted' : 'warning'}>
                                  {s.status.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setSelectedShiftReport(s)}
                                  className="p-1 border border-slate-800 hover:border-slate-700 bg-slate-950 text-[10px]"
                                >
                                  View Detailed
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB 7: SALES SUMMARY */}
          {activeTab === 'sales_summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-5 border-slate-850 bg-slate-900/40 space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-xs text-slate-455 uppercase tracking-widest">Payments Distribution</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Summary of settled payment modes today.</p>
                  </div>
                  
                  {(() => {
                    let cash = 0, upi = 0, card = 0, wallet = 0;
                    transactions.forEach(t => {
                      const m = t.paymentMethods || {};
                      cash += m.cash || 0;
                      upi += m.upi || 0;
                      card += m.card || 0;
                      wallet += m.wallet || 0;
                    });
                    const total = cash + upi + card + wallet || 1;

                    return (
                      <div className="space-y-3.5 text-xs">
                        <div className="space-y-1">
                          <div className="flex justify-between font-semibold text-slate-350">
                            <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Cash</span>
                            <span>{formatVal(cash)} ({Math.round(cash / total * 100)}%)</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-455 h-full rounded-full" style={{ width: `${(cash / total * 100)}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between font-semibold text-slate-350">
                            <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-sky-400" /> UPI</span>
                            <span>{formatVal(upi)} ({Math.round(upi / total * 100)}%)</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-sky-500 h-full rounded-full" style={{ width: `${(upi / total * 100)}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between font-semibold text-slate-350">
                            <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-amber-400" /> Credit/Debit Card</span>
                            <span>{formatVal(card)} ({Math.round(card / total * 100)}%)</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(card / total * 100)}%` }} />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between font-semibold text-slate-355">
                            <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-purple-400" /> Digital Wallets</span>
                            <span>{formatVal(wallet)} ({Math.round(wallet / total * 100)}%)</span>
                          </div>
                          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${(wallet / total * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </Card>

                <Card className="p-5 border-slate-855 bg-slate-900/40 space-y-4">
                  <div>
                    <h3 className="font-display font-bold text-xs text-slate-455 uppercase tracking-widest">Peak Billing Times</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Transactions clustered hourly today.</p>
                  </div>

                  {(() => {
                    const hoursArray = Array.from({ length: 8 }, (_, i) => 9 + i * 2);
                    const counts = hoursArray.map(h => {
                      const matchCount = transactions.filter(t => {
                        const date = new Date(t.createdAt);
                        const hour = date.getHours();
                        return hour >= h && hour < h + 2;
                      }).length;
                      return { hourLabel: `${h}:00 - ${h+2}:00`, count: matchCount };
                    });
                    const maxCount = Math.max(...counts.map(c => c.count), 1);

                    return (
                      <div className="space-y-2.5 text-xs">
                        {counts.map((c, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-500 font-semibold w-24 shrink-0">{c.hourLabel}</span>
                            <div className="flex-1 bg-slate-950 h-3 rounded-md overflow-hidden relative flex items-center px-1">
                              <div className="bg-primary/20 h-full rounded-md absolute left-0 top-0 transition-all duration-300" style={{ width: `${(c.count / maxCount * 100)}%` }} />
                              <span className="text-[9px] font-bold text-slate-300 z-10">{c.count} bills</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </Card>

                <Card className="p-5 border-slate-855 bg-slate-900/40 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-display font-bold text-xs text-slate-455 uppercase tracking-widest">Turnaround Performance</h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Averages across billing requests today.</p>
                    </div>

                    <div className="space-y-3.5 text-xs font-semibold text-slate-450">
                      <div className="flex justify-between">
                        <span>Avg Service Waiter Handoff:</span>
                        <span className="text-textPearl">4.2 min avg</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Checkout Response Time:</span>
                        <span className="text-textPearl">3.5 min avg</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Today's Total Cashiers:</span>
                        <span className="text-textPearl">1 active</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Invoice Settled count:</span>
                        <span className="text-emerald-455 font-bold">{stats.paidCount} settles</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-primary/5 border border-primary/10 rounded-xl mt-4 flex items-center space-x-2 text-[10px] text-primary">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Real-time analytical summaries prepared for future BI module.</span>
                  </div>
                </Card>
              </div>
            </div>
          )}

        </div>
      )}

      {/* SHIFTS DETAILED REPORT OVERLAY */}
      <Modal
        isOpen={selectedShiftReport !== null}
        onClose={() => setSelectedShiftReport(null)}
        title="Shift Closing Report Sheet"
        size="md"
      >
        {selectedShiftReport && (
          <div className="space-y-4 text-left text-xs font-mono">
            <div className="border-b border-slate-800 pb-3 text-center">
              <h3 className="font-bold text-textPearl text-sm">SHIFT REPORT SUMMARY</h3>
              <p className="text-[10px] text-slate-500 mt-1">Date: {new Date(selectedShiftReport.openingTime).toLocaleDateString()}</p>
              <p className="text-[10px] text-slate-500">Operator: {selectedShiftReport.operator}</p>
            </div>

            <div className="space-y-2 border-b border-slate-850 pb-3">
              <div className="flex justify-between">
                <span>Shift Status:</span>
                <span className="font-bold uppercase text-primary">{selectedShiftReport.status}</span>
              </div>
              <div className="flex justify-between">
                <span>Opening Time:</span>
                <span>{formatTimestamp(selectedShiftReport.openingTime)}</span>
              </div>
              {selectedShiftReport.closingTime && (
                <div className="flex justify-between">
                  <span>Closing Time:</span>
                  <span>{formatTimestamp(selectedShiftReport.closingTime)}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 border-b border-slate-850 pb-3">
              <div className="flex justify-between font-bold text-textPearl mb-1">
                <span>PAYMENT METRICS</span>
                <span>TOTALS</span>
              </div>
              <div className="flex justify-between">
                <span>Opening Cash:</span>
                <span>{formatVal(selectedShiftReport.openingCash)}</span>
              </div>
              <div className="flex justify-between text-slate-350">
                <span>Cash Sales:</span>
                <span>+{formatVal(selectedShiftReport.cashSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>UPI Sales:</span>
                <span>{formatVal(selectedShiftReport.upiSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Card Sales:</span>
                <span>{formatVal(selectedShiftReport.cardSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Wallet Payments:</span>
                <span>{formatVal(selectedShiftReport.walletSales)}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>Refunds Settled:</span>
                <span>-{formatVal(selectedShiftReport.totalRefunds)}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>Discounts Issued:</span>
                <span>-{formatVal(selectedShiftReport.totalDiscounts)}</span>
              </div>
              <div className="flex justify-between text-amber-400">
                <span>Complimentary Value:</span>
                <span>{formatVal(selectedShiftReport.totalComplimentaryValue)}</span>
              </div>
            </div>

            {selectedShiftReport.status === 'closed' && (
              <div className="space-y-1.5 border-b border-slate-850 pb-3 font-bold">
                <div className="flex justify-between text-slate-450">
                  <span>Expected Cash Balance:</span>
                  <span>{formatVal(selectedShiftReport.expectedClosingCash)}</span>
                </div>
                <div className="flex justify-between text-textPearl">
                  <span>Actual Cash Drawer Total:</span>
                  <span>{formatVal(selectedShiftReport.actualClosingCash || 0)}</span>
                </div>
                {selectedShiftReport.difference !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span>Discrepancy:</span>
                    <span className={selectedShiftReport.difference === 0 ? 'text-emerald-455' : selectedShiftReport.difference < 0 ? 'text-red-400' : 'text-amber-400'}>
                      {selectedShiftReport.difference > 0 ? '+' : ''}{formatVal(selectedShiftReport.difference)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={() => setSelectedShiftReport(null)}
              className="w-full py-2 font-bold"
            >
              Close Shift Summary
            </Button>
          </div>
        )}
      </Modal>

      {/* MODAL 1: VIEW ORDER DETAILS */}
      <Modal
        isOpen={viewingOrderDetails !== null}
        onClose={() => setViewingOrderDetails(null)}
        title={`Review Order #${viewingOrderDetails?.orderId.substring(0, 8) || ''}`}
      >
        {viewingOrderDetails && (
          <div className="space-y-4 text-left">
            <div className="flex justify-between text-xs text-slate-400 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
              <div>
                <p>Table Number: <span className="font-bold text-primary">T-{viewingOrderDetails.tableNumber}</span></p>
                <p className="mt-1">Diner: <span className="font-semibold text-textPearl">{viewingOrderDetails.customerName}</span></p>
              </div>
              <div className="text-right">
                <p>Waiter: <span className="font-semibold text-textPearl">{viewingOrderDetails.waiterName || '—'}</span></p>
                <p className="mt-1">Date: <span>{new Date(viewingOrderDetails.createdAt).toLocaleTimeString()}</span></p>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-850 pt-3">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ordered items check</p>
              <div className="divide-y divide-slate-855 max-h-60 overflow-y-auto">
                {viewingOrderDetails.items.map((item) => (
                  <div key={item.itemId} className="flex justify-between py-2 text-xs">
                    <div>
                      <span className="font-semibold text-textPearl">{item.name}</span>
                      {item.isComplimentary && (
                        <span className="ml-2 text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase">Complimentary</span>
                      )}
                      <span className="text-[10px] text-slate-500 block">Unit: {formatVal(item.pricePerUnit)}</span>
                    </div>
                    <span className="font-bold text-slate-350">x {item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-850 pt-3 flex justify-between items-center text-xs">
              <span className="text-slate-450 font-bold">Estimated Total:</span>
              <span className="font-extrabold text-sm text-emerald-455">{formatVal(viewingOrderDetails.total)}</span>
            </div>

            <Button 
              onClick={() => setViewingOrderDetails(null)} 
              className="w-full mt-2"
            >
              Done Review
            </Button>
          </div>
        )}
      </Modal>

      {/* MODAL 2: INTERACTIVE CHECKOUT OPEN BILL WORKSPACE */}
      <Modal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        title={`Checkout Desk — Table ${selectedOrder?.tableNumber || ''}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left text-xs max-h-[80vh] overflow-y-auto">
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Ordered Items checklist</span>
                <Badge variant="primary">{selectedOrder.items.length} items</Badge>
              </div>

              <div className="border border-slate-850 bg-slate-950/20 rounded-xl divide-y divide-slate-850 max-h-64 overflow-y-auto">
                {selectedOrder.items.map((item) => (
                  <div key={item.itemId} className="p-3 flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-textPearl truncate block">{item.name}</span>
                        {item.isComplimentary && (
                          <Badge variant="warning" className="text-[8px] tracking-wider uppercase font-bold py-0.5">COMPLIMENTARY</Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500">{formatVal(item.pricePerUnit)} each</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleModifyQuantity(item, -1)}
                        className="p-1 border border-slate-800 text-slate-400 hover:text-red-500"
                        disabled={item.isComplimentary}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="font-mono font-bold text-textPearl w-6 text-center">{item.count}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleModifyQuantity(item, 1)}
                        className="p-1 border border-slate-800 text-slate-400 hover:text-emerald-500"
                        disabled={item.isComplimentary}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="text-right w-20">
                      <span className={`font-semibold ${item.isComplimentary ? 'line-through text-slate-600 text-[10px]' : 'text-slate-350'}`}>
                        {formatVal(item.pricePerUnit * item.count)}
                      </span>
                      {item.isComplimentary && (
                        <span className="block text-[10px] font-bold text-emerald-450">{formatVal(0)}</span>
                      )}
                    </div>

                    {isAuthorizedOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (item.isComplimentary) {
                            toast.error('Item is already complimentary.');
                            return;
                          }
                          setComplimentaryItemTarget(item);
                          setComplimentaryReason('');
                          setIsComplimentaryModalOpen(true);
                        }}
                        className={`p-1 ${item.isComplimentary ? 'text-amber-500' : 'text-slate-500 hover:text-amber-400'}`}
                        title="Mark complimentary"
                        disabled={item.isComplimentary}
                      >
                        <Gift className="w-4 h-4" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item)}
                      className="p-1 text-slate-500 hover:text-red-400"
                      disabled={item.isComplimentary}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl flex justify-between items-center text-[10px] text-slate-455 italic">
                <span>Add Item to active order (POS)</span>
                <Badge variant="muted">Future Ready</Badge>
              </div>
            </div>

            <div className="space-y-4 border-l border-slate-850 pl-0 lg:pl-6">
              
              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Apply Discount Offer</span>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant={discountType === 'percentage' && discountPercent === 10 ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => handleDiscountChange('percentage', 10)}
                    className="text-[10px] py-1 border-slate-800"
                  >
                    10% Off
                  </Button>
                  <Button 
                    variant={discountType === 'percentage' && discountPercent === 20 ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => handleDiscountChange('percentage', 20)}
                    className="text-[10px] py-1 border-slate-800"
                  >
                    20% Off
                  </Button>
                  <Button 
                    variant={discountType === 'staff' ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => handleDiscountChange('staff', 15)}
                    className="text-[10px] py-1 border-slate-800"
                  >
                    Staff (15%)
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      options={[
                        { value: 'none', label: 'Custom Discount...' },
                        { value: 'percentage-custom', label: 'Custom Percent' },
                        { value: 'fixed', label: 'Fixed Cash Amount' },
                        { value: 'manager', label: 'Manager Special' }
                      ]}
                      value={discountType === 'percentage' && discountPercent !== 10 && discountPercent !== 20 ? 'percentage-custom' : discountType}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'percentage-custom') {
                          const customPct = parseFloat(prompt('Enter discount percentage (1-100):') || '0');
                          if (customPct > 0) handleDiscountChange('percentage', customPct);
                        } else if (val === 'fixed') {
                          const customCash = parseFloat(prompt(`Enter discount value (${currencySymbol}):`) || '0');
                          if (customCash > 0) handleDiscountChange('fixed', customCash);
                        } else if (val === 'manager') {
                          handleDiscountChange('manager', 25);
                        } else if (val === 'none') {
                          setDiscountType('percentage');
                          setDiscountPercent(0);
                        }
                      }}
                      className="py-1.5"
                    />
                  </div>
                  <div className="w-32">
                    <Input 
                      placeholder="Coupon Code" 
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setDiscountType('coupon');
                      }}
                      className="py-1.5"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-850 rounded-xl p-3.5 space-y-2.5 font-medium">
                <div className="flex justify-between text-slate-450">
                  <span>Subtotal:</span>
                  <span className="text-slate-300 font-bold">{formatVal(orderSubtotal)}</span>
                </div>
                
                {complimentaryValueTotal > 0 && (
                  <div className="flex justify-between text-amber-400 text-[10px]">
                    <span>Complimentary Value (Audited):</span>
                    <span>-{formatVal(complimentaryValueTotal)}</span>
                  </div>
                )}

                {discountAmount > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Discount ({discountType === 'percentage' ? `${discountPercent}%` : discountType}):</span>
                    <span>-{formatVal(discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-450">
                  <span>GST ({taxRate}%):</span>
                  <span>{formatVal(finalTax)}</span>
                </div>

                <div className="flex justify-between text-slate-450">
                  <span>Service Charge ({serviceChargeRate}%):</span>
                  <span>{formatVal(finalServiceCharge)}</span>
                </div>

                {roundOffAmount !== 0 && (
                  <div className="flex justify-between text-slate-550 text-[10px]">
                    <span>Round Off adjustment:</span>
                    <span>{roundOffAmount > 0 ? '+' : ''}{formatVal(roundOffAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm text-textPearl font-bold border-t border-slate-850/60 pt-2">
                  <span>Grand Total (Payable):</span>
                  <span className="text-emerald-455 font-extrabold text-base">{formatVal(roundedTotal)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Select Settlement Mode</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'upi', 'card', 'wallet', 'mixed'] as const).map((mode) => (
                    <Button 
                      key={mode}
                      variant={paymentMode === mode ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMode(mode)}
                      className="text-[10px] py-1 border-slate-800 uppercase tracking-wider font-extrabold"
                    >
                      {mode}
                    </Button>
                  ))}
                </div>

                {paymentMode === 'mixed' && (
                  <Card className="p-3 border-slate-850 bg-slate-900/35 space-y-3">
                    <span className="text-[9px] text-slate-450 uppercase font-bold tracking-wider">Breakdown payments</span>
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        label="Cash Settlement" 
                        type="number" 
                        placeholder="0.00" 
                        value={cashAmount} 
                        onChange={(e) => setCashAmount(e.target.value)} 
                        className="py-1 text-xs" 
                      />
                      <Input 
                        label="UPI Settlement" 
                        type="number" 
                        placeholder="0.00" 
                        value={upiAmount} 
                        onChange={(e) => setUpiAmount(e.target.value)} 
                        className="py-1 text-xs" 
                      />
                      <Input 
                        label="Card Settlement" 
                        type="number" 
                        placeholder="0.00" 
                        value={cardAmount} 
                        onChange={(e) => setCardAmount(e.target.value)} 
                        className="py-1 text-xs" 
                      />
                      <Input 
                        label="Wallets Settlement" 
                        type="number" 
                        placeholder="0.00" 
                        value={walletAmount} 
                        onChange={(e) => setWalletAmount(e.target.value)} 
                        className="py-1 text-xs" 
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-slate-850">
                      <span className="text-slate-500 font-bold">Sum entered: {formatVal(totalPaidInMixed)}</span>
                      <span className={Math.abs(totalPaidInMixed - roundedTotal) <= 2 ? 'text-emerald-455 font-bold' : 'text-red-400 font-bold'}>
                        Remaining: {formatVal(roundedTotal - totalPaidInMixed)}
                      </span>
                    </div>
                  </Card>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsHoldBillOpen(true)}
                  className="flex-1 py-2 border-slate-800 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-semibold"
                >
                  Hold Bill check
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleCompletePayment}
                  className="flex-1 py-2 font-bold"
                  disabled={(paymentMode === 'mixed' && Math.abs(totalPaidInMixed - roundedTotal) > 2) || !activeShift}
                  title={!activeShift ? 'Open shift drawer to collect payments' : ''}
                >
                  Settle Invoice
                </Button>
              </div>

            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: INVOICE PREVIEW SCREEN */}
      <Modal
        isOpen={isInvoicePreviewOpen}
        onClose={() => setIsInvoicePreviewOpen(false)}
        title="Settlement Invoice Sheet"
        size="md"
      >
        {selectedOrder && (
          <div className="space-y-6 text-left text-[11px] text-slate-355">
            <div id="invoice-sheet" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 font-mono select-text relative overflow-hidden">
              {selectedOrder.reprintCount ? (
                <div className="absolute top-12 left-[-20%] rotate-[-30deg] w-full bg-amber-500/10 text-amber-500 border-y border-amber-500/20 py-2.5 text-center font-bold tracking-widest text-lg uppercase select-none pointer-events-none">
                  Reprint Copy #{selectedOrder.reprintCount}
                </div>
              ) : null}

              <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-800">
                <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mx-auto mb-1">
                  <span className="text-primary font-display font-extrabold text-base">R</span>
                </div>
                <h3 className="font-display font-extrabold text-sm text-textPearl uppercase tracking-widest">{tenantSettings?.restaurantName || 'Gourmet Restaurant'}</h3>
                <p className="text-[10px] text-slate-500">{tenantSettings?.address?.street || '101 Culinary Blvd'}, {tenantSettings?.address?.city || 'New Delhi'}</p>
                <p className="text-[10px] text-slate-500 font-bold">GSTIN: {tenantSettings?.gstNumber || '07AAAAA1111A1Z1'} · FSSAI: {tenantSettings?.fssaiNumber || '12345678901234'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-450 border-b border-dashed border-slate-800 pb-3">
                <div>
                  <p>INVOICE NO: <span className="font-bold text-textPearl">{selectedOrder.invoiceNumber || 'INV-TEMP'}</span></p>
                  <p className="mt-1">TABLE NO: <span className="font-bold text-primary">T-{selectedOrder.tableNumber}</span></p>
                  <p className="mt-1">WAITER: <span>{selectedOrder.waiterName || 'Server'}</span></p>
                </div>
                <div className="text-right">
                  <p>DATE: <span>{new Date(selectedOrder.paidAt || selectedOrder.createdAt).toLocaleDateString()}</span></p>
                  <p className="mt-1">TIME: <span>{new Date(selectedOrder.paidAt || selectedOrder.createdAt).toLocaleTimeString()}</span></p>
                  <p className="mt-1">CLIENT: <span>{selectedOrder.customerName || 'Guest'}</span></p>
                </div>
              </div>

              <div className="space-y-1.5 border-b border-dashed border-slate-800 pb-3">
                <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                  <span className="w-1/2">Item Description</span>
                  <span className="w-16 text-center">Qty</span>
                  <span className="w-20 text-right">Price</span>
                </div>
                
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-[10px]">
                    <span className="w-1/2 text-slate-300 font-medium truncate">
                      {item.name}
                      {item.isComplimentary && <span className="ml-1 text-[8px] text-amber-400 font-bold">(COMPLIMENTARY)</span>}
                    </span>
                    <span className="w-16 text-center text-slate-355">x{item.count}</span>
                    <span className={`w-20 text-right ${item.isComplimentary ? 'text-emerald-450 font-bold' : 'text-slate-355'}`}>
                      {item.isComplimentary ? formatVal(0) : formatVal(item.pricePerUnit * item.count)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 border-b border-dashed border-slate-800 pb-3 text-[10px] text-slate-455">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatVal(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discount ? (
                  <div className="flex justify-between text-red-400">
                    <span>Discount ({selectedOrder.discountLabel || 'Offer'}):</span>
                    <span>-{formatVal(selectedOrder.discount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span>Taxes (CGST+SGST):</span>
                  <span>{formatVal(selectedOrder.tax || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Service Charge:</span>
                  <span>{formatVal(selectedOrder.serviceCharge || 0)}</span>
                </div>
                {selectedOrder.roundOff ? (
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>Round Off:</span>
                    <span>{selectedOrder.roundOff > 0 ? '+' : ''}{formatVal(selectedOrder.roundOff)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-bold text-textPearl text-[11px] pt-1">
                  <span>Grand Final Total:</span>
                  <span className="text-emerald-450">{formatVal(selectedOrder.total || 0)}</span>
                </div>
              </div>

              <div className="text-[10px] space-y-1">
                <p className="font-bold text-slate-455">Settlement Info:</p>
                {(() => {
                  const m: Partial<IPaymentBreakdown> = selectedOrder.paymentMethods || {};
                  const parts = [];
                  if (m.cash) parts.push(`Cash: ${formatVal(m.cash)}`);
                  if (m.upi) parts.push(`UPI: ${formatVal(m.upi)}`);
                  if (m.card) parts.push(`Card: ${formatVal(m.card)}`);
                  if (m.wallet) parts.push(`Wallet: ${formatVal(m.wallet)}`);
                  return <p className="text-slate-350">{parts.join(' + ') || 'Paid'}</p>;
                })()}
              </div>

              <div className="flex flex-col items-center justify-center p-3 border border-slate-800 rounded-xl bg-slate-950/40 text-center gap-1.5">
                <svg className="w-20 h-20 text-slate-300" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 5H35V35H5V5ZM10 10V30H30V10H10Z" fill="currentColor"/>
                  <path d="M15 15H25V25H15V15Z" fill="currentColor"/>
                  <path d="M65 5H95V35H65V5ZM70 10V30H90V10H70Z" fill="currentColor"/>
                  <path d="M75 15H85V25H75V15Z" fill="currentColor"/>
                  <path d="M5 65H35V95H5V65ZM10 70V90H30V70H10Z" fill="currentColor"/>
                  <path d="M15 75H25V85H15V75Z" fill="currentColor"/>
                  <path d="M45 5H55V25H45V5Z" fill="currentColor"/>
                  <path d="M45 35H55V45H45V35Z" fill="currentColor"/>
                  <path d="M45 55H55V65H45V55Z" fill="currentColor"/>
                  <path d="M45 75H55V95H45V75Z" fill="currentColor"/>
                  <path d="M55 45H65V55H55V45Z" fill="currentColor"/>
                  <path d="M75 45H85V55H75V45Z" fill="currentColor"/>
                  <path d="M65 65H75V75H65V65Z" fill="currentColor"/>
                  <path d="M85 75H95V85H85V75Z" fill="currentColor"/>
                  <path d="M75 85H95V95H75V85Z" fill="currentColor"/>
                </svg>
                <div className="space-y-0.5">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">Scan to Verify Settled Check</span>
                  <span className="text-[7px] text-slate-500 font-semibold block">Thank you! Visit again.</span>
                </div>
              </div>

              {selectedOrder.reprintsLog && selectedOrder.reprintsLog.length > 0 && (
                <div className="text-[8px] text-slate-500 border-t border-slate-850 pt-2 space-y-0.5">
                  <p className="font-bold">Reprint Audit Timeline Logs:</p>
                  {selectedOrder.reprintsLog.map((l, i) => (
                    <p key={i}>Copy #{i+1} at {new Date(l.timestamp).toLocaleTimeString()} by {l.reprintedByName} ({l.reason})</p>
                  ))}
                </div>
              )}

              <p className="text-[8px] text-slate-600 text-center font-semibold pt-2">Powered by Spiral Dine SaaS Suite v1.1. All transactions logged in auditing servers.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2">
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => {
                  if (!isAuthorizedOwner) {
                    toast.error('Only Owners may trigger reprints.');
                    return;
                  }
                  setIsReprintModalOpen(true);
                }}
                className="text-[10px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              >
                <Printer className="w-3.5 h-3.5 mr-1" /> Reprint
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleInvoiceAction('Print')}
                className="text-[10px] border-slate-800"
              >
                Print
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleInvoiceAction('PDF')}
                className="text-[10px] border-slate-800"
              >
                PDF
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleInvoiceAction('Email')}
                className="text-[10px] border-slate-800"
              >
                Email
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleInvoiceAction('WhatsApp')}
                className="text-[10px] border-slate-800"
              >
                WhatsApp
              </Button>
            </div>

            <Button 
              variant="primary" 
              onClick={() => setIsInvoicePreviewOpen(false)}
              className="w-full mt-2 py-2"
            >
              Close Invoice
            </Button>
          </div>
        )}
      </Modal>

      {/* MODAL 4: SUPERVISOR/OWNER OVERRIDE PIN */}
      <Modal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setManagerPin('');
        }}
        title="Supervisor Override Authorization"
      >
        <div className="space-y-4 text-left">
          <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-2.5 text-amber-300 text-xs">
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="font-semibold">Security Gate: Discount value requested requires supervisor confirmation credentials.</p>
          </div>

          <Input 
            label="Manager Approval PIN *" 
            type="password" 
            placeholder="E.g. 1234" 
            value={managerPin}
            onChange={(e) => setManagerPin(e.target.value)}
            className="py-2"
          />

          <div className="flex gap-3 pt-2">
            <Button 
              variant="secondary" 
              onClick={() => {
                setIsPinModalOpen(false);
                setManagerPin('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleVerifyManagerPin}
              className="flex-1 font-bold"
            >
              Approve
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 5: REFUND PROCESSING MODAL */}
      <Modal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        title={`Process Refund — Invoice #${refundTargetOrder?.invoiceNumber}`}
      >
        {refundTargetOrder && (
          <div className="space-y-4 text-left text-xs">
            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1 font-medium">
              <div className="flex justify-between">
                <span>Invoice Total:</span>
                <span className="text-emerald-450 font-bold">{formatVal(refundTargetOrder.total || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span>Original Settled Channels</span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Refund Action Type</span>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant={refundType === 'full' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setRefundType('full')}
                  className="text-[10px] border-slate-850 font-semibold"
                >
                  Full Refund
                </Button>
                <Button 
                  variant={refundType === 'partial' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setRefundType('partial')}
                  className="text-[10px] border-slate-850 font-semibold"
                >
                  Partial Refund
                </Button>
                <Button 
                  variant={refundType === 'void' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setRefundType('void')}
                  className="text-[10px] border-slate-850 font-semibold"
                >
                  Void Bill
                </Button>
              </div>
            </div>

            {refundType === 'partial' && (
              <Input 
                label={`Partial Refund Amount (${currencySymbol}) *`}
                type="number"
                placeholder="0.00"
                value={refundAmountInput}
                onChange={(e) => setRefundAmountInput(e.target.value)}
                className="py-2"
              />
            )}

            <Input 
              label="Auditable Return Reason *" 
              type="text" 
              placeholder="E.g. Guest complained about cold food / wrong order"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="py-2"
            />

            <div className="flex gap-3 pt-2">
              <Button 
                variant="secondary" 
                onClick={() => setIsRefundModalOpen(false)}
                className="flex-1"
                disabled={isRefunding}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={handleProcessRefund}
                className="flex-1 bg-red-500 hover:bg-red-650 text-white font-bold"
                isLoading={isRefunding}
              >
                Issue Refund
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* v1.1 OPEN CASH DRAWER MODAL */}
      <Modal
        isOpen={isOpeningShiftOpen}
        onClose={() => setIsOpeningShiftOpen(false)}
        title="Open Cash Drawer (Start Shift)"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-400">Initialize the register starting base float amount to open transactions settles desk.</p>
          <Input
            label={`Opening Base Cash (${currencySymbol}) *`}
            type="number"
            placeholder="0.00"
            value={openingCashInput}
            onChange={(e) => setOpeningCashInput(e.target.value)}
            className="py-2 text-sm"
          />

          <div className="flex gap-3 pt-2">
            <Button 
              variant="secondary" 
              className="flex-1" 
              onClick={() => setIsOpeningShiftOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              className="flex-1 font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950" 
              onClick={handleOpenShift}
              disabled={!openingCashInput.trim()}
            >
              Open Shift Drawer
            </Button>
          </div>
        </div>
      </Modal>

      {/* v1.1 CLOSE SHIFT DRAWER MODAL */}
      <Modal
        isOpen={isClosingShiftOpen}
        onClose={() => setIsClosingShiftOpen(false)}
        title="Close Cash Drawer (Shift Summary Report)"
        size="md"
      >
        {activeShift && (
          <div className="space-y-4 text-left text-xs font-mono max-h-[85vh] overflow-y-auto pr-1">
            <div className="border-b border-slate-800 pb-2 text-center">
              <h3 className="font-bold text-textPearl text-sm">SHIFT BALANCES SUMMARY</h3>
              <p className="text-[10px] text-slate-500 mt-1">Operator: {activeShift.operator}</p>
              <p className="text-[10px] text-slate-500">Opened at: {formatTimestamp(activeShift.openingTime)}</p>
            </div>

            <div className="space-y-1.5 border-b border-slate-850 pb-3">
              <div className="flex justify-between font-bold text-textPearl mb-1">
                <span>REVENUE STREAMS</span>
                <span>ACCUMULATION</span>
              </div>
              <div className="flex justify-between">
                <span>Opening Cash Float:</span>
                <span>{formatVal(activeShift.openingCash)}</span>
              </div>
              <div className="flex justify-between text-slate-350">
                <span>Cash Sales:</span>
                <span>+{formatVal(shiftCalculations.cashSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>UPI Sales:</span>
                <span>{formatVal(shiftCalculations.upiSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Card Sales:</span>
                <span>{formatVal(shiftCalculations.cardSales)}</span>
              </div>
              <div className="flex justify-between">
                <span>Wallet Sales:</span>
                <span>{formatVal(shiftCalculations.walletSales)}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>Total Refunds:</span>
                <span>-{formatVal(shiftCalculations.totalRefunds)}</span>
              </div>
              <div className="flex justify-between text-red-400">
                <span>Discounts Applied:</span>
                <span>-{formatVal(shiftCalculations.totalDiscounts)}</span>
              </div>
              <div className="flex justify-between text-amber-400">
                <span>Complimentary Value:</span>
                <span>{formatVal(shiftCalculations.totalComplimentaryValue)}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-850 rounded-xl space-y-1.5">
              <div className="flex justify-between font-bold text-textPearl">
                <span>Expected Closing Cash Float:</span>
                <span>{formatVal(shiftCalculations.expectedClosingCash)}</span>
              </div>
              <p className="text-[9px] text-slate-500 font-semibold">(Formula: Opening Cash Float + Cash Sales - Cash Refunds)</p>
            </div>

            <Input
              label={`Counted Closing Cash Drawer (${currencySymbol}) *`}
              type="number"
              placeholder="0.00"
              value={actualClosingCashInput}
              onChange={(e) => setActualClosingCashInput(e.target.value)}
              className="py-2 text-sm"
            />

            <div className="flex gap-3 pt-2">
              <Button 
                variant="secondary" 
                className="flex-1" 
                onClick={() => setIsClosingShiftOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 font-bold bg-red-500 hover:bg-red-655 text-white" 
                onClick={handleCloseShift}
                disabled={!actualClosingCashInput.trim()}
              >
                Generate & Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* v1.1 COMPLIMENTARY REASON MODAL */}
      <Modal
        isOpen={isComplimentaryModalOpen}
        onClose={() => {
          setIsComplimentaryModalOpen(false);
          setComplimentaryReason('');
        }}
        title={`Audit: Gift Complimentary — ${complimentaryItemTarget?.name}`}
      >
        {complimentaryItemTarget && (
          <div className="space-y-4 text-left">
            <p className="text-xs text-slate-400">Marking items as complimentary will set their pricing effect to ₹0 on this bill check. This action will be audited.</p>
            <Input 
              label="Complimentary Reason / Occasion *" 
              type="text" 
              placeholder="E.g. Guest Birthday / VIP Customer / Customer Satisfaction recovery"
              value={complimentaryReason}
              onChange={(e) => setComplimentaryReason(e.target.value)}
              className="py-2"
            />

            <div className="flex gap-3 pt-2">
              <Button 
                variant="secondary" 
                className="flex-1" 
                onClick={() => {
                  setIsComplimentaryModalOpen(false);
                  setComplimentaryReason('');
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                className="flex-1 font-bold bg-amber-500 hover:bg-amber-600 text-slate-950" 
                onClick={handleMarkItemComplimentary}
                disabled={!complimentaryReason.trim()}
              >
                Confirm Complimentary
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* v1.1 REPRINT INVOICE MODAL REASON CAPTURE */}
      <Modal
        isOpen={isReprintModalOpen}
        onClose={() => {
          setIsReprintModalOpen(false);
          setReprintReason('');
        }}
        title="Reprint Invoice Authorization"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-slate-400">Specify reason to reprint invoice for audit logging tracking files.</p>
          <Input 
            label="Reprint Reason (Optional)" 
            type="text" 
            placeholder="E.g. Customer copy damaged / Print correction"
            value={reprintReason}
            onChange={(e) => setReprintReason(e.target.value)}
            className="py-2"
          />

          <div className="flex gap-3 pt-2">
            <Button 
              variant="secondary" 
              className="flex-1" 
              onClick={() => {
                setIsReprintModalOpen(false);
                setReprintReason('');
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              className="flex-1 font-bold bg-amber-500 hover:bg-amber-600 text-slate-950" 
              onClick={handleReprintInvoice}
            >
              Print Invoice Copy
            </Button>
          </div>
        </div>
      </Modal>

      {/* v1.1 BILL HOLD REASON MODAL */}
      <Modal
        isOpen={isHoldBillOpen}
        onClose={() => setIsHoldBillOpen(false)}
        title={`Hold Bill check — Table ${selectedOrder?.tableNumber}`}
      >
        <div className="space-y-4 text-left">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Hold Reason Category</span>
          <Select
            options={[
              { value: 'Customer Ordering More', label: 'Customer Ordering More' },
              { value: 'Temporary Pause', label: 'Temporary Pause' },
              { value: 'Table Change', label: 'Table Change' },
              { value: 'Custom', label: 'Custom Reason...' }
            ]}
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value)}
            className="py-1.5 text-xs"
          />

          {holdReason === 'Custom' && (
            <Input 
              label="Custom Hold Reason *" 
              placeholder="Describe pause reason..." 
              value={customHoldReason}
              onChange={(e) => setCustomHoldReason(e.target.value)}
              className="py-2"
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button 
              variant="secondary" 
              className="flex-1" 
              onClick={() => setIsHoldBillOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="primary" 
              className="flex-1 font-bold" 
              onClick={handleHoldBill}
            >
              Hold Bill Check
            </Button>
          </div>
        </div>
      </Modal>

      {/* Canonical Authoritative Bill Modal for Owner / Reception Desk */}
      {canonicalBillOrder && user?.tenantId && (
        <CanonicalBillModal
          isOpen={isCanonicalBillOpen}
          onClose={() => {
            setIsCanonicalBillOpen(false);
            setCanonicalBillOrder(null);
          }}
          tenantId={user.tenantId}
          orderId={canonicalBillOrder.orderId}
          mode="owner"
          restaurantName={(canonicalBillOrder as any).restaurantName || tenantSettings?.name || 'Restaurant'}
          onPaymentSettled={() => {
            setIsCanonicalBillOpen(false);
            setCanonicalBillOrder(null);
            toast.success('Bill settled successfully!', { icon: '💰' });
          }}
        />
      )}

    </div>
  );
};

export default OwnerBilling;
