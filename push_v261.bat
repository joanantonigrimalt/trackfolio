@echo off
cd /d "%~dp0"
git add -A
git commit -m "v261: MyInvestor paginacion 100/pagina — render instantaneo"
git push origin master
pause
