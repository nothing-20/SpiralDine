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
import com.spiraldine.owner.data.model.FeedbackRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerFeedbackScreen(
    feedbacks: List<FeedbackRecord>,
    onBack: () -> Unit,
    onUpdateStatus: (String, String, String, String) -> Unit
) {
    var selectedFilter by remember { mutableStateOf("All") }
    val filterTabs = listOf("All", "Complaints", "General", "Resolved")

    var selectedFeedbackForAction by remember { mutableStateOf<FeedbackRecord?>(null) }
    var actionStatus by remember { mutableStateOf("In Progress") }
    var actionAssignee by remember { mutableStateOf("") }
    var actionNotes by remember { mutableStateOf("") }

    val totalCount = feedbacks.size
    val complaintsCount = feedbacks.count { it.isComplaint || it.rating.equals("Poor", ignoreCase = true) }
    val resolvedCount = feedbacks.count { it.status.equals("Resolved", ignoreCase = true) }

    val filteredList = remember(feedbacks, selectedFilter) {
        when (selectedFilter) {
            "Complaints" -> feedbacks.filter { it.isComplaint || it.rating.equals("Poor", ignoreCase = true) }
            "General" -> feedbacks.filter { !it.isComplaint && !it.rating.equals("Poor", ignoreCase = true) }
            "Resolved" -> feedbacks.filter { it.status.equals("Resolved", ignoreCase = true) }
            else -> feedbacks
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Customer Feedback & Complaints", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
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
                FeedbackStat(title = "Total Feedbacks", value = "$totalCount", modifier = Modifier.weight(1f))
                FeedbackStat(title = "Complaints", value = "$complaintsCount", color = ErrorRed, modifier = Modifier.weight(1f))
                FeedbackStat(title = "Resolved", value = "$resolvedCount", color = SuccessGreen, modifier = Modifier.weight(1f))
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

            // Feedbacks list
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (filteredList.isEmpty()) {
                    item {
                        OwnerCard(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No feedback records in this category", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                    }
                } else {
                    items(filteredList, key = { it.id }) { item ->
                        FeedbackItemCard(
                            feedback = item,
                            onActionClick = {
                                selectedFeedbackForAction = item
                                actionStatus = if (item.status == "New") "In Progress" else item.status
                                actionAssignee = item.assignedToName
                                actionNotes = item.internalNotes
                            }
                        )
                    }
                }
            }
        }

        if (selectedFeedbackForAction != null) {
            val fb = selectedFeedbackForAction!!
            AlertDialog(
                onDismissRequest = { selectedFeedbackForAction = null },
                title = { Text("Update Complaint / Feedback Status", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Diner: ${fb.customerName}", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("Rating: ${fb.rating} • Category: ${fb.category}", fontSize = 11.sp, color = TextSecondary)
                        if (fb.notes.isNotBlank()) {
                            Text("\"${fb.notes}\"", fontSize = 12.sp, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic)
                        }

                        Divider(color = BorderLight)

                        Text("Status:", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        val statusOptions = listOf("Assigned", "In Progress", "Resolved")
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            statusOptions.forEach { opt ->
                                val isSel = actionStatus == opt
                                FilterChip(
                                    selected = isSel,
                                    onClick = { actionStatus = opt },
                                    label = { Text(opt, fontSize = 11.sp) }
                                )
                            }
                        }

                        OutlinedTextField(
                            value = actionAssignee,
                            onValueChange = { actionAssignee = it },
                            label = { Text("Assign Staff Member") },
                            modifier = Modifier.fillMaxWidth()
                        )

                        OutlinedTextField(
                            value = actionNotes,
                            onValueChange = { actionNotes = it },
                            label = { Text("Internal Resolution Notes") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            onUpdateStatus(fb.id, actionStatus, actionAssignee.trim(), actionNotes.trim())
                            selectedFeedbackForAction = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Save Update")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { selectedFeedbackForAction = null }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
private fun FeedbackStat(title: String, value: String, color: Color = TextPrimary, modifier: Modifier = Modifier) {
    OwnerCard(modifier = modifier) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(title, fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = color)
        }
    }
}

@Composable
private fun FeedbackItemCard(
    feedback: FeedbackRecord,
    onActionClick: () -> Unit
) {
    OwnerCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val (ratingColor, ratingBg) = when (feedback.rating.lowercase()) {
                        "good", "excellent" -> Pair(SuccessGreen, SuccessGreenLight)
                        "average" -> Pair(WarningAmber, WarningAmberLight)
                        else -> Pair(ErrorRed, ErrorRedLight)
                    }

                    Surface(color = ratingBg, shape = RoundedCornerShape(8.dp)) {
                        Text(
                            feedback.rating,
                            color = ratingColor,
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(feedback.category, fontSize = 12.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
                }

                val (badgeBg, badgeColor) = when (feedback.status.lowercase()) {
                    "resolved" -> Pair(SuccessGreenLight, SuccessGreen)
                    "in progress" -> Pair(InfoBlueLight, InfoBlue)
                    "assigned" -> Pair(Color(0xFFEDE9FE), Color(0xFF7C3AED))
                    else -> Pair(WarningAmberLight, WarningAmber)
                }

                Surface(color = badgeBg, shape = RoundedCornerShape(10.dp)) {
                    Text(
                        feedback.status.uppercase(),
                        color = badgeColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Text(feedback.customerName, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)

            if (feedback.tableNumber.isNotBlank()) {
                Text("Table #${feedback.tableNumber}", fontSize = 11.sp, color = TextSecondary)
            }

            if (feedback.notes.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    feedback.notes,
                    fontSize = 12.sp,
                    color = TextPrimary
                )
            }

            if (feedback.assignedToName.isNotBlank() || feedback.internalNotes.isNotBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Divider(color = BorderLight)
                Spacer(modifier = Modifier.height(6.dp))
                if (feedback.assignedToName.isNotBlank()) {
                    Text("Assigned to: ${feedback.assignedToName}", fontSize = 11.sp, color = InfoBlue, fontWeight = FontWeight.Medium)
                }
                if (feedback.internalNotes.isNotBlank()) {
                    Text("Notes: ${feedback.internalNotes}", fontSize = 11.sp, color = TextSecondary)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(feedback.submittedAt.ifBlank { "Recently" }, fontSize = 10.sp, color = TextMuted)
                TextButton(onClick = onActionClick) {
                    Text("Manage & Assign", fontSize = 11.sp, color = TerracottaOrange, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
