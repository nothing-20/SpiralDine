package com.spiraldine.printbridge.data

import com.spiraldine.printbridge.data.local.PrintJobDao
import com.spiraldine.printbridge.data.local.PrintJobEntity
import com.spiraldine.printbridge.model.KotTicket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

sealed interface EnqueueResult {
    data class Enqueued(val job: PrintJobEntity) : EnqueueResult
    data class AlreadyQueued(val existingJob: PrintJobEntity) : EnqueueResult
    data class ReprintEnqueued(val job: PrintJobEntity) : EnqueueResult
}

/**
 * Repository orchestrating local persistent print queue lifecycle and deduplication.
 */
class PrintJobRepository(
    private val dao: PrintJobDao
) {

    /**
     * Idempotently enqueues a canonical Kitchen Order Ticket.
     * Prevents duplicate queue entries for the same canonical KOT.
     */
    suspend fun enqueueKot(ticket: KotTicket): EnqueueResult = withContext(Dispatchers.IO) {
        val deterministicJobId = "PJ-${ticket.ticketId}"

        // Check if canonical ticket is already in queue
        val existing = dao.getJobById(deterministicJobId)
        if (existing != null) {
            return@withContext EnqueueResult.AlreadyQueued(existing)
        }

        val entity = PrintJobEntity(
            deterministicJobId,
            ticket.ticketId,
            ticket.orderId,
            ticket.ticketNumber,
            ticket.tableNumber,
            ticket.round,
            ticket.isSupplementary,
            ticket.isReprint,
            ticket.reprintCount,
            serializeTicketPayload(ticket),
            "PENDING",
            0,
            System.currentTimeMillis(),
            null,
            null
        )

        val rowId = dao.insertJob(entity)
        if (rowId == -1L) {
            // Concurrent race collision fallback
            val raceExisting = dao.getJobById(deterministicJobId)
            if (raceExisting != null) {
                return@withContext EnqueueResult.AlreadyQueued(raceExisting)
            }
        }

        EnqueueResult.Enqueued(entity)
    }

    /**
     * Enqueues an intentional reprint attempt without altering canonical KOT identity or order numbers.
     */
    suspend fun enqueueReprint(ticket: KotTicket, reason: String? = null): EnqueueResult = withContext(Dispatchers.IO) {
        val existingJobs = dao.getJobsByTicketId(ticket.ticketId)
        val nextReprintCount = existingJobs.count { it.isReprint } + 1

        val reprintJobId = "PJ-${ticket.ticketId}-REPRINT-$nextReprintCount"
        val reprintTicket = ticket.copy(
            isReprint = true,
            reprintCount = nextReprintCount
        )

        val entity = PrintJobEntity(
            reprintJobId,
            ticket.ticketId,
            ticket.orderId,
            ticket.ticketNumber,
            ticket.tableNumber,
            ticket.round,
            ticket.isSupplementary,
            true,
            nextReprintCount,
            serializeTicketPayload(reprintTicket),
            "PENDING",
            0,
            System.currentTimeMillis(),
            null,
            reason?.let { "Reprint requested: $it" }
        )

        dao.insertJob(entity)
        EnqueueResult.ReprintEnqueued(entity)
    }

    suspend fun getPendingJobs(): List<PrintJobEntity> = withContext(Dispatchers.IO) {
        dao.getPendingJobs()
    }

    /**
     * Claims a pending job for transmission, transitioning state to SENDING.
     */
    suspend fun claimJob(jobId: String): Boolean = withContext(Dispatchers.IO) {
        val rows = dao.updateJobStatus(jobId, "SENDING", System.currentTimeMillis(), null)
        rows > 0
    }

    /**
     * Records successful transport transmission acceptance.
     * Note: In ESC/POS thermal printing over simplex Bluetooth SPP or raw TCP,
     * this confirms transport socket buffer delivery, not verified physical paper extrusion.
     */
    suspend fun recordSuccess(jobId: String): Boolean = withContext(Dispatchers.IO) {
        val rows = dao.updateJobStatus(jobId, "PRINTED", System.currentTimeMillis(), null)
        rows > 0
    }

    /**
     * Records failure and error details.
     */
    suspend fun recordFailure(jobId: String, errorMessage: String): Boolean = withContext(Dispatchers.IO) {
        val rows = dao.updateJobStatus(jobId, "FAILED", System.currentTimeMillis(), errorMessage)
        rows > 0
    }

    /**
     * Records an ambiguous physical outcome (socket write interrupted).
     * Marked INTERRUPTED so staff knows receipt may already have partially or fully printed.
     */
    suspend fun recordInterrupted(jobId: String, errorMessage: String): Boolean = withContext(Dispatchers.IO) {
        val rows = dao.updateJobStatus(jobId, "INTERRUPTED", System.currentTimeMillis(), errorMessage)
        rows > 0
    }

    /**
     * Records a job that was routed to other prep stations (not intended for this printer).
     */
    suspend fun recordSkippedStation(jobId: String, reason: String): Boolean = withContext(Dispatchers.IO) {
        val rows = dao.updateJobStatus(jobId, "ROUTED_OTHER_STATION", System.currentTimeMillis(), reason)
        rows > 0
    }

    /**
     * Re-enqueues a failed job for retry.
     */
    suspend fun retryJob(jobId: String, reason: String? = null): Boolean = withContext(Dispatchers.IO) {
        val rows = dao.incrementRetry(jobId, System.currentTimeMillis(), reason)
        rows > 0
    }

    /**
     * Manually authorizes retry of an ambiguous / interrupted job after explicit staff confirmation.
     */
    suspend fun forceRetryAmbiguousJob(jobId: String, confirmationReason: String = "Staff confirmed physical printer tray"): Boolean = withContext(Dispatchers.IO) {
        val rows = dao.incrementRetry(jobId, System.currentTimeMillis(), "Manual Retry Confirmed: $confirmationReason")
        rows > 0
    }

    suspend fun getJobById(jobId: String): PrintJobEntity? = withContext(Dispatchers.IO) {
        dao.getJobById(jobId)
    }

    suspend fun getHistory(limit: Int = 100): List<PrintJobEntity> = withContext(Dispatchers.IO) {
        dao.getRecentHistory(limit)
    }

    suspend fun getJobsByStatus(status: String, limit: Int = 50): List<PrintJobEntity> = withContext(Dispatchers.IO) {
        dao.getJobsByStatus(status, limit)
    }

    suspend fun getPendingCount(): Int = withContext(Dispatchers.IO) {
        dao.countPendingJobs()
    }

    suspend fun getPrintedCount(): Int = withContext(Dispatchers.IO) {
        dao.countPrintedJobs()
    }

    private fun serializeTicketPayload(ticket: KotTicket): String {
        return com.spiraldine.printbridge.model.KotTicketJson.toJson(ticket)
    }
}

