@echo off
echo ==================================================
echo MediMind - Production Validation Check
echo ==================================================

echo [1/4] Stopping existing Node/Next processes...
taskkill /F /IM node.exe 2>NUL
:: Wait a moment to ensure file locks are released
timeout /T 2 /NOBREAK >NUL

echo [2/4] Removing .next directory safely...
IF EXIST .next (
    rmdir /S /Q .next
)

echo.
echo ==================================================
echo [3/4] Running Typecheck...
echo ==================================================
call npm run typecheck
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Typecheck FAILED! Stopping production validation.
    exit /b %errorlevel%
)

echo.
echo ==================================================
echo [4/4] Running Lint...
echo ==================================================
call npm run lint
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Lint FAILED! Stopping production validation.
    exit /b %errorlevel%
)

echo.
echo ==================================================
echo [5/5] Running Build...
echo ==================================================
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Build FAILED! Stopping production validation.
    exit /b %errorlevel%
)

echo.
echo ==================================================
echo SUCCESS: Production Validation Completed Safely!
echo ==================================================
