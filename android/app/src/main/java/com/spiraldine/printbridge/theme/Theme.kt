package com.spiraldine.printbridge.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = SpiralAmberLight,
    onPrimary = Slate900,
    primaryContainer = SpiralAmberDark,
    onPrimaryContainer = Color.White,
    secondary = Slate400,
    background = Slate900,
    surface = Slate800,
    onBackground = Slate100,
    onSurface = Slate100
)

private val LightColorScheme = lightColorScheme(
    primary = SpiralAmberPrimary,
    onPrimary = Color.White,
    primaryContainer = SpiralAmberLight,
    onPrimaryContainer = Slate900,
    secondary = Slate600,
    background = Slate100,
    surface = Color.White,
    onBackground = Slate900,
    onSurface = Slate900
)

@Composable
fun SpiralDinePrintBridgeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            window?.let {
                it.statusBarColor = colorScheme.background.toArgb()
                WindowCompat.getInsetsController(it, view).isAppearanceLightStatusBars = !darkTheme
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
