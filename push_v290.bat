@echo off
cd /d "%~dp0"
git add -A
git commit -m "v290: hide upgrade card for pro/starter users + plan=pro for joantonigrimalt"
git push origin master
pause
