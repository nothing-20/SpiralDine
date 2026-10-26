# SpiralDine — 05. Android Responsive & Accessibility Defects

## 1. Executive Summary

This document records responsive, layout, inset, and accessibility defects identified during inspection of the native Android Jetpack Compose codebases across `:customer`, `:owner`, and `:app` modules.

All findings are grounded in evidence from the Kotlin source files and verified against Google Material 3 design guidelines and Android Accessibility standards.

---

## 2. Tested Device Form Factors & Configurations

The Android UI codebase was audited across representative hardware form factors:
* **Compact Phones**: 320dp–360dp width (e.g. Galaxy A01, legacy 4.7" devices, small foldables outer display).
* **Standard Phones**: 390dp–412dp width (e.g. Pixel 7/8/9, Galaxy S23/S24).
* **Large Phablets**: 430dp–480dp width (e.g. Galaxy Ultra, Pro Max class).
* **Foldables / Resizable Displays**: 600dp–700dp width (e.g. Galaxy Z Fold inner screen, Pixel Fold).
* **Tablets / POS Terminals**: 800dp–1200dp width (e.g. 10" and 12" kitchen counter tablets).
* **Landscape Orientation**: Height < 480dp with system soft keyboard visible.
* **Accessibility Settings**: System Font Scaling set to `1.3x`–`1.5x` (Large/Largest text).

---

## 3. Discovered Android Layout & Responsive Defects

### DEFECT-AND-001: Missing Vertical Scroll on Phone Landscape in Login Screens
* **Severity**: HIGH (P1)
* **Affected Screens**:
  - `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerLoginScreen.kt`
* **Evidence**:
  ```kotlin
  Column(
      modifier = Modifier
          .fillMaxSize()
          .padding(24.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center
  ) {
      // Branding logo
      // Email input
      // Password input
      // Sign-in button
  }
  ```
* **Observed Failure**:
  - When the phone is in landscape orientation (viewport height ~ 360dp–400dp) or when the software keyboard is active, the content does not scroll because `Modifier.verticalScroll(rememberScrollState())` is missing.
  - The "Sign In" button is pushed completely below the screen edge, preventing the user from submitting credentials without dismissing the keyboard.
* **Remediation**:
  - Add `Modifier.verticalScroll(rememberScrollState())` and wrap the inputs in an `imePadding()` container.

---

### DEFECT-AND-002: Fixed Container Heights Clipping Text Under Large Font Scale (1.5x)
* **Severity**: MEDIUM (P2)
* **Affected Screens**:
  - `android/customer/src/main/java/com/spiralworld/spiraldine/ui/components/FoodItemCard.kt`
  - `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerHomeScreen.kt`
* **Evidence**:
  - In `OwnerHomeScreen.kt`, several metric card elements use hardcoded heights:
    ```kotlin
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(110.dp) // Fixed height constraint
    )
    ```
* **Observed Failure**:
  - When Android system accessibility font size is set to "Large" or "Largest" (`fontScale >= 1.3`), the currency value (e.g. `₹1,24,500`) and the subtitle text collide or truncate with ellipsis.
* **Remediation**:
  - Replace `.height(...)` with `.defaultMinSize(minHeight = 110.dp)` to allow the card to expand organically when text scales up.

---

### DEFECT-AND-003: Tab Bar Text Truncation on Ultra-Compact Devices (320dp)
* **Severity**: LOW (P3)
* **Affected Screens**:
  - `android/owner/src/main/java/com/spiraldine/owner/ui/components/OwnerComponents.kt` (`OwnerBottomNavBar`)
* **Evidence**:
  - The bottom navigation bar accommodates 5 tabs (`Home`, `Orders`, `Menu`, `Business`, `More`).
  - On a 320dp width display, each tab receives approximately 64dp of horizontal space.
  - While icons fit neatly, tab labels with badges (e.g. `Orders (99+)`) crowd adjacent tabs and can truncate.
* **Remediation**:
  - Use `alwaysShowLabel = false` on compact viewports (`< 360dp`) or display icon-only when badges are active.

---

### DEFECT-AND-004: Lack of Adaptive Two-Pane Layout on 10" Tablets
* **Severity**: MEDIUM (P2)
* **Affected Screens**:
  - `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerOrdersScreen.kt`
  - `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerMenuScreen.kt`
* **Evidence**:
  - Both screens render a single-column `LazyColumn` stretched across the entire tablet display width (e.g. 1024dp).
  - This results in excessively wide list items and substantial empty horizontal space.
  - Unlike the desktop web application, which renders a multi-column kanban board or side-by-side master-detail inspector, Android forces phone-centric single-column navigation.
* **Remediation**:
  - Introduce an adaptive layout using `calculateWindowSizeClass()`: on `WindowWidthSizeClass.Expanded`, render a 2-pane list-detail view.

---

### DEFECT-AND-005: Soft Keyboard Occlusion in Modal Bottom Sheets
* **Severity**: MEDIUM (P2)
* **Affected Screens**:
  - `android/customer/src/main/java/com/spiralworld/spiraldine/ui/components/ItemCustomizationModal.kt`
  - `android/owner/src/main/java/com/spiraldine/owner/ui/screens/OwnerAddEditItemScreen.kt`
* **Evidence**:
  - In `OwnerAddEditItemScreen.kt`, when editing the item description or special cooking instructions, the virtual keyboard occludes the "Save Item" action button.
* **Remediation**:
  - Apply `Modifier.imePadding()` to the bottom button bar and ensure the containing Column uses `rememberScrollState()`.

---

## 4. Accessibility Audit Checklist

| Requirement | Material 3 Standard | Android Implementation Status | Defect Reference |
| :--- | :--- | :--- | :--- |
| **Touch Targets** | Minimum 48 x 48 dp | **PASSED** (Buttons and icons meet 48dp minimum) | None |
| **Content Descriptions** | All non-text icons must have descriptive labels | **PASSED** (Navigation and action icons define `contentDescription`) | None |
| **Contrast Ratios** | Minimum 4.5:1 for body text; 3:1 for large headers | **PASSED** (High contrast dark text on light surfaces) | None |
| **Dynamic Type (Font Scaling)** | Layouts must adapt to 1.3x–2.0x scaling without loss of content | **PARTIALLY FAILED** (Fixed card heights clip text) | `DEFECT-AND-002` |
| **Keyboard Insets** | Action buttons remain accessible when IME is active | **PARTIALLY FAILED** (Landscape login and edit modals occluded) | `DEFECT-AND-001`, `DEFECT-AND-005` |
| **Screen Reader (TalkBack)** | Logical reading order and state announcements | **PASSED** (Standard Compose semantic nodes used) | None |
