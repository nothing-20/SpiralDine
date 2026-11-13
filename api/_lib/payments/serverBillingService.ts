import { adminDb } from '../firebaseAdmin.js';
import type { IBill } from '../../../src/shared/domain/billing/types';
import type { IPaymentVerificationResult } from '../../../src/shared/domain/payments/types';

export interface IServerSettleParams {
  tenantId: string;
  orderId: string;
  billId: string;
  verificationResult: IPaymentVerificationResult;
  paymentAttemptId?: string;
}

const ACTIVE_KITCHEN_STATUSES = new Set([
  'NEW',
  'PLACED',
  'ACCEPTED',
  'CHEF_ASSIGNED',
  'PREPARING',
  'READY',
]);

function buildPaymentBreakdown(method: string, totalAmount: number) {
  const breakdown = { cash: 0, upi: 0, card: 0, wallet: 0 };
  if (method === 'upi') breakdown.upi = totalAmount;
  else if (method === 'card') breakdown.card = totalAmount;
  else if (method === 'wallet') breakdown.wallet = totalAmount;
  else if (method === 'cash') breakdown.cash = totalAmount;
  else breakdown.upi = totalAmount;
  return breakdown;
}

export const serverBillingService = {
  /**
   * Authoritative, atomic Firestore transaction settlement for verified gateway payments.
   * Uses deterministic ledger doc ID (TXN-{billId}) + transactional bill status check so
   * concurrent verify and webhook calls never create duplicate transactions or double revenue.
   */
  settleVerifiedPayment: async (
    params: IServerSettleParams
  ): Promise<{ success: boolean; bill: IBill | null; alreadySettled: boolean }> => {
    const { tenantId, orderId, billId, verificationResult, paymentAttemptId } = params;

    const cleanBillId = billId.startsWith('BILL-') ? billId : `BILL-${billId}`;
    const restaurantRef = adminDb.collection('restaurants').doc(tenantId);
    const billRef = restaurantRef.collection('bills').doc(cleanBillId);
    const txDocId = `TXN-${cleanBillId}`;
    const txLedgerRef = restaurantRef.collection('transactions').doc(txDocId);

    const nowIso = new Date().toISOString();
    const resolvedTxRef =
      verificationResult.paymentReference ||
      verificationResult.providerPaymentId ||
      verificationResult.providerOrderId;
    const method = verificationResult.paymentMethod || 'online';
    const processedByName = `${verificationResult.provider.toUpperCase()} Verified (${verificationResult.providerOrderId})`;

    const txOutcome = await adminDb.runTransaction(async (tx) => {
      // 1. Transactional Reads First
      const billSnap = await tx.get(billRef);
      if (!billSnap.exists) {
        throw new Error(
          `[serverBillingService] Bill ${cleanBillId} does not exist for tenant ${tenantId}.`
        );
      }

      const bill = billSnap.data() as IBill;
      if (bill.tenantId && bill.tenantId !== tenantId) {
        throw new Error(
          `[serverBillingService] Cross-tenant settlement rejected: Bill belongs to ${bill.tenantId}, not ${tenantId}.`
        );
      }

      const existingLedgerSnap = await tx.get(txLedgerRef);

      if (bill.paymentStatus === 'paid') {
        return {
          alreadySettled: true,
          settledBill: { ...bill, id: billSnap.id, billId: cleanBillId },
          targetOrderId: bill.orderId || orderId,
        };
      }

      if (existingLedgerSnap.exists) {
        // Ledger already recorded by an earlier partial/concurrent path; synchronize bill flags safely
        const updatedBillOnSync: Partial<IBill> = {
          paymentStatus: 'paid',
          paidAt: bill.paidAt || nowIso,
          transactionRef: bill.transactionRef || resolvedTxRef,
        };
        tx.update(billRef, updatedBillOnSync);
        return {
          alreadySettled: true,
          settledBill: { ...bill, ...updatedBillOnSync, id: billSnap.id, billId: cleanBillId },
          targetOrderId: bill.orderId || orderId,
        };
      }

      const targetOrderId = bill.orderId || orderId;
      const orderRef = restaurantRef.collection('orders').doc(targetOrderId);
      const orderSnap = await tx.get(orderRef);

      // Query sibling orders in the same table session inside transaction if sessionId exists
      const resolvedSessionId =
        (typeof bill.sessionId === 'string' && bill.sessionId.trim()) ||
        (orderSnap.exists && typeof orderSnap.data()?.sessionId === 'string'
          ? String(orderSnap.data()?.sessionId).trim()
          : '');

      let siblingOrderDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
      if (resolvedSessionId && resolvedSessionId !== 'GUEST-SESSION') {
        const sessionOrdersQuery = restaurantRef
          .collection('orders')
          .where('sessionId', '==', resolvedSessionId);
        const sessionOrdersSnap = await tx.get(sessionOrdersQuery);
        siblingOrderDocs = sessionOrdersSnap.docs.filter((d) => d.id !== targetOrderId);
      }

      let tableRef: FirebaseFirestore.DocumentReference | null = null;
      let tableExists = false;
      let resolvedTableDocId = bill.tableId || '';
      if (!resolvedTableDocId && bill.tableNumber && bill.tableNumber !== 'Walk-in') {
        resolvedTableDocId = `TBL-${bill.tableNumber}`;
      }
      if (resolvedTableDocId) {
        tableRef = restaurantRef.collection('tables').doc(resolvedTableDocId);
        const tableSnap = await tx.get(tableRef);
        tableExists = tableSnap.exists;
      }

      let attemptRef: FirebaseFirestore.DocumentReference | null = null;
      let attemptExists = false;
      if (paymentAttemptId) {
        attemptRef = restaurantRef.collection('paymentAttempts').doc(paymentAttemptId);
        const attemptSnap = await tx.get(attemptRef);
        attemptExists = attemptSnap.exists;
      }

      // 2. Transactional Writes (Atomic all-or-nothing)
      const breakdown = buildPaymentBreakdown(method, bill.total);
      const updatedBillData: Partial<IBill> = {
        paymentStatus: 'paid',
        paymentMethod: method,
        paymentMethods: breakdown,
        paidAt: nowIso,
        transactionRef: resolvedTxRef,
        processedBy: 'system-payment-gateway',
        processedByName,
        processedByRole: 'system',
        notes: `Verified online payment via ${verificationResult.provider.toUpperCase()} (${
          verificationResult.providerPaymentId || verificationResult.providerOrderId
        })`,
      };

      tx.update(billRef, updatedBillData);

      const buildOrderUpdatePayload = (existingData: Record<string, unknown> | undefined) => {
        const currentStatus = String(existingData?.status || '').toUpperCase();
        const shouldCompleteStatus =
          currentStatus !== 'COMPLETED' &&
          currentStatus !== 'CANCELLED' &&
          currentStatus !== 'ARCHIVED' &&
          !ACTIVE_KITCHEN_STATUSES.has(currentStatus);

        return {
          paymentStatus: 'paid',
          paidAt: nowIso,
          ...(shouldCompleteStatus ? { status: 'COMPLETED' } : {}),
          paymentMethod: method,
          paymentMethods: breakdown,
          transactionRef: resolvedTxRef,
          processedBy: 'system-payment-gateway',
          processedByName,
          processedByRole: 'system',
          updatedAt: nowIso,
        };
      };

      if (orderSnap.exists) {
        tx.update(orderRef, buildOrderUpdatePayload(orderSnap.data()));
      }

      for (const siblingDoc of siblingOrderDocs) {
        const siblingData = siblingDoc.data();
        const siblingStatus = String(siblingData?.status || '').toUpperCase();
        if (siblingStatus !== 'CANCELLED' && siblingStatus !== 'ARCHIVED') {
          tx.update(siblingDoc.ref, buildOrderUpdatePayload(siblingData));
        }
      }

      if (tableRef && tableExists) {
        tx.update(tableRef, {
          status: 'cleaning',
          cleaningStartedAt: nowIso,
          updatedAt: nowIso,
        });
      }

      tx.set(txLedgerRef, {
        id: txDocId,
        transactionId: txDocId,
        billId: cleanBillId,
        orderId: targetOrderId,
        tenantId,
        branchId: bill.branchId || 'main',
        tableNumber: bill.tableNumber || '',
        invoiceNumber: bill.invoiceNumber || '',
        items: bill.items || [],
        subtotal: bill.subtotal || 0,
        discount: bill.discount || 0,
        tax: bill.tax || 0,
        serviceCharge: bill.serviceCharge || 0,
        tip: bill.tip || 0,
        roundOff: bill.roundOff || 0,
        total: bill.total || 0,
        paymentStatus: 'paid',
        paymentMethods: breakdown,
        paymentMethod: method,
        transactionRef: resolvedTxRef,
        provider: verificationResult.provider,
        providerOrderId: verificationResult.providerOrderId,
        providerPaymentId: verificationResult.providerPaymentId || '',
        processedBy: 'system-payment-gateway',
        processedByName,
        processedByRole: 'system',
        createdAt: nowIso,
      });

      if (attemptRef && attemptExists) {
        tx.update(attemptRef, {
          status: 'SUCCESS',
          verificationStatus: 'verified',
          providerPaymentId: verificationResult.providerPaymentId || '',
          paymentMethod: method,
          verifiedAt: nowIso,
          updatedAt: nowIso,
        });
      }

      return {
        alreadySettled: false,
        settledBill: { ...bill, ...updatedBillData, id: cleanBillId, billId: cleanBillId },
        targetOrderId,
      };
    });

    // Non-blocking cleanup for active waiterRequests after atomic settlement
    if (!txOutcome.alreadySettled && txOutcome.settledBill.tableNumber) {
      try {
        const requestsSnap = await restaurantRef
          .collection('waiterRequests')
          .where('tableNumber', '==', String(txOutcome.settledBill.tableNumber))
          .get();
        if (!requestsSnap.empty) {
          const batch = adminDb.batch();
          let updates = 0;
          requestsSnap.forEach((docSnap) => {
            const reqData = docSnap.data();
            const status = String(reqData.status || '').toLowerCase();
            if (status !== 'completed' && status !== 'dismissed' && status !== 'resolved') {
              batch.update(docSnap.ref, {
                status: 'completed',
                resolvedAt: nowIso,
                resolvedBy: 'system-payment-gateway',
              });
              updates += 1;
            }
          });
          if (updates > 0) {
            await batch.commit();
          }
        }
      } catch (cleanupErr) {
        console.warn('[serverBillingService] Non-blocking waiterRequest cleanup note:', cleanupErr);
      }
    }

    return {
      success: true,
      bill: txOutcome.settledBill,
      alreadySettled: txOutcome.alreadySettled,
    };
  },
};
