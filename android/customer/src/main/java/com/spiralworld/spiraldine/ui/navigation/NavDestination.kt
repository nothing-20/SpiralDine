package com.spiralworld.spiraldine.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.ui.graphics.vector.ImageVector

enum class NavDestination(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    HOME("home", "Home", Icons.Default.Home),
    EXPLORE("explore", "Explore", Icons.Default.Explore),
    QR_SCAN("qr_scan", "Scan QR", Icons.Default.QrCodeScanner),
    ORDERS("orders", "Orders", Icons.Default.ReceiptLong),
    PROFILE("profile", "Profile", Icons.Default.Person)
}
