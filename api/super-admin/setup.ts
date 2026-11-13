import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { UserRecord } from 'firebase-admin/auth';
import {
  FirebaseAdminInitError,
  adminAuth,
  adminDb,
  constantTimeEqual,
} from '../_lib/firebaseAdmin.js';

interface SetupBody {
  fullName?: unknown;
  email?: unknown;
  password?: unknown;
  setupKey?: unknown;
}

function isInternalServiceEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const lower = email.toLowerCase();
  return lower.includes('restaurantos.internal') || lower.includes('dev-admin-reset');
}

function isLockMarkedComplete(lockData: FirebaseFirestore.DocumentData | undefined): boolean {
  return Boolean(
    lockData?.isSetupComplete === true &&
      lockData?.superAdminUid &&
      !lockData?.syncedFromUserCheck
  );
}

/**
 * /api/super-admin/setup
 *
 * Unified Serverless Endpoint for Super Admin First-Time Setup & Status Check.
 * - GET: Fail-closed check whether initial Super Admin setup has been completed.
 * - POST: Securely creates the initial platform Super Admin account via Firebase Admin SDK.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // -------------------------------------------------------------
  // GET: Fail-closed setup status check
  // -------------------------------------------------------------
  if (req.method === 'GET') {
    try {
      const [snap1, snap2, lockSnap] = await Promise.all([
        adminDb.collection('users').where('role', '==', 'super_admin').get(),
        adminDb.collection('users').where('role', '==', 'super-admin').get(),
        adminDb.collection('systemSettings').doc('platformAdminLock').get(),
      ]);

      const humanSuperAdminDocs = [...snap1.docs, ...snap2.docs].filter(
        (d) => !isInternalServiceEmail(d.data()?.email)
      );

      const lockData = lockSnap.exists ? lockSnap.data() : undefined;
      const isActuallyComplete =
        humanSuperAdminDocs.length > 0 || isLockMarkedComplete(lockData);

      if (isActuallyComplete) {
        return res.status(200).json({
          isSetupComplete: true,
          message: 'Super Admin setup has already been completed.',
        });
      }

      return res.status(200).json({
        isSetupComplete: false,
        message: 'Initial platform Super Admin setup is available.',
      });
    } catch (error: unknown) {
      const code =
        error instanceof FirebaseAdminInitError ? error.code : 'SETUP_STATUS_UNAVAILABLE';
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[super-admin/setup:GET] Fail-closed status check error:', message);
      return res.status(503).json({
        error: 'Unable to verify Super Admin setup status.',
        code,
      });
    }
  }

  // -------------------------------------------------------------
  // POST: Execute first-time setup
  // -------------------------------------------------------------
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { fullName, email, password, setupKey } = (req.body || {}) as SetupBody;

  if (typeof fullName !== 'string' || !fullName.trim()) {
    return res.status(400).json({ error: 'Administrator Name is required.' });
  }

  if (typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Administrator Email is required.' });
  }

  const cleanName = fullName.trim();
  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return res.status(400).json({ error: 'Invalid email address format.' });
  }

  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters in length.' });
  }

  if (typeof setupKey !== 'string' || !setupKey.trim()) {
    return res.status(400).json({ error: 'Setup Authorization Key is required.' });
  }

  const configuredSecret = process.env.SUPER_ADMIN_SETUP_SECRET;
  if (!configuredSecret || !configuredSecret.trim()) {
    console.error('[super-admin/setup:POST] SUPER_ADMIN_SETUP_SECRET is not configured.');
    return res.status(500).json({
      error:
        'Platform setup configuration missing. SUPER_ADMIN_SETUP_SECRET must be set in the server environment.',
    });
  }

  if (!constantTimeEqual(setupKey.trim(), configuredSecret.trim())) {
    return res.status(401).json({
      error: 'Invalid Setup Authorization Key. Account creation rejected.',
    });
  }

  const now = new Date().toISOString();
  const lockRef = adminDb.collection('systemSettings').doc('platformAdminLock');
  let acquiredLock = false;

  try {
    // 1. Check existing real human Super Admins and acquire setup lock atomically
    const [existing1, existing2] = await Promise.all([
      adminDb.collection('users').where('role', '==', 'super_admin').get(),
      adminDb.collection('users').where('role', '==', 'super-admin').get(),
    ]);

    const humanSuperAdmins = [...existing1.docs, ...existing2.docs].filter(
      (d) => !isInternalServiceEmail(d.data()?.email)
    );

    if (humanSuperAdmins.length > 0) {
      return res.status(409).json({
        error: 'Super Admin setup has already been completed.',
      });
    }

    const alreadyLocked = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(lockRef);
      const data = snap.exists ? snap.data() : undefined;
      if (data?.isSetupComplete === true && !data?.syncedFromUserCheck) {
        return true;
      }

      tx.set(
        lockRef,
        {
          isSetupComplete: true,
          setupInitiatedAt: now,
          superAdminEmail: cleanEmail,
          lockId: 'PLATFORM_SUPER_ADMIN_INITIALIZED',
          syncedFromUserCheck: false,
        },
        { merge: true }
      );
      return false;
    });

    if (alreadyLocked) {
      return res.status(409).json({
        error: 'Super Admin setup has already been completed.',
      });
    }
    acquiredLock = true;

    // 2. Lookup or create user via Firebase Admin Auth
    let userRecord: UserRecord | null = null;
    try {
      userRecord = await adminAuth.getUserByEmail(cleanEmail);
    } catch (lookupErr: unknown) {
      const code = (lookupErr as { code?: string })?.code;
      if (code !== 'auth/user-not-found') {
        throw lookupErr;
      }
    }

    if (
      userRecord &&
      (userRecord.customClaims?.role === 'super_admin' ||
        userRecord.customClaims?.super_admin === true)
    ) {
      return res.status(409).json({
        error: 'Super Admin setup has already been completed.',
      });
    }

    let createdUid: string;
    if (userRecord) {
      createdUid = userRecord.uid;
      if (cleanName && userRecord.displayName !== cleanName) {
        await adminAuth.updateUser(createdUid, { displayName: cleanName });
      }
    } else {
      const created = await adminAuth.createUser({
        email: cleanEmail,
        password,
        displayName: cleanName,
      });
      createdUid = created.uid;
    }

    // 3. Assign canonical Super Admin Custom Claims
    const existingClaims = userRecord?.customClaims || {};
    await adminAuth.setCustomUserClaims(createdUid, {
      ...existingClaims,
      role: 'super_admin',
      super_admin: true,
    });

    // 4. Create/Update Firestore users/{uid} profile
    await adminDb.collection('users').doc(createdUid).set(
      {
        uid: createdUid,
        email: cleanEmail,
        displayName: cleanName,
        role: 'super_admin',
        tenantId: '',
        branchId: '',
        department: 'Platform Administration',
        status: 'active',
        phoneNumber: '',
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    // 5. Finalize setup lock with created UID
    await lockRef.set(
      {
        isSetupComplete: true,
        completedAt: now,
        superAdminUid: createdUid,
        superAdminEmail: cleanEmail,
        syncedFromUserCheck: false,
      },
      { merge: true }
    );
    acquiredLock = false;

    return res.status(201).json({
      success: true,
      message: 'Super Admin account created successfully.',
      email: cleanEmail,
    });
  } catch (err: unknown) {
    if (acquiredLock) {
      try {
        await lockRef.set(
          {
            isSetupComplete: false,
            lastError: err instanceof Error ? err.message : 'Setup failed',
          },
          { merge: true }
        );
      } catch (rollbackErr) {
        console.error('[super-admin/setup:POST] Failed to roll back setup lock:', rollbackErr);
      }
    }

    if (err instanceof FirebaseAdminInitError) {
      return res.status(err.statusCode).json({
        error: 'Server authentication service is unavailable.',
        code: err.code,
      });
    }

    const message = err instanceof Error ? err.message : 'Failed to create Super Admin account.';
    console.error('[super-admin/setup:POST] Creation error:', message);
    return res.status(500).json({
      error: message,
    });
  }
}
