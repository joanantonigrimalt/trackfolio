@echo off
cd /d "%~dp0"
git add -A
git commit -m "v295: fix CORS bug — API permite cross-origin desde www.finasset.app + SW bump v295"
git push origin master
pause
