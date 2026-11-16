import type {
  ISpecialBenefit,
  ISpecialBenefitRedemption,
  TSpecialBenefitFunding,
} from '../../src/shared/domain/specialBenefits/types.js';
import { adminDb, FieldValue } from './firebaseAdmin.js';

/**
 * Normalizes a phone number to standard E.164-compatible format.
 * Defaults to +91 country code for 10-digit Indian numbers if no code is present.
 */
export function normalizeMemberPhone(phone: unknown): string {
  if (typeof phone !== 'string') return '';
  const digits = phone.replace(/[\s\-()]/g, '').trim();
  if (!digits) return '';

  if (digits.startsWith('+')) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return `+${digits}`;
}

/**
 * Normalizes an email address to trimmed lowercase.
 */
export function normalizeMemberEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export interface ResolveBenefitParams {
  uid: string;
  phone?: string | null;
  email?: string | null;
  emailVerified?: boolean;
  tenantId: string;
}

/**
 * Resolves an eligible Special Benefit for the authenticated member.
 * Zero-trust: evaluates verified token identifiers only.
 */
export async function resolveEligibleSpecialBenefit(
  params: ResolveBenefitParams
): Promise<ISpecialBenefit | null> {
  const { uid, phone, email, emailVerified, tenantId } = params;
  if (!uid) return null;

  const now = new Date();
  const normalizedPhone = normalizeMemberPhone(phone);
  const normalizedEmail = normalizeMemberEmail(email);

  let matchedDoc: FirebaseFirestore.DocumentSnapshot | null = null;
  let requiresUidBinding = false;

  // Step 1: Query by bound memberUid
  const uidQuery = await adminDb
    .collection('specialBenefits')
    .where('memberUid', '==', uid)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (!uidQuery.empty) {
    matchedDoc = uidQuery.docs[0];
  }

  // Step 2: Query by verified phone if not matched by UID
  if (!matchedDoc && normalizedPhone) {
    const phoneQuery = await adminDb
      .collection('specialBenefits')
      .where('memberPhone', '==', normalizedPhone)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!phoneQuery.empty) {
      matchedDoc = phoneQuery.docs[0];
      requiresUidBinding = true;
    }
  }

  // Step 3: Query by verified email if not matched by phone or UID
  if (!matchedDoc && normalizedEmail && emailVerified) {
    const emailQuery = await adminDb
      .collection('specialBenefits')
      .where('memberEmail', '==', normalizedEmail)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!emailQuery.empty) {
      matchedDoc = emailQuery.docs[0];
      requiresUidBinding = true;
    }
  }

  if (!matchedDoc || !matchedDoc.exists) {
    return null;
  }

  const benefit = { id: matchedDoc.id, ...matchedDoc.data() } as ISpecialBenefit;

  // Validate active status
  if (benefit.status !== 'active') {
    return null;
  }

  // Validate Start Date
  if (benefit.startDate) {
    const start = new Date(benefit.startDate);
    if (now < start) {
      return null;
    }
  }

  // Validate Expiry Date
  if (benefit.expiryDate) {
    const expiry = new Date(benefit.expiryDate);
    if (now > expiry) {
      return null;
    }
  }

  // Validate Restaurant Scope
  if (benefit.scope === 'selected_restaurants') {
    if (!tenantId || !benefit.applicableTenantIds?.includes(tenantId)) {
      return null;
    }
  }

  // Validate Total Lifetime Usage Cap
  if (
    typeof benefit.maxUsageTotal === 'number' &&
    benefit.maxUsageTotal > 0 &&
    benefit.redemptionCount >= benefit.maxUsageTotal
  ) {
    return null;
  }

  // Validate Frequency Cap
  if (benefit.usageFrequency && benefit.usageFrequency !== 'unlimited') {
    const redemptionsRef = adminDb
      .collection('specialBenefits')
      .doc(benefit.id)
      .collection('redemptions')
      .where('customerUid', '==', uid)
      .where('status', 'in', ['reserved', 'finalized']);

    if (benefit.usageFrequency === 'once_total') {
      const snap = await redemptionsRef.limit(1).get();
      if (!snap.empty) {
        return null;
      }
    } else if (benefit.usageFrequency === 'once_per_day') {
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const snap = await redemptionsRef
        .where('reservedAt', '>=', oneDayAgo)
        .limit(1)
        .get();
      if (!snap.empty) {
        return null;
      }
    } else if (benefit.usageFrequency === 'once_per_week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const snap = await redemptionsRef
        .where('reservedAt', '>=', oneWeekAgo)
        .limit(1)
        .get();
      if (!snap.empty) {
        return null;
      }
    }
  }

  // If matched via phone or email, bind the UID deterministically in background
  if (requiresUidBinding && matchedDoc.ref) {
    matchedDoc.ref
      .update({
        memberUid: uid,
        updatedAt: now.toISOString(),
      })
      .catch((bindErr) => {
        console.warn('[SpecialBenefits] UID binding background update warning:', bindErr);
      });
  }

  return benefit;
}

export interface CalculatedDiscount {
  discountAmount: number;
  discountPercentage: number;
  platformFundedAmount: number;
  restaurantFundedAmount: number;
  fundingModel: TSpecialBenefitFunding;
}

/**
 * Calculates authoritative discount amounts and funding allocation.
 * Monetary amounts are calculated strictly in integer cents/paise.
 */
export function calculateMembershipDiscount(
  subtotal: number,
  benefit: ISpecialBenefit
): CalculatedDiscount {
  if (subtotal <= 0 || !benefit || benefit.discountPercentage <= 0) {
    return {
      discountAmount: 0,
      discountPercentage: 0,
      platformFundedAmount: 0,
      restaurantFundedAmount: 0,
      fundingModel: benefit?.fundingModel || 'platform_funded',
    };
  }

  const rawPercent = Math.min(100, Math.max(1, benefit.discountPercentage));
  let discountAmount = Math.round(subtotal * (rawPercent / 100));

  // Enforce optional order discount cap
  if (
    typeof benefit.maxDiscountPerOrder === 'number' &&
    benefit.maxDiscountPerOrder > 0 &&
    discountAmount > benefit.maxDiscountPerOrder
  ) {
    discountAmount = Math.round(benefit.maxDiscountPerOrder);
  }

  // Never exceed subtotal
  discountAmount = Math.min(discountAmount, subtotal);

  // Funding allocation
  const fundingModel: TSpecialBenefitFunding = benefit.fundingModel || 'platform_funded';
  let platformFundedAmount = 0;
  let restaurantFundedAmount = 0;

  if (fundingModel === 'platform_funded') {
    platformFundedAmount = discountAmount;
    restaurantFundedAmount = 0;
  } else if (fundingModel === 'restaurant_funded') {
    platformFundedAmount = 0;
    restaurantFundedAmount = discountAmount;
  } else if (fundingModel === 'joint_funded') {
    const platPercent =
      typeof benefit.platformContributionPercent === 'number'
        ? benefit.platformContributionPercent
        : 50;
    platformFundedAmount = Math.round(discountAmount * (platPercent / 100));
    restaurantFundedAmount = discountAmount - platformFundedAmount;
  }

  return {
    discountAmount,
    discountPercentage: rawPercent,
    platformFundedAmount,
    restaurantFundedAmount,
    fundingModel,
  };
}

export interface ReserveBenefitParams {
  benefit: ISpecialBenefit;
  orderId: string;
  billId?: string;
  tenantId: string;
  restaurantName: string;
  customerUid: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  originalSubtotal: number;
  discountAmount: number;
  finalPayableAmount: number;
  platformFundedAmount: number;
  restaurantFundedAmount: number;
}

/**
 * Registers an atomic benefit redemption reservation inside a Firestore transaction.
 */
export function reserveSpecialBenefitRedemption(
  transaction: FirebaseFirestore.Transaction,
  params: ReserveBenefitParams
): void {
  const {
    benefit,
    orderId,
    billId,
    tenantId,
    restaurantName,
    customerUid,
    customerEmail,
    customerPhone,
    originalSubtotal,
    discountAmount,
    finalPayableAmount,
    platformFundedAmount,
    restaurantFundedAmount,
  } = params;

  const redemptionRef = adminDb
    .collection('specialBenefits')
    .doc(benefit.id)
    .collection('redemptions')
    .doc(`RED-${orderId}`);

  const redemptionRecord: ISpecialBenefitRedemption = {
    id: `RED-${orderId}`,
    benefitId: benefit.id,
    orderId,
    billId: billId || undefined,
    tenantId,
    restaurantName,
    customerUid,
    customerEmail: customerEmail ? normalizeMemberEmail(customerEmail) : undefined,
    customerPhone: customerPhone ? normalizeMemberPhone(customerPhone) : undefined,
    originalSubtotal,
    discountPercentage: benefit.discountPercentage,
    discountAmount,
    finalPayableAmount,
    fundingModel: benefit.fundingModel || 'platform_funded',
    platformFundedAmount,
    restaurantFundedAmount,
    status: 'reserved',
    reservedAt: new Date().toISOString(),
  };

  transaction.set(redemptionRef, redemptionRecord);

  const benefitRef = adminDb.collection('specialBenefits').doc(benefit.id);
  transaction.update(benefitRef, {
    redemptionCount: FieldValue.increment(1),
    lastRedeemedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Transitions a redemption from 'reserved' to 'finalized' upon verified bill settlement.
 */
export async function finalizeSpecialBenefitRedemption(
  orderId: string,
  billId: string
): Promise<void> {
  try {
    const snap = await adminDb
      .collectionGroup('redemptions')
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    if (snap.empty) return;

    const docRef = snap.docs[0].ref;
    await docRef.update({
      status: 'finalized',
      billId,
      finalizedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[SpecialBenefits] Finalization error for order:', orderId, err);
  }
}

/**
 * Cancels a reserved redemption if the order is rejected or cancelled before payment.
 */
export async function cancelSpecialBenefitRedemption(
  orderId: string,
  benefitId?: string
): Promise<void> {
  try {
    let docRef: FirebaseFirestore.DocumentReference | null = null;
    let resolvedBenefitId = benefitId;

    if (benefitId) {
      const ref = adminDb
        .collection('specialBenefits')
        .doc(benefitId)
        .collection('redemptions')
        .doc(`RED-${orderId}`);
      const s = await ref.get();
      if (s.exists) {
        docRef = ref;
      }
    }

    if (!docRef) {
      const snap = await adminDb
        .collectionGroup('redemptions')
        .where('orderId', '==', orderId)
        .limit(1)
        .get();
      if (!snap.empty) {
        docRef = snap.docs[0].ref;
        resolvedBenefitId = snap.docs[0].data().benefitId;
      }
    }

    if (!docRef) return;

    await adminDb.runTransaction(async (t) => {
      const rSnap = await t.get(docRef!);
      if (!rSnap.exists) return;
      const data = rSnap.data();
      if (data?.status === 'cancelled') return;

      t.update(docRef!, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
      });

      if (resolvedBenefitId) {
        const bRef = adminDb.collection('specialBenefits').doc(resolvedBenefitId);
        t.update(bRef, {
          redemptionCount: FieldValue.increment(-1),
          updatedAt: new Date().toISOString(),
        });
      }
    });
  } catch (err) {
    console.warn('[SpecialBenefits] Cancellation rollback error for order:', orderId, err);
  }
}
