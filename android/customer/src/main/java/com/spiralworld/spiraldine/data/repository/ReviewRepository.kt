package com.spiralworld.spiraldine.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.spiralworld.spiraldine.data.model.RestaurantRatingSummary
import com.spiralworld.spiraldine.data.model.ReviewRecord
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ReviewRepository(
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    constructor(firestore: FirebaseFirestore) : this({ firestore })

    /**
     * Listen to published customer reviews for a given restaurant tenant.
     * Enforces tenant isolation and bounds the query to prevent unbounded reads.
     */
    fun getRestaurantReviews(tenantId: String, limitCount: Long = 30): Flow<List<ReviewRecord>> = callbackFlow {
        if (tenantId.isBlank()) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = firestore.collection("restaurants")
            .document(tenantId)
            .collection("satisfactionRatings")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(limitCount)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    // Fallback query without orderBy if index is building
                    firestore.collection("restaurants")
                        .document(tenantId)
                        .collection("satisfactionRatings")
                        .limit(limitCount)
                        .get()
                        .addOnSuccessListener { fallbackSnap ->
                            val list = mapSnapshotToReviews(fallbackSnap.documents, tenantId)
                            trySend(list)
                        }
                        .addOnFailureListener {
                            trySend(emptyList())
                        }
                    return@addSnapshotListener
                }

                if (snapshot == null || snapshot.isEmpty) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                val list = mapSnapshotToReviews(snapshot.documents, tenantId)
                trySend(list)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Compute a verified rating summary directly from published reviews.
     * Prevents clients from tampering with aggregate rating fields.
     */
    fun getRatingSummary(tenantId: String): Flow<RestaurantRatingSummary> {
        return getRestaurantReviews(tenantId).map { reviews ->
            RatingCalculator.calculate(reviews)
        }
    }

    /**
     * Check if a review already exists for a specific completed order.
     * Prevents duplicate review submissions.
     */
    suspend fun getExistingReviewForOrder(tenantId: String, orderId: String): ReviewRecord? {
        if (tenantId.isBlank() || orderId.isBlank()) return null
        return try {
            val snapshot = firestore.collection("restaurants")
                .document(tenantId)
                .collection("satisfactionRatings")
                .whereEqualTo("orderId", orderId)
                .limit(1)
                .get()
                .await()

            if (!snapshot.isEmpty) {
                mapSnapshotToReviews(snapshot.documents, tenantId).firstOrNull()
            } else {
                null
            }
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Submits a customer review with strict validation.
     * Enforces 1 review per eligible order and isolates data per restaurant tenant.
     */
    suspend fun submitReview(review: ReviewRecord): Result<String> {
        if (review.tenantId.isBlank()) {
            return Result.failure(IllegalArgumentException("Restaurant identifier is required."))
        }
        if (review.orderId.isBlank()) {
            return Result.failure(IllegalArgumentException("Order reference is required to submit a review."))
        }
        if (review.starRating !in 1..5) {
            return Result.failure(IllegalArgumentException("Star rating must be between 1 and 5."))
        }

        // Check for duplicate review
        val existing = getExistingReviewForOrder(review.tenantId, review.orderId)
        if (existing != null) {
            return Result.failure(IllegalStateException("A review has already been submitted for this order."))
        }

        return try {
            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
            val rawName = review.submittedByName.trim().ifBlank { "Table Guest" }
            val publicName = if (review.isAnonymous) maskName(rawName) else rawName

            val reviewData = hashMapOf(
                "orderId" to review.orderId,
                "tenantId" to review.tenantId,
                "restaurantName" to review.restaurantName,
                "customerId" to review.customerId,
                "tableNumber" to review.tableNumber.ifBlank { "Walk-in" },
                "rating" to review.rating,
                "starRating" to review.starRating,
                "foodQuality" to review.foodQuality.coerceIn(1, 5),
                "service" to review.service.coerceIn(1, 5),
                "serviceSpeed" to review.service.coerceIn(1, 5),
                "cleanliness" to review.cleanliness.coerceIn(1, 5),
                "ambience" to review.ambience.coerceIn(1, 5),
                "notes" to review.notes.take(500),
                "comments" to review.notes.take(500),
                "isAnonymous" to review.isAnonymous,
                "submittedByName" to rawName,
                "publicCustomerName" to publicName,
                "revisitIntention" to review.revisitIntention,
                "repeatCustomer" to review.revisitIntention.equals("Yes", ignoreCase = true),
                "status" to "Published",
                "createdAt" to nowIso,
                "submittedAt" to nowIso
            )

            val docRef = firestore.collection("restaurants")
                .document(review.tenantId)
                .collection("satisfactionRatings")
                .add(reviewData)
                .await()

            // Also mirror under customers/{customerId}/reviews for instant personal activity view
            if (review.customerId.isNotBlank()) {
                try {
                    val customerReviewData = HashMap(reviewData)
                    customerReviewData["id"] = docRef.id
                    firestore.collection("customers")
                        .document(review.customerId)
                        .collection("reviews")
                        .document(docRef.id)
                        .set(customerReviewData)
                        .await()
                } catch (_: Exception) {}
            }

            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Streams all reviews submitted by the authenticated customer.
     */
    fun getCustomerReviews(customerId: String): Flow<List<ReviewRecord>> = callbackFlow {
        if (customerId.isBlank()) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = firestore.collection("customers")
            .document(customerId)
            .collection("reviews")
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                val list = snapshot.documents.mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    val star = (doc.getLong("starRating") ?: 5).toInt().coerceIn(1, 5)
                    ReviewRecord(
                        id = doc.id,
                        orderId = doc.getString("orderId") ?: "",
                        tenantId = doc.getString("tenantId") ?: "",
                        restaurantName = doc.getString("restaurantName") ?: "Restaurant",
                        customerId = customerId,
                        tableNumber = doc.getString("tableNumber") ?: "",
                        rating = doc.getString("rating") ?: "Excellent",
                        starRating = star,
                        foodQuality = (doc.getLong("foodQuality") ?: star.toLong()).toInt().coerceIn(1, 5),
                        service = (doc.getLong("service") ?: star.toLong()).toInt().coerceIn(1, 5),
                        cleanliness = (doc.getLong("cleanliness") ?: star.toLong()).toInt().coerceIn(1, 5),
                        ambience = (doc.getLong("ambience") ?: star.toLong()).toInt().coerceIn(1, 5),
                        notes = doc.getString("notes") ?: doc.getString("comments") ?: "",
                        isAnonymous = doc.getBoolean("isAnonymous") ?: false,
                        submittedByName = doc.getString("submittedByName") ?: "Diner",
                        publicCustomerName = doc.getString("publicCustomerName") ?: "Diner",
                        revisitIntention = doc.getString("revisitIntention") ?: "Yes",
                        status = doc.getString("status") ?: "Published",
                        createdAt = doc.getString("createdAt") ?: ""
                    )
                }.sortedByDescending { it.createdAt }

                trySend(list)
            }

        awaitClose { listener.remove() }
    }


    private fun mapSnapshotToReviews(
        documents: List<com.google.firebase.firestore.DocumentSnapshot>,
        tenantId: String
    ): List<ReviewRecord> {
        return documents.mapNotNull { doc ->
            val data = doc.data ?: return@mapNotNull null
            val status = doc.getString("status") ?: "Published"
            // Display only published reviews
            if (!status.equals("Published", ignoreCase = true)) return@mapNotNull null

            val isAnon = doc.getBoolean("isAnonymous") ?: false
            val rawCustomerName = doc.getString("submittedByName") ?: "Table Guest"
            val publicName = doc.getString("publicCustomerName")
                ?: if (isAnon) maskName(rawCustomerName) else rawCustomerName

            val star = (doc.getLong("starRating") ?: 5).toInt().coerceIn(1, 5)

            ReviewRecord(
                id = doc.id,
                orderId = doc.getString("orderId") ?: "",
                tenantId = doc.getString("tenantId") ?: tenantId,
                tableNumber = doc.getString("tableNumber") ?: "",
                rating = doc.getString("rating") ?: "Excellent",
                starRating = star,
                foodQuality = (doc.getLong("foodQuality") ?: star.toLong()).toInt().coerceIn(1, 5),
                service = (doc.getLong("service") ?: doc.getLong("serviceSpeed") ?: star.toLong()).toInt().coerceIn(1, 5),
                cleanliness = (doc.getLong("cleanliness") ?: star.toLong()).toInt().coerceIn(1, 5),
                ambience = (doc.getLong("ambience") ?: star.toLong()).toInt().coerceIn(1, 5),
                notes = doc.getString("notes") ?: doc.getString("comments") ?: doc.getString("feedback") ?: "",
                isAnonymous = isAnon,
                submittedByName = rawCustomerName,
                publicCustomerName = publicName,
                revisitIntention = doc.getString("revisitIntention") ?: (if (doc.getBoolean("repeatCustomer") == true) "Yes" else "Maybe"),
                status = status,
                createdAt = doc.getString("createdAt") ?: doc.getString("submittedAt") ?: ""
            )
        }
    }

    private fun maskName(name: String): String {
        val trimmed = name.trim()
        if (trimmed.length <= 2) return "Customer"
        return "${trimmed.first()}***${trimmed.last()}"
    }
}
