@echo off
cd /d "%~dp0"
git add -A
git commit -m "v272: fix 17 bugs — mobile FA_BUILD+demoBanner+alertStyle, catalog 0%% rent, intraday timeout+holiday-scope+hour12+3pt-threshold+404-marketClosed+anyHit-race+allErrored-cache, history derivePayMonths-paydate+nextM-undefined+qty-multiply+empty-cache+estimateNextDates-daysinmonth, sw finasset-v272"
git push origin master
pause
