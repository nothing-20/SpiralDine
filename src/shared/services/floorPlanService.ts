import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { IFloorPlanConfig, IArchitecturalElement, ITableVisualConfig } from '../domain/floorplan/types';

/**
 * Sanitizes a floor key or name to safely form a Firestore document identifier.
 */
export const sanitizeFloorKey = (floorKey: string): string => {
  return String(floorKey || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
};

export const floorPlanService = {
  /**
   * Retrieves the floor plan configuration for a specific floor.
   */
  async getFloorPlan(tenantId: string, floorKey: string): Promise<IFloorPlanConfig | null> {
    if (!tenantId || !floorKey) return null;
    const safeKey = sanitizeFloorKey(floorKey);

    try {
      // 1. Try settings/floorPlan_{safeKey}
      const settingsRef = doc(db, 'restaurants', tenantId, 'settings', `floorPlan_${safeKey}`);
      const settingsSnap = await getDoc(settingsRef);
      if (settingsSnap.exists()) {
        return settingsSnap.data() as IFloorPlanConfig;
      }

      // 2. Try floorPlans/{safeKey} subcollection fallback
      const subRef = doc(db, 'restaurants', tenantId, 'floorPlans', safeKey);
      const subSnap = await getDoc(subRef);
      if (subSnap.exists()) {
        return subSnap.data() as IFloorPlanConfig;
      }
    } catch (err) {
      console.warn(`[floorPlanService] Failed reading floor plan for floor ${floorKey}:`, err);
    }
    return null;
  },

  /**
   * Subscribes to real-time updates for a floor plan layout.
   */
  subscribeFloorPlan(
    tenantId: string, 
    floorKey: string, 
    callback: (fp: IFloorPlanConfig | null) => void
  ): () => void {
    if (!tenantId || !floorKey) {
      callback(null);
      return () => {};
    }
    const safeKey = sanitizeFloorKey(floorKey);
    const settingsRef = doc(db, 'restaurants', tenantId, 'settings', `floorPlan_${safeKey}`);

    const unsub = onSnapshot(
      settingsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as IFloorPlanConfig);
        } else {
          // If settings document doesn't exist yet, try checking subcollection
          const subRef = doc(db, 'restaurants', tenantId, 'floorPlans', safeKey);
          getDoc(subRef).then(subSnap => {
            if (subSnap.exists()) {
              callback(subSnap.data() as IFloorPlanConfig);
            } else {
              callback(null);
            }
          }).catch(() => callback(null));
        }
      },
      (err) => {
        console.warn(`[floorPlanService] Floor plan listener error for ${floorKey}:`, err);
        callback(null);
      }
    );

    return unsub;
  },

  /**
   * Persists a floor plan layout and synchronizes table coordinates without duplicating records.
   */
  async saveFloorPlanLayout(
    tenantId: string,
    floorKey: string,
    floorName: string,
    layoutData: {
      elements: IArchitecturalElement[];
      tablePositions: Record<string, ITableVisualConfig>;
      canvasWidth?: number;
      canvasHeight?: number;
      physicalWidth?: number;
      physicalHeight?: number;
      measurementUnit?: 'meters' | 'feet';
      gridSnap?: boolean;
      gridSize?: number;
    },
    tablesToSync?: Array<{
      id: string;
      x: number;
      y: number;
      shape?: 'circle' | 'square' | 'rectangle';
      rotation?: number;
      floor?: string;
      section?: string;
    }>,
    userId?: string
  ): Promise<void> {
    if (!tenantId || !floorKey) {
      throw new Error('Tenant ID and floor reference are required to save layout.');
    }

    const safeKey = sanitizeFloorKey(floorKey);
    const nowIso = new Date().toISOString();

    const payload: IFloorPlanConfig = {
      id: `floorplan_${safeKey}`,
      floorId: floorKey,
      floorName: floorName || floorKey,
      tenantId,
      elements: layoutData.elements || [],
      tablePositions: layoutData.tablePositions || {},
      canvasWidth: layoutData.canvasWidth || 1000,
      canvasHeight: layoutData.canvasHeight || 700,
      physicalWidth: layoutData.physicalWidth,
      physicalHeight: layoutData.physicalHeight,
      measurementUnit: layoutData.measurementUnit || 'meters',
      gridSnap: layoutData.gridSnap ?? true,
      gridSize: layoutData.gridSize || 20,
      version: Date.now(),
      updatedAt: nowIso,
      updatedBy: userId || 'owner'
    };

    // 1. Write to settings/floorPlan_{safeKey}
    const settingsRef = doc(db, 'restaurants', tenantId, 'settings', `floorPlan_${safeKey}`);
    await setDoc(settingsRef, payload, { merge: true });

    // 2. Also write to floorPlans subcollection for clean discovery
    try {
      const subRef = doc(db, 'restaurants', tenantId, 'floorPlans', safeKey);
      await setDoc(subRef, payload, { merge: true });
    } catch (_) {}

    // 3. Batch-sync table coordinates to table documents so other apps (waiter, customer) stay in sync
    if (tablesToSync && tablesToSync.length > 0) {
      try {
        const batch = writeBatch(db);
        for (const t of tablesToSync) {
          if (!t.id) continue;
          const tableRef = doc(db, 'restaurants', tenantId, 'tables', t.id);
          const patch: any = {
            positionX: t.x,
            positionY: t.y,
            updatedAt: nowIso
          };
          if (t.shape) patch.shape = t.shape;
          if (t.rotation !== undefined) patch.rotation = t.rotation;
          if (t.floor) patch.floor = t.floor;
          if (t.section) patch.section = t.section;

          batch.set(tableRef, patch, { merge: true });
        }
        await batch.commit();
      } catch (tableSyncErr) {
        console.warn('[floorPlanService] Warning synchronizing table document coordinates:', tableSyncErr);
      }
    }
  },

  /**
   * Removes an architectural element from the floor plan layout.
   */
  async removeArchitecturalElement(
    tenantId: string,
    floorKey: string,
    elementId: string
  ): Promise<void> {
    const existing = await this.getFloorPlan(tenantId, floorKey);
    if (!existing) return;

    const updatedElements = existing.elements.filter(e => e.id !== elementId);
    await this.saveFloorPlanLayout(
      tenantId,
      floorKey,
      existing.floorName,
      {
        ...existing,
        elements: updatedElements
      }
    );
  },

  /**
   * Unplaces a table visually from the floor plan layout.
   * NOTE: This removes coordinates from tablePositions; it NEVER deletes the table record from Firestore.
   */
  async unplaceTable(
    tenantId: string,
    floorKey: string,
    tableId: string
  ): Promise<void> {
    const existing = await this.getFloorPlan(tenantId, floorKey);
    if (!existing) return;

    const updatedPositions = { ...existing.tablePositions };
    delete updatedPositions[tableId];

    await this.saveFloorPlanLayout(
      tenantId,
      floorKey,
      existing.floorName,
      {
        ...existing,
        tablePositions: updatedPositions
      }
    );
  }
};

