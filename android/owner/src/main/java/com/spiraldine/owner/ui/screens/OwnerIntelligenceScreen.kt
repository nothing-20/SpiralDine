package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.AIRecommendationRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OwnerIntelligenceScreen(
    recommendations: List<AIRecommendationRecord>,
    onBack: () -> Unit,
    onToggleRecommendation: (String, Boolean) -> Unit
) {
    var selectedPrompt by remember { mutableStateOf<String?>(null) }
    var promptResponse by remember { mutableStateOf<String?>(null) }
    var isThinking by remember { mutableStateOf(false) }

    val quickPrompts = listOf(
        "Projected weekend stock requirements",
        "How to increase dinner table turns?",
        "High-margin dish upselling ideas",
        "Cost breakdown of top 5 sellers"
    )

    fun handlePrompt(prompt: String) {
        selectedPrompt = prompt
        isThinking = true
        // Simulate immediate AI advisor response
        promptResponse = when {
            prompt.contains("stock", ignoreCase = true) ->
                "Based on the last 3 weekends, expect a 35% surge in Biryani and Tandoori platters. Ensure 15 kg additional Basmati Rice and 8 kg chicken are prepped by Friday afternoon."
            prompt.contains("table", ignoreCase = true) ->
                "Floor 1 average dwell time is 48 mins during peak lunch. Enabling mobile QR pre-ordering can cut 6 mins off seated time, unlocking 3 extra seatings."
            prompt.contains("upsell", ignoreCase = true) ->
                "Pairing Garlic Butter Naan with curries converts at 84%. Suggestive prompts on the digital waiter KDS tablet will directly lift ticket sizes."
            else ->
                "AI Knowledge Engine analyzed 450 recent orders: overall gross margin is currently strong at 68%. Focus on minimizing dairy waste to gain +2.5% margin."
        }
        isThinking = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("AI Intelligence & Advisor", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextPrimary)
                        Text("Autonomous insights, predictive models & dining copilot", fontSize = 11.sp, color = TextSecondary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
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
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Copilot Banner
            item {
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color(0xFFEFF6FF)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Outlined.Psychology, contentDescription = null, tint = Color(0xFF2563EB), modifier = Modifier.size(24.dp))
                            }
                            Column {
                                Text("SpiralDine AI Advisor", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                                Text("Ask any operational or menu optimization query", fontSize = 11.sp, color = TextSecondary)
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Quick Prompt Chips
                        Text("QUICK INQUIRIES:", fontWeight = FontWeight.Bold, fontSize = 10.sp, color = TextSecondary)
                        Spacer(modifier = Modifier.height(6.dp))

                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(quickPrompts) { prompt ->
                                Surface(
                                    color = if (selectedPrompt == prompt) TerracottaOrangeLight else BackgroundLight,
                                    shape = RoundedCornerShape(16.dp),
                                    modifier = Modifier.clickable { handlePrompt(prompt) }
                                ) {
                                    Text(
                                        text = prompt,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium,
                                        color = if (selectedPrompt == prompt) TerracottaOrange else TextPrimary,
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                    )
                                }
                            }
                        }

                        // AI Output Response Box
                        if (promptResponse != null) {
                            Spacer(modifier = Modifier.height(12.dp))
                            Surface(
                                color = Color(0xFFF8FAFC),
                                shape = RoundedCornerShape(12.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = TerracottaOrange, modifier = Modifier.size(16.dp))
                                        Text("AI Operational Insight", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = TerracottaOrange)
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = promptResponse ?: "",
                                        fontSize = 12.sp,
                                        color = TextPrimary,
                                        lineHeight = 18.sp
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Health Dimensions Overview
            item {
                Text("RESTAURANT KNOWLEDGE HEALTH", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = TextSecondary)
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Score 1
                    OwnerCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Menu Margin", fontSize = 10.sp, color = TextSecondary)
                            Text("68%", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = SuccessGreen)
                            Text("Healthy", fontSize = 9.sp, color = TextSecondary)
                        }
                    }
                    // Score 2
                    OwnerCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Table Velocity", fontSize = 10.sp, color = TextSecondary)
                            Text("42m", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = InfoBlue)
                            Text("Optimal", fontSize = 9.sp, color = TextSecondary)
                        }
                    }
                    // Score 3
                    OwnerCard(modifier = Modifier.weight(1f)) {
                        Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Waste SLA", fontSize = 10.sp, color = TextSecondary)
                            Text("1.35%", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = SuccessGreen)
                            Text("Low Loss", fontSize = 9.sp, color = TextSecondary)
                        }
                    }
                }
            }

            // Recommendations List
            item {
                Spacer(modifier = Modifier.height(4.dp))
                Text("ACTIVE STRATEGIC RECOMMENDATIONS", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = TextSecondary)
            }

            items(recommendations) { rec ->
                OwnerCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Surface(
                                    color = Color(0xFFEFF6FF),
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = "${rec.impactScore}% Impact",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 10.sp,
                                        color = Color(0xFF2563EB),
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                                Surface(
                                    color = if (rec.priority == "high") ErrorRedLight else WarningAmberLight,
                                    shape = RoundedCornerShape(6.dp)
                                ) {
                                    Text(
                                        text = "${rec.priority.uppercase()} PRIORITY",
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 9.sp,
                                        color = if (rec.priority == "high") ErrorRed else WarningAmber,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                    )
                                }
                            }

                            if (rec.isImplemented) {
                                Badge(containerColor = SuccessGreenLight, contentColor = SuccessGreen) {
                                    Text("Implemented", fontWeight = FontWeight.Bold, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(rec.title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(rec.description, fontSize = 12.sp, color = TextSecondary, lineHeight = 16.sp)

                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = { onToggleRecommendation(rec.id, !rec.isImplemented) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (rec.isImplemented) BackgroundLight else TerracottaOrange,
                                contentColor = if (rec.isImplemented) TextPrimary else SurfaceWhite
                            ),
                            shape = RoundedCornerShape(10.dp)
                        ) {
                            Icon(
                                if (rec.isImplemented) Icons.Default.Check else Icons.Outlined.Bolt,
                                contentDescription = null,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (rec.isImplemented) "Recommendation Active" else rec.actionLabel,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }
        }
    }
}
