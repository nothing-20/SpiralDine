package com.spiraldine.owner.ui.screens

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.spiraldine.owner.data.model.OrderRecord
import com.spiraldine.owner.data.model.RefundRecord
import com.spiraldine.owner.data.model.ShiftRecord
import com.spiraldine.owner.data.model.TransactionRecord
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerBillingScreen(
    orders: List<OrderRecord>,
    transactions: List<TransactionRecord>,
    shifts: List<ShiftRecord>,
    refunds: List<RefundRecord>,
    onBack: () -> Unit,
    onOpenShift: (Double, String) -> Unit,
    onCloseShift: (Double, String) -> Unit,
    onSettleBill: (String, String) -> Unit,
    onProcessRefund: (String, Double, String, String) -> Unit
) {
    var activeTab by remember { mutableStateOf("queue") } // queue, open_bills, paid_bills, refunds, transactions, shifts, summary
    var searchQuery by remember { mutableStateOf("") }

    // Dialog states
    var showOpenShiftDialog by remember { mutableStateOf(false) }
    var showCloseShiftDialog by remember { mutableStateOf(false) }
    var selectedOrderForCheckout by remember { mutableStateOf<OrderRecord?>(null) }
    var selectedOrderForRefund by remember { mutableStateOf<OrderRecord?>(null) }
    var selectedBillDetails by remember { mutableStateOf<OrderRecord?>(null) }

    val activeShift = shifts.firstOrNull { it.status == "OPEN" }

    // Computed financial metrics
    val paidOrders = orders.filter { it.paymentStatus.equals("paid", true) || it.status.equals("COMPLETED", true) }
    val openOrders = orders.filter { !it.paymentStatus.equals("paid", true) && !it.status.equals("CANCELLED", true) && !it.status.equals("REFUNDED", true) }

    val todayGrossRevenue = paidOrders.sumOf { it.total }
    val todayTax = paidOrders.sumOf { it.tax }
    val todayDiscounts = paidOrders.sumOf { it.discount }
    val avgBillValue = if (paidOrders.isNotEmpty()) todayGrossRevenue / paidOrders.size else 0.0

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Billing & POS Hub", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                        Text(
                            if (activeShift != null) "Shift ${activeShift.shiftNumber} Active" else "No Active Shift Drawer",
                            fontSize = 11.sp,
                            color = if (activeShift != null) SuccessGreen else WarningYellow
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    if (activeShift == null) {
                        Button(
                            onClick = { showOpenShiftDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Open Shift", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Button(
                            onClick = { showCloseShiftDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = DangerRed),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp),
                            modifier = Modifier.padding(end = 8.dp)
                        ) {
                            Icon(Icons.Default.Stop, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Close Shift", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = BackgroundLight
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // 1. Financial KPI Cards Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                BillingKpiCard(title = "Today's Revenue", value = RevenueCalculator.formatPaise(todayGrossRevenue), icon = Icons.Default.CurrencyRupee, color = TerracottaOrange)
                BillingKpiCard(title = "Tax Collected", value = RevenueCalculator.formatPaise(todayTax), icon = Icons.Default.ReceiptLong, color = InfoBlue)
                BillingKpiCard(title = "Discounts", value = RevenueCalculator.formatPaise(todayDiscounts), icon = Icons.Default.Loyalty, color = WarningYellow)
                BillingKpiCard(title = "Avg Bill Value", value = RevenueCalculator.formatPaise(avgBillValue), icon = Icons.Default.BarChart, color = SuccessGreen)
            }

            // 2. Tab Navigation Bar
            val tabs = listOf(
                "queue" to "Live Queue (${openOrders.count { it.status == "DINING" || it.status == "PREPARING" }})",
                "open_bills" to "Open Bills (${openOrders.size})",
                "paid_bills" to "Paid Bills (${paidOrders.size})",
                "refunds" to "Refunds (${refunds.size})",
                "transactions" to "Transactions (${transactions.size})",
                "shifts" to "Shift Reports",
                "summary" to "Sales Summary"
            )

            ScrollableTabRow(
                selectedTabIndex = tabs.indexOfFirst { it.first == activeTab }.coerceAtLeast(0),
                containerColor = SurfaceWhite,
                contentColor = TerracottaOrange,
                edgePadding = 16.dp,
                divider = { Divider(color = DividerStroke) }
            ) {
                tabs.forEach { (key, label) ->
                    Tab(
                        selected = activeTab == key,
                        onClick = { activeTab = key },
                        text = {
                            Text(
                                label,
                                fontSize = 12.sp,
                                fontWeight = if (activeTab == key) FontWeight.Bold else FontWeight.Normal,
                                color = if (activeTab == key) TerracottaOrange else TextSecondary
                            )
                        }
                    )
                }
            }

            // Search filter for lists
            if (activeTab != "shifts" && activeTab != "summary") {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search by table, order #, or customer...", fontSize = 12.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(16.dp))
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceWhite,
                        unfocusedContainerColor = SurfaceWhite,
                        focusedBorderColor = TerracottaOrange,
                        unfocusedBorderColor = DividerStroke
                    ),
                    singleLine = true
                )
            }

            // 3. Tab Content Switcher
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 4.dp)
            ) {
                when (activeTab) {
                    "queue" -> {
                        val queueOrders = openOrders.filter {
                            searchQuery.isBlank() || it.tableNumber.contains(searchQuery, true) || it.orderNumber.contains(searchQuery, true)
                        }
                        OrdersBillingList(
                            orders = queueOrders,
                            emptyMessage = "No active dine-in orders in queue",
                            onSettle = { selectedOrderForCheckout = it },
                            onRefund = { selectedOrderForRefund = it },
                            onViewDetails = { selectedBillDetails = it }
                        )
                    }
                    "open_bills" -> {
                        val filteredOpen = openOrders.filter {
                            searchQuery.isBlank() || it.tableNumber.contains(searchQuery, true) || it.orderNumber.contains(searchQuery, true)
                        }
                        OrdersBillingList(
                            orders = filteredOpen,
                            emptyMessage = "All bills are currently settled",
                            onSettle = { selectedOrderForCheckout = it },
                            onRefund = { selectedOrderForRefund = it },
                            onViewDetails = { selectedBillDetails = it }
                        )
                    }
                    "paid_bills" -> {
                        val filteredPaid = paidOrders.filter {
                            searchQuery.isBlank() || it.tableNumber.contains(searchQuery, true) || it.orderNumber.contains(searchQuery, true)
                        }
                        OrdersBillingList(
                            orders = filteredPaid,
                            emptyMessage = "No paid bills recorded yet today",
                            onSettle = null,
                            onRefund = { selectedOrderForRefund = it },
                            onViewDetails = { selectedBillDetails = it }
                        )
                    }
                    "refunds" -> {
                        RefundsListView(refunds = refunds)
                    }
                    "transactions" -> {
                        val filteredTx = transactions.filter {
                            searchQuery.isBlank() || it.orderId.contains(searchQuery, true) || it.invoiceNumber.contains(searchQuery, true)
                        }
                        TransactionsListView(transactions = filteredTx)
                    }
                    "shifts" -> {
                        ShiftReportsListView(
                            shifts = shifts,
                            activeShift = activeShift,
                            onOpenShift = { showOpenShiftDialog = true },
                            onCloseShift = { showCloseShiftDialog = true }
                        )
                    }
                    "summary" -> {
                        BillingSalesSummaryView(
                            paidOrders = paidOrders,
                            totalRevenue = todayGrossRevenue,
                            tax = todayTax,
                            discounts = todayDiscounts
                        )
                    }
                }
            }
        }
    }

    // Open Shift Dialog
    if (showOpenShiftDialog) {
        OpenShiftDialog(
            onDismiss = { showOpenShiftDialog = false },
            onConfirm = { cash, notes ->
                onOpenShift(cash, notes)
                showOpenShiftDialog = false
            }
        )
    }

    // Close Shift Dialog
    if (showCloseShiftDialog && activeShift != null) {
        CloseShiftDialog(
            activeShift = activeShift,
            currentSales = todayGrossRevenue,
            onDismiss = { showCloseShiftDialog = false },
            onConfirm = { actualCash, notes ->
                onCloseShift(actualCash, notes)
                showCloseShiftDialog = false
            }
        )
    }

    // Checkout / Settle Bill Dialog
    if (selectedOrderForCheckout != null) {
        CheckoutBillDialog(
            order = selectedOrderForCheckout!!,
            onDismiss = { selectedOrderForCheckout = null },
            onSettle = { mode ->
                onSettleBill(selectedOrderForCheckout!!.id, mode)
                selectedOrderForCheckout = null
            }
        )
    }

    // Refund Dialog
    if (selectedOrderForRefund != null) {
        ProcessRefundDialog(
            order = selectedOrderForRefund!!,
            onDismiss = { selectedOrderForRefund = null },
            onRefund = { amt, reason, type ->
                onProcessRefund(selectedOrderForRefund!!.id, amt, reason, type)
                selectedOrderForRefund = null
            }
        )
    }

    // Bill Details Modal
    if (selectedBillDetails != null) {
        BillDetailsDialog(
            order = selectedBillDetails!!,
            onDismiss = { selectedBillDetails = null }
        )
    }
}

@Composable
fun BillingKpiCard(title: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = SurfaceWhite,
        border = androidx.compose.foundation.BorderStroke(1.dp, DividerStroke),
        modifier = Modifier.width(135.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
                Box(
                    modifier = Modifier
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(color.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(12.dp))
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 14.sp, fontWeight = FontWeight.Black, color = TextPrimary)
        }
    }
}

@Composable
fun OrdersBillingList(
    orders: List<OrderRecord>,
    emptyMessage: String,
    onSettle: ((OrderRecord) -> Unit)?,
    onRefund: (OrderRecord) -> Unit,
    onViewDetails: (OrderRecord) -> Unit
) {
    if (orders.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(emptyMessage, fontSize = 12.sp, color = TextSecondary)
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(orders, key = { it.id }) { order ->
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Text(
                                        if (order.orderNumber.isNotBlank()) order.orderNumber else "#${order.id.takeLast(6).uppercase()}",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = TextPrimary
                                    )
                                    Surface(
                                        color = TerracottaOrangeLight,
                                        shape = RoundedCornerShape(6.dp)
                                    ) {
                                        Text(
                                            if (order.tableNumber.isNotBlank()) "Table ${order.tableNumber}" else order.diningOption,
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TerracottaOrange,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                                Text(
                                    "${order.items.size} items • ${order.paymentMethod}",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    RevenueCalculator.formatPaise(order.total),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Black,
                                    color = TextPrimary
                                )
                                Text(
                                    order.paymentStatus.uppercase(),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (order.paymentStatus.equals("paid", true)) SuccessGreen else WarningYellow
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        Divider(color = DividerStroke)
                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(
                                onClick = { onViewDetails(order) },
                                contentPadding = PaddingValues(0.dp)
                            ) {
                                Icon(Icons.Default.Receipt, contentDescription = null, modifier = Modifier.size(14.dp), tint = TextSecondary)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("View Bill", fontSize = 11.sp, color = TextSecondary)
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                if (order.paymentStatus.equals("paid", true)) {
                                    OutlinedButton(
                                        onClick = { onRefund(order) },
                                        shape = RoundedCornerShape(8.dp),
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                    ) {
                                        Text("Refund", fontSize = 10.sp, color = DangerRed)
                                    }
                                }

                                if (onSettle != null && !order.paymentStatus.equals("paid", true)) {
                                    Button(
                                        onClick = { onSettle(order) },
                                        shape = RoundedCornerShape(8.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                                    ) {
                                        Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(13.dp))
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Settle Bill", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
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
fun RefundsListView(refunds: List<RefundRecord>) {
    if (refunds.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No refunds processed for this restaurant", fontSize = 12.sp, color = TextSecondary)
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(refunds, key = { it.id }) { rf ->
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Refund #${rf.id.takeLast(6).uppercase()}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("Order: ${rf.orderId} • Reason: ${rf.reason}", fontSize = 11.sp, color = TextSecondary)
                            Text("Processed by: ${rf.processedBy}", fontSize = 10.sp, color = TextSecondary)
                        }
                        Text(
                            "- ${RevenueCalculator.formatPaise(rf.amount)}",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Black,
                            color = DangerRed
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TransactionsListView(transactions: List<TransactionRecord>) {
    if (transactions.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No transactions logged in the audit ledger", fontSize = 12.sp, color = TextSecondary)
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(transactions, key = { it.id }) { tx ->
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(tx.invoiceNumber.ifBlank { "TX-${tx.id.takeLast(6).uppercase()}" }, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("${tx.tableNumber} • Method: ${tx.paymentMethod.uppercase()}", fontSize = 11.sp, color = TextSecondary)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(RevenueCalculator.formatPaise(tx.total), fontSize = 13.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                            Text(tx.paymentStatus.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = if (tx.paymentStatus == "paid") SuccessGreen else WarningYellow)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ShiftReportsListView(
    shifts: List<ShiftRecord>,
    activeShift: ShiftRecord?,
    onOpenShift: () -> Unit,
    onCloseShift: () -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Cash Drawer Shift Status", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Spacer(modifier = Modifier.height(8.dp))
                    if (activeShift != null) {
                        Text("Active Shift: ${activeShift.shiftNumber}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                        Text("Opened by: ${activeShift.openedBy} at ${activeShift.openedAt.take(16).replace("T", " ")}", fontSize = 11.sp, color = TextSecondary)
                        Text("Opening Cash Float: ${RevenueCalculator.formatInr(activeShift.openingCash)}", fontSize = 12.sp, color = TextPrimary)
                        Spacer(modifier = Modifier.height(10.dp))
                        Button(
                            onClick = onCloseShift,
                            colors = ButtonDefaults.buttonColors(containerColor = DangerRed),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Close Shift & Reconcile Cash", fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Text("No shift currently open. Open a new cash drawer shift to track till reconciliation.", fontSize = 11.sp, color = TextSecondary)
                        Spacer(modifier = Modifier.height(10.dp))
                        Button(
                            onClick = onOpenShift,
                            colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Open New Shift", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        item {
            Text("Past Shift History", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        }

        items(shifts.filter { it.status == "CLOSED" }, key = { it.id }) { sh ->
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(sh.shiftNumber, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                        Surface(color = SuccessGreen.copy(alpha = 0.15f), shape = RoundedCornerShape(6.dp)) {
                            Text("CLOSED", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = SuccessGreen, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Opened: ${sh.openedAt.take(16).replace("T", " ")} • Closed: ${sh.closedAt?.take(16)?.replace("T", " ") ?: ""}", fontSize = 10.sp, color = TextSecondary)
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Opening: ${RevenueCalculator.formatInr(sh.openingCash)}", fontSize = 11.sp, color = TextSecondary)
                        Text("Actual: ${RevenueCalculator.formatInr(sh.actualClosingCash)}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    }
                    if (sh.cashDifference != 0.0) {
                        Text(
                            "Variance: ${if (sh.cashDifference > 0) "+" else ""}${RevenueCalculator.formatInr(sh.cashDifference)}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (sh.cashDifference >= 0) SuccessGreen else DangerRed
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun BillingSalesSummaryView(
    paidOrders: List<OrderRecord>,
    totalRevenue: Double,
    tax: Double,
    discounts: Double
) {
    val cashSales = paidOrders.filter { it.paymentMethod.contains("cash", true) }.sumOf { it.total }
    val upiSales = paidOrders.filter { it.paymentMethod.contains("upi", true) }.sumOf { it.total }
    val cardSales = paidOrders.filter { it.paymentMethod.contains("card", true) }.sumOf { it.total }
    val otherSales = (totalRevenue - cashSales - upiSales - cardSales).coerceAtLeast(0.0)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OwnerCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Sales Summary Breakdown", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Spacer(modifier = Modifier.height(10.dp))
                SummaryLine("Gross Revenue", RevenueCalculator.formatPaise(totalRevenue), isBold = true)
                SummaryLine("GST / Tax Collected", RevenueCalculator.formatPaise(tax))
                SummaryLine("Discounts Deducted", "- ${RevenueCalculator.formatPaise(discounts)}")
                SummaryLine("Net Sales", RevenueCalculator.formatPaise(totalRevenue - tax), isBold = true)
            }
        }

        OwnerCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Payment Method Tender Breakdown", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Spacer(modifier = Modifier.height(10.dp))
                SummaryLine("UPI / Digital", RevenueCalculator.formatPaise(upiSales))
                SummaryLine("Cash", RevenueCalculator.formatPaise(cashSales))
                SummaryLine("Credit / Debit Card", RevenueCalculator.formatPaise(cardSales))
                if (otherSales > 0) {
                    SummaryLine("Other Modes", RevenueCalculator.formatPaise(otherSales))
                }
            }
        }
    }
}

@Composable
fun SummaryLine(label: String, value: String, isBold: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(label, fontSize = 12.sp, color = if (isBold) TextPrimary else TextSecondary, fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal)
        Text(value, fontSize = 12.sp, color = TextPrimary, fontWeight = if (isBold) FontWeight.Bold else FontWeight.Medium)
    }
}

@Composable
fun OpenShiftDialog(onDismiss: () -> Unit, onConfirm: (Double, String) -> Unit) {
    var openingCash by remember { mutableStateOf("1000") }
    var notes by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), color = SurfaceWhite, modifier = Modifier.padding(16.dp)) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Open Cash Drawer Shift", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                OutlinedTextField(
                    value = openingCash,
                    onValueChange = { openingCash = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Opening Cash Float (₹)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Shift Notes (Optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel", color = TextSecondary) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onConfirm(openingCash.toDoubleOrNull() ?: 0.0, notes) },
                        colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen)
                    ) {
                        Text("Open Shift", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun CloseShiftDialog(activeShift: ShiftRecord, currentSales: Double, onDismiss: () -> Unit, onConfirm: (Double, String) -> Unit) {
    val expected = activeShift.openingCash + currentSales
    var actualCash by remember { mutableStateOf(expected.toInt().toString()) }
    var notes by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), color = SurfaceWhite, modifier = Modifier.padding(16.dp)) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Close Shift & Reconcile Cash", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                Text("Expected Cash in Till: ${RevenueCalculator.formatInr(expected)}", fontSize = 12.sp, color = TextSecondary)

                OutlinedTextField(
                    value = actualCash,
                    onValueChange = { actualCash = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Actual Counted Cash (₹)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                val diff = (actualCash.toDoubleOrNull() ?: 0.0) - expected
                Text(
                    "Cash Difference: ${if (diff > 0) "+" else ""}${RevenueCalculator.formatInr(diff)}",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (diff >= 0) SuccessGreen else DangerRed
                )

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Reconciliation Remarks") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel", color = TextSecondary) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onConfirm(actualCash.toDoubleOrNull() ?: 0.0, notes) },
                        colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                    ) {
                        Text("Confirm & Close", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun CheckoutBillDialog(order: OrderRecord, onDismiss: () -> Unit, onSettle: (String) -> Unit) {
    var selectedMethod by remember { mutableStateOf("UPI") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), color = SurfaceWhite, modifier = Modifier.padding(16.dp)) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Settle Bill", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                Text(
                    "Table ${order.tableNumber} • Amount: ${RevenueCalculator.formatPaise(order.total)}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = TerracottaOrange
                )

                Text("Select Payment Tender", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("UPI", "Cash", "Card").forEach { mode ->
                        FilterChip(
                            selected = selectedMethod == mode,
                            onClick = { selectedMethod = mode },
                            label = { Text(mode) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TerracottaOrange,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel", color = TextSecondary) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onSettle(selectedMethod) },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Mark as Paid", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun ProcessRefundDialog(order: OrderRecord, onDismiss: () -> Unit, onRefund: (Double, String, String) -> Unit) {
    var refundAmount by remember { mutableStateOf(order.total.toString()) }
    var reason by remember { mutableStateOf("Customer Request") }
    var refundType by remember { mutableStateOf("full") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), color = SurfaceWhite, modifier = Modifier.padding(16.dp)) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Process Refund", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DangerRed)
                Text("Order Total: ${RevenueCalculator.formatPaise(order.total)}", fontSize = 12.sp, color = TextSecondary)

                OutlinedTextField(
                    value = refundAmount,
                    onValueChange = { refundAmount = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Refund Amount (₹)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Reason for Refund") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel", color = TextSecondary) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = { onRefund(refundAmount.toDoubleOrNull() ?: order.total, reason, refundType) },
                        colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                    ) {
                        Text("Authorize Refund", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun BillDetailsDialog(order: OrderRecord, onDismiss: () -> Unit) {
    val context = LocalContext.current

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), color = SurfaceWhite, modifier = Modifier.padding(16.dp)) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("Dining Bill Receipt", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                Text(
                    "${order.orderNumber} • Table ${order.tableNumber} • ${order.createdAt.take(16).replace("T", " ")}",
                    fontSize = 11.sp,
                    color = TextSecondary
                )

                Divider(color = DividerStroke)

                // Items list
                order.items.forEach { itm ->
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("${itm.quantity}x ${itm.name}", fontSize = 12.sp, color = TextPrimary)
                        Text(RevenueCalculator.formatPaise(itm.price * itm.quantity), fontSize = 12.sp, fontWeight = FontWeight.Medium, color = TextPrimary)
                    }
                }

                Divider(color = DividerStroke)

                SummaryLine("Subtotal", RevenueCalculator.formatPaise(order.subtotal))
                SummaryLine("Tax", RevenueCalculator.formatPaise(order.tax))
                if (order.discount > 0) {
                    SummaryLine("Discount", "- ${RevenueCalculator.formatPaise(order.discount)}")
                }
                SummaryLine("Grand Total", RevenueCalculator.formatPaise(order.total), isBold = true)

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    OutlinedButton(
                        onClick = {
                            val shareIntent = Intent().apply {
                                action = Intent.ACTION_SEND
                                putExtra(Intent.EXTRA_TEXT, "SpiralDine Bill ${order.orderNumber}: Total ${RevenueCalculator.formatPaise(order.total)}")
                                type = "text/plain"
                            }
                            context.startActivity(Intent.createChooser(shareIntent, "Share Receipt"))
                        },
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Share")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(onClick = onDismiss, colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange), shape = RoundedCornerShape(8.dp)) {
                        Text("Close")
                    }
                }
            }
        }
    }
}
