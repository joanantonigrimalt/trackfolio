@echo off
cd /d "%~dp0"
git add -A
git commit -m "v282: fix evolution chart (inject today) + MyInvestor sort toggle + mobile loans sync from Supabase"
git push origin master
pause
