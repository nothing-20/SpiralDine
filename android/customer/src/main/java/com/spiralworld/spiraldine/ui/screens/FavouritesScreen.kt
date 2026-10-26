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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.UserLocation
import com.spiralworld.spiraldine.theme.BorderColor
import com.spiralworld.spiraldine.theme.CardBackground
import com.spiralworld.spiraldine.theme.MainBackground
import com.spiralworld.spiraldine.theme.PrimaryGreen
import com.spiralworld.spiraldine.theme.PrimaryText
import com.spiralworld.spiraldine.theme.SecondaryText
import com.spiralworld.spiraldine.theme.TerracottaAccent
import com.spiralworld.spiraldine.ui.components.RestaurantCard

@Composable
fun FavouritesScreen(
    restaurants: List<Restaurant> = emptyList(),
    allRestaurants: List<Restaurant> = restaurants,
    favouriteRestaurantIds: Set<String> = emptySet(),
    userLocation: UserLocation? = null,
    onBack: () -> Unit,
    onRestaurantClick: (Restaurant) -> Unit,
    onRemoveFavourite: ((Restaurant) -> Unit)? = null,
    onToggleFavourite: ((Restaurant) -> Unit)? = onRemoveFavourite,
    onExploreClick: () -> Unit
) {
    val effectiveRestaurants = if (restaurants.isNotEmpty()) restaurants else allRestaurants
    val favouriteRestaurants = effectiveRestaurants.filter { favouriteRestaurantIds.contains(it.id) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MainBackground),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Top Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(CardBackground)
                        .border(1.dp, BorderColor, CircleShape)
                        .clickable { onBack() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = PrimaryText,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Column {
                    Text(
                        text = "My Favourites",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = PrimaryText
                    )
                    Text(
                        text = "${favouriteRestaurants.size} saved venue${if (favouriteRestaurants.size == 1) "" else "s"}",
                        fontSize = 12.sp,
                        color = SecondaryText
                    )
                }
            }
        }

        if (favouriteRestaurants.isEmpty()) {
            item {
                Spacer(modifier = Modifier.height(40.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(TerracottaAccent.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.FavoriteBorder,
                                contentDescription = null,
                                tint = TerracottaAccent,
                                modifier = Modifier.size(32.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "No Favourite Restaurants Yet",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryText,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = "Restaurants you save will appear here for fast table booking and ordering.",
                            fontSize = 12.sp,
                            color = SecondaryText,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 8.dp)
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = onExploreClick,
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.height(44.dp)
                        ) {
                            Text(
                                text = "Explore Restaurants",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        } else {
            items(favouriteRestaurants, key = { it.id }) { restaurant ->
                RestaurantCard(
                    restaurant = restaurant,
                    distanceKm = com.spiralworld.spiraldine.data.repository.DistanceCalculator.getRestaurantDistanceKm(userLocation, restaurant),
                    isFavourite = true,
                    onFavouriteToggle = { (onRemoveFavourite ?: onToggleFavourite)?.invoke(restaurant) },
                    onClick = { onRestaurantClick(restaurant) }
                )
            }
        }
    }
}
