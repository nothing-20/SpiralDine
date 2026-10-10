package com.spiraldine.printbridge

import com.spiraldine.printbridge.data.DefaultPrintBridgeRepository
import com.spiraldine.printbridge.model.CloudSyncStatus
import com.spiraldine.printbridge.model.ThermalPrinterStatus
import com.spiraldine.printbridge.ui.viewmodel.MainViewModel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PrintBridgeInitialStateTest {

    @Test
    fun repository_initialState_isStrictlyTruthfulAndDisconnected() {
        val repo = DefaultPrintBridgeRepository()
        val state = repo.state.value

        assertEquals(CloudSyncStatus.Disconnected, state.cloudStatus)
        assertEquals(ThermalPrinterStatus.NotConfigured, state.printerStatus)
        assertEquals(0, state.queueStatus.pendingCount)
        assertEquals(0, state.queueStatus.inFlightCount)
        assertEquals(0, state.queueStatus.totalPrintedToday)
        assertNull(state.queueStatus.lastPrintedTicketNumber)
    }

    @Test
    fun viewModel_emitsInitialTruthfulState() = runTest {
        val repo = DefaultPrintBridgeRepository()
        val viewModel = MainViewModel(repo)
        val state = viewModel.uiState.first()

        assertTrue(state.cloudStatus is CloudSyncStatus.Disconnected)
        assertTrue(state.printerStatus is ThermalPrinterStatus.NotConfigured)
        assertEquals(80, state.config.paperWidthMm)
        assertEquals("ALL", state.config.targetStation)
    }
}
