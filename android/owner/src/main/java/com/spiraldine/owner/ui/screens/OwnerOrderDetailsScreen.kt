package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.OrderRecord
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard
import com.spiraldine.owner.ui.components.OwnerStatusBadge

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerOrderDetailsScreen(
    order: OrderRecord?,
    onBack: () -> Unit,
    onUpdateStatus: (String) -> Unit
) {
    if (order == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Order not found", fontSize = 14.sp, color = TextSecondary)
        }
        return
    }

    val tableText = if (order.tableNumber.isNotEmpty()) "Table ${order.tableNumber}" else order.diningOption
    val statusUpper = order.status.uppercase()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(order.orderNumber, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Text(tableText, fontSize = 11.sp, color = TextSecondary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    OwnerStatusBadge(status = order.status)
                    Spacer(modifier = Modifier.width(12.dp))
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = BackgroundLight,
        bottomBar = {
            Surface(
                color = SurfaceWhite,
                tonalElevation = 8.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (statusUpper != "CANCELLED" && statusUpper != "COMPLETED") {
                        OutlinedButton(
                            onClick = { onUpdateStatus("CANCELLED") },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed)
                        ) {
                            Text("Cancel", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                    }

                    when (statusUpper) {
                        "PENDING", "NEW" -> {
                            Button(
                                onClick = { onUpdateStatus("PREPARING") },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                            ) {
                                Text("Accept & Start Cooking", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                        "PREPARING" -> {
                            Button(
                                onClick = { onUpdateStatus("READY") },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = InfoBlue)
                            ) {
                                Text("Mark Food Ready", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                        "READY" -> {
                            Button(
                                onClick = { onUpdateStatus("COMPLETED") },
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(12.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
                            ) {
                                Text("Complete & Close Order", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                        else -> {
                            Text(
                                "Order Closed ($statusUpper)",
                                fontSize = 12.sp,
                                color = TextMuted,
                                modifier = Modifier.padding(vertical = 12.dp)
                            )
                        }
                    }
                }
            }
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Customer Info Card
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("Guest & Dining Info", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Customer Name:", fontSize = 12.sp, color = TextSecondary)
                            Text(order.customerName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Location:", fontSize = 12.sp, color = TextSecondary)
                            Text(tableText, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }
                    }
                }
            }

            // Items List
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("Ordered Items", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(10.dp))
                        order.items.forEach { item ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("${item.quantity}x ${item.name}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    if (item.price > 0) {
                                        Text("${RevenueCalculator.formatPaise(item.price)} each", fontSize = 11.sp, color = TextSecondary)
                                    }
                                    if (item.notes.isNotEmpty()) {
                                        Text("\"${item.notes}\"", fontSize = 10.sp, color = TerracottaOrange)
                                    }
                                }
                                Text(RevenueCalculator.formatPaise(item.price * item.quantity), fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                    }
                }
            }

            // Financial Summary
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text("Payment Summary", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(8.dp))
                        SummaryRow("Subtotal", RevenueCalculator.formatPaise(order.subtotal))
                        if (order.discount > 0) {
                            SummaryRow("Discount", "-${RevenueCalculator.formatPaise(order.discount)}", color = SuccessGreen)
                        }
                        SummaryRow("Taxes", RevenueCalculator.formatPaise(order.tax))
                        HorizontalDivider(color = BackgroundLight, modifier = Modifier.padding(vertical = 8.dp))
                        SummaryRow("Total Amount", RevenueCalculator.formatPaise(order.total), isBold = true)
                    }
                }
            }
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String, isBold: Boolean = false, color: androidx.compose.ui.graphics.Color = TextPrimary) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = if (isBold) 13.sp else 12.sp, fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal, color = TextSecondary)
        Text(value, fontSize = if (isBold) 14.sp else 12.sp, fontWeight = if (isBold) FontWeight.Black else FontWeight.Bold, color = color)
    }
}
