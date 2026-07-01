@echo off
cd /d "%~dp0"
git add -A
git commit -m "v297: eliminar seccion Planes/Precios de la home"
git push origin master
pause
