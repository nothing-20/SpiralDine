package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.ReservationRecord
import com.spiraldine.owner.data.model.TableRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerReservationsScreen(
    reservations: List<ReservationRecord>,
    tables: List<TableRecord>,
    onBack: () -> Unit,
    onUpdateStatus: (reservationId: String, newStatus: String, tableId: String?) -> Unit,
    onAddReservation: (name: String, phone: String, date: String, time: String, guests: Int, tableNum: String) -> Unit
) {
    var selectedFilter by remember { mutableStateOf("All") }
    var showAddDialog by remember { mutableStateOf(false) }

    val filterOptions = listOf("All", "Pending", "Confirmed", "Seated", "Completed")

    val filteredReservations = remember(reservations, selectedFilter) {
        if (selectedFilter == "All") reservations
        else reservations.filter { it.status.equals(selectedFilter, ignoreCase = true) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Table Reservations", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showAddDialog = true },
                containerColor = TerracottaOrange,
                contentColor = SurfaceWhite,
                shape = CircleShape,
                modifier = Modifier.size(56.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = "Add Reservation")
            }
        },
        containerColor = BackgroundLight
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Filter Chips
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filterOptions) { filter ->
                    val isSelected = filter == selectedFilter
                    Surface(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .clickable { selectedFilter = filter },
                        color = if (isSelected) TerracottaOrange else SurfaceWhite,
                        shape = RoundedCornerShape(20.dp),
                        border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, BorderLight)
                    ) {
                        Text(
                            text = filter,
                            color = if (isSelected) SurfaceWhite else TextSecondary,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                        )
                    }
                }
            }

            // Reservations List
            if (filteredReservations.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(bottom = 60.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(TerracottaOrangeLight),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Outlined.EventAvailable, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(32.dp))
                        }
                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = if (selectedFilter == "All") "No reservations booked" else "No $selectedFilter reservations",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Diner bookings from the web and customer app will appear here in real-time.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            modifier = Modifier.padding(horizontal = 32.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 80.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(filteredReservations, key = { it.id }) { res ->
                        ReservationItemCard(
                            reservation = res,
                            tables = tables,
                            onUpdateStatus = onUpdateStatus
                        )
                    }
                }
            }
        }
    }

    // Add Reservation Dialog
    if (showAddDialog) {
        AddReservationDialog(
            tables = tables,
            onDismiss = { showAddDialog = false },
            onConfirm = { name, phone, date, time, guests, tableNum ->
                showAddDialog = false
                onAddReservation(name, phone, date, time, guests, tableNum)
            }
        )
    }
}

@Composable
private fun ReservationItemCard(
    reservation: ReservationRecord,
    tables: List<TableRecord>,
    onUpdateStatus: (String, String, String?) -> Unit
) {
    val statusColor = when (reservation.status.lowercase()) {
        "confirmed" -> SuccessGreen
        "seated" -> InfoBlue
        "arrived" -> Color(0xFF7C3AED)
        "cancelled" -> ErrorRed
        else -> WarningAmber
    }

    val statusBg = when (reservation.status.lowercase()) {
        "confirmed" -> SuccessGreenLight
        "seated" -> InfoBlueLight
        "arrived" -> Color(0xFFFAF5FF)
        "cancelled" -> Color(0xFFFEE2E2)
        else -> WarningAmberLight
    }

    OwnerCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header: Name & Status Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(TerracottaOrangeLight),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Person, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(20.dp))
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = reservation.customerName,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        if (reservation.customerPhone.isNotBlank()) {
                            Text(
                                text = reservation.customerPhone,
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }
                    }
                }

                Surface(
                    color = statusBg,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = reservation.status.uppercase(),
                        color = statusColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Details row: Date, Time, Guests, Table
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.CalendarToday, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(reservation.date.ifBlank { "Today" }, fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Schedule, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(reservation.time.ifBlank { "7:00 PM" }, fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Group, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("${reservation.guests} Guests", fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                }

                if (reservation.tableNumber.isNotBlank()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.TableBar, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("T-${reservation.tableNumber}", fontSize = 12.sp, color = TerracottaOrange, fontWeight = FontWeight.Bold)
                    }
                }
            }

            if (reservation.specialNotes.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Note: ${reservation.specialNotes}",
                    fontSize = 11.sp,
                    color = TextSecondary,
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                )
            }

            // Quick Status Actions
            if (reservation.status.equals("Pending", ignoreCase = true) || reservation.status.equals("Confirmed", ignoreCase = true)) {
                Spacer(modifier = Modifier.height(14.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (reservation.status.equals("Pending", ignoreCase = true)) {
                        Button(
                            onClick = { onUpdateStatus(reservation.id, "Confirmed", reservation.tableId.ifBlank { null }) },
                            colors = ButtonDefaults.buttonColors(containerColor = SuccessGreen),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f).height(40.dp)
                        ) {
                            Text("Confirm Booking", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    if (reservation.status.equals("Confirmed", ignoreCase = true)) {
                        Button(
                            onClick = { onUpdateStatus(reservation.id, "Seated", reservation.tableId.ifBlank { "T-${reservation.tableNumber}" }) },
                            colors = ButtonDefaults.buttonColors(containerColor = InfoBlue),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.weight(1f).height(40.dp)
                        ) {
                            Text("Seat at Table", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    OutlinedButton(
                        onClick = { onUpdateStatus(reservation.id, "Cancelled", null) },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier.height(40.dp)
                    ) {
                        Text("Cancel", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun AddReservationDialog(
    tables: List<TableRecord>,
    onDismiss: () -> Unit,
    onConfirm: (String, String, String, String, Int, String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var date by remember {
        val now = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
        mutableStateOf(now)
    }
    var time by remember { mutableStateOf("19:00") }
    var guests by remember { mutableStateOf("2") }
    var selectedTable by remember { mutableStateOf(tables.firstOrNull()?.tableNumber ?: "1") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Reservation", fontWeight = FontWeight.Bold, fontSize = 16.sp) },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Customer Name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Phone Number") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = date,
                        onValueChange = { date = it },
                        label = { Text("Date (YYYY-MM-DD)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )

                    OutlinedTextField(
                        value = time,
                        onValueChange = { time = it },
                        label = { Text("Time (HH:MM)") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = guests,
                        onValueChange = { guests = it.filter { ch -> ch.isDigit() } },
                        label = { Text("Party Size") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f)
                    )

                    OutlinedTextField(
                        value = selectedTable,
                        onValueChange = { selectedTable = it },
                        label = { Text("Table #") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (name.isNotBlank()) {
                        val g = guests.toIntOrNull() ?: 2
                        onConfirm(name.trim(), phone.trim(), date.trim(), time.trim(), g, selectedTable.trim())
                    }
                },
                enabled = name.isNotBlank(),
                colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
            ) {
                Text("Save Reservation")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextSecondary)
            }
        }
    )
}
