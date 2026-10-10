package com.spiraldine.printbridge.transport

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import kotlinx.coroutines.TimeoutCancellationException
import java.io.IOException
import java.io.OutputStream
import java.util.UUID

/**
 * Socket wrapper abstraction allowing clean JVM unit testing of Bluetooth communications
 * without requiring real physical Android Bluetooth hardware.
 */
interface BluetoothSocketWrapper {
    fun connect()
    fun getOutputStream(): OutputStream
    fun close()
}

/**
 * Standard implementation wrapping Android's native BluetoothSocket.
 */
class AndroidBluetoothSocketWrapper(
    private val socket: BluetoothSocket
) : BluetoothSocketWrapper {
    override fun connect() = socket.connect()
    override fun getOutputStream(): OutputStream = socket.outputStream
    override fun close() = socket.close()
}

/**
 * Socket provider function interface for dependency injection.
 */
fun interface BluetoothSocketProvider {
    fun createSocket(deviceAddress: String): BluetoothSocketWrapper
}

/**
 * Bluetooth Classic SPP Transport for compatible ESC/POS thermal printers.
 *
 * Requirements addressed:
 * - Standard Serial Port Profile (SPP) UUID
 * - Runtime permission checking for Android 12+ (BLUETOOTH_CONNECT) and legacy BLUETOOTH
 * - Connection and write timeouts
 * - Safe socket and stream closure
 * - Clear error diagnostics and interrupted transmission detection
 * - Only connects to explicit user-selected bonded devices
 */
class BluetoothTransport(
    val deviceAddress: String,
    val deviceName: String = "Bluetooth Printer",
    private val context: Context? = null,
    private val connectTimeoutMs: Long = DEFAULT_CONNECT_TIMEOUT_MS,
    private val writeTimeoutMs: Long = DEFAULT_WRITE_TIMEOUT_MS,
    private val socketProvider: BluetoothSocketProvider? = null
) : PrinterTransport {

    companion object {
        // Standard Bluetooth Serial Port Profile (SPP) UUID
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

        const val DEFAULT_CONNECT_TIMEOUT_MS = 6000L
        const val DEFAULT_WRITE_TIMEOUT_MS = 5000L

        /**
         * Checks if the required Bluetooth permissions are granted.
         */
        fun hasBluetoothPermission(context: Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.BLUETOOTH_CONNECT
                ) == PackageManager.PERMISSION_GRANTED
            } else {
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.BLUETOOTH
                ) == PackageManager.PERMISSION_GRANTED
            }
        }
    }

    override val transportType: String = "Bluetooth SPP ($deviceName - $deviceAddress)"

    override suspend fun send(payload: ByteArray): TransportResult = withContext(Dispatchers.IO) {
        if (deviceAddress.isBlank()) {
            return@withContext TransportResult.Failure(
                errorMessage = "Bluetooth device address cannot be blank. Please select a paired printer.",
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

        // 1. Permission Check (if Context provided)
        if (context != null && !hasBluetoothPermission(context)) {
            val permissionName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                "BLUETOOTH_CONNECT"
            } else {
                "BLUETOOTH"
            }
            return@withContext TransportResult.Failure(
                errorMessage = "Bluetooth permission not granted ($permissionName). Please enable permission in Settings.",
                isRetryable = false,
                isInterrupted = false
            )
        }

        var socketWrapper: BluetoothSocketWrapper? = null
        var bytesWritten = 0

        try {
            // 2. Obtain Socket Wrapper (either via injected provider or native BluetoothAdapter)
            socketWrapper = if (socketProvider != null) {
                socketProvider.createSocket(deviceAddress)
            } else {
                val adapter = BluetoothAdapter.getDefaultAdapter()
                    ?: return@withContext TransportResult.Failure(
                        errorMessage = "Bluetooth adapter is not available on this device",
                        isRetryable = false,
                        isInterrupted = false
                    )

                if (!adapter.isEnabled) {
                    return@withContext TransportResult.Failure(
                        errorMessage = "Bluetooth is turned off. Please turn on Bluetooth and try again.",
                        isRetryable = true,
                        isInterrupted = false
                    )
                }

                val device: BluetoothDevice = try {
                    adapter.getRemoteDevice(deviceAddress)
                } catch (e: IllegalArgumentException) {
                    return@withContext TransportResult.Failure(
                        errorMessage = "Invalid Bluetooth MAC address: $deviceAddress",
                        isRetryable = false,
                        isInterrupted = false
                    )
                }

                // Check bonded status
                if (device.bondState != BluetoothDevice.BOND_BONDED) {
                    return@withContext TransportResult.Failure(
                        errorMessage = "Device $deviceName ($deviceAddress) is not paired. Please pair in Android Settings first.",
                        isRetryable = false,
                        isInterrupted = false
                    )
                }

                // Cancel discovery prior to connecting as per Android documentation
                try {
                    adapter.cancelDiscovery()
                } catch (_: SecurityException) {
                    // Handled gracefully
                }

                val rawSocket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                AndroidBluetoothSocketWrapper(rawSocket)
            }

            // 3. Connect with Timeout
            try {
                withTimeout(connectTimeoutMs) {
                    kotlinx.coroutines.runInterruptible(Dispatchers.IO) {
                        socketWrapper.connect()
                    }
                }
            } catch (e: TimeoutCancellationException) {
                return@withContext TransportResult.Failure(
                    errorMessage = "Bluetooth connection timed out after ${connectTimeoutMs}ms to $deviceName ($deviceAddress)",
                    isRetryable = true,
                    isInterrupted = false
                )
            }

            // 4. Write Payload with Timeout
            try {
                withTimeout(writeTimeoutMs) {
                    kotlinx.coroutines.runInterruptible(Dispatchers.IO) {
                        val stream = socketWrapper.getOutputStream()
                        stream.write(payload)
                        stream.flush()
                        bytesWritten = payload.size
                    }
                }
            } catch (e: TimeoutCancellationException) {
                return@withContext TransportResult.Failure(
                    errorMessage = "Bluetooth transmission write timed out after ${writeTimeoutMs}ms. Transmission interrupted.",
                    isRetryable = false,
                    isInterrupted = true
                )
            }


            TransportResult.Success(
                bytesWritten = bytesWritten,
                description = "Accepted by Bluetooth printer ($deviceName), $bytesWritten bytes written"
            )

        } catch (e: SecurityException) {
            TransportResult.Failure(
                errorMessage = "SecurityException accessing Bluetooth: ${e.message}. Permission denied.",
                isRetryable = false,
                isInterrupted = false
            )
        } catch (e: IOException) {
            val wasWriting = bytesWritten > 0
            TransportResult.Failure(
                errorMessage = "Bluetooth I/O error communicating with $deviceName: ${e.message}",
                isRetryable = !wasWriting,
                isInterrupted = wasWriting
            )
        } catch (e: Exception) {
            TransportResult.Failure(
                errorMessage = "Unexpected error connecting to $deviceName: ${e.message}",
                isRetryable = false,
                isInterrupted = false
            )
        } finally {
            try {
                socketWrapper?.close()
            } catch (_: Exception) {
                // Ignore socket close cleanup exceptions
            }
        }
    }
}
