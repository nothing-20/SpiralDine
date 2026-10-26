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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.CartItem
import com.spiralworld.spiraldine.data.model.CartPricing
import com.spiralworld.spiraldine.data.model.Promotion
import com.spiralworld.spiraldine.data.repository.CurrencyFormatter
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.NonVegRed
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.SpiralDineOrangeDark
import com.spiralworld.spiraldine.theme.SpiralDineOrangeLight
import com.spiralworld.spiraldine.theme.SuccessGreen
import com.spiralworld.spiraldine.theme.SuccessGreenBg
import com.spiralworld.spiraldine.theme.SurfaceMuted
import com.spiralworld.spiraldine.theme.SurfaceWhite
import com.spiralworld.spiraldine.theme.TextPrimary
import com.spiralworld.spiraldine.theme.TextSecondary
import com.spiralworld.spiraldine.theme.VegGreen
import com.spiralworld.spiraldine.theme.WarmBackground

@Composable
fun CartScreen(
    restaurantName: String,
    tableNumber: String?,
    cartItems: List<CartItem>,
    pricing: CartPricing,
    availablePromotions: List<Promotion>,
    appliedPromotion: Promotion?,
    isPlacingOrder: Boolean,
    onBack: () -> Unit,
    onUpdateCount: (String, Int) -> Unit,
    onRemoveItem: (String) -> Unit,
    onApplyCoupon: (String) -> Unit,
    onRemoveCoupon: () -> Unit,
    onPlaceOrder: (notes: String) -> Unit,
    onClearCart: (() -> Unit)? = null
) {
    var manualCouponInput by remember { mutableStateOf("") }
    var specialNotes by remember { mutableStateOf("") }
    var couponErrorMessage by remember { mutableStateOf<String?>(null) }
    var showClearConfirmation by remember { mutableStateOf(false) }

    if (showClearConfirmation && onClearCart != null) {
        AlertDialog(
            onDismissRequest = { showClearConfirmation = false },
            title = { Text("Clear Dining Basket?", fontWeight = FontWeight.Bold, color = TextPrimary) },
            text = { Text("Are you sure you want to remove all dishes from your basket? This action cannot be undone.", color = TextSecondary) },
            confirmButton = {
                TextButton(
                    onClick = {
                        showClearConfirmation = false
                        onClearCart()
                    }
                ) {
                    Text("Clear", color = NonVegRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearConfirmation = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(WarmBackground),
        contentPadding = PaddingValues(bottom = 120.dp)
    ) {
        // 1. Top Bar
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
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

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Your Dining Cart",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimary
                    )
                    Text(
                        text = "$restaurantName • Table #${tableNumber ?: "1"}",
                        fontSize = 11.sp,
                        color = TextSecondary
                    )
                }

                if (cartItems.isNotEmpty() && onClearCart != null) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(SurfaceWhite)
                            .border(1.dp, CardBorder, CircleShape)
                            .clickable { showClearConfirmation = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Delete,
                            contentDescription = "Clear Basket",
                            tint = NonVegRed,
                            modifier = Modifier.size(19.dp)
                        )
                    }
                }
            }
        }

        if (cartItems.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 80.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.ShoppingBag,
                            contentDescription = null,
                            tint = SpiralDineOrange,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Your basket is empty",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Add delicious dishes from the menu to place an order",
                            fontSize = 12.sp,
                            color = TextSecondary
                        )
                    }
                }
            }
        } else {
            // 2. Items List
            item {
                Text(
                    text = "SELECTED DISHES (${cartItems.size})",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextSecondary,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                )
            }

            items(cartItems, key = { it.lineId }) { cartItem ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp)
                        .border(1.dp, CardBorder, RoundedCornerShape(14.dp)),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        // Dish Name, Customizations, & Veg Dot
                        Row(
                            modifier = Modifier.weight(1f),
                            verticalAlignment = Alignment.Top,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .padding(top = 2.dp)
                                    .size(14.dp)
                                    .border(1.dp, if (cartItem.item.isVeg) VegGreen else NonVegRed, RoundedCornerShape(3.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(6.dp)
                                        .background(if (cartItem.item.isVeg) VegGreen else NonVegRed, CircleShape)
                                )
                            }

                            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                                Text(
                                    text = cartItem.item.name,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )

                                if (cartItem.displayCustomizations.isNotBlank()) {
                                    Text(
                                        text = cartItem.displayCustomizations,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = SpiralDineOrangeDark
                                    )
                                }

                                if (cartItem.notes.isNotBlank()) {
                                    Text(
                                        text = "Note: \"${cartItem.notes}\"",
                                        fontSize = 10.sp,
                                        fontStyle = FontStyle.Italic,
                                        color = TextSecondary
                                    )
                                }

                                Text(
                                    text = "${CurrencyFormatter.formatPrice(cartItem.unitPrice)} each",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                            }
                        }

                        // Quantity Counter
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(SurfaceMuted)
                                .border(1.dp, CardBorder, RoundedCornerShape(8.dp))
                                .padding(horizontal = 4.dp, vertical = 2.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(26.dp)
                                    .clickable { onUpdateCount(cartItem.lineId, cartItem.count - 1) },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Remove,
                                    contentDescription = "Decrease",
                                    tint = SpiralDineOrange,
                                    modifier = Modifier.size(13.dp)
                                )
                            }
                            Text(
                                text = "${cartItem.count}",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary,
                                modifier = Modifier.padding(horizontal = 8.dp)
                            )
                            Box(
                                modifier = Modifier
                                    .size(26.dp)
                                    .clickable { onUpdateCount(cartItem.lineId, cartItem.count + 1) },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Add,
                                    contentDescription = "Increase",
                                    tint = SpiralDineOrange,
                                    modifier = Modifier.size(13.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.width(12.dp))

                        Text(
                            text = CurrencyFormatter.formatPrice(cartItem.lineTotal),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimary
                        )
                    }
                }
            }

            // 3. Special Instructions Input
            item {
                Spacer(modifier = Modifier.height(10.dp))
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .border(1.dp, CardBorder, RoundedCornerShape(14.dp)),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "Cooking or Dining Instructions",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        BasicTextField(
                            value = specialNotes,
                            onValueChange = { specialNotes = it },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp),
                            decorationBox = { inner ->
                                if (specialNotes.isEmpty()) {
                                    Text(
                                        text = "e.g. Less spicy, extra raita...",
                                        fontSize = 11.sp,
                                        color = TextSecondary
                                    )
                                }
                                inner()
                            }
                        )
                    }
                }
            }

            // 4. Coupons & Offers Tray
            item {
                Spacer(modifier = Modifier.height(12.dp))
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .border(1.dp, CardBorder, RoundedCornerShape(14.dp)),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        // Applied Coupon Tag
                        if (appliedPromotion != null) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(SuccessGreenBg, RoundedCornerShape(10.dp))
                                    .border(1.dp, SuccessGreen.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                                    .padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = "Applied",
                                        tint = SuccessGreen,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Column {
                                        Text(
                                            text = "${appliedPromotion.effectiveCode} APPLIED",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.ExtraBold,
                                            color = SuccessGreen
                                        )
                                        Text(
                                            text = "You save ${CurrencyFormatter.formatPrice(pricing.discount)} on this order",
                                            fontSize = 10.sp,
                                            color = SuccessGreen
                                        )
                                    }
                                }

                                Text(
                                    text = "Remove",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = NonVegRed,
                                    modifier = Modifier.clickable { onRemoveCoupon() }
                                )
                            }
                            Spacer(modifier = Modifier.height(10.dp))
                        } else {
                            // Coupon input box
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .border(1.dp, CardBorder, RoundedCornerShape(10.dp))
                                        .padding(horizontal = 12.dp, vertical = 8.dp)
                                ) {
                                    BasicTextField(
                                        value = manualCouponInput,
                                        onValueChange = { manualCouponInput = it.uppercase() },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth(),
                                        decorationBox = { inner ->
                                            if (manualCouponInput.isEmpty()) {
                                                Text(
                                                    text = "Enter coupon code",
                                                    fontSize = 12.sp,
                                                    color = TextSecondary
                                                )
                                            }
                                            inner()
                                        }
                                    )
                                }

                                Button(
                                    onClick = {
                                        if (manualCouponInput.isNotBlank()) {
                                            onApplyCoupon(manualCouponInput.trim())
                                        }
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                                ) {
                                    Text("Apply", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }

                            // 1-Click Available Coupon Suggestions
                            val availableCoupons = availablePromotions.filter { p ->
                                p.placements.contains("cart_suggestion") || p.placements.contains("CART_CHECKOUT") || p.effectiveCode.isNotBlank()
                            }
                            if (availableCoupons.isNotEmpty()) {
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    text = "AVAILABLE COUPONS",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextSecondary
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    availableCoupons.forEach { c ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .background(SurfaceMuted, RoundedCornerShape(8.dp))
                                                .border(1.dp, CardBorder, RoundedCornerShape(8.dp))
                                                .padding(horizontal = 10.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Column {
                                                Text(
                                                    text = c.effectiveCode,
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.ExtraBold,
                                                    color = SpiralDineOrange
                                                )
                                                Text(
                                                    text = c.description.ifBlank { "Min ${CurrencyFormatter.formatPrice(c.effectiveMinOrder)} • Up to ${CurrencyFormatter.formatPrice(c.maxDiscountAmount)} off" },
                                                    fontSize = 9.sp,
                                                    color = TextSecondary
                                                )
                                            }
                                            Text(
                                                text = "Apply",
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = SpiralDineOrange,
                                                modifier = Modifier.clickable { onApplyCoupon(c.effectiveCode) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 5. Authoritative Bill Breakdown Summary
            item {
                Spacer(modifier = Modifier.height(12.dp))
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .border(1.dp, CardBorder, RoundedCornerShape(14.dp)),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "BILL SUMMARY",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextSecondary,
                            letterSpacing = 1.sp
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Subtotal", fontSize = 12.sp, color = TextSecondary)
                            Text(CurrencyFormatter.formatPrice(pricing.subtotal), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        }

                        if (pricing.discount > 0) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text(
                                    "Discount (${appliedPromotion?.effectiveCode ?: "Promo"})",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SuccessGreen
                                )
                                Text(
                                    "-${CurrencyFormatter.formatPrice(pricing.discount)}",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SuccessGreen
                                )
                            }
                        }

                        if (pricing.tax > 0.0 || pricing.taxPercent > 0.0) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                val taxLabel = if (pricing.taxPercent > 0.0) {
                                    "Taxes / GST (${pricing.taxPercent.toInt()}%)"
                                } else {
                                    "Taxes"
                                }
                                Text(taxLabel, fontSize = 12.sp, color = TextSecondary)
                                Text(CurrencyFormatter.formatPrice(pricing.tax), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }

                        if (pricing.serviceCharge > 0.0 || pricing.serviceChargePercent > 0.0) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                val feeLabel = if (pricing.serviceChargePercent > 0.0) {
                                    "Restaurant Service Fee (${pricing.serviceChargePercent.toInt()}%)"
                                } else {
                                    "Restaurant Service Fee"
                                }
                                Text(feeLabel, fontSize = 12.sp, color = TextSecondary)
                                Text(CurrencyFormatter.formatPrice(pricing.serviceCharge), fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            }
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(1.dp)
                                .background(CardBorder)
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("Grand Total", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                            Text(
                                CurrencyFormatter.formatPrice(pricing.total),
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black,
                                color = SpiralDineOrange
                            )
                        }
                    }
                }
            }

            // 6. Submit Order Button
            item {
                Spacer(modifier = Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                ) {
                    Button(
                        onClick = { onPlaceOrder(specialNotes) },
                        enabled = !isPlacingOrder,
                        colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                    ) {
                        if (isPlacingOrder) {
                            CircularProgressIndicator(
                                color = SurfaceWhite,
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text("Placing Order...", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        } else {
                            Text(
                                text = "Place Dine-in Order • ${CurrencyFormatter.formatPrice(pricing.total)}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }
            }
        }
    }
}
