# Solvance: Smart Solar Microgrid Trading System
**Decentralized Clean Energy Management Network (2026)**  
*Faculty of Computing, Sri Lanka Institute of Information Technology (SLIIT)*

<p align="center">
  <img src="branding/solvance_logo_light_trans.png" alt="Solvance - Smart Solar Trading" width="480"/>
</p>

---

## 1. Project Overview & Deliverables
**Solvance** is an enterprise client-server solution designed for decentralized energy management across distributed solar hubs. Built strictly adhering to the **FAT Service pattern**, all validation rules, scheduling constraints, and transaction lifecycles reside in a central C# ASP.NET Core Web API backed by a MongoDB NoSQL database.

### Repository & Video Demo Links
* **Git Repository Link**: `https://github.com/SLIIT-EAD/SmartSolarMicrogrid-TradingSystem.git` *(Placeholder for team repository)*
* **5-Minute Video Walkthrough**: `https://onedrive.live.com/?id=SOLVANCE_DEMO_2026` / `https://youtu.be/DEMO_VIDEO_LINK` *(Placeholder for recorded presentation)*

---

## 2. System Architecture & Tech Stack

| Layer | Technology Stack | Description |
|---|---|---|
| **Central Web Service** | **C# ASP.NET Core (.NET 10)**, Hosted on Windows IIS Server | **FAT Service Pattern**: Contains 100% of business logic (7-day rule, 12-hour cancellation notice, node deactivation blocker, QR verification). |
| **Database** | **MongoDB (NoSQL)** | 4 Mandatory Collections: `User's detail`, `SolarStationInfo`, `EnergyBookingSlots`, `Energy Reservation`. |
| **Web Client** | **React.js + Tailwind CSS** | UI Layer for Backoffice Administrators and Grid Operators. |
| **Mobile Client** | **Pure Native Android (Java/Kotlin + Android SDK)**, SQLite | Native UI Layer for Solar Prosumers and Grid Operators with local SQLite persistence, Google Maps API, and camera QR scanning. |

---

## 3. Team Members & Individual Contributions (Full-Stack Vertical Slice Breakdown)

| Student Name | Student IT Number | Assigned Vertical Domain | Web Component | Mobile Component | Backend & Database |
|---|---|---|---|---|---|
| **[Luqman Booso](https://github.com/luqmanbooso) (Lead)** | `IT21000001` | **User Identity & Prosumer Lifecycle** | Staff login (`Login.jsx`), Prosumer directory & approvals (`ProsumerManagement.jsx`) | Prosumer login (`LoginActivity.java`), NIC registration (`RegisterActivity.java`), SQLite session store | `UsersController`, `UserService`, JWT auth, `User's detail` MongoDB collection |
| **[Sakith Liyanage](https://github.com/SakithLiyanage)** | `IT21000002` | **Solar Nodes & Station Geolocation** | Node management & slot editor (`NodeManagement.jsx`), deactivation blocker UI | Station selector (`CreateReservationActivity.java`), Google Maps station markers (`StationsMapActivity.java`) | `StationsController`, `StationService`, `SlotsController`, `SolarStationInfo` collection |
| **[Lahiru Jayawardhana](https://github.com/Lahirujay00)** | `IT21000003` | **Energy Reservations & Rule Engine** | Bookings ledger & status filter (`BackofficeDashboard.jsx`), reservation modals | Booking flow with 7-day rule (`CreateReservationActivity.java`), 12-hour cancel rule (`ReservationDetailActivity.java`) | `ReservationsController`, `ReservationService`, 7-day & 12-hour rules, `Energy Reservation` collection |
| **[Nilakshi Madubashini](https://github.com/madubashinii)** | `IT21000004` | **Operator Terminal, QR & Telemetry** | Operator web console (`OperatorDashboard.jsx`), live power flow KPI telemetry | Operator camera QR scanner (`OperatorScannerActivity.java`), ZXing QR card generator, animations | `/api/Reservations/verify-qr`, cryptographic QR token generator, battery slot sync |

---

## 4. Setup & Running Instructions

### Prerequisites
* .NET 8 / 10 SDK
* Node.js (v18+) & npm
* MongoDB Community Server (Running on `mongodb://localhost:27017`)
* Android Studio (Giraffe / Iguana / Koala) with Android SDK 34

### 1. Starting the C# Web API
```bash
cd backend
dotnet restore
dotnet run --launch-profile http
# API runs on http://localhost:5000 (OpenAPI: http://localhost:5000/openapi/v1.json)
```

### 2. Starting the Web Management Client
```bash
cd web-client
npm install
npm run dev
# Web console runs on http://localhost:5173
```

### 3. Running the Native Android App
1. Open the folder `mobile-client/` in Android Studio.
2. Allow Gradle sync to complete dependencies (`play-services-maps`, `zxing-android-embedded`, `retrofit2`).
3. Run on an Android Emulator or physical device.

---

## 5. Pre-Seeded Demonstration Accounts

| Role | Username / NIC | Password | Portal / App |
|---|---|---|---|
| **Backoffice Admin** | `ADMIN001` | `Admin@123` | Web Management Client |
| **Grid Operator** | `OPERATOR001` | `Operator@123` | Web Client & Android Mobile App |
| **Active Prosumer** | `200012345678` | `Prosumer@123` | Android Mobile App |
| **Pending Prosumer** | `199987654321` | `Prosumer@123` | Demonstrates Backoffice approval workflow |

---

## 6. Brand Identity & Adaptive Dual-Theme System

The official **Solvance** visual identity system comprises specialized vector-optimized logo variations tailored for dynamic Light and Dark mode interfaces:

| Logo Variant | Visual Description | Implementation Context | File Asset Paths |
|---|---|---|---|
| **1. Standalone Solar-S Mark (No Text)** | Hexagonal solar-photovoltaic circuit `S` with radiant sunbeams and circuit nodes (no text) | Web Navbar brand header in both Dark & Light modes, mobile toolbars | `web-client/public/solvance_mark_dark_trans.png`<br/>`web-client/public/solvance_mark_light_trans.png` |
| **2. Squircle App Launcher Icon** | Solar-S emblem inside rounded neon teal squircle badge | Browser tab favicon, Android app launcher icon (`ic_launcher`) | `web-client/public/favicon.png`<br/>`mobile-client/app/src/main/res/drawable/ic_solvance_logo.png` |
| **3. Horizontal Dark Logo** | Radiant Solar-S glyph with white & orange/teal `SOLVANCE SMART SOLAR TRADING` typography | Dark-mode Web login portal, Android mobile login screen | `web-client/public/solvance_banner_dark_trans.png`<br/>`mobile-client/app/src/main/res/drawable/logo_dark_transparent.png` |
| **4. Horizontal Light Logo** | Solar-S glyph with dark navy & teal `SOLVANCE SMART SOLAR TRADING` typography | Light-mode Web login portal, printable reports, documentation | `docs/branding/solvance_light_horizontal.png`<br/>`web-client/public/solvance_logo_light_trans.png` |
| **5. Monochrome Outline Logo** | High-contrast black/dark outline linework with zero gradient fill | High-contrast accessibility modes, thermal receipt printing | `docs/branding/solvance_mark_mono_trans.png`<br/>`docs/branding/solvance_vertical_monochrome.png` |

### Dual Theme Architecture (Light & Dark Mode)
* **Instant Dynamic Toggle**: Accessible in the Web Navbar and Login Portal via the Sun/Moon toggle button.
* **Persistent Preference**: Stored in `localStorage` under `solar_theme` and synchronized to the `<html>` root DOM class.
* **Full Context-Aware Switching**: All views (Backoffice Dashboard, Prosumer Directory, Solar Hub Nodes, Operator Terminal) seamlessly adjust backgrounds, cards, typography, and status indicators.
