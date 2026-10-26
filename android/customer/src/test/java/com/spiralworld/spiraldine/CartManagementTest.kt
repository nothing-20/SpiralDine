package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.Addon
import com.spiralworld.spiraldine.data.model.CartItem
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.Variant
import com.spiralworld.spiraldine.data.repository.CartAddResult
import com.spiralworld.spiraldine.data.repository.CartRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class CartManagementTest {

    private lateinit var cartRepository: CartRepository

    private val biryaniDish = MenuItem(
        id = "dish-biryani",
        name = "Hyderabadi Dum Biryani",
        price = 280.0,
        category = "Biryani",
        restaurantId = "rest-bawarchi"
    )

    private val burgerDish = MenuItem(
        id = "dish-burger",
        name = "Classic Smash Burger",
        price = 150.0,
        category = "Burgers",
        restaurantId = "rest-burger-lab"
    )

    private val singleVariant = Variant(id = "var-single", name = "Single (1 Person)", price = 220.0)
    private val familyVariant = Variant(id = "var-family", name = "Family Pack", price = 650.0)
    private val extraRaita = Addon(id = "addon-raita", name = "Extra Raita", price = 30.0)
    private val extraSalalan = Addon(id = "addon-salan", name = "Mirchi Ka Salan", price = 40.0)

    @Before
    fun setUp() {
        cartRepository = CartRepository()
    }

    @Test
    fun lineIdentity_differentVariantsCreateSeparateLines() {
        // Line 1: Single portion
        cartRepository.addItem(
            item = biryaniDish,
            tenantId = "rest-bawarchi",
            count = 1,
            variant = singleVariant
        )

        // Line 2: Family pack of the exact same dish ID
        cartRepository.addItem(
            item = biryaniDish,
            tenantId = "rest-bawarchi",
            count = 1,
            variant = familyVariant
        )

        val items = cartRepository.items.value
        assertEquals(2, items.size)
        assertNotEquals(items[0].lineId, items[1].lineId)
        assertEquals("Single (1 Person)", items[0].selectedVariant?.name)
        assertEquals("Family Pack", items[1].selectedVariant?.name)
    }

    @Test
    fun lineIdentity_differentAddonsCreateSeparateLines() {
        // Line 1: Biryani with Extra Raita
        cartRepository.addItem(
            item = biryaniDish,
            tenantId = "rest-bawarchi",
            count = 1,
            addons = listOf(extraRaita)
        )

        // Line 2: Biryani with Extra Salan
        cartRepository.addItem(
            item = biryaniDish,
            tenantId = "rest-bawarchi",
            count = 1,
            addons = listOf(extraSalalan)
        )

        val items = cartRepository.items.value
        assertEquals(2, items.size)
        assertNotEquals(items[0].lineId, items[1].lineId)
    }

    @Test
    fun lineIdentity_differentSpecialInstructionsCreateSeparateLines() {
        // Line 1: Mild spicy
        cartRepository.addItem(
            item = biryaniDish,
            tenantId = "rest-bawarchi",
            count = 1,
            notes = "Make it mild spicy"
        )

        // Line 2: Extra spicy
        cartRepository.addItem(
            item = biryaniDish,
            tenantId = "rest-bawarchi",
            count = 1,
            notes = "Extra spicy, no onions"
        )

        val items = cartRepository.items.value
        assertEquals(2, items.size)
        assertNotEquals(items[0].lineId, items[1].lineId)
    }

    @Test
    fun identicalConfiguration_mergesAndIncreasesQuantity() {
        cartRepository.addItem(
            item = biryaniDish,
            tenantId = "rest-bawarchi",
            count = 1,
            variant = singleVariant,
            addons = listOf(extraRaita),
            notes = "Hot"
        )

        // Add exact same configuration
        cartRepository.addItem(
            item = biryaniDish,
            tenantId = "rest-bawarchi",
            count = 2,
            variant = singleVariant,
            addons = listOf(extraRaita),
            notes = "Hot"
        )

        val items = cartRepository.items.value
        assertEquals(1, items.size)
        assertEquals(3, items[0].count)
    }

    @Test
    fun updateCount_decreasesAndRemovesLine() {
        cartRepository.addItem(item = biryaniDish, tenantId = "rest-bawarchi", count = 2)
        val lineId = cartRepository.items.value[0].lineId

        cartRepository.updateCount(lineId, 1)
        assertEquals(1, cartRepository.items.value[0].count)

        // Decrementing to 0 removes line
        cartRepository.updateCount(lineId, 0)
        assertTrue(cartRepository.items.value.isEmpty())
    }

    @Test
    fun removeItem_removesTargetLineIdOnly() {
        cartRepository.addItem(item = biryaniDish, tenantId = "rest-bawarchi", count = 1, variant = singleVariant)
        cartRepository.addItem(item = biryaniDish, tenantId = "rest-bawarchi", count = 1, variant = familyVariant)
        assertEquals(2, cartRepository.items.value.size)

        val firstLineId = cartRepository.items.value[0].lineId
        cartRepository.removeItem(firstLineId)

        assertEquals(1, cartRepository.items.value.size)
        assertEquals("Family Pack", cartRepository.items.value[0].selectedVariant?.name)
    }

    @Test
    fun clearCart_emptiesItemsAndResetsTenant() {
        cartRepository.addItem(item = biryaniDish, tenantId = "rest-bawarchi", count = 2)
        assertEquals(1, cartRepository.items.value.size)

        cartRepository.clearCart()
        assertTrue(cartRepository.items.value.isEmpty())
        assertEquals(null, cartRepository.activeTenantId.value)
    }

    @Test
    fun restaurantIsolation_blocksCrossRestaurantSilentOverwrite() {
        // First order started with Bawarchi
        val res1 = cartRepository.addItem(item = biryaniDish, tenantId = "rest-bawarchi", count = 1)
        assertTrue(res1 is CartAddResult.Success)

        // Customer navigates to Burger Lab and attempts to add
        val res2 = cartRepository.addItem(item = burgerDish, tenantId = "rest-burger-lab", count = 1)
        assertTrue(res2 is CartAddResult.CrossRestaurantConflict)

        val conflict = res2 as CartAddResult.CrossRestaurantConflict
        assertEquals("rest-bawarchi", conflict.existingTenantId)
        assertEquals("rest-burger-lab", conflict.newTenantId)

        // Original cart is NOT wiped out
        assertEquals(1, cartRepository.items.value.size)
        assertEquals("dish-biryani", cartRepository.items.value[0].item.id)

        // Customer chooses to clear and switch
        cartRepository.clearAndAddItem(item = burgerDish, tenantId = "rest-burger-lab", count = 2)
        assertEquals(1, cartRepository.items.value.size)
        assertEquals("dish-burger", cartRepository.items.value[0].item.id)
        assertEquals("rest-burger-lab", cartRepository.activeTenantId.value)
    }
}
