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
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import coil.compose.AsyncImage
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.RateReview
import androidx.compose.material.icons.filled.RestaurantMenu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.Addon
import com.spiralworld.spiraldine.data.model.CartItem
import com.spiralworld.spiraldine.data.model.MenuCategory
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.Promotion
import com.spiralworld.spiraldine.data.model.Variant
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.RestaurantRatingSummary
import com.spiralworld.spiraldine.data.model.ReviewRecord
import com.spiralworld.spiraldine.data.repository.CurrencyFormatter
import com.spiralworld.spiraldine.data.repository.OpenStatus
import com.spiralworld.spiraldine.data.repository.OperatingHoursEngine
import com.spiralworld.spiraldine.data.repository.RatingCalculator
import com.spiralworld.spiraldine.data.repository.ReviewRepository
import com.spiralworld.spiraldine.theme.PrimaryGreen
import com.spiralworld.spiraldine.theme.LightGreen
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.ChipSelected
import com.spiralworld.spiraldine.theme.NonVegRed
import com.spiralworld.spiraldine.theme.NonVegRedBg
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.SpiralDineOrangeDark
import com.spiralworld.spiraldine.theme.SpiralDineOrangeLight
import com.spiralworld.spiraldine.theme.StarGold
import com.spiralworld.spiraldine.theme.SuccessGreen
import com.spiralworld.spiraldine.theme.SuccessGreenBg
import com.spiralworld.spiraldine.theme.SurfaceMuted
import com.spiralworld.spiraldine.theme.SurfaceWhite
import com.spiralworld.spiraldine.theme.TextPrimary
import com.spiralworld.spiraldine.theme.TextSecondary
import com.spiralworld.spiraldine.theme.VegGreen
import com.spiralworld.spiraldine.theme.WarmBackground
import com.spiralworld.spiraldine.ui.components.FoodItemCard
import com.spiralworld.spiraldine.ui.components.FoodItemCardSkeleton
import com.spiralworld.spiraldine.ui.components.ItemCustomizationModal
import com.spiralworld.spiraldine.ui.components.PromotionsBanner
import java.util.Locale

private enum class RestaurantDetailTab(val title: String) {
    MENU("Menu"),
    REVIEWS("Reviews & Ratings"),
    ABOUT("About & Hours")
}

@Composable
fun RestaurantMenuScreen(
    restaurant: Restaurant,
    categories: List<MenuCategory>,
    menuItems: List<MenuItem>,
    promotions: List<Promotion>,
    cartItems: List<CartItem>,
    tableNumber: String?,
    isLoadingMenu: Boolean = false,
    onBack: () -> Unit,
    onAddItem: (MenuItem) -> Unit,
    onRemoveItem: (MenuItem) -> Unit,
    onViewCart: () -> Unit,
    onApplyPromotion: (Promotion) -> Unit,
    onAddConfiguredItem: ((MenuItem, Variant?, List<Addon>, String, Int) -> Unit)? = null,
    onClearAndAddConfiguredItem: ((MenuItem, Variant?, List<Addon>, String, Int) -> Unit)? = null,
    reviewRepository: ReviewRepository? = null,
    onBookTable: (() -> Unit)? = null,
    onSelectTable: (() -> Unit)? = null
) {
    var activeTab by remember { mutableStateOf(RestaurantDetailTab.MENU) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategoryId by remember { mutableStateOf("ALL") }
    var vegFilter by remember { mutableStateOf<Boolean?>(null) } // null = all, true = veg, false = non-veg
    var customizingItem by remember { mutableStateOf<MenuItem?>(null) }
    var pendingConflictItem by remember { mutableStateOf<PendingCustomizedAdd?>(null) }

    fun handleAddItem(
        item: MenuItem,
        variant: Variant?,
        addons: List<Addon>,
        notes: String,
        quantity: Int
    ) {
        val existingTenant = cartItems.firstOrNull()?.item?.restaurantId?.ifBlank { null }
        if (existingTenant != null && existingTenant != restaurant.id) {
            pendingConflictItem = PendingCustomizedAdd(item, variant, addons, notes, quantity)
        } else {
            if (onAddConfiguredItem != null) {
                onAddConfiguredItem(item, variant, addons, notes, quantity)
            } else {
                onAddItem(item)
            }
        }
    }

    val totalCartCount = cartItems.sumOf { it.count }
    val totalCartPrice = cartItems.sumOf { it.lineTotal }

    // Fetch verified published reviews from subcollection
    val reviews by (reviewRepository?.getRestaurantReviews(restaurant.id)
        ?: kotlinx.coroutines.flow.flowOf(emptyList<ReviewRecord>()))
        .collectAsState(initial = emptyList())

    val ratingSummary = remember(reviews) {
        RatingCalculator.calculate(reviews)
    }

    val openStatus = remember(restaurant.businessHours, restaurant.timezone, restaurant.isOpen) {
        if (restaurant.businessHours != null) {
            OperatingHoursEngine.getStatus(restaurant.businessHours, restaurant.timezone)
        } else if (restaurant.isOpen == true) {
            OpenStatus.Open()
        } else if (restaurant.isOpen == false) {
            OpenStatus.Closed()
        } else {
            OpenStatus.Unknown
        }
    }

    val filteredItems = menuItems.filter { item ->
        val queryMatches = searchQuery.isBlank() ||
                item.name.contains(searchQuery, ignoreCase = true) ||
                item.description.contains(searchQuery, ignoreCase = true)
        val catMatches = selectedCategoryId == "ALL" ||
                item.categoryId == selectedCategoryId ||
                item.category.equals(selectedCategoryId, ignoreCase = true)
        val vegMatches = vegFilter == null || item.isVeg == vegFilter

        queryMatches && catMatches && vegMatches
    }

    Box(modifier = Modifier.fillMaxSize().background(WarmBackground)) {
        Column(modifier = Modifier.fillMaxSize()) {
            // 1. Cover Image Banner with Floating Back & Status Buttons
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 145.dp, max = 175.dp)
                    .background(Color(0xFF1E293B))
            ) {
                if (restaurant.imageUrl.isNotBlank()) {
                    AsyncImage(
                        model = restaurant.imageUrl,
                        contentDescription = restaurant.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    // Polished Fallback Hero Monogram & Gradient
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.linearGradient(
                                    listOf(Color(0xFF1E293B), Color(0xFF0F172A))
                                )
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(46.dp)
                                    .background(SpiralDineOrange.copy(alpha = 0.2f), RoundedCornerShape(14.dp))
                                    .border(1.dp, SpiralDineOrange.copy(alpha = 0.4f), RoundedCornerShape(14.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = restaurant.name.take(1).uppercase(),
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight.Black,
                                    color = SpiralDineOrange
                                )
                            }
                            Text(
                                text = restaurant.cuisine.ifBlank { "Gourmet Dining" },
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color.White.copy(alpha = 0.8f)
                            )
                        }
                    }
                }

                // Scrim overlay for top & bottom readability
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(
                                    Color.Black.copy(alpha = 0.45f),
                                    Color.Transparent,
                                    Color.Black.copy(alpha = 0.65f)
                                )
                            )
                        )
                )

                // Top Left: Back Button with safe status bar insets
                Box(
                    modifier = Modifier
                        .statusBarsPadding()
                        .padding(start = 16.dp, top = 8.dp)
                        .align(Alignment.TopStart)
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(SurfaceWhite.copy(alpha = 0.95f))
                        .border(1.dp, CardBorder, CircleShape)
                        .clickable { onBack() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = TextPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }

                // Top Right: Open / Closed Status Pill with safe status bar insets
                Box(
                    modifier = Modifier
                        .statusBarsPadding()
                        .padding(end = 16.dp, top = 10.dp)
                        .align(Alignment.TopEnd)
                        .background(
                            when (openStatus) {
                                is OpenStatus.Open -> Color(0xFF10B981)
                                is OpenStatus.Closed -> Color(0xFFEF4444)
                                else -> Color(0xFF64748B)
                            },
                            RoundedCornerShape(8.dp)
                        )
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = when (openStatus) {
                            is OpenStatus.Open -> "OPEN"
                            is OpenStatus.Closed -> "CLOSED"
                            else -> "HOURS"
                        },
                        fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    )
                }
            }

            // 2. Overlapping Restaurant Details Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp)
                    .offset(y = (-20).dp),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, CardBorder)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Row 1: Restaurant Name & Verified Rating
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = restaurant.name,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimary,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f, fill = false)
                        )

                        // Rating badge
                        Row(
                            modifier = Modifier
                                .background(WarmBackground, RoundedCornerShape(8.dp))
                                .border(0.5.dp, CardBorder, RoundedCornerShape(8.dp))
                                .padding(horizontal = 7.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = "Rating",
                                tint = StarGold,
                                modifier = Modifier.size(13.dp)
                            )
                            Text(
                                text = if (ratingSummary.hasReviews) String.format(Locale.US, "%.1f", ratingSummary.averageRating) else "4.5",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            if (ratingSummary.totalReviews > 0) {
                                Text(
                                    text = "(${ratingSummary.totalReviews})",
                                    fontSize = 10.sp,
                                    color = TextSecondary
                                )
                            }
                        }
                    }

                    // Row 2: Cuisine and Location details
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = restaurant.cuisine.ifBlank { "Multi-Cuisine" },
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = SpiralDineOrange
                        )

                        Text(
                            text = "•",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )

                        Icon(
                            imageVector = Icons.Default.LocationOn,
                            contentDescription = "Location",
                            tint = TextSecondary,
                            modifier = Modifier.size(12.dp)
                        )

                        Text(
                            text = restaurant.locality.ifBlank { restaurant.city },
                            fontSize = 11.sp,
                            color = TextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    // Row 3: Table Badge (Left) & Book Table Button (Right)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Table selection pill
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (!tableNumber.isNullOrBlank()) SpiralDineOrangeLight else Color(0xFFF1F5F9))
                                .border(
                                    1.dp,
                                    if (!tableNumber.isNullOrBlank()) SpiralDineOrange.copy(alpha = 0.4f) else CardBorder,
                                    RoundedCornerShape(10.dp)
                                )
                                .clickable { onSelectTable?.invoke() }
                                .padding(horizontal = 9.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.RestaurantMenu,
                                contentDescription = "Table",
                                tint = if (!tableNumber.isNullOrBlank()) SpiralDineOrange else TextSecondary,
                                modifier = Modifier.size(13.dp)
                            )
                            Text(
                                text = if (!tableNumber.isNullOrBlank()) "Table #$tableNumber (Dine-In)" else "Select Table",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (!tableNumber.isNullOrBlank()) SpiralDineOrangeDark else TextSecondary
                            )
                        }

                        // Book Table button
                        if (onBookTable != null && restaurant.supportsTableBooking) {
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(LightGreen)
                                    .border(1.dp, PrimaryGreen.copy(alpha = 0.6f), RoundedCornerShape(10.dp))
                                    .clickable { onBookTable() }
                                    .padding(horizontal = 11.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(5.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.RestaurantMenu,
                                    contentDescription = "Book Table",
                                    tint = PrimaryGreen,
                                    modifier = Modifier.size(13.dp)
                                )
                                Text(
                                    text = "Book Table",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PrimaryGreen
                                )
                            }
                        }
                    }
                }
            }

            // Segmented Navigation Tabs: [Menu | Reviews & Ratings | About & Hours]
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(SurfaceWhite)
                    .border(1.dp, CardBorder, RoundedCornerShape(14.dp))
                    .padding(3.dp)
            ) {
                RestaurantDetailTab.values().forEach { tab ->
                    val isSelected = activeTab == tab
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(11.dp))
                            .background(if (isSelected) SpiralDineOrange else SurfaceWhite)
                            .clickable { activeTab = tab }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = tab.title,
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) SurfaceWhite else TextSecondary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Tab Content
            when (activeTab) {
                RestaurantDetailTab.MENU -> {
                    LazyVerticalGrid(
                        columns = GridCells.Adaptive(minSize = 150.dp),
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 120.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // In-Menu Search
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(SurfaceWhite)
                                    .border(1.dp, CardBorder, RoundedCornerShape(14.dp))
                                    .padding(horizontal = 12.dp, vertical = 10.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Search,
                                        contentDescription = "Search",
                                        tint = TextSecondary,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    BasicTextField(
                                        value = searchQuery,
                                        onValueChange = { searchQuery = it },
                                        modifier = Modifier.weight(1f),
                                        singleLine = true,
                                        decorationBox = { innerTextField ->
                                            if (searchQuery.isEmpty()) {
                                                Text(
                                                    text = "Search in this menu...",
                                                    fontSize = 12.sp,
                                                    color = TextSecondary
                                                )
                                            }
                                            innerTextField()
                                        }
                                    )
                                    if (searchQuery.isNotEmpty()) {
                                        Icon(
                                            imageVector = Icons.Default.Close,
                                            contentDescription = "Clear",
                                            tint = TextSecondary,
                                            modifier = Modifier
                                                .size(16.dp)
                                                .clickable { searchQuery = "" }
                                        )
                                    }
                                }
                            }
                        }

                        // Promotions Banner
                        val menuPromos = promotions.filter { p ->
                            p.placements.contains("restaurant_menu") || p.placements.contains("MENU_BANNER") || p.placements.contains("ALL")
                        }
                        if (menuPromos.isNotEmpty()) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                PromotionsBanner(
                                    promotion = menuPromos.first(),
                                    onApply = { onApplyPromotion(menuPromos.first()) }
                                )
                            }
                        }

                        // Category & Veg Filter Row
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    item {
                                        val isSelected = selectedCategoryId == "ALL"
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(16.dp))
                                                .background(if (isSelected) ChipSelected else SurfaceWhite)
                                                .border(1.dp, if (isSelected) ChipSelected else CardBorder, RoundedCornerShape(16.dp))
                                                .clickable { selectedCategoryId = "ALL" }
                                                .padding(horizontal = 12.dp, vertical = 6.dp)
                                        ) {
                                            Text(
                                                text = "All Dishes",
                                                fontSize = 11.sp,
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                                color = if (isSelected) SurfaceWhite else TextPrimary
                                            )
                                        }
                                    }

                                    items(categories) { cat ->
                                        val isSelected = selectedCategoryId == cat.id || selectedCategoryId == cat.name
                                        Box(
                                            modifier = Modifier
                                                .clip(RoundedCornerShape(16.dp))
                                                .background(if (isSelected) ChipSelected else SurfaceWhite)
                                                .border(1.dp, if (isSelected) ChipSelected else CardBorder, RoundedCornerShape(16.dp))
                                                .clickable { selectedCategoryId = cat.id }
                                                .padding(horizontal = 12.dp, vertical = 6.dp)
                                        ) {
                                            Text(
                                                text = cat.name,
                                                fontSize = 11.sp,
                                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                                color = if (isSelected) SurfaceWhite else TextPrimary
                                            )
                                        }
                                    }
                                }

                                // Veg / Non-Veg Diet Toggle
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(if (vegFilter == true) VegGreen else SurfaceWhite)
                                            .border(1.dp, if (vegFilter == true) VegGreen else CardBorder, RoundedCornerShape(14.dp))
                                            .clickable { vegFilter = if (vegFilter == true) null else true }
                                            .padding(horizontal = 10.dp, vertical = 5.dp)
                                        ) {
                                        Text(
                                            text = "Pure Veg Only",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (vegFilter == true) SurfaceWhite else VegGreen
                                        )
                                    }

                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(14.dp))
                                            .background(if (vegFilter == false) NonVegRed else SurfaceWhite)
                                            .border(1.dp, if (vegFilter == false) NonVegRed else CardBorder, RoundedCornerShape(14.dp))
                                            .clickable { vegFilter = if (vegFilter == false) null else false }
                                            .padding(horizontal = 10.dp, vertical = 5.dp)
                                        ) {
                                        Text(
                                            text = "Non-Veg Only",
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = if (vegFilter == false) SurfaceWhite else NonVegRed
                                        )
                                    }
                                }
                            }
                        }

                        // Dish Cards
                        if (isLoadingMenu && filteredItems.isEmpty()) {
                            items(6) {
                                FoodItemCardSkeleton()
                            }
                        } else if (filteredItems.isEmpty()) {
                            item(span = { GridItemSpan(maxLineSpan) }) {
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 40.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text(
                                            text = "No dishes found",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                        Text(
                                            text = "Try clearing filters or searching another dish.",
                                            fontSize = 11.sp,
                                            color = TextSecondary
                                        )
                                    }
                                }
                            }
                        } else {
                            items(filteredItems, key = { it.id }) { item ->
                                val inCart = cartItems.filter { it.item.id == item.id }.sumOf { it.count }
                                FoodItemCard(
                                    item = item,
                                    cartCount = inCart,
                                    onAdd = {
                                        if (item.isCustomizable) {
                                            customizingItem = item
                                        } else {
                                            handleAddItem(item, null, emptyList<Addon>(), "", 1)
                                        }
                                    },
                                    onRemove = { onRemoveItem(item) },
                                    onClick = {
                                        if (item.isCustomizable) {
                                            customizingItem = item
                                        } else {
                                            handleAddItem(item, null, emptyList<Addon>(), "", 1)
                                        }
                                    }
                                )
                            }
                        }
                    }
                }

                RestaurantDetailTab.REVIEWS -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 120.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Summary Card
                        item {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, CardBorder, RoundedCornerShape(18.dp)),
                                shape = RoundedCornerShape(18.dp),
                                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    if (ratingSummary.hasReviews) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Column {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                                ) {
                                                    Text(
                                                        text = String.format(Locale.US, "%.1f", ratingSummary.averageRating),
                                                        fontSize = 32.sp,
                                                        fontWeight = FontWeight.ExtraBold,
                                                        color = TextPrimary
                                                    )
                                                    Icon(
                                                        imageVector = Icons.Default.Star,
                                                        contentDescription = "Stars",
                                                        tint = StarGold,
                                                        modifier = Modifier.size(24.dp)
                                                    )
                                                }
                                                Text(
                                                    text = "Based on ${ratingSummary.totalReviews} verified reviews",
                                                    fontSize = 11.sp,
                                                    color = TextSecondary
                                                )
                                            }

                                            if (ratingSummary.revisitRate > 0) {
                                                Column(horizontalAlignment = Alignment.End) {
                                                    Row(
                                                        verticalAlignment = Alignment.CenterVertically,
                                                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                                                    ) {
                                                        Icon(
                                                            imageVector = Icons.Default.ThumbUp,
                                                            contentDescription = "Revisit",
                                                            tint = SuccessGreen,
                                                            modifier = Modifier.size(14.dp)
                                                        )
                                                        Text(
                                                            text = "${ratingSummary.revisitRate}%",
                                                            fontSize = 16.sp,
                                                            fontWeight = FontWeight.ExtraBold,
                                                            color = SuccessGreen
                                                        )
                                                    }
                                                    Text(
                                                        text = "would revisit",
                                                        fontSize = 10.sp,
                                                        color = TextSecondary
                                                    )
                                                }
                                            }
                                        }

                                        Spacer(modifier = Modifier.height(14.dp))

                                        // Category Averages
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .background(WarmBackground, RoundedCornerShape(10.dp))
                                                .padding(10.dp),
                                            horizontalArrangement = Arrangement.SpaceAround
                                        ) {
                                            CategoryScorePill("Food", ratingSummary.categoryAverages.foodQuality)
                                            CategoryScorePill("Service", ratingSummary.categoryAverages.service)
                                            CategoryScorePill("Clean", ratingSummary.categoryAverages.cleanliness)
                                            CategoryScorePill("Ambience", ratingSummary.categoryAverages.ambience)
                                        }
                                    } else {
                                        Column(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 12.dp),
                                            horizontalAlignment = Alignment.CenterHorizontally
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.RateReview,
                                                contentDescription = "No reviews",
                                                tint = TextSecondary,
                                                modifier = Modifier.size(36.dp)
                                            )
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text(
                                                text = "No verified reviews yet",
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = TextPrimary
                                            )
                                            Text(
                                                text = "Be the first to review after completing your order!",
                                                fontSize = 11.sp,
                                                color = TextSecondary,
                                                textAlign = TextAlign.Center
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // Reviews List
                        if (reviews.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Customer Feedback",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary,
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }

                            items(reviews, key = { it.id }) { review ->
                                Card(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .border(1.dp, CardBorder, RoundedCornerShape(14.dp)),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Column {
                                                Text(
                                                    text = review.publicCustomerName,
                                                    fontSize = 13.sp,
                                                    fontWeight = FontWeight.Bold,
                                                    color = TextPrimary
                                                )
                                                if (review.tableNumber.isNotBlank()) {
                                                    Text(
                                                        text = "Table ${review.tableNumber}",
                                                        fontSize = 10.sp,
                                                        color = TextSecondary
                                                    )
                                                }
                                            }

                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(2.dp)
                                            ) {
                                                repeat(review.starRating) {
                                                    Icon(
                                                        imageVector = Icons.Default.Star,
                                                        contentDescription = "Star",
                                                        tint = StarGold,
                                                        modifier = Modifier.size(13.dp)
                                                    )
                                                }
                                            }
                                        }

                                        if (review.notes.isNotBlank() && review.notes != "No additional comments provided.") {
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text(
                                                text = review.notes,
                                                fontSize = 12.sp,
                                                color = TextPrimary,
                                                lineHeight = 16.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                RestaurantDetailTab.ABOUT -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 120.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Operating Hours Card
                        item {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.AccessTime,
                                            contentDescription = "Hours",
                                            tint = SpiralDineOrange,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Text(
                                            text = "Operating Hours",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(10.dp))

                                    // Status Badge
                                    when (openStatus) {
                                        is OpenStatus.Open -> {
                                            Text(
                                                text = openStatus.label,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = SuccessGreen,
                                                modifier = Modifier
                                                    .background(SuccessGreenBg, RoundedCornerShape(6.dp))
                                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                        is OpenStatus.Closed -> {
                                            Text(
                                                text = openStatus.label,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = NonVegRed,
                                                modifier = Modifier
                                                    .background(NonVegRedBg, RoundedCornerShape(6.dp))
                                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                                            )
                                        }
                                        OpenStatus.Unknown -> {
                                            Text(
                                                text = "Standard Operating Hours apply",
                                                fontSize = 12.sp,
                                                color = TextSecondary
                                            )
                                        }
                                    }

                                    if (restaurant.businessHours != null) {
                                        val op = restaurant.businessHours.openingTime
                                        val cl = restaurant.businessHours.closingTime
                                        if (!op.isNullOrBlank() && !cl.isNullOrBlank()) {
                                            Spacer(modifier = Modifier.height(8.dp))
                                            Text(
                                                text = "Daily: $op - $cl",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = TextPrimary
                                            )
                                        }

                                        if (restaurant.businessHours.workingDays.isNotEmpty()) {
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = "Working Days: ${restaurant.businessHours.workingDays.joinToString(", ")}",
                                                fontSize = 11.sp,
                                                color = TextSecondary
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // Address & Location Card
                        item {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.LocationOn,
                                            contentDescription = "Address",
                                            tint = SpiralDineOrange,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Text(
                                            text = "Address & Contact",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))

                                    Text(
                                        text = restaurant.address.ifBlank { "${restaurant.locality}, ${restaurant.city}" },
                                        fontSize = 12.sp,
                                        color = TextPrimary,
                                        lineHeight = 16.sp
                                    )

                                    if (restaurant.phone.isNotBlank()) {
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                                        ) {
                                            Icon(
                                                imageVector = Icons.Default.Phone,
                                                contentDescription = "Phone",
                                                tint = TextSecondary,
                                                modifier = Modifier.size(14.dp)
                                            )
                                            Text(
                                                text = restaurant.phone,
                                                fontSize = 12.sp,
                                                color = TextSecondary
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // Dining Highlights Card
                        item {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Icon(
                                            imageVector = Icons.Default.Info,
                                            contentDescription = "Highlights",
                                            tint = SpiralDineOrange,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Text(
                                            text = "Dining Highlights",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))

                                    Text(
                                        text = "• Cost for Two: ${restaurant.displayPriceForTwo}",
                                        fontSize = 12.sp,
                                        color = TextSecondary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "• Dietary: ${if (restaurant.isPureVeg) "Pure Vegetarian Restaurant" else "Non-Veg & Veg Options Available"}",
                                        fontSize = 12.sp,
                                        color = TextSecondary
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = "• Cuisines: ${restaurant.cuisines.joinToString(", ")}",
                                        fontSize = 12.sp,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // Floating Bottom Cart Bar (visible in all tabs when cart has items)
        if (totalCartCount > 0) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 14.dp)
            ) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(12.dp, RoundedCornerShape(20.dp))
                        .clickable { onViewCart() },
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = SpiralDineOrange)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.ShoppingBag,
                                contentDescription = "Cart",
                                tint = SurfaceWhite,
                                modifier = Modifier.size(20.dp)
                            )
                            Column {
                                Text(
                                    text = "$totalCartCount items in basket",
                                    fontSize = 11.sp,
                                    color = SurfaceWhite.copy(alpha = 0.9f)
                                )
                                Text(
                                    text = CurrencyFormatter.formatPrice(totalCartPrice),
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SurfaceWhite
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(
                                text = "View Cart",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = SurfaceWhite
                            )
                            Icon(
                                imageVector = Icons.Default.ArrowForward,
                                contentDescription = "Proceed",
                                tint = SurfaceWhite,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }

        // Food Customization Modal
        if (customizingItem != null) {
            ItemCustomizationModal(
                item = customizingItem!!,
                onDismiss = { customizingItem = null },
                onConfirm = { variant, addons, notes, qty ->
                    val itm = customizingItem!!
                    customizingItem = null
                    handleAddItem(itm, variant, addons, notes, qty)
                }
            )
        }

        // Cross-Restaurant Basket Conflict Confirmation
        if (pendingConflictItem != null) {
            val pending = pendingConflictItem!!
            AlertDialog(
                onDismissRequest = { pendingConflictItem = null },
                title = { Text("Replace Basket Items?", fontWeight = FontWeight.Bold, color = TextPrimary) },
                text = {
                    Text(
                        "Your basket already contains items from another restaurant. Do you want to clear your current basket and start a fresh order from ${restaurant.name}?",
                        color = TextSecondary
                    )
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            pendingConflictItem = null
                            if (onClearAndAddConfiguredItem != null) {
                                onClearAndAddConfiguredItem(
                                    pending.item,
                                    pending.variant,
                                    pending.addons,
                                    pending.notes,
                                    pending.qty
                                )
                            } else {
                                onAddItem(pending.item)
                            }
                        }
                    ) {
                        Text("Clear & Add", color = SpiralDineOrange, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    TextButton(onClick = { pendingConflictItem = null }) {
                        Text("Cancel", color = TextSecondary)
                    }
                }
            )
        }
    }
}

private data class PendingCustomizedAdd(
    val item: MenuItem,
    val variant: Variant?,
    val addons: List<Addon>,
    val notes: String,
    val qty: Int
)

@Composable
private fun CategoryScorePill(title: String, score: Double) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = String.format(Locale.US, "%.1f", score),
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary
        )
        Text(
            text = title,
            fontSize = 10.sp,
            color = TextSecondary
        )
    }
}
