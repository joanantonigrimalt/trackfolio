@echo off
cd /d "%~dp0"
git add -A
git commit -m "v294: SEO fixes — www redirect, cache headers, sitemap lastmod, meta CTR improvements"
git push origin master
pause
