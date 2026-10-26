package com.spiralworld.spiraldine.data.repository

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.core.content.ContextCompat
import com.spiralworld.spiraldine.data.model.UserLocation

object LocationHelper {

    /**
     * Checks if either FINE or COARSE location permission is granted.
     */
    fun hasLocationPermission(context: Context): Boolean {
        val fineGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val coarseGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        return fineGranted || coarseGranted
    }

    /**
     * Retrieves the last known location using native LocationManager.
     * Uses zero paid APIs, requires zero external services, and does not run background tracking.
     */
    @SuppressLint("MissingPermission")
    fun getLastKnownLocation(context: Context): UserLocation? {
        if (!hasLocationPermission(context)) return null

        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return null

        var bestLocation: Location? = null

        val providers = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        )

        for (provider in providers) {
            try {
                if (locationManager.isProviderEnabled(provider)) {
                    val loc = locationManager.getLastKnownLocation(provider)
                    if (loc != null) {
                        if (bestLocation == null || loc.accuracy < bestLocation.accuracy) {
                            bestLocation = loc
                        }
                    }
                }
            } catch (_: SecurityException) {
                // Safely ignored if permission was revoked
            } catch (_: Exception) {
                // Provider disabled or unavailable
            }
        }

        val location = bestLocation ?: return null
        val locality = try {
            if (android.location.Geocoder.isPresent()) {
                val geocoder = android.location.Geocoder(context, java.util.Locale.getDefault())
                @Suppress("DEPRECATION")
                val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
                val addr = addresses?.firstOrNull()
                when {
                    !addr?.subLocality.isNullOrBlank() && !addr?.locality.isNullOrBlank() -> "${addr.subLocality}, ${addr.locality}"
                    !addr?.locality.isNullOrBlank() && !addr?.adminArea.isNullOrBlank() -> "${addr.locality}, ${addr.adminArea}"
                    !addr?.locality.isNullOrBlank() -> addr.locality
                    else -> null
                }
            } else null
        } catch (_: Exception) {
            null
        }

        return UserLocation(
            latitude = location.latitude,
            longitude = location.longitude,
            localityName = locality
        )
    }

    private const val PREFS_NAME = "spiraldine_location_prefs"
    private const val KEY_LAT = "selected_lat"
    private const val KEY_LNG = "selected_lng"
    private const val KEY_LOCALITY = "selected_locality"

    fun persistUserLocation(context: Context, location: UserLocation) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putFloat(KEY_LAT, location.latitude.toFloat())
            .putFloat(KEY_LNG, location.longitude.toFloat())
            .putString(KEY_LOCALITY, location.localityName)
            .apply()
    }

    fun getPersistedUserLocation(context: Context): UserLocation? {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (!prefs.contains(KEY_LOCALITY)) return null
        val lat = prefs.getFloat(KEY_LAT, 0f).toDouble()
        val lng = prefs.getFloat(KEY_LNG, 0f).toDouble()
        val locality = prefs.getString(KEY_LOCALITY, null) ?: return null
        return UserLocation(latitude = lat, longitude = lng, localityName = locality)
    }
}
