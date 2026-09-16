import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, doc, getDoc, setDoc, ensureServerAuth } from '../_lib/firebaseServer.js';
import { PaymentFactory } from '../_lib/payments/paymentFactory.js';
import type { IBill } from '../../src/shared/domain/billing/types';
import type { IPaymentAttempt } from '../../src/shared/domain/payments/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enforce POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { tenantId, orderId, billId: incomingBillId, customer } = req.body || {};

    if (!tenantId || !orderId) {
      return res.status(400).json({ error: 'tenantId and orderId are required.' });
    }

    await ensureServerAuth();

    // 1. Resolve canonical bill ID
    const billId = incomingBillId || (orderId.toUpperCase().startsWith('BILL-') ? orderId.toUpperCase() : `BILL-${orderId.toUpperCase()}`);

    // 2. Fetch canonical bill from Firestore
    const billRef = doc(db, 'restaurants', tenantId, 'bills', billId);
    const billSnap = await getDoc(billRef);

    let billData: IBill | null = null;

    if (billSnap.exists()) {
      billData = billSnap.data() as IBill;
    } else {
      // Fallback: check order document to confirm validity
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        return res.status(404).json({ error: `Neither Bill ${billId} nor Order ${orderId} was found for tenant ${tenantId}.` });
      }
      const o = orderSnap.data();
      billData = {
        id: billId,
        billId,
        orderId,
        tenantId,
        total: Number(o.total || 0),
        currency: o.currency || 'INR',
        paymentStatus: (o.paymentStatus || 'pending') as any,
        orderStatus: o.status || 'DINING_COMPLETED',
        customerName: o.customerName || customer?.name || 'Guest Diner',
        customerPhone: o.phone || customer?.phone || '',
        items: o.items || [],
        subtotal: Number(o.subtotal || 0),
        tax: Number(o.tax || 0),
        taxPercent: Number(o.taxPercent || 8),
        serviceCharge: Number(o.serviceCharge || 0),
        serviceChargePercent: Number(o.serviceChargePercent || 5),
        discount: Number(o.discount || 0),
        tableNumber: String(o.tableNumber || ''),
        invoiceNumber: o.invoiceNumber || `INV-${orderId}`,
        createdAt: o.createdAt || new Date().toISOString(),
        paymentMethods: { cash: 0, upi: 0, card: 0, wallet: 0 }
      };
    }

    if (!billData) {
      return res.status(404).json({ error: 'Bill could not be resolved.' });
    }

    // 3. Verify bill tenant alignment
    if (billData.tenantId && billData.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Tenant mismatch on bill.' });
    }

    // 4. Verify bill is payable
    if (billData.paymentStatus === 'paid') {
      return res.status(400).json({
        error: 'Bill has already been paid and settled.',
        alreadyPaid: true,
        billId
      });
    }

    if (billData.orderStatus === 'CANCELLED' || billData.orderStatus === 'ARCHIVED') {
      return res.status(400).json({ error: 'Cannot pay a cancelled or archived order.' });
    }

    // 5. Authoritative amount enforcement
    // The browser must NEVER be able to supply an amount.
    const amountInCents = Number(billData.total);
    if (!amountInCents || amountInCents <= 0 || isNaN(amountInCents)) {
      return res.status(400).json({ error: `Invalid bill payable amount: ${amountInCents}` });
    }

    // 6. Resolve payment provider for this tenant
    const provider = PaymentFactory.getProviderForTenant(tenantId);

    // 7. Request provider to create payment order
    const nowIso = new Date().toISOString();
    const orderResult = await provider.createPaymentOrder({
      tenantId,
      branchId: billData.branchId || 'main',
      orderId,
      billId,
      amountInCents,
      currency: billData.currency || 'INR',
      customer: {
        id: customer?.id || billData.customerId || 'guest_diner',
        name: customer?.name || billData.customerName || 'Guest Diner',
        email: customer?.email || '',
        phone: customer?.phone || billData.customerPhone || ''
      }
    });

    // 8. Persist Payment Attempt record idempotently in Firestore
    const attemptId = orderResult.providerOrderId;
    const attemptRef = doc(db, 'restaurants', tenantId, 'paymentAttempts', attemptId);
    const attemptData: IPaymentAttempt = {
      attemptId,
      tenantId,
      branchId: billData.branchId || 'main',
      orderId,
      billId,
      provider: provider.name,
      providerOrderId: orderResult.providerOrderId,
      amount: amountInCents,
      amountInRupees: Number((amountInCents / 100).toFixed(2)),
      currency: billData.currency || 'INR',
      status: 'PENDING',
      verificationStatus: 'unverified',
      customerId: customer?.id || billData.customerId || '',
      customerName: customer?.name || billData.customerName || '',
      customerPhone: customer?.phone || billData.customerPhone || '',
      customerEmail: customer?.email || '',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await setDoc(attemptRef, attemptData, { merge: true });

    // 9. Return safe response to client
    return res.status(200).json({
      success: true,
      provider: provider.name,
      providerOrderId: orderResult.providerOrderId,
      keyId: (provider as any).keyId || process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '',
      amount: amountInCents,
      amountInRupees: Number((amountInCents / 100).toFixed(2)),
      currency: billData.currency || 'INR',
      orderId,
      billId
    });
  } catch (err: any) {
    console.error('[API /payments/create-order] Error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to create payment order.'
    });
  }
}
