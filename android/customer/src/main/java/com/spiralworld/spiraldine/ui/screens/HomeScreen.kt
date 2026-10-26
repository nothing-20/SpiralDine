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
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.NearMe
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.spiralworld.spiraldine.data.model.CustomerProfile
import com.spiralworld.spiraldine.data.model.CustomerUser
import com.spiralworld.spiraldine.data.model.DiningSession
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.Promotion
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.UserLocation
import com.spiralworld.spiraldine.data.repository.DistanceCalculator
import com.spiralworld.spiraldine.theme.BorderColor
import com.spiralworld.spiraldine.theme.CardBackground
import com.spiralworld.spiraldine.theme.DeepGreen
import com.spiralworld.spiraldine.theme.LightGreen
import com.spiralworld.spiraldine.theme.MainBackground
import com.spiralworld.spiraldine.theme.PrimaryGreen
import com.spiralworld.spiraldine.theme.PrimaryText
import com.spiralworld.spiraldine.theme.SecondaryText
import com.spiralworld.spiraldine.theme.SuccessGreen
import com.spiralworld.spiraldine.theme.TerracottaAccent
import com.spiralworld.spiraldine.ui.components.PopularDishCard
import com.spiralworld.spiraldine.ui.components.PromotionsBanner
import com.spiralworld.spiraldine.ui.components.RestaurantCard
import com.spiralworld.spiraldine.ui.components.RestaurantCardSkeleton

@Composable
fun HomeScreen(
    restaurants: List<Restaurant>,
    promotions: List<Promotion>,
    diningSession: DiningSession?,
    popularDishes: List<Pair<MenuItem, Restaurant>> = emptyList(),
    isLoading: Boolean = false,
    onRestaurantClick: (Restaurant) -> Unit,
    onSearchClick: () -> Unit,
    onQrClick: () -> Unit,
    onOrdersClick: () -> Unit = {},
    onBookTableClick: () -> Unit = {},
    onDishClick: ((MenuItem, Restaurant) -> Unit)? = null,
    onApplyCoupon: (Promotion) -> Unit,
    onCuisineClick: (String) -> Unit,
    userLocation: UserLocation? = null,
    onRequestLocation: (() -> Unit)? = null,
    onLocationClick: (() -> Unit)? = null,
    onNotificationClick: (() -> Unit)? = null,
    unreadNotificationCount: Int = 0,
    onFavoritesClick: (() -> Unit)? = null,
    favouriteRestaurantIds: Set<String> = emptySet(),
    onToggleFavourite: ((Restaurant) -> Unit)? = null,
    onLeaveTable: ((DiningSession) -> Unit)? = null,
    user: CustomerUser? = null,
    userProfile: CustomerProfile? = null,
    onProfileClick: (() -> Unit)? = null
) {
    var showLeaveTableConfirmation by remember { mutableStateOf(false) }

    // Location-based restaurant filtering: shows venues matching the customer's selected browsing locality/city
    val filteredByLocationRestaurants = remember(restaurants, userLocation) {
        val allDistinct = restaurants.distinctBy { it.id }
        if (userLocation == null || userLocation.localityName.isNullOrBlank()) {
            allDistinct
        } else {
            val locQuery = userLocation.localityName.lowercase()
            val tokens = locQuery.split(",", " ").map { it.trim() }.filter { it.length > 2 }

            val matches = allDistinct.filter { rest ->
                val rCity = rest.city.lowercase()
                val rLocality = rest.locality.lowercase()
                val rAddress = rest.address.lowercase()

                if (tokens.isEmpty()) {
                    true
                } else {
                    tokens.any { token ->
                        rCity.contains(token) || rLocality.contains(token) || rAddress.contains(token)
                    }
                }
            }
            matches
        }
    }

    // Supported cuisines derived from real restaurant catalog + canonical staples
    val dynamicCuisines = remember(filteredByLocationRestaurants) {
        val fromData = filteredByLocationRestaurants.flatMap { it.cuisines }.filter { it.isNotBlank() }.distinct()
        val staples = listOf("Biryani", "North Indian", "South Indian", "Chinese", "Pizza", "Desserts")
        (staples + fromData).distinct().take(8)
    }

    // Filter valid promotions only (active status and valid code)
    val eligiblePromotions = remember(promotions) {
        promotions.filter { it.status.equals("active", ignoreCase = true) && it.effectiveCode.isNotBlank() }
    }

    var localFavs by remember { mutableStateOf(setOf<String>()) }
    val effectiveFavs = remember(favouriteRestaurantIds, localFavs) {
        if (favouriteRestaurantIds.isNotEmpty()) favouriteRestaurantIds else localFavs
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MainBackground),
        contentPadding = PaddingValues(bottom = 100.dp)
    ) {
        // ==========================================
        // SECTION A: HEADER AND LOCATION
        // ==========================================
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                // Top Row: Logo & Tagline on Left, Favourite & Notification on Right
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Logo + Wordmark + Tagline
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Stylized SpiralDine Bowl Icon
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(LightGreen)
                                .border(1.dp, BorderColor, RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Restaurant,
                                contentDescription = "SpiralDine Logo",
                                tint = PrimaryGreen,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "Spiral ",
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = PrimaryText
                                )
                                Text(
                                    text = "Dine",
                                    fontSize = 17.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = PrimaryGreen
                                )
                            }
                            Text(
                                text = "Good Food Brings People Together",
                                fontSize = 9.5.sp,
                                fontWeight = FontWeight.Medium,
                                color = SecondaryText
                            )
                        }
                    }

                    // Actions: Favourite and Notification
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Favourite Button
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(CardBackground)
                                .border(1.dp, BorderColor, CircleShape)
                                .clickable { onFavoritesClick?.invoke() ?: onSearchClick() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.FavoriteBorder,
                                contentDescription = "Favourites",
                                tint = PrimaryText,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        // Notification Button with badge
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(CardBackground)
                                .border(1.dp, BorderColor, CircleShape)
                                .clickable { onNotificationClick?.invoke() ?: onOrdersClick() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.NotificationsNone,
                                contentDescription = "Notifications",
                                tint = PrimaryText,
                                modifier = Modifier.size(20.dp)
                            )
                            // Notification count indicator badge
                            if (unreadNotificationCount > 0) {
                                Box(
                                    modifier = Modifier
                                        .align(Alignment.TopEnd)
                                        .padding(2.dp)
                                        .size(15.dp)
                                        .clip(CircleShape)
                                        .background(TerracottaAccent),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = if (unreadNotificationCount > 9) "9+" else unreadNotificationCount.toString(),
                                        fontSize = 8.5.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                }
                            }
                        }

                        // Profile Avatar Button
                        val profileInitial = remember(userProfile, user) {
                            userProfile?.displayName?.trim()?.firstOrNull()?.uppercaseChar()?.toString()
                                ?: user?.displayName?.trim()?.firstOrNull()?.uppercaseChar()?.toString()
                                ?: user?.email?.firstOrNull()?.uppercaseChar()?.toString()
                                ?: if (user?.isAnonymous == true) "G" else "U"
                        }
                        Box(
                            modifier = Modifier
                                .size(42.dp)
                                .clip(CircleShape)
                                .background(CardBackground)
                                .border(1.dp, BorderColor, CircleShape)
                                .clickable { onProfileClick?.invoke() },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = profileInitial,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = PrimaryGreen
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Location Header (Strictly browsing location, independent of dining session)
                Row(
                    modifier = Modifier
                        .clickable { onLocationClick?.invoke() ?: onRequestLocation?.invoke() }
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = if (userLocation != null) Icons.Default.NearMe else Icons.Default.LocationOn,
                        contentDescription = "Location",
                        tint = PrimaryGreen,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = userLocation?.localityName ?: "Hyderabad, Telangana",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryText
                    )
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowDown,
                        contentDescription = "Change location",
                        tint = SecondaryText,
                        modifier = Modifier.size(16.dp)
                    )
                }

                Text(
                    text = "Change location ⌄",
                    fontSize = 11.sp,
                    color = PrimaryGreen,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.clickable { onLocationClick?.invoke() ?: onRequestLocation?.invoke() }
                )

                // Dedicated Compact Active Dining Session Card
                if (diningSession != null) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .border(1.dp, Color(0xFFC6F6D5), RoundedCornerShape(14.dp)),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FFF4)),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(28.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF38A169)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Restaurant,
                                            contentDescription = "Active Dining",
                                            tint = Color.White,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                    Column {
                                        Text(
                                            text = "ACTIVE TABLE: #${diningSession.tableNumber}",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = Color(0xFF22543D)
                                        )
                                        Text(
                                            text = "Restaurant: ${diningSession.restaurantName}",
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color(0xFF2F855A)
                                        )
                                    }
                                }

                                Box(
                                    modifier = Modifier
                                        .clip(CircleShape)
                                        .background(Color(0xFFC6F6D5))
                                        .padding(horizontal = 8.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "LIVE",
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Black,
                                        color = Color(0xFF22543D)
                                    )
                                }
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = { onOrdersClick() },
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(38.dp),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF276749)),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Icon(Icons.Default.ArrowForward, contentDescription = null, modifier = Modifier.size(13.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("View Active Order", fontSize = 11.5.sp, fontWeight = FontWeight.Bold)
                                }

                                OutlinedButton(
                                    onClick = { showLeaveTableConfirmation = true },
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(38.dp),
                                    shape = RoundedCornerShape(10.dp),
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFC53030)),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFFEB2B2)),
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Icon(Icons.Default.ExitToApp, contentDescription = null, modifier = Modifier.size(13.dp), tint = Color(0xFFC53030))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text("Leave Table", fontSize = 11.5.sp, fontWeight = FontWeight.Bold, color = Color(0xFFC53030))
                                }
                            }
                        }
                    }
                }

                if (showLeaveTableConfirmation && diningSession != null) {
                    AlertDialog(
                        onDismissRequest = { showLeaveTableConfirmation = false },
                        title = {
                            Text(
                                text = "Leave Table #${diningSession.tableNumber}?",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 17.sp,
                                color = PrimaryText
                            )
                        },
                        text = {
                            Text(
                                text = "You are about to end your dining session at ${diningSession.restaurantName}.",
                                fontSize = 13.sp,
                                color = SecondaryText
                            )
                        },
                        confirmButton = {
                            Button(
                                onClick = {
                                    showLeaveTableConfirmation = false
                                    onLeaveTable?.invoke(diningSession)
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFC53030)),
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text("Leave Table", fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        },
                        dismissButton = {
                            OutlinedButton(
                                onClick = { showLeaveTableConfirmation = false },
                                shape = RoundedCornerShape(10.dp)
                            ) {
                                Text("Cancel", fontWeight = FontWeight.Bold, color = PrimaryText)
                            }
                        },
                        containerColor = CardBackground,
                        shape = RoundedCornerShape(16.dp)
                    )
                }
            }
        }

        // ==========================================
        // SECTION B: SEARCH
        // ==========================================
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp)
                    .clip(RoundedCornerShape(24.dp))
                    .background(CardBackground)
                    .border(1.dp, BorderColor, RoundedCornerShape(24.dp))
                    .clickable { onSearchClick() }
                    .padding(horizontal = 14.dp, vertical = 12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search",
                        tint = SecondaryText,
                        modifier = Modifier.size(19.dp)
                    )
                    Text(
                        text = "Search restaurants, dishes or cuisines...",
                        fontSize = 12.5.sp,
                        color = SecondaryText,
                        modifier = Modifier.weight(1f)
                    )
                    Icon(
                        imageVector = Icons.Default.Tune,
                        contentDescription = "Filter / Sort",
                        tint = SecondaryText,
                        modifier = Modifier.size(19.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))
        }

        // ==========================================
        // SECTION C: FOOD DISCOVERY BANNER
        // ==========================================
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .border(1.dp, BorderColor, RoundedCornerShape(18.dp)),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = LightGreen)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Left Content
                        Column(
                            modifier = Modifier.weight(1.15f),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = "DISCOVER SOMETHING",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Black,
                                color = DeepGreen,
                                letterSpacing = 0.5.sp
                            )
                            Text(
                                text = "DELICIOUS",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black,
                                color = TerracottaAccent,
                                letterSpacing = 0.5.sp
                            )
                            Text(
                                text = "Find your next favourite meal from the best restaurants around you.",
                                fontSize = 10.5.sp,
                                color = SecondaryText,
                                lineHeight = 14.sp,
                                maxLines = 2
                            )

                            Spacer(modifier = Modifier.height(6.dp))

                            // CTA Button
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(DeepGreen)
                                    .clickable { onSearchClick() }
                                    .padding(horizontal = 14.dp, vertical = 7.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = "Explore Restaurants",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Icon(
                                    imageVector = Icons.Default.ArrowForward,
                                    contentDescription = "Go",
                                    tint = Color.White,
                                    modifier = Modifier.size(12.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(8.dp))

                        // Right Food Image
                        Box(
                            modifier = Modifier
                                .size(width = 115.dp, height = 95.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .background(CardBackground),
                            contentAlignment = Alignment.Center
                        ) {
                            AsyncImage(
                                model = "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&auto=format&fit=crop&q=80",
                                contentDescription = "Delicious food",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    // Carousel Dots Indicator
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(width = 16.dp, height = 4.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(PrimaryGreen)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Box(
                            modifier = Modifier
                                .size(4.dp)
                                .clip(CircleShape)
                                .background(BorderColor)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Box(
                            modifier = Modifier
                                .size(4.dp)
                                .clip(CircleShape)
                                .background(BorderColor)
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Active Promotions Banner if real offers exist
        if (eligiblePromotions.isNotEmpty()) {
            item {
                PromotionsBanner(
                    promotion = eligiblePromotions.first(),
                    onApply = { onApplyCoupon(eligiblePromotions.first()) },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp)
                )
                Spacer(modifier = Modifier.height(14.dp))
            }
        }

        // ==========================================
        // SECTION D: EXPLORE BY CUISINE
        // ==========================================
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Explore by Cuisine",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = PrimaryText
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    modifier = Modifier.clickable { onSearchClick() }
                ) {
                    Text(
                        text = "See all",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryGreen
                    )
                    Icon(
                        imageVector = Icons.Default.ArrowForward,
                        contentDescription = "See all cuisines",
                        tint = PrimaryGreen,
                        modifier = Modifier.size(13.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(10.dp))

            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(dynamicCuisines) { cuisine ->
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(CardBackground)
                            .border(1.dp, BorderColor, RoundedCornerShape(12.dp))
                            .clickable { onCuisineClick(cuisine) }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(7.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(26.dp)
                                    .clip(CircleShape)
                                    .background(LightGreen),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Restaurant,
                                    contentDescription = cuisine,
                                    tint = PrimaryGreen,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                            Text(
                                text = cuisine,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = PrimaryText
                            )
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(18.dp))
        }

        // ==========================================
        // SECTION E: QUICK ACTIONS
        // ==========================================
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // 1. Scan QR
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(14.dp))
                        .clickable { onQrClick() },
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground)
                ) {
                    Column(
                        modifier = Modifier.padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(LightGreen),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.QrCodeScanner,
                                contentDescription = "Scan QR",
                                tint = PrimaryGreen,
                                modifier = Modifier.size(17.dp)
                            )
                        }
                        Text(
                            text = "Scan QR",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryText
                        )
                        Text(
                            text = "Open table menu",
                            fontSize = 9.5.sp,
                            color = SecondaryText,
                            maxLines = 1
                        )
                    }
                }

                // 2. My Orders
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(14.dp))
                        .clickable { onOrdersClick() },
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground)
                ) {
                    Column(
                        modifier = Modifier.padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFFFF0EC)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.ReceiptLong,
                                contentDescription = "My Orders",
                                tint = TerracottaAccent,
                                modifier = Modifier.size(17.dp)
                            )
                        }
                        Text(
                            text = "My Orders",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryText
                        )
                        Text(
                            text = "Track your orders",
                            fontSize = 9.5.sp,
                            color = SecondaryText,
                            maxLines = 1
                        )
                    }
                }

                // 3. Book a Table
                Card(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .border(1.dp, BorderColor, RoundedCornerShape(14.dp))
                        .clickable { onBookTableClick() },
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground)
                ) {
                    Column(
                        modifier = Modifier.padding(10.dp),
                        verticalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFFFFF8EC)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.CalendarMonth,
                                contentDescription = "Book a Table",
                                tint = Color(0xFFD97706),
                                modifier = Modifier.size(17.dp)
                            )
                        }
                        Text(
                            text = "Book a Table",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryText
                        )
                        Text(
                            text = "Reserve your seat",
                            fontSize = 9.5.sp,
                            color = SecondaryText,
                            maxLines = 1
                        )
                    }
                }
            }
            Spacer(modifier = Modifier.height(20.dp))
        }

        // ==========================================
        // SECTION F: POPULAR DISHES / EXPLORE DISHES
        // ==========================================
        if (popularDishes.isNotEmpty()) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Popular Dishes",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryText
                    )
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                        modifier = Modifier.clickable { onSearchClick() }
                    ) {
                        Text(
                            text = "See all",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryGreen
                        )
                        Icon(
                            imageVector = Icons.Default.ArrowForward,
                            contentDescription = "See all dishes",
                            tint = PrimaryGreen,
                            modifier = Modifier.size(13.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(popularDishes, key = { (item, rest) -> "${rest.id}_${item.id}" }) { (item, rest) ->
                        PopularDishCard(
                            item = item,
                            restaurant = rest,
                            onClick = {
                                if (onDishClick != null) {
                                    onDishClick(item, rest)
                                } else {
                                    onRestaurantClick(rest)
                                }
                            }
                        )
                    }
                }
                Spacer(modifier = Modifier.height(20.dp))
            }
        }

        // ==========================================
        // SECTION G: RESTAURANT LISTINGS (POPULAR RESTAURANTS)
        // ==========================================
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Popular Restaurants",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = PrimaryText
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    modifier = Modifier.clickable { onSearchClick() }
                ) {
                    Text(
                        text = "See all",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryGreen
                    )
                    Icon(
                        imageVector = Icons.Default.ArrowForward,
                        contentDescription = "See all restaurants",
                        tint = PrimaryGreen,
                        modifier = Modifier.size(13.dp)
                    )
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
        }

        if (isLoading && filteredByLocationRestaurants.isEmpty()) {
            items(4) {
                RestaurantCardSkeleton(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                )
            }
        } else if (filteredByLocationRestaurants.isEmpty()) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 16.dp)
                        .border(1.dp, BorderColor, RoundedCornerShape(20.dp)),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(CircleShape)
                                .background(LightGreen)
                                .border(1.dp, BorderColor, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Restaurant,
                                contentDescription = null,
                                tint = PrimaryGreen,
                                modifier = Modifier.size(28.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(4.dp))

                        Text(
                            text = "SpiralDine Is Coming Soon!",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = PrimaryText,
                            textAlign = TextAlign.Center
                        )

                        Text(
                            text = "We're working on bringing amazing restaurants to your area in ${userLocation?.localityName ?: "this location"}.",
                            fontSize = 12.sp,
                            color = SecondaryText,
                            textAlign = TextAlign.Center,
                            lineHeight = 17.sp
                        )

                        Text(
                            text = "Stay tuned. We'll let you know when restaurants become available.",
                            fontSize = 11.sp,
                            color = SecondaryText,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Button(
                            onClick = { onLocationClick?.invoke() ?: onRequestLocation?.invoke() },
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 10.dp)
                        ) {
                            Icon(Icons.Default.NearMe, contentDescription = null, modifier = Modifier.size(15.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Change Location", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        } else {
            items(filteredByLocationRestaurants, key = { it.id }) { restaurant ->
                val distance = remember(userLocation, restaurant) {
                    DistanceCalculator.getRestaurantDistanceKm(userLocation, restaurant)
                }
                val isFav = effectiveFavs.contains(restaurant.id)

                RestaurantCard(
                    restaurant = restaurant,
                    distanceKm = distance,
                    isFavourite = isFav,
                    onFavouriteToggle = {
                        onToggleFavourite?.invoke(restaurant)
                        localFavs = if (isFav) {
                            localFavs - restaurant.id
                        } else {
                            localFavs + restaurant.id
                        }
                    },
                    onClick = { onRestaurantClick(restaurant) },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 5.dp)
                )
            }
        }
    }
}
