@echo off
title Outbound Shipment Report - Sync Cloud Edits to Excel
cd /d "%~dp0"

echo.
echo ====================================================
echo  Connecting to Cloud and Syncing to Local Excel...
echo ====================================================
echo.

node scripts/syncCloudToExcel.cjs

echo.
echo ====================================================
echo  Finished. Press any key to close this window.
echo ====================================================
pause >nul
