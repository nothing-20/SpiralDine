package com.spiralworld.spiraldine.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.Help
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.*
import com.spiralworld.spiraldine.data.repository.*
import com.spiralworld.spiraldine.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ProfileScreen(
    user: CustomerUser?,
    profile: CustomerProfile? = null,
    diningSession: DiningSession?,
    reservationRepository: ReservationRepository? = null,
    favouritesRepository: FavouritesRepository? = null,
    reviewRepository: ReviewRepository? = null,
    supportTicketRepository: SupportTicketRepository? = null,
    orders: List<OrderRecord> = emptyList(),
    allRestaurants: List<Restaurant> = emptyList(),
    onSignIn: (email: String, pass: String) -> Unit,
    onRegister: (email: String, pass: String, name: String) -> Unit,
    onLinkAccount: (email: String, pass: String, name: String) -> Unit = { _, _, _ -> },
    onUpdateProfile: (name: String, phone: String?) -> Unit = { _, _ -> },
    onUpdateDiningPrefs: (dietary: List<String>, allergens: List<String>, cuisines: List<String>, method: String, isVeg: Boolean) -> Unit = { _, _, _, _, _ -> },
    onUpdateNotifPrefs: (Map<String, Boolean>) -> Unit = {},
    onUpdateAppPrefs: (theme: String, lang: String, textSize: String) -> Unit = { _, _, _ -> },
    onSendPasswordReset: (email: String) -> Unit = {},
    onDeleteAccount: () -> Unit = {},
    onSignOut: () -> Unit,
    onClearTableSession: () -> Unit,
    onViewOrders: () -> Unit,
    onOpenReceipt: (OrderRecord) -> Unit = {},
    onExploreRestaurants: () -> Unit = {},
    onSelectRestaurant: (Restaurant) -> Unit = {}
) {
    var currentSubSection by remember { mutableStateOf<String?>(null) }

    var showAuthDialog by remember { mutableStateOf(false) }
    var isRegisterMode by remember { mutableStateOf(false) }
    var showLinkAccountDialog by remember { mutableStateOf(false) }
    var showEditProfileDialog by remember { mutableStateOf(false) }
    var showSignOutConfirmation by remember { mutableStateOf(false) }
    var showDeleteAccountDialog by remember { mutableStateOf(false) }
    var showPrivacyPolicyDialog by remember { mutableStateOf(false) }
    var showTermsDialog by remember { mutableStateOf(false) }
    var showRefundPolicyDialog by remember { mutableStateOf(false) }
    var showCookieConsentDialog by remember { mutableStateOf(false) }
    var showAccessibilityDialog by remember { mutableStateOf(false) }

    val isGuest = user == null || user.isAnonymous
    val effectiveUid = user?.uid ?: ""
    val effectiveName = profile?.displayName?.ifBlank { null }
        ?: user?.displayName?.ifBlank { null }
        ?: if (isGuest) "Guest Diner" else "Spiral Diner"

    val effectiveEmail = profile?.email?.ifBlank { null } ?: user?.email?.ifBlank { null }
    val effectivePhone = profile?.phoneNumber?.ifBlank { null } ?: user?.phoneNumber?.ifBlank { null }

    // Intercept back navigation when in sub-section
    BackHandler(enabled = currentSubSection != null) {
        currentSubSection = null
    }

    if (currentSubSection != null) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(WarmBackground)
        ) {
            // Top Navigation Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(SurfaceWhite)
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                IconButton(
                    onClick = { currentSubSection = null },
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back",
                        tint = TextPrimary
                    )
                }
                Text(
                    text = when (currentSubSection) {
                        "bookings" -> "My Table Bookings"
                        "favourites" -> "My Favourites"
                        "reviews" -> "My Reviews & Ratings"
                        "receipts" -> "My Receipts"
                        "settings" -> "Settings"
                        "dining_prefs" -> "Dining Preferences"
                        "support" -> "Help & Support"
                        else -> "Profile"
                    },
                    fontSize = 17.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = TextPrimary
                )
            }

            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(CardBorder))

            // Sub-section Content
            when (currentSubSection) {
                "bookings" -> BookingsSubView(
                    customerId = effectiveUid,
                    reservationRepository = reservationRepository,
                    onExplore = {
                        currentSubSection = null
                        onExploreRestaurants()
                    }
                )
                "favourites" -> FavouritesSubView(
                    customerId = effectiveUid,
                    favouritesRepository = favouritesRepository,
                    allRestaurants = allRestaurants,
                    onExplore = {
                        currentSubSection = null
                        onExploreRestaurants()
                    },
                    onSelect = onSelectRestaurant
                )
                "reviews" -> ReviewsSubView(
                    customerId = effectiveUid,
                    reviewRepository = reviewRepository
                )
                "receipts" -> ReceiptsSubView(
                    orders = orders,
                    allRestaurants = allRestaurants,
                    onOpenReceipt = onOpenReceipt
                )
                "settings" -> SettingsSubView(
                    profile = profile,
                    effectiveEmail = effectiveEmail,
                    onUpdateNotifPrefs = onUpdateNotifPrefs,
                    onUpdateAppPrefs = onUpdateAppPrefs,
                    onSendPasswordReset = onSendPasswordReset,
                    onShowPrivacy = { showPrivacyPolicyDialog = true },
                    onShowTerms = { showTermsDialog = true },
                    onShowRefund = { showRefundPolicyDialog = true },
                    onShowCookieConsent = { showCookieConsentDialog = true },
                    onShowAccessibility = { showAccessibilityDialog = true },
                    onShowDelete = { showDeleteAccountDialog = true }
                )
                "dining_prefs" -> DiningPreferencesSubView(
                    profile = profile,
                    onSave = onUpdateDiningPrefs
                )
                "support" -> HelpSupportSubView(
                    customerId = effectiveUid,
                    customerName = effectiveName,
                    customerEmail = effectiveEmail ?: "",
                    supportTicketRepository = supportTicketRepository
                )
            }
        }
    } else {
        // Main Profile Hub
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(WarmBackground),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // 1. User Header Profile Card
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, CardBorder, RoundedCornerShape(20.dp)),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(modifier = Modifier.padding(18.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            // Avatar initials or icon
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .clip(CircleShape)
                                    .background(SpiralDineOrangeLight),
                                contentAlignment = Alignment.Center
                            ) {
                                val initials = effectiveName.split(" ")
                                    .mapNotNull { it.firstOrNull()?.toString() }
                                    .take(2)
                                    .joinToString("")
                                    .uppercase()
                                if (initials.isNotBlank() && !isGuest) {
                                    Text(
                                        text = initials,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SpiralDineOrange
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.Person,
                                        contentDescription = "Avatar",
                                        tint = SpiralDineOrange,
                                        modifier = Modifier.size(28.dp)
                                    )
                                }
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = effectiveName,
                                        fontSize = 17.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = TextPrimary
                                    )
                                    if (!isGuest) {
                                        Icon(
                                            imageVector = Icons.Default.Verified,
                                            contentDescription = "Verified Account",
                                            tint = SuccessGreen,
                                            modifier = Modifier.size(16.dp)
                                        )
                                    }
                                }

                                Text(
                                    text = effectiveEmail ?: "Dine-in Guest Session",
                                    fontSize = 12.sp,
                                    color = TextSecondary
                                )

                                if (!effectivePhone.isNullOrBlank()) {
                                    Text(
                                        text = effectivePhone,
                                        fontSize = 11.sp,
                                        color = TextSecondary
                                    )
                                }
                            }

                            if (!isGuest) {
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(SurfaceMuted)
                                        .clickable { showEditProfileDialog = true },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Edit,
                                        contentDescription = "Edit Profile",
                                        tint = TextPrimary,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Status Badge
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(
                                    if (isGuest) StarGold.copy(alpha = 0.12f) else SuccessGreenBg,
                                    RoundedCornerShape(10.dp)
                                )
                                .padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = if (isGuest) "Temporary Guest Account" else "Verified Customer Account",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isGuest) TextPrimary else SuccessGreen
                            )

                            if (isGuest) {
                                Text(
                                    text = "Link Account",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = SpiralDineOrange,
                                    modifier = Modifier.clickable { showLinkAccountDialog = true }
                                )
                            } else {
                                Text(
                                    text = "UID: ${user?.uid?.take(8)}...",
                                    fontSize = 10.sp,
                                    color = TextSecondary
                                )
                            }
                        }
                    }
                }
            }

            // 2. Guest Linking Promo Card (if guest)
            if (isGuest) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, SpiralDineOrange.copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                    ) {
                        Row(
                            modifier = Modifier.padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(SpiralDineOrangeLight, CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Link, contentDescription = null, tint = SpiralDineOrange)
                            }

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Save Your Dining History",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "Link an email to keep your orders and receipts across visits without losing current table orders.",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                            }

                            Button(
                                onClick = { showLinkAccountDialog = true },
                                colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                                shape = RoundedCornerShape(10.dp),
                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text("Link", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // 3. Active Dining Session Card (if seated at a table)
            if (diningSession != null) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, SuccessGreen.copy(alpha = 0.4f), RoundedCornerShape(16.dp)),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = SuccessGreenBg)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.TableBar,
                                        contentDescription = null,
                                        tint = SuccessGreen,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Text(
                                        text = "Active Table: #${diningSession.tableNumber}",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = SuccessGreen
                                    )
                                }

                                Text(
                                    text = "Leave Table",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = NonVegRed,
                                    modifier = Modifier.clickable { onClearTableSession() }
                                )
                            }

                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Restaurant: ${diningSession.restaurantName}",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }
                    }
                }
            }

            // 4. MY ACTIVITY SECTION
            item {
                Text(
                    text = "My Activity",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    modifier = Modifier.padding(start = 4.dp, top = 4.dp, bottom = 2.dp)
                )
            }

            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column {
                        // My Orders
                        ProfileNavigationRow(
                            icon = Icons.AutoMirrored.Filled.ReceiptLong,
                            iconTint = SpiralDineOrange,
                            title = "My Orders",
                            subtitle = "View active and past dining orders",
                            onClick = onViewOrders
                        )

                        DividerLine()

                        // My Table Bookings
                        ProfileNavigationRow(
                            icon = Icons.Default.CalendarToday,
                            iconTint = Color(0xFF2E7D32),
                            title = "My Table Bookings",
                            subtitle = "Upcoming, confirmed & past reservations",
                            onClick = { currentSubSection = "bookings" }
                        )

                        DividerLine()

                        // My Favourites
                        ProfileNavigationRow(
                            icon = Icons.Default.Favorite,
                            iconTint = Color(0xFFE91E63),
                            title = "My Favourites",
                            subtitle = "Saved dining spots & quick access",
                            onClick = { currentSubSection = "favourites" }
                        )

                        DividerLine()

                        // My Reviews & Ratings
                        ProfileNavigationRow(
                            icon = Icons.Default.Star,
                            iconTint = StarGold,
                            title = "My Reviews & Ratings",
                            subtitle = "Your feedback and satisfaction ratings",
                            onClick = { currentSubSection = "reviews" }
                        )

                        DividerLine()

                        // My Receipts
                        ProfileNavigationRow(
                            icon = Icons.Default.Receipt,
                            iconTint = Color(0xFF1976D2),
                            title = "My Receipts",
                            subtitle = "Verified tax invoices & payment summaries",
                            onClick = { currentSubSection = "receipts" }
                        )
                    }
                }
            }

            // 5. PREFERENCES & SETTINGS SECTION
            item {
                Text(
                    text = "Preferences & System",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    modifier = Modifier.padding(start = 4.dp, top = 4.dp, bottom = 2.dp)
                )
            }

            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column {
                        // Dining Preferences
                        ProfileNavigationRow(
                            icon = Icons.Default.RestaurantMenu,
                            iconTint = Color(0xFF8D6E63),
                            title = "Dining Preferences",
                            subtitle = "Cuisines, pure veg, allergies & dietary habits",
                            onClick = { currentSubSection = "dining_prefs" }
                        )

                        DividerLine()

                        // Settings System
                        ProfileNavigationRow(
                            icon = Icons.Default.Settings,
                            iconTint = Color(0xFF546E7A),
                            title = "Settings",
                            subtitle = "Theme, language, notifications & privacy",
                            onClick = { currentSubSection = "settings" }
                        )
                    }
                }
            }

            // 6. HELP & SUPPORT SECTION
            item {
                Text(
                    text = "Help & Support",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    modifier = Modifier.padding(start = 4.dp, top = 4.dp, bottom = 2.dp)
                )
            }

            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column {
                        ProfileNavigationRow(
                            icon = Icons.AutoMirrored.Filled.Help,
                            iconTint = Color(0xFF00897B),
                            title = "Help Centre & Support",
                            subtitle = "FAQs, report issues & view active tickets",
                            onClick = { currentSubSection = "support" }
                        )

                        DividerLine()

                        // App Information
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Icon(Icons.Default.Info, contentDescription = null, tint = TextSecondary)
                            Column {
                                Text("Spiral Dine Mobile App", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Text("Version 1.0 (Native Customer App)", fontSize = 11.sp, color = TextSecondary)
                            }
                        }
                    }
                }
            }

            // 7. Authentication Action Buttons
            item {
                Spacer(modifier = Modifier.height(4.dp))
                if (isGuest) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                isRegisterMode = false
                                showAuthDialog = true
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.weight(1f).height(48.dp)
                        ) {
                            Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Sign In", fontWeight = FontWeight.Bold)
                        }

                        OutlinedButton(
                            onClick = {
                                isRegisterMode = true
                                showAuthDialog = true
                            },
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.weight(1f).height(48.dp)
                        ) {
                            Text("Register", fontWeight = FontWeight.Bold, color = TextPrimary)
                        }
                    }
                } else {
                    Button(
                        onClick = { showSignOutConfirmation = true },
                        colors = ButtonDefaults.buttonColors(containerColor = SurfaceWhite),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .border(1.dp, CardBorder, RoundedCornerShape(14.dp))
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ExitToApp,
                            contentDescription = null,
                            tint = NonVegRed,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Sign Out", color = NonVegRed, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // --- DIALOGS ---

    // Sign Out Confirmation Alert
    if (showSignOutConfirmation) {
        AlertDialog(
            onDismissRequest = { showSignOutConfirmation = false },
            title = { Text("Sign Out?", fontWeight = FontWeight.Bold, color = TextPrimary) },
            text = {
                Text(
                    text = "Are you sure you want to sign out? Your server-side orders, bookings, and receipts remain securely saved under your account.",
                    fontSize = 13.sp,
                    color = TextSecondary
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showSignOutConfirmation = false
                        onSignOut()
                    }
                ) {
                    Text("Sign Out", color = NonVegRed, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutConfirmation = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }

    // Delete Account & Data Erasure Dialog
    if (showDeleteAccountDialog) {
        val maxLegalDialogHeight = (androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp * 0.52f).dp
        AlertDialog(
            onDismissRequest = { showDeleteAccountDialog = false },
            title = { Text("Delete Customer Account & Data?", fontWeight = FontWeight.ExtraBold, color = NonVegRed) },
            text = {
                LazyColumn(modifier = Modifier.heightIn(max = maxLegalDialogHeight), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    item {
                        Text(
                            text = "Account deletion permanently revokes your credentials and immediately purges personal data.",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }
                    item {
                        Text(
                            text = "What is deleted immediately:\n• Customer name, email, and phone number\n• Saved dietary preferences & allergen flags\n• Bookmarked favourite restaurants\n• Table session states and device tokens",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = StarGold.copy(alpha = 0.1f)),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.border(1.dp, StarGold.copy(alpha = 0.3f), RoundedCornerShape(10.dp))
                        ) {
                            Column(modifier = Modifier.padding(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    text = "Statutory Tax Notice (CGST Act Section 36):",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "Finalized past invoices and payment records are legally required to be retained by restaurant merchants for 72 months for tax and audit compliance. Your personal identity will be disassociated and anonymized from these records.",
                                    fontSize = 11.sp,
                                    color = TextSecondary,
                                    lineHeight = 16.sp
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showDeleteAccountDialog = false
                        onDeleteAccount()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = NonVegRed)
                ) {
                    Text("Permanently Delete", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteAccountDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }

    // Privacy Policy Dialog (DPDP Act 2023 Compliant)
    if (showPrivacyPolicyDialog) {
        val maxLegalDialogHeight = (androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp * 0.52f).dp
        AlertDialog(
            onDismissRequest = { showPrivacyPolicyDialog = false },
            title = { Text("Privacy Policy (DPDP 2023)", fontWeight = FontWeight.ExtraBold) },
            text = {
                LazyColumn(modifier = Modifier.heightIn(max = maxLegalDialogHeight), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    item {
                        Text(
                            text = "1. Information We Collect\nSpiralDine collects minimal profile details (name, phone, email) to fulfill dining orders, reserve tables, and deliver receipts. Table dine-in tokens link your food choices to your specific table.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Text(
                            text = "2. Lawful Grounds & Purpose\nData is processed solely for order fulfillment, digital billing, allergen alerts, and restaurant communication in accordance with the Digital Personal Data Protection Act, 2023.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Text(
                            text = "3. Payment & Security Protections\nWe never store raw credit/debit card numbers or UPI PINs. Online transactions are encrypted directly by certified payment gateways (Razorpay).",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Text(
                            text = "4. Data Sharing\nYour orders are shared exclusively with the restaurant where you dine. We do not sell or monetize personal data.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Text(
                            text = "5. Grievance Redressal\nContact our Data Protection Officer at privacy@restaurantos.com with any privacy concerns or data erasure requests.",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = SpiralDineOrange
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showPrivacyPolicyDialog = false }) {
                    Text("Close", color = SpiralDineOrange, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    // Terms & Conditions Dialog
    if (showTermsDialog) {
        val maxLegalDialogHeight = (androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp * 0.52f).dp
        AlertDialog(
            onDismissRequest = { showTermsDialog = false },
            title = { Text("Terms & Conditions", fontWeight = FontWeight.ExtraBold) },
            text = {
                LazyColumn(modifier = Modifier.heightIn(max = maxLegalDialogHeight), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    item {
                        Text(
                            text = "1. Platform Role\nSpiralDine provides SaaS infrastructure connecting diners with independent restaurant merchants. Each restaurant operates autonomously regarding food preparation and service.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Text(
                            text = "2. Table Ordering & QR Sessions\nTable QR orders submitted through the app are transmitted directly to the kitchen display. Diners agree to settle all active orders prior to leaving the restaurant table.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Text(
                            text = "3. Food Allergies & Ingredients\nDietary preferences and allergen notes entered in your profile are conveyed to restaurant staff as a precaution. Customers must independently confirm specific ingredient risks with restaurant personnel.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Text(
                            text = "4. Governing Law\nThese terms are governed by the laws of India. Any disputes are subject to the exclusive jurisdiction of the courts of Hyderabad, Telangana.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showTermsDialog = false }) {
                    Text("Close", color = SpiralDineOrange, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    // Refund & Cancellation Policy Dialog
    if (showRefundPolicyDialog) {
        val maxLegalDialogHeight = (androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp * 0.52f).dp
        AlertDialog(
            onDismissRequest = { showRefundPolicyDialog = false },
            title = { Text("Refund & Cancellation Policy", fontWeight = FontWeight.ExtraBold) },
            text = {
                LazyColumn(modifier = Modifier.heightIn(max = maxLegalDialogHeight), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    item {
                        Text(
                            text = "1. Kitchen Order Cancellation Window\nOrders can be cancelled with a full 100% refund only while in PLACED status. Once the kitchen accepts the ticket and begins cooking (PREPARING status), cancellations cannot be accepted.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Text(
                            text = "2. Table Reservations\nAdvance table bookings may be cancelled up to 1 hour before the reserved seating slot without penalty.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Text(
                            text = "3. Refund Processing Timelines\nApproved digital refunds are credited back to the original payment source (UPI, Card, NetBanking) within 5 to 7 business days via Razorpay.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showRefundPolicyDialog = false }) {
                    Text("Close", color = SpiralDineOrange, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    // Cookie & Device Data Consent Dialog
    if (showCookieConsentDialog) {
        var analyticsOptIn by remember { mutableStateOf(false) }
        var personalizationOptIn by remember { mutableStateOf(true) }

        AlertDialog(
            onDismissRequest = { showCookieConsentDialog = false },
            title = { Text("Data & Storage Consent", fontWeight = FontWeight.ExtraBold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "Manage how data is stored locally on this Android device under the Digital Personal Data Protection Act:",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )

                    // Essential Storage
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(SurfaceMuted, RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Essential Session Data", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("Auth tokens, active cart & table QR binding.", fontSize = 10.sp, color = TextSecondary)
                        }
                        Text("Active", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SuccessGreen)
                    }

                    // Analytics Toggle
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(SurfaceWhite, RoundedCornerShape(10.dp))
                            .border(1.dp, CardBorder, RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Operational Performance", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("Anonymous menu load times & error telemetry.", fontSize = 10.sp, color = TextSecondary)
                        }
                        Switch(
                            checked = analyticsOptIn,
                            onCheckedChange = { analyticsOptIn = it }
                        )
                    }

                    // Personalization Toggle
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(SurfaceWhite, RoundedCornerShape(10.dp))
                            .border(1.dp, CardBorder, RoundedCornerShape(10.dp))
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Dietary Filter Memory", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("Preserves Pure Veg and favourite cuisine tags.", fontSize = 10.sp, color = TextSecondary)
                        }
                        Switch(
                            checked = personalizationOptIn,
                            onCheckedChange = { personalizationOptIn = it }
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { showCookieConsentDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange)
                ) {
                    Text("Save Preferences", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showCookieConsentDialog = false }) {
                    Text("Dismiss", color = TextSecondary)
                }
            }
        )
    }

    // Accessibility Statement Dialog
    if (showAccessibilityDialog) {
        val maxLegalDialogHeight = (androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp * 0.52f).dp
        AlertDialog(
            onDismissRequest = { showAccessibilityDialog = false },
            title = { Text("Accessibility Statement (WCAG 2.2 AA)", fontWeight = FontWeight.ExtraBold) },
            text = {
                LazyColumn(modifier = Modifier.heightIn(max = maxLegalDialogHeight), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    item {
                        Text(
                            text = "SpiralDine is committed to providing an inclusive dining experience for all users:\n\n• Screen Reader Support: Designed for compatibility with Android TalkBack.\n• Dual Dietary Cues: Pure Veg and Non-Veg items are identified by distinct geometric shapes (green circle vs brown triangle) alongside text descriptions.\n• Touch Targets: All interactive buttons meet the minimum 48x48dp touch target standard.\n• Dynamic Text: Supports Android system font enlargement without content clipping.",
                            fontSize = 12.sp,
                            color = TextSecondary,
                            lineHeight = 18.sp
                        )
                    }
                    item {
                        Text(
                            text = "Accessibility Feedback: Contact accessibility@restaurantos.com if you encounter any barriers on mobile.",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = SpiralDineOrange
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showAccessibilityDialog = false }) {
                    Text("Close", color = SpiralDineOrange, fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    // Edit Profile Dialog (Display Name & Phone)
    if (showEditProfileDialog) {
        var editName by remember { mutableStateOf(effectiveName) }
        var editPhone by remember { mutableStateOf(effectivePhone ?: "") }
        var editError by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { showEditProfileDialog = false },
            title = { Text("Edit Profile", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp) },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedTextField(
                        value = editName,
                        onValueChange = {
                            editName = it
                            editError = null
                        },
                        label = { Text("Full Name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = editPhone,
                        onValueChange = {
                            editPhone = it
                            editError = null
                        },
                        label = { Text("Phone Number (Optional)") },
                        placeholder = { Text("+91 98765 43210") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (editError != null) {
                        Text(text = editError!!, fontSize = 12.sp, color = NonVegRed)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val nameValidation = AuthRepository.validateName(editName)
                        if (nameValidation.isFailure) {
                            editError = nameValidation.exceptionOrNull()?.message
                            return@Button
                        }
                        val phoneValidation = AuthRepository.validatePhone(editPhone)
                        if (phoneValidation.isFailure) {
                            editError = phoneValidation.exceptionOrNull()?.message
                            return@Button
                        }
                        showEditProfileDialog = false
                        onUpdateProfile(editName.trim(), editPhone.trim().ifBlank { null })
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange)
                ) {
                    Text("Save Changes", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showEditProfileDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Link Account Dialog
    if (showLinkAccountDialog) {
        var linkEmail by remember { mutableStateOf("") }
        var linkPassword by remember { mutableStateOf("") }
        var linkConfirmPassword by remember { mutableStateOf("") }
        var linkName by remember { mutableStateOf(effectiveName.takeIf { it != "Guest Diner" } ?: "") }
        var linkError by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { showLinkAccountDialog = false },
            title = {
                Text("Link Account & Save Orders", fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(
                        text = "Upgrade your current guest session to a full account. All table orders under this session will be preserved under your new account.",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )

                    OutlinedTextField(
                        value = linkName,
                        onValueChange = {
                            linkName = it
                            linkError = null
                        },
                        label = { Text("Your Name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = linkEmail,
                        onValueChange = {
                            linkEmail = it
                            linkError = null
                        },
                        label = { Text("Email Address") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = linkPassword,
                        onValueChange = {
                            linkPassword = it
                            linkError = null
                        },
                        label = { Text("Create Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = linkConfirmPassword,
                        onValueChange = {
                            linkConfirmPassword = it
                            linkError = null
                        },
                        label = { Text("Confirm Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (linkError != null) {
                        Text(text = linkError!!, fontSize = 12.sp, color = NonVegRed)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val nameValidation = AuthRepository.validateName(linkName)
                        if (nameValidation.isFailure) {
                            linkError = nameValidation.exceptionOrNull()?.message
                            return@Button
                        }
                        val emailValidation = AuthRepository.validateEmail(linkEmail)
                        if (emailValidation.isFailure) {
                            linkError = emailValidation.exceptionOrNull()?.message
                            return@Button
                        }
                        val passValidation = AuthRepository.validatePassword(linkPassword)
                        if (passValidation.isFailure) {
                            linkError = passValidation.exceptionOrNull()?.message
                            return@Button
                        }
                        if (linkPassword != linkConfirmPassword) {
                            linkError = "Passwords do not match."
                            return@Button
                        }
                        showLinkAccountDialog = false
                        onLinkAccount(linkEmail.trim(), linkPassword, linkName.trim())
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange)
                ) {
                    Text("Link Account", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showLinkAccountDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    // Sign In / Register Dialog
    if (showAuthDialog) {
        var email by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var confirmPassword by remember { mutableStateOf("") }
        var name by remember { mutableStateOf("") }
        var authError by remember { mutableStateOf<String?>(null) }

        AlertDialog(
            onDismissRequest = { showAuthDialog = false },
            title = {
                Text(
                    text = if (isRegisterMode) "Create an Account" else "Sign In to Spiral Dine",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 16.sp
                )
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    if (isRegisterMode) {
                        OutlinedTextField(
                            value = name,
                            onValueChange = {
                                name = it
                                authError = null
                            },
                            label = { Text("Full Name") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    OutlinedTextField(
                        value = email,
                        onValueChange = {
                            email = it
                            authError = null
                        },
                        label = { Text("Email Address") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = password,
                        onValueChange = {
                            password = it
                            authError = null
                        },
                        label = { Text("Password") },
                        visualTransformation = PasswordVisualTransformation(),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (isRegisterMode) {
                        OutlinedTextField(
                            value = confirmPassword,
                            onValueChange = {
                                confirmPassword = it
                                authError = null
                            },
                            label = { Text("Confirm Password") },
                            visualTransformation = PasswordVisualTransformation(),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    if (authError != null) {
                        Text(text = authError!!, fontSize = 12.sp, color = NonVegRed)
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End
                    ) {
                        Text(
                            text = if (isRegisterMode) "Already have an account? Sign In" else "New to Spiral Dine? Register",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = SpiralDineOrange,
                            modifier = Modifier.clickable {
                                isRegisterMode = !isRegisterMode
                                authError = null
                            }
                        )
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val emailValidation = AuthRepository.validateEmail(email)
                        if (emailValidation.isFailure) {
                            authError = emailValidation.exceptionOrNull()?.message
                            return@Button
                        }
                        val passValidation = AuthRepository.validatePassword(password)
                        if (passValidation.isFailure) {
                            authError = passValidation.exceptionOrNull()?.message
                            return@Button
                        }

                        if (isRegisterMode) {
                            val nameValidation = AuthRepository.validateName(name)
                            if (nameValidation.isFailure) {
                                authError = nameValidation.exceptionOrNull()?.message
                                return@Button
                            }
                            if (password != confirmPassword) {
                                authError = "Passwords do not match."
                                return@Button
                            }
                            showAuthDialog = false
                            onRegister(email.trim(), password, name.trim())
                        } else {
                            showAuthDialog = false
                            onSignIn(email.trim(), password)
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange)
                ) {
                    Text(if (isRegisterMode) "Register" else "Sign In", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showAuthDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
}

// -------------------------------------------------------------
// SUB-VIEWS
// -------------------------------------------------------------

@Composable
private fun BookingsSubView(
    customerId: String,
    reservationRepository: ReservationRepository?,
    onExplore: () -> Unit
) {
    val reservations by (reservationRepository?.getCustomerReservations(customerId)
        ?: kotlinx.coroutines.flow.flowOf(emptyList()))
        .collectAsState(initial = emptyList())

    val coroutineScope = rememberCoroutineScope()
    var cancelTarget by remember { mutableStateOf<CustomerReservation?>(null) }
    var isCancelling by remember { mutableStateOf(false) }

    if (reservations.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.EventBusy,
                    contentDescription = null,
                    tint = TextSecondary,
                    modifier = Modifier.size(48.dp)
                )
                Text("No table bookings found", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text("Book a table ahead of time at your favorite restaurants.", fontSize = 12.sp, color = TextSecondary)
                Spacer(modifier = Modifier.height(6.dp))
                Button(
                    onClick = onExplore,
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Explore & Book Tables", fontWeight = FontWeight.Bold)
                }
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(reservations, key = { it.id.ifBlank { it.bookingId } }) { res ->
                val canCancel = res.status.equals("Pending", ignoreCase = true) ||
                        res.status.equals("Confirmed", ignoreCase = true)

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = res.restaurantName.ifBlank { "Restaurant" },
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            StatusBadge(status = res.status)
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(Icons.Default.CalendarToday, contentDescription = null, tint = SpiralDineOrange, modifier = Modifier.size(14.dp))
                                Text(res.date, fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(Icons.Default.Schedule, contentDescription = null, tint = SpiralDineOrange, modifier = Modifier.size(14.dp))
                                Text(res.time, fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Icon(Icons.Default.People, contentDescription = null, tint = SpiralDineOrange, modifier = Modifier.size(14.dp))
                                Text("${res.guests} Guests", fontSize = 12.sp, color = TextPrimary, fontWeight = FontWeight.Medium)
                            }
                        }

                        if (res.tableNumber.isNotBlank()) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Table Assigned: #${res.tableNumber}",
                                fontSize = 12.sp,
                                color = SuccessGreen,
                                fontWeight = FontWeight.SemiBold
                            )
                        }

                        if (res.specialNotes.isNotBlank()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Note: ${res.specialNotes}",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                        }

                        if (canCancel) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                                OutlinedButton(
                                    onClick = { cancelTarget = res },
                                    colors = ButtonDefaults.outlinedButtonColors(contentColor = NonVegRed),
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                                ) {
                                    Text("Cancel Booking", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (cancelTarget != null) {
        val target = cancelTarget
        AlertDialog(
            onDismissRequest = { if (!isCancelling) cancelTarget = null },
            title = { Text("Cancel Reservation?", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    text = "Are you sure you want to cancel your table reservation at ${target?.restaurantName}?",
                    fontSize = 13.sp,
                    color = TextSecondary
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val t = target ?: return@Button
                        isCancelling = true
                        coroutineScope.launch {
                            reservationRepository?.cancelReservation(t)
                            isCancelling = false
                            cancelTarget = null
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = NonVegRed),
                    enabled = !isCancelling
                ) {
                    if (isCancelling) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = SurfaceWhite, strokeWidth = 2.dp)
                    } else {
                        Text("Confirm Cancellation", fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { cancelTarget = null },
                    enabled = !isCancelling
                ) {
                    Text("Back")
                }
            }
        )
    }
}

@Composable
private fun FavouritesSubView(
    customerId: String,
    favouritesRepository: FavouritesRepository?,
    allRestaurants: List<Restaurant>,
    onExplore: () -> Unit,
    onSelect: (Restaurant) -> Unit
) {
    val favIds by (favouritesRepository?.getFavouriteRestaurantIds(customerId)
        ?: kotlinx.coroutines.flow.flowOf(emptySet()))
        .collectAsState(initial = emptySet())

    val favRestaurants = remember(favIds, allRestaurants) {
        allRestaurants.filter { favIds.contains(it.id) }
    }

    val coroutineScope = rememberCoroutineScope()

    if (favRestaurants.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.FavoriteBorder,
                    contentDescription = null,
                    tint = TextSecondary,
                    modifier = Modifier.size(48.dp)
                )
                Text(
                    text = "No favourite restaurants yet.",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Text(
                    text = "Save your go-to dining venues to access them quickly.",
                    fontSize = 12.sp,
                    color = TextSecondary
                )
                Spacer(modifier = Modifier.height(6.dp))
                Button(
                    onClick = onExplore,
                    colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Explore Restaurants", fontWeight = FontWeight.Bold)
                }
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(favRestaurants, key = { it.id }) { rest ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, CardBorder, RoundedCornerShape(16.dp))
                        .clickable { onSelect(rest) },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(50.dp)
                                .background(SpiralDineOrangeLight, RoundedCornerShape(12.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Restaurant, contentDescription = null, tint = SpiralDineOrange)
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(rest.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text(
                                text = rest.cuisines.joinToString(", ").ifBlank { rest.locality },
                                fontSize = 12.sp,
                                color = TextSecondary
                            )
                            if (rest.rating != null && rest.rating > 0) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    modifier = Modifier.padding(top = 2.dp)
                                ) {
                                    Icon(Icons.Default.Star, contentDescription = null, tint = StarGold, modifier = Modifier.size(12.dp))
                                    Text("${rest.rating}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                }
                            }
                        }

                        IconButton(
                            onClick = {
                                coroutineScope.launch {
                                    favouritesRepository?.toggleFavourite(customerId, rest.id)
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Favorite,
                                contentDescription = "Remove Favourite",
                                tint = Color(0xFFE91E63)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReviewsSubView(
    customerId: String,
    reviewRepository: ReviewRepository?
) {
    val reviews by (reviewRepository?.getCustomerReviews(customerId)
        ?: kotlinx.coroutines.flow.flowOf(emptyList()))
        .collectAsState(initial = emptyList())

    if (reviews.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.RateReview,
                    contentDescription = null,
                    tint = TextSecondary,
                    modifier = Modifier.size(48.dp)
                )
                Text("No reviews submitted yet.", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text(
                    text = "Share your thoughts and rate dishes after dining to help restaurants improve.",
                    fontSize = 12.sp,
                    color = TextSecondary,
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(reviews, key = { it.id }) { rev ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = rev.restaurantName.ifBlank { "Restaurant" },
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Row {
                                repeat(rev.starRating) {
                                    Icon(Icons.Default.Star, contentDescription = null, tint = StarGold, modifier = Modifier.size(14.dp))
                                }
                            }
                        }

                        if (rev.notes.isNotBlank()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "\"${rev.notes}\"",
                                fontSize = 13.sp,
                                color = TextPrimary
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = if (rev.createdAt.length >= 10) rev.createdAt.take(10) else "Recent",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                            Text(
                                text = rev.status,
                                fontSize = 11.sp,
                                color = SuccessGreen,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReceiptsSubView(
    orders: List<OrderRecord>,
    allRestaurants: List<Restaurant>,
    onOpenReceipt: (OrderRecord) -> Unit
) {
    val eligibleOrders = remember(orders) {
        orders.filter {
            it.paymentStatus.equals("paid", ignoreCase = true) ||
                    it.status.equals("COMPLETED", ignoreCase = true) ||
                    it.status.equals("DINING_COMPLETED", ignoreCase = true)
        }
    }

    if (eligibleOrders.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ReceiptLong,
                    contentDescription = null,
                    tint = TextSecondary,
                    modifier = Modifier.size(48.dp)
                )
                Text("No receipts available yet.", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text("Receipts are generated once your dining bills are paid and settled.", fontSize = 12.sp, color = TextSecondary)
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(eligibleOrders, key = { it.orderId }) { order ->
                val restName = remember(order, allRestaurants) {
                    allRestaurants.firstOrNull { it.id == order.tenantId || it.id == order.restaurantId }?.name
                        ?: "Spiral Partner Restaurant"
                }

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, CardBorder, RoundedCornerShape(16.dp))
                        .clickable { onOpenReceipt(order) },
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = restName,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            Text(
                                text = "₹${String.format(java.util.Locale.US, "%.2f", order.total)}",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = TextPrimary
                            )
                        }

                        Spacer(modifier = Modifier.height(4.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Order: #${order.orderId.takeLast(6).uppercase()}",
                                fontSize = 11.sp,
                                color = TextSecondary
                            )
                            Box(
                                modifier = Modifier
                                    .background(SuccessGreenBg, RoundedCornerShape(6.dp))
                                    .padding(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = if (order.paymentStatus.isNotBlank()) order.paymentStatus.uppercase() else "SETTLED",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = SuccessGreen
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End
                        ) {
                            Text(
                                text = "View Official Receipt →",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = SpiralDineOrange
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SettingsSubView(
    profile: CustomerProfile?,
    effectiveEmail: String?,
    onUpdateNotifPrefs: (Map<String, Boolean>) -> Unit,
    onUpdateAppPrefs: (theme: String, lang: String, textSize: String) -> Unit,
    onSendPasswordReset: (email: String) -> Unit,
    onShowPrivacy: () -> Unit,
    onShowTerms: () -> Unit,
    onShowRefund: () -> Unit = {},
    onShowCookieConsent: () -> Unit = {},
    onShowAccessibility: () -> Unit = {},
    onShowDelete: () -> Unit
) {
    var selectedTheme by remember(profile) { mutableStateOf(profile?.theme ?: "System") }
    var selectedLang by remember(profile) { mutableStateOf(profile?.language ?: "English") }
    var selectedTextSize by remember(profile) { mutableStateOf(profile?.textSize ?: "Medium") }

    val initialNotifs = profile?.notificationPreferences ?: defaultNotificationPreferences()
    var orderNotifs by remember(initialNotifs) { mutableStateOf(initialNotifs["orderUpdates"] ?: true) }
    var bookingNotifs by remember(initialNotifs) { mutableStateOf(initialNotifs["bookingUpdates"] ?: true) }
    var billNotifs by remember(initialNotifs) { mutableStateOf(initialNotifs["billUpdates"] ?: true) }
    var promoNotifs by remember(initialNotifs) { mutableStateOf(initialNotifs["promotionalOffers"] ?: false) }
    var pushNotifs by remember(initialNotifs) { mutableStateOf(initialNotifs["pushEnabled"] ?: true) }
    var emailNotifs by remember(initialNotifs) { mutableStateOf(initialNotifs["emailEnabled"] ?: false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // App Preferences
        item {
            Text("App Preferences", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(8.dp))
            Card(
                modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    // Theme selection
                    Text("Theme", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("System", "Light", "Dark").forEach { t ->
                            FilterChip(
                                selected = selectedTheme == t,
                                onClick = {
                                    selectedTheme = t
                                    onUpdateAppPrefs(t, selectedLang, selectedTextSize)
                                },
                                label = { Text(t, fontSize = 12.sp) }
                            )
                        }
                    }

                    // Language
                    Text("Language", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("English", "Hindi", "Spanish").forEach { l ->
                            FilterChip(
                                selected = selectedLang == l,
                                onClick = {
                                    selectedLang = l
                                    onUpdateAppPrefs(selectedTheme, l, selectedTextSize)
                                },
                                label = { Text(l, fontSize = 12.sp) }
                            )
                        }
                    }

                    // Text Size
                    Text("Text Size & Accessibility", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("Small", "Medium", "Large").forEach { s ->
                            FilterChip(
                                selected = selectedTextSize == s,
                                onClick = {
                                    selectedTextSize = s
                                    onUpdateAppPrefs(selectedTheme, selectedLang, s)
                                },
                                label = { Text(s, fontSize = 12.sp) }
                            )
                        }
                    }
                }
            }
        }

        // Notification Preferences
        item {
            Text("Notification Preferences", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(8.dp))
            Card(
                modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    SettingSwitchRow("Order Status Updates", "Live notifications for table orders", orderNotifs) {
                        orderNotifs = it
                        onUpdateNotifPrefs(mapOf(
                            "orderUpdates" to it, "bookingUpdates" to bookingNotifs,
                            "billUpdates" to billNotifs, "promotionalOffers" to promoNotifs,
                            "pushEnabled" to pushNotifs, "emailEnabled" to emailNotifs
                        ))
                    }
                    DividerLine()
                    SettingSwitchRow("Table Booking Alerts", "Reminders and status updates for reservations", bookingNotifs) {
                        bookingNotifs = it
                        onUpdateNotifPrefs(mapOf(
                            "orderUpdates" to orderNotifs, "bookingUpdates" to it,
                            "billUpdates" to billNotifs, "promotionalOffers" to promoNotifs,
                            "pushEnabled" to pushNotifs, "emailEnabled" to emailNotifs
                        ))
                    }
                    DividerLine()
                    SettingSwitchRow("Bill & Payment Receipts", "Instant alerts when bills are generated", billNotifs) {
                        billNotifs = it
                        onUpdateNotifPrefs(mapOf(
                            "orderUpdates" to orderNotifs, "bookingUpdates" to bookingNotifs,
                            "billUpdates" to it, "promotionalOffers" to promoNotifs,
                            "pushEnabled" to pushNotifs, "emailEnabled" to emailNotifs
                        ))
                    }
                    DividerLine()
                    SettingSwitchRow("Promotions & Offers", "Discounts and special restaurant deals", promoNotifs) {
                        promoNotifs = it
                        onUpdateNotifPrefs(mapOf(
                            "orderUpdates" to orderNotifs, "bookingUpdates" to bookingNotifs,
                            "billUpdates" to billNotifs, "promotionalOffers" to it,
                            "pushEnabled" to pushNotifs, "emailEnabled" to emailNotifs
                        ))
                    }
                    DividerLine()
                    SettingSwitchRow("Push Notifications", "System push alerts on this device", pushNotifs) {
                        pushNotifs = it
                        onUpdateNotifPrefs(mapOf(
                            "orderUpdates" to orderNotifs, "bookingUpdates" to bookingNotifs,
                            "billUpdates" to billNotifs, "promotionalOffers" to promoNotifs,
                            "pushEnabled" to it, "emailEnabled" to emailNotifs
                        ))
                    }
                }
            }
        }

        // Privacy & Security
        item {
            Text("Privacy & Security", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(8.dp))
            Card(
                modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Column {
                    if (!effectiveEmail.isNullOrBlank()) {
                        ProfileNavigationRow(
                            icon = Icons.Default.LockReset,
                            iconTint = SpiralDineOrange,
                            title = "Reset Password",
                            subtitle = "Send password reset instructions to your email",
                            onClick = { onSendPasswordReset(effectiveEmail) }
                        )
                        DividerLine()
                    }

                    ProfileNavigationRow(
                        icon = Icons.Default.Policy,
                        iconTint = Color(0xFF00897B),
                        title = "Privacy Policy",
                        subtitle = "How your data is protected under DPDP 2023",
                        onClick = onShowPrivacy
                    )
                    DividerLine()

                    ProfileNavigationRow(
                        icon = Icons.Default.Description,
                        iconTint = Color(0xFF546E7A),
                        title = "Terms & Conditions",
                        subtitle = "User agreement and booking policies",
                        onClick = onShowTerms
                    )
                    DividerLine()

                    ProfileNavigationRow(
                        icon = Icons.Default.Receipt,
                        iconTint = Color(0xFFE65100),
                        title = "Refund & Cancellation Policy",
                        subtitle = "KOT preparation and refund guidelines",
                        onClick = onShowRefund
                    )
                    DividerLine()

                    ProfileNavigationRow(
                        icon = Icons.Default.Security,
                        iconTint = Color(0xFF8D6E63),
                        title = "Cookie & Data Consent Preferences",
                        subtitle = "Manage local storage, cookies & analytics",
                        onClick = onShowCookieConsent
                    )
                    DividerLine()

                    ProfileNavigationRow(
                        icon = Icons.Default.Info,
                        iconTint = Color(0xFF43A047),
                        title = "Accessibility Statement",
                        subtitle = "WCAG 2.2 AA standards & assistive support",
                        onClick = onShowAccessibility
                    )
                    DividerLine()

                    ProfileNavigationRow(
                        icon = Icons.Default.DeleteForever,
                        iconTint = NonVegRed,
                        title = "Delete Account & Erase Data",
                        subtitle = "Permanently remove your account (DPDP & CGST compliance)",
                        onClick = onShowDelete
                    )
                }
            }
        }

        // Payment Security Note
        item {
            Card(
                modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceMuted)
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(Icons.Default.Security, contentDescription = null, tint = SuccessGreen)
                    Text(
                        text = "SpiralDine does not store raw credit/debit card numbers or UPI PINs. All online payments are handled directly by certified payment gateways.",
                        fontSize = 11.sp,
                        color = TextSecondary
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DiningPreferencesSubView(
    profile: CustomerProfile?,
    onSave: (dietary: List<String>, allergens: List<String>, cuisines: List<String>, method: String, isVeg: Boolean) -> Unit
) {
    var isVeg by remember(profile) { mutableStateOf(profile?.isVeg ?: false) }
    var selectedMethod by remember(profile) { mutableStateOf(profile?.diningMethod ?: "Dine In") }

    val allCuisines = listOf("North Indian", "South Indian", "Italian", "Chinese", "Continental", "Mexican", "Japanese", "Thai", "Mughlai", "Bakery")
    val allDietary = listOf("Vegetarian", "Vegan", "Gluten-Free", "Halal", "Jain", "Keto", "Nut-Free", "Dairy-Free")
    val allAllergens = listOf("Peanuts", "Tree Nuts", "Milk / Dairy", "Eggs", "Shellfish", "Fish", "Soy", "Wheat / Gluten", "Mustard", "Sesame")

    var selectedCuisines by remember(profile) { mutableStateOf((profile?.preferredCuisines ?: emptyList()).toSet()) }
    var selectedDietary by remember(profile) { mutableStateOf((profile?.dietaryPrefs ?: emptyList()).toSet()) }
    var selectedAllergens by remember(profile) { mutableStateOf((profile?.allergens ?: emptyList()).toSet()) }
    var isSaved by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Pure Vegetarian", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Text("Filter restaurants and dishes by vegetarian only", fontSize = 11.sp, color = TextSecondary)
                        }
                        Switch(
                            checked = isVeg,
                            onCheckedChange = { isVeg = it },
                            colors = SwitchDefaults.colors(checkedThumbColor = SuccessGreen, checkedTrackColor = SuccessGreenBg)
                        )
                    }

                    DividerLine()

                    Text("Preferred Dining Method", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("Dine In", "Takeaway", "Delivery").forEach { m ->
                            FilterChip(
                                selected = selectedMethod == m,
                                onClick = { selectedMethod = m },
                                label = { Text(m, fontSize = 12.sp) }
                            )
                        }
                    }
                }
            }
        }

        // Preferred Cuisines
        item {
            Text("Preferred Cuisines", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(6.dp))
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                allCuisines.forEach { c ->
                    val isSel = selectedCuisines.contains(c)
                    FilterChip(
                        selected = isSel,
                        onClick = {
                            selectedCuisines = if (isSel) selectedCuisines - c else selectedCuisines + c
                        },
                        label = { Text(c, fontSize = 12.sp) }
                    )
                }
            }
        }

        // Dietary Preferences
        item {
            Text("Dietary Habits", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(6.dp))
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                allDietary.forEach { d ->
                    val isSel = selectedDietary.contains(d)
                    FilterChip(
                        selected = isSel,
                        onClick = {
                            selectedDietary = if (isSel) selectedDietary - d else selectedDietary + d
                        },
                        label = { Text(d, fontSize = 12.sp) }
                    )
                }
            }
        }

        // Food Allergens
        item {
            Text("Food Allergies & Intolerances", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = NonVegRed)
            Text(
                text = "Recorded allergies are shared with kitchen staff for table orders as a precaution. Always confirm with your server.",
                fontSize = 11.sp,
                color = TextSecondary,
                modifier = Modifier.padding(bottom = 6.dp)
            )
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                allAllergens.forEach { a ->
                    val isSel = selectedAllergens.contains(a)
                    FilterChip(
                        selected = isSel,
                        onClick = {
                            selectedAllergens = if (isSel) selectedAllergens - a else selectedAllergens + a
                        },
                        label = { Text(a, fontSize = 12.sp) }
                    )
                }
            }
        }

        // Save Button
        item {
            Button(
                onClick = {
                    onSave(
                        selectedDietary.toList(),
                        selectedAllergens.toList(),
                        selectedCuisines.toList(),
                        selectedMethod,
                        isVeg
                    )
                    isSaved = true
                },
                colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text(if (isSaved) "Preferences Saved!" else "Save Dining Preferences", fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun HelpSupportSubView(
    customerId: String,
    customerName: String,
    customerEmail: String,
    supportTicketRepository: SupportTicketRepository?
) {
    var category by remember { mutableStateOf("Order Issue") }
    var description by remember { mutableStateOf("") }
    var refId by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var submitSuccess by remember { mutableStateOf(false) }
    var submitError by remember { mutableStateOf<String?>(null) }

    val coroutineScope = rememberCoroutineScope()
    val tickets by (supportTicketRepository?.getCustomerTickets(customerId)
        ?: kotlinx.coroutines.flow.flowOf(emptyList()))
        .collectAsState(initial = emptyList())

    val faqs = listOf(
        "How do I order from my table?" to "Scan the table QR code with the SpiralDine scanner to open the live menu, add dishes to your cart, and place orders directly to the kitchen.",
        "How do I pay my dining bill?" to "When you finish dining, tap 'Request Bill' on your active session or visit My Orders to pay via UPI, Card, or settle cash at the counter.",
        "Can I cancel a reservation?" to "Yes, upcoming table reservations can be cancelled directly under My Table Bookings prior to the reserved time slot.",
        "How are food allergies handled?" to "Add your food allergies in Dining Preferences. They are displayed to the chef and kitchen ticket. Always notify your waiter as well."
    )

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Report an Issue Form
        item {
            Text("Report an Issue / Contact Support", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(8.dp))
            Card(
                modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(16.dp)),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Category", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf("Order Issue", "Payment", "Booking", "General").forEach { cat ->
                            FilterChip(
                                selected = category == cat,
                                onClick = { category = cat },
                                label = { Text(cat, fontSize = 11.sp) }
                            )
                        }
                    }

                    OutlinedTextField(
                        value = refId,
                        onValueChange = { refId = it },
                        label = { Text("Order ID or Booking ID (Optional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = description,
                        onValueChange = {
                            description = it
                            submitError = null
                        },
                        label = { Text("Describe what happened") },
                        minLines = 3,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (submitError != null) {
                        Text(submitError!!, fontSize = 12.sp, color = NonVegRed)
                    }

                    if (submitSuccess) {
                        Text("Ticket submitted! Our support team will assist you shortly.", fontSize = 12.sp, color = SuccessGreen, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = {
                            if (description.isBlank()) {
                                submitError = "Please describe the issue."
                                return@Button
                            }
                            isSubmitting = true
                            submitError = null
                            coroutineScope.launch {
                                val res = supportTicketRepository?.createTicket(
                                    customerId = customerId,
                                    customerName = customerName,
                                    customerEmail = customerEmail,
                                    category = category,
                                    description = description,
                                    orderId = refId.takeIf { it.startsWith("ORD", ignoreCase = true) },
                                    bookingId = refId.takeIf { it.startsWith("RES", ignoreCase = true) }
                                )
                                isSubmitting = false
                                if (res?.isSuccess == true) {
                                    submitSuccess = true
                                    description = ""
                                    refId = ""
                                } else {
                                    submitError = res?.exceptionOrNull()?.message ?: "Failed to submit ticket."
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = SpiralDineOrange),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(44.dp),
                        enabled = !isSubmitting
                    ) {
                        if (isSubmitting) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = SurfaceWhite, strokeWidth = 2.dp)
                        } else {
                            Text("Submit Support Request", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // My Support Tickets
        if (tickets.isNotEmpty()) {
            item {
                Text("My Support Tickets", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            }
            items(tickets, key = { it.id }) { t ->
                Card(
                    modifier = Modifier.fillMaxWidth().border(1.dp, CardBorder, RoundedCornerShape(14.dp)),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(t.ticketId, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                            Box(
                                modifier = Modifier
                                    .background(
                                        if (t.status.equals("resolved", ignoreCase = true)) SuccessGreenBg else SpiralDineOrangeLight,
                                        RoundedCornerShape(6.dp)
                                    )
                                    .padding(horizontal = 8.dp, vertical = 2.dp)
                            ) {
                                Text(
                                    text = t.status.uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (t.status.equals("resolved", ignoreCase = true)) SuccessGreen else SpiralDineOrange
                                )
                            }
                        }
                        Text(t.category, fontSize = 11.sp, color = TextSecondary, fontWeight = FontWeight.Medium)
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(t.description, fontSize = 12.sp, color = TextPrimary)

                        if (!t.responseMessage.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("Response: ${t.responseMessage}", fontSize = 12.sp, color = SuccessGreen, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        // FAQ Section
        item {
            Text("Frequently Asked Questions", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
            Spacer(modifier = Modifier.height(6.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                faqs.forEach { (q, a) ->
                    var expanded by remember { mutableStateOf(false) }
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
                            .clickable { expanded = !expanded },
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                    ) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(q, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary, modifier = Modifier.weight(1f))
                                Icon(
                                    imageVector = if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                    contentDescription = null,
                                    tint = TextSecondary,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            if (expanded) {
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(a, fontSize = 12.sp, color = TextSecondary)
                            }
                        }
                    }
                }
            }
        }
    }
}

// -------------------------------------------------------------
// HELPER COMPONENTS
// -------------------------------------------------------------

@Composable
private fun ProfileNavigationRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    iconTint: Color,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier.weight(1f)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(iconTint.copy(alpha = 0.12f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
            }
            Column {
                Text(title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Text(subtitle, fontSize = 11.sp, color = TextSecondary)
            }
        }
        Icon(
            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
            contentDescription = null,
            tint = TextSecondary,
            modifier = Modifier.size(16.dp)
        )
    }
}

@Composable
private fun SettingSwitchRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = TextPrimary)
            Text(subtitle, fontSize = 11.sp, color = TextSecondary)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(checkedThumbColor = SpiralDineOrange, checkedTrackColor = SpiralDineOrangeLight)
        )
    }
}

@Composable
private fun StatusBadge(status: String) {
    val (bgColor, textColor) = when (status.lowercase()) {
        "confirmed" -> SuccessGreenBg to SuccessGreen
        "pending" -> StarGold.copy(alpha = 0.15f) to TextPrimary
        "cancelled" -> NonVegRed.copy(alpha = 0.12f) to NonVegRed
        else -> SurfaceMuted to TextSecondary
    }
    Box(
        modifier = Modifier
            .background(bgColor, RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 2.dp)
    ) {
        Text(status.uppercase(), fontSize = 10.sp, fontWeight = FontWeight.Bold, color = textColor)
    }
}

@Composable
private fun DividerLine() {
    Box(modifier = Modifier.fillMaxWidth().height(0.5.dp).background(CardBorder))
}
