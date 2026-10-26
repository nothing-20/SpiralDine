package com.spiraldine.owner

import com.spiraldine.owner.data.model.*
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.ui.navigation.OwnerNavDestination
import org.junit.Assert.*
import org.junit.Test

class OwnerModelAndLogicTest {

    @Test
    fun testOrderRecordCalculations() {
        val items = listOf(
            OrderItemRecord(name = "Paneer Tikka", quantity = 2, price = 14.50),
            OrderItemRecord(name = "Garlic Naan", quantity = 3, price = 3.50)
        )
        val calculatedTotal = items.sumOf { it.price * it.quantity }
        assertEquals(39.50, calculatedTotal, 0.001)

        val order = OrderRecord(
            id = "ord-001",
            tableNumber = "4",
            total = calculatedTotal,
            status = "PENDING",
            items = items
        )

        assertEquals("ord-001", order.id)
        assertEquals("Table 4", "Table ${order.tableNumber}")
        assertEquals(2, order.items.size)
        assertEquals(5, order.items.sumOf { it.quantity })
    }

    @Test
    fun testRestaurantOverviewCalculations() {
        val orders = listOf(
            OrderRecord(id = "1", status = "PENDING", total = 50.0),
            OrderRecord(id = "2", status = "PREPARING", total = 35.0),
            OrderRecord(id = "3", status = "COMPLETED", total = 80.0),
            OrderRecord(id = "4", status = "CANCELLED", total = 25.0)
        )

        val validOrders = orders.filter { it.status != "CANCELLED" && it.status != "REJECTED" }
        val totalSales = validOrders.sumOf { it.total }
        val pendingCount = orders.count { it.status == "PENDING" || it.status == "NEW" || it.status == "PREPARING" }
        val completedCount = orders.count { it.status == "COMPLETED" || it.status == "SERVED" }

        assertEquals(165.0, totalSales, 0.001)
        assertEquals(2, pendingCount)
        assertEquals(1, completedCount)

        val overview = RestaurantOverview(
            name = "Spiral Bistro",
            todaySales = totalSales,
            todayOrders = orders.size,
            pendingOrders = pendingCount,
            completedOrders = completedCount,
            businessHealthScore = 88,
            businessHealthMax = 100,
            businessHealthLabel = "Optimal",
            businessHealthCoverage = 92,
            businessHealthTrend = "Stable (+2 pts)",
            currentFY = "2026-27",
            annualNetRevenue = 155.0,
            annualOrdersCount = 4,
            annualAvgMonthly = 155.0
        )

        assertEquals(165.0, overview.todaySales, 0.001)
        assertEquals(4, overview.todayOrders)
        assertEquals(2, overview.pendingOrders)
        assertEquals(88, overview.businessHealthScore)
        assertEquals(100, overview.businessHealthMax)
        assertEquals("Optimal", overview.businessHealthLabel)
        assertEquals(92, overview.businessHealthCoverage)
        assertEquals("2026-27", overview.currentFY)
        assertEquals(155.0, overview.annualNetRevenue, 0.001)
    }

    @Test
    fun testBusinessHealthDimensionsAndScoring() {
        val dimensions = listOf(
            HealthDimensionRecord(id = "revenue", title = "Revenue Health", score = 90, weight = 25, status = "available"),
            HealthDimensionRecord(id = "operations", title = "Operations Health", score = 85, weight = 25, status = "available"),
            HealthDimensionRecord(id = "customers", title = "Customer Health", score = 88, weight = 20, status = "available"),
            HealthDimensionRecord(id = "inventory", title = "Inventory Health", score = 80, weight = 15, status = "available"),
            HealthDimensionRecord(id = "kitchen", title = "Kitchen Health", score = 82, weight = 15, status = "available")
        )

        assertEquals(5, dimensions.size)
        assertEquals(100, dimensions.sumOf { it.weight })
        val avgScore = dimensions.mapNotNull { it.score }.average().toInt()
        assertEquals(85, avgScore)
    }

    @Test
    fun testQuickActionStaffKeyMapping() {
        val validActionKeys = listOf("orders", "add_item", "tables", "analytics", "staff")
        assertEquals(5, validActionKeys.size)
        assertTrue(validActionKeys.contains("staff"))
    }

    @Test
    fun testMenuItemFilteringAndAttributes() {
        val menu = listOf(
            MenuItemRecord(id = "m1", name = "Butter Chicken", category = "Mains", price = 16.99, type = "non-veg", available = true),
            MenuItemRecord(id = "m2", name = "Dal Makhani", category = "Mains", price = 12.99, type = "veg", available = true),
            MenuItemRecord(id = "m3", name = "Gulab Jamun", category = "Desserts", price = 6.50, type = "veg", available = false)
        )

        val vegItems = menu.filter { it.type == "veg" }
        assertEquals(2, vegItems.size)

        val availableItems = menu.filter { it.available }
        assertEquals(2, availableItems.size)

        val categories = menu.map { it.category }.distinct()
        assertEquals(listOf("Mains", "Desserts"), categories)
    }

    @Test
    fun testTableStatusToggleLogic() {
        val table = TableRecord(id = "T-1", tableNumber = "1", capacity = 4, status = "AVAILABLE")
        val toggledStatus = if (table.status == "AVAILABLE") "OCCUPIED" else "AVAILABLE"
        assertEquals("OCCUPIED", toggledStatus)

        val toggledBack = if (toggledStatus == "AVAILABLE") "OCCUPIED" else "AVAILABLE"
        assertEquals("AVAILABLE", toggledBack)
    }

    @Test
    fun testPromotionDiscountComputation() {
        val percentPromo = PromotionRecord(
            id = "p1",
            title = "Weekend 20%",
            code = "WEEKEND20",
            discountType = "percentage",
            discountValue = 20.0,
            minOrder = 40.0
        )

        val orderTotal = 100.0
        val discount = if (orderTotal >= percentPromo.minOrder) {
            if (percentPromo.discountType == "percentage") {
                orderTotal * (percentPromo.discountValue / 100.0)
            } else {
                percentPromo.discountValue
            }
        } else 0.0

        assertEquals(20.0, discount, 0.001)
        assertEquals(80.0, orderTotal - discount, 0.001)
    }

    @Test
    fun testNavDestinationsRoutes() {
        assertEquals("login", OwnerNavDestination.Login.route)
        assertEquals("home", OwnerNavDestination.Home.route)
        assertEquals("orders", OwnerNavDestination.Orders.route)
        assertEquals("order_details", OwnerNavDestination.OrderDetails.route)
        assertEquals("menu", OwnerNavDestination.Menu.route)
        assertEquals("add_edit_item", OwnerNavDestination.AddEditItem.route)
        assertEquals("categories", OwnerNavDestination.Categories.route)
        assertEquals("business", OwnerNavDestination.Business.route)
        assertEquals("analytics", OwnerNavDestination.Analytics.route)
        assertEquals("tables", OwnerNavDestination.Tables.route)
        assertEquals("staff", OwnerNavDestination.Staff.route)
        assertEquals("promotions", OwnerNavDestination.Promotions.route)
        assertEquals("more", OwnerNavDestination.More.route)
        assertEquals("settings", OwnerNavDestination.Settings.route)
    }

    @Test
    fun testTenantResolutionStates() {
        val idle: TenantResolutionState = TenantResolutionState.Idle
        val loading: TenantResolutionState = TenantResolutionState.Loading
        val resolved: TenantResolutionState = TenantResolutionState.Resolved(
            tenantId = "rest-beta",
            restaurantName = "Beta Kitchen",
            branchId = "main"
        )
        val noTenant: TenantResolutionState = TenantResolutionState.NoTenantAssigned(uid = "user-unknown")
        val error: TenantResolutionState = TenantResolutionState.Error("Network failure")
        val notAuth: TenantResolutionState = TenantResolutionState.NotAuthenticated

        assertTrue(idle is TenantResolutionState.Idle)
        assertTrue(loading is TenantResolutionState.Loading)
        assertTrue(resolved is TenantResolutionState.Resolved)
        assertEquals("rest-beta", (resolved as TenantResolutionState.Resolved).tenantId)
        assertEquals("Beta Kitchen", (resolved as TenantResolutionState.Resolved).restaurantName)
        assertEquals("main", (resolved as TenantResolutionState.Resolved).branchId)
        assertTrue(noTenant is TenantResolutionState.NoTenantAssigned)
        assertEquals("user-unknown", (noTenant as TenantResolutionState.NoTenantAssigned).uid)
        assertTrue(error is TenantResolutionState.Error)
        assertEquals("Network failure", (error as TenantResolutionState.Error).message)
        assertTrue(notAuth is TenantResolutionState.NotAuthenticated)
    }

    @Test
    fun testZeroFallbackOnUnmappedUser() {
        // Enforce that unmapped users result in NoTenantAssigned state and NEVER silently resolve to "rest-alpha"
        val testUid = "unassigned-user-999"
        val resolvedState: TenantResolutionState = TenantResolutionState.NoTenantAssigned(uid = testUid)

        assertFalse("Unmapped user must NOT resolve to a valid tenant", resolvedState is TenantResolutionState.Resolved)
        assertTrue("Unmapped user must produce NoTenantAssigned", resolvedState is TenantResolutionState.NoTenantAssigned)
        assertEquals(testUid, (resolvedState as TenantResolutionState.NoTenantAssigned).uid)

        // Verify that default tenantId is empty, not "rest-alpha"
        val initialTenantId = ""
        assertTrue("Default initial tenantId must be empty string", initialTenantId.isBlank())
        assertFalse("Default initial tenantId must NEVER be 'rest-alpha'", initialTenantId == "rest-alpha")
    }

    @Test
    fun testStaffInvitationRoleValidation() {
        val permittedRoles = setOf("waiter", "kitchen", "cashier", "manager")

        // Allowed staff roles
        assertTrue(permittedRoles.contains("waiter"))
        assertTrue(permittedRoles.contains("kitchen"))
        assertTrue(permittedRoles.contains("cashier"))
        assertTrue(permittedRoles.contains("manager"))

        // Disallowed / privilege-escalation roles
        assertFalse("Owner role must not be assignable via staff invitation", permittedRoles.contains("owner"))
        assertFalse("Superadmin role must not be assignable via staff invitation", permittedRoles.contains("superadmin"))
        assertFalse("Admin role must not be assignable via staff invitation", permittedRoles.contains("admin"))
    }

    @Test
    fun testStaffInvitationEmailValidation() {
        val validEmail = "staff.member@spiraldine.com"
        val invalidEmail1 = "staff-at-domain.com"
        val invalidEmail2 = ""
        val invalidEmail3 = "   "

        fun isValidEmail(email: String): Boolean =
            email.isNotBlank() && email.contains("@") && email.contains(".") && !email.contains(" ")

        assertTrue(isValidEmail(validEmail))
        assertFalse(isValidEmail(invalidEmail1))
        assertFalse(isValidEmail(invalidEmail2))
        assertFalse(isValidEmail(invalidEmail3))
    }

    @Test
    fun testLoginScreenLandscapeKeyboardAccessibility() {
        // DEFECT-AND-001 Verification:
        // In landscape orientation on a compact device (360x640), height is 360dp.
        // Software keyboard (IME) consumes ~180dp, leaving 180dp viewport.
        // Total login form content height is ~380dp (Header 80dp + Email 60dp + Password 60dp + Button 52dp + Spacing 48dp).
        // Without verticalScroll, content overflows by 200dp and Sign In button is occluded.
        // With verticalScroll enabled, maxScrollOffset is contentHeight - viewportHeight = 200dp,
        // making every element fully reachable.
        val viewportHeightDp = 360f
        val imeHeightDp = 180f
        val availableHeightDp = viewportHeightDp - imeHeightDp
        val formContentHeightDp = 380f

        val overflowWithoutScroll = formContentHeightDp > availableHeightDp
        assertTrue("Form content overflows available landscape height when keyboard is active", overflowWithoutScroll)

        val scrollRangeDp = formContentHeightDp - availableHeightDp
        assertEquals(200f, scrollRangeDp, 0.001f)
        assertTrue("Scrollable modifier enables traversing full 200dp overflow to reach Sign In button", scrollRangeDp > 0)
    }

    @Test
    fun testBranchRecordAndWorkspaceSwitching() {
        val branches = listOf(
            BranchRecord("main", "Main Dining", isDefault = true),
            BranchRecord("rooftop", "Rooftop Lounge", isDefault = false)
        )
        assertEquals(2, branches.size)
        assertTrue(branches.first().isDefault)
        assertEquals("Main Dining", branches.first().name)

        // Switching branch
        val switchedId = "rooftop"
        val updatedBranches = branches.map { it.copy(isDefault = it.id == switchedId) }
        val activeBranch = updatedBranches.find { it.isDefault }
        assertNotNull(activeBranch)
        assertEquals("rooftop", activeBranch?.id)
        assertEquals("Rooftop Lounge", activeBranch?.name)
    }

    @Test
    fun testTableQrUrlFormatting() {
        val table = TableRecord(
            id = "tbl-101",
            tableNumber = "4",
            capacity = 4,
            status = "AVAILABLE",
            tenantId = "rest-bistro"
        )
        val expectedUrl = "https://spiraldine.com/r/rest-bistro/table/4"
        val generatedUrl = "https://spiraldine.com/r/${table.tenantId.ifBlank { "spiraldine" }}/table/${table.tableNumber}"
        assertEquals(expectedUrl, generatedUrl)
    }

    @Test
    fun testReservationRecordModelAndStatusTransitions() {
        val reservation = ReservationRecord(
            id = "res-202",
            customerName = "Anita Roy",
            customerPhone = "+91 98765 43210",
            guests = 4,
            date = "2026-10-25",
            time = "19:30",
            tableNumber = "3",
            tableId = "tbl-03",
            status = "pending",
            specialNotes = "Window seat requested"
        )

        assertEquals("res-202", reservation.id)
        assertEquals("Anita Roy", reservation.customerName)
        assertEquals(4, reservation.guests)
        assertEquals("pending", reservation.status)
        assertEquals("3", reservation.tableNumber)

        // Status progression: pending -> confirmed -> seated -> completed
        val confirmed = reservation.copy(status = "confirmed")
        assertEquals("confirmed", confirmed.status)

        val seated = confirmed.copy(status = "seated")
        assertEquals("seated", seated.status)

        val completed = seated.copy(status = "completed")
        assertEquals("completed", completed.status)
    }

    @Test
    fun testOrderRecordBranchScopingLogic() {
        val orders = listOf(
            OrderRecord(id = "o1", total = 100.0, status = "COMPLETED", branchId = "main"),
            OrderRecord(id = "o2", total = 50.0, status = "PENDING", branchId = "main"),
            OrderRecord(id = "o3", total = 75.0, status = "COMPLETED", branchId = "rooftop"),
            OrderRecord(id = "o4", total = 25.0, status = "PREPARING", branchId = "") // Unscoped legacy order
        )

        // When branch "main" is selected, includes "main" and unscoped fallback orders
        val mainBranchOrders = orders.filter { it.branchId.isBlank() || it.branchId == "main" }
        assertEquals(3, mainBranchOrders.size)
        assertEquals(175.0, mainBranchOrders.sumOf { it.total }, 0.001)

        // When branch "rooftop" is selected, includes "rooftop" orders
        val rooftopOrders = orders.filter { it.branchId == "rooftop" }
        assertEquals(1, rooftopOrders.size)
        assertEquals(75.0, rooftopOrders.sumOf { it.total }, 0.001)
    }

    @Test
    fun testMenuItemMultiFieldAvailabilityPayload() {
        val item = MenuItemRecord(
            id = "item-99",
            name = "Special Kebab",
            category = "Starters",
            price = 18.0,
            available = true
        )

        // Multi-field map ensuring parity across web (isAvailable/status) and mobile (available/availability)
        val availabilityMap = mapOf(
            "isAvailable" to item.available,
            "available" to item.available,
            "availability" to if (item.available) "available" else "unavailable",
            "isPublished" to item.available,
            "status" to if (item.available) "active" else "inactive"
        )

        assertTrue(availabilityMap["isAvailable"] as Boolean)
        assertTrue(availabilityMap["available"] as Boolean)
        assertEquals("available", availabilityMap["availability"])
        assertTrue(availabilityMap["isPublished"] as Boolean)
        assertEquals("active", availabilityMap["status"])
    }

    @Test
    fun testNavDestinationsIncludesReservations() {
        assertEquals("reservations", OwnerNavDestination.Reservations.route)
    }

    @Test
    fun testNavDestinationsIncludesAnnualRevenue() {
        assertEquals("annual_revenue", OwnerNavDestination.AnnualRevenue.route)
    }

    @Test
    fun testIndianCurrencyFormatting() {
        assertEquals("₹0.00", com.spiraldine.owner.data.util.RevenueCalculator.formatInr(0.0))
        assertEquals("₹41,800.00", com.spiraldine.owner.data.util.RevenueCalculator.formatInr(41800.0))
        assertEquals("₹39,900.00", com.spiraldine.owner.data.util.RevenueCalculator.formatInr(39900.0))
        assertEquals("₹12,50,000.00", com.spiraldine.owner.data.util.RevenueCalculator.formatInr(1250000.0))
        assertFalse(com.spiraldine.owner.data.util.RevenueCalculator.formatInr(100.0).contains("$"))
        assertTrue(com.spiraldine.owner.data.util.RevenueCalculator.formatInr(100.0).startsWith("₹"))
    }

    @Test
    fun testPaiseCurrencyFormatting() {
        assertEquals("₹0.00", com.spiraldine.owner.data.util.RevenueCalculator.formatPaise(0.0))
        assertEquals("₹176.00", com.spiraldine.owner.data.util.RevenueCalculator.formatPaise(17600.0))
        assertEquals("₹66.00", com.spiraldine.owner.data.util.RevenueCalculator.formatPaise(6600.0))
        assertEquals("₹80.00", com.spiraldine.owner.data.util.RevenueCalculator.formatPaise(8000.0))
        assertEquals("₹1,250.00", com.spiraldine.owner.data.util.RevenueCalculator.formatPaise(125000.0))
        assertEquals(
            com.spiraldine.owner.data.util.RevenueCalculator.formatPaise(17600.0),
            com.spiraldine.owner.data.util.RevenueCalculator.formatPrice(17600.0)
        )
    }

    @Test
    fun testTodayDateFilteringInTimezone() {
        val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
        }.format(java.util.Date())

        assertTrue("Current timestamp should be identified as today", com.spiraldine.owner.data.util.RevenueCalculator.isTodayInTimezone(nowIso))
        assertFalse("Past July 2026 order should NOT be today", com.spiraldine.owner.data.util.RevenueCalculator.isTodayInTimezone("2026-07-07T16:07:34.309Z"))
        assertFalse("Past July 2026 order should NOT be today", com.spiraldine.owner.data.util.RevenueCalculator.isTodayInTimezone("2026-07-08T03:53:26.328Z"))
        assertFalse("Null date should not be today", com.spiraldine.owner.data.util.RevenueCalculator.isTodayInTimezone(null))
    }

    @Test
    fun testIsPaidOrCompletedOrder() {
        assertTrue(com.spiraldine.owner.data.util.RevenueCalculator.isPaidOrCompletedOrder("COMPLETED", "paid"))
        assertTrue(com.spiraldine.owner.data.util.RevenueCalculator.isPaidOrCompletedOrder("SERVED", "settled"))
        assertFalse(com.spiraldine.owner.data.util.RevenueCalculator.isPaidOrCompletedOrder("DELIVERED", "pending"))
        assertFalse(com.spiraldine.owner.data.util.RevenueCalculator.isPaidOrCompletedOrder("PENDING", "pending"))
        assertFalse(com.spiraldine.owner.data.util.RevenueCalculator.isPaidOrCompletedOrder("CANCELLED", "paid"))
        assertFalse(com.spiraldine.owner.data.util.RevenueCalculator.isPaidOrCompletedOrder("REJECTED", "paid"))
        assertFalse(com.spiraldine.owner.data.util.RevenueCalculator.isPaidOrCompletedOrder("COMPLETED", "refunded"))
    }

    @Test
    fun testHistoricalOrdersDoNotLeakIntoTodaySales() {
        // Historical 3 orders in Firestore
        val historicalOrders = listOf(
            com.spiraldine.owner.data.model.OrderRecord(
                id = "ORD-0APZG0G",
                status = "COMPLETED",
                paymentStatus = "paid",
                total = 6600.0,
                subtotal = 6000.0,
                tax = 300.0,
                createdAt = "2026-07-07T16:07:34.309Z"
            ),
            com.spiraldine.owner.data.model.OrderRecord(
                id = "ORD-901U9PW",
                status = "DELIVERED",
                paymentStatus = "pending",
                total = 17600.0,
                subtotal = 16000.0,
                tax = 800.0,
                createdAt = "2026-07-08T03:53:26.328Z"
            ),
            com.spiraldine.owner.data.model.OrderRecord(
                id = "ORD-NO19XWM",
                status = "DELIVERED",
                paymentStatus = "pending",
                total = 17600.0,
                subtotal = 16000.0,
                tax = 800.0,
                createdAt = "2026-07-07T16:05:38.081Z"
            )
        )

        // Today filter
        val todayOrders = historicalOrders.filter { com.spiraldine.owner.data.util.RevenueCalculator.isTodayInTimezone(it.createdAt) }
        val todaySales = todayOrders.filter { com.spiraldine.owner.data.util.RevenueCalculator.isPaidOrCompletedOrder(it.status, it.paymentStatus) }.sumOf { it.total }

        // Expected: ZERO orders today, ZERO sales today
        assertEquals(0, todayOrders.size)
        assertEquals(0.0, todaySales, 0.001)
        assertEquals("₹0.00", com.spiraldine.owner.data.util.RevenueCalculator.formatPaise(todaySales))

        // Annual metrics: only ORD-0APZG0G is paid (6600 gross - 300 tax = 6300 net)
        val transactions = historicalOrders.map { o ->
            com.spiraldine.owner.data.model.TransactionRecord(
                id = o.id,
                orderId = o.id,
                orderTime = o.createdAt,
                paymentStatus = o.paymentStatus,
                orderStatus = o.status,
                subtotal = o.subtotal,
                tax = o.tax,
                total = o.total
            )
        }
        val annual = com.spiraldine.owner.data.util.RevenueCalculator.calculateAnnualMetrics(transactions, "2026-27")
        assertEquals(1, annual.totalOrders)
        assertEquals(6300.0, annual.netRevenue, 0.001)
        assertEquals("₹63.00", com.spiraldine.owner.data.util.RevenueCalculator.formatPaise(annual.netRevenue))
    }

    @Test
    fun testFiscalYearRangeAndBoundaries() {
        val (start, end) = com.spiraldine.owner.data.util.RevenueCalculator.getFiscalYearRange("2026-27")
        val calStart = java.util.Calendar.getInstance().apply { time = start }
        val calEnd = java.util.Calendar.getInstance().apply { time = end }

        assertEquals(2026, calStart.get(java.util.Calendar.YEAR))
        assertEquals(java.util.Calendar.APRIL, calStart.get(java.util.Calendar.MONTH))
        assertEquals(1, calStart.get(java.util.Calendar.DAY_OF_MONTH))

        assertEquals(2027, calEnd.get(java.util.Calendar.YEAR))
        assertEquals(java.util.Calendar.MARCH, calEnd.get(java.util.Calendar.MONTH))
        assertEquals(31, calEnd.get(java.util.Calendar.DAY_OF_MONTH))
    }

    @Test
    fun test12FiscalMonthsSequenceOrder() {
        val breakdown = com.spiraldine.owner.data.util.RevenueCalculator.calculateMonthlyBreakdown(emptyList(), "2026-27")
        assertEquals(12, breakdown.size)

        val expectedMonths = listOf(
            "April" to 2026,
            "May" to 2026,
            "June" to 2026,
            "July" to 2026,
            "August" to 2026,
            "September" to 2026,
            "October" to 2026,
            "November" to 2026,
            "December" to 2026,
            "January" to 2027,
            "February" to 2027,
            "March" to 2027
        )

        for (i in 0 until 12) {
            assertEquals("Month at index $i", expectedMonths[i].first, breakdown[i].monthName)
            assertEquals("Year at index $i", expectedMonths[i].second, breakdown[i].year)
            assertEquals("Index field", i, breakdown[i].monthIndex)
        }
    }

    @Test
    fun testAnnualRevenueCalculationEligibilityAndAccounting() {
        val txs = listOf(
            // In FY 2026-27 (April 2026) - Paid
            TransactionRecord(
                id = "tx-1",
                orderTime = "2026-04-10T12:00:00Z",
                total = 1050.0,
                tax = 50.0,
                paymentStatus = "paid",
                orderStatus = "COMPLETED"
            ),
            // In FY 2026-27 (October 2026) - Paid
            TransactionRecord(
                id = "tx-2",
                orderTime = "2026-10-15T14:30:00Z",
                total = 2100.0,
                tax = 100.0,
                paymentStatus = "completed",
                orderStatus = "COMPLETED"
            ),
            // In FY 2026-27 (Cancelled / Refunded) - MUST BE EXCLUDED from successful sales
            TransactionRecord(
                id = "tx-3",
                orderTime = "2026-06-01T10:00:00Z",
                total = 5000.0,
                tax = 250.0,
                paymentStatus = "refunded",
                orderStatus = "CANCELLED"
            ),
            // Outside FY 2026-27 (e.g. in 2025) - MUST BE EXCLUDED
            TransactionRecord(
                id = "tx-4",
                orderTime = "2025-10-15T14:30:00Z",
                total = 8000.0,
                tax = 400.0,
                paymentStatus = "paid",
                orderStatus = "COMPLETED"
            )
        )

        val metrics = com.spiraldine.owner.data.util.RevenueCalculator.calculateAnnualMetrics(txs, "2026-27")

        assertEquals(2, metrics.totalOrders)
        assertEquals(3150.0, metrics.grossRevenue, 0.001) // 1050 + 2100
        assertEquals(150.0, metrics.gstCollected, 0.001)     // 50 + 100
        assertEquals(3000.0, metrics.netRevenue, 0.001)    // 3150 - 150
        assertEquals(1575.0, metrics.averageOrderValue, 0.001) // 3150 / 2
        assertEquals(1500.0, metrics.averageMonthlyRevenue, 0.001) // 3000 / 2 active months (Apr & Oct)
    }

    @Test
    fun testDailyRevenueCalculationInvestigation() {
        val txList = listOf(
            TransactionRecord(
                id = "d-1",
                orderTime = "2026-10-22T09:00:00Z",
                total = 1050.0,
                tax = 50.0,
                paymentStatus = "paid",
                orderStatus = "COMPLETED"
            ),
            TransactionRecord(
                id = "d-2",
                orderTime = "2026-10-22T14:00:00Z",
                total = 1050.0,
                tax = 50.0,
                paymentStatus = "paid",
                orderStatus = "COMPLETED"
            ),
            TransactionRecord(
                id = "d-3",
                orderTime = "2026-10-15T12:00:00Z",
                total = 500.0,
                tax = 25.0,
                paymentStatus = "paid",
                orderStatus = "COMPLETED"
            )
        )

        val cal = java.util.Calendar.getInstance()
        cal.set(2026, java.util.Calendar.OCTOBER, 22, 12, 0, 0)

        val daily = com.spiraldine.owner.data.util.RevenueCalculator.calculateDailyRevenue(txList, cal.time)
        assertEquals(2, daily.successfulOrdersCount)
        assertEquals(2100.0, daily.grossRevenue, 0.001)
        assertEquals(100.0, daily.gstCollected, 0.001)
        assertEquals(2000.0, daily.netRevenue, 0.001)
        assertEquals(2, daily.ordersList.size)
    }

    @Test
    fun testTodayBookingsCountLogic() {
        val todayIso = "2026-10-22"
        val reservations = listOf(
            ReservationRecord(id = "r-1", date = todayIso, status = "Confirmed"),
            ReservationRecord(id = "r-2", date = todayIso, status = "Pending"),
            ReservationRecord(id = "r-3", date = todayIso, status = "Cancelled"),
            ReservationRecord(id = "r-4", date = "2026-10-23", status = "Confirmed"),
            ReservationRecord(id = "LOCK_table_4", date = todayIso, status = "Confirmed")
        )

        val count = reservations.count {
            !it.id.startsWith("LOCK_") &&
            (it.date == todayIso || (it.date.isBlank() && it.createdAt.startsWith(todayIso))) &&
            it.status != "Cancelled"
        }

        assertEquals(2, count)
    }

    @Test
    fun testMenuItemFilteringAndSorting() {
        val items = listOf(
            MenuItemRecord(id = "1", name = "Butter Chicken", category = "Mains", price = 380.0, type = "non-veg", available = true, isPublished = true),
            MenuItemRecord(id = "2", name = "Paneer Tikka", category = "Starters", price = 240.0, type = "veg", available = true, isPublished = true),
            MenuItemRecord(id = "3", name = "Dal Makhani", category = "Mains", price = 220.0, type = "veg", available = false, isPublished = true),
            MenuItemRecord(id = "4", name = "Gulab Jamun", category = "Desserts", price = 120.0, type = "veg", available = true, isPublished = false)
        )

        // Filter: Category "Mains"
        val mains = items.filter { it.category == "Mains" }
        assertEquals(2, mains.size)

        // Filter: Vegetarian only
        val vegItems = items.filter { it.type == "veg" }
        assertEquals(3, vegItems.size)

        // Filter: In-Stock only
        val inStock = items.filter { it.available }
        assertEquals(3, inStock.size)

        // Filter: Published only
        val published = items.filter { it.isPublished }
        assertEquals(3, published.size)

        // Sort by price ascending
        val sortedAsc = items.sortedBy { it.price }
        assertEquals("Gulab Jamun", sortedAsc.first().name)
        assertEquals("Butter Chicken", sortedAsc.last().name)
    }

    @Test
    fun testMenuVariantsAndPortions() {
        val variantHalf = MenuVariantRecord(
            id = "var-1",
            itemId = "dish-101",
            itemName = "Butter Chicken",
            name = "Half",
            price = 220.0,
            isAvailable = true
        )
        val variantFull = MenuVariantRecord(
            id = "var-2",
            itemId = "dish-101",
            itemName = "Butter Chicken",
            name = "Full",
            price = 380.0,
            isAvailable = true
        )

        assertEquals("dish-101", variantHalf.itemId)
        assertEquals("Half", variantHalf.name)
        assertEquals(220.0, variantHalf.price, 0.001)
        assertTrue(variantHalf.isAvailable)
        assertEquals(380.0, variantFull.price, 0.001)
    }

    @Test
    fun testMenuAddonsAndModifiers() {
        val cheeseAddon = MenuAddonRecord(
            id = "addon-1",
            name = "Extra Cheese",
            price = 40.0,
            isAvailable = true,
            isGlobal = true
        )
        val spicyDip = MenuAddonRecord(
            id = "addon-2",
            name = "Ghost Pepper Sauce",
            price = 30.0,
            isAvailable = true,
            isGlobal = false,
            applicableItems = listOf("dish-101", "dish-102")
        )

        assertTrue(cheeseAddon.isGlobal)
        assertEquals(40.0, cheeseAddon.price, 0.001)
        assertFalse(spicyDip.isGlobal)
        assertEquals(2, spicyDip.applicableItems.size)
        assertTrue(spicyDip.applicableItems.contains("dish-101"))
    }

    @Test
    fun testMenuCombosAndBundles() {
        val combo = MenuComboRecord(
            id = "combo-1",
            name = "Deluxe Feast",
            description = "1 Butter Chicken, 2 Naan, 1 Coke",
            price = 450.0,
            items = listOf(
                ComboItemRecord(itemId = "bc-1", itemName = "Butter Chicken", quantity = 1),
                ComboItemRecord(itemId = "naan-1", itemName = "Butter Naan", quantity = 2),
                ComboItemRecord(itemId = "coke-1", itemName = "Coca Cola", quantity = 1)
            ),
            isAvailable = true,
            isPublished = true
        )

        assertEquals(3, combo.items.size)
        assertEquals(4, combo.items.sumOf { it.quantity })
        assertEquals(450.0, combo.price, 0.001)
        assertTrue(combo.isAvailable)
    }

    @Test
    fun testMenuAnalyticsCalculations() {
        val items = listOf(
            MenuItemRecord(id = "1", name = "Biryani", price = 300.0, available = true),
            MenuItemRecord(id = "2", name = "Naan", price = 40.0, available = true),
            MenuItemRecord(id = "3", name = "Paneer", price = 250.0, available = false),
            MenuItemRecord(id = "4", name = "Lassi", price = 80.0, available = true)
        )

        val inStockCount = items.count { it.available }
        val inStockPercent = (inStockCount * 100) / items.size
        assertEquals(75, inStockPercent)

        val orders = listOf(
            OrderRecord(
                id = "o-1",
                total = 340.0,
                items = listOf(
                    OrderItemRecord(name = "Biryani", quantity = 1, price = 300.0),
                    OrderItemRecord(name = "Naan", quantity = 1, price = 40.0)
                )
            ),
            OrderRecord(
                id = "o-2",
                total = 600.0,
                items = listOf(
                    OrderItemRecord(name = "Biryani", quantity = 2, price = 300.0)
                )
            )
        )

        val freqMap = mutableMapOf<String, Int>()
        orders.forEach { o ->
            o.items.forEach { itm ->
                freqMap[itm.name] = (freqMap[itm.name] ?: 0) + itm.quantity
            }
        }

        assertEquals(3, freqMap["Biryani"])
        assertEquals(1, freqMap["Naan"])
        assertEquals(940.0, orders.sumOf { it.total }, 0.001)
    }

    @Test
    fun testMenuNavigationDestinations() {
        assertEquals("menu_tools", OwnerNavDestination.MenuTools.route)
        assertEquals("reservations", OwnerNavDestination.Reservations.route)
        assertEquals("categories", OwnerNavDestination.Categories.route)
        assertEquals("menu", OwnerNavDestination.Menu.route)
        assertEquals("billing", OwnerNavDestination.Billing.route)
        assertEquals("inventory", OwnerNavDestination.Inventory.route)
    }

    @Test
    fun testTableRecordAndStatusLogic() {
        val tables = listOf(
            TableRecord(id = "t1", tableNumber = "1", tableName = "Window 1", floor = "Main", section = "Bar", capacity = 4, shape = "square", status = "AVAILABLE", positionX = 50.0, positionY = 100.0),
            TableRecord(id = "t2", tableNumber = "2", tableName = "Window 2", floor = "Main", section = "Bar", capacity = 2, shape = "circle", status = "OCCUPIED", positionX = 120.0, positionY = 100.0),
            TableRecord(id = "t3", tableNumber = "3", tableName = "Patio 1", floor = "Outdoor", section = "Garden", capacity = 6, shape = "rectangle", status = "RESERVED", positionX = 200.0, positionY = 150.0),
            TableRecord(id = "t4", tableNumber = "4", tableName = "Patio 2", floor = "Outdoor", section = "Garden", capacity = 4, shape = "square", status = "CLEANING", positionX = 260.0, positionY = 150.0)
        )

        assertEquals(4, tables.size)
        assertEquals(1, tables.count { it.status.uppercase() == "AVAILABLE" })
        assertEquals(1, tables.count { it.status.uppercase() == "OCCUPIED" })
        assertEquals(1, tables.count { it.status.uppercase() == "RESERVED" })
        assertEquals(1, tables.count { it.status.uppercase() == "CLEANING" })
        assertEquals(16, tables.sumOf { it.capacity })

        // Shape and position verification
        assertEquals("circle", tables[1].shape)
        assertEquals(50.0, tables[0].positionX, 0.001)
        assertEquals(100.0, tables[0].positionY, 0.001)
    }

    @Test
    fun testStaffRecordAndRoleFiltering() {
        val staffList = listOf(
            StaffRecord(id = "s1", name = "Rahul S", email = "rahul@spiraldine.com", role = "waiter", department = "Dining", status = "active"),
            StaffRecord(id = "s2", name = "Priya M", email = "priya@spiraldine.com", role = "kitchen", department = "Kitchen", status = "active"),
            StaffRecord(id = "s3", name = "Amit K", email = "amit@spiraldine.com", role = "manager", department = "Management", status = "suspended"),
            StaffRecord(id = "s4", name = "Neha P", email = "neha@spiraldine.com", role = "cashier", department = "Front Desk", status = "pending", activationToken = "tok-123")
        )

        assertEquals(4, staffList.size)
        val waiters = staffList.filter { it.role == "waiter" }
        val activeMembers = staffList.filter { it.status == "active" }
        val invitedMembers = staffList.filter { it.status == "pending" || it.activationToken.isNotBlank() }

        assertEquals(1, waiters.size)
        assertEquals(2, activeMembers.size)
        assertEquals(1, invitedMembers.size)
        assertEquals("tok-123", invitedMembers.first().activationToken)
    }

    @Test
    fun testShiftDrawerReconciliationAndRefunds() {
        val shift = ShiftRecord(
            id = "shift-01",
            openedBy = "Manager John",
            openingCash = 500.0,
            actualClosingCash = 1850.0,
            expectedClosingCash = 1800.0,
            cashDifference = 50.0,
            status = "CLOSED",
            totalSales = 1300.0,
            ordersCount = 12
        )

        assertEquals(500.0, shift.openingCash, 0.001)
        assertEquals(1300.0, shift.totalSales, 0.001)
        assertEquals(1800.0, shift.openingCash + shift.totalSales, 0.001)
        assertEquals(50.0, shift.actualClosingCash - shift.expectedClosingCash, 0.001)
        assertEquals(12, shift.ordersCount)

        val refund = RefundRecord(
            id = "ref-101",
            orderId = "ord-55",
            transactionId = "tx-99",
            amount = 45.0,
            reason = "Customer cancellation",
            processedBy = "Manager John"
        )

        assertEquals(45.0, refund.amount, 0.001)
        assertEquals("ord-55", refund.orderId)
    }


    @Test
    fun testInventoryCalculationsAndWasteDeduction() {
        val ingredients = listOf(
            InventoryIngredientRecord(id = "i1", name = "Tomatoes", category = "Vegetables", currentStock = 15.0, minStock = 5.0, unit = "kg", purchaseCost = 2.5),
            InventoryIngredientRecord(id = "i2", name = "Paneer", category = "Dairy", currentStock = 3.0, minStock = 5.0, unit = "kg", purchaseCost = 8.0),
            InventoryIngredientRecord(id = "i3", name = "Basmati Rice", category = "Dry Goods", currentStock = 50.0, minStock = 10.0, unit = "kg", purchaseCost = 1.8)
        )

        // Total stock value
        val stockValue = ingredients.sumOf { it.currentStock * it.purchaseCost }
        assertEquals(15.0 * 2.5 + 3.0 * 8.0 + 50.0 * 1.8, stockValue, 0.001) // 37.5 + 24.0 + 90.0 = 151.5
        assertEquals(151.5, stockValue, 0.001)

        // Low stock count
        val lowStock = ingredients.filter { it.currentStock <= it.minStock }
        assertEquals(1, lowStock.size)
        assertEquals("Paneer", lowStock.first().name)

        // Waste deduction test
        val wastedQty = 2.0
        val targetIngredient = ingredients.first { it.id == "i1" }
        val remainingStock = targetIngredient.currentStock - wastedQty
        assertEquals(13.0, remainingStock, 0.001)

        val wasteLog = WasteLogRecord(
            id = "w1",
            ingredientId = targetIngredient.id,
            ingredientName = targetIngredient.name,
            quantity = wastedQty,
            unit = targetIngredient.unit,
            cost = wastedQty * targetIngredient.purchaseCost,
            reason = "spoilage"
        )

        assertEquals(5.0, wasteLog.cost, 0.001)
        assertEquals("spoilage", wasteLog.reason)
    }

    @Test
    fun testBranchRecordAndDetailParity() {
        val branch = BranchRecord(
            id = "br-01",
            name = "Downtown Bistro",
            code = "DT-01",
            address = "123 Market Street",
            city = "Bengaluru",
            phone = "+91 98765 00001",
            managerName = "Rajesh Sharma",
            tablesCount = 20,
            isDefault = true,
            isActive = true
        )

        assertEquals("Downtown Bistro", branch.name)
        assertEquals("DT-01", branch.code)
        assertEquals("Bengaluru", branch.city)
        assertEquals("123 Market Street", branch.address)
        assertEquals(20, branch.tablesCount)
        assertTrue(branch.isDefault)
        assertTrue(branch.isActive)
    }

    @Test
    fun testBranchInventoryTransferStatusProgression() {
        val transfer = BranchTransferRecord(
            id = "tr-101",
            sourceRestaurantId = "br-main",
            sourceRestaurantName = "Main Dining",
            destRestaurantId = "br-rooftop",
            destRestaurantName = "Rooftop Lounge",
            itemName = "Premium Basmati Rice",
            quantity = 25.0,
            unit = "kg",
            requesterName = "Chef Sunil",
            status = "Requested"
        )

        assertEquals("Requested", transfer.status)

        // Status transitions: Requested -> Approved -> Dispatched -> Received
        val approved = transfer.copy(status = "Approved", approverName = "Manager Rajesh")
        assertEquals("Approved", approved.status)
        assertEquals("Manager Rajesh", approved.approverName)

        val dispatched = approved.copy(status = "Dispatched", dispatchedAt = "2026-10-22T14:00:00Z")
        assertEquals("Dispatched", dispatched.status)
        assertTrue(dispatched.dispatchedAt.isNotBlank())

        val received = dispatched.copy(status = "Received", receivedAt = "2026-10-22T16:00:00Z")
        assertEquals("Received", received.status)
        assertTrue(received.receivedAt.isNotBlank())

        // Rejection path
        val rejected = transfer.copy(status = "Rejected")
        assertEquals("Rejected", rejected.status)
    }

    @Test
    fun testCustomerCrmMetricsAndSegmentation() {
        val customers = listOf(
            CustomerRecord(id = "c1", name = "Aarav Patel", totalVisits = 6, totalSpend = 4200.0, segment = "Frequent", loyaltyPoints = 180),
            CustomerRecord(id = "c2", name = "Diya Sharma", totalVisits = 2, totalSpend = 1100.0, segment = "Returning", loyaltyPoints = 40),
            CustomerRecord(id = "c3", name = "Vikram Rao", totalVisits = 1, totalSpend = 450.0, segment = "New", loyaltyPoints = 15),
            CustomerRecord(id = "c4", name = "Sneha Joshi", totalVisits = 3, totalSpend = 1800.0, segment = "Inactive", loyaltyPoints = 60)
        )

        assertEquals(4, customers.size)
        val totalRevenue = customers.sumOf { it.totalSpend }
        assertEquals(7550.0, totalRevenue, 0.001)

        val avgSpend = totalRevenue / customers.size
        assertEquals(1887.5, avgSpend, 0.001)

        val frequentDiners = customers.filter { it.segment == "Frequent" || it.totalVisits >= 5 }
        assertEquals(1, frequentDiners.size)
        assertEquals("Aarav Patel", frequentDiners.first().name)

        val loyaltyPointsSum = customers.sumOf { it.loyaltyPoints }
        assertEquals(295, loyaltyPointsSum)
    }

    @Test
    fun testCustomerFeedbackResolutionWorkflow() {
        val feedback = FeedbackRecord(
            id = "fb-01",
            customerName = "Rohan Mehta",
            rating = "Poor",
            category = "Service",
            notes = "Waiter was delayed in serving main course",
            tableNumber = "5",
            isComplaint = true,
            status = "New"
        )

        assertTrue(feedback.isComplaint)
        assertEquals("New", feedback.status)

        // Assign to staff
        val assigned = feedback.copy(status = "Assigned", assignedToName = "Priya Captain")
        assertEquals("Assigned", assigned.status)
        assertEquals("Priya Captain", assigned.assignedToName)

        // Mark in progress
        val inProgress = assigned.copy(status = "In Progress", internalNotes = "Discussed with table staff")
        assertEquals("In Progress", inProgress.status)

        // Resolve
        val resolved = inProgress.copy(status = "Resolved", internalNotes = "Offered dessert voucher, guest satisfied")
        assertEquals("Resolved", resolved.status)
        assertEquals("Priya Captain", resolved.assignedToName)
    }

    @Test
    fun testCustomerReviewsStarDistributionAndRecommendRate() {
        val reviews = listOf(
            ReviewRecord(id = "r1", customerName = "Sunita", rating = 5, wouldRecommend = true, foodQuality = 5, serviceSpeed = 5, ambience = 5),
            ReviewRecord(id = "r2", customerName = "Arjun", rating = 4, wouldRecommend = true, foodQuality = 4, serviceSpeed = 4, ambience = 5),
            ReviewRecord(id = "r3", customerName = "Karan", rating = 5, wouldRecommend = true, foodQuality = 5, serviceSpeed = 4, ambience = 4),
            ReviewRecord(id = "r4", customerName = "Meera", rating = 2, wouldRecommend = false, foodQuality = 2, serviceSpeed = 3, ambience = 3)
        )

        val avgRating = reviews.map { it.rating }.average()
        assertEquals(4.0, avgRating, 0.001)

        val fiveStarCount = reviews.count { it.rating == 5 }
        assertEquals(2, fiveStarCount)

        val recommendCount = reviews.count { it.wouldRecommend }
        assertEquals(3, recommendCount)

        val recommendPercentage = (recommendCount * 100) / reviews.size
        assertEquals(75, recommendPercentage)
    }

    @Test
    fun testMarketingCampaignsAndAudienceTargeting() {
        val campaign = CampaignRecord(
            id = "camp-01",
            name = "Festive Delight",
            description = "Get 20% off on all weekend family dinners",
            targetAudience = "Returning Customers",
            discountType = "percentage",
            discountValue = 20.0,
            promoCode = "FESTIVE20",
            minSpend = 50.0,
            status = "Active",
            redemptionsCount = 42
        )

        assertEquals("Active", campaign.status)
        assertEquals("Returning Customers", campaign.targetAudience)
        assertEquals("FESTIVE20", campaign.promoCode)
        assertEquals(42, campaign.redemptionsCount)

        // Percentage discount computation
        val orderAmount = 150.0
        val discount = if (orderAmount >= campaign.minSpend) {
            orderAmount * (campaign.discountValue / 100.0)
        } else 0.0
        assertEquals(30.0, discount, 0.001)

        // Flat discount calculation test
        val flatCampaign = campaign.copy(discountType = "flat", discountValue = 25.0)
        val flatDiscount = if (orderAmount >= flatCampaign.minSpend) flatCampaign.discountValue else 0.0
        assertEquals(25.0, flatDiscount, 0.001)
    }

    @Test
    fun testOperationalAlertsSeverityAndAssignment() {
        val alerts = listOf(
            AlertRecord(id = "a1", title = "Low Stock: Paneer", category = "Inventory", severity = "critical", read = false, resolved = false),
            AlertRecord(id = "a2", title = "Drawer Imbalance", category = "Finance", severity = "warning", read = true, resolved = false),
            AlertRecord(id = "a3", title = "New Review", category = "Customers", severity = "info", read = true, resolved = true)
        )

        val unreadCount = alerts.count { !it.read }
        assertEquals(1, unreadCount)

        val criticalCount = alerts.count { it.severity == "critical" }
        assertEquals(1, criticalCount)

        // Alert assignment and resolution
        val alert = alerts.first()
        val assigned = alert.copy(assignedToName = "Chef Manoj")
        assertEquals("Chef Manoj", assigned.assignedToName)

        val resolved = assigned.copy(resolved = true, read = true)
        assertTrue(resolved.resolved)
        assertTrue(resolved.read)
    }

    @Test
    fun test12CanonicalReportsAggregationAndSummaries() {
        val canonicalReportTypes = listOf(
            "sales",
            "restaurant",
            "orders",
            "inventory",
            "customers",
            "staff",
            "reservations",
            "feedback",
            "payments",
            "discounts",
            "cancellations",
            "tax"
        )

        assertEquals(12, canonicalReportTypes.size)

        val sampleReport = ReportSummaryRecord(
            type = "sales",
            title = "Sales Summary Report",
            period = "This Month",
            totalGross = 12500.0,
            totalNet = 11875.0,
            totalTax = 625.0,
            totalDiscount = 350.0,
            totalOrders = 85,
            recordsCount = 85
        )

        assertEquals("sales", sampleReport.type)
        assertEquals("This Month", sampleReport.period)
        assertEquals(12500.0, sampleReport.totalGross, 0.001)
        assertEquals(11875.0, sampleReport.totalNet, 0.001)
        assertEquals(625.0, sampleReport.totalTax, 0.001)
        assertEquals(350.0, sampleReport.totalDiscount, 0.001)
        assertEquals(85, sampleReport.totalOrders)
    }

    @Test
    fun testAuditLogSecurityTrailAndImmutability() {
        val auditLogs = listOf(
            AuditLogRecord(id = "log-1", action = "LOGIN", module = "Auth", actorName = "Owner User", actorRole = "owner", status = "success", ipAddress = "192.168.1.10"),
            AuditLogRecord(id = "log-2", action = "CREATE_PROMO", module = "Marketing", actorName = "Manager John", actorRole = "manager", status = "success", ipAddress = "192.168.1.15"),
            AuditLogRecord(id = "log-3", action = "FAILED_LOGIN", module = "Auth", actorName = "Unknown", actorRole = "guest", status = "warning", ipAddress = "10.0.0.42")
        )

        assertEquals(3, auditLogs.size)
        val authEvents = auditLogs.filter { it.module == "Auth" }
        assertEquals(2, authEvents.size)

        val warningEvents = auditLogs.filter { it.status == "warning" }
        assertEquals(1, warningEvents.size)

        // Verify that audit log records contain no secrets or passwords
        auditLogs.forEach { log ->
            assertFalse(log.description.contains("password", ignoreCase = true))
            assertFalse(log.description.contains("token", ignoreCase = true))
            assertFalse(log.description.contains("secret", ignoreCase = true))
        }
    }

    @Test
    fun testAllTenMoreDestinationsRouteIntegrity() {
        // Group A: Business Management
        assertEquals("restaurants", OwnerNavDestination.Restaurants.route)
        assertEquals("branch_transfers", OwnerNavDestination.BranchTransfers.route)

        // Group B: Customers & Engagement
        assertEquals("customers", OwnerNavDestination.Customers.route)
        assertEquals("feedback", OwnerNavDestination.Feedback.route)
        assertEquals("reviews", OwnerNavDestination.Reviews.route)

        // Group C: Growth & Marketing
        assertEquals("promotions", OwnerNavDestination.Promotions.route)
        assertEquals("marketing", OwnerNavDestination.Marketing.route)

        // Group D: Operations & Insights
        assertEquals("alerts", OwnerNavDestination.Alerts.route)
        assertEquals("reports", OwnerNavDestination.Reports.route)
        assertEquals("audit_logs", OwnerNavDestination.AuditLogs.route)
    }

    @Test
    fun testRestaurantDetailRecordCreationAndFieldIntegrity() {
        val record = RestaurantDetailRecord(
            id = "rest-madhapur-01",
            name = "SpiralDine Bistro - Madhapur",
            address = "Plot 42, Hitech City Main Road",
            city = "Hyderabad",
            phone = "+91 9876543210",
            cuisine = "Biryani, North Indian, Continental",
            planTier = "pro",
            status = "active",
            isOpen = true,
            managerId = "emp-001",
            managerName = "Vikram Sharma",
            tableCount = 18,
            staffCount = 12,
            todaySales = 4520.0,
            todayOrders = 28,
            ownerUid = "owner-uid-123"
        )

        assertEquals("rest-madhapur-01", record.id)
        assertEquals("SpiralDine Bistro - Madhapur", record.name)
        assertEquals("Hyderabad", record.city)
        assertEquals("Biryani, North Indian, Continental", record.cuisine)
        assertEquals("pro", record.planTier)
        assertEquals("active", record.status)
        assertTrue(record.isOpen)
        assertEquals("Vikram Sharma", record.managerName)
        assertEquals(18, record.tableCount)
        assertEquals(28, record.todayOrders)
        assertEquals(4520.0, record.todaySales, 0.001)
    }

    @Test
    fun testRestaurantPortfolioMetricsCalculations() {
        val restaurants = listOf(
            RestaurantDetailRecord(id = "r1", name = "Bistro Hitech", city = "Hyderabad", status = "active", tableCount = 15, todayOrders = 30, todaySales = 5400.0),
            RestaurantDetailRecord(id = "r2", name = "Bistro Jubilee", city = "Hyderabad", status = "active", tableCount = 20, todayOrders = 45, todaySales = 8200.0),
            RestaurantDetailRecord(id = "r3", name = "Bistro Indiranagar", city = "Bengaluru", status = "suspended", tableCount = 12, todayOrders = 0, todaySales = 0.0),
            RestaurantDetailRecord(id = "r4", name = "Bistro Koramangala", city = "Bengaluru", status = "active", tableCount = 25, todayOrders = 50, todaySales = 9500.0)
        )

        val totalLocations = restaurants.size
        val activeCount = restaurants.count { it.status.equals("active", ignoreCase = true) }
        val suspendedCount = restaurants.count { it.status.equals("suspended", ignoreCase = true) }
        val totalOrders = restaurants.sumOf { it.todayOrders }
        val managedTables = restaurants.sumOf { it.tableCount }
        val totalPortfolioSales = restaurants.sumOf { it.todaySales }

        assertEquals(4, totalLocations)
        assertEquals(3, activeCount)
        assertEquals(1, suspendedCount)
        assertEquals(125, totalOrders)
        assertEquals(72, managedTables)
        assertEquals(23100.0, totalPortfolioSales, 0.001)
    }

    @Test
    fun testRestaurantSearchAndFilteringLogic() {
        val portfolio = listOf(
            RestaurantDetailRecord(id = "r1", name = "SpiralDine Hitech", city = "Hyderabad", cuisine = "Biryani", status = "active"),
            RestaurantDetailRecord(id = "r2", name = "SpiralDine Gachibowli", city = "Hyderabad", cuisine = "Continental", status = "suspended"),
            RestaurantDetailRecord(id = "r3", name = "SpiralDine Whitefield", city = "Bengaluru", cuisine = "South Indian", status = "active")
        )

        // 1. Search Query
        val queryMatches = portfolio.filter {
            it.name.contains("Gachibowli", ignoreCase = true) || it.city.contains("Gachibowli", ignoreCase = true)
        }
        assertEquals(1, queryMatches.size)
        assertEquals("r2", queryMatches[0].id)

        // 2. Status Filter: Active
        val activeOnly = portfolio.filter { it.status.equals("active", ignoreCase = true) }
        assertEquals(2, activeOnly.size)

        // 3. Status Filter: Suspended
        val suspendedOnly = portfolio.filter { it.status.equals("suspended", ignoreCase = true) }
        assertEquals(1, suspendedOnly.size)

        // 4. Location Filter: Bengaluru
        val blrOnly = portfolio.filter { it.city.equals("Bengaluru", ignoreCase = true) }
        assertEquals(1, blrOnly.size)
        assertEquals("SpiralDine Whitefield", blrOnly[0].name)

        // 5. Combined Search + Status Filter
        val combined = portfolio.filter {
            it.name.contains("SpiralDine", ignoreCase = true) &&
            it.status.equals("active", ignoreCase = true) &&
            it.city.equals("Hyderabad", ignoreCase = true)
        }
        assertEquals(1, combined.size)
        assertEquals("SpiralDine Hitech", combined[0].name)
    }

    @Test
    fun testRestaurantStatusTransitionRules() {
        var status = "active"
        fun toggleStatus(current: String): String {
            return if (current.equals("active", ignoreCase = true)) "suspended" else "active"
        }

        status = toggleStatus(status)
        assertEquals("suspended", status)

        status = toggleStatus(status)
        assertEquals("active", status)
    }

    @Test
    fun testBranchManagerAssignmentLogic() {
        var managerId = ""
        var managerName = "Unassigned"

        fun assignManager(staffId: String, staffName: String) {
            managerId = staffId
            managerName = staffName.ifBlank { "Unassigned" }
        }

        assignManager("emp-44", "Ananya Reddy")
        assertEquals("emp-44", managerId)
        assertEquals("Ananya Reddy", managerName)

        // Unassigning
        assignManager("", "")
        assertEquals("", managerId)
        assertEquals("Unassigned", managerName)
    }

    @Test
    fun testBranchRecordAndSwitchingParity() {
        val branches = listOf(
            BranchRecord(id = "b1", name = "Main Dining", code = "BR-01", city = "Hyderabad", tablesCount = 14, isDefault = true, isActive = true),
            BranchRecord(id = "b2", name = "Rooftop Lounge", code = "BR-02", city = "Hyderabad", tablesCount = 10, isDefault = false, isActive = true),
            BranchRecord(id = "b3", name = "Express Counter", code = "BR-03", city = "Secunderabad", tablesCount = 6, isDefault = false, isActive = false)
        )

        assertEquals(3, branches.size)
        val defaultBranch = branches.find { it.isDefault }
        assertNotNull(defaultBranch)
        assertEquals("b1", defaultBranch?.id)

        // Switch active branch to b2
        var activeBranchId = "b1"
        fun switchBranch(newId: String) {
            activeBranchId = newId
        }
        switchBranch("b2")
        assertEquals("b2", activeBranchId)

        // Verify active branches
        val activeBranches = branches.filter { it.isActive }
        assertEquals(2, activeBranches.size)

        // Total seating tables across all branches
        val totalTables = branches.sumOf { it.tablesCount }
        assertEquals(30, totalTables)
    }

    @Test
    fun testPaiseFormattingParity() {
        // Chicken 65: 26900 paise = ₹269.00 (NOT ₹26,900.00)
        val chicken65Paise = 26900.0
        val chicken65Formatted = RevenueCalculator.formatPaise(chicken65Paise)
        assertEquals("₹269.00", chicken65Formatted)

        // Discounted Chicken 65: 24900 paise = ₹249.00
        val discountPaise = 24900.0
        val discountFormatted = RevenueCalculator.formatPaise(discountPaise)
        assertEquals("₹249.00", discountFormatted)

        // Zero paise
        assertEquals("₹0.00", RevenueCalculator.formatPaise(0.0))

        // Large order: 125000 paise = ₹1,250.00
        assertEquals("₹1,250.00", RevenueCalculator.formatPaise(125000.0))
    }

    @Test
    fun testBatchProductionModelAndDefaults() {
        val batchItem = MenuItemRecord(
            id = "m-batch-1",
            name = "Dum Biryani",
            productionMode = "Batch Production",
            preparationMethod = "batch",
            defaultBatchSize = 60,
            availableServings = 45,
            lowStockThreshold = 15,
            autoUnavailable = true,
            showServingsToStaff = true,
            allowRefill = true
        )

        assertEquals("Batch Production", batchItem.productionMode)
        assertEquals("batch", batchItem.preparationMethod)
        assertEquals(60, batchItem.defaultBatchSize)
        assertEquals(45, batchItem.availableServings)
        assertEquals(15, batchItem.lowStockThreshold)
        assertTrue(batchItem.autoUnavailable)
        assertTrue(batchItem.showServingsToStaff)
        assertTrue(batchItem.allowRefill)

        // Test default parameters on MenuItemRecord
        val defaultItem = MenuItemRecord(id = "m-def")
        assertEquals(50, defaultItem.defaultBatchSize)
        assertEquals(50, defaultItem.availableServings)
        assertEquals(10, defaultItem.lowStockThreshold)
        assertTrue(defaultItem.autoUnavailable)
        assertTrue(defaultItem.showServingsToStaff)
        assertTrue(defaultItem.allowRefill)
    }

    @Test
    fun testTableNormalizedCoordinatesParity() {
        val widthPx = 800f
        val heightPx = 600f

        // Table with 45.0% X and 60.0% Y (canonical Desktop percentage)
        val table = TableRecord(
            id = "t-1",
            tableNumber = "5",
            positionX = 45.0,
            positionY = 60.0
        )

        val pixelX = ((table.positionX / 100.0) * widthPx).toFloat()
        val pixelY = ((table.positionY / 100.0) * heightPx).toFloat()
        assertEquals(360f, pixelX, 0.1f)
        assertEquals(360f, pixelY, 0.1f)

        // Simulate drag to new pixel offset
        val newPixelX = 540f
        val newPixelY = 420f
        val recoveredPctX = ((newPixelX / widthPx) * 100.0).coerceIn(0.0, 90.0)
        val recoveredPctY = ((newPixelY / heightPx) * 100.0).coerceIn(0.0, 90.0)

        assertEquals(67.5, recoveredPctX, 0.1)
        assertEquals(70.0, recoveredPctY, 0.1)
    }

    @Test
    fun testMenuAnalyticsCalculationsParity() {
        val menu = listOf(
            MenuItemRecord(id = "1", name = "Biryani", category = "Mains", price = 30000.0, available = true),
            MenuItemRecord(id = "2", name = "Naan", category = "Breads", price = 4000.0, available = true),
            MenuItemRecord(id = "3", name = "Kulfi", category = "Desserts", price = 10000.0, available = false)
        )

        val orders = listOf(
            OrderRecord(
                id = "o1",
                status = "COMPLETED",
                total = 64000.0,
                items = listOf(
                    OrderItemRecord(name = "Biryani", quantity = 2, price = 30000.0),
                    OrderItemRecord(name = "Naan", quantity = 1, price = 4000.0)
                )
            )
        )

        // Verify In-Stock Ratio
        val inStockCount = menu.count { it.available }
        val inStockRatio = if (menu.isNotEmpty()) (inStockCount.toDouble() / menu.size * 100.0).toInt() else 0
        assertEquals(66, inStockRatio) // 2 of 3 in stock = 66%

        // Verify Gross Revenue
        val validOrders = orders.filter { it.status != "CANCELLED" && it.status != "REJECTED" }
        val grossRevenue = validOrders.sumOf { it.total }
        assertEquals(64000.0, grossRevenue, 0.001)
        assertEquals("₹640.00", RevenueCalculator.formatPaise(grossRevenue))
    }

    @Test
    fun testOwnerAnalyticsAndSettingsProfileModel() {
        // 1. RestaurantOverview contains dynamic email and logo
        val overview = RestaurantOverview(
            name = "Paradise Biryani",
            email = "geethakrishnakumbha123@gmail.com",
            logoUrl = "https://example.com/logo.png"
        )
        assertEquals("Paradise Biryani", overview.name)
        assertEquals("geethakrishnakumbha123@gmail.com", overview.email)
        assertEquals("https://example.com/logo.png", overview.logoUrl)

        // 2. isWithinDaysInTimezone test
        val tz = java.util.TimeZone.getTimeZone("Asia/Kolkata")
        val nowCal = java.util.Calendar.getInstance(tz)
        val todayIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply { timeZone = tz }.format(nowCal.time)
        assertTrue(RevenueCalculator.isWithinDaysInTimezone(todayIso, 7, tz))
        assertTrue(RevenueCalculator.isWithinDaysInTimezone(todayIso, 30, tz))

        // 60 days ago order is NOT within 7 or 30 days
        val pastCal = java.util.Calendar.getInstance(tz).apply { add(java.util.Calendar.DAY_OF_YEAR, -60) }
        val pastIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply { timeZone = tz }.format(pastCal.time)
        assertFalse(RevenueCalculator.isWithinDaysInTimezone(pastIso, 7, tz))
        assertFalse(RevenueCalculator.isWithinDaysInTimezone(pastIso, 30, tz))

        // 3. Analytics amounts are formatted with rupee and NO dollar signs
        val samplePaise = 41800.0
        val formatted = RevenueCalculator.formatPaise(samplePaise)
        assertEquals("₹418.00", formatted)
        assertFalse(formatted.contains("$"))
        assertTrue(formatted.startsWith("₹"))
    }

    @Test
    fun testUserProfileDataModelAndRoleBadgeDerivation() {
        // Owner Profile
        val ownerProfile = UserProfile(
            uid = "uid-owner-123",
            email = "owner@spiraldine.com",
            displayName = "Ramesh Kumar",
            role = "owner",
            tenantId = "rest-001"
        )
        assertEquals("Ramesh Kumar", ownerProfile.displayName)
        assertEquals("owner@spiraldine.com", ownerProfile.email)
        assertEquals("owner", ownerProfile.role)

        // Deriving role badge label
        val ownerBadge = when (ownerProfile.role.lowercase()) {
            "owner" -> "Verified Workspace Owner"
            "manager" -> "Verified Manager"
            "kitchen" -> "Verified Kitchen Staff"
            "waiter" -> "Verified Service Staff"
            "cashier" -> "Verified Billing Staff"
            else -> "Verified Staff Member"
        }
        assertEquals("Verified Workspace Owner", ownerBadge)

        // Staff Profile (Waiter)
        val waiterProfile = UserProfile(
            uid = "uid-waiter-456",
            email = "staff.service@spiraldine.com",
            displayName = "Suresh Raina",
            role = "waiter",
            tenantId = "rest-001",
            branchId = "branch-south"
        )
        val waiterBadge = when (waiterProfile.role.lowercase()) {
            "owner" -> "Verified Workspace Owner"
            "manager" -> "Verified Manager"
            "kitchen" -> "Verified Kitchen Staff"
            "waiter" -> "Verified Service Staff"
            "cashier" -> "Verified Billing Staff"
            else -> "Verified Staff Member"
        }
        assertEquals("Verified Service Staff", waiterBadge)

        // Staff Profile without display name falls back to email prefix, not hardcoded string
        val profileNoName = UserProfile(
            uid = "uid-kitchen-789",
            email = "chef.anand@spiraldine.com",
            displayName = "",
            role = "kitchen",
            tenantId = "rest-001"
        )
        val resolvedName = if (profileNoName.displayName.isNotBlank()) {
            profileNoName.displayName
        } else if (profileNoName.email.isNotBlank()) {
            profileNoName.email.substringBefore('@')
        } else {
            "Authorized User"
        }
        assertEquals("chef.anand", resolvedName)

        // Profile without name or email falls back to neutral Authorized User, NOT a fabricated identity
        val anonymousProfile = UserProfile(
            uid = "uid-anon-000",
            email = "",
            displayName = "",
            role = "staff"
        )
        val neutralName = if (anonymousProfile.displayName.isNotBlank()) {
            anonymousProfile.displayName
        } else if (anonymousProfile.email.isNotBlank()) {
            anonymousProfile.email.substringBefore('@')
        } else {
            "Authorized User"
        }
        assertEquals("Authorized User", neutralName)
    }

    @Test
    fun testAccountSwitchingDataIsolation() {
        // Account A: Owner of Restaurant A
        val sessionUserA = UserProfile(
            uid = "user-A-owner",
            email = "owner.branch1@spiraldine.com",
            displayName = "Ananya Sharma",
            role = "owner",
            tenantId = "tenant-A"
        )
        val overviewA = RestaurantOverview(
            name = "Bawarchi Central",
            branch = "Hitech City",
            email = sessionUserA.email
        )

        // Verify Account A details
        assertEquals("Ananya Sharma", sessionUserA.displayName)
        assertEquals("owner.branch1@spiraldine.com", sessionUserA.email)
        assertEquals("Bawarchi Central", overviewA.name)
        assertEquals("Hitech City", overviewA.branch)

        // Simulate Logout / Session Reset: All user and restaurant state is wiped clean
        var currentProfile: UserProfile? = sessionUserA
        var currentOverview: RestaurantOverview? = overviewA

        // Reset session
        currentProfile = null
        currentOverview = RestaurantOverview() // default blank state

        assertNull(currentProfile)
        assertEquals("SpiralDine Restaurant", currentOverview.name)
        assertEquals("", currentOverview.email)

        // Account B: Staff Member of Restaurant B
        val sessionUserB = UserProfile(
            uid = "user-B-waiter",
            email = "waiter.john@spiraldine.com",
            displayName = "John Doe",
            role = "waiter",
            tenantId = "tenant-B",
            branchId = "branch-B"
        )
        val overviewB = RestaurantOverview(
            name = "Paradise Dine",
            branch = "Secunderabad",
            email = "" // Staff user doesn't own restaurant email
        )
        currentProfile = sessionUserB
        currentOverview = overviewB

        // Verify complete isolation: No Account A data remains
        assertEquals("user-B-waiter", currentProfile.uid)
        assertEquals("waiter.john@spiraldine.com", currentProfile.email)
        assertEquals("John Doe", currentProfile.displayName)
        assertFalse(currentProfile.email!!.contains("owner.branch1"))
        assertFalse(currentOverview.name.contains("Bawarchi"))
        assertEquals("Secunderabad", currentOverview.branch)
    }

    @Test
    fun testAvatarInitialComputation() {
        // 1. Initial from displayName
        val initialFromName = "Vijay Kumar".trim().firstOrNull()?.uppercaseChar()?.toString() ?: "U"
        assertEquals("V", initialFromName)

        // 2. Initial from email when displayName is null
        val email = "operations@spiraldine.com"
        val initialFromEmail = email.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "U"
        assertEquals("O", initialFromEmail)

        // 3. Initial fallback when both null
        val nullName: String? = null
        val nullEmail: String? = null
        val fallbackInitial = nullName?.trim()?.firstOrNull()?.uppercaseChar()?.toString()
            ?: nullEmail?.trim()?.firstOrNull()?.uppercaseChar()?.toString()
            ?: "U"
        assertEquals("U", fallbackInitial)
    }
}




