package com.spiraldine.printbridge.transport

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.OutputStream

class BluetoothTransportTest {

    @Test
    fun send_blankAddress_returnsImmediateFailure() = runTest {
        val transport = BluetoothTransport(deviceAddress = "   ")
        val result = transport.send(byteArrayOf(1, 2, 3))

        assertTrue(result is TransportResult.Failure)
        val failure = result as TransportResult.Failure
        assertFalse(failure.isRetryable)
        assertTrue(failure.errorMessage.contains("blank"))
    }

    @Test
    fun send_emptyPayload_returnsImmediateFailure() = runTest {
        val transport = BluetoothTransport(deviceAddress = "00:11:22:33:44:55")
        val result = transport.send(byteArrayOf())

        assertTrue(result is TransportResult.Failure)
        val failure = result as TransportResult.Failure
        assertFalse(failure.isRetryable)
        assertTrue(failure.errorMessage.contains("empty"))
    }

    @Test
    fun send_successfulTransmission_writesAllBytesAndClosesSocket() = runTest {
        val outStream = ByteArrayOutputStream()
        var socketClosed = false

        val fakeWrapper = object : BluetoothSocketWrapper {
            override fun connect() {}
            override fun getOutputStream(): OutputStream = outStream
            override fun close() {
                socketClosed = true
            }
        }

        val transport = BluetoothTransport(
            deviceAddress = "00:11:22:33:44:55",
            deviceName = "ESC/POS Thermal Printer",
            socketProvider = { fakeWrapper }
        )

        val payload = "BT_KOT_BYTES".toByteArray(Charsets.US_ASCII)
        val result = transport.send(payload)

        assertTrue("Expected Success", result is TransportResult.Success)
        val success = result as TransportResult.Success
        assertEquals(payload.size, success.bytesWritten)
        assertEquals("BT_KOT_BYTES", outStream.toString(Charsets.US_ASCII.name()))
        assertTrue("Socket must be closed in finally block", socketClosed)
    }

    @Test
    fun send_ioExceptionDuringConnect_returnsRetryableFailure() = runTest {
        var socketClosed = false
        val fakeWrapper = object : BluetoothSocketWrapper {
            override fun connect() {
                throw IOException("read failed, socket might closed or timeout, read ret: -1")
            }
            override fun getOutputStream(): OutputStream = ByteArrayOutputStream()
            override fun close() {
                socketClosed = true
            }
        }

        val transport = BluetoothTransport(
            deviceAddress = "00:11:22:33:44:55",
            deviceName = "POS-80",
            socketProvider = { fakeWrapper }
        )

        val result = transport.send(byteArrayOf(1, 2, 3))
        assertTrue(result is TransportResult.Failure)
        val failure = result as TransportResult.Failure
        assertTrue("Connect failure should be retryable", failure.isRetryable)
        assertFalse("Connect failure is not an interrupted write", failure.isInterrupted)
        assertTrue(failure.errorMessage.contains("I/O error"))
        assertTrue("Socket must be closed on connection failure", socketClosed)
    }

    @Test
    fun send_connectTimeout_returnsTimeoutFailure() = runTest {
        val fakeWrapper = object : BluetoothSocketWrapper {
            override fun connect() {
                try {
                    Thread.sleep(1000)
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                }
            }
            override fun getOutputStream(): OutputStream = ByteArrayOutputStream()
            override fun close() {}
        }

        val transport = BluetoothTransport(
            deviceAddress = "00:11:22:33:44:55",
            deviceName = "POS-80",
            connectTimeoutMs = 50L,
            socketProvider = { fakeWrapper }
        )

        val result = transport.send(byteArrayOf(1, 2, 3))
        assertTrue("Expected Failure result", result is TransportResult.Failure)
        val failure = result as TransportResult.Failure
        assertTrue("Expected timeout error: ${failure.errorMessage}", failure.errorMessage.contains("timed out"))
    }
}

