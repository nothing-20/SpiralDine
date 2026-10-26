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
import com.spiraldine.owner.data.model.*
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerAutomationScreen(
    rules: List<AutomationRuleRecord>,
    schedules: List<AutomationScheduleRecord>,
    logs: List<AutomationLogRecord>,
    dailyBriefs: List<DailyBriefRecord>,
    onBack: () -> Unit,
    onToggleRule: (String, Boolean) -> Unit,
    onTriggerRule: (String) -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Rules", "Briefs & Schedules", "Execution Logs")
    var isExecutingTrigger by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Automation Center", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextPrimary)
                        Text("Autonomous kitchen & dining operational triggers", fontSize = 11.sp, color = TextSecondary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        isExecutingTrigger = true
                        onTriggerRule("Manual Reconciliation & Alert Audit")
                        isExecutingTrigger = false
                    }) {
                        Icon(Icons.Outlined.PlayCircle, contentDescription = "Trigger Now", tint = TerracottaOrange)
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
            // Tab Selector
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
                    // Rules Tab
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        item {
                            // Banner
                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            "Active Autonomous Rules",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp,
                                            color = TextPrimary
                                        )
                                        Text(
                                            "Rules auto-execute on order and inventory events",
                                            fontSize = 11.sp,
                                            color = TextSecondary
                                        )
                                    }
                                    Badge(
                                        containerColor = TerracottaOrangeLight,
                                        contentColor = TerracottaOrange
                                    ) {
                                        Text("${rules.count { it.enabled }} Active", modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp), fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }

                        items(rules) { rule ->
                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(rule.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                            Text(rule.description, fontSize = 11.sp, color = TextSecondary)
                                        }
                                        Switch(
                                            checked = rule.enabled,
                                            onCheckedChange = { onToggleRule(rule.id, rule.enabled) },
                                            colors = SwitchDefaults.colors(
                                                checkedThumbColor = SurfaceWhite,
                                                checkedTrackColor = SuccessGreen
                                            )
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))
                                    Divider(color = BackgroundLight)
                                    Spacer(modifier = Modifier.height(10.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Surface(
                                                color = Color(0xFFEFF6FF),
                                                shape = RoundedCornerShape(6.dp)
                                            ) {
                                                Text(
                                                    text = rule.triggerEvent,
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color(0xFF2563EB),
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                            Surface(
                                                color = Color(0xFFFAF5FF),
                                                shape = RoundedCornerShape(6.dp)
                                            ) {
                                                Text(
                                                    text = rule.actionType,
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color(0xFF7C3AED),
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                        }

                                        Text(
                                            text = "Ran ${rule.executionCount} times • Last: ${rule.lastRun}",
                                            fontSize = 10.sp,
                                            color = TextSecondary
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                1 -> {
                    // Briefs & Schedules Tab
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // Daily Brief Section
                        item {
                            Text("DAILY EXECUTIVE BRIEF", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = TextSecondary)
                        }

                        val brief = dailyBriefs.firstOrNull()
                        item {
                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                            Box(
                                                modifier = Modifier
                                                    .size(36.dp)
                                                    .clip(RoundedCornerShape(10.dp))
                                                    .background(Color(0xFFEFF6FF)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(Icons.Outlined.Article, contentDescription = null, tint = Color(0xFF2563EB), modifier = Modifier.size(20.dp))
                                            }
                                            Column {
                                                Text("Daily Brief (${brief?.date ?: "Today"})", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                                                Text("Autonomous 10 PM Reconciliation", fontSize = 10.sp, color = TextSecondary)
                                            }
                                        }
                                        Badge(containerColor = SuccessGreenLight, contentColor = SuccessGreen) {
                                            Text("Ready", modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp), fontWeight = FontWeight.Bold)
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(12.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column {
                                            Text("Today's Revenue", fontSize = 10.sp, color = TextSecondary)
                                            Text("₹${String.format(java.util.Locale.US, "%,.2f", (brief?.revenueTodayPaise ?: 0L) / 100.0)}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                        }
                                        Column {
                                            Text("Total Orders", fontSize = 10.sp, color = TextSecondary)
                                            Text("${brief?.ordersCount ?: 0}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                        }
                                        Column {
                                            Text("Top Seller", fontSize = 10.sp, color = TextSecondary)
                                            Text(brief?.topDish ?: "Biryani", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextPrimary)
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))
                                    Surface(
                                        color = BackgroundLight,
                                        shape = RoundedCornerShape(8.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            text = brief?.summaryMarkdown ?: "Healthy operations with normal table turnovers.",
                                            fontSize = 11.sp,
                                            color = TextSecondary,
                                            modifier = Modifier.padding(10.dp)
                                        )
                                    }
                                }
                            }
                        }

                        // Schedules Section
                        item {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("SCHEDULED CRON JOBS", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = TextSecondary)
                        }

                        items(schedules) { schedule ->
                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(schedule.name, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.padding(top = 4.dp)
                                        ) {
                                            Surface(
                                                color = Color(0xFFFAF5FF),
                                                shape = RoundedCornerShape(4.dp)
                                            ) {
                                                Text(
                                                    text = schedule.cronExpression,
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color(0xFF7C3AED),
                                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                )
                                            }
                                            Text("Next: ${schedule.nextRunAt}", fontSize = 10.sp, color = TextSecondary)
                                        }
                                    }
                                    Icon(
                                        Icons.Outlined.CheckCircle,
                                        contentDescription = "Active",
                                        tint = SuccessGreen,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                            }
                        }
                    }
                }

                2 -> {
                    // Activity Logs Tab
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(logs) { log ->
                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(36.dp)
                                            .clip(CircleShape)
                                            .background(if (log.status == "SUCCESS") SuccessGreenLight else ErrorRedLight),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            if (log.status == "SUCCESS") Icons.Default.Check else Icons.Default.Warning,
                                            contentDescription = null,
                                            tint = if (log.status == "SUCCESS") SuccessGreen else ErrorRed,
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }

                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(log.ruleName, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextPrimary)
                                            Text(log.timestamp, fontSize = 10.sp, color = TextSecondary)
                                        }
                                        Text(log.message, fontSize = 11.sp, color = TextSecondary, maxLines = 2)
                                        Text(
                                            "${log.triggerType} • ${log.executionTimeMs}ms",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF6B7280),
                                            modifier = Modifier.padding(top = 2.dp)
                                        )
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
