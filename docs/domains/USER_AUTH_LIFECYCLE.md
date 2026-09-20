# Domain Specification: User Identity, Authentication & Prosumer Lifecycle

**Student Name**: Luqman Booso  
**Student IT Number**: IT23452916  
**Assigned Vertical Domain**: Domain 1 — User Identity, Authentication & Prosumer Lifecycle Management  
**Module**: SE4040 — Enterprise Application Development (SLIIT)  
**Git Feature Branch**: `feature/user-auth-lifecycle`  

---

## 1. Domain Architecture & Responsibilities

The User Identity & Authentication subsystem manages the onboarding, cryptographic verification, security token issuance, and account lifecycle state transitions for all actors in the Solvance Smart Solar Microgrid ecosystem (Administrators, Prosumers, and Station Operators).

```
   +-------------------+        +--------------------+        +---------------------+
   | Android Prosumer  |        | Backoffice / Staff |        | Central FAT Web API |
   | Login & Register  |        | React Admin Portal |        | ASP.NET Core 8      |
   +---------+---------+        +---------+----------+        +----------+----------+
             |                            |                              |
             | POST /api/Auth/register    |                              |
             +----------------------------+----------------------------->|
             |                            |                              | [Validate NIC]
             |                            |                              | [Hash BCrypt]
             |                            |                              | [Save Pending]
             |                            | GET /api/Users?status=Pending|
             |                            |<-----------------------------+
             |                            | PUT /api/Users/{id}/status   |
             |                            +----------------------------->|
             |                            |                              | [Approve Account]
             | POST /api/Auth/login       |                              |
             +----------------------------+----------------------------->|
             |<---------------------------+------------------------------+
             | [JWT Token (Role Claims)]  |                              |
```

---

## 2. Core Components & File Mapping

### Backend Service & REST Controllers (ASP.NET Core 8)
- `backend/Controllers/AuthController.cs`: Endpoints for user registration (`/api/Auth/register`) and credential authentication (`/api/Auth/login`).
- `backend/Controllers/UsersController.cs`: CRUD and lifecycle endpoints (`/api/Users`, `/api/Users/{id}`, `/api/Users/{id}/status`).
- `backend/Services/UserService.cs`: Business logic layer handling BCrypt password hashing, NIC regex validation, and MongoDB CRUD operations.
- `backend/Models/User.cs`: Entity definition for prosumers, operators, and administrators with role-based access attributes and account statuses.
- `backend/Models/Dtos.cs`: Data Transfer Objects for registration (`RegisterDto`), authentication (`LoginDto`), and user state changes (`UserStatusUpdateDto`).

### Mobile Client (Android Java)
- `mobile-client/app/src/main/java/com/ead/solarmicrogrid/ui/auth/LoginActivity.java`: Executive login interface with email/password authentication, JWT storage, and role redirection.
- `mobile-client/app/src/main/java/com/ead/solarmicrogrid/ui/auth/RegisterActivity.java`: Prosumer registration screen with Sri Lankan National Identity Card (NIC) verification.
- `mobile-client/app/src/main/java/com/ead/solarmicrogrid/data/local/DatabaseHelper.java`: Local SQLite session and user credential cache.

### Web Management Client (React Vite)
- `web-client/src/pages/Login.jsx`: Administrative staff and backoffice authentication portal with responsive dark/light themes.
- `web-client/src/pages/ProsumerManagement.jsx`: Administrative dashboard for reviewing pending prosumer registrations, approving accounts, or deactivating accounts.
- `web-client/src/context/AuthContext.jsx`: Client-side JWT persistence and role-based route guard middleware.

---

## 3. Business Rules & Technical Constraints

1. **National Identity Card (NIC) Validation**:
   - Must strictly match Sri Lankan National Identity Card formats:
     - Old format: 9 numeric digits followed by 'V' or 'X' (e.g., `123456789V`).
     - New format: Exactly 12 numeric digits (e.g., `200012345678`).
   - Rejects non-compliant entries with HTTP 400 Bad Request.

2. **Cryptographic Password Storage**:
   - Passwords must never be stored in plaintext.
   - Salted hashing via `BCrypt.Net-Next` with default work factor (11 salt rounds).

3. **Stateless JWT Bearer Authentication**:
   - Tokens signed with HMAC-SHA256 utilizing a 256-bit secret key.
   - Claims include `nameid` (User ID), `email`, `role` (`Prosumer`, `Operator`, `Backoffice`, `Administrator`), and expiration timestamp (24-hour TTL).

4. **Prosumer Account Approval Lifecycle**:
   - Newly registered prosumers start in `Pending` state.
   - Prosumers in `Pending` or `Deactivated` status are barred from creating energy reservations or trading slots until approved by Backoffice staff.

---

## 4. Verification Matrix

| Test ID | Test Description | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| AUTH-01 | Register with valid 9V NIC format | HTTP 201 Created, Account set to `Pending` | PASS |
| AUTH-02 | Register with invalid NIC string | HTTP 400 Bad Request ("Invalid Sri Lankan NIC") | PASS |
| AUTH-03 | Login with valid credentials (Approved) | HTTP 200 OK with signed JWT Bearer token | PASS |
| AUTH-04 | Login with incorrect password | HTTP 401 Unauthorized | PASS |
| AUTH-05 | Backoffice approve pending prosumer | Prosumer status transitions from `Pending` to `Active` | PASS |
| AUTH-06 | Deactivate user account | Status updated to `Deactivated`, active sessions terminated | PASS |
