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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.repository.CurrencyFormatter
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.NonVegRed
import com.spiralworld.spiraldine.theme.NonVegRedBg
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.SpiralDineOrangeLight
import com.spiralworld.spiraldine.theme.SurfaceMuted
import com.spiralworld.spiraldine.theme.SurfaceWhite
import com.spiralworld.spiraldine.theme.TextPrimary
import com.spiralworld.spiraldine.theme.TextSecondary
import com.spiralworld.spiraldine.theme.VegGreen

@Composable
fun FoodItemCard(
    item: MenuItem,
    cartCount: Int,
    onAdd: () -> Unit,
    onRemove: () -> Unit,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isSoldOut = !item.isAvailable

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(enabled = !isSoldOut) { onClick() }
            .border(width = 1.dp, color = CardBorder, shape = RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column {
            // Food Image + Badges
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(110.dp)
                    .background(SurfaceMuted)
            ) {
                if (item.imageUrl.isNotBlank()) {
                    AsyncImage(
                        model = item.imageUrl,
                        contentDescription = item.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(110.dp)
                    )
                }

                // Veg / Non-Veg Indicator Top-Left
                Box(
                    modifier = Modifier
                        .padding(6.dp)
                        .size(16.dp)
                        .background(SurfaceWhite, RoundedCornerShape(4.dp))
                        .border(
                            width = 1.5.dp,
                            color = if (item.isVeg) VegGreen else NonVegRed,
                            shape = RoundedCornerShape(4.dp)
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .background(
                                color = if (item.isVeg) VegGreen else NonVegRed,
                                shape = CircleShape
                            )
                    )
                }

                // Sold Out Overlay Badge or Discount Badge Top-Right
                if (isSoldOut) {
                    Text(
                        text = "SOLD OUT",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = NonVegRed,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                            .background(NonVegRedBg, RoundedCornerShape(6.dp))
                            .border(0.5.dp, NonVegRed.copy(alpha = 0.5f), RoundedCornerShape(6.dp))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                } else if (item.discountPrice != null && item.discountPrice > 0 && item.discountPrice < item.price) {
                    val pct = (((item.price - item.discountPrice) / item.price) * 100).toInt()
                    Text(
                        text = "$pct% OFF",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SurfaceWhite,
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(6.dp)
                            .background(SpiralDineOrange, RoundedCornerShape(6.dp))
                            .padding(horizontal = 5.dp, vertical = 2.dp)
                    )
                }
            }

            // Details Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(10.dp)
            ) {
                Text(
                    text = item.name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isSoldOut) TextSecondary else TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(3.dp))

                if (item.description.isNotBlank()) {
                    Text(
                        text = item.description,
                        fontSize = 10.sp,
                        color = TextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                }

                // Price & Add Button Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Pricing & Customization flag
                    Column {
                        Row(
                            verticalAlignment = Alignment.Bottom,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = CurrencyFormatter.formatPrice(item.effectivePrice),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = if (isSoldOut) TextSecondary else TextPrimary
                            )
                            if (item.discountPrice != null && item.discountPrice > 0 && item.discountPrice < item.price) {
                                Text(
                                    text = CurrencyFormatter.formatPrice(item.price),
                                    fontSize = 10.sp,
                                    color = TextSecondary,
                                    textDecoration = TextDecoration.LineThrough
                                )
                            }
                        }

                        if (item.isCustomizable && !isSoldOut) {
                            Text(
                                text = "Customizable",
                                fontSize = 9.sp,
                                color = SpiralDineOrange,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }

                    // Add / Quantity Controller
                    if (isSoldOut) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(SurfaceMuted)
                                .border(1.dp, CardBorder, RoundedCornerShape(8.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Unavailable",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextSecondary
                            )
                        }
                    } else if (cartCount <= 0 || item.isCustomizable) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(SpiralDineOrangeLight)
                                .border(1.dp, SpiralDineOrange.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                                .clickable { onAdd() }
                                .padding(horizontal = 12.dp, vertical = 5.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (item.isCustomizable && cartCount > 0) "+$cartCount" else "ADD",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = SpiralDineOrange
                            )
                        }
                    } else {
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(SpiralDineOrange)
                                .padding(horizontal = 2.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clickable { onRemove() },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Remove,
                                    contentDescription = "Decrease",
                                    tint = SurfaceWhite,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                            Text(
                                text = "$cartCount",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = SurfaceWhite,
                                modifier = Modifier.padding(horizontal = 4.dp)
                            )
                            Box(
                                modifier = Modifier
                                    .size(28.dp)
                                    .clickable { onAdd() },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Add,
                                    contentDescription = "Increase",
                                    tint = SurfaceWhite,
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
