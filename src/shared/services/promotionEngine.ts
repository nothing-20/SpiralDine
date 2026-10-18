import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  increment,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
  IPromotion, 
  IPromotionCalculationResult, 
  ICouponValidationRequest, 
  ICouponValidationResponse,
  PromotionPlacement
} from '../domain/promotions/types';

/**
 * Checks whether a promotion is currently eligible based on status, validity window, and global limits.
 */
export function isPromotionActive(promotion: IPromotion, atDate = new Date()): boolean {
  if (!promotion) return false;
  if (promotion.status !== 'active') return false;

  const now = atDate.getTime();
  if (promotion.startDate) {
    const start = new Date(promotion.startDate).getTime();
    if (!isNaN(start) && now < start) return false;
  }
  if (promotion.endDate) {
    const end = new Date(promotion.endDate).getTime();
    if (!isNaN(end) && now > end) return false;
  }

  if (typeof promotion.globalUsageLimit === 'number' && promotion.globalUsageLimit > 0) {
    if ((promotion.redemptionCount || 0) >= promotion.globalUsageLimit) {
      return false;
    }
  }

  return true;
}

/**
 * Calculates item-level discount and promotion badge for an item.
 */
export function calculateItemDiscount(
  item: { id: string; category?: string; price: number; discountPrice?: number },
  activePromotions: IPromotion[],
  customPrice?: number
): {
  originalPrice: number;
  discountedPrice: number;
  savings: number;
  discountAmount: number;
  badgeText?: string;
  badge?: string;
  appliedPromotion?: IPromotion;
  promotion?: IPromotion;
} {
  const originalPrice = Number(customPrice !== undefined ? customPrice : (item.price || 0));
  if (originalPrice <= 0) {
    return { originalPrice: 0, discountedPrice: 0, savings: 0, discountAmount: 0 };
  }

  // If item already has a manual discountPrice set on the menu item, treat as base
  let bestDiscountedPrice = item.discountPrice && item.discountPrice > 0 && item.discountPrice < originalPrice
    ? item.discountPrice
    : originalPrice;
  let bestSavings = originalPrice - bestDiscountedPrice;
  let bestBadge: string | undefined = bestSavings > 0 
    ? `${Math.round((bestSavings / originalPrice) * 100)}% OFF` 
    : undefined;
  let bestPromo: IPromotion | undefined = undefined;

  // Evaluate active promotions applicable to dishes
  for (const promo of activePromotions) {
    if (!isPromotionActive(promo)) continue;
    // Skip coupon codes for automatic item-level pricing
    const pType = String(promo.type).toLowerCase();
    if (pType === 'coupon_code' || pType === 'coupon') continue;

    let isApplicable = false;
    if ((pType === 'item_specific' || pType === 'item_discount') && Array.isArray(promo.applicableItemIds) && promo.applicableItemIds.includes(item.id)) {
      isApplicable = true;
    } else if ((pType === 'category_specific' || pType === 'category_discount') && item.category && Array.isArray(promo.applicableCategoryIds) && promo.applicableCategoryIds.includes(item.category)) {
      isApplicable = true;
    } else if (pType === 'restaurant_wide') {
      isApplicable = true;
    } else if (pType === 'bogo' && Array.isArray(promo.applicableItemIds) && promo.applicableItemIds.includes(item.id)) {
      isApplicable = true;
    } else if (pType === 'percentage' && !promo.code && !promo.couponCode) {
      isApplicable = true;
    }

    if (isApplicable) {
      let currentPrice = originalPrice;
      const promoVal = Number(promo.value ?? promo.discountValue ?? 0);
      if (pType === 'percentage') {
        const pct = Math.min(100, Math.max(0, promoVal));
        currentPrice = Math.round(originalPrice * (1 - pct / 100));
      } else if (pType === 'fixed_amount') {
        currentPrice = Math.max(0, originalPrice - promoVal);
      } else if (pType === 'bogo') {
        // BOGO badge representation on food cards
        bestBadge = promo.badgeText || 'BUY 1 GET 1';
        bestPromo = promo;
        continue;
      }

      const savings = originalPrice - currentPrice;
      if (savings > bestSavings) {
        bestSavings = savings;
        bestDiscountedPrice = currentPrice;
        bestBadge = promo.badgeText || `${Math.round((savings / originalPrice) * 100)}% OFF`;
        bestPromo = promo;
      }
    }
  }

  return {
    originalPrice,
    discountedPrice: bestDiscountedPrice,
    savings: bestSavings,
    discountAmount: bestSavings,
    badgeText: bestBadge,
    badge: bestBadge,
    appliedPromotion: bestPromo,
    promotion: bestPromo
  };
}

/**
 * Validates a coupon code against a list of promotions or Firestore rules.
 * Supports both validateCoupon(request, promotions) and validateCoupon(promo, subtotal, items, customerId).
 */
export function validateCoupon(
  requestOrPromo: ICouponValidationRequest | IPromotion,
  promosOrSubtotal?: IPromotion[] | number,
  items?: any[],
  customerId?: string
): ICouponValidationResponse {
  let promo: IPromotion | undefined;
  let code = '';
  let subtotal = 0;

  if (
    requestOrPromo &&
    'code' in requestOrPromo &&
    typeof (requestOrPromo as any).code === 'string' &&
    Array.isArray(promosOrSubtotal)
  ) {
    // Called as validateCoupon(request, promotions)
    const req = requestOrPromo as ICouponValidationRequest;
    code = (req.code || '').trim().toUpperCase();
    subtotal = req.cartSubtotal || 0;
    promo = promosOrSubtotal.find(p => (p.code || p.couponCode || '').trim().toUpperCase() === code);
  } else {
    // Called as validateCoupon(promo, subtotal, items, customerId)
    promo = requestOrPromo as IPromotion;
    code = (promo.code || promo.couponCode || '').trim().toUpperCase();
    subtotal = typeof promosOrSubtotal === 'number' ? promosOrSubtotal : 0;
  }

  if (!promo) {
    const msg = code ? `Coupon "${code}" is not valid for this restaurant.` : 'Please enter a promo code.';
    return { valid: false, errorMessage: msg, message: msg };
  }

  if (!isPromotionActive(promo)) {
    const st = String(promo.status).toLowerCase();
    if (st === 'paused') {
      const msg = `Coupon "${code}" is currently paused.`;
      return { valid: false, errorMessage: msg, message: msg };
    }
    if (st === 'expired' || (promo.endDate && new Date(promo.endDate).getTime() < Date.now())) {
      const msg = `Coupon "${code}" has expired.`;
      return { valid: false, errorMessage: msg, message: msg };
    }
    if (promo.startDate && new Date(promo.startDate).getTime() > Date.now()) {
      const msg = `Coupon "${code}" is not active yet.`;
      return { valid: false, errorMessage: msg, message: msg };
    }
    if (typeof promo.globalUsageLimit === 'number' && promo.globalUsageLimit > 0 && (promo.redemptionCount || 0) >= promo.globalUsageLimit) {
      const msg = `Coupon "${code}" has reached its maximum global redemptions.`;
      return { valid: false, errorMessage: msg, message: msg };
    }
    const msg = `Coupon "${code}" is not active.`;
    return { valid: false, errorMessage: msg, message: msg };
  }

  // Minimum Order Value check
  if (typeof promo.minOrderValue === 'number' && promo.minOrderValue > 0) {
    if (subtotal < promo.minOrderValue) {
      const msg = `Minimum order of ₹${promo.minOrderValue} required for coupon "${code}". Add ₹${promo.minOrderValue - subtotal} more.`;
      return {
        valid: false,
        promotion: promo,
        errorMessage: msg,
        message: msg
      };
    }
  }

  // Calculate discount amount
  const promoVal = Number(promo.value ?? promo.discountValue ?? 0);
  let discountAmount = 0;
  const pType = String(promo.type).toLowerCase();

  if (pType === 'percentage' || pType === 'coupon' || pType === 'coupon_code') {
    discountAmount = Math.round(subtotal * (promoVal / 100));
  } else if (pType === 'fixed_amount' || pType === 'fixed') {
    discountAmount = Math.min(subtotal, promoVal);
  }

  // Maximum discount cap
  if (typeof promo.maxDiscountAmount === 'number' && promo.maxDiscountAmount > 0) {
    discountAmount = Math.min(discountAmount, promo.maxDiscountAmount);
  }

  const successMsg = `Coupon "${code}" applied successfully!`;
  return {
    valid: true,
    promotion: promo,
    discountAmount,
    errorMessage: undefined,
    message: successMsg
  };
}

/**
 * Calculates complete order financials (subtotal, discounts, taxable base, taxes, fees, and final total).
 */
export function calculateOrderFinancials(params: {
  subtotal: number;
  couponPromotion?: IPromotion | null;
  taxPercent?: number;
  serviceChargePercent?: number;
  tip?: number;
  isDineIn?: boolean;
}): {
  subtotal: number;
  couponDiscount: number;
  taxableSubtotal: number;
  taxAmount: number;
  serviceChargeAmount: number;
  tipAmount: number;
  finalTotal: number;
  savingsTotal: number;
} {
  const subtotal = Math.max(0, params.subtotal || 0);
  let couponDiscount = 0;

  if (params.couponPromotion && isPromotionActive(params.couponPromotion)) {
    const promo = params.couponPromotion;
    const meetsMinOrder = !promo.minOrderValue || subtotal >= promo.minOrderValue;
    if (meetsMinOrder) {
      if (promo.type === 'percentage' || promo.type === 'coupon_code') {
        couponDiscount = Math.round(subtotal * (Number(promo.value) / 100));
      } else if (promo.type === 'fixed_amount') {
        couponDiscount = Math.min(subtotal, Number(promo.value));
      }
      if (promo.maxDiscountAmount && promo.maxDiscountAmount > 0) {
        couponDiscount = Math.min(couponDiscount, promo.maxDiscountAmount);
      }
    }
  }

  const taxableSubtotal = Math.max(0, subtotal - couponDiscount);
  const taxRate = typeof params.taxPercent === 'number' ? params.taxPercent : 5;
  const serviceRate = (params.isDineIn !== false && typeof params.serviceChargePercent === 'number') 
    ? params.serviceChargePercent 
    : (params.isDineIn !== false ? 5 : 0);

  const taxAmount = Math.round(taxableSubtotal * (taxRate / 100));
  const serviceChargeAmount = Math.round(taxableSubtotal * (serviceRate / 100));
  const tipAmount = Math.max(0, params.tip || 0);

  const finalTotal = taxableSubtotal + taxAmount + serviceChargeAmount + tipAmount;

  return {
    subtotal,
    couponDiscount,
    taxableSubtotal,
    taxAmount,
    serviceChargeAmount,
    tipAmount,
    finalTotal,
    savingsTotal: couponDiscount
  };
}

// -------------------------------------------------------------
// Firestore Promotion Service Layer
// -------------------------------------------------------------

export const promotionService = {
  /**
   * Listen to all promotions for a restaurant in real-time.
   */
  subscribeToRestaurantPromotions(
    tenantId: string,
    callback: (promotions: IPromotion[]) => void
  ) {
    if (!tenantId) return () => {};
    const colRef = collection(db, 'restaurants', tenantId, 'promotions');
    return onSnapshot(colRef, (snap) => {
      const list: IPromotion[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          tenantId: data.tenantId || tenantId,
          restaurantId: data.restaurantId || tenantId,
          restaurantName: data.restaurantName || '',
          name: data.name || 'Special Offer',
          description: data.description || '',
          type: data.type || 'percentage',
          value: Number(data.value || 0),
          code: data.code ? String(data.code).toUpperCase() : undefined,
          badgeText: data.badgeText || '',
          imageUrl: data.imageUrl || null,
          applicableItemIds: data.applicableItemIds || [],
          applicableCategoryIds: data.applicableCategoryIds || [],
          applicableBranches: data.applicableBranches || [],
          targetAudience: data.targetAudience || 'all',
          minOrderValue: typeof data.minOrderValue === 'number' ? data.minOrderValue : undefined,
          maxDiscountAmount: typeof data.maxDiscountAmount === 'number' ? data.maxDiscountAmount : undefined,
          startDate: data.startDate || new Date().toISOString(),
          endDate: data.endDate || new Date(Date.now() + 30 * 86400000).toISOString(),
          status: data.status || 'active',
          globalUsageLimit: typeof data.globalUsageLimit === 'number' ? data.globalUsageLimit : undefined,
          perCustomerLimit: typeof data.perCustomerLimit === 'number' ? data.perCustomerLimit : undefined,
          redemptionCount: Number(data.redemptionCount || 0),
          placements: Array.isArray(data.placements) ? data.placements : ['restaurant_menu', 'cart_suggestion'],
          allowStacking: Boolean(data.allowStacking),
          metrics: data.metrics || { impressions: 0, clicks: 0, redemptions: 0, totalDiscountGiven: 0, totalRevenueGenerated: 0 },
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString()
        });
      });
      callback(list);
    }, (err) => {
      console.warn('[promotionService] Promotions subscription warning:', err);
    });
  },

  /**
   * Fetch active promotions for a restaurant.
   */
  async getRestaurantPromotions(tenantId: string): Promise<IPromotion[]> {
    if (!tenantId) return [];
    try {
      const colRef = collection(db, 'restaurants', tenantId, 'promotions');
      const snap = await getDocs(colRef);
      const list: IPromotion[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as IPromotion);
      });
      return list;
    } catch (err) {
      console.warn('[promotionService] Failed to fetch promotions:', err);
      return [];
    }
  },

  /**
   * Create or update a promotion in Firestore.
   */
  async savePromotion(tenantId: string, promo: Partial<IPromotion>): Promise<string> {
    const promoId = promo.id || `promo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const promoRef = doc(db, 'restaurants', tenantId, 'promotions', promoId);

    const payload: Partial<IPromotion> = {
      ...promo,
      id: promoId,
      tenantId,
      restaurantId: tenantId,
      code: promo.code ? promo.code.trim().toUpperCase() : undefined,
      updatedAt: new Date().toISOString()
    };
    if (!promo.createdAt) {
      payload.createdAt = new Date().toISOString();
      payload.redemptionCount = 0;
      payload.metrics = {
        impressions: 0,
        clicks: 0,
        redemptions: 0,
        totalDiscountGiven: 0,
        totalRevenueGenerated: 0
      };
    }

    await setDoc(promoRef, payload, { merge: true });

    // Also mirror into legacy 'coupons' collection if code is specified for seamless legacy order compatibility
    if (payload.code) {
      try {
        const couponRef = doc(db, 'restaurants', tenantId, 'coupons', payload.code);
        await setDoc(couponRef, {
          code: payload.code,
          percentage: payload.type === 'percentage' || payload.type === 'coupon_code' ? payload.value : undefined,
          amount: payload.type === 'fixed_amount' ? payload.value : undefined,
          isActive: payload.status === 'active',
          status: payload.status,
          minOrderValue: payload.minOrderValue,
          maxDiscount: payload.maxDiscountAmount,
          startDate: payload.startDate,
          endDate: payload.endDate,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (legacyErr) {
        console.warn('[promotionService] Legacy coupon mirror notice:', legacyErr);
      }
    }

    return promoId;
  },

  /**
   * Delete or archive a promotion.
   */
  async deletePromotion(tenantId: string, promoId: string, code?: string): Promise<void> {
    const promoRef = doc(db, 'restaurants', tenantId, 'promotions', promoId);
    await deleteDoc(promoRef);
    if (code) {
      try {
        const couponRef = doc(db, 'restaurants', tenantId, 'coupons', code.toUpperCase());
        await deleteDoc(couponRef);
      } catch (_) {}
    }
  },

  /**
   * Toggle promotion status (active <-> paused).
   */
  async toggleStatus(tenantId: string, promoId: string, currentStatus: string, code?: string): Promise<void> {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    const promoRef = doc(db, 'restaurants', tenantId, 'promotions', promoId);
    await updateDoc(promoRef, {
      status: newStatus,
      updatedAt: new Date().toISOString()
    });
    if (code) {
      try {
        const couponRef = doc(db, 'restaurants', tenantId, 'coupons', code.toUpperCase());
        await updateDoc(couponRef, {
          isActive: newStatus === 'active',
          status: newStatus,
          updatedAt: new Date().toISOString()
        });
      } catch (_) {}
    }
  },

  /**
   * Validates a coupon code online directly against Firestore if not already loaded locally.
   */
  async validateCouponOnline(
    tenantId: string, 
    code: string, 
    cartSubtotal: number, 
    items: any[] = [], 
    customerId?: string
  ): Promise<ICouponValidationResponse> {
    try {
      const upperCode = (code || '').trim().toUpperCase();
      if (!upperCode) {
        return { valid: false, message: 'Please enter a coupon code.', errorMessage: 'Please enter a coupon code.' };
      }

      // Check promotions collection first
      const promoQuery = query(
        collection(db, 'restaurants', tenantId, 'promotions'),
        where('code', '==', upperCode)
      );
      let promoSnap = await getDocs(promoQuery);
      if (promoSnap.empty) {
        const altQuery = query(
          collection(db, 'restaurants', tenantId, 'promotions'),
          where('couponCode', '==', upperCode)
        );
        promoSnap = await getDocs(altQuery);
      }

      if (!promoSnap.empty) {
        const docData = promoSnap.docs[0].data();
        const promo = { id: promoSnap.docs[0].id, ...docData } as IPromotion;
        return validateCoupon(promo, cartSubtotal, items, customerId);
      }

      // Check legacy coupons collection
      const couponDocRef = doc(db, 'restaurants', tenantId, 'coupons', upperCode);
      const couponDoc = await getDoc(couponDocRef);
      if (couponDoc.exists()) {
        const cData = couponDoc.data();
        const promo: IPromotion = {
          id: couponDoc.id,
          tenantId,
          restaurantId: tenantId,
          name: cData.title || cData.name || upperCode,
          description: cData.description || '',
          type: (cData.discountType === 'percentage' || cData.type === 'percentage') ? 'percentage' : 'fixed_amount',
          value: Number(cData.discountValue || cData.value || cData.discount || 0),
          code: upperCode,
          couponCode: upperCode,
          minOrderValue: cData.minOrderAmount || cData.minOrderValue,
          maxDiscountAmount: cData.maxDiscountAmount || cData.maxDiscount,
          status: cData.isActive === false ? 'paused' : 'active',
          startDate: cData.validFrom || new Date().toISOString(),
          endDate: cData.validUntil || new Date(Date.now() + 86400000 * 365).toISOString(),
          redemptionCount: Number(cData.redemptionCount || 0),
          placements: ['cart_suggestion'],
          allowStacking: false,
          createdAt: cData.createdAt || new Date().toISOString(),
          updatedAt: cData.updatedAt || new Date().toISOString()
        };
        return validateCoupon(promo, cartSubtotal, items, customerId);
      }

      return { valid: false, message: `Coupon "${upperCode}" not found.`, errorMessage: `Coupon "${upperCode}" not found.` };
    } catch (err: any) {
      console.warn('[promotionService] Online coupon check warning:', err);
      return { valid: false, message: 'Failed to validate coupon online.', errorMessage: 'Failed to validate coupon online.' };
    }
  },

  /**
   * Atomically records a successful redemption of a promotion when an order is confirmed.
   */
  async recordRedemption(
    tenantId: string, 
    promoId: string, 
    arg3?: any, 
    arg4?: any, 
    arg5?: any
  ): Promise<void> {
    try {
      const discountGiven = typeof arg3 === 'number' ? arg3 : (typeof arg5 === 'number' ? arg5 : 0);
      const orderTotal = typeof arg4 === 'number' ? arg4 : 0;
      const promoRef = doc(db, 'restaurants', tenantId, 'promotions', promoId);
      await updateDoc(promoRef, {
        redemptionCount: increment(1),
        'metrics.redemptions': increment(1),
        'metrics.totalDiscountGiven': increment(discountGiven),
        'metrics.totalRevenueGenerated': increment(orderTotal),
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[promotionService] Failed to record redemption:', err);
    }
  }
};
