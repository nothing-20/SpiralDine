import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { Resend } from 'resend';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'spiral-restaurant-saas-v1.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'spiral-restaurant-saas-v1',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'spiral-restaurant-saas-v1.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '917630391162',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:917630391162:web:6e4c127734b84ca6977cc3',
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

// Safe Resend API Key resolver
const getResendApiKey = (): string | null => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return null;
  }
  return key;
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  tenantId?: string;
  type: string;
  retries?: number;
}

export const sendMailWithLogging = async (
  options: SendMailOptions
): Promise<{ success: boolean; id?: string; error?: string }> => {
  const { to, subject, html, tenantId, type } = options;
  const retriesLeft = options.retries ?? MAX_RETRIES;
  const timestamp = new Date().toISOString();

  const apiKey = getResendApiKey();
  if (!apiKey) {
    console.warn('[Vercel API] RESEND_API_KEY is not configured. Email dispatch skipped.');
    return { success: false, error: 'RESEND_API_KEY is not configured on the server.' };
  }

  try {
    const resend = new Resend(apiKey);

    const response = await resend.emails.send({
      from: 'Spiral Dine <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    // Task 9: Log success in Firestore emailLogs
    await addDoc(collection(db, 'emailLogs'), {
      recipient: to,
      subject: subject,
      tenant: tenantId || null,
      status: 'success',
      provider: 'resend',
      timestamp: timestamp,
      type: type,
      emailId: response.data?.id || null,
      error: null,
    });

    return { success: true, id: response.data?.id };
  } catch (err: any) {
    const errMsg = err.message || 'Unknown Resend API error';
    console.warn(`[Vercel API] Failed to send email to ${to} (${retriesLeft} retries remaining): ${errMsg}`);

    if (retriesLeft > 0) {
      await delay(RETRY_DELAY_MS);
      return sendMailWithLogging({ ...options, retries: retriesLeft - 1 });
    }

    // Task 9 & 12: Log failure in Firestore emailLogs on final retry exhaust
    try {
      await addDoc(collection(db, 'emailLogs'), {
        recipient: to,
        subject: subject,
        tenant: tenantId || null,
        status: 'failed',
        provider: 'resend',
        timestamp: timestamp,
        type: type,
        error: errMsg,
      });
    } catch (logErr) {
      console.error('[Vercel API] Failed to write failure log to Firestore:', logErr);
    }

    return { success: false, error: errMsg };
  }
};
