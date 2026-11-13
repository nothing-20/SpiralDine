import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, FirebaseAdminInitError } from '../_lib/firebaseAdmin.js';
import {
  handleAuthError,
  requireSuperAdmin,
  VerifiedAuthContext,
} from '../_lib/authMiddleware.js';
import { sendMailWithLogging } from '../_lib/resendHelper.js';
import {
  getRestaurantApprovalHtml,
  getRestaurantApprovalText,
} from '../../src/services/email/approvalEmailTemplate.js';

const OFFICIAL_SUPPORT_EMAIL = 'support@spiralworld.in';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ReviewRequestBody {
  applicationId?: unknown;
  action?: unknown;
  notes?: unknown;
  reason?: unknown;
}

interface NotificationOutcome {
  status: 'sent' | 'failed' | 'skipped';
  recipient: string | null;
  emailId?: string | null;
  error?: string | null;
  reason?: string;
  errorCategory?: string | null;
}

function getSupportEmail(): string {
  return process.env.SUPPORT_NOTIFICATION_EMAIL || OFFICIAL_SUPPORT_EMAIL;
}

function isDomainRestrictionError(rawErr: string, emailResult?: { isDomainRestriction?: boolean; errorCategory?: string }): boolean {
  const lower = rawErr.toLowerCase();
  return Boolean(
    emailResult?.isDomainRestriction ||
      emailResult?.errorCategory === 'domain_verification_required' ||
      lower.includes('verify a domain') ||
      lower.includes('testing emails to your own email address') ||
      lower.includes('testing email address instead of domains')
  );
}

async function safeMergeNotifDoc(
  notifDocRef: FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await notifDocRef.set(data, { merge: true });
  } catch (err) {
    console.warn('[review-application] Secondary notifDoc set note:', err);
  }
}

async function dispatchApprovalNotification(params: {
  cleanAppId: string;
  tenantId: string;
  ownerEmail: string;
  ownerName: string;
  restaurantName: string;
  cleanNotes: string;
  nowIso: string;
  reviewerUid: string;
  currentAttempts: number;
  notifDocRef: FirebaseFirestore.DocumentReference;
  restDocRef: FirebaseFirestore.DocumentReference;
}): Promise<NotificationOutcome> {
  const {
    cleanAppId,
    tenantId,
    ownerEmail,
    ownerName,
    restaurantName,
    cleanNotes,
    nowIso,
    reviewerUid,
    currentAttempts,
    notifDocRef,
    restDocRef,
  } = params;

  const supportEmail = getSupportEmail();
  const baseUrl = (process.env.APP_PUBLIC_URL || 'https://spiral-dine.vercel.app').replace(/\/+$/, '');
  const loginUrl = `${baseUrl}/owner/login`;

  const approvalHtml = getRestaurantApprovalHtml({
    ownerName,
    restaurantName,
    applicationId: cleanAppId,
    loginUrl,
    supportEmail,
    reviewNotes: cleanNotes || undefined,
  });

  const approvalText = getRestaurantApprovalText({
    ownerName,
    restaurantName,
    applicationId: cleanAppId,
    loginUrl,
    supportEmail,
    reviewNotes: cleanNotes || undefined,
  });

  try {
    const emailResult = await sendMailWithLogging({
      to: ownerEmail,
      subject: 'Your Restaurant Has Been Approved on SpiralDine!',
      html: approvalHtml,
      text: approvalText,
      tenantId,
      type: 'restaurant_application_approved',
      retries: 2,
    });

    if (emailResult.success && emailResult.id) {
      await safeMergeNotifDoc(notifDocRef, {
        status: 'sent',
        emailId: emailResult.id,
        sentAt: nowIso,
        error: null,
        errorCategory: null,
        updatedAt: nowIso,
      });

      await restDocRef.set(
        {
          approvalNotificationStatus: 'sent',
          approvalNotificationSentAt: nowIso,
          approvalNotificationEmailId: emailResult.id,
          approvalNotificationRecipient: ownerEmail,
          approvalNotificationAttempts: currentAttempts,
          approvalNotificationError: null,
          approvalNotificationErrorCategory: null,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      return {
        status: 'sent',
        recipient: ownerEmail,
        emailId: emailResult.id,
        error: null,
      };
    }

    const rawErr = emailResult.error || 'Resend provider rejected dispatch';
    const domainRestricted = isDomainRestrictionError(rawErr, emailResult);
    const category = domainRestricted ? 'domain_verification_required' : 'provider_error';
    const safeMsg = domainRestricted
      ? 'Domain verification required: Sandbox sender (onboarding@resend.dev) can only send to the Resend account owner. A verified domain is required to send to external restaurant owners.'
      : rawErr;

    await safeMergeNotifDoc(notifDocRef, {
      status: 'failed',
      error: safeMsg,
      rawError: rawErr,
      errorCategory: category,
      updatedAt: nowIso,
      reviewerUid,
    });

    await restDocRef.set(
      {
        approvalNotificationStatus: 'failed',
        approvalNotificationError: safeMsg,
        approvalNotificationErrorCategory: category,
        approvalNotificationAttempts: currentAttempts,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return {
      status: 'failed',
      recipient: ownerEmail,
      emailId: null,
      error: safeMsg,
      errorCategory: category,
    };
  } catch (sendErr: unknown) {
    const errDetail = sendErr instanceof Error ? sendErr.message : 'Unknown email dispatch error';
    console.error('[review-application] Email dispatch caught error:', sendErr);
    const domainRestricted = isDomainRestrictionError(errDetail);
    const category = domainRestricted ? 'domain_verification_required' : 'provider_error';
    const safeMsg = domainRestricted
      ? 'Domain verification required: Sandbox sender (onboarding@resend.dev) can only send to the Resend account owner. A verified domain is required to send to external restaurant owners.'
      : errDetail;

    await safeMergeNotifDoc(notifDocRef, {
      status: 'failed',
      error: safeMsg,
      rawError: errDetail,
      errorCategory: category,
      updatedAt: nowIso,
      reviewerUid,
    });

    await restDocRef.set(
      {
        approvalNotificationStatus: 'failed',
        approvalNotificationError: safeMsg,
        approvalNotificationErrorCategory: category,
        approvalNotificationAttempts: currentAttempts,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    return {
      status: 'failed',
      recipient: ownerEmail,
      emailId: null,
      error: safeMsg,
      errorCategory: category,
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Cryptographically verify Firebase ID token & enforce Super Admin authorization
  let adminUser: VerifiedAuthContext;
  try {
    adminUser = await requireSuperAdmin(req);
  } catch (authErr: unknown) {
    return handleAuthError(res, authErr);
  }

  const { applicationId, action, notes, reason } = (req.body || {}) as ReviewRequestBody;

  if (!applicationId || !action || typeof action !== 'string') {
    return res
      .status(400)
      .json({ error: 'Missing required parameters: applicationId and action.' });
  }

  if (!['approve', 'reject', 'request_info', 'resend_email'].includes(action)) {
    return res
      .status(400)
      .json({ error: 'Invalid action. Must be approve, reject, request_info, or resend_email.' });
  }

  try {
    // 2. Retrieve application document from authoritative collection (restaurants), fallback to restaurantApplications
    const cleanAppId = String(applicationId).trim();
    const restDocRef = adminDb.collection('restaurants').doc(cleanAppId);
    const appDocRef = adminDb.collection('restaurantApplications').doc(cleanAppId);

    const restSnap = await restDocRef.get();
    let appData: Record<string, unknown> = {};

    if (restSnap.exists) {
      appData = (restSnap.data() as Record<string, unknown>) || {};
    } else {
      const appSnap = await appDocRef.get();
      if (appSnap.exists) {
        appData = (appSnap.data() as Record<string, unknown>) || {};
      } else {
        return res
          .status(404)
          .json({ error: `Application document not found for ID: ${cleanAppId}` });
      }
    }

    const tenantId =
      typeof appData.tenantId === 'string' && appData.tenantId ? appData.tenantId : cleanAppId;
    const ownerUid = typeof appData.ownerUid === 'string' ? appData.ownerUid : '';
    let ownerEmail =
      typeof appData.ownerEmail === 'string' ? appData.ownerEmail.trim().toLowerCase() : '';
    let ownerName =
      typeof appData.ownerName === 'string' && appData.ownerName
        ? appData.ownerName
        : 'Restaurant Owner';
    const restaurantName =
      (typeof appData.restaurantName === 'string' && appData.restaurantName) ||
      (typeof appData.name === 'string' && appData.name) ||
      'Your Restaurant';
    const nowIso = new Date().toISOString();

    if ((!ownerEmail || ownerName === 'Restaurant Owner') && ownerUid) {
      try {
        const uSnap = await adminDb.collection('users').doc(ownerUid).get();
        if (uSnap.exists) {
          const uData = (uSnap.data() as Record<string, unknown>) || {};
          const uEmail = typeof uData.email === 'string' ? uData.email.trim().toLowerCase() : '';
          const uFullName = typeof uData.fullName === 'string' ? uData.fullName : '';
          const uDisplayName = typeof uData.displayName === 'string' ? uData.displayName : '';
          ownerEmail = ownerEmail || uEmail;
          ownerName =
            ownerName === 'Restaurant Owner'
              ? uFullName || uDisplayName || 'Restaurant Owner'
              : ownerName;
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

      const notifDocRef = adminDb.collection('approvalNotifications').doc(cleanAppId);
      let notifData: Record<string, unknown> | null = null;
      try {
        const notifSnap = await notifDocRef.get();
        if (notifSnap.exists) {
          notifData = (notifSnap.data() as Record<string, unknown>) || null;
        }
      } catch (err) {
        console.warn('[review-application] Secondary notifSnap read note:', err);
      }

      let notificationOutcome: NotificationOutcome = {
        status: 'skipped',
        recipient: ownerEmail || null,
        emailId: null,
        error: null,
      };

      const isEmailValid = Boolean(ownerEmail && EMAIL_REGEX.test(ownerEmail));
      const alreadySent = Boolean(
        notifData?.status === 'sent' || appData.approvalNotificationStatus === 'sent'
      );

      if (wasAlreadyApproved && alreadySent) {
        notificationOutcome = {
          status: 'skipped',
          reason: 'already_approved_and_notified',
          recipient: ownerEmail || null,
          emailId:
            (typeof notifData?.emailId === 'string' ? notifData.emailId : null) ||
            (typeof appData.approvalNotificationEmailId === 'string'
              ? appData.approvalNotificationEmailId
              : null),
          error: null,
        };
      } else if (alreadySent) {
        notificationOutcome = {
          status: 'skipped',
          reason: 'already_sent',
          recipient:
            (typeof notifData?.recipient === 'string' ? notifData.recipient : null) || ownerEmail,
          emailId:
            (typeof notifData?.emailId === 'string' ? notifData.emailId : null) ||
            (typeof appData.approvalNotificationEmailId === 'string'
              ? appData.approvalNotificationEmailId
              : null),
          error: null,
        };
      } else if (!isEmailValid) {
        const failMsg =
          'Authoritative owner email could not be resolved from restaurant or user profile.';
        console.warn(`[review-application] Approval notification skipped for ${cleanAppId}: ${failMsg}`);
        const attempts = (typeof notifData?.attempts === 'number' ? notifData.attempts : 0) + 1;

        await safeMergeNotifDoc(notifDocRef, {
          applicationId: cleanAppId,
          tenantId,
          eventType: 'restaurant_application_approved',
          status: 'failed',
          recipient: null,
          error: failMsg,
          updatedAt: nowIso,
          createdAt: notifData?.createdAt || nowIso,
          reviewerUid: adminUser.uid,
          attempts,
        });

        await restDocRef.set(
          {
            approvalNotificationStatus: 'failed',
            approvalNotificationError: failMsg,
            approvalNotificationAttempts: attempts,
            updatedAt: nowIso,
          },
          { merge: true }
        );

        notificationOutcome = {
          status: 'failed',
          recipient: null,
          emailId: null,
          error: failMsg,
        };
      } else {
        const currentAttempts =
          (typeof notifData?.attempts === 'number' ? notifData.attempts : 0) + 1;
        await safeMergeNotifDoc(notifDocRef, {
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

        notificationOutcome = await dispatchApprovalNotification({
          cleanAppId,
          tenantId,
          ownerEmail,
          ownerName,
          restaurantName,
          cleanNotes,
          nowIso,
          reviewerUid: adminUser.uid,
          currentAttempts,
          notifDocRef,
          restDocRef,
        });
      }

      await restDocRef.set(
        {
          status: 'active',
          reviewedAt: nowIso,
          reviewedBy: adminUser.uid,
          reviewNotes: cleanNotes,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      await adminDb.collection('tenants').doc(tenantId).set(
        {
          status: 'active',
          updatedAt: nowIso,
        },
        { merge: true }
      );

      if (ownerUid) {
        await adminDb.collection('users').doc(ownerUid).set(
          {
            status: 'active',
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      try {
        await appDocRef.set(
          {
            status: 'approved',
            reviewedAt: nowIso,
            reviewedBy: adminUser.uid,
            reviewNotes: cleanNotes,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      } catch (appSyncErr) {
        console.warn('[review-application] Note: appSync handled:', appSyncErr);
      }

      return res.status(200).json({
        success: true,
        action: 'approve',
        applicationId: cleanAppId,
        status: 'approved',
        message:
          'Application approved successfully. Tenant, restaurant, and owner user are active.',
        notification: notificationOutcome,
      });
    }

    if (action === 'resend_email') {
      const currentStatus = appData.status;
      if (currentStatus !== 'active' && currentStatus !== 'approved') {
        return res.status(400).json({
          error: 'Cannot send approval notification: application has not been approved yet.',
        });
      }

      if (!ownerEmail || !EMAIL_REGEX.test(ownerEmail)) {
        return res.status(400).json({
          error: 'Authoritative owner email could not be resolved from restaurant or user profile.',
        });
      }

      const notifDocRef = adminDb.collection('approvalNotifications').doc(cleanAppId);
      let notifData: Record<string, unknown> | null = null;
      try {
        const notifSnap = await notifDocRef.get();
        if (notifSnap.exists) {
          notifData = (notifSnap.data() as Record<string, unknown>) || null;
        }
      } catch (err) {
        console.warn('[review-application] Secondary notifSnap read note:', err);
      }

      const currentAttempts =
        (typeof notifData?.attempts === 'number' ? notifData.attempts : 0) + 1;
      await safeMergeNotifDoc(notifDocRef, {
        applicationId: cleanAppId,
        tenantId,
        eventType: 'restaurant_application_approved',
        status: 'processing',
        recipient: ownerEmail,
        attempts: currentAttempts,
        updatedAt: nowIso,
        reviewerUid: adminUser.uid,
      });

      const outcome = await dispatchApprovalNotification({
        cleanAppId,
        tenantId,
        ownerEmail,
        ownerName,
        restaurantName,
        cleanNotes,
        nowIso,
        reviewerUid: adminUser.uid,
        currentAttempts,
        notifDocRef,
        restDocRef,
      });

      if (outcome.status === 'sent') {
        return res.status(200).json({
          success: true,
          action: 'resend_email',
          applicationId: cleanAppId,
          message: 'Approval notification dispatched successfully.',
          notification: {
            status: 'sent',
            recipient: outcome.recipient,
            emailId: outcome.emailId,
            error: null,
          },
        });
      }

      return res.status(200).json({
        success: false,
        action: 'resend_email',
        applicationId: cleanAppId,
        message: 'Failed to dispatch approval notification.',
        notification: {
          status: 'failed',
          recipient: outcome.recipient,
          emailId: null,
          error: outcome.error,
          errorCategory: outcome.errorCategory,
        },
      });
    }

    if (action === 'reject') {
      const finalReason =
        cleanReason || 'Application does not meet current platform verification standards.';

      await restDocRef.set(
        {
          status: 'rejected',
          rejectionReason: finalReason,
          reviewedAt: nowIso,
          reviewedBy: adminUser.uid,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      await adminDb.collection('tenants').doc(tenantId).set(
        {
          status: 'rejected',
          updatedAt: nowIso,
        },
        { merge: true }
      );

      if (ownerUid) {
        await adminDb.collection('users').doc(ownerUid).set(
          {
            status: 'rejected',
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      try {
        await appDocRef.set(
          {
            status: 'rejected',
            rejectionReason: finalReason,
            reviewedAt: nowIso,
            reviewedBy: adminUser.uid,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      } catch (appSyncErr) {
        console.warn('[review-application] Note: appSync handled on reject:', appSyncErr);
      }

      if (ownerEmail) {
        const supportEmail = getSupportEmail();
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
                  If you have questions or believe this decision was made in error, please contact our onboarding support team at <a href="mailto:${supportEmail}" style="color: #C97A52; font-weight: 700;">${supportEmail}</a>.
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
          tenantId,
          type: 'restaurant_application_rejected',
        }).catch((err) => console.warn('[review-application] Non-blocking email error:', err));
      }

      return res.status(200).json({
        success: true,
        action: 'reject',
        applicationId: cleanAppId,
        status: 'rejected',
        message: 'Application rejected.',
      });
    }

    if (action === 'request_info') {
      const moreInfoNotes =
        cleanNotes ||
        'Please provide additional business information to continue processing your restaurant application.';

      await restDocRef.set(
        {
          status: 'more_info_required',
          moreInfoNotes,
          reviewNotes: cleanNotes,
          reviewedAt: nowIso,
          reviewedBy: adminUser.uid,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      await adminDb.collection('tenants').doc(tenantId).set(
        {
          status: 'more_info_required',
          updatedAt: nowIso,
        },
        { merge: true }
      );

      if (ownerUid) {
        await adminDb.collection('users').doc(ownerUid).set(
          {
            status: 'more_info_required',
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      try {
        await appDocRef.set(
          {
            status: 'more_info_required',
            moreInfoNotes,
            reviewedAt: nowIso,
            reviewedBy: adminUser.uid,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      } catch (appSyncErr) {
        console.warn('[review-application] Note: appSync handled on request_info:', appSyncErr);
      }

      if (ownerEmail) {
        const baseUrl = (process.env.APP_PUBLIC_URL || 'https://spiral-dine.vercel.app').replace(/\/+$/, '');
        const statusUrl = `${baseUrl}/application-pending`;
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
          tenantId,
          type: 'restaurant_application_more_info',
        }).catch((err) => console.warn('[review-application] Non-blocking email error:', err));
      }

      return res.status(200).json({
        success: true,
        action: 'request_info',
        applicationId: cleanAppId,
        status: 'more_info_required',
        message: 'More information requested from applicant.',
      });
    }

    return res.status(400).json({ error: 'Unrecognized action.' });
  } catch (err: unknown) {
    if (err instanceof FirebaseAdminInitError) {
      return handleAuthError(res, err);
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[review-application] Execution error:', err);
    return res
      .status(500)
      .json({ error: 'Internal server error processing application review: ' + message });
  }
}
