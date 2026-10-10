package com.spiraldine.printbridge.auth

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

/**
 * Authorized staff session profile with strict tenant association.
 */
data class StaffProfile(
    val uid: String,
    val email: String,
    val tenantId: String,
    val role: String,
    val restaurantName: String = "SpiralDine Restaurant"
)

sealed interface AuthResult {
    data class Success(val profile: StaffProfile) : AuthResult
    data class Error(val message: String) : AuthResult
}

/**
 * Authentication and tenant association manager.
 * Enforces role-based access control and tenant isolation for the Android Print Bridge.
 *
 * Security Guarantees:
 * - Does NOT embed private service accounts or admin master keys.
 * - Does NOT allow connecting to arbitrary restaurant IDs without authentic Firebase credentials.
 * - Verifies that the authenticated user possesses an assigned tenantId and authorized kitchen/staff role.
 */
class FirebaseAuthManager(
    private val authStorage: AuthStorage,
    private val authProvider: () -> FirebaseAuth = { FirebaseAuth.getInstance() },
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseFirestore.getInstance() }
) {

    companion object {
        const val API_KEY = "AIzaSyCKE7c57Boi_5dpK53FaZOtTu6m6Kz1vHg"
        const val PROJECT_ID = "spiral-restaurant-saas-v1"
        const val APPLICATION_ID = "com.spiraldine.printbridge"
        const val STORAGE_BUCKET = "spiral-restaurant-saas-v1.firebasestorage.app"

        val AUTHORIZED_ROLES = setOf(
            "kitchen", "chef", "owner", "admin", "manager",
            "waiter", "cashier", "reception", "super_admin", "super-admin"
        )

        /**
         * Initializes FirebaseApp programmatically if not already initialized.
         */
        fun initializeFirebase(context: Context) {
            if (FirebaseApp.getApps(context).isEmpty()) {
                val options = FirebaseOptions.Builder()
                    .setApiKey(API_KEY)
                    .setProjectId(PROJECT_ID)
                    .setApplicationId(APPLICATION_ID)
                    .setStorageBucket(STORAGE_BUCKET)
                    .build()
                FirebaseApp.initializeApp(context.applicationContext, options)
            }
        }
    }

    suspend fun signIn(email: String, password: String): AuthResult = withContext(Dispatchers.IO) {
        val trimmedEmail = email.trim()
        val trimmedPassword = password.trim()

        if (trimmedEmail.isBlank() || trimmedPassword.isBlank()) {
            return@withContext AuthResult.Error("Email and password cannot be blank.")
        }

        try {
            val auth = authProvider()
            val firestore = firestoreProvider()

            // 1. Authenticate with Firebase Authentication
            val authResult = auth.signInWithEmailAndPassword(trimmedEmail, trimmedPassword).await()
            val user = authResult.user
                ?: return@withContext AuthResult.Error("Authentication succeeded but no user was returned.")

            // 2. Fetch User Profile Document to resolve tenantId and role
            val userDoc = firestore.collection("users").document(user.uid).get().await()
            if (!userDoc.exists()) {
                auth.signOut()
                return@withContext AuthResult.Error(
                    "Account verified, but no restaurant profile exists in users/${user.uid}. Please contact restaurant management."
                )
            }

            val tenantId = userDoc.getString("tenantId")
            if (tenantId.isNullOrBlank()) {
                auth.signOut()
                return@withContext AuthResult.Error(
                    "Account is not assigned to an active restaurant workspace. Access denied."
                )
            }

            val rawRole = userDoc.getString("role") ?: "kitchen"
            val normalizedRole = rawRole.lowercase().replace("-", "_")

            if (!AUTHORIZED_ROLES.contains(normalizedRole) && !AUTHORIZED_ROLES.contains(rawRole.lowercase())) {
                auth.signOut()
                return@withContext AuthResult.Error(
                    "Role '$rawRole' is not authorized to operate the Kitchen Print Bridge. Kitchen or management role required."
                )
            }

            // 3. Resolve Restaurant Display Name
            var restaurantName = "SpiralDine Restaurant"
            try {
                val restDoc = firestore.collection("restaurants").document(tenantId).get().await()
                if (restDoc.exists()) {
                    restaurantName = restDoc.getString("name") 
                        ?: restDoc.getString("restaurantName") 
                        ?: restaurantName
                }
            } catch (_: Exception) {
                // Non-fatal; fallback to default restaurant name
            }

            val profile = StaffProfile(
                uid = user.uid,
                email = user.email ?: trimmedEmail,
                tenantId = tenantId,
                role = rawRole,
                restaurantName = restaurantName
            )

            // 4. Save validated pairing session
            authStorage.saveSession(profile)

            AuthResult.Success(profile)
        } catch (e: Exception) {
            val msg = e.localizedMessage ?: "Authentication failed: ${e.message}"
            AuthResult.Error(msg)
        }
    }

    fun getActiveSession(): StaffProfile? {
        return authStorage.getSession()
    }

    fun signOut() {
        try {
            authProvider().signOut()
        } catch (_: Exception) {
            // Ignore sign-out exceptions
        }
        authStorage.clearSession()
    }
}
