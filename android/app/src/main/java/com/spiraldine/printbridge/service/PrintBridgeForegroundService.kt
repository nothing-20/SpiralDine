package com.spiraldine.printbridge.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.firebase.firestore.FirebaseFirestore
import com.spiraldine.printbridge.MainActivity
import com.spiraldine.printbridge.R
import com.spiraldine.printbridge.auth.AuthStorage
import com.spiraldine.printbridge.auth.FirebaseAuthManager
import com.spiraldine.printbridge.data.PrintJobRepository
import com.spiraldine.printbridge.data.local.PrintBridgeDatabase
import com.spiraldine.printbridge.model.ThermalPaperWidth
import com.spiraldine.printbridge.queue.PrintQueueProcessor
import com.spiraldine.printbridge.queue.QueueProcessResult
import com.spiraldine.printbridge.sync.KotFirestoreListener
import com.spiraldine.printbridge.transport.BluetoothTransport
import com.spiraldine.printbridge.transport.NetworkTransport
import com.spiraldine.printbridge.transport.PrinterTransport
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Android Foreground Service managing 24/7 autonomous KOT printing.
 *
 * Requirements addressed:
 * - Persistent ongoing notification with live status
 * - Foreground service type 'connectedDevice' for Android 14+
 * - Safe lifecycle handling and duplicate prevention
 * - Continuous queue processing with printer transport integration
 * - Synchronizes physical print status back to Firestore
 * - Safe resource cleanup upon stopping
 */
class PrintBridgeForegroundService : Service() {

    companion object {
        const val CHANNEL_ID = "spiraldine_print_bridge_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.spiraldine.printbridge.action.START"
        const val ACTION_STOP = "com.spiraldine.printbridge.action.STOP"

        @Volatile
        var isServiceRunning: Boolean = false
            private set

        fun start(context: Context) {
            val intent = Intent(context, PrintBridgeForegroundService::class.java).apply {
                action = ACTION_START
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, PrintBridgeForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private val serviceScope = CoroutineScope(Dispatchers.IO + Job())
    private var queueJob: Job? = null

    private lateinit var authStorage: AuthStorage
    private lateinit var printJobRepository: PrintJobRepository
    private lateinit var queueProcessor: PrintQueueProcessor
    private var firestoreListener: KotFirestoreListener? = null

    override fun onCreate() {
        super.onCreate()
        FirebaseAuthManager.initializeFirebase(this)
        authStorage = AuthStorage(this)
        val database = PrintBridgeDatabase.getInstance(this)
        printJobRepository = PrintJobRepository(database.printJobDao())
        queueProcessor = PrintQueueProcessor(printJobRepository)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopBridge()
            stopSelf()
            return START_NOT_STICKY
        }

        // Start foreground immediately to satisfy Android background start requirements
        val session = authStorage.getSession()
        val initialText = if (session != null) {
            "Active: ${session.restaurantName} (Listening for KOTs)"
        } else {
            "Device not paired to a restaurant workspace"
        }
        startForegroundServiceWithNotification(initialText)

        if (!isServiceRunning) {
            isServiceRunning = true
            startBridge()
        }

        return START_STICKY
    }

    private fun startBridge() {
        val session = authStorage.getSession() ?: run {
            updateNotification("Device not paired. Open app to sign in.")
            return
        }

        // 1. Start Firestore Real-Time KOT Listener
        firestoreListener?.stop()
        firestoreListener = KotFirestoreListener(
            tenantId = session.tenantId,
            printJobRepository = printJobRepository,
            scope = serviceScope,
            onSyncStateChanged = { state ->
                when (state) {
                    is KotFirestoreListener.SyncState.Listening -> {
                        updateNotification("Connected: ${session.restaurantName} (Listening)")
                    }
                    is KotFirestoreListener.SyncState.Error -> {
                        updateNotification("Connection Issue: ${state.message.take(40)}")
                    }
                    KotFirestoreListener.SyncState.Stopped -> {}
                }
            }
        ).also { it.start() }

        // 2. Start Background Autonomous Queue Dispatcher Loop
        queueJob?.cancel()
        queueJob = serviceScope.launch {
            while (isActive) {
                try {
                    val activeTransport = resolveConfiguredTransport()
                    if (activeTransport == null) {
                        // Printer not configured yet; wait before checking again
                        delay(3000)
                        continue
                    }

                    val pendingCount = printJobRepository.getPendingCount()
                    if (pendingCount > 0) {
                        val processResult = queueProcessor.processNextJob(
                            transport = activeTransport,
                            paperWidth = ThermalPaperWidth.WIDTH_80MM
                        )

                        when (processResult) {
                            is QueueProcessResult.Success -> {
                                updateNotification("Printed ${processResult.jobId} (${processResult.bytesWritten} B)")
                                syncPrintSuccessToFirestore(session.tenantId, processResult.jobId)
                            }
                            is QueueProcessResult.Failed -> {
                                updateNotification("Print Failure: ${processResult.reason.take(30)}")
                            }
                            is QueueProcessResult.Interrupted -> {
                                updateNotification("Interrupted Write: Check Printer")
                            }
                            is QueueProcessResult.Retrying -> {
                                updateNotification("Retrying: ${processResult.reason.take(25)}")
                                delay(3000)
                            }
                            else -> {}
                        }
                    } else {
                        // Queue is idle
                        delay(2000)
                    }
                } catch (e: Exception) {
                    delay(3000)
                }
            }
        }
    }

    private fun resolveConfiguredTransport(): PrinterTransport? {
        val prefs = getSharedPreferences("spiraldine_printer_config", Context.MODE_PRIVATE)
        val connType = prefs.getString("connection_type", "Bluetooth") ?: "Bluetooth"

        return if (connType == "Bluetooth") {
            val btAddress = prefs.getString("bt_address", null) ?: return null
            val btName = prefs.getString("bt_name", "Bluetooth Printer") ?: "Bluetooth Printer"
            BluetoothTransport(
                deviceAddress = btAddress,
                deviceName = btName,
                context = this
            )
        } else {
            val host = prefs.getString("net_host", null) ?: return null
            val port = prefs.getInt("net_port", 9100)
            NetworkTransport(host = host, port = port)
        }
    }

    private fun syncPrintSuccessToFirestore(tenantId: String, jobId: String) {
        serviceScope.launch {
            try {
                // Canonical ticketId extracted from jobId ("PJ-KOT-XXXX")
                val ticketId = jobId.removePrefix("PJ-").substringBefore("-REPRINT")
                val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(Date())

                val docRef = FirebaseFirestore.getInstance()
                    .collection("restaurants")
                    .document(tenantId)
                    .collection("kitchenTickets")
                    .document(ticketId)

                docRef.update(
                    mapOf(
                        "printStatus" to "printed",
                        "printedAt" to nowIso,
                        "updatedAt" to nowIso
                    )
                )
            } catch (_: Exception) {
                // Non-blocking firestore status sync update
            }
        }
    }

    private fun stopBridge() {
        isServiceRunning = false
        firestoreListener?.stop()
        firestoreListener = null
        queueJob?.cancel()
        serviceScope.cancel()
    }

    override fun onDestroy() {
        stopBridge()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startForegroundServiceWithNotification(statusText: String) {
        val notification = buildNotification(statusText)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun updateNotification(statusText: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(NOTIFICATION_ID, buildNotification(statusText))
    }

    private fun buildNotification(statusText: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, PrintBridgeForegroundService::class.java).apply { action = ACTION_STOP },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SpiralDine Kitchen Print Bridge")
            .setContentText(statusText)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .addAction(0, "Stop Bridge", stopIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SpiralDine Print Bridge Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors orders and manages thermal printing in background"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
}
