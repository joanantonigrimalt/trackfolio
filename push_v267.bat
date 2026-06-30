@echo off
cd /d "%~dp0"
git rm api/myinvestor/test-yf.js 2>nul
git add -A
git commit -m "v267: remove test-yf diagnostic endpoint"
git push origin master
pause
