package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.CustomerUser
import com.spiralworld.spiraldine.data.model.PaymentOrder
import com.spiralworld.spiraldine.data.model.PaymentVerification
import com.spiralworld.spiraldine.data.repository.PaymentApiClient
import com.spiralworld.spiraldine.data.repository.PaymentRepository
import com.spiralworld.spiraldine.data.repository.PaymentUiState
import com.spiralworld.spiraldine.data.repository.SdkCheckoutResult
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class MockPaymentApiClient : PaymentApiClient {
    var shouldFailOrderCreation = false
    var shouldFailVerification = false
    var verificationSuccess = true

    override suspend fun createPaymentOrder(
        tenantId: String,
        orderId: String,
        billId: String?,
        customer: CustomerUser?
    ): Result<PaymentOrder> {
        if (shouldFailOrderCreation) {
            return Result.failure(Exception("Server failed to create order"))
        }
        return Result.success(
            PaymentOrder(
                provider = "razorpay",
                providerOrderId = "order_test_123",
                keyId = "rzp_test_key",
                amountInCents = 25000.0,
                amountInRupees = 250.0,
                orderId = orderId,
                billId = billId ?: "BILL-$orderId",
                tenantId = tenantId
            )
        )
    }

    override suspend fun verifyPayment(
        tenantId: String,
        orderId: String,
        billId: String?,
        providerOrderId: String,
        razorpayPaymentId: String?,
        razorpaySignature: String?
    ): Result<PaymentVerification> {
        if (shouldFailVerification) {
            return Result.failure(Exception("Network error on verify"))
        }
        return Result.success(
            PaymentVerification(
                success = verificationSuccess,
                provider = "razorpay",
                providerOrderId = providerOrderId,
                paymentReference = if (verificationSuccess) "TXN-VERIFIED-999" else null,
                status = if (verificationSuccess) "PAID" else "FAILED",
                errorMessage = if (!verificationSuccess) "Invalid signature from gateway" else null
            )
        )
    }
}

class PaymentRepositoryTest {

    private lateinit var mockClient: MockPaymentApiClient
    private lateinit var paymentRepository: PaymentRepository

    @Before
    fun setUp() {
        mockClient = MockPaymentApiClient()
        paymentRepository = PaymentRepository(apiClient = mockClient)
    }

    @Test
    fun startPayment_success_movesToAwaitingCheckoutState() = runTest {
        val result = paymentRepository.startPayment(
            tenantId = "rest-oasis",
            orderId = "ORD-001",
            billId = "BILL-ORD-001"
        )

        assertTrue(result.isSuccess)
        val state = paymentRepository.uiState.value
        assertTrue("State should be AwaitingSdkCheckout", state is PaymentUiState.AwaitingSdkCheckout)
        assertEquals("order_test_123", (state as PaymentUiState.AwaitingSdkCheckout).paymentOrder.providerOrderId)
    }

    @Test
    fun duplicatePaymentInFlight_isRejected() = runTest {
        // Start first payment
        val res1 = paymentRepository.startPayment(tenantId = "rest-oasis", orderId = "ORD-001")
        assertTrue(res1.isSuccess)

        // Attempting second concurrent payment before first completes
        val res2 = paymentRepository.startPayment(tenantId = "rest-oasis", orderId = "ORD-001")
        assertFalse("Duplicate in-flight payment attempt must be rejected", res2.isSuccess)
        assertTrue(res2.exceptionOrNull() is IllegalStateException)
    }

    @Test
    fun checkoutCancelled_transitionsToCancelledState() = runTest {
        paymentRepository.startPayment(tenantId = "rest-oasis", orderId = "ORD-001")

        val cancelResult = paymentRepository.handleSdkCheckoutResult(
            tenantId = "rest-oasis",
            orderId = "ORD-001",
            billId = "BILL-001",
            providerOrderId = "order_test_123",
            result = SdkCheckoutResult(success = false, isCancelled = true)
        )

        assertFalse(cancelResult.isSuccess)
        assertTrue(paymentRepository.uiState.value is PaymentUiState.Cancelled)
    }

    @Test
    fun checkoutSuccess_triggersServerVerificationAndTransitionsToSuccess() = runTest {
        paymentRepository.startPayment(tenantId = "rest-oasis", orderId = "ORD-001")

        val sdkSuccess = SdkCheckoutResult(
            success = true,
            razorpayPaymentId = "pay_test_456",
            razorpayOrderId = "order_test_123",
            razorpaySignature = "valid_sig"
        )

        val verifyResult = paymentRepository.handleSdkCheckoutResult(
            tenantId = "rest-oasis",
            orderId = "ORD-001",
            billId = "BILL-001",
            providerOrderId = "order_test_123",
            result = sdkSuccess
        )

        assertTrue("Verification should succeed", verifyResult.isSuccess)
        val state = paymentRepository.uiState.value
        assertTrue("State must be Success after server verification", state is PaymentUiState.Success)
        assertEquals("TXN-VERIFIED-999", (state as PaymentUiState.Success).verification.paymentReference)
    }

    @Test
    fun serverVerificationFailure_transitionsToFailedState() = runTest {
        mockClient.verificationSuccess = false
        paymentRepository.startPayment(tenantId = "rest-oasis", orderId = "ORD-001")

        val sdkSuccess = SdkCheckoutResult(
            success = true,
            razorpayPaymentId = "pay_test_456",
            razorpayOrderId = "order_test_123",
            razorpaySignature = "tampered_sig"
        )

        val verifyResult = paymentRepository.handleSdkCheckoutResult(
            tenantId = "rest-oasis",
            orderId = "ORD-001",
            billId = "BILL-001",
            providerOrderId = "order_test_123",
            result = sdkSuccess
        )

        assertFalse("Server rejected verification", verifyResult.isSuccess)
        val state = paymentRepository.uiState.value
        assertTrue("State must be Failed when server rejects", state is PaymentUiState.Failed)
    }
}
