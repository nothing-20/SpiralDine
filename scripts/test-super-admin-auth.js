/**
 * Automated Authorization Logic & Route Guard Verification
 */

function getDashboardRoute(role) {
  if (!role) {
    return '/unauthorized';
  }

  const normalizedRole = role.toLowerCase().trim().replace('_', '-');

  switch (normalizedRole) {
    case 'super-admin':
    case 'superadmin':
      return '/super-admin/dashboard';

    case 'owner':
    case 'admin':
    case 'restaurant-owner':
    case 'restaurantowner':
      return '/owner/dashboard';

    case 'manager':
      return '/dashboard/manager';

    case 'waiter':
      return '/dashboard/waiter';

    case 'kitchen':
      return '/dashboard/kitchen';

    case 'cashier':
      return '/dashboard/cashier';

    case 'reception':
      return '/dashboard/reception';

    case 'customer':
      return '/customer/home';

    default:
      return '/unauthorized';
  }
}

console.log('====================================================');
console.log('TESTING SUPER ADMIN AUTHORIZATION & ROUTING GATES');
console.log('====================================================\n');

let allPassed = true;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`\x1b[32m✔ PASS:\x1b[0m ${testName} ${details ? `(${details})` : ''}`);
  } else {
    console.error(`\x1b[31m✖ FAIL:\x1b[0m ${testName} ${details ? `(${details})` : ''}`);
    allPassed = false;
  }
}

// 1. Check getDashboardRoute
assert(getDashboardRoute('super_admin') === '/super-admin/dashboard', 'getDashboardRoute(super_admin)', 'routes to /super-admin/dashboard');
assert(getDashboardRoute('super-admin') === '/super-admin/dashboard', 'getDashboardRoute(super-admin)', 'routes to /super-admin/dashboard');
assert(getDashboardRoute('owner') === '/owner/dashboard', 'getDashboardRoute(owner)', 'routes to /owner/dashboard');
assert(getDashboardRoute('waiter') === '/dashboard/waiter', 'getDashboardRoute(waiter)', 'routes to /dashboard/waiter');
assert(getDashboardRoute('kitchen') === '/dashboard/kitchen', 'getDashboardRoute(kitchen)', 'routes to /dashboard/kitchen');
assert(getDashboardRoute('customer') === '/customer/home', 'getDashboardRoute(customer)', 'routes to /customer/home');
assert(getDashboardRoute(null) === '/unauthorized', 'getDashboardRoute(null)', 'routes to /unauthorized');

// 2. Simulate AdminGuard authorization logic
function evaluateAdminGuard(user, role) {
  if (!user || !role) {
    return { allowed: false, redirect: '/super-admin/login' };
  }
  const isSuperAdmin = role === 'super_admin' || role === 'super-admin';
  if (!isSuperAdmin) {
    const dest = getDashboardRoute(role);
    return { allowed: false, redirect: dest.startsWith('/super-admin') ? '/unauthorized' : dest };
  }
  return { allowed: true, redirect: null };
}

// TEST 1: Unauthenticated
const t1 = evaluateAdminGuard(null, null);
assert(!t1.allowed && t1.redirect === '/super-admin/login', 'TEST 1: Unauthenticated -> redirect /super-admin/login');

// TEST 2: Super Admin (canonical super_admin)
const t2a = evaluateAdminGuard({ uid: 'sa1' }, 'super_admin');
assert(t2a.allowed, 'TEST 2A: Super Admin (canonical super_admin) -> allowed');

// TEST 2B: Super Admin (legacy super-admin)
const t2b = evaluateAdminGuard({ uid: 'sa1' }, 'super-admin');
assert(t2b.allowed, 'TEST 2B: Super Admin (alias super-admin) -> allowed');

// TEST 3: Owner access
const t3 = evaluateAdminGuard({ uid: 'owner1' }, 'owner');
assert(!t3.allowed && t3.redirect === '/owner/dashboard', 'TEST 3: Owner -> access denied, redirect to /owner/dashboard');

// TEST 4: Waiter access
const t4 = evaluateAdminGuard({ uid: 'waiter1' }, 'waiter');
assert(!t4.allowed && t4.redirect === '/dashboard/waiter', 'TEST 4: Waiter -> access denied, redirect to /dashboard/waiter');

// TEST 5: Kitchen access
const t5 = evaluateAdminGuard({ uid: 'kitchen1' }, 'kitchen');
assert(!t5.allowed && t5.redirect === '/dashboard/kitchen', 'TEST 5: Kitchen -> access denied, redirect to /dashboard/kitchen');

// TEST 6: Customer access
const t6 = evaluateAdminGuard({ uid: 'cust1' }, 'customer');
assert(!t6.allowed && t6.redirect === '/customer/home', 'TEST 6: Customer -> access denied, redirect to /customer/home');

// TEST 7: Logout simulation
const t7 = evaluateAdminGuard(null, null);
assert(!t7.allowed && t7.redirect === '/super-admin/login', 'TEST 7: Post-logout -> redirects to /super-admin/login');

console.log('\n====================================================');
if (allPassed) {
  console.log('\x1b[32mALL AUTHORIZATION & ROUTE GUARD TESTS PASSED!\x1b[0m');
  process.exit(0);
} else {
  console.error('\x1b[31mSOME TESTS FAILED!\x1b[0m');
  process.exit(1);
}
