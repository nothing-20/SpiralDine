package com.spiraldine.printbridge.model

/**
 * Represents the connection status of the bridge to the SpiralDine cloud.
 */
sealed interface CloudSyncStatus {
    data object Disconnected : CloudSyncStatus
    data object Connecting : CloudSyncStatus
    data class Connected(
        val tenantId: String,
        val restaurantName: String,
        val activeBranch: String = "Main"
    ) : CloudSyncStatus
}

/**
 * Represents the physical or network connection status to the thermal printer.
 */
sealed interface ThermalPrinterStatus {
    data object NotConfigured : ThermalPrinterStatus
    data class Connecting(val deviceName: String) : ThermalPrinterStatus
    data class Connected(
        val deviceName: String,
        val connectionType: String, // "Bluetooth SPP", "TCP/IP Network", "USB OTG"
        val paperWidthMm: Int = 80
    ) : ThermalPrinterStatus
    data class Error(val reason: String) : ThermalPrinterStatus
}

/**
 * Represents the state of the persistent local and remote print queue.
 */
data class PrintQueueStatus(
    val pendingCount: Int = 0,
    val inFlightCount: Int = 0,
    val totalPrintedToday: Int = 0,
    val lastPrintedTicketNumber: String? = null,
    val lastPrintTimestamp: Long? = null
)

/**
 * Represents hardware and station filtering configuration.
 */
data class PrinterHardwareConfig(
    val connectionType: String = "Bluetooth", // "Bluetooth" or "Network"
    val bluetoothAddress: String = "",
    val bluetoothName: String = "",
    val networkHost: String = "192.168.1.100",
    val networkPort: Int = 9100,
    val targetStation: String = "ALL", // "ALL", "GRILL", "FRYER", "DESSERT", "BAR", "GENERAL"
    val paperWidthMm: Int = 80,
    val autoCutEnabled: Boolean = true
)

/**
 * Comprehensive runtime diagnostics for physical and network printers.
 * Never interprets a socket opening as proof of physical paper output.
 */
data class PrinterDiagnostics(
    val selectedPrinterName: String = "None",
    val connectionType: String = "None",
    val connectionState: String = "Not Configured",
    val lastSuccessfulEventTimestamp: Long? = null,
    val lastSuccessfulEventDescription: String? = null,
    val latestError: String? = null,
    val latestErrorTimestamp: Long? = null,
    val isTestPrintAvailable: Boolean = false
)

/**
 * Consolidated UI State for the Print Bridge Dashboard.
 */
data class PrintBridgeUiState(
    val cloudStatus: CloudSyncStatus = CloudSyncStatus.Disconnected,
    val printerStatus: ThermalPrinterStatus = ThermalPrinterStatus.NotConfigured,
    val queueStatus: PrintQueueStatus = PrintQueueStatus(),
    val config: PrinterHardwareConfig = PrinterHardwareConfig(),
    val diagnostics: PrinterDiagnostics = PrinterDiagnostics(),
    val testPrintMessage: String? = null,
    val isTestPrintInProgress: Boolean = false,
    val queueJobs: List<com.spiraldine.printbridge.data.local.PrintJobEntity> = emptyList(),
    val activeQueueTab: String = "ALL",
    val selectedJobForDetails: com.spiraldine.printbridge.data.local.PrintJobEntity? = null,
    val jobPendingAmbiguousConfirmation: com.spiraldine.printbridge.data.local.PrintJobEntity? = null
)

