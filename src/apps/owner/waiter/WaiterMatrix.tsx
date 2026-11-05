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
  setDoc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { generateUniqueOrderId, isOrderActive } from '../../../shared/utils/orderUtils';
import { isTableAvailable, isTableOccupied, isTableCleaning, isTableBrowsing, isTableSeated } from '../../../shared/domain/tables/types';
import { tableService, cleanTableIdentifier } from '../../../shared/services/tableService';
import { IOrder, ITable, IServiceRequest, ITimelineEvent, IHandoverDoc, ISatisfactionRating } from '../../../types';
import { formatPrice } from '../../../utils/format';
import { getMenuItemPath } from '../../../firebase/collections';
import { logEvent } from '../../../services/eventEngine';
import { ActivityFeed } from '../../../components/ActivityFeed';
import CanonicalBillModal from '../../../shared/ui/billing/CanonicalBillModal';
import { WaiterOrderDetailsDrawer } from './WaiterOrderDetailsDrawer';

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
  ShieldAlert,
  Search,
  Filter,
  Smartphone,
  RotateCcw,
  Timer,
  Sun,
  MoreVertical,
  Armchair,
  Bell,
  CheckSquare,
  BookOpen,
  User,
  UserMinus,
  UserX,
  ShoppingBag,
  X,
  Utensils
} from 'lucide-react';

type TWaiterTab = 'command_center' | 'floor_map' | 'cleaning' | 'stats' | 'live_feed' | 'manager_console';

interface IMenuItem {
  id: string;
  name: string;
  price: number;
  discountPrice?: number;
  category: string;
  image?: string;
  imageUrl?: string;
  description?: string;
  isVeg?: boolean;
  veg?: boolean;
  isAvailable?: boolean;
  available?: boolean;
  preparationTime?: number;
}

const DISH_FALLBACK_IMAGES: Record<string, string> = {
  // Starters & Appetizers
  'spring': 'https://images.unsplash.com/photo-1541529086526-db283c563270?w=600&auto=format&fit=crop&q=80',
  'paneer': 'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=600&auto=format&fit=crop&q=80',
  'tikka': 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80',
  'wings': 'https://images.unsplash.com/photo-1527477321055-43615867383d?w=600&auto=format&fit=crop&q=80',
  'fries': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
  'french': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
  'garlic': 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=600&auto=format&fit=crop&q=80',
  'bread': 'https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=600&auto=format&fit=crop&q=80',
  'starter': 'https://images.unsplash.com/photo-1541529086526-db283c563270?w=600&auto=format&fit=crop&q=80',

  // Curries & Main Course
  'butter chicken': 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&auto=format&fit=crop&q=80',
  'chicken': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80',
  'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=600&auto=format&fit=crop&q=80',
  'curry': 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80',
  'dal': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=600&auto=format&fit=crop&q=80',
  'naan': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
  'roti': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
  'rice': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80',
  'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&auto=format&fit=crop&q=80',
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop&q=80',

  // Fast Food & Western
  'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
  'pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
  'pasta': 'https://images.unsplash.com/photo-1621996346565-e3d5d6281292?w=600&auto=format&fit=crop&q=80',

  // Desserts
  'ice': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&auto=format&fit=crop&q=80',
  'cream': 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&auto=format&fit=crop&q=80',
  'jamun': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
  'gulab': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
  'brownie': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80',
  'dessert': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
  'cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&auto=format&fit=crop&q=80',

  // Beverages & Drinks
  'beverage': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
  'drink': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
  'mojito': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
  'coffee': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&auto=format&fit=crop&q=80',
  'tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
  'chai': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
  'shake': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80',
};

const getDishImage = (item: IMenuItem): string => {
  const lower = `${item.name} ${item.category || ''}`.toLowerCase();
  const rawUrl = item.imageUrl || item.image || '';
  // Check if rawUrl is a clean valid image and not one of the old mismatched photos
  if (rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('photo-1544025162') && !rawUrl.includes('photo-1567184109') && !rawUrl.includes('photo-1567620832') && !rawUrl.includes('photo-1576107232')) {
    return rawUrl;
  }
  for (const [key, url] of Object.entries(DISH_FALLBACK_IMAGES)) {
    if (lower.includes(key)) return url;
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
};

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

const getNormalizedTableNum = (val?: string | number): string => {
  return String(val || '')
    .trim()
    .replace(/^(table|tbl)[-\s]*/i, '')
    .trim();
};

export const findAllActiveOrdersForTable = (table: ITable, orderList: IOrder[]): IOrder[] => {
  const tableCleanNum = getNormalizedTableNum(table.number || (table as any).tableNumber || table.tableName || table.name);
  const rawStatus = (table.status || (table as any).tableStatus || '').toLowerCase();
  const isTableExplicitlyAvailable = rawStatus === 'available' || rawStatus === 'empty';
  const isTableInCleaning = rawStatus === 'cleaning';

  // 1. Direct matched active orders for this table
  const matched = orderList.filter(o => {
    if (!isOrderActive(o)) return false;

    // Hard Guard: An order whose payment is settled or whose status is completed is NEVER active
    const pStatus = (o.paymentStatus || (o as any).billStatus || '').toLowerCase();
    const oStatus = (o.status || '').toUpperCase();
    if (pStatus === 'paid' || oStatus === 'COMPLETED' || oStatus === 'CANCELLED' || oStatus === 'ARCHIVED') {
      return false;
    }

    // Direct explicit links to table
    const isDirectDocMatch = 
      (table.activeOrderId && (o.orderId === table.activeOrderId || o.id === table.activeOrderId)) ||
      (table.currentOrderId && (o.orderId === table.currentOrderId || o.id === table.currentOrderId)) ||
      (o.tableId && (o.tableId === table.id || o.tableId === (table as any).tableId)) ||
      (table.activeOrderId && (o as any).primaryOrderId === table.activeOrderId);

    if (isDirectDocMatch) return true;

    // Match by table number
    const orderCleanNum = getNormalizedTableNum(o.tableNumber || (o as any).table);
    if (!tableCleanNum || !orderCleanNum || tableCleanNum !== orderCleanNum) {
      return false;
    }

    // Guard: If table is currently in Cleaning, do not match served or completed orders
    if (isTableInCleaning && (oStatus === 'SERVED' || oStatus === 'DELIVERED' || oStatus === 'DINING_COMPLETED')) {
      return false;
    }

    // Guard: If table was seated afresh without a linked order, do NOT attach past orders placed before this seating session
    if ((table.seatedAt || table.occupiedAt) && !table.activeOrderId && !table.currentOrderId) {
      const seatedTime = new Date(table.seatedAt || table.occupiedAt!).getTime();
      const orderTime = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      if (!isNaN(seatedTime) && !isNaN(orderTime) && orderTime < (seatedTime - 60000)) {
        return false;
      }
    }

    // Guard: If table was explicitly marked Available or Empty, only match active orders that were placed
    // recently and are actively in-flight (kitchen prep, food ready, active dining).
    // Do NOT resurrect an available table if the order is already served/completed or placed before table cleaning.
    if (isTableExplicitlyAvailable && !table.activeOrderId && !table.currentOrderId) {
      // If order is already completely served/dining-completed, do not resurrect an available table
      if (oStatus === 'SERVED' || oStatus === 'DELIVERED' || oStatus === 'DINING_COMPLETED') {
        return false;
      }

      // If table has a recorded cleaning timestamp or reset timestamp, reject orders created before cleaning completed
      const cleanTime = table.cleaningCompletedAt || table.billPaidAt || (table as any).availableSince;
      if (cleanTime && o.createdAt) {
        const orderTime = new Date(o.createdAt).getTime();
        const cleanedTime = new Date(cleanTime).getTime();
        if (!isNaN(orderTime) && !isNaN(cleanedTime) && orderTime <= cleanedTime) {
          return false;
        }
      }

      // Reject stale orders older than 12 hours
      if (o.createdAt) {
        const ageMs = Date.now() - new Date(o.createdAt).getTime();
        if (ageMs > 12 * 60 * 60 * 1000) return false;
      }
    }

    return true;
  });

  // 2. Also link add-on orders that share the primaryOrderId of any matched order
  const matchedIds = new Set(matched.map(m => m.orderId || m.id));
  orderList.forEach(o => {
    if (!isOrderActive(o)) return;
    const pId = (o as any).primaryOrderId;
    const targetId = o.orderId || o.id;
    if (pId && matchedIds.has(pId) && !matchedIds.has(targetId)) {
      matched.push(o);
      matchedIds.add(targetId);
    }
  });

  // Sort chronologically (oldest first: Round 1, Round 2, ...)
  return matched.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

const findActiveOrderForTable = (table: ITable, orderList: IOrder[]): IOrder | undefined => {
  const all = findAllActiveOrdersForTable(table, orderList);
  return all.length > 0 ? all[0] : undefined;
};

const getCleaningCountdown = (table: ITable): { elapsedMins: number; remainingMins: number; remainingSecs: number; isOverdue: boolean; displayTime: string } => {
  const startedAt = table.cleaningStartedAt ? new Date(table.cleaningStartedAt).getTime() : 0;
  if (!startedAt) {
    return { elapsedMins: 0, remainingMins: 10, remainingSecs: 0, isOverdue: false, displayTime: '10:00' };
  }
  const durationMinutes = table.cleaningDurationMinutes || 10;
  const targetTime = startedAt + (durationMinutes * 60 * 1000);
  const diffMs = targetTime - Date.now();
  const elapsedMs = Date.now() - startedAt;
  const elapsedMins = Math.max(0, Math.floor(elapsedMs / 60000));

  if (diffMs <= 0) {
    return { elapsedMins, remainingMins: 0, remainingSecs: 0, isOverdue: true, displayTime: '00:00' };
  }

  const remainingMins = Math.floor(diffMs / 60000);
  const remainingSecs = Math.floor((diffMs % 60000) / 1000);
  const displayTime = `${String(remainingMins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  return { elapsedMins, remainingMins, remainingSecs, isOverdue: false, displayTime };
};

export const getTableItemServingMetrics = (table: ITable, orderList: IOrder[]) => {
  const activeOrders = findAllActiveOrdersForTable(table, orderList);
  let readyCount = 0;
  let servedCount = 0;
  let remainingCount = 0;
  let hasReady = false;
  let hasUnfinished = false;

  activeOrders.forEach(order => {
    const items = order.items || [];
    items.forEach((item: any) => {
      const isServed = item.servingStatus === 'SERVED' || item.status === 'SERVED' || order.status === 'SERVED';
      const isReady = !isServed && (item.servingStatus === 'READY_TO_SERVE' || item.prepStatus === 'READY' || item.status === 'READY' || order.status === 'READY');
      const isRemaining = !isServed && !isReady;
      const count = Number(item.count || item.quantity || 1);

      if (isServed) {
        servedCount += count;
      } else if (isReady) {
        readyCount += count;
        hasReady = true;
      } else if (isRemaining) {
        remainingCount += count;
        hasUnfinished = true;
      }
    });
  });

  const isPartiallyReady = (hasReady && (hasUnfinished || activeOrders.some(o => o.status === 'PARTIALLY_READY'))) || activeOrders.some(o => o.status === 'PARTIALLY_READY');
  const isFullyReady = hasReady && !hasUnfinished;

  return {
    activeOrders,
    readyCount,
    servedCount,
    remainingCount,
    hasReady,
    hasUnfinished,
    isPartiallyReady,
    isFullyReady,
  };
};

const getShiftWorkingTime = (s: IWaiterShift): number => {
  if (!s.startTime) return 0;
  const start = new Date(s.startTime).getTime();
  const end = s.endTime ? new Date(s.endTime).getTime() : Date.now();
  const total = end - start;
  const net = total - (s.breakDurationMs || 0);
  return Math.max(0, net);
};

const formatDuration = (ms: number): string => {
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
};

export const WaiterMatrix: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrOwner = user?.role === 'owner' || user?.role === 'manager' || user?.role === 'admin';
  
  const [tables, setTables] = useState<ITable[]>([]);
  const [orders, setOrders] = useState<IOrder[]>([]);
  const [restaurantName, setRestaurantName] = useState<string>(() => (user as any)?.restaurantName || '');
  const [legacyRequests, setLegacyRequests] = useState<IServiceRequest[]>([]);
  const [waiterRequests, setWaiterRequests] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<IMenuItem[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [incomingHandovers, setIncomingHandovers] = useState<IHandoverDoc[]>([]);
  const [managerReviews, setManagerReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TWaiterTab>('floor_map');
  const [selectedOrder, setSelectedOrder] = useState<IOrder | null>(null);
  const [viewingRoundsTable, setViewingRoundsTable] = useState<{ table: ITable; orders: IOrder[] } | null>(null);
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
  const [menuSearchQuery, setMenuSearchQuery] = useState<string>('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('All');
  const [menuDietaryFilter, setMenuDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  const openSeatingModal = (table: ITable) => {
    const cap = Number(table.capacity || table.seatingCapacity || 4);
    setSelectedTable(table);
    setGuestsCount(Math.min(cap, Math.max(1, table.guestsCount || cap)));
    setTableSectionInput(table.section || (table as any).floorSection || 'Indoor Main');
    setTableNotesInput(table.tableNotes || '');
  };

  const openQuickOrderModal = (table: ITable) => {
    setOrderTable(table);
    setCart({});
    setCustomerName(table.customerName || '');
    setCustomerPhone(table.customerPhone || '');
    setOrderNotes(table.tableNotes || '');
  };

  const filteredDishes = useMemo(() => {
    return menuItems.filter(item => {
      if (menuCategoryFilter !== 'All' && item.category !== menuCategoryFilter) return false;
      const isVeg = item.isVeg ?? item.veg ?? true;
      if (menuDietaryFilter === 'veg' && !isVeg) return false;
      if (menuDietaryFilter === 'non-veg' && isVeg) return false;
      if (menuSearchQuery.trim()) {
        const q = menuSearchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc) return false;
      }
      return true;
    });
  }, [menuItems, menuCategoryFilter, menuDietaryFilter, menuSearchQuery]);

  const [bulkSection, setBulkSection] = useState('Main Room');
  const [bulkSectionWaiterId, setBulkSectionWaiterId] = useState('');
  const [autoAssignStrategy, setAutoAssignStrategy] = useState<'round-robin' | 'least-loaded'>('round-robin');

  const [tick, setTick] = useState(0);
  const notifiedEventsRef = React.useRef<Set<string>>(new Set());
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, 'critical' | 'high' | 'medium' | 'low'>>({});
  const [queueFilter, setQueueFilter] = useState<'all' | 'delivery' | 'request' | 'bill' | 'cleaning'>('all');
  const [actionFilter, setActionFilter] = useState<'All' | 'Kitchen' | 'Customers' | 'Payments' | 'Cleaning' | 'Manager'>('All');
  const [floorFilter, setFloorFilter] = useState<'all' | 'available' | 'browsing' | 'occupied' | 'partially_ready' | 'cleaning' | 'my_tables'>('all');
  const [floorSearch, setFloorSearch] = useState('');
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean;
    table: ITable | null;
    orders: IOrder[];
    initialSelectReadyItems: boolean;
  }>({
    isOpen: false,
    table: null,
    orders: [],
    initialSelectReadyItems: false,
  });

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
    const tenantId = user?.tenantId;
    if (!tenantId) return;

    if ((user as any)?.restaurantName) {
      setRestaurantName((user as any).restaurantName);
    }

    const fetchRest = async () => {
      try {
        const rDoc = await getDoc(doc(db, 'restaurants', tenantId));
        if (rDoc.exists()) {
          const data = rDoc.data();
          const name = data.name || data.restaurantName;
          if (name) {
            setRestaurantName(name);
          }
        }
      } catch (err) {
        console.warn('Error fetching restaurant name in WaiterMatrix:', err);
      }
    };
    fetchRest();
  }, [user?.tenantId, (user as any)?.restaurantName]);

  useEffect(() => {
    if (!user?.tenantId) return;

    setIsLoading(true);

    const tablesRef = collection(db, 'restaurants', user.tenantId, 'tables');
    const unsubTables = onSnapshot(tablesRef, (snap) => {
      const list: ITable[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.isArchived === true || data.archived === true || data.isActive === false) return;
        const num = data.number ?? data.tableNumber;
        const name = data.tableName ?? data.name;
        if (!num && !name) return;
        const s = (data.status || data.tableStatus || '').toLowerCase();
        if (s === 'disabled' || s === 'archived' || s === 'deleted') return;
        list.push({ id: docSnap.id, ...data } as ITable);
      });
      list.sort((a, b) => {
        const numA = String(a.number || (a as any).tableNumber || '');
        const numB = String(b.number || (b as any).tableNumber || '');
        return numA.localeCompare(numB, undefined, { numeric: true });
      });
      setTables(list);
    });

    const ordersRef = collection(db, 'restaurants', user.tenantId, 'orders');
    const qOrders = query(ordersRef, limit(100));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const list: IOrder[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        list.push({
          ...d,
          id: docSnap.id,
          orderDocId: docSnap.id,
          orderId: d.orderId || docSnap.id,
        } as unknown as IOrder);
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
        if (data.status !== 'Completed' && data.requestType !== 'New Order Placed' && data.type !== 'New Order Placed') {
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
          price: data.price || 0,
          discountPrice: data.discountPrice,
          category: data.category || 'Other',
          image: data.image || data.imageUrl || '',
          imageUrl: data.imageUrl || data.image || '',
          description: data.description || '',
          isVeg: data.isVeg ?? data.veg ?? true,
          isAvailable: data.isAvailable ?? data.available ?? true,
          preparationTime: data.preparationTime || 15
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
    if (!user?.tenantId) return;

    // Periodic sweep for abandoned browsing sessions older than 5 minutes
    tableService.cleanupStaleBrowsingTables(user.tenantId, 5).catch(() => {});
    const sweepInterval = setInterval(() => {
      tableService.cleanupStaleBrowsingTables(user.tenantId, 5).catch(() => {});
    }, 45000);

    return () => clearInterval(sweepInterval);
  }, [user?.tenantId]);

  // Auto-heal: If an active in-flight kitchen/dining order exists for a table that is still marked 'Available' in Firestore,
  // synchronize the table document so Firestore stays authoritative and up-to-date across all clients.
  useEffect(() => {
    if (!user?.tenantId || tables.length === 0 || orders.length === 0) return;

    tables.forEach(table => {
      const isAvailable = (table.status || '').toLowerCase() === 'available' || (table.status || '').toLowerCase() === 'empty';
      if (!isAvailable || table.activeOrderId) return;

      const activeOrders = findAllActiveOrdersForTable(table, orders);
      if (activeOrders.length > 0) {
        const primaryOrder = activeOrders[0];
        const primaryOrderId = primaryOrder.orderId || primaryOrder.id;
        const oStatus = (primaryOrder.status || '').toUpperCase();

        if (['NEW', 'PLACED', 'ACCEPTED', 'CHEF_ASSIGNED', 'PREPARING', 'READY', 'PARTIALLY_READY', 'PICKED_UP'].includes(oStatus)) {
          const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', table.id);
          const nowIso = new Date().toISOString();
          setDoc(tableRef, {
            status: 'occupied',
            tableStatus: 'Occupied',
            subStatus: 'dining',
            diningStatus: 'ordered',
            customerPresent: true,
            activeOrderId: primaryOrderId,
            currentOrderId: primaryOrderId,
            lastOrderAt: primaryOrder.createdAt || nowIso,
            customerName: primaryOrder.customerName || (primaryOrder as any).userName || 'Guest Diner',
            updatedAt: nowIso,
          }, { merge: true }).catch(err => {
            console.warn('[WaiterMatrix] Auto-sync table status notice:', err);
          });
        }
      }
    });
  }, [tables, orders, user?.tenantId]);

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
      if (o.status === 'READY' && (o.waiterId === user?.uid || !o.waiterId || isManagerOrOwner)) {
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
      const nowIso = new Date().toISOString();
      const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', selectedTable.id);
      const cap = Number(selectedTable.capacity || selectedTable.seatingCapacity || 4);
      const safeGuestsCount = Math.min(cap, Math.max(1, Number(guestsCount) || cap));
      const safeSection = tableSectionInput || selectedTable.section || (selectedTable as any).floorSection || 'Indoor Main';
      const safeNotes = (tableNotesInput || '').trim();

      const patchData = {
        status: 'occupied',
        tableStatus: 'Occupied',
        subStatus: 'seated',
        diningStatus: 'seated',
        customerPresent: true,
        seatedAt: selectedTable.seatedAt || nowIso,
        occupiedAt: selectedTable.occupiedAt || nowIso,
        lastActiveAt: nowIso,
        assignedWaiterId: user.uid,
        assignedWaiterName: user.displayName || user.email || 'Waiter',
        guestsCount: safeGuestsCount,
        tableNotes: safeNotes,
        section: safeSection,
        updatedAt: nowIso
      };

      await updateDoc(tableRef, patchData);

      // Instant optimistic state update
      setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, ...patchData } : t));

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
        description: `Table ${selectedTable.number} occupies ${safeGuestsCount} guests. Notes: ${safeNotes}`
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

  const handleServeFood = async (order: IOrder) => {
    if (!user?.tenantId || (!order.orderId && !order.id)) return;
    try {
      const candidateIds = Array.from(new Set([order.id, order.orderId, (order as any)._id].filter(Boolean) as string[]));
      let orderRef = null;
      for (const cId of candidateIds) {
        const testRef = doc(db, 'restaurants', user.tenantId, 'orders', cId);
        try {
          const testSnap = await getDoc(testRef);
          if (testSnap.exists()) {
            orderRef = testRef;
            break;
          }
        } catch (_) {}
      }
      if (!orderRef) {
        orderRef = doc(db, 'restaurants', user.tenantId, 'orders', order.id || order.orderId);
      }

      const nowIso = new Date().toISOString();
      const timelineEvent: ITimelineEvent = {
        type: 'SERVED',
        title: 'Food Served',
        description: `Delivered to Table ${order.tableNumber || 'Dine-in'} by ${user.displayName || user.email || 'Waiter'}.`,
        timestamp: nowIso,
        performedBy: user.displayName || user.email || 'Waiter'
      };

      await updateDoc(orderRef, {
        status: 'SERVED',
        servedAt: nowIso,
        deliveredAt: nowIso,
        waiterId: user.uid,
        waiterName: user.displayName || user.email || 'Waiter',
        timeline: arrayUnion(timelineEvent),
        updatedAt: nowIso
      });

      // Auto-assign waiter to table if table unassigned
      const tableObj = tables.find(t => String(t.number) === String(order.tableNumber) || t.activeOrderId === order.orderId);
      if (tableObj && !tableObj.assignedWaiterId) {
        try {
          const tRef = doc(db, 'restaurants', user.tenantId, 'tables', tableObj.id);
          await updateDoc(tRef, {
            assignedWaiterId: user.uid,
            assignedWaiterName: user.displayName || user.email || 'Waiter'
          });
        } catch (_) {}
      }

      setShift(prev => ({
        ...prev,
        stats: { ...prev.stats, ordersDelivered: prev.stats.ordersDelivered + 1 }
      }));

      toast.success(`Food served to Table ${order.tableNumber}!`);

      logEvent(user.tenantId, {
        eventType: 'Order Delivered',
        eventCategory: 'Waiter',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        orderId: order.orderId,
        tableNumber: order.tableNumber,
        title: 'Food Served',
        description: `Waiter confirmed food served to Table ${order.tableNumber}.`
      });
    } catch (err) {
      console.error('[WaiterMatrix] Serve food error:', err);
      toast.error('Failed to update food serving status.');
    }
  };

  const handleStartCleaning = async (table: ITable) => {
    if (!user?.tenantId) return;
    try {
      await tableService.setTableCleaning(user.tenantId, table.id, 10);
      toast.success(`Table ${table.number} moved to cleaning queue (10m timer).`);
    } catch (err) {
      console.error('[WaiterMatrix] Start cleaning failed:', err);
      toast.error('Failed to move table to cleaning.');
    }
  };

  const handleCompleteCleaningCC = async (table: ITable) => {
    if (!user?.tenantId) return;
    try {
      await tableService.setTableAvailable(user.tenantId, table.id);

      if (table.activeOrderId) {
        try {
          const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', table.activeOrderId);
          await updateDoc(orderRef, { status: 'COMPLETED', isArchived: true });
        } catch (_) {}
      }

      // Also complete/archive any lingering served orders for this table in Firestore and local state
      const lingeringOrders = findAllActiveOrdersForTable(table, orders);
      for (const ord of lingeringOrders) {
        const targetOrdId = ord.id || ord.orderId;
        if (targetOrdId) {
          try {
            const ordRef = doc(db, 'restaurants', user.tenantId, 'orders', targetOrdId);
            await updateDoc(ordRef, { status: 'COMPLETED', isArchived: true, paymentStatus: ord.paymentStatus || 'paid' });
          } catch (_) {}
        }
      }
      if (lingeringOrders.length > 0) {
        const lingeringIds = new Set(lingeringOrders.map(o => o.id || o.orderId).filter(Boolean) as string[]);
        setOrders(prev => prev.map(o => (lingeringIds.has(o.id || '') || lingeringIds.has(o.orderId || '')) ? { ...o, status: 'COMPLETED', paymentStatus: 'paid' } : o));
      }

      // Optimistically update table state
      setTables(prev => prev.map(t => t.id === table.id ? ({
        ...t,
        status: 'Available',
        tableStatus: 'Available',
        activeOrderId: undefined,
        currentOrderId: undefined,
        customerPresent: false,
        guestsCount: 0,
        seatedAt: undefined,
        occupiedAt: undefined,
        cleaningStartedAt: undefined,
        cleaningCompletedAt: new Date().toISOString()
      } as ITable) : t));

      // Automatically resolve and complete all pending Clean Table requests for this table in waiterRequests
      try {
        const waiterReqCol = collection(db, 'restaurants', user.tenantId, 'waiterRequests');
        const qReqs = query(waiterReqCol, where('requestType', '==', 'Clean Table'));
        const reqSnap = await getDocs(qReqs);
        const batch = writeBatch(db);
        let count = 0;
        const staffName = user.displayName || user.email || 'Waiter';
        const nowIso = new Date().toISOString();

        reqSnap.forEach((d: any) => {
          const data = d.data();
          const s = (data.status || '').toLowerCase();
          if (s !== 'completed' && s !== 'cancelled' && s !== 'rejected') {
            const matchesTable = (
              data.tableId === table.id ||
              String(data.tableNumber) === String(table.number) ||
              String(data.tableNumber) === String((table as any).tableNumber) ||
              String(data.tableNumber) === table.id ||
              String(data.tableNumber) === table.id.replace(/^TBL-/i, '')
            );
            if (matchesTable) {
              batch.update(d.ref, {
                status: 'Completed',
                resolvedAt: nowIso,
                resolvedBy: staffName,
                acceptedBy: staffName,
                completedAt: nowIso
              });
              count++;
            }
          }
        });
        if (count > 0) {
          await batch.commit();
        }
      } catch (err) {
        console.warn('Error resolving waiter requests for cleaned table:', err);
      }

      setShift(prev => ({
        ...prev,
        stats: { ...prev.stats, cleaningCompleted: prev.stats.cleaningCompleted + 1 }
      }));

      toast.success(`Table ${table.number} sanitized and marked Available!`);

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
      toast.error('Failed to mark table available.');
    }
  };

  const handleReleaseTable = async (table: ITable) => {
    if (!user?.tenantId) return;
    try {
      const nowIso = new Date().toISOString();

      // 1. Optimistically update local table state
      setTables(prev => prev.map(t => t.id === table.id ? ({
        ...t,
        status: 'Available',
        tableStatus: 'Available',
        activeOrderId: undefined,
        currentOrderId: undefined,
        customerPresent: false,
        guestsCount: 0,
        seatedAt: undefined,
        occupiedAt: undefined,
        tableNotes: '',
        diningStatus: undefined,
        subStatus: undefined,
        cleaningStartedAt: undefined,
        cleaningCompletedAt: nowIso,
        availableSince: nowIso
      } as ITable) : t));

      if (selectedTable?.id === table.id) {
        setSelectedTable(null);
      }

      // 2. Persist to Firestore
      await tableService.updateTableStatusDirect(user.tenantId, table.id, 'Available', {
        guestsCount: 0,
        tableNotes: '',
        customerPresent: false,
        customerName: undefined,
        customerPhone: undefined,
        assignedWaiterId: table.assignedWaiterId || user.uid,
        assignedWaiterName: table.assignedWaiterName || user.displayName || user.email || 'Staff Waiter'
      });

      // 3. Log activity event
      logEvent(user.tenantId, {
        eventType: 'Table Released',
        eventCategory: 'Operational',
        performedBy: user.displayName || user.email || 'Waiter',
        performedByRole: user.role || 'waiter',
        tableId: table.id,
        tableNumber: table.number,
        title: `Table ${table.number} Released`,
        description: `Table ${table.number} released and marked Available (customer left or changed table).`
      }).catch(() => {});

      toast.success(`Table ${table.number} released and marked Available.`);
    } catch (err) {
      console.error('[WaiterMatrix] Release table failed:', err);
      toast.error(`Failed to release Table ${table.number}.`);
    }
  };

  const handleQuickStatusChange = async (table: ITable, newStatus: string) => {
    if (!user?.tenantId) return;
    try {
      if (newStatus.toLowerCase() === 'available') {
        await handleReleaseTable(table);
        return;
      }

      // Optimistic update
      setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: newStatus, tableStatus: newStatus } : t));

      await tableService.updateTableStatusDirect(user.tenantId, table.id, newStatus, {
        assignedWaiterId: table.assignedWaiterId || user.uid,
        assignedWaiterName: table.assignedWaiterName || user.displayName || user.email || 'Staff Waiter'
      });
      toast.success(`Table ${table.number} status updated to ${newStatus}`);
    } catch (err) {
      console.error('[WaiterMatrix] Quick status change error:', err);
      toast.error('Failed to update table status.');
    }
  };

  const handleClaimTable = async (tableId: string) => {
    if (!user?.tenantId || !user.uid) return;
    try {
      const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', tableId);
      await updateDoc(tableRef, {
        assignedWaiterId: user.uid,
        assignedWaiterName: user.displayName || user.email || 'Staff Waiter',
        updatedAt: new Date().toISOString()
      });
      toast.success('You have claimed this table as server.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to claim table.');
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
        await tableService.setTableCleaning(user.tenantId, tableObj.id, 10);
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
    if (!orderTable) {
      toast.error('No table selected for order.');
      return;
    }
    if (Object.keys(cart).length === 0) {
      toast.error('Please add dishes to the order basket.');
      return;
    }

    const effectiveTenantId = user?.tenantId || (orderTable as any)?.tenantId || localStorage.getItem('lastTenantId') || localStorage.getItem('tenantId') || localStorage.getItem('spiral_tenant_id') || '';

    if (!effectiveTenantId) {
      toast.error('Restaurant ID missing. Please refresh or re-login.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const orderId = generateUniqueOrderId();
      const orderItems = Object.values(cart).map(entry => ({
        menuItemId: entry.item.id,
        name: entry.item.name,
        count: entry.count,
        pricePerUnit: entry.item.discountPrice || entry.item.price,
        status: 'PENDING',
        isVeg: entry.item.isVeg ?? entry.item.veg ?? true,
        category: entry.item.category || 'Dishes',
        specialInstructions: orderNotes.trim() || ''
      }));

      const taxAmount = Math.round(cartTotal * 0.05);
      const totalAmount = cartTotal + taxAmount;

      const newOrderData: Record<string, any> = {
        id: orderId,
        orderId,
        tenantId: effectiveTenantId,
        tableNumber: String(orderTable.number || (orderTable as any).tableNumber || '1'),
        tableId: orderTable.id || `TBL-${orderTable.number || '1'}`,
        waiterId: user?.uid || 'staff-waiter',
        waiterName: user?.displayName || user?.email || 'Floor Waiter',
        status: 'NEW',
        paymentStatus: 'pending',
        items: orderItems,
        subtotal: cartTotal,
        tax: taxAmount,
        total: totalAmount,
        createdAt: new Date().toISOString(),
        customerName: customerName.trim() || orderTable.customerName || 'Diner party',
        customerPhone: customerPhone.trim() || orderTable.customerPhone || '',
        orderNotes: orderNotes.trim() || '',
        specialInstructions: orderNotes.trim() || '',
        orderSource: 'waiter_pos',
        timeline: [
          {
            type: 'PLACED',
            title: 'Order Placed by Waiter',
            description: `Table-side order taken by ${user?.displayName || user?.email || 'Waiter'}${orderNotes.trim() ? ` (Notes: "${orderNotes.trim()}")` : ''}`,
            timestamp: new Date().toISOString(),
            performedBy: user?.displayName || 'Waiter'
          }
        ]
      };

      // Strip any potential undefined keys before writing to Firestore
      const cleanOrderData = JSON.parse(JSON.stringify(newOrderData));
      const orderRef = doc(db, 'restaurants', effectiveTenantId, 'orders', orderId);
      await setDoc(orderRef, cleanOrderData);

      // Link order to table via tableService (wrapped gracefully)
      try {
        await tableService.setTableOccupiedWithOrder(
          effectiveTenantId,
          orderTable.id || orderTable.number,
          orderId,
          {
            total: totalAmount,
            itemsCount: orderItems.length,
            customerName: cleanOrderData.customerName,
            guestsCount: orderTable.guestsCount || 2
          }
        );
      } catch (tableErr) {
        console.warn('Non-blocking table status sync notice:', tableErr);
      }

      toast.success(`Order #${orderId.slice(-6)} submitted to kitchen!`);

      try {
        logEvent(effectiveTenantId, {
          eventType: 'Order Placed',
          eventCategory: 'Waiter',
          performedBy: user?.displayName || user?.email || 'Waiter',
          performedByRole: user?.role || 'waiter',
          orderId,
          tableNumber: orderTable.number,
          title: 'Table-side Order Placed',
          description: `New order #${orderId.substring(0, 8)} placed. Total: ${formatPrice(totalAmount)}.`
        });
      } catch (_) {}

      setOrderTable(null);
      setCart({});
      setCustomerName('');
      setCustomerPhone('');
      setOrderNotes('');
      setMenuSearchQuery('');
      setMenuCategoryFilter('All');
      setMenuDietaryFilter('all');
    } catch (e: any) {
      console.error('Failed to submit order:', e);
      toast.error(e?.message ? `Failed to submit order: ${e.message}` : 'Failed to submit order.');
    } finally {
      setIsSubmittingOrder(false);
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
  // ─── Render Greeting & Shift Header Banner ───
  const renderShiftControlCard = () => {
    const rawName = user?.displayName || user?.email?.split('@')[0] || 'Waiter';
    const waiterName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const activeRestName = restaurantName || (user as any)?.restaurantName || (user?.tenantId ? user.tenantId.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Paradise Biryani');
    const durationStr = shift.isActive ? formatDuration(getShiftWorkingTime(shift)) : '';

    return (
      <div className="bg-white border border-[#E3DED5] rounded-3xl p-5 sm:p-6 shadow-xs text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Sun className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#18201D] tracking-tight">
                Good Afternoon, {waiterName}!
              </h2>
              <p className="text-xs text-[#5F6875] font-semibold mt-0.5">
                Here's what's happening on the floor today.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold text-[#18201D]">
                {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <div className="text-[11px] text-[#5F6875] font-mono">
                {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E3DED5] bg-[#F7F4EE] text-xs font-bold text-[#18201D]">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span>{activeRestName}</span>
            </div>

            {shift.isActive ? (
              <div className="flex items-center gap-2">
                {shift.status === 'active' ? (
                  <button
                    onClick={handleStartBreak}
                    className="flex items-center gap-1 text-xs font-bold py-1.5 px-3 rounded-xl border border-[#E3DED5] bg-white text-[#18201D] hover:bg-[#F7F4EE] transition-all"
                  >
                    <Coffee className="w-3 h-3 text-amber-600" />
                    <span>Break</span>
                  </button>
                ) : (
                  <button
                    onClick={handleEndBreak}
                    className="flex items-center gap-1 text-xs font-bold py-1.5 px-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 transition-all"
                  >
                    <Play className="w-3 h-3 text-amber-600" />
                    <span>Resume</span>
                  </button>
                )}
                <button
                  onClick={handleEndShiftClick}
                  className="flex items-center gap-1 text-xs font-bold py-1.5 px-3 rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-600 hover:text-white transition-all"
                >
                  <Square className="w-3 h-3" />
                  <span>End Shift</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartShift}
                className="flex items-center gap-1 text-xs font-black py-1.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs transition-all"
              >
                <Play className="w-3 h-3" />
                <span>Clock In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Render 6 Metrics Overview Cards ───
  const renderCommandHeaderMetrics = () => {
    const myTablesCount = tables.filter(t => t.assignedWaiterId === user?.uid && (t.status === 'occupied' || t.status === 'Occupied')).length;
    const activeOrders = orders.filter(o => isOrderActive(o));
    const activeOrdersCount = activeOrders.length;

    let readyItemsCount = 0;
    let partiallyReadyOrdersCount = 0;

    activeOrders.forEach(o => {
      const items = o.items || [];
      let orderHasReady = false;
      let orderHasUnfinished = false;

      items.forEach((item: any) => {
        const isServed = item.servingStatus === 'SERVED' || item.status === 'SERVED' || o.status === 'SERVED';
        const isReady = !isServed && (item.servingStatus === 'READY_TO_SERVE' || item.prepStatus === 'READY' || item.status === 'READY' || o.status === 'READY');
        const isUnfinished = !isServed && !isReady;

        if (isReady) {
          orderHasReady = true;
          readyItemsCount += Number(item.count || item.quantity || 1);
        }
        if (isUnfinished) {
          orderHasUnfinished = true;
        }
      });

      if (o.status === 'PARTIALLY_READY' || (orderHasReady && orderHasUnfinished)) {
        partiallyReadyOrdersCount++;
      }
    });

    const pendingTasksCount = optimizedTasks.length;
    const efficiency = performanceStats.efficiencyScore;

    const today = new Date().toDateString();
    const pendingBillsOrders = orders.filter(o => {
      if (!isOrderActive(o)) return false;
      if (o.createdAt) {
        const ageMs = Date.now() - new Date(o.createdAt).getTime();
        if (ageMs > 24 * 60 * 60 * 1000) return false;
      }
      return (
        o.status === 'BILL_REQUESTED' || 
        (o.paymentStatus === 'pending' && (o.status === 'SERVED' || o.status === 'DELIVERED' || o.status === 'DINING'))
      );
    });
    const pendingBillsCount = pendingBillsOrders.length;
    const pendingBillsTotal = pendingBillsOrders.reduce((sum, o) => sum + (o.total || 0), 0);

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
    const avgStay = stayCount > 0 ? `${Math.round(totalStayMinutes / stayCount)}m` : '81m';

    const totalTablesCount = tables.length || 8;
    const todayOrdersCount = orders.filter(o => new Date(o.createdAt).toDateString() === today).length;
    const turnoverRate = (todayOrdersCount / totalTablesCount).toFixed(1);
    const tableTurnover = `${turnoverRate}x`;
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. My Seated Tables */}
        <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 flex items-center gap-3.5 shadow-xs text-left">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <div className="text-[9.5px] font-extrabold uppercase text-[#5F6875] tracking-wider">MY SEATED TABLES</div>
            <div className="text-xl font-black text-[#18201D] leading-tight">{myTablesCount}</div>
            <div className="text-[10px] text-[#5F6875] font-semibold">of {tables.length} tables</div>
          </div>
        </div>

        {/* 2. Active Orders */}
        <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 flex items-center gap-3.5 shadow-xs text-left">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Utensils className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-[9.5px] font-extrabold uppercase text-[#5F6875] tracking-wider">ACTIVE ORDERS</div>
            <div className="text-xl font-black text-[#18201D] leading-tight">{activeOrdersCount}</div>
            <div className="text-[10px] text-[#5F6875] font-semibold">{activeOrdersCount === 1 ? '1 active order' : `${activeOrdersCount} active orders`}</div>
          </div>
        </div>

        {/* 3. Ready Items */}
        <div className={`bg-white border rounded-2xl p-4 flex items-center gap-3.5 shadow-xs text-left transition-all ${
          readyItemsCount > 0 ? 'border-[#16A34A] ring-1 ring-[#16A34A]/20' : 'border-[#E3DED5]'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            readyItemsCount > 0 ? 'bg-[#EAF6ED] text-[#16A34A] animate-pulse' : 'bg-emerald-50 text-emerald-500'
          }`}>
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[9.5px] font-extrabold uppercase text-[#5F6875] tracking-wider">READY ITEMS</div>
            <div className={`text-xl font-black leading-tight ${readyItemsCount > 0 ? 'text-[#16A34A]' : 'text-[#18201D]'}`}>
              {readyItemsCount}
            </div>
            <div className="text-[10px] text-[#5F6875] font-semibold">
              {readyItemsCount > 0 ? 'Waiting to serve' : 'None waiting'}
            </div>
          </div>
        </div>

        {/* 4. Partially Ready Orders */}
        <div className={`bg-white border rounded-2xl p-4 flex items-center gap-3.5 shadow-xs text-left transition-all ${
          partiallyReadyOrdersCount > 0 ? 'border-[#7C3AED] ring-1 ring-[#7C3AED]/20' : 'border-[#E3DED5]'
        }`}>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-[9.5px] font-extrabold uppercase text-[#5F6875] tracking-wider">PARTIALLY READY</div>
            <div className={`text-xl font-black leading-tight ${partiallyReadyOrdersCount > 0 ? 'text-[#7C3AED]' : 'text-[#18201D]'}`}>
              {partiallyReadyOrdersCount}
            </div>
            <div className="text-[10px] text-[#5F6875] font-semibold">
              {partiallyReadyOrdersCount === 0 ? 'All synced' : 'Partial ready orders'}
            </div>
          </div>
        </div>

        {/* 5. Pending Bills */}
        <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 flex items-center gap-3.5 shadow-xs text-left">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <div className="text-[9.5px] font-extrabold uppercase text-[#5F6875] tracking-wider">PENDING BILLS</div>
            <div className="text-base font-black text-[#18201D] leading-tight">
              {pendingBillsCount} ({formatPrice(pendingBillsTotal)})
            </div>
            <div className="text-[10px] text-[#5F6875] font-semibold">
              {pendingBillsCount === 0 ? 'No pending bills' : 'Action needed'}
            </div>
          </div>
        </div>

        {/* 6. Stay & Turnover */}
        <div className="bg-white border border-[#E3DED5] rounded-2xl p-4 flex items-center gap-3.5 shadow-xs text-left">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-cyan-600" />
          </div>
          <div>
            <div className="text-[9.5px] font-extrabold uppercase text-[#5F6875] tracking-wider">STAY & TURNOVER</div>
            <div className="text-[11px] font-black text-[#18201D] leading-tight truncate">
              Stay: <span className="font-mono">{avgStay}</span> · Turn: <span className="font-mono">{tableTurnover}</span>
            </div>
            <div className="text-[10px] text-[#5F6875] font-semibold">Live average</div>
          </div>
        </div>
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

  // ─── Render Task Card Helper ───
  const renderTaskCard = (task: IWaiterTask) => {
    const elapsedMins = Math.floor((Date.now() - new Date(task.createdAt).getTime()) / 60000);
    const elapsedText = elapsedMins < 1 ? 'Just now' : `${elapsedMins}m ago`;
    const isOrder = task.source === 'order';

    return (
      <Card
        key={task.id}
        className={`p-4 border text-left rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          task.status === 'Accepted'
            ? 'border-indigo-500/20 bg-indigo-955/5'
            : isOrder
            ? 'border-amber-500/20 bg-amber-500/5'
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
          <h4 className="text-sm font-extrabold text-textPearl flex items-center gap-1.5">
            {isOrder ? '🍽️ ' : '🙋 '}
            <span>{task.type}</span>
          </h4>
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
              <span>{isOrder ? 'Delivered' : 'Resolve'}</span>
            </Button>
          )}
        </div>
      </Card>
    );
  };

  // ─── Render Unified Task Queue ───
  const renderUnifiedTaskQueue = () => {
    const orderTasks = optimizedTasks.filter(t => t.source === 'order');
    const assistanceTasks = optimizedTasks.filter(t => t.source !== 'order');
    
    return (
      <div className="space-y-6">
        {/* Controls Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-extrabold text-textPearl uppercase tracking-wider flex items-center gap-1.5">
              <ListTodo className="w-4 h-4 text-primary" />
              <span>Live Service Feed</span>
            </h3>
            <span className="text-[11px] font-bold text-slate-500">
              Orders: <strong className="text-amber-400">{orderTasks.length}</strong> · Assistance: <strong className="text-emerald-400">{assistanceTasks.length}</strong>
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-0.5 rounded-lg flex items-center space-x-0.5 text-[10px] font-bold">
            {[
              { id: 'all', label: 'All Queues' },
              { id: 'delivery', label: `Orders (${orderTasks.length})` },
              { id: 'request', label: `Assistance (${assistanceTasks.length})` },
              { id: 'bill', label: 'Bills' },
              { id: 'cleaning', label: 'Cleaning' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setQueueFilter(opt.id as any)}
                className={`px-2.5 py-1 rounded-md transition-all font-bold cursor-pointer ${
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

        {/* ── QUEUE 1: FOOD ORDERS QUEUE ── */}
        {(queueFilter === 'all' || queueFilter === 'delivery') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-850">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                🍽️ Customer Food Orders Queue ({orderTasks.length})
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                Food & Drink Dispatch
              </span>
            </div>
            {orderTasks.length === 0 ? (
              <Card className="p-6 text-center border border-dashed border-slate-850 bg-slate-950/20 rounded-2xl">
                <CheckCircle className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-500">No food delivery tasks pending.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {orderTasks.map(task => renderTaskCard(task))}
              </div>
            )}
          </div>
        )}

        {/* ── QUEUE 2: ASSISTANCE REQUESTS QUEUE ── */}
        {(queueFilter === 'all' || queueFilter === 'request' || queueFilter === 'bill' || queueFilter === 'cleaning') && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-850">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                🙋 Customer Assistance Queue ({
                  queueFilter === 'bill'
                    ? assistanceTasks.filter(t => t.type === 'Bill Request' || t.type === 'Generate Bill').length
                    : queueFilter === 'cleaning'
                    ? assistanceTasks.filter(t => t.type === 'Cleaning' || t.type === 'Clean Table').length
                    : assistanceTasks.length
                })
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                Water, Plates, Cutlery, Tissues, Bills & Help
              </span>
            </div>
            {assistanceTasks.length === 0 ? (
              <Card className="p-6 text-center border border-dashed border-slate-850 bg-slate-950/20 rounded-2xl">
                <CheckCircle className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-500">No active customer assistance requests.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {assistanceTasks
                  .filter(t => {
                    if (queueFilter === 'bill') return t.type === 'Bill Request' || t.type === 'Generate Bill';
                    if (queueFilter === 'cleaning') return t.type === 'Cleaning' || t.type === 'Clean Table';
                    return true;
                  })
                  .map(task => renderTaskCard(task))}
              </div>
            )}
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

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center space-x-6 border-b border-[#E3DED5]/80 pb-0 overflow-x-auto scrollbar-none">
            {(
              [
                { id: 'command_center', label: 'Command Queue', Icon: ListTodo },
                { id: 'floor_map', label: 'Floor Matrix Seating', Icon: LayoutGrid },
                { id: 'cleaning', label: 'Sanitizing Duties', Icon: Sparkles, count: tables.filter(t => isTableCleaning(t.status)).length },
                { id: 'stats', label: 'Performance Summary', Icon: Award },
                { id: 'live_feed', label: 'Operations Event Feed', Icon: Activity },
                ...(isManagerOrOwner ? [{ id: 'manager_console', label: 'Manager Allocation Console', Icon: Users }] : [])
              ] as { id: TWaiterTab; label: string; Icon?: any; count?: number }[]
            ).map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 pb-3 text-xs font-bold transition-all outline-none shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-[#C85A3F] border-b-2 border-[#C85A3F] font-extrabold'
                      : 'text-[#5F6875] hover:text-[#18201D] border-b-2 border-transparent'
                  }`}
                >
                  {tab.Icon && <tab.Icon className={`w-4 h-4 ${isActive ? 'text-[#C85A3F]' : 'text-[#71717A]'}`} />}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#F5F0FD] text-[#7C3AED] text-[10px] font-bold">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
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
              {/* Floor Matrix Header Controls & Live Counters */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* Filter Chips */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => setFloorFilter('all')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      floorFilter === 'all'
                        ? 'bg-[#C85A3F] text-white shadow-xs'
                        : 'bg-white text-[#5F6875] border border-[#E3DED5] hover:text-[#18201D]'
                    }`}
                  >
                    All Tables ({tables.length})
                  </button>

                  <button
                    onClick={() => setFloorFilter('available')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      floorFilter === 'available'
                        ? 'bg-[#183B2B] text-white border-[#183B2B] shadow-xs'
                        : 'bg-[#EAF6ED] text-[#227244] border-[#CDE9D5] hover:bg-[#DEF0E2]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                    <span>Available ({tables.filter(t => {
                      const activeOrders = findAllActiveOrdersForTable(t, orders);
                      const raw = t.status || (t as any).tableStatus;
                      return activeOrders.length === 0 && !isTableCleaning(raw) && !isTableSeated(t, false) && !isTableBrowsing(t, 5);
                    }).length})</span>
                  </button>

                  <button
                    onClick={() => setFloorFilter('browsing')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      floorFilter === 'browsing'
                        ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                        : 'bg-[#EAF2FD] text-[#2563EB] border-[#D0E2FB] hover:bg-[#DCEBFC]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#2563EB]" />
                    <span>Browsing ({tables.filter(t => {
                      const activeOrders = findAllActiveOrdersForTable(t, orders);
                      const raw = t.status || (t as any).tableStatus;
                      return activeOrders.length === 0 && !isTableCleaning(raw) && !isTableSeated(t, false) && isTableBrowsing(t, 5);
                    }).length})</span>
                  </button>

                  <button
                    onClick={() => setFloorFilter('occupied')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      floorFilter === 'occupied'
                        ? 'bg-[#D97706] text-white border-[#D97706] shadow-xs'
                        : 'bg-[#FEF7EC] text-[#D97706] border-[#FDE6B8] hover:bg-[#FDEED5]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                    <span>Occupied ({tables.filter(t => {
                      const activeOrders = findAllActiveOrdersForTable(t, orders);
                      return activeOrders.length > 0 || isTableSeated(t, false);
                    }).length})</span>
                  </button>

                  <button
                    onClick={() => setFloorFilter('partially_ready')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      floorFilter === 'partially_ready'
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs'
                        : 'bg-[#F5F0FD] text-[#7C3AED] border-[#E4D4FA] hover:bg-[#ECE4FB]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#9333EA] animate-pulse" />
                    <span>Partially Ready ({tables.filter(t => getTableItemServingMetrics(t, orders).hasReady).length})</span>
                  </button>

                  <button
                    onClick={() => setFloorFilter('cleaning')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      floorFilter === 'cleaning'
                        ? 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs'
                        : 'bg-[#F5F0FD] text-[#7C3AED] border-[#E4D4FA] hover:bg-[#ECE4FB]'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#9333EA]" />
                    <span>Cleaning ({tables.filter(t => isTableCleaning(t.status)).length})</span>
                  </button>

                  <button
                    onClick={() => setFloorFilter('my_tables')}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                      floorFilter === 'my_tables'
                        ? 'bg-[#18201D] text-white border-[#18201D] shadow-xs'
                        : 'bg-white text-[#5F6875] border-[#E3DED5] hover:text-[#18201D]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>My Tables ({tables.filter(t => t.assignedWaiterId === user?.uid).length})</span>
                  </button>
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 bg-white border border-[#E3DED5] rounded-full px-4 py-2 text-xs text-[#18201D] shadow-xs w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Search table #, location..."
                    value={floorSearch}
                    onChange={(e) => setFloorSearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs text-[#18201D] placeholder-[#9CA3AF] w-full"
                  />
                  {floorSearch && (
                    <button onClick={() => setFloorSearch('')} className="text-[#9CA3AF] hover:text-[#18201D] text-xs">✕</button>
                  )}
                </div>
              </div>

              {/* Table Cards Grid - 4 Columns on Desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tables
                  .filter(t => {
                    if (floorSearch.trim()) {
                      const q = floorSearch.toLowerCase().trim();
                      const numMatch = String(t.number || (t as any).tableNumber || '').toLowerCase().includes(q);
                      const secMatch = String(t.section || '').toLowerCase().includes(q);
                      if (!numMatch && !secMatch) return false;
                    }
                    const activeOrders = findAllActiveOrdersForTable(t, orders);
                    const rawStatus = t.status || (t as any).tableStatus;
                    const isClean = isTableCleaning(rawStatus);
                    const isDin = activeOrders.length > 0;
                    const isSeated = !isDin && !isClean && isTableSeated(t, false);
                    const isBrowse = !isDin && !isClean && !isSeated && isTableBrowsing(t, 5);
                    const isAvail = !isDin && !isClean && !isSeated && !isBrowse;

                    switch (floorFilter) {
                      case 'available': return isAvail;
                      case 'browsing': return isBrowse;
                      case 'occupied': return isDin || isSeated;
                      case 'partially_ready': return getTableItemServingMetrics(t, orders).hasReady;
                      case 'cleaning': return isClean;
                      case 'my_tables': return t.assignedWaiterId === user?.uid;
                      case 'all': default: return true;
                    }
                  })
                  .map(table => {
                    const assignedToMe = table.assignedWaiterId === user?.uid;
                    const rawStatus = table.status || (table as any).tableStatus;
                    const activeOrdersForTable = findAllActiveOrdersForTable(table, orders);
                    const activeOrderForTable = activeOrdersForTable[0];
                    const latestOrderForTable = activeOrdersForTable[activeOrdersForTable.length - 1];
                    const isOccupiedWithOrder = activeOrdersForTable.length > 0;
                    const isCleaning = isTableCleaning(rawStatus);
                    const isOccupiedWithoutOrder = !isOccupiedWithOrder && !isCleaning && isTableSeated(table, false);
                    const isBrowsing = !isOccupiedWithOrder && !isCleaning && !isOccupiedWithoutOrder && isTableBrowsing(table, 5);
                    const isAvailable = !isOccupiedWithOrder && !isCleaning && !isOccupiedWithoutOrder && !isBrowsing;

                    const roundsCount = activeOrdersForTable.length;
                    const isMultiRound = roundsCount > 1;

                    // Cumulative table bill: sum of all active unfinalized orders
                    const orderTotal = activeOrdersForTable.reduce(
                      (sum, o) => sum + Number(o.total || (o as any)?.totalAmount || 0),
                      0
                    );

                    // Combined items list across all rounds
                    const allTableItems = activeOrdersForTable.flatMap(o => o.items || []);
                    const itemsCount = allTableItems.length;
                    const itemsSnippet = allTableItems.slice(0, 3).map((it: any) => `${it.count || 1}x ${it.name}`).join(', ') + (allTableItems.length > 3 ? '...' : '');

                    const customerName = table.customerName || 
                      activeOrdersForTable.find(o => o.customerName || (o as any)?.userName || (o as any)?.name)?.customerName || 
                      (activeOrdersForTable[0] as any)?.userName || 
                      (isOccupiedWithOrder || isBrowsing ? 'Guest Diner' : null);

                    const metrics = getTableItemServingMetrics(table, orders);
                    const readyOrder = activeOrdersForTable.find(o => o.status === 'READY');
                    const hasReady = metrics.hasReady || Boolean(readyOrder);
                    const hasPreparing = activeOrdersForTable.some(o => o.status === 'PREPARING');
                    const hasNew = activeOrdersForTable.some(o => o.status === 'NEW' || o.status === 'PLACED');
                    const allServed = activeOrdersForTable.length > 0 && activeOrdersForTable.every(o => o.status === 'SERVED' || o.status === 'DELIVERED' || o.status === 'DINING_COMPLETED');
                    const isOrderPaid = activeOrdersForTable.length > 0 && activeOrdersForTable.every(o => (o.paymentStatus || '').toLowerCase() === 'paid');

                    let orderStatusDisplay = 'ACTIVE';
                    let statusBadgeClass = 'bg-stone-100 text-stone-700';

                    if (metrics.isPartiallyReady) {
                      orderStatusDisplay = 'PARTIALLY READY';
                      statusBadgeClass = 'bg-[#F5F0FD] text-[#7C3AED] border border-[#E4D4FA]';
                    } else if (metrics.isFullyReady || hasReady) {
                      orderStatusDisplay = 'FOOD READY';
                      statusBadgeClass = 'bg-[#EAF6ED] text-[#16A34A] animate-pulse';
                    } else if (allServed) {
                      orderStatusDisplay = 'SERVED';
                      statusBadgeClass = 'bg-[#EAF6ED] text-[#16A34A]';
                    } else if (isMultiRound && (hasNew || hasPreparing)) {
                      orderStatusDisplay = hasNew ? `ROUND ${roundsCount}: NEW` : `ROUND ${roundsCount}: COOKING`;
                      statusBadgeClass = 'bg-[#FEF7EC] text-[#D97706]';
                    } else if (latestOrderForTable?.status === 'NEW' || latestOrderForTable?.status === 'PLACED') {
                      orderStatusDisplay = 'NEW';
                      statusBadgeClass = 'bg-[#FEF7EC] text-[#D97706]';
                    } else if (latestOrderForTable?.status === 'PREPARING') {
                      orderStatusDisplay = 'PREPARING';
                      statusBadgeClass = 'bg-[#FEF7EC] text-[#D97706]';
                    } else {
                      orderStatusDisplay = (latestOrderForTable?.status || 'ACTIVE').toUpperCase();
                    }

                    const activeAssistanceForTable = waiterRequests.find(r => cleanTableIdentifier(r.tableNumber) === cleanTableIdentifier(table.number) && r.status !== 'Completed' && r.status !== 'Cancelled');
                    
                    const cleaningTimer = isCleaning ? getCleaningCountdown(table) : null;
                    const seatedElapsedMins = table.seatedAt || table.occupiedAt ? Math.max(0, Math.floor((Date.now() - new Date(table.seatedAt || table.occupiedAt!).getTime()) / 60000)) : null;
                    
                    const primaryOrderTime = activeOrderForTable?.createdAt ? (() => {
                      try {
                        const d = new Date(activeOrderForTable.createdAt);
                        if (isNaN(d.getTime())) return null;
                        const diffMins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
                        const isToday = d.toDateString() === new Date().toDateString();
                        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                        const datePrefix = isToday ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ';
                        const relative = diffMins < 1 ? 'Just now' : diffMins < 60 ? `${diffMins}m ago` : diffMins < 1440 ? `${Math.floor(diffMins/60)}h ${diffMins%60}m ago` : `${Math.floor(diffMins/1440)}d ago`;
                        return { fullTime: `${datePrefix}${timeStr}`, relative };
                      } catch {
                        return null;
                      }
                    })() : null;

                    const latestOrderTime = latestOrderForTable && latestOrderForTable !== activeOrderForTable && latestOrderForTable.createdAt ? (() => {
                      try {
                        const d = new Date(latestOrderForTable.createdAt);
                        if (isNaN(d.getTime())) return null;
                        const diffMins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
                        const relative = diffMins < 1 ? 'Just now' : diffMins < 60 ? `${diffMins}m ago` : `${Math.floor(diffMins/60)}h ago`;
                        return { relative };
                      } catch {
                        return null;
                      }
                    })() : null;

                    return (
                      <div
                        key={table.id}
                        className="bg-white border border-[#E3DED5] rounded-2xl p-4 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow relative"
                      >
                        <div>
                          {/* Card Header: Table Number, Section, Status Badge & Options Menu */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <h3 className="font-extrabold text-base text-[#18201D]">
                                Table {table.number}
                              </h3>
                              <div className="flex items-center gap-1 text-[11px] text-[#71717A] mt-0.5 font-medium">
                                <MapPin className="w-3 h-3 text-[#A1A1AA]" />
                                <span>{table.section || 'Indoor Main'}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Status Badge */}
                              {isCleaning ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#F5F0FD] text-[#7C3AED]">
                                  <span className="w-2 h-2 rounded-full bg-[#9333EA]" /> Cleaning
                                </span>
                              ) : isBrowsing ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#EAF2FD] text-[#2563EB]">
                                  <span className="w-2 h-2 rounded-full bg-[#2563EB]" /> Browsing
                                </span>
                              ) : isOccupiedWithoutOrder ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#FEF7EC] text-[#D97706] border border-[#FDE6B8]">
                                  <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" /> Occupied
                                </span>
                              ) : isOccupiedWithOrder ? (
                                metrics.isPartiallyReady ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#F5F0FD] text-[#7C3AED] border border-[#E4D4FA]">
                                    <span className="w-2 h-2 rounded-full bg-[#9333EA] animate-pulse" /> Partially Ready
                                  </span>
                                ) : (metrics.isFullyReady || hasReady) ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#EAF6ED] text-[#16A34A] border border-[#CDE9D5]">
                                    <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" /> Ready to Serve
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#FEF7EC] text-[#D97706]">
                                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Dining
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-[#EAF6ED] text-[#227244]">
                                  <span className="w-2 h-2 rounded-full bg-[#16A34A]" /> Available
                                </span>
                              )}

                              {/* Three-dots quick action menu */}
                              <div className="relative group">
                                <button 
                                  type="button" 
                                  className="p-1 rounded-md text-[#A1A1AA] hover:text-[#18201D] hover:bg-stone-100 transition-colors cursor-pointer"
                                  title="Table Actions"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-[#E3DED5] rounded-xl shadow-lg p-1.5 z-20 w-36 text-xs font-semibold">
                                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-[#A1A1AA]">Set Status</div>
                                  <button onClick={() => handleQuickStatusChange(table, 'Available')} className="px-2 py-1 rounded-lg text-left hover:bg-[#EAF6ED] text-[#227244] cursor-pointer">🟢 Available</button>
                                  <button onClick={() => handleQuickStatusChange(table, 'browsing')} className="px-2 py-1 rounded-lg text-left hover:bg-[#EAF2FD] text-[#2563EB] cursor-pointer">🔵 Browsing</button>
                                  <button onClick={() => handleQuickStatusChange(table, 'Occupied')} className="px-2 py-1 rounded-lg text-left hover:bg-[#FEF7EC] text-[#D97706] cursor-pointer">🟡 Dining</button>
                                  <button onClick={() => handleQuickStatusChange(table, 'cleaning')} className="px-2 py-1 rounded-lg text-left hover:bg-[#F5F0FD] text-[#7C3AED] cursor-pointer">🟣 Cleaning</button>
                                  <button onClick={() => handleQuickStatusChange(table, 'Reserved')} className="px-2 py-1 rounded-lg text-left hover:bg-stone-100 text-stone-700 cursor-pointer">🔒 Reserved</button>
                                  <div className="border-t border-stone-100 my-1" />
                                  <button onClick={() => handleReleaseTable(table)} className="px-2 py-1 rounded-lg text-left hover:bg-red-50 text-red-600 font-bold cursor-pointer flex items-center gap-1">
                                    <UserMinus className="w-3.5 h-3.5 text-red-600" /> Release Table
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="mb-3">
                            {isCleaning ? (
                              <div className="bg-[#FAF7FD] border border-[#EADDFB] p-3 rounded-xl space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-extrabold text-[#7C3AED] flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>CLEANING</span>
                                  </span>
                                  <span className={`font-mono font-bold text-[11px] ${cleaningTimer?.isOverdue ? 'text-red-500 animate-pulse' : 'text-[#7C3AED]'}`}>
                                    {cleaningTimer?.isOverdue ? `Overdue (${cleaningTimer.elapsedMins}m)` : `${cleaningTimer?.displayTime} left`}
                                  </span>
                                </div>
                                <div className="w-full bg-[#E4D4FA] h-1.5 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-1000 ${cleaningTimer?.isOverdue ? 'bg-red-500' : 'bg-[#7C3AED]'}`}
                                    style={{ width: `${Math.min(100, Math.max(5, (1 - (cleaningTimer?.remainingMins || 0) / 10) * 100))}%` }}
                                  />
                                </div>
                                <p className="text-[10px] text-[#71717A] leading-tight">
                                  Dining complete & bill settled. Sanitize table.
                                </p>
                              </div>
                            ) : isBrowsing ? (
                              <div className="bg-[#F0F6FE] border border-[#D8E6FC] p-3 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-[#2563EB] flex items-center gap-1.5">
                                    <BookOpen className="w-3.5 h-3.5 text-[#2563EB]" />
                                    <span>Browsing Menu</span>
                                  </span>
                                  <span className="text-[10px] font-semibold text-[#5F6875] bg-white border border-[#D8E6FC] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                    <Smartphone className="w-2.5 h-2.5 text-[#5F6875]" />
                                    <span>{table.orderSource === 'qr' ? 'QR Order' : 'App Order'}</span>
                                  </span>
                                </div>
                                <div className="text-xs font-bold text-[#18201D] truncate flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-[#5F6875]" />
                                  <span className="truncate">{customerName || 'Guest Diner'}</span>
                                </div>
                                <div className="text-[11px] text-[#71717A] flex items-center justify-between pt-0.5">
                                  <span>{seatedElapsedMins !== null ? `Seated ~${seatedElapsedMins}m ago` : 'Just arrived'}</span>
                                  <span className="font-semibold text-[#2563EB]">Viewing Dishes</span>
                                </div>
                              </div>
                            ) : isOccupiedWithOrder && activeOrderForTable ? (
                              <div className="bg-[#FCF9F5] border border-[#F0ECE6] p-3 rounded-xl space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-[#18201D] truncate flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-[#5F6875]" />
                                    <span className="truncate">{customerName || 'Guest Diner'}</span>
                                  </span>
                                  <span className="font-black text-[#16A34A] shrink-0 text-sm">
                                    {formatPrice(orderTotal)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-[#71717A]">
                                  <div className="flex items-center gap-1.5 truncate">
                                    {isMultiRound ? (
                                      <button
                                        type="button"
                                        onClick={() => setDrawerState({
                                          isOpen: true,
                                          table,
                                          orders: activeOrdersForTable,
                                          initialSelectReadyItems: false,
                                        })}
                                        className="inline-flex items-center gap-1 font-bold text-[10px] bg-amber-100/80 hover:bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                                        title="Click to view all rounds"
                                      >
                                        <span>{roundsCount} Rounds</span>
                                        <span className="font-mono text-[9px] opacity-75">#{activeOrderForTable.orderId.slice(-4)}+#{latestOrderForTable.orderId.slice(-4)}</span>
                                      </button>
                                    ) : (
                                      <span className="font-mono font-medium">#{activeOrderForTable.orderId.slice(-6)}</span>
                                    )}
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${statusBadgeClass}`}>
                                    {orderStatusDisplay}
                                  </span>
                                </div>

                                {/* Item serving summary breakdown for active orders */}
                                {(metrics.hasReady || metrics.servedCount > 0) && (
                                  <div className="bg-[#FAF7FD] border border-[#EADDFB] p-2 rounded-lg flex items-center justify-between text-[10.5px] font-bold text-[#5F6875] my-1">
                                    <span className={metrics.readyCount > 0 ? 'text-[#16A34A] flex items-center gap-1' : 'text-stone-400'}>
                                      {metrics.readyCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />}
                                      <span>{metrics.readyCount} Ready</span>
                                    </span>
                                    <span className="text-stone-300">|</span>
                                    <span className={metrics.servedCount > 0 ? 'text-[#18201D]' : 'text-stone-400'}>
                                      {metrics.servedCount} Served
                                    </span>
                                    <span className="text-stone-300">|</span>
                                    <span className={metrics.remainingCount > 0 ? 'text-[#D97706]' : 'text-stone-400'}>
                                      {metrics.remainingCount} Remaining
                                    </span>
                                  </div>
                                )}

                                {isMultiRound && (
                                  <div className="text-[10px] text-[#71717A] flex items-center justify-between bg-white/70 px-2 py-1 rounded-lg border border-[#F0ECE6]">
                                    <span>Round 1: <strong className="text-[#18201D]">{formatPrice(activeOrderForTable.total || (activeOrderForTable as any)?.totalAmount || 0)}</strong></span>
                                    <span className="text-amber-800 font-semibold">+ R{roundsCount} Add-on: <strong className="text-amber-900">{formatPrice(latestOrderForTable.total || (latestOrderForTable as any)?.totalAmount || 0)}</strong></span>
                                  </div>
                                )}
                                {itemsSnippet && (
                                  <div className="text-[11px] text-[#71717A] truncate" title={itemsSnippet}>
                                    {itemsCount} item{itemsCount > 1 ? 's' : ''}: <span className="text-[#18201D] font-medium">{itemsSnippet}</span>
                                  </div>
                                )}
                                {primaryOrderTime && (
                                  <div className="text-[10px] text-[#71717A] flex items-center justify-between pt-0.5">
                                    <span className="font-semibold text-[#18201D]">Ordered: {primaryOrderTime.fullTime}</span>
                                    <span>
                                      {latestOrderTime ? `(Add-on ${latestOrderTime.relative})` : `(${primaryOrderTime.relative})`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : isOccupiedWithoutOrder ? (
                              <div className="bg-[#FEF7EC] border border-[#FDE6B8] p-3 rounded-xl space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <button
                                    type="button"
                                    onClick={() => openSeatingModal(table)}
                                    className="font-extrabold text-[#D97706] hover:text-[#B45309] flex items-center gap-1.5 hover:underline cursor-pointer transition-colors"
                                    title="Click to adjust guest seating"
                                  >
                                    <Users className="w-3.5 h-3.5 text-[#D97706]" />
                                    <span>{table.guestsCount || table.capacity || table.seatingCapacity || 4} Guests Seated</span>
                                  </button>
                                  <span className="text-[10px] font-bold text-[#D97706] bg-white border border-[#FDE6B8] px-2 py-0.5 rounded-md shadow-2xs">
                                    Awaiting Order
                                  </span>
                                </div>
                                <div className="text-xs font-bold text-[#18201D] truncate flex items-center gap-1.5">
                                  <Armchair className="w-3.5 h-3.5 text-[#D97706]" />
                                  <span className="truncate">{table.customerName || 'Diners at Table'}</span>
                                </div>
                                <div className="text-[11px] text-[#71717A] flex items-center justify-between pt-0.5">
                                  <span>{seatedElapsedMins !== null ? `Seated ~${seatedElapsedMins}m ago` : 'Just seated'}</span>
                                  <span className="font-semibold text-[#D97706]">Ready for Waiter</span>
                                </div>
                                {table.tableNotes && (
                                  <div className="text-[10.5px] text-[#92400E] bg-white/80 border border-[#FDE6B8] px-2 py-1 rounded-lg truncate">
                                    <span className="font-bold">Note: </span>
                                    <span>{table.tableNotes}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="py-2.5 px-0.5 space-y-1.5">
                                <div className="flex items-center gap-2 text-sm font-bold text-[#16A34A]">
                                  <Armchair className="w-4 h-4 text-[#16A34A]" />
                                  <span>Ready for Dining</span>
                                </div>
                                <div className="text-xs text-[#71717A]">
                                  Capacity: <span className="font-medium text-[#18201D]">{table.capacity || table.seatingCapacity || 4} seats</span>
                                </div>
                              </div>
                            )}

                            {/* Server Line */}
                            <div className="flex items-center justify-between text-xs text-[#71717A] pt-2 border-t border-[#F0ECE6] mt-2.5">
                              <span className="flex items-center gap-1.5 truncate">
                                <User className="w-3.5 h-3.5 text-[#A1A1AA]" />
                                <span>Server: <strong className="text-[#18201D]">{table.assignedWaiterName || (assignedToMe ? (user?.displayName || 'Sri Charan') : 'Unassigned')}</strong></span>
                              </span>
                              {!assignedToMe && user?.uid && (
                                <button
                                  type="button"
                                  onClick={() => handleClaimTable(table.id)}
                                  className="text-[11px] text-[#C85A3F] hover:underline font-bold cursor-pointer"
                                >
                                  + Claim
                                </button>
                              )}
                            </div>

                            {/* Attention Alerts */}
                            {metrics.hasReady && (
                              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#16A34A] bg-[#EAF6ED] border border-[#CDE9D5] px-2.5 py-1 rounded-lg w-full animate-pulse">
                                <ChefHat className="w-3.5 h-3.5" />
                                <span>{metrics.readyCount} Dish{metrics.readyCount > 1 ? 'es' : ''} Ready for Pick-up!</span>
                              </div>
                            )}
                            {activeAssistanceForTable && (
                              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#D97706] bg-[#FEF7EC] border border-[#FDE6B8] px-2.5 py-1 rounded-lg w-full">
                                <Bell className="w-3.5 h-3.5" />
                                <span>Alert: {activeAssistanceForTable.requestType || 'Assistance needed'}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Footer Action Buttons */}
                        <div className="pt-2 border-t border-[#F0ECE6] flex items-center gap-2">
                          {isCleaning ? (
                            <button
                              onClick={() => handleCompleteCleaningCC(table)}
                              className="w-full py-2.5 px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Mark Clean & Available</span>
                            </button>
                          ) : isBrowsing ? (
                            <>
                              <button
                                onClick={() => openQuickOrderModal(table)}
                                className="flex-1 py-2 px-3 rounded-xl bg-[#C85A3F] hover:bg-[#B34E35] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                              >
                                <span>+ Punch Order</span>
                              </button>
                              <button
                                onClick={() => openSeatingModal(table)}
                                className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-stone-50 border border-[#E3DED5] text-[#18201D] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                              >
                                <User className="w-3.5 h-3.5 text-[#5F6875]" />
                                <span>Seat Guest</span>
                              </button>
                            </>
                          ) : isOccupiedWithoutOrder ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openQuickOrderModal(table)}
                                className="flex-1 py-2 px-3 rounded-xl bg-[#183B2B] hover:bg-[#122c20] text-white font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs active:scale-95 transition-all cursor-pointer"
                              >
                                <Utensils className="w-3.5 h-3.5 text-white shrink-0" />
                                <span>+ Take Order</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReleaseTable(table)}
                                className="py-2 px-3 rounded-xl bg-white hover:bg-red-50 border border-[#E3DED5] hover:border-red-200 text-stone-700 hover:text-red-600 font-bold text-xs flex items-center justify-center gap-1.5 whitespace-nowrap shadow-xs transition-colors cursor-pointer"
                                title="Customer left or changed table — Release table to Available"
                              >
                                <UserMinus className="w-3.5 h-3.5 text-stone-500 hover:text-red-600 shrink-0" />
                                <span>Release</span>
                              </button>
                            </>
                          ) : isOccupiedWithOrder && activeOrderForTable ? (
                            <>
                              {metrics.hasReady ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setDrawerState({
                                      isOpen: true,
                                      table,
                                      orders: activeOrdersForTable,
                                      initialSelectReadyItems: false,
                                    })}
                                    className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-stone-50 border border-[#E3DED5] text-[#18201D] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                  >
                                    <span>View Order</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDrawerState({
                                      isOpen: true,
                                      table,
                                      orders: activeOrdersForTable,
                                      initialSelectReadyItems: true,
                                    })}
                                    className="flex-1 py-2 px-3 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors animate-pulse cursor-pointer"
                                  >
                                    <ChefHat className="w-3.5 h-3.5" />
                                    <span>Serve Ready Items ({metrics.readyCount})</span>
                                  </button>
                                </>
                              ) : isOrderPaid ? (
                                <button
                                  onClick={() => handleStartCleaning(table)}
                                  className="w-full py-2.5 px-3 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Start Cleaning (10m)</span>
                                </button>
                              ) : isMultiRound ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setDrawerState({
                                      isOpen: true,
                                      table,
                                      orders: activeOrdersForTable,
                                      initialSelectReadyItems: false,
                                    })}
                                    className="flex-1 py-2 px-2.5 rounded-xl bg-white hover:bg-stone-50 border border-[#E3DED5] text-[#18201D] font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                                    title="View order details drawer"
                                  >
                                    <Utensils className="w-3.5 h-3.5 text-[#C85A3F]" />
                                    <span>{roundsCount} Rounds</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateBill(activeOrderForTable)}
                                    className="flex-1 py-2 px-2.5 rounded-xl bg-[#183B2B] hover:bg-[#122c20] text-white font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                                  >
                                    <DollarSign className="w-3.5 h-3.5 text-white" />
                                    <span>Settle Bill</span>
                                  </button>
                                </>
                              ) : (allServed || table.status === 'bill_requested') ? (
                                <button
                                  onClick={() => handleGenerateBill(activeOrderForTable)}
                                  className="w-full py-2.5 px-3 rounded-xl bg-[#183B2B] hover:bg-[#122c20] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>Payment / Settle Bill</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setDrawerState({
                                      isOpen: true,
                                      table,
                                      orders: activeOrdersForTable,
                                      initialSelectReadyItems: false,
                                    })}
                                    className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-stone-50 border border-[#E3DED5] text-[#18201D] font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                  >
                                    <span>View Order</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateBill(activeOrderForTable)}
                                    className="flex-1 py-2 px-3 rounded-xl bg-[#183B2B] hover:bg-[#122c20] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                                  >
                                    <DollarSign className="w-3.5 h-3.5 text-white" />
                                    <span>Settle Bill</span>
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => openSeatingModal(table)}
                                className="flex-1 py-2 px-3 rounded-xl bg-[#183B2B] hover:bg-[#122c20] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                              >
                                <User className="w-3.5 h-3.5 text-white" />
                                <span>Seat Guests</span>
                              </button>
                              <button
                                onClick={() => openQuickOrderModal(table)}
                                className="py-2 px-3 rounded-xl bg-[#FDF0E6] hover:bg-[#F9E2D2] text-[#C85A3F] font-bold text-xs flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                                title="Punch Walk-in Order"
                              >
                                <span>+ Order</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ───────────────── SANITIZING DUTIES VIEW ───────────────── */}
          {activeTab === 'cleaning' && (
            <div className="space-y-4 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-[#18201D] uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Active Sanitization Queue</span>
                  </h3>
                  <p className="text-xs text-[#5F6875]">Dining completed & bill paid. 5–10 min sanitation countdown in progress.</p>
                </div>
                <Badge variant="warning" className="px-3 py-1 font-mono font-bold">
                  {tables.filter(t => isTableCleaning(t.status)).length} Tables Need Cleaning
                </Badge>
              </div>

              {tables.filter(t => isTableCleaning(t.status)).length === 0 ? (
                <Card className="p-8 text-center border border-dashed border-[#E3DED5] bg-white rounded-2xl shadow-xs">
                  <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-[#18201D]">All tables are spotless & available!</h4>
                  <p className="text-xs text-[#5F6875] mt-1">No tables currently pending sanitation or reset.</p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tables.filter(t => isTableCleaning(t.status)).map(table => {
                    const cd = getCleaningCountdown(table);
                    const isAssignedToMe = table.assignedWaiterId === user?.uid;
                    return (
                      <Card key={table.id} className="p-5 border-2 border-amber-300 bg-amber-50/50 text-xs space-y-4 shadow-sm rounded-2xl">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black text-[#18201D]">Table {table.number}</span>
                              <span className="text-[10px] text-slate-500 font-semibold uppercase">({table.section || 'Main Room'})</span>
                            </div>
                            <div className="text-[11px] text-amber-800 font-semibold mt-0.5">
                              {table.assignedWaiterName ? `Waiter: ${table.assignedWaiterName}` : 'Unassigned'}
                            </div>
                          </div>
                          <Badge variant="warning" className="flex items-center gap-1 bg-amber-100 text-amber-800 border-amber-300">
                            <Sparkles className="w-3 h-3 text-amber-600 animate-spin" />
                            <span>Cleaning</span>
                          </Badge>
                        </div>

                        {/* Live 10m countdown bar */}
                        <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="flex items-center gap-1 text-amber-900">
                              <Timer className="w-3.5 h-3.5 text-amber-600" />
                              Sanitization Timer
                            </span>
                            <span className={cd.isOverdue ? 'text-rose-600 font-mono font-black' : 'text-amber-700 font-mono'}>
                              {cd.isOverdue ? 'Overdue - Ready to Reset' : `${cd.displayTime} left`}
                            </span>
                          </div>
                          <div className="w-full bg-amber-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-amber-500 h-full transition-all duration-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(5, (1 - (cd.remainingMins / 10)) * 100))}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-[#5F6875] italic">
                            Clear plates & glasses, sanitize surface, and reset table settings for next guests.
                          </p>
                        </div>

                        <div className="pt-1 flex gap-2">
                          <Button
                            onClick={() => handleCompleteCleaningCC(table)}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          >
                            <Check className="w-4 h-4" />
                            <span>Mark Clean & Available</span>
                          </Button>
                          <select
                            className="text-[11px] font-bold bg-white border border-slate-300 text-slate-700 rounded-xl px-2 py-1 focus:ring-2 focus:ring-emerald-500"
                            value={table.status}
                            onChange={(e) => handleQuickStatusChange(table, e.target.value as any)}
                            title="Authoritative Status Override"
                          >
                            <option value="cleaning">Cleaning</option>
                            <option value="available">Set Available</option>
                            <option value="occupied">Set Occupied</option>
                            <option value="reserved">Set Reserved</option>
                            <option value="out_of_service">Out of Service</option>
                          </select>
                        </div>
                      </Card>
                    );
                  })}
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
        hideHeader={true}
        className="bg-white border border-[#E3DED5] text-[#18201D] shadow-2xl rounded-3xl overflow-hidden p-0 max-w-md w-full"
        contentClassName="p-0 overflow-hidden"
      >
        {selectedTable && (
          <div className="flex flex-col bg-white text-left">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3DED5] bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C85A3F] text-white flex items-center justify-center font-black text-sm shadow-xs">
                  T{selectedTable.number}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#18201D] leading-tight">
                    Seating Setup — Table {selectedTable.number}
                  </h3>
                  <p className="text-xs font-semibold text-[#5F6875]">
                    {selectedTable.section || 'Indoor Main'} • Capacity: {selectedTable.capacity || selectedTable.seatingCapacity || 4} Guests
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTable(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#5F6875] hover:text-[#18201D] hover:bg-[#EAE5DC] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Number of Guests counter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-[#18201D]">
                    Number of Guests
                  </label>
                  <span className="text-xs font-bold text-[#5F6875] bg-[#FAF8F5] px-2.5 py-0.5 rounded-md border border-[#E3DED5]">
                    Max: {Number(selectedTable.capacity || selectedTable.seatingCapacity || 4)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#FAF8F5] border border-[#E3DED5] rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setGuestsCount(c => Math.max(1, c - 1))}
                    className="w-12 h-12 border border-[#E3DED5] bg-white hover:bg-[#F0EBE1] rounded-xl text-2xl font-black flex items-center justify-center text-[#18201D] shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    -
                  </button>
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-black font-mono text-[#18201D] leading-none">
                      {guestsCount}
                    </span>
                    <span className="text-[11px] font-bold text-[#5F6875] uppercase tracking-wider mt-1">
                      {guestsCount === 1 ? 'Guest' : 'Guests'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGuestsCount(c => Math.min(Number(selectedTable.capacity || selectedTable.seatingCapacity || 4), c + 1))}
                    className="w-12 h-12 border border-[#E3DED5] bg-white hover:bg-[#F0EBE1] rounded-xl text-2xl font-black flex items-center justify-center text-[#18201D] shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
                <p className="text-[11px] text-[#5F6875] font-semibold">
                  Standard table capacity is {selectedTable.capacity || selectedTable.seatingCapacity || 4} guests.
                </p>
              </div>

              {/* Floor Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-[#18201D]">
                    Floor Section
                  </label>
                  <span className="text-[10.5px] font-bold text-[#16A34A] bg-[#EAF6ED] px-2 py-0.5 rounded-md border border-[#CDE9D5] flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Auto-Selected
                  </span>
                </div>
                <div className="w-full px-4 py-2.5 bg-[#FAF8F5] border border-[#E3DED5] text-[#18201D] font-bold rounded-xl text-sm flex items-center gap-2 select-none shadow-2xs">
                  <MapPin className="w-4 h-4 text-[#C85A3F] shrink-0" />
                  <span className="text-[#18201D]">{tableSectionInput || selectedTable.section || (selectedTable as any).floorSection || 'Indoor Main'}</span>
                </div>
              </div>

              {/* Special Seating Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-[#18201D]">
                  Special Seating Notes (VIP, Allergy, Kids)
                </label>
                <input
                  type="text"
                  value={tableNotesInput}
                  onChange={e => setTableNotesInput(e.target.value)}
                  placeholder="Allergy to nuts, VIP guest, Wheelchair space needed"
                  className="w-full px-4 py-2.5 bg-[#FAF8F5] border border-[#E3DED5] text-[#18201D] font-medium placeholder-[#9CA3AF] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C85A3F]/30 focus:border-[#C85A3F] transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-3 border-t border-[#E3DED5]">
                <button
                  type="button"
                  className="px-4 bg-[#FAF8F5] border border-[#E3DED5] text-[#18201D] hover:bg-[#EAE5DC] rounded-xl font-bold py-3 transition-all cursor-pointer"
                  onClick={() => setSelectedTable(null)}
                >
                  Cancel
                </button>
                {isTableSeated(selectedTable, false) && (
                  <button
                    type="button"
                    className="flex-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl font-bold py-3 px-3 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 text-xs sm:text-sm"
                    onClick={() => handleReleaseTable(selectedTable)}
                  >
                    <UserMinus className="w-4 h-4 text-red-600" />
                    <span>Release Table</span>
                  </button>
                )}
                <button
                  type="button"
                  className="flex-1 bg-[#C85A3F] hover:bg-[#B34E35] text-white rounded-xl font-black py-3 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 text-xs sm:text-sm"
                  onClick={handleOccupyTableCC}
                >
                  <Users className="w-4 h-4" />
                  <span>{isTableSeated(selectedTable, false) ? 'Update Seating' : 'Seat & Seize Table'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Add Quick Order Modal (Same Rich Look as Customer Menu) ─── */}
      <Modal
        isOpen={orderTable !== null}
        onClose={() => { setOrderTable(null); setCart({}); setOrderNotes(''); }}
        hideHeader={true}
        size="6xl"
        className="bg-white border-[#E3DED5] text-[#18201D] shadow-2xl rounded-3xl overflow-hidden p-0 max-w-6xl w-full"
        contentClassName="p-0 overflow-hidden flex flex-col h-[88vh] max-h-[860px]"
      >
        {orderTable && (
          <div className="flex flex-col h-full overflow-hidden bg-white text-left">
            {/* Top Bar: Table Title & Close Action */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E3DED5] bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C85A3F] text-white flex items-center justify-center font-black text-sm shadow-xs">
                  T{orderTable.number}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-[#18201D] leading-tight">
                      Order — Table {orderTable.number}
                    </h3>
                    <span className="text-[11px] font-bold text-[#5F6875] bg-[#F7F4EE] px-2 py-0.5 rounded-md border border-[#E3DED5]">
                      {orderTable.section || 'Indoor Main'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5F6875]">
                    Customer-style digital catalog · {filteredDishes.length} dishes available
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setOrderTable(null); setCart({}); setOrderNotes(''); }}
                className="w-9 h-9 rounded-xl border border-[#E3DED5] bg-white hover:bg-stone-100 flex items-center justify-center text-[#5F6875] hover:text-[#18201D] transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Content: Left 8-col Menu Explorer / Right 4-col POS Basket */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-[#E3DED5]">
              {/* LEFT: Dishes Explorer (8 columns on lg) */}
              <div className="lg:col-span-8 flex flex-col h-full overflow-hidden bg-[#FAF8F5]">
                {/* Search & Filter Toolbar */}
                <div className="p-3.5 bg-white border-b border-[#E3DED5] space-y-2.5 shrink-0">
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search dishes by name or ingredients..."
                        value={menuSearchQuery}
                        onChange={e => setMenuSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-white border border-[#E3DED5] rounded-xl text-xs text-[#18201D] placeholder-[#9CA3AF] outline-none focus:border-[#C85A3F] transition-all"
                      />
                      {menuSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMenuSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#18201D] text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Dietary Filters: All, Veg, Non-Veg */}
                    <div className="flex items-center gap-1 bg-[#F7F4EE] p-1 rounded-xl border border-[#E3DED5] shrink-0">
                      <button
                        type="button"
                        onClick={() => setMenuDietaryFilter('all')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          menuDietaryFilter === 'all'
                            ? 'bg-[#18201D] text-white shadow-xs'
                            : 'text-[#5F6875] hover:text-[#18201D]'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenuDietaryFilter('veg')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          menuDietaryFilter === 'veg'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Veg</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenuDietaryFilter('non-veg')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          menuDietaryFilter === 'non-veg'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span>Non-Veg</span>
                      </button>
                    </div>
                  </div>

                  {/* Category Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {['All', ...Array.from(new Set(menuItems.map(m => m.category).filter(Boolean)))].map(cat => {
                      const count = cat === 'All' 
                        ? menuItems.length 
                        : menuItems.filter(m => m.category === cat).length;
                      const isSelected = menuCategoryFilter === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setMenuCategoryFilter(cat)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer shrink-0 ${
                            isSelected
                              ? 'bg-[#C85A3F] border-[#C85A3F] text-white shadow-xs font-extrabold'
                              : 'bg-white border-[#E3DED5] text-[#5F6875] hover:text-[#18201D] hover:border-slate-400'
                          }`}
                        >
                          <span>{cat}</span>
                          <span className={`ml-1 text-[10px] font-normal ${isSelected ? 'opacity-90' : 'text-[#9CA3AF]'}`}>
                            ({count})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dishes Cards Grid (Authentic food photography + Customer Menu parity) */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                  {filteredDishes.length === 0 ? (
                    <div className="py-16 text-center space-y-2">
                      <Utensils className="w-8 h-8 text-[#9CA3AF] mx-auto opacity-40" />
                      <p className="text-xs font-bold text-[#18201D]">No dishes match your filter</p>
                      <p className="text-[10px] text-[#5F6875]">Try selecting a different category or search term.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                      {filteredDishes.map(item => {
                        const inCartCount = cart[item.id]?.count || 0;
                        const isVeg = item.isVeg ?? item.veg ?? true;
                        const dishImg = getDishImage(item);
                        const prepTime = item.preparationTime || 15;

                        return (
                          <div
                            key={item.id}
                            className="bg-white border border-[#E3DED5] rounded-2xl p-3 flex flex-col justify-between shadow-xs hover:border-[#C85A3F]/50 hover:shadow-md transition-all group"
                          >
                            <div className="space-y-2.5">
                              {/* Dish Image Container */}
                              <div className="w-full h-32 rounded-xl overflow-hidden bg-[#F7F4EE] border border-[#E3DED5] relative shrink-0">
                                <img
                                  src={dishImg}
                                  alt={item.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />

                                {/* Veg / Non-Veg Indicator Dot */}
                                <div
                                  className={`absolute top-2 left-2 w-4 h-4 bg-white/95 rounded-md border flex items-center justify-center shadow-xs ${
                                    isVeg ? 'border-emerald-600' : 'border-rose-600'
                                  }`}
                                  title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                                >
                                  <span className={`w-2 h-2 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                                </div>

                                {/* Category Pill on top right */}
                                {item.category && (
                                  <span className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md">
                                    {item.category}
                                  </span>
                                )}

                                {/* Preparation Time */}
                                <span className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-300" />
                                  <span>{prepTime}m</span>
                                </span>
                              </div>

                              {/* Dish Title & Description */}
                              <div>
                                <h4 className="font-extrabold text-xs text-[#18201D] leading-snug line-clamp-1">
                                  {item.name}
                                </h4>
                                {item.description ? (
                                  <p className="text-[10px] text-[#5F6875] line-clamp-2 mt-0.5 leading-tight">
                                    {item.description}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-[#9CA3AF] italic mt-0.5">
                                    House specialty cooked fresh
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Price & Action Stepper */}
                            <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#F0ECE6]">
                              <div>
                                <span className="font-mono font-black text-sm text-[#18201D]">
                                  {formatPrice(item.discountPrice || item.price)}
                                </span>
                              </div>

                              <div>
                                {inCartCount > 0 ? (
                                  <div className="flex items-center gap-1.5 bg-[#FDF0E6] p-0.5 rounded-xl border border-[#F6C6B8]">
                                    <button
                                      type="button"
                                      onClick={() => removeFromCart(item)}
                                      className="w-6 h-6 bg-white hover:bg-stone-100 text-[#C85A3F] font-black rounded-lg flex items-center justify-center text-xs shadow-xs cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <span className="font-bold font-mono text-xs min-w-[20px] text-center text-[#C85A3F]">
                                      {inCartCount}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => addToCart(item)}
                                      className="w-6 h-6 bg-white hover:bg-stone-100 text-[#C85A3F] font-black rounded-lg flex items-center justify-center text-xs shadow-xs cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => addToCart(item)}
                                    className="px-3.5 py-1.5 bg-[#C85A3F] hover:bg-[#B34E35] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all"
                                  >
                                    <span>+ Add</span>
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
              </div>

              {/* RIGHT: Order Basket & Checkout Details (4 columns on lg) */}
              <div className="lg:col-span-4 flex flex-col h-full bg-[#FCFAF7] overflow-hidden">
                {/* 1. Top Section: Diner Details (shrink-0) */}
                <div className="p-3.5 bg-white border-b border-[#E3DED5] space-y-2 shrink-0">
                  <div className="text-[10px] uppercase font-black tracking-wider text-[#5F6875] flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#C85A3F]" />
                    <span>Diner / Guest Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#5F6875] block mb-0.5">Customer Name</label>
                      <input
                        type="text"
                        placeholder="Ravi Kumar"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        className="w-full px-2.5 py-1 bg-[#F7F4EE] border border-[#E3DED5] rounded-lg text-xs text-[#18201D] outline-none focus:bg-white focus:border-[#C85A3F]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#5F6875] block mb-0.5">Phone (optional)</label>
                      <input
                        type="text"
                        placeholder="9876543210"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        className="w-full px-2.5 py-1 bg-[#F7F4EE] border border-[#E3DED5] rounded-lg text-xs text-[#18201D] outline-none focus:bg-white focus:border-[#C85A3F]"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Middle Scrollable Section: Cart items + Kitchen Notes */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
                  {/* Cart Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#E3DED5]">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4 text-[#C85A3F]" />
                      <span className="font-extrabold text-xs text-[#18201D]">
                        Order Basket ({Object.values(cart).reduce((s, c) => s + c.count, 0)})
                      </span>
                    </div>
                    {Object.keys(cart).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCart({})}
                        className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                      >
                        Clear Basket
                      </button>
                    )}
                  </div>

                  {Object.keys(cart).length === 0 ? (
                    <div className="py-10 text-center space-y-1.5">
                      <Utensils className="w-7 h-7 text-[#9CA3AF] mx-auto opacity-40" />
                      <p className="text-xs font-bold text-[#18201D]">Basket is empty</p>
                      <p className="text-[10px] text-[#5F6875]">Click "+ Add" on any dish to build order.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F0ECE6] space-y-2">
                      {Object.values(cart).map(entry => {
                        const isVeg = entry.item.isVeg ?? entry.item.veg ?? true;
                        return (
                          <div key={entry.item.id} className="pt-2 flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`w-3 h-3 border rounded-xs flex items-center justify-center shrink-0 ${isVeg ? 'border-emerald-600' : 'border-rose-600'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-[#18201D] truncate">{entry.item.name}</div>
                                <div className="text-[10px] text-[#5F6875] font-mono">{formatPrice(entry.item.discountPrice || entry.item.price)} each</div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1 bg-[#FDF0E6] p-0.5 rounded-lg border border-[#F6C6B8]">
                                <button
                                  type="button"
                                  onClick={() => removeFromCart(entry.item)}
                                  className="w-5 h-5 bg-white text-[#C85A3F] font-bold rounded flex items-center justify-center text-[10px] cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="font-mono font-bold text-xs px-1 text-[#C85A3F] min-w-[16px] text-center">{entry.count}</span>
                                <button
                                  type="button"
                                  onClick={() => addToCart(entry.item)}
                                  className="w-5 h-5 bg-white text-[#C85A3F] font-bold rounded flex items-center justify-center text-[10px] cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                              <span className="font-mono font-bold text-xs text-[#18201D] min-w-[50px] text-right">
                                {formatPrice((entry.item.discountPrice || entry.item.price) * entry.count)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Special Kitchen Notes */}
                  <div className="pt-2 border-t border-[#E3DED5]">
                    <label className="text-[10px] font-bold text-[#5F6875] block mb-1">
                      Special Kitchen Instructions
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Less spicy, allergy to nuts, serve drinks first..."
                      value={orderNotes}
                      onChange={e => setOrderNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E3DED5] rounded-xl text-xs text-[#18201D] placeholder-[#9CA3AF] outline-none focus:border-[#C85A3F] resize-none"
                    />
                  </div>
                </div>

                {/* 3. Bottom Sticky Section: Bill Breakdown & Action Buttons (shrink-0, ALWAYS VISIBLE) */}
                <div className="p-3.5 bg-white border-t border-[#E3DED5] space-y-2.5 shrink-0 shadow-sm">
                  <div className="space-y-1.5 text-xs text-[#5F6875]">
                    <div className="flex justify-between">
                      <span>Items Subtotal:</span>
                      <span className="font-mono font-semibold text-[#18201D]">{formatPrice(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Estimated Taxes (5% GST):</span>
                      <span className="font-mono font-semibold text-[#18201D]">{formatPrice(Math.round(cartTotal * 0.05))}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[#E3DED5] font-black text-sm text-[#18201D]">
                      <span>Total Order Value:</span>
                      <span className="font-mono text-base text-[#C85A3F]">{formatPrice(Math.round(cartTotal * 1.05))}</span>
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => { setOrderTable(null); setCart({}); setOrderNotes(''); }}
                      className="py-2.5 px-3 rounded-xl bg-white hover:bg-stone-100 border border-[#E3DED5] text-[#5F6875] font-bold text-xs cursor-pointer shadow-2xs transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePlaceQuickOrder}
                      disabled={Object.keys(cart).length === 0 || isSubmittingOrder}
                      className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer ${
                        Object.keys(cart).length > 0 && !isSubmittingOrder
                          ? 'bg-[#183B2B] hover:bg-[#122c20] text-white active:scale-98'
                          : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                      }`}
                    >
                      {isSubmittingOrder ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Sending to Kitchen...</span>
                        </>
                      ) : (
                        <>
                          <Utensils className="w-3.5 h-3.5" />
                          <span>Submit Order to Kitchen</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Table Orders / Multi-Round Details Modal ─── */}
      <Modal
        isOpen={viewingRoundsTable !== null}
        onClose={() => setViewingRoundsTable(null)}
        title={`Table ${viewingRoundsTable?.table.number || ''} — Active Orders & Rounds`}
        size="md"
      >
        {viewingRoundsTable && (
          <div className="space-y-4">
            {/* Session Header Banner */}
            <div className="bg-[#FAF8F4] border border-[#E3DED5] rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-[#71717A] font-medium">Customer / Guest</div>
                <div className="text-sm font-bold text-[#18201D]">
                  {viewingRoundsTable.table.customerName ||
                   viewingRoundsTable.orders.find(o => o.customerName)?.customerName ||
                   'Guest Diner'}
                </div>
                <div className="text-[11px] text-[#71717A] mt-0.5">
                  Table {viewingRoundsTable.table.number} · {viewingRoundsTable.table.section || 'Floor'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-[#71717A] font-medium">Total Bill ({viewingRoundsTable.orders.length} Rounds)</div>
                <div className="text-lg font-black text-[#16A34A]">
                  {formatPrice(viewingRoundsTable.orders.reduce((sum, o) => sum + Number(o.total || (o as any).totalAmount || 0), 0))}
                </div>
              </div>
            </div>

            {/* Rounds List */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {viewingRoundsTable.orders.map((ord, idx) => {
                const ordStatus = (ord.status || 'ACTIVE').toUpperCase();
                const isReady = ordStatus === 'READY';
                const isServed = ordStatus === 'SERVED' || ordStatus === 'DELIVERED';
                const isNew = ordStatus === 'NEW' || ordStatus === 'PLACED';

                const timeStr = ord.createdAt ? (() => {
                  try {
                    const d = new Date(ord.createdAt);
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                  } catch {
                    return '';
                  }
                })() : '';

                return (
                  <div
                    key={ord.orderId || ord.id || idx}
                    className="border border-[#E3DED5] rounded-xl p-3.5 bg-white shadow-xs space-y-2 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#183B2B] text-white text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-xs text-[#18201D]">
                          {idx === 0 ? 'Round 1 (Initial Order)' : `Round ${idx + 1} (Add-on)`}
                        </span>
                        <span className="font-mono text-[10px] text-[#71717A]">
                          #{ord.orderId.slice(-6)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {timeStr && <span className="text-[10px] text-[#71717A]">{timeStr}</span>}
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            isReady
                              ? 'bg-[#EAF6ED] text-[#16A34A] animate-pulse'
                              : isServed
                              ? 'bg-emerald-50 text-emerald-700'
                              : isNew
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {ordStatus}
                        </span>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="divide-y divide-[#F0ECE6] border-t border-[#F0ECE6] pt-1.5">
                      {(ord.items || []).map((it, itIdx) => (
                        <div key={itIdx} className="py-1 flex items-center justify-between text-xs">
                          <span className="text-[#18201D] font-medium">
                            {it.count || 1}x {it.name}
                          </span>
                          <span className="text-[#71717A] font-mono">
                            {formatPrice((it.pricePerUnit || 0) * (it.count || 1))}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Round Subtotal */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#F0ECE6] text-xs">
                      <span className="text-[#71717A]">Round Total:</span>
                      <span className="font-bold text-[#18201D]">
                        {formatPrice(ord.total || (ord as any).totalAmount || 0)}
                      </span>
                    </div>

                    {isReady && (
                      <button
                        type="button"
                        onClick={() => {
                          handleServeFood(ord);
                          setViewingRoundsTable(null);
                        }}
                        className="w-full mt-1.5 py-1.5 px-3 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>Mark This Round as Served</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#E3DED5]">
              <button
                type="button"
                onClick={() => setViewingRoundsTable(null)}
                className="flex-1 py-2.5 px-3 rounded-xl border border-[#E3DED5] hover:bg-stone-50 text-[#18201D] font-bold text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const prim = viewingRoundsTable.orders[0];
                  setViewingRoundsTable(null);
                  if (prim) handleGenerateBill(prim);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#183B2B] hover:bg-[#122c20] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5 text-white" />
                <span>Settle Full Bill ({formatPrice(viewingRoundsTable.orders.reduce((sum, o) => sum + Number(o.total || (o as any).totalAmount || 0), 0))})</span>
              </button>
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
          onPaymentSettled={async () => {
            const settledOrderId = selectedOrder.orderId;
            const settledOrderDocId = selectedOrder.id;
            const settledTableNum = selectedOrder.tableNumber;
            const settledTableId = selectedOrder.tableId;

            // 1. Optimistically mark order as paid & completed in local state
            setOrders(prev => prev.map(o => {
              const isMatch = o.orderId === settledOrderId || o.id === settledOrderId || o.id === settledOrderDocId || (settledTableNum && o.tableNumber === settledTableNum && (o.status === 'SERVED' || o.status === 'DELIVERED'));
              if (isMatch) {
                return { ...o, paymentStatus: 'paid', status: 'COMPLETED' };
              }
              return o;
            }));

            // 2. Optimistically update table to cleaning in local state
            if (settledTableNum || settledTableId) {
              setTables(prev => prev.map(t => {
                const matchNum = cleanTableIdentifier(t.number || (t as any).tableNumber) === cleanTableIdentifier(settledTableNum);
                const matchId = t.id === settledTableId;
                if (matchNum || matchId) {
                  return {
                    ...t,
                    status: 'cleaning',
                    tableStatus: 'cleaning',
                    activeOrderId: undefined,
                    currentOrderId: undefined,
                    customerPresent: false,
                    billPaidAt: new Date().toISOString()
                  };
                }
                return t;
              }));

              // 3. Persist table cleaning state to Firestore as guaranteed safety net
              if (user?.tenantId) {
                try {
                  const { tableService } = await import('../../../shared/services/tableService');
                  await tableService.setTableCleaning(user.tenantId, settledTableId || settledTableNum, 10);
                } catch (cleanErr) {
                  console.warn('[WaiterMatrix] Non-blocking setTableCleaning warning:', cleanErr);
                }
              }
            }

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

      {/* ─── Item-Level Serving Order Details Drawer ─── */}
      {drawerState.isOpen && drawerState.table && (
        <WaiterOrderDetailsDrawer
          isOpen={drawerState.isOpen}
          onClose={() => setDrawerState(prev => ({ ...prev, isOpen: false }))}
          table={tables.find(t => t.id === drawerState.table?.id) || drawerState.table}
          orders={findAllActiveOrdersForTable(drawerState.table, orders)}
          initialSelectReadyItems={drawerState.initialSelectReadyItems}
          onSettleBill={(order) => {
            setDrawerState(prev => ({ ...prev, isOpen: false }));
            handleGenerateBill(order);
          }}
        />
      )}
    </div>
  );
};

export default WaiterMatrix;
