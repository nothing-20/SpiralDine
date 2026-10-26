package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
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
import com.spiraldine.owner.ui.components.OwnerStatusBadge

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerOrdersScreen(
    orders: List<OrderRecord>,
    onOrderClick: (String) -> Unit,
    onAdvanceStatus: (String, String) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedFilter by remember { mutableStateOf("ALL") }

    val filterOptions = listOf("ALL", "NEW", "PREPARING", "READY", "COMPLETED", "CANCELLED")

    val filteredOrders = remember(orders, searchQuery, selectedFilter) {
        orders.filter { order ->
            val status = order.status.uppercase()
            val matchesFilter = when (selectedFilter) {
                "NEW" -> status == "PENDING" || status == "NEW"
                "PREPARING" -> status == "PREPARING"
                "READY" -> status == "READY"
                "COMPLETED" -> status == "COMPLETED" || status == "SERVED"
                "CANCELLED" -> status == "CANCELLED" || status == "REJECTED"
                else -> true
            }

            val q = searchQuery.trim().lowercase()
            val matchesSearch = q.isEmpty() ||
                order.orderNumber.lowercase().contains(q) ||
                order.tableNumber.lowercase().contains(q) ||
                order.customerName.lowercase().contains(q)

            matchesFilter && matchesSearch
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Orders", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextPrimary) },
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
            // Search Input
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search order #, table #, or guest...", fontSize = 12.sp, color = TextMuted) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = TerracottaOrange,
                    unfocusedContainerColor = SurfaceWhite,
                    focusedContainerColor = SurfaceWhite
                )
            )

            // Status Filter Tabs
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filterOptions) { filter ->
                    val isSelected = selectedFilter == filter
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedFilter = filter },
                        label = { Text(filter, fontSize = 11.sp, fontWeight = FontWeight.Bold) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = TerracottaOrange,
                            selectedLabelColor = SurfaceWhite,
                            containerColor = SurfaceWhite,
                            labelColor = TextSecondary
                        ),
                        shape = RoundedCornerShape(16.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Orders list
            if (filteredOrders.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Outlined.ReceiptLong, contentDescription = null, tint = TextMuted, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(12.dp))
                        Text("No orders in this category", fontSize = 14.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filteredOrders) { order ->
                        OrderItemCard(
                            order = order,
                            onClick = { onOrderClick(order.id) },
                            onAdvanceStatus = { nextStatus -> onAdvanceStatus(order.id, nextStatus) }
                        )
                    }
                    item {
                        Spacer(modifier = Modifier.height(16.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun OrderItemCard(
    order: OrderRecord,
    onClick: () -> Unit,
    onAdvanceStatus: (String) -> Unit
) {
    val tableText = if (order.tableNumber.isNotEmpty()) "Table ${order.tableNumber}" else order.diningOption
    val statusUpper = order.status.uppercase()

    OwnerCard(modifier = Modifier.fillMaxWidth(), onClick = onClick) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(order.orderNumber, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("• $tableText", fontSize = 12.sp, color = TextSecondary)
                }
                OwnerStatusBadge(status = order.status)
            }

            if (order.items.isNotEmpty()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = order.items.joinToString(", ") { "${it.quantity}x ${it.name}" },
                    fontSize = 11.sp,
                    color = TextSecondary,
                    maxLines = 1
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = BackgroundLight)
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(RevenueCalculator.formatPaise(order.total), fontSize = 15.sp, fontWeight = FontWeight.Black, color = TextPrimary)

                when (statusUpper) {
                    "PENDING", "NEW" -> {
                        Button(
                            onClick = { onAdvanceStatus("PREPARING") },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Default.OutdoorGrill, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Start Cooking", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    "PREPARING" -> {
                        Button(
                            onClick = { onAdvanceStatus("READY") },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = InfoBlue),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Mark Ready", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    "READY" -> {
                        Button(
                            onClick = { onAdvanceStatus("COMPLETED") },
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Complete", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    else -> {
                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted)
                    }
                }
            }
        }
    }
}
