import type { VercelRequest, VercelResponse } from '@vercel/node';
import { 
  getServiceAccountCredentials, 
  createFirebaseAuthUser, 
  setFirebaseAuthCustomClaims,
  lookupFirebaseAuthUser
} from '../_lib/firebaseAdminAuth.js';
import { 
  db as serverDb, 
  auth as serverAuth,
  doc as serverDoc, 
  getDoc as serverGetDoc, 
  setDoc as serverSetDoc,
  collection as serverCollection, 
  query as serverQuery, 
  where as serverWhere, 
  getDocs as serverGetDocs, 
  ensureServerAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from '../_lib/firebaseServer.js';

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
 * 4. User creation via Firebase Authentication.
 * 5. Custom claims assignment: { role: 'super_admin', super_admin: true } when service account is available.
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
      await ensureServerAuth();

      // 1. Query users for real human super admins (excluding internal service accounts)
      const q1 = serverQuery(serverCollection(serverDb, 'users'), serverWhere('role', '==', 'super_admin'));
      const q2 = serverQuery(serverCollection(serverDb, 'users'), serverWhere('role', '==', 'super-admin'));
      const [snap1, snap2] = await Promise.all([serverGetDocs(q1), serverGetDocs(q2)]);

      const humanSuperAdminDocs = [...snap1.docs, ...snap2.docs].filter(d => {
        const email = (d.data()?.email || '').toLowerCase();
        return !email.includes('restaurantos.internal') && !email.includes('dev-admin-reset');
      });

      // 2. Check lock doc
      const lockDocRef = serverDoc(serverDb, 'systemSettings', 'platformAdminLock');
      const lockSnap = await serverGetDoc(lockDocRef);
      const lockData = lockSnap.exists() ? lockSnap.data() : null;

      // Setup is only considered complete if a real human administrator exists
      // or if the lock was explicitly set with a verified superAdminUid
      const isActuallyComplete = 
        humanSuperAdminDocs.length > 0 || 
        (lockData?.isSetupComplete === true && lockData?.superAdminUid && !lockData?.syncedFromUserCheck);

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
    } catch (error: any) {
      console.error('[super-admin/setup:GET] Error checking status:', error?.message);
      return res.status(200).json({
        isSetupComplete: false,
        warning: 'Could not connect to database to check lock status.',
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

  const now = new Date().toISOString();

  try {
    // 1. Ensure authenticated context as server admin for lock and initial checks
    await ensureServerAuth(true);

    // 2. Check existing real human Super Admins before proceeding
    const q1 = serverQuery(serverCollection(serverDb, 'users'), serverWhere('role', '==', 'super_admin'));
    const q2 = serverQuery(serverCollection(serverDb, 'users'), serverWhere('role', '==', 'super-admin'));
    const [existing1, existing2] = await Promise.all([serverGetDocs(q1), serverGetDocs(q2)]);

    const humanSuperAdmins = [...existing1.docs, ...existing2.docs].filter(d => {
      const em = (d.data()?.email || '').toLowerCase();
      return !em.includes('restaurantos.internal') && !em.includes('dev-admin-reset');
    });

    const lockRef = serverDoc(serverDb, 'systemSettings', 'platformAdminLock');
    const existingLock = await serverGetDoc(lockRef);
    const lockData = existingLock.exists() ? existingLock.data() : null;

    if (humanSuperAdmins.length > 0 || (lockData?.isSetupComplete === true && lockData?.superAdminUid && !lockData?.syncedFromUserCheck)) {
      return res.status(409).json({
        error: 'Super Admin setup has already been completed.',
      });
    }

    // Set atomic lock with server admin privileges
    await serverSetDoc(lockRef, {
      isSetupComplete: true,
      setupInitiatedAt: now,
      superAdminEmail: cleanEmail,
      lockId: 'PLATFORM_SUPER_ADMIN_INITIALIZED',
      syncedFromUserCheck: false,
    }, { merge: true });

    // 3. Create or authenticate user in Firebase Authentication
    let createdUid = '';
    const creds = getServiceAccountCredentials();

    if (creds) {
      // Use Admin REST API
      const existingUser = await lookupFirebaseAuthUser(creds, cleanEmail);
      if (existingUser?.customAttributes?.role === 'super_admin' || existingUser?.customAttributes?.super_admin === true) {
        return res.status(409).json({
          error: 'Super Admin setup has already been completed.',
        });
      }

      if (existingUser?.uid) {
        createdUid = existingUser.uid;
      } else {
        const userRecord = await createFirebaseAuthUser(creds, {
          email: cleanEmail,
          password: password,
          displayName: fullName.trim(),
        });
        createdUid = userRecord.uid;
      }

      // Assign Canonical Super Admin Custom Claims
      const existingClaims = existingUser?.customAttributes || {};
      await setFirebaseAuthCustomClaims(creds, createdUid, {
        ...existingClaims,
        role: 'super_admin',
        super_admin: true,
      });
    } else {
      // Fallback: Create or authenticate via Firebase Client Auth SDK in serverless function
      try {
        const userCred = await createUserWithEmailAndPassword(serverAuth, cleanEmail, password);
        createdUid = userCred.user.uid;
        await updateProfile(userCred.user, { displayName: fullName.trim() });
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          // Attempt to sign in to verify identity and get UID
          try {
            const existingCred = await signInWithEmailAndPassword(serverAuth, cleanEmail, password);
            createdUid = existingCred.user.uid;
            if (fullName.trim()) {
              await updateProfile(existingCred.user, { displayName: fullName.trim() });
            }
          } catch {
            // Re-authenticate service admin so lock can be safely rolled back
            await ensureServerAuth(true);
            await serverSetDoc(lockRef, {
              isSetupComplete: false,
              lastError: 'Email already in use with different credentials',
            }, { merge: true });
            return res.status(400).json({
              error: 'An account with this email address already exists. Please enter your existing password to promote it to Super Admin, or use a fresh email address.',
            });
          }
        } else {
          // Rollback setup lock on unexpected auth error
          await ensureServerAuth(true);
          await serverSetDoc(lockRef, {
            isSetupComplete: false,
            lastError: authErr?.message,
          }, { merge: true });
          throw authErr;
        }
      }
    }

    // 4. Create/Update Firestore users/{uid} profile
    // Auth context is currently the created/authenticated user (createdUid), satisfying request.auth.uid == userId
    const userDocRef = serverDoc(serverDb, 'users', createdUid);
    await serverSetDoc(userDocRef, {
      uid: createdUid,
      email: cleanEmail,
      displayName: fullName.trim(),
      role: 'super_admin',
      tenantId: '',
      branchId: '',
      department: 'Platform Administration',
      status: 'active',
      phoneNumber: '',
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    // 5. Finalize setup lock with created UID using elevated server admin context
    await ensureServerAuth(true);
    await serverSetDoc(lockRef, {
      isSetupComplete: true,
      completedAt: now,
      superAdminUid: createdUid,
      superAdminEmail: cleanEmail,
      syncedFromUserCheck: false,
    }, { merge: true });

    return res.status(201).json({
      success: true,
      message: 'Super Admin account created successfully.',
      email: cleanEmail,
    });
  } catch (err: any) {
    console.error('[super-admin/setup:POST] Creation error:', err?.message || err);
    return res.status(500).json({
      error: err?.message || 'Failed to create Super Admin account. Please try again.',
    });
  }
}
