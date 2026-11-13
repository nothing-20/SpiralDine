import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth, browserSessionPersistence, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { resolveWebFirebaseConfig } from './envConfig';

const firebaseConfig = resolveWebFirebaseConfig(import.meta.env as Record<string, unknown>);

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
