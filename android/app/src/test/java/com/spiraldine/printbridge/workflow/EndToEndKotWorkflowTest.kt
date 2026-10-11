package com.spiraldine.printbridge.workflow

import com.spiraldine.printbridge.data.EnqueueResult
import com.spiraldine.printbridge.data.FakePrintJobDao
import com.spiraldine.printbridge.data.PrintJobRepository
import com.spiraldine.printbridge.formatter.EscPosKOTFormatter
import com.spiraldine.printbridge.model.ThermalPaperWidth
import com.spiraldine.printbridge.queue.PrintQueueProcessor
import com.spiraldine.printbridge.queue.QueueProcessResult
import com.spiraldine.printbridge.routing.KotStationRouter
import com.spiraldine.printbridge.sync.KotFirestoreListener
import com.spiraldine.printbridge.transport.SimulatedPrinterTransport
import com.spiraldine.printbridge.transport.TransportResult
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * End-to-End integration test suite for the SpiralDine KOT Print Bridge.
 *
 * Exercises the entire pipeline without requiring physical printer hardware:
 * Firestore Canonical Map -> Parser -> Deduplication -> Room Queue -> Station Router ->
 * ESC/POS Formatter -> Simulated Printer Transport -> Job State Transitions -> Manual Recovery.
 */
class EndToEndKotWorkflowTest {

    private lateinit var fakeDao: FakePrintJobDao
    private lateinit var repository: PrintJobRepository
    private lateinit var formatter: EscPosKOTFormatter
    private lateinit var processor: PrintQueueProcessor
    private lateinit var simulatedTransport: SimulatedPrinterTransport

    @Before
    fun setUp() {
        fakeDao = FakePrintJobDao()
        repository = PrintJobRepository(fakeDao)
        formatter = EscPosKOTFormatter()
        processor = PrintQueueProcessor(repository, formatter, maxRetries = 3)
        simulatedTransport = SimulatedPrinterTransport()
    }

    /**
     * Canonical SpiralDine Firestore document representation from:
     * restaurants/{tenantId}/kitchenTickets/{ticketId}
     */
    private fun createCanonicalFirestoreKot(
        ticketId: String = "KOT-ORD-202610-SIM-R1",
        orderId: String = "ORD-202610-SIM",
        round: Int = 1,
        isSupplementary: Boolean = false,
        createdAtIso: String = "2026-10-10T19:00:00.000Z"
    ): Map<String, Any?> {
        return mapOf(
            "id" to ticketId,
            "orderId" to orderId,
            "ticketNumber" to "KOT #105",
            "tableNumber" to "8",
            "tableName" to "Table 8 (Dining Room)",
            "source" to "dine_in",
            "waiterName" to "Captain Ramesh",
            "customerName" to "Ananya Roy",
            "round" to round,
            "isSupplementary" to isSupplementary,
            "station" to "Main Kitchen",
            "createdAt" to createdAtIso,
            "printStatus" to "unprinted",
            "items" to listOf(
                mapOf(
                    "itemId" to "item-g1",
                    "name" to "Tandoori Chicken Tikka",
                    "count" to 2,
                    "notes" to "Extra spicy mint chutney",
                    "station" to "Grill"
                ),
                mapOf(
                    "itemId" to "item-f1",
                    "name" to "Crispy Peri Peri Fries",
                    "count" to 1,
                    "notes" to "Crispy well done",
                    "station" to "Fryer"
                ),
                mapOf(
                    "itemId" to "item-b1",
                    "name" to "Mint Mojito",
                    "count" to 2,
                    "notes" to "Less ice",
                    "station" to "Bar"
                ),
                mapOf(
                    "itemId" to "item-k1",
                    "name" to "Dal Makhani",
                    "count" to 1,
                    "notes" to null,
                    "station" to "Main Kitchen"
                )
            )
        )
    }

    @Test
    fun endToEnd_canonicalKot_successfullyParsedQueuedFormattedAndSimulatedPrinted() = runTest {
        // Step A: Canonical Firestore payload
        val rawDoc = createCanonicalFirestoreKot()

        // Step B: Parse into domain model
        val parsedTicket = KotFirestoreListener.parseKitchenTicketData(rawDoc, "fallback-id")
        assertNotNull("Canonical document must parse cleanly", parsedTicket)
        val ticket = parsedTicket!!
        assertEquals("KOT-ORD-202610-SIM-R1", ticket.ticketId)
        assertEquals("ORD-202610-SIM", ticket.orderId)
        assertEquals(4, ticket.items.size)

        // Step C: Enqueue in Room local database
        val enqueueResult = repository.enqueueKot(ticket)
        assertTrue(enqueueResult is EnqueueResult.Enqueued)
        val enqueuedJob = (enqueueResult as EnqueueResult.Enqueued).job
        assertEquals("PJ-KOT-ORD-202610-SIM-R1", enqueuedJob.jobId)
        assertEquals("PENDING", enqueuedJob.status)
        assertEquals(1, repository.getPendingCount())

        // Step D: Verify deterministic deduplication on duplicate event
        val dupResult = repository.enqueueKot(ticket)
        assertTrue("Duplicate submission must be recognized as AlreadyQueued", dupResult is EnqueueResult.AlreadyQueued)
        assertEquals("Duplicate must not create extra queue entries", 1, repository.getPendingCount())

        // Step E, F, G: Process through QueueProcessor, Station Router, and Simulated Transport
        val processResult = processor.processNextJob(
            transport = simulatedTransport,
            paperWidth = ThermalPaperWidth.WIDTH_80MM,
            stationFilter = "ALL"
        )

        // Step H: Verify transmission result & simulated transport recording
        assertTrue("Queue dispatch must report Success", processResult is QueueProcessResult.Success)
        val success = processResult as QueueProcessResult.Success
        assertEquals("PJ-KOT-ORD-202610-SIM-R1", success.jobId)
        assertTrue(success.bytesWritten > 0)

        assertEquals("Simulated transport must have recorded 1 submission", 1, simulatedTransport.totalSubmissions)
        assertEquals(1, simulatedTransport.successfulSubmissions)

        val capturedPayload = simulatedTransport.lastPayload
        assertNotNull(capturedPayload)

        // Step H.1: Assert exact ESC/POS control sequences
        // ESC @ (0x1B, 0x40) at start
        assertEquals(0x1B.toByte(), capturedPayload!![0])
        assertEquals(0x40.toByte(), capturedPayload[1])
        // GS V 66 0 (feed & partial cut) at end
        val len = capturedPayload.size
        assertEquals(0x1D.toByte(), capturedPayload[len - 4])
        assertEquals(0x56.toByte(), capturedPayload[len - 3])
        assertEquals(0x42.toByte(), capturedPayload[len - 2])
        assertEquals(0x00.toByte(), capturedPayload[len - 1])

        // Step H.2: Assert decoded text content
        val text = simulatedTransport.lastTextContent!!
        assertTrue(text.contains("SPIRALDINE KITCHEN"))
        assertTrue(text.contains("KOT #105"))
        assertTrue(text.contains("TABLE 8 (DINING ROOM)"))
        assertTrue(text.contains("Captain Ramesh"))
        assertTrue(text.contains("Ananya Roy"))
        assertTrue(text.contains("Tandoori Chicken Tikka"))
        assertTrue(text.contains("Extra spicy mint chutney"))
        assertTrue(text.contains("Crispy Peri Peri Fries"))
        assertTrue(text.contains("Mint Mojito"))
        assertTrue(text.contains("Dal Makhani"))

        // Step I: Verify resulting local job state in database
        val dbJob = repository.getJobById("PJ-KOT-ORD-202610-SIM-R1")
        assertNotNull(dbJob)
        assertEquals("PRINTED", dbJob!!.status)
        assertEquals(0, repository.getPendingCount())
        assertEquals(1, repository.getPrintedCount())
    }

    @Test
    fun endToEnd_stationRouting_partitionsMixedTicketsCleanlyWithoutDataLoss() = runTest {
        val rawDoc = createCanonicalFirestoreKot()
        val ticket = KotFirestoreListener.parseKitchenTicketData(rawDoc, "fallback-id")!!
        repository.enqueueKot(ticket)

        // Dispatch through Grill Station printer
        val result = processor.processNextJob(
            transport = simulatedTransport,
            paperWidth = ThermalPaperWidth.WIDTH_80MM,
            stationFilter = KotStationRouter.STATION_GRILL
        )

        assertTrue(result is QueueProcessResult.Success)
        val text = simulatedTransport.lastTextContent!!

        // Must contain Grill items
        assertTrue(text.contains("Tandoori Chicken Tikka"))
        assertTrue(text.contains("GRILL (1/4 ITEMS)"))

        // Must NOT contain items for other stations on the Grill printer slip
        assertFalse("Fryer items must not print on Grill ticket", text.contains("Crispy Peri Peri Fries"))
        assertFalse("Bar items must not print on Grill ticket", text.contains("Mint Mojito"))
        assertFalse("Kitchen curry must not print on Grill ticket", text.contains("Dal Makhani"))

        // Database status
        val job = repository.getJobById("PJ-KOT-ORD-202610-SIM-R1")
        assertEquals("PRINTED", job!!.status)
    }

    @Test
    fun endToEnd_stationRouting_zeroMatchingItemsPreservedAsRoutedOtherStation() = runTest {
        val rawDoc = createCanonicalFirestoreKot()
        val ticket = KotFirestoreListener.parseKitchenTicketData(rawDoc, "fallback-id")!!
        repository.enqueueKot(ticket)

        // Dispatch through Dessert Station (ticket has 0 dessert items)
        val result = processor.processNextJob(
            transport = simulatedTransport,
            paperWidth = ThermalPaperWidth.WIDTH_80MM,
            stationFilter = KotStationRouter.STATION_DESSERT
        )

        assertTrue(result is QueueProcessResult.SkippedStation)
        val skipped = result as QueueProcessResult.SkippedStation
        assertEquals("PJ-KOT-ORD-202610-SIM-R1", skipped.jobId)

        // Nothing was sent to the simulated transport
        assertEquals(0, simulatedTransport.totalSubmissions)

        // CRITICAL: Job must NOT be deleted! Must be cleanly preserved in Room database
        val dbJob = repository.getJobById("PJ-KOT-ORD-202610-SIM-R1")
        assertNotNull(dbJob)
        assertEquals("ROUTED_OTHER_STATION", dbJob!!.status)
        assertTrue(dbJob.lastError!!.contains("ROUTED_OTHER_STATION"))
        assertEquals(0, repository.getPendingCount())
    }

    @Test
    fun endToEnd_transientFailure_retriesWithBackoffAndSucceedsOnNextAttempt() = runTest {
        val rawDoc = createCanonicalFirestoreKot()
        val ticket = KotFirestoreListener.parseKitchenTicketData(rawDoc, "fallback-id")!!
        repository.enqueueKot(ticket)

        // Configure simulated transport to fail attempt 1, then succeed attempt 2
        simulatedTransport.setCustomHandler { payload, attemptIndex ->
            if (attemptIndex == 1) {
                TransportResult.Failure("Simulated TCP connection timeout", isRetryable = true)
            } else {
                TransportResult.Success(payload.size)
            }
        }

        // Attempt 1: Transport failure
        val result1 = processor.processNextJob(simulatedTransport)
        assertTrue(result1 is QueueProcessResult.Retrying)
        val retrying = result1 as QueueProcessResult.Retrying
        assertEquals(1, retrying.attemptNumber)

        var job = repository.getJobById("PJ-KOT-ORD-202610-SIM-R1")
        assertEquals("PENDING", job!!.status)
        assertEquals(1, job.retryCount)
        assertEquals(1, repository.getPendingCount())

        // Attempt 2: Re-processed after backoff -> Succeeds
        val result2 = processor.processNextJob(simulatedTransport)
        assertTrue(result2 is QueueProcessResult.Success)

        job = repository.getJobById("PJ-KOT-ORD-202610-SIM-R1")
        assertEquals("PRINTED", job!!.status)
        assertEquals(0, repository.getPendingCount())
        assertEquals(2, simulatedTransport.totalSubmissions)
    }

    @Test
    fun endToEnd_interruptedWrite_markedInterruptedWithoutAutomaticRetryHazard() = runTest {
        val rawDoc = createCanonicalFirestoreKot()
        val ticket = KotFirestoreListener.parseKitchenTicketData(rawDoc, "fallback-id")!!
        repository.enqueueKot(ticket)

        // Configure mid-stream socket interruption
        simulatedTransport.setBehavior(SimulatedPrinterTransport.SimulationBehavior.INTERRUPTED)

        val result = processor.processNextJob(simulatedTransport)
        assertTrue(result is QueueProcessResult.Interrupted)

        // Must be marked INTERRUPTED in database
        val job = repository.getJobById("PJ-KOT-ORD-202610-SIM-R1")
        assertNotNull(job)
        assertEquals("INTERRUPTED", job!!.status)
        assertTrue(job.lastError!!.contains("INTERRUPTED"))

        // CRITICAL: Must NOT be re-enqueued to PENDING automatically (avoids duplicate food orders)
        assertEquals(0, repository.getPendingCount())

        // Subsequent processor run finds queue idle
        val nextRun = processor.processNextJob(simulatedTransport)
        assertTrue(nextRun is QueueProcessResult.Idle)

        // Explicit staff confirmation is required to retry an ambiguous job
        repository.forceRetryAmbiguousJob(job.jobId, "Staff confirmed paper tray empty")
        val jobAfterConfirm = repository.getJobById(job.jobId)
        assertEquals("PENDING", jobAfterConfirm!!.status)
        assertEquals(1, repository.getPendingCount())
    }

    @Test
    fun endToEnd_intentionalReprint_createsDistinctAuditableJobWithWatermark() = runTest {
        val rawDoc = createCanonicalFirestoreKot()
        val ticket = KotFirestoreListener.parseKitchenTicketData(rawDoc, "fallback-id")!!
        repository.enqueueKot(ticket)
        processor.processNextJob(simulatedTransport)

        // Original job is PRINTED
        val origJob = repository.getJobById("PJ-KOT-ORD-202610-SIM-R1")
        assertEquals("PRINTED", origJob!!.status)
        assertEquals(1, simulatedTransport.totalSubmissions)

        // Staff triggers duplicate reprint
        val reprintEnqueue = repository.enqueueReprint(ticket, reason = "Ticket water damaged")
        assertTrue(reprintEnqueue is EnqueueResult.ReprintEnqueued)
        val reprintJob = (reprintEnqueue as EnqueueResult.ReprintEnqueued).job
        assertEquals("PJ-KOT-ORD-202610-SIM-R1-REPRINT-1", reprintJob.jobId)
        assertEquals("PENDING", reprintJob.status)
        assertTrue(reprintJob.isReprint)

        // Process reprint
        val reprintResult = processor.processNextJob(simulatedTransport)
        assertTrue(reprintResult is QueueProcessResult.Success)

        // Assert 2 submissions in simulated transport
        assertEquals(2, simulatedTransport.totalSubmissions)
        val reprintText = simulatedTransport.lastTextContent!!

        // Must prominently display reprint watermark
        assertTrue(reprintText.contains("*** DUPLICATE / REPRINT #1 ***"))

        // Original job remains untouched
        val origJobAfter = repository.getJobById("PJ-KOT-ORD-202610-SIM-R1")
        assertEquals("PRINTED", origJobAfter!!.status)
    }

    @Test
    fun firebaseBoundary_supplementaryRoundHandledCleanly() {
        // Initial Round 1
        val docR1 = createCanonicalFirestoreKot(
            ticketId = "KOT-MULTI-R1",
            round = 1,
            isSupplementary = false
        )
        val ticketR1 = KotFirestoreListener.parseKitchenTicketData(docR1, "KOT-MULTI-R1")
        assertNotNull(ticketR1)
        assertEquals(1, ticketR1!!.round)
        assertFalse(ticketR1.isSupplementary)

        // Supplementary Round 2
        val docR2 = createCanonicalFirestoreKot(
            ticketId = "KOT-MULTI-R2",
            round = 2,
            isSupplementary = true
        )
        val ticketR2 = KotFirestoreListener.parseKitchenTicketData(docR2, "KOT-MULTI-R2")
        assertNotNull(ticketR2)
        assertEquals(2, ticketR2!!.round)
        assertTrue(ticketR2.isSupplementary)

        // Formatting round 2 must include supplementary banner
        val bytes = formatter.formatKot(ticketR2, ThermalPaperWidth.WIDTH_80MM)
        val text = String(bytes, java.nio.charset.Charset.forName("CP437"))
        assertTrue(text.contains("[SUPPLEMENTARY KOT (ROUND #2)]"))
    }

    @Test
    fun firebaseBoundary_invalidOrMissingFieldsSafelyRejected() {
        val missingOrderId = mapOf("id" to "KOT-1", "items" to listOf(mapOf("name" to "Bread")))
        assertNull(KotFirestoreListener.parseKitchenTicketData(missingOrderId, "KOT-1"))

        val emptyItems = mapOf("id" to "KOT-1", "orderId" to "ORD-1", "items" to emptyList<Any>())
        assertNull(KotFirestoreListener.parseKitchenTicketData(emptyItems, "KOT-1"))

        val noItemsKey = mapOf("id" to "KOT-1", "orderId" to "ORD-1")
        assertNull(KotFirestoreListener.parseKitchenTicketData(noItemsKey, "KOT-1"))
    }

    @Test
    fun simulationIsolation_simulationTransportNeverOpensRealSockets() = runTest {
        // Verify simulated transport is completely offline and does not establish network/BT connections
        val transport = SimulatedPrinterTransport()
        assertEquals("Simulated Thermal Printer (Test Only)", transport.transportType)

        val result = transport.send("OFFLINE_PAYLOAD".toByteArray())
        assertTrue(result is TransportResult.Success)
        assertEquals(1, transport.totalSubmissions)
        assertEquals("OFFLINE_PAYLOAD", transport.lastTextContent)
    }

    @Test
    fun customerPortal_orderSubmission_fullPipelineVerified() = runTest {
        // 1. Customer submits Order #1 via Customer Portal QR code
        val customerOrderDoc = mapOf(
            "id" to "KOT-ORD-CUST-101-R1",
            "orderId" to "ORD-CUST-101",
            "ticketNumber" to "KOT #120",
            "tableNumber" to "4",
            "tableName" to "Table 4",
            "source" to "customer_qr",
            "customerName" to "Rahul Sharma",
            "round" to 1,
            "isSupplementary" to false,
            "station" to "Main Kitchen",
            "createdAt" to "2026-10-11T12:00:00.000Z",
            "printStatus" to "unprinted",
            "items" to listOf(
                mapOf(
                    "itemId" to "item-paneer-butter",
                    "name" to "Paneer Butter Masala",
                    "count" to 1,
                    "notes" to "Medium spicy",
                    "station" to "Main Kitchen"
                ),
                mapOf(
                    "itemId" to "item-garlic-naan",
                    "name" to "Garlic Naan",
                    "count" to 2,
                    "notes" to "Crispy",
                    "station" to "Tandoor"
                )
            )
        )

        // 2. Android KotFirestoreListener parses canonical document
        val ticketR1 = KotFirestoreListener.parseKitchenTicketData(customerOrderDoc, "KOT-ORD-CUST-101-R1")
        assertNotNull("Customer portal KOT must parse cleanly into KotTicket domain model", ticketR1)
        assertEquals("ORD-CUST-101", ticketR1!!.orderId)
        assertEquals("CUSTOMER QR", ticketR1.orderType)
        assertEquals("Rahul Sharma", ticketR1.customerName)
        assertEquals(1, ticketR1.round)
        assertFalse(ticketR1.isSupplementary)
        assertEquals(2, ticketR1.items.size)

        // 3. PrintJobRepository enqueues exactly one job in local Room queue
        val enqueueResult1 = repository.enqueueKot(ticketR1)
        assertTrue(enqueueResult1 is EnqueueResult.Enqueued)
        val job1 = (enqueueResult1 as EnqueueResult.Enqueued).job
        assertEquals("PJ-KOT-ORD-CUST-101-R1", job1.jobId)
        assertEquals("PENDING", job1.status)
        assertEquals(1, repository.getPendingCount())

        // 4. Duplicate Firestore delivery for Round 1 does NOT create duplicate jobs
        val dupResult = repository.enqueueKot(ticketR1)
        assertTrue(dupResult is EnqueueResult.AlreadyQueued)
        assertEquals(1, repository.getPendingCount())

        // 5. Customer orders supplementary items (Round 2)
        val customerOrderDocR2 = mapOf(
            "id" to "KOT-ORD-CUST-101-R2",
            "orderId" to "ORD-CUST-101",
            "ticketNumber" to "KOT #121",
            "tableNumber" to "4",
            "tableName" to "Table 4",
            "source" to "customer_qr",
            "customerName" to "Rahul Sharma",
            "round" to 2,
            "isSupplementary" to true,
            "station" to "Dessert",
            "createdAt" to "2026-10-11T12:20:00.000Z",
            "printStatus" to "unprinted",
            "items" to listOf(
                mapOf(
                    "itemId" to "item-gulab-jamun",
                    "name" to "Gulab Jamun (2 pcs)",
                    "count" to 1,
                    "notes" to "Warm",
                    "station" to "Dessert"
                )
            )
        )

        val ticketR2 = KotFirestoreListener.parseKitchenTicketData(customerOrderDocR2, "KOT-ORD-CUST-101-R2")
        assertNotNull(ticketR2)
        assertEquals(2, ticketR2!!.round)
        assertTrue(ticketR2.isSupplementary)

        val enqueueResult2 = repository.enqueueKot(ticketR2)
        assertTrue(enqueueResult2 is EnqueueResult.Enqueued)
        assertEquals(2, repository.getPendingCount())

        // 6. Queue persistence across application/service restart
        val restartedRepo = PrintJobRepository(fakeDao)
        val pendingJobsAfterRestart = restartedRepo.getPendingJobs()
        assertEquals(2, pendingJobsAfterRestart.size)
        assertEquals("PJ-KOT-ORD-CUST-101-R1", pendingJobsAfterRestart[0].jobId)
        assertEquals("PJ-KOT-ORD-CUST-101-R2", pendingJobsAfterRestart[1].jobId)

        // 7. Simulated printer transport processes the queue without physical hardware
        val restartedProcessor = PrintQueueProcessor(restartedRepo, formatter, maxRetries = 3)

        // Process Round 1 job
        val processR1 = restartedProcessor.processNextJob(simulatedTransport, ThermalPaperWidth.WIDTH_80MM)
        assertTrue(processR1 is QueueProcessResult.Success)
        val textR1 = simulatedTransport.lastTextContent!!
        assertTrue(textR1.contains("Rahul Sharma"))
        assertTrue(textR1.contains("Paneer Butter Masala"))
        assertTrue(textR1.contains("Garlic Naan"))

        // Process Round 2 job
        val processR2 = restartedProcessor.processNextJob(simulatedTransport, ThermalPaperWidth.WIDTH_80MM)
        assertTrue(processR2 is QueueProcessResult.Success)
        val textR2 = simulatedTransport.lastTextContent!!
        assertTrue(textR2.contains("[SUPPLEMENTARY KOT (ROUND #2)]"))
        assertTrue(textR2.contains("Gulab Jamun"))

        // Final state verification
        assertEquals(0, restartedRepo.getPendingCount())
        assertEquals(2, restartedRepo.getPrintedCount())
        assertEquals(2, simulatedTransport.totalSubmissions)
        assertEquals(2, simulatedTransport.successfulSubmissions)
    }
}

