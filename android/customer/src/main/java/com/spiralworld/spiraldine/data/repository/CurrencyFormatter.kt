package com.spiralworld.spiraldine.data.repository

import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Locale

/**
 * Centralized, authoritative monetary and currency formatting engine for SpiralDine Android customer app.
 * Guarantees zero decimal precision loss across:
 * - Menu display prices
 * - Cart totals and line items
 * - Quantity multiplication
 * - Taxes, service charges, and discounts
 * - Historical order items and totals
 * - Rupees <-> Paise conversions
 */
object CurrencyFormatter {

    /**
     * Formats an amount stored in paise/cents into a human-readable rupee currency string.
     * Matches the website's formatPrice(priceInCents: number) semantics.
     * E.g.
     * 650.0   -> "₹6.50"
     * 950.0   -> "₹9.50"
     * 1100.0  -> "₹11" (or "₹11.00" if forceDecimals = true)
     * 450.0   -> "₹4.50"
     * 31900.0 -> "₹319"
     * 5900.0  -> "₹59"
     * 7176.0  -> "₹71.76"
     */
    fun formatPrice(amountInPaise: Double, forceDecimals: Boolean = false): String {
        if (amountInPaise.isNaN() || amountInPaise.isInfinite()) return "₹0"
        val rupees = BigDecimal.valueOf(amountInPaise)
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
        return if (!forceDecimals && rupees.remainder(BigDecimal.ONE).compareTo(BigDecimal.ZERO) == 0) {
            "₹${rupees.toBigInteger()}"
        } else {
            String.format(Locale.US, "₹%.2f", rupees.toDouble())
        }
    }

    /**
     * Always shows 2 decimal places when formatting paise to rupees.
     * E.g. 1100.0 -> "₹11.00", 650.0 -> "₹6.50"
     */
    fun formatPriceExact(amountInPaise: Double): String {
        return formatPrice(amountInPaise, forceDecimals = true)
    }

    /**
     * Explicit alias for formatPrice clarifying that input is in paise.
     */
    fun formatPaise(amountInPaise: Double, forceDecimals: Boolean = false): String {
        return formatPrice(amountInPaise, forceDecimals)
    }

    /**
     * Formats rupee amounts into user-facing currency string preserving decimal precision.
     * E.g.
     * 99.50  -> "₹99.50"
     * 149.75 -> "₹149.75"
     * 249.99 -> "₹249.99"
     * 100.00 -> "₹100" (or "₹100.00" if forceDecimals = true)
     */
    fun formatRupees(amount: Double, forceDecimals: Boolean = false): String {
        if (amount.isNaN() || amount.isInfinite()) return "₹0"
        val bd = BigDecimal.valueOf(amount).setScale(2, RoundingMode.HALF_UP)
        return if (!forceDecimals && bd.remainder(BigDecimal.ONE).compareTo(BigDecimal.ZERO) == 0) {
            "₹${bd.toBigInteger()}"
        } else {
            String.format(Locale.US, "₹%.2f", bd.toDouble())
        }
    }

    /**
     * Always shows 2 decimal places regardless of whether fractional part is zero.
     * E.g. 100.0 -> "₹100.00", 99.5 -> "₹99.50"
     */
    fun formatRupeesExact(amount: Double): String {
        if (amount.isNaN() || amount.isInfinite()) return "₹0.00"
        val bd = BigDecimal.valueOf(amount).setScale(2, RoundingMode.HALF_UP)
        return String.format(Locale.US, "₹%.2f", bd.toDouble())
    }

    /**
     * Formats discount amounts with leading minus sign and decimal precision.
     * E.g. 15.5 -> "-₹15.50", 20.0 -> "-₹20"
     */
    fun formatDiscount(discountAmount: Double): String {
        if (discountAmount <= 0.0) return "₹0"
        return "-${formatRupees(discountAmount)}"
    }

    /**
     * Formats discount in paise with leading minus sign and decimal precision.
     * E.g. 1550.0 -> "-₹15.50"
     */
    fun formatDiscountPaise(discountAmountInPaise: Double): String {
        if (discountAmountInPaise <= 0.0) return "₹0"
        return "-${formatPrice(discountAmountInPaise)}"
    }

    /**
     * Converts a rupee amount to integer paise without floating point rounding errors.
     * E.g. 99.50 -> 9950L, 149.75 -> 14975L, 249.99 -> 24999L, 100.0 -> 10000L
     */
    fun rupeesToPaise(rupees: Double): Long {
        if (rupees.isNaN() || rupees.isInfinite()) return 0L
        return BigDecimal.valueOf(rupees)
            .multiply(BigDecimal.valueOf(100))
            .setScale(0, RoundingMode.HALF_UP)
            .toLong()
    }

    /**
     * Converts integer paise to rupee amount with 2 decimal places precision.
     * E.g. 9950L -> 99.50, 14975L -> 149.75, 24999L -> 249.99, 10000L -> 100.0
     */
    fun paiseToRupees(paise: Long): Double {
        return BigDecimal.valueOf(paise)
            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
            .toDouble()
    }

    /**
     * Multiplies unit price by quantity with exact decimal precision.
     * E.g. (99.50, 3) -> 298.50
     */
    fun multiplyPrice(unitPrice: Double, quantity: Int): Double {
        val qty = quantity.coerceAtLeast(0)
        return BigDecimal.valueOf(unitPrice)
            .multiply(BigDecimal.valueOf(qty.toLong()))
            .setScale(2, RoundingMode.HALF_UP)
            .toDouble()
    }
}
