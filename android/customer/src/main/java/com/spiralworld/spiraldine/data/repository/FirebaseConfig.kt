package com.spiralworld.spiraldine.data.repository

import android.content.Context
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

object FirebaseConfig {
    const val API_KEY = "AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg"
    const val PROJECT_ID = "spiral-restaurant-saas-v1"
    const val APPLICATION_ID = "com.spiralworld.spiraldine"
    const val STORAGE_BUCKET = "spiral-restaurant-saas-v1.firebasestorage.app"
    const val GCM_SENDER_ID = "917630391162"

    @Synchronized
    fun initialize(context: Context): FirebaseApp {
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
                val options = FirebaseOptions.Builder()
                    .setApiKey(API_KEY)
                    .setProjectId(PROJECT_ID)
                    .setApplicationId(APPLICATION_ID)
                    .setStorageBucket(STORAGE_BUCKET)
                    .setGcmSenderId(GCM_SENDER_ID)
                    .build()
                FirebaseApp.initializeApp(context.applicationContext, options)
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
