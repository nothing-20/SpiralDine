package com.spiralworld.spiraldine.data.repository

import android.util.Log
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.spiralworld.spiraldine.data.model.Addon
import com.spiralworld.spiraldine.data.model.MenuCategory
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.Promotion
import com.spiralworld.spiraldine.data.model.Variant
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

class MenuRepository(
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    constructor(firestore: FirebaseFirestore) : this({ firestore })

    fun getCategories(tenantId: String): Flow<List<MenuCategory>> = callbackFlow {
        if (tenantId.isBlank()) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }
        val listener = firestore.collection("restaurants").document(tenantId)
            .collection("menu").document("default")
            .collection("categories")
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null || snapshot.isEmpty) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                val list = snapshot.documents.mapNotNull { doc ->
                    try {
                        parseCategoryDocument(doc)
                    } catch (e: Exception) {
                        Log.w("MenuRepository", "Skipping malformed category document ${doc.id}: ${e.message}")
                        null
                    }
                }.sortedBy { it.displayOrder }

                trySend(list)
            }

        awaitClose { listener.remove() }
    }

    fun getMenuItems(tenantId: String): Flow<List<MenuItem>> = callbackFlow {
        if (tenantId.isBlank()) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }
        val listener = firestore.collection("restaurants").document(tenantId)
            .collection("menu").document("default")
            .collection("items")
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null || snapshot.isEmpty) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                val items = snapshot.documents.mapNotNull { doc ->
                    try {
                        parseMenuItemDocument(doc)
                    } catch (e: Exception) {
                        Log.w("MenuRepository", "Skipping malformed menu item document ${doc.id}: ${e.message}")
                        null
                    }
                }

                trySend(items)
            }

        awaitClose { listener.remove() }
    }

    fun getPromotions(tenantId: String): Flow<List<Promotion>> = callbackFlow {
        if (tenantId.isBlank()) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }
        val listener = firestore.collection("restaurants").document(tenantId)
            .collection("promotions")
            .addSnapshotListener { snapshot, error ->
                if (error != null || snapshot == null || snapshot.isEmpty) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }

                val list = snapshot.documents.mapNotNull { doc ->
                    try {
                        parsePromotionDocument(doc)
                    } catch (e: Exception) {
                        Log.w("MenuRepository", "Skipping malformed promotion document ${doc.id}: ${e.message}")
                        null
                    }
                }

                trySend(list)
            }

        awaitClose { listener.remove() }
    }

    companion object {
        fun parseCategoryDocument(doc: DocumentSnapshot): MenuCategory {
            return MenuCategory(
                id = doc.id,
                name = FirestoreFieldParser.safeString(doc, "name", fallback = "Category"),
                displayOrder = FirestoreFieldParser.safeInt(doc, "displayOrder", fallback = 0)
            )
        }

        fun parseMenuItemData(id: String, data: Map<String, Any?>): MenuItem? {
            val rawPub = data["isPublished"] ?: data["published"]
            val rawStatus = data["status"] as? String
            val isPublished = when (rawPub) {
                is Boolean -> rawPub
                is String -> !rawPub.equals("false", ignoreCase = true)
                is Number -> rawPub.toInt() != 0
                null -> !rawStatus.equals("unpublished", ignoreCase = true) && !rawStatus.equals("draft", ignoreCase = true)
                else -> true
            }
            if (!isPublished) return null

            val variantsRaw = data["variants"] as? List<*>
            val variants = variantsRaw?.mapNotNull { v ->
                val vm = v as? Map<*, *> ?: return@mapNotNull null
                val vPrice = when (val p = vm["price"]) {
                    is Number -> p.toDouble()
                    is String -> p.toDoubleOrNull() ?: 0.0
                    else -> 0.0
                }
                val vAvail = when (val a = vm["isAvailable"]) {
                    is Boolean -> a
                    is String -> !a.equals("false", ignoreCase = true)
                    is Number -> a.toInt() != 0
                    else -> true
                }
                Variant(
                    id = vm["id"]?.toString() ?: "",
                    name = vm["name"]?.toString() ?: "",
                    price = vPrice,
                    isAvailable = vAvail
                )
            } ?: emptyList()

            val addonsRaw = data["addons"] as? List<*>
            val addons = addonsRaw?.mapNotNull { a ->
                val am = a as? Map<*, *> ?: return@mapNotNull null
                val aPrice = when (val p = am["price"]) {
                    is Number -> p.toDouble()
                    is String -> p.toDoubleOrNull() ?: 0.0
                    else -> 0.0
                }
                val aAvail = when (val av = am["isAvailable"]) {
                    is Boolean -> av
                    is String -> !av.equals("false", ignoreCase = true)
                    is Number -> av.toInt() != 0
                    else -> true
                }
                Addon(
                    id = am["id"]?.toString() ?: "",
                    name = am["name"]?.toString() ?: "",
                    price = aPrice,
                    isAvailable = aAvail
                )
            } ?: emptyList()

            val price = FirestoreFieldParser.safeDouble(data, "price", "cost", fallback = 0.0)
            val discountPriceRaw = FirestoreFieldParser.safeDouble(data, "discountPrice", fallback = -1.0)
            val discountPrice = if (discountPriceRaw > 0) discountPriceRaw else null

            val (prepTimeString, prepTimeMins) = FirestoreFieldParser.parsePreparationTime(data)

            val rawVeg = data["isVeg"] ?: data["veg"] ?: data["vegetarian"]
            val foodType = data["foodType"]?.toString()
            val isVeg = when {
                rawVeg is Boolean -> rawVeg
                rawVeg is String -> rawVeg.equals("true", ignoreCase = true) || rawVeg.equals("veg", ignoreCase = true)
                rawVeg is Number -> rawVeg.toInt() == 1
                foodType != null -> foodType.equals("veg", ignoreCase = true)
                else -> false
            }

            val rawAvail = data["isAvailable"] ?: data["available"]
            val isAvailable = when (rawAvail) {
                is Boolean -> rawAvail
                is String -> !rawAvail.equals("false", ignoreCase = true) && !rawAvail.equals("sold_out", ignoreCase = true)
                is Number -> rawAvail.toInt() != 0
                null -> true
                else -> true
            }

            return MenuItem(
                id = id,
                name = FirestoreFieldParser.safeString(data, "name", fallback = "Dish"),
                description = FirestoreFieldParser.safeString(data, "description"),
                price = price,
                discountPrice = discountPrice,
                categoryId = FirestoreFieldParser.safeString(data, "categoryId"),
                category = FirestoreFieldParser.safeString(data, "category", fallback = "Mains"),
                isVeg = isVeg,
                imageUrl = FirestoreFieldParser.safeString(data, "imageUrl", "image"),
                isAvailable = isAvailable,
                isPublished = isPublished,
                preparationTime = prepTimeString,
                preparationTimeMinutes = prepTimeMins,
                variants = variants,
                addons = addons
            )
        }

        fun parseMenuItemDocument(doc: DocumentSnapshot): MenuItem? {
            val data = try { doc.data } catch (_: Exception) { null }
            if (data != null) {
                return parseMenuItemData(doc.id, data)
            }

            val rawPub = try { doc.get("isPublished") ?: doc.get("published") } catch (_: Exception) { null }
            val rawStatus = try { doc.get("status") as? String } catch (_: Exception) { null }
            val isPublished = when (rawPub) {
                is Boolean -> rawPub
                is String -> !rawPub.equals("false", ignoreCase = true)
                is Number -> rawPub.toInt() != 0
                null -> !rawStatus.equals("unpublished", ignoreCase = true) && !rawStatus.equals("draft", ignoreCase = true)
                else -> true
            }
            if (!isPublished) return null

            val variantsRaw = try { doc.get("variants") as? List<*> } catch (_: Exception) { null }
            val variants = variantsRaw?.mapNotNull { v ->
                val vm = v as? Map<*, *> ?: return@mapNotNull null
                val vPrice = when (val p = vm["price"]) {
                    is Number -> p.toDouble()
                    is String -> p.toDoubleOrNull() ?: 0.0
                    else -> 0.0
                }
                val vAvail = when (val a = vm["isAvailable"]) {
                    is Boolean -> a
                    is String -> !a.equals("false", ignoreCase = true)
                    is Number -> a.toInt() != 0
                    else -> true
                }
                Variant(
                    id = vm["id"]?.toString() ?: "",
                    name = vm["name"]?.toString() ?: "",
                    price = vPrice,
                    isAvailable = vAvail
                )
            } ?: emptyList()

            val addonsRaw = try { doc.get("addons") as? List<*> } catch (_: Exception) { null }
            val addons = addonsRaw?.mapNotNull { a ->
                val am = a as? Map<*, *> ?: return@mapNotNull null
                val aPrice = when (val p = am["price"]) {
                    is Number -> p.toDouble()
                    is String -> p.toDoubleOrNull() ?: 0.0
                    else -> 0.0
                }
                val aAvail = when (val av = am["isAvailable"]) {
                    is Boolean -> av
                    is String -> !av.equals("false", ignoreCase = true)
                    is Number -> av.toInt() != 0
                    else -> true
                }
                Addon(
                    id = am["id"]?.toString() ?: "",
                    name = am["name"]?.toString() ?: "",
                    price = aPrice,
                    isAvailable = aAvail
                )
            } ?: emptyList()

            val price = FirestoreFieldParser.safeDouble(doc, "price", "cost", fallback = 0.0)
            val discountPriceRaw = FirestoreFieldParser.safeDouble(doc, "discountPrice", fallback = -1.0)
            val discountPrice = if (discountPriceRaw > 0) discountPriceRaw else null

            val (prepTimeString, prepTimeMins) = FirestoreFieldParser.parsePreparationTime(doc)

            val rawVeg = try { doc.get("isVeg") ?: doc.get("veg") ?: doc.get("vegetarian") } catch (_: Exception) { null }
            val foodType = try { doc.get("foodType")?.toString() } catch (_: Exception) { null }
            val isVeg = when {
                rawVeg is Boolean -> rawVeg
                rawVeg is String -> rawVeg.equals("true", ignoreCase = true) || rawVeg.equals("veg", ignoreCase = true)
                rawVeg is Number -> rawVeg.toInt() == 1
                foodType != null -> foodType.equals("veg", ignoreCase = true)
                else -> false
            }

            val rawAvail = try { doc.get("isAvailable") ?: doc.get("available") } catch (_: Exception) { null }
            val isAvailable = when (rawAvail) {
                is Boolean -> rawAvail
                is String -> !rawAvail.equals("false", ignoreCase = true) && !rawAvail.equals("sold_out", ignoreCase = true)
                is Number -> rawAvail.toInt() != 0
                null -> true
                else -> true
            }

            return MenuItem(
                id = doc.id,
                name = FirestoreFieldParser.safeString(doc, "name", fallback = "Dish"),
                description = FirestoreFieldParser.safeString(doc, "description"),
                price = price,
                discountPrice = discountPrice,
                categoryId = FirestoreFieldParser.safeString(doc, "categoryId"),
                category = FirestoreFieldParser.safeString(doc, "category", fallback = "Mains"),
                isVeg = isVeg,
                imageUrl = FirestoreFieldParser.safeString(doc, "imageUrl", "image"),
                isAvailable = isAvailable,
                isPublished = isPublished,
                preparationTime = prepTimeString,
                preparationTimeMinutes = prepTimeMins,
                variants = variants,
                addons = addons
            )
        }

        fun parsePromotionDocument(doc: DocumentSnapshot): Promotion? {
            val status = FirestoreFieldParser.safeString(doc, "status", fallback = "active").lowercase()
            if (status != "active") return null

            val placementsRaw = try { doc.get("placements") as? List<*> } catch (_: Exception) { null }
            val placements = placementsRaw?.filterIsInstance<String>()
                ?: listOf(FirestoreFieldParser.safeString(doc, "placement", fallback = "restaurant_menu"))

            val applicableItemIds = (try { doc.get("applicableItemIds") as? List<*> } catch (_: Exception) { null })
                ?.filterIsInstance<String>() ?: emptyList()
            val applicableCategoryIds = (try { doc.get("applicableCategoryIds") as? List<*> } catch (_: Exception) { null })
                ?.filterIsInstance<String>() ?: emptyList()

            val type = FirestoreFieldParser.safeString(doc, "type", "discountType", fallback = "percentage")
            val value = FirestoreFieldParser.safeDouble(doc, "value", "percentage", fallback = 0.0)
            val discountVal = FirestoreFieldParser.safeDouble(doc, "discountValue", "value", fallback = value)
            val code = FirestoreFieldParser.safeString(doc, "code", "couponCode", fallback = "")
            val couponCode = FirestoreFieldParser.safeString(doc, "couponCode", "code", fallback = code)

            return Promotion(
                id = doc.id,
                name = FirestoreFieldParser.safeString(doc, "name", "title", fallback = "Offer"),
                description = FirestoreFieldParser.safeString(doc, "description"),
                type = type,
                value = value,
                discountValue = discountVal,
                code = code,
                couponCode = couponCode,
                badgeText = FirestoreFieldParser.safeString(doc, "badgeText"),
                minOrderSubtotal = FirestoreFieldParser.safeDouble(doc, "minOrderSubtotal", "minOrderValue", fallback = 0.0),
                minOrderValue = FirestoreFieldParser.safeDouble(doc, "minOrderValue", "minOrderSubtotal", fallback = 0.0),
                maxDiscountAmount = FirestoreFieldParser.safeDouble(doc, "maxDiscountAmount", "maxDiscount", fallback = 0.0),
                placements = placements,
                applicableItemIds = applicableItemIds,
                applicableCategoryIds = applicableCategoryIds,
                status = status
            )
        }
    }

    private fun getFallbackCategories(): List<MenuCategory> {
        return listOf(
            MenuCategory("cat-biryani", "Biryani & Rice", 1),
            MenuCategory("cat-starters", "Kebabs & Starters", 2),
            MenuCategory("cat-curries", "Main Course Curries", 3),
            MenuCategory("cat-breads", "Breads & Naan", 4),
            MenuCategory("cat-beverages", "Drinks & Desserts", 5)
        )
    }

    private fun getFallbackMenuItems(): List<MenuItem> {
        return listOf(
            MenuItem(
                id = "item-biryani-chicken",
                name = "Special Hyderabadi Chicken Biryani",
                description = "Fragrant long-grain basmati rice layered with spiced tender chicken and fried onions",
                price = 340.0,
                discountPrice = 299.0,
                categoryId = "cat-biryani",
                category = "Biryani & Rice",
                isVeg = false,
                imageUrl = "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?q=80&w=800&auto=format&fit=crop",
                isAvailable = true,
                preparationTime = "15-20 min",
                preparationTimeMinutes = 18
            ),
            MenuItem(
                id = "item-biryani-mutton",
                name = "Royal Hyderabadi Mutton Biryani",
                description = "Slow dum cooked tender baby goat meat infused with secret house spices and saffron",
                price = 450.0,
                categoryId = "cat-biryani",
                category = "Biryani & Rice",
                isVeg = false,
                imageUrl = "https://images.unsplash.com/photo-1589302168068-964664d93dc0?q=80&w=800&auto=format&fit=crop",
                isAvailable = true,
                preparationTime = "20-25 min",
                preparationTimeMinutes = 22
            ),
            MenuItem(
                id = "item-paneer-tikka",
                name = "Tandoori Paneer Tikka",
                description = "Cubes of malai paneer marinated in hung curd, Kashmiri chilli and roasted in clay oven",
                price = 280.0,
                categoryId = "cat-starters",
                category = "Kebabs & Starters",
                isVeg = true,
                imageUrl = "https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?q=80&w=800&auto=format&fit=crop",
                isAvailable = true,
                preparationTime = "15 min",
                preparationTimeMinutes = 15
            ),
            MenuItem(
                id = "item-butter-chicken",
                name = "Murgh Makhani (Butter Chicken)",
                description = "Tandoor roasted shredded chicken simmered in rich creamy tomato and butter gravy",
                price = 360.0,
                categoryId = "cat-curries",
                category = "Main Course Curries",
                isVeg = false,
                imageUrl = "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?q=80&w=800&auto=format&fit=crop",
                isAvailable = true,
                preparationTime = "15 min",
                preparationTimeMinutes = 15
            ),
            MenuItem(
                id = "item-butter-naan",
                name = "Garlic Butter Naan",
                description = "Crisp, pillowy leavened flatbread brushed with crushed garlic and melted dairy butter",
                price = 65.0,
                categoryId = "cat-breads",
                category = "Breads & Naan",
                isVeg = true,
                imageUrl = "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?q=80&w=800&auto=format&fit=crop",
                isAvailable = true,
                preparationTime = "5-10 min",
                preparationTimeMinutes = 8
            ),
            MenuItem(
                id = "item-gulab-jamun",
                name = "Hot Gulab Jamun with Rabri",
                description = "Soft khoya dumplings steeped in aromatic green cardamom and rosewater syrup",
                price = 140.0,
                categoryId = "cat-beverages",
                category = "Drinks & Desserts",
                isVeg = true,
                imageUrl = "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?q=80&w=800&auto=format&fit=crop",
                isAvailable = true,
                preparationTime = "5 min",
                preparationTimeMinutes = 5
            )
        )
    }

    private fun getFallbackPromotions(tenantId: String): List<Promotion> {
        return listOf(
            Promotion(
                id = "promo-biryani20",
                name = "Biryani Fest - 20% OFF",
                description = "20% off on all Biryanis on orders above ₹199 (Max ₹150)",
                type = "percentage",
                value = 20.0,
                discountValue = 20.0,
                code = "TESTBIRYANI20",
                couponCode = "TESTBIRYANI20",
                badgeText = "20% OFF",
                minOrderSubtotal = 199.0,
                minOrderValue = 199.0,
                maxDiscountAmount = 150.0,
                placements = listOf("restaurant_menu", "cart_suggestion", "home_carousel"),
                applicableCategoryIds = listOf("cat-biryani"),
                status = "active"
            )
        )
    }
}
