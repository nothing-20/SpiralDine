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
 * 1. Order is cancelled, refunded, or archived.
 * 2. Order is closed.
 * 3. Both food/service lifecycle is completed (COMPLETED, PAID, PAYMENT_COMPLETED, DINING_COMPLETED, SERVED)
 *    AND payment is settled (paymentStatus === 'paid').
 * 
 * An order whose food was served/prepared but whose payment is still pending
 * is NOT terminal — it must remain active so the customer can pay.
 */
export const isOrderTerminal = (order?: { status?: string; paymentStatus?: string } | null): boolean => {
  if (!order) return false;
  const status = (order.status || '').toUpperCase().trim();
  const paymentStatus = (order.paymentStatus || '').toLowerCase().trim();

  // Cancelled or refunded orders are always terminal
  if (status === 'CANCELLED' || paymentStatus === 'refunded' || paymentStatus === 'cancelled') {
    return true;
  }

  // Archived or Closed orders are terminal
  if (status === 'ARCHIVED' || status === 'CLOSED') {
    return true;
  }

  const isPaid = paymentStatus === 'paid';

  // Explicit terminal status with paid payment
  if ((status === 'PAID' || status === 'PAYMENT_COMPLETED') && isPaid) {
    return true;
  }

  // Completed or served dining only moves to past history once payment is settled
  if (isPaid && (status === 'COMPLETED' || status === 'DINING_COMPLETED' || status === 'SERVED' || status === 'DELIVERED')) {
    return true;
  }

  // Legacy fallback: if status is explicitly COMPLETED and paymentStatus is empty/undefined, consider terminal
  if (status === 'COMPLETED' && !paymentStatus) {
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

