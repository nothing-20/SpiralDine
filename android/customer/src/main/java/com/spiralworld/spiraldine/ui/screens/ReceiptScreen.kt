package com.spiralworld.spiraldine.ui.screens

import android.content.Context
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.OrderRecord
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.repository.CurrencyFormatter

// Design System Colors matching SpiralDine Desktop & Mobile Web
private val BgCanvas = Color(0xFFFCFAF7)
private val TextMain = Color(0xFF202124)
private val TextMuted = Color(0xFF756B64)
private val BorderLine = Color(0xFFE5DCD5)
private val Terracotta = Color(0xFFC85A3F)
private val TerracottaLight = Color(0xFFF3E8DF)
private val EmeraldGreen = Color(0xFF2E8B57)
private val EmeraldBg = Color(0xFFF0FFF4)
private val VegGreen = Color(0xFF2E8B57)
private val NonVegRed = Color(0xFFA94332)

@Composable
fun ReceiptScreen(
    order: OrderRecord,
    restaurant: Restaurant? = null,
    onBack: () -> Unit,
    onOrderAgain: ((tenantId: String) -> Unit)? = null
) {
    val context = LocalContext.current

    val restaurantName: String = remember(restaurant) {
        restaurant?.name ?: "Bawarchi Restaurant"
    }
    val restaurantAddress: String = remember(restaurant) {
        restaurant?.address ?: "RTC X Roads, Hyderabad, Telangana"
    }
    val orderId = order.orderId.ifBlank { "ORD-CANONICAL" }
    val billId = "BILL-$orderId"
    val isPaid = order.paymentStatus.equals("paid", ignoreCase = true)
    val paymentStatusLabel = if (isPaid) "Paid" else "Payment Pending"
    val paymentMethodLabel = if (isPaid) "Online / Electronic Payment" else "Counter Settlement"

    val tableLabel = if (order.tableNumber.isNotBlank() && !order.tableNumber.contains("walk", ignoreCase = true)) {
        "Table #${order.tableNumber}"
    } else {
        "Walk-in Dining"
    }

    val triggerPrint = {
        try {
            val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager
            if (printManager != null) {
                val webView = WebView(context)
                val html = generatePrintableHtml(order, restaurantName, restaurantAddress, billId, paymentStatusLabel, paymentMethodLabel, tableLabel)
                webView.webViewClient = object : WebViewClient() {
                    override fun onPageFinished(view: WebView?, url: String?) {
                        val printAdapter = webView.createPrintDocumentAdapter("SpiralDine_Receipt_$orderId")
                        printManager.print("SpiralDine Receipt $orderId", printAdapter, PrintAttributes.Builder().build())
                    }
                }
                webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
            } else {
                Toast.makeText(context, "Print service is not available on this device", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            Toast.makeText(context, "Unable to launch print service", Toast.LENGTH_SHORT).show()
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(BgCanvas),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Top Action Bar
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { onBack() }
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = TextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Back to My Orders",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextMuted
                    )
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { triggerPrint() },
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = TextMain)
                    ) {
                        Icon(imageVector = Icons.Default.Print, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = "Print", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    if (onOrderAgain != null && order.tenantId.isNotBlank()) {
                        Button(
                            onClick = { onOrderAgain(order.tenantId) },
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Terracotta)
                        ) {
                            Icon(imageVector = Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(text = "Order Again", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // Official Receipt Slip Card
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, BorderLine, RoundedCornerShape(20.dp)),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Header Section
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFFCFAF7))
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(TerracottaLight)
                                .border(1.dp, BorderLine, RoundedCornerShape(14.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Receipt,
                                contentDescription = null,
                                tint = Terracotta,
                                modifier = Modifier.size(24.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = restaurantName,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black,
                            color = TextMain,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(4.dp))

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.LocationOn,
                                contentDescription = null,
                                tint = Terracotta,
                                modifier = Modifier.size(13.dp)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = restaurantAddress,
                                fontSize = 11.sp,
                                color = TextMuted,
                                textAlign = TextAlign.Center
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Status Pills
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(
                                modifier = Modifier
                                    .clip(CircleShape)
                                    .background(EmeraldBg)
                                    .border(1.dp, Color(0xFFC6F6D5), CircleShape)
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = EmeraldGreen,
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = order.status.uppercase(),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = EmeraldGreen
                                    )
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .clip(CircleShape)
                                    .background(if (isPaid) EmeraldBg else Color(0xFFFFFBEB))
                                    .border(1.dp, if (isPaid) Color(0xFFC6F6D5) else Color(0xFFFDE68A), CircleShape)
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(
                                        imageVector = Icons.Default.CreditCard,
                                        contentDescription = null,
                                        tint = if (isPaid) EmeraldGreen else Color(0xFFB45309),
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = paymentStatusLabel,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isPaid) EmeraldGreen else Color(0xFFB45309)
                                    )
                                }
                            }
                        }
                    }

                    HorizontalDivider(color = BorderLine, thickness = 1.dp)

                    // Meta Information Grid
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            MetaField(label = "Order ID", value = "#$orderId", isMono = true)
                            MetaField(label = "Bill Reference", value = billId, isMono = true)
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            MetaField(label = "Seating Context", value = tableLabel)
                            MetaField(label = "Settlement", value = paymentMethodLabel)
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            MetaField(label = "Order Time", value = order.createdAt.ifBlank { "Recent" })
                            if (order.customerName.isNotBlank()) {
                                MetaField(label = "Customer", value = order.customerName)
                            }
                        }
                    }

                    HorizontalDivider(color = BorderLine, thickness = 1.dp)

                    // Itemized Order Section
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Text(
                            text = "ORDERED ITEMS",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextMuted,
                            letterSpacing = 0.5.sp
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        if (order.items.isNotEmpty()) {
                            order.items.forEach { item ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = item.name,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextMain
                                        )
                                        Text(
                                            text = "Qty: ×${item.count}  •  ${CurrencyFormatter.formatPrice(item.pricePerUnit)} each",
                                            fontSize = 11.sp,
                                            color = TextMuted
                                        )
                                    }

                                    Text(
                                        text = CurrencyFormatter.formatPrice(item.pricePerUnit * item.count),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = FontFamily.Monospace,
                                        color = TextMain
                                    )
                                }
                            }
                        } else {
                            Text(
                                text = "Itemized breakdown details unavailable.",
                                fontSize = 12.sp,
                                color = TextMuted
                            )
                        }
                    }

                    HorizontalDivider(color = BorderLine, thickness = 1.dp)

                    // Bill Breakdown Section
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFFAFAFA))
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        BreakdownRow(label = "Subtotal", amount = CurrencyFormatter.formatPrice(order.subtotal))

                        if (order.discount > 0.0) {
                            BreakdownRow(
                                label = "Discount ${if (!order.couponCode.isNullOrBlank()) "(${order.couponCode})" else ""}",
                                amount = "-${CurrencyFormatter.formatPrice(order.discount)}",
                                color = EmeraldGreen
                            )
                        }

                        if (order.tax > 0.0) {
                            BreakdownRow(label = "Taxes & GST", amount = CurrencyFormatter.formatPrice(order.tax))
                        }

                        if (order.serviceCharge > 0.0) {
                            BreakdownRow(label = "Restaurant Service Fee", amount = CurrencyFormatter.formatPrice(order.serviceCharge))
                        }

                        HorizontalDivider(color = BorderLine, thickness = 1.dp, modifier = Modifier.padding(vertical = 4.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Grand Total",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Black,
                                color = TextMain
                            )
                            Text(
                                text = CurrencyFormatter.formatPrice(order.total),
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = FontFamily.Monospace,
                                color = Terracotta
                            )
                        }
                    }

                    // Footer security assurance
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFF5F5F5))
                            .padding(vertical = 10.dp, horizontal = 16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Official digital bill receipt powered by SpiralDine",
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Medium,
                            color = TextMuted
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MetaField(label: String, value: String, isMono: Boolean = false) {
    Column {
        Text(text = label.uppercase(), fontSize = 9.5.sp, fontWeight = FontWeight.ExtraBold, color = TextMuted)
        Text(
            text = value,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = if (isMono) FontFamily.Monospace else FontFamily.Default,
            color = TextMain
        )
    }
}

@Composable
private fun BreakdownRow(label: String, amount: String, color: Color = TextMuted) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, fontSize = 12.sp, color = color)
        Text(text = amount, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, color = color)
    }
}

private fun generatePrintableHtml(
    order: OrderRecord,
    restaurantName: String,
    restaurantAddress: String,
    billId: String,
    paymentStatus: String,
    paymentMethod: String,
    tableLabel: String
): String {
    val itemsHtml = order.items.joinToString("") {
        """
        <tr>
            <td style="padding: 6px 0; border-bottom: 1px solid #eee;">${it.name} x ${it.count}</td>
            <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right; font-family: monospace;">${CurrencyFormatter.formatPrice(it.pricePerUnit * it.count)}</td>
        </tr>
        """.trimIndent()
    }

    return """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Receipt #${order.orderId}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #202124; }
            .header { text-align: center; margin-bottom: 20px; }
            .restaurant-name { font-size: 20px; font-weight: bold; margin: 0; }
            .address { font-size: 11px; color: #756B64; margin-top: 4px; }
            .meta-table { width: 100%; font-size: 11px; margin-bottom: 16px; border-collapse: collapse; }
            .meta-table td { padding: 4px 0; }
            .items-table { width: 100%; font-size: 12px; border-collapse: collapse; margin-bottom: 16px; }
            .totals-table { width: 100%; font-size: 12px; margin-top: 10px; }
            .totals-table td { padding: 4px 0; }
            .grand-total { font-size: 15px; font-weight: bold; border-top: 1px solid #202124; padding-top: 6px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 class="restaurant-name">$restaurantName</h1>
            <div class="address">$restaurantAddress</div>
            <div style="margin-top: 8px; font-size: 12px; font-weight: bold;">OFFICIAL ORDER RECEIPT</div>
        </div>
        <table class="meta-table">
            <tr><td><strong>Order ID:</strong> #${order.orderId}</td><td style="text-align: right;"><strong>Bill ID:</strong> $billId</td></tr>
            <tr><td><strong>Context:</strong> $tableLabel</td><td style="text-align: right;"><strong>Status:</strong> ${order.status} ($paymentStatus)</td></tr>
            <tr><td><strong>Date:</strong> ${order.createdAt}</td><td style="text-align: right;"><strong>Payment:</strong> $paymentMethod</td></tr>
        </table>
        <hr style="border: 0; border-top: 1px solid #E5DCD5; margin-bottom: 12px;">
        <table class="items-table">
            <thead>
                <tr style="border-bottom: 1px solid #202124;">
                    <th style="text-align: left; padding-bottom: 4px;">Item</th>
                    <th style="text-align: right; padding-bottom: 4px;">Amount</th>
                </tr>
            </thead>
            <tbody>
                $itemsHtml
            </tbody>
        </table>
        <table class="totals-table">
            <tr><td>Subtotal:</td><td style="text-align: right; font-family: monospace;">${CurrencyFormatter.formatPrice(order.subtotal)}</td></tr>
            ${if (order.discount > 0) "<tr><td>Discount:</td><td style='text-align: right; font-family: monospace;'>-${CurrencyFormatter.formatPrice(order.discount)}</td></tr>" else ""}
            <tr><td>Taxes & GST:</td><td style="text-align: right; font-family: monospace;">${CurrencyFormatter.formatPrice(order.tax)}</td></tr>
            <tr><td>Service Charge:</td><td style="text-align: right; font-family: monospace;">${CurrencyFormatter.formatPrice(order.serviceCharge)}</td></tr>
            <tr class="grand-total"><td>Grand Total:</td><td style="text-align: right; font-family: monospace;">${CurrencyFormatter.formatPrice(order.total)}</td></tr>
        </table>
        <div style="text-align: center; margin-top: 24px; font-size: 10px; color: #756B64;">
            Thank you for dining with us! Powered by SpiralDine.
        </div>
    </body>
    </html>
    """.trimIndent()
}
