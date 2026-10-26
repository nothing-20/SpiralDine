package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

data class BusinessModule(
    val id: String,
    val title: String,
    val description: String,
    val icon: ImageVector,
    val badge: String,
    val bgTint: Color,
    val iconTint: Color
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerBusinessScreen(
    onNavigateToModule: (String) -> Unit
) {
    val modules = listOf(
        BusinessModule(
            id = "intelligence",
            title = "AI Intelligence & Advisor",
            description = "Real-time AI insights, revenue forecasts & culinary recommendations",
            icon = Icons.Outlined.Psychology,
            badge = "AI Core",
            bgTint = Color(0xFFEFF6FF),
            iconTint = Color(0xFF2563EB)
        ),
        BusinessModule(
            id = "automation",
            title = "Automation Center",
            description = "Autonomous cron triggers, rules & daily operational brief logs",
            icon = Icons.Outlined.Memory,
            badge = "Auto",
            bgTint = Color(0xFFFAF5FF),
            iconTint = Color(0xFF7C3AED)
        ),
        BusinessModule(
            id = "strategy",
            title = "Strategy & Business Goals",
            description = "Revenue targets, CSAT goals & strategic operational playbooks",
            icon = Icons.Outlined.TrackChanges,
            badge = "Goals",
            bgTint = Color(0xFFFFF4EE),
            iconTint = Color(0xFFFF7518)
        ),
        BusinessModule(
            id = "analytics",
            title = "Analytics & Revenue",
            description = "Sales trends, top-selling dishes, and ticket sizes",
            icon = Icons.Outlined.BarChart,
            badge = "Live",
            bgTint = TerracottaOrangeLight,
            iconTint = TerracottaOrange
        ),
        BusinessModule(
            id = "tables",
            title = "Tables & QR Codes",
            description = "Floor management and printable ordering QR codes",
            icon = Icons.Outlined.QrCode,
            badge = "Tables",
            bgTint = InfoBlueLight,
            iconTint = InfoBlue
        ),
        BusinessModule(
            id = "staff",
            title = "Staff Management",
            description = "Active employees, waiter roles, and team roster",
            icon = Icons.Outlined.People,
            badge = "Roster",
            bgTint = SuccessGreenLight,
            iconTint = SuccessGreen
        ),
        BusinessModule(
            id = "promotions",
            title = "Offers & Promotions",
            description = "Discount codes, seasonal coupons, and deals",
            icon = Icons.Outlined.LocalOffer,
            badge = "Deals",
            bgTint = Color(0xFFFAF5FF),
            iconTint = Color(0xFF7C3AED)
        ),
        BusinessModule(
            id = "inventory",
            title = "Inventory & Stock",
            description = "Real-time stock deduction, batches, and supplies",
            icon = Icons.Outlined.Inventory2,
            badge = "Stock",
            bgTint = WarningAmberLight,
            iconTint = WarningAmber
        ),
        BusinessModule(
            id = "billing",
            title = "Bills & Invoices",
            description = "Tax invoices, POS checkout registers, and settlements",
            icon = Icons.Outlined.Receipt,
            badge = "Finance",
            bgTint = Color(0xFFF1F5F9),
            iconTint = Color(0xFF475569)
        ),
        BusinessModule(
            id = "reservations",
            title = "Table Reservations",
            description = "Manage customer table bookings, seatings, and schedules",
            icon = Icons.Outlined.EventAvailable,
            badge = "Bookings",
            bgTint = Color(0xFFEFF6FF),
            iconTint = Color(0xFF2563EB)
        )
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Business Hub", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextPrimary) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = BackgroundLight
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = DarkBrownEspresso)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Operations Command", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = SurfaceWhite)
                            Text("Full controls for floor, team, sales, and catalog", fontSize = 11.sp, color = SurfaceWhite.copy(alpha = 0.8f))
                        }
                        Icon(Icons.Default.TrendingUp, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(32.dp))
                    }
                }
            }

            items(modules) { mod ->
                OwnerCard(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { onNavigateToModule(mod.id) }
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(mod.bgTint),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(mod.icon, contentDescription = null, tint = mod.iconTint, modifier = Modifier.size(22.dp))
                        }

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(mod.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(
                                    color = BackgroundLight,
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text(
                                        mod.badge,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextSecondary,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(mod.description, fontSize = 11.sp, color = TextSecondary, maxLines = 1)
                        }

                        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted)
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
