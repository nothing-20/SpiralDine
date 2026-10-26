package com.spiraldine.owner.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.navigation.OwnerNavDestination

data class NavigationTab(
    val destination: OwnerNavDestination,
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val badgeCount: Int = 0
)

@Composable
fun OwnerBottomNavBar(
    currentDestination: OwnerNavDestination,
    onTabSelected: (OwnerNavDestination) -> Unit,
    pendingOrdersCount: Int = 0
) {
    val tabs = listOf(
        NavigationTab(OwnerNavDestination.Home, "Home", Icons.Filled.Home, Icons.Outlined.Home),
        NavigationTab(OwnerNavDestination.Orders, "Orders", Icons.Filled.ReceiptLong, Icons.Outlined.ReceiptLong, badgeCount = pendingOrdersCount),
        NavigationTab(OwnerNavDestination.Menu, "Menu", Icons.Filled.RestaurantMenu, Icons.Outlined.RestaurantMenu),
        NavigationTab(OwnerNavDestination.Business, "Business", Icons.Filled.Dashboard, Icons.Outlined.Dashboard),
        NavigationTab(OwnerNavDestination.More, "More", Icons.Filled.MoreHoriz, Icons.Outlined.MoreHoriz),
    )

    NavigationBar(
        containerColor = SurfaceWhite,
        tonalElevation = 8.dp,
        modifier = Modifier.border(width = 1.dp, color = BorderLight)
    ) {
        tabs.forEach { tab ->
            val isSelected = currentDestination == tab.destination
            NavigationBarItem(
                selected = isSelected,
                onClick = { onTabSelected(tab.destination) },
                icon = {
                    BadgedBox(
                        badge = {
                            if (tab.badgeCount > 0) {
                                Badge(containerColor = TerracottaOrange) {
                                    Text(
                                        text = if (tab.badgeCount > 99) "99+" else tab.badgeCount.toString(),
                                        color = SurfaceWhite,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    ) {
                        Icon(
                            imageVector = if (isSelected) tab.selectedIcon else tab.unselectedIcon,
                            contentDescription = tab.label,
                            tint = if (isSelected) TerracottaOrange else TextSecondary
                        )
                    }
                },
                label = {
                    Text(
                        text = tab.label,
                        color = if (isSelected) TerracottaOrange else TextSecondary,
                        fontSize = 11.sp,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    indicatorColor = TerracottaOrangeLight
                )
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerTopBar(
    userProfile: com.spiraldine.owner.data.model.UserProfile? = null,
    restaurantName: String = "SpiralDine Restaurant",
    branchName: String = "Main Dining",
    isOpen: Boolean = true,
    branches: List<com.spiraldine.owner.data.model.BranchRecord> = emptyList(),
    onSelectBranch: ((String) -> Unit)? = null,
    onNotificationsClick: () -> Unit = {},
    onProfileClick: () -> Unit = {}
) {
    var showBranchMenu by remember { mutableStateOf(false) }
    val avatarInitial = (userProfile?.displayName?.firstOrNull { it.isLetter() }
        ?: userProfile?.email?.firstOrNull { it.isLetter() }
        ?: restaurantName.firstOrNull { it.isLetter() }
        ?: 'U').uppercaseChar().toString()

    TopAppBar(
        title = {
            Column {
                Text(
                    text = restaurantName,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Box {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clickable(enabled = branches.isNotEmpty() && onSelectBranch != null) {
                                showBranchMenu = true
                            }
                            .padding(vertical = 2.dp)
                    ) {
                        Text(
                            text = branchName,
                            fontSize = 11.sp,
                            color = TextSecondary,
                            fontWeight = FontWeight.Medium
                        )
                        if (branches.isNotEmpty() && onSelectBranch != null) {
                            Icon(
                                imageVector = Icons.Default.ArrowDropDown,
                                contentDescription = "Switch Branch",
                                tint = TextSecondary,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(4.dp))
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(if (isOpen) SuccessGreen else ErrorRed)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (isOpen) "Open" else "Closed",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (isOpen) SuccessGreen else ErrorRed
                        )
                    }

                    if (branches.isNotEmpty() && onSelectBranch != null) {
                        DropdownMenu(
                            expanded = showBranchMenu,
                            onDismissRequest = { showBranchMenu = false }
                        ) {
                            branches.forEach { branch ->
                                val isCurrent = branch.name.equals(branchName, ignoreCase = true) || branch.isDefault
                                DropdownMenuItem(
                                    text = {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                                        ) {
                                            Icon(
                                                imageVector = if (isCurrent) Icons.Default.Check else Icons.Default.LocationOn,
                                                contentDescription = null,
                                                tint = if (isCurrent) TerracottaOrange else TextSecondary,
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Text(
                                                text = branch.name,
                                                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                                                color = if (isCurrent) TerracottaOrange else TextPrimary
                                            )
                                        }
                                    },
                                    onClick = {
                                        showBranchMenu = false
                                        onSelectBranch(branch.id)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        },
        actions = {
            IconButton(onClick = onNotificationsClick) {
                Icon(Icons.Outlined.Notifications, contentDescription = "Notifications", tint = TextPrimary)
            }
            Box(
                modifier = Modifier
                    .padding(end = 8.dp)
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(DarkBrownEspresso)
                    .clickable { onProfileClick() },
                contentAlignment = Alignment.Center
            ) {
                Text(avatarInitial, color = SurfaceWhite, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = SurfaceWhite
        )
    )
}

@Composable
fun OwnerStatusBadge(status: String) {
    val norm = status.uppercase()
    val (bg, txt, label) = when (norm) {
        "PENDING", "NEW" -> Triple(WarningAmberLight, WarningAmber, "New Order")
        "PREPARING" -> Triple(InfoBlueLight, InfoBlue, "Preparing")
        "READY" -> Triple(Color(0xFFF5F3FF), Color(0xFF7C3AED), "Ready")
        "COMPLETED", "SERVED" -> Triple(SuccessGreenLight, SuccessGreen, "Completed")
        "CANCELLED", "REJECTED" -> Triple(ErrorRedLight, ErrorRed, "Cancelled")
        "AVAILABLE" -> Triple(SuccessGreenLight, SuccessGreen, "Available")
        "OCCUPIED" -> Triple(WarningAmberLight, WarningAmber, "Occupied")
        else -> Triple(BackgroundLight, TextSecondary, norm)
    }

    Surface(
        color = bg,
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            text = label,
            color = txt,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun OwnerCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier.then(
            if (onClick != null) Modifier.clickable { onClick() } else Modifier
        ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderLight)),
        content = content
    )
}
