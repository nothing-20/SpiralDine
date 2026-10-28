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
import { 
  getRestaurantApprovalHtml, 
  getRestaurantApprovalText 
} from '../../src/services/email/approvalEmailTemplate.js';

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

  if (!['approve', 'reject', 'request_info', 'resend_email'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action. Must be approve, reject, request_info, or resend_email.' });
  }

  try {
    await ensureServerAuth();

    // 2. Retrieve application document from authoritative collection (restaurants), with fallback to restaurantApplications
    const cleanAppId = String(applicationId).trim();
    const restDocRef = serverDoc(serverDb, 'restaurants', cleanAppId);
    let restSnap = await serverGetDoc(restDocRef);

    let appData: any = {};
    const appDocRef = serverDoc(serverDb, 'restaurantApplications', cleanAppId);

    if (restSnap.exists()) {
      appData = restSnap.data() || {};
    } else {
      const appSnap = await serverGetDoc(appDocRef);
      if (appSnap.exists()) {
        appData = appSnap.data() || {};
      } else {
        return res.status(404).json({ error: `Application document not found for ID: ${cleanAppId}` });
      }
    }

    const tenantId = appData.tenantId || cleanAppId;
    const ownerUid = appData.ownerUid;
    let ownerEmail = (appData.ownerEmail || '').trim().toLowerCase();
    let ownerName = appData.ownerName || 'Restaurant Owner';
    const restaurantName = appData.restaurantName || appData.name || 'Your Restaurant';
    const nowIso = new Date().toISOString();

    // Enrich missing applicant details from users/{ownerUid} if needed
    if ((!ownerEmail || ownerName === 'Restaurant Owner') && ownerUid) {
      try {
        const uSnap = await serverGetDoc(serverDoc(serverDb, 'users', ownerUid));
        if (uSnap.exists()) {
          const uData = uSnap.data() || {};
          ownerEmail = ownerEmail || (uData.email || '').trim().toLowerCase();
          ownerName = ownerName === 'Restaurant Owner' ? (uData.fullName || uData.displayName || 'Restaurant Owner') : ownerName;
        }
      } catch (uErr) {
        console.warn('[review-application] User profile lookup note:', uErr);
      }
    }

    const cleanNotes = notes ? String(notes).trim() : '';
    const cleanReason = reason ? String(reason).trim() : cleanNotes;

    // 3. Execute State Updates Based on Action
    if (action === 'approve') {
      const previousStatus = appData.status;
      const wasAlreadyApproved = previousStatus === 'active' || previousStatus === 'approved';

      // 3.1 Idempotency & Notification Lock Inspection
      const notifDocRef = serverDoc(serverDb, 'approvalNotifications', cleanAppId);
      let notifData: any = null;
      try {
        const notifSnap = await serverGetDoc(notifDocRef);
        if (notifSnap.exists()) {
          notifData = notifSnap.data();
        }
      } catch (err) {
        console.warn('[review-application] Secondary notifSnap read note:', err);
      }

      const safeSetNotifDoc = async (data: any) => {
        try {
          await serverSetDoc(notifDocRef, data, { merge: true });
        } catch (err) {
          console.warn('[review-application] Secondary notifDoc set note:', err);
        }
      };

      let notificationOutcome: {
        status: 'sent' | 'failed' | 'skipped';
        recipient: string | null;
        emailId?: string | null;
        error?: string | null;
        reason?: string;
      } = {
        status: 'skipped',
        recipient: ownerEmail || null,
        emailId: null,
        error: null,
      };

      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isEmailValid = Boolean(ownerEmail && EMAIL_REGEX.test(ownerEmail));

      const alreadySent = Boolean(
        (notifData && notifData.status === 'sent') ||
        appData.approvalNotificationStatus === 'sent'
      );

      if (wasAlreadyApproved && alreadySent) {
        // Document was already approved and notification was already delivered
        notificationOutcome = {
          status: 'skipped',
          reason: 'already_approved_and_notified',
          recipient: ownerEmail || null,
          emailId: notifData?.emailId || appData.approvalNotificationEmailId || null,
          error: null
        };
      } else if (alreadySent) {
        // Notification already sent previously
        notificationOutcome = {
          status: 'skipped',
          reason: 'already_sent',
          recipient: notifData?.recipient || ownerEmail,
          emailId: notifData?.emailId || appData.approvalNotificationEmailId || null,
          error: null
        };
      } else if (!isEmailValid) {
        // Recipient could not be resolved from authoritative records
        const failMsg = 'Authoritative owner email could not be resolved from restaurant or user profile.';
        console.warn(`[review-application] Approval notification skipped for ${cleanAppId}: ${failMsg}`);
        
        await safeSetNotifDoc({
          applicationId: cleanAppId,
          tenantId,
          eventType: 'restaurant_application_approved',
          status: 'failed',
          recipient: null,
          error: failMsg,
          updatedAt: nowIso,
          createdAt: notifData?.createdAt || nowIso,
          reviewerUid: adminUser.uid,
          attempts: (notifData?.attempts || 0) + 1
        });

        await serverSetDoc(restDocRef, {
          approvalNotificationStatus: 'failed',
          approvalNotificationError: failMsg,
          approvalNotificationAttempts: (notifData?.attempts || 0) + 1,
          updatedAt: nowIso
        }, { merge: true });

        notificationOutcome = {
          status: 'failed',
          recipient: null,
          emailId: null,
          error: failMsg
        };
      } else {
        // 3.2 Acquire Processing Lock (Prevents duplicate concurrent dispatch)
        const currentAttempts = (notifData?.attempts || 0) + 1;
        await safeSetNotifDoc({
          applicationId: cleanAppId,
          tenantId,
          eventType: 'restaurant_application_approved',
          status: 'processing',
          recipient: ownerEmail,
          attempts: currentAttempts,
          updatedAt: nowIso,
          createdAt: notifData?.createdAt || nowIso,
          reviewerUid: adminUser.uid,
        });

        // 3.3 Prepare Branded HTML & Plain-Text Acceptance Email
        const supportEmail = process.env.SUPPORT_NOTIFICATION_EMAIL || 'kumbhageethakrishna143@gmail.com';
        const loginUrl = 'https://spiral-dine.vercel.app/owner/login';

        const approvalHtml = getRestaurantApprovalHtml({
          ownerName,
          restaurantName,
          applicationId: cleanAppId,
          loginUrl,
          supportEmail,
          reviewNotes: cleanNotes || undefined
        });

        const approvalText = getRestaurantApprovalText({
          ownerName,
          restaurantName,
          applicationId: cleanAppId,
          loginUrl,
          supportEmail,
          reviewNotes: cleanNotes || undefined
        });

        // 3.4 Dispatch Acceptance Email through Resend
        try {
          const emailResult = await sendMailWithLogging({
            to: ownerEmail,
            subject: 'Your Restaurant Has Been Approved on SpiralDine!',
            html: approvalHtml,
            text: approvalText,
            tenantId,
            type: 'restaurant_application_approved',
            retries: 2
          });

          if (emailResult.success && emailResult.id) {
            // Success: Update notification tracker and restaurant document
            await safeSetNotifDoc({
              status: 'sent',
              emailId: emailResult.id,
              sentAt: nowIso,
              error: null,
              updatedAt: nowIso
            });

            await serverSetDoc(restDocRef, {
              approvalNotificationStatus: 'sent',
              approvalNotificationSentAt: nowIso,
              approvalNotificationEmailId: emailResult.id,
              approvalNotificationRecipient: ownerEmail,
              approvalNotificationAttempts: currentAttempts,
              approvalNotificationError: null,
              approvalNotificationErrorCategory: null,
              updatedAt: nowIso
            }, { merge: true });

            notificationOutcome = {
              status: 'sent',
              recipient: ownerEmail,
              emailId: emailResult.id,
              error: null
            };
          } else {
            // Failure: Record provider error and classify domain restrictions
            const rawErr = emailResult.error || 'Resend provider rejected dispatch';
            const isDomainRestriction = Boolean(
              emailResult.isDomainRestriction ||
              emailResult.errorCategory === 'domain_verification_required' ||
              rawErr.toLowerCase().includes('verify a domain') ||
              rawErr.toLowerCase().includes('testing emails to your own email address') ||
              rawErr.toLowerCase().includes('testing email address instead of domains')
            );

            const safeMsg = isDomainRestriction
              ? 'Domain verification required: Sandbox sender (onboarding@resend.dev) can only send to the account owner (kumbhageethakrishna1@gmail.com). A verified domain is required to send to external restaurant owners.'
              : rawErr;

            await safeSetNotifDoc({
              status: 'failed',
              error: safeMsg,
              rawError: rawErr,
              errorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error',
              updatedAt: nowIso
            });

            await serverSetDoc(restDocRef, {
              approvalNotificationStatus: 'failed',
              approvalNotificationError: safeMsg,
              approvalNotificationErrorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error',
              approvalNotificationAttempts: currentAttempts,
              updatedAt: nowIso
            }, { merge: true });

            notificationOutcome = {
              status: 'failed',
              recipient: ownerEmail,
              emailId: null,
              error: safeMsg,
              errorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error'
            };
          }
        } catch (sendErr: any) {
          const errDetail = sendErr.message || 'Unknown email dispatch error';
          console.error('[review-application] Email dispatch caught error:', sendErr);
          const isDomainRestriction = Boolean(
            errDetail.toLowerCase().includes('verify a domain') ||
            errDetail.toLowerCase().includes('testing emails to your own email address') ||
            errDetail.toLowerCase().includes('testing email address instead of domains')
          );

          const safeMsg = isDomainRestriction
            ? 'Domain verification required: Sandbox sender (onboarding@resend.dev) can only send to the account owner (kumbhageethakrishna1@gmail.com). A verified domain is required to send to external restaurant owners.'
            : errDetail;

          await safeSetNotifDoc({
            status: 'failed',
            error: safeMsg,
            rawError: errDetail,
            errorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error',
            updatedAt: nowIso
          });

          await serverSetDoc(restDocRef, {
            approvalNotificationStatus: 'failed',
            approvalNotificationError: safeMsg,
            approvalNotificationErrorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error',
            approvalNotificationAttempts: currentAttempts,
            updatedAt: nowIso
          }, { merge: true });

          notificationOutcome = {
            status: 'failed',
            recipient: ownerEmail,
            emailId: null,
            error: safeMsg,
            errorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error'
          };
        }
      }

      // 3.5 Update restaurants/{tenantId} (Authoritative)
      await serverSetDoc(restDocRef, {
        status: 'active',
        reviewedAt: nowIso,
        reviewedBy: adminUser.uid,
        reviewNotes: cleanNotes,
        updatedAt: nowIso
      }, { merge: true });

      // 3.6 Update tenants/{tenantId}
      const tenantDocRef = serverDoc(serverDb, 'tenants', tenantId);
      await serverSetDoc(tenantDocRef, {
        status: 'active',
        updatedAt: nowIso
      }, { merge: true });

      // 3.7 Update users/{ownerUid}
      if (ownerUid) {
        const userDocRef = serverDoc(serverDb, 'users', ownerUid);
        await serverSetDoc(userDocRef, {
          status: 'active',
          updatedAt: nowIso
        }, { merge: true });
      }

      // 3.8 Update restaurantApplications (Safe sync)
      try {
        await serverSetDoc(appDocRef, {
          status: 'approved',
          reviewedAt: nowIso,
          reviewedBy: adminUser.uid,
          reviewNotes: cleanNotes,
          updatedAt: nowIso
        }, { merge: true });
      } catch (appSyncErr) {
        console.warn('[review-application] Note: appSync handled:', appSyncErr);
      }

      return res.status(200).json({
        success: true,
        action: 'approve',
        applicationId: cleanAppId,
        status: 'approved',
        message: 'Application approved successfully. Tenant, restaurant, and owner user are active.',
        notification: notificationOutcome
      });
    }

    // Dedicated action: Resend Approval Notification (for already-approved restaurants)
    if (action === 'resend_email') {
      const currentStatus = appData.status;
      if (currentStatus !== 'active' && currentStatus !== 'approved') {
        return res.status(400).json({
          error: 'Cannot send approval notification: application has not been approved yet.'
        });
      }

      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!ownerEmail || !EMAIL_REGEX.test(ownerEmail)) {
        return res.status(400).json({
          error: 'Authoritative owner email could not be resolved from restaurant or user profile.'
        });
      }

      const notifDocRef = serverDoc(serverDb, 'approvalNotifications', cleanAppId);
      let notifData: any = null;
      try {
        const notifSnap = await serverGetDoc(notifDocRef);
        if (notifSnap.exists()) {
          notifData = notifSnap.data();
        }
      } catch (err) {
        console.warn('[review-application] Secondary notifSnap read note:', err);
      }

      const safeSetNotifDoc = async (data: any) => {
        try {
          await serverSetDoc(notifDocRef, data, { merge: true });
        } catch (err) {
          console.warn('[review-application] Secondary notifDoc set note:', err);
        }
      };

      const currentAttempts = (notifData?.attempts || 0) + 1;
      await safeSetNotifDoc({
        applicationId: cleanAppId,
        tenantId,
        eventType: 'restaurant_application_approved',
        status: 'processing',
        recipient: ownerEmail,
        attempts: currentAttempts,
        updatedAt: nowIso,
        reviewerUid: adminUser.uid,
      });

      const supportEmail = process.env.SUPPORT_NOTIFICATION_EMAIL || 'kumbhageethakrishna143@gmail.com';
      const loginUrl = 'https://spiral-dine.vercel.app/owner/login';

      const approvalHtml = getRestaurantApprovalHtml({
        ownerName,
        restaurantName,
        applicationId: cleanAppId,
        loginUrl,
        supportEmail,
        reviewNotes: cleanNotes || undefined
      });

      const approvalText = getRestaurantApprovalText({
        ownerName,
        restaurantName,
        applicationId: cleanAppId,
        loginUrl,
        supportEmail,
        reviewNotes: cleanNotes || undefined
      });

      try {
        const emailResult = await sendMailWithLogging({
          to: ownerEmail,
          subject: 'Your Restaurant Has Been Approved on SpiralDine!',
          html: approvalHtml,
          text: approvalText,
          tenantId,
          type: 'restaurant_application_approved',
          retries: 2
        });

        if (emailResult.success && emailResult.id) {
          await safeSetNotifDoc({
            status: 'sent',
            emailId: emailResult.id,
            sentAt: nowIso,
            error: null,
            errorCategory: null,
            updatedAt: nowIso
          });

          await serverSetDoc(restDocRef, {
            approvalNotificationStatus: 'sent',
            approvalNotificationSentAt: nowIso,
            approvalNotificationEmailId: emailResult.id,
            approvalNotificationRecipient: ownerEmail,
            approvalNotificationAttempts: currentAttempts,
            approvalNotificationError: null,
            approvalNotificationErrorCategory: null,
            updatedAt: nowIso
          }, { merge: true });

          return res.status(200).json({
            success: true,
            action: 'resend_email',
            applicationId: cleanAppId,
            message: 'Approval notification dispatched successfully.',
            notification: {
              status: 'sent',
              recipient: ownerEmail,
              emailId: emailResult.id,
              error: null
            }
          });
        } else {
          const rawErr = emailResult.error || 'Resend provider rejected dispatch';
          const isDomainRestriction = Boolean(
            emailResult.isDomainRestriction ||
            emailResult.errorCategory === 'domain_verification_required' ||
            rawErr.toLowerCase().includes('verify a domain') ||
            rawErr.toLowerCase().includes('testing emails to your own email address') ||
            rawErr.toLowerCase().includes('testing email address instead of domains')
          );

          const safeMsg = isDomainRestriction
            ? 'Domain verification required: Sandbox sender (onboarding@resend.dev) can only send to the account owner (kumbhageethakrishna1@gmail.com). A verified domain is required to send to external restaurant owners.'
            : rawErr;

          await safeSetNotifDoc({
            status: 'failed',
            error: safeMsg,
            rawError: rawErr,
            errorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error',
            updatedAt: nowIso
          });

          await serverSetDoc(restDocRef, {
            approvalNotificationStatus: 'failed',
            approvalNotificationError: safeMsg,
            approvalNotificationErrorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error',
            approvalNotificationAttempts: currentAttempts,
            updatedAt: nowIso
          }, { merge: true });

          return res.status(200).json({
            success: false,
            action: 'resend_email',
            applicationId: cleanAppId,
            message: 'Failed to dispatch approval notification.',
            notification: {
              status: 'failed',
              recipient: ownerEmail,
              emailId: null,
              error: safeMsg,
              errorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error'
            }
          });
        }
      } catch (sendErr: any) {
        const errDetail = sendErr.message || 'Unknown email dispatch error';
        const isDomainRestriction = Boolean(
          errDetail.toLowerCase().includes('verify a domain') ||
          errDetail.toLowerCase().includes('testing emails to your own email address') ||
          errDetail.toLowerCase().includes('testing email address instead of domains')
        );

        const safeMsg = isDomainRestriction
          ? 'Domain verification required: Sandbox sender (onboarding@resend.dev) can only send to the account owner (kumbhageethakrishna1@gmail.com). A verified domain is required to send to external restaurant owners.'
          : errDetail;

        await safeSetNotifDoc({
          status: 'failed',
          error: safeMsg,
          rawError: errDetail,
          errorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error',
          updatedAt: nowIso
        });

        await serverSetDoc(restDocRef, {
          approvalNotificationStatus: 'failed',
          approvalNotificationError: safeMsg,
          approvalNotificationErrorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error',
          approvalNotificationAttempts: currentAttempts,
          updatedAt: nowIso
        }, { merge: true });

        return res.status(200).json({
          success: false,
          action: 'resend_email',
          applicationId: cleanAppId,
          message: 'Failed to dispatch approval notification.',
          notification: {
            status: 'failed',
            recipient: ownerEmail,
            emailId: null,
            error: safeMsg,
            errorCategory: isDomainRestriction ? 'domain_verification_required' : 'provider_error'
          }
        });
      }
    }

    if (action === 'reject') {
      const finalReason = cleanReason || 'Application does not meet current platform verification standards.';

      // 3.1 Update restaurants/{tenantId} (Authoritative)
      await serverSetDoc(restDocRef, {
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

      // 3.3 Update users/{ownerUid}
      if (ownerUid) {
        const userDocRef = serverDoc(serverDb, 'users', ownerUid);
        await serverSetDoc(userDocRef, {
          status: 'rejected',
          updatedAt: nowIso
        }, { merge: true });
      }

      // 3.4 Update restaurantApplications (Safe sync)
      try {
        await serverSetDoc(appDocRef, {
          status: 'rejected',
          rejectionReason: finalReason,
          reviewedAt: nowIso,
          reviewedBy: adminUser.uid,
          updatedAt: nowIso
        }, { merge: true });
      } catch (appSyncErr) {
        console.warn('[review-application] Note: appSync handled on reject:', appSyncErr);
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

      // 3.1 Update restaurants/{tenantId} (Authoritative)
      await serverSetDoc(restDocRef, {
        status: 'more_info_required',
        moreInfoNotes: moreInfoNotes,
        reviewNotes: cleanNotes,
        reviewedAt: nowIso,
        reviewedBy: adminUser.uid,
        updatedAt: nowIso
      }, { merge: true });

      // 3.2 Update tenants/{tenantId}
      const tenantDocRef = serverDoc(serverDb, 'tenants', tenantId);
      await serverSetDoc(tenantDocRef, {
        status: 'more_info_required',
        updatedAt: nowIso
      }, { merge: true });

      // 3.3 Update users/{ownerUid} status to more_info_required
      if (ownerUid) {
        const userDocRef = serverDoc(serverDb, 'users', ownerUid);
        await serverSetDoc(userDocRef, {
          status: 'more_info_required',
          updatedAt: nowIso
        }, { merge: true });
      }

      // 3.4 Update restaurantApplications (Safe sync)
      try {
        await serverSetDoc(appDocRef, {
          status: 'more_info_required',
          moreInfoNotes: moreInfoNotes,
          reviewedAt: nowIso,
          reviewedBy: adminUser.uid,
          updatedAt: nowIso
        }, { merge: true });
      } catch (appSyncErr) {
        console.warn('[review-application] Note: appSync handled on request_info:', appSyncErr);
      }

      // 3.5 Dispatch More Info Email
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
