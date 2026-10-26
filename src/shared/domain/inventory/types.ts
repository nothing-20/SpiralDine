export interface IStockIngredient {
  id: string;
  name: string;
  category: 'Vegetables' | 'Meat' | 'Dairy' | 'Dry Goods' | 'Beverages' | 'Spices' | 'Bakery' | 'Other';
  unit: 'kg' | 'g' | 'liters' | 'ml' | 'pieces' | 'packs';
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  reorderLevel: number;
  supplierId: string;
  supplierName: string;
  purchaseCost: number; // in cents
  sellingCost?: number; // in cents
  storageLocation: 'Fridge' | 'Freezer' | 'Pantry' | 'Dry Storage' | 'Bar' | 'Kitchen Shelf';
  expiryDate: string; // YYYY-MM-DD
  status: 'healthy' | 'low' | 'critical' | 'out_of_stock';
  barcode?: string;
  updatedAt: string;
}

export interface IRecipeIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity: number; // e.g. 250 (g) or 2 (pieces)
  unit: string;
  alternativeIngredientIds?: string[];
  notes?: string;
}

export interface IRecipe {
  id: string; // matches menuItemId
  menuItemId: string;
  menuItemName: string;
  version: string; // e.g. "v1.0"
  yieldQuantity: number; // e.g. 1 serving
  wastePercentage: number; // e.g. 5 for 5% waste
  ingredients: IRecipeIngredient[];
  updatedAt: string;
  recipeName?: string;
  portionSize?: string;
  cookingNotes?: string;
}

export interface IStockMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number; // positive for restock, negative for deduction
  unit?: string;
  previousStock?: number;
  newStock?: number;
  type: 'purchase' | 'consumption' | 'adjustment' | 'waste' | 'spoilage' | 'manual_correction' | 'refund_restock' | 'cancellation_restock';
  reason: string;
  valueLost?: number; // in cents (optional)
  unitPrice?: number; // in cents (optional)
  totalValue?: number; // in cents (quantity * unitPrice)
  poNumber?: string;
  receiptNumber?: string;
  submittedBy: string; // userId or "system"
  submittedByName: string; // userName or "System Automation"
  performedByRole?: string; // e.g. "kitchen", "owner", "admin"
  tenantId?: string;
  timestamp: string; // ISO string
}

export interface ISupplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  suppliedIngredientIds: string[];
  deliveryTimeDays: number;
  rating: number; // 1-5 star
  updatedAt: string;
  companyName?: string;
  gstNumber?: string;
  paymentTerms?: string;
  deliverySchedule?: string;
  // Additive vendor directory enhancements
  contactPerson?: string;
  notes?: string;
  isActive?: boolean;
  branchIds?: string[];
  createdAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface ISupplierPrice {
  id: string; // Composite key or doc ID: `${supplierId}_${ingredientId}`
  supplierId: string;
  supplierName: string;
  ingredientId: string;
  ingredientName: string;
  unitPrice: number; // in cents / base unit
  currency?: string;
  purchaseUnit: string;
  minOrderQuantity?: number;
  leadTimeDays?: number;
  isPreferred?: boolean;
  effectiveFrom: string; // ISO date
  effectiveTo?: string; // Optional end date
  notes?: string;
  priceHistory?: Array<{
    price: number;
    effectiveFrom: string;
    changedAt: string;
    changedBy?: string;
    reason?: string;
  }>;
  updatedAt: string;
}

export interface IPurchaseOrderItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  unitPrice: number; // in cents
  taxRate?: number; // e.g. 5 for 5%
  lineTotal: number; // quantity * unitPrice
  receivedQuantity: number;
  notes?: string;
}

export type PurchaseOrderStatus = 
  | 'DRAFT' 
  | 'SENT' 
  | 'CONFIRMED' 
  | 'PARTIALLY_RECEIVED' 
  | 'DELIVERED' 
  | 'CANCELLED';

export interface IPurchaseOrder {
  id: string;
  poNumber: string; // e.g. "PO-20261026-001"
  tenantId: string;
  restaurantName?: string;
  branchId?: string;
  branchName?: string;
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierAddress?: string;
  supplierGstNumber?: string;
  items: IPurchaseOrderItem[];
  status: PurchaseOrderStatus;
  subtotal: number; // in cents
  taxTotal: number; // in cents
  deliveryCharge?: number; // in cents
  grandTotal: number; // in cents
  expectedDeliveryDate?: string;
  deliveryAddress?: string;
  supplierInstructions?: string;
  internalNotes?: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  sentAt?: string;
  sentVia?: 'whatsapp' | 'email' | 'manual' | 'pdf';
  confirmedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  receiptCount?: number;
  auditLog?: Array<{
    action: string;
    timestamp: string;
    performedBy: string;
    notes?: string;
  }>;
}

export interface IGoodsReceiptItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantityOrdered: number;
  quantityPreviouslyReceived: number;
  quantityReceived: number;
  quantityRejected?: number;
  unitPrice?: number; // in cents
  lineTotal?: number; // in cents (quantityReceived * unitPrice)
  batchNumber?: string;
  expiryDate?: string;
  discrepancyReason?: string;
}

export interface IGoodsReceipt {
  id: string;
  receiptNumber: string; // e.g. "GRN-20261026-001"
  poId: string;
  poNumber: string;
  tenantId: string;
  branchId?: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNumber?: string;
  invoiceDate?: string;
  items: IGoodsReceiptItem[];
  totalReceivedValue: number; // in cents
  idempotencyKey?: string;
  receivedAt: string;
  receivedBy: string;
  receivedByName: string;
  notes?: string;
}

export interface IPurchaseSuggestion {
  id: string;
  ingredientId: string;
  ingredientName: string;
  recommendedQuantity: number;
  unit: string;
  supplierId: string;
  supplierName: string;
  estimatedCost: number; // in cents
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  status: 'pending' | 'ordered' | 'completed';
  requiredQuantity?: number; // for backward compatibility
}

export interface IWasteLog {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  reason: 'spoilage' | 'expired' | 'damaged' | 'staff_mistake' | 'customer_return';
  valueLost: number; // in cents
  submittedBy: string;
  submittedByName: string;
  timestamp: string;
}
