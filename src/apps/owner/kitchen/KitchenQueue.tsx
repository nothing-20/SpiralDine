/**
 * KitchenQueue — Main Kitchen Display System orchestrator.
 *
 * Architecture:
 * - Single Firestore onSnapshot listener for all orders (no duplicate reads)
 * - All metrics, filters, and groupings derived in-memory via useMemo
 * - Bulk writes use writeBatch (up to 500 docs per commit)
 * - Timeline events appended with arrayUnion (conflict-safe)
 * - 5 tab views share the same allOrders state (including Cooking Queue)
 */
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  arrayUnion,
  query,
  where,
  getDoc,
  addDoc
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { logEvent } from '../../../services/eventEngine';
import { ITimelineEvent } from '../../../types';

// Sub-components
import KitchenStatsBar from './KitchenStatsBar';
import KitchenInsightsPanel from './KitchenInsightsPanel';
import BulkActionsToolbar from './BulkActionsToolbar';
import KitchenTicket from './KitchenTicket';
import OrderTimeline from './OrderTimeline';
import { inventoryService } from '../../../shared/services/inventoryService';
import { isKitchenStaffRole, filterKitchenStaff } from '../../../shared/services/kitchenService';
import LivePreparedInventory from './LivePreparedInventory';

// Enterprise Panels
import ChefAvailabilityPanel from './ChefAvailabilityPanel';
import IngredientAlertsPanel from './IngredientAlertsPanel';
import KitchenAnnouncementsPanel from './KitchenAnnouncementsPanel';
import ShiftManagementPanel from './ShiftManagementPanel';
import KitchenLoadMeter from './KitchenLoadMeter';
import SmartBatchPrediction from './SmartBatchPrediction';

// UI Kit
import Card from '../../../components/ui/Card/Card';
import Select from '../../../components/ui/Select/Select';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import Badge from '../../../components/ui/Badge/Badge';

import toast from 'react-hot-toast';
import {
  UtensilsCrossed,
  LayoutGrid,
  Layers,
  ListOrdered,
  CheckCircle2,
  Flame,
  Coffee,
  Pizza,
  IceCream,
  Package,
  Search,
  SlidersHorizontal,
  Check,
  ChefHat,
  Zap,
  AlertTriangle,
  X,
  History,
  Activity,
  Calendar,
} from 'lucide-react';

// KDS-specific types & utilities
import {
  TKdsTab,
  TOrderStatus,
  TPriority,
  IKdsOrder,
  IBulkConfirmDialog,
} from '../../../features/kitchen-dashboard/types';
import {
  calcKitchenMetrics,
  ACTIVE_STATUSES,
  getElapsedMinutes,
  calculateSmartPriority,
} from '../../../features/kitchen-dashboard/utils/kitchenMetrics';
import { STATUS_CONFIG } from './KitchenTicket';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STATIONS = ['Grill', 'Main Kitchen', 'Pizza', 'Chinese', 'Drinks', 'Dessert', 'Packing'];

const STATION_ICONS: Record<string, React.ReactNode> = {
  'Grill':        <Flame className="w-4 h-4 text-orange-400" />,
  'Main Kitchen': <ChefHat className="w-4 h-4 text-yellow-400" />,
  'Pizza':        <Pizza className="w-4 h-4 text-red-400" />,
  'Chinese':      <UtensilsCrossed className="w-4 h-4 text-green-400" />,
  'Drinks':       <Coffee className="w-4 h-4 text-blue-400" />,
  'Dessert':      <IceCream className="w-4 h-4 text-pink-400" />,
  'Packing':      <Package className="w-4 h-4 text-slate-400" />,
};

const TIMELINE_TITLES: Record<string, string> = {
  NEW:       'Order Created',
  PLACED:    'Order Placed',
  ACCEPTED:  'Kitchen Accepted',
  PREPARING: 'Preparation Started',
  READY:     'Marked Ready',
  DELIVERED: 'Delivered to Table',
  COMPLETED: 'Order Completed',
  ARCHIVED:  'Order Archived',
  CANCELLED: 'Order Cancelled',
  PAUSED:    'Cooking Paused',
  RESUMED:   'Cooking Resumed',
  RECALLED:  'Returned to Preparing',
};

const inferStation = (category: string): string => {
  const map: Record<string, string> = {
    Starters: 'Grill',
    'Main Course': 'Main Kitchen',
    Pizza: 'Pizza',
    Burgers: 'Grill',
    Beverages: 'Drinks',
    Desserts: 'Dessert',
  };
  return map[category] || 'Main Kitchen';
};

const normalizeStatus = (status: string): TOrderStatus => {
  if (status === 'PLACED') return 'NEW';
  return status as TOrderStatus;
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const KitchenQueue: React.FC = () => {
  const { user } = useAuth();

  // ── Core Data State ───────────────────────────────────────────────────────
  const [allOrders, setAllOrders] = useState<IKdsOrder[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── View State ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TKdsTab>('table');
  const [showFilters, setShowFilters] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  // ── Filter State ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [stationFilter, setStationFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('arrival');
  const [showDelayedOnly, setShowDelayedOnly] = useState(false);
  const [targetPrepMinutes, setTargetPrepMinutes] = useState(15);

  // ── Bulk Selection State ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<IBulkConfirmDialog>({
    isOpen: false,
    action: '',
    nextStatus: 'ACCEPTED',
    count: 0,
  });

  // ── Peak Queue Tracking (session watermark) ───────────────────────────────
  const [peakQueue, setPeakQueue] = useState(0);
  const [reservations, setReservations] = useState<any[]>([]);

  // ── Live Clock Ticker for Header ──────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Realtime Reservations subscription for KDS Reservation Feed ───────────
  useEffect(() => {
    if (!user?.tenantId) return;
    const colRef = collection(db, 'restaurants', user.tenantId, 'reservations');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setReservations(list);
    }, (err) => {
      console.error('KDS Reservations subscription error:', err);
    });
    return () => unsubscribe();
  }, [user?.tenantId]);

  // ── Single Firestore Listener for Orders ──────────────────────────────────
  useEffect(() => {
    if (!user?.tenantId) return;

    setIsLoading(true);
    const colRef = collection(db, 'restaurants', user.tenantId, 'orders');

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: IKdsOrder[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as IKdsOrder);
        });
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const newOrders = list.filter(o => o.status === 'NEW' || o.status === 'PLACED');
        if (newOrders.length > 0) {
          console.log('[STEP 8] Kitchen listener received order(s)', newOrders.map(o => o.id));
        }
        setAllOrders(list);
        const activeNow = list.filter(o => ACTIVE_STATUSES.includes(o.status as TOrderStatus)).length;
        setPeakQueue(prev => Math.max(prev, activeNow));
        setIsLoading(false);
      },
      (error) => {
        console.error('KDS onSnapshot error:', error);
        toast.error('Real-time order stream disconnected.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // ── Realtime Listener for Restaurant Staff Employees ──────────────────────
  useEffect(() => {
    if (!user?.tenantId) return;

    const colRef = collection(db, 'employees');
    const q = query(
      colRef,
      where('tenantId', '==', user.tenantId),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setEmployees(list);
      },
      (error) => {
        console.error('Error fetching employees:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // ── Realtime Listener for Menu Items (Batch Portions Tracking) ─────────────
  useEffect(() => {
    if (!user?.tenantId) return;

    const colRef = collection(db, 'restaurants', user.tenantId, 'menu', 'default', 'items');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setMenuItems(list);
      },
      (error) => {
        console.error('Error fetching menu items:', error);
      }
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // ── Metrics (memoized — recalc only when orders or config change) ─────────
  const metrics = useMemo(
    () => calcKitchenMetrics(allOrders, targetPrepMinutes, targetPrepMinutes, peakQueue),
    [allOrders, targetPrepMinutes, peakQueue]
  );

  // ── Derived Category List (for filter dropdown) ───────────────────────────
  const allCategories = useMemo(
    () =>
      Array.from(
        new Set(allOrders.flatMap(o => o.items.map(i => (i as any).category || 'Uncategorized')))
      ).sort(),
    [allOrders]
  );

  // ── Filtered + Sorted Orders (memoized) ───────────────────────────────────
  const filteredOrders = useMemo((): IKdsOrder[] => {
    let filtered = [...allOrders];

    // Status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(o => ACTIVE_STATUSES.includes(o.status as TOrderStatus));
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(o => normalizeStatus(o.status) === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(o => calculateSmartPriority(o) === priorityFilter);
    }

    // Delayed only
    if (showDelayedOnly) {
      filtered = filtered.filter(o => getElapsedMinutes(o.createdAt) > targetPrepMinutes);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(o =>
        o.tableNumber?.toLowerCase().includes(q) ||
        o.orderId?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q) ||
        o.items.some(item => item.name.toLowerCase().includes(q))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'arrival':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'table':
          return a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true });
        case 'prep':
          return (
            (a.estimatedPrepTime || a.items.length * 5) -
            (b.estimatedPrepTime || b.items.length * 5)
          );
        case 'priority': {
          const pOrder = { critical: 0, high: 1, normal: 2, low: 3 };
          return (
            pOrder[calculateSmartPriority(a)] -
            pOrder[calculateSmartPriority(b)]
          );
        }
        case 'elapsed':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [allOrders, statusFilter, priorityFilter, searchQuery, sortBy, showDelayedOnly, targetPrepMinutes]);

  // ── Cooking Queue Derivation ──────────────────────────────────────────────
  const queueOrders = useMemo((): IKdsOrder[] => {
    const activeQueue = allOrders.filter(o =>
      ['NEW', 'PLACED', 'ACCEPTED', 'PREPARING', 'PAUSED'].includes(o.status)
    );

    activeQueue.sort((a, b) => {
      const aOrder = a.queueOrder !== undefined ? a.queueOrder : Number.MAX_SAFE_INTEGER;
      const bOrder = b.queueOrder !== undefined ? b.queueOrder : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return activeQueue;
  }, [allOrders]);

  const queueWithTimings = useMemo(() => {
    let cumulativeMinutes = 0;
    const nowMs = Date.now();

    return queueOrders.map(order => {
      const prepMinutes = order.estimatedPrepTime || order.items.length * 5;
      const startMs = nowMs + cumulativeMinutes * 60000;
      const finishMs = startMs + prepMinutes * 60000;
      cumulativeMinutes += prepMinutes;

      return {
        ...order,
        estimatedStartStr: new Date(startMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        estimatedFinishStr: new Date(finishMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      };
    });
  }, [queueOrders]);

  // ── Selection Helpers ─────────────────────────────────────────────────────
  const toggleSelectOrder = useCallback((orderId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredOrders.map(o => o.orderId)));
  }, [filteredOrders]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allSelected = selectedIds.size === filteredOrders.length && filteredOrders.length > 0;

  // Local portion deductions are automated via background transaction listener

  const handlePrepareBatch = async (item: any, size?: number) => {
    if (!user?.tenantId) return;
    const batchSize = size !== undefined ? size : (item.defaultBatchSize || 50);
    
    // First validate ingredients and deduct from stock using inventoryService transaction
    await inventoryService.deductIngredientsForBatch(user.tenantId, item.id, batchSize);

    // If validation passed, increment available servings
    const docRef = doc(db, 'restaurants', user.tenantId, 'menu', 'default', 'items', item.id);
    const currentServings = Number(item.availableServings ?? 0);
    const newServings = currentServings + batchSize;
    
    await updateDoc(docRef, {
      availableServings: newServings,
      isAvailable: true,
      available: true,
      lastPreparedAt: new Date().toISOString(),
      lastPreparedBy: user.displayName || user.email || 'Kitchen Chef',
      updatedAt: new Date().toISOString()
    });

    // Save history document
    await addDoc(collection(db, 'restaurants', user.tenantId, 'preparedBatchesHistory'), {
      itemId: item.id,
      itemName: item.name,
      portionsAdded: batchSize,
      timestamp: new Date().toISOString(),
      preparedBy: user.displayName || user.email || 'Kitchen Chef'
    });

    await logEvent(user.tenantId, {
      eventType: 'Batch Prepared',
      eventCategory: 'Operational',
      performedBy: user.displayName || user.email || 'Kitchen Chef',
      performedByRole: 'kitchen',
      title: 'New Prepared Batch Cooked',
      description: `Prepared new batch of "${item.name}" adding ${batchSize} portions. Required ingredients deducted from stock.`,
      metadata: { itemId: item.id, batchSize, availableServings: newServings }
    });

    toast.success(`Prepared new batch of ${batchSize} portions for ${item.name}!`);
  };

  // ── Single Status Update (with timeline append) ───────────────────────────
  const handleStatusUpdate = useCallback(
    async (orderId: string, nextStatus: string) => {
      if (!user?.tenantId) return;
      try {
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
        const timestamp = new Date().toISOString();
        const timelineEvent: ITimelineEvent = {
          type: nextStatus as ITimelineEvent['type'],
          title: TIMELINE_TITLES[nextStatus] || nextStatus,
          timestamp,
          performedBy: user?.displayName || 'Kitchen Staff',
        };
        const updateFields: any = {
          status: nextStatus,
          updatedAt: timestamp,
          timeline: arrayUnion(timelineEvent),
        };

        if (nextStatus === 'ACCEPTED') updateFields.acceptedAt = timestamp;
        if (nextStatus === 'CHEF_ASSIGNED') updateFields.chefAssignedAt = timestamp;
        if (nextStatus === 'PREPARING') updateFields.cookingStartedAt = timestamp;
        if (nextStatus === 'READY') updateFields.readyAt = timestamp;
        if (nextStatus === 'PICKED_UP' || nextStatus === 'DELIVERED') updateFields.pickupAt = timestamp;
        if (nextStatus === 'SERVED') updateFields.servedAt = timestamp;
        if (nextStatus === 'COMPLETED') updateFields.completedAt = timestamp;
        if (nextStatus === 'PAID') updateFields.paymentAt = timestamp;

        await updateDoc(docRef, updateFields);

        // Portion deduction automated on status PREPARING / COMPLETED
        toast.success(`Order → ${TIMELINE_TITLES[nextStatus] || nextStatus}`, {
          id: `status-${orderId}`,
        });

        const eventTypeMap: Record<string, string> = {
          'ACCEPTED': 'Kitchen Accepted',
          'PREPARING': 'Preparation Started',
          'READY': 'Order Ready',
          'DELIVERED': 'Order Delivered',
          'COMPLETED': 'Payment Completed',
        };
        const mappedType = eventTypeMap[nextStatus] || `Order ${nextStatus}`;
        logEvent(user.tenantId, {
          eventType: mappedType,
          eventCategory: nextStatus === 'COMPLETED' ? 'Payment' : 'Kitchen',
          performedBy: user?.displayName || 'Kitchen Staff',
          performedByRole: user?.role || 'kitchen',
          orderId,
          title: mappedType,
          description: `Order #${orderId.substring(0, 8)} status advanced to ${nextStatus}.`
        });
      } catch (e) {
        console.error('Status update failed:', e);
        toast.error('Failed to update order status. Check network connection.');
      }
    },
    [user?.tenantId, user?.displayName, user?.role]
  );

  // ── Bulk Status Update (writeBatch + arrayUnion) ──────────────────────────
  const handleBulkStatusUpdate = useCallback(
    async (nextStatus: string) => {
      if (!user?.tenantId || selectedIds.size === 0) return;

      setBulkDialog({ isOpen: false, action: '', nextStatus: 'ACCEPTED', count: 0 });

      const toastId = toast.loading(
        `Updating ${selectedIds.size} order${selectedIds.size > 1 ? 's' : ''}...`
      );
      try {
        const batch = writeBatch(db);
        const timestamp = new Date().toISOString();

        for (const orderId of Array.from(selectedIds)) {
          const ref = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
          const timelineEvent: ITimelineEvent = {
            type: nextStatus as ITimelineEvent['type'],
            title: TIMELINE_TITLES[nextStatus] || nextStatus,
            timestamp,
            performedBy: `${user?.displayName || 'Kitchen Staff'} (Bulk)`,
            description: `Bulk operation — ${selectedIds.size} orders`,
          };
          const updateFields: any = {
            status: nextStatus,
            updatedAt: timestamp,
            timeline: arrayUnion(timelineEvent),
          };

          if (nextStatus === 'ACCEPTED') updateFields.acceptedAt = timestamp;
          if (nextStatus === 'CHEF_ASSIGNED') updateFields.chefAssignedAt = timestamp;
          if (nextStatus === 'PREPARING') updateFields.cookingStartedAt = timestamp;
          if (nextStatus === 'READY') updateFields.readyAt = timestamp;
          if (nextStatus === 'PICKED_UP' || nextStatus === 'DELIVERED') updateFields.pickupAt = timestamp;
          if (nextStatus === 'SERVED') updateFields.servedAt = timestamp;
          if (nextStatus === 'COMPLETED') updateFields.completedAt = timestamp;
          if (nextStatus === 'PAID') updateFields.paymentAt = timestamp;

          batch.update(ref, updateFields);
        }

        await batch.commit();

        // Portion deduction automated on status PREPARING / COMPLETED
        toast.success(
          `${selectedIds.size} orders → ${TIMELINE_TITLES[nextStatus] || nextStatus}`,
          { id: toastId }
        );

        const eventTypeMap: Record<string, string> = {
          'ACCEPTED': 'Kitchen Accepted',
          'PREPARING': 'Preparation Started',
          'READY': 'Order Ready',
          'DELIVERED': 'Order Delivered',
          'COMPLETED': 'Payment Completed',
        };
        const mappedType = eventTypeMap[nextStatus] || `Order ${nextStatus}`;
        Array.from(selectedIds).forEach(orderId => {
          logEvent(user.tenantId || '', {
            eventType: mappedType,
            eventCategory: nextStatus === 'COMPLETED' ? 'Payment' : 'Kitchen',
            performedBy: `${user?.displayName || 'Kitchen Staff'} (Bulk)`,
            performedByRole: user?.role || 'kitchen',
            orderId,
            title: `Bulk ${mappedType}`,
            description: `Order #${orderId.substring(0, 8)} bulk-updated to ${nextStatus}.`
          });
        });

        setSelectedIds(new Set());
      } catch (e) {
        console.error('Batch update failed:', e);
        toast.error('Batch update failed. Please retry.', { id: toastId });
      }
    },
    [user?.tenantId, user?.displayName, user?.role, selectedIds]
  );

  // ── Chef Assignment Action handlers ──────────────────────────────────────
  const handleAssignChef = useCallback(
    async (orderId: string, chefId: string, chefName: string) => {
      if (!user?.tenantId) return;

      // Backend role guard: verify target staff is authorized for kitchen operations
      const targetStaff = employees.find(emp => emp.id === chefId);
      if (targetStaff && !isKitchenStaffRole(targetStaff.role)) {
        toast.error(`Cannot assign order: ${targetStaff.fullName || 'Selected staff member'} is not authorized for kitchen work.`);
        return;
      }

      try {
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
        const timelineEvent: ITimelineEvent = {
          type: 'ACCEPTED',
          title: 'Chef Assigned',
          description: `Assigned to ${chefName}`,
          performedBy: user?.displayName || 'Kitchen Manager',
          timestamp: new Date().toISOString(),
        };
        await updateDoc(docRef, {
          assignedChefId: chefId,
          assignedChefName: chefName,
          assignedAt: new Date().toISOString(),
          assignedBy: user?.displayName || 'Kitchen Manager',
          timeline: arrayUnion(timelineEvent),
        });
        toast.success(`Chef ${chefName} assigned to order.`);

        logEvent(user.tenantId, {
          eventType: 'Task Assigned',
          eventCategory: 'Kitchen',
          performedBy: user?.displayName || 'Kitchen Manager',
          performedByRole: user?.role || 'kitchen',
          orderId,
          title: 'Chef Assigned',
          description: `Order #${orderId.substring(0, 8)} assigned to chef ${chefName}.`
        });
      } catch (e) {
        console.error('Failed to assign chef:', e);
        toast.error('Failed to assign chef.');
      }
    },
    [user?.tenantId, user?.displayName, user?.role, employees]
  );

  const handleUnassignChef = useCallback(
    async (orderId: string) => {
      if (!user?.tenantId) return;
      try {
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
        await updateDoc(docRef, {
          assignedChefId: '',
          assignedChefName: '',
          assignedAt: '',
          assignedBy: '',
        });
        toast.success('Chef assignment cleared.');

        logEvent(user.tenantId, {
          eventType: 'Chef Unassigned',
          eventCategory: 'Kitchen',
          performedBy: user?.displayName || 'Kitchen Manager',
          performedByRole: user?.role || 'kitchen',
          orderId,
          title: 'Chef Unassigned',
          description: `Chef unassigned from order #${orderId.substring(0, 8)}.`
        });
      } catch (e) {
        console.error('Failed to unassign chef:', e);
        toast.error('Failed to clear chef.');
      }
    },
    [user?.tenantId, user?.displayName, user?.role]
  );

  // ── Pause / Resume Action handlers ───────────────────────────────────────
  const handlePauseOrder = useCallback(
    async (orderId: string, reason: string) => {
      if (!user?.tenantId) return;
      try {
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
        const timestamp = new Date().toISOString();
        const timelineEvent: ITimelineEvent = {
          type: 'PAUSED',
          title: 'Cooking Paused',
          description: `Reason: ${reason}`,
          performedBy: user?.displayName || 'Kitchen Staff',
          timestamp,
        };
        await updateDoc(docRef, {
          status: 'PAUSED',
          pauseReason: reason,
          pausedAt: timestamp,
          pausedBy: user?.displayName || 'Kitchen Staff',
          timeline: arrayUnion(timelineEvent),
        });
        toast.success('Cooking paused.');

        logEvent(user.tenantId, {
          eventType: 'Preparation Paused',
          eventCategory: 'Kitchen',
          performedBy: user?.displayName || 'Kitchen Staff',
          performedByRole: user?.role || 'kitchen',
          orderId,
          title: 'Cooking Paused',
          description: `Order #${orderId.substring(0, 8)} preparation paused. Reason: ${reason}`
        });
      } catch (e) {
        console.error('Failed to pause order:', e);
        toast.error('Failed to pause order.');
      }
    },
    [user?.tenantId, user?.displayName, user?.role]
  );

  const handleResumeOrder = useCallback(
    async (orderId: string) => {
      if (!user?.tenantId) return;
      try {
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
        const timestamp = new Date().toISOString();
        const timelineEvent: ITimelineEvent = {
          type: 'RESUMED',
          title: 'Cooking Resumed',
          performedBy: user?.displayName || 'Kitchen Staff',
          timestamp,
        };
        await updateDoc(docRef, {
          status: 'PREPARING',
          resumedAt: timestamp,
          timeline: arrayUnion(timelineEvent),
        });
        toast.success('Cooking resumed.');

        logEvent(user.tenantId, {
          eventType: 'Preparation Started',
          eventCategory: 'Kitchen',
          performedBy: user?.displayName || 'Kitchen Staff',
          performedByRole: user?.role || 'kitchen',
          orderId,
          title: 'Cooking Resumed',
          description: `Order #${orderId.substring(0, 8)} cooking resumed.`
        });
      } catch (e) {
        console.error('Failed to resume order:', e);
        toast.error('Failed to resume order.');
      }
    },
    [user?.tenantId, user?.displayName, user?.role]
  );

  // ── Recall Ready Order Action handler ────────────────────────────────────
  const handleRecallOrder = useCallback(
    async (orderId: string, reason: string) => {
      if (!user?.tenantId) return;
      try {
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
        const timestamp = new Date().toISOString();
        const timelineEvent: ITimelineEvent = {
          type: 'RECALLED',
          title: 'Returned to Preparing',
          description: `Reason: ${reason}`,
          performedBy: user?.displayName || 'Kitchen Staff',
          timestamp,
        };
        await updateDoc(docRef, {
          status: 'PREPARING',
          recallReason: reason,
          recalledAt: timestamp,
          recalledBy: user?.displayName || 'Kitchen Staff',
          timeline: arrayUnion(timelineEvent),
        });
        toast.success('Order recalled back to Preparing state.');

        logEvent(user.tenantId, {
          eventType: 'Order Recalled',
          eventCategory: 'Kitchen',
          performedBy: user?.displayName || 'Kitchen Staff',
          performedByRole: user?.role || 'kitchen',
          orderId,
          title: 'Order Recalled',
          description: `Order #${orderId.substring(0, 8)} recalled to Preparing. Reason: ${reason}`
        });
      } catch (e) {
        console.error('Failed to recall order:', e);
        toast.error('Failed to recall order.');
      }
    },
    [user?.tenantId, user?.displayName, user?.role]
  );

  // ── Kitchen / Chef Notes Action handler ──────────────────────────────────
  const handleUpdateNotes = useCallback(
    async (orderId: string, noteType: 'kitchen' | 'chef', noteValue: string) => {
      if (!user?.tenantId) return;
      try {
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
        const updateField = noteType === 'kitchen' ? { kitchenNotes: noteValue } : { chefNotes: noteValue };
        await updateDoc(docRef, updateField);
        toast.success('Note updated.');
      } catch (e) {
        console.error('Failed to update notes:', e);
        toast.error('Failed to update note.');
      }
    },
    [user?.tenantId]
  );

  // ── Manual Priority Override Action handler ──────────────────────────────
  const handleUpdatePriority = useCallback(
    async (orderId: string, priority: TPriority) => {
      if (!user?.tenantId) return;
      try {
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
        await updateDoc(docRef, {
          priority,
          priorityOverride: true,
        });
        toast.success(`Priority set to ${priority}.`);
      } catch (e) {
        console.error('Failed to set priority:', e);
        toast.error('Failed to set priority.');
      }
    },
    [user?.tenantId]
  );

  // ── Reorder Queue Positions Action handler ────────────────────────────────
  const handleMoveQueue = useCallback(
    async (index: number, direction: 'up' | 'down') => {
      if (!user?.tenantId || queueOrders.length === 0) return;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= queueOrders.length) return;

      try {
        const batch = writeBatch(db);
        queueOrders.forEach((order, idx) => {
          const ref = doc(db, 'restaurants', user.tenantId, 'orders', order.orderId);
          let finalPos = idx;
          if (idx === index) {
            finalPos = targetIndex;
          } else if (idx === targetIndex) {
            finalPos = index;
          }
          batch.update(ref, { queueOrder: finalPos });
        });
        await batch.commit();
        toast.success('Queue order re-arranged.');
      } catch (e) {
        console.error('Queue move error:', e);
        toast.error('Failed to change queue position.');
      }
    },
    [user?.tenantId, queueOrders]
  );

  // ── Auto-Sort Queue by priority weights ──────────────────────────────────
  const handleAutoSortQueue = useCallback(async () => {
    if (!user?.tenantId || queueOrders.length === 0) return;

    const toastId = toast.loading('Sorting queue by smart priority...');
    try {
      const sorted = [...queueOrders].sort((a, b) => {
        const aPrio = calculateSmartPriority(a);
        const bPrio = calculateSmartPriority(b);

        const weight = { critical: 0, high: 1, normal: 2, low: 3 };
        const aW = weight[aPrio];
        const bW = weight[bPrio];

        if (aW !== bW) return aW - bW;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      const batch = writeBatch(db);
      sorted.forEach((order, idx) => {
        const ref = doc(db, 'restaurants', user.tenantId, 'orders', order.orderId);
        batch.update(ref, { queueOrder: idx });
      });

      await batch.commit();
      toast.success('Queue sorted successfully!', { id: toastId });
    } catch (e) {
      console.error('Auto sort queue error:', e);
      toast.error('Auto-sort failed.', { id: toastId });
    }
  }, [user?.tenantId, queueOrders]);

  // ── Bulk Action Request (shows confirm dialog) ────────────────────────────
  const handleBulkActionRequest = useCallback(
    (nextStatus: string, label: string) => {
      if (selectedIds.size === 0) return;
      setBulkDialog({
        isOpen: true,
        action: label,
        nextStatus: nextStatus as TOrderStatus,
        count: selectedIds.size,
      });
    },
    [selectedIds]
  );

  // ── Tab Counts ────────────────────────────────────────────────────────────
  const newCount = useMemo(
    () => allOrders.filter(o => o.status === 'NEW' || o.status === 'PLACED').length,
    [allOrders]
  );
  const prepCount = useMemo(
    () => allOrders.filter(o => o.status === 'PREPARING').length,
    [allOrders]
  );
  const readyCount = useMemo(
    () => allOrders.filter(o => o.status === 'READY').length,
    [allOrders]
  );

  // ─── Tab View Renderers ─────────────────────────────────────────────────────

  const renderReservationsView = () => {
    if (reservations.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-850 rounded-3xl">
          <Calendar className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-sm font-semibold">No reservations scheduled today.</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {reservations.map((res) => (
          <Card key={res.id} className="p-4 border-slate-855 bg-slate-900/35 rounded-2xl space-y-3 text-xs text-left">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-extrabold text-sm text-textPearl">{res.customerName}</h4>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Ref: {res.id}</p>
              </div>
              <Badge variant={res.status === 'Confirmed' ? 'success' : res.status === 'Pending' ? 'warning' : 'muted'} className="text-[8px] py-0.5 uppercase font-bold">
                {res.status}
              </Badge>
            </div>
            <div className="space-y-1 text-[11px] text-slate-400">
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span className="font-bold text-white">{res.date} @ {res.time}</span>
              </div>
              <div className="flex justify-between">
                <span>Party Size:</span>
                <span className="font-semibold text-slate-300">{res.guests} Guests</span>
              </div>
              {res.seatingPreference && (
                <div className="flex justify-between">
                  <span>Zone Req:</span>
                  <span className="text-primary font-bold">{res.seatingPreference}</span>
                </div>
              )}
              {res.specialNotes && (
                <div className="flex flex-col gap-0.5 border-t border-slate-850/60 pt-1.5 mt-1.5">
                  <span className="text-[9.5px] uppercase font-bold text-slate-500">Special Notes:</span>
                  <span className="text-slate-350 italic">"{res.specialNotes}"</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderPreparedInventoryView = () => {
    return <LivePreparedInventory menuItems={menuItems} onPrepareBatch={handlePrepareBatch} />;
  };

  const renderTableView = () => {
    const showBulkSelect = true;

    if (filteredOrders.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-850 rounded-3xl">
          <CheckCircle2 className="w-10 h-10 text-slate-700 mb-3" />
          <p className="text-sm font-semibold">Kitchen is all clear. No active tickets.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredOrders.map(order => (
          <KitchenTicket
            key={order.orderId}
            order={order}
            isSelected={selectedIds.has(order.orderId)}
            onToggleSelect={toggleSelectOrder}
            onStatusUpdate={handleStatusUpdate}
            showBulkSelect={showBulkSelect}
            employees={employees}
            onAssignChef={handleAssignChef}
            onUnassignChef={handleUnassignChef}
            onPauseOrder={handlePauseOrder}
            onResumeOrder={handleResumeOrder}
            onRecallOrder={handleRecallOrder}
            onUpdateNotes={handleUpdateNotes}
            onUpdatePriority={handleUpdatePriority}
            menuItems={menuItems}
          />
        ))}
      </div>
    );
  };

  const renderCategoryView = () => {
    const categoryMap: Record<
      string,
      Array<{ item: any; tableNumber: string; orderId: string }>
    > = {};

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const cat = (item as any).category || 'Other';
        if (!categoryMap[cat]) categoryMap[cat] = [];
        categoryMap[cat].push({ item, tableNumber: order.tableNumber, orderId: order.orderId });
      });
    });

    const cats = Object.entries(categoryMap).filter(
      ([cat]) => categoryFilter === 'all' || cat === categoryFilter
    );

    if (cats.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-[#6F746F] border border-dashed border-[#E3DED5] rounded-xl bg-white">
          <LayoutGrid className="w-10 h-10 text-[#6F746F]/40 mb-3" />
          <p className="text-sm font-semibold">No items match the selected category filters.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cats.map(([cat, entries]) => (
          <div key={cat} className="bg-white border border-[#E3DED5] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(30,30,20,0.05)]">
            <div className="px-4 py-3 bg-[#F7F4EE] border-b border-[#E3DED5] flex items-center space-x-2">
              <UtensilsCrossed className="w-3.5 h-3.5 text-[#C84A38]" />
              <span className="text-xs font-bold text-[#18201D] uppercase tracking-wider">{cat}</span>
              <span className="ml-auto text-[10px] font-bold bg-white border border-[#E3DED5] px-2 py-0.5 rounded-full text-[#6F746F]">
                {entries.reduce((s, e) => s + e.item.count, 0)} items
              </span>
            </div>
            <div className="p-3 space-y-2">
              {entries.map((entry, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs bg-[#F7F4EE]/60 border border-[#E3DED5]/60 px-3 py-2 rounded-lg">
                  <div>
                    <span className="font-bold text-[#18201D]">×{entry.item.count}</span>
                    <span className="ml-2 text-[#18201D] font-medium">{entry.item.name}</span>
                    {entry.item.notes && (
                      <span className="ml-1.5 text-[#D79A24] italic text-[10px]">"{entry.item.notes}"</span>
                    )}
                  </div>
                  <span className="text-[10px] font-extrabold text-[#C84A38]">T{entry.tableNumber}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStationView = () => {
    const stationMap: Record<
      string,
      Array<{ item: any; tableNumber: string; orderId: string; status: string }>
    > = {};

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        const rawItem = item as any;
        const station = rawItem.station || inferStation(rawItem.category || '');
        if (!stationMap[station]) stationMap[station] = [];
        stationMap[station].push({
          item,
          tableNumber: order.tableNumber,
          orderId: order.orderId,
          status: order.status,
        });
      });
    });

    const stationsToShow =
      stationFilter !== 'all'
        ? Object.entries(stationMap).filter(([s]) => s === stationFilter)
        : Object.entries(stationMap);

    if (stationsToShow.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-[#6F746F] border border-dashed border-[#E3DED5] rounded-xl bg-white">
          <Layers className="w-10 h-10 text-[#6F746F]/40 mb-3" />
          <p className="text-sm font-semibold">No items at the selected stations.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {stationsToShow.map(([station, entries]) => {
          const totalItems = entries.reduce((s, e) => s + e.item.count, 0);
          return (
            <div key={station} className="bg-white border border-[#E3DED5] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(30,30,20,0.05)]">
              <div className="px-4 py-3 bg-[#F7F4EE] border-b border-[#E3DED5] flex items-center space-x-2">
                {STATION_ICONS[station] || <ChefHat className="w-4 h-4 text-[#6F746F]" />}
                <span className="text-xs font-bold text-[#18201D] uppercase tracking-wider">{station}</span>
                <span className="ml-auto text-[10px] font-bold bg-white border border-[#E3DED5] px-2 py-0.5 rounded-full text-[#6F746F]">
                  {totalItems} total
                </span>
              </div>
              <div className="p-3 space-y-2">
                {entries.map((entry, idx) => {
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-[#F7F4EE]/70 border border-[#E3DED5]">
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-[#18201D]">×{entry.item.count}</span>
                        <span className="font-medium text-[#18201D]">{entry.item.name}</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-extrabold text-[#C84A38] bg-white border border-[#E3DED5] px-1.5 py-0.5 rounded">T{entry.tableNumber}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderItemQueueView = () => {
    const queueMap: Record<
      string,
      { count: number; tables: string[]; orderId: string[]; firstCreatedAt: string }
    > = {};

    filteredOrders.forEach(order => {
      if (['READY', 'DELIVERED', 'COMPLETED', 'ARCHIVED'].includes(order.status)) return;
      order.items.forEach(item => {
        const key = item.name;
        if (!queueMap[key]) {
          queueMap[key] = { count: 0, tables: [], orderId: [], firstCreatedAt: order.createdAt };
        }
        queueMap[key].count += item.count;
        if (!queueMap[key].tables.includes(order.tableNumber)) queueMap[key].tables.push(order.tableNumber);
        if (!queueMap[key].orderId.includes(order.orderId)) queueMap[key].orderId.push(order.orderId);
      });
    });

    const queueEntries = Object.entries(queueMap).sort((a, b) => b[1].count - a[1].count);

    if (queueEntries.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-[#6F746F] border border-dashed border-[#E3DED5] rounded-xl bg-white">
          <ListOrdered className="w-10 h-10 text-[#6F746F]/40 mb-3" />
          <p className="text-sm font-semibold">No pending items to batch cook.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {queueEntries.map(([itemName, data]) => (
          <div key={itemName} className="p-4 border border-[#E3DED5] bg-white rounded-xl shadow-[0_1px_4px_rgba(30,30,20,0.05)] space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-serif font-bold text-base text-[#18201D]">{itemName}</h3>
                <p className="text-[11px] text-[#6F746F] font-medium">
                  {data.tables.length} table{data.tables.length > 1 ? 's' : ''} · {data.count} total
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-serif font-bold text-[#18201D] tabular-nums">{data.count}</span>
                <p className="text-[9px] text-[#6F746F] font-bold uppercase tracking-wider">Pending</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#6F746F] uppercase tracking-wider mb-1.5">Tables</p>
              <div className="flex flex-wrap gap-1.5">
                {data.tables.map(t => (
                  <span key={t} className="text-[11px] font-bold bg-[#F7F4EE] text-[#18201D] px-2 py-0.5 rounded border border-[#E3DED5]">
                    T{t}
                  </span>
                ))}
              </div>
            </div>
            <button className="w-full py-2 rounded-lg text-xs font-bold border border-[#13241F] bg-[#13241F] text-white hover:bg-[#1a332c] transition-all flex items-center justify-center space-x-1.5">
              <ChefHat className="w-3.5 h-3.5" />
              <span>Cook All Together</span>
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderQueueView = () => {
    if (queueWithTimings.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-[#6F746F] border border-dashed border-[#E3DED5] rounded-xl bg-white">
          <ListOrdered className="w-10 h-10 text-[#6F746F]/40 mb-3" />
          <p className="text-sm font-semibold">No active cooking tickets in the queue.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-white border border-[#E3DED5] rounded-xl p-4 shadow-[0_1px_4px_rgba(30,30,20,0.05)]">
          <div className="flex items-center space-x-2 mb-3">
            <ListOrdered className="w-4 h-4 text-[#C84A38]" />
            <h3 className="text-xs font-bold text-[#18201D] uppercase tracking-wider">
              Queue Timeline Flow
            </h3>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {queueWithTimings.map((order, idx) => {
              const smartPrio = calculateSmartPriority(order);
              return (
                <div key={order.orderId} className="flex items-center shrink-0">
                  <div className="bg-[#F7F4EE] border border-[#E3DED5] rounded-lg px-3 py-2 text-left space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-[#6F746F] font-mono">#{idx + 1}</span>
                      <span className="text-[11px] font-bold text-[#18201D]">Table {order.tableNumber}</span>
                    </div>
                    <div className="text-[10px] text-[#6F746F]">
                      Est: <span className="text-[#18201D] font-mono font-medium">{order.estimatedStartStr}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-[#6F746F]">
                      <span className="font-semibold">{smartPrio}</span>
                      <span>·</span>
                      <span className="text-[#287A55] font-bold">{order.status}</span>
                    </div>
                  </div>
                  {idx < queueWithTimings.length - 1 && (
                    <span className="text-[#6F746F] px-1 font-bold">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAutoSortQueue}
            className="px-4 py-2 bg-white hover:bg-[#F7F4EE] border border-[#E3DED5] text-[#18201D] text-xs font-bold rounded-lg transition-all"
          >
            ⚡ Auto-Sort Queue by Priority
          </button>
        </div>

        <div className="bg-white border border-[#E3DED5] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(30,30,20,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F4EE] border-b border-[#E3DED5] text-[#6F746F] font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-center w-12">Pos</th>
                  <th className="px-4 py-3">Order info</th>
                  <th className="px-4 py-3">Chef Assigned</th>
                  <th className="px-4 py-3">Smart Priority</th>
                  <th className="px-4 py-3 text-center">Prep Time</th>
                  <th className="px-4 py-3 text-center">Est. Window</th>
                  <th className="px-4 py-3 text-center w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3DED5]">
                {queueWithTimings.map((order, idx) => {
                  const smartPrio = calculateSmartPriority(order);
                  const prepTime = order.estimatedPrepTime || order.items.length * 5;
                  
                  return (
                    <tr key={order.orderId} className="hover:bg-[#F7F4EE]/60 transition-colors">
                      <td className="px-4 py-4 text-center font-mono font-bold text-[#6F746F] text-sm">
                        {idx + 1}
                      </td>
                      
                      <td className="px-4 py-4">
                        <div className="font-bold text-[#18201D] text-sm">Table {order.tableNumber}</div>
                        <div className="text-[10px] text-[#6F746F] font-mono mt-0.5">#{order.orderId.substring(0, 10)}</div>
                        <div className="text-[11px] text-[#6F746F] mt-1">
                          {order.items.map(i => `${i.count}x ${i.name}`).join(', ')}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        {order.assignedChefName ? (
                          <span className="bg-[#F7F4EE] px-2.5 py-1 rounded text-[#18201D] font-medium border border-[#E3DED5]">
                            👨‍🍳 {order.assignedChefName}
                          </span>
                        ) : (
                          <span className="text-[#6F746F] italic">Unassigned</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          smartPrio === 'critical' ? 'bg-[#FDEEEC] text-[#C7463A] border-[#C7463A]/30' :
                          smartPrio === 'high' ? 'bg-[#FEF5E7] text-[#D79A24] border-[#D79A24]/30' :
                          smartPrio === 'normal' ? 'bg-[#EBF7EE] text-[#287A55] border-[#287A55]/30' :
                          'bg-[#F7F4EE] text-[#6F746F] border-[#E3DED5]'
                        }`}>
                          {smartPrio}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center font-mono text-[#18201D]">
                        {prepTime}m
                      </td>

                      <td className="px-4 py-4 text-center font-mono">
                        <div className="text-[#18201D] font-bold text-[11px]">{order.estimatedStartStr} - {order.estimatedFinishStr}</div>
                        <div className="text-[10px] text-[#6F746F] mt-0.5">({prepTime}m duration)</div>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            disabled={idx === 0}
                            onClick={() => handleMoveQueue(idx, 'up')}
                            className="p-1.5 bg-white border border-[#E3DED5] text-[#18201D] hover:bg-[#F7F4EE] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            disabled={idx === queueWithTimings.length - 1}
                            onClick={() => handleMoveQueue(idx, 'down')}
                            className="p-1.5 bg-white border border-[#E3DED5] text-[#18201D] hover:bg-[#F7F4EE] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-bold"
                            title="Move Down"
                          >
                            ▼
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-left select-none pb-24 font-sans">

      {/* ── Main Editorial Dashboard Header ───────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl bg-white border border-[#E3DED5] p-5 md:p-6 shadow-[0_2px_10px_rgba(30,30,20,0.06)]">
        {/* Subtle authentic restaurant background element */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.04] bg-cover bg-center mix-blend-multiply"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1600&auto=format&fit=crop&q=80)' }}
        />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#5F6762]">
              KITCHEN DISPLAY SYSTEM
            </span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#18201D] tracking-tight mt-0.5">
              Live Kitchen Orders
            </h1>
            <p className="text-xs md:text-sm text-[#5F6762] mt-1 font-normal font-sans">
              Fresh orders. Real-time updates. Better food, happier guests.
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
              <span>Kitchen Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar + Load Meter */}
      {!isLoading && (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <KitchenStatsBar metrics={metrics} targetPrepMinutes={targetPrepMinutes} />
          </div>
          <div className="lg:w-72 shrink-0">
            <KitchenLoadMeter activeOrderCount={metrics.activeOrders} maxCapacity={20} />
          </div>
        </div>
      )}

      {/* Announcements Bar (always visible when announcements exist) */}
      <KitchenAnnouncementsPanel />

      <div className="flex flex-col xl:flex-row gap-4">

        {showInsights && (
          <div className="xl:w-72 shrink-0 space-y-4">
            <KitchenInsightsPanel metrics={metrics} orders={allOrders} />

            {/* Chef Availability */}
            <div className="p-4 border border-[#E3DED5] bg-white rounded-xl shadow-[0_1px_4px_rgba(30,30,20,0.05)]">
              <ChefAvailabilityPanel employees={employees} orders={allOrders} />
            </div>

            {/* Shift Management */}
            <div className="p-4 border border-[#E3DED5] bg-white rounded-xl shadow-[0_1px_4px_rgba(30,30,20,0.05)]">
              <ShiftManagementPanel employees={employees} />
            </div>

            {/* Ingredient Alerts */}
            <div className="p-4 border border-[#E3DED5] bg-white rounded-xl shadow-[0_1px_4px_rgba(30,30,20,0.05)]">
              <IngredientAlertsPanel menuItems={menuItems} />
            </div>

            {/* Smart Batch Prediction */}
            <div className="p-4 border border-[#E3DED5] bg-white rounded-xl shadow-[0_1px_4px_rgba(30,30,20,0.05)]">
              <SmartBatchPrediction menuItems={menuItems} orders={allOrders} onPrepareBatch={handlePrepareBatch} />
            </div>
            
            {/* Prepared Batch Panel */}
            <div className="p-4 border border-[#E3DED5] bg-white rounded-xl shadow-[0_1px_4px_rgba(30,30,20,0.05)] space-y-3.5">
              <div className="flex justify-between items-center pb-2 border-b border-[#E3DED5]">
                <h4 className="text-xs font-bold text-[#18201D] uppercase tracking-wider">Prepared Batches</h4>
                <span className="text-[9px] text-[#6F746F] font-bold uppercase bg-[#F7F4EE] border border-[#E3DED5] px-1.5 py-0.5 rounded">Portions</span>
              </div>
              
              {menuItems.filter(i => i.preparationMethod === 'batch').length === 0 ? (
                <p className="text-[10px] text-[#6F746F] font-semibold py-2 text-center">No batch prepared items configured.</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {menuItems.filter(i => i.preparationMethod === 'batch').map(item => {
                    const servings = item.availableServings ?? 0;
                    const total = item.defaultBatchSize ?? 50;
                    const threshold = item.lowStockThreshold ?? 10;
                    const isOut = servings === 0;
                    const isLow = servings <= threshold;

                    return (
                      <div key={item.id} className="bg-[#F7F4EE] p-2.5 border border-[#E3DED5] rounded-lg space-y-2 text-[10px]">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-[#18201D] block leading-tight text-left">{item.name}</span>
                            <span className="text-[8px] text-[#6F746F] font-bold block mt-0.5 text-left">Threshold: {threshold}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[#18201D] font-mono block leading-none">{servings} / {total}</span>
                            <span className={`inline-block text-[7.5px] font-bold px-1 py-0.2 rounded mt-1 uppercase ${
                              isOut ? 'bg-[#FDEEEC] text-[#C7463A] border border-[#C7463A]/20' : isLow ? 'bg-[#FEF5E7] text-[#D79A24] border border-[#D79A24]/20' : 'bg-[#EBF7EE] text-[#287A55] border border-[#287A55]/20'
                            }`}>
                              {isOut ? 'Sold Out' : isLow ? 'Low' : 'Healthy'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handlePrepareBatch(item)}
                          className="w-full text-center py-1 bg-white hover:bg-[#F7F4EE] font-bold text-[#18201D] rounded border border-[#E3DED5] transition-all text-[9.5px]"
                        >
                          Prepare New Batch
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-4">

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center space-x-1 p-1 bg-white border border-[#E3DED5] rounded-xl flex-wrap gap-y-1 shadow-[0_1px_3px_rgba(30,30,20,0.04)]">
              {([
                { id: 'table',            label: 'Table View',         Icon: LayoutGrid },
                { id: 'category',         label: 'Category View',      Icon: UtensilsCrossed },
                { id: 'station',          label: 'Station View',       Icon: Layers },
                { id: 'item-queue',       label: 'Item Queue',         Icon: ListOrdered },
                { id: 'queue',            label: 'Cooking Queue',      Icon: ListOrdered },
                { id: 'inventory',        label: 'Prepared Inventory', Icon: Package },
                { id: 'reservations',     label: 'Reservation Feed',   Icon: Calendar },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all outline-none ${
                    activeTab === id
                      ? 'bg-[#13241F] text-white shadow-sm'
                      : 'text-[#6F746F] hover:text-[#18201D] hover:bg-[#F7F4EE]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowInsights(s => !s)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  showInsights
                    ? 'bg-[#13241F] border-[#13241F] text-white'
                    : 'bg-white border-[#E3DED5] text-[#6F746F] hover:text-[#18201D] hover:bg-[#F7F4EE]'
                }`}
                title="Toggle insights panel"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Insights</span>
              </button>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  showFilters
                    ? 'bg-[#13241F] border-[#13241F] text-white'
                    : 'bg-white border-[#E3DED5] text-[#6F746F] hover:text-[#18201D] hover:bg-[#F7F4EE]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Filters</span>
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="p-4 border border-[#E3DED5] bg-white rounded-xl shadow-[0_1px_4px_rgba(30,30,20,0.05)]">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
                <div className="col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6F746F] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search table, order, customer, dish..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-[#F7F4EE] border border-[#E3DED5] rounded-lg text-[#18201D] placeholder:text-[#6F746F]/70 outline-none focus:border-[#13241F]"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  options={[
                    { value: 'active',    label: 'Active Orders' },
                    { value: 'all',       label: 'All Statuses' },
                    { value: 'NEW',       label: 'New' },
                    { value: 'ACCEPTED',  label: 'Accepted' },
                    { value: 'PREPARING', label: 'Preparing' },
                    { value: 'PAUSED',    label: 'Paused' },
                    { value: 'READY',     label: 'Ready' },
                    { value: 'DELIVERED', label: 'Delivered' },
                  ]}
                />
                <Select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                  options={[
                    { value: 'all',      label: 'All Priorities' },
                    { value: 'critical', label: '💥 Critical' },
                    { value: 'high',     label: '🔴 High Priority' },
                    { value: 'normal',   label: '🟡 Normal' },
                    { value: 'low',      label: '⚪ Low Priority' },
                  ]}
                />
                <Select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Categories' },
                    ...allCategories.map(c => ({ value: c, label: c })),
                  ]}
                />
                <Select
                  value={stationFilter}
                  onChange={e => setStationFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Stations' },
                    ...ALL_STATIONS.map(s => ({ value: s, label: s })),
                  ]}
                />
                <Select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  options={[
                    { value: 'arrival',  label: 'Sort: Arrival' },
                    { value: 'priority', label: 'Sort: Priority' },
                    { value: 'prep',     label: 'Sort: Prep Time' },
                    { value: 'table',    label: 'Sort: Table No.' },
                    { value: 'elapsed',  label: 'Sort: Elapsed' },
                  ]}
                />
              </div>

              <div className="flex items-center flex-wrap gap-3 mt-3 pt-3 border-t border-[#E3DED5]">
                <button
                  onClick={() => setShowDelayedOnly(d => !d)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    showDelayedOnly
                      ? 'bg-[#FDEEEC] border-[#C7463A] text-[#C7463A]'
                      : 'bg-white border-[#E3DED5] text-[#6F746F] hover:text-[#18201D]'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span>Delayed Only</span>
                </button>

                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-[#6F746F] font-bold uppercase tracking-wider">
                    Target:
                  </span>
                  {[10, 15, 20, 30].map(m => (
                    <button
                      key={m}
                      onClick={() => setTargetPrepMinutes(m)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all ${
                        targetPrepMinutes === m
                          ? 'bg-[#13241F] border-[#13241F] text-white'
                          : 'bg-white border-[#E3DED5] text-[#6F746F] hover:text-[#18201D]'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>

                <span className="ml-auto text-[11px] text-[#6F746F] font-medium">
                  {filteredOrders.length} orders shown
                </span>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner label="Connecting to kitchen order stream..." />
            </div>
          ) : (
            <div className="space-y-4">
              {activeTab === 'table'      && renderTableView()}
              {activeTab === 'category'   && renderCategoryView()}
              {activeTab === 'station'    && renderStationView()}
              {activeTab === 'item-queue' && renderItemQueueView()}
              {activeTab === 'queue'      && renderQueueView()}
              {activeTab === 'inventory'  && renderPreparedInventoryView()}
              {activeTab === 'reservations' && renderReservationsView()}
            </div>
          )}
        </div>
      </div>

      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        totalVisible={filteredOrders.length}
        allSelected={allSelected}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onRequestAction={handleBulkActionRequest}
      />

      {bulkDialog.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#18201D]/50 backdrop-blur-sm">
          <div className="bg-white border border-[#E3DED5] rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-serif text-lg font-bold text-[#18201D]">Confirm Bulk Action</h2>
                <p className="text-xs text-[#6F746F] mt-0.5">This will update {bulkDialog.count} orders.</p>
              </div>
              <button
                onClick={() => setBulkDialog(d => ({ ...d, isOpen: false }))}
                className="p-1.5 rounded-lg text-[#6F746F] hover:text-[#18201D] hover:bg-[#F7F4EE] transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F7F4EE] border border-[#E3DED5] rounded-lg p-4 mb-5 space-y-1">
              <p className="text-xs text-[#6F746F] font-medium">
                Action: <span className="text-[#18201D] font-bold">{bulkDialog.action}</span>
              </p>
              <p className="text-xs text-[#6F746F] font-medium">
                New Status: <span className="text-[#287A55] font-bold">{bulkDialog.nextStatus}</span>
              </p>
              <p className="text-xs text-[#6F746F] font-medium">
                Orders: <span className="text-[#18201D] font-bold">{bulkDialog.count} tickets</span>
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setBulkDialog(d => ({ ...d, isOpen: false }))}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-[#E3DED5] text-[#6F746F] hover:text-[#18201D] hover:bg-[#F7F4EE] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBulkStatusUpdate(bulkDialog.nextStatus)}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-[#13241F] text-white hover:bg-[#1a332c] transition-all flex items-center justify-center space-x-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default KitchenQueue;
