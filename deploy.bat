@echo off
setlocal

rem ============================================================
rem  pdf-reader deploy (Cloudflare Pages)
rem  Double-click after changes to update the live site.
rem  Runs: tests, typecheck + build, wrangler pages deploy, then commit and push.
rem
rem  First-time setup (run once in this folder):
rem    npm install
rem    npx wrangler login
rem    npx wrangler pages project create pdf-reader --production-branch main
rem ============================================================

echo === Deploy pdf-reader to Cloudflare Pages ===
cd /d "%~dp0"
echo Current: %CD%

if not exist "node_modules\wrangler\" (
    echo Installing dependencies for the first time...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo === Test ===
call npm run test
if %errorlevel% neq 0 (
    echo [ERROR] Tests failed. Deploy aborted.
    pause
    exit /b 1
)

echo === Build ^& Cloudflare Pages deploy ===
call npm run deploy
if %errorlevel% neq 0 (
    echo [ERROR] Deploy failed.
    pause
    exit /b 1
)

echo === Commit ^& Push to GitHub (main) ===
git add .
git commit -m "Update pdf-reader" || echo No changes to commit
git push -u origin main
if %errorlevel% neq 0 (
    echo [WARN] Git push failed. The Cloudflare deploy itself succeeded.
)

echo === Done ===
pause
