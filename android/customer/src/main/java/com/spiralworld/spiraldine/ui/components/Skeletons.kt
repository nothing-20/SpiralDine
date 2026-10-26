package com.spiralworld.spiraldine.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.spiralworld.spiraldine.theme.BorderColor
import com.spiralworld.spiraldine.theme.CardBackground
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.SurfaceWhite

/**
 * Creates a subtle, accessible shimmer brush with soft contrast
 * that avoids excessive animation or jarring brightness.
 */
@Composable
fun shimmerBrush(targetValue: Float = 1200f): Brush {
    val shimmerColors = listOf(
        Color(0xFFE2E8F0).copy(alpha = 0.6f),
        Color(0xFFF1F5F9).copy(alpha = 0.9f),
        Color(0xFFE2E8F0).copy(alpha = 0.6f)
    )

    val transition = rememberInfiniteTransition(label = "shimmerTransition")
    val translateAnimation by transition.animateFloat(
        initialValue = 0f,
        targetValue = targetValue,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1100, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerAnimation"
    )

    return Brush.linearGradient(
        colors = shimmerColors,
        start = Offset.Zero,
        end = Offset(x = translateAnimation, y = translateAnimation)
    )
}

/**
 * Skeleton component mirroring the layout, aspect ratio, and structure
 * of RestaurantCard.kt on HomeScreen.
 */
@Composable
fun RestaurantCardSkeleton(
    modifier: Modifier = Modifier
) {
    val brush = shimmerBrush()

    Card(
        modifier = modifier
            .fillMaxWidth()
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
            // Left Column: Image Box Placeholder (110dp x 100dp)
            Box(
                modifier = Modifier
                    .size(width = 110.dp, height = 100.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(brush)
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Right Column: Text Details Placeholders
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                // Restaurant Name line
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.75f)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )

                // Rating & Reviews row
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(14.dp)
                            .clip(CircleShape)
                            .background(brush)
                    )
                    Box(
                        modifier = Modifier
                            .width(60.dp)
                            .height(12.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(brush)
                    )
                }

                // Cuisines line
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.85f)
                        .height(12.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )

                // Distance & Location line
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.6f)
                        .height(11.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )

                // Price for two pill
                Box(
                    modifier = Modifier
                        .width(80.dp)
                        .height(13.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }
        }
    }
}

/**
 * Skeleton component mirroring FoodItemCard.kt on RestaurantMenuScreen.
 */
@Composable
fun FoodItemCardSkeleton(
    modifier: Modifier = Modifier
) {
    val brush = shimmerBrush()

    Card(
        modifier = modifier
            .fillMaxWidth()
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column {
            // Food Image Box (height 110dp)
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(110.dp)
                    .background(brush)
            )

            // Content details
            Column(
                modifier = Modifier.padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                // Item Name
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.8f)
                        .height(14.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )

                // Description
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.95f)
                        .height(11.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Price and Add button placeholders
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .width(50.dp)
                            .height(14.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(brush)
                    )
                    Box(
                        modifier = Modifier
                            .size(width = 64.dp, height = 28.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(brush)
                    )
                }
            }
        }
    }
}

/**
 * Skeleton component mirroring the Order History Card on OrdersScreen.
 */
@Composable
fun OrderCardSkeleton(
    modifier: Modifier = Modifier
) {
    val brush = shimmerBrush()

    Card(
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, CardBorder, RoundedCornerShape(14.dp)),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Header Row: Status & Order #
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .width(90.dp)
                        .height(20.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(brush)
                )
                Box(
                    modifier = Modifier
                        .width(70.dp)
                        .height(14.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }

            // Restaurant Title & Time
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.6f)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Box(
                    modifier = Modifier
                        .width(100.dp)
                        .height(12.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }

            // Divider / Line item placeholder
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Color(0xFFEDF2F7))
            )

            // Items summary and Total Price
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .width(120.dp)
                        .height(12.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Box(
                    modifier = Modifier
                        .width(60.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }
        }
    }
}
