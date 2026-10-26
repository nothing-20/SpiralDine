package com.spiralworld.spiraldine.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.LocationCity
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.UserLocation
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.PrimaryGreen
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.SurfaceMuted
import com.spiralworld.spiraldine.theme.SurfaceWhite
import com.spiralworld.spiraldine.theme.TextPrimary
import com.spiralworld.spiraldine.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationSelectionModal(
    isOpen: Boolean,
    onClose: () -> Unit = {},
    currentLocation: UserLocation?,
    onSelectLocation: (UserLocation) -> Unit = {},
    onRequestGpsLocation: () -> Unit = {},
    onDismiss: () -> Unit = onClose,
    onLocationSelected: ((UserLocation) -> Unit)? = null,
    onRequestGps: (() -> Unit)? = null
) {
    if (!isOpen) return

    val effectiveClose = {
        onDismiss()
    }
    val effectiveSelect: (UserLocation) -> Unit = { loc ->
        onLocationSelected?.invoke(loc) ?: onSelectLocation(loc)
    }
    val effectiveGps = {
        onRequestGps?.invoke() ?: onRequestGpsLocation()
    }

    var searchQuery by remember { mutableStateOf("") }

    val popularCities = listOf(
        "Hyderabad, Telangana" to Pair(17.3850, 78.4867),
        "Banjara Hills, Hyderabad" to Pair(17.4156, 78.4347),
        "Gachibowli, Hyderabad" to Pair(17.4401, 78.3489),
        "Madhapur / Hitec City, Hyderabad" to Pair(17.4483, 78.3915),
        "Jubilee Hills, Hyderabad" to Pair(17.4319, 78.4073),
        "Kondapur, Hyderabad" to Pair(17.4699, 78.3578),
        "Secunderabad, Telangana" to Pair(17.4399, 78.4983),
        "Bengaluru, Karnataka" to Pair(12.9716, 77.5946),
        "Indiranagar, Bengaluru" to Pair(12.9784, 77.6408),
        "Koramangala, Bengaluru" to Pair(12.9352, 77.6245),
        "Mumbai, Maharashtra" to Pair(19.0760, 72.8777),
        "Bandra, Mumbai" to Pair(19.0596, 72.8295),
        "Delhi NCR, India" to Pair(28.6139, 77.2090),
        "Chennai, Tamil Nadu" to Pair(13.0827, 80.2707),
        "Pune, Maharashtra" to Pair(18.5204, 73.8567),
        "Kolkata, West Bengal" to Pair(22.5726, 88.3639)
    )

    val filteredCities = remember(searchQuery) {
        if (searchQuery.isBlank()) {
            popularCities
        } else {
            popularCities.filter { it.first.contains(searchQuery, ignoreCase = true) }
        }
    }

    ModalBottomSheet(
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = SurfaceWhite,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Select Location",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Browse restaurants, menus & table bookings nearby",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }

                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(SurfaceMuted)
                        .clickable { effectiveClose() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = TextSecondary,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Use Current Location Action Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, CardBorder, RoundedCornerShape(14.dp))
                    .clickable {
                        effectiveGps()
                        effectiveClose()
                    },
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clip(CircleShape)
                            .background(PrimaryGreen.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.MyLocation,
                            contentDescription = "GPS Location",
                            tint = PrimaryGreen,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Use Current Location",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryGreen
                        )
                        Text(
                            text = "Detect locality using GPS coordinates",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Search Bar
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search city, locality or area...", fontSize = 12.sp) },
                leadingIcon = {
                    Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary, modifier = Modifier.size(18.dp))
                },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "POPULAR CITIES & LOCALITIES",
                fontSize = 11.sp,
                fontWeight = FontWeight.ExtraBold,
                color = TextSecondary,
                letterSpacing = 1.sp
            )

            Spacer(modifier = Modifier.height(8.dp))

            // List of Cities
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(280.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(filteredCities) { (name, coords) ->
                    val isSelected = currentLocation?.localityName == name ||
                            (currentLocation == null && name == "Hyderabad, Telangana")

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (isSelected) PrimaryGreen.copy(alpha = 0.08f) else SurfaceWhite)
                            .clickable {
                                effectiveSelect(
                                    UserLocation(
                                        latitude = coords.first,
                                        longitude = coords.second,
                                        localityName = name
                                    )
                                )
                                effectiveClose()
                            }
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = if (isSelected) Icons.Default.LocationOn else Icons.Default.LocationCity,
                                contentDescription = null,
                                tint = if (isSelected) PrimaryGreen else TextSecondary,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = name,
                                fontSize = 13.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                color = if (isSelected) PrimaryGreen else TextPrimary
                            )
                        }

                        if (isSelected) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Selected",
                                tint = PrimaryGreen,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }

                if (filteredCities.isEmpty() && searchQuery.isNotBlank()) {
                    item {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    effectiveSelect(
                                        UserLocation(
                                            latitude = 17.3850,
                                            longitude = 78.4867,
                                            localityName = searchQuery.trim()
                                        )
                                    )
                                    effectiveClose()
                                }
                                .padding(vertical = 8.dp),
                            colors = CardDefaults.cardColors(containerColor = SurfaceMuted),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.LocationOn, contentDescription = null, tint = SpiralDineOrange)
                                Text(
                                    text = "Set location to \"${searchQuery.trim()}\"",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
