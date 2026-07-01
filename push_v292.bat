@echo off
cd /d "%~dp0"
git add -A
git commit -m "v292: fix Plan Free badge en desktop + fix sync prestamos en mobile (token refresh)"
git push origin master
pause
