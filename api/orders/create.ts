import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  adminDb,
  FieldValue,
  FirebaseAdminInitError,
} from '../_lib/firebaseAdmin.js';
import {
  handleAuthError,
  requireAuthenticatedUser,
  VerifiedAuthContext,
} from '../_lib/authMiddleware.js';
import {
  calculateMembershipDiscount,
  resolveEligibleSpecialBenefit,
} from '../_lib/specialBenefitsService.js';
import type { ISpecialBenefit } from '../../src/shared/domain/specialBenefits/types.js';

interface OrderItemInput {
  itemId?: unknown;
  tenantId?: unknown;
  count?: unknown;
  notes?: unknown;
}

interface VerifiedOrderItem {
  itemId: string;
  name: string;
  count: number;
  notes: string;
  pricePerUnit: number;
  image: string;
  isVeg: boolean;
  category: string;
  categoryId?: string;
}

interface OrderCreateBody {
  tenantId?: unknown;
  tableNumber?: unknown;
  items?: unknown;
  customerId?: unknown;
  tableRestaurantId?: unknown;
  tableId?: unknown;
  orderId?: unknown;
  idempotencyKey?: unknown;
  sessionId?: unknown;
  discount?: unknown;
  couponCode?: unknown;
  orderType?: unknown;
  isAdditionalOrder?: unknown;
  orderSequence?: unknown;
  primaryOrderId?: unknown;
  customerName?: unknown;
  phone?: unknown;
  branchId?: unknown;
  tableName?: unknown;
  orderSource?: unknown;
  specialInstructions?: unknown;
}

/**
 * Serverless API endpoint: POST /api/orders/create
 * Provides trusted server-side Firebase Admin ID token verification,
 * canonical pricing recalculation, and persistence via Admin SDK.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST is permitted.' });
  }

  const body = (req.body || {}) as OrderCreateBody;
  const { tenantId, tableNumber, items, customerId } = body;

  // 1. Structural argument validation
  if (
    typeof tenantId !== 'string' ||
    !tenantId.trim() ||
    !tableNumber ||
    !items ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({
      error:
        'Missing required order fields: tenantId, tableNumber, and a non-empty items array are required.',
    });
  }

  const cleanTenantId = tenantId.trim();

  // 2. Cryptographic Authentication & Authorization Verification
  // Guest QR diners authenticate via Firebase Anonymous Auth; allowAnonymous=true is intentional.
  let authUser: VerifiedAuthContext;
  try {
    authUser = await requireAuthenticatedUser(req, { allowAnonymous: true });
  } catch (authErr: unknown) {
    return handleAuthError(res, authErr);
  }

  if (typeof customerId === 'string' && customerId.trim() && customerId.trim() !== authUser.uid) {
    return res.status(403).json({
      error: `Forbidden: Authenticated UID (${authUser.uid}) does not match requested customerId (${customerId}).`,
    });
  }

  const verifiedUid = authUser.uid;

  try {
    // 3. Restaurant & Settings Validation
    const restDocRef = adminDb.collection('restaurants').doc(cleanTenantId);
    const restDocSnap = await restDocRef.get();
    let restaurantSettings: Record<string, unknown> = {};

    if (!restDocSnap.exists) {
      const tenantDocRef = adminDb.collection('tenants').doc(cleanTenantId);
      const tenantDocSnap = await tenantDocRef.get();
      if (!tenantDocSnap.exists) {
        return res
          .status(400)
          .json({ error: `Order creation rejected: Restaurant "${cleanTenantId}" does not exist.` });
      }
      const tenantData = (tenantDocSnap.data() as Record<string, unknown>) || {};
      if (tenantData.status === 'inactive' || tenantData.status === 'suspended') {
        return res.status(400).json({
          error: `Order creation rejected: Restaurant "${cleanTenantId}" is currently inactive.`,
        });
      }
      restaurantSettings =
        (tenantData.settings as Record<string, unknown> | undefined) || tenantData;
    } else {
      const restData = (restDocSnap.data() as Record<string, unknown>) || {};
      if (restData.status === 'inactive' || restData.isActive === false) {
        return res.status(400).json({
          error: `Order creation rejected: Restaurant "${cleanTenantId}" is currently inactive.`,
        });
      }
      restaurantSettings = (restData.settings as Record<string, unknown> | undefined) || restData;
    }

    // 4. Table Ownership & Status Validation
    if (
      typeof body.tableRestaurantId === 'string' &&
      body.tableRestaurantId &&
      body.tableRestaurantId !== cleanTenantId
    ) {
      return res.status(400).json({
        error: `Order creation rejected: Table does not belong to restaurant "${cleanTenantId}".`,
      });
    }

    const rawTableNum = String(tableNumber || '').trim();
    const cleanTableNum = rawTableNum.replace(/^TBL-/i, '').trim();
    const resolvedTableId =
      typeof body.tableId === 'string' && body.tableId.trim()
        ? body.tableId.trim()
        : `TBL-${cleanTableNum}`;

    const tableDocRef = adminDb
      .collection('restaurants')
      .doc(cleanTenantId)
      .collection('tables')
      .doc(resolvedTableId);
    const tableSnap = await tableDocRef.get();
    if (tableSnap.exists) {
      const tableData = (tableSnap.data() as Record<string, unknown>) || {};
      if (tableData.restaurantId && tableData.restaurantId !== cleanTenantId) {
        return res.status(400).json({
          error: `Order creation rejected: Table does not belong to restaurant "${cleanTenantId}".`,
        });
      }
      if (tableData.isActive === false || String(tableData.status).toLowerCase() === 'disabled') {
        return res.status(400).json({
          error: `Order creation rejected: Table "${cleanTableNum}" is currently disabled.`,
        });
      }
    }

    // 5. Idempotency Check
    const rawOrderId =
      (typeof body.orderId === 'string' ? body.orderId.trim() : '') ||
      (typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '');
    const targetOrderId =
      rawOrderId ||
      `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

    const existingOrderRef = adminDb
      .collection('restaurants')
      .doc(cleanTenantId)
      .collection('orders')
      .doc(targetOrderId);
    const existingOrderSnap = await existingOrderRef.get();

    if (existingOrderSnap.exists) {
      const existingData = (existingOrderSnap.data() as Record<string, unknown>) || {};
      return res.status(200).json({
        success: true,
        orderId: targetOrderId,
        order: { ...existingData, id: targetOrderId, orderId: targetOrderId },
        primaryOrderId:
          (typeof existingData.primaryOrderId === 'string' && existingData.primaryOrderId) ||
          targetOrderId,
        sessionId:
          (typeof existingData.sessionId === 'string' && existingData.sessionId) ||
          (typeof body.sessionId === 'string' ? body.sessionId : ''),
        isDuplicate: true,
      });
    }

    // 6. Retrieve Canonical Menu Items & Recalculate Subtotal
    let authoritativeSubtotal = 0;
    const verifiedItems: VerifiedOrderItem[] = [];

    for (const rawItem of items) {
      const itemReq = (rawItem || {}) as OrderItemInput;
      if (typeof itemReq.itemId !== 'string' || !itemReq.itemId.trim()) {
        return res
          .status(400)
          .json({ error: 'Order creation rejected: Each item must contain a valid itemId.' });
      }
      const itemId = itemReq.itemId.trim();

      if (typeof itemReq.tenantId === 'string' && itemReq.tenantId && itemReq.tenantId !== cleanTenantId) {
        return res.status(400).json({
          error: `Order creation rejected: Cross-tenant item injection detected. Item "${itemId}" belongs to another restaurant.`,
        });
      }

      const count = Number(itemReq.count);
      if (!count || !Number.isInteger(count) || count <= 0) {
        return res.status(400).json({
          error: `Order creation rejected: Invalid quantity (${String(
            itemReq.count
          )}) for item "${itemId}". Quantity must be a positive integer.`,
        });
      }
      if (count > 100) {
        return res.status(400).json({
          error: `Order creation rejected: Quantity exceeds maximum allowable order limit (100) for item "${itemId}".`,
        });
      }

      const itemRef = adminDb
        .collection('restaurants')
        .doc(cleanTenantId)
        .collection('menu')
        .doc('default')
        .collection('items')
        .doc(itemId);
      const itemSnap = await itemRef.get();

      if (!itemSnap.exists) {
        return res.status(400).json({
          error: `Order creation rejected: Menu item "${itemId}" does not exist in the restaurant menu.`,
        });
      }

      const canonicalItem = (itemSnap.data() as Record<string, unknown>) || {};
      const itemName = String(canonicalItem.name || itemId);

      if (canonicalItem.tenantId && canonicalItem.tenantId !== cleanTenantId) {
        return res.status(400).json({
          error: `Order creation rejected: Cross-tenant item injection detected. Item "${itemId}" belongs to another restaurant.`,
        });
      }

      if (
        canonicalItem.isAvailable === false ||
        canonicalItem.available === false ||
        canonicalItem.availability === false
      ) {
        return res.status(400).json({
          error: `Order creation rejected: Menu item "${itemName}" is currently sold out.`,
        });
      }

      if (
        canonicalItem.isPublished === false ||
        canonicalItem.published === false ||
        canonicalItem.status === 'unpublished'
      ) {
        return res.status(400).json({
          error: `Order creation rejected: Menu item "${itemName}" is currently unpublished and cannot be ordered.`,
        });
      }

      let unitPrice = Number(canonicalItem.discountPrice || canonicalItem.price || 0);
      if (unitPrice <= 0) {
        unitPrice = Number(canonicalItem.price || 0);
      }
      if (unitPrice <= 0) {
        return res.status(400).json({
          error: `Order creation rejected: Canonical price for "${itemName}" is invalid.`,
        });
      }

      const lineTotal = unitPrice * count;
      authoritativeSubtotal += lineTotal;

      verifiedItems.push({
        itemId,
        name: itemName,
        count,
        notes: typeof itemReq.notes === 'string' ? itemReq.notes.slice(0, 200) : '',
        pricePerUnit: unitPrice,
        image: String(canonicalItem.image || canonicalItem.imageUrl || ''),
        isVeg: Boolean(canonicalItem.isVeg ?? canonicalItem.veg ?? false),
        category: String(canonicalItem.category || canonicalItem.categoryId || ''),
        categoryId:
          typeof canonicalItem.categoryId === 'string' ? canonicalItem.categoryId : undefined,
      });
    }

    if (authoritativeSubtotal <= 0) {
      return res.status(400).json({
        error: 'Order creation rejected: Authoritative order subtotal must be greater than 0.',
      });
    }

    // 7. Authoritative Special Benefits & Automatic Discount Evaluation
    let appliedSpecialBenefit: ISpecialBenefit | null = null;
    let specialBenefitDiscount = 0;
    let specialBenefitCalc: ReturnType<typeof calculateMembershipDiscount> | null = null;

    if (!authUser.isAnonymous) {
      try {
        const phone =
          typeof authUser.decodedToken.phone_number === 'string'
            ? authUser.decodedToken.phone_number
            : null;
        const email = authUser.emailVerified && authUser.email ? authUser.email : null;

        appliedSpecialBenefit = await resolveEligibleSpecialBenefit({
          uid: verifiedUid,
          phone,
          email,
          emailVerified: authUser.emailVerified,
          tenantId: cleanTenantId,
        });

        if (appliedSpecialBenefit) {
          specialBenefitCalc = calculateMembershipDiscount(
            authoritativeSubtotal,
            appliedSpecialBenefit
          );
          specialBenefitDiscount = specialBenefitCalc.discountAmount;
        }
      } catch (sbErr) {
        console.warn('[api/orders/create] Special benefits resolution notice:', sbErr);
      }
    }

    // 7b. Restaurant Coupon Evaluation (Non-stacking)
    let couponDiscount = 0;
    let matchedPromotionId: string | null = null;
    const rawDiscount = Number(body.discount || 0);
    const hasCouponCode = typeof body.couponCode === 'string' && body.couponCode.trim().length > 0;

    if (rawDiscount > 0 || hasCouponCode) {
      if (!hasCouponCode) {
        return res.status(400).json({
          error: 'Order creation rejected: Custom discount without a valid coupon code is not allowed.',
        });
      }
      const rawCode = String(body.couponCode).trim().toUpperCase();

      const promoCol = adminDb
        .collection('restaurants')
        .doc(cleanTenantId)
        .collection('promotions');
      const promoSnap = await promoCol.where('code', '==', rawCode).get();

      let promoData: Record<string, unknown> | null = null;
      if (!promoSnap.empty) {
        promoData = promoSnap.docs[0].data() as Record<string, unknown>;
        matchedPromotionId = promoSnap.docs[0].id;
      } else {
        const promoSnapAlt = await promoCol.where('couponCode', '==', rawCode).get();
        if (!promoSnapAlt.empty) {
          promoData = promoSnapAlt.docs[0].data() as Record<string, unknown>;
          matchedPromotionId = promoSnapAlt.docs[0].id;
        } else {
          const couponRef = adminDb
            .collection('restaurants')
            .doc(cleanTenantId)
            .collection('coupons')
            .doc(rawCode);
          const couponSnap = await couponRef.get();
          if (couponSnap.exists) {
            promoData = (couponSnap.data() as Record<string, unknown>) || {};
          }
        }
      }

      if (!promoData) {
        return res.status(400).json({
          error: `Order creation rejected: Coupon code "${rawCode}" is invalid or expired.`,
        });
      }

      const nowMs = Date.now();
      const isStatusActive = promoData.status === 'active' || promoData.isActive === true;
      if (!isStatusActive) {
        return res.status(400).json({
          error: `Order creation rejected: Coupon code "${rawCode}" is currently inactive or paused.`,
        });
      }

      if (promoData.startDate) {
        const startMs = new Date(String(promoData.startDate)).getTime();
        if (!Number.isNaN(startMs) && nowMs < startMs) {
          return res.status(400).json({
            error: `Order creation rejected: Coupon code "${rawCode}" is not yet active.`,
          });
        }
      }

      if (promoData.endDate) {
        const endMs = new Date(String(promoData.endDate)).getTime();
        if (!Number.isNaN(endMs) && nowMs > endMs) {
          return res.status(400).json({
            error: `Order creation rejected: Coupon code "${rawCode}" has expired.`,
          });
        }
      }

      if (typeof promoData.globalUsageLimit === 'number' && promoData.globalUsageLimit > 0) {
        if (Number(promoData.redemptionCount || 0) >= promoData.globalUsageLimit) {
          return res.status(400).json({
            error: `Order creation rejected: Coupon code "${rawCode}" has reached its maximum global redemptions.`,
          });
        }
      }

      const minOrder = Number(
        promoData.minOrderSubtotal || promoData.minOrderValue || promoData.minOrder || 0
      );
      if (minOrder > 0 && authoritativeSubtotal < minOrder) {
        return res.status(400).json({
          error: `Order creation rejected: Minimum order subtotal of ₹${minOrder} is required for coupon "${rawCode}".`,
        });
      }

      let eligibleSubtotal = authoritativeSubtotal;
      const applicableItemIds = Array.isArray(promoData.applicableItemIds)
        ? (promoData.applicableItemIds as string[])
        : [];
      const applicableCategoryIds = Array.isArray(promoData.applicableCategoryIds)
        ? (promoData.applicableCategoryIds as string[])
        : [];

      const hasItemScope = applicableItemIds.length > 0;
      const hasCategoryScope = applicableCategoryIds.length > 0;

      if (hasItemScope || hasCategoryScope) {
        eligibleSubtotal = verifiedItems.reduce((acc, item) => {
          const itemMatch = hasItemScope && applicableItemIds.includes(item.itemId);
          const catMatch =
            hasCategoryScope &&
            ((item.category && applicableCategoryIds.includes(item.category)) ||
              (item.categoryId && applicableCategoryIds.includes(item.categoryId)));
          if (itemMatch || catMatch) {
            return acc + item.pricePerUnit * item.count;
          }
          return acc;
        }, 0);

        if (eligibleSubtotal <= 0) {
          return res.status(400).json({
            error: `Order creation rejected: Coupon code "${rawCode}" is only applicable to selected items or categories.`,
          });
        }
      }

      const isPercent =
        promoData.discountType === 'percentage' ||
        promoData.type === 'percentage' ||
        Boolean(promoData.percentage);
      const discountVal = Number(
        promoData.discountValue || promoData.value || promoData.percentage || promoData.amount || 0
      );

      if (isPercent) {
        couponDiscount = Math.round(eligibleSubtotal * (discountVal / 100));
      } else {
        couponDiscount = Math.min(eligibleSubtotal, discountVal);
      }

      const maxDiscount = Number(promoData.maxDiscountAmount || promoData.maxDiscount || 0);
      if (maxDiscount > 0) {
        couponDiscount = Math.min(couponDiscount, maxDiscount);
      }
    }

    // Determine final authoritative discount (Non-stacking: membership benefit takes precedence unless coupon provides higher value)
    let authoritativeDiscount = 0;
    let resolvedDiscountLabel: string | undefined = undefined;
    let resolvedDiscountType: 'percentage' | 'fixed' | 'coupon' | undefined = undefined;
    let resolvedDiscountPercent: number | undefined = undefined;

    if (specialBenefitDiscount > 0 && specialBenefitDiscount >= couponDiscount) {
      authoritativeDiscount = specialBenefitDiscount;
      resolvedDiscountLabel = 'Special member discount applied';
      resolvedDiscountType = 'percentage';
      resolvedDiscountPercent = appliedSpecialBenefit?.discountPercentage;
      matchedPromotionId = null; // Superseded by membership benefit
    } else if (couponDiscount > 0) {
      authoritativeDiscount = couponDiscount;
      resolvedDiscountLabel = hasCouponCode
        ? `Coupon ${String(body.couponCode).trim().toUpperCase()}`
        : undefined;
      resolvedDiscountType = 'coupon';
      appliedSpecialBenefit = null; // Restaurant coupon gave higher discount
    }

    const configuredTaxPercent =
      restaurantSettings.taxPercent !== undefined
        ? Number(restaurantSettings.taxPercent)
        : restaurantSettings.taxRate !== undefined
          ? Number(restaurantSettings.taxRate)
          : 5;

    const configuredServiceChargePercent =
      body.orderType === 'dine_in' || !body.orderType
        ? restaurantSettings.serviceCharge !== undefined
          ? Number(restaurantSettings.serviceCharge)
          : restaurantSettings.serviceChargePercent !== undefined
            ? Number(restaurantSettings.serviceChargePercent)
            : 5
        : 0;

    const taxableBase = Math.max(0, authoritativeSubtotal - authoritativeDiscount);
    const authoritativeTax = Math.round(taxableBase * (configuredTaxPercent / 100));
    const authoritativeServiceCharge = Math.round(
      taxableBase * (configuredServiceChargePercent / 100)
    );
    const authoritativeTotal = taxableBase + authoritativeTax + authoritativeServiceCharge;

    const sessionId =
      (typeof body.sessionId === 'string' && body.sessionId.trim()) ||
      `SES-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

    const seqNum = typeof body.orderSequence === 'number' ? body.orderSequence : 0;
    const isAdditional = Boolean(body.isAdditionalOrder || seqNum > 1);
    const primaryOrderId =
      (typeof body.primaryOrderId === 'string' && body.primaryOrderId.trim()) || targetOrderId;
    const orderSequence = seqNum || (isAdditional ? 2 : 1);
    const nowIso = new Date().toISOString();

    const cleanCouponCode = hasCouponCode ? String(body.couponCode).trim().toUpperCase() : undefined;

    const cleanedItems = verifiedItems.map((item) => ({
      itemId: item.itemId,
      name: item.name,
      count: item.count,
      notes: item.notes,
      pricePerUnit: item.pricePerUnit,
      image: item.image,
      isVeg: item.isVeg,
      category: item.category,
    }));

    const validatedOrder = {
      id: targetOrderId,
      orderId: targetOrderId,
      primaryOrderId,
      sessionId,
      orderSequence,
      isAdditionalOrder: isAdditional,
      customerId: verifiedUid,
      customerName:
        typeof body.customerName === 'string' && body.customerName.trim()
          ? body.customerName.trim()
          : 'Guest Diner',
      phone:
        typeof body.phone === 'string' && body.phone.trim()
          ? body.phone.trim()
          : '+91 98765 43210',
      tenantId: cleanTenantId,
      restaurantId: cleanTenantId,
      branchId: typeof body.branchId === 'string' && body.branchId ? body.branchId : 'main',
      tableId: resolvedTableId,
      tableNumber: cleanTableNum,
      tableName:
        typeof body.tableName === 'string' && body.tableName
          ? body.tableName
          : `Table ${cleanTableNum}`,
      orderType: typeof body.orderType === 'string' && body.orderType ? body.orderType : 'dine_in',
      orderSource:
        typeof body.orderSource === 'string' && body.orderSource ? body.orderSource : 'qr',
      items: cleanedItems,
      subtotal: authoritativeSubtotal,
      tax: authoritativeTax,
      taxPercent: configuredTaxPercent,
      serviceCharge: authoritativeServiceCharge,
      serviceChargePercent: configuredServiceChargePercent,
      discount: authoritativeDiscount,
      discountLabel: resolvedDiscountLabel,
      discountType: resolvedDiscountType,
      discountPercent: resolvedDiscountPercent,
      specialBenefitId: appliedSpecialBenefit?.id || undefined,
      specialBenefitDiscount: appliedSpecialBenefit ? specialBenefitDiscount : undefined,
      specialBenefitFunding: appliedSpecialBenefit?.fundingModel || undefined,
      couponCode: matchedPromotionId ? cleanCouponCode : undefined,
      appliedPromotionId: matchedPromotionId || undefined,
      total: authoritativeTotal,
      totalAmount: authoritativeTotal,
      status: 'NEW',
      paymentStatus: 'pending',
      specialInstructions:
        typeof body.specialInstructions === 'string' ? body.specialInstructions.slice(0, 300) : '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const sanitizedOrder: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(validatedOrder)) {
      if (value !== undefined) {
        sanitizedOrder[key] = value;
      }
    }

    // 8. Persist Order to Firestore
    await existingOrderRef.set(sanitizedOrder);

    // 8b. Record Special Benefit redemption reservation
    if (appliedSpecialBenefit && specialBenefitCalc) {
      try {
        const redemptionRef = adminDb
          .collection('specialBenefits')
          .doc(appliedSpecialBenefit.id)
          .collection('redemptions')
          .doc(`RED-${targetOrderId}`);

        await adminDb.runTransaction(async (t) => {
          t.set(redemptionRef, {
            id: `RED-${targetOrderId}`,
            benefitId: appliedSpecialBenefit!.id,
            orderId: targetOrderId,
            tenantId: cleanTenantId,
            restaurantName: String(
              restaurantSettings.name ||
                restaurantSettings.restaurantName ||
                cleanTenantId
            ),
            customerUid: verifiedUid,
            customerEmail: authUser.email || undefined,
            customerPhone:
              typeof authUser.decodedToken.phone_number === 'string'
                ? authUser.decodedToken.phone_number
                : undefined,
            originalSubtotal: authoritativeSubtotal,
            discountPercentage: appliedSpecialBenefit!.discountPercentage,
            discountAmount: specialBenefitDiscount,
            finalPayableAmount: authoritativeTotal,
            fundingModel: appliedSpecialBenefit!.fundingModel || 'platform_funded',
            platformFundedAmount: specialBenefitCalc!.platformFundedAmount,
            restaurantFundedAmount: specialBenefitCalc!.restaurantFundedAmount,
            status: 'reserved',
            reservedAt: nowIso,
          });

          const benefitRef = adminDb.collection('specialBenefits').doc(appliedSpecialBenefit!.id);
          t.update(benefitRef, {
            redemptionCount: FieldValue.increment(1),
            lastRedeemedAt: nowIso,
            updatedAt: nowIso,
          });
        });
      } catch (reserveErr) {
        console.warn(
          '[api/orders/create] Benefit reservation metric notice:',
          reserveErr
        );
      }
    }

    // 8c. Record promotion redemption metric
    if (matchedPromotionId) {
      try {
        const promoRef = adminDb
          .collection('restaurants')
          .doc(cleanTenantId)
          .collection('promotions')
          .doc(matchedPromotionId);
        await promoRef.update({
          redemptionCount: FieldValue.increment(1),
          'metrics.redemptions': FieldValue.increment(1),
          'metrics.totalDiscountGiven': FieldValue.increment(authoritativeDiscount),
          'metrics.totalRevenueGenerated': FieldValue.increment(authoritativeTotal),
          updatedAt: nowIso,
        });
      } catch (promoRedeemErr) {
        console.warn(
          '[api/orders/create] Promotion redemption metric update notice:',
          promoRedeemErr
        );
      }
    }

    // 9. Persist KOT Ticket
    const kotRef = adminDb
      .collection('restaurants')
      .doc(cleanTenantId)
      .collection('kitchenTickets')
      .doc(`KOT-${targetOrderId}`);
    await kotRef
      .set({
        id: `KOT-${targetOrderId}`,
        orderId: targetOrderId,
        tenantId: cleanTenantId,
        tableNumber: cleanTableNum,
        round: orderSequence,
        status: 'NEW',
        items: cleanedItems,
        customerName: validatedOrder.customerName,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .catch((err) => console.warn('[api/orders/create] KOT write warning:', err));

    return res.status(200).json({
      success: true,
      orderId: targetOrderId,
      order: sanitizedOrder,
      primaryOrderId,
      sessionId,
      isDuplicate: false,
      kotTicketId: `KOT-${targetOrderId}`,
    });
  } catch (err: unknown) {
    if (err instanceof FirebaseAdminInitError) {
      return handleAuthError(res, err);
    }
    const message = err instanceof Error ? err.message : 'Order validation failed.';
    console.error('[API /api/orders/create] Validation failed:', err);
    return res.status(400).json({
      success: false,
      error: message,
    });
  }
}
