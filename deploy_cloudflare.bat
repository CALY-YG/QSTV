@echo off
title QSTV - Cloudflare Deploy
echo.
echo  ==========================================
echo    QSTV - Cloudflare Pages Deploy Tool
echo  ==========================================
echo.

echo [1/2] Building project...
echo ------------------------------------------
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Deploying to Cloudflare Pages...
echo ------------------------------------------
echo Note: If this is your first time, it will open a browser to log in.
call npx wrangler pages deploy dist --project-name qstv
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Deploy failed!
    pause
    exit /b 1
)

echo.
echo  ==========================================
echo    Deploy complete!
echo  ==========================================
echo.
pause
