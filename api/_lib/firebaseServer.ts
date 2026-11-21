import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  limit 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import {
  assertServerProjectSafe,
  resolveServerEnvironment,
  PRODUCTION_FIREBASE_PROJECT_ID
} from './firebaseEnv.js';

function getServerFirebaseConfig() {
  const env = process.env;
  const currentEnv = resolveServerEnvironment(env);
  const isStaging = currentEnv === 'staging';

  // For staging, never fall back to production credentials
  const apiKey = env.FIREBASE_API_KEY || env.VITE_FIREBASE_API_KEY || (isStaging ? '' : 'AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg');
  const authDomain = env.FIREBASE_AUTH_DOMAIN || env.VITE_FIREBASE_AUTH_DOMAIN || (isStaging ? '' : 'spiral-restaurant-saas-v1.firebaseapp.com');
  const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || (isStaging ? '' : PRODUCTION_FIREBASE_PROJECT_ID);
  const storageBucket = env.FIREBASE_STORAGE_BUCKET || env.VITE_FIREBASE_STORAGE_BUCKET || (isStaging ? '' : 'spiral-restaurant-saas-v1.firebasestorage.app');
  const messagingSenderId = env.FIREBASE_MESSAGING_SENDER_ID || env.VITE_FIREBASE_MESSAGING_SENDER_ID || (isStaging ? '' : '917630391162');
  const appId = env.FIREBASE_APP_ID || env.VITE_FIREBASE_APP_ID || (isStaging ? '' : '1:917630391162:web:6e4c127734b84ca6977cc3');

  if (isStaging) {
    if (!projectId || !apiKey) {
      throw new Error(
        `[firebaseServer] Missing staging Firebase configuration for environment "${currentEnv}". Staging must not run without isolated credentials.`
      );
    }
  }

  assertServerProjectSafe(projectId, authDomain, storageBucket, env);

  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
}

const firebaseConfig = getServerFirebaseConfig();

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = (() => {
  try {
    const { initializeFirestore } = require('firebase/firestore');
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch (_) {
    return getFirestore(app);
  }
})();
export const auth = getAuth(app);

let isAuthInitialized = false;

/**
 * Ensure serverless function has authenticated context for Firestore security rules.
 */
export async function ensureServerAuth(force = false) {
  const currentEnv = resolveServerEnvironment(process.env);
  const serverEmail = process.env.FIREBASE_SERVER_EMAIL;
  const serverPassword = process.env.FIREBASE_SERVER_PASSWORD;

  if (!serverEmail || !serverPassword) {
    if (currentEnv === 'development') {
      console.warn('[firebaseServer] Development mode: FIREBASE_SERVER_EMAIL or FIREBASE_SERVER_PASSWORD not configured. Skipping server auth.');
      return null;
    }
    console.warn(`[firebaseServer] Warning: Missing FIREBASE_SERVER_EMAIL or FIREBASE_SERVER_PASSWORD in ${currentEnv} environment.`);
    return null;
  }

  if (serverEmail.includes('dev-admin-reset')) {
    console.warn('[firebaseServer] Warning: dev-admin-reset credentials are deprecated and should not be used in server functions.');
  }

  if (!force && auth.currentUser && auth.currentUser.email === serverEmail) {
    return auth.currentUser;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, serverEmail, serverPassword);
    isAuthInitialized = true;
    return cred.user;
  } catch (err: any) {
    console.warn('[firebaseServer] Server authentication warning:', err?.message);
    return null;
  }
}

export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  limit,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
};
