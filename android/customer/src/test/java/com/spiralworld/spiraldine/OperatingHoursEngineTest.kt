package com.spiralworld.spiraldine

import com.spiralworld.spiraldine.data.model.BusinessHours
import com.spiralworld.spiraldine.data.repository.OpenStatus
import com.spiralworld.spiraldine.data.repository.OperatingHoursEngine
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

class OperatingHoursEngineTest {

    private val utcTz = TimeZone.getTimeZone("UTC")

    private fun createUtcTimestamp(dayOfWeek: Int, hour24: Int, minute: Int): Long {
        val cal = Calendar.getInstance(utcTz).apply {
            set(Calendar.YEAR, 2026)
            set(Calendar.MONTH, Calendar.OCTOBER)
            set(Calendar.DAY_OF_MONTH, 18) // Oct 18, 2026 is a Sunday (dayOfWeek 1)
        }
        // Adjust day of week
        val currentDow = cal.get(Calendar.DAY_OF_WEEK)
        val diff = dayOfWeek - currentDow
        cal.add(Calendar.DAY_OF_MONTH, diff)
        cal.set(Calendar.HOUR_OF_DAY, hour24)
        cal.set(Calendar.MINUTE, minute)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    @Test
    fun testStandardDaytime_whenDuringOpenHours_returnsOpen() {
        val hours = BusinessHours(
            openingTime = "09:00",
            closingTime = "22:00",
            workingDays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
        )

        // Monday 14:30 UTC
        val monday2pm = createUtcTimestamp(Calendar.MONDAY, 14, 30)
        val status = OperatingHoursEngine.getStatus(hours, "UTC", monday2pm)

        assertTrue(status is OpenStatus.Open)
        assertEquals("Open until 10 PM", (status as OpenStatus.Open).label)
        assertTrue(OperatingHoursEngine.isOpenNow(hours, "UTC", monday2pm))
    }

    @Test
    fun testStandardDaytime_whenBeforeOpenHours_returnsClosedWithOpeningTime() {
        val hours = BusinessHours(
            openingTime = "09:00",
            closingTime = "22:00",
            workingDays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
        )

        // Monday 07:45 UTC
        val mondayMorning = createUtcTimestamp(Calendar.MONDAY, 7, 45)
        val status = OperatingHoursEngine.getStatus(hours, "UTC", mondayMorning)

        assertTrue(status is OpenStatus.Closed)
        assertEquals("Closed • Opens at 9 AM", (status as OpenStatus.Closed).label)
        assertFalse(OperatingHoursEngine.isOpenNow(hours, "UTC", mondayMorning))
    }

    @Test
    fun testStandardDaytime_whenAfterCloseHours_returnsClosed() {
        val hours = BusinessHours(
            openingTime = "09:00",
            closingTime = "22:00",
            workingDays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
        )

        // Monday 22:30 UTC
        val mondayNight = createUtcTimestamp(Calendar.MONDAY, 22, 30)
        val status = OperatingHoursEngine.getStatus(hours, "UTC", mondayNight)

        assertTrue(status is OpenStatus.Closed)
        assertFalse(OperatingHoursEngine.isOpenNow(hours, "UTC", mondayNight))
    }

    @Test
    fun testOvernightShift_whenInEvening_returnsOpen() {
        // Opens 18:00 (6 PM) and closes 02:00 AM next day
        val hours = BusinessHours(
            openingTime = "18:00",
            closingTime = "02:00",
            workingDays = listOf("Fri", "Sat")
        )

        // Friday 21:00 UTC (evening of open day)
        val fridayNight = createUtcTimestamp(Calendar.FRIDAY, 21, 0)
        val status = OperatingHoursEngine.getStatus(hours, "UTC", fridayNight)

        assertTrue(status is OpenStatus.Open)
        assertEquals("Open until 2 AM", (status as OpenStatus.Open).label)
        assertTrue(OperatingHoursEngine.isOpenNow(hours, "UTC", fridayNight))
    }

    @Test
    fun testOvernightShift_whenEarlyMorningNextDay_returnsOpenAsContinuation() {
        // Opens 18:00 (6 PM) and closes 02:00 AM next day.
        // Friday is working day, so Friday's shift extends into Saturday 00:00 - 02:00.
        val hours = BusinessHours(
            openingTime = "18:00",
            closingTime = "02:00",
            workingDays = listOf("Fri")
        )

        // Saturday 01:15 UTC (continuation from Friday night)
        val saturdayEarlyMorning = createUtcTimestamp(Calendar.SATURDAY, 1, 15)
        val status = OperatingHoursEngine.getStatus(hours, "UTC", saturdayEarlyMorning)

        assertTrue("Should be Open during Friday's overnight continuation into Saturday morning", status is OpenStatus.Open)
        assertEquals("Open until 2 AM", (status as OpenStatus.Open).label)
    }

    @Test
    fun testOvernightShift_whenEarlyMorningAndYesterdayWasClosed_returnsClosed() {
        // Only Saturday is working day.
        val hours = BusinessHours(
            openingTime = "18:00",
            closingTime = "02:00",
            workingDays = listOf("Sat")
        )

        // Saturday 01:15 UTC: Friday was NOT a working day, so 01:15 is before Saturday's 18:00 start!
        val saturdayEarlyMorning = createUtcTimestamp(Calendar.SATURDAY, 1, 15)
        val status = OperatingHoursEngine.getStatus(hours, "UTC", saturdayEarlyMorning)

        assertTrue(status is OpenStatus.Closed)
        assertFalse(OperatingHoursEngine.isOpenNow(hours, "UTC", saturdayEarlyMorning))
    }

    @Test
    fun testClosedDay_returnsClosedToday() {
        val hours = BusinessHours(
            openingTime = "10:00",
            closingTime = "22:00",
            workingDays = listOf("Tue", "Wed", "Thu", "Fri", "Sat", "Sun") // Monday closed
        )

        // Monday 12:00 UTC
        val mondayNoon = createUtcTimestamp(Calendar.MONDAY, 12, 0)
        val status = OperatingHoursEngine.getStatus(hours, "UTC", mondayNoon)

        assertTrue(status is OpenStatus.Closed)
        assertTrue((status as OpenStatus.Closed).isClosedToday)
        assertEquals("Closed today", status.label)
        assertFalse(OperatingHoursEngine.isOpenNow(hours, "UTC", mondayNoon))
    }

    @Test
    fun testMissingOrNullHours_returnsUnknownAndNeverClaimsOpen() {
        // 1. Completely null businessHours
        val nullStatus = OperatingHoursEngine.getStatus(null)
        assertTrue(nullStatus is OpenStatus.Unknown)
        assertEquals("Hours unavailable", nullStatus.label)
        assertFalse(OperatingHoursEngine.isOpenNow(null))

        // 2. Blank opening time
        val blankOpenHours = BusinessHours(openingTime = "", closingTime = "22:00")
        assertTrue(OperatingHoursEngine.getStatus(blankOpenHours) is OpenStatus.Unknown)
        assertFalse(OperatingHoursEngine.isOpenNow(blankOpenHours))

        // 3. Null closing time
        val nullCloseHours = BusinessHours(openingTime = "10:00", closingTime = null)
        assertTrue(OperatingHoursEngine.getStatus(nullCloseHours) is OpenStatus.Unknown)
        assertFalse(OperatingHoursEngine.isOpenNow(nullCloseHours))
    }

    @Test
    fun testExplicitHoliday_returnsClosedToday() {
        val hours = BusinessHours(
            openingTime = "09:00",
            closingTime = "22:00",
            workingDays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"),
            holidaySettings = "Closed"
        )

        val mondayNoon = createUtcTimestamp(Calendar.MONDAY, 12, 0)
        val status = OperatingHoursEngine.getStatus(hours, "UTC", mondayNoon)

        assertTrue(status is OpenStatus.Closed)
        assertTrue((status as OpenStatus.Closed).isClosedToday)
    }

    @Test
    fun test24HoursOpen_returnsOpenOnWorkingDays() {
        val hours = BusinessHours(
            openingTime = "00:00",
            closingTime = "00:00",
            workingDays = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
        )

        val wednesdayNight = createUtcTimestamp(Calendar.WEDNESDAY, 23, 45)
        val status = OperatingHoursEngine.getStatus(hours, "UTC", wednesdayNight)

        assertTrue(status is OpenStatus.Open)
        assertTrue(OperatingHoursEngine.isOpenNow(hours, "UTC", wednesdayNight))
    }
}
