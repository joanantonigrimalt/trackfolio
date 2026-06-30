@echo off
cd /d "%~dp0"
git add -A
git commit -m "v265: rentabilidades fondos via Yahoo Finance fallback (justETF para ETFs, YF para fondos)"
git push origin master
pause
