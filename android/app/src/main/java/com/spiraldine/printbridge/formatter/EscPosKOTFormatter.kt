package com.spiraldine.printbridge.formatter

import com.spiraldine.printbridge.model.KotItem
import com.spiraldine.printbridge.model.KotTicket
import com.spiraldine.printbridge.model.ThermalPaperWidth
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset

/**
 * Native ESC/POS binary command generator for Kitchen Order Tickets.
 * Formats standardized thermal slips tailored for 80mm (48 columns) and 58mm (32 columns) rolls.
 *
 * Compatibility Assumptions:
 * - Emits standard ESC/POS commands supported by Epson, TVS, Star Micronics, Posiflex, and generic Chinese POS printers.
 * - Standard Code Page 0 (CP437) / ASCII encoding for binary safety across low-cost Bluetooth and Ethernet thermal micro-controllers.
 * - Explicitly avoids drawer kick commands (ESC p).
 */
class EscPosKOTFormatter(
    private val charset: Charset = Charset.forName("CP437")
) {

    companion object {
        // ESC/POS Command Byte Constants
        val ESC_INIT = byteArrayOf(0x1B, 0x40) // ESC @ : Initialize printer
        val ALIGN_LEFT = byteArrayOf(0x1B, 0x61, 0x00) // ESC a 0
        val ALIGN_CENTER = byteArrayOf(0x1B, 0x61, 0x01) // ESC a 1
        val ALIGN_RIGHT = byteArrayOf(0x1B, 0x61, 0x02) // ESC a 2
        val BOLD_ON = byteArrayOf(0x1B, 0x45, 0x01) // ESC E 1
        val BOLD_OFF = byteArrayOf(0x1B, 0x45, 0x00) // ESC E 0
        val FONT_DOUBLE_SIZE = byteArrayOf(0x1D, 0x21, 0x11) // GS ! 0x11 (Double width + height)
        val FONT_DOUBLE_HEIGHT = byteArrayOf(0x1D, 0x21, 0x01) // GS ! 0x01 (Double height)
        val FONT_NORMAL = byteArrayOf(0x1D, 0x21, 0x00) // GS ! 0x00 (Normal)
        val FEED_3_LINES = byteArrayOf(0x1B, 0x64, 0x03) // ESC d 3
        val PARTIAL_CUT = byteArrayOf(0x1D, 0x56, 0x42, 0x00) // GS V 66 0 : Feed and partial cut
        const val LF = 0x0A.toByte()
    }

    /**
     * Formats a complete Kitchen Order Ticket into raw ESC/POS bytes.
     *
     * @param ticket The canonical KOT ticket model.
     * @param paperWidth Target paper width (58mm or 80mm).
     * @return Byte array ready to send over Bluetooth RFCOMM, TCP socket, or USB endpoints.
     */
    fun formatKot(ticket: KotTicket, paperWidth: ThermalPaperWidth = ThermalPaperWidth.WIDTH_80MM): ByteArray {
        val stream = ByteArrayOutputStream()
        val width = paperWidth.lineLength

        // 1. Initialize printer
        stream.write(ESC_INIT)

        // 2. Duplicate / Reprint Watermark Banner (if applicable)
        if (ticket.isReprint) {
            stream.write(ALIGN_CENTER)
            stream.write(BOLD_ON)
            stream.write(FONT_NORMAL)
            val bannerBorder = "*".repeat(width)
            stream.writeTextLn(bannerBorder)
            val countStr = if (ticket.reprintCount > 0) "#${ticket.reprintCount}" else "#1"
            stream.writeTextLn("*** DUPLICATE / REPRINT $countStr ***")
            stream.writeTextLn(bannerBorder)
            stream.write(BOLD_OFF)
            stream.writeLf()
        }

        // 3. Header: Restaurant Title & KOT Number
        stream.write(ALIGN_CENTER)
        stream.write(BOLD_ON)
        stream.write(FONT_NORMAL)
        stream.writeTextLn("SPIRALDINE KITCHEN")

        // KOT Number in large double-sized text
        stream.write(FONT_DOUBLE_SIZE)
        stream.writeTextLn(ticket.ticketNumber)

        // Round / Supplementary status tag
        stream.write(FONT_NORMAL)
        if (ticket.isSupplementary) {
            stream.writeTextLn("[SUPPLEMENTARY KOT (ROUND #${ticket.round})]")
        } else {
            stream.writeTextLn("[INITIAL KOT (ROUND #1)]")
        }
        stream.write(BOLD_OFF)
        stream.write(ALIGN_LEFT)
        stream.writeTextLn("=".repeat(width))

        // 4. Destination Context (Table / Order Destination)
        stream.write(ALIGN_CENTER)
        stream.write(BOLD_ON)
        stream.write(FONT_DOUBLE_HEIGHT)
        val tableText = if (ticket.tableName != null && ticket.tableName.isNotBlank()) {
            ticket.tableName.uppercase()
        } else {
            "TABLE: ${ticket.tableNumber}"
        }
        stream.writeTextLn(tableText)
        stream.write(FONT_NORMAL)
        stream.write(BOLD_OFF)
        stream.write(ALIGN_LEFT)
        stream.writeTextLn("=".repeat(width))

        // 5. Metadata Block
        stream.write(FONT_NORMAL)
        stream.writeTextLn("Date & Time:    ${ticket.createdAt}")
        stream.writeTextLn("Order Ref:      #${ticket.orderId}")
        stream.writeTextLn("Station:        ${ticket.primaryStation}")
        if (!ticket.serverName.isNullOrBlank()) {
            stream.writeTextLn("Server:         ${ticket.serverName}")
        }
        if (!ticket.customerName.isNullOrBlank()) {
            stream.writeTextLn("Customer:       ${ticket.customerName}")
        }
        stream.writeTextLn("Order Type:     ${ticket.orderType}")
        stream.writeTextLn("-".repeat(width))

        // 6. Item List Table Header
        stream.write(BOLD_ON)
        stream.writeTextLn(formatTwoColumns("ITEM / MODIFICATIONS", "QTY", width))
        stream.write(BOLD_OFF)
        stream.writeTextLn("-".repeat(width))

        // 7. Render Items
        var totalQuantity = 0
        ticket.items.forEachIndexed { index, item ->
            totalQuantity += item.quantity
            renderItem(stream, index + 1, item, width)
        }

        // 8. Footer & Summary
        stream.writeTextLn("-".repeat(width))
        stream.write(ALIGN_CENTER)
        stream.write(BOLD_ON)
        stream.writeTextLn("TOTAL ITEMS: $totalQuantity")
        stream.write(BOLD_OFF)
        stream.write(FONT_NORMAL)
        stream.writeTextLn("SpiralDine Autonomous Print Bridge")

        // 9. Feed & Cut
        stream.write(FEED_3_LINES)
        stream.write(PARTIAL_CUT)

        return stream.toByteArray()
    }

    private fun renderItem(stream: ByteArrayOutputStream, itemIndex: Int, item: KotItem, lineWidth: Int) {
        val qtyText = "x${item.quantity}"
        val itemPrefix = "$itemIndex. "
        val availableNameWidth = lineWidth - qtyText.length - 1

        val fullName = itemPrefix + item.name
        if (fullName.length <= availableNameWidth) {
            // Fits on one line
            stream.write(BOLD_ON)
            stream.writeTextLn(formatTwoColumns(fullName, qtyText, lineWidth))
            stream.write(BOLD_OFF)
        } else {
            // Wrap item name across multiple lines
            val wrappedLines = wrapText(fullName, availableNameWidth)
            stream.write(BOLD_ON)
            // First line prints with quantity aligned right
            stream.writeTextLn(formatTwoColumns(wrappedLines[0], qtyText, lineWidth))
            // Subsequent lines print on their own lines
            for (i in 1 until wrappedLines.size) {
                stream.writeTextLn("   ${wrappedLines[i]}")
            }
            stream.write(BOLD_OFF)
        }

        // Station info (if specific)
        if (!item.station.isNullOrBlank()) {
            stream.writeTextLn("   Station: ${item.station}")
        }

        // Item Kitchen Instructions / Notes
        if (!item.notes.isNullOrBlank()) {
            stream.write(BOLD_ON)
            val notePrefix = "   * Note: "
            val wrappedNotes = wrapText(item.notes, lineWidth - notePrefix.length)
            wrappedNotes.forEachIndexed { idx, noteLine ->
                if (idx == 0) {
                    stream.writeTextLn(notePrefix + noteLine)
                } else {
                    stream.writeTextLn("           $noteLine")
                }
            }
            stream.write(BOLD_OFF)
        }
    }

    /**
     * Formats two strings to sit on the left and right edges of a line.
     */
    fun formatTwoColumns(left: String, right: String, totalWidth: Int): String {
        val spaceCount = totalWidth - left.length - right.length
        return if (spaceCount > 0) {
            left + " ".repeat(spaceCount) + right
        } else {
            // If they collide, right takes priority, truncate left cleanly
            val safeLeft = left.take((totalWidth - right.length - 1).coerceAtLeast(0))
            val spaces = (totalWidth - safeLeft.length - right.length).coerceAtLeast(1)
            safeLeft + " ".repeat(spaces) + right
        }
    }

    /**
     * Wraps text by words so no word is abruptly split across lines.
     */
    fun wrapText(text: String, maxWidth: Int): List<String> {
        if (maxWidth <= 0) return listOf(text)
        if (text.length <= maxWidth) return listOf(text)

        val words = text.split(" ")
        val lines = mutableListOf<String>()
        var currentLine = StringBuilder()

        for (word in words) {
            if (currentLine.isEmpty()) {
                if (word.length > maxWidth) {
                    // Word itself exceeds maxWidth, hard chop
                    lines.addAll(word.chunked(maxWidth))
                } else {
                    currentLine.append(word)
                }
            } else if (currentLine.length + 1 + word.length <= maxWidth) {
                currentLine.append(" ").append(word)
            } else {
                lines.add(currentLine.toString())
                currentLine = StringBuilder()
                if (word.length > maxWidth) {
                    lines.addAll(word.chunked(maxWidth))
                } else {
                    currentLine.append(word)
                }
            }
        }
        if (currentLine.isNotEmpty()) {
            lines.add(currentLine.toString())
        }
        return lines
    }

    private fun ByteArrayOutputStream.writeTextLn(text: String) {
        val bytes = text.toByteArray(charset)
        write(bytes)
        write(LF.toInt())
    }

    private fun ByteArrayOutputStream.writeLf() {
        write(LF.toInt())
    }
}
