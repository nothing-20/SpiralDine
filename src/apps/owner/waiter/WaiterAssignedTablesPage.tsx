import React, { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, addDoc, collection, writeBatch, arrayUnion, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useWaiterData } from './useWaiterData';
import { generateUniqueOrderId } from '../../../shared/utils/orderUtils';
import { formatPrice } from '../../../utils/format';
import { logEvent } from '../../../services/eventEngine';
import { tableService } from '../../../shared/services/tableService';
import { reservationService } from '../../../shared/services/reservationService';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import Input from '../../../components/ui/Input/Input';
import Modal from '../../../components/ui/Modal/Modal';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';
import toast from 'react-hot-toast';
import { 
  Users, UserPlus, Clock, DollarSign, Check, Play, Calendar, AlertTriangle, Utensils, Award,
  Search, Filter, ShoppingBag, X, User
} from 'lucide-react';

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

const getDishImage = (item: any): string => {
  const lower = `${item.name} ${item.category || ''}`.toLowerCase();
  const rawUrl = item.imageUrl || item.image || '';
  if (rawUrl && rawUrl.startsWith('http') && !rawUrl.includes('photo-1544025162') && !rawUrl.includes('photo-1567184109') && !rawUrl.includes('photo-1567620832') && !rawUrl.includes('photo-1576107232')) {
    return rawUrl;
  }
  for (const [key, url] of Object.entries(DISH_FALLBACK_IMAGES)) {
    if (lower.includes(key)) return url;
  }
  return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
};

// Status color helper mapping
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Available:     { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-700 font-bold' },
  Ordering:      { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-700 font-bold' },
  'Waiting Food':{ bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-800 font-bold' },
  Serving:       { bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-800 font-bold' },
  Billing:       { bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-700 font-bold' },
  'Needs Attention': { bg: 'bg-red-500/10', border: 'border-red-500/30',     text: 'text-red-700 font-extrabold animate-pulse' }
};

interface ITableTimerProps {
  seatingTime?: string;
  orderCreatedTime?: string;
  cookingStartedTime?: string;
  readyTime?: string;
  billRequestedTime?: string;
  status: string;
}

const TableTimer: React.FC<ITableTimerProps> = ({ 
  seatingTime, 
  orderCreatedTime, 
  cookingStartedTime, 
  readyTime, 
  billRequestedTime,
  status
}) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const getMinutesElapsed = (isoStr?: string) => {
    if (!isoStr) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000));
  };

  const seatingMins = seatingTime ? getMinutesElapsed(seatingTime) : 0;
  const orderMins = orderCreatedTime ? getMinutesElapsed(orderCreatedTime) : 0;
  const cookingMins = cookingStartedTime ? getMinutesElapsed(cookingStartedTime) : 0;
  const deliveryMins = readyTime ? getMinutesElapsed(readyTime) : 0;
  const billingMins = billRequestedTime ? getMinutesElapsed(billRequestedTime) : 0;

  // Highlight delayed times
  const isSeatingDelayed = seatingMins > 90;
  const isWaitFoodDelayed = status === 'Waiting Food' && orderMins > 25;
  const isCookingDelayed = status === 'Waiting Food' && cookingMins > 15;
  const isDeliveryDelayed = status === 'Serving' && deliveryMins > 8;
  const isBillingDelayed = status === 'Billing' && billingMins > 5;

  if (!seatingTime) return null;

  return (
    <div className="space-y-1 text-[10px] text-slate-400 bg-slate-955/60 p-2.5 rounded-xl border border-slate-850">
      <div className="flex justify-between items-center font-bold">
        <span>Dining Duration:</span>
        <span className={isSeatingDelayed ? 'text-red-400 font-extrabold' : 'text-slate-350'}>{seatingMins} mins</span>
      </div>
      {status === 'Waiting Food' && (
        <div className="flex justify-between items-center">
          <span>Waiting Food:</span>
          <span className={isWaitFoodDelayed ? 'text-red-400 font-extrabold animate-pulse' : 'text-yellow-400'}>{orderMins} mins</span>
        </div>
      )}
      {cookingStartedTime && status === 'Waiting Food' && (
        <div className="flex justify-between items-center">
          <span>Kitchen Cooking:</span>
          <span className={isCookingDelayed ? 'text-red-400 font-extrabold' : 'text-orange-400'}>{cookingMins} mins</span>
        </div>
      )}
      {readyTime && (status === 'Serving' || status === 'Waiting Food') && (
        <div className="flex justify-between items-center">
          <span>Food Ready Delivery:</span>
          <span className={isDeliveryDelayed ? 'text-red-400 font-extrabold' : 'text-emerald-400 font-bold'}>{deliveryMins} mins</span>
        </div>
      )}
      {status === 'Billing' && (
        <div className="flex justify-between items-center">
          <span>Billing Delay:</span>
          <span className={isBillingDelayed ? 'text-red-400 font-extrabold animate-pulse' : 'text-purple-400'}>{billingMins} mins</span>
        </div>
      )}
    </div>
  );
};

export const WaiterAssignedTablesPage: React.FC = () => {
  const { user } = useAuth();
  const { tables, orders, waiterRequests, menuItems, employees, isLoading } = useWaiterData();

  // Modals
  const [seatingTable, setSeatingTable] = useState<any | null>(null);
  const [guestsCount, setGuestsCount] = useState<number>(2);
  const [tableNotesInput, setTableNotesInput] = useState<string>('');
  const [tableSectionInput, setTableSectionInput] = useState<string>('Main Room');

  const [orderTable, setOrderTable] = useState<any | null>(null);
  const [cart, setCart] = useState<Record<string, { item: any; count: number }>>({});
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [menuDietaryFilter, setMenuDietaryFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const [billingOrder, setBillingOrder] = useState<any | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [feedbackRating, setFeedbackRating] = useState<'Excellent' | 'Good' | 'Neutral' | 'Needs Attention' | 'Complaint'>('Excellent');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [isRepeatCustomer, setIsRepeatCustomer] = useState(false);
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);

  // New workspace helper states
  const [viewOrder, setViewOrder] = useState<any | null>(null);
  const [transferTableSrc, setTransferTableSrc] = useState<any | null>(null);
  const [transferDestTableId, setTransferDestTableId] = useState<string>('');
  const [transferDestWaiterId, setTransferDestWaiterId] = useState<string>('');
  const [splitBillOrder, setSplitBillOrder] = useState<any | null>(null);
  const [splitCount, setSplitCount] = useState<number>(2);
  const [qrPaymentTable, setQrPaymentTable] = useState<any | null>(null);

  const [reservations, setReservations] = useState<any[]>([]);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [activeCheckInRes, setActiveCheckInRes] = useState<any | null>(null);
  const [checkInTableId, setCheckInTableId] = useState<string>('');

  // Listen to upcoming reservations
  useEffect(() => {
    if (!user?.tenantId) return;
    const colRef = collection(db, 'restaurants', user.tenantId, 'reservations');
    const unsub = onSnapshot(colRef, (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.status !== 'Seated' && data.status !== 'Cancelled') {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setReservations(list);
    }, (err) => {
      console.error(err);
    });
    return () => unsub();
  }, [user?.tenantId]);

  // Check-in action handler
  const handleConfirmCheckIn = async () => {
    if (!user?.tenantId || !activeCheckInRes || !checkInTableId) return;
    try {
      const batch = writeBatch(db);
      
      const nowIso = new Date().toISOString();
      const targetTable = tables.find(t => t.id === checkInTableId);
      const orderId = generateUniqueOrderId();

      // 1. Update reservation doc status to Seated with table & order linkage
      const resRef = doc(db, 'restaurants', user.tenantId, 'reservations', activeCheckInRes.id);
      const resUpdatePayload = { 
        status: 'Seated', 
        seatedAt: nowIso,
        assignedTableId: targetTable?.id || checkInTableId,
        assignedTableNumber: targetTable?.tableNumber || targetTable?.number || '',
        activeOrderId: orderId,
        orderId: orderId,
        updatedAt: nowIso
      };
      batch.update(resRef, resUpdatePayload);
      
      // Update customer record too if exists
      if (activeCheckInRes.customerId && activeCheckInRes.customerId !== 'guest-uid') {
        const custResRef = doc(db, 'customers', activeCheckInRes.customerId, 'reservations', activeCheckInRes.id);
        batch.update(custResRef, resUpdatePayload);
      }

      // 2. Update physical Table doc status to Occupied/Dining
      if (targetTable) {
        const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', targetTable.id);
        const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', orderId);
        
        // Create blank order to start dining session linked to reservation
        batch.set(orderRef, {
          id: orderId,
          orderId,
          reservationId: activeCheckInRes.id,
          customerId: activeCheckInRes.customerId,
          customerName: activeCheckInRes.customerName,
          tableNumber: targetTable.tableNumber || targetTable.number,
          tableId: targetTable.id,
          tenantId: user.tenantId,
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
          reservationId: activeCheckInRes.id,
          seatingTime: nowIso,
          guestsCount: activeCheckInRes.guests || 2,
          assignedWaiterId: user.uid,
          assignedWaiterName: user.displayName || user.email
        });
      }

      await batch.commit();
      toast.success('Guest successfully checked in & seated!');
      setIsCheckInModalOpen(false);
      setActiveCheckInRes(null);
      setCheckInTableId('');
    } catch (e) {
      console.error(e);
      toast.error('Check-in failed.');
    }
  };

  // Cart operations
  const addToCart = (item: any) => {
    setCart(prev => ({
      ...prev,
      [item.id]: { item, count: (prev[item.id]?.count || 0) + 1 }
    }));
  };

  const removeFromCart = (item: any) => {
    setCart(prev => {
      const existing = prev[item.id];
      if (!existing) return prev;
      if (existing.count <= 1) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }
      return { ...prev, [item.id]: { ...existing, count: existing.count - 1 } };
    });
  };

  const cartTotal = useMemo(() => {
    return Object.values(cart).reduce((sum, entry) => sum + ((entry.item.discountPrice || entry.item.price) * entry.count), 0);
  }, [cart]);

  // Categories list for menu filter chips
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((m: any) => {
      if (m.category) set.add(m.category);
    });
    return ['All', ...Array.from(set)];
  }, [menuItems]);

  // Filtered dishes for customer-style ordering menu
  const filteredDishes = useMemo(() => {
    return menuItems.filter((item: any) => {
      if (item.isAvailable === false || item.available === false) return false;
      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch = !menuSearchQuery ||
        item.name.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(menuSearchQuery.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(menuSearchQuery.toLowerCase()));
      const isVeg = item.isVeg ?? item.veg ?? true;
      const matchesDiet =
        menuDietaryFilter === 'all' ||
        (menuDietaryFilter === 'veg' && isVeg) ||
        (menuDietaryFilter === 'non-veg' && !isVeg);
      return matchesCat && matchesSearch && matchesDiet;
    });
  }, [menuItems, selectedCategory, menuSearchQuery, menuDietaryFilter]);

  // Derived status & info for each table
  const mappedTables = useMemo(() => {
    return tables.map(table => {
      const cleanNum = String(table.number || table.tableNumber || '').replace(/^TBL-/i, '');
      const tableOrders = orders.filter(o => 
        (o.orderId === table.activeOrderId || 
         String(o.tableNumber || '').replace(/^TBL-/i, '') === cleanNum || 
         o.tableId === table.id) &&
        o.status !== 'ARCHIVED' && 
        o.status !== 'COMPLETED' &&
        o.status !== 'CANCELLED'
      );

      // Latest active order (orders is sorted newest first)
      const activeOrder = tableOrders[0] || orders.find(o => o.orderId === table.activeOrderId && o.status !== 'ARCHIVED' && o.status !== 'COMPLETED');
      const tableRequests = waiterRequests.filter(r => r.tableNumber === table.number && !['completed', 'cancelled', 'rejected'].includes((r.status || '').toLowerCase()));

      const ordersCount = tableOrders.length;
      const cumulativeBill = tableOrders.reduce((sum, o) => sum + (Number(o.total || (o as any).totalAmount) || 0), 0);

      let status = 'Available';
      if (table.status === 'empty') status = 'Available';
      else if (table.status === 'cleaning') status = 'Needs Attention';
      else if (tableRequests.length > 0) status = 'Needs Attention';
      else if (table.status === 'bill_requested' || (activeOrder && activeOrder.status === 'BILL_REQUESTED')) status = 'Billing';
      else if (activeOrder) {
        const oStatus = activeOrder.status;
        if (oStatus === 'CREATED' || oStatus === 'VERIFIED') status = 'Ordering';
        else if (oStatus === 'SENT_TO_KITCHEN' || oStatus === 'ACCEPTED' || oStatus === 'CHEF_ASSIGNED' || oStatus === 'PREPARING' || oStatus === 'READY') {
          status = 'Waiting Food';
        } else {
          status = 'Serving';
        }
      } else if (table.status === 'occupied') {
        status = 'Ordering';
      }

      return {
        ...table,
        mappedStatus: status,
        activeOrder,
        tableOrders,
        ordersCount,
        cumulativeBill: cumulativeBill > 0 ? cumulativeBill : (activeOrder?.total || 0),
        requestsCount: tableRequests.length
      };
    });
  }, [tables, orders, waiterRequests]);

  // Filter to only my assigned tables
  const myAssignedTables = useMemo(() => {
    return mappedTables.filter(t => t.assignedWaiterId === user?.uid);
  }, [mappedTables, user?.uid]);

  // Seat customer
  const handleSeatCustomer = async () => {
    if (!user?.tenantId || !seatingTable) return;
    try {
      const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', seatingTable.id);
      await updateDoc(tableRef, {
        status: 'occupied',
        assignedWaiterId: user.uid,
        assignedWaiterName: user.displayName || user.email || 'Waiter',
        guestsCount: guestsCount,
        tableNotes: tableNotesInput,
        section: tableSectionInput,
        seatingTime: new Date().toISOString()
      });
      toast.success(`Guests checked in on Table ${seatingTable.number}.`);
      setSeatingTable(null);
    } catch (e) {
      console.error(e);
      toast.error('Check-in failed.');
    }
  };

  // Place quick order
  const handlePlaceOrder = async () => {
    if (!orderTable) {
      toast.error('No table selected.');
      return;
    }
    if (Object.keys(cart).length === 0) {
      toast.error('Please add dishes to the order basket.');
      return;
    }

    const effectiveTenantId = user?.tenantId || (orderTable as any)?.tenantId || localStorage.getItem('lastTenantId') || localStorage.getItem('tenantId') || localStorage.getItem('spiral_tenant_id') || 'bawarchi';

    if (!effectiveTenantId) {
      toast.error('Restaurant ID missing. Please refresh or re-login.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const orderId = generateUniqueOrderId();
      const tax = Math.round(cartTotal * 0.05);
      const total = cartTotal + tax;

      const orderItems = Object.values(cart).map(entry => ({
        menuItemId: entry.item.id,
        name: entry.item.name,
        count: entry.count,
        pricePerUnit: entry.item.discountPrice || entry.item.price,
        category: entry.item.category || '',
        isVeg: entry.item.isVeg ?? entry.item.veg ?? true,
        specialInstructions: orderNotes.trim() || '',
        status: 'PENDING'
      }));

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
        tax: tax,
        total: total,
        orderNotes: orderNotes.trim() || '',
        specialInstructions: orderNotes.trim() || '',
        createdAt: new Date().toISOString(),
        customerName: customerName.trim() || orderTable.customerName || `Table ${orderTable.number} Guest`,
        customerPhone: customerPhone.trim() || orderTable.customerPhone || '',
        orderSource: 'waiter_pos',
        timeline: [
          {
            type: 'PLACED',
            title: 'Order Placed by Waiter',
            description: `Quick table-side order by ${user?.displayName || user?.email || 'Waiter'}${orderNotes.trim() ? ` (Notes: "${orderNotes.trim()}")` : ''}`,
            timestamp: new Date().toISOString(),
            performedBy: user?.displayName || 'Waiter'
          }
        ]
      };

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
            total: total,
            itemsCount: orderItems.length,
            customerName: cleanOrderData.customerName,
            guestsCount: orderTable.guestsCount || 2
          }
        );
      } catch (tableErr) {
        console.warn('Non-blocking table status sync notice:', tableErr);
      }

      toast.success(`Quick order #${orderId.slice(-6)} sent to kitchen for Table ${orderTable.number}!`);

      try {
        logEvent(effectiveTenantId, {
          eventType: 'Order Created',
          eventCategory: 'Waiter',
          performedBy: user?.displayName || user?.email || 'Waiter',
          performedByRole: user?.role || 'waiter',
          orderId,
          tableNumber: orderTable.number,
          title: 'Order Created',
          description: `Order #${orderId.substring(0, 8)} created for Table ${orderTable.number}.`
        });
      } catch (_) {}

      setOrderTable(null);
      setCart({});
      setCustomerName('');
      setCustomerPhone('');
      setOrderNotes('');
      setMenuSearchQuery('');
      setSelectedCategory('All');
      setMenuDietaryFilter('all');
    } catch (e: any) {
      console.error('Failed to create order:', e);
      toast.error(e?.message ? `Failed to create order: ${e.message}` : 'Failed to create order.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Send Order to Kitchen
  const handleSendOrder = async (table: any) => {
    if (!user?.tenantId || !table.activeOrderId) return;
    try {
      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', table.activeOrderId);
      const timelineEvent = {
        type: 'SENT_TO_KITCHEN',
        title: 'Sent to Kitchen',
        description: `Order verified and sent to kitchen by Waiter ${user.displayName || user.email}`,
        timestamp: new Date().toISOString(),
        performedBy: user.displayName || 'Waiter'
      };
      await updateDoc(orderRef, {
        status: 'SENT_TO_KITCHEN',
        timeline: arrayUnion(timelineEvent)
      });
      toast.success(`Order sent to kitchen!`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to send order.');
    }
  };

  // Serve food
  const handleServeFood = async (table: any) => {
    if (!user?.tenantId || !table.activeOrderId) return;
    try {
      const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', table.activeOrderId);
      const timelineEvent = {
        type: 'DELIVERED',
        title: 'Served',
        description: `Food served to table by Waiter ${user.displayName || user.email}`,
        timestamp: new Date().toISOString(),
        performedBy: user.displayName || 'Waiter'
      };
      await updateDoc(orderRef, {
        status: 'DELIVERED',
        deliveredAt: new Date().toISOString(),
        timeline: arrayUnion(timelineEvent)
      });
      toast.success(`Food served to Table ${table.number}!`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to serve food.');
    }
  };

  // Generate Bill (request bill)
  const handleRequestBill = async (table: any) => {
    if (!user?.tenantId) return;
    try {
      const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', table.id);
      await updateDoc(tableRef, { status: 'bill_requested' });

      if (table.activeOrderId) {
        const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', table.activeOrderId);
        await updateDoc(orderRef, { status: 'BILL_REQUESTED' });
      }

      toast.success(`Checkout invoice requested for Table ${table.number}.`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to request bill.');
    }
  };

  // Submit Feedback & Complete Payment
  const handleCompletePayment = async () => {
    if (!user?.tenantId || !billingOrder) return;
    setIsSubmittingBill(true);
    try {
      const docRef = doc(db, 'restaurants', user.tenantId, 'orders', billingOrder.orderId);
      const subtotal = billingOrder.subtotal;
      const discount = Math.round(subtotal * (discountPercent / 100));
      const newTax = Math.round((subtotal - discount) * 0.08);
      const newTotal = (subtotal - discount) + newTax;

      const ratingCol = collection(db, 'restaurants', user.tenantId, 'satisfactionRatings');
      await addDoc(ratingCol, {
        rating: feedbackRating,
        notes: feedbackNotes,
        submittedAt: new Date().toISOString(),
        orderId: billingOrder.orderId,
        tableNumber: billingOrder.tableNumber,
        tenantId: user.tenantId,
        repeatCustomer: isRepeatCustomer
      });

      const timelineEvent = {
        type: 'COMPLETED',
        title: 'Payment Completed',
        description: `Invoice settled with Table ${billingOrder.tableNumber} by Waiter ${user.displayName || user.email}`,
        timestamp: new Date().toISOString(),
        performedBy: user.displayName || 'Waiter'
      };

      await updateDoc(docRef, {
        status: 'COMPLETED',
        paymentStatus: 'paid',
        discountPercent,
        tax: newTax,
        total: newTotal,
        timeline: arrayUnion(timelineEvent)
      });

      const tableObj = tables.find(t => t.number === billingOrder.tableNumber);
      if (tableObj) {
        await tableService.setTableCleaning(user.tenantId, tableObj.id, 10);
      }

      toast.success('Invoice settled! Table moved to cleaning.');
      setBillingOrder(null);
    } catch (e) {
      console.error(e);
      toast.error('Checkout failed.');
    } finally {
      setIsSubmittingBill(false);
    }
  };

  // Close table
  const handleCloseTable = async (table: any) => {
    if (!user?.tenantId) return;
    try {
      const batch = writeBatch(db);
      const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', table.id);
      batch.update(tableRef, {
        status: 'Available',
        tableStatus: 'Available',
        activeOrderId: null,
        currentOrderId: null,
        guestsCount: 0,
        tableNotes: '',
        seatingTime: null
      });

      if (Array.isArray(table.tableOrders) && table.tableOrders.length > 0) {
        table.tableOrders.forEach((to: any) => {
          const ordId = to.orderId || to.id;
          if (ordId) {
            const ordRef = doc(db, 'restaurants', user.tenantId, 'orders', ordId);
            batch.update(ordRef, { status: 'ARCHIVED' });
          }
        });
      } else if (table.activeOrderId) {
        const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', table.activeOrderId);
        batch.update(orderRef, { status: 'ARCHIVED' });
      }

      await batch.commit();
      toast.success(`Table ${table.number} released.`);

      // Trigger canonical reservation completion if payment lifecycle is fulfilled
      try {
        await reservationService.completeReservationIfEligible(user.tenantId, table.id, {
          actorName: user.displayName || user.email || 'Waiter',
          actorRole: user.role || 'waiter'
        });
      } catch (resErr) {
        console.warn('[WaiterAssignedTablesPage] Reservation completion error:', resErr);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to close table.');
    }
  };

  // Request Manager Call Alert
  const handleRequestManager = async (table: any) => {
    if (!user?.tenantId) return;
    try {
      const reqCol = collection(db, 'restaurants', user.tenantId, 'waiterRequests');
      await addDoc(reqCol, {
        tenantId: user.tenantId,
        tableNumber: table.number,
        requestType: 'Need Manager',
        status: 'Pending',
        priority: 'high',
        createdAt: new Date().toISOString(),
        description: `Waiter ${user.displayName || user.email}escalated an action for Table ${table.number}.`,
        acceptedBy: '',
        resolvedAt: '',
        orderId: table.activeOrderId || '—'
      });
      toast.success('Manager assistance requested.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to contact manager.');
    }
  };

  // Request Kitchen Alert
  const handleRequestKitchen = async (table: any) => {
    if (!user?.tenantId) return;
    try {
      const reqCol = collection(db, 'restaurants', user.tenantId, 'waiterRequests');
      await addDoc(reqCol, {
        tenantId: user.tenantId,
        tableNumber: table.number,
        requestType: 'Kitchen Alert',
        status: 'Pending',
        priority: 'medium',
        createdAt: new Date().toISOString(),
        description: `Waiter sent alert regarding Table ${table.number} order queue.`,
        acceptedBy: '',
        resolvedAt: '',
        orderId: table.activeOrderId || '—'
      });
      toast.success('Kitchen alert dispatched.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to contact kitchen.');
    }
  };

  // Print Bill
  const handlePrintBill = (table: any) => {
    const activeOrder = orders.find(o => o.orderId === table.activeOrderId);
    if (!activeOrder) {
      toast.error('No active order bill to print.');
      return;
    }
    toast.success(`Printing bill for Table ${table.number}...`);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - Table ${table.number}</title>
            <style>
              body { font-family: monospace; padding: 20px; text-align: left; background: #fff; color: #000; }
              .header { text-align: center; margin-bottom: 20px; }
              .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
              .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
              .total { font-weight: bold; display: flex; justify-content: space-between; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>Spiral Dine</h2>
              <p>Table: ${table.number} | Order: ${activeOrder.orderId.substring(0, 8)}</p>
              <p>Date: ${new Date(activeOrder.createdAt).toLocaleString()}</p>
            </div>
            <div class="divider"></div>
            ${activeOrder.items.map((it: any) => `
              <div class="item">
                <span>${it.name} x${it.count}</span>
                <span>${formatPrice(it.pricePerUnit * it.count)}</span>
              </div>
            `).join('')}
            <div class="divider"></div>
            <div class="total">
              <span>Grand Total:</span>
              <span>${formatPrice(activeOrder.total)}</span>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Transfer table / waiter
  const handleTransferTableSubmit = async () => {
    if (!user?.tenantId || !transferTableSrc) return;
    try {
      const batch = writeBatch(db);

      if (transferDestTableId) {
        const destTable = tables.find(t => t.id === transferDestTableId);
        if (destTable) {
          const srcTableRef = doc(db, 'restaurants', user.tenantId, 'tables', transferTableSrc.id);
          const destTableRef = doc(db, 'restaurants', user.tenantId, 'tables', destTable.id);

          batch.update(srcTableRef, { activeOrderId: null, status: 'empty', seatingTime: null, guestsCount: 0 });
          batch.update(destTableRef, {
            activeOrderId: transferTableSrc.activeOrderId,
            status: transferTableSrc.status,
            seatingTime: transferTableSrc.seatingTime || new Date().toISOString(),
            guestsCount: transferTableSrc.guestsCount || 2,
            assignedWaiterId: transferTableSrc.assignedWaiterId,
            assignedWaiterName: transferTableSrc.assignedWaiterName
          });

          if (transferTableSrc.activeOrderId) {
            const orderRef = doc(db, 'restaurants', user.tenantId, 'orders', transferTableSrc.activeOrderId);
            batch.update(orderRef, { tableNumber: destTable.number });
          }
        }
      }

      if (transferDestWaiterId) {
        const destWaiter = employees.find(e => e.id === transferDestWaiterId);
        if (destWaiter) {
          const tableId = transferDestTableId || transferTableSrc.id;
          const tableRef = doc(db, 'restaurants', user.tenantId, 'tables', tableId);
          batch.update(tableRef, {
            assignedWaiterId: destWaiter.id,
            assignedWaiterName: destWaiter.fullName || destWaiter.name
          });
        }
      }

      await batch.commit();
      toast.success('Table transfer complete.');
      setTransferTableSrc(null);
      setTransferDestTableId('');
      setTransferDestWaiterId('');
    } catch (e) {
      console.error(e);
      toast.error('Failed to transfer table.');
    }
  };

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <LoadingSpinner label="Loading floor management matrix..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left select-none pb-24">
      <div>
        <h1 className="text-2xl font-display font-extrabold text-[#18201D]">My Assigned Tables</h1>
        <p className="text-xs text-[#5F6875] font-semibold">
          Manage guest seating, order status flows, and checkout invoices for your active station tables.
        </p>
      </div>

      {myAssignedTables.length === 0 ? (
        <Card className="p-8 text-center border-[#E3DED5] bg-white rounded-3xl space-y-4 shadow-sm">
          <Award className="w-12 h-12 text-[#8D9B95] mx-auto" />
          <div>
            <h2 className="text-base font-extrabold text-[#18201D]">No Assigned Tables</h2>
            <p className="text-xs text-[#5F6875] mt-1 font-medium">
              Go to the Floor Matrix Seating panel or contact the manager to assign dining tables to your shift.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {myAssignedTables.map(table => {
            const hasReadyFood = table.activeOrder && table.activeOrder.status === 'READY';
            
            // Dynamic color coding
            let colors = { bg: 'bg-white', border: 'border-[#E3DED5]', text: 'text-[#5F6875]' };
            if (table.activeOrder?.status === 'READY') {
              colors = { bg: 'bg-emerald-50/70', border: 'border-emerald-300', text: 'text-emerald-700 font-extrabold' };
            } else if (table.mappedStatus === 'Serving') {
              colors = { bg: 'bg-blue-50/70', border: 'border-blue-300', text: 'text-blue-700 font-extrabold' };
            } else if (table.activeOrder?.status === 'PREPARING' || table.activeOrder?.status === 'ACCEPTED' || table.activeOrder?.status === 'SENT_TO_KITCHEN') {
              colors = { bg: 'bg-orange-50/70', border: 'border-orange-300', text: 'text-orange-800 font-extrabold' };
            } else if (table.mappedStatus === 'Needs Attention') {
              colors = { bg: 'bg-red-50/70', border: 'border-red-300', text: 'text-red-700 font-extrabold' };
            } else if (table.activeOrder?.paymentStatus === 'paid' || table.mappedStatus === 'Billing') {
              colors = { bg: 'bg-[#F7F4EE]', border: 'border-[#E3DED5]', text: 'text-[#5F6875]' };
            } else if (table.mappedStatus === 'Available') {
              colors = { bg: 'bg-white', border: 'border-[#E3DED5]', text: 'text-emerald-700' };
            }

            const itemsList = table.activeOrder?.items?.map((it: any) => `${it.name} x${it.count}`).join(', ') || 'None';
            const specialNotes = table.activeOrder?.notes || table.tableNotes || 'None';
            const allergyNotes = table.activeOrder?.allergyNotes || (specialNotes.toLowerCase().includes('allergy') ? specialNotes : 'None');
            const assignedTime = table.seatingTime ? new Date(table.seatingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
            const estimatedPrep = table.activeOrder?.estimatedPrepTime || (table.activeOrder?.items?.length ? table.activeOrder.items.length * 5 : 0);
            const etaTime = table.seatingTime && estimatedPrep ? new Date(new Date(table.seatingTime).getTime() + estimatedPrep * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

            return (
              <Card 
                key={table.id}
                className={`p-5 border ${colors.border} ${colors.bg} rounded-2xl flex flex-col justify-between hover:brightness-110 transition-all text-left space-y-3 relative`}
              >
                {(() => {
                  const activeAssistance = waiterRequests.find(r => 
                    (String(r.tableNumber) === String(table.number) || (r.orderId && r.orderId === table.activeOrderId)) && 
                    r.status !== 'Completed' && r.status !== 'Cancelled'
                  );

                  return (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-extrabold text-base text-[#18201D]">Table {table.number}</h3>
                          <span className="text-[10px] text-[#5F6875] font-bold uppercase">{table.section || 'Main Room'}</span>
                        </div>
                        <Badge variant="muted" className={`uppercase text-[9px] font-extrabold border ${colors.text} border-current/20`}>
                          {table.mappedStatus}
                        </Badge>
                      </div>

                      {/* Separate Table Indicators: Order Status & Assistance Request */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {table.activeOrder?.status === 'READY' && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full animate-pulse">
                            🍽️ Order Ready
                          </span>
                        )}
                        {activeAssistance && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                            🙋 Assistance: {activeAssistance.requestType || 'Help'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-1.5 text-[11px] text-slate-400">
                  <div className="flex justify-between items-center">
                    <span>Dining Session:</span>
                    <span className="font-bold text-slate-200">
                      {table.ordersCount > 1 ? (
                        <span className="text-amber-400 font-extrabold">{table.ordersCount} Orders Active</span>
                      ) : (
                        table.ordersCount === 1 ? '1 Order Active' : 'No Active Order'
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latest Order:</span>
                    <span className="font-mono text-slate-300 truncate max-w-[120px]">
                      {table.activeOrder?.orderId ? `#${table.activeOrder.orderId.substring(0, 12)}` : (table.activeOrderId ? `#${table.activeOrderId.substring(0, 12)}` : '—')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Guest Count:</span>
                    <span className="font-bold text-slate-200">{table.guestsCount || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kitchen Status:</span>
                    <span className="font-semibold text-slate-300">{table.activeOrder?.status || 'No Order'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Table Status:</span>
                    <span className="text-slate-350">{table.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Assigned At:</span>
                    <span className="text-slate-350">{assignedTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Ready Time:</span>
                    <span className="text-slate-350">{etaTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Bill:</span>
                    <span className="font-bold text-emerald-455">
                      {table.cumulativeBill > 0 ? formatPrice(table.cumulativeBill) : (table.activeOrder ? formatPrice(table.activeOrder.total) : '—')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Status:</span>
                    <span className="text-slate-350">{table.activeOrder?.paymentStatus || '—'}</span>
                  </div>
                  <div className="space-y-0.5 border-t border-slate-800/40 pt-1.5">
                    <div className="text-[10px] text-slate-500 font-extrabold uppercase">Dishes Ordered:</div>
                    <div className="text-[10px] text-slate-300 truncate font-semibold" title={itemsList}>
                      {itemsList}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-800/40 pt-1.5 text-[10px]">
                    <div>
                      <span className="block text-slate-500 font-bold uppercase text-[8px]">Allergies</span>
                      <span className="text-red-400 font-semibold truncate block" title={allergyNotes}>{allergyNotes}</span>
                    </div>
                    <div>
                      <span className="block text-slate-500 font-bold uppercase text-[8px]">Notes</span>
                      <span className="text-slate-300 font-semibold truncate block" title={specialNotes}>{specialNotes}</span>
                    </div>
                  </div>

                  {/* SLA Dining & Waiting Timer */}
                  {table.seatingTime && (
                    <TableTimer 
                      seatingTime={table.seatingTime} 
                      orderCreatedTime={table.activeOrder?.createdAt}
                      cookingStartedTime={table.activeOrder?.cookingStartedAt}
                      readyTime={table.activeOrder?.readyAt}
                      billRequestedTime={table.activeOrder?.billRequestedAt}
                      status={table.mappedStatus}
                    />
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800/40 space-y-2">
                  {/* Primary context action button */}
                  <div>
                    {table.mappedStatus === 'Available' && (
                      <Button
                        onClick={() => {
                          setSeatingTable(table);
                          setGuestsCount(table.seatingCapacity);
                          setTableNotesInput('');
                          setTableSectionInput(table.section || 'Main Room');
                        }}
                        className="w-full py-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold flex items-center justify-center space-x-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Seat Customer</span>
                      </Button>
                    )}

                    {table.mappedStatus === 'Ordering' && (
                      <div className="flex gap-2 w-full">
                        <Button
                          onClick={() => {
                            setOrderTable(table);
                            setCart({});
                            setCustomerName('');
                            setCustomerPhone('');
                          }}
                          className="flex-1 py-2 text-xs bg-primary text-slate-950 font-bold"
                        >
                          Take Order
                        </Button>
                        {table.activeOrder && (
                          <Button
                            onClick={() => handleSendOrder(table)}
                            className="flex-1 py-2 text-xs bg-indigo-500 text-slate-955 font-extrabold"
                          >
                            Send Order
                          </Button>
                        )}
                      </div>
                    )}

                    {table.mappedStatus === 'Waiting Food' && (
                      <div className="w-full space-y-1.5">
                        {hasReadyFood ? (
                          <Button
                            onClick={() => handleServeFood(table)}
                            className="w-full py-2 text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-955 font-extrabold flex items-center justify-center space-x-1"
                          >
                            <Utensils className="w-3.5 h-3.5" />
                            <span>Mark Served</span>
                          </Button>
                        ) : (
                          <div className="text-center py-2 text-[10px] text-yellow-500 bg-yellow-500/5 border border-yellow-500/10 rounded-xl font-bold animate-pulse">
                            🍳 Food Cooking in Kitchen...
                          </div>
                        )}
                      </div>
                    )}

                    {table.mappedStatus === 'Serving' && (
                      <Button
                        onClick={() => handleRequestBill(table)}
                        className="w-full py-2 text-xs bg-purple-650 text-white font-extrabold flex items-center justify-center space-x-1"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Generate Bill</span>
                      </Button>
                    )}

                    {table.mappedStatus === 'Billing' && (
                      <Button
                        onClick={() => {
                          const activeOrder = orders.find(o => o.orderId === table.activeOrderId);
                          if (activeOrder) {
                            setBillingOrder(activeOrder);
                            setDiscountPercent(0);
                            setFeedbackNotes('');
                            setFeedbackRating('Excellent');
                          }
                        }}
                        className="w-full py-2 text-xs bg-indigo-500 text-slate-955 font-extrabold flex items-center justify-center space-x-1"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Complete Table Payment</span>
                      </Button>
                    )}

                    {table.mappedStatus === 'Needs Attention' && table.status === 'cleaning' && (
                      <Button
                        onClick={() => handleCloseTable(table)}
                        className="w-full py-2 text-xs bg-red-650 text-white font-extrabold flex items-center justify-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Complete Table & Reset</span>
                      </Button>
                    )}
                  </div>

                  {/* Secondary Actions Panel */}
                  {table.status !== 'empty' && (
                    <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                      <button
                        onClick={() => setViewOrder(table.activeOrder)}
                        className="py-1 border border-slate-800 bg-slate-950/40 hover:bg-slate-900 rounded-lg text-slate-300 font-bold"
                        disabled={!table.activeOrderId}
                      >
                        View Order
                      </button>
                      <button
                        onClick={() => {
                          setOrderTable(table);
                          // Initialize cart with existing order items
                          const newCart: Record<string, any> = {};
                          table.activeOrder?.items?.forEach((it: any) => {
                            const menuItem = menuItems.find(mi => mi.id === it.menuItemId);
                            if (menuItem) {
                              newCart[menuItem.id] = { item: menuItem, count: it.count };
                            }
                          });
                          setCart(newCart);
                          setCustomerName(table.activeOrder?.customerName || '');
                        }}
                        className="py-1 border border-slate-800 bg-slate-950/40 hover:bg-slate-900 rounded-lg text-slate-300 font-bold"
                      >
                        Add Items
                      </button>
                      <button
                        onClick={() => setTransferTableSrc(table)}
                        className="py-1 border border-slate-800 bg-slate-950/40 hover:bg-slate-900 rounded-lg text-slate-300 font-bold"
                      >
                        Transfer Table
                      </button>
                      <button
                        onClick={() => setSplitBillOrder(table.activeOrder)}
                        className="py-1 border border-slate-800 bg-slate-950/40 hover:bg-slate-900 rounded-lg text-slate-300 font-bold"
                        disabled={!table.activeOrderId}
                      >
                        Split Bill
                      </button>
                      <button
                        onClick={() => handleRequestManager(table)}
                        className="py-1 border border-slate-800 bg-slate-950/40 hover:bg-slate-900 rounded-lg text-slate-300 font-bold"
                      >
                        Request Manager
                      </button>
                      <button
                        onClick={() => handleRequestKitchen(table)}
                        className="py-1 border border-slate-800 bg-slate-950/40 hover:bg-slate-900 rounded-lg text-slate-300 font-bold"
                      >
                        Request Kitchen
                      </button>
                      <button
                        onClick={() => handlePrintBill(table)}
                        className="py-1 border border-slate-800 bg-slate-950/40 hover:bg-slate-900 rounded-lg text-slate-300 font-bold"
                        disabled={!table.activeOrderId}
                      >
                        Print Bill
                      </button>
                      <button
                        onClick={() => setQrPaymentTable(table)}
                        className="py-1 border border-slate-800 bg-slate-950/40 hover:bg-slate-900 rounded-lg text-slate-300 font-bold"
                        disabled={!table.activeOrderId}
                      >
                        QR Payment
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Guest Seating Modal */}
      <Modal
        isOpen={seatingTable !== null}
        onClose={() => setSeatingTable(null)}
        hideHeader={true}
        className="bg-white border border-[#E3DED5] text-[#18201D] shadow-2xl rounded-3xl overflow-hidden p-0 max-w-md w-full"
        contentClassName="p-0 overflow-hidden"
      >
        {seatingTable && (
          <div className="flex flex-col bg-white text-left">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E3DED5] bg-[#FAF8F5]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C85A3F] text-white flex items-center justify-center font-black text-sm shadow-xs">
                  T{seatingTable.number}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#18201D] leading-tight">
                    Seating Setup — Table {seatingTable.number}
                  </h3>
                  <p className="text-xs font-semibold text-[#5F6875]">
                    {seatingTable.section || 'Indoor Main'} • Capacity: {seatingTable.seatingCapacity || 4} Guests
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSeatingTable(null)}
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
                    Max: {(seatingTable.seatingCapacity || 4) + 4}
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
                    onClick={() => setGuestsCount(c => Math.min((seatingTable.seatingCapacity || 4) + 4, c + 1))}
                    className="w-12 h-12 border border-[#E3DED5] bg-white hover:bg-[#F0EBE1] rounded-xl text-2xl font-black flex items-center justify-center text-[#18201D] shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
                <p className="text-[11px] text-[#5F6875] font-semibold">
                  Standard table capacity is {seatingTable.seatingCapacity || 4} guests.
                </p>
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
                  placeholder="e.g., VIP, peanut allergy, baby high chair"
                  className="w-full px-4 py-2.5 bg-[#FAF8F5] border border-[#E3DED5] text-[#18201D] font-medium placeholder-[#9CA3AF] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C85A3F]/30 focus:border-[#C85A3F] transition-all"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-[#E3DED5]">
                <button
                  type="button"
                  className="flex-1 bg-[#FAF8F5] border border-[#E3DED5] text-[#18201D] hover:bg-[#EAE5DC] rounded-xl font-bold py-3 transition-all cursor-pointer"
                  onClick={() => setSeatingTable(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="flex-1 bg-[#C85A3F] hover:bg-[#B34E35] text-white rounded-xl font-black py-3 shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                  onClick={handleSeatCustomer}
                >
                  <Users className="w-4 h-4" />
                  Seat Customer
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Customer-Style Rich Order Taking Modal ─── */}
      <Modal
        isOpen={orderTable !== null}
        onClose={() => {
          setOrderTable(null);
          setCart({});
          setOrderNotes('');
        }}
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
                      Take Order — Table {orderTable.number}
                    </h3>
                    <span className="text-[11px] font-bold text-[#5F6875] bg-[#F7F4EE] px-2 py-0.5 rounded-md border border-[#E3DED5]">
                      {orderTable.section || 'Indoor Main'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5F6875]">
                    Customer digital menu catalog · {filteredDishes.length} items available
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOrderTable(null);
                  setCart({});
                  setOrderNotes('');
                }}
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

                    {/* Dietary Filter Pills */}
                    <div className="flex items-center gap-1 bg-[#F7F4EE] p-1 rounded-xl border border-[#E3DED5] shrink-0">
                      <button
                        type="button"
                        onClick={() => setMenuDietaryFilter('all')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                          menuDietaryFilter === 'veg'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-[#5F6875] hover:text-emerald-700'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Veg</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMenuDietaryFilter('non-veg')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                          menuDietaryFilter === 'non-veg'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-[#5F6875] hover:text-rose-700'
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full bg-rose-400" />
                        <span>Non-Veg</span>
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Categories Scroll */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {categories.map(cat => {
                      const isSelected = selectedCategory === cat;
                      const count = cat === 'All' 
                        ? menuItems.length 
                        : menuItems.filter((m: any) => m.category === cat).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1 text-xs font-bold rounded-xl whitespace-nowrap transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-[#C85A3F] border-[#C85A3F] text-white shadow-xs font-extrabold'
                              : 'bg-white border-[#E3DED5] text-[#5F6875] hover:text-[#18201D] hover:border-stone-400'
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

                {/* Dishes Grid */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3.5">
                  {filteredDishes.length === 0 ? (
                    <div className="py-20 text-center space-y-2">
                      <Utensils className="w-10 h-10 text-[#9CA3AF] mx-auto opacity-40" />
                      <p className="text-sm font-bold text-[#18201D]">No dishes found</p>
                      <p className="text-xs text-[#5F6875]">Try clearing your search or choosing another category.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                      {filteredDishes.map((item: any) => {
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
                      onClick={() => {
                        setOrderTable(null);
                        setCart({});
                        setOrderNotes('');
                      }}
                      className="py-2.5 px-3 rounded-xl bg-white hover:bg-stone-100 border border-[#E3DED5] text-[#5F6875] font-bold text-xs cursor-pointer shadow-2xs transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePlaceOrder}
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

      {/* Bill checkout feedback Modal */}
      <Modal
        isOpen={billingOrder !== null}
        onClose={() => setBillingOrder(null)}
        title={billingOrder ? `Complete Checkout — Table ${billingOrder.tableNumber}` : ''}
      >
        {billingOrder && (
          <div className="space-y-4 text-left">
            <div className="p-4 bg-slate-950/40 border border-slate-855 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Bill Value:</span>
                <span className="font-bold text-slate-202">{formatPrice(billingOrder.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Apply Discount (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(Number(e.target.value))}
                  className="w-16 bg-slate-955 border border-slate-800 rounded px-1.5 py-0.5 text-slate-200 text-right font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">Diner Experience Rating</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { rating: 'Excellent', label: '😊 Great' },
                  { rating: 'Good', label: '🙂 Good' },
                  { rating: 'Neutral', label: '😐 Okay' },
                  { rating: 'Needs Attention', label: '☹ Poor' },
                  { rating: 'Complaint', label: '😡 Issue' }
                ].map(opt => (
                  <button
                    key={opt.rating}
                    type="button"
                    onClick={() => setFeedbackRating(opt.rating as any)}
                    className={`py-1.5 px-0.5 text-[10px] font-bold rounded-lg border transition-all text-center ${
                      feedbackRating === opt.rating
                        ? 'border-indigo-505 text-indigo-400 bg-indigo-950/20'
                        : 'border-slate-800 text-slate-500 hover:text-slate-300 bg-slate-900/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Context Notes"
              value={feedbackNotes}
              onChange={e => setFeedbackNotes(e.target.value)}
              placeholder="e.g. food was amazing, minor wait time"
            />

            <div className="flex items-center space-x-2.5">
              <input
                id="repeatCheck"
                type="checkbox"
                checked={isRepeatCustomer}
                onChange={e => setIsRepeatCustomer(e.target.checked)}
                className="w-4 h-4 bg-slate-955 border border-slate-800 rounded text-primary focus:ring-0 cursor-pointer"
              />
              <label htmlFor="repeatCheck" className="text-xs text-slate-400 cursor-pointer select-none">
                Mark guest as a Repeat Customer
              </label>
            </div>

            <div className="flex gap-3 pt-3">
              <Button variant="secondary" className="flex-1" onClick={() => setBillingOrder(null)}>
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold" 
                onClick={handleCompletePayment}
                isLoading={isSubmittingBill}
              >
                Settle & Clear Table
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* View Order Modal */}
      <Modal
        isOpen={viewOrder !== null}
        onClose={() => setViewOrder(null)}
        title={viewOrder ? `Order Details — #${viewOrder.orderId.substring(0, 12)}` : ''}
      >
        {viewOrder && (
          <div className="space-y-4 text-left text-xs text-slate-300">
            <div>
              <strong>Customer:</strong> {viewOrder.customerName}
            </div>
            <div>
              <strong>Table Number:</strong> {viewOrder.tableNumber}
            </div>
            <div>
              <strong>Order Status:</strong> {viewOrder.status}
            </div>
            <div className="border-t border-slate-800/40 pt-2 space-y-1">
              <strong>Items Ordered:</strong>
              {viewOrder.items?.map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between pl-2">
                  <span>{it.name} ×{it.count}</span>
                  <span>{formatPrice(it.pricePerUnit * it.count)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-800/40 pt-2 flex justify-between font-bold text-textPearl">
              <span>Grand Total:</span>
              <span>{formatPrice(viewOrder.total)}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Transfer Table Modal */}
      <Modal
        isOpen={transferTableSrc !== null}
        onClose={() => setTransferTableSrc(null)}
        title={transferTableSrc ? `Transfer Table ${transferTableSrc.number}` : ''}
      >
        {transferTableSrc && (
          <div className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Destination Table</label>
              <select
                value={transferDestTableId}
                onChange={e => setTransferDestTableId(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
              >
                <option value="">Choose Table...</option>
                {tables
                  .filter(t => t.status === 'empty' && t.id !== transferTableSrc.id)
                  .map(t => (
                    <option key={t.id} value={t.id}>Table {t.number} ({t.section || 'Main Room'})</option>
                  ))
                }
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400">Destination Waiter</label>
              <select
                value={transferDestWaiterId}
                onChange={e => setTransferDestWaiterId(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 outline-none"
              >
                <option value="">Choose Staff...</option>
                {employees
                  .filter(emp => emp.role === 'waiter')
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName || emp.name}</option>
                  ))
                }
              </select>
            </div>

            <div className="flex gap-3 pt-3">
              <Button variant="secondary" className="flex-1" onClick={() => setTransferTableSrc(null)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-primary text-slate-950" onClick={handleTransferTableSubmit}>
                Confirm Transfer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Split Bill Modal */}
      <Modal
        isOpen={splitBillOrder !== null}
        onClose={() => setSplitBillOrder(null)}
        title={splitBillOrder ? `Split Bill — Table ${splitBillOrder.tableNumber}` : ''}
      >
        {splitBillOrder && (
          <div className="space-y-4 text-left">
            <div className="p-4 bg-slate-955/40 border border-slate-855 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Bill Value:</span>
                <span className="font-bold text-slate-200">{formatPrice(splitBillOrder.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">Number of Splits:</span>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={splitCount}
                  onChange={e => setSplitCount(Math.max(2, Number(e.target.value)))}
                  className="w-16 bg-slate-955 border border-slate-800 rounded px-1.5 py-0.5 text-slate-200 text-right font-bold font-mono"
                />
              </div>
            </div>

            <div className="space-y-1 pt-1.5 text-xs">
              <span className="text-slate-500 font-bold uppercase text-[9px]">Split Breakdown:</span>
              <div className="bg-slate-900/10 border border-slate-850 p-3 rounded-xl divide-y divide-slate-800/40 space-y-1.5">
                {Array.from({ length: splitCount }).map((_, idx) => (
                  <div key={idx} className="flex justify-between py-1.5 text-slate-300 font-semibold">
                    <span>Split #{idx + 1}:</span>
                    <span>{formatPrice(Math.round(splitBillOrder.total / splitCount))}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <Button variant="secondary" className="flex-1" onClick={() => setSplitBillOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* QR Payment Modal */}
      <Modal
        isOpen={qrPaymentTable !== null}
        onClose={() => setQrPaymentTable(null)}
        title={qrPaymentTable ? `QR Payment Code — Table ${qrPaymentTable.number}` : ''}
      >
        {qrPaymentTable && (
          <div className="space-y-4 text-center">
            <div className="bg-white p-4 rounded-2xl w-48 h-48 mx-auto flex items-center justify-center border border-slate-200">
              <div className="space-y-2 text-slate-900 font-mono text-[9px] font-bold">
                <div className="w-32 h-32 border-4 border-slate-900 mx-auto flex items-center justify-center p-2 relative">
                  <div className="w-10 h-10 bg-slate-900 absolute top-2 left-2" />
                  <div className="w-10 h-10 bg-slate-900 absolute top-2 right-2" />
                  <div className="w-10 h-10 bg-slate-900 absolute bottom-2 left-2" />
                  <div className="w-6 h-6 bg-slate-900" />
                </div>
                <div className="text-center mt-1">SCAN TO PAY</div>
              </div>
            </div>
            <div className="text-xs text-slate-400 text-center">
              Scan this QR to pay <strong>{formatPrice(orders.find(o => o.orderId === qrPaymentTable.activeOrderId)?.total || 0)}</strong> via UPI/UPI-QR.
            </div>
            <Button variant="secondary" className="w-full" onClick={() => setQrPaymentTable(null)}>
              Close
            </Button>
          </div>
        )}
      </Modal>

      {/* Upcoming Reservations Feed */}
      <div className="mt-12 space-y-4 border-t border-[#E3DED5] pt-8">
        <div>
          <h2 className="text-lg font-display font-extrabold text-[#18201D]">Upcoming Table Bookings</h2>
          <p className="text-xs text-[#5F6875]">List of reservations waiting check-in at reception.</p>
        </div>

        {reservations.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-[#5F6875] border border-dashed border-[#E3DED5] bg-white rounded-3xl">
            <p className="text-xs font-semibold">No bookings registered for seating.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {reservations.map((res) => {
              // Simple arrival timer simulation
              const isDue = true;
              return (
                <Card 
                  key={res.id} 
                  className="p-4 bg-white border border-[#E3DED5] hover:border-[#D0C9BD] shadow-xs rounded-2xl flex flex-col justify-between text-xs space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-extrabold text-[#18201D] text-sm">{res.customerName}</h4>
                        <p className="text-[10px] text-[#667085] font-mono">Ref: {res.id}</p>
                      </div>
                      <Badge variant="warning" className="text-[8px] py-0.5 uppercase font-bold">
                        {res.status}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-[11px] text-[#5F6875]">
                      <div className="flex justify-between">
                        <span>Expected Arrival:</span>
                        <span className="font-bold text-[#18201D] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-primary animate-pulse" />
                          <span>{res.time} ({res.estimatedArrival})</span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Party Size:</span>
                        <span className="font-semibold text-[#18201D]">{res.guests} Guests</span>
                      </div>
                      {res.seatingPreference && (
                        <div className="flex justify-between">
                          <span>Seat Preference:</span>
                          <span className="font-bold text-primary">{res.seatingPreference}</span>
                        </div>
                      )}
                      {res.specialNotes && (
                        <div className="border-t border-[#E3DED5] pt-2 mt-2">
                          <span className="text-[9px] uppercase font-bold text-[#667085] block">Notes:</span>
                          <span className="text-[#18201D] italic">"{res.specialNotes}"</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setActiveCheckInRes(res);
                      setCheckInTableId(tables.find(t => t.status === 'empty')?.id || '');
                      setIsCheckInModalOpen(true);
                    }}
                    className="w-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 font-bold py-2 rounded-xl text-[11px]"
                  >
                    Guest Check-In
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Guest Seating & Check-in Assign Table Modal */}
      <Modal
        isOpen={isCheckInModalOpen}
        onClose={() => { setIsCheckInModalOpen(false); setActiveCheckInRes(null); }}
        title="Check-In Diner Party"
        className="max-w-md"
      >
        {activeCheckInRes && (
          <div className="space-y-4 text-left text-xs">
            <div className="p-3.5 bg-[#F7F4EE] border border-[#E3DED5] rounded-xl space-y-1.5">
              <h4 className="font-bold text-[#18201D] text-sm">{activeCheckInRes.customerName}</h4>
              <p className="text-[#5F6875]">Time: {activeCheckInRes.date} @ {activeCheckInRes.time} · Party: {activeCheckInRes.guests} guests</p>
              {activeCheckInRes.seatingPreference && (
                <p className="text-primary font-bold">Zone Request: {activeCheckInRes.seatingPreference}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[10.5px] uppercase font-bold text-[#667085] tracking-wider">Select Available Seating Table</label>
              <select
                value={checkInTableId}
                onChange={(e) => setCheckInTableId(e.target.value)}
                className="w-full p-3 bg-white border border-[#E3DED5] focus:border-primary text-[#18201D] rounded-xl outline-none"
              >
                <option value="">-- Choose table --</option>
                {tables.map(t => (
                  <option key={t.id} value={t.id}>
                    Table {t.number} ({t.capacity} seats, Floor: {t.floor || 'Main'})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button 
                variant="secondary" 
                className="flex-1" 
                onClick={() => { setIsCheckInModalOpen(false); setActiveCheckInRes(null); }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleConfirmCheckIn}
                disabled={!checkInTableId}
              >
                Seat & Check-In
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WaiterAssignedTablesPage;
