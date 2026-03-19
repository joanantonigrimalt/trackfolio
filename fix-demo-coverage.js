/**
 * fix-demo-coverage.js
 * Adds a coverage fetch to enterDemo() so the portfolio chart has real history.
 */
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Find the exact marker — use indexOf to handle CRLF
const MARKER = "fetchGlobalFxRates().then(()=>render()).catch(()=>render());";
const idx = html.indexOf(MARKER);
if (idx === -1) { console.error('MARKER NOT FOUND'); process.exit(1); }

// Find the closing } of enterDemo right after this marker
const closeIdx = html.indexOf('\n}', idx);
if (closeIdx === -1) { console.error('CLOSE NOT FOUND'); process.exit(1); }

// What we're replacing: from MARKER to end of enterDemo's closing brace
const oldChunk = html.slice(idx, closeIdx + 2); // +2 for \n}
console.log('Replacing:', JSON.stringify(oldChunk.slice(0, 80)));

const newChunk = `fetchGlobalFxRates().then(()=>render()).catch(()=>render());
  // Background: fetch real price history for demo assets so chart works
  const _demoIsins = DEMO_ASSETS_RAW.map(p=>p.isin).join(',');
  getJson('/api/portfolio/coverage?isin='+encodeURIComponent(_demoIsins), 12000)
    .then(cov => {
      if(!cov||!cov.results) return;
      const cvMap = Object.fromEntries(cov.results.map(e=>[e.isin,e]));
      assets = assets.map(a => {
        const entry = cvMap[a.isin];
        if(!entry) return a;
        const history = (entry.data?.history||[])
          .map(p=>({date:String(p.date).slice(0,10),close:Number(p.close)}))
          .filter(p=>p.date&&p.close>0)
          .sort((a,b)=>a.date.localeCompare(b.date));
        if(!history.length) return a;
        return {...a, history, hasRealHistory:true, coverageStatus:entry.data?.coverage?.status||'PARTIAL', provider:entry.data?.provider||null};
      });
      render();
    })
    .catch(()=>{});
}`;

html = html.slice(0, idx) + newChunk + html.slice(closeIdx + 2);
fs.writeFileSync('index.html', html);
console.log('OK: demo mode now fetches coverage for chart history.');
