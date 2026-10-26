package com.spiralworld.spiraldine

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.spiralworld.spiraldine.data.model.MenuItem
import com.spiralworld.spiraldine.data.model.OrderHistoryState
import com.spiralworld.spiraldine.data.model.OrderRecord
import com.spiralworld.spiraldine.data.model.Promotion
import com.spiralworld.spiraldine.data.model.Restaurant
import com.spiralworld.spiraldine.data.repository.AuthRepository
import com.spiralworld.spiraldine.data.repository.CartRepository
import com.spiralworld.spiraldine.data.repository.DiningSessionRepository
import com.spiralworld.spiraldine.data.repository.MenuRepository
import com.spiralworld.spiraldine.data.repository.OrderRepository
import com.spiralworld.spiraldine.data.repository.QrParser
import com.spiralworld.spiraldine.data.repository.RestaurantRepository
import com.spiralworld.spiraldine.theme.SpiralDineTheme
import com.spiralworld.spiraldine.theme.WarmBackground
import com.spiralworld.spiraldine.ui.navigation.NavDestination
import com.spiralworld.spiraldine.ui.navigation.SpiralDineBottomNavBar
import com.spiralworld.spiraldine.ui.screens.CartScreen
import com.spiralworld.spiraldine.ui.screens.ExploreScreen
import com.spiralworld.spiraldine.ui.screens.HomeScreen
import com.spiralworld.spiraldine.ui.screens.OrdersScreen
import com.spiralworld.spiraldine.ui.screens.ProfileScreen
import com.spiralworld.spiraldine.ui.screens.QrScannerScreen
import com.spiralworld.spiraldine.ui.screens.RestaurantMenuScreen
import com.spiralworld.spiraldine.ui.screens.SplashScreen
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var authRepository: AuthRepository
    private lateinit var diningSessionRepository: DiningSessionRepository
    private lateinit var restaurantRepository: RestaurantRepository
    private lateinit var menuRepository: MenuRepository
    private lateinit var cartRepository: CartRepository
    private lateinit var orderRepository: OrderRepository
    private lateinit var paymentRepository: com.spiralworld.spiraldine.data.repository.PaymentRepository
    private lateinit var fcmTokenManager: com.spiralworld.spiraldine.data.repository.FcmTokenManager
    private lateinit var serviceAssistanceRepository: com.spiralworld.spiraldine.data.repository.ServiceAssistanceRepository
    private lateinit var reviewRepository: com.spiralworld.spiraldine.data.repository.ReviewRepository
    private lateinit var reservationRepository: com.spiralworld.spiraldine.data.repository.ReservationRepository
    private lateinit var favouritesRepository: com.spiralworld.spiraldine.data.repository.FavouritesRepository
    private lateinit var customerNotificationRepository: com.spiralworld.spiraldine.data.repository.CustomerNotificationRepository
    private lateinit var supportTicketRepository: com.spiralworld.spiraldine.data.repository.SupportTicketRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        try {
            com.spiralworld.spiraldine.data.repository.FirebaseConfig.initialize(applicationContext)
        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "FirebaseConfig initialization warning in onCreate", e)
        }

        authRepository = AuthRepository()
        diningSessionRepository = DiningSessionRepository(applicationContext)
        restaurantRepository = RestaurantRepository()
        menuRepository = MenuRepository()
        cartRepository = CartRepository(applicationContext)
        orderRepository = OrderRepository()
        paymentRepository = com.spiralworld.spiraldine.data.repository.PaymentRepository()
        fcmTokenManager = com.spiralworld.spiraldine.data.repository.FcmTokenManager(applicationContext)
        serviceAssistanceRepository = com.spiralworld.spiraldine.data.repository.ServiceAssistanceRepository()
        reviewRepository = com.spiralworld.spiraldine.data.repository.ReviewRepository()
        reservationRepository = com.spiralworld.spiraldine.data.repository.ReservationRepository()
        favouritesRepository = com.spiralworld.spiraldine.data.repository.FavouritesRepository(applicationContext)
        customerNotificationRepository = com.spiralworld.spiraldine.data.repository.CustomerNotificationRepository()
        supportTicketRepository = com.spiralworld.spiraldine.data.repository.SupportTicketRepository()

        // Handle possible deep link from scanned QR URL
        val intentData = intent?.data?.toString()
        val parsedDeepLink = QrParser.parse(intentData)

        // Handle possible notification order click
        val notificationOrderId = intent?.getStringExtra(com.spiralworld.spiraldine.data.repository.SpiralDineMessagingService.EXTRA_ORDER_ID)

        setContent {
            SpiralDineTheme {
                MainAppContent(
                    authRepository = authRepository,
                    diningSessionRepository = diningSessionRepository,
                    restaurantRepository = restaurantRepository,
                    menuRepository = menuRepository,
                    cartRepository = cartRepository,
                    orderRepository = orderRepository,
                    paymentRepository = paymentRepository,
                    fcmTokenManager = fcmTokenManager,
                    serviceAssistanceRepository = serviceAssistanceRepository,
                    reviewRepository = reviewRepository,
                    reservationRepository = reservationRepository,
                    favouritesRepository = favouritesRepository,
                    customerNotificationRepository = customerNotificationRepository,
                    supportTicketRepository = supportTicketRepository,
                    initialDeepLink = parsedDeepLink,
                    notificationOrderId = notificationOrderId,
                    showToast = { msg -> Toast.makeText(this@MainActivity, msg, Toast.LENGTH_SHORT).show() }
                )
            }
        }
    }
}

@Composable
fun MainAppContent(
    authRepository: AuthRepository,
    diningSessionRepository: DiningSessionRepository,
    restaurantRepository: RestaurantRepository,
    menuRepository: MenuRepository,
    cartRepository: CartRepository,
    orderRepository: OrderRepository,
    paymentRepository: com.spiralworld.spiraldine.data.repository.PaymentRepository,
    fcmTokenManager: com.spiralworld.spiraldine.data.repository.FcmTokenManager,
    serviceAssistanceRepository: com.spiralworld.spiraldine.data.repository.ServiceAssistanceRepository,
    reviewRepository: com.spiralworld.spiraldine.data.repository.ReviewRepository,
    reservationRepository: com.spiralworld.spiraldine.data.repository.ReservationRepository,
    favouritesRepository: com.spiralworld.spiraldine.data.repository.FavouritesRepository,
    customerNotificationRepository: com.spiralworld.spiraldine.data.repository.CustomerNotificationRepository,
    supportTicketRepository: com.spiralworld.spiraldine.data.repository.SupportTicketRepository,
    initialDeepLink: com.spiralworld.spiraldine.data.repository.ParsedQrResult?,
    notificationOrderId: String?,
    showToast: (String) -> Unit
) {
    val coroutineScope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current

    // Global App States
    val user by authRepository.authState.collectAsState(initial = authRepository.currentUser)
    val diningSession by diningSessionRepository.currentSession.collectAsState()
    val restaurants by restaurantRepository.getRestaurants().collectAsState(initial = emptyList())
    val cartItems by cartRepository.items.collectAsState()

    var isRestaurantsLoading by remember { mutableStateOf(true) }
    LaunchedEffect(restaurants) {
        if (restaurants.isNotEmpty()) {
            isRestaurantsLoading = false
        }
    }
    LaunchedEffect(Unit) {
        kotlinx.coroutines.delay(6000)
        isRestaurantsLoading = false
    }

    // Real menu dishes from onboarded venues for Section G
    val popularDishes by androidx.compose.runtime.produceState<List<Pair<MenuItem, Restaurant>>>(
        initialValue = emptyList(),
        restaurants
    ) {
        if (restaurants.isNotEmpty()) {
            val collected = mutableListOf<Pair<MenuItem, Restaurant>>()
            for (r in restaurants.take(3)) {
                try {
                    val items = menuRepository.getMenuItems(r.id).firstOrNull()
                    if (items != null) {
                        collected.addAll(items.filter { it.isAvailable }.take(3).map { it to r })
                    }
                } catch (e: Exception) {
                    // Ignore
                }
            }
            value = collected.distinctBy { it.first.name }.take(8)
        }
    }

    var userLocation by remember { mutableStateOf<com.spiralworld.spiraldine.data.model.UserLocation?>(null) }

    // Privacy-first on-demand location launcher
    val locationPermissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fine = permissions[android.Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarse = permissions[android.Manifest.permission.ACCESS_COARSE_LOCATION] ?: false
        if (fine || coarse) {
            val loc = com.spiralworld.spiraldine.data.repository.LocationHelper.getLastKnownLocation(context)
            if (loc != null) {
                userLocation = loc
                showToast("Location updated")
            } else {
                showToast("Location enabled. Looking up nearby spots.")
            }
        } else {
            showToast("Location access declined. Browsing all restaurants.")
        }
    }

    val requestLocationAction: () -> Unit = {
        if (com.spiralworld.spiraldine.data.repository.LocationHelper.hasLocationPermission(context)) {
            val loc = com.spiralworld.spiraldine.data.repository.LocationHelper.getLastKnownLocation(context)
            if (loc != null) {
                userLocation = loc
                showToast("Location refreshed")
            } else {
                showToast("Waiting for GPS coordinates...")
            }
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    android.Manifest.permission.ACCESS_FINE_LOCATION,
                    android.Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    var currentTab by remember { mutableStateOf(NavDestination.HOME) }
    var activeRestaurant by remember { mutableStateOf<Restaurant?>(null) }
    var isViewingCart by remember { mutableStateOf(false) }
    var selectedOrderForTracking by remember { mutableStateOf<OrderRecord?>(null) }
    var exploreInitialCuisine by remember { mutableStateOf<String?>(null) }
    var isPlacingOrder by remember { mutableStateOf(false) }
    var isServiceAssistanceOpen by remember { mutableStateOf(false) }
    var pendingOnlinePaymentOrder by remember { mutableStateOf<OrderRecord?>(null) }
    var isBookingScreenOpen by remember { mutableStateOf(false) }
    var bookingPreselectedRestaurant by remember { mutableStateOf<Restaurant?>(null) }
    var pendingDineInRestaurant by remember { mutableStateOf<Restaurant?>(null) }

    // Dedicated feature modal states
    var showSplashScreen by remember { mutableStateOf(true) }
    var isFavouritesOpen by remember { mutableStateOf(false) }
    var isNotificationsOpen by remember { mutableStateOf(false) }
    var isLocationSelectorOpen by remember { mutableStateOf(false) }
    var selectedOrderForReceipt by remember { mutableStateOf<OrderRecord?>(null) }

    // Restore customer location from persistence on startup
    LaunchedEffect(Unit) {
        if (userLocation == null) {
            val persisted = com.spiralworld.spiraldine.data.repository.LocationHelper.getPersistedUserLocation(context)
            if (persisted != null) {
                userLocation = persisted
            }
        }
    }

    // Customer-isolated favourites & notifications streams
    val customerId = user?.uid ?: ""
    val favouriteRestaurantIds by favouritesRepository.getFavoriteRestaurantIds(customerId).collectAsState(initial = emptySet())
    val unreadNotificationCount by customerNotificationRepository.getUnreadCount(customerId).collectAsState(initial = 0)
    val customerNotifications by customerNotificationRepository.getNotifications(customerId).collectAsState(initial = emptyList())

    val toggleFavourite: (Restaurant) -> Unit = { r ->
        coroutineScope.launch {
            val cid = user?.uid ?: ""
            if (cid.isNotBlank()) {
                val isFav = favouriteRestaurantIds.contains(r.id)
                if (isFav) {
                    favouritesRepository.removeFavorite(cid, r.id)
                    showToast("Removed ${r.name} from Favourites")
                } else {
                    favouritesRepository.addFavorite(cid, r.id, r.name)
                    showToast("Saved ${r.name} to Favourites")
                }
            } else {
                showToast("Please sign in to save favourites")
            }
        }
    }

    fun openRestaurantDineIn(r: Restaurant) {
        val hasValidSession = diningSessionRepository.isSessionValidForRestaurant(r.id) &&
                !diningSession?.tableNumber.isNullOrBlank()
        if (hasValidSession) {
            activeRestaurant = r
        } else {
            pendingDineInRestaurant = r
        }
    }

    // Ensure diner identity exists
    LaunchedEffect(Unit) {
        if (user == null) {
            authRepository.signInAnonymously()
        }
    }

    // Register / Sync FCM push notification token
    LaunchedEffect(user, diningSession) {
        fcmTokenManager.fetchAndRegisterToken(
            userId = user?.uid,
            tenantId = diningSession?.tenantId,
            sessionId = diningSession?.sessionId
        )
    }

    // Foreground push notifications listener
    LaunchedEffect(Unit) {
        com.spiralworld.spiraldine.data.repository.FcmNotificationBus.notifications.collect { payload ->
            showToast("${payload.title}: ${payload.body}")
            if (payload.orderId.isNotBlank()) {
                currentTab = NavDestination.ORDERS
            }
        }
    }

    // Handle push notification tap intent
    LaunchedEffect(notificationOrderId) {
        if (!notificationOrderId.isNullOrBlank()) {
            currentTab = NavDestination.ORDERS
        }
    }

    // Process deep link on launch if present
    LaunchedEffect(initialDeepLink, restaurants) {
        if (initialDeepLink != null) {
            val fetched = restaurantRepository.fetchRestaurant(initialDeepLink.tenantId)
            val rest = fetched ?: restaurants.find { it.id == initialDeepLink.tenantId }
                ?: Restaurant(
                    id = initialDeepLink.tenantId,
                    name = "SpiralDine Restaurant",
                    description = "Dine-in menu",
                    locality = "Table #${initialDeepLink.tableNumber}"
                )
            val validation = diningSessionRepository.validateAndStartSession(
                tenantId = initialDeepLink.tenantId,
                tableNumber = initialDeepLink.tableNumber,
                customerId = user?.uid ?: "",
                knownRestaurantName = rest.name
            )
            if (validation.isSuccess) {
                if (cartRepository.hasCrossTenantItems(initialDeepLink.tenantId)) {
                    cartRepository.clearCart()
                }
                activeRestaurant = rest
                showToast("Welcome to Table #${initialDeepLink.tableNumber} at ${rest.name}")
            } else {
                showToast("Table validation: ${validation.exceptionOrNull()?.message}")
            }
        }
    }

    // Load active restaurant menu items, categories, and promotions
    val targetTenantId = activeRestaurant?.id ?: diningSession?.tenantId ?: ""
    val menuCategories by menuRepository.getCategories(targetTenantId).collectAsState(initial = emptyList())
    val menuItems by menuRepository.getMenuItems(targetTenantId).collectAsState(initial = emptyList())
    val promotions by menuRepository.getPromotions(targetTenantId).collectAsState(initial = emptyList())

    var isMenuLoading by remember(targetTenantId) { mutableStateOf(targetTenantId.isNotBlank()) }
    LaunchedEffect(menuItems, targetTenantId) {
        if (menuItems.isNotEmpty()) {
            isMenuLoading = false
        }
    }
    LaunchedEffect(targetTenantId) {
        if (targetTenantId.isNotBlank()) {
            kotlinx.coroutines.delay(5000)
            isMenuLoading = false
        }
    }

    val userProfile by authRepository.getCustomerProfile(user?.uid ?: "").collectAsState(initial = null)

    val tenantIds = remember(restaurants, targetTenantId) {
        val list = restaurants.map { it.id }.filter { it.isNotBlank() }.toMutableList()
        if (targetTenantId.isNotBlank() && !list.contains(targetTenantId)) {
            list.add(targetTenantId)
        }
        list
    }

    val orderHistoryState by orderRepository.getCustomerOrdersAcrossTenants(
        tenantIds = tenantIds,
        customerId = user?.uid ?: ""
    ).collectAsState(initial = OrderHistoryState.Loading)

    // Enforce data isolation across account switches
    LaunchedEffect(user?.uid) {
        selectedOrderForTracking = null
        isFavouritesOpen = false
        isNotificationsOpen = false
    }

    val appliedPromotion by cartRepository.appliedPromotion.collectAsState()
    val cartPricing = remember(cartItems, appliedPromotion) { cartRepository.getPricing() }

    Box(modifier = Modifier.fillMaxSize().background(WarmBackground)) {
        if (showSplashScreen) {
            SplashScreen(onSplashFinished = { showSplashScreen = false })
        } else {
            Scaffold(
                bottomBar = {
                // Persistent native bottom navigation bar
                SpiralDineBottomNavBar(
                    currentDestination = currentTab,
                    onNavigate = { destination ->
                        // Switch tab and close sub-overlays for clean native navigation
                        currentTab = destination
                        isViewingCart = false
                        selectedOrderForTracking = null
                        isBookingScreenOpen = false
                        bookingPreselectedRestaurant = null
                        isFavouritesOpen = false
                        isNotificationsOpen = false
                        isLocationSelectorOpen = false
                        if (destination != NavDestination.HOME && destination != NavDestination.EXPLORE) {
                            activeRestaurant = null
                        }
                    }
                )
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                // 1. Primary Tab Content
                when (currentTab) {
                    NavDestination.HOME -> {
                        HomeScreen(
                            restaurants = restaurants,
                            promotions = promotions,
                            diningSession = diningSession,
                            popularDishes = popularDishes,
                            isLoading = isRestaurantsLoading,
                            onRestaurantClick = { r -> openRestaurantDineIn(r) },
                            onSearchClick = { currentTab = NavDestination.EXPLORE },
                            onQrClick = { currentTab = NavDestination.QR_SCAN },
                            onOrdersClick = { currentTab = NavDestination.ORDERS },
                            onBookTableClick = {
                                bookingPreselectedRestaurant = null
                                isBookingScreenOpen = true
                            },
                            onDishClick = { _, r -> openRestaurantDineIn(r) },
                            onApplyCoupon = { promo ->
                                val res = cartRepository.applyCoupon(promo)
                                if (res.isSuccess) {
                                    showToast("Coupon ${promo.effectiveCode} applied!")
                                } else {
                                    showToast(res.exceptionOrNull()?.message ?: "Coupon not applicable")
                                }
                            },
                            onCuisineClick = { c ->
                                exploreInitialCuisine = c
                                currentTab = NavDestination.EXPLORE
                            },
                            userLocation = userLocation,
                            onRequestLocation = requestLocationAction,
                            onLocationClick = { isLocationSelectorOpen = true },
                            onNotificationClick = { isNotificationsOpen = true },
                            unreadNotificationCount = unreadNotificationCount,
                            onFavoritesClick = { isFavouritesOpen = true },
                            favouriteRestaurantIds = favouriteRestaurantIds,
                            onToggleFavourite = toggleFavourite,
                            onLeaveTable = { session ->
                                coroutineScope.launch {
                                    val res = diningSessionRepository.leaveTable(
                                        tenantId = session.tenantId,
                                        tableNumber = session.tableNumber,
                                        sessionId = session.sessionId
                                    )
                                    if (res.isSuccess) {
                                        cartRepository.clearCart()
                                        activeRestaurant = null
                                        showToast("Left Table #${session.tableNumber}. Thank you for dining!")
                                    } else {
                                        showToast(res.exceptionOrNull()?.message ?: "Could not leave table.")
                                    }
                                }
                            },
                            user = user,
                            userProfile = userProfile,
                            onProfileClick = { currentTab = NavDestination.PROFILE }
                        )
                    }

                    NavDestination.EXPLORE -> {
                        ExploreScreen(
                            restaurants = restaurants,
                            onRestaurantClick = { r -> openRestaurantDineIn(r) },
                            initialCuisine = exploreInitialCuisine,
                            userLocation = userLocation,
                            onRequestLocation = requestLocationAction
                        )
                    }

                    NavDestination.QR_SCAN -> {
                        QrScannerScreen(
                            onTableScanned = { tenantId, tableNumber ->
                                coroutineScope.launch {
                                    val fetched = restaurantRepository.fetchRestaurant(tenantId)
                                    val r = fetched ?: restaurants.find { it.id == tenantId }
                                        ?: Restaurant(
                                            id = tenantId,
                                            name = "SpiralDine Restaurant",
                                            locality = "Table #$tableNumber"
                                        )
                                    val validation = diningSessionRepository.validateAndStartSession(
                                        tenantId = tenantId,
                                        tableNumber = tableNumber,
                                        customerId = user?.uid ?: "",
                                        knownRestaurantName = r.name
                                    )
                                    if (validation.isSuccess) {
                                        if (cartRepository.hasCrossTenantItems(tenantId)) {
                                            cartRepository.clearCart()
                                            showToast("Switched dining table. Cart cleared.")
                                        }
                                        activeRestaurant = r
                                        currentTab = NavDestination.HOME
                                        showToast("Checked in to Table #$tableNumber at ${r.name}")
                                    } else {
                                        showToast("Table check-in failed: ${validation.exceptionOrNull()?.message}")
                                    }
                                }
                            },
                            onClose = { currentTab = NavDestination.HOME }
                        )
                    }

                    NavDestination.ORDERS -> {
                        OrdersScreen(
                            orderHistoryState = orderHistoryState,
                            selectedOrder = selectedOrderForTracking,
                            onSelectOrder = { selectedOrderForTracking = it },
                            onOpenServiceAssistance = { isServiceAssistanceOpen = true },
                            onPayOnline = { order -> pendingOnlinePaymentOrder = order },
                            isGuest = user?.isAnonymous == true,
                            onLinkAccountClick = { currentTab = NavDestination.PROFILE },
                            orderRepository = orderRepository,
                            reviewRepository = reviewRepository,
                            user = user,
                            diningSession = diningSession,
                            onViewReceipt = { order -> selectedOrderForReceipt = order }
                        )
                    }

                    NavDestination.PROFILE -> {
                        ProfileScreen(
                            user = user,
                            profile = userProfile,
                            diningSession = diningSession,
                            reservationRepository = reservationRepository,
                            favouritesRepository = favouritesRepository,
                            reviewRepository = reviewRepository,
                            supportTicketRepository = supportTicketRepository,
                            orders = (orderHistoryState as? OrderHistoryState.Success)?.orders ?: emptyList(),
                            allRestaurants = restaurants,
                            onSignIn = { email, pass ->
                                coroutineScope.launch {
                                    val res = authRepository.signInWithEmail(email, pass)
                                    if (res.isSuccess) {
                                        showToast("Signed in as ${res.getOrNull()?.email}")
                                    } else {
                                        showToast("Sign in failed: ${res.exceptionOrNull()?.message}")
                                    }
                                }
                            },
                            onRegister = { email, pass, name ->
                                coroutineScope.launch {
                                    val res = authRepository.registerWithEmail(email, pass, name)
                                    if (res.isSuccess) {
                                        showToast("Account created successfully!")
                                    } else {
                                        showToast("Registration failed: ${res.exceptionOrNull()?.message}")
                                    }
                                }
                            },
                            onLinkAccount = { email, pass, name ->
                                coroutineScope.launch {
                                    val res = authRepository.linkAnonymousAccountWithEmail(email, pass, name)
                                    if (res.isSuccess) {
                                        showToast("Account successfully linked! Order history preserved.")
                                    } else {
                                        showToast("Linking failed: ${res.exceptionOrNull()?.message}")
                                    }
                                }
                            },
                            onUpdateProfile = { name, phone ->
                                coroutineScope.launch {
                                    val res = authRepository.updateCustomerProfile(name, phone)
                                    if (res.isSuccess) {
                                        showToast("Profile updated successfully!")
                                    } else {
                                        showToast("Update failed: ${res.exceptionOrNull()?.message}")
                                    }
                                }
                            },
                            onUpdateDiningPrefs = { dietary, allergens, cuisines, method, isVeg ->
                                coroutineScope.launch {
                                    val res = authRepository.updateDiningPreferences(dietary, allergens, cuisines, method, isVeg)
                                    if (res.isSuccess) {
                                        showToast("Dining preferences saved!")
                                    } else {
                                        showToast("Failed to save dining preferences: ${res.exceptionOrNull()?.message}")
                                    }
                                }
                            },
                            onUpdateNotifPrefs = { prefs ->
                                coroutineScope.launch {
                                    authRepository.updateNotificationPreferences(prefs)
                                }
                            },
                            onUpdateAppPrefs = { theme, lang, size ->
                                coroutineScope.launch {
                                    val res = authRepository.updateAppPreferences(theme, lang, size)
                                    if (res.isSuccess) {
                                        showToast("App preferences updated!")
                                    }
                                }
                            },
                            onSendPasswordReset = { email ->
                                coroutineScope.launch {
                                    val res = authRepository.sendPasswordResetEmail(email)
                                    if (res.isSuccess) {
                                        showToast("Password reset email sent to $email")
                                    } else {
                                        showToast("Reset failed: ${res.exceptionOrNull()?.message}")
                                    }
                                }
                            },
                            onDeleteAccount = {
                                coroutineScope.launch {
                                    val res = authRepository.deleteAccount()
                                    if (res.isSuccess) {
                                        showToast("Account deleted successfully.")
                                        selectedOrderForTracking = null
                                        cartRepository.clearCart()
                                        authRepository.signInAnonymously()
                                    } else {
                                        showToast("Account deletion failed: ${res.exceptionOrNull()?.message}")
                                    }
                                }
                            },
                            onSignOut = {
                                coroutineScope.launch {
                                    authRepository.signOut()
                                    selectedOrderForTracking = null
                                    cartRepository.clearCart()
                                    authRepository.signInAnonymously()
                                    showToast("Signed out. Guest session active.")
                                }
                            },
                            onClearTableSession = {
                                diningSessionRepository.clearSession()
                                cartRepository.clearCart()
                                activeRestaurant = null
                                showToast("Table dining session ended.")
                            },
                            onViewOrders = { currentTab = NavDestination.ORDERS },
                            onOpenReceipt = { order -> selectedOrderForReceipt = order },
                            onExploreRestaurants = { currentTab = NavDestination.EXPLORE },
                            onSelectRestaurant = { rest -> activeRestaurant = rest }
                        )
                    }
                }

                // 2. Sub-Screen Overlay: Restaurant Details & Menu
                if (activeRestaurant != null && !isViewingCart) {
                    val r = activeRestaurant!!
                    RestaurantMenuScreen(
                        restaurant = r,
                        categories = menuCategories,
                        menuItems = menuItems,
                        promotions = promotions,
                        cartItems = cartItems,
                        tableNumber = diningSession?.tableNumber,
                        isLoadingMenu = isMenuLoading,
                        onBack = { activeRestaurant = null },
                        onAddItem = { dish ->
                            cartRepository.addItem(dish, tenantId = r.id)
                        },
                        onRemoveItem = { dish ->
                            val last = cartItems.findLast { it.item.id == dish.id }
                            if (last != null) {
                                cartRepository.updateCount(last.lineId, last.count - 1)
                            }
                        },
                        onAddConfiguredItem = { dish, variant, addons, notes, qty ->
                            cartRepository.addItem(
                                item = dish,
                                tenantId = r.id,
                                count = qty,
                                variant = variant,
                                addons = addons,
                                notes = notes
                            )
                        },
                        onClearAndAddConfiguredItem = { dish, variant, addons, notes, qty ->
                            cartRepository.clearAndAddItem(
                                item = dish,
                                tenantId = r.id,
                                count = qty,
                                variant = variant,
                                addons = addons,
                                notes = notes
                            )
                        },
                        onViewCart = { isViewingCart = true },
                        onApplyPromotion = { promo ->
                            val res = cartRepository.applyCoupon(promo)
                            if (res.isSuccess) {
                                showToast("Coupon ${promo.effectiveCode} applied!")
                            } else {
                                showToast(res.exceptionOrNull()?.message ?: "Coupon not applicable")
                            }
                        },
                        reviewRepository = reviewRepository,
                        onBookTable = {
                            bookingPreselectedRestaurant = r
                            isBookingScreenOpen = true
                        },
                        onSelectTable = {
                            pendingDineInRestaurant = r
                        }
                    )
                }

                // 3. Sub-Screen Overlay: Cart & Checkout
                if (isViewingCart) {
                    val rName = activeRestaurant?.name ?: diningSession?.restaurantName ?: "SpiralDine Restaurant"
                    val tNum = diningSession?.tableNumber ?: "1"
                    val effectiveTenant = activeRestaurant?.id ?: diningSession?.tenantId ?: (restaurants.firstOrNull()?.id ?: "")

                    CartScreen(
                        restaurantName = rName,
                        tableNumber = tNum,
                        cartItems = cartItems,
                        pricing = cartPricing,
                        availablePromotions = promotions,
                        appliedPromotion = appliedPromotion,
                        isPlacingOrder = isPlacingOrder,
                        onBack = { isViewingCart = false },
                        onUpdateCount = { lineId, cnt -> cartRepository.updateCount(lineId, cnt) },
                        onRemoveItem = { lineId -> cartRepository.removeItem(lineId) },
                        onClearCart = {
                            cartRepository.clearCart()
                            showToast("Cart basket cleared.")
                        },
                        onApplyCoupon = { code ->
                            val promo = promotions.find { it.effectiveCode.equals(code, ignoreCase = true) }
                            if (promo != null) {
                                val res = cartRepository.applyCoupon(promo)
                                if (res.isSuccess) {
                                    showToast("Coupon ${promo.effectiveCode} applied! Savings: ₹${res.getOrNull()?.toInt()}")
                                } else {
                                    showToast(res.exceptionOrNull()?.message ?: "Coupon not applicable")
                                }
                            } else {
                                showToast("Coupon code '$code' not found or invalid.")
                            }
                        },
                        onRemoveCoupon = {
                            cartRepository.removeCoupon()
                            showToast("Coupon removed.")
                        },
                        onPlaceOrder = { notes ->
                            coroutineScope.launch {
                                isPlacingOrder = true
                                val session = diningSession ?: diningSessionRepository.startSession(
                                    tenantId = effectiveTenant,
                                    restaurantName = rName,
                                    tableNumber = tNum,
                                    customerId = user?.uid ?: ""
                                )

                                if (diningSessionRepository.isSessionExpired(session)) {
                                    isPlacingOrder = false
                                    showToast("Dining session expired. Please rescan your table QR code.")
                                    return@launch
                                }

                                val res = orderRepository.placeOrder(
                                    tenantId = effectiveTenant,
                                    tableNumber = session.tableNumber,
                                    tableId = session.tableId,
                                    sessionId = session.sessionId,
                                    customerId = user?.uid ?: "guest-diner",
                                    customerName = user?.displayName ?: "Table Diner",
                                    phone = "+91 98765 43210",
                                    cartItems = cartItems,
                                    pricing = cartPricing,
                                    couponCode = appliedPromotion?.effectiveCode,
                                    specialInstructions = notes
                                )

                                isPlacingOrder = false
                                if (res.isSuccess) {
                                    val order = res.getOrThrow()
                                    cartRepository.clearCart()
                                    isViewingCart = false
                                    activeRestaurant = null
                                    selectedOrderForTracking = order
                                    currentTab = NavDestination.ORDERS
                                    showToast("Order #${order.orderId} placed successfully!")
                                } else {
                                    showToast("Order placement failed: ${res.exceptionOrNull()?.message}")
                                }
                            }
                        }
                    )
                }

                // 4. Sub-Screen Overlay: Dedicated Table Booking Flow
                if (isBookingScreenOpen) {
                    com.spiralworld.spiraldine.ui.screens.BookingScreen(
                        restaurants = restaurants,
                        preselectedRestaurant = bookingPreselectedRestaurant,
                        currentUser = user,
                        reservationRepository = reservationRepository,
                        onBack = {
                            isBookingScreenOpen = false
                            bookingPreselectedRestaurant = null
                        },
                        onViewMenu = { r: Restaurant ->
                            isBookingScreenOpen = false
                            bookingPreselectedRestaurant = null
                            activeRestaurant = r
                        },
                        onToast = showToast
                    )
                }

                // 5. Dedicated Sub-Screen Overlay: Favourites
                if (isFavouritesOpen) {
                    com.spiralworld.spiraldine.ui.screens.FavouritesScreen(
                        restaurants = restaurants,
                        favouriteRestaurantIds = favouriteRestaurantIds,
                        onRestaurantClick = { r ->
                            isFavouritesOpen = false
                            openRestaurantDineIn(r)
                        },
                        onRemoveFavourite = { r ->
                            toggleFavourite(r)
                        },
                        onExploreClick = {
                            isFavouritesOpen = false
                            currentTab = NavDestination.EXPLORE
                        },
                        onBack = { isFavouritesOpen = false }
                    )
                }

                // 6. Dedicated Sub-Screen Overlay: Notifications
                if (isNotificationsOpen) {
                    com.spiralworld.spiraldine.ui.screens.NotificationsScreen(
                        notifications = customerNotifications,
                        onNotificationClick = { notification ->
                            coroutineScope.launch {
                                val cid = user?.uid ?: ""
                                if (cid.isNotBlank()) {
                                    customerNotificationRepository.markAsRead(cid, notification.id)
                                }
                            }
                            if (notification.orderId.isNotBlank()) {
                                isNotificationsOpen = false
                                val matched = (orderHistoryState as? OrderHistoryState.Success)?.orders?.find { it.orderId == notification.orderId }
                                if (matched != null) {
                                    selectedOrderForTracking = matched
                                }
                                currentTab = NavDestination.ORDERS
                            } else if (notification.bookingId.isNotBlank()) {
                                isNotificationsOpen = false
                                isBookingScreenOpen = true
                            }
                        },
                        onMarkAllAsRead = {
                            coroutineScope.launch {
                                val cid = user?.uid ?: ""
                                if (cid.isNotBlank()) {
                                    customerNotificationRepository.markAllAsRead(cid)
                                    showToast("All notifications marked as read")
                                }
                            }
                        },
                        onBack = { isNotificationsOpen = false }
                    )
                }

                // 7. Dedicated Sub-Screen Overlay: Location Selector
                if (isLocationSelectorOpen) {
                    com.spiralworld.spiraldine.ui.components.LocationSelectionModal(
                        isOpen = true,
                        currentLocation = userLocation,
                        onDismiss = { isLocationSelectorOpen = false },
                        onLocationSelected = { loc ->
                            userLocation = loc
                            isLocationSelectorOpen = false
                            com.spiralworld.spiraldine.data.repository.LocationHelper.persistUserLocation(context, loc)
                            showToast("Location updated to ${loc.localityName ?: "selected locality"}")
                        },
                        onRequestGps = {
                            isLocationSelectorOpen = false
                            requestLocationAction()
                        }
                    )
                }

                // 8. Dedicated Sub-Screen Overlay: Official Order Receipt Screen
                if (selectedOrderForReceipt != null) {
                    val r = restaurants.find { it.id == selectedOrderForReceipt!!.tenantId }
                    com.spiralworld.spiraldine.ui.screens.ReceiptScreen(
                        order = selectedOrderForReceipt!!,
                        restaurant = r,
                        onBack = { selectedOrderForReceipt = null },
                        onOrderAgain = { tid ->
                            selectedOrderForReceipt = null
                            val targetRest = restaurants.find { it.id == tid }
                            if (targetRest != null) {
                                openRestaurantDineIn(targetRest)
                            }
                        }
                    )
                }
            }
        }

        // Native Android back press handling (Standardized Back Navigation Architecture)
        if (selectedOrderForReceipt != null) {
            androidx.activity.compose.BackHandler {
                selectedOrderForReceipt = null
            }
        } else if (pendingOnlinePaymentOrder != null) {
            androidx.activity.compose.BackHandler {
                pendingOnlinePaymentOrder = null
            }
        } else if (isServiceAssistanceOpen) {
            androidx.activity.compose.BackHandler {
                isServiceAssistanceOpen = false
            }
        } else if (pendingDineInRestaurant != null) {
            androidx.activity.compose.BackHandler {
                pendingDineInRestaurant = null
            }
        } else if (isFavouritesOpen) {
            androidx.activity.compose.BackHandler {
                isFavouritesOpen = false
            }
        } else if (isNotificationsOpen) {
            androidx.activity.compose.BackHandler {
                isNotificationsOpen = false
            }
        } else if (isLocationSelectorOpen) {
            androidx.activity.compose.BackHandler {
                isLocationSelectorOpen = false
            }
        } else if (isBookingScreenOpen) {
            androidx.activity.compose.BackHandler {
                isBookingScreenOpen = false
                bookingPreselectedRestaurant = null
            }
        } else if (isViewingCart) {
            androidx.activity.compose.BackHandler {
                isViewingCart = false
            }
        } else if (activeRestaurant != null) {
            androidx.activity.compose.BackHandler {
                activeRestaurant = null
            }
        } else if (selectedOrderForTracking != null) {
            androidx.activity.compose.BackHandler {
                selectedOrderForTracking = null
            }
        } else if (currentTab != NavDestination.HOME) {
            // Feature Five: Standardize Android Back Navigation
            // Pressing system Back from Explore, Orders, Profile, or Scan QR returns to Home
            androidx.activity.compose.BackHandler {
                currentTab = NavDestination.HOME
            }
        }
        // When on Home with no modals open: NO BackHandler is active, allowing standard Android root-back behavior (minimize/exit)

        // Dine-In Table Selection Modal
        if (pendingDineInRestaurant != null) {
            val targetRest = pendingDineInRestaurant!!
            com.spiralworld.spiraldine.ui.components.TableSelectionModal(
                isOpen = true,
                restaurant = targetRest,
                currentTableNumber = if (diningSession?.tenantId == targetRest.id) diningSession?.tableNumber else null,
                onDismiss = { pendingDineInRestaurant = null },
                reservationRepository = reservationRepository,
                onTableSelected = { selectedTable ->
                    pendingDineInRestaurant = null
                    coroutineScope.launch {
                        val validation = diningSessionRepository.validateAndStartSession(
                            tenantId = targetRest.id,
                            tableNumber = selectedTable.tableNumber,
                            customerId = user?.uid ?: "",
                            knownRestaurantName = targetRest.name
                        )
                        if (validation.isSuccess) {
                            if (cartRepository.hasCrossTenantItems(targetRest.id)) {
                                cartRepository.clearCart()
                            }
                            activeRestaurant = targetRest
                            showToast("Welcome to ${selectedTable.displayLabel} at ${targetRest.name}")
                        } else {
                            showToast("Table validation: ${validation.exceptionOrNull()?.message}")
                        }
                    }
                }
            )
        }

        // Service Assistance Bottom Sheet
        if (isServiceAssistanceOpen) {
            com.spiralworld.spiraldine.ui.components.ServiceAssistanceBottomSheet(
                session = diningSession,
                assistanceRepository = serviceAssistanceRepository,
                userId = user?.uid ?: "guest",
                onDismiss = { isServiceAssistanceOpen = false }
            )
        }

        // Online Payment Checkout Modal
        if (pendingOnlinePaymentOrder != null) {
            val order = pendingOnlinePaymentOrder!!
            com.spiralworld.spiraldine.ui.components.PaymentCheckoutModal(
                tenantId = order.tenantId,
                orderId = order.orderId,
                billId = "BILL-${order.orderId}",
                amountInRupees = com.spiralworld.spiraldine.data.repository.CurrencyFormatter.paiseToRupees(order.total.toLong()),
                customer = user,
                paymentRepository = paymentRepository,
                onPaymentSuccess = { ref ->
                    coroutineScope.launch {
                        orderRepository.updatePaymentStatus(
                            tenantId = order.tenantId,
                            orderId = order.orderId,
                            paymentStatus = "paid",
                            paymentReference = ref
                        )
                        showToast("Payment verified! Order #${order.orderId} settled.")
                        pendingOnlinePaymentOrder = null
                    }
                },
                onDismiss = { pendingOnlinePaymentOrder = null }
            )
        }
        }
    }
}
