package com.spiraldine.owner.data.util

import com.spiraldine.owner.data.model.AnnualSummaryMetrics
import com.spiraldine.owner.data.model.DailyRevenueRecord
import com.spiraldine.owner.data.model.MonthRevenueRecord
import com.spiraldine.owner.data.model.TransactionRecord
import java.text.DecimalFormat
import java.text.DecimalFormatSymbols
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object RevenueCalculator {

    /**
     * Formats a monetary amount into Indian Rupee (₹) standard currency format.
     * Example: 41800.00 -> "₹41,800.00", 1250000.50 -> "₹12,50,000.50", 0.0 -> "₹0.00"
     */
    fun formatInr(amount: Double): String {
        return try {
            val isNegative = amount < 0
            val absAmount = Math.abs(amount)
            val parts = "%.2f".format(Locale.US, absAmount).split(".")
            val integerPart = parts[0]
            val decimalPart = parts[1]

            val formattedInt = if (integerPart.length <= 3) {
                integerPart
            } else {
                val last3 = integerPart.takeLast(3)
                val remaining = integerPart.dropLast(3)
                val groupedRemaining = remaining.reversed().chunked(2).joinToString(",").reversed()
                "$groupedRemaining,$last3"
            }
            "${if (isNegative) "-" else ""}₹$formattedInt.$decimalPart"
        } catch (_: Exception) {
            "₹%.2f".format(amount)
        }
    }

    /**
     * Formats an amount stored in minor units (paise/cents) into standard Rupee currency format.
     * Mirrors web formatPrice(priceInCents).
     * Example: 26900.0 -> "₹269.00", 24900.0 -> "₹249.00", 0.0 -> "₹0.00"
     */
    fun formatPaise(amountInPaise: Double): String {
        return formatInr(amountInPaise / 100.0)
    }

    /**
     * Alias for formatPaise matching canonical web formatPrice.
     */
    fun formatPrice(amountInPaise: Double): String {
        return formatPaise(amountInPaise)
    }

    /**
     * Robust timestamp parser for ISO strings, standard Java Date strings, or simple dates.
     */
    fun parseDate(dateStr: String?): Date? {
        if (dateStr.isNullOrBlank()) return null
        val cleanStr = dateStr.trim()

        // Numeric epoch milliseconds check
        cleanStr.toLongOrNull()?.let {
            if (it > 0) return Date(it)
        }

        val formats = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSS",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd",
            "EEE MMM dd HH:mm:ss zzz yyyy",
            "EEE MMM dd yyyy"
        )

        for (pattern in formats) {
            try {
                val sdf = SimpleDateFormat(pattern, Locale.US)
                if (pattern.endsWith("'Z'")) {
                    sdf.timeZone = TimeZone.getTimeZone("UTC")
                }
                val parsed = sdf.parse(cleanStr)
                if (parsed != null) return parsed
            } catch (_: Exception) {
                // Continue trying alternate formats
            }
        }
        return null
    }

    /**
     * Checks if a given timestamp falls on "today" according to the restaurant's timezone (defaults to Asia/Kolkata).
     */
    fun isTodayInTimezone(dateStr: String?, timeZone: TimeZone = TimeZone.getTimeZone("Asia/Kolkata")): Boolean {
        val date = parseDate(dateStr) ?: return false
        val calDate = Calendar.getInstance(timeZone).apply { time = date }
        val calNow = Calendar.getInstance(timeZone)
        return calDate.get(Calendar.YEAR) == calNow.get(Calendar.YEAR) &&
               calDate.get(Calendar.DAY_OF_YEAR) == calNow.get(Calendar.DAY_OF_YEAR)
    }

    /**
     * Checks if a given timestamp falls on "yesterday" according to the restaurant's timezone (defaults to Asia/Kolkata).
     */
    fun isYesterdayInTimezone(dateStr: String?, timeZone: TimeZone = TimeZone.getTimeZone("Asia/Kolkata")): Boolean {
        val date = parseDate(dateStr) ?: return false
        val calDate = Calendar.getInstance(timeZone).apply { time = date }
        val calYesterday = Calendar.getInstance(timeZone).apply {
            add(Calendar.DAY_OF_YEAR, -1)
        }
        return calDate.get(Calendar.YEAR) == calYesterday.get(Calendar.YEAR) &&
               calDate.get(Calendar.DAY_OF_YEAR) == calYesterday.get(Calendar.DAY_OF_YEAR)
    }

    /**
     * Checks if a given timestamp falls within the last N days according to the restaurant's timezone.
     */
    fun isWithinDaysInTimezone(dateStr: String?, days: Int, timeZone: TimeZone = TimeZone.getTimeZone("Asia/Kolkata")): Boolean {
        val date = parseDate(dateStr) ?: return false
        val calDate = Calendar.getInstance(timeZone).apply { time = date }
        val calCutoff = Calendar.getInstance(timeZone).apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            add(Calendar.DAY_OF_YEAR, -(days - 1))
        }
        return !calDate.before(calCutoff)
    }

    /**
     * Checks if an order's status and payment status constitute a completed or settled revenue event.
     */
    fun isPaidOrCompletedOrder(status: String, paymentStatus: String): Boolean {
        val p = paymentStatus.lowercase(Locale.ROOT)
        val s = status.uppercase(Locale.ROOT)
        val isPaid = p == "paid" || p == "completed" || p == "settled" || s == "COMPLETED" || s == "SERVED"
        val isExcluded = p == "refunded" || p == "voided" || p == "failed" || s == "CANCELLED" || s == "REJECTED"
        return isPaid && !isExcluded
    }

    /**
     * Returns the current Indian fiscal year (e.g. "2026-27").
     * Fiscal year begins April 1st and ends March 31st.
     */
    fun getCurrentFiscalYear(): String {
        val cal = Calendar.getInstance()
        val year = cal.get(Calendar.YEAR)
        val month = cal.get(Calendar.MONTH) // 0-indexed (3 = April)
        return if (month >= 3) {
            "$year-${(year + 1).toString().takeLast(2)}"
        } else {
            "${year - 1}-${year.toString().takeLast(2)}"
        }
    }

    /**
     * Computes the exact April 1st 00:00:00 to March 31st 23:59:59 boundary for a fiscal year.
     */
    fun getFiscalYearRange(fyString: String): Pair<Date, Date> {
        val startYear = try {
            fyString.split("-")[0].trim().toInt()
        } catch (_: Exception) {
            2026
        }

        val cal = Calendar.getInstance()
        cal.set(startYear, Calendar.APRIL, 1, 0, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val start = cal.time

        cal.set(startYear + 1, Calendar.MARCH, 31, 23, 59, 59)
        cal.set(Calendar.MILLISECOND, 999)
        val end = cal.time

        return Pair(start, end)
    }

    /**
     * Checks if a transaction represents a successfully settled / paid sale.
     * Excludes cancelled, refunded, voided, or non-monetary items.
     */
    fun isPaidTransaction(t: TransactionRecord): Boolean {
        val pStatus = t.paymentStatus.lowercase(Locale.ROOT)
        val oStatus = t.orderStatus.uppercase(Locale.ROOT)
        val isPaid = pStatus == "paid" || pStatus == "completed" || pStatus == "settled" ||
                     oStatus == "COMPLETED" || oStatus == "SERVED"
        val isExcluded = pStatus == "refunded" || pStatus == "voided" || pStatus == "failed" ||
                         oStatus == "CANCELLED" || oStatus == "REJECTED"
        return isPaid && !isExcluded && t.total > 0
    }

    /**
     * Calculates the annual macro metrics for a given fiscal year string ("2026-27").
     */
    fun calculateAnnualMetrics(
        transactions: List<TransactionRecord>,
        fyString: String,
        branchId: String = ""
    ): AnnualSummaryMetrics {
        val (fyStart, fyEnd) = getFiscalYearRange(fyString)

        val scopedTransactions = transactions.filter { t ->
            if (branchId.isNotBlank() && branchId != "all") {
                if (t.branchId.isNotBlank() && t.branchId != branchId && t.branchId != "main") {
                    return@filter false
                }
            }
            val d = parseDate(t.orderTime) ?: return@filter false
            d in fyStart..fyEnd && isPaidTransaction(t)
        }

        val gross = scopedTransactions.sumOf { it.total }
        val gst = scopedTransactions.sumOf { it.tax }
        val net = maxOf(0.0, gross - gst)
        val count = scopedTransactions.size
        val aov = if (count > 0) gross / count else 0.0

        val distinctMonths = scopedTransactions.mapNotNull { t ->
            parseDate(t.orderTime)?.let { d ->
                val cal = Calendar.getInstance().apply { time = d }
                "${cal.get(Calendar.YEAR)}-${cal.get(Calendar.MONTH)}"
            }
        }.distinct().size

        val activeMonths = maxOf(distinctMonths, 1)
        val avgMonthly = net / activeMonths

        return AnnualSummaryMetrics(
            grossRevenue = gross,
            netRevenue = net,
            gstCollected = gst,
            totalOrders = count,
            averageOrderValue = aov,
            averageMonthlyRevenue = avgMonthly,
            fiscalYear = fyString
        )
    }

    /**
     * Generates all 12 fiscal-year months (April through March) in exact sequence.
     */
    fun calculateMonthlyBreakdown(
        transactions: List<TransactionRecord>,
        fyString: String,
        branchId: String = ""
    ): List<MonthRevenueRecord> {
        val startYear = try {
            fyString.split("-")[0].trim().toInt()
        } catch (_: Exception) {
            2026
        }

        val monthNames = listOf(
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        )

        return (0..11).map { monthIdx ->
            // monthIdx 0 = April, ..., 8 = December, 9 = January (next year), 11 = March (next year)
            val calendarMonth = (monthIdx + 3) % 12
            val year = if (calendarMonth < 3) startYear + 1 else startYear
            val mName = monthNames[calendarMonth]
            val label = "$mName $year"

            // Current month transactions
            val mTransactions = transactions.filter { t ->
                if (branchId.isNotBlank() && branchId != "all") {
                    if (t.branchId.isNotBlank() && t.branchId != branchId && t.branchId != "main") {
                        return@filter false
                    }
                }
                val d = parseDate(t.orderTime) ?: return@filter false
                val cal = Calendar.getInstance().apply { time = d }
                cal.get(Calendar.YEAR) == year && cal.get(Calendar.MONTH) == calendarMonth && isPaidTransaction(t)
            }

            val gross = mTransactions.sumOf { it.total }
            val gst = mTransactions.sumOf { it.tax }
            val net = maxOf(0.0, gross - gst)

            // Previous month transactions for percentage trend calculation
            val prevCalendarMonth = (calendarMonth - 1 + 12) % 12
            val prevYear = if (calendarMonth == 0) year - 1 else if (calendarMonth < 3 && prevCalendarMonth >= 3) year - 1 else year

            val prevTransactions = transactions.filter { t ->
                if (branchId.isNotBlank() && branchId != "all") {
                    if (t.branchId.isNotBlank() && t.branchId != branchId && t.branchId != "main") {
                        return@filter false
                    }
                }
                val d = parseDate(t.orderTime) ?: return@filter false
                val cal = Calendar.getInstance().apply { time = d }
                cal.get(Calendar.YEAR) == prevYear && cal.get(Calendar.MONTH) == prevCalendarMonth && isPaidTransaction(t)
            }

            val prevGross = prevTransactions.sumOf { it.total }
            val prevGst = prevTransactions.sumOf { it.tax }
            val prevNet = maxOf(0.0, prevGross - prevGst)

            val trendPercent = if (prevNet > 0) {
                Math.round(((net - prevNet) / prevNet) * 100).toInt()
            } else 0

            MonthRevenueRecord(
                monthIndex = monthIdx,
                calendarMonth = calendarMonth,
                year = year,
                monthName = mName,
                label = label,
                grossRevenue = gross,
                netRevenue = net,
                gstCollected = gst,
                ordersCount = mTransactions.size,
                trendPercent = trendPercent,
                orders = mTransactions
            )
        }
    }

    /**
     * Calculates daily revenue and unified receipt ledger for a selected calendar date.
     */
    fun calculateDailyRevenue(
        transactions: List<TransactionRecord>,
        selectedDate: Date,
        branchId: String = ""
    ): DailyRevenueRecord {
        val targetCal = Calendar.getInstance().apply { time = selectedDate }
        val targetYear = targetCal.get(Calendar.YEAR)
        val targetMonth = targetCal.get(Calendar.MONTH)
        val targetDay = targetCal.get(Calendar.DAY_OF_MONTH)

        val isSameDay = { d: Date ->
            val c = Calendar.getInstance().apply { time = d }
            c.get(Calendar.YEAR) == targetYear &&
            c.get(Calendar.MONTH) == targetMonth &&
            c.get(Calendar.DAY_OF_MONTH) == targetDay
        }

        val dayTransactions = transactions.filter { t ->
            if (branchId.isNotBlank() && branchId != "all") {
                if (t.branchId.isNotBlank() && t.branchId != branchId && t.branchId != "main") {
                    return@filter false
                }
            }
            val d = parseDate(t.orderTime) ?: return@filter false
            isSameDay(d)
        }

        val paidItems = dayTransactions.filter { isPaidTransaction(it) }
        val gross = paidItems.sumOf { it.total }
        val gst = paidItems.sumOf { it.tax }
        val net = maxOf(0.0, gross - gst)
        val count = paidItems.size
        val aov = if (count > 0) gross / count else 0.0

        val pendingItems = dayTransactions.filter {
            val p = it.paymentStatus.lowercase(Locale.ROOT)
            val o = it.orderStatus.uppercase(Locale.ROOT)
            p != "paid" && p != "completed" && o != "CANCELLED" && o != "REFUNDED"
        }
        val pending = pendingItems.sumOf { it.total }

        val refundedItems = dayTransactions.filter {
            it.paymentStatus.equals("refunded", ignoreCase = true) || it.orderStatus.equals("REFUNDED", ignoreCase = true)
        }
        val refunds = refundedItems.sumOf { it.total }

        var cash = 0.0
        var upi = 0.0
        var card = 0.0

        paidItems.forEach { t ->
            val method = t.paymentMethod.lowercase(Locale.ROOT)
            when {
                method.contains("upi") || method.contains("razorpay") -> upi += t.total
                method.contains("card") -> card += t.total
                else -> cash += t.total
            }
        }

        val dateFmt = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(selectedDate)
        val displayFmt = SimpleDateFormat("EEE, dd MMM yyyy", Locale.US).format(selectedDate)

        return DailyRevenueRecord(
            dateString = dateFmt,
            displayDate = displayFmt,
            grossRevenue = gross,
            netRevenue = net,
            gstCollected = gst,
            successfulOrdersCount = count,
            averageOrderValue = aov,
            pendingAmount = pending,
            refundsAmount = refunds,
            cashAmount = cash,
            upiAmount = upi,
            cardAmount = card,
            ordersList = dayTransactions.sortedByDescending { parseDate(it.orderTime)?.time ?: 0L }
        )
    }
}
