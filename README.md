# Solvance — Smart Solar Microgrid Trading System

**Module**: SE4040 — Enterprise Application Development  
**Institution**: Faculty of Computing, Sri Lanka Institute of Information Technology (SLIIT)  

---

## 1. Project Links

* **Git Repository Link**: https://github.com/SakithLiyanage/Solvance-Smart-SolarMicrogrid-Trading-System.git
* **Video Demonstration Link**: https://youtu.be/ESs88kLkrvk

---

## 2. Individual Contributions

| Student Name | Student IT Number | Assigned Component / Domain | Contribution Details |
| :--- | :--- | :--- | :--- |
| **G.L.S. Chanlaka (Group Leader)** | **IT23151260** | **Solar Stations & Geolocation (Google Maps)** | • Implemented backend station management and hourly slot services (`StationsController.cs`, `StationService.cs`, `SlotsController.cs`).<br/>• Developed Android Google Maps station explorer with live markers and navigation (`StationsMapActivity.java`).<br/>• Built Web Node Management portal with map embed and capacity controls (`NodeManagement.jsx`). |
| **M.L. Booso** | **IT23452916** | **User Identity & Prosumer Account Lifecycle** | • Implemented backend user authentication and JWT token generation (`AuthController.cs`, `UserService.cs`, `UsersController.cs`).<br/>• Developed Android Prosumer Login and Registration (`LoginActivity.java`, `RegisterActivity.java`).<br/>• Implemented local SQLite database helper for session persistence (`DatabaseHelper.java`).<br/>• Built Web Admin staff login and prosumer approval interface (`Login.jsx`, `ProsumerManagement.jsx`). |
| **L.T. Jayawardhana** | **IT23156760** | **Energy Reservations & Business Rule Enforcement** | • Engineered backend 7-day advance booking window and 12-hour modification/cancellation validation rules (`ReservationService.cs`, `ReservationsController.cs`).<br/>• Built Android Prosumer Slot Booking screen with dynamic 7-day selector (`CreateReservationActivity.java`).<br/>• Implemented reservation detail and rescheduling view (`ReservationDetailActivity.java`).<br/>• Built Web Energy Reservations ledger (`ReservationManagement.jsx`). |
| **H.N. Madubashini** | **IT23192300** | **Grid Operator Terminal & QR Code Verification** | • Implemented backend QR code verification and HMAC security token generation (`ReservationService.cs`).<br/>• Developed Android Operator camera QR scanner using ZXing library (`OperatorScannerActivity.java`).<br/>• Built Web Operator Terminal with live telemetry and scanner support (`OperatorDashboard.jsx`). |

---

## 3. How to Run the Project

### Prerequisites
* .NET SDK (8.0 or 10.0) & .NET Hosting Bundle (for IIS)
* Node.js (v18+) & npm
* MongoDB (Running on `mongodb://localhost:27017`)
* Android Studio with Android SDK 34
* Internet Information Services (IIS) on Windows (optional for IIS hosting)

---

### Step 1: Run the Backend API (C# ASP.NET Core)

#### Option A: Direct CLI (Development)
```bash
cd backend
dotnet restore
dotnet run
```
* The API runs on `http://localhost:5000` (or `http://192.168.1.105:5000` on LAN).

#### Option B: Deploy to Windows IIS Server (Production FAT Pattern)
1. Install the **.NET Core Hosting Bundle** on Windows.
2. Publish the release build:
   ```bash
   cd backend
   dotnet publish -c Release -o C:\inetpub\wwwroot\SolarMicrogridApi
   ```
3. Open **IIS Manager** (`inetmgr`):
   - Add new Website pointing to physical path `C:\inetpub\wwwroot\SolarMicrogridApi`.
   - Set Application Pool **.NET CLR Version** to **No Managed Code**.
   - Bind HTTP to Port `5000` (or `80`) and click **Start**.

---

### Step 2: Start the Web Client (React + Vite)
```bash
cd web-client
npm install
npm run dev
```
* The Web portal runs on `http://localhost:5173`.

---

### Step 3: Run the Mobile App (Native Android)
1. Open the `mobile-client` folder in Android Studio.
2. Sync Gradle dependencies.
3. Run on an Android Emulator or physical device connected via USB/Wi-Fi.

---

## 4. Default Test Credentials

| Role | Username / NIC / Email | Password | Portal |
| :--- | :--- | :--- | :--- |
| **Backoffice Admin** | `200331713189` | `AdminPassword123!` | Web Client |
| **Grid Operator** | `priyantha@opertaor.lk` | `Priyantha123` | Web Client / Mobile App |
| **Active Prosumer** | `cryptonkadet@gmail.com` | `Luqa12#` | Mobile App |
