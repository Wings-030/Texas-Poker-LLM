@echo off
setlocal
title Texas Holdem LLM - Local Server

cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js was not found.
  echo Install Node.js and then run this file again.
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] npm.cmd was not found. Reinstall Node.js first.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [FIRST RUN] Installing game dependencies. Please wait...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo [ERROR] Dependency installation failed.
    echo Check the network connection and npm configuration.
    echo.
    pause
    exit /b 1
  )
)

echo [BUILD] Preparing the game frontend...
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo [ERROR] Frontend build failed. Run npm.cmd test for details.
  pause
  exit /b 1
)

echo.
echo Starting Texas Holdem LLM with the local AI backend...
echo Service: http://127.0.0.1:3000/
echo Logs: %~dp0logs
echo Configuration: %~dp0config\api-config.json
echo Keep this window open while playing.
echo Close this window or press Ctrl+C to stop the server.
echo.

if /I not "%NO_BROWSER%"=="true" start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:3000/'"
call npm.cmd run server

echo.
echo The local game and AI backend have stopped.
pause
