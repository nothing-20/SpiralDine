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
  text?: string;
  from?: string;
  tenantId?: string;
  type: string;
  retries?: number;
}

export interface SendMailResult {
  success: boolean;
  id?: string;
  error?: string;
  errorCategory?: 'domain_verification_required' | 'provider_error' | 'config_missing';
  statusCode?: number;
  isDomainRestriction?: boolean;
}

export const sendMailWithLogging = async (
  options: SendMailOptions
): Promise<SendMailResult> => {
  const { to, subject, html, text, from, tenantId, type } = options;
  const retriesLeft = options.retries ?? MAX_RETRIES;
  const timestamp = new Date().toISOString();

  const apiKey = getResendApiKey();
  if (!apiKey) {
    console.warn('[Vercel API] RESEND_API_KEY is not configured. Email dispatch skipped.');
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured on the server.',
      errorCategory: 'config_missing',
      statusCode: 500,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const fromAddress = from || process.env.RESEND_FROM_EMAIL || 'Spiral Dine <onboarding@resend.dev>';

    const mailPayload: any = {
      from: fromAddress,
      to: [to],
      subject: subject,
      html: html,
    };
    if (text) {
      mailPayload.text = text;
    }

    const response = await resend.emails.send(mailPayload);

    if (response.error) {
      const customErr: any = new Error(response.error.message);
      customErr.name = response.error.name;
      customErr.statusCode = response.error.statusCode || (response as any).status;
      throw customErr;
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
    const statusCode = err.statusCode || err.status || 500;
    const isDomainRestriction = Boolean(
      (statusCode === 403 || statusCode === 422) &&
      (
        errMsg.toLowerCase().includes('verify a domain') ||
        errMsg.toLowerCase().includes('testing emails to your own email address') ||
        errMsg.toLowerCase().includes('testing email address instead of domains') ||
        errMsg.toLowerCase().includes('validation_error')
      )
    );

    console.warn(`[Vercel API] Email dispatch error (status: ${statusCode}, domainRestriction: ${isDomainRestriction}): ${errMsg}`);

    // If it's a domain/test-sender restriction, retrying is futile and wastes time
    const isRetryable = !isDomainRestriction && statusCode !== 401 && statusCode !== 403 && statusCode !== 422;

    if (retriesLeft > 0 && isRetryable) {
      await delay(RETRY_DELAY_MS);
      return sendMailWithLogging({ ...options, retries: retriesLeft - 1 });
    }

    const category = isDomainRestriction ? 'domain_verification_required' : 'provider_error';

    // Log failure in Firestore emailLogs
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
        errorCategory: category,
        statusCode: statusCode,
      });
    } catch (logErr) {
      console.error('[Vercel API] Failed to write failure log to Firestore:', logErr);
    }

    return {
      success: false,
      error: errMsg,
      errorCategory: category,
      statusCode: statusCode,
      isDomainRestriction: isDomainRestriction,
    };
  }
};
