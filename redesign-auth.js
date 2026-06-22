const fs = require('fs');
let html = fs.readFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', 'utf8');
let n = 0;

function fix(desc, s, r) {
  if (!html.includes(s)) { console.log('MISS:', desc); return; }
  html = html.replace(s, () => r); n++;
  console.log('OK ' + n + ': ' + desc);
}

// ══════════════════════════════════════════════════
// 1. Rewrite OB_SLIDES
// ══════════════════════════════════════════════════
const si = html.indexOf('const OB_SLIDES = [');
let se = html.indexOf('];\r\nlet _obStep = 0;', si);
if(se===-1) se = html.indexOf('];\nlet _obStep = 0;', si); // LF fallback
if (si === -1 || se === -1) { console.log('FAIL: OB_SLIDES'); process.exit(1); }

const SLIDE_SVG1 = '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><rect x="4" y="24" width="8" height="16" rx="3" fill="#15803d" opacity=".4"/><rect x="15" y="16" width="8" height="24" rx="3" fill="#15803d" opacity=".7"/><rect x="26" y="8" width="8" height="32" rx="3" fill="#15803d"/><polyline points="8,22 19,14 30,7 38,11" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="38" cy="11" r="3.5" fill="#22c55e"/></svg>';
const SLIDE_SVG2 = '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><path d="M8 28 L16 18 L22 23 L30 12 L38 17" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="38" cy="17" r="3.5" fill="#3b82f6"/><rect x="6" y="6" width="13" height="8" rx="3" fill="rgba(59,130,246,.12)" stroke="#3b82f6" stroke-width="1.5"/><text x="12.5" y="12" text-anchor="middle" font-size="5.5" font-weight="700" fill="#3b82f6">+17%</text></svg>';
const SLIDE_SVG3 = '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="15" stroke="#7c3aed" stroke-width="2"/><circle cx="22" cy="22" r="3" fill="#7c3aed"/><path d="M22 7 Q35 22 22 37 Q9 22 22 7Z" fill="rgba(124,58,237,.15)" stroke="#7c3aed" stroke-width="1.5"/><path d="M30 12 L36 6" stroke="#22c55e" stroke-width="2" stroke-linecap="round"/><circle cx="37" cy="5" r="3" fill="#22c55e"/></svg>';
const SLIDE_SVG4 = '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="15" stroke="#d97706" stroke-width="2"/><text x="22" y="27" text-anchor="middle" font-size="15" font-weight="800" fill="#d97706">\u20AC$</text></svg>';

const NEW_SLIDES = 'const OB_SLIDES = [\n'
  + '  {\n'
  + '    icon: `' + SLIDE_SVG1 + '`,\n'
  + "    bg: 'rgba(21,128,61,.1)',\n"
  + "    t_en: 'Track everything in one place',\n"
  + "    t_es: 'Controla todo en un solo lugar',\n"
  + "    d_en: 'Stocks, ETFs, funds, gold and cash. Real prices, 5-year history and automatic updates \\u2014 all without spreadsheets.',\n"
  + "    d_es: 'Acciones, ETFs, fondos, oro y liquidez. Precios reales, historial de 5 a\\u00f1os y actualizaciones autom\\u00e1ticas.',\n"
  + '  },\n'
  + '  {\n'
  + '    icon: `' + SLIDE_SVG2 + '`,\n'
  + "    bg: 'rgba(59,130,246,.08)',\n"
  + "    t_en: 'Know your real returns',\n"
  + "    t_es: 'Conoce tu rentabilidad real',\n"
  + "    d_en: 'Every range \\u2014 1D, 1M, YTD, 5Y \\u2014 shows the true % gain for that exact period. Spot concentration, risk and currency exposure at a glance.',\n"
  + "    d_es: 'Cada rango \\u2014 1D, 1M, YTD, 5A \\u2014 muestra el % real del periodo. Detecta concentraci\\u00f3n, riesgo y exposici\\u00f3n de divisa.',\n"
  + '  },\n'
  + '  {\n'
  + '    icon: `' + SLIDE_SVG3 + '`,\n'
  + "    bg: 'rgba(124,58,237,.08)',\n"
  + "    t_en: 'Your personal portfolio analyst',\n"
  + "    t_es: 'Tu analista personal de cartera',\n"
  + "    d_en: 'AI scans your holdings, detects overlaps, flags concentration risk and suggests concrete improvements. Dividends tracked. Benchmarks compared.',\n"
  + "    d_es: 'La IA analiza tus activos, detecta solapamientos y sugiere mejoras. Dividendos y benchmarks incluidos.',\n"
  + '  },\n'
  + '  {\n'
  + "    type: 'ccy',\n"
  + '    icon: `' + SLIDE_SVG4 + '`,\n'
  + "    bg: 'rgba(217,119,6,.08)',\n"
  + "    t_en: 'Choose your display currency',\n"
  + "    t_es: 'Elige tu moneda de visualizaci\\u00f3n',\n"
  + "    d_en: 'All portfolio values shown in your preferred currency. Change anytime in settings.',\n"
  + "    d_es: 'Todos los valores en tu moneda preferida. Puedes cambiarlo en ajustes.',\n"
  + '  },\n'
  + '];\r\nlet _obStep = 0;';

const OLD_SLIDES_END = html[se+2] === '\r' ? '];\r\nlet _obStep = 0;' : '];\nlet _obStep = 0;';
html = html.slice(0, si) + NEW_SLIDES + html.slice(se + OLD_SLIDES_END.length);
console.log('OK ' + (++n) + ': OB_SLIDES rewritten');

// ══════════════════════════════════════════════════
// 2. Replace cs-auth section
// ══════════════════════════════════════════════════
const authStart = html.indexOf('<!-- ============ AUTH ============ -->');
const authEnd = html.indexOf('<!-- ============ INICIO ============ -->', authStart);
if (authStart === -1 || authEnd === -1) { console.log('FAIL: cs-auth bounds'); process.exit(1); }

const NEW_AUTH = '<!-- ============ AUTH ============ -->\r\n'
  + '<div id="cs-auth" class="cover-screen" style="background:linear-gradient(170deg,#f2f5f3 0%,#e8f0ea 100%)">\r\n'
  + '\r\n'
  + '  <!-- Language switcher -->\r\n'
  + '  <div class="auth-lang-row" style="position:absolute;top:0;right:0;padding:16px 20px;z-index:2">\r\n'
  + '    <button class="auth-lang-btn" id="auth-lang-es" onclick="switchLang(\'es\')">ES</button>\r\n'
  + '    <button class="auth-lang-btn active" id="auth-lang-en" onclick="switchLang(\'en\')">EN</button>\r\n'
  + '  </div>\r\n'
  + '\r\n'
  + '  <div style="flex:1;display:flex;flex-direction:column;padding:60px 24px 32px;overflow-y:auto">\r\n'
  + '\r\n'
  + '    <!-- Brand -->\r\n'
  + '    <div style="display:flex;align-items:center;gap:12px;margin-bottom:32px">\r\n'
  + '      <div style="width:46px;height:46px;background:#142018;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#f5fbf6;font-size:22px;font-weight:900;flex-shrink:0">F</div>\r\n'
  + '      <span style="font-size:21px;font-weight:800;color:#142018;letter-spacing:-.02em">Finasset</span>\r\n'
  + '    </div>\r\n'
  + '\r\n'
  + '    <!-- Hero -->\r\n'
  + '    <div id="auth-hero-title" style="font-size:27px;font-weight:800;color:#142018;letter-spacing:-.03em;line-height:1.2;margin-bottom:10px">Track your entire portfolio<br>in one place</div>\r\n'
  + '    <div id="auth-hero-sub" style="font-size:15px;color:#5a6e5e;line-height:1.6;margin-bottom:24px">Stocks, ETFs, funds, cash &amp; dividends.<br>Spot risks and improve with AI.</div>\r\n'
  + '\r\n'
  + '    <!-- Benefits -->\r\n'
  + '    <div style="display:flex;flex-direction:column;gap:9px;margin-bottom:28px">\r\n'
  + '      <div style="display:flex;align-items:center;gap:10px"><div style="width:22px;height:22px;border-radius:6px;background:#e6faf3;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 12 12" fill="none" stroke="#15803d" stroke-width="2" stroke-linecap="round" width="10" height="10"><polyline points="2,6 5,9 10,3"/></svg></div><span id="auth-b1" style="font-size:13px;color:#3d4f41;font-weight:600">Real prices &amp; 5-year history, auto-updated</span></div>\r\n'
  + '      <div style="display:flex;align-items:center;gap:10px"><div style="width:22px;height:22px;border-radius:6px;background:#e6faf3;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 12 12" fill="none" stroke="#15803d" stroke-width="2" stroke-linecap="round" width="10" height="10"><polyline points="2,6 5,9 10,3"/></svg></div><span id="auth-b2" style="font-size:13px;color:#3d4f41;font-weight:600">Dividends tracked &amp; upcoming payments</span></div>\r\n'
  + '      <div style="display:flex;align-items:center;gap:10px"><div style="width:22px;height:22px;border-radius:6px;background:#e6faf3;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 12 12" fill="none" stroke="#15803d" stroke-width="2" stroke-linecap="round" width="10" height="10"><polyline points="2,6 5,9 10,3"/></svg></div><span id="auth-b3" style="font-size:13px;color:#3d4f41;font-weight:600">AI analyses concentration, risk &amp; fees</span></div>\r\n'
  + '      <div style="display:flex;align-items:center;gap:10px"><div style="width:22px;height:22px;border-radius:6px;background:#e6faf3;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 12 12" fill="none" stroke="#15803d" stroke-width="2" stroke-linecap="round" width="10" height="10"><polyline points="2,6 5,9 10,3"/></svg></div><span id="auth-b4" style="font-size:13px;color:#3d4f41;font-weight:600">Alerts, benchmarks &amp; tax overview</span></div>\r\n'
  + '    </div>\r\n'
  + '\r\n'
  + '    <!-- Primary CTA -->\r\n'
  + '    <button onclick="enterDemo()" style="width:100%;padding:16px;background:#142018;color:#f5fbf6;border:none;border-radius:16px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;letter-spacing:-.01em;margin-bottom:10px;transition:opacity .15s">\r\n'
  + '      <span id="auth-demo-label">Try the demo \u2014 no account needed</span>\r\n'
  + '    </button>\r\n'
  + '\r\n'
  + '    <!-- Secondary CTAs -->\r\n'
  + '    <div style="display:flex;gap:8px;margin-bottom:20px">\r\n'
  + '      <button onclick="_openAuthAs(\'login\')" style="flex:1;padding:13px;background:#fff;border:1.5px solid rgba(20,32,24,.15);border-radius:14px;font:inherit;font-size:14px;font-weight:700;color:#142018;cursor:pointer"><span id="auth-signin-label">Sign in</span></button>\r\n'
  + '      <button onclick="_openAuthAs(\'register\')" style="flex:1;padding:13px;background:#fff;border:1.5px solid rgba(20,32,24,.15);border-radius:14px;font:inherit;font-size:14px;font-weight:700;color:#15803d;cursor:pointer"><span id="auth-register-label">Create account</span></button>\r\n'
  + '    </div>\r\n'
  + '\r\n'
  + '    <!-- Trust note -->\r\n'
  + '    <div id="auth-privacy-note" style="text-align:center;font-size:10.5px;color:#a0b0a5;line-height:1.6;margin-top:auto;padding-top:8px">\r\n'
  + '      By using Finasset you accept our <a href="/privacy.html" target="_blank" rel="noopener" style="color:#15803d;font-weight:600;text-decoration:none">Privacy Policy</a> and <a href="/privacy.html#terms" target="_blank" rel="noopener" style="color:#15803d;font-weight:600;text-decoration:none">Terms of Use</a>. Not financial advice.\r\n'
  + '    </div>\r\n'
  + '\r\n'
  + '    <!-- Hidden legacy IDs for switchLang compat -->\r\n'
  + '    <div style="display:none">\r\n'
  + '      <div id="auth-title"></div><div id="auth-sub"></div>\r\n'
  + '      <input id="auth-email" type="text"><input id="auth-name" type="text"><input id="auth-pass" type="password">\r\n'
  + '      <div id="auth-err"></div><button id="auth-btn-main"><span id="auth-btn-label"></span></button>\r\n'
  + '      <div id="auth-mode-link"></div><button id="auth-btn-google"><span id="auth-btn-google-text"></span></button>\r\n'
  + '    </div>\r\n'
  + '\r\n'
  + '  </div>\r\n'
  + '</div>\r\n'
  + '\r\n';

html = html.slice(0, authStart) + NEW_AUTH + html.slice(authEnd);
console.log('OK ' + (++n) + ': cs-auth redesigned');

// ══════════════════════════════════════════════════
// 3. Add _openAuthAs() before showAuthScreen
// ══════════════════════════════════════════════════
fix('Add _openAuthAs helper',
  'function showAuthScreen() {',
  'function _openAuthAs(mode){\r\n  openAuthModal();\r\n  setTimeout(function(){ _setAuthMode(mode); },50);\r\n}\r\nfunction showAuthScreen() {'
);

// ══════════════════════════════════════════════════
// 4. Update switchLang: insert new auth screen translations
//    before existing "Update auth cover screen labels" block
// ══════════════════════════════════════════════════
const swMarker = 'Update auth cover screen labels if visible';
const swIdx = html.indexOf(swMarker);
if (swIdx === -1) {
  console.log('MISS: switchLang marker');
} else {
  const INSERT = '// Update marketing auth screen\r\n'
    + "  var _ht=document.getElementById('auth-hero-title');if(_ht)_ht.innerHTML=isEs?'Controla toda tu cartera<br>en un solo lugar':'Track your entire portfolio<br>in one place';\r\n"
    + "  var _hs=document.getElementById('auth-hero-sub');if(_hs)_hs.innerHTML=isEs?'Acciones, ETFs, fondos, liquidez y dividendos.<br>Detecta riesgos y mejora con IA.':'Stocks, ETFs, funds, cash &amp; dividends.<br>Spot risks and improve with AI.';\r\n"
    + "  var _ab=[['auth-b1',isEs?'Precios reales e historial de 5 a\\u00f1os':'Real prices &amp; 5-year history, auto-updated'],['auth-b2',isEs?'Dividendos registrados y pr\\u00f3ximos pagos':'Dividends tracked &amp; upcoming payments'],['auth-b3',isEs?'IA analiza concentraci\\u00f3n, riesgo y comisiones':'AI analyses concentration, risk &amp; fees'],['auth-b4',isEs?'Alertas, benchmarks y resumen fiscal':'Alerts, benchmarks &amp; tax overview']];\r\n"
    + "  _ab.forEach(function(b){var el=document.getElementById(b[0]);if(el)el.innerHTML=b[1];});\r\n"
    + "  var _dl=document.getElementById('auth-demo-label');if(_dl)_dl.textContent=isEs?'Ver demo \\u2014 sin cuenta':'Try the demo \\u2014 no account needed';\r\n"
    + "  var _sl=document.getElementById('auth-signin-label');if(_sl)_sl.textContent=isEs?'Iniciar sesi\\u00f3n':'Sign in';\r\n"
    + "  var _rl=document.getElementById('auth-register-label');if(_rl)_rl.textContent=isEs?'Crear cuenta':'Create account';\r\n"
    + "  var _pn=document.getElementById('auth-privacy-note');if(_pn)_pn.innerHTML=isEs?'Al usar Finasset aceptas nuestra <a href=\"/privacy.html\" target=\"_blank\" rel=\"noopener\" style=\"color:#15803d;font-weight:600;text-decoration:none\">Pol\\u00edtica de Privacidad</a> y <a href=\"/privacy.html#terms\" target=\"_blank\" rel=\"noopener\" style=\"color:#15803d;font-weight:600;text-decoration:none\">T\\u00e9rminos de Uso</a>. No es asesoramiento financiero.':'By using Finasset you accept our <a href=\"/privacy.html\" target=\"_blank\" rel=\"noopener\" style=\"color:#15803d;font-weight:600;text-decoration:none\">Privacy Policy</a> and <a href=\"/privacy.html#terms\" target=\"_blank\" rel=\"noopener\" style=\"color:#15803d;font-weight:600;text-decoration:none\">Terms of Use</a>. Not financial advice.';\r\n"
    + '  // ';
  html = html.slice(0, swIdx) + INSERT + html.slice(swIdx);
  console.log('OK ' + (++n) + ': switchLang updated');
}

// ══════════════════════════════════════════════════
// 5. Translate authSheet to English
// ══════════════════════════════════════════════════
fix('authSheet: Cuenta',
  '>Cuenta</div>',
  '>Account</div>'
);
fix('authSheet: Entrar tab',
  'id="authTabLogin">Entrar</button>',
  'id="authTabLogin">Sign in</button>'
);
fix('authSheet: Registro tab',
  'id="authTabRegister">Registro</button>',
  'id="authTabRegister">Register</button>'
);
fix('authSheet: Nombre',
  '>Nombre</div>',
  '>Name</div>'
);
fix('authSheet: Tu nombre',
  'placeholder="Tu nombre"',
  'placeholder="Your name"'
);
fix('authSheet: correo',
  'placeholder="correo@ejemplo.com"',
  'placeholder="you@email.com"'
);
fix('authSheet: Contrasena label',
  '>Contrase\u00f1a</div>',
  '>Password</div>'
);
fix('authSheet: Minimo 8',
  'placeholder="M\u00ednimo 8 caracteres"',
  'placeholder="Min. 8 characters"'
);
fix('authSheet: Entrar submit',
  'id="authSubmitBtn">Entrar</button>',
  'id="authSubmitBtn">Sign in</button>'
);
fix('authSheet: legal footer ES',
  'Finasset es una herramienta de seguimiento personal. No asesoramiento financiero.',
  'Finasset is a personal portfolio tracker. Not financial advice.'
);
fix('authSheet: Politica btn',
  '>Pol\u00edtica de Privacidad</button>',
  '>Privacy Policy</button>'
);
fix('authSheet: Terminos btn',
  '>T\u00e9rminos de Uso</button>',
  '>Terms of Use</button>'
);
fix('authSheet: Revisa tu email',
  '>Revisa tu email</div>',
  '>Check your email</div>'
);
fix('authSheet: Reenviar',
  '>Reenviar email</button>',
  '>Resend email</button>'
);

console.log('\nTotal: ' + n);
fs.writeFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', html, 'utf8');
console.log('Done!');
