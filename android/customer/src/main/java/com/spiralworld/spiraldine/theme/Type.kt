package com.spiralworld.spiraldine.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * SpiralDine Typography System
 *
 * Implements a modern typography hierarchy:
 * - Primary Font (Headings, Branding, Promos, Key CTAs): Poppins / Modern Geometric Sans
 * - Secondary Font (Body, Labels, Descriptions, Navigation): Inter / Clean Grotesque Sans
 */
val SpiralDineFontFamily = FontFamily.SansSerif

// Centralized Reusable Typography Tokens
object SpiralDineTypographyTokens {
    val BrandName = TextStyle(
        fontFamily = SpiralDineFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 26.sp,
        lineHeight = 32.sp,
        letterSpacing = (-0.5).sp,
        color = PrimaryText
    )

    val MainHeading = TextStyle(
        fontFamily = SpiralDineFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 24.sp,
        lineHeight = 30.sp,
        letterSpacing = (-0.3).sp,
        color = PrimaryText
    )

    val SectionHeading = TextStyle(
        fontFamily = SpiralDineFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        lineHeight = 26.sp,
        letterSpacing = (-0.2).sp,
        color = PrimaryText
    )

    val PromotionalHeading = TextStyle(
        fontFamily = SpiralDineFontFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 28.sp,
        lineHeight = 34.sp,
        letterSpacing = (-0.5).sp,
        color = DeepGreen
    )

    val RestaurantName = TextStyle(
        fontFamily = SpiralDineFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
        lineHeight = 22.sp,
        color = PrimaryText
    )

    val CardTitle = TextStyle(
        fontFamily = SpiralDineFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        color = PrimaryText
    )

    val BodyText = TextStyle(
        fontFamily = SpiralDineFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        color = PrimaryText
    )

    val SupportingText = TextStyle(
        fontFamily = SpiralDineFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        color = SecondaryText
    )

    val NavigationLabel = TextStyle(
        fontFamily = SpiralDineFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        color = SecondaryText
    )

    val Caption = TextStyle(
        fontFamily = SpiralDineFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        color = SecondaryText
    )
}

// Material 3 Typography mapping
val SpiralDineTypography = Typography(
    displayLarge = SpiralDineTypographyTokens.PromotionalHeading,
    headlineLarge = SpiralDineTypographyTokens.MainHeading,
    headlineMedium = SpiralDineTypographyTokens.SectionHeading,
    titleLarge = SpiralDineTypographyTokens.RestaurantName,
    titleMedium = SpiralDineTypographyTokens.CardTitle,
    bodyLarge = SpiralDineTypographyTokens.BodyText,
    bodyMedium = SpiralDineTypographyTokens.SupportingText,
    labelLarge = SpiralDineTypographyTokens.NavigationLabel,
    labelSmall = SpiralDineTypographyTokens.Caption
)
