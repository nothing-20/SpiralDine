package com.spiralworld.spiraldine.data.repository

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.spiralworld.spiraldine.data.model.BusinessHours
import com.spiralworld.spiraldine.data.model.Restaurant
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class RestaurantRepository(
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    constructor(firestore: FirebaseFirestore) : this({ firestore })

    fun getRestaurants(): Flow<List<Restaurant>> = callbackFlow {
        // Query the publicly readable "tenants" collection directly, identical to website customer discovery
        val listener = firestore.collection("tenants")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                if (snapshot == null || snapshot.isEmpty) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                val list = snapshot.documents.mapNotNull { doc ->
                    mapDocumentToRestaurant(doc)
                }

                trySend(list)
            }

        awaitClose { listener.remove() }
    }

    fun getRestaurant(tenantId: String): Flow<Restaurant?> = callbackFlow {
        if (tenantId.isBlank()) {
            trySend(null)
            close()
            return@callbackFlow
        }

        // Query public tenants document first, with resilient fallback to restaurants document
        val listener = firestore.collection("tenants").document(tenantId)
            .addSnapshotListener { doc, _ ->
                if (doc != null && doc.exists()) {
                    val restaurant = mapDocumentToRestaurant(doc)
                    trySend(restaurant)
                } else {
                    firestore.collection("restaurants").document(tenantId).get()
                        .addOnSuccessListener { rDoc ->
                            if (rDoc.exists()) {
                                trySend(mapDocumentToRestaurant(rDoc))
                            } else {
                                trySend(null)
                            }
                        }
                        .addOnFailureListener {
                            trySend(null)
                        }
                }
            }

        awaitClose { listener.remove() }
    }

    suspend fun fetchRestaurant(tenantId: String): Restaurant? {
        if (tenantId.isBlank()) return null
        return try {
            val tenantDoc = firestore.collection("tenants").document(tenantId).get().await()
            if (tenantDoc.exists()) {
                mapDocumentToRestaurant(tenantDoc)
            } else {
                val restDoc = firestore.collection("restaurants").document(tenantId).get().await()
                if (restDoc.exists()) {
                    mapDocumentToRestaurant(restDoc)
                } else {
                    null
                }
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun mapDocumentToRestaurant(doc: DocumentSnapshot): Restaurant? {
        val data = doc.data ?: return null
        val isActive = doc.getBoolean("isActive") ?: (doc.getString("status") != "inactive")
        if (!isActive) return null

        val cuisinesRaw = doc.get("cuisines") as? List<*>
        val cuisinesList = cuisinesRaw?.filterIsInstance<String>()
            ?: doc.getString("cuisine")?.split(",")?.map { it.trim() }?.filter { it.isNotBlank() }
            ?: listOf("Multi-Cuisine")

        val addressMap = doc.get("address") as? Map<*, *>
        val locality = doc.getString("locality")
            ?: addressMap?.get("area") as? String
            ?: addressMap?.get("street") as? String
            ?: ""
        val city = doc.getString("city")
            ?: addressMap?.get("city") as? String
            ?: "Hyderabad"

        val fullAddress = doc.getString("fullAddress")
            ?: addressMap?.get("formatted") as? String
            ?: listOfNotNull(locality.ifBlank { null }, city).joinToString(", ")

        // Operating hours & timezone
        val bhMap = doc.get("businessHours") as? Map<*, *>
        val businessHours = if (bhMap != null) {
            val op = bhMap["openingTime"] as? String
            val cl = bhMap["closingTime"] as? String
            val wd = (bhMap["workingDays"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()
            val hs = bhMap["holidaySettings"] as? String
            BusinessHours(op, cl, wd, hs)
        } else null

        val settingsMap = doc.get("settings") as? Map<*, *>
        val timezone = doc.getString("timezone") ?: settingsMap?.get("timezone") as? String

        // Coordinates
        val coordMap = doc.get("coordinates") as? Map<*, *>
        val lat = doc.getDouble("latitude")
            ?: doc.getDouble("lat")
            ?: (coordMap?.get("lat") as? Number)?.toDouble()
            ?: (coordMap?.get("latitude") as? Number)?.toDouble()

        val lon = doc.getDouble("longitude")
            ?: doc.getDouble("lng")
            ?: (coordMap?.get("lng") as? Number)?.toDouble()
            ?: (coordMap?.get("longitude") as? Number)?.toDouble()

        // Pure veg flag
        val isPureVeg = doc.getBoolean("isPureVeg")
            ?: doc.getBoolean("pureVeg")
            ?: (doc.get("dietary") as? Map<*, *>)?.get("isPureVeg") as? Boolean
            ?: cuisinesList.any { it.contains("pure veg", ignoreCase = true) }

        // Dynamic open status calculation
        val calculatedOpen = if (businessHours != null) {
            OperatingHoursEngine.isOpenNow(businessHours, timezone)
        } else {
            doc.getBoolean("isOpen")
        }

        return Restaurant(
            id = doc.id,
            name = doc.getString("name") ?: doc.getString("restaurantName") ?: "Restaurant",
            description = doc.getString("description") ?: "",
            address = fullAddress,
            locality = locality,
            city = city,
            cuisines = cuisinesList,
            rating = doc.getDouble("rating") ?: doc.getDouble("averageRating"), // null if unrated
            reviewCount = (doc.getLong("reviewCount") ?: doc.getLong("totalReviews") ?: 0).toInt(),
            imageUrl = doc.getString("imageUrl") ?: doc.getString("coverImage") ?: "",
            logoUrl = doc.getString("logoUrl") ?: doc.getString("logo") ?: "",
            isOpen = calculatedOpen,
            priceForTwo = (doc.getLong("priceForTwo") ?: doc.getLong("costForTwo"))?.toInt(),
            priceTier = doc.getString("priceTier") ?: doc.getString("priceRange"),
            isPureVeg = isPureVeg,
            businessHours = businessHours,
            timezone = timezone,
            latitude = lat,
            longitude = lon,
            googleMapsUrl = doc.getString("googleMapsUrl"),
            activeOffersCount = (doc.getLong("activeOffersCount") ?: doc.getLong("offersCount") ?: 0).toInt(),
            activeOfferBadge = doc.getString("activeOfferBadge") ?: doc.getString("offerBadge"),
            taxPercent = doc.getDouble("taxPercent") ?: doc.getDouble("taxRate") ?: 5.0,
            serviceChargePercent = doc.getDouble("serviceChargePercent") ?: 5.0,
            phone = doc.getString("phone") ?: "",
            isDemoFallback = false,
            supportsTableBooking = doc.getBoolean("supportsTableBooking") ?: true,
            bookingConfig = run {
                val bookingConfigMap = (settingsMap?.get("bookingConfig") as? Map<*, *>) ?: (doc.get("bookingConfig") as? Map<*, *>)
                val availableTimeSlotsRaw = (doc.get("availableTimeSlots") as? List<*>)
                    ?: (settingsMap?.get("availableTimeSlots") as? List<*>)
                    ?: (bookingConfigMap?.get("availableTimeSlots") as? List<*>)
                val availableSlots = availableTimeSlotsRaw?.filterIsInstance<String>()
                    ?: listOf("12:00 PM", "1:00 PM", "2:00 PM", "7:00 PM", "8:00 PM", "9:00 PM")
                
                val supportedZonesRaw = (doc.get("supportedSeatZones") as? List<*>)
                    ?: (bookingConfigMap?.get("supportedSeatZones") as? List<*>)
                val supportedZones = supportedZonesRaw?.filterIsInstance<String>() ?: emptyList()
                
                val maxG = (doc.getLong("maxGuests")
                    ?: (bookingConfigMap?.get("maxGuests") as? Number)?.toLong()
                    ?: 8L).toInt()
                
                val supportsSeatPref = doc.getBoolean("supportsSeatPreference")
                    ?: (bookingConfigMap?.get("supportsSeatPreference") as? Boolean)
                    ?: false

                com.spiralworld.spiraldine.data.model.BookingConfig(
                    supportsSeatPreference = supportsSeatPref,
                    supportedSeatZones = supportedZones,
                    availableTimeSlots = availableSlots,
                    maxGuests = maxG
                )
            }
        )
    }

    private fun getFallbackRestaurants(): List<Restaurant> {
        return listOf(
            Restaurant(
                id = "bawarchi-restaurant",
                name = "Bawarchi Restaurant",
                description = "Legendary Hyderabadi Dum Biryani & Mughlai Specialities",
                address = "RTC X Roads, Chikkadpally, Hyderabad",
                locality = "RTC X Roads",
                city = "Hyderabad",
                cuisines = listOf("Biryani", "North Indian", "Mughlai", "Kebabs"),
                rating = null, // No fake ratings for demo fallback
                reviewCount = 0,
                imageUrl = "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800&auto=format&fit=crop",
                isOpen = true,
                priceForTwo = 650,
                businessHours = BusinessHours(
                    openingTime = "11:30",
                    closingTime = "23:30",
                    workingDays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
                ),
                latitude = 17.4065,
                longitude = 78.4983,
                isDemoFallback = true
            ),
            Restaurant(
                id = "paradise-biryani",
                name = "Paradise Food Court",
                description = "World famous Hyderabadi cuisine since 1953",
                address = "MG Road, Secunderabad",
                locality = "Secunderabad",
                city = "Hyderabad",
                cuisines = listOf("Biryani", "Hyderabadi", "Desserts"),
                rating = null,
                reviewCount = 0,
                imageUrl = "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=800&auto=format&fit=crop",
                isOpen = true,
                priceForTwo = 700,
                businessHours = BusinessHours(
                    openingTime = "11:00",
                    closingTime = "23:00",
                    workingDays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
                ),
                latitude = 17.4411,
                longitude = 78.4870,
                isDemoFallback = true
            ),
            Restaurant(
                id = "chutneys-coffee",
                name = "Chutneys Pure Veg",
                description = "Finest South Indian tiffins & six signature chutneys",
                address = "Road No. 3, Banjara Hills, Hyderabad",
                locality = "Banjara Hills",
                city = "Hyderabad",
                cuisines = listOf("South Indian", "Pure Veg", "Breakfast"),
                rating = null,
                reviewCount = 0,
                imageUrl = "https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?q=80&w=800&auto=format&fit=crop",
                isOpen = true,
                priceForTwo = 450,
                isPureVeg = true,
                businessHours = BusinessHours(
                    openingTime = "07:00",
                    closingTime = "22:30",
                    workingDays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
                ),
                latitude = 17.4156,
                longitude = 78.4350,
                isDemoFallback = true
            )
        )
    }
}
