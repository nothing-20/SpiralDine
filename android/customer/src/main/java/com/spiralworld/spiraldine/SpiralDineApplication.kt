package com.spiralworld.spiraldine

import android.app.Application
import android.util.Log
import com.spiralworld.spiraldine.data.repository.FirebaseConfig
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter

/**
 * Application entry point for Spiral Dine Native Android Customer App.
 * Initializes Firebase programmatically for com.spiralworld.spiraldine
 * before any activity, service, or background task accesses Firestore or Auth.
 * Installs global crash diagnostics to record and log any uncaught exceptions.
 */
class SpiralDineApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // Install resilient crash diagnostic handler
        val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                val sw = StringWriter()
                throwable.printStackTrace(PrintWriter(sw))
                val stackTrace = sw.toString()

                Log.e("SpiralDineCrash", "FATAL CRASH in thread ${thread.name}: ${throwable.message}\n$stackTrace")

                // Persist crash log locally for on-device diagnostics
                try {
                    val crashFile = File(filesDir, "spiraldine_last_crash.txt")
                    crashFile.writeText("Time: ${System.currentTimeMillis()}\nThread: ${thread.name}\nException: ${throwable.javaClass.name}\nMessage: ${throwable.message}\n\n$stackTrace")
                } catch (_: Exception) {}
            } catch (_: Exception) {}

            previousHandler?.uncaughtException(thread, throwable)
        }

        try {
            FirebaseConfig.initialize(this)
        } catch (e: Exception) {
            Log.e("SpiralDineApplication", "Failed to initialize Firebase in Application.onCreate", e)
        }
    }
}
