# SpiralDine Offers & Promotions — Native Android Integration Contract

**Version:** 1.0.0  
**Target:** Future Native Android Customer App (Kotlin / Jetpack Compose)  
**Security Model:** Zero-Trust Client (Authoritative Server Validation)  
**Backend:** SpiralDine Shared Promotion Engine (`/api/orders/create` & Firestore)  

---

## 1. Architectural Principles & Security Boundary

1. **Client is an Untrusted Presentation Layer:**
   - The native Android customer app MUST NOT calculate or authoritatively enforce discounts, order totals, tax liabilities, or coupon eligibility.
   - Any client-side price preview is strictly optimistic. The final payable amount is authoritatively calculated and locked by the trusted SpiralDine backend.

2. **Currency Representation:**
   - All monetary values exchanged between the native Android client and backend APIs MUST use **integer minor currency units** (e.g., paise for `INR`, cents for `USD`).
   - Example: ₹240.00 is represented as `24000` (paise).
   - Display formatting (currency symbol, comma separators, decimals) is handled purely at the UI presentation boundary using Android's `NumberFormat` or `DecimalFormat`.

3. **Tenant & Table Isolation:**
   - Every promotion, menu query, and quote request MUST include the canonical `tenantId` (restaurant identifier).
   - Promoted items belong strictly to the tenant's menu. Cross-tenant coupon application is rejected at the server gateway.

4. **Android Print Bridge Preservation:**
   - The existing native Android Print Bridge (`android/`) remains dedicated to Bluetooth/USB kitchen receipt printing and is NOT modified or conflated with this customer promotions contract.

---

## 2. Shared Promotion Data Model (`IPromotion`)

### Firestore Path
`restaurants/{tenantId}/promotions/{promotionId}`

### JSON Schema
```json
{
  "id": "promo_diwali_2026",
  "tenantId": "bawarchi-restaurant",
  "branchIds": ["main"],
  "name": "Diwali Feast 20% OFF",
  "description": "Get 20% discount on Biryanis & Starters up to ₹150",
  "type": "PERCENTAGE",
  "discountValue": 20,
  "badgeText": "20% OFF",
  "imageUrl": "https://spiral-dine.vercel.app/promos/diwali.webp",
  "couponCode": "FEAST20",
  "minOrderValue": 49900,
  "maxDiscountAmount": 15000,
  "applicableItemIds": ["item_hyd_biryani_01", "item_chicken_65"],
  "applicableCategoryIds": ["cat_biryani", "cat_starters"],
  "status": "ACTIVE",
  "placement": "ALL",
  "startDate": "2026-10-15T00:00:00.000Z",
  "endDate": "2026-11-05T23:59:59.000Z",
  "globalUsageLimit": 1000,
  "perCustomerLimit": 2,
  "currentRedemptions": 142,
  "stackable": false,
  "createdAt": "2026-10-14T10:00:00.000Z",
  "updatedAt": "2026-10-18T05:00:00.000Z"
}
```

### Kotlin Data Classes for Jetpack Compose
```kotlin
package com.spiraldine.customer.domain.promotions

import kotlinx.serialization.Serializable

enum class PromotionType {
    PERCENTAGE,
    FIXED_AMOUNT,
    BUY_X_GET_Y,
    FIXED_PRICE_COMBO,
    ITEM_DISCOUNT,
    CATEGORY_DISCOUNT,
    RESTAURANT_WIDE,
    COUPON
}

enum class PromotionStatus {
    DRAFT,
    SCHEDULED,
    ACTIVE,
    PAUSED,
    EXPIRED,
    ARCHIVED
}

enum class PromotionPlacement {
    HOME_CAROUSEL,
    MENU_BANNER,
    FOOD_CARD,
    CART_CHECKOUT,
    ALL
}

@Serializable
data class Promotion(
    val id: String,
    val tenantId: String,
    val branchIds: List<String> = emptyList(),
    val name: String,
    val description: String = "",
    val type: PromotionType,
    val discountValue: Long, // Integer minor units (e.g., paise) or percentage points
    val badgeText: String? = null,
    val imageUrl: String? = null,
    val couponCode: String? = null,
    val minOrderValue: Long? = null, // In minor units (e.g., 49900 = ₹499)
    val maxDiscountAmount: Long? = null, // In minor units (e.g., 15000 = ₹150)
    val applicableItemIds: List<String> = emptyList(),
    val applicableCategoryIds: List<String> = emptyList(),
    val applicableVariantIds: List<String> = emptyList(),
    val status: PromotionStatus,
    val placement: PromotionPlacement = PromotionPlacement.ALL,
    val startDate: String, // ISO-8601 UTC
    val endDate: String,   // ISO-8601 UTC
    val globalUsageLimit: Int? = null,
    val perCustomerLimit: Int? = null,
    val currentRedemptions: Int = 0,
    val stackable: Boolean = false,
    val createdAt: String,
    val updatedAt: String
)
```

---

## 3. Trusted Server Endpoints

### 3.1. Coupon Validation API

**Endpoint:** `POST https://spiral-dine.vercel.app/api/promotions/validate-coupon`  
**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <FirebaseIdToken>`

#### Request Payload
```json
{
  "tenantId": "bawarchi-restaurant",
  "couponCode": "FEAST20",
  "orderSubtotal": 55000,
  "items": [
    {
      "itemId": "item_hyd_biryani_01",
      "count": 2,
      "pricePerUnit": 27500
    }
  ],
  "customerId": "usr_cust_87214"
}
```

#### Successful Response (`200 OK`)
```json
{
  "valid": true,
  "couponCode": "FEAST20",
  "discountAmount": 11000,
  "message": "Coupon FEAST20 applied successfully. You saved ₹110.00!",
  "promotion": {
    "id": "promo_diwali_2026",
    "name": "Diwali Feast 20% OFF",
    "type": "PERCENTAGE",
    "discountValue": 20,
    "maxDiscountAmount": 15000,
    "minOrderValue": 49900
  }
}
```

#### Rejection Response (`200 OK` or `422 Unprocessable Entity`)
```json
{
  "valid": false,
  "couponCode": "FEAST20",
  "discountAmount": 0,
  "errorCode": "MIN_ORDER_NOT_MET",
  "message": "Order subtotal must be at least ₹499.00 to use coupon FEAST20."
}
```

---

### 3.2. Order Creation & Authoritative Redemption

**Endpoint:** `POST https://spiral-dine.vercel.app/api/orders/create`  
**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <FirebaseIdToken>`

#### Request Payload
```json
{
  "tenantId": "bawarchi-restaurant",
  "branchId": "main",
  "tableId": "TBL-04",
  "tableNumber": "4",
  "sessionId": "SES-8839-4412",
  "primaryOrderId": "ORD-20261018-001",
  "customerId": "usr_cust_87214",
  "customerName": "Rohan Sharma",
  "phone": "+91 98765 43210",
  "orderType": "dine_in",
  "orderSource": "app",
  "couponCode": "FEAST20",
  "items": [
    {
      "itemId": "item_hyd_biryani_01",
      "name": "Hyderabadi Chicken Biryani",
      "count": 2,
      "pricePerUnit": 27500,
      "notes": "Extra spicy"
    }
  ]
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "orderId": "ORD-20261018-001",
  "subtotal": 55000,
  "discount": 11000,
  "appliedCouponCode": "FEAST20",
  "tax": 2200,
  "serviceCharge": 2200,
  "finalAmount": 48400,
  "currency": "INR",
  "status": "NEW",
  "createdAt": "2026-10-18T10:45:00.000Z"
}
```

---

## 4. Standardized Error Codes

| Error Code | HTTP Status | Meaning | Recommended User Message |
|:---|:---:|:---|:---|
| `COUPON_NOT_FOUND` | 404 / 422 | The entered coupon code does not exist. | "Invalid coupon code. Please verify the code and try again." |
| `COUPON_INACTIVE` | 422 | Promotion status is DRAFT, PAUSED, or ARCHIVED. | "This promotion is currently paused or inactive." |
| `COUPON_NOT_STARTED` | 422 | Current timestamp < `startDate`. | "This offer begins on {startDate}." |
| `COUPON_EXPIRED` | 422 | Current timestamp > `endDate`. | "This coupon has expired." |
| `MIN_ORDER_NOT_MET` | 422 | Subtotal < `minOrderValue`. | "Add items worth {remainingAmount} more to use this coupon." |
| `GLOBAL_LIMIT_REACHED` | 422 | `currentRedemptions` >= `globalUsageLimit`. | "This offer has reached its maximum global redemptions." |
| `CUSTOMER_LIMIT_REACHED` | 422 | Customer has reached `perCustomerLimit`. | "You have already redeemed this coupon the maximum allowed times." |
| `ITEMS_NOT_ELIGIBLE` | 422 | Cart contains no items matching item or category scope. | "This coupon applies only to selected dishes or categories." |
| `CROSS_TENANT_VIOLATION` | 403 | Attempt to apply Restaurant A's coupon to Restaurant B. | "This coupon is only valid for {restaurantName}." |

---

## 5. Jetpack Compose UI Guidelines

1. **Promotions Carousel (Home Screen):**
   - Use `HorizontalPager` with subtle snapping animation.
   - Fixed height: `160.dp` to prevent vertical layout shifts.
   - Display: Background promo image, overlay badge, headline, and "Order Now" action button.

2. **2-Column Food Grid Discount Display:**
   - Struck-through original price: `style = TextStyle(textDecoration = TextDecoration.LineThrough)`.
   - Bold discounted price in primary theme color (`#C85A3F`).
   - Offer badge (`#C85A3F` background, white text, 9sp font weight bold) on the top-left of the food image thumbnail.

3. **Cart & Checkout Available Coupons Tray:**
   - Display active coupons in a `LazyColumn` bottom sheet or expandable card.
   - Include 1-click "Apply" button.
   - Dynamically calculate and display potential savings: `"Save up to ₹150 with FEAST20"`.
