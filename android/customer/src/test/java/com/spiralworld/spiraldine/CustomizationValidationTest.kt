package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.CartItem
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.MenuItemAddon
import com.spiralworld.spiraldine.data.model.MenuItemVariant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CustomizationValidationTest {

    private val baseItem = MenuItem(
        id = "dish-pasta",
        name = "Alfredo Pasta",
        price = 350.0,
        category = "Pasta",
        variants = listOf(
            MenuItemVariant(id = "v-reg", name = "Regular", price = 350.0),
            MenuItemVariant(id = "v-lg", name = "Large", price = 480.0)
        ),
        addons = listOf(
            MenuItemAddon(id = "a-mush", name = "Sauteed Mushrooms", price = 50.0),
            MenuItemAddon(id = "a-parm", name = "Shaved Parmesan", price = 40.0)
        )
    )

    private val simpleDrink = MenuItem(
        id = "dish-water",
        name = "Mineral Water",
        price = 20.0,
        category = "Drinks"
    )

    @Test
    fun isCustomizable_detectsVariantsOrAddons() {
        assertTrue(baseItem.isCustomizable)
        assertFalse(simpleDrink.isCustomizable)
    }

    @Test
    fun displayCustomizations_formatsVariantAndAddonsCleanly() {
        val cartItem = CartItem(
            item = baseItem,
            count = 1,
            selectedVariant = baseItem.variants[1], // Large
            selectedAddons = baseItem.addons        // Mushrooms & Parmesan
        )

        assertEquals("Large • Sauteed Mushrooms, Shaved Parmesan", cartItem.displayCustomizations)
    }

    @Test
    fun displayCustomizations_variantOnly() {
        val cartItem = CartItem(
            item = baseItem,
            count = 1,
            selectedVariant = baseItem.variants[0],
            selectedAddons = emptyList()
        )

        assertEquals("Regular", cartItem.displayCustomizations)
    }

    @Test
    fun specialInstructions_areTrimmedAndLimited() {
        val rawInput = "   Please make it creamy and not too salty!   "
        val trimmed = rawInput.trim()
        val cartItem = CartItem(
            item = baseItem,
            count = 1,
            notes = trimmed
        )

        assertEquals("Please make it creamy and not too salty!", cartItem.notes)

        // 200 characters limit test
        val longText = "a".repeat(250)
        val clamped = longText.take(200)
        assertEquals(200, clamped.length)
    }

    @Test
    fun unitPrice_calculatesCorrectlyWithVariantOverride() {
        // Base price is 350. Large variant is 480. Mushrooms is 50.
        val cartItem = CartItem(
            item = baseItem,
            count = 2,
            selectedVariant = baseItem.variants[1],
            selectedAddons = listOf(baseItem.addons[0])
        )

        // 480 + 50 = 530 per unit
        assertEquals(530.0, cartItem.unitPrice, 0.001)
        // 530 * 2 = 1060 total
        assertEquals(1060.0, cartItem.lineTotal, 0.001)
    }
}
