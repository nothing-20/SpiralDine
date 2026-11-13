import nodemailer, { type Transporter } from 'nodemailer';
import { OFFICIAL_SUPPORT_EMAIL } from '../../../src/shared/constants/contact.js';
import {
  ContactSubmissionGuard,
  defaultContactGuard,
} from './contactGuard.js';
import {
  buildCustomerAcknowledgementEmail,
  buildSupportEnquiryEmail,
  generateEnquiryReference,
} from './contactTemplates.js';
import { validateContactSubmission } from './contactValidation.js';
import {
  classifySmtpError,
  resolveSmtpContactConfig,
  type SmtpContactConfig,
} from './smtpConfig.js';

export interface MailSendInfo {
  messageId?: string;
  accepted?: Array<string | { address: string }>;
  rejected?: Array<string | { address: string }>;
}

export interface SmtpTransportLike {
  sendMail(mailOptions: Record<string, unknown>): Promise<MailSendInfo>;
  close?: () => void;
}

export interface ContactServiceDeps {
  env?: Record<string, string | undefined>;
  guard?: ContactSubmissionGuard;
  createTransport?: (config: SmtpContactConfig) => SmtpTransportLike;
  now?: () => Date;
}

export interface ContactServiceResponse {
  httpStatus: number;
  retryAfterSeconds?: number;
  body: {
    success: boolean;
    code?: string;
    message?: string;
    error?: string;
    fieldErrors?: Record<string, string>;
    referenceId?: string;
    acknowledgementSent?: boolean;
    fallbackEmail: string;
  };
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
    connectionTimeout: 4500,
    greetingTimeout: 4000,
    socketTimeout: 5500,
    tls: {
      minVersion: 'TLSv1.2',
    },
  });
}

function extractAddressStrings(list?: Array<string | { address: string }>): string[] {
  if (!Array.isArray(list)) return [];
  return list.map((item) =>
    (typeof item === 'string' ? item : item?.address || '').trim().toLowerCase()
  );
}

function assertRecipientAccepted(info: MailSendInfo | undefined, expectedRecipient: string): void {
  const accepted = extractAddressStrings(info?.accepted);
  const rejected = extractAddressStrings(info?.rejected);
  const target = expectedRecipient.trim().toLowerCase();

  if (rejected.includes(target) || accepted.length === 0 || !accepted.includes(target)) {
    const err = new Error('SMTP server did not accept the recipient address.');
    (err as unknown as Record<string, unknown>).code = 'EENVELOPE';
    (err as unknown as Record<string, unknown>).responseCode = 550;
    throw err;
  }
}

/**
 * Process a public contact submission end-to-end:
 * 1. Check IP rate limit
 * 2. Validate & sanitize payload (and check spam heuristics)
 * 3. Check SMTP server configuration completeness
 * 4. Acquire duplicate-submission lock & per-email rate limit
 * 5. Dispatch enquiry to support@spiralworld.in over authenticated SMTP (with customer Reply-To)
 * 6. If CONTACT_SEND_ACK is enabled, send branded customer acknowledgement email
 */
export async function processContactSubmission(
  rawBody: unknown,
  clientIp: string,
  deps: ContactServiceDeps = {}
): Promise<ContactServiceResponse> {
  const env = deps.env ?? process.env;
  const guard = deps.guard ?? defaultContactGuard;
  const createTransport = deps.createTransport ?? createNodemailerTransport;
  const nowDate = deps.now ? deps.now() : new Date();

  // 1. Pre-validation IP rate limit
  const ipCheck = guard.checkAndRecordIp(clientIp);
  if (!ipCheck.allowed) {
    return {
      httpStatus: ipCheck.httpStatus,
      retryAfterSeconds: ipCheck.retryAfterSeconds,
      body: {
        success: false,
        code: ipCheck.code,
        error: ipCheck.error,
        fallbackEmail: OFFICIAL_SUPPORT_EMAIL,
      },
    };
  }

  // 2. Server-side validation & spam protection
  const validation = validateContactSubmission(rawBody);
  if (!validation.ok) {
    return {
      httpStatus: 400,
      body: {
        success: false,
        code: validation.code,
        error: validation.error,
        fieldErrors: validation.fieldErrors,
        fallbackEmail: OFFICIAL_SUPPORT_EMAIL,
      },
    };
  }
  const submission = validation.data;

  // 3. Resolve SMTP configuration from env without inventing secrets
  const configResolution = resolveSmtpContactConfig(env);
  if (!configResolution.ok) {
    console.warn('[api/contact] SMTP configuration incomplete:', {
      missingKeys: configResolution.missingKeys,
      invalidKeys: configResolution.invalidKeys,
    });
    return {
      httpStatus: 503,
      body: {
        success: false,
        code: 'SMTP_NOT_CONFIGURED',
        error: `Our online enquiry service is temporarily unavailable. Please email us directly at ${OFFICIAL_SUPPORT_EMAIL}.`,
        fallbackEmail: OFFICIAL_SUPPORT_EMAIL,
      },
    };
  }
  const config = configResolution.config;
  const supportEmail = config.toEmail || OFFICIAL_SUPPORT_EMAIL;

  // 4. Per-email quota and duplicate submission protection
  const lock = guard.acquireSubmissionLock(submission);
  if (!lock.allowed) {
    return {
      httpStatus: lock.httpStatus,
      retryAfterSeconds: lock.retryAfterSeconds,
      body: {
        success: false,
        code: lock.code,
        error: lock.error,
        fallbackEmail: supportEmail,
      },
    };
  }

  const referenceId = generateEnquiryReference(nowDate);
  const submittedAtIso = nowDate.toISOString();
  const supportMail = buildSupportEnquiryEmail(submission, {
    referenceId,
    submittedAtIso,
    supportEmail,
  });

  const transporter = createTransport(config);

  try {
    // 5. Deliver primary enquiry notification to support@spiralworld.in
    try {
      const info = await transporter.sendMail({
        from: { name: config.fromName, address: config.fromEmail },
        to: supportEmail,
        replyTo: { name: submission.name, address: submission.email },
        subject: supportMail.subject,
        html: supportMail.html,
        text: supportMail.text,
      });

      assertRecipientAccepted(info, supportEmail);
    } catch (smtpErr: unknown) {
      guard.releaseSubmissionLock(lock.fingerprint);
      const classified = classifySmtpError(smtpErr);

      console.error('[api/contact] Support notification SMTP failure:', {
        category: classified.category,
        diagnosticCode: classified.diagnosticCode,
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
      });

      return {
        httpStatus: classified.httpStatus,
        body: {
          success: false,
          code: classified.errorCode,
          error: classified.userMessage,
          fallbackEmail: supportEmail,
        },
      };
    }

    // Only commit cooldown/email quota after primary delivery succeeded
    guard.markSubmissionSucceeded(submission.email, lock.fingerprint);

    // 6. Optional customer acknowledgement email when CONTACT_SEND_ACK=true
    let acknowledgementSent = false;
    if (config.sendAck) {
      const ackMail = buildCustomerAcknowledgementEmail(submission, {
        referenceId,
        submittedAtIso,
        supportEmail,
      });

      try {
        const ackInfo = await transporter.sendMail({
          from: { name: config.fromName, address: config.fromEmail },
          to: submission.email,
          replyTo: { name: config.fromName, address: supportEmail },
          subject: ackMail.subject,
          html: ackMail.html,
          text: ackMail.text,
        });
        assertRecipientAccepted(ackInfo, submission.email);
        acknowledgementSent = true;
      } catch (ackErr: unknown) {
        const classifiedAck = classifySmtpError(ackErr);
        console.warn('[api/contact] Customer acknowledgement email failed:', {
          referenceId,
          category: classifiedAck.category,
          diagnosticCode: classifiedAck.diagnosticCode,
        });
      }
    }

    return {
      httpStatus: 200,
      body: {
        success: true,
        referenceId,
        acknowledgementSent,
        message: acknowledgementSent
          ? `Your enquiry (${referenceId}) has been sent to our support team, and a confirmation email has been sent to ${submission.email}.`
          : `Your enquiry (${referenceId}) has been sent to our support team. We will get back to you shortly.`,
        fallbackEmail: supportEmail,
      },
    };
  } finally {
    try {
      transporter.close?.();
    } catch {
      // ignore socket cleanup errors
    }
  }
}

