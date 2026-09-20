# Domain Specification: Solar Microgrid Nodes & Station Geolocation

**Student Name**: Sakith Chanlaka (Sakith Liyanage)  
**Student IT Number**: IT23151260  
**Assigned Vertical Domain**: Domain 2 — Solar Microgrid Nodes, Stations & Geolocation Maps  
**Module**: SE4040 — Enterprise Application Development (SLIIT)  
**Git Feature Branch**: `feature/microgrid-nodes-map`  

---

## 1. Domain Architecture & Responsibilities

The Solar Microgrid Nodes subsystem governs the physical network infrastructure of Solvance. It provides full lifecycle management of Solar Hub Stations, battery slot inventory indexing, geolocation rendering via Google Maps SDK, and business-rule validation safeguarding against inadvertent station deactivations.

```
   +-------------------+        +--------------------+        +---------------------+
   | Android Prosumer  |        | Backoffice / Staff |        | Central FAT Web API |
   | Map Explorer      |        | Node Management    |        | ASP.NET Core 8      |
   +---------+---------+        +---------+----------+        +----------+----------+
             |                            |                              |
             | GET /api/Stations          |                              |
             +----------------------------+----------------------------->|
             |<---------------------------+------------------------------+
             | [Render Google Maps Pins]  |                              |
             |                            | POST /api/Stations           |
             |                            +----------------------------->|
             |                            |                              | [Create Station Hub]
             |                            |                              | [Init Energy Slots]
             |                            | PUT /api/Stations/{id}       |
             |                            +----------------------------->|
             |                            |                              | [Check Active Bookings]
             |                            |                              | [Deactivation Blocker]
             |                            |<-----------------------------+
             |                            | [HTTP 400 if Bookings Exist] |
```

---

## 2. Core Components & File Mapping

### Backend Service & REST Controllers (ASP.NET Core 8)
- `backend/Controllers/StationsController.cs`: REST endpoints for Solar Station Hubs (`GET /api/Stations`, `POST /api/Stations`, `PUT /api/Stations/{id}`, `DELETE /api/Stations/{id}`).
- `backend/Controllers/SlotsController.cs`: Endpoints for energy slot query and status management (`GET /api/Slots/station/{id}`, `PUT /api/Slots/{id}/status`).
- `backend/Services/StationService.cs`: Business logic enforcing station capacity boundaries, coordinates, and active reservation validation blockers.
- `backend/Services/SlotService.cs`: Automated initialization of battery storage slots and real-time availability tracking.
- `backend/Models/SolarStation.cs`: Domain entity for microgrid hubs (Name, Location, Coordinates, TotalSlots, ActiveStatus).
- `backend/Models/EnergySlot.cs`: Domain entity for physical charging/discharging ports (SlotNumber, SlotType, Status, CurrentPowerKw).

### Mobile Client (Android Java)
- `mobile-client/app/src/main/java/com/ead/solarmicrogrid/ui/prosumer/StationsMapActivity.java`: Interactive Google Maps Android SDK fragment displaying microgrid stations, custom GPS markers, live slot availability badges, and bottom-sheet hub inspection.
- `mobile-client/app/src/main/res/layout/activity_stations_map.xml`: Responsive map layout with executive search bar, station card overlay, and GPS re-centering FAB.

### Web Management Client (React Vite)
- `web-client/src/pages/NodeManagement.jsx`: Station node administration console featuring interactive Google Maps JavaScript API Explorer, battery slot capacity manager, and real-time station deactivation blocker alerts.
- `web-client/src/components/Navbar.jsx`: Navigation routes linking directly to Node Management.

---

## 3. Business Rules & Technical Constraints

1. **Station Deactivation Blocker**:
   - A Solar Hub Station cannot be deactivated or deleted if there are any active, approved, or pending reservations scheduled for that station.
   - Central API returns HTTP 400 Bad Request with explicit violation details: `"Cannot deactivate station with active reservations"`.

2. **Google Maps Geolocation Rendering**:
   - Web console integrates `@googlemaps/js-api-loader` to render vectorized maps with custom SVG solar markers, info popups, and click-to-select hub telemetry.
   - Android client utilizes Google Play Services Maps SDK v2 with camera animations, cluster bounds, and custom marker icons.

3. **Battery Slot Capacity & Indexing**:
   - When a station is provisioned with `N` slots, the system automatically initializes `N` sequential `EnergySlot` records linked by `StationId`.
   - Energy slots track states: `Available`, `Reserved`, `Occupied`, `Maintenance`.

---

## 4. Verification Matrix

| Test ID | Test Description | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| NODE-01 | Create Solar Station with 10 slots | HTTP 201 Created, 10 slots initialized automatically | PASS |
| NODE-02 | Attempt deactivating station with active booking | HTTP 400 Bad Request blocked by business rule | PASS |
| NODE-03 | Deactivate station with zero bookings | HTTP 200 OK, Station `IsActive` set to `false` | PASS |
| NODE-04 | Render Google Maps on Web Management | Map canvas initializes with satellite/terrain controls & pins | PASS |
| NODE-05 | Render Google Maps on Android device | Maps fragment loads pins, click opens bottom sheet details | PASS |
| NODE-06 | Slot status transition to Maintenance | Slot marked `Maintenance`, excluded from booking selector | PASS |
