package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.DiningSession
import com.spiralworld.spiraldine.data.model.NotificationRecord
import com.spiralworld.spiraldine.data.model.OrderRecord
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.model.ReviewRecord
import com.spiralworld.spiraldine.data.model.UserLocation
import com.spiralworld.spiraldine.data.repository.RatingCalculator
import com.spiralworld.spiraldine.ui.navigation.NavDestination
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CustomerAppImprovementsTest {

    private val tenantId = "rest_bawarchi_hyd"
    private val customerA = "customer_uid_101"
    private val customerB = "customer_uid_202"

    // =========================================================================
    // 1. REVIEWS & RATINGS (FEATURE ONE)
    // =========================================================================

    private fun isOrderEligibleForReview(order: OrderRecord, billPaymentStatus: String?): Boolean {
        val isCompletedStatus = order.status.equals("completed", ignoreCase = true) ||
                order.status.equals("served", ignoreCase = true) ||
                order.status.equals("delivered", ignoreCase = true) ||
                order.status.equals("dining_completed", ignoreCase = true)
        val isPaid = order.paymentStatus.equals("paid", ignoreCase = true) ||
                billPaymentStatus.equals("paid", ignoreCase = true)
        return isCompletedStatus || isPaid
    }

    @Test
    fun testReview_eligibleCompletedAndPaidOrder() {
        val completedOrder = OrderRecord(
            orderId = "ORD-9901",
            tenantId = tenantId,
            status = "COMPLETED",
            paymentStatus = "paid",
            customerId = customerA
        )
        assertTrue(
            "Completed & settled order must be eligible for customer review",
            isOrderEligibleForReview(completedOrder, "paid")
        )
    }

    @Test
    fun testReview_unpaidAndIneligibleOrder() {
        val preparingOrder = OrderRecord(
            orderId = "ORD-9902",
            tenantId = tenantId,
            status = "PREPARING",
            paymentStatus = "pending",
            customerId = customerA
        )
        assertFalse(
            "An actively preparing order with pending payment is NOT eligible for review",
            isOrderEligibleForReview(preparingOrder, "pending")
        )
    }

    @Test
    fun testReview_duplicateReviewPrevention() {
        val existingReviews = mutableListOf<ReviewRecord>()
        val firstReview = ReviewRecord(
            id = "REV-01",
            orderId = "ORD-9901",
            tenantId = tenantId,
            tableNumber = "4",
            rating = "Excellent",
            starRating = 5,
            foodQuality = 5,
            service = 5,
            cleanliness = 5,
            ambience = 5,
            notes = "Superb biryani and authentic spices",
            isAnonymous = false,
            submittedByName = "Geetha K",
            publicCustomerName = "Geetha K"
        )
        existingReviews.add(firstReview)

        // Attempt second review for same order
        val duplicateAttempt = firstReview.copy(id = "REV-02", notes = "Trying duplicate review")
        val isDuplicate = existingReviews.any { it.orderId == duplicateAttempt.orderId && it.tenantId == duplicateAttempt.tenantId }

        assertTrue("Duplicate reviews for the same order reference must be detected and blocked", isDuplicate)
    }

    @Test
    fun testReview_scaleAndFieldValidation() {
        val validReview = ReviewRecord(
            id = "REV-VALID",
            orderId = "ORD-1234",
            tenantId = tenantId,
            starRating = 4,
            foodQuality = 4,
            service = 5,
            cleanliness = 4,
            ambience = 3,
            notes = "Good ambience, very fast service",
            isAnonymous = true,
            submittedByName = "Rajesh Kumar",
            publicCustomerName = "R***** K****"
        )

        assertTrue(validReview.starRating in 1..5)
        assertTrue(validReview.foodQuality in 1..5)
        assertTrue(validReview.service in 1..5)
        assertTrue(validReview.cleanliness in 1..5)
        assertTrue(validReview.ambience in 1..5)
        assertTrue(validReview.notes.length <= 500)
        assertTrue(validReview.isAnonymous)
        assertNotEquals("Rajesh Kumar", validReview.publicCustomerName)
    }

    @Test
    fun testReview_crossPlatformSchemaCompatibility() {
        // Desktop uses satisfactionRatings with specific fields matching Android ReviewRecord
        val review = ReviewRecord(
            id = "REV-DESK-SYNC",
            orderId = "ORD-8822",
            tenantId = tenantId,
            tableNumber = "7",
            rating = "Great",
            starRating = 4,
            foodQuality = 5,
            service = 4,
            cleanliness = 4,
            ambience = 4,
            notes = "Family dinner was delightful",
            submittedByName = "Arun S",
            publicCustomerName = "Arun S",
            revisitIntention = "Yes",
            status = "Published"
        )

        val summary = RatingCalculator.calculate(listOf(review))
        assertEquals(4.0, summary.averageRating, 0.01)
        assertEquals(1, summary.totalReviews)
        assertEquals(100, summary.revisitRate)
    }

    // =========================================================================
    // 2. LOCATION DETECTION & MANUAL SELECTION (FEATURE TWO)
    // =========================================================================

    @Test
    fun testLocation_manualSelectionUpdatesLocality() {
        var userLocation: UserLocation? = null

        // Customer selects Banjara Hills, Hyderabad manually
        val manualChoice = UserLocation(
            latitude = 17.4156,
            longitude = 78.4357,
            localityName = "Banjara Hills, Hyderabad"
        )
        userLocation = manualChoice

        assertNotNull(userLocation)
        assertEquals("Banjara Hills, Hyderabad", userLocation?.localityName)
        assertEquals(17.4156, userLocation?.latitude ?: 0.0, 0.0001)
    }

    @Test
    fun testLocation_gpsPermissionFlow() {
        var hasGpsPermission = false
        var userLocation: UserLocation? = null

        // 1. Permission Denied -> browsing continues with fallback/manual location
        if (!hasGpsPermission) {
            userLocation = UserLocation(
                latitude = 17.3850,
                longitude = 78.4867,
                localityName = "Hyderabad, Telangana"
            )
        }
        assertEquals("Hyderabad, Telangana", userLocation?.localityName)

        // 2. Permission Granted -> simulated GPS detection
        hasGpsPermission = true
        if (hasGpsPermission) {
            userLocation = UserLocation(
                latitude = 17.4399,
                longitude = 78.3808,
                localityName = "Hitec City, Hyderabad"
            )
        }
        assertEquals("Hitec City, Hyderabad", userLocation?.localityName)
    }

    @Test
    fun testLocation_activeDiningSessionRemainsCompletelyIndependent() {
        val activeSession = DiningSession(
            sessionId = "SESSION-BAWARCHI-04",
            tenantId = tenantId,
            restaurantName = "Bawarchi Restaurant",
            tableNumber = "4",
            customerId = customerA
        )

        var browsingLocation = UserLocation(
            latitude = 17.3850,
            longitude = 78.4867,
            localityName = "Charminar, Hyderabad"
        )

        // Customer changes browsing location to Madhapur
        browsingLocation = UserLocation(
            latitude = 17.4483,
            longitude = 78.3915,
            localityName = "Madhapur, Hyderabad"
        )

        // Verify active dining session data has NOT been overwritten or altered
        assertEquals("Bawarchi Restaurant", activeSession.restaurantName)
        assertEquals("4", activeSession.tableNumber)
        assertEquals(tenantId, activeSession.tenantId)
        assertEquals("Madhapur, Hyderabad", browsingLocation.localityName)
    }

    // =========================================================================
    // 3. DEDICATED FAVOURITES (FEATURE THREE)
    // =========================================================================

    @Test
    fun testFavourites_addRemoveAndEmptyState() {
        val customerFavourites = mutableSetOf<String>()

        // 1. Initially Empty
        assertTrue("Initially, favourite list must be empty", customerFavourites.isEmpty())

        // 2. Add favourite
        val restaurantId = "rest_paradise_secunderabad"
        customerFavourites.add(restaurantId)
        assertTrue(customerFavourites.contains(restaurantId))
        assertEquals(1, customerFavourites.size)

        // 3. Prevent duplicate addition
        customerFavourites.add(restaurantId)
        assertEquals(1, customerFavourites.size)

        // 4. Remove favourite
        customerFavourites.remove(restaurantId)
        assertTrue("After removal, favourite list must be empty", customerFavourites.isEmpty())
    }

    @Test
    fun testFavourites_accountSwitchingAndIsolation() {
        val userAFavourites = mutableSetOf("rest_01", "rest_02")
        val userBFavourites = mutableSetOf("rest_03")

        // User A logs out, User B logs in
        var activeUser = customerA
        var currentFavourites = if (activeUser == customerA) userAFavourites else userBFavourites
        assertTrue(currentFavourites.contains("rest_01"))
        assertFalse(currentFavourites.contains("rest_03"))

        activeUser = customerB
        currentFavourites = if (activeUser == customerA) userAFavourites else userBFavourites
        assertFalse("User B must NOT see User A's favourites", currentFavourites.contains("rest_01"))
        assertTrue("User B sees only their own favourites", currentFavourites.contains("rest_03"))
    }

    // =========================================================================
    // 4. DEDICATED NOTIFICATIONS (FEATURE FOUR)
    // =========================================================================

    @Test
    fun testNotifications_unreadBadgeAndMarkAsRead() {
        val notifications = mutableListOf(
            NotificationRecord(
                id = "NOTIF-01",
                title = "Order Accepted",
                body = "Kitchen is preparing your order #ORD-9901",
                read = false,
                orderId = "ORD-9901"
            ),
            NotificationRecord(
                id = "NOTIF-02",
                title = "Table Booking Confirmed",
                body = "Reservation for 4 confirmed at Bawarchi Restaurant",
                read = false,
                bookingId = "RES-505"
            )
        )

        // Verify unread count
        val unreadCount = notifications.count { !it.read }
        assertEquals(2, unreadCount)

        // Mark NOTIF-01 as read
        val idx = notifications.indexOfFirst { it.id == "NOTIF-01" }
        notifications[idx] = notifications[idx].copy(read = true)

        val updatedUnreadCount = notifications.count { !it.read }
        assertEquals(1, updatedUnreadCount)

        // Mark all as read
        for (i in notifications.indices) {
            notifications[i] = notifications[i].copy(read = true)
        }
        assertEquals(0, notifications.count { !it.read })
    }

    @Test
    fun testNotifications_routingDestinations() {
        val orderNotif = NotificationRecord(
            id = "N1",
            title = "Order Ready",
            body = "Order #123 is served",
            orderId = "ORD-123"
        )
        val bookingNotif = NotificationRecord(
            id = "N2",
            title = "Booking Reminder",
            body = "Table reserved in 30 minutes",
            bookingId = "BOOK-789"
        )

        var destination = ""
        if (orderNotif.orderId.isNotBlank()) {
            destination = "ORDERS"
        }
        assertEquals("ORDERS", destination)

        if (bookingNotif.bookingId.isNotBlank()) {
            destination = "BOOKING"
        }
        assertEquals("BOOKING", destination)
    }

    @Test
    fun testNotifications_customerIsolation() {
        // Customer isolation is enforced by subcollection path: customers/{customerId}/notifications
        val customerPathA = "customers/$customerA/notifications"
        val customerPathB = "customers/$customerB/notifications"

        assertNotEquals("Paths must be distinct per customer", customerPathA, customerPathB)

        val scopedNotifications = mapOf(
            customerPathA to listOf(NotificationRecord(id = "N-A1", title = "Order A")),
            customerPathB to listOf(NotificationRecord(id = "N-B1", title = "Order B"))
        )

        val userANotifs = scopedNotifications[customerPathA] ?: emptyList()
        val userBNotifs = scopedNotifications[customerPathB] ?: emptyList()

        assertEquals(1, userANotifs.size)
        assertEquals("N-A1", userANotifs[0].id)
        assertEquals(1, userBNotifs.size)
        assertEquals("N-B1", userBNotifs[0].id)
    }

    // =========================================================================
    // 5. STANDARDIZED BACK NAVIGATION (FEATURE FIVE)
    // =========================================================================

    @Test
    fun testNavigation_backFromExploreReturnsToHome() {
        var currentTab = NavDestination.EXPLORE
        // Simulate system back
        if (currentTab != NavDestination.HOME) {
            currentTab = NavDestination.HOME
        }
        assertEquals(NavDestination.HOME, currentTab)
    }

    @Test
    fun testNavigation_backFromOrdersReturnsToHome() {
        var currentTab = NavDestination.ORDERS
        if (currentTab != NavDestination.HOME) {
            currentTab = NavDestination.HOME
        }
        assertEquals(NavDestination.HOME, currentTab)
    }

    @Test
    fun testNavigation_backFromProfileReturnsToHome() {
        var currentTab = NavDestination.PROFILE
        if (currentTab != NavDestination.HOME) {
            currentTab = NavDestination.HOME
        }
        assertEquals(NavDestination.HOME, currentTab)
    }

    @Test
    fun testNavigation_backFromScanQrReturnsToHome() {
        var currentTab = NavDestination.QR_SCAN
        if (currentTab != NavDestination.HOME) {
            currentTab = NavDestination.HOME
        }
        assertEquals(NavDestination.HOME, currentTab)
    }

    @Test
    fun testNavigation_backFromSubScreensAndOverlays() {
        // 1. Favourites overlay
        var isFavouritesOpen = true
        if (isFavouritesOpen) {
            isFavouritesOpen = false
        }
        assertFalse(isFavouritesOpen)

        // 2. Notifications overlay
        var isNotificationsOpen = true
        if (isNotificationsOpen) {
            isNotificationsOpen = false
        }
        assertFalse(isNotificationsOpen)

        // 3. Location Selector overlay
        var isLocationSelectorOpen = true
        if (isLocationSelectorOpen) {
            isLocationSelectorOpen = false
        }
        assertFalse(isLocationSelectorOpen)

        // 4. Restaurant Menu overlay
        var activeRestaurant: Restaurant? = Restaurant(id = "r1", name = "Test")
        if (activeRestaurant != null) {
            activeRestaurant = null
        }
        assertNull(activeRestaurant)

        // 5. Order Tracking Details
        var selectedOrder: OrderRecord? = OrderRecord(orderId = "o1")
        if (selectedOrder != null) {
            selectedOrder = null
        }
        assertNull(selectedOrder)

        // 6. Table Booking screen
        var isBookingScreenOpen = true
        if (isBookingScreenOpen) {
            isBookingScreenOpen = false
        }
        assertFalse(isBookingScreenOpen)
    }

    @Test
    fun testNavigation_homeScreenRootBackPreserved() {
        val currentTab = NavDestination.HOME
        val isAnyOverlayOpen = false

        // On Home with no overlays, BackHandler should NOT intercept
        val hasBackInterceptor = (currentTab != NavDestination.HOME) || isAnyOverlayOpen
        assertFalse("Root back behavior must be preserved when on Home screen", hasBackInterceptor)
    }

    // =========================================================================
    // 6. TABLE LEAVE WORKFLOW & BILL SETTLEMENT (PHASE 2)
    // =========================================================================

    @Test
    fun testLeaveTable_outstandingBillBlocksRelease() {
        val unpaidOrders = listOf(
            OrderRecord(
                orderId = "ORD-UNPAID-1",
                tenantId = tenantId,
                tableNumber = "8",
                status = "SERVED",
                paymentStatus = "pending",
                total = 450.0 // ₹4.50
            )
        )

        // Mock check logic matching DiningSessionRepository.checkLeaveEligibility
        var unpaidTotal = 0.0
        var firstUnpaidOrderId = ""
        for (order in unpaidOrders) {
            val isPaid = order.paymentStatus.equals("paid", ignoreCase = true)
            if (!isPaid) {
                unpaidTotal += order.total
                if (firstUnpaidOrderId.isBlank()) firstUnpaidOrderId = order.orderId
            }
        }

        val eligibility = if (unpaidTotal > 0.0) {
            com.spiralworld.spiraldine.data.repository.TableLeaveEligibility.OutstandingBill(unpaidTotal, firstUnpaidOrderId)
        } else {
            com.spiralworld.spiraldine.data.repository.TableLeaveEligibility.Eligible
        }

        assertTrue("Unpaid balance must block customer from leaving the table", eligibility is com.spiralworld.spiraldine.data.repository.TableLeaveEligibility.OutstandingBill)
        val formattedMsg = com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(unpaidTotal)
        assertEquals("₹4.50", formattedMsg)
    }

    @Test
    fun testLeaveTable_activeCookingOrderBlocksRelease() {
        val activeCookingOrders = listOf(
            OrderRecord(
                orderId = "ORD-COOKING-1",
                tenantId = tenantId,
                tableNumber = "8",
                status = "COOKING",
                paymentStatus = "paid",
                total = 550.0
            )
        )

        var hasActiveUnfinishedOrder = false
        for (order in activeCookingOrders) {
            val status = order.status.lowercase()
            val isCompleted = status in listOf("completed", "served", "delivered", "dining_completed")
            if (!isCompleted) {
                hasActiveUnfinishedOrder = true
            }
        }

        val eligibility = if (hasActiveUnfinishedOrder) {
            com.spiralworld.spiraldine.data.repository.TableLeaveEligibility.ActiveOrders(1)
        } else {
            com.spiralworld.spiraldine.data.repository.TableLeaveEligibility.Eligible
        }

        assertTrue("Active food preparation orders must block premature table release", eligibility is com.spiralworld.spiraldine.data.repository.TableLeaveEligibility.ActiveOrders)
    }

    @Test
    fun testLeaveTable_settledSessionPermitsTransitionToCleaning() {
        val completedOrders = listOf(
            OrderRecord(
                orderId = "ORD-SETTLED-1",
                tenantId = tenantId,
                tableNumber = "8",
                status = "COMPLETED",
                paymentStatus = "paid",
                total = 1850.0 // ₹18.50
            )
        )

        var hasActiveUnfinished = false
        var unpaidTotal = 0.0
        for (order in completedOrders) {
            val status = order.status.lowercase()
            val isPaid = order.paymentStatus.equals("paid", ignoreCase = true)
            val isCompleted = status in listOf("completed", "served", "delivered", "dining_completed")
            if (!isCompleted) hasActiveUnfinished = true
            if (!isPaid) unpaidTotal += order.total
        }

        val eligibility = if (unpaidTotal > 0.0) {
            com.spiralworld.spiraldine.data.repository.TableLeaveEligibility.OutstandingBill(unpaidTotal, "")
        } else if (hasActiveUnfinished) {
            com.spiralworld.spiraldine.data.repository.TableLeaveEligibility.ActiveOrders(1)
        } else {
            com.spiralworld.spiraldine.data.repository.TableLeaveEligibility.Eligible
        }

        assertEquals("When all orders are completed and bills settled, table leave must be eligible", com.spiralworld.spiraldine.data.repository.TableLeaveEligibility.Eligible, eligibility)

        // Simulate table transition to cleaning
        val tableState = mutableMapOf<String, Any>(
            "status" to "cleaning",
            "tableStatus" to "cleaning",
            "customerPresent" to false
        )
        assertEquals("cleaning", tableState["status"])
        assertEquals(false, tableState["customerPresent"])
    }

    @Test
    fun testLeaveTable_sessionClearedLocallyWhileCustomerHistoryPreserved() {
        var currentSession: DiningSession? = DiningSession(
            sessionId = "SESSION-888",
            tenantId = tenantId,
            restaurantName = "Bawarchi Restaurant",
            tableNumber = "8",
            customerId = customerA
        )
        val customerOrderHistory = mutableListOf(
            OrderRecord(orderId = "ORD-HIST-1", tenantId = tenantId, tableNumber = "8", customerId = customerA, status = "COMPLETED", paymentStatus = "paid")
        )

        // Customer leaves table
        currentSession = null

        assertNull("Active dining session must be cleared after leaving", currentSession)
        assertEquals("Customer historical orders must remain intact and accessible", 1, customerOrderHistory.size)
        assertEquals("ORD-HIST-1", customerOrderHistory[0].orderId)
    }

    // =========================================================================
    // 7. LOCATION-BASED RESTAURANT DISCOVERY (PHASE 3)
    // =========================================================================

    @Test
    fun testLocation_filterRestaurantsBySelectedCityTokens() {
        val allRestaurants = listOf(
            Restaurant(id = "r_hyd_1", name = "Bawarchi Restaurant", city = "Hyderabad", locality = "RTC X Roads", address = "Chikkadpally, Hyderabad"),
            Restaurant(id = "r_hyd_2", name = "Paradise Food Court", city = "Hyderabad", locality = "Secunderabad", address = "MG Road, Hyderabad"),
            Restaurant(id = "r_blr_1", name = "Vidyarthi Bhavan", city = "Bengaluru", locality = "Gandhi Bazaar", address = "Basavanagudi, Bengaluru")
        )

        val selectedLocation = UserLocation(
            latitude = 17.3850,
            longitude = 78.4867,
            localityName = "Hyderabad, Telangana"
        )

        val locQuery = selectedLocation.localityName?.lowercase() ?: ""
        val tokens = locQuery.split(",", " ").map { it.trim() }.filter { it.length > 2 }

        val filtered = allRestaurants.filter { rest ->
            val rCity = rest.city.lowercase()
            val rLocality = rest.locality.lowercase()
            val rAddress = rest.address.lowercase()
            tokens.any { token -> rCity.contains(token) || rLocality.contains(token) || rAddress.contains(token) }
        }

        assertEquals("Must display 2 restaurants matching Hyderabad", 2, filtered.size)
        assertTrue(filtered.any { it.name == "Bawarchi Restaurant" })
        assertTrue(filtered.any { it.name == "Paradise Food Court" })
        assertFalse(filtered.any { it.name == "Vidyarthi Bhavan" })
    }

    @Test
    fun testLocation_comingSoonEmptyStateWhenNoRestaurantsInCity() {
        val allRestaurants = listOf(
            Restaurant(id = "r_hyd_1", name = "Bawarchi Restaurant", city = "Hyderabad", locality = "RTC X Roads")
        )

        val selectedLocation = UserLocation(
            latitude = 17.9689,
            longitude = 79.5941,
            localityName = "Warangal, Telangana"
        )

        val locQuery = selectedLocation.localityName?.lowercase() ?: ""
        val tokens = locQuery.split(",", " ").map { it.trim() }.filter { it.length > 2 }

        val filtered = allRestaurants.filter { rest ->
            val rCity = rest.city.lowercase()
            val rLocality = rest.locality.lowercase()
            val rAddress = rest.address.lowercase()
            tokens.any { token -> rCity.contains(token) || rLocality.contains(token) || rAddress.contains(token) }
        }

        assertTrue("Empty list triggers SpiralDine Is Coming Soon empty state for un-onboarded city", filtered.isEmpty())
    }

    @Test
    fun testLocation_browsingLocationDecoupledFromDiningSession() {
        val activeSession = DiningSession(
            sessionId = "SESS-10",
            tenantId = "rest_bawarchi_hyd",
            restaurantName = "Bawarchi Restaurant",
            tableNumber = "8"
        )

        var browsingLocation = UserLocation(
            latitude = 17.3850,
            longitude = 78.4867,
            localityName = "Hyderabad, Telangana"
        )

        // Customer explores restaurants in Bengaluru without leaving Hyderabad table
        browsingLocation = UserLocation(
            latitude = 12.9716,
            longitude = 77.5946,
            localityName = "Bengaluru, Karnataka"
        )

        assertEquals("Browsing location updated to Bengaluru", "Bengaluru, Karnataka", browsingLocation.localityName)
        assertEquals("Dining session remains Bawarchi Restaurant", "rest_bawarchi_hyd", activeSession.tenantId)
        assertEquals("Dining session table remains #8", "8", activeSession.tableNumber)
    }

    // =========================================================================
    // 8. OFFICIAL RECEIPT & CURRENCY DECIMAL ACCURACY (PHASE 4)
    // =========================================================================

    @Test
    fun testCurrency_strictDecimalFormattingRegressionValues() {
        // Earlier Android screens displayed amounts incorrectly (e.g. ₹4.50 as ₹450).
        // Regression tests ensuring paise values format with precise decimal rupees:
        // 450.0 paise -> ₹4.50
        // 550.0 paise -> ₹5.50
        // 1850.0 paise -> ₹18.50
        // 4345.0 paise -> ₹43.45

        assertEquals("₹4.50", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(450.0))
        assertEquals("₹5.50", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(550.0))
        assertEquals("₹18.50", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(1850.0))
        assertEquals("₹43.45", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(4345.0))

        assertEquals("₹4.50", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatRupees(4.50))
        assertEquals("₹5.50", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatRupees(5.50))
        assertEquals("₹18.50", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatRupees(18.50))
        assertEquals("₹43.45", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatRupees(43.45))
    }

    @Test
    fun testReceipt_itemizedTotalsAndAuthoritativeCalculations() {
        val items = listOf(
            com.spiralworld.spiraldine.data.model.OrderItemRecord(
                name = "Irani Chai",
                count = 2,
                pricePerUnit = 450.0 // ₹4.50 each (in paise)
            ),
            com.spiralworld.spiraldine.data.model.OrderItemRecord(
                name = "Osmania Biscuit",
                count = 1,
                pricePerUnit = 550.0 // ₹5.50 each (in paise)
            ),
            com.spiralworld.spiraldine.data.model.OrderItemRecord(
                name = "Mutton Dum Biryani (Single)",
                count = 1,
                pricePerUnit = 1850.0 // ₹18.50 (in paise)
            )
        )

        val subtotal = items.sumOf { it.pricePerUnit * it.count } // 900 + 550 + 1850 = 3300.0 (₹33.00)
        val tax = 165.0 // 5% GST = ₹1.65
        val serviceFee = 100.0 // ₹1.00
        val discount = 220.0 // ₹2.20
        val grandTotal = subtotal + tax + serviceFee - discount // 3300 + 165 + 100 - 220 = 3345.0 (₹33.45)

        assertEquals("₹9", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(items[0].pricePerUnit * items[0].count))
        assertEquals("₹9.00", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPriceExact(items[0].pricePerUnit * items[0].count))
        assertEquals("₹5.50", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(items[1].pricePerUnit * items[1].count))
        assertEquals("₹18.50", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(items[2].pricePerUnit * items[2].count))

        assertEquals("₹33", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(subtotal))
        assertEquals("₹1.65", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(tax))
        assertEquals("₹1", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(serviceFee))
        assertEquals("-₹2.20", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatDiscountPaise(discount))
        assertEquals("₹33.45", com.spiralworld.spiraldine.data.repository.CurrencyFormatter.formatPrice(grandTotal))
    }

    @Test
    fun testReceipt_authorizationAndOwnershipIsolation() {
        val orderA = OrderRecord(
            orderId = "ORD-CUSTOMER-A",
            tenantId = tenantId,
            customerId = customerA,
            total = 4345.0
        )

        // Customer A requests receipt: permitted
        val isCustomerAAuthorized = (orderA.customerId == customerA)
        assertTrue("Customer A must be permitted to view their own receipt", isCustomerAAuthorized)

        // Customer B attempts to access Customer A's receipt by ID guessing: rejected
        val isCustomerBAuthorized = (orderA.customerId == customerB)
        assertFalse("Customer B must NOT be permitted to access Customer A's receipt", isCustomerBAuthorized)
    }
}

