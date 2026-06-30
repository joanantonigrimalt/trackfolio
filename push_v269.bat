@echo off
cd /d "%~dp0"
git add -A
git commit -m "v269: fix 14 bugs — version badge, tax year, MSCI 2026, alert currency, market TZ, costCurrency, foro tags, cache TTL, onboarding lang, modal currency, duplicate ID, alertSelectedWrap, sort arrows"
git push origin master
pause
