package com.spiralworld.spiraldine.data.repository

import com.spiralworld.spiraldine.data.model.BusinessHours
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

sealed class OpenStatus(val label: String) {
    data class Open(val closesAt: String? = null) : OpenStatus(
        if (closesAt != null) "Open until $closesAt" else "Open Now"
    )

    data class Closed(val opensAt: String? = null, val isClosedToday: Boolean = false) : OpenStatus(
        when {
            isClosedToday -> "Closed today"
            opensAt != null -> "Closed • Opens at $opensAt"
            else -> "Closed"
        }
    )

    object Unknown : OpenStatus("Hours unavailable")
}

object OperatingHoursEngine {

    private val DAY_NAMES_SHORT = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

    /**
     * Determine whether a restaurant is open, closed, or hours are unknown.
     * Respects restaurant timezone, overnight closing hours crossing midnight,
     * working days, and closed days.
     */
    fun getStatus(
        businessHours: BusinessHours?,
        timezone: String? = null,
        currentTimeMillis: Long = System.currentTimeMillis()
    ): OpenStatus {
        if (businessHours == null) return OpenStatus.Unknown

        val openingStr = businessHours.openingTime?.trim()
        val closingStr = businessHours.closingTime?.trim()

        if (openingStr.isNullOrBlank() || closingStr.isNullOrBlank()) {
            return OpenStatus.Unknown
        }

        val openMinutes = parseTimeToMinutes(openingStr) ?: return OpenStatus.Unknown
        val closeMinutes = parseTimeToMinutes(closingStr) ?: return OpenStatus.Unknown

        // Holiday check if explicitly marked as Closed
        val holiday = businessHours.holidaySettings?.trim()
        if (holiday.equals("Closed", ignoreCase = true) || holiday.equals("Holiday", ignoreCase = true)) {
            return OpenStatus.Closed(isClosedToday = true)
        }

        val tz = if (!timezone.isNullOrBlank()) {
            try {
                TimeZone.getTimeZone(timezone)
            } catch (_: Exception) {
                TimeZone.getDefault()
            }
        } else {
            TimeZone.getDefault()
        }

        val cal = Calendar.getInstance(tz).apply { timeInMillis = currentTimeMillis }
        val currentDayOfWeek = cal.get(Calendar.DAY_OF_WEEK) // 1 = Sunday, 2 = Monday, etc.
        val currentHour = cal.get(Calendar.HOUR_OF_DAY)
        val currentMinute = cal.get(Calendar.MINUTE)
        val currentMinutes = currentHour * 60 + currentMinute

        // Yesterday's Calendar day (1..7)
        val yesterdayDayOfWeek = if (currentDayOfWeek == Calendar.SUNDAY) Calendar.SATURDAY else currentDayOfWeek - 1

        val workingDays = businessHours.workingDays
        val isTodayWorking = isWorkingDay(currentDayOfWeek, workingDays)
        val isYesterdayWorking = isWorkingDay(yesterdayDayOfWeek, workingDays)

        // Case 1: 24 Hours Open
        if (openMinutes == closeMinutes) {
            return if (isTodayWorking) {
                OpenStatus.Open(closesAt = null)
            } else {
                OpenStatus.Closed(isClosedToday = true)
            }
        }

        // Case 2: Standard Daytime Schedule (e.g. 09:00 to 22:00)
        if (openMinutes < closeMinutes) {
            if (!isTodayWorking) {
                return OpenStatus.Closed(isClosedToday = true)
            }
            return when {
                currentMinutes in openMinutes until closeMinutes -> {
                    OpenStatus.Open(closesAt = formatMinutesToDisplay(closeMinutes))
                }
                currentMinutes < openMinutes -> {
                    OpenStatus.Closed(opensAt = formatMinutesToDisplay(openMinutes))
                }
                else -> {
                    OpenStatus.Closed(opensAt = null)
                }
            }
        }

        // Case 3: Overnight Schedule Crossing Midnight (e.g. 18:00 to 02:00)
        // Shift covers:
        // Part A: from midnight 00:00 up to closeMinutes (continuation from yesterday's evening)
        // Part B: from openMinutes up to 23:59 (today's evening start)
        return when {
            // Early morning continuation
            currentMinutes < closeMinutes -> {
                if (isYesterdayWorking) {
                    OpenStatus.Open(closesAt = formatMinutesToDisplay(closeMinutes))
                } else if (isTodayWorking) {
                    OpenStatus.Closed(opensAt = formatMinutesToDisplay(openMinutes))
                } else {
                    OpenStatus.Closed(isClosedToday = true)
                }
            }
            // Evening start
            currentMinutes >= openMinutes -> {
                if (isTodayWorking) {
                    OpenStatus.Open(closesAt = formatMinutesToDisplay(closeMinutes))
                } else {
                    OpenStatus.Closed(isClosedToday = true)
                }
            }
            // Daytime gap between overnight close and next open
            else -> {
                if (isTodayWorking) {
                    OpenStatus.Closed(opensAt = formatMinutesToDisplay(openMinutes))
                } else {
                    OpenStatus.Closed(isClosedToday = true)
                }
            }
        }
    }

    /**
     * Checks if given day of week (Calendar.SUNDAY..SATURDAY) is in working days list.
     * Empty list defaults to open all 7 days.
     */
    fun isWorkingDay(calendarDayOfWeek: Int, workingDays: List<String>): Boolean {
        if (workingDays.isEmpty()) return true
        val dayIndex = calendarDayOfWeek - 1 // 0 = Sun, 1 = Mon ... 6 = Sat
        val shortName = DAY_NAMES_SHORT.getOrElse(dayIndex) { "Mon" }
        return workingDays.any { entry ->
            val trimmed = entry.trim()
            trimmed.startsWith(shortName, ignoreCase = true) ||
                    shortName.startsWith(trimmed, ignoreCase = true)
        }
    }

    /**
     * Parses time string into minutes from 00:00 (0..1439).
     * Supports "HH:mm", "H:mm", "hh:mm a", "h:mm a".
     */
    fun parseTimeToMinutes(timeStr: String?): Int? {
        if (timeStr.isNullOrBlank()) return null
        val clean = timeStr.trim()

        val isPm = clean.endsWith("pm", ignoreCase = true)
        val isAm = clean.endsWith("am", ignoreCase = true)
        val stripped = clean.replace(Regex("(?i)[a-z\\s]"), "")

        val parts = stripped.split(":")
        if (parts.size < 2) return null

        val h = parts[0].toIntOrNull() ?: return null
        val m = parts[1].toIntOrNull() ?: return null
        if (m !in 0..59) return null

        var hour24 = h
        if (isPm && hour24 in 1..11) {
            hour24 += 12
        } else if (isAm && hour24 == 12) {
            hour24 = 0
        }

        if (hour24 !in 0..23) return null
        return hour24 * 60 + m
    }

    /**
     * Formats minutes from 00:00 into user-friendly 12-hour display time (e.g. "10:30 PM").
     */
    fun formatMinutesToDisplay(minutes: Int): String {
        val normalized = ((minutes % 1440) + 1440) % 1440
        val h24 = normalized / 60
        val m = normalized % 60
        val amPm = if (h24 >= 12) "PM" else "AM"
        val h12 = when (val mod = h24 % 12) {
            0 -> 12
            else -> mod
        }
        return if (m == 0) {
            "$h12 $amPm"
        } else {
            String.format(Locale.US, "%d:%02d %s", h12, m, amPm)
        }
    }

    /**
     * Convenience boolean check.
     * Returns true ONLY if restaurant is verified as Open. Returns false if closed or unknown.
     */
    fun isOpenNow(
        businessHours: BusinessHours?,
        timezone: String? = null,
        currentTimeMillis: Long = System.currentTimeMillis()
    ): Boolean {
        return getStatus(businessHours, timezone, currentTimeMillis) is OpenStatus.Open
    }
}
