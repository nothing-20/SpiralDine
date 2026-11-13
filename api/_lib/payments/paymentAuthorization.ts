import type { VercelRequest } from '@vercel/node';
import { adminDb } from '../firebaseAdmin.js';
import {
  AuthError,
  requireAuthenticatedUser,
  VerifiedAuthContext,
} from '../authMiddleware.js';
import type { IBill } from '../../../src/shared/domain/billing/types';

const PAYMENT_STAFF_ROLES = new Set([
  'owner',
  'restaurant_owner',
  'admin',
  'manager',
  'cashier',
  'waiter',
  'staff',
  'reception',
  'pos',
]);

const OWNER_WIDE_ROLES = new Set(['owner', 'restaurant_owner', 'admin']);

const SENTINEL_GUEST_IDS = new Set([
  '',
  'guest',
  'guest-uid',
  'guest_diner',
  'guest-diner',
  'walk_in',
  'walk-in',
  'anonymous',
]);

export interface BillAccessAuthorizationParams {
  req: VercelRequest;
  tenantId: string;
  orderId?: string;
  billData: Partial<IBill> & { customerId?: string; sessionId?: string; branchId?: string };
  orderData?: Record<string, unknown> | null;
  requestSessionId?: string;
}

function normalizeOwnerCandidate(val: unknown): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed || SENTINEL_GUEST_IDS.has(trimmed.toLowerCase())) {
    return '';
  }
  return trimmed;
}

/**
 * Authorizes a caller (tenant payment staff, super admin, or owning customer/guest diner)
 * to initiate or verify payment for a tenant bill.
 */
export async function authorizePaymentActor(
  params: BillAccessAuthorizationParams
): Promise<VerifiedAuthContext> {
  const { req, tenantId, orderId, billData, orderData: preloadedOrderData, requestSessionId } = params;

  const authUser = await requireAuthenticatedUser(req, {
    allowAnonymous: true,
    checkRevoked: true,
    loadUserProfile: true,
  });

  if (authUser.isSuperAdmin || authUser.role === 'super_admin') {
    return authUser;
  }

  const normalizedRole = authUser.role || null;
  const billBranchId =
    (typeof billData.branchId === 'string' && billData.branchId.trim()) ||
    (typeof preloadedOrderData?.branchId === 'string' && preloadedOrderData.branchId.trim()) ||
    '';

  if (normalizedRole && PAYMENT_STAFF_ROLES.has(normalizedRole)) {
    if (!authUser.tenantId || authUser.tenantId !== tenantId) {
      throw new AuthError(
        403,
        'TENANT_ACCESS_DENIED',
        'Forbidden: Staff member does not belong to this restaurant tenant.'
      );
    }

    if (
      !OWNER_WIDE_ROLES.has(normalizedRole) &&
      billBranchId &&
      authUser.branchId &&
      authUser.branchId !== billBranchId
    ) {
      throw new AuthError(
        403,
        'BRANCH_ACCESS_DENIED',
        'Forbidden: Staff member is not assigned to the branch for this bill.'
      );
    }

    return authUser;
  }

  // Non-payment staff from another tenant (e.g., kitchen staff of another restaurant) cannot act
  if (normalizedRole && normalizedRole !== 'customer' && authUser.tenantId !== tenantId) {
    throw new AuthError(
      403,
      'TENANT_ACCESS_DENIED',
      'Forbidden: User role does not authorize payment operations.'
    );
  }

  // Customer / Anonymous QR diner path: resolve authoritative customer ownership
  let orderData = preloadedOrderData || null;
  const targetOrderId = billData.orderId || orderId;
  if (!orderData && targetOrderId) {
    try {
      const orderSnap = await adminDb
        .collection('restaurants')
        .doc(tenantId)
        .collection('orders')
        .doc(targetOrderId)
        .get();
      if (orderSnap.exists) {
        orderData = (orderSnap.data() as Record<string, unknown>) || null;
      }
    } catch {
      // Fall back to bill fields only
    }
  }

  const ownerCandidates = [
    normalizeOwnerCandidate(billData.customerId),
    normalizeOwnerCandidate(orderData?.customerId),
  ].filter(Boolean);

  if (ownerCandidates.length > 0) {
    if (!ownerCandidates.includes(authUser.uid)) {
      throw new AuthError(
        403,
        'FORBIDDEN_BILL_ACCESS',
        'Forbidden: You are not authorized to access or pay another customer\'s bill.'
      );
    }
    return authUser;
  }

  // Unowned walk-in bill: only permit with a matching non-guest dining session ID
  const cleanReqSession = typeof requestSessionId === 'string' ? requestSessionId.trim() : '';
  const billSessionId =
    (typeof billData.sessionId === 'string' && billData.sessionId.trim()) ||
    (typeof orderData?.sessionId === 'string' && orderData.sessionId.trim()) ||
    '';

  if (
    cleanReqSession &&
    billSessionId &&
    cleanReqSession !== 'GUEST-SESSION' &&
    cleanReqSession === billSessionId
  ) {
    return authUser;
  }

  throw new AuthError(
    403,
    'FORBIDDEN_BILL_ACCESS',
    'Forbidden: Customer ownership or authorized restaurant staff role is required for this bill.'
  );
}
