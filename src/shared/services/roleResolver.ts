import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TUserRole, IUser } from '../types';

export interface IResolvedUserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: TUserRole;
  tenantId: string;
  branchId?: string;
  department?: string;
  status?: 'active' | 'inactive';
  phoneNumber?: string;
  createdAt: string;
}

/**
 * Authoritative central user profile and role resolver.
 * 
 * Flow:
 * 1. Read authoritative profile from Firestore: users/{uid}
 * 2. If doc missing, check employees collection by firebaseUid or email for auto-provisioning
 * 3. Validate presence of explicit role
 * 4. NEVER default unknown users to 'owner' or 'customer'
 */
export async function resolveAuthenticatedUser(fUser: User): Promise<IResolvedUserProfile | null> {
  if (!fUser) return null;

  const cleanEmail = (fUser.email || '').trim().toLowerCase();
  const userDocRef = doc(db, 'users', fUser.uid);

  console.log('[AUTH ROLE RESOLVER] Resolving profile for UID:', fUser.uid, 'Email:', cleanEmail);

  // Check Firebase Auth Custom Claims first for authoritative Super Admin privilege
  try {
    const tokenResult = await fUser.getIdTokenResult();
    const claimRole = tokenResult?.claims?.role;
    const isSuperAdminClaim = claimRole === 'super_admin' || claimRole === 'super-admin' || tokenResult?.claims?.super_admin === true;
    if (isSuperAdminClaim) {
      console.log('[AUTH ROLE RESOLVER] Authoritative super_admin claim detected for UID:', fUser.uid);
      return {
        uid: fUser.uid,
        email: cleanEmail,
        displayName: fUser.displayName || cleanEmail.split('@')[0] || 'Super Admin',
        role: 'super_admin',
        tenantId: '',
        branchId: '',
        department: 'Platform Administration',
        status: 'active',
        phoneNumber: fUser.phoneNumber || '',
        createdAt: fUser.metadata.creationTime || new Date().toISOString()
      };
    }
  } catch (claimErr) {
    console.warn('[AUTH ROLE RESOLVER] Unable to inspect token claims:', claimErr);
  }

  let userSnap;
  try {
    userSnap = await getDoc(userDocRef);
  } catch (err: any) {
    console.error('[AUTH ROLE RESOLVER] Firestore permission error reading users/' + fUser.uid, err);
    throw new Error('PERMISSION_DENIED_USER_PROFILE');
  }

  // 1. Check customers/{uid} for customer-side accounts
  try {
    const custDocRef = doc(db, 'customers', fUser.uid);
    const custSnap = await getDoc(custDocRef);
    if (custSnap.exists()) {
      const custData = custSnap.data();
      const resolvedCust: IResolvedUserProfile = {
        uid: fUser.uid,
        email: cleanEmail || custData.email || '',
        displayName: custData.fullName || custData.displayName || fUser.displayName || cleanEmail.split('@')[0] || 'Customer',
        role: 'customer' as TUserRole,
        tenantId: custData.tenantId || '',
        branchId: '',
        department: '',
        status: custData.status || 'active',
        phoneNumber: custData.phoneNumber || custData.phone || '',
        createdAt: custData.createdAt || fUser.metadata.creationTime || new Date().toISOString()
      };

      console.log('[AUTH ROLE RESOLVER] Resolved customer profile from customers/' + fUser.uid, {
        uid: resolvedCust.uid,
        role: resolvedCust.role
      });

      return resolvedCust;
    }
  } catch (custErr: any) {
    console.warn('[AUTH ROLE RESOLVER] Note checking customers/' + fUser.uid + ':', custErr?.message || custErr);
  }

  // 2. Read restaurant-side profile from Firestore: users/{uid} (or legacy customer fallback)
  if (userSnap.exists()) {
    const data = userSnap.data();
    if (!data.role) {
      console.warn('[AUTH ROLE RESOLVER] Profile doc exists in users/' + fUser.uid + ' but has no role field.');
      return null;
    }

    const rawRole = data.role;
    const resolvedRole: TUserRole = (rawRole === 'super-admin' ? 'super_admin' : rawRole) as TUserRole;

    const resolved: IResolvedUserProfile = {
      uid: fUser.uid,
      email: cleanEmail || data.email || '',
      displayName: data.fullName || data.displayName || fUser.displayName || cleanEmail.split('@')[0] || 'User',
      role: resolvedRole,
      tenantId: data.tenantId || data.restaurantId || '',
      branchId: data.branchId || '',
      department: data.department || '',
      status: data.status || 'active',
      phoneNumber: data.phoneNumber || '',
      createdAt: data.createdAt || fUser.metadata.creationTime || new Date().toISOString()
    };

    if (resolved.role === 'customer') {
      console.log('[AUTH ROLE RESOLVER] Resolved customer from legacy users/' + fUser.uid + ' (migration fallback):', {
        uid: resolved.uid,
        role: resolved.role
      });
    } else {
      console.log('[AUTH ROLE RESOLVER] Resolved from users/' + fUser.uid + ':', {
        uid: resolved.uid,
        role: resolved.role,
        tenantId: resolved.tenantId
      });
    }

    return resolved;
  }

  // 2. Check owners/{uid} collection if owner profiles are stored there
  try {
    const ownerDocRef = doc(db, 'owners', fUser.uid);
    const ownerSnap = await getDoc(ownerDocRef);
    if (ownerSnap.exists()) {
      const data = ownerSnap.data();
      const resolved: IResolvedUserProfile = {
        uid: fUser.uid,
        email: cleanEmail || data.email || '',
        displayName: data.fullName || data.name || data.displayName || fUser.displayName || 'Restaurant Owner',
        role: (data.role || 'owner') as TUserRole,
        tenantId: data.tenantId || data.restaurantId || ownerSnap.id,
        branchId: data.branchId || '',
        department: 'Management',
        status: data.status || 'active',
        phoneNumber: data.phoneNumber || '',
        createdAt: data.createdAt || new Date().toISOString()
      };
      console.log('[AUTH ROLE RESOLVER] Resolved from owners/' + fUser.uid + ':', {
        uid: resolved.uid,
        role: resolved.role,
        tenantId: resolved.tenantId
      });
      // Synchronize to users/{uid} for consistent fast lookups
      try {
        await setDoc(userDocRef, resolved);
      } catch (_e) {}
      return resolved;
    }
  } catch (_ownerErr) {
    // collection may not exist or not allowed
  }

  // 3. Check tenants collection where ownerUid or ownerId matches Firebase UID
  try {
    const tenantsRef = collection(db, 'tenants');
    const qTenant = query(tenantsRef, where('ownerUid', '==', fUser.uid));
    const snapTenant = await getDocs(qTenant);
    if (!snapTenant.empty) {
      const tDoc = snapTenant.docs[0];
      const tData = tDoc.data();
      const resolved: IResolvedUserProfile = {
        uid: fUser.uid,
        email: cleanEmail || tData.email || '',
        displayName: tData.ownerName || tData.name || fUser.displayName || 'Restaurant Owner',
        role: 'owner',
        tenantId: tDoc.id,
        branchId: '',
        department: 'Management',
        status: 'active',
        phoneNumber: tData.phone || '',
        createdAt: tData.createdAt || new Date().toISOString()
      };
      console.log('[AUTH ROLE RESOLVER] Resolved from tenants (ownerUid):', {
        uid: resolved.uid,
        role: resolved.role,
        tenantId: resolved.tenantId
      });
      try {
        await setDoc(userDocRef, resolved);
      } catch (_e) {}
      return resolved;
    }
  } catch (_tenantErr) {}

  // 4. Check restaurants collection where ownerUid or ownerId matches Firebase UID
  try {
    const restRef = collection(db, 'restaurants');
    const qRest = query(restRef, where('ownerUid', '==', fUser.uid));
    const snapRest = await getDocs(qRest);
    if (!snapRest.empty) {
      const rDoc = snapRest.docs[0];
      const rData = rDoc.data();
      const resolved: IResolvedUserProfile = {
        uid: fUser.uid,
        email: cleanEmail || rData.email || '',
        displayName: rData.ownerName || rData.name || fUser.displayName || 'Restaurant Owner',
        role: 'owner',
        tenantId: rDoc.id,
        branchId: '',
        department: 'Management',
        status: 'active',
        phoneNumber: rData.phone || '',
        createdAt: rData.createdAt || new Date().toISOString()
      };
      console.log('[AUTH ROLE RESOLVER] Resolved from restaurants (ownerUid):', {
        uid: resolved.uid,
        role: resolved.role,
        tenantId: resolved.tenantId
      });
      try {
        await setDoc(userDocRef, resolved);
      } catch (_e) {}
      return resolved;
    }
  } catch (_restErr) {}

  // 5. Profile missing: Check employees collection by firebaseUid
  console.warn(`[AUTH ROLE RESOLVER] Profile document missing at users/${fUser.uid}. Searching employees collection...`);
  let empData: any = null;
  try {
    const empRef = collection(db, 'employees');
    const qUid = query(empRef, where('firebaseUid', '==', fUser.uid));
    const snapUid = await getDocs(qUid);

    if (!snapUid.empty) {
      empData = snapUid.docs[0].data();
    }
  } catch (empErr: any) {
    console.warn('[AUTH ROLE RESOLVER] Employee lookup by UID failed:', empErr);
  }

  if (empData && empData.role) {
    console.log('[AUTH ROLE RESOLVER] Found matching employee record. Provisioning users/' + fUser.uid + '...');
    const now = new Date().toISOString();
    const profileDoc: IResolvedUserProfile = {
      uid: fUser.uid,
      email: cleanEmail || empData.email || '',
      displayName: empData.fullName || empData.name || fUser.displayName || 'Staff Member',
      role: empData.role as TUserRole,
      tenantId: empData.tenantId || '',
      branchId: empData.branchId || '',
      department: empData.department || '',
      status: empData.status || 'active',
      phoneNumber: empData.phoneNumber || empData.phone || '',
      createdAt: now
    };

    try {
      await setDoc(userDocRef, profileDoc);
      console.log('[AUTH ROLE RESOLVER] Successfully provisioned users/' + fUser.uid);
      return profileDoc;
    } catch (setErr) {
      console.error('[AUTH ROLE RESOLVER] Failed to setDoc users/' + fUser.uid, setErr);
      return profileDoc;
    }
  }

  // IMPORTANT: UNKNOWN ROLE MUST NEVER BECOME CUSTOMER
  console.warn('[AUTH ROLE RESOLVER] No authoritative profile document found for UID:', fUser.uid);
  return null;
}
