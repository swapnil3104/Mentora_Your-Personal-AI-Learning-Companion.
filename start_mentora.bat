@echo off
TITLE Mentora Launcher
COLOR 0B

echo ===================================================================
echo               MENTORA FULL STACK SYSTEM LAUNCHER                   
echo                 Understand. Visualize. Learn.                     
echo ===================================================================
echo.

:: 1. Start Ollama inference service if not already active
echo [1/4] Ensuring Ollama inference server is active...
start "Mentora - Ollama" /min "C:\Users\Asus\AppData\Local\Programs\Ollama\ollama.exe" serve

:: 2. Launch AI Microservice (FastAPI + ChromaDB + RAG)
echo [2/4] Starting Python AI Service on http://127.0.0.1:8000...
start "Mentora AI Engine (Port 8000)" cmd /k "cd /d "%~dp0ai-service" && set PYTHONPATH=C:\Users\Asus\anaconda3\Lib\site-packages;%~dp0ai-service && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

:: 3. Launch Backend API (Express + Prisma + PostgreSQL)
echo [3/4] Starting Node.js Backend API on http://127.0.0.1:5000...
start "Mentora Backend API (Port 5000)" cmd /k "cd /d "%~dp0backend" && npm run dev"

:: 4. Launch Frontend Web App (React + Vite + Tailwind)
echo [4/4] Starting React Frontend on http://localhost:5173...
start "Mentora Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ===================================================================
echo   All 3 Mentora services have been spawned in dedicated windows:   
echo   - AI Service:    http://127.0.0.1:8000/health
echo   - Backend API:   http://127.0.0.1:5000/api/health
echo   - Frontend App:  http://localhost:5173
echo ===================================================================
echo.
echo Launching Mentora Web Application in your browser...
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173
