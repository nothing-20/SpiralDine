import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  setDoc,
  increment,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type {
  ISpecialBenefit,
  ISpecialBenefitEligibilityResponse,
  ISpecialBenefitRedemption,
} from '../domain/specialBenefits/types';

/**
 * Normalizes phone numbers for zero-trust comparison.
 * Handles Indian +91 formats and removes whitespace/hyphens.
 */
export function normalizePhone(phone: unknown): string {
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
 * Normalizes email address to trimmed lowercase.
 */
export function normalizeEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export interface IEligibleBenefitResult extends ISpecialBenefitEligibilityResponse {
  benefit?: ISpecialBenefit;
  discountAmount: number;
}

/**
 * Client-Side Special Benefits Service
 * Evaluates active membership discount benefits directly from Firestore.
 */
export const clientSpecialBenefitsService = {
  /**
   * Check eligibility for an authenticated user at a specific restaurant tenant.
   */
  async checkEligibility(
    user: {
      uid?: string;
      email?: string | null;
      phoneNumber?: string | null;
      phone?: string | null;
    } | null,
    tenantId: string,
    subtotal: number
  ): Promise<IEligibleBenefitResult> {
    if (!user || (!user.uid && !user.email && !user.phoneNumber && !user.phone)) {
      return {
        eligible: false,
        discountPercentage: 0,
        discountAmount: 0,
        reason: 'Guest diner or unauthenticated session.',
      };
    }

    const normEmail = normalizeEmail(user.email);
    const normPhone = normalizePhone(user.phoneNumber || user.phone);
    const uid = user.uid || '';
    const now = new Date();

    try {
      // Query active special benefits from Firestore
      const benefitsCol = collection(db, 'specialBenefits');
      const q = query(benefitsCol, where('status', '==', 'active'));
      const snap = await getDocs(q);

      if (snap.empty) {
        return {
          eligible: false,
          discountPercentage: 0,
          discountAmount: 0,
          reason: 'No active special benefit plans found.',
        };
      }

      let matchedDoc: ISpecialBenefit | null = null;

      for (const d of snap.docs) {
        const data = { id: d.id, ...d.data() } as ISpecialBenefit;
        if (data.status !== 'active') continue;

        // Check 1: Bound UID match
        if (uid && data.memberUid && data.memberUid === uid) {
          matchedDoc = data;
          break;
        }

        // Check 2: Phone match
        if (normPhone && data.memberPhone) {
          const bPhone = normalizePhone(data.memberPhone);
          if (
            bPhone === normPhone ||
            bPhone.endsWith(normPhone) ||
            normPhone.endsWith(bPhone.replace(/^\+91/, ''))
          ) {
            matchedDoc = data;
            break;
          }
        }

        // Check 3: Email match
        if (normEmail && data.memberEmail) {
          const bEmail = normalizeEmail(data.memberEmail);
          if (bEmail === normEmail) {
            matchedDoc = data;
            break;
          }
        }
      }

      if (!matchedDoc) {
        return {
          eligible: false,
          discountPercentage: 0,
          discountAmount: 0,
          reason: 'No matching membership discount found for this user account.',
        };
      }

      // Validate date window
      if (matchedDoc.startDate) {
        const start = new Date(matchedDoc.startDate);
        if (now < start) {
          return {
            eligible: false,
            discountPercentage: 0,
            discountAmount: 0,
            reason: 'Membership discount is not yet active.',
          };
        }
      }

      if (matchedDoc.expiryDate) {
        const expiry = new Date(matchedDoc.expiryDate);
        if (now > expiry) {
          return {
            eligible: false,
            discountPercentage: 0,
            discountAmount: 0,
            reason: 'Membership discount has expired.',
          };
        }
      }

      // Validate restaurant scope
      if (
        matchedDoc.scope === 'selected_restaurants' &&
        tenantId &&
        Array.isArray(matchedDoc.applicableTenantIds)
      ) {
        if (!matchedDoc.applicableTenantIds.includes(tenantId)) {
          return {
            eligible: false,
            discountPercentage: 0,
            discountAmount: 0,
            reason: 'Membership discount is not applicable at this restaurant.',
          };
        }
      }

      // Validate lifetime redemptions cap
      if (
        typeof matchedDoc.maxUsageTotal === 'number' &&
        matchedDoc.maxUsageTotal > 0 &&
        typeof matchedDoc.redemptionCount === 'number' &&
        matchedDoc.redemptionCount >= matchedDoc.maxUsageTotal
      ) {
        return {
          eligible: false,
          discountPercentage: 0,
          discountAmount: 0,
          reason: 'Membership discount usage limit reached.',
        };
      }

      // Calculate discount
      const pct = Math.min(100, Math.max(0, matchedDoc.discountPercentage || 0));
      let discountAmount = Math.round(subtotal * (pct / 100));

      // Apply per-order cap if specified
      if (
        typeof matchedDoc.maxDiscountPerOrder === 'number' &&
        matchedDoc.maxDiscountPerOrder > 0
      ) {
        discountAmount = Math.min(discountAmount, matchedDoc.maxDiscountPerOrder);
      }

      return {
        eligible: true,
        benefit: matchedDoc,
        benefitId: matchedDoc.id,
        discountPercentage: pct,
        discountAmount,
        label: 'Special member discount applied',
        scope: matchedDoc.scope,
        fundingModel: matchedDoc.fundingModel || 'platform_funded',
        maxDiscountPerOrder: matchedDoc.maxDiscountPerOrder || null,
      };
    } catch (err) {
      console.warn('[clientSpecialBenefitsService] Eligibility check warning:', err);
      return {
        eligible: false,
        discountPercentage: 0,
        discountAmount: 0,
        reason: 'Service unavailable.',
      };
    }
  },

  /**
   * Automatically bind member UID to benefit record upon first order.
   * Changes status in Super Admin from "Pending First Order" to "Bound".
   */
  async bindMemberUid(benefitId: string, uid: string): Promise<boolean> {
    if (!benefitId || !uid) return false;
    try {
      const benefitRef = doc(db, 'specialBenefits', benefitId);
      const snap = await getDoc(benefitRef);
      if (!snap.exists()) return false;

      const data = snap.data();
      if (!data.memberUid || data.memberUid === '') {
        await updateDoc(benefitRef, {
          memberUid: uid,
          boundAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[clientSpecialBenefitsService] UID binding warning:', err);
      return false;
    }
  },

  /**
   * Records a redemption record under the benefit document.
   */
  async recordRedemption(
    benefitId: string,
    redemption: Omit<ISpecialBenefitRedemption, 'id' | 'benefitId'> & { orderId: string; benefitId?: string }
  ): Promise<void> {
    if (!benefitId || !redemption.orderId) return;
    try {
      const redId = `RED-${redemption.orderId}`;
      const redRef = doc(db, 'specialBenefits', benefitId, 'redemptions', redId);
      await setDoc(redRef, {
        id: redId,
        benefitId,
        ...redemption,
        reservedAt: redemption.reservedAt || new Date().toISOString(),
      });

      // Increment redemptionCount and update lastRedeemedAt
      const benefitRef = doc(db, 'specialBenefits', benefitId);
      await updateDoc(benefitRef, {
        redemptionCount: increment(1),
        lastRedeemedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[clientSpecialBenefitsService] Record redemption warning:', err);
    }
  },
};
