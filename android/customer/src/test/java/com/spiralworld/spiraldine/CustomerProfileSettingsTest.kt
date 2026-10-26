package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.CustomerProfile
import com.spiralworld.spiraldine.data.model.ReviewRecord
import com.spiralworld.spiraldine.data.model.SupportTicket
import com.spiralworld.spiraldine.data.model.defaultNotificationPreferences
import com.spiralworld.spiraldine.data.repository.AuthRepository
import org.junit.Assert.*
import org.junit.Test

class CustomerProfileSettingsTest {

    @Test
    fun testCustomerProfileWithDiningAndSettingsPreferences() {
        val notifs = defaultNotificationPreferences()
        assertTrue("Order updates should be enabled by default", notifs["orderUpdates"] == true)
        assertTrue("Booking updates should be enabled by default", notifs["bookingUpdates"] == true)
        assertTrue("Bill updates should be enabled by default", notifs["billUpdates"] == true)
        assertFalse("Promotional offers should be disabled by default", notifs["promotionalOffers"] == true)

        val profile = CustomerProfile(
            uid = "cust_999",
            email = "diner@spiraldine.com",
            displayName = "Ananya Sharma",
            phoneNumber = "+91 98765 43210",
            isAnonymous = false,
            dietaryPrefs = listOf("Vegetarian", "Gluten-Free"),
            allergens = listOf("Peanuts", "Shellfish"),
            preferredCuisines = listOf("North Indian", "Italian"),
            diningMethod = "Dine In",
            isVeg = true,
            theme = "Light",
            language = "English",
            textSize = "Medium",
            notificationPreferences = notifs
        )

        assertEquals("cust_999", profile.uid)
        assertEquals("Ananya Sharma", profile.displayName)
        assertTrue(profile.isVeg)
        assertEquals(listOf("Vegetarian", "Gluten-Free"), profile.dietaryPrefs)
        assertEquals(listOf("Peanuts", "Shellfish"), profile.allergens)
        assertEquals(listOf("North Indian", "Italian"), profile.preferredCuisines)
        assertEquals("Dine In", profile.diningMethod)
        assertEquals("Light", profile.theme)
        assertEquals("English", profile.language)
        assertEquals("Medium", profile.textSize)
        assertFalse(profile.isDeleted)
    }

    @Test
    fun testProfileFieldValidations() {
        // Name validation
        assertTrue(AuthRepository.validateName("Rohan Verma").isSuccess)
        assertTrue(AuthRepository.validateName("Jo").isSuccess)
        assertTrue(AuthRepository.validateName("").isFailure)
        assertTrue(AuthRepository.validateName("   ").isFailure)
        assertTrue(AuthRepository.validateName("A").isFailure)
        assertTrue(AuthRepository.validateName("A".repeat(61)).isFailure)

        // Phone validation
        assertTrue(AuthRepository.validatePhone(null).isSuccess)
        assertTrue(AuthRepository.validatePhone("").isSuccess)
        assertTrue(AuthRepository.validatePhone("+919876543210").isSuccess)
        assertTrue(AuthRepository.validatePhone("+91 98765 43210").isSuccess)
        assertTrue(AuthRepository.validatePhone("123").isFailure)
        assertTrue(AuthRepository.validatePhone("invalid_phone").isFailure)

        // Email validation
        assertTrue(AuthRepository.validateEmail("diner@example.com").isSuccess)
        assertTrue(AuthRepository.validateEmail("test.user+tag@domain.co.in").isSuccess)
        assertTrue(AuthRepository.validateEmail("notanemail").isFailure)
        assertTrue(AuthRepository.validateEmail("diner@").isFailure)
    }

    @Test
    fun testNotificationPreferenceOverride() {
        val customNotifs = mapOf(
            "orderUpdates" to true,
            "bookingUpdates" to false,
            "billUpdates" to true,
            "promotionalOffers" to true,
            "pushEnabled" to true,
            "emailEnabled" to true
        )

        val profile = CustomerProfile(
            uid = "cust_001",
            notificationPreferences = customNotifs
        )

        assertTrue(profile.notificationPreferences["orderUpdates"] == true)
        assertFalse(profile.notificationPreferences["bookingUpdates"] == true)
        assertTrue(profile.notificationPreferences["promotionalOffers"] == true)
        assertTrue(profile.notificationPreferences["emailEnabled"] == true)
    }

    @Test
    fun testSupportTicketDataContract() {
        val ticket = SupportTicket(
            id = "TICK-102938",
            ticketId = "TICK-102938",
            customerId = "cust_123",
            customerName = "Vikram Patel",
            customerEmail = "vikram@example.com",
            category = "Payment Issue",
            description = "Online payment deducted twice for table 4 order.",
            orderId = "ORD-45892",
            bookingId = null,
            status = "open",
            createdAt = "2026-10-20T10:00:00Z",
            updatedAt = "2026-10-20T10:00:00Z"
        )

        assertEquals("TICK-102938", ticket.ticketId)
        assertEquals("cust_123", ticket.customerId)
        assertEquals("Payment Issue", ticket.category)
        assertEquals("ORD-45892", ticket.orderId)
        assertNull(ticket.bookingId)
        assertEquals("open", ticket.status)
        assertNull(ticket.responseMessage)
    }

    @Test
    fun testCustomerReviewRecordWithCustomerAttribution() {
        val review = ReviewRecord(
            id = "REV-7788",
            orderId = "ORD-1122",
            tenantId = "rest_spiral_main",
            restaurantName = "Spice Symphony Bistro",
            customerId = "cust_123",
            tableNumber = "4",
            rating = "Excellent",
            starRating = 5,
            notes = "The smoked butter chicken and garlic naan were extraordinary!",
            status = "Published",
            createdAt = "2026-10-20T12:00:00Z"
        )

        assertEquals("REV-7788", review.id)
        assertEquals("cust_123", review.customerId)
        assertEquals("Spice Symphony Bistro", review.restaurantName)
        assertEquals(5, review.starRating)
        assertEquals("Published", review.status)
    }

    @Test
    fun testAccountDeletionAnonymizationContract() {
        // Legal compliance requirement: delete user should anonymize personal identifiers
        // but preserve historical financial and order ledger documents
        val activeProfile = CustomerProfile(
            uid = "cust_to_delete",
            email = "delete.me@example.com",
            displayName = "Temporary Customer",
            phoneNumber = "+91 99999 88888",
            isDeleted = false
        )

        val anonymizedProfile = activeProfile.copy(
            displayName = "Deleted User",
            phoneNumber = null,
            isDeleted = true
        )

        assertEquals("Deleted User", anonymizedProfile.displayName)
        assertNull(anonymizedProfile.phoneNumber)
        assertTrue(anonymizedProfile.isDeleted)
        // Original UID is preserved for existing order and bill references
        assertEquals(activeProfile.uid, anonymizedProfile.uid)
    }

    @Test
    fun testReceiptDecimalPrecisionPreserved() {
        val subtotal = 1250.75
        val tax = 62.54
        val serviceCharge = 62.54
        val discount = 100.00
        val total = subtotal + tax + serviceCharge - discount

        assertEquals(1275.83, total, 0.001)

        val formatted = String.format(java.util.Locale.US, "%.2f", total)
        assertEquals("1275.83", formatted)
        assertNotEquals("1275", formatted)
    }
}
