package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.spiraldine.owner.data.model.*
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

enum class MenuToolTab(val label: String, val icon: ImageVector) {
    CATEGORIES("Categories", Icons.Outlined.Layers),
    PORTIONS("Portions & Sizes", Icons.Outlined.RestaurantMenu),
    ADDONS("Add-ons & Modifiers", Icons.Outlined.AddCircleOutline),
    COMBOS("Combos & Bundles", Icons.Outlined.ShoppingBag),
    ANALYTICS("Menu Analytics", Icons.Outlined.Analytics),
    AVAILABILITY("Availability", Icons.Outlined.CheckCircleOutline),
    PRICING("Pricing", Icons.Outlined.CurrencyRupee),
    PREVIEW("Menu Preview", Icons.Outlined.Visibility)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerMenuToolsScreen(
    items: List<MenuItemRecord>,
    categories: List<CategoryRecord>,
    variants: List<MenuVariantRecord>,
    addons: List<MenuAddonRecord>,
    combos: List<MenuComboRecord>,
    orders: List<OrderRecord>,
    restaurantName: String = "SpiralDine Restaurant",
    branchName: String = "Main Dining",
    initialTab: MenuToolTab = MenuToolTab.CATEGORIES,
    onBack: () -> Unit,
    // Category operations
    onSaveCategory: (name: String, description: String, order: Int) -> Unit,
    onDeleteCategory: (String) -> Unit,
    onToggleCategoryActive: (catId: String, currentActive: Boolean) -> Unit,
    onReorderCategory: (catId: String, newOrder: Int) -> Unit,
    // Variant / Portions operations
    onSaveVariant: (itemId: String, itemName: String, name: String, price: Double) -> Unit,
    onDeleteVariant: (String) -> Unit,
    onToggleVariantAvailability: (variantId: String, currentAvailable: Boolean) -> Unit,
    // Addon operations
    onSaveAddon: (name: String, price: Double, isGlobal: Boolean, applicableItems: List<String>) -> Unit,
    onDeleteAddon: (String) -> Unit,
    onToggleAddonAvailability: (addonId: String, currentAvailable: Boolean) -> Unit,
    // Combo operations
    onSaveCombo: (name: String, description: String, price: Double, comboItems: List<ComboItemRecord>) -> Unit,
    onDeleteCombo: (String) -> Unit,
    onToggleComboAvailability: (comboId: String, currentAvailable: Boolean) -> Unit,
    // Menu item availability & pricing
    onToggleItemAvailability: (itemId: String, currentAvailable: Boolean) -> Unit,
    onUpdateItemPrice: (itemId: String, price: Double, discountPrice: Double?) -> Unit
) {
    var activeTab by remember { mutableStateOf(initialTab) }
    val snackbarHostState = remember { SnackbarHostState() }
    val coroutineScope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceWhite)
            ) {
                TopAppBar(
                    title = {
                        Column {
                            Text("Menu Tools Hub", fontWeight = FontWeight.Bold, fontSize = 17.sp, color = TextPrimary)
                            Text("$restaurantName • $branchName", fontSize = 11.sp, color = TextSecondary)
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
                )

                // Tool Navigation Selector Tabs (Horizontal scrollable)
                LazyRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(MenuToolTab.values()) { tab ->
                        val isSelected = activeTab == tab
                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .clickable { activeTab = tab },
                            color = if (isSelected) TerracottaOrange else SurfaceWhite,
                            border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(
                                    tab.icon,
                                    contentDescription = null,
                                    tint = if (isSelected) SurfaceWhite else TextSecondary,
                                    modifier = Modifier.size(15.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = tab.label,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) SurfaceWhite else TextSecondary
                                )
                            }
                        }
                    }
                }
                HorizontalDivider(color = BorderLight, thickness = 1.dp)
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = BackgroundLight
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (activeTab) {
                MenuToolTab.CATEGORIES -> CategoriesToolPanel(
                    categories = categories,
                    items = items,
                    onSaveCategory = onSaveCategory,
                    onDeleteCategory = onDeleteCategory,
                    onToggleActive = onToggleCategoryActive,
                    onReorder = onReorderCategory
                )

                MenuToolTab.PORTIONS -> PortionsToolPanel(
                    items = items,
                    variants = variants,
                    onSaveVariant = onSaveVariant,
                    onDeleteVariant = onDeleteVariant,
                    onToggleAvailability = onToggleVariantAvailability
                )

                MenuToolTab.ADDONS -> AddonsToolPanel(
                    items = items,
                    addons = addons,
                    onSaveAddon = onSaveAddon,
                    onDeleteAddon = onDeleteAddon,
                    onToggleAvailability = onToggleAddonAvailability
                )

                MenuToolTab.COMBOS -> CombosToolPanel(
                    items = items,
                    combos = combos,
                    onSaveCombo = onSaveCombo,
                    onDeleteCombo = onDeleteCombo,
                    onToggleAvailability = onToggleComboAvailability
                )

                MenuToolTab.ANALYTICS -> MenuAnalyticsToolPanel(
                    items = items,
                    categories = categories,
                    orders = orders
                )

                MenuToolTab.AVAILABILITY -> AvailabilityToolPanel(
                    items = items,
                    categories = categories,
                    onToggleItemAvailability = onToggleItemAvailability,
                    onToggleCategoryActive = onToggleCategoryActive
                )

                MenuToolTab.PRICING -> PricingToolPanel(
                    items = items,
                    onUpdatePrice = onUpdateItemPrice
                )

                MenuToolTab.PREVIEW -> MenuPreviewToolPanel(
                    items = items,
                    categories = categories,
                    restaurantName = restaurantName
                )
            }
        }
    }
}

// ==========================================
// 1. CATEGORIES TOOL PANEL
// ==========================================
@Composable
private fun CategoriesToolPanel(
    categories: List<CategoryRecord>,
    items: List<MenuItemRecord>,
    onSaveCategory: (name: String, description: String, order: Int) -> Unit,
    onDeleteCategory: (String) -> Unit,
    onToggleActive: (catId: String, currentActive: Boolean) -> Unit,
    onReorder: (catId: String, newOrder: Int) -> Unit
) {
    var showAddDialog by remember { mutableStateOf(false) }
    var deleteWarningMessage by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Menu Categories", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                Text("${categories.size} categories active", fontSize = 11.sp, color = TextSecondary)
            }
            Button(
                onClick = { showAddDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Category", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (categories.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No categories yet. Tap \"Add Category\" to start.", fontSize = 13.sp, color = TextSecondary)
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(categories, key = { it.id }) { cat ->
                    val dishCount = items.count { it.category.equals(cat.name, ignoreCase = true) }
                    OwnerCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(cat.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = if (cat.isActive) SuccessGreenLight else ErrorRedLight
                                    ) {
                                        Text(
                                            text = if (cat.isActive) "Active" else "Disabled",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (cat.isActive) SuccessGreen else ErrorRed,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                                if (cat.description.isNotBlank()) {
                                    Text(cat.description, fontSize = 11.sp, color = TextSecondary, maxLines = 1)
                                }
                                Text("$dishCount dishes assigned", fontSize = 11.sp, color = TextMuted)
                            }

                            // Reorder Controls
                            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                                IconButton(
                                    onClick = { onReorder(cat.id, cat.order - 1) },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(Icons.Default.ArrowUpward, contentDescription = "Move Up", tint = TextSecondary, modifier = Modifier.size(16.dp))
                                }
                                IconButton(
                                    onClick = { onReorder(cat.id, cat.order + 1) },
                                    modifier = Modifier.size(28.dp)
                                ) {
                                    Icon(Icons.Default.ArrowDownward, contentDescription = "Move Down", tint = TextSecondary, modifier = Modifier.size(16.dp))
                                }
                            }

                            // Active Switch
                            Switch(
                                checked = cat.isActive,
                                onCheckedChange = { onToggleActive(cat.id, cat.isActive) },
                                colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = TerracottaOrange),
                                modifier = Modifier.padding(horizontal = 4.dp)
                            )

                            // Delete Action (With integrity validation)
                            IconButton(
                                onClick = {
                                    if (dishCount > 0) {
                                        deleteWarningMessage = "Cannot delete \"${cat.name}\" because $dishCount menu items are assigned to it. Please reassign or delete those dishes first."
                                    } else {
                                        onDeleteCategory(cat.id)
                                    }
                                },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(Icons.Outlined.Delete, contentDescription = "Delete", tint = ErrorRed, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    // Add Category Dialog
    if (showAddDialog) {
        var catName by remember { mutableStateOf("") }
        var catDesc by remember { mutableStateOf("") }
        var catOrder by remember { mutableStateOf((categories.size + 1).toString()) }

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Add Category", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = catName,
                        onValueChange = { catName = it },
                        label = { Text("Category Name") },
                        placeholder = { Text("e.g. Starters, Tandoor, Desserts") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = catDesc,
                        onValueChange = { catDesc = it },
                        label = { Text("Description") },
                        placeholder = { Text("Brief description of section") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = catOrder,
                        onValueChange = { catOrder = it },
                        label = { Text("Display Order") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (catName.isNotBlank()) {
                            onSaveCategory(catName.trim(), catDesc.trim(), catOrder.toIntOrNull() ?: 1)
                            showAddDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Save Category", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }

    // Dependency Delete Warning Dialog
    if (deleteWarningMessage != null) {
        AlertDialog(
            onDismissRequest = { deleteWarningMessage = null },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = WarningAmber) },
            title = { Text("Category Has Active Items", fontWeight = FontWeight.Bold) },
            text = { Text(deleteWarningMessage ?: "", fontSize = 13.sp, color = TextSecondary) },
            confirmButton = {
                Button(
                    onClick = { deleteWarningMessage = null },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Understood")
                }
            }
        )
    }
}

// ==========================================
// 2. PORTIONS & SIZES TOOL PANEL
// ==========================================
@Composable
private fun PortionsToolPanel(
    items: List<MenuItemRecord>,
    variants: List<MenuVariantRecord>,
    onSaveVariant: (itemId: String, itemName: String, name: String, price: Double) -> Unit,
    onDeleteVariant: (String) -> Unit,
    onToggleAvailability: (variantId: String, currentAvailable: Boolean) -> Unit
) {
    var showAddDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Portions & Sizes", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                Text("Configure Half/Full, Small/Medium/Large variants", fontSize = 11.sp, color = TextSecondary)
            }
            Button(
                onClick = { showAddDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Size", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (variants.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No portion sizes configured yet. Tap \"Add Size\" to link a portion to a dish.", fontSize = 13.sp, color = TextSecondary, textAlign = TextAlign.Center)
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(variants, key = { it.id }) { variant ->
                    OwnerCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    variant.itemName.ifBlank { "Parent Item" },
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = TextPrimary
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = TerracottaOrangeLight
                                    ) {
                                        Text(
                                            text = variant.name,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TerracottaOrange,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        RevenueCalculator.formatPaise(variant.price),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Black,
                                        color = TextPrimary
                                    )
                                }
                            }

                            Switch(
                                checked = variant.isAvailable,
                                onCheckedChange = { onToggleAvailability(variant.id, variant.isAvailable) },
                                colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = TerracottaOrange)
                            )

                            IconButton(
                                onClick = { onDeleteVariant(variant.id) },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(Icons.Outlined.Delete, contentDescription = "Delete", tint = ErrorRed, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    // Add Portion Dialog
    if (showAddDialog) {
        var selectedItem by remember { mutableStateOf(items.firstOrNull()) }
        var portionName by remember { mutableStateOf("Half") }
        var portionPrice by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Add Portion / Size", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Select Target Menu Item", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(items) { itm ->
                            val isSel = selectedItem?.id == itm.id
                            Surface(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { selectedItem = itm },
                                color = if (isSel) TerracottaOrange else SurfaceWhite,
                                border = if (isSel) null else androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = itm.name,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSel) SurfaceWhite else TextSecondary,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }

                    Text("Preset Portion", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        listOf("Half", "Full", "Small", "Regular", "Large").forEach { preset ->
                            val isSel = portionName == preset
                            Surface(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable { portionName = preset },
                                color = if (isSel) TerracottaOrange else SurfaceWhite,
                                border = if (isSel) null else androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = preset,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSel) SurfaceWhite else TextSecondary,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = portionPrice,
                        onValueChange = { portionPrice = it },
                        label = { Text("Portion Price (₹ INR)") },
                        placeholder = { Text("e.g. 180") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val priceNum = portionPrice.toDoubleOrNull()
                        val itm = selectedItem
                        if (itm != null && portionName.isNotBlank() && priceNum != null && priceNum > 0) {
                            onSaveVariant(itm.id, itm.name, portionName.trim(), priceNum)
                            showAddDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Save Portion", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

// ==========================================
// 3. ADD-ONS & MODIFIERS TOOL PANEL
// ==========================================
@Composable
private fun AddonsToolPanel(
    items: List<MenuItemRecord>,
    addons: List<MenuAddonRecord>,
    onSaveAddon: (name: String, price: Double, isGlobal: Boolean, applicableItems: List<String>) -> Unit,
    onDeleteAddon: (String) -> Unit,
    onToggleAvailability: (addonId: String, currentAvailable: Boolean) -> Unit
) {
    var showAddDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Add-ons & Modifiers", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                Text("${addons.size} custom extras configured", fontSize = 11.sp, color = TextSecondary)
            }
            Button(
                onClick = { showAddDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Extra", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (addons.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No add-ons created yet. Tap \"Add Extra\" to configure sauces, toppings, or cheese.", fontSize = 13.sp, color = TextSecondary, textAlign = TextAlign.Center)
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(addons, key = { it.id }) { addon ->
                    OwnerCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(addon.name, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                Spacer(modifier = Modifier.height(2.dp))
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        RevenueCalculator.formatPaise(addon.price),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Black,
                                        color = TerracottaOrange
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = if (addon.isGlobal) InfoBlueLight else SurfaceWhite,
                                        border = androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
                                    ) {
                                        Text(
                                            text = if (addon.isGlobal) "All Dishes" else "${addon.applicableItems.size} dishes",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = if (addon.isGlobal) InfoBlue else TextSecondary,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }

                            Switch(
                                checked = addon.isAvailable,
                                onCheckedChange = { onToggleAvailability(addon.id, addon.isAvailable) },
                                colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = TerracottaOrange)
                            )

                            IconButton(
                                onClick = { onDeleteAddon(addon.id) },
                                modifier = Modifier.size(32.dp)
                            ) {
                                Icon(Icons.Outlined.Delete, contentDescription = "Delete", tint = ErrorRed, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        var addonName by remember { mutableStateOf("") }
        var addonPrice by remember { mutableStateOf("") }
        var isGlobal by remember { mutableStateOf(true) }

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("New Add-on / Modifier", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = addonName,
                        onValueChange = { addonName = it },
                        label = { Text("Add-on Name") },
                        placeholder = { Text("e.g. Extra Cheese, Truffle Dip, Masala Sauce") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = addonPrice,
                        onValueChange = { addonPrice = it },
                        label = { Text("Price (₹ INR)") },
                        placeholder = { Text("e.g. 50") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Apply to all dishes globally?", fontSize = 12.sp, color = TextPrimary)
                        Checkbox(checked = isGlobal, onCheckedChange = { isGlobal = it })
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val priceNum = addonPrice.toDoubleOrNull()
                        if (addonName.isNotBlank() && priceNum != null && priceNum >= 0) {
                            onSaveAddon(addonName.trim(), priceNum, isGlobal, emptyList())
                            showAddDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Save Add-on", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

// ==========================================
// 4. COMBOS & BUNDLES TOOL PANEL
// ==========================================
@Composable
private fun CombosToolPanel(
    items: List<MenuItemRecord>,
    combos: List<MenuComboRecord>,
    onSaveCombo: (name: String, description: String, price: Double, comboItems: List<ComboItemRecord>) -> Unit,
    onDeleteCombo: (String) -> Unit,
    onToggleAvailability: (comboId: String, currentAvailable: Boolean) -> Unit
) {
    var showAddDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("Combos & Bundles", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                Text("${combos.size} meal deals configured", fontSize = 11.sp, color = TextSecondary)
            }
            Button(
                onClick = { showAddDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("New Combo", fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (combos.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No combos yet. Create curated meal deals with bundled prices.", fontSize = 13.sp, color = TextSecondary, textAlign = TextAlign.Center)
            }
        } else {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(combos, key = { it.id }) { combo ->
                    OwnerCard(modifier = Modifier.fillMaxWidth()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(combo.name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                                Text(
                                    RevenueCalculator.formatPaise(combo.price),
                                    fontWeight = FontWeight.Black,
                                    fontSize = 15.sp,
                                    color = TerracottaOrange
                                )
                            }
                            if (combo.description.isNotBlank()) {
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(combo.description, fontSize = 11.sp, color = TextSecondary)
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            // Bundle Items Chips
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                combo.items.forEach { ci ->
                                    Surface(
                                        shape = RoundedCornerShape(6.dp),
                                        color = TerracottaOrangeLight
                                    ) {
                                        Text(
                                            text = "${ci.quantity}x ${ci.itemName.ifBlank { "Dish" }}",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = TerracottaOrange,
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                        )
                                    }
                                }
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Switch(
                                        checked = combo.isAvailable,
                                        onCheckedChange = { onToggleAvailability(combo.id, combo.isAvailable) },
                                        colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = TerracottaOrange)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = if (combo.isAvailable) "In Stock" else "Out of Stock",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (combo.isAvailable) SuccessGreen else ErrorRed
                                    )
                                }
                                IconButton(
                                    onClick = { onDeleteCombo(combo.id) },
                                    modifier = Modifier.size(32.dp)
                                ) {
                                    Icon(Icons.Outlined.Delete, contentDescription = "Delete", tint = ErrorRed, modifier = Modifier.size(18.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddDialog) {
        var comboName by remember { mutableStateOf("") }
        var comboDesc by remember { mutableStateOf("") }
        var comboPrice by remember { mutableStateOf("") }
        val selectedItems = remember { mutableStateListOf<ComboItemRecord>() }

        AlertDialog(
            onDismissRequest = { showAddDialog = false },
            title = { Text("Create Combo Meal", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = comboName,
                        onValueChange = { comboName = it },
                        label = { Text("Combo Name") },
                        placeholder = { Text("e.g. Lunch Feast, Family Combo") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = comboDesc,
                        onValueChange = { comboDesc = it },
                        label = { Text("Description") },
                        placeholder = { Text("Includes 2 curries, naan & rice") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = comboPrice,
                        onValueChange = { comboPrice = it },
                        label = { Text("Bundled Price (₹ INR)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )
                    Text("Select Included Dishes", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(items) { itm ->
                            val isSel = selectedItems.any { it.itemId == itm.id }
                            Surface(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .clickable {
                                        if (isSel) {
                                            selectedItems.removeAll { it.itemId == itm.id }
                                        } else {
                                            selectedItems.add(ComboItemRecord(itemId = itm.id, itemName = itm.name, quantity = 1))
                                        }
                                    },
                                color = if (isSel) TerracottaOrange else SurfaceWhite,
                                border = if (isSel) null else androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = itm.name,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSel) SurfaceWhite else TextSecondary,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val p = comboPrice.toDoubleOrNull()
                        if (comboName.isNotBlank() && p != null && p > 0 && selectedItems.isNotEmpty()) {
                            onSaveCombo(comboName.trim(), comboDesc.trim(), p, selectedItems.toList())
                            showAddDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Create Combo", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

// ==========================================
// 5. MENU ANALYTICS TOOL PANEL
// ==========================================
@Composable
private fun MenuAnalyticsToolPanel(
    items: List<MenuItemRecord>,
    categories: List<CategoryRecord>,
    orders: List<OrderRecord>
) {
    val totalOrdersCount = orders.size
    val totalCompletedOrders = orders.count {
        val s = it.status.uppercase()
        val p = it.paymentStatus.lowercase()
        s == "COMPLETED" || s == "SERVED" || p == "paid"
    }
    val grossMenuSales = orders.sumOf { it.total }

    val totalItems = items.size
    val outOfStockCount = items.count { !it.available }
    val inStockCount = totalItems - outOfStockCount
    val inStockPercent = if (totalItems > 0) Math.round((inStockCount.toDouble() / totalItems) * 100).toInt() else 0

    // Item ordering metrics: count, revenue
    val itemStats = remember(orders, items, categories) {
        val mapCount = mutableMapOf<String, Int>()
        val mapRev = mutableMapOf<String, Double>()
        orders.forEach { o ->
            o.items.forEach { itm ->
                mapCount[itm.name] = (mapCount[itm.name] ?: 0) + itm.quantity
                mapRev[itm.name] = (mapRev[itm.name] ?: 0.0) + (itm.quantity * itm.price)
            }
        }
        items.map { dish ->
            val count = mapCount[dish.name] ?: 0
            val rev = mapRev[dish.name] ?: (count * dish.price)
            dish to (count to rev)
        }
    }

    val mostOrdered = remember(itemStats) {
        itemStats.filter { it.second.first > 0 }.sortedByDescending { it.second.first }.take(5)
    }

    val leastOrdered = remember(itemStats) {
        itemStats.sortedBy { it.second.first }.take(5)
    }

    // Category performance
    val categoryPerformance = remember(itemStats) {
        val catMap = mutableMapOf<String, Pair<Int, Double>>()
        itemStats.forEach { (dish, stats) ->
            val cat = dish.category.ifBlank { "Other" }
            val existing = catMap[cat] ?: (0 to 0.0)
            catMap[cat] = (existing.first + stats.first) to (existing.second + stats.second)
        }
        catMap.entries.map { it.key to it.value }.sortedByDescending { it.second.second }
    }

    val topCategory = categoryPerformance.firstOrNull()

    if (orders.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(Icons.Default.BarChart, contentDescription = null, tint = TextMuted, modifier = Modifier.size(44.dp))
                    Text("No Customer Orders Recorded Yet", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = TextPrimary)
                    Text(
                        "Menu analytics are computed strictly from real customer dining transactions. As diners place orders via table QR or staff POS, dish popularity, revenue per item, and category benchmarks will populate automatically.",
                        fontSize = 11.sp,
                        color = TextSecondary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        lineHeight = 16.sp
                    )
                    Text(
                        "Single Source of Truth: Canonical Firestore Orders Collection · Zero Mock Metrics",
                        fontSize = 10.sp,
                        color = TextMuted
                    )
                }
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Text("Menu Performance Analytics", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
            Text("Real-time telemetry aggregated from confirmed diner tickets", fontSize = 11.sp, color = TextSecondary)
        }

        // Summary KPI Grid (4 Cards matching web)
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OwnerCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Total Orders", fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(totalOrdersCount.toString(), fontSize = 18.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                            Text("$totalCompletedOrders completed", fontSize = 10.sp, color = SuccessGreen, fontWeight = FontWeight.Medium)
                        }
                    }
                    OwnerCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Gross Revenue", fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(RevenueCalculator.formatPaise(grossMenuSales), fontSize = 18.sp, fontWeight = FontWeight.Black, color = TextPrimary)
                            Text("Across all menu sales", fontSize = 10.sp, color = TextSecondary)
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OwnerCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("Top Category", fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(topCategory?.first ?: "N/A", fontSize = 16.sp, fontWeight = FontWeight.Black, color = TextPrimary, maxLines = 1)
                            Text("${RevenueCalculator.formatPaise(topCategory?.second?.second ?: 0.0)} sales", fontSize = 10.sp, color = InfoBlue, fontWeight = FontWeight.Medium)
                        }
                    }
                    OwnerCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text("In-Stock Ratio", fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Bold)
                            Spacer(modifier = Modifier.height(2.dp))
                            Text("$inStockPercent%", fontSize = 18.sp, fontWeight = FontWeight.Black, color = if (inStockPercent >= 80) SuccessGreen else WarningAmber)
                            Text("$outOfStockCount currently sold out", fontSize = 10.sp, color = TextSecondary)
                        }
                    }
                }
            }
        }

        // Most Ordered Dishes
        item {
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.TrendingUp, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Most Ordered Dishes", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    if (mostOrdered.isEmpty()) {
                        Text("No dishes ordered yet.", fontSize = 11.sp, color = TextSecondary)
                    } else {
                        mostOrdered.forEachIndexed { idx, (dish, stats) ->
                            val (count, rev) = stats
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                    Surface(
                                        shape = RoundedCornerShape(4.dp),
                                        color = SuccessGreenLight,
                                        modifier = Modifier.size(20.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text("#${idx + 1}", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column {
                                        Text(dish.name, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                        Text(dish.category, fontSize = 10.sp, color = TextSecondary)
                                    }
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("$count orders", fontSize = 11.sp, fontWeight = FontWeight.Black, color = SuccessGreen)
                                    Text(RevenueCalculator.formatPaise(rev), fontSize = 10.sp, color = TextSecondary)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Least Ordered Dishes
        item {
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.TrendingDown, contentDescription = null, tint = WarningAmber, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Least Ordered Dishes", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    if (leastOrdered.isEmpty()) {
                        Text("No menu items to display.", fontSize = 11.sp, color = TextSecondary)
                    } else {
                        leastOrdered.forEachIndexed { idx, (dish, stats) ->
                            val (count, _) = stats
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                    Surface(
                                        shape = RoundedCornerShape(4.dp),
                                        color = BackgroundLight,
                                        modifier = Modifier.size(20.dp)
                                    ) {
                                        Box(contentAlignment = Alignment.Center) {
                                            Text("#${idx + 1}", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                                        }
                                    }
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Column {
                                        Text(dish.name, fontSize = 12.sp, color = TextPrimary)
                                        Text(dish.category, fontSize = 10.sp, color = TextSecondary)
                                    }
                                }
                                Text("$count orders", fontSize = 11.sp, color = TextSecondary)
                            }
                        }
                    }
                }
            }
        }

        // Sales & Orders by Category
        if (categoryPerformance.isNotEmpty()) {
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Layers, contentDescription = null, tint = InfoBlue, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Sales & Orders by Category", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        categoryPerformance.forEach { (catName, stats) ->
                            val (sold, rev) = stats
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(catName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Text("$sold sold", fontSize = 11.sp, color = TextSecondary)
                                    Text(RevenueCalculator.formatPaise(rev), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ==========================================
// 6. AVAILABILITY TOOL PANEL (Category Grouped)
// ==========================================
@Composable
private fun AvailabilityToolPanel(
    items: List<MenuItemRecord>,
    categories: List<CategoryRecord>,
    onToggleItemAvailability: (itemId: String, currentAvailable: Boolean) -> Unit,
    onToggleCategoryActive: (catId: String, currentActive: Boolean) -> Unit
) {
    var searchKeyword by remember { mutableStateOf("") }

    val distinctCategoryNames = remember(categories, items) {
        val catNamesFromCats = categories.map { it.name }
        val catNamesFromItems = items.map { it.category }.distinct()
        (catNamesFromCats + catNamesFromItems).distinct()
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("Category-Grouped Availability", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
            Text("Control category status and dish-level in-stock availability in real-time.", fontSize = 11.sp, color = TextSecondary)
            Spacer(modifier = Modifier.height(4.dp))
            OutlinedTextField(
                value = searchKeyword,
                onValueChange = { searchKeyword = it },
                placeholder = { Text("Filter dishes across categories...", fontSize = 12.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(16.dp)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(10.dp)
            )
        }

        distinctCategoryNames.forEach { catName ->
            val catRecord = categories.find { it.name.equals(catName, ignoreCase = true) }
            val catItems = items.filter { 
                it.category.equals(catName, ignoreCase = true) && 
                (searchKeyword.isBlank() || it.name.contains(searchKeyword.trim(), ignoreCase = true))
            }

            if (catItems.isNotEmpty() || searchKeyword.isBlank()) {
                item(key = "cat-$catName") {
                    OwnerCard(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            // Category Master Header
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(catName, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                    Text("${catItems.size} dishes configured", fontSize = 10.sp, color = TextSecondary)
                                }
                                if (catRecord != null) {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            if (catRecord.isActive) "Active" else "Hidden",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (catRecord.isActive) SuccessGreen else ErrorRed
                                        )
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Switch(
                                            checked = catRecord.isActive,
                                            onCheckedChange = { onToggleCategoryActive(catRecord.id, catRecord.isActive) },
                                            colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = TerracottaOrange)
                                        )
                                    }
                                }
                            }

                            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = DividerStroke)

                            // Items in this category
                            if (catItems.isEmpty()) {
                                Text("No dishes match filter in this category.", fontSize = 11.sp, color = TextSecondary, modifier = Modifier.padding(vertical = 4.dp))
                            } else {
                                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                    catItems.forEach { item ->
                                        val isVeg = item.type.equals("veg", ignoreCase = true) || item.type.equals("vegan", ignoreCase = true)
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .background(BackgroundLight, RoundedCornerShape(10.dp))
                                                .padding(10.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(
                                                modifier = Modifier.weight(1f),
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                // Veg/Non-veg indicator
                                                Box(
                                                    modifier = Modifier
                                                        .size(12.dp)
                                                        .border(1.dp, if (isVeg) SuccessGreen else ErrorRed, RoundedCornerShape(2.dp)),
                                                    contentAlignment = Alignment.Center
                                                ) {
                                                    Box(
                                                        modifier = Modifier
                                                            .size(5.dp)
                                                            .clip(CircleShape)
                                                            .background(if (isVeg) SuccessGreen else ErrorRed)
                                                    )
                                                }
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Column {
                                                    Text(item.name, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextPrimary)
                                                    Text(RevenueCalculator.formatPaise(item.price), fontSize = 10.sp, color = TextSecondary)
                                                }
                                            }

                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Text(
                                                    text = if (item.available) "In Stock" else "86'd",
                                                    fontSize = 10.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (item.available) SuccessGreen else ErrorRed
                                                )
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Switch(
                                                    checked = item.available,
                                                    onCheckedChange = { onToggleItemAvailability(item.id, item.available) },
                                                    colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = TerracottaOrange)
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
    }
}

// ==========================================
// 7. PRICING TOOL PANEL
// ==========================================
@Composable
private fun PricingToolPanel(
    items: List<MenuItemRecord>,
    onUpdatePrice: (itemId: String, price: Double, discountPrice: Double?) -> Unit
) {
    var editingItem by remember { mutableStateOf<MenuItemRecord?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Text("Pricing & Merchandising", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
            Text("Maintain authoritative price points formatted in Indian Rupees (₹ INR).", fontSize = 11.sp, color = TextSecondary)
            Spacer(modifier = Modifier.height(4.dp))
        }

        items(items, key = { it.id }) { item ->
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(item.name, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                            if (item.isBestSeller) {
                                Spacer(modifier = Modifier.width(4.dp))
                                Surface(shape = RoundedCornerShape(4.dp), color = TerracottaOrangeLight) {
                                    Text("Bestseller", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = TerracottaOrange, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                                }
                            }
                            if (item.isRecommended) {
                                Spacer(modifier = Modifier.width(4.dp))
                                Surface(shape = RoundedCornerShape(4.dp), color = WarningAmberLight) {
                                    Text("Chef Pick", fontSize = 8.sp, fontWeight = FontWeight.Bold, color = WarningAmber, modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp))
                                }
                            }
                        }
                        Text(item.category, fontSize = 11.sp, color = TextSecondary)
                        Spacer(modifier = Modifier.height(2.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                RevenueCalculator.formatPaise(item.price),
                                fontWeight = FontWeight.Black,
                                fontSize = 14.sp,
                                color = TextPrimary
                            )
                            if (item.discountPrice != null && item.discountPrice > 0) {
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    "Sale: ${RevenueCalculator.formatPaise(item.discountPrice)}",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SuccessGreen
                                )
                            }
                        }
                    }

                    Button(
                        onClick = { editingItem = item },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Outlined.Edit, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Edit Price", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // Edit Price Modal
    if (editingItem != null) {
        val item = editingItem!!
        val initBase = if (item.price > 0) {
            val r = item.price / 100.0
            if (r % 1.0 == 0.0) r.toLong().toString() else "%.2f".format(java.util.Locale.US, r)
        } else ""
        val initDisc = if (item.discountPrice != null && item.discountPrice > 0) {
            val r = item.discountPrice / 100.0
            if (r % 1.0 == 0.0) r.toLong().toString() else "%.2f".format(java.util.Locale.US, r)
        } else ""
        var basePriceStr by remember { mutableStateOf(initBase) }
        var discountPriceStr by remember { mutableStateOf(initDisc) }
        var errorMsg by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { editingItem = null },
            title = { Text("Update Price: ${item.name}", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = basePriceStr,
                        onValueChange = {
                            basePriceStr = it
                            errorMsg = null
                        },
                        label = { Text("Base Price (₹ INR) *") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = discountPriceStr,
                        onValueChange = {
                            discountPriceStr = it
                            errorMsg = null
                        },
                        label = { Text("Discount / Sale Price (Optional)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (errorMsg != null) {
                        Text(errorMsg ?: "", color = ErrorRed, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val base = basePriceStr.toDoubleOrNull()
                        val disc = if (discountPriceStr.isNotBlank()) discountPriceStr.toDoubleOrNull() else null

                        if (base == null || base <= 0) {
                            errorMsg = "Base price must be a valid number greater than zero."
                            return@Button
                        }
                        if (disc != null && disc >= base) {
                            errorMsg = "Discount price must be less than base price."
                            return@Button
                        }

                        val basePaise = Math.round(base * 100).toDouble()
                        val discPaise = disc?.let { Math.round(it * 100).toDouble() }
                        onUpdatePrice(item.id, basePaise, discPaise)
                        editingItem = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Save Price", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { editingItem = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

// ==========================================
// 8. MENU PREVIEW TOOL PANEL (Category-wise 2-Column Grid)
// ==========================================
@Composable
private fun MenuPreviewToolPanel(
    items: List<MenuItemRecord>,
    categories: List<CategoryRecord>,
    restaurantName: String
) {
    var selectedCat by remember { mutableStateOf("ALL") }
    var previewCartCount by remember { mutableStateOf(0) }
    var previewMessage by remember { mutableStateOf<String?>(null) }

    val distinctCategoryNames = remember(categories, items) {
        val catNamesFromCats = categories.map { it.name }
        val catNamesFromItems = items.map { it.category }.distinct()
        listOf("ALL") + (catNamesFromCats + catNamesFromItems).distinct()
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Warning Banner
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = WarningAmberLight,
                border = androidx.compose.foundation.BorderStroke(1.dp, WarningAmber)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Visibility, contentDescription = null, tint = WarningAmber, modifier = Modifier.size(24.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("CUSTOMER 2-COLUMN MENU PREVIEW", fontWeight = FontWeight.Black, fontSize = 12.sp, color = TextPrimary)
                        Text("Category-organized 2-column card layout matching mobile viewports.", fontSize = 11.sp, color = TextSecondary)
                    }
                }
            }
        }

        // Customer Header
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(restaurantName, fontWeight = FontWeight.Black, fontSize = 18.sp, color = TextPrimary)
                Text("Digital Dining Experience", fontSize = 12.sp, color = TextSecondary)
                if (previewCartCount > 0) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = SuccessGreenLight
                    ) {
                        Text(
                            text = "$previewCartCount simulated items in guest tray",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = SuccessGreen,
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                        )
                    }
                }
            }
        }

        // Category Filter Pills
        item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                items(distinctCategoryNames) { cat ->
                    val isSel = selectedCat == cat
                    Surface(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .clickable { selectedCat = cat },
                        color = if (isSel) TerracottaOrange else SurfaceWhite,
                        border = if (isSel) null else androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Text(
                            text = cat,
                            fontSize = 11.sp,
                            fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSel) SurfaceWhite else TextSecondary,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }
            }
        }

        // Category-wise sections with 2-column card grid
        val activeCategoriesToRender = if (selectedCat == "ALL") {
            distinctCategoryNames.filter { it != "ALL" }
        } else {
            listOf(selectedCat)
        }

        activeCategoriesToRender.forEach { catName ->
            val catObj = categories.find { it.name.equals(catName, ignoreCase = true) }
            val catItems = items.filter { 
                it.category.equals(catName, ignoreCase = true) && 
                it.available && 
                it.isPublished 
            }

            if (catItems.isNotEmpty()) {
                item(key = "hdr-$catName") {
                    Column(modifier = Modifier.padding(top = 10.dp, bottom = 4.dp)) {
                        Text(catName, fontWeight = FontWeight.Black, fontSize = 15.sp, color = TextPrimary)
                        if (catObj?.description?.isNotBlank() == true) {
                            Text(catObj.description, fontSize = 11.sp, color = TextSecondary)
                        }
                    }
                }

                // 2-column grid chunked
                val pairs = catItems.chunked(2)
                pairs.forEachIndexed { pIdx, pair ->
                    item(key = "grid-$catName-$pIdx") {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            pair.forEach { dish ->
                                Box(modifier = Modifier.weight(1f)) {
                                    Preview2ColDishCard(
                                        item = dish,
                                        onAdd = {
                                            previewCartCount++
                                            previewMessage = "Added ${dish.name} to guest tray (Simulation Mode)"
                                        }
                                    )
                                }
                            }
                            if (pair.size == 1) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
            }
        }
    }

    if (previewMessage != null) {
        AlertDialog(
            onDismissRequest = { previewMessage = null },
            icon = { Icon(Icons.Default.Info, contentDescription = null, tint = InfoBlue) },
            title = { Text("Customer Preview Action", fontWeight = FontWeight.Bold) },
            text = { Text(previewMessage ?: "", fontSize = 13.sp, color = TextSecondary) },
            confirmButton = {
                Button(
                    onClick = { previewMessage = null },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("OK")
                }
            }
        )
    }
}

@Composable
private fun Preview2ColDishCard(
    item: MenuItemRecord,
    onAdd: () -> Unit
) {
    val isVeg = item.type.equals("veg", ignoreCase = true) || item.type.equals("vegan", ignoreCase = true)

    OwnerCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Food Image with aspect ratio
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(96.dp)
                    .background(BackgroundLight),
                contentAlignment = Alignment.Center
            ) {
                if (item.image.isNotBlank()) {
                    AsyncImage(
                        model = item.image,
                        contentDescription = item.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        Icons.Outlined.RestaurantMenu,
                        contentDescription = null,
                        tint = TextSecondary,
                        modifier = Modifier.size(32.dp)
                    )
                }

                // Dietary Tag
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(6.dp)
                        .size(14.dp)
                        .background(SurfaceWhite, RoundedCornerShape(3.dp))
                        .border(1.dp, if (isVeg) SuccessGreen else ErrorRed, RoundedCornerShape(3.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(if (isVeg) SuccessGreen else ErrorRed)
                    )
                }

                // Badges
                if (item.isBestSeller) {
                    Surface(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp),
                        shape = RoundedCornerShape(4.dp),
                        color = TerracottaOrange
                    ) {
                        Text(
                            "Best",
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Bold,
                            color = SurfaceWhite,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                        )
                    }
                }
            }

            // Details
            Column(modifier = Modifier.padding(8.dp)) {
                Text(
                    text = item.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = TextPrimary,
                    maxLines = 1
                )
                if (item.description.isNotBlank()) {
                    Text(
                        text = item.description,
                        fontSize = 10.sp,
                        color = TextSecondary,
                        maxLines = 2,
                        lineHeight = 13.sp
                    )
                }

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = RevenueCalculator.formatPaise(item.price),
                            fontWeight = FontWeight.Black,
                            fontSize = 12.sp,
                            color = TextPrimary
                        )
                        if (item.discountPrice != null && item.discountPrice > 0) {
                            Text(
                                text = RevenueCalculator.formatPaise(item.discountPrice),
                                fontSize = 9.sp,
                                color = SuccessGreen,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    Button(
                        onClick = onAdd,
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                        shape = RoundedCornerShape(6.dp),
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text("+ Add", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
