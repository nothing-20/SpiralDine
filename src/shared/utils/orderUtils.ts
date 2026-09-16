/**
 * Shared utility for generating standardized Order IDs in RestaurantOS.
 * Expected format: ORD-YYYYMMDD-XXXXXX
 */
export const generateUniqueOrderId = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const randStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${dateStr}-${randStr}`;
};

/**
 * Canonical terminal order statuses in SpiralDine.
 * Orders in any of these statuses have concluded their operational lifecycle
 * and must not be treated as active in customer portals or kitchen prep queues.
 */
export const TERMINAL_ORDER_STATUSES = [
  'COMPLETED',
  'PAID',
  'CLOSED',
  'ARCHIVED',
  'CANCELLED',
  'PAYMENT_COMPLETED'
] as const;

/**
 * Canonical check to determine if an order is in a terminal / finalized state.
 * Returns true if:
 * 1. Order status is in TERMINAL_ORDER_STATUSES (e.g. COMPLETED, PAID, CLOSED, ARCHIVED, CANCELLED)
 * 2. Payment status is 'paid' (or 'refunded' / 'cancelled')
 */
export const isOrderTerminal = (order?: { status?: string; paymentStatus?: string } | null): boolean => {
  if (!order) return false;
  const status = (order.status || '').toUpperCase().trim();
  const paymentStatus = (order.paymentStatus || '').toLowerCase().trim();

  // Terminal lifecycle status
  if (TERMINAL_ORDER_STATUSES.includes(status as any)) {
    return true;
  }

  // Terminal payment state: paid, refunded, cancelled
  if (paymentStatus === 'paid' || paymentStatus === 'refunded' || paymentStatus === 'cancelled') {
    return true;
  }

  return false;
};

/**
 * Canonical check to determine if an order is active.
 * An active order is any order currently in progress that has NOT yet reached
 * a terminal status and whose payment is still pending.
 */
export const isOrderActive = (order?: { status?: string; paymentStatus?: string } | null): boolean => {
  if (!order) return false;
  return !isOrderTerminal(order);
};

