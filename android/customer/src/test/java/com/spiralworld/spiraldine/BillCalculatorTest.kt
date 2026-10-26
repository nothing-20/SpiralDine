package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.CartItem
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.MenuItemAddon
import com.spiralworld.spiraldine.data.model.MenuItemVariant
import com.spiralworld.spiraldine.data.model.Promotion
import com.spiralworld.spiraldine.data.repository.BillCalculator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BillCalculatorTest {

    private val pizzaBase = MenuItem(
        id = "dish-pizza-1",
        name = "Farmhouse Pizza",
        price = 300.0,
        category = "Pizza",
        categoryId = "cat-pizza",
        restaurantId = "rest-italian"
    )

    private val drink = MenuItem(
        id = "dish-coke-1",
        name = "Cold Drink",
        price = 50.0,
        category = "Beverages",
        categoryId = "cat-drinks",
        restaurantId = "rest-italian"
    )

    private val mediumVariant = MenuItemVariant(id = "var-med", name = "Medium (10\")", price = 420.0)
    private val cheeseAddon = MenuItemAddon(id = "addon-cheese", name = "Extra Mozzarella", price = 60.0)
    private val olivesAddon = MenuItemAddon(id = "addon-olives", name = "Black Olives", price = 40.0)

    @Test
    fun emptyCart_returnsAllZeroes() {
        val result = BillCalculator.calculate(
            cartItems = emptyList(),
            taxPercent = 5.0,
            serviceChargePercent = 5.0
        )
        assertEquals(0.0, result.subtotal, 0.001)
        assertEquals(0.0, result.discount, 0.001)
        assertEquals(0.0, result.taxableAmount, 0.001)
        assertEquals(0.0, result.tax, 0.001)
        assertEquals(0.0, result.serviceCharge, 0.001)
        assertEquals(0.0, result.total, 0.001)
    }

    @Test
    fun standardItemCalculation_quantityMultiplication() {
        val cartItem = CartItem(
            item = pizzaBase,
            count = 3
        )
        val result = BillCalculator.calculate(
            cartItems = listOf(cartItem),
            taxPercent = 5.0,
            serviceChargePercent = 0.0 // no service charge
        )
        // 300 * 3 = 900
        assertEquals(900.0, result.subtotal, 0.001)
        assertEquals(0.0, result.discount, 0.001)
        assertEquals(900.0, result.taxableAmount, 0.001)
        // 5% of 900 = 45.0
        assertEquals(45.0, result.tax, 0.001)
        assertEquals(0.0, result.serviceCharge, 0.001)
        assertEquals(945.0, result.total, 0.001)
    }

    @Test
    fun variantAndAddonsPricing_incorporatedIntoLineTotal() {
        // Unit price = 420 (variant overrides base 300) + 60 (cheese) + 40 (olives) = 520.0
        val cartItem = CartItem(
            item = pizzaBase,
            count = 2,
            selectedVariant = mediumVariant,
            selectedAddons = listOf(cheeseAddon, olivesAddon)
        )
        assertEquals(520.0, cartItem.unitPrice, 0.001)
        assertEquals(1040.0, cartItem.lineTotal, 0.001)

        val result = BillCalculator.calculate(
            cartItems = listOf(cartItem),
            taxPercent = 18.0, // e.g. 18% GST tier
            serviceChargePercent = 5.0
        )
        assertEquals(1040.0, result.subtotal, 0.001)
        // 18% of 1040 = 187.20
        assertEquals(187.20, result.tax, 0.01)
        // 5% of 1040 = 52.00
        assertEquals(52.00, result.serviceCharge, 0.01)
        // Total = 1040 + 187.20 + 52.00 = 1279.20
        assertEquals(1279.20, result.total, 0.01)
    }

    @Test
    fun percentageDiscount_cappedAtMaxDiscount() {
        val cartItem = CartItem(item = pizzaBase, count = 4) // 1200 subtotal
        val promo = Promotion(
            id = "p-festive",
            name = "Festive 25% OFF",
            type = "percentage",
            value = 25.0,
            couponCode = "FESTIVE25",
            minOrderSubtotal = 500.0,
            maxDiscountAmount = 200.0, // 25% of 1200 is 300, capped at 200
            status = "active"
        )

        val result = BillCalculator.calculate(
            cartItems = listOf(cartItem),
            promotion = promo,
            taxPercent = 5.0,
            serviceChargePercent = 5.0
        )
        assertEquals(1200.0, result.subtotal, 0.001)
        assertEquals(200.0, result.discount, 0.001)
        assertEquals(1000.0, result.taxableAmount, 0.001)
        assertEquals(50.0, result.tax, 0.001)
        assertEquals(50.0, result.serviceCharge, 0.001)
        assertEquals(1100.0, result.total, 0.001)
    }

    @Test
    fun fixedDiscount_cannotExceedSubtotal() {
        val cartItem = CartItem(item = drink, count = 2) // 100 subtotal
        val promo = Promotion(
            id = "p-flat",
            name = "Flat 150 OFF",
            type = "fixed",
            value = 150.0,
            couponCode = "FLAT150",
            status = "active"
        )

        val result = BillCalculator.calculate(
            cartItems = listOf(cartItem),
            promotion = promo,
            taxPercent = 5.0,
            serviceChargePercent = 0.0
        )
        // Discount is clamped to subtotal (100.0)
        assertEquals(100.0, result.discount, 0.001)
        assertEquals(0.0, result.taxableAmount, 0.001)
        assertEquals(0.0, result.total, 0.001)
    }

    @Test
    fun minimumOrderRequirement_rejectsWhenUnmet() {
        val cartItem = CartItem(item = pizzaBase, count = 1) // 300 subtotal
        val promo = Promotion(
            id = "p-big",
            name = "Big Order 100 OFF",
            type = "fixed",
            value = 100.0,
            minOrderSubtotal = 500.0,
            status = "active"
        )

        val discount = BillCalculator.calculateDiscount(
            promotion = promo,
            cartItems = listOf(cartItem),
            subtotal = 300.0
        )
        assertEquals(0.0, discount, 0.001)
    }

    @Test
    fun categoryScopedCoupon_onlyAppliesToEligibleDishes() {
        val pizzaItem = CartItem(item = pizzaBase, count = 1) // 300.0 in "Pizza" / "cat-pizza"
        val drinkItem = CartItem(item = drink, count = 2)     // 100.0 in "Beverages" / "cat-drinks"
        val cart = listOf(pizzaItem, drinkItem)               // Total subtotal = 400.0

        val pizzaOnlyPromo = Promotion(
            id = "p-pizza-20",
            name = "Pizza Special 20% OFF",
            type = "percentage",
            value = 20.0,
            applicableCategoryIds = listOf("cat-pizza"),
            status = "active"
        )

        val discount = BillCalculator.calculateDiscount(
            promotion = pizzaOnlyPromo,
            cartItems = cart,
            subtotal = 400.0
        )
        // 20% applied ONLY to pizza (300.0) = 60.0, NOT to drink (100.0)
        assertEquals(60.0, discount, 0.001)
    }

    @Test
    fun pausedOrInactiveCoupon_isRejected() {
        val cartItem = CartItem(item = pizzaBase, count = 2) // 600.0
        val pausedPromo = Promotion(
            id = "p-paused",
            name = "Paused Promo",
            type = "percentage",
            value = 50.0,
            status = "paused"
        )
        val discount = BillCalculator.calculateDiscount(
            promotion = pausedPromo,
            cartItems = listOf(cartItem),
            subtotal = 600.0
        )
        assertEquals(0.0, discount, 0.001)
    }

    @Test
    fun dateExpiredCoupon_isRejected() {
        val cartItem = CartItem(item = pizzaBase, count = 2)
        val expiredPromo = Promotion(
            id = "p-exp",
            name = "Expired Promo",
            type = "percentage",
            value = 20.0,
            status = "active",
            startDate = "2024-01-01T00:00:00Z",
            endDate = "2024-06-01T00:00:00Z"
        )
        // Test with current time after expiration
        val discount = BillCalculator.calculateDiscount(
            promotion = expiredPromo,
            cartItems = listOf(cartItem),
            subtotal = 600.0,
            currentTimeMillis = 1735689600000L // 2025-01-01
        )
        assertEquals(0.0, discount, 0.001)
    }
}
