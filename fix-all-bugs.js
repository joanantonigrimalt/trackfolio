// fix-all-bugs.js — Comprehensive bug fixes for Finasset
// Fixes: 10 grave + 10 medium + 10 normal bugs
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const orig = html;

let applied = 0, failed = 0;

function apply(description, oldStr, newStr) {
  if (!html.includes(oldStr)) {
    console.error('❌ NOT FOUND: ' + description);
    failed++;
    return false;
  }
  const count = html.split(oldStr).length - 1;
  if (count > 1) console.warn('⚠️  MULTIPLE (' + count + '): ' + description);
  html = html.split(oldStr).join(newStr);
  console.log('✅ ' + description);
  applied++;
  return true;
}

// ════════════════════════════════════
// GRAVE BUG FIXES (10)
// ════════════════════════════════════

// G1: _setAuthMode() — button text hardcoded Spanish
apply(
  'G1: _setAuthMode() button text bilingual',
  "document.getElementById('authSubmitBtn').textContent=mode==='login'?'Entrar':'Crear cuenta';",
  "document.getElementById('authSubmitBtn').textContent=mode==='login'?(currentLang==='es'?'Entrar':'Sign in'):(currentLang==='es'?'Crear cuenta':'Create account');"
);

// G2: _submitAuth() finally block button text hardcoded Spanish
apply(
  'G2: _submitAuth() finally block bilingual',
  "btn.textContent=_authMode==='login'?'Entrar':'Crear cuenta';",
  "btn.textContent=_authMode==='login'?(currentLang==='es'?'Entrar':'Sign in'):(currentLang==='es'?'Crear cuenta':'Create account');"
);

// G3: renderTxHistory() — costCcy(a) crashes when asset not found (a=undefined)
apply(
  'G3: renderTxHistory() null guard for asset before costCcy',
  "    const a=assets.find(x=>x.isin===currentModalIsin);\n    const ccy=costCcy(a)||'EUR';",
  "    const a=assets.find(x=>x.isin===currentModalIsin);\n    if(!a)return '';\n    const ccy=costCcy(a)||'EUR';"
);

// G4: computeHealthScore() — NaN diversif when n=1 (1-1/n = 0 → division by zero)
apply(
  'G4: computeHealthScore() NaN diversif when n=1',
  "  const diversif=n>1?Math.round(Math.max(0,Math.min(100,(1-(hhi-1/n)/(1-1/n))*100))):0;",
  "  const _divRaw=n>1?((1-(hhi-1/n)/(1-1/n))*100):0;\n  const diversif=Math.round(Math.max(0,Math.min(100,Number.isFinite(_divRaw)?_divRaw:0)));"
);

// G5: boot() error message hardcoded Spanish
apply(
  'G5: boot() error message bilingual',
  "catch(e){ document.getElementById('chartNote').textContent='Error cargando portfolio: '+e.message; return; }",
  "catch(e){ document.getElementById('chartNote').textContent=(currentLang==='es'?'Error cargando portfolio: ':'Error loading portfolio: ')+e.message; return; }"
);

// G6: buildTfRow() — no null guard for row element
apply(
  'G6: buildTfRow() null guard for row',
  "function buildTfRow(){\n  const row=document.getElementById('tfRowHome');\n  row.innerHTML=",
  "function buildTfRow(){\n  const row=document.getElementById('tfRowHome');\n  if(!row)return;\n  row.innerHTML="
);

// G7: buildTfRow() — addEventListener accumulates on every call → use onclick
apply(
  'G7: buildTfRow() listener accumulation → onclick',
  "  row.querySelectorAll('.tfBtn').forEach(btn=>btn.addEventListener('click',()=>{selectedRange=btn.dataset.range;buildTfRow();renderChart();}));",
  "  row.querySelectorAll('.tfBtn').forEach(btn=>{btn.onclick=function(){selectedRange=btn.dataset.range;buildTfRow();renderChart();};});"
);

// G8: _anRenderWeightDonut() — "activos" hardcoded Spanish
apply(
  "G8: _anRenderWeightDonut() 'activos' bilingual",
  "  if(badge)badge.textContent=active.length+' activos';",
  "  if(badge)badge.textContent=active.length+' '+(currentLang==='es'?'activos':'assets');"
);

// G9: _submitAuth() old modal — error messages hardcoded Spanish
apply(
  'G9a: _submitAuth() service unavailable bilingual',
  "if(!_sb){_showAuthMsg('Servicio no disponible.','err');return;}",
  "if(!_sb){_showAuthMsg(currentLang==='es'?'Servicio no disponible.':'Service unavailable.','err');return;}"
);
apply(
  'G9b: _submitAuth() email+pass required bilingual',
  "  if(!email||!pass){_showAuthMsg('Email y contraseña obligatorios.','err');return;}",
  "  if(!email||!pass){_showAuthMsg(currentLang==='es'?'Email y contraseña obligatorios.':'Email and password are required.','err');return;}"
);
apply(
  'G9c: _submitAuth() password min length bilingual',
  "  if(pass.length<8){_showAuthMsg('Contraseña mínimo 8 caracteres.','err');return;}",
  "  if(pass.length<8){_showAuthMsg(currentLang==='es'?'Contraseña mínimo 8 caracteres.':'Password must be at least 8 characters.','err');return;}"
);
apply(
  'G9d: _submitAuth() error message object bilingual',
  "    const m=e.message?.includes('Invalid login credentials')?'Email o contraseña incorrectos.':\n             e.message?.includes('not confirmed')?'Confirma tu email antes de entrar.':\n             e.message?.includes('already registered')?'Email ya registrado.':\n             e.message||'Error desconocido.';",
  "    const _isEs9=currentLang==='es';\n    const m=e.message?.includes('Invalid login credentials')?(_isEs9?'Email o contraseña incorrectos.':'Invalid email or password.'):\n             e.message?.includes('not confirmed')?(_isEs9?'Confirma tu email antes de entrar.':'Please confirm your email first.'):\n             e.message?.includes('already registered')?(_isEs9?'Email ya registrado.':'Email already registered.'):\n             e.message||(_isEs9?'Error desconocido.':'Unknown error.');"
);

// G10: _insLoad() "Reintentar" button hardcoded Spanish
apply(
  'G10: _insLoad() Reintentar button bilingual',
  ">Reintentar</button></div>';",
  ">\"+(currentLang==='es'?'Reintentar':'Retry')+\"</button></div>';"
);

// ════════════════════════════════════
// MEDIUM BUG FIXES (10)
// ════════════════════════════════════

// M1: _anRenderPerfBars() — "Sin datos" hardcoded Spanish
apply(
  "M1: _anRenderPerfBars() 'Sin datos' bilingual",
  "  if(!active.length){wrap.innerHTML='<div style=\"font-size:12px;color:#8fa090;text-align:center;padding:16px\">Sin datos</div>';return;}",
  "  if(!active.length){wrap.innerHTML='<div style=\"font-size:12px;color:#8fa090;text-align:center;padding:16px\">'+(currentLang==='es'?'Sin datos':'No data')+'</div>';return;}"
);

// M2: _editDivGoal() prompt text hardcoded Spanish
apply(
  'M2: _editDivGoal() prompt text bilingual',
  "  const val=prompt('Objetivo de dividendos anuales (€):',cur||'');",
  "  const val=prompt(currentLang==='es'?'Objetivo de dividendos anuales (€):':'Annual dividend goal (€):',cur||'');"
);

// M3: renderChart() — _drawChart called with empty values crashes
apply(
  'M3: renderChart() guard empty series before _drawChart (multi-day)',
  "  const lp=series[series.length-1];\n  if(!lp){canvas.style.display='none';fallback.style.display='flex';return;}",
  "  if(!series.length||!values.some(v=>Number.isFinite(v))){canvas.style.display='none';fallback.style.display='flex';meta.textContent='';return;}\n  const lp=series[series.length-1];\n  if(!lp){canvas.style.display='none';fallback.style.display='flex';return;}"
);

// M4: saveTransaction() — silently returns on invalid input, no user feedback
apply(
  'M4: saveTransaction() user feedback on invalid input',
  "  if(qty<=0||price<=0||!date)return;",
  "  if(qty<=0||price<=0||!date){const _fe=document.getElementById('txError');if(_fe){_fe.textContent=currentLang==='es'?'Completa cantidad, precio y fecha.':'Fill in quantity, price and date.';_fe.style.display='';}return;}"
);

// M5: Asset detail chart event listeners also accumulate → use onclick
apply(
  'M5: asset tfBtnA listener accumulation → onclick',
  "  tfRow.querySelectorAll('.tfBtnA').forEach(btn=>btn.addEventListener('click',()=>{assetRange=btn.dataset.r;renderAssetChart();}));",
  "  tfRow.querySelectorAll('.tfBtnA').forEach(btn=>{btn.onclick=function(){assetRange=btn.dataset.r;renderAssetChart();};});"
);

// M6: renderSettings() "Entrar o registrarse" hardcoded Spanish
apply(
  "M6: renderSettings() login button bilingual",
  '`<button class="accountLoginBtn" id="btnOpenAuth">Entrar o registrarse</button>`',
  '`<button class="accountLoginBtn" id="btnOpenAuth">${currentLang===\'es\'?\'Entrar o registrarse\':\'Sign in or create account\'}</button>`'
);

// M7: _drawChart() — guard against empty/NaN values array to prevent crash
apply(
  'M7: _drawChart() guard empty/NaN values',
  "function _drawChart(canvas,labels,values,note,meta,rv,noteText){\n  const first=values[0],last=values[values.length-1],delta=last-first,pct=first>0?(delta/first)*100:0,isUp=delta>=0;",
  "function _drawChart(canvas,labels,values,note,meta,rv,noteText){\n  if(!values||!values.length||!values.some(v=>Number.isFinite(v))){if(note)note.textContent=noteText||'';return;}\n  const first=values[0],last=values[values.length-1],delta=last-first,pct=first>0?(delta/first)*100:0,isUp=delta>=0;"
);

// M8: _anRenderSummary() — history access guard (a.history must have length>=2)
apply(
  'M8: _anRenderSummary() history access guard length>=2',
  "assets.forEach(a=>{const dp=getDayPct(a);if(dp!=null){prev+=toDisplay(a.quantity*(a.history[a.history.length-2]?.close??0),assetCcy(a));has=true;}else prev+=toDisplay(a.value,assetCcy(a));});",
  "assets.forEach(a=>{const dp=getDayPct(a);if(dp!=null&&a.history&&a.history.length>=2){prev+=toDisplay(a.quantity*(a.history[a.history.length-2].close??0),assetCcy(a));has=true;}else prev+=toDisplay(a.value,assetCcy(a));});"
);

// M9: coveragePill initial HTML text is Spanish
apply(
  "M9: coveragePill initial text English",
  '      <div class="pill info" id="coveragePill">cargando...</div>',
  '      <div class="pill info" id="coveragePill">loading...</div>'
);
// Update switchLang to also update the loading text
apply(
  'M9b: switchLang coveragePill loading text',
  "  var _dl=document.getElementById('auth-demo-label');if(_dl)_dl.textContent=isEs?'Ver demo \u2014 sin cuenta':'Try the demo \u2014 no account needed';",
  "  var _dl=document.getElementById('auth-demo-label');if(_dl)_dl.textContent=isEs?'Ver demo \u2014 sin cuenta':'Try the demo \u2014 no account needed';\n  var _cpEl=document.getElementById('coveragePill');if(_cpEl&&(_cpEl.textContent==='loading...'||_cpEl.textContent==='cargando...'))_cpEl.textContent=isEs?'cargando...':'loading...';"
);

// M10: insiders "Sin resultados para este filtro" hardcoded Spanish
apply(
  "M10: insiders empty filter state bilingual",
  "    el.innerHTML = '<div style=\"text-align:center;padding:60px 0;color:#8fa090;font-size:13px\"><div style=\"font-size:32px;margin-bottom:10px\">\uD83D\uDCED</div>Sin resultados para este filtro</div>';",
  "    el.innerHTML = '<div style=\"text-align:center;padding:60px 0;color:#8fa090;font-size:13px\"><div style=\"font-size:32px;margin-bottom:10px\">\uD83D\uDCED</div>'+(currentLang==='es'?'Sin resultados para este filtro':'No results for this filter')+'</div>';"
);

// ════════════════════════════════════
// NORMAL BUG FIXES (10)
// ════════════════════════════════════

// N1: FAB aria-label "Añadir" → "Add"
apply(
  'N1: FAB aria-label bilingual',
  'aria-label="A\u00f1adir"',
  'aria-label="Add"'
);

// N2: homeSub default HTML text is Spanish (i18n updates it, but initial render before switchLang is called shows Spanish)
apply(
  'N2: homeSub default text English',
  'Cartera propia · ETFs, fondos y metales preciosos</div>',
  'My portfolio · ETFs, funds &amp; precious metals</div>'
);

// N3: static auth cover button "Entrar o registrarse" in HTML
apply(
  'N3: static auth cover btn default English',
  '    <button class="accountLoginBtn" id="btnOpenAuth">Entrar o registrarse</button>',
  '    <button class="accountLoginBtn" id="btnOpenAuth">Sign in or create account</button>'
);

// N4: "Meta anual" section title and "Editar objetivo" button — add ids for i18n
apply(
  'N4: Annual goal title and edit button get IDs for i18n',
  '      <div class="sectionTitle" style="margin:0">Meta anual</div>\n      <button class="div-goal-edit" onclick="_editDivGoal()">Editar objetivo</button>',
  '      <div class="sectionTitle" style="margin:0" id="divGoalTitle">Annual goal</div>\n      <button class="div-goal-edit" onclick="_editDivGoal()" id="divGoalEditBtn">Edit goal</button>'
);
// switchLang updates them
apply(
  'N4b: switchLang updates divGoalTitle and divGoalEditBtn',
  "  var _cpEl=document.getElementById('coveragePill');if(_cpEl&&(_cpEl.textContent==='loading...'||_cpEl.textContent==='cargando...'))_cpEl.textContent=isEs?'cargando...':'loading...';",
  "  var _cpEl=document.getElementById('coveragePill');if(_cpEl&&(_cpEl.textContent==='loading...'||_cpEl.textContent==='cargando...'))_cpEl.textContent=isEs?'cargando...':'loading...';\n  var _dgt=document.getElementById('divGoalTitle');if(_dgt)_dgt.textContent=isEs?'Meta anual':'Annual goal';\n  var _dgb=document.getElementById('divGoalEditBtn');if(_dgb)_dgb.textContent=isEs?'Editar objetivo':'Edit goal';"
);

// N5: Top Holdings title bilingual
apply(
  'N5: Top Holdings title bilingual',
  "if(hTitle)hTitle.innerHTML='Top Holdings'+(totalW>0?",
  "if(hTitle)hTitle.innerHTML=(currentLang==='es'?'Principales posiciones':'Top Holdings')+(totalW>0?"
);

// N6: Insiders "Compras"/"Ventas" labels in summary hardcoded Spanish
apply(
  "N6: Insiders summary 'Compras' label bilingual",
  "      + '<div style=\"font-size:10px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:2px\">Compras</div>'",
  "      + '<div style=\"font-size:10px;color:#15803d;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:2px\">'+(currentLang==='es'?'Compras':'Buys')+'</div>'"
);
apply(
  "N6b: Insiders summary 'Ventas' label bilingual",
  "      + '<div style=\"font-size:10px;color:#dc2626;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:2px\">Ventas</div>'",
  "      + '<div style=\"font-size:10px;color:#dc2626;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:2px\">'+(currentLang==='es'?'Ventas':'Sells')+'</div>'"
);

// N7: Insiders card label "COMPRA"/"VENTA" hardcoded Spanish
apply(
  "N7: Insiders card label COMPRA/VENTA bilingual",
  "    var label = isBuy ? '\u25b2 COMPRA' : isSell ? '\u25bc VENTA' : (r.transactionType||'\u2014');",
  "    var label = isBuy ? ('\u25b2 '+(currentLang==='es'?'COMPRA':'BUY')) : isSell ? ('\u25bc '+(currentLang==='es'?'VENTA':'SELL')) : (r.transactionType||'\u2014');"
);

// N8: Dividend DRIP text hardcoded Spanish
apply(
  'N8a: divDripBaseSub bilingual',
  '`en ${years} años (acumulado)`',
  '`${currentLang===\'es\'?\'en \'+years+\' años (acumulado)\':(\'in \'+years+\' years (total)\')}`'
);
apply(
  'N8b: divDripDripSub bilingual',
  '`en ${years} años (+${(rate*100).toFixed(0)}%/año)`',
  '`${currentLang===\'es\'?\'en \'+years+\' años (+\'+(rate*100).toFixed(0)+\'%/año)\':\'in \'+years+\' years (+\'+(rate*100).toFixed(0)+\'%/yr)\'}`'
);
apply(
  'N8c: divDripNote bilingual',
  '`Reinvirtiendo los dividendos al ${(rate*100).toFixed(0)}% anual obtendrías ${fe(gain)} más en ${years} años.`',
  '`${currentLang===\'es\'?\'Reinvirtiendo los dividendos al \'+(rate*100).toFixed(0)+\'% anual obtendrías \'+fe(gain)+\' más en \'+years+\' años.\':\'Reinvesting dividends at \'+(rate*100).toFixed(0)+\'%/yr you would earn \'+fe(gain)+\' more over \'+years+\' years.\'}`'
);

// N9: Demo banner "Salir" button bilingual — add ID so switchLang can translate it
apply(
  'N9: Demo banner exit button gets ID',
  '  <button onclick="exitDemo()">Salir</button>',
  '  <button onclick="exitDemo()" id="demoBannerExitBtn">Exit</button>'
);
// switchLang updates it
apply(
  'N9b: switchLang updates demoBannerExitBtn',
  "  var _dgt=document.getElementById('divGoalTitle');if(_dgt)_dgt.textContent=isEs?'Meta anual':'Annual goal';\n  var _dgb=document.getElementById('divGoalEditBtn');if(_dgb)_dgb.textContent=isEs?'Editar objetivo':'Edit goal';",
  "  var _dgt=document.getElementById('divGoalTitle');if(_dgt)_dgt.textContent=isEs?'Meta anual':'Annual goal';\n  var _dgb=document.getElementById('divGoalEditBtn');if(_dgb)_dgb.textContent=isEs?'Editar objetivo':'Edit goal';\n  var _dbe=document.getElementById('demoBannerExitBtn');if(_dbe)_dbe.textContent=isEs?'Salir':'Exit';"
);

// N10: insiders card "acciones" shares label hardcoded Spanish
apply(
  "N10: Insiders card 'acciones' shares label bilingual",
  "var shares = r.securitiesTransacted != null ? Number(r.securitiesTransacted).toLocaleString('es-ES') : '\u2014';",
  "var shares = r.securitiesTransacted != null ? Number(r.securitiesTransacted).toLocaleString(currentLang==='es'?'es-ES':'en-US') : '\u2014';"
);

// ════════════════════════════════════
// SW cache version bump
// ════════════════════════════════════
const SW_FILE = path.join(__dirname, 'sw.js');
let sw = fs.readFileSync(SW_FILE, 'utf8');
sw = sw.replace(/finasset-v\d+/, 'finasset-v64');
fs.writeFileSync(SW_FILE, sw, 'utf8');
console.log('✅ SW cache bumped to v64');

// ════════════════════════════════════
// Result
// ════════════════════════════════════
if (html === orig) {
  console.log('\n⚠️  No changes made!');
} else {
  fs.writeFileSync(FILE, html, 'utf8');
  console.log('\n🎉 Done: ' + applied + ' fixes applied, ' + failed + ' not found.');
}
