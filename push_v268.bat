@echo off
cd /d "%~dp0"
git add -A
git commit -m "v268: fix rent sort buttons — re-render after MiLoadReturns populates _miData"
git push origin master
pause
