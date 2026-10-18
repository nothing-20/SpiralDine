export type PromotionType =
  | 'percentage'          // e.g. 20% off
  | 'fixed_amount'        // e.g. ₹100 off
  | 'bogo'                // Buy 1 Get 1
  | 'fixed_price_combo'   // Combo meal fixed price (e.g. ₹299)
  | 'item_specific'       // Discount on specific dishes
  | 'category_specific'   // Discount on specific category
  | 'restaurant_wide'     // Store-wide offer
  | 'coupon_code'         // Standard coupon code
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'BOGO'
  | 'FIXED_PRICE_COMBO'
  | 'ITEM_DISCOUNT'
  | 'CATEGORY_DISCOUNT'
  | 'RESTAURANT_WIDE'
  | 'COUPON';

export type PromotionStatus = 
  | 'draft' 
  | 'active' 
  | 'scheduled' 
  | 'paused' 
  | 'expired' 
  | 'archived'
  | 'DRAFT'
  | 'ACTIVE'
  | 'SCHEDULED'
  | 'PAUSED'
  | 'EXPIRED'
  | 'ARCHIVED';

export type PromotionPlacement = 
  | 'home_carousel' 
  | 'restaurant_menu' 
  | 'cart_suggestion' 
  | 'food_card'
  | 'HOME_CAROUSEL'
  | 'MENU_BANNER'
  | 'FOOD_CARD'
  | 'CART_CHECKOUT'
  | 'ALL';

export interface IPromotionMetrics {
  impressions: number;
  clicks: number;
  redemptions: number;
  totalDiscountGiven: number;   // in minor units / INR
  totalRevenueGenerated: number; // in minor units / INR
}

export interface IPromotion {
  id: string;
  tenantId: string;
  restaurantId: string;
  restaurantName?: string;
  name: string;
  description: string;
  type: PromotionType;
  value: number; // percentage (1-100) or fixed amount in INR
  discountValue?: number; // alias for value
  code?: string; // uppercase coupon code (e.g. 'SPIRAL20')
  couponCode?: string; // alias for code
  badgeText?: string; // e.g. '20% OFF', 'BOGO', 'COMBO'
  imageUrl?: string | null;

  // Eligibility scope
  applicableItemIds?: string[];
  applicableCategoryIds?: string[];
  applicableBranches?: string[]; // if restaurant has multiple branches
  targetAudience?: 'all' | 'new_customers' | 'returning_customers' | 'vip';

  // Financial constraints
  minOrderValue?: number; // Minimum cart subtotal in INR required
  maxDiscountAmount?: number; // Cap on percentage discounts in INR

  // Time validity
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  status: PromotionStatus;

  // Limits
  globalUsageLimit?: number; // Total redemptions allowed across all diners
  perCustomerLimit?: number; // Max redemptions per customer (e.g. 1)
  redemptionCount: number;   // Current successful redemptions

  // Display & Stacking
  placements: PromotionPlacement[];
  placement?: PromotionPlacement | string; // convenience alias
  allowStacking: boolean; // false by default (cannot be combined with other coupons)
  priority?: number; // higher priority applied first

  // Metrics & Tracking
  metrics?: IPromotionMetrics;

  createdAt: string;
  updatedAt: string;
}

export interface IPromotionCalculationResult {
  isEligible: boolean;
  ineligibilityReason?: string;
  itemDiscounts: {
    itemId: string;
    originalPrice: number;
    discountedPrice: number;
    savings: number;
    promotionId: string;
    badgeText?: string;
  }[];
  couponDiscount: number;
  totalSavings: number;
  taxableSubtotal: number;
  taxAmount: number;
  serviceChargeAmount: number;
  finalPayableTotal: number;
  appliedPromotion?: IPromotion;
}

export interface ICouponValidationRequest {
  tenantId: string;
  code: string;
  cartSubtotal: number;
  items: {
    itemId: string;
    categoryId?: string;
    price: number;
    count: number;
  }[];
  customerId?: string;
}

export interface ICouponValidationResponse {
  valid: boolean;
  promotion?: IPromotion;
  discountAmount?: number;
  errorMessage?: string;
  message?: string; // alias for errorMessage
}
