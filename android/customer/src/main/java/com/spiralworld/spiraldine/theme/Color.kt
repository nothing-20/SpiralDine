package com.spiralworld.spiraldine.theme

import androidx.compose.ui.graphics.Color

// SpiralDine White Theme with Modern Green Palette
val PrimaryGreen = Color(0xFF16A34A)       // Primary brand green
val DeepGreen = Color(0xFF166534)          // Strong green headings & selected states
val LightGreen = Color(0xFFF0FDF4)         // Soft green promotional bg & subtle highlights
val MainBackground = Color(0xFFFFFFFF)     // Clean pure white application background
val CardBackground = Color(0xFFFFFFFF)     // Pure white cards and surfaces
val PrimaryText = Color(0xFF111827)        // High-contrast primary text
val SecondaryText = Color(0xFF6B7280)      // Supporting metadata & labels
val TerracottaAccent = Color(0xFFF97316)   // Highlight orange accent
val BorderColor = Color(0xFFE5E7EB)        // Subtle neutral card & divider border
val OpenStatusColor = Color(0xFF16A34A)    // Open restaurant indicator
val ClosedStatusColor = Color(0xFFEF4444)  // Closed restaurant indicator

// UI Surface & Semantic Tokens (Preserving compatibility)
val WarmBackground = MainBackground
val SurfaceWhite = CardBackground
val SurfaceMuted = LightGreen
val CardBorder = BorderColor

val SpiralDineGreen = PrimaryGreen
val SpiralDineOrange = TerracottaAccent
val SpiralOrange = TerracottaAccent
val SpiralDineOrangeDark = DeepGreen
val SpiralDineOrangeLight = LightGreen
val SpiralDineAccent = TerracottaAccent

val TextPrimary = PrimaryText
val TextSecondary = SecondaryText
val TextTertiary = Color(0xFF9CA3AF)

val VegGreen = Color(0xFF16A34A)
val NonVegRed = ClosedStatusColor
val NonVegRedBg = Color(0xFFFEF2F2)
val StarGold = Color(0xFFF59E0B)
val SuccessGreen = OpenStatusColor
val SuccessGreenBg = LightGreen
val ChipSelected = PrimaryGreen
val ChipUnselected = CardBackground

