@echo off
cd /d "%~dp0"
git add -A
git commit -m "v283: mobile loans fix + loans en inicio + premium plan fix + sort 1A/3A/5A mobile MyInvestor + catalogo dinamico 4574 fondos desde Google Sheet"
git push origin master
pause
