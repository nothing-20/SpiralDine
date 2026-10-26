package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import com.spiraldine.owner.data.model.CustomerRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerCustomersScreen(
    customers: List<CustomerRecord>,
    onBack: () -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedSegment by remember { mutableStateOf("All") }
    val segments = listOf("All", "New", "Returning", "Frequent", "Inactive")

    val totalDiners = customers.size
    val frequentCount = customers.count { it.segment.equals("Frequent", ignoreCase = true) || it.totalVisits >= 3 }
    val totalRevenue = customers.sumOf { it.totalSpend }
    val avgSpend = if (totalDiners > 0) totalRevenue / totalDiners else 0.0

    val filteredCustomers = remember(customers, searchQuery, selectedSegment) {
        customers.filter { cust ->
            val matchesSearch = searchQuery.isBlank() ||
                cust.name.contains(searchQuery, ignoreCase = true) ||
                cust.phone.contains(searchQuery, ignoreCase = true) ||
                cust.email.contains(searchQuery, ignoreCase = true)

            val matchesSegment = selectedSegment == "All" ||
                cust.segment.equals(selectedSegment, ignoreCase = true)

            matchesSearch && matchesSegment
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Customer CRM & Intelligence", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Stats Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatCard(title = "Total Diners", value = "$totalDiners", modifier = Modifier.weight(1f))
                StatCard(title = "Frequent / VIP", value = "$frequentCount", modifier = Modifier.weight(1f))
                StatCard(title = "Avg Spend", value = "₹${String.format(Locale.US, "%.0f", avgSpend)}", modifier = Modifier.weight(1f))
            }

            // Search bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search by diner name, phone or email...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = SurfaceWhite,
                    unfocusedContainerColor = SurfaceWhite,
                    unfocusedBorderColor = BorderLight
                )
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Segment chips
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(segments) { seg ->
                    val isSelected = selectedSegment == seg
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedSegment = seg },
                        label = { Text(seg, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = TerracottaOrangeLight,
                            selectedLabelColor = TerracottaOrange
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Customer List
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (filteredCustomers.isEmpty()) {
                    item {
                        OwnerCard(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No customer records match your filter", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                    }
                } else {
                    items(filteredCustomers, key = { it.id }) { customer ->
                        CustomerCard(customer = customer)
                    }
                }
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun StatCard(title: String, value: String, modifier: Modifier = Modifier) {
    OwnerCard(modifier = modifier) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
        }
    }
}

@Composable
private fun CustomerCard(customer: CustomerRecord) {
    OwnerCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
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
                            .background(TerracottaOrangeLight),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            customer.name.take(1).uppercase(),
                            color = TerracottaOrange,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(customer.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        if (customer.phone.isNotBlank()) {
                            Text(customer.phone, fontSize = 11.sp, color = TextSecondary)
                        }
                    }
                }

                val (badgeBg, badgeColor) = when (customer.segment.lowercase()) {
                    "frequent", "vip" -> Pair(Color(0xFFEDE9FE), Color(0xFF7C3AED))
                    "returning" -> Pair(InfoBlueLight, InfoBlue)
                    "new" -> Pair(SuccessGreenLight, SuccessGreen)
                    else -> Pair(BackgroundLight, TextSecondary)
                }

                Surface(
                    color = badgeBg,
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        customer.segment.uppercase(),
                        color = badgeColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            Divider(color = BorderLight)
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Total Visits", fontSize = 10.sp, color = TextSecondary)
                    Text("${customer.totalVisits} visits", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Total Spend", fontSize = 10.sp, color = TextSecondary)
                    Text("₹${String.format(Locale.US, "%.2f", customer.totalSpend)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TerracottaOrange)
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Loyalty Points", fontSize = 10.sp, color = TextSecondary)
                    Text("${customer.loyaltyPoints} pts", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = SuccessGreen)
                }
            }

            if (customer.lastVisit.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text("Last Visit: ${customer.lastVisit}", fontSize = 10.sp, color = TextMuted)
            }
        }
    }
}
