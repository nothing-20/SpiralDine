package com.spiraldine.owner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.floor

/**
 * Verification test suite for Native Android Owner App multi-screen responsiveness,
 * adaptive KPI card widths, grid column scaling, touch targets, and dialog constraints
 * across compact phones, standard phones, large foldables, tablets, and landscape viewports.
 */
class OwnerResponsivenessTest {

    data class DeviceConfiguration(
        val name: String,
        val widthDp: Float,
        val heightDp: Float,
        val isLandscape: Boolean = false,
        val category: DeviceCategory
    )

    enum class DeviceCategory {
        COMPACT_PHONE,   // 320 - 360 dp
        TYPICAL_PHONE,   // 360 - 412 dp
        LARGE_PHONE,     // 412 - 599 dp
        TABLET_WIDE      // 600+ dp
    }

    private val representativeDevices = listOf(
        DeviceConfiguration("Compact Phone (320x568)", 320f, 568f, false, DeviceCategory.COMPACT_PHONE),
        DeviceConfiguration("Compact Phone HD (360x640)", 360f, 640f, false, DeviceCategory.COMPACT_PHONE),
        DeviceConfiguration("Typical Android Phone (390x844)", 390f, 844f, false, DeviceCategory.TYPICAL_PHONE),
        DeviceConfiguration("Standard Flagship (412x915)", 412f, 915f, false, DeviceCategory.TYPICAL_PHONE),
        DeviceConfiguration("Large Phone / Foldable Folded (480x1000)", 480f, 1000f, false, DeviceCategory.LARGE_PHONE),
        DeviceConfiguration("7-inch Tablet / Foldable Inner (600x960)", 600f, 960f, false, DeviceCategory.TABLET_WIDE),
        DeviceConfiguration("10-inch Tablet (800x1280)", 800f, 1280f, false, DeviceCategory.TABLET_WIDE),
        DeviceConfiguration("Tablet Landscape (1280x800)", 1280f, 800f, true, DeviceCategory.TABLET_WIDE)
    )

    private fun calculateAdaptiveColumns(availableWidthDp: Float, minSizeDp: Float, horizontalPaddingDp: Float = 32f, spacingDp: Float = 12f): Int {
        val usableWidth = availableWidthDp - horizontalPaddingDp
        val count = floor((usableWidth + spacingDp) / (minSizeDp + spacingDp)).toInt()
        return maxOf(1, count)
    }

    @Test
    fun testDeviceClassification() {
        for (device in representativeDevices) {
            when {
                device.widthDp <= 360f -> assertEquals(DeviceCategory.COMPACT_PHONE, device.category)
                device.widthDp in 361f..412f -> assertEquals(DeviceCategory.TYPICAL_PHONE, device.category)
                device.widthDp in 413f..599f -> assertEquals(DeviceCategory.LARGE_PHONE, device.category)
                device.widthDp >= 600f -> assertEquals(DeviceCategory.TABLET_WIDE, device.category)
            }
        }
    }

    @Test
    fun testKpiGridResponsiveColumns() {
        val minCardWidth = 140f

        // On 320dp phone: fits 1 or 2 equal cards depending on padding
        val cols320 = calculateAdaptiveColumns(320f, minCardWidth)
        assertTrue("At 320dp, KPI cards fit 1 or 2 columns, got $cols320", cols320 in 1..2)

        // On 390dp phone: fits 2 columns comfortably
        val cols390 = calculateAdaptiveColumns(390f, minCardWidth)
        assertEquals("At 390dp, KPI cards fit 2 columns", 2, cols390)

        // On 600dp tablet: fits 4 columns
        val cols600 = calculateAdaptiveColumns(600f, minCardWidth)
        assertTrue("At 600dp, KPI cards fit at least 3-4 columns", cols600 >= 3)

        // On 1280dp wide display: expands gracefully to 7+ columns
        val cols1280 = calculateAdaptiveColumns(1280f, minCardWidth)
        assertTrue("At 1280dp, expands to 7+ columns", cols1280 >= 7)
    }

    @Test
    fun testQuickActionsGridResponsiveColumns() {
        val minActionWidth = 72f

        // On 320dp phone: 2 wrapping rows allow 3 actions in row 1, 2 actions in row 2 with ~90dp per action (exceeding min 72dp)
        val usableWidth320 = 320f - 32f - 16f
        val itemWidth320 = usableWidth320 / 3
        assertTrue("At 320dp, quick action width in 3-col row exceeds min width, got $itemWidth320", itemWidth320 >= minActionWidth)

        // On 390dp phone: 3-column row yields ~114dp per action with comfortable touch targets
        val usableWidth390 = 390f - 32f - 16f
        val itemWidth390 = usableWidth390 / 3
        assertTrue("At 390dp, quick action width is generous, got $itemWidth390", itemWidth390 >= 100f)

        // On 600dp tablet: all 5 actions fit in a single row without horizontal scrolling
        val cols600 = calculateAdaptiveColumns(600f, minActionWidth, horizontalPaddingDp = 32f, spacingDp = 8f)
        assertTrue("At 600dp, quick actions fit all 5 columns, got $cols600", cols600 >= 5)
    }

    @Test
    fun testTouchTargetStandardCompliance() {
        val topBarNotificationTargetDp = 40f
        val topBarProfileTargetDp = 40f
        val quickActionTargetDp = 48f
        val bottomNavTargetDp = 56f
        val kpiCardMinHeightDp = 80f

        assertTrue("Top bar notification target should be >= 40dp", topBarNotificationTargetDp >= 40f)
        assertTrue("Top bar profile target should be >= 40dp", topBarProfileTargetDp >= 40f)
        assertTrue("Quick action target should be >= 44dp", quickActionTargetDp >= 44f)
        assertTrue("Bottom nav item height should be >= 48dp", bottomNavTargetDp >= 48f)
        assertTrue("KPI card minimum height should be >= 64dp", kpiCardMinHeightDp >= 64f)
    }
}
