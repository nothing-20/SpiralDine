import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  FirebaseAdminInitError,
  getAdminDb,
} from './firebaseAdmin.js';

export type AuthErrorCode =
  | 'MISSING_AUTH_HEADER'
  | 'INVALID_AUTH_HEADER'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_REVOKED'
  | 'ANONYMOUS_FORBIDDEN'
  | 'USER_NOT_FOUND'
  | 'USER_INACTIVE'
  | 'INSUFFICIENT_ROLE'
  | 'SUPER_ADMIN_REQUIRED'
  | 'TENANT_ACCESS_DENIED'
  | 'BRANCH_ACCESS_DENIED'
  | 'FORBIDDEN_BILL_ACCESS'
  | 'AUTH_CONFIG_ERROR';

export class AuthError extends Error {
  public readonly statusCode: number;
  public readonly code: AuthErrorCode;

  constructor(statusCode: number, code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface VerifiedAuthContext {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  signInProvider: string | null;
  role: string | null;
  tenantId: string | null;
  branchId: string | null;
  isSuperAdmin: boolean;
  userStatus: string | null;
  decodedToken: DecodedIdToken;
}

export interface VerifyAuthOptions {
  allowAnonymous?: boolean;
  checkRevoked?: boolean;
  loadUserProfile?: boolean;
}

export interface AuthDependencies {
  verifyIdToken: (token: string, checkRevoked?: boolean) => Promise<DecodedIdToken>;
  loadUserDoc: (uid: string) => Promise<Record<string, unknown> | null>;
}

const DEFAULT_INACTIVE_STATUSES = new Set([
  'inactive',
  'disabled',
  'suspended',
  'revoked',
  'deleted',
]);

let cachedGoogleCerts: Record<string, string> | null = null;
let googleCertsExpiresAt = 0;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && now < googleCertsExpiresAt) {
    return cachedGoogleCerts;
  }
  try {
    const res = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    if (!res.ok) {
      if (cachedGoogleCerts) return cachedGoogleCerts;
      throw new Error(`HTTP ${res.status}`);
    }
    const cacheControl = res.headers.get('cache-control') || '';
    const match = /max-age=(\d+)/i.exec(cacheControl);
    const maxAgeSeconds = match ? parseInt(match[1], 10) : 3600;
    cachedGoogleCerts = (await res.json()) as Record<string, string>;
    googleCertsExpiresAt = now + maxAgeSeconds * 1000;
    return cachedGoogleCerts;
  } catch (err) {
    if (cachedGoogleCerts) return cachedGoogleCerts;
    throw new AuthError(503, 'AUTH_CONFIG_ERROR', 'Google certificate authority is unreachable.');
  }
}

export async function verifyFirebaseIdTokenDirect(
  token: string,
  _checkRevoked = false
): Promise<DecodedIdToken> {
  if (!token || typeof token !== 'string') {
    throw new AuthError(401, 'INVALID_TOKEN', 'Missing or empty authentication token.');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthError(401, 'INVALID_TOKEN', 'Malformed Firebase ID token format.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string; kid?: string; typ?: string };
  let payload: Record<string, unknown>;

  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    throw new AuthError(401, 'INVALID_TOKEN', 'Failed to parse Firebase ID token.');
  }

  // If in emulator mode, bypass Google public cert signature check
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    return {
      ...payload,
      uid: String(payload.user_id || payload.sub || ''),
    } as unknown as DecodedIdToken;
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new AuthError(401, 'INVALID_TOKEN', 'Unsupported token algorithm or missing key ID.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp);
  const iat = Number(payload.iat);
  const authTime = Number(payload.auth_time);

  if (!exp || exp <= nowSec) {
    throw new AuthError(401, 'TOKEN_EXPIRED', 'Firebase ID token has expired.');
  }
  if (!iat || iat > nowSec + 300) {
    throw new AuthError(401, 'INVALID_TOKEN', 'Token issued in the future.');
  }
  if (!authTime || authTime > nowSec + 300) {
    throw new AuthError(401, 'INVALID_TOKEN', 'Token authentication time is in the future.');
  }

  const expectedProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'spiral-restaurant-saas-v1';
  if (payload.aud !== expectedProjectId) {
    throw new AuthError(
      401,
      'INVALID_TOKEN',
      `Token audience (${payload.aud}) does not match expected project (${expectedProjectId}).`
    );
  }
  if (payload.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
    throw new AuthError(
      401,
      'INVALID_TOKEN',
      `Token issuer (${payload.iss}) does not match expected issuer.`
    );
  }
  if (!payload.sub || typeof payload.sub !== 'string' || !payload.sub.trim()) {
    throw new AuthError(401, 'INVALID_TOKEN', 'Token subject identifier is missing.');
  }

  // Cryptographic signature check against Google public certs
  try {
    const certs = await getGooglePublicCerts();
    const cert = certs[header.kid];
    if (!cert) {
      throw new AuthError(
        401,
        'INVALID_TOKEN',
        `Public key (${header.kid}) not found in Google certificate authority.`
      );
    }

    const pubKey = crypto.createPublicKey(cert);
    const isValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      pubKey,
      Buffer.from(signatureB64, 'base64url')
    );

    if (!isValid) {
      throw new AuthError(401, 'INVALID_TOKEN', 'Token signature verification failed.');
    }
  } catch (sigErr) {
    if (sigErr instanceof AuthError) throw sigErr;
    console.error('[authMiddleware] Signature verification error:', sigErr);
    throw new AuthError(401, 'INVALID_TOKEN', 'Cryptographic verification rejected token.');
  }

  return {
    ...payload,
    uid: String(payload.user_id || payload.sub || ''),
  } as unknown as DecodedIdToken;
}

function defaultLoadUserDoc(uid: string): Promise<Record<string, unknown> | null> {
  return getAdminDb()
    .collection('users')
    .doc(uid)
    .get()
    .then((snap) => (snap.exists ? (snap.data() as Record<string, unknown>) : null));
}

function getDefaultDeps(): AuthDependencies {
  return {
    verifyIdToken: (token: string, checkRevoked = true) =>
      verifyFirebaseIdTokenDirect(token, checkRevoked),
    loadUserDoc: defaultLoadUserDoc,
  };
}

export function normalizeRole(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed === 'super-admin' || trimmed === 'super_admin' || trimmed === 'superadmin') {
    return 'super_admin';
  }
  return trimmed;
}

function normalizeStringField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Extracts a Bearer token from the Authorization header.
 * Never decodes the payload or accepts tokens from query strings/cookies here.
 */
export function extractBearerToken(req: Pick<VercelRequest, 'headers'>): string {
  const rawHeader = req.headers?.authorization;
  const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (!headerValue || typeof headerValue !== 'string' || !headerValue.trim()) {
    throw new AuthError(401, 'MISSING_AUTH_HEADER', 'Missing Authorization header.');
  }

  const trimmed = headerValue.trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  if (!match || !match[1]?.trim()) {
    throw new AuthError(
      401,
      'INVALID_AUTH_HEADER',
      'Authorization header must use Bearer token format.'
    );
  }

  return match[1].trim();
}

function mapTokenVerificationError(err: unknown): never {
  if (err instanceof FirebaseAdminInitError) {
    throw new AuthError(
      err.statusCode,
      'AUTH_CONFIG_ERROR',
      'Authentication service is unavailable due to server configuration.'
    );
  }

  const firebaseErr = err as { code?: string; message?: string };
  const code = firebaseErr?.code || '';

  if (code === 'auth/id-token-revoked' || code === 'auth/user-disabled') {
    throw new AuthError(401, 'TOKEN_REVOKED', 'Session has been revoked or disabled.');
  }
  if (code === 'auth/id-token-expired') {
    throw new AuthError(401, 'TOKEN_EXPIRED', 'Authentication token has expired.');
  }

  throw new AuthError(401, 'INVALID_TOKEN', 'Invalid authentication token.');
}

/**
 * Cryptographically verifies the Firebase ID token from Authorization: Bearer <token>.
 * Never falls back to unsigned JWT base64 decoding.
 */
export async function verifyRequestAuth(
  req: Pick<VercelRequest, 'headers'>,
  options: VerifyAuthOptions = {},
  deps?: AuthDependencies
): Promise<VerifiedAuthContext> {
  const {
    allowAnonymous = false,
    checkRevoked = true,
    loadUserProfile = false,
  } = options;

  const token = extractBearerToken(req);
  const resolvedDeps = deps ?? getDefaultDeps();

  let decoded: DecodedIdToken;
  try {
    decoded = await resolvedDeps.verifyIdToken(token, checkRevoked);
  } catch (err: unknown) {
    if (err instanceof AuthError) throw err;
    mapTokenVerificationError(err);
  }

  if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid.trim()) {
    throw new AuthError(401, 'INVALID_TOKEN', 'Verified token is missing uid.');
  }

  const signInProvider = normalizeStringField(decoded.firebase?.sign_in_provider);
  const isAnonymous = signInProvider === 'anonymous';

  if (isAnonymous && !allowAnonymous) {
    throw new AuthError(
      403,
      'ANONYMOUS_FORBIDDEN',
      'Anonymous sessions are not permitted for this operation.'
    );
  }

  const claimRole = normalizeRole((decoded as Record<string, unknown>).role);
  const claimSuperAdmin =
    Boolean((decoded as Record<string, unknown>).super_admin) ||
    Boolean((decoded as Record<string, unknown>).superAdmin) ||
    claimRole === 'super_admin';
  const claimTenantId =
    normalizeStringField((decoded as Record<string, unknown>).tenantId) ||
    normalizeStringField((decoded as Record<string, unknown>).restaurantId);
  const claimBranchId =
    normalizeStringField((decoded as Record<string, unknown>).branchId) ||
    normalizeStringField((decoded as Record<string, unknown>).assignedBranchId);

  let userDoc: Record<string, unknown> | null = null;
  if (loadUserProfile) {
    try {
      userDoc = await resolvedDeps.loadUserDoc(decoded.uid);
    } catch (err: unknown) {
      if (err instanceof FirebaseAdminInitError) {
        throw new AuthError(
          err.statusCode,
          'AUTH_CONFIG_ERROR',
          'Database verification service is unavailable.'
        );
      }
      throw new AuthError(500, 'AUTH_CONFIG_ERROR', 'Failed to load user authorization profile.');
    }
  }

  const dbStatus = normalizeStringField(userDoc?.status)?.toLowerCase() ?? null;
  if (dbStatus && DEFAULT_INACTIVE_STATUSES.has(dbStatus)) {
    throw new AuthError(403, 'USER_INACTIVE', 'User account is inactive or suspended.');
  }

  const dbRole = normalizeRole(userDoc?.role);
  const role = claimRole ?? dbRole;
  const tenantId =
    claimTenantId ??
    normalizeStringField(userDoc?.tenantId) ??
    normalizeStringField(userDoc?.restaurantId);
  const branchId =
    claimBranchId ??
    normalizeStringField(userDoc?.branchId) ??
    normalizeStringField(userDoc?.assignedBranchId);
  const isSuperAdmin = claimSuperAdmin || dbRole === 'super_admin';

  return {
    uid: decoded.uid,
    email: normalizeStringField(decoded.email)?.toLowerCase() ?? null,
    emailVerified: Boolean(decoded.email_verified),
    isAnonymous,
    signInProvider,
    role,
    tenantId,
    branchId,
    isSuperAdmin,
    userStatus: dbStatus,
    decodedToken: decoded,
  };
}

export async function requireAuthenticatedUser(
  req: Pick<VercelRequest, 'headers'>,
  options: VerifyAuthOptions = {},
  deps?: AuthDependencies
): Promise<VerifiedAuthContext> {
  return verifyRequestAuth(req, options, deps);
}

export async function requireNonAnonymousUser(
  req: Pick<VercelRequest, 'headers'>,
  options: Omit<VerifyAuthOptions, 'allowAnonymous'> = {},
  deps?: AuthDependencies
): Promise<VerifiedAuthContext> {
  return verifyRequestAuth(req, { ...options, allowAnonymous: false }, deps);
}

export async function requireSuperAdmin(
  req: Pick<VercelRequest, 'headers'>,
  deps?: AuthDependencies
): Promise<VerifiedAuthContext> {
  const ctx = await verifyRequestAuth(
    req,
    {
      allowAnonymous: false,
      checkRevoked: true,
      loadUserProfile: true,
    },
    deps
  );

  if (!ctx.isSuperAdmin || ctx.role !== 'super_admin') {
    throw new AuthError(
      403,
      'SUPER_ADMIN_REQUIRED',
      'Forbidden: Super Admin privileges are required.'
    );
  }

  return ctx;
}

export async function requireRole(
  req: Pick<VercelRequest, 'headers'>,
  allowedRoles: string[],
  options: Omit<VerifyAuthOptions, 'allowAnonymous' | 'loadUserProfile'> = {},
  deps?: AuthDependencies
): Promise<VerifiedAuthContext> {
  const normalizedAllowed = new Set(
    allowedRoles.map((r) => normalizeRole(r)).filter((r): r is string => Boolean(r))
  );

  const ctx = await verifyRequestAuth(
    req,
    { ...options, allowAnonymous: false, loadUserProfile: true },
    deps
  );

  if (ctx.isSuperAdmin && normalizedAllowed.has('super_admin')) {
    return ctx;
  }

  if (!ctx.role || !normalizedAllowed.has(ctx.role)) {
    throw new AuthError(
      403,
      'INSUFFICIENT_ROLE',
      'Forbidden: User role does not permit this action.'
    );
  }

  return ctx;
}

export async function requireTenantAccess(
  req: Pick<VercelRequest, 'headers'>,
  targetTenantId: string,
  options: { allowSuperAdmin?: boolean; allowedRoles?: string[] } = {},
  deps?: AuthDependencies
): Promise<VerifiedAuthContext> {
  const cleanTarget = normalizeStringField(targetTenantId);
  if (!cleanTarget) {
    throw new AuthError(403, 'TENANT_ACCESS_DENIED', 'Target tenant ID is missing.');
  }

  const ctx = await verifyRequestAuth(
    req,
    { allowAnonymous: false, checkRevoked: true, loadUserProfile: true },
    deps
  );

  if (options.allowSuperAdmin !== false && ctx.isSuperAdmin) {
    return ctx;
  }

  if (options.allowedRoles && options.allowedRoles.length > 0) {
    const allowed = new Set(
      options.allowedRoles.map((r) => normalizeRole(r)).filter((r): r is string => Boolean(r))
    );
    if (!ctx.role || !allowed.has(ctx.role)) {
      throw new AuthError(403, 'INSUFFICIENT_ROLE', 'Forbidden: Insufficient role for tenant action.');
    }
  }

  if (!ctx.tenantId || ctx.tenantId !== cleanTarget) {
    throw new AuthError(
      403,
      'TENANT_ACCESS_DENIED',
      'Forbidden: Cross-tenant access is denied.'
    );
  }

  return ctx;
}

export async function requireBranchAccess(
  req: Pick<VercelRequest, 'headers'>,
  targetTenantId: string,
  targetBranchId: string,
  options: { allowOwnerWide?: boolean } = {},
  deps?: AuthDependencies
): Promise<VerifiedAuthContext> {
  const ctx = await requireTenantAccess(req, targetTenantId, { allowSuperAdmin: true }, deps);

  if (ctx.isSuperAdmin) {
    return ctx;
  }

  if (
    options.allowOwnerWide !== false &&
    (ctx.role === 'owner' || ctx.role === 'restaurant_owner' || ctx.role === 'admin')
  ) {
    return ctx;
  }

  const cleanBranch = normalizeStringField(targetBranchId);
  if (!cleanBranch || !ctx.branchId || ctx.branchId !== cleanBranch) {
    throw new AuthError(
      403,
      'BRANCH_ACCESS_DENIED',
      'Forbidden: User is not assigned to the requested branch.'
    );
  }

  return ctx;
}

export function handleAuthError(res: VercelResponse, err: unknown): VercelResponse {
  if (err instanceof AuthError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  if (err instanceof FirebaseAdminInitError) {
    return res.status(err.statusCode).json({
      error: 'Authentication service is unavailable.',
      code: err.code,
    });
  }

  return res.status(500).json({
    error: 'Internal authentication error.',
    code: 'INTERNAL_AUTH_ERROR',
  });
}

