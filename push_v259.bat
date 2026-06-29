@echo off
cd C:\Users\Pc\Desktop\trackfolio-master
del .git\index.lock 2>nul
git add api/myinvestor/catalog.js sw.js
git commit -m "v259: MyInvestor catalog estatico (60+ ETFs/fondos) + soporte MYINVESTOR_APPS_SCRIPT_URL"
git push origin master
echo.
echo === DONE v259 ===
pause
