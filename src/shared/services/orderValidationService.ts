import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  updateDoc,
  increment,
  Firestore
} from 'firebase/firestore';
import { db as defaultDb } from '../firebase/config';
import { IOrder, IOrderItem } from '../domain/orders/types';
import { kotService } from './kotService';
import { IDiningSession, saveActiveDiningSession, syncDiningSessionToFirestore } from '../utils/diningSession';

export interface IOrderItemRequest {
  itemId: string;
  count: number;
  notes?: string;
  variantId?: string;
  addonIds?: string[];
  restaurantId?: string;
  tenantId?: string;
  // Untrusted client inputs - will be strictly overridden by canonical values
  pricePerUnit?: number;
  price?: number;
  name?: string;
  image?: string;
  isVeg?: boolean;
}

export interface IOrderCreationRequest {
  tenantId: string;
  tableNumber: string;
  tableId?: string;
  tableName?: string;
  tableRestaurantId?: string;
  isNewDiningSession?: boolean;
  branchId?: string;
  sessionId?: string;
  primaryOrderId?: string;
  orderSequence?: number;
  isAdditionalOrder?: boolean;
  customerId: string;
  customerName?: string;
  phone?: string;
  orderType?: 'dine_in' | 'takeaway' | 'delivery' | 'walk_in';
  orderSource?: 'qr' | 'app' | 'pos' | 'waiter';
  specialInstructions?: string;
  idempotencyKey?: string;
  couponCode?: string;
  orderId?: string;
  items: IOrderItemRequest[];
  // Untrusted client financial inputs - will be completely ignored and recalculated
  total?: number;
  totalAmount?: number;
  subtotal?: number;
  tax?: number;
  serviceCharge?: number;
  discount?: number;
  tip?: number;
}

export interface IValidatedOrderResult {
  success: boolean;
  orderId: string;
  order: IOrder;
  primaryOrderId: string;
  sessionId: string;
  isDuplicate?: boolean;
  kotTicketId?: string;
}

/**
 * Trusted server-side order validation and pricing calculation service.
 * Enforces authoritative pricing, item availability, table state, session boundary,
 * and idempotency.
 */
export const orderValidationService = {
  /**
   * Authoritatively validates order creation parameters, retrieves canonical menu data,
   * recalculates all prices and taxes, enforces idempotency, and persists the validated order.
   */
  validateAndCreateOrder: async (
    request: IOrderCreationRequest,
    options?: {
      dbInstance?: Firestore;
      actor?: { uid?: string; role?: string };
      skipKotCreation?: boolean;
    }
  ): Promise<IValidatedOrderResult> => {
    const firestoreDb = options?.dbInstance || defaultDb;

    // 1. Caller & Guest Identity Validation
    const customerId = (request.customerId || '').trim();
    if (!customerId) {
      throw new Error('Order creation rejected: A valid customer or guest identity (customerId) is required.');
    }

    // 2. Tenant / Restaurant Validation
    const tenantId = (request.tenantId || '').trim();
    if (!tenantId) {
      throw new Error('Order creation rejected: Valid tenantId is required.');
    }

    const restDocRef = doc(firestoreDb, 'restaurants', tenantId);
    const restDocSnap = await getDoc(restDocRef);
    let restaurantSettings: any = {};
    if (!restDocSnap.exists()) {
      // Check tenants root fallback
      const tenantDocRef = doc(firestoreDb, 'tenants', tenantId);
      const tenantDocSnap = await getDoc(tenantDocRef);
      if (!tenantDocSnap.exists()) {
        throw new Error(`Order creation rejected: Restaurant "${tenantId}" does not exist.`);
      }
      const tenantData = tenantDocSnap.data() || {};
      if (tenantData.status === 'inactive' || tenantData.status === 'suspended') {
        throw new Error(`Order creation rejected: Restaurant "${tenantId}" is currently inactive.`);
      }
      restaurantSettings = tenantData.settings || tenantData;
    } else {
      const restData = restDocSnap.data() || {};
      if (restData.status === 'inactive' || restData.isActive === false) {
        throw new Error(`Order creation rejected: Restaurant "${tenantId}" is currently inactive.`);
      }
      restaurantSettings = restData.settings || restData;
    }

    // 3. Table & Dining Session Relationship Validation
    if (request.tableRestaurantId && request.tableRestaurantId !== tenantId) {
      throw new Error(`Order creation rejected: Table does not belong to restaurant "${tenantId}".`);
    }

    const rawTableNum = String(request.tableNumber || '').trim();
    if (!rawTableNum) {
      throw new Error('Order creation rejected: Table number is required for dine-in orders.');
    }
    const cleanTableNum = rawTableNum.replace(/^TBL-/i, '').trim();
    const resolvedTableId = request.tableId || `TBL-${cleanTableNum}`;

    // Verify table in restaurant tables collection if exists
    try {
      const tableDocRef = doc(firestoreDb, 'restaurants', tenantId, 'tables', resolvedTableId);
      const tableSnap = await getDoc(tableDocRef);
      if (tableSnap.exists()) {
        const tableData = tableSnap.data() || {};
        if (tableData.restaurantId && tableData.restaurantId !== tenantId) {
          throw new Error(`Order creation rejected: Table does not belong to restaurant "${tenantId}".`);
        }
        if (tableData.isActive === false || String(tableData.status).toLowerCase() === 'disabled') {
          throw new Error(`Order creation rejected: Table "${cleanTableNum}" is currently disabled.`);
        }
        if (tableData.status === 'occupied' && request.isNewDiningSession && !request.isAdditionalOrder) {
          throw new Error(`Order creation rejected: Table "${cleanTableNum}" is currently occupied.`);
        }
      }
    } catch (tblErr: any) {
      if (tblErr.message?.includes('rejected')) throw tblErr;
    }

    // 4. Validate Items Array
    if (!request.items || !Array.isArray(request.items) || request.items.length === 0) {
      throw new Error('Order creation rejected: An order must contain at least one valid menu item.');
    }

    // 5. Enforce Idempotency / Safe Retries
    const targetOrderId = (request.orderId || request.idempotencyKey || '').trim() || 
      `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const existingOrderRef = doc(firestoreDb, 'restaurants', tenantId, 'orders', targetOrderId);
    const existingOrderSnap = await getDoc(existingOrderRef);

    if (existingOrderSnap.exists()) {
      const existingData = existingOrderSnap.data() as IOrder;
      // Idempotent return if already placed
      return {
        success: true,
        orderId: targetOrderId,
        order: { ...existingData, id: targetOrderId, orderId: targetOrderId },
        primaryOrderId: (existingData as any).primaryOrderId || targetOrderId,
        sessionId: (existingData as any).sessionId || request.sessionId || '',
        isDuplicate: true
      };
    }

    // 6. Retrieve Canonical Menu Items and Validate Availability & Pricing
    let authoritativeSubtotal = 0;
    const verifiedItems: IOrderItem[] = [];

    for (const itemReq of request.items) {
      if (!itemReq.itemId || typeof itemReq.itemId !== 'string') {
        throw new Error('Order creation rejected: Each item must contain a valid itemId.');
      }

      if (itemReq.tenantId && itemReq.tenantId !== tenantId) {
        throw new Error(`Order creation rejected: Cross-tenant item injection detected. Item "${itemReq.itemId}" belongs to another restaurant.`);
      }
      if (itemReq.restaurantId && itemReq.restaurantId !== tenantId) {
        throw new Error(`Order creation rejected: Cross-tenant item injection detected. Item "${itemReq.itemId}" belongs to another restaurant.`);
      }

      const count = Number(itemReq.count);
      if (!count || !Number.isInteger(count) || count <= 0) {
        throw new Error(`Order creation rejected: Invalid quantity (${itemReq.count}) for item "${itemReq.itemId}". Quantity must be a positive integer.`);
      }
      if (count > 100) {
        throw new Error(`Order creation rejected: Quantity exceeds maximum allowable order limit (100) for item "${itemReq.itemId}".`);
      }

      // Fetch canonical item from restaurants/{tenantId}/menu/default/items/{itemId}
      const itemRef = doc(firestoreDb, 'restaurants', tenantId, 'menu', 'default', 'items', itemReq.itemId);
      const itemSnap = await getDoc(itemRef);

      if (!itemSnap.exists()) {
        throw new Error(`Order creation rejected: Menu item "${itemReq.itemId}" does not exist in the restaurant menu.`);
      }

      const canonicalItem = itemSnap.data() || {};

      if (canonicalItem.tenantId && canonicalItem.tenantId !== tenantId) {
        throw new Error(`Order creation rejected: Cross-tenant item injection detected. Item "${itemReq.itemId}" belongs to another restaurant.`);
      }
      if (canonicalItem.restaurantId && canonicalItem.restaurantId !== tenantId) {
        throw new Error(`Order creation rejected: Cross-tenant item injection detected. Item "${itemReq.itemId}" belongs to another restaurant.`);
      }

      // Availability check
      if (
        canonicalItem.isAvailable === false || 
        canonicalItem.available === false || 
        canonicalItem.availability === false
      ) {
        throw new Error(`Order creation rejected: Menu item "${canonicalItem.name || itemReq.itemId}" is currently sold out.`);
      }

      // Published check
      if (
        canonicalItem.isPublished === false || 
        canonicalItem.published === false || 
        canonicalItem.status === 'unpublished'
      ) {
        throw new Error(`Order creation rejected: Menu item "${canonicalItem.name || itemReq.itemId}" is currently unpublished and cannot be ordered.`);
      }

      // Base canonical price
      let unitPrice = Number(canonicalItem.discountPrice || canonicalItem.price || 0);
      if (unitPrice <= 0) {
        unitPrice = Number(canonicalItem.price || 0);
      }
      if (unitPrice <= 0) {
        throw new Error(`Order creation rejected: Canonical price for "${canonicalItem.name || itemReq.itemId}" is invalid.`);
      }

      // Variant validation if specified
      if (itemReq.variantId) {
        const variantRef = doc(firestoreDb, 'restaurants', tenantId, 'menu', 'default', 'variants', itemReq.variantId);
        const variantSnap = await getDoc(variantRef);
        if (!variantSnap.exists()) {
          throw new Error(`Order creation rejected: Specified variant "${itemReq.variantId}" does not exist.`);
        }
        const variantData = variantSnap.data() || {};
        if (variantData.isAvailable === false || variantData.available === false) {
          throw new Error(`Order creation rejected: Variant "${variantData.name || itemReq.variantId}" is currently sold out.`);
        }
        if (variantData.price && Number(variantData.price) > 0) {
          unitPrice = Number(variantData.price);
        } else if (variantData.priceOffset) {
          unitPrice += Number(variantData.priceOffset);
        }
      }

      // Addons validation if specified
      if (Array.isArray(itemReq.addonIds) && itemReq.addonIds.length > 0) {
        for (const addonId of itemReq.addonIds) {
          const addonRef = doc(firestoreDb, 'restaurants', tenantId, 'menu', 'default', 'addons', addonId);
          const addonSnap = await getDoc(addonRef);
          if (!addonSnap.exists()) {
            throw new Error(`Order creation rejected: Addon "${addonId}" does not exist.`);
          }
          const addonData = addonSnap.data() || {};
          if (addonData.isAvailable === false || addonData.available === false) {
            throw new Error(`Order creation rejected: Addon "${addonData.name || addonId}" is currently unavailable.`);
          }
          const addonPrice = Number(addonData.price || 0);
          if (addonPrice > 0) {
            unitPrice += addonPrice;
          }
        }
      }

      const lineTotal = unitPrice * count;
      authoritativeSubtotal += lineTotal;

      verifiedItems.push({
        itemId: itemReq.itemId,
        name: String(canonicalItem.name || itemReq.itemId),
        count,
        notes: (itemReq.notes || '').slice(0, 200),
        pricePerUnit: unitPrice,
        image: canonicalItem.image || canonicalItem.imageUrl || '',
        isVeg: canonicalItem.isVeg ?? canonicalItem.veg ?? false,
        category: canonicalItem.category || canonicalItem.categoryId || ''
      });
    }

    if (authoritativeSubtotal <= 0) {
      throw new Error('Order creation rejected: Authoritative order subtotal must be greater than 0.');
    }

    // 7. Authoritative Tax, Service Charge, Discount, and Total Calculation
    let authoritativeDiscount = 0;
    let matchedPromotionId: string | null = null;

    if ((request.discount && request.discount > 0) || request.couponCode) {
      if (!request.couponCode) {
        throw new Error('Order creation rejected: Custom discount without a valid coupon code is not allowed.');
      }
      const rawCode = String(request.couponCode).trim().toUpperCase();
      
      // 7a. Look up in canonical promotions collection first
      const promoCol = collection(firestoreDb, 'restaurants', tenantId, 'promotions');
      const qPromo = query(promoCol, where('code', '==', rawCode));
      const promoSnap = await getDocs(qPromo);

      let promoData: any = null;
      if (!promoSnap.empty) {
        promoData = promoSnap.docs[0].data();
        matchedPromotionId = promoSnap.docs[0].id;
      } else {
        // Fallback to legacy coupons collection: restaurants/{tenantId}/coupons/{code}
        const couponRef = doc(firestoreDb, 'restaurants', tenantId, 'coupons', rawCode);
        const couponSnap = await getDoc(couponRef);
        if (couponSnap.exists()) {
          promoData = couponSnap.data() || {};
        }
      }

      if (!promoData) {
        throw new Error(`Order creation rejected: Coupon code "${rawCode}" is invalid or expired.`);
      }

      // Check status and validity dates
      const nowMs = Date.now();
      const isStatusActive = promoData.status === 'active' || promoData.isActive === true;
      if (!isStatusActive) {
        throw new Error(`Order creation rejected: Coupon code "${rawCode}" is currently inactive or paused.`);
      }

      if (promoData.startDate) {
        const startMs = new Date(promoData.startDate).getTime();
        if (!isNaN(startMs) && nowMs < startMs) {
          throw new Error(`Order creation rejected: Coupon code "${rawCode}" is not yet active.`);
        }
      }

      if (promoData.endDate) {
        const endMs = new Date(promoData.endDate).getTime();
        if (!isNaN(endMs) && nowMs > endMs) {
          throw new Error(`Order creation rejected: Coupon code "${rawCode}" has expired.`);
        }
      }

      // Check global usage limit
      if (typeof promoData.globalUsageLimit === 'number' && promoData.globalUsageLimit > 0) {
        if ((promoData.redemptionCount || 0) >= promoData.globalUsageLimit) {
          throw new Error(`Order creation rejected: Coupon code "${rawCode}" has reached its maximum global redemptions.`);
        }
      }

      // Check minimum order value
      const minOrder = Number(promoData.minOrderValue || promoData.minOrder || 0);
      if (minOrder > 0 && authoritativeSubtotal < minOrder) {
        throw new Error(`Order creation rejected: Minimum order subtotal of ₹${minOrder} is required to apply coupon "${rawCode}".`);
      }

      // Calculate authoritative discount
      if (promoData.percentage || (promoData.type === 'percentage' && promoData.value)) {
        const pct = Number(promoData.percentage || promoData.value);
        authoritativeDiscount = Math.round(authoritativeSubtotal * (pct / 100));
      } else if (promoData.amount || (promoData.type === 'fixed_amount' && promoData.value)) {
        authoritativeDiscount = Math.min(authoritativeSubtotal, Number(promoData.amount || promoData.value));
      } else if (promoData.value) {
        authoritativeDiscount = Math.round(authoritativeSubtotal * (Number(promoData.value) / 100));
      }

      // Apply maximum discount cap
      const maxDiscount = Number(promoData.maxDiscountAmount || promoData.maxDiscount || 0);
      if (maxDiscount > 0) {
        authoritativeDiscount = Math.min(authoritativeDiscount, maxDiscount);
      }
    }

    const configuredTaxPercent = restaurantSettings.taxPercent !== undefined 
      ? Number(restaurantSettings.taxPercent) 
      : (restaurantSettings.taxRate !== undefined ? Number(restaurantSettings.taxRate) : 5);
      
    const configuredServiceChargePercent = (request.orderType === 'dine_in' || !request.orderType)
      ? (restaurantSettings.serviceCharge !== undefined 
          ? Number(restaurantSettings.serviceCharge) 
          : (restaurantSettings.serviceChargePercent !== undefined ? Number(restaurantSettings.serviceChargePercent) : 5))
      : 0;

    const taxableBase = Math.max(0, authoritativeSubtotal - authoritativeDiscount);
    const authoritativeTax = Math.round(taxableBase * (configuredTaxPercent / 100));
    const authoritativeServiceCharge = Math.round(taxableBase * (configuredServiceChargePercent / 100));
    const authoritativeTotal = taxableBase + authoritativeTax + authoritativeServiceCharge;

    // 8. Session & Primary Order ID Reconciliation
    const sessionId = (request.sessionId || '').trim() || 
      `SES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const isAdditional = Boolean(request.isAdditionalOrder || (request.orderSequence && request.orderSequence > 1));
    const primaryOrderId = (request.primaryOrderId || '').trim() || targetOrderId;
    const orderSequence = request.orderSequence || (isAdditional ? 2 : 1);

    const nowIso = new Date().toISOString();

    // 9. Construct Authoritative Order Record
    const validatedOrder: IOrder = {
      id: targetOrderId,
      orderId: targetOrderId,
      primaryOrderId,
      sessionId,
      orderSequence,
      isAdditionalOrder: isAdditional,
      customerId,
      customerName: (request.customerName || 'Guest Diner').trim(),
      phone: (request.phone || '+91 98765 43210').trim(),
      tenantId,
      restaurantId: tenantId,
      branchId: request.branchId || 'main',
      tableId: resolvedTableId,
      tableNumber: cleanTableNum,
      tableName: request.tableName || `Table ${cleanTableNum}`,
      orderType: request.orderType || 'dine_in',
      orderSource: request.orderSource || 'qr',
      items: verifiedItems,
      subtotal: authoritativeSubtotal,
      tax: authoritativeTax,
      taxPercent: configuredTaxPercent,
      serviceCharge: authoritativeServiceCharge,
      serviceChargePercent: configuredServiceChargePercent,
      discount: authoritativeDiscount,
      total: authoritativeTotal,
      totalAmount: authoritativeTotal,
      status: 'NEW',
      paymentStatus: 'pending',
      specialInstructions: (request.specialInstructions || '').slice(0, 300),
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 10. Persist Authoritative Order to Firestore
    await setDoc(existingOrderRef, validatedOrder);

    // 10b. Atomically record promotion redemption metric if applied
    if (matchedPromotionId) {
      try {
        const promoRef = doc(firestoreDb, 'restaurants', tenantId, 'promotions', matchedPromotionId);
        await updateDoc(promoRef, {
          redemptionCount: increment(1),
          'metrics.redemptions': increment(1),
          'metrics.totalDiscountGiven': increment(authoritativeDiscount),
          'metrics.totalRevenueGenerated': increment(authoritativeTotal),
          updatedAt: nowIso
        });
      } catch (promoRedeemErr) {
        console.warn('[orderValidationService] Promotion redemption metric update notice:', promoRedeemErr);
      }
    }

    // 11. Create Persistent KOT Record
    let createdKotId = '';
    if (!options?.skipKotCreation) {
      try {
        const kotResult = await kotService.createKotForOrder(tenantId, validatedOrder, {
          source: request.orderSource === 'qr' ? 'customer_qr' : 'customer_app',
          customerName: validatedOrder.customerName,
          round: orderSequence,
          isSupplementary: isAdditional
        });
        createdKotId = kotResult?.id || '';
      } catch (kotErr) {
        console.warn('[orderValidationService] KOT creation warning:', kotErr);
      }
    }

    // 12. Update and Persist Dining Session
    try {
      const diningSession: IDiningSession = {
        sessionId,
        tenantId,
        restaurantId: tenantId,
        branchId: request.branchId || 'main',
        tableId: resolvedTableId,
        tableNumber: cleanTableNum,
        tableName: request.tableName || `Table ${cleanTableNum}`,
        orderSource: request.orderSource === 'qr' ? 'qr' : 'app',
        status: 'active',
        startedAt: nowIso,
        customerId,
        customerName: validatedOrder.customerName,
        primaryOrderId,
        activeOrderIds: [targetOrderId],
        billingStatus: 'pending'
      };

      saveActiveDiningSession(diningSession);
      syncDiningSessionToFirestore(diningSession).catch(() => {});
    } catch (_) {}

    return {
      success: true,
      orderId: targetOrderId,
      order: validatedOrder,
      primaryOrderId,
      sessionId,
      isDuplicate: false,
      kotTicketId: createdKotId
    };
  }
};
export default orderValidationService;
