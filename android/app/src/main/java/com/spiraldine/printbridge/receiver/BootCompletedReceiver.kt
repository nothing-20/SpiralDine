package com.spiraldine.printbridge.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.spiraldine.printbridge.auth.AuthStorage
import com.spiraldine.printbridge.service.PrintBridgeForegroundService

/**
 * BroadcastReceiver triggered when device boot completes.
 * Safely recovers the Print Bridge service if previously paired and configured.
 */
class BootCompletedReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED &&
            intent?.action != "android.intent.action.QUICKBOOT_POWERON") {
            return
        }

        com.spiraldine.printbridge.auth.FirebaseAuthManager.initializeFirebase(context)
        val authStorage = AuthStorage(context)

        // Only start if user has authenticated and auto-start is enabled
        if (authStorage.isAutoStartEnabled() && authStorage.getSession() != null) {
            try {
                PrintBridgeForegroundService.start(context)
            } catch (_: Exception) {
                // Graceful fallback if OEM background execution limits prevent immediate start
            }
        }
    }
}
