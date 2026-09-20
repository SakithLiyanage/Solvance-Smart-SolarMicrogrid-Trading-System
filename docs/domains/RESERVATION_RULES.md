# Domain Specification: Energy Trading Reservations & Rule Enforcement

**Student Name**: L.T. Jayawardhana (Lahiru Jayawardhana)  
**Student IT Number**: IT23156760  
**Assigned Vertical Domain**: Domain 3 — Energy Trading Reservations & Rule Enforcement Engine  
**Module**: SE4040 — Enterprise Application Development (SLIIT)  
**Git Feature Branch**: `feature/reservation-rules`  

---

## 1. Domain Architecture & Responsibilities

The Energy Trading Reservations subsystem coordinates all bilateral energy scheduling transactions between Prosumers and Solar Hub Stations. It enforces strict time-boundary policies, schedule conflict arbitration, slot allocation locks, and multi-tier approval state machines.

```
   +-------------------+        +--------------------+        +---------------------+
   | Android Prosumer  |        | Backoffice / Staff |        | Central FAT Web API |
   | Create & View     |        | Bookings Ledger    |        | ASP.NET Core 8      |
   +---------+---------+        +---------+----------+        +----------+----------+
             |                            |                              |
             | POST /api/Reservations     |                              |
             +----------------------------+----------------------------->|
             |                            |                              | [Validate 7-Day Window]
             |                            |                              | [Check Slot Availability]
             |                            |                              | [Save Pending Booking]
             |<---------------------------+------------------------------+
             | [HTTP 201 Created]         |                              |
             |                            | GET /api/Reservations        |
             |                            +----------------------------->|
             |                            |<-----------------------------+
             |                            | [Render Bookings Table]      |
             | PUT /api/Reservations/cancel                              |
             +----------------------------+----------------------------->|
             |                            |                              | [Validate 12h Notice]
             |                            |                              | [Cancel or Reject 400]
```

---

## 2. Core Components & File Mapping

### Backend Service & REST Controllers (ASP.NET Core 8)
- `backend/Controllers/ReservationsController.cs`: REST endpoints for booking lifecycle (`GET /api/Reservations`, `POST /api/Reservations`, `PUT /api/Reservations/{id}/cancel`, `GET /api/Reservations/user/{userId}`, `GET /api/Reservations/station/{stationId}`).
- `backend/Services/ReservationService.cs`: Core rule enforcement engine evaluating 7-day advance booking horizons, 12-hour cancellation notice windows, and slot locks.
- `backend/Models/EnergyReservation.cs`: Domain entity for reservations (ReservationCode, UserId, StationId, SlotId, StartTime, EndTime, Status, EnergyAmountKwh).
- `backend/Models/Dtos.cs`: Data Transfer Objects for booking requests (`CreateReservationDto`) and status transitions (`ReservationStatusDto`).

### Mobile Client (Android Java)
- `mobile-client/app/src/main/java/com/ead/solarmicrogrid/ui/prosumer/CreateReservationActivity.java`: Energy reservation booking screen with station dropdown, slot selector, date/time pickers enforcing the 7-day horizon limit.
- `mobile-client/app/src/main/java/com/ead/solarmicrogrid/ui/prosumer/ReservationDetailActivity.java`: Booking inspection dialog displaying booking status chips, time left countdown, and 12-hour notice cancellation enforcement.
- `mobile-client/app/src/main/java/com/ead/solarmicrogrid/ui/prosumer/ProsumerDashboardActivity.java`: Prosumer summary dashboard aggregating active, pending, and past reservations.

### Web Management Client (React Vite)
- `web-client/src/pages/BackofficeDashboard.jsx`: Central bookings ledger providing comprehensive status filters (`Pending`, `Approved`, `Completed`, `Cancelled`), energy volume summaries, and manual dispute resolution.

---

## 3. Business Rules & Technical Constraints

1. **7-Day Advance Scheduling Horizon**:
   - Prosumers can only reserve energy slots up to 7 calendar days into the future from the current UTC timestamp.
   - Any booking attempted with `StartTime > DateTime.UtcNow.AddDays(7)` or `StartTime < DateTime.UtcNow` is rejected with HTTP 400: `"Reservations can only be made up to 7 days in advance"`.

2. **12-Hour Cancellation Notice Deadband**:
   - A prosumer can cancel an approved or pending reservation only if there are at least 12 hours remaining before the scheduled `StartTime`.
   - Any cancellation request within the 12-hour window (`StartTime - DateTime.UtcNow < TimeSpan.FromHours(12)`) is rejected with HTTP 400: `"Reservations cannot be cancelled less than 12 hours before start time"`.

3. **Atomic Slot State Synchronization**:
   - Upon successful reservation creation, the assigned `EnergySlot` status transitions from `Available` to `Reserved`.
   - If the reservation is cancelled, the assigned `EnergySlot` is atomically returned to `Available`.

---

## 4. Verification Matrix

| Test ID | Test Description | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| RES-01 | Create reservation within 3 days | HTTP 201 Created, Slot locked as `Reserved` | PASS |
| RES-02 | Attempt reservation 8 days in advance | HTTP 400 Bad Request ("Cannot book beyond 7 days") | PASS |
| RES-03 | Attempt reservation in past date/time | HTTP 400 Bad Request ("Start time must be in future") | PASS |
| RES-04 | Cancel reservation 24 hours prior | HTTP 200 OK, Status set to `Cancelled`, slot released | PASS |
| RES-05 | Cancel reservation 4 hours prior | HTTP 400 Bad Request ("Less than 12 hours notice") | PASS |
| RES-06 | Filter bookings by status on Web | Backoffice ledger correctly filters by `Approved` / `Pending` | PASS |
