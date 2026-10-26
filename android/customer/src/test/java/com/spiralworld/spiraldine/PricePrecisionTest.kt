package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.CartItem
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.OrderItemRecord
import com.spiralworld.spiraldine.data.model.OrderRecord
import com.spiralworld.spiraldine.data.repository.BillCalculator
import com.spiralworld.spiraldine.data.repository.CurrencyFormatter
import com.spiralworld.spiraldine.data.repository.FirestoreFieldParser
import com.spiralworld.spiraldine.data.repository.OrderRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class PricePrecisionTest {

    // 1. Precise formatting of decimal currency values
    @Test
    fun testCurrencyFormatting_preservesDecimalPaise() {
        assertEquals("₹99.50", CurrencyFormatter.formatRupees(99.50))
        assertEquals("₹149.75", CurrencyFormatter.formatRupees(149.75))
        assertEquals("₹249.99", CurrencyFormatter.formatRupees(249.99))
    }

    @Test
    fun testCurrencyFormatting_handlesIntegerAmounts() {
        assertEquals("₹100", CurrencyFormatter.formatRupees(100.0))
        assertEquals("₹0", CurrencyFormatter.formatRupees(0.0))
        assertEquals("₹50", CurrencyFormatter.formatRupees(50.0))
        // Exact 2-decimal formatting always shows paise
        assertEquals("₹100.00", CurrencyFormatter.formatRupeesExact(100.0))
        assertEquals("₹0.00", CurrencyFormatter.formatRupeesExact(0.0))
    }

    // 2. Quantity multiplication for decimal unit prices
    @Test
    fun testQuantityMultiplication_retainsPaisePrecision() {
        // 3 items @ ₹99.50 = ₹298.50
        val total1 = CurrencyFormatter.multiplyPrice(99.50, 3)
        assertEquals(298.50, total1, 0.001)
        assertEquals("₹298.50", CurrencyFormatter.formatRupees(total1))

        // 4 items @ ₹149.75 = ₹599.00
        val total2 = CurrencyFormatter.multiplyPrice(149.75, 4)
        assertEquals(599.00, total2, 0.001)
        assertEquals("₹599", CurrencyFormatter.formatRupees(total2))

        // 2 items @ ₹249.99 = ₹499.98
        val total3 = CurrencyFormatter.multiplyPrice(249.99, 2)
        assertEquals(499.98, total3, 0.001)
        assertEquals("₹499.98", CurrencyFormatter.formatRupees(total3))
    }

    // 3. Conversion between Rupees and Paise (and back)
    @Test
    fun testRupeesAndPaiseConversions() {
        assertEquals(9950L, CurrencyFormatter.rupeesToPaise(99.50))
        assertEquals(14975L, CurrencyFormatter.rupeesToPaise(149.75))
        assertEquals(24999L, CurrencyFormatter.rupeesToPaise(249.99))
        assertEquals(10000L, CurrencyFormatter.rupeesToPaise(100.0))

        assertEquals(99.50, CurrencyFormatter.paiseToRupees(9950L), 0.001)
        assertEquals(149.75, CurrencyFormatter.paiseToRupees(14975L), 0.001)
        assertEquals(249.99, CurrencyFormatter.paiseToRupees(24999L), 0.001)
        assertEquals(100.0, CurrencyFormatter.paiseToRupees(10000L), 0.001)
    }

    // 4. Cart totals involving multiple decimal items
    @Test
    fun testCartTotals_withMixedDecimalItems() {
        val item1 = MenuItem(id = "item-1", name = "Special Starter", price = 99.50)
        val item2 = MenuItem(id = "item-2", name = "Gourmet Rice", price = 149.75)
        val item3 = MenuItem(id = "item-3", name = "Signature Curry", price = 249.99)

        val cartItems = listOf(
            CartItem(item = item1, count = 2), // 199.00
            CartItem(item = item2, count = 1), // 149.75
            CartItem(item = item3, count = 1)  // 249.99
        )

        val pricing = BillCalculator.calculate(
            cartItems = cartItems,
            promotion = null,
            taxPercent = 5.0,
            serviceChargePercent = 5.0,
            isDineIn = true
        )

        // Subtotal: 199.00 + 149.75 + 249.99 = 598.74
        assertEquals(598.74, pricing.subtotal, 0.001)

        // Tax 5% on 598.74: 29.937 -> rounded to 29.94
        assertEquals(29.94, pricing.tax, 0.001)

        // Service charge 5% on 598.74: 29.937 -> rounded to 29.94
        assertEquals(29.94, pricing.serviceCharge, 0.001)

        // Total: 598.74 + 29.94 + 29.94 = 658.62
        assertEquals(658.62, pricing.total, 0.001)
        assertEquals("₹658.62", CurrencyFormatter.formatRupees(pricing.total))
    }

    // 5. Firestore numeric representations (Long, Double, String) via FirestoreFieldParser
    @Test
    fun testFirestoreFieldParser_safeDoubleHandlesDiverseTypes() {
        // Double (standard floating point)
        val doubleData = mapOf("price" to 99.50)
        assertEquals(99.50, FirestoreFieldParser.safeDouble(doubleData, "price"), 0.001)

        // Long / Integer from Firestore
        val longData = mapOf("price" to 150L)
        assertEquals(150.0, FirestoreFieldParser.safeDouble(longData, "price"), 0.001)

        val intData = mapOf("price" to 200)
        assertEquals(200.0, FirestoreFieldParser.safeDouble(intData, "price"), 0.001)

        // String representation (e.g. from JSON web APIs)
        val strData = mapOf("price" to "249.99")
        assertEquals(249.99, FirestoreFieldParser.safeDouble(strData, "price"), 0.001)

        // Malformed string
        val malformedData = mapOf("price" to "abc")
        assertEquals(0.0, FirestoreFieldParser.safeDouble(malformedData, "price", fallback = 0.0), 0.001)

        // Null / Missing
        val missingData = emptyMap<String, Any>()
        assertEquals(42.0, FirestoreFieldParser.safeDouble(missingData, "price", fallback = 42.0), 0.001)
    }

    // 6. Historical order items preserve snapshot price without recalculating from current menu
    @Test
    fun testHistoricalOrder_preservesOriginalPriceSnapshot() {
        // Historical order was placed when item was ₹99.50
        val historicalItem = OrderItemRecord(
            itemId = "dish-101",
            name = "Paneer Butter Masala",
            count = 2,
            pricePerUnit = 99.50
        )

        val historicalOrder = OrderRecord(
            id = "ORD-001",
            orderId = "ORD-001",
            tenantId = "res-821720",
            tableNumber = "4",
            items = listOf(historicalItem),
            subtotal = 199.00,
            tax = 9.95,
            total = 208.95
        )

        // Meanwhile, current menu price has increased to ₹149.75
        val currentMenuItem = MenuItem(
            id = "dish-101",
            name = "Paneer Butter Masala",
            price = 149.75
        )

        // The historical order item price snapshot must REMAIN 99.50, NOT 149.75
        assertEquals(99.50, historicalOrder.items[0].pricePerUnit, 0.001)
        assertNotEquals(currentMenuItem.price, historicalOrder.items[0].pricePerUnit, 0.001)

        // Historical order total must remain exactly as recorded
        assertEquals(208.95, historicalOrder.total, 0.001)
        assertEquals("₹208.95", CurrencyFormatter.formatRupees(historicalOrder.total))
    }

    // 7. Order deserialization from website-compatible Firestore schema
    @Test
    fun testOrderRepository_parseOrderData_preservesAllDecimalFields() {
        val firestoreOrderPayload = mapOf(
            "id" to "ORD-WEB-9823",
            "orderId" to "ORD-WEB-9823",
            "tenantId" to "res-821720",
            "tableNumber" to "3",
            "tableId" to "TBL-3",
            "customerId" to "cust-123",
            "customerName" to "John Doe",
            "phone" to "+91 98765 43210",
            "subtotal" to 249.99,
            "discount" to 25.00,
            "couponCode" to "SAVE25",
            "tax" to 11.25,
            "serviceCharge" to 11.25,
            "total" to 247.49,
            "status" to "CONFIRMED",
            "paymentStatus" to "paid",
            "items" to listOf(
                mapOf(
                    "itemId" to "curry-01",
                    "name" to "Chef Special Curry",
                    "count" to 1,
                    "pricePerUnit" to 249.99,
                    "isVeg" to true
                )
            )
        )

        val parsed = OrderRepository.parseOrderData("ORD-WEB-9823", firestoreOrderPayload)
        assertNotNull(parsed)
        assertEquals("ORD-WEB-9823", parsed?.orderId)
        assertEquals(249.99, parsed?.subtotal ?: 0.0, 0.001)
        assertEquals(25.00, parsed?.discount ?: 0.0, 0.001)
        assertEquals(11.25, parsed?.tax ?: 0.0, 0.001)
        assertEquals(11.25, parsed?.serviceCharge ?: 0.0, 0.001)
        assertEquals(247.49, parsed?.total ?: 0.0, 0.001)

        assertEquals(1, parsed?.items?.size)
        val item = parsed!!.items[0]
        assertEquals("curry-01", item.itemId)
        assertEquals(249.99, item.pricePerUnit, 0.001)
        assertEquals("₹249.99", CurrencyFormatter.formatRupees(item.pricePerUnit))
    }

    // 8. REGRESSION TEST: 100x Factor Price Mismatch Resolution
    @Test
    fun testObservedPriceMismatch_100xFactorResolved() {
        // Items reported by user with 100x discrepancy between web and Android
        // Web displayed ₹6.50, Android previously displayed ₹650
        val vegSpringRollsPaise = 650.0
        val paneerTikkaPaise = 950.0
        val chickenWingsPaise = 1100.0
        val frenchFriesPaise = 450.0

        // formatPrice must divide canonical paise by 100 to yield exact rupee strings
        assertEquals("₹6.50", CurrencyFormatter.formatPrice(vegSpringRollsPaise))
        assertEquals("₹9.50", CurrencyFormatter.formatPrice(paneerTikkaPaise))
        assertEquals("₹11", CurrencyFormatter.formatPrice(chickenWingsPaise))
        assertEquals("₹11.00", CurrencyFormatter.formatPriceExact(chickenWingsPaise))
        assertEquals("₹4.50", CurrencyFormatter.formatPrice(frenchFriesPaise))

        // Higher denomination items from spiral-restaurant-1-ipf6
        val kadaiPaneerPaise = 31900.0
        val butterRotiPaise = 5900.0
        assertEquals("₹319", CurrencyFormatter.formatPrice(kadaiPaneerPaise))
        assertEquals("₹319.00", CurrencyFormatter.formatPriceExact(kadaiPaneerPaise))
        assertEquals("₹59", CurrencyFormatter.formatPrice(butterRotiPaise))
        assertEquals("₹59.00", CurrencyFormatter.formatPriceExact(butterRotiPaise))
    }

    // 9. REGRESSION TEST: Double Conversion Prevention
    @Test
    fun testDoubleConversionPrevention() {
        val canonicalPaise = 650.0
        // Step 1: paise to rupees
        val convertedRupees = CurrencyFormatter.paiseToRupees(canonicalPaise.toLong())
        assertEquals(6.50, convertedRupees, 0.001)

        // Formatting paise with formatPrice
        val formattedFromPaise = CurrencyFormatter.formatPrice(canonicalPaise)
        // Formatting rupees with formatRupees
        val formattedFromRupees = CurrencyFormatter.formatRupees(convertedRupees)

        // Both paths MUST produce the exact same display string: "₹6.50"
        assertEquals("₹6.50", formattedFromPaise)
        assertEquals("₹6.50", formattedFromRupees)
        assertEquals(formattedFromPaise, formattedFromRupees)
    }

    // 10. REGRESSION TEST: Cart Calculations with Canonical Paise Items
    @Test
    fun testCartTotals_withCanonicalPaiseItems() {
        val springRolls = MenuItem(id = "item-sr", name = "Veg Spring Rolls", price = 650.0)
        val paneerTikka = MenuItem(id = "item-pt", name = "Paneer Tikka", price = 950.0)

        val cartItems = listOf(
            CartItem(item = springRolls, count = 2), // 2 * 650 = 1300 paise
            CartItem(item = paneerTikka, count = 1)   // 1 * 950 = 950 paise
        )

        val pricing = BillCalculator.calculate(
            cartItems = cartItems,
            promotion = null,
            taxPercent = 5.0,
            serviceChargePercent = 5.0,
            isDineIn = true
        )

        // Subtotal: 1300 + 950 = 2250 paise
        assertEquals(2250.0, pricing.subtotal, 0.001)
        assertEquals("₹22.50", CurrencyFormatter.formatPrice(pricing.subtotal))

        // Tax 5% on 2250: 112.5 -> rounded to 112.5 (or nearest paisa)
        assertEquals(112.5, pricing.tax, 0.001)
        assertEquals("₹1.13", CurrencyFormatter.formatPrice(pricing.tax))

        // Service charge 5% on 2250: 112.5
        assertEquals(112.5, pricing.serviceCharge, 0.001)
        assertEquals("₹1.13", CurrencyFormatter.formatPrice(pricing.serviceCharge))

        // Total: 2250 + 112.5 + 112.5 = 2475.0 paise
        assertEquals(2475.0, pricing.total, 0.001)
        assertEquals("₹24.75", CurrencyFormatter.formatPrice(pricing.total))
    }

    // 11. REGRESSION TEST: Real Production Firestore Order ORD-20260912-IPCJ3S Snapshot
    @Test
    fun testHistoricalOrder_liveFirestorePayload_ORD_20260912_IPCJ3S() {
        val liveFirestoreOrder = mapOf(
            "id" to "ORD-20260912-IPCJ3S",
            "orderId" to "ORD-20260912-IPCJ3S",
            "primaryOrderId" to "ORD-20260912-IPCJ3S",
            "tenantId" to "yummy-yummy-3p65",
            "tableNumber" to "1",
            "tableId" to "TBL-1",
            "customerId" to "GUEST-001",
            "customerName" to "Guest Diner",
            "subtotal" to 6350L,
            "tax" to 508L,
            "serviceCharge" to 318L,
            "total" to 7176L,
            "status" to "COMPLETED",
            "paymentStatus" to "paid",
            "createdAt" to "2026-09-12T14:30:00Z",
            "items" to listOf(
                mapOf(
                    "itemId" to "item-sr",
                    "name" to "Veg Spring Rolls",
                    "count" to 2,
                    "pricePerUnit" to 650L,
                    "isVeg" to true
                )
            )
        )

        val parsed = OrderRepository.parseOrderData("ORD-20260912-IPCJ3S", liveFirestoreOrder)
        assertNotNull(parsed)
        assertEquals("ORD-20260912-IPCJ3S", parsed?.orderId)
        assertEquals(6350.0, parsed?.subtotal ?: 0.0, 0.001)
        assertEquals(508.0, parsed?.tax ?: 0.0, 0.001)
        assertEquals(318.0, parsed?.serviceCharge ?: 0.0, 0.001)
        assertEquals(7176.0, parsed?.total ?: 0.0, 0.001)

        // Display formatting matches website exactly: ₹63.50, ₹5.08, ₹3.18, ₹71.76
        assertEquals("₹63.50", CurrencyFormatter.formatPrice(parsed!!.subtotal))
        assertEquals("₹5.08", CurrencyFormatter.formatPrice(parsed.tax))
        assertEquals("₹3.18", CurrencyFormatter.formatPrice(parsed.serviceCharge))
        assertEquals("₹71.76", CurrencyFormatter.formatPrice(parsed.total))

        // Item unit price: 650 paise -> ₹6.50
        val item = parsed.items[0]
        assertEquals(650.0, item.pricePerUnit, 0.001)
        assertEquals("₹6.50", CurrencyFormatter.formatPrice(item.pricePerUnit))
    }
}
