package com.spiraldine.printbridge.transport

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.content.Context

/**
 * Metadata for a bonded Bluetooth device.
 */
data class BluetoothDeviceInfo(
    val name: String,
    val address: String,
    val isLikelyPrinter: Boolean = false
)

object BluetoothDeviceHelper {

    /**
     * Lists paired Bluetooth devices on this phone.
     * Safely handles permissions and filters devices likely to be thermal printers.
     */
    fun getBondedDevices(context: Context): List<BluetoothDeviceInfo> {
        if (!BluetoothTransport.hasBluetoothPermission(context)) {
            return emptyList()
        }

        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return emptyList()
        if (!adapter.isEnabled) return emptyList()

        return try {
            val bonded = adapter.bondedDevices ?: return emptyList()
            bonded.map { device ->
                val name = try { device.name ?: "Unknown Device" } catch (_: SecurityException) { "Unknown Device" }
                val address = device.address
                val isPrinter = isLikelyThermalPrinter(device, name)
                BluetoothDeviceInfo(name, address, isPrinter)
            }.sortedWith(
                compareByDescending<BluetoothDeviceInfo> { it.isLikelyPrinter }
                    .thenBy { it.name }
            )
        } catch (_: SecurityException) {
            emptyList()
        }
    }

    /**
     * Heuristic to determine if a Bluetooth device is likely an ESC/POS thermal printer.
     */
    fun isLikelyThermalPrinter(device: BluetoothDevice, name: String): Boolean {
        val upperName = name.uppercase()
        val printerKeywords = listOf("POS", "PRINT", "PRINTER", "RP", "MTP", "THERMAL", "BT-", "TSP", "STAR", "EPSON", "SUNMI", "RONGTA", "XP-")
        if (printerKeywords.any { upperName.contains(it) }) {
            return true
        }

        return try {
            val deviceClass = device.bluetoothClass
            if (deviceClass != null) {
                val major = deviceClass.majorDeviceClass
                major == BluetoothClass.Device.Major.IMAGING || major == BluetoothClass.Device.Major.UNCATEGORIZED
            } else {
                false
            }
        } catch (_: SecurityException) {
            false
        }
    }
}
