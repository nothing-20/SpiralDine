/**
 * KitchenQueue — Redesigned Real-Time Kitchen Display System (KDS).
 * Matches reference layout with independent item-level order management,
 * top summary cards, station/course/queue/table/completed views,
 * live station tracking, and instant synchronization with waiter and customer apps.
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
  addDoc
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { Link, useSearchParams } from 'react-router-dom';
import { logEvent } from '../../../services/eventEngine';
import { ITimelineEvent } from '../../../types';

// Sub-components
import KitchenTopSummary from './KitchenTopSummary';
import KitchenStationsLiveBar from './KitchenStationsLiveBar';
import KitchenTicket from './KitchenTicket';
import WalkInOrderModal from './WalkInOrderModal';
import LivePreparedInventory from './LivePreparedInventory';
import BulkActionsToolbar from './BulkActionsToolbar';
import OrderTimeline from './OrderTimeline';

// Services
import { inventoryService } from '../../../shared/services/inventoryService';
import { 
  isKitchenStaffRole, 
  filterKitchenStaff, 
  DEFAULT_STATIONS, 
  inferStationForItem, 
  inferCourseForItem, 
  calculateDerivedOrderStatus,
  resolveItemPreparationStatus,
  getOrderItemIdentifier
} from '../../../shared/services/kitchenService';
import { kotService } from '../../../shared/services/kotService';

// UI Kit
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import toast from 'react-hot-toast';
import {
  UtensilsCrossed,
  LayoutGrid,
  Layers,
  ListOrdered,
  CheckCircle2,
  Clock,
  Search,
  Check,
  ChefHat,
  AlertTriangle,
  X,
  History,
  Calendar,
  Flame,
  Coffee,
  Cake,
  Soup,
  List,
  Plus,
  Bell,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';

// Types
import {
  TKdsTab,
  TOrderStatus,
  TPriority,
  IKdsOrder,
  IBulkConfirmDialog,
} from '../../../features/kitchen-dashboard/types';
import {
  TItemPreparationStatus,
} from '../../../shared/domain/orders/types';
import {
  getElapsedMinutes,
  calculateSmartPriority,
} from '../../../features/kitchen-dashboard/utils/kitchenMetrics';

export const KitchenQueue: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Core Data State ───────────────────────────────────────────────────────
  const [allOrders, setAllOrders] = useState<IKdsOrder[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── View & Tab State ──────────────────────────────────────────────────────
  const initialTab = (searchParams.get('tab') as TKdsTab) || 'table';
  const [activeTab, setActiveTab] = useState<TKdsTab>(initialTab);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);

  // Sync tab with URL query parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TKdsTab;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab: TKdsTab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'table' ? {} : { tab });
  };

  // ── Filter State ──────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<'all' | 'preparing' | 'ready' | 'on_hold' | 'delayed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stationFilter, setStationFilter] = useState<string>('all');

  // ── Bulk Selection State ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialog, setBulkDialog] = useState<IBulkConfirmDialog>({
    isOpen: false,
    action: '',
    nextStatus: 'ACCEPTED',
    count: 0,
  });

  // ── Live Clock Ticker ─────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Realtime Listener for Orders ──────────────────────────────────────────
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
        // Sort newest first or arrival order
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setAllOrders(list);
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

  // ── Realtime Listener for Staff Employees ─────────────────────────────────
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
      (error) => console.error('Error fetching employees:', error)
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // ── Realtime Listener for Menu Items ──────────────────────────────────────
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
      (error) => console.error('Error fetching menu items:', error)
    );

    return () => unsubscribe();
  }, [user?.tenantId]);

  // ── Active Orders Helper ──────────────────────────────────────────────────
  const isOrderActive = useCallback((o: IKdsOrder) => {
    return !['COMPLETED', 'ARCHIVED', 'CANCELLED', 'DELIVERED', 'SERVED'].includes(o.status);
  }, []);

  const activeOrders = useMemo(() => {
    return allOrders.filter(isOrderActive);
  }, [allOrders, isOrderActive]);

  const completedOrders = useMemo(() => {
    return allOrders.filter(o => ['COMPLETED', 'ARCHIVED', 'DELIVERED', 'SERVED'].includes(o.status));
  }, [allOrders]);

  // ── Top Summary Card Metrics (Calculated from Real Data) ──────────────────
  const summaryMetrics = useMemo(() => {
    const activeOrdersCount = activeOrders.length;
    let itemsCookingCount = 0;
    let readyToServeCount = 0;
    let delayedItemsCount = 0;

    activeOrders.forEach(order => {
      const orderElapsed = getElapsedMinutes(order.createdAt);
      const isOrderDelayed = orderElapsed > (order.estimatedPrepTime || 15);

      order.items.forEach(item => {
        const st: TItemPreparationStatus = resolveItemPreparationStatus(item, order.status);

        const qty = Number(item.count || 1);

        if (st === 'PREPARING') {
          itemsCookingCount += qty;
        } else if (st === 'READY') {
          readyToServeCount += qty;
        }

        // Check delayed items
        const itemElapsed = (item as any).preparationStartedAt 
          ? Math.floor((Date.now() - new Date((item as any).preparationStartedAt).getTime()) / 60000)
          : orderElapsed;

        const targetMins = (item as any).prepTimeMinutes || 12;
        if (st !== 'READY' && st !== 'SERVED' && st !== 'CANCELLED' && itemElapsed > targetMins) {
          delayedItemsCount += qty;
        }
      });
    });

    return {
      activeOrdersCount,
      itemsCookingCount,
      readyToServeCount,
      delayedItemsCount,
    };
  }, [activeOrders]);

  // ── Filter Counts (For Quick Filter Pills) ─────────────────────────────────
  const filterCounts = useMemo(() => {
    const all = activeOrders.length;
    let preparing = 0;
    let ready = 0;
    let onHold = 0;
    let delayed = 0;

    activeOrders.forEach(order => {
      const orderElapsed = getElapsedMinutes(order.createdAt);
      if (orderElapsed > (order.estimatedPrepTime || 15)) {
        delayed++;
      }

      const hasPreparing = order.status === 'PREPARING' || order.items.some(i => (i as any).status === 'PREPARING');
      if (hasPreparing) preparing++;

      const hasReady = order.status === 'READY' || order.status === 'PARTIALLY_READY' || order.items.some(i => (i as any).status === 'READY');
      if (hasReady) ready++;

      const hasHold = order.status === 'PAUSED' || order.items.some(i => (i as any).status === 'ON_HOLD');
      if (hasHold) onHold++;
    });

    return { all, preparing, ready, onHold, delayed };
  }, [activeOrders]);

  // ── Filtered Orders based on Search & Status Filter ───────────────────────
  const filteredActiveOrders = useMemo(() => {
    let list = [...activeOrders];

    // Status filter pill
    if (filterStatus === 'preparing') {
      list = list.filter(o => o.status === 'PREPARING' || o.items.some(i => (i as any).status === 'PREPARING'));
    } else if (filterStatus === 'ready') {
      list = list.filter(o => o.status === 'READY' || o.status === 'PARTIALLY_READY' || o.items.some(i => (i as any).status === 'READY'));
    } else if (filterStatus === 'on_hold') {
      list = list.filter(o => o.status === 'PAUSED' || o.items.some(i => (i as any).status === 'ON_HOLD'));
    } else if (filterStatus === 'delayed') {
      list = list.filter(o => getElapsedMinutes(o.createdAt) > (o.estimatedPrepTime || 15));
    }

    // Station filter
    if (stationFilter !== 'all') {
      list = list.filter(o => o.items.some(i => {
        const st = (i as any).station || inferStationForItem(i.name, (i as any).category);
        return st.toLowerCase() === stationFilter.toLowerCase();
      }));
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(o =>
        (o.tableNumber || '').toLowerCase().includes(q) ||
        (o.orderId || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.assignedChefName || '').toLowerCase().includes(q) ||
        o.items.some(i => i.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activeOrders, filterStatus, stationFilter, searchQuery]);

  // ── Automatic Prepared Inventory Deduction on READY ───────────────────────
  const deductBatchItemPortion = useCallback(async (item: any) => {
    if (!user?.tenantId) return;
    const targetMenu = menuItems.find(m =>
      (item.itemId && (m.id === item.itemId || m.itemId === item.itemId)) ||
      (item.id && m.id === item.id) ||
      (m.name && item.name && m.name.toLowerCase().trim() === item.name.toLowerCase().trim())
    );

    if (targetMenu && (targetMenu.preparationMethod === 'batch' || targetMenu.productionMode === 'Batch Production')) {
      const count = Number(item.count || 1);
      const curServings = Number(targetMenu.availableServings ?? 0);
      const newServings = Math.max(0, curServings - count);

      const itemRef = doc(db, 'restaurants', user.tenantId, 'menu', 'default', 'items', targetMenu.id);
      await updateDoc(itemRef, {
        availableServings: newServings,
        isAvailable: newServings > 0,
        available: newServings > 0,
        updatedAt: new Date().toISOString(),
      });

      setMenuItems(prev => prev.map(m => m.id === targetMenu.id ? { ...m, availableServings: newServings, isAvailable: newServings > 0, available: newServings > 0 } : m));
      toast.success(`Prepared Stock: -${count} "${targetMenu.name}" (${newServings} left)`);
    }
  }, [user?.tenantId, menuItems]);

  // ── Helper to Authoritatively Resolve Target Order & Document ID ─────────
  const resolveTargetOrderAndDocId = useCallback(
    (orderId: string) => {
      const targetOrder = allOrders.find(o => o.id === orderId || o.orderId === orderId);
      if (!targetOrder) return null;
      const targetDocId = targetOrder.id || targetOrder.orderId || orderId;
      return { targetOrder, targetDocId };
    },
    [allOrders]
  );

  // ── Item-Level Status Update Handler ──────────────────────────────────────
  const handleItemStatusUpdate = useCallback(
    async (orderId: string, itemKeyOrIndex: string | number, nextItemStatus: TItemPreparationStatus) => {
      if (!user?.tenantId) return;
      try {
        const resolved = resolveTargetOrderAndDocId(orderId);
        if (!resolved) {
          console.warn(`[KDS] Order not found for orderId: ${orderId}`);
          return;
        }
        const { targetOrder, targetDocId } = resolved;

        const targetKeyStr = String(itemKeyOrIndex);
        const timestamp = new Date().toISOString();
        let targetItemName = '';

        const updatedItems = (targetOrder.items || []).map((item, idx) => {
          const itemIdentifier = getOrderItemIdentifier(item, idx, targetOrder.orderId || targetOrder.id);
          const itemAny = item as any;
          const isTarget = 
            itemIdentifier === targetKeyStr || 
            String(idx) === targetKeyStr ||
            (item.id && String(item.id) === targetKeyStr) ||
            (itemAny.orderItemId && String(itemAny.orderItemId) === targetKeyStr) ||
            getOrderItemIdentifier(item, idx, targetOrder.orderId) === targetKeyStr ||
            getOrderItemIdentifier(item, idx, targetOrder.id) === targetKeyStr;
          const existingStatus = resolveItemPreparationStatus(item, targetOrder.status);

          if (!isTarget) {
            // UNSELECTED ITEM: Strictly preserve all existing properties and explicit status
            return {
              ...item,
              id: item.id || itemIdentifier,
              status: existingStatus,
              prepStatus: existingStatus,
            };
          }

          targetItemName = item.name;
          const updatedItem = {
            ...item,
            id: item.id || itemIdentifier,
            status: nextItemStatus,
            prepStatus: nextItemStatus,
          };

          if (nextItemStatus === 'PREPARING') {
            if (!updatedItem.preparationStartedAt) updatedItem.preparationStartedAt = timestamp;
          } else if (nextItemStatus === 'READY') {
            updatedItem.readyAt = timestamp;
          } else if (nextItemStatus === 'SERVED') {
            updatedItem.servedAt = timestamp;
          } else if (nextItemStatus === 'ON_HOLD') {
            updatedItem.pausedAt = timestamp;
          }

          return updatedItem;
        });

        if (nextItemStatus === 'READY') {
          try {
            const matchedItem = updatedItems.find(it => it.id === targetKeyStr || it.name === targetItemName);
            if (matchedItem) await deductBatchItemPortion(matchedItem);
          } catch (invErr) {
            console.warn('[KDS] Non-blocking inventory deduction warning:', invErr);
          }
        }

        // Recalculate derived overall order status
        const newOrderStatus = calculateDerivedOrderStatus(updatedItems, targetOrder.status);

        // Target the actual Firestore doc ID
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', targetDocId);
        const timelineEvent: ITimelineEvent = {
          type: (nextItemStatus === 'READY' ? 'READY' : nextItemStatus === 'PREPARING' ? 'PREPARING' : 'ACCEPTED') as any,
          title: `Item "${targetItemName}" → ${nextItemStatus}`,
          timestamp,
          performedBy: user.displayName || 'Kitchen Chef',
        };

        // Deep sanitize to prevent Firestore "Unsupported field value: undefined" error
        const cleanItems = JSON.parse(JSON.stringify(updatedItems));

        const updateFields: any = {
          items: cleanItems,
          status: newOrderStatus,
          updatedAt: timestamp,
          timeline: arrayUnion(timelineEvent),
        };

        if (newOrderStatus === 'PREPARING' && !targetOrder.cookingStartedAt) {
          updateFields.cookingStartedAt = timestamp;
        }
        if (newOrderStatus === 'READY' && !targetOrder.readyAt) {
          updateFields.readyAt = timestamp;
        }

        await updateDoc(docRef, updateFields);
        toast.success(`${targetItemName} → ${nextItemStatus}`);
      } catch (err) {
        console.error('[KDS] Failed to update item status:', err);
        toast.error('Failed to update item status.');
      }
    },
    [user?.tenantId, user?.displayName, resolveTargetOrderAndDocId, deductBatchItemPortion]
  );

  // ── Bulk Item Status Update Handler ───────────────────────────────────────
  const handleBulkItemStatusUpdate = useCallback(
    async (
      orderId: string,
      itemKeysOrIndices: Array<string | number>,
      nextStatus: TItemPreparationStatus
    ) => {
      if (!user?.tenantId || itemKeysOrIndices.length === 0) return;
      try {
        const resolved = resolveTargetOrderAndDocId(orderId);
        if (!resolved) {
          console.warn(`[KDS] Order not found for orderId: ${orderId}`);
          return;
        }
        const { targetOrder, targetDocId } = resolved;

        const targetKeysSet = new Set(itemKeysOrIndices.map(String));
        const timestamp = new Date().toISOString();
        const affectedItemNames: string[] = [];

        const updatedItems = (targetOrder.items || []).map((item, idx) => {
          const itemIdentifier = getOrderItemIdentifier(item, idx, targetOrder.orderId || targetOrder.id);
          const itemAny = item as any;
          const isSelected = 
            targetKeysSet.has(itemIdentifier) || 
            targetKeysSet.has(String(idx)) ||
            (item.id && targetKeysSet.has(String(item.id))) ||
            (itemAny.orderItemId && targetKeysSet.has(String(itemAny.orderItemId))) ||
            targetKeysSet.has(getOrderItemIdentifier(item, idx, targetOrder.orderId)) ||
            targetKeysSet.has(getOrderItemIdentifier(item, idx, targetOrder.id));
          const existingStatus = resolveItemPreparationStatus(item, targetOrder.status);

          if (!isSelected) {
            // UNSELECTED ITEM: Strictly preserve all existing properties and explicit status
            return {
              ...item,
              id: item.id || itemIdentifier,
              status: existingStatus,
              prepStatus: existingStatus,
            };
          }

          // SELECTED ITEM: Validate and update
          affectedItemNames.push(item.name);
          const updatedItem = {
            ...item,
            id: item.id || itemIdentifier,
            status: nextStatus,
            prepStatus: nextStatus,
          };

          if (nextStatus === 'PREPARING') {
            if (!updatedItem.preparationStartedAt) {
              updatedItem.preparationStartedAt = timestamp;
            }
          } else if (nextStatus === 'READY') {
            updatedItem.readyAt = timestamp;
          } else if (nextStatus === 'SERVED') {
            updatedItem.servedAt = timestamp;
          } else if (nextStatus === 'ON_HOLD') {
            updatedItem.pausedAt = timestamp;
          }

          return updatedItem;
        });

        // Deduct inventory portions for items newly marked READY (non-blocking)
        if (nextStatus === 'READY') {
          for (const item of updatedItems) {
            const key = getOrderItemIdentifier(item, 0, targetOrder.orderId);
            if (targetKeysSet.has(key) || targetKeysSet.has(String(item.id))) {
              try {
                await deductBatchItemPortion(item);
              } catch (invErr) {
                console.warn('[KDS] Non-blocking inventory deduction warning:', invErr);
              }
            }
          }
        }

        const newOrderStatus = calculateDerivedOrderStatus(updatedItems, targetOrder.status);
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', targetDocId);

        const summaryNames = affectedItemNames.slice(0, 2).join(', ') + (affectedItemNames.length > 2 ? '...' : '');
        const timelineEvent: ITimelineEvent = {
          type: (nextStatus === 'READY' ? 'READY' : nextStatus === 'PREPARING' ? 'PREPARING' : 'ACCEPTED') as any,
          title: `Bulk update (${affectedItemNames.length} items: ${summaryNames}) → ${nextStatus}`,
          timestamp,
          performedBy: user.displayName || 'Kitchen Chef',
        };

        const cleanItems = JSON.parse(JSON.stringify(updatedItems));

        const updateFields: any = {
          items: cleanItems,
          status: newOrderStatus,
          updatedAt: timestamp,
          timeline: arrayUnion(timelineEvent),
        };

        if (newOrderStatus === 'PREPARING' && !targetOrder.cookingStartedAt) {
          updateFields.cookingStartedAt = timestamp;
        }
        if (newOrderStatus === 'READY' && !targetOrder.readyAt) {
          updateFields.readyAt = timestamp;
        }

        await updateDoc(docRef, updateFields);
        toast.success(`Updated ${affectedItemNames.length} items to ${nextStatus}`);
      } catch (err) {
        console.error('[KDS] Failed to bulk update items:', err);
        toast.error('Failed to update items.');
      }
    },
    [user?.tenantId, user?.displayName, resolveTargetOrderAndDocId, deductBatchItemPortion]
  );

  // ── Order-Level Status Update Handler ─────────────────────────────────────
  const handleOrderStatusUpdate = useCallback(
    async (orderId: string, nextStatus: string) => {
      if (!user?.tenantId) return;
      try {
        const resolved = resolveTargetOrderAndDocId(orderId);
        const targetDocId = resolved?.targetDocId || orderId;
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', targetDocId);
        const timestamp = new Date().toISOString();

        const updateFields: any = {
          status: nextStatus,
          updatedAt: timestamp,
          timeline: arrayUnion({
            type: nextStatus as any,
            title: `Order Status → ${nextStatus}`,
            timestamp,
            performedBy: user.displayName || 'Kitchen Staff',
          }),
        };

        if (nextStatus === 'ACCEPTED') updateFields.acceptedAt = timestamp;
        if (nextStatus === 'PREPARING') updateFields.cookingStartedAt = timestamp;
        if (nextStatus === 'READY') updateFields.readyAt = timestamp;
        if (nextStatus === 'SERVED' || nextStatus === 'DELIVERED') updateFields.servedAt = timestamp;

        await updateDoc(docRef, updateFields);
        toast.success(`Order → ${nextStatus}`);
      } catch (err) {
        console.error('[KDS] Order status update failed:', err);
        toast.error('Failed to update order status.');
      }
    },
    [user?.tenantId, user?.displayName, resolveTargetOrderAndDocId]
  );

  // ── Chef & Priority Actions ───────────────────────────────────────────────
  const handleAssignChef = useCallback(
    async (orderId: string, chefId: string, chefName: string) => {
      if (!user?.tenantId) return;
      try {
        const resolved = resolveTargetOrderAndDocId(orderId);
        const targetDocId = resolved?.targetDocId || orderId;
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', targetDocId);
        await updateDoc(docRef, {
          assignedChefId: chefId,
          assignedChefName: chefName,
          assignedAt: new Date().toISOString(),
        });
        toast.success(`Chef ${chefName} assigned.`);
      } catch (e) {
        console.error('[KDS] Failed to assign chef:', e);
        toast.error('Failed to assign chef.');
      }
    },
    [user?.tenantId, resolveTargetOrderAndDocId]
  );

  const handleUnassignChef = useCallback(
    async (orderId: string) => {
      if (!user?.tenantId) return;
      try {
        const resolved = resolveTargetOrderAndDocId(orderId);
        const targetDocId = resolved?.targetDocId || orderId;
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', targetDocId);
        await updateDoc(docRef, {
          assignedChefId: '',
          assignedChefName: '',
        });
        toast.success('Chef unassigned.');
      } catch (e) {
        console.error('[KDS] Failed to unassign chef:', e);
        toast.error('Failed to unassign chef.');
      }
    },
    [user?.tenantId, resolveTargetOrderAndDocId]
  );

  const handlePauseOrder = useCallback(
    async (orderId: string, reason: string) => {
      if (!user?.tenantId) return;
      try {
        const resolved = resolveTargetOrderAndDocId(orderId);
        const targetDocId = resolved?.targetDocId || orderId;
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', targetDocId);
        await updateDoc(docRef, {
          status: 'PAUSED',
          pauseReason: reason,
          pausedAt: new Date().toISOString(),
        });
        toast.success('Order paused.');
      } catch (e) {
        console.error('[KDS] Failed to pause order:', e);
        toast.error('Failed to pause order.');
      }
    },
    [user?.tenantId, resolveTargetOrderAndDocId]
  );

  const handleResumeOrder = useCallback(
    async (orderId: string) => {
      if (!user?.tenantId) return;
      try {
        const resolved = resolveTargetOrderAndDocId(orderId);
        const targetDocId = resolved?.targetDocId || orderId;
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', targetDocId);
        await updateDoc(docRef, {
          status: 'PREPARING',
          resumedAt: new Date().toISOString(),
        });
        toast.success('Order resumed.');
      } catch (e) {
        console.error('[KDS] Failed to resume order:', e);
        toast.error('Failed to resume order.');
      }
    },
    [user?.tenantId, resolveTargetOrderAndDocId]
  );

  const handleRecallOrder = useCallback(
    async (orderId: string, reason: string) => {
      if (!user?.tenantId) return;
      try {
        const resolved = resolveTargetOrderAndDocId(orderId);
        const targetDocId = resolved?.targetDocId || orderId;
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', targetDocId);
        await updateDoc(docRef, {
          status: 'PREPARING',
          recallReason: reason,
          recalledAt: new Date().toISOString(),
        });
        toast.success('Order recalled to Preparing.');
      } catch (e) {
        console.error('[KDS] Failed to recall order:', e);
        toast.error('Failed to recall order.');
      }
    },
    [user?.tenantId, resolveTargetOrderAndDocId]
  );

  const handleUpdateNotes = useCallback(
    async (orderId: string, noteType: 'kitchen' | 'chef', noteValue: string) => {
      if (!user?.tenantId) return;
      try {
        const resolved = resolveTargetOrderAndDocId(orderId);
        const targetDocId = resolved?.targetDocId || orderId;
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', targetDocId);
        const updateField = noteType === 'kitchen' ? { kitchenNotes: noteValue } : { chefNotes: noteValue };
        await updateDoc(docRef, updateField);
        toast.success('Note updated.');
      } catch (e) {
        console.error('[KDS] Failed to update note:', e);
        toast.error('Failed to update note.');
      }
    },
    [user?.tenantId, resolveTargetOrderAndDocId]
  );

  const handleUpdatePriority = useCallback(
    async (orderId: string, priority: TPriority) => {
      if (!user?.tenantId) return;
      try {
        const resolved = resolveTargetOrderAndDocId(orderId);
        const targetDocId = resolved?.targetDocId || orderId;
        const docRef = doc(db, 'restaurants', user.tenantId, 'orders', targetDocId);
        await updateDoc(docRef, { priority, priorityOverride: true });
        toast.success(`Priority updated to ${priority}.`);
      } catch (e) {
        console.error('[KDS] Failed to update priority:', e);
        toast.error('Failed to update priority.');
      }
    },
    [user?.tenantId, resolveTargetOrderAndDocId]
  );

  // ── Batch Inventory Preparation ───────────────────────────────────────────
  const handlePrepareBatch = async (item: any, size?: number) => {
    if (!user?.tenantId) return;
    const batchSize = size !== undefined ? size : (item.defaultBatchSize || 50);

    await inventoryService.deductIngredientsForBatch(user.tenantId, item.id, batchSize);

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

    toast.success(`Prepared new batch of ${batchSize} portions for ${item.name}!`);
  };

  // ── Render Views ──────────────────────────────────────────────────────────

  // 1. Table View (Primary Reference View)
  const renderTableView = () => {
    if (filteredActiveOrders.length === 0) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-stone-500 border border-dashed border-[#E3DED5] rounded-3xl bg-white p-8">
          <CheckCircle2 className="w-12 h-12 text-[#183B2B]/40 mb-3" />
          <h3 className="text-base font-bold text-[#18201D]">Kitchen is all clear!</h3>
          <p className="text-xs text-[#71717A] mt-1">No active tickets matching the current filter.</p>
        </div>
      );
    }

    return (
      <div className={
        viewMode === 'grid'
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          : "space-y-3"
      }>
        {filteredActiveOrders.map(order => (
          <KitchenTicket
            key={order.orderId}
            order={order}
            onItemStatusUpdate={handleItemStatusUpdate}
            onBulkItemStatusUpdate={handleBulkItemStatusUpdate}
            onStatusUpdate={handleOrderStatusUpdate}
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

  // 2. Station View
  const renderStationView = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEFAULT_STATIONS.map((station: any) => {
          // Gather items assigned to this station from all active orders
          const stationItems: Array<{
            orderId: string;
            tableNumber: string;
            itemIndex: number;
            item: any;
          }> = [];

          activeOrders.forEach(order => {
            order.items.forEach((item, idx) => {
              const assignedStation = (item as any).station || inferStationForItem(item.name, (item as any).category);
              if (assignedStation.toLowerCase() === station.name.toLowerCase()) {
                stationItems.push({
                  orderId: order.id || order.orderId,
                  tableNumber: order.tableNumber || 'Walk-in',
                  itemIndex: idx,
                  item,
                });
              }
            });
          });

          return (
            <div key={station.id} className="bg-white border border-[#E3DED5] rounded-2xl overflow-hidden shadow-xs text-left">
              <div className="p-4 bg-[#FAF8F5] border-b border-[#E3DED5] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-white border border-[#E3DED5] flex items-center justify-center font-bold text-xs">
                    {station.name.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#18201D] leading-tight">
                      {station.name}
                    </h3>
                    <p className="text-[11px] text-[#71717A]">
                      {stationItems.length} active items
                    </p>
                  </div>
                </div>

                <span className={`w-2.5 h-2.5 rounded-full ${
                  stationItems.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-stone-300'
                }`} />
              </div>

              <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                {stationItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400">
                    No items in queue for this station
                  </div>
                ) : (
                  stationItems.map(({ orderId, tableNumber, itemIndex, item }, i) => {
                    const st = resolveItemPreparationStatus(item);
                    const isReady = st === 'READY';
                    const isCooking = st === 'PREPARING';

                    return (
                      <div key={i} className="p-2.5 bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="w-4 h-4 rounded bg-white border border-[#E3DED5] text-[10px] font-bold text-center leading-4">
                              {item.count}
                            </span>
                            <span 
                              title={item.name}
                              className="font-semibold text-xs text-[#18201D] break-words"
                            >
                              {item.name}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#71717A] mt-0.5">
                            Table {tableNumber} · #{orderId.slice(-6)}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center space-x-1.5">
                          {isCooking ? (
                            <button
                              onClick={() => handleItemStatusUpdate(orderId, itemIndex, 'READY')}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-colors"
                            >
                              <Check className="w-3 h-3" />
                              <span>Mark Ready</span>
                            </button>
                          ) : isReady ? (
                            <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[10px] font-bold flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>Ready</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleItemStatusUpdate(orderId, itemIndex, 'PREPARING')}
                              className="px-2 py-1 bg-[#183B2B] hover:bg-[#132E22] text-white rounded-lg text-[10px] font-bold flex items-center space-x-1 transition-colors"
                            >
                              <Play className="w-3 h-3" />
                              <span>Start</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // 3. Course View
  const renderCourseView = () => {
    const courses = ['Starters', 'Main Course', 'Desserts', 'Beverages'];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
        {courses.map(courseName => {
          const courseItems: Array<{ orderId: string; tableNumber: string; itemIndex: number; item: any }> = [];

          activeOrders.forEach(order => {
            order.items.forEach((item, idx) => {
              const assignedCourse = (item as any).course || inferCourseForItem(item.name, (item as any).category);
              if (assignedCourse.toLowerCase() === courseName.toLowerCase()) {
                courseItems.push({
                  orderId: order.id || order.orderId,
                  tableNumber: order.tableNumber || 'Walk-in',
                  itemIndex: idx,
                  item,
                });
              }
            });
          });

          return (
            <div key={courseName} className="bg-white border border-[#E3DED5] rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between">
              <div>
                <div className="p-4 bg-[#FAF8F5] border-b border-[#E3DED5] flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-[#18201D]">{courseName}</h3>
                    <p className="text-[11px] text-[#71717A]">{courseItems.length} dishes</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white border border-[#E3DED5]">
                    {courseItems.reduce((acc, curr) => acc + Number(curr.item.count || 1), 0)}
                  </span>
                </div>

                <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
                  {courseItems.length === 0 ? (
                    <div className="py-8 text-center text-xs text-stone-400">
                      No dishes in this course
                    </div>
                  ) : (
                    courseItems.map(({ orderId, tableNumber, itemIndex, item }, i) => {
                      const st = resolveItemPreparationStatus(item);
                      const isReady = st === 'READY';
                      const isCooking = st === 'PREPARING';
                      const isHold = st === 'ON_HOLD';

                      return (
                        <div key={i} className="p-2.5 bg-[#FAF8F5] border border-[#E8E3DA] rounded-xl flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div 
                              title={item.name}
                              className="font-semibold text-xs text-[#18201D] break-words"
                            >
                              {item.count}× {item.name}
                            </div>
                            <div className="text-[10px] text-[#71717A]">
                              Table {tableNumber}
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center space-x-1">
                            {isHold ? (
                              <button
                                onClick={() => handleItemStatusUpdate(orderId, itemIndex, 'PREPARING')}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold"
                              >
                                Release
                              </button>
                            ) : isCooking ? (
                              <button
                                onClick={() => handleItemStatusUpdate(orderId, itemIndex, 'READY')}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold"
                              >
                                Ready
                              </button>
                            ) : isReady ? (
                              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold">
                                Ready
                              </span>
                            ) : (
                              <button
                                onClick={() => handleItemStatusUpdate(orderId, itemIndex, 'PREPARING')}
                                className="px-2 py-1 bg-[#183B2B] text-white rounded-lg text-[10px] font-bold"
                              >
                                Fire
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Fire all items in course */}
              {courseItems.length > 0 && (
                <div className="p-3 border-t border-[#E3DED5] bg-[#FAF8F5]">
                  <button
                    onClick={() => {
                      courseItems.forEach(ci => {
                        const st = resolveItemPreparationStatus(ci.item);
                        if (st !== 'READY' && st !== 'PREPARING') {
                          handleItemStatusUpdate(ci.orderId, ci.itemIndex, 'PREPARING');
                        }
                      });
                    }}
                    className="w-full py-1.5 bg-[#183B2B] hover:bg-[#132E22] text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Fire All {courseName}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // 4. Order Queue View (FIFO Timeline)
  const renderQueueView = () => {
    return (
      <div className="bg-white border border-[#E3DED5] rounded-2xl overflow-hidden shadow-xs text-left">
        <div className="p-4 bg-[#FAF8F5] border-b border-[#E3DED5] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ListOrdered className="w-5 h-5 text-[#183B2B]" />
            <h3 className="font-bold text-sm text-[#18201D]">
              FIFO Preparation Sequence ({activeOrders.length} active orders)
            </h3>
          </div>
        </div>

        <div className="divide-y divide-[#F0ECE1]">
          {activeOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400">
              No orders waiting in queue
            </div>
          ) : (
            activeOrders.map((order, idx) => {
              const elapsed = getElapsedMinutes(order.createdAt);
              return (
                <div key={order.orderId} className="p-4 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-[#183B2B] text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-[#18201D]">
                          Table {order.tableNumber || 'Walk-in'}
                        </span>
                        <span className="text-xs text-[#71717A] font-mono">
                          #{order.orderId.slice(-6)}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          order.status === 'READY' ? 'bg-emerald-50 text-emerald-700' :
                          order.status === 'PREPARING' ? 'bg-blue-50 text-blue-700' :
                          'bg-stone-100 text-stone-600'
                        }`}>
                          {order.status}
                        </span>
                      </div>

                      <div className="text-xs text-[#71717A] mt-1 truncate">
                        {order.items.map(i => `${i.count}x ${i.name}`).join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-[#18201D]">
                      ⏱ {elapsed} min elapsed
                    </div>
                    <button
                      onClick={() => handleOrderStatusUpdate(order.id || order.orderId, 'READY')}
                      className="mt-1 px-3 py-1 bg-[#183B2B] hover:bg-[#132E22] text-white rounded-lg text-xs font-bold transition-all"
                    >
                      Mark Ready
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // 5. Completed View
  const renderCompletedView = () => {
    return (
      <div className="bg-white border border-[#E3DED5] rounded-2xl overflow-hidden shadow-xs text-left">
        <div className="p-4 bg-[#FAF8F5] border-b border-[#E3DED5] flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#18201D]">
            Completed Orders History ({completedOrders.length})
          </h3>
        </div>

        <div className="divide-y divide-[#F0ECE1]">
          {completedOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400">
              No completed orders recorded today
            </div>
          ) : (
            completedOrders.slice(0, 20).map(order => (
              <div key={order.orderId} className="p-4 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-[#18201D]">
                      Table {order.tableNumber || 'Walk-in'}
                    </span>
                    <span className="text-xs text-[#71717A] font-mono">
                      #{order.orderId}
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                      ✓ {order.status}
                    </span>
                  </div>

                  <p className="text-xs text-[#71717A] mt-1">
                    {order.items.map(i => `${i.count}x ${i.name}`).join(', ')}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-[#18201D]">
                    ₹{Number(order.totalAmount || 0).toFixed(2)}
                  </span>
                  <div className="mt-1">
                    <button
                      onClick={() => handleRecallOrder(order.id || order.orderId, 'Kitchen Recall')}
                      className="text-xs font-bold text-amber-700 hover:underline flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Recall</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 text-left select-none pb-24 font-sans bg-[#F7F4EE] min-h-screen -m-6 p-6">
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Title & Subtitle */}
        <div>
          <h1 className="font-serif text-2xl md:text-3xl font-black text-[#18201D] tracking-tight">
            Kitchen Dashboard
          </h1>
          <p className="text-xs md:text-sm text-[#71717A] mt-0.5 font-medium">
            Live kitchen orders • Prepare, track and serve with ease
          </p>
        </div>

        {/* Right: Search, Bell, Logged-in Staff Badge */}
        <div className="flex items-center space-x-3">
          {/* Quick Search Input */}
          <div className="relative w-64 md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by table, order ID, or item..."
              className="w-full pl-9 pr-14 py-2 text-xs bg-white border border-[#E3DED5] rounded-xl outline-none focus:border-[#183B2B] text-[#18201D] placeholder:text-stone-400 shadow-2xs"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded-md">
              Ctrl + K
            </span>
          </div>

          {/* Bell Notification */}
          <div className="relative">
            <button className="w-10 h-10 rounded-xl bg-white border border-[#E3DED5] flex items-center justify-center text-stone-600 hover:text-stone-900 shadow-2xs transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            {summaryMetrics.delayedItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#DE3B3B] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {summaryMetrics.delayedItemsCount}
              </span>
            )}
          </div>

          {/* Staff Info Pill */}
          <div className="flex items-center space-x-2.5 pl-2 border-l border-[#E3DED5]">
            <div className="w-9 h-9 rounded-xl bg-[#183B2B] text-white flex items-center justify-center font-bold text-xs shrink-0">
              {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'SK'}
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-xs font-bold text-[#18201D] truncate max-w-[120px]">
                {user?.displayName || 'Sai Krishna'}
              </div>
              <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                HEAD CHEF
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Top Dashboard Summary Cards ──────────────────────────── */}
      <KitchenTopSummary
        activeOrdersCount={summaryMetrics.activeOrdersCount}
        itemsCookingCount={summaryMetrics.itemsCookingCount}
        readyToServeCount={summaryMetrics.readyToServeCount}
        delayedItemsCount={summaryMetrics.delayedItemsCount}
      />

      {/* ── Main Dashboard Navigation Tabs ─────────────────────────── */}
      <div className="flex items-center space-x-1.5 p-1 bg-white border border-[#E3DED5] rounded-2xl w-fit shadow-2xs overflow-x-auto max-w-full">
        {([
          { id: 'table',     label: 'Table View',         Icon: LayoutGrid },
          { id: 'station',   label: 'Station View',       Icon: Layers },
          { id: 'course',    label: 'Course View',        Icon: UtensilsCrossed },
          { id: 'queue',     label: 'Order Queue',        Icon: ListOrdered },
          { id: 'completed', label: 'Completed',          Icon: CheckCircle2 },
          { id: 'inventory', label: 'Prepared Inventory', Icon: Soup },
        ] as const).map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => handleTabChange(id as TKdsTab)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#183B2B] text-white shadow-xs'
                  : 'text-[#71717A] hover:text-[#18201D] hover:bg-[#FAF8F5]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Order Filters Bar & Actions ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
        {/* Status Filter Pills */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-[#EAF7EE] border-[#183B2B] text-[#183B2B]'
                : 'bg-white border-[#E3DED5] text-[#71717A] hover:text-[#18201D]'
            }`}
          >
            All Orders ({filterCounts.all})
          </button>

          <button
            onClick={() => setFilterStatus('preparing')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              filterStatus === 'preparing'
                ? 'bg-[#EAF3FD] border-[#2563EB] text-[#2563EB]'
                : 'bg-white border-[#E3DED5] text-[#71717A] hover:text-[#18201D]'
            }`}
          >
            Preparing ({filterCounts.preparing})
          </button>

          <button
            onClick={() => setFilterStatus('ready')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              filterStatus === 'ready'
                ? 'bg-[#EAF7EE] border-[#16A34A] text-[#16A34A]'
                : 'bg-white border-[#E3DED5] text-[#71717A] hover:text-[#18201D]'
            }`}
          >
            ✓ Ready ({filterCounts.ready})
          </button>

          <button
            onClick={() => setFilterStatus('on_hold')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              filterStatus === 'on_hold'
                ? 'bg-[#FEF5E7] border-[#D97706] text-[#D97706]'
                : 'bg-white border-[#E3DED5] text-[#71717A] hover:text-[#18201D]'
            }`}
          >
            ⏸ On Hold ({filterCounts.onHold})
          </button>

          <button
            onClick={() => setFilterStatus('delayed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              filterStatus === 'delayed'
                ? 'bg-[#FEECEC] border-[#DC2626] text-[#DC2626]'
                : 'bg-white border-[#E3DED5] text-[#71717A] hover:text-[#18201D]'
            }`}
          >
            ⚠️ Delayed ({filterCounts.delayed})
          </button>
        </div>

        {/* Right side: View toggles + New Order Walk-in */}
        <div className="flex items-center space-x-2">
          {/* Grid/List View Toggle */}
          <div className="flex items-center bg-white border border-[#E3DED5] rounded-xl p-1 shadow-2xs">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-[#183B2B] text-white' : 'text-stone-500 hover:text-stone-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-[#183B2B] text-white' : 'text-stone-500 hover:text-stone-800'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* + New Order (Walk-in) Button */}
          <button
            onClick={() => setIsWalkInModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#183B2B] hover:bg-[#132E22] transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ New Order (Walk-in)</span>
          </button>
        </div>
      </div>

      {/* ── View Content Body ───────────────────────────────────────── */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center bg-white border border-[#E3DED5] rounded-2xl">
          <LoadingSpinner label="Connecting to live kitchen feed..." />
        </div>
      ) : (
        <div className="min-h-[400px]">
          {activeTab === 'table' && renderTableView()}
          {activeTab === 'station' && renderStationView()}
          {activeTab === 'course' && renderCourseView()}
          {activeTab === 'queue' && renderQueueView()}
          {activeTab === 'completed' && renderCompletedView()}
          {activeTab === 'inventory' && (
            <LivePreparedInventory menuItems={menuItems} onPrepareBatch={handlePrepareBatch} />
          )}
        </div>
      )}

      {/* ── Kitchen Stations (Live) Bottom Bar ──────────────────────── */}
      <KitchenStationsLiveBar
        orders={allOrders}
        onSelectStation={(stationName) => {
          setStationFilter(stationName);
          setActiveTab('station');
        }}
        onViewAll={() => setActiveTab('station')}
      />

      {/* ── Walk-In Order Modal ────────────────────────────────────── */}
      <WalkInOrderModal
        isOpen={isWalkInModalOpen}
        onClose={() => setIsWalkInModalOpen(false)}
        menuItems={menuItems}
      />
    </div>
  );
};

export default KitchenQueue;
