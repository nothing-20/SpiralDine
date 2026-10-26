package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.Addon
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.Promotion
import com.spiralworld.spiraldine.data.model.Variant
import com.spiralworld.spiraldine.data.repository.CartRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CartPricingTest {

    private lateinit var cartRepository: CartRepository

    private val sampleItem1 = MenuItem(
        id = "dish-1",
        name = "Paneer Butter Masala",
        price = 250.0,
        category = "Main Course",
        isVeg = true
    )

    private val sampleItem2 = MenuItem(
        id = "dish-2",
        name = "Garlic Naan",
        price = 60.0,
        category = "Breads",
        isVeg = true
    )

    @Before
    fun setUp() {
        cartRepository = CartRepository()
        cartRepository.setRestaurantRates(taxPercent = 5.0, serviceChargePercent = 5.0)
    }

    @Test
    fun emptyCart_returnsZeroTotals() {
        val pricing = cartRepository.getPricing()
        assertEquals(0.0, pricing.subtotal, 0.01)
        assertEquals(0.0, pricing.discount, 0.01)
        assertEquals(0.0, pricing.tax, 0.01)
        assertEquals(0.0, pricing.serviceCharge, 0.01)
        assertEquals(0.0, pricing.total, 0.01)
    }

    @Test
    fun addItemWithVariantsAndAddons_calculatesCorrectLineTotal() {
        val largeVariant = Variant(id = "v-lg", name = "Large", price = 320.0)
        val extraCheese = Addon(id = "a-ch", name = "Extra Butter", price = 30.0)

        cartRepository.addItem(
            item = sampleItem1,
            tenantId = "rest-test",
            count = 2,
            variant = largeVariant,
            addons = listOf(extraCheese)
        )

        // (320 + 30) * 2 = 700.0
        val subtotal = cartRepository.calculateSubtotal()
        assertEquals(700.0, subtotal, 0.01)

        val pricing = cartRepository.getPricing()
        // Tax 5% of 700 = 35.0, Service charge 5% of 700 = 35.0, Total = 770.0
        assertEquals(700.0, pricing.subtotal, 0.01)
        assertEquals(35.0, pricing.tax, 0.01)
        assertEquals(35.0, pricing.serviceCharge, 0.01)
        assertEquals(770.0, pricing.total, 0.01)
    }

    @Test
    fun percentageCoupon_cappedAtMaxDiscount() {
        // Add 2 x 250 = 500
        cartRepository.addItem(item = sampleItem1, tenantId = "rest-test", count = 2)

        val promo = Promotion(
            id = "promo-biryani",
            name = "Test Offer 50% OFF",
            type = "percentage",
            value = 50.0,
            couponCode = "SAVE50",
            minOrderSubtotal = 199.0,
            maxDiscountAmount = 150.0
        )

        val result = cartRepository.applyCoupon(promo)
        assertTrue(result.isSuccess)

        val discount = cartRepository.calculateDiscount()
        // 50% of 500 is 250, but capped at 150
        assertEquals(150.0, discount, 0.01)

        val pricing = cartRepository.getPricing()
        // Taxable = 500 - 150 = 350
        // Tax 5% = 17.5, Service charge 5% = 17.5
        // Total = 350 + 17.5 + 17.5 = 385.0
        assertEquals(500.0, pricing.subtotal, 0.01)
        assertEquals(150.0, pricing.discount, 0.01)
        assertEquals(385.0, pricing.total, 0.01)
    }

    @Test
    fun couponWithMinOrderRequirement_failsWhenSubtotalInsufficient() {
        // Add 1 x 60 = 60
        cartRepository.addItem(item = sampleItem2, tenantId = "rest-test", count = 1)

        val promo = Promotion(
            id = "promo-test",
            name = "20% OFF",
            type = "percentage",
            value = 20.0,
            couponCode = "TEST20",
            minOrderSubtotal = 199.0
        )

        val result = cartRepository.applyCoupon(promo)
        assertTrue(result.isFailure)
        assertEquals(0.0, cartRepository.calculateDiscount(), 0.01)
    }

    @Test
    fun crossTenantItemAddition_preventsSilentDiscardAndProvidesClearAndAdd() {
        cartRepository.addItem(item = sampleItem1, tenantId = "tenant-a", count = 1)
        assertEquals("tenant-a", cartRepository.activeTenantId.value)
        assertEquals(1, cartRepository.items.value.size)

        // Adding from tenant-b must report conflict and NOT silently discard tenant-a basket
        val conflictResult = cartRepository.addItem(item = sampleItem2, tenantId = "tenant-b", count = 2)
        assertTrue(conflictResult is com.spiralworld.spiraldine.data.repository.CartAddResult.CrossRestaurantConflict)
        assertEquals("tenant-a", cartRepository.activeTenantId.value)
        assertEquals(1, cartRepository.items.value.size)
        assertEquals("dish-1", cartRepository.items.value[0].item.id)

        // User explicitly confirms to clear and add
        cartRepository.clearAndAddItem(item = sampleItem2, tenantId = "tenant-b", count = 2)
        assertEquals("tenant-b", cartRepository.activeTenantId.value)
        assertEquals(1, cartRepository.items.value.size)
        assertEquals("dish-2", cartRepository.items.value[0].item.id)
    }
}
