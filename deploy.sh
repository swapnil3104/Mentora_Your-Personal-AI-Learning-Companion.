#!/usr/bin/env bash
# ========================================================
# Mentora v1.0 - Production Deployment Script
# ========================================================
set -euo pipefail

echo "=========================================================="
echo "          MENTORA v1.0 - PRODUCTION DEPLOYMENT            "
echo "=========================================================="

# Check Docker and Docker Compose
command -v docker >/dev/null 2>&1 || { echo >&2 "[ERROR] Docker is required but not installed. Aborting."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo >&2 "[ERROR] Docker Compose v2 is required. Aborting."; exit 1; }

# Check environment file
if [ ! -f .env ]; then
    echo "[!] No .env file found. Creating from .env.production.example..."
    cp .env.production.example .env
    echo "[!] Please review and configure secrets in .env before running in public production!"
fi

echo "[1/4] Pulling and building production container images..."
docker compose build --pull

echo "[2/4] Starting PostgreSQL database service..."
docker compose up -d postgres
echo "Waiting for database to be healthy..."
docker compose exec postgres pg_isready -U "${POSTGRES_USER:-mentora_admin}" -d "${POSTGRES_DB:-mentora_prod}" -t 30

echo "[3/4] Running Prisma database migrations in production..."
docker compose run --rm backend npx prisma migrate deploy

echo "[4/4] Starting all services (AI Service, Backend, Frontend Gateway)..."
docker compose up -d

echo "=========================================================="
echo "Waiting for all services to pass health checks..."
sleep 5

# Check health
echo "Checking Backend Health..."
curl -s http://localhost:5000/api/health | grep -q "healthy" && echo "  ✓ Backend API is healthy!" || echo "  [!] Backend reported non-healthy status."

echo "Checking Frontend Gateway..."
curl -s http://localhost/healthz | grep -q "healthy" && echo "  ✓ Frontend Gateway is online!" || echo "  [!] Frontend gateway reported non-healthy status."

echo "=========================================================="
echo "Mentora v1.0 deployment complete!"
echo "Access the application at: http://localhost (or configured domain)"
echo "=========================================================="
