package com.spiralworld.spiraldine.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.spiralworld.spiraldine.data.model.SupportTicket
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class SupportTicketRepository(
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    constructor(firestore: FirebaseFirestore) : this({ firestore })

    /**
     * Streams support tickets submitted by the authenticated customer.
     * Enforces customer isolation.
     */
    fun getCustomerTickets(customerId: String): Flow<List<SupportTicket>> = callbackFlow {
        if (customerId.isBlank()) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = firestore.collection("supportTickets")
            .whereEqualTo("customerId", customerId)
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                val list = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    SupportTicket(
                        id = doc.id,
                        ticketId = doc.getString("ticketId") ?: doc.id,
                        customerId = doc.getString("customerId") ?: "",
                        customerName = doc.getString("customerName") ?: "",
                        customerEmail = doc.getString("customerEmail") ?: "",
                        category = doc.getString("category") ?: "General Inquiry",
                        description = doc.getString("description") ?: "",
                        orderId = doc.getString("orderId"),
                        bookingId = doc.getString("bookingId"),
                        status = doc.getString("status") ?: "open",
                        createdAt = doc.getString("createdAt") ?: "",
                        updatedAt = doc.getString("updatedAt") ?: "",
                        responseMessage = doc.getString("responseMessage")
                    )
                }.sortedByDescending { it.createdAt }

                trySend(list)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Submits a customer support request with validation.
     */
    suspend fun createTicket(
        customerId: String,
        customerName: String,
        customerEmail: String,
        category: String,
        description: String,
        orderId: String? = null,
        bookingId: String? = null
    ): Result<SupportTicket> {
        if (customerId.isBlank()) {
            return Result.failure(IllegalArgumentException("Customer identification required."))
        }
        if (description.isBlank()) {
            return Result.failure(IllegalArgumentException("Please describe the issue in detail."))
        }

        return try {
            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
            val ticketId = "TICK-${(100000..999999).random()}"

            val ticketData = hashMapOf<String, Any?>(
                "id" to ticketId,
                "ticketId" to ticketId,
                "customerId" to customerId,
                "customerName" to customerName.trim().ifBlank { "Valued Diner" },
                "customerEmail" to customerEmail.trim(),
                "category" to category.trim().ifBlank { "General Inquiry" },
                "description" to description.trim(),
                "orderId" to orderId?.trim()?.ifBlank { null },
                "bookingId" to bookingId?.trim()?.ifBlank { null },
                "status" to "open",
                "createdAt" to nowIso,
                "updatedAt" to nowIso
            )

            firestore.collection("supportTickets")
                .document(ticketId)
                .set(ticketData)
                .await()

            val created = SupportTicket(
                id = ticketId,
                ticketId = ticketId,
                customerId = customerId,
                customerName = customerName,
                customerEmail = customerEmail,
                category = category,
                description = description,
                orderId = orderId,
                bookingId = bookingId,
                status = "open",
                createdAt = nowIso,
                updatedAt = nowIso
            )

            Result.success(created)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
