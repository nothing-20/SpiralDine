package com.spiraldine.owner

import android.app.Application
import android.util.Log
import com.spiraldine.owner.data.repository.FirebaseConfig

class SpiralDineOwnerApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        try {
            FirebaseConfig.initialize(this)
        } catch (e: Exception) {
            Log.e("OwnerApp", "Firebase initialization warning in Application.onCreate", e)
        }
    }
}
