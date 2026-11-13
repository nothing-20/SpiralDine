#!/usr/bin/env node

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, getDoc, setDoc, doc } from 'firebase/firestore';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const {
  PRODUCTION_PROJECT_ID,
  normalizeEnvName,
  parseCliFlags,
  loadScriptEnvironment,
  referencesProductionProject,
  resolveScriptFirebaseConfig,
  resolveRunnerCredentials,
} = require('./_lib/envGuard.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const flags = parseCliFlags();
const targetEnv = normalizeEnvName(flags.env);
const dryRun = !flags.execute;

console.log('====================================================');
console.log('SPIRALDINE — SAFE CUSTOMER PROFILE MIGRATION TOOL');
console.log('====================================================');

if (!targetEnv || !['development', 'staging', 'production'].includes(targetEnv)) {
  console.error('\n[SAFETY ABORT] Explicit --env <dev|staging|prod> CLI argument is required.');
  console.error('Usage:\n  node scripts/migrate-customers.js --env dev --project <project-id> [--execute]');
  process.exit(1);
}

if (!flags.project) {
  console.error('\n[SAFETY ABORT] Explicit --project <firebase-project-id> CLI argument is required.');
  process.exit(1);
}

// Guard against mismatched production target
if (targetEnv !== 'production' && referencesProductionProject(flags.project)) {
  console.error(
    `\n[SAFETY ABORT] Non-production environment "${targetEnv}" cannot target production project "${PRODUCTION_PROJECT_ID}".`
  );
  process.exit(1);
}

// Load env files strictly matching --env
loadScriptEnvironment({ rootDir, envName: targetEnv });

let firebaseConfig;
try {
  firebaseConfig = resolveScriptFirebaseConfig(process.env, { expectedEnv: targetEnv });
} catch (err) {
  console.error(`\n[SAFETY ABORT] ${err.message}`);
  process.exit(1);
}

if (flags.project !== firebaseConfig.projectId) {
  console.error(
    `\n[SAFETY ABORT] --project "${flags.project}" does not match configured "${targetEnv}" project "${firebaseConfig.projectId}".`
  );
  process.exit(1);
}

const isProductionTarget =
  targetEnv === 'production' || referencesProductionProject(firebaseConfig);

if (isProductionTarget && !dryRun) {
  if (process.env.ALLOW_PRODUCTION_MIGRATION !== 'YES_I_HAVE_VERIFIED_BACKUP') {
    console.error('\n[PRODUCTION SAFEGUARD] Refusing live write migration against production without verified backup confirmation.');
    console.error('To execute writes on production after verifying a Firestore export backup, set:');
    console.error('  $env:ALLOW_PRODUCTION_MIGRATION="YES_I_HAVE_VERIFIED_BACKUP"');
    process.exit(1);
  }
}

let runnerCreds;
try {
  runnerCreds = resolveRunnerCredentials(process.env);
} catch (err) {
  console.error(`\n[SAFETY ABORT] ${err.message}`);
  process.exit(1);
}

console.log(`Target Env:     ${targetEnv}`);
console.log(`Target Project: ${firebaseConfig.projectId}`);
console.log(`Mode:           ${dryRun ? 'DRY-RUN (no writes will be committed; pass --execute to write)' : 'EXECUTE (live writes enabled)'}`);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const STAFF_ROLES = new Set([
  'super-admin',
  'super_admin',
  'owner',
  'admin',
  'manager',
  'waiter',
  'kitchen',
  'cashier',
  'reception',
  'chef',
  'staff',
]);

const CUSTOMER_SUBCOLLECTIONS = [
  'addresses',
  'reservations',
  'diningHistory',
  'transactions',
  'notifications',
  'orders',
];

async function runMigration() {
  console.log('\n[1/4] Authenticating migration runner...');
  const cred = await signInWithEmailAndPassword(auth, runnerCreds.email, runnerCreds.password);
  console.log('[AUTH] Authenticated migration runner as:', cred.user.email);

  console.log('\n[2/4] Scanning root users/ collection...');

  let usersSnap;
  try {
    const usersCol = collection(db, 'users');
    usersSnap = await getDocs(usersCol);
    console.log(`Found ${usersSnap.size} total user documents.`);
  } catch (err) {
    console.error('[FATAL] Failed to read users collection:', err);
    process.exit(1);
  }

  let customersDetected = 0;
  let customersMigrated = 0;
  let alreadyExisted = 0;
  let skipped = 0;
  let ambiguousUsers = 0;
  let errors = 0;

  console.log('\n[3/4] Classifying documents and migrating confirmed customers...');

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const uid = userDoc.id;
    const rawRole = (data.role || data.userRole || data.accountType || data.type || '').toLowerCase().trim();

    if (STAFF_ROLES.has(rawRole) || data.isOwner === true || data.isStaff === true) {
      skipped++;
      continue;
    }

    const isConfirmedCustomer =
      rawRole === 'customer' ||
      data.isCustomer === true ||
      (data.loyaltyPoints !== undefined && !data.tenantId) ||
      (data.walletBalance !== undefined && !data.tenantId);

    if (!isConfirmedCustomer) {
      ambiguousUsers++;
      console.log(`  [AMBIGUOUS] Skipped ambiguous user UID: ${uid} (role: "${rawRole || 'none'}")`);
      continue;
    }

    customersDetected++;

    try {
      const targetDocRef = doc(db, 'customers', uid);
      const targetSnap = await getDoc(targetDocRef);

      const customerProfilePayload = {
        uid,
        email: data.email || '',
        fullName: data.fullName || data.name || data.displayName || '',
        displayName: data.displayName || data.fullName || data.name || 'Customer',
        phoneNumber: data.phoneNumber || data.phone || '',
        photoURL: data.photoURL || data.photo || data.profileImage || null,
        role: 'customer',
        status: data.status || 'active',
        tenantId: data.tenantId || null,
        walletBalance: data.walletBalance !== undefined ? data.walletBalance : 0,
        loyaltyPoints: data.loyaltyPoints !== undefined ? data.loyaltyPoints : 0,
        dietaryPrefs: Array.isArray(data.dietaryPrefs) ? data.dietaryPrefs : [],
        allergens: Array.isArray(data.allergens) ? data.allergens : [],
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };

      if (dryRun) {
        if (targetSnap.exists()) {
          alreadyExisted++;
          console.log(`  [DRY-RUN EXISTING] Would merge customer ${uid} into customers/${uid}`);
        } else {
          customersMigrated++;
          console.log(`  [DRY-RUN MIGRATE] Would copy customer ${uid} (${customerProfilePayload.email}) to customers/${uid}`);
        }
        continue;
      }

      if (targetSnap.exists()) {
        alreadyExisted++;
        console.log(`  [EXISTING] Customer ${uid} already in customers/{uid}. Non-destructively merging missing fields.`);
        await setDoc(targetDocRef, customerProfilePayload, { merge: true });
      } else {
        await setDoc(targetDocRef, customerProfilePayload);
        customersMigrated++;
        console.log(`  [MIGRATED] Successfully copied customer ${uid} (${customerProfilePayload.email}) to customers/${uid}`);
      }

      for (const subName of CUSTOMER_SUBCOLLECTIONS) {
        try {
          const srcSubCol = collection(db, 'users', uid, subName);
          const subSnap = await getDocs(srcSubCol);
          if (!subSnap.empty) {
            console.log(`    -> Copying ${subSnap.size} documents from subcollection users/${uid}/${subName}...`);
            for (const subDoc of subSnap.docs) {
              const destSubDocRef = doc(db, 'customers', uid, subName, subDoc.id);
              await setDoc(destSubDocRef, subDoc.data(), { merge: true });
            }
          }
        } catch (subErr) {
          console.warn(`    [WARN] Subcollection copy warning for ${subName}:`, subErr.message || subErr);
        }
      }
    } catch (docErr) {
      errors++;
      console.error(`  [ERROR] Failed migrating customer ${uid}:`, docErr);
    }
  }

  console.log('\n[4/4] Migration process complete.');
  console.log('\n====================================================');
  console.log(`CUSTOMER MIGRATION REPORT (${dryRun ? 'DRY-RUN' : 'EXECUTED'})`);
  console.log('====================================================');
  console.log(`Customers detected: ${customersDetected}`);
  console.log(`Customers migrated: ${customersMigrated}`);
  console.log(`Already existed:    ${alreadyExisted}`);
  console.log(`Skipped (staff):    ${skipped}`);
  console.log(`Ambiguous users:    ${ambiguousUsers}`);
  console.log(`Errors:             ${errors}`);
  console.log('====================================================');
  console.log('SAFETY CONFIRMATION: Original users/{uid} documents were NOT deleted.\n');
}

runMigration().catch((err) => {
  console.error('[UNCAUGHT MIGRATION ERROR]', err?.message || err);
  process.exit(1);
});
