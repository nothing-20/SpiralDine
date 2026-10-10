package com.spiraldine.printbridge.model

/**
 * Pure Kotlin serializer and deserializer for KotTicket models.
 * Operates without android.jar platform stubs so it executes cleanly on both
 * local JVM unit tests and Android runtime environments.
 */
object KotTicketJson {

    fun toJson(ticket: KotTicket): String {
        val itemsJson = ticket.items.joinToString(",") { item ->
            """{"itemId":"${escape(item.itemId)}","name":"${escape(item.name)}","quantity":${item.quantity},"notes":${quoteOrNull(item.notes)},"station":${quoteOrNull(item.station)}}"""
        }

        return """{"ticketId":"${escape(ticket.ticketId)}","ticketNumber":"${escape(ticket.ticketNumber)}","orderId":"${escape(ticket.orderId)}","tableNumber":"${escape(ticket.tableNumber)}","tableName":${quoteOrNull(ticket.tableName)},"orderType":"${escape(ticket.orderType)}","serverName":${quoteOrNull(ticket.serverName)},"customerName":${quoteOrNull(ticket.customerName)},"round":${ticket.round},"isSupplementary":${ticket.isSupplementary},"primaryStation":"${escape(ticket.primaryStation)}","createdAt":"${escape(ticket.createdAt)}","isReprint":${ticket.isReprint},"reprintCount":${ticket.reprintCount},"items":[$itemsJson]}"""
    }

    fun fromJson(jsonStr: String): KotTicket {
        val trimmed = jsonStr.trim()
        if (!trimmed.startsWith("{")) {
            return parseLegacyFormat(trimmed)
        }

        val ticketId = extractString(trimmed, "ticketId") ?: "UNKNOWN"
        val ticketNumber = extractString(trimmed, "ticketNumber") ?: "KOT #0"
        val orderId = extractString(trimmed, "orderId") ?: "ORD-UNKNOWN"
        val tableNumber = extractString(trimmed, "tableNumber") ?: "0"
        val tableName = extractString(trimmed, "tableName")
        val orderType = extractString(trimmed, "orderType") ?: "Dine-In"
        val serverName = extractString(trimmed, "serverName")
        val customerName = extractString(trimmed, "customerName")
        val round = extractInt(trimmed, "round", 1)
        val isSupplementary = extractBoolean(trimmed, "isSupplementary", false)
        val primaryStation = extractString(trimmed, "primaryStation") ?: "Kitchen"
        val createdAt = extractString(trimmed, "createdAt") ?: ""
        val isReprint = extractBoolean(trimmed, "isReprint", false)
        val reprintCount = extractInt(trimmed, "reprintCount", 0)

        val items = parseItems(trimmed)

        return KotTicket(
            ticketId = ticketId,
            ticketNumber = ticketNumber,
            orderId = orderId,
            tableNumber = tableNumber,
            tableName = tableName,
            orderType = orderType,
            serverName = serverName,
            customerName = customerName,
            round = round,
            isSupplementary = isSupplementary,
            primaryStation = primaryStation,
            items = items,
            createdAt = createdAt,
            isReprint = isReprint,
            reprintCount = reprintCount
        )
    }

    private fun parseItems(json: String): List<KotItem> {
        val itemsIndex = json.indexOf("\"items\":[")
        if (itemsIndex == -1) return emptyList()

        val arrayStart = json.indexOf('[', itemsIndex)
        if (arrayStart == -1) return emptyList()

        val arrayEnd = json.lastIndexOf(']')
        if (arrayEnd <= arrayStart) return emptyList()

        val itemsContent = json.substring(arrayStart + 1, arrayEnd).trim()
        if (itemsContent.isBlank()) return emptyList()

        // Extract individual JSON objects in array
        val results = mutableListOf<KotItem>()
        val itemObjRegex = """\{"itemId":"(.*?)","name":"(.*?)","quantity":(\d+)(?:,"notes":(null|".*?"))?(?:,"station":(null|".*?"))?\}""".toRegex()
        val matches = itemObjRegex.findAll(itemsContent)

        for (match in matches) {
            val itemId = unescape(match.groupValues[1])
            val name = unescape(match.groupValues[2])
            val quantity = match.groupValues[3].toIntOrNull() ?: 1
            val rawNotes = match.groupValues.getOrNull(4)
            val notes = if (rawNotes == null || rawNotes == "null") null else unescape(rawNotes.removeSurrounding("\""))
            val rawStation = match.groupValues.getOrNull(5)
            val station = if (rawStation == null || rawStation == "null") null else unescape(rawStation.removeSurrounding("\""))

            results.add(KotItem(itemId, name, quantity, notes, station))
        }

        return results
    }

    private fun extractString(json: String, key: String): String? {
        val regex = """"$key":\s*"([^"\\]*(?:\\.[^"\\]*)*)"""".toRegex()
        val match = regex.find(json)
        return match?.groupValues?.get(1)?.let { unescape(it) }
    }

    private fun extractInt(json: String, key: String, default: Int): Int {
        val regex = """"$key":\s*(-?\d+)""".toRegex()
        return regex.find(json)?.groupValues?.get(1)?.toIntOrNull() ?: default
    }

    private fun extractBoolean(json: String, key: String, default: Boolean): Boolean {
        val regex = """"$key":\s*(true|false)""".toRegex()
        return regex.find(json)?.groupValues?.get(1)?.toBoolean() ?: default
    }

    private fun parseLegacyFormat(legacyStr: String): KotTicket {
        val parts = legacyStr.split("|").associate {
            val kv = it.split("=", limit = 2)
            if (kv.size == 2) kv[0] to kv[1] else kv[0] to ""
        }

        val items = mutableListOf<KotItem>()
        val rawItems = parts["ITEMS"]?.removeSurrounding("[", "]") ?: ""
        if (rawItems.isNotBlank()) {
            rawItems.split(";").forEachIndexed { idx, rawItem ->
                val itemParts = rawItem.split(":")
                val name = itemParts.getOrElse(0) { "Item" }
                val qty = itemParts.getOrNull(1)?.toIntOrNull() ?: 1
                items.add(KotItem("item-$idx", name, qty))
            }
        }

        return KotTicket(
            ticketId = parts["TICKET_ID"] ?: "UNKNOWN",
            ticketNumber = "KOT #" + (parts["TICKET_ID"] ?: "0"),
            orderId = parts["ORDER"] ?: "ORD-UNKNOWN",
            tableNumber = parts["TABLE"] ?: "0",
            round = 1,
            isSupplementary = false,
            primaryStation = "Kitchen",
            items = items,
            createdAt = "",
            isReprint = parts["REPRINT"]?.toBoolean() ?: false,
            reprintCount = 0
        )
    }

    private fun escape(s: String): String {
        return s.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t")
    }

    private fun unescape(s: String): String {
        return s.replace("\\\"", "\"")
            .replace("\\\\", "\\")
            .replace("\\n", "\n")
            .replace("\\r", "\r")
            .replace("\\t", "\t")
    }

    private fun quoteOrNull(s: String?): String {
        return if (s == null) "null" else "\"${escape(s)}\""
    }
}
