/**
 * fix-insiders-seed.js
 * Adds auto-seed logic: when discovery view is empty, fetch popular stocks
 * in parallel so users see data immediately on first visit.
 */
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
let n = 0;

function apply(desc, oldStr, newStr) {
  if (!html.includes(oldStr)) { console.error('NOT FOUND:', desc); return; }
  html = html.split(oldStr).join(newStr);
  console.log('OK:', desc); n++;
}

// 1. Add _insSeedDone flag and _insSeedDiscovery function after the existing vars
apply(
  'Add seed vars + function',
  "let _insIsDiscovery = false;",
  `let _insIsDiscovery = false;
let _insSeedDone = false;
const _INS_POPULAR = ['AAPL','MSFT','NVDA','JPM','META','TSLA','V','WMT'];

async function _insSeedDiscovery() {
  _insSeedDone = true;
  const el = document.getElementById('insidersContent');
  if(el) el.innerHTML = '<div style="text-align:center;padding:50px 20px;color:#8fa090;font-size:13px">'
    +'<div style="font-size:28px;margin-bottom:10px">\u231b</div>'
    +(currentLang==='es'?'Cargando datos de empresas populares\u2026':'Loading popular company data\u2026')
    +'<div style="margin-top:12px;font-size:11px;opacity:.6">AAPL \u00b7 MSFT \u00b7 NVDA \u00b7 JPM \u00b7 META\u2026</div>'
    +'</div>';
  // Fetch all popular stocks in parallel — each call saves to Supabase L2
  await Promise.allSettled(_INS_POPULAR.map(sym =>
    fetch('/api/insiders?symbol='+sym).catch(()=>{})
  ));
  // Reload discovery with fresh Supabase data
  _insData = null;
  _insLoading = false;
  _insLoad('');
}`
);

// 2. Replace the empty-discovery placeholder with auto-seed trigger
apply(
  'Trigger auto-seed on empty discovery',
  `    if(!all.length) {
      el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#8fa090;font-size:13px">'
        +'<div style="font-size:32px;margin-bottom:10px">\uD83D\uDD0D</div>'
        +(currentLang==='es'?'Busca un s\u00edmbolo arriba para ver operaciones<br><br><span style="font-size:11px;opacity:.7">Ej: AAPL \u00b7 MSFT \u00b7 NVDA \u00b7 TSLA</span>':'Search a symbol above to view insider trades<br><br><span style="font-size:11px;opacity:.7">E.g.: AAPL \u00b7 MSFT \u00b7 NVDA \u00b7 TSLA</span>')
        +'</div>';
      return;
    }`,
  `    if(!all.length) {
      // Auto-seed popular stocks so discovery view has data on first visit
      if(!_insSeedDone) { _insSeedDiscovery(); return; }
      // Post-seed still empty (no Supabase): show search hint
      el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#8fa090;font-size:13px">'
        +'<div style="font-size:32px;margin-bottom:10px">\uD83D\uDD0D</div>'
        +(currentLang==='es'?'Busca un s\u00edmbolo arriba para ver operaciones<br><br><span style="font-size:11px;opacity:.7">Ej: AAPL \u00b7 MSFT \u00b7 NVDA \u00b7 TSLA</span>':'Search a symbol above to view insider trades<br><br><span style="font-size:11px;opacity:.7">E.g.: AAPL \u00b7 MSFT \u00b7 NVDA \u00b7 TSLA</span>')
        +'</div>';
      return;
    }`
);

fs.writeFileSync('index.html', html);
console.log(`\n${n} fixes applied.`);
