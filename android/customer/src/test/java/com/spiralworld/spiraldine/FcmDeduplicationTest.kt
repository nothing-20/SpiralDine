package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.repository.NotificationDeduplicator
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class FcmDeduplicationTest {

    @Before
    fun setUp() {
        NotificationDeduplicator.clear()
    }

    @Test
    fun firstNotification_isNotDuplicate() {
        val isDup = NotificationDeduplicator.isDuplicate(
            orderId = "ORD-101",
            status = "CONFIRMED",
            currentTimeMs = 1000L
        )
        assertFalse("First notification for an order status should never be marked as duplicate", isDup)
    }

    @Test
    fun sameOrderAndStatus_withinWindow_isMarkedDuplicate() {
        NotificationDeduplicator.isDuplicate(
            orderId = "ORD-101",
            status = "PREPARING",
            currentTimeMs = 1000L
        )

        val isDup = NotificationDeduplicator.isDuplicate(
            orderId = "ORD-101",
            status = "PREPARING",
            currentTimeMs = 5000L // 4 seconds later (well within 10 min window)
        )

        assertTrue("Repeated notification for the same order and status should be suppressed as duplicate", isDup)
    }

    @Test
    fun differentStatusForSameOrder_isNotDuplicate() {
        NotificationDeduplicator.isDuplicate(
            orderId = "ORD-101",
            status = "PREPARING",
            currentTimeMs = 1000L
        )

        val isDup = NotificationDeduplicator.isDuplicate(
            orderId = "ORD-101",
            status = "READY", // Next milestone
            currentTimeMs = 2000L
        )

        assertFalse("A status progression (e.g. PREPARING -> READY) should not be considered duplicate", isDup)
    }

    @Test
    fun sameStatusAfterWindowExpires_isNotDuplicate() {
        val initialTime = 1000L
        NotificationDeduplicator.isDuplicate(
            orderId = "ORD-101",
            status = "SERVED",
            currentTimeMs = initialTime
        )

        // 11 minutes later (outside the 10 min window)
        val laterTime = initialTime + (11 * 60 * 1000L)
        val isDup = NotificationDeduplicator.isDuplicate(
            orderId = "ORD-101",
            status = "SERVED",
            currentTimeMs = laterTime
        )

        assertFalse("Events outside the deduplication time window should not be blocked", isDup)
    }

    @Test
    fun emptyOrBlankParameters_returnsFalse() {
        assertFalse(NotificationDeduplicator.isDuplicate("", "CONFIRMED"))
        assertFalse(NotificationDeduplicator.isDuplicate("ORD-101", ""))
    }
}
