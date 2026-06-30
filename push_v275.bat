@echo off
cd /d "%~dp0"
git add -A
git commit -m "v275: fix 44 bugs — i18n strings, plan badge, auth min-length, operator precedence, community strings, SCREEN_META titles, impuestos strings, alerts strings, InsCard labels, MiLoad/MiRender strings, syncDeskUser plan badge"
git push origin master
pause
