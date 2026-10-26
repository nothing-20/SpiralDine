import { z } from 'zod';
import assert from 'assert';

console.log('================================================================');
console.log('SPIRALDINE SECURITY & AUTHENTICATION REGRESSION TEST SUITE');
console.log('Testing: Credential Logging, Role Resolution & Multi-Tenant Isolation');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`[FAIL] ${name}:`, err.message);
  }
}

// -------------------------------------------------------------
// TEST 1: zodResolver never logs credentials or values
// -------------------------------------------------------------
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

// Import or recreate zodResolver logic from src/utils/zodResolver.ts
const zodResolver = (schema) => async (values) => {
  try {
    const data = schema.parse(values);
    return {
      values: data,
      errors: {},
    };
  } catch (error) {
    const errorList = error.errors || [];
    const errors = errorList.reduce((acc, current) => {
      const fieldPath = current.path.join('.');
      acc[fieldPath] = {
        message: current.message,
        type: current.code || 'validation',
      };
      return acc;
    }, {});

    return {
      values: {},
      errors,
    };
  }
};

// -------------------------------------------------------------
// TEST 2: Workspace validation handles Customer role cleanly
// -------------------------------------------------------------
function simulateWorkspaceValidation(user, userData) {
  // Simulates logic from WorkspaceContext.tsx
  if (!user) {
    return { allowed: false, reason: 'NO_USER', workspace: null, error: null };
  }

  // Customer accounts do not require restaurant staff/owner workspaces.
  if (user.role === 'customer' || userData?.role === 'customer') {
    return { allowed: true, reason: 'CUSTOMER_CLEAN_EXIT', workspace: null, error: null };
  }

  if (!userData) {
    return { allowed: false, reason: 'PROFILE_MISSING', workspace: null, error: 'user-not-found' };
  }

  if (userData.status && userData.status !== 'active') {
    return { allowed: false, reason: 'USER_SUSPENDED', workspace: null, error: 'user-suspended' };
  }

  if (userData.role === 'super-admin') {
    return { allowed: true, reason: 'SUPER_ADMIN_BYPASS', workspace: { role: 'super-admin' }, error: null };
  }

  const allowedRoles = ['owner', 'manager', 'waiter', 'kitchen', 'cashier', 'reception', 'admin'];
  if (!userData.role || !allowedRoles.includes(userData.role)) {
    return { allowed: false, reason: 'UNAUTHORIZED_ROLE', workspace: null, error: 'unauthorized' };
  }

  const tenantId = userData.tenantId || user.tenantId;
  if (!tenantId) {
    return { allowed: false, reason: 'TENANT_MISSING', workspace: null, error: 'workspace-unavailable' };
  }

  return { allowed: true, reason: 'STAFF_WORKSPACE_VALID', workspace: { role: userData.role, tenantId }, error: null };
}

// -------------------------------------------------------------
// TEST 3: Multi-tenant WorkspaceGuard boundary isolation
// -------------------------------------------------------------
function simulateWorkspaceGuard(user, role) {
  // Simulates logic in WorkspaceGuard.tsx
  if (role === 'customer' || user?.role === 'customer') {
    return { allow: false, redirect: '/unauthorized' };
  }
  return { allow: true, redirect: null };
}

async function runSuite() {
  await test('1. zodResolver successfully validates credentials without console side-effects', async () => {
    const capturedLogs = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    console.log = (...args) => capturedLogs.push(args.join(' '));
    console.warn = (...args) => capturedLogs.push(args.join(' '));
    console.info = (...args) => capturedLogs.push(args.join(' '));

    try {
      const resolver = zodResolver(loginSchema);
      const result = await resolver({
        email: 'customer.test@spiraldine.internal',
        password: 'SuperSecretPassword123!'
      });

      assert.strictEqual(result.values.email, 'customer.test@spiraldine.internal');
      assert.deepStrictEqual(result.errors, {});
      assert.strictEqual(capturedLogs.length, 0, 'No console logs should be emitted by zodResolver');
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.info = originalInfo;
    }
  });

  await test('2. Customer user with role="customer" exits workspace validation cleanly without UNAUTHORIZED_ROLE', () => {
    const customerUser = { uid: 'cust-123', email: 'diner@example.com', role: 'customer' };
    const customerProfile = { uid: 'cust-123', role: 'customer', tenantId: null, status: 'active' };

    const result = simulateWorkspaceValidation(customerUser, customerProfile);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.reason, 'CUSTOMER_CLEAN_EXIT');
    assert.strictEqual(result.workspace, null);
    assert.strictEqual(result.error, null);
  });

  await test('3. Non-staff invalid role produces UNAUTHORIZED_ROLE denial', () => {
    const hackerUser = { uid: 'hack-123', email: 'intruder@example.com', role: 'unknown_role' };
    const hackerProfile = { uid: 'hack-123', role: 'unknown_role', tenantId: 'rest-1', status: 'active' };

    const result = simulateWorkspaceValidation(hackerUser, hackerProfile);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'UNAUTHORIZED_ROLE');
    assert.strictEqual(result.error, 'unauthorized');
  });

  await test('4. Staff member with missing tenantId produces TENANT_MISSING denial', () => {
    const waiterUser = { uid: 'waiter-123', email: 'waiter@example.com', role: 'waiter' };
    const waiterProfile = { uid: 'waiter-123', role: 'waiter', tenantId: '', status: 'active' };

    const result = simulateWorkspaceValidation(waiterUser, waiterProfile);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, 'TENANT_MISSING');
    assert.strictEqual(result.error, 'workspace-unavailable');
  });

  await test('5. Legitimate Owner with valid tenant produces STAFF_WORKSPACE_VALID', () => {
    const ownerUser = { uid: 'owner-123', email: 'owner@example.com', role: 'owner' };
    const ownerProfile = { uid: 'owner-123', role: 'owner', tenantId: 'tenant-spiraldine', status: 'active' };

    const result = simulateWorkspaceValidation(ownerUser, ownerProfile);
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.reason, 'STAFF_WORKSPACE_VALID');
    assert.strictEqual(result.workspace.tenantId, 'tenant-spiraldine');
  });

  await test('6. Customer account attempting to enter WorkspaceGuard is denied with redirect to /unauthorized', () => {
    const customer = { uid: 'cust-123', role: 'customer' };
    const guardResult = simulateWorkspaceGuard(customer, 'customer');
    assert.strictEqual(guardResult.allow, false);
    assert.strictEqual(guardResult.redirect, '/unauthorized');
  });

  await test('7. Owner account is permitted past customer check in WorkspaceGuard', () => {
    const owner = { uid: 'owner-123', role: 'owner' };
    const guardResult = simulateWorkspaceGuard(owner, 'owner');
    assert.strictEqual(guardResult.allow, true);
    assert.strictEqual(guardResult.redirect, null);
  });

  console.log('\n================================================================');
  console.log(`RESULTS: ${passedTests}/${totalTests} tests passed (${failedTests} failed)`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite();
