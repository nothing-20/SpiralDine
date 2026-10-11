package com.spiraldine.printbridge.auth

import android.content.Context
import android.content.SharedPreferences

/**
 * Persists authorized staff authentication and restaurant tenant association on the device.
 */
open class AuthStorage(context: Context? = null) {

    private val prefs: SharedPreferences? = context?.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
    )
    private val inMemoryMap = mutableMapOf<String, Any>()

    companion object {
        private const val PREFS_NAME = "spiraldine_print_bridge_auth"
        private const val KEY_UID = "auth_uid"
        private const val KEY_EMAIL = "auth_email"
        private const val KEY_TENANT_ID = "auth_tenant_id"
        private const val KEY_ROLE = "auth_role"
        private const val KEY_RESTAURANT_NAME = "auth_restaurant_name"
        private const val KEY_AUTO_START_ENABLED = "auth_auto_start_enabled"
    }

    open fun saveSession(profile: StaffProfile) {
        if (prefs != null) {
            prefs.edit()
                .putString(KEY_UID, profile.uid)
                .putString(KEY_EMAIL, profile.email)
                .putString(KEY_TENANT_ID, profile.tenantId)
                .putString(KEY_ROLE, profile.role)
                .putString(KEY_RESTAURANT_NAME, profile.restaurantName)
                .putBoolean(KEY_AUTO_START_ENABLED, true)
                .apply()
        } else {
            inMemoryMap[KEY_UID] = profile.uid
            inMemoryMap[KEY_EMAIL] = profile.email
            inMemoryMap[KEY_TENANT_ID] = profile.tenantId
            inMemoryMap[KEY_ROLE] = profile.role
            inMemoryMap[KEY_RESTAURANT_NAME] = profile.restaurantName
            inMemoryMap[KEY_AUTO_START_ENABLED] = true
        }
    }

    open fun getSession(): StaffProfile? {
        val uid = (prefs?.getString(KEY_UID, null) ?: inMemoryMap[KEY_UID] as? String) ?: return null
        val email = prefs?.getString(KEY_EMAIL, "") ?: inMemoryMap[KEY_EMAIL] as? String ?: ""
        val tenantId = (prefs?.getString(KEY_TENANT_ID, null) ?: inMemoryMap[KEY_TENANT_ID] as? String) ?: return null
        val role = prefs?.getString(KEY_ROLE, "kitchen") ?: inMemoryMap[KEY_ROLE] as? String ?: "kitchen"
        val restaurantName = prefs?.getString(KEY_RESTAURANT_NAME, "SpiralDine Restaurant")
            ?: inMemoryMap[KEY_RESTAURANT_NAME] as? String
            ?: "SpiralDine Restaurant"

        return StaffProfile(
            uid = uid,
            email = email,
            tenantId = tenantId,
            role = role,
            restaurantName = restaurantName
        )
    }

    open fun isAutoStartEnabled(): Boolean {
        val enabled = prefs?.getBoolean(KEY_AUTO_START_ENABLED, true)
            ?: inMemoryMap[KEY_AUTO_START_ENABLED] as? Boolean
            ?: true
        return enabled && getSession() != null
    }

    open fun setAutoStartEnabled(enabled: Boolean) {
        if (prefs != null) {
            prefs.edit().putBoolean(KEY_AUTO_START_ENABLED, enabled).apply()
        } else {
            inMemoryMap[KEY_AUTO_START_ENABLED] = enabled
        }
    }

    open fun clearSession() {
        if (prefs != null) {
            prefs.edit().clear().apply()
        } else {
            inMemoryMap.clear()
        }
    }
}
