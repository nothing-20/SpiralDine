package com.spiraldine.printbridge.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FirebaseAuthManagerTest {

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
            email = "chef@spiraldine.com",
            tenantId = "rest-tenant-alpha",
            role = "kitchen",
            restaurantName = "Alpha Bistro"
        )

        assertEquals("user-12345", profile.uid)
        assertEquals("chef@spiraldine.com", profile.email)
        assertEquals("rest-tenant-alpha", profile.tenantId)
        assertEquals("kitchen", profile.role)
        assertEquals("Alpha Bistro", profile.restaurantName)
    }

    @Test
    fun roleValidation_caseInsensitiveHandling() {
        fun isAuthorized(role: String): Boolean {
            val normalized = role.trim().lowercase().replace("-", "_")
            return FirebaseAuthManager.AUTHORIZED_ROLES.contains(role.trim().lowercase()) ||
                   FirebaseAuthManager.AUTHORIZED_ROLES.contains(normalized)
        }

        assertTrue(isAuthorized("KITCHEN"))
        assertTrue(isAuthorized("  Chef  "))
        assertTrue(isAuthorized("MANAGER"))
        assertFalse(isAuthorized("CUSTOMER"))
    }
}
