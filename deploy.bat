@echo off
REM ========================================================
REM Mentora v1.0 - Windows Production / Staging Deployment
REM ========================================================

echo ==========================================================
echo           MENTORA v1.0 - PRODUCTION DEPLOYMENT            
echo ==========================================================

REM Check Docker
docker --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is required but not installed or not in PATH.
    exit /b 1
)

REM Check .env
if not exist .env (
    echo [!] No .env file found. Copying from .env.production.example...
    copy .env.production.example .env
    echo [!] Please update your .env file with secure secrets before running in production!
)

echo [1/4] Building production container images...
docker compose build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker build failed.
    exit /b 1
)

echo [2/4] Starting PostgreSQL database service...
docker compose up -d postgres

echo [3/4] Running Prisma database migrations in production...
docker compose run --rm backend npx prisma migrate deploy

echo [4/4] Starting all services (AI Service, Backend, Frontend Gateway)...
docker compose up -d

echo ==========================================================
echo Checking service status...
docker compose ps

echo ==========================================================
echo Mentora v1.0 deployment complete!
echo Access the application at: http://localhost (or configured HTTP_PORT)
echo ==========================================================
