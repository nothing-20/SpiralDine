package com.spiraldine.printbridge.transport

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.ConnectException
import java.net.InetSocketAddress
import java.net.NoRouteToHostException
import java.net.Socket
import java.net.SocketTimeoutException
import java.net.UnknownHostException

/**
 * Socket supplier interface to enable deterministic unit testing without physical LAN printers.
 */
fun interface SocketSupplier {
    fun createSocket(): Socket
}

/**
 * Raw TCP/IP Socket transport for ESC/POS thermal receipt printers (typically Port 9100).
 *
 * Requirements addressed:
 * - Host and port validation
 * - Connection and write timeouts
 * - Safe resource closure in finally blocks
 * - Distinction between connection failure and interrupted write
 * - No network scanning or arbitrary auto-connections
 */
class NetworkTransport(
    val host: String,
    val port: Int = DEFAULT_PORT,
    private val connectTimeoutMs: Int = DEFAULT_CONNECT_TIMEOUT_MS,
    private val writeTimeoutMs: Int = DEFAULT_WRITE_TIMEOUT_MS,
    private val socketSupplier: SocketSupplier = SocketSupplier { Socket() }
) : PrinterTransport {

    companion object {
        const val DEFAULT_PORT = 9100
        const val DEFAULT_CONNECT_TIMEOUT_MS = 5000
        const val DEFAULT_WRITE_TIMEOUT_MS = 5000

        /**
         * Validates host and port combination.
         * @return Error message if invalid, null if valid.
         */
        fun validate(host: String, port: Int): String? {
            val trimmedHost = host.trim()
            if (trimmedHost.isBlank()) {
                return "Host address cannot be blank"
            }
            if (trimmedHost.contains("://") || trimmedHost.contains("/")) {
                return "Host must be an IP address or hostname without protocol prefixes (e.g., 192.168.1.100)"
            }
            if (port !in 1..65535) {
                return "Port must be between 1 and 65535 (standard raw ESC/POS port is 9100)"
            }
            return null
        }
    }

    override val transportType: String = "TCP/IP Network ($host:$port)"

    override suspend fun send(payload: ByteArray): TransportResult = withContext(Dispatchers.IO) {
        val validationError = validate(host, port)
        if (validationError != null) {
            return@withContext TransportResult.Failure(
                errorMessage = validationError,
                isRetryable = false,
                isInterrupted = false
            )
        }

        if (payload.isEmpty()) {
            return@withContext TransportResult.Failure(
                errorMessage = "Cannot send empty print payload",
                isRetryable = false,
                isInterrupted = false
            )
        }

        var socket: Socket? = null
        var bytesWritten = 0

        try {
            socket = socketSupplier.createSocket().apply {
                soTimeout = writeTimeoutMs
            }

            val socketAddress = InetSocketAddress(host.trim(), port)
            socket.connect(socketAddress, connectTimeoutMs)

            val outputStream = socket.getOutputStream()
            outputStream.write(payload)
            outputStream.flush()
            bytesWritten = payload.size

            TransportResult.Success(
                bytesWritten = bytesWritten,
                description = "Accepted by network printer ($host:$port), $bytesWritten bytes written"
            )
        } catch (e: SocketTimeoutException) {
            val wasWriting = bytesWritten > 0
            TransportResult.Failure(
                errorMessage = "Network timeout ($writeTimeoutMs ms) communicating with printer at $host:$port: ${e.message}",
                isRetryable = !wasWriting,
                isInterrupted = wasWriting
            )
        } catch (e: ConnectException) {
            TransportResult.Failure(
                errorMessage = "Connection refused by printer at $host:$port. Verify printer IP, power, and port 9100.",
                isRetryable = true,
                isInterrupted = false
            )
        } catch (e: NoRouteToHostException) {
            TransportResult.Failure(
                errorMessage = "No route to host $host. Verify device is on the same local network / subnet.",
                isRetryable = true,
                isInterrupted = false
            )
        } catch (e: UnknownHostException) {
            TransportResult.Failure(
                errorMessage = "Host name cannot be resolved: $host",
                isRetryable = false,
                isInterrupted = false
            )
        } catch (e: IOException) {
            val wasWriting = bytesWritten > 0
            TransportResult.Failure(
                errorMessage = "I/O error transmitting to printer $host:$port: ${e.message}",
                isRetryable = !wasWriting,
                isInterrupted = wasWriting
            )
        } catch (e: Exception) {
            TransportResult.Failure(
                errorMessage = "Unexpected error transmitting to $host:$port: ${e.message}",
                isRetryable = false,
                isInterrupted = false
            )
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {
                // Ignore socket close cleanup exceptions
            }
        }
    }
}
