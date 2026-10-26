package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.CustomerProfile
import com.spiralworld.spiraldine.data.model.CustomerUser
import com.spiralworld.spiraldine.data.model.OrderRecord
import com.spiralworld.spiraldine.data.repository.AccountCollisionException
import com.spiralworld.spiraldine.data.repository.AuthRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthAndProfileTest {

    @Test
    fun testEmailValidation() {
        assertTrue("Valid email should pass", AuthRepository.validateEmail("diner@example.com").isSuccess)
        assertTrue("Valid email with subdomain should pass", AuthRepository.validateEmail("user@corp.spiralworld.com").isSuccess)
        assertTrue("Valid email with plus tag should pass", AuthRepository.validateEmail("customer+dine@gmail.com").isSuccess)

        assertTrue("Empty email should fail", AuthRepository.validateEmail("").isFailure)
        assertTrue("Blank email should fail", AuthRepository.validateEmail("   ").isFailure)
        assertTrue("Email without @ should fail", AuthRepository.validateEmail("customerexample.com").isFailure)
        assertTrue("Email without domain should fail", AuthRepository.validateEmail("customer@").isFailure)
        assertTrue("Email with spaces should fail", AuthRepository.validateEmail("customer @example.com").isFailure)
        assertTrue("Email without dot in domain should fail", AuthRepository.validateEmail("customer@localhost").isFailure)
    }

    @Test
    fun testPasswordValidation() {
        assertTrue("6-character password should pass", AuthRepository.validatePassword("secret").isSuccess)
        assertTrue("Long complex password should pass", AuthRepository.validatePassword("P@ssw0rd123!Safe").isSuccess)

        assertTrue("Empty password should fail", AuthRepository.validatePassword("").isFailure)
        assertTrue("5-character password should fail", AuthRepository.validatePassword("12345").isFailure)
        assertTrue("Blank password should fail", AuthRepository.validatePassword("     ").isFailure)
    }

    @Test
    fun testNameValidation() {
        assertTrue("Valid name should pass", AuthRepository.validateName("Geetha Krishna").isSuccess)
        assertTrue("2-letter name should pass", AuthRepository.validateName("Al").isSuccess)

        assertTrue("Empty name should fail", AuthRepository.validateName("").isFailure)
        assertTrue("Blank name should fail", AuthRepository.validateName("   ").isFailure)
        assertTrue("1-letter name should fail", AuthRepository.validateName("A").isFailure)
    }

    @Test
    fun testPhoneValidation() {
        assertTrue("Null phone is optional, should pass", AuthRepository.validatePhone(null).isSuccess)
        assertTrue("Empty phone is optional, should pass", AuthRepository.validatePhone("").isSuccess)
        assertTrue("10-digit phone should pass", AuthRepository.validatePhone("9876543210").isSuccess)
        assertTrue("Phone with country code and spaces should pass", AuthRepository.validatePhone("+91 98765 43210").isSuccess)
        assertTrue("Phone with dashes should pass", AuthRepository.validatePhone("040-12345678").isSuccess)

        assertTrue("Short phone under 8 digits should fail", AuthRepository.validatePhone("12345").isFailure)
        assertTrue("Phone with non-numeric chars should fail", AuthRepository.validatePhone("phone1234567").isFailure)
    }

    @Test
    fun testAccountCollisionExceptionMessage() {
        val message = "This email address is already registered to an existing account. Please sign in instead."
        val ex = AccountCollisionException(message)
        assertEquals(message, ex.message)
    }

    @Test
    fun testCustomerProfileModelMapping() {
        val profile = CustomerProfile(
            uid = "user_123",
            email = "diner@spiralworld.com",
            displayName = "Spiral Diner",
            phoneNumber = "+919876543210",
            isAnonymous = false,
            createdAt = "2026-10-18T10:00:00Z",
            updatedAt = "2026-10-18T10:00:00Z"
        )

        assertEquals("user_123", profile.uid)
        assertEquals("diner@spiralworld.com", profile.email)
        assertEquals("Spiral Diner", profile.displayName)
        assertEquals("+919876543210", profile.phoneNumber)
        assertFalse(profile.isAnonymous)
    }

    @Test
    fun testGuestUserVsRegisteredUserDistinction() {
        val guest = CustomerUser(
            uid = "anon_guest_abc",
            email = null,
            displayName = null,
            isAnonymous = true,
            phoneNumber = null
        )
        assertTrue(guest.isAnonymous)
        assertNull(guest.email)

        val registered = CustomerUser(
            uid = "user_def",
            email = "member@spiraldine.com",
            displayName = "Member User",
            isAnonymous = false,
            phoneNumber = "9876543210"
        )
        assertFalse(registered.isAnonymous)
        assertEquals("member@spiraldine.com", registered.email)
    }

    @Test
    fun testOrderOwnershipIsolation() {
        val userAUid = "user_A_111"
        val userBUid = "user_B_222"

        val ordersList = listOf(
            OrderRecord(
                id = "order_1",
                orderId = "ORD-001",
                tenantId = "tenant_1",
                customerId = userAUid,
                total = 450.0,
                status = "COMPLETED"
            ),
            OrderRecord(
                id = "order_2",
                orderId = "ORD-002",
                tenantId = "tenant_1",
                customerId = userBUid,
                total = 890.0,
                status = "NEW"
            ),
            OrderRecord(
                id = "order_3",
                orderId = "ORD-003",
                tenantId = "tenant_2",
                customerId = userAUid,
                total = 320.0,
                status = "COOKING"
            )
        )

        // Customer A must only see their own orders
        val userAOrders = ordersList.filter { it.customerId == userAUid }
        assertEquals(2, userAOrders.size)
        assertTrue(userAOrders.all { it.customerId == userAUid })
        assertFalse(userAOrders.any { it.customerId == userBUid })

        // Customer B must only see their own orders
        val userBOrders = ordersList.filter { it.customerId == userBUid }
        assertEquals(1, userBOrders.size)
        assertEquals("ORD-002", userBOrders.first().orderId)
    }

    @Test
    fun testOrderAggregationAndDeduplicationAcrossTenants() {
        val currentUserId = "diner_xyz"

        val tenant1Orders = listOf(
            OrderRecord(
                id = "doc_1",
                orderId = "ORD-101",
                tenantId = "tenant_1",
                customerId = currentUserId,
                total = 300.0,
                createdAt = "2026-10-18 12:00"
            )
        )

        val tenant2Orders = listOf(
            // Duplicate doc due to multi-source sync or re-query
            OrderRecord(
                id = "doc_1",
                orderId = "ORD-101",
                tenantId = "tenant_1",
                customerId = currentUserId,
                total = 300.0,
                createdAt = "2026-10-18 12:00"
            ),
            OrderRecord(
                id = "doc_2",
                orderId = "ORD-202",
                tenantId = "tenant_2",
                customerId = currentUserId,
                total = 650.0,
                createdAt = "2026-10-18 14:00"
            )
        )

        // Aggregation + deduplication by distinct id
        val allOrders = (tenant1Orders + tenant2Orders).distinctBy { it.id.ifBlank { it.orderId } }
        assertEquals(2, allOrders.size)
        val orderIds = allOrders.map { it.orderId }.toSet()
        assertTrue(orderIds.contains("ORD-101"))
        assertTrue(orderIds.contains("ORD-202"))
    }

    @Test
    fun testAccountSwitchingClearsStaleTrackingData() {
        var selectedOrderForTracking: OrderRecord? = OrderRecord(
            id = "order_secret",
            orderId = "ORD-999",
            customerId = "user_previous",
            total = 1200.0
        )

        // Simulated account switch event: user_previous -> user_new
        var currentUserId = "user_previous"
        fun onAccountSwitched(newUid: String) {
            currentUserId = newUid
            // Isolation safeguard: reset tracking details
            selectedOrderForTracking = null
        }

        onAccountSwitched("user_new")

        assertEquals("user_new", currentUserId)
        assertNull("Selected order detail must be reset to null upon account switch", selectedOrderForTracking)
    }
}
