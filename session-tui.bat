@echo off
setlocal

where bun >nul 2>nul
if errorlevel 1 (
  echo Bun is not installed or not on PATH.
  echo Install Bun from https://bun.sh and try again.
  pause
  exit /b 1
)

set "SCRIPT_DIR=%~dp0"
bun "%SCRIPT_DIR%src\bin\opencode-manager.ts" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo opencode-manager exited with code %EXIT_CODE%.
  pause
)

exit /b %EXIT_CODE%
