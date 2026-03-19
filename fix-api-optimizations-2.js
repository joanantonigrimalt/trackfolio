/**
 * fix-api-optimizations-2.js — CRLF-aware fixes
 */
const fs   = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'index.html');
let html   = fs.readFileSync(FILE, 'utf8');
let n      = 0;

function apply(desc, oldStr, newStr) {
  if (!html.includes(oldStr)) { console.error('❌ NOT FOUND:', desc); return; }
  html = html.split(oldStr).join(newStr);
  console.log('✅', desc); n++;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SEARCH — add client-side cache check
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'Search: check cache before fetch',
  "  _searchTimer=setTimeout(async()=>{\r\n    try{\r\n      const data=await getJson(`/api/search/query?q=${encodeURIComponent(q)}`);\r\n      if(reqId!==_searchReqId)return; // stale response — a newer search is in progress\r\n      renderSearchResults(data.results||[]);\r\n    }catch(e){\r\n      if(reqId!==_searchReqId)return;\r\n      document.getElementById('searchResultsList').innerHTML=`<div class=\"searchHint\" style=\"color:#b91c1c\">Error al buscar</div>`;\r\n    }\r\n  },380);",
  `  // Check client cache first — avoids repeat API calls for same query
  if(_searchCache.has(q)){renderSearchResults(_searchCache.get(q));return;}
  _searchTimer=setTimeout(async()=>{
    try{
      const data=await getJson(\`/api/search/query?q=\${encodeURIComponent(q)}\`);
      if(reqId!==_searchReqId)return;
      if(_searchCache.size>=50){_searchCache.delete(_searchCache.keys().next().value);}
      _searchCache.set(q,data.results||[]);
      renderSearchResults(data.results||[]);
    }catch(e){
      if(reqId!==_searchReqId)return;
      document.getElementById('searchResultsList').innerHTML=\`<div class="searchHint" style="color:#b91c1c">Error al buscar</div>\`;
    }
  },380);`
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. FX BOOT — localStorage 1h cache (CRLF)
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'FX boot: localStorage 1h cache',
  "// fetchGlobalFxRates() — fetch live EUR\u2192X rates at boot\r\nasync function fetchGlobalFxRates(){\r\n  try{\r\n    const r=await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF');\r\n    const d=await r.json();\r\n    if(d.rates) _fxRates={EUR:1,...d.rates};\r\n  }catch(_){}\r\n}",
  `// fetchGlobalFxRates() — fetch live EUR\u2192X rates at boot (localStorage cached 1h)
async function fetchGlobalFxRates(){
  try{
    const _LS='fa_fx_rates',_stored=localStorage.getItem(_LS);
    if(_stored){const _p=JSON.parse(_stored);if(_p?.rates&&(Date.now()-_p.ts)<3_600_000){_fxRates={EUR:1,..._p.rates};return;}}
    const r=await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF');
    const d=await r.json();
    if(d.rates){_fxRates={EUR:1,...d.rates};localStorage.setItem(_LS,JSON.stringify({rates:d.rates,ts:Date.now()}));}
  }catch(_){}
}`
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. FX ADD-FORM — use _fxRates cache before Frankfurter call (CRLF)
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'FX add-form: use _fxRates cache',
  "async function fetchFxRate(toCcy) {\r\n  if (!toCcy || toCcy === 'EUR') return;\r\n  try {\r\n    const r = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${toCcy}`);\r\n    const d = await r.json();\r\n    const rate = d.rates?.[toCcy];\r\n    if (rate) {\r\n      document.getElementById('addFxRate').value = rate.toFixed(4);\r\n      updateFxHint();\r\n    }\r\n  } catch (_) { /* user enters manually */ }\r\n}",
  `async function fetchFxRate(toCcy) {
  if (!toCcy || toCcy === 'EUR') return;
  // Use boot-time cached rate if available — no network call needed
  const _r=_fxRates[toCcy];
  if(_r&&_r>0){document.getElementById('addFxRate').value=_r.toFixed(4);updateFxHint();return;}
  try {
    const r = await fetch(\`https://api.frankfurter.app/latest?from=EUR&to=\${toCcy}\`);
    const d = await r.json();
    const rate = d.rates?.[toCcy];
    if (rate) { _fxRates[toCcy]=rate; document.getElementById('addFxRate').value=rate.toFixed(4); updateFxHint(); }
  } catch (_) { /* user enters manually */ }
}`
);

// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html);
console.log(`\n${n} fixes applied.`);
