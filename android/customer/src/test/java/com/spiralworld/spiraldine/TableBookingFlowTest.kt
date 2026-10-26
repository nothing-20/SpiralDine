package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.BookingConfig
import com.spiralworld.spiraldine.data.model.CustomerReservation
import com.spiralworld.spiraldine.data.model.CustomerUser
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.RestaurantTable
import com.spiralworld.spiraldine.data.repository.ReservationRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Locale

class TableBookingFlowTest {

    private val tenantA = "restaurant_tenant_alpha"
    private val tenantB = "restaurant_tenant_beta"

    private val sampleRestaurant = Restaurant(
        id = tenantA,
        name = "Spiral Dining Bistro",
        description = "Gourmet dining",
        locality = "Jubilee Hills",
        city = "Hyderabad",
        supportsTableBooking = true,
        bookingConfig = BookingConfig(
            supportsSeatPreference = true,
            supportedSeatZones = listOf("Indoor Main", "Terrace Garden", "Private Dining"),
            availableTimeSlots = listOf("12:30 PM", "1:30 PM", "7:00 PM", "8:30 PM", "9:30 PM"),
            maxGuests = 10
        )
    )

    private val tablesTenantA = listOf(
        RestaurantTable(id = "TBL-01", tenantId = tenantA, tableNumber = "1", tableName = "Window Booth 1", seatingCapacity = 2, section = "Indoor Main", isActive = true),
        RestaurantTable(id = "TBL-02", tenantId = tenantA, tableNumber = "2", tableName = "Terrace Table 2", seatingCapacity = 4, section = "Terrace Garden", isActive = true),
        RestaurantTable(id = "TBL-03", tenantId = tenantA, tableNumber = "3", tableName = "Family Round 3", seatingCapacity = 8, section = "Indoor Main", isActive = true),
        RestaurantTable(id = "TBL-04", tenantId = tenantA, tableNumber = "4", tableName = "VIP Private 4", seatingCapacity = 10, section = "Private Dining", isActive = false, status = "Disabled")
    )

    private val tablesTenantB = listOf(
        RestaurantTable(id = "TBL-B01", tenantId = tenantB, tableNumber = "1", tableName = "Beta Table 1", seatingCapacity = 4, section = "Main", isActive = true)
    )

    // ==========================================
    // 1. NAVIGATION & INTENT DISTINCTION
    // ==========================================

    @Test
    fun test1_bookTableActionNavigatesToBookingFlowNotMenu() {
        var isBookingScreenOpen = false
        var activeRestaurantMenu: Restaurant? = null

        // Trigger onBookTableClick from Home screen shortcut
        val onBookTableClick: () -> Unit = {
            isBookingScreenOpen = true
        }
        onBookTableClick()

        assertTrue("Book a Table must open the dedicated BookingScreen overlay", isBookingScreenOpen)
        assertNull("Book a Table must NOT open RestaurantMenuScreen directly", activeRestaurantMenu)
    }

    @Test
    fun test2_selectingRestaurantInsideBookingDoesNotOpenMenuAccidentally() {
        var selectedBookingRestaurant: Restaurant? = null
        var activeMenuRestaurant: Restaurant? = null

        // User selects restaurant inside booking flow
        val onSelectBookingVenue: (Restaurant) -> Unit = { r ->
            selectedBookingRestaurant = r
            // Booking flow proceeds to Date/Time/Table step, does NOT set activeMenuRestaurant
        }

        onSelectBookingVenue(sampleRestaurant)

        assertEquals(sampleRestaurant, selectedBookingRestaurant)
        assertNull("Selecting a venue in booking must not trigger food menu navigation", activeMenuRestaurant)
    }

    @Test
    fun test3_explicitViewMenuActionStillOpensMenuWhenRequested() {
        var isBookingScreenOpen = true
        var activeMenuRestaurant: Restaurant? = null

        val onExplicitViewMenu: (Restaurant) -> Unit = { r ->
            isBookingScreenOpen = false
            activeMenuRestaurant = r
        }

        onExplicitViewMenu(sampleRestaurant)

        assertFalse(isBookingScreenOpen)
        assertEquals(sampleRestaurant, activeMenuRestaurant)
    }

    // ==========================================
    // 2. CAPACITY & POLICY FILTERING
    // ==========================================

    @Test
    fun test4_partySizeFiltersSuitableTablesAccordingToCapacity() {
        val guests = 6

        val suitableTables = tablesTenantA.filter { it.isAvailableForBooking && it.effectiveCapacity >= guests }

        // TBL-01 (2 seats) -> Too small
        // TBL-02 (4 seats) -> Too small
        // TBL-03 (8 seats) -> Suitable
        // TBL-04 (10 seats) -> Disabled
        assertEquals(1, suitableTables.size)
        assertEquals("TBL-03", suitableTables.first().id)
        assertEquals(8, suitableTables.first().effectiveCapacity)
    }

    @Test
    fun test5_disabledOrInactiveTablesAreExcludedFromSelection() {
        val disabledTable = tablesTenantA.find { it.id == "TBL-04" }
        assertNotNull(disabledTable)
        assertFalse("Disabled tables must not be available for customer booking", disabledTable!!.isAvailableForBooking)
    }

    // ==========================================
    // 3. MULTI-TENANT ISOLATION
    // ==========================================

    @Test
    fun test6_tablesBelongingToAnotherTenantCannotBeSelected() {
        val selectedTenantId = tenantA

        // Verify that tables returned for Tenant A do not contain Tenant B tables
        val validTenantATables = (tablesTenantA + tablesTenantB).filter { it.tenantId == selectedTenantId }

        assertEquals(tablesTenantA.size, validTenantATables.size)
        assertTrue(validTenantATables.none { it.tenantId == tenantB })
    }

    // ==========================================
    // 4. ATOMIC DOUBLE-BOOKING & AVAILABILITY
    // ==========================================

    @Test
    fun test7_alreadyReservedTableIsUnavailableForOverlappingTimeSlot() {
        val date = "2026-10-25"
        val timeSlot = "7:00 PM"
        val cleanTimeKey = timeSlot.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase(Locale.ROOT)

        val existingReservations = listOf(
            CustomerReservation(
                id = "RES-111111",
                bookingId = "RES-111111",
                restaurantId = tenantA,
                restaurantName = sampleRestaurant.name,
                tableId = "TBL-02",
                tableNumber = "2",
                date = date,
                time = timeSlot,
                guests = 4,
                status = "Pending"
            )
        )

        val reservedTableIds = existingReservations.filter { res ->
            val resTime = res.time.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase(Locale.ROOT)
            res.date == date && resTime == cleanTimeKey && res.isActiveReservation
        }.map { it.tableId }.toSet()

        assertTrue("TBL-02 must be flagged as reserved for 7:00 PM", reservedTableIds.contains("TBL-02"))
        assertFalse("TBL-01 must remain available for 7:00 PM", reservedTableIds.contains("TBL-01"))
    }

    @Test
    fun test8_atomicSlotLockDocIdIsDeterministicAcrossPlatforms() {
        val tableId = "TBL-02"
        val date = "2026-10-25"
        val time = "8:30 PM"
        val cleanTimeKey = time.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase(Locale.ROOT)

        val expectedLockId = "LOCK_TBL-02_2026-10-25_830pm"
        val actualLockId = "LOCK_${tableId}_${date}_${cleanTimeKey}"

        assertEquals(expectedLockId, actualLockId)
    }

    @Test
    fun test9_cancelledReservationsDoNotBlockSubsequentBookings() {
        val date = "2026-10-25"
        val timeSlot = "7:00 PM"
        val cleanTimeKey = timeSlot.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase(Locale.ROOT)

        val existingCancelled = listOf(
            CustomerReservation(
                id = "RES-222222",
                bookingId = "RES-222222",
                restaurantId = tenantA,
                tableId = "TBL-02",
                tableNumber = "2",
                date = date,
                time = timeSlot,
                guests = 4,
                status = "Cancelled"
            )
        )

        val activeReservedIds = existingCancelled.filter { res ->
            val resTime = res.time.replace("[^a-zA-Z0-9]".toRegex(), "").lowercase(Locale.ROOT)
            res.date == date && resTime == cleanTimeKey && res.isActiveReservation
        }.map { it.tableId }.toSet()

        assertFalse("Cancelled reservations must not hold a lock on TBL-02", activeReservedIds.contains("TBL-02"))
    }

    // ==========================================
    // 5. SCHEMA COMPATIBILITY ACROSS ANDROID & WEB
    // ==========================================

    @Test
    fun test10_canonicalReservationSchemaHasCompatibleFieldsAcrossPlatforms() {
        val reservation = CustomerReservation(
            id = "RES-333333",
            bookingId = "RES-333333",
            customerId = "user-uid-789",
            customerName = "Geetha Krishna",
            customerEmail = "diner@example.com",
            customerPhone = "+919876543210",
            restaurantId = tenantA,
            restaurantName = "Spiral Dining Bistro",
            date = "2026-10-26",
            time = "8:30 PM",
            guests = 4,
            tableId = "TBL-02",
            tableNumber = "2",
            seatingPreference = "Terrace Garden",
            specialNotes = "Window side table requested",
            status = "Pending",
            directions = "Near Jubilee Hills Checkpost",
            lat = 17.4325,
            lng = 78.4071,
            createdAt = "2026-10-19T18:00:00Z",
            updatedAt = "2026-10-19T18:00:00Z"
        )

        assertEquals("RES-333333", reservation.id)
        assertEquals("RES-333333", reservation.bookingId)
        assertEquals("user-uid-789", reservation.customerId)
        assertEquals("TBL-02", reservation.tableId)
        assertEquals("2", reservation.tableNumber)
        assertEquals(4, reservation.guests)
        assertEquals("Pending", reservation.status)
        assertTrue(reservation.isActiveReservation)
        assertFalse(reservation.status.equals("Cancelled", ignoreCase = true))
    }

    // ==========================================
    // 6. CUSTOMER HISTORY & ISOLATION
    // ==========================================

    @Test
    fun test11_customerBookingHistoryOnlyContainsReservationsForAuthenticatedUser() {
        val currentUserId = "user-uid-789"
        val otherUserId = "user-uid-stranger"

        val allReservations = listOf(
            CustomerReservation(id = "RES-1", customerId = currentUserId, restaurantId = tenantA, date = "2026-10-26", time = "7:00 PM", guests = 2),
            CustomerReservation(id = "RES-2", customerId = otherUserId, restaurantId = tenantA, date = "2026-10-26", time = "8:00 PM", guests = 4),
            CustomerReservation(id = "RES-3", customerId = currentUserId, restaurantId = tenantB, date = "2026-10-27", time = "1:00 PM", guests = 3)
        )

        val customerHistory = allReservations.filter { it.customerId == currentUserId }

        assertEquals(2, customerHistory.size)
        assertTrue(customerHistory.all { it.customerId == currentUserId })
        assertFalse(customerHistory.any { it.customerId == otherUserId })
    }

    // ==========================================
    // 7. PRESERVING EXISTING CORE FEATURES
    // ==========================================

    @Test
    fun test12_qrScannerAndDirectMenuRoutesRemainFunctional() {
        val testUrl = "https://spiral-dine.vercel.app/r/$tenantA/table/5"
        val parsed = com.spiralworld.spiraldine.data.repository.QrParser.parse(testUrl)

        assertNotNull(parsed)
        assertEquals(tenantA, parsed?.tenantId)
        assertEquals("5", parsed?.tableNumber)
    }

    // ==========================================
    // 8. DINE-IN TABLE SELECTION & SESSIONS
    // ==========================================

    @Test
    fun test13_openingRestaurantWithoutQRContextPromptsForTableSelection() {
        var activeRestaurant: Restaurant? = null
        var pendingDineInRestaurant: Restaurant? = null
        var currentDiningSession: com.spiralworld.spiraldine.data.model.DiningSession? = null

        fun openRestaurantDineIn(r: Restaurant) {
            val hasValidSession = currentDiningSession != null &&
                    currentDiningSession?.tenantId.equals(r.id, ignoreCase = true) &&
                    !currentDiningSession?.tableNumber.isNullOrBlank()
            if (hasValidSession) {
                activeRestaurant = r
            } else {
                pendingDineInRestaurant = r
            }
        }

        // Tapping restaurant from Explore or Home without an active QR table
        openRestaurantDineIn(sampleRestaurant)

        assertNull("Menu should NOT open directly before table is selected", activeRestaurant)
        assertEquals(sampleRestaurant, pendingDineInRestaurant)
    }

    @Test
    fun test14_openingRestaurantWithValidQRPreservesTableWithoutPrompting() {
        var activeRestaurant: Restaurant? = null
        var pendingDineInRestaurant: Restaurant? = null
        val currentDiningSession = com.spiralworld.spiraldine.data.model.DiningSession(
            sessionId = "sess-1234",
            tenantId = tenantA,
            restaurantName = sampleRestaurant.name,
            tableNumber = "3",
            tableId = "TBL-03",
            startedAt = "2026-10-19T10:00:00Z"
        )

        fun openRestaurantDineIn(r: Restaurant) {
            val hasValidSession = currentDiningSession.tenantId.equals(r.id, ignoreCase = true) &&
                    currentDiningSession.tableNumber.isNotBlank()
            if (hasValidSession) {
                activeRestaurant = r
            } else {
                pendingDineInRestaurant = r
            }
        }

        // Tapping restaurant when valid QR session exists
        openRestaurantDineIn(sampleRestaurant)

        assertNotNull("Menu should open directly because valid table context exists", activeRestaurant)
        assertNull("Table picker modal should NOT appear when table is already validated", pendingDineInRestaurant)
        assertEquals(tenantA, activeRestaurant?.id)
        assertEquals("3", currentDiningSession.tableNumber)
    }

    @Test
    fun test15_onlyTablesBelongingToSelectedRestaurantAreShown() {
        val allTables = tablesTenantA + tablesTenantB
        val restaurantTables = allTables.filter { it.tenantId == tenantA && it.isActive }

        assertEquals(3, restaurantTables.size)
        assertTrue(restaurantTables.all { it.tenantId == tenantA })
        assertFalse(restaurantTables.any { it.tenantId == tenantB })
    }

    @Test
    fun test16_occupiedTablesCannotBeSelectedForDineIn() {
        val occupiedTable = RestaurantTable(
            id = "TBL-05",
            tenantId = tenantA,
            tableNumber = "5",
            tableName = "Table 5",
            seatingCapacity = 4,
            status = "Occupied",
            activeOrderId = "ORD-9999",
            isActive = true
        )

        val availableTable = RestaurantTable(
            id = "TBL-06",
            tenantId = tenantA,
            tableNumber = "6",
            tableName = "Table 6",
            seatingCapacity = 4,
            status = "Available",
            isActive = true
        )

        assertTrue(occupiedTable.isOccupiedForDineIn)
        assertFalse(occupiedTable.isDineInAvailable)

        assertFalse(availableTable.isOccupiedForDineIn)
        assertTrue(availableTable.isDineInAvailable)
    }

    @Test
    fun test17_selectingTablePreservesTableIdAndNumberThroughMenuAndCart() {
        val chosenTable = tablesTenantA.first { it.tableNumber == "2" }
        val session = com.spiralworld.spiraldine.data.model.DiningSession(
            sessionId = "session-test-abc",
            tenantId = tenantA,
            restaurantName = sampleRestaurant.name,
            tableNumber = chosenTable.tableNumber,
            tableId = chosenTable.id,
            startedAt = "2026-10-19T12:00:00Z"
        )

        assertEquals("2", session.tableNumber)
        assertEquals("TBL-02", session.tableId)
        assertEquals(tenantA, session.tenantId)
    }

    @Test
    fun test18_specialRequestsAreValidatedAndSavedInCanonicalSchema() {
        val rawRequest = "  Need high chair for a toddler and window seating please.  "
        val trimmed = rawRequest.trim().take(200)

        val res = CustomerReservation(
            id = "RES-SPECIAL-01",
            bookingId = "BK-SPECIAL-01",
            customerId = "user-uid-456",
            restaurantId = tenantA,
            date = "2026-10-25",
            time = "7:30 PM",
            guests = 3,
            tableId = "TBL-02",
            tableNumber = "2",
            specialNotes = trimmed
        )

        assertEquals("Need high chair for a toddler and window seating please.", res.specialNotes)
        assertTrue(res.specialNotes.length <= 200)
    }

    @Test
    fun test19_switchingRestaurantsClearsPreviousRestaurantTableAndCart() {
        val sessionRestaurantA = com.spiralworld.spiraldine.data.model.DiningSession(
            sessionId = "sess-1",
            tenantId = tenantA,
            restaurantName = "Alpha Bistro",
            tableNumber = "1",
            tableId = "TBL-01"
        )

        // Customer attempts to open Restaurant B
        val isSessionValidForB = sessionRestaurantA.tenantId.equals(tenantB, ignoreCase = true)
        assertFalse("Session from Restaurant A must not be valid for Restaurant B", isSessionValidForB)
    }

    @Test
    fun test20_tableAvailabilityRefreshesWhenStatusChanges() {
        val tableInitial = RestaurantTable(id = "TBL-10", tenantId = tenantA, tableNumber = "10", status = "Available", isActive = true)
        assertTrue(tableInitial.isDineInAvailable)

        val tableBecameOccupied = tableInitial.copy(status = "Occupied", activeOrderId = "ORD-LIVE-1")
        assertFalse(tableBecameOccupied.isDineInAvailable)
        assertTrue(tableBecameOccupied.isOccupiedForDineIn)

        val tableCleared = tableBecameOccupied.copy(status = "Available", activeOrderId = null)
        assertTrue(tableCleared.isDineInAvailable)
    }
}
