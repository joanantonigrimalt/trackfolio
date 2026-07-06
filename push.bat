@echo off
cd /d "%~dp0"

echo ================================
echo Estado actual de Git
echo ================================
git status

echo.
set /p msg="Mensaje del commit: "

if "%msg%"=="" (
  set msg=Actualizacion del proyecto
)

git add -A
git commit -m "%msg%"

if errorlevel 1 (
  echo.
  echo No se ha creado commit. Puede que no haya cambios.
  pause
  exit /b
)

git push origin master

echo.
echo Push terminado. Revisa Vercel Deployments.
pause