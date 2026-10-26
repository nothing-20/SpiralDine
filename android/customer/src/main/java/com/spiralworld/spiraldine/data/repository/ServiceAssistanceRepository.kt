package com.spiralworld.spiraldine.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.spiralworld.spiraldine.data.model.DiningSession
import com.spiralworld.spiraldine.data.model.ServiceRequestRecord
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

sealed interface ServiceAssistanceState {
    data object Idle : ServiceAssistanceState
    data class Submitting(val requestType: String) : ServiceAssistanceState
    data class Success(val message: String, val requestId: String) : ServiceAssistanceState
    data class Error(val message: String) : ServiceAssistanceState
}

object ServiceAssistanceValidator {
    fun normalizeType(requestType: String): String {
        return when {
            requestType.contains("Water", ignoreCase = true) -> "Water"
            requestType.contains("Bill", ignoreCase = true) -> "Bill"
            requestType.contains("Cutlery", ignoreCase = true) || requestType.contains("Napkin", ignoreCase = true) -> "Cutlery"
            requestType.contains("Clean", ignoreCase = true) -> "Cleaning"
            else -> "Assistance"
        }
    }

    fun validateSession(session: DiningSession?): Result<Unit> {
        if (session == null || session.tenantId.isBlank() || session.tableNumber.isBlank()) {
            return Result.failure(IllegalStateException("Active table session required. Please scan a table QR code first."))
        }
        if (DiningSessionRepository.isSessionExpired(session)) {
            return Result.failure(IllegalStateException("Dining session has expired. Please rescan your table QR code."))
        }
        return Result.success(Unit)
    }

    fun isDebounced(lastTimestamp: Long, currentTimestamp: Long, cooldownMs: Long = 30_000L): Boolean {
        if (lastTimestamp <= 0L) return false
        return (currentTimestamp - lastTimestamp) < cooldownMs
    }
}

class ServiceAssistanceRepository(
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    constructor(firestore: FirebaseFirestore) : this({ firestore })
    private val _submissionState = MutableStateFlow<ServiceAssistanceState>(ServiceAssistanceState.Idle)
    val submissionState: StateFlow<ServiceAssistanceState> = _submissionState.asStateFlow()

    // In-memory rate limiting map: type -> lastSubmittedTimestamp
    private val lastRequestTimestamps = mutableMapOf<String, Long>()
    private val debounceCooldownMs = 30_000L // 30 seconds debounce per request type

    /**
     * Submits a service assistance request to the restaurant's active waiter queue.
     * Prevents accidental duplicates and verifies active table session presence.
     */
    suspend fun submitServiceRequest(
        session: DiningSession?,
        requestType: String, // 'Call Waiter', 'Water', 'Bill', 'Cutlery', 'Cleaning'
        notes: String = "",
        userId: String = ""
    ): Result<ServiceRequestRecord> {
        val sessionValidation = ServiceAssistanceValidator.validateSession(session)
        if (sessionValidation.isFailure) {
            val err = sessionValidation.exceptionOrNull()?.message ?: "Active table session required."
            _submissionState.value = ServiceAssistanceState.Error(err)
            return Result.failure(sessionValidation.exceptionOrNull()!!)
        }

        val typeNormalized = ServiceAssistanceValidator.normalizeType(requestType)

        // Rate limiting check
        val lastTime = lastRequestTimestamps[typeNormalized] ?: 0L
        val now = System.currentTimeMillis()
        if (ServiceAssistanceValidator.isDebounced(lastTime, now, debounceCooldownMs)) {
            val remainingSec = ((debounceCooldownMs - (now - lastTime)) / 1000).coerceAtLeast(1)
            val err = "Please wait $remainingSec seconds before requesting $requestType again."
            _submissionState.value = ServiceAssistanceState.Error(err)
            return Result.failure(IllegalStateException(err))
        }

        _submissionState.value = ServiceAssistanceState.Submitting(requestType)

        try {
            val reqId = "REQ-${typeNormalized.uppercase()}-${(100000..999999).random()}"
            val isoFormatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }
            val nowIso = isoFormatter.format(Date())

            val record = ServiceRequestRecord(
                id = reqId,
                requestId = reqId,
                tenantId = session!!.tenantId,
                tableNumber = session.tableNumber.replace("TBL-", "", ignoreCase = true),
                tableId = session.tableId,
                sessionId = session.sessionId,
                type = typeNormalized,
                requestType = requestType,
                status = "Pending",
                createdAt = nowIso,
                userId = userId,
                notes = notes
            )

            val docMap = mapOf(
                "id" to record.id,
                "requestId" to record.requestId,
                "tenantId" to record.tenantId,
                "tableNumber" to record.tableNumber,
                "tableId" to record.tableId,
                "sessionId" to record.sessionId,
                "type" to record.type,
                "requestType" to record.requestType,
                "status" to record.status,
                "createdAt" to record.createdAt,
                "userId" to record.userId,
                "notes" to record.notes
            )

            firestore.collection("restaurants")
                .document(session.tenantId)
                .collection("waiterRequests")
                .document(reqId)
                .set(docMap)
                .await()

            lastRequestTimestamps[typeNormalized] = now
            val displayMsg = "$requestType requested for Table ${record.tableNumber}. Staff has been notified."
            _submissionState.value = ServiceAssistanceState.Success(displayMsg, reqId)

            return Result.success(record)
        } catch (e: Exception) {
            val err = e.message ?: "Failed to submit assistance request."
            _submissionState.value = ServiceAssistanceState.Error(err)
            return Result.failure(e)
        }
    }

    /**
     * Streams active service requests for the specified dining table session.
     */
    fun streamActiveRequests(tenantId: String, tableNumber: String): Flow<List<ServiceRequestRecord>> = callbackFlow {
        if (tenantId.isBlank() || tableNumber.isBlank()) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val cleanTable = tableNumber.replace("TBL-", "", ignoreCase = true)
        val registration = firestore.collection("restaurants")
            .document(tenantId)
            .collection("waiterRequests")
            .whereEqualTo("tableNumber", cleanTable)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val list = snapshot?.documents?.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    ServiceRequestRecord(
                        id = doc.id,
                        requestId = data["requestId"] as? String ?: doc.id,
                        tenantId = tenantId,
                        tableNumber = data["tableNumber"] as? String ?: "",
                        tableId = data["tableId"] as? String ?: "",
                        sessionId = data["sessionId"] as? String ?: "",
                        type = data["type"] as? String ?: "Assistance",
                        requestType = data["requestType"] as? String ?: "Call Waiter",
                        status = data["status"] as? String ?: "Pending",
                        createdAt = data["createdAt"] as? String ?: "",
                        userId = data["userId"] as? String ?: "",
                        notes = data["notes"] as? String ?: ""
                    )
                }?.sortedByDescending { it.createdAt } ?: emptyList()

                trySend(list)
            }

        awaitClose { registration.remove() }
    }

    fun resetState() {
        _submissionState.value = ServiceAssistanceState.Idle
    }
}
