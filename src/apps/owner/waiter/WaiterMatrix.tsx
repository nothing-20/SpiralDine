import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  query,
  where,
  limit,
  arrayUnion,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { generateUniqueOrderId } from '../../../shared/utils/orderUtils';
import { IOrder, ITable, IServiceRequest, ITimelineEvent, IHandoverDoc, ISatisfactionRating } from '../../../types';
import { formatPrice } from '../../../utils/format';
import { getMenuItemPath } from '../../../firebase/collections';
import { logEvent } from '../../../services/eventEngine';
import { ActivityFeed } from '../../../components/ActivityFeed';
import CanonicalBillModal from '../../../shared/ui/billing/CanonicalBillModal';

// UI Kit
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Modal from '../../../components/ui/Modal/Modal';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

import toast from 'react-hot-toast';
import { 
  LayoutGrid, 
  Coffee, 
  DollarSign, 
  CheckCircle,
  Clock, 
  Award,
  ListTodo,
  TrendingUp,
  MapPin,
  Check,
  Play,
  Square,
  Pause,
  ArrowRightLeft,
  Users,
  AlertOctagon,
  UserPlus,
  Activity,
  Sparkles,
  ChefHat,
  MessageSquare,
  Trash2,
  ShieldAlert
} from 'lucide-react';

type TWaiterTab = 'command_center' | 'floor_map' | 'cleaning' | 'stats' | 'live_feed' | 'manager_console';

interface IMenuItem {
  id: string;
  name: string;
  price: number; // in cents
  category: string;
}

interface IWaiterShift {
  isActive: boolean;
  status: 'active' | 'break';
  startTime: string | null;
  endTime: string | null;
  breakStart: string | null;
  breakDurationMs: number;
  stats: {
    ordersDelivered: number;
    tablesServed: number;
    requestsResolved: number;
    billsGenerated: number;
    cleaningCompleted: number;
  };
}

type TTaskType = 
  | 'Deliver Food'
  | 'Kitchen Ready'
  | 'Customer Request'
  | 'Bill Request'
  | 'Cleaning'
  | 'Birthday Service'
  | 'Baby Chair'
  | 'Wheelchair Assistance'
  | 'Water'
  | 'Condiments'
  | 'Special Assistance'
  | 'Manager Task'
  | 'Complaint Review'
  | 'Deliver Order' 
  | 'Generate Bill' 
  | 'Collect Payment' 
  | 'Clean Table'
  | 'Refill Water'
  | 'Other Assistance';

interface IWaiterTask {
  id: string;
  type: TTaskType;
  tableNumber: string;
  section: string;
  description: string;
  createdAt: string; // ISO string
  status: 'Pending' | 'Accepted';
  priority: 'critical' | 'high' | 'medium' | 'low';
  targetId: string; // original document ID
  notes?: string;
  source: 'order' | 'request' | 'table' | 'managerReview';
}

const formatDuration = (ms: number): string => {
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

export const WaiterMatrix: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrOwner = user?.role === 'owner' || user?.role === 'manager' || user?.role === 'admin';
  
  const [tables, setTables] = useState<ITable[]>([]);
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [legacyRequests, setLegacyRequests] = useState<IServiceRequest[]>([]);
  const [waiterRequests, setWaiterRequests] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<IMenuItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [incomingHandovers, setIncomingHandovers] = useState<IHandoverDoc[]>([]);
  const [managerReviews, setManagerReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TWaiterTab>('command_center');
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [isUpdatingBill, setIsUpdatingBill] = useState(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<'Excellent' | 'Good' | 'Neutral' | 'Needs Attention' | 'Complaint'>('Excellent');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isRepeatCustomer, setIsRepeatCustomer] = useState(false);
  
  const [serviceSpeed, setServiceSpeed] = useState<number>(5);
  const [foodQuality, setFoodQuality] = useState<number>(5);
  const [cleanliness, setCleanliness] = useState<number>(5);
  const [staffBehavior, setStaffBehavior] = useState<number>(5);
  const [waitingTime, setWaitingTime] = useState<number>(5);
  const [ambience, setAmbience] = useState<number>(5);
  const [customerType, setCustomerType] = useState<string>('Couple');
  const [visitOccasion, setVisitOccasion] = useState<string>('Casual');

  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverRecipientId, setHandoverRecipientId] = useState('');
  const [handoverReason, setHandoverReason] = useState('End of shift handover');
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);

  const [selectedTable, setSelectedTable] = useState<ITable | null>(null);
  const [guestsCount, setGuestsCount] = useState<number>(2);
  const [tableNotesInput, setTableNotesInput] = useState<string>('');
  const [tableSectionInput, setTableSectionInput] = useState<string>('Main Room');

  const [orderTable, setOrderTable] = useState<ITable | null>(null);
  const [cart, setCart] = useState<Record<string, { item: IMenuItem; count: number }>>({});
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  const [bulkSection, setBulkSection] = useState('Main Room');
  const [bulkSectionWaiterId, setBulkSectionWaiterId] = useState('');
  const [autoAssignStrategy, setAutoAssignStrategy] = useState<'round-robin' | 'least-loaded'>('round-robin');

  const [tick, setTick] = useState(0);
  const notifiedEventsRef = React.useRef<Set<string>>(new Set());
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, 'critical' | 'high' | 'medium' | 'low'>>({});
  const [queueFilter, setQueueFilter] = useState<'all' | 'delivery' | 'request' | 'bill' | 'cleaning'>('all');
  const [actionFilter, setActionFilter] = useState<'All' | 'Kitchen' | 'Customers' | 'Payments' | 'Cleaning' | 'Manager'>('All');

  const [shift, setShift] = useState<IWaiterShift>(() => {
    const saved = localStorage.getItem(`shift_${user?.uid}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved shift state:', e);
      }
    }
    return {
      isActive: false,
      status: 'active',
      startTime: null,
      endTime: null,
      breakStart: null,
      breakDurationMs: 0,
      stats: {
        ordersDelivered: 0,
        tablesServed: 0,
        requestsResolved: 0,
        billsGenerated: 0,
        cleaningCompleted: 0
      }
    };
  });

  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(`shift_${user.uid}`, JSON.stringify(shift));
    }
  }, [shift, user?.uid]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user?.tenantId) return;

    setIsLoading(true);

    const tablesRef = collection(db, 'restaurants', user.tenantId, 'tables');
    const unsubTables = onSnapshot(tablesRef, (snap) => {
      const list: ITable[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as ITable);
      });
      list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
      setTables(list);
    });

    const ordersRef = collection(db, 'restaurants', user.tenantId, 'orders');
    const qOrders = query(ordersRef, limit(30));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const list: IOrder[] = [];
      snap.forEach(docSnap => {
        list.push({ ...docSnap.data() } as IOrder);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setOrders(list);
      setIsLoading(false);
    }, (err) => {
      console.error(err);
      setIsLoading(false);
    });

    const reqRef = collection(db, 'restaurants', user.tenantId, 'requests');
    const qReq = query(reqRef, limit(20));
    const unsubReq = onSnapshot(qReq, (snap) => {
      const list: IServiceRequest[] = [];
      snap.forEach(docSnap => {
        list.push({ ...docSnap.data() } as IServiceRequest);
      });
      setLegacyRequests(list);
    });

    const waiterReqRef = collection(db, 'restaurants', user.tenantId, 'waiterRequests');
    const qWaiterReq = query(waiterReqRef, limit(20));
    const unsubWaiterReq = onSnapshot(qWaiterReq, (snap) => {
      const list: any[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status !== 'Completed') {
          list.push({ id: docSnap.id, ...data });
        }
      });
      setWaiterRequests(list);
    });

    const menuPath = getMenuItemPath(user.tenantId);
    const menuRef = collection(db, menuPath);
    const qMenu = query(menuRef, limit(50));
    const unsubMenu = onSnapshot(qMenu, (snap) => {
      const list: IMenuItem[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name,
          price: data.price,
          category: data.category || 'Other'
        });
      });
      setMenuItems(list);
    });

    const employeesRef = collection(db, 'employees');
    const qEmp = query(
      employeesRef,
      where('tenantId', '==', user.tenantId),
      where('status', '==', 'active')
    );
    const unsubEmployees = onSnapshot(qEmp, (snap) => {
      const list: any[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setEmployees(list);
    });

    const handoversRef = collection(db, 'restaurants', user.tenantId, 'handovers');
    const qHandover = query(
      handoversRef,
      where('handoverTo', '==', user.uid),
      where('status', '==', 'Pending')
    );
    const unsubHandovers = onSnapshot(qHandover, (snap) => {
      const list: IHandoverDoc[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as IHandoverDoc);
      });
      setIncomingHandovers(list);
    });

    const mReviewsRef = collection(db, 'restaurants', user.tenantId, 'managerReviews');
    const unsubMReviews = onSnapshot(mReviewsRef, (snap) => {
      const list: any[] = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setManagerReviews(list);
    });

    return () => {
      unsubTables();
      unsubOrders();
      unsubReq();
      unsubWaiterReq();
      unsubMenu();
      unsubEmployees();
      unsubHandovers();
      unsubMReviews();
    };
  }, [user?.tenantId, user?.uid]);

  useEffect(() => {
    if (isLoading || !user?.tenantId || !shift.isActive) return;

    orders.forEach(o => {
      if (o.status === 'READY' && o.waiterId === user.uid) {
        const cacheKey = `cc-ready-${o.orderId}`;
        if (!notifiedEventsRef.current.has(cacheKey)) {
          notifiedEventsRef.current.add(cacheKey);
          toast.success(`🍳 Table ${o.tableNumber} is ready for pick-up!`, { duration: 4000 });
        }

        const elapsedMins = (Date.now() - new Date(o.updatedAt || o.createdAt).getTime()) / 60000;
        if (elapsedMins > 5) {
          const delayKey = `cc-delayed-${o.orderId}`;
          if (!notifiedEventsRef.current.has(delayKey)) {
            notifiedEventsRef.current.add(delayKey);
            toast(`🚨 Table ${o.tableNumber} order delivery is delayed! (${Math.floor(elapsedMins)}m wait)`, {
              icon: '⚠️',
              duration: 5000
            });
          }
        }
      }
    });

    waiterRequests.forEach(req => {
      if (req.status === 'Pending') {
        const tObj = tables.find(tb => tb.number === req.tableNumber);
        if (tObj?.assignedWaiterId === user.uid) {
          const cacheKey = `cc-req-${req.id}`;
          if (!notifiedEventsRef.current.has(cacheKey)) {
            notifiedEventsRef.current.add(cacheKey);
            toast(`🙋‍♂️ Table ${req.tableNumber} requested ${req.requestType}`, {
              icon: '🔔',
              duration: 4000
            });
          }
        }
      }
    });

    tables.forEach(t => {
      if (t.status === 'bill_requested' && t.assignedWaiterId === user.uid) {
        const cacheKey = `cc-bill-${t.id}`;
        if (!notifiedEventsRef.current.has(cacheKey)) {
          notifiedEventsRef.current.add(cacheKey);
          toast.success(`💰 Table ${t.number} has requested their invoice!`, { duration: 5000 });
        }
      }
    });
  }, [orders, waiterRequests, tables, isLoading, user?.tenantId, shift.isActive]);

  const handleStartShift = () => {
    const now = new Date().toISOString();
    setShift({
      isActive: true,
      status: 'active',
      startTime: now,
      endTime: null,
      breakStart: null,
      breakDurationMs: 0,
      stats: {
        ordersDelivered: 0,
        tablesServed: 0,
        requestsResolved: 0,
        billsGenerated: 0,
        cleaningCompleted: 0
      }
    });
    toast.success('Your shift has started! Ready for dining operations.');

    logEvent(user?.tenantId || '', {
      eventType: 'Shift Started',
      eventCategory: 'Waiter',
      performedBy: user?.displayName || user?.email || 'Waiter',
      performedByRole: user?.role || 'waiter',
      title: 'Shift Started',
      description: `Waiter ${user?.displayName || user?.email} clocked in for today's floor shifts.`
    });
  };

  const handleEndShiftClick = () => {
    const pendingTables = tables.filter(t => t.assignedWaiterId === user?.uid && t.status !== 'empty');
    const pendingDeliveries = orders.filter(o => o.waiterId === user?.uid && o.status === 'READY');
    const myDinerRequests = waiterRequests.filter(r => {
      const tableObj = tables.find(t => t.number === r.tableNumber);
      const isInactive = ['completed', 'cancelled', 'rejected'].includes((r.status || '').toLowerCase());
      return tableObj?.assignedWaiterId === user?.uid && !isInactive;
    });

    const hasPendingWork = pendingTables.length > 0 || pendingDeliveries.length > 0 || myDinerRequests.length > 0;

    if (hasPendingWork) {
      setHandoverRecipientId('');
      setHandoverReason('Shift handover due to clock-out');
      setShowHandoverModal(true);
    } else {
      handleEndShift();
    }
  };

  const handleEndShift = () => {
    const now = new Date().toISOString();
    const finalShift = { ...shift, isActive: false, endTime: now };
    setShift(finalShift);
    
    const workingTimeStr = formatDuration(getShiftWorkingTime(finalShift));
    toast((t) => (
      <div className="text-left space-y-1 text-xs">
        <strong className="text-sm text-textPearl">Shift Summary Completed</strong>
        <p>🕒 Active Hours: {workingTimeStr}</p>
        <p>🍽️ Deliveries Made: {finalShift.stats.ordersDelivered}</p>
        <p>🔔 Alerts Resolved: {finalShift.stats.requestsResolved}</p>
        <p>🧹 Tables Reset: {finalShift.stats.cleaningCompleted}</p>
      </div>
    ), { duration: 10000 });

    logEvent(user?.tenantId || '', {
      eventType: 'Shift Ended',
      eventCategory: 'Waiter',
      performedBy: user?.displayName || user?.email || 'Waiter',
      performedByRole: user?.role || 'waiter',
      title: 'Shift Completed',
      description: `Waiter ${user?.displayName || user?.email} ended shift. Served ${finalShift.stats.tablesServed} tables.`,
      metadata: { workingTime: workingTimeStr }
    });
  };

  const handleStartBreak = () => {
    setShift(prev => ({
      ...prev,
      status: 'break',
      breakStart: new Date().toISOString()
    }));
    toast('You are now on a Break.', { icon: '☕' });

    logEvent(user?.tenantId || '', {
      eventType: 'Break Started',
      eventCategory: 'Waiter',
      performedBy: user?.displayName || user?.email || 'Waiter',
      performedByRole: user?.role || 'waiter',
      title: 'Waiter Break Started',
      description: `Waiter ${user?.displayName || user?.email} started break.`
    });
  };

  const handleEndBreak = () => {
    if (!shift.breakStart) return;
    const breakMs = Date.now() - new Date(shift.breakStart).getTime();
    setShift(prev => ({
      ...prev,
      status: 'active',
      breakStart: null,
      breakDurationMs: prev.breakDurationMs + breakMs
    }));
    toast.success('Break finished. Back to active command duty!');

    logEvent(user?.tenantId || '', {
      eventType: 'Break Ended',
      eventCategory: 'Waiter',
      performedBy: user?.displayName || user?.email || 'Waiter',
      performedByRole: user?.role || 'waiter',
      title: 'Waiter Break Completed',
      description: `Waiter ${user?.displayName || user?.email} returned from break.`
    });
  };

  const getShiftWorkingTime = (s: IWaiterShift) => {
    if (!s.startTime) return 0;
    const end = s.endTime ? new Date(s.endTime).getTime() : Date.now();
    const duration = end - new Date(s.startTime).getTime();
    
    let activeBreakTime = 0;
    if (s.status === 'break' && s.breakStart) {
      activeBreakTime = Date.now() - new Date(s.breakStart).getTime();
    }
    
    return Math.max(0, duration - (s.breakDurationMs + activeBreakTime));
  };

  const handleInitiateHandover = async () => {
    if (!user?.tenantId || !handoverRecipientId) {
      toast.error('Please select a receiving waiter.');
      return;
    }
    setIsSubmittingHandover(true);
    try {
      const recipient = employees.find(e => e.id === handoverRecipientId);
      const recipientName = recipient?.displayName || recipient?.email || 'Waiter';

      const myTables = tables.filter(t => t.assignedWaiterId === user?.uid && t.status !== 'empty');
      const myDeliveries = orders.filter(o => o.waiterId === user?.uid && o.status === 'READY');
      const myRequests = waiterRequests.filter(r => {
        const tableObj = tables.find(t => t.number === r.tableNumber);
        const isInactive = ['completed', 'cancelled', 'rejected'].includes((r.status || '').toLowerCase());
        return tableObj?.assignedWaiterId === user?.uid && !isInactive;
      });

      const tableIds = myTables.map(t => t.id);
      const orderIds = myDeliveries.map(o => o.orderId);
      const requestIds = myRequests.map(r => r.id);

      const handoverData: IHandoverDoc = {
        handoverBy: user.uid,
        handoverByName: user.displayName || user.email || 'Waiter',
        handoverTo: handoverRecipientId,
        handoverToName: recipientName,
        handoverTime: new Date().toISOString(),
        handoverReason,
        status: 'Pending',
        tablesCount: tableIds.length,
        ordersCount: orderIds.length,
        requestsCount: requestIds.length,
        tableIds,
        orderIds,
        requestIds
      };

      const handoversCol = collection(db, 'restaurants', user.tenantId, 'handovers');
      const handoverDocRef = await addDoc(handoversCol, handoverData);
      
      toast.success(`Handover request submitted to ${recipientName}.`);
      setShowHandoverModal(false);

      logEvent(user.tenantId, {
        eventType: 'Shift Handover Initiated',
        eventCategory: 'Management',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        title: 'Handover Initiated',
        description: `Handover of ${tableIds.length} tables pending from ${user.displayName} to ${recipientName}.`,
        taskId: handoverDocRef.id
      });

      handleEndShift();
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit handover.');
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  const handleAcceptHandover = async (handover: IHandoverDoc) => {
    if (!user?.tenantId || !handover.id) return;
    try {
      const batch = writeBatch(db);

      handover.tableIds.forEach(tId => {
        const tableDocRef = doc(db, 'restaurants', user.tenantId, 'tables', tId);
        batch.update(tableDocRef, {
          assignedWaiterId: user.uid,
          assignedWaiterName: user.displayName || user.email || 'Waiter'
        });
      });

      handover.orderIds.forEach(oId => {
        const orderDocRef = doc(db, 'restaurants', user.tenantId, 'orders', oId);
        batch.update(orderDocRef, {
          waiterId: user.uid,
          waiterName: user.displayName || user.email || 'Waiter'
        });
      });

      handover.requestIds.forEach(rId => {
        const requestDocRef = doc(db, 'restaurants', user.tenantId, 'waiterRequests', rId);
        batch.update(requestDocRef, {
          acceptedBy: user.displayName || user.email || 'Waiter'
        });
      });

      const handoverDocRef = doc(db, 'restaurants', user.tenantId, 'handovers', handover.id);
      batch.update(handoverDocRef, { status: 'Accepted' });

      await batch.commit();
      toast.success(`Shift handover accepted! ${handover.tablesCount} tables transferred to you.`);

      logEvent(user.tenantId, {
        eventType: 'Shift Handover Accepted',
        eventCategory: 'Management',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        title: 'Handover Accepted',
        description: `Shift handover from ${handover.handoverByName} accepted by ${user.displayName || user.email}.`,
        taskId: handover.id
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to accept shift handover.');
    }
  };

  const handleRejectHandover = async (handover: IHandoverDoc) => {
    if (!user?.tenantId || !handover.id) return;
    try {
      const handoverDocRef = doc(db, 'restaurants', user.tenantId, 'handovers', handover.id);
      await updateDoc(handoverDocRef, { status: 'Rejected' });
      toast.success('Shift handover rejected.');

      logEvent(user.tenantId, {
        eventType: 'Shift Handover Rejected',
        eventCategory: 'Management',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        title: 'Handover Rejected',
        description: `Shift handover from ${handover.handoverByName} rejected by ${user.displayName || user.email}.`,
        taskId: handover.id
      });
    } catch (e) {
      console.error(e);
    }
  };

  const derivedTasks = useMemo((): IWaiterTask[] => {
    const list: IWaiterTask[] = [];

    orders.forEach(o => {
      if (o.status === 'READY' && o.waiterId === user?.uid) {
        const tableObj = tables.find(t => t.number === o.tableNumber);
        const section = tableObj?.section || 'Main Room';
        const notes = tableObj?.tableNotes || '';
        list.push({
          id: `deliver-${o.orderId}`,
          type: 'Kitchen Ready',
          tableNumber: o.tableNumber,
          section,
          description: `Deliver food: ${o.items.map(i => `${i.count}x ${i.name}`).join(', ')}`,
          createdAt: o.updatedAt || o.createdAt,
          status: o.waiterId ? 'Accepted' : 'Pending',
          priority: 'medium',
          targetId: o.orderId,
          notes,
          source: 'order'
        });
      }
    });

    waiterRequests.forEach(req => {
      const tableObj = tables.find(t => t.number === req.tableNumber);
      if (tableObj?.assignedWaiterId === user?.uid) {
        const section = tableObj?.section || 'Main Room';
        const notes = tableObj?.tableNotes || '';

        let taskType: TTaskType = 'Customer Request';
        if (req.requestType === 'Water' || req.requestType === 'Need Water') taskType = 'Water';
        else if (req.requestType === 'Baby Chair') taskType = 'Baby Chair';
        else if (req.requestType === 'Wheelchair') taskType = 'Wheelchair Assistance';
        else if (req.requestType === 'Condiments') taskType = 'Condiments';
        else if (req.requestType === 'Birthday') taskType = 'Birthday Service';
        else if (req.requestType === 'Special' || req.requestType === 'Special Assistance') taskType = 'Special Assistance';

        list.push({
          id: `req-${req.id}`,
          type: taskType,
          tableNumber: req.tableNumber,
          section,
          description: `Diner requests assistance: ${req.requestType}`,
          createdAt: req.createdAt,
          status: req.status === 'Accepted' ? 'Accepted' : 'Pending',
          priority: 'medium',
          targetId: req.id,
          notes,
          source: 'request'
        });
      }
    });

    legacyRequests.forEach(req => {
      const tableObj = tables.find(t => t.number === req.tableNumber);
      if (tableObj?.assignedWaiterId === user?.uid) {
        const section = tableObj?.section || 'Main Room';
        const notes = tableObj?.tableNotes || '';

        list.push({
          id: `legacy-${req.id}`,
          type: 'Customer Request',
          tableNumber: req.tableNumber,
          section,
          description: `Legacy Alert: ${req.type}`,
          createdAt: req.createdAt,
          status: 'Pending',
          priority: 'medium',
          targetId: req.id,
          notes,
          source: 'request'
        });
      }
    });

    tables.forEach(t => {
      if (t.status === 'bill_requested' && t.assignedWaiterId === user?.uid) {
        const activeOrder = orders.find(o => o.orderId === t.activeOrderId);
        list.push({
          id: `bill-${t.id}`,
          type: 'Bill Request',
          tableNumber: t.number,
          section: t.section || 'Main Room',
          description: `Generate checkout invoice. Current total: ${activeOrder ? formatPrice(activeOrder.total) : '—'}`,
          createdAt: new Date().toISOString(),
          status: 'Pending',
          priority: 'high',
          targetId: t.id,
          notes: t.tableNotes || '',
          source: 'table'
        });
      }
    });

    tables.forEach(t => {
      if (t.status === 'cleaning' && t.assignedWaiterId === user?.uid) {
        list.push({
          id: `clean-${t.id}`,
          type: 'Cleaning',
          tableNumber: t.number,
          section: t.section || 'Main Room',
          description: 'Clear and sanitize table for next guest parties.',
          createdAt: (t as any).cleaningStartedAt || new Date().toISOString(),
          status: 'Pending',
          priority: 'medium',
          targetId: t.id,
          notes: t.tableNotes || '',
          source: 'table'
        });
      }
    });

    managerReviews.forEach(rev => {
      if (rev.resolutionStatus !== 'Resolved') {
        const isComplaint = rev.rating === 'Complaint' || rev.rating === 'Needs Attention';
        list.push({
          id: `mrev-${rev.id}`,
          type: rev.rating === 'Complaint' ? 'Complaint Review' : 'Manager Task',
          tableNumber: rev.tableNumber || '—',
          section: 'Manager',
          description: `Review: ${rev.notes || rev.rating || 'Needs Attention'}`,
          createdAt: rev.submittedAt || new Date().toISOString(),
          status: rev.resolutionStatus === 'In Progress' ? 'Accepted' : 'Pending',
          priority: isComplaint ? 'critical' : 'high',
          targetId: rev.id,
          notes: `Server: ${rev.submittedByName || 'Server'}`,
          source: 'managerReview'
        });
      }
    });

    const tasksWithPriorities = list.map(task => {
      if (priorityOverrides[task.id]) {
        return { ...task, priority: priorityOverrides[task.id] };
      }

      const isVip = task.notes?.toLowerCase().includes('vip') || task.tableNumber === 'VIP';
      const elapsedMinutes = (Date.now() - new Date(task.createdAt).getTime()) / 60000;

      let priority: 'critical' | 'high' | 'medium' | 'low' = 'medium';

      if (task.type === 'Deliver Food' || task.type === 'Kitchen Ready' || task.type === 'Deliver Order') {
        if (isVip || elapsedMinutes > 10) priority = 'critical';
        else if (elapsedMinutes > 5) priority = 'high';
        else if (elapsedMinutes > 2) priority = 'medium';
        else priority = 'low';
      } else if (task.type === 'Generate Bill' || task.type === 'Bill Request') {
        if (elapsedMinutes > 5) priority = 'critical';
        else priority = 'high';
      } else if (task.type === 'Clean Table' || task.type === 'Cleaning') {
        if (elapsedMinutes > 8) priority = 'high';
        else priority = 'medium';
      } else if (task.type === 'Complaint Review') {
        priority = 'critical';
      } else if (task.type === 'Manager Task') {
        priority = 'high';
      } else {
        if (isVip || elapsedMinutes > 8) priority = 'critical';
        else if (elapsedMinutes > 4) priority = 'high';
        else priority = 'medium';
      }

      return { ...task, priority };
    });

    return tasksWithPriorities;
  }, [orders, tables, waiterRequests, legacyRequests, managerReviews, priorityOverrides, user?.uid, tick]);

  const optimizedTasks = useMemo(() => {
    const list = [...derivedTasks];

    const priorityWeights = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    };

    list.sort((a, b) => {
      // 1. Priority weights (critical=0, high=1, medium=2, low=3)
      const aW = priorityWeights[a.priority] !== undefined ? priorityWeights[a.priority] : 2;
      const bW = priorityWeights[b.priority] !== undefined ? priorityWeights[b.priority] : 2;
      if (aW !== bW) return aW - bW;

      // 2. VIP requests above normal requests
      const isVipA = a.notes?.toLowerCase().includes('vip') || a.tableNumber === 'VIP' ? 1 : 0;
      const isVipB = b.notes?.toLowerCase().includes('vip') || b.tableNumber === 'VIP' ? 1 : 0;
      if (isVipB !== isVipA) return isVipB - isVipA;

      // 3. Kitchen ready above informational alerts
      const isKitchenA = a.type === 'Kitchen Ready' ? 1 : 0;
      const isKitchenB = b.type === 'Kitchen Ready' ? 1 : 0;
      if (isKitchenB !== isKitchenA) return isKitchenB - isKitchenA;

      // 4. Older pending events first
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return list;
  }, [derivedTasks]);

  const nextBestAction = useMemo(() => {
    if (optimizedTasks.length > 0) return optimizedTasks[0];
    return null;
  }, [optimizedTasks]);

  const performanceStats = useMemo(() => {
    const deliveredOrders = orders.filter(o => o.status === 'DELIVERED' && o.waiterId === user?.uid);
    let totalDeliverySecs = 0;
    let countDelivery = 0;

    deliveredOrders.forEach(o => {
      if (o.deliveredAt && o.createdAt) {
        const readyTimeStr = o.updatedAt || o.createdAt;
        const duration = Math.max(0, (new Date(o.deliveredAt).getTime() - new Date(readyTimeStr).getTime()) / 1000);
        totalDeliverySecs += duration;
        countDelivery++;
      }
    });

    const avgDeliveryMinutes = countDelivery > 0 
      ? Math.round((totalDeliverySecs / countDelivery) / 60) 
      : 0;

    let totalBillSecs = 0;
    let countBills = 0;
    const completedPaidOrders = orders.filter(o => o.status === 'COMPLETED' && o.paymentStatus === 'paid');
    completedPaidOrders.forEach(o => {
      const paidEvent = o.timeline?.find(e => e.type === 'COMPLETED');
      if (paidEvent && o.createdAt) {
        const duration = Math.max(0, (new Date(paidEvent.timestamp).getTime() - new Date(o.createdAt).getTime()) / 1000);
        totalBillSecs += duration;
        countBills++;
      }
    });
    const avgBillProcessingMinutes = countBills > 0
      ? Math.round((totalBillSecs / countBills) / 60)
      : 0;

    const activeTasksCount = optimizedTasks.length;
    const efficiencyScore = Math.max(0, 100 - (activeTasksCount * 5));

    return {
      avgDeliveryMinutes,
      avgBillProcessingMinutes,
      efficiencyScore
    };
  }, [orders, user?.uid, optimizedTasks]);

  const handleOccupyTableCC = async () => {
    if (!user?.tenantId || !selectedTable) return;
    try {
      const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', selectedTable.id);
      await updateDoc(tableRef, {
        status: 'occupied',
        assignedWaiterId: user.uid,
        assignedWaiterName: user.displayName || user.email || 'Waiter',
        guestsCount: guestsCount,
        tableNotes: tableNotesInput,
        section: tableSectionInput
      });
      toast.success(`Guests checked in on Table ${selectedTable.number}.`);
      
      setShift(prev => ({
        ...prev,
        stats: { ...prev.stats, tablesServed: prev.stats.tablesServed + 1 }
      }));

      logEvent(user.tenantId, {
        eventType: 'Customer Seated',
        eventCategory: 'Operational',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        tableId: selectedTable.id,
        tableNumber: selectedTable.number,
        title: 'Customer Seated',
        description: `Table ${selectedTable.number} occupies ${guestsCount} guests. Notes: ${tableNotesInput}`
      });

      setSelectedTable(null);
    } catch (e) {
      console.error(e);
      toast.error('Check-in failed.');
    }
  };

  const handleRequestBill = async (table: ITable) => {
    if (!user?.tenantId) return;
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'tables', table.id);
      await updateDoc(docRef, { status: 'bill_requested' });
      toast.success(`Invoice requested for Table ${table.number}.`);

      logEvent(user.tenantId, {
        eventType: 'Bill Requested',
        eventCategory: 'Operational',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        tableId: table.id,
        tableNumber: table.number,
        title: 'Bill Requested',
        description: `Billing invoice requested for Table ${table.number}.`
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateBill = (order: IOrder) => {
    setSelectedOrder(order);
    setDiscountPercent(0);
  };

  const handleCompleteCleaningCC = async (table: ITable) => {
    if (!user?.tenantId) return;
    try {
      const batch = writeBatch(db);
      const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', table.id);
      batch.update(tableRef, {
        status: 'empty',
        activeOrderId: null,
        guestsCount: 0,
        tableNotes: ''
      });

      if (table.activeOrderId) {
        const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', table.activeOrderId);
        batch.update(orderRef, { status: 'ARCHIVED' });
      }

      await batch.commit();

      setShift(prev => ({
        ...prev,
        stats: { ...prev.stats, cleaningCompleted: prev.stats.cleaningCompleted + 1 }
      }));

      toast.success(`Table ${table.number} sanitized and reset.`);

      logEvent(user.tenantId, {
        eventType: 'Table Cleaned',
        eventCategory: 'Operational',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        tableId: table.id,
        tableNumber: table.number,
        title: 'Table Cleaned',
        description: `Table ${table.number} reset successfully for new diners.`
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptTask = async (task: IWaiterTask) => {
    if (!user?.tenantId) return;
    try {
      if (task.source === 'order') {
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', task.targetId);
        await updateDoc(docRef, {
          waiterId: user.uid,
          waiterName: user.displayName || user.email || 'Waiter',
          deliveryAcceptedAt: new Date().toISOString()
        });
      } else if (task.source === 'request') {
        const docRef = doc(db, 'restaurants', user.tenantId, 'waiterRequests', task.targetId);
        await updateDoc(docRef, {
          status: 'Accepted',
          acceptedAt: new Date().toISOString(),
          acceptedBy: user.displayName || user.email || 'Waiter'
        });
      } else if (task.source === 'managerReview') {
        const docRef = doc(db, 'restaurants', user.tenantId, 'managerReviews', task.targetId);
        await updateDoc(docRef, {
          resolutionStatus: 'In Progress',
          assignedManager: user.displayName || user.email || 'Manager'
        });
      }
      toast.success('Task claimed and added to your flow timeline.');

      logEvent(user.tenantId, {
        eventType: 'Task Assigned',
        eventCategory: 'Waiter',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        orderId: task.source === 'order' ? task.targetId : undefined,
        taskId: task.id,
        tableNumber: task.tableNumber,
        title: 'Task Claimed',
        description: `Waiter claimed task: ${task.type} for Table ${task.tableNumber}.`
      });
    } catch (e) {
      console.error('Accept task failed:', e);
    }
  };

  const handleResolveTask = async (task: IWaiterTask) => {
    if (!user?.tenantId) return;
    try {
      if (task.source === 'order') {
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', task.targetId);
        const orderObj = orders.find(o => o.orderId === task.targetId);
        const start = orderObj?.deliveryAcceptedAt || new Date().toISOString();
        const durationSecs = Math.floor((Date.now() - new Date(start).getTime()) / 1000);

        const timelineEvent: ITimelineEvent = {
          type: 'DELIVERED',
          title: 'Order Delivered',
          description: `Delivered by Waiter ${user.displayName || user.email}`,
          timestamp: new Date().toISOString(),
          performedBy: user.displayName || 'Waiter'
        };

        await updateDoc(docRef, {
          status: 'DELIVERED',
          deliveredAt: new Date().toISOString(),
          deliveryDurationSeconds: durationSecs,
          timeline: arrayUnion(timelineEvent)
        });

        setShift(prev => ({
          ...prev,
          stats: { ...prev.stats, ordersDelivered: prev.stats.ordersDelivered + 1 }
        }));

        toast.success(`Food delivered to Table ${task.tableNumber}!`);

        logEvent(user.tenantId, {
          eventType: 'Order Delivered',
          eventCategory: 'Waiter',
          performedBy: user.displayName || user.email || 'Waiter',
          performedByRole: user.role || 'waiter',
          orderId: task.targetId,
          tableNumber: task.tableNumber,
          title: 'Order Delivered',
          description: `Deliver completed for Table ${task.tableNumber} in ${durationSecs}s.`
        });
      } else if (task.source === 'request') {
        const docRef = doc(db, 'restaurants', user.tenantId, 'waiterRequests', task.targetId);
        await updateDoc(docRef, {
          status: 'Completed',
          resolvedAt: new Date().toISOString()
        });

        setShift(prev => ({
          ...prev,
          stats: { ...prev.stats, requestsResolved: prev.stats.requestsResolved + 1 }
        }));

        toast.success(`Request for Table ${task.tableNumber} completed.`);

        logEvent(user.tenantId, {
          eventType: 'Task Completed',
          eventCategory: 'Waiter',
          performedBy: user.displayName || user.email || 'Waiter',
          performedByRole: user.role || 'waiter',
          taskId: task.id,
          tableNumber: task.tableNumber,
          title: 'Customer Request Resolved',
          description: `Waiter completed diner alert helper request: ${task.type}.`
        });
      } else if (task.type === 'Generate Bill' || task.type === 'Bill Request') {
        const tableObj = tables.find(t => t.id === task.targetId);
        const activeOrder = orders.find(o => o.orderId === tableObj?.activeOrderId);
        if (activeOrder) {
          handleGenerateBill(activeOrder);
        }
      } else if (task.type === 'Clean Table' || task.type === 'Cleaning') {
        const tableObj = tables.find(t => t.id === task.targetId);
        if (tableObj) {
          handleCompleteCleaningCC(tableObj);
        }
      } else if (task.source === 'managerReview') {
        const docRef = doc(db, 'restaurants', user.tenantId, 'managerReviews', task.targetId);
        await updateDoc(docRef, {
          resolutionStatus: 'Resolved',
          resolvedAt: new Date().toISOString(),
          resolutionNotes: 'Escalation resolved by server.'
        });

        setShift(prev => ({
          ...prev,
          stats: { ...prev.stats, requestsResolved: prev.stats.requestsResolved + 1 }
        }));

        toast.success('Manager escalation review resolved successfully.');

        logEvent(user.tenantId, {
          eventType: 'Task Completed',
          eventCategory: 'Management',
          performedBy: user.displayName || user.email || 'Manager',
          performedByRole: user.role || 'manager',
          taskId: task.id,
          tableNumber: task.tableNumber,
          title: 'Escalation Resolved',
          description: `Manager resolved escalation review for Table ${task.tableNumber}.`
        });
      }
    } catch (e) {
      console.error('Resolve task failed:', e);
    }
  };

  const handleMarkPaidCC = async () => {
    if (!user?.tenantId || !selectedOrder) return;
    setShowFeedbackModal(true);
  };

  const handleSubmitFeedback = async () => {
    if (!user?.tenantId || !selectedOrder) return;
    setIsUpdatingBill(true);
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'orders', selectedOrder.orderId);
      
      const subtotal = selectedOrder.subtotal;
      const discount = Math.round(subtotal * (discountPercent / 100));
      const newTax = Math.round((subtotal - discount) * 0.08);
      const newTotal = (subtotal - discount) + newTax;

      const isPositive = feedbackRating === 'Excellent' || feedbackRating === 'Good';
      const isComplaint = feedbackRating === 'Needs Attention' || feedbackRating === 'Complaint';

      const satisfactionData: ISatisfactionRating = {
        rating: feedbackRating,
        serviceSpeed,
        foodQuality,
        cleanliness,
        staffBehavior,
        waitingTime,
        ambience,
        customerType,
        visitOccasion,
        notes: feedbackNotes,
        submittedBy: user.uid,
        submittedByName: user.displayName || user.email || 'Waiter',
        submittedAt: new Date().toISOString(),
        orderId: selectedOrder.orderId,
        tableNumber: selectedOrder.tableNumber,
        tenantId: user.tenantId,
        isPositive,
        isComplaint,
        repeatCustomer: isRepeatCustomer
      };

      const satisfactionCol = collection(db, 'restaurants', user.tenantId, 'satisfactionRatings');
      const ratingDocRef = await addDoc(satisfactionCol, satisfactionData);

      if (isComplaint) {
        const managerTaskData = {
          tenantId: user.tenantId,
          customerIssue: `Diner rating: ${feedbackRating}. Notes: ${feedbackNotes || 'None'}`,
          priority: feedbackRating === 'Complaint' ? 'Critical' : 'High',
          assignedManager: 'Pending',
          resolutionStatus: 'Pending',
          resolutionNotes: '',
          submittedAt: new Date().toISOString(),
          submittedByName: user.displayName || user.email || 'Waiter',
          submittedBy: user.uid,
          tableNumber: selectedOrder.tableNumber,
          rating: feedbackRating,
          satisfactionRatingId: ratingDocRef.id
        };
        const mReviewsCol = collection(db, 'restaurants', user.tenantId, 'managerReviews');
        await addDoc(mReviewsCol, managerTaskData);
      }

      const timelineEvent: ITimelineEvent = {
        type: 'COMPLETED',
        title: 'Checkout Paid',
        description: `Settled with Table ${selectedOrder.tableNumber}. Total: ${formatPrice(newTotal)}.`,
        timestamp: new Date().toISOString(),
        performedBy: user.displayName || 'Waiter'
      };

      await updateDoc(docRef, {
        status: 'COMPLETED',
        paymentStatus: 'paid',
        discountPercent: discountPercent,
        tax: newTax,
        total: newTotal,
        timeline: arrayUnion(timelineEvent)
      });

      const tableObj = tables.find(t => t.number === selectedOrder.tableNumber);
      if (tableObj) {
        const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', tableObj.id);
        await updateDoc(tableRef, { status: 'cleaning', cleaningStartedAt: new Date().toISOString() });
      }

      setShift(prev => ({
        ...prev,
        stats: { ...prev.stats, billsGenerated: prev.stats.billsGenerated + 1 }
      }));

      toast.success('Invoice settled successfully!');
      setShowFeedbackModal(false);
      setSelectedOrder(null);

      logEvent(user.tenantId, {
        eventType: 'Bill Settled',
        eventCategory: 'Operational',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        orderId: selectedOrder.orderId,
        tableNumber: selectedOrder.tableNumber,
        title: 'Order Checkout Completed',
        description: `Invoice paid. Table ${selectedOrder.tableNumber} moved to cleaning queue.`
      });
    } catch (e) {
      console.error(e);
      toast.error('Checkout failed.');
    } finally {
      setIsUpdatingBill(false);
    }
  };

  const addToCart = (item: IMenuItem) => {
    setCart(prev => {
      const existing = prev[item.id];
      if (existing) {
        return {
          ...prev,
          [item.id]: { ...existing, count: existing.count + 1 }
        };
      }
      return {
        ...prev,
        [item.id]: { item, count: 1 }
      };
    });
  };

  const removeFromCart = (item: IMenuItem) => {
    setCart(prev => {
      const existing = prev[item.id];
      if (!existing) return prev;
      if (existing.count <= 1) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return {
        ...prev,
        [item.id]: { ...existing, count: existing.count - 1 }
      };
    });
  };

  const cartTotal = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + (entry.item.price * entry.count), 0);
  }, [cart]);

  const handlePlaceQuickOrder = async () => {
    if (!user?.tenantId || !orderTable) return;
    try {
      const orderId = generateUniqueOrderId();
      const orderItems = Object.values(cart).map(entry => ({
        menuItemId: entry.item.id,
        name: entry.item.name,
        count: entry.count,
        pricePerUnit: entry.item.price,
        status: 'PENDING'
      }));

      const newOrderData = {
        orderId,
        tenantId: user.tenantId,
        tableNumber: orderTable.number,
        waiterId: user.uid,
        waiterName: user.displayName || user.email || 'Waiter',
        status: 'PENDING',
        paymentStatus: 'pending',
        items: orderItems,
        subtotal: cartTotal,
        tax: Math.round(cartTotal * 0.08),
        total: Math.round(cartTotal * 1.08),
        createdAt: new Date().toISOString(),
        customerName: customerName || 'Diner party',
        customerPhone: customerPhone || '',
        timeline: [
          {
            type: 'PLACED',
            title: 'Order Placed',
            description: `Quick table-side checkout order by ${user.displayName || user.email}`,
            timestamp: new Date().toISOString(),
            performedBy: user.displayName || 'Waiter'
          }
        ]
      };

      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
      await setDoc(orderRef, newOrderData);

      const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', orderTable.id);
      await updateDoc(tableRef, { activeOrderId: orderId });

      toast.success(`Quick order submitted for Table ${orderTable.number}!`);

      logEvent(user.tenantId, {
        eventType: 'Order Placed',
        eventCategory: 'Waiter',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        orderId,
        tableNumber: orderTable.number,
        title: 'Table-side Order Placed',
        description: `New order #${orderId.substring(0, 8)} placed. Total: ${formatPrice(newOrderData.total)}.`
      });

      setOrderTable(null);
      setCart({});
      setCustomerName('');
      setCustomerPhone('');
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit order.');
    }
  };

  const handleUpdateTableWaiter = async (tableId: string, waiterId: string) => {
    if (!user?.tenantId) return;
    try {
      const waiterObj = employees.find(e => e.id === waiterId);
      const waiterName = waiterObj ? (waiterObj.displayName || waiterObj.email) : '';
      const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', tableId);
      await updateDoc(tableRef, {
        assignedWaiterId: waiterId || null,
        assignedWaiterName: waiterName || null
      });
      toast.success('Table server assignment updated.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignBulkSection = async () => {
    if (!user?.tenantId) return;
    try {
      const waiterObj = employees.find(e => e.id === bulkSectionWaiterId);
      const waiterName = waiterObj ? (waiterObj.displayName || waiterObj.email) : '';
      
      const targetTables = tables.filter(t => t.section === bulkSection);
      if (targetTables.length === 0) {
        toast.error(`No tables found in section ${bulkSection}`);
        return;
      }

      const batch = writeBatch(db);
      targetTables.forEach(t => {
        const tRef = doc(db, 'restaurants', user.tenantId, 'tables', t.id);
        batch.update(tRef, {
          assignedWaiterId: bulkSectionWaiterId || null,
          assignedWaiterName: waiterName || null
        });
      });

      await batch.commit();
      toast.success(`Assigned section ${bulkSection} to ${waiterName || 'nobody'}.`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAutoAssignTables = async () => {
    if (!user?.tenantId) return;
    const activeWaiters = employees.filter(e => e.role === 'waiter');
    if (activeWaiters.length === 0) {
      toast.error('No active waiter staff available.');
      return;
    }

    try {
      const batch = writeBatch(db);

      if (autoAssignStrategy === 'round-robin') {
        tables.forEach((t, idx) => {
          const waiter = activeWaiters[idx % activeWaiters.length];
          const tRef = doc(db, 'restaurants', user.tenantId, 'tables', t.id);
          batch.update(tRef, {
            assignedWaiterId: waiter.id,
            assignedWaiterName: waiter.displayName || waiter.email
          });
        });
      } else {
        const waiterLoads = activeWaiters.reduce((acc, w) => {
          acc[w.id] = 0;
          return acc;
        }, {} as Record<string, number>);

        tables.forEach(t => {
          let leastLoadedWaiterId = activeWaiters[0].id;
          let minLoad = Infinity;

          activeWaiters.forEach(w => {
            if (waiterLoads[w.id] < minLoad) {
              minLoad = waiterLoads[w.id];
              leastLoadedWaiterId = w.id;
            }
          });

          const waiter = activeWaiters.find(w => w.id === leastLoadedWaiterId)!;
          const tRef = doc(db, 'restaurants', user.tenantId, 'tables', t.id);
          batch.update(tRef, {
            assignedWaiterId: waiter.id,
            assignedWaiterName: waiter.displayName || waiter.email
          });

          waiterLoads[leastLoadedWaiterId]++;
        });
      }

      await batch.commit();
      toast.success(`Smart auto-allocation complete (${autoAssignStrategy})`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExecuteTask = (task: IWaiterTask) => {
    if (task.status === 'Pending') {
      handleAcceptTask(task);
    } else {
      handleResolveTask(task);
    }
  };

  // ─── Render Shift Control Card ───
  const renderShiftControlCard = () => {
    if (user?.role !== 'waiter') {
      return (
        <Card className="p-6 border-[#E3DED5] bg-white rounded-3xl shadow-sm">
          <div className="flex items-center space-x-4">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-600">
              <AlertOctagon className="w-6 h-6 animate-pulse" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-extrabold text-[#18201D]">Shift Command Desk (Manager View)</h2>
              <p className="text-xs text-[#5F6875] font-semibold mt-0.5">
                Shift active actions are disabled. Only logged-in employees with the Waiter role can start floor shifts.
              </p>
            </div>
          </div>
        </Card>
      );
    }
    const durationStr = shift.isActive ? formatDuration(getShiftWorkingTime(shift)) : '';
    return (
      <Card className="p-6 border-[#E3DED5] bg-white rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className={`p-3.5 rounded-2xl ${shift.isActive ? (shift.status === 'break' ? 'bg-amber-500/15 text-amber-600' : 'bg-emerald-500/15 text-emerald-600') : 'bg-[#F7F4EE] text-[#5F6875]'}`}>
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-extrabold text-[#18201D]">Shift Command Desk</h2>
              <p className="text-xs text-[#5F6875] font-semibold mt-0.5">
                {shift.isActive ? (
                  <span>On Duty · <span className="font-mono text-emerald-600 font-bold">{durationStr}</span> {shift.status === 'break' && ' (On Break)'}</span>
                ) : (
                  <span>Offline · Clock-in to sync tables and receive service request task cards</span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {shift.isActive ? (
              <>
                {shift.status === 'active' ? (
                  <Button onClick={handleStartBreak} variant="secondary" className="flex items-center gap-1.5 text-xs font-bold py-2.5 px-4 rounded-xl border border-[#E3DED5] bg-white text-[#18201D] hover:bg-[#F7F4EE]">
                    <Coffee className="w-3.5 h-3.5" />
                    <span>Take Break</span>
                  </Button>
                ) : (
                  <Button onClick={handleEndBreak} variant="secondary" className="flex items-center gap-1.5 text-xs font-bold py-2.5 px-4 rounded-xl border border-amber-500/30 bg-amber-50 text-amber-700 hover:bg-amber-100">
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume Duty</span>
                  </Button>
                )}
                <Button onClick={handleEndShiftClick} className="flex items-center gap-1.5 text-xs font-bold py-2.5 px-4 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-600 hover:text-white">
                  <Square className="w-3.5 h-3.5" />
                  <span>End Shift</span>
                </Button>
              </>
            ) : (
              <Button onClick={handleStartShift} className="flex items-center gap-1.5 text-xs font-bold py-2.5 px-6 rounded-xl bg-primary text-white hover:bg-primary-hover">
                <Play className="w-3.5 h-3.5" />
                <span>Start Active Shift</span>
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // ─── Render Command Header Metrics ───
  const renderCommandHeaderMetrics = () => {
    const myTablesCount = tables.filter(t => t.assignedWaiterId === user?.uid && t.status !== 'empty').length;
    const pendingTasksCount = optimizedTasks.length;
    const efficiency = performanceStats.efficiencyScore;

    // Today's Pending Bills
    const today = new Date().toDateString();
    const pendingBillsOrders = orders.filter(o => 
      o.status === 'BILL_REQUESTED' || 
      (o.paymentStatus === 'pending' && (o.status === 'SERVED' || o.status === 'DELIVERED' || o.status === 'DINING'))
    );
    const pendingBillsCount = pendingBillsOrders.length;
    const pendingBillsTotal = pendingBillsOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    // Average Guest Stay Time
    let totalStayMinutes = 0;
    let stayCount = 0;
    orders.forEach(o => {
      if (o.createdAt && (o as any).paidAt) {
        const duration = (new Date((o as any).paidAt).getTime() - new Date(o.createdAt).getTime()) / 60000;
        if (duration > 0 && duration < 240) {
          totalStayMinutes += duration;
          stayCount++;
        }
      }
    });
    const avgStay = stayCount > 0 ? `${Math.round(totalStayMinutes / stayCount)}m` : '45m';

    // Average Table Turnover
    const totalTablesCount = tables.length || 1;
    const todayOrdersCount = orders.filter(o => new Date(o.createdAt).toDateString() === today).length;
    const turnoverRate = (todayOrdersCount / totalTablesCount).toFixed(1);
    const tableTurnover = `${turnoverRate}x`;
    
    return (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="p-4 border-slate-800 bg-slate-900/30 rounded-2xl flex items-center justify-between text-left">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">My Seated Tables</span>
            <h3 className="text-xl font-extrabold text-textPearl">{myTablesCount}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-4 border-slate-800 bg-slate-900/30 rounded-2xl flex items-center justify-between text-left">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Active Alerts/Tasks</span>
            <h3 className="text-xl font-extrabold text-textPearl">{pendingTasksCount}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <ListTodo className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-4 border-slate-800 bg-slate-900/30 rounded-2xl flex items-center justify-between text-left">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Delivered Shift</span>
            <h3 className="text-xl font-extrabold text-textPearl">{shift.stats.ordersDelivered}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Coffee className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-4 border-slate-800 bg-slate-900/30 rounded-2xl flex items-center justify-between text-left">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Efficiency Score</span>
            <h3 className="text-xl font-extrabold text-textPearl">{efficiency}%</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-4 border-slate-800 bg-slate-900/30 rounded-2xl flex items-center justify-between text-left">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Pending Bills</span>
            <h3 className="text-sm font-extrabold text-textPearl">{pendingBillsCount} ({formatPrice(pendingBillsTotal)})</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </Card>
        <Card className="p-4 border-slate-800 bg-slate-900/30 rounded-2xl flex items-center justify-between text-left">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Stay & Turnover</span>
            <h3 className="text-xs font-extrabold text-textPearl">Stay: {avgStay} · Turn: {tableTurnover}</h3>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
        </Card>
      </div>
    );
  };

  // ─── Render Next Best Action Hero ───
  const renderNextBestActionHero = () => {
    if (!nextBestAction) {
      return (
        <Card className="p-6 border-slate-800 bg-emerald-950/5 rounded-3xl flex flex-col items-center justify-center text-center space-y-3 min-h-[160px]">
          <CheckCircle className="w-10 h-10 text-emerald-500 animate-bounce" />
          <div>
            <h3 className="text-sm font-extrabold text-textPearl">All Dining Tasks Clear!</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Diners are well-served and floor queues are quiet.</p>
          </div>
        </Card>
      );
    }
    
    const elapsedMins = Math.floor((Date.now() - new Date(nextBestAction.createdAt).getTime()) / 60000);
    const elapsedText = elapsedMins < 1 ? 'Just now' : `${elapsedMins}m ago`;
    
    return (
      <Card className="p-6 border-primary/20 bg-primary/5 rounded-3xl flex flex-col justify-between space-y-4 text-left relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3">
          <Badge variant={nextBestAction.priority === 'critical' || nextBestAction.priority === 'high' ? 'danger' : 'warning'} className="uppercase">
            {nextBestAction.priority}
          </Badge>
        </div>
        <div className="space-y-1.5 pr-16">
          <span className="text-[10px] text-primary font-extrabold uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Next Best Action Recommendation
          </span>
          <h3 className="text-base font-extrabold text-textPearl">
            {nextBestAction.type} — Table {nextBestAction.tableNumber} ({nextBestAction.section})
          </h3>
          <p className="text-xs text-slate-400">{nextBestAction.description}</p>
          {nextBestAction.notes && (
            <p className="text-[11px] text-amber-400 italic">Notes: "{nextBestAction.notes}"</p>
          )}
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
            <Clock className="w-3 h-3" />
            {elapsedText} elapsed
          </span>
          <Button
            onClick={() => handleExecuteTask(nextBestAction)}
            className="text-xs font-bold py-2 px-4 rounded-xl bg-primary text-slate-950 hover:bg-primary-hover flex items-center gap-1.5"
          >
            <span>Resolve Action</span>
            <Check className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Card>
    );
  };

  // ─── Render Unified Task Queue ───
  const renderUnifiedTaskQueue = () => {
    const filteredTasks = optimizedTasks.filter(t => {
      if (queueFilter === 'all') return true;
      if (queueFilter === 'delivery') return t.source === 'order';
      if (queueFilter === 'request') return t.source === 'request' || t.source === 'managerReview';
      if (queueFilter === 'bill') return t.type === 'Bill Request' || t.type === 'Generate Bill';
      if (queueFilter === 'cleaning') return t.type === 'Cleaning' || t.type === 'Clean Table';
      return true;
    });
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-textPearl uppercase tracking-wider flex items-center gap-1.5">
            <ListTodo className="w-4 h-4 text-primary" />
            <span>Active Task Feed ({filteredTasks.length})</span>
          </h3>
          <div className="bg-slate-900 border border-slate-800 p-0.5 rounded-lg flex items-center space-x-0.5 text-[10px] font-bold">
            {[
              { id: 'all', label: 'All' },
              { id: 'delivery', label: 'Deliveries' },
              { id: 'request', label: 'Requests' },
              { id: 'bill', label: 'Bills' },
              { id: 'cleaning', label: 'Cleaning' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setQueueFilter(opt.id as any)}
                className={`px-2.5 py-1 rounded-md transition-all font-bold ${
                  queueFilter === opt.id
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-[#5F6875] hover:text-[#18201D]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        
        {filteredTasks.length === 0 ? (
          <Card className="p-8 text-center border border-dashed border-[#E3DED5] bg-white rounded-2xl shadow-xs">
            <CheckCircle className="w-8 h-8 text-[#8D9B95] mx-auto mb-2" />
            <p className="text-xs font-bold text-[#5F6875]">No active tasks in this category.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => {
              const elapsedMins = Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 60000);
              const elapsedText = elapsedMins < 1 ? 'Just now' : `${elapsedMins}m ago`;
              
              return (
                <Card
                  key={task.id}
                  className={`p-4 border text-left rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    task.status === 'Accepted'
                      ? 'border-indigo-500/20 bg-indigo-955/5'
                      : 'border-slate-850 bg-slate-900/20'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 pr-4">
                     <div className="flex flex-wrap items-center gap-2">
                       <span className="text-[10px] font-extrabold uppercase text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                         Table {task.tableNumber} ({task.section})
                       </span>
                       <Badge
                         variant={
                           task.priority === 'critical'
                             ? 'danger'
                             : task.priority === 'high'
                             ? 'warning'
                             : 'muted'
                         }
                         className="uppercase text-[9px] py-0 px-1.5 font-extrabold"
                       >
                         {task.priority}
                       </Badge>
                       {task.status === 'Accepted' && (
                         <span className="text-[9px] font-extrabold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                           Claimed By Me
                         </span>
                       )}
                     </div>
                     <h4 className="text-sm font-extrabold text-textPearl">{task.type}</h4>
                     <p className="text-xs text-slate-400 leading-relaxed">{task.description}</p>
                     {task.notes && (
                       <p className="text-[10px] text-amber-400 italic">Notes: "{task.notes}"</p>
                     )}
                     <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-semibold pt-1">
                       <Clock className="w-3 h-3" />
                       <span>Active: {elapsedText}</span>
                     </div>
                  </div>
                  
                  <div className="flex sm:flex-col gap-2 min-w-[120px]">
                    {task.status === 'Pending' ? (
                      <Button
                        onClick={() => handleAcceptTask(task)}
                        className="w-full py-2 bg-indigo-500 hover:bg-indigo-650 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        <span>Claim Task</span>
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleResolveTask(task)}
                        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Resolve</span>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ─── Render Live Activity Feed / Live Action Center ───
  const renderLiveActivityFeed = () => {
    // 1. Get counts
    const activeAlerts = optimizedTasks.length;
    const highPriority = optimizedTasks.filter(t => t.priority === 'critical' || t.priority === 'high').length;
    
    // Quick summary counts
    const kitchenReadyCount = optimizedTasks.filter(t => t.type === 'Kitchen Ready').length;
    const customerAlertsCount = optimizedTasks.filter(t => t.source === 'request' && t.type !== 'Bill Request' && t.type !== 'Cleaning' && t.type !== 'Clean Table' && t.type !== 'Generate Bill').length;
    const billsPendingCount = optimizedTasks.filter(t => t.type === 'Bill Request' || t.type === 'Generate Bill').length;
    const cleaningCount = optimizedTasks.filter(t => t.type === 'Cleaning' || t.type === 'Clean Table').length;
    const vipCount = optimizedTasks.filter(t => t.notes?.toLowerCase().includes('vip') || t.tableNumber === 'VIP').length;

    // Filter tasks based on actionFilter
    const getTaskCategory = (t: IWaiterTask): 'Kitchen' | 'Customers' | 'Payments' | 'Cleaning' | 'Manager' => {
      if (t.source === 'order') return 'Kitchen';
      if (t.source === 'managerReview') return 'Manager';
      if (t.type === 'Cleaning' || t.type === 'Clean Table') return 'Cleaning';
      if (t.type === 'Bill Request' || t.type === 'Generate Bill') return 'Payments';
      return 'Customers';
    };

    const filteredTasks = optimizedTasks.filter(t => {
      if (actionFilter === 'All') return true;
      return getTaskCategory(t) === actionFilter;
    }).slice(0, 8); // Keep maximum 8 visible events

    return (
      <Card className="p-4 border-slate-850 bg-slate-900/40 rounded-3xl space-y-4 text-left shadow-xl w-full">
        {/* Header Section */}
        <div className="space-y-1 pb-3 border-b border-slate-800/40">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-black text-textPearl uppercase tracking-widest flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-primary animate-pulse" />
              <span>Live Action Center</span>
            </h3>
            <span className="text-[9px] text-slate-550 font-bold font-mono">Last updated: Just now</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold pt-1">
            <span>Active Alerts: <strong className="text-textPearl font-mono font-black">{activeAlerts}</strong></span>
            <span>High Priority: <strong className="text-red-450 font-mono font-black">{highPriority}</strong></span>
          </div>
        </div>

        {/* Quick Summary Grid */}
        <div className="grid grid-cols-5 gap-1 text-center text-[9px] font-extrabold pb-3 border-b border-slate-800/45">
          <div className="bg-slate-950/60 border border-slate-850 p-1.5 rounded-xl">
            <span className="block text-slate-500 uppercase text-[8px]">Kitchen</span>
            <span className="text-primary font-mono text-xs">{kitchenReadyCount}</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 p-1.5 rounded-xl">
            <span className="block text-slate-500 uppercase text-[8px]">Alerts</span>
            <span className="text-orange-400 font-mono text-xs">{customerAlertsCount}</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 p-1.5 rounded-xl">
            <span className="block text-slate-500 uppercase text-[8px]">Bills</span>
            <span className="text-emerald-450 font-mono text-xs">{billsPendingCount}</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 p-1.5 rounded-xl">
            <span className="block text-slate-500 uppercase text-[8px]">Clean</span>
            <span className="text-indigo-400 font-mono text-xs">{cleaningCount}</span>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 p-1.5 rounded-xl">
            <span className="block text-slate-500 uppercase text-[8px]">VIP</span>
            <span className="text-red-500 font-mono text-xs">{vipCount}</span>
          </div>
        </div>

        {/* Segmented Filter Pills */}
        <div className="flex flex-wrap gap-1 text-[10px] font-extrabold bg-slate-955 p-1 rounded-xl border border-slate-850">
          {(['All', 'Kitchen', 'Customers', 'Payments', 'Cleaning', 'Manager'] as const).map(cat => {
            // Count for category
            let catCount = 0;
            if (cat === 'All') catCount = activeAlerts;
            else if (cat === 'Kitchen') catCount = kitchenReadyCount;
            else if (cat === 'Customers') catCount = customerAlertsCount;
            else if (cat === 'Payments') catCount = billsPendingCount;
            else if (cat === 'Cleaning') catCount = cleaningCount;
            else if (cat === 'Manager') catCount = optimizedTasks.filter(t => t.source === 'managerReview').length;

            const isSelected = actionFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setActionFilter(cat)}
                className={`px-2 py-1 rounded-lg transition-all flex items-center gap-1 font-extrabold text-xs ${
                  isSelected 
                    ? 'bg-primary text-white shadow-xs' 
                    : 'text-[#5F6875] hover:text-[#18201D] border border-transparent'
                }`}
              >
                <span>{cat}</span>
                {catCount > 0 && (
                  <span className={`px-1 py-0.2 rounded-full text-[8px] font-black font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[#E3DED5] text-[#5F6875]'
                  }`}>
                    {catCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Event Cards Queue */}
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {filteredTasks.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-850 bg-slate-900/10 rounded-2xl space-y-2 select-none">
              <CheckCircle className="w-8 h-8 text-emerald-500/80 mx-auto animate-bounce" />
              <div className="text-xs font-black text-slate-300">✔ Everything is under control</div>
              <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                No active alerts.<br />Kitchen and dining floor are operating normally.
              </p>
              <div className="text-[8px] text-slate-600 font-extrabold uppercase pt-1">
                Last activity: Just now
              </div>
            </div>
          ) : (
            filteredTasks.map(task => {
              const elapsedMins = Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 60000);
              const elapsedText = elapsedMins < 1 ? 'Just now' : `${elapsedMins}m ago`;
              
              // Get time of day (formatted short time)
              const timeText = new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              // Colors based on priority
              let stripColor = 'bg-blue-500'; // Information
              let priorityLabel = 'Low';
              if (task.priority === 'critical') {
                stripColor = 'bg-red-500';
                priorityLabel = 'Critical';
              } else if (task.priority === 'high') {
                stripColor = 'bg-orange-500';
                priorityLabel = 'High';
              }

              // Card status badge text
              const statusText = task.status === 'Accepted' ? 'IN PROGRESS' : 'NEW';

              // Call Manager Handler
              const handleCallManagerFromCard = async () => {
                try {
                  const managerTaskData = {
                    tenantId: user?.tenantId || '',
                    customerIssue: `Assistance requested at Table ${task.tableNumber} by Waiter ${user?.displayName || user?.email}`,
                    priority: 'High',
                    assignedManager: 'Pending',
                    resolutionStatus: 'Pending',
                    resolutionNotes: '',
                    submittedAt: new Date().toISOString(),
                    submittedByName: user?.displayName || user?.email || 'Waiter',
                    submittedBy: user?.uid || '',
                    tableNumber: task.tableNumber
                  };
                  const mReviewsCol = collection(db, 'restaurants', user?.tenantId || '', 'managerReviews');
                  await addDoc(mReviewsCol, managerTaskData);
                  toast.success(`Manager summoned to Table ${task.tableNumber}.`);
                } catch (e) {
                  console.error(e);
                }
              };

              // Select Card Icon
              const renderCardIcon = () => {
                const isVip = task.notes?.toLowerCase().includes('vip') || task.tableNumber === 'VIP';
                const isComplaint = task.notes?.toLowerCase().includes('complaint') || task.type.toLowerCase().includes('complaint');
                
                if (isVip) return <Award className="w-4 h-4 text-red-500" />;
                if (isComplaint) return <ShieldAlert className="w-4 h-4 text-red-500" />;
                if (task.source === 'order') return <ChefHat className="w-4 h-4 text-orange-400" />;
                if (task.type === 'Cleaning' || task.type === 'Clean Table') return <Trash2 className="w-4 h-4 text-indigo-400" />;
                if (task.type === 'Bill Request' || task.type === 'Generate Bill') return <DollarSign className="w-4 h-4 text-emerald-450" />;
                return <MessageSquare className="w-4 h-4 text-blue-400" />;
              };

              return (
                <div 
                  key={task.id}
                  className="flex border border-slate-850 bg-slate-950/40 rounded-2xl overflow-hidden hover:border-slate-800 transition-all duration-300 shadow-md group hover:scale-[1.01]"
                >
                  {/* Priority Color Strip */}
                  <div className={`w-1.5 shrink-0 ${stripColor} self-stretch`} />

                  {/* Card Content */}
                  <div className="flex-1 p-3.5 space-y-2.5 text-left text-xs font-semibold">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-slate-350 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                            Table {task.tableNumber}
                          </span>
                          <span className="text-[8px] font-extrabold uppercase text-slate-500">
                            {task.section}
                          </span>
                        </div>
                        <h4 className="font-black text-textPearl pt-1 flex items-center gap-1">
                          {renderCardIcon()}
                          <span>{task.type}</span>
                        </h4>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="block text-[8px] text-slate-550 font-mono font-bold">{timeText} ({elapsedText})</span>
                        <span className="inline-block text-[8px] font-black uppercase px-1 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                          {statusText}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                      {task.description}
                    </p>

                    {task.notes && (
                      <p className="text-[10px] text-amber-500/85 italic font-medium">
                        Notes: "{task.notes}"
                      </p>
                    )}

                    <div className="text-[9px] text-slate-500 flex justify-between border-t border-slate-800/20 pt-2 font-medium">
                      <span>Server: <strong className="text-slate-400">{task.notes?.toLowerCase().includes('server:') ? 'System' : (task.status === 'Accepted' ? 'Claimed' : 'Unassigned')}</strong></span>
                      <span>Priority: <strong className={task.priority === 'critical' ? 'text-red-400 font-black' : task.priority === 'high' ? 'text-orange-400 font-black' : 'text-blue-400 font-black'}>{priorityLabel}</strong></span>
                    </div>

                    {/* Contextual Action Buttons */}
                    <div className="flex gap-1.5 pt-1.5 border-t border-slate-800/20">
                      {task.status === 'Pending' ? (
                        <>
                          <Button
                            onClick={() => handleAcceptTask(task)}
                            className="flex-1 py-1.5 text-[10px] font-black bg-indigo-500 hover:bg-indigo-600 text-slate-950 rounded-xl"
                          >
                            Accept
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={handleCallManagerFromCard}
                            className="py-1.5 px-2.5 text-[10px] font-bold bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-450 rounded-xl"
                          >
                            Manager
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={() => handleResolveTask(task)}
                            className="flex-1 py-1.5 text-[10px] font-black bg-emerald-500 hover:bg-emerald-600 text-slate-955 rounded-xl"
                          >
                            Resolve
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={handleCallManagerFromCard}
                            className="py-1.5 px-2.5 text-[10px] font-bold bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-450 rounded-xl"
                          >
                            Escalate
                          </Button>
                        </>
                      )}
                      
                      {/* Contextual specific action buttons */}
                      {(task.type === 'Bill Request' || task.type === 'Generate Bill') && (
                        <Button
                          onClick={() => {
                            const activeOrder = orders.find(o => o.orderId === task.targetId || o.tableNumber === task.tableNumber);
                            if (activeOrder) handleGenerateBill(activeOrder);
                            else toast.error('No active billing order found for Table.');
                          }}
                          className="py-1.5 px-2.5 text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-textPearl rounded-xl"
                        >
                          Print Bill
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    );
  };

  // ─── Render Handovers Claim Alert Overlay ───
  const renderIncomingHandoversAlert = () => {
    if (incomingHandovers.length === 0) return null;
    return (
      <div className="space-y-3">
        {incomingHandovers.map(h => (
          <div key={h.id} className="p-4 border border-indigo-500/25 bg-indigo-950/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="space-y-1">
              <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Shift Handover Claim Request
              </span>
              <p className="text-xs text-textPearl">
                Waiter <strong>{h.handoverByName}</strong> wants to transfer <strong>{h.tablesCount} tables</strong>, <strong>{h.ordersCount} orders</strong>, and <strong>{h.requestsCount} requests</strong> to you.
              </p>
              <p className="text-[10px] text-slate-500 italic">"Reason: {h.handoverReason}"</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="secondary"
                className="py-1.5 px-3 text-xs bg-slate-950 border border-slate-800 text-slate-400"
                onClick={() => handleRejectHandover(h)}
              >
                Decline
              </Button>
              <Button
                className="py-1.5 px-4 text-xs bg-indigo-500 text-slate-950 hover:bg-indigo-650"
                onClick={() => handleAcceptHandover(h)}
              >
                Accept Claim
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 text-left select-none pb-24">
      {/* Shift control center header card */}
      {renderShiftControlCard()}

      {/* Render incoming handovers alert overlay */}
      {renderIncomingHandoversAlert()}

      {shift.isActive || isManagerOrOwner ? (
        <div className="space-y-6">
          {/* Header Metrics overview widgets */}
          {renderCommandHeaderMetrics()}

          <div className="bg-[#F7F4EE] border border-[#E3DED5] p-1.5 rounded-2xl flex items-center space-x-1.5 self-start overflow-x-auto max-w-full">
            {(
              [
                { id: 'command_center', label: 'Command Queue', Icon: ListTodo },
                { id: 'floor_map', label: 'Floor Matrix Seating', Icon: LayoutGrid },
                { id: 'cleaning', label: 'Sanitizing Duties', count: tables.filter(t => t.status === 'cleaning' && t.assignedWaiterId === user?.uid).length },
                { id: 'stats', label: 'Performance Summary', Icon: Award },
                { id: 'live_feed', label: 'Operations Event Feed', Icon: Activity },
                ...(isManagerOrOwner ? [{ id: 'manager_console', label: 'Manager Allocation Console', Icon: Users }] : [])
              ] as { id: TWaiterTab; label: string; Icon?: any; count?: number }[]
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all border outline-none shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-white border-[#E3DED5] text-primary shadow-xs'
                    : 'text-[#5F6875] border-transparent hover:text-[#18201D] hover:bg-white/60'
                }`}
              >
                {tab.Icon && <tab.Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#ECE8E1] text-[#18201D] text-[9px] font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ───────────────── COMMAND CENTER QUEUE VIEW ───────────────── */}
          {activeTab === 'command_center' && (
            <div className="flex flex-col lg:flex-row gap-5">
              <div className="flex-1 space-y-4">
                {renderNextBestActionHero()}
                {renderUnifiedTaskQueue()}
              </div>

              <div className="lg:w-[350px] md:w-full w-full shrink-0">
                {renderLiveActivityFeed()}
              </div>
            </div>
          )}

          {/* ───────────────── FLOOR MAP MATRIX VIEW ───────────────── */}
          {activeTab === 'floor_map' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {tables.map(table => {
                  const assignedToMe = table.assignedWaiterId === user?.uid;
                  const isOccupied = table.status === 'occupied' || table.status === 'service_requested' || table.status === 'bill_requested';
                  const isCleaning = table.status === 'cleaning';
                  
                  return (
                    <Card
                      key={table.id}
                      className={`p-4 border bg-slate-900/40 rounded-2xl text-left flex flex-col justify-between h-40 hover:border-slate-755 transition-all ${
                        assignedToMe 
                          ? 'border-primary/45 bg-primary/5 ring-1 ring-primary/10' 
                          : 'border-slate-850'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-sm text-textPearl">Table {table.number}</span>
                        <Badge
                          variant={
                            table.status === 'empty'
                              ? 'success'
                              : table.status === 'bill_requested'
                              ? 'danger'
                              : 'warning'
                          }
                          className="text-[9px]"
                        >
                          {table.status === 'bill_requested'
                            ? 'Invoice'
                            : table.status === 'service_requested'
                            ? 'Alert'
                            : table.status}
                        </Badge>
                      </div>

                      <div className="text-left space-y-1">
                        <span className="text-[10px] text-slate-500 font-extrabold uppercase">{table.section || 'Main Room'}</span>
                        <div className="text-[10px] text-slate-400 truncate">
                          {isOccupied ? `Guests: ${table.guestsCount || 2}` : 'Available'}
                        </div>
                        {table.tableNotes && (
                          <div className="text-[9px] text-amber-400 mt-1 truncate">
                            ⚠️ {table.tableNotes}
                          </div>
                        )}
                        <div className="text-[9px] text-slate-500 font-medium truncate">
                          Server: {table.assignedWaiterName || 'Unassigned'}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-800/40 pt-2 gap-1.5">
                        {table.status === 'empty' ? (
                          <Button
                            onClick={() => {
                              setSelectedTable(table);
                              setGuestsCount(table.seatingCapacity);
                              setTableSectionInput(table.section || 'Main Room');
                              setTableNotesInput('');
                            }}
                            className="w-full py-1 text-[9px] bg-slate-800 text-slate-300 font-bold hover:bg-slate-750"
                          >
                            <UserPlus className="w-3 h-3 mr-1 inline" /> Check In
                          </Button>
                        ) : (
                          <>
                            {assignedToMe ? (
                              <>
                                {table.status === 'bill_requested' ? (
                                  <Button
                                    onClick={() => {
                                      const activeOrder = orders.find(o => o.orderId === table.activeOrderId);
                                      if (activeOrder) handleGenerateBill(activeOrder);
                                    }}
                                    className="flex-1 py-1 text-[9px] bg-emerald-500 text-slate-955 font-extrabold"
                                  >
                                    <DollarSign className="w-3 h-3 mr-0.5 inline" /> Checkout
                                  </Button>
                                ) : isCleaning ? (
                                  <Button
                                    onClick={() => handleCompleteCleaningCC(table)}
                                    className="w-full py-1 text-[9px] bg-indigo-500 text-slate-950 font-extrabold"
                                  >
                                    <Check className="w-3 h-3 mr-0.5 inline" /> Sanitize
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      onClick={() => {
                                        setOrderTable(table);
                                        setCart({});
                                        setCustomerName('');
                                        setCustomerPhone('');
                                      }}
                                      className="flex-1 py-1 text-[9px] bg-primary text-slate-950 font-bold"
                                    >
                                      Order
                                    </Button>
                                    <Button
                                      onClick={() => handleRequestBill(table)}
                                      className="flex-1 py-1 text-[9px] bg-slate-800 text-slate-300 font-bold"
                                    >
                                      Invoice
                                    </Button>
                                  </>
                                )}
                              </>
                            ) : (
                              <Button
                                onClick={() => user?.uid && handleUpdateTableWaiter(table.id, user.uid)}
                                className="w-full py-1 text-[9px] bg-white border border-[#E3DED5] text-[#18201D] font-bold hover:bg-[#F7F4EE]"
                              >
                                Claim Server Role
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* ───────────────── SANITIZING DUTIES VIEW ───────────────── */}
          {activeTab === 'cleaning' && (
            <div className="space-y-4 text-left">
              <h3 className="text-sm font-extrabold text-[#18201D] uppercase tracking-wider">Sanitization Queue</h3>
              {tables.filter(t => t.status === 'cleaning' && t.assignedWaiterId === user?.uid).length === 0 ? (
                <Card className="p-8 text-center border border-dashed border-[#E3DED5] bg-white rounded-2xl shadow-xs">
                  <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-[#18201D]">All tables sanitized!</h4>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tables.filter(t => t.status === 'cleaning' && t.assignedWaiterId === user?.uid).map(table => (
                    <Card key={table.id} className="p-5 border border-[#E3DED5] bg-white text-xs space-y-4 shadow-xs">
                      <div className="flex justify-between items-center">
                        <strong className="text-sm text-[#18201D]">Table {table.number} ({table.section || 'Main Room'})</strong>
                        <Badge variant="warning">Cleaning Needed</Badge>
                      </div>
                      <p className="text-[#5F6875]">Clear table service remnants, sanitize layout surfaces, resets placements.</p>
                      <Button
                        onClick={() => handleCompleteCleaningCC(table)}
                        className="w-full py-2 bg-indigo-600 text-white font-extrabold text-xs rounded-xl uppercase tracking-wider flex items-center justify-center space-x-1"
                      >
                        <Check className="w-4 h-4" />
                        <span>Reset and Release Table</span>
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ───────────────── PERFORMANCE STATS VIEW ───────────────── */}
          {activeTab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
              <Card className="p-5 border-slate-850 bg-slate-900/40 space-y-2">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase">Avg Order Delivery Speed</span>
                <div className="text-2xl font-extrabold font-mono text-textPearl">{performanceStats.avgDeliveryMinutes} mins</div>
                <p className="text-[10px] text-slate-500">From kitchen cooking READY confirmation status to waiter customer table checkout.</p>
              </Card>

              <Card className="p-5 border-slate-850 bg-slate-900/40 space-y-2">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase">Avg Invoice checkout Speed</span>
                <div className="text-2xl font-extrabold font-mono text-textPearl">{performanceStats.avgBillProcessingMinutes} mins</div>
                <p className="text-[10px] text-slate-500">Billing request trigger to waiter check out feedback submission.</p>
              </Card>

              <Card className="p-5 border-slate-850 bg-slate-900/40 space-y-2">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase">Diners Served Stats</span>
                <div className="text-2xl font-extrabold font-mono text-textPearl">{shift.stats.tablesServed} tables</div>
                <p className="text-[10px] text-slate-500">Total check-in client counts resolved in this shift duration logs.</p>
              </Card>
            </div>
          )}

          {/* ───────────────── LIVE ACTIVITY FEED VIEW ───────────────── */}
          {activeTab === 'live_feed' && (
            <div className="max-w-2xl mx-auto">
              {renderLiveActivityFeed()}
            </div>
          )}

          {/* ───────────────── MANAGER CONSOLE VIEW ───────────────── */}
          {activeTab === 'manager_console' && isManagerOrOwner && (
            <div className="space-y-6 text-left">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Auto Assign Card */}
                <Card className="p-5 border-slate-800 bg-slate-955/20 space-y-4">
                  <h3 className="text-xs font-extrabold text-textPearl uppercase tracking-wider flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    <span>Smart Dining Table Auto-Allocations</span>
                  </h3>
                  <div className="space-y-3 text-xs">
                    <p className="text-slate-400">Distribute all tables evenly across active waiter staff members on duty.</p>
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center space-x-1.5 text-slate-350 cursor-pointer">
                        <input
                          type="radio"
                          name="strategy"
                          checked={autoAssignStrategy === 'round-robin'}
                          onChange={() => setAutoAssignStrategy('round-robin')}
                          className="text-primary bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
                        />
                        <span>Round-Robin Layout</span>
                      </label>
                      <label className="flex items-center space-x-1.5 text-slate-350 cursor-pointer">
                        <input
                          type="radio"
                          name="strategy"
                          checked={autoAssignStrategy === 'least-loaded'}
                          onChange={() => setAutoAssignStrategy('least-loaded')}
                          className="text-primary bg-slate-950 border-slate-800 focus:ring-0 cursor-pointer"
                        />
                        <span>Least-Loaded Balance</span>
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={handleAutoAssignTables}
                    className="w-full py-2.5 bg-primary text-slate-950 hover:bg-primary-hover text-xs font-extrabold rounded-xl uppercase tracking-wider flex items-center justify-center space-x-1"
                  >
                    <span>Execute Auto Assignment</span>
                  </button>
                </Card>

                {/* Section Assignment Card */}
                <Card className="p-5 border-slate-800 bg-slate-955/20 space-y-4">
                  <h3 className="text-xs font-extrabold text-textPearl uppercase tracking-wider flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>Assign Entire Floor Section</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-500 font-bold">Select Section</label>
                      <select
                        value={bulkSection}
                        onChange={e => setBulkSection(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-300 outline-none"
                      >
                        <option value="Main Room">Main Room</option>
                        <option value="Patio">Patio</option>
                        <option value="Bar">Bar</option>
                        <option value="VIP Lounge">VIP Lounge</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-500 font-bold">Assign To Waiter</label>
                      <select
                        value={bulkSectionWaiterId}
                        onChange={e => setBulkSectionWaiterId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-805 rounded-lg p-2 text-slate-350 outline-none"
                      >
                        <option value="">Choose waiter...</option>
                        {employees.filter(e => e.role === 'waiter').map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.displayName || emp.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleAssignBulkSection}
                    className="w-full py-2.5 bg-indigo-500 text-slate-955 hover:bg-indigo-650 text-xs font-extrabold rounded-xl uppercase tracking-wider flex items-center justify-center space-x-1"
                  >
                    <span>Apply Section Assignment</span>
                  </button>
                </Card>
              </div>

              {/* Table Allocator Matrix list */}
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold text-textPearl uppercase tracking-wider">Manual Dining Tables Assignment Grid</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {tables.map(table => (
                    <Card key={table.id} className="p-4 border-slate-850 bg-slate-950/20 text-xs space-y-3 text-left">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-textPearl">Table {table.number} ({table.section || 'Main Room'})</span>
                        <Badge variant={table.status === 'empty' ? 'success' : 'warning'}>{table.status}</Badge>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-bold">Assign Server:</label>
                        <select
                          value={table.assignedWaiterId || ''}
                          onChange={e => handleUpdateTableWaiter(table.id, e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-slate-350 outline-none"
                        >
                          <option value="">No waiter assigned</option>
                          {employees.filter(e => e.role === 'waiter').map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.displayName || emp.email}</option>
                          ))}
                        </select>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      ) : (
        <Card className="p-8 text-center border-[#E3DED5] bg-white rounded-3xl space-y-4 shadow-sm">
          <Award className="w-12 h-12 text-[#8D9B95] mx-auto" />
          <div>
            <h2 className="text-base font-extrabold text-[#18201D]">Shift System Offline</h2>
            <p className="text-xs text-[#5F6875] mt-1 font-medium">Please start your operational shift above to sync tables and operational tasks feed.</p>
          </div>
        </Card>
      )}

      {/* ─── Seating Guest Check-In Modal ─── */}
      <Modal
        isOpen={selectedTable !== null}
        onClose={() => setSelectedTable(null)}
        title={selectedTable ? `Seating Setup — Table ${selectedTable.number}` : ''}
      >
        {selectedTable && (
          <div className="space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">Number of Guests</label>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setGuestsCount(c => Math.max(1, c - 1))}
                  className="w-10 h-10 border border-slate-800 bg-slate-950 hover:bg-slate-900 rounded-xl text-lg font-bold flex items-center justify-center font-mono text-slate-200"
                >
                  -
                </button>
                <span className="text-xl font-bold font-mono px-4">{guestsCount}</span>
                <button
                  type="button"
                  onClick={() => setGuestsCount(c => Math.min(selectedTable.seatingCapacity + 4, c + 1))}
                  className="w-10 h-10 border border-slate-800 bg-slate-950 hover:bg-slate-900 rounded-xl text-lg font-bold flex items-center justify-center font-mono text-slate-205"
                >
                  +
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Table capacity is {selectedTable.seatingCapacity} guests.</p>
            </div>

            <div className="space-y-2">
              <Input
                label="Floor Section"
                value={tableSectionInput}
                onChange={e => setTableSectionInput(e.target.value)}
                placeholder="Main Room / Patio / Bar"
              />
            </div>

            <div className="space-y-2">
              <Input
                label="Special Seating Notes (VIP, Allergy, Kids)"
                value={tableNotesInput}
                onChange={e => setTableNotesInput(e.target.value)}
                placeholder="Allergy to nuts, VIP guest, Wheelchair space needed"
              />
            </div>

            <div className="flex gap-3 pt-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setSelectedTable(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary text-slate-955"
                onClick={handleOccupyTableCC}
              >
                Seat & Seize Table
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Add Quick Order Modal ─── */}
      <Modal
        isOpen={orderTable !== null}
        onClose={() => setOrderTable(null)}
        title={orderTable ? `Add Order — Table ${orderTable.number}` : ''}
      >
        {orderTable && (
          <div className="space-y-4 text-left max-h-[85vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Customer Name"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Ravi Kumar"
              />
              <Input
                label="Phone (optional)"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="9876543210"
              />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">Select Menu Items</span>
              <div className="max-h-48 overflow-y-auto border border-slate-850 rounded-xl bg-slate-950/20 divide-y divide-slate-855 p-2 space-y-1">
                {menuItems.map(item => {
                  const inCartCount = cart[item.id]?.count || 0;
                  return (
                    <div key={item.id} className="flex justify-between items-center py-2 px-1 text-xs">
                      <div>
                        <div className="font-bold text-textPearl">{item.name}</div>
                        <div className="text-[10px] text-slate-500">{formatPrice(item.price)} · {item.category}</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {inCartCount > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item)}
                              className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg font-bold"
                            >
                              -
                            </button>
                            <span className="font-bold font-mono text-sm min-w-[16px] text-center">{inCartCount}</span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => addToCart(item)}
                          className="p-1.5 bg-primary/10 border border-primary/20 text-primary rounded-lg font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {Object.keys(cart).length > 0 && (
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-2 text-xs">
                <span className="text-[10px] uppercase font-bold text-slate-550 tracking-wider">Selected Cart Summary</span>
                <div className="space-y-1">
                  {Object.values(cart).map(entry => (
                    <div key={entry.item.id} className="flex justify-between text-slate-400">
                      <span>{entry.item.name} ×{entry.count}</span>
                      <span>{formatPrice(entry.item.price * entry.count)}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-800/20 flex justify-between font-bold text-textPearl">
                  <span>Subtotal</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => { setOrderTable(null); setCart({}); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary text-slate-950"
                onClick={handlePlaceQuickOrder}
                disabled={Object.keys(cart).length === 0}
              >
                Submit Order
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Bill Invoice Checkout Modal ─── */}
      {/* ─── Canonical Authoritative Bill Modal ─── */}
      {selectedOrder && (
        <CanonicalBillModal
          isOpen={selectedOrder !== null}
          onClose={() => {
            setSelectedOrder(null);
            setDiscountPercent(0);
          }}
          tenantId={user?.tenantId || ''}
          orderId={selectedOrder.orderId}
          mode="waiter"
          restaurantName={(selectedOrder as any).restaurantName || 'Restaurant'}
          onPaymentSettled={() => {
            setSelectedOrder(null);
            setDiscountPercent(0);
          }}
        />
      )}

      {/* ─── Diner Satisfaction Rating Modal ─── */}
      <Modal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        title="Diner Seating Experience Review"
      >
        <div className="space-y-4 text-left max-h-[80vh] overflow-y-auto pr-1">
          <div className="space-y-2">
            <span className="text-xs text-slate-455 font-bold">How was the customer experience?</span>
            <div className="grid grid-cols-5 gap-2">
              {[
                { rating: 'Excellent', label: '😊 Excellent', color: 'border-emerald-500 text-emerald-450' },
                { rating: 'Good', label: '🙂 Good', color: 'border-blue-500 text-blue-450' },
                { rating: 'Neutral', label: '😐 Neutral', color: 'border-yellow-500 text-yellow-450' },
                { rating: 'Needs Attention', label: '☹ Warning', color: 'border-orange-500 text-orange-450' },
                { rating: 'Complaint', label: '😡 Complaint', color: 'border-red-500 text-red-500 animate-pulse' }
              ].map(opt => (
                <button
                  key={opt.rating}
                  type="button"
                  onClick={() => setFeedbackRating(opt.rating as any)}
                  className={`py-2 px-1 text-[10px] font-bold rounded-xl border transition-all text-center ${
                    feedbackRating === opt.rating
                      ? `${opt.color} bg-slate-955`
                      : 'border-slate-800 text-slate-400 hover:text-textPearl bg-slate-900/10'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional Expanded Structured Feedback Metrics */}
          <div className="pt-2 border-t border-slate-850/60 space-y-3">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase">Detailed Criteria Metrics (optional)</span>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Food Quality (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={foodQuality}
                  onChange={e => setFoodQuality(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-350 outline-none font-semibold text-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Service Speed (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={serviceSpeed}
                  onChange={e => setServiceSpeed(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-350 outline-none font-semibold text-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Cleanliness (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={cleanliness}
                  onChange={e => setCleanliness(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-350 outline-none font-semibold text-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Staff Behavior (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={staffBehavior}
                  onChange={e => setStaffBehavior(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-350 outline-none font-semibold text-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Waiting Time (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={waitingTime}
                  onChange={e => setWaitingTime(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-350 outline-none font-semibold text-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Ambience (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={ambience}
                  onChange={e => setAmbience(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-855 rounded-lg p-2 text-slate-350 outline-none font-semibold text-slate-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-450">Diner Type</label>
                <select
                  value={customerType}
                  onChange={e => setCustomerType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-350 outline-none text-slate-300 font-semibold"
                >
                  <option value="Solo">Solo diner</option>
                  <option value="Couple">Couple</option>
                  <option value="Family">Family</option>
                  <option value="Group">Group / Friends</option>
                  <option value="Business">Business meeting</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-455">Visit Occasion</label>
                <select
                  value={visitOccasion}
                  onChange={e => setVisitOccasion(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-850 rounded-lg p-2 text-slate-355 outline-none text-slate-300 font-semibold"
                >
                  <option value="Casual">Casual Dining</option>
                  <option value="Birthday">Birthday celebration</option>
                  <option value="Date">Date night</option>
                  <option value="Celebration">Anniversary / Feast</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Input
              label="Optional Context Notes (Allergy, Delay, Compliments)"
              value={feedbackNotes}
              onChange={e => setFeedbackNotes(e.target.value)}
              placeholder="Food arrived quickly, diner highly satisfied"
            />
          </div>

          <div className="flex items-center space-x-2.5">
            <input
              id="repeatCustomerCheck"
              type="checkbox"
              checked={isRepeatCustomer}
              onChange={e => setIsRepeatCustomer(e.target.checked)}
              className="w-4 h-4 bg-slate-955 border border-slate-850 rounded text-primary focus:ring-0 cursor-pointer"
            />
            <label htmlFor="repeatCustomerCheck" className="text-xs text-slate-400 cursor-pointer select-none">
              Mark guest as a Repeat Customer
            </label>
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-850/60">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowFeedbackModal(false)}
            >
              Back
            </Button>
            <Button
              className="flex-1 bg-emerald-500 text-slate-955 hover:bg-emerald-600 font-extrabold"
              onClick={handleSubmitFeedback}
              isLoading={isUpdatingBill}
            >
              Submit & Clear Table
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Shift Handover Modal ─── */}
      <Modal
        isOpen={showHandoverModal}
        onClose={() => setShowHandoverModal(false)}
        title="Shift Handover Summary"
      >
        <div className="space-y-4 text-left">
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-start space-x-3">
            <AlertOctagon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-xs text-textPearl">Active Floor Tasks Block</strong>
              <p className="text-[11px] text-slate-400">
                You cannot end your shift with pending floor allocations. Please transfer active tasks to another on-duty server to clock out.
              </p>
            </div>
          </div>

          {/* Pending work snapshots */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-955/40 p-4 rounded-xl border border-slate-850">
            <div>
              <span className="text-slate-550">Assigned Tables:</span>
              <span className="font-bold text-textPearl float-right">{tables.filter(t => t.assignedWaiterId === user?.uid && t.status !== 'empty').length}</span>
            </div>
            <div>
              <span className="text-slate-550">Kitchen Ready:</span>
              <span className="font-bold text-textPearl float-right">{orders.filter(o => o.waiterId === user?.uid && o.status === 'READY').length}</span>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-900 flex justify-between">
              <span className="text-slate-550">Pending Diner Alerts:</span>
              <span className="font-bold text-textPearl">
                {waiterRequests.filter(r => {
                  const tableObj = tables.find(t => t.number === r.tableNumber);
                  const isInactive = ['completed', 'cancelled', 'rejected'].includes((r.status || '').toLowerCase());
                  return tableObj?.assignedWaiterId === user?.uid && !isInactive;
                }).length}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400">Select Receiving Waiter</label>
            <select
              value={handoverRecipientId}
              onChange={e => setHandoverRecipientId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-350 outline-none text-slate-300 font-semibold"
            >
              <option value="">Choose waiter on shift...</option>
              {employees.filter(e => e.role === 'waiter' && e.id !== user?.uid).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.displayName || emp.email}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Input
              label="Handover Context/Reason"
              value={handoverReason}
              onChange={e => setHandoverReason(e.target.value)}
              placeholder="Handover due to shift end"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-855">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowHandoverModal(false)}
              disabled={isSubmittingHandover}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary text-slate-955 hover:bg-primary-hover font-extrabold flex items-center justify-center space-x-1"
              onClick={handleInitiateHandover}
              isLoading={isSubmittingHandover}
              disabled={!handoverRecipientId}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Initiate Handover</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WaiterMatrix;
