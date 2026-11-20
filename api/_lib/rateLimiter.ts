import type { VercelRequest, VercelResponse } from '@vercel/node';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  keyPrefix: string;
  identifier?: string;
  maxRequests: number;
  windowMs: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();
const MAX_STORE_ENTRIES = 2000;

function pruneExpiredBuckets(now: number): void {
  if (rateLimitStore.size < MAX_STORE_ENTRIES) {
    return;
  }
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
  // If still oversized after pruning expired entries, clear oldest slots
  if (rateLimitStore.size >= MAX_STORE_ENTRIES) {
    rateLimitStore.clear();
  }
}

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0 && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Sliding-window in-memory rate limiter for Vercel serverless handlers.
 * Returns true if request is within budget, or writes HTTP 429 and returns false.
 */
export function enforceRateLimit(
  req: VercelRequest,
  res: VercelResponse,
  options: RateLimitOptions
): boolean {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const actorKey = (options.identifier || getClientIp(req) || 'unknown').trim().toLowerCase();
  const compositeKey = `${options.keyPrefix}:${actorKey}`;
  const existing = rateLimitStore.get(compositeKey);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(compositeKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return true;
  }

  if (existing.count >= options.maxRequests) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      error: 'Too Many Requests. Please wait briefly before retrying.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: retryAfterSec,
    });
    return false;
  }

  existing.count += 1;
  return true;
}

export function _resetRateLimitStore(): void {
  rateLimitStore.clear();
}
