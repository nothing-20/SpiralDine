package com.spiralworld.spiraldine.data.repository

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.spiralworld.spiraldine.MainActivity
import com.spiralworld.spiraldine.data.model.PushNotificationPayload
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SpiralDineMessagingService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ID_ORDERS = "spiraldine_orders_channel"
        const val CHANNEL_NAME_ORDERS = "Order Status Updates"
        const val EXTRA_ORDER_ID = "extra_order_id"
        const val EXTRA_TENANT_ID = "extra_tenant_id"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val tokenManager = FcmTokenManager(applicationContext)
        tokenManager.saveLocalToken(token)
        CoroutineScope(Dispatchers.IO).launch {
            tokenManager.syncTokenToBackend(token)
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        val orderId = data["orderId"] ?: data["id"] ?: ""
        val tenantId = data["tenantId"] ?: ""
        val status = data["status"] ?: "UPDATED"
        val tableNumber = data["tableNumber"] ?: ""

        val title = remoteMessage.notification?.title
            ?: data["title"]
            ?: getDisplayTitleForStatus(status, tableNumber)

        val body = remoteMessage.notification?.body
            ?: data["body"]
            ?: getDisplayBodyForStatus(status, orderId)

        val payload = PushNotificationPayload(
            orderId = orderId,
            tenantId = tenantId,
            status = status,
            title = title,
            body = body,
            tableNumber = tableNumber,
            timestamp = System.currentTimeMillis()
        )

        // Prevent duplicate alerts for identical status transition
        val tokenManager = FcmTokenManager(applicationContext)
        if (tokenManager.isDuplicateNotification(orderId, status)) {
            return
        }

        // Post to in-app event bus for active foreground UI
        FcmNotificationBus.postNotification(payload)

        // Show native system heads-up notification
        showSystemNotification(payload)
    }

    private fun showSystemNotification(payload: PushNotificationPayload) {
        val notificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create channel on Android O+ (API 26+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID_ORDERS,
                CHANNEL_NAME_ORDERS,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Live updates on your restaurant orders and kitchen progress"
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Tap action deep-linking to MainActivity
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_ORDER_ID, payload.orderId)
            putExtra(EXTRA_TENANT_ID, payload.tenantId)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            payload.orderId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID_ORDERS)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(payload.title)
            .setContentText(payload.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(payload.body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val notificationId = if (payload.orderId.isNotBlank()) payload.orderId.hashCode() else System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, notification)
    }

    private fun getDisplayTitleForStatus(status: String, tableNumber: String): String {
        val tableSuffix = if (tableNumber.isNotBlank()) " (Table $tableNumber)" else ""
        return when (status.uppercase()) {
            "CONFIRMED" -> "Order Confirmed$tableSuffix"
            "PREPARING", "IN_KITCHEN" -> "Kitchen Preparing Your Dishes$tableSuffix"
            "READY" -> "Order Ready$tableSuffix"
            "SERVED", "COMPLETED" -> "Dishes Served! Bon Appetit$tableSuffix"
            "CANCELLED" -> "Order Cancelled$tableSuffix"
            else -> "Spiral Dine Order Update$tableSuffix"
        }
    }

    private fun getDisplayBodyForStatus(status: String, orderId: String): String {
        val orderSuffix = if (orderId.isNotBlank()) " Order #${orderId.takeLast(6).uppercase()}." else ""
        return when (status.uppercase()) {
            "CONFIRMED" -> "The restaurant has accepted your order.$orderSuffix"
            "PREPARING", "IN_KITCHEN" -> "The chef has started preparing your food.$orderSuffix"
            "READY" -> "Your dishes are hot and plated!$orderSuffix"
            "SERVED", "COMPLETED" -> "Thank you for dining with us! Hope you enjoyed the meal.$orderSuffix"
            "CANCELLED" -> "Your order was cancelled by the kitchen.$orderSuffix"
            else -> "Your order status was updated to $status.$orderSuffix"
        }
    }
}
