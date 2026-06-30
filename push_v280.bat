@echo off
cd /d "%~dp0"
git add -A
git commit -m "v280: fix catalog SyntaxError + mobile MY tab + nav Foro/Divid + admin delete user"
git push origin master
pause
