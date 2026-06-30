@echo off
cd /d "%~dp0"
git add -A
git commit -m "v278: show analysis charts on mobile + Stripe IVA automatic_tax + plan pro joan"
git push origin master
pause
