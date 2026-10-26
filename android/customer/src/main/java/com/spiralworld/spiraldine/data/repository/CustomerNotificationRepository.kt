package com.spiralworld.spiraldine.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.spiralworld.spiraldine.data.model.NotificationRecord
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class CustomerNotificationRepository(
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    // In-memory cache of live received notifications
    private val localNotifications = mutableListOf<NotificationRecord>()

    init {
        // Automatically capture foreground push events into local notifications list
        CoroutineScope(Dispatchers.IO).launch {
            try {
                FcmNotificationBus.notifications.collect { payload ->
                val record = NotificationRecord(
                    id = "local-${payload.timestamp}",
                    title = payload.title.ifBlank { "Order Update" },
                    body = payload.body.ifBlank { "Status: ${payload.status}" },
                    category = "Order",
                    timestamp = payload.timestamp,
                    createdAt = SimpleDateFormat("HH:mm", Locale.US).format(Date(payload.timestamp)),
                    read = false,
                    orderId = payload.orderId,
                    tenantId = payload.tenantId
                )
                synchronized(localNotifications) {
                    if (localNotifications.none { it.orderId == payload.orderId && it.body == record.body }) {
                        localNotifications.add(0, record)
                    }
                }
            }
        } catch (e: Exception) {
        }
    }
}

    /**
     * Stream notifications for the active authenticated customer.
     * Combines authoritative Firestore notifications with foreground push alerts.
     */
    fun getNotifications(customerId: String): Flow<List<NotificationRecord>> = callbackFlow {
        if (customerId.isBlank()) {
            synchronized(localNotifications) {
                trySend(localNotifications.toList())
            }
            close()
            return@callbackFlow
        }

        val ref = firestore.collection("customers")
            .document(customerId)
            .collection("notifications")
            .orderBy("timestamp", Query.Direction.DESCENDING)
            .limit(50)

        val listener = ref.addSnapshotListener { snapshot, error ->
            val firestoreList = mutableListOf<NotificationRecord>()
            if (error == null && snapshot != null && !snapshot.isEmpty) {
                for (doc in snapshot.documents) {
                    val data = doc.data ?: continue
                    val ts = when (val t = data["timestamp"]) {
                        is Number -> t.toLong()
                        is com.google.firebase.Timestamp -> t.toDate().time
                        else -> System.currentTimeMillis()
                    }
                    val formattedTime = try {
                        SimpleDateFormat("d MMM, HH:mm", Locale.US).format(Date(ts))
                    } catch (e: Exception) {
                        data["createdAt"]?.toString() ?: "Recent"
                    }

                    firestoreList.add(
                        NotificationRecord(
                            id = doc.id,
                            title = data["title"]?.toString() ?: "Alert",
                            body = data["body"]?.toString() ?: data["desc"]?.toString() ?: data["message"]?.toString() ?: "",
                            category = data["category"]?.toString() ?: data["type"]?.toString() ?: "Order",
                            timestamp = ts,
                            createdAt = formattedTime,
                            read = data["read"] as? Boolean ?: false,
                            orderId = data["orderId"]?.toString() ?: "",
                            tenantId = data["tenantId"]?.toString() ?: "",
                            bookingId = data["bookingId"]?.toString() ?: ""
                        )
                    )
                }
            }

            // Combine with foreground alerts that aren't yet in Firestore
            val combined = synchronized(localNotifications) {
                val existingIds = firestoreList.map { it.id }.toSet()
                val uniqueLocals = localNotifications.filter { it.id !in existingIds }
                (firestoreList + uniqueLocals).sortedByDescending { it.timestamp }
            }

            trySend(combined)
        }

        awaitClose { listener.remove() }
    }

    /**
     * Streams the real-time unread notification count for the badge.
     */
    fun getUnreadCount(customerId: String): Flow<Int> {
        return getNotifications(customerId).map { list ->
            list.count { !it.read }
        }
    }

    /**
     * Mark a specific notification as read.
     */
    suspend fun markAsRead(customerId: String, notificationId: String) {
        synchronized(localNotifications) {
            val idx = localNotifications.indexOfFirst { it.id == notificationId }
            if (idx != -1) {
                localNotifications[idx] = localNotifications[idx].copy(read = true)
            }
        }

        if (customerId.isNotBlank() && !notificationId.startsWith("local-")) {
            try {
                firestore.collection("customers")
                    .document(customerId)
                    .collection("notifications")
                    .document(notificationId)
                    .update("read", true)
                    .await()
            } catch (e: Exception) {}
        }
    }

    /**
     * Mark all notifications as read.
     */
    suspend fun markAllAsRead(customerId: String) {
        synchronized(localNotifications) {
            for (i in localNotifications.indices) {
                localNotifications[i] = localNotifications[i].copy(read = true)
            }
        }

        if (customerId.isNotBlank()) {
            try {
                val snap = firestore.collection("customers")
                    .document(customerId)
                    .collection("notifications")
                    .whereEqualTo("read", false)
                    .get()
                    .await()

                val batch = firestore.batch()
                for (d in snap.documents) {
                    batch.update(d.reference, "read", true)
                }
                batch.commit().await()
            } catch (e: Exception) {}
        }
    }

    fun clearCache() {
        synchronized(localNotifications) {
            localNotifications.clear()
        }
    }
}
