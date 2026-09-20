# ============================================================================
# Script: package_submission.ps1
# Project: Solvance - Smart Solar Microgrid Trading System
# Description: Packages project directories, report, and opening screenshot into student submission zip.
# ============================================================================

param(
    [string]$StudentItNumber = "IT21000001"
)

$rootDir = $PSScriptRoot
$zipFileName = "$StudentItNumber.zip"
$zipFilePath = Join-Path $rootDir $zipFileName
$tempPackageDir = Join-Path $rootDir "temp_submission_package"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " PACKAGING PROJECT SUBMISSION ARCHIVE: $zipFileName" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Clean previous build artifacts and temporary files
if (Test-Path $zipFilePath) {
    Remove-Item $zipFilePath -Force
    Write-Host "[1/5] Removed previous submission zip." -ForegroundColor Gray
}

if (Test-Path $tempPackageDir) {
    Remove-Item $tempPackageDir -Recurse -Force
}
New-Item -ItemType Directory -Path $tempPackageDir | Out-Null

# 2. Copy source code folders (excluding bin, obj, node_modules)
Write-Host "[2/5] Staging backend (C# Web API)..." -ForegroundColor Green
$backendDest = Join-Path $tempPackageDir "backend"
robocopy (Join-Path $rootDir "backend") $backendDest /E /XD bin obj .vs /NFL /NDL /NJH /NJS | Out-Null

Write-Host "[3/5] Staging web-client (React + Tailwind)..." -ForegroundColor Green
$webDest = Join-Path $tempPackageDir "web-client"
robocopy (Join-Path $rootDir "web-client") $webDest /E /XD node_modules .vite /NFL /NDL /NJH /NJS | Out-Null

Write-Host "[4/5] Staging mobile-client (Pure Android + SQLite)..." -ForegroundColor Green
$mobileDest = Join-Path $tempPackageDir "mobile-client"
robocopy (Join-Path $rootDir "mobile-client") $mobileDest /E /XD .gradle build .idea /NFL /NDL /NJH /NJS | Out-Null

Write-Host "[5/5] Staging docs, report and primary screenshot..." -ForegroundColor Green
$docsDest = Join-Path $tempPackageDir "docs"
robocopy (Join-Path $rootDir "docs") $docsDest /E /NFL /NDL /NJH /NJS | Out-Null

# Primary opening screenshot per page 4 requirement
Copy-Item (Join-Path $rootDir "docs\screenshots\login_dark_mode.png") (Join-Path $rootDir "main_opening_screen.png") -Force
Copy-Item (Join-Path $rootDir "main_opening_screen.png") (Join-Path $tempPackageDir "main_opening_screen.png") -Force

# Create Zip Archive
Compress-Archive -Path "$tempPackageDir\*" -DestinationPath $zipFilePath -CompressionLevel Optimal
Remove-Item $tempPackageDir -Recurse -Force

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " SUBMISSION ARCHIVE CREATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host " Archive: $zipFilePath" -ForegroundColor White
Write-Host " Opening Screen: $(Join-Path $rootDir 'main_opening_screen.png')" -ForegroundColor White
Write-Host " Size: $((Get-Item $zipFilePath).Length / 1MB | ForEach-Object { '{0:N2} MB' -f $_ })" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
