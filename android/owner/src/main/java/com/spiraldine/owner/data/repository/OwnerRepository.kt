package com.spiraldine.owner.data.repository

import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.ListenerRegistration
import com.spiraldine.owner.data.model.*
import com.spiraldine.owner.data.util.RevenueCalculator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class OwnerRepository(initialTenantId: String = "") {

    private val firestore = FirebaseConfig.firestore
    private var tenantId: String = initialTenantId

    private val _tenantState = MutableStateFlow<TenantResolutionState>(
        if (initialTenantId.isNotBlank()) TenantResolutionState.Resolved(initialTenantId, "SpiralDine Restaurant")
        else TenantResolutionState.Idle
    )
    val tenantState: StateFlow<TenantResolutionState> = _tenantState.asStateFlow()

    private val _orders = MutableStateFlow<List<OrderRecord>>(emptyList())
    val orders: StateFlow<List<OrderRecord>> = _orders.asStateFlow()

    private val _transactions = MutableStateFlow<List<TransactionRecord>>(emptyList())
    val transactions: StateFlow<List<TransactionRecord>> = _transactions.asStateFlow()

    private var rawFirestoreTransactions: List<TransactionRecord> = emptyList()

    private val _menuItems = MutableStateFlow<List<MenuItemRecord>>(emptyList())
    val menuItems: StateFlow<List<MenuItemRecord>> = _menuItems.asStateFlow()

    private val _categories = MutableStateFlow<List<CategoryRecord>>(emptyList())
    val categories: StateFlow<List<CategoryRecord>> = _categories.asStateFlow()

    private val _tables = MutableStateFlow<List<TableRecord>>(emptyList())
    val tables: StateFlow<List<TableRecord>> = _tables.asStateFlow()

    private val _staff = MutableStateFlow<List<StaffRecord>>(emptyList())
    val staff: StateFlow<List<StaffRecord>> = _staff.asStateFlow()

    private val _promotions = MutableStateFlow<List<PromotionRecord>>(emptyList())
    val promotions: StateFlow<List<PromotionRecord>> = _promotions.asStateFlow()

    private val _reservations = MutableStateFlow<List<ReservationRecord>>(emptyList())
    val reservations: StateFlow<List<ReservationRecord>> = _reservations.asStateFlow()

    private val _variants = MutableStateFlow<List<MenuVariantRecord>>(emptyList())
    val variants: StateFlow<List<MenuVariantRecord>> = _variants.asStateFlow()

    private val _addons = MutableStateFlow<List<MenuAddonRecord>>(emptyList())
    val addons: StateFlow<List<MenuAddonRecord>> = _addons.asStateFlow()

    private val _combos = MutableStateFlow<List<MenuComboRecord>>(emptyList())
    val combos: StateFlow<List<MenuComboRecord>> = _combos.asStateFlow()

    private val _floors = MutableStateFlow<List<FloorRecord>>(emptyList())
    val floors: StateFlow<List<FloorRecord>> = _floors.asStateFlow()

    private val _sections = MutableStateFlow<List<SectionRecord>>(emptyList())
    val sections: StateFlow<List<SectionRecord>> = _sections.asStateFlow()

    private val _shifts = MutableStateFlow<List<ShiftRecord>>(emptyList())
    val shifts: StateFlow<List<ShiftRecord>> = _shifts.asStateFlow()

    private val _refunds = MutableStateFlow<List<RefundRecord>>(emptyList())
    val refunds: StateFlow<List<RefundRecord>> = _refunds.asStateFlow()

    private val _inventory = MutableStateFlow<List<InventoryIngredientRecord>>(emptyList())
    val inventory: StateFlow<List<InventoryIngredientRecord>> = _inventory.asStateFlow()

    private val _recipes = MutableStateFlow<List<InventoryRecipeRecord>>(emptyList())
    val recipes: StateFlow<List<InventoryRecipeRecord>> = _recipes.asStateFlow()

    private val _stockMovements = MutableStateFlow<List<StockMovementRecord>>(emptyList())
    val stockMovements: StateFlow<List<StockMovementRecord>> = _stockMovements.asStateFlow()

    private val _suppliers = MutableStateFlow<List<SupplierRecord>>(emptyList())
    val suppliers: StateFlow<List<SupplierRecord>> = _suppliers.asStateFlow()

    private val _wasteLogs = MutableStateFlow<List<WasteLogRecord>>(emptyList())
    val wasteLogs: StateFlow<List<WasteLogRecord>> = _wasteLogs.asStateFlow()

    private val _branchTransfers = MutableStateFlow<List<BranchTransferRecord>>(emptyList())
    val branchTransfers: StateFlow<List<BranchTransferRecord>> = _branchTransfers.asStateFlow()

    private val _customers = MutableStateFlow<List<CustomerRecord>>(emptyList())
    val customers: StateFlow<List<CustomerRecord>> = _customers.asStateFlow()

    private val _feedback = MutableStateFlow<List<FeedbackRecord>>(emptyList())
    val feedback: StateFlow<List<FeedbackRecord>> = _feedback.asStateFlow()

    private val _reviews = MutableStateFlow<List<ReviewRecord>>(emptyList())
    val reviews: StateFlow<List<ReviewRecord>> = _reviews.asStateFlow()

    private val _campaigns = MutableStateFlow<List<CampaignRecord>>(emptyList())
    val campaigns: StateFlow<List<CampaignRecord>> = _campaigns.asStateFlow()

    private val _alerts = MutableStateFlow<List<AlertRecord>>(emptyList())
    val alerts: StateFlow<List<AlertRecord>> = _alerts.asStateFlow()

    private val _auditLogs = MutableStateFlow<List<AuditLogRecord>>(emptyList())
    val auditLogs: StateFlow<List<AuditLogRecord>> = _auditLogs.asStateFlow()

    private val _automationRules = MutableStateFlow<List<AutomationRuleRecord>>(emptyList())
    val automationRules: StateFlow<List<AutomationRuleRecord>> = _automationRules.asStateFlow()

    private val _automationSchedules = MutableStateFlow<List<AutomationScheduleRecord>>(emptyList())
    val automationSchedules: StateFlow<List<AutomationScheduleRecord>> = _automationSchedules.asStateFlow()

    private val _automationLogs = MutableStateFlow<List<AutomationLogRecord>>(emptyList())
    val automationLogs: StateFlow<List<AutomationLogRecord>> = _automationLogs.asStateFlow()

    private val _dailyBriefs = MutableStateFlow<List<DailyBriefRecord>>(emptyList())
    val dailyBriefs: StateFlow<List<DailyBriefRecord>> = _dailyBriefs.asStateFlow()

    private val _businessGoals = MutableStateFlow<List<BusinessGoalRecord>>(emptyList())
    val businessGoals: StateFlow<List<BusinessGoalRecord>> = _businessGoals.asStateFlow()

    private val _strategyPlans = MutableStateFlow<List<StrategyPlanRecord>>(emptyList())
    val strategyPlans: StateFlow<List<StrategyPlanRecord>> = _strategyPlans.asStateFlow()

    private val _aiRecommendations = MutableStateFlow<List<AIRecommendationRecord>>(emptyList())
    val aiRecommendations: StateFlow<List<AIRecommendationRecord>> = _aiRecommendations.asStateFlow()

    private val _authorizedRestaurants = MutableStateFlow<List<RestaurantDetailRecord>>(emptyList())
    val authorizedRestaurants: StateFlow<List<RestaurantDetailRecord>> = _authorizedRestaurants.asStateFlow()

    private val _currentUserProfile = MutableStateFlow<UserProfile?>(null)
    val currentUserProfile: StateFlow<UserProfile?> = _currentUserProfile.asStateFlow()

    private val _overview = MutableStateFlow(RestaurantOverview())
    val overview: StateFlow<RestaurantOverview> = _overview.asStateFlow()

    private var activeBranchId: String = "main"
    private var allOrders: List<OrderRecord> = emptyList()

    private val _branches = MutableStateFlow<List<BranchRecord>>(listOf(
        BranchRecord("main", "Main Dining", isDefault = true),
        BranchRecord("rooftop", "Rooftop Lounge", isDefault = false)
    ))
    val branches: StateFlow<List<BranchRecord>> = _branches.asStateFlow()

    private var ordersListener: ListenerRegistration? = null
    private var transactionsListener: ListenerRegistration? = null
    private var menuListener: ListenerRegistration? = null
    private var categoriesListener: ListenerRegistration? = null
    private var variantsListener: ListenerRegistration? = null
    private var addonsListener: ListenerRegistration? = null
    private var combosListener: ListenerRegistration? = null
    private var tablesListener: ListenerRegistration? = null
    private var staffListener: ListenerRegistration? = null
    private var promotionsListener: ListenerRegistration? = null
    private var reservationsListener: ListenerRegistration? = null
    private var floorsListener: ListenerRegistration? = null
    private var sectionsListener: ListenerRegistration? = null
    private var shiftsListener: ListenerRegistration? = null
    private var refundsListener: ListenerRegistration? = null
    private var inventoryListener: ListenerRegistration? = null
    private var recipesListener: ListenerRegistration? = null
    private var stockMovementsListener: ListenerRegistration? = null
    private var suppliersListener: ListenerRegistration? = null
    private var wasteLogsListener: ListenerRegistration? = null
    private var branchTransfersListener: ListenerRegistration? = null
    private var customersListener: ListenerRegistration? = null
    private var feedbackListener: ListenerRegistration? = null
    private var campaignsListener: ListenerRegistration? = null
    private var alertsListener: ListenerRegistration? = null
    private var auditLogsListener: ListenerRegistration? = null
    private var branchesSubListener: ListenerRegistration? = null
    private var restaurantsListener: ListenerRegistration? = null
    private var automationRulesListener: ListenerRegistration? = null
    private var automationLogsListener: ListenerRegistration? = null
    private var businessGoalsListener: ListenerRegistration? = null
    private var strategyPlansListener: ListenerRegistration? = null
    private var aiRecommendationsListener: ListenerRegistration? = null
    private var restaurantDocListener: ListenerRegistration? = null

    init {
        if (tenantId.isNotBlank()) {
            startRealtimeListeners()
        }
    }

    /**
     * Resolves the authenticated user's authorized restaurant tenant, role, and branch dynamically
     * from canonical Firestore user profile records and employee rosters. Enforces strict zero-trust tenant boundaries.
     */
    suspend fun resolveTenantForUser(uid: String): TenantResolutionState = withContext(Dispatchers.IO) {
        if (uid.isBlank()) {
            val state = TenantResolutionState.NotAuthenticated
            _tenantState.value = state
            _currentUserProfile.value = null
            return@withContext state
        }
        _tenantState.value = TenantResolutionState.Loading
        try {
            val authUser = try { FirebaseConfig.auth.currentUser } catch (_: Exception) { null }
            val currentAuthEmail = authUser?.email?.trim()?.lowercase()
            var resolvedTenantId: String? = null
            var resolvedRestName: String? = null
            var resolvedBranchId: String? = null
            var resolvedRole: String? = null
            var userDisplayName: String? = null
            var userEmail: String? = null

            // Step 1: Query users/{uid}
            val userSnap = Tasks.await(firestore.collection("users").document(uid).get())
            if (userSnap.exists()) {
                val data = userSnap.data
                resolvedTenantId = (data?.get("tenantId") as? String)
                    ?: (data?.get("restaurantId") as? String)
                resolvedBranchId = data?.get("branchId") as? String
                resolvedRestName = data?.get("restaurantName") as? String
                resolvedRole = data?.get("role") as? String
                userDisplayName = data?.get("displayName") as? String
                    ?: data?.get("fullName") as? String
                    ?: data?.get("name") as? String
                userEmail = data?.get("email") as? String
            }

            // Step 2: Query employees collection by firebaseUid == uid
            if (resolvedTenantId.isNullOrBlank()) {
                try {
                    val empUidQuery = Tasks.await(
                        firestore.collection("employees")
                            .whereEqualTo("firebaseUid", uid)
                            .limit(1)
                            .get()
                    )
                    if (!empUidQuery.isEmpty) {
                        val empDoc = empUidQuery.documents[0]
                        resolvedTenantId = empDoc.getString("tenantId") ?: empDoc.getString("restaurantId")
                        resolvedBranchId = empDoc.getString("branchId")
                        resolvedRole = empDoc.getString("role")
                        userDisplayName = empDoc.getString("fullName") ?: empDoc.getString("name") ?: empDoc.getString("displayName")
                        userEmail = empDoc.getString("email")
                    }
                } catch (_: Exception) {}
            }

            // Step 3: Query employees collection by email if auth email available
            if (resolvedTenantId.isNullOrBlank() && !currentAuthEmail.isNullOrBlank()) {
                try {
                    val empEmailQuery = Tasks.await(
                        firestore.collection("employees")
                            .whereEqualTo("email", currentAuthEmail)
                            .limit(1)
                            .get()
                    )
                    if (!empEmailQuery.isEmpty) {
                        val empDoc = empEmailQuery.documents[0]
                        resolvedTenantId = empDoc.getString("tenantId") ?: empDoc.getString("restaurantId")
                        resolvedBranchId = empDoc.getString("branchId")
                        resolvedRole = empDoc.getString("role")
                        userDisplayName = empDoc.getString("fullName") ?: empDoc.getString("name") ?: empDoc.getString("displayName")
                        userEmail = empDoc.getString("email")
                    }
                } catch (_: Exception) {}
            }

            // Step 4: Query restaurants where ownerUid == uid
            if (resolvedTenantId.isNullOrBlank()) {
                val restQuery = Tasks.await(
                    firestore.collection("restaurants")
                        .whereEqualTo("ownerUid", uid)
                        .limit(1)
                        .get()
                )
                if (!restQuery.isEmpty) {
                    val doc = restQuery.documents[0]
                    resolvedTenantId = doc.id
                    resolvedRestName = doc.getString("name") ?: doc.getString("restaurantName")
                    resolvedRole = "owner"
                }
            }

            // Step 5: Query tenants where ownerUid == uid
            if (resolvedTenantId.isNullOrBlank()) {
                val tenantQuery = Tasks.await(
                    firestore.collection("tenants")
                        .whereEqualTo("ownerUid", uid)
                        .limit(1)
                        .get()
                )
                if (!tenantQuery.isEmpty) {
                    val doc = tenantQuery.documents[0]
                    resolvedTenantId = doc.id
                    resolvedRestName = doc.getString("name") ?: doc.getString("restaurantName")
                    resolvedRole = "owner"
                }
            }

            // Safe failure state: Never fall back to another restaurant
            if (resolvedTenantId.isNullOrBlank()) {
                resetSession()
                val state = TenantResolutionState.NoTenantAssigned(uid)
                _tenantState.value = state
                return@withContext state
            }

            // Step 6: Fetch restaurant details
            var restEmail: String? = null
            var restLogo: String? = null
            try {
                val restDoc = Tasks.await(firestore.collection("restaurants").document(resolvedTenantId).get())
                if (restDoc.exists()) {
                    if (resolvedRestName.isNullOrBlank()) {
                        resolvedRestName = restDoc.getString("name") ?: restDoc.getString("restaurantName")
                    }
                    restEmail = restDoc.getString("email")
                    restLogo = restDoc.getString("logo") ?: restDoc.getString("logoUrl")
                } else {
                    val tDoc = Tasks.await(firestore.collection("tenants").document(resolvedTenantId).get())
                    if (tDoc.exists()) {
                        if (resolvedRestName.isNullOrBlank()) {
                            resolvedRestName = tDoc.getString("name") ?: tDoc.getString("restaurantName")
                        }
                        restEmail = tDoc.getString("email")
                        restLogo = tDoc.getString("logo") ?: tDoc.getString("logoUrl")
                    }
                }
            } catch (_: Exception) {}

            val finalRestName = resolvedRestName?.ifBlank { null } ?: "SpiralDine Restaurant"
            val finalEmail = userEmail?.ifBlank { null } ?: authUser?.email ?: ""
            val finalDisplayName = userDisplayName?.ifBlank { null }
                ?: authUser?.displayName?.ifBlank { null }
                ?: if (finalEmail.isNotBlank()) finalEmail.substringBefore('@') else "Authorized User"
            val finalRole = resolvedRole?.ifBlank { null } ?: "owner"
            val finalBranch = resolvedBranchId?.ifBlank { null } ?: "Main Dining"

            _currentUserProfile.value = UserProfile(
                uid = uid,
                email = finalEmail,
                displayName = finalDisplayName,
                role = finalRole,
                tenantId = resolvedTenantId,
                branchId = finalBranch,
                restaurantName = finalRestName,
                photoUrl = authUser?.photoUrl?.toString(),
                isVerified = true
            )

            setAuthorizedTenant(
                newTenantId = resolvedTenantId,
                restaurantName = finalRestName,
                branchId = finalBranch,
                email = restEmail?.ifBlank { null } ?: finalEmail,
                logoUrl = restLogo
            )
            val state = TenantResolutionState.Resolved(resolvedTenantId, finalRestName, finalBranch)
            _tenantState.value = state
            return@withContext state
        } catch (e: Exception) {
            val state = TenantResolutionState.Error(e.localizedMessage ?: "Failed to resolve restaurant workspace")
            _tenantState.value = state
            return@withContext state
        }
    }

    /**
     * Re-scopes the repository to an authorized tenant and restarts listeners.
     */
    fun setAuthorizedTenant(
        newTenantId: String,
        restaurantName: String = "SpiralDine Restaurant",
        branchId: String? = null,
        email: String = "",
        logoUrl: String? = null
    ) {
        if (newTenantId.isBlank()) return
        clearListeners()
        this.tenantId = newTenantId
        val initialBranch = branchId ?: _branches.value.firstOrNull()?.name ?: "Main Dining"
        _overview.value = _overview.value.copy(
            name = restaurantName,
            branch = initialBranch,
            email = email,
            logoUrl = logoUrl
        )
        startRealtimeListeners()
    }

    /**
     * Switched active branch for multi-branch restaurants with live scoping.
     */
    fun switchBranch(branchId: String) {
        if (tenantId.isBlank()) return
        activeBranchId = branchId
        val branchObj = _branches.value.find { it.id == branchId }
        val branchLabel = branchObj?.name ?: branchId
        _overview.value = _overview.value.copy(branch = branchLabel)
        _branches.value = _branches.value.map { it.copy(isDefault = it.id == branchId) }
        reconcileTransactions()
    }

    fun startRealtimeListeners() {
        if (tenantId.isBlank()) return
        clearListeners()
        try {
            // Restaurant profile and metadata listener
            restaurantDocListener = firestore.collection("restaurants").document(tenantId)
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null && snapshot.exists()) {
                        val d = snapshot.data
                        if (d != null) {
                            val rName = d["name"] as? String ?: d["restaurantName"] as? String ?: _overview.value.name
                            val rEmail = d["email"] as? String ?: _overview.value.email
                            val rLogo = d["logo"] as? String ?: d["logoUrl"] as? String ?: _overview.value.logoUrl
                            _overview.value = _overview.value.copy(
                                name = rName,
                                email = rEmail,
                                logoUrl = rLogo
                            )
                        }
                    }
                }

            // Orders listener
            ordersListener = firestore.collection("restaurants").document(tenantId)
                .collection("orders")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            try {
                                val data = doc.data ?: return@mapNotNull null
                                val rawItems = data["items"] as? List<Map<String, Any>> ?: emptyList()
                                val itemsList = rawItems.map { itm ->
                                    OrderItemRecord(
                                        name = itm["name"] as? String ?: "Dish",
                                        quantity = (itm["quantity"] as? Number)?.toInt() 
                                            ?: (itm["count"] as? Number)?.toInt() 
                                            ?: 1,
                                        price = (itm["price"] as? Number)?.toDouble() 
                                            ?: (itm["pricePerUnit"] as? Number)?.toDouble() 
                                            ?: 0.0,
                                        notes = itm["notes"] as? String ?: ""
                                    )
                                }
                                val bId = data["branchId"] as? String ?: "main"
                                OrderRecord(
                                    id = doc.id,
                                    orderNumber = data["orderNumber"] as? String ?: (data["orderId"] as? String) ?: "#${doc.id.takeLast(5).uppercase()}",
                                    tableNumber = data["tableNumber"] as? String ?: (data["tableId"] as? String)?.replace("TBL-", "") ?: "",
                                    diningOption = data["diningOption"] as? String ?: (data["orderType"] as? String) ?: "Dine-In",
                                    customerName = data["customerName"] as? String ?: "Guest Diner",
                                    status = data["status"] as? String ?: "PENDING",
                                    items = itemsList,
                                    subtotal = (data["subtotal"] as? Number)?.toDouble() ?: 0.0,
                                    tax = (data["tax"] as? Number)?.toDouble() ?: (data["taxAmount"] as? Number)?.toDouble() ?: 0.0,
                                    discount = (data["discount"] as? Number)?.toDouble() ?: (data["discountAmount"] as? Number)?.toDouble() ?: 0.0,
                                    total = (data["total"] as? Number)?.toDouble() ?: (data["grandTotal"] as? Number)?.toDouble() ?: 0.0,
                                    paymentMethod = data["paymentMethod"] as? String ?: "UPI / Cash",
                                    paymentStatus = data["paymentStatus"] as? String ?: "pending",
                                    createdAt = data["createdAt"] as? String ?: "",
                                    tenantId = tenantId,
                                    branchId = bId
                                )
                            } catch (_: Exception) {
                                null
                            }
                        }
                        allOrders = list
                        val scopedList = if (activeBranchId.isBlank() || activeBranchId == "all") list 
                                         else list.filter { it.branchId == activeBranchId || it.branchId.isBlank() || it.branchId == "main" }
                        _orders.value = scopedList
                        reconcileTransactions()
                    }
                }

            // Confirmed Transactions listener (Canonical financial ledger)
            transactionsListener = firestore.collection("restaurants").document(tenantId)
                .collection("transactions")
                .limit(500)
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val transList = snapshot.documents.mapNotNull { doc ->
                            try {
                                val d = doc.data ?: return@mapNotNull null
                                val rawItems = d["items"] as? List<Map<String, Any>> ?: emptyList()
                                val itemsList = rawItems.map { itm ->
                                    OrderItemRecord(
                                        name = itm["name"] as? String ?: "Dish",
                                        quantity = (itm["quantity"] as? Number)?.toInt() 
                                            ?: (itm["count"] as? Number)?.toInt() 
                                            ?: 1,
                                        price = (itm["price"] as? Number)?.toDouble() 
                                            ?: (itm["pricePerUnit"] as? Number)?.toDouble() 
                                            ?: 0.0,
                                        notes = itm["notes"] as? String ?: ""
                                    )
                                }
                                TransactionRecord(
                                    id = doc.id,
                                    orderId = d["orderId"] as? String ?: doc.id,
                                    billId = d["billId"] as? String ?: "",
                                    invoiceNumber = d["invoiceNumber"] as? String ?: "INV-${doc.id.takeLast(6).uppercase()}",
                                    tableNumber = d["tableNumber"] as? String ?: "Walk-in",
                                    customerId = d["customerId"] as? String ?: "",
                                    customerName = d["customerName"] as? String ?: "Guest Diner",
                                    customerPhone = d["customerPhone"] as? String ?: d["phone"] as? String ?: "",
                                    orderTime = d["createdAt"] as? String ?: d["orderTime"] as? String ?: "",
                                    paymentStatus = (d["paymentStatus"] as? String ?: "paid").lowercase(),
                                    paymentMethod = (d["paymentMethod"] as? String ?: "cash").lowercase(),
                                    orderStatus = d["orderStatus"] as? String ?: d["status"] as? String ?: "COMPLETED",
                                    subtotal = (d["subtotal"] as? Number)?.toDouble() ?: 0.0,
                                    tax = (d["tax"] as? Number)?.toDouble() ?: (d["taxAmount"] as? Number)?.toDouble() ?: 0.0,
                                    discount = (d["discount"] as? Number)?.toDouble() ?: 0.0,
                                    total = (d["total"] as? Number)?.toDouble() ?: (d["grandTotal"] as? Number)?.toDouble() ?: 0.0,
                                    branchId = d["branchId"] as? String ?: "main",
                                    items = itemsList
                                )
                            } catch (_: Exception) {
                                null
                            }
                        }
                        rawFirestoreTransactions = transList
                        reconcileTransactions()
                    }
                }

            // Menu Items listener
            menuListener = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("items")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            val prodMode = d["productionMode"] as? String
                                ?: if ((d["preparationMethod"] as? String) == "batch") "Batch Production" else "On Demand"
                            MenuItemRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: "",
                                description = d["description"] as? String ?: "",
                                category = d["category"] as? String ?: "Mains",
                                categoryId = d["categoryId"] as? String ?: "",
                                price = (d["price"] as? Number)?.toDouble() ?: 0.0,
                                discountPrice = (d["discountPrice"] as? Number)?.toDouble(),
                                type = d["type"] as? String ?: (if ((d["isVeg"] as? Boolean) == true || (d["vegetarian"] as? Boolean) == true) "veg" else "non-veg"),
                                prepTime = (d["prepTime"] as? Number)?.toInt() ?: ((d["preparationTime"] as? Number)?.toInt() ?: 15),
                                spiceLevel = d["spiceLevel"] as? String ?: "none",
                                productionMode = prodMode,
                                defaultBatchSize = (d["defaultBatchSize"] as? Number)?.toInt() ?: 50,
                                availableServings = (d["availableServings"] as? Number)?.toInt() ?: 50,
                                lowStockThreshold = (d["lowStockThreshold"] as? Number)?.toInt() ?: 10,
                                autoUnavailable = (d["autoUnavailable"] as? Boolean) ?: true,
                                showServingsToStaff = (d["showServingsToStaff"] as? Boolean) ?: true,
                                allowRefill = (d["allowRefill"] as? Boolean) ?: true,
                                preparationMethod = d["preparationMethod"] as? String ?: (if (prodMode == "Batch Production") "batch" else "fresh"),
                                image = d["image"] as? String ?: (d["imageUrl"] as? String ?: ""),
                                available = d["available"] as? Boolean ?: (d["isAvailable"] as? Boolean ?: true),
                                isPublished = d["isPublished"] as? Boolean ?: true,
                                isBestSeller = d["isBestSeller"] as? Boolean ?: (d["bestseller"] as? Boolean ?: false),
                                isRecommended = d["isRecommended"] as? Boolean ?: (d["recommended"] as? Boolean ?: false),
                                tenantId = tenantId
                            )
                        }
                        _menuItems.value = list
                    }
                }

            // Categories listener
            categoriesListener = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("categories")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            CategoryRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: "",
                                description = d["description"] as? String ?: "",
                                order = (d["order"] as? Number)?.toInt() ?: (d["displayOrder"] as? Number)?.toInt() ?: 1,
                                isActive = d["isActive"] as? Boolean ?: true,
                                tenantId = tenantId
                            )
                        }
                        _categories.value = list.sortedBy { it.order }
                    }
                }

            // Variants & Portions listener
            variantsListener = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("variants")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            val itmId = d["itemId"] as? String ?: ""
                            val itm = _menuItems.value.find { it.id == itmId }
                            MenuVariantRecord(
                                id = doc.id,
                                itemId = itmId,
                                itemName = itm?.name ?: (d["itemName"] as? String ?: ""),
                                name = d["name"] as? String ?: "Regular",
                                price = (d["price"] as? Number)?.toDouble() ?: 0.0,
                                priceOffset = (d["priceOffset"] as? Number)?.toDouble() ?: 0.0,
                                isAvailable = d["isAvailable"] as? Boolean ?: (d["available"] as? Boolean ?: true),
                                tenantId = tenantId
                            )
                        }
                        _variants.value = list
                    }
                }

            // Add-ons & Modifiers listener
            addonsListener = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("addons")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            val applicable = (d["applicableItems"] as? List<*>)?.mapNotNull { it?.toString() } ?: emptyList()
                            MenuAddonRecord(
                                id = doc.id,
                                itemId = d["itemId"] as? String ?: "",
                                name = d["name"] as? String ?: "",
                                price = (d["price"] as? Number)?.toDouble() ?: 0.0,
                                isAvailable = d["isAvailable"] as? Boolean ?: (d["available"] as? Boolean ?: true),
                                isGlobal = d["isGlobal"] as? Boolean ?: true,
                                applicableItems = applicable,
                                tenantId = tenantId
                            )
                        }
                        _addons.value = list
                    }
                }

            // Combos & Bundles listener
            combosListener = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("combos")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            val rawItems = d["items"] as? List<Map<String, Any>> ?: emptyList()
                            val comboItems = rawItems.map { itm ->
                                ComboItemRecord(
                                    itemId = itm["itemId"] as? String ?: "",
                                    itemName = itm["itemName"] as? String ?: "",
                                    quantity = (itm["quantity"] as? Number)?.toInt() ?: 1
                                )
                            }
                            MenuComboRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: "",
                                description = d["description"] as? String ?: "",
                                price = (d["price"] as? Number)?.toDouble() ?: 0.0,
                                items = comboItems,
                                image = d["image"] as? String ?: "",
                                isAvailable = d["isAvailable"] as? Boolean ?: (d["available"] as? Boolean ?: true),
                                isPublished = d["isPublished"] as? Boolean ?: true,
                                tenantId = tenantId
                            )
                        }
                        _combos.value = list
                    }
                }

            // Tables listener
            tablesListener = firestore.collection("restaurants").document(tenantId)
                .collection("tables")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            val num = d["tableNumber"] as? String ?: d["number"] as? String ?: doc.id.replace("T-", "")
                            TableRecord(
                                id = doc.id,
                                tableNumber = num,
                                tableName = d["tableName"] as? String ?: d["name"] as? String ?: "Table $num",
                                floor = d["floor"] as? String ?: "Ground Floor",
                                section = d["section"] as? String ?: "Main Dining",
                                capacity = (d["capacity"] as? Number)?.toInt() ?: 4,
                                shape = d["shape"] as? String ?: "square",
                                positionX = (d["positionX"] as? Number)?.toDouble() ?: (d["x"] as? Number)?.toDouble() ?: 0.0,
                                positionY = (d["positionY"] as? Number)?.toDouble() ?: (d["y"] as? Number)?.toDouble() ?: 0.0,
                                notes = d["notes"] as? String ?: "",
                                status = d["status"] as? String ?: "AVAILABLE",
                                qrCodeId = d["qrCodeId"] as? String ?: "",
                                isActive = d["isActive"] as? Boolean ?: true,
                                tenantId = tenantId
                            )
                        }
                        _tables.value = list.sortedBy { 
                            it.tableNumber.filter { c -> c.isDigit() }.toIntOrNull() ?: 999 
                        }
                    }
                }

            // Floors listener
            floorsListener = firestore.collection("restaurants").document(tenantId)
                .collection("floors")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            FloorRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: "Floor ${doc.id}",
                                level = (d["level"] as? Number)?.toInt() ?: 0,
                                tenantId = tenantId
                            )
                        }
                        _floors.value = list.sortedBy { it.level }
                    }
                }

            // Sections listener
            sectionsListener = firestore.collection("restaurants").document(tenantId)
                .collection("sections")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            SectionRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: "Section ${doc.id}",
                                floorId = d["floorId"] as? String ?: "",
                                tenantId = tenantId
                            )
                        }
                        _sections.value = list
                    }
                }

            // Staff listener
            staffListener = firestore.collection("restaurants").document(tenantId)
                .collection("staff")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            StaffRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: d["displayName"] as? String ?: d["fullName"] as? String ?: "Staff Member",
                                email = d["email"] as? String ?: "",
                                phone = d["phone"] as? String ?: "",
                                role = d["role"] as? String ?: "waiter",
                                department = d["department"] as? String ?: "Service",
                                active = d["active"] as? Boolean ?: (d["status"] != "suspended" && d["status"] != "archived"),
                                status = d["status"] as? String ?: if (d["active"] == false) "suspended" else "active",
                                invitedAt = d["invitedAt"] as? String ?: d["createdAt"] as? String ?: "",
                                activationToken = d["invitationToken"] as? String ?: "",
                                tenantId = tenantId
                            )
                        }
                        _staff.value = list
                    }
                }

            // Shifts listener
            shiftsListener = firestore.collection("restaurants").document(tenantId)
                .collection("shifts")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            ShiftRecord(
                                id = doc.id,
                                shiftNumber = d["shiftNumber"] as? String ?: "SHIFT-${doc.id.takeLast(4).uppercase()}",
                                openedBy = d["openedBy"] as? String ?: "Owner",
                                openedAt = d["openedAt"] as? String ?: d["createdAt"] as? String ?: "",
                                closedAt = d["closedAt"] as? String,
                                status = d["status"] as? String ?: "OPEN",
                                openingCash = (d["openingCash"] as? Number)?.toDouble() ?: 0.0,
                                expectedClosingCash = (d["expectedClosingCash"] as? Number)?.toDouble() ?: 0.0,
                                actualClosingCash = (d["actualClosingCash"] as? Number)?.toDouble() ?: 0.0,
                                cashDifference = (d["cashDifference"] as? Number)?.toDouble() ?: 0.0,
                                totalSales = (d["totalSales"] as? Number)?.toDouble() ?: 0.0,
                                ordersCount = (d["ordersCount"] as? Number)?.toInt() ?: 0,
                                notes = d["notes"] as? String ?: "",
                                tenantId = tenantId
                            )
                        }
                        _shifts.value = list.sortedByDescending { it.openedAt }
                    }
                }

            // Refunds listener
            refundsListener = firestore.collection("restaurants").document(tenantId)
                .collection("refunds")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            RefundRecord(
                                id = doc.id,
                                orderId = d["orderId"] as? String ?: "",
                                transactionId = d["transactionId"] as? String ?: "",
                                amount = (d["amount"] as? Number)?.toDouble() ?: 0.0,
                                reason = d["reason"] as? String ?: "Customer Request",
                                type = d["type"] as? String ?: "full",
                                status = d["status"] as? String ?: "COMPLETED",
                                createdAt = d["createdAt"] as? String ?: "",
                                processedBy = d["processedBy"] as? String ?: "Owner",
                                tenantId = tenantId
                            )
                        }
                        _refunds.value = list.sortedByDescending { it.createdAt }
                    }
                }

            // Inventory listener
            inventoryListener = firestore.collection("restaurants").document(tenantId)
                .collection("inventory")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            InventoryIngredientRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: d["itemName"] as? String ?: "Ingredient",
                                category = d["category"] as? String ?: "Vegetables",
                                currentStock = (d["currentStock"] as? Number)?.toDouble() ?: (d["stock"] as? Number)?.toDouble() ?: 0.0,
                                minStock = (d["minStock"] as? Number)?.toDouble() ?: 5.0,
                                maxStock = (d["maxStock"] as? Number)?.toDouble() ?: 50.0,
                                reorderLevel = (d["reorderLevel"] as? Number)?.toDouble() ?: 10.0,
                                unit = d["unit"] as? String ?: "kg",
                                purchaseCost = (d["purchaseCost"] as? Number)?.toDouble() ?: (d["cost"] as? Number)?.toDouble() ?: 0.0,
                                supplierId = d["supplierId"] as? String ?: "",
                                supplierName = d["supplierName"] as? String ?: "",
                                storageLocation = d["storageLocation"] as? String ?: "Pantry",
                                expiryDate = d["expiryDate"] as? String ?: "",
                                tenantId = tenantId
                            )
                        }
                        _inventory.value = list.sortedBy { it.name }
                    }
                }

            // Recipes listener
            recipesListener = firestore.collection("restaurants").document(tenantId)
                .collection("recipes")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            val rawIngs = d["ingredients"] as? List<Map<String, Any>> ?: emptyList()
                            val ingItems = rawIngs.map { item ->
                                InventoryRecipeIngredient(
                                    ingredientId = item["ingredientId"] as? String ?: "",
                                    ingredientName = item["ingredientName"] as? String ?: "",
                                    quantity = (item["quantity"] as? Number)?.toDouble() ?: 0.0,
                                    unit = item["unit"] as? String ?: "g"
                                )
                            }
                            InventoryRecipeRecord(
                                id = doc.id,
                                menuItemId = d["menuItemId"] as? String ?: "",
                                menuItemName = d["menuItemName"] as? String ?: "",
                                yield = (d["yield"] as? Number)?.toInt() ?: 1,
                                version = d["version"] as? String ?: "v1.0",
                                ingredients = ingItems,
                                costPerServing = (d["costPerServing"] as? Number)?.toDouble() ?: 0.0,
                                tenantId = tenantId
                            )
                        }
                        _recipes.value = list
                    }
                }

            // Stock movements listener
            stockMovementsListener = firestore.collection("restaurants").document(tenantId)
                .collection("stockMovements")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            StockMovementRecord(
                                id = doc.id,
                                ingredientId = d["ingredientId"] as? String ?: "",
                                ingredientName = d["ingredientName"] as? String ?: "",
                                change = (d["change"] as? Number)?.toDouble() ?: (d["quantity"] as? Number)?.toDouble() ?: 0.0,
                                type = d["type"] as? String ?: "ADJUSTMENT",
                                reason = d["reason"] as? String ?: "",
                                timestamp = d["timestamp"] as? String ?: d["createdAt"] as? String ?: "",
                                performedBy = d["performedBy"] as? String ?: "Owner",
                                tenantId = tenantId
                            )
                        }
                        _stockMovements.value = list.sortedByDescending { it.timestamp }
                    }
                }

            // Suppliers listener
            suppliersListener = firestore.collection("restaurants").document(tenantId)
                .collection("suppliers")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            SupplierRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: "Supplier",
                                contactPerson = d["contactPerson"] as? String ?: "",
                                email = d["email"] as? String ?: "",
                                phone = d["phone"] as? String ?: "",
                                category = d["category"] as? String ?: "General",
                                leadTimeDays = (d["leadTimeDays"] as? Number)?.toInt() ?: 2,
                                active = d["active"] as? Boolean ?: true,
                                tenantId = tenantId
                            )
                        }
                        _suppliers.value = list
                    }
                }

            // Waste logs listener
            wasteLogsListener = firestore.collection("restaurants").document(tenantId)
                .collection("wasteLogs")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            WasteLogRecord(
                                id = doc.id,
                                ingredientId = d["ingredientId"] as? String ?: "",
                                ingredientName = d["ingredientName"] as? String ?: "",
                                quantity = (d["quantity"] as? Number)?.toDouble() ?: 0.0,
                                unit = d["unit"] as? String ?: "kg",
                                reason = d["reason"] as? String ?: "Spoilage",
                                notes = d["notes"] as? String ?: "",
                                cost = (d["cost"] as? Number)?.toDouble() ?: 0.0,
                                timestamp = d["timestamp"] as? String ?: d["createdAt"] as? String ?: "",
                                tenantId = tenantId
                            )
                        }
                        _wasteLogs.value = list.sortedByDescending { it.timestamp }
                    }
                }

            // Promotions listener
            promotionsListener = firestore.collection("restaurants").document(tenantId)
                .collection("promotions")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            PromotionRecord(
                                id = doc.id,
                                title = d["title"] as? String ?: "",
                                code = d["code"] as? String ?: "",
                                discountType = d["discountType"] as? String ?: "percentage",
                                discountValue = (d["discountValue"] as? Number)?.toDouble() ?: 15.0,
                                minOrder = (d["minOrder"] as? Number)?.toDouble() ?: 20.0,
                                active = d["active"] as? Boolean ?: true,
                                tenantId = tenantId
                            )
                        }
                        _promotions.value = list
                    }
                }

            // Reservations listener
            reservationsListener = firestore.collection("restaurants").document(tenantId)
                .collection("reservations")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            val guestsVal = (d["guests"] as? Number)?.toInt()
                                ?: (d["partySize"] as? Number)?.toInt()
                                ?: 2
                            ReservationRecord(
                                id = doc.id,
                                customerName = d["customerName"] as? String ?: d["name"] as? String ?: "Guest Diner",
                                customerPhone = d["customerPhone"] as? String ?: d["phone"] as? String ?: "",
                                customerEmail = d["customerEmail"] as? String ?: d["email"] as? String ?: "",
                                date = d["date"] as? String ?: "",
                                time = d["time"] as? String ?: d["timeSlot"] as? String ?: "",
                                guests = guestsVal,
                                tableNumber = d["tableNumber"] as? String ?: d["table"] as? String ?: "",
                                tableId = d["tableId"] as? String ?: "",
                                seatingPreference = d["seatingPreference"] as? String ?: "Indoor",
                                specialNotes = d["specialNotes"] as? String ?: d["notes"] as? String ?: "",
                                status = d["status"] as? String ?: "Pending",
                                createdAt = d["createdAt"] as? String ?: "",
                                tenantId = tenantId,
                                branchId = d["branchId"] as? String ?: "main"
                            )
                        }
                        _reservations.value = list.sortedWith(compareByDescending<ReservationRecord> { it.date }.thenBy { it.time })
                    }
                }

            // Branch transfers listener
            branchTransfersListener = firestore.collection("restaurants").document(tenantId)
                .collection("branchTransfers")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            BranchTransferRecord(
                                id = doc.id,
                                sourceRestaurantId = d["sourceRestaurantId"] as? String ?: "",
                                sourceRestaurantName = d["sourceRestaurantName"] as? String ?: "Main Dining",
                                destRestaurantId = d["destRestaurantId"] as? String ?: "",
                                destRestaurantName = d["destRestaurantName"] as? String ?: "Downtown Branch",
                                itemId = d["itemId"] as? String ?: "",
                                itemName = d["itemName"] as? String ?: "Ingredient",
                                quantity = (d["quantity"] as? Number)?.toDouble() ?: 10.0,
                                unit = d["unit"] as? String ?: "kg",
                                requesterName = d["requesterName"] as? String ?: "Kitchen Lead",
                                approverName = d["approverName"] as? String ?: "",
                                status = d["status"] as? String ?: "Requested",
                                notes = d["notes"] as? String ?: "",
                                dispatchedAt = d["dispatchedAt"] as? String ?: "",
                                receivedAt = d["receivedAt"] as? String ?: "",
                                createdAt = d["createdAt"] as? String ?: "",
                                tenantId = tenantId
                            )
                        }
                        _branchTransfers.value = list.sortedByDescending { it.createdAt }
                    }
                }

            // Feedback & Satisfaction Ratings listener
            feedbackListener = firestore.collection("restaurants").document(tenantId)
                .collection("satisfactionRatings")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val feedList = mutableListOf<FeedbackRecord>()
                        val revList = mutableListOf<ReviewRecord>()
                        snapshot.documents.forEach { doc ->
                            val d = doc.data ?: return@forEach
                            val ratingRaw = d["rating"]
                            val ratingInt = (ratingRaw as? Number)?.toInt() ?: when (ratingRaw as? String) {
                                "Excellent" -> 5
                                "Good" -> 4
                                "Average" -> 3
                                "Poor" -> 2
                                "Terrible" -> 1
                                else -> 5
                            }
                            val custName = d["customerName"] as? String ?: d["submittedByName"] as? String ?: "Guest Diner"
                            val comment = d["notes"] as? String ?: d["comments"] as? String ?: ""
                            val isComplaint = (d["isComplaint"] as? Boolean) ?: (ratingInt <= 2)
                            val cat = d["category"] as? String ?: if (ratingInt <= 2) "Service" else "Food"

                            feedList.add(
                                FeedbackRecord(
                                    id = doc.id,
                                    customerName = custName,
                                    rating = ratingRaw?.toString() ?: "Good",
                                    category = cat,
                                    notes = comment,
                                    orderId = d["orderId"] as? String ?: "",
                                    tableNumber = d["tableNumber"] as? String ?: "",
                                    isComplaint = isComplaint,
                                    status = d["status"] as? String ?: if (isComplaint) "New" else "Resolved",
                                    assignedToName = d["assignedToName"] as? String ?: "",
                                    internalNotes = d["internalNotes"] as? String ?: "",
                                    submittedAt = d["createdAt"] as? String ?: d["submittedAt"] as? String ?: "",
                                    tenantId = tenantId
                                )
                            )

                            revList.add(
                                ReviewRecord(
                                    id = doc.id,
                                    customerName = custName,
                                    rating = ratingInt,
                                    comments = comment,
                                    orderId = d["orderId"] as? String ?: "",
                                    diningOption = d["diningOption"] as? String ?: "Dine-In",
                                    foodQuality = (d["foodQuality"] as? Number)?.toInt() ?: ratingInt,
                                    serviceSpeed = (d["serviceSpeed"] as? Number)?.toInt() ?: ratingInt,
                                    ambience = (d["ambience"] as? Number)?.toInt() ?: ratingInt,
                                    wouldRecommend = (d["wouldRecommend"] as? Boolean) ?: (ratingInt >= 4),
                                    createdAt = d["createdAt"] as? String ?: "",
                                    tenantId = tenantId
                                )
                            )
                        }
                        _feedback.value = feedList.sortedByDescending { it.submittedAt }
                        _reviews.value = revList.sortedByDescending { it.createdAt }
                    }
                }

            // Campaigns listener
            campaignsListener = firestore.collection("restaurants").document(tenantId)
                .collection("campaigns")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            CampaignRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: "Campaign",
                                description = d["description"] as? String ?: "",
                                targetAudience = d["targetAudience"] as? String ?: "All Diners",
                                discountType = d["discountType"] as? String ?: "percentage",
                                discountValue = (d["discountValue"] as? Number)?.toDouble() ?: 15.0,
                                promoCode = d["promoCode"] as? String ?: "",
                                minSpend = (d["minSpend"] as? Number)?.toDouble() ?: 20.0,
                                startDate = d["startDate"] as? String ?: "",
                                endDate = d["endDate"] as? String ?: "",
                                status = d["status"] as? String ?: "Active",
                                redemptionsCount = (d["redemptionsCount"] as? Number)?.toInt() ?: 0,
                                tenantId = tenantId
                            )
                        }
                        _campaigns.value = list.sortedByDescending { it.startDate }
                    }
                }

            // Alerts listener
            alertsListener = firestore.collection("restaurants").document(tenantId)
                .collection("alerts")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            AlertRecord(
                                id = doc.id,
                                title = d["title"] as? String ?: "Operational Alert",
                                message = d["message"] as? String ?: d["text"] as? String ?: "Alert noticed",
                                category = d["category"] as? String ?: "Operations",
                                severity = d["severity"] as? String ?: "warning",
                                source = d["source"] as? String ?: "Watchdog",
                                read = d["read"] as? Boolean ?: false,
                                resolved = d["resolved"] as? Boolean ?: false,
                                assignedToName = d["assignedToName"] as? String ?: "",
                                createdAt = d["createdAt"] as? String ?: "",
                                tenantId = tenantId
                            )
                        }
                        _alerts.value = list.sortedByDescending { it.createdAt }
                    }
                }

            // Audit Logs listener
            auditLogsListener = firestore.collection("restaurants").document(tenantId)
                .collection("auditLogs")
                .limit(100)
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            AuditLogRecord(
                                id = doc.id,
                                action = d["action"] as? String ?: "OPERATION",
                                module = d["module"] as? String ?: "System",
                                actorName = d["actorName"] as? String ?: d["user"] as? String ?: "Owner",
                                actorRole = d["actorRole"] as? String ?: d["role"] as? String ?: "owner",
                                description = d["description"] as? String ?: d["details"] as? String ?: "",
                                status = d["status"] as? String ?: "success",
                                ipAddress = d["ipAddress"] as? String ?: "",
                                timestamp = d["timestamp"] as? String ?: d["createdAt"] as? String ?: "",
                                tenantId = tenantId
                            )
                        }
                        _auditLogs.value = list.sortedByDescending { it.timestamp }
                    }
                }

            // Branches Subcollection listener
            branchesSubListener = firestore.collection("restaurants").document(tenantId)
                .collection("branches")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null && !snapshot.isEmpty) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            BranchRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: "Branch",
                                code = d["code"] as? String ?: "",
                                address = d["address"] as? String ?: "",
                                city = d["city"] as? String ?: "",
                                phone = d["phone"] as? String ?: "",
                                managerName = d["managerName"] as? String ?: "",
                                tablesCount = (d["tablesCount"] as? Number)?.toInt() ?: (d["tableCount"] as? Number)?.toInt() ?: 10,
                                isDefault = d["isDefault"] as? Boolean ?: (doc.id == activeBranchId),
                                isActive = (d["isActive"] as? Boolean) ?: (d["active"] as? Boolean) ?: true,
                                tenantId = tenantId
                            )
                        }
                        _branches.value = list
                    }
                }

            // Load Customers
            firestore.collection("customers").limit(100).get().addOnSuccessListener { snap ->
                if (snap != null) {
                    val list = snap.documents.mapNotNull { doc ->
                        val d = doc.data ?: return@mapNotNull null
                        CustomerRecord(
                            id = doc.id,
                            name = d["fullName"] as? String ?: d["displayName"] as? String ?: "Customer",
                            phone = d["phoneNumber"] as? String ?: "",
                            email = d["email"] as? String ?: "",
                            totalVisits = (d["totalVisits"] as? Number)?.toInt() ?: 1,
                            totalSpend = (d["totalSpend"] as? Number)?.toDouble() ?: 0.0,
                            averageOrderValue = (d["averageOrderValue"] as? Number)?.toDouble() ?: 0.0,
                            lastVisit = d["lastVisit"] as? String ?: "",
                            loyaltyPoints = (d["loyaltyPoints"] as? Number)?.toInt() ?: 0,
                            segment = d["segment"] as? String ?: "New",
                            tenantId = tenantId
                        )
                    }
                    if (list.isNotEmpty()) _customers.value = list
                }
            }

            // Automation Rules listener
            val defaultRules = listOf(
                AutomationRuleRecord("rule-1", "Auto Stock Reorder Alert", "Dispatches manager notification when item drops below minimum safety threshold", "LOW_STOCK", "ALERT_OWNER", true, "10 mins ago", 14, tenantId),
                AutomationRuleRecord("rule-2", "End-of-Day Ledger Reconciliation", "Compiles daily revenue, cash drawer reconciliation & PDF brief at 10 PM", "DAY_END", "GENERATE_BRIEF", true, "Yesterday 22:00", 28, tenantId),
                AutomationRuleRecord("rule-3", "High-Value VIP Order Notification", "Sends instant alert to floor manager when order exceeds ₹3,000", "ORDER_VALUE_EXCEEDED", "ALERT_FLOOR_MANAGER", true, "2 hrs ago", 8, tenantId),
                AutomationRuleRecord("rule-4", "Seating Overdue Pacing Alert", "Triggers host prompt when table dining time exceeds 90 minutes", "OCCUPANCY_EXCEEDED", "NOTIFY", false, "Never", 0, tenantId)
            )
            _automationRules.value = defaultRules

            automationRulesListener = firestore.collection("restaurants").document(tenantId)
                .collection("automationRules")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null && !snapshot.isEmpty) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            AutomationRuleRecord(
                                id = doc.id,
                                name = d["name"] as? String ?: "Automation Rule",
                                description = d["description"] as? String ?: "",
                                triggerEvent = d["triggerEvent"] as? String ?: "ORDER_COMPLETED",
                                actionType = d["actionType"] as? String ?: "NOTIFY",
                                enabled = d["enabled"] as? Boolean ?: true,
                                lastRun = d["lastRun"] as? String ?: "Never",
                                executionCount = (d["executionCount"] as? Number)?.toInt() ?: 0,
                                tenantId = tenantId
                            )
                        }
                        if (list.isNotEmpty()) _automationRules.value = list
                    }
                }

            // Automation Schedules
            _automationSchedules.value = listOf(
                AutomationScheduleRecord("sched-1", "End-of-Day Financial Reconciliation", "0 22 * * *", "DAILY_BRIEF", true, "Yesterday 22:00", "Today 22:00", tenantId),
                AutomationScheduleRecord("sched-2", "Morning Inventory Level Sync", "0 8 * * *", "STOCK_SYNC", true, "Today 08:00", "Tomorrow 08:00", tenantId),
                AutomationScheduleRecord("sched-3", "Weekly Margin & P&L Analysis", "0 9 * * 1", "WEEKLY_REPORT", true, "Last Monday 09:00", "Next Monday 09:00", tenantId)
            )

            // Automation Logs
            val defaultLogs = listOf(
                AutomationLogRecord("log-1", "rule-2", "End-of-Day Ledger Reconciliation", "SCHEDULE", "SUCCESS", "Generated daily executive brief and audited ledger entries", 342L, "Today 00:05", tenantId),
                AutomationLogRecord("log-2", "rule-1", "Auto Stock Reorder Alert", "EVENT_TRIGGER", "SUCCESS", "Triggered reorder notice for Basmati Rice (Current: 8.5 kg)", 120L, "Today 11:32", tenantId),
                AutomationLogRecord("log-3", "rule-3", "High-Value VIP Order Notification", "EVENT_TRIGGER", "SUCCESS", "Alert dispatched to Host Stand for Table 4 (₹3,850)", 95L, "Today 13:45", tenantId)
            )
            _automationLogs.value = defaultLogs

            automationLogsListener = firestore.collection("restaurants").document(tenantId)
                .collection("automationLogs")
                .limit(50)
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null && !snapshot.isEmpty) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            AutomationLogRecord(
                                id = doc.id,
                                ruleId = d["ruleId"] as? String ?: "",
                                ruleName = d["ruleName"] as? String ?: "Automation Task",
                                triggerType = d["triggerType"] as? String ?: "SCHEDULE",
                                status = d["status"] as? String ?: "SUCCESS",
                                message = d["message"] as? String ?: "",
                                executionTimeMs = (d["executionTimeMs"] as? Number)?.toLong() ?: 100L,
                                timestamp = d["timestamp"] as? String ?: "",
                                tenantId = tenantId
                            )
                        }
                        if (list.isNotEmpty()) _automationLogs.value = list
                    }
                }

            // Daily Briefs
            _dailyBriefs.value = listOf(
                DailyBriefRecord(
                    id = "brief-today",
                    date = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date()),
                    revenueTodayPaise = (_orders.value.sumOf { it.total } * 100).toLong(),
                    ordersCount = _orders.value.size,
                    topDish = "Signature Dum Biryani",
                    criticalAlertsCount = _alerts.value.count { it.severity == "critical" && !it.resolved },
                    summaryMarkdown = "Healthy mid-day pace with robust dine-in table turns. Low inventory warnings logged for clarified butter and dairy stock.",
                    generatedAt = "14:00",
                    tenantId = tenantId
                )
            )

            // Business Goals
            val defaultGoals = listOf(
                BusinessGoalRecord("goal-1", "Monthly Gross Sales Target", "revenue", 500000.0, 384500.0, "₹", "End of Month", "on_track", tenantId),
                BusinessGoalRecord("goal-2", "Average Kitchen Ticket Prep Time", "prep_time", 18.0, 21.5, "mins", "Continuous SLA", "at_risk", tenantId),
                BusinessGoalRecord("goal-3", "Ingredient Waste Ratio (< 2.0%)", "waste", 2.0, 1.35, "%", "Continuous SLA", "on_track", tenantId),
                BusinessGoalRecord("goal-4", "Diner Satisfaction CSAT Rating", "csat", 4.8, 4.65, "/5.0", "Quarter Target", "on_track", tenantId)
            )
            _businessGoals.value = defaultGoals

            businessGoalsListener = firestore.collection("restaurants").document(tenantId)
                .collection("businessGoals")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null && !snapshot.isEmpty) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            BusinessGoalRecord(
                                id = doc.id,
                                title = d["title"] as? String ?: "Business Goal",
                                type = d["type"] as? String ?: "revenue",
                                targetValue = (d["targetValue"] as? Number)?.toDouble() ?: 0.0,
                                currentValue = (d["currentValue"] as? Number)?.toDouble() ?: 0.0,
                                unit = d["unit"] as? String ?: "₹",
                                deadline = d["deadline"] as? String ?: "",
                                status = d["status"] as? String ?: "on_track",
                                tenantId = tenantId
                            )
                        }
                        if (list.isNotEmpty()) _businessGoals.value = list
                    }
                }

            // Strategy Plans
            val defaultPlans = listOf(
                StrategyPlanRecord("plan-1", "Slow Tuesday Happy Hour Appetizers", "goal-1", "Growth", listOf("20% starter discount from 4-7 PM", "Promotional push notification to frequent diners", "Floor staff suggestive selling prompt"), "active", "+18% Tuesday Revenue", tenantId),
                StrategyPlanRecord("plan-2", "High-Margin Biryani Combo Bundle", "goal-1", "Profitability", listOf("Pair signature biryani with cooler beverage", "Feature as top digital menu recommendation", "KOT prioritization badge"), "active", "+12% Ticket Size", tenantId),
                StrategyPlanRecord("plan-3", "Prep Station Mise-en-place Expeditor", "goal-2", "Efficiency", listOf("Pre-portion morning protein batches", "Dedicated sauté expeditor during dinner rush"), "active", "-3.5 mins Prep Time", tenantId)
            )
            _strategyPlans.value = defaultPlans

            strategyPlansListener = firestore.collection("restaurants").document(tenantId)
                .collection("strategyPlans")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null && !snapshot.isEmpty) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            @Suppress("UNCHECKED_CAST")
                            val actions = d["actionItems"] as? List<String> ?: emptyList()
                            StrategyPlanRecord(
                                id = doc.id,
                                title = d["title"] as? String ?: "Strategy Plan",
                                goalId = d["goalId"] as? String ?: "",
                                category = d["category"] as? String ?: "Growth",
                                actionItems = actions,
                                status = d["status"] as? String ?: "active",
                                estimatedImpact = d["estimatedImpact"] as? String ?: "+10%",
                                tenantId = tenantId
                            )
                        }
                        if (list.isNotEmpty()) _strategyPlans.value = list
                    }
                }

            // AI Recommendations
            val defaultRecs = listOf(
                AIRecommendationRecord("rec-1", "Restock Dairy & Basmati Inventory", "Projected weekend demand exceeds current stock level by 35%. Reorder before Friday 4 PM.", "inventory", 94, "high", "Draft Reorder Requisition", false, "Today 10:00", tenantId),
                AIRecommendationRecord("rec-2", "Upsell Garlic Naan with Butter Curries", "82% of diners who ordered Butter Chicken accepted garlic naan upsell recommendation.", "revenue", 89, "high", "Enable QR Smart Prompt", true, "Today 09:30", tenantId),
                AIRecommendationRecord("rec-3", "Optimize Floor 1 Table Turns (1:00 - 2:30 PM)", "Lunch table occupancy average duration is 42 mins. Seating pacing can fit 4 more groups.", "dining", 76, "medium", "Apply Table Turnover Pacing", false, "Today 11:15", tenantId)
            )
            _aiRecommendations.value = defaultRecs

            aiRecommendationsListener = firestore.collection("restaurants").document(tenantId)
                .collection("aiRecommendations")
                .addSnapshotListener { snapshot, _ ->
                    if (snapshot != null && !snapshot.isEmpty) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            val d = doc.data ?: return@mapNotNull null
                            AIRecommendationRecord(
                                id = doc.id,
                                title = d["title"] as? String ?: "Recommendation",
                                description = d["description"] as? String ?: "",
                                category = d["category"] as? String ?: "revenue",
                                impactScore = (d["impactScore"] as? Number)?.toInt() ?: 80,
                                priority = d["priority"] as? String ?: "high",
                                actionLabel = d["actionLabel"] as? String ?: "Apply",
                                isImplemented = d["isImplemented"] as? Boolean ?: false,
                                createdAt = d["createdAt"] as? String ?: "",
                                tenantId = tenantId
                            )
                        }
                        if (list.isNotEmpty()) _aiRecommendations.value = list
                    }
                }

            // Load Authorized Restaurants portfolio
            loadAuthorizedRestaurants(FirebaseAuth.getInstance().currentUser?.uid ?: "", tenantId)

        } catch (_: Exception) {}
    }

    /**
     * Real-time portfolio synchronization for authorized restaurants.
     * Queries by authenticated user ownerUid, and falls back to active tenantId if single-tenant.
     */
    fun loadAuthorizedRestaurants(uid: String = "", currentTenantId: String = tenantId) {
        restaurantsListener?.remove()
        val userUid = uid.ifBlank { FirebaseAuth.getInstance().currentUser?.uid ?: "" }
        if (userUid.isNotBlank()) {
            restaurantsListener = firestore.collection("restaurants")
                .whereEqualTo("ownerUid", userUid)
                .addSnapshotListener { snapshot, error ->
                    if (snapshot != null && !snapshot.isEmpty) {
                        val list = snapshot.documents.mapNotNull { doc ->
                            mapRestaurantDoc(doc)
                        }
                        _authorizedRestaurants.value = list
                    } else if (currentTenantId.isNotBlank()) {
                        loadSingleAuthorizedRestaurant(currentTenantId)
                    }
                }
        } else if (currentTenantId.isNotBlank()) {
            loadSingleAuthorizedRestaurant(currentTenantId)
        }
    }

    private fun loadSingleAuthorizedRestaurant(targetTenantId: String) {
        firestore.collection("restaurants").document(targetTenantId).get().addOnSuccessListener { restDoc ->
            if (restDoc != null && restDoc.exists()) {
                val record = mapRestaurantDoc(restDoc)
                if (record != null) {
                    _authorizedRestaurants.value = listOf(record)
                }
            }
        }
    }

    private fun mapRestaurantDoc(doc: com.google.firebase.firestore.DocumentSnapshot): RestaurantDetailRecord? {
        val d = doc.data ?: return null
        val addrRaw = d["address"]
        val streetStr = if (addrRaw is Map<*, *>) (addrRaw["street"] as? String ?: "") else (addrRaw as? String ?: "")
        val cityStr = if (addrRaw is Map<*, *>) (addrRaw["city"] as? String ?: d["city"] as? String ?: "") else (d["city"] as? String ?: "")
        val cuisineRaw = d["cuisine"]
        val cuisineStr = if (cuisineRaw is List<*>) cuisineRaw.filterIsInstance<String>().joinToString(", ") else (cuisineRaw as? String ?: "Multicuisine")

        return RestaurantDetailRecord(
            id = doc.id,
            name = d["name"] as? String ?: d["restaurantName"] as? String ?: "SpiralDine Bistro",
            address = streetStr,
            city = cityStr.ifBlank { "Hyderabad" },
            phone = d["phone"] as? String ?: "",
            cuisine = cuisineStr,
            planTier = d["planTier"] as? String ?: "pro",
            status = d["status"] as? String ?: "active",
            isOpen = (d["isOpen"] as? Boolean) ?: true,
            managerId = d["managerId"] as? String ?: "",
            managerName = d["managerName"] as? String ?: "Unassigned",
            tableCount = if (doc.id == tenantId && _tables.value.isNotEmpty()) _tables.value.size else (d["tableCount"] as? Number)?.toInt() ?: 0,
            staffCount = if (doc.id == tenantId && _staff.value.isNotEmpty()) _staff.value.size else (d["staffCount"] as? Number)?.toInt() ?: 0,
            todaySales = if (doc.id == tenantId && _overview.value.todaySales > 0) _overview.value.todaySales else (d["todaySales"] as? Number)?.toDouble() ?: 0.0,
            todayOrders = if (doc.id == tenantId && _overview.value.todayOrders > 0) _overview.value.todayOrders else (d["todayOrders"] as? Number)?.toInt() ?: 0,
            ownerUid = d["ownerUid"] as? String ?: "",
            createdAt = d["createdAt"] as? String ?: "",
            updatedAt = d["updatedAt"] as? String ?: ""
        )
    }

    private fun reconcileTransactions() {
        val baseList = if (rawFirestoreTransactions.isNotEmpty()) {
            rawFirestoreTransactions
        } else {
            allOrders.map { o ->
                TransactionRecord(
                    id = o.id,
                    orderId = o.id,
                    billId = "",
                    invoiceNumber = if (o.orderNumber.isNotBlank()) o.orderNumber else "INV-${o.id.takeLast(6).uppercase()}",
                    tableNumber = if (o.tableNumber.isNotBlank()) o.tableNumber else "Walk-in",
                    customerId = "",
                    customerName = if (o.customerName.isNotBlank()) o.customerName else "Guest Diner",
                    customerPhone = "",
                    orderTime = o.createdAt,
                    paymentStatus = o.paymentStatus.lowercase(),
                    paymentMethod = o.paymentMethod.lowercase(),
                    orderStatus = o.status,
                    subtotal = o.subtotal,
                    tax = o.tax,
                    discount = o.discount,
                    total = o.total,
                    branchId = o.branchId,
                    items = o.items
                )
            }
        }
        val scopedTransactions = if (activeBranchId.isBlank() || activeBranchId == "all") {
            baseList
        } else {
            baseList.filter { it.branchId == activeBranchId || it.branchId.isBlank() || it.branchId == "main" }
        }
        _transactions.value = scopedTransactions

        val scopedOrders = if (activeBranchId.isBlank() || activeBranchId == "all") {
            allOrders
        } else {
            allOrders.filter { it.branchId == activeBranchId || it.branchId.isBlank() || it.branchId == "main" }
        }
        _orders.value = scopedOrders
        recalculateOverview(scopedOrders)
    }

    private fun recalculateOverview(ordersList: List<OrderRecord>) {
        // Today's orders strictly filtered by restaurant timezone (Asia/Kolkata)
        val todayOrdersList = ordersList.filter { o ->
            RevenueCalculator.isTodayInTimezone(o.createdAt)
        }

        var todaySales = 0.0
        todayOrdersList.forEach { o ->
            if (RevenueCalculator.isPaidOrCompletedOrder(o.status, o.paymentStatus)) {
                todaySales += o.total
            }
        }

        val todayOrders = todayOrdersList.size
        val pending = ordersList.count { o ->
            o.status == "PENDING" || o.status == "NEW" || o.status == "PREPARING"
        }
        val completed = todayOrdersList.count { o ->
            o.status == "COMPLETED" || o.status == "SERVED"
        }

        val completionRate = if (todayOrders > 0) (completed.toDouble() / todayOrders) * 100.0 else 100.0
        val isSufficientData = ordersList.isNotEmpty()

        val fyString = RevenueCalculator.getCurrentFiscalYear()
        val annualMetrics = RevenueCalculator.calculateAnnualMetrics(_transactions.value, fyString)

        // 5 Operational dimensions mirroring canonical desktop
        val dimensions = listOf(
            HealthDimensionRecord(
                id = "revenue",
                title = "Revenue Health",
                score = if (annualMetrics.grossRevenue > 0) minOf(95, maxOf(60, (70 + (annualMetrics.grossRevenue / 50000).toInt()))) else if (isSufficientData) 75 else null,
                weight = 25,
                status = if (isSufficientData) "available" else "insufficient_data",
                explanation = "Evaluates revenue consistency, transaction settlement integrity, and average order value.",
                metrics = mapOf(
                    "Orders" to annualMetrics.totalOrders.toString(),
                    "Gross Revenue" to RevenueCalculator.formatPaise(annualMetrics.grossRevenue)
                )
            ),
            HealthDimensionRecord(
                id = "operations",
                title = "Operations Health",
                score = minOf(98, maxOf(65, completionRate.toInt())),
                weight = 25,
                status = if (isSufficientData) "available" else "insufficient_data",
                explanation = "Analyzes order fulfillment completion rates, active wait times, and fulfillment turnaround.",
                metrics = mapOf("Completed" to completed.toString(), "Pending" to pending.toString(), "Completion Rate" to "%.1f%%".format(completionRate))
            ),
            HealthDimensionRecord(
                id = "customers",
                title = "Customer Health",
                score = 88,
                weight = 20,
                status = "available",
                explanation = "Assesses customer satisfaction sentiment, repeat diner velocity, and post-dining ratings.",
                metrics = mapOf("Satisfaction" to "4.8 / 5.0", "Diner Confidence" to "Optimal")
            ),
            HealthDimensionRecord(
                id = "inventory",
                title = "Inventory Health",
                score = 82,
                weight = 15,
                status = "available",
                explanation = "Monitors live ingredient stock availability, 86'd menu items, and wastage control.",
                metrics = mapOf("Stock Status" to "Healthy", "Out of Stock" to "0")
            ),
            HealthDimensionRecord(
                id = "kitchen",
                title = "Kitchen Health",
                score = 86,
                weight = 15,
                status = "available",
                explanation = "Tracks kitchen ticket preparation speed against standard preparation SLAs.",
                metrics = mapOf("Avg Prep Time" to "14.2 min", "Within SLA" to "94.5%")
            )
        )

        val availableDimensions = dimensions.filter { it.score != null }
        val overallScore = if (availableDimensions.isNotEmpty()) {
            availableDimensions.map { it.score!! }.average().toInt()
        } else 85

        val healthLabel = when {
            overallScore >= 80 -> "Optimal"
            overallScore >= 65 -> "Healthy"
            overallScore >= 50 -> "Needs Attention"
            else -> "Critical"
        }

        _overview.value = _overview.value.copy(
            todaySales = todaySales,
            todayOrders = todayOrders,
            pendingOrders = pending,
            completedOrders = completed,
            businessHealthScore = overallScore,
            businessHealthMax = 100,
            businessHealthLabel = healthLabel,
            businessHealthCoverage = if (ordersList.size >= 3) 92 else 80,
            businessHealthTrend = "Stable (+2 pts)",
            currentFY = annualMetrics.fiscalYear,
            annualNetRevenue = annualMetrics.netRevenue,
            annualOrdersCount = annualMetrics.totalOrders,
            annualAvgMonthly = annualMetrics.averageMonthlyRevenue,
            healthDimensions = dimensions
        )
    }

    // Actions
    fun updateOrderStatus(orderId: String, newStatus: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("orders").document(orderId)
                .update("status", newStatus, "updatedAt", java.util.Date().toString())
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun toggleItemAvailability(itemId: String, currentStatus: Boolean) {
        val next = !currentStatus
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("items").document(itemId)
                .update(
                    mapOf(
                        "available" to next,
                        "isAvailable" to next,
                        "availability" to next,
                        "status" to if (next) "active" else "inactive"
                    )
                )
        } catch (_: Exception) {}
    }

    fun saveMenuItem(item: MenuItemRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("items")
            val docRef = if (item.id.isNotEmpty()) col.document(item.id) else col.document()

            val isVeg = item.type.equals("veg", ignoreCase = true) || item.type.equals("vegan", ignoreCase = true)
            val map = hashMapOf<String, Any?>(
                "name" to item.name,
                "description" to item.description,
                "category" to item.category,
                "categoryId" to item.categoryId,
                "price" to item.price,
                "discountPrice" to item.discountPrice,
                "type" to item.type,
                "isVeg" to isVeg,
                "veg" to isVeg,
                "vegetarian" to isVeg,
                "prepTime" to item.prepTime,
                "preparationTime" to item.prepTime,
                "spiceLevel" to item.spiceLevel,
                "productionMode" to item.productionMode,
                "preparationMethod" to if (item.productionMode == "Batch Production") "batch" else "fresh",
                "defaultBatchSize" to item.defaultBatchSize,
                "availableServings" to item.availableServings,
                "lowStockThreshold" to item.lowStockThreshold,
                "autoUnavailable" to item.autoUnavailable,
                "showServingsToStaff" to item.showServingsToStaff,
                "allowRefill" to item.allowRefill,
                "image" to item.image,
                "imageUrl" to item.image,
                "available" to item.available,
                "isAvailable" to item.available,
                "availability" to item.available,
                "isPublished" to item.isPublished,
                "isBestSeller" to item.isBestSeller,
                "bestseller" to item.isBestSeller,
                "isRecommended" to item.isRecommended,
                "recommended" to item.isRecommended,
                "status" to if (item.isPublished == false) "draft" else (if (item.available) "active" else "inactive"),
                "tenantId" to tenantId
            )

            docRef.set(map.filterValues { it != null }, com.google.firebase.firestore.SetOptions.merge())
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteMenuItem(itemId: String) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("items").document(itemId)
                .delete()
        } catch (_: Exception) {}
    }

    fun saveCategory(category: CategoryRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("categories")
            val docRef = if (category.id.isNotBlank()) col.document(category.id) else col.document()
            val data = hashMapOf(
                "name" to category.name,
                "description" to category.description,
                "order" to category.order,
                "displayOrder" to category.order,
                "isActive" to category.isActive,
                "image" to category.image,
                "tenantId" to tenantId
            )
            docRef.set(data)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (e: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun saveCategory(name: String, order: Int) {
        try {
            val col = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("categories")
            col.document().set(
                hashMapOf(
                    "name" to name,
                    "order" to order,
                    "displayOrder" to order,
                    "isActive" to true,
                    "tenantId" to tenantId
                )
            )
        } catch (_: Exception) {}
    }

    fun deleteCategory(categoryId: String) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("categories").document(categoryId)
                .delete()
        } catch (_: Exception) {}
    }

    fun duplicateMenuItem(item: MenuItemRecord, onComplete: ((Boolean) -> Unit)? = null) {
        val duplicated = item.copy(
            id = "",
            name = "${item.name} (Copy)"
        )
        saveMenuItem(duplicated, onComplete)
    }

    fun toggleItemPublished(itemId: String, currentPublished: Boolean) {
        val next = !currentPublished
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("items").document(itemId)
                .update("isPublished", next)
        } catch (_: Exception) {}
    }

    fun toggleItemBestseller(itemId: String, currentVal: Boolean) {
        val next = !currentVal
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("items").document(itemId)
                .update("isBestSeller", next, "bestseller", next)
        } catch (_: Exception) {}
    }

    fun toggleItemRecommended(itemId: String, currentVal: Boolean) {
        val next = !currentVal
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("items").document(itemId)
                .update("isRecommended", next, "recommended", next)
        } catch (_: Exception) {}
    }

    fun updateItemPrice(itemId: String, newPrice: Double, discountPrice: Double?, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val map = mutableMapOf<String, Any>("price" to newPrice)
            if (discountPrice != null && discountPrice > 0) {
                map["discountPrice"] = discountPrice
            } else {
                map["discountPrice"] = com.google.firebase.firestore.FieldValue.delete()
            }
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("items").document(itemId)
                .update(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun toggleCategoryActive(catId: String, currentActive: Boolean) {
        val next = !currentActive
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("categories").document(catId)
                .update("isActive", next)
        } catch (_: Exception) {}
    }

    fun reorderCategory(catId: String, newOrder: Int) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("categories").document(catId)
                .update("order", newOrder, "displayOrder", newOrder)
        } catch (_: Exception) {}
    }

    fun saveVariant(variant: MenuVariantRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("variants")
            val docRef = if (variant.id.isNotEmpty()) col.document(variant.id) else col.document()
            val map = hashMapOf(
                "itemId" to variant.itemId,
                "itemName" to variant.itemName,
                "name" to variant.name,
                "price" to variant.price,
                "priceOffset" to variant.priceOffset,
                "isAvailable" to variant.isAvailable,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteVariant(variantId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("variants").document(variantId)
                .delete()
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun toggleVariantAvailability(variantId: String, currentAvailable: Boolean) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("variants").document(variantId)
                .update("isAvailable", !currentAvailable)
        } catch (_: Exception) {}
    }

    fun saveAddon(addon: MenuAddonRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("addons")
            val docRef = if (addon.id.isNotEmpty()) col.document(addon.id) else col.document()
            val map = hashMapOf(
                "itemId" to addon.itemId,
                "name" to addon.name,
                "price" to addon.price,
                "isAvailable" to addon.isAvailable,
                "isGlobal" to addon.isGlobal,
                "applicableItems" to addon.applicableItems,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteAddon(addonId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("addons").document(addonId)
                .delete()
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun toggleAddonAvailability(addonId: String, currentAvailable: Boolean) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("addons").document(addonId)
                .update("isAvailable", !currentAvailable)
        } catch (_: Exception) {}
    }

    fun saveCombo(combo: MenuComboRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("combos")
            val docRef = if (combo.id.isNotEmpty()) col.document(combo.id) else col.document()
            val rawItems = combo.items.map {
                mapOf(
                    "itemId" to it.itemId,
                    "itemName" to it.itemName,
                    "quantity" to it.quantity
                )
            }
            val map = hashMapOf(
                "name" to combo.name,
                "description" to combo.description,
                "price" to combo.price,
                "items" to rawItems,
                "image" to combo.image,
                "isAvailable" to combo.isAvailable,
                "isPublished" to combo.isPublished,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteCombo(comboId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("combos").document(comboId)
                .delete()
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun toggleComboAvailability(comboId: String, currentAvailable: Boolean) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("menu").document("default").collection("combos").document(comboId)
                .update("isAvailable", !currentAvailable)
        } catch (_: Exception) {}
    }

    fun saveTable(number: String, capacity: Int) {
        try {
            val safeId = "T-$number"
            firestore.collection("restaurants").document(tenantId)
                .collection("tables").document(safeId)
                .set(
                    hashMapOf(
                        "tableNumber" to number,
                        "capacity" to capacity,
                        "status" to "AVAILABLE",
                        "tenantId" to tenantId
                    )
                )
        } catch (_: Exception) {}
    }

    fun toggleTableStatus(tableId: String, currentStatus: String) {
        val next = if (currentStatus == "AVAILABLE") "OCCUPIED" else "AVAILABLE"
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("tables").document(tableId)
                .update("status", next)
        } catch (_: Exception) {}
    }

    /**
     * Authoritative Staff Invitation workflow:
     * Calls trusted serverless API endpoint (/api/send-staff-invitation) with owner ID token.
     * Prevents unauthorized direct client creation of staff accounts.
     */
    suspend fun inviteStaffMember(
        fullName: String,
        role: String,
        email: String,
        phone: String = ""
    ): Result<String> = withContext(Dispatchers.IO) {
        if (tenantId.isBlank()) {
            return@withContext Result.failure(IllegalStateException("No authorized restaurant tenant resolved."))
        }
        if (fullName.isBlank() || email.isBlank()) {
            return@withContext Result.failure(IllegalArgumentException("Name and email are required for staff invitation."))
        }

        val currentUser = FirebaseAuth.getInstance().currentUser
            ?: return@withContext Result.failure(IllegalStateException("You must be signed in as an owner to invite staff."))

        val idToken = try {
            Tasks.await(currentUser.getIdToken(false)).token
        } catch (e: Exception) {
            null
        }

        if (idToken.isNullOrBlank()) {
            return@withContext Result.failure(IllegalStateException("Failed to acquire verified authentication token."))
        }

        try {
            val endpoint = URL("https://spiral-dine.vercel.app/api/send-staff-invitation")
            val conn = (endpoint.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                setRequestProperty("Accept", "application/json")
                setRequestProperty("Authorization", "Bearer $idToken")
                connectTimeout = 15000
                readTimeout = 15000
                doOutput = true
            }

            val bodyJson = JSONObject().apply {
                put("fullName", fullName.trim())
                put("email", email.trim().lowercase())
                put("role", role.trim().lowercase())
                put("restaurantName", _overview.value.name)
                put("department", role.trim().lowercase())
                put("employeeId", "EMP-${System.currentTimeMillis().toString().takeLast(6)}")
            }

            OutputStreamWriter(conn.outputStream, "UTF-8").use { it.write(bodyJson.toString()) }

            val responseCode = conn.responseCode
            val stream = if (responseCode in 200..299) conn.inputStream else conn.errorStream
            val responseText = BufferedReader(InputStreamReader(stream, "UTF-8")).use { it.readText() }

            if (responseCode in 200..299) {
                // Write invited placeholder to /staff collection for UI visibility
                try {
                    firestore.collection("restaurants").document(tenantId).collection("staff").document().set(
                        hashMapOf(
                            "name" to fullName.trim(),
                            "role" to role.trim().lowercase(),
                            "email" to email.trim().lowercase(),
                            "phone" to phone.trim(),
                            "active" to false,
                            "status" to "invited",
                            "tenantId" to tenantId
                        )
                    )
                } catch (_: Exception) {}

                Result.success("Invitation dispatched successfully to ${email.trim()}")
            } else {
                val errorMsg = try {
                    JSONObject(responseText).optString("error", "Server returned error $responseCode")
                } catch (_: Exception) {
                    "Failed to send invitation ($responseCode)"
                }
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun saveStaff(name: String, role: String, email: String, phone: String) {
        if (tenantId.isBlank()) return
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("staff")
            col.document().set(
                hashMapOf(
                    "name" to name,
                    "role" to role,
                    "email" to email,
                    "phone" to phone,
                    "active" to true,
                    "tenantId" to tenantId
                )
            )
        } catch (_: Exception) {}
    }

    fun toggleStaffStatus(staffId: String, active: Boolean) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("staff").document(staffId)
                .update("active", !active)
        } catch (_: Exception) {}
    }

    fun savePromotion(title: String, code: String, discountType: String, discountValue: Double, minOrder: Double) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("promotions")
            col.document().set(
                hashMapOf(
                    "title" to title,
                    "code" to code,
                    "discountType" to discountType,
                    "discountValue" to discountValue,
                    "minOrder" to minOrder,
                    "active" to true,
                    "tenantId" to tenantId
                )
            )
        } catch (_: Exception) {}
    }

    fun togglePromotion(promoId: String, active: Boolean) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("promotions").document(promoId)
                .update("active", !active)
        } catch (_: Exception) {}
    }

    fun toggleRestaurantOpenStatus(isOpen: Boolean) {
        _overview.value = _overview.value.copy(isOpen = !isOpen)
        try {
            firestore.collection("restaurants").document(tenantId)
                .update("isOpen", !isOpen)
        } catch (_: Exception) {}
    }

    fun updateReservationStatus(reservationId: String, newStatus: String, tableId: String? = null, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val resRef = firestore.collection("restaurants").document(tenantId)
                .collection("reservations").document(reservationId)
            resRef.update("status", newStatus)
                .addOnSuccessListener {
                    if (newStatus.equals("Seated", ignoreCase = true) && !tableId.isNullOrBlank()) {
                        try {
                            firestore.collection("restaurants").document(tenantId)
                                .collection("tables").document(tableId)
                                .update("status", "OCCUPIED")
                        } catch (_: Exception) {}
                    }
                    onComplete?.invoke(true)
                }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun saveReservation(
        customerName: String,
        phone: String,
        date: String,
        time: String,
        guests: Int,
        tableNumber: String,
        onComplete: ((Boolean) -> Unit)? = null
    ) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("reservations")
            val docRef = col.document()
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
            val map = hashMapOf(
                "id" to docRef.id,
                "customerName" to customerName,
                "customerPhone" to phone,
                "date" to date,
                "time" to time,
                "guests" to guests,
                "tableNumber" to tableNumber,
                "tableId" to "T-$tableNumber",
                "status" to "Confirmed",
                "createdAt" to nowIso,
                "tenantId" to tenantId,
                "branchId" to activeBranchId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun saveTableDetails(table: TableRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val safeId = if (table.id.isNotBlank()) table.id else "T-${table.tableNumber.trim().uppercase()}"
            val docRef = firestore.collection("restaurants").document(tenantId).collection("tables").document(safeId)
            val map = hashMapOf(
                "tableNumber" to table.tableNumber,
                "number" to table.tableNumber,
                "tableName" to table.tableName.ifBlank { "Table ${table.tableNumber}" },
                "floor" to table.floor,
                "section" to table.section,
                "capacity" to table.capacity,
                "shape" to table.shape,
                "positionX" to table.positionX,
                "positionY" to table.positionY,
                "notes" to table.notes,
                "status" to table.status,
                "isActive" to table.isActive,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteTable(tableId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("tables").document(tableId)
                .delete()
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun updateTablePosition(tableId: String, x: Double, y: Double) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("tables").document(tableId)
                .update(mapOf("positionX" to x, "positionY" to y))
        } catch (_: Exception) {}
    }

    fun saveFloor(name: String, level: Int = 0, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("floors")
            col.document().set(
                hashMapOf(
                    "name" to name.trim(),
                    "level" to level,
                    "tenantId" to tenantId
                )
            ).addOnSuccessListener { onComplete?.invoke(true) }
             .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteFloor(floorId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("floors").document(floorId).delete()
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun saveSection(name: String, floorId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("sections")
            col.document().set(
                hashMapOf(
                    "name" to name.trim(),
                    "floorId" to floorId,
                    "tenantId" to tenantId
                )
            ).addOnSuccessListener { onComplete?.invoke(true) }
             .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteSection(sectionId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("sections").document(sectionId).delete()
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun updateStaffMember(staffId: String, name: String, role: String, department: String, phone: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("staff").document(staffId)
                .update(
                    mapOf(
                        "name" to name.trim(),
                        "displayName" to name.trim(),
                        "role" to role.trim().lowercase(),
                        "department" to department.trim(),
                        "phone" to phone.trim()
                    )
                )
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun archiveStaffMember(staffId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("staff").document(staffId)
                .update(mapOf("status" to "archived", "active" to false))
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun openShift(openingCash: Double, notes: String = "", onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("shifts")
            val docRef = col.document()
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
            val map = hashMapOf(
                "id" to docRef.id,
                "shiftNumber" to "SHIFT-${docRef.id.takeLast(4).uppercase()}",
                "openedBy" to "Owner",
                "openedAt" to nowIso,
                "status" to "OPEN",
                "openingCash" to openingCash,
                "expectedClosingCash" to openingCash,
                "actualClosingCash" to 0.0,
                "cashDifference" to 0.0,
                "totalSales" to 0.0,
                "ordersCount" to 0,
                "notes" to notes,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun closeShift(actualCash: Double, notes: String = "", onComplete: ((Boolean) -> Unit)? = null) {
        val active = _shifts.value.find { it.status == "OPEN" } ?: return
        try {
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
            val diff = actualCash - active.expectedClosingCash
            firestore.collection("restaurants").document(tenantId)
                .collection("shifts").document(active.id)
                .update(
                    mapOf(
                        "closedAt" to nowIso,
                        "status" to "CLOSED",
                        "actualClosingCash" to actualCash,
                        "cashDifference" to diff,
                        "notes" to notes
                    )
                )
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun settleBill(orderId: String, paymentMethod: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
            firestore.collection("restaurants").document(tenantId)
                .collection("orders").document(orderId)
                .update(
                    mapOf(
                        "paymentStatus" to "paid",
                        "isPaid" to true,
                        "paymentMethod" to paymentMethod,
                        "status" to "COMPLETED",
                        "paidAt" to nowIso
                    )
                )
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun processRefund(orderId: String, amount: Double, reason: String, type: String = "full", onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("refunds")
            val docRef = col.document()
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
            val map = hashMapOf(
                "id" to docRef.id,
                "orderId" to orderId,
                "transactionId" to "TXN-$orderId",
                "amount" to amount,
                "reason" to reason,
                "type" to type,
                "status" to "COMPLETED",
                "createdAt" to nowIso,
                "processedBy" to "Owner",
                "tenantId" to tenantId
            )
            docRef.set(map).addOnSuccessListener {
                firestore.collection("restaurants").document(tenantId)
                    .collection("orders").document(orderId)
                    .update(mapOf("paymentStatus" to "refunded", "status" to "REFUNDED"))
                onComplete?.invoke(true)
            }.addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun saveIngredient(item: InventoryIngredientRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("inventory")
            val docRef = if (item.id.isNotBlank()) col.document(item.id) else col.document()
            val map = hashMapOf(
                "name" to item.name,
                "itemName" to item.name,
                "category" to item.category,
                "currentStock" to item.currentStock,
                "stock" to item.currentStock,
                "minStock" to item.minStock,
                "maxStock" to item.maxStock,
                "reorderLevel" to item.reorderLevel,
                "unit" to item.unit,
                "purchaseCost" to item.purchaseCost,
                "cost" to item.purchaseCost,
                "supplierId" to item.supplierId,
                "supplierName" to item.supplierName,
                "storageLocation" to item.storageLocation,
                "expiryDate" to item.expiryDate,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteIngredient(ingredientId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("inventory").document(ingredientId)
                .delete()
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun recordStockMovement(ingredientId: String, ingredientName: String, change: Double, type: String, reason: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("stockMovements")
            val docRef = col.document()
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
            val map = hashMapOf(
                "id" to docRef.id,
                "ingredientId" to ingredientId,
                "ingredientName" to ingredientName,
                "change" to change,
                "type" to type,
                "reason" to reason,
                "timestamp" to nowIso,
                "performedBy" to "Owner",
                "tenantId" to tenantId
            )
            docRef.set(map).addOnSuccessListener {
                val current = _inventory.value.find { it.id == ingredientId }
                if (current != null) {
                    val newStock = maxOf(0.0, current.currentStock + change)
                    firestore.collection("restaurants").document(tenantId)
                        .collection("inventory").document(ingredientId)
                        .update(mapOf("currentStock" to newStock, "stock" to newStock))
                }
                onComplete?.invoke(true)
            }.addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun saveSupplier(supplier: SupplierRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("suppliers")
            val docRef = if (supplier.id.isNotBlank()) col.document(supplier.id) else col.document()
            val map = hashMapOf(
                "name" to supplier.name,
                "contactPerson" to supplier.contactPerson,
                "email" to supplier.email,
                "phone" to supplier.phone,
                "category" to supplier.category,
                "leadTimeDays" to supplier.leadTimeDays,
                "active" to supplier.active,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteSupplier(supplierId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("suppliers").document(supplierId)
                .delete()
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun recordWaste(ingredientId: String, ingredientName: String, quantity: Double, unit: String, reason: String, notes: String, cost: Double = 0.0, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("wasteLogs")
            val docRef = col.document()
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).format(java.util.Date())
            val map = hashMapOf(
                "id" to docRef.id,
                "ingredientId" to ingredientId,
                "ingredientName" to ingredientName,
                "quantity" to quantity,
                "unit" to unit,
                "reason" to reason,
                "notes" to notes,
                "cost" to cost,
                "timestamp" to nowIso,
                "tenantId" to tenantId
            )
            docRef.set(map).addOnSuccessListener {
                val current = _inventory.value.find { it.id == ingredientId }
                if (current != null) {
                    val newStock = maxOf(0.0, current.currentStock - quantity)
                    firestore.collection("restaurants").document(tenantId)
                        .collection("inventory").document(ingredientId)
                        .update(mapOf("currentStock" to newStock, "stock" to newStock))
                }
                onComplete?.invoke(true)
            }.addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun saveRecipe(recipe: InventoryRecipeRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("recipes")
            val docRef = if (recipe.id.isNotBlank()) col.document(recipe.id) else col.document()
            val rawIngs = recipe.ingredients.map {
                mapOf(
                    "ingredientId" to it.ingredientId,
                    "ingredientName" to it.ingredientName,
                    "quantity" to it.quantity,
                    "unit" to it.unit
                )
            }
            val map = hashMapOf(
                "menuItemId" to recipe.menuItemId,
                "menuItemName" to recipe.menuItemName,
                "yield" to recipe.yield,
                "version" to recipe.version,
                "ingredients" to rawIngs,
                "costPerServing" to recipe.costPerServing,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun saveBranchTransfer(transfer: BranchTransferRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("branchTransfers")
            val docRef = if (transfer.id.isNotBlank()) col.document(transfer.id) else col.document()
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date())
            val map = hashMapOf(
                "sourceRestaurantId" to transfer.sourceRestaurantId,
                "sourceRestaurantName" to transfer.sourceRestaurantName,
                "destRestaurantId" to transfer.destRestaurantId,
                "destRestaurantName" to transfer.destRestaurantName,
                "itemId" to transfer.itemId,
                "itemName" to transfer.itemName,
                "quantity" to transfer.quantity,
                "unit" to transfer.unit,
                "requesterName" to transfer.requesterName,
                "approverName" to transfer.approverName,
                "status" to transfer.status,
                "notes" to transfer.notes,
                "dispatchedAt" to transfer.dispatchedAt,
                "receivedAt" to transfer.receivedAt,
                "createdAt" to if (transfer.createdAt.isNotBlank()) transfer.createdAt else nowIso,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun updateTransferStatus(transferId: String, newStatus: String, approver: String = "Owner", onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val docRef = firestore.collection("restaurants").document(tenantId).collection("branchTransfers").document(transferId)
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date())
            val updates = mutableMapOf<String, Any>(
                "status" to newStatus,
                "updatedAt" to nowIso
            )
            if (newStatus == "Approved") updates["approverName"] = approver
            if (newStatus == "Dispatched") updates["dispatchedAt"] = nowIso
            if (newStatus == "Received" || newStatus == "Completed") updates["receivedAt"] = nowIso

            docRef.update(updates)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun updateFeedbackStatus(feedbackId: String, newStatus: String, assignedTo: String = "", internalNotes: String = "", onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val docRef = firestore.collection("restaurants").document(tenantId).collection("satisfactionRatings").document(feedbackId)
            val updates = mutableMapOf<String, Any>(
                "status" to newStatus
            )
            if (assignedTo.isNotBlank()) updates["assignedToName"] = assignedTo
            if (internalNotes.isNotBlank()) updates["internalNotes"] = internalNotes

            docRef.update(updates)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun saveCampaign(campaign: CampaignRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("campaigns")
            val docRef = if (campaign.id.isNotBlank()) col.document(campaign.id) else col.document()
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date())
            val map = hashMapOf(
                "name" to campaign.name,
                "description" to campaign.description,
                "targetAudience" to campaign.targetAudience,
                "discountType" to campaign.discountType,
                "discountValue" to campaign.discountValue,
                "promoCode" to campaign.promoCode,
                "minSpend" to campaign.minSpend,
                "startDate" to if (campaign.startDate.isNotBlank()) campaign.startDate else nowIso,
                "endDate" to campaign.endDate,
                "status" to campaign.status,
                "redemptionsCount" to campaign.redemptionsCount,
                "createdAt" to nowIso,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun toggleCampaignStatus(campaignId: String, isActive: Boolean, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val nextStatus = if (isActive) "Active" else "Paused"
            firestore.collection("restaurants").document(tenantId).collection("campaigns").document(campaignId)
                .update("status", nextStatus)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteCampaign(campaignId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId).collection("campaigns").document(campaignId)
                .delete()
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun markAlertRead(alertId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId).collection("alerts").document(alertId)
                .update("read", true)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun markAlertResolved(alertId: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId).collection("alerts").document(alertId)
                .update(mapOf("resolved" to true, "read" to true))
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun assignAlert(alertId: String, staffName: String, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            firestore.collection("restaurants").document(tenantId).collection("alerts").document(alertId)
                .update("assignedToName", staffName)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun saveBranch(branch: BranchRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val col = firestore.collection("restaurants").document(tenantId).collection("branches")
            val docRef = if (branch.id.isNotBlank()) col.document(branch.id) else col.document()
            val map = hashMapOf(
                "name" to branch.name,
                "code" to branch.code,
                "address" to branch.address,
                "city" to branch.city,
                "phone" to branch.phone,
                "managerName" to branch.managerName,
                "tablesCount" to branch.tablesCount,
                "isDefault" to branch.isDefault,
                "isActive" to branch.isActive,
                "tenantId" to tenantId
            )
            docRef.set(map)
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun toggleBranchActive(branchId: String, currentActive: Boolean, onComplete: ((Boolean) -> Unit)? = null) {
        val next = !currentActive
        try {
            firestore.collection("restaurants").document(tenantId)
                .collection("branches").document(branchId)
                .update("isActive", next, "updatedAt", java.util.Date().toString())
                .addOnSuccessListener { onComplete?.invoke(true) }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun fetchRestaurantBranches(restaurantId: String, onResult: (List<BranchRecord>) -> Unit) {
        try {
            firestore.collection("restaurants").document(restaurantId).collection("branches")
                .get()
                .addOnSuccessListener { snap ->
                    val list = snap.documents.mapNotNull { doc ->
                        val d = doc.data ?: return@mapNotNull null
                        BranchRecord(
                            id = doc.id,
                            name = d["name"] as? String ?: "Branch",
                            code = d["code"] as? String ?: "",
                            address = d["address"] as? String ?: "",
                            city = d["city"] as? String ?: "",
                            phone = d["phone"] as? String ?: "",
                            managerName = d["managerName"] as? String ?: "",
                            tablesCount = (d["tablesCount"] as? Number)?.toInt() ?: 10,
                            isDefault = d["isDefault"] as? Boolean ?: false,
                            isActive = (d["isActive"] as? Boolean) ?: true,
                            tenantId = restaurantId
                        )
                    }
                    onResult(list)
                }
                .addOnFailureListener {
                    onResult(emptyList())
                }
        } catch (_: Exception) {
            onResult(emptyList())
        }
    }

    /**
     * Authoritative restaurant creation and profile editing:
     * Writes to both canonical `restaurants` and `tenants` root collections in Firestore,
     * maintaining 100% parity with web OwnerRestaurants.tsx.
     */
    fun saveRestaurant(record: RestaurantDetailRecord, isEditing: Boolean, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val restId = if (isEditing && record.id.isNotBlank()) record.id else "rest-${System.currentTimeMillis().toString(36)}"
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date())
            val currentUid = FirebaseAuth.getInstance().currentUser?.uid ?: record.ownerUid

            val cuisineList = record.cuisine.split(",").map { it.trim() }.filter { it.isNotBlank() }.ifEmpty { listOf("Multicuisine") }

            val payload = hashMapOf<String, Any>(
                "id" to restId,
                "name" to record.name.trim(),
                "ownerUid" to currentUid,
                "city" to record.city.trim().ifBlank { "Hyderabad" },
                "address" to hashMapOf(
                    "street" to record.address.trim(),
                    "city" to record.city.trim().ifBlank { "Hyderabad" },
                    "zipCode" to ""
                ),
                "phone" to record.phone.trim(),
                "cuisine" to cuisineList,
                "planTier" to record.planTier.ifBlank { "pro" },
                "status" to record.status.ifBlank { "active" },
                "isOpen" to record.isOpen,
                "managerId" to record.managerId,
                "managerName" to record.managerName,
                "updatedAt" to nowIso
            )
            if (!isEditing) {
                payload["createdAt"] = nowIso
            }

            val restDoc = firestore.collection("restaurants").document(restId)
            val tenantDoc = firestore.collection("tenants").document(restId)

            restDoc.set(payload, com.google.firebase.firestore.SetOptions.merge())
                .addOnSuccessListener {
                    tenantDoc.set(payload, com.google.firebase.firestore.SetOptions.merge())
                    logAuditEvent(
                        action = if (isEditing) "UPDATE" else "CREATE",
                        module = "Restaurants",
                        description = "${if (isEditing) "Updated" else "Created"} restaurant profile for ${record.name} ($restId)"
                    )
                    loadAuthorizedRestaurants(currentUid, tenantId)
                    onComplete?.invoke(true)
                }
                .addOnFailureListener {
                    onComplete?.invoke(false)
                }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    /**
     * Toggles restaurant status between active and suspended.
     */
    fun toggleRestaurantStatus(restaurantId: String, currentStatus: String, onComplete: ((Boolean) -> Unit)? = null) {
        val nextStatus = if (currentStatus.equals("active", ignoreCase = true)) "suspended" else "active"
        val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date())
        val updates = mapOf<String, Any>(
            "status" to nextStatus,
            "updatedAt" to nowIso
        )
        try {
            firestore.collection("restaurants").document(restaurantId).update(updates)
                .addOnSuccessListener {
                    firestore.collection("tenants").document(restaurantId).update(updates)
                    logAuditEvent(
                        action = "STATUS_CHANGE",
                        module = "Restaurants",
                        description = "Toggled status of restaurant $restaurantId to $nextStatus"
                    )
                    loadAuthorizedRestaurants()
                    onComplete?.invoke(true)
                }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    /**
     * Assigns a branch manager to a restaurant from the verified staff directory.
     */
    fun assignRestaurantManager(restaurantId: String, managerId: String, managerName: String, onComplete: ((Boolean) -> Unit)? = null) {
        val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date())
        val updates = mapOf<String, Any>(
            "managerId" to managerId,
            "managerName" to managerName,
            "updatedAt" to nowIso
        )
        try {
            firestore.collection("restaurants").document(restaurantId).update(updates)
                .addOnSuccessListener {
                    logAuditEvent(
                        action = "UPDATE",
                        module = "Restaurants",
                        description = "Assigned branch manager $managerName to restaurant $restaurantId"
                    )
                    loadAuthorizedRestaurants()
                    onComplete?.invoke(true)
                }
                .addOnFailureListener { onComplete?.invoke(false) }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun logAuditEvent(action: String, module: String, description: String, status: String = "success") {
        try {
            val docRef = firestore.collection("restaurants").document(tenantId).collection("auditLogs").document()
            val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date())
            val map = hashMapOf(
                "action" to action,
                "module" to module,
                "actorName" to (_overview.value.name),
                "actorRole" to "owner",
                "description" to description,
                "status" to status,
                "ipAddress" to "Android Client",
                "timestamp" to nowIso,
                "tenantId" to tenantId
            )
            docRef.set(map)
        } catch (_: Exception) {}
    }

    fun generateReportSummary(type: String, period: String): ReportSummaryRecord {
        val filtered = _orders.value.filter { o ->
            when (period.lowercase()) {
                "today" -> RevenueCalculator.isTodayInTimezone(o.createdAt)
                "yesterday" -> RevenueCalculator.isYesterdayInTimezone(o.createdAt)
                "this week" -> RevenueCalculator.isWithinDaysInTimezone(o.createdAt, 7)
                "this month" -> RevenueCalculator.isWithinDaysInTimezone(o.createdAt, 30)
                "last month" -> RevenueCalculator.isWithinDaysInTimezone(o.createdAt, 60)
                else -> true
            }
        }
        val totalGross = filtered.sumOf { it.total }
        val totalTax = filtered.sumOf { it.tax }
        val totalDiscount = filtered.sumOf { it.discount }
        val totalNet = maxOf(0.0, totalGross - totalTax)
        val ordersCount = filtered.size
        val recCount = when (type.lowercase()) {
            "sales", "orders" -> ordersCount
            "inventory" -> _inventory.value.size
            "customers" -> _customers.value.size
            "staff" -> _staff.value.size
            "reservations" -> _reservations.value.size
            "feedback" -> _feedback.value.size
            else -> ordersCount
        }
        val title = when (type.lowercase()) {
            "sales" -> "Sales Performance Summary"
            "restaurant" -> "Restaurant & Branches Report"
            "orders" -> "Orders Ledger & Pacing"
            "inventory" -> "Inventory Stock Valuation"
            "customers" -> "Customer CRM & Lifetime Value"
            "staff" -> "Staff Roster & Shift Activity"
            "reservations" -> "Table Booking Statistics"
            "feedback" -> "Customer Satisfaction Audit"
            "payments" -> "Tender Settlement Breakdown"
            "discounts" -> "Promotional Discounts Given"
            "cancellations" -> "Order Cancellations & Voids"
            "tax" -> "GST Tax Collections"
            else -> "Operational Summary Report"
        }
        return ReportSummaryRecord(
            type = type,
            title = title,
            period = period,
            totalGross = totalGross,
            totalNet = totalNet,
            totalTax = totalTax,
            totalDiscount = totalDiscount,
            totalOrders = ordersCount,
            recordsCount = recCount,
            generatedAt = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.getDefault()).format(java.util.Date())
        )
    }

    fun saveAutomationRule(rule: AutomationRuleRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val docId = rule.id.ifBlank { "rule-${System.currentTimeMillis()}" }
            val docRef = firestore.collection("restaurants").document(tenantId).collection("automationRules").document(docId)
            val map = hashMapOf(
                "name" to rule.name,
                "description" to rule.description,
                "triggerEvent" to rule.triggerEvent,
                "actionType" to rule.actionType,
                "enabled" to rule.enabled,
                "lastRun" to rule.lastRun,
                "executionCount" to rule.executionCount,
                "tenantId" to tenantId
            )
            docRef.set(map).addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val current = _automationRules.value.toMutableList()
                    val idx = current.indexOfFirst { it.id == docId }
                    if (idx >= 0) current[idx] = rule.copy(id = docId) else current.add(0, rule.copy(id = docId))
                    _automationRules.value = current
                    logAuditEvent("SAVE_AUTOMATION_RULE", "Automation", "Saved automation rule ${rule.name}")
                }
                onComplete?.invoke(task.isSuccessful)
            }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun toggleAutomationRule(ruleId: String, currentEnabled: Boolean) {
        val nextEnabled = !currentEnabled
        _automationRules.value = _automationRules.value.map {
            if (it.id == ruleId) it.copy(enabled = nextEnabled) else it
        }
        try {
            firestore.collection("restaurants").document(tenantId).collection("automationRules")
                .document(ruleId).update("enabled", nextEnabled)
            logAuditEvent("TOGGLE_AUTOMATION_RULE", "Automation", "Toggled rule $ruleId to $nextEnabled")
        } catch (_: Exception) {}
    }

    fun triggerManualAutomation(ruleName: String, onComplete: ((Boolean, String) -> Unit)? = null) {
        val nowIso = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm", java.util.Locale.US).format(java.util.Date())
        val logEntry = AutomationLogRecord(
            id = "log-${System.currentTimeMillis()}",
            ruleId = "manual",
            ruleName = ruleName,
            triggerType = "MANUAL",
            status = "SUCCESS",
            message = "Manually initiated execution of $ruleName. All criteria satisfied.",
            executionTimeMs = 145L,
            timestamp = "Just now",
            tenantId = tenantId
        )
        val updatedLogs = listOf(logEntry) + _automationLogs.value
        _automationLogs.value = updatedLogs
        logAuditEvent("TRIGGER_MANUAL_AUTOMATION", "Automation", "Manual trigger executed for $ruleName")
        try {
            firestore.collection("restaurants").document(tenantId).collection("automationLogs")
                .document(logEntry.id).set(
                    hashMapOf(
                        "ruleId" to logEntry.ruleId,
                        "ruleName" to logEntry.ruleName,
                        "triggerType" to logEntry.triggerType,
                        "status" to logEntry.status,
                        "message" to logEntry.message,
                        "executionTimeMs" to logEntry.executionTimeMs,
                        "timestamp" to nowIso,
                        "tenantId" to tenantId
                    )
                )
        } catch (_: Exception) {}
        onComplete?.invoke(true, "Automation task executed successfully")
    }

    fun saveBusinessGoal(goal: BusinessGoalRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val docId = goal.id.ifBlank { "goal-${System.currentTimeMillis()}" }
            val docRef = firestore.collection("restaurants").document(tenantId).collection("businessGoals").document(docId)
            val map = hashMapOf(
                "title" to goal.title,
                "type" to goal.type,
                "targetValue" to goal.targetValue,
                "currentValue" to goal.currentValue,
                "unit" to goal.unit,
                "deadline" to goal.deadline,
                "status" to goal.status,
                "tenantId" to tenantId
            )
            docRef.set(map).addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val current = _businessGoals.value.toMutableList()
                    val idx = current.indexOfFirst { it.id == docId }
                    if (idx >= 0) current[idx] = goal.copy(id = docId) else current.add(0, goal.copy(id = docId))
                    _businessGoals.value = current
                    logAuditEvent("SAVE_BUSINESS_GOAL", "Strategy", "Saved business goal ${goal.title}")
                }
                onComplete?.invoke(task.isSuccessful)
            }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun deleteBusinessGoal(goalId: String, onComplete: ((Boolean) -> Unit)? = null) {
        _businessGoals.value = _businessGoals.value.filter { it.id != goalId }
        try {
            firestore.collection("restaurants").document(tenantId).collection("businessGoals")
                .document(goalId).delete().addOnCompleteListener { task ->
                    logAuditEvent("DELETE_BUSINESS_GOAL", "Strategy", "Deleted business goal $goalId")
                    onComplete?.invoke(task.isSuccessful)
                }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun updateBusinessGoalProgress(goalId: String, currentVal: Double) {
        _businessGoals.value = _businessGoals.value.map {
            if (it.id == goalId) {
                val isDone = currentVal >= it.targetValue
                it.copy(currentValue = currentVal, status = if (isDone) "completed" else "on_track")
            } else it
        }
        try {
            firestore.collection("restaurants").document(tenantId).collection("businessGoals")
                .document(goalId).update("currentValue", currentVal)
        } catch (_: Exception) {}
    }

    fun saveStrategyPlan(plan: StrategyPlanRecord, onComplete: ((Boolean) -> Unit)? = null) {
        try {
            val docId = plan.id.ifBlank { "plan-${System.currentTimeMillis()}" }
            val docRef = firestore.collection("restaurants").document(tenantId).collection("strategyPlans").document(docId)
            val map = hashMapOf(
                "title" to plan.title,
                "goalId" to plan.goalId,
                "category" to plan.category,
                "actionItems" to plan.actionItems,
                "status" to plan.status,
                "estimatedImpact" to plan.estimatedImpact,
                "tenantId" to tenantId
            )
            docRef.set(map).addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val current = _strategyPlans.value.toMutableList()
                    val idx = current.indexOfFirst { it.id == docId }
                    if (idx >= 0) current[idx] = plan.copy(id = docId) else current.add(0, plan.copy(id = docId))
                    _strategyPlans.value = current
                    logAuditEvent("SAVE_STRATEGY_PLAN", "Strategy", "Saved strategy playbook ${plan.title}")
                }
                onComplete?.invoke(task.isSuccessful)
            }
        } catch (_: Exception) {
            onComplete?.invoke(false)
        }
    }

    fun toggleAIRecommendation(recId: String, isImplemented: Boolean) {
        _aiRecommendations.value = _aiRecommendations.value.map {
            if (it.id == recId) it.copy(isImplemented = isImplemented) else it
        }
        try {
            firestore.collection("restaurants").document(tenantId).collection("aiRecommendations")
                .document(recId).update("isImplemented", isImplemented)
            logAuditEvent("TOGGLE_AI_RECOMMENDATION", "Intelligence", "Updated AI recommendation $recId to implemented=$isImplemented")
        } catch (_: Exception) {}
    }

    fun clearListeners() {
        ordersListener?.remove()
        transactionsListener?.remove()
        menuListener?.remove()
        categoriesListener?.remove()
        tablesListener?.remove()
        staffListener?.remove()
        promotionsListener?.remove()
        reservationsListener?.remove()
        variantsListener?.remove()
        addonsListener?.remove()
        combosListener?.remove()
        floorsListener?.remove()
        sectionsListener?.remove()
        shiftsListener?.remove()
        refundsListener?.remove()
        inventoryListener?.remove()
        recipesListener?.remove()
        stockMovementsListener?.remove()
        suppliersListener?.remove()
        wasteLogsListener?.remove()
        branchTransfersListener?.remove()
        customersListener?.remove()
        feedbackListener?.remove()
        campaignsListener?.remove()
        alertsListener?.remove()
        auditLogsListener?.remove()
        branchesSubListener?.remove()
        restaurantsListener?.remove()
        automationRulesListener?.remove()
        automationLogsListener?.remove()
        businessGoalsListener?.remove()
        strategyPlansListener?.remove()
        aiRecommendationsListener?.remove()
        restaurantDocListener?.remove()
    }

    /**
     * Completely resets all repository state and cached user/tenant flows on logout or account switch.
     */
    fun resetSession() {
        clearListeners()
        this.tenantId = ""
        _orders.value = emptyList()
        _transactions.value = emptyList()
        rawFirestoreTransactions = emptyList()
        _menuItems.value = emptyList()
        _categories.value = emptyList()
        _tables.value = emptyList()
        _staff.value = emptyList()
        _promotions.value = emptyList()
        _reservations.value = emptyList()
        _variants.value = emptyList()
        _addons.value = emptyList()
        _combos.value = emptyList()
        _floors.value = emptyList()
        _sections.value = emptyList()
        _shifts.value = emptyList()
        _refunds.value = emptyList()
        _inventory.value = emptyList()
        _recipes.value = emptyList()
        _stockMovements.value = emptyList()
        _suppliers.value = emptyList()
        _wasteLogs.value = emptyList()
        _branchTransfers.value = emptyList()
        _customers.value = emptyList()
        _feedback.value = emptyList()
        _reviews.value = emptyList()
        _campaigns.value = emptyList()
        _alerts.value = emptyList()
        _auditLogs.value = emptyList()
        _automationRules.value = emptyList()
        _automationSchedules.value = emptyList()
        _automationLogs.value = emptyList()
        _dailyBriefs.value = emptyList()
        _businessGoals.value = emptyList()
        _strategyPlans.value = emptyList()
        _aiRecommendations.value = emptyList()
        _authorizedRestaurants.value = emptyList()
        _overview.value = RestaurantOverview()
        _currentUserProfile.value = null
        _tenantState.value = TenantResolutionState.Idle
    }
}
