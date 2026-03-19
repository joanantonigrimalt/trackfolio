const fs = require('fs');
let html = fs.readFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', 'utf8');
let n = 0;

function fix(desc, s, r) {
  if (!html.includes(s)) { console.log('MISS:', desc); return; }
  // Use function replacer to avoid $ special chars in replacement
  html = html.replace(s, () => r); n++;
  console.log('OK ' + n + ': ' + desc);
}

// ══════════════════════════════════════════════════
// 1. Add .ins-chip CSS after .demoBanner styles
// ══════════════════════════════════════════════════
fix('Add ins-chip CSS',
  '.demoBanner button{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;font-family:inherit;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;cursor:pointer;flex-shrink:0}',
  `.demoBanner button{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;font-family:inherit;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;cursor:pointer;flex-shrink:0}
.ins-chip{padding:7px 13px;border-radius:20px;border:1.5px solid rgba(20,32,24,.1);background:#fff;font:inherit;font-size:12px;font-weight:700;color:#8fa090;cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0}
.ins-chip-active{background:#142018;color:#fff;border-color:#142018}
.ins-buy-chip.ins-chip-active{background:#15803d;border-color:#15803d}
.ins-sell-chip.ins-chip-active{background:#dc2626;border-color:#dc2626}
.ins-card{display:flex;align-items:flex-start;gap:12px;padding:13px 14px;background:#fff;border-radius:14px;margin-bottom:8px;border:1px solid rgba(20,32,24,.07);box-shadow:0 1px 4px rgba(20,32,24,.05)}
.ins-icon{width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#e6faf3,#b7f0d8);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#15803d;flex-shrink:0}
.ins-icon.sell{background:linear-gradient(135deg,#fef2f2,#fecaca);color:#dc2626}
.ins-icon.neutral{background:linear-gradient(135deg,#f8f9fa,#e9ecef);color:#8fa090}`
);

// ══════════════════════════════════════════════════
// 2. Replace screen-topinvestors HTML (index-based)
// ══════════════════════════════════════════════════
const startMarker = '<!-- ============ MEJORES INVERSORES ============ -->';
const endMarker = '<!-- ============ AN'; // avoid accent char
const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker, startIdx);
if (startIdx === -1 || endIdx === -1) {
  console.log('FAIL: cannot find screen bounds', startIdx, endIdx);
  process.exit(1);
}

const NEW_SCREEN = `<!-- ============ INSIDERS ============ -->
<div id="screen-topinvestors" class="screen">
  <div class="top"><div>
    <div class="title">Insiders</div>
    <div class="sub">Compras y ventas de directivos \xb7 SEC filings</div>
  </div></div>
  <div style="padding:0 16px 80px">

    <!-- Filter chips -->
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:2px">
      <button class="ins-chip ins-chip-active" onclick="_insFilter('all')" id="insChipAll">Todos</button>
      <button class="ins-chip ins-buy-chip" onclick="_insFilter('buy')" id="insChipBuy">\u25b2 Compras</button>
      <button class="ins-chip ins-sell-chip" onclick="_insFilter('sell')" id="insChipSell">\u25bc Ventas</button>
    </div>

    <!-- Symbol search -->
    <div style="position:relative;margin-bottom:14px">
      <svg style="position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none" viewBox="0 0 16 16" fill="none" stroke="#8fa090" stroke-width="1.8" width="14" height="14"><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10" y1="10" x2="14" y2="14"/></svg>
      <input id="insSearchInput" type="text" placeholder="Buscar por s\xedmbolo (ej: AAPL, MSFT)\u2026"
        style="width:100%;padding:11px 36px 11px 34px;border:1.5px solid rgba(20,32,24,.12);border-radius:12px;font:inherit;font-size:14px;background:#fff;color:#142018;outline:none;box-sizing:border-box"
        oninput="_insSearchDebounce()" />
      <button onclick="_insClearSearch()" id="insSearchClear" style="display:none;position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:14px;color:#8fa090;padding:4px">\u2715</button>
    </div>

    <!-- Content -->
    <div id="insidersContent">
      <div style="text-align:center;padding:60px 0;color:#8fa090;font-size:13px">
        <div style="font-size:32px;margin-bottom:12px">\uD83D\uDD0D</div>
        Cargando datos de insiders\u2026
      </div>
    </div>
  </div>
</div>


`;

html = html.slice(0, startIdx) + NEW_SCREEN + html.slice(endIdx);
console.log('OK ' + (++n) + ': screen-topinvestors replaced');

// ══════════════════════════════════════════════════
// 3. Update tab label
// ══════════════════════════════════════════════════
fix('Update tab label',
  '<button data-screen="topinvestors" onclick="closeExtraTabRow()"><b>\u25c6</b><span>Mejores Inv.</span></button>',
  '<button data-screen="topinvestors" onclick="closeExtraTabRow()"><b>\u25c6</b><span>Insiders</span></button>'
);

// ══════════════════════════════════════════════════
// 4. Add insiders trigger in showScreen
// ══════════════════════════════════════════════════
fix('showScreen: trigger insiders load',
  "  if(name==='impuestos'&&dataReady)renderImpuestos();\r\n}",
  "  if(name==='impuestos'&&dataReady)renderImpuestos();\r\n  if(name==='topinvestors')_insLoad(_insCurrentSymbol);\r\n}"
);

// ══════════════════════════════════════════════════
// 5. Insert insiders JS before closing </script>
//    Use index-based insertion (avoids $ replacement issues)
// ══════════════════════════════════════════════════
const INSIDERS_JS = `
// ── Insiders (FMP Search Insider Trades API) ──────────────────────────────
const _INS_KEY = 'EYRk2QXBpsogqFUfHFb9CcR4bEqk3OZ7L0';
let _insData = null;
let _insFilterVal = 'all';
let _insCurrentSymbol = '';
let _insLoading = false;
let _insSearchDebounceTimer = null;

async function _insLoad(symbol) {
  if(symbol === undefined) symbol = _insCurrentSymbol;
  _insCurrentSymbol = symbol || '';
  if(_insLoading) return;
  _insLoading = true;
  const el = document.getElementById('insidersContent');
  if(el) el.innerHTML = '<div style="text-align:center;padding:50px 0;color:#8fa090;font-size:13px"><div style="font-size:28px;margin-bottom:10px">\u231B</div>Cargando insiders\u2026</div>';
  try {
    const sym = _insCurrentSymbol ? '&symbol='+encodeURIComponent(_insCurrentSymbol.toUpperCase()) : '';
    const url = 'https://financialmodelingprep.com/stable/insider-trading/search?page=0&limit=100'+sym+'&apikey='+_INS_KEY;
    const r = await fetch(url);
    if(!r.ok) throw new Error('HTTP '+r.status);
    const json = await r.json();
    _insData = Array.isArray(json) ? json : (json.data || json.results || []);
  } catch(e) {
    _insLoading = false;
    const el2 = document.getElementById('insidersContent');
    if(el2) el2.innerHTML = '<div style="text-align:center;padding:50px 0"><div style="font-size:28px;margin-bottom:10px">\u26A0\uFE0F</div><div style="color:#dc2626;font-size:13px;font-weight:600">'+e.message+'</div><button onclick="_insLoad()" style="margin-top:14px;padding:9px 20px;background:#142018;color:#fff;border:none;border-radius:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer">Reintentar</button></div>';
    return;
  }
  _insLoading = false;
  _insRender();
}

function _fmtMoney(v) {
  if(v >= 1e9) return (v/1e9).toFixed(1)+'B';
  if(v >= 1e6) return (v/1e6).toFixed(1)+'M';
  if(v >= 1e3) return (v/1e3).toFixed(0)+'K';
  return v.toFixed(0);
}

function _insRender() {
  const el = document.getElementById('insidersContent');
  if(!el) return;
  let rows = Array.isArray(_insData) ? _insData.slice() : [];

  if(_insFilterVal === 'buy') {
    rows = rows.filter(function(r){ return r.transactionType && /^P/i.test(r.transactionType); });
  } else if(_insFilterVal === 'sell') {
    rows = rows.filter(function(r){ return r.transactionType && /^S/i.test(r.transactionType); });
  }

  if(!rows.length) {
    el.innerHTML = '<div style="text-align:center;padding:60px 0;color:#8fa090;font-size:13px"><div style="font-size:32px;margin-bottom:10px">\uD83D\uDCED</div>Sin resultados para este filtro</div>';
    return;
  }

  const allBuys = (_insData||[]).filter(function(r){ return r.transactionType && /^P/i.test(r.transactionType); });
  const allSells = (_insData||[]).filter(function(r){ return r.transactionType && /^S/i.test(r.transactionType); });
  const buyVol = allBuys.reduce(function(s,r){ return s + (Number(r.securitiesTransacted)||0)*(Number(r.price)||0); }, 0);
  const sellVol = allSells.reduce(function(s,r){ return s + (Number(r.securitiesTransacted)||0)*(Number(r.price)||0); }, 0);

  var summaryHtml = '';
  if(_insFilterVal === 'all') {
    summaryHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">'
      + '<div style="background:#e6faf3;border-radius:14px;padding:14px;text-align:center">'
      + '<div style="font-size:22px;font-weight:800;color:#15803d">'+allBuys.length+'</div>'
      + '<div style="font-size:10px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:2px">Compras</div>'
      + (buyVol>0?'<div style="font-size:11px;color:#15803d;margin-top:4px;opacity:.8">'+_fmtMoney(buyVol)+'</div>':'')
      + '</div>'
      + '<div style="background:#fef2f2;border-radius:14px;padding:14px;text-align:center">'
      + '<div style="font-size:22px;font-weight:800;color:#dc2626">'+allSells.length+'</div>'
      + '<div style="font-size:10px;color:#dc2626;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:2px">Ventas</div>'
      + (sellVol>0?'<div style="font-size:11px;color:#dc2626;margin-top:4px;opacity:.8">'+_fmtMoney(sellVol)+'</div>':'')
      + '</div></div>';
  }

  var cardsHtml = rows.map(function(r) {
    var isBuy = r.transactionType && /^P/i.test(r.transactionType);
    var isSell = r.transactionType && /^S/i.test(r.transactionType);
    var color = isBuy ? '#15803d' : isSell ? '#dc2626' : '#8fa090';
    var bgBadge = isBuy ? '#e6faf3' : isSell ? '#fef2f2' : '#f0f4f2';
    var iconCls = isBuy ? '' : isSell ? ' sell' : ' neutral';
    var label = isBuy ? '\u25b2\u00a0COMPRA' : isSell ? '\u25bc\u00a0VENTA' : (r.transactionType||'\u2014');
    var sym = ((r.symbol||r.ticker||'\u2014')+'').toUpperCase();
    var initials = sym.replace(/[^A-Z]/g,'').slice(0,2)||sym.slice(0,2);
    var shares = r.securitiesTransacted != null ? Number(r.securitiesTransacted).toLocaleString('es-ES') : '\u2014';
    var priceVal = r.price ? Number(r.price).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '\u2014';
    var priceStr = r.price ? ('$'+priceVal) : '\u2014';
    var date = ((r.transactionDate||r.date||'\u2014')+'').slice(0,10);
    var insider = r.reportingName||r.insiderName||'\u2014';
    var role = r.typeOfOwner||r.position||'';
    var value = (Number(r.securitiesTransacted)||0) * (Number(r.price)||0);
    var valueStr = value > 1000 ? _fmtMoney(value) : '';
    var link = r.link||r.secLink||'';

    return '<div class="ins-card">'
      + '<div class="ins-icon'+iconCls+'">'+initials+'</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">'
      + '<span style="font-size:15px;font-weight:800;color:#142018">'+sym+'</span>'
      + '<span style="background:'+bgBadge+';color:'+color+';font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;letter-spacing:.04em;flex-shrink:0">'+label+'</span>'
      + (valueStr?'<span style="font-size:11px;font-weight:700;color:'+color+';margin-left:auto;flex-shrink:0">'+valueStr+'</span>':'')
      + '</div>'
      + '<div style="font-size:12px;color:#3d4f41;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+insider+'</div>'
      + (role?'<div style="font-size:10px;color:#8fa090;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+role+'</div>':'')
      + '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">'
      + '<span style="font-size:11px;font-weight:700;color:#142018">'+shares+' acc.</span>'
      + '<span style="font-size:11px;color:#8fa090">a '+priceStr+'</span>'
      + '<span style="font-size:11px;color:#b0bfb5;margin-left:auto">'+date+'</span>'
      + '</div>'
      + '</div>'
      + (link?'<a href="'+link+'" target="_blank" rel="noopener" style="color:#b0bfb5;font-size:13px;flex-shrink:0;text-decoration:none;padding:2px 0;align-self:flex-start" title="SEC Filing">\u2197</a>':'')
      + '</div>';
  }).join('');

  el.innerHTML = summaryHtml + cardsHtml;
}

function _insFilter(type) {
  _insFilterVal = type;
  var chips = {all:'insChipAll', buy:'insChipBuy', sell:'insChipSell'};
  Object.keys(chips).forEach(function(t) {
    var el = document.getElementById(chips[t]);
    if(el) el.classList.toggle('ins-chip-active', t === type);
  });
  if(_insData) _insRender(); else _insLoad();
}

function _insSearchDebounce() {
  clearTimeout(_insSearchDebounceTimer);
  var val = ((document.getElementById('insSearchInput')||{}).value||'').trim();
  var clr = document.getElementById('insSearchClear');
  if(clr) clr.style.display = val ? '' : 'none';
  _insSearchDebounceTimer = setTimeout(function() {
    _insData = null;
    _insLoad(val);
  }, 600);
}

function _insClearSearch() {
  var inp = document.getElementById('insSearchInput');
  if(inp) inp.value = '';
  var clr = document.getElementById('insSearchClear');
  if(clr) clr.style.display = 'none';
  _insData = null;
  _insLoad('');
}
`;

const scriptEnd = '</script>\r\n</body>';
const scriptIdx = html.lastIndexOf(scriptEnd);
if (scriptIdx === -1) {
  console.log('MISS: closing </script>');
} else {
  html = html.slice(0, scriptIdx) + INSIDERS_JS + '\n' + html.slice(scriptIdx);
  console.log('OK ' + (++n) + ': insiders JS added');
}

console.log('\nTotal: ' + n);
fs.writeFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', html, 'utf8');
console.log('Done!');
