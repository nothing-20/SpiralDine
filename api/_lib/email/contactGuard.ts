import crypto from 'crypto';
import type { ValidatedContactSubmission } from './contactValidation.js';

export interface ContactGuardOptions {
  ipWindowMs?: number;
  ipMaxRequests?: number;
  emailWindowMs?: number;
  emailMaxRequests?: number;
  duplicateWindowMs?: number;
  maxStoreKeys?: number;
  now?: () => number;
}

export type GuardCheckResult =
  | { allowed: true; fingerprint: string }
  | {
      allowed: false;
      httpStatus: 429 | 409;
      code: 'RATE_LIMITED' | 'DUPLICATE_SUBMISSION';
      retryAfterSeconds: number;
      error: string;
    };

export class ContactSubmissionGuard {
  private readonly ipWindowMs: number;
  private readonly ipMaxRequests: number;
  private readonly emailWindowMs: number;
  private readonly emailMaxRequests: number;
  private readonly duplicateWindowMs: number;
  private readonly maxStoreKeys: number;
  private readonly now: () => number;

  private readonly ipHits = new Map<string, number[]>();
  private readonly emailHits = new Map<string, number[]>();
  private readonly recentFingerprints = new Map<string, number>();
  private readonly inFlightFingerprints = new Set<string>();

  constructor(options: ContactGuardOptions = {}) {
    this.ipWindowMs = options.ipWindowMs ?? 10 * 60 * 1000;
    this.ipMaxRequests = options.ipMaxRequests ?? 5;
    this.emailWindowMs = options.emailWindowMs ?? 15 * 60 * 1000;
    this.emailMaxRequests = options.emailMaxRequests ?? 3;
    this.duplicateWindowMs = options.duplicateWindowMs ?? 120 * 1000;
    this.maxStoreKeys = options.maxStoreKeys ?? 2000;
    this.now = options.now ?? (() => Date.now());
  }

  private pruneWindow(
    store: Map<string, number[]>,
    key: string,
    windowMs: number,
    nowTs: number
  ): number[] {
    const cutoff = nowTs - windowMs;
    const active = (store.get(key) || []).filter((ts) => ts > cutoff);
    if (active.length === 0) {
      store.delete(key);
    } else {
      store.set(key, active);
    }
    return active;
  }

  private evictIfNeeded(nowTs: number): void {
    if (this.ipHits.size > this.maxStoreKeys) {
      for (const [key] of this.ipHits) {
        this.pruneWindow(this.ipHits, key, this.ipWindowMs, nowTs);
        if (this.ipHits.size <= this.maxStoreKeys) break;
      }
      if (this.ipHits.size > this.maxStoreKeys) {
        const oldestKey = this.ipHits.keys().next().value;
        if (oldestKey) this.ipHits.delete(oldestKey);
      }
    }

    if (this.emailHits.size > this.maxStoreKeys) {
      for (const [key] of this.emailHits) {
        this.pruneWindow(this.emailHits, key, this.emailWindowMs, nowTs);
        if (this.emailHits.size <= this.maxStoreKeys) break;
      }
      if (this.emailHits.size > this.maxStoreKeys) {
        const oldestKey = this.emailHits.keys().next().value;
        if (oldestKey) this.emailHits.delete(oldestKey);
      }
    }

    if (this.recentFingerprints.size > this.maxStoreKeys) {
      for (const [fp, expiresAt] of this.recentFingerprints) {
        if (expiresAt <= nowTs) {
          this.recentFingerprints.delete(fp);
        }
        if (this.recentFingerprints.size <= this.maxStoreKeys) break;
      }
    }
  }

  computeFingerprint(data: ValidatedContactSubmission): string {
    const canonical = [
      data.email.trim().toLowerCase(),
      data.category.trim().toLowerCase(),
      data.subject.trim().toLowerCase().replace(/\s+/g, ' '),
      data.message.trim().toLowerCase().replace(/\s+/g, ' '),
    ].join('|');

    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Pre-validation IP rate check to stop abusive flooding early.
   */
  checkAndRecordIp(clientIp: string): GuardCheckResult | { allowed: true } {
    const nowTs = this.now();
    this.evictIfNeeded(nowTs);

    const safeIp = (clientIp || 'unknown').slice(0, 64);
    const active = this.pruneWindow(this.ipHits, safeIp, this.ipWindowMs, nowTs);

    if (active.length >= this.ipMaxRequests) {
      const oldestActive = active[0] || nowTs;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldestActive + this.ipWindowMs - nowTs) / 1000)
      );
      return {
        allowed: false,
        httpStatus: 429,
        code: 'RATE_LIMITED',
        retryAfterSeconds,
        error: 'Too many enquiries submitted recently from this network. Please wait a few minutes before trying again.',
      };
    }

    active.push(nowTs);
    this.ipHits.set(safeIp, active);
    return { allowed: true };
  }

  /**
   * Per-email quota and duplicate submission lock acquired before SMTP call.
   */
  acquireSubmissionLock(data: ValidatedContactSubmission): GuardCheckResult {
    const nowTs = this.now();
    this.evictIfNeeded(nowTs);

    const emailKey = data.email.trim().toLowerCase();
    const activeEmailHits = this.pruneWindow(
      this.emailHits,
      emailKey,
      this.emailWindowMs,
      nowTs
    );

    if (activeEmailHits.length >= this.emailMaxRequests) {
      const oldestActive = activeEmailHits[0] || nowTs;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldestActive + this.emailWindowMs - nowTs) / 1000)
      );
      return {
        allowed: false,
        httpStatus: 429,
        code: 'RATE_LIMITED',
        retryAfterSeconds,
        error: 'Multiple enquiries were recently submitted from this email address. Please wait a few minutes before sending another.',
      };
    }

    const fingerprint = this.computeFingerprint(data);
    const cooldownUntil = this.recentFingerprints.get(fingerprint);

    if (this.inFlightFingerprints.has(fingerprint)) {
      return {
        allowed: false,
        httpStatus: 409,
        code: 'DUPLICATE_SUBMISSION',
        retryAfterSeconds: 30,
        error: 'Your enquiry is already being sent. Please wait a moment without clicking again.',
      };
    }

    if (cooldownUntil && cooldownUntil > nowTs) {
      const retryAfterSeconds = Math.max(1, Math.ceil((cooldownUntil - nowTs) / 1000));
      return {
        allowed: false,
        httpStatus: 409,
        code: 'DUPLICATE_SUBMISSION',
        retryAfterSeconds,
        error: 'This exact enquiry was already submitted just now. If you need to add more details, please modify your message or wait a couple of minutes.',
      };
    }

    this.inFlightFingerprints.add(fingerprint);
    return { allowed: true, fingerprint };
  }

  markSubmissionSucceeded(email: string, fingerprint: string): void {
    const nowTs = this.now();
    this.inFlightFingerprints.delete(fingerprint);
    this.recentFingerprints.set(fingerprint, nowTs + this.duplicateWindowMs);

    const emailKey = email.trim().toLowerCase();
    const active = this.pruneWindow(this.emailHits, emailKey, this.emailWindowMs, nowTs);
    active.push(nowTs);
    this.emailHits.set(emailKey, active);
  }

  releaseSubmissionLock(fingerprint: string): void {
    this.inFlightFingerprints.delete(fingerprint);
  }
}

export const defaultContactGuard = new ContactSubmissionGuard();

export function extractClientIp(headers: Record<string, string | string[] | undefined>, remoteAddress?: string): string {
  const vercelFwd = headers['x-vercel-forwarded-for'];
  const xff = headers['x-forwarded-for'];
  const realIp = headers['x-real-ip'];

  const rawHeader = Array.isArray(vercelFwd)
    ? vercelFwd[0]
    : vercelFwd ||
      (Array.isArray(xff) ? xff[0] : xff) ||
      (Array.isArray(realIp) ? realIp[0] : realIp) ||
      remoteAddress ||
      'unknown';

  const firstHop = String(rawHeader).split(',')[0]?.trim() || 'unknown';
  return firstHop.slice(0, 64);
}

