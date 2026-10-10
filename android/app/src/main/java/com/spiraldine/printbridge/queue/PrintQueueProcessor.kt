package com.spiraldine.printbridge.queue

import com.spiraldine.printbridge.data.PrintJobRepository
import com.spiraldine.printbridge.formatter.EscPosKOTFormatter
import com.spiraldine.printbridge.model.KotTicketJson
import com.spiraldine.printbridge.model.ThermalPaperWidth
import com.spiraldine.printbridge.transport.PrinterTransport
import com.spiraldine.printbridge.transport.TransportResult
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Result of attempting to dispatch a queue job to a printer transport.
 */
sealed interface QueueProcessResult {
    data object Idle : QueueProcessResult
    data class ClaimFailed(val jobId: String) : QueueProcessResult
    data class Success(val jobId: String, val bytesWritten: Int) : QueueProcessResult
    data class Retrying(val jobId: String, val attemptNumber: Int, val reason: String) : QueueProcessResult
    data class Failed(val jobId: String, val reason: String) : QueueProcessResult
    data class Interrupted(val jobId: String, val reason: String) : QueueProcessResult
    data class SkippedStation(val jobId: String, val reason: String) : QueueProcessResult
}

/**
 * Queue processor coordinating Room print jobs and thermal printer transports.
 *
 * Requirements addressed:
 * - Mutex-based concurrency protection preventing duplicate dispatch of the same ticket
 * - Safe atomic job claiming (PENDING -> SENDING)
 * - Dynamic ESC/POS formatting according to target paper width
 * - Station routing filter preserving all items without silent loss
 * - Bounded retries (default max 3) with failure recording
 * - Conservative interrupted transmission handling (no automatic retries on partial writes)
 * - Safe preservation of all job history (no automatic job deletion)
 */
class PrintQueueProcessor(
    private val repository: PrintJobRepository,
    private val formatter: EscPosKOTFormatter = EscPosKOTFormatter(),
    private val maxRetries: Int = DEFAULT_MAX_RETRIES
) {

    companion object {
        const val DEFAULT_MAX_RETRIES = 3
    }

    // Mutex ensuring only one worker or coroutine accesses the printer transport at a time
    private val transportMutex = Mutex()

    /**
     * Processes the next pending job in the queue using the supplied printer transport.
     * Guaranteed thread-safe and non-reentrant across concurrent dispatch calls.
     */
    suspend fun processNextJob(
        transport: PrinterTransport,
        paperWidth: ThermalPaperWidth = ThermalPaperWidth.WIDTH_80MM,
        stationFilter: String = "ALL"
    ): QueueProcessResult = transportMutex.withLock {
        // 1. Fetch pending jobs in deterministic FIFO order
        val pending = repository.getPendingJobs()
        if (pending.isEmpty()) {
            return QueueProcessResult.Idle
        }

        val targetJob = pending.first()

        // 2. Safely claim the job (PENDING -> SENDING)
        val claimed = repository.claimJob(targetJob.jobId)
        if (!claimed) {
            return QueueProcessResult.ClaimFailed(targetJob.jobId)
        }

        // 3. Reconstruct ticket
        val ticket = try {
            KotTicketJson.fromJson(targetJob.payloadJson)
        } catch (e: Exception) {
            val errorMsg = "Payload deserialization error: ${e.message}"
            repository.recordFailure(targetJob.jobId, errorMsg)
            return QueueProcessResult.Failed(targetJob.jobId, errorMsg)
        }

        // 4. Kitchen-Station Routing Check
        val routing = com.spiraldine.printbridge.routing.KotStationRouter.routeTicket(ticket, stationFilter)
        val ticketToPrint = when (routing) {
            is com.spiraldine.printbridge.routing.StationRoutingResult.Full -> routing.ticket
            is com.spiraldine.printbridge.routing.StationRoutingResult.Partial -> routing.ticket
            is com.spiraldine.printbridge.routing.StationRoutingResult.Excluded -> {
                // Zero matching items for this station. Job belongs to other physical prep stations.
                // Mark in database as ROUTED_OTHER_STATION to avoid dropping or re-trying.
                repository.recordSkippedStation(targetJob.jobId, routing.reason)
                return QueueProcessResult.SkippedStation(targetJob.jobId, routing.reason)
            }
        }

        // 5. Format ESC/POS byte array
        val escPosBytes = try {
            formatter.formatKot(ticketToPrint, paperWidth)
        } catch (e: Exception) {
            val errorMsg = "ESC/POS formatting error: ${e.message}"
            repository.recordFailure(targetJob.jobId, errorMsg)
            return QueueProcessResult.Failed(targetJob.jobId, errorMsg)
        }

        // 6. Send to physical or network transport
        val transportResult = transport.send(escPosBytes)

        // 7. Handle transport result
        return when (transportResult) {
            is TransportResult.Success -> {
                // Record success (transport accepted bytes)
                repository.recordSuccess(targetJob.jobId)
                QueueProcessResult.Success(targetJob.jobId, transportResult.bytesWritten)
            }
            is TransportResult.Failure -> {
                if (transportResult.isInterrupted) {
                    // Critical rule: Interrupted writes must NOT automatically retry to prevent physical duplicate tickets
                    val errorMsg = "INTERRUPTED: Partial socket write. Manual inspection required before retry. Detail: ${transportResult.errorMessage}"
                    repository.recordInterrupted(targetJob.jobId, errorMsg)
                    QueueProcessResult.Interrupted(targetJob.jobId, errorMsg)
                } else if (transportResult.isRetryable && targetJob.retryCount < maxRetries) {
                    val retryReason = "Transport failure: ${transportResult.errorMessage}"
                    repository.retryJob(targetJob.jobId, retryReason)
                    QueueProcessResult.Retrying(targetJob.jobId, targetJob.retryCount + 1, retryReason)
                } else {
                    val finalReason = if (targetJob.retryCount >= maxRetries) {
                        "Max retry limit ($maxRetries) reached. Last error: ${transportResult.errorMessage}"
                    } else {
                        "Non-retryable transport error: ${transportResult.errorMessage}"
                    }
                    repository.recordFailure(targetJob.jobId, finalReason)
                    QueueProcessResult.Failed(targetJob.jobId, finalReason)
                }
            }
        }
    }
}
