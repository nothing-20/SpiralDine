package com.spiraldine.owner.data.model

data class OrderItemRecord(
    val name: String = "",
    val quantity: Int = 1,
    val price: Double = 0.0,
    val notes: String = ""
)

data class OrderRecord(
    val id: String = "",
    val orderNumber: String = "",
    val tableNumber: String = "",
    val diningOption: String = "Dine-In",
    val customerName: String = "Guest Diner",
    val status: String = "PENDING",
    val items: List<OrderItemRecord> = emptyList(),
    val subtotal: Double = 0.0,
    val tax: Double = 0.0,
    val discount: Double = 0.0,
    val total: Double = 0.0,
    val paymentMethod: String = "UPI / Counter",
    val paymentStatus: String = "pending",
    val createdAt: String = "",
    val tenantId: String = "",
    val branchId: String = "main"
)

data class ReservationRecord(
    val id: String = "",
    val customerName: String = "Guest Diner",
    val customerPhone: String = "",
    val customerEmail: String = "",
    val date: String = "",
    val time: String = "",
    val guests: Int = 2,
    val tableNumber: String = "",
    val tableId: String = "",
    val seatingPreference: String = "Indoor",
    val specialNotes: String = "",
    val status: String = "Pending", // Pending, Confirmed, Arrived, Seated, Completed, Cancelled
    val createdAt: String = "",
    val tenantId: String = "",
    val branchId: String = "main"
)

data class MenuItemRecord(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val category: String = "Mains",
    val categoryId: String = "",
    val price: Double = 0.0,
    val discountPrice: Double? = null,
    val type: String = "veg",
    val prepTime: Int = 15,
    val spiceLevel: String = "none",
    val productionMode: String = "On Demand",
    val defaultBatchSize: Int = 50,
    val availableServings: Int = 50,
    val lowStockThreshold: Int = 10,
    val autoUnavailable: Boolean = true,
    val showServingsToStaff: Boolean = true,
    val allowRefill: Boolean = true,
    val preparationMethod: String = "fresh",
    val image: String = "",
    val available: Boolean = true,
    val isPublished: Boolean = true,
    val isBestSeller: Boolean = false,
    val isRecommended: Boolean = false,
    val tenantId: String = ""
)

data class CategoryRecord(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val order: Int = 1,
    val itemCount: Int = 0,
    val image: String = "",
    val isActive: Boolean = true,
    val tenantId: String = ""
)

data class MenuVariantRecord(
    val id: String = "",
    val itemId: String = "",
    val itemName: String = "",
    val name: String = "Regular",
    val price: Double = 0.0,
    val priceOffset: Double = 0.0,
    val isAvailable: Boolean = true,
    val tenantId: String = ""
)

data class MenuAddonRecord(
    val id: String = "",
    val itemId: String = "",
    val name: String = "",
    val price: Double = 0.0,
    val isAvailable: Boolean = true,
    val isGlobal: Boolean = true,
    val applicableItems: List<String> = emptyList(),
    val tenantId: String = ""
)

data class ComboItemRecord(
    val itemId: String = "",
    val itemName: String = "",
    val quantity: Int = 1
)

data class MenuComboRecord(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val price: Double = 0.0,
    val items: List<ComboItemRecord> = emptyList(),
    val image: String = "",
    val isAvailable: Boolean = true,
    val isPublished: Boolean = true,
    val tenantId: String = ""
)

data class FloorRecord(
    val id: String = "",
    val name: String = "Ground Floor",
    val level: Int = 0,
    val tenantId: String = ""
)

data class SectionRecord(
    val id: String = "",
    val name: String = "Main Dining",
    val floorId: String = "",
    val tenantId: String = ""
)

data class TableRecord(
    val id: String = "",
    val tableNumber: String = "",
    val tableName: String = "",
    val floor: String = "Ground Floor",
    val section: String = "Main Dining",
    val capacity: Int = 4,
    val shape: String = "square", // square, circle, rectangle
    val positionX: Double = 0.0,
    val positionY: Double = 0.0,
    val notes: String = "",
    val status: String = "AVAILABLE", // AVAILABLE, OCCUPIED, RESERVED, CLEANING, DISABLED
    val qrCodeId: String = "",
    val isActive: Boolean = true,
    val tenantId: String = ""
)

data class StaffRecord(
    val id: String = "",
    val name: String = "",
    val email: String = "",
    val phone: String = "",
    val role: String = "waiter", // waiter, kitchen, manager, cashier, reception, admin
    val department: String = "Service",
    val active: Boolean = true,
    val status: String = "active", // invited, active, suspended, archived
    val invitedAt: String = "",
    val activationToken: String = "",
    val tenantId: String = ""
)

data class ShiftRecord(
    val id: String = "",
    val shiftNumber: String = "",
    val openedBy: String = "Owner",
    val openedAt: String = "",
    val closedAt: String? = null,
    val status: String = "OPEN", // OPEN, CLOSED
    val openingCash: Double = 0.0,
    val expectedClosingCash: Double = 0.0,
    val actualClosingCash: Double = 0.0,
    val cashDifference: Double = 0.0,
    val totalSales: Double = 0.0,
    val ordersCount: Int = 0,
    val notes: String = "",
    val tenantId: String = ""
)

data class RefundRecord(
    val id: String = "",
    val orderId: String = "",
    val transactionId: String = "",
    val amount: Double = 0.0,
    val reason: String = "",
    val type: String = "full", // full, partial, void
    val status: String = "COMPLETED",
    val createdAt: String = "",
    val processedBy: String = "Owner",
    val tenantId: String = ""
)

data class InventoryIngredientRecord(
    val id: String = "",
    val name: String = "",
    val category: String = "Vegetables", // Vegetables, Meat, Dairy, Dry Goods, Beverages, Spices, Bakery, Other
    val currentStock: Double = 0.0,
    val minStock: Double = 5.0,
    val maxStock: Double = 50.0,
    val reorderLevel: Double = 10.0,
    val unit: String = "kg", // kg, g, liters, ml, pieces, packs
    val purchaseCost: Double = 0.0,
    val supplierId: String = "",
    val supplierName: String = "",
    val storageLocation: String = "Pantry", // Fridge, Freezer, Pantry, Dry Storage, Bar, Kitchen Shelf
    val expiryDate: String = "",
    val tenantId: String = ""
)

data class InventoryRecipeIngredient(
    val ingredientId: String = "",
    val ingredientName: String = "",
    val quantity: Double = 0.0,
    val unit: String = "g"
)

data class InventoryRecipeRecord(
    val id: String = "",
    val menuItemId: String = "",
    val menuItemName: String = "",
    val yield: Int = 1,
    val version: String = "v1.0",
    val ingredients: List<InventoryRecipeIngredient> = emptyList(),
    val costPerServing: Double = 0.0,
    val tenantId: String = ""
)

data class StockMovementRecord(
    val id: String = "",
    val ingredientId: String = "",
    val ingredientName: String = "",
    val change: Double = 0.0,
    val type: String = "ADJUSTMENT", // PURCHASE, CONSUMPTION, WASTE, ADJUSTMENT
    val reason: String = "",
    val timestamp: String = "",
    val performedBy: String = "Owner",
    val tenantId: String = ""
)

data class SupplierRecord(
    val id: String = "",
    val name: String = "",
    val contactPerson: String = "",
    val email: String = "",
    val phone: String = "",
    val category: String = "General",
    val leadTimeDays: Int = 2,
    val active: Boolean = true,
    val tenantId: String = ""
)

data class WasteLogRecord(
    val id: String = "",
    val ingredientId: String = "",
    val ingredientName: String = "",
    val quantity: Double = 0.0,
    val unit: String = "kg",
    val reason: String = "Spoilage", // Spoilage, Expired, Damaged, Spill, Preparation Loss
    val notes: String = "",
    val cost: Double = 0.0,
    val timestamp: String = "",
    val tenantId: String = ""
)

data class PurchaseSuggestionRecord(
    val ingredientId: String = "",
    val ingredientName: String = "",
    val currentStock: Double = 0.0,
    val reorderLevel: Double = 10.0,
    val maxStock: Double = 50.0,
    val suggestedQuantity: Double = 40.0,
    val unit: String = "kg",
    val estimatedCost: Double = 0.0
)

data class PromotionRecord(
    val id: String = "",
    val title: String = "",
    val code: String = "",
    val discountType: String = "percentage",
    val discountValue: Double = 15.0,
    val minOrder: Double = 25.0,
    val active: Boolean = true,
    val tenantId: String = ""
)

data class HealthDimensionRecord(
    val id: String = "",
    val title: String = "",
    val score: Int? = null,
    val weight: Int = 20,
    val status: String = "available", // "available" or "insufficient_data"
    val explanation: String = "",
    val metrics: Map<String, String> = emptyMap()
)

data class UserProfile(
    val uid: String = "",
    val email: String = "",
    val displayName: String = "",
    val role: String = "owner",
    val tenantId: String = "",
    val branchId: String = "main",
    val restaurantName: String = "",
    val photoUrl: String? = null,
    val isVerified: Boolean = true
)

data class RestaurantOverview(
    val name: String = "SpiralDine Restaurant",
    val branch: String = "Main Dining",
    val isOpen: Boolean = true,
    val todaySales: Double = 0.0,
    val todayOrders: Int = 0,
    val pendingOrders: Int = 0,
    val completedOrders: Int = 0,
    val businessHealthScore: Int = 85,
    val businessHealthMax: Int = 100,
    val businessHealthLabel: String = "Healthy",
    val businessHealthCoverage: Int = 80,
    val businessHealthTrend: String = "Stable",
    val currentFY: String = "2026-27",
    val annualNetRevenue: Double = 0.0,
    val annualOrdersCount: Int = 0,
    val annualAvgMonthly: Double = 0.0,
    val healthDimensions: List<HealthDimensionRecord> = emptyList(),
    val email: String = "",
    val logoUrl: String? = null
)

sealed interface TenantResolutionState {
    object Idle : TenantResolutionState
    object Loading : TenantResolutionState
    data class Resolved(val tenantId: String, val restaurantName: String, val branchId: String? = null) : TenantResolutionState
    data class NoTenantAssigned(val uid: String) : TenantResolutionState
    data class Error(val message: String) : TenantResolutionState
    object NotAuthenticated : TenantResolutionState
}

data class BranchRecord(
    val id: String = "main",
    val name: String = "Main Dining",
    val code: String = "",
    val address: String = "",
    val city: String = "",
    val phone: String = "",
    val managerName: String = "",
    val tablesCount: Int = 10,
    val isDefault: Boolean = true,
    val isActive: Boolean = true,
    val tenantId: String = ""
)

data class RestaurantDetailRecord(
    val id: String = "",
    val name: String = "SpiralDine Bistro",
    val address: String = "",
    val city: String = "",
    val phone: String = "",
    val cuisine: String = "Multicuisine",
    val planTier: String = "pro",
    val status: String = "active", // active, suspended, inactive
    val isOpen: Boolean = true,
    val managerId: String = "",
    val managerName: String = "Unassigned",
    val tableCount: Int = 0,
    val staffCount: Int = 0,
    val todaySales: Double = 0.0,
    val todayOrders: Int = 0,
    val ownerUid: String = "",
    val createdAt: String = "",
    val updatedAt: String = ""
)

data class BranchTransferRecord(
    val id: String = "",
    val sourceRestaurantId: String = "",
    val sourceRestaurantName: String = "Main Dining",
    val destRestaurantId: String = "",
    val destRestaurantName: String = "Downtown Branch",
    val itemId: String = "",
    val itemName: String = "Ingredient",
    val quantity: Double = 10.0,
    val unit: String = "kg",
    val requesterName: String = "Kitchen Lead",
    val approverName: String = "",
    val status: String = "Requested", // Requested, Approved, Dispatched, Received, Completed, Rejected
    val notes: String = "",
    val dispatchedAt: String = "",
    val receivedAt: String = "",
    val createdAt: String = "",
    val tenantId: String = ""
)

data class CustomerRecord(
    val id: String = "",
    val name: String = "Guest Diner",
    val phone: String = "",
    val email: String = "",
    val totalVisits: Int = 1,
    val totalSpend: Double = 0.0,
    val averageOrderValue: Double = 0.0,
    val lastVisit: String = "",
    val loyaltyPoints: Int = 0,
    val segment: String = "New", // New, Returning, Frequent, Inactive
    val tenantId: String = ""
)

data class FeedbackRecord(
    val id: String = "",
    val customerName: String = "Guest Diner",
    val rating: String = "Good",
    val category: String = "Food", // Food, Service, Cleanliness, Ambience, Waiting Time, Other
    val notes: String = "",
    val orderId: String = "",
    val tableNumber: String = "",
    val isComplaint: Boolean = false,
    val status: String = "New", // New, Assigned, In Progress, Resolved
    val assignedToName: String = "",
    val internalNotes: String = "",
    val submittedAt: String = "",
    val tenantId: String = ""
)

data class ReviewRecord(
    val id: String = "",
    val customerName: String = "Guest Diner",
    val rating: Int = 5,
    val comments: String = "",
    val orderId: String = "",
    val diningOption: String = "Dine-In",
    val foodQuality: Int = 5,
    val serviceSpeed: Int = 5,
    val ambience: Int = 5,
    val wouldRecommend: Boolean = true,
    val createdAt: String = "",
    val tenantId: String = ""
)

data class CampaignRecord(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val targetAudience: String = "All Diners", // All Diners, New Customers, Returning Customers, Inactive Diners, VIP
    val discountType: String = "percentage", // percentage, flat
    val discountValue: Double = 15.0,
    val promoCode: String = "",
    val minSpend: Double = 20.0,
    val startDate: String = "",
    val endDate: String = "",
    val status: String = "Active", // Active, Paused, Completed
    val redemptionsCount: Int = 0,
    val tenantId: String = ""
)

data class AlertRecord(
    val id: String = "",
    val title: String = "System Alert",
    val message: String = "",
    val category: String = "Operations", // Critical, Operations, Inventory, Finance, Customers, Staff, System
    val severity: String = "warning", // critical, warning, info
    val source: String = "Operational Watcher",
    val read: Boolean = false,
    val resolved: Boolean = false,
    val assignedToName: String = "",
    val createdAt: String = "",
    val tenantId: String = ""
)

data class AuditLogRecord(
    val id: String = "",
    val action: String = "",
    val module: String = "",
    val actorName: String = "System",
    val actorRole: String = "owner",
    val description: String = "",
    val status: String = "success", // success, warning, failure
    val ipAddress: String = "",
    val timestamp: String = "",
    val tenantId: String = ""
)

data class ReportSummaryRecord(
    val type: String = "sales",
    val title: String = "Sales Summary Report",
    val period: String = "This Month",
    val totalGross: Double = 0.0,
    val totalNet: Double = 0.0,
    val totalTax: Double = 0.0,
    val totalDiscount: Double = 0.0,
    val totalOrders: Int = 0,
    val recordsCount: Int = 0,
    val generatedAt: String = ""
)

data class AutomationRuleRecord(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val triggerEvent: String = "ORDER_COMPLETED",
    val actionType: String = "NOTIFY",
    val enabled: Boolean = true,
    val lastRun: String = "",
    val executionCount: Int = 0,
    val tenantId: String = ""
)

data class AutomationScheduleRecord(
    val id: String = "",
    val name: String = "",
    val cronExpression: String = "0 22 * * *",
    val taskType: String = "DAILY_BRIEF",
    val active: Boolean = true,
    val lastRunAt: String = "",
    val nextRunAt: String = "",
    val tenantId: String = ""
)

data class AutomationLogRecord(
    val id: String = "",
    val ruleId: String = "",
    val ruleName: String = "",
    val triggerType: String = "SCHEDULE",
    val status: String = "SUCCESS", // SUCCESS, FAILURE, SKIPPED
    val message: String = "",
    val executionTimeMs: Long = 0L,
    val timestamp: String = "",
    val tenantId: String = ""
)

data class DailyBriefRecord(
    val id: String = "",
    val date: String = "",
    val revenueTodayPaise: Long = 0L,
    val ordersCount: Int = 0,
    val topDish: String = "Special Biryani",
    val criticalAlertsCount: Int = 0,
    val summaryMarkdown: String = "",
    val generatedAt: String = "",
    val tenantId: String = ""
)

data class BusinessGoalRecord(
    val id: String = "",
    val title: String = "",
    val type: String = "revenue", // revenue, csat, waste, prep_time
    val targetValue: Double = 0.0,
    val currentValue: Double = 0.0,
    val unit: String = "₹",
    val deadline: String = "",
    val status: String = "on_track", // on_track, at_risk, completed
    val tenantId: String = ""
)

data class StrategyPlanRecord(
    val id: String = "",
    val title: String = "",
    val goalId: String = "",
    val category: String = "Growth",
    val actionItems: List<String> = emptyList(),
    val status: String = "active", // active, completed, paused
    val estimatedImpact: String = "+15% MoM",
    val tenantId: String = ""
)

data class AIRecommendationRecord(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val category: String = "revenue", // revenue, inventory, kitchen, dining
    val impactScore: Int = 85,
    val priority: String = "high", // high, medium, low
    val actionLabel: String = "Apply Recommendation",
    val isImplemented: Boolean = false,
    val createdAt: String = "",
    val tenantId: String = ""
)


