/**
 * Pure metric calculation functions for the Kitchen Display System.
 * All functions are side-effect-free and derive values from the in-memory
 * orders array — no Firestore reads.
 */
import { ITimelineEvent } from '../../../types';
import { IKdsOrder, IKdsMetrics, TOrderStatus, TPriority } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const ACTIVE_STATUSES: TOrderStatus[] = ['NEW', 'PLACED', 'ACCEPTED', 'CHEF_ASSIGNED', 'PREPARING', 'PAUSED', 'READY', 'PICKED_UP', 'SERVED'];
export const COOKING_STATUSES: TOrderStatus[] = ['ACCEPTED', 'CHEF_ASSIGNED', 'PREPARING', 'PAUSED'];
export const DONE_STATUSES: TOrderStatus[] = ['DELIVERED', 'COMPLETED', 'PAID', 'CLOSED', 'ARCHIVED'];
export const PREP_STATUSES: TOrderStatus[] = ['NEW', 'PLACED', 'ACCEPTED', 'CHEF_ASSIGNED', 'PREPARING', 'PAUSED'];

/**
 * Enhanced Priority Engine — Weighted multi-factor scoring.
 * 
 * Priority is determined by the HIGHEST scoring factor:
 * - Manual override (always honored)
 * - Rush order flag → critical
 * - Delivery deadline approaching (< 15 min) → critical
 * - VIP customer → critical
 * - Long waiting time (> 15 min) → critical
 * - Delivery deadline moderate (< 30 min) → high
 * - Waiting > 10 min → high
 * - Large order (> 6 items) → high
 * - Default → normal
 */
export function calculateSmartPriority(order: IKdsOrder): TPriority {
  // 0. Manual override always takes precedence
  if (order.priorityOverride && order.priority) {
    return order.priority as TPriority;
  }

  // 1. Rush order flag
  if ((order as any).isRush) {
    return 'critical';
  }

  // 2. Delivery deadline approaching
  const deadline = (order as any).deliveryDeadline;
  if (deadline) {
    const deadlineMs = new Date(deadline).getTime();
    const nowMs = Date.now();
    const minutesUntilDeadline = (deadlineMs - nowMs) / 60000;
    if (minutesUntilDeadline < 15) return 'critical';
    if (minutesUntilDeadline < 30) return 'high';
  }

  // 3. VIP Customer
  if (order.customerName && order.customerName.toLowerCase().includes('vip')) {
    return 'critical';
  }

  // 4. Long waiting time
  const elapsed = getElapsedMinutes(order.createdAt);
  if (elapsed > 15) {
    return 'critical';
  }
  if (elapsed > 10) {
    return 'high';
  }

  // 5. Large Order (sum of item counts > 6)
  const totalItemsCount = (order.items || []).reduce((sum, i) => sum + i.count, 0);
  if (totalItemsCount > 6) {
    return 'high';
  }

  return 'normal';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns elapsed minutes from an ISO date string to now. */
export const getElapsedMinutes = (dateStr: string): number => {
  if (!dateStr) return 0;
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return 0;
  return Math.max(0, (Date.now() - time) / 60000);
};

/** Returns elapsed seconds from an ISO date string to now. */
export const getElapsedSeconds = (dateStr: string): number => {
  if (!dateStr) return 0;
  const time = new Date(dateStr).getTime();
  if (isNaN(time)) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 1000));
};

/** Formats elapsed seconds to MM:SS. */
export const formatElapsedSeconds = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/** Returns Tailwind color class for elapsed seconds — 5-band color scale. */
export const getElapsedColor = (seconds: number): string => {
  if (seconds < 5 * 60) return 'text-emerald-400';          // 0–5 min
  if (seconds < 10 * 60) return 'text-yellow-400';           // 5–10 min
  if (seconds < 15 * 60) return 'text-orange-400';           // 10–15 min
  if (seconds < 20 * 60) return 'text-red-400';              // 15–20 min
  return 'text-red-500 animate-pulse';                       // 20+ min (critical)
};

/** Returns true if the given ISO string is today (local date). */
const isToday = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

/**
 * Finds a timeline event by type.
 */
const findEvent = (
  timeline: ITimelineEvent[] | undefined,
  type: ITimelineEvent['type']
): ITimelineEvent | undefined => (timeline || []).find(e => e.type === type);

/**
 * Returns ACCEPTED → READY prep time in minutes.
 * Returns null if the order does not have both timeline events.
 */
export const getPrepTimeMinutes = (order: IKdsOrder): number | null => {
  const accepted = findEvent(order.timeline, 'ACCEPTED');
  const ready = findEvent(order.timeline, 'READY');
  if (!accepted || !ready) return null;
  return (new Date(ready.timestamp).getTime() - new Date(accepted.timestamp).getTime()) / 60000;
};

/**
 * Returns ORDER_CREATED → DELIVERED total time in minutes.
 * Returns null if incomplete.
 */
export const getTotalTimeMinutes = (order: IKdsOrder): number | null => {
  const created = findEvent(order.timeline, 'ORDER_CREATED');
  const delivered = findEvent(order.timeline, 'DELIVERED');
  if (!created || !delivered) {
    // Fall back to createdAt → updatedAt
    if (!order.updatedAt) return null;
    return (new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime()) / 60000;
  }
  return (new Date(delivered.timestamp).getTime() - new Date(created.timestamp).getTime()) / 60000;
};

/**
 * Returns the station with the most pending item rows across all active orders.
 */
const calcBottleneckStation = (orders: IKdsOrder[]): string | null => {
  const active = orders.filter(o => ACTIVE_STATUSES.includes(o.status as TOrderStatus));
  const counts: Record<string, number> = {};

  active.forEach(order => {
    order.items.forEach(item => {
      const rawItem = item as any;
      const station = rawItem.station || rawItem.category || 'Main Kitchen';
      counts[station] = (counts[station] || 0) + item.count;
    });
  });

  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => b[1] - a[1])[0][0];
};

// ─── Main Metrics Calculator ──────────────────────────────────────────────────

/**
 * Derives all kitchen metrics from the in-memory orders array.
 * This is a pure function — call it inside useMemo.
 *
 * @param orders         Full orders array from the Firestore listener.
 * @param thresholdMinutes Delay threshold in minutes (orders over this are "delayed").
 * @param targetMinutes  Target prep time for efficiency calculation.
 * @param peakQueueToday Peak simultaneous active orders tracked by the component (via ref).
 */
export function calcKitchenMetrics(
  orders: IKdsOrder[],
  thresholdMinutes: number,
  targetMinutes: number,
  peakQueueToday: number
): IKdsMetrics {
  // Active / preparing / ready counts
  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.status as TOrderStatus));
  const preparingOrders = orders.filter(o => o.status === 'PREPARING');
  const readyOrders = orders.filter(o => o.status === 'READY');

  // Delayed = active orders whose elapsed time exceeds threshold
  const delayedOrders = activeOrders.filter(o => getElapsedMinutes(o.createdAt) > thresholdMinutes);

  // Completed today
  const completedToday = orders.filter(
    o => DONE_STATUSES.includes(o.status as TOrderStatus) && isToday(o.createdAt)
  );

  // Avg prep time from timeline-tracked orders
  const prepTimeSamples = completedToday
    .map(o => getPrepTimeMinutes(o))
    .filter((t): t is number => t !== null);
  const avgPrepTimeMinutes =
    prepTimeSamples.length > 0
      ? prepTimeSamples.reduce((a, b) => a + b, 0) / prepTimeSamples.length
      : 0;

  // Kitchen efficiency: % of completed-today orders done within target time
  const withinTarget = prepTimeSamples.filter(t => t <= targetMinutes).length;
  const kitchenEfficiencyPct =
    prepTimeSamples.length > 0 ? Math.round((withinTarget / prepTimeSamples.length) * 100) : 100;

  // Fastest completed today
  const fastestCompletedMinutes =
    prepTimeSamples.length > 0 ? Math.min(...prepTimeSamples) : 0;

  // Longest waiting active order
  let longestWaitingOrderId: string | null = null;
  let longestWaitingMinutes = 0;
  activeOrders.forEach(o => {
    const elapsed = getElapsedMinutes(o.createdAt);
    if (elapsed > longestWaitingMinutes) {
      longestWaitingMinutes = elapsed;
      longestWaitingOrderId = o.orderId;
    }
  });

  // Orders waiting > 15 min
  const ordersOver15Min = activeOrders.filter(o => getElapsedMinutes(o.createdAt) > 15).length;

  // Avg total ticket time (created → delivered) for today
  const totalTimeSamples = completedToday
    .map(o => getTotalTimeMinutes(o))
    .filter((t): t is number => t !== null);
  const avgTicketTimeMinutes =
    totalTimeSamples.length > 0
      ? totalTimeSamples.reduce((a, b) => a + b, 0) / totalTimeSamples.length
      : 0;

  // Bottleneck station
  const bottleneckStation = calcBottleneckStation(orders);

  return {
    activeOrders: activeOrders.length,
    preparingOrders: preparingOrders.length,
    readyOrders: readyOrders.length,
    avgPrepTimeMinutes,
    delayedOrders: delayedOrders.length,
    completedToday: completedToday.length,
    kitchenEfficiencyPct,
    peakQueueToday,
    longestWaitingOrderId,
    longestWaitingMinutes,
    fastestCompletedMinutes,
    ordersOver15Min,
    bottleneckStation,
    avgTicketTimeMinutes,
  };
}
