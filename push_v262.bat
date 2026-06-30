@echo off
cd /d "%~dp0"
git add -A
git commit -m "v262: rentabilidades lazy-load desde justETF (1A/3A/5A en tiempo real)"
git push origin master
pause
