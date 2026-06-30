@echo off
cd /d "%~dp0"
git add -A
git commit -m "v264: rentabilidades fondos via Morningstar fallback (justETF → Morningstar)"
git push origin master
pause
