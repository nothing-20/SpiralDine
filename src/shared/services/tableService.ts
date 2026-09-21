import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  addDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { tablesService } from '../firebase/firestore';
import { ITable, TTableStatus } from '../domain/tables/types';

export const cleanTableIdentifier = (val?: string | number): string => {
  return String(val || '')
    .trim()
    .replace(/^(table|tbl)[-\s]*/i, '')
    .trim();
};

export const tableService = {
  getTables: (tenantId?: string) => tablesService.getAll(tenantId) as Promise<ITable[]>,
  createTable: (data: Omit<ITable, 'id'>, tenantId?: string) => tablesService.create(data, tenantId),
  updateTable: (id: string, data: Partial<ITable>, tenantId?: string) => tablesService.update(id, data, tenantId),
  deleteTable: (id: string, tenantId?: string) => tablesService.delete(id, tenantId),

  /**
   * Resiliently finds a table document by its document ID, tableNumber, number, or tableName.
   * Handles variations such as "1", "TBL-1", "Table 1".
   */
  async findTableByNumberOrId(tenantId: string, tableIdentifier: string | number): Promise<{ id: string; table: ITable } | null> {
    if (!tenantId || tableIdentifier === undefined || tableIdentifier === null || tableIdentifier === '') {
      return null;
    }

    const rawStr = String(tableIdentifier).trim();
    const cleanNum = cleanTableIdentifier(rawStr);

    // 1. Check direct doc ref by exact identifier
    try {
      const directRef = doc(db, 'restaurants', tenantId, 'tables', rawStr);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        return { id: directSnap.id, table: { id: directSnap.id, ...directSnap.data() } as ITable };
      }
    } catch (_) {}

    // 2. Check TBL- prefix if not already present
    if (!rawStr.toUpperCase().startsWith('TBL-') && cleanNum) {
      try {
        const tblRef = doc(db, 'restaurants', tenantId, 'tables', `TBL-${cleanNum}`);
        const tblSnap = await getDoc(tblRef);
        if (tblSnap.exists()) {
          return { id: tblSnap.id, table: { id: tblSnap.id, ...tblSnap.data() } as ITable };
        }
      } catch (_) {}
    }

    // 3. Query collection by fields: number, tableNumber, tableName, name
    if (cleanNum) {
      const colRef = collection(db, 'restaurants', tenantId, 'tables');
      
      // Try query by number
      const qNum = query(colRef, where('number', '==', cleanNum));
      const snapNum = await getDocs(qNum);
      if (!snapNum.empty) {
        const d = snapNum.docs[0];
        return { id: d.id, table: { id: d.id, ...d.data() } as ITable };
      }

      // Try query by tableNumber
      const qTblNum = query(colRef, where('tableNumber', '==', cleanNum));
      const snapTblNum = await getDocs(qTblNum);
      if (!snapTblNum.empty) {
        const d = snapTblNum.docs[0];
        return { id: d.id, table: { id: d.id, ...d.data() } as ITable };
      }

      // Try numeric comparison if numeric
      const numericVal = Number(cleanNum);
      if (!isNaN(numericVal)) {
        const qNumStrict = query(colRef, where('number', '==', numericVal));
        const snapNumStrict = await getDocs(qNumStrict);
        if (!snapNumStrict.empty) {
          const d = snapNumStrict.docs[0];
          return { id: d.id, table: { id: d.id, ...d.data() } as ITable };
        }
      }

      // Scan all tables in memory as fallback if tenant has standard table count (< 100)
      const allSnap = await getDocs(colRef);
      for (const d of allSnap.docs) {
        const data = d.data() as ITable;
        const dNum = cleanTableIdentifier(data.number || data.tableNumber || data.tableName || data.name);
        if (dNum === cleanNum || d.id === rawStr || d.id === `TBL-${cleanNum}`) {
          return { id: d.id, table: { ...data, id: d.id } as ITable };
        }
      }
    }

    return null;
  },

  /**
   * Synchronizes diner seating & menu browsing to the table.
   * Immediately notifies the waiter dashboard that a customer is at Table X browsing the menu.
   */
  async setTableBrowsing(
    tenantId: string,
    tableIdentifier: string | number,
    source: 'qr' | 'app' = 'qr',
    customerInfo?: { name?: string; phone?: string; customerId?: string }
  ): Promise<void> {
    if (!tenantId || !tableIdentifier) return;

    try {
      const match = await this.findTableByNumberOrId(tenantId, tableIdentifier);
      const cleanNum = cleanTableIdentifier(tableIdentifier);
      const targetTableId = match ? match.id : (String(tableIdentifier).startsWith('TBL-') ? String(tableIdentifier) : `TBL-${cleanNum}`);
      const tableRef = doc(db, 'restaurants', tenantId, 'tables', targetTableId);

      const nowIso = new Date().toISOString();
      const currentTable = match?.table;

      // Only transition to browsing if table is currently available or unseated
      const currentStatus = (currentTable?.status || (currentTable as any)?.tableStatus || '').toLowerCase();
      const hasActiveOrder = Boolean(currentTable?.activeOrderId || (currentTable as any)?.currentOrderId);

      if (!hasActiveOrder && (currentStatus === 'available' || currentStatus === 'empty' || currentStatus === '' || !match)) {
        await setDoc(tableRef, {
          status: 'occupied',
          tableStatus: 'Occupied',
          subStatus: 'browsing',
          diningStatus: 'browsing',
          customerPresent: true,
          seatedAt: currentTable?.seatedAt || nowIso,
          lastActiveAt: nowIso,
          orderSource: source,
          customerName: customerInfo?.name || currentTable?.customerName || 'Guest Diner',
          customerPhone: customerInfo?.phone || currentTable?.customerPhone || '',
          updatedAt: nowIso,
          number: currentTable?.number || cleanNum,
          tableNumber: currentTable?.tableNumber || cleanNum,
          tableName: currentTable?.tableName || `Table ${cleanNum}`
        }, { merge: true });

        // Add an operational alert for the waiter
        try {
          const alertsRef = collection(db, 'restaurants', tenantId, 'alerts');
          await addDoc(alertsRef, {
            type: 'tables',
            title: `Table ${cleanNum}: Customer Seated`,
            message: `Diner is viewing the digital menu via ${source === 'qr' ? 'Table QR' : 'SpiralDine App'}.`,
            tableNumber: cleanNum,
            tableId: targetTableId,
            read: false,
            createdAt: nowIso
          });
        } catch (_) {}
      } else {
        // Just touch lastActiveAt
        await updateDoc(tableRef, {
          lastActiveAt: nowIso,
          updatedAt: nowIso
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[tableService] setTableBrowsing warning:', err);
    }
  },

  /**
   * Links a placed order to the table and updates status to active dining.
   */
  async setTableOccupiedWithOrder(
    tenantId: string,
    tableIdentifier: string | number,
    orderId: string,
    orderDetails?: { total?: number; itemsCount?: number; customerName?: string; guestsCount?: number }
  ): Promise<void> {
    if (!tenantId || !tableIdentifier) return;

    try {
      const match = await this.findTableByNumberOrId(tenantId, tableIdentifier);
      const cleanNum = cleanTableIdentifier(tableIdentifier);
      const targetTableId = match ? match.id : (String(tableIdentifier).startsWith('TBL-') ? String(tableIdentifier) : `TBL-${cleanNum}`);
      const tableRef = doc(db, 'restaurants', tenantId, 'tables', targetTableId);

      const nowIso = new Date().toISOString();

      await setDoc(tableRef, {
        status: 'occupied',
        tableStatus: 'Occupied',
        subStatus: 'dining',
        diningStatus: 'ordered',
        customerPresent: true,
        activeOrderId: orderId,
        currentOrderId: orderId,
        lastOrderAt: nowIso,
        lastActiveAt: nowIso,
        customerName: orderDetails?.customerName || match?.table.customerName || 'Guest Diner',
        guestsCount: orderDetails?.guestsCount || match?.table.guestsCount || 2,
        number: match?.table.number || cleanNum,
        tableNumber: match?.table.tableNumber || cleanNum,
        tableName: match?.table.tableName || `Table ${cleanNum}`,
        updatedAt: nowIso
      }, { merge: true });

      // Add a waiter request / alert for the new order
      try {
        const waiterReqRef = collection(db, 'restaurants', tenantId, 'waiterRequests');
        await addDoc(waiterReqRef, {
          tableNumber: cleanNum,
          orderId: orderId,
          requestType: 'New Order Placed',
          description: `Order #${orderId.slice(-6)} placed (${orderDetails?.itemsCount || 1} items - ₹${orderDetails?.total || 0}).`,
          status: 'Pending',
          priority: 'high',
          createdAt: nowIso
        });
      } catch (_) {}
    } catch (err) {
      console.warn('[tableService] setTableOccupiedWithOrder warning:', err);
    }
  },

  /**
   * Transitions table to cleaning state with an authoritative 5-10 minute timer upon dining & bill completion.
   */
  async setTableCleaning(
    tenantId: string,
    tableIdentifier: string | number,
    durationMins: number = 10
  ): Promise<void> {
    if (!tenantId || !tableIdentifier) return;

    try {
      const match = await this.findTableByNumberOrId(tenantId, tableIdentifier);
      const cleanNum = cleanTableIdentifier(tableIdentifier);
      const targetTableId = match ? match.id : (String(tableIdentifier).startsWith('TBL-') ? String(tableIdentifier) : `TBL-${cleanNum}`);
      const tableRef = doc(db, 'restaurants', tenantId, 'tables', targetTableId);

      const nowIso = new Date().toISOString();

      await setDoc(tableRef, {
        status: 'cleaning',
        tableStatus: 'cleaning',
        subStatus: 'cleaning',
        diningStatus: 'cleaning',
        customerPresent: false,
        cleaningStartedAt: nowIso,
        cleaningDurationMinutes: durationMins,
        billPaidAt: nowIso,
        activeOrderId: null,
        currentOrderId: null,
        updatedAt: nowIso
      }, { merge: true });

      // Post high-priority sanitization request for waiter
      try {
        const waiterReqRef = collection(db, 'restaurants', tenantId, 'waiterRequests');
        await addDoc(waiterReqRef, {
          tableNumber: cleanNum,
          requestType: 'Clean Table',
          description: `Table ${cleanNum}: Dining completed & bill paid. Needs sanitizing & reset.`,
          status: 'Pending',
          priority: 'high',
          createdAt: nowIso
        });
      } catch (_) {}
    } catch (err) {
      console.warn('[tableService] setTableCleaning warning:', err);
    }
  },

  /**
   * Resets table to Available status (called by waiter when sanitization completes or when overriding status).
   */
  async setTableAvailable(
    tenantId: string,
    tableIdentifier: string | number
  ): Promise<void> {
    if (!tenantId || !tableIdentifier) return;

    try {
      const match = await this.findTableByNumberOrId(tenantId, tableIdentifier);
      const cleanNum = cleanTableIdentifier(tableIdentifier);
      const targetTableId = match ? match.id : (String(tableIdentifier).startsWith('TBL-') ? String(tableIdentifier) : `TBL-${cleanNum}`);
      const tableRef = doc(db, 'restaurants', tenantId, 'tables', targetTableId);

      const nowIso = new Date().toISOString();

      await setDoc(tableRef, {
        status: 'Available',
        tableStatus: 'Available',
        subStatus: null,
        diningStatus: null,
        customerPresent: false,
        activeOrderId: null,
        currentOrderId: null,
        guestsCount: 0,
        tableNotes: '',
        cleaningCompletedAt: nowIso,
        cleaningStartedAt: null,
        cleaningDurationMinutes: null,
        seatedAt: null,
        occupiedAt: null,
        billPaidAt: null,
        customerName: null,
        customerPhone: null,
        updatedAt: nowIso
      }, { merge: true });
    } catch (err) {
      console.warn('[tableService] setTableAvailable warning:', err);
    }
  },

  /**
   * Authoritative waiter status override: sets table to any state at any moment.
   */
  async updateTableStatusDirect(
    tenantId: string,
    tableIdentifier: string | number,
    newStatus: TTableStatus | string,
    extraData: Partial<ITable> = {}
  ): Promise<void> {
    if (!tenantId || !tableIdentifier) return;

    try {
      const match = await this.findTableByNumberOrId(tenantId, tableIdentifier);
      const cleanNum = cleanTableIdentifier(tableIdentifier);
      const targetTableId = match ? match.id : (String(tableIdentifier).startsWith('TBL-') ? String(tableIdentifier) : `TBL-${cleanNum}`);
      const tableRef = doc(db, 'restaurants', tenantId, 'tables', targetTableId);

      const nowIso = new Date().toISOString();
      const statusLower = newStatus.toLowerCase();

      const patch: any = {
        status: newStatus,
        tableStatus: newStatus,
        updatedAt: nowIso,
        ...extraData
      };

      if (statusLower === 'available' || statusLower === 'empty') {
        patch.activeOrderId = null;
        patch.currentOrderId = null;
        patch.customerPresent = false;
        patch.subStatus = null;
        patch.diningStatus = null;
        patch.cleaningStartedAt = null;
        patch.seatedAt = null;
        patch.guestsCount = 0;
      } else if (statusLower === 'cleaning') {
        patch.subStatus = 'cleaning';
        patch.cleaningStartedAt = patch.cleaningStartedAt || nowIso;
        patch.cleaningDurationMinutes = patch.cleaningDurationMinutes || 10;
        patch.activeOrderId = null;
        patch.customerPresent = false;
      } else if (statusLower === 'occupied') {
        patch.occupiedAt = patch.occupiedAt || nowIso;
        patch.customerPresent = true;
      }

      await setDoc(tableRef, patch, { merge: true });
    } catch (err) {
      console.error('[tableService] updateTableStatusDirect error:', err);
      throw err;
    }
  }
};

export default tableService;

