export interface IOrderItem {
  itemId: string;
  name: string;
  count: number;
  notes: string;
  pricePerUnit: number; // in cents snapshotted at purchase
  
  // Complimentary items fields
  isComplimentary?: boolean;
  complimentaryReason?: string;
  complimentaryApprovedBy?: string;
  complimentaryApprovedByName?: string;
  complimentaryAt?: string;

  // Visual presentation metadata (optional)
  image?: string;
  imageUrl?: string;
  description?: string;
  isVeg?: boolean;
  veg?: boolean;
  category?: string;
}

export interface ITimelineEvent {
  type: 'ORDER_CREATED' | 'ACCEPTED' | 'CHEF_ASSIGNED' | 'PREPARING' | 'READY' | 'PICKED_UP' | 'DELIVERED' | 'SERVED' | 'COMPLETED' | 'PAID' | 'CLOSED' | 'ARCHIVED' | 'CANCELLED' | 'PAUSED' | 'RESUMED' | 'RECALLED' | 'BATCH_REFILL' | 'WASTE';
  title: string;
  description?: string;
  performedBy?: string;
  timestamp: string; // ISO string
}

export type TPaymentStatus = 'pending' | 'partially_paid' | 'paid' | 'refunded' | 'cancelled';

export interface IPaymentBreakdown {
  cash: number;   // in cents
  upi: number;    // in cents
  card: number;   // in cents
  wallet: number; // in cents
  credit?: number; // for backward compatibility
  qr?: number; // for backward compatibility
}

export interface IOrder {
  orderId: string;
  tableNumber: string;
  tableId?: string;
  tableName?: string;
  tenantId?: string;
  restaurantId?: string;
  branchId?: string;
  orderType?: 'dine_in' | 'takeaway' | 'delivery' | 'walk_in' | 'dine-in';
  orderSource?: 'qr' | 'app' | 'pos' | 'waiter';
  customerName: string;
  phone: string;
  customerPhone?: string;
  items: IOrderItem[];
  subtotal: number; // in cents
  tax: number; // in cents
  total: number; // in cents
  status: TOrderStatus;
  createdAt: string;
  updatedAt?: string;
  timeline?: ITimelineEvent[];
  
  // Chef Assignment
  assignedChefId?: string;
  assignedChefName?: string;
  assignedAt?: string;
  assignedBy?: string;

  // Prep & Cook tracking
  cookingStartedAt?: string;
  readyAt?: string;
  estimatedPrepTime?: number;

  // Pause / Resume
  pauseReason?: string;
  pausedAt?: string;
  pausedBy?: string;

  // Recall Ready
  recallReason?: string;
  recalledAt?: string;
  recalledBy?: string;

  // Kitchen Notes
  customerNotes?: string;
  kitchenNotes?: string;
  chefNotes?: string;
  notes?: string;
  allergyNotes?: string;

  // Queue and priority
  queueOrder?: number;
  priorityOverride?: boolean;
  priority?: 'critical' | 'high' | 'normal' | 'low';

  // Delivery details
  deliveryAcceptedAt?: string;
  deliveredAt?: string;
  deliveryDurationSeconds?: number;
  waiterId?: string;
  waiterName?: string;
  guestsCount?: number;

  // ── Billing & POS fields ──────────────────────────────────────────────────
  billId?: string;                // Canonical Bill ID e.g. BILL-ORD-XXXX
  billGeneratedAt?: string;       // ISO — when canonical bill was generated
  paymentStatus?: TPaymentStatus;
  paymentMethods?: IPaymentBreakdown;
  paymentMethod?: string;
  invoiceNumber?: string;         // e.g. INV-20260705-0001
  discount?: number;              // in cents — flat discount after percentage calc
  discountType?: 'percentage' | 'fixed' | 'coupon' | 'manager' | 'staff';
  discountPercent?: number;       // raw % entered (0-100)
  discountLabel?: string;         // e.g. 'Staff 10%', 'Coupon SAVE20'
  serviceCharge?: number;         // in cents
  serviceChargePercent?: number;  // raw % (e.g. 5)
  roundOff?: number;              // in cents — can be negative
  billRequestedAt?: string;       // ISO — when waiter clicked Request Bill
  diningCompletedAt?: string;     // ISO — when customer or staff marked dining completed
  billOpenedAt?: string;          // ISO — when owner opened the bill
  paidAt?: string;                // ISO — when payment was completed
  processedBy?: string;           // uid of owner/cashier who processed payment
  processedByName?: string;       // display name

  // Hold & Resume
  isHeld?: boolean;
  holdReason?: string;
  heldAt?: string;
  resumedAt?: string;

  // Invoice Reprint Log
  reprintCount?: number;
  reprintsLog?: Array<{
    reprintedBy: string;
    reprintedByName: string;
    timestamp: string;
    reason?: string;
  }>;
}

// ── KDS / Kitchen Specific Types ─────────────────────────────────────────────

export type TKdsTab = 'table' | 'category' | 'station' | 'item-queue' | 'queue' | 'inventory' | 'reservations';

export type TOrderStatus =
  | 'NEW' | 'PLACED' | 'ACCEPTED' | 'CHEF_ASSIGNED' | 'PREPARING' | 'PAUSED'
  | 'READY' | 'PICKED_UP' | 'DELIVERED' | 'SERVED' | 'DINING_COMPLETED' | 'COMPLETED' | 'PAID' | 'CLOSED' | 'ARCHIVED' | 'CANCELLED'
  | 'CREATED' | 'VERIFIED' | 'SENT_TO_KITCHEN' | 'DELIVERING' | 'DINING' | 'BILL_REQUESTED' | 'PAYMENT_COMPLETED' | 'TABLE_CLEANING' | 'TABLE_AVAILABLE';

export type TPriority = 'critical' | 'high' | 'normal' | 'low';

export type TChefStatus = 'available' | 'busy' | 'break' | 'offline';

export interface IKdsOrder extends IOrder {
  id?: string;
  tableId?: string;
  customerType?: 'dine-in' | 'takeaway' | 'delivery';
  isRush?: boolean;
  deliveryDeadline?: string; // ISO string
  station?: string;
}

export interface IKdsMetrics {
  activeOrders: number;
  preparingOrders: number;
  readyOrders: number;
  avgPrepTimeMinutes: number;
  delayedOrders: number;
  completedToday: number;
  kitchenEfficiencyPct: number;
  peakQueueToday: number;
  longestWaitingOrderId: string | null;
  longestWaitingMinutes: number;
  fastestCompletedMinutes: number;
  ordersOver15Min: number;
  bottleneckStation: string | null;
  avgTicketTimeMinutes: number;
  kitchenLoadPct?: number;
}

export interface IBulkConfirmDialog {
  isOpen: boolean;
  action: string;
  nextStatus: TOrderStatus;
  count: number;
}

// ── Chef Availability ────────────────────────────────────────────────────────

export interface IChefAvailability {
  chefId: string;
  chefName: string;
  status: TChefStatus;
  currentLoad: number;         // number of active orders assigned
  ordersAssigned: number;      // total orders today
  ordersCompleted: number;     // completed today
  avgCookTimeMinutes: number;  // avg prep time today
  currentOrderIds: string[];   // active order IDs
  lastStatusChange?: string;   // ISO timestamp
}

// ── Kitchen Announcements ────────────────────────────────────────────────────

export type TAnnouncementType = 'info' | 'warning' | 'urgent' | 'success';

export interface IKitchenAnnouncement {
  id?: string;
  message: string;
  type: TAnnouncementType;
  createdBy: string;
  createdByName: string;
  createdAt: string;       // ISO
  expiresAt?: string;      // ISO — auto-hide after this time
  isPinned?: boolean;
  isActive?: boolean;
}

// ── Shift Management ─────────────────────────────────────────────────────────

export interface IShiftRecord {
  id?: string;
  chefId: string;
  chefName: string;
  shiftStart: string;      // ISO
  shiftEnd?: string;       // ISO — null if still on shift
  ordersCompleted: number;
  avgCookTimeMinutes: number;
  breakTimeMinutes: number;
  idleTimeMinutes: number;
  efficiency: number;      // percentage 0-100
  totalItems: number;
}

// ── Station Management ───────────────────────────────────────────────────────

export interface IStationConfig {
  id?: string;
  name: string;
  assignedCategories: string[];  // e.g. ['Pizza', 'Burgers']
  assignedChefIds: string[];
  isActive: boolean;
  color?: string;                // for display
  icon?: string;                 // lucide icon name
  maxCapacity?: number;          // max concurrent orders
  currentLoad?: number;
}

// ── Recipe Validation ────────────────────────────────────────────────────────

export interface IIngredientCheck {
  ingredientId: string;
  ingredientName: string;
  requiredQty: number;
  availableQty: number;
  unit: string;
  status: 'available' | 'low' | 'out';
  portionsRemaining?: number;
  suggestedPurchase?: number;
}

export interface IRecipeValidation {
  itemId: string;
  itemName: string;
  ingredients: IIngredientCheck[];
  canPrepare: boolean;
  batchAvailable?: number;       // for batch items, how many portions ready
  missingCount: number;
  lowStockCount: number;
}

// ── Voice Notification Framework ─────────────────────────────────────────────

export type TVoiceEventType = 'ORDER_READY' | 'LOW_STOCK' | 'NEW_ORDER' | 'PREPARE_BATCH' | 'RUSH_ORDER' | 'ANNOUNCEMENT';

export interface IVoiceNotification {
  id: string;
  type: TVoiceEventType;
  message: string;
  priority: TPriority;
  createdAt: string;
  acknowledged: boolean;
}
