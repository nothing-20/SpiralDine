import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

/**
 * Singleton Firebase Admin SDK initializer for Vercel Serverless Functions.
 * Reads credentials safely from environment variables (FIREBASE_SERVICE_ACCOUNT or
 * FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) or local serviceAccountKey.json.
 * 
 * NEVER exposes credentials to client bundles.
 */

let isInitialized = false;

function initFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const projectId = 
    process.env.FIREBASE_PROJECT_ID || 
    process.env.VITE_FIREBASE_PROJECT_ID || 
    'spiral-restaurant-saas-v1';

  let credential: admin.credential.Credential | null = null;

  // 1. Check FIREBASE_SERVICE_ACCOUNT (raw JSON or base64 encoded JSON)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      let raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (raw.startsWith('{')) {
        const parsed = JSON.parse(raw);
        credential = admin.credential.cert(parsed);
      } else {
        const decoded = Buffer.from(raw, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        credential = admin.credential.cert(parsed);
      }
    } catch (err: any) {
      console.warn('[firebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT:', err?.message);
    }
  }

  // 2. Check individual env variables
  if (!credential && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      credential = admin.credential.cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      });
    } catch (err: any) {
      console.warn('[firebaseAdmin] Failed to initialize with FIREBASE_CLIENT_EMAIL/PRIVATE_KEY:', err?.message);
    }
  }

  // 3. Check local serviceAccountKey.json file if running locally
  if (!credential) {
    const localPaths = [
      path.resolve(process.cwd(), 'serviceAccountKey.json'),
      path.resolve(process.cwd(), 'service-account.json'),
      path.resolve(process.cwd(), '../serviceAccountKey.json'),
    ];
    for (const p of localPaths) {
      if (fs.existsSync(p)) {
        try {
          const fileData = JSON.parse(fs.readFileSync(p, 'utf-8'));
          credential = admin.credential.cert(fileData);
          break;
        } catch {
          // continue
        }
      }
    }
  }

  // 4. Initialize app
  if (credential) {
    admin.initializeApp({ credential, projectId });
  } else {
    // Default application credentials / environment credentials
    admin.initializeApp({ projectId });
  }

  isInitialized = true;
  return admin.app();
}

export function getAdminAuth() {
  initFirebaseAdmin();
  return admin.auth();
}

export function getAdminFirestore() {
  initFirebaseAdmin();
  return admin.firestore();
}

export { admin };
