# Solvance — System Architecture & Data Flow Diagrams
**Smart Solar Microgrid Trading System — Decentralized Clean Energy Network**

<p align="center">
  <img src="branding/solvance_logo_light_trans.png" alt="Solvance - Architecture" width="440"/>
</p>

---

## 1. High-Level System Architecture Diagram (FAT Service Pattern)

```mermaid
graph TD
    subgraph Client_Layer ["Client Presentation Layer (UI Interfaces Only)"]
        WebAdmin["Web Application (React + Tailwind CSS)<br/>[Backoffice Admin & Grid Operator]"]
        MobileApp["Pure Native Android Mobile App (SQLite)<br/>[Solar Prosumers & Grid Operators]"]
    end

    subgraph Central_Service ["Central Enterprise Web Service (Windows IIS)"]
        API["C# ASP.NET Core Web API (FAT Service Engine)"]
        AuthModule["Authentication & RBAC (JWT Bearer)"]
        UserSvc["User & Prosumer Management Service"]
        StationSvc["Solar Hub & Deactivation Blocker Service"]
        SlotSvc["Energy Slot Scheduling Service"]
        ResSvc["Reservation & 12h/7d Rules & QR Service"]

        API --> AuthModule
        API --> UserSvc
        API --> StationSvc
        API --> SlotSvc
        API --> ResSvc
    end

    subgraph Data_Layer ["NoSQL Persistence Layer"]
        MongoDB[("MongoDB Server (localhost:27017)")]
        C1[("User's detail")]
        C2[("SolarStationInfo")]
        C3[("EnergyBookingSlots")]
        C4[("Energy Reservation")]

        MongoDB --- C1
        MongoDB --- C2
        MongoDB --- C3
        MongoDB --- C4
    end

    WebAdmin -->|"REST API Calls (JSON)"| API
    MobileApp -->|"REST API Calls (JSON)"| API
    MobileApp <-->|"Local Cache & Offline Session"| SQLite[("Local SQLite DB")]
    API -->|"MongoDB Driver"| MongoDB
```

---

## 2. Use Case Diagram

```mermaid
graph LR
    Prosumer(("Solar Prosumer<br/>(Mobile)"))
    Operator(("Grid Operator<br/>(Web & Mobile)"))
    Backoffice(("Backoffice Officer<br/>(Web)"))

    subgraph UseCases ["System Use Cases"]
        UC1(["Register Account (NIC PK)"])
        UC2(["Book Energy Slot (7-day rule)"])
        UC3(["Modify / Cancel Booking (12h notice)"])
        UC4(["Display Transaction QR Code"])
        UC5(["View Nearby Stations on Google Maps"])
        UC6(["Scan & Verify QR Code"])
        UC7(["Update Battery Slot Availability"])
        UC8(["Approve / Deactivate Prosumers"])
        UC9(["CRUD Solar Hubs (GPS & Specs)"])
        UC10(["Deactivate Node (Active Res Blocker)"])
        UC11(["Create Staff Users (RBAC)"])
    end

    Prosumer --> UC1
    Prosumer --> UC2
    Prosumer --> UC3
    Prosumer --> UC4
    Prosumer --> UC5

    Operator --> UC6
    Operator --> UC7
    Operator --> UC3

    Backoffice --> UC8
    Backoffice --> UC9
    Backoffice --> UC10
    Backoffice --> UC11
```

---

## 3. Data Flow Diagram (DFD)

### Level 0 Context Diagram
```mermaid
graph TD
    Prosumer["Solar Prosumer"]
    Operator["Grid Operator"]
    Backoffice["Backoffice Officer"]
    System(("Smart Solar Microgrid<br/>Trading System"))

    Prosumer -->|"Registration Details (NIC), Booking Request"| System
    System -->|"Booking Confirmation, QR Code, Nearby Hubs"| Prosumer

    Operator -->|"Scanned QR Code, Battery Slot Adjustments"| System
    System -->|"Verification Results, Active Booking Monitors"| Operator

    Backoffice -->|"Hub Configurations, Prosumer Approval/Deactivation"| System
    System -->|"System Analytics, Operational Dashboards"| Backoffice
```

### Level 1 Detailed Process DFD
```mermaid
graph TD
    P1(("1.0 Authentication &<br/>User Lifecycle"))
    P2(("2.0 Solar Node &<br/>Schedule Management"))
    P3(("3.0 Power Slot<br/>Reservation Engine"))
    P4(("4.0 QR Dispatch &<br/>Operator Verification"))

    D1[("User's detail")]
    D2[("SolarStationInfo")]
    D3[("EnergyBookingSlots")]
    D4[("Energy Reservation")]

    P1 <--> D1
    P2 <--> D2
    P2 -.->|"Checks active reservations before deactivation"| D4
    P3 <--> D3
    P3 <--> D4
    P3 -.->|"Enforces 7-day schedule & 12h notice"| D4
    P4 <--> D4
    P4 -->|"Updates battery inventory"| D2
```
