@echo off
cd /d "%~dp0"
git add -A
git commit -m "v293: fix Plan Premium en mobile - loadUserPlan en INITIAL_SESSION + renderAccountSection llama _updatePlanUI"
git push origin master
pause
