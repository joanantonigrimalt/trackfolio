// fix-bugs-2.js — Fix remaining 10 bugs that failed in first pass (CRLF/unicode issues)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const orig = html;
let applied = 0, failed = 0;

function apply(description, oldStr, newStr) {
  if (!html.includes(oldStr)) {
    console.error('❌ NOT FOUND: ' + description);
    // Try to show context
    const key = oldStr.slice(0, 40);
    const idx = html.indexOf(key);
    if (idx >= 0) console.log('  (partial match at', idx, ')', JSON.stringify(html.slice(idx, idx+80)));
    failed++;
    return false;
  }
  html = html.split(oldStr).join(newStr);
  console.log('✅ ' + description);
  applied++;
  return true;
}

// G3: renderTxHistory() null guard — need CRLF between lines
apply(
  'G3: renderTxHistory() null guard for asset',
  "    const a=assets.find(x=>x.isin===currentModalIsin);\r\n    const ccy=costCcy(a)||'EUR';",
  "    const a=assets.find(x=>x.isin===currentModalIsin);\r\n    if(!a)return '';\r\n    const ccy=costCcy(a)||'EUR';"
);

// G6: buildTfRow() null guard — CRLF
apply(
  'G6: buildTfRow() null guard for row',
  "function buildTfRow(){\r\n  const row=document.getElementById('tfRowHome');\r\n  row.innerHTML=",
  "function buildTfRow(){\r\n  const row=document.getElementById('tfRowHome');\r\n  if(!row)return;\r\n  row.innerHTML="
);

// G9d: _submitAuth() error messages — CRLF multiline
apply(
  'G9d: _submitAuth() error messages bilingual',
  "    const m=e.message?.includes('Invalid login credentials')?'Email o contraseña incorrectos.':\r\n             e.message?.includes('not confirmed')?'Confirma tu email antes de entrar.':\r\n             e.message?.includes('already registered')?'Email ya registrado.':\r\n             e.message||'Error desconocido.';",
  "    const _isEs9=currentLang==='es';\r\n    const m=e.message?.includes('Invalid login credentials')?(_isEs9?'Email o contraseña incorrectos.':'Invalid email or password.'):\r\n             e.message?.includes('not confirmed')?(_isEs9?'Confirma tu email antes de entrar.':'Please confirm your email first.'):\r\n             e.message?.includes('already registered')?(_isEs9?'Email ya registrado.':'Email already registered.'):\r\n             e.message||(_isEs9?'Error desconocido.':'Unknown error.');"
);

// M3: renderChart() guard — CRLF
apply(
  'M3: renderChart() empty series guard',
  "  const lp=series[series.length-1];\r\n  if(!lp){canvas.style.display='none';fallback.style.display='flex';return;}",
  "  if(!series.length||!values.some(v=>Number.isFinite(v))){canvas.style.display='none';fallback.style.display='flex';meta.textContent='';return;}\r\n  const lp=series[series.length-1];\r\n  if(!lp){canvas.style.display='none';fallback.style.display='flex';return;}"
);

// M7: _drawChart() guard — CRLF
apply(
  'M7: _drawChart() guard empty/NaN values',
  "function _drawChart(canvas,labels,values,note,meta,rv,noteText){\r\n  const first=values[0],last=values[values.length-1],delta=last-first,pct=first>0?(delta/first)*100:0,isUp=delta>=0;",
  "function _drawChart(canvas,labels,values,note,meta,rv,noteText){\r\n  if(!values||!values.length||!values.some(v=>Number.isFinite(v))){if(note)note.textContent=noteText||'';return;}\r\n  const first=values[0],last=values[values.length-1],delta=last-first,pct=first>0?(delta/first)*100:0,isUp=delta>=0;"
);

// M9b: switchLang coveragePill — the \u2014 in the file is a LITERAL escape sequence (6 chars), not the em-dash
apply(
  'M9b: switchLang coveragePill loading text',
  "var _dl=document.getElementById('auth-demo-label');if(_dl)_dl.textContent=isEs?'Ver demo \\u2014 sin cuenta':'Try the demo \\u2014 no account needed';",
  "var _dl=document.getElementById('auth-demo-label');if(_dl)_dl.textContent=isEs?'Ver demo \\u2014 sin cuenta':'Try the demo \\u2014 no account needed';\r\n  var _cpEl=document.getElementById('coveragePill');if(_cpEl&&(_cpEl.textContent==='loading...'||_cpEl.textContent==='cargando...'))_cpEl.textContent=isEs?'cargando...':'loading...';"
);

// N4: "Meta anual" section title with ids for i18n — CRLF between divs
apply(
  'N4: Annual goal title/button get IDs',
  '      <div class="sectionTitle" style="margin:0">Meta anual</div>\r\n      <button class="div-goal-edit" onclick="_editDivGoal()">Editar objetivo</button>',
  '      <div class="sectionTitle" style="margin:0" id="divGoalTitle">Annual goal</div>\r\n      <button class="div-goal-edit" onclick="_editDivGoal()" id="divGoalEditBtn">Edit goal</button>'
);

// N4b: switchLang updates divGoalTitle and divGoalEditBtn (insert after coveragePill line we just added)
apply(
  'N4b: switchLang updates divGoalTitle and divGoalEditBtn',
  "var _cpEl=document.getElementById('coveragePill');if(_cpEl&&(_cpEl.textContent==='loading...'||_cpEl.textContent==='cargando...'))_cpEl.textContent=isEs?'cargando...':'loading...';",
  "var _cpEl=document.getElementById('coveragePill');if(_cpEl&&(_cpEl.textContent==='loading...'||_cpEl.textContent==='cargando...'))_cpEl.textContent=isEs?'cargando...':'loading...';\r\n  var _dgt=document.getElementById('divGoalTitle');if(_dgt)_dgt.textContent=isEs?'Meta anual':'Annual goal';\r\n  var _dgb=document.getElementById('divGoalEditBtn');if(_dgb)_dgb.textContent=isEs?'Editar objetivo':'Edit goal';"
);

// N7: COMPRA/VENTA uses non-breaking space U+00A0 between arrow and label
// Bytes: e2 96 b2 (▲) c2 a0 (NBSP) 43 4f 4d 50 52 41 (COMPRA)
apply(
  'N7: Insiders card COMPRA/VENTA bilingual (with NBSP)',
  "var label = isBuy ? '\u25b2\u00a0COMPRA' : isSell ? '\u25bc\u00a0VENTA' : (r.transactionType||'\u2014');",
  "var label = isBuy ? ('\u25b2\u00a0'+(currentLang==='es'?'COMPRA':'BUY')) : isSell ? ('\u25bc\u00a0'+(currentLang==='es'?'VENTA':'SELL')) : (r.transactionType||'\u2014');"
);

// N9b: switchLang updates demoBannerExitBtn (insert after divGoalEditBtn line)
apply(
  'N9b: switchLang updates demoBannerExitBtn',
  "var _dgb=document.getElementById('divGoalEditBtn');if(_dgb)_dgb.textContent=isEs?'Editar objetivo':'Edit goal';",
  "var _dgb=document.getElementById('divGoalEditBtn');if(_dgb)_dgb.textContent=isEs?'Editar objetivo':'Edit goal';\r\n  var _dbe=document.getElementById('demoBannerExitBtn');if(_dbe)_dbe.textContent=isEs?'Salir':'Exit';"
);

// Write result
if (html === orig) {
  console.log('\n⚠️  No changes made!');
} else {
  fs.writeFileSync(FILE, html, 'utf8');
  console.log('\n🎉 Done: ' + applied + ' additional fixes applied, ' + failed + ' failed.');
}
