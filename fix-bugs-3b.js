/**
 * fix-bugs-3b.js — Fix remaining bugs (CRLF-aware)
 * Run: node fix-bugs-3b.js
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
let changed = 0;

function apply(desc, oldStr, newStr) {
  if (!html.includes(oldStr)) {
    console.error('❌ NOT FOUND:', desc);
    return;
  }
  html = html.split(oldStr).join(newStr);
  console.log('✅', desc);
  changed++;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUG 3a: Reset hardcoded sub-score bar widths (57%, 86%) to 0% initially
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B3a: reset hsRiskBar to 0',
  'id="hsRiskBar" style="width:57%;background:#2dc98a;"',
  'id="hsRiskBar" style="width:0%;background:#e0e0e0;"'
);
apply(
  'B3a: reset hsRiskVal color',
  'id="hsRiskVal" style="color:#2dc98a;">—</span>',
  'id="hsRiskVal" style="color:#8fa090;">—</span>'
);
apply(
  'B3a: reset hsRentBar to 0',
  'id="hsRentBar" style="width:86%;background:#f5b731;"',
  'id="hsRentBar" style="width:0%;background:#e0e0e0;"'
);
apply(
  'B3a: reset hsRentVal color',
  'id="hsRentVal" style="color:#d97706;">—</span>',
  'id="hsRentVal" style="color:#8fa090;">—</span>'
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 3b: Update hsNum in renderAnalysisCharts so it's not stuck at "—"
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B3b: update hsNum in renderAnalysisCharts',
  'function renderAnalysisCharts(){\r\n  destroyAnalysisCharts();',
  "function renderAnalysisCharts(){\r\n  destroyAnalysisCharts();\r\n  try{const _hs=computeHealthScore();const _hsEl=document.getElementById('hsNum');if(_hsEl&&_hs.score>0)_hsEl.textContent=_hs.score;}catch(_){}"
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 5a: Empty iaInsightsList in HTML (hardcoded → dynamic)
// ─────────────────────────────────────────────────────────────────────────────
const insOld = '<div class="insight-list" id="iaInsightsList">\r\n        <div class="ins-row"><div class="ins-dot dot-red" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-red">Concentración · Urgente</div></div><div class="ins-text">Tienes <b>alta concentración</b> en pocos activos. Diversificar reduciría tu riesgo idiosincrático.</div><div class="ins-cta">Cómo diversificar →</div></div></div>\r\n        <div class="ins-row"><div class="ins-dot dot-yellow" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-yellow">Rendimiento · Watch</div></div><div class="ins-text" id="iaInsightReturn">Calculando rentabilidad…</div><div class="ins-cta">Ver comparativa →</div></div></div>\r\n        <div class="ins-row"><div class="ins-dot dot-blue" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-blue">Oportunidad</div></div><div class="ins-text">Añadir un ETF de mercados emergentes bajaría tu correlación a <b>0.47</b> y subiría tu Health Score a ~72.</div><div class="ins-badge b-blue" style="margin-top:6px;">+25 puntos de diversificación</div></div></div>\r\n        <div class="ins-row"><div class="ins-dot dot-green" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-green">Positivo</div></div><div class="ins-text" id="iaInsightFees">TER muy eficiente. Pagas mínimo en comisiones de gestión.</div><div class="ins-badge b-green" style="margin-top:6px;">Coste óptimo</div></div></div>\r\n      </div>';
apply('B5a: clear hardcoded iaInsightsList', insOld, '<div class="insight-list" id="iaInsightsList"></div>');

// ─────────────────────────────────────────────────────────────────────────────
// BUG 5b: Rebuild Vera insights in renderIA()
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B5b: replace renderIA insight section with dynamic version',
  "// Dynamic insight: return\r\n  const insRet=document.getElementById('iaInsightReturn');\r\n  if(insRet) insRet.innerHTML=`Tu portfolio lleva <b>${gainPct>=0?'+':''}${gainPct.toFixed(2)}%</b> acumulado sobre ${fe(invested)} invertido.`;",
  `// B5: Dynamic Vera insights — rebuilt from real portfolio data
  const _insEl=document.getElementById('iaInsightsList');
  if(_insEl){
    const isEs=currentLang==='es';
    const _rows=[];
    if(assets.length===0){
      _rows.push(\`<div class="ins-row"><div class="ins-dot dot-blue" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-blue">\${isEs?'Primeros pasos':'Getting started'}</div></div><div class="ins-text">\${isEs?'Añade tu primera posición para recibir análisis personalizados de Vera.':'Add your first position to receive personalised insights from Vera.'}</div></div></div>\`);
    } else if(diversif<40){
      const _topW=assets.length>0?Math.round(Math.max(...assets.map(a=>toDisplay(a.value,assetCcy(a))))/total*100):100;
      _rows.push(\`<div class="ins-row"><div class="ins-dot dot-red" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-red">\${isEs?'Concentración · Urgente':'Concentration · Urgent'}</div></div><div class="ins-text">\${isEs?'Tu activo mayor pesa un <b>'+_topW+'%</b> del portfolio. Alta concentración aumenta el riesgo.':'Your largest holding is <b>'+_topW+'%</b> of portfolio. High concentration increases risk.'}</div><div class="ins-cta">\${isEs?'Cómo diversificar →':'How to diversify →'}</div></div></div>\`);
    } else {
      _rows.push(\`<div class="ins-row"><div class="ins-dot dot-green" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-green">\${isEs?'Diversificación · Buena':'Diversification · Good'}</div></div><div class="ins-text">\${isEs?'Buena distribución entre activos. Tu portfolio está bien diversificado.':'Good distribution across assets. Your portfolio is well diversified.'}</div></div></div>\`);
    }
    const _retSign=gainPct>=0?'+':'';
    const _retCls=gainPct>=0?'brief-up':'brief-down';
    _rows.push(\`<div class="ins-row"><div class="ins-dot dot-yellow" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-yellow">\${isEs?'Rendimiento · Watch':'Performance · Watch'}</div></div><div class="ins-text" id="iaInsightReturn">\${isEs?'Tu portfolio lleva <b class="'+_retCls+'">'+_retSign+gainPct.toFixed(2)+'%</b> acumulado sobre '+fe(invested)+' invertido.':'Your portfolio is <b class="'+_retCls+'">'+_retSign+gainPct.toFixed(2)+'%</b> on '+fe(invested)+' invested.'}</div><div class="ins-cta">\${isEs?'Ver comparativa →':'See comparison →'}</div></div></div>\`);
    if(assets.length>0&&assets.length<5){
      const _projScore=Math.min(100,score+Math.round(15*(1-assets.length/5)));
      _rows.push(\`<div class="ins-row"><div class="ins-dot dot-blue" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-blue">\${isEs?'Oportunidad':'Opportunity'}</div></div><div class="ins-text">\${isEs?'Añadir un ETF de mercados emergentes reduciría tu correlación y subiría tu Health Score a ~'+_projScore+'.':'Adding an emerging markets ETF would reduce correlation and raise your Health Score to ~'+_projScore+'.'}</div><div class="ins-badge b-blue" style="margin-top:6px;">+\${_projScore-score} pts</div></div></div>\`);
    }
    const _tRows=assets.filter(a=>a.quantity>0&&(a.ter??AN_TER_MAP[a.isin])!=null);
    const _tTotV=assets.reduce((s,a)=>s+toDisplay(a.value,assetCcy(a)),0);
    if(_tRows.length>0&&_tTotV>0){
      const _tCostTotal=_tRows.reduce((s,a)=>{const t=a.ter??AN_TER_MAP[a.isin];return s+toDisplay(a.value,assetCcy(a))*t/100;},0);
      const _avgTer=(_tCostTotal/_tTotV*100);
      const _feeGood=_avgTer<0.30;
      _rows.push(\`<div class="ins-row"><div class="ins-dot \${_feeGood?'dot-green':'dot-yellow'}" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag \${_feeGood?'tag-green':'tag-yellow'}">\${isEs?'Comisiones':'Fees'}</div></div><div class="ins-text" id="iaInsightFees">\${isEs?'TER medio: ':'Avg TER: '}<b>\${_avgTer.toFixed(2)}%</b>. \${_feeGood?(isEs?'Coste muy eficiente para fondos indexados.':'Very efficient cost for index funds.'):(isEs?'Considera ETFs con menor TER para optimizar el retorno neto.':'Consider lower TER ETFs to optimise net return.')}</div>\${_feeGood?'<div class="ins-badge b-green" style="margin-top:6px;">'+(isEs?'Coste óptimo':'Optimal cost')+'</div>':''}</div></div>\`);
    }
    _insEl.innerHTML=_rows.join('');
  }`
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 6a: Add ID to alert price label
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B6a: add ID to alert price label',
  '<div class="liqLabel">Precio objetivo (\u20ac)</div>\r\n      <input class="liqInp" id="alertsPriceInput"',
  '<div class="liqLabel" id="alertsPriceLabel">Precio objetivo (\u20ac)</div>\r\n      <input class="liqInp" id="alertsPriceInput"'
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 6b: Update label when asset is selected
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B6b: update alert currency label in selectAlertsAsset',
  'function selectAlertsAsset(isin,el){\r\n  _alertsAssetISIN=isin;\r\n  document.querySelectorAll(\'#alertsAssetPicker .alertAssetRow\').forEach(r=>r.classList.remove(\'sel\'));\r\n  el.classList.add(\'sel\');\r\n  const asset=assets.find(a=>a.isin===isin);\r\n  if(asset){',
  "function selectAlertsAsset(isin,el){\r\n  _alertsAssetISIN=isin;\r\n  document.querySelectorAll('#alertsAssetPicker .alertAssetRow').forEach(r=>r.classList.remove('sel'));\r\n  el.classList.add('sel');\r\n  const asset=assets.find(a=>a.isin===isin);\r\n  if(asset){\r\n    const _lbl=document.getElementById('alertsPriceLabel');\r\n    if(_lbl){const _c=assetCcy(asset)||'EUR';const _s=_c==='USD'?'$':_c==='GBP'?'\u00a3':_c==='CHF'?'Fr':'\u20ac';_lbl.textContent=(currentLang==='es'?'Precio objetivo (':'Target price (')+_s+_c+')';}"
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 7: Update hsHistLabel dynamically in renderIA
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B7: update hsHistLabel in renderIA',
  "  // Health score pillars\r\n  const hsNumEl=document.getElementById('hsNum');",
  "  // B7: update score history trend label\r\n  const _hsTrend=document.getElementById('hsHistLabel');\r\n  if(_hsTrend){const isEs7=currentLang==='es';if(score>=70)_hsTrend.textContent=isEs7?'\u2191 mejorando':'\u2191 improving';else if(score>=50)_hsTrend.textContent=isEs7?'\u2192 estable':'\u2192 stable';else _hsTrend.textContent=isEs7?'\u2193 mejorable':'\u2193 needs work';_hsTrend.style.color=score>=70?'#1aab70':score>=50?'#d97706':'#f05252';}\r\n  // Health score pillars\r\n  const hsNumEl=document.getElementById('hsNum');"
);

// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html);
console.log(`\n${changed} fixes applied.`);
