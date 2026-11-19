@echo off
TITLE Mentora Shutdown
echo ===================================================================
echo               STOPPING MENTORA SERVICES                            
echo ===================================================================
echo.
echo Stopping Node.js processes...
taskkill /F /IM node.exe /T 2>nul
echo Stopping Python uvicorn processes...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq Mentora AI Engine*" 2>nul
echo All Mentora processes stopped.
