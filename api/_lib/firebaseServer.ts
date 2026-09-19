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
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'spiral-restaurant-saas-v1.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'spiral-restaurant-saas-v1',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'spiral-restaurant-saas-v1.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '917630391162',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:917630391162:web:6e4c127734b84ca6977cc3',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);

let isAuthInitialized = false;

/**
 * Ensure serverless function has authenticated context for Firestore security rules.
 */
export async function ensureServerAuth() {
  if (auth.currentUser) return auth.currentUser;
  if (isAuthInitialized) return auth.currentUser;

  const serverEmail = process.env.FIREBASE_SERVER_EMAIL || 'dev-admin-reset@restaurantos.internal';
  const serverPassword = process.env.FIREBASE_SERVER_PASSWORD || 'DevResetSecret123!';

  try {
    const cred = await signInWithEmailAndPassword(auth, serverEmail, serverPassword);
    isAuthInitialized = true;
    return cred.user;
  } catch (err: any) {
    console.warn('[firebaseServer] Server authentication warning (falling back):', err?.message);
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
