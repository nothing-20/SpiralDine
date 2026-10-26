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
import com.spiraldine.owner.data.model.AuditLogRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerAuditLogsScreen(
    logs: List<AuditLogRecord>,
    onBack: () -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedModule by remember { mutableStateOf("All") }
    val moduleFilters = listOf("All", "Auth", "Menu", "Orders", "Tables", "Staff", "Inventory", "Billing", "Settings")

    val totalLogs = logs.size
    val successCount = logs.count { it.status.equals("success", ignoreCase = true) }
    val warningCount = logs.count { it.status.equals("warning", ignoreCase = true) || it.status.equals("failure", ignoreCase = true) }

    val filteredLogs = remember(logs, searchQuery, selectedModule) {
        logs.filter { log ->
            val matchesSearch = searchQuery.isBlank() ||
                log.action.contains(searchQuery, ignoreCase = true) ||
                log.actorName.contains(searchQuery, ignoreCase = true) ||
                log.description.contains(searchQuery, ignoreCase = true)

            val matchesModule = selectedModule == "All" ||
                log.module.contains(selectedModule, ignoreCase = true)

            matchesSearch && matchesModule
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Audit Logs & Security Trail", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
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
                AuditStat(title = "Total Logs", value = "$totalLogs", modifier = Modifier.weight(1f))
                AuditStat(title = "Success Events", value = "$successCount", color = SuccessGreen, modifier = Modifier.weight(1f))
                AuditStat(title = "Alerts / Warnings", value = "$warningCount", color = if (warningCount > 0) WarningAmber else TextSecondary, modifier = Modifier.weight(1f))
            }

            // Search bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search by action, module, or user...") },
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

            Spacer(modifier = Modifier.height(8.dp))

            // Module Filters
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(moduleFilters) { mod ->
                    val isSelected = selectedModule == mod
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedModule = mod },
                        label = { Text(mod, fontSize = 11.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = TerracottaOrangeLight,
                            selectedLabelColor = TerracottaOrange
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Log entries
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (filteredLogs.isEmpty()) {
                    item {
                        OwnerCard(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No audit records found", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                    }
                } else {
                    items(filteredLogs, key = { it.id }) { log ->
                        AuditLogCard(log = log)
                    }
                }
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun AuditStat(title: String, value: String, color: Color = TextPrimary, modifier: Modifier = Modifier) {
    OwnerCard(modifier = modifier) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = color)
        }
    }
}

@Composable
private fun AuditLogCard(log: AuditLogRecord) {
    OwnerCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Surface(color = TerracottaOrangeLight, shape = RoundedCornerShape(8.dp)) {
                        Text(
                            log.module.uppercase(),
                            color = TerracottaOrange,
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(log.action, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                }

                val (statBg, statColor) = when (log.status.lowercase()) {
                    "success" -> Pair(SuccessGreenLight, SuccessGreen)
                    "warning" -> Pair(WarningAmberLight, WarningAmber)
                    else -> Pair(ErrorRedLight, ErrorRed)
                }

                Surface(color = statBg, shape = RoundedCornerShape(8.dp)) {
                    Text(
                        log.status.uppercase(),
                        color = statColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            if (log.description.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(log.description, fontSize = 12.sp, color = TextSecondary)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Divider(color = BorderLight)
            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Actor: ${log.actorName} (${log.actorRole})", fontSize = 11.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                Text(log.timestamp.ifBlank { "Recently" }, fontSize = 10.sp, color = TextMuted)
            }
        }
    }
}
