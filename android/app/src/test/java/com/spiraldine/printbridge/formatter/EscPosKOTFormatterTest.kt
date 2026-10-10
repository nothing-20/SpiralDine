package com.spiraldine.printbridge.formatter

import com.spiraldine.printbridge.model.KotItem
import com.spiraldine.printbridge.model.KotTicket
import com.spiraldine.printbridge.model.ThermalPaperWidth
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.charset.Charset

class EscPosKOTFormatterTest {

    private val formatter = EscPosKOTFormatter()
    private val charset = Charset.forName("CP437")

    private fun createSampleTicket(
        isSupplementary: Boolean = false,
        round: Int = 1,
        isReprint: Boolean = false,
        reprintCount: Int = 0,
        items: List<KotItem> = listOf(
            KotItem("item-1", "Chicken Biryani", 2, "Extra spicy, no raita", "GRILL"),
            KotItem("item-2", "Paneer Butter Masala", 1, null, "CURRY")
        )
    ): KotTicket {
        return KotTicket(
            ticketId = "KOT-ORD-202610-R$round",
            ticketNumber = "KOT #101",
            orderId = "ORD-202610-5kWDAL",
            tableNumber = "1",
            tableName = "Table 1 (Dine-In)",
            orderType = "Dine-In",
            serverName = "Geetha Krishna",
            customerName = "Guest Diner",
            round = round,
            isSupplementary = isSupplementary,
            primaryStation = "Main Kitchen",
            items = items,
            createdAt = "Oct 10, 2026 12:18:22 PM",
            isReprint = isReprint,
            reprintCount = reprintCount
        )
    }

    @Test
    fun formatKot_containsRequiredEscPosControlBytes() {
        val ticket = createSampleTicket()
        val bytes = formatter.formatKot(ticket, ThermalPaperWidth.WIDTH_80MM)

        // 1. Must start with ESC @ (0x1B, 0x40)
        assertEquals(0x1B.toByte(), bytes[0])
        assertEquals(0x40.toByte(), bytes[1])

        // 2. Must end with Feed & Partial Cut: GS V 66 0 (0x1D, 0x56, 0x42, 0x00)
        val len = bytes.size
        assertEquals(0x1D.toByte(), bytes[len - 4])
        assertEquals(0x56.toByte(), bytes[len - 3])
        assertEquals(0x42.toByte(), bytes[len - 2])
        assertEquals(0x00.toByte(), bytes[len - 1])

        // 3. Must NOT contain drawer kick command ESC p (0x1B, 0x70)
        var hasDrawerKick = false
        for (i in 0 until bytes.size - 1) {
            if (bytes[i] == 0x1B.toByte() && bytes[i + 1] == 0x70.toByte()) {
                hasDrawerKick = true
                break
            }
        }
        assertFalse("KOT thermal slip must NOT trigger cash drawer opening", hasDrawerKick)
    }

    @Test
    fun formatKot_initialOrder_hasInitialLabelAndNoReprintBanner() {
        val ticket = createSampleTicket(isSupplementary = false, round = 1, isReprint = false)
        val text = String(formatter.formatKot(ticket, ThermalPaperWidth.WIDTH_80MM), charset)

        assertTrue(text.contains("SPIRALDINE KITCHEN"))
        assertTrue(text.contains("KOT #101"))
        assertTrue(text.contains("[INITIAL KOT (ROUND #1)]"))
        assertTrue(text.contains("TABLE 1 (DINE-IN)"))
        assertTrue(text.contains("Chicken Biryani"))
        assertTrue(text.contains("x2"))
        assertTrue(text.contains("Extra spicy, no raita"))
        assertFalse(text.contains("*** DUPLICATE / REPRINT"))
    }

    @Test
    fun formatKot_supplementaryOrder_showsSupplementaryLabelAndOnlyNewItems() {
        // Supplementary round: ONLY newly added item (Dessert)
        val suppTicket = createSampleTicket(
            isSupplementary = true,
            round = 2,
            items = listOf(KotItem("item-3", "Gulab Jamun (2 pcs)", 1, "Warm with syrup", "DESSERT"))
        )
        val text = String(formatter.formatKot(suppTicket, ThermalPaperWidth.WIDTH_80MM), charset)

        assertTrue(text.contains("[SUPPLEMENTARY KOT (ROUND #2)]"))
        assertTrue(text.contains("Gulab Jamun (2 pcs)"))
        assertTrue(text.contains("x1"))
        assertTrue(text.contains("Warm with syrup"))
        // Previous round items MUST NOT be included
        assertFalse(text.contains("Chicken Biryani"))
        assertFalse(text.contains("Paneer Butter Masala"))
        assertTrue(text.contains("TOTAL ITEMS: 1"))
    }

    @Test
    fun formatKot_reprint_rendersExplicitReprintBanner() {
        val reprintTicket = createSampleTicket(isReprint = true, reprintCount = 1)
        val text = String(formatter.formatKot(reprintTicket, ThermalPaperWidth.WIDTH_80MM), charset)

        assertTrue("Must contain prominent duplicate banner", text.contains("*** DUPLICATE / REPRINT #1 ***"))
        assertTrue(text.contains("KOT #101"))
    }

    @Test
    fun formatKot_reprintMultiple_showsIncrementedCount() {
        val reprintTicket = createSampleTicket(isReprint = true, reprintCount = 3)
        val text = String(formatter.formatKot(reprintTicket, ThermalPaperWidth.WIDTH_80MM), charset)

        assertTrue(text.contains("*** DUPLICATE / REPRINT #3 ***"))
    }

    @Test
    fun formatKot_58mm_respects32ColumnLineWidth() {
        val ticket = createSampleTicket()
        val text = String(formatter.formatKot(ticket, ThermalPaperWidth.WIDTH_58MM), charset)

        // Separator lines in 58mm must be exactly 32 characters
        assertTrue(text.contains("=".repeat(32)))
        assertTrue(text.contains("-".repeat(32)))
        assertFalse(text.contains("-".repeat(48)))
    }

    @Test
    fun formatKot_80mm_respects48ColumnLineWidth() {
        val ticket = createSampleTicket()
        val text = String(formatter.formatKot(ticket, ThermalPaperWidth.WIDTH_80MM), charset)

        // Separator lines in 80mm must be 48 characters
        assertTrue(text.contains("=".repeat(48)))
        assertTrue(text.contains("-".repeat(48)))
    }

    @Test
    fun wrapText_handlesLongNotesAndItemNamesWithoutTruncation() {
        val longNote = "Please ensure the chicken is cooked thoroughly with extra green chili slices and zero mayonnaise"
        val wrapped = formatter.wrapText(longNote, 30)

        // All lines must be <= 30 characters
        for (line in wrapped) {
            assertTrue("Line '${line}' exceeds 30 chars: ${line.length}", line.length <= 30)
        }
        // Combined text must preserve all words
        val reconstructed = wrapped.joinToString(" ")
        assertEquals(longNote, reconstructed)
    }

    @Test
    fun formatKot_handlesEmptyItemsSafely() {
        val emptyTicket = createSampleTicket(items = emptyList())
        val bytes = formatter.formatKot(emptyTicket, ThermalPaperWidth.WIDTH_80MM)

        val text = String(bytes, charset)
        assertTrue(text.contains("TOTAL ITEMS: 0"))
        assertTrue(text.contains("SPIRALDINE KITCHEN"))
    }
}
