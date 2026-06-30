@echo off
cd /d "%~dp0"
git add -A
git commit -m "v292: fix syncDeskUser badge Plan Free->Plan Premium + toast text fix"
git push origin master
pause
