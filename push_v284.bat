@echo off
cd /d "%~dp0"
git add -A
git commit -m "v284: fix MyInvestor cache bust + seccion Deuda en mobile Inicio + catalogo 4574 fondos"
git push origin master
pause
