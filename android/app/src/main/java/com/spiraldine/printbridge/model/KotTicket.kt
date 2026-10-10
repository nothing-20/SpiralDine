package com.spiraldine.printbridge.model

/**
 * Represents a single item on a Kitchen Order Ticket.
 */
data class KotItem(
    val itemId: String,
    val name: String,
    val quantity: Int,
    val notes: String? = null,
    val station: String? = null
)

/**
 * Canonical data model for formatting and queuing Kitchen Order Tickets.
 */
data class KotTicket(
    val ticketId: String,
    val ticketNumber: String,
    val orderId: String,
    val tableNumber: String,
    val tableName: String? = null,
    val orderType: String = "Dine-In",
    val serverName: String? = null,
    val customerName: String? = null,
    val round: Int = 1,
    val isSupplementary: Boolean = false,
    val primaryStation: String = "Main Kitchen",
    val items: List<KotItem>,
    val createdAt: String,
    val isReprint: Boolean = false,
    val reprintCount: Int = 0
)

/**
 * Paper width options for ESC/POS thermal printers.
 */
enum class ThermalPaperWidth(val lineLength: Int) {
    WIDTH_58MM(32),
    WIDTH_80MM(48)
}
