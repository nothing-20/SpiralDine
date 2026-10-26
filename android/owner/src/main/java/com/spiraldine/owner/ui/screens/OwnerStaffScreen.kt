package com.spiraldine.owner.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.spiraldine.owner.data.model.StaffRecord
import com.spiraldine.owner.theme.*
import com.spiraldine.owner.ui.components.OwnerCard

@OptIn(ExperimentalMaterial3Api::class)

@Composable
fun OwnerStaffScreen(
    staffList: List<StaffRecord>,
    onBack: () -> Unit,
    onInviteStaff: (String, String, String, String, String) -> Unit = { _, _, _, _, _ -> },
    onUpdateStaff: (String, String, String, String, String) -> Unit = { _, _, _, _, _ -> },
    onToggleStatus: (String, Boolean) -> Unit = { _, _ -> },
    onArchiveStaff: (String) -> Unit = {},
    // Legacy compatibility signature
    onAddStaff: (String, String, String, String) -> Unit = { name, role, email, phone -> }
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf("All") }
    var selectedStatus by remember { mutableStateOf("All") }

    // Dialog states
    var showInviteDialog by remember { mutableStateOf(false) }
    var editingStaff by remember { mutableStateOf<StaffRecord?>(null) }
    var staffToArchive by remember { mutableStateOf<StaffRecord?>(null) }

    val roleOptions = listOf(
        "All" to "All Staff",
        "waiter" to "Waiters",
        "kitchen" to "Kitchen/Chefs",
        "manager" to "Managers",
        "cashier" to "Cashiers",
        "reception" to "Reception",
        "admin" to "Admins"
    )

    val statusOptions = listOf("All", "active", "invited", "suspended", "archived")

    // Filter staff
    val filteredStaff = staffList.filter { s ->
        val matchesSearch = searchQuery.isBlank() ||
                s.name.contains(searchQuery, ignoreCase = true) ||
                s.email.contains(searchQuery, ignoreCase = true) ||
                s.phone.contains(searchQuery, ignoreCase = true) ||
                s.department.contains(searchQuery, ignoreCase = true)
        val matchesRole = selectedRole == "All" || s.role.equals(selectedRole, ignoreCase = true)
        val matchesStatus = selectedStatus == "All" || s.status.equals(selectedStatus, ignoreCase = true)
        matchesSearch && matchesRole && matchesStatus
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Staff Management", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                        Text("${staffList.count { it.active }} active team members", fontSize = 11.sp, color = TextSecondary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = TextPrimary)
                    }
                },
                actions = {
                    IconButton(onClick = { showInviteDialog = true }) {
                        Icon(Icons.Default.PersonAdd, contentDescription = "Invite Staff", tint = TerracottaOrange)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SurfaceWhite)
            )
        },
        containerColor = BackgroundLight
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Search Input
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it },
                placeholder = { Text("Search by name, email, role...", fontSize = 12.sp) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, modifier = Modifier.size(18.dp)) },
                trailingIcon = {
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { searchQuery = "" }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", modifier = Modifier.size(16.dp))
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                shape = RoundedCornerShape(12.dp),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = SurfaceWhite,
                    unfocusedContainerColor = SurfaceWhite,
                    focusedBorderColor = TerracottaOrange,
                    unfocusedBorderColor = DividerStroke
                ),
                singleLine = true
            )

            // Role Filter Chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                roleOptions.forEach { (key, label) ->
                    FilterChip(
                        selected = selectedRole == key,
                        onClick = { selectedRole = key },
                        label = { Text(label, fontSize = 11.sp, fontWeight = if (selectedRole == key) FontWeight.Bold else FontWeight.Normal) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = TerracottaOrange,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            // Status Filter Chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                statusOptions.forEach { st ->
                    val label = when (st) {
                        "All" -> "All Status"
                        "active" -> "Active"
                        "invited" -> "Invited"
                        "suspended" -> "Suspended"
                        "archived" -> "Archived"
                        else -> st
                    }
                    FilterChip(
                        selected = selectedStatus == st,
                        onClick = { selectedStatus = st },
                        label = { Text(label, fontSize = 11.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = TextPrimary,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Staff Roster List
            if (filteredStaff.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Icons.Default.Group, contentDescription = null, modifier = Modifier.size(48.dp), tint = TextSecondary.copy(alpha = 0.5f))
                        Text("No staff members found", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextPrimary)
                        Text("Try adjusting your role or status filter", fontSize = 12.sp, color = TextSecondary)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(filteredStaff, key = { it.id }) { staff ->
                        OwnerCard(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                        Box(
                                            modifier = Modifier
                                                .size(40.dp)
                                                .clip(CircleShape)
                                                .background(
                                                    when (staff.role.lowercase()) {
                                                        "kitchen" -> WarningYellowLight
                                                        "manager" -> InfoBlueLight
                                                        else -> TerracottaOrangeLight
                                                    }
                                                ),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                staff.name.take(1).uppercase(),
                                                fontWeight = FontWeight.Bold,
                                                color = when (staff.role.lowercase()) {
                                                    "kitchen" -> WarningYellow
                                                    "manager" -> InfoBlue
                                                    else -> TerracottaOrange
                                                },
                                                fontSize = 15.sp
                                            )
                                        }

                                        Column {
                                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                                Text(staff.name, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                                Surface(
                                                    color = when (staff.role.lowercase()) {
                                                        "manager" -> InfoBlue.copy(alpha = 0.15f)
                                                        "kitchen" -> WarningYellow.copy(alpha = 0.15f)
                                                        else -> TerracottaOrange.copy(alpha = 0.15f)
                                                    },
                                                    shape = RoundedCornerShape(6.dp)
                                                ) {
                                                    Text(
                                                        staff.role.replaceFirstChar { it.uppercaseChar() },
                                                        fontSize = 9.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = when (staff.role.lowercase()) {
                                                            "manager" -> InfoBlue
                                                            "kitchen" -> WarningYellow
                                                            else -> TerracottaOrange
                                                        },
                                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }

                                            Text(
                                                if (staff.email.isNotBlank()) staff.email else (if (staff.phone.isNotBlank()) staff.phone else "No contact email"),
                                                fontSize = 11.sp,
                                                color = TextSecondary
                                            )
                                        }
                                    }

                                    // Status Badge & Toggle
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = when (staff.status.lowercase()) {
                                            "active" -> SuccessGreen.copy(alpha = 0.15f)
                                            "suspended" -> DangerRed.copy(alpha = 0.15f)
                                            "invited" -> WarningYellow.copy(alpha = 0.15f)
                                            else -> TextSecondary.copy(alpha = 0.15f)
                                        }
                                    ) {
                                        Text(
                                            staff.status.replaceFirstChar { it.uppercaseChar() },
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = when (staff.status.lowercase()) {
                                                "active" -> SuccessGreen
                                                "suspended" -> DangerRed
                                                "invited" -> WarningYellow
                                                else -> TextSecondary
                                            },
                                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(10.dp))
                                Divider(color = DividerStroke)
                                Spacer(modifier = Modifier.height(8.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        OutlinedButton(
                                            onClick = { editingStaff = staff },
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(13.dp))
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text("Edit", fontSize = 11.sp)
                                        }

                                        OutlinedButton(
                                            onClick = { onToggleStatus(staff.id, staff.active) },
                                            shape = RoundedCornerShape(8.dp),
                                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Icon(
                                                if (staff.active) Icons.Default.Block else Icons.Default.CheckCircle,
                                                contentDescription = null,
                                                modifier = Modifier.size(13.dp),
                                                tint = if (staff.active) WarningYellow else SuccessGreen
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(if (staff.active) "Suspend" else "Activate", fontSize = 11.sp)
                                        }
                                    }

                                    IconButton(onClick = { staffToArchive = staff }) {
                                        Icon(Icons.Default.Archive, contentDescription = "Archive", tint = TextSecondary, modifier = Modifier.size(18.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Invite Employee Dialog
    if (showInviteDialog) {
        InviteEmployeeDialog(
            onDismiss = { showInviteDialog = false },
            onInvite = { name, email, phone, role, dept ->
                onInviteStaff(name, email, phone, role, dept)
                onAddStaff(name, role, email, phone)
                showInviteDialog = false
            }
        )
    }

    // Edit Employee Dialog
    if (editingStaff != null) {
        EditEmployeeDialog(
            staff = editingStaff!!,
            onDismiss = { editingStaff = null },
            onSave = { id, name, role, dept, phone ->
                onUpdateStaff(id, name, role, dept, phone)
                editingStaff = null
            }
        )
    }

    // Archive Employee Confirmation Dialog
    if (staffToArchive != null) {
        AlertDialog(
            onDismissRequest = { staffToArchive = null },
            title = { Text("Archive ${staffToArchive?.name}?", fontWeight = FontWeight.Bold, fontSize = 15.sp) },
            text = { Text("This will revoke system access for this team member and move their record to the archive roster.", fontSize = 13.sp) },
            confirmButton = {
                Button(
                    onClick = {
                        staffToArchive?.id?.let { onArchiveStaff(it) }
                        staffToArchive = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = DangerRed)
                ) {
                    Text("Archive", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { staffToArchive = null }) {
                    Text("Cancel", color = TextSecondary)
                }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InviteEmployeeDialog(
    onDismiss: () -> Unit,
    onInvite: (String, String, String, String, String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("waiter") }
    var department by remember { mutableStateOf("Service") }

    val roles = listOf("waiter", "kitchen", "manager", "cashier", "reception", "admin")

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = SurfaceWhite,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Invite New Team Member", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)
                Text("Sends an official invitation with a secure activation link.", fontSize = 11.sp, color = TextSecondary)

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Full Name *") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email Address *") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Phone Number") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Text("Assigned Role", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    roles.forEach { r ->
                        FilterChip(
                            selected = role == r,
                            onClick = {
                                role = r
                                department = when (r) {
                                    "kitchen" -> "Kitchen"
                                    "manager" -> "Management"
                                    "cashier" -> "Front Desk"
                                    else -> "Service"
                                }
                            },
                            label = { Text(r.replaceFirstChar { it.uppercase() }) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TerracottaOrange,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }

                OutlinedTextField(
                    value = department,
                    onValueChange = { department = it },
                    label = { Text("Department") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = TextSecondary)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (name.isNotBlank() && email.isNotBlank()) {
                                onInvite(name.trim(), email.trim(), phone.trim(), role, department)
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Send Invite", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun EditEmployeeDialog(
    staff: StaffRecord,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, String) -> Unit
) {
    var name by remember { mutableStateOf(staff.name) }
    var phone by remember { mutableStateOf(staff.phone) }
    var role by remember { mutableStateOf(staff.role) }
    var department by remember { mutableStateOf(staff.department) }

    val roles = listOf("waiter", "kitchen", "manager", "cashier", "reception", "admin")

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = SurfaceWhite,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Edit Team Member", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = TextPrimary)

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Full Name") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Phone Number") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Text("Role", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    roles.forEach { r ->
                        FilterChip(
                            selected = role == r,
                            onClick = { role = r },
                            label = { Text(r.replaceFirstChar { it.uppercase() }) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = TerracottaOrange,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }

                OutlinedTextField(
                    value = department,
                    onValueChange = { department = it },
                    label = { Text("Department") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = onDismiss) {
                        Text("Cancel", color = TextSecondary)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                onSave(staff.id, name.trim(), role, department, phone.trim())
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = TerracottaOrange)
                    ) {
                        Text("Save Changes", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}
