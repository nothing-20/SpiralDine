package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.BusinessHours
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.UserLocation
import com.spiralworld.spiraldine.data.repository.RestaurantFilterCriteria
import com.spiralworld.spiraldine.data.repository.RestaurantSearchFilterEngine
import com.spiralworld.spiraldine.data.repository.RestaurantSortOption
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class RestaurantSearchFilterTest {

    private lateinit var sampleRestaurants: List<Restaurant>

    @Before
    fun setup() {
        sampleRestaurants = listOf(
            Restaurant(
                id = "bawarchi-1",
                name = "Bawarchi Restaurant",
                locality = "RTC X Roads",
                city = "Hyderabad",
                address = "RTC X Roads, Hyderabad",
                cuisines = listOf("Biryani", "North Indian", "Mughlai"),
                rating = 4.6,
                reviewCount = 1200,
                priceForTwo = 650,
                isPureVeg = false,
                activeOffersCount = 2,
                activeOfferBadge = "20% OFF",
                isOpen = true,
                latitude = 17.4065,
                longitude = 78.4983
            ),
            Restaurant(
                id = "chutneys-pure-veg",
                name = "Chutneys Coffee House",
                locality = "Banjara Hills",
                city = "Hyderabad",
                address = "Road No 3, Banjara Hills",
                cuisines = listOf("South Indian", "Pure Veg", "Breakfast"),
                rating = 4.5,
                reviewCount = 450,
                priceForTwo = 450,
                isPureVeg = true,
                activeOffersCount = 0,
                activeOfferBadge = null,
                isOpen = true,
                latitude = 17.4156,
                longitude = 78.4350
            ),
            Restaurant(
                id = "paradise-sec",
                name = "Paradise Food Court",
                locality = "Secunderabad",
                city = "Hyderabad",
                address = "MG Road, Secunderabad",
                cuisines = listOf("Biryani", "Hyderabadi"),
                rating = 4.2,
                reviewCount = 890,
                priceForTwo = 800,
                isPureVeg = false,
                activeOffersCount = 1,
                activeOfferBadge = "Flat ₹100 OFF",
                isOpen = false, // explicitly closed
                latitude = 17.4411,
                longitude = 78.4870
            ),
            Restaurant(
                id = "new-unrated-spot",
                name = "Royal Tandoor Spot",
                locality = "Gachibowli",
                city = "Hyderabad",
                address = "Outer Ring Road, Gachibowli",
                cuisines = listOf("North Indian", "Kebabs"),
                rating = null, // unrated brand new restaurant
                reviewCount = 0,
                priceForTwo = 1200,
                isPureVeg = false,
                activeOffersCount = 0,
                activeOfferBadge = null,
                isOpen = true,
                latitude = 17.4400,
                longitude = 78.3489
            )
        )
    }

    @Test
    fun testSearchMatching_caseInsensitive() {
        val criteria = RestaurantFilterCriteria(searchQuery = "bAwArChI")
        val results = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        assertEquals(1, results.size)
        assertEquals("bawarchi-1", results.first().id)
    }

    @Test
    fun testSearchMatching_whitespaceNormalization() {
        val criteria = RestaurantFilterCriteria(searchQuery = "   paradise    food   ")
        val results = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        assertEquals(1, results.size)
        assertEquals("paradise-sec", results.first().id)
    }

    @Test
    fun testSearchMatching_emptyQuery_returnsAll() {
        val criteria = RestaurantFilterCriteria(searchQuery = "   ")
        val results = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        assertEquals(sampleRestaurants.size, results.size)
    }

    @Test
    fun testSearchMatching_byCuisineKeyword() {
        val criteria = RestaurantFilterCriteria(searchQuery = "biryani")
        val results = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        assertEquals(2, results.size)
        assertTrue(results.any { it.id == "bawarchi-1" })
        assertTrue(results.any { it.id == "paradise-sec" })
    }

    @Test
    fun testSearchMatching_byLocalityKeyword() {
        val criteria = RestaurantFilterCriteria(searchQuery = "Banjara")
        val results = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        assertEquals(1, results.size)
        assertEquals("chutneys-pure-veg", results.first().id)
    }

    @Test
    fun testDuplicateResultPrevention() {
        // Feed list containing duplicate restaurant entries
        val duplicatedList = sampleRestaurants + sampleRestaurants.take(2)
        assertEquals(sampleRestaurants.size + 2, duplicatedList.size)

        val results = RestaurantSearchFilterEngine.filterAndSort(
            duplicatedList,
            RestaurantFilterCriteria()
        )

        assertEquals(sampleRestaurants.size, results.size)
        val ids = results.map { it.id }
        assertEquals(ids.distinct().size, ids.size)
    }

    @Test
    fun testPureVegFilter() {
        val criteria = RestaurantFilterCriteria(pureVegOnly = true)
        val results = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        assertEquals(1, results.size)
        assertEquals("chutneys-pure-veg", results.first().id)
        assertTrue(results.first().isPureVeg)
    }

    @Test
    fun testOpenNowFilter_excludesClosedRestaurants() {
        val criteria = RestaurantFilterCriteria(openNowOnly = true)
        val results = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        assertFalse(results.any { it.id == "paradise-sec" })
    }

    @Test
    fun testOffersOnlyFilter() {
        val criteria = RestaurantFilterCriteria(offersOnly = true)
        val results = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        assertEquals(2, results.size)
        assertTrue(results.all { it.activeOffersCount > 0 || !it.activeOfferBadge.isNullOrBlank() })
    }

    @Test
    fun testRatingThreshold_excludesUnratedRestaurants() {
        // Threshold: 4.4+
        val criteria = RestaurantFilterCriteria(minRating = 4.4)
        val results = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        // Bawarchi (4.6) and Chutneys (4.5) match.
        // Paradise (4.2) does not match.
        // Royal Tandoor Spot (null rating, 0 reviews) MUST NOT match!
        assertEquals(2, results.size)
        assertTrue(results.all { it.hasVerifiedRating && (it.rating ?: 0.0) >= 4.4 })
        assertFalse(results.any { it.id == "new-unrated-spot" })
    }

    @Test
    fun testPriceTierFilter() {
        // Under ₹500
        val budgetCriteria = RestaurantFilterCriteria(selectedPriceTier = "Under ₹500")
        val budgetResults = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, budgetCriteria)
        assertEquals(1, budgetResults.size)
        assertEquals("chutneys-pure-veg", budgetResults.first().id)

        // Above ₹1000
        val premiumCriteria = RestaurantFilterCriteria(selectedPriceTier = "Above ₹1000")
        val premiumResults = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, premiumCriteria)
        assertEquals(1, premiumResults.size)
        assertEquals("new-unrated-spot", premiumResults.first().id)
    }

    @Test
    fun testComposableFilters_multipleFiltersTogether() {
        // Search "Biryani" + Open Now + Offers Only
        val criteria = RestaurantFilterCriteria(
            searchQuery = "biryani",
            openNowOnly = true,
            offersOnly = true
        )
        val results = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        // Only Bawarchi meets all 3 criteria (Paradise is closed)
        assertEquals(1, results.size)
        assertEquals("bawarchi-1", results.first().id)
    }

    @Test
    fun testClearingFilters_restoresAllResults() {
        val criteria = RestaurantFilterCriteria(
            searchQuery = "non-existent-food-item-xyz",
            pureVegOnly = true
        )
        val emptyResults = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)
        assertEquals(0, emptyResults.size)

        // Clear criteria
        val cleared = criteria.clear()
        assertFalse(cleared.hasActiveFilters)
        val restoredResults = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, cleared)
        assertEquals(sampleRestaurants.size, restoredResults.size)
    }

    @Test
    fun testMissingOptionalFields_doesNotCrash() {
        val sparseRestaurant = Restaurant(
            id = "sparse-1",
            name = "Minimal Eatery",
            cuisines = emptyList(),
            rating = null,
            reviewCount = 0,
            priceForTwo = null,
            priceTier = null,
            address = "",
            locality = "",
            city = "",
            businessHours = null,
            latitude = null,
            longitude = null
        )

        val results = RestaurantSearchFilterEngine.filterAndSort(
            listOf(sparseRestaurant),
            RestaurantFilterCriteria(searchQuery = "Minimal")
        )

        assertEquals(1, results.size)
        assertEquals("sparse-1", results.first().id)
        assertFalse(results.first().hasVerifiedRating)
    }

    @Test
    fun testSorting_RatingHighToLow_placesVerifiedRatingsFirst() {
        val criteria = RestaurantFilterCriteria(sortBy = RestaurantSortOption.RATING_HIGH_TO_LOW)
        val sorted = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        assertEquals("bawarchi-1", sorted[0].id) // 4.6
        assertEquals("chutneys-pure-veg", sorted[1].id) // 4.5
        assertEquals("paradise-sec", sorted[2].id) // 4.2
        assertEquals("new-unrated-spot", sorted[3].id) // null rating (at bottom)
    }

    @Test
    fun testSorting_PriceLowToHigh() {
        val criteria = RestaurantFilterCriteria(sortBy = RestaurantSortOption.PRICE_LOW_TO_HIGH)
        val sorted = RestaurantSearchFilterEngine.filterAndSort(sampleRestaurants, criteria)

        assertEquals("chutneys-pure-veg", sorted[0].id) // 450
        assertEquals("bawarchi-1", sorted[1].id) // 650
        assertEquals("paradise-sec", sorted[2].id) // 800
        assertEquals("new-unrated-spot", sorted[3].id) // 1200
    }

    @Test
    fun testSorting_DistanceNearest() {
        // User at Banjara Hills (near Chutneys)
        val userLocation = UserLocation(latitude = 17.4160, longitude = 78.4360)
        val criteria = RestaurantFilterCriteria(sortBy = RestaurantSortOption.DISTANCE_NEAREST)
        val sorted = RestaurantSearchFilterEngine.filterAndSort(
            sampleRestaurants,
            criteria,
            userLocation = userLocation
        )

        assertEquals("chutneys-pure-veg", sorted[0].id)
    }
}
