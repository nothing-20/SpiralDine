import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface IAuditLogEntry {
  id?: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  tenantId: string;
  restaurantName?: string;
  module: 
    | 'Menu'
    | 'Staff'
    | 'Tables'
    | 'Billing'
    | 'Inventory'
    | 'Reservations'
    | 'Feedback'
    | 'Marketing'
    | 'Alerts'
    | 'BranchTransfers'
    | 'Restaurants'
    | 'Settings'
    | 'Security';
  action: 
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'STATUS_CHANGE'
    | 'PRICE_CHANGE'
    | 'TRANSFER'
    | 'PERMISSION_CHANGE'
    | 'EXPORT';
  targetEntity: string;
  targetId?: string;
  previousValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Appends an immutable audit log entry into both the tenant-scoped collection
 * and the root auditLogs collection for central accountability.
 */
export async function logAuditEvent(entry: Omit<IAuditLogEntry, 'timestamp'>): Promise<string | null> {
  try {
    const payload: IAuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString()
    };

    // 1. Root auditLogs collection (protected as immutable in firestore.rules)
    let docId: string | null = null;
    try {
      const rootCol = collection(db, 'auditLogs');
      const rootDoc = await addDoc(rootCol, payload);
      docId = rootDoc.id;
    } catch (err) {
      console.warn('[AuditService] Root audit log write notice:', err);
    }

    // 2. Tenant-scoped auditLogs subcollection
    if (entry.tenantId) {
      try {
        const tenantCol = collection(db, 'restaurants', entry.tenantId, 'auditLogs');
        const tenantDoc = await addDoc(tenantCol, payload);
        if (!docId) docId = tenantDoc.id;
      } catch (err) {
        console.warn('[AuditService] Tenant audit log write notice:', err);
      }
    }

    return docId;
  } catch (error) {
    console.error('[AuditService] Failed to record audit log:', error);
    return null;
  }
}
