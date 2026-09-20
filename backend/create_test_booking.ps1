$auth = Invoke-RestMethod -Uri 'http://localhost:5000/api/auth/login' -Method Post -Body (@{ usernameOrNic = '200012345678'; password = 'Prosumer@123' } | ConvertTo-Json) -ContentType 'application/json'
$stations = Invoke-RestMethod -Uri 'http://localhost:5000/api/stations'
$sched = (Get-Date).ToUniversalTime().AddDays(2).ToString('yyyy-MM-ddTHH:mm:ssZ')
$body = @{ prosumerNic = '200012345678'; stationId = $stations[0].id; scheduledDateTime = $sched; energyAmountKwh = 15.5; tradeType = 'DropOff' } | ConvertTo-Json
$res = Invoke-RestMethod -Uri 'http://localhost:5000/api/reservations' -Method Post -Headers @{ Authorization = "Bearer $($auth.token)" } -Body $body -ContentType 'application/json'
Write-Host "Created test Approved booking: $($res.reservation.reservationNumber) | Token: $($res.reservation.qrCodeToken)"
