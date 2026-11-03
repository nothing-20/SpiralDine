import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, browserSessionPersistence, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const isValidEnvValue = (val: any) =>
  typeof val === 'string' && val.trim() !== '' && val !== '[SENSITIVE]' && !val.includes('undefined');

const rawApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const rawAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const rawProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const rawStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const rawMessagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const rawAppId = import.meta.env.VITE_FIREBASE_APP_ID;

const firebaseConfig = {
  apiKey: isValidEnvValue(rawApiKey) ? rawApiKey : 'AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg',
  authDomain: isValidEnvValue(rawAuthDomain) ? rawAuthDomain : 'spiral-restaurant-saas-v1.firebaseapp.com',
  projectId: isValidEnvValue(rawProjectId) ? rawProjectId : 'spiral-restaurant-saas-v1',
  storageBucket: isValidEnvValue(rawStorageBucket) ? rawStorageBucket : 'spiral-restaurant-saas-v1.firebasestorage.app',
  messagingSenderId: isValidEnvValue(rawMessagingSenderId) ? rawMessagingSenderId : '917630391162',
  appId: isValidEnvValue(rawAppId) ? rawAppId : '1:917630391162:web:6e4c127734b84ca6977cc3',
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
      persistence: [browserSessionPersistence, inMemoryPersistence]
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
