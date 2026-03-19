/**
 * fix-bugs-3.js — Fix 8 UX/data bugs
 * Run: node fix-bugs-3.js
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
// BUG 2: "Rendimiento YTD 2025" — hardcoded year
// Add ID so we can update it dynamically
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B2: add ID to YTD label',
  '<div style="font-size:11px;color:#8fa090;margin-top:2px">Rendimiento acumulado · YTD 2025</div>',
  '<div id="ytdYearLabel" style="font-size:11px;color:#8fa090;margin-top:2px">Rendimiento acumulado · YTD 2025</div>'
);

// Update it in _anRenderPerfBars() — it's called from renderAnalysisCharts()
apply(
  'B2: update YTD year dynamically in _anRenderPerfBars',
  'function _anRenderPerfBars(){',
  'function _anRenderPerfBars(){const _ytdEl=document.getElementById(\'ytdYearLabel\');if(_ytdEl){const _yr=new Date().getFullYear();_ytdEl.textContent=(currentLang===\'es\'?\'Rendimiento acumulado · YTD \':\'YTD performance · \')+_yr;}'
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 3: Health Score shows —/100 even when sub-scores are computed
// The hsNum element starts as "—" and is only updated when renderIA() fires.
// Also update it in renderAnalysisCharts so it's filled when Analysis tab opens.
// Also reset the hardcoded sub-score bars in HTML to 0%.
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B3: reset hardcoded hs sub-score bars to 0 initially',
  '<div class="pr"><span class="pr-label">Diversif.</span><div class="pr-track"><div class="pr-fill" id="hsDiversifBar" style="width:0%;background:#e0e0e0;"></div></div><span class="pr-val" id="hsDiversifVal" style="color:#f05252;">—</span></div>\n          <div class="pr"><span class="pr-label">Riesgo</span><div class="pr-track"><div class="pr-fill" id="hsRiskBar" style="width:57%;background:#2dc98a;"></div></div><span class="pr-val" id="hsRiskVal" style="color:#2dc98a;">—</span></div>\n          <div class="pr"><span class="pr-label">Rentabilidad</span><div class="pr-track"><div class="pr-fill" id="hsRentBar" style="width:86%;background:#f5b731;"></div></div><span class="pr-val" id="hsRentVal" style="color:#d97706;">—</span></div>',
  '<div class="pr"><span class="pr-label">Diversif.</span><div class="pr-track"><div class="pr-fill" id="hsDiversifBar" style="width:0%;background:#e0e0e0;"></div></div><span class="pr-val" id="hsDiversifVal" style="color:#f05252;">—</span></div>\n          <div class="pr"><span class="pr-label">Riesgo</span><div class="pr-track"><div class="pr-fill" id="hsRiskBar" style="width:0%;background:#e0e0e0;"></div></div><span class="pr-val" id="hsRiskVal" style="color:#8fa090;">—</span></div>\n          <div class="pr"><span class="pr-label">Rentabilidad</span><div class="pr-track"><div class="pr-fill" id="hsRentBar" style="width:0%;background:#e0e0e0;"></div></div><span class="pr-val" id="hsRentVal" style="color:#8fa090;">—</span></div>'
);

// Also update Health Score ring when renderAnalysisCharts fires (not just renderIA)
apply(
  'B3: update health score in renderAnalysisCharts entry point',
  'function renderAnalysisCharts(){\n  destroyAnalysisCharts();',
  'function renderAnalysisCharts(){\n  destroyAnalysisCharts();\n  // B3: update HS ring so it\'s not stuck at — when analysis tab opens\n  try{const _hs=computeHealthScore();const _hsEl=document.getElementById(\'hsNum\');if(_hsEl&&_hs.score>0)_hsEl.textContent=_hs.score;}catch(_){}'
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 4: "1/5 análisis usados" — add reset period info
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B4: add reset period to psUpdated initial text',
  '<div class="ps-updated" id="psUpdated">Actualizado: hace 1 min · 1/5 análisis usados</div>',
  '<div class="ps-updated" id="psUpdated">Actualizado: hace 1 min · 1/5 análisis usados · reset lunes</div>'
);

apply(
  'B4: add reset period to refreshScore update text',
  'upd.textContent=\'Actualizado: ahora mismo · 2/5 análisis usados\';',
  'upd.textContent=\'Actualizado: ahora mismo · 2/5 análisis usados · reset lunes\';'
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 5: Vera's insights are hardcoded — make them dynamic in renderIA()
// Replace the hardcoded #iaInsightsList HTML with an empty container,
// then in renderIA() populate it based on real portfolio data.
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B5: empty iaInsightsList in HTML (to be populated by renderIA)',
  `<div class="insight-list" id="iaInsightsList">
        <div class="ins-row"><div class="ins-dot dot-red" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-red">Concentración · Urgente</div></div><div class="ins-text">Tienes <b>alta concentración</b> en pocos activos. Diversificar reduciría tu riesgo idiosincrático.</div><div class="ins-cta">Cómo diversificar →</div></div></div>
        <div class="ins-row"><div class="ins-dot dot-yellow" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-yellow">Rendimiento · Watch</div></div><div class="ins-text" id="iaInsightReturn">Calculando rentabilidad…</div><div class="ins-cta">Ver comparativa →</div></div></div>
        <div class="ins-row"><div class="ins-dot dot-blue" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-blue">Oportunidad</div></div><div class="ins-text">Añadir un ETF de mercados emergentes bajaría tu correlación a <b>0.47</b> y subiría tu Health Score a ~72.</div><div class="ins-badge b-blue" style="margin-top:6px;">+25 puntos de diversificación</div></div></div>
        <div class="ins-row"><div class="ins-dot dot-green" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-green">Positivo</div></div><div class="ins-text" id="iaInsightFees">TER muy eficiente. Pagas mínimo en comisiones de gestión.</div><div class="ins-badge b-green" style="margin-top:6px;">Coste óptimo</div></div></div>
      </div>`,
  '<div class="insight-list" id="iaInsightsList"></div>'
);

// In renderIA(), after updating iaInsightReturn, rebuild the insights list
apply(
  'B5: rebuild Vera insights dynamically in renderIA',
  '  // Dynamic insight: return\n  const insRet=document.getElementById(\'iaInsightReturn\');\n  if(insRet) insRet.innerHTML=`Tu portfolio lleva <b>${gainPct>=0?\'+\':\'\'}${gainPct.toFixed(2)}%</b> acumulado sobre ${fe(invested)} invertido.`;',
  `  // B5: Dynamic Vera insights — rebuild based on real portfolio data
  const _insEl=document.getElementById('iaInsightsList');
  if(_insEl){
    const isEs=currentLang==='es';
    const _rows=[];
    // Insight 1: concentration / diversification
    if(assets.length===0){
      _rows.push(\`<div class="ins-row"><div class="ins-dot dot-blue" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-blue">\${isEs?'Primeros pasos':'Getting started'}</div></div><div class="ins-text">\${isEs?'Añade tu primera posición para recibir análisis personalizados de Vera.':'Add your first position to receive personalised insights from Vera.'}</div></div></div>\`);
    } else if(diversif<40){
      const pct=assets.length>0?Math.round(Math.max(...assets.map(a=>toDisplay(a.value,assetCcy(a))))/total*100):100;
      _rows.push(\`<div class="ins-row"><div class="ins-dot dot-red" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-red">\${isEs?'Concentración · Urgente':'Concentration · Urgent'}</div></div><div class="ins-text">\${isEs?\`Tu activo mayor pesa un <b>\${pct}%</b> del portfolio. Alta concentración aumenta el riesgo.\`:\`Your largest holding is <b>\${pct}%</b> of the portfolio. High concentration increases risk.</b>\`}</div><div class="ins-cta">\${isEs?'Cómo diversificar →':'How to diversify →'}</div></div></div>\`);
    } else if(diversif<70){
      _rows.push(\`<div class="ins-row"><div class="ins-dot dot-yellow" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-yellow">\${isEs?'Diversificación · Mejorable':'Diversification · Could improve'}</div></div><div class="ins-text">\${isEs?'Diversificación moderada. Añadir activos no correlacionados mejoraría tu perfil de riesgo.':'Moderate diversification. Adding uncorrelated assets would improve your risk profile.'}</div></div></div>\`);
    } else {
      _rows.push(\`<div class="ins-row"><div class="ins-dot dot-green" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-green">\${isEs?'Diversificación · Buena':'Diversification · Good'}</div></div><div class="ins-text">\${isEs?'Buena diversificación entre activos. Tu portfolio está bien distribuido.':'Good diversification across assets. Your portfolio is well distributed.'}</div></div></div>\`);
    }
    // Insight 2: performance
    const _retSign=gainPct>=0?'+':'';
    const _retCls=gainPct>=0?'brief-up':'brief-down';
    _rows.push(\`<div class="ins-row"><div class="ins-dot dot-yellow" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-yellow">\${isEs?'Rendimiento · Watch':'Performance · Watch'}</div></div><div class="ins-text" id="iaInsightReturn">\${isEs?\`Tu portfolio lleva <b class="\${_retCls}">\${_retSign}\${gainPct.toFixed(2)}%</b> acumulado sobre \${fe(invested)} invertido.\`:\`Your portfolio is up <b class="\${_retCls}">\${_retSign}\${gainPct.toFixed(2)}%</b> on \${fe(invested)} invested.</b>\`}</div><div class="ins-cta">\${isEs?'Ver comparativa →':'See comparison →'}</div></div></div>\`);
    // Insight 3: opportunity or emerging markets suggestion (only when few assets)
    if(assets.length>0 && assets.length<5){
      const _projScore=Math.min(100,score+Math.round(15*(1-assets.length/5)));
      _rows.push(\`<div class="ins-row"><div class="ins-dot dot-blue" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag tag-blue">\${isEs?'Oportunidad':'Opportunity'}</div></div><div class="ins-text">\${isEs?\`Añadir un ETF de mercados emergentes reduciría tu correlación y subiría tu Health Score a ~\${_projScore}.&nbsp;\`:\`Adding an emerging markets ETF would reduce correlation and raise your Health Score to ~\${_projScore}.</b>\`}</div><div class="ins-badge b-blue" style="margin-top:6px;">+\${_projScore-score} pts</div></div></div>\`);
    }
    // Insight 4: fees
    const _terRows=assets.filter(a=>a.quantity>0&&(a.ter??AN_TER_MAP[a.isin])!=null);
    const _avgTer=_terRows.length>0?_terRows.reduce((s,a)=>{const t=a.ter??AN_TER_MAP[a.isin];const v=toDisplay(a.value,assetCcy(a));return s+v*t/100;},0)/Math.max(1,_terRows.reduce((s,a)=>s+toDisplay(a.value,assetCcy(a)),0))*100:null;
    if(_avgTer!=null){
      const _feeGood=_avgTer<0.30;
      _rows.push(\`<div class="ins-row"><div class="ins-dot \${_feeGood?'dot-green':'dot-yellow'}" style="margin-top:6px;"></div><div class="ins-body"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px;"><div class="ins-tag \${_feeGood?'tag-green':'tag-yellow'}">\${isEs?'Comisiones':'Fees'}</div></div><div class="ins-text" id="iaInsightFees">\${_feeGood?(isEs?'TER medio muy eficiente: ':'Very efficient avg TER: '):\`\${isEs?'TER medio: ':'Avg TER: '}\`}<b>\${_avgTer.toFixed(2)}%</b>. \${_feeGood?(isEs?'Pagas mínimo en comisiones de gestión.':'You pay minimal management fees.'):(isEs?'Considera ETFs más baratos para reducir coste anual.':'Consider cheaper ETFs to reduce annual cost.')}</div>\${_feeGood?'<div class="ins-badge b-green" style="margin-top:6px;">'+(isEs?'Coste óptimo':'Optimal cost')+'</div>':''}</div></div>\`);
    }
    _insEl.innerHTML=_rows.join('');
  }
  // (legacy element kept for compatibility)
  const insRet=document.getElementById('iaInsightReturn');
  if(insRet&&!insRet.closest('#iaInsightsList')) insRet.innerHTML=\`Tu portfolio lleva <b>\${gainPct>=0?'+':''}\${gainPct.toFixed(2)}%</b> acumulado sobre \${fe(invested)} invertido.\`;`
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 6: Alert price field always shows "€" even for USD/GBP assets
// Add ID to the label and update it in selectAlertsAsset()
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B6: add ID to alert price label',
  '<div class="liqLabel">Precio objetivo (€)</div>\n      <input class="liqInp" id="alertsPriceInput" type="number" min="0" step="0.01" placeholder="0.00">',
  '<div class="liqLabel" id="alertsPriceLabel">Precio objetivo (€)</div>\n      <input class="liqInp" id="alertsPriceInput" type="number" min="0" step="0.01" placeholder="0.00">'
);

apply(
  'B6: update alert price currency label when asset selected',
  'function selectAlertsAsset(isin,el){\n  _alertsAssetISIN=isin;\n  document.querySelectorAll(\'#alertsAssetPicker .alertAssetRow\').forEach(r=>r.classList.remove(\'sel\'));\n  el.classList.add(\'sel\');\n  const asset=assets.find(a=>a.isin===isin);\n  if(asset){',
  `function selectAlertsAsset(isin,el){
  _alertsAssetISIN=isin;
  document.querySelectorAll('#alertsAssetPicker .alertAssetRow').forEach(r=>r.classList.remove('sel'));
  el.classList.add('sel');
  const asset=assets.find(a=>a.isin===isin);
  if(asset){
    // B6: update label to show asset's native currency
    const _lbl=document.getElementById('alertsPriceLabel');
    if(_lbl){const _ccy=assetCcy(asset)||'EUR';const _sym=_ccy==='USD'?'$':_ccy==='GBP'?'£':_ccy==='CHF'?'Fr':'€';_lbl.textContent=(currentLang==='es'?'Precio objetivo (':'Target price (')+_sym+_ccy+')';}`
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 7: "Score history · 6 months ↑ mejorando" hardcoded
// (a) Dynamic month labels based on current date
// (b) Dynamic trend label from computed score
// ─────────────────────────────────────────────────────────────────────────────

// The month labels are set in iaDrawAllGauges (score history mini chart)
// Replace hardcoded ['Oct','Nov','Dic','Ene','Feb','Mar'] with dynamic last 6 months
apply(
  'B7: dynamic month labels in score history',
  "const labels=['Oct','Nov','Dic','Ene','Feb','Mar'];",
  `const _now=new Date();const _mNames=currentLang==='es'?['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];const labels=Array.from({length:6},(_,i)=>{const d=new Date(_now.getFullYear(),_now.getMonth()-5+i,1);return _mNames[d.getMonth()];});`
);

// Add trend label update in renderIA()
apply(
  'B7: update hsHistLabel dynamically in renderIA',
  '  // Health score pillars\n  const hsNumEl=document.getElementById(\'hsNum\');',
  `  // B7: update score history trend label dynamically
  const _hsTrend=document.getElementById('hsHistLabel');
  if(_hsTrend){
    const isEs=currentLang==='es';
    if(score>=70)_hsTrend.textContent=(isEs?'↑ mejorando':'↑ improving');
    else if(score>=50)_hsTrend.textContent=(isEs?'→ estable':'→ stable');
    else _hsTrend.textContent=(isEs?'↓ mejorable':'↓ needs work');
    _hsTrend.style.color=score>=70?'#1aab70':score>=50?'#d97706':'#f05252';
  }
  // Health score pillars
  const hsNumEl=document.getElementById('hsNum');`
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 8: No visible error state when API fails
// In renderLists(), show a price error badge on assets with MISSING coverage
// and currentPrice === 0 or undefined
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B8: add API error indicator in buildTfRow for MISSING price',
  "const price=fc(a.currentPrice,assetCcy(a));",
  "const _hasPriceErr=coverageStatus(a)==='MISSING'&&!(a.currentPrice>0);const price=_hasPriceErr?'<span style=\"color:#f05252;font-size:10px;font-weight:700\">⚠ sin precio</span>':fc(a.currentPrice,assetCcy(a));"
);

// ─────────────────────────────────────────────────────────────────────────────
// BUG 1: Demo hardcoded data in portfolio score fees detail
// The fees detail panel (detail-fees) has hardcoded TER values (~0.12%).
// Replace the hardcoded TER badge with a dynamic one that reads from computed data.
// Add ID so renderAnalysisCharts can update it.
// ─────────────────────────────────────────────────────────────────────────────
apply(
  'B1: add ID to fees TER badge in portfolio score',
  '<div style="margin-left:auto;background:#e6faf3;border-radius:8px;padding:6px 10px;text-align:center;"><div style="font-size:.55rem;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:.06em;">TER medio</div><div style="font-size:.9rem;font-weight:800;color:#059669;">~0.12%</div></div>',
  '<div id="psTerBadge" style="margin-left:auto;background:#e6faf3;border-radius:8px;padding:6px 10px;text-align:center;"><div style="font-size:.55rem;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:.06em;">TER medio</div><div id="psTerVal" style="font-size:.9rem;font-weight:800;color:#059669;">~0.12%</div></div>'
);

apply(
  'B1: add ID to fees text in portfolio score',
  '<div style="font-size:.7rem;color:#065f46;line-height:1.5;">Tu cartera es <b>muy eficiente en costes</b>. TER de 0.12% — mínimo para fondos indexados en España.</div>',
  '<div id="psTerText" style="font-size:.7rem;color:#065f46;line-height:1.5;">Tu cartera es <b>muy eficiente en costes</b>. TER de 0.12% — mínimo para fondos indexados en España.</div>'
);

// In renderAnalysisCharts(), after _anRenderCosts(), update portfolio score TER badge
apply(
  'B1: update portfolio score TER badge after computing costs',
  "  try{_anRenderCosts();}catch(e){console.warn('_anRenderCosts',e);}",
  `  try{_anRenderCosts();}catch(e){console.warn('_anRenderCosts',e);}
  // B1: sync TER badge in portfolio score card with computed avg TER
  try{
    const _tRows=assets.filter(a=>a.quantity>0&&(a.ter??AN_TER_MAP[a.isin])!=null);
    const _tVal=assets.reduce((s,a)=>s+toDisplay(a.value,assetCcy(a)),0);
    if(_tRows.length>0&&_tVal>0){
      const _tCost=_tRows.reduce((s,a)=>{const t=a.ter??AN_TER_MAP[a.isin];return s+toDisplay(a.value,assetCcy(a))*t/100;},0);
      const _avgT=(_tCost/_tVal*100).toFixed(2);
      const _tv=document.getElementById('psTerVal');if(_tv)_tv.textContent='~'+_avgT+'%';
      const _tt=document.getElementById('psTerText');
      if(_tt){const _isEs=currentLang==='es';const _good=parseFloat(_avgT)<0.30;_tt.innerHTML=_good?(_isEs?'Tu cartera es <b>muy eficiente en costes</b>. TER de '+_avgT+'% — mínimo para fondos indexados.':'Your portfolio is <b>very cost-efficient</b>. TER of '+_avgT+'% — near minimum for index funds.'):(_isEs?'TER de <b>'+_avgT+'%</b>. Considera ETFs con menor comisión para optimizar retorno neto.':'TER of <b>'+_avgT+'%</b>. Consider lower-cost ETFs to optimise net return.');}
    }
  }catch(_){}`
);

// ─────────────────────────────────────────────────────────────────────────────
// SW cache bump
// ─────────────────────────────────────────────────────────────────────────────
const swPath = path.join(__dirname, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
const swOld = sw.match(/const CACHE_NAME = 'finasset-v(\d+)'/);
if (swOld) {
  const newV = parseInt(swOld[1]) + 1;
  sw = sw.replace(`finasset-v${swOld[1]}'`, `finasset-v${newV}'`);
  fs.writeFileSync(swPath, sw);
  console.log(`✅ SW bumped to v${newV}`);
}

// ─────────────────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, html);
console.log(`\n${changed} fixes applied.`);
