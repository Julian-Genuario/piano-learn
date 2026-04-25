@echo off
cd /d "%~dp0"

REM Activate virtual environment
if not exist ".venv" (
    echo Creando entorno virtual...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

REM Install dependencies
pip install -q -r requirements-pc.txt 2>nul

REM Start extractor
echo.
echo ========================================
echo MIDI Extractor - SERVIDOR INICIANDO
echo ========================================
echo.
echo Abre navegador: http://localhost:8001
echo.
echo Presiona Ctrl+C para detener
echo ========================================
echo.

python run_extractor.py

pause
