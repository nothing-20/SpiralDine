package com.spiralworld.spiraldine.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.google.firebase.firestore.FirebaseFirestore
import com.spiralworld.spiraldine.data.model.DiningSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class DiningSessionRepository(
    context: Context? = null,
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    constructor(context: Context?, firestore: FirebaseFirestore) : this(context, { firestore })

    private val prefs: SharedPreferences? = try {
        context?.getSharedPreferences("spiraldine_dining_session", Context.MODE_PRIVATE)
    } catch (_: Exception) {
        null
    }

    private val _currentSession = MutableStateFlow<DiningSession?>(loadSession())
    val currentSession: StateFlow<DiningSession?> = _currentSession.asStateFlow()

    private fun loadSession(): DiningSession? {
        val p = prefs ?: return null
        val sessionId = p.getString("sessionId", null) ?: return null
        val tenantId = p.getString("tenantId", "") ?: ""
        if (tenantId.isBlank()) return null

        val startedAt = p.getString("startedAt", "") ?: ""
        val session = DiningSession(
            sessionId = sessionId,
            tenantId = tenantId,
            restaurantName = p.getString("restaurantName", "Restaurant") ?: "Restaurant",
            tableNumber = p.getString("tableNumber", "1") ?: "1",
            tableId = p.getString("tableId", "") ?: "",
            customerId = p.getString("customerId", "") ?: "",
            startedAt = startedAt
        )

        // Session age validation: clear if older than 12 hours
        if (isSessionExpired(session)) {
            p.edit().clear().apply()
            return null
        }

        return session
    }

    companion object {
        fun isSessionExpired(session: DiningSession?, maxAgeHours: Int = 12): Boolean {
            if (session == null || session.startedAt.isBlank()) return false
            return try {
                val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
                val startTime = sdf.parse(session.startedAt)?.time ?: return false
                (System.currentTimeMillis() - startTime) > (maxAgeHours * 60 * 60 * 1000L)
            } catch (_: Exception) {
                false
            }
        }
    }

    /**
     * Checks if a session has expired based on elapsed time (defaults to 12 hours).
     */
    fun isSessionExpired(session: DiningSession, maxAgeHours: Int = 12): Boolean =
        Companion.isSessionExpired(session, maxAgeHours)


    /**
     * Validates that the active session matches the targeted restaurant.
     */
    fun isSessionValidForRestaurant(tenantId: String): Boolean {
        val session = _currentSession.value ?: return false
        if (isSessionExpired(session)) {
            clearSession()
            return false
        }
        return session.tenantId.equals(tenantId, ignoreCase = true)
    }

    /**
     * Authoritatively validates restaurant and table availability against Firestore
     * before establishing a dining session. Prevents binding to disabled tables or inactive restaurants.
     */
    suspend fun validateAndStartSession(
        tenantId: String,
        tableNumber: String,
        customerId: String = "",
        knownRestaurantName: String? = null
    ): Result<DiningSession> {
        val cleanTenant = tenantId.trim()
        if (cleanTenant.isBlank()) {
            return Result.failure(IllegalArgumentException("Invalid restaurant identifier."))
        }

        val cleanTable = tableNumber.replace("(?i)^TBL-".toRegex(), "").trim()
        if (cleanTable.isBlank()) {
            return Result.failure(IllegalArgumentException("Invalid table number."))
        }
        val resolvedTableId = "TBL-$cleanTable"

        try {
            // 1. Verify restaurant existence & active state
            var restaurantName = knownRestaurantName ?: "Restaurant"
            val restDoc = firestore.collection("restaurants").document(cleanTenant).get().await()
            if (!restDoc.exists()) {
                val tenantDoc = firestore.collection("tenants").document(cleanTenant).get().await()
                if (!tenantDoc.exists()) {
                    return Result.failure(IllegalArgumentException("Restaurant '$cleanTenant' does not exist."))
                }
                val tData = tenantDoc.data ?: emptyMap<String, Any>()
                if (tData["status"] == "inactive" || tData["status"] == "suspended") {
                    return Result.failure(IllegalStateException("Restaurant is currently inactive."))
                }
                restaurantName = tData["name"] as? String ?: restaurantName
            } else {
                val rData = restDoc.data ?: emptyMap<String, Any>()
                if (rData["status"] == "inactive" || rData["isActive"] == false) {
                    return Result.failure(IllegalStateException("Restaurant is currently inactive."))
                }
                restaurantName = rData["name"] as? String ?: restaurantName
            }

            // 2. Verify table existence and status if table record exists
            var finalTableId = resolvedTableId
            try {
                var tableDoc = firestore.collection("restaurants").document(cleanTenant)
                    .collection("tables").document(resolvedTableId).get().await()
                if (!tableDoc.exists() && resolvedTableId != cleanTable) {
                    tableDoc = firestore.collection("restaurants").document(cleanTenant)
                        .collection("tables").document(cleanTable).get().await()
                }
                if (!tableDoc.exists()) {
                    val qNum = firestore.collection("restaurants").document(cleanTenant)
                        .collection("tables").whereEqualTo("tableNumber", cleanTable).get().await()
                    if (!qNum.isEmpty) {
                        tableDoc = qNum.documents[0]
                    }
                }
                if (tableDoc.exists()) {
                    finalTableId = tableDoc.id
                    val tblData = tableDoc.data ?: emptyMap<String, Any>()
                    val tblRestId = tblData["restaurantId"] as? String
                    if (!tblRestId.isNullOrBlank() && tblRestId != cleanTenant) {
                        return Result.failure(IllegalStateException("Table #$cleanTable belongs to another restaurant."))
                    }
                    val isActive = tblData["isActive"] as? Boolean ?: true
                    val status = (tblData["status"] as? String ?: "").lowercase()
                    if (!isActive || status == "disabled" || status == "inactive") {
                        return Result.failure(IllegalStateException("Table #$cleanTable is currently disabled by staff."))
                    }
                }
            } catch (tblErr: Exception) {
                if (tblErr.message?.contains("disabled") == true) throw tblErr
            }

            val session = startSession(
                tenantId = cleanTenant,
                restaurantName = restaurantName,
                tableNumber = cleanTable,
                tableId = finalTableId,
                customerId = customerId
            )
            return Result.success(session)
        } catch (e: Exception) {
            return Result.failure(e)
        }
    }

    fun startSession(
        tenantId: String,
        restaurantName: String,
        tableNumber: String,
        tableId: String = "",
        customerId: String = ""
    ): DiningSession {
        val cleanTable = tableNumber.replace("(?i)^TBL-".toRegex(), "").trim()
        val resolvedTableId = tableId.ifBlank { "TBL-$cleanTable" }

        val existing = _currentSession.value
        // If already in the same session at this table and not expired, keep it
        if (existing != null && existing.tenantId == tenantId && existing.tableNumber == cleanTable && !isSessionExpired(existing)) {
            return existing
        }

        val datePrefix = SimpleDateFormat("yyyyMMdd", Locale.US).format(Date())
        val randomSuffix = UUID.randomUUID().toString().substring(0, 6).uppercase(Locale.US)
        val newSessionId = "SES-$datePrefix-$randomSuffix"

        val session = DiningSession(
            sessionId = newSessionId,
            tenantId = tenantId,
            restaurantName = restaurantName,
            tableNumber = cleanTable,
            tableId = resolvedTableId,
            customerId = customerId,
            startedAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        )

        prefs?.edit()
            ?.putString("sessionId", session.sessionId)
            ?.putString("tenantId", session.tenantId)
            ?.putString("restaurantName", session.restaurantName)
            ?.putString("tableNumber", session.tableNumber)
            ?.putString("tableId", session.tableId)
            ?.putString("customerId", session.customerId)
            ?.putString("startedAt", session.startedAt)
            ?.apply()

        _currentSession.value = session
        return session
    }

    suspend fun checkLeaveEligibility(
        tenantId: String,
        tableNumber: String,
        sessionId: String? = null
    ): TableLeaveEligibility {
        if (tenantId.isBlank()) return TableLeaveEligibility.Eligible
        val cleanTable = tableNumber.replace("(?i)^TBL-".toRegex(), "").trim()

        return try {
            val ordersCol = firestore.collection("restaurants").document(tenantId).collection("orders")
            val snap = ordersCol.whereEqualTo("tableNumber", cleanTable).get().await()

            var hasActiveUnfinishedOrder = false
            var unpaidTotal = 0.0
            var firstUnpaidOrderId = ""

            for (doc in snap.documents) {
                val data = doc.data ?: continue
                val status = (data["status"] as? String ?: "").lowercase()
                val paymentStatus = (data["paymentStatus"] as? String ?: "").lowercase()
                val isPaid = (data["isPaid"] as? Boolean) == true || paymentStatus == "paid"

                val isCancelled = status == "cancelled" || status == "rejected"
                if (isCancelled) continue

                val isCompleted = status == "completed" || status == "served" || status == "delivered" || status == "dining_completed"
                if (!isCompleted) {
                    hasActiveUnfinishedOrder = true
                }

                if (!isPaid) {
                    val tot = (data["total"] as? Number)?.toDouble() ?: (data["totalAmount"] as? Number)?.toDouble() ?: 0.0
                    unpaidTotal += tot
                    if (firstUnpaidOrderId.isBlank()) {
                        firstUnpaidOrderId = doc.id
                    }
                }
            }

            if (unpaidTotal > 0.0) {
                TableLeaveEligibility.OutstandingBill(unpaidTotal, firstUnpaidOrderId)
            } else if (hasActiveUnfinishedOrder) {
                TableLeaveEligibility.ActiveOrders(1)
            } else {
                TableLeaveEligibility.Eligible
            }
        } catch (e: Exception) {
            TableLeaveEligibility.Eligible
        }
    }

    suspend fun leaveTable(
        tenantId: String,
        tableNumber: String,
        sessionId: String? = null,
        force: Boolean = false
    ): Result<Unit> {
        val cleanTenant = tenantId.trim()
        val cleanTable = tableNumber.replace("(?i)^TBL-".toRegex(), "").trim()
        val resolvedTableId = "TBL-$cleanTable"

        if (!force) {
            val eligibility = checkLeaveEligibility(cleanTenant, cleanTable, sessionId)
            if (eligibility is TableLeaveEligibility.OutstandingBill) {
                val formattedAmount = CurrencyFormatter.formatPrice(eligibility.unpaidAmount)
                return Result.failure(IllegalStateException("Please settle your outstanding bill of $formattedAmount before leaving Table #$cleanTable."))
            }
            if (eligibility is TableLeaveEligibility.ActiveOrders) {
                return Result.failure(IllegalStateException("You have active food preparation orders in progress for Table #$cleanTable."))
            }
        }

        return try {
            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())

            // 1. Authoritatively update table in Firestore to 'cleaning' with waiter alert
            try {
                var tableDocRef = firestore.collection("restaurants").document(cleanTenant)
                    .collection("tables").document(resolvedTableId)
                val tableSnap = tableDocRef.get().await()
                if (!tableSnap.exists() && resolvedTableId != cleanTable) {
                    tableDocRef = firestore.collection("restaurants").document(cleanTenant)
                        .collection("tables").document(cleanTable)
                }

                tableDocRef.set(
                    mapOf(
                        "status" to "cleaning",
                        "tableStatus" to "cleaning",
                        "subStatus" to "cleaning",
                        "diningStatus" to "cleaning",
                        "customerPresent" to false,
                        "cleaningStartedAt" to nowIso,
                        "cleaningDurationMinutes" to 10,
                        "activeOrderId" to null,
                        "currentOrderId" to null,
                        "billPaidAt" to nowIso,
                        "updatedAt" to nowIso
                    ),
                    com.google.firebase.firestore.SetOptions.merge()
                ).await()

                // 2. Post alert for waiter
                val alertRef = firestore.collection("restaurants").document(cleanTenant)
                    .collection("waiterRequests").document()
                alertRef.set(
                    mapOf(
                        "tableNumber" to cleanTable,
                        "requestType" to "Clean Table",
                        "description" to "Table $cleanTable: Diner ended session. Table vacated and ready for sanitizing.",
                        "status" to "Pending",
                        "priority" to "high",
                        "createdAt" to nowIso
                    )
                ).await()
            } catch (_: Exception) {}

            // 3. Mark dining session completed in Firestore
            val sid = sessionId ?: _currentSession.value?.sessionId
            if (!sid.isNullOrBlank()) {
                try {
                    firestore.collection("restaurants").document(cleanTenant)
                        .collection("diningSessions").document(sid)
                        .set(
                            mapOf(
                                "status" to "completed",
                                "closedAt" to nowIso,
                                "updatedAt" to nowIso
                            ),
                            com.google.firebase.firestore.SetOptions.merge()
                        ).await()
                } catch (_: Exception) {}
            }

            // 4. Clear local session
            clearSession()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun clearSession() {
        prefs?.edit()?.clear()?.apply()
        try {
            _currentSession.value = null
        } catch (_: Exception) {}
    }
}

sealed interface TableLeaveEligibility {
    data object Eligible : TableLeaveEligibility
    data class OutstandingBill(val unpaidAmount: Double, val orderId: String) : TableLeaveEligibility
    data class ActiveOrders(val orderCount: Int) : TableLeaveEligibility
    data class Error(val message: String) : TableLeaveEligibility
}
