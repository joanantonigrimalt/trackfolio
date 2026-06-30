@echo off
cd /d "%~dp0"
git add -A
git commit -m "v287: fix mobile layout - remove extra </div> that closed .phone early, all screens now inside phone"
git push origin master
pause
