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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.NearMe
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.repository.DistanceCalculator
import com.spiralworld.spiraldine.data.repository.OpenStatus
import com.spiralworld.spiraldine.data.repository.OperatingHoursEngine
import com.spiralworld.spiraldine.theme.BorderColor
import com.spiralworld.spiraldine.theme.CardBackground
import com.spiralworld.spiraldine.theme.ClosedStatusColor
import com.spiralworld.spiraldine.theme.LightGreen
import com.spiralworld.spiraldine.theme.OpenStatusColor
import com.spiralworld.spiraldine.theme.PrimaryGreen
import com.spiralworld.spiraldine.theme.PrimaryText
import com.spiralworld.spiraldine.theme.SecondaryText
import com.spiralworld.spiraldine.theme.StarGold
import com.spiralworld.spiraldine.theme.TerracottaAccent
import com.spiralworld.spiraldine.theme.VegGreen
import java.util.Locale

@Composable
fun RestaurantCard(
    restaurant: Restaurant,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    distanceKm: Double? = null,
    isFavourite: Boolean = false,
    onFavouriteToggle: (() -> Unit)? = null
) {
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

    val formattedDistance = remember(distanceKm) {
        DistanceCalculator.formatDistance(distanceKm)
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .border(width = 1.dp, color = BorderColor, shape = RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // LEFT COLUMN: Restaurant Image + Open/Closed Badge
            Box(
                modifier = Modifier
                    .size(width = 110.dp, height = 100.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(LightGreen)
            ) {
                if (restaurant.imageUrl.isNotBlank()) {
                    AsyncImage(
                        model = restaurant.imageUrl,
                        contentDescription = restaurant.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(100.dp)
                    )
                } else {
                    // Fallback placeholder when image is absent
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(100.dp)
                            .background(LightGreen),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = restaurant.name.take(1).uppercase(),
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Black,
                            color = PrimaryGreen
                        )
                    }
                }

                // Open / Closed Status Pill (Top-Start)
                when (openStatus) {
                    is OpenStatus.Open -> {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopStart)
                                .padding(5.dp)
                                .background(OpenStatusColor, RoundedCornerShape(4.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "OPEN NOW",
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                    is OpenStatus.Closed -> {
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopStart)
                                .padding(5.dp)
                                .background(ClosedStatusColor, RoundedCornerShape(4.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "CLOSED",
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                    OpenStatus.Unknown -> { /* Hide gracefully if unknown */ }
                }

                // Pure Veg Indicator (Bottom-Start)
                if (restaurant.isPureVeg) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomStart)
                            .padding(5.dp)
                            .size(14.dp)
                            .background(CardBackground, RoundedCornerShape(3.dp))
                            .border(1.dp, VegGreen, RoundedCornerShape(3.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(VegGreen)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // RIGHT COLUMN: Restaurant Details
            Column(
                modifier = Modifier
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(3.dp)
            ) {
                // Name & Favourite Icon
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = restaurant.name,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = PrimaryText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )

                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clickable { onFavouriteToggle?.invoke() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = if (isFavourite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                            contentDescription = "Favourite",
                            tint = if (isFavourite) TerracottaAccent else SecondaryText.copy(alpha = 0.7f),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                // Rating Row
                val hasRating = restaurant.hasVerifiedRating
                val reviewCountFormatted = if (restaurant.reviewCount >= 1000) {
                    String.format(Locale.US, "%.1fK+", restaurant.reviewCount / 1000.0)
                } else {
                    "${restaurant.reviewCount}+"
                }

                if (hasRating) {
                    Row(
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
                            text = String.format(Locale.US, "%.1f", restaurant.rating ?: 0.0),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryText
                        )
                        Text(
                            text = "($reviewCountFormatted)",
                            fontSize = 10.sp,
                            color = SecondaryText
                        )
                    }
                }

                // Cuisines / Categories
                if (restaurant.cuisines.isNotEmpty()) {
                    Text(
                        text = restaurant.cuisines.take(3).joinToString(" • "),
                        fontSize = 11.sp,
                        color = SecondaryText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Location / Distance Row
                val locationText = restaurant.locality.ifBlank { restaurant.address.ifBlank { restaurant.city } }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = "Location",
                        tint = SecondaryText,
                        modifier = Modifier.size(11.dp)
                    )
                    if (formattedDistance != null) {
                        Text(
                            text = formattedDistance,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = SecondaryText
                        )
                        Text(
                            text = "•",
                            fontSize = 10.sp,
                            color = SecondaryText
                        )
                    }
                    if (locationText.isNotBlank()) {
                        Text(
                            text = locationText,
                            fontSize = 10.sp,
                            color = SecondaryText,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                // Price for two
                Text(
                    text = restaurant.displayPriceForTwo,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = PrimaryText
                )
            }
        }
    }
}

