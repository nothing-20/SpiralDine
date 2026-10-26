package com.spiraldine.owner.ui.screens

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.AlertRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerAlertsScreen(
    alerts: List<AlertRecord>,
    onBack: () -> Unit,
    onMarkRead: (String) -> Unit,
    onMarkResolved: (String) -> Unit,
    onAssignAlert: (String, String) -> Unit
) {
    var selectedFilter by remember { mutableStateOf("All") }
    val filterTabs = listOf("All", "Unread", "Critical", "Operations", "Inventory")

    var assignDialogAlert by remember { mutableStateOf<AlertRecord?>(null) }
    var staffNameInput by remember { mutableStateOf("") }

    val unreadCount = alerts.count { !it.read }
    val criticalCount = alerts.count { it.severity.equals("critical", ignoreCase = true) }

    val filteredAlerts = remember(alerts, selectedFilter) {
        when (selectedFilter) {
            "Unread" -> alerts.filter { !it.read }
            "Critical" -> alerts.filter { it.severity.equals("critical", ignoreCase = true) }
            "Operations" -> alerts.filter { it.category.equals("Operations", ignoreCase = true) }
            "Inventory" -> alerts.filter { it.category.equals("Inventory", ignoreCase = true) }
            else -> alerts
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Alerts & Notifications", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
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
                AlertStat(title = "Total Alerts", value = "${alerts.size}", modifier = Modifier.weight(1f))
                AlertStat(title = "Unread", value = "$unreadCount", color = TerracottaOrange, modifier = Modifier.weight(1f))
                AlertStat(title = "Critical", value = "$criticalCount", color = ErrorRed, modifier = Modifier.weight(1f))
            }

            // Filter Tabs
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceWhite)
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filterTabs) { tab ->
                    val isSelected = selectedFilter == tab
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedFilter = tab },
                        label = { Text(tab, fontSize = 12.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = TerracottaOrangeLight,
                            selectedLabelColor = TerracottaOrange
                        )
                    )
                }
            }

            // Alerts list
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (filteredAlerts.isEmpty()) {
                    item {
                        OwnerCard(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No alerts found in this view", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                    }
                } else {
                    items(filteredAlerts, key = { it.id }) { alert ->
                        AlertItemCard(
                            alert = alert,
                            onMarkRead = { onMarkRead(alert.id) },
                            onMarkResolved = { onMarkResolved(alert.id) },
                            onAssign = {
                                assignDialogAlert = alert
                                staffNameInput = alert.assignedToName
                            }
                        )
                    }
                }
            }
        }

        if (assignDialogAlert != null) {
            val a = assignDialogAlert!!
            AlertDialog(
                onDismissRequest = { assignDialogAlert = null },
                title = { Text("Assign Alert Action", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(a.title, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        Text(a.message, fontSize = 11.sp, color = TextSecondary)
                        OutlinedTextField(
                            value = staffNameInput,
                            onValueChange = { staffNameInput = it },
                            label = { Text("Staff / Manager Name") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (staffNameInput.isNotBlank()) {
                                onAssignAlert(a.id, staffNameInput.trim())
                                assignDialogAlert = null
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Assign Staff")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { assignDialogAlert = null }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
private fun AlertStat(title: String, value: String, color: Color = TextPrimary, modifier: Modifier = Modifier) {
    OwnerCard(modifier = modifier) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = color)
        }
    }
}

@Composable
private fun AlertItemCard(
    alert: AlertRecord,
    onMarkRead: () -> Unit,
    onMarkResolved: () -> Unit,
    onAssign: () -> Unit
) {
    val (sevColor, sevBg) = when (alert.severity.lowercase()) {
        "critical" -> Pair(ErrorRed, ErrorRedLight)
        "warning" -> Pair(WarningAmber, WarningAmberLight)
        else -> Pair(InfoBlue, InfoBlueLight)
    }

    OwnerCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = sevBg, shape = RoundedCornerShape(8.dp)) {
                        Text(
                            alert.severity.uppercase(),
                            color = sevColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(alert.category, fontSize = 11.sp, color = TextSecondary)
                }

                if (!alert.read) {
                    Surface(color = TerracottaOrangeLight, shape = RoundedCornerShape(6.dp)) {
                        Text(
                            "NEW",
                            color = TerracottaOrange,
                            fontWeight = FontWeight.Bold,
                            fontSize = 9.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(alert.title, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
            Spacer(modifier = Modifier.height(4.dp))
            Text(alert.message, fontSize = 12.sp, color = TextSecondary)

            if (alert.assignedToName.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text("Assigned to: ${alert.assignedToName}", fontSize = 11.sp, color = InfoBlue, fontWeight = FontWeight.Medium)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Divider(color = BorderLight)
            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(alert.createdAt.ifBlank { "Recently" }, fontSize = 10.sp, color = TextMuted)

                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (!alert.read) {
                        TextButton(onClick = onMarkRead) {
                            Text("Mark Read", fontSize = 11.sp, color = TextSecondary)
                        }
                    }
                    if (!alert.resolved) {
                        TextButton(onClick = onAssign) {
                            Text("Assign", fontSize = 11.sp, color = InfoBlue)
                        }
                        TextButton(onClick = onMarkResolved) {
                            Text("Resolve", fontSize = 11.sp, color = SuccessGreen, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Text("Resolved", fontSize = 11.sp, color = SuccessGreen, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
