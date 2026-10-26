package com.spiralworld.spiraldine.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.spiralworld.spiraldine.data.repository.QrParser
import com.spiralworld.spiraldine.theme.CardBorder
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.SurfaceWhite
import com.spiralworld.spiraldine.theme.TextPrimary
import com.spiralworld.spiraldine.theme.TextSecondary
import java.util.concurrent.Executors

@Composable
fun QrScannerScreen(
    onTableScanned: (tenantId: String, tableNumber: String) -> Unit,
    onClose: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        )
    }

    var isTorchOn by remember { mutableStateOf(false) }
    var camera by remember { mutableStateOf<Camera?>(null) }
    var hasProcessedCode by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var showManualDialog by remember { mutableStateOf(false) }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) {
            errorMessage = "Camera permission is needed to scan restaurant table QR codes."
        }
    }

    LaunchedEffect(Unit) {
        if (!hasCameraPermission) {
            permissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    var invalidQrMessage by remember { mutableStateOf<String?>(null) }
    var lastInvalidTimestamp by remember { mutableStateOf(0L) }

    DisposableEffect(invalidQrMessage) {
        if (invalidQrMessage != null) {
            val handler = android.os.Handler(android.os.Looper.getMainLooper())
            val runnable = Runnable { invalidQrMessage = null }
            handler.postDelayed(runnable, 3500)
            onDispose { handler.removeCallbacks(runnable) }
        } else {
            onDispose {}
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        if (hasCameraPermission) {
            // CameraX Viewfinder
            AndroidView(
                factory = { ctx ->
                    val previewView = PreviewView(ctx).apply {
                        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                    }
                    val cameraExecutor = Executors.newSingleThreadExecutor()
                    val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)

                    cameraProviderFuture.addListener({
                        try {
                            val cameraProvider = cameraProviderFuture.get()
                            val preview = Preview.Builder().build().also {
                                it.setSurfaceProvider(previewView.surfaceProvider)
                            }

                            val options = com.google.mlkit.vision.barcode.BarcodeScannerOptions.Builder()
                                .setBarcodeFormats(com.google.mlkit.vision.barcode.common.Barcode.FORMAT_QR_CODE)
                                .build()
                            val scanner = BarcodeScanning.getClient(options)

                            val imageAnalysis = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()

                            imageAnalysis.setAnalyzer(cameraExecutor) { imageProxy ->
                                val mediaImage = imageProxy.image
                                if (mediaImage != null && !hasProcessedCode) {
                                    val inputImage = InputImage.fromMediaImage(
                                        mediaImage,
                                        imageProxy.imageInfo.rotationDegrees
                                    )
                                    scanner.process(inputImage)
                                        .addOnSuccessListener { barcodes ->
                                            for (barcode in barcodes) {
                                                val rawValue = barcode.rawValue
                                                if (rawValue.isNullOrBlank()) continue
                                                val parsed = QrParser.parse(rawValue)
                                                if (parsed != null) {
                                                    if (!hasProcessedCode) {
                                                        hasProcessedCode = true
                                                        android.util.Log.d("QrScannerScreen", "Recognized valid table QR [tenant=${parsed.tenantId}, table=${parsed.tableNumber}]")
                                                        onTableScanned(parsed.tenantId, parsed.tableNumber)
                                                    }
                                                    break
                                                } else {
                                                    val now = System.currentTimeMillis()
                                                    if (now - lastInvalidTimestamp > 2500) {
                                                        lastInvalidTimestamp = now
                                                        invalidQrMessage = "Not a recognized SpiralDine table QR."
                                                    }
                                                }
                                            }
                                        }
                                        .addOnFailureListener { e ->
                                            android.util.Log.w("QrScannerScreen", "Barcode processing error: ${e.message}")
                                        }
                                        .addOnCompleteListener {
                                            imageProxy.close()
                                        }
                                } else {
                                    imageProxy.close()
                                }
                            }

                            cameraProvider.unbindAll()
                            val boundCamera = cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageAnalysis
                            )
                            camera = boundCamera

                            // Synchronize torch state observer
                            boundCamera.cameraInfo.torchState.observe(lifecycleOwner) { state ->
                                isTorchOn = (state == androidx.camera.core.TorchState.ON)
                            }
                        } catch (e: Exception) {
                            errorMessage = "Unable to initialize camera scanner: ${e.message}"
                        }
                    }, ContextCompat.getMainExecutor(ctx))

                    previewView
                },
                modifier = Modifier.fillMaxSize()
            )

            // Scanning Overlay Frame
            androidx.compose.foundation.layout.BoxWithConstraints(
                modifier = androidx.compose.ui.Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                val reticleSize = minOf(maxWidth * 0.72f, maxHeight * 0.52f, 260.dp)
                Box(
                    modifier = androidx.compose.ui.Modifier
                        .size(reticleSize)
                        .border(2.5.dp, SpiralDineOrange, RoundedCornerShape(24.dp))
                        .background(Color.Transparent)
                )
            }
        } else {
            // Permission denied fallback view
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.QrCodeScanner,
                    contentDescription = null,
                    tint = SpiralDineOrange,
                    modifier = Modifier.size(64.dp)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Camera Access Required",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Spiral Dine uses the camera to scan table QR codes so you can view the menu and order food.",
                    fontSize = 12.sp,
                    color = Color.White.copy(alpha = 0.8f),
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(20.dp))
                Button(
                    onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange)
                ) {
                    Text("Grant Permission", fontWeight = FontWeight.Bold)
                }
            }
        }

        // Top Bar (Close and Flashlight) with Safe Status Bar Insets
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(top = 10.dp, start = 16.dp, end = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.6f))
                    .clickable { onClose() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Close",
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }

            Text(
                text = "Scan Table QR",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            // Torch Toggle with accessible touch target
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(Color.Black.copy(alpha = 0.6f))
                    .clickable {
                        camera?.let { cam ->
                            if (cam.cameraInfo.hasFlashUnit()) {
                                isTorchOn = !isTorchOn
                                cam.cameraControl.enableTorch(isTorchOn)
                            }
                        }
                    },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isTorchOn) Icons.Default.FlashOff else Icons.Default.FlashOn,
                    contentDescription = "Flash",
                    tint = if (isTorchOn) SpiralDineOrange else Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }
        }

        // Invalid QR Feedback Banner
        if (!invalidQrMessage.isNullOrBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(bottom = 90.dp, start = 24.dp, end = 24.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFFDC2626).copy(alpha = 0.9f))
                        .padding(horizontal = 16.dp, vertical = 10.dp)
                ) {
                    Text(
                        text = invalidQrMessage!!,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        // Bottom Manual Entry Button with safe insets
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 28.dp),
            contentAlignment = Alignment.Center
        ) {
            Row(
                modifier = Modifier
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color.Black.copy(alpha = 0.7f))
                    .border(1.dp, Color.White.copy(alpha = 0.3f), RoundedCornerShape(24.dp))
                    .clickable { showManualDialog = true }
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Keyboard,
                    contentDescription = "Manual Entry",
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
                Text(
                    text = "Enter Table Details Manually",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }
    }

    // Manual Entry Dialog Fallback with Scrollable Content for Keyboard Accessibility
    if (showManualDialog) {
        var manualTenant by remember { mutableStateOf("") }
        var manualTable by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { showManualDialog = false },
            title = {
                Text(
                    text = "Manual Table Entry",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 16.sp
                )
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Enter your restaurant identifier and table number:",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                    OutlinedTextField(
                        value = manualTenant,
                        onValueChange = { manualTenant = it },
                        label = { Text("Restaurant ID") },
                        placeholder = { Text("e.g. spiral-diner") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = manualTable,
                        onValueChange = { manualTable = it },
                        label = { Text("Table Number") },
                        placeholder = { Text("e.g. 1") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (manualTenant.isNotBlank()) {
                            showManualDialog = false
                            onTableScanned(manualTenant.trim(), manualTable.trim().ifBlank { "1" })
                        }
                    },
                    enabled = manualTenant.isNotBlank(),
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange)
                ) {
                    Text("Go to Menu")
                }
            },
            dismissButton = {
                TextButton(onClick = { showManualDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}
