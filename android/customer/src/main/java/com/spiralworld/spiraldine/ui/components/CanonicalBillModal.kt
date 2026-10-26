package com.spiralworld.spiraldine.ui.components

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.BillRecord
import com.spiralworld.spiraldine.data.model.OrderRecord
import com.spiralworld.spiraldine.data.model.ServiceRequestRecord
import com.spiralworld.spiraldine.data.repository.CurrencyFormatter
import com.spiralworld.spiraldine.data.repository.OrderRepository
import com.spiralworld.spiraldine.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CanonicalBillModal(
    isOpen: Boolean,
    onClose: () -> Unit,
    order: OrderRecord,
    orderRepository: OrderRepository? = null,
    restaurantName: String = "",
    onPayOnline: (OrderRecord) -> Unit = {}
) {
    if (!isOpen) return

    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val coroutineScope = rememberCoroutineScope()

    // Real-time bill stream
    val billState by androidx.compose.runtime.remember(orderRepository, order.tenantId, order.orderId) {
        orderRepository?.streamCanonicalBill(order.tenantId, order.orderId) ?: kotlinx.coroutines.flow.flowOf(null)
    }.collectAsState(initial = null)

    // Real-time cash request stream
    val cashRequest by androidx.compose.runtime.remember(orderRepository, order.tenantId, order.orderId) {
        orderRepository?.streamCashRequest(order.tenantId, order.orderId) ?: kotlinx.coroutines.flow.flowOf(null)
    }.collectAsState(initial = null)

    // Tab state: 0 = Bill Breakdown, 1 = UPI Payment, 2 = Cash
    var selectedTab by remember { mutableIntStateOf(0) }
    var isSubmittingCash by remember { mutableStateOf(false) }
    var actionMessage by remember { mutableStateOf<String?>(null) }
    var copiedVpa by remember { mutableStateOf(false) }

    val effectiveBill = billState
    val isPaid = (effectiveBill?.paymentStatus?.equals("paid", ignoreCase = true) == true) ||
            order.paymentStatus.equals("paid", ignoreCase = true)

    val billTotal = effectiveBill?.total ?: order.total
    val billSubtotal = effectiveBill?.subtotal ?: order.subtotal
    val billDiscount = effectiveBill?.discount ?: order.discount
    val billTax = effectiveBill?.tax ?: order.tax
    val billServiceCharge = effectiveBill?.serviceCharge ?: order.serviceCharge
    val billItems = if (effectiveBill != null && effectiveBill.items.isNotEmpty()) effectiveBill.items else order.items
    val billInvoice = effectiveBill?.invoiceNumber?.ifBlank { null } ?: "INV-${order.orderId.takeLast(8).uppercase()}"
    val billId = effectiveBill?.billId?.ifBlank { null } ?: "BILL-${order.orderId}"

    val effectiveRestaurant = restaurantName.ifBlank {
        effectiveBill?.restaurantName?.ifBlank { null } ?: order.restaurantId.ifBlank { "SpiralDine Restaurant" }
    }

    val merchantVpa = "spiraldine@upi"
    val upiAmountStr = String.format(java.util.Locale.US, "%.2f", billTotal / 100.0)
    val upiUri = "upi://pay?pa=$merchantVpa&pn=${Uri.encode(effectiveRestaurant)}&am=$upiAmountStr&cu=INR&tn=Table%20${order.tableNumber}%20Bill"

    ModalBottomSheet(
        onDismissRequest = onClose,
        containerColor = SurfaceWhite,
        tonalElevation = 6.dp,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp)
                .padding(bottom = 24.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Header Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(SpiralDineOrange.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.ReceiptLong,
                            contentDescription = null,
                            tint = SpiralDineOrange,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                    Column {
                        Text(
                            text = effectiveRestaurant,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimary
                        )
                        Text(
                            text = "Table #${order.tableNumber} • $billId",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }

                // Payment Status Badge
                Box(
                    modifier = Modifier
                        .background(
                            if (isPaid) SuccessGreenBg else SpiralDineOrangeLight,
                            RoundedCornerShape(8.dp)
                        )
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = if (isPaid) "PAID & SETTLED" else "UNPAID",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = if (isPaid) SuccessGreen else SpiralDineOrange
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // 3-Tab Selector
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(WarmBackground, RoundedCornerShape(12.dp))
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                val tabTitles = listOf("Bill Breakdown", "UPI Payment", "Cash")
                tabTitles.forEachIndexed { idx, title ->
                    val isSelected = selectedTab == idx
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (isSelected) SurfaceWhite else WarmBackground)
                            .clickable { selectedTab = idx }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = title,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.ExtraBold else FontWeight.SemiBold,
                            color = if (isSelected) SpiralDineOrange else TextSecondary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Tab Content
            when (selectedTab) {
                0 -> {
                    // TAB 1: BILL BREAKDOWN
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                text = "ORDER ITEMS",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextSecondary,
                                letterSpacing = 1.sp
                            )

                            billItems.forEach { item ->
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = "${item.count}x ${item.name}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = "@ ${CurrencyFormatter.formatPrice(item.pricePerUnit)} each",
                                            fontSize = 10.sp,
                                            color = TextSecondary
                                        )
                                    }
                                    Text(
                                        text = CurrencyFormatter.formatPrice(item.pricePerUnit * item.count),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(1.dp)
                                    .background(CardBorder)
                            )

                            // Financial breakdown
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Subtotal", fontSize = 12.sp, color = TextSecondary)
                                Text(CurrencyFormatter.formatPrice(billSubtotal), fontSize = 12.sp, color = TextPrimary)
                            }

                            if (billDiscount > 0) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("Discount (${order.couponCode ?: "Offer"})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                                    Text("-${CurrencyFormatter.formatPrice(billDiscount)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                                }
                            }

                            if (billTax > 0.0) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("Taxes & GST (5%)", fontSize = 12.sp, color = TextSecondary)
                                    Text(CurrencyFormatter.formatPrice(billTax), fontSize = 12.sp, color = TextPrimary)
                                }
                            }

                            if (billServiceCharge > 0.0) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("Restaurant Service Fee (5%)", fontSize = 12.sp, color = TextSecondary)
                                    Text(CurrencyFormatter.formatPrice(billServiceCharge), fontSize = 12.sp, color = TextPrimary)
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(1.dp)
                                    .background(CardBorder)
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text("Grand Total", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                                    Text("Invoice: $billInvoice", fontSize = 10.sp, color = TextSecondary)
                                }
                                Text(
                                    text = CurrencyFormatter.formatPrice(billTotal),
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Black,
                                    color = SpiralDineOrange
                                )
                            }
                        }
                    }
                }

                1 -> {
                    // TAB 2: UPI PAYMENT
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = "Pay via Any UPI App",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )

                            // Amount display
                            Text(
                                text = CurrencyFormatter.formatPrice(billTotal),
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Black,
                                color = SpiralDineOrange
                            )

                            // UPI ID Card
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = WarmBackground),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text("Merchant UPI ID", fontSize = 10.sp, color = TextSecondary)
                                        Text(merchantVpa, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    }
                                    IconButton(
                                        onClick = {
                                            clipboardManager.setText(AnnotatedString(merchantVpa))
                                            copiedVpa = true
                                        },
                                        modifier = Modifier.size(28.dp)
                                    ) {
                                        Icon(
                                            imageVector = if (copiedVpa) Icons.Default.Check else Icons.Default.ContentCopy,
                                            contentDescription = "Copy UPI ID",
                                            tint = if (copiedVpa) SuccessGreen else TextPrimary,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                            }

                            // Launch UPI Apps Intent Button
                            Button(
                                onClick = {
                                    try {
                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(upiUri))
                                        context.startActivity(Intent.createChooser(intent, "Pay via UPI"))
                                    } catch (_: Exception) {
                                        clipboardManager.setText(AnnotatedString(merchantVpa))
                                        actionMessage = "UPI link copied to clipboard. Open GPay/PhonePe to pay."
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(44.dp)
                            ) {
                                Icon(Icons.Default.PhoneAndroid, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Open UPI App (GPay / PhonePe)", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }

                            Text(
                                text = "After completing UPI payment, please inform your server to confirm table settlement.",
                                fontSize = 10.sp,
                                color = TextSecondary,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                2 -> {
                    // TAB 3: CASH PAYMENT
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Text(
                                text = "Cash Payment at Table",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )

                            Text(
                                text = "Amount to Pay: ${CurrencyFormatter.formatPrice(billTotal)}",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )

                            val isCashPending = cashRequest != null &&
                                    (cashRequest?.status?.equals("pending", ignoreCase = true) == true ||
                                            cashRequest?.status?.equals("accepted", ignoreCase = true) == true)

                            if (isPaid) {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = SuccessGreenBg),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = SuccessGreen)
                                        Column {
                                            Text("Cash Payment Confirmed", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                                            Text("Thank you! Your bill has been settled.", fontSize = 11.sp, color = TextSecondary)
                                        }
                                    }
                                }
                            } else if (isCashPending) {
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(containerColor = SpiralDineOrangeLight.copy(alpha = 0.5f)),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        CircularProgressIndicator(
                                            color = SpiralDineOrange,
                                            modifier = Modifier.size(20.dp),
                                            strokeWidth = 2.dp
                                        )
                                        Column {
                                            Text("Cash Payment Requested", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = SpiralDineOrange)
                                            Text("Server has been notified to collect cash at Table #${order.tableNumber}.", fontSize = 11.sp, color = TextSecondary)
                                        }
                                    }
                                }
                            } else {
                                Text(
                                    text = "Hand over cash directly to your server. Tap below to notify your server to bring your receipt.",
                                    fontSize = 11.sp,
                                    color = TextSecondary,
                                    textAlign = TextAlign.Center
                                )

                                Button(
                                    onClick = {
                                        coroutineScope.launch {
                                            isSubmittingCash = true
                                            val res = orderRepository?.requestCashPayment(
                                                tenantId = order.tenantId,
                                                orderId = order.orderId,
                                                tableNumber = order.tableNumber,
                                                tableId = order.tableId,
                                                amount = billTotal,
                                                customerId = order.customerId,
                                                customerName = order.customerName
                                            ) ?: Result.failure(IllegalStateException("Order repository unavailable"))
                                            isSubmittingCash = false
                                            if (res.isSuccess) {
                                                actionMessage = "Staff notified! Server will collect cash at Table #${order.tableNumber}."
                                            } else {
                                                actionMessage = "Failed to send cash request: ${res.exceptionOrNull()?.message}"
                                            }
                                        }
                                    },
                                    enabled = !isSubmittingCash,
                                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                                    shape = RoundedCornerShape(12.dp),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(44.dp)
                                ) {
                                    Icon(Icons.Default.Payments, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = if (isSubmittingCash) "Notifying Staff..." else "Request Cash Collection",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            }

            if (!actionMessage.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = actionMessage!!,
                    fontSize = 11.sp,
                    color = SpiralDineOrange,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Footer Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedButton(
                    onClick = onClose,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(46.dp)
                ) {
                    Text("Close", fontWeight = FontWeight.Bold, color = TextPrimary)
                }

                if (!isPaid) {
                    Button(
                        onClick = {
                            onClose()
                            onPayOnline(order)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1.5f)
                            .height(46.dp)
                    ) {
                        Icon(Icons.Default.CreditCard, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Pay Online", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
