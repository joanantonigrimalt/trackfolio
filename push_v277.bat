@echo off
cd /d "%~dp0"
git add -A
git commit -m "v277: change free asset limit from 7 to 10"
git push origin master
pause
