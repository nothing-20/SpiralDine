import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc,
  getDocs
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { IShiftClosingRequest, ShiftClosingStatus, IShiftClosingReport } from '../types';
import { logEvent } from './eventEngine';

export const shiftService = {
  /**
   * Submit a shift closing request from staff (e.g. Waiter) to management.
   */
  async requestShiftClosing(
    tenantId: string,
    data: {
      staffId: string;
      staffName: string;
      staffEmail: string;
      role?: string;
      notes?: string;
      report: IShiftClosingReport;
    }
  ): Promise<string> {
    if (!tenantId) throw new Error('Tenant ID is required to submit a shift closing request.');
    if (!data.staffId) throw new Error('Staff ID is required.');

    const colRef = collection(db, 'restaurants', tenantId, 'shiftClosingRequests');
    const newDocRef = doc(colRef);
    const id = newDocRef.id;

    const request: IShiftClosingRequest = {
      id,
      tenantId,
      staffId: data.staffId,
      staffName: data.staffName || 'Staff Member',
      staffEmail: data.staffEmail || '',
      role: data.role || 'waiter',
      status: 'pending',
      createdAt: new Date().toISOString(),
      notes: data.notes || '',
      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: '',
      report: data.report
    };

    await setDoc(newDocRef, request);

    // Notify Owner / Manager via operational alert
    try {
      await addDoc(collection(db, 'restaurants', tenantId, 'alerts'), {
        title: 'Shift Closing & Cash Handover Request',
        message: `${request.staffName} (${request.role.toUpperCase()}) requested shift closing approval. Cash handover to collect: ₹${(request.report.cashTotal || 0).toLocaleString('en-IN')}.`,
        category: 'Staff',
        severity: 'warning',
        source: 'Shift Closing',
        read: false,
        resolved: false,
        createdAt: new Date().toISOString(),
        metadata: {
          requestId: id,
          staffId: data.staffId,
          cashTotal: request.report.cashTotal,
          revenue: request.report.revenue
        }
      });
    } catch (e) {
      console.warn('Could not post operational alert for shift closing request:', e);
    }

    // Audit Event
    await logEvent(tenantId, {
      eventType: 'Shift Closing Requested',
      eventCategory: 'Operational',
      performedBy: request.staffName,
      performedByRole: request.role,
      title: 'Shift Sign-off Requested',
      description: `${request.staffName} requested manager approval to close shift. Cash: ₹${request.report.cashTotal}.`,
      metadata: { requestId: id, cashTotal: request.report.cashTotal }
    });

    return id;
  },

  /**
   * Manager / Owner approves a pending shift closing request.
   */
  async approveShiftClosing(
    tenantId: string,
    requestId: string,
    reviewerName: string,
    notes?: string
  ): Promise<void> {
    if (!tenantId || !requestId) return;

    const docRef = doc(db, 'restaurants', tenantId, 'shiftClosingRequests', requestId);
    await updateDoc(docRef, {
      status: 'approved',
      reviewedBy: reviewerName || 'Restaurant Owner',
      reviewedAt: new Date().toISOString(),
      reviewNotes: notes || 'Shift audited and approved for archival.'
    });

    await logEvent(tenantId, {
      eventType: 'Shift Approved',
      eventCategory: 'Management',
      performedBy: reviewerName,
      performedByRole: 'owner',
      title: 'Shift Closing Approved',
      description: `Manager ${reviewerName} approved shift closing request #${requestId}.`,
      metadata: { requestId, reviewNotes: notes }
    });
  },

  /**
   * Manager / Owner rejects / requests revisions on a shift closing request.
   */
  async rejectShiftClosing(
    tenantId: string,
    requestId: string,
    reviewerName: string,
    reason: string
  ): Promise<void> {
    if (!tenantId || !requestId) return;

    const docRef = doc(db, 'restaurants', tenantId, 'shiftClosingRequests', requestId);
    await updateDoc(docRef, {
      status: 'rejected',
      reviewedBy: reviewerName || 'Restaurant Owner',
      reviewedAt: new Date().toISOString(),
      reviewNotes: reason || 'Please balance cash drawer or resolve outstanding tables before sign-off.'
    });

    await logEvent(tenantId, {
      eventType: 'Shift Revision Requested',
      eventCategory: 'Management',
      performedBy: reviewerName,
      performedByRole: 'owner',
      title: 'Shift Revision Requested',
      description: `Manager ${reviewerName} requested shift revision for #${requestId}: ${reason}`,
      metadata: { requestId, reason }
    });
  },

  /**
   * Final step: Staff or manager archives and closes the approved shift.
   */
  async closeAndArchiveShift(
    tenantId: string,
    requestId: string,
    staffId: string
  ): Promise<void> {
    if (!tenantId || !requestId) return;

    const docRef = doc(db, 'restaurants', tenantId, 'shiftClosingRequests', requestId);
    await updateDoc(docRef, {
      status: 'closed',
      closedAt: new Date().toISOString()
    });

    // Clear local active shift state if available
    try {
      if (staffId && typeof window !== 'undefined') {
        const saved = localStorage.getItem(`shift_${staffId}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          parsed.isActive = false;
          parsed.status = 'closed';
          parsed.endTime = new Date().toISOString();
          localStorage.setItem(`shift_${staffId}`, JSON.stringify(parsed));
        }
      }
    } catch (e) {
      console.warn('Failed to clear shift in localStorage:', e);
    }

    await logEvent(tenantId, {
      eventType: 'Shift Closed & Archived',
      eventCategory: 'Operational',
      performedBy: staffId,
      performedByRole: 'waiter',
      title: 'Shift Archived',
      description: `Shift closing #${requestId} successfully archived and locked.`,
      metadata: { requestId }
    });
  },

  /**
   * Real-time subscription to the latest shift request for a specific staff member.
   */
  subscribeToStaffShiftRequest(
    tenantId: string,
    staffId: string,
    callback: (request: IShiftClosingRequest | null) => void
  ) {
    if (!tenantId || !staffId) {
      callback(null);
      return () => {};
    }

    const colRef = collection(db, 'restaurants', tenantId, 'shiftClosingRequests');
    // Listen to staff requests sorted by createdAt descending
    const q = query(
      colRef,
      where('staffId', '==', staffId),
      limit(10)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          callback(null);
          return;
        }

        const items: IShiftClosingRequest[] = [];
        snapshot.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
        items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        // Return latest active or most recent request
        callback(items[0] || null);
      },
      (error) => {
        console.error('Error listening to staff shift closing request:', error);
        callback(null);
      }
    );
  },

  /**
   * Real-time subscription to all shift closing requests for the owner/manager dashboard.
   */
  subscribeToShiftClosingRequests(
    tenantId: string,
    callback: (requests: IShiftClosingRequest[]) => void
  ) {
    if (!tenantId) {
      callback([]);
      return () => {};
    }

    const colRef = collection(db, 'restaurants', tenantId, 'shiftClosingRequests');
    const q = query(colRef, limit(100));

    return onSnapshot(
      q,
      (snapshot) => {
        const items: IShiftClosingRequest[] = [];
        snapshot.forEach((d) => items.push({ id: d.id, ...(d.data() as any) }));
        items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        callback(items);
      },
      (error) => {
        console.error('Error listening to restaurant shift closing requests:', error);
        callback([]);
      }
    );
  }
};
