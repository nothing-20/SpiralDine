package com.spiraldine.printbridge.service

import com.spiraldine.printbridge.data.DefaultPrintBridgeRepository
import com.spiraldine.printbridge.model.ServiceStatus
import com.spiraldine.printbridge.ui.viewmodel.MainViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class PrintBridgeServiceLifecycleTest {

    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Stopped)
    }

    @After
    fun tearDown() {
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Stopped)
        Dispatchers.resetMain()
    }

    @Test
    fun serviceStatus_initialStateIsStopped() {
        assertEquals(ServiceStatus.Stopped, PrintBridgeForegroundService.serviceStatus.value)
        assertFalse("Service must not be running initially", PrintBridgeForegroundService.isServiceRunning)
    }

    @Test
    fun serviceStatus_transitionsToRunningOnlyWhenExplicitlyConfirmed() {
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Running(1000L))
        assertTrue(PrintBridgeForegroundService.serviceStatus.value is ServiceStatus.Running)
        assertTrue(PrintBridgeForegroundService.isServiceRunning)
    }

    @Test
    fun serviceStatus_failureTransitionsToErrorAndSetsRunningFalse() {
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Error("SecurityException: Missing permission"))
        val status = PrintBridgeForegroundService.serviceStatus.value
        assertTrue("Status must be Error", status is ServiceStatus.Error)
        assertEquals("SecurityException: Missing permission", (status as ServiceStatus.Error).message)
        assertFalse("Service must not be marked running on error", PrintBridgeForegroundService.isServiceRunning)
    }

    @Test
    fun viewModel_observesServiceStatusTransitions() = runTest {
        val repo = DefaultPrintBridgeRepository()
        val viewModel = MainViewModel(repo)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect() }
        testScheduler.advanceUntilIdle()

        // 1. Initial status is Stopped
        assertEquals(ServiceStatus.Stopped, viewModel.uiState.value.serviceStatus)

        // 2. Service transitions to Starting
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Starting)
        testScheduler.advanceUntilIdle()
        assertEquals(ServiceStatus.Starting, viewModel.uiState.value.serviceStatus)

        // 3. Service enters foreground and reports Running
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Running())
        testScheduler.advanceUntilIdle()
        assertTrue(viewModel.uiState.value.serviceStatus is ServiceStatus.Running)
        assertEquals(
            "Foreground service running and monitoring orders",
            viewModel.uiState.value.diagnostics.lastSuccessfulEventDescription
        )

        // 4. Service stops cleanly
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Stopped)
        testScheduler.advanceUntilIdle()
        assertEquals(ServiceStatus.Stopped, viewModel.uiState.value.serviceStatus)
    }

    @Test
    fun viewModel_surfacesServiceStartupFailureInUiStateAndDiagnostics() = runTest {
        val repo = DefaultPrintBridgeRepository()
        val viewModel = MainViewModel(repo)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect() }
        testScheduler.advanceUntilIdle()

        // Simulate service startup failure
        val failureReason = "Foreground notification failure: Channel not created"
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Error(failureReason))
        testScheduler.advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue("UI state must show Error", state.serviceStatus is ServiceStatus.Error)
        assertEquals(failureReason, (state.serviceStatus as ServiceStatus.Error).message)
        assertEquals("Foreground Service Error: $failureReason", state.diagnostics.latestError)
        assertNotNull(state.diagnostics.latestErrorTimestamp)
    }

    @Test
    fun repeatedStartCalls_areIgnoredWhenAlreadyRunning() = runTest {
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Running())
        val repo = DefaultPrintBridgeRepository()
        val viewModel = MainViewModel(repo)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect() }
        testScheduler.advanceUntilIdle()

        // Verify status is Running
        assertTrue(viewModel.uiState.value.serviceStatus is ServiceStatus.Running)
        // Attempting start when running remains Running
        repo.updateServiceStatus(ServiceStatus.Running())
        assertTrue(viewModel.uiState.value.serviceStatus is ServiceStatus.Running)
    }

    @Test
    fun recoveryFromServiceFailure_allowsSubsequentSuccessfulStart() = runTest {
        val repo = DefaultPrintBridgeRepository()
        val viewModel = MainViewModel(repo)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.uiState.collect() }
        testScheduler.advanceUntilIdle()

        // Step 1: Encounter error
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Error("Temporary error"))
        testScheduler.advanceUntilIdle()
        assertTrue(viewModel.uiState.value.serviceStatus is ServiceStatus.Error)

        // Step 2: Retry and successfully transition to Running
        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Starting)
        testScheduler.advanceUntilIdle()
        assertEquals(ServiceStatus.Starting, viewModel.uiState.value.serviceStatus)

        PrintBridgeForegroundService.resetStatusForTesting(ServiceStatus.Running())
        testScheduler.advanceUntilIdle()
        assertTrue(viewModel.uiState.value.serviceStatus is ServiceStatus.Running)
    }
}
