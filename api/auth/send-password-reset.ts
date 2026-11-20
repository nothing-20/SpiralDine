import type { VercelRequest, VercelResponse } from '@vercel/node';
import { enforceRateLimit } from '../_lib/rateLimiter.js';
import { adminAuth } from '../_lib/firebaseAdmin.js';
import {
  getServiceAccountCredentials,
  generateFirebaseAuthResetLink,
} from '../_lib/firebaseAdminAuth.js';
import {
  buildCustomDomainResetLink,
  dispatchCustomDomainPasswordReset,
} from '../_lib/email/passwordResetDispatcher.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OFFICIAL_PRODUCTION_URL = 'https://dine.spiralworld.in';

export interface PasswordResetHandlerDeps {
  generateResetLink?: (email: string, actionCodeSettings: unknown) => Promise<string>;
  dispatchEmail?: typeof dispatchCustomDomainPasswordReset;
}

/**
 * Safely resolves the public application domain for custom link formatting.
 */
export function resolvePublicAppUrl(req?: VercelRequest): string {
  // 1. Explicit environment configurations
  const rawEnvUrl = process.env.APP_PUBLIC_URL || process.env.APP_URL || process.env.VITE_APP_URL;
  if (rawEnvUrl && rawEnvUrl.trim() && rawEnvUrl.trim() !== 'undefined' && rawEnvUrl.trim() !== 'null') {
    return rawEnvUrl.trim().replace(/\/+$/, '');
  }

  // 2. Request origin or forwarded host (for preview / localhost environments)
  if (req) {
    const origin = req.headers?.origin;
    if (typeof origin === 'string' && origin.startsWith('http')) {
      return origin.replace(/\/+$/, '');
    }

    const host = req.headers?.['x-forwarded-host'] || req.headers?.host;
    if (typeof host === 'string' && host.trim()) {
      const proto = req.headers['x-forwarded-proto'] === 'http' ? 'http' : 'https';
      return `${proto}://${host.trim()}`.replace(/\/+$/, '');
    }
  }

  // 3. Fallback to authoritative production domain
  return OFFICIAL_PRODUCTION_URL;
}

/**
 * Unified Password Reset Endpoint using SpiralDine's Custom Domain.
 * Generates Firebase Auth Action Code via Admin SDK and dispatches branded email
 * from the custom domain (GoDaddy SMTP support@spiralworld.in / Resend fallback).
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
  deps: PasswordResetHandlerDeps = {}
) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({
      error: 'Method Not Allowed',
      code: 'auth/method-not-allowed',
    });
  }

  // 1. IP-level rate limiting (5 requests per 15 minutes per IP)
  const isIpAllowed = enforceRateLimit(req, res, {
    keyPrefix: 'pwd_reset_ip',
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!isIpAllowed) {
    return;
  }

  // 2. Validate email payload
  const rawEmail = req.body?.email;
  if (typeof rawEmail !== 'string' || !rawEmail.trim()) {
    return res.status(400).json({
      error: 'Email address is required.',
      code: 'auth/invalid-email',
    });
  }

  const cleanEmail = rawEmail.trim().toLowerCase();
  if (cleanEmail.length > 254 || !EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({
      error: 'The email address entered is not valid.',
      code: 'auth/invalid-email',
    });
  }

  // 3. Per-Email rate limiting (3 requests per 15 minutes per email)
  const isEmailAllowed = enforceRateLimit(req, res, {
    keyPrefix: 'pwd_reset_email',
    identifier: cleanEmail,
    maxRequests: 3,
    windowMs: 15 * 60 * 1000,
  });
  if (!isEmailAllowed) {
    return;
  }

  const baseUrl = resolvePublicAppUrl(req);
  const actionCodeSettings = {
    url: `${baseUrl}/reset-password`,
    handleCodeInApp: true,
  };

  let rawActionLink = '';
  try {
    if (deps.generateResetLink) {
      rawActionLink = await deps.generateResetLink(cleanEmail, actionCodeSettings);
    } else {
      try {
        rawActionLink = await adminAuth.generatePasswordResetLink(cleanEmail, actionCodeSettings);
      } catch (adminErr: unknown) {
        // Fallback to Google REST API if adminAuth failed or creds are raw
        const creds = getServiceAccountCredentials();
        if (creds) {
          const restResult = await generateFirebaseAuthResetLink(
            creds,
            cleanEmail,
            actionCodeSettings.url
          );
          rawActionLink = restResult.oobLink;
        } else {
          throw adminErr;
        }
      }
    }
    if (!rawActionLink) {
      throw new Error('Action link was not generated.');
    }
  } catch (err: unknown) {
    const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
    const code = String(errObj.code || '');
    const message = String(errObj.message || '');

    // User enumeration protection: If email does not exist in Firebase Auth,
    // respond with standard success message so attackers cannot probe for registered accounts.
    if (
      code === 'auth/user-not-found' ||
      message.includes('EMAIL_NOT_FOUND') ||
      message.includes('USER_NOT_FOUND')
    ) {
      console.info(`[send-password-reset] Reset requested for non-existent email: ${cleanEmail}`);
      return res.status(200).json({
        success: true,
        message: 'If an account is associated with this email, password reset instructions have been sent.',
      });
    }

    console.error('[send-password-reset] Action link generation error:', err);
    return res.status(500).json({
      error: 'Failed to process password reset request. Please try again later.',
      code: code || 'auth/internal-error',
    });
  }

  // 4. Construct custom domain link
  const customResetLink = buildCustomDomainResetLink(rawActionLink, baseUrl);

  // 5. Dispatch email via custom domain transporter (SMTP/Resend)
  const dispatchFn = deps.dispatchEmail ?? dispatchCustomDomainPasswordReset;
  try {
    const dispatchResult = await dispatchFn({
      email: cleanEmail,
      resetLink: customResetLink,
      brandName: process.env.CONTACT_FROM_NAME || 'SpiralDine',
      supportEmail: process.env.CONTACT_FROM_EMAIL || 'support@spiralworld.in',
      expirationMinutes: 60,
    });

    if (!dispatchResult.success) {
      console.error('[send-password-reset] Mail dispatch failed:', dispatchResult.error);
      return res.status(502).json({
        error: 'Unable to deliver password reset email right now. Please try again shortly or contact support@spiralworld.in.',
        code: 'auth/delivery-failed',
        diagnosticCode: dispatchResult.diagnosticCode,
      });
    }

    return res.status(200).json({
      success: true,
      provider: dispatchResult.provider,
      message: 'Password reset link sent to your email.',
    });
  } catch (dispatchErr: unknown) {
    console.error('[send-password-reset] Unexpected error during dispatch:', dispatchErr);
    return res.status(500).json({
      error: 'Internal server error while dispatching email.',
      code: 'auth/internal-error',
    });
  }
}
