/**
 * SpiralDine - Restaurant Application Approval Email Template (Firebase Functions)
 */

export interface RestaurantApprovalEmailData {
  ownerName: string;
  restaurantName: string;
  applicationId: string;
  loginUrl: string;
  supportEmail: string;
  reviewNotes?: string;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getApprovalTemplate(data: RestaurantApprovalEmailData): string {
  const safeOwner = escapeHtml(data.ownerName || 'Restaurant Owner');
  const safeRest = escapeHtml(data.restaurantName || 'Your Restaurant');
  const safeAppId = escapeHtml(data.applicationId || 'N/A');
  const safeSupport = escapeHtml(data.supportEmail || 'kumbhageethakrishna143@gmail.com');
  const safeNotes = data.reviewNotes ? escapeHtml(data.reviewNotes.trim()) : '';
  const loginUrl = data.loginUrl || 'https://spiral-dine.vercel.app/owner/login';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Restaurant Has Been Approved on SpiralDine!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FCFAF7; color: #17233D; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E2D9; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #1E3A2B; color: #ffffff; padding: 28px 32px; border-bottom: 3px solid #C97A52; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #D1E5DA; }
    .content { padding: 32px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; margin-bottom: 20px; }
    .btn { display: inline-block; background: #C97A52; color: #ffffff !important; padding: 14px 28px; font-size: 14px; font-weight: 700; border-radius: 12px; text-decoration: none; margin: 20px 0; }
    .steps { background: #FAFAFA; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px 20px; margin: 20px 0; font-size: 13px; line-height: 1.6; color: #334155; }
    .footer { padding: 20px 32px; background: #F8F5EE; border-top: 1px solid #E8E2D9; font-size: 12px; color: #64748B; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>SpiralDine</h1>
      <p>Restaurant Operating System</p>
    </div>
    <div class="content">
      <span class="badge">&#10003; Approved &bull; Active Merchant</span>
      <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #17233D;">Welcome to SpiralDine, ${safeOwner}!</h2>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px 0;">
        We are pleased to inform you that your restaurant application for <strong>${safeRest}</strong> (ID: <code>${safeAppId}</code>) has been reviewed and <strong>approved</strong> by our administrative team.
      </p>
      ${safeNotes ? `<div style="background: #FFFBEB; border-left: 4px solid #D97706; padding: 10px 14px; border-radius: 4px; font-size: 13px; color: #78350F; margin-bottom: 16px;"><strong>Reviewer Note:</strong> ${safeNotes}</div>` : ''}
      <div class="steps">
        <strong>Recommended Next Steps:</strong><br>
        1. Sign in to your Owner Portal with your registered credentials.<br>
        2. Set up your digital menu categories and signature items.<br>
        3. Configure dining tables and download contactless QR codes.<br>
        4. Invite staff members (waiters, kitchen chefs, managers).<br>
        5. Go live and start accepting orders and payments.
      </div>
      <div style="text-align: center;">
        <a href="${loginUrl}" class="btn" target="_blank">Launch Owner Dashboard &rarr;</a>
      </div>
      <p style="font-size: 12px; color: #64748B; margin-top: 24px;">
        Need help? Reach out to our merchant support team at <a href="mailto:${safeSupport}" style="color: #1E3A2B;">${safeSupport}</a>.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} SpiralDine Platform. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}
