package com.spiraldine.printbridge.sync

import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.spiraldine.printbridge.data.EnqueueResult
import com.spiraldine.printbridge.data.PrintJobRepository
import com.spiraldine.printbridge.model.KotItem
import com.spiraldine.printbridge.model.KotTicket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

import android.util.Log
import kotlinx.coroutines.SupervisorJob

/**
 * Real-time listener for canonical SpiralDine Kitchen Order Tickets.
 *
 * Requirements addressed:
 * - Subscribes strictly to restaurants/{tenantId}/kitchenTickets
 * - Guarantees tenant isolation
 * - Avoids reprinting historical tickets when starting up
 * - Idempotently enqueues new tickets using deterministic identifiers
 * - Handles supplementary KOT rounds cleanly
 * - Clean listener removal on teardown
 */
class KotFirestoreListener(
    private val tenantId: String,
    private val printJobRepository: PrintJobRepository,
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseFirestore.getInstance() },
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob()),
    private val onSyncStateChanged: (SyncState) -> Unit = {}
) {

    sealed interface SyncState {
        data object Listening : SyncState
        data class Error(val message: String) : SyncState
        data object Stopped : SyncState
    }


    private var registration: ListenerRegistration? = null
    private val listenerStartTimeMs: Long = System.currentTimeMillis()

    fun start() {
        if (registration != null) {
            Log.d(TAG, "Listener already active for tenant: $tenantId")
            return
        }

        try {
            val firestore = firestoreProvider()
            val collectionPath = "restaurants/$tenantId/kitchenTickets"
            Log.i(TAG, "Starting KotFirestoreListener on $collectionPath")

            val collectionRef = firestore
                .collection("restaurants")
                .document(tenantId)
                .collection("kitchenTickets")

            onSyncStateChanged(SyncState.Listening)

            registration = collectionRef.addSnapshotListener { snapshot, error ->
                if (error != null) {
                    val errMsg = error.localizedMessage ?: "Firestore listener error"
                    Log.e(TAG, "Firestore snapshot listener ERROR for $collectionPath: $errMsg", error)
                    onSyncStateChanged(SyncState.Error(errMsg))
                    return@addSnapshotListener
                }

                if (snapshot == null) {
                    Log.w(TAG, "Firestore snapshot was null for $collectionPath")
                    return@addSnapshotListener
                }

                val docCount = snapshot.size()
                val changeCount = snapshot.documentChanges.size
                Log.i(TAG, "Firestore snapshot received on $collectionPath: $docCount total docs, $changeCount changes")

                if (snapshot.isEmpty) {
                    Log.d(TAG, "Collection $collectionPath is currently empty")
                    return@addSnapshotListener
                }

                // Process document changes safely
                scope.launch {
                    try {
                        for (change in snapshot.documentChanges) {
                            if (change.type == DocumentChange.Type.ADDED || change.type == DocumentChange.Type.MODIFIED) {
                                Log.d(TAG, "Processing change type=${change.type} for docId=${change.document.id}")
                                processDocumentChange(change.document)
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Unexpected error processing snapshot changes on $collectionPath: ${e.message}", e)
                    }
                }
            }
        } catch (e: Exception) {
            val errMsg = e.localizedMessage ?: "Failed to start listener"
            Log.e(TAG, "Failed to register listener on restaurants/$tenantId/kitchenTickets: $errMsg", e)
            onSyncStateChanged(SyncState.Error(errMsg))
        }
    }

    suspend fun processDocumentChange(doc: DocumentSnapshot) {
        try {
            val docId = doc.id
            val ticket = parseKitchenTicket(doc)
            if (ticket == null) {
                Log.w(
                    TAG,
                    "REJECTED ticket doc $docId: parseKitchenTicket returned null (orderId=${doc.getString("orderId")}, items count=${(doc.get("items") as? List<*>)?.size})"
                )
                return
            }

            val printStatus = doc.getString("printStatus") ?: "unprinted"
            if (!shouldEnqueueTicket(ticket.createdAt, printStatus, listenerStartTimeMs)) {
                Log.i(TAG, "SKIPPED historical printed ticket: ${ticket.ticketId} (createdAt=${ticket.createdAt}, printStatus=$printStatus)")
                return
            }

            // Idempotent Queue Enqueue
            val result = printJobRepository.enqueueKot(ticket)
            when (result) {
                is EnqueueResult.Enqueued -> {
                    Log.i(
                        TAG,
                        "SUCCESS ENQUEUED: Job ${result.job.jobId} (Ticket: ${result.job.ticketNumber}, Order: ${result.job.orderId}) inserted into persistent Room queue with status PENDING"
                    )
                }
                is EnqueueResult.AlreadyQueued -> {
                    Log.d(TAG, "ALREADY QUEUED: Job ${result.existingJob.jobId} already exists in Room queue (status=${result.existingJob.status})")
                }
                is EnqueueResult.ReprintEnqueued -> {
                    Log.i(TAG, "REPRINT ENQUEUED: Reprint job ${result.job.jobId} inserted into Room queue")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing document change for doc ${doc.id}: ${e.message}", e)
        }
    }

    fun stop() {
        Log.i(TAG, "Stopping KotFirestoreListener on restaurants/$tenantId/kitchenTickets")
        registration?.remove()
        registration = null
        onSyncStateChanged(SyncState.Stopped)
    }

    /**
     * Maps Firestore document to canonical Kotlin KotTicket domain model.
     */
    fun parseKitchenTicket(doc: DocumentSnapshot): KotTicket? {
        val data = doc.data ?: emptyMap<String, Any>()
        return parseKitchenTicketData(data, doc.id)
    }

    companion object {
        private const val TAG = "KotFirestoreListener"
        // Lookback tolerance window for cold recovery (5 minutes)
        const val MAX_COLD_RECOVERY_WINDOW_MS = 5 * 60 * 1000L

        /**
         * Decides whether a ticket from Firestore should be enqueued.
         * Protects against historical reprint floods when starting the service.
         */
        fun shouldEnqueueTicket(
            createdAtIso: String,
            printStatus: String,
            listenerStartTimeMs: Long,
            lookbackWindowMs: Long = MAX_COLD_RECOVERY_WINDOW_MS
        ): Boolean {
            val createdAtMillis = parseIsoTimestamp(createdAtIso)
            val isHistorical = createdAtMillis < (listenerStartTimeMs - lookbackWindowMs)
            if (isHistorical && printStatus == "printed") {
                return false
            }
            return true
        }

        /**
         * Maps Firestore map data into KotTicket domain model.
         */
        fun parseKitchenTicketData(data: Map<String, Any?>, fallbackId: String): KotTicket? {
            val ticketId = (data["id"] as? String)?.takeIf { it.isNotBlank() } ?: fallbackId
            val orderId = data["orderId"] as? String ?: return null

            val ticketNumber = data["ticketNumber"] as? String ?: "KOT #0"
            val tableNumber = data["tableNumber"] as? String ?: "Walk-in"
            val tableName = data["tableName"] as? String
            val orderType = (data["source"] as? String)?.replace("_", " ")?.uppercase() ?: "DINE-IN"
            val serverName = data["waiterName"] as? String
            val customerName = data["customerName"] as? String
            val round = ((data["round"] as? Number)?.toInt()) ?: 1
            val isSupplementary = (data["isSupplementary"] as? Boolean) ?: (round > 1)
            val station = data["station"] as? String ?: "Main Kitchen"
            val createdAt = data["createdAt"] as? String ?: ""

            val rawItems = data["items"] as? List<*> ?: emptyList<Any>()
            val itemsList = mutableListOf<KotItem>()

            for ((idx, rawItem) in rawItems.withIndex()) {
                if (rawItem is Map<*, *>) {
                    val itemId = rawItem["itemId"]?.toString() ?: "item-$idx"
                    val name = rawItem["name"]?.toString() ?: "Item"
                    val count = (rawItem["count"] as? Number)?.toInt() ?: 1
                    val notes = rawItem["notes"]?.toString()
                    val itemStation = rawItem["station"]?.toString()

                    itemsList.add(
                        KotItem(
                            itemId = itemId,
                            name = name,
                            quantity = count,
                            notes = notes,
                            station = itemStation
                        )
                    )
                }
            }

            if (itemsList.isEmpty()) {
                return null
            }

            return KotTicket(
                ticketId = ticketId,
                ticketNumber = ticketNumber,
                orderId = orderId,
                tableNumber = tableNumber,
                tableName = tableName,
                orderType = orderType,
                serverName = serverName,
                customerName = customerName,
                round = round,
                isSupplementary = isSupplementary,
                primaryStation = station,
                items = itemsList,
                createdAt = createdAt
            )
        }

        fun parseIsoTimestamp(iso: String): Long {
            if (iso.isBlank()) return 0L
            return try {
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                sdf.parse(iso.take(19))?.time ?: 0L
            } catch (_: Exception) {
                0L
            }
        }
    }
}
