import { 
  collection, 
  doc, 
  getDocs, 
  deleteDoc, 
  writeBatch, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export type TAlertPurgeFilter = 'all' | 'resolved' | 'read' | 'expiry';

/**
 * Split array into chunks of given size (Firestore writeBatch supports up to 500 ops per commit).
 */
function chunkArray<T>(items: T[], size: number = 450): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export const alertService = {
  /**
   * Delete a single alert document from Firestore.
   */
  async deleteAlert(tenantId: string, alertId: string): Promise<{ success: boolean; error?: string }> {
    if (!tenantId || !alertId) {
      return { success: false, error: 'Restaurant ID and Alert ID are required.' };
    }
    try {
      const docRef = doc(db, 'restaurants', tenantId, 'alerts', alertId);
      await deleteDoc(docRef);
      return { success: true };
    } catch (err: any) {
      console.error('[alertService] Delete alert error:', err);
      return { 
        success: false, 
        error: err?.message || 'Failed to delete alert from Firestore.' 
      };
    }
  },

  /**
   * Delete multiple alert documents in atomic Firestore batches (up to 450 per commit).
   */
  async deleteAlertsBatch(tenantId: string, alertIds: string[]): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    if (!tenantId) {
      return { success: false, deletedCount: 0, error: 'Restaurant ID is required.' };
    }
    if (!alertIds || alertIds.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    try {
      const chunks = chunkArray(alertIds, 450);
      let totalDeleted = 0;

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(alertId => {
          const docRef = doc(db, 'restaurants', tenantId, 'alerts', alertId);
          batch.delete(docRef);
        });
        await batch.commit();
        totalDeleted += chunk.length;
      }

      return { success: true, deletedCount: totalDeleted };
    } catch (err: any) {
      console.error('[alertService] Delete alerts batch error:', err);
      return { 
        success: false, 
        deletedCount: 0, 
        error: err?.message || 'Failed to delete alerts batch from Firestore.' 
      };
    }
  },

  /**
   * Purge alerts based on criteria (e.g. all, resolved, read, or automated expiry checks).
   */
  async purgeAlerts(
    tenantId: string, 
    filterType: TAlertPurgeFilter = 'all'
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    if (!tenantId) {
      return { success: false, deletedCount: 0, error: 'Restaurant ID is required.' };
    }

    try {
      const colRef = collection(db, 'restaurants', tenantId, 'alerts');
      const snap = await getDocs(colRef);

      const toDeleteIds: string[] = [];

      snap.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        const sourceStr = String(data.source || '').toLowerCase();
        const titleStr = String(data.title || '').toLowerCase();
        const msgStr = String(data.message || data.text || '').toLowerCase();

        let shouldDelete = false;

        switch (filterType) {
          case 'all':
            shouldDelete = true;
            break;
          case 'resolved':
            shouldDelete = Boolean(data.resolved);
            break;
          case 'read':
            shouldDelete = Boolean(data.read);
            break;
          case 'expiry':
            shouldDelete = 
              sourceStr.includes('expiry') ||
              titleStr.includes('expired') ||
              msgStr.includes('expired ingredient') ||
              msgStr.includes('shelf-life') ||
              data.category === 'Operations' && msgStr.includes('expired');
            break;
        }

        if (shouldDelete) {
          toDeleteIds.push(id);
        }
      });

      if (toDeleteIds.length === 0) {
        return { success: true, deletedCount: 0 };
      }

      const res = await this.deleteAlertsBatch(tenantId, toDeleteIds);
      return res;
    } catch (err: any) {
      console.error('[alertService] Purge alerts error:', err);
      return { 
        success: false, 
        deletedCount: 0, 
        error: err?.message || 'Failed to purge alerts.' 
      };
    }
  },

  /**
   * Mark a batch of alerts as read.
   */
  async markAlertsAsReadBatch(tenantId: string, alertIds: string[]): Promise<{ success: boolean; count: number; error?: string }> {
    if (!tenantId || !alertIds.length) {
      return { success: true, count: 0 };
    }

    try {
      const chunks = chunkArray(alertIds, 450);
      let updatedCount = 0;

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(alertId => {
          const docRef = doc(db, 'restaurants', tenantId, 'alerts', alertId);
          batch.update(docRef, { 
            read: true, 
            updatedAt: new Date().toISOString() 
          });
        });
        await batch.commit();
        updatedCount += chunk.length;
      }

      return { success: true, count: updatedCount };
    } catch (err: any) {
      console.error('[alertService] Mark read batch error:', err);
      return { 
        success: false, 
        count: 0, 
        error: err?.message || 'Failed to mark alerts as read.' 
      };
    }
  },

  /**
   * Resolve a batch of alerts.
   */
  async resolveAlertsBatch(tenantId: string, alertIds: string[]): Promise<{ success: boolean; count: number; error?: string }> {
    if (!tenantId || !alertIds.length) {
      return { success: true, count: 0 };
    }

    try {
      const chunks = chunkArray(alertIds, 450);
      let updatedCount = 0;
      const now = new Date().toISOString();

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(alertId => {
          const docRef = doc(db, 'restaurants', tenantId, 'alerts', alertId);
          batch.update(docRef, { 
            resolved: true, 
            read: true, 
            resolvedAt: now, 
            updatedAt: now 
          });
        });
        await batch.commit();
        updatedCount += chunk.length;
      }

      return { success: true, count: updatedCount };
    } catch (err: any) {
      console.error('[alertService] Resolve alerts batch error:', err);
      return { 
        success: false, 
        count: 0, 
        error: err?.message || 'Failed to resolve alerts batch.' 
      };
    }
  }
};

export default alertService;
