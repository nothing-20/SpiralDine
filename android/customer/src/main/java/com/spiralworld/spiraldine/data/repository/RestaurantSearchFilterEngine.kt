package com.spiralworld.spiraldine.data.repository

import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.UserLocation

enum class RestaurantSortOption(val displayName: String) {
    RECOMMENDED("Recommended"),
    RATING_HIGH_TO_LOW("Rating: High to Low"),
    PRICE_LOW_TO_HIGH("Cost: Low to High"),
    PRICE_HIGH_TO_LOW("Cost: High to Low"),
    DISTANCE_NEAREST("Nearest to Me")
}

data class RestaurantFilterCriteria(
    val searchQuery: String = "",
    val selectedCuisine: String = "All",
    val openNowOnly: Boolean = false,
    val pureVegOnly: Boolean = false,
    val offersOnly: Boolean = false,
    val selectedPriceTier: String? = null, // e.g. "Under ₹500", "₹500 - ₹1000", "Above ₹1000"
    val minRating: Double? = null, // e.g. 4.0
    val maxDistanceKm: Double? = null,
    val sortBy: RestaurantSortOption = RestaurantSortOption.RECOMMENDED
) {
    val hasActiveFilters: Boolean
        get() = searchQuery.isNotBlank() ||
                (selectedCuisine.isNotBlank() && !selectedCuisine.equals("All", ignoreCase = true)) ||
                openNowOnly ||
                pureVegOnly ||
                offersOnly ||
                selectedPriceTier != null ||
                minRating != null ||
                maxDistanceKm != null ||
                sortBy != RestaurantSortOption.RECOMMENDED

    fun clear(): RestaurantFilterCriteria = RestaurantFilterCriteria()
}

object RestaurantSearchFilterEngine {

    /**
     * Composable and deterministic search, filter, and sort engine.
     * Prevents duplicate entries and strictly verifies rating & operating-hours constraints.
     */
    fun filterAndSort(
        restaurants: List<Restaurant>,
        criteria: RestaurantFilterCriteria,
        userLocation: UserLocation? = null,
        currentTimeMillis: Long = System.currentTimeMillis()
    ): List<Restaurant> {
        // Step 1: Deduplicate input list by ID
        val uniqueRestaurants = restaurants.distinctBy { it.id }

        // Step 2: Normalize search query
        val normalizedQuery = criteria.searchQuery.trim().replace(Regex("\\s+"), " ")

        // Step 3: Apply Composable Filters
        val filtered = uniqueRestaurants.filter { restaurant ->
            matchesSearch(restaurant, normalizedQuery) &&
                    matchesCuisine(restaurant, criteria.selectedCuisine) &&
                    matchesOpenNow(restaurant, criteria.openNowOnly, currentTimeMillis) &&
                    matchesPureVeg(restaurant, criteria.pureVegOnly) &&
                    matchesOffers(restaurant, criteria.offersOnly) &&
                    matchesPriceTier(restaurant, criteria.selectedPriceTier) &&
                    matchesMinRating(restaurant, criteria.minRating) &&
                    matchesDistance(restaurant, criteria.maxDistanceKm, userLocation)
        }

        // Step 4: Apply Sorting
        return when (criteria.sortBy) {
            RestaurantSortOption.RECOMMENDED -> filtered

            RestaurantSortOption.RATING_HIGH_TO_LOW -> {
                filtered.sortedWith(
                    compareByDescending<Restaurant> { it.hasVerifiedRating }
                        .thenByDescending { it.rating ?: 0.0 }
                        .thenByDescending { it.reviewCount }
                )
            }

            RestaurantSortOption.PRICE_LOW_TO_HIGH -> {
                filtered.sortedBy { it.priceForTwo ?: Int.MAX_VALUE }
            }

            RestaurantSortOption.PRICE_HIGH_TO_LOW -> {
                filtered.sortedByDescending { it.priceForTwo ?: 0 }
            }

            RestaurantSortOption.DISTANCE_NEAREST -> {
                filtered.sortedWith(
                    compareBy<Restaurant> {
                        DistanceCalculator.getRestaurantDistanceKm(userLocation, it) ?: Double.MAX_VALUE
                    }
                )
            }
        }
    }

    private fun matchesSearch(restaurant: Restaurant, query: String): Boolean {
        if (query.isBlank()) return true
        val queryTokens = query.split(" ").filter { it.isNotBlank() }

        // All tokens must match some field of the restaurant
        return queryTokens.all { token ->
            restaurant.name.contains(token, ignoreCase = true) ||
                    restaurant.locality.contains(token, ignoreCase = true) ||
                    restaurant.city.contains(token, ignoreCase = true) ||
                    restaurant.address.contains(token, ignoreCase = true) ||
                    restaurant.cuisines.any { it.contains(token, ignoreCase = true) }
        }
    }

    private fun matchesCuisine(restaurant: Restaurant, cuisine: String): Boolean {
        if (cuisine.isBlank() || cuisine.equals("All", ignoreCase = true)) return true
        return restaurant.cuisines.any { it.equals(cuisine, ignoreCase = true) }
    }

    private fun matchesOpenNow(restaurant: Restaurant, openNowOnly: Boolean, currentTimeMillis: Long): Boolean {
        if (!openNowOnly) return true

        // 1. Check businessHours engine
        if (restaurant.businessHours != null) {
            return OperatingHoursEngine.isOpenNow(restaurant.businessHours, restaurant.timezone, currentTimeMillis)
        }

        // 2. Check explicit isOpen flag if businessHours is not configured
        return restaurant.isOpen == true
    }

    private fun matchesPureVeg(restaurant: Restaurant, pureVegOnly: Boolean): Boolean {
        if (!pureVegOnly) return true
        return restaurant.isPureVeg || restaurant.cuisines.any { it.contains("pure veg", ignoreCase = true) }
    }

    private fun matchesOffers(restaurant: Restaurant, offersOnly: Boolean): Boolean {
        if (!offersOnly) return true
        return restaurant.activeOffersCount > 0 || !restaurant.activeOfferBadge.isNullOrBlank()
    }

    private fun matchesPriceTier(restaurant: Restaurant, priceTier: String?): Boolean {
        if (priceTier.isNullOrBlank() || priceTier.equals("All", ignoreCase = true)) return true
        val cost = restaurant.priceForTwo ?: return false
        return when (priceTier) {
            "Under ₹500", "₹" -> cost <= 500
            "₹500 - ₹1000", "₹₹" -> cost in 501..1000
            "Above ₹1000", "₹₹₹" -> cost > 1000
            else -> true
        }
    }

    private fun matchesMinRating(restaurant: Restaurant, minRating: Double?): Boolean {
        if (minRating == null || minRating <= 0.0) return true
        // Only restaurants with a verified rating >= minRating match
        if (!restaurant.hasVerifiedRating) return false
        return (restaurant.rating ?: 0.0) >= minRating
    }

    private fun matchesDistance(restaurant: Restaurant, maxDistanceKm: Double?, userLocation: UserLocation?): Boolean {
        if (maxDistanceKm == null || userLocation == null) return true
        val distance = DistanceCalculator.getRestaurantDistanceKm(userLocation, restaurant) ?: return false
        return distance <= maxDistanceKm
    }
}
