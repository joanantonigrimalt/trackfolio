const fs = require('fs');
let html = fs.readFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', 'utf8');
const origLen = html.length;

// 1. Remove demo button from auth screen
html = html.replace(/\s*<button class="auth-btn-sec" onclick="enterDemo\(\)"[^>]*>Ver demo sin cuenta[^<]*<\/button>/g, '');

// 2. Remove demoBanner HTML blocks (both occurrences)
html = html.replace(/\s*<div id="demoBanner" class="demoBanner">\s*<span>[^<]*<\/span>\s*<button[^>]*>[^<]*<\/button>\s*<\/div>/g, '');
html = html.replace(/\s*<div id="demoBannerPortfolio" class="demoBanner">\s*<span>[^<]*<\/span>\s*<button[^>]*>[^<]*<\/button>\s*<\/div>/g, '');

// 3. Remove .demoBanner CSS
html = html.replace(/\.demoBanner\{[^}]+\}\.demoBanner\.show\{[^}]+\}\.demoBanner button\{[^}]+\}/g, '');

// 4. Remove _isDemo guards: if(_isDemo){_demoToast();return;} (with optional whitespace/newlines)
html = html.replace(/\s*if\s*\(\s*_isDemo\s*\)\s*\{\s*_demoToast\s*\(\s*\)\s*;\s*return\s*;\s*\}/g, '');

// 5. Remove saveOverrides demo check: if(_isDemo)return;
html = html.replace(/if\(_isDemo\)return;/g, '');

// 6. Remove the _isDemo checks for login/demo users in asset filtering
html = html.replace(/\(\s*_sbUser\s*\|\|\s*_isDemo\s*\)/g, '(_sbUser)');
html = html.replace(/if\s*\(\s*_sbUser\s*\|\|\s*_isDemo\s*\)/g, 'if(_sbUser)');

// 7. Remove the demo account section in settings
html = html.replace(/\s*}\s*else if\s*\(\s*_isDemo\s*\)\s*\{[^}]*btnExitDemo[^}]*\}/g, '');

// 8. Remove _isDemo variable declaration
html = html.replace(/\nlet _isDemo = false;\n/g, '\n');

// 9. Remove enterDemo function and DEMO_POSITIONS/DEMO_LIQUIDITY constants
html = html.replace(/\nconst DEMO_POSITIONS = \{[\s\S]*?\};\nconst DEMO_LIQUIDITY = \[[\s\S]*?\];\n/g, '\n');
html = html.replace(/\nfunction enterDemo\(\) \{[\s\S]*?\}\n\n/g, '\n');
html = html.replace(/\n\/\/ Demo mode: show a non-blocking toast[\s\S]*?function _demoToast\(\)\{[\s\S]*?\}\n/g, '\n');

// 10. Remove fa_ob_done localStorage set in enterDemo (already removed function, but clean any stray ref)
// Already handled by removing the function

console.log('Original length:', origLen);
console.log('New length:', html.length);
console.log('Removed:', origLen - html.length, 'chars');
fs.writeFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', html, 'utf8');
console.log('Done!');
