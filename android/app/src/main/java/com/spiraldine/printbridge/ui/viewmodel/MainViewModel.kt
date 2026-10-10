package com.spiraldine.printbridge.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.spiraldine.printbridge.data.PrintBridgeRepository
import com.spiraldine.printbridge.model.PrintBridgeUiState
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

class MainViewModel(
    repository: PrintBridgeRepository
) : ViewModel() {

    val uiState: StateFlow<PrintBridgeUiState> = repository.state
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = PrintBridgeUiState()
        )
}
