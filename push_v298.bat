@echo off
cd /d "%~dp0"
git add -A
git commit -m "v298: SEO mejorado (títulos, metas, H1), arreglar URLs app, eliminar botones demo, cambiar imagen hero app-dividendos"
git push origin master
pause
