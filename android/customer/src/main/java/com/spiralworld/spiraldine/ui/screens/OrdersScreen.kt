package com.spiralworld.spiraldine.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Cancel
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.OutdoorGrill
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Star
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.produceState
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import com.spiralworld.spiraldine.data.model.CustomerUser
import com.spiralworld.spiraldine.data.model.BillRecord
import com.spiralworld.spiraldine.data.model.DiningSession
import com.spiralworld.spiraldine.data.model.OrderHistoryState
import com.spiralworld.spiraldine.data.model.OrderRecord
import com.spiralworld.spiraldine.data.model.ServiceRequestRecord
import com.spiralworld.spiraldine.data.repository.CurrencyFormatter
import com.spiralworld.spiraldine.data.repository.OrderRepository
import com.spiralworld.spiraldine.ui.components.CanonicalBillModal
import com.spiralworld.spiraldine.ui.components.OrderCardSkeleton
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.NonVegRed
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.SpiralDineOrangeLight
import com.spiralworld.spiraldine.theme.StarGold
import com.spiralworld.spiraldine.theme.SuccessGreen
import com.spiralworld.spiraldine.theme.SuccessGreenBg
import com.spiralworld.spiraldine.theme.SurfaceMuted
import com.spiralworld.spiraldine.theme.SurfaceWhite
import com.spiralworld.spiraldine.theme.TextPrimary
import com.spiralworld.spiraldine.theme.TextSecondary
import com.spiralworld.spiraldine.theme.VegGreen
import com.spiralworld.spiraldine.theme.WarmBackground

@Composable
fun OrdersScreen(
    orders: List<OrderRecord> = emptyList(),
    orderHistoryState: OrderHistoryState? = null,
    selectedOrder: OrderRecord?,
    onSelectOrder: (OrderRecord?) -> Unit,
    onOpenServiceAssistance: () -> Unit = {},
    onPayOnline: (OrderRecord) -> Unit = {},
    isGuest: Boolean = false,
    onLinkAccountClick: () -> Unit = {},
    onRetry: () -> Unit = {},
    orderRepository: OrderRepository? = null,
    reviewRepository: com.spiralworld.spiraldine.data.repository.ReviewRepository? = null,
    user: CustomerUser? = null,
    diningSession: DiningSession? = null,
    onViewReceipt: ((OrderRecord) -> Unit)? = null
) {
    if (selectedOrder != null) {
        OrderDetailsView(
            order = selectedOrder,
            onBack = { onSelectOrder(null) },
            onOpenServiceAssistance = onOpenServiceAssistance,
            onPayOnline = { onPayOnline(it) },
            orderRepository = orderRepository,
            reviewRepository = reviewRepository,
            user = user,
            diningSession = diningSession,
            onViewReceipt = onViewReceipt
        )
        return
    }

    val effectiveState = orderHistoryState ?: if (orders.isEmpty()) OrderHistoryState.Empty else OrderHistoryState.Success(orders)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(WarmBackground),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text(
                text = "Order History & Live Tracking",
                fontSize = 18.sp,
                fontWeight = FontWeight.ExtraBold,
                color = TextPrimary
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Track current table preparation and review past visits",
                fontSize = 12.sp,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(10.dp))

            if (isGuest) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, SpiralDineOrangeLight, RoundedCornerShape(12.dp)),
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = SpiralDineOrangeLight.copy(alpha = 0.35f))
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Guest Diner Session",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Orders are saved to this device. Link email in Profile to keep your dining history permanently.",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(10.dp))
            }

            // Service Assistance Quick Launcher
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenServiceAssistance() }
                    .border(1.dp, CardBorder, RoundedCornerShape(12.dp)),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(SpiralDineOrange.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Restaurant,
                                contentDescription = null,
                                tint = SpiralDineOrange,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Column {
                            Text(
                                text = "Table Service Assistance",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = "Call Waiter • Request Water • Request Bill",
                                fontSize = 10.sp,
                                color = TextSecondary
                            )
                        }
                    }

                    Text(
                        text = "Request",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = SpiralDineOrange
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        when (effectiveState) {
            is OrderHistoryState.Loading -> {
                items(3) {
                    OrderCardSkeleton(
                        modifier = Modifier.padding(bottom = 12.dp)
                    )
                }
            }
            is OrderHistoryState.AuthorizationError -> {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, CardBorder, RoundedCornerShape(12.dp)),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.Cancel,
                                contentDescription = null,
                                tint = NonVegRed,
                                modifier = Modifier.size(44.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "Authorization Required",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = effectiveState.message,
                                fontSize = 12.sp,
                                color = TextSecondary,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            Card(
                                modifier = Modifier.clickable { onLinkAccountClick() },
                                shape = RoundedCornerShape(8.dp),
                                colors = CardDefaults.cardColors(containerColor = SpiralDineOrange)
                            ) {
                                Text(
                                    text = "Sign In / Link Account",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SurfaceWhite,
                                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                                )
                            }
                        }
                    }
                }
            }
            is OrderHistoryState.NetworkError -> {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, CardBorder, RoundedCornerShape(12.dp)),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Default.Schedule,
                                contentDescription = null,
                                tint = SpiralDineOrange,
                                modifier = Modifier.size(44.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "Connection Issue",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = effectiveState.message,
                                fontSize = 12.sp,
                                color = TextSecondary,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                            if (effectiveState.isRetryable) {
                                Spacer(modifier = Modifier.height(14.dp))
                                Card(
                                    modifier = Modifier.clickable { onRetry() },
                                    shape = RoundedCornerShape(8.dp),
                                    colors = CardDefaults.cardColors(containerColor = SpiralDineOrange)
                                ) {
                                    Text(
                                        text = "Retry",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SurfaceWhite,
                                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
            is OrderHistoryState.Error -> {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, CardBorder, RoundedCornerShape(12.dp)),
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = "Unable to load orders",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = effectiveState.message,
                                fontSize = 12.sp,
                                color = TextSecondary
                            )
                        }
                    }
                }
            }
            is OrderHistoryState.Empty -> {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 60.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.ReceiptLong,
                                contentDescription = null,
                                tint = SpiralDineOrange,
                                modifier = Modifier.size(54.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "No orders yet",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Scan a restaurant table QR to place your first order",
                                fontSize = 12.sp,
                                color = TextSecondary
                            )
                        }
                    }
                }
            }
            is OrderHistoryState.Success -> {
                items(effectiveState.orders) { order ->
                    OrderCard(
                        order = order,
                        onClick = { onSelectOrder(order) },
                        onViewReceipt = onViewReceipt
                    )
                }
            }
        }
    }
}

@Composable
fun OrderCard(
    order: OrderRecord,
    onClick: () -> Unit,
    onViewReceipt: ((OrderRecord) -> Unit)? = null
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            val statusText = order.status.uppercase()
            val isDone = statusText == "COMPLETED" || statusText == "SERVED" || order.paymentStatus.equals("paid", ignoreCase = true)
            val isPrep = statusText == "PREPARING" || statusText == "ACCEPTED" || statusText == "COOKING"
            val badgeBg = if (isDone) SuccessGreenBg else if (isPrep) SpiralDineOrangeLight else SurfaceMuted
            val badgeTextCol = if (isDone) SuccessGreen else if (isPrep) SpiralDineOrange else TextPrimary

            // Status & Order ID Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "Order #${order.orderId}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimary
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Table #${order.tableNumber}",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                        if (order.createdAt.isNotBlank()) {
                            Text(
                                text = "• ${order.createdAt}",
                                fontSize = 10.sp,
                                color = TextSecondary
                            )
                        }
                    }
                }

                Box(
                    modifier = Modifier
                        .background(badgeBg, RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = statusText,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = badgeTextCol
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Items Summary
            val summary = order.items.joinToString(", ") { "${it.count}x ${it.name}" }
            Text(
                text = summary.ifBlank { "Dine-in items" },
                fontSize = 11.sp,
                color = TextSecondary,
                maxLines = 2
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Total & View Details Action
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = CurrencyFormatter.formatPrice(order.total),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimary
                    )
                    if (order.discount > 0 && !order.couponCode.isNullOrBlank()) {
                        Box(
                            modifier = Modifier
                                .background(SuccessGreenBg, RoundedCornerShape(4.dp))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = "${order.couponCode} (-${CurrencyFormatter.formatPrice(order.discount)})",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                color = SuccessGreen
                            )
                        }
                    }
                }

                if (isDone) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (onViewReceipt != null) {
                            androidx.compose.material3.OutlinedButton(
                                onClick = { onViewReceipt(order) },
                                shape = RoundedCornerShape(8.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                modifier = Modifier.height(30.dp),
                                colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
                                    contentColor = SpiralDineOrange
                                ),
                                border = androidx.compose.foundation.BorderStroke(1.dp, SpiralDineOrange)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.ReceiptLong,
                                    contentDescription = "View Receipt",
                                    tint = SpiralDineOrange,
                                    modifier = Modifier.size(13.dp)
                                )
                                Spacer(modifier = Modifier.size(4.dp))
                                Text(
                                    text = "Receipt",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SpiralDineOrange
                                )
                            }
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                            modifier = Modifier.clickable { onClick() }
                        ) {
                            Text(
                                text = "Details",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextSecondary
                            )
                            Icon(
                                imageVector = Icons.Default.ArrowForward,
                                contentDescription = null,
                                tint = TextSecondary,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }
                } else {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text(
                            text = "Track Order",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = SpiralDineOrange
                        )
                        Icon(
                            imageVector = Icons.Default.ArrowForward,
                            contentDescription = null,
                            tint = SpiralDineOrange,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun OrderDetailsView(
    order: OrderRecord,
    onBack: () -> Unit,
    onOpenServiceAssistance: () -> Unit = {},
    onPayOnline: (OrderRecord) -> Unit = {},
    orderRepository: OrderRepository? = null,
    reviewRepository: com.spiralworld.spiraldine.data.repository.ReviewRepository? = null,
    user: CustomerUser? = null,
    diningSession: DiningSession? = null,
    onViewReceipt: ((OrderRecord) -> Unit)? = null
) {
    val coroutineScope = rememberCoroutineScope()

    // 1. Live authoritative order subscription directly from restaurants/{tenantId}/orders/{orderId}
    val liveOrder by produceState(initialValue = order, key1 = order.orderId, key2 = order.tenantId) {
        if (orderRepository != null && order.tenantId.isNotBlank() && order.orderId.isNotBlank()) {
            orderRepository.getOrder(order.tenantId, order.orderId).collect { updated ->
                if (updated != null) {
                    value = updated
                }
            }
        }
    }

    // 2. Real-time canonical bill subscription
    val liveBill by produceState<BillRecord?>(
        initialValue = null,
        key1 = liveOrder.orderId,
        key2 = liveOrder.tenantId
    ) {
        if (orderRepository != null && liveOrder.tenantId.isNotBlank() && liveOrder.orderId.isNotBlank()) {
            orderRepository.streamCanonicalBill(liveOrder.tenantId, liveOrder.orderId).collect { b ->
                value = b
            }
        }
    }

    // 3. Real-time bill request subscription from restaurants/{tenantId}/waiterRequests/BILL-{orderId}
    val liveBillRequest by produceState<ServiceRequestRecord?>(
        initialValue = null,
        key1 = liveOrder.orderId,
        key2 = liveOrder.tenantId
    ) {
        if (orderRepository != null && liveOrder.tenantId.isNotBlank() && liveOrder.orderId.isNotBlank()) {
            orderRepository.streamBillRequest(liveOrder.tenantId, liveOrder.orderId).collect { req ->
                value = req
            }
        }
    }

    // 4. Check for existing customer review
    val existingReviewState by produceState<com.spiralworld.spiraldine.data.model.ReviewRecord?>(
        initialValue = null,
        key1 = liveOrder.orderId,
        key2 = liveOrder.tenantId
    ) {
        if (reviewRepository != null && liveOrder.tenantId.isNotBlank() && liveOrder.orderId.isNotBlank()) {
            value = reviewRepository.getExistingReviewForOrder(liveOrder.tenantId, liveOrder.orderId)
        }
    }

    var localSubmittedReview by remember { mutableStateOf<com.spiralworld.spiraldine.data.model.ReviewRecord?>(null) }
    var isReviewModalOpen by remember { mutableStateOf(false) }
    val activeReview = localSubmittedReview ?: existingReviewState

    var isBillModalOpen by remember { mutableStateOf(false) }
    var isSubmittingBillRequest by remember { mutableStateOf(false) }
    var isCancellingBillRequest by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(WarmBackground),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(SurfaceWhite)
                        .border(1.dp, CardBorder, CircleShape)
                        .clickable { onBack() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = TextPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }

                Column {
                    Text(
                        text = "Order #${liveOrder.orderId}",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimary
                    )
                    Text(
                        text = "Table #${liveOrder.tableNumber}",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }
            }
        }

        // Live Status Progress Card or Cancellation Banner
        item {
            val statusUpper = liveOrder.status.uppercase()
            val isCancelled = statusUpper in listOf("CANCELLED", "CANCELED", "REJECTED", "VOID")

            if (isCancelled) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, NonVegRed, RoundedCornerShape(16.dp)),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(32.dp)
                                    .background(NonVegRed.copy(alpha = 0.12f), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Cancel,
                                    contentDescription = null,
                                    tint = NonVegRed,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                            Column {
                                Text(
                                    text = "Order Cancelled",
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = NonVegRed
                                )
                                Text(
                                    text = "This dining order was cancelled by the restaurant or diner.",
                                    fontSize = 12.sp,
                                    color = TextSecondary
                                )
                            }
                        }
                    }
                }
            } else {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "KITCHEN PROGRESS",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextSecondary,
                                letterSpacing = 1.sp
                            )
                            Box(
                                modifier = Modifier
                                    .background(
                                        when {
                                            statusUpper in listOf("READY", "PICKED_UP") -> SpiralDineOrangeLight
                                            statusUpper in listOf("SERVED", "DELIVERED", "COMPLETED", "DINING_COMPLETED") -> SuccessGreenBg
                                            else -> SurfaceMuted
                                        },
                                        RoundedCornerShape(8.dp)
                                    )
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = statusUpper,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = when {
                                        statusUpper in listOf("READY", "PICKED_UP") -> SpiralDineOrange
                                        statusUpper in listOf("SERVED", "DELIVERED", "COMPLETED", "DINING_COMPLETED") -> SuccessGreen
                                        else -> TextPrimary
                                    }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        val stages = listOf(
                            "Order Placed" to (liveOrder.status.isNotBlank()),
                            "Kitchen Confirmed" to (statusUpper in listOf("ACCEPTED", "CHEF_ASSIGNED", "PREPARING", "COOKING", "READY", "PICKED_UP", "SERVED", "DELIVERED", "COMPLETED", "DINING_COMPLETED")),
                            "Cooking & Preparing" to (statusUpper in listOf("PREPARING", "COOKING", "READY", "PICKED_UP", "SERVED", "DELIVERED", "COMPLETED", "DINING_COMPLETED")),
                            "Ready to Serve" to (statusUpper in listOf("READY", "PICKED_UP", "SERVED", "DELIVERED", "COMPLETED", "DINING_COMPLETED")),
                            "Served at Table" to (statusUpper in listOf("SERVED", "DELIVERED", "COMPLETED", "DINING_COMPLETED"))
                        )

                        stages.forEach { (stageName, isDone) ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                modifier = Modifier.padding(vertical = 4.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(24.dp)
                                        .background(if (isDone) SuccessGreen else SurfaceMuted, CircleShape)
                                        .border(1.dp, if (isDone) SuccessGreen else CardBorder, CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isDone) {
                                        Icon(
                                            imageVector = Icons.Default.CheckCircle,
                                            contentDescription = null,
                                            tint = SurfaceWhite,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }
                                Text(
                                    text = stageName,
                                    fontSize = 13.sp,
                                    fontWeight = if (isDone) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isDone) TextPrimary else TextSecondary
                                )
                            }
                        }
                    }
                }
            }
        }

        // Bill Request & Settlement Workflow Card (Phase 3 & Phase 4)
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "TABLE BILL & SETTLEMENT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextSecondary,
                        letterSpacing = 1.sp
                    )

                    val isPaid = liveBill?.paymentStatus.equals("paid", ignoreCase = true) ||
                            liveOrder.paymentStatus.equals("paid", ignoreCase = true)
                    val isPendingBill = liveBillRequest != null &&
                            liveBillRequest?.status.equals("pending", ignoreCase = true)
                    val isBillReady = liveBill != null ||
                            liveBillRequest?.status.equals("completed", ignoreCase = true)

                    if (isPaid) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = SuccessGreenBg),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = SuccessGreen)
                                Spacer(modifier = Modifier.size(8.dp))
                                Column {
                                    Text(
                                        text = "Bill Paid & Settled",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SuccessGreen
                                    )
                                    Text(
                                        text = "Payment verified. Thank you for dining with us!",
                                        fontSize = 11.sp,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }
                        if (onViewReceipt != null) {
                            androidx.compose.material3.Button(
                                onClick = { onViewReceipt(liveOrder) },
                                colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth().height(44.dp)
                            ) {
                                Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.size(8.dp))
                                Text("View Official Receipt", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        androidx.compose.material3.OutlinedButton(
                            onClick = { isBillModalOpen = true },
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(44.dp)
                        ) {
                            Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.size(8.dp))
                            Text("View Final Bill & Breakdown", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    } else if (isPendingBill) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = SpiralDineOrangeLight.copy(alpha = 0.5f)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(14.dp),
                                        color = SpiralDineOrange,
                                        strokeWidth = 2.dp
                                    )
                                    Spacer(modifier = Modifier.size(8.dp))
                                    Text(
                                        text = "Bill Requested • Waiter Notified",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = SpiralDineOrange
                                    )
                                }
                                Text(
                                    text = "Your waiter is reviewing your dine-in table ticket and preparing the final bill breakdown.",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            androidx.compose.material3.OutlinedButton(
                                onClick = {
                                    if (!isCancellingBillRequest && orderRepository != null) {
                                        isCancellingBillRequest = true
                                        coroutineScope.launch {
                                            try {
                                                orderRepository.cancelBillRequest(
                                                    tenantId = liveOrder.tenantId,
                                                    orderId = liveOrder.orderId
                                                )
                                            } finally {
                                                isCancellingBillRequest = false
                                            }
                                        }
                                    }
                                },
                                enabled = !isCancellingBillRequest,
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.weight(1f).height(44.dp)
                            ) {
                                if (isCancellingBillRequest) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                } else {
                                    Text("Cancel Request", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = NonVegRed)
                                }
                            }

                            androidx.compose.material3.Button(
                                onClick = { isBillModalOpen = true },
                                colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.weight(1.3f).height(44.dp)
                            ) {
                                Text("Open Bill & Settle", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    } else if (isBillReady) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = SuccessGreenBg.copy(alpha = 0.5f)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.size(8.dp))
                                Column {
                                    Text("Bill is Ready for Settlement", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                                    Text("Authoritative itemized bill is available for Table #${liveOrder.tableNumber}.", fontSize = 11.sp, color = TextSecondary)
                                }
                            }
                        }

                        androidx.compose.material3.Button(
                            onClick = { isBillModalOpen = true },
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(48.dp)
                        ) {
                            Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.size(8.dp))
                            Text("Open Bill & Settle • ${CurrencyFormatter.formatPrice(liveBill?.total ?: liveOrder.total)}", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        Text(
                            text = "Finished eating? Tap below to notify your waiter and receive your finalized itemized bill.",
                            fontSize = 12.sp,
                            color = TextSecondary
                        )

                        androidx.compose.material3.Button(
                            onClick = {
                                if (!isSubmittingBillRequest && orderRepository != null) {
                                    isSubmittingBillRequest = true
                                    coroutineScope.launch {
                                        try {
                                            orderRepository.requestBill(
                                                tenantId = liveOrder.tenantId,
                                                orderId = liveOrder.orderId,
                                                tableNumber = liveOrder.tableNumber,
                                                tableId = liveOrder.tableId,
                                                customerId = user?.uid ?: "",
                                                sessionId = diningSession?.sessionId ?: ""
                                            )
                                        } finally {
                                            isSubmittingBillRequest = false
                                        }
                                    }
                                }
                            },
                            enabled = !isSubmittingBillRequest,
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(46.dp)
                        ) {
                            if (isSubmittingBillRequest) {
                                CircularProgressIndicator(modifier = Modifier.size(16.dp), color = SurfaceWhite, strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.size(8.dp))
                                Text("Request Bill & View Breakdown", fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }

        // Itemized Receipt
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "ITEMIZED RECEIPT",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextSecondary,
                        letterSpacing = 1.sp
                    )

                    liveOrder.items.forEach { item ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "${item.count}x ${item.name}",
                                fontSize = 12.sp,
                                color = TextPrimary,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                text = CurrencyFormatter.formatPrice(item.pricePerUnit * item.count),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(CardBorder)
                    )

                    // Financials
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Subtotal", fontSize = 12.sp, color = TextSecondary)
                        Text(CurrencyFormatter.formatPrice(liveOrder.subtotal), fontSize = 12.sp, color = TextPrimary)
                    }

                    if (liveOrder.discount > 0) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Discount (${liveOrder.couponCode ?: "Offer"})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                            Text("-${CurrencyFormatter.formatPrice(liveOrder.discount)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                        }
                    }

                    if (liveOrder.tax > 0.0) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Taxes & GST", fontSize = 12.sp, color = TextSecondary)
                            Text(CurrencyFormatter.formatPrice(liveOrder.tax), fontSize = 12.sp, color = TextPrimary)
                        }
                    }

                    if (liveOrder.serviceCharge > 0.0) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("Restaurant Service Fee", fontSize = 12.sp, color = TextSecondary)
                            Text(CurrencyFormatter.formatPrice(liveOrder.serviceCharge), fontSize = 12.sp, color = TextPrimary)
                        }
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(CardBorder)
                    )

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Grand Total", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                        Text(CurrencyFormatter.formatPrice(liveOrder.total), fontSize = 17.sp, fontWeight = FontWeight.Black, color = SpiralDineOrange)
                    }
                }
            }
        }

        // Customer Experience Review Section (Eligible when dining is completed/served or paid)
        val isEligibleForReview = liveOrder.status.equals("completed", ignoreCase = true) ||
                liveOrder.status.equals("served", ignoreCase = true) ||
                liveOrder.status.equals("delivered", ignoreCase = true) ||
                liveOrder.status.equals("dining_completed", ignoreCase = true) ||
                liveBill?.paymentStatus.equals("paid", ignoreCase = true) ||
                liveOrder.paymentStatus.equals("paid", ignoreCase = true)

        if (isEligibleForReview) {
            item {
                if (activeReview != null) {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, CardBorder, RoundedCornerShape(12.dp)),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = SuccessGreen,
                                        modifier = Modifier.size(16.dp)
                                    )
                                    Text(
                                        text = "Your Dining Review",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                }
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(2.dp)
                                ) {
                                    repeat(activeReview.starRating) {
                                        Icon(
                                            imageVector = Icons.Default.Star,
                                            contentDescription = null,
                                            tint = StarGold,
                                            modifier = Modifier.size(14.dp)
                                        )
                                    }
                                    Text(
                                        text = "${activeReview.starRating}/5",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = TextPrimary,
                                        modifier = Modifier.padding(start = 4.dp)
                                    )
                                }
                            }
                            Text(
                                text = "Experience: ${activeReview.rating}",
                                fontSize = 11.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TextPrimary
                            )
                            if (activeReview.notes.isNotBlank()) {
                                Text(
                                    text = "\"${activeReview.notes}\"",
                                    fontSize = 11.5.sp,
                                    color = TextSecondary,
                                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                                )
                            }
                            Text(
                                text = "✓ Review published to restaurant",
                                fontSize = 10.5.sp,
                                color = SuccessGreen
                            )
                        }
                    }
                } else {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, Color(0xFFFFD8A8), RoundedCornerShape(12.dp)),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFFF9DB)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Star,
                                    contentDescription = null,
                                    tint = Color(0xFFE67700),
                                    modifier = Modifier.size(20.dp)
                                )
                                Column {
                                    Text(
                                        text = "Rate Your Experience",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF495057)
                                    )
                                    Text(
                                        text = "Help the restaurant improve and let others know about your meal.",
                                        fontSize = 11.sp,
                                        color = Color(0xFF868E96)
                                    )
                                }
                            }
                            androidx.compose.material3.Button(
                                onClick = { isReviewModalOpen = true },
                                colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Color(0xFFE67700)),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(42.dp)
                            ) {
                                Text(
                                    text = "Rate Your Experience ⭐",
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                        }
                    }
                }
            }
        }

        // Action Buttons: Online Payment, Bill Breakdown & Service Assistance
        item {
            Spacer(modifier = Modifier.height(6.dp))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                val isPaid = liveBill?.paymentStatus.equals("paid", ignoreCase = true) ||
                        liveOrder.paymentStatus.equals("paid", ignoreCase = true)

                if (!isPaid) {
                    androidx.compose.material3.Button(
                        onClick = { onPayOnline(liveOrder) },
                        colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth().height(50.dp)
                    ) {
                        Icon(Icons.Default.ReceiptLong, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.size(8.dp))
                        Text(
                            text = "Pay Online via Gateway • ${CurrencyFormatter.formatPrice(liveOrder.total)}",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                } else {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SuccessGreenBg),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = SuccessGreen)
                            Spacer(modifier = Modifier.size(10.dp))
                            Text(
                                text = "Paid & Settled Online via Razorpay",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = SuccessGreen
                            )
                        }
                    }
                }

                androidx.compose.material3.OutlinedButton(
                    onClick = { onOpenServiceAssistance() },
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Icon(Icons.Default.Restaurant, contentDescription = null, modifier = Modifier.size(16.dp), tint = TextPrimary)
                    Spacer(modifier = Modifier.size(8.dp))
                    Text(
                        text = "Call Waiter / Table Assistance",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                }
            }
        }
    }

    if (isReviewModalOpen) {
        com.spiralworld.spiraldine.ui.components.CustomerReviewModal(
            isOpen = true,
            onClose = { isReviewModalOpen = false },
            order = liveOrder,
            existingReview = activeReview,
            reviewRepository = reviewRepository,
            customerName = user?.displayName ?: "Table Guest",
            onReviewSubmitted = { submitted ->
                localSubmittedReview = submitted
                isReviewModalOpen = false
            }
        )
    }

    if (isBillModalOpen) {
        com.spiralworld.spiraldine.ui.components.CanonicalBillModal(
            isOpen = true,
            onClose = { isBillModalOpen = false },
            order = liveOrder,
            orderRepository = orderRepository,
            onPayOnline = {
                isBillModalOpen = false
                onPayOnline(liveOrder)
            }
        )
    }
}
