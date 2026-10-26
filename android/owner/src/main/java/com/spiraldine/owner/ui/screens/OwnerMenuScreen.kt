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
import com.spiraldine.owner.data.model.CategoryRecord
import com.spiraldine.owner.data.model.MenuItemRecord
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun OwnerMenuScreen(
    items: List<MenuItemRecord>,
    categories: List<CategoryRecord> = emptyList(),
    restaurantName: String = "SpiralDine Bistro",
    branchName: String = "Main Dining",
    onAddItemClick: () -> Unit,
    onEditItemClick: (String) -> Unit,
    onDuplicateItem: ((MenuItemRecord) -> Unit)? = null,
    onDeleteItem: ((String) -> Unit)? = null,
    onToggleAvailability: (String, Boolean) -> Unit,
    onTogglePublished: ((String, Boolean) -> Unit)? = null,
    onCategoriesClick: () -> Unit,
    onMenuToolsClick: () -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("ALL") }
    var vegFilter by remember { mutableStateOf("ALL") } // "ALL", "VEG", "NON_VEG"
    var stockFilter by remember { mutableStateOf("ALL") } // "ALL", "IN_STOCK", "OUT_OF_STOCK"
    var publishFilter by remember { mutableStateOf("ALL") } // "ALL", "PUBLISHED", "DRAFT"
    var sortBy by remember { mutableStateOf("name") } // "name", "price_asc", "price_desc"
    var showFilterSheet by remember { mutableStateOf(false) }

    // Deletion confirmation dialog
    var itemToDelete by remember { mutableStateOf<MenuItemRecord?>(null) }

    // Available categories (from passed categories or derived from items)
    val categoryList = remember(categories, items) {
        val names = if (categories.isNotEmpty()) {
            categories.map { it.name }
        } else {
            items.map { it.category }.distinct()
        }
        listOf("ALL") + names.distinct()
    }

    // Filtered & sorted items
    val filteredItems = remember(items, searchQuery, selectedCategory, vegFilter, stockFilter, publishFilter, sortBy) {
        var result = items.filter { item ->
            val matchesCat = selectedCategory == "ALL" || item.category.equals(selectedCategory, ignoreCase = true)
            val q = searchQuery.trim().lowercase()
            val matchesSearch = q.isEmpty() || item.name.lowercase().contains(q) || item.description.lowercase().contains(q)
            
            val matchesVeg = when (vegFilter) {
                "VEG" -> item.type.equals("veg", ignoreCase = true)
                "NON_VEG" -> !item.type.equals("veg", ignoreCase = true)
                else -> true
            }

            val matchesStock = when (stockFilter) {
                "IN_STOCK" -> item.available
                "OUT_OF_STOCK" -> !item.available
                else -> true
            }

            val matchesPublish = when (publishFilter) {
                "PUBLISHED" -> item.isPublished
                "DRAFT" -> !item.isPublished
                else -> true
            }

            matchesCat && matchesSearch && matchesVeg && matchesStock && matchesPublish
        }

        result = when (sortBy) {
            "price_asc" -> result.sortedBy { it.price }
            "price_desc" -> result.sortedByDescending { it.price }
            else -> result.sortedBy { it.name.lowercase() }
        }

        result
    }

    val hasActiveFilters = searchQuery.isNotBlank() || selectedCategory != "ALL" || vegFilter != "ALL" || stockFilter != "ALL" || publishFilter != "ALL" || sortBy != "name"

    fun resetFilters() {
        searchQuery = ""
        selectedCategory = "ALL"
        vegFilter = "ALL"
        stockFilter = "ALL"
        publishFilter = "ALL"
        sortBy = "name"
    }

    Scaffold(
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceWhite)
                    .padding(top = 8.dp)
            ) {
                // Restaurant & Branch Subheader
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = restaurantName,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = TerracottaOrange,
                            letterSpacing = 0.5.sp
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Outlined.Storefront,
                                contentDescription = null,
                                tint = TextSecondary,
                                modifier = Modifier.size(12.dp)
                            )
                            Spacer(modifier = Modifier.width(3.dp))
                            Text(
                                text = branchName,
                                fontSize = 11.sp,
                                color = TextSecondary,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    // Navigation Action Buttons: Tools & Categories
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        // Menu Tools Button
                        Button(
                            onClick = onMenuToolsClick,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = SurfaceWhite,
                                contentColor = TerracottaOrange
                            ),
                            border = androidx.compose.foundation.BorderStroke(1.dp, TerracottaOrange),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp),
                            modifier = Modifier.height(34.dp)
                        ) {
                            Icon(Icons.Outlined.Tune, contentDescription = "Menu Tools", modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Menu Tools", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }

                        // Add Item Button
                        Button(
                            onClick = onAddItemClick,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = TerracottaOrange,
                                contentColor = SurfaceWhite
                            ),
                            shape = RoundedCornerShape(10.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            modifier = Modifier.height(34.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Add Item", modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Add Item", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Title Row
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "Menu Engine",
                            fontWeight = FontWeight.Black,
                            fontSize = 20.sp,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = TerracottaOrangeLight,
                            modifier = Modifier.padding(top = 2.dp)
                        ) {
                            Text(
                                text = "${items.size} dishes",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = TerracottaOrange,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }

                    // Quick categories button
                    IconButton(
                        onClick = onCategoriesClick,
                        modifier = Modifier.size(36.dp)
                    ) {
                        Icon(Icons.Outlined.Folder, contentDescription = "Manage Categories", tint = TextPrimary)
                    }
                }

                // Search Bar & Filter trigger
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        placeholder = { Text("Search catalog by dish or recipe...", fontSize = 12.sp, color = TextMuted) },
                        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp)) },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { searchQuery = "" }) {
                                    Icon(Icons.Default.Close, contentDescription = "Clear", tint = TextMuted, modifier = Modifier.size(16.dp))
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = TerracottaOrange,
                            unfocusedBorderColor = BorderLight,
                            unfocusedContainerColor = SurfaceWhite,
                            focusedContainerColor = SurfaceWhite
                        )
                    )

                    // Filter sheet trigger button
                    IconButton(
                        onClick = { showFilterSheet = true },
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (hasActiveFilters) TerracottaOrangeLight else SurfaceWhite)
                            .border(1.dp, if (hasActiveFilters) TerracottaOrange else BorderLight, RoundedCornerShape(12.dp))
                    ) {
                        Icon(
                            Icons.Default.FilterList,
                            contentDescription = "Filters",
                            tint = if (hasActiveFilters) TerracottaOrange else TextSecondary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // Category Chips Row
                LazyRow(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(categoryList) { cat ->
                        val isSelected = selectedCategory.equals(cat, ignoreCase = true)
                        Surface(
                            modifier = Modifier
                                .clip(RoundedCornerShape(16.dp))
                                .clickable { selectedCategory = cat },
                            color = if (isSelected) TerracottaOrange else SurfaceWhite,
                            shape = RoundedCornerShape(16.dp),
                            border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
                        ) {
                            Text(
                                text = cat,
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) SurfaceWhite else TextSecondary,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            )
                        }
                    }
                }

                // Active Filters Banner with Clear action
                if (hasActiveFilters) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Showing ${filteredItems.size} of ${items.size} items",
                            fontSize = 11.sp,
                            color = TextSecondary,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = "Reset Filters",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = TerracottaOrange,
                            modifier = Modifier.clickable { resetFilters() }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))
                HorizontalDivider(color = BorderLight, thickness = 1.dp)
            }
        },
        containerColor = BackgroundLight
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (filteredItems.isEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        Icons.Outlined.RestaurantMenu,
                        contentDescription = null,
                        tint = TextMuted,
                        modifier = Modifier.size(56.dp)
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        if (items.isEmpty()) "Your menu is empty" else "No matching dishes found",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        if (items.isEmpty()) "Start building your digital menu by adding categories and dishes."
                        else "Try adjusting your search keywords, category, or dietary filters.",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        modifier = Modifier.padding(horizontal = 16.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(18.dp))
                    if (items.isEmpty()) {
                        Button(
                            onClick = onAddItemClick,
                            colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Add First Item", fontWeight = FontWeight.Bold)
                        }
                    } else {
                        OutlinedButton(
                            onClick = { resetFilters() },
                            border = androidx.compose.foundation.BorderStroke(1.dp, TerracottaOrange)
                        ) {
                            Text("Clear Filters", color = TerracottaOrange, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(top = 10.dp, bottom = 24.dp)
                ) {
                    items(filteredItems, key = { it.id }) { item ->
                        OwnerMenuItemCard(
                            item = item,
                            onEdit = { onEditItemClick(item.id) },
                            onDuplicate = { onDuplicateItem?.invoke(item) },
                            onDelete = { itemToDelete = item },
                            onToggleAvailability = { onToggleAvailability(item.id, item.available) },
                            onTogglePublished = { onTogglePublished?.invoke(item.id, item.isPublished) }
                        )
                    }
                }
            }
        }
    }

    // Filter Bottom Sheet Dialog
    if (showFilterSheet) {
        AlertDialog(
            onDismissRequest = { showFilterSheet = false },
            title = {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Filter & Sort Menu", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    TextButton(onClick = { resetFilters() }) {
                        Text("Reset", color = TerracottaOrange, fontSize = 12.sp)
                    }
                }
            },
            text = {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Dietary filter
                    Text("Dietary Classification", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterSelectChip("All", vegFilter == "ALL") { vegFilter = "ALL" }
                        FilterSelectChip("Vegetarian", vegFilter == "VEG") { vegFilter = "VEG" }
                        FilterSelectChip("Non-Veg", vegFilter == "NON_VEG") { vegFilter = "NON_VEG" }
                    }

                    // Stock availability
                    Text("Stock Availability", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterSelectChip("All", stockFilter == "ALL") { stockFilter = "ALL" }
                        FilterSelectChip("In Stock", stockFilter == "IN_STOCK") { stockFilter = "IN_STOCK" }
                        FilterSelectChip("Out of Stock", stockFilter == "OUT_OF_STOCK") { stockFilter = "OUT_OF_STOCK" }
                    }

                    // Published status
                    Text("Publication Status", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterSelectChip("All", publishFilter == "ALL") { publishFilter = "ALL" }
                        FilterSelectChip("Published", publishFilter == "PUBLISHED") { publishFilter = "PUBLISHED" }
                        FilterSelectChip("Draft", publishFilter == "DRAFT") { publishFilter = "DRAFT" }
                    }

                    // Sort By
                    Text("Sort By", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        FilterSelectChip("Name", sortBy == "name") { sortBy = "name" }
                        FilterSelectChip("Price: Low", sortBy == "price_asc") { sortBy = "price_asc" }
                        FilterSelectChip("Price: High", sortBy == "price_desc") { sortBy = "price_desc" }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { showFilterSheet = false },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                ) {
                    Text("Apply Filters", fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    // Delete confirmation dialog
    if (itemToDelete != null) {
        val item = itemToDelete!!
        AlertDialog(
            onDismissRequest = { itemToDelete = null },
            icon = { Icon(Icons.Default.Warning, contentDescription = null, tint = ErrorRed) },
            title = { Text("Delete Menu Item?", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "Are you sure you want to permanently delete \"${item.name}\"? This action will remove it from the customer menu immediately.",
                    fontSize = 13.sp,
                    color = TextSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        onDeleteItem?.invoke(item.id)
                        itemToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = ErrorRed)
                ) {
                    Text("Delete Dish", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { itemToDelete = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

@Composable
private fun FilterSelectChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() },
        color = if (isSelected) TerracottaOrange else SurfaceWhite,
        border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, BorderLight),
        shape = RoundedCornerShape(12.dp)
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) SurfaceWhite else TextSecondary,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun OwnerMenuItemCard(
    item: MenuItemRecord,
    onEdit: () -> Unit,
    onDuplicate: () -> Unit,
    onDelete: () -> Unit,
    onToggleAvailability: () -> Unit,
    onTogglePublished: () -> Unit
) {
    val isVeg = item.type.equals("veg", ignoreCase = true)

    OwnerCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onEdit
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            // Top row: Image/Icon, Main Details, Stock Toggle
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                // Dish thumbnail / icon
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (isVeg) SuccessGreenLight else TerracottaOrangeLight),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Restaurant,
                        contentDescription = null,
                        tint = if (isVeg) SuccessGreen else TerracottaOrange,
                        modifier = Modifier.size(26.dp)
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Details column
                Column(modifier = Modifier.weight(1f)) {
                    // Veg indicator + Name
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Square Veg / Non-Veg dot badge
                        Box(
                            modifier = Modifier
                                .size(14.dp)
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
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = item.name,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }

                    // Category & Prep time
                    Spacer(modifier = Modifier.height(2.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = item.category,
                            fontSize = 11.sp,
                            color = TextSecondary,
                            fontWeight = FontWeight.Medium
                        )
                        if (item.prepTime > 0) {
                            Text(" • ", fontSize = 11.sp, color = TextMuted)
                            Icon(Icons.Outlined.Timer, contentDescription = null, tint = TextMuted, modifier = Modifier.size(11.dp))
                            Spacer(modifier = Modifier.width(2.dp))
                            Text("${item.prepTime} min", fontSize = 11.sp, color = TextMuted)
                        }
                    }

                    // Description
                    if (item.description.isNotBlank()) {
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(
                            text = item.description,
                            fontSize = 11.sp,
                            color = TextSecondary,
                            maxLines = 2,
                            lineHeight = 14.sp
                        )
                    }

                    // Badges (Bestseller, Recommended, Published status, Batch info)
                    Spacer(modifier = Modifier.height(6.dp))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        if (item.isBestSeller) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = TerracottaOrangeLight
                            ) {
                                Text(
                                    text = "★ BESTSELLER",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Black,
                                    maxLines = 1,
                                    softWrap = false,
                                    color = TerracottaOrange,
                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                                )
                            }
                        }
                        if (item.isRecommended) {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = InfoBlueLight
                            ) {
                                Text(
                                    text = "RECOMMENDED",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    softWrap = false,
                                    color = InfoBlue,
                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                                )
                            }
                        }
                        // Published status badge
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = if (item.isPublished) SuccessGreenLight else WarningAmberLight,
                            modifier = Modifier.clickable { onTogglePublished() }
                        ) {
                            Text(
                                text = if (item.isPublished) "PUBLISHED" else "DRAFT",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                softWrap = false,
                                color = if (item.isPublished) SuccessGreen else WarningAmber,
                                modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                            )
                        }
                        if (item.productionMode == "Batch Production") {
                            Surface(
                                shape = RoundedCornerShape(6.dp),
                                color = if (item.availableServings <= item.lowStockThreshold) ErrorRedLight else InfoBlueLight
                            ) {
                                Text(
                                    text = "BATCH: ${item.availableServings}/${item.defaultBatchSize}",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1,
                                    softWrap = false,
                                    color = if (item.availableServings <= item.lowStockThreshold) ErrorRed else InfoBlue,
                                    modifier = Modifier.padding(horizontal = 5.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Availability switch
                Column(horizontalAlignment = Alignment.End) {
                    Switch(
                        checked = item.available,
                        onCheckedChange = { onToggleAvailability() },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = SurfaceWhite,
                            checkedTrackColor = TerracottaOrange,
                            uncheckedThumbColor = SurfaceWhite,
                            uncheckedTrackColor = BorderLight
                        )
                    )
                    Text(
                        text = if (item.available) "In Stock" else "Out of Stock",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (item.available) SuccessGreen else ErrorRed
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = BorderLight.copy(alpha = 0.5f), thickness = 0.8.dp)
            Spacer(modifier = Modifier.height(8.dp))

            // Bottom action row: Price & Quick Action Buttons (Edit, Duplicate, Delete)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Price display with discount support
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (item.discountPrice != null && item.discountPrice > 0 && item.discountPrice < item.price) {
                        Text(
                            text = RevenueCalculator.formatPaise(item.discountPrice),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            color = SuccessGreen
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = RevenueCalculator.formatPaise(item.price),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Normal,
                            color = TextSecondary,
                            style = androidx.compose.ui.text.TextStyle(textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough)
                        )
                    } else {
                        Text(
                            text = RevenueCalculator.formatPaise(item.price),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Black,
                            color = TextPrimary
                        )
                    }
                }

                // Action buttons: Duplicate, Edit, Delete
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(
                        onClick = onDuplicate,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Outlined.ContentCopy,
                            contentDescription = "Duplicate item",
                            tint = TextSecondary,
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    IconButton(
                        onClick = onEdit,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Outlined.Edit,
                            contentDescription = "Edit item",
                            tint = TerracottaOrange,
                            modifier = Modifier.size(16.dp)
                        )
                    }

                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Outlined.Delete,
                            contentDescription = "Delete item",
                            tint = ErrorRed,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}
