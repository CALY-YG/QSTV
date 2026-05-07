@echo off
title QSTV Deploy

echo.
echo  ==========================================
echo    QSTV - Vercel Deploy Tool
echo  ==========================================
echo.

cd /d "%~dp0"

echo [1/2] Building project...
echo ------------------------------------------
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Build failed! Check errors above.
    pause
    exit /b 1
)
echo.
echo  Build succeeded!
echo.

echo [2/2] Deploying to Vercel (production)...
echo ------------------------------------------
vercel --token YOUR_VERCEL_TOKEN_HERE --prod --yes --scope caly-ygs-projects
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Deploy failed! Check errors above.
    pause
    exit /b 1
)

echo.
echo  ==========================================
echo    Deploy complete!
echo    Live at: https://qstv.vercel.app
echo  ==========================================
echo.
pause
