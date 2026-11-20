export interface PasswordResetEmailData {
  email: string;
  resetLink: string;
  supportEmail?: string;
  brandName?: string;
  expirationMinutes?: number;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function getPasswordResetHtml(data: PasswordResetEmailData): string {
  const cleanEmail = escapeHtml(data.email);
  const resetLink = data.resetLink;
  const supportEmail = escapeHtml(data.supportEmail || 'support@spiralworld.in');
  const brandName = escapeHtml(data.brandName || 'SpiralDine');
  const expirationMinutes = data.expirationMinutes || 60;
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your ${brandName} Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #FCFAF7; color: #17233D; margin: 0; padding: 24px; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E8E2D9; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
    <!-- Brand Header -->
    <div style="background: #1E3A2B; padding: 32px 36px; text-align: left;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">${brandName}</h1>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #D1E5DA; font-weight: 500;">Restaurant Operating System</p>
    </div>

    <!-- Body Content -->
    <div style="padding: 36px 36px 32px 36px;">
      <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #17233D;">Reset Your Password</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #4B5563; margin: 0 0 16px 0;">
        We received a request to reset the password for your ${brandName} account associated with <strong style="color: #17233D;">${cleanEmail}</strong>.
      </p>
      <p style="font-size: 15px; line-height: 1.6; color: #4B5563; margin: 0 0 28px 0;">
        Click the button below to choose a new password and restore access to your account:
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}" style="background-color: #D65336; color: #ffffff !important; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 34px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 8px rgba(214, 83, 54, 0.28);" target="_blank" rel="noopener noreferrer">
          Reset Password
        </a>
      </div>

      <!-- Plain Text Link Fallback -->
      <p style="font-size: 13px; line-height: 1.6; color: #6B7280; margin: 28px 0 8px 0;">
        If the button above does not work, copy and paste this link directly into your browser:
      </p>
      <p style="font-size: 12px; line-height: 1.5; color: #1E3A2B; word-break: break-all; background: #F4F1EB; padding: 12px 14px; border-radius: 8px; margin: 0 0 24px 0; font-family: ui-monospace, Menlo, Monaco, 'Cascadia Mono', 'Courier New', monospace; border: 1px solid #E8E2D9;">
        ${resetLink}
      </p>

      <!-- Security Notice -->
      <div style="border-top: 1px solid #E8E2D9; padding-top: 20px; margin-top: 28px;">
        <p style="font-size: 13px; color: #B45309; line-height: 1.5; margin: 0 0 6px 0; font-weight: 700;">
          &#9888; Security Advisory
        </p>
        <p style="font-size: 12px; color: #6B7280; line-height: 1.5; margin: 0 0 6px 0;">
          This link is time-sensitive and will expire in ${expirationMinutes} minutes.
        </p>
        <p style="font-size: 12px; color: #6B7280; line-height: 1.5; margin: 0;">
          If you did not request this password reset, please ignore this email. Your current password will remain unchanged and your account is secure.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 36px; background: #FAF7F2; border-top: 1px solid #E8E2D9; font-size: 12px; color: #9CA3AF; text-align: center;">
      <p style="margin: 0 0 4px 0;">
        Sent securely by <strong>${brandName}</strong> &bull; <a href="https://dine.spiralworld.in" style="color: #6B7280; text-decoration: none;">dine.spiralworld.in</a>
      </p>
      <p style="margin: 0 0 4px 0;">
        Need help? Contact <a href="mailto:${supportEmail}" style="color: #D65336; text-decoration: none;">${supportEmail}</a>
      </p>
      <p style="margin: 0; font-size: 11px; color: #A8A29E;">
        &copy; ${currentYear} ${brandName} Platform. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function getPasswordResetText(data: PasswordResetEmailData): string {
  const brandName = data.brandName || 'SpiralDine';
  const supportEmail = data.supportEmail || 'support@spiralworld.in';
  const expirationMinutes = data.expirationMinutes || 60;
  const currentYear = new Date().getFullYear();

  return `${brandName} — Password Reset Request

Hello,

We received a request to reset the password for your ${brandName} account associated with ${data.email}.

To choose a new password and restore account access, visit the link below:
${data.resetLink}

Security Notice:
- This password reset link is time-sensitive and will expire in ${expirationMinutes} minutes.
- If you did not request this password reset, you can safely ignore this email. Your password will remain unchanged.

Need assistance? Contact us directly at ${supportEmail}
Platform: https://dine.spiralworld.in

(c) ${currentYear} ${brandName} Platform. All rights reserved.
`;
}
