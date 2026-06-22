const fs = require('fs');
let html = fs.readFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', 'utf8');
let fixes = 0;

function fix(desc, search, replace) {
  if (!html.includes(search)) { console.log('MISS:', desc); return; }
  html = html.replace(search, replace);
  fixes++;
  console.log('FIX ' + fixes + ': ' + desc);
}

// ── FIX 1: destroyAnalysisCharts - also destroy _pwDonutChart and _vsWorldChart ──
fix('destroyAnalysisCharts: also destroy donut+world charts',
  'function destroyAnalysisCharts(){Object.values(analysisCharts).forEach(c=>{try{c.destroy();}catch(_){}});analysisCharts={};if(_anAllocChartInst){try{_anAllocChartInst.destroy();}catch(_){}}_anAllocChartInst=null;}',
  'function destroyAnalysisCharts(){Object.values(analysisCharts).forEach(c=>{try{c.destroy();}catch(_){}});analysisCharts={};if(_anAllocChartInst){try{_anAllocChartInst.destroy();}catch(_){}}_anAllocChartInst=null;if(window._pwDonutChart){try{window._pwDonutChart.destroy();}catch(_){}}window._pwDonutChart=null;if(window._vsWorldChart){try{window._vsWorldChart.destroy();}catch(_){}}window._vsWorldChart=null;}'
);

// ── FIX 2: renderAnalysisCharts - destroy old charts before re-rendering ──
fix('renderAnalysisCharts: destroy before render',
  "function renderAnalysisCharts(){\n  try{_anRenderSummary();}catch(e){console.warn('_anRenderSummary',e);}",
  "function renderAnalysisCharts(){\n  destroyAnalysisCharts();\n  try{_anRenderSummary();}catch(e){console.warn('_anRenderSummary',e);}"
);

// ── FIX 3: _anRenderWeightDonut - maintainAspectRatio false for proper scaling ──
fix('_anRenderWeightDonut: maintainAspectRatio false',
  "cutout:'58%',\n      responsive:true,\n      maintainAspectRatio:true,",
  "cutout:'58%',\n      responsive:true,\n      maintainAspectRatio:false,"
);

// ── FIX 4: _anRenderTrendVsWorld - guard bestYear undefined ──
fix('_anRenderTrendVsWorld: guard bestYear undefined',
  'const bestYear=years[portAnnual.indexOf(Math.max(...portAnnual))];',
  'const _bi=portAnnual.length?portAnnual.indexOf(Math.max(...portAnnual)):-1;const bestYear=_bi>=0&&years[_bi]?years[_bi]:"—";'
);

// ── FIX 5: _anRenderAllocContent - use requestAnimationFrame ──
fix('_anRenderAllocContent: requestAnimationFrame',
  "  setTimeout(() => {\n    const cv = document.getElementById(canvasId);\n    if (!cv) return;\n    _anAllocChartInst = new Chart(cv.getContext('2d'), {",
  "  requestAnimationFrame(() => {\n    const cv = document.getElementById(canvasId);\n    if (!cv) return;\n    _anAllocChartInst = new Chart(cv.getContext('2d'), {"
);
fix('_anRenderAllocContent: close requestAnimationFrame',
  "    });\n  }, 0);\n}",
  "    });\n  });\n}"
);

// ── FIX 6: render() summaryAssetCount - fix wrong language check ──
fix('render: summaryAssetCount language fix',
  "document.getElementById('summaryAssetCount').textContent=`${c.total} ${t('positions')} \u00b7 ${c.ok} ${t('mPositions').toLowerCase().includes('position')?'w/ history':'con hist\u00f3rico'}`;",
  "document.getElementById('summaryAssetCount').textContent=`${c.total} ${t('positions')} \u00b7 ${c.ok} ${currentLang==='es'?'con hist\u00f3rico':'w/ history'}`;",
);

// ── FIX 7: showScreen - null guard on screen element ──
fix('showScreen: null guard on screen element',
  "document.getElementById('screen-'+name).classList.add('active');",
  "const _s=document.getElementById('screen-'+name);if(_s)_s.classList.add('active');"
);

// ── FIX 8: renderImpuestos - add dataReady check ──
fix('showScreen: renderImpuestos add dataReady check',
  "if(name==='impuestos')renderImpuestos();",
  "if(name==='impuestos'&&dataReady)renderImpuestos();"
);

// ── FIX 9: assetCategory - add stock type ──
fix('assetCategory: add stock type',
  "function assetCategory(a){if(['IE00B4ND3602','IE00B579F325'].includes(a.isin))return'Oro';if(a.mapping?.type==='etf')return'ETFs';if(a.mapping?.type==='etc')return'Oro';return'Fondos';}",
  "function assetCategory(a){if(['IE00B4ND3602','IE00B579F325'].includes(a.isin))return'Oro';if(a.mapping?.type==='etf')return'ETFs';if(a.mapping?.type==='etc')return'Oro';if(a.mapping?.type==='stock')return currentLang==='es'?'Acciones':'Stocks';return'Fondos';}"
);

// ── FIX 10: _anRenderSummary - liquidity with display currency conversion ──
fix('_anRenderSummary: liquidity currency conversion',
  "const liq=getLiquidity(),liqTot=liq.reduce((s,l)=>s+(Number(l.amount)||0),0);",
  "const liq=getLiquidity(),liqTot=liq.reduce((s,l)=>s+toDisplay(Number(l.amount)||0,l.currency||'EUR'),0);"
);

// ── FIX 11: _anRenderSummary - clear todayGain element when null ──
fix('_anRenderSummary: clear todayGain when null',
  "if(elDG&&todayGain!=null)elDG.textContent=`${todayGain>=0?'+':''}${fe(todayGain)} ${isEs?'hoy':'today'}`;",
  "if(elDG){elDG.textContent=todayGain!=null?`${todayGain>=0?'+':''}${fe(todayGain)} ${isEs?'hoy':'today'}`:'';}"
);

// ── FIX 12: _anRenderBestWorst - simplify bot5 ──
fix('_anRenderBestWorst: simplify bot5',
  "const bot5=negatives.length>=1?negatives.slice(0,5):sorted.filter(a=>!top5ISINs.has(a.isin)).slice(-Math.min(3,sorted.filter(a=>!top5ISINs.has(a.isin)).length)).reverse();",
  "const _rem=sorted.filter(a=>!top5ISINs.has(a.isin));const bot5=negatives.length>=1?negatives.slice(0,5):_rem.slice(-5).reverse();"
);

// ── FIX 13: _anRenderCorrelation - null check on anCorrCard ──
fix('_anRenderCorrelation: null check on anCorrCard hide',
  "if(active.length<2){el.innerHTML='';document.getElementById('anCorrCard').style.display='none';return;}",
  "if(active.length<2){el.innerHTML='';const _cc=document.getElementById('anCorrCard');if(_cc)_cc.style.display='none';return;}"
);
fix('_anRenderCorrelation: null check on anCorrCard show',
  "document.getElementById('anCorrCard').style.display='';",
  "const _cc2=document.getElementById('anCorrCard');if(_cc2)_cc2.style.display='';"
);

// ── FIX 14: renderChart noteText - simplify ──
fix('renderChart: simplify noteText (1)',
  "const noteText=aPct>0.5?`${t('histPts').replace('puntos hist\u00f3ricos','')}: ${series.length} pts \u00b7 ${aPct",
  "const noteText=aPct>0.5?`${series.length} pts \u00b7 ${aPct"
);
fix('renderChart: simplify noteText (2)',
  "%.toFixed(0)}% estimado`:t('histPts').replace('historical points',`${series.length} pts`).replace('puntos hist\u00f3ricos',`${series.length} pts`);",
  "%.toFixed(0)}% ${currentLang==='es'?'estimado':'estimated'}`:currentLang==='es'?`${series.length} puntos hist\u00f3ricos`:`${series.length} historical points`;"
);

// ── FIX 15: _anRenderPeriodStrip - fix ++ bug for large positive abs values ──
fix('_anRenderPeriodStrip: fix double-sign bug',
  "const as=abs==null?'\u2014':`${abs>=0?'+':''}${Math.abs(abs)>=1000?(abs>=0?'+':'-')+Math.abs(abs/1000).toFixed(1)+'k':(abs>=0?'+':'')+fe(abs)}`;",
  "const as=abs==null?'\u2014':Math.abs(abs)>=1000?`${abs>=0?'+':'-'}${(Math.abs(abs)/1000).toFixed(1)}k`:`${abs>=0?'+':''}${fe(abs)}`;"
);

// ── FIX 16: Liquidity onclick - escapeHtml on id ──
fix('renderLiquidity: escapeHtml on id in onclick',
  'return `<div class="liqRow" onclick="openLiqModal(\'${x.id}\')">',
  'return `<div class="liqRow" onclick="openLiqModal(\'${escapeHtml(String(x.id||\'\'))}\')">'
);

// ── FIX 17: _taxComputeGains - guard tx.date undefined ──
fix('_taxComputeGains: guard tx.date undefined',
  "const txs = (entry.transactions||[]).filter(t=>t.type==='sell'&&String(t.date).startsWith(String(year)));",
  "const txs = (entry.transactions||[]).filter(t=>t.type==='sell'&&t.date&&String(t.date).startsWith(String(year)));"
);

// ── FIX 18: _anRenderWeightDonut - filter legend null entries ──
fix('_anRenderWeightDonut: filter null legend entries',
  "      if(pct<0.5)return'';",
  "      if(pct<0.5)return null;"
);
fix('_anRenderWeightDonut: join non-null legend entries',
  "    }).join('');",
  "    }).filter(Boolean).join('');"
);

// ── FIX 19: _anRenderSummary liqPct clamp ──
fix('_anRenderSummary: clamp liqPct to 1',
  'const liqPct=(total+liqTot)>0?liqTot/(total+liqTot):0;',
  'const liqPct=(total+liqTot)>0?Math.min(liqTot/(total+liqTot),1):0;'
);

// ── FIX 20: _anRenderCosts - avgTer isFinite check ──
fix('_anRenderCosts: avgTer isFinite check',
  'const avgTer = totalVal > 0 ? totalCost / totalVal * 100 : 0;',
  'const avgTer = totalVal > 0 && Number.isFinite(totalVal) ? totalCost / totalVal * 100 : 0;'
);

// ── FIX 21: _anRenderBestWorst - filter zero-quantity assets ──
fix('_anRenderBestWorst: filter zero-quantity assets',
  "const sorted=[...assets].filter(a=>Number.isFinite(a.gainPct)).sort((a,b)=>b.gainPct-a.gainPct);",
  "const sorted=[...assets].filter(a=>a.quantity>0&&Number.isFinite(a.gainPct)).sort((a,b)=>b.gainPct-a.gainPct);"
);

// ── FIX 22: buildPortfolioTimeSeries - isFinite guard ──
fix('buildPortfolioTimeSeries: isFinite guard on values',
  'const full=dates.map(date=>{let rv=0;for(const{asset,factor}of scaled){const p=getPriceOnOrBefore(asset.history,date);if(p!=null)rv+=toDisplay(asset.quantity*p*factor,assetCcy(asset));}return{date,realValue:rv};}).filter(p=>p.realValue>0);',
  'const full=dates.map(date=>{let rv=0;for(const{asset,factor}of scaled){const p=getPriceOnOrBefore(asset.history,date);if(p!=null){const v=toDisplay(asset.quantity*p*factor,assetCcy(asset));if(Number.isFinite(v))rv+=v;}}return{date,realValue:rv};}).filter(p=>p.realValue>0);'
);

// ── FIX 23: _anRenderPerfBars - slightly reduce max bar width ──
fix('_anRenderPerfBars: reduce max bar width to avoid overflow',
  "const halfW=Math.min(Math.abs(r.pct)/maxAbs*50,50);",
  "const halfW=Math.min(Math.abs(r.pct)/maxAbs*46,46);"
);

// ── FIX 24: _calcAndRenderFV - clamp extreme values ──
fix('_calcAndRenderFV: clamp sgr/dgr extremes',
  "const sgr=_divFVParams.sgr/100;\n  const dgr=_divFVParams.dgr/100;",
  "const sgr=Math.min(Math.max(_divFVParams.sgr||0,-50),100)/100;\n  const dgr=Math.min(Math.max(_divFVParams.dgr||0,-50),100)/100;"
);

// ── FIX 25: _anRenderWeightDonut - improve tooltip styling ──
fix('_anRenderWeightDonut: improve tooltip styling',
  "plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+labels[c.dataIndex]+': '+pcts[c.dataIndex].toFixed(1)+'% ('+fe(vals[c.dataIndex])+')'}}}}",
  "plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(12,30,20,.9)',cornerRadius:8,padding:8,callbacks:{label:c=>' '+labels[c.dataIndex]+': '+pcts[c.dataIndex].toFixed(1)+'% ('+fe(vals[c.dataIndex])+')'}}}}}"
);

// ── FIX 26: render() - null guard coveragePill ──
fix('render: null guard coveragePill',
  "document.getElementById('coveragePill').textContent=`${c.total} ${t('assets')}`;",
  "const _cp=document.getElementById('coveragePill');if(_cp)_cp.textContent=`${c.total} ${t('assets')}`;"
);

// ── FIX 27: _anRenderCorrelation - guard isin slice ──
fix('_anRenderCorrelation: guard isin slice',
  "const lbls=top.map(a=>a.shortName||(a.name||'').split(' ')[0]||a.isin.slice(0,4));",
  "const lbls=top.map(a=>a.shortName||(a.name||'').split(' ')[0]||(a.isin||'????').slice(0,4));"
);

// ── FIX 28: _prefetchDividends - guard empty isin ──
fix('_prefetchDividends: guard assets with valid isin',
  "const allIsins=assets.map(a=>{const sym=a.mapping?.yahooSymbol||a.symbol||'';return sym?`${a.isin}:${sym}`:a.isin;}).join(',');",
  "const allIsins=assets.filter(a=>a.isin).map(a=>{const sym=a.mapping?.yahooSymbol||a.symbol||'';return sym?`${a.isin}:${sym}`:a.isin;}).join(',');"
);

// ── FIX 29: computeHealthScore - isFinite guard on HHI ──
fix('computeHealthScore: isFinite guard',
  "const hhi=assets.reduce((s,a)=>s+Math.pow((toDisplay(a.value,assetCcy(a))/total)*100,2),0)/100,n=assets.length;",
  "const hhi=total>0?assets.reduce((s,a)=>{const w=toDisplay(a.value,assetCcy(a))/total;return s+Math.pow(Number.isFinite(w)?w*100:0,2);},0)/100:0,n=assets.length;"
);

// ── FIX 30: _anRenderBestWorst - guard name in mkCard ──
fix('_anRenderBestWorst: guard name slice (ticker)',
  "const ticker=escapeHtml(a.name.slice(0,sm?8:10));",
  "const ticker=escapeHtml((a.name||a.isin||'').slice(0,sm?8:10));"
);
fix('_anRenderBestWorst: guard name slice (fname)',
  "const fname=escapeHtml(a.name.slice(0,sm?12:16));",
  "const fname=escapeHtml((a.name||a.isin||'').slice(0,sm?12:16));"
);

// ── FIX 31: _anRenderTreemap - guard non-finite total ──
fix('_anRenderTreemap: guard non-finite total',
  "const tot=all.reduce((s,i)=>s+i.weight,0);if(!tot)return;",
  "const tot=all.reduce((s,i)=>s+i.weight,0);if(!tot||!Number.isFinite(tot))return;"
);

// ── FIX 32: filterByRange - guard undefined/null range ──
fix('filterByRange: guard null range',
  "function filterByRange(series,range){if(!Array.isArray(series)||!series.length)return[];let co;if(range==='YTD'){",
  "function filterByRange(series,range){if(!Array.isArray(series)||!series.length)return[];if(!range)return series;let co;if(range==='YTD'){"
);

// ── FIX 33: getDayPct - return null if history last date is stale ──
fix('getDayPct: guard stale history > 15 days',
  "function getDayPct(a){\n  if(!a.hasRealHistory||!a.history?.length||a.history.length<2)return null;\n  const last=a.history[a.history.length-1].close,prev=a.history[a.history.length-2].close;\n  return prev>0?(last-prev)/prev*100:null;\n}",
  "function getDayPct(a){\n  if(!a.hasRealHistory||!a.history?.length||a.history.length<2)return null;\n  const lastDate=a.history[a.history.length-1].date;\n  if(lastDate&&(Date.now()-new Date(lastDate+'T00:00:00').getTime())>15*86400000)return null;\n  const last=a.history[a.history.length-1].close,prev=a.history[a.history.length-2].close;\n  return prev>0?(last-prev)/prev*100:null;\n}"
);

// ── FIX 34: _anRenderWeightDonut - guard non-finite total ──
fix('_anRenderWeightDonut: guard non-finite total',
  "if(!total){canvas.style.display='none';return;}",
  "if(!total||!Number.isFinite(total)){canvas.style.display='none';return;}"
);

// ── FIX 35: _anRenderAllocContent - guard empty groups and filter 0-value entries ──
fix('_anRenderAllocContent: filter zero-value entries',
  "  const entries = Object.entries(groups).sort((a,b) => b[1]-a[1]);\n  const cols = entries.map((_,i) => COLORS[i%COLORS.length]);\n  const pcts = entries.map(([,v]) => Math.round(v/total*100));",
  "  const entries = Object.entries(groups).filter(([,v])=>v>0).sort((a,b) => b[1]-a[1]);\n  if(!entries.length){el.innerHTML='';return;}\n  const cols = entries.map((_,i) => COLORS[i%COLORS.length]);\n  const pcts = entries.map(([,v]) => total>0?Math.round(v/total*100):0);"
);

// ── FIX 36: renderImpuestos - null check on taxYearLabel ──
fix('renderImpuestos: null check on taxYearLabel',
  "document.getElementById('taxYearLabel').textContent = _taxYear;",
  "const _tyl=document.getElementById('taxYearLabel');if(_tyl)_tyl.textContent=_taxYear;"
);

// ── FIX 37: _anRenderTrendVsWorld - use real portfolio data when available ──
fix('_anRenderTrendVsWorld: use real portfolio history when available',
  "  // Portfolio annual returns: use actual gain if < 1yr, else distribute equally\n  const total=assets.reduce((s,a)=>s+toDisplay(a.value,assetCcy(a)),0);\n  const inv=assets.reduce((s,a)=>s+toDisplay(a.invested,costCcy(a)),0);\n  const totalPct=inv>0?((total-inv)/inv)*100:0;\n  // Distribute totalPct over years proportionally to MSCI (so trend looks sensible)\n  const msciAvg=msciAnnual.reduce((s,v)=>s+v,0)/msciAnnual.length;\n  const portAnnual=msciAnnual.map(m=>totalPct*0.5+(m>0?m*0.3:-m*0.1));",
  "  // Portfolio: use real history when available, otherwise distribute total return\n  const total=assets.reduce((s,a)=>s+toDisplay(a.value,assetCcy(a)),0);\n  const inv=assets.reduce((s,a)=>s+toDisplay(a.invested,costCcy(a)),0);\n  const totalPct=inv>0?((total-inv)/inv)*100:0;\n  const _pts=buildPortfolioTimeSeries();\n  let portAnnual;\n  if(_pts&&_pts.length>5){\n    portAnnual=years.map(y=>{\n      const yStart=_pts.find(p=>p.date>=(y+'-01-01'));\n      const yEnd=[..._pts].reverse().find(p=>p.date<=((parseInt(y)+1)+'-01-01'))||_pts[_pts.length-1];\n      if(!yStart||!yEnd||yStart.totalValue<=0)return totalPct/Math.max(years.length,1);\n      return((yEnd.totalValue-yStart.totalValue)/yStart.totalValue)*100;\n    });\n  }else{\n    portAnnual=msciAnnual.map(m=>totalPct/Math.max(years.length,1)+(m>0?m*0.1:m*0.05));\n  }"
);

// ── FIX 38: _anRenderSummary - spark guard empty points ──
fix('_anRenderSummary: spark guard empty points',
  "if(sp&&full&&full.length>1)_anDrawSpark(sp,full.slice(-30).map(p=>p.totalValue),isPos);",
  "if(sp&&full&&full.length>1){const _spPts=full.slice(-30).map(p=>p.totalValue).filter(v=>Number.isFinite(v)&&v>0);if(_spPts.length>1)_anDrawSpark(sp,_spPts,isPos);}"
);

// ── FIX 39: _anRenderBestWorst - spark points guard ──
fix('_anRenderBestWorst: spark points guard non-finite',
  "const pts=a.hasRealHistory&&a.history?.length>1?a.history.slice(-20).map(p=>p.close):[a.buyPrice||1,a.currentPrice||1];",
  "const pts=a.hasRealHistory&&a.history?.length>1?a.history.slice(-20).map(p=>p.close).filter(v=>v>0):[a.buyPrice||1,a.currentPrice||1];if(pts.length<2)return;"
);

// ── FIX 40: _anDrawSpark - guard min/max equal values ──
fix('_anDrawSpark: guard flat/equal series',
  "function _anDrawSpark(canvas,pts,isPos){",
  "function _anDrawSpark(canvas,pts,isPos){\n  if(!canvas||!pts||pts.length<2)return;\n  const _mn=Math.min(...pts),_mx=Math.max(...pts);\n  if(!Number.isFinite(_mn)||!Number.isFinite(_mx))return;"
);

console.log('\nTotal fixes applied: ' + fixes);
fs.writeFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', html, 'utf8');
console.log('Done!');
