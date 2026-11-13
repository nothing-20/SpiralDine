import type { VercelRequest, VercelResponse } from '@vercel/node';
import { OFFICIAL_SUPPORT_EMAIL } from '../src/shared/constants/contact.js';
import { extractClientIp } from './_lib/email/contactGuard.js';
import { processContactSubmission } from './_lib/email/contactService.js';

function parseRequestBody(req: VercelRequest): unknown {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      error: 'Method Not Allowed',
      fallbackEmail: OFFICIAL_SUPPORT_EMAIL,
    });
  }

  try {
    const clientIp = extractClientIp(
      req.headers as Record<string, string | string[] | undefined>,
      req.socket?.remoteAddress
    );
    const body = parseRequestBody(req);
    const result = await processContactSubmission(body, clientIp);

    if (result.retryAfterSeconds) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
    }

    return res.status(result.httpStatus).json(result.body);
  } catch (err: unknown) {
    const errName = err instanceof Error ? err.name : 'UnexpectedError';
    console.error('[Vercel API /contact] Unhandled handler error:', { name: errName });
    return res.status(500).json({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      error: `Unable to process your enquiry right now. Please try again shortly or email ${OFFICIAL_SUPPORT_EMAIL}.`,
      fallbackEmail: OFFICIAL_SUPPORT_EMAIL,
    });
  }
}
