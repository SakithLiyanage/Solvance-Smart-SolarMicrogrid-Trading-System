@echo off
title Solvance Mobile Connection Helper
echo ============================================================
echo  SOLVANCE - SOLID MOBILE TO BACKEND CONNECTION TOOL
echo ============================================================
echo.
echo [1/3] Verifying ADB connection to physical device...
adb devices
echo.
echo [2/3] Enabling USB Reverse Port Forwarding (Port 5000)...
adb reverse tcp:5000 tcp:5000
echo.
echo [3/3] Current Host IPv4 Addresses on LAN:
ipconfig | findstr /i "IPv4"
echo.
echo ============================================================
echo SUCCESS:
echo - Via USB Cable: Mobile connects directly to 127.0.0.1:5000
echo - Via Wi-Fi LAN: Mobile connects directly to 192.168.1.105:5000
echo - In Mobile App: Long-press Solvance logo on Login to switch URL
echo ============================================================
timeout /t 5
