package com.spiralworld.spiraldine.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spiralworld.spiraldine.data.model.NotificationRecord
import com.spiralworld.spiraldine.theme.BorderColor
import com.spiralworld.spiraldine.theme.CardBackground
import com.spiralworld.spiraldine.theme.MainBackground
import com.spiralworld.spiraldine.theme.PrimaryGreen
import com.spiralworld.spiraldine.theme.PrimaryText
import com.spiralworld.spiraldine.theme.SecondaryText
import com.spiralworld.spiraldine.theme.SpiralDineOrange
import com.spiralworld.spiraldine.theme.SuccessGreen
import com.spiralworld.spiraldine.theme.TerracottaAccent

@Composable
fun NotificationsScreen(
    notifications: List<NotificationRecord>,
    onBack: () -> Unit,
    onNotificationClick: (NotificationRecord) -> Unit,
    onMarkAllAsRead: () -> Unit
) {
    val unreadCount = notifications.count { !it.read }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MainBackground),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 100.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Top Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .clip(CircleShape)
                            .background(CardBackground)
                            .border(1.dp, BorderColor, CircleShape)
                            .clickable { onBack() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = PrimaryText,
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    Column {
                        Text(
                            text = "Notifications",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = PrimaryText
                        )
                        Text(
                            text = if (unreadCount > 0) "$unreadCount unread alert${if (unreadCount == 1) "" else "s"}" else "All caught up",
                            fontSize = 12.sp,
                            color = if (unreadCount > 0) TerracottaAccent else SecondaryText
                        )
                    }
                }

                if (unreadCount > 0) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(PrimaryGreen.copy(alpha = 0.1f))
                            .clickable { onMarkAllAsRead() }
                            .padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, tint = PrimaryGreen, modifier = Modifier.size(14.dp))
                        Text(
                            text = "Mark all read",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryGreen
                        )
                    }
                }
            }
        }

        if (notifications.isEmpty()) {
            item {
                Spacer(modifier = Modifier.height(40.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(containerColor = CardBackground),
                    border = androidx.compose.foundation.BorderStroke(1.dp, BorderColor)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(PrimaryGreen.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.NotificationsNone,
                                contentDescription = null,
                                tint = PrimaryGreen,
                                modifier = Modifier.size(32.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = "You're All Caught Up!",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryText,
                            textAlign = TextAlign.Center
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        Text(
                            text = "No notifications right now. Updates about your orders, table bookings, and dining bills will appear here.",
                            fontSize = 12.sp,
                            color = SecondaryText,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 16.dp)
                        )
                    }
                }
            }
        } else {
            items(notifications, key = { it.id }) { notif ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNotificationClick(notif) },
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (notif.read) CardBackground else PrimaryGreen.copy(alpha = 0.05f)
                    ),
                    border = androidx.compose.foundation.BorderStroke(
                        1.dp,
                        if (notif.read) BorderColor else PrimaryGreen.copy(alpha = 0.3f)
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalAlignment = Alignment.Top,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        // Icon based on type
                        val iconVector = when (notif.category.lowercase()) {
                            "order" -> Icons.Default.Restaurant
                            "bill", "payment" -> Icons.Default.Payments
                            "booking" -> Icons.Default.CalendarMonth
                            else -> Icons.Default.Notifications
                        }
                        val iconColor = when (notif.category.lowercase()) {
                            "order" -> PrimaryGreen
                            "bill", "payment" -> SpiralDineOrange
                            "booking" -> PrimaryGreen
                            else -> TerracottaAccent
                        }

                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(iconColor.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = iconVector,
                                contentDescription = null,
                                tint = iconColor,
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = notif.title,
                                    fontSize = 13.sp,
                                    fontWeight = if (notif.read) FontWeight.SemiBold else FontWeight.Bold,
                                    color = PrimaryText
                                )
                                Text(
                                    text = notif.createdAt,
                                    fontSize = 10.sp,
                                    color = SecondaryText
                                )
                            }

                            Spacer(modifier = Modifier.height(4.dp))

                            Text(
                                text = notif.body,
                                fontSize = 12.sp,
                                color = if (notif.read) SecondaryText else PrimaryText
                            )

                            if (notif.orderId.isNotBlank()) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Tap to track Order #${notif.orderId} →",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = PrimaryGreen
                                )
                            }
                        }

                        if (!notif.read) {
                            Box(
                                modifier = Modifier
                                    .padding(top = 4.dp)
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(TerracottaAccent)
                            )
                        }
                    }
                }
            }
        }
    }
}
