package com.spiralworld.spiraldine.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.CustomerUser
import com.spiralworld.spiraldine.data.repository.CurrencyFormatter
import com.spiralworld.spiraldine.data.repository.PaymentRepository
import com.spiralworld.spiraldine.data.repository.PaymentUiState
import com.spiralworld.spiraldine.data.repository.SdkCheckoutResult
import com.spiralworld.spiraldine.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentCheckoutModal(
    tenantId: String,
    orderId: String,
    billId: String?,
    amountInRupees: Double,
    customer: CustomerUser?,
    paymentRepository: PaymentRepository,
    onPaymentSuccess: (reference: String) -> Unit,
    onDismiss: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val uiState by paymentRepository.uiState.collectAsState()

    // Automatically initiate backend payment order creation when modal opens
    LaunchedEffect(orderId) {
        if (uiState is PaymentUiState.Idle) {
            paymentRepository.startPayment(
                tenantId = tenantId,
                orderId = orderId,
                billId = billId,
                customer = customer
            )
        }
    }

    ModalBottomSheet(
        onDismissRequest = {
            if (uiState !is PaymentUiState.Verifying && uiState !is PaymentUiState.CreatingOrder) {
                paymentRepository.resetState()
                onDismiss()
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
        tonalElevation = 8.dp,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(SpiralOrange.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Payment,
                            contentDescription = null,
                            tint = SpiralOrange,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Online Payment",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            text = "Razorpay Test Gateway",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                if (uiState !is PaymentUiState.Verifying && uiState !is PaymentUiState.CreatingOrder) {
                    IconButton(
                        onClick = {
                            paymentRepository.resetState()
                            onDismiss()
                        }
                    ) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Bill Amount Summary Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                border = CardDefaults.outlinedCardBorder()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Amount Payable",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = CurrencyFormatter.formatRupees(amountInRupees),
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.ExtraBold,
                        color = SpiralOrange
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Order #${orderId.takeLast(8).uppercase()}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Interactive state body
            when (val state = uiState) {
                is PaymentUiState.CreatingOrder -> {
                    CircularProgressIndicator(color = SpiralOrange, strokeWidth = 3.dp)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Connecting to SpiralDine payment server...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                is PaymentUiState.AwaitingSdkCheckout -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Security, contentDescription = null, tint = VegGreen, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "Ready for Secure Checkout",
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Gateway Order: ${state.paymentOrder.providerOrderId.ifBlank { "rzp_order_live" }}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            coroutineScope.launch {
                                // Authoritative checkout verification boundary:
                                // Simulates customer successfully completing the Razorpay SDK checkout flow
                                // and returns signature tokens to be verified by backend /api/payments/verify
                                val simResult = SdkCheckoutResult(
                                    success = true,
                                    razorpayPaymentId = "pay_sim_${System.currentTimeMillis()}",
                                    razorpayOrderId = state.paymentOrder.providerOrderId.ifBlank { "order_${System.currentTimeMillis()}" },
                                    razorpaySignature = "sig_verified_mock_token"
                                )
                                paymentRepository.handleSdkCheckoutResult(
                                    tenantId = tenantId,
                                    orderId = orderId,
                                    billId = billId,
                                    providerOrderId = state.paymentOrder.providerOrderId,
                                    result = simResult
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = SpiralOrange),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(50.dp)
                    ) {
                        Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Authorize & Pay ${CurrencyFormatter.formatRupees(amountInRupees)}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedButton(
                        onClick = {
                            coroutineScope.launch {
                                paymentRepository.handleSdkCheckoutResult(
                                    tenantId = tenantId,
                                    orderId = orderId,
                                    billId = billId,
                                    providerOrderId = state.paymentOrder.providerOrderId,
                                    result = SdkCheckoutResult(success = false, isCancelled = true)
                                )
                            }
                        },
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        Text("Cancel Payment")
                    }
                }

                is PaymentUiState.Verifying -> {
                    CircularProgressIndicator(color = SpiralOrange, strokeWidth = 3.dp)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = "Verifying transaction authoritatively with server...",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Please do not close this window.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                is PaymentUiState.Success -> {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = VegGreen,
                        modifier = Modifier.size(54.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Payment Verified Successfully!",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = VegGreen
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Ref: ${state.verification.paymentReference ?: "SETTLED-DIRECT"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            onPaymentSuccess(state.verification.paymentReference ?: "SUCCESS")
                            paymentRepository.resetState()
                            onDismiss()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = VegGreen),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        Text("Continue to Order Tracking", fontWeight = FontWeight.Bold)
                    }
                }

                is PaymentUiState.Failed -> {
                    Icon(
                        imageVector = Icons.Default.ErrorOutline,
                        contentDescription = null,
                        tint = NonVegRed,
                        modifier = Modifier.size(54.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Payment Not Completed",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = NonVegRed
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = state.message,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            coroutineScope.launch {
                                paymentRepository.startPayment(
                                    tenantId = tenantId,
                                    orderId = orderId,
                                    billId = billId,
                                    customer = customer
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = SpiralOrange),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        Text("Retry Payment", fontWeight = FontWeight.Bold)
                    }
                }

                is PaymentUiState.Cancelled -> {
                    Text(
                        text = "Payment was cancelled.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = {
                            paymentRepository.resetState()
                            onDismiss()
                        },
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) {
                        Text("Return to Cart")
                    }
                }

                PaymentUiState.Idle -> {}
            }
        }
    }
}
