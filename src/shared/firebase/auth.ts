import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInAnonymously,
  signOut as firebaseSignOut, 
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
  PhoneAuthProvider,
  ActionCodeSettings,
  verifyPasswordResetCode as firebaseVerifyPasswordResetCode,
  confirmPasswordReset as firebaseConfirmPasswordReset
} from 'firebase/auth';
import { doc, setDoc, getDoc, runTransaction } from 'firebase/firestore';
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
    ownerEmail: email.trim().toLowerCase(),
    ownerName: displayName.trim(),
    logoUrl: null,
    logo: null,
    coverImageUrl: null,
    coverImage: null,
    planTier: 'starter',
    status: 'pending_approval',
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

  // 2. Create corresponding restaurant document with pending_approval status
  const restaurantRef = doc(db, 'restaurants', tenantId);
  await setDoc(restaurantRef, {
    id: tenantId,
    tenantId,
    name: restaurantName,
    restaurantName,
    ownerUid: user.uid,
    ownerEmail: email.trim().toLowerCase(),
    ownerName: displayName.trim(),
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
    status: 'pending_approval',
    address: { street: '', city: '', zipCode: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // 3. Create user profile in users/{uid} with pending_approval status
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    email: email.trim().toLowerCase(),
    fullName: displayName.trim(),
    displayName: displayName.trim(),
    tenantId,
    role: 'owner' as TUserRole,
    status: 'pending_approval',
    branchId: '',
    createdAt: new Date().toISOString()
  });

  // 4. Synchronize restaurant registration application document (safe write)
  try {
    const appRef = doc(db, 'restaurantApplications', tenantId);
    await setDoc(appRef, {
      id: tenantId,
      tenantId,
      restaurantName,
      ownerUid: user.uid,
      ownerEmail: email.trim().toLowerCase(),
      ownerName: displayName.trim(),
      country: selectedCountry,
      currency: selectedCurrency,
      currencyCode: selectedCurrency,
      currencySymbol: symbol,
      locale: selectedLocale,
      status: 'pending_approval',
      submittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (appErr) {
    console.warn('[AUTH signUpOwner] Note: restaurantApplications sync handled:', appErr);
  }

  // 5. Trigger asynchronous administrator notification (non-blocking)
  try {
    const token = await user.getIdToken();
    fetch('/api/notify-admin-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        applicationId: tenantId,
        tenantId,
        restaurantName,
        ownerEmail: email.trim().toLowerCase(),
        ownerName: displayName.trim(),
        country: selectedCountry,
        currency: selectedCurrency
      })
    }).catch((err) => {
      console.warn('[AUTH signUpOwner] Admin notification dispatched (status handled):', err);
    });
  } catch (notifErr) {
    console.warn('[AUTH signUpOwner] Failed to initiate admin notification fetch:', notifErr);
  }

  // Note: Newly created restaurants start with ZERO mock/demo data.
  // Tables, menus, inventory, staff, and strategies start completely empty.

  await user.getIdToken(true);
  return userCredential;
};

/**
 * Canonical customer profile management: ensures a customer document exists in customers/{uid}
 * and is synchronized to users/{uid} for fast resolution and Firestore rules compatibility.
 * Idempotently creates default profile if missing, or merges phone/active state if existing.
 * NEVER overwrites existing wallet balance, loyalty points, or display names.
 */
export const ensureCustomerProfile = async (
  user: User,
  extra?: {
    fullName?: string;
    displayName?: string;
    phoneNumber?: string;
    email?: string;
    wasLinked?: boolean;
  }
): Promise<any> => {
  if (!user || !user.uid) return null;
  const now = new Date().toISOString();
  const cleanPhone = extra?.phoneNumber?.trim() || user.phoneNumber || '';
  const cleanEmail = (extra?.email || user.email || '').trim().toLowerCase();
  const phoneDigits = cleanPhone.replace(/\D/g, '');
  const phoneLast4 = phoneDigits.slice(-4) || 'Diner';
  const resolvedName = (
    extra?.fullName?.trim() ||
    extra?.displayName?.trim() ||
    user.displayName?.trim() ||
    (cleanEmail ? cleanEmail.split('@')[0] : '') ||
    `Diner ${phoneLast4}`
  );

  const custDocRef = doc(db, 'customers', user.uid);
  const userDocRef = doc(db, 'users', user.uid);

  return await runTransaction(db, async (transaction) => {
    // 1. Transactional Reads
    const custSnap = await transaction.get(custDocRef);
    const userSnap = await transaction.get(userDocRef);

    // CRITICAL SECURITY GUARD:
    // If users/{uid} already exists with an authoritative non-customer role (owner, manager, waiter, chef, etc.),
    // NEVER overwrite with customer! Throw an explicit error to prevent privilege compromise.
    if (userSnap.exists()) {
      const uData = userSnap.data();
      if (uData.role && uData.role !== 'customer') {
        console.warn(`[AUTH ensureCustomerProfile] Security violation: UID ${user.uid} possesses staff/owner role "${uData.role}". Rejecting customer provisioning.`);
        throw new Error('STAFF_ACCOUNT_CANNOT_BE_CUSTOMER');
      }
    }

    let finalProfile: any;

    if (custSnap.exists()) {
      const existingCustData = custSnap.data();
      // Customer profile already exists — preserve all existing values!
      finalProfile = {
        ...existingCustData,
        uid: user.uid,
        phoneNumber: cleanPhone || existingCustData.phoneNumber || '',
        email: cleanEmail || existingCustData.email || '',
        isAnonymous: false,
        role: 'customer',
        status: existingCustData.status || 'active',
        updatedAt: now
      };

      // Atomic update to customers/{uid}
      transaction.update(custDocRef, {
        phoneNumber: finalProfile.phoneNumber,
        email: finalProfile.email,
        isAnonymous: false,
        updatedAt: now
      });
    } else {
      // New customer profile — provision canonical default structure
      finalProfile = {
        uid: user.uid,
        fullName: resolvedName,
        displayName: resolvedName,
        email: cleanEmail,
        phoneNumber: cleanPhone,
        role: 'customer' as TUserRole,
        tenantId: null,
        walletBalance: 0,
        loyaltyPoints: 0,
        status: 'active',
        isAnonymous: false,
        createdAt: now,
        updatedAt: now
      };

      transaction.set(custDocRef, finalProfile);
    }

    // 2. Synchronize to users/{uid} for consistent fast lookups and Firestore rules userExists()
    const userProfileData = {
      uid: user.uid,
      email: finalProfile.email,
      displayName: finalProfile.displayName || finalProfile.fullName || 'Customer',
      fullName: finalProfile.fullName || finalProfile.displayName || 'Customer',
      role: 'customer' as TUserRole,
      tenantId: '',
      branchId: '',
      department: '',
      status: finalProfile.status || 'active',
      phoneNumber: finalProfile.phoneNumber || '',
      createdAt: finalProfile.createdAt || now,
      updatedAt: now
    };

    transaction.set(userDocRef, userProfileData, { merge: true });

    return finalProfile;
  });
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

  // Canonical profile creation and synchronization
  await ensureCustomerProfile(user, {
    fullName,
    email,
    phoneNumber
  });

  return userCredential;
};

export const getResetActionCodeSettings = (): ActionCodeSettings => {
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://spiral-dine.vercel.app';
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

export const linkPhoneWithCredential = async (
  user: User,
  verificationId: string,
  verificationCode: string
): Promise<UserCredential> => {
  const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
  return linkWithCredential(user, cred);
};


