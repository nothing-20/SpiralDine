import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, doc, getDoc, collection, query, where, getDocs, limit, ensureServerAuth } from '../../_lib/firebaseServer.js';
import { PaymentFactory } from '../../_lib/payments/paymentFactory.js';
import { serverBillingService } from '../../_lib/payments/serverBillingService.js';
import type { IBill } from '../../../src/shared/domain/billing/types';

export const config = {
  api: {
    bodyParser: false
  }
};

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

  try {
    const rawBody = await readRawBody(req);
    if (!rawBody) {
      return res.status(400).json({ error: 'Empty webhook payload' });
    }

    // Convert incoming headers to lowercase record
    const headersRecord: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (typeof val === 'string') {
        headersRecord[key.toLowerCase()] = val;
      } else if (Array.isArray(val) && val.length > 0) {
        headersRecord[key.toLowerCase()] = val[0];
      }
    }

    // Resolve Razorpay provider
    const provider = PaymentFactory.getProviderForTenant('default');

    // 1. Cryptographically verify signature and parse payload
    const verificationResult = await provider.handleWebhook(rawBody, headersRecord);

    if (!verificationResult.success || verificationResult.status !== 'SUCCESS') {
      console.warn('[Razorpay Webhook] Verification failed or non-success event:', verificationResult.failureReason);
      if (verificationResult.failureReason?.includes('signature')) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
      return res.status(200).json({ status: 'ACKNOWLEDGED_NON_SUCCESS' });
    }

    await ensureServerAuth();

    const providerOrderId = verificationResult.providerOrderId;
    const rawData = verificationResult.rawResponse?.payload || verificationResult.rawResponse || {};
    const notes = rawData.payment?.entity?.notes || rawData.order?.entity?.notes || {};

    let tenantId = notes.tenantId || '';
    let orderId = notes.orderId || '';
    let billId = notes.billId || '';

    // If notes are not embedded, look up paymentAttempt in Firestore by providerOrderId
    if (!tenantId || !billId) {
      try {
        const attemptsColGroup = collection(db, 'paymentAttempts');
        const qAttempt = query(attemptsColGroup, where('providerOrderId', '==', providerOrderId), limit(1));
        const attemptSnap = await getDocs(qAttempt);
        if (!attemptSnap.empty) {
          const aData = attemptSnap.docs[0].data();
          tenantId = tenantId || aData.tenantId;
          orderId = orderId || aData.orderId;
          billId = billId || aData.billId;
        }
      } catch (_lookupErr) {}
    }

    if (!tenantId || !billId) {
      console.error(`[Razorpay Webhook] Could not resolve tenantId or billId for order ${providerOrderId}`);
      return res.status(400).json({ error: 'Could not resolve tenant or bill for provider order.' });
    }

    const cleanBillId = billId.startsWith('BILL-') ? billId : `BILL-${billId}`;
    const billRef = doc(db, 'restaurants', tenantId, 'bills', cleanBillId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) {
      console.error(`[Razorpay Webhook] Bill ${cleanBillId} not found for tenant ${tenantId}`);
      return res.status(404).json({ error: `Bill ${cleanBillId} not found.` });
    }

    const billData = billSnap.data() as IBill;

    // 2. Cross-tenant isolation check
    if (billData.tenantId && billData.tenantId !== tenantId) {
      console.error(`[Razorpay Webhook] Cross-tenant reference rejected: ${billData.tenantId} != ${tenantId}`);
      return res.status(403).json({ error: 'Tenant mismatch on bill.' });
    }

    // 3. Webhook Idempotency Check: if already paid, return 200 immediately
    if (billData.paymentStatus === 'paid') {
      console.log(`[Razorpay Webhook] Bill ${cleanBillId} already paid. Webhook acknowledged idempotently.`);
      return res.status(200).json({ status: 'OK', alreadySettled: true });
    }

    // 4. Amount Mismatch Protection
    const amountDiff = Math.abs(verificationResult.amountInCents - billData.total);
    if (amountDiff > 10) {
      console.error(`[Razorpay Webhook] Amount mismatch! Expected: ${billData.total}, Received: ${verificationResult.amountInCents}`);
      return res.status(400).json({ error: 'Payment amount mismatch against canonical bill.' });
    }

    // 5. Authoritative Server Settlement
    await serverBillingService.settleVerifiedPayment({
      tenantId,
      orderId: orderId || billData.orderId,
      billId: cleanBillId,
      verificationResult,
      paymentAttemptId: providerOrderId
    });

    console.log(`[Razorpay Webhook] Successfully settled bill ${cleanBillId} for tenant ${tenantId}`);
    return res.status(200).json({ status: 'OK', settled: true });
  } catch (err: any) {
    console.error('[Razorpay Webhook] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Webhook processing failed.' });
  }
}
