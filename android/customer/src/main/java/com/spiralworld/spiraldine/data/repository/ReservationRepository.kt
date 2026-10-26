package com.spiralworld.spiraldine.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.spiralworld.spiraldine.data.model.CustomerReservation
import com.spiralworld.spiraldine.data.model.RestaurantTable
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ReservationRepository(
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    constructor(firestore: FirebaseFirestore) : this({ firestore })

    /**
     * Streams all configured tables for a given restaurant tenant.
     */
    fun getTables(tenantId: String): Flow<List<RestaurantTable>> = callbackFlow {
        if (tenantId.isBlank()) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = firestore.collection("restaurants")
            .document(tenantId)
            .collection("tables")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                if (snapshot == null || snapshot.isEmpty) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                val tables = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    val isActive = doc.getBoolean("isActive") ?: true
                    val seatingCapacity = (doc.getLong("seatingCapacity") 
                        ?: doc.getLong("capacity") 
                        ?: 4L).toInt()
                    val tblNum = doc.getString("tableNumber") 
                        ?: doc.getString("number") 
                        ?: doc.id.replace("TBL-", "")

                    RestaurantTable(
                        id = doc.id,
                        tenantId = tenantId,
                        tableNumber = tblNum,
                        number = doc.getString("number") ?: tblNum,
                        seatingCapacity = seatingCapacity,
                        status = doc.getString("status") ?: doc.getString("tableStatus") ?: "Available",
                        floor = doc.getString("floor") ?: "",
                        section = doc.getString("section") ?: "",
                        tableName = doc.getString("tableName") ?: doc.getString("name") ?: "Table $tblNum",
                        isActive = isActive,
                        activeOrderId = doc.getString("activeOrderId") ?: doc.getString("currentOrderId"),
                        currentOrderId = doc.getString("currentOrderId"),
                        diningStatus = doc.getString("diningStatus"),
                        subStatus = doc.getString("subStatus"),
                        branchId = doc.getString("branchId") ?: "main"
                    )
                }

                trySend(tables)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Streams reservations for a restaurant on a specific date to evaluate table availability.
     */
    fun getReservationsForDate(tenantId: String, date: String): Flow<List<CustomerReservation>> = callbackFlow {
        if (tenantId.isBlank() || date.isBlank()) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = firestore.collection("restaurants")
            .document(tenantId)
            .collection("reservations")
            .whereEqualTo("date", date)
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                val list = snapshot.documents.mapNotNull { doc ->
                    if (doc.id.startsWith("LOCK_")) return@mapNotNull null
                    mapDocToReservation(doc)
                }

                trySend(list)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Streams customer reservations across their account history.
     */
    fun getCustomerReservations(customerId: String): Flow<List<CustomerReservation>> = callbackFlow {
        if (customerId.isBlank()) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = firestore.collection("customers")
            .document(customerId)
            .collection("reservations")
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    // Resilient fallback to users/{customerId}/reservations
                    firestore.collection("users")
                        .document(customerId)
                        .collection("reservations")
                        .get()
                        .addOnSuccessListener { fallbackSnap ->
                            val list = fallbackSnap.documents.mapNotNull { mapDocToReservation(it) }
                            trySend(list)
                        }
                        .addOnFailureListener {
                            trySend(emptyList())
                        }
                    return@addSnapshotListener
                }

                val list = snapshot.documents.mapNotNull { mapDocToReservation(it) }
                trySend(list)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Atomically creates a table reservation with double-booking lock protection.
     */
    suspend fun createReservationAtomic(
        tenantId: String,
        restaurantName: String,
        customerId: String,
        customerName: String,
        customerPhone: String,
        customerEmail: String,
        date: String,
        time: String,
        guests: Int,
        tableId: String,
        tableNumber: String,
        seatingPreference: String = "",
        specialNotes: String = "",
        directions: String = "",
        latitude: Double? = null,
        longitude: Double? = null
    ): Result<CustomerReservation> {
        if (tenantId.isBlank() || date.isBlank() || time.isBlank() || tableId.isBlank()) {
            return Result.failure(IllegalArgumentException("Missing mandatory booking parameters."))
        }

        val cleanTimeKey = time.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase(Locale.ROOT)
        val lockDocId = "LOCK_${tableId}_${date}_$cleanTimeKey"
        val bookingId = "RES-${(100000..999999).random()}"
        val notifId = "NOT-${(100000..999999).random()}"
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())

        return try {
            val createdReservation = firestore.runTransaction { transaction ->
                val tableDocRef = firestore.collection("restaurants")
                    .document(tenantId)
                    .collection("tables")
                    .document(tableId)

                val tableSnap = transaction.get(tableDocRef)
                if (!tableSnap.exists()) {
                    throw IllegalStateException("The selected table could not be found.")
                }

                val isActive = tableSnap.getBoolean("isActive") ?: true
                val tableStatus = tableSnap.getString("status") ?: "Available"
                if (!isActive || tableStatus.equals("Disabled", ignoreCase = true)) {
                    throw IllegalStateException("Table $tableNumber is currently disabled by restaurant management.")
                }

                val seatingCap = (tableSnap.getLong("seatingCapacity") 
                    ?: tableSnap.getLong("capacity") 
                    ?: 4L).toInt()
                if (guests > seatingCap) {
                    throw IllegalStateException("Table $tableNumber capacity ($seatingCap seats) is insufficient for $guests guests.")
                }

                // Check atomic double-booking slot lock
                val lockDocRef = firestore.collection("restaurants")
                    .document(tenantId)
                    .collection("reservations")
                    .document(lockDocId)

                val lockSnap = transaction.get(lockDocRef)
                if (lockSnap.exists()) {
                    val lockStatus = lockSnap.getString("status") ?: "Pending"
                    if (!lockStatus.equals("Cancelled", ignoreCase = true) && !lockStatus.equals("Rejected", ignoreCase = true)) {
                        throw IllegalStateException("Table $tableNumber is already booked for $date at $time. Please select another table.")
                    }
                }

                // Payload dictionary matching web and dashboard schemas
                val reservationPayload = hashMapOf<String, Any?>(
                    "id" to bookingId,
                    "bookingId" to bookingId,
                    "customerId" to customerId.ifBlank { "guest-uid" },
                    "customerName" to customerName.ifBlank { "Guest Diner" },
                    "customerPhone" to customerPhone,
                    "customerEmail" to customerEmail,
                    "restaurantId" to tenantId,
                    "restaurantName" to restaurantName,
                    "date" to date,
                    "time" to time,
                    "guests" to guests,
                    "tableId" to tableId,
                    "tableNumber" to tableNumber,
                    "assignedTableId" to tableId,
                    "assignedTableNumber" to tableNumber,
                    "seatingPreference" to seatingPreference,
                    "specialNotes" to specialNotes.trim(),
                    "specialRequests" to specialNotes.trim(),
                    "status" to "Pending",
                    "directions" to directions,
                    "lat" to latitude,
                    "lng" to longitude,
                    "createdAt" to nowIso,
                    "updatedAt" to nowIso
                )

                // Lock payload
                val lockPayload = hashMapOf<String, Any?>(
                    "id" to lockDocId,
                    "bookingId" to bookingId,
                    "restaurantId" to tenantId,
                    "tableId" to tableId,
                    "tableNumber" to tableNumber,
                    "date" to date,
                    "time" to time,
                    "status" to "Pending",
                    "customerId" to customerId.ifBlank { "guest-uid" },
                    "createdAt" to nowIso
                )

                // 1. Acquire atomic slot lock
                transaction.set(lockDocRef, lockPayload, SetOptions.merge())

                // 2. Write canonical restaurant reservation
                val resDocRef = firestore.collection("restaurants")
                    .document(tenantId)
                    .collection("reservations")
                    .document(bookingId)
                transaction.set(resDocRef, reservationPayload)

                // 3. Write customer and user history records if authenticated
                if (customerId.isNotBlank() && customerId != "guest-uid") {
                    val custDocRef = firestore.collection("customers")
                        .document(customerId)
                        .collection("reservations")
                        .document(bookingId)
                    transaction.set(custDocRef, reservationPayload)

                    val userDocRef = firestore.collection("users")
                        .document(customerId)
                        .collection("reservations")
                        .document(bookingId)
                    transaction.set(userDocRef, reservationPayload)
                }

                // 4. Send dashboard operational notification
                val notifDocRef = firestore.collection("restaurants")
                    .document(tenantId)
                    .collection("notifications")
                    .document(notifId)
                val notifPayload = hashMapOf<String, Any?>(
                    "id" to notifId,
                    "type" to "reservation",
                    "bookingId" to bookingId,
                    "customerName" to customerName.ifBlank { "Guest Diner" },
                    "guests" to guests,
                    "date" to date,
                    "time" to time,
                    "tableNumber" to tableNumber,
                    "restaurantName" to restaurantName,
                    "restaurantId" to tenantId,
                    "tableStatus" to "Pending",
                    "specialNotes" to specialNotes.trim(),
                    "bookingStatus" to "Pending",
                    "notificationStatus" to "unread",
                    "timestamp" to nowIso
                )
                transaction.set(notifDocRef, notifPayload)

                CustomerReservation(
                    id = bookingId,
                    bookingId = bookingId,
                    customerId = customerId,
                    customerName = customerName,
                    customerPhone = customerPhone,
                    customerEmail = customerEmail,
                    restaurantId = tenantId,
                    restaurantName = restaurantName,
                    date = date,
                    time = time,
                    guests = guests,
                    tableId = tableId,
                    tableNumber = tableNumber,
                    seatingPreference = seatingPreference,
                    specialNotes = specialNotes,
                    status = "Pending",
                    directions = directions,
                    lat = latitude,
                    lng = longitude,
                    createdAt = nowIso
                )
            }.await()

            Result.success(createdReservation)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cancels an active reservation and atomically releases the table slot lock.
     */
    suspend fun cancelReservation(reservation: CustomerReservation): Result<Unit> {
        val tenantId = reservation.restaurantId
        val resId = reservation.id.ifBlank { reservation.bookingId }
        if (tenantId.isBlank() || resId.isBlank()) {
            return Result.failure(IllegalArgumentException("Invalid reservation identifier."))
        }

        val cleanTimeKey = reservation.time.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase(Locale.ROOT)
        val lockDocId = "LOCK_${reservation.tableId}_${reservation.date}_$cleanTimeKey"
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())

        val cancelData = hashMapOf<String, Any?>(
            "status" to "Cancelled",
            "cancelledAt" to nowIso,
            "updatedAt" to nowIso
        )

        return try {
            firestore.runTransaction { transaction ->
                // 1. Update restaurant reservation record
                val resDocRef = firestore.collection("restaurants")
                    .document(tenantId)
                    .collection("reservations")
                    .document(resId)
                transaction.update(resDocRef, cancelData)

                // 2. Release slot lock if tableId is known
                if (reservation.tableId.isNotBlank()) {
                    val lockDocRef = firestore.collection("restaurants")
                        .document(tenantId)
                        .collection("reservations")
                        .document(lockDocId)
                    transaction.set(lockDocRef, hashMapOf("status" to "Cancelled", "updatedAt" to nowIso), SetOptions.merge())
                }

                // 3. Update customer / user profile history
                if (reservation.customerId.isNotBlank() && reservation.customerId != "guest-uid") {
                    val custDocRef = firestore.collection("customers")
                        .document(reservation.customerId)
                        .collection("reservations")
                        .document(resId)
                    transaction.update(custDocRef, cancelData)

                    val userDocRef = firestore.collection("users")
                        .document(reservation.customerId)
                        .collection("reservations")
                        .document(resId)
                    transaction.update(userDocRef, cancelData)
                }
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun mapDocToReservation(doc: com.google.firebase.firestore.DocumentSnapshot): CustomerReservation? {
        val data = doc.data ?: return null
        return CustomerReservation(
            id = doc.id,
            bookingId = doc.getString("bookingId") ?: doc.id,
            customerId = doc.getString("customerId") ?: "",
            customerName = doc.getString("customerName") ?: "Guest Diner",
            customerPhone = doc.getString("customerPhone") ?: "",
            customerEmail = doc.getString("customerEmail") ?: "",
            restaurantId = doc.getString("restaurantId") ?: "",
            restaurantName = doc.getString("restaurantName") ?: "Restaurant",
            date = doc.getString("date") ?: "",
            time = doc.getString("time") ?: "",
            guests = (doc.getLong("guests") ?: 2L).toInt(),
            tableId = doc.getString("tableId") ?: doc.getString("assignedTableId") ?: "",
            tableNumber = doc.getString("tableNumber") ?: doc.getString("assignedTableNumber") ?: "",
            seatingPreference = doc.getString("seatingPreference") ?: "",
            specialNotes = doc.getString("specialNotes") ?: "",
            status = doc.getString("status") ?: "Pending",
            directions = doc.getString("directions") ?: "",
            lat = doc.getDouble("lat"),
            lng = doc.getDouble("lng"),
            createdAt = doc.getString("createdAt") ?: "",
            updatedAt = doc.getString("updatedAt")
        )
    }
}
