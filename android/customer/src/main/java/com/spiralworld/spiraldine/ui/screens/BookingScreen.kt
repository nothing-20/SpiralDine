package com.spiralworld.spiraldine.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EventSeat
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.google.firebase.auth.FirebaseUser
import com.spiralworld.spiraldine.data.model.CustomerReservation
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.RestaurantTable
import com.spiralworld.spiraldine.data.repository.ReservationRepository
import com.spiralworld.spiraldine.theme.BorderColor
import com.spiralworld.spiraldine.theme.CardBackground
import com.spiralworld.spiraldine.theme.DeepGreen
import com.spiralworld.spiraldine.theme.LightGreen
import com.spiralworld.spiraldine.theme.MainBackground
import com.spiralworld.spiraldine.theme.OpenStatusColor
import com.spiralworld.spiraldine.theme.PrimaryGreen
import com.spiralworld.spiraldine.theme.PrimaryText
import com.spiralworld.spiraldine.theme.SecondaryText
import com.spiralworld.spiraldine.theme.TerracottaAccent
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

@Composable
fun BookingScreen(
    restaurants: List<Restaurant>,
    preselectedRestaurant: Restaurant? = null,
    currentUser: com.spiralworld.spiraldine.data.model.CustomerUser?,
    reservationRepository: ReservationRepository,
    onBack: () -> Unit,
    onViewMenu: ((Restaurant) -> Unit)? = null,
    onToast: (String) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val sdfDate = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }
    val sdfDisplayDate = remember { SimpleDateFormat("EEE, dd MMM", Locale.US) }

    // Multi-step Flow State
    var selectedRestaurant by remember(preselectedRestaurant) { mutableStateOf(preselectedRestaurant) }
    var searchQuery by remember { mutableStateOf("") }
    
    // Date & Time
    val calendar = remember { Calendar.getInstance() }
    val availableDates = remember {
        val list = mutableListOf<Pair<String, String>>()
        val cal = Calendar.getInstance()
        for (i in 0..6) {
            val dateStr = sdfDate.format(cal.time)
            val displayStr = if (i == 0) "Today" else if (i == 1) "Tomorrow" else sdfDisplayDate.format(cal.time)
            list.add(Pair(dateStr, displayStr))
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }
        list
    }

    var selectedDate by remember { mutableStateOf(availableDates.firstOrNull()?.first ?: sdfDate.format(Date())) }
    var selectedTimeSlot by remember { mutableStateOf("") }
    var partySize by remember { mutableIntStateOf(2) }
    var specialNotes by remember { mutableStateOf("") }

    // Custom Time Selection State
    var isCustomTimeSelected by remember { mutableStateOf(false) }
    var customTimeInput by remember { mutableStateOf("19:30") }
    var customTimeError by remember { mutableStateOf<String?>(null) }
    
    // Table Selection State
    var tablesList by remember { mutableStateOf<List<RestaurantTable>>(emptyList()) }
    var conflictingReservations by remember { mutableStateOf<List<CustomerReservation>>(emptyList()) }
    var selectedTable by remember { mutableStateOf<RestaurantTable?>(null) }
    var isTablesLoading by remember { mutableStateOf(false) }

    // Customer History
    var customerReservations by remember { mutableStateOf<List<CustomerReservation>>(emptyList()) }
    var showHistorySection by remember { mutableStateOf(false) }

    // Submission & Confirmation
    var isSubmitting by remember { mutableStateOf(false) }
    var confirmedReservation by remember { mutableStateOf<CustomerReservation?>(null) }

    // Helper: Validate and apply custom booking time
    fun validateAndApplyCustomTime(timeStr: String, rest: Restaurant): Boolean {
        val reqMins = com.spiralworld.spiraldine.data.repository.OperatingHoursEngine.parseTimeToMinutes(timeStr)
        if (reqMins == null) {
            customTimeError = "Enter valid time (e.g. 19:30 or 7:30 PM)"
            return false
        }
        val opTime = rest.businessHours?.openingTime?.ifBlank { null } ?: "11:00"
        val clTime = rest.businessHours?.closingTime?.ifBlank { null } ?: "23:00"
        val openMins = com.spiralworld.spiraldine.data.repository.OperatingHoursEngine.parseTimeToMinutes(opTime) ?: 660
        val closeMins = com.spiralworld.spiraldine.data.repository.OperatingHoursEngine.parseTimeToMinutes(clTime) ?: 1380

        val isWithinHours = if (openMins <= closeMins) {
            reqMins in openMins..closeMins
        } else {
            reqMins >= openMins || reqMins <= closeMins
        }

        if (!isWithinHours) {
            customTimeError = "${rest.name} operates from $opTime to $clTime."
            return false
        }

        val todayStr = sdfDate.format(Date())
        if (selectedDate == todayStr) {
            val nowCal = Calendar.getInstance()
            val nowMins = nowCal.get(Calendar.HOUR_OF_DAY) * 60 + nowCal.get(Calendar.MINUTE)
            if (reqMins <= nowMins + 15) {
                customTimeError = "Selected time has already passed for today."
                return false
            }
        }

        customTimeError = null
        selectedTimeSlot = com.spiralworld.spiraldine.data.repository.OperatingHoursEngine.formatMinutesToDisplay(reqMins)
        selectedTable = null
        return true
    }

    // 1. Fetch tables & reservations when restaurant and date change
    LaunchedEffect(selectedRestaurant?.id, selectedDate) {
        val rId = selectedRestaurant?.id
        if (!rId.isNullOrBlank()) {
            isTablesLoading = true
            launch {
                reservationRepository.getTables(rId).collectLatest { tbls ->
                    tablesList = tbls
                    isTablesLoading = false
                }
            }
            launch {
                reservationRepository.getReservationsForDate(rId, selectedDate).collectLatest { resList ->
                    conflictingReservations = resList
                }
            }
        } else {
            tablesList = emptyList()
            selectedTable = null
        }
    }

    // 2. Fetch customer's own reservations
    LaunchedEffect(currentUser?.uid) {
        val uid = currentUser?.uid
        if (!uid.isNullOrBlank()) {
            reservationRepository.getCustomerReservations(uid).collectLatest { resList ->
                customerReservations = resList
            }
        }
    }

    // Initialize default time slot when restaurant is picked
    LaunchedEffect(selectedRestaurant) {
        selectedRestaurant?.let { rest ->
            val slots = rest.bookingConfig.availableTimeSlots
            if (slots.isNotEmpty() && selectedTimeSlot.isBlank()) {
                selectedTimeSlot = slots.first()
            }
        }
    }

    // CONFIRMATION SUCCESS VIEW
    if (confirmedReservation != null) {
        val conf = confirmedReservation!!
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(MainBackground)
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(24.dp))
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .background(LightGreen, CircleShape)
                        .border(2.dp, PrimaryGreen, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Success",
                        tint = PrimaryGreen,
                        modifier = Modifier.size(40.dp)
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Reservation Confirmed!",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    color = PrimaryText
                )
                Text(
                    text = "Your table has been reserved and synced with the restaurant.",
                    fontSize = 12.sp,
                    color = SecondaryText,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderColor))
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = "Booking Reference", fontSize = 11.sp, color = SecondaryText)
                            Text(
                                text = conf.bookingId.ifBlank { conf.id },
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                color = TerracottaAccent
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Restaurant", fontSize = 11.sp, color = SecondaryText)
                            Text(text = conf.restaurantName, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PrimaryText)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Reserved Table", fontSize = 11.sp, color = SecondaryText)
                            Text(
                                text = if (conf.tableNumber.isNotBlank()) "Table #${conf.tableNumber}" else "Assigned upon arrival",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = PrimaryGreen
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Date & Time", fontSize = 11.sp, color = SecondaryText)
                            Text(text = "${conf.date} • ${conf.time}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PrimaryText)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Party Size", fontSize = 11.sp, color = SecondaryText)
                            Text(text = "${conf.guests} Guests", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PrimaryText)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = "Status", fontSize = 11.sp, color = SecondaryText)
                            Box(
                                modifier = Modifier
                                    .background(LightGreen, RoundedCornerShape(8.dp))
                                    .padding(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = conf.status.uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    color = DeepGreen
                                )
                            }
                        }
                    }
                }
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (onViewMenu != null && selectedRestaurant != null) {
                        Button(
                            onClick = { onViewMenu(selectedRestaurant!!) },
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = LightGreen,
                                contentColor = DeepGreen
                            )
                        ) {
                            Text("View Menu", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Button(
                        onClick = {
                            confirmedReservation = null
                            selectedRestaurant = null
                            selectedTable = null
                            onBack()
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = PrimaryGreen,
                            contentColor = Color.White
                        )
                    ) {
                        Text("Done", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        return
    }

    // MAIN BOOKING COMPONENT
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MainBackground),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // TOP APP BAR - Responsive Header
        item {
            BoxWithConstraints(modifier = Modifier.fillMaxWidth()) {
                val isWide = maxWidth >= 460.dp
                if (isWide) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            modifier = Modifier.weight(1f),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            IconButton(onClick = {
                                if (selectedRestaurant != null && preselectedRestaurant == null) {
                                    selectedRestaurant = null
                                    selectedTable = null
                                } else {
                                    onBack()
                                }
                            }) {
                                Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "Back", tint = PrimaryText)
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = if (selectedRestaurant == null) "Book a Table" else "Reserve at ${selectedRestaurant?.name}",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Black,
                                    color = PrimaryText,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = if (selectedRestaurant == null) "Select a restaurant near you" else "Choose date, time & preferred table",
                                    fontSize = 11.sp,
                                    color = SecondaryText,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        if (customerReservations.isNotEmpty()) {
                            Spacer(modifier = Modifier.width(8.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (showHistorySection) LightGreen else Color.White)
                                    .border(1.dp, if (showHistorySection) PrimaryGreen else BorderColor, RoundedCornerShape(12.dp))
                                    .clickable { showHistorySection = !showHistorySection }
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.History,
                                        contentDescription = null,
                                        tint = if (showHistorySection) DeepGreen else PrimaryText,
                                        modifier = Modifier.size(14.dp)
                                    )
                                    Text(
                                        text = if (showHistorySection) "Hide Bookings" else "My Bookings (${customerReservations.size})",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (showHistorySection) DeepGreen else PrimaryText
                                    )
                                }
                            }
                        }
                    }
                } else {
                    // Narrow screen layout: Stacked responsive arrangement
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            IconButton(
                                onClick = {
                                    if (selectedRestaurant != null && preselectedRestaurant == null) {
                                        selectedRestaurant = null
                                        selectedTable = null
                                    } else {
                                        onBack()
                                    }
                                },
                                modifier = Modifier.size(36.dp)
                            ) {
                                Icon(imageVector = Icons.Default.ArrowBack, contentDescription = "Back", tint = PrimaryText)
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = if (selectedRestaurant == null) "Book a Table" else "Reserve at ${selectedRestaurant?.name}",
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.Black,
                                    color = PrimaryText,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = if (selectedRestaurant == null) "Select a restaurant near you" else "Choose date, time & preferred table",
                                    fontSize = 11.sp,
                                    color = SecondaryText,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        if (customerReservations.isNotEmpty()) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 44.dp),
                                horizontalArrangement = Arrangement.Start
                            ) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (showHistorySection) LightGreen else Color.White)
                                        .border(1.dp, if (showHistorySection) PrimaryGreen else BorderColor, RoundedCornerShape(10.dp))
                                        .clickable { showHistorySection = !showHistorySection }
                                        .padding(horizontal = 10.dp, vertical = 5.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.History,
                                            contentDescription = null,
                                            tint = if (showHistorySection) DeepGreen else PrimaryText,
                                            modifier = Modifier.size(13.dp)
                                        )
                                        Text(
                                            text = if (showHistorySection) "Hide Bookings" else "My Bookings (${customerReservations.size})",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (showHistorySection) DeepGreen else PrimaryText
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // CUSTOMER BOOKING HISTORY DRAWER (If toggled or active)
        if (showHistorySection && customerReservations.isNotEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White, RoundedCornerShape(20.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(20.dp))
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Your Recent Reservations",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Black,
                        color = PrimaryText
                    )
                    customerReservations.forEach { res ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = MainBackground),
                            border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderColor))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = res.restaurantName,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = PrimaryText
                                    )
                                    Text(
                                        text = "${res.date} at ${res.time} • ${res.guests} Guests",
                                        fontSize = 10.sp,
                                        color = SecondaryText
                                    )
                                    if (res.tableNumber.isNotBlank()) {
                                        Text(
                                            text = "Table #${res.tableNumber}",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = PrimaryGreen
                                        )
                                    }
                                }

                                Column(horizontalAlignment = Alignment.End) {
                                    Box(
                                        modifier = Modifier
                                            .background(
                                                when (res.status.lowercase()) {
                                                    "confirmed", "seated" -> LightGreen
                                                    "cancelled" -> Color(0xFFFFECEC)
                                                    else -> Color(0xFFFFF3EE)
                                                },
                                                RoundedCornerShape(6.dp)
                                            )
                                            .padding(horizontal = 6.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            text = res.status.uppercase(),
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Black,
                                            color = when (res.status.lowercase()) {
                                                "confirmed", "seated" -> DeepGreen
                                                "cancelled" -> Color(0xFFD9534F)
                                                else -> TerracottaAccent
                                            }
                                        )
                                    }

                                    if (res.isActiveReservation) {
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = "Cancel",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.Red,
                                            modifier = Modifier
                                                .clickable {
                                                    coroutineScope.launch {
                                                        val cancelRes = reservationRepository.cancelReservation(res)
                                                        if (cancelRes.isSuccess) {
                                                            onToast("Reservation #${res.bookingId} cancelled.")
                                                        } else {
                                                            onToast("Cancellation failed: ${cancelRes.exceptionOrNull()?.message}")
                                                        }
                                                    }
                                                }
                                                .padding(2.dp)
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ==========================================
        // PHASE 1: SELECT RESTAURANT (If none chosen)
        // ==========================================
        if (selectedRestaurant == null) {
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Search restaurants supporting reservations...", fontSize = 12.sp) },
                    leadingIcon = { Icon(imageVector = Icons.Default.Search, contentDescription = null, tint = SecondaryText) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { searchQuery = "" }) {
                                Icon(imageVector = Icons.Default.Close, contentDescription = "Clear", tint = SecondaryText)
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryGreen,
                        unfocusedBorderColor = BorderColor,
                        focusedContainerColor = Color.White,
                        unfocusedContainerColor = Color.White
                    ),
                    singleLine = true
                )
            }

            val filtered = restaurants.filter { r ->
                r.supportsTableBooking && (
                    searchQuery.isBlank() ||
                    r.name.contains(searchQuery, ignoreCase = true) ||
                    r.cuisines.any { it.contains(searchQuery, ignoreCase = true) } ||
                    r.locality.contains(searchQuery, ignoreCase = true)
                )
            }

            if (filtered.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 40.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("No booking-enabled restaurants found", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = PrimaryText)
                        Text("Try clearing your search query", fontSize = 11.sp, color = SecondaryText)
                    }
                }
            } else {
                items(filtered) { r ->
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                selectedRestaurant = r
                                selectedTable = null
                            },
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = CardBackground),
                        border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderColor))
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(10.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            AsyncImage(
                                model = r.imageUrl.ifBlank { "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400" },
                                contentDescription = r.name,
                                modifier = Modifier
                                    .size(70.dp)
                                    .clip(RoundedCornerShape(12.dp)),
                                contentScale = ContentScale.Crop
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = r.name,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Black,
                                    color = PrimaryText,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = r.cuisines.joinToString(" • "),
                                    fontSize = 11.sp,
                                    color = SecondaryText,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(imageVector = Icons.Default.LocationOn, contentDescription = null, tint = PrimaryGreen, modifier = Modifier.size(12.dp))
                                    Text(text = r.locality.ifBlank { r.city }, fontSize = 10.sp, color = SecondaryText, maxLines = 1)
                                }
                            }
                            Button(
                                onClick = {
                                    selectedRestaurant = r
                                    selectedTable = null
                                },
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen, contentColor = Color.White),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text("Book", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        } else {
            // ==========================================
            // PHASE 2: BOOKING DETAILS & TABLE SELECTION
            // ==========================================
            val rest = selectedRestaurant!!

            // Selected Restaurant Header Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderColor))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        AsyncImage(
                            model = rest.imageUrl.ifBlank { "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400" },
                            contentDescription = rest.name,
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(12.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = rest.name, fontSize = 14.sp, fontWeight = FontWeight.Black, color = PrimaryText)
                            Text(text = rest.cuisines.joinToString(" • "), fontSize = 11.sp, color = SecondaryText)
                            Text(text = rest.locality.ifBlank { rest.city }, fontSize = 10.sp, color = SecondaryText)
                        }
                        if (preselectedRestaurant == null) {
                            Text(
                                text = "Change",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = TerracottaAccent,
                                modifier = Modifier
                                    .clickable {
                                        selectedRestaurant = null
                                        selectedTable = null
                                    }
                                    .padding(4.dp)
                            )
                        }
                    }
                }
            }

            // STEP B: SELECT DATE
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(imageVector = Icons.Default.CalendarMonth, contentDescription = null, tint = PrimaryGreen, modifier = Modifier.size(16.dp))
                        Text(text = "Select Date", fontSize = 13.sp, fontWeight = FontWeight.Black, color = PrimaryText)
                    }
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(horizontal = 2.dp)
                    ) {
                        items(availableDates) { (dateKey, displayLabel) ->
                            val isSelected = selectedDate == dateKey
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (isSelected) PrimaryGreen else Color.White)
                                    .border(1.dp, if (isSelected) PrimaryGreen else BorderColor, RoundedCornerShape(14.dp))
                                    .clickable {
                                        selectedDate = dateKey
                                        selectedTable = null // Reset selected table on date switch
                                    }
                                    .padding(horizontal = 14.dp, vertical = 8.dp)
                            ) {
                                Text(
                                    text = displayLabel,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) Color.White else PrimaryText
                                )
                            }
                        }
                    }
                }
            }

            // STEP C: SELECT TIME SLOT & CUSTOM TIME
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(imageVector = Icons.Default.Schedule, contentDescription = null, tint = PrimaryGreen, modifier = Modifier.size(16.dp))
                            Text(text = "Select Time Slot", fontSize = 13.sp, fontWeight = FontWeight.Black, color = PrimaryText)
                        }
                        if (selectedTimeSlot.isNotBlank()) {
                            Text(
                                text = selectedTimeSlot,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = PrimaryGreen
                            )
                        }
                    }

                    val slots = rest.bookingConfig.availableTimeSlots
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(horizontal = 2.dp)
                    ) {
                        items(slots) { slot ->
                            val isSelected = !isCustomTimeSelected && selectedTimeSlot == slot
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (isSelected) PrimaryGreen else Color.White)
                                    .border(1.dp, if (isSelected) PrimaryGreen else BorderColor, RoundedCornerShape(14.dp))
                                    .clickable {
                                        isCustomTimeSelected = false
                                        customTimeError = null
                                        selectedTimeSlot = slot
                                        selectedTable = null // Re-evaluate table availability for slot
                                    }
                                    .padding(horizontal = 14.dp, vertical = 8.dp)
                            ) {
                                Text(
                                    text = slot,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) Color.White else PrimaryText
                                )
                            }
                        }

                        // Custom Time Chip
                        item {
                            val isCustomActive = isCustomTimeSelected
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(if (isCustomActive) PrimaryGreen else Color.White)
                                    .border(1.dp, if (isCustomActive) PrimaryGreen else BorderColor, RoundedCornerShape(14.dp))
                                    .clickable {
                                        isCustomTimeSelected = true
                                        validateAndApplyCustomTime(customTimeInput, rest)
                                    }
                                    .padding(horizontal = 14.dp, vertical = 8.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Edit,
                                        contentDescription = null,
                                        tint = if (isCustomActive) Color.White else PrimaryGreen,
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Text(
                                        text = "Custom Time",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = if (isCustomActive) Color.White else PrimaryText
                                    )
                                }
                            }
                        }
                    }

                    // Custom Time Input Card
                    if (isCustomTimeSelected) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            border = CardDefaults.outlinedCardBorder().copy(brush = androidx.compose.ui.graphics.SolidColor(BorderColor))
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "Enter Custom Dining Time",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PrimaryText
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    OutlinedTextField(
                                        value = customTimeInput,
                                        onValueChange = {
                                            customTimeInput = it
                                            validateAndApplyCustomTime(it, rest)
                                        },
                                        placeholder = { Text("e.g. 19:30 or 7:30 PM", fontSize = 11.sp, color = SecondaryText) },
                                        singleLine = true,
                                        modifier = Modifier.weight(1f),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = PrimaryGreen,
                                            unfocusedBorderColor = BorderColor
                                        ),
                                        leadingIcon = {
                                            Icon(imageVector = Icons.Default.AccessTime, contentDescription = null, tint = PrimaryGreen, modifier = Modifier.size(16.dp))
                                        }
                                    )
                                }

                                if (customTimeError != null) {
                                    Text(
                                        text = customTimeError!!,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = TerracottaAccent
                                    )
                                } else if (selectedTimeSlot.isNotBlank()) {
                                    Text(
                                        text = "✓ Validated reservation time: $selectedTimeSlot",
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = DeepGreen
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // STEP D: SELECT PARTY SIZE
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Icon(imageVector = Icons.Default.People, contentDescription = null, tint = PrimaryGreen, modifier = Modifier.size(16.dp))
                        Text(text = "Party Size", fontSize = 13.sp, fontWeight = FontWeight.Black, color = PrimaryText)
                        Text(text = "(Guests)", fontSize = 11.sp, color = SecondaryText)
                    }
                    val maxG = rest.bookingConfig.maxGuests.coerceAtLeast(8)
                    val guestOptions = listOf(1, 2, 3, 4, 5, 6, 8, 10).filter { it <= maxG }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        guestOptions.forEach { count ->
                            val isSelected = partySize == count
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(if (isSelected) PrimaryGreen else Color.White)
                                    .border(1.dp, if (isSelected) PrimaryGreen else BorderColor, RoundedCornerShape(12.dp))
                                    .clickable {
                                        partySize = count
                                        // Reset selected table if now insufficient capacity
                                        if (selectedTable != null && selectedTable!!.effectiveCapacity < count) {
                                            selectedTable = null
                                        }
                                    }
                                    .padding(horizontal = 12.dp, vertical = 8.dp)
                            ) {
                                Text(
                                    text = "$count",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isSelected) Color.White else PrimaryText
                                )
                            }
                        }
                    }
                }
            }

            // STEP E: SELECT TABLE
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(imageVector = Icons.Default.EventSeat, contentDescription = null, tint = PrimaryGreen, modifier = Modifier.size(16.dp))
                            Text(text = "Choose Table", fontSize = 13.sp, fontWeight = FontWeight.Black, color = PrimaryText)
                        }
                        if (selectedTable != null) {
                            Text(
                                text = "Selected: ${selectedTable?.displayLabel}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = PrimaryGreen
                            )
                        }
                    }

                    if (isTablesLoading) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = PrimaryGreen, strokeWidth = 2.dp)
                            Text("Loading real-time table availability...", fontSize = 11.sp, color = SecondaryText)
                        }
                    } else if (tablesList.isEmpty()) {
                        Text(
                            text = "No configured tables found for this restaurant.",
                            fontSize = 11.sp,
                            color = SecondaryText
                        )
                    } else {
                        // Compute availability for each table for selected date + time
                        val cleanTimeSlot = selectedTimeSlot.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase(Locale.ROOT)
                        val reservedTableIds = conflictingReservations.filter { res ->
                            val resTime = res.time.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase(Locale.ROOT)
                            res.date == selectedDate && resTime == cleanTimeSlot && res.isActiveReservation
                        }.map { it.tableId.ifBlank { it.tableNumber } }.toSet()

                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            tablesList.forEach { table ->
                                val isReserved = reservedTableIds.contains(table.id) || reservedTableIds.contains(table.tableNumber)
                                val hasCapacity = table.effectiveCapacity >= partySize
                                val isSelectable = table.isAvailableForBooking && !isReserved && hasCapacity
                                val isSelected = selectedTable?.id == table.id

                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable(enabled = isSelectable) {
                                            selectedTable = table
                                        },
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(
                                        containerColor = if (isSelected) LightGreen else if (isSelectable) Color.White else Color(0xFFF0F0EE)
                                    ),
                                    border = CardDefaults.outlinedCardBorder().copy(
                                        brush = androidx.compose.ui.graphics.SolidColor(
                                            if (isSelected) PrimaryGreen else if (isSelectable) BorderColor else Color(0xFFE0E0DC)
                                        )
                                    )
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(36.dp)
                                                    .background(
                                                        if (isSelected) PrimaryGreen else if (isSelectable) LightGreen else Color.LightGray,
                                                        RoundedCornerShape(10.dp)
                                                    ),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Icon(
                                                    imageVector = Icons.Default.EventSeat,
                                                    contentDescription = null,
                                                    tint = if (isSelected) Color.White else if (isSelectable) DeepGreen else Color.DarkGray,
                                                    modifier = Modifier.size(18.dp)
                                                )
                                            }
                                            Column {
                                                Text(
                                                    text = table.displayLabel,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = if (isSelectable) PrimaryText else Color.Gray
                                                )
                                                Text(
                                                    text = "Capacity: ${table.effectiveCapacity} seats${if (table.section.isNotBlank()) " • ${table.section}" else ""}",
                                                    fontSize = 10.sp,
                                                    color = SecondaryText
                                                )
                                            }
                                        }

                                        Box(
                                            modifier = Modifier
                                                .background(
                                                    if (isSelected) DeepGreen 
                                                    else if (!hasCapacity) Color(0xFFFFECEC)
                                                    else if (isReserved) Color(0xFFFFECEC) 
                                                    else LightGreen,
                                                    RoundedCornerShape(6.dp)
                                                )
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Text(
                                                text = if (isSelected) "SELECTED" 
                                                    else if (!hasCapacity) "CAPACITY TOO SMALL"
                                                    else if (isReserved) "RESERVED" 
                                                    else "AVAILABLE",
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Black,
                                                color = if (isSelected) Color.White 
                                                    else if (!hasCapacity || isReserved) Color(0xFFD9534F) 
                                                    else DeepGreen
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // STEP F: SPECIAL NOTES & CONFIRMATION
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(text = "Special Requests (Optional)", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = PrimaryText)
                    OutlinedTextField(
                        value = specialNotes,
                        onValueChange = { specialNotes = it },
                        placeholder = { Text("E.g. Table near window, quiet corner, baby chair...", fontSize = 11.sp) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(80.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = PrimaryGreen,
                            unfocusedBorderColor = BorderColor,
                            focusedContainerColor = Color.White,
                            unfocusedContainerColor = Color.White
                        )
                    )
                }
            }

            // CONFIRM RESERVATION BUTTON
            item {
                val canSubmit = selectedTable != null && selectedTimeSlot.isNotBlank() && selectedDate.isNotBlank() && !isSubmitting
                Button(
                    onClick = {
                        if (!canSubmit) return@Button
                        isSubmitting = true
                        coroutineScope.launch {
                            val res = reservationRepository.createReservationAtomic(
                                tenantId = rest.id,
                                restaurantName = rest.name,
                                customerId = currentUser?.uid ?: "guest-uid",
                                customerName = currentUser?.displayName ?: currentUser?.email ?: "Guest Diner",
                                customerPhone = currentUser?.phoneNumber ?: "",
                                customerEmail = currentUser?.email ?: "",
                                date = selectedDate,
                                time = selectedTimeSlot,
                                guests = partySize,
                                tableId = selectedTable!!.id,
                                tableNumber = selectedTable!!.tableNumber,
                                specialNotes = specialNotes,
                                directions = rest.address,
                                latitude = rest.latitude,
                                longitude = rest.longitude
                            )

                            isSubmitting = false
                            if (res.isSuccess) {
                                confirmedReservation = res.getOrNull()
                                onToast("Reservation confirmed successfully!")
                            } else {
                                onToast(res.exceptionOrNull()?.message ?: "Reservation failed. Please try another table.")
                            }
                        }
                    },
                    enabled = canSubmit,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = PrimaryGreen,
                        contentColor = Color.White,
                        disabledContainerColor = Color(0xFFC0D8C5),
                        disabledContentColor = Color.White
                    )
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Text(
                            text = if (selectedTable == null) "Select a Table to Continue" else "Confirm Table Reservation",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                }
            }
        }
    }
}
