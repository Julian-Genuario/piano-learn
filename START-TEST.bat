@echo off
chcp 65001 > nul
echo.
echo ╔════════════════════════════════════════════════════╗
echo ║  PianoLearn - Test Visual de Colores              ║
echo ║  Verifica que los colores esten funcionando       ║
echo ╚════════════════════════════════════════════════════╝
echo.

REM Buscar Python
for /f "delims=" %%i in ('where python') do set PYTHON=%%i

if "%PYTHON%"=="" (
    echo ERROR: Python no encontrado
    echo Instala Python desde python.org
    pause
    exit /b 1
)

echo Iniciando servidor en puerto 8001...
echo.

REM Iniciar servidor en modo mock
start "PianoLearn Server" cmd /k "%PYTHON% run_server.py --mock"

REM Esperar a que el servidor inicie
timeout /t 3 /nobreak

REM Abrir navegador
echo.
echo Abriendo navegador...
start http://localhost:8001/TEST_VISUAL.html

echo.
echo Esperando resultados del test...
echo Si ves colores AZUL y VERDE diferenciados, todo esta funcionando!
echo.
pause
