package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.PromotionRecord
import com.spiraldine.owner.data.util.RevenueCalculator
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerPromotionsScreen(
    promotions: List<PromotionRecord>,
    onBack: () -> Unit,
    onAddPromotion: (String, String, String, Double, Double) -> Unit,
    onTogglePromotion: (String, Boolean) -> Unit
) {
    var showAddDialog by remember { mutableStateOf(false) }
    var title by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var discountValueText by remember { mutableStateOf("15") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Promotions & Deals", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = { showAddDialog = true }) {
                        Icon(Icons.Default.Add, contentDescription = "Add Promo", tint = TerracottaOrange)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = BackgroundLight
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(promotions) { promo ->
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(promo.title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Spacer(modifier = Modifier.width(6.dp))
                                Surface(
                                    color = Color(0xFFFAF5FF),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        promo.code,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = Color(0xFF7C3AED),
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            val isPct = promo.discountType == "percentage"
                            val discountText = if (isPct) "${promo.discountValue.toInt()}% OFF" else "${RevenueCalculator.formatInr(promo.discountValue)} OFF"
                            val minText = if (promo.minOrder > 0) " (Min: ${RevenueCalculator.formatInr(promo.minOrder)})" else ""
                            Text(
                                text = "Discount: $discountText$minText",
                                fontSize = 11.sp,
                                color = SuccessGreen,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        Surface(
                            color = if (promo.active) SuccessGreenLight else ErrorRedLight,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.clickable { onTogglePromotion(promo.id, promo.active) }
                        ) {
                            Text(
                                text = if (promo.active) "Active" else "Inactive",
                                color = if (promo.active) SuccessGreen else ErrorRed,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }
        }

        if (showAddDialog) {
            AlertDialog(
                onDismissRequest = { showAddDialog = false },
                title = { Text("Create Promo Code") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = title,
                            onValueChange = { title = it },
                            label = { Text("Title (e.g. Weekend Special)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = code,
                            onValueChange = { code = it.uppercase() },
                            label = { Text("Code (e.g. SPIRAL20)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = discountValueText,
                            onValueChange = { discountValueText = it },
                            label = { Text("Discount (%)") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(
                        onClick = {
                            val value = discountValueText.toDoubleOrNull() ?: 15.0
                            if (title.isNotBlank() && code.isNotBlank()) {
                                onAddPromotion(title.trim(), code.trim(), "percentage", value, 25.0)
                                title = ""
                                code = ""
                                showAddDialog = false
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Create")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showAddDialog = false }) {
                        Text("Cancel")
                    }
                }
            )
        }
    }
}
