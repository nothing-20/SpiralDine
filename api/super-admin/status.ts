import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminFirestore } from '../_lib/firebaseAdmin';

/**
 * GET /api/super-admin/status
 * 
 * Verifies whether the initial Super Admin setup has already been completed.
 * Checks both the transactional lock (systemSettings/platformAdminLock)
 * and whether any user in Firestore has canonical role 'super_admin' or 'super-admin'.
 * 
 * Never returns secrets, tokens, or private credentials.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET and OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const db = getAdminFirestore();

    // 1. Check atomic setup lock in Firestore
    const lockRef = db.collection('systemSettings').doc('platformAdminLock');
    const lockSnap = await lockRef.get();

    if (lockSnap.exists && lockSnap.data()?.isSetupComplete === true) {
      return res.status(200).json({
        isSetupComplete: true,
        message: 'Super Admin setup has already been completed.',
      });
    }

    // 2. Query users collection for any existing super_admin
    const usersRef = db.collection('users');
    const [superAdminSnap, legacySnap] = await Promise.all([
      usersRef.where('role', '==', 'super_admin').limit(1).get(),
      usersRef.where('role', '==', 'super-admin').limit(1).get(),
    ]);

    if (!superAdminSnap.empty || !legacySnap.empty) {
      // Sync the lock document so subsequent checks are instant
      try {
        await lockRef.set({
          isSetupComplete: true,
          completedAt: new Date().toISOString(),
          syncedFromUserCheck: true,
        }, { merge: true });
      } catch {
        // Non-critical if background sync fails
      }

      return res.status(200).json({
        isSetupComplete: true,
        message: 'Super Admin setup has already been completed.',
      });
    }

    // No Super Admin exists and lock is not set -> first-time setup is available
    return res.status(200).json({
      isSetupComplete: false,
      message: 'Initial platform Super Admin setup is available.',
    });
  } catch (error: any) {
    console.error('[super-admin/status] Error checking status:', error?.message);
    return res.status(500).json({
      error: 'Failed to verify Super Admin setup status.',
    });
  }
}
