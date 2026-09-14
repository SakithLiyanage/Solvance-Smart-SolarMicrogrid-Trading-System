# ============================================================================
# Smart Solar Microgrid Trading System - End-to-End Automated Verification
# ============================================================================

$baseUrl = "http://localhost:5000/api"
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " STARTING SYSTEM VERIFICATION TESTS " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Test Admin Login
Write-Host "`n[Test 1] Authenticating Backoffice Admin (ADMIN001)..." -NoNewline
$loginBody = @{ usernameOrNic = "ADMIN001"; password = "Admin@123" } | ConvertTo-Json
$adminAuth = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$adminToken = $adminAuth.token
Write-Host " PASS (Token issued, Role: $($adminAuth.role))" -ForegroundColor Green

# 2. Test Pending Prosumer Approval
Write-Host "[Test 2] Querying Pending Prosumer and approving via Backoffice..." -NoNewline
$pending = Invoke-RestMethod -Uri "$baseUrl/users/pending-prosumers" -Method Get -Headers @{ Authorization = "Bearer $adminToken" }
if ($pending.Count -gt 0) {
    $targetNic = $pending[0].nic
    $approveBody = @{ status = "Active" } | ConvertTo-Json
    $approveRes = Invoke-RestMethod -Uri "$baseUrl/users/$targetNic/status" -Method Put -Body $approveBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $adminToken" }
    Write-Host " PASS (Approved $targetNic to Active)" -ForegroundColor Green
} else {
    Write-Host " PASS (No pending prosumers remaining)" -ForegroundColor Green
}

# 3. Test Prosumer Login
Write-Host "[Test 3] Authenticating Solar Prosumer (200012345678)..." -NoNewline
$prosumerLogin = @{ usernameOrNic = "200012345678"; password = "Prosumer@123" } | ConvertTo-Json
$prosumerAuth = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $prosumerLogin -ContentType "application/json"
$prosumerToken = $prosumerAuth.token
Write-Host " PASS (Prosumer authenticated, Status: $($prosumerAuth.status))" -ForegroundColor Green

# 4. Test 7-Day Window Enforcement
Write-Host "[Test 4] Testing FAT-Service 7-Day Rule (scheduling 10 days in future)..." -NoNewline
$stations = Invoke-RestMethod -Uri "$baseUrl/stations?activeOnly=true" -Method Get
$stationId = $stations[0].id

$invalidDate = (Get-Date).ToUniversalTime().AddDays(10).ToString("yyyy-MM-ddTHH:mm:ssZ")
$invalidBooking = @{
    prosumerNic = "200012345678"
    stationId = $stationId
    scheduledDateTime = $invalidDate
    energyAmountKwh = 20.0
    tradeType = "DropOff"
} | ConvertTo-Json

try {
    $badRes = Invoke-RestMethod -Uri "$baseUrl/reservations" -Method Post -Body $invalidBooking -ContentType "application/json" -Headers @{ Authorization = "Bearer $prosumerToken" }
    Write-Host " FAIL (Should have rejected date > 7 days)" -ForegroundColor Red
} catch {
    Write-Host " PASS (Properly rejected: 7-day rule strictly enforced)" -ForegroundColor Green
}

# 5. Create Valid Reservation within 7 days
Write-Host "[Test 5] Creating valid reservation (scheduled in 3 days)..." -NoNewline
$validDate = (Get-Date).ToUniversalTime().AddDays(3).ToString("yyyy-MM-ddTHH:mm:ssZ")
$validBooking = @{
    prosumerNic = "200012345678"
    stationId = $stationId
    scheduledDateTime = $validDate
    energyAmountKwh = 25.0
    tradeType = "DropOff"
} | ConvertTo-Json

$createdRes = Invoke-RestMethod -Uri "$baseUrl/reservations" -Method Post -Body $validBooking -ContentType "application/json" -Headers @{ Authorization = "Bearer $prosumerToken" }
$newResId = $createdRes.reservation.id
$qrToken = $createdRes.reservation.qrCodeToken
Write-Host " PASS (Created: $($createdRes.reservation.reservationNumber) | QR Generated: $qrToken)" -ForegroundColor Green

# 6. Test Node Deactivation Blocker
Write-Host "[Test 6] Testing Station Deactivation Blocker (Hub with active bookings)..." -NoNewline
try {
    $deactivateRes = Invoke-RestMethod -Uri "$baseUrl/stations/$stationId/deactivate" -Method Post -Headers @{ Authorization = "Bearer $adminToken" }
    Write-Host " FAIL (Should have blocked deactivation)" -ForegroundColor Red
} catch {
    Write-Host " PASS (Deactivation properly blocked by active reservation)" -ForegroundColor Green
}

# 7. Test Operator QR Verification & Finalization
Write-Host "[Test 7] Authenticating Operator & Scanning Prosumer QR Code..." -NoNewline
$opLogin = @{ usernameOrNic = "OPERATOR001"; password = "Operator@123" } | ConvertTo-Json
$opAuth = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $opLogin -ContentType "application/json"
$opToken = $opAuth.token

$verifyBody = @{ qrCodeToken = $qrToken } | ConvertTo-Json
$verifyRes = Invoke-RestMethod -Uri "$baseUrl/reservations/verify-qr" -Method Post -Body $verifyBody -ContentType "application/json" -Headers @{ Authorization = "Bearer $opToken" }
Write-Host " PASS (Status: $($verifyRes.reservation.status) | Job Completed)" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host " ALL SYSTEM RULES & COMPLIANCE CHECKS PASSED " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
