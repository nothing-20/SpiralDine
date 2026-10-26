package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.ReviewRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerReviewsScreen(
    reviews: List<ReviewRecord>,
    onBack: () -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedStarFilter by remember { mutableStateOf(0) } // 0 = All

    val totalReviews = reviews.size
    val averageRating = if (totalReviews > 0) reviews.map { it.rating }.average() else 5.0
    val recommendCount = reviews.count { it.wouldRecommend || it.rating >= 4 }
    val recommendPercent = if (totalReviews > 0) (recommendCount * 100) / totalReviews else 100

    val filteredReviews = remember(reviews, searchQuery, selectedStarFilter) {
        reviews.filter { rev ->
            val matchesSearch = searchQuery.isBlank() ||
                rev.customerName.contains(searchQuery, ignoreCase = true) ||
                rev.comments.contains(searchQuery, ignoreCase = true)

            val matchesStar = selectedStarFilter == 0 || rev.rating == selectedStarFilter

            matchesSearch && matchesStar
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Customer Reviews & Ratings", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = BackgroundLight
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Rating Overview Card
            OwnerCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.Bottom) {
                            Text(
                                String.format(Locale.US, "%.1f", averageRating),
                                fontSize = 32.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                            Text(" / 5.0", fontSize = 14.sp, color = TextSecondary, modifier = Modifier.padding(bottom = 4.dp))
                        }
                        Row {
                            repeat(5) { idx ->
                                Icon(
                                    Icons.Default.Star,
                                    contentDescription = null,
                                    tint = if (idx < averageRating.toInt()) WarningAmber else BorderLight,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Based on $totalReviews verified reviews", fontSize = 11.sp, color = TextSecondary)
                    }

                    Column(horizontalAlignment = Alignment.End) {
                        Surface(color = SuccessGreenLight, shape = RoundedCornerShape(8.dp)) {
                            Text(
                                "$recommendPercent% Recommend",
                                color = SuccessGreen,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            // Search & Filter
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search reviews by customer or comment...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSecondary) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = SurfaceWhite,
                    unfocusedContainerColor = SurfaceWhite,
                    unfocusedBorderColor = BorderLight
                )
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Star Filters
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                val starOptions = listOf(0 to "All", 5 to "5 Stars", 4 to "4 Stars", 3 to "3 Stars", 2 to "2 Stars", 1 to "1 Star")
                items(starOptions) { (stars, label) ->
                    val isSelected = selectedStarFilter == stars
                    FilterChip(
                        selected = isSelected,
                        onClick = { selectedStarFilter = stars },
                        label = { Text(label, fontSize = 12.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = TerracottaOrangeLight,
                            selectedLabelColor = TerracottaOrange
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Review List
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                if (filteredReviews.isEmpty()) {
                    item {
                        OwnerCard(modifier = Modifier.fillMaxWidth()) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(32.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No reviews match your criteria", color = TextSecondary, fontSize = 13.sp)
                            }
                        }
                    }
                } else {
                    items(filteredReviews, key = { it.id }) { review ->
                        ReviewCard(review = review)
                    }
                }
                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun ReviewCard(review: ReviewRecord) {
    OwnerCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(review.customerName, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = TextPrimary)
                    Text(review.diningOption, fontSize = 10.sp, color = TextSecondary)
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    repeat(5) { idx ->
                        Icon(
                            Icons.Default.Star,
                            contentDescription = null,
                            tint = if (idx < review.rating) WarningAmber else BorderLight,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }

            if (review.comments.isNotBlank()) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    review.comments,
                    fontSize = 12.sp,
                    color = TextPrimary
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Food: ${review.foodQuality}/5 • Service: ${review.serviceSpeed}/5 • Ambience: ${review.ambience}/5", fontSize = 10.sp, color = TextSecondary)
                Text(review.createdAt.ifBlank { "Recently" }, fontSize = 10.sp, color = TextMuted)
            }
        }
    }
}
