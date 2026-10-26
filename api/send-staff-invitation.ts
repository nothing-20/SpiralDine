import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

interface ITokenUser {
  uid: string;
  isAnonymous?: boolean;
}

/**
 * Verify Firebase ID token independently on server side.
 */
async function verifyAuthToken(token: string): Promise<ITokenUser | null> {
  if (!token) return null;

  // 1. Emulator / Synthetic decode
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const uid = payload.user_id || payload.sub || payload.uid;
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        if (uid) return { uid, isAnonymous: payload.firebase?.sign_in_provider === 'anonymous' };
      }
    } catch (_) {}
  }

  // 2. Production token verification via Google Identity Toolkit
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const uid = payload.user_id || payload.sub || payload.uid;
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        if (uid) return { uid, isAnonymous: payload.firebase?.sign_in_provider === 'anonymous' };
      }
    } catch (_) {}
    return null;
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.users || data.users.length === 0) return null;

    const user = data.users[0];
    return {
      uid: user.localId,
      isAnonymous: user.providerUserInfo?.length === 0,
    };
  } catch (err: any) {
    console.error('[send-staff-invitation] Token verification error:', err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Enforce Server-Side Authentication
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing Authorization header.' });
  }

  const tokenUser = await verifyAuthToken(token);
  if (!tokenUser || !tokenUser.uid || tokenUser.isAnonymous) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired staff authorization token.' });
  }

  const { fullName, email, role, department, activationLink, employeeId, restaurantName: incomingRestName } = req.body || {};

  if (!fullName || !email) {
    return res.status(400).json({ error: 'Missing required fields: fullName and email.' });
  }

  const trimmedEmail = String(email).trim().toLowerCase();
  const restName = incomingRestName ? String(incomingRestName).trim() : 'Spiral Dine';

  // Sanitize activation link to prevent open redirect phishing
  let link = `https://spiral-dine.vercel.app/staff/activate?id=${encodeURIComponent(employeeId || '')}`;
  if (activationLink && typeof activationLink === 'string') {
    try {
      const parsedUrl = new URL(activationLink);
      if (
        parsedUrl.hostname === 'spiral-dine.vercel.app' ||
        parsedUrl.hostname.endsWith('.vercel.app') ||
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1'
      ) {
        link = activationLink;
      }
    } catch (_) {
      // Keep default canonical link if invalid URL
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Vercel API] RESEND_API_KEY is not configured on the server. Email skipped.');
    return res.status(200).json({
      success: true,
      emailSent: false,
      warning: 'RESEND_API_KEY not configured.',
      employeeId,
      activationLink: link,
    });
  }

  try {
    const resend = new Resend(apiKey);

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #020617; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; color: #f8fafc;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.025em;">Spiral Dine</h1>
          <p style="color: #d1fae5; font-size: 14px; margin: 6px 0 0 0; font-weight: 500;">Staff Account Invitation</p>
        </div>
        <div style="padding: 32px; line-height: 1.6;">
          <h2 style="font-size: 18px; font-weight: 700; color: #f8fafc; margin-top: 0;">Welcome, ${fullName}!</h2>
          <p style="font-size: 14px; color: #cbd5e1;">You have been invited to join the team at <strong>${restName}</strong> as <strong>${role || 'Staff'}</strong>${department ? ` (${department})` : ''}.</p>
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

    const response = await resend.emails.send({
      from: 'Spiral Dine <onboarding@resend.dev>',
      to: [trimmedEmail],
      subject: `You're invited to join ${restName} on Spiral Dine`,
      html: htmlContent,
    });

    return res.status(200).json({
      success: true,
      emailSent: !response.error,
      emailId: response.data?.id,
      emailError: response.error ? response.error.message : undefined,
      employeeId,
      activationLink: link,
    });
  } catch (err: any) {
    console.warn('[Vercel API] send-staff-invitation dispatch failed:', err?.message);
    return res.status(200).json({
      success: true,
      emailSent: false,
      emailError: err?.message || 'Email dispatch failed',
      employeeId,
      activationLink: link,
    });
  }
}

