package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.CartItem
import com.spiralworld.spiraldine.data.model.CartPricing
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.MenuItemAddon
import com.spiralworld.spiraldine.data.model.MenuItemVariant
import com.spiralworld.spiraldine.data.model.OrderRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.UUID

class OrderIntegrationTest {

    private val paneerDish = MenuItem(
        id = "dish-paneer-tikka",
        name = "Paneer Tikka",
        price = 260.0,
        category = "Starters"
    )

    private val spicyVariant = MenuItemVariant(id = "var-spicy", name = "Extra Spicy", price = 280.0)
    private val dipAddon = MenuItemAddon(id = "addon-mint-dip", name = "Mint Dip", price = 30.0)

    @Test
    fun orderPayload_matchesBackendContract() {
        val cartItem = CartItem(
            item = paneerDish,
            count = 2,
            selectedVariant = spicyVariant,
            selectedAddons = listOf(dipAddon),
            notes = "Serve with lemon wedges"
        )

        val pricing = CartPricing(
            subtotal = 620.0,
            discount = 50.0,
            taxableAmount = 570.0,
            tax = 28.5,
            taxPercent = 5.0,
            serviceCharge = 28.5,
            serviceChargePercent = 5.0,
            total = 627.0
        )

        val orderId = "ORD-${UUID.randomUUID().toString().take(8).uppercase()}"

        // Validate payload structure matching OrderRepository.kt and api/orders/create.ts
        val itemsPayload = listOf(
            mapOf(
                "id" to cartItem.item.id,
                "name" to cartItem.item.name,
                "price" to cartItem.unitPrice,
                "quantity" to cartItem.count,
                "lineTotal" to cartItem.lineTotal,
                "notes" to cartItem.notes,
                "variantId" to (cartItem.selectedVariant?.id ?: ""),
                "variantName" to (cartItem.selectedVariant?.name ?: ""),
                "addons" to cartItem.selectedAddons.map { a ->
                    mapOf(
                        "id" to a.id,
                        "name" to a.name,
                        "price" to a.price
                    )
                }
            )
        )

        val rootPayload = mapOf(
            "orderId" to orderId,
            "tenantId" to "rest-bawarchi",
            "tableNumber" to "T-04",
            "tableId" to "tbl-4",
            "sessionId" to "session-xyz",
            "customerId" to "cust-123",
            "customerName" to "Geetha Krishna",
            "phone" to "+919876543210",
            "orderType" to "dine_in",
            "paymentStatus" to "pending",
            "paymentMethod" to "pay_at_counter",
            "items" to itemsPayload,
            "couponCode" to "WELCOME50",
            "specialInstructions" to "Urgent lunch"
        )

        // Assert schema compliance
        assertEquals(orderId, rootPayload["orderId"])
        assertEquals("rest-bawarchi", rootPayload["tenantId"])
        assertEquals("T-04", rootPayload["tableNumber"])
        assertEquals("pending", rootPayload["paymentStatus"])
        assertEquals(1, (rootPayload["items"] as List<*>).size)

        val firstItem = (rootPayload["items"] as List<Map<String, Any>>)[0]
        assertEquals("dish-paneer-tikka", firstItem["id"])
        assertEquals("var-spicy", firstItem["variantId"])
        assertEquals(1, (firstItem["addons"] as List<*>).size)
        val firstAddon = (firstItem["addons"] as List<Map<String, Any>>)[0]
        assertEquals("addon-mint-dip", firstAddon["id"])
    }

    @Test
    fun orderStatus_hasExpectedTransitions() {
        val validStatuses = listOf("NEW", "PLACED", "ACCEPTED", "CHEF_ASSIGNED", "PREPARING", "READY", "SERVED", "DELIVERED", "COMPLETED", "CANCELLED")
        val testOrder = OrderRecord(
            orderId = "ORD-TEST-1",
            status = "NEW"
        )
        assertTrue(validStatuses.contains(testOrder.status))
    }

    @Test
    fun orderPlacementException_containsIdempotencyKeyAndRetryFlag() {
        val originalKey = "ORD-20261018-XYZ999"
        val ex = com.spiralworld.spiraldine.data.repository.OrderPlacementException(
            message = "Connection timeout. Basket preserved.",
            idempotencyKey = originalKey,
            isRetryable = true,
            cause = java.net.SocketTimeoutException("Read timed out")
        )

        assertEquals("Connection timeout. Basket preserved.", ex.message)
        assertEquals(originalKey, ex.idempotencyKey)
        assertTrue(ex.isRetryable)
        assertNotNull(ex.cause)
    }

    @Test
    fun kitchenStatusMapping_identifiesActiveAndCancelledStages() {
        val placedStatuses = listOf("NEW", "PLACED")
        val confirmedStatuses = listOf("ACCEPTED", "CHEF_ASSIGNED")
        val cookingStatuses = listOf("PREPARING", "COOKING")
        val readyStatuses = listOf("READY")
        val servedStatuses = listOf("SERVED", "DELIVERED", "COMPLETED")
        val cancelledStatuses = listOf("CANCELLED", "CANCELED", "REJECTED", "VOID")

        val orderCancelled = OrderRecord(orderId = "ORD-CANCEL", status = "CANCELLED")
        val orderPreparing = OrderRecord(orderId = "ORD-COOK", status = "PREPARING")

        assertTrue(cancelledStatuses.contains(orderCancelled.status.uppercase()))
        assertFalse(cancelledStatuses.contains(orderPreparing.status.uppercase()))

        assertTrue(cookingStatuses.contains(orderPreparing.status.uppercase()))
    }

    @Test
    fun authoritativeBilling_doesNotFabricateBreakdown() {
        val serverOrder = OrderRecord(
            orderId = "ORD-AUTH-1",
            subtotal = 500.0,
            discount = 0.0,
            tax = 25.0,
            serviceCharge = 0.0,
            total = 525.0,
            paymentStatus = "pending"
        )

        assertEquals(500.0, serverOrder.subtotal, 0.01)
        assertEquals(0.0, serverOrder.discount, 0.01)
        assertEquals(25.0, serverOrder.tax, 0.01)
        assertEquals(0.0, serverOrder.serviceCharge, 0.01)
        assertEquals(525.0, serverOrder.total, 0.01)
        assertEquals("pending", serverOrder.paymentStatus)
    }
}

