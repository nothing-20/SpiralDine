import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TUserRole, IUser } from '../types';

export interface IResolvedUserProfile {
  uid: string;
  email: string;
  displayName: string;
  fullName?: string;
  role: TUserRole;
  tenantId: string;
  branchId?: string;
  department?: string;
  status?: 'active' | 'approved' | 'inactive' | 'pending_approval' | 'rejected' | 'more_info_required';
  phoneNumber?: string;
  createdAt: string;
  updatedAt?: string;
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

  // Handle Firebase Anonymous Guest Authentication directly
  if (fUser.isAnonymous) {
    return {
      uid: fUser.uid,
      email: '',
      displayName: 'Guest Diner',
      role: 'customer' as TUserRole,
      tenantId: '',
      branchId: '',
      department: '',
      status: 'active',
      phoneNumber: '',
      createdAt: fUser.metadata.creationTime || new Date().toISOString()
    };
  }

  const cleanEmail = (fUser.email || '').trim().toLowerCase();
  const userDocRef = doc(db, 'users', fUser.uid);

  console.log('[AUTH ROLE RESOLVER] Resolving profile for UID:', fUser.uid);

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

  // =========================================================================
  // STEP 1: Authoritative Precedence — Existing Staff / Owner in users/{uid}
  // Existing staff or owner accounts MUST NEVER be demoted or overwritten as customer.
  // =========================================================================
  if (userSnap.exists()) {
    const data = userSnap.data();
    if (!data.role) {
      console.warn('[AUTH ROLE RESOLVER] Profile doc exists in users/' + fUser.uid + ' but has no role field.');
      return null;
    }

    const rawRole = data.role;
    const resolvedRole: TUserRole = (rawRole === 'super-admin' ? 'super_admin' : rawRole) as TUserRole;

    if (resolvedRole !== 'customer') {
      // Authoritative Staff / Business Owner / Super Admin
      const resolved: IResolvedUserProfile = {
        uid: fUser.uid,
        email: cleanEmail || data.email || '',
        displayName: data.fullName || data.displayName || fUser.displayName || cleanEmail.split('@')[0] || 'User',
        role: resolvedRole,
        tenantId: data.tenantId || data.restaurantId || '',
        branchId: data.branchId || '',
        department: data.department || '',
        status: data.status || 'active',
        phoneNumber: data.phoneNumber || fUser.phoneNumber || '',
        createdAt: data.createdAt || fUser.metadata.creationTime || new Date().toISOString()
      };

      console.log('[AUTH ROLE RESOLVER] Resolved authoritative staff/owner profile from users/' + fUser.uid + ':', {
        uid: resolved.uid,
        role: resolved.role,
        tenantId: resolved.tenantId
      });

      return resolved;
    } else {
      // Existing customer profile indicated in users/{uid} — fetch rich customer data from customers/{uid}
      try {
        const custDocRef = doc(db, 'customers', fUser.uid);
        const custSnap = await getDoc(custDocRef);
        if (custSnap.exists()) {
          const custData = custSnap.data();
          return {
            uid: fUser.uid,
            email: cleanEmail || custData.email || data.email || '',
            displayName: custData.fullName || custData.displayName || data.fullName || data.displayName || 'Customer',
            role: 'customer' as TUserRole,
            tenantId: custData.tenantId || '',
            branchId: '',
            department: '',
            status: custData.status || data.status || 'active',
            phoneNumber: custData.phoneNumber || data.phoneNumber || fUser.phoneNumber || '',
            createdAt: custData.createdAt || data.createdAt || new Date().toISOString()
          };
        }
      } catch (_custErr) {}

      // Fallback to customer data in users/{uid}
      return {
        uid: fUser.uid,
        email: cleanEmail || data.email || '',
        displayName: data.fullName || data.displayName || fUser.displayName || 'Customer',
        role: 'customer' as TUserRole,
        tenantId: '',
        branchId: '',
        department: '',
        status: data.status || 'active',
        phoneNumber: data.phoneNumber || fUser.phoneNumber || '',
        createdAt: data.createdAt || new Date().toISOString()
      };
    }
  }

  // =========================================================================
  // STEP 2: Precedence Check — Owner Collections (owners, tenants, restaurants)
  // =========================================================================
  try {
    const ownerDocRef = doc(db, 'owners', fUser.uid);
    const ownerSnap = await getDoc(ownerDocRef);
    if (ownerSnap.exists()) {
      const data = ownerSnap.data();
      const resolved: IResolvedUserProfile = {
        uid: fUser.uid,
        email: cleanEmail || data.email || '',
        displayName: data.fullName || data.name || data.displayName || fUser.displayName || cleanEmail.split('@')[0] || 'Authorized Owner',
        role: (data.role || 'owner') as TUserRole,
        tenantId: data.tenantId || data.restaurantId || ownerSnap.id,
        branchId: data.branchId || '',
        department: 'Management',
        status: data.status || 'active',
        phoneNumber: data.phoneNumber || fUser.phoneNumber || '',
        createdAt: data.createdAt || new Date().toISOString()
      };
      console.log('[AUTH ROLE RESOLVER] Resolved from owners/' + fUser.uid + ':', {
        uid: resolved.uid,
        role: resolved.role,
        tenantId: resolved.tenantId
      });
      try {
        await setDoc(userDocRef, resolved);
      } catch (_e) {}
      return resolved;
    }
  } catch (_ownerErr) {}

  try {
    const tenantsRef = collection(db, 'tenants');
    const qTenant = query(tenantsRef, where('ownerUid', '==', fUser.uid));
    const snapTenant = await getDocs(qTenant);
    if (!snapTenant.empty) {
      const tDoc = snapTenant.docs[0];
      const tData = tDoc.data();
      const rawStatus = tData.status;
      const resolvedStatus = (rawStatus === 'active' || rawStatus === 'approved') ? 'active' : (rawStatus || 'pending_approval');
      const resolved: IResolvedUserProfile = {
        uid: fUser.uid,
        email: cleanEmail || tData.email || '',
        displayName: tData.ownerName || tData.name || fUser.displayName || cleanEmail.split('@')[0] || 'Authorized Owner',
        role: 'owner',
        tenantId: tDoc.id,
        branchId: '',
        department: 'Management',
        status: resolvedStatus,
        phoneNumber: tData.phone || fUser.phoneNumber || '',
        createdAt: tData.createdAt || new Date().toISOString()
      };
      console.log('[AUTH ROLE RESOLVER] Resolved from tenants (ownerUid):', {
        uid: resolved.uid,
        role: resolved.role,
        tenantId: resolved.tenantId,
        status: resolved.status
      });
      try {
        await setDoc(userDocRef, resolved);
      } catch (_e) {}
      return resolved;
    }
  } catch (_tenantErr) {}

  try {
    const restRef = collection(db, 'restaurants');
    const qRest = query(restRef, where('ownerUid', '==', fUser.uid));
    const snapRest = await getDocs(qRest);
    if (!snapRest.empty) {
      const rDoc = snapRest.docs[0];
      const rData = rDoc.data();
      const rawStatus = rData.status;
      const resolvedStatus = (rawStatus === 'active' || rawStatus === 'approved') ? 'active' : (rawStatus || 'pending_approval');
      const resolved: IResolvedUserProfile = {
        uid: fUser.uid,
        email: cleanEmail || rData.email || '',
        displayName: rData.ownerName || rData.name || fUser.displayName || cleanEmail.split('@')[0] || 'Authorized Owner',
        role: 'owner',
        tenantId: rDoc.id,
        branchId: '',
        department: 'Management',
        status: resolvedStatus,
        phoneNumber: rData.phone || fUser.phoneNumber || '',
        createdAt: rData.createdAt || new Date().toISOString()
      };
      console.log('[AUTH ROLE RESOLVER] Resolved from restaurants (ownerUid):', {
        uid: resolved.uid,
        role: resolved.role,
        tenantId: resolved.tenantId,
        status: resolved.status
      });
      try {
        await setDoc(userDocRef, resolved);
      } catch (_e) {}
      return resolved;
    }
  } catch (_restErr) {}

  // =========================================================================
  // STEP 3: Precedence Check — Employees Collection (Staff auto-provisioning)
  // Check employees collection before customer auto-provisioning so staff
  // with mobile numbers are never erroneously classified as customers.
  // =========================================================================
  let empData: any = null;
  try {
    const empRef = collection(db, 'employees');
    const qUid = query(empRef, where('firebaseUid', '==', fUser.uid));
    const snapUid = await getDocs(qUid);

    if (!snapUid.empty) {
      empData = snapUid.docs[0].data();
    } else if (cleanEmail) {
      const qEmail = query(empRef, where('email', '==', cleanEmail));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        empData = snapEmail.docs[0].data();
      }
    }
  } catch (empErr: any) {
    console.warn('[AUTH ROLE RESOLVER] Employee lookup failed:', empErr);
  }

  if (empData && empData.role) {
    console.log('[AUTH ROLE RESOLVER] Found matching employee record. Provisioning users/' + fUser.uid + '...');
    const now = new Date().toISOString();
    const profileDoc: IResolvedUserProfile = {
      uid: fUser.uid,
      email: cleanEmail || empData.email || '',
      displayName: empData.fullName || empData.name || fUser.displayName || cleanEmail.split('@')[0] || 'Staff Member',
      role: empData.role as TUserRole,
      tenantId: empData.tenantId || '',
      branchId: empData.branchId || '',
      department: empData.department || '',
      status: empData.status || 'active',
      phoneNumber: empData.phoneNumber || empData.phone || fUser.phoneNumber || '',
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

  // =========================================================================
  // STEP 4: Diner / Customer Resolution & Auto-Provisioning
  // Only reached if user is NOT an owner, staff member, or superadmin.
  // =========================================================================
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
        phoneNumber: custData.phoneNumber || custData.phone || fUser.phoneNumber || '',
        createdAt: custData.createdAt || fUser.metadata.creationTime || new Date().toISOString()
      };

      console.log('[AUTH ROLE RESOLVER] Resolved customer profile from customers/' + fUser.uid, {
        uid: resolvedCust.uid,
        role: resolvedCust.role
      });

      // Synchronize to users/{uid} for consistent fast lookups and Firestore rules userExists()
      try {
        await setDoc(userDocRef, resolvedCust, { merge: true });
      } catch (_e) {}

      return resolvedCust;
    } else if (fUser.phoneNumber) {
      // Verified phone customer with no staff/owner records.
      // Auto-provision canonical customer profile to prevent race conditions during sign-in.
      console.log('[AUTH ROLE RESOLVER] Verified phone customer detected. Auto-provisioning customers/' + fUser.uid);
      const now = new Date().toISOString();
      const phoneDigits = fUser.phoneNumber.replace(/\D/g, '');
      const phoneLast4 = phoneDigits.slice(-4) || 'Diner';
      const defaultName = fUser.displayName || `Diner ${phoneLast4}`;

      const newCustProfile = {
        uid: fUser.uid,
        email: cleanEmail || '',
        fullName: defaultName,
        displayName: defaultName,
        phoneNumber: fUser.phoneNumber,
        role: 'customer' as TUserRole,
        tenantId: null,
        walletBalance: 0,
        loyaltyPoints: 0,
        status: 'active' as const,
        isAnonymous: false,
        createdAt: now,
        updatedAt: now
      };

      try {
        await setDoc(custDocRef, newCustProfile, { merge: true });
      } catch (writeErr) {
        console.warn('[AUTH ROLE RESOLVER] Non-blocking customers/' + fUser.uid + ' write warning:', writeErr);
      }

      const resolvedCust: IResolvedUserProfile = {
        uid: fUser.uid,
        email: cleanEmail || '',
        displayName: defaultName,
        fullName: defaultName,
        role: 'customer' as TUserRole,
        tenantId: '',
        branchId: '',
        department: '',
        status: 'active',
        phoneNumber: fUser.phoneNumber,
        createdAt: now,
        updatedAt: now
      };

      try {
        await setDoc(userDocRef, resolvedCust, { merge: true });
      } catch (_e) {}

      console.log('[AUTH ROLE RESOLVER] Successfully auto-provisioned customer profile for UID:', fUser.uid);
      return resolvedCust;
    }
  } catch (custErr: any) {
    console.warn('[AUTH ROLE RESOLVER] Note checking customers/' + fUser.uid + ':', custErr?.message || custErr);
  }

  // =========================================================================
  // STEP 5: Unknown Account — Fail Safely
  // IMPORTANT: UNKNOWN ROLE MUST NEVER DEFAULT TO CUSTOMER OR OWNER
  // =========================================================================
  console.warn('[AUTH ROLE RESOLVER] No authoritative profile document found for UID:', fUser.uid);
  return null;
}
