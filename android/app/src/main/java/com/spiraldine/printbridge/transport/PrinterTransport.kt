package com.spiraldine.printbridge.transport

/**
 * Result of attempting to transmit an ESC/POS payload to a thermal printer transport.
 */
sealed interface TransportResult {
    /**
     * Payload was written to the underlying transport stream without I/O exceptions.
     * Note: This confirms transport acceptance, but cannot guarantee paper roll delivery without bidirectional status querying.
     */
    data class Success(
        val bytesWritten: Int,
        val description: String = "Transport socket write accepted"
    ) : TransportResult

    /**
     * Payload transmission failed.
     * @param errorMessage Descriptive diagnostics of the failure.
     * @param isRetryable Whether an immediate or backoff retry is safe.
     * @param isInterrupted True if transmission failed mid-write. In this case, automatic retries
     *                      are hazardous because the printer may have already printed a partial ticket.
     */
    data class Failure(
        val errorMessage: String,
        val isRetryable: Boolean = true,
        val isInterrupted: Boolean = false
    ) : TransportResult
}

/**
 * Common abstraction for ESC/POS printer transport channels.
 */
interface PrinterTransport {
    val transportType: String
    suspend fun send(payload: ByteArray): TransportResult
}
