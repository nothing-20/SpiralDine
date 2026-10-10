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
  'REFUNDED',
  'PAYMENT_COMPLETED'
] as const;

/**
 * Canonical check to determine if an order is in a terminal / finalized state.
 * Returns true if:
 * 1. Order is cancelled, refunded, or archived.
 * 2. Order is closed.
 * 3. Both food/service lifecycle is completed (COMPLETED, PAID, PAYMENT_COMPLETED, DINING_COMPLETED, SERVED)
 *    AND payment is settled (paymentStatus === 'paid' or billStatus === 'paid').
 * 
 * An order whose food was served/prepared but whose payment is still pending
 * is NOT terminal — it must remain active in Waiter, Kitchen, and Owner portals so the bill can be settled.
 */
export const isOrderTerminal = (order?: { 
  status?: string; 
  orderStatus?: string; 
  paymentStatus?: string; 
  billStatus?: string;
  isPaid?: boolean;
} | null): boolean => {
  if (!order) return false;
  const status = (order.status || order.orderStatus || '').toUpperCase().trim();
  const paymentStatus = (order.paymentStatus || order.billStatus || '').toLowerCase().trim();
  const isPaid = paymentStatus === 'paid' || order.isPaid === true;

  // Cancelled or refunded orders are always terminal
  if (status === 'CANCELLED' || status === 'REFUNDED' || paymentStatus === 'refunded' || paymentStatus === 'cancelled') {
    return true;
  }

  // Archived or Closed orders are terminal
  if (status === 'ARCHIVED' || status === 'CLOSED') {
    return true;
  }

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
 * a terminal status and whose payment or service is still pending.
 */
export const isOrderActive = (order?: { 
  items?: any[];
  itemsCount?: number;
  total?: number;
  totalAmount?: number;
  status?: string; 
  orderStatus?: string; 
  paymentStatus?: string; 
  billStatus?: string;
  isPaid?: boolean;
} | null): boolean => {
  if (!order) return false;
  // Hard validation: An order with no items or 0 items is NOT an active food order
  if (Array.isArray(order.items) && order.items.length === 0) {
    return false;
  }
  if (typeof order.itemsCount === 'number' && order.itemsCount === 0 && (!order.items || order.items.length === 0)) {
    return false;
  }
  return !isOrderTerminal(order);
};

/**
 * Returns a human-readable badge label for an order's operational lifecycle.
 */
export const getOrderDisplayStatus = (order?: { status?: string; orderStatus?: string; paymentStatus?: string } | null): string => {
  if (!order) return 'Unknown';
  const status = (order.status || order.orderStatus || '').toUpperCase().trim();
  const paymentStatus = (order.paymentStatus || '').toLowerCase().trim();
  const isPaid = paymentStatus === 'paid';

  if (status === 'CANCELLED') return 'Cancelled';
  if (status === 'REFUNDED' || paymentStatus === 'refunded') return 'Refunded';
  if (status === 'NEW' || status === 'PLACED') return 'New';
  if (status === 'ACCEPTED' || status === 'CHEF_ASSIGNED') return 'Accepted';
  if (status === 'PREPARING') return 'Preparing';
  if (status === 'READY') return 'Ready to Serve';
  if (status === 'SERVED' || status === 'DELIVERED') {
    return isPaid ? 'Served & Paid' : 'Served (Unpaid)';
  }
  if (status === 'BILL_REQUESTED') return 'Bill Requested';
  if (status === 'PAID' || status === 'COMPLETED' || isPaid) return 'Paid';
  return status || 'Active';
};


