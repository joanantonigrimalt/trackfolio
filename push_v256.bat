@echo off
cd C:\Users\Pc\Desktop\trackfolio-master
del .git\index.lock 2>nul
git add desktop.html mobile.html sw.js
git commit -m "v256: editable saldo pendiente, Capital→Garantia, font consistency impuestos"
git push origin master
echo.
echo === DONE ===
pause
