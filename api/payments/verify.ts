import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, doc, getDoc, updateDoc, ensureServerAuth } from '../_lib/firebaseServer.js';
import { PaymentFactory } from '../_lib/payments/paymentFactory.js';
import { serverBillingService } from '../_lib/payments/serverBillingService.js';
import type { IBill } from '../../src/shared/domain/billing/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      tenantId,
      orderId,
      billId: incomingBillId,
      providerOrderId: incomingProviderOrderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    const providerOrderId = incomingProviderOrderId || razorpay_order_id;

    if (!tenantId || !orderId || !providerOrderId) {
      return res.status(400).json({ error: 'tenantId, orderId, and providerOrderId are required.' });
    }

    await ensureServerAuth();

    const billId = incomingBillId || (orderId.toUpperCase().startsWith('BILL-') ? orderId.toUpperCase() : `BILL-${orderId.toUpperCase()}`);

    // 1. Fetch Authoritative Bill
    const billRef = doc(db, 'restaurants', tenantId, 'bills', billId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) {
      return res.status(404).json({ error: `Bill ${billId} does not exist.` });
    }

    const billData = billSnap.data() as IBill;

    // 2. Tenant isolation check
    if (billData.tenantId && billData.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Tenant mismatch on bill verification.' });
    }

    // 3. Idempotency fast-path: if already marked paid, return immediately
    if (billData.paymentStatus === 'paid') {
      return res.status(200).json({
        success: true,
        status: 'PAID',
        alreadySettled: true,
        bill: { id: billSnap.id, billId, ...billData },
        paymentReference: billData.transactionRef
      });
    }

    // 4. Authoritative Provider Verification
    const provider = PaymentFactory.getProviderForTenant(tenantId);
    const verificationResult = await provider.verifyPayment({
      providerOrderId,
      paymentId: razorpay_payment_id || '',
      signature: razorpay_signature || '',
      expectedServerOrderId: providerOrderId
    });

    // 5. If verified SUCCESS
    if (verificationResult.success && verificationResult.status === 'SUCCESS') {
      // Security Validation: verify paid amount matches authoritative canonical bill total
      // Allow minor tolerance (e.g. 1 cent) only if rounding differs, otherwise strict exact match
      const amountDiff = Math.abs(verificationResult.amountInCents - billData.total);
      if (amountDiff > 10) { // Difference greater than 10 paise/cents
        console.error(`[API /payments/verify] Amount mismatch! Expected: ${billData.total}, Verified: ${verificationResult.amountInCents}`);
        return res.status(400).json({
          error: `Payment amount mismatch. Verified: ${verificationResult.amountInCents}, Expected: ${billData.total}`,
          status: 'FAILED'
        });
      }

      // Authoritative Settlement
      const settlement = await serverBillingService.settleVerifiedPayment({
        tenantId,
        orderId,
        billId,
        verificationResult,
        paymentAttemptId: providerOrderId
      });

      return res.status(200).json({
        success: true,
        status: 'PAID',
        bill: settlement.bill,
        paymentReference: verificationResult.paymentReference || verificationResult.providerPaymentId,
        alreadySettled: settlement.alreadySettled
      });
    }

    // 6. Non-success status: update attempt status
    try {
      const attemptRef = doc(db, 'restaurants', tenantId, 'paymentAttempts', providerOrderId);
      await updateDoc(attemptRef, {
        status: verificationResult.status,
        verificationStatus: 'failed',
        failureReason: verificationResult.failureReason || 'Payment not successful',
        updatedAt: new Date().toISOString()
      });
    } catch (_attErr) {}

    return res.status(200).json({
      success: false,
      status: verificationResult.status,
      failureReason: verificationResult.failureReason || 'Payment could not be verified as SUCCESS.'
    });
  } catch (err: any) {
    console.error('[API /payments/verify] Error:', err);
    return res.status(500).json({
      error: err.message || 'Payment verification failed.'
    });
  }
}
