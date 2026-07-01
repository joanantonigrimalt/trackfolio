@echo off
cd /d "%~dp0"
git add -A
git commit -m "v296: HOTFIX — eliminar redirect www en vercel.json (causaba ERR_TOO_MANY_REDIRECTS)"
git push origin master
pause
