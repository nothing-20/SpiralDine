package com.spiraldine.printbridge.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.spiraldine.printbridge.data.DefaultPrintBridgeRepository
import com.spiraldine.printbridge.model.CloudSyncStatus
import com.spiraldine.printbridge.model.PrintBridgeUiState
import com.spiraldine.printbridge.model.ThermalPrinterStatus
import com.spiraldine.printbridge.theme.Slate400
import com.spiraldine.printbridge.theme.Slate600
import com.spiraldine.printbridge.theme.SpiralAmberPrimary
import com.spiraldine.printbridge.theme.SpiralDinePrintBridgeTheme
import com.spiraldine.printbridge.theme.StatusAmber
import com.spiraldine.printbridge.theme.StatusGreen
import com.spiraldine.printbridge.theme.StatusRed
import com.spiraldine.printbridge.ui.viewmodel.MainViewModel

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.TextButton
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.spiraldine.printbridge.transport.BluetoothDeviceHelper
import com.spiraldine.printbridge.transport.BluetoothDeviceInfo

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    modifier: Modifier = Modifier,
    viewModel: MainViewModel = viewModel { MainViewModel(DefaultPrintBridgeRepository()) }
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(SpiralAmberPrimary),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "SD",
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 16.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "SpiralDine",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp
                            )
                            Text(
                                text = "Android Print Bridge",
                                style = MaterialTheme.typography.labelSmall,
                                color = Slate400
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        modifier = modifier
    ) { innerPadding ->
        HomeScreenContent(
            state = state,
            onSetConnectionType = { viewModel.setConnectionType(it) },
            onSelectBluetoothDevice = { name, address -> viewModel.setBluetoothDevice(name, address) },
            onSetNetworkPrinter = { host, port -> viewModel.setNetworkPrinter(host, port) },
            onSetPaperWidth = { viewModel.setPaperWidth(it) },
            onTriggerTestPrint = { viewModel.triggerTestPrint(context) },
            onDismissTestPrintMessage = { viewModel.dismissTestPrintMessage() },
            modifier = Modifier
                .padding(innerPadding)
                .fillMaxSize()
        )
    }
}

@Composable
fun HomeScreenContent(
    state: PrintBridgeUiState,
    onSetConnectionType: (String) -> Unit = {},
    onSelectBluetoothDevice: (String, String) -> Unit = { _, _ -> },
    onSetNetworkPrinter: (String, Int) -> Unit = { _, _ -> },
    onSetPaperWidth: (Int) -> Unit = {},
    onTriggerTestPrint: () -> Unit = {},
    onDismissTestPrintMessage: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()
    var showBtDeviceDialog by remember { mutableStateOf(false) }
    var networkHostInput by remember(state.config.networkHost) { mutableStateOf(state.config.networkHost) }
    var networkPortInput by remember(state.config.networkPort) { mutableStateOf(state.config.networkPort.toString()) }

    if (showBtDeviceDialog) {
        val pairedDevices = remember { BluetoothDeviceHelper.getBondedDevices(context) }
        AlertDialog(
            onDismissRequest = { showBtDeviceDialog = false },
            title = { Text("Select Paired Thermal Printer") },
            text = {
                if (pairedDevices.isEmpty()) {
                    Column {
                        Text(
                            text = "No paired Bluetooth devices found.\n\nPlease pair your ESC/POS thermal printer in Android Bluetooth Settings first.",
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                } else {
                    Column(
                        modifier = Modifier.verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        pairedDevices.forEach { device ->
                            Card(
                                onClick = {
                                    onSelectBluetoothDevice(device.name, device.address)
                                    showBtDeviceDialog = false
                                },
                                shape = RoundedCornerShape(8.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = if (device.address == state.config.bluetoothAddress) {
                                        SpiralAmberPrimary.copy(alpha = 0.15f)
                                    } else {
                                        MaterialTheme.colorScheme.surfaceVariant
                                    }
                                ),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = device.name,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 14.sp
                                        )
                                        Text(
                                            text = device.address + if (device.isLikelyPrinter) " (Thermal Printer)" else "",
                                            fontSize = 12.sp,
                                            color = Slate400
                                        )
                                    }
                                    if (device.address == state.config.bluetoothAddress) {
                                        Text("Selected", color = SpiralAmberPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showBtDeviceDialog = false }) {
                    Text("Close")
                }
            }
        )
    }

    Column(
        modifier = modifier
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // 1. Purpose & Setup Overview Card
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Automated Kitchen Ticket Bridge",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "This companion application runs autonomously on this device to bridge orders placed in SpiralDine to your physical thermal receipt printer (Bluetooth / Network / USB). Kitchen tickets print automatically without manual browser interaction.",
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    color = MaterialTheme.colorScheme.secondary
                )
            }
        }

        // 2. Cloud Connection Status Section
        StatusSectionCard(
            title = "1. Cloud Order Sync",
            statusTitle = when (state.cloudStatus) {
                is CloudSyncStatus.Connected -> "Connected: ${(state.cloudStatus as CloudSyncStatus.Connected).restaurantName}"
                CloudSyncStatus.Connecting -> "Connecting to SpiralDine..."
                CloudSyncStatus.Disconnected -> "Disconnected (Pairing Required)"
            },
            statusSubtitle = when (state.cloudStatus) {
                is CloudSyncStatus.Connected -> "Tenant: ${(state.cloudStatus as CloudSyncStatus.Connected).tenantId} | Listening for KOTs"
                CloudSyncStatus.Connecting -> "Authenticating restaurant staff credentials..."
                CloudSyncStatus.Disconnected -> "Device is not currently associated with an active restaurant workspace."
            },
            statusColor = when (state.cloudStatus) {
                is CloudSyncStatus.Connected -> StatusGreen
                CloudSyncStatus.Connecting -> StatusAmber
                CloudSyncStatus.Disconnected -> StatusRed
            }
        )

        // 3. Thermal Printer Status Section
        StatusSectionCard(
            title = "2. Thermal Printer Hardware Status",
            statusTitle = when (state.printerStatus) {
                is ThermalPrinterStatus.Connected -> "Ready: ${(state.printerStatus as ThermalPrinterStatus.Connected).deviceName}"
                is ThermalPrinterStatus.Connecting -> "Connecting to ${(state.printerStatus as ThermalPrinterStatus.Connecting).deviceName}..."
                ThermalPrinterStatus.NotConfigured -> "No Printer Configured"
                is ThermalPrinterStatus.Error -> "Hardware Error: ${(state.printerStatus as ThermalPrinterStatus.Error).reason}"
            },
            statusSubtitle = when (state.printerStatus) {
                is ThermalPrinterStatus.Connected -> "Connection: ${(state.printerStatus as ThermalPrinterStatus.Connected).connectionType} (${(state.printerStatus as ThermalPrinterStatus.Connected).paperWidthMm}mm roll)"
                is ThermalPrinterStatus.Connecting -> "Establishing communication channel..."
                ThermalPrinterStatus.NotConfigured -> "Configure Bluetooth SPP or TCP Port 9100 below."
                is ThermalPrinterStatus.Error -> "Check power, paper roll, IP address, or Bluetooth pairing."
            },
            statusColor = when (state.printerStatus) {
                is ThermalPrinterStatus.Connected -> StatusGreen
                is ThermalPrinterStatus.Connecting -> StatusAmber
                ThermalPrinterStatus.NotConfigured -> Slate400
                is ThermalPrinterStatus.Error -> StatusRed
            }
        )

        // 4. Print Queue Status Section
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "3. Print Queue Engine",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    QueueMetricColumn(label = "Pending Jobs", value = "${state.queueStatus.pendingCount}")
                    QueueMetricColumn(label = "In-Flight", value = "${state.queueStatus.inFlightCount}")
                    QueueMetricColumn(label = "Printed Today", value = "${state.queueStatus.totalPrintedToday}")
                }
                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (state.queueStatus.lastPrintedTicketNumber != null) {
                        "Last Printed: ${state.queueStatus.lastPrintedTicketNumber}"
                    } else {
                        "Queue Status: Idle. No jobs printed since startup."
                    },
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.secondary
                )
            }
        }

        // 5. Hardware Configuration Card (Interactive)
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "4. Thermal Printer Setup",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(12.dp))

                // Transport Selector
                Text(text = "Connection Transport", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Slate600)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        RadioButton(
                            selected = state.config.connectionType == "Bluetooth",
                            onClick = { onSetConnectionType("Bluetooth") }
                        )
                        Text("Bluetooth SPP", fontSize = 13.sp)
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        RadioButton(
                            selected = state.config.connectionType == "Network",
                            onClick = { onSetConnectionType("Network") }
                        )
                        Text("TCP/IP Raw (9100)", fontSize = 13.sp)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Connection Specific Controls
                if (state.config.connectionType == "Bluetooth") {
                    Text(text = "Selected Bluetooth Printer:", fontSize = 12.sp, color = Slate400)
                    Text(
                        text = if (state.config.bluetoothAddress.isNotBlank()) {
                            "${state.config.bluetoothName} (${state.config.bluetoothAddress})"
                        } else {
                            "No paired printer selected"
                        },
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { showBtDeviceDialog = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Choose Paired Bluetooth Printer")
                    }
                } else {
                    Text(text = "Printer Network Address:", fontSize = 12.sp, color = Slate400)
                    Spacer(modifier = Modifier.height(6.dp))
                    OutlinedTextField(
                        value = networkHostInput,
                        onValueChange = {
                            networkHostInput = it
                            val port = networkPortInput.toIntOrNull() ?: 9100
                            onSetNetworkPrinter(it, port)
                        },
                        label = { Text("Printer IP / Hostname") },
                        placeholder = { Text("192.168.1.100") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = networkPortInput,
                        onValueChange = {
                            networkPortInput = it
                            val port = it.toIntOrNull() ?: 9100
                            onSetNetworkPrinter(networkHostInput, port)
                        },
                        label = { Text("TCP Port (Default: 9100)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
                Spacer(modifier = Modifier.height(10.dp))

                // Paper Width Selector
                Text(text = "Thermal Paper Roll Width", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Slate600)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        RadioButton(
                            selected = state.config.paperWidthMm == 80,
                            onClick = { onSetPaperWidth(80) }
                        )
                        Text("80mm (Standard)", fontSize = 13.sp)
                    }
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        RadioButton(
                            selected = state.config.paperWidthMm == 58,
                            onClick = { onSetPaperWidth(58) }
                        )
                        Text("58mm (Compact)", fontSize = 13.sp)
                    }
                }
            }
        }

        // 6. Test Print & Feedback Section
        Card(
            shape = RoundedCornerShape(12.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "5. Hardware Verification",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Prints an unmistakable hardware test slip (NOT a KOT) to verify communication, column formatting, and auto-cutter.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.secondary
                )
                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = onTriggerTestPrint,
                    enabled = !state.isTestPrintInProgress,
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralAmberPrimary),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    if (state.isTestPrintInProgress) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Transmitting to Printer...")
                    } else {
                        Text("Print Hardware Test Slip")
                    }
                }

                if (state.testPrintMessage != null) {
                    Spacer(modifier = Modifier.height(10.dp))
                    val isSuccess = state.testPrintMessage.startsWith("SUCCESS")
                    Card(
                        shape = RoundedCornerShape(8.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = if (isSuccess) StatusGreen.copy(alpha = 0.12f) else StatusRed.copy(alpha = 0.12f)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = if (isSuccess) "Test Print Transport Confirmed" else "Test Print Failed",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = if (isSuccess) StatusGreen else StatusRed
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = state.testPrintMessage,
                                    fontSize = 12.sp,
                                    lineHeight = 16.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                            TextButton(onClick = onDismissTestPrintMessage) {
                                Text("Dismiss", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}


@Composable
fun StatusSectionCard(
    title: String,
    statusTitle: String,
    statusSubtitle: String,
    statusColor: Color
) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(statusColor)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = statusTitle,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = statusSubtitle,
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = MaterialTheme.colorScheme.secondary,
                modifier = Modifier.padding(start = 18.dp)
            )
        }
    }
}

@Composable
fun QueueMetricColumn(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            color = MaterialTheme.colorScheme.onSurface
        )
        Text(
            text = label,
            fontSize = 12.sp,
            color = Slate400
        )
    }
}

@Composable
fun ConfigRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, fontSize = 13.sp, color = Slate600)
        Text(text = value, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurface)
    }
}

@Preview(showBackground = true)
@Composable
fun HomeScreenPreview() {
    SpiralDinePrintBridgeTheme {
        Surface {
            HomeScreenContent(
                state = PrintBridgeUiState()
            )
        }
    }
}
