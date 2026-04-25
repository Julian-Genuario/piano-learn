@echo off
chcp 65001 > nul
cd /d "%~dp0"

REM Matar procesos Python anteriores
taskkill /f /im python.exe /im pythonw.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Iniciar servidor
echo Iniciando PianoLearn...
start "PianoLearn" cmd /k python run_server.py --mock

REM Esperar a que inicie
timeout /t 3 /nobreak >nul

REM Abrir navegador
start http://localhost:8000
