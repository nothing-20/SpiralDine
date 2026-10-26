package com.spiralworld.spiraldine.data.repository

import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseAuthWeakPasswordException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.spiralworld.spiraldine.data.model.CustomerProfile
import com.spiralworld.spiraldine.data.model.CustomerUser
import com.spiralworld.spiraldine.data.model.defaultNotificationPreferences
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AccountCollisionException(message: String) : Exception(message)

class AuthRepository(
    private val authProvider: () -> FirebaseAuth = { FirebaseConfig.auth },
    private val firestoreProvider: () -> FirebaseFirestore = { FirebaseConfig.firestore }
) {
    private val auth: FirebaseAuth
        get() = authProvider()

    private val firestore: FirebaseFirestore
        get() = firestoreProvider()

    constructor(auth: FirebaseAuth, firestore: FirebaseFirestore = FirebaseConfig.firestore) : this({ auth }, { firestore })

    val authState: Flow<CustomerUser?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { firebaseAuth ->
            val user = firebaseAuth.currentUser?.toCustomerUser()
            trySend(user)
        }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    val currentUser: CustomerUser?
        get() = auth.currentUser?.toCustomerUser()

    suspend fun signInAnonymously(): Result<CustomerUser> {
        return try {
            val result = auth.signInAnonymously().await()
            val user = result.user?.toCustomerUser()
                ?: return Result.failure(Exception("Anonymous login succeeded but no user was returned"))
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(mapAuthException(e))
        }
    }

    suspend fun signInWithEmail(email: String, pass: String): Result<CustomerUser> {
        val emailValidation = validateEmail(email)
        if (emailValidation.isFailure) return Result.failure(emailValidation.exceptionOrNull()!!)

        if (pass.isBlank()) {
            return Result.failure(IllegalArgumentException("Password cannot be blank."))
        }

        return try {
            val result = auth.signInWithEmailAndPassword(email.trim(), pass.trim()).await()
            val user = result.user?.toCustomerUser()
                ?: return Result.failure(Exception("Authentication succeeded but no user was returned"))
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(mapAuthException(e))
        }
    }

    suspend fun registerWithEmail(email: String, pass: String, name: String): Result<CustomerUser> {
        val emailValidation = validateEmail(email)
        if (emailValidation.isFailure) return Result.failure(emailValidation.exceptionOrNull()!!)

        val passValidation = validatePassword(pass)
        if (passValidation.isFailure) return Result.failure(passValidation.exceptionOrNull()!!)

        val nameValidation = validateName(name)
        if (nameValidation.isFailure) return Result.failure(nameValidation.exceptionOrNull()!!)

        // If currently anonymous, safely link credential to preserve the existing dining session & orders under this UID!
        if (auth.currentUser?.isAnonymous == true) {
            val linkRes = linkAnonymousAccountWithEmail(email, pass, name)
            if (linkRes.isSuccess) {
                return linkRes
            } else if (linkRes.exceptionOrNull() is AccountCollisionException) {
                return linkRes
            }
        }

        return try {
            val result = auth.createUserWithEmailAndPassword(email.trim(), pass.trim()).await()
            val firebaseUser = result.user
                ?: return Result.failure(Exception("Registration succeeded but no user was returned"))

            if (name.isNotBlank()) {
                val profileUpdates = UserProfileChangeRequest.Builder()
                    .setDisplayName(name.trim())
                    .build()
                firebaseUser.updateProfile(profileUpdates).await()
            }

            // Sync with Firestore /customers/{uid}
            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
            val profileDoc = mapOf(
                "uid" to firebaseUser.uid,
                "email" to firebaseUser.email,
                "displayName" to name.trim(),
                "isAnonymous" to false,
                "createdAt" to nowIso,
                "updatedAt" to nowIso
            )
            firestore.collection("customers").document(firebaseUser.uid)
                .set(profileDoc, SetOptions.merge())
                .await()

            Result.success(firebaseUser.toCustomerUser())
        } catch (e: Exception) {
            Result.failure(mapAuthException(e))
        }
    }

    /**
     * Safely links an email/password credential to an anonymous Firebase account.
     * Preserves the exact same UID, maintaining all active orders, basket items, and sessions.
     */
    suspend fun linkAnonymousAccountWithEmail(email: String, pass: String, name: String): Result<CustomerUser> {
        val emailValidation = validateEmail(email)
        if (emailValidation.isFailure) return Result.failure(emailValidation.exceptionOrNull()!!)

        val passValidation = validatePassword(pass)
        if (passValidation.isFailure) return Result.failure(passValidation.exceptionOrNull()!!)

        val firebaseUser = auth.currentUser
        if (firebaseUser == null || !firebaseUser.isAnonymous) {
            return Result.failure(IllegalStateException("No active guest dining account to link."))
        }

        return try {
            val credential = EmailAuthProvider.getCredential(email.trim(), pass.trim())
            val linkResult = firebaseUser.linkWithCredential(credential).await()
            val upgradedUser = linkResult.user ?: firebaseUser

            if (name.isNotBlank()) {
                val profileUpdates = UserProfileChangeRequest.Builder()
                    .setDisplayName(name.trim())
                    .build()
                upgradedUser.updateProfile(profileUpdates).await()
            }

            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
            val profileDoc = mapOf(
                "uid" to upgradedUser.uid,
                "email" to upgradedUser.email,
                "displayName" to (name.ifBlank { upgradedUser.displayName ?: "Spiral Diner" }),
                "isAnonymous" to false,
                "updatedAt" to nowIso
            )
            firestore.collection("customers").document(upgradedUser.uid)
                .set(profileDoc, SetOptions.merge())
                .await()

            Result.success(upgradedUser.toCustomerUser())
        } catch (e: Exception) {
            Result.failure(mapAuthException(e))
        }
    }

    suspend fun updateCustomerProfile(name: String, phone: String?): Result<CustomerProfile> {
        val nameValidation = validateName(name)
        if (nameValidation.isFailure) return Result.failure(nameValidation.exceptionOrNull()!!)

        val phoneValidation = validatePhone(phone)
        if (phoneValidation.isFailure) return Result.failure(phoneValidation.exceptionOrNull()!!)

        val firebaseUser = auth.currentUser
            ?: return Result.failure(IllegalStateException("No authenticated user to update."))

        return try {
            val profileUpdates = UserProfileChangeRequest.Builder()
                .setDisplayName(name.trim())
                .build()
            firebaseUser.updateProfile(profileUpdates).await()

            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
            val docUpdates = mutableMapOf<String, Any>(
                "displayName" to name.trim(),
                "updatedAt" to nowIso
            )
            if (!phone.isNullOrBlank()) {
                docUpdates["phoneNumber"] = phone.trim()
            }

            firestore.collection("customers").document(firebaseUser.uid)
                .set(docUpdates, SetOptions.merge())
                .await()

            val profile = CustomerProfile(
                uid = firebaseUser.uid,
                email = firebaseUser.email,
                displayName = name.trim(),
                phoneNumber = phone?.trim(),
                isAnonymous = firebaseUser.isAnonymous,
                updatedAt = nowIso
            )
            Result.success(profile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun getCustomerProfile(uid: String): Flow<CustomerProfile?> = callbackFlow {
        if (uid.isBlank()) {
            trySend(null)
            close()
            return@callbackFlow
        }

        val listener = firestore.collection("customers").document(uid)
            .addSnapshotListener { snapshot, _ ->
                if (snapshot != null && snapshot.exists()) {
                    val notifMap = (snapshot.get("notificationPreferences") as? Map<*, *>)?.entries?.associate {
                        it.key.toString() to (it.value as? Boolean ?: true)
                    } ?: defaultNotificationPreferences()

                    val p = CustomerProfile(
                        uid = snapshot.id,
                        email = snapshot.getString("email") ?: auth.currentUser?.email,
                        displayName = snapshot.getString("displayName") ?: auth.currentUser?.displayName,
                        phoneNumber = snapshot.getString("phoneNumber") ?: auth.currentUser?.phoneNumber,
                        isAnonymous = snapshot.getBoolean("isAnonymous") ?: (auth.currentUser?.isAnonymous == true),
                        dietaryPrefs = (snapshot.get("dietaryPrefs") as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                        allergens = (snapshot.get("allergens") as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                        preferredCuisines = (snapshot.get("preferredCuisines") as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList(),
                        diningMethod = snapshot.getString("diningMethod") ?: "Dine In",
                        isVeg = snapshot.getBoolean("isVeg") ?: false,
                        theme = snapshot.getString("theme") ?: "System",
                        language = snapshot.getString("language") ?: "English",
                        textSize = snapshot.getString("textSize") ?: "Medium",
                        notificationPreferences = notifMap,
                        isDeleted = snapshot.getBoolean("isDeleted") ?: false,
                        createdAt = snapshot.getString("createdAt"),
                        updatedAt = snapshot.getString("updatedAt")
                    )
                    trySend(p)
                } else {
                    val fallback = auth.currentUser?.let { u ->
                        CustomerProfile(
                            uid = u.uid,
                            email = u.email,
                            displayName = u.displayName,
                            phoneNumber = u.phoneNumber,
                            isAnonymous = u.isAnonymous
                        )
                    }
                    trySend(fallback)
                }
            }

        awaitClose { listener.remove() }
    }

    suspend fun updateDiningPreferences(
        dietaryPrefs: List<String>,
        allergens: List<String>,
        preferredCuisines: List<String>,
        diningMethod: String,
        isVeg: Boolean
    ): Result<Unit> {
        val user = auth.currentUser ?: return Result.failure(IllegalStateException("No authenticated user."))
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        return try {
            firestore.collection("customers").document(user.uid).set(
                mapOf(
                    "dietaryPrefs" to dietaryPrefs,
                    "allergens" to allergens,
                    "preferredCuisines" to preferredCuisines,
                    "diningMethod" to diningMethod,
                    "isVeg" to isVeg,
                    "updatedAt" to nowIso
                ),
                SetOptions.merge()
            ).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateNotificationPreferences(preferences: Map<String, Boolean>): Result<Unit> {
        val user = auth.currentUser ?: return Result.failure(IllegalStateException("No authenticated user."))
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        return try {
            firestore.collection("customers").document(user.uid).set(
                mapOf(
                    "notificationPreferences" to preferences,
                    "updatedAt" to nowIso
                ),
                SetOptions.merge()
            ).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateAppPreferences(theme: String, language: String, textSize: String): Result<Unit> {
        val user = auth.currentUser ?: return Result.failure(IllegalStateException("No authenticated user."))
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        return try {
            firestore.collection("customers").document(user.uid).set(
                mapOf(
                    "theme" to theme,
                    "language" to language,
                    "textSize" to textSize,
                    "updatedAt" to nowIso
                ),
                SetOptions.merge()
            ).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun sendPasswordResetEmail(email: String): Result<Unit> {
        val emailValidation = validateEmail(email)
        if (emailValidation.isFailure) return emailValidation

        return try {
            auth.sendPasswordResetEmail(email.trim()).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(mapAuthException(e))
        }
    }

    suspend fun deleteAccount(): Result<Unit> {
        val user = auth.currentUser ?: return Result.failure(IllegalStateException("No authenticated user to delete."))
        val uid = user.uid
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        return try {
            // Anonymize profile record to preserve order records and financial receipts for audit
            firestore.collection("customers").document(uid).set(
                mapOf(
                    "displayName" to "Deleted User",
                    "phoneNumber" to null,
                    "isDeleted" to true,
                    "deletedAt" to nowIso,
                    "updatedAt" to nowIso
                ),
                SetOptions.merge()
            ).await()

            user.delete().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(mapAuthException(e))
        }
    }

    suspend fun ensureAuthenticated(): CustomerUser {
        val current = currentUser
        if (current != null) return current
        return signInAnonymously().getOrThrow()
    }

    fun signOut() {
        auth.signOut()
    }

    private fun FirebaseUser.toCustomerUser(): CustomerUser {
        return CustomerUser(
            uid = uid,
            email = email,
            displayName = displayName ?: if (isAnonymous) "Guest Diner" else "Spiral Diner",
            isAnonymous = isAnonymous,
            phoneNumber = phoneNumber
        )
    }

    private fun mapAuthException(e: Exception): Exception {
        return when (e) {
            is FirebaseAuthUserCollisionException ->
                AccountCollisionException("This email address is already registered to an existing account. Please sign in instead.")
            is FirebaseAuthWeakPasswordException ->
                IllegalArgumentException("Password is too weak. Please use at least 6 characters.")
            is FirebaseAuthInvalidCredentialsException ->
                IllegalArgumentException("Invalid email format or incorrect password.")
            is FirebaseAuthInvalidUserException ->
                IllegalArgumentException("No account found with this email. Please register first.")
            is FirebaseNetworkException ->
                java.io.IOException("Network connection unavailable. Please check your internet connection.")
            else -> e
        }
    }

    companion object {
        fun validateEmail(email: String): Result<Unit> {
            val trimmed = email.trim()
            if (trimmed.isBlank()) {
                return Result.failure(IllegalArgumentException("Email address cannot be empty."))
            }
            if (!trimmed.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$".toRegex())) {
                return Result.failure(IllegalArgumentException("Please enter a valid email address (e.g. name@example.com)."))
            }
            return Result.success(Unit)
        }

        fun validatePassword(pass: String): Result<Unit> {
            if (pass.length < 6) {
                return Result.failure(IllegalArgumentException("Password must be at least 6 characters long."))
            }
            return Result.success(Unit)
        }

        fun validateName(name: String): Result<Unit> {
            val trimmed = name.trim()
            if (trimmed.length < 2) {
                return Result.failure(IllegalArgumentException("Name must be at least 2 characters long."))
            }
            if (trimmed.length > 60) {
                return Result.failure(IllegalArgumentException("Name cannot exceed 60 characters."))
            }
            return Result.success(Unit)
        }

        fun validatePhone(phone: String?): Result<Unit> {
            if (phone.isNullOrBlank()) return Result.success(Unit)
            val clean = phone.trim().replace(" ", "").replace("-", "")
            if (!clean.matches("^\\+?[0-9]{7,15}$".toRegex())) {
                return Result.failure(IllegalArgumentException("Please enter a valid phone number (e.g. +91 9876543210)."))
            }
            return Result.success(Unit)
        }
    }
}
