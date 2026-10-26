package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.OrderHistoryState
import com.spiralworld.spiraldine.data.model.OrderRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OrderHistoryStateTest {

    @Test
    fun orderHistoryState_genuineEmptyIsDistinctFromAuthorizationError() {
        val emptyState: OrderHistoryState = OrderHistoryState.Empty
        val authErrorState: OrderHistoryState = OrderHistoryState.AuthorizationError("Sign in to view your authentic order history.")

        assertNotEquals(emptyState, authErrorState)
        assertTrue(emptyState is OrderHistoryState.Empty)
        assertTrue(authErrorState is OrderHistoryState.AuthorizationError)
        assertFalse(authErrorState is OrderHistoryState.Empty)
    }

    @Test
    fun orderHistoryState_permissionDeniedDoesNotProduceFakeEmptyList() {
        val authError: OrderHistoryState = OrderHistoryState.AuthorizationError("Authorization failed: Please verify your sign-in status.")
        assertTrue("Permission-denied must be mapped to AuthorizationError", authError is OrderHistoryState.AuthorizationError)
        assertFalse("Permission-denied must never be masked as Empty state", authError is OrderHistoryState.Empty)
    }

    @Test
    fun orderHistoryState_networkFailureIsRetryable() {
        val netError = OrderHistoryState.NetworkError(
            message = "Network issue: Unable to fetch order history.",
            isRetryable = true
        )
        assertTrue(netError.isRetryable)
        assertEquals("Network issue: Unable to fetch order history.", netError.message)
    }

    @Test
    fun orderHistoryState_unauthenticatedUserProducesAuthError() {
        val unauthState = OrderHistoryState.AuthorizationError("Sign in to view your authentic order history.")
        assertEquals("Sign in to view your authentic order history.", unauthState.message)
        val genericState: OrderHistoryState = unauthState
        assertFalse("Unauthenticated state must not contain fake success records", genericState is OrderHistoryState.Success)
    }

    @Test
    fun orderHistoryState_successPreservesOrderRecordsWithoutLeakage() {
        val testOrders = listOf(
            OrderRecord(orderId = "ORD-001", customerId = "cust-alice", total = 450.0, status = "PREPARING"),
            OrderRecord(orderId = "ORD-002", customerId = "cust-alice", total = 220.0, status = "SERVED")
        )
        val successState = OrderHistoryState.Success(testOrders)

        assertEquals(2, successState.orders.size)
        assertEquals("ORD-001", successState.orders[0].orderId)
        assertEquals("cust-alice", successState.orders[0].customerId)
    }

    @Test
    fun orderHistoryState_errorMessageDoesNotExposeSensitiveTokensOrCredentials() {
        val sanitizedError = OrderHistoryState.AuthorizationError("Authorization failed: Please verify your sign-in status.")
        assertFalse(sanitizedError.message.contains("bearer", ignoreCase = true))
        assertFalse(sanitizedError.message.contains("token", ignoreCase = true))
        assertFalse(sanitizedError.message.contains("password", ignoreCase = true))
        assertFalse(sanitizedError.message.contains("secret", ignoreCase = true))
    }
}
