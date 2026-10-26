package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.UserLocation
import com.spiralworld.spiraldine.data.repository.DistanceCalculator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class DistanceCalculatorTest {

    @Test
    fun testHaversineDistance_betweenValidHyderabadLocations() {
        // RTC X Roads (17.4065, 78.4983) to Secunderabad MG Road (17.4411, 78.4870)
        // Distance is ~4.0 km
        val distance = DistanceCalculator.calculateDistanceKm(
            lat1 = 17.4065,
            lon1 = 78.4983,
            lat2 = 17.4411,
            lon2 = 78.4870
        )

        assertNotNull(distance)
        assertEquals(4.0, distance!!, 0.5) // Within 0.5km tolerance
    }

    @Test
    fun testDistanceFormatting_underOneKilometer_returnsMeters() {
        val formatted = DistanceCalculator.formatDistance(0.45)
        assertEquals("450 m", formatted)
    }

    @Test
    fun testDistanceFormatting_overOneKilometer_returnsKilometers() {
        val formatted = DistanceCalculator.formatDistance(3.72)
        assertEquals("3.7 km", formatted)
    }

    @Test
    fun testNullOrInvalidCoordinates_returnsNull() {
        // Null inputs
        assertNull(DistanceCalculator.calculateDistanceKm(null, 78.4, 17.4, 78.4))
        assertNull(DistanceCalculator.calculateDistanceKm(17.4, null, 17.4, 78.4))
        assertNull(DistanceCalculator.calculateDistanceKm(17.4, 78.4, null, 78.4))
        assertNull(DistanceCalculator.calculateDistanceKm(17.4, 78.4, 17.4, null))

        // Out of geographical bounds
        assertNull(DistanceCalculator.calculateDistanceKm(95.0, 78.4, 17.4, 78.4))
        assertNull(DistanceCalculator.calculateDistanceKm(17.4, 190.0, 17.4, 78.4))

        // Null Island (0,0)
        assertNull(DistanceCalculator.calculateDistanceKm(0.0, 0.0, 17.4, 78.4))
    }

    @Test
    fun testRestaurantDistance_withUserLocation() {
        val userLocation = UserLocation(latitude = 17.4065, longitude = 78.4983)
        val restaurant = Restaurant(
            id = "test-rest",
            name = "Test",
            latitude = 17.4160,
            longitude = 78.4983
        )

        val distance = DistanceCalculator.getRestaurantDistanceKm(userLocation, restaurant)
        assertNotNull(distance)
        assertEquals(1.1, distance!!, 0.2)
    }

    @Test
    fun testRestaurantDistance_whenUserLocationMissing_returnsNull() {
        val restaurant = Restaurant(id = "test", latitude = 17.4, longitude = 78.4)
        val distance = DistanceCalculator.getRestaurantDistanceKm(null, restaurant)
        assertNull(distance)
        assertNull(DistanceCalculator.formatDistance(distance))
    }
}
