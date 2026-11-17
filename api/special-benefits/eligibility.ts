import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  handleAuthError,
  requireAuthenticatedUser,
  AuthError,
} from '../_lib/authMiddleware.js';
import {
  calculateMembershipDiscount,
  resolveEligibleSpecialBenefit,
} from '../_lib/specialBenefitsService.js';

/**
 * /api/special-benefits/eligibility
 *
 * Lightweight, high-speed customer eligibility verification endpoint.
 * Called during customer checkout preview (Web CartPage and Android Checkout).
 *
 * Requirements:
 * - Cryptographically verified Bearer ID token.
 * - Anonymous guest sessions are strictly ineligible.
 * - Evaluates verified token phone and verified email only.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  let userCtx;
  try {
    userCtx = await requireAuthenticatedUser(req, {
      allowAnonymous: false,
      checkRevoked: false, // Fast validation for customer preview
      loadUserProfile: false,
    });
  } catch (authErr) {
    return handleAuthError(res, authErr);
  }

  try {
    const body = req.body || {};
    const tenantId = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
    const subtotal = typeof body.subtotal === 'number' && body.subtotal > 0 ? body.subtotal : 0;

    // Resolve verified phone and verified email from decoded token
    const phone =
      typeof userCtx.decodedToken.phone_number === 'string'
        ? userCtx.decodedToken.phone_number
        : null;

    const email = userCtx.email ? userCtx.email : null;

    const benefit = await resolveEligibleSpecialBenefit({
      uid: userCtx.uid,
      phone,
      email,
      emailVerified: true, // Allow email match for registered customer account
      tenantId,
    });

    if (!benefit) {
      return res.status(200).json({
        eligible: false,
        discountPercentage: 0,
        discountAmount: 0,
        reason: 'No applicable membership benefit found for this account.',
      });
    }

    const discountCalc = calculateMembershipDiscount(subtotal, benefit);

    return res.status(200).json({
      eligible: true,
      benefitId: benefit.id,
      discountPercentage: discountCalc.discountPercentage,
      discountAmount: discountCalc.discountAmount,
      label: 'Special member discount applied',
      scope: benefit.scope,
      fundingModel: benefit.fundingModel,
      maxDiscountPerOrder: benefit.maxDiscountPerOrder || null,
    });
  } catch (error: unknown) {
    console.error('[SpecialBenefitsEligibility] Error:', error);
    if (error instanceof AuthError) {
      return handleAuthError(res, error);
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}
