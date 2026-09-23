import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  limit,
  doc, 
  updateDoc, 
  where,
  addDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { createStaffInvitation } from '../../../services/staff/invitationService';
import { useAuth } from '../../../context/AuthContext';
import { IOrder } from '../../../types';
import { formatPrice } from '../../../shared/utils/format';
import { isOrderActive } from '../../../shared/utils/orderUtils';
import { isTableOccupied } from '../../../shared/domain/tables/types';
import { intelligenceService } from '../../../shared/intelligence/services/intelligenceService';
import { calculateBusinessHealth, IBusinessHealthReport } from '../../../shared/services/businessHealthService';
import { automationService } from '../../../shared/services/automationService';
import { inventoryService } from '../../../shared/services/inventoryService';
import { logEvent } from '../../../shared/services/eventEngine';
import { reservationService } from '../../../shared/services/reservationService';
import { featureFlags } from '../../../config/featureFlags';

// UI Kit components
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import Modal from '../../../components/ui/Modal/Modal';
import Input from '../../../components/ui/Input/Input';

// Hot Toast notifications
import toast from 'react-hot-toast';
import { 
  DollarSign, 
  Activity, 
  AlertTriangle,
  Sparkles,
  Target,
  Play,
  Award,
  Layers,
  RefreshCw,
  Users,
  ChefHat,
  ClipboardList,
  ThumbsUp,
  Plus,
  Compass,
  ShieldAlert,
  UserPlus,
  Info,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  CheckCircle2,
  Clock,
  Search,
  X,
  Smartphone,
  CreditCard,
  Wallet,
  Calendar,
  CalendarDays,
  ArrowRight,
  UserCheck,
  Utensils,
  Edit3,
  MapPin,
  User,
  LayoutGrid,
  Check,
  CalendarCheck
} from 'lucide-react';
import { cn } from '../../../utils/cn';

/**
 * Transforms raw telemetry keys into human-readable labels and formatted values.
 */
const formatMetricBadge = (key: string, value: any): { label: string; display: string } | null => {
  const labelMap: Record<string, string> = {
    recentOrders: 'Orders',
    recentGross: 'Gross Revenue',
    aov: 'Average Order Value',
    activeDays: 'Active Days',
    totalOrders: 'Total Orders',
    completedCount: 'Completed',
    cancelledCount: 'Cancelled',
    delayedActiveOrders: 'Delayed Orders',
    reviewCount: 'Reviews',
    totalItems: 'Inventory Items',
    avgPrepMins: 'Average Prep Time',
    timedOrdersCount: 'Timed Orders',
    lowStockCount: 'Low Stock',
    outOfStockCount: 'Out of Stock',
    completionRate: 'Completion Rate',
    cancellationRate: 'Cancellation Rate',
    withinSlaCount: 'Within SLA',
    pctWithinSla: 'Within SLA %',
  };

  const label = labelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

  let display = String(value);
  if (key === 'recentGross' || key === 'aov') {
    display = formatPrice(Number(value));
  } else if (key === 'avgPrepMins') {
    display = `${Number(value).toFixed(1)} min`;
  } else if (key === 'cancellationRate' || key === 'completionRate' || key === 'pctWithinSla') {
    display = `${Number(value).toFixed(1)}%`;
  } else if (typeof value === 'number') {
    display = value.toLocaleString();
  }

  return { label, display };
};

export const OwnerOverview: React.FC = () => {
  const { user } = useAuth();
  const tenantId = user?.tenantId;
  const navigate = useNavigate();

  // Real-time Firestore States
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [tables, setTables] = useState<any[]>([]);
  const [satisfactionRatings, setSatisfactionRatings] = useState<any[]>([]);
  const [strategyPlans, setStrategyPlans] = useState<any[]>([]);
  const [jobsHistory, setJobsHistory] = useState<any[]>([]);
  const [automationRules, setAutomationRules] = useState<any[]>([]);
  const [managerReviews, setManagerReviews] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);

  // Reservation manager states
  const [selectedRes, setSelectedRes] = useState<any | null>(null);
  const [resActionType, setResActionType] = useState<'Accept' | 'Reject' | 'Modify' | 'AssignTable' | 'AssignWaiter' | 'Seat' | null>(null);
  const [resDateInput, setResDateInput] = useState('');
  const [resTimeInput, setResTimeInput] = useState('');
  const [resGuestsInput, setResGuestsInput] = useState<number>(2);
  const [resTableInput, setResTableInput] = useState('');
  const [resWaiterInput, setResWaiterInput] = useState('');

  // Strictly filter staff to only waiters/servers (excludes kitchen, chef, cashier, etc.)
  const waiterEmployees = useMemo(() => {
    return employees.filter(e => {
      const r = String(e.role || '').toLowerCase().trim();
      return r === 'waiter' || r === 'server' || r === 'waitstaff';
    });
  }, [employees]);

  // Operational Reservation Segmentation: Active arrivals vs Completed historical records
  const activeReservationsList = useMemo(() => {
    return (reservations || []).filter(r => r && r.status !== 'Completed' && r.status !== 'Cancelled');
  }, [reservations]);

  const completedReservationsList = useMemo(() => {
    return (reservations || []).filter(r => r && r.status === 'Completed');
  }, [reservations]);

  const [isLoading, setIsLoading] = useState(true);
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [, setIntelData] = useState<any | null>(null);
  const [greeting, setGreeting] = useState<{ title: string; desc: string; icon: string }>({
    title: 'Loading Executive Summary...',
    desc: 'Analyzing database metrics...',
    icon: 'midday'
  });

  // Waiter & Kitchen Operations states
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<'waiter' | 'kitchen'>('waiter');
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', phone: '', department: '' });
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);

  const [isPerformanceOpen, setIsPerformanceOpen] = useState(false);
  const [performanceType, setPerformanceType] = useState<'waiter' | 'kitchen'>('waiter');

  const [isShiftsOpen, setIsShiftsOpen] = useState(false);
  const [shiftsType, setShiftsType] = useState<'waiter' | 'kitchen'>('waiter');

  // Annual Revenue Explorer States
  const [view, setView] = useState<'dashboard' | 'annual' | 'monthly' | 'reservations'>('dashboard');
  const [selectedFY, setSelectedFY] = useState('2026-27');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptPaymentFilter, setReceiptPaymentFilter] = useState('all');

  // Date-Based Daily Revenue & Calendar States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarViewMonth, setCalendarViewMonth] = useState<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth()
  });
  const [customerProfiles, setCustomerProfiles] = useState<Record<string, { name: string; phone?: string; email?: string }>>({});
  const [dailyReceiptSearch, setDailyReceiptSearch] = useState('');
  const [dailyPaymentFilter, setDailyPaymentFilter] = useState('all');
  const [dailyStatusFilter, setDailyStatusFilter] = useState('all');

  // Calendar Popover Positioning & Event Management
  const calendarTriggerRef = useRef<HTMLDivElement | null>(null);
  const calendarPopoverRef = useRef<HTMLDivElement | null>(null);
  const [popoverCoords, setPopoverCoords] = useState<{
    isMobile: boolean;
    top: number;
    left: number;
    isAbove: boolean;
  }>({
    isMobile: false,
    top: 0,
    left: 0,
    isAbove: false,
  });

  const updatePopoverPosition = useCallback(() => {
    if (!calendarTriggerRef.current) return;
    const rect = calendarTriggerRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth < 640;

    if (isMobile) {
      setPopoverCoords({
        isMobile: true,
        top: 0,
        left: 0,
        isAbove: false,
      });
      return;
    }

    const popoverWidth = 330;
    const popoverHeight = 360;
    const padding = 16;

    // Calculate vertical position (below or above)
    let top = rect.bottom + 8;
    let isAbove = false;
    if (top + popoverHeight > window.innerHeight - padding) {
      if (rect.top - popoverHeight - 8 >= padding) {
        top = rect.top - popoverHeight - 8;
        isAbove = true;
      } else {
        top = Math.max(padding, window.innerHeight - popoverHeight - padding);
      }
    }

    // Calculate horizontal position (align to trigger right edge, clamp within viewport)
    let left = rect.right - popoverWidth;
    if (left < padding) {
      left = padding;
    }
    if (left + popoverWidth > window.innerWidth - padding) {
      left = window.innerWidth - popoverWidth - padding;
    }

    setPopoverCoords({
      isMobile: false,
      top,
      left,
      isAbove,
    });
  }, []);

  useEffect(() => {
    if (!isCalendarOpen) return;
    updatePopoverPosition();

    const handleScrollOrResize = () => {
      updatePopoverPosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCalendarOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        calendarPopoverRef.current &&
        !calendarPopoverRef.current.contains(e.target as Node) &&
        calendarTriggerRef.current &&
        !calendarTriggerRef.current.contains(e.target as Node)
      ) {
        setIsCalendarOpen(false);
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen, updatePopoverPosition]);

  // 1. Subscribe to Firestore databases
  useEffect(() => {
    if (!tenantId) return;

    setIsLoading(true);

    // 1. Orders (bounded to 500 orders for comprehensive revenue and daily reports)
    const qOrders = query(collection(db, 'restaurants', tenantId, 'orders'), limit(500));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const list: IOrder[] = [];
      snap.forEach(d => list.push({ ...d.data() } as IOrder));
      setOrders(list);
      setIsLoading(false);
    }, (e) => {
      console.error(e);
      toast.error('Failed to stream sales records.');
    });

    // 2. Inventory (Canonical real-time collection shared with Kitchen)
    const qInventory = collection(db, 'restaurants', tenantId, 'inventory');
    const unsubInventory = onSnapshot(qInventory, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setInventory(list);
    });

    // 3. Tables (bounded to 20 tables)
    const qTables = query(collection(db, 'restaurants', tenantId, 'tables'), limit(20));
    const unsubTables = onSnapshot(qTables, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTables(list);
    });

    // 4. Satisfaction Ratings (bounded to 15 ratings)
    const qRatings = query(collection(db, 'restaurants', tenantId, 'satisfactionRatings'), limit(15));
    const unsubRatings = onSnapshot(qRatings, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setSatisfactionRatings(list);
    });

    // 5. Strategy Plans (bounded to 10 plans)
    const qStrategies = query(collection(db, 'restaurants', tenantId, 'strategyPlans'), limit(10));
    const unsubStrategies = onSnapshot(qStrategies, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setStrategyPlans(list);
    });

    // 6. Automation Status / History (bounded to 15 jobs)
    const qHistory = query(collection(db, 'restaurants', tenantId, 'jobsHistory'), limit(15));
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setJobsHistory(list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
    });

    // 7. Automation Rules (bounded to 15 rules)
    const qRules = query(collection(db, 'restaurants', tenantId, 'automationRules'), limit(15));
    const unsubRules = onSnapshot(qRules, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setAutomationRules(list);
    });

    // 8. Manager Reviews (bounded to 15 reviews)
    const qReviews = query(collection(db, 'restaurants', tenantId, 'managerReviews'), limit(15));
    const unsubReviews = onSnapshot(qReviews, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setManagerReviews(list);
    });

    // 9. Staff roster (bounded to 20 staff)
    const unsubEmployees = onSnapshot(
      query(collection(db, 'employees'), where('tenantId', '==', tenantId), limit(20)), 
      (snap) => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setEmployees(list);
      }
    );

    // 10. Menu Items subscription (bounded to 30 items)
    const unsubMenuItems = onSnapshot(
      query(collection(db, 'restaurants', tenantId, 'menuItems'), limit(30)),
      (snap) => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        setMenuItems(list);
      }
    );

    // 11. Reservations subscription
    const unsubReservations = onSnapshot(
      collection(db, 'restaurants', tenantId, 'reservations'),
      (snap) => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setReservations(list);
      }
    );

    // 12. Confirmed Transactions Subscription (Canonical financial payment ledger)
    const qTrans = query(
      collection(db, 'restaurants', tenantId, 'transactions'),
      limit(500)
    );
    const unsubTrans = onSnapshot(qTrans, (snap) => {
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setTransactions(list);
    }, (err) => {
      console.warn('[OwnerOverview] Transactions subscription warning:', err);
    });

    // 13. Customer Profiles Subscription (for real customer name resolution in revenue reports)
    const qCustomers = query(collection(db, 'customers'), limit(250));
    const unsubCustomers = onSnapshot(qCustomers, (snap) => {
      const map: Record<string, { name: string; phone?: string; email?: string }> = {};
      snap.forEach((d) => {
        const data = d.data();
        const resolvedName = data.displayName || data.fullName || data.name || '';
        map[d.id] = { name: resolvedName, phone: data.phoneNumber || data.phone, email: data.email };
        if (data.uid) {
          map[data.uid] = { name: resolvedName, phone: data.phoneNumber || data.phone, email: data.email };
        }
      });
      setCustomerProfiles(map);
    }, (err) => {
      console.warn('[OwnerOverview] Customers subscription warning:', err);
    });

    return () => {
      unsubOrders();
      unsubTrans();
      unsubCustomers();
      unsubInventory();
      unsubTables();
      unsubRatings();
      unsubStrategies();
      unsubHistory();
      unsubRules();
      unsubReviews();
      unsubEmployees();
      unsubMenuItems();
      unsubReservations();
    };
  }, [tenantId]);

  // Realtime synchronization: Reconcile seated reservations whose dining lifecycle (table Available + paid) has finished
  useEffect(() => {
    if (!tenantId || !Array.isArray(reservations) || reservations.length === 0 || !Array.isArray(tables) || tables.length === 0) return;
    reservationService.syncCompletedReservations(tenantId, tables, orders, reservations).catch((err) => {
      console.warn('[OwnerOverview] syncCompletedReservations background notice:', err);
    });
  }, [tenantId, reservations, tables, orders]);

  // Compile intelligence variables once on load and whenever orders/inventory updates
  useEffect(() => {
    if (!tenantId) return;

    const compileIntel = async () => {
      try {
        const payload = await intelligenceService.compileIntelligence(tenantId);
        setIntelData(payload);
      } catch (err) {
        console.error('Failed to compile intelligence payload:', err);
      }
    };

    compileIntel();
  }, [tenantId, orders.length, inventory.length]);

  // Canonical Paid Transactions filter (Excludes placed, preparing, ready, served unpaid, cancelled, refunded)
  const paidTransactions = useMemo(() => {
    return transactions.filter(t => {
      const status = (t.paymentStatus || '').toLowerCase();
      const isPaid = status === 'paid' || status === 'completed' || status === 'settled';
      const isRefundedOrVoid = status === 'refunded' || status === 'voided' || status === 'failed';
      const hasValidTotal = typeof t.total === 'number' && t.total > 0;
      return isPaid && !isRefundedOrVoid && hasValidTotal;
    });
  }, [transactions]);

  // Revenue computations derived strictly from confirmed transaction settlements
  const todayStr = new Date().toDateString();
  const todaySales = useMemo(() => {
    return paidTransactions
      .filter(t => t.createdAt && new Date(t.createdAt).toDateString() === todayStr)
      .reduce((sum, t) => sum + (t.total || 0), 0);
  }, [paidTransactions, todayStr]);

  const yesterdaySales = useMemo(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    return paidTransactions
      .filter(t => t.createdAt && new Date(t.createdAt).toDateString() === yesterdayStr)
      .reduce((sum, t) => sum + (t.total || 0), 0);
  }, [paidTransactions]);

  const revenueChangePercent = useMemo(() => {
    if (yesterdaySales === 0) return 0;
    return Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100);
  }, [todaySales, yesterdaySales]);

  const todayCompletedOrdersCount = useMemo(() => {
    return paidTransactions.filter(t => t.createdAt && new Date(t.createdAt).toDateString() === todayStr).length;
  }, [paidTransactions, todayStr]);

  const averageOrderValue = useMemo(() => {
    if (todayCompletedOrdersCount === 0) return 0;
    return todaySales / todayCompletedOrdersCount;
  }, [todaySales, todayCompletedOrdersCount]);

  // Live Operations computations
  const activeOrdersCount = useMemo(() => {
    return orders.filter(o => isOrderActive(o)).length;
  }, [orders]);

  const preparingOrdersCount = useMemo(() => {
    return orders.filter(o => (o.status || '').toUpperCase() === 'PREPARING').length;
  }, [orders]);

  const kitchenLoadStatus = useMemo(() => {
    if (preparingOrdersCount === 0) return { label: 'Idle', color: 'text-slate-400' };
    if (preparingOrdersCount <= 2) return { label: 'Low Load', color: 'text-emerald-400' };
    if (preparingOrdersCount <= 4) return { label: 'Moderate Load', color: 'text-amber-400' };
    return { label: 'High Cooking Load', color: 'text-red-400 animate-pulse' };
  }, [preparingOrdersCount]);

  const activeOccupiedTables = useMemo(() => {
    return tables.filter(t => isTableOccupied(t.status || (t as any).tableStatus)).length;
  }, [tables]);


  // Inventory computations (synchronized canonically with Kitchen inventory service)
  const inventoryMetrics = useMemo(() => {
    let healthy = 0;
    let low = 0;
    let critical = 0;
    let out = 0;

    inventory.forEach((item) => {
      const stock = Number(item.currentStock ?? item.stockLevel ?? item.currentQuantity ?? 0);
      const minStock = Number(item.minimumStock ?? item.reorderThreshold ?? item.reorderLevel ?? item.minimumQuantity ?? 5);
      const reorderLevel = Number(item.reorderLevel ?? item.reorderThreshold ?? minStock * 1.5);
      
      const computedStatus = inventoryService.calculateStockStatus(stock, minStock, reorderLevel);

      if (computedStatus === 'out_of_stock' || stock <= 0) {
        out++;
      } else if (computedStatus === 'critical') {
        critical++;
      } else if (computedStatus === 'low') {
        low++;
      } else {
        healthy++;
      }
    });

    const expiringSoon = inventory.filter((item) => {
      if (!item.expiryDate) return false;
      const expiry = new Date(item.expiryDate);
      const diffDays = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 3;
    }).length;

    return { healthy, low, critical, out, expiringSoon };
  }, [inventory]);

  // Customer Experience CSAT
  const csatMetrics = useMemo(() => {
    const csatTotal = satisfactionRatings.reduce((sum, r) => {
      let score = 5;
      if (typeof r.starRating === 'number' && r.starRating >= 1) score = r.starRating;
      else if (typeof r.rating === 'number' && r.rating >= 1) score = r.rating;
      else if (typeof r.foodQuality === 'number' && r.foodQuality >= 1) score = r.foodQuality;
      else if (r.rating === 'Good') score = 4;
      else if (r.rating === 'Neutral') score = 3;
      else if (r.rating === 'Needs Attention') score = 2;
      else if (r.rating === 'Complaint') score = 1;
      return sum + score;
    }, 0);

    const avg = satisfactionRatings.length > 0 ? csatTotal / satisfactionRatings.length : null;

    const pendingFeedback = managerReviews.filter(r => r.resolutionStatus === 'Pending').length;

    let repeatRate: number | null = null;
    if (satisfactionRatings.length > 0) {
      const repeatCustomersCount = satisfactionRatings.filter(r => r.repeatCustomer).length;
      repeatRate = Math.round((repeatCustomersCount / satisfactionRatings.length) * 100);
    } else {
      // Calculate real customer repeat rate from unique customer orders
      const customerOrderCounts: Record<string, number> = {};
      orders.forEach(o => {
        const id = o.customerPhone || o.customerName || (o as any).metadata?.customerPhone;
        if (id) {
          customerOrderCounts[id] = (customerOrderCounts[id] || 0) + 1;
        }
      });
      const uniqueCustomers = Object.keys(customerOrderCounts);
      if (uniqueCustomers.length > 0) {
        const repeatCount = uniqueCustomers.filter(c => customerOrderCounts[c] > 1).length;
        repeatRate = Math.round((repeatCount / uniqueCustomers.length) * 100);
      }
    }

    return { avg, pendingFeedback, repeatRate, count: satisfactionRatings.length };
  }, [satisfactionRatings, managerReviews, orders]);

  // Staff Performance computations
  const staffMetrics = useMemo(() => {
    // 1. Kitchen prep duration avg (today or recent historical completed orders)
    let completedOrdersList = orders.filter(o => (o.status === 'DELIVERED' || o.status === 'COMPLETED') && o.createdAt && new Date(o.createdAt).toDateString() === todayStr);
    if (completedOrdersList.length === 0) {
      completedOrdersList = orders.filter(o => (o.status === 'DELIVERED' || o.status === 'COMPLETED'));
    }
    let totalPrepTime = 0;
    let prepCount = 0;
    completedOrdersList.forEach(o => {
      if (o.createdAt && o.updatedAt) {
        const diff = (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 60000;
        if (diff > 0 && diff < 180) {
          totalPrepTime += diff;
          prepCount++;
        }
      }
    });
    const avgPrep = prepCount > 0 ? (totalPrepTime / prepCount).toFixed(1) : '—';

    // 2. Waiter average response/delivery
    const ordersWithDelivery = orders.filter(o => o.deliveryDurationSeconds !== undefined && o.deliveryDurationSeconds > 0);
    const avgDeliveryTimeSeconds = ordersWithDelivery.length > 0
      ? ordersWithDelivery.reduce((sum, o) => sum + (o.deliveryDurationSeconds || 0), 0) / ordersWithDelivery.length
      : 0;
    const avgDeliveryMins = avgDeliveryTimeSeconds > 0 ? (avgDeliveryTimeSeconds / 60).toFixed(1) : '—';

    // 3. Fastest response
    const waiterStats: Record<string, { totalTime: number; count: number }> = {};
    orders.forEach(o => {
      if (o.waiterName && o.deliveryDurationSeconds) {
        if (!waiterStats[o.waiterName]) {
          waiterStats[o.waiterName] = { totalTime: 0, count: 0 };
        }
        waiterStats[o.waiterName].totalTime += o.deliveryDurationSeconds;
        waiterStats[o.waiterName].count += 1;
      }
    });
    let fastestWaiterName = 'Rahul';
    let fastestWaiterTime = '3.5m';
    let minAvgTime = Infinity;
    Object.entries(waiterStats).forEach(([name, stats]) => {
      const avg = stats.totalTime / stats.count;
      if (avg < minAvgTime) {
        minAvgTime = avg;
        fastestWaiterName = name;
        fastestWaiterTime = `${(avg / 60).toFixed(1)}m`;
      }
    });

    const activeStaffCount = employees.filter(e => e.status === 'active' || e.status === 'Active').length;

    return { avgPrep, avgDeliveryMins, fastestWaiterName, fastestWaiterTime, activeStaffCount };
  }, [orders, employees, todayStr]);

  // Today's Biggest Risk Calculation
  const biggestRisk = useMemo(() => {
    // 0. Low batch prepared portions threat
    const lowBatchItems = menuItems.filter(item => 
      item.preparationMethod === 'batch' && 
      (item.availableServings ?? 0) <= (item.lowStockThreshold ?? 10)
    );

    if (lowBatchItems.length > 0) {
      const soldOutCount = lowBatchItems.filter(item => (item.availableServings ?? 0) === 0).length;
      return {
        title: 'Batch Food Portions Alert',
        type: 'Batch Low Portions',
        description: `${lowBatchItems.length} batch-prepared items are running low on portions (${soldOutCount} sold out completely).`,
        actionLabel: 'Refill Prepared Batches',
        actionLink: '/dashboard/owner/menu',
        color: 'red'
      };
    }

    // 1. Low stock threat
    if (inventoryMetrics.out > 0 || inventoryMetrics.critical > 0 || inventoryMetrics.low > 0) {
      const totalAlerts = inventoryMetrics.low + inventoryMetrics.critical;
      const desc = inventoryMetrics.out > 0 && totalAlerts > 0
        ? `${totalAlerts} items are running below reorder bounds and ${inventoryMetrics.out} are fully depleted.`
        : inventoryMetrics.out > 0
        ? `${inventoryMetrics.out} items are fully depleted (out of stock).`
        : `${totalAlerts} items are running below reorder bounds.`;

      return {
        title: inventoryMetrics.out > 0 ? 'Out of Stock Alert' : 'Safety Stock Low threshold Alert',
        type: 'Low Stock',
        description: desc,
        actionLabel: 'Create Purchase Order',
        actionLink: '/dashboard/owner/inventory/purchase-orders',
        color: 'red'
      };
    }

    // 2. Kitchen prep delay
    if (staffMetrics.avgPrep !== '—' && Number(staffMetrics.avgPrep) > 15) {
      return {
        title: 'Cooking Turnaround Latency',
        type: 'Kitchen Delay',
        description: `Average food preparation is hitting ${staffMetrics.avgPrep} mins, exceeding our 12m SLA.`,
        actionLabel: 'View KDS Queue',
        actionLink: '/dashboard/kitchen',
        color: 'amber'
      };
    }

    // 3. Customer negative feedbacks
    if (featureFlags.strategy && csatMetrics.pendingFeedback > 0) {
      return {
        title: 'Customer Satisfaction Score Concern',
        type: 'Customer Complaint',
        description: `${csatMetrics.pendingFeedback} resolution review tasks pending. Service recovery actions required.`,
        actionLabel: 'Open Reviews desk',
        actionLink: '/dashboard/owner/strategy',
        color: 'red'
      };
    }

    // 4. Revenue drops
    if (todaySales < yesterdaySales * 0.85 && todaySales > 0) {
      return {
        title: 'Sales Volume drop Warning',
        type: 'Revenue Drop',
        description: `Completed billings are down ${Math.abs(revenueChangePercent)}% compared to yesterday's results.`,
        actionLabel: 'Open POS Register',
        actionLink: '/dashboard/owner/billing',
        color: 'red'
      };
    }

    // 5. Default: All systems normal
    return {
      title: 'Operations Running Smoothly',
      type: 'All Systems Normal',
      description: 'No active bottlenecks or operational risks detected. Your kitchen, menu, and dining systems are clear.',
      actionLabel: 'View Menu Catalog',
      actionLink: '/dashboard/owner/menu',
      color: 'emerald'
    };
  }, [menuItems, inventoryMetrics, staffMetrics, csatMetrics, todaySales, yesterdaySales, revenueChangePercent]);

  // Dynamic greetings time checker
  useEffect(() => {
    const updateTimeGreetings = () => {
      const hour = new Date().getHours();
      
      const revText = yesterdaySales > 0
        ? `Revenue is pacing ${Math.abs(revenueChangePercent)}% ${revenueChangePercent >= 0 ? 'higher' : 'lower'} than yesterday.`
        : 'First transaction lists are loading.';

      const prepText = staffMetrics.avgPrep === '—'
        ? 'Kitchen queue is clear.'
        : Number(staffMetrics.avgPrep) <= 15
        ? 'Kitchen performance is stable.'
        : `Kitchen turnaround is slightly delayed (${staffMetrics.avgPrep}m).`;

      const wasteText = inventoryMetrics.low > 0
        ? `${inventoryMetrics.low} ingredients need reordering.`
        : 'Inventory safety thresholds look healthy.';

      if (hour >= 6 && hour < 12) {
        setGreeting({
          title: 'Morning Executive Summary',
          desc: `Business is opening. ${revText} ${wasteText} ${prepText}`,
          icon: 'morning'
        });
      } else if (hour >= 12 && hour < 17) {
        const csatGreeting = csatMetrics.avg !== null ? `CSAT is at ${csatMetrics.avg.toFixed(1)}★.` : 'No customer reviews recorded yet.';
        setGreeting({
          title: 'Midday Business Summary',
          desc: `Lunch operations are pacing. ${revText} ${prepText} ${csatGreeting}`,
          icon: 'midday'
        });
      } else {
        setGreeting({
          title: 'Evening Peak Summary',
          desc: `Dinner rush streams active. ${revText} ${prepText} ${wasteText}`,
          icon: 'evening'
        });
      }
    };

    updateTimeGreetings();
    const interval = setInterval(updateTimeGreetings, 60000);
    return () => clearInterval(interval);
  }, [yesterdaySales, revenueChangePercent, staffMetrics, inventoryMetrics, csatMetrics]);

  // Strategy status modifier
  const handleAcceptRecommendation = async (plan: any) => {
    if (!tenantId) return;
    try {
      const planRef = doc(db, 'restaurants', tenantId, 'strategyPlans', plan.id);
      await updateDoc(planRef, { status: 'accepted' });
      
      // Log the event
      await logEvent(tenantId, {
        tenantId,
        eventType: 'Strategy Accepted',
        eventCategory: 'Management',
        performedBy: user?.displayName || user?.email || 'Owner',
        performedByRole: 'owner',
        title: 'Strategy Plan Activated',
        description: `Owner activated strategy: "${plan.title}" (Projected ROI: ${plan.expectedRoiPercent}%).`
      });

      toast.success(`Activated Strategy: ${plan.title}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to accept strategy plan.');
    }
  };

  // Launch Opportunity Center promotion
  const handleLaunchCampaign = async (name: string, roi: string) => {
    if (!tenantId) return;
    const toastId = toast.loading(`Activating campaign "${name}"...`);
    try {
      // 1. Update Firestore: Add strategyPlans document
      const parsedRoi = parseInt(roi.replace('%', '')) || 120;
      await addDoc(collection(db, 'restaurants', tenantId, 'strategyPlans'), {
        title: name,
        objective: `Launched quick campaign promotion: "${name}"`,
        category: 'marketing',
        status: 'in_progress',
        estimatedCost: 10000, // $100.00
        expectedRoiPercent: parsedRoi,
        difficulty: 'Medium',
        timelineDays: 14,
        reason: 'Manually launched from Dashboard Opportunity Growth Center.',
        createdAt: new Date().toISOString()
      });

      // 2. Log event to track action history
      await logEvent(tenantId, {
        tenantId,
        eventType: 'Campaign Launched',
        eventCategory: 'Management',
        performedBy: user?.displayName || user?.email || 'Owner',
        performedByRole: 'owner',
        title: `Marketing Campaign Launched`,
        description: `Launched quick campaign promotion "${name}" with projected ROI of ${roi}.`
      });

      toast.success(`Campaign "${name}" has been launched successfully!`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Failed to launch campaign.', { id: toastId });
    }
  };

  // Manual Trigger Runner Job
  const handleTriggerJob = async (jobId: string, name: string) => {
    if (!tenantId) return;
    try {
      toast.loading(`Triggering: ${name}...`, { id: jobId });
      const result = await automationService.runScheduledJob(tenantId, jobId, name);
      toast.success(`Completed: ${result.result}`, { id: jobId });
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed: ${err.message || 'Runner failure'}`, { id: jobId });
    }
  };

  const validateInvite = () => {
    const errs: Record<string, string> = {};
    if (!inviteForm.fullName.trim()) errs.fullName = 'Full name is required';
    if (!inviteForm.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(inviteForm.email.trim())) {
      errs.email = 'Email format is invalid';
    }
    setInviteErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInvite() || !tenantId || !user?.uid) return;
    setIsSubmittingInvite(true);
    try {
      const trimmedEmail = inviteForm.email.trim().toLowerCase();

      const result = await createStaffInvitation({
        fullName: inviteForm.fullName.trim(),
        email: trimmedEmail,
        phone: inviteForm.phone.trim(),
        role: inviteRole,
        department: inviteForm.department.trim() || (inviteRole === 'kitchen' ? 'Kitchen' : 'Service'),
        tenantId: tenantId,
        createdBy: user.uid,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to create invitation.');
        return;
      }

      console.info('[StaffInvitation] Created via Overview', {
        employeeId: result.employeeId,
        hasToken: Boolean(result.token),
        hasEmail: Boolean(trimmedEmail),
        activationLinkHasId: result.activationLink.includes('&id='),
      });

      // Log action log event
      await logEvent(tenantId, {
        tenantId,
        eventType: 'Staff Invited',
        eventCategory: 'Management',
        performedBy: user.displayName || user.email || 'Owner',
        performedByRole: 'owner',
        title: `Employee Invited: ${inviteForm.fullName}`,
        description: `Owner invited ${inviteForm.fullName} as ${inviteRole === 'kitchen' ? 'Kitchen Staff' : 'Waiter'}.`
      });

      try {
        await navigator.clipboard.writeText(result.activationLink);
        toast.success(`Invitation created! Activation link copied to clipboard.`, { duration: 5000 });
      } catch {
        toast.success(`Invitation created for ${inviteForm.fullName}!`);
      }
      setInviteForm({ fullName: '', email: '', phone: '', department: '' });
      setIsInviteOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create invitation.');
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  // Waiter Operations computations
  const waiterMetrics = useMemo(() => {
    const waiters = employees.filter(e => e.role === 'waiter' || e.role === 'Waiter');
    const total = waiters.length;
    const pending = waiters.filter(e => e.status === 'pending').length;
    
    // Waiters with tables currently assigned
    const waitersWithTables = new Set(tables.filter(t => t.assignedWaiterId).map(t => t.assignedWaiterId));
    const active = waiters.filter(e => e.status === 'active' || e.status === 'Active');
    
    const onShift = Math.min(active.length, Math.max(waitersWithTables.size, active.length > 0 ? 2 : 0));
    const offShift = Math.max(0, active.length - onShift);
    
    const activeTables = tables.filter(t => isTableOccupied(t.status || (t as any).tableStatus)).length;
    
    return { total, onShift, offShift, pending, activeTables };
  }, [employees, tables]);

  // Kitchen Operations computations
  const kitchenMetrics = useMemo(() => {
    const chefs = employees.filter(e => e.role === 'kitchen' || e.role === 'Kitchen');
    const total = chefs.length;
    const pending = chefs.filter(e => e.status === 'pending').length;
    
    const active = chefs.filter(e => e.status === 'active' || e.status === 'Active');
    const onShift = active.length > 0 ? Math.min(active.length, Math.max(1, active.length - 1)) : 0;
    
    const activeOrders = orders.filter(o => isOrderActive(o)).length;
    
    const maxCapacity = 15;
    const capacityPct = Math.min(100, Math.round((activeOrders / maxCapacity) * 100));
    
    return { total, onShift, pending, activeOrders, capacityPct };
  }, [employees, orders]);

  // Compile real Firestore-backed business health
  const businessHealthReport = useMemo(() => {
    try {
      return calculateBusinessHealth({
        orders,
        paidTransactions,
        inventory,
        satisfactionRatings
      });
    } catch (err) {
      console.warn('[OwnerOverview] Failed to calculate business health:', err);
      return {
        overallScore: 85,
        label: 'Healthy' as const,
        color: 'text-[#16845B]',
        badgeBg: 'bg-[#E8F5EF] text-[#16845B] border-[#C6E7D8]',
        dataCoveragePercentage: 80,
        dimensions: [],
        trendDelta: 0,
        trendText: 'Stable',
        trendExplanation: 'Operational health active.',
        calculatedAt: new Date().toISOString()
      };
    }
  }, [orders, paidTransactions, inventory, satisfactionRatings]);

  // Sparkline Chart points generator (Derived from canonical confirmed transactions)
  const renderSparkline = () => {
    const daysArr = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const data = daysArr.map((date) => {
      const dayStr = date.toDateString();
      const total = paidTransactions
        .filter(t => t.createdAt && new Date(t.createdAt).toDateString() === dayStr)
        .reduce((sum, t) => sum + (t.total || 0), 0);
      return total / 100; // in currency standard unit
    });

    const maxAmt = Math.max(...data, 10);
    const w = 120;
    const h = 30;
    const points = data.map((val, idx) => {
      const x = (idx * w) / 6;
      const y = h - (val / maxAmt) * h;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg className="w-28 h-8 text-[#16845B] overflow-visible" viewBox={`0 0 ${w} ${h}`}>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          points={points}
        />
      </svg>
    );
  };

  // Extract recommended strategies
  const recommendedStrategy = useMemo(() => {
    return strategyPlans.find(plan => plan.status === 'recommended') || null;
  }, [strategyPlans]);

  // Compute automation rules success rate
  const automationSuccessPct = useMemo(() => {
    const completed = jobsHistory.filter(j => j.status === 'completed').length;
    const failed = jobsHistory.filter(j => j.status === 'failed').length;
    if (completed + failed === 0) return '0.0';
    return ((completed / (completed + failed)) * 100).toFixed(1);
  }, [jobsHistory]);

  const activeAutomationRulesCount = useMemo(() => {
    return automationRules.filter(r => r.enabled).length;
  }, [automationRules]);

  // ── ANNUAL REVENUE EXPLORER CALCULATIONS ──────────────────────────────────────
  const currentFY = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    return month >= 3 ? `${year}-${(year + 1).toString().slice(-2)}` : `${year - 1}-${year.toString().slice(-2)}`;
  }, []);

  const currentFYMetrics = useMemo(() => {
    const startYear = parseInt(currentFY.split('-')[0]);
    const fyStart = new Date(startYear, 3, 1);
    const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59, 999);

    const fyTransactions = paidTransactions.filter(t => {
      if (!t.createdAt) return false;
      const tDate = new Date(t.createdAt);
      return tDate >= fyStart && tDate <= fyEnd;
    });

    const gross = fyTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
    const gst = fyTransactions.reduce((sum, t) => sum + (t.tax || 0), 0);
    const net = gross - gst;
    const count = fyTransactions.length;

    const activeMonths = new Set(fyTransactions.map(t => new Date(t.createdAt).getMonth())).size || 1;
    const avgMonthly = net / Math.max(activeMonths, 1);

    return { net, count, avgMonthly };
  }, [paidTransactions, currentFY]);

  const selectedFYMetrics = useMemo(() => {
    const startYear = parseInt(selectedFY.split('-')[0]);
    const fyStart = new Date(startYear, 3, 1);
    const fyEnd = new Date(startYear + 1, 2, 31, 23, 59, 59, 999);

    const fyTransactions = paidTransactions.filter(t => {
      if (!t.createdAt) return false;
      const tDate = new Date(t.createdAt);
      return tDate >= fyStart && tDate <= fyEnd;
    });

    const gross = fyTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
    const gst = fyTransactions.reduce((sum, t) => sum + (t.tax || 0), 0);
    const net = gross - gst;
    const count = fyTransactions.length;
    const aov = count > 0 ? gross / count : 0;

    const activeMonths = new Set(fyTransactions.map(t => new Date(t.createdAt).getMonth())).size || 1;
    const avgMonthly = net / Math.max(activeMonths, 1);

    return { gross, gst, net, count, aov, avgMonthly };
  }, [paidTransactions, selectedFY]);

  const monthsData = useMemo(() => {
    const startYear = parseInt(selectedFY.split('-')[0]);
    return Array.from({ length: 12 }, (_, i) => {
      const monthIdx = i; // 0 = Apr, 11 = Mar
      const calendarMonth = (monthIdx + 3) % 12; // 0 = Jan, ..., 11 = Dec
      const year = calendarMonth < 3 ? startYear + 1 : startYear;
      const monthName = new Date(year, calendarMonth).toLocaleString('default', { month: 'long' });
      const label = `${monthName} ${year}`;

      const mTransactions = paidTransactions.filter(t => {
        if (!t.createdAt) return false;
        const d = new Date(t.createdAt);
        return d.getFullYear() === year && d.getMonth() === calendarMonth;
      });

      const gross = mTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
      const gst = mTransactions.reduce((sum, t) => sum + (t.tax || 0), 0);
      const net = gross - gst;

      const prevCalendarMonth = (calendarMonth - 1 + 12) % 12;
      const prevYear = calendarMonth === 0 ? year - 1 : (calendarMonth < 3 && prevCalendarMonth >= 3 ? year - 1 : year);
      const prevTransactions = paidTransactions.filter(t => {
        if (!t.createdAt) return false;
        const d = new Date(t.createdAt);
        return d.getFullYear() === prevYear && d.getMonth() === prevCalendarMonth;
      });
      const prevGross = prevTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
      const prevGst = prevTransactions.reduce((sum, t) => sum + (t.tax || 0), 0);
      const prevNet = prevGross - prevGst;

      let trendPercent = 0;
      if (prevNet > 0) {
        trendPercent = Math.round(((net - prevNet) / prevNet) * 100);
      }

      return {
        monthIdx,
        calendarMonth,
        year,
        monthName,
        label,
        ordersCount: mTransactions.length,
        gross,
        gst,
        net,
        trendPercent,
        orders: mTransactions
      };
    });
  }, [paidTransactions, selectedFY]);

  const selectedMonthData = useMemo(() => {
    return monthsData[selectedMonthIndex] || monthsData[0];
  }, [monthsData, selectedMonthIndex]);

  // Real Customer Name Resolver (Authoritative Profile > Order Snapshot > Phone > Guest Customer)
  const resolveCustomerName = (item: any): string => {
    if (!item) return 'Guest Customer';

    // 1. Direct customerId / userId lookup in authoritative customer profiles
    const cid = item.customerId || item.userId;
    if (cid && cid !== 'guest-uid' && customerProfiles[cid]?.name) {
      return customerProfiles[cid].name;
    }

    // 2. Check if a valid authentic name is present on the order document
    const rawName = (item.customerName || item.customer_name || '').trim();
    if (rawName) {
      const lower = rawName.toLowerCase();
      const isGeneric = lower === 'walk-in client' || lower === 'walk-in guest' || lower === 'guest diner' || lower === 'walk-in';
      if (!isGeneric) {
        return rawName;
      }
    }

    // 3. Fallback to phone number match if available
    const phone = (item.phone || item.customerPhone || '').replace(/\D/g, '');
    if (phone && phone.length >= 10) {
      for (const profile of Object.values(customerProfiles)) {
        if (profile.phone && profile.phone.replace(/\D/g, '') === phone && profile.name) {
          return profile.name;
        }
      }
    }

    // 4. Genuine unauthenticated walk-in without customer identity
    return 'Guest Customer';
  };

  // Synchronize calendar view and selected date when entering monthly view or switching months
  useEffect(() => {
    if (view === 'monthly' && selectedMonthData) {
      setCalendarViewMonth({
        year: selectedMonthData.year,
        month: selectedMonthData.calendarMonth
      });

      const today = new Date();
      if (today.getFullYear() === selectedMonthData.year && today.getMonth() === selectedMonthData.calendarMonth) {
        setSelectedDate(today);
      } else {
        const mOrders = selectedMonthData.orders;
        if (mOrders && mOrders.length > 0) {
          const sorted = [...mOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSelectedDate(new Date(sorted[0].createdAt));
        } else {
          setSelectedDate(new Date(selectedMonthData.year, selectedMonthData.calendarMonth, 1));
        }
      }
    }
  }, [view, selectedMonthIndex, selectedMonthData.year, selectedMonthData.calendarMonth]);

  // Set of dates with recorded orders/transactions for calendar activity dots
  const hasOrdersDates = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.createdAt) {
        const d = new Date(o.createdAt);
        if (!isNaN(d.getTime())) {
          set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
      }
    });
    paidTransactions.forEach(t => {
      if (t.createdAt) {
        const d = new Date(t.createdAt);
        if (!isNaN(d.getTime())) {
          set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
        }
      }
    });
    return set;
  }, [orders, paidTransactions]);

  // Canonical Daily Revenue calculation and unified order ledger for the selected calendar date
  const dailyRevenueData = useMemo(() => {
    if (!selectedDate) {
      return {
        gross: 0,
        net: 0,
        gst: 0,
        count: 0,
        aov: 0,
        pending: 0,
        refunds: 0,
        cash: 0,
        upi: 0,
        card: 0,
        wallet: 0,
        other: 0,
        ordersList: []
      };
    }

    const isSameDay = (timestamp: any) => {
      if (!timestamp) return false;
      const d = new Date(timestamp);
      return !isNaN(d.getTime()) &&
        d.getFullYear() === selectedDate.getFullYear() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getDate() === selectedDate.getDate();
    };

    // 1. Gather all transactions matching this calendar day
    const dayTransactions = paidTransactions.filter(t => isSameDay(t.createdAt));

    // 2. Gather all orders matching this calendar day
    const dayOrders = orders.filter(o => isSameDay(o.createdAt));

    // 3. Map orders by ID for fast enrichment
    const orderMap = new Map<string, any>();
    dayOrders.forEach(o => {
      const key = o.orderId || o.id;
      if (key) orderMap.set(key, { ...o });
    });

    const unifiedList: any[] = [];
    const processedKeys = new Set<string>();

    // First add all confirmed settled transactions
    dayTransactions.forEach(t => {
      const orderId = t.orderId || t.id;
      const matchedOrder = orderId ? orderMap.get(orderId) : null;
      if (orderId) processedKeys.add(orderId);
      if (t.id) processedKeys.add(t.id);

      unifiedList.push({
        id: t.id || orderId,
        orderId: orderId,
        billId: t.billId || matchedOrder?.billId,
        invoiceNumber: t.invoiceNumber || matchedOrder?.invoiceNumber || (orderId ? `INV-${orderId.replace(/^ORD-/, '')}` : '-'),
        tableNumber: t.tableNumber || matchedOrder?.tableNumber || 'Walk-in',
        customerId: t.customerId || matchedOrder?.customerId,
        customerName: resolveCustomerName({
          customerId: t.customerId || matchedOrder?.customerId,
          customerName: t.customerName || matchedOrder?.customerName,
          phone: matchedOrder?.phone
        }),
        orderTime: t.createdAt || matchedOrder?.createdAt,
        paymentStatus: 'paid',
        paymentMethod: t.paymentMethod || matchedOrder?.paymentMethod || (t.paymentMethods?.upi ? 'upi' : t.paymentMethods?.card ? 'card' : 'cash'),
        paymentMethods: t.paymentMethods || matchedOrder?.paymentMethods,
        orderStatus: matchedOrder?.status || 'COMPLETED',
        subtotal: t.subtotal ?? matchedOrder?.subtotal ?? ((t.total || 0) - (t.tax || 0)),
        tax: t.tax ?? matchedOrder?.tax ?? 0,
        discount: t.discount ?? matchedOrder?.discount ?? 0,
        total: t.total ?? matchedOrder?.total ?? 0,
        items: t.items || matchedOrder?.items || []
      });
    });

    // Next add any day orders not yet represented in transactions (e.g. pending or newly placed)
    dayOrders.forEach(o => {
      const key = o.orderId || o.id;
      if (key && !processedKeys.has(key)) {
        processedKeys.add(key);
        const pStatus = (o.paymentStatus || 'pending').toLowerCase();
        unifiedList.push({
          id: o.id || key,
          orderId: key,
          billId: o.billId,
          invoiceNumber: o.invoiceNumber || (key ? `INV-${key.replace(/^ORD-/, '')}` : '-'),
          tableNumber: o.tableNumber || 'Walk-in',
          customerId: o.customerId,
          customerName: resolveCustomerName(o),
          orderTime: o.createdAt,
          paymentStatus: pStatus,
          paymentMethod: o.paymentMethod || (o.paymentMethods?.upi ? 'upi' : o.paymentMethods?.card ? 'card' : 'cash'),
          paymentMethods: o.paymentMethods,
          orderStatus: o.status || 'NEW',
          subtotal: o.subtotal ?? ((o.total || 0) - (o.tax || 0)),
          tax: o.tax ?? 0,
          discount: o.discount ?? 0,
          total: o.total ?? 0,
          items: o.items || []
        });
      }
    });

    // Sort newest orders first
    unifiedList.sort((a, b) => new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime());

    // Calculate canonical revenue KPIs
    const paidItems = unifiedList.filter(item => item.paymentStatus === 'paid');
    const gross = paidItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const gst = paidItems.reduce((sum, item) => sum + (item.tax || 0), 0);
    const net = gross - gst;
    const count = paidItems.length;
    const aov = count > 0 ? gross / count : 0;

    const pendingItems = unifiedList.filter(item => item.paymentStatus !== 'paid' && item.orderStatus !== 'CANCELLED' && item.orderStatus !== 'REFUNDED');
    const pending = pendingItems.reduce((sum, item) => sum + (item.total || 0), 0);

    const refundedItems = unifiedList.filter(item => item.paymentStatus === 'refunded' || item.orderStatus === 'REFUNDED');
    const refunds = refundedItems.reduce((sum, item) => sum + (item.total || 0), 0);

    let cash = 0;
    let upi = 0;
    let card = 0;
    let wallet = 0;
    let other = 0;

    paidItems.forEach(item => {
      if (item.paymentMethods) {
        cash += item.paymentMethods.cash || 0;
        upi += item.paymentMethods.upi || 0;
        card += item.paymentMethods.card || 0;
        wallet += item.paymentMethods.wallet || 0;
      } else {
        const method = String(item.paymentMethod || 'cash').toLowerCase();
        if (method.includes('upi') || method.includes('razorpay')) upi += item.total || 0;
        else if (method.includes('card')) card += item.total || 0;
        else if (method.includes('wallet')) wallet += item.total || 0;
        else cash += item.total || 0;
      }
    });

    return {
      gross,
      net,
      gst,
      count,
      aov,
      pending,
      refunds,
      cash,
      upi,
      card,
      wallet,
      other,
      ordersList: unifiedList
    };
  }, [selectedDate, paidTransactions, orders, customerProfiles]);

  const handleReservationActionSubmit = async () => {
    if (!tenantId || !selectedRes || !resActionType) return;
    try {
      const batch = writeBatch(db);
      const resRef = doc(db, 'restaurants', tenantId, 'reservations', selectedRes.id);
      let custResRef = null;
      if (selectedRes.customerId && selectedRes.customerId !== 'guest-uid') {
        custResRef = doc(db, 'customers', selectedRes.customerId, 'reservations', selectedRes.id);
      }

      if (resActionType === 'Accept') {
        batch.update(resRef, { status: 'Confirmed' });
        if (custResRef) batch.update(custResRef, { status: 'Confirmed' });
        toast.success('Reservation successfully confirmed!');
      } else if (resActionType === 'Reject') {
        batch.update(resRef, { status: 'Rejected' });
        if (custResRef) batch.update(custResRef, { status: 'Rejected' });
        toast.success('Reservation successfully rejected.');
      } else if (resActionType === 'Modify') {
        const updateObj = { date: resDateInput, time: resTimeInput, guests: resGuestsInput };
        batch.update(resRef, updateObj);
        if (custResRef) batch.update(custResRef, updateObj);
        toast.success('Reservation parameters modified.');
      } else if (resActionType === 'AssignTable') {
        const tableObj = tables.find(t => t.id === resTableInput);
        const updateObj = { 
          assignedTableId: resTableInput, 
          assignedTableNumber: tableObj ? (tableObj.tableNumber || tableObj.number || '') : '' 
        };
        batch.update(resRef, updateObj);
        if (custResRef) batch.update(custResRef, updateObj);
        toast.success('Seating table assigned.');
      } else if (resActionType === 'AssignWaiter') {
        const waiterObj = employees.find(e => e.id === resWaiterInput);
        const updateObj = { 
          assignedWaiterId: resWaiterInput, 
          assignedWaiterName: waiterObj ? (waiterObj.fullName || waiterObj.name || '') : '' 
        };
        batch.update(resRef, updateObj);
        if (custResRef) batch.update(custResRef, updateObj);
        toast.success('Service staff waiter assigned.');
      } else if (resActionType === 'Seat') {
        const nowIso = new Date().toISOString();
        const targetTable = tables.find(t => t.id === resTableInput);
        const orderId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
        
        // Seat guests with complete table & order linkage
        const resUpdateObj = { 
          status: 'Seated', 
          seatedAt: nowIso,
          assignedTableId: targetTable?.id || resTableInput,
          assignedTableNumber: targetTable ? (targetTable.tableNumber || targetTable.number || '') : '',
          activeOrderId: orderId,
          orderId: orderId,
          updatedAt: nowIso
        };
        batch.update(resRef, resUpdateObj);
        if (custResRef) batch.update(custResRef, resUpdateObj);
        
        // Update physical Table
        if (targetTable) {
          const tableRef = doc(db, 'restaurants', tenantId, 'tables', targetTable.id);
          const orderRef = doc(db, 'restaurants', tenantId, 'orders', orderId);
          
          // Create blank order to start dining session linked to reservation
          batch.set(orderRef, {
            id: orderId,
            orderId,
            reservationId: selectedRes.id,
            customerId: selectedRes.customerId,
            customerName: selectedRes.customerName,
            tableNumber: targetTable.tableNumber || targetTable.number,
            tableId: targetTable.id,
            tenantId: tenantId,
            items: [],
            status: 'ACCEPTED',
            subtotal: 0,
            total: 0,
            createdAt: nowIso,
            updatedAt: nowIso
          });

          batch.update(tableRef, {
            status: 'Occupied',
            activeOrderId: orderId,
            reservationId: selectedRes.id,
            seatingTime: nowIso,
            guestsCount: selectedRes.guests || 2,
            assignedWaiterId: user?.uid || '',
            assignedWaiterName: user?.displayName || user?.email || 'Host'
          });
        }
        toast.success('Reservation checked in & table status set to Occupied.');
      }

      await batch.commit();
      setSelectedRes(null);
      setResActionType(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to execute reservation update.');
    }
  };

  const handleMarkArrived = async (res: any) => {
    if (!tenantId) return;
    try {
      const batch = writeBatch(db);
      const resRef = doc(db, 'restaurants', tenantId, 'reservations', res.id);
      batch.update(resRef, { status: 'Arrived' });
      if (res.customerId && res.customerId !== 'guest-uid') {
        const custResRef = doc(db, 'customers', res.customerId, 'reservations', res.id);
        batch.update(custResRef, { status: 'Arrived' });
      }
      await batch.commit();
      toast.success('Guest marked as Arrived.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to update status.');
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center space-y-4">
        <LoadingSpinner label="Compiling Spiral Dine Executive Dashboard..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left select-none text-[#17202A]">
      
      {/* Breadcrumb Navigation */}
      {view !== 'dashboard' && (
        <div className="flex items-center space-x-2 text-xs font-semibold text-[#52606D] mb-6 bg-white p-3.5 border border-[#E5E0D9] rounded-2xl shadow-sm">
          <button onClick={() => setView('dashboard')} className="hover:text-[#C9533B] transition-colors text-[#52606D]">Owner Dashboard</button>
          <ChevronRight className="w-3.5 h-3.5 text-[#7B8794]" />
          {view === 'annual' ? (
            <span className="text-[#17202A] font-bold">Annual Revenue</span>
          ) : view === 'reservations' ? (
            <span className="text-[#17202A] font-bold">Reservation Management</span>
          ) : (
            <>
              <button onClick={() => setView('annual')} className="hover:text-[#C9533B] transition-colors text-[#52606D]">Annual Revenue</button>
              <ChevronRight className="w-3.5 h-3.5 text-[#7B8794]" />
              <span className="text-[#17202A] font-bold">{selectedMonthData.label}</span>
            </>
          )}
        </div>
      )}

      {view === 'dashboard' && (
        <>
      
      {/* 1. Header & Greetings Insight (Executive Greetings Card) */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5E0D9] shadow-sm relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-3xl">
          <div className="flex items-center space-x-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#16845B] animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#7B8794]">Live Executive Feed</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-[#17202A] flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#C9533B]" />
            <span>{greeting.title}</span>
          </h1>
          <p className="text-xs text-[#52606D] leading-relaxed font-semibold">
            {greeting.desc}
          </p>
        </div>
        
        {/* Quick Action buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto self-start md:self-center">
          <button
            type="button"
            onClick={() => setView('reservations')}
            aria-label="View Reservations - Check today's bookings"
            className="group w-full sm:w-[245px] md:w-[255px] min-h-[72px] px-5 py-3.5 bg-[#C9533B] hover:bg-[#B3452F] text-white rounded-[16px] shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C9533B] focus:ring-offset-2 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <CalendarDays className="w-6 h-6 text-white shrink-0" aria-hidden="true" />
              <div className="flex flex-col min-w-0">
                <span className="text-[16px] font-bold text-white leading-tight tracking-tight">
                  View Reservations
                </span>
                <span className="text-[12px] font-medium text-white/80 leading-normal mt-0.5">
                  Check today's bookings
                </span>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-1" aria-hidden="true" />
          </button>
          {featureFlags.strategy && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => navigate('/dashboard/owner/strategy')}
              className="border-[#E5E0D9] text-xs font-semibold text-[#17202A] hover:border-[#C9533B] hover:text-[#C9533B] flex items-center space-x-1.5"
            >
              <Compass className="w-4 h-4 text-[#2878D4]" />
              <span>Strategy Center</span>
            </Button>
          )}
          {featureFlags.intelligence && (
            <Button 
              size="sm"
              onClick={() => {
                toast.loading('Forcing engine audit...', { id: 'force-compile' });
                intelligenceService.compileIntelligence(tenantId || '')
                  .then(() => toast.success('Executive Intelligence sync complete.', { id: 'force-compile' }))
                  .catch(() => toast.error('Failed to sync intelligence.', { id: 'force-compile' }));
              }}
              className="text-xs font-semibold flex items-center space-x-1.5 bg-[#C9533B] text-white hover:bg-[#A94332]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Audit System</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Top Grid - Macro KPIs (5 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* KPI 1: Business Health Score */}
        <Card className="p-5 border-[#E5E0D9] bg-white relative overflow-hidden flex flex-col justify-between h-44 hover:border-[#16845B]/40 transition-all duration-300 shadow-sm rounded-2xl">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#52606D]">Business Health</span>
              <div className="text-[9px] text-[#7B8794]">
                Coverage: {businessHealthReport.dataCoveragePercentage}%
              </div>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setIsHealthModalOpen(true)}
                className="px-2 py-0.5 text-[10px] font-semibold text-[#16845B] bg-[#E8F5EF] hover:bg-[#C6E7D8] rounded-md transition-colors border border-[#C6E7D8]/60 cursor-pointer"
                title="View score explanation & telemetry"
              >
                Details
              </button>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#E8F5EF] border border-[#C6E7D8]">
                <Award className="w-3.5 h-3.5 text-[#16845B]" />
              </div>
            </div>
          </div>
          <div className="my-1 flex items-baseline space-x-2">
            <span className="text-4xl font-display font-black text-[#17202A]">
              {businessHealthReport.overallScore !== null ? businessHealthReport.overallScore : '—'}
            </span>
            <span className="text-[10px] text-[#7B8794]">/ 100</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold border-t border-[#E5E0D9] pt-2.5">
            <span
              className="uppercase tracking-wider font-extrabold text-[10px]"
              style={{
                color: businessHealthReport.overallScore !== null && businessHealthReport.overallScore >= 80 ? '#16845B' :
                       businessHealthReport.overallScore !== null && businessHealthReport.overallScore >= 65 ? '#2E7D32' :
                       businessHealthReport.overallScore !== null && businessHealthReport.overallScore >= 50 ? '#D97706' : '#D64545'
              }}
            >
              {businessHealthReport.label}
            </span>
            <span className="text-[#52606D] text-[9px] truncate max-w-[110px]" title={businessHealthReport.trendText}>
              {businessHealthReport.trendText}
            </span>
          </div>
        </Card>

        {/* KPI 2: Revenue Summary */}
        <Card className="p-5 border-[#E5E0D9] bg-white relative overflow-hidden flex flex-col justify-between h-44 hover:border-[#16845B]/40 transition-all duration-300 shadow-sm rounded-2xl">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#52606D]">Today's Revenue</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#E8F5EF] border border-[#C6E7D8]">
              <DollarSign className="w-4 h-4 text-[#16845B]" />
            </div>
          </div>
          <div className="my-2 flex items-center justify-between">
            <h2 className="text-2xl xl:text-3xl font-display font-extrabold text-[#17202A]">{formatPrice(todaySales)}</h2>
            <div className="shrink-0">{renderSparkline()}</div>
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold border-t border-[#E5E0D9] pt-2.5">
            <span className={revenueChangePercent >= 0 ? 'text-[#16845B]' : 'text-[#D64545]'}>
              {revenueChangePercent >= 0 ? `+${revenueChangePercent}%` : `${revenueChangePercent}%`} vs yesterday
            </span>
            <span className="text-[#52606D]">AOV: {formatPrice(averageOrderValue)}</span>
          </div>
        </Card>

        {/* KPI 5: Annual Revenue Analysis */}
        <Card className="p-5 border-[#E5E0D9] bg-white relative overflow-hidden flex flex-col justify-between h-44 hover:border-[#2878D4]/40 transition-all duration-300 shadow-sm rounded-2xl">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#52606D]">Annual Revenue Analysis</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#EAF2FB] border border-[#CBE0F7]">
              <Calendar className="w-4 h-4 text-[#2878D4]" />
            </div>
          </div>
          <div className="my-1.5 space-y-1">
            <div className="flex justify-between text-xs font-semibold text-[#52606D]">
              <span>FY {currentFY}</span>
              <strong className="text-[#17202A]">{formatPrice(currentFYMetrics.net)}</strong>
            </div>
            <div className="flex justify-between text-[10px] text-[#7B8794] font-semibold">
              <span>Orders: {currentFYMetrics.count}</span>
              <span>Avg: {formatPrice(currentFYMetrics.avgMonthly)}/mo</span>
            </div>
          </div>
          <div className="border-t border-[#E5E0D9] pt-2 flex justify-end">
            <Button
              size="sm"
              onClick={() => setView('annual')}
              className="bg-[#EAF2FB] text-[#1D5D9B] hover:bg-[#1D5D9B] hover:text-white border border-[#CBE0F7] font-bold rounded-lg text-[9px] px-2.5 py-1.5 flex items-center space-x-1 transition-colors"
            >
              <span>View Annual Analysis</span>
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </Card>

        {/* KPI 3: Live Operations */}
        <Card className="p-5 border-[#E5E0D9] bg-white relative overflow-hidden flex flex-col justify-between h-44 hover:border-[#C9533B]/40 transition-all duration-300 shadow-sm rounded-2xl">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#52606D]">Live Operations</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#FBEAE5] border border-[#F5CBC4]">
              <Activity className="w-4 h-4 text-[#C9533B]" />
            </div>
          </div>
          <div className="my-2 flex items-baseline space-x-2">
            <span className="text-4xl font-display font-black text-[#17202A]">{activeOrdersCount}</span>
            <span className="text-xs text-[#52606D] font-semibold">Active Orders</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold border-t border-[#E5E0D9] pt-2.5">
            <span className={`${kitchenLoadStatus.color}`}>{kitchenLoadStatus.label}</span>
            <span className="text-[#52606D]">{activeOccupiedTables} Occupied Tables</span>
          </div>
        </Card>

        {/* KPI 4: Customer Experience */}
        <Card className="p-5 border-[#E5E0D9] bg-white relative overflow-hidden flex flex-col justify-between h-44 hover:border-[#D98B00]/40 transition-all duration-300 shadow-sm rounded-2xl">
          <div className="flex justify-between items-start">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#52606D]">Customer Experience</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#FFF4DC] border border-[#FDE6B0]">
              <ThumbsUp className="w-4 h-4 text-[#D98B00]" />
            </div>
          </div>
          <div className="my-2 flex items-baseline space-x-2">
            <span className="text-4xl font-display font-black text-[#17202A]">
              {csatMetrics.avg !== null ? csatMetrics.avg.toFixed(1) : '—'}
            </span>
            <span className="text-xs text-[#52606D] font-bold">
              {csatMetrics.avg !== null ? '/ 5.0 Rating' : 'No reviews yet'}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold border-t border-[#E5E0D9] pt-2.5">
            <span className="text-[#1D5D9B] font-semibold">
              {csatMetrics.repeatRate !== null ? `${csatMetrics.repeatRate}% Repeat Rate` : '— Repeat Rate'}
            </span>
            <span className="text-[#D64545] font-extrabold">{csatMetrics.pendingFeedback} Pending Reviews</span>
          </div>
        </Card>
      </div>

      {/* 3. Middle Section - Strategies, Risk, opportunities (2 Columns Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Recommendations & Risks */}
        <div className="space-y-6">
          
          {/* Today's Top Recommendation */}
          {featureFlags.strategy && (
            <Card className="p-5 border-slate-850 bg-slate-900/40 space-y-4">
              <div className="flex items-center space-x-2">
                <Target className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-bold text-sm text-textPearl">Today's Top Recommendation</h3>
              </div>
              {recommendedStrategy ? (
                <div className="p-4 bg-slate-955/45 border border-slate-800/50 rounded-2xl space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-textPearl">{recommendedStrategy.title}</span>
                    <span className="text-[10px] font-extrabold text-emerald-450 px-2 py-0.5 bg-emerald-500/10 rounded-full shrink-0">
                      +{recommendedStrategy.expectedRoiPercent}% ROI
                    </span>
                  </div>
                  <p className="text-[11px] text-mutedAsh leading-relaxed font-semibold">
                    <strong className="text-slate-400">Reasoning:</strong> {recommendedStrategy.reason}
                  </p>
                  <div className="flex justify-between items-center border-t border-slate-850/50 pt-2.5 text-[10px] font-bold text-slate-500">
                    <span>Impact: {recommendedStrategy.expectedBenefit}</span>
                    <Button 
                      size="sm" 
                      onClick={() => handleAcceptRecommendation(recommendedStrategy)}
                      className="bg-amber-500 text-slate-950 font-black hover:bg-amber-600 rounded-lg text-[9px] px-2.5 py-1"
                    >
                      Accept & Activate
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-dashed border-slate-850/60 rounded-2xl text-center space-y-1 bg-slate-950/20">
                  <p className="text-xs font-semibold text-slate-400">No strategy recommendations yet</p>
                  <p className="text-[11px] text-slate-500">Growth recommendations will automatically appear as sales and dining patterns emerge.</p>
                </div>
              )}
            </Card>
          )}

          {/* Today's Operational Status / Biggest Risk */}
          <Card className="p-5 border-slate-850 bg-slate-900/40 space-y-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className={`w-5 h-5 ${biggestRisk.color === 'emerald' ? 'text-emerald-400' : biggestRisk.color === 'red' ? 'text-rose-500' : 'text-amber-500'}`} />
              <h3 className="font-display font-bold text-sm text-textPearl">Today's Operational Status</h3>
            </div>
            <div className={`p-4 ${
              biggestRisk.color === 'emerald' ? 'bg-emerald-500/5 border-emerald-500/20' :
              biggestRisk.color === 'red' ? 'bg-rose-500/5 border-rose-500/20' :
              'bg-amber-500/5 border-amber-500/20'
            } border rounded-2xl space-y-3`}>
              <div className="flex justify-between items-center">
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  biggestRisk.color === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' :
                  biggestRisk.color === 'red' ? 'bg-rose-500/15 text-rose-400' :
                  'bg-amber-500/15 text-amber-400'
                }`}>
                  {biggestRisk.type}
                </span>
                <span className="text-[9px] font-bold text-slate-500">
                  {biggestRisk.color === 'emerald' ? 'All Clear' : 'Immediate Action Recommended'}
                </span>
              </div>
              <h4 className="text-xs font-bold text-textPearl">{biggestRisk.title}</h4>
              <p className="text-[11px] text-mutedAsh leading-relaxed font-semibold">
                {biggestRisk.description}
              </p>
              <div className="border-t border-slate-850/50 pt-2.5 flex justify-end">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={async () => {
                    if (biggestRisk.actionLabel === 'Create Purchase Order') {
                      const tid = toast.loading('Syncing low-stock replenishment list...');
                      try {
                        await automationService.runScheduledJob(tenantId || '', 'low_stock_check', 'Background Stock Safety Audit');
                      } catch (e) {}
                      toast.dismiss(tid);
                    }
                    navigate(biggestRisk.actionLink);
                  }}
                  className="border-slate-850 hover:bg-rose-500/10 text-rose-455 font-bold text-[9px]"
                >
                  {biggestRisk.actionLabel}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Opportunity Center & Automation logs */}
        <div className="space-y-6">
          
          {/* Opportunity Center */}
          {featureFlags.strategy && (
            <Card className="p-5 border-slate-850 bg-slate-900/40 space-y-4">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-display font-bold text-sm text-textPearl">Opportunity Growth Center</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-950/20 border border-slate-850 rounded-xl flex flex-col justify-between h-24 hover:border-slate-800 transition-colors">
                  <div>
                    <span className="text-[10px] font-bold text-textPearl">Lunch Hour Combos</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">Basmati Rice + Paneer deals</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold mt-2">
                    <span className="text-emerald-450">+140% ROI</span>
                    <button 
                      onClick={() => handleLaunchCampaign('Lunch Hour Combos', '140%')}
                      className="text-[9px] text-amber-500 hover:text-amber-400 font-extrabold"
                    >
                      Launch
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-slate-950/20 border border-slate-850 rounded-xl flex flex-col justify-between h-24 hover:border-slate-800 transition-colors">
                  <div>
                    <span className="text-[10px] font-bold text-textPearl">Biryani Weekend Campaign</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">Weekend traffic stimulator</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold mt-2">
                    <span className="text-emerald-450">+200% ROI</span>
                    <button 
                      onClick={() => handleLaunchCampaign('Biryani Weekend Campaign', '200%')}
                      className="text-[9px] text-amber-500 hover:text-amber-400 font-extrabold"
                    >
                      Launch
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl flex flex-col justify-between h-24 hover:border-slate-800 transition-colors">
                  <div>
                    <span className="text-[10px] font-bold text-textPearl">Happy Hour Specials</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">3-5 PM traffic driver</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold mt-2">
                    <span className="text-emerald-450">+120% ROI</span>
                    <button 
                      onClick={() => handleLaunchCampaign('Happy Hour Specials', '120%')}
                      className="text-[9px] text-amber-500 hover:text-amber-400 font-extrabold"
                    >
                      Launch
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl flex flex-col justify-between h-24 hover:border-slate-800 transition-colors">
                  <div>
                    <span className="text-[10px] font-bold text-textPearl">Feedback Recovery Promo</span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">Win back complaints</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold mt-2">
                    <span className="text-emerald-450">+300% ROI</span>
                    <button 
                      onClick={() => handleLaunchCampaign('Feedback Recovery Promo', '300%')}
                      className="text-[9px] text-amber-500 hover:text-amber-400 font-extrabold"
                    >
                      Launch
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Automation Status */}
          {featureFlags.automation && (
            <Card className="p-5 border-slate-850 bg-slate-900/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-amber-500" />
                  <h3 className="font-display font-bold text-sm text-textPearl">Automation Status</h3>
                </div>
                <Badge variant="muted" className="border-slate-800 text-[9px] text-slate-450 font-mono">
                  {activeAutomationRulesCount} Active Rules
                </Badge>
              </div>
              
              {/* Stats widgets */}
              <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                <div className="p-3 bg-slate-955/30 border border-slate-855/50 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Success Rate</span>
                  <span className="text-lg font-black text-emerald-455 mt-1 block">{automationSuccessPct}%</span>
                </div>
                <div className="p-3 bg-slate-955/30 border border-slate-855/50 rounded-xl">
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Active Alerts</span>
                  <span className={`text-lg font-black mt-1 block ${inventoryMetrics.low > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-455'}`}>
                    {inventoryMetrics.low} warnings
                  </span>
                </div>
              </div>

              {/* Background scheduler job triggers */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Manual Sweep Controllers</span>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleTriggerJob('low_stock_check', 'Background Stock Safety Audit')}
                    className="flex-1 border-slate-800 hover:bg-slate-905 text-[10px] font-bold"
                  >
                    <Play className="w-3 h-3 mr-1 text-emerald-500" />
                    Stock Audit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleTriggerJob('expiry_check', 'Expiry Dates Calendar Monitor')}
                    className="flex-1 border-slate-800 hover:bg-slate-905 text-[10px] font-bold"
                  >
                    <Play className="w-3 h-3 mr-1 text-emerald-500" />
                    Expiry Sweep
                  </Button>
                </div>
              </div>

              {/* Background Terminal Logs */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Live Runner Audit Logs</span>
                <div className="p-3 bg-slate-955 border border-slate-900 rounded-xl font-mono text-[9px] text-emerald-455/90 h-24 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {jobsHistory.slice(0, 4).map((log, idx) => (
                    <div key={log.id || idx} className="flex justify-between items-start leading-tight">
                      <span>
                        &gt; {log.name}: <span className={log.status === 'completed' ? 'text-emerald-400' : 'text-rose-455'}>{log.status}</span>
                      </span>
                      <span className="text-slate-600 font-sans shrink-0 ml-1">
                        {new Date(log.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {jobsHistory.length === 0 && (
                    <div className="text-slate-700 italic text-center py-6">No background scheduler jobs recorded yet.</div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* 4. Bottom Grid - Inventory Snapshot & Staff Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Inventory Snapshot (Linear Progress Bar status) */}
        <Card className="lg:col-span-1 p-5 border-slate-850 bg-slate-900/40 space-y-4">
          <div className="flex items-center space-x-2">
            <ClipboardList className="w-5 h-5 text-amber-500" />
            <h3 className="font-display font-bold text-sm text-textPearl">Inventory Snapshot</h3>
          </div>
          
          <div className="space-y-3.5">
            {/* Linear Progress bar */}
            <div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                <span>Ingredient Stock Healthy</span>
                <span className="text-emerald-455">{inventoryMetrics.healthy} / {inventory.length} items</span>
              </div>
              <div className="w-full bg-slate-955 h-2 rounded-full overflow-hidden border border-slate-850/50">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${inventory.length > 0 ? Math.round((inventoryMetrics.healthy / inventory.length) * 100) : 0}%` }}
                />
              </div>
            </div>

            {/* Counts grid */}
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold pt-1">
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Low Stock</span>
                <span className={`text-base font-extrabold block mt-0.5 ${(inventoryMetrics.low + inventoryMetrics.critical) > 0 ? 'text-amber-500' : 'text-slate-350'}`}>
                  {inventoryMetrics.low + inventoryMetrics.critical} items
                </span>
              </div>
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-505 block uppercase font-bold tracking-wider">Out of Stock</span>
                <span className={`text-base font-extrabold block mt-0.5 ${(inventoryMetrics.out || 0) > 0 ? 'text-rose-500 font-bold' : 'text-slate-350'}`}>
                  {inventoryMetrics.out || 0} items
                </span>
              </div>
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-505 block uppercase font-bold tracking-wider">Expiring soon</span>
                <span className={`text-base font-extrabold block mt-0.5 ${inventoryMetrics.expiringSoon > 0 ? 'text-orange-500' : 'text-slate-350'}`}>
                  {inventoryMetrics.expiringSoon} items
                </span>
              </div>
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-505 block uppercase font-bold tracking-wider">Overall Health</span>
                <span className="text-base font-extrabold text-emerald-455 block mt-0.5">
                  {inventory.length > 0 ? Math.round((inventoryMetrics.healthy / inventory.length) * 100) : 100}%
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Waiter Operations */}
        <Card className="lg:col-span-1 p-5 border-slate-850 bg-slate-900/40 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h3 className="font-display font-bold text-sm text-textPearl">Waiter Operations</h3>
            </div>
            
            {/* Stats list */}
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-550 block uppercase font-bold tracking-wider">Total Waiters</span>
                <span className="text-xs font-black text-textPearl block mt-0.5">
                  {waiterMetrics.total} rostered
                </span>
              </div>
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-550 block uppercase font-bold tracking-wider">Active Tables</span>
                <span className="text-xs font-black text-emerald-450 block mt-0.5">
                  {waiterMetrics.activeTables} assigned
                </span>
              </div>
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-550 block uppercase font-bold tracking-wider">On Shift</span>
                <span className="text-xs font-black text-indigo-400 block mt-0.5">
                  {waiterMetrics.onShift} active
                </span>
              </div>
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-550 block uppercase font-bold tracking-wider">Off Shift</span>
                <span className="text-xs font-black text-slate-400 block mt-0.5">
                  {waiterMetrics.offShift} offline
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center px-3 py-2 bg-slate-950/20 border border-slate-850 rounded-xl text-[10px] font-bold text-slate-500">
              <span>Pending Invitations:</span>
              <span className="text-amber-500 font-extrabold">{waiterMetrics.pending} pending</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-850/50">
            <Button 
              size="xs" 
              onClick={() => { setInviteRole('waiter'); setInviteForm({ fullName: '', email: '', phone: '', department: 'Service' }); setIsInviteOpen(true); }}
              className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-slate-950 font-bold rounded-xl py-2"
            >
              <UserPlus className="w-3.5 h-3.5 mr-1 inline" />
              Invite Waiter
            </Button>
            <Button 
              size="xs" 
              variant="outline"
              onClick={() => navigate('/dashboard/owner/staff?role=waiter')}
              className="border-slate-800 text-slate-400 hover:text-textPearl font-bold rounded-xl py-2"
            >
              Manage Staff
            </Button>
            <Button 
              size="xs" 
              variant="outline"
              onClick={() => { setPerformanceType('waiter'); setIsPerformanceOpen(true); }}
              className="border-slate-800 text-slate-400 hover:text-textPearl font-bold rounded-xl py-2"
            >
              Performance
            </Button>
            <Button 
              size="xs" 
              variant="outline"
              onClick={() => { setShiftsType('waiter'); setIsShiftsOpen(true); }}
              className="border-slate-800 text-slate-400 hover:text-textPearl font-bold rounded-xl py-2"
            >
              Shift Overview
            </Button>
          </div>
        </Card>

        {/* Kitchen Operations */}
        <Card className="lg:col-span-1 p-5 border-slate-850 bg-slate-900/40 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <ChefHat className="w-5 h-5 text-amber-500" />
              <h3 className="font-display font-bold text-sm text-textPearl">Kitchen Operations</h3>
            </div>
            
            {/* Stats list */}
            <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-550 block uppercase font-bold tracking-wider">Total Chefs</span>
                <span className="text-xs font-black text-textPearl block mt-0.5">
                  {kitchenMetrics.total} rostered
                </span>
              </div>
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-550 block uppercase font-bold tracking-wider">Active Orders</span>
                <span className="text-xs font-black text-amber-500 block mt-0.5">
                  {kitchenMetrics.activeOrders} cooking
                </span>
              </div>
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-550 block uppercase font-bold tracking-wider">On Shift</span>
                <span className="text-xs font-black text-indigo-400 block mt-0.5">
                  {kitchenMetrics.onShift} active
                </span>
              </div>
              <div className="p-3 bg-slate-955/20 border border-slate-850 rounded-xl">
                <span className="text-[10px] text-slate-550 block uppercase font-bold tracking-wider">Capacity Load</span>
                <span className="text-xs font-black text-emerald-450 block mt-0.5">
                  {kitchenMetrics.capacityPct}% capacity
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center px-3 py-2 bg-slate-950/20 border border-slate-850 rounded-xl text-[10px] font-bold text-slate-500">
              <span>Pending Invitations:</span>
              <span className="text-amber-500 font-extrabold">{kitchenMetrics.pending} pending</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-850/50">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                size="xs" 
                onClick={() => { setInviteRole('kitchen'); setInviteForm({ fullName: '', email: '', phone: '', department: 'Kitchen' }); setIsInviteOpen(true); }}
                className="bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500 hover:text-slate-950 font-bold rounded-xl py-2"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1 inline" />
                Invite Chef
              </Button>
              <Button 
                size="xs" 
                variant="outline"
                onClick={() => navigate('/dashboard/owner/staff?role=kitchen')}
                className="border-slate-800 text-slate-400 hover:text-textPearl font-bold rounded-xl py-2"
              >
                Manage Staff
              </Button>
            </div>
            <Button 
              size="xs" 
              variant="outline"
              onClick={() => { setPerformanceType('kitchen'); setIsPerformanceOpen(true); }}
              className="border-slate-800 text-slate-400 hover:text-textPearl font-bold rounded-xl py-2 w-full"
            >
              View Kitchen Performance
            </Button>
          </div>
        </Card>
      </div>

      {/* 5. Quick Actions Toolbar (Floating action cards footer) */}
      <Card className="p-5 border-[#E5E0D9] bg-white space-y-3 shadow-sm rounded-2xl">
        <span className="text-[10px] uppercase font-bold text-[#7B8794] block tracking-wider">Executive Workspace Command Center</span>
        <div className="flex flex-wrap gap-3">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={async () => {
              if (inventoryMetrics.low > 0 || inventoryMetrics.critical > 0) {
                const tid = toast.loading('Syncing low-stock replenishment list...');
                try {
                  await automationService.runScheduledJob(tenantId || '', 'low_stock_check', 'Background Stock Safety Audit');
                } catch (e) {}
                toast.dismiss(tid);
              }
              navigate('/dashboard/owner/inventory/purchase-orders');
            }}
            className="border-[#E5E0D9] text-xs font-bold text-[#17202A] hover:border-[#D98B00] hover:text-[#D98B00] hover:bg-[#FFF4DC]/40 flex items-center space-x-1.5 py-2 px-3.5 bg-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-0.5 text-[#D98B00]" />
            <span>Create Purchase Order</span>
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => navigate('/dashboard/owner/staff?action=invite')}
            className="border-[#E5E0D9] text-xs font-bold text-[#17202A] hover:border-[#16845B] hover:text-[#16845B] hover:bg-[#E8F5EF]/40 flex items-center space-x-1.5 py-2 px-3.5 bg-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5 mr-0.5 text-[#16845B]" />
            <span>Add Employee Profile</span>
          </Button>
          {featureFlags.strategy && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => navigate('/dashboard/owner/strategy?tab=marketing')}
              className="border-[#E5E0D9] text-xs font-bold text-[#17202A] hover:border-[#C9533B] hover:text-[#C9533B] hover:bg-[#FBEAE5]/40 flex items-center space-x-1.5 py-2 px-3.5 bg-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5 mr-0.5 text-[#C9533B]" />
              <span>Create Promotion Deal</span>
            </Button>
          )}
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => navigate('/dashboard/owner/inventory')}
            className="border-[#E5E0D9] text-xs font-bold text-[#52606D] hover:text-[#17202A] hover:border-[#C9533B] py-2 px-3.5 bg-white transition-colors"
          >
            Open Inventory
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => navigate('/dashboard/owner/billing')}
            className="border-[#E5E0D9] text-xs font-bold text-[#52606D] hover:text-[#17202A] hover:border-[#C9533B] py-2 px-3.5 bg-white transition-colors"
          >
            Open Billing Desk
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => navigate('/dashboard/owner/analytics')}
            className="border-[#E5E0D9] text-xs font-bold text-[#52606D] hover:text-[#17202A] hover:border-[#C9533B] py-2 px-3.5 bg-white transition-colors"
          >
            View Reports
          </Button>
        </div>
      </Card>
      </>
      )}

      {view === 'reservations' && (
        <div className="space-y-6 text-left">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5E0D9] p-6 rounded-3xl shadow-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#F3E8DF] flex items-center justify-center text-[#C85A3F] shrink-0 shadow-2xs">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl sm:text-2xl font-display font-extrabold text-[#17202A]">Reservation Management</h1>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F3E8DF] text-[#C85A3F] border border-[#E5DCD5]">
                      {reservations.length} {reservations.length === 1 ? 'Booking' : 'Bookings'}
                    </span>
                  </div>
                  <p className="text-xs text-[#7B8794] font-medium mt-0.5">Review table booking requests, seat arrived parties, and manage floor staff allocations.</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setView('dashboard')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#FCFAF7] hover:bg-white border border-[#E5E0D9] hover:border-[#C85A3F]/50 text-[#17202A] text-xs font-extrabold rounded-xl transition-all shadow-2xs cursor-pointer group shrink-0"
            >
              <ChevronLeft className="w-4 h-4 text-[#C85A3F] group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Dashboard</span>
            </button>
          </div>

          {/* Stats KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white border border-[#E5E0D9] rounded-2xl p-5 shadow-xs text-left hover:border-slate-400 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-[#7B8794] font-extrabold uppercase tracking-wider">Total Bookings</span>
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl sm:text-3xl font-display font-black text-[#17202A]">{reservations.length}</h3>
                <p className="text-[11px] text-[#7B8794] mt-0.5 font-medium">All registered table bookings</p>
              </div>
            </div>

            <div className="bg-white border border-amber-200/90 rounded-2xl p-5 shadow-xs text-left bg-gradient-to-br from-white to-amber-50/40 hover:border-amber-300 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-amber-700 font-extrabold uppercase tracking-wider">Pending Requests</span>
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl sm:text-3xl font-display font-black text-amber-600">{reservations.filter(r => r.status === 'Pending').length}</h3>
                <p className="text-[11px] text-amber-800/80 mt-0.5 font-medium">Awaiting host confirmation</p>
              </div>
            </div>

            <div className="bg-white border border-emerald-200/90 rounded-2xl p-5 shadow-xs text-left bg-gradient-to-br from-white to-emerald-50/40 hover:border-emerald-300 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-emerald-700 font-extrabold uppercase tracking-wider">Confirmed & Seated</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl sm:text-3xl font-display font-black text-emerald-600">{reservations.filter(r => r.status === 'Seated').length}</h3>
                <p className="text-[11px] text-emerald-800/80 mt-0.5 font-medium">Currently dining in restaurant</p>
              </div>
            </div>

            <div className="bg-white border border-[#E5DCD5] rounded-2xl p-5 shadow-xs text-left bg-gradient-to-br from-white to-[#F3E8DF]/30 hover:border-[#C85A3F]/50 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-[#C85A3F] font-extrabold uppercase tracking-wider">Upcoming Today</span>
                <div className="w-8 h-8 rounded-xl bg-[#F3E8DF] flex items-center justify-center text-[#C85A3F] shrink-0">
                  <CalendarDays className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl sm:text-3xl font-display font-black text-[#C85A3F]">{reservations.filter(r => r.status === 'Confirmed' || r.status === 'Arrived').length}</h3>
                <p className="text-[11px] text-[#7B8794] mt-0.5 font-medium">Expected guest arrivals</p>
              </div>
            </div>

            <div className="bg-white border border-blue-200/90 rounded-2xl p-5 shadow-xs text-left bg-gradient-to-br from-white to-blue-50/40 hover:border-blue-300 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10.5px] text-blue-700 font-extrabold uppercase tracking-wider">Completed</span>
                <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl sm:text-3xl font-display font-black text-blue-600">{reservations.filter(r => r.status === 'Completed').length}</h3>
                <p className="text-[11px] text-blue-800/80 mt-0.5 font-medium">Dining completed</p>
              </div>
            </div>
          </div>

          {/* Table Booking Calendar & List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Roster / Arrivals feed */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#17202A] uppercase tracking-wider flex items-center gap-1.5">
                  <span>Bookings Arrivals Feed</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px]">
                    {activeReservationsList.length}
                  </span>
                </h3>
              </div>
              
              {activeReservationsList.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-white border border-dashed border-[#E5E0D9] rounded-3xl p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#FCFAF7] border border-[#E5E0D9] flex items-center justify-center text-[#C85A3F] mb-3">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-extrabold text-[#17202A]">No active bookings currently</h4>
                  <p className="text-xs text-[#7B8794] mt-1 max-w-sm">New customer table reservation requests submitted from the web portal will appear here in real-time.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeReservationsList.map((res) => {
                    const statusVariant = 
                      res.status === 'Seated' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      res.status === 'Confirmed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      res.status === 'Arrived' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                      res.status === 'Rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-amber-50 text-amber-700 border-amber-200';

                    return (
                      <div key={res.id} className="p-5 bg-white border border-[#E5E0D9] hover:border-[#C85A3F]/40 rounded-2xl flex flex-col gap-4 text-xs shadow-2xs transition-all">
                        {/* Header: Guest Info & Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#F3E8DF] border border-[#E5DCD5] flex items-center justify-center text-[#C85A3F] font-extrabold text-sm shrink-0">
                              {res.customerName ? res.customerName.charAt(0).toUpperCase() : 'G'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-extrabold text-sm text-[#17202A]">{res.customerName}</h4>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border ${statusVariant}`}>
                                  {res.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#7B8794] font-medium mt-0.5">
                                Ref: <span className="font-mono font-bold text-[#17202A]">{res.id}</span> · Party of <span className="font-bold text-[#17202A]">{res.guests} {res.guests === 1 ? 'Diner' : 'Diners'}</span>
                              </p>
                            </div>
                          </div>

                          {/* Seating preference pill */}
                          {res.seatingPreference && (
                            <span className="text-[10px] font-bold text-[#C85A3F] bg-[#F3E8DF] px-2.5 py-1 rounded-lg border border-[#E5DCD5] w-fit">
                              Zone: {res.seatingPreference}
                            </span>
                          )}
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[#FCFAF7] p-3 rounded-xl border border-[#F0EAE4] text-[11px]">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-[#C85A3F] shrink-0" />
                            <div>
                              <span className="text-[#7B8794] block text-[9.5px] font-bold uppercase">Date & Time</span>
                              <span className="font-extrabold text-[#17202A]">{res.date} @ {res.time}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <LayoutGrid className="w-3.5 h-3.5 text-[#C85A3F] shrink-0" />
                            <div>
                              <span className="text-[#7B8794] block text-[9.5px] font-bold uppercase">Assigned Table</span>
                              <span className="font-extrabold text-[#17202A]">
                                {res.assignedTableNumber ? `Table ${res.assignedTableNumber}` : 'Unassigned'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 text-[#C85A3F] shrink-0" />
                            <div>
                              <span className="text-[#7B8794] block text-[9.5px] font-bold uppercase">Staff Waiter</span>
                              <span className="font-extrabold text-[#17202A]">
                                {res.assignedWaiterName || 'Unassigned'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Special Notes / Requests */}
                        {res.specialNotes && (
                          <div className="p-2.5 bg-amber-50/50 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 italic flex items-start gap-2">
                            <span className="font-bold text-amber-700 not-italic shrink-0">Note:</span>
                            <span>"{res.specialNotes}"</span>
                          </div>
                        )}

                        {/* Actions Bar */}
                        <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {res.status === 'Pending' && (
                              <>
                                <button
                                  onClick={() => { setSelectedRes(res); setResActionType('Accept'); }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 text-emerald-700 hover:text-white font-extrabold rounded-xl transition-all shadow-2xs cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Accept</span>
                                </button>
                                <button
                                  onClick={() => { setSelectedRes(res); setResActionType('Reject'); }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-600 border border-rose-200 text-rose-700 hover:text-white font-extrabold rounded-xl transition-all shadow-2xs cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}

                            {res.status === 'Confirmed' && (
                              <button
                                onClick={() => handleMarkArrived(res)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 border border-blue-200 text-blue-700 hover:text-white font-extrabold rounded-xl transition-all shadow-2xs cursor-pointer"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Mark Arrived</span>
                              </button>
                            )}

                            {res.status !== 'Seated' && res.status !== 'Rejected' && res.status !== 'Cancelled' && (
                              <button
                                onClick={() => {
                                  setSelectedRes(res);
                                  setResActionType('Seat');
                                  setResTableInput(res.assignedTableId || tables.find(t => t.status === 'Available')?.id || '');
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#C85A3F] hover:bg-[#A94332] text-white font-extrabold rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                                title="Guests have arrived — seat them at their table immediately"
                              >
                                <Utensils className="w-3.5 h-3.5" />
                                <span>Seat Party</span>
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                            {res.status !== 'Seated' && res.status !== 'Rejected' && res.status !== 'Cancelled' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedRes(res);
                                    setResActionType('AssignTable');
                                    setResTableInput(res.assignedTableId || '');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#FCFAF7] hover:bg-white border border-[#E5E0D9] hover:border-[#C85A3F]/50 text-[#52606D] hover:text-[#17202A] font-bold rounded-xl transition-colors shadow-2xs cursor-pointer"
                                >
                                  <LayoutGrid className="w-3 h-3 text-[#C85A3F]" />
                                  <span>Set Table</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedRes(res);
                                    setResActionType('AssignWaiter');
                                    setResWaiterInput(res.assignedWaiterId || '');
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#FCFAF7] hover:bg-white border border-[#E5E0D9] hover:border-[#C85A3F]/50 text-[#52606D] hover:text-[#17202A] font-bold rounded-xl transition-colors shadow-2xs cursor-pointer"
                                >
                                  <UserCheck className="w-3 h-3 text-[#C85A3F]" />
                                  <span>Set Waiter</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedRes(res);
                                    setResActionType('Modify');
                                    setResDateInput(res.date);
                                    setResTimeInput(res.time);
                                    setResGuestsInput(res.guests);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#FCFAF7] hover:bg-white border border-[#E5E0D9] hover:border-[#C85A3F]/50 text-[#52606D] hover:text-[#17202A] font-bold rounded-xl transition-colors shadow-2xs cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3 text-[#7B8794]" />
                                  <span>Modify</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Completed Dinings History Section */}
              {completedReservationsList.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-200/80 text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-[#52606D] uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Completed Dinings History</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[10px] font-bold">
                        {completedReservationsList.length}
                      </span>
                    </h4>
                  </div>

                  <div className="space-y-3">
                    {completedReservationsList.map((res) => (
                      <div key={res.id} className="p-4 bg-[#FCFAF7] border border-[#E5E0D9] rounded-2xl flex flex-col gap-3 text-xs shadow-2xs opacity-90 hover:opacity-100 transition-opacity">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/60">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-200/80 border border-slate-300 flex items-center justify-center text-slate-700 font-extrabold text-sm shrink-0">
                              {res.customerName ? res.customerName.charAt(0).toUpperCase() : 'G'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-extrabold text-sm text-[#17202A]">{res.customerName}</h5>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide border bg-slate-100 text-slate-700 border-slate-300">
                                  COMPLETED
                                </span>
                              </div>
                              <p className="text-[11px] text-[#7B8794] font-medium mt-0.5">
                                Ref: <span className="font-mono font-bold text-[#17202A]">{res.id}</span> · Party of <span className="font-bold text-[#17202A]">{res.guests} {res.guests === 1 ? 'Diner' : 'Diners'}</span>
                              </p>
                            </div>
                          </div>
                          <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 w-fit flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            Dining completed
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 rounded-xl border border-[#E5E0D9] text-[11px]">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-[#7B8794] shrink-0" />
                            <div>
                              <span className="text-[#7B8794] block text-[9px] font-bold uppercase">Date & Time</span>
                              <span className="font-bold text-[#17202A]">{res.date} @ {res.time}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <LayoutGrid className="w-3.5 h-3.5 text-[#7B8794] shrink-0" />
                            <div>
                              <span className="text-[#7B8794] block text-[9px] font-bold uppercase">Table</span>
                              <span className="font-bold text-[#17202A]">Table {res.assignedTableNumber || res.tableNumber || 'Assigned'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <div>
                              <span className="text-[#7B8794] block text-[9px] font-bold uppercase">Completion</span>
                              <span className="font-bold text-emerald-800">
                                {res.completedAt ? new Date(res.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Finished'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar: Reservation Calendar Summary */}
            <div className="space-y-4 text-left">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#17202A] uppercase tracking-wider">Table Calendar Status</h3>
                <span className="text-[10px] text-[#7B8794] font-bold">{tables.length} Total Tables</span>
              </div>

              <div className="bg-white border border-[#E5E0D9] rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[11px] text-[#7B8794] font-extrabold uppercase tracking-wider">Physical Floor Layout</span>
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Available
                    </span>
                    <span className="flex items-center gap-1 text-amber-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Booked
                    </span>
                  </div>
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {tables.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No floor tables configured.</p>
                  ) : (
                    tables.map(t => {
                      const assignedRes = reservations.find(r => 
                        (r.assignedTableId === t.id || r.assignedTableNumber === String(t.number || t.tableNumber)) && 
                        (r.status === 'Confirmed' || r.status === 'Arrived' || r.status === 'Pending')
                      );
                      const isOccupied = t.status === 'Occupied';
                      
                      return (
                        <div key={t.id} className="p-3 bg-[#FCFAF7] border border-[#E5E0D9] hover:border-[#C85A3F]/40 rounded-xl flex items-center justify-between text-xs transition-colors">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-[#17202A]">Table {t.number || t.tableNumber}</span>
                              <span className="text-[10px] text-[#7B8794] font-medium">({t.capacity} seats)</span>
                            </div>
                            <span className="text-[10px] text-[#7B8794] block mt-0.5">Floor: {t.floor || 'Ground Floor'}</span>
                          </div>
                          <div>
                            {assignedRes ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                Res: {assignedRes.time}
                              </span>
                            ) : isOccupied ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                Occupied
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-emerald-500"></span> Available
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Action Modals */}
          <Modal
            isOpen={selectedRes !== null && resActionType !== null}
            onClose={() => { setSelectedRes(null); setResActionType(null); }}
            variant="light"
            size="lg"
            title={
              resActionType === 'AssignWaiter' ? 'Assign Dedicated Server' :
              resActionType === 'AssignTable' ? 'Select Dining Table' :
              resActionType === 'Seat' ? 'Seat Arrived Party' :
              resActionType === 'Modify' ? 'Modify Reservation Details' :
              resActionType === 'Accept' ? 'Approve Reservation' :
              resActionType === 'Reject' ? 'Decline Reservation' : 'Reservation Action'
            }
          >
            {selectedRes && (
              <div className="space-y-4 text-left">
                
                {/* Guest Details Overview Banner */}
                <div className="p-4 bg-gradient-to-r from-[#FFF8F5] via-white to-[#FBF8F5] border border-[#F3E3D8] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#E85D3F] to-[#C84A38] text-white flex items-center justify-center font-extrabold text-base shadow-sm shrink-0">
                      {selectedRes.customerName ? selectedRes.customerName.charAt(0).toUpperCase() : 'G'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm sm:text-base text-[#17202A]">{selectedRes.customerName}</h4>
                        <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold bg-[#FDF0EB] text-[#C84A38] border border-[#F6D3C7]">
                          {selectedRes.guests} Diners
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-[#7B8794] mt-0.5 flex-wrap">
                        <span>Ref: <strong className="font-mono text-[#334155]">{selectedRes.id}</strong></span>
                        {selectedRes.customerPhone && (
                          <>
                            <span>•</span>
                            <span className="font-medium">{selectedRes.customerPhone}</span>
                          </>
                        )}
                        {selectedRes.assignedTableNumber && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-[#17202A]">Table {selectedRes.assignedTableNumber}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0 bg-white border border-[#E5E0D9] px-3.5 py-2 rounded-xl shadow-2xs">
                    <span className="text-[9.5px] uppercase font-extrabold text-[#7B8794] block tracking-wider">Date & Time</span>
                    <span className="font-extrabold text-xs text-[#17202A] flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-[#C85A3F]" />
                      {selectedRes.date} @ {selectedRes.time}
                    </span>
                  </div>
                </div>

                {/* 1. APPROVE / DECLINE PROMPT */}
                {resActionType === 'Accept' && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                      <Check className="w-5 h-5 text-emerald-600" />
                      <span>Confirm this table reservation?</span>
                    </div>
                    <p className="text-xs text-emerald-900/80 leading-relaxed">
                      Confirming will mark this booking as <strong>Confirmed</strong> and send a confirmation notice to {selectedRes.customerName} for their party of {selectedRes.guests}.
                    </p>
                  </div>
                )}

                {resActionType === 'Reject' && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-800 font-extrabold text-sm">
                      <X className="w-5 h-5 text-rose-600" />
                      <span>Decline this table reservation?</span>
                    </div>
                    <p className="text-xs text-rose-900/80 leading-relaxed">
                      Declining will mark this booking as <strong>Rejected</strong> and notify {selectedRes.customerName} that requested slots are at capacity.
                    </p>
                  </div>
                )}

                {/* 2. MODIFY RESERVATION */}
                {resActionType === 'Modify' && (
                  <div className="space-y-4">
                    {/* Booking Date */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase font-extrabold text-[#17202A] flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#C85A3F]" />
                        <span>Booking Date</span>
                      </label>
                      <input 
                        type="date" 
                        value={resDateInput} 
                        onChange={(e) => setResDateInput(e.target.value)} 
                        className="w-full p-3 bg-white border border-[#E5E0D9] focus:border-[#C85A3F] focus:ring-2 focus:ring-[#C85A3F]/15 text-[#17202A] rounded-xl outline-none font-semibold text-xs transition-all"
                      />
                    </div>

                    {/* Time Slot */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase font-extrabold text-[#17202A] flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#C85A3F]" />
                        <span>Time Slot</span>
                      </label>
                      <div className="space-y-2">
                        <input 
                          type="text" 
                          value={resTimeInput} 
                          onChange={(e) => setResTimeInput(e.target.value)} 
                          placeholder="e.g. 12:00 PM or 7:30 PM"
                          className="w-full p-3 bg-white border border-[#E5E0D9] focus:border-[#C85A3F] focus:ring-2 focus:ring-[#C85A3F]/15 text-[#17202A] rounded-xl outline-none font-semibold text-xs transition-all"
                        />
                        {/* Quick select pills */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {['12:00 PM', '1:00 PM', '2:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setResTimeInput(t)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold border transition-all cursor-pointer",
                                resTimeInput === t
                                  ? "bg-[#FFF8F5] border-[#E85D3F] text-[#C85A3F]"
                                  : "bg-white border-[#E5E0D9] text-[#52606D] hover:bg-[#FAF7F2]"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Party Size Stepper */}
                    <div className="space-y-1.5">
                      <label className="text-xs uppercase font-extrabold text-[#17202A] flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#C85A3F]" />
                        <span>Party Size (Guests)</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setResGuestsInput(Math.max(1, (resGuestsInput || 1) - 1))}
                          className="w-10 h-10 rounded-xl bg-white border border-[#E5E0D9] hover:bg-slate-50 text-[#17202A] font-extrabold flex items-center justify-center cursor-pointer shadow-2xs text-base active:scale-95"
                        >
                          -
                        </button>
                        <div className="flex-1 relative">
                          <input 
                            type="number" 
                            min={1}
                            max={30}
                            value={resGuestsInput} 
                            onChange={(e) => setResGuestsInput(Number(e.target.value))} 
                            className="w-full p-2.5 text-center bg-white border border-[#E5E0D9] focus:border-[#C85A3F] focus:ring-2 focus:ring-[#C85A3F]/15 text-[#17202A] rounded-xl outline-none font-extrabold text-sm" 
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#7B8794] font-bold pointer-events-none">
                            Guests
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setResGuestsInput(Math.min(30, (resGuestsInput || 1) + 1))}
                          className="w-10 h-10 rounded-xl bg-white border border-[#E5E0D9] hover:bg-slate-50 text-[#17202A] font-extrabold flex items-center justify-center cursor-pointer shadow-2xs text-base active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. ASSIGN TABLE (Interactive Table Grid) */}
                {resActionType === 'AssignTable' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs uppercase font-extrabold text-[#17202A] flex items-center gap-1.5">
                          <LayoutGrid className="w-4 h-4 text-[#C85A3F]" />
                          <span>Choose Dining Table</span>
                        </label>
                        <p className="text-[11.5px] text-[#7B8794] mt-0.5">
                          Select an available table that comfortably accommodates this party of {selectedRes.guests} guests.
                        </p>
                      </div>
                      {resTableInput && (
                        <button
                          type="button"
                          onClick={() => setResTableInput('')}
                          className="text-[11px] font-bold text-[#C85A3F] hover:underline cursor-pointer"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>

                    {/* Table Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {/* Option: Unassigned */}
                      <button
                        type="button"
                        onClick={() => setResTableInput('')}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer",
                          !resTableInput 
                            ? "bg-[#FFF8F5] border-[#E85D3F] ring-2 ring-[#E85D3F]/20 shadow-xs" 
                            : "bg-white border-[#E5E0D9] hover:border-slate-300 hover:bg-[#FAFAF7]"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                            --
                          </div>
                          <div>
                            <h5 className="font-extrabold text-xs text-[#17202A]">Unassigned</h5>
                            <p className="text-[10px] text-[#7B8794]">Assign table later upon arrival</p>
                          </div>
                        </div>
                        {!resTableInput && (
                          <div className="w-5 h-5 rounded-full bg-[#E85D3F] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>

                      {/* Actual tables */}
                      {tables.map(t => {
                        const isSelected = resTableInput === t.id;
                        const isOccupied = t.status === 'Occupied';
                        const fitsParty = Number(t.capacity || 2) >= Number(selectedRes.guests || 2);
                        
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setResTableInput(t.id)}
                            className={cn(
                              "p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer relative",
                              isSelected
                                ? "bg-[#FFF8F5] border-[#E85D3F] ring-2 ring-[#E85D3F]/20 shadow-xs"
                                : "bg-white border-[#E5E0D9] hover:border-[#C85A3F]/50 hover:bg-[#FAF7F2]/40"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0",
                                isSelected
                                  ? "bg-[#E85D3F] text-white shadow-xs"
                                  : isOccupied 
                                    ? "bg-slate-100 text-slate-500" 
                                    : "bg-[#F3E8DF] text-[#C85A3F]"
                              )}>
                                T{t.number || t.tableNumber}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5 className="font-extrabold text-xs text-[#17202A]">Table {t.number || t.tableNumber}</h5>
                                  {fitsParty && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Fits
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-[#7B8794] mt-0.5">
                                  <span className="flex items-center gap-0.5 font-semibold text-slate-700">
                                    <Users className="w-3 h-3 text-slate-400" /> {t.capacity} seats
                                  </span>
                                  <span>•</span>
                                  <span>{t.floor || 'Ground Floor'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9.5px] font-extrabold border",
                                isOccupied
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                              )}>
                                {isOccupied ? 'Occupied' : 'Available'}
                              </span>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-[#E85D3F] text-white flex items-center justify-center shrink-0">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. ASSIGN WAITER (Interactive Waiter Cards Grid) */}
                {resActionType === 'AssignWaiter' && (
                  <div className="space-y-3">
                    <div className="p-3 bg-[#FCFAF7] border border-[#E5E0D9] rounded-2xl flex items-start gap-2.5 text-[11.5px] text-[#52606D]">
                      <UserCheck className="w-4 h-4 text-[#C85A3F] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        Select a dedicated front-of-house server to attend to this reservation. All diner service calls and bill requests will route to their device. (Kitchen and back-of-house staff are excluded).
                      </p>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {/* Option: Unassigned */}
                      <button
                        type="button"
                        onClick={() => setResWaiterInput('')}
                        className={cn(
                          "w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer",
                          !resWaiterInput
                            ? "bg-[#FFF8F5] border-[#E85D3F] ring-2 ring-[#E85D3F]/20 shadow-xs"
                            : "bg-white border-[#E5E0D9] hover:border-slate-300 hover:bg-[#FAFAF7]"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-extrabold text-sm">
                            <Users className="w-5 h-5 text-slate-400" />
                          </div>
                          <div>
                            <h5 className="font-extrabold text-xs text-[#17202A]">Unassigned / Service Pool</h5>
                            <p className="text-[11px] text-[#7B8794]">Any on-duty server can attend to this party</p>
                          </div>
                        </div>
                        {!resWaiterInput && (
                          <div className="w-5 h-5 rounded-full bg-[#E85D3F] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>

                      {/* Waiters */}
                      {waiterEmployees.length === 0 ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-1">
                          <p className="font-extrabold text-amber-900">No Waitstaff Found</p>
                          <p className="text-[11px] text-amber-700">All registered employees currently have other roles (e.g. kitchen/chef). You can add or assign the "waiter" role in Staff Management.</p>
                        </div>
                      ) : (
                        waiterEmployees.map(w => {
                          const isSelected = resWaiterInput === w.id;
                          const name = w.fullName || w.name || 'Waiter';
                          const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                          return (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => setResWaiterInput(w.id)}
                              className={cn(
                                "w-full p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer",
                                isSelected
                                  ? "bg-[#FFF8F5] border-[#E85D3F] ring-2 ring-[#E85D3F]/20 shadow-xs"
                                  : "bg-white border-[#E5E0D9] hover:border-[#C85A3F]/50 hover:bg-[#FAF7F2]/40"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm shrink-0",
                                  isSelected
                                    ? "bg-[#E85D3F] text-white shadow-xs"
                                    : "bg-[#F3E8DF] text-[#C85A3F]"
                                )}>
                                  {initials}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-extrabold text-xs sm:text-sm text-[#17202A]">{name}</h5>
                                    <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                      Front-of-House Waiter
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[10.5px] text-[#7B8794] mt-0.5">
                                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active On Duty
                                    </span>
                                    {w.phone && (
                                      <>
                                        <span>•</span>
                                        <span>{w.phone}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {isSelected && (
                                <div className="w-6 h-6 rounded-full bg-[#E85D3F] text-white flex items-center justify-center shrink-0">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* 5. SEAT PARTY (Interactive Seating & Table Selection) */}
                {resActionType === 'Seat' && (
                  <div className="space-y-3.5">
                    {/* Explanation Banner */}
                    <div className="p-3.5 bg-gradient-to-r from-amber-50 to-[#FFF8F2] border border-amber-200/90 rounded-2xl space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-800 font-extrabold text-xs">
                        <Utensils className="w-4 h-4 text-[#C85A3F]" />
                        <span>Seating Dining Party</span>
                      </div>
                      <p className="text-[11.5px] text-amber-900/80 leading-relaxed">
                        Guests have arrived. Confirming this action marks their reservation as <strong>Seated</strong>, updates the chosen table status to <strong>Occupied</strong>, and initializes their live dining order session.
                      </p>
                    </div>

                    {/* Table picker for seating */}
                    <div className="space-y-2">
                      <label className="text-xs uppercase font-extrabold text-[#17202A] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <LayoutGrid className="w-4 h-4 text-[#C85A3F]" />
                          <span>Select Table to Seat Guests (Required)</span>
                        </span>
                        {resTableInput && (
                          <span className="text-[11px] font-extrabold text-emerald-600 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Table Selected
                          </span>
                        )}
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
                        {tables.map(t => {
                          const isSelected = resTableInput === t.id;
                          const isOccupied = t.status === 'Occupied';
                          const fitsParty = Number(t.capacity || 2) >= Number(selectedRes.guests || 2);

                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setResTableInput(t.id)}
                              className={cn(
                                "p-3 rounded-2xl border text-left transition-all flex items-center justify-between cursor-pointer",
                                isSelected
                                  ? "bg-[#FFF8F5] border-[#E85D3F] ring-2 ring-[#E85D3F]/20 shadow-xs"
                                  : "bg-white border-[#E5E0D9] hover:border-[#C85A3F]/50 hover:bg-[#FAF7F2]/40"
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={cn(
                                  "w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0",
                                  isSelected
                                    ? "bg-[#E85D3F] text-white shadow-xs"
                                    : isOccupied 
                                      ? "bg-slate-100 text-slate-500" 
                                      : "bg-[#F3E8DF] text-[#C85A3F]"
                                )}>
                                  T{t.number || t.tableNumber}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h5 className="font-extrabold text-xs text-[#17202A]">Table {t.number || t.tableNumber}</h5>
                                    {fitsParty && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Fits
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-[#7B8794] mt-0.5">
                                    <span className="font-semibold text-slate-700">{t.capacity} seats</span>
                                    <span>•</span>
                                    <span>{t.floor || 'Ground'}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-extrabold border",
                                  isOccupied
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                )}>
                                  {isOccupied ? 'Occupied' : 'Available'}
                                </span>
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full bg-[#E85D3F] text-white flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer action buttons */}
                <div className="flex items-center gap-3 pt-4 border-t border-[#F0EBE4] mt-2">
                  <button
                    type="button"
                    className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#475569] font-extrabold text-xs transition-colors cursor-pointer"
                    onClick={() => { setSelectedRes(null); setResActionType(null); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-[#E85D3F] to-[#C84A38] hover:from-[#D74E32] hover:to-[#B63E2D] active:scale-[0.99] text-white font-extrabold text-xs transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleReservationActionSubmit}
                    disabled={resActionType === 'Seat' && !resTableInput}
                  >
                    {resActionType === 'Accept' ? 'Confirm Approval' :
                     resActionType === 'Reject' ? 'Confirm Decline' :
                     resActionType === 'Seat' ? 'Seat Party Now' :
                     resActionType === 'AssignTable' ? 'Confirm Table' :
                     resActionType === 'AssignWaiter' ? 'Confirm Waiter' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
          </Modal>

        </div>
      )}

      {view === 'annual' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/30 p-6 border border-slate-850 rounded-3xl">
            <div>
              <h1 className="text-2xl font-display font-extrabold text-textPearl">Annual Revenue Explorer</h1>
              <p className="text-xs text-mutedAsh font-semibold mt-1">Detailed performance tracking per fiscal period, monthly tax margins, and ticket distribution audits.</p>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs font-bold text-slate-400 uppercase">Fiscal Period:</label>
              <select
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="bg-slate-955 border border-slate-850 focus:border-primary rounded-xl p-2 text-xs font-semibold text-textPearl outline-none"
              >
                <option value="2026-27">FY 2026-27</option>
                <option value="2025-26">FY 2025-26</option>
                <option value="2024-25">FY 2024-25</option>
              </select>
            </div>
          </div>

          {/* Annual Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="p-4 border-slate-850 bg-slate-900/30">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Gross Revenue</span>
              <h3 className="text-lg font-display font-black text-textPearl mt-1">{formatPrice(selectedFYMetrics.gross)}</h3>
            </Card>
            <Card className="p-4 border-slate-850 bg-slate-900/30">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Net Revenue</span>
              <h3 className="text-lg font-display font-black text-emerald-500 mt-1">{formatPrice(selectedFYMetrics.net)}</h3>
            </Card>
            <Card className="p-4 border-slate-850 bg-slate-900/30">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">GST Collected</span>
              <h3 className="text-lg font-display font-black text-amber-500 mt-1">{formatPrice(selectedFYMetrics.gst)}</h3>
            </Card>
            <Card className="p-4 border-slate-850 bg-slate-900/30">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Orders</span>
              <h3 className="text-lg font-display font-black text-textPearl mt-1">{selectedFYMetrics.count}</h3>
            </Card>
            <Card className="p-4 border-slate-850 bg-slate-900/30">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Avg Order Value</span>
              <h3 className="text-lg font-display font-black text-textPearl mt-1">{formatPrice(selectedFYMetrics.aov)}</h3>
            </Card>
            <Card className="p-4 border-slate-850 bg-slate-900/30">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Avg Monthly Rev</span>
              <h3 className="text-lg font-display font-black text-textPearl mt-1">{formatPrice(selectedFYMetrics.avgMonthly)}</h3>
            </Card>
          </div>

          {/* Month Cards Grid */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Breakdown</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {monthsData.map((m, idx) => (
                <Card 
                  key={idx} 
                  onClick={() => {
                    setSelectedMonthIndex(idx);
                    setView('monthly');
                  }}
                  className="p-5 border-slate-850 bg-slate-900/40 relative overflow-hidden flex flex-col justify-between h-36 hover:border-primary/30 hover:bg-slate-900/60 cursor-pointer transition-all duration-300"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-textPearl">{m.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.trendPercent >= 0 ? 'bg-emerald-500/10 text-emerald-450' : 'bg-rose-500/10 text-rose-455'}`}>
                      {m.trendPercent >= 0 ? `↑ +${m.trendPercent}%` : `↓ ${m.trendPercent}%`}
                    </span>
                  </div>
                  <div className="my-2">
                    <span className="text-[10px] text-slate-500 font-semibold block">Net Revenue</span>
                    <h4 className="text-xl font-display font-extrabold text-emerald-500 mt-0.5">{formatPrice(m.net)}</h4>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-t border-slate-850/65 pt-2">
                    <span>{m.ordersCount} completed orders</span>
                    <span className="text-primary hover:underline">View details →</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'monthly' && (
        <div className="space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/30 p-6 border border-slate-850 rounded-3xl">
            <div>
              <h1 className="text-2xl font-display font-extrabold text-textPearl">Monthly Revenue Detail</h1>
              <p className="text-xs text-mutedAsh font-semibold mt-1">Detailed checkout events log, tax allocations, and daily revenue investigation for {selectedMonthData.label}.</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setView('annual')}
              className="text-xs font-bold py-2 px-3 border border-slate-800"
            >
              Back to Annual View
            </Button>
          </div>

          {/* MONTHLY SUMMARY (Monthly KPIs) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Monthly Summary — {selectedMonthData.label}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 border-slate-850 bg-slate-900/30">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Gross Revenue</span>
                <h3 className="text-lg font-display font-black text-textPearl mt-1">{formatPrice(selectedMonthData.gross)}</h3>
              </Card>
              <Card className="p-4 border-slate-850 bg-slate-900/30">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Net Revenue</span>
                <h3 className="text-lg font-display font-black text-emerald-500 mt-1">{formatPrice(selectedMonthData.net)}</h3>
              </Card>
              <Card className="p-4 border-slate-850 bg-slate-900/30">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">GST Collected</span>
                <h3 className="text-lg font-display font-black text-amber-500 mt-1">{formatPrice(selectedMonthData.gst)}</h3>
              </Card>
              <Card className="p-4 border-slate-850 bg-slate-900/30">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Successful Orders</span>
                <h3 className="text-lg font-display font-black text-textPearl mt-1">{selectedMonthData.ordersCount} sales</h3>
              </Card>
            </div>
          </div>

          {/* CALENDAR & DATE SELECTOR BAR */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/50 p-5 border border-slate-850 rounded-2xl relative">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Date-Based Revenue Investigation</span>
                <h3 className="text-sm font-bold text-textPearl">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
            </div>

            {/* Interactive Date Selector with Portal-Positioned Calendar Popover */}
            <div ref={calendarTriggerRef} className="relative">
              <Button
                variant="secondary"
                onClick={() => setIsCalendarOpen(prev => !prev)}
                aria-expanded={isCalendarOpen}
                aria-haspopup="dialog"
                aria-label="Select date for daily revenue"
                className="text-xs font-bold py-2.5 px-4 border border-slate-800 bg-slate-955 hover:border-primary/50 text-textPearl flex items-center gap-2.5 shadow-lg transition-colors cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-primary" />
                <span>{selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`} />
              </Button>

              {/* Portal-Rendered Calendar Popover (immune to parent overflow clipping) */}
              {isCalendarOpen && createPortal(
                <div className="fixed inset-0 z-[100] select-none">
                  {/* Dismiss Backdrop */}
                  <div 
                    className={`fixed inset-0 transition-opacity ${
                      popoverCoords.isMobile ? 'bg-black/60 backdrop-blur-xs' : 'bg-transparent'
                    }`}
                    onClick={() => setIsCalendarOpen(false)}
                    aria-hidden="true"
                  />

                  {/* Popover Card */}
                  <div
                    ref={calendarPopoverRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Calendar date selector"
                    style={
                      popoverCoords.isMobile
                        ? {
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 'calc(100vw - 32px)',
                            maxWidth: '340px',
                          }
                        : {
                            position: 'fixed',
                            top: `${popoverCoords.top}px`,
                            left: `${popoverCoords.left}px`,
                            width: '330px',
                          }
                    }
                    className="bg-[#0F172A] border border-[#334155] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-4 space-y-3 animate-in fade-in zoom-in-95 duration-150 z-10"
                  >
                    {(() => {
                      const currentYear = calendarViewMonth.year;
                      const currentMonth = calendarViewMonth.month;
                      const monthName = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' });
                      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                      const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
                      const firstDayOfWeek = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // Mon = 0
                      const today = new Date();

                      const calendarDays: { dayNum: number; isCurrentMonth: boolean; month: number; year: number }[] = [];

                      // Trailing days from previous month
                      for (let i = firstDayOfWeek - 1; i >= 0; i--) {
                        const pDay = daysInPrevMonth - i;
                        const pMonth = currentMonth === 0 ? 11 : currentMonth - 1;
                        const pYear = currentMonth === 0 ? currentYear - 1 : currentYear;
                        calendarDays.push({ dayNum: pDay, isCurrentMonth: false, month: pMonth, year: pYear });
                      }

                      // Days of current month
                      for (let d = 1; d <= daysInMonth; d++) {
                        calendarDays.push({ dayNum: d, isCurrentMonth: true, month: currentMonth, year: currentYear });
                      }

                      // Leading days of next month to complete the grid row
                      const remaining = 7 - (calendarDays.length % 7);
                      if (remaining > 0 && remaining < 7) {
                        const nMonth = currentMonth === 11 ? 0 : currentMonth + 1;
                        const nYear = currentMonth === 11 ? currentYear + 1 : currentYear;
                        for (let d = 1; d <= remaining; d++) {
                          calendarDays.push({ dayNum: d, isCurrentMonth: false, month: nMonth, year: nYear });
                        }
                      }

                      return (
                        <>
                          {/* Month Navigation */}
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                setCalendarViewMonth(prev => {
                                  const newM = prev.month === 0 ? 11 : prev.month - 1;
                                  const newY = prev.month === 0 ? prev.year - 1 : prev.year;
                                  return { year: newY, month: newM };
                                });
                              }}
                              aria-label="Previous month"
                              className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white transition-colors border border-slate-700/60 cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>

                            <span className="text-sm font-extrabold text-white tracking-wide">
                              {monthName} {currentYear}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                setCalendarViewMonth(prev => {
                                  const newM = prev.month === 11 ? 0 : prev.month + 1;
                                  const newY = prev.month === 11 ? prev.year + 1 : prev.year;
                                  return { year: newY, month: newM };
                                });
                              }}
                              aria-label="Next month"
                              className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white transition-colors border border-slate-700/60 cursor-pointer"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Weekdays Header */}
                          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-300 uppercase pb-1 border-b border-slate-800/80">
                            <span>Mon</span>
                            <span>Tue</span>
                            <span>Wed</span>
                            <span>Thu</span>
                            <span>Fri</span>
                            <span>Sat</span>
                            <span>Sun</span>
                          </div>

                          {/* Days Grid */}
                          <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((item, idx) => {
                              const isSelected = selectedDate.getDate() === item.dayNum &&
                                selectedDate.getMonth() === item.month &&
                                selectedDate.getFullYear() === item.year;

                              const isToday = today.getDate() === item.dayNum &&
                                today.getMonth() === item.month &&
                                today.getFullYear() === item.year;

                              const hasSales = hasOrdersDates.has(`${item.year}-${item.month}-${item.dayNum}`);

                              return (
                                <button
                                  key={`cal-${item.year}-${item.month}-${item.dayNum}-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDate(new Date(item.year, item.month, item.dayNum));
                                    if (!item.isCurrentMonth) {
                                      setCalendarViewMonth({ year: item.year, month: item.month });
                                    }
                                    setIsCalendarOpen(false);
                                  }}
                                  className={`w-full h-9 rounded-lg flex flex-col items-center justify-center text-xs transition-all relative cursor-pointer ${
                                    isSelected
                                      ? 'bg-gradient-to-br from-[#E05A3E] to-[#C9533B] text-white font-black shadow-md shadow-[#C9533B]/40 ring-2 ring-[#C9533B] z-10'
                                      : isToday
                                      ? 'border-2 border-[#C9533B]/80 text-[#FF8E72] font-bold hover:bg-slate-800'
                                      : !item.isCurrentMonth
                                      ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-850/50 font-normal'
                                      : 'text-slate-100 hover:bg-slate-800 hover:text-white font-semibold'
                                  }`}
                                >
                                  <span className="leading-none">{item.dayNum}</span>
                                  {hasSales && !isSelected && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-emerald-950 absolute bottom-1" />
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Footer Controls */}
                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-800 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                const now = new Date();
                                setSelectedDate(now);
                                setCalendarViewMonth({ year: now.getFullYear(), month: now.getMonth() });
                                setIsCalendarOpen(false);
                              }}
                              className="text-[#E05A3E] hover:text-[#FF8E72] hover:underline font-bold transition-colors cursor-pointer"
                            >
                              Jump to Today
                            </button>

                            <button
                              type="button"
                              onClick={() => setIsCalendarOpen(false)}
                              className="text-slate-300 hover:text-white px-2.5 py-1 rounded-lg hover:bg-slate-800 font-semibold transition-colors cursor-pointer"
                            >
                              Close
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* SELECTED DATE DAILY REVENUE SECTION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-extrabold uppercase tracking-wider text-textPearl flex items-center gap-2">
                <span>DAILY REVENUE — {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</span>
                {selectedDate.toDateString() === new Date().toDateString() && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Today</span>
                )}
              </h2>
            </div>

            {/* Daily KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="p-4 border-slate-850 bg-slate-900/40">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Gross Revenue</span>
                <h3 className="text-lg font-display font-black text-textPearl mt-1">{formatPrice(dailyRevenueData.gross)}</h3>
              </Card>

              <Card className="p-4 border-slate-850 bg-slate-900/40">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Net Revenue</span>
                <h3 className="text-lg font-display font-black text-emerald-500 mt-1">{formatPrice(dailyRevenueData.net)}</h3>
              </Card>

              <Card className="p-4 border-slate-850 bg-slate-900/40">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">GST Collected</span>
                <h3 className="text-lg font-display font-black text-amber-500 mt-1">{formatPrice(dailyRevenueData.gst)}</h3>
              </Card>

              <Card className="p-4 border-slate-850 bg-slate-900/40">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Successful Orders</span>
                <h3 className="text-lg font-display font-black text-textPearl mt-1">{dailyRevenueData.count} sales</h3>
              </Card>

              <Card className="p-4 border-slate-850 bg-slate-900/40">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Avg Order Value</span>
                <h3 className="text-lg font-display font-black text-textPearl mt-1">{formatPrice(dailyRevenueData.aov)}</h3>
              </Card>

              <Card className="p-4 border-slate-850 bg-slate-900/40">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Pending Payments</span>
                <h3 className={`text-lg font-display font-black mt-1 ${dailyRevenueData.pending > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                  {formatPrice(dailyRevenueData.pending)}
                </h3>
              </Card>
            </div>
          </div>

          {/* TWO-COLUMN DETAILS SPLIT: ORDER LEDGER (LEFT) + BREAKDOWNS (RIGHT) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left Column: Daily Order / Receipt Ledger Log */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-display font-bold text-sm text-textPearl">
                      Receipt Ledger Log — {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </h3>
                    <p className="text-[10px] text-slate-500">Individual customer orders and settled check records for the selected date.</p>
                  </div>

                  {/* Interactive Search & Filter Controls */}
                  <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Search customer, invoice..."
                      value={dailyReceiptSearch}
                      onChange={(e) => setDailyReceiptSearch(e.target.value)}
                      className="bg-slate-955 border border-slate-850 text-xs text-textPearl font-semibold rounded-xl px-3 py-1.5 outline-none focus:border-primary w-full sm:w-44"
                    />
                    <select
                      value={dailyPaymentFilter}
                      onChange={(e) => setDailyPaymentFilter(e.target.value)}
                      className="bg-slate-955 border border-slate-850 text-xs text-textPearl font-semibold rounded-xl px-2.5 py-1.5 outline-none"
                    >
                      <option value="all">All Modes</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI / Online</option>
                      <option value="card">Card</option>
                    </select>
                    <select
                      value={dailyStatusFilter}
                      onChange={(e) => setDailyStatusFilter(e.target.value)}
                      className="bg-slate-955 border border-slate-850 text-xs text-textPearl font-semibold rounded-xl px-2.5 py-1.5 outline-none"
                    >
                      <option value="all">All Status</option>
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                </div>

                {/* Filter daily order list based on search and filters */}
                {(() => {
                  const filteredDailyOrders = dailyRevenueData.ordersList.filter(item => {
                    const matchSearch = (item.customerName || '').toLowerCase().includes(dailyReceiptSearch.toLowerCase()) ||
                      (item.invoiceNumber || '').toLowerCase().includes(dailyReceiptSearch.toLowerCase()) ||
                      (item.orderId || '').toLowerCase().includes(dailyReceiptSearch.toLowerCase()) ||
                      (String(item.tableNumber) || '').toLowerCase().includes(dailyReceiptSearch.toLowerCase());

                    let matchPayment = true;
                    if (dailyPaymentFilter !== 'all') {
                      const mode = String(item.paymentMethod || '').toLowerCase();
                      const methods = item.paymentMethods;
                      if (dailyPaymentFilter === 'cash') matchPayment = !!methods?.cash || mode.includes('cash');
                      if (dailyPaymentFilter === 'upi') matchPayment = !!methods?.upi || mode.includes('upi') || mode.includes('razorpay');
                      if (dailyPaymentFilter === 'card') matchPayment = !!methods?.card || mode.includes('card');
                    }

                    let matchStatus = true;
                    if (dailyStatusFilter !== 'all') {
                      const pStatus = (item.paymentStatus || 'pending').toLowerCase();
                      matchStatus = pStatus === dailyStatusFilter;
                    }

                    return matchSearch && matchPayment && matchStatus;
                  });

                  if (dailyRevenueData.ordersList.length === 0) {
                    return (
                      <div className="p-12 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
                        <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                        <h3 className="text-sm font-bold text-textPearl uppercase tracking-wider mb-1">
                          No orders for {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </h3>
                        <p className="text-xs text-slate-500 font-semibold max-w-md mx-auto leading-relaxed">
                          No revenue has been recorded for this date. Select another date from the calendar to inspect sales activity.
                        </p>
                      </div>
                    );
                  }

                  if (filteredDailyOrders.length === 0) {
                    return (
                      <div className="p-8 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
                        <p className="text-xs text-slate-500 font-semibold">
                          No orders on this date match your search or filter criteria.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                            <th className="pb-2.5">Invoice / ID</th>
                            <th className="pb-2.5">Customer</th>
                            <th className="pb-2.5">Table</th>
                            <th className="pb-2.5">Order Time</th>
                            <th className="pb-2.5">Payment Method</th>
                            <th className="pb-2.5">Payment Status</th>
                            <th className="pb-2.5">Order Status</th>
                            <th className="pb-2.5 text-right">Subtotal</th>
                            <th className="pb-2.5 text-right">GST</th>
                            <th className="pb-2.5 text-right">Discount</th>
                            <th className="pb-2.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/40 text-slate-300 font-semibold">
                          {filteredDailyOrders.map((o) => (
                            <tr key={o.id || o.orderId} className="hover:bg-slate-900/20 transition-colors">
                              <td className="py-3 font-mono text-[11px]">
                                <span className="text-textPearl font-bold">#{o.invoiceNumber || o.orderId}</span>
                                {o.orderId && o.invoiceNumber !== o.orderId && (
                                  <span className="block text-[9px] text-slate-500 font-mono">{o.orderId}</span>
                                )}
                              </td>
                              <td className="py-3 text-textPearl font-semibold">{o.customerName}</td>
                              <td className="py-3 text-primary font-bold">
                                {o.tableNumber && o.tableNumber !== 'Walk-in' ? `Table #${o.tableNumber}` : 'Walk-in'}
                              </td>
                              <td className="py-3 text-slate-400 font-mono text-[11px]">
                                {o.orderTime ? new Date(o.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                              </td>
                              <td className="py-3">
                                <Badge variant="muted" className="scale-90 origin-left uppercase font-bold">
                                  {o.paymentMethod || (o.paymentMethods?.upi ? 'UPI' : (o.paymentMethods?.card ? 'CARD' : 'CASH'))}
                                </Badge>
                              </td>
                              <td className="py-3">
                                {o.paymentStatus === 'paid' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-450 border border-emerald-500/20">
                                    ✓ PAID
                                  </span>
                                ) : o.paymentStatus === 'refunded' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-455 border border-rose-500/20">
                                    ↺ REFUNDED
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-450 border border-amber-500/20">
                                    ⚠ PENDING
                                  </span>
                                )}
                              </td>
                              <td className="py-3">
                                <Badge variant="secondary" className="scale-90 origin-left uppercase text-[10px]">
                                  {o.orderStatus}
                                </Badge>
                              </td>
                              <td className="py-3 text-right text-slate-400 font-mono">{formatPrice(o.subtotal)}</td>
                              <td className="py-3 text-right text-amber-400 font-mono">{formatPrice(o.tax)}</td>
                              <td className="py-3 text-right text-slate-500 font-mono">
                                {o.discount > 0 ? formatPrice(o.discount) : '-'}
                              </td>
                              <td className="py-3 text-right text-emerald-400 font-mono font-bold">{formatPrice(o.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </Card>

              {/* Monthly Historical Settlements Timeline */}
              <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
                <div>
                  <h3 className="font-display font-bold text-sm text-textPearl">Monthly Settlements Timeline</h3>
                  <p className="text-[10px] text-slate-500">Recent completed check settlements across {selectedMonthData.label}.</p>
                </div>
                <div className="relative border-l-2 border-slate-800 ml-3 pl-5 space-y-4">
                  {selectedMonthData.orders
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 8)
                    .map((o, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[27px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-955" />
                        <div className="text-xs">
                          <span className="text-[9px] text-slate-500 font-bold block">{new Date(o.createdAt).toLocaleString()}</span>
                          <p className="text-slate-355 font-semibold mt-0.5">
                            Invoice <strong className="text-textPearl">#{o.invoiceNumber || (o.orderId && o.orderId.includes('-') ? o.orderId.split('-')[1] : o.orderId || o.id)}</strong> was completed for Table #{o.tableNumber || 'Walk-in'}. Total amount <strong className="text-emerald-500 font-mono">{formatPrice(o.total)}</strong> paid.
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </div>

            {/* Right Column: Payment Breakdown & Daily GST Breakdown */}
            <div className="space-y-6">

              {/* PAYMENT BREAKDOWN FOR SELECTED DATE */}
              <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-display font-bold text-sm text-textPearl">Payment Breakdown</h3>
                    <p className="text-[10px] text-slate-500">Collected and pending funds for {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    {dailyRevenueData.count} Settled
                  </span>
                </div>

                <div className="space-y-3.5 text-xs font-semibold text-slate-350">
                  {/* Cash */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-350">
                      <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Cash</span>
                      <span className="font-mono text-textPearl font-bold">
                        {formatPrice(dailyRevenueData.cash)} {dailyRevenueData.gross > 0 ? `(${Math.round(dailyRevenueData.cash / dailyRevenueData.gross * 100)}%)` : ''}
                      </span>
                    </div>
                    <div className="w-full bg-slate-955 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${dailyRevenueData.gross > 0 ? (dailyRevenueData.cash / dailyRevenueData.gross * 100) : 0}%` }} />
                    </div>
                  </div>

                  {/* UPI / Razorpay */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-350">
                      <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-sky-400" /> UPI / Razorpay</span>
                      <span className="font-mono text-textPearl font-bold">
                        {formatPrice(dailyRevenueData.upi)} {dailyRevenueData.gross > 0 ? `(${Math.round(dailyRevenueData.upi / dailyRevenueData.gross * 100)}%)` : ''}
                      </span>
                    </div>
                    <div className="w-full bg-slate-955 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-sky-500 h-full rounded-full transition-all duration-300" style={{ width: `${dailyRevenueData.gross > 0 ? (dailyRevenueData.upi / dailyRevenueData.gross * 100) : 0}%` }} />
                    </div>
                  </div>

                  {/* Card & Other */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-slate-350">
                      <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-amber-400" /> Card & Other Methods</span>
                      <span className="font-mono text-textPearl font-bold">
                        {formatPrice(dailyRevenueData.card + dailyRevenueData.wallet + dailyRevenueData.other)} {dailyRevenueData.gross > 0 ? `(${Math.round((dailyRevenueData.card + dailyRevenueData.wallet + dailyRevenueData.other) / dailyRevenueData.gross * 100)}%)` : ''}
                      </span>
                    </div>
                    <div className="w-full bg-slate-955 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full transition-all duration-300" style={{ width: `${dailyRevenueData.gross > 0 ? ((dailyRevenueData.card + dailyRevenueData.wallet + dailyRevenueData.other) / dailyRevenueData.gross * 100) : 0}%` }} />
                    </div>
                  </div>

                  {/* Pending Payments */}
                  <div className="space-y-1 pt-2 border-t border-slate-850/60">
                    <div className="flex justify-between text-slate-350">
                      <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-450" /> Outstanding / Pending</span>
                      <span className="font-mono text-amber-400 font-bold">{formatPrice(dailyRevenueData.pending)}</span>
                    </div>
                    <div className="w-full bg-slate-955 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500/80 h-full rounded-full transition-all duration-300" style={{ width: `${dailyRevenueData.pending > 0 ? 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </Card>

              {/* DAILY GST MARGINS BREAKDOWN */}
              <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
                <div>
                  <h3 className="font-display font-bold text-sm text-textPearl">Daily GST Margins Breakdown</h3>
                  <p className="text-[10px] text-slate-500">Split tax allocations for {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.</p>
                </div>

                <div className="space-y-3.5 text-xs font-semibold text-slate-400">
                  <div className="flex justify-between pb-2 border-b border-slate-850/60">
                    <span>CGST (Central Tax 2.5%)</span>
                    <span className="text-textPearl font-mono">{formatPrice(dailyRevenueData.gst / 2)}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-850/60">
                    <span>SGST (State Tax 2.5%)</span>
                    <span className="text-textPearl font-mono">{formatPrice(dailyRevenueData.gst / 2)}</span>
                  </div>
                  <div className="flex justify-between pb-2 border-b border-slate-850/60">
                    <span>IGST (Interstate Tax 0%)</span>
                    <span className="text-slate-600 font-mono">{formatPrice(0)}</span>
                  </div>
                  <div className="flex justify-between text-textPearl font-extrabold pt-1">
                    <span>Total Daily GST</span>
                    <span className="text-amber-500 font-mono">{formatPrice(dailyRevenueData.gst)}</span>
                  </div>
                </div>
              </Card>

              {/* MONTHLY SETTLED PAYMENTS MIX */}
              <Card className="p-5 border-slate-850 bg-slate-900/30 space-y-4">
                <div>
                  <h3 className="font-display font-bold text-sm text-textPearl">Monthly Payments Mix</h3>
                  <p className="text-[10px] text-slate-500">Cumulative revenue collected across {selectedMonthData.label}.</p>
                </div>

                {(() => {
                  let cash = 0;
                  let upi = 0;
                  let card = 0;
                  let wallet = 0;

                  selectedMonthData.orders.forEach(o => {
                    if (o.paymentMethods) {
                      cash += o.paymentMethods.cash || 0;
                      upi += o.paymentMethods.upi || 0;
                      card += o.paymentMethods.card || 0;
                      wallet += o.paymentMethods.wallet || 0;
                    } else {
                      const method = String(o.paymentMethod || 'cash').toLowerCase();
                      if (method.includes('upi')) upi += o.total || 0;
                      else if (method.includes('card')) card += o.total || 0;
                      else if (method.includes('wallet')) wallet += o.total || 0;
                      else cash += o.total || 0;
                    }
                  });

                  const totalSum = cash + upi + card + wallet || 1;

                  return (
                    <div className="space-y-3.5 text-xs font-semibold text-slate-450">
                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-350">
                          <span className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5 text-sky-400" /> UPI Transfer</span>
                          <span className="font-mono">{formatPrice(upi)} ({Math.round(upi / totalSum * 100)}%)</span>
                        </div>
                        <div className="w-full bg-slate-955 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-sky-500 h-full rounded-full" style={{ width: `${(upi / totalSum * 100)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-355">
                          <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-amber-400" /> Credit/Debit Card</span>
                          <span className="font-mono">{formatPrice(card)} ({Math.round(card / totalSum * 100)}%)</span>
                        </div>
                        <div className="w-full bg-slate-955 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(card / totalSum * 100)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-355">
                          <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Cash Settlements</span>
                          <span className="font-mono">{formatPrice(cash)} ({Math.round(cash / totalSum * 100)}%)</span>
                        </div>
                        <div className="w-full bg-slate-955 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-455 h-full rounded-full" style={{ width: `${(cash / totalSum * 100)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-355">
                          <span className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-purple-400" /> Digital Wallets</span>
                          <span className="font-mono">{formatPrice(wallet)} ({Math.round(wallet / totalSum * 100)}%)</span>
                        </div>
                        <div className="w-full bg-slate-955 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-purple-500 h-full rounded-full" style={{ width: `${(wallet / totalSum * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </Card>

            </div>
          </div>
        </div>
      )}

      {/* Invite Employee Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => { setIsInviteOpen(false); setInviteErrors({}); }}
        title={`Invite ${inviteRole === 'kitchen' ? 'Kitchen Staff' : 'Waiter'}`}
      >
        <form onSubmit={handleSendInvite} className="space-y-4 text-left">
          <Input
            label="Full Name"
            placeholder="John Doe"
            value={inviteForm.fullName}
            onChange={(e) => setInviteForm(prev => ({ ...prev, fullName: e.target.value }))}
            error={inviteErrors.fullName}
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="john@restaurant.com"
            value={inviteForm.email}
            onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
            error={inviteErrors.email}
          />
          <Input
            label="Phone Number"
            placeholder="+1 555-0199"
            value={inviteForm.phone}
            onChange={(e) => setInviteForm(prev => ({ ...prev, phone: e.target.value }))}
          />
          <Input
            label="Department"
            placeholder={inviteRole === 'kitchen' ? 'Kitchen / Back of House' : 'Service / Front of House'}
            value={inviteForm.department}
            onChange={(e) => setInviteForm(prev => ({ ...prev, department: e.target.value }))}
          />
          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setIsInviteOpen(false); setInviteErrors({}); }}
              className="border-slate-800 text-slate-400 hover:text-textPearl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmittingInvite}
              className="bg-primary text-slate-950 font-bold"
            >
              Send Invitation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Performance Overview Modal */}
      <Modal
        isOpen={isPerformanceOpen}
        onClose={() => setIsPerformanceOpen(false)}
        title={`${performanceType === 'kitchen' ? 'Kitchen' : 'Waiter'} Performance Metrics`}
      >
        <div className="space-y-4 text-left text-xs">
          {performanceType === 'waiter' ? (
            <div className="space-y-3">
              <p className="text-slate-450">Real-time floor service delivery metrics compiled from active diner orders:</p>
              <div className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Average Delivery Speed:</span>
                  <span className="text-textPearl font-extrabold">{staffMetrics.avgDeliveryMins} mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Fastest Server Today:</span>
                  <span className="text-emerald-450 font-extrabold">{staffMetrics.fastestWaiterName} ({staffMetrics.fastestWaiterTime})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Service Speed Target SLA:</span>
                  <span className="text-slate-405">Under 6.0 mins</span>
                </div>
              </div>
              <div className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl">
                <span className="text-slate-400 font-bold block mb-1">Floor Efficiency Feedback:</span>
                <span className="text-slate-500 leading-relaxed block font-semibold">
                  Waiter handoffs are within target range. Floor staff responses to table water/bill request alerts average 4.2 mins.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-450">Real-time cooking ticket throughput metrics compiled from KDS records:</p>
              <div className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Average Prep Time:</span>
                  <span className="text-textPearl font-extrabold">{staffMetrics.avgPrep} mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Kitchen Load Capacity:</span>
                  <span className="text-amber-500 font-extrabold">{kitchenMetrics.capacityPct}% utilization</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Cooking SLA Threshold:</span>
                  <span className="text-slate-405">12.0 mins</span>
                </div>
              </div>
              <div className="p-3 bg-slate-955/30 border border-slate-850 rounded-xl">
                <span className="text-slate-400 font-bold block mb-1">KDS Analytics:</span>
                <span className="text-slate-505 leading-relaxed block font-semibold">
                  Average cooking turnaround is stable at {staffMetrics.avgPrep} mins. Active order volume is healthy for present staffing levels.
                </span>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setIsPerformanceOpen(false)} className="bg-slate-800 text-textPearl hover:bg-slate-700 font-semibold">
              Close Overview
            </Button>
          </div>
        </div>
      </Modal>

      {/* Shift Overview Modal */}
      <Modal
        isOpen={isShiftsOpen}
        onClose={() => setIsShiftsOpen(false)}
        title="Active Shift Overview"
      >
        <div className="space-y-4 text-left text-xs">
          <p className="text-slate-450">Active roster shifts currently logged in for table floor duties:</p>
          
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {employees.filter(e => e.role === 'waiter' && e.status === 'active').map((emp, idx) => (
              <div key={emp.id || idx} className="p-3 bg-slate-950/20 border border-slate-850 rounded-xl flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="font-bold text-textPearl block">{emp.fullName}</span>
                  <span className="text-[10px] text-slate-500 block">{emp.email} · {emp.department}</span>
                </div>
                <Badge variant="success" className="text-[10px] font-bold">ON SHIFT</Badge>
              </div>
            ))}
            {employees.filter(e => e.role === 'waiter' && e.status === 'active').length === 0 && (
              <p className="text-slate-550 italic text-center py-4">No waiters currently marked active on shift.</p>
            )}
          </div>
          
          <div className="flex justify-end pt-2">
            <Button onClick={() => setIsShiftsOpen(false)} className="bg-slate-800 text-textPearl hover:bg-slate-700 font-semibold">
              Close Overview
            </Button>
          </div>
        </div>
      </Modal>

      {/* Business Health Breakdown & Explainability Modal */}
      <Modal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
        title="Business Health Architecture & Scoring Breakdown"
        className="w-full max-w-[760px]"
        closeAriaLabel="Close Business Health Details"
        footer={
          <Button
            type="button"
            onClick={() => setIsHealthModalOpen(false)}
            className="bg-[#12352D] text-white hover:bg-[#0E2822] font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Close Details
          </Button>
        }
      >
        <div className="space-y-4 text-left">
          {/* Top Summary Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#12352D] text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300/90 block">
                Business Health
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-black text-white font-display">
                  {businessHealthReport.overallScore !== null ? businessHealthReport.overallScore : '—'}
                  <span className="text-lg sm:text-xl font-medium text-emerald-200/70 ml-1">/ 100</span>
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {businessHealthReport.label}
                </span>
              </div>
              <div className="text-xs text-emerald-100/85 flex items-center gap-1.5 pt-0.5 font-medium">
                <Activity className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span><strong>{businessHealthReport.dataCoveragePercentage}%</strong> data coverage from live operations</span>
              </div>
            </div>

            <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-emerald-800/60 pt-3 sm:pt-0 sm:pl-5 space-y-1">
              <span className="text-[11px] font-semibold text-emerald-200/80 uppercase tracking-wider block">
                Historical Trend
              </span>
              <div className="text-xs font-bold text-white">
                {businessHealthReport.trendText || 'No prior trend available'}
              </div>
              <div className="text-[11px] text-emerald-200/70">
                {businessHealthReport.trendExplanation || 'Paced against recent operational activity'}
              </div>
            </div>
          </div>

          {/* Explanation Banner */}
          <div className="p-4 bg-[#EBF3FB] border border-[#C5DCF4] rounded-2xl flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#D6E7F8] flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-4 h-4 text-[#1D5D9B]" />
            </div>
            <p className="text-xs leading-relaxed text-[#173C6A] font-medium">
              Business Health scores restaurant operating vigor across 5 distinct operational pillars. 
              Dimensions with insufficient historical activity are marked <strong>Insufficient Data</strong> and excluded from penalizing your score, with remaining weights dynamically renormalized.
            </p>
          </div>

          {/* 5 Operational Dimensions */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold text-[#52606D] uppercase tracking-wider">
              Operational Dimensions ({businessHealthReport.dimensions.length})
            </h4>

            {businessHealthReport.dimensions.map((dim) => {
              const isAvailable = dim.status === 'available';
              return (
                <div 
                  key={dim.id} 
                  className="p-4 sm:p-5 bg-white border border-[#E5E0D9] rounded-2xl space-y-3.5 shadow-xs hover:border-[#16845B]/30 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-[#17202A] text-sm sm:text-base">{dim.title}</h4>
                      <div className="text-[11px] text-[#52606D] pt-0.5">
                        Baseline Weight: <strong>{dim.weight}%</strong>
                      </div>
                    </div>

                    {isAvailable && dim.score !== null ? (
                      <div className="flex items-center space-x-2.5">
                        <span className="text-base sm:text-lg font-black text-[#17202A] font-display">
                          {dim.score} <span className="text-xs font-normal text-[#7B8794]">/ 100</span>
                        </span>
                        <span className={cn(
                          "text-xs font-bold px-2.5 py-0.5 rounded-full border",
                          dim.score >= 80 ? "bg-[#E8F5EF] text-[#16845B] border-[#C6E7D8]" :
                          dim.score >= 60 ? "bg-[#FFF4DC] text-[#D98B00] border-[#FDE6B0]" :
                          "bg-[#FBEAE5] text-[#D64545] border-[#F5CBC4]"
                        )}>
                          {dim.score >= 80 ? 'Optimal' : dim.score >= 60 ? 'Fair' : 'Needs Attention'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-[#52606D] bg-[#F0EDE8] border border-[#E5E0D9] px-2.5 py-0.5 rounded-full w-fit">
                        Insufficient Data
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {isAvailable && dim.score !== null ? (
                    <div className="w-full bg-[#E5E0D9]/70 rounded-full h-2 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          dim.score >= 80 ? "bg-[#16845B]" :
                          dim.score >= 60 ? "bg-[#D98B00]" :
                          "bg-[#D64545]"
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, dim.score))}%` }}
                      />
                    </div>
                  ) : (
                    <div 
                      className="w-full bg-[#F0EDE8] rounded-full h-2 border border-dashed border-[#E5E0D9]" 
                      title="No progress bar for insufficient data" 
                    />
                  )}

                  {/* Explanation text */}
                  <p className="text-xs text-[#52606D] leading-relaxed">
                    {dim.explanation}
                  </p>

                  {/* Supporting Metrics Information Badges */}
                  {dim.metrics && Object.keys(dim.metrics).length > 0 && (
                    <div className="pt-2 border-t border-[#F0EDE8]">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#7B8794] block mb-1.5">
                        Supporting Metrics
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(dim.metrics).map(([k, v]) => {
                          const badge = formatMetricBadge(k, v);
                          if (!badge) return null;
                          return (
                            <div
                              key={k}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F8F6F2] border border-[#E5E0D9] text-xs shadow-2xs"
                            >
                              <span className="text-[#52606D] text-[11px] font-medium">{badge.label}:</span>
                              <span className="font-bold text-[#17202A]">{badge.display}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>



    </div>
  );
};

export default OwnerOverview;
