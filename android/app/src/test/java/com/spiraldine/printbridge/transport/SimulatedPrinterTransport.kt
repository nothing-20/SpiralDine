package com.spiraldine.printbridge.transport

import java.nio.charset.Charset

/**
 * Test-only simulated printer transport.
 *
 * Isolated strictly to test sources so that production code and users can never
 * select or communicate with a fake printer.
 *
 * Capabilities:
 * - Accepts formatted ESC/POS byte payloads without opening physical Bluetooth/TCP sockets.
 * - Records all submissions with timestamps, byte lengths, and decoded text content for assertions.
 * - Configurable simulation behaviors: Success, Connection Failure, Write Failure, Interrupted Transmission.
 * - Supports sequential/transient failure simulation (e.g. fail attempt 1, succeed attempt 2).
 * - Tracks submission counts and detects duplicate attempts.
 */
class SimulatedPrinterTransport(
    initialBehavior: SimulationBehavior = SimulationBehavior.SUCCESS
) : PrinterTransport {

    enum class SimulationBehavior {
        /** Socket buffer accepts all bytes cleanly */
        SUCCESS,
        /** Initial socket connection fails (retryable) */
        CONNECTION_FAILURE,
        /** Socket write I/O error during stream transmission (retryable) */
        WRITE_FAILURE,
        /** Mid-stream socket break: partial bytes transferred, ambiguous physical state (non-retryable) */
        INTERRUPTED
    }

    data class SimulatedSubmission(
        val index: Int,
        val payload: ByteArray,
        val textContent: String,
        val timestamp: Long,
        val result: TransportResult
    )

    override val transportType: String = "Simulated Thermal Printer (Test Only)"

    private var currentBehavior: SimulationBehavior = initialBehavior
    private var customHandler: ((ByteArray, Int) -> TransportResult)? = null

    private val _submissions = mutableListOf<SimulatedSubmission>()
    val submissions: List<SimulatedSubmission> get() = _submissions.toList()

    val totalSubmissions: Int get() = _submissions.size
    val successfulSubmissions: Int get() = _submissions.count { it.result is TransportResult.Success }
    val failedSubmissions: Int get() = _submissions.count { it.result is TransportResult.Failure }

    val lastSubmission: SimulatedSubmission? get() = _submissions.lastOrNull()
    val lastPayload: ByteArray? get() = lastSubmission?.payload
    val lastTextContent: String? get() = lastSubmission?.textContent

    fun setBehavior(behavior: SimulationBehavior) {
        this.currentBehavior = behavior
        this.customHandler = null
    }

    /**
     * Allows custom logic per submission attempt (e.g. fail on attempt 1, succeed on attempt 2).
     */
    fun setCustomHandler(handler: (payload: ByteArray, attemptIndex: Int) -> TransportResult) {
        this.customHandler = handler
    }

    override suspend fun send(payload: ByteArray): TransportResult {
        val attemptIndex = _submissions.size + 1
        val textContent = decodeAsciiSafe(payload)

        val result = customHandler?.invoke(payload, attemptIndex) ?: when (currentBehavior) {
            SimulationBehavior.SUCCESS -> {
                TransportResult.Success(
                    bytesWritten = payload.size,
                    description = "Simulated transport buffer write accepted (${payload.size} bytes)"
                )
            }
            SimulationBehavior.CONNECTION_FAILURE -> {
                TransportResult.Failure(
                    errorMessage = "Simulated connection refused: thermal printer offline at port 9100",
                    isRetryable = true,
                    isInterrupted = false
                )
            }
            SimulationBehavior.WRITE_FAILURE -> {
                TransportResult.Failure(
                    errorMessage = "Simulated socket write error: connection reset by peer",
                    isRetryable = true,
                    isInterrupted = false
                )
            }
            SimulationBehavior.INTERRUPTED -> {
                TransportResult.Failure(
                    errorMessage = "Simulated socket broken mid-write: partial buffer transferred (180/${payload.size} bytes)",
                    isRetryable = false,
                    isInterrupted = true
                )
            }
        }

        _submissions.add(
            SimulatedSubmission(
                index = attemptIndex,
                payload = payload,
                textContent = textContent,
                timestamp = System.currentTimeMillis(),
                result = result
            )
        )

        return result
    }

    fun hasText(snippet: String): Boolean {
        return _submissions.any { it.textContent.contains(snippet, ignoreCase = true) }
    }

    fun countSubmissionsContaining(snippet: String): Int {
        return _submissions.count { it.textContent.contains(snippet, ignoreCase = true) }
    }

    fun clear() {
        _submissions.clear()
        customHandler = null
        currentBehavior = SimulationBehavior.SUCCESS
    }

    private fun decodeAsciiSafe(bytes: ByteArray): String {
        return try {
            String(bytes, Charset.forName("CP437"))
        } catch (_: Exception) {
            String(bytes, Charsets.US_ASCII)
        }
    }
}
