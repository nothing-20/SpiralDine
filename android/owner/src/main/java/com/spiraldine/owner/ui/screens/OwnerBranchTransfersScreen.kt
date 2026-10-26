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
import com.spiraldine.owner.data.model.BranchRecord
import com.spiraldine.owner.data.model.BranchTransferRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerBranchTransfersScreen(
    transfers: List<BranchTransferRecord>,
    branches: List<BranchRecord>,
    onBack: () -> Unit,
    onCreateTransfer: (BranchTransferRecord) -> Unit,
    onUpdateStatus: (String, String) -> Unit
) {
    var selectedFilter by remember { mutableStateOf("All") }
    val filterTabs = listOf("All", "Requested", "Approved", "Dispatched", "Received", "Rejected")

    var showCreateDialog by remember { mutableStateOf(false) }
    var itemName by remember { mutableStateOf("") }
    var quantityText by remember { mutableStateOf("10") }
    var unit by remember { mutableStateOf("kg") }
    var sourceBranchId by remember { mutableStateOf(branches.firstOrNull()?.id ?: "") }
    var destBranchId by remember { mutableStateOf(branches.getOrNull(1)?.id ?: branches.firstOrNull()?.id ?: "") }
    var notes by remember { mutableStateOf("") }

    val filteredTransfers = remember(transfers, selectedFilter) {
        if (selectedFilter == "All") transfers
        else transfers.filter { it.status.equals(selectedFilter, ignoreCase = true) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Branch Transfers", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = { showCreateDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Request Transfer", tint = TerracottaOrange)
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
            // Filter Row
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

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (filteredTransfers.isEmpty()) {
                    item {
                        OwnerCard(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No branch transfer records in this category", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                    }
                } else {
                    items(filteredTransfers, key = { it.id }) { transfer ->
                        TransferCard(
                            transfer = transfer,
                            onUpdateStatus = onUpdateStatus
                        )
                    }
                }
            }
        }

        if (showCreateDialog) {
            AlertDialog(
                onDismissRequest = { showCreateDialog = false },
                title = { Text("Request Branch Stock Transfer", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = itemName,
                            onValueChange = { itemName = it },
                            label = { Text("Item / Ingredient Name") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = quantityText,
                                onValueChange = { quantityText = it },
                                label = { Text("Quantity") },
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = unit,
                                onValueChange = { unit = it },
                                label = { Text("Unit (kg, L, packs)") },
                                modifier = Modifier.weight(1f)
                            )
                        }

                        Text("Source Branch:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                        branches.forEach { b ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                RadioButton(
                                    selected = sourceBranchId == b.id,
                                    onClick = { sourceBranchId = b.id }
                                )
                                Text(b.name, fontSize = 13.sp)
                            }
                        }

                        Text("Destination Branch:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                        branches.forEach { b ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                RadioButton(
                                    selected = destBranchId == b.id,
                                    onClick = { destBranchId = b.id }
                                )
                                Text(b.name, fontSize = 13.sp)
                            }
                        }

                        OutlinedTextField(
                            value = notes,
                            onValueChange = { notes = it },
                            label = { Text("Transfer Reason / Notes") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (itemName.isNotBlank()) {
                                val sName = branches.find { it.id == sourceBranchId }?.name ?: "Source Branch"
                                val dName = branches.find { it.id == destBranchId }?.name ?: "Dest Branch"
                                val newTransfer = BranchTransferRecord(
                                    sourceRestaurantId = sourceBranchId,
                                    sourceRestaurantName = sName,
                                    destRestaurantId = destBranchId,
                                    destRestaurantName = dName,
                                    itemName = itemName.trim(),
                                    quantity = quantityText.toDoubleOrNull() ?: 1.0,
                                    unit = unit.trim(),
                                    notes = notes.trim(),
                                    status = "Requested"
                                )
                                onCreateTransfer(newTransfer)
                                showCreateDialog = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Submit Request")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showCreateDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
private fun TransferCard(
    transfer: BranchTransferRecord,
    onUpdateStatus: (String, String) -> Unit
) {
    OwnerCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(transfer.itemName, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    Text("${transfer.quantity} ${transfer.unit}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TerracottaOrange)
                }

                val (badgeBg, badgeColor) = when (transfer.status.lowercase()) {
                    "requested" -> Pair(WarningAmberLight, WarningAmber)
                    "approved" -> Pair(InfoBlueLight, InfoBlue)
                    "dispatched" -> Pair(Color(0xFFEDE9FE), Color(0xFF7C3AED))
                    "received", "completed" -> Pair(SuccessGreenLight, SuccessGreen)
                    "rejected" -> Pair(ErrorRedLight, ErrorRed)
                    else -> Pair(BackgroundLight, TextSecondary)
                }

                Surface(
                    color = badgeBg,
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        transfer.status.uppercase(),
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
                    Text("From Source", fontSize = 10.sp, color = TextSecondary)
                    Text(transfer.sourceRestaurantName, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                }
                Icon(Icons.Default.ArrowForward, contentDescription = null, tint = TextMuted, modifier = Modifier.size(16.dp))
                Column(horizontalAlignment = Alignment.End) {
                    Text("To Destination", fontSize = 10.sp, color = TextSecondary)
                    Text(transfer.destRestaurantName, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                }
            }

            if (transfer.notes.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text("Note: ${transfer.notes}", fontSize = 11.sp, color = TextSecondary)
            }

            // Workflow status actions
            Spacer(modifier = Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                when (transfer.status.lowercase()) {
                    "requested" -> {
                        TextButton(onClick = { onUpdateStatus(transfer.id, "Rejected") }) {
                            Text("Reject", color = ErrorRed, fontSize = 12.sp)
                        }
                        Spacer(modifier = Modifier.width(6.dp))
                        Button(
                            onClick = { onUpdateStatus(transfer.id, "Approved") },
                            colors = ButtonDefaults.buttonColors(containerColor = InfoBlue),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Approve", fontSize = 12.sp)
                        }
                    }
                    "approved" -> {
                        Button(
                            onClick = { onUpdateStatus(transfer.id, "Dispatched") },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF7C3AED)),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Dispatch Stock", fontSize = 12.sp)
                        }
                    }
                    "dispatched" -> {
                        Button(
                            onClick = { onUpdateStatus(transfer.id, "Received") },
                            colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Confirm Receipt", fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}
