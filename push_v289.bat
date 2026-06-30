@echo off
cd /d "%~dp0"
git add -A
git commit -m "v289: SW posts SW_UPDATED message on activate + mobile listens and auto-reloads, fixes Deuda card update"
git push origin master
pause
