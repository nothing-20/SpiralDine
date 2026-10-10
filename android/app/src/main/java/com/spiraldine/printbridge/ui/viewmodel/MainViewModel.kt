package com.spiraldine.printbridge.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spiraldine.printbridge.data.PrintBridgeRepository
import com.spiraldine.printbridge.model.PrintBridgeUiState
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch


class MainViewModel(
    private val repository: PrintBridgeRepository,
    private val printJobRepository: com.spiraldine.printbridge.data.PrintJobRepository? = null,
    private val formatter: com.spiraldine.printbridge.formatter.EscPosKOTFormatter = com.spiraldine.printbridge.formatter.EscPosKOTFormatter()
) : ViewModel() {

    val uiState: StateFlow<PrintBridgeUiState> = repository.state
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = PrintBridgeUiState()
        )

    fun setConnectionType(type: String) {
        repository.updateConfig { it.copy(connectionType = type) }
        updateStatusForConfig()
    }

    fun setBluetoothDevice(name: String, address: String, context: android.content.Context? = null) {
        repository.updateConfig {
            it.copy(
                connectionType = "Bluetooth",
                bluetoothName = name,
                bluetoothAddress = address
            )
        }
        context?.let { ctx ->
            ctx.getSharedPreferences("spiraldine_printer_config", android.content.Context.MODE_PRIVATE)
                .edit()
                .putString("connection_type", "Bluetooth")
                .putString("bt_name", name)
                .putString("bt_address", address)
                .apply()
        }
        repository.updatePrinterStatus(
            com.spiraldine.printbridge.model.ThermalPrinterStatus.Connected(
                deviceName = name,
                connectionType = "Bluetooth SPP ($address)",
                paperWidthMm = uiState.value.config.paperWidthMm
            )
        )
    }

    fun setNetworkPrinter(host: String, port: Int, context: android.content.Context? = null) {
        repository.updateConfig {
            it.copy(
                connectionType = "Network",
                networkHost = host,
                networkPort = port
            )
        }
        context?.let { ctx ->
            ctx.getSharedPreferences("spiraldine_printer_config", android.content.Context.MODE_PRIVATE)
                .edit()
                .putString("connection_type", "Network")
                .putString("net_host", host)
                .putInt("net_port", port)
                .apply()
        }
        val validationErr = com.spiraldine.printbridge.transport.NetworkTransport.validate(host, port)
        if (validationErr != null) {
            repository.updatePrinterStatus(
                com.spiraldine.printbridge.model.ThermalPrinterStatus.Error(validationErr)
            )
        } else {
            repository.updatePrinterStatus(
                com.spiraldine.printbridge.model.ThermalPrinterStatus.Connected(
                    deviceName = "$host:$port",
                    connectionType = "TCP/IP Raw Port $port",
                    paperWidthMm = uiState.value.config.paperWidthMm
                )
            )
        }
    }

    fun setPaperWidth(widthMm: Int, context: android.content.Context? = null) {
        repository.updateConfig { it.copy(paperWidthMm = widthMm) }
        context?.let { ctx ->
            ctx.getSharedPreferences("spiraldine_printer_config", android.content.Context.MODE_PRIVATE)
                .edit()
                .putInt("paper_width", widthMm)
                .apply()
        }
    }

    fun setTargetStation(station: String, context: android.content.Context? = null) {
        repository.updateConfig { it.copy(targetStation = station) }
        context?.let { ctx ->
            ctx.getSharedPreferences("spiraldine_printer_config", android.content.Context.MODE_PRIVATE)
                .edit()
                .putString("station_filter", station)
                .apply()
        }
    }

    fun dismissTestPrintMessage() {
        repository.setTestPrintResult(false, null)
    }

    /**
     * Executes an explicit user-requested test print using the configured transport.
     * Never generates fabricated success messages.
     */
    fun triggerTestPrint(context: android.content.Context) {
        viewModelScope.launch {
            repository.setTestPrintResult(true, "Connecting to printer...")
            val config = uiState.value.config
            val paperWidth = if (config.paperWidthMm == 58) {
                com.spiraldine.printbridge.model.ThermalPaperWidth.WIDTH_58MM
            } else {
                com.spiraldine.printbridge.model.ThermalPaperWidth.WIDTH_80MM
            }

            val transport: com.spiraldine.printbridge.transport.PrinterTransport = if (config.connectionType == "Bluetooth") {
                if (config.bluetoothAddress.isBlank()) {
                    repository.setTestPrintResult(false, "ERROR: No Bluetooth printer selected. Please choose a paired device.")
                    repository.updatePrinterStatus(com.spiraldine.printbridge.model.ThermalPrinterStatus.NotConfigured)
                    return@launch
                }
                com.spiraldine.printbridge.transport.BluetoothTransport(
                    deviceAddress = config.bluetoothAddress,
                    deviceName = config.bluetoothName.ifBlank { "Bluetooth Printer" },
                    context = context
                )
            } else {
                val validationErr = com.spiraldine.printbridge.transport.NetworkTransport.validate(config.networkHost, config.networkPort)
                if (validationErr != null) {
                    repository.setTestPrintResult(false, "ERROR: $validationErr")
                    repository.updatePrinterStatus(com.spiraldine.printbridge.model.ThermalPrinterStatus.Error(validationErr))
                    return@launch
                }
                com.spiraldine.printbridge.transport.NetworkTransport(
                    host = config.networkHost,
                    port = config.networkPort
                )
            }

            val testPayload = formatter.formatTestSlip(
                paperWidth = paperWidth,
                transportInfo = transport.transportType
            )

            val result = transport.send(testPayload)
            when (result) {
                is com.spiraldine.printbridge.transport.TransportResult.Success -> {
                    val msg = "SUCCESS: Test slip accepted by printer transport (${result.bytesWritten} bytes written). Note: transport acceptance confirms socket delivery to printer buffer, not physical receipt extrusion."
                    repository.setTestPrintResult(false, msg)
                    repository.updatePrinterStatus(
                        com.spiraldine.printbridge.model.ThermalPrinterStatus.Connected(
                            deviceName = if (config.connectionType == "Bluetooth") config.bluetoothName else "${config.networkHost}:${config.networkPort}",
                            connectionType = transport.transportType,
                            paperWidthMm = config.paperWidthMm
                        )
                    )
                    repository.updateDiagnostics { diag ->
                        diag.copy(
                            lastSuccessfulEventTimestamp = System.currentTimeMillis(),
                            lastSuccessfulEventDescription = "Test slip accepted (${result.bytesWritten} bytes)",
                            latestError = null
                        )
                    }
                }
                is com.spiraldine.printbridge.transport.TransportResult.Failure -> {
                    val msg = "FAILURE: ${result.errorMessage}"
                    repository.setTestPrintResult(false, msg)
                    repository.updatePrinterStatus(
                        com.spiraldine.printbridge.model.ThermalPrinterStatus.Error(result.errorMessage)
                    )
                    repository.updateDiagnostics { diag ->
                        diag.copy(
                            latestError = result.errorMessage,
                            latestErrorTimestamp = System.currentTimeMillis()
                        )
                    }
                }
            }
        }
    }

    fun loadQueueJobs(context: android.content.Context) {
        viewModelScope.launch {
            val db = com.spiraldine.printbridge.data.local.PrintBridgeDatabase.getInstance(context)
            val jobRepo = printJobRepository ?: com.spiraldine.printbridge.data.PrintJobRepository(db.printJobDao())

            val activeTab = uiState.value.activeQueueTab
            val jobs = if (activeTab == "ALL") {
                jobRepo.getHistory(100)
            } else {
                jobRepo.getJobsByStatus(activeTab, 100)
            }
            repository.setQueueJobs(jobs)

            val pending = jobRepo.getPendingCount()
            val inFlight = jobs.count { it.status == "SENDING" }
            val printed = jobRepo.getPrintedCount()
            val lastTicket = jobs.firstOrNull { it.status == "PRINTED" }?.ticketNumber
            repository.updateQueueCounts(pending, inFlight, printed, lastTicket)

            // Update diagnostics
            val config = uiState.value.config
            val isConfigured = (config.connectionType == "Bluetooth" && config.bluetoothAddress.isNotBlank()) ||
                               (config.connectionType == "Network" && config.networkHost.isNotBlank())
            val selectedPrinter = if (config.connectionType == "Bluetooth") {
                if (config.bluetoothAddress.isNotBlank()) "${config.bluetoothName} (${config.bluetoothAddress})" else "None selected"
            } else {
                if (config.networkHost.isNotBlank()) "${config.networkHost}:${config.networkPort}" else "None selected"
            }

            val lastPrintedJob = jobs.firstOrNull { it.status == "PRINTED" }
            val lastFailedJob = jobs.firstOrNull { it.status == "FAILED" || it.status == "INTERRUPTED" }

            repository.updateDiagnostics { diag ->
                diag.copy(
                    selectedPrinterName = selectedPrinter,
                    connectionType = if (config.connectionType == "Bluetooth") "Bluetooth SPP" else "TCP/IP Raw (Port ${config.networkPort})",
                    connectionState = when (uiState.value.printerStatus) {
                        is com.spiraldine.printbridge.model.ThermalPrinterStatus.Connected -> "Connected / Ready"
                        is com.spiraldine.printbridge.model.ThermalPrinterStatus.Connecting -> "Connecting"
                        is com.spiraldine.printbridge.model.ThermalPrinterStatus.Error -> "Error: ${(uiState.value.printerStatus as com.spiraldine.printbridge.model.ThermalPrinterStatus.Error).reason}"
                        com.spiraldine.printbridge.model.ThermalPrinterStatus.NotConfigured -> "Not Configured"
                    },
                    lastSuccessfulEventTimestamp = lastPrintedJob?.lastAttemptAt ?: diag.lastSuccessfulEventTimestamp,
                    lastSuccessfulEventDescription = if (lastPrintedJob != null) {
                        "Socket write accepted for ticket ${lastPrintedJob.ticketNumber}"
                    } else diag.lastSuccessfulEventDescription,
                    latestError = lastFailedJob?.lastError ?: diag.latestError,
                    latestErrorTimestamp = lastFailedJob?.lastAttemptAt ?: diag.latestErrorTimestamp,
                    isTestPrintAvailable = isConfigured
                )
            }
        }
    }

    fun setActiveQueueTab(tab: String, context: android.content.Context) {
        repository.setActiveQueueTab(tab)
        loadQueueJobs(context)
    }

    fun retryJob(jobId: String, context: android.content.Context) {
        viewModelScope.launch {
            val db = com.spiraldine.printbridge.data.local.PrintBridgeDatabase.getInstance(context)
            val jobRepo = printJobRepository ?: com.spiraldine.printbridge.data.PrintJobRepository(db.printJobDao())
            jobRepo.retryJob(jobId, "Manual retry initiated by staff")
            loadQueueJobs(context)
        }
    }

    fun prepareAmbiguousRetry(job: com.spiraldine.printbridge.data.local.PrintJobEntity) {
        repository.setJobPendingAmbiguousConfirmation(job)
    }

    fun dismissAmbiguousRetry() {
        repository.setJobPendingAmbiguousConfirmation(null)
    }

    fun confirmAmbiguousRetry(jobId: String, context: android.content.Context) {
        viewModelScope.launch {
            val db = com.spiraldine.printbridge.data.local.PrintBridgeDatabase.getInstance(context)
            val jobRepo = printJobRepository ?: com.spiraldine.printbridge.data.PrintJobRepository(db.printJobDao())
            jobRepo.forceRetryAmbiguousJob(jobId, "Staff confirmed physical printer tray checked")
            repository.setJobPendingAmbiguousConfirmation(null)
            loadQueueJobs(context)
        }
    }

    fun requestReprint(job: com.spiraldine.printbridge.data.local.PrintJobEntity, context: android.content.Context) {
        viewModelScope.launch {
            val db = com.spiraldine.printbridge.data.local.PrintBridgeDatabase.getInstance(context)
            val jobRepo = printJobRepository ?: com.spiraldine.printbridge.data.PrintJobRepository(db.printJobDao())
            val ticket = try {
                com.spiraldine.printbridge.model.KotTicketJson.fromJson(job.payloadJson)
            } catch (_: Exception) {
                return@launch
            }
            jobRepo.enqueueReprint(ticket, "Staff requested duplicate reprint")
            loadQueueJobs(context)
        }
    }

    fun selectJobForDetails(job: com.spiraldine.printbridge.data.local.PrintJobEntity?) {
        repository.setSelectedJobForDetails(job)
    }

    fun checkExistingSession(context: android.content.Context) {
        val authStorage = com.spiraldine.printbridge.auth.AuthStorage(context)
        val session = authStorage.getSession()
        if (session != null) {
            repository.updateCloudStatus(
                com.spiraldine.printbridge.model.CloudSyncStatus.Connected(
                    tenantId = session.tenantId,
                    restaurantName = session.restaurantName
                )
            )
        } else {
            repository.updateCloudStatus(com.spiraldine.printbridge.model.CloudSyncStatus.Disconnected)
        }

        // Restore persisted printer configuration if available
        val prefs = context.getSharedPreferences("spiraldine_printer_config", android.content.Context.MODE_PRIVATE)
        val connType = prefs.getString("connection_type", "Bluetooth") ?: "Bluetooth"
        val btName = prefs.getString("bt_name", "") ?: ""
        val btAddress = prefs.getString("bt_address", "") ?: ""
        val netHost = prefs.getString("net_host", "192.168.1.100") ?: "192.168.1.100"
        val netPort = prefs.getInt("net_port", 9100)
        val station = prefs.getString("station_filter", "ALL") ?: "ALL"
        val paperWidth = prefs.getInt("paper_width", 80)

        repository.updateConfig {
            it.copy(
                connectionType = connType,
                bluetoothName = btName,
                bluetoothAddress = btAddress,
                networkHost = netHost,
                networkPort = netPort,
                targetStation = station,
                paperWidthMm = paperWidth
            )
        }
        updateStatusForConfig()
        loadQueueJobs(context)
    }

    fun signIn(
        email: String,
        password: String,
        context: android.content.Context,
        onResult: (com.spiraldine.printbridge.auth.AuthResult) -> Unit
    ) {
        viewModelScope.launch {
            repository.updateCloudStatus(com.spiraldine.printbridge.model.CloudSyncStatus.Connecting)
            val authStorage = com.spiraldine.printbridge.auth.AuthStorage(context)
            val authManager = com.spiraldine.printbridge.auth.FirebaseAuthManager(authStorage)
            val result = authManager.signIn(email, password)
            if (result is com.spiraldine.printbridge.auth.AuthResult.Success) {
                repository.updateCloudStatus(
                    com.spiraldine.printbridge.model.CloudSyncStatus.Connected(
                        tenantId = result.profile.tenantId,
                        restaurantName = result.profile.restaurantName
                    )
                )
                // Auto-start foreground service if configured
                com.spiraldine.printbridge.service.PrintBridgeForegroundService.start(context)
            } else {
                repository.updateCloudStatus(com.spiraldine.printbridge.model.CloudSyncStatus.Disconnected)
            }
            onResult(result)
        }
    }

    fun signOut(context: android.content.Context) {
        val authStorage = com.spiraldine.printbridge.auth.AuthStorage(context)
        val authManager = com.spiraldine.printbridge.auth.FirebaseAuthManager(authStorage)
        authManager.signOut()
        repository.updateCloudStatus(com.spiraldine.printbridge.model.CloudSyncStatus.Disconnected)
        com.spiraldine.printbridge.service.PrintBridgeForegroundService.stop(context)
    }

    fun startService(context: android.content.Context) {
        com.spiraldine.printbridge.service.PrintBridgeForegroundService.start(context)
    }

    fun stopService(context: android.content.Context) {
        com.spiraldine.printbridge.service.PrintBridgeForegroundService.stop(context)
    }

    private fun updateStatusForConfig() {
        val config = uiState.value.config
        if (config.connectionType == "Bluetooth") {
            if (config.bluetoothAddress.isBlank()) {
                repository.updatePrinterStatus(com.spiraldine.printbridge.model.ThermalPrinterStatus.NotConfigured)
            } else {
                repository.updatePrinterStatus(
                    com.spiraldine.printbridge.model.ThermalPrinterStatus.Connected(
                        deviceName = config.bluetoothName.ifBlank { "Bluetooth Printer" },
                        connectionType = "Bluetooth SPP",
                        paperWidthMm = config.paperWidthMm
                    )
                )
            }
        } else {
            val err = com.spiraldine.printbridge.transport.NetworkTransport.validate(config.networkHost, config.networkPort)
            if (err != null) {
                repository.updatePrinterStatus(com.spiraldine.printbridge.model.ThermalPrinterStatus.Error(err))
            } else {
                repository.updatePrinterStatus(
                    com.spiraldine.printbridge.model.ThermalPrinterStatus.Connected(
                        deviceName = "${config.networkHost}:${config.networkPort}",
                        connectionType = "TCP/IP Raw Port ${config.networkPort}",
                        paperWidthMm = config.paperWidthMm
                    )
                )
            }
        }
    }
}


