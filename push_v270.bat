@echo off
cd /d "%~dp0"
git add -A
git commit -m "v270: fix 13 more bugs — returns.js gap-fill, UA string, KPI grid 3col, TAE->TIN label, pignoracion checkbox, LnEdit hipoteca, _renderDivHoldings arg, _COV_CK declared, vsWorld disclaimer, amort 12-cuotas note, _goPricing evt param, i18n addCostHint/search/goal/headers, HOY fallback, coveragePill ES"
git push origin master
pause
