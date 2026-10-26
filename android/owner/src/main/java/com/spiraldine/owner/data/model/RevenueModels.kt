package com.spiraldine.owner.data.model

data class TransactionRecord(
    val id: String = "",
    val orderId: String = "",
    val billId: String = "",
    val invoiceNumber: String = "",
    val tableNumber: String = "Walk-in",
    val customerId: String = "",
    val customerName: String = "Guest Diner",
    val customerPhone: String = "",
    val orderTime: String = "",
    val paymentStatus: String = "paid", // paid, pending, refunded
    val paymentMethod: String = "cash", // cash, upi, card, other
    val orderStatus: String = "COMPLETED",
    val subtotal: Double = 0.0,
    val tax: Double = 0.0,
    val discount: Double = 0.0,
    val total: Double = 0.0,
    val branchId: String = "main",
    val items: List<OrderItemRecord> = emptyList()
)

data class AnnualSummaryMetrics(
    val grossRevenue: Double = 0.0,
    val netRevenue: Double = 0.0,
    val gstCollected: Double = 0.0,
    val totalOrders: Int = 0,
    val averageOrderValue: Double = 0.0,
    val averageMonthlyRevenue: Double = 0.0,
    val fiscalYear: String = "2026-27"
)

data class MonthRevenueRecord(
    val monthIndex: Int = 0, // 0 = April ... 11 = March
    val calendarMonth: Int = 3, // 0 = Jan ... 11 = Dec
    val year: Int = 2026,
    val monthName: String = "April",
    val label: String = "April 2026",
    val grossRevenue: Double = 0.0,
    val netRevenue: Double = 0.0,
    val gstCollected: Double = 0.0,
    val ordersCount: Int = 0,
    val trendPercent: Int = 0,
    val orders: List<TransactionRecord> = emptyList()
)

data class DailyRevenueRecord(
    val dateString: String = "", // yyyy-MM-dd
    val displayDate: String = "",
    val grossRevenue: Double = 0.0,
    val netRevenue: Double = 0.0,
    val gstCollected: Double = 0.0,
    val successfulOrdersCount: Int = 0,
    val averageOrderValue: Double = 0.0,
    val pendingAmount: Double = 0.0,
    val refundsAmount: Double = 0.0,
    val cashAmount: Double = 0.0,
    val upiAmount: Double = 0.0,
    val cardAmount: Double = 0.0,
    val ordersList: List<TransactionRecord> = emptyList()
)
