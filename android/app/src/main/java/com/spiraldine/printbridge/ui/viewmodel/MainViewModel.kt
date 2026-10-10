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

    fun setPaperWidth(widthMm: Int) {
        repository.updateConfig { it.copy(paperWidthMm = widthMm) }
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
                    val msg = "SUCCESS: Test slip accepted by printer transport (${result.bytesWritten} bytes written). Verify physical slip."
                    repository.setTestPrintResult(false, msg)
                    repository.updatePrinterStatus(
                        com.spiraldine.printbridge.model.ThermalPrinterStatus.Connected(
                            deviceName = if (config.connectionType == "Bluetooth") config.bluetoothName else "${config.networkHost}:${config.networkPort}",
                            connectionType = transport.transportType,
                            paperWidthMm = config.paperWidthMm
                        )
                    )
                }
                is com.spiraldine.printbridge.transport.TransportResult.Failure -> {
                    val msg = "FAILURE: ${result.errorMessage}"
                    repository.setTestPrintResult(false, msg)
                    repository.updatePrinterStatus(
                        com.spiraldine.printbridge.model.ThermalPrinterStatus.Error(result.errorMessage)
                    )
                }
            }
        }
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


