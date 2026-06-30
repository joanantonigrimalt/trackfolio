@echo off
cd /d "%~dp0"
git add -A
git commit -m "v273: fix 10 bugs — MSCI 2026 removed, compound cumulative return, divGoal deadline i18n+daysLeft, alert date locale+pct-base, div table i18n, market hours EU+US split, MSCI yEnd Dec31 boundary, sw finasset-v273"
git push origin master
pause
