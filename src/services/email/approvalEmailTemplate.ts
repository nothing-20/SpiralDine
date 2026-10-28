/**
 * SpiralDine - Restaurant Application Approval Email Templates
 *
 * Provides responsive, branded HTML and plain-text templates for the automated
 * acceptance notification sent to restaurant owners upon super-admin approval.
 */

export interface RestaurantApprovalEmailData {
  ownerName: string;
  restaurantName: string;
  applicationId: string;
  loginUrl: string;
  supportEmail: string;
  reviewNotes?: string;
}

/**
 * Safely escape dynamic HTML content to prevent XSS or broken layouts.
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate responsive, branded HTML email for restaurant approval.
 */
export function getRestaurantApprovalHtml(data: RestaurantApprovalEmailData): string {
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
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #FCFAF7;
      color: #17233D;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      width: 100%;
      background-color: #FCFAF7;
      padding: 32px 16px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #E8E2D9;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(23, 35, 61, 0.06);
    }
    .header {
      background-color: #1E3A2B;
      color: #ffffff;
      padding: 32px 32px 28px 32px;
      text-align: left;
      border-bottom: 3px solid #C97A52;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 13px;
      color: #D1E5DA;
      font-weight: 500;
    }
    .content {
      padding: 32px;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      background-color: #ECFDF5;
      color: #047857;
      border: 1px solid #A7F3D0;
      margin-bottom: 20px;
      letter-spacing: 0.02em;
    }
    .title {
      margin: 0 0 16px 0;
      font-size: 22px;
      font-weight: 800;
      color: #17233D;
      line-height: 1.3;
    }
    .lead {
      font-size: 15px;
      color: #334155;
      line-height: 1.6;
      margin: 0 0 24px 0;
    }
    .meta-box {
      background-color: #F8F5EE;
      border-radius: 12px;
      border: 1px solid #E8E2D9;
      padding: 16px 20px;
      margin-bottom: 28px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
      border-bottom: 1px solid #EFEAE0;
    }
    .meta-row:last-child {
      border-bottom: none;
    }
    .meta-label {
      color: #64748B;
      font-weight: 600;
    }
    .meta-value {
      color: #17233D;
      font-weight: 700;
      font-family: monospace;
    }
    .steps-card {
      background-color: #FAFAFA;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
      padding: 24px;
      margin-bottom: 28px;
    }
    .steps-title {
      margin: 0 0 16px 0;
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1E3A2B;
    }
    .step-item {
      display: flex;
      margin-bottom: 16px;
    }
    .step-item:last-child {
      margin-bottom: 0;
    }
    .step-num {
      width: 26px;
      height: 26px;
      background-color: #1E3A2B;
      color: #ffffff;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
      flex-shrink: 0;
      margin-right: 12px;
      margin-top: 2px;
      text-align: center;
      line-height: 26px;
    }
    .step-text {
      font-size: 14px;
      color: #334155;
      line-height: 1.5;
    }
    .step-text strong {
      color: #0F172A;
    }
    .admin-note {
      background-color: #FFFBEB;
      border-left: 4px solid #D97706;
      border-radius: 6px;
      padding: 14px 18px;
      font-size: 13px;
      color: #78350F;
      margin-bottom: 28px;
      line-height: 1.5;
    }
    .btn-container {
      text-align: center;
      margin: 32px 0 24px 0;
    }
    .btn {
      display: inline-block;
      background-color: #C97A52;
      color: #ffffff !important;
      padding: 16px 36px;
      font-size: 15px;
      font-weight: 700;
      border-radius: 12px;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(201, 122, 82, 0.35);
      transition: background-color 0.2s ease;
    }
    .support-box {
      border-top: 1px solid #E8E2D9;
      padding-top: 24px;
      font-size: 13px;
      color: #64748B;
      line-height: 1.6;
    }
    .support-box a {
      color: #1E3A2B;
      font-weight: 700;
      text-decoration: underline;
    }
    .footer {
      padding: 24px 32px;
      background-color: #F8F5EE;
      border-top: 1px solid #E8E2D9;
      font-size: 12px;
      color: #64748B;
      text-align: center;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">
      <!-- Header -->
      <div class="header">
        <h1>SpiralDine</h1>
        <p>Next-Generation Restaurant Operating System</p>
      </div>

      <!-- Main Content -->
      <div class="content">
        <span class="badge">&#10003; Approved &bull; Active Merchant</span>

        <h2 class="title">Welcome to SpiralDine, ${safeOwner}!</h2>

        <p class="lead">
          We are pleased to inform you that your restaurant registration application for <strong>${safeRest}</strong> has been reviewed and <strong>approved</strong> by the SpiralDine administrative team.
        </p>

        <!-- Meta Summary -->
        <div class="meta-box">
          <div class="meta-row">
            <span class="meta-label">Restaurant:</span>
            <span class="meta-value">${safeRest}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Application ID:</span>
            <span class="meta-value">${safeAppId}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Account Status:</span>
            <span class="meta-value" style="color: #047857;">Active &bull; Ready for Setup</span>
          </div>
        </div>

        ${safeNotes ? `
        <div class="admin-note">
          <strong>Reviewer Note:</strong><br>${safeNotes}
        </div>
        ` : ''}

        <!-- Next Steps -->
        <div class="steps-card">
          <div class="steps-title">Recommended Next Steps for Restaurant Setup</div>
          
          <div class="step-item">
            <div class="step-num">1</div>
            <div class="step-text">
              <strong>Sign In to Your Owner Portal:</strong> Access your centralized merchant dashboard using your registered credentials.
            </div>
          </div>

          <div class="step-item">
            <div class="step-num">2</div>
            <div class="step-text">
              <strong>Build Your Digital Menu:</strong> Create item categories, add signature dishes, configure modifiers, and set dietary flags.
            </div>
          </div>

          <div class="step-item">
            <div class="step-num">3</div>
            <div class="step-text">
              <strong>Configure Tables &amp; QR Codes:</strong> Map out your dining room and generate contactless ordering QR codes for your tables.
            </div>
          </div>

          <div class="step-item">
            <div class="step-num">4</div>
            <div class="step-text">
              <strong>Invite Staff Members:</strong> Send digital access invites to floor managers, waiters, cashiers, and kitchen team members.
            </div>
          </div>

          <div class="step-item">
            <div class="step-num">5</div>
            <div class="step-text">
              <strong>Go Live:</strong> Start receiving live customer orders, manage kitchen queue tickets, and process frictionless billing.
            </div>
          </div>
        </div>

        <!-- Primary CTA -->
        <div class="btn-container">
          <a href="${loginUrl}" class="btn" target="_blank">Launch Owner Dashboard &rarr;</a>
        </div>

        <!-- Support Info -->
        <div class="support-box">
          <strong>Need assistance onboarding or connecting your hardware?</strong><br>
          Our merchant operations team is ready to help you every step of the way. Reach out anytime at 
          <a href="mailto:${safeSupport}">${safeSupport}</a>.
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div>&copy; ${new Date().getFullYear()} SpiralDine Platform. All rights reserved.</div>
        <div style="margin-top: 4px; font-size: 11px; color: #94A3B8;">
          This message was sent to confirm your merchant application approval on SpiralDine.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate plain-text alternative email for restaurant approval.
 */
export function getRestaurantApprovalText(data: RestaurantApprovalEmailData): string {
  const owner = data.ownerName || 'Restaurant Owner';
  const rest = data.restaurantName || 'Your Restaurant';
  const appId = data.applicationId || 'N/A';
  const support = data.supportEmail || 'kumbhageethakrishna143@gmail.com';
  const loginUrl = data.loginUrl || 'https://spiral-dine.vercel.app/owner/login';

  return `SPIRALDINE — RESTAURANT OPERATING SYSTEM

Your Restaurant Has Been Approved on SpiralDine!

Hello ${owner},

We are pleased to inform you that your restaurant registration application for ${rest} (Application ID: ${appId}) has been reviewed and approved by the SpiralDine administrative team.

Your restaurant workspace is now live, and your merchant account has full access to the SpiralDine platform.

NEXT STEPS TO LAUNCH YOUR RESTAURANT:
1. Sign In to Your Owner Portal:
   Visit: ${loginUrl}
2. Build Your Digital Menu:
   Add categories, dishes, custom modifiers, dietary tags, and prices.
3. Configure Tables & QR Codes:
   Map out your dining room and generate contactless ordering QR codes.
4. Invite Your Staff:
   Send digital invites to kitchen chefs, waiters, and managers with role-based access.
5. Go Live:
   Start receiving live dine-in, takeaway, and digital payments.

${data.reviewNotes ? `ADMINISTRATOR NOTE:\n${data.reviewNotes.trim()}\n\n` : ''}NEED ASSISTANCE?
Our merchant operations team is here to help you get started:
Support Contact: ${support}

Welcome to SpiralDine!
The SpiralDine Team
https://spiral-dine.vercel.app
`;
}
