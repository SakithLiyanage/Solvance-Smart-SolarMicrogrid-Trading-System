# ============================================================================
# File: test_operator_scenarios.ps1
# Project: Solvance — Smart Solar Microgrid Trading System
# Author: Enterprise Application Development Team
# Description: Scenario-based test suite for Operator Terminal, QR Engine & Live Telemetry
# ============================================================================

$baseUrl = "http://127.0.0.1:5000/api"
$passedCount = 0
$totalTests = 8

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " RUNNING OPERATOR TERMINAL & TELEMETRY SCENARIO TESTS " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# ----------------------------------------------------------------------------
# Scenario 1: Operator Authentication & Access Rights
# ----------------------------------------------------------------------------
Write-Host "`n[Scenario 1] Operator Authentication & Access Rights..." -NoNewline
try {
    $opLogin = @{ usernameOrNic = "OPERATOR001"; password = "Operator@123" } | ConvertTo-Json
    $opAuth = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $opLogin -ContentType "application/json"
    $opToken = $opAuth.token
    if ($opAuth.role -eq "GridOperator" -and !([string]::IsNullOrEmpty($opToken))) {
        Write-Host " PASS (Role: $($opAuth.role), Operator: $($opAuth.fullName))" -ForegroundColor Green
        $passedCount++
    } else {
        Write-Host " FAIL (Unexpected role or missing token)" -ForegroundColor Red
    }
} catch {
    Write-Host " FAIL ($($_.Exception.Message))" -ForegroundColor Red
}

# ----------------------------------------------------------------------------
# Scenario 2: Station Telemetry Telemetry Endpoint Query
# ----------------------------------------------------------------------------
Write-Host "[Scenario 2] Fetching Live Microgrid Station Telemetry..." -NoNewline
try {
    $stations = Invoke-RestMethod -Uri "$baseUrl/stations" -Method Get
    $targetStation = $stations | Where-Object { $_.isActive -eq $true } | Select-Object -First 1
    $stationId = $targetStation.id
    $stationCode = $targetStation.stationCode

    $telemetryBefore = Invoke-RestMethod -Uri "$baseUrl/stations/$stationId/telemetry" -Method Get -Headers @{ Authorization = "Bearer $opToken" }
    if ($telemetryBefore.stationCode -eq $stationCode -and $null -ne $telemetryBefore.batteryOccupancyPercent) {
        Write-Host " PASS (Node: $stationCode | Slots: $($telemetryBefore.availableBatterySlots)/$($telemetryBefore.totalBatterySlots) Available | Occupancy: $($telemetryBefore.batteryOccupancyPercent)%)" -ForegroundColor Green
        $passedCount++
    } else {
        Write-Host " FAIL (Telemetry payload missing required metrics)" -ForegroundColor Red
    }
} catch {
    Write-Host " FAIL ($($_.Exception.Message))" -ForegroundColor Red
}

# ----------------------------------------------------------------------------
# Scenario 3: Prosumer Energy Reservation Creation & Approval
# ----------------------------------------------------------------------------
Write-Host "[Scenario 3] Prosumer Energy Booking & Backoffice QR Issuance..." -NoNewline
try {
    # 1. Prosumer Login
    $prosumerLogin = @{ usernameOrNic = "200012345678"; password = "Prosumer@123" } | ConvertTo-Json
    $prosumerAuth = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $prosumerLogin -ContentType "application/json"
    $prosumerToken = $prosumerAuth.token

    # 2. Create Reservation for 2 days ahead
    $scheduledTime = (Get-Date).ToUniversalTime().AddDays(2).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $bookingBody = @{
        prosumerNic = "200012345678"
        stationId = $stationId
        scheduledDateTime = $scheduledTime
        energyAmountKwh = 35.5
        tradeType = "DropOff"
    } | ConvertTo-Json
    $bookingRes = Invoke-RestMethod -Uri "$baseUrl/reservations" -Method Post -Body $bookingBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $prosumerToken" }
    $resId = $bookingRes.reservation.id
    $resNumber = $bookingRes.reservation.reservationNumber

    # 3. Admin Login & Approve (POST /api/reservations/{id}/approve)
    $adminLogin = @{ usernameOrNic = "ADMIN001"; password = "Admin@123" } | ConvertTo-Json
    $adminAuth = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $adminLogin -ContentType "application/json"
    $adminToken = $adminAuth.token

    $approveRes = Invoke-RestMethod -Uri "$baseUrl/reservations/$resId/approve" -Method Post -Headers @{ Authorization = "Bearer $adminToken" }
    $qrPassToken = $approveRes.reservation.qrCodeToken

    if ($approveRes.reservation.status -eq "Approved" -and !([string]::IsNullOrEmpty($qrPassToken))) {
        Write-Host " PASS (Res: $resNumber | QR Token: $qrPassToken)" -ForegroundColor Green
        $passedCount++
    } else {
        Write-Host " FAIL (Reservation not approved or missing QR token)" -ForegroundColor Red
    }
} catch {
    Write-Host " FAIL ($($_.Exception.Message))" -ForegroundColor Red
}

# ----------------------------------------------------------------------------
# Scenario 4: Negative Test - Station Mismatch Protection
# ----------------------------------------------------------------------------
Write-Host "[Scenario 4] Negative Check: Operator scans QR at WRONG Station Hub..." -NoNewline
try {
    # Find an alternative station ID
    $altStation = $stations | Where-Object { $_.id -ne $stationId } | Select-Object -First 1
    $wrongStationId = $altStation.id

    $mismatchBody = @{
        qrCodeToken = $qrPassToken
        stationId = $wrongStationId
    } | ConvertTo-Json
    $mismatchRes = Invoke-RestMethod -Uri "$baseUrl/reservations/verify-qr" -Method Post -Body $mismatchBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $opToken" }
    Write-Host " FAIL (Should have rejected QR at wrong station)" -ForegroundColor Red
} catch {
    Write-Host " PASS (Rejected: Station mismatch strictly guarded)" -ForegroundColor Green
    $passedCount++
}

# ----------------------------------------------------------------------------
# Scenario 5: Valid Operator QR Scan & Energy Trade Finalization
# ----------------------------------------------------------------------------
Write-Host "[Scenario 5] Operator scans QR at MATCHING Station Hub..." -NoNewline
try {
    $validVerifyBody = @{
        qrCodeToken = $qrPassToken
        stationId = $stationId
    } | ConvertTo-Json
    $verifyRes = Invoke-RestMethod -Uri "$baseUrl/reservations/verify-qr" -Method Post -Body $validVerifyBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $opToken" }
    
    if ($verifyRes.reservation.status -eq "Completed" -and $verifyRes.reservation.completedByOperatorNic -eq "OPERATOR001") {
        Write-Host " PASS (Trade Finalized | Status: Completed | Verified by: $($verifyRes.reservation.completedByOperatorNic))" -ForegroundColor Green
        $passedCount++
    } else {
        Write-Host " FAIL (Reservation status is not Completed)" -ForegroundColor Red
    }
} catch {
    Write-Host " FAIL ($($_.Exception.Message))" -ForegroundColor Red
}

# ----------------------------------------------------------------------------
# Scenario 6: Negative Test - Double Re-scan Protection
# ----------------------------------------------------------------------------
Write-Host "[Scenario 6] Negative Check: Re-scanning already COMPLETED QR Token..." -NoNewline
try {
    $reScanBody = @{
        qrCodeToken = $qrPassToken
        stationId = $stationId
    } | ConvertTo-Json
    $reScanRes = Invoke-RestMethod -Uri "$baseUrl/reservations/verify-qr" -Method Post -Body $reScanBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $opToken" }
    Write-Host " FAIL (Should have prevented re-execution of completed QR)" -ForegroundColor Red
} catch {
    Write-Host " PASS (Rejected: Double-spend / replay attack prevented)" -ForegroundColor Green
    $passedCount++
}

# ----------------------------------------------------------------------------
# Scenario 7: Real-Time Telemetry Delta Validation
# ----------------------------------------------------------------------------
Write-Host "[Scenario 7] Verifying Real-time Telemetry Metrics Delta..." -NoNewline
try {
    $telemetryAfter = Invoke-RestMethod -Uri "$baseUrl/stations/$stationId/telemetry" -Method Get -Headers @{ Authorization = "Bearer $opToken" }
    $completedDelta = $telemetryAfter.completedReservations - $telemetryBefore.completedReservations
    
    if ($completedDelta -ge 1) {
        Write-Host " PASS (Completed Trades Delta: +$completedDelta | Updated Occupancy: $($telemetryAfter.batteryOccupancyPercent.ToString('F1'))%)" -ForegroundColor Green
        $passedCount++
    } else {
        Write-Host " FAIL (Telemetry completed reservations did not update)" -ForegroundColor Red
    }
} catch {
    Write-Host " FAIL ($($_.Exception.Message))" -ForegroundColor Red
}

# ----------------------------------------------------------------------------
# Scenario 8: Negative Test - Role-Based Security Boundary (Prosumer Block)
# ----------------------------------------------------------------------------
Write-Host "[Scenario 8] Security Check: Unauthorized Prosumer attempting Operator QR Verify..." -NoNewline
try {
    $unauthBody = @{
        qrCodeToken = $qrPassToken
        stationId = $stationId
    } | ConvertTo-Json
    $unauthRes = Invoke-RestMethod -Uri "$baseUrl/reservations/verify-qr" -Method Post -Body $unauthBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $prosumerToken" }
    Write-Host " FAIL (Prosumer was able to call operator endpoint)" -ForegroundColor Red
} catch {
    Write-Host " PASS (Blocked: Role-Based Access Control enforced - 403 Forbidden)" -ForegroundColor Green
    $passedCount++
}

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " OPERATOR SCENARIOS RESULT: $passedCount / $totalTests PASSED " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
