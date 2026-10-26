package com.spiralworld.spiraldine.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.DiningSession
import com.spiralworld.spiraldine.data.model.ServiceRequestRecord
import com.spiralworld.spiraldine.data.repository.ServiceAssistanceRepository
import com.spiralworld.spiraldine.data.repository.ServiceAssistanceState
import com.spiralworld.spiraldine.theme.*
import kotlinx.coroutines.launch

data class ServiceOption(
    val title: String,
    val subtitle: String,
    val type: String,
    val icon: ImageVector
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServiceAssistanceBottomSheet(
    session: DiningSession?,
    assistanceRepository: ServiceAssistanceRepository,
    userId: String,
    onDismiss: () -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val submissionState by assistanceRepository.submissionState.collectAsState()

    var activeRequests by remember { mutableStateOf<List<ServiceRequestRecord>>(emptyList()) }
    var notes by remember { mutableStateOf("") }

    val options = remember {
        listOf(
            ServiceOption("Call Waiter", "Request a server to visit your table", "Call Waiter", Icons.Default.Person),
            ServiceOption("Request Water", "Fresh drinking water for the table", "Water", Icons.Default.WaterDrop),
            ServiceOption("Request Bill", "Ask the waiter to bring the check", "Bill", Icons.Default.Receipt),
            ServiceOption("Extra Cutlery", "Forks, spoons, or napkins", "Cutlery", Icons.Default.Restaurant),
            ServiceOption("Clean Table", "Assistance with clearing dishes", "Cleaning", Icons.Default.CleaningServices)
        )
    }

    LaunchedEffect(session) {
        if (session != null && session.tenantId.isNotBlank() && session.tableNumber.isNotBlank()) {
            assistanceRepository.streamActiveRequests(session.tenantId, session.tableNumber).collect {
                activeRequests = it
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = {
            assistanceRepository.resetState()
            onDismiss()
        },
        containerColor = MaterialTheme.colorScheme.background,
        tonalElevation = 8.dp,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 32.dp)
                .verticalScroll(rememberScrollState())
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Table Service Assistance",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Text(
                        text = if (session != null && session.tableNumber.isNotBlank()) {
                            "Table ${session.tableNumber} • ${session.restaurantName.ifBlank { "Dining In" }}"
                        } else {
                            "No active table session"
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                IconButton(
                    onClick = {
                        assistanceRepository.resetState()
                        onDismiss()
                    }
                ) {
                    Icon(Icons.Default.Close, contentDescription = "Close", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // State Messages
            when (val state = submissionState) {
                is ServiceAssistanceState.Submitting -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = SpiralOrange
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = "Notifying waitstaff for ${state.requestType}...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }
                is ServiceAssistanceState.Success -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = VegGreen.copy(alpha = 0.12f))
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = VegGreen)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = state.message,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = VegGreen
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }
                is ServiceAssistanceState.Error -> {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = NonVegRed.copy(alpha = 0.12f))
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = NonVegRed)
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = state.message,
                                style = MaterialTheme.typography.bodyMedium,
                                color = NonVegRed
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                }
                else -> {}
            }

            // Quick Service Options
            Text(
                text = "What do you need?",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )

            Spacer(modifier = Modifier.height(8.dp))

            options.forEach { option ->
                val isBusy = submissionState is ServiceAssistanceState.Submitting
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(enabled = !isBusy && session != null) {
                            coroutineScope.launch {
                                assistanceRepository.submitServiceRequest(
                                    session = session,
                                    requestType = option.type,
                                    notes = notes,
                                    userId = userId
                                )
                            }
                        },
                    color = MaterialTheme.colorScheme.surface,
                    tonalElevation = 1.dp,
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(SpiralOrange.copy(alpha = 0.1f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = option.icon,
                                contentDescription = null,
                                tint = SpiralOrange,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Spacer(modifier = Modifier.width(14.dp))

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = option.title,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = option.subtitle,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        Icon(
                            imageVector = Icons.Default.ChevronRight,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                    }
                }
            }

            // Active Requests Tracker
            AnimatedVisibility(visible = activeRequests.isNotEmpty()) {
                Column(modifier = Modifier.padding(top = 16.dp)) {
                    Text(
                        text = "Active Table Requests",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onBackground
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    activeRequests.take(3).forEach { req ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 3.dp),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 12.dp, vertical = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .clip(CircleShape)
                                            .background(
                                                when (req.status.uppercase()) {
                                                    "RESOLVED" -> VegGreen
                                                    "ACKNOWLEDGED" -> SpiralOrange
                                                    else -> Color(0xFFE69500)
                                                }
                                            )
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = req.requestType,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium
                                    )
                                }

                                Surface(
                                    color = when (req.status.uppercase()) {
                                        "RESOLVED" -> VegGreen.copy(alpha = 0.15f)
                                        "ACKNOWLEDGED" -> SpiralOrange.copy(alpha = 0.15f)
                                        else -> Color(0xFFFFF3CD)
                                    },
                                    shape = RoundedCornerShape(4.dp)
                                ) {
                                    Text(
                                        text = req.status,
                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = when (req.status.uppercase()) {
                                            "RESOLVED" -> VegGreen
                                            "ACKNOWLEDGED" -> SpiralOrange
                                            else -> Color(0xFF856404)
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
