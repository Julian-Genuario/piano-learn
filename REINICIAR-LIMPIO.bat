@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ════════════════════════════════════════════════════
echo  Reiniciando TODO completamente limpio
echo ════════════════════════════════════════════════════
echo.

REM Matar todos los Python
echo 1. Matando todos los procesos Python...
taskkill /f /im python.exe /im pythonw.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Limpiar caché
echo.
echo 2. Limpiando caché de Python...
for /d /r . %%d in (__pycache__) do @if exist "%%d" (
    echo   Eliminando %%d
    rmdir /s /q "%%d" >nul 2>&1
)
del /s /q *.pyc >nul 2>&1

REM Limpiar caché del navegador
echo.
echo 3. Abriendo navegador (asegúrate de limpiar caché)
echo   - Presiona: Ctrl + Shift + Delete
echo   - Selecciona: "Ficheros en caché" o "Cached images and files"
echo   - Click: "Limpiar datos"
echo.
pause

REM Iniciar servidor
echo.
echo 4. Iniciando servidor en puerto 8001...
cd /d "%~dp0"
start "PianoLearn Server" cmd /k "python run_server.py --mock"
timeout /t 3 /nobreak >nul

REM Abrir navegador
echo.
echo 5. Abriendo navegador...
start http://localhost:8001

echo.
echo ════════════════════════════════════════════════════
echo INSTRUCCIONES:
echo 1. Espera a que cargue la página
echo 2. En el navegador, presiona F12 (Developer Tools)
echo 3. Abre la pestaña "Console"
echo 4. Haz click en una canción de la lista
echo 5. Haz click en el botón de PLAY (||)
echo 6. Observa la consola - debería mostrar datos
echo 7. Mira las notas cayendo - deberías ver:
echo    - AZUL para mano derecha
echo    - VERDE para mano izquierda
echo ════════════════════════════════════════════════════
echo.
pause
