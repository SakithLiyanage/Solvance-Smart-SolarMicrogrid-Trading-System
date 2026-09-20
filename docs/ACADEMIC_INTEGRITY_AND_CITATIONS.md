# Academic Integrity, AI Usage Reflection & Group Citations

**Module**: SE4040 — Enterprise Application Development  
**Project**: Solvance — Smart Solar Microgrid Trading System  
**Institution**: Faculty of Computing, Sri Lanka Institute of Information Technology (SLIIT)  

---

## 1. Group Member Attribution & Vertical Domain Breakdown

| Student Name | Student IT Number | Assigned Vertical Domain | Git Feature Branch | Technical Domain Spec | Key Backend Files Owned | Key Mobile Files Owned | Key Web Files Owned |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M.L. Booso (Lead)** | `IT23452916` | **User Identity, Authentication & Prosumer Lifecycle** | [`feature/user-auth-lifecycle`](https://github.com/SakithLiyanage/Solvance-Smart-SolarMicrogrid-Trading-System/tree/feature/user-auth-lifecycle) | [USER_AUTH_LIFECYCLE.md](domains/USER_AUTH_LIFECYCLE.md) | `UsersController.cs`, `UserService.cs`, `AuthController.cs`, JWT handler | `LoginActivity.java`, `RegisterActivity.java` | `Login.jsx`, `ProsumerManagement.jsx` |
| **G.L.S. Chanlaka (Sakith)** | `IT23151260` | **Solar Microgrid Nodes & Station Geolocation** | [`feature/microgrid-nodes-map`](https://github.com/SakithLiyanage/Solvance-Smart-SolarMicrogrid-Trading-System/tree/feature/microgrid-nodes-map) | [MICROGRID_NODES_MAP.md](domains/MICROGRID_NODES_MAP.md) | `StationsController.cs`, `StationService.cs`, `SlotsController.cs`, `SlotService.cs` | `StationsMapActivity.java`, station selector in `CreateReservationActivity.java` | `NodeManagement.jsx` (Google Maps Explorer) |
| **L.T. Jayawardhana** | `IT23156760` | **Energy Trading Reservations & Rule Enforcement** | [`feature/reservation-rules`](https://github.com/SakithLiyanage/Solvance-Smart-SolarMicrogrid-Trading-System/tree/feature/reservation-rules) | [RESERVATION_RULES.md](domains/RESERVATION_RULES.md) | `ReservationsController.cs`, `ReservationService.cs` (7-day rule, 12h cancellation) | `CreateReservationActivity.java`, `ReservationDetailActivity.java` | `BackofficeDashboard.jsx` (Bookings overview) |
| **H.N. Madubashini** | `IT23192300` | **Grid Operator Terminal, QR Engine & Telemetry** | [`feature/operator-qr-telemetry`](https://github.com/SakithLiyanage/Solvance-Smart-SolarMicrogrid-Trading-System/tree/feature/operator-qr-telemetry) | [OPERATOR_QR_TELEMETRY.md](domains/OPERATOR_QR_TELEMETRY.md) | `/api/Reservations/verify-pass`, QR cryptographic token signing | `OperatorScannerActivity.java` (ZXing barcode reader), QR display cards | `OperatorDashboard.jsx` (Live telemetry) |
| **Collaborative / Shared** | *All Members* | **Architectural Foundation & Infrastructure** | `main` | Full System Documentation | `Program.cs`, `MongoDbContext.cs` | `DatabaseHelper.java` (SQLite Cache), `ApiClient.java` (Retrofit) | `App.jsx`, `Navbar.jsx`, `api/client.js` |

---

## 2. AI Usage & Planning Reflection (CLEAR Framework Level 2 Compliance)

In strict adherence to the SLIIT Faculty of Computing policy on Artificial Intelligence usage (**Level 2 — AI Planning**):

* **Initial Planning & Ideation**:
  - AI tools (Google Gemini / Antigravity Assistant) were utilized exclusively during the preliminary ideation and planning phase across the group.
  - Scope of AI consultation: Brainstorming decentralized solar energy trading workflows, peer-to-peer microgrid settlement dynamics, and drafting preliminary entity relationship schemas.
* **Independent Implementation & Engineering**:
  - The implementation across all tiers was developed independently by the respective group members according to their assigned vertical domain slices.
  - All enterprise business rules (7-day advance booking horizon, 12-hour notice cancellation deadband, station deactivation blockers, HMAC-SHA256 digital pass signing, and multi-tier role authorization) were custom-engineered in the central C# ASP.NET Core 8 FAT Web API.
  - No AI tools were used to bypass independent problem-solving or automate the development without critical comprehension.

---

## 3. Comprehensive Third-Party Library & Technical Citations

In accordance with assessment regulations requiring explicit citation of all third-party code, algorithms, and external libraries:

### Tier 1: Central REST API & Backend Service Layer (ASP.NET Core 8)
| Library / Framework | Official Source / Repository | License | Member Usage | Purpose in Solvance |
| :--- | :--- | :--- | :--- | :--- |
| **ASP.NET Core 8 Web API** | [Microsoft .NET Docs](https://learn.microsoft.com/en-us/aspnet/core/web-api/) | MIT | Shared | Core RESTful HTTP pipeline, dependency injection, middleware |
| **Microsoft.AspNetCore.Authentication.JwtBearer** | [Microsoft Security Docs](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/) | MIT | Luqman Booso | Stateless JWT bearer token verification & role claims evaluation |
| **MongoDB.Driver (v3.x)** | [MongoDB C# Driver](https://www.mongodb.com/docs/drivers/csharp/) | Apache 2.0 | Shared | Asynchronous CRUD queries, BSON document serialization, LINQ aggregations |
| **BCrypt.Net-Next** | [BCrypt.Net GitHub](https://github.com/BcryptNet/bcrypt.net) | MIT | Luqman Booso | Salted cryptographic password hashing for user accounts |
| **System.Security.Cryptography** | [Microsoft Cryptography](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography) | MIT | Nilakshi Madubashini | HMAC-SHA256 token signing for anti-counterfeit QR passes |

### Tier 2: Native Android Mobile Client (Java)
| Library / Framework | Official Source / Repository | License | Member Usage | Purpose in Solvance |
| :--- | :--- | :--- | :--- | :--- |
| **Google Play Services Maps SDK** | [Google Maps Android SDK](https://developers.google.com/maps/documentation/android-sdk) | Proprietary (Google) | Sakith Liyanage | Interactive map fragment, GPS pin plotting, station camera centering |
| **ZXing Android Embedded** | [JourneyApps ZXing](https://github.com/journeyapps/zxing-android-embedded) | Apache 2.0 | Nilakshi Madubashini | Camera-based barcode/QR scanning for Grid Station Operators |
| **ZXing Core** | [Google ZXing Project](https://github.com/zxing/zxing) | Apache 2.0 | Nilakshi Madubashini | QR code matrix generation for prosumer digital energy pass |
| **Square Retrofit 2** | [Square Retrofit](https://square.github.io/retrofit/) | Apache 2.0 | Shared | Type-safe HTTP networking client for ASP.NET Core API calls |
| **Square OkHttp 3 Logging Interceptor** | [Square OkHttp](https://square.github.io/okhttp/) | Apache 2.0 | Shared | Network telemetry, request header injection, bearer token handling |
| **Google Gson** | [Google Gson](https://github.com/google/gson) | Apache 2.0 | Shared | JSON serialization/deserialization between API DTOs and Java models |
| **Android SQLiteOpenHelper** | [Android Developers SQLite](https://developer.android.com/training/data-storage/sqlite) | Android Open Source | Shared | Native offline local persistence for user sessions and cached hubs |
| **OSMDroid Android** | [OSMDroid GitHub](https://github.com/osmdroid/osmdroid) | Apache 2.0 | Sakith Liyanage | Offline/open tile secondary fallback engine for presentation safety |

### Tier 3: Web Administration Console (React SPA)
| Library / Framework | Official Source / Repository | License | Member Usage | Purpose in Solvance |
| :--- | :--- | :--- | :--- | :--- |
| **React 18** | [React Docs](https://react.dev/) | MIT | Shared | Component lifecycle, responsive state hooks (`useState`, `useEffect`) |
| **Vite 5** | [Vite Build Tool](https://vitejs.dev/) | MIT | Shared | Fast frontend development server, Hot Module Replacement (HMR), production bundling |
| **Tailwind CSS** | [Tailwind CSS Docs](https://tailwindcss.com/) | MIT | Shared | Utility-first responsive styling and executive theme tokens |
| **Lucide React** | [Lucide Icons](https://lucide.dev/) | ISC | Shared | Modern vector iconography across dashboards and navigation bars |
| **Google Maps Embed API** | [Google Maps Embed](https://developers.google.com/maps/documentation/embed/) | Proprietary (Google) | Sakith Liyanage | Embedded responsive station location explorer in Node Management |

---

## 4. Academic Viva Statement & Collective Code Ownership
Every team member has engineered and thoroughly understands their designated vertical domain slice and is prepared to explain, defend, and perform live code modifications during the formal viva examination.
