import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { authService } from './authService';
import { TUserRole, IUser, TAuthStatus } from '../types';
import { getDashboardRoute } from '../utils/navigation';
import { resolveAuthenticatedUser } from './roleResolver';

export interface IAuthContextType {
  user: IUser | null;
  role: TUserRole | null;
  tenantId: string | null;
  isLoading: boolean;
  authStatus: TAuthStatus;
  profileError: string | null;
  logout: () => Promise<void>;
  firebaseUser: User | null;
  ensureGuestAuth: () => Promise<User | null>;
}

const AuthContext = createContext<IAuthContextType | undefined>(undefined);

// Module-level concurrency and StrictMode singleton lock
let guestAuthPromise: Promise<User | null> | null = null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [user, setUser] = useState<IUser | null>(null);
  const [role, setRole] = useState<TUserRole | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authStatus, setAuthStatus] = useState<TAuthStatus>('AUTH_LOADING');

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;

    // Subscribe to Firebase Auth state updates
    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);

      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (fUser) {
        setIsLoading(true);
        setAuthStatus('PROFILE_LOADING');
        setProfileError(null);

        // Firebase Anonymous Guest Authentication: instantly authorize without querying user docs
        if (fUser.isAnonymous) {
          const guestUser: IUser = {
            uid: fUser.uid,
            email: '',
            displayName: 'Guest Diner',
            tenantId: '',
            role: 'customer',
            status: 'active',
            phoneNumber: '',
            isAnonymous: true,
            createdAt: fUser.metadata.creationTime || new Date().toISOString()
          };
          console.log('[AUTH Context] Anonymous guest diner authorized:', { uid: guestUser.uid });
          setUser(guestUser);
          setRole('customer');
          setTenantId('');
          setProfileError(null);
          setIsLoading(false);
          setAuthStatus('AUTHORIZED');
          return;
        }

        try {
          const userDocRef = doc(db, 'users', fUser.uid);
          const custDocRef = doc(db, 'customers', fUser.uid);

          let latestUserData: any = null;
          let latestUserExists = false;
          let latestCustData: any = null;
          let latestCustExists = false;

          const applyProfileUpdate = async () => {
            try {
              const isCustomerRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/customer');

              // 1. If currently in customer portal, customer profile takes precedence if present
              if (isCustomerRoute && latestCustExists && latestCustData) {
                const data = latestCustData;
                const resolvedUser: IUser = {
                  uid: fUser.uid,
                  email: (fUser.email || data.email || '').toLowerCase(),
                  displayName: data.fullName || data.displayName || fUser.displayName || 'Customer',
                  tenantId: data.tenantId || '',
                  role: 'customer' as TUserRole,
                  status: (data.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
                  phoneNumber: data.phoneNumber || data.phone || '',
                  createdAt: data.createdAt || fUser.metadata.creationTime || new Date().toISOString()
                };

                console.log('[AUTH Context] Profile loaded via customers snapshot (customer portal context):', {
                  uid: resolvedUser.uid,
                  role: resolvedUser.role
                });

                setUser(resolvedUser);
                setRole('customer');
                setTenantId(resolvedUser.tenantId);
                setProfileError(null);
                setIsLoading(false);
                setAuthStatus('AUTHORIZED');
                return;
              }

              // 1b. If currently in customer portal and diner doc does not exist yet, auto-provision from user doc
              if (isCustomerRoute && !latestCustExists && latestUserExists && latestUserData) {
                const cleanEmail = (fUser.email || latestUserData.email || '').toLowerCase().trim();
                const displayName = latestUserData.fullName || latestUserData.displayName || fUser.displayName || 'Diner';
                try {
                  const custRef = doc(db, 'customers', fUser.uid);
                  await setDoc(custRef, {
                    uid: fUser.uid,
                    fullName: displayName,
                    displayName,
                    email: cleanEmail,
                    role: 'customer' as TUserRole,
                    tenantId: null,
                    phoneNumber: fUser.phoneNumber || latestUserData.phoneNumber || '',
                    walletBalance: 0,
                    loyaltyPoints: 0,
                    status: 'active',
                    isAnonymous: false,
                    tier: 'bronze',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  }, { merge: true });
                } catch (autoCustErr) {
                  console.warn('[AUTH Context] Note auto-provisioning diner profile:', autoCustErr);
                }
              }

              // 2. Staff/Owner in users/{uid} takes precedence for non-customer portals
              if (latestUserExists && latestUserData?.role && latestUserData.role !== 'customer') {
                const data = latestUserData;
                let roleCandidate = data.role;
                try {
                  const tokenResult = await fUser.getIdTokenResult();
                  if (tokenResult?.claims?.role === 'super_admin' || tokenResult?.claims?.role === 'super-admin' || tokenResult?.claims?.super_admin === true) {
                    roleCandidate = 'super_admin';
                  }
                } catch (_e) {}
                const resolvedRole = (roleCandidate === 'super-admin' ? 'super_admin' : roleCandidate) as TUserRole;
                const resolvedUser: IUser = {
                  uid: fUser.uid,
                  email: (fUser.email || data.email || '').toLowerCase(),
                  displayName: data.fullName || data.displayName || fUser.displayName || 'User',
                  tenantId: data.tenantId || '',
                  role: resolvedRole,
                  status: (data.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
                  phoneNumber: data.phoneNumber || data.phone || '',
                  createdAt: data.createdAt || fUser.metadata.creationTime || new Date().toISOString()
                };

                console.log('[AUTH Context] Profile loaded via users snapshot:', {
                  uid: resolvedUser.uid,
                  role: resolvedUser.role,
                  tenantId: resolvedUser.tenantId
                });

                setUser(resolvedUser);
                setRole(resolvedUser.role);
                setTenantId(resolvedUser.tenantId);
                setProfileError(null);
                setIsLoading(false);
                setAuthStatus('AUTHORIZED');
                return;
              }

              // 3. Customer in customers/{uid} (fallback when outside customer route or only customer profile exists)
              if (latestCustExists && latestCustData) {
                const data = latestCustData;
                const resolvedUser: IUser = {
                  uid: fUser.uid,
                  email: (fUser.email || data.email || '').toLowerCase(),
                  displayName: data.fullName || data.displayName || fUser.displayName || 'Customer',
                  tenantId: data.tenantId || '',
                  role: 'customer' as TUserRole,
                  status: (data.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
                  phoneNumber: data.phoneNumber || data.phone || '',
                  createdAt: data.createdAt || fUser.metadata.creationTime || new Date().toISOString()
                };

                console.log('[AUTH Context] Profile loaded via customers snapshot:', {
                  uid: resolvedUser.uid,
                  role: resolvedUser.role
                });

                setUser(resolvedUser);
                setRole('customer');
                setTenantId(resolvedUser.tenantId);
                setProfileError(null);
                setIsLoading(false);
                setAuthStatus('AUTHORIZED');
                return;
              }

              // 3. User doc exists with role customer (legacy migration compatibility)
              if (latestUserExists && latestUserData?.role === 'customer') {
                const data = latestUserData;
                const resolvedUser: IUser = {
                  uid: fUser.uid,
                  email: (fUser.email || data.email || '').toLowerCase(),
                  displayName: data.fullName || data.displayName || fUser.displayName || 'Customer',
                  tenantId: data.tenantId || '',
                  role: 'customer' as TUserRole,
                  status: (data.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
                  phoneNumber: data.phoneNumber || data.phone || '',
                  createdAt: data.createdAt || fUser.metadata.creationTime || new Date().toISOString()
                };

                console.log('[AUTH Context] Profile loaded via legacy users customer snapshot:', {
                  uid: resolvedUser.uid,
                  role: resolvedUser.role
                });

                setUser(resolvedUser);
                setRole('customer');
                setTenantId(resolvedUser.tenantId);
                setProfileError(null);
                setIsLoading(false);
                setAuthStatus('AUTHORIZED');
                return;
              }

              // 4. Fallback to authoritative roleResolver (resolves owners via tenants/owners collection or claims)
              const profile = await resolveAuthenticatedUser(fUser);
              if (profile && profile.role) {
                const resolvedRole = (profile.role === 'super-admin' ? 'super_admin' : profile.role) as TUserRole;
                const resolvedUser: IUser = {
                  uid: profile.uid,
                  email: profile.email,
                  displayName: profile.displayName,
                  tenantId: profile.tenantId,
                  role: resolvedRole,
                  status: (profile.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
                  phoneNumber: profile.phoneNumber || '',
                  createdAt: profile.createdAt
                };

                console.log('[AUTH Context] Profile resolved via roleResolver:', {
                  uid: resolvedUser.uid,
                  role: resolvedUser.role,
                  tenantId: resolvedUser.tenantId
                });

                setUser(resolvedUser);
                setRole(resolvedUser.role);
                setTenantId(resolvedUser.tenantId);
                setProfileError(null);
                setIsLoading(false);
                setAuthStatus('AUTHORIZED');
                return;
              }

              // Neither exists yet (registration in progress)
              console.warn('[AUTH Context] Profile pending or missing for UID:', fUser.uid);
              setUser(null);
              setRole(null);
              setTenantId(null);
              setProfileError(`User profile is missing or not configured for UID: ${fUser.uid}.`);
              setIsLoading(false);
              setAuthStatus('PROFILE_MISSING');
            } catch (snapErr: any) {
              console.error('[AUTH Context] Error resolving profile snapshot data:', snapErr);
              setUser(null);
              setRole(null);
              setTenantId(null);
              setProfileError('Failed to load user session profile.');
              setIsLoading(false);
              setAuthStatus('PROFILE_MISSING');
            }
          };

          const unsubUser = onSnapshot(
            userDocRef,
            (snap) => {
              latestUserExists = snap.exists();
              latestUserData = snap.exists() ? snap.data() : null;
              applyProfileUpdate();
            },
            (error) => {
              console.warn('[AUTH Context] userDoc snapshot warning:', error?.message);
            }
          );

          const unsubCust = onSnapshot(
            custDocRef,
            (snap) => {
              latestCustExists = snap.exists();
              latestCustData = snap.exists() ? snap.data() : null;
              applyProfileUpdate();
            },
            (error) => {
              console.warn('[AUTH Context] custDoc snapshot warning:', error?.message);
            }
          );

          unsubscribeUserDoc = () => {
            unsubUser();
            unsubCust();
          };
        } catch (e: any) {
          console.error('[AUTH Context] Auth initialization error:', e);
          setUser(null);
          setRole(null);
          setTenantId(null);
          setProfileError('Failed to initialize session.');
          setIsLoading(false);
          setAuthStatus('PROFILE_MISSING');
        }
      } else {
        // Unauthenticated
        setUser(null);
        setRole(null);
        setTenantId(null);
        setProfileError(null);
        setIsLoading(false);
        setAuthStatus('UNAUTHORIZED');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, []);

  const logout = async () => {
    setIsLoading(true);
    try {
      // Clear tab-isolated sessionStorage only; preserve cross-tab independent states
      sessionStorage.clear();
      
      if (auth.currentUser) {
        await authService.signOutUser();
      }
    } catch (err) {
      console.error('[AUTH Logout Error]', err);
    } finally {
      setUser(null);
      setRole(null);
      setTenantId(null);
      setFirebaseUser(null);
      setProfileError(null);
      setIsLoading(false);
      setAuthStatus('UNAUTHORIZED');
      console.log('[AUTH] Deep session logout completed.');
    }
  };

  const ensureGuestAuth = async (): Promise<User | null> => {
    // 1. Wait for Firebase initial auth resolution if still starting up
    try {
      if (typeof (auth as any).authStateReady === 'function') {
        await (auth as any).authStateReady();
      }
    } catch (_) {}

    // 2. If already authenticated (returning guest, registered customer, or staff), reuse it
    if (auth.currentUser) {
      return auth.currentUser;
    }

    // 3. Concurrency & StrictMode lock: reuse in-flight anonymous sign-in promise
    if (guestAuthPromise) {
      return guestAuthPromise;
    }

    guestAuthPromise = (async () => {
      try {
        console.log('[AUTH Context] Triggering anonymous guest sign-in...');
        const cred = await authService.signInAnonymous();
        return cred.user;
      } catch (err) {
        console.error('[AUTH Context] Failed to ensure anonymous guest auth:', err);
        return null;
      } finally {
        guestAuthPromise = null;
      }
    })();

    return guestAuthPromise;
  };

  return (
    <AuthContext.Provider value={{ user, role, tenantId, isLoading, authStatus, profileError, logout, firebaseUser, ensureGuestAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
export default AuthContext;
