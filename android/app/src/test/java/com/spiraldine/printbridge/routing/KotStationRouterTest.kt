package com.spiraldine.printbridge.routing

import com.spiraldine.printbridge.model.KotItem
import com.spiraldine.printbridge.model.KotTicket
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class KotStationRouterTest {

    private fun createMultiStationTicket(): KotTicket {
        return KotTicket(
            ticketId = "KOT-9001",
            ticketNumber = "KOT #9001",
            orderId = "ORD-202610-MULTI",
            tableNumber = "Table 12",
            tableName = "Table 12",
            orderType = "Dine-In",
            serverName = "Ramesh",
            customerName = "Gupta Family",
            round = 1,
            isSupplementary = false,
            primaryStation = "Main Kitchen",
            items = listOf(
                KotItem(itemId = "i1", name = "Tandoori Chicken Tikka", quantity = 2, station = "Grill"),
                KotItem(itemId = "i2", name = "Crispy French Fries", quantity = 1, station = "Fryer"),
                KotItem(itemId = "i3", name = "Virgin Mojito", quantity = 2, station = "Bar"),
                KotItem(itemId = "i4", name = "Butter Naan", quantity = 4, station = "Main Kitchen")
            ),
            createdAt = "2026-10-10 18:30:00"
        )
    }

    @Test
    fun routeTicket_whenFilterIsAll_returnsFullTicket() {
        val ticket = createMultiStationTicket()
        val decision = KotStationRouter.routeTicket(ticket, KotStationRouter.STATION_ALL)

        assertTrue(decision is StationRoutingResult.Full)
        val full = (decision as StationRoutingResult.Full).ticket
        assertEquals(4, full.items.size)
        assertEquals("KOT-9001", full.ticketId)
    }

    @Test
    fun routeTicket_whenFilterIsGrill_returnsPartialTicketWithOnlyGrillItems() {
        val ticket = createMultiStationTicket()
        val decision = KotStationRouter.routeTicket(ticket, KotStationRouter.STATION_GRILL)

        assertTrue(decision is StationRoutingResult.Partial)
        val partial = decision as StationRoutingResult.Partial
        assertEquals(1, partial.ticket.items.size)
        assertEquals("Tandoori Chicken Tikka", partial.ticket.items[0].name)
        assertEquals(2, partial.ticket.items[0].quantity)
        assertEquals(KotStationRouter.STATION_GRILL, partial.targetStation)
        assertEquals(4, partial.originalTotalItemCount)
        assertEquals(1, partial.matchingItemCount)
        assertTrue(partial.ticket.primaryStation.contains(KotStationRouter.STATION_GRILL))
    }

    @Test
    fun routeTicket_whenFilterIsFryer_returnsPartialTicketWithOnlyFryerItems() {
        val ticket = createMultiStationTicket()
        val decision = KotStationRouter.routeTicket(ticket, KotStationRouter.STATION_FRYER)

        assertTrue(decision is StationRoutingResult.Partial)
        val partial = decision as StationRoutingResult.Partial
        assertEquals(1, partial.ticket.items.size)
        assertEquals("Crispy French Fries", partial.ticket.items[0].name)
        assertEquals(KotStationRouter.STATION_FRYER, partial.targetStation)
        assertEquals(4, partial.originalTotalItemCount)
        assertEquals(1, partial.matchingItemCount)
    }

    @Test
    fun routeTicket_whenFilterIsBar_returnsPartialTicketWithOnlyBarItems() {
        val ticket = createMultiStationTicket()
        val decision = KotStationRouter.routeTicket(ticket, KotStationRouter.STATION_BAR)

        assertTrue(decision is StationRoutingResult.Partial)
        val partial = decision as StationRoutingResult.Partial
        assertEquals(1, partial.ticket.items.size)
        assertEquals("Virgin Mojito", partial.ticket.items[0].name)
        assertEquals(KotStationRouter.STATION_BAR, partial.targetStation)
        assertEquals(4, partial.originalTotalItemCount)
        assertEquals(1, partial.matchingItemCount)
    }

    @Test
    fun routeTicket_whenFilterIsDessert_andTicketHasNoDessert_returnsExcludedWithoutLoss() {
        val ticket = createMultiStationTicket()
        val decision = KotStationRouter.routeTicket(ticket, KotStationRouter.STATION_DESSERT)

        assertTrue(decision is StationRoutingResult.Excluded)
        val excluded = decision as StationRoutingResult.Excluded
        assertNotNull(excluded.reason)
        assertTrue(excluded.reason.contains("DESSERT"))
        // Original ticket items are preserved and not mutated
        assertEquals(4, ticket.items.size)
    }

    @Test
    fun matchesStation_supportsSynonymsAndAliases() {
        // Bar synonyms
        assertTrue(KotStationRouter.matchesStation("Drinks", KotStationRouter.STATION_BAR))
        assertTrue(KotStationRouter.matchesStation("Beverage Station", KotStationRouter.STATION_BAR))
        assertTrue(KotStationRouter.matchesStation("Bar Counter", KotStationRouter.STATION_BAR))

        // Grill synonyms
        assertTrue(KotStationRouter.matchesStation("Tandoor", KotStationRouter.STATION_GRILL))
        assertTrue(KotStationRouter.matchesStation("Grill Station", KotStationRouter.STATION_GRILL))
        assertTrue(KotStationRouter.matchesStation("BBQ", KotStationRouter.STATION_GRILL))

        // Fryer synonyms
        assertTrue(KotStationRouter.matchesStation("Deep Fry", KotStationRouter.STATION_FRYER))
        assertTrue(KotStationRouter.matchesStation("Fry Station", KotStationRouter.STATION_FRYER))

        // Dessert synonyms
        assertTrue(KotStationRouter.matchesStation("Bakery", KotStationRouter.STATION_DESSERT))
        assertTrue(KotStationRouter.matchesStation("Pastry", KotStationRouter.STATION_DESSERT))
        assertTrue(KotStationRouter.matchesStation("Desserts", KotStationRouter.STATION_DESSERT))

        // Negative check
        assertFalse(KotStationRouter.matchesStation("Grill", KotStationRouter.STATION_BAR))
        assertFalse(KotStationRouter.matchesStation("Drinks", KotStationRouter.STATION_GRILL))
    }
}
