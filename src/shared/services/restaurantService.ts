import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ITenant } from '../types';

export interface IBranchItem {
  id: string;
  name: string;
  city?: string;
  address?: any;
  phone?: string;
  status?: string;
  type?: string;
  managerId?: string;
  managerName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IRestaurantWithBranches extends ITenant {
  branches?: IBranchItem[];
}

/**
 * Service to retrieve restaurants and branches strictly scoped by tenant & owner authorization.
 * Ensures zero cross-tenant leakage.
 */
export const restaurantService = {
  /**
   * Resolves only restaurants authorized for the current user.
   * - Super-admin: global list of restaurants
   * - Owner / Staff: strictly restricted to their own tenant/owned restaurants
   */
  async getAuthorizedRestaurants(user: { uid: string; tenantId?: string; role?: string } | null): Promise<ITenant[]> {
    if (!user) return [];

    const isSuperAdmin = user.role === 'super-admin';
    const restMap = new Map<string, ITenant>();

    if (isSuperAdmin) {
      try {
        const snapRest = await getDocs(collection(db, 'restaurants'));
        snapRest.forEach(d => {
          const data = d.data();
          restMap.set(d.id, { id: d.id, ...data } as ITenant);
        });

        // Supplement with tenants collection if any missing
        const snapTenants = await getDocs(collection(db, 'tenants'));
        snapTenants.forEach(d => {
          if (!restMap.has(d.id)) {
            restMap.set(d.id, { id: d.id, ...d.data() } as ITenant);
          }
        });
      } catch (err) {
        console.error('[restaurantService] Error fetching global restaurants for super-admin:', err);
      }
      return Array.from(restMap.values());
    }

    // OWNER / STAFF TENANT ISOLATION:
    // 1. Fetch user's primary assigned restaurant by ID
    const primaryTenantId = user.tenantId;
    if (primaryTenantId) {
      try {
        const rRef = doc(db, 'restaurants', primaryTenantId);
        const rSnap = await getDoc(rRef);
        if (rSnap.exists()) {
          restMap.set(rSnap.id, { id: rSnap.id, ...rSnap.data() } as ITenant);
        } else {
          // Fallback to tenants collection
          const tRef = doc(db, 'tenants', primaryTenantId);
          const tSnap = await getDoc(tRef);
          if (tSnap.exists()) {
            restMap.set(tSnap.id, { id: tSnap.id, ...tSnap.data() } as ITenant);
          }
        }
      } catch (err) {
        console.warn(`[restaurantService] Note fetching primary restaurant ${primaryTenantId}:`, err);
      }
    }

    // 2. Query any additional restaurants owned by this user via ownerUid
    if (user.uid) {
      try {
        const qOwnerRest = query(collection(db, 'restaurants'), where('ownerUid', '==', user.uid));
        const snapOwnerRest = await getDocs(qOwnerRest);
        snapOwnerRest.forEach(d => {
          if (!restMap.has(d.id)) {
            restMap.set(d.id, { id: d.id, ...d.data() } as ITenant);
          }
        });
      } catch (_) {}

      try {
        const qOwnerTenants = query(collection(db, 'tenants'), where('ownerUid', '==', user.uid));
        const snapOwnerTenants = await getDocs(qOwnerTenants);
        snapOwnerTenants.forEach(d => {
          if (!restMap.has(d.id)) {
            restMap.set(d.id, { id: d.id, ...d.data() } as ITenant);
          }
        });
      } catch (_) {}
    }

    return Array.from(restMap.values());
  },

  /**
   * Fetches branches registered under a specific restaurant.
   */
  async getAuthorizedBranches(restaurantId: string): Promise<IBranchItem[]> {
    if (!restaurantId) return [];
    try {
      const branchSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'branches'));
      const branchList: IBranchItem[] = [];
      branchSnap.forEach(d => {
        branchList.push({ id: d.id, ...d.data() } as IBranchItem);
      });
      return branchList;
    } catch (err) {
      console.warn(`[restaurantService] Error fetching branches for restaurant ${restaurantId}:`, err);
      return [];
    }
  },

  /**
   * Validates whether a given user has authorization to access a target restaurant ID.
   * Prevents URL parameter tampering (e.g. ?restaurantId=otherRestaurant).
   */
  async isTenantAuthorized(
    user: { uid: string; tenantId?: string; role?: string } | null, 
    targetTenantId: string
  ): Promise<boolean> {
    if (!user || !targetTenantId) return false;
    if (user.role === 'super-admin') return true;
    if (user.tenantId === targetTenantId) return true;

    // Check if user owns the target restaurant
    const authorized = await this.getAuthorizedRestaurants(user);
    return authorized.some(r => r.id === targetTenantId);
  }
};

export default restaurantService;
