@echo off
setlocal
cd /d "%~dp0"

if "%~1"=="" (
  set /p VER="Numero de version (ej 300): "
) else (
  set VER=%~1
)

set MSG=%~2
if "%MSG%"=="" set /p MSG="Mensaje del commit: "

echo.
echo Estampando version v%VER%...
node bump-version.js %VER%
if errorlevel 1 (
  echo.
  echo *** Error al estampar la version. Abortado, no se hace push. ***
  pause
  exit /b 1
)

echo.
git add -A
git commit -m "v%VER%: %MSG%"
git push origin master

echo.
echo Listo. Vercel desplegara v%VER% en ~1 min.
pause
