import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  arrayUnion,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import {
  IKitchenTicket,
  IKotItem,
  TKotStatus,
  TKotPrintStatus,
  IOrder
} from '../domain/orders/types';
import { kitchenService } from './kitchenService';
import { logEvent } from './eventEngine';

export interface ICreateKotOptions {
  source?: 'customer_qr' | 'customer_app' | 'waiter' | 'pos';
  customerName?: string;
  waiterId?: string;
  waiterName?: string;
  round?: number;
  isSupplementary?: boolean;
}

export const kotService = {
  /**
   * Generates a deterministic ticket ID for an order and round to guarantee idempotency.
   */
  getDeterministicTicketId(orderId: string, round: number = 1): string {
    const cleanOrderId = orderId.trim().toUpperCase();
    return `KOT-${cleanOrderId}-R${round}`;
  },

  /**
   * Generates the next sequential human-readable ticket number for a tenant.
   */
  async getNextTicketNumber(tenantId: string): Promise<{ ticketNumber: string; numericTicketNumber: number }> {
    try {
      const ticketsCol = collection(db, 'restaurants', tenantId, 'kitchenTickets');
      const q = query(ticketsCol, orderBy('createdAt', 'desc'), limit(1));
      const snap = await getDocs(q);

      let nextNum = 101; // Start standard kitchen ticket numbering at #101
      if (!snap.empty) {
        const lastTicket = snap.docs[0].data() as IKitchenTicket;
        if (lastTicket.numericTicketNumber && !isNaN(lastTicket.numericTicketNumber)) {
          nextNum = lastTicket.numericTicketNumber + 1;
        } else if (lastTicket.ticketNumber) {
          const match = lastTicket.ticketNumber.match(/\d+/);
          if (match) {
            nextNum = parseInt(match[0], 10) + 1;
          }
        }
      }

      return {
        ticketNumber: `KOT #${nextNum}`,
        numericTicketNumber: nextNum
      };
    } catch (err) {
      console.warn('[kotService] Fallback ticket number generation:', err);
      const fallbackNum = Math.floor(100 + (Date.now() % 900));
      return {
        ticketNumber: `KOT #${fallbackNum}`,
        numericTicketNumber: fallbackNum
      };
    }
  },

  /**
   * Creates a persistent digital KOT record for an order or additional order round.
   * Completely idempotent: retries with same order and round return the existing ticket.
   */
  async createKotForOrder(
    tenantId: string,
    order: IOrder,
    options: ICreateKotOptions = {}
  ): Promise<IKitchenTicket> {
    if (!tenantId || !order?.orderId) {
      throw new Error('Tenant ID and Order ID are required to generate a Kitchen Order Ticket.');
    }

    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      throw new Error('KOT creation rejected: An order must contain at least one valid item to generate a ticket.');
    }

    const round = options.round || (order as any).orderSequence || 1;
    const isSupplementary = options.isSupplementary !== undefined 
      ? options.isSupplementary 
      : (round > 1 || Boolean((order as any).isAdditionalOrder));

    const ticketId = kotService.getDeterministicTicketId(order.orderId, round);
    const ticketRef = doc(db, 'restaurants', tenantId, 'kitchenTickets', ticketId);

    // 1. Idempotency Check: if KOT already exists for this order & round, return it immediately
    const existingSnap = await getDoc(ticketRef);
    if (existingSnap.exists()) {
      return { id: existingSnap.id, ...existingSnap.data() } as IKitchenTicket;
    }

    // 2. Resolve next ticket number
    const { ticketNumber, numericTicketNumber } = await kotService.getNextTicketNumber(tenantId);

    // 3. Map order items to KOT items with station inference
    const kotItems: IKotItem[] = order.items.map((item) => {
      const station = kitchenService.inferStationForItem(
        (item as any).category || item.name,
        kitchenService.DEFAULT_STATIONS
      );
      return {
        itemId: item.itemId,
        name: item.name,
        count: item.count,
        notes: item.notes || '',
        pricePerUnit: item.pricePerUnit,
        station,
        isVeg: item.isVeg ?? (item as any).veg,
        specialInstructions: (order as any).specialInstructions || (order as any).customerNotes || ''
      };
    });

    // Inferred primary station for ticket
    const stationsInTicket = Array.from(new Set(kotItems.map(i => i.station).filter(Boolean)));
    const primaryStation = stationsInTicket.length === 1 ? stationsInTicket[0]! : 'Main Kitchen';

    const cleanTableNumber = String(
      order.tableNumber || 
      (order.tableId ? String(order.tableId).replace(/^TBL-/i, '') : 'Walk-in')
    );

    const nowIso = new Date().toISOString();

    const newTicket: IKitchenTicket = {
      id: ticketId,
      ticketNumber,
      numericTicketNumber,
      tenantId,
      branchId: order.branchId || 'main',
      orderId: order.orderId,
      tableId: order.tableId || (cleanTableNumber !== 'Walk-in' ? `TBL-${cleanTableNumber}` : ''),
      tableNumber: cleanTableNumber,
      tableName: order.tableName || `Table ${cleanTableNumber}`,
      sessionId: (order as any).sessionId || '',
      round,
      isSupplementary,
      items: kotItems,
      specialInstructions: (order as any).specialInstructions || (order as any).customerNotes || (order as any).kitchenNotes || '',
      station: primaryStation,
      status: 'NEW',
      source: options.source || (order.orderSource === 'qr' ? 'customer_qr' : (order.orderSource === 'waiter' ? 'waiter' : 'customer_app')),
      customerName: options.customerName || order.customerName || 'Guest Diner',
      waiterId: options.waiterId || order.waiterId || '',
      waiterName: options.waiterName || order.waiterName || '',
      createdAt: nowIso,
      updatedAt: nowIso,
      printStatus: 'unprinted',
      printCount: 0
    };

    // 4. Save to Firestore
    await setDoc(ticketRef, newTicket);

    // 5. Update canonical order reference with KOT tracking
    try {
      const orderRef = doc(db, 'restaurants', tenantId, 'orders', order.orderId);
      await updateDoc(orderRef, {
        latestKotId: ticketId,
        latestKotNumber: ticketNumber,
        kotIds: arrayUnion(ticketId),
        updatedAt: nowIso
      });
    } catch (orderUpdateErr) {
      console.warn('[kotService] Non-blocking order KOT link warning:', orderUpdateErr);
    }

    // 6. Log operational audit event
    logEvent(tenantId, {
      eventType: isSupplementary ? 'Supplementary KOT Created' : 'KOT Created',
      eventCategory: 'Kitchen',
      performedBy: options.waiterName || options.customerName || 'Customer Portal',
      performedByRole: options.source === 'waiter' ? 'waiter' : 'customer',
      orderId: order.orderId,
      tableNumber: cleanTableNumber,
      title: `${ticketNumber} Created`,
      description: `${ticketNumber} (${isSupplementary ? `Round #${round} Supplementary` : 'Initial Order'}) generated with ${kotItems.length} items.`
    });

    return newTicket;
  },

  /**
   * Retrieves all KOTs for a specific canonical order.
   */
  async getTicketsForOrder(tenantId: string, orderId: string): Promise<IKitchenTicket[]> {
    if (!tenantId || !orderId) return [];
    try {
      const colRef = collection(db, 'restaurants', tenantId, 'kitchenTickets');
      const q = query(colRef, where('orderId', '==', orderId));
      const snap = await getDocs(q);
      const list: IKitchenTicket[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as IKitchenTicket));
      return list.sort((a, b) => (a.round || 1) - (b.round || 1));
    } catch (err) {
      console.error('[kotService] getTicketsForOrder error:', err);
      return [];
    }
  },

  /**
   * Retrieves all KOTs for a tenant.
   */
  async getKitchenTickets(tenantId: string, limitCount: number = 100): Promise<IKitchenTicket[]> {
    if (!tenantId) return [];
    try {
      const colRef = collection(db, 'restaurants', tenantId, 'kitchenTickets');
      const q = query(colRef, orderBy('createdAt', 'desc'), limit(limitCount));
      const snap = await getDocs(q);
      const list: IKitchenTicket[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as IKitchenTicket));
      return list;
    } catch (err) {
      console.error('[kotService] getKitchenTickets error:', err);
      return [];
    }
  },

  /**
   * Real-time subscription to active KOTs for the kitchen workflow.
   */
  subscribeToKitchenTickets(
    tenantId: string,
    callback: (tickets: IKitchenTicket[]) => void,
    onError?: (err: any) => void
  ): Unsubscribe {
    if (!tenantId) {
      callback([]);
      return () => {};
    }

    const colRef = collection(db, 'restaurants', tenantId, 'kitchenTickets');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(150));

    return onSnapshot(
      q,
      (snap) => {
        const list: IKitchenTicket[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as IKitchenTicket));
        callback(list);
      },
      (err) => {
        console.warn('[kotService] subscribeToKitchenTickets error:', err);
        if (onError) onError(err);
        callback([]);
      }
    );
  },

  /**
   * Transitions a KOT's preparation status.
   */
  async updateTicketStatus(
    tenantId: string,
    ticketId: string,
    nextStatus: TKotStatus,
    actor?: { uid?: string; displayName?: string; role?: string }
  ): Promise<void> {
    if (!tenantId || !ticketId) return;

    const docRef = doc(db, 'restaurants', tenantId, 'kitchenTickets', ticketId);
    const nowIso = new Date().toISOString();

    const updatePayload: Partial<IKitchenTicket> & Record<string, any> = {
      status: nextStatus,
      updatedAt: nowIso
    };

    if (nextStatus === 'ACCEPTED') updatePayload.acceptedAt = nowIso;
    if (nextStatus === 'PREPARING') updatePayload.cookingStartedAt = nowIso;
    if (nextStatus === 'READY') updatePayload.readyAt = nowIso;
    if (nextStatus === 'SERVED') updatePayload.servedAt = nowIso;
    if (nextStatus === 'CANCELLED') updatePayload.cancelledAt = nowIso;

    await updateDoc(docRef, updatePayload);

    // Synchronize canonical order status safely:
    // If ticket is marked READY, check if the parent order should reflect READY
    try {
      const ticketSnap = await getDoc(docRef);
      if (ticketSnap.exists()) {
        const tData = ticketSnap.data() as IKitchenTicket;
        if (tData.orderId) {
          const orderRef = doc(db, 'restaurants', tenantId, 'orders', tData.orderId);
          const orderSnap = await getDoc(orderRef);
          if (orderSnap.exists()) {
            const currentOrderStatus = orderSnap.data().status;
            // Only update order status if it hasn't already advanced past kitchen phase
            if (nextStatus === 'PREPARING' && (currentOrderStatus === 'NEW' || currentOrderStatus === 'ACCEPTED')) {
              await updateDoc(orderRef, { status: 'PREPARING', cookingStartedAt: nowIso, updatedAt: nowIso });
            } else if (nextStatus === 'READY' && (currentOrderStatus === 'PREPARING' || currentOrderStatus === 'ACCEPTED' || currentOrderStatus === 'NEW')) {
              await updateDoc(orderRef, { status: 'READY', readyAt: nowIso, updatedAt: nowIso });
            }
          }
        }
      }
    } catch (orderSyncErr) {
      console.warn('[kotService] Non-blocking order status sync warning:', orderSyncErr);
    }

    logEvent(tenantId, {
      eventType: `KOT ${nextStatus}`,
      eventCategory: 'Kitchen',
      performedBy: actor?.displayName || 'Kitchen Staff',
      performedByRole: (actor?.role as any) || 'kitchen',
      title: `Ticket ${ticketId} → ${nextStatus}`,
      description: `Kitchen Order Ticket ${ticketId} status advanced to ${nextStatus}.`
    });
  },

  /**
   * Records a print attempt and outcome for a KOT.
   */
  async recordPrintAttempt(
    tenantId: string,
    ticketId: string,
    success: boolean,
    errorMessage?: string,
    actor?: { uid?: string; displayName?: string }
  ): Promise<void> {
    if (!tenantId || !ticketId) return;

    const docRef = doc(db, 'restaurants', tenantId, 'kitchenTickets', ticketId);
    const nowIso = new Date().toISOString();

    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const current = snap.data() as IKitchenTicket;

    const newPrintCount = success ? (current.printCount || 0) + 1 : (current.printCount || 0);
    const newStatus: TKotPrintStatus = success ? 'printed' : 'failed';

    await updateDoc(docRef, {
      printStatus: newStatus,
      printCount: newPrintCount,
      lastPrintAttemptAt: nowIso,
      ...(success ? { printedAt: nowIso } : {}),
      ...(errorMessage ? { lastPrintError: errorMessage } : {}),
      updatedAt: nowIso
    });
  },

  /**
   * Records a manual reprint of a KOT with an auditable reprint log entry.
   */
  async recordReprint(
    tenantId: string,
    ticketId: string,
    actor?: { uid?: string; displayName?: string },
    reason?: string
  ): Promise<void> {
    if (!tenantId || !ticketId) return;

    const docRef = doc(db, 'restaurants', tenantId, 'kitchenTickets', ticketId);
    const nowIso = new Date().toISOString();

    const logEntry = {
      reprintedAt: nowIso,
      reprintedBy: actor?.uid || 'staff',
      reprintedByName: actor?.displayName || 'Staff',
      reason: reason || 'Kitchen requested physical reprint'
    };

    const snap = await getDoc(docRef);
    const count = snap.exists() ? (snap.data().printCount || 0) + 1 : 1;

    await updateDoc(docRef, {
      printCount: count,
      printStatus: 'printed',
      reprintsLog: arrayUnion(logEntry),
      updatedAt: nowIso
    });

    logEvent(tenantId, {
      eventType: 'KOT Reprinted',
      eventCategory: 'Kitchen',
      performedBy: actor?.displayName || 'Staff',
      performedByRole: 'kitchen',
      title: `KOT #${ticketId} Reprinted`,
      description: `Ticket ${ticketId} reprinted (Print Count: ${count}). Reason: ${reason || 'Manual reprint'}.`
    });
  }
};

export default kotService;
