@echo off
cd C:\Users\Pc\Desktop\trackfolio-master
del .git\index.lock 2>nul
git add desktop.html mobile.html sw.js
git commit -m "v257: MyInvestor screen, card Garantia+CapInicial+Pendiente+TAE, editable pendiente fix"
git push origin master
echo.
echo === DONE ===
pause
