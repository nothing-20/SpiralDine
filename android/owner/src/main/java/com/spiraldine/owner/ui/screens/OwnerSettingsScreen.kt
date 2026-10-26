package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.border
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import coil.compose.AsyncImage
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerSettingsScreen(
    userProfile: com.spiraldine.owner.data.model.UserProfile? = null,
    userEmail: String? = null,
    restaurantName: String? = null,
    branchName: String? = null,
    logoUrl: String? = null,
    onBack: () -> Unit,
    onLogout: () -> Unit
) {
    var notificationsEnabled by remember { mutableStateOf(true) }
    var soundEnabled by remember { mutableStateOf(true) }
    var showLogoutDialog by remember { mutableStateOf(false) }

    val resolvedEmail = userProfile?.email?.ifBlank { null }
        ?: userEmail?.ifBlank { null }
        ?: "No account email"
    val resolvedUserName = userProfile?.displayName?.ifBlank { null }
        ?: (if (resolvedEmail.contains("@")) resolvedEmail.substringBefore('@') else "Authorized User")
    val resolvedRestName = restaurantName?.ifBlank { null }
        ?: userProfile?.restaurantName?.ifBlank { null }
        ?: "SpiralDine Restaurant"
    val resolvedBranch = branchName?.ifBlank { null }
        ?: userProfile?.branchId?.ifBlank { null }
        ?: "Main Dining"
    val initial = (resolvedUserName.firstOrNull { it.isLetter() } ?: resolvedEmail.firstOrNull { it.isLetter() } ?: 'U').uppercaseChar().toString()

    val roleBadge = when (userProfile?.role?.lowercase()) {
        "owner" -> "Verified Workspace Owner"
        "admin", "manager" -> "Verified Manager"
        "kitchen" -> "Verified Kitchen Staff"
        "waiter" -> "Verified Service Staff"
        "cashier" -> "Verified Billing Staff"
        else -> "Verified Staff Member"
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings & Legal", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
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
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Profile Card (Authenticated User Identity)
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (!userProfile?.photoUrl.isNullOrBlank()) {
                            Box(
                                modifier = Modifier
                                    .size(52.dp)
                                    .clip(CircleShape)
                                    .border(1.5.dp, TerracottaOrange, CircleShape)
                                    .background(TerracottaOrangeLight),
                                contentAlignment = Alignment.Center
                            ) {
                                AsyncImage(
                                    model = userProfile?.photoUrl,
                                    contentDescription = "User Avatar",
                                    contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                            }
                        } else {
                            Box(
                                modifier = Modifier
                                    .size(52.dp)
                                    .clip(CircleShape)
                                    .background(
                                        Brush.linearGradient(
                                            listOf(TerracottaOrange, Color(0xFFC05621))
                                        )
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(initial, color = SurfaceWhite, fontWeight = FontWeight.Black, fontSize = 20.sp)
                            }
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column {
                            Text(resolvedUserName, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text(resolvedEmail, fontSize = 12.sp, color = TextSecondary)
                            Spacer(modifier = Modifier.height(4.dp))
                            Surface(
                                color = TerracottaOrangeLight,
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    roleBadge,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TerracottaOrange,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Restaurant & Branch Association Card
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Restaurant Association", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Restaurant Venue", fontSize = 12.sp, color = TextSecondary)
                            Text(resolvedRestName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Assigned Branch", fontSize = 12.sp, color = TextSecondary)
                            Text(resolvedBranch, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }
                    }
                }
            }

            // Notification Preferences
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Notification Preferences", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Live Order Push Alerts", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text("Notify when diners place orders", fontSize = 10.sp, color = TextSecondary)
                            }
                            Switch(
                                checked = notificationsEnabled,
                                onCheckedChange = { notificationsEnabled = it },
                                colors = SwitchDefaults.colors(checkedTrackColor = TerracottaOrange)
                            )
                        }

                        HorizontalDivider(color = BackgroundLight, modifier = Modifier.padding(vertical = 8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Kitchen Sound Alerts", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text("Chime on new tickets", fontSize = 10.sp, color = TextSecondary)
                            }
                            Switch(
                                checked = soundEnabled,
                                onCheckedChange = { soundEnabled = it },
                                colors = SwitchDefaults.colors(checkedTrackColor = TerracottaOrange)
                            )
                        }
                    }
                }
            }

            // Legal & Policies
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Policies & Legal Terms", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                        Spacer(modifier = Modifier.height(10.dp))

                        listOf(
                            "Terms of Service",
                            "Privacy Policy",
                            "Refund & Cancellation Policy",
                            "Accessibility Statement"
                        ).forEach { policy ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 6.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(policy, fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                                Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }

            // Logout
            item {
                Button(
                    onClick = { showLogoutDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                ) {
                    Text("Sign Out", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }

        if (showLogoutDialog) {
            AlertDialog(
                onDismissRequest = { showLogoutDialog = false },
                title = { Text("Sign Out") },
                text = { Text("Are you sure you want to end your current session?") },
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
