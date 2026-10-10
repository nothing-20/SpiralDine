package com.spiraldine.printbridge.queue

import com.spiraldine.printbridge.data.FakePrintJobDao
import com.spiraldine.printbridge.data.PrintJobRepository
import com.spiraldine.printbridge.formatter.EscPosKOTFormatter
import com.spiraldine.printbridge.model.KotItem
import com.spiraldine.printbridge.model.KotTicket
import com.spiraldine.printbridge.model.ThermalPaperWidth
import com.spiraldine.printbridge.transport.PrinterTransport
import com.spiraldine.printbridge.transport.TransportResult
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class PrintQueueProcessorTest {

    private lateinit var fakeDao: FakePrintJobDao
    private lateinit var repository: PrintJobRepository
    private lateinit var processor: PrintQueueProcessor

    @Before
    fun setUp() {
        fakeDao = FakePrintJobDao()
        repository = PrintJobRepository(fakeDao)
        processor = PrintQueueProcessor(repository, EscPosKOTFormatter(), maxRetries = 3)
    }

    private fun createSampleTicket(
        ticketId: String = "KOT-101",
        round: Int = 1
    ): KotTicket {
        return KotTicket(
            ticketId = ticketId,
            ticketNumber = "KOT #101",
            orderId = "ORD-202610-SAMPLE",
            tableNumber = "4",
            tableName = "Table 4",
            orderType = "Dine-In",
            serverName = "Captain Arjun",
            customerName = "Mr. Sharma",
            round = round,
            isSupplementary = false,
            primaryStation = "Hot Kitchen",
            items = listOf(KotItem("i1", "Tandoori Roti", 4)),
            createdAt = "2026-10-10 14:00:00"
        )
    }

    @Test
    fun processNextJob_whenQueueEmpty_returnsIdle() = runTest {
        val fakeTransport = object : PrinterTransport {
            override val transportType = "Fake Transport"
            override suspend fun send(payload: ByteArray): TransportResult = TransportResult.Success(payload.size)
        }

        val result = processor.processNextJob(fakeTransport)
        assertTrue("Empty queue must return Idle", result is QueueProcessResult.Idle)
    }

    @Test
    fun processNextJob_successfulTransport_claimsJobAndRecordsSuccess() = runTest {
        val ticket = createSampleTicket()
        repository.enqueueKot(ticket)

        val fakeTransport = object : PrinterTransport {
            override val transportType = "Fake Bluetooth"
            var capturedBytes: ByteArray? = null
            override suspend fun send(payload: ByteArray): TransportResult {
                capturedBytes = payload
                return TransportResult.Success(payload.size)
            }
        }

        val result = processor.processNextJob(fakeTransport, ThermalPaperWidth.WIDTH_80MM)

        assertTrue(result is QueueProcessResult.Success)
        val success = result as QueueProcessResult.Success
        assertEquals("PJ-KOT-101", success.jobId)
        assertTrue(success.bytesWritten > 0)

        // Job in DB must now be PRINTED
        val job = fakeDao.getJobById("PJ-KOT-101")
        assertNotNull(job)
        assertEquals("PRINTED", job!!.status)
        assertEquals(0, repository.getPendingCount())
        assertEquals(1, repository.getPrintedCount())
    }

    @Test
    fun processNextJob_retryableFailure_incrementsRetryAndReEnqueues() = runTest {
        val ticket = createSampleTicket()
        repository.enqueueKot(ticket)

        val fakeTransport = object : PrinterTransport {
            override val transportType = "Fake Network"
            override suspend fun send(payload: ByteArray): TransportResult {
                return TransportResult.Failure("Connection refused by printer", isRetryable = true)
            }
        }

        val result = processor.processNextJob(fakeTransport)

        assertTrue(result is QueueProcessResult.Retrying)
        val retrying = result as QueueProcessResult.Retrying
        assertEquals(1, retrying.attemptNumber)

        val job = fakeDao.getJobById("PJ-KOT-101")
        assertNotNull(job)
        assertEquals("PENDING", job!!.status)
        assertEquals(1, job.retryCount)
        assertTrue(job.lastError!!.contains("Connection refused"))
    }

    @Test
    fun processNextJob_maxRetriesExceeded_marksJobAsFailed() = runTest {
        val ticket = createSampleTicket()
        repository.enqueueKot(ticket)

        // Manually set retryCount to 3
        val existing = fakeDao.getJobById("PJ-KOT-101")!!
        fakeDao.incrementRetry(existing.jobId, System.currentTimeMillis(), "Attempt 1")
        fakeDao.incrementRetry(existing.jobId, System.currentTimeMillis(), "Attempt 2")
        fakeDao.incrementRetry(existing.jobId, System.currentTimeMillis(), "Attempt 3")

        val fakeTransport = object : PrinterTransport {
            override val transportType = "Fake Network"
            override suspend fun send(payload: ByteArray): TransportResult {
                return TransportResult.Failure("Connection refused", isRetryable = true)
            }
        }

        val result = processor.processNextJob(fakeTransport)

        assertTrue(result is QueueProcessResult.Failed)
        val failed = result as QueueProcessResult.Failed
        assertTrue(failed.reason.contains("Max retry limit"))

        val job = fakeDao.getJobById("PJ-KOT-101")
        assertNotNull(job)
        assertEquals("FAILED", job!!.status)
        // Must not be auto-deleted
        assertEquals(1, fakeDao.getRecentHistory(10).size)
    }

    @Test
    fun processNextJob_interruptedTransmission_failsImmediatelyWithoutRetry() = runTest {
        val ticket = createSampleTicket()
        repository.enqueueKot(ticket)

        val fakeTransport = object : PrinterTransport {
            override val transportType = "Fake Bluetooth"
            override suspend fun send(payload: ByteArray): TransportResult {
                // Interrupted partial write
                return TransportResult.Failure(
                    errorMessage = "Bluetooth connection reset mid-write",
                    isRetryable = false,
                    isInterrupted = true
                )
            }
        }

        val result = processor.processNextJob(fakeTransport)

        assertTrue("Interrupted write must yield Interrupted result", result is QueueProcessResult.Interrupted)
        val interrupted = result as QueueProcessResult.Interrupted
        assertTrue(interrupted.reason.contains("INTERRUPTED"))

        val job = fakeDao.getJobById("PJ-KOT-101")
        assertNotNull(job)
        // Must be marked FAILED rather than re-enqueued, so no duplicate ticket is printed
        assertEquals("FAILED", job!!.status)
        assertTrue(job.lastError!!.contains("INTERRUPTED"))
        assertEquals(0, repository.getPendingCount())
    }
}
