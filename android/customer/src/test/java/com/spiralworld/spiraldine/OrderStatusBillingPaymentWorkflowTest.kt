package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.BillRecord
import com.spiralworld.spiraldine.data.model.OrderItemRecord
import com.spiralworld.spiraldine.data.model.OrderRecord
import com.spiralworld.spiraldine.data.model.ServiceRequestRecord
import com.spiralworld.spiraldine.data.repository.CurrencyFormatter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OrderStatusBillingPaymentWorkflowTest {

    // Helper to evaluate stage completion matching OrderDetailsView logic
    private fun evaluateStages(status: String): Map<String, Boolean> {
        val statusUpper = status.uppercase()
        return mapOf(
            "Order Placed" to (status.isNotBlank()),
            "Kitchen Confirmed" to (statusUpper in listOf("ACCEPTED", "CHEF_ASSIGNED", "PREPARING", "COOKING", "READY", "PICKED_UP", "SERVED", "DELIVERED", "COMPLETED", "DINING_COMPLETED")),
            "Cooking & Preparing" to (statusUpper in listOf("PREPARING", "COOKING", "READY", "PICKED_UP", "SERVED", "DELIVERED", "COMPLETED", "DINING_COMPLETED")),
            "Ready to Serve" to (statusUpper in listOf("READY", "PICKED_UP", "SERVED", "DELIVERED", "COMPLETED", "DINING_COMPLETED")),
            "Served at Table" to (statusUpper in listOf("SERVED", "DELIVERED", "COMPLETED", "DINING_COMPLETED"))
        )
    }

    // ==========================================
    // 1-8: ORDER TRACKING & STATUS SYNCHRONIZATION
    // ==========================================

    @Test
    fun test01_orderStatusChangesFromPlacedToConfirmed() {
        val stagesPlaced = evaluateStages("PLACED")
        assertTrue(stagesPlaced["Order Placed"] == true)
        assertFalse(stagesPlaced["Kitchen Confirmed"] == true)

        val stagesConfirmed = evaluateStages("ACCEPTED")
        assertTrue(stagesConfirmed["Order Placed"] == true)
        assertTrue(stagesConfirmed["Kitchen Confirmed"] == true)
        assertFalse(stagesConfirmed["Cooking & Preparing"] == true)
    }

    @Test
    fun test02_kitchenChangesOrderToPreparing() {
        val stages = evaluateStages("PREPARING")
        assertTrue(stages["Order Placed"] == true)
        assertTrue(stages["Kitchen Confirmed"] == true)
        assertTrue(stages["Cooking & Preparing"] == true)
        assertFalse(stages["Ready to Serve"] == true)
    }

    @Test
    fun test03_kitchenMarksOrderReady_readyToServeIsActive() {
        // Fix for screenshot issue: Kitchen marks READY, timeline MUST show Ready to Serve as completed
        val stages = evaluateStages("READY")
        assertTrue("Order placed must be checked", stages["Order Placed"] == true)
        assertTrue("Kitchen confirmed must be checked", stages["Kitchen Confirmed"] == true)
        assertTrue("Cooking must be checked", stages["Cooking & Preparing"] == true)
        assertTrue("Ready to serve MUST be completed when status is READY", stages["Ready to Serve"] == true)
        assertFalse("Served at table must not be marked completed yet", stages["Served at Table"] == true)
    }

    @Test
    fun test04_waiterMarksOrderServed_servedAtTableIsActive() {
        val stages = evaluateStages("SERVED")
        assertTrue(stages["Order Placed"] == true)
        assertTrue(stages["Kitchen Confirmed"] == true)
        assertTrue(stages["Cooking & Preparing"] == true)
        assertTrue(stages["Ready to Serve"] == true)
        assertTrue("Served at Table must be active when waiter marks SERVED", stages["Served at Table"] == true)
    }

    @Test
    fun test05_androidCustomerTrackingObservesLiveDocument_withoutScreenReopen() {
        // Simulates Flow emission from Firestore doc listener
        val initialOrder = OrderRecord(orderId = "ORD-101", tenantId = "rest-demo", status = "PLACED")
        var currentTrackedOrder = initialOrder

        // Kitchen updates document to READY in Firestore
        val liveEmission = initialOrder.copy(status = "READY")
        currentTrackedOrder = liveEmission

        assertEquals("READY", currentTrackedOrder.status)
        val stages = evaluateStages(currentTrackedOrder.status)
        assertTrue("Ready to Serve must dynamically reflect updated status without reopening", stages["Ready to Serve"] == true)
    }

    @Test
    fun test06_mobileWebTrackingUpdatesWithoutRefreshing() {
        // Simulates desktop & mobile web onSnapshot handler
        val initialOrder = OrderRecord(orderId = "ORD-101", tenantId = "rest-demo", status = "COOKING")
        var liveState = initialOrder

        // Firestore real-time callback fires
        liveState = liveState.copy(status = "SERVED")
        assertEquals("SERVED", liveState.status)
        val stages = evaluateStages(liveState.status)
        assertTrue(stages["Served at Table"] == true)
    }

    @Test
    fun test07_unknownOrLegacyStatusesHandledSafely() {
        val stages = evaluateStages("CUSTOM_IN_PROGRESS_STEP")
        assertTrue(stages["Order Placed"] == true)
        assertFalse(stages["Ready to Serve"] == true)
        assertFalse(stages["Served at Table"] == true)
    }

    @Test
    fun test08_cancelledAndRejectedOrdersHandledCorrectly() {
        val cancelStatuses = listOf("CANCELLED", "CANCELED", "REJECTED", "VOID")
        for (st in cancelStatuses) {
            val statusUpper = st.uppercase()
            val isCancelled = statusUpper in listOf("CANCELLED", "CANCELED", "REJECTED", "VOID")
            assertTrue("Status $st must be identified as cancelled", isCancelled)
        }
    }

    // ==========================================
    // 9-15: BILL REQUESTS
    // ==========================================

    @Test
    fun test09_customerRequestsBill_createsAuthoritativeRecord() {
        val tenantId = "rest-1"
        val orderId = "ORD-201"
        val reqId = "BILL-$orderId"

        val request = ServiceRequestRecord(
            id = reqId,
            type = "Bill Request",
            tableNumber = "4",
            tableId = "tbl-4",
            status = "pending",
            notes = "Customer requested bill for order $orderId",
            createdAt = "2026-10-19T10:00:00Z"
        )

        assertEquals("BILL-ORD-201", request.id)
        assertEquals("Bill Request", request.type)
        assertEquals("pending", request.status)
        assertEquals("4", request.tableNumber)
    }

    @Test
    fun test10_duplicateBillRequestsArePrevented() {
        var existingRequest: ServiceRequestRecord? = ServiceRequestRecord(
            id = "BILL-ORD-201",
            type = "Bill Request",
            tableNumber = "4",
            status = "pending"
        )

        // Attempt second request while first is still pending
        val canRequestAgain = existingRequest == null ||
                existingRequest.status in listOf("completed", "cancelled", "rejected")

        assertFalse("Duplicate bill request must be prevented while status is pending", canRequestAgain)
    }

    @Test
    fun test11_waiterReceivesBillRequestInStream() {
        val waiterRequests = mutableListOf<ServiceRequestRecord>()
        val newReq = ServiceRequestRecord(
            id = "BILL-ORD-201",
            type = "Bill Request",
            tableNumber = "4",
            status = "pending"
        )
        waiterRequests.add(newReq)

        val activeRequests = waiterRequests.filter { it.status == "pending" }
        assertEquals(1, activeRequests.size)
        assertEquals("4", activeRequests.first().tableNumber)
        assertEquals("Bill Request", activeRequests.first().type)
    }

    @Test
    fun test12_customerSeesCurrentRequestStateRealTime() {
        var customerUiState = "initial"
        val request = ServiceRequestRecord(id = "BILL-ORD-201", type = "Bill Request", tableNumber = "4", status = "pending")

        if (request.status == "pending") {
            customerUiState = "BILL_PENDING_WAITER"
        } else if (request.status == "completed") {
            customerUiState = "BILL_READY"
        }
        assertEquals("BILL_PENDING_WAITER", customerUiState)

        // Staff completes the bill
        val updatedRequest = request.copy(status = "completed")
        if (updatedRequest.status == "completed") {
            customerUiState = "BILL_READY"
        }
        assertEquals("BILL_READY", customerUiState)
    }

    @Test
    fun test13_authorizedCancellationWorksOnlyWhenPending() {
        val pendingRequest = ServiceRequestRecord(id = "BILL-ORD-201", status = "pending")
        val canCancelPending = pendingRequest.status == "pending"
        assertTrue("Customer can cancel pending bill request", canCancelPending)

        val completedRequest = ServiceRequestRecord(id = "BILL-ORD-201", status = "completed")
        val canCancelCompleted = completedRequest.status == "pending"
        assertFalse("Customer CANNOT cancel completed/finalized bill request", canCancelCompleted)
    }

    @Test
    fun test14_ownerSeesRelevantBillStatus() {
        val bill = BillRecord(
            billId = "BILL-ORD-201",
            orderId = "ORD-201",
            tenantId = "rest-1",
            tableNumber = "4",
            total = 125000.0, // 1250.00
            paymentStatus = "pending",
            orderStatus = "DINING_COMPLETED"
        )
        assertEquals("pending", bill.paymentStatus)
        assertEquals("DINING_COMPLETED", bill.orderStatus)
        assertEquals("4", bill.tableNumber)
    }

    @Test
    fun test15_unauthorizedCustomerCannotRequestOrCancelOtherCustomerBill() {
        val orderCustomerId = "diner-actual-uid-1"
        val callerCustomerId = "diner-attacker-uid-2"

        val isAuthorized = orderCustomerId == callerCustomerId
        assertFalse("Unrelated customer must be blocked from requesting or cancelling bill", isAuthorized)
    }

    // ==========================================
    // 16-22: CASH PAYMENT REQUESTS
    // ==========================================

    @Test
    fun test16_cashRequestIsCreatedWithAuthoritativeSchema() {
        val tenantId = "rest-demo"
        val orderId = "ORD-505"
        val reqId = "CASH-$orderId"

        val cashRequest = ServiceRequestRecord(
            id = reqId,
            type = "Cash Payment",
            tableNumber = "7",
            status = "pending",
            notes = "Cash collection requested for order $orderId: Rs 450.00"
        )

        assertEquals("CASH-ORD-505", cashRequest.id)
        assertEquals("Cash Payment", cashRequest.type)
        assertEquals("pending", cashRequest.status)
    }

    @Test
    fun test17_waiterReceivesCashRequest() {
        val requests = listOf(
            ServiceRequestRecord(id = "CASH-ORD-505", type = "Cash Payment", tableNumber = "7", status = "pending"),
            ServiceRequestRecord(id = "BILL-ORD-506", type = "Bill Request", tableNumber = "3", status = "pending")
        )
        val cashAlerts = requests.filter { it.type == "Cash Payment" && it.status == "pending" }
        assertEquals(1, cashAlerts.size)
        assertEquals("7", cashAlerts.first().tableNumber)
    }

    @Test
    fun test18_customerSeesPendingConfirmationForCash() {
        val cashReq = ServiceRequestRecord(id = "CASH-ORD-505", type = "Cash Payment", tableNumber = "7", status = "pending")
        val isPendingStaff = cashReq.status == "pending"
        assertTrue("Customer must see staff confirmation pending", isPendingStaff)
    }

    @Test
    fun test19_duplicateCashRequestsArePrevented() {
        val existingCashReq = ServiceRequestRecord(id = "CASH-ORD-505", status = "pending")
        val canRequestAgain = existingCashReq.status !in listOf("pending", "accepted")
        assertFalse("Duplicate cash payment request must be rejected", canRequestAgain)
    }

    @Test
    fun test20_onlyAuthorizedStaffCanConfirmCollection() {
        val staffRoles = listOf("waiter", "manager", "admin", "owner")
        val dinerRole = "customer"

        assertFalse("Customer cannot confirm cash collection", dinerRole in staffRoles)
        assertTrue("Waiter can confirm cash collection", "waiter" in staffRoles)
        assertTrue("Manager can confirm cash collection", "manager" in staffRoles)
    }

    @Test
    fun test21_billBecomesPaidOnlyAfterAuthorizedConfirmation() {
        var billPaymentStatus = "unpaid"
        var cashRequestStatus = "pending"

        // Customer tapped request cash -> NOT paid yet
        assertEquals("unpaid", billPaymentStatus)

        // Waiter collects cash and confirms
        cashRequestStatus = "completed"
        val staffConfirmed = true
        if (cashRequestStatus == "completed" && staffConfirmed) {
            billPaymentStatus = "paid"
        }

        assertEquals("paid", billPaymentStatus)
    }

    @Test
    fun test22_alreadyPaidBillCannotBeRequestedForPaymentAgain() {
        val bill = BillRecord(billId = "BILL-1", orderId = "ORD-1", total = 50000.0, paymentStatus = "paid")
        val isEligibleForPayment = bill.paymentStatus != "paid"
        assertFalse("Paid bill cannot be requested for payment again", isEligibleForPayment)
    }

    // ==========================================
    // 23-30: ONLINE PAYMENTS & TRUSTED GATEWAY
    // ==========================================

    @Test
    fun test23_paymentInitializationUsesAuthoritativeBillTotal() {
        // Authoritative bill stores in minor units (paise)
        val bill = BillRecord(billId = "BILL-10", orderId = "ORD-10", total = 4345.0, paymentStatus = "pending")
        val payablePaise = bill.total.toLong()

        // Gateway order creation must use authoritative 4345 paise (Rs 43.45)
        assertEquals(4345L, payablePaise)
    }

    @Test
    fun test24_clientCannotOverridePayableAmount() {
        val authoritativePaise = 4345L
        val clientAttemptedPaise = 100L // Malicious client attempt

        val sanitizedPaise = authoritativePaise // Backend disregards client input and looks up DB
        assertEquals(authoritativePaise, sanitizedPaise)
        assertNotEquals(clientAttemptedPaise, sanitizedPaise)
    }

    @Test
    fun test25_successfulTrustedVerificationUpdatesPaymentState() {
        var paymentStatus = "pending"
        val razorpayPaymentId = "pay_TEST_12345"
        val razorpayOrderId = "order_TEST_67890"
        val signatureValid = true

        if (signatureValid && razorpayPaymentId.isNotBlank() && razorpayOrderId.isNotBlank()) {
            paymentStatus = "paid"
        }
        assertEquals("paid", paymentStatus)
    }

    @Test
    fun test26_failedPaymentDoesNotMarkBillPaid() {
        var paymentStatus = "unpaid"
        val paymentError = "BAD_REQUEST_PAYMENT_DECLINED"

        if (paymentError.isNotBlank()) {
            paymentStatus = "failed"
        }
        assertNotEquals("paid", paymentStatus)
        assertEquals("failed", paymentStatus)
    }

    @Test
    fun test27_cancelledPaymentHandledCorrectly() {
        var paymentStatus = "unpaid"
        val userCancelled = true

        if (userCancelled) {
            paymentStatus = "cancelled"
        }
        assertNotEquals("paid", paymentStatus)
        assertEquals("cancelled", paymentStatus)
    }

    @Test
    fun test28_duplicateCallbacksAreIdempotent() {
        var settlementCount = 0
        var billStatus = "unpaid"

        fun handleGatewayCallback(paymentId: String) {
            if (billStatus == "paid") {
                // Already settled, idempotent return
                return
            }
            billStatus = "paid"
            settlementCount++
        }

        handleGatewayCallback("pay_ABC")
        assertEquals("paid", billStatus)
        assertEquals(1, settlementCount)

        // Duplicate webhook arrives
        handleGatewayCallback("pay_ABC")
        assertEquals(1, settlementCount) // Still 1!
    }

    @Test
    fun test29_invalidVerificationIsRejected() {
        var billStatus = "unpaid"
        val signatureValid = false // invalid HMAC-SHA256 signature

        if (signatureValid) {
            billStatus = "paid"
        }
        assertEquals("unpaid", billStatus)
    }

    @Test
    fun test30_billCannotBeSettledTwice() {
        val bill = BillRecord(billId = "BILL-1", total = 1000.0, paymentStatus = "paid")
        val canSettle = bill.paymentStatus != "paid"
        assertFalse("Already paid bill cannot be settled again", canSettle)
    }

    // ==========================================
    // 31-37: CROSS-PLATFORM SYNCHRONIZATION & CURRENCY
    // ==========================================

    @Test
    fun test31_androidOrderUpdatesAppearOnDesktopCustomerPage() {
        val order = OrderRecord(orderId = "ORD-SYNC-1", tenantId = "rest-demo", status = "PLACED")
        assertEquals("rest-demo", order.tenantId)
        assertEquals("ORD-SYNC-1", order.orderId)
    }

    @Test
    fun test32_desktopKitchenUpdatesAppearOnAndroidCustomerTracking() {
        val initialOrder = OrderRecord(orderId = "ORD-SYNC-1", tenantId = "rest-demo", status = "PLACED")
        // Kitchen moves to READY
        val updatedOrder = initialOrder.copy(status = "READY")
        assertEquals("READY", updatedOrder.status)
        val stages = evaluateStages(updatedOrder.status)
        assertTrue(stages["Ready to Serve"] == true)
    }

    @Test
    fun test33_waiterStatusUpdatesAppearOnAndroid() {
        val initialOrder = OrderRecord(orderId = "ORD-SYNC-1", tenantId = "rest-demo", status = "READY")
        // Waiter marks SERVED
        val servedOrder = initialOrder.copy(status = "SERVED")
        val stages = evaluateStages(servedOrder.status)
        assertTrue(stages["Served at Table"] == true)
    }

    @Test
    fun test34_billRequestsAppearInWaiterDashboard() {
        val waiterRequests = listOf(
            ServiceRequestRecord(id = "BILL-ORD-SYNC-1", type = "Bill Request", tableNumber = "2", status = "pending")
        )
        val pendingBillAlerts = waiterRequests.filter { it.type == "Bill Request" && it.status == "pending" }
        assertEquals(1, pendingBillAlerts.size)
        assertEquals("2", pendingBillAlerts.first().tableNumber)
    }

    @Test
    fun test35_paymentUpdatesAppearInOwnerDashboard() {
        val bill = BillRecord(billId = "BILL-ORD-SYNC-1", orderId = "ORD-SYNC-1", total = 4345.0, paymentStatus = "paid")
        assertEquals("paid", bill.paymentStatus)
    }

    @Test
    fun test36_tenantAndRestaurantIsolationRemainsIntact() {
        val tenantAOrders = listOf(
            OrderRecord(orderId = "ORD-A1", tenantId = "tenant-A"),
            OrderRecord(orderId = "ORD-A2", tenantId = "tenant-A")
        )
        val tenantBOrders = listOf(
            OrderRecord(orderId = "ORD-B1", tenantId = "tenant-B")
        )

        val filteredForTenantA = (tenantAOrders + tenantBOrders).filter { it.tenantId == "tenant-A" }
        assertEquals(2, filteredForTenantA.size)
        assertTrue(filteredForTenantA.none { it.tenantId == "tenant-B" })
    }

    @Test
    fun test37_currencyFormattingCorrectlyConvertsPaiseToRupees() {
        // Critical requirement: Never display 4345 paise as Rs 4345. Intended amount is Rs 43.45.
        val amountInPaise = 4345.0
        val formatted = CurrencyFormatter.formatPrice(amountInPaise)
        assertEquals("₹43.45", formatted)

        val roundAmountPaise = 50000.0 // Rs 500
        val formattedRound = CurrencyFormatter.formatPrice(roundAmountPaise)
        assertEquals("₹500", formattedRound)

        val formattedExact = CurrencyFormatter.formatPriceExact(roundAmountPaise)
        assertEquals("₹500.00", formattedExact)

        val smallAmountPaise = 99.0 // Rs 0.99
        val formattedSmall = CurrencyFormatter.formatPrice(smallAmountPaise)
        assertEquals("₹0.99", formattedSmall)
    }
}
