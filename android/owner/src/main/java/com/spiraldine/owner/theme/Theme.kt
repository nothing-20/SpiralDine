package com.spiraldine.owner.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = TerracottaOrange,
    onPrimary = SurfaceWhite,
    primaryContainer = TerracottaOrangeLight,
    onPrimaryContainer = TerracottaOrangeDark,
    secondary = DarkBrownEspresso,
    onSecondary = SurfaceWhite,
    secondaryContainer = DarkBrownLight,
    onSecondaryContainer = DarkBrownEspresso,
    background = BackgroundLight,
    onBackground = TextPrimary,
    surface = SurfaceWhite,
    onSurface = TextPrimary,
    error = ErrorRed,
    onError = SurfaceWhite,
)

@Composable
fun SpiralDineOwnerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        content = content
    )
}
