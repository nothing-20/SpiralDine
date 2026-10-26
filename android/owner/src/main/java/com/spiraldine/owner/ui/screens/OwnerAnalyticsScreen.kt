package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.OrderRecord
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerAnalyticsScreen(
    orders: List<OrderRecord>,
    onBack: () -> Unit
) {
    var selectedRange by remember { mutableStateOf("7D") }

    val ordersInRange = remember(orders, selectedRange) {
        orders.filter { o ->
            val matchesRange = when (selectedRange) {
                "TODAY" -> RevenueCalculator.isTodayInTimezone(o.createdAt)
                "7D" -> RevenueCalculator.isWithinDaysInTimezone(o.createdAt, 7)
                "30D" -> RevenueCalculator.isWithinDaysInTimezone(o.createdAt, 30)
                else -> true
            }
            matchesRange && o.status != "CANCELLED" && o.status != "REJECTED"
        }
    }

    val paidOrdersInRange = remember(ordersInRange) {
        ordersInRange.filter { RevenueCalculator.isPaidOrCompletedOrder(it.status, it.paymentStatus) }
    }

    val totalSales = remember(paidOrdersInRange) { paidOrdersInRange.sumOf { it.total } }
    val totalOrdersCount = ordersInRange.size
    val aov = if (paidOrdersInRange.isNotEmpty()) totalSales / paidOrdersInRange.size else 0.0

    // Top selling items in selected range (or across all valid orders if range is empty)
    val displayOrdersForItems = if (ordersInRange.isNotEmpty()) ordersInRange else orders.filter { it.status != "CANCELLED" && it.status != "REJECTED" }
    val topItems = remember(displayOrdersForItems) {
        val map = mutableMapOf<String, Pair<Int, Double>>()
        displayOrdersForItems.forEach { o ->
            o.items.forEach { itm ->
                val existing = map.getOrDefault(itm.name, Pair(0, 0.0))
                map[itm.name] = Pair(existing.first + itm.quantity, existing.second + (itm.price * itm.quantity))
            }
        }
        map.entries.map { Triple(it.key, it.value.first, it.value.second) }
            .sortedByDescending { it.second }
            .take(5)
    }

    val tz = remember { java.util.TimeZone.getTimeZone("Asia/Kolkata") }
    val dailyTrend = remember(orders) {
        val dayFormat = java.text.SimpleDateFormat("EEE", java.util.Locale.US).apply { timeZone = tz }
        val list = mutableListOf<Pair<String, Double>>()
        for (i in 6 downTo 0) {
            val targetCal = java.util.Calendar.getInstance(tz).apply { add(java.util.Calendar.DAY_OF_YEAR, -i) }
            val dayLabel = dayFormat.format(targetCal.time)
            val daySales = orders.filter { o ->
                val d = RevenueCalculator.parseDate(o.createdAt)
                if (d != null) {
                    val c = java.util.Calendar.getInstance(tz).apply { time = d }
                    c.get(java.util.Calendar.YEAR) == targetCal.get(java.util.Calendar.YEAR) &&
                    c.get(java.util.Calendar.DAY_OF_YEAR) == targetCal.get(java.util.Calendar.DAY_OF_YEAR) &&
                    RevenueCalculator.isPaidOrCompletedOrder(o.status, o.paymentStatus)
                } else false
            }.sumOf { it.total }
            list.add(Pair(dayLabel, daySales))
        }
        list
    }
    val maxDaily = remember(dailyTrend) { dailyTrend.maxOfOrNull { it.second } ?: 0.0 }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sales & Analytics", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
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
            // Range selector
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SurfaceWhite, RoundedCornerShape(14.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf("TODAY" to "Today", "7D" to "Last 7 Days", "30D" to "Last 30 Days").forEach { (id, label) ->
                        val isSelected = selectedRange == id
                        Button(
                            onClick = { selectedRange = id },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (isSelected) TerracottaOrange else SurfaceWhite,
                                contentColor = if (isSelected) SurfaceWhite else TextSecondary
                            ),
                            elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
                        ) {
                            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // 3 KPI Cards
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    MetricMiniCard("Total Revenue", RevenueCalculator.formatPaise(totalSales), TerracottaOrange, Modifier.weight(1f))
                    MetricMiniCard("Total Orders", "$totalOrdersCount", TextPrimary, Modifier.weight(1f))
                    MetricMiniCard("Avg Order", RevenueCalculator.formatPaise(aov), SuccessGreen, Modifier.weight(1f))
                }
            }

            // Revenue Trend Chart (Live Daily Totals in Asia/Kolkata)
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Revenue Trend", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Text("Daily transaction totals (past 7 days)", fontSize = 10.sp, color = TextSecondary)

                        Spacer(modifier = Modifier.height(16.dp))

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(120.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Bottom
                        ) {
                            dailyTrend.forEach { (day, amount) ->
                                val fraction = if (maxDaily > 0.0) {
                                    ((amount / maxDaily) * 0.85f + 0.15f).toFloat().coerceIn(0.12f, 1.0f)
                                } else 0.06f
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Box(
                                        modifier = Modifier
                                            .width(26.dp)
                                            .fillMaxHeight(fraction)
                                            .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                                            .background(if (amount > 0.0) TerracottaOrange else BorderLight)
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(day, fontSize = 9.sp, color = TextMuted)
                                }
                            }
                        }
                    }
                }
            }

            // Top dishes
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Top Selling Dishes", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Spacer(modifier = Modifier.height(12.dp))

                        if (topItems.isEmpty()) {
                            Text("No dish sales recorded yet", fontSize = 11.sp, color = TextMuted)
                        } else {
                            topItems.forEachIndexed { idx, (dish, count, revenue) ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Box(
                                            modifier = Modifier
                                                .size(22.dp)
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(TerracottaOrangeLight),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text("${idx + 1}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TerracottaOrange)
                                        }
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Column {
                                            Text(dish, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                            Text("$count orders", fontSize = 10.sp, color = TextSecondary)
                                        }
                                    }
                                    Text(RevenueCalculator.formatPaise(revenue), fontSize = 12.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricMiniCard(label: String, value: String, color: androidx.compose.ui.graphics.Color, modifier: Modifier = Modifier) {
    OwnerCard(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(label, fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Bold)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 13.sp, fontWeight = FontWeight.Black, color = color)
        }
    }
}
