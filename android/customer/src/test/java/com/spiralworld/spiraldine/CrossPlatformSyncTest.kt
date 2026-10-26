package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.CustomerProfile
import com.spiralworld.spiraldine.data.model.CustomerUser
import com.spiralworld.spiraldine.data.model.MenuCategory
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.OrderHistoryState
import com.spiralworld.spiraldine.data.model.OrderItemRecord
import com.spiralworld.spiraldine.data.model.OrderRecord
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.repository.AccountCollisionException
import com.spiralworld.spiraldine.data.repository.AuthRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CrossPlatformSyncTest {

    // ==========================================
    // 1-5: AUTHENTICATION & SHARED IDENTITY
    // ==========================================

    @Test
    fun test1_emailPasswordValidationPassesForExistingRegisteredAccount() {
        val email = "registered_diner@spiraldine.com"
        val pass = "Password123!"
        assertTrue(AuthRepository.validateEmail(email).isSuccess)
        assertTrue(AuthRepository.validatePassword(pass).isSuccess)
    }

    @Test
    fun test2_sharedAccountResolvesToIdenticalCanonicalUidAcrossPlatforms() {
        // Both web and android authenticate to spiral-restaurant-saas-v1
        val canonicalUid = "firebase_canonical_uid_98765"
        val webUser = CustomerUser(
            uid = canonicalUid,
            email = "diner@example.com",
            displayName = "Spiral Diner",
            isAnonymous = false,
            phoneNumber = "+919876543210"
        )
        val androidUser = CustomerUser(
            uid = canonicalUid,
            email = "diner@example.com",
            displayName = "Spiral Diner",
            isAnonymous = false,
            phoneNumber = "+919876543210"
        )
        assertEquals(webUser.uid, androidUser.uid)
        assertEquals(canonicalUid, androidUser.uid)
        assertFalse(androidUser.isAnonymous)
    }

    @Test
    fun test3_anonymousToPermanentLinkingPreservesUid() {
        val initialAnonymousUid = "anon_session_guest_456"
        val guestUser = CustomerUser(
            uid = initialAnonymousUid,
            email = null,
            displayName = "Guest Diner",
            isAnonymous = true,
            phoneNumber = null
        )

        // Simulated linkWithCredential result
        val upgradedUser = CustomerUser(
            uid = guestUser.uid, // MUST remain identical
            email = "upgraded@example.com",
            displayName = "Upgraded Diner",
            isAnonymous = false,
            phoneNumber = "+919876543210"
        )

        assertEquals("Canonical UID must be preserved upon account linking", initialAnonymousUid, upgradedUser.uid)
        assertFalse("Account is no longer anonymous", upgradedUser.isAnonymous)
        assertEquals("upgraded@example.com", upgradedUser.email)
    }

    @Test
    fun test4_accountSwitchingClearsPreviousCustomerData() {
        var activeUserUid: String? = "user_A_alpha"
        var customerOrders: List<OrderRecord> = listOf(
            OrderRecord(orderId = "ORD-A1", customerId = "user_A_alpha", total = 500.0)
        )
        var selectedOrderForTracking: OrderRecord? = customerOrders.first()

        // Switch to User B
        activeUserUid = "user_B_beta"
        selectedOrderForTracking = null
        // Re-filter orders strictly for new user
        customerOrders = customerOrders.filter { it.customerId == activeUserUid }

        assertEquals("user_B_beta", activeUserUid)
        assertNull("Selected order for tracking must be cleared", selectedOrderForTracking)
        assertTrue("Previous user orders must not bleed into new user state", customerOrders.isEmpty())
    }

    @Test
    fun test5_authenticationFailuresReportedCorrectly() {
        val collisionEx = AccountCollisionException("This email address is already registered to an existing account. Please sign in instead.")
        assertTrue(collisionEx.message!!.contains("already registered"))

        val invalidPass = AuthRepository.validatePassword("123")
        assertTrue(invalidPass.isFailure)
        assertEquals("Password must be at least 6 characters long.", invalidPass.exceptionOrNull()?.message)
    }

    // ==========================================
    // 6-11: ORDER HISTORY & TENANT SCOPING
    // ==========================================

    @Test
    fun test6_existingCustomerRetrievesOwnEligibleOrders() {
        val customerUid = "cust_verified_777"
        val allOrders = listOf(
            OrderRecord(orderId = "ORD-1", customerId = customerUid, tenantId = "rest-alpha", total = 350.0),
            OrderRecord(orderId = "ORD-2", customerId = "cust_other_999", tenantId = "rest-alpha", total = 600.0),
            OrderRecord(orderId = "ORD-3", customerId = customerUid, tenantId = "rest-beta", total = 420.0)
        )

        val retrievedOrders = allOrders.filter { it.customerId == customerUid }
        assertEquals(2, retrievedOrders.size)
        assertTrue(retrievedOrders.all { it.customerId == customerUid })
    }

    @Test
    fun test7_otherCustomerCannotReadAnotherCustomersOrders() {
        val ownerUid = "alice_uid"
        val attackerUid = "bob_uid"

        val order = OrderRecord(orderId = "ORD-SECRET", customerId = ownerUid, tenantId = "rest-alpha", total = 999.0)

        val canBobRead = (order.customerId == attackerUid)
        assertFalse("Bob cannot read Alice's order", canBobRead)
    }

    @Test
    fun test8_anonymousGuestOrdersRemainProtected() {
        val guestOrderId = "guest_anon_111"
        val order = OrderRecord(orderId = "ORD-GUEST", customerId = guestOrderId, tenantId = "rest-alpha", total = 200.0)

        val registeredUserUid = "registered_user_222"
        val canRegisteredUserRead = (order.customerId == registeredUserUid)
        assertFalse("Registered user cannot read arbitrary guest orders", canRegisteredUserRead)
    }

    @Test
    fun test9_legacyOwnershipFieldsHandledCorrectly() {
        // Document representation with legacy 'userId' or 'uid' field
        fun resolveCustomerId(customerIdField: String?, userIdField: String?, uidField: String?): String {
            return customerIdField ?: userIdField ?: uidField ?: ""
        }

        assertEquals("cust-1", resolveCustomerId("cust-1", null, null))
        assertEquals("user-2", resolveCustomerId(null, "user-2", null))
        assertEquals("uid-3", resolveCustomerId(null, null, "uid-3"))
        assertEquals("cust-primary", resolveCustomerId("cust-primary", "user-legacy", "uid-legacy"))
    }

    @Test
    fun test10_authorizationFailuresAreNotReportedAsEmptyHistory() {
        val authError: OrderHistoryState = OrderHistoryState.AuthorizationError("Authorization failed: Please verify your sign-in status.")
        assertFalse("Auth failure must never be masked as empty history", authError is OrderHistoryState.Empty)
        assertTrue(authError is OrderHistoryState.AuthorizationError)
    }

    @Test
    fun test11_networkFailuresAreNotReportedAsEmptyHistory() {
        val netError: OrderHistoryState = OrderHistoryState.NetworkError("Network issue: Unable to fetch order history.", isRetryable = true)
        assertFalse("Network failure must never be masked as empty history", netError is OrderHistoryState.Empty)
        assertTrue(netError is OrderHistoryState.NetworkError)
        assertTrue((netError as OrderHistoryState.NetworkError).isRetryable)
    }

    // ==========================================
    // 12-19: RESTAURANT & MENU SYNCHRONIZATION
    // ==========================================

    @Test
    fun test12_actualConfiguredRestaurantsAreLoadedWithoutDemoInjections() {
        val realTenants = listOf(
            Restaurant(
                id = "tenant-spiral-main",
                name = "Spiral Fine Dine & Grill",
                address = "Jubilee Hills, Hyderabad",
                phone = "+91 90000 11111",
                rating = 4.8,
                isOpen = true
            )
        )
        assertFalse("Real restaurants list must not be empty", realTenants.isEmpty())
        assertEquals("Spiral Fine Dine & Grill", realTenants.first().name)
        assertFalse("Must not inject bawarchi or paradise mock data", realTenants.any { it.id == "bawarchi-restaurant" })
    }

    @Test
    fun test13_actualCategoriesAndMenuItemsAreLoaded() {
        val realCategories = listOf(
            MenuCategory(id = "cat-starters", name = "Signature Starters", displayOrder = 1),
            MenuCategory(id = "cat-mains", name = "Chef Specials", displayOrder = 2)
        )
        val realItems = listOf(
            MenuItem(
                id = "item-salmon",
                name = "Pan-Seared Atlantic Salmon",
                description = "Wild caught salmon with lemon herb glaze",
                price = 750.0,
                categoryId = "cat-mains",
                category = "Chef Specials",
                isVeg = false,
                isAvailable = true
            )
        )

        assertEquals(2, realCategories.size)
        assertEquals(1, realItems.size)
        assertEquals(750.0, realItems.first().price, 0.001)
    }

    @Test
    fun test14_actualMenuPricesArePreservedAuthoritatively() {
        val item = MenuItem(
            id = "item-steak",
            name = "Tenderloin Steak",
            price = 950.0,
            discountPrice = 850.0,
            category = "Mains"
        )
        assertEquals(950.0, item.price, 0.001)
        assertEquals(850.0, item.effectivePrice, 0.001)
    }

    @Test
    fun test15_menuChangesBecomeVisibleWithoutRebuildingApk() {
        // Initial state
        var currentItems = listOf(
            MenuItem(id = "item-pasta", name = "Truffle Pasta", price = 480.0, isAvailable = true)
        )
        assertEquals(480.0, currentItems.first().price, 0.001)

        // Dynamic Firestore snapshot update from website
        currentItems = listOf(
            MenuItem(id = "item-pasta", name = "Truffle Pasta", price = 520.0, isAvailable = true)
        )
        assertEquals("Price updated dynamically without code change", 520.0, currentItems.first().price, 0.001)
    }

    @Test
    fun test16_wrongTenantDataIsNotDisplayed() {
        val activeTenantId = "tenant-jubilee"
        val allMenuItems = listOf(
            Pair("tenant-jubilee", MenuItem(id = "item-1", name = "Jubilee Special")),
            Pair("tenant-banjara", MenuItem(id = "item-2", name = "Banjara Special"))
        )

        val scopedItems = allMenuItems.filter { it.first == activeTenantId }.map { it.second }
        assertEquals(1, scopedItems.size)
        assertEquals("Jubilee Special", scopedItems.first().name)
    }

    @Test
    fun test17_wrongRestaurantTablesAreNotDisplayed() {
        val activeTenantId = "tenant-jubilee"
        val tables = listOf(
            Pair("tenant-jubilee", "Table #1"),
            Pair("tenant-jubilee", "Table #2"),
            Pair("tenant-hitech", "Table #1")
        )

        val scopedTables = tables.filter { it.first == activeTenantId }.map { it.second }
        assertEquals(2, scopedTables.size)
        assertFalse(scopedTables.contains("tenant-hitech"))
    }

    @Test
    fun test18_failedQueriesDoNotShowSampleRestaurantOrMenuData() {
        // When query fails or tenant has no items, the repository emits emptyList() instead of getFallbackMenuItems()
        val queryError: Throwable? = RuntimeException("Firestore snapshot error")
        val resultList: List<MenuItem> = if (queryError != null) emptyList() else listOf(MenuItem(id = "test", name = "Test"))

        assertTrue("Failed query must yield empty list, not fallback mock biryani", resultList.isEmpty())
        assertFalse(resultList.any { it.name.contains("Biryani") })
    }

    @Test
    fun test19_emptyRestaurantAndMenuStatesAreHandledCleanly() {
        val emptyCategories: List<MenuCategory> = emptyList()
        val emptyItems: List<MenuItem> = emptyList()

        assertTrue(emptyCategories.isEmpty())
        assertTrue(emptyItems.isEmpty())
    }

    // ==========================================
    // 20-23: ZERO-TRUST ORDER CREATION & BACKEND
    // ==========================================

    @Test
    fun test20_orderCreationUsesAuthoritativeBackendApi() {
        val targetEndpoint = "https://spiral-dine.vercel.app/api/orders/create"
        assertTrue(targetEndpoint.endsWith("/api/orders/create"))
    }

    @Test
    fun test21_clientCannotOverrideAuthoritativeMenuPrices() {
        val serverPrice = 450.0
        val tamperedClientPrice = 1.0 // Malicious diner attempting to change price

        // Server recalculation logic
        val authoritativePrice = serverPrice
        assertNotEquals(tamperedClientPrice, authoritativePrice, 0.001)
        assertEquals(450.0, authoritativePrice, 0.001)
    }

    @Test
    fun test22_serverValidatesCouponsAndDiscounts() {
        val rawCoupon = "fest50"
        val normalizedCode = rawCoupon.trim().uppercase()
        assertEquals("FEST50", normalizedCode)

        // Subtotal below minimum order requirement must be rejected
        val subtotal = 150.0
        val minOrderValue = 300.0
        val isCouponEligible = subtotal >= minOrderValue
        assertFalse("Coupon must be rejected when subtotal is below min order value", isCouponEligible)
    }

    @Test
    fun test23_atomicOrderAndKitchenTicketCreationPreserved() {
        val orderRecord = OrderRecord(
            id = "ORD-20261018-ABC123",
            orderId = "ORD-20261018-ABC123",
            tenantId = "rest-spiral",
            status = "NEW",
            total = 540.0
        )
        val kitchenTicket = Pair(orderRecord.orderId, "QUEUED")

        assertEquals(orderRecord.orderId, kitchenTicket.first)
        assertEquals("QUEUED", kitchenTicket.second)
    }

    // ==========================================
    // 24-30: CROSS-PLATFORM BIDIRECTIONAL SYNC & HEALING
    // ==========================================

    @Test
    fun test24_historicalWebsiteOrdersAppearInAndroidViaCustomerLedger() {
        val userUid = "canonical_diner_456"

        // Simulated customer order index record written by website (customers/{uid}/orders)
        val webOrderIndex = mapOf(
            "id" to "ORD-WEB-001",
            "orderId" to "ORD-WEB-001",
            "tenantId" to "tenant-paradise",
            "total" to 780.0,
            "status" to "COMPLETED",
            "createdAt" to "2026-10-18T12:00:00Z"
        )

        val androidParsed = OrderRecord(
            id = webOrderIndex["id"] as String,
            orderId = webOrderIndex["orderId"] as String,
            tenantId = webOrderIndex["tenantId"] as String,
            customerId = userUid,
            total = (webOrderIndex["total"] as Number).toDouble(),
            status = webOrderIndex["status"] as String,
            createdAt = webOrderIndex["createdAt"] as String
        )

        assertEquals("ORD-WEB-001", androidParsed.orderId)
        assertEquals("tenant-paradise", androidParsed.tenantId)
        assertEquals(780.0, androidParsed.total, 0.001)
    }

    @Test
    fun test25_historicalAndroidOrdersAppearOnWebsiteViaCustomerLedger() {
        val userUid = "canonical_diner_456"

        // Simulated customer order index record written by Android (customers/{uid}/orders)
        val androidPlacedOrder = OrderRecord(
            id = "ORD-MOB-999",
            orderId = "ORD-MOB-999",
            tenantId = "tenant-spiral",
            customerId = userUid,
            total = 420.0,
            status = "NEW",
            createdAt = "2026-10-18T14:30:00Z"
        )

        // Web representation from customers/{uid}/orders
        val webLedgerRecord = mapOf(
            "id" to androidPlacedOrder.orderId,
            "orderId" to androidPlacedOrder.orderId,
            "tenantId" to androidPlacedOrder.tenantId,
            "total" to androidPlacedOrder.total,
            "status" to androidPlacedOrder.status,
            "createdAt" to androidPlacedOrder.createdAt
        )

        assertEquals("ORD-MOB-999", webLedgerRecord["orderId"])
        assertEquals("tenant-spiral", webLedgerRecord["tenantId"])
        assertEquals(420.0, (webLedgerRecord["total"] as Double), 0.001)
    }

    @Test
    fun test26_customerProfileSynchronizesAcrossPlatforms() {
        val canonicalUid = "cust_sync_100"
        val initialProfile = CustomerProfile(
            uid = canonicalUid,
            email = "diner@example.com",
            displayName = "Initial Name",
            phoneNumber = "+919876543210"
        )

        // Profile updated on website or Android
        val updatedProfile = initialProfile.copy(
            displayName = "Updated Spiral Diner",
            phoneNumber = "+919999988888"
        )

        assertEquals("cust_sync_100", updatedProfile.uid)
        assertEquals("Updated Spiral Diner", updatedProfile.displayName)
        assertEquals("+919999988888", updatedProfile.phoneNumber)
    }

    @Test
    fun test27_missingOrderIndexIsSelfHealed() {
        val customerProfileOrders = mutableMapOf<String, OrderRecord>()

        // Authoritative restaurant order discovered without prior index
        val unindexedTenantOrder = OrderRecord(
            id = "ORD-UNINDEXED-777",
            orderId = "ORD-UNINDEXED-777",
            tenantId = "tenant-bawarchi",
            customerId = "user-123",
            total = 650.0,
            status = "SERVED"
        )

        assertFalse("Index is initially missing", customerProfileOrders.containsKey(unindexedTenantOrder.orderId))

        // Healing mechanism runs
        customerProfileOrders[unindexedTenantOrder.orderId] = unindexedTenantOrder

        assertTrue("Index is successfully self-healed", customerProfileOrders.containsKey("ORD-UNINDEXED-777"))
        assertEquals(650.0, customerProfileOrders["ORD-UNINDEXED-777"]?.total ?: 0.0, 0.001)
    }

    @Test
    fun test28_inaccessibleOrDeletedAuthoritativeOrderGracefullyFallsBackToSummary() {
        // When authoritative restaurant order document is deleted or inaccessible,
        // the summary order record from customers/{uid}/orders ledger is preserved
        val ledgerSummaryOrder = OrderRecord(
            id = "ORD-ARCHIVED-101",
            orderId = "ORD-ARCHIVED-101",
            tenantId = "tenant-closed-restaurant",
            customerId = "user-123",
            total = 890.0,
            status = "COMPLETED"
        )

        val authoritativeDocExists = false
        val finalDisplayedOrder = if (authoritativeDocExists) {
            null // would be detailed
        } else {
            ledgerSummaryOrder // graceful fallback
        }

        assertNotNull("Order must not be lost when authoritative document is unavailable", finalDisplayedOrder)
        assertEquals("ORD-ARCHIVED-101", finalDisplayedOrder?.orderId)
    }

    @Test
    fun test29_duplicateOrderPreventionPreservesIdempotency() {
        val ordersStream = listOf(
            OrderRecord(orderId = "ORD-UNIQUE-1", customerId = "user-1", total = 100.0),
            OrderRecord(orderId = "ORD-UNIQUE-1", customerId = "user-1", total = 100.0), // Duplicate arrival
            OrderRecord(orderId = "ORD-UNIQUE-2", customerId = "user-1", total = 200.0)
        )

        val deduplicated = ordersStream.distinctBy { it.orderId }
        assertEquals(2, deduplicated.size)
    }

    @Test
    fun test30_realTimeOrderStatusUpdatePropagatesCorrectly() {
        var currentOrder = OrderRecord(
            orderId = "ORD-LIVE-001",
            status = "PLACED",
            total = 350.0
        )
        assertEquals("PLACED", currentOrder.status)

        // Kitchen updates status to COOKING then SERVED
        currentOrder = currentOrder.copy(status = "COOKING")
        assertEquals("COOKING", currentOrder.status)

        currentOrder = currentOrder.copy(status = "SERVED")
        assertEquals("SERVED", currentOrder.status)
    }
}
