package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.BusinessGoalRecord
import com.spiraldine.owner.data.model.StrategyPlanRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerStrategyScreen(
    goals: List<BusinessGoalRecord>,
    plans: List<StrategyPlanRecord>,
    onBack: () -> Unit,
    onSaveGoal: (BusinessGoalRecord) -> Unit,
    onUpdateProgress: (String, Double) -> Unit,
    onDeleteGoal: (String) -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Business Goals", "Strategy Playbooks")
    var showAddGoalDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Strategy & Goals", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextPrimary)
                        Text("Revenue targets, waste SLAs & playbooks", fontSize = 11.sp, color = TextSecondary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = { showAddGoalDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Goal", tint = TerracottaOrange)
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
            // Tab Header
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = SurfaceWhite,
                contentColor = TerracottaOrange
            ) {
                tabs.forEachIndexed { index, title ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index },
                        text = {
                            Text(
                                text = title,
                                fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 12.sp
                            )
                        }
                    )
                }
            }

            when (selectedTab) {
                0 -> {
                    // Goals Tab
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // Overview Card
                        item {
                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column {
                                        Text("Active Targets", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                        Text("${goals.count { it.status == "on_track" || it.status == "completed" }} of ${goals.size} targets on track", fontSize = 11.sp, color = TextSecondary)
                                    }
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(TerracottaOrangeLight),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Outlined.TrackChanges, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(24.dp))
                                    }
                                }
                            }
                        }

                        items(goals) { goal ->
                            val progressFraction = if (goal.targetValue > 0) {
                                (goal.currentValue / goal.targetValue).toFloat().coerceIn(0f, 1f)
                            } else 0f
                            val isCompleted = goal.currentValue >= goal.targetValue

                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(goal.title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                            Text("Deadline: ${goal.deadline}", fontSize = 11.sp, color = TextSecondary)
                                        }

                                        Badge(
                                            containerColor = when {
                                                isCompleted -> SuccessGreenLight
                                                goal.status == "at_risk" -> ErrorRedLight
                                                else -> InfoBlueLight
                                            },
                                            contentColor = when {
                                                isCompleted -> SuccessGreen
                                                goal.status == "at_risk" -> ErrorRed
                                                else -> InfoBlue
                                            }
                                        ) {
                                            Text(
                                                text = if (isCompleted) "Completed" else if (goal.status == "at_risk") "At Risk" else "On Track",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 10.sp,
                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))

                                    // Metric display
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.Bottom
                                    ) {
                                        Text(
                                            text = "${goal.unit}${String.format(java.util.Locale.US, "%,.1f", goal.currentValue)}",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 18.sp,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = "Target: ${goal.unit}${String.format(java.util.Locale.US, "%,.1f", goal.targetValue)}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = TextSecondary
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(6.dp))

                                    LinearProgressIndicator(
                                        progress = progressFraction,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(8.dp)
                                            .clip(RoundedCornerShape(4.dp)),
                                        color = if (isCompleted) SuccessGreen else TerracottaOrange,
                                        trackColor = BackgroundLight
                                    )

                                    Spacer(modifier = Modifier.height(10.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.End,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        TextButton(
                                            onClick = { onUpdateProgress(goal.id, goal.currentValue + (goal.targetValue * 0.1)) },
                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                        ) {
                                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Log +10%", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                1 -> {
                    // Strategy Playbooks Tab
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        items(plans) { plan ->
                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(plan.title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                            Text("Playbook • ${plan.category}", fontSize = 11.sp, color = TextSecondary)
                                        }
                                        Surface(
                                            color = Color(0xFFF0FDF4),
                                            shape = RoundedCornerShape(6.dp)
                                        ) {
                                            Text(
                                                text = plan.estimatedImpact,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF16A34A),
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 3.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))
                                    Divider(color = BackgroundLight)
                                    Spacer(modifier = Modifier.height(10.dp))

                                    Text("Execution Checklist:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                                    Spacer(modifier = Modifier.height(6.dp))

                                    plan.actionItems.forEach { action ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 3.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Icon(
                                                Icons.Outlined.CheckCircle,
                                                contentDescription = null,
                                                tint = SuccessGreen,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Text(action, fontSize = 12.sp, color = TextPrimary)
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

    if (showAddGoalDialog) {
        var title by remember { mutableStateOf("") }
        var targetStr by remember { mutableStateOf("") }
        var unit by remember { mutableStateOf("₹") }
        var deadline by remember { mutableStateOf("End of Month") }

        AlertDialog(
            onDismissRequest = { showAddGoalDialog = false },
            title = { Text("Add Business Goal", fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it },
                        label = { Text("Goal Title") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = targetStr,
                        onValueChange = { targetStr = it },
                        label = { Text("Target Value") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = unit,
                        onValueChange = { unit = it },
                        label = { Text("Unit (e.g. ₹, %, mins)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = deadline,
                        onValueChange = { deadline = it },
                        label = { Text("Deadline") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val target = targetStr.toDoubleOrNull() ?: 1000.0
                        onSaveGoal(
                            BusinessGoalRecord(
                                title = title.ifBlank { "New Business Target" },
                                type = "revenue",
                                targetValue = target,
                                currentValue = 0.0,
                                unit = unit,
                                deadline = deadline,
                                status = "on_track"
                            )
                        )
                        showAddGoalDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Save Goal", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddGoalDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}
