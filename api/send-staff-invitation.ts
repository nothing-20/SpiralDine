import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAuthError, requireNonAnonymousUser } from './_lib/authMiddleware.js';
import { sendMailWithLogging } from './_lib/resendHelper.js';

interface StaffInviteBody {
  fullName?: unknown;
  email?: unknown;
  role?: unknown;
  department?: unknown;
  activationLink?: unknown;
  employeeId?: unknown;
  restaurantName?: unknown;
  tenantId?: unknown;
}

function resolveSafeActivationLink(activationLink: unknown, employeeId: unknown): string {
  const defaultLink = `https://spiral-dine.vercel.app/staff/activate?id=${encodeURIComponent(
    String(employeeId || '')
  )}`;

  if (typeof activationLink !== 'string' || !activationLink.trim()) {
    return defaultLink;
  }

  try {
    const parsedUrl = new URL(activationLink);
    if (
      parsedUrl.hostname === 'dine.spiralworld.in' ||
      parsedUrl.hostname.endsWith('.spiralworld.in') ||
      parsedUrl.hostname === 'spiral-dine.vercel.app' ||
      parsedUrl.hostname.endsWith('.vercel.app') ||
      parsedUrl.hostname === 'localhost' ||
      parsedUrl.hostname === '127.0.0.1'
    ) {
      return activationLink;
    }
  } catch {
    return defaultLink;
  }

  return defaultLink;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Cryptographically verify Firebase ID token (non-anonymous user required)
  try {
    await requireNonAnonymousUser(req);
  } catch (authErr: unknown) {
    return handleAuthError(res, authErr);
  }

  const {
    fullName,
    email,
    role,
    department,
    activationLink,
    employeeId,
    restaurantName: incomingRestName,
    tenantId,
  } = (req.body || {}) as StaffInviteBody;

  if (typeof fullName !== 'string' || !fullName.trim() || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Missing required fields: fullName and email.' });
  }

  const cleanName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const restName =
    typeof incomingRestName === 'string' && incomingRestName.trim()
      ? incomingRestName.trim()
      : 'Spiral Dine';
  const cleanRole = typeof role === 'string' && role.trim() ? role.trim() : 'Staff';
  const cleanDepartment = typeof department === 'string' && department.trim() ? department.trim() : '';

  const link = resolveSafeActivationLink(activationLink, employeeId);

  if (!process.env.RESEND_API_KEY) {
    console.warn('[Vercel API] RESEND_API_KEY is not configured on the server. Email skipped.');
    return res.status(200).json({
      success: true,
      emailSent: false,
      warning: 'RESEND_API_KEY not configured.',
      employeeId,
      activationLink: link,
    });
  }

  const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.025em;">Spiral Dine</h1>
          <p style="color: #d1fae5; font-size: 14px; margin: 6px 0 0 0; font-weight: 500;">Staff Account Invitation</p>
        </div>
        <div style="padding: 32px; line-height: 1.6;">
          <h2 style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-top: 0;">Welcome, ${cleanName}!</h2>
          <p style="font-size: 14px; color: #cbd5e1;">You have been invited to join the team at <strong>${restName}</strong> as <strong>${cleanRole}</strong>${cleanDepartment ? ` (${cleanDepartment})` : ''}.</p>
          <p style="font-size: 14px; color: #cbd5e1;">Click the button below to set your password and activate your staff access:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${link}" style="background-color: #10b981; color: #020617; font-weight: 700; font-size: 14px; padding: 14px 32px; border-radius: 10px; text-decoration: none; display: inline-block;">
              Activate Staff Account
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">If the button does not work, copy and paste this link into your browser:<br/><span style="color: #94a3b8; word-break: break-all;">${link}</span></p>
          <hr style="border: 0; border-top: 1px solid #1e293b; margin: 28px 0;" />
          <p style="font-size: 11px; color: #475569; margin: 0; text-align: center;">This invitation link is valid for 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
        </div>
      </div>
    `;

  try {
    const emailResult = await sendMailWithLogging({
      to: trimmedEmail,
      subject: `You're invited to join ${restName} on Spiral Dine`,
      html: htmlContent,
      tenantId: typeof tenantId === 'string' ? tenantId : undefined,
      type: 'staff_invitation',
      retries: 0,
    });

    return res.status(200).json({
      success: true,
      emailSent: emailResult.success,
      emailId: emailResult.id,
      emailError: emailResult.success ? undefined : emailResult.error,
      employeeId,
      activationLink: link,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Email dispatch failed';
    console.warn('[Vercel API] send-staff-invitation dispatch failed:', message);
    return res.status(200).json({
      success: true,
      emailSent: false,
      emailError: message,
      employeeId,
      activationLink: link,
    });
  }
}
