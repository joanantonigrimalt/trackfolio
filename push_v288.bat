@echo off
cd /d "%~dp0"
git add -A
git commit -m "v288: fix Deuda card not showing on home - call renderDebt() directly in _doRender + LnSyncFromSB on startup"
git push origin master
pause
