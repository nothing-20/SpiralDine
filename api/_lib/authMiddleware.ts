import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  FirebaseAdminInitError,
  getAdminAuth,
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
      getAdminAuth().verifyIdToken(token, checkRevoked),
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

