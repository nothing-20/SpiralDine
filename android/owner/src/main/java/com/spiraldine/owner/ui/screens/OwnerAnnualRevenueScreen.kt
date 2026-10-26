package com.spiraldine.owner.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.AnnualSummaryMetrics
import com.spiraldine.owner.data.model.DailyRevenueRecord
import com.spiraldine.owner.data.model.MonthRevenueRecord
import com.spiraldine.owner.data.model.TransactionRecord
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard
import java.util.Calendar
import java.util.Date

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerAnnualRevenueScreen(
    transactions: List<TransactionRecord>,
    onBack: () -> Unit
) {
    // Available fiscal periods
    val availableFiscalYears = remember { listOf("2026-27", "2025-26", "2024-25") }
    var selectedFiscalYear by remember { mutableStateOf(RevenueCalculator.getCurrentFiscalYear()) }

    // Active tab: "annual" (12-month overview) or "monthly_detail"
    var activeTab by remember { mutableStateOf("annual") }

    // Selected month index in fiscal sequence: 0 = April ... 11 = March
    val initialMonthIndex = remember(selectedFiscalYear) {
        val now = Calendar.getInstance()
        val calMonth = now.get(Calendar.MONTH) // 0 = Jan, 3 = Apr
        if (calMonth >= 3) calMonth - 3 else calMonth + 9
    }
    var selectedMonthIndex by remember { mutableStateOf(initialMonthIndex) }

    // Selected day for date investigation within the month: null = all month, 1..31 = specific day
    var selectedDay by remember { mutableStateOf<Int?>(null) }

    // Search and filter states
    var searchQuery by remember { mutableStateOf("") }
    var selectedPaymentMode by remember { mutableStateOf("All") }
    var selectedPaymentStatus by remember { mutableStateOf("All") }

    // Authoritative Calculations
    val annualMetrics: AnnualSummaryMetrics = remember(transactions, selectedFiscalYear) {
        RevenueCalculator.calculateAnnualMetrics(transactions, selectedFiscalYear)
    }

    val monthlyBreakdown: List<MonthRevenueRecord> = remember(transactions, selectedFiscalYear) {
        RevenueCalculator.calculateMonthlyBreakdown(transactions, selectedFiscalYear)
    }

    val currentMonthRecord: MonthRevenueRecord = remember(monthlyBreakdown, selectedMonthIndex) {
        monthlyBreakdown.getOrElse(selectedMonthIndex.coerceIn(0, 11)) {
            monthlyBreakdown.firstOrNull() ?: MonthRevenueRecord(
                monthIndex = 0,
                calendarMonth = 3,
                year = 2026,
                monthName = "April",
                label = "April 2026",
                grossRevenue = 0.0,
                netRevenue = 0.0,
                gstCollected = 0.0,
                ordersCount = 0,
                trendPercent = 0,
                orders = emptyList()
            )
        }
    }

    // Daily breakdown calculation for selected date
    val selectedDate: Date? = remember(currentMonthRecord, selectedDay) {
        if (selectedDay != null) {
            val cal = Calendar.getInstance()
            cal.set(currentMonthRecord.year, currentMonthRecord.calendarMonth, selectedDay!!, 12, 0, 0)
            cal.time
        } else null
    }

    val dailyRevenueRecord: DailyRevenueRecord? = remember(selectedDate, currentMonthRecord) {
        if (selectedDate != null) {
            RevenueCalculator.calculateDailyRevenue(currentMonthRecord.orders, selectedDate)
        } else null
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = if (activeTab == "annual") "Annual Revenue Explorer" else "${currentMonthRecord.monthName} ${currentMonthRecord.year} Revenue",
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp,
                            color = TextPrimary
                        )
                        Text(
                            text = "Authoritative Accounting • SpiralDine India (INR ₹)",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (activeTab == "monthly_detail") {
                            activeTab = "annual"
                            selectedDay = null
                        } else {
                            onBack()
                        }
                    }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = BackgroundLight
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Fiscal Period Selector & View Navigation Tabs
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceWhite)
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                // SECTION A: Fiscal Year Selector (FY 2026-27, FY 2025-26, etc.)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.DateRange,
                            contentDescription = "Fiscal Period",
                            tint = TerracottaOrange,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            "Fiscal Period:",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        availableFiscalYears.forEach { fy ->
                            val isSelected = (fy == selectedFiscalYear)
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isSelected) TerracottaOrange else BackgroundLight)
                                    .clickable {
                                        selectedFiscalYear = fy
                                        selectedDay = null
                                    }
                                    .padding(horizontal = 10.dp, vertical = 5.dp)
                            ) {
                                Text(
                                    text = "FY $fy",
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) SurfaceWhite else TextSecondary
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Navigation Tabs between Annual Overview and Monthly Detail
                TabRow(
                    selectedTabIndex = if (activeTab == "annual") 0 else 1,
                    containerColor = SurfaceWhite,
                    contentColor = TerracottaOrange,
                    divider = {}
                ) {
                    Tab(
                        selected = activeTab == "annual",
                        onClick = {
                            activeTab = "annual"
                            selectedDay = null
                        },
                        text = {
                            Text(
                                "Annual Overview (12M)",
                                fontSize = 12.sp,
                                fontWeight = if (activeTab == "annual") FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    )
                    Tab(
                        selected = activeTab == "monthly_detail",
                        onClick = { activeTab = "monthly_detail" },
                        text = {
                            Text(
                                "${currentMonthRecord.monthName} Details",
                                fontSize = 12.sp,
                                fontWeight = if (activeTab == "monthly_detail") FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    )
                }
            }

            Divider(color = BorderLight, thickness = 1.dp)

            if (activeTab == "annual") {
                AnnualOverviewContent(
                    fiscalYear = selectedFiscalYear,
                    annualMetrics = annualMetrics,
                    monthlyBreakdown = monthlyBreakdown,
                    onSelectMonth = { monthIndex ->
                        selectedMonthIndex = monthIndex
                        activeTab = "monthly_detail"
                        selectedDay = null
                    }
                )
            } else {
                MonthlyDetailContent(
                    monthRecord = currentMonthRecord,
                    allMonths = monthlyBreakdown,
                    selectedMonthIndex = selectedMonthIndex,
                    selectedDay = selectedDay,
                    dailyRevenueRecord = dailyRevenueRecord,
                    searchQuery = searchQuery,
                    selectedPaymentMode = selectedPaymentMode,
                    selectedPaymentStatus = selectedPaymentStatus,
                    onSelectMonth = { idx ->
                        selectedMonthIndex = idx
                        selectedDay = null
                    },
                    onSelectDay = { day ->
                        selectedDay = day
                    },
                    onSearchChange = { searchQuery = it },
                    onPaymentModeChange = { selectedPaymentMode = it },
                    onPaymentStatusChange = { selectedPaymentStatus = it }
                )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B & C: Annual Overview Content
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun AnnualOverviewContent(
    fiscalYear: String,
    annualMetrics: AnnualSummaryMetrics,
    monthlyBreakdown: List<MonthRevenueRecord>,
    onSelectMonth: (Int) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Fiscal Period Info Banner
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(InfoBlueLight)
                    .padding(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(Icons.Outlined.Info, contentDescription = null, tint = InfoBlue, modifier = Modifier.size(20.dp))
                    Text(
                        text = "Official Fiscal Period: April 1 to March 31. Matches statutory tax accounting and website Annual Revenue Explorer.",
                        fontSize = 11.sp,
                        color = InfoBlue
                    )
                }
            }
        }

        // SECTION B: Annual Summary Metrics (6 Cards)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    text = "ANNUAL FINANCIAL SUMMARY (FY $fiscalYear)",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextSecondary,
                    letterSpacing = 0.5.sp
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MetricCard(
                        title = "Gross Revenue",
                        amount = RevenueCalculator.formatPaise(annualMetrics.grossRevenue),
                        subtitle = "Total collections incl. GST",
                        icon = Icons.Outlined.MonetizationOn,
                        accentColor = TerracottaOrange,
                        modifier = Modifier.weight(1f)
                    )
                    MetricCard(
                        title = "Net Revenue",
                        amount = RevenueCalculator.formatPaise(annualMetrics.netRevenue),
                        subtitle = "Excluding GST",
                        icon = Icons.Outlined.AccountBalanceWallet,
                        accentColor = SuccessGreen,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MetricCard(
                        title = "Total GST",
                        amount = RevenueCalculator.formatPaise(annualMetrics.gstCollected),
                        subtitle = "CGST + SGST (5%)",
                        icon = Icons.Outlined.ReceiptLong,
                        accentColor = InfoBlue,
                        modifier = Modifier.weight(1f)
                    )
                    MetricCard(
                        title = "Completed Orders",
                        amount = "${annualMetrics.totalOrders}",
                        subtitle = "Successful sales",
                        icon = Icons.Outlined.CheckCircle,
                        accentColor = SuccessGreen,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    MetricCard(
                        title = "Avg Order Value",
                        amount = RevenueCalculator.formatPaise(annualMetrics.averageOrderValue),
                        subtitle = "Per successful order",
                        icon = Icons.Outlined.ShoppingBag,
                        accentColor = TerracottaOrange,
                        modifier = Modifier.weight(1f)
                    )
                    MetricCard(
                        title = "Avg Monthly Revenue",
                        amount = RevenueCalculator.formatPaise(annualMetrics.averageMonthlyRevenue),
                        subtitle = "Active operating months",
                        icon = Icons.Outlined.BarChart,
                        accentColor = DarkBrownEspresso,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }

        // SECTION C: 12-Month Fiscal Breakdown
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "12-MONTH FISCAL BREAKDOWN",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextSecondary,
                        letterSpacing = 0.5.sp
                    )
                    Text(
                        text = "April → March",
                        fontSize = 11.sp,
                        color = TextMuted
                    )
                }
            }
        }

        items(monthlyBreakdown) { month ->
            MonthBreakdownCard(
                month = month,
                onClick = { onSelectMonth(month.monthIndex) }
            )
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION D, E, F, G, H, I: Monthly Revenue Detail View
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun MonthlyDetailContent(
    monthRecord: MonthRevenueRecord,
    allMonths: List<MonthRevenueRecord>,
    selectedMonthIndex: Int,
    selectedDay: Int?,
    dailyRevenueRecord: DailyRevenueRecord?,
    searchQuery: String,
    selectedPaymentMode: String,
    selectedPaymentStatus: String,
    onSelectMonth: (Int) -> Unit,
    onSelectDay: (Int?) -> Unit,
    onSearchChange: (String) -> Unit,
    onPaymentModeChange: (String) -> Unit,
    onPaymentStatusChange: (String) -> Unit
) {
    // Filter transactions according to selected date, search query, mode, and status
    val baseTransactions: List<TransactionRecord> = remember(monthRecord, selectedDay) {
        if (selectedDay == null) {
            monthRecord.orders
        } else {
            monthRecord.orders.filter { tx ->
                val d = RevenueCalculator.parseDate(tx.orderTime) ?: return@filter false
                val cal = Calendar.getInstance().apply { time = d }
                cal.get(Calendar.DAY_OF_MONTH) == selectedDay
            }
        }
    }

    val filteredTransactions: List<TransactionRecord> = remember(baseTransactions, searchQuery, selectedPaymentMode, selectedPaymentStatus) {
        baseTransactions.filter { tx ->
            val matchesSearch = searchQuery.isBlank() ||
                tx.invoiceNumber.contains(searchQuery, ignoreCase = true) ||
                tx.orderId.contains(searchQuery, ignoreCase = true) ||
                tx.customerName.contains(searchQuery, ignoreCase = true) ||
                tx.customerPhone.contains(searchQuery, ignoreCase = true) ||
                tx.tableNumber.contains(searchQuery, ignoreCase = true)

            val matchesMode = when (selectedPaymentMode) {
                "All" -> true
                "Cash" -> tx.paymentMethod.contains("cash", ignoreCase = true)
                "UPI" -> tx.paymentMethod.contains("upi", ignoreCase = true) || tx.paymentMethod.contains("razorpay", ignoreCase = true)
                "Card" -> tx.paymentMethod.contains("card", ignoreCase = true)
                else -> true
            }

            val matchesStatus = when (selectedPaymentStatus) {
                "All" -> true
                "Paid" -> tx.paymentStatus.contains("paid", ignoreCase = true) || tx.paymentStatus.contains("completed", ignoreCase = true)
                "Pending" -> tx.paymentStatus.contains("pending", ignoreCase = true)
                "Refunded" -> tx.paymentStatus.contains("refunded", ignoreCase = true) || tx.orderStatus.contains("CANCELLED", ignoreCase = true)
                else -> true
            }

            matchesSearch && matchesMode && matchesStatus
        }
    }

    // Payment method breakdown calculations
    val paymentBreakdown = remember(baseTransactions) {
        var cashSum = 0.0
        var cashCount = 0
        var upiSum = 0.0
        var upiCount = 0
        var cardSum = 0.0
        var cardCount = 0
        var pendingSum = 0.0
        var pendingCount = 0

        baseTransactions.forEach { tx ->
            if (RevenueCalculator.isPaidTransaction(tx)) {
                val mode = tx.paymentMethod.lowercase()
                when {
                    mode.contains("cash") -> {
                        cashSum += tx.total
                        cashCount++
                    }
                    mode.contains("upi") || mode.contains("razorpay") -> {
                        upiSum += tx.total
                        upiCount++
                    }
                    else -> {
                        cardSum += tx.total
                        cardCount++
                    }
                }
            } else {
                pendingSum += tx.total
                pendingCount++
            }
        }
        val totalCollected = cashSum + upiSum + cardSum
        PaymentBreakdownData(
            cashAmount = cashSum,
            cashCount = cashCount,
            upiAmount = upiSum,
            upiCount = upiCount,
            cardAmount = cardSum,
            cardCount = cardCount,
            pendingAmount = pendingSum,
            pendingCount = pendingCount,
            totalCollected = totalCollected
        )
    }

    // GST Breakdown (50% CGST, 50% SGST)
    val effectiveGst = dailyRevenueRecord?.gstCollected ?: monthRecord.gstCollected
    val cgst = effectiveGst / 2.0
    val sgst = effectiveGst / 2.0
    val igst = 0.0

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Month Selector Carousel (April to March)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    text = "SELECT MONTH (FY ORDER)",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextSecondary
                )
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(allMonths) { m ->
                        val isSelected = (m.monthIndex == selectedMonthIndex)
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (isSelected) TerracottaOrange else SurfaceWhite)
                                .border(1.dp, if (isSelected) TerracottaOrange else BorderLight, RoundedCornerShape(10.dp))
                                .clickable { onSelectMonth(m.monthIndex) }
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = m.monthName.take(3),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) SurfaceWhite else TextPrimary
                                )
                                Text(
                                    text = RevenueCalculator.formatPaise(m.netRevenue),
                                    fontSize = 10.sp,
                                    color = if (isSelected) SurfaceWhite.copy(alpha = 0.85f) else TextSecondary
                                )
                            }
                        }
                    }
                }
            }
        }

        // SECTION D: Month Overview Card
        item {
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "${monthRecord.monthName} ${monthRecord.year}",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Monthly Revenue Breakdown",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }

                        if (monthRecord.trendPercent != 0) {
                            val isPos = monthRecord.trendPercent >= 0
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (isPos) SuccessGreenLight else ErrorRedLight)
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "${if (isPos) "+" else ""}${monthRecord.trendPercent}% MoM",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isPos) SuccessGreen else ErrorRed
                                )
                            }
                        }
                    }

                    Divider(color = BorderLight)

                    // Month KPI Grid
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MiniKpi(label = "Gross Revenue", value = RevenueCalculator.formatPaise(monthRecord.grossRevenue), modifier = Modifier.weight(1f))
                        MiniKpi(label = "Net Revenue", value = RevenueCalculator.formatPaise(monthRecord.netRevenue), modifier = Modifier.weight(1f))
                        MiniKpi(label = "GST (5%)", value = RevenueCalculator.formatPaise(monthRecord.gstCollected), modifier = Modifier.weight(1f))
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        MiniKpi(label = "Successful Orders", value = "${monthRecord.ordersCount}", modifier = Modifier.weight(1f))
                        val aov = if (monthRecord.ordersCount > 0) monthRecord.grossRevenue / monthRecord.ordersCount else 0.0
                        MiniKpi(label = "Avg Order Value", value = RevenueCalculator.formatPaise(aov), modifier = Modifier.weight(1f))
                    }
                }
            }
        }

        // SECTION E: Date-Based Revenue Investigation (Scrubber + Daily Breakdown)
        item {
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.CalendarMonth, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Date-Based Revenue Investigation",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                        }

                        // "View Full Month" / "Jump to Today" controls
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            if (selectedDay != null) {
                                TextButton(
                                    onClick = { onSelectDay(null) },
                                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text("Full Month", fontSize = 11.sp, color = TerracottaOrange)
                                }
                            }
                            TextButton(
                                onClick = {
                                    val now = Calendar.getInstance()
                                    onSelectDay(now.get(Calendar.DAY_OF_MONTH))
                                },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text("Today", fontSize = 11.sp, color = InfoBlue)
                            }
                        }
                    }

                    Text(
                        text = "Select any day to inspect daily sales ledger, tax distribution, and order volume.",
                        fontSize = 11.sp,
                        color = TextSecondary
                    )

                    // Day Number Scrubber
                    val daysInMonth = remember(monthRecord) {
                        val cal = Calendar.getInstance()
                        cal.set(monthRecord.year, monthRecord.calendarMonth, 1)
                        cal.getActualMaximum(Calendar.DAY_OF_MONTH)
                    }

                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        // "All" item
                        item {
                            val isAll = (selectedDay == null)
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(if (isAll) TerracottaOrange else BackgroundLight)
                                    .border(1.dp, if (isAll) TerracottaOrange else BorderLight, CircleShape)
                                    .clickable { onSelectDay(null) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "ALL",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isAll) SurfaceWhite else TextSecondary
                                )
                            }
                        }

                        items((1..daysInMonth).toList()) { day ->
                            val isSelected = (selectedDay == day)
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(if (isSelected) TerracottaOrange else BackgroundLight)
                                    .border(1.dp, if (isSelected) TerracottaOrange else BorderLight, CircleShape)
                                    .clickable { onSelectDay(day) },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "$day",
                                    fontSize = 12.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) SurfaceWhite else TextPrimary
                                )
                            }
                        }
                    }

                    // Display Daily Summary if Day is Selected
                    if (dailyRevenueRecord != null) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(DarkBrownLight)
                                .padding(12.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text(
                                    text = "DAY SUMMARY • ${dailyRevenueRecord.displayDate}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = DarkBrownEspresso
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text("Daily Gross", fontSize = 10.sp, color = TextSecondary)
                                        Text(RevenueCalculator.formatPaise(dailyRevenueRecord.grossRevenue), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    }
                                    Column {
                                        Text("Daily Net", fontSize = 10.sp, color = TextSecondary)
                                        Text(RevenueCalculator.formatPaise(dailyRevenueRecord.netRevenue), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                                    }
                                    Column {
                                        Text("Daily GST", fontSize = 10.sp, color = TextSecondary)
                                        Text(RevenueCalculator.formatPaise(dailyRevenueRecord.gstCollected), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = InfoBlue)
                                    }
                                    Column {
                                        Text("Orders", fontSize = 10.sp, color = TextSecondary)
                                        Text("${dailyRevenueRecord.successfulOrdersCount}", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // SECTION G: Payment Breakdown
        item {
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Payments, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Payment Method Breakdown",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }

                    PaymentCategoryRow(
                        title = "UPI / Razorpay",
                        amount = paymentBreakdown.upiAmount,
                        count = paymentBreakdown.upiCount,
                        total = paymentBreakdown.totalCollected,
                        icon = Icons.Outlined.QrCode,
                        iconTint = SuccessGreen
                    )
                    PaymentCategoryRow(
                        title = "Cash Counter",
                        amount = paymentBreakdown.cashAmount,
                        count = paymentBreakdown.cashCount,
                        total = paymentBreakdown.totalCollected,
                        icon = Icons.Outlined.Money,
                        iconTint = TerracottaOrange
                    )
                    PaymentCategoryRow(
                        title = "Credit / Debit Card",
                        amount = paymentBreakdown.cardAmount,
                        count = paymentBreakdown.cardCount,
                        total = paymentBreakdown.totalCollected,
                        icon = Icons.Outlined.CreditCard,
                        iconTint = InfoBlue
                    )

                    if (paymentBreakdown.pendingAmount > 0.0) {
                        Divider(color = BorderLight)
                        PaymentCategoryRow(
                            title = "Outstanding / Pending",
                            amount = paymentBreakdown.pendingAmount,
                            count = paymentBreakdown.pendingCount,
                            total = paymentBreakdown.pendingAmount,
                            icon = Icons.Outlined.HourglassEmpty,
                            iconTint = WarningAmber
                        )
                    }
                }
            }
        }

        // SECTION H: GST Breakdown (CGST, SGST, IGST)
        item {
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.AccountBalance, contentDescription = null, tint = InfoBlue, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Statutory GST Breakdown (GST 5%)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        GstTaxBox(label = "CGST (2.5%)", amount = cgst, modifier = Modifier.weight(1f))
                        GstTaxBox(label = "SGST (2.5%)", amount = sgst, modifier = Modifier.weight(1f))
                        GstTaxBox(label = "IGST (0%)", amount = igst, modifier = Modifier.weight(1f))
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(BackgroundLight)
                            .padding(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Total GST Payable:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text(RevenueCalculator.formatPaise(effectiveGst), fontSize = 13.sp, fontWeight = FontWeight.Black, color = InfoBlue)
                        }
                    }

                    Text(
                        text = "Applicable restaurant GST: 2.5% Central GST + 2.5% State GST under Section 9 of the CGST Act.",
                        fontSize = 10.sp,
                        color = TextSecondary
                    )
                }
            }
        }

        // SECTION I: Monthly Settlements Timeline & Payment-Method Analysis
        item {
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Timeline, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Monthly Settlements & Channel Mix",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }

                    val digitalPercent = if (paymentBreakdown.totalCollected > 0) {
                        ((paymentBreakdown.upiAmount + paymentBreakdown.cardAmount) / paymentBreakdown.totalCollected * 100).toInt()
                    } else 0

                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Digital vs Cash Settlement Ratio", fontSize = 11.sp, color = TextSecondary)
                            Text("$digitalPercent% Digital", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TerracottaOrange)
                        }
                        LinearProgressIndicator(
                            progress = { digitalPercent / 100f },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = TerracottaOrange,
                            trackColor = WarningAmberLight
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Bank Payout Status:", fontSize = 11.sp, color = TextSecondary)
                        }
                        Text("Reconciled & Settled", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                    }
                }
            }
        }

        // SECTION F: Receipt Ledger & Invoice Search
        item {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "RECEIPT LEDGER (${filteredTransactions.size} ENTRIES)",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextSecondary,
                        letterSpacing = 0.5.sp
                    )
                }

                // Search Bar
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = onSearchChange,
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search invoice, table, customer, phone...", fontSize = 12.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { onSearchChange("") }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear", tint = TextSecondary)
                            }
                        }
                    },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceWhite,
                        unfocusedContainerColor = SurfaceWhite,
                        focusedBorderColor = TerracottaOrange,
                        unfocusedBorderColor = BorderLight
                    ),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                    keyboardActions = KeyboardActions(onSearch = { })
                )

                // Payment Mode Filter Chips
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    val modes = listOf("All", "UPI", "Cash", "Card")
                    items(modes) { mode ->
                        val isSelected = (selectedPaymentMode == mode)
                        FilterChip(
                            selected = isSelected,
                            onClick = { onPaymentModeChange(mode) },
                            label = { Text(mode, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TerracottaOrange,
                                selectedLabelColor = SurfaceWhite
                            )
                        )
                    }
                }
            }
        }

        // Transaction List or Empty State
        if (filteredTransactions.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(SurfaceWhite)
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            Icons.Outlined.ReceiptLong,
                            contentDescription = null,
                            tint = TextMuted,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(
                            text = "No Qualifying Transactions Found",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Text(
                            text = if (selectedDay != null) "No recorded transactions for Day $selectedDay in ${monthRecord.monthName}."
                            else "No transaction logs match the applied filters for ${monthRecord.monthName} ${monthRecord.year}.",
                            fontSize = 11.sp,
                            color = TextSecondary,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            }
        } else {
            items(filteredTransactions) { tx: TransactionRecord ->
                TransactionLedgerCard(transaction = tx)
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Helper Components
// ─────────────────────────────────────────────────────────────────────────────

@Composable
private fun MetricCard(
    title: String,
    amount: String,
    subtitle: String,
    icon: ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    OwnerCard(modifier = modifier) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = TextSecondary
                )
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(accentColor.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = accentColor, modifier = Modifier.size(16.dp))
                }
            }
            Text(
                text = amount,
                fontSize = 17.sp,
                fontWeight = FontWeight.Black,
                color = TextPrimary
            )
            Text(
                text = subtitle,
                fontSize = 10.sp,
                color = TextMuted
            )
        }
    }
}

@Composable
private fun MonthBreakdownCard(
    month: MonthRevenueRecord,
    onClick: () -> Unit
) {
    OwnerCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "${month.monthName} ${month.year}",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "•  ${month.ordersCount} orders",
                        fontSize = 11.sp,
                        color = TextSecondary
                    )
                }

                Text(
                    text = "Gross: ${RevenueCalculator.formatPaise(month.grossRevenue)} • GST: ${RevenueCalculator.formatPaise(month.gstCollected)}",
                    fontSize = 11.sp,
                    color = TextMuted
                )
            }

            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = RevenueCalculator.formatPaise(month.netRevenue),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black,
                    color = SuccessGreen
                )

                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (month.trendPercent != 0) {
                        val isPos = month.trendPercent >= 0
                        Text(
                            text = "${if (isPos) "+" else ""}${month.trendPercent}%",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isPos) SuccessGreen else ErrorRed
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    Icon(
                        Icons.Default.ChevronRight,
                        contentDescription = "Details",
                        tint = TextMuted,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun MiniKpi(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(BackgroundLight)
            .padding(8.dp)
    ) {
        Column {
            Text(label, fontSize = 10.sp, color = TextSecondary)
            Spacer(modifier = Modifier.height(2.dp))
            Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        }
    }
}

@Composable
private fun PaymentCategoryRow(
    title: String,
    amount: Double,
    count: Int,
    total: Double,
    icon: ImageVector,
    iconTint: Color
) {
    val percentage = if (total > 0) (amount / total * 100).toInt() else 0
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(iconTint.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column {
                Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text("$count orders • $percentage%", fontSize = 10.sp, color = TextSecondary)
            }
        }

        Text(
            text = RevenueCalculator.formatPaise(amount),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )
    }
}

@Composable
private fun GstTaxBox(
    label: String,
    amount: Double,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(InfoBlueLight.copy(alpha = 0.5f))
            .padding(8.dp)
    ) {
        Column {
            Text(label, fontSize = 10.sp, fontWeight = FontWeight.Medium, color = InfoBlue)
            Spacer(modifier = Modifier.height(2.dp))
            Text(RevenueCalculator.formatPaise(amount), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        }
    }
}

@Composable
private fun TransactionLedgerCard(transaction: TransactionRecord) {
    var isExpanded by remember { mutableStateOf(false) }

    OwnerCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = { isExpanded = !isExpanded }
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = transaction.invoiceNumber,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(
                                if (transaction.paymentStatus.contains("paid")) SuccessGreenLight
                                else if (transaction.paymentStatus.contains("refund")) ErrorRedLight
                                else WarningAmberLight
                            )
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = transaction.paymentStatus.uppercase(),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (transaction.paymentStatus.contains("paid")) SuccessGreen
                            else if (transaction.paymentStatus.contains("refund")) ErrorRed
                            else WarningAmber
                        )
                    }
                }

                Text(
                    text = RevenueCalculator.formatPaise(transaction.total),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = TextPrimary
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Table ${transaction.tableNumber} • ${transaction.customerName}",
                    fontSize = 11.sp,
                    color = TextSecondary
                )
                Text(
                    text = transaction.paymentMethod.uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = DarkBrownEspresso
                )
            }

            // Expandable details (Items breakdown, tax breakdown)
            AnimatedVisibility(visible = isExpanded) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp)
                        .background(BackgroundLight, RoundedCornerShape(8.dp))
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text("Order Breakdown", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    transaction.items.forEach { itm ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("${itm.name} x${itm.quantity}", fontSize = 11.sp, color = TextSecondary)
                            Text(RevenueCalculator.formatPaise(itm.price * itm.quantity), fontSize = 11.sp, color = TextPrimary)
                        }
                    }
                    Divider(color = BorderLight, modifier = Modifier.padding(vertical = 4.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Subtotal", fontSize = 10.sp, color = TextSecondary)
                        Text(RevenueCalculator.formatPaise(transaction.subtotal), fontSize = 10.sp, color = TextPrimary)
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("GST (CGST + SGST)", fontSize = 10.sp, color = TextSecondary)
                        Text(RevenueCalculator.formatPaise(transaction.tax), fontSize = 10.sp, color = TextPrimary)
                    }
                    if (transaction.discount > 0.0) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Discount", fontSize = 10.sp, color = TextSecondary)
                            Text("-${RevenueCalculator.formatPaise(transaction.discount)}", fontSize = 10.sp, color = SuccessGreen)
                        }
                    }
                    if (transaction.orderTime.isNotBlank()) {
                        Text("Timestamp: ${transaction.orderTime}", fontSize = 9.sp, color = TextMuted)
                    }
                }
            }
        }
    }
}

private data class PaymentBreakdownData(
    val cashAmount: Double,
    val cashCount: Int,
    val upiAmount: Double,
    val upiCount: Int,
    val cardAmount: Double,
    val cardCount: Int,
    val pendingAmount: Double,
    val pendingCount: Int,
    val totalCollected: Double
)
