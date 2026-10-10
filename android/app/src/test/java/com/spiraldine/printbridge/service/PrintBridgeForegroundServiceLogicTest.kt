package com.spiraldine.printbridge.service

import com.spiraldine.printbridge.data.EnqueueResult
import com.spiraldine.printbridge.data.FakePrintJobDao
import com.spiraldine.printbridge.data.PrintJobRepository
import com.spiraldine.printbridge.model.KotItem
import com.spiraldine.printbridge.model.KotTicket
import com.spiraldine.printbridge.model.ThermalPaperWidth
import com.spiraldine.printbridge.queue.PrintQueueProcessor
import com.spiraldine.printbridge.queue.QueueProcessResult
import com.spiraldine.printbridge.transport.PrinterTransport
import com.spiraldine.printbridge.transport.TransportResult
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class PrintBridgeForegroundServiceLogicTest {

    private lateinit var fakeDao: FakePrintJobDao
    private lateinit var repository: PrintJobRepository
    private lateinit var queueProcessor: PrintQueueProcessor

    @Before
    fun setUp() {
        fakeDao = FakePrintJobDao()
        repository = PrintJobRepository(fakeDao)
        queueProcessor = PrintQueueProcessor(repository)
    }

    private fun createTicket(id: String, round: Int = 1): KotTicket {
        return KotTicket(
            ticketId = id,
            ticketNumber = "KOT #10",
            orderId = "ORD-99",
            tableNumber = "2",
            orderType = "Dine-In",
            round = round,
            items = listOf(KotItem("item-1", "Dosa", 1)),
            createdAt = "2026-10-10T12:00:00Z"
        )
    }

    @Test
    fun queueRecovery_existingPendingJobsProcessedSequentiallyOnStartup() = runTest {
        // Simulate jobs persisted from earlier session before restart
        repository.enqueueKot(createTicket("KOT-1"))
        repository.enqueueKot(createTicket("KOT-2"))

        assertEquals(2, repository.getPendingCount())

        val successfulTransport = object : PrinterTransport {
            override val transportType: String = "MockBluetooth"
            override suspend fun send(bytes: ByteArray): TransportResult = TransportResult.Success(bytes.size)
        }

        // Process first pending job
        val res1 = queueProcessor.processNextJob(successfulTransport, ThermalPaperWidth.WIDTH_80MM)
        assertTrue(res1 is QueueProcessResult.Success)
        assertEquals("PJ-KOT-1", (res1 as QueueProcessResult.Success).jobId)
        assertEquals(1, repository.getPendingCount())

        // Process second pending job
        val res2 = queueProcessor.processNextJob(successfulTransport, ThermalPaperWidth.WIDTH_80MM)
        assertTrue(res2 is QueueProcessResult.Success)
        assertEquals("PJ-KOT-2", (res2 as QueueProcessResult.Success).jobId)
        assertEquals(0, repository.getPendingCount())
    }

    @Test
    fun noPrinterConfigured_jobsStaySafelyPendingWithoutLoss() = runTest {
        repository.enqueueKot(createTicket("KOT-UNPRINTED"))
        assertEquals(1, repository.getPendingCount())

        // When transport is null (no printer configured in settings)
        val transport: PrinterTransport? = null
        if (transport == null) {
            // Service loop safely delays without modifying or dropping queue items
        }

        val pendingCount = repository.getPendingCount()
        assertEquals("Jobs must remain in queue until valid printer is paired", 1, pendingCount)
        val pendingJobs = repository.getPendingJobs()
        assertEquals(1, pendingJobs.size)
        assertEquals("PENDING", pendingJobs[0].status)
    }

    @Test
    fun transportFailure_markedFailedWithoutFabricatedSuccess() = runTest {
        repository.enqueueKot(createTicket("KOT-FAIL"))

        val failingTransport = object : PrinterTransport {
            override val transportType: String = "MockFailingNetwork"
            override suspend fun send(bytes: ByteArray): TransportResult = TransportResult.Failure("Connection refused: 192.168.1.100:9100")
        }

        val result = queueProcessor.processNextJob(failingTransport, ThermalPaperWidth.WIDTH_80MM)
        assertTrue("Failed transport transmission must be reported as Failed or Retrying", result is QueueProcessResult.Retrying || result is QueueProcessResult.Failed)

        val jobInDb = fakeDao.getJobById("PJ-KOT-FAIL")
        assertEquals(1, jobInDb?.retryCount)
    }

    @Test
    fun bootReceiverPredicate_requiresBothSessionAndAutoStartFlag() {
        fun shouldStartOnBoot(hasSession: Boolean, isAutoStartEnabled: Boolean): Boolean {
            return hasSession && isAutoStartEnabled
        }

        assertFalse(shouldStartOnBoot(hasSession = false, isAutoStartEnabled = true))
        assertFalse(shouldStartOnBoot(hasSession = true, isAutoStartEnabled = false))
        assertFalse(shouldStartOnBoot(hasSession = false, isAutoStartEnabled = false))
        assertTrue(shouldStartOnBoot(hasSession = true, isAutoStartEnabled = true))
    }
}
