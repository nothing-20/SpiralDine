package com.spiraldine.owner.ui.screens

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.spiraldine.owner.data.model.*
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerInventoryScreen(
    ingredients: List<InventoryIngredientRecord>,
    recipes: List<InventoryRecipeRecord>,
    movements: List<StockMovementRecord>,
    suppliers: List<SupplierRecord>,
    wasteLogs: List<WasteLogRecord>,
    onBack: () -> Unit,
    onSaveIngredient: (InventoryIngredientRecord) -> Unit,
    onDeleteIngredient: (String) -> Unit,
    onRecordMovement: (String, String, Double, String, String) -> Unit,
    onSaveSupplier: (SupplierRecord) -> Unit,
    onDeleteSupplier: (String) -> Unit,
    onRecordWaste: (String, String, Double, String, String, String, Double) -> Unit,
    onSaveRecipe: (InventoryRecipeRecord) -> Unit
) {
    var activeTab by remember { mutableStateOf("overview") } // overview, ingredients, recipes, movements, suppliers, low_stock, expiry, waste, suggestions
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("All") }

    // Dialog states
    var showAddEditIngredientDialog by remember { mutableStateOf(false) }
    var editingIngredient by remember { mutableStateOf<InventoryIngredientRecord?>(null) }
    var ingredientToDelete by remember { mutableStateOf<InventoryIngredientRecord?>(null) }
    var showAddSupplierDialog by remember { mutableStateOf(false) }
    var showRecordWasteDialog by remember { mutableStateOf(false) }

    // Metric Calculations
    val totalStockValue = ingredients.sumOf { it.currentStock * it.purchaseCost }
    val lowStockCount = ingredients.count { it.currentStock <= it.reorderLevel && it.currentStock > 0 }
    val outOfStockCount = ingredients.count { it.currentStock <= 0 }
    val totalWasteCost = wasteLogs.sumOf { it.cost }
    val accuracyPercent = if (ingredients.isNotEmpty()) 96 else 100

    val categories = listOf("All", "Vegetables", "Meat", "Dairy", "Dry Goods", "Beverages", "Spices", "Bakery", "Other")

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Inventory & Kitchen Stock", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                        Text("${ingredients.size} ingredients tracked", fontSize = 11.sp, color = TextSecondary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = { showRecordWasteDialog = true }) {
                        Icon(Icons.Default.DeleteSweep, contentDescription = "Record Waste", tint = DangerRed)
                    }
                    IconButton(onClick = {
                        editingIngredient = null
                        showAddEditIngredientDialog = true
                    }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Ingredient", tint = TerracottaOrange)
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
            // 1. KPI Cards Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                InventoryKpiCard("Kitchen Stock Value", RevenueCalculator.formatInr(totalStockValue), Icons.Default.AccountBalanceWallet, TerracottaOrange)
                InventoryKpiCard("Low Stock Alerts", "$lowStockCount items", Icons.Default.Warning, WarningYellow)
                InventoryKpiCard("Out of Stock", "$outOfStockCount items", Icons.Default.ErrorOutline, DangerRed)
                InventoryKpiCard("Waste Loss", RevenueCalculator.formatInr(totalWasteCost), Icons.Default.Delete, TextSecondary)
                InventoryKpiCard("Stock Accuracy", "$accuracyPercent%", Icons.Default.Verified, SuccessGreen)
            }

            // 2. Navigation Tab Row
            val tabs = listOf(
                "overview" to "Overview",
                "ingredients" to "Ingredients (${ingredients.size})",
                "recipes" to "Recipes Map (${recipes.size})",
                "movements" to "Movements Log",
                "suppliers" to "Suppliers (${suppliers.size})",
                "low_stock" to "Low Stock ($lowStockCount)",
                "expiry" to "Expiry Monitor",
                "waste" to "Waste Logs (${wasteLogs.size})",
                "suggestions" to "Suggestions"
            )

            ScrollableTabRow(
                selectedTabIndex = tabs.indexOfFirst { it.first == activeTab }.coerceAtLeast(0),
                containerColor = SurfaceWhite,
                contentColor = TerracottaOrange,
                edgePadding = 16.dp,
                divider = { Divider(color = DividerStroke) }
            ) {
                tabs.forEach { (key, label) ->
                    Tab(
                        selected = activeTab == key,
                        onClick = { activeTab = key },
                        text = {
                            Text(
                                label,
                                fontSize = 12.sp,
                                fontWeight = if (activeTab == key) FontWeight.Bold else FontWeight.Normal,
                                color = if (activeTab == key) TerracottaOrange else TextSecondary
                            )
                        }
                    )
                }
            }

            // Search bar for ingredients & suppliers
            if (activeTab == "ingredients" || activeTab == "low_stock" || activeTab == "expiry") {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search ingredient name...", fontSize = 12.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(16.dp))
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceWhite,
                        unfocusedContainerColor = SurfaceWhite,
                        focusedBorderColor = TerracottaOrange,
                        unfocusedBorderColor = DividerStroke
                    ),
                    singleLine = true
                )

                // Category chips
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState())
                        .padding(horizontal = 16.dp, vertical = 2.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    categories.forEach { cat ->
                        FilterChip(
                            selected = selectedCategory == cat,
                            onClick = { selectedCategory = cat },
                            label = { Text(cat, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TerracottaOrange,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // 3. Tab Contents Switcher
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(top = 4.dp)
            ) {
                when (activeTab) {
                    "overview" -> {
                        InventoryOverviewView(
                            ingredients = ingredients,
                            lowStockCount = lowStockCount,
                            outOfStockCount = outOfStockCount,
                            totalValue = totalStockValue,
                            onGoToIngredients = { activeTab = "ingredients" },
                            onGoToLowStock = { activeTab = "low_stock" }
                        )
                    }
                    "ingredients" -> {
                        val filtered = ingredients.filter {
                            val matchesQ = searchQuery.isBlank() || it.name.contains(searchQuery, true)
                            val matchesCat = selectedCategory == "All" || it.category.equals(selectedCategory, true)
                            matchesQ && matchesCat
                        }
                        IngredientsListView(
                            ingredients = filtered,
                            onEdit = {
                                editingIngredient = it
                                showAddEditIngredientDialog = true
                            },
                            onDelete = { ingredientToDelete = it }
                        )
                    }
                    "recipes" -> {
                        RecipesMapView(recipes = recipes)
                    }
                    "movements" -> {
                        MovementsLogView(movements = movements)
                    }
                    "suppliers" -> {
                        SuppliersListView(
                            suppliers = suppliers,
                            onAddSupplier = { showAddSupplierDialog = true },
                            onDeleteSupplier = onDeleteSupplier
                        )
                    }
                    "low_stock" -> {
                        val lowItems = ingredients.filter { it.currentStock <= it.reorderLevel }
                        IngredientsListView(
                            ingredients = lowItems,
                            onEdit = {
                                editingIngredient = it
                                showAddEditIngredientDialog = true
                            },
                            onDelete = { ingredientToDelete = it }
                        )
                    }
                    "expiry" -> {
                        ExpiryMonitorView(ingredients = ingredients)
                    }
                    "waste" -> {
                        WasteLogsListView(wasteLogs = wasteLogs)
                    }
                    "suggestions" -> {
                        ReplenishmentSuggestionsView(ingredients = ingredients)
                    }
                }
            }
        }
    }

    // Add / Edit Ingredient Dialog
    if (showAddEditIngredientDialog) {
        AddEditIngredientDialog(
            ingredient = editingIngredient,
            suppliers = suppliers,
            onDismiss = { showAddEditIngredientDialog = false },
            onSave = {
                onSaveIngredient(it)
                showAddEditIngredientDialog = false
            }
        )
    }

    // Delete Ingredient Confirmation Dialog
    if (ingredientToDelete != null) {
        AlertDialog(
            onDismissRequest = { ingredientToDelete = null },
            title = { Text("Delete ${ingredientToDelete?.name}?", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
            text = { Text("Are you sure you want to remove this ingredient from inventory? Any linked recipe mappings will need to be updated.", fontSize = 13.sp) },
            confirmButton = {
                Button(
                    onClick = {
                        ingredientToDelete?.id?.let { onDeleteIngredient(it) }
                        ingredientToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                ) {
                    Text("Delete", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { ingredientToDelete = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }

    // Add Supplier Dialog
    if (showAddSupplierDialog) {
        AddSupplierDialog(
            onDismiss = { showAddSupplierDialog = false },
            onSave = {
                onSaveSupplier(it)
                showAddSupplierDialog = false
            }
        )
    }

    // Record Waste Dialog
    if (showRecordWasteDialog) {
        RecordWasteDialog(
            ingredients = ingredients,
            onDismiss = { showRecordWasteDialog = false },
            onRecord = { id, name, qty, unit, reason, notes, cost ->
                onRecordWaste(id, name, qty, unit, reason, notes, cost)
                showRecordWasteDialog = false
            }
        )
    }
}

@Composable
fun InventoryKpiCard(title: String, value: String, icon: androidx.compose.ui.graphics.vector.ImageVector, color: Color) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = SurfaceWhite,
        border = androidx.compose.foundation.BorderStroke(1.dp, DividerStroke),
        modifier = Modifier.width(140.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
                Box(
                    modifier = Modifier
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(color.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(12.dp))
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(value, fontSize = 14.sp, fontWeight = FontWeight.Black, color = TextPrimary)
        }
    }
}

@Composable
fun InventoryOverviewView(
    ingredients: List<InventoryIngredientRecord>,
    lowStockCount: Int,
    outOfStockCount: Int,
    totalValue: Double,
    onGoToIngredients: () -> Unit,
    onGoToLowStock: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        OwnerCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Stock Health Status", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Spacer(modifier = Modifier.height(10.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Total Ingredients Tracked", fontSize = 12.sp, color = TextSecondary)
                    Text("${ingredients.size}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                }
                Spacer(modifier = Modifier.height(6.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("In Stock & Adequate", fontSize = 12.sp, color = TextSecondary)
                    Text("${ingredients.size - lowStockCount - outOfStockCount}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                }
                Spacer(modifier = Modifier.height(6.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Reorder Threshold Warnings", fontSize = 12.sp, color = TextSecondary)
                    Text("$lowStockCount", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WarningYellow)
                }
                Spacer(modifier = Modifier.height(6.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Out of Stock (Zero Units)", fontSize = 12.sp, color = TextSecondary)
                    Text("$outOfStockCount", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = DangerRed)
                }
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = onGoToLowStock,
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Review $lowStockCount Low Stock Items", fontWeight = FontWeight.Bold)
                }
            }
        }

        OwnerCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text("Inventory Quick Actions", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Spacer(modifier = Modifier.height(10.dp))
                OutlinedButton(onClick = onGoToIngredients, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(8.dp)) {
                    Icon(Icons.Default.List, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Browse Full Ingredients Catalog")
                }
            }
        }
    }
}

@Composable
fun IngredientsListView(
    ingredients: List<InventoryIngredientRecord>,
    onEdit: (InventoryIngredientRecord) -> Unit,
    onDelete: (InventoryIngredientRecord) -> Unit
) {
    if (ingredients.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No ingredients found matching filter", fontSize = 12.sp, color = TextSecondary)
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(ingredients, key = { it.id }) { ing ->
                val isOut = ing.currentStock <= 0
                val isLow = ing.currentStock <= ing.reorderLevel

                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(ing.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text(
                                    "${ing.category} • Storage: ${ing.storageLocation}",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    "${ing.currentStock} ${ing.unit}",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Black,
                                    color = if (isOut) DangerRed else (if (isLow) WarningYellow else TextPrimary)
                                )
                                Surface(
                                    color = if (isOut) DangerRed.copy(alpha = 0.15f) else (if (isLow) WarningYellow.copy(alpha = 0.15f) else SuccessGreen.copy(alpha = 0.15f)),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        if (isOut) "Out of Stock" else (if (isLow) "Low Stock" else "In Stock"),
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isOut) DangerRed else (if (isLow) WarningYellow else SuccessGreen),
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Reorder: ${ing.reorderLevel} ${ing.unit}", fontSize = 10.sp, color = TextSecondary)
                            Text("Cost: ${RevenueCalculator.formatInr(ing.purchaseCost)}/${ing.unit}", fontSize = 10.sp, color = TextSecondary)
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        Divider(color = DividerStroke)
                        Spacer(modifier = Modifier.height(6.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            OutlinedButton(
                                onClick = { onEdit(ing) },
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(12.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Edit", fontSize = 11.sp)
                            }
                            Spacer(modifier = Modifier.width(6.dp))
                            IconButton(onClick = { onDelete(ing) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = DangerRed, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RecipesMapView(recipes: List<InventoryRecipeRecord>) {
    if (recipes.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No recipe mappings defined yet", fontSize = 12.sp, color = TextSecondary)
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(recipes, key = { it.id }) { rec ->
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(rec.menuItemName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text(RevenueCalculator.formatInr(rec.costPerServing), fontSize = 13.sp, fontWeight = FontWeight.Black, color = TerracottaOrange)
                        }
                        Text("${rec.ingredients.size} constituent ingredients • Yield: ${rec.yield} serving", fontSize = 11.sp, color = TextSecondary)
                        Spacer(modifier = Modifier.height(8.dp))
                        rec.ingredients.forEach { ing ->
                            Text("• ${ing.ingredientName}: ${ing.quantity} ${ing.unit}", fontSize = 11.sp, color = TextPrimary)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MovementsLogView(movements: List<StockMovementRecord>) {
    val context = LocalContext.current
    if (movements.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No stock movement audit records found", fontSize = 12.sp, color = TextSecondary)
        }
    } else {
        Column(modifier = Modifier.fillMaxSize()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.End
            ) {
                OutlinedButton(
                    onClick = {
                        val csv = buildString {
                            appendLine("Timestamp,Ingredient,Change,Type,Reason,PerformedBy")
                            movements.forEach { m ->
                                appendLine("${m.timestamp},${m.ingredientName},${m.change},${m.type},${m.reason},${m.performedBy}")
                            }
                        }
                        val shareIntent = Intent().apply {
                            action = Intent.ACTION_SEND
                            putExtra(Intent.EXTRA_TEXT, csv)
                            type = "text/csv"
                        }
                        context.startActivity(Intent.createChooser(shareIntent, "Export Movements CSV"))
                    },
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Export CSV", fontSize = 11.sp)
                }
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(movements, key = { it.id }) { mv ->
                    OwnerCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(mv.ingredientName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text("${mv.type} • Reason: ${mv.reason.ifBlank { "Audit adjustment" }}", fontSize = 11.sp, color = TextSecondary)
                                Text(mv.timestamp.take(16).replace("T", " "), fontSize = 10.sp, color = TextSecondary)
                            }
                            Text(
                                "${if (mv.change > 0) "+" else ""}${mv.change}",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Black,
                                color = if (mv.change >= 0) SuccessGreen else DangerRed
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SuppliersListView(
    suppliers: List<SupplierRecord>,
    onAddSupplier: () -> Unit,
    onDeleteSupplier: (String) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.End
        ) {
            Button(
                onClick = onAddSupplier,
                colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(14.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Supplier", fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }

        if (suppliers.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No suppliers registered yet", fontSize = 12.sp, color = TextSecondary)
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(suppliers, key = { it.id }) { sup ->
                    OwnerCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(sup.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text("Contact: ${sup.contactPerson} • Phone: ${sup.phone}", fontSize = 11.sp, color = TextSecondary)
                                Text("Category: ${sup.category} • Lead Time: ${sup.leadTimeDays} days", fontSize = 10.sp, color = TextSecondary)
                            }
                            IconButton(onClick = { onDeleteSupplier(sup.id) }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = DangerRed, modifier = Modifier.size(16.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ExpiryMonitorView(ingredients: List<InventoryIngredientRecord>) {
    val withExpiry = ingredients.filter { it.expiryDate.isNotBlank() }

    if (withExpiry.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No ingredients configured with expiration tracking", fontSize = 12.sp, color = TextSecondary)
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(withExpiry, key = { it.id }) { ing ->
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(ing.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("Current Stock: ${ing.currentStock} ${ing.unit}", fontSize = 11.sp, color = TextSecondary)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("Expires: ${ing.expiryDate}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Surface(color = InfoBlue.copy(alpha = 0.15f), shape = RoundedCornerShape(6.dp)) {
                                Text("Monitored", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = InfoBlue, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun WasteLogsListView(wasteLogs: List<WasteLogRecord>) {
    if (wasteLogs.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("No kitchen waste logs recorded", fontSize = 12.sp, color = TextSecondary)
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(wasteLogs, key = { it.id }) { wl ->
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(wl.ingredientName, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("Quantity: ${wl.quantity} ${wl.unit} • Reason: ${wl.reason}", fontSize = 11.sp, color = TextSecondary)
                            if (wl.notes.isNotBlank()) {
                                Text("Notes: ${wl.notes}", fontSize = 10.sp, color = TextSecondary)
                            }
                        }
                        if (wl.cost > 0) {
                            Text("- ${RevenueCalculator.formatInr(wl.cost)}", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = DangerRed)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ReplenishmentSuggestionsView(ingredients: List<InventoryIngredientRecord>) {
    val lowStock = ingredients.filter { it.currentStock <= it.reorderLevel }

    if (lowStock.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("All ingredient stock levels are adequate. No purchase orders suggested.", fontSize = 12.sp, color = SuccessGreen)
        }
    } else {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(lowStock, key = { it.id }) { ing ->
                val suggestedOrder = maxOf(0.0, ing.maxStock - ing.currentStock)
                val estCost = suggestedOrder * ing.purchaseCost

                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(ing.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("Suggested: +$suggestedOrder ${ing.unit}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TerracottaOrange)
                        }
                        Text("Current: ${ing.currentStock} ${ing.unit} (Threshold: ${ing.reorderLevel} ${ing.unit})", fontSize = 11.sp, color = TextSecondary)
                        Text("Est. Cost: ${RevenueCalculator.formatInr(estCost)}", fontSize = 11.sp, fontWeight = FontWeight.Medium, color = TextPrimary)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEditIngredientDialog(
    ingredient: InventoryIngredientRecord?,
    suppliers: List<SupplierRecord>,
    onDismiss: () -> Unit,
    onSave: (InventoryIngredientRecord) -> Unit
) {
    var name by remember { mutableStateOf(ingredient?.name ?: "") }
    var category by remember { mutableStateOf(ingredient?.category ?: "Vegetables") }
    var currentStock by remember { mutableStateOf(ingredient?.currentStock?.toString() ?: "10") }
    var unit by remember { mutableStateOf(ingredient?.unit ?: "kg") }
    var minStock by remember { mutableStateOf(ingredient?.minStock?.toString() ?: "5") }
    var maxStock by remember { mutableStateOf(ingredient?.maxStock?.toString() ?: "50") }
    var reorderLevel by remember { mutableStateOf(ingredient?.reorderLevel?.toString() ?: "10") }
    var purchaseCost by remember { mutableStateOf(ingredient?.purchaseCost?.toString() ?: "50") }
    var storageLocation by remember { mutableStateOf(ingredient?.storageLocation ?: "Pantry") }
    var expiryDate by remember { mutableStateOf(ingredient?.expiryDate ?: "") }

    val categories = listOf("Vegetables", "Meat", "Dairy", "Dry Goods", "Beverages", "Spices", "Bakery", "Other")
    val units = listOf("kg", "g", "liters", "ml", "pieces", "packs")

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), color = SurfaceWhite, modifier = Modifier.padding(16.dp)) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    if (ingredient == null) "Register New Ingredient" else "Edit ${ingredient.name}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = TextPrimary
                )

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Ingredient Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Text("Category", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    categories.forEach { cat ->
                        FilterChip(
                            selected = category == cat,
                            onClick = { category = cat },
                            label = { Text(cat) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = TerracottaOrange, selectedLabelColor = Color.White)
                        )
                    }
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = currentStock,
                        onValueChange = { currentStock = it.filter { c -> c.isDigit() || c == '.' } },
                        label = { Text("Current Stock") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )
                    OutlinedTextField(
                        value = unit,
                        onValueChange = { unit = it },
                        label = { Text("Unit (kg, g, L)") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )
                }

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = reorderLevel,
                        onValueChange = { reorderLevel = it.filter { c -> c.isDigit() || c == '.' } },
                        label = { Text("Reorder Level") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )
                    OutlinedTextField(
                        value = purchaseCost,
                        onValueChange = { purchaseCost = it.filter { c -> c.isDigit() || c == '.' } },
                        label = { Text("Cost (₹/unit)") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    )
                }

                OutlinedTextField(
                    value = storageLocation,
                    onValueChange = { storageLocation = it },
                    label = { Text("Storage Location (Fridge, Pantry)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                OutlinedTextField(
                    value = expiryDate,
                    onValueChange = { expiryDate = it },
                    label = { Text("Expiry Date (YYYY-MM-DD)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel", color = TextSecondary) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                onSave(
                                    InventoryIngredientRecord(
                                        id = ingredient?.id ?: "",
                                        name = name.trim(),
                                        category = category,
                                        currentStock = currentStock.toDoubleOrNull() ?: 0.0,
                                        unit = unit.trim(),
                                        minStock = minStock.toDoubleOrNull() ?: 5.0,
                                        maxStock = maxStock.toDoubleOrNull() ?: 50.0,
                                        reorderLevel = reorderLevel.toDoubleOrNull() ?: 10.0,
                                        purchaseCost = purchaseCost.toDoubleOrNull() ?: 0.0,
                                        storageLocation = storageLocation.trim(),
                                        expiryDate = expiryDate.trim(),
                                        tenantId = ingredient?.tenantId ?: ""
                                    )
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Save Ingredient", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun AddSupplierDialog(onDismiss: () -> Unit, onSave: (SupplierRecord) -> Unit) {
    var name by remember { mutableStateOf("") }
    var contact by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("General") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), color = SurfaceWhite, modifier = Modifier.padding(16.dp)) {
            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Register Supplier", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Supplier Company *") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp))
                OutlinedTextField(value = contact, onValueChange = { contact = it }, label = { Text("Contact Person") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp))
                OutlinedTextField(value = phone, onValueChange = { phone = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp))
                OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel", color = TextSecondary) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                onSave(SupplierRecord(name = name.trim(), contactPerson = contact.trim(), phone = phone.trim(), email = email.trim(), category = category))
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Save Supplier", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun RecordWasteDialog(
    ingredients: List<InventoryIngredientRecord>,
    onDismiss: () -> Unit,
    onRecord: (String, String, Double, String, String, String, Double) -> Unit
) {
    var selectedId by remember { mutableStateOf(ingredients.firstOrNull()?.id ?: "") }
    val sel = ingredients.find { it.id == selectedId }
    var quantity by remember { mutableStateOf("1") }
    var reason by remember { mutableStateOf("Spoilage") }
    var notes by remember { mutableStateOf("") }

    val reasons = listOf("Spoilage", "Expired", "Damaged", "Spill", "Preparation Loss")

    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = RoundedCornerShape(16.dp), color = SurfaceWhite, modifier = Modifier.padding(16.dp)) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("Record Ingredient Waste", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = DangerRed)
                Text("Select an ingredient to write off spoiled or damaged stock.", fontSize = 11.sp, color = TextSecondary)

                // Select ingredient dropdown/chips
                Text("Select Ingredient", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    ingredients.take(10).forEach { ing ->
                        FilterChip(
                            selected = selectedId == ing.id,
                            onClick = { selectedId = ing.id },
                            label = { Text(ing.name) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = TerracottaOrange, selectedLabelColor = Color.White)
                        )
                    }
                }

                if (sel != null) {
                    Text("Available in pantry: ${sel.currentStock} ${sel.unit}", fontSize = 11.sp, color = TextSecondary)
                }

                OutlinedTextField(
                    value = quantity,
                    onValueChange = { quantity = it.filter { c -> c.isDigit() || c == '.' } },
                    label = { Text("Waste Quantity (${sel?.unit ?: "units"})") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Text("Waste Reason", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    reasons.forEach { r ->
                        FilterChip(
                            selected = reason == r,
                            onClick = { reason = r },
                            label = { Text(r) },
                            colors = FilterChipDefaults.filterChipColors(selectedContainerColor = DangerRed, selectedLabelColor = Color.White)
                        )
                    }
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Notes / Cause") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel", color = TextSecondary) }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            val qty = quantity.toDoubleOrNull() ?: 1.0
                            val cost = (sel?.purchaseCost ?: 0.0) * qty
                            if (sel != null) {
                                onRecord(sel.id, sel.name, qty, sel.unit, reason, notes, cost)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                    ) {
                        Text("Record Waste", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
