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
 * - Verifies that the authenticated user possesses an assigned tenantId and authorized staff role.
 * - Rejects inactive or suspended staff accounts (matching Web StaffLogin).
 * - Rejects diner/customer accounts.
 * - Adapts to verified schema supporting both tenantId and legacy restaurantId fields.
 * - Enforces explicit printing permissions if configured on the employee profile.
 */
class FirebaseAuthManager(
    private val authStorage: AuthStorage,
    private val context: Context? = null,
    private val authProvider: () -> FirebaseAuth = {
        context?.let { initializeFirebase(it) }
        FirebaseAuth.getInstance()
    },
    private val firestoreProvider: () -> FirebaseFirestore = {
        context?.let { initializeFirebase(it) }
        FirebaseFirestore.getInstance()
    }
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

        val ALLOWED_PRINT_PERMISSIONS = setOf(
            "full-access", "operational-access", "kitchen-only", "waiter-only",
            "print-access", "printing", "kitchen", "waiter", "all"
        )

        /**
         * Initializes FirebaseApp programmatically if not already initialized.
         * Thread-safe and idempotent.
         */
        @Synchronized
        fun initializeFirebase(context: Context): FirebaseApp {
            val existing = FirebaseApp.getApps(context).firstOrNull()
            if (existing != null) {
                return existing
            }
            val options = FirebaseOptions.Builder()
                .setApiKey(API_KEY)
                .setProjectId(PROJECT_ID)
                .setApplicationId(APPLICATION_ID)
                .setStorageBucket(STORAGE_BUCKET)
                .build()
            return FirebaseApp.initializeApp(context.applicationContext, options)
        }
    }

    /**
     * Authoritatively validates staff profile and permissions.
     */
    fun validateStaffAuthorization(
        uid: String,
        email: String,
        rawRole: String?,
        rawTenantId: String?,
        status: String = "active",
        canPrintExplicit: Boolean? = null,
        permissionsList: List<String>? = null,
        restaurantName: String = "SpiralDine Restaurant"
    ): AuthResult {
        // 1. Profile existence check
        if (rawRole.isNullOrBlank() && rawTenantId.isNullOrBlank()) {
            return AuthResult.Error(
                "Account verified, but no staff profile is associated with this account. Please contact restaurant management."
            )
        }

        // 2. Active status check (matches Web StaffLogin.tsx line 98)
        val normalizedStatus = status.trim().lowercase()
        if (normalizedStatus == "inactive" || normalizedStatus == "suspended" || normalizedStatus == "archived") {
            return AuthResult.Error(
                "Your staff account is currently inactive or suspended. Contact your administrator."
            )
        }

        // 3. Role validation & diner isolation (matches Web StaffLogin.tsx line 107)
        val normalizedRole = (rawRole ?: "").trim().lowercase().replace("-", "_")
        if (normalizedRole == "customer") {
            return AuthResult.Error(
                "This account is registered as a diner account. Staff credentials required to operate Print Bridge."
            )
        }

        val isRoleAllowed = AUTHORIZED_ROLES.contains(normalizedRole) || 
                            AUTHORIZED_ROLES.contains((rawRole ?: "").trim().lowercase())
        if (!isRoleAllowed) {
            return AuthResult.Error(
                "Role '${rawRole ?: "unknown"}' is not authorized to operate the Kitchen Print Bridge. Kitchen, waiter, or management role required."
            )
        }

        // 4. Restaurant tenant association check (matches Web roleResolver.ts lines 114-116)
        val tenantId = rawTenantId?.trim()
        if (tenantId.isNullOrBlank()) {
            return AuthResult.Error(
                "Account is not assigned to an active restaurant workspace. Access denied."
            )
        }

        // 5. Explicit printing permission checks (Phase 2 Rule 7 & 8)
        if (canPrintExplicit == false) {
            return AuthResult.Error(
                "This employee account does not have permission to operate the Print Bridge. Contact your administrator."
            )
        }

        if (permissionsList != null && permissionsList.isNotEmpty()) {
            val hasValidPerm = permissionsList.any { perm ->
                ALLOWED_PRINT_PERMISSIONS.contains(perm.trim().lowercase())
            }
            if (!hasValidPerm) {
                return AuthResult.Error(
                    "Account permissions do not permit operating the Print Bridge. Contact your administrator."
                )
            }
        }

        val profile = StaffProfile(
            uid = uid,
            email = email,
            tenantId = tenantId,
            role = rawRole ?: "waiter",
            restaurantName = restaurantName
        )

        return AuthResult.Success(profile)
    }

    /**
     * Resolves staff authorization from Firestore document data (with fallback to employees collection).
     */
    fun resolveProfileFromUserData(
        uid: String,
        email: String,
        userData: Map<String, Any?>?,
        employeeData: Map<String, Any?>? = null,
        restaurantName: String = "SpiralDine Restaurant"
    ): AuthResult {
        val sourceData = if (userData != null && (userData["role"] != null || userData["tenantId"] != null || userData["restaurantId"] != null)) {
            userData
        } else {
            employeeData
        }

        if (sourceData == null) {
            return AuthResult.Error(
                "Account verified, but no staff profile is associated with this account. Please contact restaurant management."
            )
        }

        val rawRole = sourceData["role"] as? String
        val rawTenantId = (sourceData["tenantId"] as? String)?.takeIf { it.isNotBlank() }
            ?: (sourceData["restaurantId"] as? String)?.takeIf { it.isNotBlank() }
        val status = sourceData["status"] as? String ?: "active"
        val canPrintExplicit = (sourceData["canPrint"] as? Boolean)
            ?: (sourceData["printingEnabled"] as? Boolean)
            ?: (sourceData["printAccess"] as? Boolean)
        val permissionsList = (sourceData["permissions"] as? List<*>)?.filterIsInstance<String>()

        val result = validateStaffAuthorization(
            uid = uid,
            email = email,
            rawRole = rawRole,
            rawTenantId = rawTenantId,
            status = status,
            canPrintExplicit = canPrintExplicit,
            permissionsList = permissionsList,
            restaurantName = restaurantName
        )

        if (result is AuthResult.Success) {
            authStorage.saveSession(result.profile)
        }

        return result
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

            // 2. Fetch User Profile Document from users/{uid}
            var userData: Map<String, Any?>? = null
            try {
                val userDoc = firestore.collection("users").document(user.uid).get().await()
                if (userDoc.exists()) {
                    userData = userDoc.data
                }
            } catch (_: Exception) {
                // Non-fatal; continue to fallback check
            }

            // 3. Fallback: check employees collection by firebaseUid (matches Web roleResolver.ts lines 235-248)
            var employeeData: Map<String, Any?>? = null
            if (userData == null || (userData["role"] == null && userData["tenantId"] == null && userData["restaurantId"] == null)) {
                try {
                    val empQuery = firestore.collection("employees")
                        .whereEqualTo("firebaseUid", user.uid)
                        .get()
                        .await()
                    if (!empQuery.isEmpty) {
                        employeeData = empQuery.documents.first().data
                    }
                } catch (_: Exception) {
                    // Non-fatal
                }
            }

            // 4. Resolve Restaurant Display Name
            val rawTenantId = (userData?.get("tenantId") as? String)?.takeIf { it.isNotBlank() }
                ?: (userData?.get("restaurantId") as? String)?.takeIf { it.isNotBlank() }
                ?: (employeeData?.get("tenantId") as? String)?.takeIf { it.isNotBlank() }
                ?: (employeeData?.get("restaurantId") as? String)?.takeIf { it.isNotBlank() }

            var restaurantName = "SpiralDine Restaurant"
            if (!rawTenantId.isNullOrBlank()) {
                try {
                    val restDoc = firestore.collection("restaurants").document(rawTenantId).get().await()
                    if (restDoc.exists()) {
                        restaurantName = restDoc.getString("name") 
                            ?: restDoc.getString("restaurantName") 
                            ?: restaurantName
                    }
                } catch (_: Exception) {
                    // Non-fatal; fallback to default
                }
            }

            // 5. Evaluate authorization authoritatively
            val result = resolveProfileFromUserData(
                uid = user.uid,
                email = user.email ?: trimmedEmail,
                userData = userData,
                employeeData = employeeData,
                restaurantName = restaurantName
            )

            if (result is AuthResult.Error) {
                auth.signOut()
            }

            result
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
