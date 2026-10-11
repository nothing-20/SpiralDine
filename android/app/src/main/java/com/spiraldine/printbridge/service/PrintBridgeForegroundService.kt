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

import android.util.Log
import com.spiraldine.printbridge.model.ServiceStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

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
        private const val TAG = "PrintBridgeFGS"
        const val CHANNEL_ID = "spiraldine_print_bridge_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START = "com.spiraldine.printbridge.action.START"
        const val ACTION_STOP = "com.spiraldine.printbridge.action.STOP"

        private val _serviceStatus = MutableStateFlow<ServiceStatus>(ServiceStatus.Stopped)
        val serviceStatus: StateFlow<ServiceStatus> = _serviceStatus.asStateFlow()

        @Volatile
        var isServiceRunning: Boolean = false
            private set

        fun start(context: Context) {
            val current = _serviceStatus.value
            if (current is ServiceStatus.Running || current is ServiceStatus.Starting) {
                Log.d(TAG, "start() ignored; service is already in state: $current")
                return
            }
            Log.i(TAG, "PrintBridgeForegroundService.start() requested")
            _serviceStatus.value = ServiceStatus.Starting
            try {
                val intent = Intent(context, PrintBridgeForegroundService::class.java).apply {
                    action = ACTION_START
                }
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start foreground service: ${e::class.java.simpleName}: ${e.message}", e)
                _serviceStatus.value = ServiceStatus.Error(
                    e.localizedMessage ?: "Failed to start foreground print service"
                )
            }
        }

        fun stop(context: Context) {
            Log.i(TAG, "PrintBridgeForegroundService.stop() requested")
            try {
                val intent = Intent(context, PrintBridgeForegroundService::class.java).apply {
                    action = ACTION_STOP
                }
                context.startService(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send stop intent: ${e::class.java.simpleName}: ${e.message}", e)
            }
            _serviceStatus.value = ServiceStatus.Stopped
            isServiceRunning = false
        }

        /**
         * Test and diagnostic helper to reset service state in unit tests.
         */
        fun resetStatusForTesting(status: ServiceStatus = ServiceStatus.Stopped) {
            _serviceStatus.value = status
            isServiceRunning = status is ServiceStatus.Running
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
        Log.i(TAG, "PrintBridgeForegroundService.onCreate() called")
        FirebaseAuthManager.initializeFirebase(this)
        authStorage = AuthStorage(this)
        val database = PrintBridgeDatabase.getInstance(this)
        printJobRepository = PrintJobRepository(database.printJobDao())
        queueProcessor = PrintQueueProcessor(printJobRepository)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i(TAG, "PrintBridgeForegroundService.onStartCommand() action=${intent?.action}")
        if (intent?.action == ACTION_STOP) {
            stopBridge()
            stopSelf()
            _serviceStatus.value = ServiceStatus.Stopped
            isServiceRunning = false
            return START_NOT_STICKY
        }

        val session = authStorage.getSession()
        if (session == null) {
            Log.w(TAG, "Service started but device is not paired to a restaurant workspace")
            val errorMsg = "Device not paired to a restaurant workspace"
            _serviceStatus.value = ServiceStatus.Error(errorMsg)
            isServiceRunning = false
            stopSelf()
            return START_NOT_STICKY
        }

        val initialText = "Active: ${session.restaurantName} (Listening for KOTs)"
        val foregroundSuccess = startForegroundServiceWithNotification(initialText)
        if (!foregroundSuccess) {
            isServiceRunning = false
            stopSelf()
            return START_NOT_STICKY
        }

        if (!isServiceRunning) {
            isServiceRunning = true
            _serviceStatus.value = ServiceStatus.Running()
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
                        val prefs = getSharedPreferences("spiraldine_printer_config", Context.MODE_PRIVATE)
                        val stationFilter = prefs.getString("station_filter", "ALL") ?: "ALL"
                        val paperWidthMm = prefs.getInt("paper_width", 80)
                        val paperWidth = if (paperWidthMm == 58) ThermalPaperWidth.WIDTH_58MM else ThermalPaperWidth.WIDTH_80MM

                        val processResult = queueProcessor.processNextJob(
                            transport = activeTransport,
                            paperWidth = paperWidth,
                            stationFilter = stationFilter
                        )

                        when (processResult) {
                            is QueueProcessResult.Success -> {
                                updateNotification("Sent to printer: ${processResult.jobId} (${processResult.bytesWritten} B)")
                                syncPrintSuccessToFirestore(
                                    tenantId = session.tenantId,
                                    jobId = processResult.jobId,
                                    bytesWritten = processResult.bytesWritten,
                                    transportType = activeTransport.transportType
                                )
                            }
                            is QueueProcessResult.SkippedStation -> {
                                updateNotification("Filtered: Ticket routed to another station")
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

    private fun syncPrintSuccessToFirestore(
        tenantId: String,
        jobId: String,
        bytesWritten: Int,
        transportType: String
    ) {
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

                // Preserves web schema compatibility via canonical printStatus = "printed"
                // while recording explicit transport delivery attributes to distinguish
                // transport socket write acceptance from verified physical printing.
                docRef.update(
                    mapOf(
                        "printStatus" to "printed",
                        "printedAt" to nowIso,
                        "lastPrintAttemptAt" to nowIso,
                        "transportDelivered" to true,
                        "transportDeliveryType" to transportType,
                        "transportBytesWritten" to bytesWritten,
                        "updatedAt" to nowIso
                    )
                )
            } catch (_: Exception) {
                // Non-blocking firestore status sync update
            }
        }
    }

    private fun stopBridge() {
        Log.i(TAG, "Stopping Print Bridge service workers and listener")
        isServiceRunning = false
        _serviceStatus.value = ServiceStatus.Stopped
        firestoreListener?.stop()
        firestoreListener = null
        queueJob?.cancel()
        serviceScope.cancel()
    }

    override fun onDestroy() {
        Log.i(TAG, "PrintBridgeForegroundService.onDestroy() called")
        stopBridge()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun startForegroundServiceWithNotification(statusText: String): Boolean {
        return try {
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
            Log.i(TAG, "startForeground entered successfully with notification")
            true
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed: ${e::class.java.simpleName}: ${e.message}", e)
            _serviceStatus.value = ServiceStatus.Error(
                "Foreground notification failure: ${e.localizedMessage ?: e::class.java.simpleName}"
            )
            false
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
