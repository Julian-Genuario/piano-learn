@echo off
cd /d "%~dp0"

REM Activate virtual environment
if not exist ".venv" (
    echo Creando entorno virtual...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

REM Install dependencies
pip install -r requirements-simple.txt

REM Start server
echo.
echo ========================================
echo PianoLearn - SERVIDOR INICIANDO
echo ========================================
echo.
echo Abre navegador: http://localhost:8000
echo.
echo Presiona Ctrl+C para detener
echo ========================================
echo.

python run_server.py --mock

pause
