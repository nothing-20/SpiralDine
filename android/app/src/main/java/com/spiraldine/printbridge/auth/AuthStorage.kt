package com.spiraldine.printbridge.auth

import android.content.Context
import android.content.SharedPreferences

/**
 * Persists authorized staff authentication and restaurant tenant association on the device.
 */
class AuthStorage(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
    )

    companion object {
        private const val PREFS_NAME = "spiraldine_print_bridge_auth"
        private const val KEY_UID = "auth_uid"
        private const val KEY_EMAIL = "auth_email"
        private const val KEY_TENANT_ID = "auth_tenant_id"
        private const val KEY_ROLE = "auth_role"
        private const val KEY_RESTAURANT_NAME = "auth_restaurant_name"
        private const val KEY_AUTO_START_ENABLED = "auth_auto_start_enabled"
    }

    fun saveSession(profile: StaffProfile) {
        prefs.edit()
            .putString(KEY_UID, profile.uid)
            .putString(KEY_EMAIL, profile.email)
            .putString(KEY_TENANT_ID, profile.tenantId)
            .putString(KEY_ROLE, profile.role)
            .putString(KEY_RESTAURANT_NAME, profile.restaurantName)
            .putBoolean(KEY_AUTO_START_ENABLED, true)
            .apply()
    }

    fun getSession(): StaffProfile? {
        val uid = prefs.getString(KEY_UID, null) ?: return null
        val email = prefs.getString(KEY_EMAIL, "") ?: ""
        val tenantId = prefs.getString(KEY_TENANT_ID, null) ?: return null
        val role = prefs.getString(KEY_ROLE, "kitchen") ?: "kitchen"
        val restaurantName = prefs.getString(KEY_RESTAURANT_NAME, "SpiralDine Restaurant") ?: "SpiralDine Restaurant"

        return StaffProfile(
            uid = uid,
            email = email,
            tenantId = tenantId,
            role = role,
            restaurantName = restaurantName
        )
    }

    fun isAutoStartEnabled(): Boolean {
        return prefs.getBoolean(KEY_AUTO_START_ENABLED, true) && getSession() != null
    }

    fun setAutoStartEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_AUTO_START_ENABLED, enabled).apply()
    }

    fun clearSession() {
        prefs.edit().clear().apply()
    }
}
