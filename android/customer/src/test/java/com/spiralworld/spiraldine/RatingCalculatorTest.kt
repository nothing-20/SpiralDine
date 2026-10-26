package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.ReviewRecord
import com.spiralworld.spiraldine.data.repository.RatingCalculator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RatingCalculatorTest {

    @Test
    fun testEmptyReviews_returnsDefaultSummary() {
        val summary = RatingCalculator.calculate(emptyList())

        assertEquals(0.0, summary.averageRating, 0.0)
        assertEquals(0, summary.totalReviews)
        assertEquals(0, summary.revisitRate)
        assertFalse(summary.hasReviews)
        assertEquals(0, summary.starCounts[5])
    }

    @Test
    fun testRatingAggregation_withMultipleReviews() {
        val reviews = listOf(
            ReviewRecord(
                id = "rev-1",
                orderId = "ord-1",
                starRating = 5,
                foodQuality = 5,
                service = 4,
                cleanliness = 5,
                ambience = 4,
                revisitIntention = "Yes"
            ),
            ReviewRecord(
                id = "rev-2",
                orderId = "ord-2",
                starRating = 4,
                foodQuality = 4,
                service = 5,
                cleanliness = 4,
                ambience = 4,
                revisitIntention = "Yes"
            ),
            ReviewRecord(
                id = "rev-3",
                orderId = "ord-3",
                starRating = 3,
                foodQuality = 3,
                service = 3,
                cleanliness = 4,
                ambience = 3,
                revisitIntention = "Maybe"
            ),
            ReviewRecord(
                id = "rev-4",
                orderId = "ord-4",
                starRating = 5,
                foodQuality = 5,
                service = 5,
                cleanliness = 5,
                ambience = 5,
                revisitIntention = "Yes"
            )
        )

        val summary = RatingCalculator.calculate(reviews)

        assertEquals(4, summary.totalReviews)
        assertTrue(summary.hasReviews)

        // Average: (5 + 4 + 3 + 5) / 4 = 17 / 4 = 4.25 -> 4.3 rounded
        assertEquals(4.3, summary.averageRating, 0.01)

        // Star distribution counts
        assertEquals(2, summary.starCounts[5])
        assertEquals(1, summary.starCounts[4])
        assertEquals(1, summary.starCounts[3])
        assertEquals(0, summary.starCounts[2])
        assertEquals(0, summary.starCounts[1])

        // Star distribution percentages: 2/4 = 50%, 1/4 = 25%
        assertEquals(50, summary.starDistribution[5])
        assertEquals(25, summary.starDistribution[4])
        assertEquals(25, summary.starDistribution[3])

        // Category averages
        // Food: (5 + 4 + 3 + 5) / 4 = 4.3
        assertEquals(4.3, summary.categoryAverages.foodQuality, 0.01)
        // Service: (4 + 5 + 3 + 5) / 4 = 4.3
        assertEquals(4.3, summary.categoryAverages.service, 0.01)
        // Cleanliness: (5 + 4 + 4 + 5) / 4 = 4.5
        assertEquals(4.5, summary.categoryAverages.cleanliness, 0.01)

        // Revisit rate: 3 "Yes" out of 4 reviews = 75%
        assertEquals(75, summary.revisitRate)
    }

    @Test
    fun testStringRatingFallback_mapsToNumericScore() {
        val reviews = listOf(
            ReviewRecord(
                id = "rev-str-1",
                orderId = "ord-1",
                rating = "Very Poor",
                starRating = 0 // Invalid/missing starRating
            ),
            ReviewRecord(
                id = "rev-str-2",
                orderId = "ord-2",
                rating = "Good",
                starRating = 0
            )
        )

        val summary = RatingCalculator.calculate(reviews)

        // "Very Poor" -> 1, "Good" -> 4. Average = (1 + 4) / 2 = 2.5
        assertEquals(2, summary.totalReviews)
        assertEquals(2.5, summary.averageRating, 0.01)
        assertEquals(1, summary.starCounts[1])
        assertEquals(1, summary.starCounts[4])
    }
}
