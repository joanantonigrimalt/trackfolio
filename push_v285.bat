@echo off
cd /d "%~dp0"
git add -A
git commit -m "v285: fix Foro desktop - reemplazar Supabase JS client con REST directo en todas las funciones del Foro"
git push origin master
pause
