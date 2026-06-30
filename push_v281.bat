@echo off
cd /d "%~dp0"
git add -A
git commit -m "v281: remove 1D chart tab + fix stale prices (live refresh on asset open + bgRefresh history update) + admin force-refresh prices btn"
git push origin master
pause
