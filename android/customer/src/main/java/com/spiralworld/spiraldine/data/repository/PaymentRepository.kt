package com.spiralworld.spiraldine.data.repository

import com.spiralworld.spiraldine.data.model.CustomerUser
import com.spiralworld.spiraldine.data.model.PaymentOrder
import com.spiralworld.spiraldine.data.model.PaymentVerification
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

sealed interface PaymentUiState {
    data object Idle : PaymentUiState
    data class CreatingOrder(val orderId: String) : PaymentUiState
    data class AwaitingSdkCheckout(val paymentOrder: PaymentOrder) : PaymentUiState
    data class Verifying(val orderId: String, val providerOrderId: String) : PaymentUiState
    data class Success(val verification: PaymentVerification) : PaymentUiState
    data class Failed(val message: String, val orderId: String? = null) : PaymentUiState
    data class Cancelled(val orderId: String) : PaymentUiState
}

data class SdkCheckoutResult(
    val success: Boolean,
    val razorpayPaymentId: String? = null,
    val razorpayOrderId: String? = null,
    val razorpaySignature: String? = null,
    val isCancelled: Boolean = false,
    val errorMessage: String? = null
)

interface PaymentApiClient {
    suspend fun createPaymentOrder(
        tenantId: String,
        orderId: String,
        billId: String?,
        customer: CustomerUser?
    ): Result<PaymentOrder>

    suspend fun verifyPayment(
        tenantId: String,
        orderId: String,
        billId: String?,
        providerOrderId: String,
        razorpayPaymentId: String?,
        razorpaySignature: String?
    ): Result<PaymentVerification>
}

class DefaultPaymentApiClient(
    private val baseUrl: String = "https://spiral-dine.vercel.app"
) : PaymentApiClient {

    override suspend fun createPaymentOrder(
        tenantId: String,
        orderId: String,
        billId: String?,
        customer: CustomerUser?
    ): Result<PaymentOrder> = withContext(Dispatchers.IO) {
        try {
            val endpoint = URL("$baseUrl/api/payments/create-order")
            val conn = (endpoint.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                setRequestProperty("Accept", "application/json")
                connectTimeout = 15000
                readTimeout = 15000
                doOutput = true
            }

            val bodyJson = JSONObject().apply {
                put("tenantId", tenantId)
                put("orderId", orderId)
                if (!billId.isNullOrBlank()) put("billId", billId)
                val customerObj = JSONObject().apply {
                    put("id", customer?.uid ?: "guest_customer")
                    put("name", customer?.displayName ?: "Guest Diner")
                    put("email", customer?.email ?: "")
                }
                put("customer", customerObj)
            }

            OutputStreamWriter(conn.outputStream, "UTF-8").use { it.write(bodyJson.toString()) }

            val responseCode = conn.responseCode
            val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
            val responseText = BufferedReader(InputStreamReader(stream, "UTF-8")).use { it.readText() }

            if (responseCode !in 200..299) {
                val errorMsg = try {
                    JSONObject(responseText).optString("error", "Server returned error $responseCode")
                } catch (_: Exception) {
                    "Payment order creation failed ($responseCode)"
                }
                return@withContext Result.failure(Exception(errorMsg))
            }

            val json = JSONObject(responseText)
            val paymentOrder = PaymentOrder(
                provider = json.optString("provider", "razorpay"),
                providerOrderId = json.optString("providerOrderId", ""),
                keyId = json.optString("keyId", ""),
                amountInCents = json.optDouble("amount", 0.0),
                amountInRupees = json.optDouble("amountInRupees", 0.0),
                currency = json.optString("currency", "INR"),
                orderId = json.optString("orderId", orderId),
                billId = json.optString("billId", billId ?: ""),
                tenantId = tenantId
            )
            Result.success(paymentOrder)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun verifyPayment(
        tenantId: String,
        orderId: String,
        billId: String?,
        providerOrderId: String,
        razorpayPaymentId: String?,
        razorpaySignature: String?
    ): Result<PaymentVerification> = withContext(Dispatchers.IO) {
        try {
            val endpoint = URL("$baseUrl/api/payments/verify")
            val conn = (endpoint.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                setRequestProperty("Accept", "application/json")
                connectTimeout = 15000
                readTimeout = 15000
                doOutput = true
            }

            val bodyJson = JSONObject().apply {
                put("tenantId", tenantId)
                put("orderId", orderId)
                if (!billId.isNullOrBlank()) put("billId", billId)
                put("providerOrderId", providerOrderId)
                put("razorpay_order_id", providerOrderId)
                if (!razorpayPaymentId.isNullOrBlank()) put("razorpay_payment_id", razorpayPaymentId)
                if (!razorpaySignature.isNullOrBlank()) put("razorpay_signature", razorpaySignature)
            }

            OutputStreamWriter(conn.outputStream, "UTF-8").use { it.write(bodyJson.toString()) }

            val responseCode = conn.responseCode
            val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
            val responseText = BufferedReader(InputStreamReader(stream, "UTF-8")).use { it.readText() }

            if (responseCode !in 200..299) {
                val errorMsg = try {
                    JSONObject(responseText).optString("error", "Verification failed ($responseCode)")
                } catch (_: Exception) {
                    "Verification failed with HTTP $responseCode"
                }
                return@withContext Result.failure(Exception(errorMsg))
            }

            val json = JSONObject(responseText)
            val verification = PaymentVerification(
                success = json.optBoolean("success", false),
                provider = "razorpay",
                providerOrderId = providerOrderId,
                paymentReference = if (json.has("paymentReference") && !json.isNull("paymentReference")) json.getString("paymentReference") else null,
                status = json.optString("status", "PAID"),
                alreadySettled = json.optBoolean("alreadySettled", false)
            )
            Result.success(verification)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

class PaymentRepository(
    private val apiClient: PaymentApiClient = DefaultPaymentApiClient()
) {
    private val _uiState = MutableStateFlow<PaymentUiState>(PaymentUiState.Idle)
    val uiState: StateFlow<PaymentUiState> = _uiState.asStateFlow()

    private val isPaymentInFlight = AtomicBoolean(false)

    /**
     * Initiates authoritative payment flow for an order.
     * Prevents duplicate in-flight submissions and guarantees server verification.
     */
    suspend fun startPayment(
        tenantId: String,
        orderId: String,
        billId: String? = null,
        customer: CustomerUser? = null
    ): Result<PaymentOrder> {
        if (!isPaymentInFlight.compareAndSet(false, true)) {
            val err = "A payment is already being processed. Please wait."
            _uiState.value = PaymentUiState.Failed(err, orderId)
            return Result.failure(IllegalStateException(err))
        }

        _uiState.value = PaymentUiState.CreatingOrder(orderId)

        val result = apiClient.createPaymentOrder(tenantId, orderId, billId, customer)
        return result.fold(
            onSuccess = { order ->
                _uiState.value = PaymentUiState.AwaitingSdkCheckout(order)
                Result.success(order)
            },
            onFailure = { err ->
                isPaymentInFlight.set(false)
                val msg = err.message ?: "Failed to initiate payment."
                _uiState.value = PaymentUiState.Failed(msg, orderId)
                Result.failure(err)
            }
        )
    }

    /**
     * Handles checkout result from Razorpay Checkout SDK.
     * NEVER trusts the client result directly; always performs authoritative backend verification.
     */
    suspend fun handleSdkCheckoutResult(
        tenantId: String,
        orderId: String,
        billId: String?,
        providerOrderId: String,
        result: SdkCheckoutResult
    ): Result<PaymentVerification> {
        if (result.isCancelled) {
            isPaymentInFlight.set(false)
            _uiState.value = PaymentUiState.Cancelled(orderId)
            return Result.failure(Exception("Payment cancelled by customer."))
        }

        if (!result.success || result.razorpayPaymentId.isNullOrBlank()) {
            isPaymentInFlight.set(false)
            val err = result.errorMessage ?: "Payment checkout was not successful."
            _uiState.value = PaymentUiState.Failed(err, orderId)
            return Result.failure(Exception(err))
        }

        // Authoritative Server-Side Verification
        _uiState.value = PaymentUiState.Verifying(orderId, providerOrderId)

        val verificationResult = apiClient.verifyPayment(
            tenantId = tenantId,
            orderId = orderId,
            billId = billId,
            providerOrderId = providerOrderId,
            razorpayPaymentId = result.razorpayPaymentId,
            razorpaySignature = result.razorpaySignature
        )

        isPaymentInFlight.set(false)

        return verificationResult.fold(
            onSuccess = { verification ->
                if (verification.success) {
                    _uiState.value = PaymentUiState.Success(verification)
                    Result.success(verification)
                } else {
                    val msg = verification.errorMessage ?: "Authoritative payment verification failed on server."
                    _uiState.value = PaymentUiState.Failed(msg, orderId)
                    Result.failure(Exception(msg))
                }
            },
            onFailure = { err ->
                val msg = err.message ?: "Network error during authoritative payment verification."
                _uiState.value = PaymentUiState.Failed(msg, orderId)
                Result.failure(err)
            }
        )
    }

    fun resetState() {
        isPaymentInFlight.set(false)
        _uiState.value = PaymentUiState.Idle
    }
}
