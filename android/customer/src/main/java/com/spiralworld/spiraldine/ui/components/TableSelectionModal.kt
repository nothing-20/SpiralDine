package com.spiralworld.spiraldine.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Coffee
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.RestaurantTable
import com.spiralworld.spiraldine.data.repository.ReservationRepository
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.LightGreen
import com.spiralworld.spiraldine.theme.PrimaryGreen
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.SpiralDineOrangeDark
import com.spiralworld.spiraldine.theme.SpiralDineOrangeLight
import com.spiralworld.spiraldine.theme.SuccessGreen
import com.spiralworld.spiraldine.theme.SurfaceMuted
import com.spiralworld.spiraldine.theme.SurfaceWhite
import com.spiralworld.spiraldine.theme.TextPrimary
import com.spiralworld.spiraldine.theme.TextSecondary
import com.spiralworld.spiraldine.theme.WarmBackground

@Composable
fun TableSelectionModal(
    isOpen: Boolean,
    restaurant: Restaurant,
    currentTableNumber: String? = null,
    onDismiss: () -> Unit,
    reservationRepository: ReservationRepository,
    onTableSelected: (RestaurantTable) -> Unit
) {
    if (!isOpen) return

    val tables by reservationRepository.getTables(restaurant.id).collectAsState(initial = null)

    var selectedTable by remember(currentTableNumber, tables) {
        mutableStateOf<RestaurantTable?>(
            tables?.firstOrNull { it.tableNumber == currentTableNumber || it.id == currentTableNumber }
        )
    }

    var selectedSection by remember { mutableStateOf("All") }
    var userWarning by remember { mutableStateOf<String?>(null) }

    // Natural numeric sort for tables: 1, 2, 3...
    val sortedTables = remember(tables) {
        tables?.filter { it.isActive }?.sortedWith { a, b ->
            val numA = a.tableNumber.toIntOrNull()
            val numB = b.tableNumber.toIntOrNull()
            if (numA != null && numB != null && numA != numB) {
                numA.compareTo(numB)
            } else {
                a.displayLabel.compareTo(b.displayLabel, ignoreCase = true)
            }
        } ?: emptyList()
    }

    // Extract unique sections
    val sections = remember(sortedTables) {
        val list = sortedTables.map { it.section.ifBlank { "Main Area" } }.distinct()
        if (list.size > 1) listOf("All") + list else emptyList()
    }

    val filteredTables = remember(sortedTables, selectedSection) {
        if (selectedSection == "All" || sections.isEmpty()) {
            sortedTables
        } else {
            sortedTables.filter { it.section.ifBlank { "Main Area" }.equals(selectedSection, ignoreCase = true) }
        }
    }

    val availableCount = remember(sortedTables) {
        sortedTables.count { it.isDineInAvailable }
    }
    val occupiedCount = remember(sortedTables) {
        sortedTables.count { it.isOccupiedForDineIn }
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.55f))
                .padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 480.dp)
                    .fillMaxHeight(0.85f),
                shape = RoundedCornerShape(24.dp),
                color = WarmBackground,
                tonalElevation = 6.dp
            ) {
                Column(
                    modifier = Modifier.fillMaxSize()
                ) {
                    // Header Card
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(SurfaceWhite)
                            .padding(horizontal = 20.dp, vertical = 16.dp)
                            .border(1.dp, CardBorder.copy(alpha = 0.5f), RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp))
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            // Badge: Dine-In Seating
                            Row(
                                modifier = Modifier
                                    .background(SpiralDineOrangeLight, RoundedCornerShape(20.dp))
                                    .border(0.5.dp, SpiralDineOrange.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
                                    .padding(horizontal = 10.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Coffee,
                                    contentDescription = "Dine-In",
                                    tint = SpiralDineOrange,
                                    modifier = Modifier.size(12.dp)
                                )
                                Text(
                                    text = "Dine-In Seating",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SpiralDineOrange
                                )
                            }

                            IconButton(
                                onClick = onDismiss,
                                modifier = Modifier.size(40.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Close",
                                    tint = TextSecondary,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = "Where are you dining?",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimary
                        )

                        Text(
                            text = "At ${restaurant.name} — select the table you are sitting at to continue.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        // Stats Summary Row
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier
                                    .background(LightGreen, RoundedCornerShape(8.dp))
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .background(PrimaryGreen, CircleShape)
                                )
                                Text(
                                    text = "$availableCount Available",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PrimaryGreen
                                )
                            }

                            Row(
                                modifier = Modifier
                                    .background(SurfaceMuted, RoundedCornerShape(8.dp))
                                    .padding(horizontal = 8.dp, vertical = 3.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .background(TextSecondary, CircleShape)
                                )
                                Text(
                                    text = "$occupiedCount Occupied",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = TextSecondary
                                )
                            }
                        }
                    }

                    // Section Filter Chips if available
                    if (sections.isNotEmpty()) {
                        LazyRow(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(sections) { sec ->
                                val isSelected = sec.equals(selectedSection, ignoreCase = true)
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (isSelected) PrimaryGreen else SurfaceWhite)
                                        .border(1.dp, if (isSelected) PrimaryGreen else CardBorder, RoundedCornerShape(12.dp))
                                        .clickable { selectedSection = sec }
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = sec,
                                        fontSize = 11.sp,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                        color = if (isSelected) Color.White else TextPrimary
                                    )
                                }
                            }
                        }
                    }

                    // Inline User Warning / Hint
                    if (userWarning != null) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 4.dp)
                                .background(Color(0xFFFFF7ED), RoundedCornerShape(10.dp))
                                .border(1.dp, Color(0xFFFED7AA), RoundedCornerShape(10.dp))
                                .padding(8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = "Notice",
                                tint = SpiralDineOrange,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = userWarning ?: "",
                                fontSize = 11.sp,
                                color = Color(0xFF9A3412),
                                modifier = Modifier.weight(1f)
                            )
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Dismiss",
                                tint = Color(0xFF9A3412),
                                modifier = Modifier
                                    .size(14.dp)
                                    .clickable { userWarning = null }
                            )
                        }
                    }

                    // Main Table Grid / Content
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 16.dp)
                    ) {
                        when {
                            tables == null -> {
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(28.dp),
                                            color = PrimaryGreen,
                                            strokeWidth = 2.5.dp
                                        )
                                        Text(
                                            text = "Loading real-time tables...",
                                            fontSize = 12.sp,
                                            color = TextSecondary
                                        )
                                    }
                                }
                            }
                            sortedTables.isEmpty() -> {
                                Box(
                                    modifier = Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        verticalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.padding(24.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Coffee,
                                            contentDescription = "No tables",
                                            tint = TextSecondary,
                                            modifier = Modifier.size(40.dp)
                                        )
                                        Text(
                                            text = "No tables configured yet for this venue.",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary,
                                            textAlign = TextAlign.Center
                                        )
                                        Text(
                                            text = "You can still browse the menu or order takeaway.",
                                            fontSize = 11.sp,
                                            color = TextSecondary,
                                            textAlign = TextAlign.Center
                                        )
                                    }
                                }
                            }
                            else -> {
                                LazyVerticalGrid(
                                    columns = GridCells.Adaptive(minSize = 130.dp),
                                    modifier = Modifier.fillMaxSize(),
                                    contentPadding = PaddingValues(vertical = 8.dp),
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    items(filteredTables, key = { it.id }) { table ->
                                        val isSelected = selectedTable?.id == table.id
                                        val isAvailable = table.isDineInAvailable
                                        val isOccupied = table.isOccupiedForDineIn

                                        Card(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .border(
                                                    width = if (isSelected) 2.dp else 1.dp,
                                                    color = when {
                                                        isSelected -> PrimaryGreen
                                                        isAvailable -> CardBorder
                                                        else -> CardBorder.copy(alpha = 0.5f)
                                                    },
                                                    shape = RoundedCornerShape(16.dp)
                                                )
                                                .clickable {
                                                    if (isAvailable) {
                                                        selectedTable = table
                                                        userWarning = null
                                                    } else {
                                                        userWarning = "${table.displayLabel} is currently occupied with an active dining order. Please choose an available table."
                                                    }
                                                },
                                            shape = RoundedCornerShape(16.dp),
                                            colors = CardDefaults.cardColors(
                                                containerColor = when {
                                                    isSelected -> LightGreen
                                                    isAvailable -> SurfaceWhite
                                                    else -> SurfaceMuted.copy(alpha = 0.7f)
                                                }
                                            ),
                                            elevation = CardDefaults.cardElevation(
                                                defaultElevation = if (isSelected) 3.dp else 0.dp
                                            )
                                        ) {
                                            Column(
                                                modifier = Modifier.padding(12.dp),
                                                verticalArrangement = Arrangement.spacedBy(6.dp)
                                            ) {
                                                Row(
                                                    modifier = Modifier.fillMaxWidth(),
                                                    horizontalArrangement = Arrangement.SpaceBetween,
                                                    verticalAlignment = Alignment.CenterVertically
                                                ) {
                                                    // Capacity indicator
                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                                                    ) {
                                                        Icon(
                                                            imageVector = Icons.Default.Group,
                                                            contentDescription = "Capacity",
                                                            tint = if (isAvailable) TextSecondary else TextSecondary.copy(alpha = 0.5f),
                                                            modifier = Modifier.size(13.dp)
                                                        )
                                                        Text(
                                                            text = "${table.effectiveCapacity} seats",
                                                            fontSize = 10.sp,
                                                            color = if (isAvailable) TextSecondary else TextSecondary.copy(alpha = 0.5f)
                                                        )
                                                    }

                                                    // Status badge
                                                    Box(
                                                        modifier = Modifier
                                                            .background(
                                                                color = when {
                                                                    isSelected -> PrimaryGreen
                                                                    isAvailable -> Color(0xFFDCFCE7)
                                                                    else -> Color(0xFFF1F5F9)
                                                                },
                                                                shape = RoundedCornerShape(6.dp)
                                                            )
                                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                                    ) {
                                                        Text(
                                                            text = when {
                                                                isSelected -> "Selected"
                                                                isAvailable -> "Available"
                                                                else -> "Occupied"
                                                            },
                                                            fontSize = 9.sp,
                                                            fontWeight = FontWeight.Bold,
                                                            color = when {
                                                                isSelected -> Color.White
                                                                isAvailable -> Color(0xFF15803D)
                                                                else -> Color(0xFF64748B)
                                                            }
                                                        )
                                                    }
                                                }

                                                Text(
                                                    text = table.displayLabel,
                                                    fontSize = 14.sp,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    color = if (isAvailable) TextPrimary else TextSecondary,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )

                                                if (table.section.isNotBlank()) {
                                                    Text(
                                                        text = table.section,
                                                        fontSize = 10.sp,
                                                        color = TextSecondary,
                                                        maxLines = 1,
                                                        overflow = TextOverflow.Ellipsis
                                                    )
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Footer Action Bar
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = SurfaceWhite,
                        tonalElevation = 4.dp,
                        border = androidx.compose.foundation.BorderStroke(1.dp, CardBorder)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Button(
                                onClick = onDismiss,
                                modifier = Modifier.weight(1f).height(46.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = SurfaceMuted,
                                    contentColor = TextPrimary
                                )
                            ) {
                                Text(
                                    text = "Cancel",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }

                            Button(
                                onClick = {
                                    val t = selectedTable
                                    if (t != null && t.isDineInAvailable) {
                                        onTableSelected(t)
                                    }
                                },
                                enabled = selectedTable != null && (selectedTable?.isDineInAvailable == true),
                                modifier = Modifier.weight(2f).height(46.dp),
                                shape = RoundedCornerShape(14.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = SpiralDineOrange,
                                    contentColor = Color.White,
                                    disabledContainerColor = Color(0xFFE2E8F0),
                                    disabledContentColor = Color(0xFF94A3B8)
                                )
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = if (selectedTable != null) "Confirm ${selectedTable?.displayLabel}" else "Select a Table",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Icon(
                                        imageVector = Icons.Default.ArrowForward,
                                        contentDescription = null,
                                        modifier = Modifier.size(14.dp)
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
