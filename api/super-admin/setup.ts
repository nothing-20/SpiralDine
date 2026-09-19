import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminAuth, getAdminFirestore } from '../_lib/firebaseAdmin.js';

/**
 * /api/super-admin/setup
 * 
 * Unified Serverless Endpoint for Super Admin First-Time Setup & Status Check.
 * - GET: Checks if Super Admin setup has already been completed.
 * - POST: Securely creates the initial platform Super Admin account with custom claims.
 * 
 * Enforces:
 * 1. Verification of server-side SUPER_ADMIN_SETUP_SECRET.
 * 2. Atomic/transactional race-condition check ensuring only the FIRST Super Admin can be created.
 * 3. Validation of input parameters (name, email, password strength, setup key).
 * 4. User creation via Firebase Admin SDK.
 * 5. Custom claims assignment: { role: 'super_admin', super_admin: true }.
 * 6. Profile creation in Firestore users/{uid} conforming to canonical schema.
 * 7. Permanent closure of first-time setup once completed.
 * 8. Zero mock data creation.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // -------------------------------------------------------------
  // GET: Check setup status
  // -------------------------------------------------------------
  if (req.method === 'GET') {
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
        try {
          await lockRef.set({
            isSetupComplete: true,
            completedAt: new Date().toISOString(),
            syncedFromUserCheck: true,
          }, { merge: true });
        } catch {
          // Non-critical background sync
        }

        return res.status(200).json({
          isSetupComplete: true,
          message: 'Super Admin setup has already been completed.',
        });
      }

      // First-time setup is available
      return res.status(200).json({
        isSetupComplete: false,
        message: 'Initial platform Super Admin setup is available.',
      });
    } catch (error: any) {
      console.error('[super-admin/setup:GET] Error checking status:', error?.message);
      return res.status(500).json({
        error: 'Failed to verify Super Admin setup status.',
      });
    }
  }

  // -------------------------------------------------------------
  // POST: Execute first-time setup
  // -------------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { fullName, email, password, setupKey } = req.body || {};

  // 1. Input Validation
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    return res.status(400).json({ error: 'Administrator Name is required.' });
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Administrator Email is required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email address format.' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters in length.' });
  }

  if (!setupKey || typeof setupKey !== 'string' || !setupKey.trim()) {
    return res.status(400).json({ error: 'Setup Authorization Key is required.' });
  }

  // 2. Validate Server-Side Secret
  const configuredSecret = process.env.SUPER_ADMIN_SETUP_SECRET;
  if (!configuredSecret) {
    console.error('[super-admin/setup:POST] SUPER_ADMIN_SETUP_SECRET is not configured in server environment.');
    return res.status(500).json({
      error: 'Platform setup configuration missing. SUPER_ADMIN_SETUP_SECRET must be set in the server environment.',
    });
  }

  if (setupKey.trim() !== configuredSecret.trim()) {
    return res.status(401).json({
      error: 'Invalid Setup Authorization Key. Account creation rejected.',
    });
  }

  const auth = getAdminAuth();
  const db = getAdminFirestore();
  const now = new Date().toISOString();

  try {
    // 3. Check existing Super Admins before initiating transaction
    const usersRef = db.collection('users');
    const [existingSuperAdmin1, existingSuperAdmin2] = await Promise.all([
      usersRef.where('role', '==', 'super_admin').limit(1).get(),
      usersRef.where('role', '==', 'super-admin').limit(1).get(),
    ]);

    if (!existingSuperAdmin1.empty || !existingSuperAdmin2.empty) {
      return res.status(409).json({
        error: 'Super Admin setup has already been completed.',
      });
    }

    // 4. Atomic Race-Condition Lock via Firestore Transaction
    const lockRef = db.collection('systemSettings').doc('platformAdminLock');
    await db.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      if (lockDoc.exists && lockDoc.data()?.isSetupComplete === true) {
        throw new Error('SETUP_ALREADY_COMPLETED');
      }

      transaction.set(lockRef, {
        isSetupComplete: true,
        setupInitiatedAt: now,
        superAdminEmail: cleanEmail,
        lockId: 'PLATFORM_SUPER_ADMIN_INITIALIZED',
      }, { merge: true });
    });

    // 5. Create or retrieve Firebase Authentication user via Firebase Admin SDK
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email: cleanEmail,
        password: password,
        displayName: fullName.trim(),
        emailVerified: true,
      });
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        // Retrieve existing user
        userRecord = await auth.getUserByEmail(cleanEmail);
        // Verify this user does not already possess super admin claim
        const claims = userRecord.customClaims || {};
        if (claims.role === 'super_admin' || claims.role === 'super-admin' || claims.super_admin === true) {
          return res.status(409).json({
            error: 'Super Admin setup has already been completed.',
          });
        }
        // Update user display name and password
        await auth.updateUser(userRecord.uid, {
          displayName: fullName.trim(),
          password: password,
        });
      } else {
        // Rollback lock if creation failed unexpectedly
        try {
          await lockRef.delete();
        } catch {
          // ignore rollback failure
        }
        throw authError;
      }
    }

    // 6. Assign Canonical Super Admin Custom Claims
    const existingClaims = userRecord.customClaims || {};
    await auth.setCustomUserClaims(userRecord.uid, {
      ...existingClaims,
      role: 'super_admin',
      super_admin: true,
    });

    // 7. Create/Update Firestore users/{uid} profile
    const userDocRef = db.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      email: cleanEmail,
      displayName: fullName.trim(),
      role: 'super_admin',
      tenantId: '',
      branchId: '',
      department: 'Platform Administration',
      status: 'active',
      phoneNumber: userRecord.phoneNumber || '',
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    // 8. Finalize setup lock with created UID
    await lockRef.set({
      isSetupComplete: true,
      completedAt: now,
      superAdminUid: userRecord.uid,
      superAdminEmail: cleanEmail,
    }, { merge: true });

    return res.status(201).json({
      success: true,
      message: 'Super Admin account created successfully.',
      email: cleanEmail,
    });
  } catch (err: any) {
    if (err.message === 'SETUP_ALREADY_COMPLETED') {
      return res.status(409).json({
        error: 'Super Admin setup has already been completed.',
      });
    }

    console.error('[super-admin/setup:POST] Creation error:', err?.message || err);
    return res.status(500).json({
      error: err?.message || 'Failed to create Super Admin account. Please try again.',
    });
  }
}
