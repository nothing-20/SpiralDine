package com.spiralworld.spiraldine.data.repository

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.spiralworld.spiraldine.BuildConfig

data class ValidatedCustomerFirebaseConfig(
    val appEnv: String,
    val apiKey: String,
    val projectId: String,
    val applicationId: String,
    val storageBucket: String,
    val gcmSenderId: String
)

object FirebaseConfig {
    private const val PRODUCTION_PROJECT_ID = "spiral-restaurant-saas-v1"

    val APP_ENV: String get() = BuildConfig.APP_ENV
    val IS_CONFIGURED: Boolean get() = BuildConfig.FIREBASE_CONFIGURED
    val API_KEY: String get() = BuildConfig.FIREBASE_API_KEY
    val PROJECT_ID: String get() = BuildConfig.FIREBASE_PROJECT_ID
    val APPLICATION_ID: String get() = BuildConfig.FIREBASE_APPLICATION_ID
    val STORAGE_BUCKET: String get() = BuildConfig.FIREBASE_STORAGE_BUCKET
    val GCM_SENDER_ID: String get() = BuildConfig.FIREBASE_GCM_SENDER_ID

    private fun isInvalidOrPlaceholder(value: String): Boolean {
        val trimmed = value.trim()
        if (trimmed.isEmpty()) return true
        val lower = trimmed.lowercase()
        return lower.startsWith("your_") ||
            lower.startsWith("<") ||
            lower.startsWith("placeholder") ||
            lower.startsWith("changeme") ||
            lower.startsWith("replace")
    }

    internal fun resolveValidatedConfig(
        appEnv: String = APP_ENV,
        configured: Boolean = IS_CONFIGURED,
        apiKey: String = API_KEY,
        projectId: String = PROJECT_ID,
        applicationId: String = APPLICATION_ID,
        storageBucket: String = STORAGE_BUCKET,
        gcmSenderId: String = GCM_SENDER_ID
    ): ValidatedCustomerFirebaseConfig {
        if (
            !configured ||
            isInvalidOrPlaceholder(apiKey) ||
            isInvalidOrPlaceholder(projectId) ||
            isInvalidOrPlaceholder(applicationId) ||
            isInvalidOrPlaceholder(storageBucket)
        ) {
            throw IllegalStateException(
                "[Customer FirebaseConfig] Firebase is not configured for flavor '$appEnv'. " +
                    "Provide android/config/firebase-$appEnv.properties or src/$appEnv/google-services.json."
            )
        }

        if (
            !appEnv.equals("prod", ignoreCase = true) &&
            (projectId.trim().equals(PRODUCTION_PROJECT_ID, ignoreCase = true) ||
                storageBucket.lowercase().contains(PRODUCTION_PROJECT_ID))
        ) {
            throw IllegalStateException(
                "[Customer FirebaseConfig] Environment '$appEnv' refuses to connect to production Firebase project '$PRODUCTION_PROJECT_ID'."
            )
        }

        return ValidatedCustomerFirebaseConfig(
            appEnv = appEnv.trim(),
            apiKey = apiKey.trim(),
            projectId = projectId.trim(),
            applicationId = applicationId.trim(),
            storageBucket = storageBucket.trim(),
            gcmSenderId = gcmSenderId.trim()
        )
    }

    @Synchronized
    fun initialize(context: Context): FirebaseApp {
        val validated = resolveValidatedConfig()

        try {
            val existing = FirebaseApp.getApps(context).firstOrNull()
            if (existing != null) {
                return existing
            }
        } catch (_: Exception) {}

        return try {
            FirebaseApp.getInstance()
        } catch (_: Exception) {
            try {
                val builder = FirebaseOptions.Builder()
                    .setApiKey(validated.apiKey)
                    .setProjectId(validated.projectId)
                    .setApplicationId(validated.applicationId)
                    .setStorageBucket(validated.storageBucket)
                if (validated.gcmSenderId.isNotEmpty()) {
                    builder.setGcmSenderId(validated.gcmSenderId)
                }
                FirebaseApp.initializeApp(context.applicationContext, builder.build())
            } catch (e: Exception) {
                Log.w("FirebaseConfig", "Concurrent or secondary initialization fallback: ${e.message}")
                try {
                    FirebaseApp.getInstance()
                } catch (fallbackEx: Exception) {
                    throw IllegalStateException("Failed to initialize FirebaseApp for SpiralDine", fallbackEx)
                }
            }
        }
    }

    val auth: FirebaseAuth
        get() = try {
            FirebaseAuth.getInstance()
        } catch (_: Exception) {
            FirebaseAuth.getInstance(FirebaseApp.getInstance())
        }

    val firestore: FirebaseFirestore
        get() = try {
            FirebaseFirestore.getInstance()
        } catch (_: Exception) {
            FirebaseFirestore.getInstance(FirebaseApp.getInstance())
        }
}
