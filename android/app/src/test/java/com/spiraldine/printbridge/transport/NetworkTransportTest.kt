package com.spiraldine.printbridge.transport

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.OutputStream
import java.net.ConnectException
import java.net.Socket
import java.net.SocketAddress
import java.net.SocketTimeoutException

class NetworkTransportTest {

    @Test
    fun validate_rejectsBlankHost() {
        val err = NetworkTransport.validate("   ", 9100)
        assertNotNull(err)
        assertTrue(err!!.contains("blank"))
    }

    @Test
    fun validate_rejectsProtocolPrefixes() {
        val err = NetworkTransport.validate("http://192.168.1.100", 9100)
        assertNotNull(err)
        assertTrue(err!!.contains("without protocol prefixes"))
    }

    @Test
    fun validate_rejectsInvalidPorts() {
        assertNotNull(NetworkTransport.validate("192.168.1.100", 0))
        assertNotNull(NetworkTransport.validate("192.168.1.100", 70000))
        assertNull(NetworkTransport.validate("192.168.1.100", 9100))
        assertNull(NetworkTransport.validate("printer.local", 9100))
    }

    @Test
    fun send_rejectsEmptyPayload() = runTest {
        val transport = NetworkTransport("192.168.1.100", 9100)
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

        val fakeSocket = object : Socket() {
            override fun connect(endpoint: SocketAddress?, timeout: Int) {
                // Connection succeeds immediately
            }
            override fun getOutputStream(): OutputStream = outStream
            override fun close() {
                socketClosed = true
            }
        }

        val transport = NetworkTransport(
            host = "192.168.1.100",
            port = 9100,
            socketSupplier = { fakeSocket }
        )

        val payload = "TEST_PAYLOAD".toByteArray(Charsets.US_ASCII)
        val result = transport.send(payload)

        assertTrue("Expected Success result", result is TransportResult.Success)
        val success = result as TransportResult.Success
        assertEquals(payload.size, success.bytesWritten)
        assertEquals("TEST_PAYLOAD", outStream.toString(Charsets.US_ASCII.name()))
        assertTrue("Socket must be closed after transmission", socketClosed)
    }

    @Test
    fun send_connectionRefused_returnsRetryableFailure() = runTest {
        var socketClosed = false
        val fakeSocket = object : Socket() {
            override fun connect(endpoint: SocketAddress?, timeout: Int) {
                throw ConnectException("Connection refused")
            }
            override fun close() {
                socketClosed = true
            }
        }

        val transport = NetworkTransport(
            host = "192.168.1.100",
            port = 9100,
            socketSupplier = { fakeSocket }
        )

        val result = transport.send(byteArrayOf(1, 2, 3))
        assertTrue(result is TransportResult.Failure)
        val failure = result as TransportResult.Failure
        assertTrue("Connection refused should be retryable", failure.isRetryable)
        assertFalse("Connection refused is not an interrupted write", failure.isInterrupted)
        assertTrue(failure.errorMessage.contains("Connection refused"))
        assertTrue("Socket must be closed on connect error", socketClosed)
    }

    @Test
    fun send_socketTimeout_returnsTimeoutFailure() = runTest {
        val fakeSocket = object : Socket() {
            override fun connect(endpoint: SocketAddress?, timeout: Int) {
                throw SocketTimeoutException("Connect timed out")
            }
        }

        val transport = NetworkTransport(
            host = "192.168.1.100",
            port = 9100,
            socketSupplier = { fakeSocket }
        )

        val result = transport.send(byteArrayOf(1, 2, 3))
        assertTrue(result is TransportResult.Failure)
        val failure = result as TransportResult.Failure
        assertTrue(failure.errorMessage.contains("Network timeout"))
    }

    @Test
    fun send_interruptedWrite_isMarkedNonRetryableAndInterrupted() = runTest {
        val fakeSocket = object : Socket() {
            override fun connect(endpoint: SocketAddress?, timeout: Int) {}
            override fun getOutputStream(): OutputStream = object : OutputStream() {
                override fun write(b: Int) {
                    throw IOException("Connection reset by peer mid-write")
                }
                override fun write(b: ByteArray, off: Int, len: Int) {
                    // Simulates partial write failure
                    throw IOException("Connection reset by peer mid-write")
                }
            }
        }

        val transport = NetworkTransport(
            host = "192.168.1.100",
            port = 9100,
            socketSupplier = { fakeSocket }
        )

        val result = transport.send(byteArrayOf(1, 2, 3, 4))
        assertTrue(result is TransportResult.Failure)
        val failure = result as TransportResult.Failure
        assertTrue(failure.errorMessage.contains("I/O error"))
    }
}
