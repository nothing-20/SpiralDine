package com.spiraldine.printbridge

import android.app.Application
import com.spiraldine.printbridge.auth.FirebaseAuthManager

/**
 * Android Application entry point for the SpiralDine Print Bridge.
 * Initializes Firebase programmatically for the process before any
 * activities, services, or broadcast receivers access Firebase APIs.
 */
class PrintBridgeApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        FirebaseAuthManager.initializeFirebase(this)
    }
}
