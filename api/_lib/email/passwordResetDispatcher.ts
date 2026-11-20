import nodemailer, { type Transporter } from 'nodemailer';
import {
  resolveSmtpContactConfig,
  classifySmtpError,
  type SmtpContactConfig,
} from './smtpConfig.js';
import { sendMailWithLogging } from '../resendHelper.js';
import {
  getPasswordResetHtml,
  getPasswordResetText,
} from './passwordResetTemplate.js';

export interface PasswordResetDispatchOptions {
  email: string;
  resetLink: string;
  brandName?: string;
  supportEmail?: string;
  expirationMinutes?: number;
}

export interface PasswordResetDispatchResult {
  success: boolean;
  provider: 'smtp' | 'resend' | 'mock';
  messageId?: string;
  error?: string;
  diagnosticCode?: string;
}

export interface PasswordResetDispatchDeps {
  env?: Record<string, string | undefined>;
  sendSmtpMail?: (
    transporter: Transporter,
    mailOptions: Record<string, unknown>
  ) => Promise<{ messageId?: string; accepted?: unknown[]; rejected?: unknown[] }>;
  sendResendMail?: typeof sendMailWithLogging;
  log?: (message: string, ...args: unknown[]) => void;
}

/**
 * Extracts Firebase Auth's oobCode from the raw action link and builds the authoritative
 * custom-domain password reset URL at https://dine.spiralworld.in/reset-password?oobCode=...
 */
export function buildCustomDomainResetLink(
  rawActionLink: string,
  appPublicUrl?: string
): string {
  const safeBase =
    appPublicUrl && appPublicUrl.trim() && appPublicUrl !== 'undefined' && appPublicUrl !== 'null'
      ? appPublicUrl.trim()
      : 'https://dine.spiralworld.in';
  const cleanBase = safeBase.replace(/\/+$/, '');
  try {
    const parsed = new URL(rawActionLink);
    const oobCode = parsed.searchParams.get('oobCode') || parsed.searchParams.get('code');
    if (oobCode && oobCode.trim()) {
      return `${cleanBase}/reset-password?oobCode=${encodeURIComponent(oobCode.trim())}`;
    }
  } catch {
    // If rawActionLink isn't a parseable URL, fall through to default fallback
  }

  // If already pointing to /reset-password on publicUrl, return cleanBase URL
  if (rawActionLink.startsWith(cleanBase)) {
    return rawActionLink;
  }

  // Fallback if no oobCode query param present
  return rawActionLink;
}

function createNodemailerTransport(config: SmtpContactConfig): Transporter {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    requireTLS: !config.smtpSecure,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    connectionTimeout: 5000,
    greetingTimeout: 4500,
    socketTimeout: 6000,
    tls: {
      minVersion: 'TLSv1.2',
    },
  });
}

/**
 * Dispatches a password reset email using the customer's custom domain sender (e.g. support@spiralworld.in).
 * Priority:
 * 1. GoDaddy Professional Email / Custom SMTP via Nodemailer
 * 2. Resend API on custom verified domain (fallback)
 * 3. Mock logging in local/test environments
 */
export async function dispatchCustomDomainPasswordReset(
  options: PasswordResetDispatchOptions,
  deps: PasswordResetDispatchDeps = {}
): Promise<PasswordResetDispatchResult> {
  const env = deps.env ?? process.env;
  const logger = deps.log ?? console.log;

  const brandName = options.brandName || env.CONTACT_FROM_NAME || 'SpiralDine';
  const supportEmail = options.supportEmail || env.CONTACT_TO_EMAIL || env.SUPPORT_NOTIFICATION_EMAIL || 'support@spiralworld.in';
  const expirationMinutes = options.expirationMinutes || 60;
  const cleanRecipient = options.email.trim().toLowerCase();

  const html = getPasswordResetHtml({
    email: cleanRecipient,
    resetLink: options.resetLink,
    brandName,
    supportEmail,
    expirationMinutes,
  });

  const text = getPasswordResetText({
    email: cleanRecipient,
    resetLink: options.resetLink,
    brandName,
    supportEmail,
    expirationMinutes,
  });

  const subject = `Reset Your ${brandName} Password`;

  // -------------------------------------------------------------
  // 1. Primary Delivery Method: GoDaddy / Custom SMTP Transporter
  // -------------------------------------------------------------
  const smtpResolution = resolveSmtpContactConfig(env);
  if (smtpResolution.ok) {
    const config = smtpResolution.config;
    const fromAddress = config.fromName
      ? `"${config.fromName}" <${config.fromEmail}>`
      : config.fromEmail;

    let transporter: Transporter | null = null;
    try {
      transporter = createNodemailerTransport(config);
      const sendFn = deps.sendSmtpMail
        ? (opts: Record<string, unknown>) => deps.sendSmtpMail!(transporter!, opts)
        : (opts: Record<string, unknown>) => transporter!.sendMail(opts);

      const info = await sendFn({
        from: fromAddress,
        to: cleanRecipient,
        replyTo: `"${brandName} Support" <${supportEmail}>`,
        subject,
        html,
        text,
      });

      return {
        success: true,
        provider: 'smtp',
        messageId: info.messageId,
      };
    } catch (smtpErr: unknown) {
      const classified = classifySmtpError(smtpErr);
      console.warn('[passwordResetDispatcher] SMTP delivery attempt failed, trying fallback:', {
        errorCode: classified.errorCode,
        diagnosticCode: classified.diagnosticCode,
        category: classified.category,
      });
    } finally {
      try {
        transporter?.close?.();
      } catch {
        // ignore close error
      }
    }
  }

  // -------------------------------------------------------------
  // 2. Secondary Delivery Method: Resend (Custom Domain Fallback)
  // -------------------------------------------------------------
  const resendApiKey = env.RESEND_API_KEY?.trim();
  if (resendApiKey) {
    const resendFrom = env.CONTACT_FROM_EMAIL
      ? `"${brandName}" <${env.CONTACT_FROM_EMAIL.trim()}>`
      : env.RESEND_FROM_EMAIL || `"${brandName}" <support@spiralworld.in>`;

    const resendFn = deps.sendResendMail ?? sendMailWithLogging;
    try {
      const resendRes = await resendFn(
        {
          to: cleanRecipient,
          subject,
          html,
          text,
          from: resendFrom,
          type: 'password_reset',
          retries: 1,
        },
        {}
      );

      if (resendRes.success) {
        return {
          success: true,
          provider: 'resend',
          messageId: resendRes.id,
        };
      }

      console.warn('[passwordResetDispatcher] Resend fallback failed:', resendRes.error);
    } catch (resendErr: unknown) {
      console.warn('[passwordResetDispatcher] Resend execution error:', resendErr);
    }
  }

  // -------------------------------------------------------------
  // 3. Development / Test Mode Mock Delivery
  // -------------------------------------------------------------
  const isDevOrTest =
    env.NODE_ENV !== 'production' ||
    env.VITE_APP_ENV === 'development' ||
    env.FIREBASE_AUTH_EMULATOR_HOST;

  if (isDevOrTest) {
    logger(
      `[passwordResetDispatcher DEV-MOCK] Generated password reset link for ${cleanRecipient}:\n${options.resetLink}`
    );
    return {
      success: true,
      provider: 'mock',
      messageId: `dev-mock-${Date.now()}`,
    };
  }

  return {
    success: false,
    provider: 'smtp',
    error: 'All mail delivery transports (SMTP & Resend) failed or are unconfigured.',
    diagnosticCode: 'MAIL_DELIVERY_FAILED',
  };
}
