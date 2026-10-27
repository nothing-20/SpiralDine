import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sendMailWithLogging } from './_lib/resendHelper.js';

interface ITokenUser {
  uid: string;
  isAnonymous?: boolean;
}

/**
 * Verify Firebase ID token independently on server side.
 */
async function verifyAuthToken(token: string): Promise<ITokenUser | null> {
  if (!token) return null;

  // 1. Synthetic / Local decode fallback
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
  } catch (err) {
    console.warn('[notify-admin-registration] Token verification fallback:', err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Verify authorization header
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing Authorization header.' });
  }

  const tokenUser = await verifyAuthToken(token);
  if (!tokenUser || !tokenUser.uid || tokenUser.isAnonymous) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired authorization token.' });
  }

  const {
    applicationId,
    tenantId,
    restaurantName,
    ownerEmail,
    ownerName,
    country,
    currency
  } = req.body || {};

  if (!restaurantName || !ownerEmail) {
    return res.status(400).json({ error: 'Missing required application fields (restaurantName, ownerEmail).' });
  }

  const cleanRestName = String(restaurantName).trim();
  const cleanOwnerEmail = String(ownerEmail).trim().toLowerCase();
  const cleanOwnerName = ownerName ? String(ownerName).trim() : 'Restaurant Applicant';
  const cleanAppId = String(applicationId || tenantId || 'app_pending');
  const cleanTenantId = String(tenantId || cleanAppId);
  const cleanCountry = country ? String(country).trim() : 'Unspecified';
  const cleanCurrency = currency ? String(currency).trim() : 'USD';

  // 2. Resolve admin recipient email
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@spiraldine.com';
  const portalUrl = `https://spiral-dine.vercel.app/super-admin/applications?id=${encodeURIComponent(cleanAppId)}`;

  // 3. Construct email template
  const subject = `[New Restaurant Application] ${cleanRestName} (Pending Approval)`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Restaurant Registration Application</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FCFAF7; color: #17233D; margin: 0; padding: 24px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E2D9; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: #1E3A2B; color: #ffffff; padding: 28px 32px; text-align: left; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
        .header p { margin: 6px 0 0 0; font-size: 13px; color: #D1E5DA; }
        .content { padding: 32px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; margin-bottom: 20px; }
        .table-info { width: 100%; border-collapse: collapse; margin: 16px 0 24px 0; }
        .table-info td { padding: 12px 16px; border-bottom: 1px solid #F3EFEA; font-size: 14px; }
        .table-info td.label { font-weight: 600; color: #64748B; width: 35%; }
        .table-info td.val { font-weight: 700; color: #17233D; }
        .btn { display: inline-block; background: #C97A52; color: #ffffff !important; padding: 14px 28px; font-size: 14px; font-weight: 700; border-radius: 12px; text-decoration: none; margin-top: 8px; }
        .footer { padding: 24px 32px; background: #F8F5EE; border-top: 1px solid #E8E2D9; font-size: 12px; color: #64748B; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SpiralDine Super Admin</h1>
          <p>Merchant Registration Onboarding Alert</p>
        </div>
        <div class="content">
          <span class="badge">Action Required &bull; Pending Review</span>
          <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #17233D;">A new restaurant registration application was submitted.</h2>
          <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 16px 0;">
            A restaurant owner has registered on SpiralDine. Their account is currently <strong>pending administrator approval</strong>. Merchant owner dashboard access is blocked until approved.
          </p>

          <table class="table-info">
            <tr>
              <td class="label">Restaurant Name:</td>
              <td class="val">${cleanRestName}</td>
            </tr>
            <tr>
              <td class="label">Owner Name:</td>
              <td class="val">${cleanOwnerName}</td>
            </tr>
            <tr>
              <td class="label">Owner Email:</td>
              <td class="val">${cleanOwnerEmail}</td>
            </tr>
            <tr>
              <td class="label">Tenant / App ID:</td>
              <td class="val" style="font-family: monospace;">${cleanAppId}</td>
            </tr>
            <tr>
              <td class="label">Country / Currency:</td>
              <td class="val">${cleanCountry} &bull; ${cleanCurrency}</td>
            </tr>
            <tr>
              <td class="label">Submission Time:</td>
              <td class="val">${new Date().toUTCString()}</td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 24px;">
            <a href="${portalUrl}" class="btn" target="_blank">Review Application in Super Admin Portal &rarr;</a>
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} SpiralDine Platform. All rights reserved. Secure Administrative System Notification.
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const result = await sendMailWithLogging({
      to: adminEmail,
      subject,
      html,
      tenantId: cleanTenantId,
      type: 'admin_registration_notification'
    });

    return res.status(200).json({
      success: true,
      message: 'Admin notification dispatched successfully',
      emailResult: result
    });
  } catch (err: any) {
    console.error('[notify-admin-registration] Send error:', err);
    // Return 200 with success: false to avoid failing the client registration flow
    return res.status(200).json({
      success: false,
      warning: 'Admin email dispatch encountered an error, but application was saved in database.',
      error: err.message
    });
  }
}
