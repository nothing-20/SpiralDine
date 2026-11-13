import crypto from 'crypto';
import {
  OFFICIAL_BRAND_NAME,
  OFFICIAL_COMPANY_NAME,
  OFFICIAL_SUPPORT_EMAIL,
  PRODUCTION_DOMAIN,
} from '../../../src/shared/constants/contact.js';
import type { ValidatedContactSubmission } from './contactValidation.js';

export interface RenderedEmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface ContactTemplateMeta {
  referenceId: string;
  submittedAtIso: string;
  supportEmail?: string;
}

export function escapeHtml(input: string): string {
  if (!input) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateEnquiryReference(now: Date = new Date()): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SD-${datePart}-${randomPart}`;
}

function formatReadableTimestamp(isoTimestamp: string): string {
  try {
    const dt = new Date(isoTimestamp);
    const ist = dt.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return `${ist} IST`;
  } catch {
    return isoTimestamp;
  }
}

function renderSharedShell(params: {
  preheader: string;
  headerBadge: string;
  headline: string;
  bodyHtml: string;
  supportEmail: string;
  footerNote: string;
}): string {
  const safeSupport = escapeHtml(params.supportEmail);
  const currentYear = new Date().getUTCFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.headline)}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .sd-wrapper { padding: 16px 8px !important; }
      .sd-header { padding: 24px 20px !important; }
      .sd-body { padding: 24px 20px !important; }
      .sd-footer { padding: 20px !important; }
      .sd-detail-label { display: block !important; width: 100% !important; padding-bottom: 2px !important; }
      .sd-detail-val { display: block !important; width: 100% !important; padding-top: 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#FCFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#17202A;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(params.preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="sd-wrapper" style="background-color:#FCFAF7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:#FFFFFF;border:1px solid #E8DED6;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td class="sd-header" style="background-color:#183B2B;padding:28px 32px;border-bottom:4px solid #D65336;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="display:inline-block;font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#FFFFFF;">${OFFICIAL_BRAND_NAME}</span>
                    <span style="display:block;font-size:12px;color:#D1E5DA;margin-top:4px;font-weight:500;">A ${OFFICIAL_COMPANY_NAME} Platform &bull; Restaurant Operating System</span>
                  </td>
                  <td align="right" valign="top">
                    <span style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:#23523D;border:1px solid #357056;color:#E8F5EF;font-size:11px;font-weight:700;white-space:nowrap;">${escapeHtml(params.headerBadge)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="sd-body" style="padding:32px;">
              ${params.bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="sd-footer" style="background-color:#F8F5EE;border-top:1px solid #E8DED6;padding:22px 32px;text-align:center;font-size:12px;line-height:1.6;color:#667085;">
              <div style="font-weight:700;color:#17202A;">${OFFICIAL_BRAND_NAME} by ${OFFICIAL_COMPANY_NAME}</div>
              <div style="margin-top:4px;">
                Website: <a href="${PRODUCTION_DOMAIN}" style="color:#D65336;text-decoration:none;font-weight:600;">${PRODUCTION_DOMAIN}</a>
                &nbsp;&bull;&nbsp;
                Support: <a href="mailto:${safeSupport}" style="color:#D65336;text-decoration:none;font-weight:600;">${safeSupport}</a>
              </div>
              <div style="margin-top:6px;font-size:11px;color:#8A817A;">${escapeHtml(params.footerNote)}</div>
              <div style="margin-top:4px;font-size:11px;color:#8A817A;">&copy; ${currentYear} ${OFFICIAL_COMPANY_NAME}. All rights reserved.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Support inbox notification email delivered to support@spiralworld.in.
 */
export function buildSupportEnquiryEmail(
  data: ValidatedContactSubmission,
  meta: ContactTemplateMeta
): RenderedEmailContent {
  const supportEmail = meta.supportEmail || OFFICIAL_SUPPORT_EMAIL;
  const formattedTime = formatReadableTimestamp(meta.submittedAtIso);
  const subject = `[${OFFICIAL_BRAND_NAME} Enquiry] ${data.category} — ${data.subject}`.slice(0, 180);

  const safeName = escapeHtml(data.name);
  const safeEmail = escapeHtml(data.email);
  const safePhone = data.phone ? escapeHtml(data.phone) : 'Not provided';
  const safeRestaurant = data.restaurantName ? escapeHtml(data.restaurantName) : 'Not provided';
  const safeCategory = escapeHtml(data.category);
  const safeSubject = escapeHtml(data.subject);
  const safeMessage = escapeHtml(data.message);
  const safeRef = escapeHtml(meta.referenceId);
  const safeTime = escapeHtml(formattedTime);

  const bodyHtml = `
    <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:800;color:#17202A;line-height:1.3;">New Contact Enquiry Received</h1>
    <p style="margin:0 0 20px 0;font-size:14px;color:#667085;line-height:1.5;">
      A visitor submitted an enquiry through the ${OFFICIAL_BRAND_NAME} Contact page (<a href="${PRODUCTION_DOMAIN}/contact" style="color:#D65336;text-decoration:none;font-weight:600;">dine.spiralworld.in</a>).
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#FCFAF7;border:1px solid #E8DED6;border-radius:12px;margin-bottom:22px;">
      <tr>
        <td class="sd-detail-label" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;width:36%;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Reference</td>
        <td class="sd-detail-val" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;font-weight:700;color:#17202A;font-family:monospace;">${safeRef}</td>
      </tr>
      <tr>
        <td class="sd-detail-label" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Submitted</td>
        <td class="sd-detail-val" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;color:#17202A;">${safeTime}</td>
      </tr>
      <tr>
        <td class="sd-detail-label" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Category</td>
        <td class="sd-detail-val" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;">
          <span style="display:inline-block;padding:3px 10px;border-radius:6px;background-color:#FCEDE7;color:#D65336;font-weight:700;font-size:12px;">${safeCategory}</span>
        </td>
      </tr>
      <tr>
        <td class="sd-detail-label" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Full Name</td>
        <td class="sd-detail-val" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;font-weight:700;color:#17202A;">${safeName}</td>
      </tr>
      <tr>
        <td class="sd-detail-label" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Email Address</td>
        <td class="sd-detail-val" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;font-weight:700;">
          <a href="mailto:${safeEmail}" style="color:#D65336;text-decoration:none;word-break:break-all;">${safeEmail}</a>
        </td>
      </tr>
      <tr>
        <td class="sd-detail-label" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Phone</td>
        <td class="sd-detail-val" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;color:#17202A;">${safePhone}</td>
      </tr>
      <tr>
        <td class="sd-detail-label" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Restaurant / Business</td>
        <td class="sd-detail-val" style="padding:11px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;color:#17202A;">${safeRestaurant}</td>
      </tr>
      <tr>
        <td class="sd-detail-label" style="padding:11px 16px;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Subject</td>
        <td class="sd-detail-val" style="padding:11px 16px;font-size:13px;font-weight:700;color:#17202A;">${safeSubject}</td>
      </tr>
    </table>

    <div style="margin-bottom:22px;">
      <div style="font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Customer Message</div>
      <div style="background-color:#FCFAF7;border:1px solid #E8DED6;border-left:4px solid #D65336;border-radius:10px;padding:16px 18px;font-size:14px;line-height:1.65;color:#17202A;white-space:pre-wrap;word-break:break-word;">${safeMessage}</div>
    </div>

    <div style="background-color:#E8F5EF;border:1px solid #BCE3D0;border-radius:10px;padding:14px 16px;font-size:13px;color:#066349;line-height:1.5;">
      <strong>Quick Action:</strong> Reply directly to this email to respond to <strong>${safeName}</strong> at <a href="mailto:${safeEmail}" style="color:#066349;font-weight:700;">${safeEmail}</a>.
    </div>
  `;

  const html = renderSharedShell({
    preheader: `New enquiry from ${data.name} (${data.category}): ${data.subject}`,
    headerBadge: 'Customer Enquiry',
    headline: subject,
    bodyHtml,
    supportEmail,
    footerNote: `Delivered via ${OFFICIAL_BRAND_NAME} Contact Form on behalf of ${data.name}. Reply-To is set to ${data.email}.`,
  });

  const text = [
    `${OFFICIAL_BRAND_NAME.toUpperCase()} (${OFFICIAL_COMPANY_NAME.toUpperCase()}) — NEW CONTACT ENQUIRY`,
    `Reference: ${meta.referenceId}`,
    `Submitted: ${formattedTime} (${meta.submittedAtIso})`,
    '',
    `Category:              ${data.category}`,
    `Subject:               ${data.subject}`,
    `Full Name:             ${data.name}`,
    `Email Address:         ${data.email}`,
    `Phone Number:          ${data.phone || 'Not provided'}`,
    `Restaurant / Business: ${data.restaurantName || 'Not provided'}`,
    '',
    'MESSAGE:',
    '------------------------------------------------------------',
    data.message,
    '------------------------------------------------------------',
    '',
    `Reply directly to this email to respond to ${data.name} (${data.email}).`,
    `Portal: ${PRODUCTION_DOMAIN}/contact`,
  ].join('\n');

  return { subject, html, text };
}

/**
 * Customer confirmation email sent when CONTACT_SEND_ACK is enabled.
 * Explicitly confirms receipt only without claiming the enquiry has been resolved.
 */
export function buildCustomerAcknowledgementEmail(
  data: ValidatedContactSubmission,
  meta: ContactTemplateMeta
): RenderedEmailContent {
  const supportEmail = meta.supportEmail || OFFICIAL_SUPPORT_EMAIL;
  const formattedTime = formatReadableTimestamp(meta.submittedAtIso);
  const subject = `We received your enquiry — ${OFFICIAL_BRAND_NAME}`;

  const safeName = escapeHtml(data.name);
  const safeSupport = escapeHtml(supportEmail);
  const safeCategory = escapeHtml(data.category);
  const safeSubject = escapeHtml(data.subject);
  const safeRestaurant = data.restaurantName ? escapeHtml(data.restaurantName) : '';
  const safeMessage = escapeHtml(data.message);
  const safeRef = escapeHtml(meta.referenceId);
  const safeTime = escapeHtml(formattedTime);

  const bodyHtml = `
    <div style="margin-bottom:16px;">
      <span style="display:inline-block;padding:5px 12px;border-radius:999px;background-color:#E8F5EF;border:1px solid #BCE3D0;color:#087B5B;font-size:12px;font-weight:700;">&#10003; Enquiry Received</span>
    </div>

    <h1 style="margin:0 0 12px 0;font-size:21px;font-weight:800;color:#17202A;line-height:1.3;">Hello ${safeName},</h1>
    <p style="margin:0 0 14px 0;font-size:14px;color:#334155;line-height:1.65;">
      Thank you for reaching out to <strong>${OFFICIAL_BRAND_NAME}</strong> by <strong>${OFFICIAL_COMPANY_NAME}</strong>. We confirm that your enquiry has been received by our support inbox and is queued for review.
    </p>
    <p style="margin:0 0 22px 0;font-size:14px;color:#334155;line-height:1.65;">
      A member of the ${OFFICIAL_BRAND_NAME} team will review your details and reply to you directly as soon as possible.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#FCFAF7;border:1px solid #E8DED6;border-radius:12px;margin-bottom:22px;">
      <tr>
        <td class="sd-detail-label" style="padding:10px 16px;border-bottom:1px solid #EFEAE0;width:36%;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Reference</td>
        <td class="sd-detail-val" style="padding:10px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;font-weight:700;color:#17202A;font-family:monospace;">${safeRef}</td>
      </tr>
      <tr>
        <td class="sd-detail-label" style="padding:10px 16px;border-bottom:1px solid #EFEAE0;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Received On</td>
        <td class="sd-detail-val" style="padding:10px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;color:#17202A;">${safeTime}</td>
      </tr>
      <tr>
        <td class="sd-detail-label" style="padding:10px 16px;border-bottom:1px solid #EFEAE0;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Category</td>
        <td class="sd-detail-val" style="padding:10px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;font-weight:700;color:#17202A;">${safeCategory}</td>
      </tr>
      ${safeRestaurant ? `
      <tr>
        <td class="sd-detail-label" style="padding:10px 16px;border-bottom:1px solid #EFEAE0;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Restaurant / Business</td>
        <td class="sd-detail-val" style="padding:10px 16px;border-bottom:1px solid #EFEAE0;font-size:13px;color:#17202A;">${safeRestaurant}</td>
      </tr>` : ''}
      <tr>
        <td class="sd-detail-label" style="padding:10px 16px;font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;">Subject</td>
        <td class="sd-detail-val" style="padding:10px 16px;font-size:13px;font-weight:700;color:#17202A;">${safeSubject}</td>
      </tr>
    </table>

    <div style="margin-bottom:24px;">
      <div style="font-size:12px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Copy of Your Submitted Message</div>
      <div style="background-color:#FCFAF7;border:1px solid #E8DED6;border-radius:10px;padding:14px 16px;font-size:13px;line-height:1.6;color:#334155;white-space:pre-wrap;word-break:break-word;">${safeMessage}</div>
    </div>

    <div style="border-top:1px solid #E8DED6;padding-top:18px;font-size:13px;color:#667085;line-height:1.6;">
      <strong style="color:#17202A;">Support Hours &amp; Direct Contact</strong><br>
      Monday to Saturday, 9:00 AM &ndash; 8:00 PM IST<br>
      If you need to share additional context before we reply, please write to <a href="mailto:${safeSupport}" style="color:#D65336;font-weight:700;text-decoration:none;">${safeSupport}</a> with your reference <strong style="color:#17202A;">${safeRef}</strong>.
    </div>
  `;

  const html = renderSharedShell({
    preheader: `We received your enquiry (${meta.referenceId}) and our ${OFFICIAL_BRAND_NAME} team will reply shortly.`,
    headerBadge: 'Confirmation',
    headline: subject,
    bodyHtml,
    supportEmail,
    footerNote: `This is an automated acknowledgement confirming receipt of your enquiry submitted on ${PRODUCTION_DOMAIN}.`,
  });

  const text = [
    `${OFFICIAL_BRAND_NAME.toUpperCase()} BY ${OFFICIAL_COMPANY_NAME.toUpperCase()}`,
    `Subject: ${subject}`,
    '',
    `Hello ${data.name},`,
    '',
    `Thank you for contacting ${OFFICIAL_BRAND_NAME} (${OFFICIAL_COMPANY_NAME}).`,
    'This message confirms that we have received your enquiry. A member of our team will review it and get back to you as soon as possible.',
    '',
    'ENQUIRY SUMMARY:',
    `Reference:             ${meta.referenceId}`,
    `Received On:           ${formattedTime}`,
    `Category:              ${data.category}`,
    ...(data.restaurantName ? [`Restaurant / Business: ${data.restaurantName}`] : []),
    `Subject:               ${data.subject}`,
    '',
    'YOUR MESSAGE:',
    '------------------------------------------------------------',
    data.message,
    '------------------------------------------------------------',
    '',
    'SUPPORT DETAILS:',
    'Hours: Monday to Saturday, 9:00 AM - 8:00 PM IST',
    `Email: ${supportEmail} (mention reference ${meta.referenceId} if replying with more details)`,
    `Website: ${PRODUCTION_DOMAIN}`,
  ].join('\n');

  return { subject, html, text };
}

