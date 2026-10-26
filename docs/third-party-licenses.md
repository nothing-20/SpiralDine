# SpiralDine Third-Party Asset & Dependency License Inventory

**Version:** 1.0  
**Audit Date:** October 2026  
**Compliance Standard:** Open Source Software (OSS) License Compliance & Commercial Use Authorization

---

## 1. Overview & Policy Statement

SpiralDine uses open-source software, fonts, and assets under permissive licenses allowing commercial distribution, modification, and hosting. No copyleft (e.g. GPL-3.0, AGPL-3.0) licensed code is linked to the proprietary core logic.

---

## 2. Web Frontend Core Dependencies (`package.json`)

| Package / Asset | Version | License | Primary Purpose | Commercial Use Allowed | Attribution / Notice Required |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **react** | `^18.3.1` | MIT | Frontend UI framework | Yes | Include copyright notice |
| **react-dom** | `^18.3.1` | MIT | React DOM renderer | Yes | Include copyright notice |
| **react-router-dom** | `^6.28.0` | MIT | Client-side routing & navigation | Yes | Include copyright notice |
| **firebase** | `^11.0.2` | Apache 2.0 | Authentication & Firestore SDK | Yes | Include Apache notice |
| **lucide-react** | `^0.468.0` | ISC | Accessible UI iconography | Yes | Include ISC notice |
| **tailwindcss** | `^3.4.15` | MIT | Utility-first styling engine | Yes | Include copyright notice |
| **vite** | `^5.4.11` | MIT | Build tool and bundler | Yes | Include copyright notice |
| **typescript** | `~5.6.2` | Apache 2.0 | Type safety & compilation | Yes | Include Apache notice |
| **canvas-confetti** | `^1.9.3` | ISC | Gamified order celebration FX | Yes | Include ISC notice |
| **clsx** | `^2.1.1` | MIT | Class name composition utility | Yes | Include copyright notice |
| **tailwind-merge** | `^2.5.5` | MIT | Tailwind class conflict resolution | Yes | Include copyright notice |
| **zod** | `^3.23.8` | MIT | Schema validation and sanitization | Yes | Include copyright notice |

---

## 3. Android Customer Application Dependencies (`build.gradle.kts`)

| Library / Module | License | Purpose | Commercial Use Allowed | Attribution / Notice Required |
| :--- | :--- | :--- | :--- | :--- |
| **AndroidX Core KTX** | Apache 2.0 | Android standard Kotlin extensions | Yes | Include Apache notice |
| **AndroidX Lifecycle** | Apache 2.0 | ViewModel and lifecycle management | Yes | Include Apache notice |
| **Jetpack Compose** | Apache 2.0 | Modern declarative UI toolkit | Yes | Include Apache notice |
| **Compose Material 3** | Apache 2.0 | Google Material 3 Design System | Yes | Include Apache notice |
| **Compose Navigation** | Apache 2.0 | Jetpack Compose app navigation | Yes | Include Apache notice |
| **Kotlin Coroutines** | Apache 2.0 | Asynchronous concurrency | Yes | Include Apache notice |
| **Firebase Android SDK** | Apache 2.0 | Firebase Auth & Firestore Client | Yes | Include Apache notice |
| **Coil (Image Loading)** | Apache 2.0 | Asynchronous image loading & caching | Yes | Include Apache notice |
| **Google Play Services** | Android Software Development Kit License | Location & Google Sign-In | Yes | SDK terms compliant |

---

## 4. Typography & Iconography Assets

| Asset Family | Source / Vendor | License | Usage Mode | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Inter** | Google Fonts / Rasmus Andersson | SIL Open Font License 1.1 | Primary application typography | Authorized for commercial web & mobile embedding |
| **Outfit** | Google Fonts / Onsen Organics | SIL Open Font License 1.1 | Display & heading typography | Authorized for commercial web & mobile embedding |
| **Lucide Icons** | Lucide Project | ISC License | In-app iconography and UI glyphs | Authorized for commercial bundling |
| **Material Symbols** | Google Fonts | Apache 2.0 | Android Material 3 iconography | Authorized for commercial distribution |

---

## 5. Proprietary Branding & Commercial Media

| Asset | Creator / Owner | Rights Reserved | Allowed Usage |
| :--- | :--- | :--- | :--- |
| **SpiralDine Logo & Trademark** | Spiral World / RestaurantOS | All Rights Reserved | Exclusive brand identity of SpiralDine SaaS |
| **Food & Restaurant Photography** | SpiralDine Media Library / Unsplash License | Free for commercial use, no attribution required | Application demonstrations & default restaurant assets |

---

## 6. Compliance Verification & Legal Notice Distribution

- Both Web and Android distributions contain zero GPL/AGPL viral dependencies.
- Open-source notices are preserved in the bundled minified distribution artifacts (`dist/` and Android APK).
- Third-party licenses may be requested or inspected via `legal@restaurantos.com`.
