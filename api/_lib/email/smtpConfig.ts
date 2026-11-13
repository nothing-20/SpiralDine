import {
  OFFICIAL_BRAND_NAME,
  OFFICIAL_SUPPORT_EMAIL,
} from '../../../src/shared/constants/contact.js';

export interface SmtpContactConfig {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  sendAck: boolean;
}

export type SmtpConfigResolution =
  | { ok: true; config: SmtpContactConfig }
  | { ok: false; missingKeys: string[]; invalidKeys: string[]; error: string };

const SINGLE_LINE_CONTROL_RE = /[\r\n\0]/;
const SIMPLE_EMAIL_RE = /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"']+\.[^\s@<>()[\]\\,;:"']{2,}$/;

function parseBooleanFlag(raw: string | undefined): boolean | null {
  if (raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return null;
}

function isSafeSingleLine(value: string): boolean {
  return Boolean(value) && !SINGLE_LINE_CONTROL_RE.test(value);
}

/**
 * Resolve GoDaddy Professional Email SMTP & Contact configuration from server env vars.
 * Never invents SMTP host, port, TLS mode, username, or password.
 */
export function resolveSmtpContactConfig(
  env: Record<string, string | undefined> = process.env
): SmtpConfigResolution {
  const missingKeys: string[] = [];
  const invalidKeys: string[] = [];

  const rawHost = env.SMTP_HOST?.trim() || '';
  const rawPort = env.SMTP_PORT?.trim() || '';
  const rawSecure = env.SMTP_SECURE?.trim();
  const rawUser = env.SMTP_USER?.trim() || '';
  const rawPass = env.SMTP_PASS || '';

  if (!rawHost) {
    missingKeys.push('SMTP_HOST');
  } else if (!isSafeSingleLine(rawHost) || /\s|\/\//.test(rawHost)) {
    invalidKeys.push('SMTP_HOST');
  }

  let parsedPort = 0;
  if (!rawPort) {
    missingKeys.push('SMTP_PORT');
  } else {
    parsedPort = Number(rawPort);
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      invalidKeys.push('SMTP_PORT');
    }
  }

  const parsedSecure = parseBooleanFlag(rawSecure);
  if (rawSecure === undefined || rawSecure === '') {
    missingKeys.push('SMTP_SECURE');
  } else if (parsedSecure === null) {
    invalidKeys.push('SMTP_SECURE');
  }

  if (!rawUser) {
    missingKeys.push('SMTP_USER');
  } else if (!isSafeSingleLine(rawUser)) {
    invalidKeys.push('SMTP_USER');
  }

  if (!rawPass || !rawPass.trim()) {
    missingKeys.push('SMTP_PASS');
  }

  const fromEmail = (env.CONTACT_FROM_EMAIL?.trim() || OFFICIAL_SUPPORT_EMAIL).toLowerCase();
  if (!isSafeSingleLine(fromEmail) || !SIMPLE_EMAIL_RE.test(fromEmail)) {
    invalidKeys.push('CONTACT_FROM_EMAIL');
  }

  const fromName = env.CONTACT_FROM_NAME?.trim() || OFFICIAL_BRAND_NAME;
  if (!isSafeSingleLine(fromName)) {
    invalidKeys.push('CONTACT_FROM_NAME');
  }

  const toEmail = (env.CONTACT_TO_EMAIL?.trim() || OFFICIAL_SUPPORT_EMAIL).toLowerCase();
  if (!isSafeSingleLine(toEmail) || !SIMPLE_EMAIL_RE.test(toEmail)) {
    invalidKeys.push('CONTACT_TO_EMAIL');
  }

  const rawSendAck = env.CONTACT_SEND_ACK;
  const parsedSendAck = rawSendAck === undefined || rawSendAck.trim() === ''
    ? false
    : parseBooleanFlag(rawSendAck);
  if (parsedSendAck === null) {
    invalidKeys.push('CONTACT_SEND_ACK');
  }

  if (missingKeys.length > 0 || invalidKeys.length > 0) {
    const parts: string[] = [];
    if (missingKeys.length > 0) {
      parts.push(`Missing environment variable(s): ${missingKeys.join(', ')}`);
    }
    if (invalidKeys.length > 0) {
      parts.push(`Invalid environment variable(s): ${invalidKeys.join(', ')}`);
    }
    return {
      ok: false,
      missingKeys,
      invalidKeys,
      error: parts.join('. '),
    };
  }

  return {
    ok: true,
    config: {
      smtpHost: rawHost,
      smtpPort: parsedPort,
      smtpSecure: parsedSecure as boolean,
      smtpUser: rawUser,
      smtpPass: rawPass,
      fromEmail,
      fromName,
      toEmail,
      sendAck: Boolean(parsedSendAck),
    },
  };
}

export type SmtpFailureCategory = 'auth' | 'connection' | 'rejected' | 'unknown';

export interface ClassifiedSmtpFailure {
  category: SmtpFailureCategory;
  httpStatus: number;
  errorCode: string;
  diagnosticCode: string;
  userMessage: string;
}

/**
 * Map raw Nodemailer/SMTP errors to safe client-facing responses without leaking secrets or stack traces.
 */
export function classifySmtpError(err: unknown): ClassifiedSmtpFailure {
  const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
  const code = typeof errObj.code === 'string' ? errObj.code.toUpperCase() : '';
  const responseCode = typeof errObj.responseCode === 'number' ? errObj.responseCode : 0;
  const rawMessage = typeof errObj.message === 'string' ? errObj.message.toLowerCase() : '';

  if (
    code === 'EAUTH' ||
    responseCode === 535 ||
    responseCode === 534 ||
    responseCode === 530 ||
    rawMessage.includes('authentication failed') ||
    rawMessage.includes('invalid login') ||
    rawMessage.includes('username and password not accepted')
  ) {
    return {
      category: 'auth',
      httpStatus: 502,
      errorCode: 'SMTP_AUTH_FAILED',
      diagnosticCode: code || `SMTP_${responseCode || 535}`,
      userMessage: `We could not deliver your enquiry right now due to an email authentication issue. Please write directly to ${OFFICIAL_SUPPORT_EMAIL}.`,
    };
  }

  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ESOCKET' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    code === 'EDNS' ||
    code === 'EAI_AGAIN' ||
    rawMessage.includes('timed out') ||
    rawMessage.includes('timeout') ||
    rawMessage.includes('greeting never received') ||
    rawMessage.includes('connection closed')
  ) {
    return {
      category: 'connection',
      httpStatus: 504,
      errorCode: 'SMTP_CONNECTION_FAILED',
      diagnosticCode: code || 'SMTP_TIMEOUT',
      userMessage: `Unable to reach our mail server right now. Please try again in a moment or email ${OFFICIAL_SUPPORT_EMAIL} directly.`,
    };
  }

  if (
    code === 'EENVELOPE' ||
    (responseCode >= 550 && responseCode <= 554) ||
    rawMessage.includes('recipient rejected') ||
    rawMessage.includes('sender rejected')
  ) {
    return {
      category: 'rejected',
      httpStatus: 502,
      errorCode: 'SMTP_DELIVERY_REJECTED',
      diagnosticCode: code || `SMTP_${responseCode || 550}`,
      userMessage: `Our mail server rejected this delivery attempt. Please verify your email address or contact ${OFFICIAL_SUPPORT_EMAIL} directly.`,
    };
  }

  return {
    category: 'unknown',
    httpStatus: 502,
    errorCode: 'SMTP_DELIVERY_FAILED',
    diagnosticCode: code || (responseCode ? `SMTP_${responseCode}` : 'SMTP_ERROR'),
    userMessage: `Failed to deliver your enquiry at the moment. Please try again or email ${OFFICIAL_SUPPORT_EMAIL} directly.`,
  };
}

