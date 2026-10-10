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
     * Records successful transmission/print confirmation.
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
     * Re-enqueues a failed job for retry.
     */
    suspend fun retryJob(jobId: String, reason: String? = null): Boolean = withContext(Dispatchers.IO) {
        val rows = dao.incrementRetry(jobId, System.currentTimeMillis(), reason)
        rows > 0
    }

    suspend fun getHistory(limit: Int = 50): List<PrintJobEntity> = withContext(Dispatchers.IO) {
        dao.getRecentHistory(limit)
    }

    suspend fun getPendingCount(): Int = withContext(Dispatchers.IO) {
        dao.countPendingJobs()
    }

    suspend fun getPrintedCount(): Int = withContext(Dispatchers.IO) {
        dao.countPrintedJobs()
    }

    private fun serializeTicketPayload(ticket: KotTicket): String {
        val itemsSummary = ticket.items.joinToString(";") { "${it.name}:${it.quantity}" }
        return "TICKET_ID=${ticket.ticketId}|ORDER=${ticket.orderId}|TABLE=${ticket.tableNumber}|ITEMS=[$itemsSummary]|REPRINT=${ticket.isReprint}"
    }
}
