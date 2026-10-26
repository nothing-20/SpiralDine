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
import com.spiraldine.owner.data.model.CampaignRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerMarketingScreen(
    campaigns: List<CampaignRecord>,
    onBack: () -> Unit,
    onSaveCampaign: (CampaignRecord) -> Unit,
    onToggleStatus: (String, Boolean) -> Unit,
    onDeleteCampaign: (String) -> Unit
) {
    var selectedFilter by remember { mutableStateOf("All") }
    val filterTabs = listOf("All", "Active", "Paused", "Completed")

    var showAddDialog by remember { mutableStateOf(false) }
    var nameInput by remember { mutableStateOf("") }
    var descInput by remember { mutableStateOf("") }
    var promoCodeInput by remember { mutableStateOf("") }
    var audienceInput by remember { mutableStateOf("All Diners") }
    var discountTypeInput by remember { mutableStateOf("percentage") }
    var discountValInput by remember { mutableStateOf("20") }
    var minSpendInput by remember { mutableStateOf("25") }

    val activeCount = campaigns.count { it.status.equals("Active", ignoreCase = true) }
    val totalRedemptions = campaigns.sumOf { it.redemptionsCount }

    val filteredCampaigns = remember(campaigns, selectedFilter) {
        if (selectedFilter == "All") campaigns
        else campaigns.filter { it.status.equals(selectedFilter, ignoreCase = true) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Marketing & Campaigns", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = { showAddDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Create Campaign", tint = TerracottaOrange)
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
                CampaignStat(title = "Total Campaigns", value = "${campaigns.size}", modifier = Modifier.weight(1f))
                CampaignStat(title = "Active Campaigns", value = "$activeCount", color = SuccessGreen, modifier = Modifier.weight(1f))
                CampaignStat(title = "Total Redemptions", value = "$totalRedemptions", color = TerracottaOrange, modifier = Modifier.weight(1f))
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

            // Campaigns list
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (filteredCampaigns.isEmpty()) {
                    item {
                        OwnerCard(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No campaigns in this category", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                    }
                } else {
                    items(filteredCampaigns, key = { it.id }) { campaign ->
                        CampaignCard(
                            campaign = campaign,
                            onToggle = { isAct -> onToggleStatus(campaign.id, isAct) },
                            onDelete = { onDeleteCampaign(campaign.id) }
                        )
                    }
                }
            }
        }

        if (showAddDialog) {
            val audienceList = listOf("All Diners", "New Customers", "Returning Customers", "Inactive Diners", "VIP Diners")
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Launch New Campaign", fontWeight = FontWeight.Bold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = nameInput,
                            onValueChange = { nameInput = it },
                            label = { Text("Campaign Name") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = descInput,
                            onValueChange = { descInput = it },
                            label = { Text("Description") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = promoCodeInput,
                            onValueChange = { promoCodeInput = it },
                            label = { Text("Promo Code (e.g. SUMMER20)") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        Text("Target Audience:", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(audienceList) { aud ->
                                val isSel = audienceInput == aud
                                FilterChip(
                                    selected = isSel,
                                    onClick = { audienceInput = aud },
                                    label = { Text(aud, fontSize = 10.sp) }
                                )
                            }
                        }

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = discountValInput,
                                onValueChange = { discountValInput = it },
                                label = { Text("Discount Value (%)") },
                                modifier = Modifier.weight(1f)
                            )
                            OutlinedTextField(
                                value = minSpendInput,
                                onValueChange = { minSpendInput = it },
                                label = { Text("Min Spend (₹)") },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            if (nameInput.isNotBlank()) {
                                val newCamp = CampaignRecord(
                                    name = nameInput.trim(),
                                    description = descInput.trim(),
                                    promoCode = promoCodeInput.trim().uppercase(),
                                    targetAudience = audienceInput,
                                    discountType = discountTypeInput,
                                    discountValue = discountValInput.toDoubleOrNull() ?: 10.0,
                                    minSpend = minSpendInput.toDoubleOrNull() ?: 20.0,
                                    status = "Active"
                                )
                                onSaveCampaign(newCamp)
                                showAddDialog = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Create Campaign")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
private fun CampaignStat(title: String, value: String, color: Color = TextPrimary, modifier: Modifier = Modifier) {
    OwnerCard(modifier = modifier) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = color)
        }
    }
}

@Composable
private fun CampaignCard(
    campaign: CampaignRecord,
    onToggle: (Boolean) -> Unit,
    onDelete: () -> Unit
) {
    val isActive = campaign.status.equals("Active", ignoreCase = true)

    OwnerCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(campaign.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                    if (campaign.promoCode.isNotBlank()) {
                        Text("Code: ${campaign.promoCode}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TerracottaOrange)
                    }
                }

                Switch(
                    checked = isActive,
                    onCheckedChange = { onToggle(it) },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = SurfaceWhite,
                        checkedTrackColor = SuccessGreen
                    )
                )
            }

            if (campaign.description.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(campaign.description, fontSize = 12.sp, color = TextSecondary)
            }

            Spacer(modifier = Modifier.height(8.dp))
            Divider(color = BorderLight)
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text("Target Audience", fontSize = 10.sp, color = TextSecondary)
                    Text(campaign.targetAudience, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Discount", fontSize = 10.sp, color = TextSecondary)
                    Text(
                        if (campaign.discountType == "percentage") "${campaign.discountValue.toInt()}% OFF" else "₹${campaign.discountValue.toInt()} FLAT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = TerracottaOrange
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text("Redemptions", fontSize = 10.sp, color = TextSecondary)
                    Text("${campaign.redemptionsCount} used", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = SuccessGreen)
                }
            }

            Spacer(modifier = Modifier.height(6.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                IconButton(onClick = onDelete) {
                    Icon(Icons.Default.DeleteOutline, contentDescription = "Delete", tint = ErrorRed, modifier = Modifier.size(18.dp))
                }
            }
        }
    }
}
