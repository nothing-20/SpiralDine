import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth, 
  browserSessionPersistence, 
  inMemoryPersistence, 
  browserPopupRedirectResolver,
  setPersistence 
} from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const PRODUCTION_PROJECT_ID = 'spiral-restaurant-saas-v1';

// Determine environment mode
const rawAppEnv = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APP_ENV) ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE) ||
  ''
).trim().toLowerCase();

const isExplicitStaging = rawAppEnv === 'staging' || rawAppEnv === 'stage';

// Resolve project ID with strict anti-switching guard
const configuredProjectId = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_PROJECT_ID) ||
  ''
).trim();

// Accidental project switching prevention:
// If running in production (or preview sharing production), reject any project ID other than spiral-restaurant-saas-v1
if (configuredProjectId && !isExplicitStaging && configuredProjectId !== PRODUCTION_PROJECT_ID) {
  throw new Error(
    `[Firebase] Accidental project switching prevented: configured project "${configuredProjectId}" does not match authorized production project "${PRODUCTION_PROJECT_ID}".`
  );
}

const projectId = configuredProjectId || PRODUCTION_PROJECT_ID;

// If an explicit staging environment is configured, enforce strict isolation from production
if (isExplicitStaging) {
  if (!configuredProjectId || configuredProjectId === PRODUCTION_PROJECT_ID) {
    throw new Error(
      `[Firebase] Staging environment refuses to connect to production Firebase project "${PRODUCTION_PROJECT_ID}". Configure an isolated staging Firebase project.`
    );
  }
}

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg';
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'spiral-restaurant-saas-v1.firebaseapp.com';
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'spiral-restaurant-saas-v1.firebasestorage.app';
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '917630391162';
const appId = import.meta.env.VITE_FIREBASE_APP_ID || '1:917630391162:web:6e4c127734b84ca6977cc3';

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};

// Validate variables at startup
const missingKeys = Object.entries(firebaseConfig)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0 && import.meta.env.DEV) {
  console.warn(`[Firebase] Missing environment configurations: ${missingKeys.join(', ')}`);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Strictly enforce tab-isolated session persistence (sessionStorage) at initialization.
// This prevents cross-tab leakage where Tab A (Customer) overwrites Tab B (Owner).
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: [browserSessionPersistence, inMemoryPersistence],
      popupRedirectResolver: typeof window !== 'undefined' ? browserPopupRedirectResolver : undefined
    });
  } catch (_err) {
    const existingAuth = getAuth(app);
    setPersistence(existingAuth, browserSessionPersistence).catch(() => {});
    return existingAuth;
  }
})();

export const db = (() => {
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true
    });
  } catch (_err) {
    return getFirestore(app);
  }
})();

// Gracefully handle Storage plan unavailability
let storage: any = null;
try {
  storage = getStorage(app);
} catch (e) {
  console.warn('[Firebase] Storage failed to initialize or plan limits exceeded:', e);
}

export { storage };
export default app;
