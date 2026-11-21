import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously,
  signOut as firebaseSignOut, 
  sendPasswordResetEmail,
  sendEmailVerification,
  getIdTokenResult,
  setPersistence,
  browserSessionPersistence,
  User,
  UserCredential,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  ApplicationVerifier,
  linkWithPhoneNumber,
  linkWithCredential,
  EmailAuthProvider,
  ActionCodeSettings,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  applyActionCode as firebaseApplyActionCode,
  checkActionCode as firebaseCheckActionCode,
  ActionCodeInfo,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  linkWithPopup,
  fetchSignInMethodsForEmail,
  AuthCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './config';
import { TUserRole } from '../types';
import { getCurrencySymbol, detectDefaultCountryAndCurrency } from '../utils/format';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

export const signIn = async (email: string, password: string, _rememberMe?: boolean): Promise<UserCredential> => {
  // Always enforce tab-isolated browserSessionPersistence so login sessions never contaminate other tabs
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (persistErr) {
    console.warn('[AUTH signIn] Note setting session persistence:', persistErr);
  }
  return signInWithEmailAndPassword(auth, email, password);
};

export const signInAnonymousUser = async (): Promise<UserCredential> => {
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (persistErr) {
    console.warn('[AUTH signInAnonymousUser] Note setting session persistence:', persistErr);
  }
  return signInAnonymously(auth);
};

export const signUpOwner = async (
  email: string, 
  password: string, 
  displayName: string, 
  restaurantName: string,
  countryInput?: string,
  currencyInput?: string,
  localeInput?: string
): Promise<UserCredential> => {
  // Always enforce tab-isolated session persistence for owner signups
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (persistErr) {
    console.warn('[AUTH signUpOwner] Note setting session persistence:', persistErr);
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  const tenantId = `${slugify(restaurantName)}-${Math.random().toString(36).substring(2, 6)}`;

  // Determine localized settings
  const detected = detectDefaultCountryAndCurrency();
  const selectedCountry = countryInput || detected.country;
  const selectedCurrency = currencyInput || detected.currency;
  const selectedLocale = localeInput || detected.locale;
  const symbol = getCurrencySymbol(selectedCurrency);

  // 1. Create tenant document with null logo/cover and ownerUid
  const tenantRef = doc(db, 'tenants', tenantId);
  await setDoc(tenantRef, {
    id: tenantId,
    name: restaurantName,
    restaurantName,
    ownerUid: user.uid,
    logoUrl: null,
    logo: null,
    coverImageUrl: null,
    coverImage: null,
    planTier: 'starter',
    status: 'active',
    country: selectedCountry,
    currency: selectedCurrency,
    currencyCode: selectedCurrency,
    currencySymbol: symbol,
    locale: selectedLocale,
    address: { street: '', city: '', zipCode: '' },
    stripeCustomerId: '',
    stripeSubscriptionId: '',
    settings: {
      currency: selectedCurrency,
      currencySymbol: symbol,
      locale: selectedLocale,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      taxPercent: 5,
      serviceCharge: 0,
      tableServiceEnabled: true,
      qrOrderingEnabled: true,
      language: 'en'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 2. Create corresponding restaurant document with null logo/cover and ownerUid
  const restaurantRef = doc(db, 'restaurants', tenantId);
  await setDoc(restaurantRef, {
    id: tenantId,
    tenantId,
    name: restaurantName,
    restaurantName,
    ownerUid: user.uid,
    logoUrl: null,
    logo: null,
    coverImageUrl: null,
    coverImage: null,
    country: selectedCountry,
    currency: selectedCurrency,
    currencyCode: selectedCurrency,
    currencySymbol: symbol,
    locale: selectedLocale,
    cuisine: [],
    rating: 0,
    reviewCount: 0,
    priceRange: '$$',
    status: 'active',
    address: { street: '', city: '', zipCode: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 3. Create user profile in users/{uid} with ownerUid and tenantId
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    email,
    fullName: displayName,
    displayName,
    tenantId,
    role: 'owner' as TUserRole,
    status: 'active',
    branchId: '',
    createdAt: new Date().toISOString()
  });

  // Note: Newly created restaurants start with ZERO mock/demo data.
  // Tables, menus, inventory, staff, and strategies start completely empty.

  await user.getIdToken(true);
  return userCredential;
};

export const signUpCustomer = async (
  email: string, 
  password: string, 
  fullName: string,
  phoneNumber?: string
): Promise<UserCredential> => {
  // Always enforce tab-isolated session persistence for customer signups
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (persistErr) {
    console.warn('[AUTH signUpCustomer] Note setting session persistence:', persistErr);
  }

  let userCredential: UserCredential;

  // If the user is currently an anonymous guest diner, link credentials to preserve UID, orders, and sessions
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    try {
      const cred = EmailAuthProvider.credential(email.trim(), password.trim());
      userCredential = await linkWithCredential(auth.currentUser, cred);
      console.log('[AUTH signUpCustomer] Successfully linked anonymous account with email. Preserved UID:', userCredential.user.uid);
    } catch (linkErr: any) {
      if (linkErr.code === 'auth/email-already-in-use' || linkErr.code === 'auth/credential-already-in-use') {
        throw linkErr;
      }
      console.warn('[AUTH signUpCustomer] linkWithCredential failed, falling back to createUser:', linkErr);
      userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
    }
  } else {
    userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
  }

  const user = userCredential.user;

  // Create or merge customer profile in customers/{uid}
  const customerRef = doc(db, 'customers', user.uid);
  await setDoc(customerRef, {
    uid: user.uid,
    fullName: fullName.trim(),
    displayName: fullName.trim(),
    email: email.trim().toLowerCase(),
    role: 'customer' as TUserRole,
    tenantId: null,
    phoneNumber: phoneNumber?.trim() || '',
    walletBalance: 0,
    loyaltyPoints: 0,
    status: 'active',
    isAnonymous: false,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }, { merge: true });

  return userCredential;
};

export const getResetActionCodeSettings = (): ActionCodeSettings => {
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://dine.spiralworld.in';
  return {
    url: `${origin}/reset-password`,
    handleCodeInApp: true,
  };
};

export const resetPassword = async (
  email: string,
  _actionCodeSettings?: ActionCodeSettings
): Promise<void> => {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    const err = new Error('Email address is required.');
    (err as unknown as Record<string, unknown>).code = 'auth/invalid-email';
    throw err;
  }

  const response = await fetch('/api/auth/send-password-reset', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: cleanEmail }),
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : typeof data.message === 'string'
        ? data.message
        : 'Failed to dispatch password reset email.';
    const err = new Error(message);
    (err as unknown as Record<string, unknown>).code =
      typeof data.code === 'string'
        ? data.code
        : response.status === 429
        ? 'auth/too-many-requests'
        : 'auth/internal-error';
    throw err;
  }
};

export const verifyPasswordResetCode = async (actionCode: string): Promise<string> => {
  return firebaseVerifyPasswordResetCode(auth, actionCode);
};

export const confirmPasswordReset = async (actionCode: string, newPassword: string): Promise<void> => {
  return firebaseConfirmPasswordReset(auth, actionCode, newPassword);
};

export const applyActionCode = async (actionCode: string): Promise<void> => {
  return firebaseApplyActionCode(auth, actionCode);
};

export const checkActionCode = async (actionCode: string): Promise<ActionCodeInfo> => {
  return firebaseCheckActionCode(auth, actionCode);
};

export const signOut = async (): Promise<void> => {
  return firebaseSignOut(auth);
};

export const sendEmailVerificationLink = async (user: User): Promise<void> => {
  return sendEmailVerification(user);
};

export const getUserClaims = async (user: User): Promise<{ role?: TUserRole; tenantId?: string }> => {
  const tokenResult = await getIdTokenResult(user, true);
  const claims = tokenResult.claims;
  return {
    role: claims.role as TUserRole | undefined,
    tenantId: claims.tenantId as string | undefined
  };
};

export const createRecaptchaVerifier = (
  containerIdOrElement: string | HTMLElement,
  options?: {
    size?: 'invisible' | 'normal' | 'compact';
    callback?: (response: any) => void;
    'expired-callback'?: () => void;
  }
): RecaptchaVerifier => {
  return new RecaptchaVerifier(auth, containerIdOrElement, {
    size: options?.size || 'invisible',
    callback: options?.callback,
    'expired-callback': options?.['expired-callback']
  });
};

export const signInWithPhone = async (
  phoneNumber: string,
  appVerifier: ApplicationVerifier
): Promise<ConfirmationResult> => {
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (persistErr) {
    console.warn('[AUTH signInWithPhone] Note setting session persistence:', persistErr);
  }
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
};

export const confirmPhoneOtp = async (
  confirmationResult: ConfirmationResult,
  verificationCode: string
): Promise<UserCredential> => {
  return confirmationResult.confirm(verificationCode);
};

export const linkPhone = async (
  user: User,
  phoneNumber: string,
  appVerifier: ApplicationVerifier
): Promise<ConfirmationResult> => {
  return linkWithPhoneNumber(user, phoneNumber, appVerifier);
};

/**
 * Signs in a user using Firebase GoogleAuthProvider via popup.
 * Enforces browserSessionPersistence to preserve tab-isolated session behavior.
 */
export const signInWithGoogle = async (): Promise<UserCredential> => {
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (persistErr) {
    console.warn('[AUTH signInWithGoogle] Note setting session persistence:', persistErr);
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // If user is currently an anonymous guest diner, link Google credential to preserve guest UID/session
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    try {
      return await linkWithPopup(auth.currentUser, provider);
    } catch (linkErr: any) {
      if (linkErr.code === 'auth/credential-already-in-use' || linkErr.code === 'auth/email-already-in-use') {
        // Sign in normally with popup if credential belongs to an existing account
        return await signInWithPopup(auth, provider);
      }
      throw linkErr;
    }
  }

  return signInWithPopup(auth, provider);
};

/**
 * Initiates Google sign-in via full-page redirect (fallback for mobile/popup-blocked browsers).
 */
export const signInWithGoogleRedirect = async (): Promise<void> => {
  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (persistErr) {
    console.warn('[AUTH signInWithGoogleRedirect] Note setting session persistence:', persistErr);
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithRedirect(auth, provider);
};

/**
 * Retrieves the result of a Google redirect sign-in.
 */
export const getGoogleRedirectResult = async (): Promise<UserCredential | null> => {
  return getRedirectResult(auth);
};

/**
 * Onboards and registers a new restaurant owner using an existing Google-authenticated User.
 * If the user profile already exists, preserves their existing profile and tenant.
 */
export const signUpOwnerWithGoogle = async (
  googleUser: User,
  restaurantName: string,
  countryInput?: string,
  currencyInput?: string,
  localeInput?: string
): Promise<{ user: User; tenantId: string }> => {
  if (!googleUser || !googleUser.uid) {
    throw new Error('Google authentication is required before creating a restaurant account.');
  }

  try {
    await setPersistence(auth, browserSessionPersistence);
  } catch (persistErr) {
    console.warn('[AUTH signUpOwnerWithGoogle] Note setting session persistence:', persistErr);
  }

  // 1. Check if user profile already exists to prevent duplicate profiles or overwriting roles
  const userRef = doc(db, 'users', googleUser.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const data = userSnap.data();
    console.log('[AUTH signUpOwnerWithGoogle] User profile already exists in users/' + googleUser.uid);
    return {
      user: googleUser,
      tenantId: data.tenantId || ''
    };
  }

  // Also check if owner already has an existing tenant to prevent duplicate tenant creation
  try {
    const tenantsRef = collection(db, 'tenants');
    const qTenant = query(tenantsRef, where('ownerUid', '==', googleUser.uid));
    const snapTenant = await getDocs(qTenant);
    if (!snapTenant.empty) {
      const existingTenantId = snapTenant.docs[0].id;
      console.log('[AUTH signUpOwnerWithGoogle] Existing tenant found for owner UID:', existingTenantId);
      try {
        await setDoc(userRef, {
          uid: googleUser.uid,
          email: (googleUser.email || '').toLowerCase().trim(),
          displayName: googleUser.displayName || 'Restaurant Owner',
          tenantId: existingTenantId,
          role: 'owner' as TUserRole,
          status: 'active',
          branchId: '',
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (_e) {}
      return {
        user: googleUser,
        tenantId: existingTenantId
      };
    }
  } catch (tenantCheckErr) {
    console.warn('[AUTH signUpOwnerWithGoogle] Note checking existing tenant by ownerUid:', tenantCheckErr);
  }

  const tenantId = `${slugify(restaurantName)}-${Math.random().toString(36).substring(2, 6)}`;

  // Determine localized settings
  const detected = detectDefaultCountryAndCurrency();
  const selectedCountry = countryInput || detected.country;
  const selectedCurrency = currencyInput || detected.currency;
  const selectedLocale = localeInput || detected.locale;
  const symbol = getCurrencySymbol(selectedCurrency);

  // 2. Create tenant document
  const tenantRef = doc(db, 'tenants', tenantId);
  await setDoc(tenantRef, {
    id: tenantId,
    name: restaurantName,
    restaurantName,
    ownerUid: googleUser.uid,
    logoUrl: null,
    logo: null,
    coverImageUrl: null,
    coverImage: null,
    planTier: 'starter',
    status: 'active',
    country: selectedCountry,
    currency: selectedCurrency,
    currencyCode: selectedCurrency,
    currencySymbol: symbol,
    locale: selectedLocale,
    address: { street: '', city: '', zipCode: '' },
    stripeCustomerId: '',
    stripeSubscriptionId: '',
    settings: {
      currency: selectedCurrency,
      currencySymbol: symbol,
      locale: selectedLocale,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      taxPercent: 5,
      serviceCharge: 0,
      tableServiceEnabled: true,
      qrOrderingEnabled: true,
      language: 'en'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 3. Create corresponding restaurant document
  const restaurantRef = doc(db, 'restaurants', tenantId);
  await setDoc(restaurantRef, {
    id: tenantId,
    tenantId,
    name: restaurantName,
    restaurantName,
    ownerUid: googleUser.uid,
    logoUrl: null,
    logo: null,
    coverImageUrl: null,
    coverImage: null,
    country: selectedCountry,
    currency: selectedCurrency,
    currencyCode: selectedCurrency,
    currencySymbol: symbol,
    locale: selectedLocale,
    cuisine: [],
    rating: 0,
    reviewCount: 0,
    priceRange: '$$',
    status: 'active',
    address: { street: '', city: '', zipCode: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 4. Create user profile in users/{uid}
  const cleanEmail = (googleUser.email || '').toLowerCase().trim();
  const displayName = googleUser.displayName || cleanEmail.split('@')[0] || 'Restaurant Owner';

  try {
    await setDoc(userRef, {
      uid: googleUser.uid,
      email: cleanEmail,
      fullName: displayName,
      displayName,
      tenantId,
      role: 'owner' as TUserRole,
      status: 'active',
      branchId: '',
      createdAt: new Date().toISOString()
    });
  } catch (userWriteErr) {
    console.warn('[AUTH signUpOwnerWithGoogle] Direct users/{uid} write error (roleResolver will resolve via tenant record):', userWriteErr);
  }

  await googleUser.getIdToken(true);

  return {
    user: googleUser,
    tenantId
  };
};

/**
 * Onboards or logs in a customer diner using Google authentication.
 * If user has staff/owner credentials, reports it so the user can be directed to the business portal.
 */
export const signInOrRegisterCustomerWithGoogle = async (
  googleUser: User,
  phoneNumber?: string
): Promise<{ uid: string; role: TUserRole; isStaff?: boolean }> => {
  if (!googleUser || !googleUser.uid) {
    throw new Error('Google user is required.');
  }

  // 1. Check if user already has an owner or staff account in users/{uid}
  const userRef = doc(db, 'users', googleUser.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    if (userData.role && userData.role !== 'customer') {
      return {
        uid: googleUser.uid,
        role: userData.role as TUserRole,
        isStaff: true
      };
    }
  }

  // 2. Check if customer profile exists in customers/{uid}
  const customerRef = doc(db, 'customers', googleUser.uid);
  const custSnap = await getDoc(customerRef);
  if (custSnap.exists()) {
    return {
      uid: googleUser.uid,
      role: 'customer' as TUserRole,
      isStaff: false
    };
  }

  // 3. Create new customer profile
  const cleanEmail = (googleUser.email || '').toLowerCase().trim();
  const displayName = googleUser.displayName || cleanEmail.split('@')[0] || 'Customer';

  await setDoc(customerRef, {
    uid: googleUser.uid,
    fullName: displayName,
    displayName,
    email: cleanEmail,
    role: 'customer' as TUserRole,
    tenantId: null,
    phoneNumber: phoneNumber?.trim() || googleUser.phoneNumber || '',
    walletBalance: 0,
    loyaltyPoints: 0,
    status: 'active',
    isAnonymous: false,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  }, { merge: true });

  return {
    uid: googleUser.uid,
    role: 'customer' as TUserRole,
    isStaff: false
  };
};

/**
 * Safely extracts a pending Google AuthCredential from an authentication collision error.
 */
export const getGoogleCredentialFromError = (error: any): AuthCredential | null => {
  if (!error) return null;
  try {
    return GoogleAuthProvider.credentialFromError(error);
  } catch (_e) {
    return error.credential || null;
  }
};

/**
 * Retrieves the registered authentication provider methods for a given email address.
 */
export const getExistingSignInMethods = async (email: string): Promise<string[]> => {
  return fetchSignInMethodsForEmail(auth, email.trim().toLowerCase());
};

/**
 * Links an AuthCredential to an already-authenticated Firebase User.
 */
export const linkGoogleCredential = async (
  user: User,
  credential: AuthCredential
): Promise<UserCredential> => {
  return linkWithCredential(user, credential);
};

/**
 * Securely verifies ownership of an existing email/password account and links a pending Google credential.
 * Enforces: ONE PERSON = ONE FIREBASE ACCOUNT.
 * 1. Proves ownership of existing account via email and password verification.
 * 2. Links the pending Google credential to the existing Firebase UID.
 * 3. Never merges accounts on email equality alone; proof of password ownership is required.
 */
export const verifyAndLinkGoogleAccount = async (
  email: string,
  password: string,
  credential: AuthCredential
): Promise<UserCredential> => {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    throw new Error('Email address and password are required for account verification.');
  }
  if (!credential) {
    throw new Error('Pending Google credential is required to link accounts.');
  }

  // 1. Authenticate with existing email & password to verify ownership
  const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const existingUser = userCredential.user;

  // 2. Link pending Google credential directly to existing Firebase UID
  try {
    await linkWithCredential(existingUser, credential);
    console.log('[AUTH] Successfully linked Google credential to existing UID:', existingUser.uid);
  } catch (linkErr: any) {
    console.warn('[AUTH] linkWithCredential error:', linkErr);
    // If credential was already linked, proceed cleanly
    if (linkErr.code !== 'auth/credential-already-in-use') {
      throw linkErr;
    }
  }

  // 3. Force refresh token so providerData contains Google
  await existingUser.getIdToken(true);

  return userCredential;
};

/**
 * Reverse Provider Linking:
 * Securely establishes an Email/Password credential for an existing Firebase User (e.g. originally registered via Google).
 * Enforces: ONE PERSON = ONE FIREBASE ACCOUNT.
 * The original Firebase UID remains strictly unchanged.
 */
export const linkEmailPasswordCredential = async (
  user: User,
  password: string
): Promise<UserCredential> => {
  if (!user || !user.email) {
    throw new Error('An authenticated user session with a valid email address is required to link password credentials.');
  }
  const cleanPassword = password.trim();
  if (!cleanPassword || cleanPassword.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const credential = EmailAuthProvider.credential(user.email.trim().toLowerCase(), cleanPassword);
  const result = await linkWithCredential(user, credential);
  await user.getIdToken(true);
  console.log('[AUTH] Successfully established Email/Password credential for existing UID:', user.uid);
  return result;
};



