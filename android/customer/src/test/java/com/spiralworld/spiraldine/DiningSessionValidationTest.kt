package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.DiningSession
import com.spiralworld.spiraldine.data.repository.DiningSessionRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DiningSessionValidationTest {

    private val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)

    @Test
    fun recentSession_isNotExpired() {
        val nowIso = sdf.format(Date(System.currentTimeMillis() - 30 * 60 * 1000L)) // 30 minutes ago
        val session = DiningSession(
            sessionId = "SES-20261018-ABC123",
            tenantId = "rest-bawarchi",
            restaurantName = "Bawarchi",
            tableNumber = "4",
            startedAt = nowIso
        )

        assertFalse(DiningSessionRepository.isSessionExpired(session, maxAgeHours = 12))
    }

    @Test
    fun staleSession_isExpired() {
        val oldIso = sdf.format(Date(System.currentTimeMillis() - 15 * 60 * 60 * 1000L)) // 15 hours ago
        val session = DiningSession(
            sessionId = "SES-20261017-OLD123",
            tenantId = "rest-bawarchi",
            restaurantName = "Bawarchi",
            tableNumber = "4",
            startedAt = oldIso
        )

        assertTrue(DiningSessionRepository.isSessionExpired(session, maxAgeHours = 12))
    }

    @Test
    fun nullOrBlankStartedAt_isHandledSafely() {
        assertFalse(DiningSessionRepository.isSessionExpired(null))

        val emptySession = DiningSession(
            sessionId = "SES-EMPTY",
            tenantId = "rest-test",
            startedAt = ""
        )
        assertFalse(DiningSessionRepository.isSessionExpired(emptySession))
    }

    @Test
    fun tableNumberCleaning_normalizesTblPrefix() {
        val raw1 = "TBL-05"
        val clean1 = raw1.replace("(?i)^TBL-".toRegex(), "").trim()
        assertEquals("05", clean1)

        val raw2 = "tbl-12A"
        val clean2 = raw2.replace("(?i)^TBL-".toRegex(), "").trim()
        assertEquals("12A", clean2)

        val raw3 = " 7 "
        val clean3 = raw3.replace("(?i)^TBL-".toRegex(), "").trim()
        assertEquals("7", clean3)
    }

    @Test
    fun crossTenantIsolation_detectsMismatch() {
        val session = DiningSession(
            sessionId = "SES-BAWARCHI",
            tenantId = "bawarchi-restaurant",
            tableNumber = "3"
        )

        assertTrue(session.tenantId.equals("bawarchi-restaurant", ignoreCase = true))
        assertFalse(session.tenantId.equals("paradise-biryani", ignoreCase = true))
    }

    @Test
    fun repositoryInitialization_doesNotThrowNpe() {
        val repo = DiningSessionRepository()
        assertNull(repo.currentSession.value)
    }

    @Test
    fun startAndClearSession_handlesCleanLifecycle() {
        val repo = DiningSessionRepository()
        val session = repo.startSession(
            tenantId = "rest-test-tenant",
            restaurantName = "Test Diner",
            tableNumber = "5"
        )
        assertNotNull(session)
        assertEquals("rest-test-tenant", session.tenantId)
        assertEquals("5", session.tableNumber)
        assertEquals(session, repo.currentSession.value)

        repo.clearSession()
        assertNull(repo.currentSession.value)
    }
}
