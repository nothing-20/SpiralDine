package com.spiralworld.spiraldine.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.spiralworld.spiraldine.data.model.PushNotificationPayload
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

object FcmNotificationBus {
    private val _notifications = MutableSharedFlow<PushNotificationPayload>(extraBufferCapacity = 10)
    val notifications: SharedFlow<PushNotificationPayload> = _notifications.asSharedFlow()

    fun postNotification(payload: PushNotificationPayload) {
        _notifications.tryEmit(payload)
    }
}

object NotificationDeduplicator {
    private val seenEvents = mutableMapOf<String, Long>()
    const val DEDUPLICATION_WINDOW_MS = 10 * 60 * 1000L // 10 minutes

    fun isDuplicate(
        orderId: String,
        status: String,
        currentTimeMs: Long = System.currentTimeMillis()
    ): Boolean {
        if (orderId.isBlank() || status.isBlank()) return false
        val key = "${orderId}_${status.uppercase()}"
        val lastSeen = seenEvents[key] ?: 0L
        if (lastSeen > 0 && (currentTimeMs - lastSeen) < DEDUPLICATION_WINDOW_MS) {
            return true
        }
        seenEvents[key] = currentTimeMs
        return false
    }

    fun clear() {
        seenEvents.clear()
    }
}

class FcmTokenManager(
    private val context: Context,
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    constructor(context: Context, firestore: FirebaseFirestore) : this(context, { firestore })
    private val prefs: SharedPreferences =
        context.getSharedPreferences("spiraldine_fcm_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_FCM_TOKEN = "fcm_token"
    }

    fun getLocalToken(): String? {
        return prefs.getString(KEY_FCM_TOKEN, null)
    }

    fun saveLocalToken(token: String) {
        prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
    }

    fun fetchAndRegisterToken(
        userId: String? = null,
        tenantId: String? = null,
        sessionId: String? = null
    ) {
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful && !task.result.isNullOrBlank()) {
                    val token = task.result
                    saveLocalToken(token)
                    CoroutineScope(Dispatchers.IO).launch {
                        syncTokenToBackend(token, userId, tenantId, sessionId)
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.w("FcmTokenManager", "FCM token registration skipped or unavailable: ${e.message}")
        }
    }

    suspend fun syncTokenToBackend(
        token: String,
        userId: String? = null,
        tenantId: String? = null,
        sessionId: String? = null
    ) {
        try {
            val tokenData = mapOf(
                "token" to token,
                "platform" to "android",
                "appId" to "com.spiralworld.spiraldine",
                "updatedAt" to System.currentTimeMillis()
            )

            if (!userId.isNullOrBlank()) {
                firestore.collection("customers").document(userId)
                    .collection("fcmTokens").document(token)
                    .set(tokenData, SetOptions.merge())
                    .await()
            }

            if (!tenantId.isNullOrBlank() && !sessionId.isNullOrBlank()) {
                firestore.collection("restaurants").document(tenantId)
                    .collection("diningSessions").document(sessionId)
                    .set(mapOf("customerFcmToken" to token), SetOptions.merge())
                    .await()
            }
        } catch (_: Exception) {}
    }

    fun isDuplicateNotification(orderId: String, status: String): Boolean {
        return NotificationDeduplicator.isDuplicate(orderId, status)
    }

    suspend fun invalidateToken(userId: String? = null) {
        val currentToken = getLocalToken()
        if (!currentToken.isNullOrBlank() && !userId.isNullOrBlank()) {
            try {
                firestore.collection("customers").document(userId)
                    .collection("fcmTokens").document(currentToken)
                    .delete()
                    .await()
            } catch (_: Exception) {}
        }
        prefs.edit().remove(KEY_FCM_TOKEN).apply()
    }
}
