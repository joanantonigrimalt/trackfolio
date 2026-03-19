/**
 * fix-api-optimizations.js
 * Apply frontend API optimizations to index.html:
 *   1. Search: client-side Map cache (50 entries, FIFO)
 *   2. FX boot: localStorage with 1h TTL (avoids refetch on every page load)
 *   3. FX add-form: use cached _fxRates before hitting Frankfurter API
 *   4. Insiders: route through /api/insiders (hides FMP key from client)
 *
 * Run: node fix-api-optimizations.js
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
// 1. SEARCH — add client-side Map cache (complement the existing debounce)
//    Max 50 entries (FIFO eviction). Key = trimmed query string.
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'Search: add _searchCache Map',
  'let _searchTimer=null,_searchResult=null,_searchReqId=0;',
  'let _searchTimer=null,_searchResult=null,_searchReqId=0;\nconst _searchCache=new Map(); // client-side query cache (max 50, FIFO)'
);

apply(
  'Search: check cache before fetch, store result after',
  `  _searchTimer=setTimeout(async()=>{
    try{
      const data=await getJson(\`/api/search/query?q=\${encodeURIComponent(q)}\`);
      if(reqId!==_searchReqId)return; // stale response — a newer search is in progress
      renderSearchResults(data.results||[]);
    }catch(e){
      if(reqId!==_searchReqId)return;
      document.getElementById('searchResultsList').innerHTML=\`<div class="searchHint" style="color:#b91c1c">Error al buscar</div>\`;
    }
  },380);`,
  `  // Check client cache first — avoids repeat API calls for the same query
  if(_searchCache.has(q)){
    const _cached=_searchCache.get(q);
    renderSearchResults(_cached);
    document.getElementById('searchResultsList'); // already rendered above
    return;
  }
  _searchTimer=setTimeout(async()=>{
    try{
      const data=await getJson(\`/api/search/query?q=\${encodeURIComponent(q)}\`);
      if(reqId!==_searchReqId)return;
      // Store in client cache (FIFO eviction at 50 entries)
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
// 2. FX BOOT — cache in localStorage with 1h TTL
//    fetchGlobalFxRates() already runs at boot; just add localStorage read/write
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'FX boot: add localStorage 1h cache',
  `// fetchGlobalFxRates() — fetch live EUR→X rates at boot
async function fetchGlobalFxRates(){
  try{
    const r=await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF');
    const d=await r.json();
    if(d.rates) _fxRates={EUR:1,...d.rates};
  }catch(_){}
}`,
  `// fetchGlobalFxRates() — fetch live EUR→X rates at boot
// Caches in localStorage for 1h to avoid redundant calls on every page load.
async function fetchGlobalFxRates(){
  try{
    const _LS_KEY='fa_fx_rates';
    const _stored=localStorage.getItem(_LS_KEY);
    if(_stored){
      const _p=JSON.parse(_stored);
      if(_p&&_p.rates&&typeof _p.ts==='number'&&(Date.now()-_p.ts)<3_600_000){
        _fxRates={EUR:1,..._p.rates};
        return; // use cached rates — no network call
      }
    }
    const r=await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CHF');
    const d=await r.json();
    if(d.rates){
      _fxRates={EUR:1,...d.rates};
      localStorage.setItem(_LS_KEY,JSON.stringify({rates:d.rates,ts:Date.now()}));
    }
  }catch(_){}
}`
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. FX ADD-FORM — use _fxRates cache before hitting Frankfurter API
//    fetchFxRate() is called each time user opens the currency toggle.
//    If we already have the rate in _fxRates (fetched at boot), use it directly.
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'FX add-form: use cached _fxRates before network call',
  `async function fetchFxRate(toCcy) {
  if (!toCcy || toCcy === 'EUR') return;
  try {
    const r = await fetch(\`https://api.frankfurter.app/latest?from=EUR&to=\${toCcy}\`);
    const d = await r.json();
    const rate = d.rates?.[toCcy];
    if (rate) {
      document.getElementById('addFxRate').value = rate.toFixed(4);
      updateFxHint();
    }
  } catch (_) { /* user enters manually */ }
}`,
  `async function fetchFxRate(toCcy) {
  if (!toCcy || toCcy === 'EUR') return;
  // Use globally cached rate if available (populated by fetchGlobalFxRates at boot)
  const _cachedRate = _fxRates[toCcy];
  if (_cachedRate && _cachedRate > 0) {
    document.getElementById('addFxRate').value = _cachedRate.toFixed(4);
    updateFxHint();
    return;
  }
  // Fallback: fetch from Frankfurter API if not in cache
  try {
    const r = await fetch(\`https://api.frankfurter.app/latest?from=EUR&to=\${toCcy}\`);
    const d = await r.json();
    const rate = d.rates?.[toCcy];
    if (rate) {
      _fxRates[toCcy] = rate; // update local cache
      document.getElementById('addFxRate').value = rate.toFixed(4);
      updateFxHint();
    }
  } catch (_) { /* user enters manually */ }
}`
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. INSIDERS — route through /api/insiders (removes hardcoded FMP key)
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'Insiders: remove hardcoded FMP key',
  "const _INS_KEY = 'EYRk2QXBpsogqFUfHFb9CcR4bEqk3OZ7L0';",
  '// FMP key moved to server — insiders now proxied through /api/insiders'
);

apply(
  'Insiders: replace direct FMP call with /api/insiders proxy',
  "    const url = 'https://financialmodelingprep.com/stable/insider-trading/search?page=0&limit=100'+sym+'&apikey='+_INS_KEY;",
  "    const url = '/api/insiders?page=0&limit=100'+sym; // server-side proxy (key hidden)"
);

// ─────────────────────────────────────────────────────────────────────────────
// SW cache bump
// ─────────────────────────────────────────────────────────────────────────────
const swPath = path.join(__dirname, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
const swM = sw.match(/const CACHE_NAME = 'finasset-v(\d+)'/);
if (swM) {
  const newV = parseInt(swM[1]) + 1;
  sw = sw.replace(`finasset-v${swM[1]}'`, `finasset-v${newV}'`);
  fs.writeFileSync(swPath, sw);
  console.log(`✅ SW bumped to v${newV}`);
}

fs.writeFileSync(FILE, html);
console.log(`\n${n} fixes applied.`);
