/**
 * fix-insiders-frontend.js
 * Replaces the insiders JS section in index.html with the new discovery view
 */
const fs = require('fs');
const html_orig = fs.readFileSync('index.html', 'utf8');

// Find boundaries
const start = html_orig.indexOf('// \u2500\u2500 Insiders (FMP Search Insider Trades API)');
if (start === -1) { console.error('START NOT FOUND'); process.exit(1); }

const clearFnStart = html_orig.indexOf('function _insClearSearch()', start);
const endMarker    = html_orig.indexOf("_insLoad('');", clearFnStart);
// end = after the closing } of _insClearSearch
const end = endMarker + "_insLoad('');".length + '\r\n}'.length;

console.log(`Replacing ${end - start} chars (${start} → ${end})`);

const newCode = `// \u2500\u2500 Insiders \u2014 SEC EDGAR Form 4 filings \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
let _insData = null;
let _insFilterVal = 'all';
let _insCurrentSymbol = '';
let _insLoading = false;
let _insSearchDebounceTimer = null;
let _insIsDiscovery = false;

async function _insLoad(symbol) {
  if(symbol === undefined) symbol = _insCurrentSymbol;
  _insCurrentSymbol = (symbol||'').trim().toUpperCase();
  if(_insLoading) return;
  _insLoading = true;
  _insIsDiscovery = !_insCurrentSymbol;
  const el = document.getElementById('insidersContent');
  if(el) el.innerHTML = '<div style="text-align:center;padding:50px 0;color:#8fa090;font-size:13px"><div style="font-size:28px;margin-bottom:10px">\u231b</div>'+(currentLang==='es'?'Cargando datos de insiders\u2026':'Loading insider data\u2026')+'</div>';
  try {
    const url = _insCurrentSymbol ? '/api/insiders?symbol='+encodeURIComponent(_insCurrentSymbol) : '/api/insiders';
    const r = await fetch(url);
    if(!r.ok) throw new Error('HTTP '+r.status);
    const json = await r.json();
    _insData = Array.isArray(json) ? json : (json.data||json.results||[]);
  } catch(e) {
    _insLoading = false;
    const el2 = document.getElementById('insidersContent');
    if(el2) el2.innerHTML = '<div style="text-align:center;padding:50px 0"><div style="font-size:28px;margin-bottom:10px">\u26a0\ufe0f</div><div style="color:#dc2626;font-size:13px;font-weight:600">'+e.message+'</div><button onclick="_insLoad()" style="margin-top:14px;padding:9px 20px;background:#142018;color:#fff;border:none;border-radius:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer">'+(currentLang==='es'?'Reintentar':'Retry')+'</button></div>';
    return;
  }
  _insLoading = false;
  _insRender();
}

function _fmtMoney(v) {
  if(v >= 1e9) return '$'+(v/1e9).toFixed(1)+'B';
  if(v >= 1e6) return '$'+(v/1e6).toFixed(1)+'M';
  if(v >= 1e3) return '$'+(v/1e3).toFixed(0)+'K';
  return '$'+Math.round(v);
}

function _insCard(r) {
  const isBuy  = /^P/i.test(r.transactionType||'');
  const isSell = /^S/i.test(r.transactionType||'');
  const color   = isBuy ? '#15803d' : isSell ? '#dc2626' : '#8fa090';
  const bgBadge = isBuy ? '#e6faf3' : isSell ? '#fef2f2' : '#f0f4f2';
  const label   = isBuy ? '\u25b2 COMPRA' : isSell ? '\u25bc VENTA' : (r.transactionType||'\u2014');
  const sym     = ((r.symbol||r.ticker||'')+'').toUpperCase()||'??';
  const co      = r.companyName||'';
  const shares  = Number(r.securitiesTransacted)||0;
  const price   = Number(r.price)||0;
  const value   = shares * price;
  const sharesStr = shares ? shares.toLocaleString('es-ES') : '\u2014';
  const priceStr  = price  ? '$'+price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '\u2014';
  const valueStr  = value > 500 ? _fmtMoney(value) : '';
  const date    = ((r.transactionDate||r.date||'')+'').slice(0,10);
  const insider = r.reportingName||r.insiderName||'\u2014';
  const role    = r.typeOfOwner||r.position||'';
  const link    = r.link||r.secLink||'';
  const isDeriv = r.isDerivative;
  return '<div class="ins-card">'
    +'<div class="ins-icon'+(isBuy?'':isSell?' sell':' neutral')+'" style="flex-shrink:0">'+sym.slice(0,2)+'</div>'
    +'<div style="flex:1;min-width:0">'
    +'<div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;flex-wrap:wrap">'
    +'<span style="font-size:14px;font-weight:800;color:#142018">'+sym+'</span>'
    +(co?'<span style="font-size:11px;color:#8fa090;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">'+co+'</span>':'')
    +'<span style="background:'+bgBadge+';color:'+color+';font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;flex-shrink:0">'+label+(isDeriv?' (RSU)':'')+'</span>'
    +'</div>'
    +'<div style="font-size:12px;color:#3d4f41;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+insider+'</div>'
    +(role?'<div style="font-size:10px;color:#8fa090;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+role+'</div>':'')
    +'<div style="display:flex;align-items:center;gap:8px;margin-top:5px;flex-wrap:wrap">'
    +'<span style="font-size:11px;font-weight:700;color:#142018">'+sharesStr+' acc.</span>'
    +'<span style="font-size:11px;color:#8fa090">@ '+priceStr+'</span>'
    +(valueStr?'<span style="font-size:11px;font-weight:700;color:'+color+'">'+valueStr+'</span>':'')
    +'<span style="font-size:11px;color:#b0bfb5;margin-left:auto">'+date+'</span>'
    +'</div>'
    +'</div>'
    +(link?'<a href="'+link+'" target="_blank" rel="noopener" style="color:#b0bfb5;font-size:13px;flex-shrink:0;text-decoration:none;align-self:flex-start;padding:2px 0" title="SEC Filing">\u2197</a>':'')
    +'</div>';
}

function _insRender() {
  const el = document.getElementById('insidersContent');
  if(!el) return;
  const all = Array.isArray(_insData) ? _insData : [];

  // Discovery mode: two sections Compras / Ventas sorted by value
  if(_insIsDiscovery) {
    if(!all.length) {
      el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#8fa090;font-size:13px">'
        +'<div style="font-size:32px;margin-bottom:10px">\uD83D\uDD0D</div>'
        +(currentLang==='es'?'Busca un s\u00edmbolo arriba para ver operaciones<br><br><span style="font-size:11px;opacity:.7">Ej: AAPL \u00b7 MSFT \u00b7 NVDA \u00b7 TSLA</span>':'Search a symbol above to view insider trades<br><br><span style="font-size:11px;opacity:.7">E.g.: AAPL \u00b7 MSFT \u00b7 NVDA \u00b7 TSLA</span>')
        +'</div>';
      return;
    }
    const buys  = all.filter(r => /^P/i.test(r.transactionType||'') && !r.isDerivative)
                     .sort((a,b) => (b.securitiesTransacted*b.price)-(a.securitiesTransacted*a.price))
                     .slice(0,20);
    const sells = all.filter(r => /^S/i.test(r.transactionType||''))
                     .sort((a,b) => (b.securitiesTransacted*b.price)-(a.securitiesTransacted*a.price))
                     .slice(0,20);
    const buyTot  = buys.reduce((s,r)=>s+(Number(r.securitiesTransacted)||0)*(Number(r.price)||0),0);
    const sellTot = sells.reduce((s,r)=>s+(Number(r.securitiesTransacted)||0)*(Number(r.price)||0),0);
    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px">'
      +'<div style="background:#e6faf3;border-radius:14px;padding:12px;text-align:center">'
      +'<div style="font-size:20px;font-weight:800;color:#15803d">'+buys.length+'</div>'
      +'<div style="font-size:10px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:.05em">'+(currentLang==='es'?'Compras directas':'Direct Buys')+'</div>'
      +(buyTot>0?'<div style="font-size:11px;color:#15803d;margin-top:3px;opacity:.8">'+_fmtMoney(buyTot)+'</div>':'')
      +'</div>'
      +'<div style="background:#fef2f2;border-radius:14px;padding:12px;text-align:center">'
      +'<div style="font-size:20px;font-weight:800;color:#dc2626">'+sells.length+'</div>'
      +'<div style="font-size:10px;color:#dc2626;font-weight:700;text-transform:uppercase;letter-spacing:.05em">'+(currentLang==='es'?'Ventas':'Sells')+'</div>'
      +(sellTot>0?'<div style="font-size:11px;color:#dc2626;margin-top:3px;opacity:.8">'+_fmtMoney(sellTot)+'</div>':'')
      +'</div></div>';
    if(buys.length){
      html += '<div style="font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">\u25b2 '+(currentLang==='es'?'Compras por volumen':'Top Buys by Value')+'</div>';
      html += buys.map(_insCard).join('');
    }
    if(sells.length){
      html += '<div style="font-size:12px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.06em;margin:14px 0 8px">\u25bc '+(currentLang==='es'?'Ventas por volumen':'Top Sells by Value')+'</div>';
      html += sells.map(_insCard).join('');
    }
    el.innerHTML = html;
    return;
  }

  // Symbol mode: filter + list
  let rows = all.slice();
  if(_insFilterVal === 'buy')  rows = rows.filter(r => /^P/i.test(r.transactionType||''));
  if(_insFilterVal === 'sell') rows = rows.filter(r => /^S/i.test(r.transactionType||''));

  if(!rows.length) {
    const notFound = !all.length;
    el.innerHTML = '<div style="text-align:center;padding:60px 0;color:#8fa090;font-size:13px">'
      +'<div style="font-size:32px;margin-bottom:10px">'+(notFound?'\uD83C\uDFE2':'\uD83D\uDCED')+'</div>'
      +(notFound
        ?(currentLang==='es'?'No hay datos SEC para este s\u00edmbolo<br><span style="font-size:11px;opacity:.7">Solo empresas cotizadas en EE.UU. (NYSE/NASDAQ)</span>':'No SEC data for this symbol<br><span style="font-size:11px;opacity:.7">US-listed companies only (NYSE/NASDAQ)</span>')
        :(currentLang==='es'?'Sin resultados para este filtro':'No results for this filter'))
      +'</div>';
    return;
  }

  const buys  = all.filter(r => /^P/i.test(r.transactionType||''));
  const sells = all.filter(r => /^S/i.test(r.transactionType||''));
  const bVol  = buys.reduce((s,r)=>s+(Number(r.securitiesTransacted)||0)*(Number(r.price)||0),0);
  const sVol  = sells.reduce((s,r)=>s+(Number(r.securitiesTransacted)||0)*(Number(r.price)||0),0);
  const co    = (all[0]||{}).companyName;
  const summary = (_insFilterVal==='all')
    ? (co?'<div style="font-size:13px;font-weight:700;color:#142018;margin-bottom:10px">'+co+'</div>':'')
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">'
      +'<div style="background:#e6faf3;border-radius:12px;padding:12px;text-align:center">'
      +'<div style="font-size:20px;font-weight:800;color:#15803d">'+buys.length+'</div>'
      +'<div style="font-size:10px;color:#15803d;font-weight:700;text-transform:uppercase">'+(currentLang==='es'?'Compras':'Buys')+'</div>'
      +(bVol>0?'<div style="font-size:11px;color:#15803d;opacity:.8">'+_fmtMoney(bVol)+'</div>':'')
      +'</div>'
      +'<div style="background:#fef2f2;border-radius:12px;padding:12px;text-align:center">'
      +'<div style="font-size:20px;font-weight:800;color:#dc2626">'+sells.length+'</div>'
      +'<div style="font-size:10px;color:#dc2626;font-weight:700;text-transform:uppercase">'+(currentLang==='es'?'Ventas':'Sells')+'</div>'
      +(sVol>0?'<div style="font-size:11px;color:#dc2626;opacity:.8">'+_fmtMoney(sVol)+'</div>':'')
      +'</div></div>'
    : '';
  el.innerHTML = summary + rows.map(_insCard).join('');
}

function _insFilter(type) {
  _insFilterVal = type;
  const chips = {all:'insChipAll', buy:'insChipBuy', sell:'insChipSell'};
  Object.keys(chips).forEach(t => {
    const el2 = document.getElementById(chips[t]);
    if(el2) el2.classList.toggle('ins-chip-active', t === type);
  });
  if(_insData !== null) _insRender(); else _insLoad();
}

function _insSearchDebounce() {
  clearTimeout(_insSearchDebounceTimer);
  const val = ((document.getElementById('insSearchInput')||{}).value||'').trim();
  const clr = document.getElementById('insSearchClear');
  if(clr) clr.style.display = val ? '' : 'none';
  _insSearchDebounceTimer = setTimeout(function() {
    _insData = null;
    _insLoad(val);
  }, 600);
}

function _insClearSearch() {
  const inp = document.getElementById('insSearchInput');
  if(inp) inp.value = '';
  const clr = document.getElementById('insSearchClear');
  if(clr) clr.style.display = 'none';
  _insData = null;
  _insLoad('');
}`;

const result = html_orig.slice(0, start) + newCode + html_orig.slice(end);
fs.writeFileSync('index.html', result);
console.log(`Done. ${end - start} chars replaced. New file length: ${result.length}`);
