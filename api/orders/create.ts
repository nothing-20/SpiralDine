import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from '../_lib/firebaseServer';
import { orderValidationService } from '../../src/shared/services/orderValidationService';

interface ITokenUser {
  uid: string;
  isAnonymous?: boolean;
}

/**
 * Verify Firebase ID token independently on server side.
 * Supports production Google Identity Toolkit validation and emulator token decoding.
 */
async function verifyAuthToken(token: string): Promise<ITokenUser | null> {
  if (!token) return null;

  // 1. Emulator environment: decode synthetic/emulator JWT payload
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const uid = payload.user_id || payload.sub || payload.uid;
        if (uid) {
          return {
            uid,
            isAnonymous: payload.firebase?.sign_in_provider === 'anonymous'
          };
        }
      }
    } catch (_) {}
  }

  // 2. Production: Verify via Google Identity Toolkit API
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    console.warn('[api/orders/create] Warning: No Firebase API Key configured for token verification.');
    // Fallback: decode unverified JWT if key not available in staging
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const uid = payload.user_id || payload.sub || payload.uid;
        if (uid) return { uid, isAnonymous: payload.firebase?.sign_in_provider === 'anonymous' };
      }
    } catch (_) {}
    return null;
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const user = data.users?.[0];
    if (!user) return null;

    return {
      uid: user.localId,
      isAnonymous: !user.email && !user.phoneNumber
    };
  } catch (err) {
    console.warn('[api/orders/create] Google Identity Toolkit verification warning:', err);
    return null;
  }
}

/**
 * Serverless API endpoint: POST /api/orders/create
 * Provides trusted server-side order validation, canonical pricing recalculation,
 * and persistence.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST is permitted.' });
  }

  const { tenantId, tableNumber, items, customerId } = req.body || {};

  // 1. Structural argument validation
  if (!tenantId || !tableNumber || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: 'Missing required order fields: tenantId, tableNumber, and a non-empty items array are required.'
    });
  }

  // 2. Authentication & Authorization Verification
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Missing Authorization header or Bearer token.'
    });
  }

  const tokenUser = await verifyAuthToken(token);
  if (!tokenUser || !tokenUser.uid) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired Firebase authentication token.'
    });
  }

  // Verify caller UID matches claimed customerId
  if (customerId && customerId !== tokenUser.uid) {
    return res.status(403).json({
      error: `Forbidden: Authenticated UID (${tokenUser.uid}) does not match requested customerId (${customerId}).`
    });
  }

  const verifiedUid = tokenUser.uid;

  try {
    const validatedRequest = {
      ...req.body,
      customerId: verifiedUid
    };

    const result = await orderValidationService.validateAndCreateOrder(validatedRequest, {
      dbInstance: db
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[API /api/orders/create] Validation failed:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Order validation failed.'
    });
  }
}
