package com.spiraldine.owner.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.spiraldine.owner.data.model.FloorRecord
import com.spiraldine.owner.data.model.SectionRecord
import com.spiraldine.owner.data.model.TableRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard
import com.spiraldine.owner.ui.components.OwnerStatusBadge
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerTablesScreen(
    tables: List<TableRecord>,
    floors: List<FloorRecord> = emptyList(),
    sections: List<SectionRecord> = emptyList(),
    onBack: () -> Unit,
    onSaveTable: (TableRecord) -> Unit = {},
    onDeleteTable: (String) -> Unit = {},
    onToggleStatus: (String, String) -> Unit = { _, _ -> },
    onUpdatePosition: (String, Double, Double) -> Unit = { _, _, _ -> },
    onSaveFloor: (String, Int) -> Unit = { _, _ -> },
    onDeleteFloor: (String) -> Unit = {},
    onSaveSection: (String, String) -> Unit = { _, _ -> },
    onDeleteSection: (String) -> Unit = {},
    onAddTable: (String, Int) -> Unit = { _, _ -> }
) {
    var viewMode by remember { mutableStateOf("visual") } // "visual" or "list"
    var searchQuery by remember { mutableStateOf("") }
    var selectedFloor by remember { mutableStateOf("All") }
    var selectedSection by remember { mutableStateOf("All") }
    var selectedStatus by remember { mutableStateOf("All") }

    // Dialog states
    var showAddEditDialog by remember { mutableStateOf(false) }
    var editingTable by remember { mutableStateOf<TableRecord?>(null) }
    var tableToDelete by remember { mutableStateOf<TableRecord?>(null) }
    var selectedQrTable by remember { mutableStateOf<TableRecord?>(null) }
    var showFloorManagerDialog by remember { mutableStateOf(false) }

    // Status metrics
    val totalCount = tables.size
    val availableCount = tables.count { it.status.equals("AVAILABLE", ignoreCase = true) }
    val occupiedCount = tables.count { it.status.equals("OCCUPIED", ignoreCase = true) }
    val reservedCount = tables.count { it.status.equals("RESERVED", ignoreCase = true) }
    val cleaningCount = tables.count { it.status.equals("CLEANING", ignoreCase = true) }

    // Filtered tables
    val filteredTables = tables.filter { table ->
        val matchesSearch = searchQuery.isBlank() ||
                table.tableNumber.contains(searchQuery, ignoreCase = true) ||
                table.tableName.contains(searchQuery, ignoreCase = true) ||
                table.section.contains(searchQuery, ignoreCase = true)
        val matchesFloor = selectedFloor == "All" || table.floor.equals(selectedFloor, ignoreCase = true)
        val matchesSection = selectedSection == "All" || table.section.equals(selectedSection, ignoreCase = true)
        val matchesStatus = selectedStatus == "All" || table.status.equals(selectedStatus, ignoreCase = true)
        matchesSearch && matchesFloor && matchesSection && matchesStatus
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Tables & Seating", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                        Text("$availableCount free of $totalCount tables", fontSize = 11.sp, color = TextSecondary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = { showFloorManagerDialog = true }) {
                        Icon(Icons.Default.Layers, contentDescription = "Floors & Sections", tint = TextPrimary)
                    }
                    IconButton(onClick = {
                        editingTable = null
                        showAddEditDialog = true
                    }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Table", tint = TerracottaOrange)
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
            // 1. Status Summary KPI Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatusKpiChip(label = "Total", count = totalCount, color = TextPrimary, isSelected = selectedStatus == "All") {
                    selectedStatus = "All"
                }
                StatusKpiChip(label = "Available", count = availableCount, color = SuccessGreen, isSelected = selectedStatus == "AVAILABLE") {
                    selectedStatus = if (selectedStatus == "AVAILABLE") "All" else "AVAILABLE"
                }
                StatusKpiChip(label = "Occupied", count = occupiedCount, color = TerracottaOrange, isSelected = selectedStatus == "OCCUPIED") {
                    selectedStatus = if (selectedStatus == "OCCUPIED") "All" else "OCCUPIED"
                }
                StatusKpiChip(label = "Reserved", count = reservedCount, color = InfoBlue, isSelected = selectedStatus == "RESERVED") {
                    selectedStatus = if (selectedStatus == "RESERVED") "All" else "RESERVED"
                }
                StatusKpiChip(label = "Cleaning", count = cleaningCount, color = WarningYellow, isSelected = selectedStatus == "CLEANING") {
                    selectedStatus = if (selectedStatus == "CLEANING") "All" else "CLEANING"
                }
            }

            // 2. View Switcher & Search Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search tables...", fontSize = 12.sp) },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(16.dp))
                            }
                        }
                    },
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceWhite,
                        unfocusedContainerColor = SurfaceWhite,
                        focusedBorderColor = TerracottaOrange,
                        unfocusedBorderColor = DividerStroke
                    ),
                    singleLine = true
                )

                // View Mode Toggle (Visual Map vs List)
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = SurfaceWhite,
                    border = androidx.compose.foundation.BorderStroke(1.dp, DividerStroke)
                ) {
                    Row(modifier = Modifier.padding(2.dp)) {
                        IconButton(
                            onClick = { viewMode = "visual" },
                            modifier = Modifier
                                .size(36.dp)
                                .background(if (viewMode == "visual") TerracottaOrangeLight else Color.Transparent, RoundedCornerShape(10.dp))
                        ) {
                            Icon(
                                Icons.Default.Dashboard,
                                contentDescription = "Map View",
                                tint = if (viewMode == "visual") TerracottaOrange else TextSecondary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                        IconButton(
                            onClick = { viewMode = "list" },
                            modifier = Modifier
                                .size(36.dp)
                                .background(if (viewMode == "list") TerracottaOrangeLight else Color.Transparent, RoundedCornerShape(10.dp))
                        ) {
                            Icon(
                                Icons.Default.ViewList,
                                contentDescription = "List View",
                                tint = if (viewMode == "list") TerracottaOrange else TextSecondary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }

            // Floor & Section filter row
            val floorNames = listOf("All") + floors.map { it.name }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                floorNames.forEach { fl ->
                    FilterChip(
                        selected = selectedFloor == fl,
                        onClick = { selectedFloor = fl },
                        label = { Text(fl, fontSize = 11.sp, fontWeight = if (selectedFloor == fl) FontWeight.Bold else FontWeight.Normal) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = TerracottaOrange,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // 3. Main View Area
            if (viewMode == "visual") {
                VisualFloorMapView(
                    tables = filteredTables,
                    onTableClick = { table ->
                        editingTable = table
                        showAddEditDialog = true
                    },
                    onTablePositionChanged = { id, x, y ->
                        onUpdatePosition(id, x, y)
                    },
                    onQuickStatus = { id, st ->
                        onToggleStatus(id, st)
                    }
                )
            } else {
                ListCatalogView(
                    tables = filteredTables,
                    onEdit = { table ->
                        editingTable = table
                        showAddEditDialog = true
                    },
                    onDelete = { table ->
                        tableToDelete = table
                    },
                    onViewQr = { table ->
                        selectedQrTable = table
                    },
                    onToggleStatus = onToggleStatus
                )
            }
        }
    }

    // Add / Edit Table Dialog
    if (showAddEditDialog) {
        AddEditTableDialog(
            table = editingTable,
            floors = floors,
            sections = sections,
            onDismiss = { showAddEditDialog = false },
            onSave = { updated ->
                onSaveTable(updated)
                onAddTable(updated.tableNumber, updated.capacity)
                showAddEditDialog = false
            }
        )
    }

    // Delete Table Confirmation Dialog
    if (tableToDelete != null) {
        AlertDialog(
            onDismissRequest = { tableToDelete = null },
            title = { Text("Delete Table ${tableToDelete?.tableNumber}?", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
            text = { Text("Are you sure you want to remove this table? Any active orders or seating references will be unassigned.", fontSize = 13.sp) },
            confirmButton = {
                Button(
                    onClick = {
                        tableToDelete?.id?.let { onDeleteTable(it) }
                        tableToDelete = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                ) {
                    Text("Delete", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { tableToDelete = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }

    // QR Code Modal
    if (selectedQrTable != null) {
        TableQrDialog(
            table = selectedQrTable!!,
            onDismiss = { selectedQrTable = null }
        )
    }

    // Floor & Section Management Dialog
    if (showFloorManagerDialog) {
        FloorSectionManagerDialog(
            tables = tables,
            floors = floors,
            sections = sections,
            onDismiss = { showFloorManagerDialog = false },
            onSaveFloor = onSaveFloor,
            onDeleteFloor = onDeleteFloor,
            onSaveSection = onSaveSection,
            onDeleteSection = onDeleteSection
        )
    }
}

@Composable
fun StatusKpiChip(label: String, count: Int, color: Color, isSelected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(12.dp),
        color = if (isSelected) color.copy(alpha = 0.15f) else SurfaceWhite,
        border = androidx.compose.foundation.BorderStroke(1.dp, if (isSelected) color else DividerStroke)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(color)
            )
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Medium, color = TextPrimary)
            Text(
                count.toString(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = if (isSelected) color else TextSecondary
            )
        }
    }
}

@Composable
fun VisualFloorMapView(
    tables: List<TableRecord>,
    onTableClick: (TableRecord) -> Unit,
    onTablePositionChanged: (String, Double, Double) -> Unit,
    onQuickStatus: (String, String) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(12.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceWhite)
            .border(1.dp, DividerStroke, RoundedCornerShape(16.dp))
    ) {
        if (tables.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No tables match the current view filter", fontSize = 12.sp, color = TextSecondary)
            }
        } else {
            // Visual map layout with draggable / positionable tables
            BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                val density = LocalDensity.current
                val widthPx = constraints.maxWidth.toFloat()
                val heightPx = constraints.maxHeight.toFloat()

                tables.forEachIndexed { index, table ->
                    val shapeShape = when (table.shape.lowercase()) {
                        "circle" -> CircleShape
                        "rectangle" -> RoundedCornerShape(8.dp)
                        else -> RoundedCornerShape(12.dp)
                    }

                    val itemWidth = if (table.shape.equals("rectangle", true)) 100.dp else 80.dp
                    val itemHeight = 80.dp
                    val itemWidthPx = with(density) { itemWidth.toPx() }
                    val itemHeightPx = with(density) { itemHeight.toPx() }

                    val maxPixelX = (widthPx - itemWidthPx).coerceAtLeast(0f)
                    val maxPixelY = (heightPx - itemHeightPx).coerceAtLeast(0f)

                    // Normalized percentage coordinates (0.0 to 90.0)
                    val hasCustomPos = table.positionX > 0.0 || table.positionY > 0.0
                    val targetPctX = if (hasCustomPos) {
                        table.positionX.coerceIn(0.0, 90.0)
                    } else {
                        val cols = 3
                        ((index % cols) * 30.0 + 5.0).coerceIn(0.0, 85.0)
                    }
                    val targetPctY = if (hasCustomPos) {
                        table.positionY.coerceIn(0.0, 90.0)
                    } else {
                        val cols = 3
                        ((index / cols) * 20.0 + 5.0).coerceIn(0.0, 85.0)
                    }

                    val initPixelX = if (widthPx > 0f) ((targetPctX / 100.0) * widthPx).toFloat().coerceIn(0f, maxPixelX) else 0f
                    val initPixelY = if (heightPx > 0f) ((targetPctY / 100.0) * heightPx).toFloat().coerceIn(0f, maxPixelY) else 0f

                    var offsetX by remember(table.id, table.positionX, table.positionY, widthPx, heightPx) {
                        mutableStateOf(initPixelX)
                    }
                    var offsetY by remember(table.id, table.positionX, table.positionY, widthPx, heightPx) {
                        mutableStateOf(initPixelY)
                    }

                    val statusColor = when (table.status.uppercase()) {
                        "AVAILABLE" -> SuccessGreen
                        "OCCUPIED" -> TerracottaOrange
                        "RESERVED" -> InfoBlue
                        "CLEANING" -> WarningYellow
                        else -> TextSecondary
                    }

                    Box(
                        modifier = Modifier
                            .offset { IntOffset(offsetX.roundToInt(), offsetY.roundToInt()) }
                            .size(width = itemWidth, height = itemHeight)
                            .pointerInput(table.id, widthPx, heightPx) {
                                detectDragGestures(
                                    onDragEnd = {
                                        val finalPctX = if (widthPx > 0f) ((offsetX / widthPx) * 100.0).coerceIn(0.0, 90.0) else 0.0
                                        val finalPctY = if (heightPx > 0f) ((offsetY / heightPx) * 100.0).coerceIn(0.0, 90.0) else 0.0
                                        val roundedX = Math.round(finalPctX * 10.0) / 10.0
                                        val roundedY = Math.round(finalPctY * 10.0) / 10.0
                                        onTablePositionChanged(table.id, roundedX, roundedY)
                                    }
                                ) { change, dragAmount ->
                                    change.consume()
                                    offsetX = (offsetX + dragAmount.x).coerceIn(0f, maxPixelX)
                                    offsetY = (offsetY + dragAmount.y).coerceIn(0f, maxPixelY)
                                }
                            }
                            .clip(shapeShape)
                            .background(SurfaceWhite)
                            .border(2.dp, statusColor, shapeShape)
                            .clickable { onTableClick(table) },
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                "T-${table.tableNumber}",
                                fontWeight = FontWeight.Black,
                                fontSize = 13.sp,
                                color = TextPrimary
                            )
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                            ) {
                                Icon(Icons.Default.People, contentDescription = null, modifier = Modifier.size(11.dp), tint = TextSecondary)
                                Text("${table.capacity}", fontSize = 10.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
                            }
                            Text(
                                table.status.lowercase().replaceFirstChar { it.uppercase() },
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = statusColor
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ListCatalogView(
    tables: List<TableRecord>,
    onEdit: (TableRecord) -> Unit,
    onDelete: (TableRecord) -> Unit,
    onViewQr: (TableRecord) -> Unit,
    onToggleStatus: (String, String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(tables, key = { it.id }) { table ->
            OwnerCard(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(TerracottaOrangeLight),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "T${table.tableNumber}",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 12.sp,
                                    color = TerracottaOrange
                                )
                            }
                            Column {
                                Text(
                                    table.tableName.ifBlank { "Table ${table.tableNumber}" },
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Text(
                                    "${table.floor} • ${table.section} • ${table.capacity} Seats",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                            }
                        }

                        Box(modifier = Modifier.clickable { onToggleStatus(table.id, table.status) }) {
                            OwnerStatusBadge(status = table.status)
                        }
                    }

                    if (table.notes.isNotBlank()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Note: ${table.notes}", fontSize = 11.sp, color = TextSecondary)
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    Divider(color = DividerStroke)
                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(
                                onClick = { onViewQr(table) },
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Icon(Icons.Default.QrCode, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("QR", fontSize = 11.sp)
                            }

                            OutlinedButton(
                                onClick = { onEdit(table) },
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("Edit", fontSize = 11.sp)
                            }
                        }

                        IconButton(onClick = { onDelete(table) }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = DangerRed, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEditTableDialog(
    table: TableRecord?,
    floors: List<FloorRecord>,
    sections: List<SectionRecord>,
    onDismiss: () -> Unit,
    onSave: (TableRecord) -> Unit
) {
    var tableNumber by remember { mutableStateOf(table?.tableNumber ?: "") }
    var tableName by remember { mutableStateOf(table?.tableName ?: "") }
    var capacity by remember { mutableStateOf(table?.capacity?.toString() ?: "4") }

    val floorOptions = if (floors.isNotEmpty()) floors.map { it.name } else listOf("Ground Floor", "First Floor", "Outdoor")
    var selectedFloor by remember { mutableStateOf(table?.floor ?: floorOptions.first()) }
    var floorExpanded by remember { mutableStateOf(false) }

    // Filter sections dynamically by current selected floor
    val currentFloorRec = floors.firstOrNull { it.name.equals(selectedFloor, ignoreCase = true) }
    val sectionOptions = if (currentFloorRec != null) {
        val filtered = sections.filter { it.floorId == currentFloorRec.id }.map { it.name }
        if (filtered.isNotEmpty()) filtered else listOf("Main Dining", "General")
    } else if (sections.isNotEmpty()) {
        sections.map { it.name }
    } else {
        listOf("Main Dining", "AC Hall", "Family Section", "Balcony")
    }

    var selectedSection by remember { mutableStateOf(table?.section ?: sectionOptions.first()) }
    var sectionExpanded by remember { mutableStateOf(false) }

    var selectedShape by remember { mutableStateOf(table?.shape ?: "square") }
    var notes by remember { mutableStateOf(table?.notes ?: "") }
    var status by remember { mutableStateOf(table?.status ?: "AVAILABLE") }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = SurfaceWhite,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    if (table == null) "Add Dining Table" else "Edit Table ${table.tableNumber}",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = TextPrimary
                )

                OutlinedTextField(
                    value = tableNumber,
                    onValueChange = { tableNumber = it },
                    label = { Text("Table Number / Code") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                OutlinedTextField(
                    value = tableName,
                    onValueChange = { tableName = it },
                    label = { Text("Table Name (e.g. Window 4)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                OutlinedTextField(
                    value = capacity,
                    onValueChange = { capacity = it.filter { c -> c.isDigit() } },
                    label = { Text("Seating Capacity") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                // Dynamic Floor Dropdown
                ExposedDropdownMenuBox(
                    expanded = floorExpanded,
                    onExpandedChange = { floorExpanded = !floorExpanded },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = selectedFloor,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Floor") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = floorExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = floorExpanded,
                        onDismissRequest = { floorExpanded = false }
                    ) {
                        floorOptions.forEach { fl ->
                            DropdownMenuItem(
                                text = { Text(fl) },
                                onClick = {
                                    selectedFloor = fl
                                    floorExpanded = false
                                    // Update dependent section when floor changes
                                    val matchedFl = floors.firstOrNull { it.name.equals(fl, ignoreCase = true) }
                                    val newSecs = if (matchedFl != null) {
                                        val filtered = sections.filter { it.floorId == matchedFl.id }.map { it.name }
                                        if (filtered.isNotEmpty()) filtered else listOf("Main Dining", "General")
                                    } else listOf("Main Dining", "General")
                                    if (selectedSection !in newSecs) {
                                        selectedSection = newSecs.first()
                                    }
                                }
                            )
                        }
                    }
                }

                // Dynamic Dependent Section Dropdown (filtered by selected floor)
                ExposedDropdownMenuBox(
                    expanded = sectionExpanded,
                    onExpandedChange = { sectionExpanded = !sectionExpanded },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = selectedSection,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Section ($selectedFloor)") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = sectionExpanded) },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp)
                    )
                    ExposedDropdownMenu(
                        expanded = sectionExpanded,
                        onDismissRequest = { sectionExpanded = false }
                    ) {
                        sectionOptions.forEach { sec ->
                            DropdownMenuItem(
                                text = { Text(sec) },
                                onClick = {
                                    selectedSection = sec
                                    sectionExpanded = false
                                }
                            )
                        }
                    }
                }

                // Shape selection
                Text("Table Shape", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("square", "circle", "rectangle").forEach { sh ->
                        FilterChip(
                            selected = selectedShape == sh,
                            onClick = { selectedShape = sh },
                            label = { Text(sh.replaceFirstChar { it.uppercase() }) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TerracottaOrange,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }

                OutlinedTextField(
                    value = notes,
                    onValueChange = { notes = it },
                    label = { Text("Internal Notes") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = TextSecondary)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (tableNumber.isNotBlank()) {
                                onSave(
                                    TableRecord(
                                        id = table?.id ?: "T-${tableNumber.trim().uppercase()}",
                                        tableNumber = tableNumber.trim(),
                                        tableName = tableName.ifBlank { "Table ${tableNumber.trim()}" },
                                        floor = selectedFloor,
                                        section = selectedSection,
                                        capacity = capacity.toIntOrNull() ?: 4,
                                        shape = selectedShape,
                                        positionX = table?.positionX ?: 0.0,
                                        positionY = table?.positionY ?: 0.0,
                                        notes = notes,
                                        status = status,
                                        isActive = true,
                                        tenantId = table?.tenantId ?: ""
                                    )
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Save Table", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun TableQrDialog(table: TableRecord, onDismiss: () -> Unit) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val origin = "https://spiral-dine.vercel.app"
    val tableUrl = "$origin/r/${table.tenantId}/table/${table.tableNumber.ifBlank { table.id }}"
    val qrImageUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${java.net.URLEncoder.encode(tableUrl, "UTF-8")}&color=20-20-20"

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = SurfaceWhite,
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Table ${table.tableNumber} Smart QR", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                Text("Customers scan this scannable code with any camera to order table-side.", fontSize = 11.sp, color = TextSecondary, textAlign = TextAlign.Center)

                // Genuine Scannable QR Code Image
                Box(
                    modifier = Modifier
                        .size(180.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White)
                        .border(1.dp, DividerStroke, RoundedCornerShape(12.dp))
                        .padding(8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    AsyncImage(
                        model = qrImageUrl,
                        contentDescription = "Scannable QR Code for Table ${table.tableNumber}",
                        contentScale = ContentScale.Fit,
                        modifier = Modifier.fillMaxSize()
                    )
                }

                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = BackgroundLight,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        tableUrl,
                        fontSize = 10.sp,
                        color = TextSecondary,
                        modifier = Modifier.padding(8.dp),
                        maxLines = 1
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            clipboard.setText(AnnotatedString(tableUrl))
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Icon(Icons.Default.ContentCopy, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Copy", fontSize = 11.sp)
                    }

                    Button(
                        onClick = {
                            val sendIntent = Intent().apply {
                                action = Intent.ACTION_SEND
                                putExtra(Intent.EXTRA_SUBJECT, "SpiralDine Table ${table.tableNumber}")
                                putExtra(Intent.EXTRA_TEXT, "Scan or open to view the menu for Table ${table.tableNumber}: $tableUrl")
                                type = "text/plain"
                            }
                            context.startActivity(Intent.createChooser(sendIntent, "Share Table QR"))
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Share", fontSize = 11.sp)
                    }

                    IconButton(
                        onClick = {
                            val viewIntent = Intent(Intent.ACTION_VIEW, Uri.parse(tableUrl))
                            context.startActivity(viewIntent)
                        },
                        modifier = Modifier
                            .size(40.dp)
                            .background(BackgroundLight, RoundedCornerShape(10.dp))
                    ) {
                        Icon(Icons.Default.OpenInBrowser, contentDescription = "Open in browser", tint = TextPrimary, modifier = Modifier.size(18.dp))
                    }
                }

                TextButton(onClick = onDismiss) {
                    Text("Close", color = TextSecondary)
                }
            }
        }
    }
}

@Composable
fun FloorSectionManagerDialog(
    tables: List<TableRecord> = emptyList(),
    floors: List<FloorRecord>,
    sections: List<SectionRecord>,
    onDismiss: () -> Unit,
    onSaveFloor: (String, Int) -> Unit,
    onDeleteFloor: (String) -> Unit,
    onSaveSection: (String, String) -> Unit,
    onDeleteSection: (String) -> Unit
) {
    var newFloorName by remember { mutableStateOf("") }
    var newSectionName by remember { mutableStateOf("") }
    var selectedFloorForSection by remember(floors) { mutableStateOf(floors.firstOrNull()?.id ?: "") }
    var deleteWarningMessage by remember { mutableStateOf<String?>(null) }
    var pendingDeleteAction by remember { mutableStateOf<(() -> Unit)?>(null) }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = SurfaceWhite,
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Text("Manage Floors & Sections", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)

                // Delete Confirmation Warning Sub-Dialog
                if (deleteWarningMessage != null) {
                    Surface(
                        color = DangerRed.copy(alpha = 0.1f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, DangerRed),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Text(deleteWarningMessage!!, fontSize = 12.sp, color = DangerRed, fontWeight = FontWeight.Medium)
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = {
                                        pendingDeleteAction?.invoke()
                                        pendingDeleteAction = null
                                        deleteWarningMessage = null
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = DangerRed),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text("Confirm Delete", fontSize = 11.sp, color = Color.White)
                                }
                                OutlinedButton(
                                    onClick = {
                                        pendingDeleteAction = null
                                        deleteWarningMessage = null
                                    },
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text("Cancel", fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }

                // Floors Section
                Text("Floors", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                floors.forEach { fl ->
                    val tableCount = tables.count { it.floor.equals(fl.name, ignoreCase = true) }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(fl.name, fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                            if (tableCount > 0) {
                                Text("$tableCount table(s) assigned", fontSize = 10.sp, color = TextSecondary)
                            }
                        }
                        IconButton(onClick = {
                            if (tableCount > 0) {
                                deleteWarningMessage = "Floor '${fl.name}' has $tableCount active table(s). Deleting it will leave these tables unassigned. Proceed?"
                                pendingDeleteAction = { onDeleteFloor(fl.id) }
                            } else {
                                onDeleteFloor(fl.id)
                            }
                        }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = DangerRed, modifier = Modifier.size(16.dp))
                        }
                    }
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = newFloorName,
                        onValueChange = { newFloorName = it },
                        placeholder = { Text("New floor name...") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    )
                    Button(
                        onClick = {
                            if (newFloorName.isNotBlank()) {
                                onSaveFloor(newFloorName.trim(), floors.size)
                                newFloorName = ""
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Add")
                    }
                }

                Divider(color = DividerStroke)

                // Sections Section
                Text("Sections", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                sections.forEach { sec ->
                    val assignedFloor = floors.firstOrNull { it.id == sec.floorId }?.name ?: "All Floors"
                    val tableCount = tables.count { it.section.equals(sec.name, ignoreCase = true) }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(sec.name, fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                            Text("Floor: $assignedFloor${if (tableCount > 0) " • $tableCount table(s)" else ""}", fontSize = 10.sp, color = TextSecondary)
                        }
                        IconButton(onClick = {
                            if (tableCount > 0) {
                                deleteWarningMessage = "Section '${sec.name}' has $tableCount table(s). Deleting it will leave tables unassigned. Proceed?"
                                pendingDeleteAction = { onDeleteSection(sec.id) }
                            } else {
                                onDeleteSection(sec.id)
                            }
                        }) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = DangerRed, modifier = Modifier.size(16.dp))
                        }
                    }
                }

                // Add section with Floor Selector
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (floors.isNotEmpty()) {
                        Text("Assign new section to floor:", fontSize = 11.sp, color = TextSecondary)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            floors.forEach { fl ->
                                val isSelected = selectedFloorForSection == fl.id || (selectedFloorForSection.isEmpty() && fl == floors.first())
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { selectedFloorForSection = fl.id },
                                    label = { Text(fl.name, fontSize = 10.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = TerracottaOrange,
                                        selectedLabelColor = Color.White
                                    )
                                )
                            }
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = newSectionName,
                            onValueChange = { newSectionName = it },
                            placeholder = { Text("New section name...") },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        )
                        Button(
                            onClick = {
                                if (newSectionName.isNotBlank()) {
                                    val targetFloorId = if (selectedFloorForSection.isNotBlank()) selectedFloorForSection else (floors.firstOrNull()?.id ?: "")
                                    onSaveSection(newSectionName.trim(), targetFloorId)
                                    newSectionName = ""
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("Add")
                        }
                    }
                }

                TextButton(onClick = onDismiss, modifier = Modifier.align(Alignment.End)) {
                    Text("Close", color = TextSecondary)
                }
            }
        }
    }
}
