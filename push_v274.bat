@echo off
cd /d "%~dp0"
git add -A
git commit -m "v274: Premium plan 9.99 — Plan screen, 7-asset free limit, IA gate, simplified 2-tier pricing, _manageSubscription, sw finasset-v274"
git push origin master
pause
