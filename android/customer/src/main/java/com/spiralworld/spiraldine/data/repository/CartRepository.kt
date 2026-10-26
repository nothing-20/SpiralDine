package com.spiralworld.spiraldine.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.spiralworld.spiraldine.data.model.Addon
import com.spiralworld.spiraldine.data.model.CartItem
import com.spiralworld.spiraldine.data.model.CartPricing
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.Promotion
import com.spiralworld.spiraldine.data.model.Variant
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject

sealed class CartAddResult {
    object Success : CartAddResult()
    data class CrossRestaurantConflict(val existingTenantId: String, val newTenantId: String) : CartAddResult()
}

class CartRepository(context: Context? = null) {

    private val prefs: SharedPreferences? = try {
        context?.getSharedPreferences("spiraldine_customer_cart", Context.MODE_PRIVATE)
    } catch (_: Exception) {
        null
    }

    private val _items = MutableStateFlow<List<CartItem>>(emptyList())
    val items: StateFlow<List<CartItem>> = _items.asStateFlow()

    private val _activeTenantId = MutableStateFlow<String?>(null)
    val activeTenantId: StateFlow<String?> = _activeTenantId.asStateFlow()

    private val _appliedPromotion = MutableStateFlow<Promotion?>(null)
    val appliedPromotion: StateFlow<Promotion?> = _appliedPromotion.asStateFlow()

    private val _taxPercent = MutableStateFlow(5.0)
    private val _serviceChargePercent = MutableStateFlow(5.0)

    init {
        loadPersistedCart()
    }

    fun setRestaurantRates(taxPercent: Double, serviceChargePercent: Double) {
        _taxPercent.value = taxPercent
        _serviceChargePercent.value = serviceChargePercent
    }

    /**
     * Checks if an item from the given restaurant can be added without cross-tenant conflict.
     */
    fun canAddItemFromTenant(tenantId: String): Boolean {
        val currentTenant = _activeTenantId.value
        return _items.value.isEmpty() || currentTenant == null || currentTenant == tenantId
    }

    /**
     * Checks if the cart currently contains items belonging to a different restaurant.
     */
    fun hasCrossTenantItems(tenantId: String): Boolean {
        val currentTenant = _activeTenantId.value
        return _items.value.isNotEmpty() && currentTenant != null && !currentTenant.equals(tenantId, ignoreCase = true)
    }

    /**
     * Add an item to the basket with fine-grained customization support.
     * Preserves existing line identity and prevents cross-restaurant cart mixing.
     */
    fun addItem(
        item: MenuItem,
        tenantId: String,
        count: Int = 1,
        variant: Variant? = null,
        addons: List<Addon> = emptyList(),
        notes: String = ""
    ): CartAddResult {
        // Enforce restaurant isolation without silent data loss
        if (!canAddItemFromTenant(tenantId)) {
            return CartAddResult.CrossRestaurantConflict(
                existingTenantId = _activeTenantId.value ?: "",
                newTenantId = tenantId
            )
        }

        _activeTenantId.value = tenantId

        val targetItem = CartItem(
            item = item,
            count = count,
            selectedVariant = variant,
            selectedAddons = addons,
            notes = notes.trim()
        )

        val currentList = _items.value.toMutableList()
        // Line identity: exact match on item ID, variant, sorted addons, and notes
        val existingIndex = currentList.indexOfFirst { it.lineId == targetItem.lineId }

        if (existingIndex != -1) {
            val existing = currentList[existingIndex]
            val newCount = (existing.count + count).coerceAtMost(100)
            currentList[existingIndex] = existing.copy(count = newCount)
        } else {
            currentList.add(targetItem)
        }

        _items.value = currentList
        revalidateCoupon()
        persistCart()
        return CartAddResult.Success
    }

    /**
     * Clears cross-restaurant cart and adds item from the newly selected restaurant upon user confirmation.
     */
    fun clearAndAddItem(
        item: MenuItem,
        tenantId: String,
        count: Int = 1,
        variant: Variant? = null,
        addons: List<Addon> = emptyList(),
        notes: String = ""
    ) {
        clearCart()
        addItem(item, tenantId, count, variant, addons, notes)
    }

    /**
     * Update quantity of a specific cart line by its unique lineId.
     */
    fun updateCountByLineId(lineId: String, newCount: Int) {
        if (newCount <= 0) {
            removeItem(lineId)
            return
        }
        val safeCount = newCount.coerceAtMost(100)
        val currentList = _items.value.map {
            if (it.lineId == lineId) it.copy(count = safeCount) else it
        }
        _items.value = currentList
        revalidateCoupon()
        persistCart()
    }

    /**
     * Updates count of a line by lineId (preferred) or itemId.
     */
    fun updateCount(identifier: String, newCount: Int) {
        if (newCount <= 0) {
            removeItem(identifier)
            return
        }
        val currentList = _items.value.toMutableList()
        // Match lineId first; fallback to item.id
        val lineIndex = currentList.indexOfFirst { it.lineId == identifier }
        val targetIndex = if (lineIndex != -1) lineIndex else currentList.indexOfFirst { it.item.id == identifier }

        if (targetIndex != -1) {
            val existing = currentList[targetIndex]
            currentList[targetIndex] = existing.copy(count = newCount.coerceAtMost(100))
            _items.value = currentList
            revalidateCoupon()
            persistCart()
        }
    }

    /**
     * Remove a specific cart line by lineId or all lines matching itemId.
     */
    fun removeItem(identifier: String) {
        val hasLineIdMatch = _items.value.any { it.lineId == identifier }
        _items.value = if (hasLineIdMatch) {
            _items.value.filterNot { it.lineId == identifier }
        } else {
            _items.value.filterNot { it.item.id == identifier }
        }
        if (_items.value.isEmpty()) {
            _appliedPromotion.value = null
            _activeTenantId.value = null
        } else {
            revalidateCoupon()
        }
        persistCart()
    }

    fun clearCart() {
        _items.value = emptyList()
        _appliedPromotion.value = null
        _activeTenantId.value = null
        persistCart()
    }

    /**
     * Apply a coupon promotion and return authoritative discount preview.
     */
    fun applyCoupon(promo: Promotion): Result<Double> {
        val currentSubtotal = calculateSubtotal()
        val minOrder = promo.effectiveMinOrder
        if (minOrder > 0 && currentSubtotal < minOrder) {
            return Result.failure(Exception("Minimum order subtotal of ₹${minOrder.toInt()} required for coupon ${promo.effectiveCode}"))
        }

        val discount = BillCalculator.calculateDiscount(promo, _items.value, currentSubtotal)
        if (discount <= 0) {
            return Result.failure(Exception("Coupon ${promo.effectiveCode} is not applicable to items in your cart"))
        }

        _appliedPromotion.value = promo
        persistCart()
        return Result.success(discount)
    }

    fun removeCoupon() {
        _appliedPromotion.value = null
        persistCart()
    }

    private fun revalidateCoupon() {
        val promo = _appliedPromotion.value ?: return
        val subtotal = calculateSubtotal()
        val discount = BillCalculator.calculateDiscount(promo, _items.value, subtotal)
        if (discount <= 0) {
            _appliedPromotion.value = null
        }
    }

    fun calculateSubtotal(): Double {
        return _items.value.sumOf { it.lineTotal }
    }

    fun calculateDiscount(): Double {
        val promo = _appliedPromotion.value ?: return 0.0
        val subtotal = calculateSubtotal()
        return BillCalculator.calculateDiscount(promo, _items.value, subtotal)
    }

    fun getPricing(): CartPricing {
        return BillCalculator.calculate(
            cartItems = _items.value,
            promotion = _appliedPromotion.value,
            taxPercent = _taxPercent.value,
            serviceChargePercent = _serviceChargePercent.value,
            isDineIn = true
        )
    }

    // ==========================================
    // Safe SharedPreferences Persistence (JSON)
    // ==========================================

    private fun persistCart() {
        val p = prefs ?: return
        try {
            val tenant = _activeTenantId.value
            if (_items.value.isEmpty() || tenant.isNullOrBlank()) {
                p.edit().clear().apply()
                return
            }

            val jsonArray = JSONArray()
            _items.value.forEach { cartItem ->
                val obj = JSONObject().apply {
                    put("itemId", cartItem.item.id)
                    put("name", cartItem.item.name)
                    put("price", cartItem.item.price)
                    put("discountPrice", cartItem.item.discountPrice ?: JSONObject.NULL)
                    put("category", cartItem.item.category)
                    put("categoryId", cartItem.item.categoryId)
                    put("isVeg", cartItem.item.isVeg)
                    put("imageUrl", cartItem.item.imageUrl)
                    put("count", cartItem.count)
                    put("notes", cartItem.notes)

                    if (cartItem.selectedVariant != null) {
                        val vObj = JSONObject().apply {
                            put("id", cartItem.selectedVariant.id)
                            put("name", cartItem.selectedVariant.name)
                            put("price", cartItem.selectedVariant.price)
                            put("isAvailable", cartItem.selectedVariant.isAvailable)
                        }
                        put("variant", vObj)
                    }

                    if (cartItem.selectedAddons.isNotEmpty()) {
                        val aArray = JSONArray()
                        cartItem.selectedAddons.forEach { addon ->
                            val aObj = JSONObject().apply {
                                put("id", addon.id)
                                put("name", addon.name)
                                put("price", addon.price)
                                put("isAvailable", addon.isAvailable)
                            }
                            aArray.put(aObj)
                        }
                        put("addons", aArray)
                    }
                }
                jsonArray.put(obj)
            }

            p.edit()
                .putString("activeTenantId", tenant)
                .putString("cartItemsJson", jsonArray.toString())
                .apply()
        } catch (_: Exception) {
            // Safe fallback: do not crash on storage errors
        }
    }

    private fun loadPersistedCart() {
        val p = prefs ?: return
        try {
            val tenant = p.getString("activeTenantId", null) ?: return
            val jsonStr = p.getString("cartItemsJson", null) ?: return
            val jsonArray = JSONArray(jsonStr)

            val loadedItems = mutableListOf<CartItem>()
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)

                val variants = mutableListOf<Variant>()
                var selectedVariant: Variant? = null
                if (obj.has("variant") && !obj.isNull("variant")) {
                    val vObj = obj.getJSONObject("variant")
                    val v = Variant(
                        id = vObj.getString("id"),
                        name = vObj.getString("name"),
                        price = vObj.getDouble("price"),
                        isAvailable = vObj.optBoolean("isAvailable", true)
                    )
                    variants.add(v)
                    selectedVariant = v
                }

                val addons = mutableListOf<Addon>()
                if (obj.has("addons") && !obj.isNull("addons")) {
                    val aArray = obj.getJSONArray("addons")
                    for (j in 0 until aArray.length()) {
                        val aObj = aArray.getJSONObject(j)
                        addons.add(
                            Addon(
                                id = aObj.getString("id"),
                                name = aObj.getString("name"),
                                price = aObj.getDouble("price"),
                                isAvailable = aObj.optBoolean("isAvailable", true)
                            )
                        )
                    }
                }

                val discountPriceVal = if (obj.has("discountPrice") && !obj.isNull("discountPrice")) {
                    obj.getDouble("discountPrice")
                } else null

                val item = MenuItem(
                    id = obj.getString("itemId"),
                    name = obj.getString("name"),
                    price = obj.getDouble("price"),
                    discountPrice = discountPriceVal,
                    category = obj.optString("category", "Mains"),
                    categoryId = obj.optString("categoryId", ""),
                    isVeg = obj.optBoolean("isVeg", false),
                    imageUrl = obj.optString("imageUrl", ""),
                    variants = variants,
                    addons = addons
                )

                loadedItems.add(
                    CartItem(
                        item = item,
                        count = obj.getInt("count"),
                        selectedVariant = selectedVariant,
                        selectedAddons = addons,
                        notes = obj.optString("notes", "")
                    )
                )
            }

            _activeTenantId.value = tenant
            _items.value = loadedItems
        } catch (_: Exception) {
            // Corrupted or outdated data: recover safely with clean cart
            _items.value = emptyList()
            _activeTenantId.value = null
        }
    }
}
