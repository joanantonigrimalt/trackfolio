@echo off
cd /d "%~dp0"
git add -A
git commit -m "v299: loans sync fix, plan gating, Vera to OpenAI, FIFO taxes, price cron, forum images, realtime sync, MyInvestor CSV import"
git push origin master
pause
