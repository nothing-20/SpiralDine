/**
 * Kitchen Service — Enterprise kitchen operations service.
 * Handles recipe validation, chef availability, station management,
 * announcements, shift tracking, batch prediction, and kitchen load.
 */
import {
  collection, doc, getDoc, getDocs, updateDoc, addDoc,
  query, where, orderBy, limit, onSnapshot
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  IChefAvailability, IKitchenAnnouncement, IShiftRecord,
  IStationConfig, IRecipeValidation, IIngredientCheck,
  TChefStatus, IKdsOrder, TOrderStatus
} from '../domain/orders/types';

const ACTIVE_STATUSES: TOrderStatus[] = ['NEW', 'PLACED', 'ACCEPTED', 'CHEF_ASSIGNED', 'PREPARING', 'PAUSED', 'READY', 'PICKED_UP', 'SERVED'];

// ── Recipe Validation ────────────────────────────────────────────────────────

async function validateRecipeIngredients(
  tenantId: string,
  orderItems: Array<{ itemId: string; name: string; count: number }>
): Promise<IRecipeValidation[]> {
  const results: IRecipeValidation[] = [];

  for (const orderItem of orderItems) {
    const ingredients: IIngredientCheck[] = [];
    let canPrepare = true;
    let missingCount = 0;
    let lowStockCount = 0;

    // Check if menu item has recipe/ingredients defined
    try {
      const recipeSnap = await getDocs(
        collection(db, 'restaurants', tenantId, 'menu', 'default', 'items', orderItem.itemId, 'ingredients')
      );

      if (!recipeSnap.empty) {
        for (const ingDoc of recipeSnap.docs) {
          const ingData = ingDoc.data();
          const requiredQty = (ingData.quantityPerUnit || 0) * orderItem.count;

          // Look up current stock level
          let availableQty = 0;
          try {
            const stockDoc = await getDoc(doc(db, 'restaurants', tenantId, 'inventory', ingDoc.id));
            if (stockDoc.exists()) {
              availableQty = stockDoc.data().currentStock || 0;
            }
          } catch { /* stock doc may not exist */ }

          let status: 'available' | 'low' | 'out' = 'available';
          if (availableQty <= 0) {
            status = 'out';
            missingCount++;
            canPrepare = false;
          } else if (availableQty < requiredQty * 2) {
            status = 'low';
            lowStockCount++;
          }

          ingredients.push({
            ingredientId: ingDoc.id,
            ingredientName: ingData.name || ingDoc.id,
            requiredQty,
            availableQty,
            unit: ingData.unit || 'units',
            status,
            portionsRemaining: requiredQty > 0 ? Math.floor(availableQty / (requiredQty / orderItem.count)) : 0,
            suggestedPurchase: status === 'out' ? requiredQty * 5 : status === 'low' ? requiredQty * 3 : 0,
          });
        }
      }

      // Check batch availability
      let batchAvailable: number | undefined;
      try {
        const menuDoc = await getDoc(doc(db, 'restaurants', tenantId, 'menu', 'default', 'items', orderItem.itemId));
        if (menuDoc.exists()) {
          const menuData = menuDoc.data();
          if (menuData.preparationMethod === 'batch' || menuData.productionMode === 'Batch Production') {
            batchAvailable = menuData.availableServings ?? 0;
          }
        }
      } catch { /* ignore */ }

      results.push({
        itemId: orderItem.itemId,
        itemName: orderItem.name,
        ingredients,
        canPrepare: ingredients.length === 0 ? true : canPrepare,
        batchAvailable,
        missingCount,
        lowStockCount,
      });
    } catch (err) {
      console.error('[KitchenService] Recipe validation error:', err);
      results.push({
        itemId: orderItem.itemId,
        itemName: orderItem.name,
        ingredients: [],
        canPrepare: true, // Allow if recipe check fails
        missingCount: 0,
        lowStockCount: 0,
      });
    }
  }

  return results;
}

// ── Kitchen Staff Role Utilities ─────────────────────────────────────────────

export const KITCHEN_ELIGIBLE_ROLES = [
  'kitchen',
  'chef',
  'kitchen_staff',
  'cook',
  'head_chef',
  'line_cook',
] as const;

export function isKitchenStaffRole(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim().replace(/[-\s]/g, '_');
  return (KITCHEN_ELIGIBLE_ROLES as readonly string[]).includes(normalized);
}

export function filterKitchenStaff<T extends { role?: string; status?: string }>(employees: T[]): T[] {
  if (!Array.isArray(employees)) return [];
  return employees.filter(e => (!e.status || e.status === 'active') && isKitchenStaffRole(e.role));
}

// ── Chef Availability ────────────────────────────────────────────────────────

function deriveChefAvailability(
  employees: any[],
  orders: IKdsOrder[]
): IChefAvailability[] {
  const kitchenStaff = filterKitchenStaff(employees);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return kitchenStaff.map(chef => {
    const assignedOrders = orders.filter(o => o.assignedChefId === chef.id);
    const activeOrders = assignedOrders.filter(o => ACTIVE_STATUSES.includes(o.status as TOrderStatus));
    const completedToday = assignedOrders.filter(o => {
      if (!['COMPLETED', 'SERVED', 'DELIVERED', 'PAID', 'CLOSED', 'ARCHIVED'].includes(o.status)) return false;
      return new Date(o.createdAt) >= today;
    });

    // Calculate avg cook time from completed orders with timeline
    const prepTimes: number[] = [];
    completedToday.forEach(o => {
      const accepted = (o.timeline || []).find(e => e.type === 'ACCEPTED');
      const ready = (o.timeline || []).find(e => e.type === 'READY');
      if (accepted && ready) {
        const mins = (new Date(ready.timestamp).getTime() - new Date(accepted.timestamp).getTime()) / 60000;
        if (mins > 0 && mins < 120) prepTimes.push(mins);
      }
    });
    const avgCookTime = prepTimes.length > 0
      ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length
      : 0;

    // Determine status
    let status: TChefStatus = 'available';
    if (chef.status === 'inactive' || chef.status === 'offline') {
      status = 'offline';
    } else if (activeOrders.length >= 3) {
      status = 'busy';
    } else if (activeOrders.length > 0) {
      status = 'busy';
    }

    return {
      chefId: chef.id,
      chefName: chef.fullName || chef.name || 'Unknown Chef',
      status,
      currentLoad: activeOrders.length,
      ordersAssigned: assignedOrders.filter(o => new Date(o.createdAt) >= today).length,
      ordersCompleted: completedToday.length,
      avgCookTimeMinutes: Math.round(avgCookTime * 10) / 10,
      currentOrderIds: activeOrders.map(o => o.orderId),
    };
  });
}

function suggestBestChef(chefs: IChefAvailability[]): IChefAvailability | null {
  const available = chefs
    .filter(c => c.status === 'available' || c.status === 'busy')
    .sort((a, b) => a.currentLoad - b.currentLoad);
  return available[0] || null;
}

// ── Announcements ────────────────────────────────────────────────────────────

async function createAnnouncement(
  tenantId: string,
  announcement: Omit<IKitchenAnnouncement, 'id'>
): Promise<string> {
  const colRef = collection(db, 'restaurants', tenantId, 'kitchenAnnouncements');
  const docRef = await addDoc(colRef, {
    ...announcement,
    isActive: true,
  });
  return docRef.id;
}

async function dismissAnnouncement(tenantId: string, announcementId: string): Promise<void> {
  const docRef = doc(db, 'restaurants', tenantId, 'kitchenAnnouncements', announcementId);
  await updateDoc(docRef, { isActive: false });
}

function subscribeToAnnouncements(
  tenantId: string,
  callback: (announcements: IKitchenAnnouncement[]) => void
): () => void {
  const colRef = collection(db, 'restaurants', tenantId, 'kitchenAnnouncements');
  const q = query(colRef, where('isActive', '==', true), orderBy('createdAt', 'desc'), limit(20));

  return onSnapshot(q, (snap) => {
    const list: IKitchenAnnouncement[] = [];
    snap.forEach(d => {
      const data = d.data();
      // Auto-expire
      if (data.expiresAt && new Date(data.expiresAt) < new Date()) return;
      list.push({ id: d.id, ...data } as IKitchenAnnouncement);
    });
    callback(list);
  });
}

// ── Shift Management ─────────────────────────────────────────────────────────

async function startShift(tenantId: string, chefId: string, chefName: string): Promise<string> {
  const colRef = collection(db, 'restaurants', tenantId, 'kitchenShifts');
  const docRef = await addDoc(colRef, {
    chefId,
    chefName,
    shiftStart: new Date().toISOString(),
    shiftEnd: null,
    ordersCompleted: 0,
    avgCookTimeMinutes: 0,
    breakTimeMinutes: 0,
    idleTimeMinutes: 0,
    efficiency: 0,
    totalItems: 0,
  });
  return docRef.id;
}

async function endShift(tenantId: string, shiftId: string, stats: Partial<IShiftRecord>): Promise<void> {
  const docRef = doc(db, 'restaurants', tenantId, 'kitchenShifts', shiftId);
  await updateDoc(docRef, {
    shiftEnd: new Date().toISOString(),
    ...stats,
  });
}

function subscribeToActiveShifts(
  tenantId: string,
  callback: (shifts: IShiftRecord[]) => void
): () => void {
  const colRef = collection(db, 'restaurants', tenantId, 'kitchenShifts');
  const q = query(colRef, where('shiftEnd', '==', null), orderBy('shiftStart', 'desc'));
  return onSnapshot(q, (snap) => {
    const list: IShiftRecord[] = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() } as IShiftRecord));
    callback(list);
  });
}

// ── Station Management ───────────────────────────────────────────────────────

const DEFAULT_STATIONS: IStationConfig[] = [
  { name: 'Rice Station', assignedCategories: ['Rice', 'Biryani'], assignedChefIds: [], isActive: true, color: '#f59e0b' },
  { name: 'Grill Station', assignedCategories: ['Starters', 'Kebabs', 'Burgers', 'Grill'], assignedChefIds: [], isActive: true, color: '#ef4444' },
  { name: 'Fry Station', assignedCategories: ['Fried', 'Chinese', 'Noodles'], assignedChefIds: [], isActive: true, color: '#f97316' },
  { name: 'Main Kitchen', assignedCategories: ['Main Course', 'Curries', 'Dal'], assignedChefIds: [], isActive: true, color: '#eab308' },
  { name: 'Dessert Station', assignedCategories: ['Desserts', 'Sweets', 'Ice Cream'], assignedChefIds: [], isActive: true, color: '#ec4899' },
  { name: 'Drinks Station', assignedCategories: ['Beverages', 'Drinks', 'Juice', 'Shakes'], assignedChefIds: [], isActive: true, color: '#3b82f6' },
];

function inferStationForItem(category: string, stations: IStationConfig[]): string {
  const cat = (category || '').toLowerCase();
  for (const station of stations) {
    if (station.assignedCategories.some(c => cat.includes(c.toLowerCase()))) {
      return station.name;
    }
  }
  return 'Main Kitchen';
}

// ── Kitchen Load ─────────────────────────────────────────────────────────────

function calculateKitchenLoad(
  activeOrderCount: number,
  maxCapacity: number = 20
): { loadPct: number; label: string; color: string; suggestion: string } {
  const loadPct = Math.min(Math.round((activeOrderCount / maxCapacity) * 100), 100);

  let label: string;
  let color: string;
  let suggestion: string;

  if (loadPct < 40) {
    label = 'Normal';
    color = 'emerald';
    suggestion = 'Kitchen is running smoothly.';
  } else if (loadPct < 60) {
    label = 'Moderate';
    color = 'yellow';
    suggestion = 'Consider preparing batch items in advance.';
  } else if (loadPct < 80) {
    label = 'Busy';
    color = 'orange';
    suggestion = 'Assign additional staff if available.';
  } else if (loadPct < 95) {
    label = 'High Load';
    color = 'red';
    suggestion = 'Consider pausing new dine-in orders.';
  } else {
    label = 'Overloaded';
    color = 'red';
    suggestion = 'Stop accepting new orders temporarily.';
  }

  return { loadPct, label, color, suggestion };
}

// ── Smart Batch Prediction ───────────────────────────────────────────────────

function predictBatchQuantity(
  itemName: string,
  historicalOrders: IKdsOrder[],
  currentHour: number,
  dayOfWeek: number
): { suggestedQty: number; confidence: string; reasoning: string } {
  // Count how many times this item was ordered in past orders
  let totalOrdered = 0;
  let relevantOrders = 0;

  historicalOrders.forEach(order => {
    const orderDate = new Date(order.createdAt);
    const orderHour = orderDate.getHours();
    const orderDay = orderDate.getDay();

    // Weight orders from similar time and day higher
    const isRelevantTime = Math.abs(orderHour - currentHour) <= 2;
    const isRelevantDay = orderDay === dayOfWeek;

    order.items.forEach(item => {
      if (item.name.toLowerCase() === itemName.toLowerCase()) {
        const weight = (isRelevantTime ? 2 : 1) * (isRelevantDay ? 1.5 : 1);
        totalOrdered += item.count * weight;
        relevantOrders++;
      }
    });
  });

  const avgPerPeriod = relevantOrders > 0 ? Math.ceil(totalOrdered / Math.max(relevantOrders / 5, 1)) : 10;
  const suggestedQty = Math.max(Math.ceil(avgPerPeriod * 1.2), 5); // 20% buffer

  let confidence = 'Low';
  let reasoning = 'Not enough historical data. Using default estimate.';

  if (relevantOrders > 50) {
    confidence = 'High';
    reasoning = `Based on ${relevantOrders} historical orders at similar times.`;
  } else if (relevantOrders > 20) {
    confidence = 'Medium';
    reasoning = `Based on ${relevantOrders} historical orders. More data improves accuracy.`;
  }

  return { suggestedQty, confidence, reasoning };
}

// ── Heat Map Data ────────────────────────────────────────────────────────────

function calculateHeatMapData(orders: IKdsOrder[]): {
  hourlyData: Array<{ hour: number; count: number; avgPrepTime: number }>;
  dailyData: Array<{ day: number; dayName: string; count: number }>;
  peakHour: number;
  slowHour: number;
  busiestDay: string;
  avgOrdersPerHour: number;
} {
  const hourCounts: Record<number, { count: number; prepTimes: number[] }> = {};
  const dayCounts: Record<number, number> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Initialize
  for (let h = 0; h < 24; h++) hourCounts[h] = { count: 0, prepTimes: [] };
  for (let d = 0; d < 7; d++) dayCounts[d] = 0;

  orders.forEach(order => {
    const date = new Date(order.createdAt);
    const hour = date.getHours();
    const day = date.getDay();

    hourCounts[hour].count++;
    dayCounts[day]++;

    // Prep time calculation
    const accepted = (order.timeline || []).find(e => e.type === 'ACCEPTED');
    const ready = (order.timeline || []).find(e => e.type === 'READY');
    if (accepted && ready) {
      const mins = (new Date(ready.timestamp).getTime() - new Date(accepted.timestamp).getTime()) / 60000;
      if (mins > 0 && mins < 120) hourCounts[hour].prepTimes.push(mins);
    }
  });

  const hourlyData = Object.entries(hourCounts).map(([h, data]) => ({
    hour: Number(h),
    count: data.count,
    avgPrepTime: data.prepTimes.length > 0
      ? Math.round(data.prepTimes.reduce((a, b) => a + b, 0) / data.prepTimes.length * 10) / 10
      : 0,
  }));

  const dailyData = Object.entries(dayCounts).map(([d, count]) => ({
    day: Number(d),
    dayName: dayNames[Number(d)],
    count,
  }));

  const totalOrders = orders.length;
  const operatingHours = hourlyData.filter(h => h.count > 0).length || 1;

  const peakHour = hourlyData.reduce((max, h) => h.count > max.count ? h : max, hourlyData[0]).hour;
  const slowHour = hourlyData.filter(h => h.count > 0).reduce((min, h) => h.count < min.count ? h : min, hourlyData[peakHour]).hour;
  const busiestDay = dailyData.reduce((max, d) => d.count > max.count ? d : max, dailyData[0]).dayName;

  return {
    hourlyData,
    dailyData,
    peakHour,
    slowHour,
    busiestDay,
    avgOrdersPerHour: Math.round(totalOrders / operatingHours * 10) / 10,
  };
}

// ── Export ────────────────────────────────────────────────────────────────────

export const kitchenService = {
  // Role & Eligibility
  isKitchenStaffRole,
  filterKitchenStaff,
  KITCHEN_ELIGIBLE_ROLES,

  // Recipe Validation
  validateRecipeIngredients,

  // Chef Availability
  deriveChefAvailability,
  suggestBestChef,

  // Announcements
  createAnnouncement,
  dismissAnnouncement,
  subscribeToAnnouncements,

  // Shift Management
  startShift,
  endShift,
  subscribeToActiveShifts,

  // Stations
  DEFAULT_STATIONS,
  inferStationForItem,

  // Kitchen Load
  calculateKitchenLoad,

  // Batch Prediction
  predictBatchQuantity,

  // Heat Map
  calculateHeatMapData,
};
