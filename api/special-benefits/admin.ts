import type { VercelRequest, VercelResponse } from '@vercel/node';
import type {
  ISpecialBenefit,
  ISpecialBenefitRedemption,
  TSpecialBenefitFunding,
  TSpecialBenefitScope,
  TSpecialBenefitStatus,
  TSpecialBenefitFrequency,
} from '../../src/shared/domain/specialBenefits/types.js';
import { adminDb } from '../_lib/firebaseAdmin.js';
import {
  handleAuthError,
  requireSuperAdmin,
  AuthError,
} from '../_lib/authMiddleware.js';
import {
  normalizeMemberEmail,
  normalizeMemberPhone,
} from '../_lib/specialBenefitsService.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let adminCtx;
  try {
    adminCtx = await requireSuperAdmin(req);
  } catch (authErr) {
    return handleAuthError(res, authErr);
  }

  try {
    // -------------------------------------------------------------------------
    // GET: List all benefits or retrieve a single benefit with redemptions
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const benefitId = typeof req.query.id === 'string' ? req.query.id.trim() : null;

      if (benefitId) {
        const docSnap = await adminDb.collection('specialBenefits').doc(benefitId).get();
        if (!docSnap.exists) {
          return res.status(404).json({ error: 'Special benefit record not found.' });
        }

        const benefit = { id: docSnap.id, ...docSnap.data() } as ISpecialBenefit;

        // Fetch recent redemptions
        const redemptionsSnap = await adminDb
          .collection('specialBenefits')
          .doc(benefitId)
          .collection('redemptions')
          .orderBy('reservedAt', 'desc')
          .limit(50)
          .get();

        const redemptions: ISpecialBenefitRedemption[] = redemptionsSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as ISpecialBenefitRedemption)
        );

        return res.status(200).json({ benefit, redemptions });
      }

      // List query
      let queryRef: FirebaseFirestore.Query = adminDb.collection('specialBenefits');
      const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : null;

      if (statusFilter && (statusFilter === 'active' || statusFilter === 'inactive')) {
        queryRef = queryRef.where('status', '==', statusFilter);
      }

      const snapshot = await queryRef.orderBy('createdAt', 'desc').limit(100).get();
      const benefits: ISpecialBenefit[] = snapshot.docs.map(
        (d) => ({ id: d.id, ...d.data() } as ISpecialBenefit)
      );

      return res.status(200).json({ benefits });
    }

    // -------------------------------------------------------------------------
    // POST: Register a new eligible member benefit
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body || {};
      const memberName = typeof body.memberName === 'string' ? body.memberName.trim() : '';
      const rawEmail = typeof body.memberEmail === 'string' ? body.memberEmail.trim() : '';
      const rawPhone = typeof body.memberPhone === 'string' ? body.memberPhone.trim() : '';

      if (!memberName) {
        return res.status(400).json({ error: 'Member administrative name is required.' });
      }

      const memberEmail = rawEmail ? normalizeMemberEmail(rawEmail) : undefined;
      const memberPhone = rawPhone ? normalizeMemberPhone(rawPhone) : undefined;

      if (!memberEmail && !memberPhone) {
        return res.status(400).json({
          error: 'At least one verified contact method (Email address or Mobile number) is required.',
        });
      }

      const discountPercentage =
        typeof body.discountPercentage === 'number' &&
        body.discountPercentage >= 1 &&
        body.discountPercentage <= 100
          ? Math.round(body.discountPercentage)
          : 50;

      const status: TSpecialBenefitStatus =
        body.status === 'inactive' ? 'inactive' : 'active';

      const scope: TSpecialBenefitScope =
        body.scope === 'selected_restaurants' ? 'selected_restaurants' : 'all_restaurants';

      let applicableTenantIds: string[] | undefined = undefined;
      if (scope === 'selected_restaurants') {
        if (!Array.isArray(body.applicableTenantIds) || body.applicableTenantIds.length === 0) {
          return res.status(400).json({
            error: 'Please select at least one restaurant when scope is restricted to selected restaurants.',
          });
        }
        applicableTenantIds = body.applicableTenantIds
          .filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t: string) => t.trim());
      }

      const fundingModel: TSpecialBenefitFunding =
        body.fundingModel === 'restaurant_funded' || body.fundingModel === 'joint_funded'
          ? body.fundingModel
          : 'platform_funded';

      let platformContributionPercent = 100;
      let restaurantContributionPercent = 0;
      if (fundingModel === 'restaurant_funded') {
        platformContributionPercent = 0;
        restaurantContributionPercent = 100;
      } else if (fundingModel === 'joint_funded') {
        platformContributionPercent =
          typeof body.platformContributionPercent === 'number'
            ? Math.min(100, Math.max(0, body.platformContributionPercent))
            : 50;
        restaurantContributionPercent = 100 - platformContributionPercent;
      }

      const usageFrequency: TSpecialBenefitFrequency =
        body.usageFrequency === 'unlimited' ||
        body.usageFrequency === 'once_per_week' ||
        body.usageFrequency === 'once_total'
          ? body.usageFrequency
          : 'once_per_day';

      const maxUsageTotal =
        typeof body.maxUsageTotal === 'number' && body.maxUsageTotal > 0
          ? Math.round(body.maxUsageTotal)
          : null;

      const maxDiscountPerOrder =
        typeof body.maxDiscountPerOrder === 'number' && body.maxDiscountPerOrder > 0
          ? Math.round(body.maxDiscountPerOrder)
          : null;

      const startDate =
        typeof body.startDate === 'string' && body.startDate.trim()
          ? new Date(body.startDate).toISOString()
          : undefined;

      const expiryDate =
        typeof body.expiryDate === 'string' && body.expiryDate.trim()
          ? new Date(body.expiryDate).toISOString()
          : undefined;

      const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

      const benefitId = `BENEFIT-${Date.now().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}`;

      const now = new Date().toISOString();

      const newBenefit: ISpecialBenefit = {
        id: benefitId,
        memberName,
        memberEmail,
        memberPhone,
        discountPercentage,
        status,
        scope,
        applicableTenantIds,
        fundingModel,
        platformContributionPercent,
        restaurantContributionPercent,
        usageFrequency,
        maxUsageTotal,
        maxDiscountPerOrder,
        startDate,
        expiryDate,
        redemptionCount: 0,
        notes,
        createdBy: adminCtx.uid,
        createdByName: adminCtx.email || 'Super Admin',
        createdAt: now,
        updatedAt: now,
      };

      await adminDb.collection('specialBenefits').doc(benefitId).set(newBenefit);

      return res.status(201).json({
        message: 'Special benefit registered successfully.',
        benefit: newBenefit,
      });
    }

    // -------------------------------------------------------------------------
    // PUT: Update an existing special benefit configuration
    // -------------------------------------------------------------------------
    if (req.method === 'PUT') {
      const body = req.body || {};
      const benefitId =
        (typeof req.query.id === 'string' ? req.query.id.trim() : '') ||
        (typeof body.id === 'string' ? body.id.trim() : '');

      if (!benefitId) {
        return res.status(400).json({ error: 'Special benefit ID is required for update.' });
      }

      const docRef = adminDb.collection('specialBenefits').doc(benefitId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: 'Special benefit record not found.' });
      }

      const updates: Partial<ISpecialBenefit> = {
        updatedAt: new Date().toISOString(),
      };

      if (typeof body.memberName === 'string' && body.memberName.trim()) {
        updates.memberName = body.memberName.trim();
      }
      if (typeof body.memberEmail !== 'undefined') {
        updates.memberEmail = body.memberEmail
          ? normalizeMemberEmail(body.memberEmail)
          : undefined;
      }
      if (typeof body.memberPhone !== 'undefined') {
        updates.memberPhone = body.memberPhone
          ? normalizeMemberPhone(body.memberPhone)
          : undefined;
      }
      if (
        typeof body.discountPercentage === 'number' &&
        body.discountPercentage >= 1 &&
        body.discountPercentage <= 100
      ) {
        updates.discountPercentage = Math.round(body.discountPercentage);
      }
      if (body.status === 'active' || body.status === 'inactive') {
        updates.status = body.status;
      }
      if (body.scope === 'all_restaurants' || body.scope === 'selected_restaurants') {
        updates.scope = body.scope;
        if (body.scope === 'selected_restaurants' && Array.isArray(body.applicableTenantIds)) {
          updates.applicableTenantIds = body.applicableTenantIds
            .filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
            .map((t: string) => t.trim());
        } else if (body.scope === 'all_restaurants') {
          updates.applicableTenantIds = [];
        }
      }
      if (
        body.fundingModel === 'platform_funded' ||
        body.fundingModel === 'restaurant_funded' ||
        body.fundingModel === 'joint_funded'
      ) {
        updates.fundingModel = body.fundingModel;
        if (body.fundingModel === 'platform_funded') {
          updates.platformContributionPercent = 100;
          updates.restaurantContributionPercent = 0;
        } else if (body.fundingModel === 'restaurant_funded') {
          updates.platformContributionPercent = 0;
          updates.restaurantContributionPercent = 100;
        } else if (body.fundingModel === 'joint_funded') {
          const plat =
            typeof body.platformContributionPercent === 'number'
              ? Math.min(100, Math.max(0, body.platformContributionPercent))
              : 50;
          updates.platformContributionPercent = plat;
          updates.restaurantContributionPercent = 100 - plat;
        }
      }
      if (
        body.usageFrequency === 'unlimited' ||
        body.usageFrequency === 'once_per_day' ||
        body.usageFrequency === 'once_per_week' ||
        body.usageFrequency === 'once_total'
      ) {
        updates.usageFrequency = body.usageFrequency;
      }
      if (typeof body.maxUsageTotal !== 'undefined') {
        updates.maxUsageTotal =
          typeof body.maxUsageTotal === 'number' && body.maxUsageTotal > 0
            ? Math.round(body.maxUsageTotal)
            : null;
      }
      if (typeof body.maxDiscountPerOrder !== 'undefined') {
        updates.maxDiscountPerOrder =
          typeof body.maxDiscountPerOrder === 'number' && body.maxDiscountPerOrder > 0
            ? Math.round(body.maxDiscountPerOrder)
            : null;
      }
      if (typeof body.startDate !== 'undefined') {
        updates.startDate = body.startDate
          ? new Date(body.startDate).toISOString()
          : undefined;
      }
      if (typeof body.expiryDate !== 'undefined') {
        updates.expiryDate = body.expiryDate
          ? new Date(body.expiryDate).toISOString()
          : undefined;
      }
      if (typeof body.notes === 'string') {
        updates.notes = body.notes.trim();
      }

      await docRef.update(updates);

      return res.status(200).json({
        message: 'Special benefit updated successfully.',
        updatedFields: updates,
      });
    }

    // -------------------------------------------------------------------------
    // DELETE: Inactivate or delete special benefit
    // -------------------------------------------------------------------------
    if (req.method === 'DELETE') {
      const benefitId = typeof req.query.id === 'string' ? req.query.id.trim() : '';
      if (!benefitId) {
        return res.status(400).json({ error: 'Special benefit ID is required for deletion.' });
      }

      const docRef = adminDb.collection('specialBenefits').doc(benefitId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: 'Special benefit record not found.' });
      }

      // Check if any redemptions exist
      const redemptionsSnap = await docRef.collection('redemptions').limit(1).get();

      if (!redemptionsSnap.empty) {
        // Redemptions exist: soft delete (inactivate) to preserve audit trail
        await docRef.update({
          status: 'inactive',
          updatedAt: new Date().toISOString(),
          notes: `${docSnap.data()?.notes || ''}\n[Archived by Super Admin on ${new Date().toISOString()}]`.trim(),
        });
        return res.status(200).json({
          message: 'Special benefit has historical redemptions and was marked inactive to preserve audit records.',
          action: 'inactivated',
        });
      }

      // No redemptions: clean hard delete
      await docRef.delete();
      return res.status(200).json({
        message: 'Special benefit removed permanently.',
        action: 'deleted',
      });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error: unknown) {
    console.error('[SpecialBenefitsAdmin] API Error:', error);
    if (error instanceof AuthError) {
      return handleAuthError(res, error);
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}
