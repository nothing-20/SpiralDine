package com.spiralworld.spiraldine.data.repository

import com.spiralworld.spiraldine.data.model.CartItem
import com.spiralworld.spiraldine.data.model.CartPricing
import com.spiralworld.spiraldine.data.model.Promotion
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

object BillCalculator {

    /**
     * Authoritative calculation engine matching SpiralDine serverless backend (/api/orders/create).
     * Prevents floating point inaccuracies and validates coupon eligibility deterministically.
     */
    fun calculate(
        cartItems: List<CartItem>,
        promotion: Promotion? = null,
        taxPercent: Double = 5.0,
        serviceChargePercent: Double = 5.0,
        isDineIn: Boolean = true,
        currentTimeMillis: Long = System.currentTimeMillis()
    ): CartPricing {
        if (cartItems.isEmpty()) {
            return CartPricing(
                subtotal = 0.0,
                discount = 0.0,
                taxableAmount = 0.0,
                tax = 0.0,
                taxPercent = taxPercent,
                serviceCharge = 0.0,
                serviceChargePercent = serviceChargePercent,
                total = 0.0
            )
        }

        // 1. Calculate Authoritative Subtotal
        val subtotal = cartItems.sumOf { it.lineTotal }

        // 2. Validate Promotion and Compute Discount
        val discount = if (promotion != null) {
            calculateDiscount(promotion, cartItems, subtotal, currentTimeMillis)
        } else {
            0.0
        }

        // 3. Taxable Base
        val taxableAmount = max(0.0, subtotal - discount)

        // 4. Configured Tax (rounded to nearest integer currency unit)
        val safeTaxPercent = max(0.0, taxPercent)
        val tax = ((taxableAmount * (safeTaxPercent / 100.0)) * 100.0).roundToInt() / 100.0

        // 5. Configured Service Charge (dine-in only, rounded)
        val safeServicePercent = if (isDineIn) max(0.0, serviceChargePercent) else 0.0
        val serviceCharge = ((taxableAmount * (safeServicePercent / 100.0)) * 100.0).roundToInt() / 100.0

        // 6. Authoritative Final Total
        val total = ((taxableAmount + tax + serviceCharge) * 100.0).roundToInt() / 100.0

        return CartPricing(
            subtotal = subtotal,
            discount = discount,
            taxableAmount = taxableAmount,
            tax = tax,
            taxPercent = safeTaxPercent,
            serviceCharge = serviceCharge,
            serviceChargePercent = safeServicePercent,
            total = total
        )
    }

    /**
     * Determines whether a promotion is eligible for the current cart and returns the discount amount.
     * Returns 0.0 if any eligibility rule fails.
     */
    fun calculateDiscount(
        promotion: Promotion,
        cartItems: List<CartItem>,
        subtotal: Double,
        currentTimeMillis: Long = System.currentTimeMillis()
    ): Double {
        // Status check
        if (!promotion.status.equals("active", ignoreCase = true)) {
            return 0.0
        }

        // Date bounds check
        if (!isDateActive(promotion.startDate, promotion.endDate, currentTimeMillis)) {
            return 0.0
        }

        // Global usage limit check
        if (promotion.globalUsageLimit != null && promotion.globalUsageLimit > 0) {
            if (promotion.redemptionCount >= promotion.globalUsageLimit) {
                return 0.0
            }
        }

        // Minimum order subtotal check
        val minOrder = promotion.effectiveMinOrder
        if (minOrder > 0.0 && subtotal < minOrder) {
            return 0.0
        }

        // Item & Category Scoping
        val hasItemScope = promotion.applicableItemIds.isNotEmpty()
        val hasCategoryScope = promotion.applicableCategoryIds.isNotEmpty()

        val eligibleSubtotal = if (hasItemScope || hasCategoryScope) {
            cartItems.sumOf { cartItem ->
                val itemMatch = hasItemScope && promotion.applicableItemIds.contains(cartItem.item.id)
                val catMatch = hasCategoryScope && (
                    promotion.applicableCategoryIds.contains(cartItem.item.category) ||
                    promotion.applicableCategoryIds.contains(cartItem.item.categoryId)
                )
                if (itemMatch || catMatch) cartItem.lineTotal else 0.0
            }
        } else {
            subtotal
        }

        if (eligibleSubtotal <= 0.0) {
            return 0.0
        }

        val isPercent = promotion.type.equals("percentage", ignoreCase = true) ||
                promotion.type.equals("PERCENTAGE", ignoreCase = true)

        var discount = if (isPercent) {
            ((eligibleSubtotal * (promotion.effectiveDiscountValue / 100.0)) * 100.0).roundToInt() / 100.0
        } else {
            min(eligibleSubtotal, promotion.effectiveDiscountValue)
        }

        // Maximum discount cap
        if (promotion.maxDiscountAmount > 0.0 && discount > promotion.maxDiscountAmount) {
            discount = promotion.maxDiscountAmount
        }

        return min(subtotal, max(0.0, discount))
    }

    private fun isDateActive(startDateStr: String?, endDateStr: String?, currentTimeMillis: Long): Boolean {
        if (!startDateStr.isNullOrBlank()) {
            val startMs = parseIsoDate(startDateStr)
            if (startMs != null && currentTimeMillis < startMs) {
                return false
            }
        }
        if (!endDateStr.isNullOrBlank()) {
            val endMs = parseIsoDate(endDateStr)
            if (endMs != null && currentTimeMillis > endMs) {
                return false
            }
        }
        return true
    }

    private fun parseIsoDate(isoStr: String): Long? {
        val formats = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd"
        )
        for (pattern in formats) {
            try {
                val sdf = SimpleDateFormat(pattern, Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }
                val date = sdf.parse(isoStr)
                if (date != null) return date.time
            } catch (_: Exception) {}
        }
        return null
    }
}
