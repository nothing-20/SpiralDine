package com.spiralworld.spiraldine.data.model

data class BusinessHours(
    val openingTime: String? = null,
    val closingTime: String? = null,
    val workingDays: List<String> = emptyList(),
    val holidaySettings: String? = null
)

data class Restaurant(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val address: String = "",
    val locality: String = "",
    val city: String = "",
    val state: String = "",
    val zipCode: String = "",
    val cuisines: List<String> = emptyList(),
    val rating: Double? = null,
    val reviewCount: Int = 0,
    val imageUrl: String = "",
    val logoUrl: String = "",
    val isOpen: Boolean? = null,
    val priceForTwo: Int? = null,
    val priceTier: String? = null, // "₹", "₹₹", "₹₹₹"
    val isPureVeg: Boolean = false,
    val businessHours: BusinessHours? = null,
    val timezone: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val googleMapsUrl: String? = null,
    val activeOffersCount: Int = 0,
    val activeOfferBadge: String? = null,
    val taxPercent: Double = 5.0,
    val serviceChargePercent: Double = 5.0,
    val phone: String = "",
    val isDemoFallback: Boolean = false,
    val supportsTableBooking: Boolean = true,
    val bookingConfig: BookingConfig = BookingConfig()
) {
    val cuisine: String
        get() = cuisines.firstOrNull() ?: ""

    val displayPriceForTwo: String
        get() = if (priceForTwo != null && priceForTwo > 0) "₹$priceForTwo for two" else (priceTier ?: "₹₹")

    val hasVerifiedRating: Boolean
        get() = rating != null && rating > 0.0 && reviewCount > 0
}

data class MenuCategory(
    val id: String = "",
    val name: String = "",
    val displayOrder: Int = 0
)

data class Variant(
    val id: String = "",
    val name: String = "",
    val price: Double = 0.0,
    val isAvailable: Boolean = true
)

data class Addon(
    val id: String = "",
    val name: String = "",
    val price: Double = 0.0,
    val isAvailable: Boolean = true
)

data class MenuItem(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val price: Double = 0.0,
    val discountPrice: Double? = null,
    val categoryId: String = "",
    val category: String = "",
    val isVeg: Boolean = true,
    val imageUrl: String = "",
    val isAvailable: Boolean = true,
    val isPublished: Boolean = true,
    val preparationTime: String = "15-20 min",
    val preparationTimeMinutes: Int = 15,
    val variants: List<Variant> = emptyList(),
    val addons: List<Addon> = emptyList(),
    val restaurantId: String = ""
) {
    val effectivePrice: Double
        get() = if (discountPrice != null && discountPrice > 0 && discountPrice < price) discountPrice else price

    val isCustomizable: Boolean
        get() = variants.isNotEmpty() || addons.isNotEmpty()
}

typealias MenuItemVariant = Variant
typealias MenuItemAddon = Addon

data class Promotion(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val type: String = "percentage",
    val value: Double = 0.0,
    val discountValue: Double = 0.0,
    val code: String = "",
    val couponCode: String = "",
    val badgeText: String = "",
    val minOrderSubtotal: Double = 0.0,
    val minOrderValue: Double = 0.0,
    val maxDiscountAmount: Double = 0.0,
    val placements: List<String> = emptyList(),
    val applicableItemIds: List<String> = emptyList(),
    val applicableCategoryIds: List<String> = emptyList(),
    val status: String = "active",
    val startDate: String? = null,
    val endDate: String? = null,
    val globalUsageLimit: Int? = null,
    val redemptionCount: Int = 0
) {
    val effectiveCode: String
        get() = code.ifBlank { couponCode }

    val effectiveMinOrder: Double
        get() = if (minOrderSubtotal > 0) minOrderSubtotal else minOrderValue

    val effectiveDiscountValue: Double
        get() = if (value > 0) value else discountValue
}

data class CartItem(
    val item: MenuItem,
    var count: Int = 1,
    val selectedVariant: Variant? = null,
    val selectedAddons: List<Addon> = emptyList(),
    val notes: String = ""
) {
    val lineId: String
        get() {
            val variantPart = selectedVariant?.id ?: "none"
            val addonPart = selectedAddons.map { it.id }.sorted().joinToString(",")
            val notePart = notes.trim().lowercase()
            return "${item.id}::$variantPart::$addonPart::$notePart"
        }

    val displayCustomizations: String
        get() {
            val parts = mutableListOf<String>()
            if (selectedVariant != null) {
                parts.add(selectedVariant.name)
            }
            if (selectedAddons.isNotEmpty()) {
                parts.add(selectedAddons.joinToString(", ") { it.name })
            }
            return parts.joinToString(" • ")
        }

    val unitPrice: Double
        get() {
            var p = selectedVariant?.price ?: item.effectivePrice
            selectedAddons.forEach { p += it.price }
            return p
        }

    val lineTotal: Double
        get() = unitPrice * count
}

data class CartPricing(
    val subtotal: Double = 0.0,
    val discount: Double = 0.0,
    val taxableAmount: Double = 0.0,
    val tax: Double = 0.0,
    val taxPercent: Double = 5.0,
    val serviceCharge: Double = 0.0,
    val serviceChargePercent: Double = 5.0,
    val total: Double = 0.0
)

data class OrderItemRecord(
    val itemId: String = "",
    val name: String = "",
    val count: Int = 1,
    val pricePerUnit: Double = 0.0,
    val isVeg: Boolean = true,
    val notes: String = ""
)

data class OrderRecord(
    val id: String = "",
    val orderId: String = "",
    val primaryOrderId: String = "",
    val sessionId: String = "",
    val tenantId: String = "",
    val restaurantId: String = "",
    val tableNumber: String = "",
    val tableId: String = "",
    val customerId: String = "",
    val customerName: String = "",
    val phone: String = "",
    val items: List<OrderItemRecord> = emptyList(),
    val subtotal: Double = 0.0,
    val discount: Double = 0.0,
    val couponCode: String? = null,
    val tax: Double = 0.0,
    val serviceCharge: Double = 0.0,
    val total: Double = 0.0,
    val status: String = "NEW",
    val paymentStatus: String = "pending",
    val createdAt: String = ""
)

data class DiningSession(
    val sessionId: String = "",
    val tenantId: String = "",
    val restaurantName: String = "",
    val tableNumber: String = "",
    val tableId: String = "",
    val customerId: String = "",
    val startedAt: String = ""
)

data class CustomerUser(
    val uid: String,
    val email: String? = null,
    val displayName: String? = null,
    val isAnonymous: Boolean = false,
    val phoneNumber: String? = null
)

fun defaultNotificationPreferences(): Map<String, Boolean> = mapOf(
    "orderUpdates" to true,
    "bookingUpdates" to true,
    "billUpdates" to true,
    "restaurantAnnouncements" to true,
    "promotionalOffers" to false,
    "pushEnabled" to true,
    "emailEnabled" to false
)

data class CustomerProfile(
    val uid: String = "",
    val email: String? = null,
    val displayName: String? = null,
    val phoneNumber: String? = null,
    val isAnonymous: Boolean = false,
    val dietaryPrefs: List<String> = emptyList(),
    val allergens: List<String> = emptyList(),
    val preferredCuisines: List<String> = emptyList(),
    val diningMethod: String = "Dine In",
    val isVeg: Boolean = false,
    val theme: String = "System",
    val language: String = "English",
    val textSize: String = "Medium",
    val notificationPreferences: Map<String, Boolean> = defaultNotificationPreferences(),
    val isDeleted: Boolean = false,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

data class SupportTicket(
    val id: String = "",
    val ticketId: String = "",
    val customerId: String = "",
    val customerName: String = "",
    val customerEmail: String = "",
    val category: String = "General Inquiry",
    val description: String = "",
    val orderId: String? = null,
    val bookingId: String? = null,
    val status: String = "open",
    val createdAt: String = "",
    val updatedAt: String = "",
    val responseMessage: String? = null
)


data class PaymentOrder(
    val provider: String = "razorpay",
    val providerOrderId: String = "",
    val keyId: String = "",
    val amountInCents: Double = 0.0,
    val amountInRupees: Double = 0.0,
    val currency: String = "INR",
    val orderId: String = "",
    val billId: String = "",
    val tenantId: String = ""
)

data class PaymentVerification(
    val success: Boolean = false,
    val provider: String = "razorpay",
    val providerOrderId: String = "",
    val paymentReference: String? = null,
    val status: String = "PENDING",
    val alreadySettled: Boolean = false,
    val errorMessage: String? = null
)

data class ServiceRequestRecord(
    val id: String = "",
    val requestId: String = "",
    val tenantId: String = "",
    val tableNumber: String = "",
    val tableId: String = "",
    val sessionId: String = "",
    val type: String = "Assistance", // 'Assistance', 'Water', 'Bill', 'Cutlery', 'Cleaning'
    val requestType: String = "Call Waiter",
    val status: String = "Pending", // 'Pending', 'Acknowledged', 'Resolved'
    val createdAt: String = "",
    val userId: String = "",
    val notes: String = ""
)

data class PushNotificationPayload(
    val orderId: String = "",
    val tenantId: String = "",
    val status: String = "",
    val title: String = "",
    val body: String = "",
    val tableNumber: String = "",
    val timestamp: Long = System.currentTimeMillis()
)

data class NotificationRecord(
    val id: String = "",
    val title: String = "",
    val body: String = "",
    val category: String = "Order", // 'Order', 'Bill', 'Booking', 'Promo', 'General'
    val timestamp: Long = System.currentTimeMillis(),
    val createdAt: String = "",
    val read: Boolean = false,
    val orderId: String = "",
    val tenantId: String = "",
    val bookingId: String = ""
)

data class ReviewRecord(
    val id: String = "",
    val orderId: String = "",
    val tenantId: String = "",
    val tableNumber: String = "",
    val rating: String = "Excellent", // 'Excellent', 'Good', 'Average', 'Poor', 'Very Poor'
    val starRating: Int = 5,
    val foodQuality: Int = 5,
    val service: Int = 5,
    val cleanliness: Int = 5,
    val ambience: Int = 5,
    val notes: String = "",
    val isAnonymous: Boolean = false,
    val submittedByName: String = "",
    val publicCustomerName: String = "Anonymous Diner",
    val revisitIntention: String = "Yes", // 'Yes' | 'Maybe' | 'No'
    val status: String = "Published", // 'Published' | 'New' | 'Resolved'
    val customerId: String = "",
    val restaurantName: String = "",
    val createdAt: String = ""
)

data class CategoryAverages(
    val foodQuality: Double = 0.0,
    val service: Double = 0.0,
    val cleanliness: Double = 0.0,
    val ambience: Double = 0.0
)

data class RestaurantRatingSummary(
    val averageRating: Double = 0.0,
    val totalReviews: Int = 0,
    val starDistribution: Map<Int, Int> = emptyMap(), // star 1..5 -> percentage 0..100
    val starCounts: Map<Int, Int> = emptyMap(), // star 1..5 -> count
    val categoryAverages: CategoryAverages = CategoryAverages(),
    val revisitRate: Int = 0, // percentage 0..100
    val hasReviews: Boolean = false
)

data class UserLocation(
    val latitude: Double,
    val longitude: Double,
    val localityName: String? = null
)

/**
 * Robust UI state representation for customer order history.
 * Distinguishes genuine empty state from permission-denied, network, and authentication errors.
 */
sealed interface OrderHistoryState {
    data object Loading : OrderHistoryState
    data object Empty : OrderHistoryState
    data class Success(val orders: List<OrderRecord>) : OrderHistoryState
    data class AuthorizationError(val message: String = "Authorization required to view order history.") : OrderHistoryState
    data class NetworkError(val message: String = "Unable to connect to order service. Tap to retry.", val isRetryable: Boolean = true) : OrderHistoryState
    data class Error(val message: String = "Unable to load order history.") : OrderHistoryState
}

data class BookingConfig(
    val supportsSeatPreference: Boolean = false,
    val supportedSeatZones: List<String> = emptyList(),
    val availableTimeSlots: List<String> = listOf("12:00 PM", "1:00 PM", "2:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"),
    val maxGuests: Int = 8
)

data class RestaurantTable(
    val id: String = "",
    val tenantId: String = "",
    val tableNumber: String = "",
    val number: String = "",
    val seatingCapacity: Int = 4,
    val status: String = "Available", // Available, Occupied, Cleaning, Reserved, Disabled
    val floor: String = "",
    val section: String = "",
    val tableName: String = "",
    val isActive: Boolean = true,
    val activeOrderId: String? = null,
    val currentOrderId: String? = null,
    val diningStatus: String? = null,
    val subStatus: String? = null,
    val branchId: String = "main"
) {
    val displayLabel: String
        get() = if (tableName.isNotBlank()) tableName else if (tableNumber.isNotBlank()) "Table $tableNumber" else "Table $number"

    val effectiveCapacity: Int
        get() = if (seatingCapacity > 0) seatingCapacity else 4

    val isAvailableForBooking: Boolean
        get() = isActive && !status.equals("Disabled", ignoreCase = true) && !status.equals("Cleaning", ignoreCase = true)

    val isOccupiedForDineIn: Boolean
        get() {
            if (!isActive) return true
            val s = status.lowercase().trim()
            if (s == "disabled" || s == "inactive") return true
            if (!activeOrderId.isNullOrBlank() || !currentOrderId.isNullOrBlank()) return true
            if (s == "dining" || diningStatus?.lowercase()?.trim() == "dining") return true
            if (s == "occupied" && (subStatus != "browsing" && diningStatus != "browsing")) return true
            return false
        }

    val isDineInAvailable: Boolean
        get() = !isOccupiedForDineIn && !status.equals("Cleaning", ignoreCase = true)
}

data class CustomerReservation(
    val id: String = "",
    val bookingId: String = "",
    val customerId: String = "",
    val customerName: String = "",
    val customerPhone: String = "",
    val customerEmail: String = "",
    val restaurantId: String = "",
    val restaurantName: String = "",
    val date: String = "", // YYYY-MM-DD
    val time: String = "", // e.g. "7:00 PM"
    val guests: Int = 2,
    val tableId: String = "",
    val tableNumber: String = "",
    val seatingPreference: String = "",
    val specialNotes: String = "",
    val status: String = "Pending", // Pending, Confirmed, Arrived, Seated, Completed, Cancelled, Rejected, Modified
    val directions: String = "",
    val lat: Double? = null,
    val lng: Double? = null,
    val createdAt: String = "",
    val updatedAt: String? = null
) {
    val isActiveReservation: Boolean
        get() {
            val s = status.lowercase()
            return s != "completed" && s != "finished" && s != "cancelled" && s != "rejected"
        }
}

data class BillRecord(
    val id: String = "",
    val billId: String = "",
    val orderId: String = "",
    val tenantId: String = "",
    val branchId: String = "main",
    val tableNumber: String = "",
    val tableId: String = "",
    val customerId: String = "",
    val customerName: String = "",
    val customerPhone: String = "",
    val restaurantName: String = "",
    val invoiceNumber: String = "",
    val items: List<OrderItemRecord> = emptyList(),
    val subtotal: Double = 0.0,
    val discount: Double = 0.0,
    val tax: Double = 0.0,
    val serviceCharge: Double = 0.0,
    val tip: Double = 0.0,
    val roundOff: Double = 0.0,
    val total: Double = 0.0,
    val currency: String = "INR",
    val orderStatus: String = "DINING_COMPLETED",
    val paymentStatus: String = "pending", // pending, paid, cancelled
    val paymentMethod: String = "",
    val createdAt: String = "",
    val paidAt: String? = null
)

