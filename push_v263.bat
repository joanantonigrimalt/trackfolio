@echo off
cd /d "%~dp0"
git add -A
git commit -m "v263: fix filtro Fondos (Fondos Indexados + Fondos de inversion) + sort nombre por defecto"
git push origin master
pause
