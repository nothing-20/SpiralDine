import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, FirebaseAdminInitError } from '../_lib/firebaseAdmin.js';
import { AuthError, handleAuthError } from '../_lib/authMiddleware.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { PaymentFactory } from '../_lib/payments/paymentFactory.js';
import { authorizePaymentActor } from '../_lib/payments/paymentAuthorization.js';
import { serverBillingService } from '../_lib/payments/serverBillingService.js';
import type { IBill } from '../../src/shared/domain/billing/types';

interface VerifyBody {
  tenantId?: string;
  orderId?: string;
  billId?: string;
  sessionId?: string;
  providerOrderId?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  failureReason?: string;
  cancelled?: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (
    !enforceRateLimit(req, res, {
      keyPrefix: 'payments_verify',
      maxRequests: 30,
      windowMs: 60_000,
    })
  ) {
    return;
  }

  try {
    const {
      tenantId: rawTenantId,
      orderId: rawOrderId,
      billId: incomingBillId,
      sessionId: requestSessionId,
      providerOrderId: incomingProviderOrderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      failureReason: clientFailureReason,
      cancelled,
    } = (req.body || {}) as VerifyBody;

    const tenantId = typeof rawTenantId === 'string' ? rawTenantId.trim() : '';
    const orderId = typeof rawOrderId === 'string' ? rawOrderId.trim() : '';
    const cleanIncomingProviderOrderId =
      typeof incomingProviderOrderId === 'string' ? incomingProviderOrderId.trim() : '';
    const cleanRazorpayOrderId =
      typeof razorpay_order_id === 'string' ? razorpay_order_id.trim() : '';

    if (
      cleanIncomingProviderOrderId &&
      cleanRazorpayOrderId &&
      cleanIncomingProviderOrderId !== cleanRazorpayOrderId
    ) {
      return res.status(400).json({
        error: 'Mismatched providerOrderId and razorpay_order_id.',
        code: 'PROVIDER_ORDER_MISMATCH',
      });
    }

    const providerOrderId = cleanIncomingProviderOrderId || cleanRazorpayOrderId;

    if (!tenantId || !orderId || !providerOrderId) {
      return res
        .status(400)
        .json({ error: 'tenantId, orderId, and providerOrderId are required.' });
    }

    const cleanIncomingBillId =
      typeof incomingBillId === 'string' && incomingBillId.trim() ? incomingBillId.trim() : '';
    const billId =
      cleanIncomingBillId ||
      (orderId.toUpperCase().startsWith('BILL-')
        ? orderId.toUpperCase()
        : `BILL-${orderId.toUpperCase()}`);

    // 1. Fetch Authoritative Bill via Admin SDK
    const billRef = adminDb.collection('restaurants').doc(tenantId).collection('bills').doc(billId);
    const billSnap = await billRef.get();

    if (!billSnap.exists) {
      return res.status(404).json({ error: `Bill ${billId} does not exist.` });
    }

    const billData = billSnap.data() as IBill;

    // 2. Tenant isolation check
    if (billData.tenantId && billData.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Tenant mismatch on bill verification.' });
    }

    // 3. Enforce Firebase ID Token Authentication + Tenant/Branch/Customer Authorization
    await authorizePaymentActor({
      req,
      tenantId,
      orderId,
      billData,
      requestSessionId: typeof requestSessionId === 'string' ? requestSessionId : undefined,
    });

    // 4. Bind payment verification strictly to a real paymentAttempts record for this tenant & bill
    const attemptRef = adminDb
      .collection('restaurants')
      .doc(tenantId)
      .collection('paymentAttempts')
      .doc(providerOrderId);
    const attemptSnap = await attemptRef.get();

    if (!attemptSnap.exists) {
      return res.status(404).json({
        error: `Payment attempt ${providerOrderId} does not exist for tenant ${tenantId}.`,
        code: 'PAYMENT_ATTEMPT_NOT_FOUND',
      });
    }

    const attemptData = attemptSnap.data() as {
      tenantId?: string;
      billId?: string;
      orderId?: string;
      amount?: number;
      currency?: string;
    };

    if (attemptData.tenantId !== tenantId || attemptData.billId !== billId) {
      return res.status(403).json({
        error: 'Payment attempt does not match the specified tenant or bill.',
        code: 'PAYMENT_ATTEMPT_MISMATCH',
      });
    }

    if (
      attemptData.orderId &&
      attemptData.orderId !== orderId &&
      attemptData.orderId !== billData.orderId
    ) {
      return res.status(403).json({
        error: 'Payment attempt does not match the specified order.',
        code: 'PAYMENT_ORDER_MISMATCH',
      });
    }

    // 5. Idempotency fast-path: if already marked paid, return safely without re-calling provider
    if (billData.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        status: 'PAID',
        alreadySettled: true,
        bill: { ...billData, id: billSnap.id, billId },
        paymentReference: billData.transactionRef,
      });
    }

    // 6. Explicit checkout cancellation handling (never settles bill)
    if (cancelled && (!razorpay_payment_id || !razorpay_signature)) {
      await attemptRef.update({
        status: 'CANCELLED',
        verificationStatus: 'cancelled',
        failureReason: clientFailureReason || 'Customer cancelled checkout',
        updatedAt: new Date().toISOString(),
      });
      return res.status(200).json({
        success: false,
        status: 'CANCELLED',
        failureReason: clientFailureReason || 'Payment cancelled by customer.',
      });
    }

    // 7. Authoritative Provider Verification
    const provider = PaymentFactory.getProviderForTenant(tenantId);
    const verificationResult = await provider.verifyPayment({
      providerOrderId,
      paymentId: typeof razorpay_payment_id === 'string' ? razorpay_payment_id.trim() : '',
      signature: typeof razorpay_signature === 'string' ? razorpay_signature.trim() : '',
      expectedServerOrderId: providerOrderId,
    });

    // 8. If verified SUCCESS, check amount & currency then settle atomically
    if (verificationResult.success && verificationResult.status === 'SUCCESS') {
      const expectedCurrency = String(billData.currency || attemptData.currency || 'INR').toUpperCase();
      const verifiedCurrency = String(verificationResult.currency || 'INR').toUpperCase();
      if (verifiedCurrency !== expectedCurrency) {
        await attemptRef.update({
          status: 'FAILED',
          verificationStatus: 'failed',
          failureReason: `Currency mismatch. Expected ${expectedCurrency}, verified ${verifiedCurrency}.`,
          updatedAt: new Date().toISOString(),
        });
        return res.status(400).json({
          error: `Payment currency mismatch. Expected ${expectedCurrency}, Verified ${verifiedCurrency}`,
          status: 'FAILED',
        });
      }

      const expectedAmount = Number(attemptData.amount || billData.total);
      const amountDiff = Math.abs(verificationResult.amountInCents - billData.total);
      const attemptDiff = Math.abs(verificationResult.amountInCents - expectedAmount);
      if (amountDiff > 0 || attemptDiff > 0) {
        await attemptRef.update({
          status: 'FAILED',
          verificationStatus: 'failed',
          failureReason: `Amount mismatch. Expected ${billData.total}, verified ${verificationResult.amountInCents}.`,
          updatedAt: new Date().toISOString(),
        });
        return res.status(400).json({
          error: `Payment amount mismatch. Verified: ${verificationResult.amountInCents}, Expected: ${billData.total}`,
          status: 'FAILED',
        });
      }

      const settlement = await serverBillingService.settleVerifiedPayment({
        tenantId,
        orderId: billData.orderId || orderId,
        billId,
        verificationResult,
        paymentAttemptId: providerOrderId,
      });

      return res.status(200).json({
        success: true,
        status: 'PAID',
        bill: settlement.bill,
        paymentReference:
          verificationResult.paymentReference || verificationResult.providerPaymentId,
        alreadySettled: settlement.alreadySettled,
      });
    }

    // 9. Non-success status: record attempt failure/processing status cleanly without settling bill
    await attemptRef.update({
      status: verificationResult.status,
      verificationStatus: verificationResult.status === 'PROCESSING' ? 'pending' : 'failed',
      failureReason:
        verificationResult.failureReason || clientFailureReason || 'Payment verification failed',
      updatedAt: new Date().toISOString(),
    });

    const isSignatureOrOrderFailure =
      verificationResult.failureReason?.toLowerCase().includes('signature') ||
      verificationResult.failureReason?.toLowerCase().includes('mismatch') ||
      verificationResult.failureReason?.toLowerCase().includes('missing paymentid');

    return res.status(isSignatureOrOrderFailure ? 400 : 200).json({
      success: false,
      status: verificationResult.status,
      error: isSignatureOrOrderFailure
        ? verificationResult.failureReason || 'Invalid payment signature.'
        : undefined,
      failureReason:
        verificationResult.failureReason || 'Payment could not be verified as SUCCESS.',
    });
  } catch (err: unknown) {
    if (err instanceof AuthError || err instanceof FirebaseAdminInitError) {
      return handleAuthError(res, err);
    }
    const message = err instanceof Error ? err.message : 'Payment verification failed.';
    console.error('[API /payments/verify] Error:', err);
    return res.status(500).json({
      error: message,
    });
  }
}
