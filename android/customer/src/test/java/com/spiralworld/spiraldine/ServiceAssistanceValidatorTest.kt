package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.DiningSession
import com.spiralworld.spiraldine.data.repository.ServiceAssistanceValidator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ServiceAssistanceValidatorTest {

    @Test
    fun nullSession_validationFails() {
        val result = ServiceAssistanceValidator.validateSession(null)
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("Active table session required") == true)
    }

    @Test
    fun blankTenantOrTable_validationFails() {
        val sessionNoTenant = DiningSession(tenantId = "", tableNumber = "5")
        assertTrue(ServiceAssistanceValidator.validateSession(sessionNoTenant).isFailure)

        val sessionNoTable = DiningSession(tenantId = "rest-test", tableNumber = "")
        assertTrue(ServiceAssistanceValidator.validateSession(sessionNoTable).isFailure)
    }

    @Test
    fun validSession_validationSucceeds() {
        val validSession = DiningSession(
            tenantId = "bawarchi-restaurant",
            tableNumber = "12",
            restaurantName = "Bawarchi"
        )
        assertTrue(ServiceAssistanceValidator.validateSession(validSession).isSuccess)
    }

    @Test
    fun expiredSession_validationFails() {
        val oldIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US)
            .format(java.util.Date(System.currentTimeMillis() - 20 * 60 * 60 * 1000L)) // 20 hours ago
        val expiredSession = DiningSession(
            tenantId = "bawarchi-restaurant",
            tableNumber = "12",
            startedAt = oldIso
        )
        val res = ServiceAssistanceValidator.validateSession(expiredSession)
        assertTrue(res.isFailure)
        assertTrue(res.exceptionOrNull()?.message?.contains("expired") == true)
    }

    @Test
    fun normalizeType_mapsCorrectly() {
        assertEquals("Water", ServiceAssistanceValidator.normalizeType("Please Bring Water"))
        assertEquals("Bill", ServiceAssistanceValidator.normalizeType("Request Bill"))
        assertEquals("Cutlery", ServiceAssistanceValidator.normalizeType("Extra Cutlery"))
        assertEquals("Cutlery", ServiceAssistanceValidator.normalizeType("More Napkins Please"))
        assertEquals("Cleaning", ServiceAssistanceValidator.normalizeType("Please Clean Table"))
        assertEquals("Assistance", ServiceAssistanceValidator.normalizeType("Call Waiter"))
    }

    @Test
    fun debounceRateLimiting_blocksRapidRequests() {
        val firstCallTime = 1000L
        val rapidSecondCallTime = 5000L // 4 seconds later (cooldown is 30s)

        assertTrue(
            "Rapid second request within 30s cooldown must be debounced",
            ServiceAssistanceValidator.isDebounced(
                lastTimestamp = firstCallTime,
                currentTimestamp = rapidSecondCallTime,
                cooldownMs = 30_000L
            )
        )

        val allowedLaterTime = 32000L // 31 seconds later
        assertFalse(
            "Request after cooldown expires must be allowed",
            ServiceAssistanceValidator.isDebounced(
                lastTimestamp = firstCallTime,
                currentTimestamp = allowedLaterTime,
                cooldownMs = 30_000L
            )
        )
    }
}
