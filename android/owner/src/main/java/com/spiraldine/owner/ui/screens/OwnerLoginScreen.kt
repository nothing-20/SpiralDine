package com.spiraldine.owner.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.repository.FirebaseConfig
import com.spiraldine.owner.theme.*

@Composable
fun OwnerLoginScreen(
    onLoginSuccess: (uid: String) -> Unit
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    // Forgot Password Dialog state
    var showForgotDialog by remember { mutableStateOf(false) }
    var resetEmail by remember { mutableStateOf("") }
    var isResetSending by remember { mutableStateOf(false) }
    var resetSuccessMessage by remember { mutableStateOf<String?>(null) }
    var resetErrorMessage by remember { mutableStateOf<String?>(null) }

    val scrollState = rememberScrollState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundLight)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .imePadding()
                .padding(horizontal = 24.dp, vertical = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // SpiralDine Brand Logo
            Surface(
                modifier = Modifier.size(64.dp),
                shape = RoundedCornerShape(20.dp),
                color = TerracottaOrange
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Default.Restaurant,
                        contentDescription = "Logo",
                        tint = SurfaceWhite,
                        modifier = Modifier.size(36.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Spiral", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = TextPrimary)
                Text("Dine", fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, color = TerracottaOrange)
            }

            Surface(
                color = TerracottaOrangeLight,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.padding(top = 8.dp)
            ) {
                Text(
                    "Restaurant Owner Portal",
                    color = TerracottaOrange,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text("Welcome Back", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                    Text("Sign in to your restaurant workspace", fontSize = 12.sp, color = TextSecondary)

                    if (!errorMessage.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Surface(
                            color = ErrorRedLight,
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = errorMessage!!,
                                color = ErrorRed,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                modifier = Modifier.padding(10.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = email,
                        onValueChange = {
                            email = it
                            errorMessage = null
                        },
                        label = { Text("Email Address") },
                        leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = TextMuted) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = password,
                        onValueChange = {
                            password = it
                            errorMessage = null
                        },
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = TextMuted) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    // Forgot Password hyperlink
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                        TextButton(
                            onClick = {
                                resetEmail = email.trim()
                                resetSuccessMessage = null
                                resetErrorMessage = null
                                showForgotDialog = true
                            }
                        ) {
                            Text(
                                "Forgot password?",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = TerracottaOrange
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = {
                            if (email.isBlank() || password.isBlank()) {
                                errorMessage = "Please enter both email and password."
                                return@Button
                            }
                            isLoading = true
                            errorMessage = null
                            try {
                                FirebaseConfig.auth.signInWithEmailAndPassword(email.trim(), password)
                                    .addOnSuccessListener { authResult ->
                                        isLoading = false
                                        val uid = authResult.user?.uid
                                        if (uid != null) {
                                            onLoginSuccess(uid)
                                        } else {
                                            errorMessage = "Authenticated user session missing."
                                        }
                                    }
                                    .addOnFailureListener { ex ->
                                        isLoading = false
                                        errorMessage = ex.localizedMessage ?: "Invalid email or password."
                                    }
                            } catch (e: Exception) {
                                isLoading = false
                                errorMessage = e.localizedMessage ?: "Authentication service unavailable."
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .defaultMinSize(minHeight = 48.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                        enabled = !isLoading
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(color = SurfaceWhite, modifier = Modifier.size(20.dp))
                        } else {
                            Text("Sign In to Dashboard", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }
            }
        }
    }

    // Password Reset Dialog
    if (showForgotDialog) {
        AlertDialog(
            onDismissRequest = {
                if (!isResetSending) showForgotDialog = false
            },
            title = { Text("Reset Password", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Enter your account email to receive a password recovery link.", fontSize = 13.sp, color = TextSecondary)
                    OutlinedTextField(
                        value = resetEmail,
                        onValueChange = { resetEmail = it },
                        label = { Text("Email Address") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(10.dp),
                        singleLine = true
                    )
                    if (!resetSuccessMessage.isNullOrBlank()) {
                        Text(resetSuccessMessage!!, color = SuccessGreen, fontSize = 12.sp)
                    }
                    if (!resetErrorMessage.isNullOrBlank()) {
                        Text(resetErrorMessage!!, color = ErrorRed, fontSize = 12.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (resetEmail.isBlank()) {
                            resetErrorMessage = "Please enter an email address."
                            return@Button
                        }
                        isResetSending = true
                        resetErrorMessage = null
                        resetSuccessMessage = null
                        try {
                            FirebaseConfig.auth.sendPasswordResetEmail(resetEmail.trim())
                                .addOnSuccessListener {
                                    isResetSending = false
                                    resetSuccessMessage = "Reset link sent! Check your inbox."
                                }
                                .addOnFailureListener { ex ->
                                    isResetSending = false
                                    resetErrorMessage = ex.localizedMessage ?: "Failed to send reset email."
                                }
                        } catch (e: Exception) {
                            isResetSending = false
                            resetErrorMessage = e.localizedMessage ?: "Error sending reset email."
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                    enabled = !isResetSending
                ) {
                    if (isResetSending) {
                        CircularProgressIndicator(color = SurfaceWhite, modifier = Modifier.size(16.dp))
                    } else {
                        Text("Send Reset Link")
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showForgotDialog = false },
                    enabled = !isResetSending
                ) {
                    Text("Close")
                }
            }
        )
    }
}
