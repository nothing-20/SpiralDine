package com.spiraldine.printbridge.data

import com.spiraldine.printbridge.model.CloudSyncStatus
import com.spiraldine.printbridge.model.PrintBridgeUiState
import com.spiraldine.printbridge.model.PrintQueueStatus
import com.spiraldine.printbridge.model.ThermalPrinterStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

interface PrintBridgeRepository {
    val state: StateFlow<PrintBridgeUiState>
}

class DefaultPrintBridgeRepository : PrintBridgeRepository {
    private val _state = MutableStateFlow(
        PrintBridgeUiState(
            cloudStatus = CloudSyncStatus.Disconnected,
            printerStatus = ThermalPrinterStatus.NotConfigured,
            queueStatus = PrintQueueStatus(
                pendingCount = 0,
                inFlightCount = 0,
                totalPrintedToday = 0,
                lastPrintedTicketNumber = null
            )
        )
    )

    override val state: StateFlow<PrintBridgeUiState> = _state.asStateFlow()
}
