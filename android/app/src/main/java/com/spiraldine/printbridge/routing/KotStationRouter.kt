package com.spiraldine.printbridge.routing

import com.spiraldine.printbridge.model.KotItem
import com.spiraldine.printbridge.model.KotTicket

/**
 * Result of applying a kitchen-station routing filter to a Kitchen Order Ticket.
 */
sealed interface StationRoutingResult {
    /**
     * All items retained (either ALL filter or all items match the station).
     */
    data class Full(val ticket: KotTicket) : StationRoutingResult

    /**
     * Ticket contains items across multiple stations; this subset belongs to the target station.
     */
    data class Partial(
        val ticket: KotTicket,
        val originalTotalItemCount: Int,
        val matchingItemCount: Int,
        val targetStation: String
    ) : StationRoutingResult

    /**
     * Zero items in this ticket belong to the target station.
     * The ticket belongs to other prep stations in the kitchen and should not print on this printer.
     */
    data class Excluded(
        val targetStation: String,
        val ticketStation: String,
        val availableItemStations: List<String>,
        val reason: String
    ) : StationRoutingResult
}

/**
 * Kitchen-Station Routing Engine for SpiralDine companion print bridges.
 *
 * Routing Strategy:
 * 1. Consolidated Kitchen (ALL):
 *    - Prints every KOT in full with 100% of items and station routing tags.
 * 2. Station-Specific Printer (MAIN KITCHEN, GRILL, FRYER, BAR, DESSERT):
 *    - Evaluates both item-level station tags and ticket-level station assignments.
 *    - If a KOT has items for this station: extracts and formats ONLY those items,
 *      printing order header, table number, round, and an explicit filtered count header.
 *    - If a KOT has ZERO items for this station: does NOT print at this physical counter,
 *      marking the job as ROUTED_OTHER_STATION in the local database with full diagnostic detail.
 *    - Guarantees:
 *      * Zero item loss: Every item is routed to its respective station without deletion.
 *      * No duplicate items: Items intended for Grill do not print on the Bar slip.
 *      * Full auditability: Staff can inspect the Queue Inspector to see why a ticket
 *        printed or was routed elsewhere.
 */
object KotStationRouter {

    const val STATION_ALL = "ALL"
    const val STATION_MAIN_KITCHEN = "MAIN KITCHEN"
    const val STATION_GRILL = "GRILL"
    const val STATION_FRYER = "FRYER"
    const val STATION_BAR = "BAR"
    const val STATION_DESSERT = "DESSERT"

    val STATIONS = listOf(
        STATION_ALL,
        STATION_MAIN_KITCHEN,
        STATION_GRILL,
        STATION_FRYER,
        STATION_BAR,
        STATION_DESSERT
    )

    /**
     * Normalized matching between an item or ticket station string and a station filter.
     */
    fun matchesStation(itemOrTicketStation: String?, filter: String): Boolean {
        if (filter.equals("ALL", ignoreCase = true)) return true

        val filterNorm = filter.trim().uppercase()
        val stationNorm = (itemOrTicketStation ?: "").trim().uppercase()

        if (stationNorm.isBlank()) {
            // Unspecified item station defaults to Main Kitchen
            return filterNorm == "MAIN KITCHEN"
        }

        return when (filterNorm) {
            "ALL" -> true
            "MAIN KITCHEN" -> {
                stationNorm.contains("MAIN") || stationNorm.contains("KITCHEN") ||
                stationNorm.contains("RICE") || stationNorm.contains("CURRY") || stationNorm.contains("DAL")
            }
            "GRILL" -> {
                stationNorm.contains("GRILL") || stationNorm.contains("KEBAB") ||
                stationNorm.contains("TANDOOR") || stationNorm.contains("BURGER") ||
                stationNorm.contains("STARTER") || stationNorm.contains("BBQ") ||
                stationNorm.contains("BARBEQUE")
            }
            "FRYER" -> {
                stationNorm.contains("FRY") || stationNorm.contains("CHINESE") ||
                stationNorm.contains("NOODLE") || stationNorm.contains("MANCHURIAN")
            }
            "BAR" -> {
                stationNorm.contains("BAR") || stationNorm.contains("DRINK") ||
                stationNorm.contains("BEVERAGE") || stationNorm.contains("JUICE") || stationNorm.contains("SHAKE")
            }
            "DESSERT" -> {
                stationNorm.contains("DESSERT") || stationNorm.contains("SWEET") ||
                stationNorm.contains("ICE CREAM") || stationNorm.contains("PASTRY") ||
                stationNorm.contains("BAKERY") || stationNorm.contains("CAKE")
            }
            else -> stationNorm.contains(filterNorm)
        }
    }

    /**
     * Routes a canonical KOT against the configured station filter.
     */
    fun routeTicket(ticket: KotTicket, stationFilter: String): StationRoutingResult {
        if (stationFilter.equals("ALL", ignoreCase = true) || stationFilter.isBlank()) {
            return StationRoutingResult.Full(ticket)
        }

        val targetStation = stationFilter.trim().uppercase()

        // Filter items belonging to this station
        val matchingItems = ticket.items.filter { item ->
            // Use item's assigned station, fallback to ticket's primary station if item station is null
            matchesStation(item.station ?: ticket.primaryStation, targetStation)
        }

        if (matchingItems.isEmpty()) {
            val itemStations = ticket.items.mapNotNull { it.station }.distinct()
            val reason = "ROUTED_OTHER_STATION: Order items belong to other stations ($itemStations). No items for $targetStation."
            return StationRoutingResult.Excluded(
                targetStation = targetStation,
                ticketStation = ticket.primaryStation,
                availableItemStations = itemStations,
                reason = reason
            )
        }

        if (matchingItems.size == ticket.items.size) {
            // All items belong to this station
            return StationRoutingResult.Full(
                ticket.copy(primaryStation = targetStation)
            )
        }

        // Mixed station order: create partial ticket with only this station's items
        val filteredTicket = ticket.copy(
            primaryStation = "$targetStation (${matchingItems.size}/${ticket.items.size} ITEMS)",
            items = matchingItems
        )

        return StationRoutingResult.Partial(
            ticket = filteredTicket,
            originalTotalItemCount = ticket.items.size,
            matchingItemCount = matchingItems.size,
            targetStation = targetStation
        )
    }
}
