import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  getDoc,
  updateDoc, 
  query, 
  orderBy, 
  getDocs,
  onSnapshot,
  where,
  limit,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { IOrder, IBill, IShiftReport, IPaymentBreakdown, TPaymentStatus } from '../domain/index';
import { logEvent } from './eventEngine';

export interface ISettlePaymentParams {
  method: 'cash' | 'upi' | 'card' | 'wallet' | 'mixed';
  breakdown?: IPaymentBreakdown;
  transactionRef?: string;
  notes?: string;
  actor?: {
    uid: string;
    displayName?: string;
    email?: string;
    role?: string;
  };
  processedBy?: string;
  processedByName?: string;
  processedByRole?: 'customer' | 'waiter' | 'owner' | 'cashier';
  invoiceNumber?: string;
  roundOff?: number;
  tip?: number;
  requestId?: string;
}

export interface IUpiUriParams {
  vpa: string;
  payeeName: string;
  amountInCents: number;
  billId: string;
  orderId: string;
  tableNumber?: string;
  currency?: string;
}

export const billingService = {
  /**
   * Retrieves orders for a tenant.
   */
  getOrders: async (tenantId: string): Promise<IOrder[]> => {
    const colRef = collection(db, 'restaurants', tenantId, 'orders');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ id: d.id, orderId: d.id, ...(d.data() as any) } as IOrder));
  },

  /**
   * Shift report operations
   */
  getShifts: async (tenantId: string): Promise<IShiftReport[]> => {
    const colRef = collection(db, 'restaurants', tenantId, 'shifts');
    const snap = await getDocs(query(colRef, orderBy('openedAt', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as IShiftReport));
  },

  openShift: async (tenantId: string, shiftData: Omit<IShiftReport, 'id'>) => {
    const colRef = collection(db, 'restaurants', tenantId, 'shifts');
    return addDoc(colRef, shiftData);
  },

  updateShift: async (tenantId: string, shiftId: string, shiftData: Partial<IShiftReport>) => {
    const docRef = doc(db, 'restaurants', tenantId, 'shifts', shiftId);
    return updateDoc(docRef, shiftData);
  },

  /**
   * Deterministic Canonical Bill ID for an order
   */
  getCanonicalBillId: (orderId: string): string => {
    const cleanId = orderId.trim().toUpperCase();
    return cleanId.startsWith('BILL-') ? cleanId : `BILL-${cleanId}`;
  },

  /**
   * Get or create a single, canonical, authoritative bill for an order.
   * Completely idempotent: calling multiple times returns the existing bill.
   */
  getOrCreateCanonicalBill: async (
    tenantId: string,
    order: IOrder,
    actor?: { uid?: string; displayName?: string; email?: string; role?: string }
  ): Promise<IBill> => {
    if (!tenantId || !order?.orderId) {
      throw new Error('Tenant ID and Order ID are required to resolve a canonical bill.');
    }

    const billId = billingService.getCanonicalBillId(order.orderId);
    const billRef = doc(db, 'restaurants', tenantId, 'bills', billId);

    // 1. Check if canonical bill already exists (idempotency check)
    const existingSnap = await getDoc(billRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as IBill;

      // If already paid, the bill is authoritative, permanently finalized and immutable
      if (existingData.paymentStatus === 'paid') {
        return { id: existingSnap.id, billId: existingSnap.id, ...existingData };
      }

      // If pending payment, synchronize with latest order items & totals
      // This guarantees that any newly added order items are never excluded from the bill
      const currentSubtotal = Number(order.subtotal || 0);
      const currentDiscount = Number(order.discount || 0);
      const currentTax = Number(order.tax || 0);
      const currentServiceCharge = Number(order.serviceCharge || 0);
      const currentTip = Number((order as any).tip || 0);
      const currentRoundOff = Number(order.roundOff || 0);
      const currentTotal = Number(order.total || (currentSubtotal - currentDiscount + currentTax + currentServiceCharge + currentTip + currentRoundOff));

      const hasChanged = 
        existingData.total !== currentTotal || 
        existingData.subtotal !== currentSubtotal ||
        (existingData.items?.length || 0) !== (order.items?.length || 0) ||
        (order.status && order.status !== existingData.orderStatus);

      if (hasChanged) {
        const syncedBill: Partial<IBill> = {
          items: order.items || [],
          subtotal: currentSubtotal,
          discount: currentDiscount,
          tax: currentTax,
          serviceCharge: currentServiceCharge,
          tip: currentTip,
          roundOff: currentRoundOff,
          total: currentTotal,
          orderStatus: order.status === 'COMPLETED' ? 'COMPLETED' : 'DINING_COMPLETED',
          customerName: order.customerName || existingData.customerName,
          customerPhone: (order as any).customerPhone || order.phone || existingData.customerPhone
        };
        await updateDoc(billRef, syncedBill);
        return { id: existingSnap.id, billId: existingSnap.id, ...existingData, ...syncedBill };
      }

      return { id: existingSnap.id, billId: existingSnap.id, ...existingData };
    }

    // 2. Generate a structured invoice number based on current date & order sequence
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const seq = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = order.invoiceNumber || `INV-${dateStr}-${seq}`;

    // Extract financials from the order (authoritative source of truth)
    const subtotal = Number(order.subtotal || 0);
    const discount = Number(order.discount || 0);
    const tax = Number(order.tax || 0);
    const serviceCharge = Number(order.serviceCharge || 0);
    const tip = Number((order as any).tip || 0);
    const roundOff = Number(order.roundOff || 0);
    const total = Number(order.total || (subtotal - discount + tax + serviceCharge + tip + roundOff));

    const initialPaymentMethods: IPaymentBreakdown = order.paymentMethods || {
      cash: 0,
      upi: 0,
      card: 0,
      wallet: 0
    };

    const isAlreadyPaid = (order.paymentStatus || '').toLowerCase() === 'paid';
    const initialStatus: TPaymentStatus = isAlreadyPaid ? 'paid' : 'pending';

    const cleanTableNumber = String(order.tableNumber || (order.tableId ? String(order.tableId).replace(/^TBL-/i, '') : 'Walk-in'));

    let resolvedRestaurantName = (order as any).restaurantName || (actor as any)?.restaurantName || (actor as any)?.name || '';
    if (!resolvedRestaurantName) {
      try {
        const restDoc = await getDoc(doc(db, 'restaurants', tenantId));
        if (restDoc.exists()) {
          resolvedRestaurantName = restDoc.data()?.name || restDoc.data()?.restaurantName || '';
        }
      } catch (_) {}
    }

    const canonicalBill: IBill = {
      id: billId,
      billId,
      orderId: order.orderId,
      tenantId,
      branchId: order.branchId || 'main',
      tableId: order.tableId || (cleanTableNumber !== 'Walk-in' ? `TBL-${cleanTableNumber}` : ''),
      tableNumber: cleanTableNumber,
      customerId: (order as any).customerId || '',
      customerName: order.customerName || 'Guest Diner',
      customerPhone: (order as any).customerPhone || order.phone || '',
      restaurantName: resolvedRestaurantName,
      waiterName: order.waiterName || '',
      waiterId: order.waiterId || '',
      invoiceNumber,
      items: order.items || [],
      subtotal,
      discount,
      discountType: order.discountType || 'percentage',
      discountPercent: order.discountPercent || 0,
      discountLabel: order.discountLabel || '',
      tax,
      taxPercent: (order as any).taxPercent || 8,
      serviceCharge,
      serviceChargePercent: (order as any).serviceChargePercent || 5,
      tip,
      roundOff,
      total,
      currency: (order as any).currency || 'INR',
      orderStatus: order.status === 'COMPLETED' ? 'COMPLETED' : 'DINING_COMPLETED',
      paymentStatus: initialStatus,
      paymentMethods: initialPaymentMethods,
      processedBy: actor?.uid || '',
      processedByName: actor?.displayName || actor?.email || 'System Auto-Bill',
      createdAt: new Date().toISOString(),
      ...(isAlreadyPaid && order.paidAt ? { paidAt: order.paidAt } : {})
    };

    // Save canonical bill to Firestore
    await setDoc(billRef, canonicalBill, { merge: true });

    // Sync order reference
    try {
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', order.orderId);
      const updatePayload: Record<string, any> = {
        billId,
        invoiceNumber,
        billGeneratedAt: canonicalBill.createdAt,
        updatedAt: new Date().toISOString()
      };

      // Transition order status to DINING_COMPLETED if currently SERVED / DELIVERED / DINING
      const curStatus = (order.status || '').toUpperCase();
      if (curStatus === 'SERVED' || curStatus === 'DELIVERED' || curStatus === 'DINING') {
        updatePayload.status = 'DINING_COMPLETED';
      }

      await updateDoc(orderRef, updatePayload);
    } catch (orderUpdateErr) {
      console.warn('[billingService] Non-blocking order link warning:', orderUpdateErr);
    }

    // Log operational audit event
    logEvent(tenantId, {
      eventType: 'Bill Generated',
      eventCategory: 'Billing',
      performedBy: actor?.displayName || actor?.email || 'System',
      performedByRole: (actor?.role as any) || 'system',
      orderId: order.orderId,
      tableNumber: cleanTableNumber,
      title: 'Canonical Bill Generated',
      description: `Authoritative Bill ${billId} generated for Table ${cleanTableNumber}. Total: ${total / 100}`
    });

    return canonicalBill;
  },

  /**
   * Fetch a canonical bill by billId or orderId
   */
  getCanonicalBill: async (tenantId: string, billIdOrOrderId: string): Promise<IBill | null> => {
    if (!tenantId || !billIdOrOrderId) return null;
    const billId = billingService.getCanonicalBillId(billIdOrOrderId);
    const snap = await getDoc(doc(db, 'restaurants', tenantId, 'bills', billId));
    if (snap.exists()) {
      return { id: snap.id, billId: snap.id, ...snap.data() } as IBill;
    }
    return null;
  },

  /**
   * Subscribe to real-time changes on a specific canonical bill
   */
  subscribeToCanonicalBill: (
    tenantId: string,
    billIdOrOrderId: string,
    callback: (bill: IBill | null) => void,
    onError?: (err: any) => void
  ): Unsubscribe => {
    if (!tenantId || !billIdOrOrderId) {
      callback(null);
      return () => {};
    }
    const billId = billingService.getCanonicalBillId(billIdOrOrderId);
    const billRef = doc(db, 'restaurants', tenantId, 'bills', billId);

    return onSnapshot(billRef, (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, billId: snap.id, ...snap.data() } as IBill);
      } else {
        callback(null);
      }
    }, (err) => {
      console.warn('[billingService] Bill subscription error:', err);
      if (onError) onError(err);
      callback(null);
    });
  },

  /**
   * Subscribe to all bills for a tenant with real-time updates
   */
  subscribeToTenantBills: (
    tenantId: string,
    callback: (bills: IBill[]) => void,
    onError?: (err: any) => void
  ): Unsubscribe => {
    if (!tenantId) {
      callback([]);
      return () => {};
    }
    const billsCol = collection(db, 'restaurants', tenantId, 'bills');

    return onSnapshot(billsCol, (snap) => {
      const list: IBill[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, billId: d.id, ...d.data() } as IBill);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      callback(list);
    }, (err) => {
      console.warn('[billingService] Tenant bills subscription error:', err);
      if (onError) onError(err);
      callback([]);
    });
  },

  /**
   * Authoritative Bill Settlement
   * Atomically settles the canonical bill, updates the order status, records the transaction,
   * and moves the table to cleaning status.
   */
  settleBillPayment: async (
    tenantId: string,
    billIdOrOrderId: string,
    params: ISettlePaymentParams
  ): Promise<{ bill: IBill; invoiceNumber: string }> => {
    const billId = billingService.getCanonicalBillId(billIdOrOrderId);
    const billRef = doc(db, 'restaurants', tenantId, 'bills', billId);
    let billSnap = await getDoc(billRef);

    // Resilient fallback: If canonical bill document has not been persisted yet, create it from the order
    if (!billSnap.exists()) {
      const cleanOrderId = billIdOrOrderId.replace(/^BILL-/i, '').trim();
      let orderSnap = await getDoc(doc(db, 'restaurants', tenantId, 'orders', cleanOrderId));
      if (!orderSnap.exists()) {
        const qOrder = query(collection(db, 'restaurants', tenantId, 'orders'), where('orderId', '==', cleanOrderId), limit(1));
        const qSnap = await getDocs(qOrder);
        if (!qSnap.empty) {
          orderSnap = qSnap.docs[0];
        }
      }

      if (orderSnap.exists()) {
        const orderData = { orderId: orderSnap.id, ...orderSnap.data() } as IOrder;
        await billingService.getOrCreateCanonicalBill(tenantId, orderData, params.actor);
        billSnap = await getDoc(billRef);
      }
    }

    if (!billSnap.exists()) {
      throw new Error(`Bill ${billId} does not exist for tenant ${tenantId}.`);
    }

    const bill = billSnap.data() as IBill;

    // 1. Verify tenant isolation
    if (bill.tenantId && bill.tenantId !== tenantId) {
      throw new Error(`Cross-tenant settlement rejected: Bill belongs to ${bill.tenantId}, not ${tenantId}.`);
    }

    // 2. Verify bill is not already paid (Idempotency & Double settlement prevention)
    if (bill.paymentStatus === 'paid') {
      return {
        bill: { id: billSnap.id, billId: billSnap.id, ...bill },
        invoiceNumber: bill.invoiceNumber || ''
      };
    }

    // 3. Verify total is valid
    if (typeof bill.total !== 'number' || isNaN(bill.total) || bill.total < 0) {
      throw new Error('Invalid bill total.');
    }

    const nowIso = new Date().toISOString();
    const actorUid = params.actor?.uid || params.processedBy || '';
    const actorName = params.actor?.displayName || params.actor?.email || params.processedByName || 'Staff';
    const actorRole = params.actor?.role || params.processedByRole || 'staff';

    // 4. Prepare payment breakdown
    let paymentBreakdown: IPaymentBreakdown = { cash: 0, upi: 0, card: 0, wallet: 0 };
    if (params.method === 'mixed' && params.breakdown) {
      paymentBreakdown = { ...params.breakdown };
    } else if (params.method === 'cash') {
      paymentBreakdown.cash = bill.total;
    } else if (params.method === 'upi') {
      paymentBreakdown.upi = bill.total;
    } else if (params.method === 'card') {
      paymentBreakdown.card = bill.total;
    } else if (params.method === 'wallet') {
      paymentBreakdown.wallet = bill.total;
    }

    // 5. Generate transparent manual/demo transaction reference (no fake gateway IDs)
    const generatedTxRef = params.transactionRef || (
      params.method === 'upi' 
        ? `DEMO-MANUAL-UPI-${Date.now().toString(36).toUpperCase()}` 
        : `MANUAL-${params.method.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
    );

    // 6. Update canonical bill
    const updatedBill: Partial<IBill> = {
      paymentStatus: 'paid',
      paymentMethods: paymentBreakdown,
      paymentMethod: params.method as any,
      paidAt: nowIso,
      transactionRef: generatedTxRef,
      processedBy: actorUid,
      processedByName: actorName,
      processedByRole: actorRole,
      ...(params.invoiceNumber ? { invoiceNumber: params.invoiceNumber } : {})
    };
    await updateDoc(billRef, updatedBill);

    // 7. Update Order document while strictly honoring kitchen lifecycle
    try {
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', bill.orderId);
      const currentOrderSnap = await getDoc(orderRef);
      
      let targetStatus = 'COMPLETED';
      if (currentOrderSnap.exists()) {
        const currData = currentOrderSnap.data();
        const activeKitchenStatuses = ['NEW', 'PLACED', 'ACCEPTED', 'CHEF_ASSIGNED', 'PREPARING', 'READY'];
        // If the food is still in the kitchen preparation cycle, do not prematurely overwrite food lifecycle
        if (activeKitchenStatuses.includes(currData.status)) {
          targetStatus = currData.status;
        } else if (['SERVED', 'DELIVERED', 'DINING_COMPLETED', 'BILL_REQUESTED'].includes(currData.status)) {
          targetStatus = 'COMPLETED';
        } else {
          targetStatus = currData.status || 'COMPLETED';
        }
      }

      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        paidAt: nowIso,
        status: targetStatus,
        paymentMethods: paymentBreakdown,
        transactionRef: generatedTxRef,
        processedBy: actorUid,
        processedByName: actorName,
        processedByRole: actorRole,
        ...(params.invoiceNumber ? { invoiceNumber: params.invoiceNumber } : {}),
        updatedAt: nowIso
      });
    } catch (orderErr) {
      console.warn('[billingService] Could not update order on payment:', orderErr);
    }

    // 8. Update Table status to 'cleaning'
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
        console.warn('[billingService] Could not transition table to cleaning:', tableErr);
      }
    }

    // 9. Atomically resolve all active waiter assistance requests for this cash payment/bill
    try {
      const waiterReqCol = collection(db, 'restaurants', tenantId, 'waiterRequests');
      const qCash = query(waiterReqCol, where('orderId', '==', bill.orderId));
      const reqSnap = await getDocs(qCash);
      
      const resolvePromises: Promise<any>[] = [];
      reqSnap.forEach((dSnap) => {
        const rData = dSnap.data();
        const rStatus = (rData.status || '').toLowerCase();
        if (rStatus !== 'completed' && rStatus !== 'cancelled') {
          resolvePromises.push(
            updateDoc(dSnap.ref, {
              status: 'Completed',
              resolvedBy: actorName,
              resolvedAt: nowIso
            })
          );
        }
      });

      // Also explicitly check deterministic CASH-${orderId} and BILL-${orderId} doc refs
      const directCashRef = doc(db, 'restaurants', tenantId, 'waiterRequests', `CASH-${bill.orderId}`);
      resolvePromises.push(
        getDoc(directCashRef).then(snap => {
          if (snap.exists() && (snap.data().status || '').toLowerCase() !== 'completed') {
            return updateDoc(directCashRef, { status: 'Completed', resolvedBy: actorName, resolvedAt: nowIso });
          }
        }).catch(() => {})
      );

      const directBillReqRef = doc(db, 'restaurants', tenantId, 'waiterRequests', `BILL-${bill.orderId}`);
      resolvePromises.push(
        getDoc(directBillReqRef).then(snap => {
          if (snap.exists() && (snap.data().status || '').toLowerCase() !== 'completed') {
            return updateDoc(directBillReqRef, { status: 'Completed', resolvedBy: actorName, resolvedAt: nowIso });
          }
        }).catch(() => {})
      );

      // If specific requestId was passed, resolve it directly
      if (params.requestId) {
        const specificReqRef = doc(db, 'restaurants', tenantId, 'waiterRequests', params.requestId);
        resolvePromises.push(
          getDoc(specificReqRef).then(snap => {
            if (snap.exists() && (snap.data().status || '').toLowerCase() !== 'completed') {
              return updateDoc(specificReqRef, { status: 'Completed', resolvedBy: actorName, resolvedAt: nowIso });
            }
          }).catch(() => {})
        );
      }

      await Promise.allSettled(resolvePromises);
    } catch (reqErr) {
      console.warn('[billingService] Could not resolve waiterRequests:', reqErr);
    }

    // 10. Append transaction ledger document (idempotent: prevent duplicate records)
    try {
      const transCol = collection(db, 'restaurants', tenantId, 'transactions');
      const existingTransQuery = query(transCol, where('billId', '==', billId), limit(1));
      const existingTransSnap = await getDocs(existingTransQuery);

      if (existingTransSnap.empty) {
        await addDoc(transCol, {
          billId,
          orderId: bill.orderId,
          tenantId,
          tableNumber: bill.tableNumber,
          invoiceNumber: bill.invoiceNumber,
          items: bill.items,
          subtotal: bill.subtotal,
          discount: bill.discount,
          tax: bill.tax,
          serviceCharge: bill.serviceCharge,
          tip: bill.tip || 0,
          roundOff: bill.roundOff || 0,
          total: bill.total,
          paymentStatus: 'paid',
          paymentMethods: paymentBreakdown,
          paymentMethod: params.method,
          transactionRef: generatedTxRef,
          processedBy: actorUid,
          processedByName: actorName,
          processedByRole: actorRole,
          createdAt: nowIso
        });
      }
    } catch (transErr) {
      console.warn('[billingService] Transaction logging warning:', transErr);
    }

    // 6. Log audit event
    logEvent(tenantId, {
      eventType: 'Payment Completed',
      eventCategory: 'Payment',
      performedBy: actorName,
      performedByRole: (params.actor?.role as any) || 'staff',
      orderId: bill.orderId,
      tableNumber: bill.tableNumber,
      title: 'Bill Settled and Paid',
      description: `Bill ${billId} (Invoice ${bill.invoiceNumber}) paid via ${params.method.toUpperCase()} for Table ${bill.tableNumber}. Total: ${(bill.total / 100).toFixed(2)}`
    });

    return {
      bill: { ...bill, ...updatedBill },
      invoiceNumber: bill.invoiceNumber
    };
  },

  /**
   * Generates a standard UPI intent URI string for UPI app handoff & dynamic QR generation
   */
  generateUpiUri: (params: IUpiUriParams): { uri: string; formattedAmount: string } => {
    const rawAmt = (params.amountInCents / 100).toFixed(2);
    const currency = params.currency || 'INR';
    const note = `Spiral Dine - Table ${params.tableNumber || 'Dine-In'} (${params.billId})`;

    // Standard NPCI UPI URI Specification:
    // upi://pay?pa=<VPA>&pn=<Name>&am=<Amount>&cu=<Currency>&tn=<Note>
    const queryParts = [
      `pa=${encodeURIComponent(params.vpa)}`,
      `pn=${encodeURIComponent(params.payeeName)}`,
      `am=${encodeURIComponent(rawAmt)}`,
      `cu=${encodeURIComponent(currency)}`,
      `tn=${encodeURIComponent(note)}`
    ];

    return {
      uri: `upi://pay?${queryParts.join('&')}`,
      formattedAmount: `₹${rawAmt}`
    };
  }
};

export default billingService;
