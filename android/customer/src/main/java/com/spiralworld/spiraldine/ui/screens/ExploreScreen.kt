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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.NearMe
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.UserLocation
import com.spiralworld.spiraldine.data.repository.DistanceCalculator
import com.spiralworld.spiraldine.data.repository.RestaurantFilterCriteria
import com.spiralworld.spiraldine.data.repository.RestaurantSearchFilterEngine
import com.spiralworld.spiraldine.data.repository.RestaurantSortOption
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.ChipSelected
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.SpiralDineOrangeLight
import com.spiralworld.spiraldine.theme.StarGold
import com.spiralworld.spiraldine.theme.SurfaceMuted
import com.spiralworld.spiraldine.theme.SurfaceWhite
import com.spiralworld.spiraldine.theme.TextPrimary
import com.spiralworld.spiraldine.theme.TextSecondary
import com.spiralworld.spiraldine.theme.WarmBackground
import com.spiralworld.spiraldine.ui.components.RestaurantCard

@Composable
fun ExploreScreen(
    restaurants: List<Restaurant>,
    onRestaurantClick: (Restaurant) -> Unit,
    initialCuisine: String? = null,
    userLocation: UserLocation? = null,
    onRequestLocation: (() -> Unit)? = null
) {
    var criteria by remember(initialCuisine) {
        mutableStateOf(
            RestaurantFilterCriteria(
                selectedCuisine = initialCuisine ?: "All"
            )
        )
    }

    var isSortMenuExpanded by remember { mutableStateOf(false) }

    // Dynamically derive unique cuisines present in data plus canonical favorites
    val supportedCuisines = remember(restaurants) {
        val extracted = restaurants.flatMap { it.cuisines }.filter { it.isNotBlank() }.distinct()
        val canonical = listOf("All", "Biryani", "North Indian", "South Indian", "Mughlai", "Chinese", "Desserts", "Pure Veg")
        val combined = (canonical + extracted).distinct()
        combined
    }

    // Filtered & Sorted list via pure deterministic engine
    val filtered = remember(restaurants, criteria, userLocation) {
        RestaurantSearchFilterEngine.filterAndSort(
            restaurants = restaurants,
            criteria = criteria,
            userLocation = userLocation
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(WarmBackground),
        contentPadding = PaddingValues(bottom = 90.dp)
    ) {
        // 1. Search Bar
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 10.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(SurfaceWhite)
                    .border(1.dp, CardBorder, RoundedCornerShape(16.dp))
                    .padding(horizontal = 14.dp, vertical = 12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = if (criteria.searchQuery.isNotBlank()) SpiralDineOrange else TextSecondary,
                        modifier = Modifier.size(20.dp)
                    )
                    BasicTextField(
                        value = criteria.searchQuery,
                        onValueChange = { criteria = criteria.copy(searchQuery = it) },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        decorationBox = { innerTextField ->
                            if (criteria.searchQuery.isEmpty()) {
                                Text(
                                    text = "Search by restaurant, dish, or cuisine...",
                                    fontSize = 13.sp,
                                    color = TextSecondary
                                )
                            }
                            innerTextField()
                        }
                    )
                    if (criteria.searchQuery.isNotEmpty()) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Clear search",
                            tint = TextSecondary,
                            modifier = Modifier
                                .size(18.dp)
                                .clickable { criteria = criteria.copy(searchQuery = "") }
                        )
                    }
                }
            }
        }

        // 2. Filter Chips Horizontal Row
        item {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Open Now
                item {
                    val isSelected = criteria.openNowOnly
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) SpiralDineOrangeLight else SurfaceWhite)
                            .border(1.dp, if (isSelected) SpiralDineOrange else CardBorder, RoundedCornerShape(20.dp))
                            .clickable { criteria = criteria.copy(openNowOnly = !isSelected) }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "Open Now",
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) SpiralDineOrange else TextPrimary
                        )
                    }
                }

                // Pure Veg
                item {
                    val isSelected = criteria.pureVegOnly
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) SpiralDineOrangeLight else SurfaceWhite)
                            .border(1.dp, if (isSelected) SpiralDineOrange else CardBorder, RoundedCornerShape(20.dp))
                            .clickable { criteria = criteria.copy(pureVegOnly = !isSelected) }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "Pure Veg",
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) SpiralDineOrange else TextPrimary
                        )
                    }
                }

                // Offers Available
                item {
                    val isSelected = criteria.offersOnly
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) SpiralDineOrangeLight else SurfaceWhite)
                            .border(1.dp, if (isSelected) SpiralDineOrange else CardBorder, RoundedCornerShape(20.dp))
                            .clickable { criteria = criteria.copy(offersOnly = !isSelected) }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "Offers Available",
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) SpiralDineOrange else TextPrimary
                        )
                    }
                }

                // Verified Rating 4.0+
                item {
                    val isSelected = criteria.minRating != null
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) SpiralDineOrangeLight else SurfaceWhite)
                            .border(1.dp, if (isSelected) SpiralDineOrange else CardBorder, RoundedCornerShape(20.dp))
                            .clickable { criteria = criteria.copy(minRating = if (isSelected) null else 4.0) }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = "Rating",
                                tint = if (isSelected) SpiralDineOrange else StarGold,
                                modifier = Modifier.size(12.dp)
                            )
                            Text(
                                text = "Rating 4.0+",
                                fontSize = 11.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) SpiralDineOrange else TextPrimary
                            )
                        }
                    }
                }

                // Price Tiers
                val priceOptions = listOf("Under ₹500", "₹500 - ₹1000", "Above ₹1000")
                items(priceOptions) { tier ->
                    val isSelected = criteria.selectedPriceTier == tier
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) SpiralDineOrangeLight else SurfaceWhite)
                            .border(1.dp, if (isSelected) SpiralDineOrange else CardBorder, RoundedCornerShape(20.dp))
                            .clickable {
                                criteria = criteria.copy(selectedPriceTier = if (isSelected) null else tier)
                            }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = tier,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) SpiralDineOrange else TextPrimary
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        // 3. Cuisines Horizontal Selector
        item {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(supportedCuisines) { cuisine ->
                    val isSelected = criteria.selectedCuisine.equals(cuisine, ignoreCase = true)
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(if (isSelected) ChipSelected else SurfaceWhite)
                            .border(1.dp, if (isSelected) ChipSelected else CardBorder, RoundedCornerShape(16.dp))
                            .clickable { criteria = criteria.copy(selectedCuisine = cuisine) }
                            .padding(horizontal = 11.dp, vertical = 5.dp)
                    ) {
                        Text(
                            text = cuisine,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            color = if (isSelected) SurfaceWhite else TextPrimary
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
        }

        // 4. Results Count, Sort, and Clear All Bar
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "${filtered.size} restaurants found",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextSecondary
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (criteria.hasActiveFilters) {
                        Text(
                            text = "Clear All",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = SpiralDineOrange,
                            modifier = Modifier.clickable { criteria = criteria.clear() }
                        )
                    }

                    // Sort dropdown button
                    Box {
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(SurfaceWhite)
                                .border(1.dp, CardBorder, RoundedCornerShape(8.dp))
                                .clickable { isSortMenuExpanded = true }
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.FilterList,
                                contentDescription = "Sort",
                                tint = TextSecondary,
                                modifier = Modifier.size(14.dp)
                            )
                            Text(
                                text = criteria.sortBy.displayName,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary
                            )
                        }

                        DropdownMenu(
                            expanded = isSortMenuExpanded,
                            onDismissRequest = { isSortMenuExpanded = false }
                        ) {
                            RestaurantSortOption.values().forEach { option ->
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            text = option.displayName,
                                            fontSize = 12.sp,
                                            fontWeight = if (criteria.sortBy == option) FontWeight.Bold else FontWeight.Normal,
                                            color = if (criteria.sortBy == option) SpiralDineOrange else TextPrimary
                                        )
                                    },
                                    onClick = {
                                        if (option == RestaurantSortOption.DISTANCE_NEAREST && userLocation == null) {
                                            onRequestLocation?.invoke()
                                        }
                                        criteria = criteria.copy(sortBy = option)
                                        isSortMenuExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }

        // 5. Restaurant List or Clear Empty State
        if (filtered.isEmpty()) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 32.dp, vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(SurfaceMuted),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Restaurant,
                            contentDescription = "No results",
                            tint = TextSecondary,
                            modifier = Modifier.size(32.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "No restaurants match your filters",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "Try clearing active filters or searching with a different cuisine or keyword.",
                        fontSize = 12.sp,
                        color = TextSecondary,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = { criteria = criteria.clear() },
                        colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = "Clear All Filters",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = SurfaceWhite
                        )
                    }
                }
            }
        } else {
            items(filtered, key = { it.id }) { restaurant ->
                val distance = remember(userLocation, restaurant) {
                    DistanceCalculator.getRestaurantDistanceKm(userLocation, restaurant)
                }
                RestaurantCard(
                    restaurant = restaurant,
                    distanceKm = distance,
                    onClick = { onRestaurantClick(restaurant) },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                )
            }
        }
    }
}
