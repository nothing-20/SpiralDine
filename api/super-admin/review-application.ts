import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  db as serverDb, 
  doc as serverDoc, 
  getDoc as serverGetDoc, 
  updateDoc as serverUpdateDoc,
  setDoc as serverSetDoc,
  ensureServerAuth
} from '../_lib/firebaseServer.js';
import { sendMailWithLogging } from '../_lib/resendHelper.js';

interface IAdminUser {
  uid: string;
  role: string;
  email?: string;
}

/**
 * Verify if request is made by an authorized Super Admin.
 */
async function verifySuperAdmin(req: VercelRequest): Promise<IAdminUser | null> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    // Check internal setup key header fallback
    const setupSecret = req.headers['x-super-admin-secret'];
    if (setupSecret && process.env.SUPER_ADMIN_SETUP_SECRET && setupSecret === process.env.SUPER_ADMIN_SETUP_SECRET) {
      return { uid: 'system-admin', role: 'super_admin', email: 'admin@spiraldine.com' };
    }
    return null;
  }

  // 1. Inspect claims from token
  try {
    const parts = token.split('.');
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      const uid = payload.user_id || payload.sub || payload.uid;
      const role = payload.role || (payload.super_admin ? 'super_admin' : null);

      if (role === 'super_admin' || role === 'super-admin') {
        return { uid, role: 'super_admin', email: payload.email };
      }

      // If token is valid, verify Firestore users/{uid} for super_admin role
      if (uid) {
        await ensureServerAuth();
        const userDocRef = serverDoc(serverDb, 'users', uid);
        const userSnap = await serverGetDoc(userDocRef);
        if (userSnap.exists()) {
          const uData = userSnap.data();
          if (uData.role === 'super_admin' || uData.role === 'super-admin') {
            return { uid, role: 'super_admin', email: uData.email };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[review-application] Token inspection error:', err);
  }

  // 2. Production token lookup via Google Identity Toolkit
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.users && data.users.length > 0) {
          const user = data.users[0];
          const uid = user.localId;
          await ensureServerAuth();
          const userDocRef = serverDoc(serverDb, 'users', uid);
          const userSnap = await serverGetDoc(userDocRef);
          if (userSnap.exists()) {
            const uData = userSnap.data();
            if (uData.role === 'super_admin' || uData.role === 'super-admin') {
              return { uid, role: 'super_admin', email: user.email };
            }
          }
        }
      }
    } catch (err) {
      console.warn('[review-application] Google ID lookup error:', err);
    }
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Authorize Super Admin
  const adminUser = await verifySuperAdmin(req);
  if (!adminUser) {
    return res.status(403).json({ error: 'Forbidden: Super Admin authorization required to review applications.' });
  }

  const { applicationId, action, notes, reason } = req.body || {};

  if (!applicationId || !action) {
    return res.status(400).json({ error: 'Missing required parameters: applicationId and action.' });
  }

  if (!['approve', 'reject', 'request_info'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be approve, reject, or request_info.' });
  }

  try {
    await ensureServerAuth();

    // 2. Retrieve application document
    const cleanAppId = String(applicationId).trim();
    const appDocRef = serverDoc(serverDb, 'restaurantApplications', cleanAppId);
    let appSnap = await serverGetDoc(appDocRef);

    if (!appSnap.exists()) {
      return res.status(404).json({ error: `Application document not found for ID: ${cleanAppId}` });
    }

    const appData = appSnap.data() || {};
    const tenantId = appData.tenantId || cleanAppId;
    const ownerUid = appData.ownerUid;
    const ownerEmail = (appData.ownerEmail || '').trim().toLowerCase();
    const ownerName = appData.ownerName || 'Restaurant Owner';
    const restaurantName = appData.restaurantName || 'Your Restaurant';
    const nowIso = new Date().toISOString();

    const cleanNotes = notes ? String(notes).trim() : '';
    const cleanReason = reason ? String(reason).trim() : cleanNotes;

    // 3. Execute State Updates Based on Action
    if (action === 'approve') {
      // 3.1 Update restaurantApplications
      await serverSetDoc(appDocRef, {
        status: 'approved',
        reviewedAt: nowIso,
        reviewedBy: adminUser.uid,
        reviewNotes: cleanNotes,
        updatedAt: nowIso
      }, { merge: true });

      // 3.2 Update tenants/{tenantId}
      const tenantDocRef = serverDoc(serverDb, 'tenants', tenantId);
      await serverSetDoc(tenantDocRef, {
        status: 'active',
        updatedAt: nowIso
      }, { merge: true });

      // 3.3 Update restaurants/{tenantId}
      const restDocRef = serverDoc(serverDb, 'restaurants', tenantId);
      await serverSetDoc(restDocRef, {
        status: 'active',
        updatedAt: nowIso
      }, { merge: true });

      // 3.4 Update users/{ownerUid}
      if (ownerUid) {
        const userDocRef = serverDoc(serverDb, 'users', ownerUid);
        await serverSetDoc(userDocRef, {
          status: 'active',
          updatedAt: nowIso
        }, { merge: true });
      }

      // 3.5 Dispatch Approval Email to Applicant
      if (ownerEmail) {
        const loginUrl = 'https://spiral-dine.vercel.app/owner/login';
        const approvalHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Application Approved - SpiralDine</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FCFAF7; color: #17233D; margin: 0; padding: 24px; }
              .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E2D9; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
              .header { background: #1E3A2B; color: #ffffff; padding: 28px 32px; text-align: left; }
              .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
              .content { padding: 32px; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; margin-bottom: 20px; }
              .btn { display: inline-block; background: #C97A52; color: #ffffff !important; padding: 14px 28px; font-size: 14px; font-weight: 700; border-radius: 12px; text-decoration: none; margin-top: 16px; }
              .footer { padding: 24px 32px; background: #F8F5EE; border-top: 1px solid #E8E2D9; font-size: 12px; color: #64748B; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>SpiralDine</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #D1E5DA;">Restaurant Operating System</p>
              </div>
              <div class="content">
                <span class="badge">&check; Approved &bull; Active Access</span>
                <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #17233D;">Welcome to SpiralDine, ${ownerName}!</h2>
                <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
                  We are pleased to inform you that your restaurant application for <strong>${restaurantName}</strong> has been reviewed and <strong>approved</strong> by our administrative team.
                </p>
                <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
                  Your merchant owner dashboard is now active and ready for you to configure menus, floor plans, staff credentials, and inventory controls.
                </p>
                ${cleanNotes ? `<div style="background: #F8F5EE; border-left: 4px solid #1E3A2B; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #334155; margin-bottom: 20px;"><strong>Administrator Note:</strong> ${cleanNotes}</div>` : ''}
                <div style="text-align: center; margin: 28px 0 16px 0;">
                  <a href="${loginUrl}" class="btn" target="_blank">Launch Owner Dashboard &rarr;</a>
                </div>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} SpiralDine Platform. All rights reserved.
              </div>
            </div>
          </body>
          </html>
        `;

        await sendMailWithLogging({
          to: ownerEmail,
          subject: `Congratulations! Your SpiralDine Account is Approved (${restaurantName})`,
          html: approvalHtml,
          tenantId: tenantId,
          type: 'restaurant_application_approved'
        }).catch(err => console.warn('[review-application] Non-blocking email error:', err));
      }

      return res.status(200).json({
        success: true,
        action: 'approve',
        applicationId: cleanAppId,
        status: 'approved',
        message: 'Application approved successfully. Tenant, restaurant, and owner user are active.'
      });
    }

    if (action === 'reject') {
      const finalReason = cleanReason || 'Application does not meet current platform verification standards.';

      // 3.1 Update restaurantApplications
      await serverSetDoc(appDocRef, {
        status: 'rejected',
        rejectionReason: finalReason,
        reviewedAt: nowIso,
        reviewedBy: adminUser.uid,
        updatedAt: nowIso
      }, { merge: true });

      // 3.2 Update tenants/{tenantId}
      const tenantDocRef = serverDoc(serverDb, 'tenants', tenantId);
      await serverSetDoc(tenantDocRef, {
        status: 'rejected',
        updatedAt: nowIso
      }, { merge: true });

      // 3.3 Update restaurants/{tenantId}
      const restDocRef = serverDoc(serverDb, 'restaurants', tenantId);
      await serverSetDoc(restDocRef, {
        status: 'rejected',
        updatedAt: nowIso
      }, { merge: true });

      // 3.4 Update users/{ownerUid}
      if (ownerUid) {
        const userDocRef = serverDoc(serverDb, 'users', ownerUid);
        await serverSetDoc(userDocRef, {
          status: 'rejected',
          updatedAt: nowIso
        }, { merge: true });
      }

      // 3.5 Dispatch Rejection Email
      if (ownerEmail) {
        const rejectionHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Application Status Update - SpiralDine</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FCFAF7; color: #17233D; margin: 0; padding: 24px; }
              .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E2D9; overflow: hidden; }
              .header { background: #334155; color: #ffffff; padding: 28px 32px; text-align: left; }
              .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
              .content { padding: 32px; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; margin-bottom: 20px; }
              .reason-box { background: #FFF1F2; border-left: 4px solid #E11D48; padding: 14px 16px; border-radius: 6px; font-size: 14px; color: #881337; margin: 16px 0; }
              .footer { padding: 24px 32px; background: #F8F5EE; border-top: 1px solid #E8E2D9; font-size: 12px; color: #64748B; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>SpiralDine</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #E2E8F0;">Restaurant Operating System</p>
              </div>
              <div class="content">
                <span class="badge">&times; Application Status Update</span>
                <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #17233D;">Application Status for ${restaurantName}</h2>
                <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
                  Thank you for your interest in the SpiralDine platform. After reviewing your restaurant application, our administrative team was unable to approve your registration at this time.
                </p>
                <div class="reason-box">
                  <strong>Reason for Decision:</strong><br>
                  ${finalReason}
                </div>
                <p style="font-size: 13px; color: #64748B; line-height: 1.5;">
                  If you have questions or believe this decision was made in error, please contact our onboarding support team at <a href="mailto:kumbhageethakrishna143@gmail.com" style="color: #C97A52; font-weight: 700;">kumbhageethakrishna143@gmail.com</a>.
                </p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} SpiralDine Platform. All rights reserved.
              </div>
            </div>
          </body>
          </html>
        `;

        await sendMailWithLogging({
          to: ownerEmail,
          subject: `Update on your SpiralDine Application for ${restaurantName}`,
          html: rejectionHtml,
          tenantId: tenantId,
          type: 'restaurant_application_rejected'
        }).catch(err => console.warn('[review-application] Non-blocking email error:', err));
      }

      return res.status(200).json({
        success: true,
        action: 'reject',
        applicationId: cleanAppId,
        status: 'rejected',
        message: 'Application rejected.'
      });
    }

    if (action === 'request_info') {
      const moreInfoNotes = cleanNotes || 'Please provide additional business information to continue processing your restaurant application.';

      // 3.1 Update restaurantApplications
      await serverSetDoc(appDocRef, {
        status: 'more_info_required',
        moreInfoNotes: moreInfoNotes,
        reviewedAt: nowIso,
        reviewedBy: adminUser.uid,
        updatedAt: nowIso
      }, { merge: true });

      // 3.2 Update users/{ownerUid} status to more_info_required
      if (ownerUid) {
        const userDocRef = serverDoc(serverDb, 'users', ownerUid);
        await serverSetDoc(userDocRef, {
          status: 'more_info_required',
          updatedAt: nowIso
        }, { merge: true });
      }

      // 3.3 Dispatch More Info Email
      if (ownerEmail) {
        const statusUrl = 'https://spiral-dine.vercel.app/application-pending';
        const infoHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Action Required - SpiralDine</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FCFAF7; color: #17233D; margin: 0; padding: 24px; }
              .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E2D9; overflow: hidden; }
              .header { background: #1E3A2B; color: #ffffff; padding: 28px 32px; text-align: left; }
              .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
              .content { padding: 32px; }
              .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; margin-bottom: 20px; }
              .info-box { background: #F0F9FF; border-left: 4px solid #0284C7; padding: 14px 16px; border-radius: 6px; font-size: 14px; color: #0C4A6E; margin: 16px 0; }
              .btn { display: inline-block; background: #C97A52; color: #ffffff !important; padding: 12px 24px; font-size: 14px; font-weight: 700; border-radius: 10px; text-decoration: none; margin-top: 16px; }
              .footer { padding: 24px 32px; background: #F8F5EE; border-top: 1px solid #E8E2D9; font-size: 12px; color: #64748B; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>SpiralDine</h1>
                <p style="margin: 6px 0 0 0; font-size: 13px; color: #D1E5DA;">Restaurant Operating System</p>
              </div>
              <div class="content">
                <span class="badge">! Action Required &bull; Additional Information</span>
                <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #17233D;">Additional Information Needed for ${restaurantName}</h2>
                <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
                  Our administrative team has reviewed your restaurant application and needs additional information before completing verification:
                </p>
                <div class="info-box">
                  <strong>Requested Details:</strong><br>
                  ${moreInfoNotes}
                </div>
                <p style="font-size: 13px; color: #64748B; line-height: 1.5;">
                  You can track your application status or reply to this email with the requested documents:
                </p>
                <div style="text-align: center; margin: 24px 0 12px 0;">
                  <a href="${statusUrl}" class="btn" target="_blank">View Application Status &rarr;</a>
                </div>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} SpiralDine Platform. All rights reserved.
              </div>
            </div>
          </body>
          </html>
        `;

        await sendMailWithLogging({
          to: ownerEmail,
          subject: `Action Required: Additional Information for ${restaurantName} on SpiralDine`,
          html: infoHtml,
          tenantId: tenantId,
          type: 'restaurant_application_more_info'
        }).catch(err => console.warn('[review-application] Non-blocking email error:', err));
      }

      return res.status(200).json({
        success: true,
        action: 'request_info',
        applicationId: cleanAppId,
        status: 'more_info_required',
        message: 'More information requested from applicant.'
      });
    }

    return res.status(400).json({ error: 'Unrecognized action.' });
  } catch (err: any) {
    console.error('[review-application] Execution error:', err);
    return res.status(500).json({ error: 'Internal server error processing application review: ' + err.message });
  }
}
