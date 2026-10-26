package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.spiraldine.owner.data.model.CategoryRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerCategoriesScreen(
    categories: List<CategoryRecord>,
    onBack: () -> Unit,
    onSaveCategory: (CategoryRecord) -> Unit = {},
    onAddCategory: (String, Int) -> Unit = { _, _ -> },
    onDeleteCategory: (String) -> Unit
) {
    var showDialog by remember { mutableStateOf(false) }
    var editingCategory by remember { mutableStateOf<CategoryRecord?>(null) }
    var catName by remember { mutableStateOf("") }
    var catDescription by remember { mutableStateOf("") }
    var catImageUrl by remember { mutableStateOf("") }
    var catOrder by remember { mutableStateOf("1") }
    var catIsActive by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    fun openForAdd() {
        editingCategory = null
        catName = ""
        catDescription = ""
        catImageUrl = ""
        catOrder = (categories.size + 1).toString()
        catIsActive = true
        errorMessage = null
        showDialog = true
    }

    fun openForEdit(cat: CategoryRecord) {
        editingCategory = cat
        catName = cat.name
        catDescription = cat.description
        catImageUrl = cat.image
        catOrder = cat.order.toString()
        catIsActive = cat.isActive
        errorMessage = null
        showDialog = true
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Menu Categories", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = { openForAdd() }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Category", tint = TerracottaOrange)
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
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            itemsIndexed(categories.sortedBy { it.order }) { _, cat ->
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.weight(1f)
                        ) {
                            if (cat.image.isNotBlank()) {
                                AsyncImage(
                                    model = cat.image,
                                    contentDescription = cat.name,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                            } else {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(TerracottaOrangeLight),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        "#${cat.order}",
                                        color = TerracottaOrange,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                            }

                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        cat.name,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                    if (!cat.isActive) {
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Surface(
                                            color = BorderLight,
                                            shape = RoundedCornerShape(4.dp)
                                        ) {
                                            Text(
                                                "Inactive",
                                                color = TextSecondary,
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                                if (cat.description.isNotBlank()) {
                                    Text(
                                        cat.description,
                                        fontSize = 12.sp,
                                        color = TextSecondary,
                                        maxLines = 1
                                    )
                                }
                            }
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { openForEdit(cat) }) {
                                Icon(
                                    Icons.Outlined.Edit,
                                    contentDescription = "Edit",
                                    tint = TextSecondary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            IconButton(onClick = { onDeleteCategory(cat.id) }) {
                                Icon(
                                    Icons.Outlined.Delete,
                                    contentDescription = "Delete",
                                    tint = ErrorRed,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }
            }
        }

        if (showDialog) {
            AlertDialog(
                onDismissRequest = { showDialog = false },
                title = {
                    Text(
                        if (editingCategory == null) "New Category" else "Edit Category",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )
                },
                text = {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        if (errorMessage != null) {
                            Text(
                                errorMessage!!,
                                color = ErrorRed,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        OutlinedTextField(
                            value = catName,
                            onValueChange = {
                                catName = it
                                errorMessage = null
                            },
                            label = { Text("Category Name *") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = catDescription,
                            onValueChange = { catDescription = it },
                            label = { Text("Description (Optional)") },
                            modifier = Modifier.fillMaxWidth(),
                            maxLines = 2
                        )

                        OutlinedTextField(
                            value = catImageUrl,
                            onValueChange = { catImageUrl = it },
                            label = { Text("Image URL (Optional)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        OutlinedTextField(
                            value = catOrder,
                            onValueChange = { catOrder = it.filter { ch -> ch.isDigit() } },
                            label = { Text("Display Order") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Active in Menu", fontSize = 14.sp, color = TextPrimary)
                            Switch(
                                checked = catIsActive,
                                onCheckedChange = { catIsActive = it },
                                colors = SwitchDefaults.colors(checkedThumbColor = SurfaceWhite, checkedTrackColor = SuccessGreen)
                            )
                        }
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val trimmed = catName.trim()
                            if (trimmed.isBlank()) {
                                errorMessage = "Category name is required"
                                return@Button
                            }
                            val isDuplicate = categories.any {
                                it.id != (editingCategory?.id ?: "") && it.name.equals(trimmed, ignoreCase = true)
                            }
                            if (isDuplicate) {
                                errorMessage = "Category '$trimmed' already exists"
                                return@Button
                            }

                            val orderNum = catOrder.toIntOrNull() ?: (categories.size + 1)
                            val finalCat = CategoryRecord(
                                id = editingCategory?.id ?: "",
                                name = trimmed,
                                description = catDescription.trim(),
                                order = orderNum,
                                isActive = catIsActive,
                                image = catImageUrl.trim()
                            )
                            onSaveCategory(finalCat)
                            showDialog = false
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text(if (editingCategory == null) "Create" else "Save")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
