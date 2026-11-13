import { Resend } from 'resend';
import { getAdminDb } from './firebaseAdmin.js';

const getResendApiKey = (): string | null => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return null;
  }
  return key;
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

interface ResendMailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
}

interface ProviderError extends Error {
  statusCode?: number;
  status?: number;
}

export interface SendMailDependencies {
  sendEmail?: (
    payload: ResendMailPayload,
    apiKey: string
  ) => Promise<{
    data?: { id?: string } | null;
    error?: { message: string; name?: string; statusCode?: number | null } | null;
  }>;
  writeLog?: (entry: Record<string, unknown>) => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
}

async function defaultWriteEmailLog(entry: Record<string, unknown>): Promise<void> {
  await getAdminDb().collection('emailLogs').add(entry);
}

async function defaultSendEmail(
  payload: ResendMailPayload,
  apiKey: string
): Promise<{
  data?: { id?: string } | null;
  error?: { message: string; name?: string; statusCode?: number | null } | null;
}> {
  const resend = new Resend(apiKey);
  return resend.emails.send(payload);
}

export const sendMailWithLogging = async (
  options: SendMailOptions,
  deps: SendMailDependencies = {}
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

  const sendFn = deps.sendEmail ?? defaultSendEmail;
  const logFn = deps.writeLog ?? defaultWriteEmailLog;
  const sleepFn = deps.sleep ?? delay;

  const fromAddress = from || process.env.RESEND_FROM_EMAIL || 'Spiral Dine <onboarding@resend.dev>';
  const mailPayload: ResendMailPayload = {
    from: fromAddress,
    to: [to],
    subject,
    html,
  };
  if (text) {
    mailPayload.text = text;
  }

  let emailId: string | undefined;

  try {
    const response = await sendFn(mailPayload, apiKey);

    if (response.error) {
      const customErr: ProviderError = new Error(response.error.message);
      customErr.name = response.error.name || 'ResendError';
      customErr.statusCode = response.error.statusCode || 500;
      throw customErr;
    }

    emailId = response.data?.id;
  } catch (err: unknown) {
    const providerErr = err as ProviderError;
    const errMsg = providerErr?.message || 'Unknown Resend API error';
    const statusCode = providerErr?.statusCode || providerErr?.status || 500;
    const lowerErr = errMsg.toLowerCase();
    const isDomainRestriction = Boolean(
      (statusCode === 403 || statusCode === 422) &&
        (lowerErr.includes('verify a domain') ||
          lowerErr.includes('testing emails to your own email address') ||
          lowerErr.includes('testing email address instead of domains') ||
          lowerErr.includes('validation_error'))
    );

    console.warn(
      `[Vercel API] Email dispatch error (status: ${statusCode}, domainRestriction: ${isDomainRestriction}): ${errMsg}`
    );

    const isRetryable =
      !isDomainRestriction && statusCode !== 401 && statusCode !== 403 && statusCode !== 422;

    if (retriesLeft > 0 && isRetryable) {
      await sleepFn(RETRY_DELAY_MS);
      return sendMailWithLogging({ ...options, retries: retriesLeft - 1 }, deps);
    }

    const category = isDomainRestriction ? 'domain_verification_required' : 'provider_error';

    // Isolate Firestore failure logging so logging errors cannot affect return shape or cause retries
    try {
      await logFn({
        recipient: to,
        subject,
        tenant: tenantId || null,
        status: 'failed',
        provider: 'resend',
        timestamp,
        type,
        error: errMsg,
        errorCategory: category,
        statusCode,
      });
    } catch (logErr) {
      console.error('[Vercel API] Failed to write failure log to Firestore:', logErr);
    }

    return {
      success: false,
      error: errMsg,
      errorCategory: category,
      statusCode,
      isDomainRestriction,
    };
  }

  // Isolate Firestore success logging AFTER dispatch succeeds so logging errors never trigger duplicate sends
  try {
    await logFn({
      recipient: to,
      subject,
      tenant: tenantId || null,
      status: 'success',
      provider: 'resend',
      timestamp,
      type,
      emailId: emailId || null,
      error: null,
    });
  } catch (logErr) {
    console.error('[Vercel API] Email sent, but failed to write success log to Firestore:', logErr);
  }

  return { success: true, id: emailId };
};
