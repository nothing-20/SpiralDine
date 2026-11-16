export type TSpecialBenefitStatus = 'active' | 'inactive';
export type TSpecialBenefitScope = 'all_restaurants' | 'selected_restaurants';
export type TSpecialBenefitFunding = 'platform_funded' | 'restaurant_funded' | 'joint_funded';
export type TSpecialBenefitFrequency = 'unlimited' | 'once_per_day' | 'once_per_week' | 'once_total';

export interface ISpecialBenefit {
  id: string;                               // Document ID: "BENEFIT-<nanoid|uuid>"
  memberEmail?: string;                     // Normalized lowercase email
  memberPhone?: string;                     // Normalized E.164 phone
  memberUid?: string;                       // Populated upon authentic matching or pre-association
  memberName: string;                       // Professional administrative label
  
  // Benefit terms
  discountPercentage: number;               // Range: 1 to 100 (Default: 50)
  status: TSpecialBenefitStatus;            // 'active' | 'inactive'
  
  // Validity Window
  startDate?: string;                       // ISO-8601 (optional start date)
  expiryDate?: string;                      // ISO-8601 (optional expiry date)
  
  // Usage Controls
  maxUsageTotal?: number | null;            // Maximum lifetime redemptions across platform (null = unlimited)
  maxDiscountPerOrder?: number | null;      // Maximum discount cap per order in currency units (optional)
  usageFrequency: TSpecialBenefitFrequency; // Frequency limiter
  redemptionCount: number;                  // Atomic counter of completed redemptions
  
  // Restaurant Scope
  scope: TSpecialBenefitScope;              // 'all_restaurants' | 'selected_restaurants'
  applicableTenantIds?: string[];           // List of restaurant tenant IDs if scope is 'selected_restaurants'
  
  // Financial Settlement & Funding Model
  fundingModel: TSpecialBenefitFunding;     // Default: 'platform_funded'
  platformContributionPercent: number;      // e.g., 100 for platform_funded, 0 for restaurant_funded, 50 for joint
  restaurantContributionPercent: number;    // e.g., 0 for platform_funded, 100 for restaurant_funded, 50 for joint
  
  // Administrative Audit Metadata
  notes?: string;                           // Administrative remarks
  createdBy: string;                        // Super Admin UID
  createdByName?: string;                   // Super Admin Display Name
  createdAt: string;                        // ISO-8601
  updatedAt: string;                        // ISO-8601
  lastRedeemedAt?: string;                  // ISO-8601
}

export type TRedemptionStatus = 'reserved' | 'finalized' | 'cancelled' | 'refunded';

export interface ISpecialBenefitRedemption {
  id: string;                               // "RED-<orderId>"
  benefitId: string;                        // Reference to parent specialBenefits doc
  orderId: string;                          // SpiralDine Order ID
  billId?: string;                          // Canonical Bill ID
  tenantId: string;                         // Restaurant workspace ID
  restaurantName: string;                   // Restaurant legal display name
  customerUid: string;                      // Authenticated customer UID
  customerEmail?: string;                   // Redacted/normalized email
  customerPhone?: string;                   // Redacted/normalized phone
  
  // Financial Snapshot (Integer Cents/Paise)
  originalSubtotal: number;
  discountPercentage: number;
  discountAmount: number;
  finalPayableAmount: number;
  
  // Funding Allocation
  fundingModel: TSpecialBenefitFunding;
  platformFundedAmount: number;             // Amount subsidized by SaaS platform
  restaurantFundedAmount: number;           // Amount absorbed by restaurant
  
  // State Lifecycle
  status: TRedemptionStatus;
  reservedAt: string;                       // Timestamp when order was placed
  finalizedAt?: string;                     // Timestamp when payment verified/settled
  cancelledAt?: string;                     // Timestamp if order cancelled
  refundedAt?: string;                      // Timestamp if refunded
}

export interface ISpecialBenefitEligibilityResponse {
  eligible: boolean;
  benefitId?: string;
  discountPercentage?: number;
  label?: string;
  scope?: TSpecialBenefitScope;
  fundingModel?: TSpecialBenefitFunding;
  maxDiscountPerOrder?: number | null;
  reason?: string;
}
