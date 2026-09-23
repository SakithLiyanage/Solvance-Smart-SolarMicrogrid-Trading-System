$loginBody = @{ usernameOrNic = 'OPERATOR001'; password = 'Operator@123' } | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/login' -Method Post -Body $loginBody -ContentType 'application/json'
$token = $loginRes.token
Write-Host "Token obtained: $($token.Substring(0, 15))... Role: $($loginRes.role)"

$headers = @{ Authorization = "Bearer $token" }

Write-Host "`n[1] Fetching all reservations via GET /api/reservations..."
$res = Invoke-RestMethod -Uri 'http://localhost:5000/api/reservations' -Headers $headers -Method Get
Write-Host "SUCCESS! Reservations count: $($res.Count)"
if ($res.Count -gt 0) {
    Write-Host "First reservation: $($res[0].reservationNumber) | stationId: $($res[0].stationId) | status: $($res[0].status)"
}

Write-Host "`n[2] Fetching stations via GET /api/stations..."
$stations = Invoke-RestMethod -Uri 'http://localhost:5000/api/stations' -Headers $headers -Method Get
Write-Host "SUCCESS! Stations count: $($stations.Count)"
Write-Host "First station: $($stations[0].stationCode) - $($stations[0].name) | ID: $($stations[0].id) | Available slots: $($stations[0].availableBatterySlots)/$($stations[0].totalBatterySlots)"

Write-Host "`n[3] Fetching dashboard stats via GET /api/reservations/dashboard-stats..."
$stats = Invoke-RestMethod -Uri 'http://localhost:5000/api/reservations/dashboard-stats' -Headers $headers -Method Get
Write-Host "SUCCESS! Active bookings: $($stats.activeBookingsCount), Pending: $($stats.pendingBookingsCount), Completed: $($stats.totalCompletedBookingsCount), Stations: $($stats.totalStationsCount)"

Write-Host "`n[4] Testing PATCH /api/stations/:id/battery-slots..."
$targetStationId = $stations[0].id
$patchBody = @{ availableSlots = 14 } | ConvertTo-Json
$patchRes = Invoke-RestMethod -Uri "http://localhost:5000/api/stations/$targetStationId/battery-slots" -Headers $headers -Method Patch -Body $patchBody -ContentType 'application/json'
Write-Host "SUCCESS! Updated available slots to: $($patchRes.availableBatterySlots)"
