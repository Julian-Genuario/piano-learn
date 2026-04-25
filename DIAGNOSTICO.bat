@echo off
cls
echo ========================================
echo DIAGNOSTICO - PIANOLEARN
echo ========================================
echo.

echo 1. Verificando Python...
python --version
if errorlevel 1 (
    echo ERROR: Python no esta en PATH
    goto error
)

echo.
echo 2. Verificando carpeta actual...
cd /d "%~dp0"
echo Ubicacion: %cd%
dir /b | find "pianolearn" >nul
if errorlevel 1 (
    echo ERROR: No esta en la carpeta correcta
    goto error
)

echo.
echo 3. Verificando archivos...
if not exist "pianolearn" echo ERROR: Falta carpeta pianolearn
if not exist "requirements-pc.txt" echo ERROR: Falta requirements-pc.txt
if not exist "run_server.py" echo ERROR: Falta run_server.py

echo.
echo 4. Verificando venv...
if not exist ".venv" (
    echo Creando venv...
    python -m venv .venv
)
call .venv\Scripts\activate.bat
echo Venv activado OK

echo.
echo 5. Instalando dependencias...
pip install -r requirements-simple.txt
if errorlevel 1 (
    echo ERROR al instalar
    goto error
)

echo.
echo 6. Prueba de importacion...
python -c "from pianolearn.server import create_app; print('OK - Modulos cargados')"
if errorlevel 1 (
    echo ERROR: No se pueden cargar los modulos
    goto error
)

echo.
echo ========================================
echo DIAGNOSTICO EXITOSO
echo ========================================
echo.
pause
exit /b 0

:error
echo.
echo ERROR ENCONTRADO - Ver arriba
echo.
pause
exit /b 1
