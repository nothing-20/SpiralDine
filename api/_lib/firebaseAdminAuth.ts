import crypto from 'crypto';
import { assertServerProjectSafe, resolveOptionalServerProjectId } from './firebaseEnv.js';

/**
 * Lightweight, zero-dependency Firebase Authentication Admin client using standard Google REST API.
 * Bypasses jwks-rsa/jose CJS/ESM incompatibilities in Vercel Serverless Functions.
 * 
 * Supports credentials from:
 * - FIREBASE_SERVICE_ACCOUNT (raw JSON string or base64 encoded)
 * - FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */

interface ServiceAccountCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  const configuredProjectId = resolveOptionalServerProjectId(process.env);

  // 1. Parse FIREBASE_SERVICE_ACCOUNT
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      let parsed: Record<string, string | undefined>;
      if (raw.startsWith('{')) {
        parsed = JSON.parse(raw) as Record<string, string | undefined>;
      } else {
        const decoded = Buffer.from(raw, 'base64').toString('utf-8');
        parsed = JSON.parse(decoded) as Record<string, string | undefined>;
      }

      if (parsed.client_email && parsed.private_key) {
        const resolvedProjectId = parsed.project_id || configuredProjectId;
        if (!resolvedProjectId) {
          throw new Error(
            '[firebaseAdminAuth] Service account credentials lack project_id and neither FIREBASE_PROJECT_ID nor VITE_FIREBASE_PROJECT_ID is configured.'
          );
        }
        assertServerProjectSafe(resolvedProjectId, '', '', process.env);
        return {
          projectId: resolvedProjectId,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
        };
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '';
      if (errMsg.includes('[firebaseAdminAuth]') || errMsg.includes('[firebaseEnv]')) {
        throw err;
      }
      console.warn('[firebaseAdminAuth] Could not parse FIREBASE_SERVICE_ACCOUNT:', errMsg);
    }
  }

  // 2. Individual env variables
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    if (!configuredProjectId) {
      throw new Error(
        '[firebaseAdminAuth] FIREBASE_PROJECT_ID or VITE_FIREBASE_PROJECT_ID must be explicitly configured when using FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.'
      );
    }
    assertServerProjectSafe(configuredProjectId, '', '', process.env);
    return {
      projectId: configuredProjectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

/**
 * Mint Google OAuth2 access token for Google Identity Toolkit
 */
export async function getGoogleAccessToken(creds: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: creds.clientEmail,
    scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Claim = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
  const unsigned = `${b64Header}.${b64Claim}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(creds.privateKey, 'base64url');
  const assertion = `${unsigned}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${assertion}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    throw new Error(tokenData.error_description || tokenData.error || 'Failed to authenticate service account with Google OAuth2.');
  }

  return tokenData.access_token;
}

/**
 * Create user in Firebase Authentication
 */
export async function createFirebaseAuthUser(
  creds: ServiceAccountCredentials, 
  user: { email: string; password?: string; displayName?: string }
): Promise<{ uid: string; email: string; displayName?: string }> {
  const token = await getGoogleAccessToken(creds);

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${creds.projectId}/accounts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      displayName: user.displayName,
      emailVerified: true,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    // If email already exists, look up user
    if (data.error?.message?.includes('EMAIL_EXISTS')) {
      const lookup = await lookupFirebaseAuthUser(creds, user.email);
      if (lookup) {
        // Update user
        if (user.password || user.displayName) {
          await updateFirebaseAuthUser(creds, lookup.uid, {
            password: user.password,
            displayName: user.displayName,
          });
        }
        return lookup;
      }
    }
    throw new Error(data.error?.message || 'Failed to create user in Firebase Authentication.');
  }

  return {
    uid: data.localId,
    email: data.email || user.email,
    displayName: data.displayName || user.displayName,
  };
}

/**
 * Look up user in Firebase Authentication
 */
export async function lookupFirebaseAuthUser(
  creds: ServiceAccountCredentials, 
  email: string
): Promise<{ uid: string; email: string; customAttributes?: Record<string, unknown> } | null> {
  const token = await getGoogleAccessToken(creds);

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${creds.projectId}/accounts:lookup`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: [email],
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.users || data.users.length === 0) {
    return null;
  }

  const u = data.users[0];
  let customAttributes = {};
  if (u.customAttributes) {
    try {
      customAttributes = JSON.parse(u.customAttributes);
    } catch {
      // ignore
    }
  }

  return {
    uid: u.localId,
    email: u.email,
    customAttributes,
  };
}

/**
 * Update user in Firebase Authentication
 */
export async function updateFirebaseAuthUser(
  creds: ServiceAccountCredentials,
  uid: string,
  updates: { password?: string; displayName?: string }
): Promise<void> {
  const token = await getGoogleAccessToken(creds);

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${creds.projectId}/accounts:update`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      localId: uid,
      password: updates.password,
      displayName: updates.displayName,
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error?.message || 'Failed to update Firebase Authentication user.');
  }
}

/**
 * Set custom claims (roles, super_admin, etc.) on a user in Firebase Authentication
 */
export async function setFirebaseAuthCustomClaims(
  creds: ServiceAccountCredentials,
  uid: string,
  claims: Record<string, unknown>
): Promise<void> {
  const token = await getGoogleAccessToken(creds);

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${creds.projectId}/accounts:update`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      localId: uid,
      customAttributes: JSON.stringify(claims),
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error?.message || 'Failed to assign custom claims to user.');
  }
}
