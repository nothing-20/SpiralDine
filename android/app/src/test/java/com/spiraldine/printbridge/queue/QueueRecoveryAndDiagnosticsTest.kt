package com.spiraldine.printbridge.queue

import com.spiraldine.printbridge.data.EnqueueResult
import com.spiraldine.printbridge.data.FakePrintJobDao
import com.spiraldine.printbridge.data.PrintJobRepository
import com.spiraldine.printbridge.formatter.EscPosKOTFormatter
import com.spiraldine.printbridge.model.KotItem
import com.spiraldine.printbridge.model.KotTicket
import com.spiraldine.printbridge.model.ThermalPaperWidth
import com.spiraldine.printbridge.routing.KotStationRouter
import com.spiraldine.printbridge.transport.PrinterTransport
import com.spiraldine.printbridge.transport.TransportResult
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class QueueRecoveryAndDiagnosticsTest {

    private lateinit var fakeDao: FakePrintJobDao
    private lateinit var repository: PrintJobRepository
    private lateinit var processor: PrintQueueProcessor

    @Before
    fun setUp() {
        fakeDao = FakePrintJobDao()
        repository = PrintJobRepository(fakeDao)
        processor = PrintQueueProcessor(repository, EscPosKOTFormatter(), maxRetries = 3)
    }

    private fun sampleKot(
        ticketId: String = "KOT-501",
        ticketNumber: String = "KOT #501",
        station: String = "Grill",
        items: List<KotItem> = listOf(KotItem("i1", "Chicken Tikka", 1, station = "Grill"))
    ): KotTicket {
        return KotTicket(
            ticketId = ticketId,
            ticketNumber = ticketNumber,
            orderId = "ORD-TEST-123",
            tableNumber = "T-5",
            tableName = "Table 5",
            orderType = "Dine-In",
            serverName = "Captain Roy",
            customerName = "Mr. Verma",
            round = 1,
            isSupplementary = false,
            primaryStation = station,
            items = items,
            createdAt = "2026-10-10 18:00:00"
        )
    }

    @Test
    fun queueFiltering_retrievesJobsByExactStatus() = runTest {
        // Enqueue several jobs and transition to various statuses
        repository.enqueueKot(sampleKot("KOT-1", "KOT #1"))
        repository.enqueueKot(sampleKot("KOT-2", "KOT #2"))
        repository.enqueueKot(sampleKot("KOT-3", "KOT #3"))
        repository.enqueueKot(sampleKot("KOT-4", "KOT #4"))

        repository.recordSuccess("PJ-KOT-1")
        repository.recordFailure("PJ-KOT-2", "Connection timeout")
        repository.recordInterrupted("PJ-KOT-3", "Bluetooth socket closed during byte transmit")
        repository.recordSkippedStation("PJ-KOT-4", "Ticket routed to Bar; ignored on Grill printer")

        val allJobs = repository.getHistory(50)
        assertEquals(4, allJobs.size)

        val printedJobs = repository.getJobsByStatus("PRINTED", 50)
        assertEquals(1, printedJobs.size)
        assertEquals("PJ-KOT-1", printedJobs[0].jobId)

        val failedJobs = repository.getJobsByStatus("FAILED", 50)
        assertEquals(1, failedJobs.size)
        assertEquals("PJ-KOT-2", failedJobs[0].jobId)

        val interruptedJobs = repository.getJobsByStatus("INTERRUPTED", 50)
        assertEquals(1, interruptedJobs.size)
        assertEquals("PJ-KOT-3", interruptedJobs[0].jobId)

        val routedJobs = repository.getJobsByStatus("ROUTED_OTHER_STATION", 50)
        assertEquals(1, routedJobs.size)
        assertEquals("PJ-KOT-4", routedJobs[0].jobId)
    }

    @Test
    fun failedJobInspection_providesDiagnosticsDetails() = runTest {
        val ticket = sampleKot("KOT-FAIL-1", "KOT #999")
        repository.enqueueKot(ticket)
        repository.recordFailure("PJ-KOT-FAIL-1", "Broken pipe: TCP port 9100 unreachable at 192.168.1.50")

        val job = repository.getJobById("PJ-KOT-FAIL-1")
        assertNotNull(job)
        assertEquals("FAILED", job!!.status)
        assertEquals("KOT #999", job.ticketNumber)
        assertEquals("ORD-TEST-123", job.orderId)
        assertTrue(job.lastError!!.contains("Broken pipe"))
        assertTrue(job.createdAt > 0)
        assertEquals(0, job.retryCount)
    }

    @Test
    fun manualRetryAuthorization_reEnqueuesFailedJobToPending() = runTest {
        repository.enqueueKot(sampleKot("KOT-RETRY-1"))
        repository.recordFailure("PJ-KOT-RETRY-1", "Printer paper roll empty sensor triggered")

        var job = repository.getJobById("PJ-KOT-RETRY-1")
        assertEquals("FAILED", job!!.status)

        // Staff authorizes retry
        repository.retryJob("PJ-KOT-RETRY-1", "Staff replaced paper roll and authorized retry")

        job = repository.getJobById("PJ-KOT-RETRY-1")
        assertEquals("PENDING", job!!.status)
        assertTrue(job.lastError!!.contains("Staff replaced paper roll"))
        assertEquals(1, repository.getPendingCount())
    }

    @Test
    fun ambiguousOutcomeConfirmation_requiresExplicitConfirmationBeforeRetry() = runTest {
        repository.enqueueKot(sampleKot("KOT-AMBIGUOUS-1", "KOT #303"))
        // Socket broke mid-transmission
        repository.recordInterrupted("PJ-KOT-AMBIGUOUS-1", "Bluetooth SPP link dropped mid-stream (142/380 bytes sent)")

        var job = repository.getJobById("PJ-KOT-AMBIGUOUS-1")
        assertEquals("INTERRUPTED", job!!.status)

        // Attempting normal retry is not allowed for ambiguous jobs; must use explicit force confirmation
        repository.forceRetryAmbiguousJob("PJ-KOT-AMBIGUOUS-1", "Staff physically inspected printer tray and confirmed no ticket printed")

        job = repository.getJobById("PJ-KOT-AMBIGUOUS-1")
        assertEquals("PENDING", job!!.status)
        assertTrue(job.lastError!!.contains("physically inspected printer tray"))
    }

    @Test
    fun duplicateReprint_createsDistinguishableReprintJobWithoutMutatingOriginal() = runTest {
        val originalTicket = sampleKot("KOT-ORIG-1", "KOT #777")
        repository.enqueueKot(originalTicket)
        repository.recordSuccess("PJ-KOT-ORIG-1")

        val originalJob = repository.getJobById("PJ-KOT-ORIG-1")
        assertEquals("PRINTED", originalJob!!.status)

        // Staff requests intentional duplicate reprint
        val result = repository.enqueueReprint(originalTicket, "Waiter requested duplicate KOT for chef")
        assertTrue(result is EnqueueResult.ReprintEnqueued)
        val reprintJob = (result as EnqueueResult.ReprintEnqueued).job

        assertNotNull(reprintJob)
        assertTrue(reprintJob.jobId.contains("REPRINT"))
        assertEquals("PENDING", reprintJob.status)
        assertEquals("KOT #777", reprintJob.ticketNumber)

        // Original job remains untouched in history
        val originalAfter = repository.getJobById("PJ-KOT-ORIG-1")
        assertEquals("PRINTED", originalAfter!!.status)
    }

    @Test
    fun routingProcessor_noLossOfJobs_multiStationAndZeroMatchHandled() = runTest {
        // Enqueue 2 tickets:
        // Ticket A: Mixed (Grill + Bar)
        // Ticket B: Pure Bar (No Grill)
        val ticketA = sampleKot(
            ticketId = "KOT-A",
            ticketNumber = "KOT #A",
            items = listOf(
                KotItem("i1", "Tandoori Paneer", 2, station = "Grill"),
                KotItem("i2", "Fresh Lime Soda", 1, station = "Bar")
            )
        )
        val ticketB = sampleKot(
            ticketId = "KOT-B",
            ticketNumber = "KOT #B",
            station = "Bar",
            items = listOf(
                KotItem("i3", "Cold Beer", 2, station = "Bar")
            )
        )

        repository.enqueueKot(ticketA)
        repository.enqueueKot(ticketB)
        assertEquals(2, repository.getPendingCount())

        val mockGrillTransport = object : PrinterTransport {
            override val transportType = "Grill Network Printer"
            var sentBytes: ByteArray? = null
            override suspend fun send(payload: ByteArray): TransportResult {
                sentBytes = payload
                return TransportResult.Success(payload.size)
            }
        }

        // 1. Process with Grill station filter
        val resultA = processor.processNextJob(mockGrillTransport, ThermalPaperWidth.WIDTH_80MM, stationFilter = KotStationRouter.STATION_GRILL)
        assertTrue(resultA is QueueProcessResult.Success)
        val jobA = repository.getJobById("PJ-KOT-A")
        assertEquals("PRINTED", jobA!!.status)

        // 2. Process ticket B with Grill station filter (0 items for Grill)
        val resultB = processor.processNextJob(mockGrillTransport, ThermalPaperWidth.WIDTH_80MM, stationFilter = KotStationRouter.STATION_GRILL)
        assertTrue(resultB is QueueProcessResult.SkippedStation)
        val skipped = resultB as QueueProcessResult.SkippedStation
        assertEquals("PJ-KOT-B", skipped.jobId)

        // Verify ticket B was NOT deleted or dropped from DB! It is cleanly preserved as ROUTED_OTHER_STATION
        val jobB = repository.getJobById("PJ-KOT-B")
        assertNotNull("Ticket B must still exist in Room database", jobB)
        assertEquals("ROUTED_OTHER_STATION", jobB!!.status)
        assertTrue(jobB.lastError!!.contains("ROUTED_OTHER_STATION"))

        // Both jobs are fully accounted for in database
        val allHistory = repository.getHistory(10)
        assertEquals(2, allHistory.size)
    }
}
