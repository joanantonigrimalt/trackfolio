@echo off
cd /d "%~dp0"
git add -A
git commit -m "v291: precio Premium 9.99+IVA en toda la app, labels Pro->Premium, token refresh en loadUserPlan"
git push origin master
pause
