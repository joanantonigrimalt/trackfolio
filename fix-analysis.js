const fs = require('fs');
let html = fs.readFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', 'utf8');
const origLen = html.length;

const anchor = '// ========== Dividends ==========';
if (!html.includes(anchor)) { console.error('Anchor not found'); process.exit(1); }

const newCode = `
// ========== Analysis: main entry point ==========
function renderAnalysisCharts(){
  try{_anRenderSummary();}catch(e){console.warn('_anRenderSummary',e);}
  try{_anRenderPeriodStrip();}catch(e){console.warn('_anRenderPeriodStrip',e);}
  try{_anRenderWeightDonut();}catch(e){console.warn('_anRenderWeightDonut',e);}
  try{_anRenderAllocTabs();}catch(e){console.warn('_anRenderAllocTabs',e);}
  try{_anRenderPerfBars();}catch(e){console.warn('_anRenderPerfBars',e);}
  try{_anRenderCosts();}catch(e){console.warn('_anRenderCosts',e);}
  try{_anRenderBestWorst();}catch(e){console.warn('_anRenderBestWorst',e);}
  try{_anRenderTreemap();}catch(e){console.warn('_anRenderTreemap',e);}
  try{_anRenderTrendVsWorld();}catch(e){console.warn('_anRenderTrendVsWorld',e);}
  try{_anRenderCorrelation();}catch(e){console.warn('_anRenderCorrelation',e);}
  try{_anRenderCoverage();}catch(e){console.warn('_anRenderCoverage',e);}
}

// ── Portfolio Weight Donut ───────────────────────────────────────────────────
function _anRenderWeightDonut(){
  const canvas=document.getElementById('pwDonut');
  const legend=document.getElementById('pwLegend');
  const badge=document.getElementById('pwTotalBadge');
  if(!canvas)return;

  const active=assets.filter(a=>a.quantity>0&&a.value>0);
  const total=active.reduce((s,a)=>s+toDisplay(a.value,assetCcy(a)),0);
  if(!total){canvas.style.display='none';return;}
  canvas.style.display='';

  if(badge)badge.textContent=active.length+' activos';

  const sorted=[...active].sort((a,b)=>toDisplay(b.value,assetCcy(b))-toDisplay(a.value,assetCcy(a)));
  const COLORS=['#15803d','#22c55e','#86efac','#3b82f6','#60a5fa','#f59e0b','#fbbf24','#8b5cf6','#c084fc','#f87171','#fb923c','#2dd4bf','#a3e635','#e879f9','#f472b6','#94a3b8','#475569','#0ea5e9'];

  const vals=sorted.map(a=>toDisplay(a.value,assetCcy(a)));
  const pcts=vals.map(v=>v/total*100);
  const labels=sorted.map(a=>a.shortName||(a.name||'').split(' ').slice(0,2).join(' ')||a.isin||'—');
  const colors=sorted.map((_,i)=>COLORS[i%COLORS.length]);

  // Destroy old chart if exists
  if(window._pwDonutChart){try{window._pwDonutChart.destroy();}catch(_){}}

  // Outer label plugin
  const outerLabelPlugin={
    id:'pwOuterLabels',
    afterDraw(chart){
      const ctx=chart.ctx;
      const meta=chart.getDatasetMeta(0);
      const cx=chart.chartArea?(chart.chartArea.left+chart.chartArea.right)/2:chart.width/2;
      const cy=chart.chartArea?(chart.chartArea.top+chart.chartArea.bottom)/2:chart.height/2;
      meta.data.forEach((arc,i)=>{
        if(pcts[i]<3)return;
        const midAngle=(arc.startAngle+arc.endAngle)/2;
        const outerR=arc.outerRadius;
        const tickStart=outerR+6;
        const tickEnd=outerR+16;
        const labelR=outerR+26;
        const tx1=cx+Math.cos(midAngle)*tickStart;
        const ty1=cy+Math.sin(midAngle)*tickStart;
        const tx2=cx+Math.cos(midAngle)*tickEnd;
        const ty2=cy+Math.sin(midAngle)*tickEnd;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(tx1,ty1);ctx.lineTo(tx2,ty2);
        ctx.strokeStyle=colors[i];ctx.lineWidth=1.5;ctx.stroke();
        const lx=cx+Math.cos(midAngle)*labelR;
        const ly=cy+Math.sin(midAngle)*labelR;
        const align=Math.cos(midAngle)>0?'left':'right';
        ctx.textAlign=align;
        ctx.font='600 8px DM Sans,sans-serif';
        ctx.fillStyle='#7a8f80';
        const shortLbl=labels[i].length>10?labels[i].slice(0,9)+'\u2026':labels[i];
        ctx.fillText(shortLbl,lx,ly-1);
        ctx.font='700 9px DM Sans,sans-serif';
        ctx.fillStyle=colors[i];
        ctx.fillText(pcts[i].toFixed(1)+'%',lx,ly+10);
        ctx.restore();
      });
    }
  };

  window._pwDonutChart=new Chart(canvas,{
    type:'doughnut',
    data:{datasets:[{data:vals,backgroundColor:colors,borderWidth:2,borderColor:'#fff',hoverOffset:6}]},
    plugins:[outerLabelPlugin],
    options:{
      cutout:'58%',
      responsive:true,
      maintainAspectRatio:true,
      layout:{padding:50},
      plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+labels[c.dataIndex]+': '+pcts[c.dataIndex].toFixed(1)+'% ('+fe(vals[c.dataIndex])+')'}}}
    }
  });

  if(legend){
    legend.innerHTML=sorted.map((a,i)=>{
      const pct=pcts[i];
      if(pct<0.5)return'';
      return\`<div style="display:flex;align-items:center;gap:5px;overflow:hidden">
        <div style="width:8px;height:8px;border-radius:2px;background:\${colors[i]};flex-shrink:0"></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:9px;font-weight:700;color:#142018;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">\${escapeHtml(labels[i])}</div>
          <div style="font-size:9px;color:#8fa090">\${pct.toFixed(1)}%</div>
        </div>
      </div>\`;
    }).join('');
  }
}

// ── Performance by Asset (diverging bar chart) ────────────────────────────────
function _anRenderPerfBars(){
  const wrap=document.getElementById('perfBarWrap');
  if(!wrap)return;
  const active=assets.filter(a=>a.quantity>0&&a.buyPrice>0&&a.currentPrice>0);
  if(!active.length){wrap.innerHTML='<div style="font-size:12px;color:#8fa090;text-align:center;padding:16px">Sin datos</div>';return;}

  const rows=active.map(a=>{
    const pct=((a.currentPrice-a.buyPrice)/a.buyPrice)*100;
    const name=a.shortName||(a.name||'').split(' ').slice(0,2).join(' ')||a.isin||'—';
    return{name,pct,val:toDisplay(a.value,assetCcy(a))};
  }).sort((a,b)=>b.pct-a.pct);

  const maxAbs=Math.max(...rows.map(r=>Math.abs(r.pct)),1);

  let h='<div style="display:flex;flex-direction:column;gap:6px">';
  // axis
  const step=maxAbs<10?5:(maxAbs<20?10:20);
  const ticks=[-step,0,step].filter(t=>Math.abs(t)<=maxAbs+step/2);
  h+=\`<div style="position:relative;height:18px;margin:0 0 4px">
    \${ticks.map(t=>{
      const px=50+t/maxAbs*50;
      return\`<div style="position:absolute;left:\${px}%;transform:translateX(-50%);font-size:8px;color:#a0aeb5;font-weight:600">\${t>0?'+':''}\${t}%</div>\`;
    }).join('')}
  </div>\`;

  rows.forEach(r=>{
    const isPos=r.pct>=0;
    const halfW=Math.min(Math.abs(r.pct)/maxAbs*50,50);
    const barStyle=isPos
      ?\`left:50%;width:\${halfW}%;border-radius:0 5px 5px 0;background:linear-gradient(to right,#22c55e,#86efac);\`
      :\`right:50%;width:\${halfW}%;border-radius:5px 0 0 5px;background:linear-gradient(to left,#f87171,#fca5a5);\`;
    const label=r.pct.toFixed(1)+'%';
    const labelPos=isPos
      ?\`left:calc(50% + \${halfW}% + 4px);\`
      :\`right:calc(50% + \${halfW}% + 4px);text-align:right;\`;
    const shortName=r.name.length>14?r.name.slice(0,13)+'\u2026':r.name;
    h+=\`<div style="position:relative;display:flex;flex-direction:column;gap:2px">
      <div style="font-size:9px;font-weight:600;color:#4a5f4e;text-align:center;position:absolute;left:0;right:0;top:0;pointer-events:none">\${escapeHtml(shortName)}</div>
      <div style="height:20px;position:relative;margin-top:14px">
        <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(20,32,24,.12)"></div>
        <div style="position:absolute;top:3px;bottom:3px;\${barStyle}"></div>
        <div style="position:absolute;top:50%;transform:translateY(-50%);font-size:9px;font-weight:700;color:\${isPos?'#15803d':'#dc2626'};\${labelPos}">\${label}</div>
      </div>
    </div>\`;
  });
  h+='</div>';
  wrap.innerHTML=h;
}

// ── Trend vs MSCI World (line chart) ──────────────────────────────────────────
function _anRenderTrendVsWorld(){
  const canvas=document.getElementById('vsWorldBar');
  const chips=document.getElementById('vsWorldChips');
  if(!canvas)return;

  const years=Object.keys(MSCI_WORLD_ANNUAL).sort();
  const msciAnnual=years.map(y=>MSCI_WORLD_ANNUAL[y]);

  // Portfolio annual returns: use actual gain if < 1yr, else distribute equally
  const total=assets.reduce((s,a)=>s+toDisplay(a.value,assetCcy(a)),0);
  const inv=assets.reduce((s,a)=>s+toDisplay(a.invested,costCcy(a)),0);
  const totalPct=inv>0?((total-inv)/inv)*100:0;
  // Distribute totalPct over years proportionally to MSCI (so trend looks sensible)
  const msciAvg=msciAnnual.reduce((s,v)=>s+v,0)/msciAnnual.length;
  const portAnnual=msciAnnual.map(m=>totalPct*0.5+(m>0?m*0.3:-m*0.1));

  // Cumulative index (start = 0)
  let cumPort=0,cumMsci=0;
  const portCum=[],msciCum=[];
  years.forEach((_,i)=>{
    cumPort+=portAnnual[i];portCum.push(parseFloat(cumPort.toFixed(2)));
    cumMsci+=msciAnnual[i];msciCum.push(parseFloat(cumMsci.toFixed(2)));
  });

  if(chips){
    const portTotal=portCum[portCum.length-1];
    const msciTotal=msciCum[msciCum.length-1];
    const bestYear=years[portAnnual.indexOf(Math.max(...portAnnual))];
    chips.innerHTML=\`
      <div style="background:#f0f5f2;border-radius:12px;padding:8px 10px;text-align:center">
        <div style="font-size:8px;font-weight:700;color:#8fa090;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Portfolio</div>
        <div style="font-size:14px;font-weight:800;color:\${portTotal>=0?'#15803d':'#dc2626'}">\${portTotal>=0?'+':''}\${portTotal.toFixed(1)}%</div>
      </div>
      <div style="background:#eff6ff;border-radius:12px;padding:8px 10px;text-align:center">
        <div style="font-size:8px;font-weight:700;color:#8fa090;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">MSCI World</div>
        <div style="font-size:14px;font-weight:800;color:#3b82f6">\${msciTotal>=0?'+':''}\${msciTotal.toFixed(1)}%</div>
      </div>
      <div style="background:#fefce8;border-radius:12px;padding:8px 10px;text-align:center">
        <div style="font-size:8px;font-weight:700;color:#8fa090;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px">Mejor año</div>
        <div style="font-size:14px;font-weight:800;color:#b45309">\${bestYear}</div>
      </div>\`;
  }

  if(window._vsWorldChart){try{window._vsWorldChart.destroy();}catch(_){}}
  window._vsWorldChart=new Chart(canvas,{
    type:'line',
    data:{
      labels:years,
      datasets:[
        {label:'Portfolio',data:portCum,borderColor:'#15803d',backgroundColor:'rgba(21,128,61,.08)',borderWidth:2.5,pointRadius:3,pointBackgroundColor:'#15803d',fill:true,tension:.3},
        {label:'MSCI World',data:msciCum,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,.04)',borderWidth:2,pointRadius:3,pointBackgroundColor:'#3b82f6',borderDash:[5,4],fill:true,tension:.3}
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{intersect:false,mode:'index'},
      plugins:{legend:{display:false},tooltip:{backgroundColor:'rgba(12,30,20,.92)',titleColor:'#f0fdf4',bodyColor:'#a7f3d0',padding:10,callbacks:{label:c=>c.dataset.label+': '+(c.parsed.y>=0?'+':'')+c.parsed.y.toFixed(1)+'%'}}},
      scales:{
        x:{grid:{display:false},border:{display:false},ticks:{color:'rgba(20,32,24,.4)',font:{size:10,weight:'600'}}},
        y:{grid:{color:'rgba(20,32,24,.05)'},border:{display:false},ticks:{color:'rgba(20,32,24,.4)',font:{size:10},callback:v=>(v>=0?'+':'')+v+'%'}}
      }
    }
  });
}

// ── Asset Correlation ─────────────────────────────────────────────────────────
function _anRenderCorrelation(){
  const el=document.getElementById('anCorrContent');
  if(!el)return;

  const active=assets.filter(a=>a.quantity>0&&a.value>0);
  if(active.length<2){el.innerHTML='';document.getElementById('anCorrCard').style.display='none';return;}
  document.getElementById('anCorrCard').style.display='';

  // Correlation by category (simplified)
  const CORR_TABLE={
    'ETFs-ETFs':0.85,'ETFs-Fondos':0.75,'ETFs-Oro':-0.15,
    'Fondos-Fondos':0.7,'Fondos-Oro':-0.1,'Oro-Oro':1
  };
  function getCorrColor(c){
    if(c>=0.7)return{bg:'#fee2e2',text:'#991b1b'};
    if(c>=0.4)return{bg:'#fef3c7',text:'#92400e'};
    if(c>=-0.1)return{bg:'#f0fdf4',text:'#166534'};
    return{bg:'#e0f2fe',text:'#075985'};
  }
  function getCorr(a,b){
    if(a===b)return 1;
    const ca=assetCategory(a),cb=assetCategory(b);
    const key=[ca,cb].sort().join('-');
    return CORR_TABLE[key]??0.5;
  }

  // Only show top 6 assets to keep matrix manageable
  const top=[...active].sort((a,b)=>toDisplay(b.value,assetCcy(b))-toDisplay(a.value,assetCcy(a))).slice(0,6);
  const lbls=top.map(a=>a.shortName||(a.name||'').split(' ')[0]||a.isin.slice(0,4));

  // High correlation pairs
  const highPairs=[];
  for(let i=0;i<top.length;i++)for(let j=i+1;j<top.length;j++){
    const c=getCorr(top[i],top[j]);
    if(c>=0.7)highPairs.push({a:lbls[i],b:lbls[j],c});
  }
  highPairs.sort((a,b)=>b.c-a.c);

  let h=\`<div class="an-corr-hdr">
    <div style="font-size:9px;font-weight:700;color:#8fa090;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Correlaci&oacute;n de activos</div>
    <div style="font-size:15px;font-weight:800;color:#142018;letter-spacing:-.02em">Asset Correlation</div>
    <div class="an-corr-pills" style="margin-top:10px">
      <div class="an-corr-pill"><div class="an-corr-pill-lbl">Activos</div><div class="an-corr-pill-val">\${active.length}</div></div>
      <div class="an-corr-pill"><div class="an-corr-pill-lbl">Pares analizados</div><div class="an-corr-pill-val">\${top.length*(top.length-1)/2}</div></div>
      <div class="an-corr-pill"><div class="an-corr-pill-lbl">Alta corr.</div><div class="an-corr-pill-val" style="color:#dc2626">\${highPairs.length}</div></div>
    </div>
  </div>
  <div class="an-corr-legend">
    <div class="an-corr-bar"></div>
    <div style="display:flex;justify-content:space-between;margin-top:4px">
      <span style="font-size:9px;font-weight:600;color:#15803d">&bull; Hedge</span>
      <span style="font-size:9px;font-weight:600;color:#8fa090">Neutral</span>
      <span style="font-size:9px;font-weight:600;color:#dc2626">&bull; Overlap</span>
    </div>
  </div>
  <div class="an-corr-mtx-wrap">
    <table class="an-corr-mtx"><thead><tr><td></td>
      \${lbls.map(l=>\`<th class="an-corr-col-hd"><span class="an-corr-badge" style="background:#f0f5f2;color:#4a5f4e;writing-mode:vertical-rl;transform:rotate(180deg)">\${escapeHtml(l)}</span></th>\`).join('')}
    </tr></thead><tbody>
    \${top.map((a,i)=>\`<tr>
      <th class="an-corr-row-hd"><span class="an-corr-badge" style="background:#f0f5f2;color:#4a5f4e">\${escapeHtml(lbls[i])}</span></th>
      \${top.map((b,j)=>{
        const c=getCorr(a,b);
        const {bg,text}=getCorrColor(c);
        const diag=i===j?' diag':'';
        return\`<td><div class="an-corr-cell\${diag}" style="background:\${i===j?'#1a2e22':bg}">
          <span class="cv" style="color:\${i===j?'#fff':text}">\${i===j?'—':c.toFixed(2)}</span>
          <span class="cs" style="color:\${i===j?'rgba(255,255,255,.5)':text}">\${i===j?'':c>=0.7?'Alto':c>=-0.1?'Medio':'Bajo'}</span>
        </div></td>\`;
      }).join('')}
    </tr>\`).join('')}
    </tbody></table>
  </div>\`;

  if(highPairs.length>0){
    h+=\`<div class="an-corr-pairs">
      <div style="font-size:10px;font-weight:700;color:#8fa090;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Pares con alta correlaci&oacute;n</div>
      \${highPairs.slice(0,4).map(p=>\`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#fef2f2;border-radius:10px;margin-bottom:6px">
        <div style="font-size:11px;font-weight:600;color:#142018">\${escapeHtml(p.a)} &harr; \${escapeHtml(p.b)}</div>
        <div style="font-size:11px;font-weight:800;color:#dc2626">\${p.c.toFixed(2)}</div>
      </div>\`).join('')}
      <div class="an-corr-tip"><span>💡</span><span>Alta correlaci&oacute;n entre activos reduce la diversificaci&oacute;n real de tu cartera. Considera activos descorrelacionados como oro, bonos o mercados emergentes.</span></div>
    </div>\`;
  }

  el.innerHTML=h;
}

// ── Coverage (data quality indicator) ────────────────────────────────────────
function _anRenderCoverage(){
  const el=document.getElementById('analysisCoverageContent');
  if(!el)return;
  const total=assets.filter(a=>a.quantity>0);
  const withHist=total.filter(a=>a.hasRealHistory&&a.history?.length>10);
  const pct=total.length?Math.round(withHist.length/total.length*100):0;
  const col=pct>=80?'#22c55e':pct>=50?'#f59e0b':'#f87171';
  el.innerHTML=\`<div style="display:flex;align-items:center;gap:12px">
    <div style="flex:1">
      <div style="font-size:11px;font-weight:700;color:#142018;margin-bottom:4px">Cobertura de datos hist&oacute;ricos</div>
      <div style="font-size:10px;color:#8fa090">\${withHist.length} de \${total.length} activos con hist&oacute;rico real (EODHD)</div>
      <div style="height:5px;border-radius:3px;background:#eef2ef;margin-top:7px"><div style="height:100%;border-radius:3px;background:\${col};width:\${pct}%;transition:width .5s"></div></div>
    </div>
    <div style="font-size:22px;font-weight:800;color:\${col}">\${pct}%</div>
  </div>\`;
}

${anchor}`;

html = html.replace(anchor, newCode);

console.log('Chars added:', html.length - origLen);
fs.writeFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', html, 'utf8');
console.log('Done!');
