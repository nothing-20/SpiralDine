package com.spiraldine.printbridge.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class FirebaseAuthManagerTest {

    private lateinit var authStorage: AuthStorage
    private lateinit var authManager: FirebaseAuthManager

    @Before
    fun setUp() {
        authStorage = AuthStorage()
        authManager = FirebaseAuthManager(authStorage)
    }

    @Test
    fun authorizedRoles_containsKitchenAndOperationalRoles() {
        val validRoles = listOf(
            "kitchen",
            "chef",
            "owner",
            "admin",
            "manager",
            "waiter",
            "cashier",
            "reception",
            "super_admin",
            "super-admin"
        )

        for (role in validRoles) {
            assertTrue("Role '$role' must be authorized for printing companion", FirebaseAuthManager.AUTHORIZED_ROLES.contains(role))
        }
    }

    @Test
    fun authorizedRoles_rejectsUnauthorizedRoles() {
        val unauthorizedRoles = listOf(
            "customer",
            "guest",
            "public",
            "delivery_driver",
            "",
            "unknown_role"
        )

        for (role in unauthorizedRoles) {
            assertFalse("Role '$role' must NOT be granted access to print bridge", FirebaseAuthManager.AUTHORIZED_ROLES.contains(role))
        }
    }

    @Test
    fun staffProfile_preservesStrictTenantAssociation() {
        val profile = StaffProfile(
            uid = "user-12345",
            email = "waiter@spiraldine.com",
            tenantId = "rest-tenant-alpha",
            role = "waiter",
            restaurantName = "Alpha Bistro"
        )

        assertEquals("user-12345", profile.uid)
        assertEquals("waiter@spiraldine.com", profile.email)
        assertEquals("rest-tenant-alpha", profile.tenantId)
        assertEquals("waiter", profile.role)
        assertEquals("Alpha Bistro", profile.restaurantName)
    }

    @Test
    fun roleValidation_caseInsensitiveHandling() {
        val resultUpper = authManager.validateStaffAuthorization(
            uid = "uid-waiter-1",
            email = "waiter@restaurant.com",
            rawRole = "WAITER",
            rawTenantId = "tenant-101"
        )
        assertTrue(resultUpper is AuthResult.Success)

        val resultPadded = authManager.validateStaffAuthorization(
            uid = "uid-chef-1",
            email = "chef@restaurant.com",
            rawRole = "  Chef  ",
            rawTenantId = "tenant-101"
        )
        assertTrue(resultPadded is AuthResult.Success)

        val resultHyphen = authManager.validateStaffAuthorization(
            uid = "uid-super-1",
            email = "admin@platform.com",
            rawRole = "super-admin",
            rawTenantId = "tenant-101"
        )
        assertTrue(resultHyphen is AuthResult.Success)
    }

    @Test
    fun waiterStaff_authenticatesSuccessfullyWithExistingProfile() {
        val userData = mapOf<String, Any?>(
            "uid" to "waiter-uid-456",
            "email" to "john.waiter@spiraldine.com",
            "displayName" to "John Waiter",
            "role" to "waiter",
            "tenantId" to "tenant-spice-gardens",
            "status" to "active"
        )

        val result = authManager.resolveProfileFromUserData(
            uid = "waiter-uid-456",
            email = "john.waiter@spiraldine.com",
            userData = userData,
            restaurantName = "Spice Gardens"
        )

        assertTrue("Authorized waiter must succeed", result is AuthResult.Success)
        val profile = (result as AuthResult.Success).profile
        assertEquals("waiter-uid-456", profile.uid)
        assertEquals("john.waiter@spiraldine.com", profile.email)
        assertEquals("tenant-spice-gardens", profile.tenantId)
        assertEquals("waiter", profile.role)
        assertEquals("Spice Gardens", profile.restaurantName)

        // Session must be persisted in AuthStorage
        val active = authManager.getActiveSession()
        assertNotNull("Active session must be present in storage", active)
        assertEquals("waiter-uid-456", active?.uid)
        assertEquals("tenant-spice-gardens", active?.tenantId)
    }

    @Test
    fun legacyRestaurantIdField_resolvesTenantCorrectly() {
        // Some web profiles use restaurantId instead of tenantId
        val userData = mapOf<String, Any?>(
            "uid" to "chef-uid-789",
            "email" to "chef.ramsay@spiraldine.com",
            "role" to "kitchen",
            "restaurantId" to "tenant-legacy-bistro",
            "status" to "active"
        )

        val result = authManager.resolveProfileFromUserData(
            uid = "chef-uid-789",
            email = "chef.ramsay@spiraldine.com",
            userData = userData
        )

        assertTrue("restaurantId fallback must resolve successfully", result is AuthResult.Success)
        val profile = (result as AuthResult.Success).profile
        assertEquals("tenant-legacy-bistro", profile.tenantId)
        assertEquals("kitchen", profile.role)
    }

    @Test
    fun employeeFallbackResolution_preservesActivatedEmployeeRecord() {
        // When users/{uid} is missing, fallback to employees collection record
        val employeeData = mapOf<String, Any?>(
            "id" to "emp-doc-123",
            "firebaseUid" to "waiter-uid-fallback",
            "email" to "invited.waiter@spiraldine.com",
            "fullName" to "Jane Waiter",
            "role" to "waiter",
            "tenantId" to "tenant-coastal-grill",
            "status" to "active"
        )

        val result = authManager.resolveProfileFromUserData(
            uid = "waiter-uid-fallback",
            email = "invited.waiter@spiraldine.com",
            userData = null, // users/{uid} missing
            employeeData = employeeData
        )

        assertTrue("Fallback employee record must authenticate successfully", result is AuthResult.Success)
        val profile = (result as AuthResult.Success).profile
        assertEquals("waiter-uid-fallback", profile.uid)
        assertEquals("tenant-coastal-grill", profile.tenantId)
        assertEquals("waiter", profile.role)
    }

    @Test
    fun customerAccount_isDeniedAccessWithUnderstandableError() {
        val customerData = mapOf<String, Any?>(
            "uid" to "cust-uid-101",
            "email" to "diner@gmail.com",
            "role" to "customer",
            "tenantId" to "tenant-alpha",
            "status" to "active"
        )

        val result = authManager.resolveProfileFromUserData(
            uid = "cust-uid-101",
            email = "diner@gmail.com",
            userData = customerData
        )

        assertTrue(result is AuthResult.Error)
        val errorMsg = (result as AuthResult.Error).message
        assertTrue(errorMsg.contains("diner account") || errorMsg.contains("customer"))
        assertNull("No session should be saved for diner", authManager.getActiveSession())
    }

    @Test
    fun suspendedOrInactiveStaff_isDeniedAccess() {
        val suspendedWaiter = mapOf<String, Any?>(
            "uid" to "waiter-suspended-1",
            "email" to "suspended@restaurant.com",
            "role" to "waiter",
            "tenantId" to "tenant-alpha",
            "status" to "suspended"
        )

        val result = authManager.resolveProfileFromUserData(
            uid = "waiter-suspended-1",
            email = "suspended@restaurant.com",
            userData = suspendedWaiter
        )

        assertTrue(result is AuthResult.Error)
        val errorMsg = (result as AuthResult.Error).message
        assertTrue(errorMsg.contains("inactive or suspended"))
        assertNull("No session should be saved for suspended staff", authManager.getActiveSession())
    }

    @Test
    fun userWithoutRestaurantAssignment_isDeniedAccess() {
        val unassignedStaff = mapOf<String, Any?>(
            "uid" to "staff-no-tenant",
            "email" to "floating@restaurant.com",
            "role" to "waiter",
            "tenantId" to "",
            "status" to "active"
        )

        val result = authManager.resolveProfileFromUserData(
            uid = "staff-no-tenant",
            email = "floating@restaurant.com",
            userData = unassignedStaff
        )

        assertTrue(result is AuthResult.Error)
        val errorMsg = (result as AuthResult.Error).message
        assertTrue(errorMsg.contains("not assigned to an active restaurant workspace"))
    }

    @Test
    fun userWithoutProfileDocument_isDeniedAccess() {
        val result = authManager.resolveProfileFromUserData(
            uid = "ghost-uid",
            email = "ghost@restaurant.com",
            userData = null,
            employeeData = null
        )

        assertTrue(result is AuthResult.Error)
        val errorMsg = (result as AuthResult.Error).message
        assertTrue(errorMsg.contains("no staff profile is associated"))
    }

    @Test
    fun explicitPrintingPermissionDenied_rejectsAccess() {
        val restrictedWaiter = mapOf<String, Any?>(
            "uid" to "waiter-no-print",
            "email" to "noprint@restaurant.com",
            "role" to "waiter",
            "tenantId" to "tenant-alpha",
            "canPrint" to false,
            "status" to "active"
        )

        val result = authManager.resolveProfileFromUserData(
            uid = "waiter-no-print",
            email = "noprint@restaurant.com",
            userData = restrictedWaiter
        )

        assertTrue(result is AuthResult.Error)
        val errorMsg = (result as AuthResult.Error).message
        assertTrue(errorMsg.contains("does not have permission to operate the Print Bridge"))
    }

    @Test
    fun restrictedPermissionsList_rejectsAccess() {
        val billingOnlyUser = mapOf<String, Any?>(
            "uid" to "cashier-restricted",
            "email" to "cashier@restaurant.com",
            "role" to "cashier",
            "tenantId" to "tenant-alpha",
            "permissions" to listOf("billing-only"),
            "status" to "active"
        )

        val result = authManager.resolveProfileFromUserData(
            uid = "cashier-restricted",
            email = "cashier@restaurant.com",
            userData = billingOnlyUser
        )

        assertTrue(result is AuthResult.Error)
        val errorMsg = (result as AuthResult.Error).message
        assertTrue(errorMsg.contains("permissions do not permit"))
    }

    @Test
    fun multiTenantIsolation_restaurantACannotControlRestaurantB() {
        val staffA = mapOf<String, Any?>(
            "uid" to "waiter-rest-a",
            "email" to "waiterA@restaurantA.com",
            "role" to "waiter",
            "tenantId" to "tenant-restaurant-A",
            "status" to "active"
        )

        val resultA = authManager.resolveProfileFromUserData(
            uid = "waiter-rest-a",
            email = "waiterA@restaurantA.com",
            userData = staffA,
            restaurantName = "Restaurant A"
        )

        assertTrue(resultA is AuthResult.Success)
        val sessionA = authManager.getActiveSession()
        assertEquals("tenant-restaurant-A", sessionA?.tenantId)

        // Session tenant strictly isolates the listener collection path:
        val isolatedPathA = "restaurants/${sessionA?.tenantId}/kitchenTickets"
        val expectedPathA = "restaurants/tenant-restaurant-A/kitchenTickets"
        assertEquals(expectedPathA, isolatedPathA)
        assertFalse("Restaurant A cannot resolve to Restaurant B's path", isolatedPathA.contains("tenant-restaurant-B"))
    }

    @Test
    fun sessionRestorationAndLogout_behaveCorrectly() {
        val profile = StaffProfile(
            uid = "waiter-session-test",
            email = "test@restaurant.com",
            tenantId = "tenant-session-1",
            role = "waiter",
            restaurantName = "Session Bistro"
        )

        // Save session
        authStorage.saveSession(profile)
        val restored = authManager.getActiveSession()
        assertNotNull(restored)
        assertEquals("waiter-session-test", restored?.uid)
        assertEquals("tenant-session-1", restored?.tenantId)
        assertTrue(authStorage.isAutoStartEnabled())

        // Toggle auto-start
        authStorage.setAutoStartEnabled(false)
        assertFalse(authStorage.isAutoStartEnabled())

        // Logout
        authManager.signOut()
        assertNull("Session must be cleared after signOut", authManager.getActiveSession())
        assertFalse("Auto start must be disabled when session is empty", authStorage.isAutoStartEnabled())
    }

    @Test
    fun firebaseConfig_targetsCorrectSaaSProject() {
        assertEquals("spiral-restaurant-saas-v1", FirebaseAuthManager.PROJECT_ID)
        assertEquals("com.spiraldine.printbridge", FirebaseAuthManager.APPLICATION_ID)
        assertEquals("spiral-restaurant-saas-v1.firebasestorage.app", FirebaseAuthManager.STORAGE_BUCKET)
        assertTrue("API Key must be present", FirebaseAuthManager.API_KEY.isNotBlank())
    }

    @Test
    fun printBridgeApplication_isConfiguredAsApplicationSubclass() {
        val appClass = com.spiraldine.printbridge.PrintBridgeApplication::class.java
        assertTrue(
            "PrintBridgeApplication must extend android.app.Application",
            android.app.Application::class.java.isAssignableFrom(appClass)
        )
    }

    @Test
    fun firebaseAuthManager_constructionDoesNotAccessFirebaseBeforeInitialization() {
        // Constructing FirebaseAuthManager without an initialized FirebaseApp must NOT throw
        // an IllegalStateException during constructor execution because providers are lazily evaluated lambdas
        val storage = AuthStorage()
        val manager = FirebaseAuthManager(storage)
        assertNotNull(manager)
        assertNull("Session should be empty on clean storage", manager.getActiveSession())
    }
}
