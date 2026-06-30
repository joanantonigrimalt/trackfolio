@echo off
cd /d "%~dp0"
git add -A
git commit -m "v286: mobile nav - quitar Vera IA, subir MY a pos4, chip Prestamos en Inicio"
git push origin master
pause
