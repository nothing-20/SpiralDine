package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.spiraldine.owner.data.model.CategoryRecord
import com.spiraldine.owner.data.model.MenuItemRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerAddEditItemScreen(
    item: MenuItemRecord?,
    categories: List<CategoryRecord> = emptyList(),
    onBack: () -> Unit,
    onSave: (MenuItemRecord) -> Unit,
    onDelete: (String) -> Unit
) {
    val isEdit = item != null
    var name by remember { mutableStateOf(item?.name ?: "") }
    var description by remember { mutableStateOf(item?.description ?: "") }
    var category by remember { mutableStateOf(item?.category ?: (categories.firstOrNull()?.name ?: "Mains")) }
    var categoryId by remember { mutableStateOf(item?.categoryId ?: (categories.firstOrNull()?.id ?: "")) }
    val initialPriceRupees = if (item != null && item.price > 0) {
        val r = item.price / 100.0
        if (r % 1.0 == 0.0) r.toLong().toString() else "%.2f".format(java.util.Locale.US, r)
    } else "249.00"
    val initialDiscountRupees = if (item?.discountPrice != null && item.discountPrice > 0) {
        val r = item.discountPrice / 100.0
        if (r % 1.0 == 0.0) r.toLong().toString() else "%.2f".format(java.util.Locale.US, r)
    } else ""
    var priceText by remember { mutableStateOf(initialPriceRupees) }
    var discountPriceText by remember { mutableStateOf(initialDiscountRupees) }
    var foodType by remember { mutableStateOf(item?.type ?: "veg") }
    var prepTimeText by remember { mutableStateOf(item?.prepTime?.toString() ?: "15") }
    var spiceLevel by remember { mutableStateOf(item?.spiceLevel ?: "none") }
    var productionMode by remember { mutableStateOf(item?.productionMode ?: "On Demand") }
    var defaultBatchSizeText by remember { mutableStateOf((item?.defaultBatchSize ?: 50).toString()) }
    var availableServingsText by remember { mutableStateOf((item?.availableServings ?: 50).toString()) }
    var lowStockThresholdText by remember { mutableStateOf((item?.lowStockThreshold ?: 10).toString()) }
    var autoUnavailable by remember { mutableStateOf(item?.autoUnavailable ?: true) }
    var showServingsToStaff by remember { mutableStateOf(item?.showServingsToStaff ?: true) }
    var allowRefill by remember { mutableStateOf(item?.allowRefill ?: true) }
    var image by remember { mutableStateOf(item?.image ?: "") }

    // Flags
    var available by remember { mutableStateOf(item?.available ?: true) }
    var isPublished by remember { mutableStateOf(item?.isPublished ?: true) }
    var isBestSeller by remember { mutableStateOf(item?.isBestSeller ?: false) }
    var isRecommended by remember { mutableStateOf(item?.isRecommended ?: false) }

    var validationError by remember { mutableStateOf<String?>(null) }
    var showCategoryDropdown by remember { mutableStateOf(false) }
    var showSpiceDropdown by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (isEdit) "Edit Menu Item" else "Add Menu Item", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    Button(
                        onClick = {
                            if (name.isBlank()) {
                                validationError = "Item name is required."
                                return@Button
                            }
                            val priceRupees = priceText.toDoubleOrNull()
                            if (priceRupees == null || priceRupees <= 0) {
                                validationError = "Please enter a valid base price greater than zero."
                                return@Button
                            }
                            val discountPriceRupees = if (discountPriceText.isNotBlank()) discountPriceText.toDoubleOrNull() else null
                            if (discountPriceRupees != null) {
                                if (discountPriceRupees < 0) {
                                    validationError = "Discount price must be non-negative."
                                    return@Button
                                }
                                if (discountPriceRupees >= priceRupees) {
                                    validationError = "Discount price must be less than base price."
                                    return@Button
                                }
                            }
                            val defaultBatch = defaultBatchSizeText.toIntOrNull() ?: 50
                            val availableServings = availableServingsText.toIntOrNull() ?: 50
                            val lowThreshold = lowStockThresholdText.toIntOrNull() ?: 10
                            if (productionMode == "Batch Production") {
                                if (defaultBatch < 1) {
                                    validationError = "Default batch size must be at least 1."
                                    return@Button
                                }
                                if (availableServings < 0) {
                                    validationError = "Available servings cannot be negative."
                                    return@Button
                                }
                                if (lowThreshold < 0) {
                                    validationError = "Low stock threshold cannot be negative."
                                    return@Button
                                }
                            }
                            val prepTime = prepTimeText.toIntOrNull() ?: 15
                            val pricePaise = Math.round(priceRupees * 100).toDouble()
                            val discountPricePaise = discountPriceRupees?.let { Math.round(it * 100).toDouble() }

                            onSave(
                                MenuItemRecord(
                                    id = item?.id ?: "",
                                    name = name.trim(),
                                    description = description.trim(),
                                    category = category,
                                    categoryId = categoryId,
                                    price = pricePaise,
                                    discountPrice = discountPricePaise,
                                    type = foodType,
                                    prepTime = prepTime,
                                    spiceLevel = spiceLevel,
                                    productionMode = productionMode,
                                    defaultBatchSize = defaultBatch,
                                    availableServings = availableServings,
                                    lowStockThreshold = lowThreshold,
                                    autoUnavailable = autoUnavailable,
                                    showServingsToStaff = showServingsToStaff,
                                    allowRefill = allowRefill,
                                    preparationMethod = if (productionMode == "Batch Production") "batch" else "fresh",
                                    image = image.trim(),
                                    available = available,
                                    isPublished = isPublished,
                                    isBestSeller = isBestSeller,
                                    isRecommended = isRecommended,
                                    tenantId = item?.tenantId ?: ""
                                )
                            )
                        },
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Save", fontWeight = FontWeight.Bold, fontSize = 12.sp)
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
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (validationError != null) {
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = ErrorRedLight,
                    border = androidx.compose.foundation.BorderStroke(1.dp, ErrorRed)
                ) {
                    Text(
                        text = validationError ?: "",
                        color = ErrorRed,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(10.dp)
                    )
                }
            }

            // 1. Basic Information
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("General Details", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)

                    OutlinedTextField(
                        value = name,
                        onValueChange = { 
                            name = it
                            validationError = null
                        },
                        label = { Text("Dish Name *") },
                        placeholder = { Text("e.g. Paneer Butter Masala") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )

                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it },
                        label = { Text("Description") },
                        placeholder = { Text("Flavor profile, ingredients, allergy notice...") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        minLines = 2
                    )

                    // Category Selector Box
                    Box {
                        OutlinedTextField(
                            value = category,
                            onValueChange = { category = it },
                            label = { Text("Category *") },
                            modifier = Modifier.fillMaxWidth(),
                            trailingIcon = {
                                IconButton(onClick = { showCategoryDropdown = true }) {
                                    Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                                }
                            },
                            shape = RoundedCornerShape(12.dp)
                        )
                        DropdownMenu(
                            expanded = showCategoryDropdown,
                            onDismissRequest = { showCategoryDropdown = false }
                        ) {
                            if (categories.isEmpty()) {
                                listOf("Appetizers", "Soups", "Mains", "Breads", "Desserts", "Beverages").forEach { catName ->
                                    DropdownMenuItem(
                                        text = { Text(catName) },
                                        onClick = {
                                            category = catName
                                            categoryId = catName.lowercase()
                                            showCategoryDropdown = false
                                        }
                                    )
                                }
                            } else {
                                categories.forEach { cat ->
                                    DropdownMenuItem(
                                        text = { Text(cat.name) },
                                        onClick = {
                                            category = cat.name
                                            categoryId = cat.id
                                            showCategoryDropdown = false
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // 2. Pricing & Preparation
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Pricing & Preparation", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = priceText,
                            onValueChange = { 
                                priceText = it
                                validationError = null
                            },
                            label = { Text("Base Price (₹) *") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        )

                        OutlinedTextField(
                            value = discountPriceText,
                            onValueChange = { 
                                discountPriceText = it
                                validationError = null
                            },
                            label = { Text("Discount Price (₹)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        )
                    }

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedTextField(
                            value = prepTimeText,
                            onValueChange = { prepTimeText = it.filter { c -> c.isDigit() } },
                            label = { Text("Prep Time (min)") },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp)
                        )

                        // Spice level box
                        Box(modifier = Modifier.weight(1f)) {
                            OutlinedTextField(
                                value = spiceLevel.replaceFirstChar { it.uppercase() },
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Spice Level") },
                                trailingIcon = {
                                    IconButton(onClick = { showSpiceDropdown = true }) {
                                        Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                                    }
                                },
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp)
                            )
                            DropdownMenu(
                                expanded = showSpiceDropdown,
                                onDismissRequest = { showSpiceDropdown = false }
                            ) {
                                listOf("none" to "None", "mild" to "Mild 🌶️", "medium" to "Medium 🌶️🌶️", "hot" to "Hot 🌶️🌶️🌶️", "extra_hot" to "Extra Hot 🔥").forEach { (lvl, lbl) ->
                                    DropdownMenuItem(
                                        text = { Text(lbl) },
                                        onClick = {
                                            spiceLevel = lvl
                                            showSpiceDropdown = false
                                        }
                                    )
                                }
                            }
                        }
                    }

                    // Production Mode Toggle
                    Text("Production Mode", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextSecondary)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(BackgroundLight, RoundedCornerShape(10.dp))
                            .padding(4.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        val isDemand = productionMode == "On Demand"
                        Surface(
                            modifier = Modifier
                                .weight(1f)
                                .clickable { productionMode = "On Demand" },
                            shape = RoundedCornerShape(8.dp),
                            color = if (isDemand) SurfaceWhite else BackgroundLight
                        ) {
                            Text(
                                "On Demand",
                                fontSize = 11.sp,
                                fontWeight = if (isDemand) FontWeight.Bold else FontWeight.Medium,
                                color = if (isDemand) TextPrimary else TextSecondary,
                                modifier = Modifier.padding(vertical = 8.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                        val isBatch = productionMode == "Batch Production"
                        Surface(
                            modifier = Modifier
                                .weight(1f)
                                .clickable { productionMode = "Batch Production" },
                            shape = RoundedCornerShape(8.dp),
                            color = if (isBatch) SurfaceWhite else BackgroundLight
                        ) {
                            Text(
                                "Batch Production",
                                fontSize = 11.sp,
                                fontWeight = if (isBatch) FontWeight.Bold else FontWeight.Medium,
                                color = if (isBatch) TextPrimary else TextSecondary,
                                modifier = Modifier.padding(vertical = 8.dp),
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }

                    // Batch Preparation Settings Card (Displayed immediately when Batch Production is selected)
                    if (productionMode == "Batch Production") {
                        Spacer(modifier = Modifier.height(4.dp))
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = BackgroundLight,
                            border = androidx.compose.foundation.BorderStroke(1.dp, DividerStroke),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text(
                                    "Batch Preparation Settings",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    OutlinedTextField(
                                        value = defaultBatchSizeText,
                                        onValueChange = { defaultBatchSizeText = it.filter { c -> c.isDigit() } },
                                        label = { Text("Default Batch", fontSize = 10.sp) },
                                        placeholder = { Text("50") },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                    OutlinedTextField(
                                        value = availableServingsText,
                                        onValueChange = { availableServingsText = it.filter { c -> c.isDigit() } },
                                        label = { Text("Available", fontSize = 10.sp) },
                                        placeholder = { Text("50") },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                    OutlinedTextField(
                                        value = lowStockThresholdText,
                                        onValueChange = { lowStockThresholdText = it.filter { c -> c.isDigit() } },
                                        label = { Text("Low Thresh", fontSize = 10.sp) },
                                        placeholder = { Text("10") },
                                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(10.dp)
                                    )
                                }

                                HorizontalDivider(color = DividerStroke, modifier = Modifier.padding(vertical = 2.dp))

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { autoUnavailable = !autoUnavailable },
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = autoUnavailable,
                                        onCheckedChange = { autoUnavailable = it },
                                        colors = CheckboxDefaults.colors(checkedColor = TerracottaOrange)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Auto mark unavailable at 0 servings", fontSize = 11.sp, color = TextPrimary)
                                }

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { showServingsToStaff = !showServingsToStaff },
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = showServingsToStaff,
                                        onCheckedChange = { showServingsToStaff = it },
                                        colors = CheckboxDefaults.colors(checkedColor = TerracottaOrange)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Show remaining servings to staff", fontSize = 11.sp, color = TextPrimary)
                                }

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { allowRefill = !allowRefill },
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Checkbox(
                                        checked = allowRefill,
                                        onCheckedChange = { allowRefill = it },
                                        colors = CheckboxDefaults.colors(checkedColor = TerracottaOrange)
                                    )
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Allow owner to refill batch", fontSize = 11.sp, color = TextPrimary)
                                }
                            }
                        }
                    }
                }
            }

            // 3. Dietary & Flags
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Dietary & Merchandising Flags", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)

                    // Food Type Segmented
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf("veg" to "Vegetarian", "non-veg" to "Non-Veg", "vegan" to "Vegan").forEach { (typeKey, typeLabel) ->
                            val isSel = foodType == typeKey
                            Surface(
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { foodType = typeKey },
                                shape = RoundedCornerShape(10.dp),
                                color = if (isSel) TerracottaOrangeLight else BackgroundLight,
                                border = if (isSel) androidx.compose.foundation.BorderStroke(1.dp, TerracottaOrange) else null
                            ) {
                                Text(
                                    typeLabel,
                                    fontSize = 11.sp,
                                    fontWeight = if (isSel) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSel) TerracottaOrange else TextSecondary,
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            }
                        }
                    }

                    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp), color = DividerStroke)

                    // Switch 1: Available in Stock
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Available in Stock", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextPrimary)
                            Text("Diners can place orders for this item", fontSize = 10.sp, color = TextSecondary)
                        }
                        Switch(
                            checked = available,
                            onCheckedChange = { available = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = TerracottaOrange)
                        )
                    }

                    // Switch 2: Published on Menu
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Published", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextPrimary)
                            Text("Visible on table QR code digital menus", fontSize = 10.sp, color = TextSecondary)
                        }
                        Switch(
                            checked = isPublished,
                            onCheckedChange = { isPublished = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = TerracottaOrange)
                        )
                    }

                    // Switch 3: Bestseller Flag
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Bestseller Dish", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextPrimary)
                            Text("Promote with trending badge", fontSize = 10.sp, color = TextSecondary)
                        }
                        Switch(
                            checked = isBestSeller,
                            onCheckedChange = { isBestSeller = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = TerracottaOrange)
                        )
                    }

                    // Switch 4: Chef's Recommended Flag
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Chef's Recommended", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = TextPrimary)
                            Text("Highlight for new diners", fontSize = 10.sp, color = TextSecondary)
                        }
                        Switch(
                            checked = isRecommended,
                            onCheckedChange = { isRecommended = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = TerracottaOrange)
                        )
                    }
                }
            }

            // 4. Photo / Image URL
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Photo & Media", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)

                    OutlinedTextField(
                        value = image,
                        onValueChange = { image = it },
                        label = { Text("Image URL") },
                        placeholder = { Text("https://images.unsplash.com/...") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )

                    if (image.isNotBlank()) {
                        AsyncImage(
                            model = image,
                            contentDescription = "Dish preview",
                            contentScale = ContentScale.Crop,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(140.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(BackgroundLight)
                        )
                    }
                }
            }

            if (isEdit && item != null) {
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = { onDelete(item.id) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed)
                ) {
                    Icon(Icons.Default.Delete, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Delete Menu Item", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
