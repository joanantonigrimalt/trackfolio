@echo off
cd /d "%~dp0"
git add -A
git commit -m "v279: catalog LU1223083087 + loans Supabase sync + catalog auto-load fix + 7-day cache"
git push origin master
pause
