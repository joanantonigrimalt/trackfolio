const fs = require('fs');
let html = fs.readFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', 'utf8');
const origLen = html.length;

// ── 1. CSS ───────────────────────────────────────────────────────────────────
const taxCSS = `
/* ── Impuestos screen ──────────────────────────────────────────────────────── */
#screen-impuestos .tx-hero{background:linear-gradient(150deg,#0c1e13 0%,#152d1e 55%,#0a1a0f 100%);border-radius:22px;padding:20px 18px 18px;position:relative;overflow:hidden;margin-bottom:12px}
#screen-impuestos .tx-hero::after{content:'';position:absolute;top:-80px;right:-80px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(29,179,106,.10) 0%,transparent 70%);pointer-events:none}
#screen-impuestos .tx-h-sup{font-size:9px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.12em;margin-bottom:5px}
#screen-impuestos .tx-h-yearbadge{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:3px 10px;font-size:11px;font-weight:700;color:rgba(255,255,255,.7);display:inline-flex;align-items:center;gap:6px;cursor:pointer}
#screen-impuestos .tx-h-status{background:rgba(29,179,106,.2);border:1px solid rgba(29,179,106,.3);border-radius:20px;padding:3px 10px;font-size:10px;font-weight:700;color:#2de899;display:inline-flex;align-items:center;gap:5px}
#screen-impuestos .tx-h-dot{width:5px;height:5px;border-radius:50%;background:#2de899}
#screen-impuestos .tx-h-albl{font-size:9px;font-weight:600;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;margin-top:14px}
#screen-impuestos .tx-h-amount{font-size:2.1rem;font-weight:800;color:#fff;letter-spacing:-.05em;line-height:1;font-family:'DM Mono',monospace}
#screen-impuestos .tx-h-sub{font-size:10px;color:rgba(255,255,255,.35);margin-top:3px}
#screen-impuestos .tx-h-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:14px}
#screen-impuestos .tx-h-box{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 10px}
#screen-impuestos .tx-h-blbl{font-size:8px;font-weight:600;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
#screen-impuestos .tx-h-bval{font-size:13px;font-weight:700;color:#fff;font-family:'DM Mono',monospace;letter-spacing:-.02em}
#screen-impuestos .tx-h-bval.pos{color:#2de899}
#screen-impuestos .tx-h-bval.warn{color:#fbbf24}
#screen-impuestos .tx-h-track{height:5px;background:rgba(255,255,255,.08);border-radius:5px;overflow:hidden;margin-top:14px}
#screen-impuestos .tx-h-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,#1db36a,#2de899)}
#screen-impuestos .tx-h-row{display:flex;justify-content:space-between;margin-bottom:5px}
#screen-impuestos .tx-h-rlbl{font-size:9px;font-weight:600;color:rgba(255,255,255,.35)}
#screen-impuestos .tx-h-rpct{font-size:9px;font-weight:700;color:rgba(255,255,255,.6);font-family:'DM Mono',monospace}
#screen-impuestos .tx-sec{display:flex;align-items:center;justify-content:space-between;margin:12px 0 8px}
#screen-impuestos .tx-sec-t{font-size:9px;font-weight:700;color:#8fa090;text-transform:uppercase;letter-spacing:.1em}
#screen-impuestos .tx-sec-lnk{font-size:10px;font-weight:600;color:#2563eb;cursor:pointer}
#screen-impuestos .tax-card{background:#fff;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.07),0 2px 8px rgba(0,0,0,.04);border:1px solid rgba(0,0,0,.07);overflow:hidden;margin-bottom:10px}
#screen-impuestos .tax-card-inner{padding:16px}
#screen-impuestos .src-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.06)}
#screen-impuestos .src-row:last-child{border-bottom:none}
#screen-impuestos .src-icon{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px}
#screen-impuestos .src-info{flex:1;min-width:0}
#screen-impuestos .src-name{font-size:12px;font-weight:700;color:#0f1c15}
#screen-impuestos .src-desc{font-size:10px;color:#8da098;margin-top:1px}
#screen-impuestos .src-right{text-align:right;flex-shrink:0}
#screen-impuestos .src-amt{font-size:13px;font-weight:700;color:#0f1c15;font-family:'DM Mono',monospace}
#screen-impuestos .src-tax{font-size:10px;font-weight:600;margin-top:2px;font-family:'DM Mono',monospace}
#screen-impuestos .src-tax.neg{color:#e03636}
#screen-impuestos .src-tax.pos{color:#1db36a}
#screen-impuestos .tx-row-item{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(0,0,0,.06)}
#screen-impuestos .tx-row-item:last-child{border-bottom:none}
#screen-impuestos .tx-logo{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#fff;flex-shrink:0}
#screen-impuestos .tx-inf{flex:1;min-width:0}
#screen-impuestos .tx-nm{font-size:12px;font-weight:700;color:#0f1c15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#screen-impuestos .tx-mt{font-size:10px;color:#8da098;margin-top:1px}
#screen-impuestos .tx-rt{text-align:right;flex-shrink:0}
#screen-impuestos .tx-gn{font-size:12px;font-weight:700;font-family:'DM Mono',monospace}
#screen-impuestos .tx-gn.pos{color:#1db36a}
#screen-impuestos .tx-gn.neg{color:#e03636}
#screen-impuestos .tx-tx{font-size:10px;font-weight:600;color:#8da098;margin-top:2px;font-family:'DM Mono',monospace}
#screen-impuestos .tx-tx.comp{color:#1db36a}
#screen-impuestos .brk-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06)}
#screen-impuestos .brk-row:last-child{border-bottom:none}
#screen-impuestos .brk-range{font-size:11px;font-weight:600;color:#3d5248;flex:1;font-family:'DM Mono',monospace}
#screen-impuestos .brk-bar{width:72px;height:5px;background:#f0f0f0;border-radius:4px;overflow:hidden;flex-shrink:0}
#screen-impuestos .brk-fill{height:100%;border-radius:4px}
#screen-impuestos .brk-pct{font-size:12px;font-weight:800;color:#0f1c15;font-family:'DM Mono',monospace;width:32px;text-align:right;flex-shrink:0}
#screen-impuestos .tx-badge{display:inline-flex;align-items:center;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:700;font-family:'DM Mono',monospace}
#screen-impuestos .tx-badge.pos{background:rgba(29,179,106,.09);color:#16924f}
#screen-impuestos .tx-badge.neg{background:rgba(224,54,54,.09);color:#e03636}
#screen-impuestos .tx-badge.warn{background:rgba(217,119,6,.1);color:#d97706}
#screen-impuestos .tx-badge.neu{background:#f0f0f0;color:#8da098}
#screen-impuestos .tx-disclaimer{background:#fefce8;border:1px solid #fde68a;border-radius:12px;padding:12px 14px;display:flex;gap:10px;margin-bottom:12px}
#screen-impuestos .tx-disclaimer-text{font-size:10.5px;color:#78350f;line-height:1.55}
#screen-impuestos .tx-export-btn{background:#16924f;color:#fff;border:none;border-radius:14px;padding:14px;font-family:inherit;font-size:13px;font-weight:700;width:100%;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(22,146,79,.3);margin-bottom:12px}
#screen-impuestos .tx-empty{text-align:center;padding:24px 16px;color:#8da098;font-size:12px}
`;

if (!html.includes('</style>')) { console.error('</style> not found'); process.exit(1); }
html = html.replace('</style>', taxCSS + '</style>');

// ── 2. HTML screen ────────────────────────────────────────────────────────────
const taxHTML = `
<!-- ============ IMPUESTOS ============ -->
<div id="screen-impuestos" class="screen">
  <div class="top" style="display:flex;align-items:center;justify-content:space-between">
    <div>
      <div class="title">Impuestos</div>
      <div class="sub">Resumen fiscal &middot; Espa&ntilde;a &middot; IRPF</div>
    </div>
    <button id="taxYearBtn" class="tx-h-yearbadge" onclick="cycleImpuestosYear()">
      <span id="taxYearLabel">2025</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
  </div>

  <!-- Hero dark card -->
  <div class="tx-hero" id="taxHero">
    <div class="tx-h-sup" id="taxHeroSup">Estimaci&oacute;n fiscal &middot; A&ntilde;o 2025</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
      <div class="tx-h-status"><div class="tx-h-dot"></div>Estimado</div>
    </div>
    <div class="tx-h-albl">Total base de ahorro (IRPF)</div>
    <div class="tx-h-amount" id="taxHeroAmount">—</div>
    <div class="tx-h-sub" id="taxHeroSub">Cuota &iacute;ntegra estimada</div>
    <div class="tx-h-grid" id="taxHeroGrid">
      <div class="tx-h-box"><div class="tx-h-blbl">Dividendos</div><div class="tx-h-bval pos" id="taxHDiv">—</div></div>
      <div class="tx-h-box"><div class="tx-h-blbl">Intereses</div><div class="tx-h-bval pos" id="taxHInt">—</div></div>
      <div class="tx-h-box"><div class="tx-h-blbl">Ganancias</div><div class="tx-h-bval pos" id="taxHGain">—</div></div>
    </div>
    <div class="tx-h-grid" style="margin-top:6px">
      <div class="tx-h-box"><div class="tx-h-blbl">Base ahorro</div><div class="tx-h-bval" id="taxHBase">—</div></div>
      <div class="tx-h-box"><div class="tx-h-blbl">Tipo medio</div><div class="tx-h-bval warn" id="taxHRate">—</div></div>
      <div class="tx-h-box"><div class="tx-h-blbl">Retenciones</div><div class="tx-h-bval" id="taxHRet">—</div></div>
    </div>
    <div style="margin-top:14px">
      <div class="tx-h-row"><span class="tx-h-rlbl">Retenciones ya aplicadas</span><span class="tx-h-rpct" id="taxRetPct">—</span></div>
      <div class="tx-h-track"><div class="tx-h-fill" id="taxRetBar" style="width:0%"></div></div>
      <div class="tx-h-row" style="margin-top:8px"><span class="tx-h-rlbl">Cuota a pagar (estimada)</span><span class="tx-h-rpct" style="color:#fbbf24;font-weight:800" id="taxDue">—</span></div>
    </div>
  </div>

  <!-- Desglose por tipo -->
  <div class="tx-sec"><span class="tx-sec-t">Desglose por tipo de renta</span></div>
  <div class="tax-card">
    <div class="tax-card-inner" id="taxBreakdown"></div>
    <div style="padding:0 16px 14px;border-top:1px solid rgba(0,0,0,.06)">
      <div style="font-size:11px;font-weight:700;color:#0f1c15;margin:12px 0 10px">Distribuci&oacute;n base de ahorro</div>
      <div style="height:72px;position:relative"><canvas id="taxBaseChart"></canvas></div>
    </div>
  </div>

  <!-- Tramos IRPF -->
  <div class="tx-sec"><span class="tx-sec-t">Tramos IRPF ahorro 2025</span><span class="tx-sec-lnk">Actualizado</span></div>
  <div class="tax-card">
    <div class="tax-card-inner" id="taxBrackets"></div>
  </div>

  <!-- Transacciones cerradas -->
  <div class="tx-sec"><span class="tx-sec-t">Ventas realizadas</span></div>
  <div class="tax-card">
    <div class="tax-card-inner" id="taxSellRows"></div>
    <div style="background:#f7f9f8;border-top:1px solid rgba(0,0,0,.06);padding:10px 16px" id="taxSellSummary"></div>
  </div>

  <!-- Dividendos -->
  <div class="tx-sec"><span class="tx-sec-t">Dividendos estimados</span></div>
  <div class="tax-card">
    <div class="tax-card-inner" id="taxDivRows"></div>
    <div style="padding:0 16px 14px;border-top:1px solid rgba(0,0,0,.06)">
      <div style="font-size:11px;font-weight:700;color:#0f1c15;margin:12px 0 10px">Dividendos mensuales estimados</div>
      <div style="height:72px;position:relative"><canvas id="taxDivChart"></canvas></div>
    </div>
  </div>

  <!-- Intereses liquidez -->
  <div class="tx-sec"><span class="tx-sec-t">Intereses &middot; Liquidez</span></div>
  <div class="tax-card">
    <div class="tax-card-inner" id="taxIntRows"></div>
  </div>

  <!-- Retenciones donut -->
  <div class="tx-sec"><span class="tx-sec-t">Retenciones practicadas</span></div>
  <div class="tax-card">
    <div class="tax-card-inner">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div><div style="font-size:13px;font-weight:700;color:#0f1c15">Total retenciones</div><div style="font-size:10px;color:#8da098;margin-top:2px">Ya descontadas por el broker</div></div>
        <span style="font-size:16px;font-weight:800;color:#1db36a;font-family:'DM Mono',monospace" id="taxRetTotal">—</span>
      </div>
      <div style="height:130px;position:relative"><canvas id="taxRetChart"></canvas></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:12px" id="taxRetGrid"></div>
    </div>
  </div>

  <!-- Disclaimer -->
  <div class="tx-disclaimer">
    <div style="font-size:15px;flex-shrink:0;margin-top:1px">⚠️</div>
    <div class="tx-disclaimer-text"><strong>Estimaci&oacute;n orientativa.</strong> Los c&aacute;lculos son aproximaciones basadas en tus datos. Consulta siempre con un asesor fiscal o usa los datos certificados de tu broker para presentar la declaraci&oacute;n. Finasset no ofrece asesoramiento fiscal.</div>
  </div>

  <!-- Export -->
  <button class="tx-export-btn" onclick="exportTaxPDF()">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Exportar resumen fiscal PDF
  </button>

  <div class="legal-footer" style="margin-bottom:0">
    <button class="legal-footer-link" onclick="showScreen('privacy')">Pol&iacute;tica de Privacidad</button>
    <div class="legal-footer-copy">&copy; 2026 Finasset &middot; Solo estimaciones orientativas</div>
  </div>
</div>

`;

// Insert before TAB BAR
if (!html.includes('<!-- TAB BAR -->')) { console.error('TAB BAR not found'); process.exit(1); }
html = html.replace('<!-- TAB BAR -->', taxHTML + '<!-- TAB BAR -->');

// ── 3. Wire up the Impuestos button ──────────────────────────────────────────
html = html.replace(
  '<button onclick="closeExtraTabRow();showToast(\'Impuestos próximamente\')"><b>◫</b><span>Impuestos</span></button>',
  '<button data-screen="impuestos" onclick="closeExtraTabRow()"><b>◫</b><span>Impuestos</span></button>'
);

// ── 4. showScreen: add impuestos case ────────────────────────────────────────
html = html.replace(
  "if(name==='alerts')renderAlertsScreen();",
  "if(name==='alerts')renderAlertsScreen();\n  if(name==='impuestos')renderImpuestos();"
);

// ── 5. JS renderImpuestos ────────────────────────────────────────────────────
const taxJS = `
// ========== IMPUESTOS ==========
let _taxYear = new Date().getFullYear() - 1; // default previous year
let _taxCharts = {};

function cycleImpuestosYear(){
  const years = [2025, 2024, 2023, 2022];
  const idx = years.indexOf(_taxYear);
  _taxYear = years[(idx + 1) % years.length];
  document.getElementById('taxYearLabel').textContent = _taxYear;
  renderImpuestos();
}

function _taxEuro(n){ return (Number.isFinite(n)?n:0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €'; }
function _taxIRPF(base){
  // Escala del ahorro España 2025
  if(base<=0)return 0;
  let tax=0;
  const brackets=[{limit:6000,rate:0.19},{limit:50000,rate:0.21},{limit:200000,rate:0.23},{limit:Infinity,rate:0.27}];
  let remaining=base,applied=0;
  for(const b of brackets){
    const tramo=Math.min(remaining, b.limit-applied);
    if(tramo<=0)break;
    tax+=tramo*b.rate;
    applied+=tramo;
    remaining-=tramo;
    if(remaining<=0)break;
  }
  return tax;
}

function _taxComputeGains(year){
  const ov = getOverrides();
  const results = [];
  for(const isin in ov){
    const entry = ov[isin];
    const txs = (entry.transactions||[]).filter(t=>t.type==='sell'&&String(t.date).startsWith(String(year)));
    if(!txs.length) continue;
    const asset = assets.find(a=>a.isin===isin)||{name:isin,shortName:isin};
    // Compute avg cost at time of sell by replaying buys
    const allTxs = [...(entry.transactions||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    let runQty = asset._rawQty||asset.quantity||0;
    let runCost = asset._rawBuyPrice||asset.buyPrice||0;
    // Replay transactions in order up to each sell
    let i=0;
    for(const tx of allTxs){
      if(tx.type==='buy'){
        const totalCost = runCost*runQty + tx.price*tx.qty;
        runQty += tx.qty;
        runCost = runQty>0 ? totalCost/runQty : tx.price;
      } else if(tx.type==='sell'){
        const gain = (tx.price - runCost) * tx.qty;
        if(String(tx.date).startsWith(String(year))){
          results.push({isin,name:asset.name||isin,shortName:asset.shortName||(asset.name||isin).split(' ').slice(0,2).join(' '),date:tx.date,qty:tx.qty,sellPrice:tx.price,avgCost:runCost,gain});
        }
        runQty = Math.max(0, runQty - tx.qty);
      }
    }
  }
  return results;
}

function _taxComputeDivs(){
  if(!_divDataCache||!_divDataCache.length) return [];
  return _divDataCache.filter(d=>d.annualPerShare>0).map(d=>{
    const a = assets.find(x=>x.isin===d.isin);
    if(!a||a.quantity<=0) return null;
    const gross = toDisplay(d.annualPerShare * a.quantity, assetCcy(a));
    return {isin:d.isin, name:a.name, shortName:a.shortName||(a.name||'').split(' ').slice(0,2).join(' '), gross, ret19: gross*0.19, net: gross*0.81, payMonths: d.payMonths||[]};
  }).filter(Boolean);
}

function _taxComputeInterest(){
  const liq = getLiquidity();
  return liq.filter(l=>(Number(l.rate)||0)>0).map(l=>{
    const amt = Number(l.amount)||0;
    const rate = Number(l.rate)||0;
    const gross = amt * rate / 100;
    return {name: l.name||l.provider||'Cuenta remunerada', rate, amount:amt, gross, ret19:gross*0.19, net:gross*0.81};
  });
}

function renderImpuestos(){
  const year = _taxYear;
  document.getElementById('taxHeroSup').textContent = 'Estimación fiscal · Año '+year;

  // Compute all sources
  const gains = _taxComputeGains(year);
  const divs  = _taxComputeDivs();
  const ints  = _taxComputeInterest();

  const grossGain = gains.reduce((s,t)=>s+t.gain,0);
  const grossDiv  = divs.reduce((s,d)=>s+d.gross,0);
  const grossInt  = ints.reduce((s,i)=>s+i.gross,0);
  const retDiv    = grossDiv*0.19;
  const retInt    = grossInt*0.19;
  const totalRet  = retDiv + retInt;

  const negGains  = Math.min(0, grossGain);
  const posGains  = Math.max(0, grossGain);
  const base      = posGains + grossDiv + grossInt + negGains; // negGains is negative
  const cuota     = _taxIRPF(base);
  const due       = Math.max(0, cuota - totalRet);
  const retPct    = cuota>0 ? Math.min(100, totalRet/cuota*100) : 0;
  const avgRate   = base>0 ? cuota/base*100 : 0;

  // Hero
  document.getElementById('taxHeroAmount').textContent = _taxEuro(cuota);
  document.getElementById('taxHeroSub').textContent = 'Cuota íntegra estimada · Base '+_taxEuro(base);
  document.getElementById('taxHDiv').textContent  = grossDiv>0 ? _taxEuro(grossDiv) : '—';
  document.getElementById('taxHInt').textContent  = grossInt>0 ? _taxEuro(grossInt) : '—';
  document.getElementById('taxHGain').textContent = _taxEuro(grossGain);
  document.getElementById('taxHBase').textContent = _taxEuro(base);
  document.getElementById('taxHRate').textContent = avgRate.toFixed(1)+'%';
  document.getElementById('taxHRet').textContent  = '-'+_taxEuro(totalRet);
  document.getElementById('taxRetPct').textContent= _taxEuro(totalRet)+' de '+_taxEuro(cuota);
  document.getElementById('taxRetBar').style.width = retPct+'%';
  document.getElementById('taxDue').textContent = _taxEuro(due);

  // Breakdown card
  const bd = document.getElementById('taxBreakdown');
  bd.innerHTML = [
    {icon:'💰',bg:'#dcfce7',name:'Dividendos recibidos',desc: divs.length+' activos con dividendos',amt:grossDiv,taxStr:'Retención 19% → -'+_taxEuro(retDiv),taxCls:grossDiv>0?'neg':''},
    {icon:'🏦',bg:'#dbeafe',name:'Intereses de cuentas',desc: ints.length+' cuenta'+(ints.length!==1?'s':'')+' remunerada'+(ints.length!==1?'s':''),amt:grossInt,taxStr:'Retención 19% → -'+_taxEuro(retInt),taxCls:grossInt>0?'neg':''},
    {icon:'📈',bg:'#f3e8ff',name:'Ganancias patrimoniales',desc:gains.filter(t=>t.gain>0).length+' ventas con ganancia',amt:posGains,taxStr:'Sin retención · A declarar',taxCls:''},
    negGains<0?{icon:'📉',bg:'#fee2e2',name:'Pérdidas a compensar',desc:gains.filter(t=>t.gain<0).length+' ventas con pérdida',amt:negGains,taxStr:'Reduce base imponible',taxCls:'pos',amtColor:'#e03636'}:null
  ].filter(Boolean).map(r=>\`
    <div class="src-row">
      <div class="src-icon" style="background:\${r.bg}">\${r.icon}</div>
      <div class="src-info"><div class="src-name">\${r.name}</div><div class="src-desc">\${r.desc}</div></div>
      <div class="src-right">
        <div class="src-amt" style="\${r.amtColor?'color:'+r.amtColor:''}">\${r.amt!==0?_taxEuro(r.amt):'—'}</div>
        <div class="src-tax \${r.taxCls}">\${r.taxStr}</div>
      </div>
    </div>\`).join('');

  // Base chart
  _renderTaxChart('taxBaseChart', {
    type:'bar',
    data:{
      labels:['Ganancias','Dividendos','Intereses','Pérdidas'],
      datasets:[{
        data:[posGains, grossDiv, grossInt, negGains||0],
        backgroundColor:['rgba(29,179,106,.8)','rgba(37,99,235,.75)','rgba(245,158,11,.75)','rgba(224,54,54,.75)'],
        borderRadius:4,barThickness:10
      }]
    },
    options:{
      indexAxis:'y',responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#0f1c15',cornerRadius:7,padding:7,callbacks:{label:c=>' '+(c.raw>=0?'+':'')+c.raw.toLocaleString('es-ES')+'€'}}},
      scales:{
        x:{grid:{color:'rgba(0,0,0,.04)'},border:{display:false},ticks:{font:{size:9},callback:v=>v>=1000?Math.round(v/1000)+'k€':v+'€'}},
        y:{grid:{display:false},border:{display:false},ticks:{font:{size:10,weight:'600'},color:'#3d5248'}}
      }
    }
  });

  // Brackets
  const BRACKETS=[{range:'Hasta 6.000 €',pct:'19%',bar:40,col:'#1db36a'},{range:'6.001 – 50.000 €',pct:'21%',bar:65,col:'#f5b731'},{range:'50.001 – 200.000 €',pct:'23%',bar:85,col:'#f97316'},{range:'Más de 200.000 €',pct:'27%',bar:100,col:'#e03636'}];
  const myBracket = base<=6000?0:base<=50000?1:base<=200000?2:3;
  document.getElementById('taxBrackets').innerHTML = '<div style="font-size:12px;font-weight:700;color:#0f1c15;margin-bottom:12px">Escala del ahorro · España 2025</div>'
    + BRACKETS.map((b,i)=>\`
    <div class="brk-row">
      <div class="brk-range">\${b.range}</div>
      <div class="brk-bar"><div class="brk-fill" style="width:\${b.bar}%;background:\${b.col}"></div></div>
      <div class="brk-pct">\${b.pct}</div>
      <div>\${i===myBracket?'<span class="tx-badge pos">Tu tramo</span>':'<span class="tx-badge neu">—</span>'}</div>
    </div>\`).join('')
    + (base>0?\`<div style="margin-top:10px;background:rgba(29,179,106,.09);border-radius:9px;padding:10px 12px;border-left:2px solid #16924f"><div style="font-size:11px;color:#3d5248;line-height:1.55">Tu base de ahorro de <strong style="color:#0f1c15">\${_taxEuro(base)}</strong> tributa principalmente al <strong style="color:#16924f">\${BRACKETS[myBracket].pct}</strong>. Cuota estimada: <strong style="font-family:'DM Mono',monospace">\${_taxEuro(cuota)}</strong> antes de retenciones.</div></div>\`:'');

  // Sell rows
  const sellEl = document.getElementById('taxSellRows');
  const COLORS=['#1d4ed8','#0f4c81','#6d28d9','#be123c','#374151','#166534','#854d0e','#1e40af'];
  if(!gains.length){
    sellEl.innerHTML='<div class="tx-empty">No hay ventas registradas para '+year+'.<br><small>Registra transacciones de venta en cada activo.</small></div>';
  } else {
    sellEl.innerHTML = gains.map((t,i)=>{
      const isPos=t.gain>=0;
      const initials=(t.shortName||t.name||'').slice(0,3).toUpperCase();
      const irpf = isPos ? _taxIRPF(t.gain) : 0;
      return\`<div class="tx-row-item">
        <div class="tx-logo" style="background:\${COLORS[i%COLORS.length]}">\${initials}</div>
        <div class="tx-inf"><div class="tx-nm">\${escapeHtml(t.shortName||t.name)}</div><div class="tx-mt">Vendido \${t.date} · \${t.qty} part. @ \${_taxEuro(t.sellPrice)}</div></div>
        <div class="tx-rt">
          <div class="tx-gn \${isPos?'pos':'neg'}">\${isPos?'+':''}\${_taxEuro(t.gain)}</div>
          <div class="tx-tx \${isPos?'':'comp'}">\${isPos?'IRPF: ~'+_taxEuro(irpf):'Compensa ganancia'}</div>
        </div>
      </div>\`;
    }).join('');
  }
  const neto = gains.reduce((s,t)=>s+t.gain,0);
  document.getElementById('taxSellSummary').innerHTML = \`
    <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:11px;font-weight:600;color:#3d5248">Ganancia neta transmisiones</span><span class="tx-badge \${neto>=0?'pos':'neg'}">\${neto>=0?'+':''}\${_taxEuro(neto)}</span></div>
  \`;

  // Dividend rows
  const divEl = document.getElementById('taxDivRows');
  if(!divs.length){
    divEl.innerHTML='<div class="tx-empty">No hay datos de dividendos disponibles.<br><small>Visita la pestaña Dividendos primero para cargar los datos.</small></div>';
  } else {
    divEl.innerHTML = divs.slice(0,6).map((d,i)=>{
      const initials=(d.shortName||'').slice(0,4).toUpperCase();
      const freq=d.payMonths.length>0?d.payMonths.length+' pagos/año':'Anual';
      return\`<div class="tx-row-item">
        <div class="tx-logo" style="background:\${COLORS[i%COLORS.length]}">\${initials}</div>
        <div class="tx-inf"><div class="tx-nm">\${escapeHtml(d.shortName||d.name)}</div><div class="tx-mt">\${freq}</div></div>
        <div class="tx-rt">
          <div class="tx-gn pos">+\${_taxEuro(d.gross)}</div>
          <div class="tx-tx">Ret. 19%: -\${_taxEuro(d.ret19)}</div>
        </div>
      </div>\`;
    }).join('');
  }

  // Monthly div chart
  const divMonthly = Array(12).fill(0);
  divs.forEach(d=>{
    const pm = d.payMonths.length ? d.payMonths : [2,5,8,11];
    const perPay = d.gross / pm.length;
    pm.forEach(m=>{ if(m>=0&&m<12) divMonthly[m]+=perPay; });
  });
  _renderTaxChart('taxDivChart',{
    type:'bar',
    data:{
      labels:['E','F','M','A','M','J','J','A','S','O','N','D'],
      datasets:[{data:divMonthly.map(v=>parseFloat(v.toFixed(2))),backgroundColor:'rgba(29,179,106,.75)',hoverBackgroundColor:'#1db36a',borderRadius:4,barThickness:14}]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{backgroundColor:'#0f1c15',cornerRadius:7,padding:7,callbacks:{label:c=>' +'+c.raw.toFixed(2)+'€'}}},
      scales:{
        x:{grid:{display:false},border:{display:false},ticks:{font:{size:9},color:'#8da098'}},
        y:{grid:{color:'rgba(0,0,0,.04)'},border:{display:false},ticks:{font:{size:9},callback:v=>v+'€'}}
      }
    }
  });

  // Interest rows
  const intEl = document.getElementById('taxIntRows');
  if(!ints.length){
    intEl.innerHTML='<div class="tx-empty">No hay cuentas remuneradas con tasa registrada.<br><small>Añade liquidez con tasa de interés para calcular este apartado.</small></div>';
  } else {
    intEl.innerHTML = ints.map((it,i)=>\`
      <div class="tx-row-item">
        <div class="tx-logo" style="background:\${COLORS[i%COLORS.length]}">\${(it.name||'').slice(0,2).toUpperCase()}</div>
        <div class="tx-inf"><div class="tx-nm">\${escapeHtml(it.name)}</div><div class="tx-mt">\${it.rate}% TAE · \${_taxEuro(it.amount)}</div></div>
        <div class="tx-rt">
          <div class="tx-gn pos">+\${_taxEuro(it.gross)}</div>
          <div class="tx-tx">Ret. 19%: -\${_taxEuro(it.ret19)}</div>
        </div>
      </div>\`).join('')
      + \`<div style="display:flex;justify-content:space-between;align-items:center;padding-top:9px;margin-top:4px;border-top:1px solid rgba(0,0,0,.06)">
        <span style="font-size:11px;font-weight:600;color:#3d5248">Total intereses</span>
        <span class="tx-badge pos">+\${_taxEuro(grossInt)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px">
        <span style="font-size:11px;font-weight:600;color:#3d5248">Retenciones aplicadas</span>
        <span class="tx-badge neg">-\${_taxEuro(retInt)}</span>
      </div>\`;
  }

  // Retenciones donut
  document.getElementById('taxRetTotal').textContent = _taxEuro(totalRet);
  const retGrid = document.getElementById('taxRetGrid');
  retGrid.innerHTML = [
    {lbl:'Dividendos',val:retDiv,bg:'rgba(29,179,106,.09)',col:'#1db36a'},
    {lbl:'Intereses',val:retInt,bg:'rgba(37,99,235,.09)',col:'#2563eb'}
  ].map(r=>\`<div style="background:\${r.bg};border-radius:9px;padding:9px 11px">
    <div style="font-size:8px;color:#8da098;text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:3px">\${r.lbl}</div>
    <div style="font-size:14px;font-weight:700;color:\${r.col};font-family:'DM Mono',monospace">\${_taxEuro(r.val)}</div>
  </div>\`).join('');

  _renderTaxChart('taxRetChart',{
    type:'doughnut',
    data:{
      labels:['Dividendos','Intereses'],
      datasets:[{data:[parseFloat(retDiv.toFixed(2)),parseFloat(retInt.toFixed(2))],backgroundColor:['#1db36a','#2563eb'],borderWidth:3,borderColor:'#fff',hoverOffset:4}]
    },
    options:{
      cutout:'62%',responsive:true,maintainAspectRatio:false,
      plugins:{
        legend:{display:true,position:'right',labels:{font:{size:10,weight:'600'},color:'#3d5248',boxWidth:8,boxHeight:8,padding:10,usePointStyle:true,pointStyleWidth:8}},
        tooltip:{backgroundColor:'#0f1c15',cornerRadius:7,padding:8,callbacks:{label:c=>' '+c.label+': '+_taxEuro(c.raw)}}
      }
    }
  });
}

function _renderTaxChart(id, config){
  if(_taxCharts[id]){try{_taxCharts[id].destroy();}catch(_){}}
  const canvas=document.getElementById(id);
  if(!canvas)return;
  _taxCharts[id]=new Chart(canvas,config);
}

function exportTaxPDF(){
  showToast('Exportación PDF próximamente');
}

`;

// Insert JS before the closing </script> — actually before the last line of JS
const jsAnchor = '// ========== PRICE ALERTS ==========';
if(!html.includes(jsAnchor)){
  // fallback: insert before </script>
  html = html.replace('</script>\n</body>', taxJS + '\n</script>\n</body>');
} else {
  html = html.replace(jsAnchor, taxJS + '\n' + jsAnchor);
}

console.log('Chars added:', html.length - origLen);
fs.writeFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', html, 'utf8');
console.log('Done!');
