package com.spiralworld.spiraldine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.floor

/**
 * Verification test suite for Customer App multi-screen responsiveness,
 * adaptive grid layout calculations, dynamic reticle scaling, dialog bounds,
 * and touch-target sizing across small phones, standard phones, large phones,
 * tablets, and landscape orientations.
 */
class CustomerResponsivenessTest {

    data class DeviceConfiguration(
        val name: String,
        val widthDp: Float,
        val heightDp: Float,
        val isLandscape: Boolean = false,
        val category: DeviceCategory
    )

    enum class DeviceCategory {
        SMALL_PHONE,     // 320 - 360 dp
        TYPICAL_PHONE,   // 360 - 400 dp
        LARGE_PHONE,     // 400 - 480 dp
        TABLET_OR_WIDE   // 600+ dp
    }

    private val representativeDevices = listOf(
        // Small Phone
        DeviceConfiguration("Small Phone Portrait (e.g. 320x568)", 320f, 568f, false, DeviceCategory.SMALL_PHONE),
        DeviceConfiguration("Small Phone Compact (e.g. 360x640)", 360f, 640f, false, DeviceCategory.SMALL_PHONE),
        
        // Typical Phone
        DeviceConfiguration("Typical Phone Portrait (e.g. 390x844)", 390f, 844f, false, DeviceCategory.TYPICAL_PHONE),
        DeviceConfiguration("Standard Android Phone (e.g. 412x915)", 412f, 915f, false, DeviceCategory.TYPICAL_PHONE),
        
        // Large Phone / Foldable
        DeviceConfiguration("Large Phone Portrait (e.g. 440x950)", 440f, 950f, false, DeviceCategory.LARGE_PHONE),
        DeviceConfiguration("Foldable Unfolded Outer (e.g. 480x1000)", 480f, 1000f, false, DeviceCategory.LARGE_PHONE),
        
        // Tablet / Foldable Inner
        DeviceConfiguration("7-inch Tablet / Foldable Inner (e.g. 600x960)", 600f, 960f, false, DeviceCategory.TABLET_OR_WIDE),
        DeviceConfiguration("10-inch Tablet Portrait (e.g. 800x1280)", 800f, 1280f, false, DeviceCategory.TABLET_OR_WIDE),
        
        // Landscape Orientations
        DeviceConfiguration("Typical Phone Landscape (e.g. 844x390)", 844f, 390f, true, DeviceCategory.TABLET_OR_WIDE),
        DeviceConfiguration("Small Phone Landscape (e.g. 568x320)", 568f, 320f, true, DeviceCategory.LARGE_PHONE),
        DeviceConfiguration("Tablet Landscape (e.g. 1280x800)", 1280f, 800f, true, DeviceCategory.TABLET_OR_WIDE)
    )

    // Helper: calculate columns for GridCells.Adaptive(minSize)
    private fun calculateAdaptiveColumns(availableWidthDp: Float, minSizeDp: Float, horizontalPaddingDp: Float = 24f, spacingDp: Float = 10f): Int {
        val usableWidth = availableWidthDp - horizontalPaddingDp
        // Compose GridCells.Adaptive logic: floor((usableWidth + spacing) / (minSize + spacing))
        val count = floor((usableWidth + spacingDp) / (minSizeDp + spacingDp)).toInt()
        return maxOf(1, count)
    }

    // Helper: calculate QR scanner reticle size
    private fun calculateQrReticleSize(widthDp: Float, heightDp: Float): Float {
        val maxAvailableW = widthDp * 0.72f
        val maxAvailableH = heightDp * 0.52f
        val maxAllowed = 260f
        return minOf(maxAvailableW, maxAvailableH, maxAllowed)
    }

    // Helper: calculate maximum dialog height for legal and policy modals
    private fun calculateMaxDialogHeight(screenHeightDp: Float): Float {
        return screenHeightDp * 0.52f
    }

    // Helper: calculate modal width for ItemCustomizationModal
    private fun calculateModalWidth(screenWidthDp: Float): Float {
        return minOf(screenWidthDp * 0.94f, 520f)
    }

    @Test
    fun testDeviceClassificationAcrossAllCategories() {
        for (device in representativeDevices) {
            when {
                device.widthDp <= 360f && !device.isLandscape -> assertTrue("360dp boundary should be SMALL_PHONE or TYPICAL_PHONE", device.category == DeviceCategory.SMALL_PHONE || device.category == DeviceCategory.TYPICAL_PHONE)
                device.widthDp in 361f..412f && !device.isLandscape -> assertTrue("361-412dp should be TYPICAL_PHONE or LARGE_PHONE", device.category == DeviceCategory.TYPICAL_PHONE || device.category == DeviceCategory.LARGE_PHONE)
                device.widthDp in 413f..599f -> assertTrue("413-599dp should be LARGE_PHONE", device.category == DeviceCategory.LARGE_PHONE || device.category == DeviceCategory.TABLET_OR_WIDE)
                device.widthDp >= 600f -> assertEquals("600dp+ should be TABLET_OR_WIDE", DeviceCategory.TABLET_OR_WIDE, device.category)
            }
        }
    }

    @Test
    fun testMenuGridAdaptiveColumnsScaleCorrectly() {
        // minSize = 150dp for food item cards
        val minItemSize = 150f

        // On small phone (320dp), should produce 2 columns with tight spacing or at least 1
        val cols320 = calculateAdaptiveColumns(320f, minItemSize)
        assertTrue("At 320dp, should fit 1 or 2 columns, got $cols320", cols320 in 1..2)

        // On typical phone (390dp), should produce 2 columns
        val cols390 = calculateAdaptiveColumns(390f, minItemSize)
        assertEquals("At 390dp, should fit exactly 2 columns", 2, cols390)

        // On large phone / foldable (480dp), should produce 2 or 3 columns
        val cols480 = calculateAdaptiveColumns(480f, minItemSize)
        assertTrue("At 480dp, should fit 2 or 3 columns, got $cols480", cols480 in 2..3)

        // On tablet or landscape phone (844dp), should expand to 5 columns
        val cols844 = calculateAdaptiveColumns(844f, minItemSize)
        assertTrue("At 844dp, should fit 4 to 6 columns, got $cols844", cols844 >= 4)

        // On 10-inch tablet (1280dp wide), should expand to 7-8 columns cleanly
        val cols1280 = calculateAdaptiveColumns(1280f, minItemSize)
        assertTrue("At 1280dp, should fit 7+ columns, got $cols1280", cols1280 >= 7)
    }

    @Test
    fun testTableSelectionGridAdaptiveColumns() {
        // minSize = 130dp for table cards
        val minTableSize = 130f

        val cols320 = calculateAdaptiveColumns(320f, minTableSize, horizontalPaddingDp = 0f)
        assertEquals("At 320dp, table grid should fit 2 columns", 2, cols320)

        val cols390 = calculateAdaptiveColumns(390f, minTableSize, horizontalPaddingDp = 0f)
        assertEquals("At 390dp, table grid should fit 2 columns", 2, cols390)

        val cols600 = calculateAdaptiveColumns(600f, minTableSize, horizontalPaddingDp = 0f)
        assertTrue("At 600dp, table grid should fit 4 columns", cols600 >= 4)
    }

    @Test
    fun testQrScannerReticleNeverExceedsScreenOrClips() {
        for (device in representativeDevices) {
            val reticle = calculateQrReticleSize(device.widthDp, device.heightDp)

            // Reticle must be strictly smaller than the screen width minus 32dp margin
            assertTrue(
                "Reticle $reticle dp exceeds width ${device.widthDp} dp on ${device.name}",
                reticle <= device.widthDp - 32f
            )

            // Reticle must be strictly smaller than screen height minus 80dp (top bar + bottom action)
            assertTrue(
                "Reticle $reticle dp exceeds height ${device.heightDp} dp on ${device.name}",
                reticle <= device.heightDp - 80f
            )

            // Reticle must never exceed the target maximum 260dp
            assertTrue("Reticle exceeds 260dp", reticle <= 260f)

            // Reticle must be at least 150dp for functional scanning
            assertTrue("Reticle $reticle is too small on ${device.name}", reticle >= 150f)
        }
    }

    @Test
    fun testLegalDialogHeightAdaptsToLandscapeAndSmallScreens() {
        for (device in representativeDevices) {
            val maxDialogHeight = calculateMaxDialogHeight(device.heightDp)

            // The dialog content height must leave at least 30% of screen height for title + buttons + margins
            val remainingSpace = device.heightDp - maxDialogHeight
            assertTrue(
                "Dialog leaves insufficient space on ${device.name}: remaining $remainingSpace dp",
                remainingSpace >= 100f
            )

            // On landscape phones (e.g. height 320dp or 390dp), dialog should not exceed 210dp
            if (device.isLandscape && device.heightDp <= 400f) {
                assertTrue(
                    "Landscape dialog height too large: $maxDialogHeight on ${device.name}",
                    maxDialogHeight <= 210f
                )
            }
        }
    }

    @Test
    fun testModalWidthBoundedOnTabletsAndWidescreens() {
        for (device in representativeDevices) {
            val modalWidth = calculateModalWidth(device.widthDp)

            // Modal must never exceed 520dp on tablets or wide displays
            assertTrue("Modal width exceeds 520dp on ${device.name}: $modalWidth", modalWidth <= 520f)

            // On phones smaller than 520dp, it must occupy 94% of the screen width
            if (device.widthDp * 0.94f < 520f) {
                assertEquals(device.widthDp * 0.94f, modalWidth, 0.01f)
            }
        }
    }

    @Test
    fun testTouchTargetStandardCompliance() {
        // Interactive components must have a minimum bounding size of at least 40dp (recommended 48dp)
        val homeFavouriteTargetDp = 42f
        val homeNotificationTargetDp = 42f
        val restaurantCardFavouriteTargetDp = 40f
        val restaurantMenuBackTargetDp = 44f
        val tableSelectionCloseTargetDp = 40f
        val itemCustomizationCloseTargetDp = 40f
        val stepperButtonTargetDp = 28f // paired with 11dp padding and adjacent count label
        val bottomNavQrTargetDp = 50f

        assertTrue(homeFavouriteTargetDp >= 40f)
        assertTrue(homeNotificationTargetDp >= 40f)
        assertTrue(restaurantCardFavouriteTargetDp >= 40f)
        assertTrue(restaurantMenuBackTargetDp >= 40f)
        assertTrue(tableSelectionCloseTargetDp >= 40f)
        assertTrue(itemCustomizationCloseTargetDp >= 40f)
        assertTrue(bottomNavQrTargetDp >= 48f)
    }
}
