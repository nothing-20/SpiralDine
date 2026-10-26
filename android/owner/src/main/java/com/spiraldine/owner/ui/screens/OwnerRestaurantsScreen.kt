package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.BranchRecord
import com.spiraldine.owner.data.model.RestaurantDetailRecord
import com.spiraldine.owner.data.model.StaffRecord
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerRestaurantsScreen(
    currentRestaurantName: String,
    currentBranchName: String,
    currentTenantId: String = "",
    restaurants: List<RestaurantDetailRecord> = emptyList(),
    branches: List<BranchRecord> = emptyList(),
    staff: List<StaffRecord> = emptyList(),
    onBack: () -> Unit,
    onSelectBranch: (String) -> Unit,
    onSaveBranch: (BranchRecord) -> Unit,
    onToggleBranchActive: ((String, Boolean) -> Unit)? = null,
    onSaveRestaurant: ((RestaurantDetailRecord, Boolean) -> Unit)? = null,
    onToggleRestaurantStatus: ((String, String) -> Unit)? = null,
    onAssignManager: ((String, String, String) -> Unit)? = null,
    onSwitchWorkspace: ((String, String) -> Unit)? = null,
    onFetchBranches: ((String, (List<BranchRecord>) -> Unit) -> Unit)? = null
) {
    // 0: Restaurant Portfolio, 1: Branches & Locations
    var selectedTab by remember { mutableIntStateOf(0) }

    // Search and Filters for Restaurants
    var searchQuery by remember { mutableStateOf("") }
    var statusFilter by remember { mutableStateOf("all") } // all, active, suspended
    var locationFilter by remember { mutableStateOf("all") }

    // Modals / Dialogs state
    var showAddRestaurantDialog by remember { mutableStateOf(false) }
    var editingRestaurant by remember { mutableStateOf<RestaurantDetailRecord?>(null) }

    var showAddBranchDialog by remember { mutableStateOf(false) }
    var editingBranch by remember { mutableStateOf<BranchRecord?>(null) }

    var targetRestaurantForManager by remember { mutableStateOf<RestaurantDetailRecord?>(null) }
    var targetRestaurantForStatus by remember { mutableStateOf<RestaurantDetailRecord?>(null) }

    var selectedDetailRestaurant by remember { mutableStateOf<RestaurantDetailRecord?>(null) }
    var detailsBranches by remember { mutableStateOf<List<BranchRecord>>(emptyList()) }
    var isLoadingDetailsBranches by remember { mutableStateOf(false) }

    // Extract unique locations for filtering
    val uniqueLocations = remember(restaurants) {
        restaurants.map { it.city.trim() }.filter { it.isNotBlank() }.distinct()
    }

    // Filtered restaurants
    val filteredRestaurants = remember(restaurants, searchQuery, statusFilter, locationFilter) {
        restaurants.filter { r ->
            val matchQuery = searchQuery.isBlank() ||
                r.name.contains(searchQuery, ignoreCase = true) ||
                r.city.contains(searchQuery, ignoreCase = true) ||
                r.id.contains(searchQuery, ignoreCase = true) ||
                r.cuisine.contains(searchQuery, ignoreCase = true)

            val matchStatus = when (statusFilter) {
                "active" -> r.status.equals("active", ignoreCase = true)
                "suspended" -> r.status.equals("suspended", ignoreCase = true) || r.status.equals("inactive", ignoreCase = true)
                else -> true
            }

            val matchLoc = locationFilter == "all" || r.city.equals(locationFilter, ignoreCase = true)

            matchQuery && matchStatus && matchLoc
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Restaurants & Branches",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = TextPrimary
                        )
                        Text(
                            text = if (selectedTab == 0) "Portfolio Management • ${restaurants.size} Units" else "$currentRestaurantName • ${branches.size} Branches",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = TextPrimary
                        )
                    }
                },
                actions = {
                    if (selectedTab == 0) {
                        IconButton(onClick = {
                            editingRestaurant = null
                            showAddRestaurantDialog = true
                        }) {
                            Icon(
                                imageVector = Icons.Default.AddBusiness,
                                contentDescription = "Add Restaurant",
                                tint = TerracottaOrange
                            )
                        }
                    } else {
                        IconButton(onClick = {
                            editingBranch = null
                            showAddBranchDialog = true
                        }) {
                            Icon(
                                imageVector = Icons.Default.AddLocationAlt,
                                contentDescription = "Add Branch",
                                tint = TerracottaOrange
                            )
                        }
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
                contentColor = TerracottaOrange,
                divider = { HorizontalDivider(color = BorderLight) }
            ) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Storefront,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = if (selectedTab == 0) TerracottaOrange else TextSecondary
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Restaurant Portfolio (${restaurants.size})",
                                fontWeight = if (selectedTab == 0) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 13.sp,
                                color = if (selectedTab == 0) TerracottaOrange else TextSecondary
                            )
                        }
                    }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Place,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp),
                                tint = if (selectedTab == 1) TerracottaOrange else TextSecondary
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Branches (${branches.size})",
                                fontWeight = if (selectedTab == 1) FontWeight.Bold else FontWeight.Medium,
                                fontSize = 13.sp,
                                color = if (selectedTab == 1) TerracottaOrange else TextSecondary
                            )
                        }
                    }
                )
            }

            // Tab Content
            if (selectedTab == 0) {
                // RESTAURANT PORTFOLIO VIEW
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    contentPadding = PaddingValues(vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // KPI Summary Cards
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                PortfolioMetricCard(
                                    modifier = Modifier.weight(1f),
                                    title = "Total Locations",
                                    value = restaurants.size.toString(),
                                    icon = Icons.Default.Storefront,
                                    iconTint = TerracottaOrange,
                                    bgColor = TerracottaOrangeLight
                                )
                                PortfolioMetricCard(
                                    modifier = Modifier.weight(1f),
                                    title = "Active",
                                    value = restaurants.count { it.status.equals("active", ignoreCase = true) }.toString(),
                                    icon = Icons.Default.CheckCircle,
                                    iconTint = SuccessGreen,
                                    bgColor = SuccessGreenLight
                                )
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                PortfolioMetricCard(
                                    modifier = Modifier.weight(1f),
                                    title = "Total Orders",
                                    value = restaurants.sumOf { it.todayOrders }.toString(),
                                    icon = Icons.Default.ShoppingBag,
                                    iconTint = InfoBlue,
                                    bgColor = InfoBlueLight
                                )
                                PortfolioMetricCard(
                                    modifier = Modifier.weight(1f),
                                    title = "Managed Tables",
                                    value = restaurants.sumOf { it.tableCount }.toString(),
                                    icon = Icons.Default.TableRestaurant,
                                    iconTint = WarningAmber,
                                    bgColor = WarningAmberLight
                                )
                            }
                        }
                    }

                    // Search and Filter Bar
                    item {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedTextField(
                                value = searchQuery,
                                onValueChange = { searchQuery = it },
                                placeholder = { Text("Search by name, city, ID...", fontSize = 12.sp, color = TextMuted) },
                                leadingIcon = {
                                    Icon(
                                        imageVector = Icons.Default.Search,
                                        contentDescription = null,
                                        tint = TextSecondary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                },
                                trailingIcon = {
                                    if (searchQuery.isNotBlank()) {
                                        IconButton(onClick = { searchQuery = "" }) {
                                            Icon(
                                                imageVector = Icons.Default.Clear,
                                                contentDescription = "Clear",
                                                tint = TextSecondary,
                                                modifier = Modifier.size(16.dp)
                                            )
                                        }
                                    }
                                },
                                singleLine = true,
                                shape = RoundedCornerShape(12.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = TerracottaOrange,
                                    unfocusedBorderColor = BorderLight,
                                    focusedContainerColor = SurfaceWhite,
                                    unfocusedContainerColor = SurfaceWhite
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )

                            // Status & Location filter chips
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(rememberScrollState()),
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                FilterChip(
                                    selected = statusFilter == "all",
                                    onClick = { statusFilter = "all" },
                                    label = { Text("All Statuses", fontSize = 11.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = TerracottaOrangeLight,
                                        selectedLabelColor = TerracottaOrange
                                    )
                                )
                                FilterChip(
                                    selected = statusFilter == "active",
                                    onClick = { statusFilter = "active" },
                                    label = { Text("Active", fontSize = 11.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = SuccessGreenLight,
                                        selectedLabelColor = SuccessGreen
                                    )
                                )
                                FilterChip(
                                    selected = statusFilter == "suspended",
                                    onClick = { statusFilter = "suspended" },
                                    label = { Text("Suspended", fontSize = 11.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = ErrorRedLight,
                                        selectedLabelColor = ErrorRed
                                    )
                                )

                                Spacer(modifier = Modifier.width(4.dp))
                                Text("•", color = TextSecondary)
                                Spacer(modifier = Modifier.width(4.dp))

                                FilterChip(
                                    selected = locationFilter == "all",
                                    onClick = { locationFilter = "all" },
                                    label = { Text("All Cities", fontSize = 11.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = InfoBlueLight,
                                        selectedLabelColor = InfoBlue
                                    )
                                )
                                uniqueLocations.forEach { loc ->
                                    FilterChip(
                                        selected = locationFilter.equals(loc, ignoreCase = true),
                                        onClick = { locationFilter = loc },
                                        label = { Text(loc, fontSize = 11.sp) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = InfoBlueLight,
                                            selectedLabelColor = InfoBlue
                                        )
                                    )
                                }
                            }
                        }
                    }

                    // Section Title
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "RESTAURANT PORTFOLIO (${filteredRestaurants.size})",
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                color = TextSecondary,
                                letterSpacing = 0.5.sp
                            )
                            TextButton(
                                onClick = {
                                    editingRestaurant = null
                                    showAddRestaurantDialog = true
                                }
                            ) {
                                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp), tint = TerracottaOrange)
                                Spacer(modifier = Modifier.width(2.dp))
                                Text("Add Restaurant", fontSize = 11.sp, color = TerracottaOrange, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    // Restaurant List
                    if (filteredRestaurants.isEmpty()) {
                        item {
                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(32.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Storefront,
                                        contentDescription = null,
                                        modifier = Modifier.size(40.dp),
                                        tint = TextMuted
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = if (restaurants.isEmpty()) "No restaurants found" else "No restaurants match your filters",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 14.sp,
                                        color = TextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = if (restaurants.isEmpty()) "Click \"Add Restaurant\" to configure your first location." else "Try clearing your search query or status filter.",
                                        fontSize = 12.sp,
                                        color = TextSecondary
                                    )
                                    if (restaurants.isNotEmpty()) {
                                        Spacer(modifier = Modifier.height(12.dp))
                                        OutlinedButton(onClick = {
                                            searchQuery = ""
                                            statusFilter = "all"
                                            locationFilter = "all"
                                        }) {
                                            Text("Reset Filters", fontSize = 12.sp)
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        items(filteredRestaurants, key = { it.id }) { rest ->
                            val isCurrentWorkspace = rest.id.equals(currentTenantId, ignoreCase = true)
                            val isActiveStatus = rest.status.equals("active", ignoreCase = true)

                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    // Row 1: Restaurant Name & Badges
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(36.dp)
                                                    .clip(RoundedCornerShape(10.dp))
                                                    .background(if (isActiveStatus) TerracottaOrangeLight else BackgroundLight),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Storefront,
                                                    contentDescription = null,
                                                    tint = if (isActiveStatus) TerracottaOrange else TextSecondary,
                                                    modifier = Modifier.size(20.dp)
                                                )
                                            }
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Column {
                                                Text(
                                                    text = rest.name,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 14.sp,
                                                    color = TextPrimary,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                                Text(
                                                    text = "${rest.city} • ${rest.cuisine}",
                                                    fontSize = 11.sp,
                                                    color = TextSecondary,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                            }
                                        }

                                        // Status Pill
                                        Surface(
                                            color = if (isActiveStatus) SuccessGreenLight else ErrorRedLight,
                                            shape = RoundedCornerShape(10.dp)
                                        ) {
                                            Text(
                                                text = if (isActiveStatus) "ACTIVE" else "SUSPENDED",
                                                color = if (isActiveStatus) SuccessGreen else ErrorRed,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 9.sp,
                                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))
                                    HorizontalDivider(color = BorderLight)
                                    Spacer(modifier = Modifier.height(10.dp))

                                    // Manager & Address Row
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("Branch Manager", fontSize = 10.sp, color = TextSecondary)
                                            Text(
                                                text = rest.managerName.ifBlank { "Unassigned" },
                                                fontWeight = FontWeight.SemiBold,
                                                fontSize = 12.sp,
                                                color = if (rest.managerName.isNotBlank() && rest.managerName != "Unassigned") TextPrimary else TextMuted
                                            )
                                        }

                                        TextButton(
                                            onClick = { targetRestaurantForManager = rest },
                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                        ) {
                                            Icon(Icons.Default.PersonAdd, contentDescription = null, modifier = Modifier.size(14.dp), tint = InfoBlue)
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Assign", fontSize = 11.sp, color = InfoBlue, fontWeight = FontWeight.Bold)
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))

                                    // Operational Stats Row
                                    Surface(
                                        color = BackgroundLight,
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(horizontal = 12.dp, vertical = 8.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text("Today Sales", fontSize = 9.sp, color = TextSecondary)
                                                Text(
                                                    text = RevenueCalculator.formatPaise(rest.todaySales),
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 12.sp,
                                                    color = TextPrimary
                                                )
                                            }
                                            VerticalDivider(modifier = Modifier.height(24.dp), color = BorderLight)
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text("Orders", fontSize = 9.sp, color = TextSecondary)
                                                Text(
                                                    text = rest.todayOrders.toString(),
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 12.sp,
                                                    color = TextPrimary
                                                )
                                            }
                                            VerticalDivider(modifier = Modifier.height(24.dp), color = BorderLight)
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text("Tables", fontSize = 9.sp, color = TextSecondary)
                                                Text(
                                                    text = rest.tableCount.toString(),
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 12.sp,
                                                    color = TextPrimary
                                                )
                                            }
                                            VerticalDivider(modifier = Modifier.height(24.dp), color = BorderLight)
                                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                                Text("Plan", fontSize = 9.sp, color = TextSecondary)
                                                Text(
                                                    text = rest.planTier.uppercase(),
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 11.sp,
                                                    color = TerracottaOrange
                                                )
                                            }
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))

                                    // Action Buttons Row
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        // Left: Workspace badge or Switch button
                                        if (isCurrentWorkspace) {
                                            Surface(
                                                color = TerracottaOrangeLight,
                                                shape = RoundedCornerShape(8.dp)
                                            ) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                ) {
                                                    Icon(Icons.Default.Check, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(12.dp))
                                                    Spacer(modifier = Modifier.width(4.dp))
                                                    Text("ACTIVE WORKSPACE", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = TerracottaOrange)
                                                }
                                            }
                                        } else {
                                            OutlinedButton(
                                                onClick = {
                                                    onSwitchWorkspace?.invoke(rest.id, rest.name)
                                                },
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                                shape = RoundedCornerShape(8.dp),
                                                border = ButtonDefaults.outlinedButtonBorder.copy(width = 1.dp)
                                            ) {
                                                Icon(Icons.Default.SwapHoriz, contentDescription = null, modifier = Modifier.size(14.dp), tint = InfoBlue)
                                                Spacer(modifier = Modifier.width(4.dp))
                                                Text("Switch Here", fontSize = 11.sp, color = InfoBlue, fontWeight = FontWeight.Bold)
                                            }
                                        }

                                        // Right: View Details, Edit, Power toggle
                                        Row(
                                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            IconButton(
                                                onClick = {
                                                    selectedDetailRestaurant = rest
                                                    isLoadingDetailsBranches = true
                                                    detailsBranches = emptyList()
                                                    onFetchBranches?.invoke(rest.id) { fetched ->
                                                        detailsBranches = fetched
                                                        isLoadingDetailsBranches = false
                                                    }
                                                },
                                                modifier = Modifier.size(32.dp)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Visibility,
                                                    contentDescription = "View Details",
                                                    tint = TextSecondary,
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }

                                            IconButton(
                                                onClick = {
                                                    editingRestaurant = rest
                                                    showAddRestaurantDialog = true
                                                },
                                                modifier = Modifier.size(32.dp)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.Edit,
                                                    contentDescription = "Edit Profile",
                                                    tint = TextSecondary,
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }

                                            IconButton(
                                                onClick = { targetRestaurantForStatus = rest },
                                                modifier = Modifier.size(32.dp)
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.PowerSettingsNew,
                                                    contentDescription = if (isActiveStatus) "Suspend" else "Activate",
                                                    tint = if (isActiveStatus) SuccessGreen else ErrorRed,
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // BRANCHES & LOCATIONS VIEW (Preserves all existing Android branch capabilities)
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    contentPadding = PaddingValues(vertical = 14.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Header Card
                    item {
                        OwnerCard(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(40.dp)
                                            .clip(CircleShape)
                                            .background(TerracottaOrangeLight),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Default.Storefront, contentDescription = null, tint = TerracottaOrange)
                                    }
                                    Spacer(modifier = Modifier.width(12.dp))
                                    Column {
                                        Text(currentRestaurantName, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                                        Text("${branches.size} Registered Branch Locations", fontSize = 11.sp, color = TextSecondary)
                                    }
                                }

                                Button(
                                    onClick = {
                                        editingBranch = null
                                        showAddBranchDialog = true
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Add Branch", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    item {
                        Text(
                            text = "AUTHORIZED BRANCH LOCATIONS (${branches.size})",
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp,
                            color = TextSecondary,
                            letterSpacing = 0.5.sp
                        )
                    }

                    if (branches.isEmpty()) {
                        item {
                            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(32.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("No branch records found", color = TextSecondary, fontSize = 13.sp)
                                }
                            }
                        }
                    } else {
                        items(branches, key = { it.id }) { branch ->
                            val isCurrent = branch.name.equals(currentBranchName, ignoreCase = true) || branch.isDefault

                            OwnerCard(
                                modifier = Modifier.fillMaxWidth(),
                                onClick = { onSelectBranch(branch.id) }
                            ) {
                                Column(modifier = Modifier.padding(14.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.LocationOn,
                                                contentDescription = null,
                                                tint = if (isCurrent) TerracottaOrange else TextSecondary,
                                                modifier = Modifier.size(20.dp)
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Column {
                                                Row(verticalAlignment = Alignment.CenterVertically) {
                                                    Text(
                                                        text = branch.name,
                                                        fontWeight = FontWeight.Bold,
                                                        fontSize = 14.sp,
                                                        color = TextPrimary
                                                    )
                                                    if (branch.code.isNotBlank()) {
                                                        Spacer(modifier = Modifier.width(6.dp))
                                                        Surface(
                                                            color = BackgroundLight,
                                                            shape = RoundedCornerShape(4.dp)
                                                        ) {
                                                            Text(
                                                                text = branch.code,
                                                                fontSize = 9.sp,
                                                                fontWeight = FontWeight.Bold,
                                                                color = TextSecondary,
                                                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                                                            )
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        if (isCurrent) {
                                            Surface(
                                                color = TerracottaOrangeLight,
                                                shape = RoundedCornerShape(12.dp)
                                            ) {
                                                Text(
                                                    text = "ACTIVE BRANCH",
                                                    color = TerracottaOrange,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 10.sp,
                                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                                )
                                            }
                                        } else {
                                            TextButton(onClick = { onSelectBranch(branch.id) }) {
                                                Text("Switch", fontSize = 12.sp, color = InfoBlue, fontWeight = FontWeight.Bold)
                                            }
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))
                                    HorizontalDivider(color = BorderLight)
                                    Spacer(modifier = Modifier.height(10.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column {
                                            Text("City / Address", fontSize = 10.sp, color = TextSecondary)
                                            Text(
                                                text = if (branch.city.isNotBlank()) "${branch.city} • ${branch.address}" else branch.address.ifBlank { "Main Location" },
                                                fontSize = 12.sp,
                                                color = TextPrimary,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                        Column(horizontalAlignment = Alignment.End) {
                                            Text("Seating Tables", fontSize = 10.sp, color = TextSecondary)
                                            Text("${branch.tablesCount} Tables", fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Bold)
                                        }
                                    }

                                    if (branch.managerName.isNotBlank() || branch.phone.isNotBlank()) {
                                        Spacer(modifier = Modifier.height(6.dp))
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            if (branch.managerName.isNotBlank()) {
                                                Text("Manager: ${branch.managerName}", fontSize = 11.sp, color = TextSecondary)
                                            }
                                            if (branch.phone.isNotBlank()) {
                                                Text("Phone: ${branch.phone}", fontSize = 11.sp, color = TextSecondary)
                                            }
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.End
                                    ) {
                                        TextButton(
                                            onClick = {
                                                editingBranch = branch
                                                showAddBranchDialog = true
                                            }
                                        ) {
                                            Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(14.dp), tint = TextSecondary)
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Edit Details", fontSize = 11.sp, color = TextSecondary)
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

    // ── MODAL 1: Add / Edit Restaurant Dialog ──
    if (showAddRestaurantDialog) {
        var restName by remember { mutableStateOf(editingRestaurant?.name ?: "") }
        var restCity by remember { mutableStateOf(editingRestaurant?.city ?: "") }
        var restAddress by remember { mutableStateOf(editingRestaurant?.address ?: "") }
        var restPhone by remember { mutableStateOf(editingRestaurant?.phone ?: "") }
        var restCuisine by remember { mutableStateOf(editingRestaurant?.cuisine ?: "Multicuisine") }
        var restPlan by remember { mutableStateOf(editingRestaurant?.planTier ?: "pro") }

        AlertDialog(
            onDismissRequest = { showAddRestaurantDialog = false },
            title = {
                Text(
                    text = if (editingRestaurant == null) "Add New Restaurant" else "Edit Restaurant Profile",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = restName,
                        onValueChange = { restName = it },
                        label = { Text("Restaurant Name *") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = restCity,
                        onValueChange = { restCity = it },
                        label = { Text("City / Region *") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = restAddress,
                        onValueChange = { restAddress = it },
                        label = { Text("Street Address") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = restPhone,
                        onValueChange = { restPhone = it },
                        label = { Text("Contact Phone") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = restCuisine,
                        onValueChange = { restCuisine = it },
                        label = { Text("Cuisine Types (e.g. Biryani, Continental)") },
                        modifier = Modifier.fillMaxWidth()
                    )

                    // Plan Tier selector
                    Text("Subscription Plan Tier", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf("starter", "pro", "enterprise").forEach { plan ->
                            FilterChip(
                                selected = restPlan == plan,
                                onClick = { restPlan = plan },
                                label = { Text(plan.uppercase(), fontSize = 10.sp) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = TerracottaOrangeLight,
                                    selectedLabelColor = TerracottaOrange
                                )
                            )
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (restName.isNotBlank() && restCity.isNotBlank()) {
                            val record = (editingRestaurant ?: RestaurantDetailRecord()).copy(
                                name = restName.trim(),
                                city = restCity.trim(),
                                address = restAddress.trim(),
                                phone = restPhone.trim(),
                                cuisine = restCuisine.trim(),
                                planTier = restPlan
                            )
                            onSaveRestaurant?.invoke(record, editingRestaurant != null)
                            showAddRestaurantDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text(if (editingRestaurant == null) "Create Restaurant" else "Save Changes")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddRestaurantDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── MODAL 2: Add / Edit Branch Dialog ──
    if (showAddBranchDialog) {
        var branchNameInput by remember { mutableStateOf(editingBranch?.name ?: "") }
        var branchCodeInput by remember { mutableStateOf(editingBranch?.code ?: "") }
        var addressInput by remember { mutableStateOf(editingBranch?.address ?: "") }
        var cityInput by remember { mutableStateOf(editingBranch?.city ?: "") }
        var phoneInput by remember { mutableStateOf(editingBranch?.phone ?: "") }
        var managerInput by remember { mutableStateOf(editingBranch?.managerName ?: "") }
        var tablesCountInput by remember { mutableStateOf(editingBranch?.tablesCount?.toString() ?: "12") }

        AlertDialog(
            onDismissRequest = { showAddBranchDialog = false },
            title = {
                Text(
                    text = if (editingBranch == null) "Add New Branch" else "Edit Branch Details",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = branchNameInput,
                        onValueChange = { branchNameInput = it },
                        label = { Text("Branch Name *") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = branchCodeInput,
                        onValueChange = { branchCodeInput = it },
                        label = { Text("Branch Code (e.g. BR-01)") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = cityInput,
                        onValueChange = { cityInput = it },
                        label = { Text("City") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = addressInput,
                        onValueChange = { addressInput = it },
                        label = { Text("Address") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = managerInput,
                        onValueChange = { managerInput = it },
                        label = { Text("Manager Name") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = phoneInput,
                        onValueChange = { phoneInput = it },
                        label = { Text("Contact Phone") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = tablesCountInput,
                        onValueChange = { tablesCountInput = it },
                        label = { Text("Tables Count") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (branchNameInput.isNotBlank()) {
                            val newRecord = (editingBranch ?: BranchRecord()).copy(
                                name = branchNameInput.trim(),
                                code = branchCodeInput.trim(),
                                city = cityInput.trim(),
                                address = addressInput.trim(),
                                managerName = managerInput.trim(),
                                phone = phoneInput.trim(),
                                tablesCount = tablesCountInput.toIntOrNull() ?: 10
                            )
                            onSaveBranch(newRecord)
                            showAddBranchDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Save Branch")
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddBranchDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── MODAL 3: Assign Branch Manager Dialog ──
    if (targetRestaurantForManager != null) {
        val currentRest = targetRestaurantForManager!!
        var chosenStaffId by remember { mutableStateOf(currentRest.managerId) }
        var chosenStaffName by remember { mutableStateOf(currentRest.managerName) }

        AlertDialog(
            onDismissRequest = { targetRestaurantForManager = null },
            title = {
                Text(
                    text = "Assign Branch Manager",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Select a verified staff member to oversee operations at \"${currentRest.name}\".",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )

                    HorizontalDivider(color = BorderLight)

                    // Option: Unassigned
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .clickable {
                                chosenStaffId = ""
                                chosenStaffName = "Unassigned"
                            }
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        RadioButton(
                            selected = chosenStaffId.isBlank() || chosenStaffName == "Unassigned",
                            onClick = {
                                chosenStaffId = ""
                                chosenStaffName = "Unassigned"
                            }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("-- No Manager Assigned --", fontSize = 13.sp, color = TextSecondary)
                    }

                    // Staff List
                    staff.forEach { member ->
                        val isSelected = chosenStaffId == member.id || (chosenStaffId.isBlank() && chosenStaffName.equals(member.name, ignoreCase = true))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .clickable {
                                    chosenStaffId = member.id
                                    chosenStaffName = member.name
                                }
                                .padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(
                                selected = isSelected,
                                onClick = {
                                    chosenStaffId = member.id
                                    chosenStaffName = member.name
                                }
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(member.name, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                                Text("${member.role.replaceFirstChar { it.uppercase() }} • ${member.phone.ifBlank { member.email }}", fontSize = 11.sp, color = TextSecondary)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onAssignManager?.invoke(currentRest.id, chosenStaffId, chosenStaffName)
                        targetRestaurantForManager = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Save Assignment")
                }
            },
            dismissButton = {
                TextButton(onClick = { targetRestaurantForManager = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── MODAL 4: Restaurant Status Confirmation Dialog ──
    if (targetRestaurantForStatus != null) {
        val rest = targetRestaurantForStatus!!
        val isActive = rest.status.equals("active", ignoreCase = true)

        AlertDialog(
            onDismissRequest = { targetRestaurantForStatus = null },
            title = {
                Text(
                    text = if (isActive) "Deactivate Restaurant" else "Activate Restaurant",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            },
            text = {
                Text(
                    text = "Are you sure you want to ${if (isActive) "deactivate" else "activate"} \"${rest.name}\"? Operational access, online orders, and table availability for this location will be updated.",
                    fontSize = 13.sp,
                    color = TextPrimary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        onToggleRestaurantStatus?.invoke(rest.id, rest.status)
                        targetRestaurantForStatus = null
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isActive) ErrorRed else SuccessGreen
                    )
                ) {
                    Text(if (isActive) "Deactivate" else "Activate")
                }
            },
            dismissButton = {
                TextButton(onClick = { targetRestaurantForStatus = null }) {
                    Text("Cancel")
                }
            }
        )
    }

    // ── MODAL 5: Restaurant Details Dialog ──
    if (selectedDetailRestaurant != null) {
        val rest = selectedDetailRestaurant!!

        AlertDialog(
            onDismissRequest = { selectedDetailRestaurant = null },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(rest.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Surface(
                        color = if (rest.status.equals("active", true)) SuccessGreenLight else ErrorRedLight,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = rest.status.uppercase(),
                            color = if (rest.status.equals("active", true)) SuccessGreen else ErrorRed,
                            fontWeight = FontWeight.Bold,
                            fontSize = 9.sp,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Profile Overview
                    Text("Location ID: ${rest.id}", fontSize = 11.sp, color = TextSecondary)
                    Text("City / Address: ${rest.city} • ${rest.address.ifBlank { "Primary Location" }}", fontSize = 12.sp, color = TextPrimary)
                    if (rest.phone.isNotBlank()) {
                        Text("Phone: ${rest.phone}", fontSize = 12.sp, color = TextPrimary)
                    }
                    Text("Cuisine: ${rest.cuisine}", fontSize = 12.sp, color = TextPrimary)
                    Text("Branch Manager: ${rest.managerName.ifBlank { "Unassigned" }}", fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.SemiBold)

                    HorizontalDivider(color = BorderLight)

                    // Operational Metrics
                    Text("OPERATIONAL METRICS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("Today Sales", fontSize = 10.sp, color = TextSecondary)
                            Text(RevenueCalculator.formatPaise(rest.todaySales), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                        Column {
                            Text("Total Orders", fontSize = 10.sp, color = TextSecondary)
                            Text("${rest.todayOrders}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                        Column {
                            Text("Tables", fontSize = 10.sp, color = TextSecondary)
                            Text("${rest.tableCount}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }

                    HorizontalDivider(color = BorderLight)

                    // Associated Branches
                    Text("ASSOCIATED SUB-BRANCHES", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    if (isLoadingDetailsBranches) {
                        Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp, color = TerracottaOrange)
                        }
                    } else if (detailsBranches.isEmpty()) {
                        Text(
                            text = "No sub-branches registered. Functions as single-unit location.",
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                    } else {
                        detailsBranches.forEach { b ->
                            Surface(
                                color = BackgroundLight,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(8.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(b.name, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                        Text(b.address.ifBlank { b.city }, fontSize = 10.sp, color = TextSecondary)
                                    }
                                    Text("${b.tablesCount} tables", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = TextSecondary)
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { selectedDetailRestaurant = null },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Close")
                }
            }
        )
    }
}

@Composable
private fun PortfolioMetricCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
    bgColor: Color
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        color = SurfaceWhite,
        border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(bgColor),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconTint,
                    modifier = Modifier.size(18.dp)
                )
            }
            Column {
                Text(
                    text = title.uppercase(),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextSecondary,
                    letterSpacing = 0.5.sp
                )
                Text(
                    text = value,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            }
        }
    }
}
