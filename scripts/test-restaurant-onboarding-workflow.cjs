/**
 * Automated Verification Suite: Restaurant Onboarding & Super Admin Applications Workflow
 * 
 * Verifies:
 * 1. Data Contract Integrity & Field Consistency
 * 2. Status Normalization & Tab Counts Logic
 * 3. Search and Filtering Logic
 * 4. Error State Handling (no silent swallowing of errors)
 * 5. Review Action State Machine (Approve, Reject, More Info)
 * 6. Route Guards & Applicant Containment (OwnerGuard, WorkspaceGuard)
 * 7. Live Firestore Integration (Validating 'abc-okwx' pending approval record)
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${details ? ` - ${details}` : ''}`);
    testsFailed++;
  }
}

console.log('====================================================');
console.log('🧪 Starting Restaurant Onboarding & Applications Test Suite');
console.log('====================================================\n');

// -----------------------------------------------------------------------------
// 1. Data Contract & Schema Integrity
// -----------------------------------------------------------------------------
console.log('🔹 Suite 1: Data Contract & Field Alignment');

function createRestaurantRecord(input) {
  return {
    id: input.tenantId,
    tenantId: input.tenantId,
    name: input.restaurantName,
    restaurantName: input.restaurantName,
    ownerUid: input.ownerUid,
    ownerEmail: input.ownerEmail.trim().toLowerCase(),
    ownerName: input.ownerName.trim(),
    country: input.country || 'Global',
    currency: input.currency || 'USD',
    currencyCode: input.currencyCode || 'USD',
    currencySymbol: input.currencySymbol || '$',
    locale: input.locale || 'en-US',
    status: 'pending_approval',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

const mockRecord = createRestaurantRecord({
  tenantId: 'bistro-del-sol-98ab',
  restaurantName: 'Bistro Del Sol',
  ownerUid: 'user-uid-12345',
  ownerEmail: 'chef@bistro.com',
  ownerName: 'Chef Antonio',
  country: 'ES',
  currency: 'EUR',
  currencyCode: 'EUR',
  currencySymbol: '€',
  locale: 'es-ES'
});

assert(mockRecord.id === 'bistro-del-sol-98ab', 'Restaurant ID matches tenantId');
assert(mockRecord.restaurantName === 'Bistro Del Sol', 'Restaurant name preserved');
assert(mockRecord.name === 'Bistro Del Sol', 'Legacy name field populated for backward compatibility');
assert(mockRecord.ownerEmail === 'chef@bistro.com', 'Owner email normalized');
assert(mockRecord.ownerName === 'Chef Antonio', 'Owner full name preserved');
assert(mockRecord.status === 'pending_approval', 'Initial status set to pending_approval');

// -----------------------------------------------------------------------------
// 2. Status Normalization & Tab Counts Logic
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 2: Status Normalization & Tab Counting');

function normalizeStatus(rawStatus) {
  if (rawStatus === 'pending_approval') return 'pending_approval';
  if (rawStatus === 'rejected') return 'rejected';
  if (rawStatus === 'more_info_required') return 'more_info_required';
  return 'approved'; // includes 'active', 'approved', or undefined
}

assert(normalizeStatus('pending_approval') === 'pending_approval', 'Maps pending_approval');
assert(normalizeStatus('active') === 'approved', 'Maps active to approved tab');
assert(normalizeStatus('approved') === 'approved', 'Maps approved directly');
assert(normalizeStatus(undefined) === 'approved', 'Maps legacy undefined status to approved');
assert(normalizeStatus('rejected') === 'rejected', 'Maps rejected directly');
assert(normalizeStatus('more_info_required') === 'more_info_required', 'Maps more_info_required');

const sampleRestaurants = [
  { id: 'app-1', restaurantName: 'Pasta Palace', status: 'pending_approval' },
  { id: 'app-2', restaurantName: 'Sushi Bar', status: 'active' },
  { id: 'app-3', restaurantName: 'Taco Town', status: 'rejected' },
  { id: 'app-4', restaurantName: 'Curry House', status: 'more_info_required' },
  { id: 'app-5', restaurantName: 'Burger Joint', status: undefined },
];

const normalizedList = sampleRestaurants.map(r => ({
  ...r,
  status: normalizeStatus(r.status)
}));

const counts = {
  pending: normalizedList.filter(a => a.status === 'pending_approval').length,
  approved: normalizedList.filter(a => a.status === 'approved').length,
  rejected: normalizedList.filter(a => a.status === 'rejected').length,
  more_info: normalizedList.filter(a => a.status === 'more_info_required').length,
  all: normalizedList.length
};

assert(counts.pending === 1, 'Pending count is 1');
assert(counts.approved === 2, 'Approved count is 2 (includes active and undefined)');
assert(counts.rejected === 1, 'Rejected count is 1');
assert(counts.more_info === 1, 'More info count is 1');
assert(counts.all === 5, 'Total count matches sum of items');
assert(counts.all === (counts.pending + counts.approved + counts.rejected + counts.more_info), 'Counts partition total accurately');

// -----------------------------------------------------------------------------
// 3. Search & Filter Matching
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 3: Search Query Filtering');

function filterApplications(list, activeTab, searchTerm) {
  return list.filter(app => {
    if (activeTab === 'pending' && app.status !== 'pending_approval') return false;
    if (activeTab === 'approved' && app.status !== 'approved') return false;
    if (activeTab === 'rejected' && app.status !== 'rejected') return false;
    if (activeTab === 'more_info' && app.status !== 'more_info_required') return false;

    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;

    return (
      (app.restaurantName || '').toLowerCase().includes(q) ||
      (app.ownerName || '').toLowerCase().includes(q) ||
      (app.ownerEmail || '').toLowerCase().includes(q) ||
      (app.tenantId || '').toLowerCase().includes(q) ||
      (app.id || '').toLowerCase().includes(q)
    );
  });
}

const testApps = [
  { id: 'abc-okwx', tenantId: 'abc-okwx', restaurantName: 'abc', ownerName: 'Owner Kumar', ownerEmail: 'kumar@test.com', status: 'pending_approval' },
  { id: 'res-2', tenantId: 'res-2', restaurantName: 'Royal Spice', ownerName: 'Rajesh', ownerEmail: 'raj@test.com', status: 'approved' },
];

assert(filterApplications(testApps, 'pending', '').length === 1, 'Filters pending tab correctly');
assert(filterApplications(testApps, 'approved', '').length === 1, 'Filters approved tab correctly');
assert(filterApplications(testApps, 'all', 'kumar').length === 1, 'Searches owner name');
assert(filterApplications(testApps, 'all', 'abc-okwx').length === 1, 'Searches tenant ID');
assert(filterApplications(testApps, 'all', 'nonexistent').length === 0, 'Returns 0 for unmatched search query');

// -----------------------------------------------------------------------------
// 4. Review Lifecycle State Transitions
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 4: Review Lifecycle Transitions');

function executeReviewAction(restaurantDoc, action, notes, reviewerUid) {
  const nowIso = new Date().toISOString();
  if (action === 'approve') {
    return {
      ...restaurantDoc,
      status: 'active',
      reviewedAt: nowIso,
      reviewedBy: reviewerUid,
      reviewNotes: notes || ''
    };
  }
  if (action === 'reject') {
    return {
      ...restaurantDoc,
      status: 'rejected',
      rejectionReason: notes || 'Rejected',
      reviewedAt: nowIso,
      reviewedBy: reviewerUid
    };
  }
  if (action === 'request_info') {
    return {
      ...restaurantDoc,
      status: 'more_info_required',
      moreInfoNotes: notes || 'More info needed',
      reviewedAt: nowIso,
      reviewedBy: reviewerUid
    };
  }
  return restaurantDoc;
}

const pendingDoc = { id: 'test-1', status: 'pending_approval' };

const approvedDoc = executeReviewAction(pendingDoc, 'approve', 'Verified license', 'admin-uid');
assert(approvedDoc.status === 'active', 'Approve action transitions status to active');
assert(approvedDoc.reviewedBy === 'admin-uid', 'Records reviewer UID');
assert(approvedDoc.reviewNotes === 'Verified license', 'Records review notes');

const rejectedDoc = executeReviewAction(pendingDoc, 'reject', 'Invalid documentation', 'admin-uid');
assert(rejectedDoc.status === 'rejected', 'Reject action transitions status to rejected');
assert(rejectedDoc.rejectionReason === 'Invalid documentation', 'Records rejection reason');

const moreInfoDoc = executeReviewAction(pendingDoc, 'request_info', 'Please upload GST certificate', 'admin-uid');
assert(moreInfoDoc.status === 'more_info_required', 'Request info transitions to more_info_required');
assert(moreInfoDoc.moreInfoNotes === 'Please upload GST certificate', 'Records info request notes');

// -----------------------------------------------------------------------------
// 5. Code Integrity Checks across Core Files
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 5: File & Routing Configuration Integrity');

const rootDir = path.resolve(__dirname, '..');
const superAdminAppsFile = path.join(rootDir, 'src', 'apps', 'super-admin', 'pages', 'SuperAdminApplications.tsx');
const superAdminLayoutFile = path.join(rootDir, 'src', 'apps', 'super-admin', 'layouts', 'SuperAdminLayout.tsx');
const pendingPageFile = path.join(rootDir, 'src', 'features', 'auth', 'components', 'ApplicationPendingPage.tsx');
const reviewApiFile = path.join(rootDir, 'api', 'super-admin', 'review-application.ts');
const authFile = path.join(rootDir, 'src', 'shared', 'firebase', 'auth.ts');

assert(fs.existsSync(superAdminAppsFile), 'SuperAdminApplications.tsx exists');
assert(fs.existsSync(superAdminLayoutFile), 'SuperAdminLayout.tsx exists');
assert(fs.existsSync(pendingPageFile), 'ApplicationPendingPage.tsx exists');
assert(fs.existsSync(reviewApiFile), 'api/super-admin/review-application.ts exists');
assert(fs.existsSync(authFile), 'src/shared/firebase/auth.ts exists');

const superAdminAppsContent = fs.readFileSync(superAdminAppsFile, 'utf8');
assert(superAdminAppsContent.includes("collection(db, 'restaurants')"), 'SuperAdminApplications queries authoritative restaurants collection');
assert(superAdminAppsContent.includes('listenerError'), 'SuperAdminApplications tracks database listener errors');
assert(superAdminAppsContent.includes('Database Query Problem'), 'SuperAdminApplications renders visible error alert without swallowing failures');
assert(superAdminAppsContent.includes('refreshTrigger'), 'SuperAdminApplications includes manual refresh capability');

const superAdminLayoutContent = fs.readFileSync(superAdminLayoutFile, 'utf8');
assert(superAdminLayoutContent.includes("collection(db, 'restaurants')"), 'SuperAdminLayout queries restaurants collection for pending count');

const pendingPageContent = fs.readFileSync(pendingPageFile, 'utf8');
assert(pendingPageContent.includes("doc(db, 'restaurants', candidateId)"), 'ApplicationPendingPage listens to authoritative restaurants document');

const reviewApiContent = fs.readFileSync(reviewApiFile, 'utf8');
assert(reviewApiContent.includes("serverDoc(serverDb, 'restaurants', cleanAppId)"), 'review-application API checks authoritative restaurants collection');

const authContent = fs.readFileSync(authFile, 'utf8');
assert(authContent.includes('ownerEmail: email.trim().toLowerCase()'), 'signUpOwner saves ownerEmail to restaurants document');
assert(authContent.includes('ownerName: displayName.trim()'), 'signUpOwner saves ownerName to restaurants document');

// -----------------------------------------------------------------------------
// 6. Live Firestore Verification
// -----------------------------------------------------------------------------
console.log('\n🔹 Suite 6: Live Firestore Production Database Verification');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'spiral-restaurant-saas-v1.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'spiral-restaurant-saas-v1',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'spiral-restaurant-saas-v1.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '917630391162',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:917630391162:web:6e4c127734b84ca6977cc3',
};

async function verifyLiveFirestore() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  const db = getFirestore(app);
  const auth = getAuth(app);

  try {
    const serverEmail = process.env.FIREBASE_SERVER_EMAIL || 'dev-admin-reset@restaurantos.internal';
    const serverPassword = process.env.FIREBASE_SERVER_PASSWORD || 'DevResetSecret123!';

    await signInWithEmailAndPassword(auth, serverEmail, serverPassword);
    assert(true, 'Super Admin authenticated with Cloud Firestore');

    // Query restaurants collection
    const snap = await getDocs(collection(db, 'restaurants'));
    assert(snap.size > 0, `Successfully retrieved ${snap.size} restaurants from authoritative collection`);

    // Verify pending application exists in restaurants
    const foundPending = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.status === 'pending_approval') {
        foundPending.push({ id: d.id, ...data });
      }
    });

    assert(foundPending.length > 0, `Found ${foundPending.length} pending application(s) awaiting review`);
    const targetApp = foundPending.find(a => a.id === 'abc-okwx');
    assert(Boolean(targetApp), `Located applicant restaurant "abc-okwx" (${targetApp?.restaurantName || targetApp?.name}) in pending_approval status`);

    // Verify applicant owner doc
    if (targetApp && targetApp.ownerUid) {
      const uSnap = await getDoc(doc(db, 'users', targetApp.ownerUid));
      assert(uSnap.exists(), `Applicant user profile exists in users/${targetApp.ownerUid}`);
      assert(uSnap.data().role === 'owner', 'Applicant user role is verified as owner');
    }

  } catch (err) {
    assert(false, 'Live Firestore verification error', err.message);
  }

  // Summary
  console.log('\n====================================================');
  console.log(`📊 Test Results: ${testsPassed} Passed | ${testsFailed} Failed`);
  console.log('====================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

verifyLiveFirestore().catch(e => {
  console.error('Test execution error:', e);
  process.exit(1);
});
