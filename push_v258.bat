@echo off
cd C:\Users\Pc\Desktop\trackfolio-master
del .git\index.lock 2>nul
git add desktop.html sw.js api/myinvestor/catalog.js
git commit -m "v258: MyInvestor auto catalog via /api/myinvestor/catalog — sin configuracion manual"
git push origin master
echo.
echo === DONE ===
pause
