import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where,
  limit
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ITable, isTableAvailable, cleanTableIdentifier } from '../domain/tables/types';
import { IOrder } from '../domain/orders/types';
import { logAuditEvent } from './auditService';
import { logEvent } from './eventEngine';

export interface IReservationRecord {
  id: string;
  bookingId?: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  restaurantId: string;
  restaurantName?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  guests: number;
  tableNumber?: string;
  tableId?: string;
  assignedTableId?: string;
  assignedTableNumber?: string;
  assignedWaiterId?: string;
  assignedWaiterName?: string;
  seatingPreference?: string;
  specialNotes?: string;
  status: 'Pending' | 'Confirmed' | 'Arrived' | 'Seated' | 'Completed' | 'Cancelled' | 'No-Show' | 'Rejected' | 'Modified';
  seatedAt?: string;
  completedAt?: string;
  diningCompleted?: boolean;
  orderId?: string;
  activeOrderId?: string;
  createdAt: string;
  updatedAt?: string;
}

// In-flight mutex set to prevent duplicate concurrent transitions for the same reservation
const inFlightCompletions = new Set<string>();

export const reservationService = {
  /**
   * Resiliently checks whether a given reservation matches a given table
   */
  matchesTable(res: IReservationRecord, table: ITable): boolean {
    if (!res || !table) return false;
    const cleanTableNum = cleanTableIdentifier(table.number || table.tableNumber || table.id);

    if (res.assignedTableId && (res.assignedTableId === table.id || res.assignedTableId === `TBL-${cleanTableNum}`)) {
      return true;
    }
    if (res.tableId && (res.tableId === table.id || res.tableId === `TBL-${cleanTableNum}`)) {
      return true;
    }

    const resAssignedNum = cleanTableIdentifier(res.assignedTableNumber || res.tableNumber);
    if (resAssignedNum && cleanTableNum && resAssignedNum === cleanTableNum) {
      return true;
    }

    return false;
  },

  /**
   * Canonical Operational Lifecycle Transition:
   * Transitions a seated reservation to COMPLETED if and only if:
   * 1. The physical table has been sanitized and released by the waiter (status is 'Available' or 'empty')
   * 2. The financial/payment lifecycle is fully settled ('paid')
   * 3. The reservation is currently 'Seated'
   */
  async completeReservationIfEligible(
    tenantId: string,
    tableIdentifier: string | number,
    options?: {
      orderId?: string;
      reservationId?: string;
      actorName?: string;
      actorRole?: string;
    }
  ): Promise<boolean> {
    if (!tenantId || (!tableIdentifier && !options?.reservationId)) return false;

    const lockKey = `${tenantId}:${tableIdentifier}:${options?.reservationId || ''}`;
    if (inFlightCompletions.has(lockKey)) return false;
    inFlightCompletions.add(lockKey);

    try {
      // 1. Fetch reservations for this tenant that are currently marked 'Seated'
      let candidateReservations: IReservationRecord[] = [];
      const resCol = collection(db, 'restaurants', tenantId, 'reservations');

      if (options?.reservationId) {
        const directSnap = await getDoc(doc(db, 'restaurants', tenantId, 'reservations', options.reservationId));
        if (directSnap.exists()) {
          const data = { id: directSnap.id, ...directSnap.data() } as IReservationRecord;
          if (data.status === 'Seated') {
            candidateReservations.push(data);
          }
        }
      }

      if (candidateReservations.length === 0) {
        const qSeated = query(resCol, where('status', '==', 'Seated'), limit(20));
        const seatedSnap = await getDocs(qSeated);
        seatedSnap.forEach(d => {
          candidateReservations.push({ id: d.id, ...d.data() } as IReservationRecord);
        });
      }

      if (candidateReservations.length === 0) {
        return false;
      }

      // 2. Fetch table details to verify physical floor release
      const cleanNum = cleanTableIdentifier(tableIdentifier);
      const tablesCol = collection(db, 'restaurants', tenantId, 'tables');
      const tablesSnap = await getDocs(tablesCol);
      let foundTable: ITable | null = null;

      for (const d of tablesSnap.docs) {
        const t = { id: d.id, ...d.data() } as ITable;
        const tNum = cleanTableIdentifier(t.number || t.tableNumber || t.id);
        if (t.id === String(tableIdentifier) || (cleanNum && tNum === cleanNum)) {
          foundTable = t;
          break;
        }
      }

      // If table wasn't matched directly but reservation has assigned table, search by reservation's table
      if (!foundTable && candidateReservations[0]?.assignedTableId) {
        for (const d of tablesSnap.docs) {
          const t = { id: d.id, ...d.data() } as ITable;
          if (t.id === candidateReservations[0].assignedTableId) {
            foundTable = t;
            break;
          }
        }
      }

      if (!foundTable) {
        return false;
      }

      const matchedTable: ITable = foundTable;

      // CRITICAL OPERATIONAL CONDITION 1:
      // The physical table must be sanitized and released (Available or empty).
      // If table is still Occupied, Seated, Dining, or Cleaning, the dining experience has NOT ended yet!
      const currentTableStatus = (matchedTable.status || matchedTable.tableStatus || '').toString();
      if (!isTableAvailable(currentTableStatus)) {
        return false;
      }

      // 3. Find the candidate reservation specifically associated with this table
      const targetRes = candidateReservations.find(r => this.matchesTable(r, matchedTable!));
      if (!targetRes) {
        return false;
      }

      // Idempotency check: if already completed, do nothing
      if (targetRes.status === 'Completed') {
        return false;
      }

      // CRITICAL OPERATIONAL CONDITION 2:
      // The financial / payment lifecycle must be verified as completed.
      // Search recent orders for this table/customer
      const ordersCol = collection(db, 'restaurants', tenantId, 'orders');
      const ordersSnap = await getDocs(ordersCol);
      const tableOrders: IOrder[] = [];

      ordersSnap.forEach(d => {
        const o = { id: d.id, ...d.data() } as IOrder;
        const ordTableNum = cleanTableIdentifier(o.tableNumber || o.tableId);
        const isMatchingTable = ordTableNum && cleanNum && ordTableNum === cleanNum;
        const isMatchingCustomer = targetRes.customerId && o.customerId && targetRes.customerId === o.customerId && targetRes.customerId !== 'guest-uid';
        const isMatchingOrder = (targetRes.orderId && targetRes.orderId === o.orderId) || (options?.orderId && options.orderId === o.orderId);

        if (isMatchingOrder || isMatchingTable || isMatchingCustomer) {
          tableOrders.push(o);
        }
      });

      // Edge Case B Protection:
      // If any active, non-cancelled order with a balance > 0 is NOT paid, do NOT complete the reservation!
      const activeUnpaidOrder = tableOrders.find(o => {
        const pStatus = (o.paymentStatus || '').toLowerCase();
        const oStatus = (o.status || '').toUpperCase();
        const hasBalance = (o.total || 0) > 0;
        return oStatus !== 'CANCELLED' && oStatus !== 'ARCHIVED' && pStatus !== 'paid' && hasBalance;
      });

      if (activeUnpaidOrder) {
        return false;
      }

      // Payment Confirmation check:
      // Must have either:
      // - At least one paid order for this table/session, OR
      // - Table recorded billPaidAt / cleaningCompletedAt, OR
      // - Reservation had zero-item dining checked out and released
      const hasPaidOrder = tableOrders.some(o => (o.paymentStatus || '').toLowerCase() === 'paid');
      const hasTableBillPaid = Boolean(matchedTable.billPaidAt);
      const isPlaceholderCheckInOnly = tableOrders.length === 0 || tableOrders.every(o => (o.total || 0) === 0 && (o.items?.length || 0) === 0);

      const isPaymentSatisfied = hasPaidOrder || hasTableBillPaid || isPlaceholderCheckInOnly;
      if (!isPaymentSatisfied) {
        return false;
      }

      // 4. ATOMIC TRANSITION: Update reservation document to COMPLETED
      const nowIso = new Date().toISOString();
      const updatePayload = {
        status: 'Completed',
        completedAt: nowIso,
        diningCompleted: true,
        updatedAt: nowIso
      };

      // 4a. Update Restaurant central reservations collection
      const resDocRef = doc(db, 'restaurants', tenantId, 'reservations', targetRes.id);
      await updateDoc(resDocRef, updatePayload);

      // 4b. Update Customer reservation record if customer is registered
      if (targetRes.customerId && targetRes.customerId !== 'guest-uid') {
        try {
          const custResRef = doc(db, 'customers', targetRes.customerId, 'reservations', targetRes.id);
          await updateDoc(custResRef, updatePayload).catch(() => {});
        } catch (_) {}

        try {
          const userResRef = doc(db, 'users', targetRes.customerId, 'reservations', targetRes.id);
          await updateDoc(userResRef, updatePayload).catch(() => {});
        } catch (_) {}
      }

      // 5. Operational Audit Logging & Event Tracking
      try {
        await logAuditEvent({
          userId: options?.actorName || 'system',
          userEmail: options?.actorName || 'system@spiraldine.internal',
          userName: options?.actorName || 'Staff Waiter',
          userRole: (options?.actorRole as any) || 'waiter',
          tenantId,
          module: 'Reservations',
          action: 'STATUS_CHANGE',
          targetEntity: `Reservation ${targetRes.bookingId || targetRes.id} (${targetRes.customerName})`,
          previousValue: 'Seated',
          newValue: 'Completed'
        });
      } catch (_) {}

      try {
        logEvent(tenantId, {
          eventType: 'Reservation Completed',
          eventCategory: 'Operational',
          performedBy: options?.actorName || 'Staff Waiter',
          performedByRole: options?.actorRole || 'waiter',
          tableNumber: matchedTable.number || matchedTable.tableNumber || '',
          title: 'Dining Lifecycle Completed',
          description: `Reservation ${targetRes.bookingId || targetRes.id} for ${targetRes.customerName} transitioned to COMPLETED following table sanitation and payment verification.`
        });
      } catch (_) {}

      return true;
    } catch (err) {
      console.warn('[reservationService] completeReservationIfEligible error:', err);
      return false;
    } finally {
      inFlightCompletions.delete(lockKey);
    }
  },

  /**
   * Realtime Reconciliation Sync:
   * Examines active in-memory reservations alongside realtime tables and orders.
   * If any seated reservation's dining lifecycle is fully completed (table Available + payment paid),
   * transitions it to 'Completed' automatically.
   */
  async syncCompletedReservations(
    tenantId: string,
    tables: ITable[],
    orders: IOrder[],
    reservations: IReservationRecord[]
  ): Promise<number> {
    if (!tenantId || !Array.isArray(reservations) || reservations.length === 0) {
      return 0;
    }

    let syncedCount = 0;
    const seatedReservations = reservations.filter(r => r.status === 'Seated');

    for (const res of seatedReservations) {
      // Find matching table
      const matchedTable = tables.find(t => this.matchesTable(res, t));
      if (!matchedTable) continue;

      // Check table status: must be Available/empty (waiter has finished cleaning)
      const tStatus = (matchedTable.status || matchedTable.tableStatus || '').toString();
      if (!isTableAvailable(tStatus)) continue;

      // Check payment status on associated orders
      const cleanNum = cleanTableIdentifier(matchedTable.number || matchedTable.tableNumber || matchedTable.id);
      const relatedOrders = orders.filter(o => {
        const ordNum = cleanTableIdentifier(o.tableNumber || o.tableId);
        return (
          (ordNum && cleanNum && ordNum === cleanNum) ||
          (res.orderId && res.orderId === o.orderId) ||
          (res.customerId && o.customerId && res.customerId === o.customerId && res.customerId !== 'guest-uid')
        );
      });

      // If active order has unpaid balance > 0, do not complete
      const hasUnpaidBalance = relatedOrders.some(o => {
        const p = (o.paymentStatus || '').toLowerCase();
        const s = (o.status || '').toUpperCase();
        return s !== 'CANCELLED' && s !== 'ARCHIVED' && p !== 'paid' && (o.total || 0) > 0;
      });
      if (hasUnpaidBalance) continue;

      // Verify payment was settled or it was a zero-order session
      const hasPaid = relatedOrders.some(o => (o.paymentStatus || '').toLowerCase() === 'paid') || Boolean(matchedTable.billPaidAt);
      const isZeroOrder = relatedOrders.length === 0 || relatedOrders.every(o => (o.total || 0) === 0);

      if (hasPaid || isZeroOrder) {
        const success = await this.completeReservationIfEligible(tenantId, matchedTable.id, {
          reservationId: res.id,
          actorName: 'Realtime Sync Engine',
          actorRole: 'system'
        });
        if (success) {
          syncedCount++;
        }
      }
    }

    return syncedCount;
  }
};
