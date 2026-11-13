import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, FirebaseAdminInitError } from '../_lib/firebaseAdmin.js';
import { AuthError, handleAuthError } from '../_lib/authMiddleware.js';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { PaymentFactory } from '../_lib/payments/paymentFactory.js';
import { authorizePaymentActor } from '../_lib/payments/paymentAuthorization.js';
import type { IBill } from '../../src/shared/domain/billing/types';
import type { IPaymentAttempt } from '../../src/shared/domain/payments/types';

interface CreateOrderBody {
  tenantId?: string;
  orderId?: string;
  billId?: string;
  sessionId?: string;
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
}

function isAlreadyExistsError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: unknown; message?: unknown };
  return (
    record.code === 6 ||
    record.code === 'already-exists' ||
    (typeof record.message === 'string' && record.message.toLowerCase().includes('already exists'))
  );
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
      keyPrefix: 'payments_create_order',
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
      customer,
    } = (req.body || {}) as CreateOrderBody;

    const tenantId = typeof rawTenantId === 'string' ? rawTenantId.trim() : '';
    const orderId = typeof rawOrderId === 'string' ? rawOrderId.trim() : '';

    if (!tenantId || !orderId) {
      return res.status(400).json({ error: 'tenantId and orderId are required.' });
    }

    // 1. Resolve canonical bill ID
    const cleanIncomingBillId =
      typeof incomingBillId === 'string' && incomingBillId.trim() ? incomingBillId.trim() : '';
    const billId =
      cleanIncomingBillId ||
      (orderId.toUpperCase().startsWith('BILL-')
        ? orderId.toUpperCase()
        : `BILL-${orderId.toUpperCase()}`);

    // 2. Fetch canonical bill or order from Firestore via Admin SDK
    const billRef = adminDb.collection('restaurants').doc(tenantId).collection('bills').doc(billId);
    const billSnap = await billRef.get();

    let billData: IBill | null = null;
    let fallbackOrderData: Record<string, unknown> | null = null;
    let needsBillPersistence = false;

    if (billSnap.exists) {
      billData = billSnap.data() as IBill;
    } else {
      const orderRef = adminDb
        .collection('restaurants')
        .doc(tenantId)
        .collection('orders')
        .doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        return res.status(404).json({
          error: `Neither Bill ${billId} nor Order ${orderId} was found for tenant ${tenantId}.`,
        });
      }
      const o = (orderSnap.data() as Record<string, unknown>) || {};
      fallbackOrderData = o;
      const paymentStatus =
        o.paymentStatus === 'paid' || o.paymentStatus === 'refunded'
          ? o.paymentStatus
          : 'pending';
      billData = {
        id: billId,
        billId,
        orderId,
        tenantId,
        branchId: typeof o.branchId === 'string' && o.branchId ? o.branchId : 'main',
        tableId: typeof o.tableId === 'string' ? o.tableId : '',
        sessionId: typeof o.sessionId === 'string' ? o.sessionId : '',
        customerId: typeof o.customerId === 'string' ? o.customerId : '',
        total: Math.round(Number(o.total || 0)),
        currency: typeof o.currency === 'string' ? o.currency : 'INR',
        paymentStatus,
        orderStatus: typeof o.status === 'string' ? o.status : 'DINING_COMPLETED',
        customerName:
          (typeof o.customerName === 'string' && o.customerName) ||
          customer?.name ||
          'Guest Diner',
        customerPhone: (typeof o.phone === 'string' && o.phone) || customer?.phone || '',
        items: Array.isArray(o.items) ? (o.items as IBill['items']) : [],
        subtotal: Math.round(Number(o.subtotal || 0)),
        tax: Math.round(Number(o.tax || 0)),
        taxPercent: Number(o.taxPercent ?? 8),
        serviceCharge: Math.round(Number(o.serviceCharge || 0)),
        serviceChargePercent: Number(o.serviceChargePercent ?? 5),
        discount: Math.round(Number(o.discount || 0)),
        tableNumber: String(o.tableNumber || ''),
        invoiceNumber:
          typeof o.invoiceNumber === 'string' ? o.invoiceNumber : `INV-${orderId}`,
        createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
        paymentMethods: { cash: 0, upi: 0, card: 0, wallet: 0 },
      };
      needsBillPersistence = true;
    }

    if (!billData) {
      return res.status(404).json({ error: 'Bill could not be resolved.' });
    }

    // 3. Verify bill tenant alignment
    if (billData.tenantId && billData.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Tenant mismatch on bill.' });
    }

    // 4. Enforce Firebase ID Token Authentication + Tenant/Branch/Customer Authorization
    const authUser = await authorizePaymentActor({
      req,
      tenantId,
      orderId,
      billData,
      orderData: fallbackOrderData,
      requestSessionId: typeof requestSessionId === 'string' ? requestSessionId : undefined,
    });

    // Persist missing canonical bill atomically so /verify and /webhook always find it
    if (needsBillPersistence) {
      try {
        await billRef.create(billData);
      } catch (createErr: unknown) {
        if (isAlreadyExistsError(createErr)) {
          const latestSnap = await billRef.get();
          if (latestSnap.exists) {
            billData = latestSnap.data() as IBill;
          }
        } else {
          throw createErr;
        }
      }
    }

    // 5. Verify bill is payable
    if (billData.paymentStatus === 'paid') {
      return res.status(400).json({
        error: 'Bill has already been paid and settled.',
        alreadyPaid: true,
        billId,
      });
    }

    if (billData.orderStatus === 'CANCELLED' || billData.orderStatus === 'ARCHIVED') {
      return res.status(400).json({ error: 'Cannot pay a cancelled or archived order.' });
    }

    // 6. Authoritative amount enforcement (integer subunits: paise/cents)
    const amountInCents = Math.round(Number(billData.total));
    if (!Number.isFinite(amountInCents) || amountInCents <= 0) {
      return res.status(400).json({ error: `Invalid bill payable amount: ${amountInCents}` });
    }

    const currency = String(billData.currency || 'INR').toUpperCase();

    // 7. Resolve payment provider for this tenant and create provider order
    const provider = PaymentFactory.getProviderForTenant(tenantId);
    const nowIso = new Date().toISOString();
    const resolvedCustomerId = billData.customerId || authUser.uid;

    const orderResult = await provider.createPaymentOrder({
      tenantId,
      branchId: billData.branchId || 'main',
      orderId: billData.orderId || orderId,
      billId,
      amountInCents,
      currency,
      customer: {
        id: resolvedCustomerId,
        name: customer?.name || billData.customerName || 'Guest Diner',
        email: customer?.email || authUser.email || '',
        phone: customer?.phone || billData.customerPhone || '',
      },
    });

    // 8. Persist Payment Attempt record bound to tenantId, billId, orderId, amount, and caller UID
    const attemptId = orderResult.providerOrderId;
    const attemptRef = adminDb
      .collection('restaurants')
      .doc(tenantId)
      .collection('paymentAttempts')
      .doc(attemptId);
    const attemptData: IPaymentAttempt & { createdByUid?: string } = {
      attemptId,
      tenantId,
      branchId: billData.branchId || 'main',
      orderId: billData.orderId || orderId,
      billId,
      provider: provider.name,
      providerOrderId: orderResult.providerOrderId,
      amount: amountInCents,
      amountInRupees: Number((amountInCents / 100).toFixed(2)),
      currency,
      status: 'PENDING',
      verificationStatus: 'unverified',
      customerId: resolvedCustomerId,
      customerName: customer?.name || billData.customerName || '',
      customerPhone: customer?.phone || billData.customerPhone || '',
      customerEmail: customer?.email || authUser.email || '',
      createdByUid: authUser.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await attemptRef.set(attemptData, { merge: true });

    const providerWithKey = provider as unknown as { keyId?: string };

    // 9. Return safe response to client
    return res.status(200).json({
      success: true,
      provider: provider.name,
      providerOrderId: orderResult.providerOrderId,
      keyId:
        providerWithKey.keyId ||
        process.env.VITE_RAZORPAY_KEY_ID ||
        process.env.RAZORPAY_KEY_ID ||
        '',
      amount: amountInCents,
      amountInRupees: Number((amountInCents / 100).toFixed(2)),
      currency,
      orderId: billData.orderId || orderId,
      billId,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError || err instanceof FirebaseAdminInitError) {
      return handleAuthError(res, err);
    }
    const message = err instanceof Error ? err.message : 'Failed to create payment order.';
    console.error('[API /payments/create-order] Error:', err);
    return res.status(500).json({
      error: message,
    });
  }
}
