package com.spiraldine.owner.ui.screens

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.ReportSummaryRecord
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerReportsScreen(
    currentReport: ReportSummaryRecord,
    onBack: () -> Unit,
    onGenerateReport: (String, String) -> ReportSummaryRecord
) {
    val context = LocalContext.current

    val reportTypes = listOf(
        "sales" to "Sales Report",
        "restaurant" to "Restaurants & Branches",
        "orders" to "Orders Log",
        "inventory" to "Inventory Valuation",
        "customers" to "Customer Retention",
        "staff" to "Staff Performance",
        "reservations" to "Table Bookings",
        "feedback" to "Feedback & Ratings",
        "payments" to "Payment Methods",
        "discounts" to "Discounts & Deals",
        "cancellations" to "Order Cancellations",
        "tax" to "Tax Summary"
    )

    val periods = listOf("Today", "Yesterday", "This Week", "This Month", "Last Month", "Year-to-Date")

    var selectedType by remember { mutableStateOf("sales") }
    var selectedPeriod by remember { mutableStateOf("This Month") }
    var activeReport by remember(currentReport) { mutableStateOf(currentReport) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Reports & Business Exports", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(
                        onClick = {
                            val shareIntent = Intent().apply {
                                action = Intent.ACTION_SEND
                                putExtra(
                                    Intent.EXTRA_TEXT,
                                    """
                                    SpiralDine Business Report
                                    Report: ${activeReport.title}
                                    Period: ${activeReport.period}
                                    Total Orders: ${activeReport.totalOrders}
                                    Total Records: ${activeReport.recordsCount}
                                    Gross Sales: ${RevenueCalculator.formatPaise(activeReport.totalGross)}
                                    Net Sales: ${RevenueCalculator.formatPaise(activeReport.totalNet)}
                                    Taxes: ${RevenueCalculator.formatPaise(activeReport.totalTax)}
                                    Discounts: ${RevenueCalculator.formatPaise(activeReport.totalDiscount)}
                                    Generated: ${activeReport.generatedAt}
                                    """.trimIndent()
                                )
                                type = "text/plain"
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Export Report via"))
                        }
                    ) {
                        Icon(Icons.Default.Share, contentDescription = "Export Report", tint = TerracottaOrange)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = BackgroundLight
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Select Period
            item {
                Text("REPORTING PERIOD", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary, letterSpacing = 0.5.sp)
                Spacer(modifier = Modifier.height(6.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(periods) { p ->
                        val isSel = selectedPeriod == p
                        FilterChip(
                            selected = isSel,
                            onClick = {
                                selectedPeriod = p
                                activeReport = onGenerateReport(selectedType, p)
                            },
                            label = { Text(p, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TerracottaOrangeLight,
                                selectedLabelColor = TerracottaOrange
                            )
                        )
                    }
                }
            }

            // Select Report Type
            item {
                Text("SELECT REPORT TYPE (12 CANONICAL MODULES)", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary, letterSpacing = 0.5.sp)
                Spacer(modifier = Modifier.height(6.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(reportTypes) { (typeKey, label) ->
                        val isSel = selectedType == typeKey
                        FilterChip(
                            selected = isSel,
                            onClick = {
                                selectedType = typeKey
                                activeReport = onGenerateReport(typeKey, selectedPeriod)
                            },
                            label = { Text(label, fontSize = 11.sp, fontWeight = if (isSel) FontWeight.Bold else FontWeight.Normal) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TerracottaOrangeLight,
                                selectedLabelColor = TerracottaOrange
                            )
                        )
                    }
                }
            }

            // Report Header Card
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(activeReport.title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text("Period: ${activeReport.period}", fontSize = 12.sp, color = TextSecondary)
                            }
                            Surface(color = TerracottaOrangeLight, shape = RoundedCornerShape(8.dp)) {
                                Text(
                                    activeReport.type.uppercase(),
                                    color = TerracottaOrange,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Metric Cards
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        ReportMetricCard(
                            label = "Gross Sales",
                            value = RevenueCalculator.formatPaise(activeReport.totalGross),
                            modifier = Modifier.weight(1f)
                        )
                        ReportMetricCard(
                            label = "Net Sales",
                            value = RevenueCalculator.formatPaise(activeReport.totalNet),
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        ReportMetricCard(
                            label = "Tax Collected",
                            value = RevenueCalculator.formatPaise(activeReport.totalTax),
                            modifier = Modifier.weight(1f)
                        )
                        ReportMetricCard(
                            label = "Discounts Given",
                            value = RevenueCalculator.formatPaise(activeReport.totalDiscount),
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        ReportMetricCard(
                            label = "Total Orders",
                            value = "${activeReport.totalOrders}",
                            modifier = Modifier.weight(1f)
                        )
                        ReportMetricCard(
                            label = "Records Processed",
                            value = "${activeReport.recordsCount}",
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            // Export Actions
            item {
                Button(
                    onClick = {
                        val shareIntent = Intent().apply {
                            action = Intent.ACTION_SEND
                            putExtra(
                                Intent.EXTRA_TEXT,
                                "SpiralDine Report [${activeReport.title}]: Gross ₹${activeReport.totalGross}, Net ₹${activeReport.totalNet}, Orders ${activeReport.totalOrders}"
                            )
                            type = "text/plain"
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Share Summary"))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Icon(Icons.Default.Download, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Export & Share Business Report", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun ReportMetricCard(label: String, value: String, modifier: Modifier = Modifier) {
    OwnerCard(modifier = modifier) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(label, fontSize = 11.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        }
    }
}
