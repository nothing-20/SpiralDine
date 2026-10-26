package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.BranchRecord
import com.spiraldine.owner.data.model.RestaurantOverview
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard
import com.spiraldine.owner.ui.components.OwnerTopBar

@Composable
fun OwnerMoreScreen(
    overview: RestaurantOverview,
    branches: List<BranchRecord> = emptyList(),
    onSelectBranch: ((String) -> Unit)? = null,
    onToggleOpenStatus: (Boolean) -> Unit,
    onNavigate: (String) -> Unit,
    onLogout: () -> Unit
) {
    var showLogoutDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            OwnerTopBar(
                restaurantName = overview.name,
                branchName = overview.branch,
                isOpen = overview.isOpen,
                branches = branches,
                onSelectBranch = onSelectBranch,
                onNotificationsClick = { onNavigate("alerts") }
            )
        },
        containerColor = BackgroundLight
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Store Open/Close Switch Card
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Accepting Orders: ${if (overview.isOpen) "OPEN" else "CLOSED"}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                color = TextPrimary
                            )
                            Text(
                                text = if (overview.isOpen) "Diners can order dishes" else "Ordering temporarily paused",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }
                        Switch(
                            checked = overview.isOpen,
                            onCheckedChange = { onToggleOpenStatus(overview.isOpen) },
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = SurfaceWhite,
                                checkedTrackColor = SuccessGreen
                            )
                        )
                    }
                }
            }

            // Group A: Business Management
            item {
                SectionGroup(title = "GROUP A: BUSINESS MANAGEMENT") {
                    MenuItemRow("Restaurants & Branches", "Manage multi-unit locations & settings", Icons.Outlined.Storefront) { onNavigate("restaurants") }
                    MenuItemRow("Branch Inventory Transfers", "Inter-branch stock requisitions & receipts", Icons.Outlined.CompareArrows) { onNavigate("branch_transfers") }
                }
            }

            // Group B: Customers & Engagement
            item {
                SectionGroup(title = "GROUP B: CUSTOMERS & ENGAGEMENT") {
                    MenuItemRow("Customer CRM & Intelligence", "Diner profiles, retention & spending habits", Icons.Outlined.People) { onNavigate("customers") }
                    MenuItemRow("Customer Feedback & Complaints", "Service & food ratings with resolution workflow", Icons.Outlined.Feedback) { onNavigate("feedback") }
                    MenuItemRow("Customer Reviews", "Verified star ratings & diner recommendations", Icons.Outlined.StarRate) { onNavigate("reviews") }
                }
            }

            // Group C: Growth & Marketing
            item {
                SectionGroup(title = "GROUP C: GROWTH & MARKETING") {
                    MenuItemRow("Offers & Promotions", "Coupon codes, percentage discounts & deals", Icons.Outlined.LocalOffer) { onNavigate("promotions") }
                    MenuItemRow("Marketing & Campaigns", "Targeted customer engagement & audience reach", Icons.Outlined.Campaign) { onNavigate("marketing") }
                }
            }

            // Group D: Operations & Insights
            item {
                SectionGroup(title = "GROUP D: OPERATIONS & INSIGHTS") {
                    MenuItemRow("Alerts & Notifications", "Operational events, inventory & billing alerts", Icons.Outlined.NotificationsActive) { onNavigate("alerts") }
                    MenuItemRow("Reports & Business Exports", "12 canonical financial, tax & order reports", Icons.Outlined.BarChart) { onNavigate("reports") }
                    MenuItemRow("Audit Logs", "Immutable security trail & actor history", Icons.Outlined.Security) { onNavigate("audit_logs") }
                }
            }

            // Group E: AI & Autonomous Operations
            item {
                SectionGroup(title = "GROUP E: AI & AUTONOMOUS OPERATIONS") {
                    MenuItemRow("AI Intelligence & Advisor", "Real-time AI recommendations & kitchen advice", Icons.Outlined.Psychology) { onNavigate("intelligence") }
                    MenuItemRow("Automation Center", "Autonomous trigger rules, cron schedules & daily briefs", Icons.Outlined.Memory) { onNavigate("automation") }
                    MenuItemRow("Strategy & Business Goals", "Revenue targets, waste reduction & playbooks", Icons.Outlined.TrackChanges) { onNavigate("strategy") }
                }
            }

            // General Dining Operations
            item {
                SectionGroup(title = "DINING & SERVICE OPERATIONS") {
                    MenuItemRow("Tables & QR Codes", "Floor layout, seating status & live table QR", Icons.Outlined.QrCode) { onNavigate("tables") }
                    MenuItemRow("Table Reservations", "Upcoming bookings & diner waitlist", Icons.Outlined.EventAvailable) { onNavigate("reservations") }
                    MenuItemRow("Staff Management", "Team members, roles & permissions", Icons.Outlined.Badge) { onNavigate("staff") }
                    MenuItemRow("Settings & Legal Policies", "Business info, taxes, privacy & terms", Icons.Outlined.Settings) { onNavigate("settings") }
                }
            }

            // Logout
            item {
                OutlinedButton(
                    onClick = { showLogoutDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed)
                ) {
                    Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Sign Out of Workspace", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }

            item {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    Text("SpiralDine Restaurant OS • Android Native v1.0", fontSize = 10.sp, color = TextMuted)
                }
            }
        }

        if (showLogoutDialog) {
            AlertDialog(
                onDismissRequest = { showLogoutDialog = false },
                title = { Text("Sign Out?") },
                text = { Text("Are you sure you want to log out of your restaurant session?") },
                confirmButton = {
                    Button(
                        onClick = {
                            showLogoutDialog = false
                            onLogout()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                    ) {
                        Text("Sign Out")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showLogoutDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}

@Composable
private fun SectionGroup(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column {
        Text(
            text = title,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = TextSecondary,
            letterSpacing = 0.5.sp,
            modifier = Modifier.padding(bottom = 6.dp)
        )
        OwnerCard(modifier = Modifier.fillMaxWidth(), content = content)
    }
}

@Composable
private fun MenuItemRow(
    label: String,
    subtitle: String? = null,
    icon: ImageVector,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            Icon(icon, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(22.dp))
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                if (subtitle != null) {
                    Text(subtitle, fontSize = 10.sp, color = TextSecondary)
                }
            }
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted)
    }
}
