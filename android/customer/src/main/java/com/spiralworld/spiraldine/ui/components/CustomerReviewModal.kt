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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.OrderRecord
import com.spiralworld.spiraldine.data.model.ReviewRecord
import com.spiralworld.spiraldine.data.repository.ReviewRepository
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.NonVegRed
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.StarGold
import com.spiralworld.spiraldine.theme.SuccessGreen
import com.spiralworld.spiraldine.theme.SuccessGreenBg
import com.spiralworld.spiraldine.theme.SurfaceMuted
import com.spiralworld.spiraldine.theme.SurfaceWhite
import com.spiralworld.spiraldine.theme.TextPrimary
import com.spiralworld.spiraldine.theme.TextSecondary
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerReviewModal(
    isOpen: Boolean,
    onClose: () -> Unit,
    order: OrderRecord,
    existingReview: ReviewRecord? = null,
    reviewRepository: ReviewRepository? = null,
    customerName: String = "Table Guest",
    onReviewSubmitted: (ReviewRecord) -> Unit = {}
) {
    if (!isOpen) return

    val coroutineScope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    var overallRating by remember { mutableIntStateOf(existingReview?.starRating ?: 5) }
    var foodRating by remember { mutableIntStateOf(existingReview?.foodQuality ?: 5) }
    var serviceRating by remember { mutableIntStateOf(existingReview?.service ?: 5) }
    var cleanlinessRating by remember { mutableIntStateOf(existingReview?.cleanliness ?: 5) }
    var ambienceRating by remember { mutableIntStateOf(existingReview?.ambience ?: 5) }
    var comments by remember { mutableStateOf(existingReview?.notes ?: "") }
    var isAnonymous by remember { mutableStateOf(existingReview?.isAnonymous ?: false) }
    var revisitIntention by remember { mutableStateOf(existingReview?.revisitIntention ?: "Yes") }

    var isSubmitting by remember { mutableStateOf(false) }
    var submitError by remember { mutableStateOf<String?>(null) }
    var isSubmittedSuccess by remember { mutableStateOf(existingReview != null) }

    val experienceCategories = listOf(
        1 to "Very Poor",
        2 to "Poor",
        3 to "Average",
        4 to "Good",
        5 to "Excellent"
    )

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
                .verticalScroll(scrollState)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = if (isSubmittedSuccess) "Your Dining Review" else "Rate Your Experience",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Order #${order.orderId} • Table #${order.tableNumber}",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }

                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(SurfaceMuted)
                        .clickable { onClose() },
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

            Spacer(modifier = Modifier.height(16.dp))

            if (isSubmittedSuccess) {
                // Display already submitted review
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SuccessGreenBg),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = SuccessGreen)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Feedback Published & Recorded",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = SuccessGreen
                            )
                        }
                        Text(
                            text = "Thank you! Your feedback helps the restaurant kitchen and service team maintain high standards.",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )

                        // Stars row
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            (1..5).forEach { star ->
                                Icon(
                                    imageVector = if (star <= overallRating) Icons.Default.Star else Icons.Outlined.Star,
                                    contentDescription = null,
                                    tint = if (star <= overallRating) StarGold else CardBorder,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = experienceCategories.firstOrNull { it.first == overallRating }?.second ?: "Good",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                        }

                        if (comments.isNotBlank()) {
                            Text(
                                text = "\"$comments\"",
                                fontSize = 12.sp,
                                fontStyle = androidx.compose.ui.text.font.FontStyle.Italic,
                                color = TextPrimary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = onClose,
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().height(46.dp)
                ) {
                    Text("Done", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
            } else {
                // Interactive Form
                // 1. Overall Star Rating
                Text(
                    text = "OVERALL EXPERIENCE",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextSecondary,
                    letterSpacing = 1.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    (1..5).forEach { star ->
                        Icon(
                            imageVector = if (star <= overallRating) Icons.Default.Star else Icons.Outlined.Star,
                            contentDescription = "$star Stars",
                            tint = if (star <= overallRating) StarGold else CardBorder,
                            modifier = Modifier
                                .size(40.dp)
                                .clickable { overallRating = star }
                                .padding(4.dp)
                        )
                    }
                }

                // Category pill
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    val label = experienceCategories.firstOrNull { it.first == overallRating }?.second ?: "Good"
                    Text(
                        text = label,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = SpiralDineOrange
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                // 2. Specific Sub-ratings
                Text(
                    text = "CATEGORY RATINGS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextSecondary,
                    letterSpacing = 1.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                RatingRow("Food & Taste", foodRating) { foodRating = it }
                RatingRow("Service & Hospitality", serviceRating) { serviceRating = it }
                RatingRow("Cleanliness & Hygiene", cleanlinessRating) { cleanlinessRating = it }
                RatingRow("Ambience & Seating", ambienceRating) { ambienceRating = it }

                Spacer(modifier = Modifier.height(14.dp))

                // 3. Comments
                Text(
                    text = "WRITTEN FEEDBACK (OPTIONAL)",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextSecondary,
                    letterSpacing = 1.sp
                )

                Spacer(modifier = Modifier.height(6.dp))

                OutlinedTextField(
                    value = comments,
                    onValueChange = { if (it.length <= 500) comments = it },
                    placeholder = { Text("What did you enjoy most? Any dishes or staff to shout out?", fontSize = 12.sp) },
                    modifier = Modifier.fillMaxWidth().height(100.dp),
                    shape = RoundedCornerShape(12.dp)
                )

                Text(
                    text = "${comments.length}/500",
                    fontSize = 10.sp,
                    color = TextSecondary,
                    modifier = Modifier.align(Alignment.End).padding(top = 2.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                // 4. Revisit Intention
                Text(
                    text = "WOULD YOU VISIT AGAIN?",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextSecondary,
                    letterSpacing = 1.sp
                )

                Spacer(modifier = Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("Yes", "Maybe", "No").forEach { option ->
                        val isSelected = revisitIntention == option
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(8.dp))
                                .background(if (isSelected) SpiralDineOrange else SurfaceMuted)
                                .clickable { revisitIntention = option }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = option,
                                fontSize = 12.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                color = if (isSelected) SurfaceWhite else TextPrimary
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // 5. Anonymous toggle
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Post Anonymously", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                        Text(
                            text = if (isAnonymous) "Your name will be masked (e.g. G*** D***)" else "Posting as $customerName",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                    Switch(
                        checked = isAnonymous,
                        onCheckedChange = { isAnonymous = it },
                        colors = SwitchDefaults.colors(checkedThumbColor = SpiralDineOrange, checkedTrackColor = SpiralDineOrange.copy(alpha = 0.5f))
                    )
                }

                if (submitError != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = submitError!!,
                        fontSize = 11.sp,
                        color = NonVegRed,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Submit Action Button
                Button(
                    onClick = {
                        if (reviewRepository != null && !isSubmitting) {
                            isSubmitting = true
                            submitError = null
                            coroutineScope.launch {
                                val categoryName = experienceCategories.firstOrNull { it.first == overallRating }?.second ?: "Good"
                                val record = ReviewRecord(
                                    orderId = order.orderId,
                                    tenantId = order.tenantId,
                                    tableNumber = order.tableNumber,
                                    rating = categoryName,
                                    starRating = overallRating,
                                    foodQuality = foodRating,
                                    service = serviceRating,
                                    cleanliness = cleanlinessRating,
                                    ambience = ambienceRating,
                                    notes = comments.trim(),
                                    isAnonymous = isAnonymous,
                                    submittedByName = customerName,
                                    revisitIntention = revisitIntention,
                                    status = "Published"
                                )
                                val res = reviewRepository.submitReview(record)
                                isSubmitting = false
                                if (res.isSuccess) {
                                    isSubmittedSuccess = true
                                    onReviewSubmitted(record)
                                } else {
                                    submitError = res.exceptionOrNull()?.message ?: "Failed to submit review."
                                }
                            }
                        }
                    },
                    enabled = !isSubmitting,
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(modifier = Modifier.size(18.dp), color = SurfaceWhite, strokeWidth = 2.dp)
                    } else {
                        Icon(Icons.Default.Star, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Submit Review", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun RatingRow(
    title: String,
    rating: Int,
    onRatingChange: (Int) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(title, fontSize = 12.sp, color = TextPrimary)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            (1..5).forEach { star ->
                Icon(
                    imageVector = if (star <= rating) Icons.Default.Star else Icons.Outlined.Star,
                    contentDescription = "$star Stars",
                    tint = if (star <= rating) StarGold else CardBorder,
                    modifier = Modifier
                        .size(24.dp)
                        .clickable { onRatingChange(star) }
                )
            }
        }
    }
}
