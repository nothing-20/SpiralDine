package com.spiralworld.spiraldine.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = PrimaryGreen,
    onPrimary = CardBackground,
    primaryContainer = LightGreen,
    onPrimaryContainer = DeepGreen,
    secondary = TerracottaAccent,
    onSecondary = CardBackground,
    background = MainBackground,
    onBackground = PrimaryText,
    surface = CardBackground,
    onSurface = PrimaryText,
    surfaceVariant = LightGreen,
    onSurfaceVariant = SecondaryText,
    outline = BorderColor
)

@Composable
fun SpiralDineTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = SpiralDineTypography,
        content = content
    )
}
