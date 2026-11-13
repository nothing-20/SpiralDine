import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, FirebaseAdminInitError } from '../../_lib/firebaseAdmin.js';
import { enforceRateLimit } from '../../_lib/rateLimiter.js';
import { PaymentFactory } from '../../_lib/payments/paymentFactory.js';
import { serverBillingService } from '../../_lib/payments/serverBillingService.js';
import type { IBill } from '../../../src/shared/domain/billing/types';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface WebhookNotes {
  tenantId?: string;
  orderId?: string;
  billId?: string;
}

interface WebhookRawPayload {
  payload?: {
    payment?: { entity?: { notes?: WebhookNotes } };
    order?: { entity?: { notes?: WebhookNotes } };
  };
  payment?: { entity?: { notes?: WebhookNotes } };
  order?: { entity?: { notes?: WebhookNotes } };
}

async function readRawBody(req: VercelRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer.toString('utf8'));
    });
    req.on('error', (err) => {
      reject(err);
    });
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (
    !enforceRateLimit(req, res, {
      keyPrefix: 'payments_razorpay_webhook',
      maxRequests: 120,
      windowMs: 60_000,
    })
  ) {
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    if (!rawBody) {
      return res.status(400).json({ error: 'Empty webhook payload' });
    }

    const headersRecord: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (typeof val === 'string') {
        headersRecord[key.toLowerCase()] = val;
      } else if (Array.isArray(val) && val.length > 0) {
        headersRecord[key.toLowerCase()] = val[0];
      }
    }

    const signatureHeader = headersRecord['x-razorpay-signature'];
    if (!signatureHeader || !signatureHeader.trim()) {
      return res.status(401).json({ error: 'Missing X-Razorpay-Signature header.' });
    }

    const provider = PaymentFactory.getProviderForTenant('default');
    const verificationResult = await provider.handleWebhook(rawBody, headersRecord);

    const failureLower = (verificationResult.failureReason || '').toLowerCase();
    if (failureLower.includes('signature') || failureLower.includes('not configured')) {
      const statusCode = failureLower.includes('not configured') ? 500 : 401;
      return res.status(statusCode).json({
        error: verificationResult.failureReason || 'Invalid webhook signature',
      });
    }

    if (failureLower.includes('malformed json')) {
      return res.status(400).json({ error: verificationResult.failureReason });
    }

    const providerOrderId = verificationResult.providerOrderId;
    const rawResponse = (verificationResult.rawResponse || {}) as WebhookRawPayload;
    const rawData = rawResponse.payload || rawResponse;
    const notes: WebhookNotes =
      rawData.payment?.entity?.notes || rawData.order?.entity?.notes || {};

    let tenantId = typeof notes.tenantId === 'string' ? notes.tenantId.trim() : '';
    let orderId = typeof notes.orderId === 'string' ? notes.orderId.trim() : '';
    let billId = typeof notes.billId === 'string' ? notes.billId.trim() : '';
    let attemptData: Record<string, unknown> | null = null;
    let attemptRef: FirebaseFirestore.DocumentReference | null = null;

    if (providerOrderId) {
      if (tenantId) {
        const candidateRef = adminDb
          .collection('restaurants')
          .doc(tenantId)
          .collection('paymentAttempts')
          .doc(providerOrderId);
        const candidateSnap = await candidateRef.get();
        if (candidateSnap.exists) {
          attemptRef = candidateRef;
          attemptData = (candidateSnap.data() as Record<string, unknown>) || null;
        }
      }

      if (!attemptData) {
        try {
          const attemptSnap = await adminDb
            .collectionGroup('paymentAttempts')
            .where('providerOrderId', '==', providerOrderId)
            .limit(1)
            .get();
          if (!attemptSnap.empty) {
            attemptRef = attemptSnap.docs[0].ref;
            attemptData = attemptSnap.docs[0].data() as Record<string, unknown>;
            tenantId = tenantId || String(attemptData.tenantId || '');
            orderId = orderId || String(attemptData.orderId || '');
            billId = billId || String(attemptData.billId || '');
          }
        } catch (lookupErr) {
          console.warn('[Razorpay Webhook] Attempt lookup note:', lookupErr);
        }
      }
    }

    // Handle failed/non-success events after signature check without settling bill
    if (!verificationResult.success || verificationResult.status !== 'SUCCESS') {
      if (attemptRef && verificationResult.status === 'FAILED') {
        try {
          await attemptRef.update({
            status: 'FAILED',
            verificationStatus: 'failed',
            providerPaymentId: verificationResult.providerPaymentId || '',
            failureReason: verificationResult.failureReason || 'Razorpay payment failed webhook',
            updatedAt: new Date().toISOString(),
          });
        } catch (updateErr) {
          console.warn('[Razorpay Webhook] Non-blocking failed attempt update note:', updateErr);
        }
      }

      return res.status(200).json({
        status: 'ACKNOWLEDGED_NON_SUCCESS',
        paymentStatus: verificationResult.status,
      });
    }

    if (!tenantId || !billId) {
      console.error(
        `[Razorpay Webhook] Could not resolve tenantId or billId for order ${providerOrderId}`
      );
      return res
        .status(400)
        .json({ error: 'Could not resolve tenant or bill for provider order.' });
    }

    // Verify attempt binding if attempt doc exists (protects against spoofed notes)
    const cleanBillId = billId.startsWith('BILL-') ? billId : `BILL-${billId}`;
    if (attemptData) {
      const attemptTenant = String(attemptData.tenantId || '');
      const attemptBill = String(attemptData.billId || '');
      if (
        (attemptTenant && attemptTenant !== tenantId) ||
        (attemptBill && attemptBill !== cleanBillId)
      ) {
        return res.status(403).json({
          error: 'Cross-tenant or mismatched bill reference in webhook attempt.',
        });
      }
    }

    const billRef = adminDb.collection('restaurants').doc(tenantId).collection('bills').doc(cleanBillId);
    const billSnap = await billRef.get();

    if (!billSnap.exists) {
      console.error(`[Razorpay Webhook] Bill ${cleanBillId} not found for tenant ${tenantId}`);
      return res.status(404).json({ error: `Bill ${cleanBillId} not found.` });
    }

    const billData = billSnap.data() as IBill;

    if (billData.tenantId && billData.tenantId !== tenantId) {
      console.error(
        `[Razorpay Webhook] Cross-tenant reference rejected: ${billData.tenantId} != ${tenantId}`
      );
      return res.status(403).json({ error: 'Tenant mismatch on bill.' });
    }

    if (billData.paymentStatus === 'paid') {
      return res.status(200).json({ status: 'OK', alreadySettled: true });
    }

    const expectedCurrency = String(billData.currency || 'INR').toUpperCase();
    const webhookCurrency = String(verificationResult.currency || 'INR').toUpperCase();
    if (webhookCurrency !== expectedCurrency) {
      return res.status(400).json({ error: 'Payment currency mismatch against canonical bill.' });
    }

    const amountDiff = Math.abs(verificationResult.amountInCents - billData.total);
    if (amountDiff > 0) {
      console.error(
        `[Razorpay Webhook] Amount mismatch! Expected: ${billData.total}, Received: ${verificationResult.amountInCents}`
      );
      return res.status(400).json({ error: 'Payment amount mismatch against canonical bill.' });
    }

    const settlement = await serverBillingService.settleVerifiedPayment({
      tenantId,
      orderId: orderId || billData.orderId,
      billId: cleanBillId,
      verificationResult,
      paymentAttemptId: providerOrderId,
    });

    return res.status(200).json({
      status: 'OK',
      settled: !settlement.alreadySettled,
      alreadySettled: settlement.alreadySettled,
    });
  } catch (err: unknown) {
    if (err instanceof FirebaseAdminInitError) {
      return res.status(err.statusCode).json({
        error: 'Webhook database service unavailable.',
        code: err.code,
      });
    }
    const message = err instanceof Error ? err.message : 'Webhook processing failed.';
    console.error('[Razorpay Webhook] Unexpected error:', err);
    return res.status(500).json({ error: message });
  }
}
