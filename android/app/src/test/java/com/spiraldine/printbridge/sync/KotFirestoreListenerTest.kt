package com.spiraldine.printbridge.sync

import com.spiraldine.printbridge.data.EnqueueResult
import com.spiraldine.printbridge.data.FakePrintJobDao
import com.spiraldine.printbridge.data.PrintJobRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class KotFirestoreListenerTest {

    private lateinit var fakeDao: FakePrintJobDao
    private lateinit var printJobRepository: PrintJobRepository

    @Before
    fun setUp() {
        fakeDao = FakePrintJobDao()
        printJobRepository = PrintJobRepository(fakeDao)
    }

    @Test
    fun parseKitchenTicketData_mapsCanonicalFieldsAccurately() {
        val firestoreMap = mapOf(
            "id" to "KOT-ORD-202610-5kWDAL-R1",
            "orderId" to "ORD-202610-5kWDAL",
            "ticketNumber" to "KOT #101",
            "tableNumber" to "4",
            "tableName" to "Patio 4",
            "source" to "dine_in",
            "waiterName" to "Geetha Krishna",
            "customerName" to "VIP Guest",
            "round" to 1,
            "isSupplementary" to false,
            "station" to "Main Kitchen",
            "createdAt" to "2026-10-10T12:00:00.000Z",
            "items" to listOf(
                mapOf(
                    "itemId" to "biryani-1",
                    "name" to "Chicken Dum Biryani",
                    "count" to 2,
                    "notes" to "Extra spicy",
                    "station" to "Grill"
                ),
                mapOf(
                    "itemId" to "coke-1",
                    "name" to "Diet Coke",
                    "count" to 1,
                    "notes" to "With lime",
                    "station" to "Bar"
                )
            )
        )

        val ticket = KotFirestoreListener.parseKitchenTicketData(firestoreMap, "fallback-id")
        assertNotNull(ticket)
        assertEquals("KOT-ORD-202610-5kWDAL-R1", ticket!!.ticketId)
        assertEquals("ORD-202610-5kWDAL", ticket.orderId)
        assertEquals("KOT #101", ticket.ticketNumber)
        assertEquals("4", ticket.tableNumber)
        assertEquals("Patio 4", ticket.tableName)
        assertEquals("DINE IN", ticket.orderType)
        assertEquals("Geetha Krishna", ticket.serverName)
        assertEquals("VIP Guest", ticket.customerName)
        assertEquals(1, ticket.round)
        assertFalse(ticket.isSupplementary)
        assertEquals("Main Kitchen", ticket.primaryStation)
        assertEquals(2, ticket.items.size)

        val item1 = ticket.items[0]
        assertEquals("biryani-1", item1.itemId)
        assertEquals("Chicken Dum Biryani", item1.name)
        assertEquals(2, item1.quantity)
        assertEquals("Extra spicy", item1.notes)
        assertEquals("Grill", item1.station)

        val item2 = ticket.items[1]
        assertEquals("Bar", item2.station)
    }

    @Test
    fun parseKitchenTicketData_supplementaryRoundHandledCorrectly() {
        val supplementaryMap = mapOf(
            "id" to "KOT-ORD-202610-5kWDAL-R2",
            "orderId" to "ORD-202610-5kWDAL",
            "ticketNumber" to "KOT #101",
            "tableNumber" to "4",
            "round" to 2,
            "isSupplementary" to true,
            "createdAt" to "2026-10-10T12:25:00.000Z",
            "items" to listOf(
                mapOf(
                    "itemId" to "naan-1",
                    "name" to "Butter Naan",
                    "count" to 3
                )
            )
        )

        val ticket = KotFirestoreListener.parseKitchenTicketData(supplementaryMap, "fallback-id")
        assertNotNull(ticket)
        assertEquals("KOT-ORD-202610-5kWDAL-R2", ticket!!.ticketId)
        assertEquals(2, ticket.round)
        assertTrue(ticket.isSupplementary)
    }

    @Test
    fun parseKitchenTicketData_missingOrderIdOrItems_returnsNull() {
        val noOrderId = mapOf(
            "id" to "KOT-1",
            "items" to listOf(mapOf("name" to "Item", "count" to 1))
        )
        assertNull(KotFirestoreListener.parseKitchenTicketData(noOrderId, "KOT-1"))

        val noItems = mapOf(
            "id" to "KOT-1",
            "orderId" to "ORD-1",
            "items" to emptyList<Any>()
        )
        assertNull(KotFirestoreListener.parseKitchenTicketData(noItems, "KOT-1"))
    }

    @Test
    fun shouldEnqueueTicket_historicalAlreadyPrinted_isRejected() {
        val now = System.currentTimeMillis()
        val oneHourAgo = now - 3600_000L
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }
        val oneHourAgoIso = sdf.format(java.util.Date(oneHourAgo))
        val listenerStartTime = now

        val shouldEnqueue = KotFirestoreListener.shouldEnqueueTicket(
            createdAtIso = oneHourAgoIso,
            printStatus = "printed",
            listenerStartTimeMs = listenerStartTime,
            lookbackWindowMs = 5 * 60 * 1000L
        )

        assertFalse("Historical tickets already printed must NOT be enqueued on startup", shouldEnqueue)
    }

    @Test
    fun shouldEnqueueTicket_historicalUnprinted_isEnqueuedForRecovery() {
        val now = System.currentTimeMillis()
        val oneHourAgo = now - 3600_000L
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }
        val olderIso = sdf.format(java.util.Date(oneHourAgo))
        val listenerStartTime = now

        val shouldEnqueue = KotFirestoreListener.shouldEnqueueTicket(
            createdAtIso = olderIso,
            printStatus = "unprinted",
            listenerStartTimeMs = listenerStartTime,
            lookbackWindowMs = 5 * 60 * 1000L
        )

        assertTrue("Unprinted historical tickets must be enqueued so orders are not dropped", shouldEnqueue)
    }

    @Test
    fun shouldEnqueueTicket_newTicketWithinWindow_isEnqueued() {
        val listenerStartTime = System.currentTimeMillis()
        val nowSdf = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }
        val currentIso = nowSdf.format(java.util.Date())

        val shouldEnqueue = KotFirestoreListener.shouldEnqueueTicket(
            createdAtIso = currentIso,
            printStatus = "unprinted",
            listenerStartTimeMs = listenerStartTime
        )

        assertTrue("New real-time tickets must always be enqueued", shouldEnqueue)
    }

    @Test
    fun duplicateFirestoreEvents_idempotentlyIgnoredByQueue() = runTest {
        val map = mapOf(
            "id" to "KOT-ORD-DUPLICATE-R1",
            "orderId" to "ORD-DUP-01",
            "ticketNumber" to "KOT #202",
            "items" to listOf(mapOf("name" to "Paneer Tikka", "count" to 1))
        )

        val ticket = KotFirestoreListener.parseKitchenTicketData(map, "KOT-ORD-DUPLICATE-R1")!!

        // First delivery: successfully enqueued
        val result1 = printJobRepository.enqueueKot(ticket)
        assertTrue(result1 is EnqueueResult.Enqueued)
        assertEquals(1, printJobRepository.getPendingCount())

        // Duplicate delivery (e.g. metadata update or network reconnect)
        val result2 = printJobRepository.enqueueKot(ticket)
        assertTrue("Duplicate delivery must be safely recognized as AlreadyQueued", result2 is EnqueueResult.AlreadyQueued)
        assertEquals(1, printJobRepository.getPendingCount())
    }

    @Test
    fun supplementaryRound_enqueuedSeparatelyFromOriginalRound() = runTest {
        val round1 = KotFirestoreListener.parseKitchenTicketData(
            mapOf(
                "id" to "KOT-ORD-MULTI-R1",
                "orderId" to "ORD-MULTI-01",
                "round" to 1,
                "isSupplementary" to false,
                "items" to listOf(mapOf("name" to "Soup", "count" to 2))
            ),
            "KOT-ORD-MULTI-R1"
        )!!

        val round2 = KotFirestoreListener.parseKitchenTicketData(
            mapOf(
                "id" to "KOT-ORD-MULTI-R2",
                "orderId" to "ORD-MULTI-01",
                "round" to 2,
                "isSupplementary" to true,
                "items" to listOf(mapOf("name" to "Main Course", "count" to 2))
            ),
            "KOT-ORD-MULTI-R2"
        )!!

        val res1 = printJobRepository.enqueueKot(round1)
        val res2 = printJobRepository.enqueueKot(round2)

        assertTrue(res1 is EnqueueResult.Enqueued)
        assertTrue("Supplementary round has unique ticketId and must enqueue independently", res2 is EnqueueResult.Enqueued)
        assertEquals(2, printJobRepository.getPendingCount())
    }
}
