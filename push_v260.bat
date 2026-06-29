@echo off
cd /d "%~dp0"
git add -A
git commit -m "v260: fix CDN cache — Cache-Control private + ?v=260 cache-buster"
git push origin master
pause
