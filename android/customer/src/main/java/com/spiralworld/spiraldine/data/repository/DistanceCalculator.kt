package com.spiralworld.spiraldine.data.repository

import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.UserLocation
import java.util.Locale
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

object DistanceCalculator {

    private const val EARTH_RADIUS_KM = 6371.0

    /**
     * Calculates Haversine distance in kilometers between two GPS coordinates.
     * Returns null if any coordinate is missing or outside valid geographical ranges.
     */
    fun calculateDistanceKm(
        lat1: Double?,
        lon1: Double?,
        lat2: Double?,
        lon2: Double?
    ): Double? {
        if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
        if (lat1 !in -90.0..90.0 || lat2 !in -90.0..90.0) return null
        if (lon1 !in -180.0..180.0 || lon2 !in -180.0..180.0) return null

        // 0,0 is Null Island (often empty default in bad data)
        if (lat1 == 0.0 && lon1 == 0.0) return null
        if (lat2 == 0.0 && lon2 == 0.0) return null

        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)

        val rLat1 = Math.toRadians(lat1)
        val rLat2 = Math.toRadians(lat2)

        val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(rLat1) * cos(rLat2) *
                sin(dLon / 2) * sin(dLon / 2)

        val c = 2 * atan2(sqrt(a), sqrt(1 - a))
        val distance = EARTH_RADIUS_KM * c

        // Round to 1 decimal place
        return (distance * 10.0).roundToInt() / 10.0
    }

    /**
     * Calculates distance between a user location and a restaurant.
     */
    fun getRestaurantDistanceKm(
        userLocation: UserLocation?,
        restaurant: Restaurant
    ): Double? {
        if (userLocation == null) return null
        return calculateDistanceKm(
            lat1 = userLocation.latitude,
            lon1 = userLocation.longitude,
            lat2 = restaurant.latitude,
            lon2 = restaurant.longitude
        )
    }

    /**
     * Format distance for customer display.
     * e.g. "450 m" for under 1km, "2.4 km" for >= 1km.
     * Returns null if distance is null.
     */
    fun formatDistance(distanceKm: Double?): String? {
        if (distanceKm == null || distanceKm < 0.0) return null
        return if (distanceKm < 1.0) {
            val meters = (distanceKm * 1000).roundToInt()
            "$meters m"
        } else {
            String.format(Locale.US, "%.1f km", distanceKm)
        }
    }
}
