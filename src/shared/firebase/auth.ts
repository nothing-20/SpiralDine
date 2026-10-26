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
  EmailAuthProvider
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
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

export const resetPassword = async (email: string): Promise<void> => {
  return sendPasswordResetEmail(auth, email);
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

