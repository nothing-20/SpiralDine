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
    fun updateConfig(update: (com.spiraldine.printbridge.model.PrinterHardwareConfig) -> com.spiraldine.printbridge.model.PrinterHardwareConfig)
    fun updatePrinterStatus(status: ThermalPrinterStatus)
    fun updateCloudStatus(status: CloudSyncStatus)
    fun setTestPrintResult(inProgress: Boolean, message: String?)
    fun updateQueueCounts(pending: Int, inFlight: Int, printed: Int, lastTicket: String?)
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

    override fun updateConfig(update: (com.spiraldine.printbridge.model.PrinterHardwareConfig) -> com.spiraldine.printbridge.model.PrinterHardwareConfig) {
        _state.value = _state.value.copy(config = update(_state.value.config))
    }

    override fun updatePrinterStatus(status: ThermalPrinterStatus) {
        _state.value = _state.value.copy(printerStatus = status)
    }

    override fun updateCloudStatus(status: CloudSyncStatus) {
        _state.value = _state.value.copy(cloudStatus = status)
    }

    override fun setTestPrintResult(inProgress: Boolean, message: String?) {
        _state.value = _state.value.copy(
            isTestPrintInProgress = inProgress,
            testPrintMessage = message
        )
    }

    override fun updateQueueCounts(pending: Int, inFlight: Int, printed: Int, lastTicket: String?) {
        _state.value = _state.value.copy(
            queueStatus = _state.value.queueStatus.copy(
                pendingCount = pending,
                inFlightCount = inFlight,
                totalPrintedToday = printed,
                lastPrintedTicketNumber = lastTicket ?: _state.value.queueStatus.lastPrintedTicketNumber
            )
        )
    }
}

