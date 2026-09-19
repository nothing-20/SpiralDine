#!/usr/bin/env node

/**
 * ==============================================================================
 * SPIRALDINE — SECURE SUPER ADMIN BOOTSTRAP TOOL
 * ==============================================================================
 * 
 * Usage:
 *   node scripts/bootstrap-super-admin.js --email <admin-email>
 *   node scripts/bootstrap-super-admin.js --uid <firebase-uid>
 * 
 * Optional:
 *   --key <path-to-service-account.json>
 * 
 * This tool:
 * 1. Safely finds the authentic Firebase Authentication user.
 * 2. Verifies the user exists.
 * 3. Reads existing custom claims, preserving any unrelated claims.
 * 4. Authorizes canonical role: "super_admin" with custom claim: { role: 'super_admin', super_admin: true }.
 * 5. Synchronizes the user profile in Firestore: users/{uid} with role: "super_admin".
 * 6. Never exposes secrets or stores passwords.
 * ==============================================================================
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const parts = trimmed.split('=');
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

// Parse command-line flags
const args = process.argv.slice(2);
let targetEmail = null;
let targetUid = null;
let serviceAccountPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--email' && args[i + 1]) {
    targetEmail = args[i + 1].trim().toLowerCase();
    i++;
  } else if (args[i] === '--uid' && args[i + 1]) {
    targetUid = args[i + 1].trim();
    i++;
  } else if (args[i] === '--key' && args[i + 1]) {
    serviceAccountPath = path.resolve(args[i + 1].trim());
    i++;
  }
}

if (!targetEmail && !targetUid) {
  console.log(`
\x1b[33mSpiralDine Super Admin Bootstrap Utility\x1b[0m

\x1b[36mUsage:\x1b[0m
  node scripts/bootstrap-super-admin.js --email <admin-email>
  OR
  node scripts/bootstrap-super-admin.js --uid <firebase-uid>

\x1b[36mExamples:\x1b[0m
  node scripts/bootstrap-super-admin.js --email founder@spiraldine.internal
  node scripts/bootstrap-super-admin.js --uid 8dJ29xKa7...
`);
  process.exit(1);
}

// Locate service account credentials
let credential = null;
const possibleKeyPaths = [
  serviceAccountPath,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  path.resolve(__dirname, '../serviceAccountKey.json'),
  path.resolve(__dirname, '../service-account.json'),
  path.resolve(__dirname, '../../serviceAccountKey.json')
].filter(Boolean);

for (const p of possibleKeyPaths) {
  if (fs.existsSync(p)) {
    try {
      const fileData = JSON.parse(fs.readFileSync(p, 'utf-8'));
      credential = admin.credential.cert(fileData);
      console.log(`\x1b[32m✔ Loaded Firebase Service Account credentials from: ${p}\x1b[0m`);
      break;
    } catch (err) {
      console.warn(`Warning reading credentials from ${p}:`, err.message);
    }
  }
}

if (!credential && process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(parsed);
    console.log(`\x1b[32m✔ Loaded Firebase Service Account from FIREBASE_SERVICE_ACCOUNT env var.\x1b[0m`);
  } catch (err) {
    console.warn(`Warning parsing FIREBASE_SERVICE_ACCOUNT:`, err.message);
  }
}

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'spiral-restaurant-saas-v1';

try {
  if (admin.apps.length === 0) {
    if (credential) {
      admin.initializeApp({ credential, projectId });
    } else {
      console.log(`\x1b[33mℹ Initializing with default application credentials (Project: ${projectId})\x1b[0m`);
      admin.initializeApp({ projectId });
    }
  }
} catch (initErr) {
  console.error('\x1b[31m✖ Failed to initialize Firebase Admin SDK:\x1b[0m', initErr.message);
  console.log('\nTip: Provide your service account key file using:');
  console.log('  node scripts/bootstrap-super-admin.js --email <email> --key ./serviceAccountKey.json');
  process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

async function runBootstrap() {
  console.log('\n\x1b[36m=== SPIRALDINE SUPER ADMIN BOOTSTRAP ===\x1b[0m');
  console.log(`Targeting Firebase Project: \x1b[33m${projectId}\x1b[0m`);

  let userRecord;
  try {
    if (targetUid) {
      console.log(`Searching Firebase Auth by UID: ${targetUid}...`);
      userRecord = await auth.getUser(targetUid);
    } else {
      console.log(`Searching Firebase Auth by Email: ${targetEmail}...`);
      userRecord = await auth.getUserByEmail(targetEmail);
    }
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      console.error(`\n\x1b[31m✖ User not found in Firebase Authentication.\x1b[0m`);
      console.log(`Please ensure this user has signed up or exists in Firebase Authentication before assigning the Super Admin role.`);
      process.exit(1);
    }
    console.error(`\n\x1b[31m✖ Error fetching user:\x1b[0m`, err.message);
    process.exit(1);
  }

  console.log(`\x1b[32m✔ Found Firebase Authentication User:\x1b[0m`);
  console.log(`  UID:          ${userRecord.uid}`);
  console.log(`  Email:        ${userRecord.email}`);
  console.log(`  Display Name: ${userRecord.displayName || '(Not set)'}`);
  console.log(`  Disabled:     ${userRecord.disabled}`);

  // 1. Read existing claims to preserve unrelated claims
  const existingClaims = userRecord.customClaims || {};
  console.log(`  Current Claims:`, existingClaims);

  // 2. Set canonical super_admin authorization
  const updatedClaims = {
    ...existingClaims,
    role: 'super_admin',
    super_admin: true
  };

  console.log(`\nAssigning canonical Super Admin custom claims:`, updatedClaims);
  await auth.setCustomUserClaims(userRecord.uid, updatedClaims);
  console.log(`\x1b[32m✔ Firebase Auth custom claims updated successfully.\x1b[0m`);

  // 3. Update Firestore users collection profile
  console.log(`\nUpdating Firestore users/${userRecord.uid} profile...`);
  const userDocRef = db.collection('users').doc(userRecord.uid);
  const existingDoc = await userDocRef.get();

  const now = new Date().toISOString();
  if (existingDoc.exists) {
    await userDocRef.update({
      role: 'super_admin',
      status: 'active',
      department: 'Platform Administration',
      updatedAt: now
    });
    console.log(`\x1b[32m✔ Updated existing users/${userRecord.uid} doc to role: 'super_admin'.\x1b[0m`);
  } else {
    await userDocRef.set({
      uid: userRecord.uid,
      email: userRecord.email || targetEmail,
      displayName: userRecord.displayName || (userRecord.email ? userRecord.email.split('@')[0] : 'Super Admin'),
      role: 'super_admin',
      tenantId: '',
      branchId: '',
      department: 'Platform Administration',
      status: 'active',
      phoneNumber: userRecord.phoneNumber || '',
      createdAt: now,
      updatedAt: now
    });
    console.log(`\x1b[32m✔ Created users/${userRecord.uid} doc with role: 'super_admin'.\x1b[0m`);
  }

  console.log('\n\x1b[32m================================================================');
  console.log('SUCCESS: USER IS NOW AN AUTHORIZED SUPER ADMIN');
  console.log('================================================================\x1b[0m');
  console.log(`UID:      ${userRecord.uid}`);
  console.log(`Email:    ${userRecord.email}`);
  console.log(`Role:     super_admin`);
  console.log(`\nNext Steps:`);
  console.log(`1. User can now sign in at: https://spiral-dine.vercel.app/super-admin/login`);
  console.log(`2. If currently logged in, the user must log out and sign back in to refresh token claims.`);
  console.log('================================================================\n');

  process.exit(0);
}

runBootstrap().catch(err => {
  console.error('\x1b[31mBootstrap encountered an unexpected error:\x1b[0m', err);
  process.exit(1);
});
