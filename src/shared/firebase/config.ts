import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, browserSessionPersistence, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'spiral-restaurant-saas-v1.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'spiral-restaurant-saas-v1',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'spiral-restaurant-saas-v1.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '917630391162',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:917630391162:web:6e4c127734b84ca6977cc3',
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
