package com.spiraldine.owner

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiraldine.owner.data.model.TenantResolutionState
import com.spiraldine.owner.data.repository.FirebaseConfig
import com.spiraldine.owner.data.repository.OwnerRepository
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerBottomNavBar
import com.spiraldine.owner.ui.navigation.OwnerNavDestination
import com.spiraldine.owner.ui.screens.*
import com.spiraldine.owner.data.util.RevenueCalculator
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private val repository by lazy { OwnerRepository() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            FirebaseConfig.initialize(applicationContext)
        } catch (e: Exception) {
            android.util.Log.e("OwnerMainActivity", "FirebaseConfig initialization warning in onCreate", e)
        }

        setContent {
            SpiralDineOwnerTheme {
                OwnerApp(repository)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        repository.clearListeners()
    }
}

@Composable
fun OwnerApp(repository: OwnerRepository) {
    val orders by repository.orders.collectAsState()
    val menuItems by repository.menuItems.collectAsState()
    val categories by repository.categories.collectAsState()
    val variants by repository.variants.collectAsState()
    val addons by repository.addons.collectAsState()
    val combos by repository.combos.collectAsState()
    val tables by repository.tables.collectAsState()
    val floors by repository.floors.collectAsState()
    val sections by repository.sections.collectAsState()
    val staff by repository.staff.collectAsState()
    val shifts by repository.shifts.collectAsState()
    val refunds by repository.refunds.collectAsState()
    val transactions by repository.transactions.collectAsState()
    val inventory by repository.inventory.collectAsState()
    val recipes by repository.recipes.collectAsState()
    val stockMovements by repository.stockMovements.collectAsState()
    val suppliers by repository.suppliers.collectAsState()
    val wasteLogs by repository.wasteLogs.collectAsState()
    val promotions by repository.promotions.collectAsState()
    val reservations by repository.reservations.collectAsState()
    val overview by repository.overview.collectAsState()
    val tenantState by repository.tenantState.collectAsState()
    val branches by repository.branches.collectAsState()
    val branchTransfers by repository.branchTransfers.collectAsState()
    val customers by repository.customers.collectAsState()
    val feedback by repository.feedback.collectAsState()
    val reviews by repository.reviews.collectAsState()
    val campaigns by repository.campaigns.collectAsState()
    val alerts by repository.alerts.collectAsState()
    val auditLogs by repository.auditLogs.collectAsState()
    val authorizedRestaurants by repository.authorizedRestaurants.collectAsState()
    val automationRules by repository.automationRules.collectAsState()
    val automationSchedules by repository.automationSchedules.collectAsState()
    val automationLogs by repository.automationLogs.collectAsState()
    val dailyBriefs by repository.dailyBriefs.collectAsState()
    val businessGoals by repository.businessGoals.collectAsState()
    val strategyPlans by repository.strategyPlans.collectAsState()
    val aiRecommendations by repository.aiRecommendations.collectAsState()
    val currentUserProfile by repository.currentUserProfile.collectAsState()

    var currentUser by remember { mutableStateOf(FirebaseConfig.auth.currentUser) }
    DisposableEffect(Unit) {
        val auth = FirebaseConfig.auth
        val listener = com.google.firebase.auth.FirebaseAuth.AuthStateListener { fAuth ->
            currentUser = fAuth.currentUser
        }
        auth.addAuthStateListener(listener)
        onDispose {
            auth.removeAuthStateListener(listener)
        }
    }
    val coroutineScope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    val todayIso = remember {
        java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(java.util.Date())
    }
    val todayBookingsCount = remember(reservations, todayIso) {
        reservations.count {
            !it.id.startsWith("LOCK_") &&
            (it.date == todayIso || (it.date.isBlank() && it.createdAt.startsWith(todayIso))) &&
            it.status != "Cancelled"
        }
    }

    var currentDestination by remember {
        mutableStateOf<OwnerNavDestination>(
            if (currentUser != null) OwnerNavDestination.Home else OwnerNavDestination.Login
        )
    }
    val backStack = remember {
        mutableStateListOf<OwnerNavDestination>(
            if (currentUser != null) OwnerNavDestination.Home else OwnerNavDestination.Login
        )
    }
    var selectedOrderId by remember { mutableStateOf<String?>(null) }
    var selectedMenuItemId by remember { mutableStateOf<String?>(null) }

    // Resolve tenant dynamically on initial launch or auth change
    LaunchedEffect(currentUser?.uid) {
        val user = currentUser
        if (user != null) {
            repository.resolveTenantForUser(user.uid)
        } else {
            repository.resetSession()
            currentDestination = OwnerNavDestination.Login
        }
    }

    val pendingOrdersCount = remember(orders) {
        orders.count { it.status == "PENDING" || it.status == "NEW" }
    }

    fun navigateTo(dest: OwnerNavDestination) {
        if (currentDestination != dest) {
            backStack.add(dest)
            currentDestination = dest
        }
    }

    fun navigateBack() {
        if (backStack.size > 1) {
            backStack.removeAt(backStack.lastIndex)
            currentDestination = backStack.last()
        } else {
            currentDestination = OwnerNavDestination.Home
        }
    }

    fun selectTab(dest: OwnerNavDestination) {
        backStack.clear()
        backStack.add(dest)
        currentDestination = dest
    }

    fun performLogout() {
        try {
            FirebaseConfig.auth.signOut()
        } catch (_: Exception) {}
        repository.resetSession()
        backStack.clear()
        backStack.add(OwnerNavDestination.Login)
        currentDestination = OwnerNavDestination.Login
    }

    // Android Hardware Back button handling
    val canGoBack = backStack.size > 1 && currentDestination !in listOf(
        OwnerNavDestination.Home,
        OwnerNavDestination.Login
    )
    BackHandler(enabled = canGoBack) {
        navigateBack()
    }

    // Safe Failure State: If authenticated but no restaurant tenant is assigned to this user
    if (currentUser != null && tenantState is TenantResolutionState.NoTenantAssigned) {
        val noTenant = tenantState as TenantResolutionState.NoTenantAssigned
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(BackgroundLight)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Icon(
                        Icons.Default.Warning,
                        contentDescription = "No Tenant",
                        tint = ErrorRed,
                        modifier = Modifier.size(48.dp)
                    )
                    Text(
                        "No Restaurant Assigned",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Text(
                        "Your account (${currentUser?.email ?: noTenant.uid}) is verified, but no active restaurant tenant is mapped to your profile. Please contact your platform administrator.",
                        fontSize = 13.sp,
                        color = TextSecondary,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    Button(
                        onClick = { performLogout() },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Log Out")
                    }
                }
            }
        }
        return
    }

    // Loading State
    if (currentUser != null && tenantState is TenantResolutionState.Loading) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(BackgroundLight),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = TerracottaOrange, strokeWidth = 3.dp)
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    "Resolving restaurant workspace...",
                    fontSize = 14.sp,
                    color = TextSecondary,
                    fontWeight = FontWeight.Medium
                )
            }
        }
        return
    }

    val isTopLevelTab = currentDestination in listOf(
        OwnerNavDestination.Home,
        OwnerNavDestination.Orders,
        OwnerNavDestination.Menu,
        OwnerNavDestination.Business,
        OwnerNavDestination.More
    )

    Scaffold(
        bottomBar = {
            if (isTopLevelTab && currentDestination != OwnerNavDestination.Login) {
                OwnerBottomNavBar(
                    currentDestination = currentDestination,
                    onTabSelected = { tabDest -> selectTab(tabDest) },
                    pendingOrdersCount = pendingOrdersCount
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (currentDestination) {
                OwnerNavDestination.Login -> {
                    OwnerLoginScreen(
                        onLoginSuccess = { uid ->
                            coroutineScope.launch {
                                repository.resolveTenantForUser(uid)
                                selectTab(OwnerNavDestination.Home)
                            }
                        }
                    )
                }

                OwnerNavDestination.Home -> {
                    OwnerHomeScreen(
                        overview = overview,
                        liveOrders = orders.filter { it.status == "PENDING" || it.status == "NEW" || it.status == "PREPARING" },
                        reservationsCount = todayBookingsCount,
                        branches = branches,
                        onSelectBranch = { branchId ->
                            repository.switchBranch(branchId)
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("Switched workspace to $branchId")
                            }
                        },
                        onOrderClick = { orderId ->
                            selectedOrderId = orderId
                            navigateTo(OwnerNavDestination.OrderDetails)
                        },
                        onQuickActionClick = { actionKey ->
                            when (actionKey) {
                                "orders" -> selectTab(OwnerNavDestination.Orders)
                                "add_item" -> {
                                    selectedMenuItemId = null
                                    navigateTo(OwnerNavDestination.AddEditItem)
                                }
                                "tables" -> navigateTo(OwnerNavDestination.Tables)
                                "analytics" -> navigateTo(OwnerNavDestination.Analytics)
                                "annual_revenue" -> navigateTo(OwnerNavDestination.AnnualRevenue)
                                "staff" -> navigateTo(OwnerNavDestination.Staff)
                                "reservations" -> navigateTo(OwnerNavDestination.Reservations)
                                "menu_tools" -> navigateTo(OwnerNavDestination.MenuTools)
                                else -> selectTab(OwnerNavDestination.Orders)
                            }
                        },
                        onNotificationsClick = {
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("Notifications: $pendingOrdersCount active order alerts")
                            }
                        },
                        onProfileClick = {
                            navigateTo(OwnerNavDestination.Settings)
                        },
                        userProfile = currentUserProfile
                    )
                }

                OwnerNavDestination.Orders -> {
                    OwnerOrdersScreen(
                        orders = orders,
                        onOrderClick = { orderId ->
                            selectedOrderId = orderId
                            navigateTo(OwnerNavDestination.OrderDetails)
                        },
                        onAdvanceStatus = { orderId, nextStatus ->
                            repository.updateOrderStatus(orderId, nextStatus) { success ->
                                if (success) {
                                    coroutineScope.launch { snackbarHostState.showSnackbar("Order updated to $nextStatus") }
                                }
                            }
                        }
                    )
                }

                OwnerNavDestination.OrderDetails -> {
                    val currentOrder = orders.find { it.id == selectedOrderId }
                    OwnerOrderDetailsScreen(
                        order = currentOrder,
                        onBack = { navigateBack() },
                        onUpdateStatus = { nextStatus ->
                            selectedOrderId?.let { id ->
                                repository.updateOrderStatus(id, nextStatus) { success ->
                                    if (success) {
                                        coroutineScope.launch { snackbarHostState.showSnackbar("Order updated to $nextStatus") }
                                    }
                                }
                            }
                        }
                    )
                }

                OwnerNavDestination.Menu -> {
                    OwnerMenuScreen(
                        items = menuItems,
                        categories = categories,
                        restaurantName = overview.name,
                        branchName = overview.branch,
                        onAddItemClick = {
                            selectedMenuItemId = null
                            navigateTo(OwnerNavDestination.AddEditItem)
                        },
                        onEditItemClick = { itemId ->
                            selectedMenuItemId = itemId
                            navigateTo(OwnerNavDestination.AddEditItem)
                        },
                        onDuplicateItem = { item ->
                            repository.duplicateMenuItem(item) { success ->
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar(if (success) "Duplicated ${item.name}" else "Item duplicated")
                                }
                            }
                        },
                        onDeleteItem = { itemId ->
                            repository.deleteMenuItem(itemId)
                            coroutineScope.launch { snackbarHostState.showSnackbar("Menu item deleted") }
                        },
                        onCategoriesClick = {
                            navigateTo(OwnerNavDestination.Categories)
                        },
                        onMenuToolsClick = {
                            navigateTo(OwnerNavDestination.MenuTools)
                        },
                        onToggleAvailability = { itemId, currentStatus ->
                            repository.toggleItemAvailability(itemId, currentStatus)
                        },
                        onTogglePublished = { itemId, currentPublished ->
                            repository.toggleItemPublished(itemId, currentPublished)
                        }
                    )
                }

                OwnerNavDestination.MenuTools -> {
                    OwnerMenuToolsScreen(
                        items = menuItems,
                        categories = categories,
                        variants = variants,
                        addons = addons,
                        combos = combos,
                        orders = orders,
                        restaurantName = overview.name,
                        branchName = overview.branch,
                        onBack = { navigateBack() },
                        onSaveCategory = { name, desc, order ->
                            repository.saveCategory(name, order)
                            coroutineScope.launch { snackbarHostState.showSnackbar("Category \"$name\" saved") }
                        },
                        onDeleteCategory = { catId ->
                            repository.deleteCategory(catId)
                            coroutineScope.launch { snackbarHostState.showSnackbar("Category removed") }
                        },
                        onToggleCategoryActive = { catId, currentActive ->
                            repository.toggleCategoryActive(catId, currentActive)
                        },
                        onReorderCategory = { catId, newOrder ->
                            repository.reorderCategory(catId, newOrder)
                        },
                        onSaveVariant = { itemId, itemName, name, price ->
                            repository.saveVariant(
                                com.spiraldine.owner.data.model.MenuVariantRecord(
                                    itemId = itemId,
                                    itemName = itemName,
                                    name = name,
                                    price = price,
                                    isAvailable = true
                                )
                            ) { success ->
                                coroutineScope.launch { snackbarHostState.showSnackbar(if (success) "Portion saved" else "Saved locally") }
                            }
                        },
                        onDeleteVariant = { variantId ->
                            repository.deleteVariant(variantId) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Portion removed") }
                            }
                        },
                        onToggleVariantAvailability = { variantId, currentAvailable ->
                            repository.toggleVariantAvailability(variantId, currentAvailable)
                        },
                        onSaveAddon = { name, price, isGlobal, applicableItems ->
                            repository.saveAddon(
                                com.spiraldine.owner.data.model.MenuAddonRecord(
                                    name = name,
                                    price = price,
                                    isGlobal = isGlobal,
                                    applicableItems = applicableItems,
                                    isAvailable = true
                                )
                            ) { success ->
                                coroutineScope.launch { snackbarHostState.showSnackbar(if (success) "Add-on saved" else "Saved locally") }
                            }
                        },
                        onDeleteAddon = { addonId ->
                            repository.deleteAddon(addonId) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Add-on removed") }
                            }
                        },
                        onToggleAddonAvailability = { addonId, currentAvailable ->
                            repository.toggleAddonAvailability(addonId, currentAvailable)
                        },
                        onSaveCombo = { name, desc, price, comboItems ->
                            repository.saveCombo(
                                com.spiraldine.owner.data.model.MenuComboRecord(
                                    name = name,
                                    description = desc,
                                    price = price,
                                    items = comboItems,
                                    isAvailable = true,
                                    isPublished = true
                                )
                            ) { success ->
                                coroutineScope.launch { snackbarHostState.showSnackbar(if (success) "Combo meal saved" else "Saved locally") }
                            }
                        },
                        onDeleteCombo = { comboId ->
                            repository.deleteCombo(comboId) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Combo removed") }
                            }
                        },
                        onToggleComboAvailability = { comboId, currentAvailable ->
                            repository.toggleComboAvailability(comboId, currentAvailable)
                        },
                        onToggleItemAvailability = { itemId, currentAvailable ->
                            repository.toggleItemAvailability(itemId, currentAvailable)
                        },
                        onUpdateItemPrice = { itemId, newPrice, discPrice ->
                            repository.updateItemPrice(itemId, newPrice, discPrice) { success ->
                                coroutineScope.launch { snackbarHostState.showSnackbar(if (success) "Price updated" else "Price updated locally") }
                            }
                        }
                    )
                }

                OwnerNavDestination.AddEditItem -> {
                    val itemToEdit = menuItems.find { it.id == selectedMenuItemId }
                    OwnerAddEditItemScreen(
                        item = itemToEdit,
                        categories = categories,
                        onBack = { navigateBack() },
                        onSave = { savedItem ->
                            repository.saveMenuItem(savedItem) { success ->
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar(if (success) "Menu item saved" else "Saved locally")
                                }
                            }
                            navigateBack()
                        },
                        onDelete = { itemId ->
                            repository.deleteMenuItem(itemId)
                            coroutineScope.launch { snackbarHostState.showSnackbar("Menu item removed") }
                            navigateBack()
                        }
                    )
                }

                OwnerNavDestination.Categories -> {
                    OwnerCategoriesScreen(
                        categories = categories,
                        onBack = { navigateBack() },
                        onSaveCategory = { cat ->
                            repository.saveCategory(cat) { success ->
                                coroutineScope.launch { snackbarHostState.showSnackbar(if (success) "Category saved" else "Saved locally") }
                            }
                        },
                        onAddCategory = { name, order ->
                            repository.saveCategory(name, order)
                            coroutineScope.launch { snackbarHostState.showSnackbar("Category created") }
                        },
                        onDeleteCategory = { catId ->
                            repository.deleteCategory(catId)
                            coroutineScope.launch { snackbarHostState.showSnackbar("Category removed") }
                        }
                    )
                }

                OwnerNavDestination.Business -> {
                    OwnerBusinessScreen(
                        onNavigateToModule = { moduleId ->
                            when (moduleId) {
                                "intelligence" -> navigateTo(OwnerNavDestination.Intelligence)
                                "automation" -> navigateTo(OwnerNavDestination.Automation)
                                "strategy" -> navigateTo(OwnerNavDestination.Strategy)
                                "analytics" -> navigateTo(OwnerNavDestination.Analytics)
                                "annual_revenue" -> navigateTo(OwnerNavDestination.AnnualRevenue)
                                "tables" -> navigateTo(OwnerNavDestination.Tables)
                                "reservations" -> navigateTo(OwnerNavDestination.Reservations)
                                "staff" -> navigateTo(OwnerNavDestination.Staff)
                                "billing" -> navigateTo(OwnerNavDestination.Billing)
                                "inventory" -> navigateTo(OwnerNavDestination.Inventory)
                                "promotions" -> navigateTo(OwnerNavDestination.Promotions)
                                "settings" -> navigateTo(OwnerNavDestination.Settings)
                                else -> navigateTo(OwnerNavDestination.Analytics)
                            }
                        }
                    )
                }

                OwnerNavDestination.Analytics -> {
                    OwnerAnalyticsScreen(
                        orders = orders,
                        onBack = { navigateBack() }
                    )
                }

                OwnerNavDestination.Tables -> {
                    OwnerTablesScreen(
                        tables = tables,
                        floors = floors,
                        sections = sections,
                        onBack = { navigateBack() },
                        onSaveTable = { table ->
                            repository.saveTableDetails(table) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Table ${table.tableNumber} saved") }
                            }
                        },
                        onDeleteTable = { tableId ->
                            repository.deleteTable(tableId) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Table deleted") }
                            }
                        },
                        onToggleStatus = { tableId, currentStatus ->
                            repository.toggleTableStatus(tableId, currentStatus)
                        },
                        onUpdatePosition = { tableId, x, y ->
                            repository.updateTablePosition(tableId, x, y)
                        },
                        onSaveFloor = { name, level ->
                            repository.saveFloor(name, level) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Floor \"$name\" saved") }
                            }
                        },
                        onDeleteFloor = { floorId ->
                            repository.deleteFloor(floorId) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Floor deleted") }
                            }
                        },
                        onSaveSection = { name, floorId ->
                            repository.saveSection(name, floorId) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Section \"$name\" saved") }
                            }
                        },
                        onDeleteSection = { sectionId ->
                            repository.deleteSection(sectionId) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Section deleted") }
                            }
                        }
                    )
                }

                OwnerNavDestination.Reservations -> {
                    OwnerReservationsScreen(
                        reservations = reservations,
                        tables = tables,
                        onBack = { navigateBack() },
                        onUpdateStatus = { resId, newStatus, tableId ->
                            repository.updateReservationStatus(resId, newStatus, tableId) { success ->
                                if (success) {
                                    coroutineScope.launch { snackbarHostState.showSnackbar("Reservation marked $newStatus") }
                                }
                            }
                        },
                        onAddReservation = { name, phone, date, time, guests, tableNum ->
                            repository.saveReservation(name, phone, date, time, guests, tableNum) { success ->
                                if (success) {
                                    coroutineScope.launch { snackbarHostState.showSnackbar("Reservation confirmed for $name") }
                                }
                            }
                        }
                    )
                }

                OwnerNavDestination.Staff -> {
                    OwnerStaffScreen(
                        staffList = staff,
                        onBack = { navigateBack() },
                        onInviteStaff = { name, email, phone, role, dept ->
                            coroutineScope.launch {
                                val result = repository.inviteStaffMember(name, role, email, phone)
                                val msg = result.getOrElse { it.message ?: "Failed to dispatch invitation" }
                                snackbarHostState.showSnackbar(msg)
                            }
                        },
                        onUpdateStaff = { id, name, role, dept, phone ->
                            repository.updateStaffMember(id, name, role, dept, phone) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Staff member updated") }
                            }
                        },
                        onToggleStatus = { staffId, currentActive ->
                            repository.toggleStaffStatus(staffId, currentActive)
                        },
                        onArchiveStaff = { staffId ->
                            repository.archiveStaffMember(staffId) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Staff member archived") }
                            }
                        }
                    )
                }

                OwnerNavDestination.Billing -> {
                    OwnerBillingScreen(
                        orders = orders,
                        transactions = transactions,
                        shifts = shifts,
                        refunds = refunds,
                        onBack = { navigateBack() },
                        onOpenShift = { cash, notes ->
                            repository.openShift(cash, notes) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Shift drawer opened with ${RevenueCalculator.formatInr(cash)}") }
                            }
                        },
                        onCloseShift = { actualCash, notes ->
                            repository.closeShift(actualCash, notes) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Shift drawer closed and reconciled") }
                            }
                        },
                        onSettleBill = { orderId, method ->
                            repository.settleBill(orderId, method) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Bill marked paid via $method") }
                            }
                        },
                        onProcessRefund = { orderId, amount, reason, type ->
                            repository.processRefund(orderId, amount, reason, type) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Refund authorized") }
                            }
                        }
                    )
                }

                OwnerNavDestination.Inventory -> {
                    OwnerInventoryScreen(
                        ingredients = inventory,
                        recipes = recipes,
                        movements = stockMovements,
                        suppliers = suppliers,
                        wasteLogs = wasteLogs,
                        onBack = { navigateBack() },
                        onSaveIngredient = { item ->
                            repository.saveIngredient(item) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Ingredient \"${item.name}\" saved") }
                            }
                        },
                        onDeleteIngredient = { id ->
                            repository.deleteIngredient(id) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Ingredient deleted") }
                            }
                        },
                        onRecordMovement = { id, name, change, type, reason ->
                            repository.recordStockMovement(id, name, change, type, reason) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Stock movement recorded") }
                            }
                        },
                        onSaveSupplier = { supplier ->
                            repository.saveSupplier(supplier) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Supplier \"${supplier.name}\" saved") }
                            }
                        },
                        onDeleteSupplier = { id ->
                            repository.deleteSupplier(id) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Supplier removed") }
                            }
                        },
                        onRecordWaste = { id, name, qty, unit, reason, notes, cost ->
                            repository.recordWaste(id, name, qty, unit, reason, notes, cost) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Logged $qty $unit waste for $name") }
                            }
                        },
                        onSaveRecipe = { recipe ->
                            repository.saveRecipe(recipe) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Recipe for ${recipe.menuItemName} saved") }
                            }
                        }
                    )
                }

                OwnerNavDestination.Promotions -> {
                    OwnerPromotionsScreen(
                        promotions = promotions,
                        onBack = { navigateBack() },
                        onAddPromotion = { title, code, type, value, minOrder ->
                            repository.savePromotion(title, code, type, value, minOrder)
                            coroutineScope.launch { snackbarHostState.showSnackbar("Offer $code created") }
                        },
                        onTogglePromotion = { promoId, currentActive ->
                            repository.togglePromotion(promoId, currentActive)
                        }
                    )
                }

                OwnerNavDestination.More -> {
                    OwnerMoreScreen(
                        overview = overview,
                        branches = branches,
                        onSelectBranch = { branchId ->
                            repository.switchBranch(branchId)
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("Switched branch to $branchId")
                            }
                        },
                        onToggleOpenStatus = { currentOpen ->
                            repository.toggleRestaurantOpenStatus(currentOpen)
                        },
                        onNavigate = { destKey ->
                            when (destKey) {
                                "intelligence" -> navigateTo(OwnerNavDestination.Intelligence)
                                "automation" -> navigateTo(OwnerNavDestination.Automation)
                                "strategy" -> navigateTo(OwnerNavDestination.Strategy)
                                "analytics" -> navigateTo(OwnerNavDestination.Analytics)
                                "tables" -> navigateTo(OwnerNavDestination.Tables)
                                "reservations" -> navigateTo(OwnerNavDestination.Reservations)
                                "staff" -> navigateTo(OwnerNavDestination.Staff)
                                "billing" -> navigateTo(OwnerNavDestination.Billing)
                                "inventory" -> navigateTo(OwnerNavDestination.Inventory)
                                "promotions" -> navigateTo(OwnerNavDestination.Promotions)
                                "settings" -> navigateTo(OwnerNavDestination.Settings)
                                "restaurants" -> navigateTo(OwnerNavDestination.Restaurants)
                                "branch_transfers" -> navigateTo(OwnerNavDestination.BranchTransfers)
                                "customers" -> navigateTo(OwnerNavDestination.Customers)
                                "feedback" -> navigateTo(OwnerNavDestination.Feedback)
                                "reviews" -> navigateTo(OwnerNavDestination.Reviews)
                                "marketing" -> navigateTo(OwnerNavDestination.Marketing)
                                "alerts" -> navigateTo(OwnerNavDestination.Alerts)
                                "reports" -> navigateTo(OwnerNavDestination.Reports)
                                "audit_logs" -> navigateTo(OwnerNavDestination.AuditLogs)
                                else -> {}
                            }
                        },
                        onLogout = {
                            performLogout()
                        }
                    )
                }

                OwnerNavDestination.Restaurants -> {
                    val resolvedTenantId = (tenantState as? TenantResolutionState.Resolved)?.tenantId ?: ""
                    OwnerRestaurantsScreen(
                        currentRestaurantName = overview.name,
                        currentBranchName = overview.branch,
                        currentTenantId = resolvedTenantId,
                        restaurants = authorizedRestaurants,
                        branches = branches,
                        staff = staff,
                        onBack = { navigateBack() },
                        onSelectBranch = { branchId ->
                            repository.switchBranch(branchId)
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("Switched active branch to $branchId")
                            }
                        },
                        onSaveBranch = { branchRecord ->
                            repository.saveBranch(branchRecord) { success ->
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar(if (success) "Branch \"${branchRecord.name}\" saved" else "Failed to save branch")
                                }
                            }
                        },
                        onToggleBranchActive = { branchId, currentActive ->
                            repository.toggleBranchActive(branchId, currentActive) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Branch status updated")
                                }
                            }
                        },
                        onSaveRestaurant = { restRecord, isEditing ->
                            repository.saveRestaurant(restRecord, isEditing) { success ->
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar(
                                        if (success) "${if (isEditing) "Updated" else "Created"} restaurant \"${restRecord.name}\""
                                        else "Failed to save restaurant"
                                    )
                                }
                            }
                        },
                        onToggleRestaurantStatus = { restId, currentStatus ->
                            repository.toggleRestaurantStatus(restId, currentStatus) { success ->
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar(if (success) "Restaurant status changed" else "Failed to change status")
                                }
                            }
                        },
                        onAssignManager = { restId, managerId, managerName ->
                            repository.assignRestaurantManager(restId, managerId, managerName) { success ->
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar(if (success) "Branch manager assigned" else "Failed to assign manager")
                                }
                            }
                        },
                        onSwitchWorkspace = { targetRestId, targetRestName ->
                            repository.setAuthorizedTenant(targetRestId, targetRestName)
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar("Active workspace switched to $targetRestName")
                            }
                        },
                        onFetchBranches = { restId, callback ->
                            repository.fetchRestaurantBranches(restId, callback)
                        }
                    )
                }

                OwnerNavDestination.BranchTransfers -> {
                    OwnerBranchTransfersScreen(
                        transfers = branchTransfers,
                        branches = branches,
                        onBack = { navigateBack() },
                        onCreateTransfer = { transfer ->
                            repository.saveBranchTransfer(transfer) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Transfer requested for ${transfer.itemName}")
                                }
                            }
                        },
                        onUpdateStatus = { transferId, newStatus ->
                            repository.updateTransferStatus(transferId, newStatus) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Transfer status updated to $newStatus")
                                }
                            }
                        }
                    )
                }

                OwnerNavDestination.Customers -> {
                    OwnerCustomersScreen(
                        customers = customers,
                        onBack = { navigateBack() }
                    )
                }

                OwnerNavDestination.Feedback -> {
                    OwnerFeedbackScreen(
                        feedbacks = feedback,
                        onBack = { navigateBack() },
                        onUpdateStatus = { feedbackId, newStatus, assignedTo, notes ->
                            repository.updateFeedbackStatus(feedbackId, newStatus, assignedTo, notes) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Feedback marked as $newStatus")
                                }
                            }
                        }
                    )
                }

                OwnerNavDestination.Reviews -> {
                    OwnerReviewsScreen(
                        reviews = reviews,
                        onBack = { navigateBack() }
                    )
                }

                OwnerNavDestination.Marketing -> {
                    OwnerMarketingScreen(
                        campaigns = campaigns,
                        onBack = { navigateBack() },
                        onSaveCampaign = { campaign ->
                            repository.saveCampaign(campaign) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Campaign \"${campaign.name}\" created")
                                }
                            }
                        },
                        onToggleStatus = { campaignId, isActive ->
                            repository.toggleCampaignStatus(campaignId, isActive)
                        },
                        onDeleteCampaign = { campaignId ->
                            repository.deleteCampaign(campaignId) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Campaign deleted")
                                }
                            }
                        }
                    )
                }

                OwnerNavDestination.Alerts -> {
                    OwnerAlertsScreen(
                        alerts = alerts,
                        onBack = { navigateBack() },
                        onMarkRead = { alertId ->
                            repository.markAlertRead(alertId)
                        },
                        onMarkResolved = { alertId ->
                            repository.markAlertResolved(alertId) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Alert marked as resolved")
                                }
                            }
                        },
                        onAssignAlert = { alertId, staffName ->
                            repository.assignAlert(alertId, staffName) {
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar("Alert assigned to $staffName")
                                }
                            }
                        }
                    )
                }

                OwnerNavDestination.Reports -> {
                    val initialReport = remember(orders, inventory, staff, tables, customers) {
                        repository.generateReportSummary("sales", "This Month")
                    }
                    OwnerReportsScreen(
                        currentReport = initialReport,
                        onBack = { navigateBack() },
                        onGenerateReport = { type, period ->
                            repository.generateReportSummary(type, period)
                        }
                    )
                }

                OwnerNavDestination.AuditLogs -> {
                    OwnerAuditLogsScreen(
                        logs = auditLogs,
                        onBack = { navigateBack() }
                    )
                }

                OwnerNavDestination.Settings -> {
                    OwnerSettingsScreen(
                        userEmail = currentUser?.email ?: currentUserProfile?.email ?: overview.email,
                        restaurantName = overview.name,
                        branchName = overview.branch,
                        logoUrl = overview.logoUrl,
                        userProfile = currentUserProfile,
                        onBack = { navigateBack() },
                        onLogout = {
                            performLogout()
                        }
                    )
                }

                OwnerNavDestination.AnnualRevenue -> {
                    val transactions by repository.transactions.collectAsState()
                    OwnerAnnualRevenueScreen(
                        transactions = transactions,
                        onBack = { navigateBack() }
                    )
                }

                OwnerNavDestination.Automation -> {
                    OwnerAutomationScreen(
                        rules = automationRules,
                        schedules = automationSchedules,
                        logs = automationLogs,
                        dailyBriefs = dailyBriefs,
                        onBack = { navigateBack() },
                        onToggleRule = { ruleId, currentEnabled ->
                            repository.toggleAutomationRule(ruleId, currentEnabled)
                        },
                        onTriggerRule = { ruleName ->
                            repository.triggerManualAutomation(ruleName) { success, msg ->
                                coroutineScope.launch { snackbarHostState.showSnackbar(msg) }
                            }
                        }
                    )
                }

                OwnerNavDestination.Strategy -> {
                    OwnerStrategyScreen(
                        goals = businessGoals,
                        plans = strategyPlans,
                        onBack = { navigateBack() },
                        onSaveGoal = { goal ->
                            repository.saveBusinessGoal(goal) { success ->
                                coroutineScope.launch {
                                    snackbarHostState.showSnackbar(if (success) "Goal \"${goal.title}\" saved" else "Saved locally")
                                }
                            }
                        },
                        onUpdateProgress = { goalId, newVal ->
                            repository.updateBusinessGoalProgress(goalId, newVal)
                        },
                        onDeleteGoal = { goalId ->
                            repository.deleteBusinessGoal(goalId) {
                                coroutineScope.launch { snackbarHostState.showSnackbar("Goal deleted") }
                            }
                        }
                    )
                }

                OwnerNavDestination.Intelligence -> {
                    OwnerIntelligenceScreen(
                        recommendations = aiRecommendations,
                        onBack = { navigateBack() },
                        onToggleRecommendation = { recId, isImplemented ->
                            repository.toggleAIRecommendation(recId, isImplemented)
                            coroutineScope.launch {
                                snackbarHostState.showSnackbar(if (isImplemented) "Recommendation marked as implemented" else "Recommendation reset")
                            }
                        }
                    )
                }
            }
        }
    }
}
