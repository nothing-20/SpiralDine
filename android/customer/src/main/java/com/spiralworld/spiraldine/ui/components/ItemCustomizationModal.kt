package com.spiralworld.spiraldine.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.spiralworld.spiraldine.data.model.Addon
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.Variant
import com.spiralworld.spiraldine.data.repository.CurrencyFormatter
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.NonVegRed
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.SpiralDineOrangeLight
import com.spiralworld.spiraldine.theme.SurfaceMuted
import com.spiralworld.spiraldine.theme.SurfaceWhite
import com.spiralworld.spiraldine.theme.TextPrimary
import com.spiralworld.spiraldine.theme.TextSecondary
import com.spiralworld.spiraldine.theme.VegGreen
import com.spiralworld.spiraldine.theme.WarmBackground

@Composable
fun ItemCustomizationModal(
    item: MenuItem,
    onDismiss: () -> Unit,
    onConfirm: (variant: Variant?, addons: List<Addon>, notes: String, count: Int) -> Unit
) {
    // 1. Variant selection: defaults to first available variant if present
    var selectedVariant by remember(item) {
        mutableStateOf(item.variants.firstOrNull { it.isAvailable } ?: item.variants.firstOrNull())
    }

    // 2. Add-ons selection
    var selectedAddons by remember(item) {
        mutableStateOf<List<Addon>>(emptyList())
    }

    // 3. Special instructions (max 200 chars)
    var specialInstructions by remember { mutableStateOf("") }

    // 4. Quantity (1..100)
    var quantity by remember { mutableStateOf(1) }

    // Calculated unit and total price
    val basePrice = selectedVariant?.price ?: item.effectivePrice
    val addonsPrice = selectedAddons.sumOf { it.price }
    val unitPrice = basePrice + addonsPrice
    val totalPrice = unitPrice * quantity

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.94f)
                .widthIn(max = 520.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(SurfaceWhite)
                .border(1.dp, CardBorder, RoundedCornerShape(24.dp))
                .padding(20.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
            ) {
                // Header Bar with Dish Info & Close Button
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        modifier = Modifier.weight(1f),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(14.dp)
                                .border(1.dp, if (item.isVeg) VegGreen else NonVegRed, RoundedCornerShape(3.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .background(if (item.isVeg) VegGreen else NonVegRed, CircleShape)
                            )
                        }

                        Column {
                            Text(
                                text = item.name,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = "Base price ${CurrencyFormatter.formatPrice(item.effectivePrice)}",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(SurfaceMuted)
                            .border(1.dp, CardBorder, CircleShape)
                            .clickable { onDismiss() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = TextSecondary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Variants Section (Mandatory Single Select)
                if (item.variants.isNotEmpty()) {
                    Text(
                        text = "CHOOSE PORTION / VARIANT *",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = SpiralDineOrange,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))

                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, CardBorder, RoundedCornerShape(14.dp)),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = WarmBackground)
                    ) {
                        Column(modifier = Modifier.padding(vertical = 4.dp)) {
                            item.variants.forEach { variant ->
                                val isSelected = selectedVariant?.id == variant.id
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            if (variant.isAvailable) selectedVariant = variant
                                        }
                                        .padding(horizontal = 12.dp, vertical = 8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        RadioButton(
                                            selected = isSelected,
                                            onClick = {
                                                if (variant.isAvailable) selectedVariant = variant
                                            },
                                            colors = RadioButtonDefaults.colors(selectedColor = SpiralDineOrange)
                                        )
                                        Text(
                                            text = variant.name,
                                            fontSize = 13.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                            color = if (variant.isAvailable) TextPrimary else TextSecondary
                                        )
                                        if (!variant.isAvailable) {
                                            Text(
                                                text = "(Sold Out)",
                                                fontSize = 10.sp,
                                                color = NonVegRed
                                            )
                                        }
                                    }

                                    Text(
                                        text = CurrencyFormatter.formatPrice(variant.price),
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextPrimary
                                    )
                                }
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Add-ons Section (Multi Select)
                if (item.addons.isNotEmpty()) {
                    Text(
                        text = "ADD-ONS & EXTRAS (OPTIONAL)",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextSecondary,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))

                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, CardBorder, RoundedCornerShape(14.dp)),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = WarmBackground)
                    ) {
                        Column(modifier = Modifier.padding(vertical = 4.dp)) {
                            item.addons.forEach { addon ->
                                val isSelected = selectedAddons.any { it.id == addon.id }
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            if (addon.isAvailable) {
                                                selectedAddons = if (isSelected) {
                                                    selectedAddons.filterNot { it.id == addon.id }
                                                } else {
                                                    selectedAddons + addon
                                                }
                                            }
                                        }
                                        .padding(horizontal = 14.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(20.dp)
                                                .clip(RoundedCornerShape(6.dp))
                                                .background(if (isSelected) SpiralDineOrange else SurfaceWhite)
                                                .border(
                                                    1.dp,
                                                    if (isSelected) SpiralDineOrange else CardBorder,
                                                    RoundedCornerShape(6.dp)
                                                ),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            if (isSelected) {
                                                Icon(
                                                    imageVector = Icons.Default.Check,
                                                    contentDescription = "Selected",
                                                    tint = SurfaceWhite,
                                                    modifier = Modifier.size(14.dp)
                                                )
                                            }
                                        }
                                        Text(
                                            text = addon.name,
                                            fontSize = 13.sp,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                            color = if (addon.isAvailable) TextPrimary else TextSecondary
                                        )
                                        if (!addon.isAvailable) {
                                            Text(
                                                text = "(Sold Out)",
                                                fontSize = 10.sp,
                                                color = NonVegRed
                                            )
                                        }
                                    }

                                    Text(
                                        text = "+${CurrencyFormatter.formatPrice(addon.price)}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = TextSecondary
                                    )
                                }
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Cooking Notes / Special Instructions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "SPECIAL INSTRUCTIONS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextSecondary,
                        letterSpacing = 0.5.sp
                    )
                    Text(
                        text = "${specialInstructions.length}/200",
                        fontSize = 10.sp,
                        color = TextSecondary
                    )
                }
                Spacer(modifier = Modifier.height(6.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(SurfaceWhite)
                        .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                ) {
                    BasicTextField(
                        value = specialInstructions,
                        onValueChange = {
                            if (it.length <= 200) specialInstructions = it
                        },
                        modifier = Modifier.fillMaxWidth(),
                        maxLines = 3,
                        decorationBox = { innerTextField ->
                            if (specialInstructions.isEmpty()) {
                                Text(
                                    text = "e.g. Less spicy, extra crispy, no garlic...",
                                    fontSize = 12.sp,
                                    color = TextSecondary
                                )
                            }
                            innerTextField()
                        }
                    )
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Quantity & Add to Cart Action Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Quantity stepper
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(SurfaceMuted)
                            .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
                            .padding(horizontal = 4.dp, vertical = 4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clickable {
                                    if (quantity > 1) quantity--
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Remove,
                                contentDescription = "Decrease",
                                tint = if (quantity > 1) SpiralDineOrange else TextSecondary,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                        Text(
                            text = "$quantity",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = TextPrimary,
                            modifier = Modifier.padding(horizontal = 10.dp)
                        )
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clickable {
                                    if (quantity < 100) quantity++
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Increase",
                                tint = SpiralDineOrange,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    // Add Button with authoritative live total
                    Button(
                        onClick = {
                            onConfirm(
                                selectedVariant,
                                selectedAddons,
                                specialInstructions.trim(),
                                quantity
                            )
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(44.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = "Add • ${CurrencyFormatter.formatPrice(totalPrice)}",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = SurfaceWhite
                        )
                    }
                }
            }
        }
    }
}
