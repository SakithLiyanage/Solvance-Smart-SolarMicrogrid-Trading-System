# Domain Specification: Grid Operator Terminal, QR Engine & Telemetry

**Student Name**: H.N. Madubashini (Nilakshi Madubashini)  
**Student IT Number**: IT23192300  
**Assigned Vertical Domain**: Domain 4 — Grid Operator Terminal, QR Code Engine & Telemetry Console  
**Module**: SE4040 — Enterprise Application Development (SLIIT)  
**Git Feature Branch**: `feature/operator-qr-telemetry`  

---

## 1. Domain Architecture & Responsibilities

The Grid Operator Terminal and Telemetry subsystem facilitates physical handoffs and on-site energy transfers at Solar Microgrid Stations. It provides camera-based optical barcode scanning, cryptographic QR digital pass verification, real-time power dispatch telemetry, and automated battery slot inventory state synchronization.

```
   +--------------------+        +--------------------+        +---------------------+
   | Android Operator   |        | Grid Operator Web  |        | Central FAT Web API |
   | Camera Scanner     |        | Telemetry Console  |        | ASP.NET Core 8      |
   +---------+----------+        +---------+----------+        +----------+----------+
             |                             |                              |
             | [Scan QR Pass]              |                              |
             | POST /api/Reservations/     |                              |
             |       verify-pass           |                              |
             +-----------------------------+----------------------------->|
             |                             |                              | [Validate Cryptographic Hash]
             |                             |                              | [Check Status is Approved]
             |                             |                              | [Set Status = Completed]
             |                             |                              | [Free Energy Slot]
             |<----------------------------+------------------------------+
             | [HTTP 200: Verified]        |                              |
             |                             | GET /api/Stations/telemetry  |
             |                             +----------------------------->|
             |                             |<-----------------------------+
             |                             | [Render Real-Time KPI Cards] |
```

---

## 2. Core Components & File Mapping

### Backend Service & REST Controllers (ASP.NET Core 8)
- `backend/Controllers/ReservationsController.cs`: Verification endpoint (`POST /api/Reservations/verify-pass`).
- `backend/Services/ReservationService.cs`: Business logic for verifying cryptographic QR tokens, confirming active booking validity, and transitioning reservations to `Completed`.
- `backend/Services/StationService.cs`: Real-time telemetry aggregator compiling solar generation, battery storage state, and grid feed-in rates.

### Mobile Client (Android Java)
- `mobile-client/app/src/main/java/com/ead/solarmicrogrid/ui/operator/OperatorScannerActivity.java`: Camera-based ZXing barcode reader with automated laser line animation, camera torch flash toggle, and real-time verification status dialog.
- `mobile-client/app/src/main/java/com/ead/solarmicrogrid/ui/prosumer/ReservationDetailActivity.java`: Dynamic QR code generator rendering 512x512 bitmap passes using Google ZXing Core with high error correction (ECC Level H).
- `mobile-client/app/src/main/res/layout/activity_operator_scanner.xml`: Fullscreen viewfinder overlay with camera permission guards.

### Web Management Client (React Vite)
- `web-client/src/pages/OperatorDashboard.jsx`: Real-time Grid Operator telemetry console featuring power generation KPI metrics, battery slot capacity meters, and physical energy transfer verification ledger.

---

## 3. Business Rules & Technical Constraints

1. **Cryptographic Digital Pass Integrity**:
   - Prosumer digital energy passes are formatted as structured cryptographic payloads:  
     `SOLAR-TX:{ReservationId}:{SlotId}:{Timestamp}`
   - The central API validates that the reservation exists, belongs to the targeted station, and is currently in `Approved` status.

2. **Energy Handshake State Synchronization**:
   - Once verified, the reservation status atomically transitions to `Completed`.
   - The associated `EnergySlot` status transitions from `Occupied` / `Reserved` to `Available`, allowing immediate reallocation for upcoming prosumers.

3. **ZXing Optical Scanning Engine**:
   - Built on `com.journeyapps:zxing-android-embedded:4.3.0` and `com.google.zxing:core:3.5.3`.
   - Incorporates continuous autofocus, beep feedback on scan, and torch illumination for low-light solar hub night operations.

---

## 4. Verification Matrix

| Test ID | Test Description | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| OPER-01 | Prosumer generates QR digital pass | 512x512 high-contrast bitmap rendered with `SOLAR-TX` payload | PASS |
| OPER-02 | Operator scans valid approved QR pass | HTTP 200 OK, Booking marked `Completed`, Slot freed | PASS |
| OPER-03 | Operator scans expired or cancelled pass | HTTP 400 Bad Request ("Reservation is not in Approved state") | PASS |
| OPER-04 | Operator scans tampered or invalid QR | HTTP 400 Bad Request ("Invalid QR format or reservation ID") | PASS |
| OPER-05 | Camera torch toggle in dark conditions | Device camera flash activates/deactivates instantly | PASS |
| OPER-06 | Web Operator Dashboard telemetry update | KPI cards display live energy transfer rates and active capacity | PASS |
