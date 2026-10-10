package com.spiraldine.printbridge.data

import com.spiraldine.printbridge.data.local.PrintJobDao
import com.spiraldine.printbridge.data.local.PrintJobEntity
import com.spiraldine.printbridge.model.KotItem
import com.spiraldine.printbridge.model.KotTicket
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class PrintJobRepositoryTest {

    private lateinit var fakeDao: FakePrintJobDao
    private lateinit var repository: PrintJobRepository

    @Before
    fun setUp() {
        fakeDao = FakePrintJobDao()
        repository = PrintJobRepository(fakeDao)
    }

    private fun createSampleTicket(
        ticketId: String = "KOT-ORD-202610-R1",
        round: Int = 1,
        isSupplementary: Boolean = false
    ): KotTicket {
        return KotTicket(
            ticketId = ticketId,
            ticketNumber = "KOT #101",
            orderId = "ORD-202610-5kWDAL",
            tableNumber = "1",
            tableName = "Table 1",
            orderType = "Dine-In",
            serverName = "Geetha Krishna",
            customerName = "Guest Diner",
            round = round,
            isSupplementary = isSupplementary,
            primaryStation = "Main Kitchen",
            items = listOf(KotItem("item-1", "Chicken Biryani", 2)),
            createdAt = "Oct 10, 2026 12:18:22 PM"
        )
    }

    @Test
    fun enqueueKot_firstTime_successfullyEnqueuesJobAsPending() = runTest {
        val ticket = createSampleTicket()
        val result = repository.enqueueKot(ticket)

        assertTrue("First enqueue must succeed", result is EnqueueResult.Enqueued)
        val enqueued = (result as EnqueueResult.Enqueued).job
        assertEquals("PJ-KOT-ORD-202610-R1", enqueued.jobId)
        assertEquals("PENDING", enqueued.status)
        assertEquals(0, enqueued.retryCount)
        assertEquals(1, repository.getPendingCount())
    }

    @Test
    fun enqueueKot_duplicateSubmission_ignoresDuplicateAndPreservesSingleQueueEntry() = runTest {
        val ticket = createSampleTicket()

        // 1. Initial enqueue
        val firstResult = repository.enqueueKot(ticket)
        assertTrue(firstResult is EnqueueResult.Enqueued)
        assertEquals(1, repository.getPendingCount())

        // 2. Duplicate enqueue (e.g. listener re-firing, page refresh, network retry)
        val secondResult = repository.enqueueKot(ticket)
        assertTrue("Duplicate must be recognized as AlreadyQueued", secondResult is EnqueueResult.AlreadyQueued)

        // Count must strictly remain 1
        assertEquals(1, repository.getPendingCount())
        assertEquals(1, repository.getHistory().size)
    }

    @Test
    fun getPendingJobs_returnsJobsInFifoOrder() = runTest {
        val ticket1 = createSampleTicket(ticketId = "KOT-1")
        val ticket2 = createSampleTicket(ticketId = "KOT-2")

        repository.enqueueKot(ticket1)
        Thread.sleep(10) // Ensure distinct timestamp
        repository.enqueueKot(ticket2)

        val pending = repository.getPendingJobs()
        assertEquals(2, pending.size)
        assertEquals("PJ-KOT-1", pending[0].jobId)
        assertEquals("PJ-KOT-2", pending[1].jobId)
    }

    @Test
    fun claimJob_transitionsStatusFromPendingToSending() = runTest {
        val ticket = createSampleTicket()
        val enqueued = (repository.enqueueKot(ticket) as EnqueueResult.Enqueued).job

        val claimed = repository.claimJob(enqueued.jobId)
        assertTrue(claimed)

        val job = fakeDao.getJobById(enqueued.jobId)
        assertEquals("SENDING", job?.status)
        assertNotNull(job?.lastAttemptAt)
        // No longer in pending list
        assertEquals(0, repository.getPendingCount())
    }

    @Test
    fun recordSuccess_transitionsStatusFromSendingToPrinted() = runTest {
        val ticket = createSampleTicket()
        val enqueued = (repository.enqueueKot(ticket) as EnqueueResult.Enqueued).job
        repository.claimJob(enqueued.jobId)

        val success = repository.recordSuccess(enqueued.jobId)
        assertTrue(success)

        val job = fakeDao.getJobById(enqueued.jobId)
        assertEquals("PRINTED", job?.status)
        assertNull(job?.lastError)
        assertEquals(1, repository.getPrintedCount())
    }

    @Test
    fun recordFailure_recordsErrorAndSetsStatusToFailed() = runTest {
        val ticket = createSampleTicket()
        val enqueued = (repository.enqueueKot(ticket) as EnqueueResult.Enqueued).job
        repository.claimJob(enqueued.jobId)

        val recorded = repository.recordFailure(enqueued.jobId, "Printer out of paper (Paper End Sensor)")
        assertTrue(recorded)

        val job = fakeDao.getJobById(enqueued.jobId)
        assertEquals("FAILED", job?.status)
        assertEquals("Printer out of paper (Paper End Sensor)", job?.lastError)
    }

    @Test
    fun retryJob_reEnqueuesFailedJobAndIncrementsRetryCount() = runTest {
        val ticket = createSampleTicket()
        val enqueued = (repository.enqueueKot(ticket) as EnqueueResult.Enqueued).job
        repository.claimJob(enqueued.jobId)
        repository.recordFailure(enqueued.jobId, "Bluetooth socket timeout")

        val retried = repository.retryJob(enqueued.jobId, "User requested retry after paper reload")
        assertTrue(retried)

        val job = fakeDao.getJobById(enqueued.jobId)
        assertEquals("PENDING", job?.status)
        assertEquals(1, job?.retryCount)
        assertEquals(1, repository.getPendingCount())
    }

    @Test
    fun enqueueReprint_createsDistinctReprintJobWithoutModifyingOriginal() = runTest {
        val ticket = createSampleTicket()
        // 1. Original print enqueued and printed
        val origJob = (repository.enqueueKot(ticket) as EnqueueResult.Enqueued).job
        repository.claimJob(origJob.jobId)
        repository.recordSuccess(origJob.jobId)

        // 2. Explicit reprint requested (e.g. chef dropped ticket in water)
        val reprintResult = repository.enqueueReprint(ticket, reason = "Smudged by kitchen oil")
        assertTrue(reprintResult is EnqueueResult.ReprintEnqueued)

        val reprintJob = (reprintResult as EnqueueResult.ReprintEnqueued).job
        assertEquals("PJ-KOT-ORD-202610-R1-REPRINT-1", reprintJob.jobId)
        assertTrue(reprintJob.isReprint)
        assertEquals(1, reprintJob.reprintCount)
        assertEquals("PENDING", reprintJob.status)

        // Both original PRINTED job and new REPRINT PENDING job exist in history
        val history = repository.getHistory()
        assertEquals(2, history.size)
        assertEquals(1, repository.getPendingCount())
        assertEquals(1, repository.getPrintedCount())
    }

    @Test
    fun persistence_survivesRepositoryRecreation() = runTest {
        val ticket = createSampleTicket()
        repository.enqueueKot(ticket)

        // Simulate application restart: recreate repository with same underlying DAO
        val newRepo = PrintJobRepository(fakeDao)
        val pending = newRepo.getPendingJobs()

        assertEquals(1, pending.size)
        assertEquals("PJ-KOT-ORD-202610-R1", pending[0].jobId)
    }
}

/**
 * In-memory test implementation of PrintJobDao for deterministic JVM unit tests.
 */
class FakePrintJobDao : PrintJobDao {
    private val storage = LinkedHashMap<String, PrintJobEntity>()

    override fun insertJob(job: PrintJobEntity): Long {
        if (storage.containsKey(job.jobId)) {
            return -1L // IGNORE conflict
        }
        storage[job.jobId] = job
        return 1L
    }

    override fun getJobById(jobId: String): PrintJobEntity? {
        return storage[jobId]
    }

    override fun getJobsByTicketId(ticketId: String): List<PrintJobEntity> {
        return storage.values.filter { it.ticketId == ticketId }.sortedByDescending { it.createdAt }
    }

    override fun getPendingJobs(): List<PrintJobEntity> {
        return storage.values.filter { it.status == "PENDING" }.sortedBy { it.createdAt }
    }

    override fun updateJobStatus(jobId: String, status: String, lastAttemptAt: Long?, lastError: String?): Int {
        val existing = storage[jobId] ?: return 0
        storage[jobId] = PrintJobEntity(
            existing.jobId,
            existing.ticketId,
            existing.orderId,
            existing.ticketNumber,
            existing.tableNumber,
            existing.round,
            existing.isSupplementary,
            existing.isReprint,
            existing.reprintCount,
            existing.payloadJson,
            status,
            existing.retryCount,
            existing.createdAt,
            lastAttemptAt,
            lastError
        )
        return 1
    }

    override fun incrementRetry(jobId: String, lastAttemptAt: Long?, lastError: String?): Int {
        val existing = storage[jobId] ?: return 0
        storage[jobId] = PrintJobEntity(
            existing.jobId,
            existing.ticketId,
            existing.orderId,
            existing.ticketNumber,
            existing.tableNumber,
            existing.round,
            existing.isSupplementary,
            existing.isReprint,
            existing.reprintCount,
            existing.payloadJson,
            "PENDING",
            existing.retryCount + 1,
            existing.createdAt,
            lastAttemptAt,
            lastError
        )
        return 1
    }

    override fun getRecentHistory(limit: Int): List<PrintJobEntity> {
        return storage.values.sortedByDescending { it.createdAt }.take(limit)
    }

    override fun countPendingJobs(): Int {
        return storage.values.count { it.status == "PENDING" }
    }

    override fun countPrintedJobs(): Int {
        return storage.values.count { it.status == "PRINTED" }
    }
}
