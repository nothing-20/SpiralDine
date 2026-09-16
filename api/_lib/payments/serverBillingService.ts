import {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  limit,
  ensureServerAuth
} from '../firebaseServer.js';
import type { IBill } from '../../../src/shared/domain/billing/types';
import type { IPaymentVerificationResult, IPaymentAttempt } from '../../../src/shared/domain/payments/types';

export interface IServerSettleParams {
  tenantId: string;
  orderId: string;
  billId: string;
  verificationResult: IPaymentVerificationResult;
  paymentAttemptId?: string;
}

export const serverBillingService = {
  /**
   * Authoritative server-side settlement for verified gateway payments.
   * Strictly adheres to canonical billingService.settleBillPayment() semantics.
   * Completely idempotent: duplicate calls will never produce duplicate transactions or double revenue.
   */
  settleVerifiedPayment: async (params: IServerSettleParams): Promise<{ success: boolean; bill: IBill | null; alreadySettled: boolean }> => {
    const { tenantId, orderId, billId, verificationResult, paymentAttemptId } = params;

    await ensureServerAuth();

    const cleanBillId = billId.startsWith('BILL-') ? billId : `BILL-${billId}`;
    const billRef = doc(db, 'restaurants', tenantId, 'bills', cleanBillId);
    const billSnap = await getDoc(billRef);

    if (!billSnap.exists()) {
      throw new Error(`[serverBillingService] Bill ${cleanBillId} does not exist for tenant ${tenantId}.`);
    }

    const bill = billSnap.data() as IBill;

    // 1. Enforce Tenant Isolation
    if (bill.tenantId && bill.tenantId !== tenantId) {
      throw new Error(`[serverBillingService] Cross-tenant settlement rejected: Bill belongs to ${bill.tenantId}, not ${tenantId}.`);
    }

    const nowIso = new Date().toISOString();
    const resolvedTxRef = verificationResult.paymentReference || verificationResult.providerPaymentId || verificationResult.providerOrderId;
    const method = verificationResult.paymentMethod || 'online';

    // 2. Idempotency Check: if bill is already paid, return safely without duplicating transaction
    if (bill.paymentStatus === 'paid') {
      console.log(`[serverBillingService] Bill ${cleanBillId} is already marked paid. Skipping duplicate settlement.`);
      return {
        success: true,
        bill: { id: billSnap.id, billId: cleanBillId, ...bill },
        alreadySettled: true
      };
    }

    // 3. Financial breakdown mapping
    const breakdown = { cash: 0, upi: 0, card: 0, wallet: 0 };
    if (method === 'upi') breakdown.upi = bill.total;
    else if (method === 'card') breakdown.card = bill.total;
    else if (method === 'wallet') breakdown.wallet = bill.total;
    else breakdown.upi = bill.total; // Default online bucket to UPI/Digital

    // 4. Update Canonical Bill
    const updatedBillData: Partial<IBill> = {
      paymentStatus: 'paid',
      paymentMethod: method,
      paymentMethods: breakdown,
      paidAt: nowIso,
      transactionRef: resolvedTxRef,
      processedBy: 'system-payment-gateway',
      processedByName: `${verificationResult.provider.toUpperCase()} Verified (${verificationResult.providerOrderId})`,
      processedByRole: 'system',
      notes: `Verified online payment via ${verificationResult.provider.toUpperCase()} (${verificationResult.providerPaymentId || verificationResult.providerOrderId})`
    };

    await updateDoc(billRef, updatedBillData);

    // 5. Update Order Document
    try {
      const targetOrderId = bill.orderId || orderId;
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', targetOrderId);
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        paidAt: nowIso,
        status: 'COMPLETED',
        paymentMethods: breakdown,
        transactionRef: resolvedTxRef,
        processedBy: 'system-payment-gateway',
        processedByName: `${verificationResult.provider.toUpperCase()} Verified (${verificationResult.providerOrderId})`,
        processedByRole: 'system',
        updatedAt: nowIso
      });
    } catch (orderErr) {
      console.warn('[serverBillingService] Could not update order on payment settlement:', orderErr);
    }

    // 6. Transition Table to 'cleaning'
    if (bill.tableId || bill.tableNumber) {
      try {
        let tableDocId = bill.tableId;
        if (!tableDocId && bill.tableNumber && bill.tableNumber !== 'Walk-in') {
          tableDocId = `TBL-${bill.tableNumber}`;
        }
        if (tableDocId) {
          const tableRef = doc(db, 'restaurants', tenantId, 'tables', tableDocId);
          await updateDoc(tableRef, {
            status: 'cleaning',
            cleaningStartedAt: nowIso,
            updatedAt: nowIso
          });
        }
      } catch (tableErr) {
        console.warn('[serverBillingService] Could not update table status to cleaning:', tableErr);
      }
    }

    // 7. Append Transaction Ledger Document Idempotently
    try {
      const transCol = collection(db, 'restaurants', tenantId, 'transactions');
      const existingTransQuery = query(transCol, where('billId', '==', cleanBillId), limit(1));
      const existingTransSnap = await getDocs(existingTransQuery);

      if (existingTransSnap.empty) {
        await addDoc(transCol, {
          billId: cleanBillId,
          orderId: bill.orderId || orderId,
          tenantId,
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
          processedBy: 'system-payment-gateway',
          processedByName: `${verificationResult.provider.toUpperCase()} Verified (${verificationResult.providerOrderId})`,
          processedByRole: 'system',
          createdAt: nowIso
        });
      }
    } catch (transErr) {
      console.warn('[serverBillingService] Transaction ledger recording error:', transErr);
    }

    // 8. Update Payment Attempt Document if ID provided
    if (paymentAttemptId) {
      try {
        const attemptRef = doc(db, 'restaurants', tenantId, 'paymentAttempts', paymentAttemptId);
        await updateDoc(attemptRef, {
          status: 'SUCCESS',
          verificationStatus: 'verified',
          providerPaymentId: verificationResult.providerPaymentId || '',
          paymentMethod: method,
          verifiedAt: nowIso,
          updatedAt: nowIso
        });
      } catch (attErr) {
        console.warn('[serverBillingService] Could not update paymentAttempt status:', attErr);
      }
    }

    return {
      success: true,
      bill: { ...bill, ...updatedBillData, id: cleanBillId, billId: cleanBillId },
      alreadySettled: false
    };
  }
};
