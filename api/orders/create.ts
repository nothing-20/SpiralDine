import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, ensureServerAuth } from '../_lib/firebaseServer.js';

interface ITokenUser {
  uid: string;
  isAnonymous?: boolean;
}

/**
 * Verify Firebase ID token independently on server side.
 * Supports production Google Identity Toolkit validation and emulator token decoding.
 */
async function verifyAuthToken(token: string): Promise<ITokenUser | null> {
  if (!token) return null;

  // 1. Emulator environment: decode synthetic/emulator JWT payload
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const uid = payload.user_id || payload.sub || payload.uid;
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
          return null;
        }
        if (uid) {
          return {
            uid,
            isAnonymous: payload.firebase?.sign_in_provider === 'anonymous'
          };
        }
      }
    } catch (_) {}
  }

  // 2. Production: Verify via Google Identity Toolkit API
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    console.warn('[api/orders/create] Warning: No Firebase API Key configured for token verification.');
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const uid = payload.user_id || payload.sub || payload.uid;
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        if (uid) return { uid, isAnonymous: payload.firebase?.sign_in_provider === 'anonymous' };
      }
    } catch (_) {}
    return null;
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const user = data.users?.[0];
    if (!user) return null;

    return {
      uid: user.localId,
      isAnonymous: !user.email && !user.phoneNumber
    };
  } catch (err) {
    console.warn('[api/orders/create] Google Identity Toolkit verification warning:', err);
    return null;
  }
}

/**
 * Serverless API endpoint: POST /api/orders/create
 * Provides trusted server-side order validation, canonical pricing recalculation,
 * and persistence.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST is permitted.' });
  }

  const { tenantId, tableNumber, items, customerId } = req.body || {};

  // 1. Structural argument validation
  if (!tenantId || !tableNumber || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Missing required order fields: tenantId, tableNumber, and a non-empty items array are required.'
    });
  }

  // 2. Authentication & Authorization Verification
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Missing Authorization header or Bearer token.'
    });
  }

  const tokenUser = await verifyAuthToken(token);
  if (!tokenUser || !tokenUser.uid) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired Firebase authentication token.'
    });
  }

  // Verify caller UID matches claimed customerId
  if (customerId && customerId !== tokenUser.uid) {
    return res.status(403).json({
      error: `Forbidden: Authenticated UID (${tokenUser.uid}) does not match requested customerId (${customerId}).`
    });
  }

  const verifiedUid = tokenUser.uid;

  try {
    await ensureServerAuth();

    // 3. Restaurant & Settings Validation
    const restDocRef = doc(db, 'restaurants', tenantId);
    const restDocSnap = await getDoc(restDocRef);
    let restaurantSettings: any = {};

    if (!restDocSnap.exists()) {
      const tenantDocRef = doc(db, 'tenants', tenantId);
      const tenantDocSnap = await getDoc(tenantDocRef);
      if (!tenantDocSnap.exists()) {
        return res.status(400).json({ error: `Order creation rejected: Restaurant "${tenantId}" does not exist.` });
      }
      const tenantData = tenantDocSnap.data() || {};
      if (tenantData.status === 'inactive' || tenantData.status === 'suspended') {
        return res.status(400).json({ error: `Order creation rejected: Restaurant "${tenantId}" is currently inactive.` });
      }
      restaurantSettings = tenantData.settings || tenantData;
    } else {
      const restData = restDocSnap.data() || {};
      if (restData.status === 'inactive' || restData.isActive === false) {
        return res.status(400).json({ error: `Order creation rejected: Restaurant "${tenantId}" is currently inactive.` });
      }
      restaurantSettings = restData.settings || restData;
    }

    // 4. Table Ownership & Status Validation
    if (req.body.tableRestaurantId && req.body.tableRestaurantId !== tenantId) {
      return res.status(400).json({ error: `Order creation rejected: Table does not belong to restaurant "${tenantId}".` });
    }

    const rawTableNum = String(tableNumber || '').trim();
    const cleanTableNum = rawTableNum.replace(/^TBL-/i, '').trim();
    const resolvedTableId = req.body.tableId || `TBL-${cleanTableNum}`;

    try {
      const tableDocRef = doc(db, 'restaurants', tenantId, 'tables', resolvedTableId);
      const tableSnap = await getDoc(tableDocRef);
      if (tableSnap.exists()) {
        const tableData = tableSnap.data() || {};
        if (tableData.restaurantId && tableData.restaurantId !== tenantId) {
          return res.status(400).json({ error: `Order creation rejected: Table does not belong to restaurant "${tenantId}".` });
        }
        if (tableData.isActive === false || String(tableData.status).toLowerCase() === 'disabled') {
          return res.status(400).json({ error: `Order creation rejected: Table "${cleanTableNum}" is currently disabled.` });
        }
      }
    } catch (tblErr: any) {
      if (tblErr.message?.includes('rejected')) throw tblErr;
    }

    // 5. Idempotency Check
    const targetOrderId = (req.body.orderId || req.body.idempotencyKey || '').trim() ||
      `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const existingOrderRef = doc(db, 'restaurants', tenantId, 'orders', targetOrderId);
    const existingOrderSnap = await getDoc(existingOrderRef);

    if (existingOrderSnap.exists()) {
      const existingData = existingOrderSnap.data();
      return res.status(200).json({
        success: true,
        orderId: targetOrderId,
        order: { ...existingData, id: targetOrderId, orderId: targetOrderId },
        primaryOrderId: (existingData as any)?.primaryOrderId || targetOrderId,
        sessionId: (existingData as any)?.sessionId || req.body.sessionId || '',
        isDuplicate: true
      });
    }

    // 6. Retrieve Canonical Menu Items & Recalculate Subtotal
    let authoritativeSubtotal = 0;
    const verifiedItems: any[] = [];

    for (const itemReq of items) {
      if (!itemReq.itemId || typeof itemReq.itemId !== 'string') {
        return res.status(400).json({ error: 'Order creation rejected: Each item must contain a valid itemId.' });
      }

      if (itemReq.tenantId && itemReq.tenantId !== tenantId) {
        return res.status(400).json({ error: `Order creation rejected: Cross-tenant item injection detected. Item "${itemReq.itemId}" belongs to another restaurant.` });
      }

      const count = Number(itemReq.count);
      if (!count || !Number.isInteger(count) || count <= 0) {
        return res.status(400).json({ error: `Order creation rejected: Invalid quantity (${itemReq.count}) for item "${itemReq.itemId}". Quantity must be a positive integer.` });
      }
      if (count > 100) {
        return res.status(400).json({ error: `Order creation rejected: Quantity exceeds maximum allowable order limit (100) for item "${itemReq.itemId}".` });
      }

      const itemRef = doc(db, 'restaurants', tenantId, 'menu', 'default', 'items', itemReq.itemId);
      const itemSnap = await getDoc(itemRef);

      if (!itemSnap.exists()) {
        return res.status(400).json({ error: `Order creation rejected: Menu item "${itemReq.itemId}" does not exist in the restaurant menu.` });
      }

      const canonicalItem = itemSnap.data() || {};

      if (canonicalItem.tenantId && canonicalItem.tenantId !== tenantId) {
        return res.status(400).json({ error: `Order creation rejected: Cross-tenant item injection detected. Item "${itemReq.itemId}" belongs to another restaurant.` });
      }

      if (canonicalItem.isAvailable === false || canonicalItem.available === false || canonicalItem.availability === false) {
        return res.status(400).json({ error: `Order creation rejected: Menu item "${canonicalItem.name || itemReq.itemId}" is currently sold out.` });
      }

      if (canonicalItem.isPublished === false || canonicalItem.published === false || canonicalItem.status === 'unpublished') {
        return res.status(400).json({ error: `Order creation rejected: Menu item "${canonicalItem.name || itemReq.itemId}" is currently unpublished and cannot be ordered.` });
      }

      let unitPrice = Number(canonicalItem.discountPrice || canonicalItem.price || 0);
      if (unitPrice <= 0) {
        unitPrice = Number(canonicalItem.price || 0);
      }
      if (unitPrice <= 0) {
        return res.status(400).json({ error: `Order creation rejected: Canonical price for "${canonicalItem.name || itemReq.itemId}" is invalid.` });
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
      return res.status(400).json({ error: 'Order creation rejected: Authoritative order subtotal must be greater than 0.' });
    }

    // 7. Authoritative Tax, Service Charge, and Total
    let authoritativeDiscount = 0;
    let matchedPromotionId: string | null = null;

    if ((req.body.discount && req.body.discount > 0) || req.body.couponCode) {
      if (!req.body.couponCode) {
        return res.status(400).json({ error: 'Order creation rejected: Custom discount without a valid coupon code is not allowed.' });
      }
      const rawCode = String(req.body.couponCode).trim().toUpperCase();

      // Look up in canonical promotions collection first
      const promoCol = collection(db, 'restaurants', tenantId, 'promotions');
      const qPromo = query(promoCol, where('code', '==', rawCode));
      let promoSnap = await getDocs(qPromo);

      let promoData: any = null;
      if (!promoSnap.empty) {
        promoData = promoSnap.docs[0].data();
        matchedPromotionId = promoSnap.docs[0].id;
      } else {
        const qPromoAlt = query(promoCol, where('couponCode', '==', rawCode));
        const promoSnapAlt = await getDocs(qPromoAlt);
        if (!promoSnapAlt.empty) {
          promoData = promoSnapAlt.docs[0].data();
          matchedPromotionId = promoSnapAlt.docs[0].id;
        } else {
          const couponRef = doc(db, 'restaurants', tenantId, 'coupons', rawCode);
          const couponSnap = await getDoc(couponRef);
          if (couponSnap.exists()) {
            promoData = couponSnap.data() || {};
          }
        }
      }

      if (!promoData) {
        return res.status(400).json({ error: `Order creation rejected: Coupon code "${rawCode}" is invalid or expired.` });
      }

      const nowMs = Date.now();
      const isStatusActive = promoData.status === 'active' || promoData.isActive === true;
      if (!isStatusActive) {
        return res.status(400).json({ error: `Order creation rejected: Coupon code "${rawCode}" is currently inactive or paused.` });
      }

      if (promoData.startDate) {
        const startMs = new Date(promoData.startDate).getTime();
        if (!isNaN(startMs) && nowMs < startMs) {
          return res.status(400).json({ error: `Order creation rejected: Coupon code "${rawCode}" is not yet active.` });
        }
      }

      if (promoData.endDate) {
        const endMs = new Date(promoData.endDate).getTime();
        if (!isNaN(endMs) && nowMs > endMs) {
          return res.status(400).json({ error: `Order creation rejected: Coupon code "${rawCode}" has expired.` });
        }
      }

      if (typeof promoData.globalUsageLimit === 'number' && promoData.globalUsageLimit > 0) {
        if ((promoData.redemptionCount || 0) >= promoData.globalUsageLimit) {
          return res.status(400).json({ error: `Order creation rejected: Coupon code "${rawCode}" has reached its maximum global redemptions.` });
        }
      }

      const minOrder = Number(promoData.minOrderSubtotal || promoData.minOrderValue || promoData.minOrder || 0);
      if (minOrder > 0 && authoritativeSubtotal < minOrder) {
        return res.status(400).json({ error: `Order creation rejected: Minimum order subtotal of ₹${minOrder} is required for coupon "${rawCode}".` });
      }

      // Calculate authoritative discount scoped to eligible items if specified
      let eligibleSubtotal = authoritativeSubtotal;
      const hasItemScope = Array.isArray(promoData.applicableItemIds) && promoData.applicableItemIds.length > 0;
      const hasCategoryScope = Array.isArray(promoData.applicableCategoryIds) && promoData.applicableCategoryIds.length > 0;

      if (hasItemScope || hasCategoryScope) {
        eligibleSubtotal = verifiedItems.reduce((acc, item) => {
          const itemMatch = hasItemScope && promoData.applicableItemIds.includes(item.itemId);
          const catMatch = hasCategoryScope && (
            (item.category && promoData.applicableCategoryIds.includes(item.category)) ||
            (item.categoryId && promoData.applicableCategoryIds.includes(item.categoryId))
          );
          if (itemMatch || catMatch) {
            return acc + (item.pricePerUnit * item.count);
          }
          return acc;
        }, 0);

        if (eligibleSubtotal <= 0) {
          return res.status(400).json({ error: `Order creation rejected: Coupon code "${rawCode}" is only applicable to selected items or categories.` });
        }
      }

      const isPercent = promoData.discountType === 'percentage' || promoData.type === 'percentage' || Boolean(promoData.percentage);
      const discountVal = Number(promoData.discountValue || promoData.value || promoData.percentage || promoData.amount || 0);

      if (isPercent) {
        authoritativeDiscount = Math.round(eligibleSubtotal * (discountVal / 100));
      } else {
        authoritativeDiscount = Math.min(eligibleSubtotal, discountVal);
      }

      const maxDiscount = Number(promoData.maxDiscountAmount || promoData.maxDiscount || 0);
      if (maxDiscount > 0) {
        authoritativeDiscount = Math.min(authoritativeDiscount, maxDiscount);
      }
    }

    const configuredTaxPercent = restaurantSettings.taxPercent !== undefined 
      ? Number(restaurantSettings.taxPercent) 
      : (restaurantSettings.taxRate !== undefined ? Number(restaurantSettings.taxRate) : 5);
      
    const configuredServiceChargePercent = (req.body.orderType === 'dine_in' || !req.body.orderType)
      ? (restaurantSettings.serviceCharge !== undefined 
          ? Number(restaurantSettings.serviceCharge) 
          : (restaurantSettings.serviceChargePercent !== undefined ? Number(restaurantSettings.serviceChargePercent) : 5))
      : 0;

    const taxableBase = Math.max(0, authoritativeSubtotal - authoritativeDiscount);
    const authoritativeTax = Math.round(taxableBase * (configuredTaxPercent / 100));
    const authoritativeServiceCharge = Math.round(taxableBase * (configuredServiceChargePercent / 100));
    const authoritativeTotal = taxableBase + authoritativeTax + authoritativeServiceCharge;

    const sessionId = (req.body.sessionId || '').trim() || 
      `SES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const isAdditional = Boolean(req.body.isAdditionalOrder || (req.body.orderSequence && req.body.orderSequence > 1));
    const primaryOrderId = (req.body.primaryOrderId || '').trim() || targetOrderId;
    const orderSequence = req.body.orderSequence || (isAdditional ? 2 : 1);
    const nowIso = new Date().toISOString();

    const validatedOrder = {
      id: targetOrderId,
      orderId: targetOrderId,
      primaryOrderId,
      sessionId,
      orderSequence,
      isAdditionalOrder: isAdditional,
      customerId: verifiedUid,
      customerName: (req.body.customerName || 'Guest Diner').trim(),
      phone: (req.body.phone || '+91 98765 43210').trim(),
      tenantId,
      restaurantId: tenantId,
      branchId: req.body.branchId || 'main',
      tableId: resolvedTableId,
      tableNumber: cleanTableNum,
      tableName: req.body.tableName || `Table ${cleanTableNum}`,
      orderType: req.body.orderType || 'dine_in',
      orderSource: req.body.orderSource || 'qr',
      items: verifiedItems,
      subtotal: authoritativeSubtotal,
      tax: authoritativeTax,
      taxPercent: configuredTaxPercent,
      serviceCharge: authoritativeServiceCharge,
      serviceChargePercent: configuredServiceChargePercent,
      discount: authoritativeDiscount,
      discountLabel: req.body.couponCode ? `Coupon ${String(req.body.couponCode).trim().toUpperCase()}` : undefined,
      couponCode: req.body.couponCode ? String(req.body.couponCode).trim().toUpperCase() : undefined,
      appliedPromotionId: matchedPromotionId || undefined,
      total: authoritativeTotal,
      totalAmount: authoritativeTotal,
      status: 'NEW',
      paymentStatus: 'pending',
      specialInstructions: (req.body.specialInstructions || '').slice(0, 300),
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 8. Persist Order to Firestore
    await setDoc(existingOrderRef, validatedOrder);

    // 8b. Record promotion redemption metric
    if (matchedPromotionId) {
      try {
        const promoRef = doc(db, 'restaurants', tenantId, 'promotions', matchedPromotionId);
        const promoDoc = await getDoc(promoRef);
        if (promoDoc.exists()) {
          const pData = promoDoc.data() || {};
          const currentCount = Number(pData.redemptionCount || 0);
          await updateDoc(promoRef, {
            redemptionCount: currentCount + 1,
            'metrics.redemptions': (pData.metrics?.redemptions || 0) + 1,
            'metrics.totalDiscountGiven': (pData.metrics?.totalDiscountGiven || 0) + authoritativeDiscount,
            'metrics.totalRevenueGenerated': (pData.metrics?.totalRevenueGenerated || 0) + authoritativeTotal,
            updatedAt: nowIso
          });
        }
      } catch (promoRedeemErr) {
        console.warn('[api/orders/create] Promotion redemption metric update notice:', promoRedeemErr);
      }
    }

    // 9. Persist KOT Ticket
    const kotRef = doc(db, 'restaurants', tenantId, 'kitchenTickets', `KOT-${targetOrderId}`);
    await setDoc(kotRef, {
      id: `KOT-${targetOrderId}`,
      orderId: targetOrderId,
      tenantId,
      tableNumber: cleanTableNum,
      round: orderSequence,
      status: 'NEW',
      items: verifiedItems,
      customerName: validatedOrder.customerName,
      createdAt: nowIso,
      updatedAt: nowIso
    }).catch(err => console.warn('[api/orders/create] KOT write warning:', err));

    return res.status(200).json({
      success: true,
      orderId: targetOrderId,
      order: validatedOrder,
      primaryOrderId,
      sessionId,
      isDuplicate: false,
      kotTicketId: `KOT-${targetOrderId}`
    });
  } catch (err: any) {
    console.error('[API /api/orders/create] Validation failed:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Order validation failed.'
    });
  }
}
