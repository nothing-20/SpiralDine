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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.spiraldine.printbridge.auth.AuthResult
import com.spiraldine.printbridge.data.DefaultPrintBridgeRepository
import com.spiraldine.printbridge.data.local.PrintJobEntity
import com.spiraldine.printbridge.model.CloudSyncStatus
import com.spiraldine.printbridge.model.KotTicketJson
import com.spiraldine.printbridge.model.PrintBridgeUiState
import com.spiraldine.printbridge.model.PrinterDiagnostics
import com.spiraldine.printbridge.model.ThermalPrinterStatus
import com.spiraldine.printbridge.routing.KotStationRouter
import com.spiraldine.printbridge.service.PrintBridgeForegroundService
import com.spiraldine.printbridge.theme.Slate400
import com.spiraldine.printbridge.theme.Slate600
import com.spiraldine.printbridge.theme.SpiralAmberPrimary
import com.spiraldine.printbridge.theme.SpiralDinePrintBridgeTheme
import com.spiraldine.printbridge.theme.StatusAmber
import com.spiraldine.printbridge.theme.StatusGreen
import com.spiraldine.printbridge.theme.StatusRed
import com.spiraldine.printbridge.transport.BluetoothDeviceHelper
import com.spiraldine.printbridge.ui.viewmodel.MainViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    modifier: Modifier = Modifier,
    viewModel: MainViewModel = viewModel { MainViewModel(DefaultPrintBridgeRepository()) }
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.checkExistingSession(context)
    }

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
            onSelectBluetoothDevice = { name, address -> viewModel.setBluetoothDevice(name, address, context) },
            onSetNetworkPrinter = { host, port -> viewModel.setNetworkPrinter(host, port, context) },
            onSetPaperWidth = { viewModel.setPaperWidth(it, context) },
            onSetTargetStation = { viewModel.setTargetStation(it, context) },
            onTriggerTestPrint = { viewModel.triggerTestPrint(context) },
            onDismissTestPrintMessage = { viewModel.dismissTestPrintMessage() },
            onSignIn = { email, pass, cb -> viewModel.signIn(email, pass, context, cb) },
            onSignOut = { viewModel.signOut(context) },
            onStartService = { viewModel.startService(context) },
            onStopService = { viewModel.stopService(context) },
            onRefreshQueue = { viewModel.loadQueueJobs(context) },
            onSelectQueueTab = { viewModel.setActiveQueueTab(it, context) },
            onRetryJob = { viewModel.retryJob(it, context) },
            onPrepareAmbiguousRetry = { viewModel.prepareAmbiguousRetry(it) },
            onDismissAmbiguousRetry = { viewModel.dismissAmbiguousRetry() },
            onConfirmAmbiguousRetry = { viewModel.confirmAmbiguousRetry(it, context) },
            onRequestReprint = { viewModel.requestReprint(it, context) },
            onSelectJobForDetails = { viewModel.selectJobForDetails(it) },
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
    onSetTargetStation: (String) -> Unit = {},
    onTriggerTestPrint: () -> Unit = {},
    onDismissTestPrintMessage: () -> Unit = {},
    onSignIn: (String, String, (AuthResult) -> Unit) -> Unit = { _, _, _ -> },
    onSignOut: () -> Unit = {},
    onStartService: () -> Unit = {},
    onStopService: () -> Unit = {},
    onRefreshQueue: () -> Unit = {},
    onSelectQueueTab: (String) -> Unit = {},
    onRetryJob: (String) -> Unit = {},
    onPrepareAmbiguousRetry: (PrintJobEntity) -> Unit = {},
    onDismissAmbiguousRetry: () -> Unit = {},
    onConfirmAmbiguousRetry: (String) -> Unit = {},
    onRequestReprint: (PrintJobEntity) -> Unit = {},
    onSelectJobForDetails: (PrintJobEntity?) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var selectedScreenTab by remember { mutableIntStateOf(0) } // 0: Bridge Dashboard, 1: Queue Inspector

    var showBtDeviceDialog by remember { mutableStateOf(false) }
    var networkHostInput by remember(state.config.networkHost) { mutableStateOf(state.config.networkHost) }
    var networkPortInput by remember(state.config.networkPort) { mutableStateOf(state.config.networkPort.toString()) }

    var showPairingDialog by remember { mutableStateOf(false) }
    var emailInput by remember { mutableStateOf("") }
    var passwordInput by remember { mutableStateOf("") }
    var authErrorMessage by remember { mutableStateOf<String?>(null) }
    var isAuthenticating by remember { mutableStateOf(false) }

    // Ambiguous Retry Warning Dialog
    if (state.jobPendingAmbiguousConfirmation != null) {
        val ambiguousJob = state.jobPendingAmbiguousConfirmation!!
        AlertDialog(
            onDismissRequest = onDismissAmbiguousRetry,
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(StatusAmber)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Ambiguous Transmission Recovery", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Ticket #${ambiguousJob.ticketNumber} encountered a transmission interruption mid-stream.",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Card(
                        colors = CardDefaults.cardColors(containerColor = StatusAmber.copy(alpha = 0.12f)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Column(modifier = Modifier.padding(10.dp)) {
                            Text(
                                text = "ATTENTION REQUIRED:",
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp,
                                color = StatusAmber
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Because the socket connection broke while bytes were in flight, this ticket MAY HAVE ALREADY PRINTED physically, or partially extruded.\n\nRetrying without checking will send a second copy and could result in DUPLICATE orders prepared in the kitchen.",
                                fontSize = 12.sp,
                                lineHeight = 16.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                    val lastErr = ambiguousJob.lastError
                    Text(
                        text = "Reason recorded: ${lastErr ?: "Socket interrupted mid-write"}",
                        fontSize = 11.sp,
                        color = Slate400
                    )
                    Text(
                        text = "Did staff physically verify that the paper did NOT print?",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { onConfirmAmbiguousRetry(ambiguousJob.jobId) },
                    colors = ButtonDefaults.buttonColors(containerColor = StatusAmber)
                ) {
                    Text("Yes, Tray Checked — Retry")
                }
            },
            dismissButton = {
                TextButton(onClick = onDismissAmbiguousRetry) {
                    Text("Cancel (Keep Interrupted)")
                }
            }
        )
    }

    // Job Details Modal Dialog
    if (state.selectedJobForDetails != null) {
        val job = state.selectedJobForDetails!!
        AlertDialog(
            onDismissRequest = { onSelectJobForDetails(null) },
            title = {
                Text("Job Details: Ticket #${job.ticketNumber}", fontWeight = FontWeight.Bold, fontSize = 16.sp)
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    DetailRow(label = "Job ID", value = job.jobId)
                    DetailRow(label = "Canonical Order ID", value = job.orderId)
                    DetailRow(label = "Status", value = job.status)
                    DetailRow(label = "Retry Count", value = "${job.retryCount}")
                    DetailRow(label = "Created At", value = formatEpochTime(job.createdAt))
                    if (job.lastAttemptAt != null) {
                        DetailRow(label = "Last Attempt", value = formatEpochTime(job.lastAttemptAt))
                    }
                    val detailErr = job.lastError
                    if (detailErr != null) {
                        DetailRow(label = "Last Diagnostic Error", value = detailErr)
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Raw Stored Payload:", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        shape = RoundedCornerShape(6.dp)
                    ) {
                        Text(
                            text = job.payloadJson,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(8.dp)
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { onSelectJobForDetails(null) }) {
                    Text("Close")
                }
            }
        )
    }

    // Restaurant Pairing Dialog
    if (showPairingDialog) {
        AlertDialog(
            onDismissRequest = {
                if (!isAuthenticating) showPairingDialog = false
            },
            title = { Text("Pair Restaurant Workspace") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Sign in using authorized staff credentials (waiter, kitchen, chef, manager, or owner) to pair this device with your restaurant workspace.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.secondary
                    )
                    OutlinedTextField(
                        value = emailInput,
                        onValueChange = { emailInput = it },
                        label = { Text("Staff Email") },
                        placeholder = { Text("kitchen@restaurant.com") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = passwordInput,
                        onValueChange = { passwordInput = it },
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (authErrorMessage != null) {
                        Text(
                            text = authErrorMessage ?: "",
                            color = StatusRed,
                            fontSize = 12.sp
                        )
                    }
                    if (isAuthenticating) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Authenticating & Verifying Role...", fontSize = 12.sp)
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (emailInput.isNotBlank() && passwordInput.isNotBlank()) {
                            isAuthenticating = true
                            authErrorMessage = null
                            onSignIn(emailInput.trim(), passwordInput) { result ->
                                isAuthenticating = false
                                when (result) {
                                    is AuthResult.Success -> {
                                        showPairingDialog = false
                                        emailInput = ""
                                        passwordInput = ""
                                    }
                                    is AuthResult.Error -> {
                                        authErrorMessage = result.message
                                    }
                                }
                            }
                        } else {
                            authErrorMessage = "Please enter both email and password."
                        }
                    },
                    enabled = !isAuthenticating && emailInput.isNotBlank() && passwordInput.isNotBlank()
                ) {
                    Text("Pair Device")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showPairingDialog = false },
                    enabled = !isAuthenticating
                ) {
                    Text("Cancel")
                }
            }
        )
    }

    // Bluetooth Device Selection Dialog
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

    Column(modifier = modifier) {
        // Top Navigation Tabs
        TabRow(
            selectedTabIndex = selectedScreenTab,
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            Tab(
                selected = selectedScreenTab == 0,
                onClick = { selectedScreenTab = 0 },
                text = { Text("Bridge & Diagnostics") }
            )
            Tab(
                selected = selectedScreenTab == 1,
                onClick = {
                    selectedScreenTab = 1
                    onRefreshQueue()
                },
                text = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Queue Inspector")
                        if (state.queueStatus.pendingCount > 0) {
                            Spacer(modifier = Modifier.width(6.dp))
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(SpiralAmberPrimary)
                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = "${state.queueStatus.pendingCount}",
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }
                }
            )
        }

        if (selectedScreenTab == 0) {
            // Screen 0: Bridge Dashboard & Hardware Diagnostics
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // 1. Overview Card
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
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
                            text = "Bridges SpiralDine kitchen orders to physical ESC/POS thermal receipt printers (Bluetooth / TCP 9100). Operates in background service with persistent local Room queue recovery.",
                            fontSize = 13.sp,
                            lineHeight = 18.sp,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                }

                // 2. Cloud Sync Card
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "1. Cloud Order Sync",
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
                                    .background(
                                        when (state.cloudStatus) {
                                            is CloudSyncStatus.Connected -> StatusGreen
                                            CloudSyncStatus.Connecting -> StatusAmber
                                            CloudSyncStatus.Disconnected -> StatusRed
                                        }
                                    )
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = when (state.cloudStatus) {
                                    is CloudSyncStatus.Connected -> "Connected: ${(state.cloudStatus as CloudSyncStatus.Connected).restaurantName}"
                                    CloudSyncStatus.Connecting -> "Connecting to SpiralDine..."
                                    CloudSyncStatus.Disconnected -> "Disconnected (Pairing Required)"
                                },
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = when (state.cloudStatus) {
                                is CloudSyncStatus.Connected -> "Tenant: ${(state.cloudStatus as CloudSyncStatus.Connected).tenantId} | Listening on restaurants/${(state.cloudStatus as CloudSyncStatus.Connected).tenantId}/kitchenTickets"
                                CloudSyncStatus.Connecting -> "Authenticating restaurant staff credentials..."
                                CloudSyncStatus.Disconnected -> "Device is not paired with a restaurant workspace."
                            },
                            fontSize = 12.sp,
                            lineHeight = 16.sp,
                            color = MaterialTheme.colorScheme.secondary,
                            modifier = Modifier.padding(start = 18.dp)
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        if (state.cloudStatus is CloudSyncStatus.Connected) {
                            OutlinedButton(
                                onClick = onSignOut,
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Unpair / Sign Out")
                            }
                        } else {
                            Button(
                                onClick = {
                                    authErrorMessage = null
                                    showPairingDialog = true
                                },
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = SpiralAmberPrimary),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Pair Restaurant Workspace")
                            }
                        }
                    }
                }

                // 3. Background Service Card
                val serviceRunning = PrintBridgeForegroundService.isServiceRunning
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "2. Background Print Service",
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
                                    .background(if (serviceRunning) StatusGreen else Slate400)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = if (serviceRunning) "Foreground Service Active" else "Foreground Service Stopped",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (serviceRunning) {
                                "Persistent service is running with ongoing notification. KOTs are dispatched continuously."
                            } else {
                                "Background execution is paused. Start service to print orders while screen is off."
                            },
                            fontSize = 12.sp,
                            lineHeight = 16.sp,
                            color = MaterialTheme.colorScheme.secondary,
                            modifier = Modifier.padding(start = 18.dp)
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            if (serviceRunning) {
                                OutlinedButton(
                                    onClick = onStopService,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Stop Service")
                                }
                            } else {
                                Button(
                                    onClick = onStartService,
                                    enabled = state.cloudStatus is CloudSyncStatus.Connected,
                                    shape = RoundedCornerShape(8.dp),
                                    colors = ButtonDefaults.buttonColors(containerColor = SpiralAmberPrimary),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Start Service")
                                }
                            }
                        }
                    }
                }

                // 4. Kitchen-Station Routing Filter Card
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "3. Kitchen Station Routing",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = "Active: ${state.config.targetStation}",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = SpiralAmberPrimary
                            )
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Filter which food & beverage stations this printer prints. Non-matching tickets are cleanly routed and preserved, preventing missing orders and duplicate printing across counters.",
                            fontSize = 12.sp,
                            lineHeight = 16.sp,
                            color = MaterialTheme.colorScheme.secondary
                        )
                        Spacer(modifier = Modifier.height(10.dp))

                        val stations: List<String> = KotStationRouter.STATIONS
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            items(stations) { station: String ->
                                val isSelected = state.config.targetStation.equals(station, ignoreCase = true)
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { onSetTargetStation(station) },
                                    label = {
                                        Text(
                                            text = station,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                            fontSize = 12.sp
                                        )
                                    }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = when (state.config.targetStation.uppercase()) {
                                KotStationRouter.STATION_ALL -> "ALL: Prints complete KOTs for all food, grill, fryer, bar, and dessert items."
                                KotStationRouter.STATION_GRILL -> "GRILL: Filters tickets to print ONLY items tagged for Grill. Multi-station tickets are partitioned."
                                KotStationRouter.STATION_FRYER -> "FRYER: Filters tickets to print ONLY items tagged for Fryer."
                                KotStationRouter.STATION_BAR -> "BAR: Filters tickets to print ONLY drinks and beverage items."
                                KotStationRouter.STATION_DESSERT -> "DESSERT: Filters tickets to print ONLY dessert items."
                                else -> "MAIN KITCHEN: Filters tickets to print food items destined for Main Kitchen."
                            },
                            fontSize = 11.sp,
                            color = Slate600
                        )
                    }
                }

                // 5. Hardware Diagnostics & Transport State Card
                DiagnosticsSectionCard(diagnostics = state.diagnostics)

                // 6. Queue Engine Status Card
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "5. Local Room Queue Engine",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            TextButton(onClick = { selectedScreenTab = 1 }) {
                                Text("Inspect Queue >", fontSize = 12.sp)
                            }
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            QueueMetricColumn(label = "Pending Jobs", value = "${state.queueStatus.pendingCount}")
                            QueueMetricColumn(label = "In-Flight", value = "${state.queueStatus.inFlightCount}")
                            QueueMetricColumn(label = "Printed Today", value = "${state.queueStatus.totalPrintedToday}")
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = if (state.queueStatus.lastPrintedTicketNumber != null) {
                                "Last Transport Accepted: Ticket #${state.queueStatus.lastPrintedTicketNumber}"
                            } else {
                                "Queue Status: Idle. No jobs printed since startup."
                            },
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                }

                // 7. Hardware Configuration Card
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "6. Thermal Printer Setup",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(12.dp))

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

                // 8. Hardware Test Slip Card
                Card(
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "7. Hardware Diagnostic Test Print",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Transmits an unmistakable diagnostic test slip (NOT a food order) to verify communication, column formatting, and auto-cutter.",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.secondary
                        )
                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = onTriggerTestPrint,
                            enabled = !state.isTestPrintInProgress && state.diagnostics.isTestPrintAvailable,
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
                                Text("Print Diagnostic Test Slip")
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
        } else {
            // Screen 1: Print Queue Inspector
            QueueInspectorScreen(
                state = state,
                onRefresh = onRefreshQueue,
                onSelectTab = onSelectQueueTab,
                onRetryJob = onRetryJob,
                onPrepareAmbiguousRetry = onPrepareAmbiguousRetry,
                onRequestReprint = onRequestReprint,
                onSelectJobForDetails = onSelectJobForDetails
            )
        }
    }
}

@Composable
fun DiagnosticsSectionCard(diagnostics: PrinterDiagnostics) {
    Card(
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "4. Hardware Diagnostics & Transport State",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(10.dp))

            DetailRow(label = "Configured Printer", value = diagnostics.selectedPrinterName)
            DetailRow(label = "Connection Transport", value = diagnostics.connectionType)
            DetailRow(label = "Current State", value = diagnostics.connectionState)

            if (diagnostics.lastSuccessfulEventDescription != null) {
                DetailRow(
                    label = "Last Transport Success",
                    value = "${diagnostics.lastSuccessfulEventDescription} (${formatEpochTime(diagnostics.lastSuccessfulEventTimestamp)})"
                )
            } else {
                DetailRow(label = "Last Transport Success", value = "No successful transmission recorded yet")
            }

            if (diagnostics.latestError != null) {
                DetailRow(
                    label = "Latest Diagnostic Error",
                    value = "${diagnostics.latestError} (${formatEpochTime(diagnostics.latestErrorTimestamp)})",
                    valueColor = StatusRed
                )
            } else {
                DetailRow(label = "Latest Diagnostic Error", value = "None (transport healthy)")
            }

            DetailRow(
                label = "Test Print Available",
                value = if (diagnostics.isTestPrintAvailable) "Ready to Transmit" else "Unavailable (Configure Printer First)",
                valueColor = if (diagnostics.isTestPrintAvailable) StatusGreen else Slate400
            )

            Spacer(modifier = Modifier.height(10.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = "DISCLAIMER: Socket open/write acceptance confirms byte delivery into the printer hardware buffer. It does not verify paper roll presence, mechanical jams, or physical extrusion.",
                    fontSize = 11.sp,
                    lineHeight = 15.sp,
                    color = Slate600,
                    modifier = Modifier.padding(8.dp)
                )
            }
        }
    }
}

@Composable
fun QueueInspectorScreen(
    state: PrintBridgeUiState,
    onRefresh: () -> Unit,
    onSelectTab: (String) -> Unit,
    onRetryJob: (String) -> Unit,
    onPrepareAmbiguousRetry: (PrintJobEntity) -> Unit,
    onRequestReprint: (PrintJobEntity) -> Unit,
    onSelectJobForDetails: (PrintJobEntity) -> Unit
) {
    val tabs = listOf(
        "ALL",
        "PENDING",
        "SENDING",
        "PRINTED",
        "FAILED",
        "INTERRUPTED",
        "ROUTED_OTHER_STATION"
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Room Print Queue Inspector",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "Real-time persistent jobs stored locally in Room database",
                    fontSize = 12.sp,
                    color = Slate400
                )
            }
            OutlinedButton(onClick = onRefresh, shape = RoundedCornerShape(8.dp)) {
                Text("Refresh", fontSize = 12.sp)
            }
        }

        // Horizontal filter tabs
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(tabs) { tab ->
                val isSelected = state.activeQueueTab == tab
                FilterChip(
                    selected = isSelected,
                    onClick = { onSelectTab(tab) },
                    label = {
                        Text(
                            text = tab.replace("_", " "),
                            fontSize = 11.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                )
            }
        }

        // List of jobs
        if (state.queueJobs.isEmpty()) {
            Card(
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "No jobs found in queue (${state.activeQueueTab}).",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 14.sp,
                        color = Slate600
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Real orders from SpiralDine will appear here as they are synced.",
                        fontSize = 12.sp,
                        color = Slate400
                    )
                }
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                state.queueJobs.forEach { job ->
                    PrintJobCard(
                        job = job,
                        onRetryJob = onRetryJob,
                        onPrepareAmbiguousRetry = onPrepareAmbiguousRetry,
                        onRequestReprint = onRequestReprint,
                        onSelectJobForDetails = onSelectJobForDetails
                    )
                }
            }
        }
    }
}

@Composable
fun PrintJobCard(
    job: PrintJobEntity,
    onRetryJob: (String) -> Unit,
    onPrepareAmbiguousRetry: (PrintJobEntity) -> Unit,
    onRequestReprint: (PrintJobEntity) -> Unit,
    onSelectJobForDetails: (PrintJobEntity) -> Unit
) {
    val ticket = remember(job.payloadJson) {
        try {
            KotTicketJson.fromJson(job.payloadJson)
        } catch (_: Exception) {
            null
        }
    }

    val statusColor = when (job.status) {
        "PRINTED" -> StatusGreen
        "PENDING" -> SpiralAmberPrimary
        "SENDING" -> Color(0xFF2563EB)
        "FAILED" -> StatusRed
        "INTERRUPTED" -> StatusAmber
        "ROUTED_OTHER_STATION" -> Slate400
        else -> Slate400
    }

    Card(
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Header Row: Ticket # + Status Badge
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Ticket #${job.ticketNumber}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    if (ticket?.isReprint == true) {
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(StatusAmber.copy(alpha = 0.15f))
                                .padding(horizontal = 4.dp, vertical = 2.dp)
                        ) {
                            Text("REPRINT", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = StatusAmber)
                        }
                    }
                }
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(statusColor.copy(alpha = 0.15f))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = job.status.replace("_", " "),
                        color = statusColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Order / Station details
            Text(
                text = "Order: ${job.orderId} | Table: ${ticket?.tableNumber ?: "N/A"} | Station: ${ticket?.primaryStation ?: "ALL"}",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.secondary
            )

            // Timestamps and retries
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "Created: ${formatEpochTime(job.createdAt)}",
                    fontSize = 11.sp,
                    color = Slate400
                )
                Text(
                    text = "Retries: ${job.retryCount}",
                    fontSize = 11.sp,
                    color = Slate400
                )
            }

            // Error diagnostic if any
            val jobErr = job.lastError
            if (jobErr != null) {
                Spacer(modifier = Modifier.height(6.dp))
                Card(
                    colors = CardDefaults.cardColors(containerColor = StatusRed.copy(alpha = 0.08f)),
                    shape = RoundedCornerShape(6.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = "Diagnostic: $jobErr",
                        fontSize = 11.sp,
                        color = StatusRed,
                        modifier = Modifier.padding(6.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            Spacer(modifier = Modifier.height(8.dp))

            // Action row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = { onSelectJobForDetails(job) }) {
                    Text("View Payload", fontSize = 12.sp)
                }

                when (job.status) {
                    "FAILED" -> {
                        Spacer(modifier = Modifier.width(6.dp))
                        Button(
                            onClick = { onRetryJob(job.jobId) },
                            shape = RoundedCornerShape(6.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = SpiralAmberPrimary)
                        ) {
                            Text("Retry Job", fontSize = 12.sp)
                        }
                    }
                    "INTERRUPTED" -> {
                        Spacer(modifier = Modifier.width(6.dp))
                        Button(
                            onClick = { onPrepareAmbiguousRetry(job) },
                            shape = RoundedCornerShape(6.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = StatusAmber)
                        ) {
                            Text("Inspect & Confirm Retry", fontSize = 12.sp)
                        }
                    }
                    "PRINTED" -> {
                        Spacer(modifier = Modifier.width(6.dp))
                        OutlinedButton(
                            onClick = { onRequestReprint(job) },
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text("Reprint Duplicate", fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DetailRow(
    label: String,
    value: String,
    valueColor: Color = MaterialTheme.colorScheme.onSurface
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, fontSize = 12.sp, color = Slate600)
        Text(
            text = value,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = valueColor,
            modifier = Modifier.padding(start = 12.dp)
        )
    }
}

private fun formatEpochTime(epochMs: Long?): String {
    if (epochMs == null || epochMs <= 0) return "N/A"
    return try {
        val sdf = SimpleDateFormat("HH:mm:ss dd-MMM", Locale.getDefault())
        sdf.format(Date(epochMs))
    } catch (_: Exception) {
        "$epochMs"
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
