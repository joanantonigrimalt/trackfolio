@echo off
cd /d "%~dp0"
git add -A
git commit -m "v276: Free plan shows only first 7 assets — hidden assets show upgrade banner with count"
git push origin master
pause
