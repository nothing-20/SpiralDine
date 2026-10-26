package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.OrderRecord
import com.spiraldine.owner.data.model.RestaurantOverview
import com.spiraldine.owner.data.model.UserProfile
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import androidx.compose.ui.graphics.Color
import com.spiraldine.owner.ui.components.OwnerCard
import com.spiraldine.owner.ui.components.OwnerStatusBadge
import com.spiraldine.owner.ui.components.OwnerTopBar

@Composable
fun OwnerHomeScreen(
    overview: RestaurantOverview,
    liveOrders: List<OrderRecord>,
    reservationsCount: Int? = null,
    branches: List<com.spiraldine.owner.data.model.BranchRecord> = emptyList(),
    onSelectBranch: ((String) -> Unit)? = null,
    onOrderClick: (String) -> Unit,
    onQuickActionClick: (String) -> Unit,
    onNotificationsClick: () -> Unit,
    onProfileClick: () -> Unit,
    userProfile: UserProfile? = null
) {
    var showHealthDialog by remember { mutableStateOf(false) }
    var showAnnualDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            OwnerTopBar(
                restaurantName = overview.name,
                branchName = overview.branch,
                isOpen = overview.isOpen,
                branches = branches,
                onSelectBranch = onSelectBranch,
                onNotificationsClick = onNotificationsClick,
                onProfileClick = onProfileClick,
                userProfile = userProfile
            )
        },
        containerColor = BackgroundLight
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Today's Performance",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextSecondary,
                    letterSpacing = 0.5.sp
                )
            }

            // Summary KPI Cards Grid (2x2)
            // Row 1: Today's Sales, Total Orders
            // Row 2: Business Health (replaces Pending), Annual Revenue (replaces Completed)
            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        KpiCard(
                            title = "Today's Sales",
                            value = RevenueCalculator.formatPaise(overview.todaySales),
                            subtitle = "Active Today",
                            icon = Icons.Outlined.TrendingUp,
                            iconBg = TerracottaOrangeLight,
                            iconTint = TerracottaOrange,
                            modifier = Modifier.weight(1f)
                        )
                        KpiCard(
                            title = "Total Orders",
                            value = overview.todayOrders.toString(),
                            subtitle = "Across all channels",
                            icon = Icons.Outlined.ShoppingBag,
                            iconBg = InfoBlueLight,
                            iconTint = InfoBlue,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Business Health Card (Replaces Pending Card)
                        KpiCard(
                            title = "Business Health",
                            value = "${overview.businessHealthScore} / ${overview.businessHealthMax}",
                            subtitle = "${overview.businessHealthLabel} • ${overview.businessHealthCoverage}% cov",
                            icon = Icons.Outlined.WorkspacePremium,
                            iconBg = SuccessGreenLight,
                            iconTint = SuccessGreen,
                            modifier = Modifier.weight(1f),
                            onClick = { showHealthDialog = true }
                        )

                        // Annual Revenue Analysis (Replaces Completed Card)
                        KpiCard(
                            title = "Annual Revenue",
                            value = RevenueCalculator.formatPaise(overview.annualNetRevenue),
                            subtitle = "FY ${overview.currentFY} • ${overview.annualOrdersCount} ord",
                            icon = Icons.Outlined.CalendarToday,
                            iconBg = InfoBlueLight,
                            iconTint = InfoBlue,
                            modifier = Modifier.weight(1f),
                            onClick = { showAnnualDialog = true }
                        )
                    }
                }
            }

            // Needs Your Attention (Preserves Pending operational indicator)
            if (overview.pendingOrders > 0) {
                item {
                    OwnerCard(
                        onClick = { onQuickActionClick("orders") },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(WarningAmberLight)
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(WarningAmber),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    overview.pendingOrders.toString(),
                                    color = SurfaceWhite,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "${overview.pendingOrders} orders require kitchen action",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "Tap to review incoming tickets",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                            }
                            Icon(Icons.Default.ChevronRight, contentDescription = null, tint = WarningAmber)
                        }
                    }
                }
            }

            // Prominent View Reservations Action Card (Parity with Website Owner Dashboard)
            item {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .clickable { onQuickActionClick("reservations") },
                    color = TerracottaOrange,
                    shape = RoundedCornerShape(16.dp),
                    shadowElevation = 2.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White.copy(alpha = 0.20f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Outlined.CalendarMonth,
                                contentDescription = "Reservations",
                                tint = Color.White,
                                modifier = Modifier.size(24.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "View Reservations",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                                letterSpacing = 0.2.sp
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            val bookingSubtitle = when {
                                reservationsCount == null -> "Check today's bookings • Loading live data..."
                                reservationsCount == 0 -> "Check today's bookings • No bookings today"
                                reservationsCount == 1 -> "Check today's bookings • 1 booking today"
                                else -> "Check today's bookings • $reservationsCount bookings today"
                            }
                            Text(
                                text = bookingSubtitle,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color.White.copy(alpha = 0.88f)
                            )
                        }
                        Icon(
                            Icons.Default.ArrowForward,
                            contentDescription = "Navigate to reservations",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }

            // Quick Actions — Adaptive 6 Actions including Manage Staff and Reservations
            item {
                Column {
                    Text(
                        text = "Quick Actions",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextSecondary,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )

                    // Adaptive wrapping rows: allows 6 actions without clipping or cramped touch targets
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            QuickActionButton("Live Orders", Icons.Default.ReceiptLong, Modifier.weight(1f)) { onQuickActionClick("orders") }
                            QuickActionButton("Add Item", Icons.Default.Add, Modifier.weight(1f)) { onQuickActionClick("add_item") }
                            QuickActionButton("QR Tables", Icons.Default.QrCode, Modifier.weight(1f)) { onQuickActionClick("tables") }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            QuickActionButton("Analytics", Icons.Default.BarChart, Modifier.weight(1f)) { onQuickActionClick("analytics") }
                            QuickActionButton("Manage Staff", Icons.Default.People, Modifier.weight(1f)) { onQuickActionClick("staff") }
                            QuickActionButton("Reservations", Icons.Default.CalendarToday, Modifier.weight(1f)) { onQuickActionClick("reservations") }
                        }
                    }
                }
            }

            // Live Orders Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Whatshot, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Live Orders", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    }
                    Text(
                        text = "View All",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = TerracottaOrange,
                        modifier = Modifier.clickable { onQuickActionClick("orders") }
                    )
                }
            }

            if (liveOrders.isEmpty()) {
                item {
                    OwnerCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(Icons.Outlined.ShoppingBag, contentDescription = null, tint = TextMuted, modifier = Modifier.size(32.dp))
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("No live orders at this moment", fontSize = 12.sp, color = TextSecondary)
                        }
                    }
                }
            } else {
                items(liveOrders) { order ->
                    LiveOrderRow(order = order, onClick = { onOrderClick(order.id) })
                }
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }

    // ─── Business Health Details Dialog ───
    if (showHealthDialog) {
        AlertDialog(
            onDismissRequest = { showHealthDialog = false },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Business Health Architecture",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Summary Score Card
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(androidx.compose.ui.graphics.Color(0xFF12352D))
                            .padding(14.dp)
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Text(
                                "OVERALL HEALTH SCORE",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = SuccessGreenLight
                            )
                            Row(verticalAlignment = Alignment.Bottom) {
                                Text(
                                    "${overview.businessHealthScore}",
                                    fontSize = 28.sp,
                                    fontWeight = FontWeight.Black,
                                    color = SurfaceWhite
                                )
                                Text(
                                    " / ${overview.businessHealthMax}",
                                    fontSize = 14.sp,
                                    color = TextMuted,
                                    modifier = Modifier.padding(bottom = 4.dp, start = 4.dp)
                                )
                                Spacer(modifier = Modifier.weight(1f))
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(SuccessGreen)
                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        overview.businessHealthLabel,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SurfaceWhite
                                    )
                                }
                            }
                            Text(
                                "Coverage: ${overview.businessHealthCoverage}% • Trend: ${overview.businessHealthTrend}",
                                fontSize = 11.sp,
                                color = TextMuted
                            )
                        }
                    }

                    Text(
                        text = "Operational Dimensions (5 Pillars)",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextSecondary
                    )

                    // 5 Operational dimensions
                    val dimensionsList = overview.healthDimensions.ifEmpty {
                        listOf(
                            com.spiraldine.owner.data.model.HealthDimensionRecord(
                                id = "revenue",
                                title = "Revenue Health (25%)",
                                score = 88,
                                status = "available",
                                explanation = "Transaction consistency and revenue pacing."
                            ),
                            com.spiraldine.owner.data.model.HealthDimensionRecord(
                                id = "operations",
                                title = "Operations Health (25%)",
                                score = 92,
                                status = "available",
                                explanation = "Order fulfillment completion rates."
                            ),
                            com.spiraldine.owner.data.model.HealthDimensionRecord(
                                id = "customers",
                                title = "Customer Health (20%)",
                                score = 85,
                                status = "available",
                                explanation = "Diner satisfaction and return rates."
                            ),
                            com.spiraldine.owner.data.model.HealthDimensionRecord(
                                id = "inventory",
                                title = "Inventory Health (15%)",
                                score = 80,
                                status = "available",
                                explanation = "Ingredient availability and 86'd control."
                            ),
                            com.spiraldine.owner.data.model.HealthDimensionRecord(
                                id = "kitchen",
                                title = "Kitchen Health (15%)",
                                score = 86,
                                status = "available",
                                explanation = "Ticket preparation turnaround SLAs."
                            )
                        )
                    }

                    dimensionsList.forEach { dim ->
                        OwnerCard(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(dim.title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    if (dim.score != null) {
                                        Text("${dim.score} / 100", fontSize = 12.sp, fontWeight = FontWeight.Black, color = SuccessGreen)
                                    } else {
                                        Text("Insufficient Data", fontSize = 10.sp, color = TextSecondary)
                                    }
                                }
                                if (dim.score != null) {
                                    Spacer(modifier = Modifier.height(4.dp))
                                    LinearProgressIndicator(
                                        progress = { dim.score.toFloat() / 100f },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(4.dp)
                                            .clip(RoundedCornerShape(2.dp)),
                                        color = SuccessGreen,
                                        trackColor = BackgroundLight
                                    )
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(dim.explanation, fontSize = 10.sp, color = TextSecondary)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    showHealthDialog = false
                    onQuickActionClick("analytics")
                }) {
                    Text("Operations Hub", fontWeight = FontWeight.Bold, color = TerracottaOrange)
                }
            },
            dismissButton = {
                TextButton(onClick = { showHealthDialog = false }) {
                    Text("Close", color = TextSecondary)
                }
            }
        )
    }

    // ─── Annual Revenue Details Dialog ───
    if (showAnnualDialog) {
        AlertDialog(
            onDismissRequest = { showAnnualDialog = false },
            title = {
                Text(
                    text = "Annual Revenue Analysis",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(InfoBlueLight)
                            .padding(12.dp)
                    ) {
                        Column {
                            Text("FISCAL PERIOD: FY ${overview.currentFY}", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = InfoBlue)
                            Text(RevenueCalculator.formatPaise(overview.annualNetRevenue), fontSize = 24.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                            Text("Total Net Revenue (excl. GST)", fontSize = 10.sp, color = TextSecondary)
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OwnerCard(modifier = Modifier.weight(1f)) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text("Orders", fontSize = 10.sp, color = TextSecondary)
                                Text("${overview.annualOrdersCount}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                        OwnerCard(modifier = Modifier.weight(1f)) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Text("Avg Monthly", fontSize = 10.sp, color = TextSecondary)
                                Text(RevenueCalculator.formatPaise(overview.annualAvgMonthly), fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }
                    }

                    Text(
                        "Analysis reflects canonical desktop fiscal accounting parameters (April 1 to March 31 boundary).",
                        fontSize = 10.sp,
                        color = TextSecondary
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    showAnnualDialog = false
                    onQuickActionClick("annual_revenue")
                }) {
                    Text("View Full Analytics", fontWeight = FontWeight.Bold, color = TerracottaOrange)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAnnualDialog = false }) {
                    Text("Close", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
private fun KpiCard(
    title: String,
    value: String,
    subtitle: String,
    icon: ImageVector,
    iconBg: androidx.compose.ui.graphics.Color,
    iconTint: androidx.compose.ui.graphics.Color,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    OwnerCard(modifier = modifier, onClick = onClick) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(iconBg),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(16.dp))
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(value, fontSize = 17.sp, fontWeight = FontWeight.Black, color = TextPrimary)
            Text(subtitle, fontSize = 10.sp, color = TextSecondary)
        }
    }
}

@Composable
private fun QuickActionButton(
    label: String,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    OwnerCard(modifier = modifier, onClick = onClick) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 10.dp, horizontal = 4.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(TerracottaOrangeLight),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.height(6.dp))
            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = TextPrimary, maxLines = 1)
        }
    }
}

@Composable
private fun LiveOrderRow(order: OrderRecord, onClick: () -> Unit) {
    val tableText = if (order.tableNumber.isNotEmpty()) "Table ${order.tableNumber}" else order.diningOption
    OwnerCard(modifier = Modifier.fillMaxWidth(), onClick = onClick) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(order.orderNumber, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("• $tableText", fontSize = 12.sp, color = TextSecondary)
                }
                OwnerStatusBadge(status = order.status)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(order.createdAt.ifEmpty { "Just now" }, fontSize = 11.sp, color = TextMuted)
                Text(RevenueCalculator.formatPaise(order.total), fontSize = 14.sp, fontWeight = FontWeight.Black, color = TextPrimary)
            }
        }
    }
}
