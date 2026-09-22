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
