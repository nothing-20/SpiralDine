package com.spiralworld.spiraldine.data.repository

import android.content.Context
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import org.json.JSONArray

class FavouritesRepository(
    private val context: Context,
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    private val prefs = context.getSharedPreferences("spiral_diner_favourites", Context.MODE_PRIVATE)

    /**
     * Local cached favourites for offline & guest experience.
     */
    fun getLocalFavourites(customerId: String): Set<String> {
        val key = if (customerId.isNotBlank()) "favs_$customerId" else "diner_favourites"
        return prefs.getStringSet(key, emptySet()) ?: emptySet()
    }

    private fun setLocalFavourites(customerId: String, set: Set<String>) {
        val key = if (customerId.isNotBlank()) "favs_$customerId" else "diner_favourites"
        prefs.edit().putStringSet(key, set).apply()
        // Also keep web legacy key synced
        try {
            val jsonArr = JSONArray(set.toList())
            prefs.edit().putString("diner_favourites_json", jsonArr.toString()).apply()
        } catch (_: Exception) {}
    }

    /**
     * Stream favourite restaurant IDs in real time.
     * Enforces customer isolation.
     */
    fun getFavouriteRestaurantIds(customerId: String): Flow<Set<String>> = callbackFlow {
        if (customerId.isBlank()) {
            trySend(getLocalFavourites(""))
            close()
            return@callbackFlow
        }

        // Emit local cache immediately
        val cached = getLocalFavourites(customerId)
        trySend(cached)

        val docRef = firestore.collection("customers").document(customerId).collection("favorites")
        val listener = docRef.addSnapshotListener { snapshot, error ->
            if (error != null || snapshot == null) {
                trySend(getLocalFavourites(customerId))
                return@addSnapshotListener
            }

            val ids = snapshot.documents.map { it.id }.toSet()
            val combined = (cached + ids).toSet()
            setLocalFavourites(customerId, combined)
            trySend(combined)
        }

        awaitClose { listener.remove() }
    }

    fun getFavoriteRestaurantIds(customerId: String): Flow<Set<String>> = getFavouriteRestaurantIds(customerId)

    suspend fun addFavorite(customerId: String, restaurantId: String, restaurantName: String = ""): Result<Boolean> {
        val currentSet = getLocalFavourites(customerId).toMutableSet()
        if (currentSet.contains(restaurantId)) return Result.success(true)
        return toggleFavourite(customerId, restaurantId)
    }

    suspend fun removeFavorite(customerId: String, restaurantId: String): Result<Boolean> {
        val currentSet = getLocalFavourites(customerId).toMutableSet()
        if (!currentSet.contains(restaurantId)) return Result.success(false)
        return toggleFavourite(customerId, restaurantId)
    }

    /**
     * Toggles favourite status. Returns true if added, false if removed.
     */
    suspend fun toggleFavourite(customerId: String, restaurantId: String): Result<Boolean> {
        if (restaurantId.isBlank()) {
            return Result.failure(IllegalArgumentException("Restaurant ID is required"))
        }

        val currentSet = getLocalFavourites(customerId).toMutableSet()
        val willBeFavourite = !currentSet.contains(restaurantId)

        if (willBeFavourite) {
            currentSet.add(restaurantId)
        } else {
            currentSet.remove(restaurantId)
        }
        setLocalFavourites(customerId, currentSet)

        if (customerId.isNotBlank()) {
            try {
                val favDoc = firestore.collection("customers")
                    .document(customerId)
                    .collection("favorites")
                    .document(restaurantId)

                if (willBeFavourite) {
                    favDoc.set(
                        mapOf(
                            "restaurantId" to restaurantId,
                            "favoritedAt" to System.currentTimeMillis()
                        )
                    ).await()
                } else {
                    favDoc.delete().await()
                }
            } catch (e: Exception) {
                // If offline or Firestore errors, local preference still succeeded
            }
        }

        return Result.success(willBeFavourite)
    }

    /**
     * Clears all cached favourites upon account switch or logout.
     */
    fun clearCache(customerId: String) {
        val key = if (customerId.isNotBlank()) "favs_$customerId" else "diner_favourites"
        prefs.edit().remove(key).apply()
    }
}
