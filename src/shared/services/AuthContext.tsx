import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { authService } from './authService';
import { TUserRole, IUser, TAuthStatus } from '../types';
import { getDashboardRoute } from '../utils/navigation';

export interface IAuthContextType {
  user: IUser | null;
  role: TUserRole | null;
  tenantId: string | null;
  isLoading: boolean;
  authStatus: TAuthStatus;
  profileError: string | null;
  logout: () => Promise<void>;
  firebaseUser: User | null;
}

const AuthContext = createContext<IAuthContextType | undefined>(undefined);

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

        try {
          // Check if customer profile exists at customers/{uid}
          const custDocRef = doc(db, 'customers', fUser.uid);
          let isCustomerProfile = false;
          try {
            const custSnap = await getDoc(custDocRef);
            if (custSnap.exists()) {
              isCustomerProfile = true;
            }
          } catch (_err) {}

          const profileDocRef = isCustomerProfile ? custDocRef : doc(db, 'users', fUser.uid);

          // Real-time listener for user or customer profile updates
          unsubscribeUserDoc = onSnapshot(
            profileDocRef,
            async (userDoc) => {
              try {
                if (userDoc.exists() && (userDoc.data().role || isCustomerProfile)) {
                  const data = userDoc.data();
                  let roleCandidate = data.role || (isCustomerProfile ? 'customer' : null);
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
                    displayName: data.fullName || data.displayName || fUser.displayName || (resolvedRole === 'customer' ? 'Customer' : 'User'),
                    tenantId: data.tenantId || '',
                    role: resolvedRole,
                    status: (data.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
                    phoneNumber: data.phoneNumber || data.phone || '',
                    createdAt: data.createdAt || fUser.metadata.creationTime || new Date().toISOString()
                  };

                  console.log('[AUTH Context] Profile loaded via snapshot (' + (isCustomerProfile ? 'customers' : 'users') + '):', {
                    uid: resolvedUser.uid,
                    email: resolvedUser.email,
                    role: resolvedUser.role,
                    tenantId: resolvedUser.tenantId
                  });

                  setUser(resolvedUser);
                  setRole(resolvedUser.role);
                  setTenantId(resolvedUser.tenantId);
                  setProfileError(null);
                  setIsLoading(false);
                  setAuthStatus('AUTHORIZED');
                } else {
                  // Document missing or role missing — call authoritative roleResolver
                  const { resolveAuthenticatedUser } = await import('./roleResolver');
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
                  } else {
                    console.warn('[AUTH Context] Profile missing or unassigned role for UID:', fUser.uid);
                    setUser(null);
                    setRole(null);
                    setTenantId(null);
                    setProfileError(`User profile is missing or not configured for UID: ${fUser.uid}.`);
                    setIsLoading(false);
                    setAuthStatus('PROFILE_MISSING');
                  }
                }
              } catch (snapErr: any) {
                console.error('[AUTH Context] Error parsing snapshot data:', snapErr);
                setUser(null);
                setRole(null);
                setTenantId(null);
                setProfileError('Failed to load user session profile.');
                setIsLoading(false);
                setAuthStatus('PROFILE_MISSING');
              }
            },
            (error) => {
              console.error('[AUTH Context] Database snapshot listener error:', error);
              setUser(null);
              setRole(null);
              setTenantId(null);
              if (error.code === 'permission-denied') {
                setProfileError('Permission denied reading your user profile.');
              } else {
                setProfileError('Database snapshot listener error.');
              }
              setIsLoading(false);
              setAuthStatus('PROFILE_MISSING');
            }
          );
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

  return (
    <AuthContext.Provider value={{ user, role, tenantId, isLoading, authStatus, profileError, logout, firebaseUser }}>
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
