package com.spiralworld.spiraldine.data.repository

import com.spiralworld.spiraldine.data.model.CategoryAverages
import com.spiralworld.spiraldine.data.model.RestaurantRatingSummary
import com.spiralworld.spiraldine.data.model.ReviewRecord
import kotlin.math.roundToInt

object RatingCalculator {

    /**
     * Aggregates a list of verified reviews into an authoritative RestaurantRatingSummary.
     * Prevents arbitrary client-side writes and ensures consistent aggregation.
     */
    fun calculate(reviews: List<ReviewRecord>): RestaurantRatingSummary {
        val totalReviews = reviews.size
        if (totalReviews == 0) {
            return RestaurantRatingSummary(
                averageRating = 0.0,
                totalReviews = 0,
                starDistribution = mapOf(5 to 0, 4 to 0, 3 to 0, 2 to 0, 1 to 0),
                starCounts = mapOf(5 to 0, 4 to 0, 3 to 0, 2 to 0, 1 to 0),
                categoryAverages = CategoryAverages(),
                revisitRate = 0,
                hasReviews = false
            )
        }

        val starCounts = mutableMapOf(1 to 0, 2 to 0, 3 to 0, 4 to 0, 5 to 0)
        var totalOverallScore = 0
        var totalFood = 0
        var totalService = 0
        var totalCleanliness = 0
        var totalAmbience = 0

        var foodCount = 0
        var serviceCount = 0
        var cleanlinessCount = 0
        var ambienceCount = 0
        var revisitYesCount = 0

        reviews.forEach { r ->
            // Canonical star rating (1..5)
            val score = when {
                r.starRating in 1..5 -> r.starRating
                else -> mapRatingStringToScore(r.rating)
            }.coerceIn(1, 5)

            starCounts[score] = (starCounts[score] ?: 0) + 1
            totalOverallScore += score

            if (r.foodQuality in 1..5) {
                totalFood += r.foodQuality
                foodCount++
            }
            if (r.service in 1..5) {
                totalService += r.service
                serviceCount++
            }
            if (r.cleanliness in 1..5) {
                totalCleanliness += r.cleanliness
                cleanlinessCount++
            }
            if (r.ambience in 1..5) {
                totalAmbience += r.ambience
                ambienceCount++
            }

            if (r.revisitIntention.equals("Yes", ignoreCase = true)) {
                revisitYesCount++
            }
        }

        val averageRating = roundToOneDecimal(totalOverallScore.toDouble() / totalReviews)

        val starDistribution = starCounts.mapValues { (_, count) ->
            ((count.toDouble() / totalReviews) * 100).roundToInt()
        }

        val catAverages = CategoryAverages(
            foodQuality = if (foodCount > 0) roundToOneDecimal(totalFood.toDouble() / foodCount) else averageRating,
            service = if (serviceCount > 0) roundToOneDecimal(totalService.toDouble() / serviceCount) else averageRating,
            cleanliness = if (cleanlinessCount > 0) roundToOneDecimal(totalCleanliness.toDouble() / cleanlinessCount) else averageRating,
            ambience = if (ambienceCount > 0) roundToOneDecimal(totalAmbience.toDouble() / ambienceCount) else averageRating
        )

        val revisitRate = ((revisitYesCount.toDouble() / totalReviews) * 100).roundToInt()

        return RestaurantRatingSummary(
            averageRating = averageRating,
            totalReviews = totalReviews,
            starDistribution = starDistribution,
            starCounts = starCounts,
            categoryAverages = catAverages,
            revisitRate = revisitRate,
            hasReviews = true
        )
    }

    private fun mapRatingStringToScore(ratingStr: String?): Int {
        return when (ratingStr?.trim()?.lowercase()) {
            "excellent" -> 5
            "good" -> 4
            "average" -> 3
            "poor" -> 2
            "very poor", "complaint" -> 1
            else -> 5
        }
    }

    private fun roundToOneDecimal(value: Double): Double {
        return (value * 10.0).roundToInt() / 10.0
    }
}
