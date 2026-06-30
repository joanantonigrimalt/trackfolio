@echo off
cd /d "%~dp0"
git add -A
git commit -m "v266: add test-yf diagnostic endpoint"
git push origin master
pause
