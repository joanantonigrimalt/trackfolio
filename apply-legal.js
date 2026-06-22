const fs = require('fs');
let html = fs.readFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', 'utf8');
const origLen = html.length;
let errors = [];

function replace(label, search, replacement) {
  if (!html.includes(search)) { errors.push('NOT FOUND: ' + label); return; }
  html = html.replace(search, replacement);
  console.log('OK:', label);
}

// ── 1. ADD CSS before </style> ──────────────────────────────────────────────
const legalCSS = `
/* ── Legal / Disclaimer ────────────────────────────────────────────────────── */
.legal-disclaimer{background:rgba(20,32,24,.04);border-radius:12px;padding:12px 14px;margin:14px 0 0;font-size:10.5px;color:#7a8f80;line-height:1.6;font-weight:500;text-align:center}
.legal-disclaimer b{color:#556b5a;font-weight:700}
.legal-footer{border-top:1px solid rgba(20,32,24,.08);margin-top:18px;padding:14px 0 4px;display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;justify-content:center}
.legal-footer-link{font-size:11px;color:#8fa090;font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:2px;background:none;border:none;font-family:inherit;padding:0}
.legal-footer-link:hover{color:#15803d}
.legal-footer-copy{font-size:10px;color:#b0bdb5;width:100%;text-align:center;margin-top:4px}
.ia-disclaimer{font-size:10px;color:#a0b0a5;text-align:center;padding:6px 14px 4px;line-height:1.5;font-style:italic;border-top:1px solid #f5f5f5}
/* ── Privacy & Terms screens ─────────────────────────────────────────────── */
.priv-back{display:flex;align-items:center;gap:8px;background:none;border:none;font:inherit;font-size:14px;font-weight:700;color:#142018;cursor:pointer;padding:4px 0 18px;width:100%}
.priv-title{font-size:22px;font-weight:800;color:#142018;letter-spacing:-.03em;margin-bottom:4px}
.priv-updated{font-size:11px;color:#8fa090;margin-bottom:20px}
.priv-section{margin-bottom:18px}
.priv-section h3{font-size:13px;font-weight:800;color:#142018;margin-bottom:7px;padding-bottom:5px;border-bottom:1px solid rgba(20,32,24,.06)}
.priv-section p,.priv-section li{font-size:12.5px;color:#3d5143;line-height:1.7}
.priv-section ul{padding-left:16px;margin-top:4px}
.priv-section li{margin-bottom:3px}
.priv-highlight{background:#e6faf3;border-left:3px solid #15803d;border-radius:0 10px 10px 0;padding:10px 14px;margin:12px 0 20px;font-size:12px;color:#1a3f2c;font-weight:600;line-height:1.6}
.priv-contact-btn{display:inline-block;background:#15803d;color:#fff;font-size:12px;font-weight:700;border-radius:10px;padding:9px 20px;margin-top:8px;text-decoration:none;cursor:pointer;border:none;font-family:inherit}
`;
replace('CSS', '</style>', legalCSS + '</style>');

// ── Reusable disclaimer + footer ─────────────────────────────────────────────
const disc = `
<div class="legal-disclaimer">
  <b>Aviso legal:</b> Finasset es una herramienta de seguimiento personal de carteras.<br>
  NO constituye asesoramiento financiero personalizado ni recomendaci&oacute;n de inversi&oacute;n.<br>
  Datos de fuentes externas (EODHD). Toda inversi&oacute;n conlleva riesgos, incluida la p&eacute;rdida total del capital.<br>
  <b>T&uacute; asumes toda la responsabilidad por tus decisiones.</b>
</div>`;

const footer = `
<div class="legal-footer">
  <button class="legal-footer-link" onclick="showScreen('privacy')">Pol&iacute;tica de Privacidad</button>
  <button class="legal-footer-link" onclick="showScreen('terms')">T&eacute;rminos de Uso</button>
  <a class="legal-footer-link" href="mailto:hola@finasset.app">hola@finasset.app</a>
  <div class="legal-footer-copy">&copy; 2026 Finasset &middot; Herramienta personal de tracking &middot; Datos EODHD</div>
</div>`;

// ── 2. HOME screen – insert disc+footer just before screen closing </div> ─────
// Before: "  </div>\n</div>\n\n<!-- ============ CARTERA"
replace('HOME disclaimer+footer',
  '  </div>\n</div>\n\n<!-- ============ CARTERA ============ -->',
  disc + footer + '\n  </div>\n</div>\n\n<!-- ============ CARTERA ============ -->'
);

// ── 3. ANALYSIS screen – insert disc+footer just before closing </div> ───────
// Before: "\n  </div>\n</div>\n\n<!-- ============ DIVIDENDOS"
replace('ANALYSIS disclaimer+footer',
  '\n  </div>\n</div>\n\n<!-- ============ DIVIDENDOS ============ -->',
  disc + footer + '\n\n  </div>\n</div>\n\n<!-- ============ DIVIDENDOS ============ -->'
);

// ── 4. DIVIDENDS screen – insert disc+footer just before closing </div> ──────
// Before: ">\n</div>\n\n<!-- ============ IA"
replace('DIVIDENDS disclaimer+footer',
  '</div>\n\n<!-- ============ IA ============ -->',
  disc + footer + '\n</div>\n\n<!-- ============ IA ============ -->'
);

// ── 5. PORTFOLIO screen – insert disc after top header ───────────────────────
replace('PORTFOLIO disclaimer',
  '  <div class="addTrigger" id="btnOpenSearch2">',
  disc + '\n  <div class="addTrigger" id="btnOpenSearch2">'
);

// ── 6. AI CHAT – insert disclaimer line just before input row ────────────────
replace('AI disclaimer',
  '      <div class="chat-input-row">',
  '      <div class="ia-disclaimer">Respuestas orientativas &mdash; no asesoramiento financiero personalizado.</div>\n      <div class="chat-input-row">'
);

// ── 7. AUTH SHEET – insert disclaimer before verify-state section ─────────────
const authDisclaimer = `  <div style="font-size:10.5px;color:#8fa090;text-align:center;padding:8px 20px 4px;line-height:1.55;">
    Finasset es una herramienta de seguimiento personal. No asesoramiento financiero.<br>
    <button class="legal-footer-link" style="font-size:10.5px" onclick="closeAuthModal();showScreen('privacy')">Pol&iacute;tica de Privacidad</button>
    &middot;
    <button class="legal-footer-link" style="font-size:10.5px" onclick="closeAuthModal();showScreen('terms')">T&eacute;rminos de Uso</button>
  </div>\n`;
replace('AUTH disclaimer',
  '  <div id="authVerifyState"',
  authDisclaimer + '  <div id="authVerifyState"'
);

// ── 8. PRIVACY + TERMS screens HTML (insert before TAB BAR) ──────────────────
const privacyTermsHTML = `
<!-- ============ PRIVACY POLICY ============ -->
<div id="screen-privacy" class="screen">
  <button class="priv-back" onclick="showScreen('home')">&#8592; Volver</button>
  <div class="priv-title">Pol&iacute;tica de Privacidad</div>
  <div class="priv-updated">&#218;ltima actualizaci&oacute;n: 18 de marzo de 2026</div>
  <div class="priv-highlight">Finasset es una herramienta personal de seguimiento de carteras. No somos asesores financieros ni intermediarios regulados.</div>
  <div class="priv-section"><h3>1. Datos que recogemos</h3><ul>
    <li><b>Cuenta:</b> email y contrase&ntilde;a (o login con Google). Nombre opcional.</li>
    <li><b>Portfolio:</b> activos, cantidades, precios de compra, dividendos que t&uacute; introduces manualmente.</li>
    <li><b>T&eacute;cnicos:</b> IP, tipo de navegador y dispositivo (seguridad y mejoras).</li>
  </ul></div>
  <div class="priv-section"><h3>2. Datos que NO recogemos</h3><ul>
    <li>N&uacute;meros de cuenta bancaria ni credenciales de broker.</li>
    <li>Datos de tarjetas de cr&eacute;dito o d&eacute;bito.</li>
    <li>Ubicaci&oacute;n precisa, contactos ni archivos del dispositivo.</li>
  </ul></div>
  <div class="priv-section"><h3>3. Uso de terceros</h3>
    <p><b>EODHD</b> se usa exclusivamente para obtener precios p&uacute;blicos de mercado e hist&oacute;ricos. No compartimos tus datos personales con EODHD ni con ning&uacute;n tercero para fines comerciales o publicitarios.</p>
  </div>
  <div class="priv-section"><h3>4. C&oacute;mo usamos tus datos</h3><ul>
    <li>Mostrar el estado de tu cartera en la app.</li>
    <li>Autenticaci&oacute;n y seguridad de tu cuenta.</li>
    <li>Mejorar la experiencia de la aplicaci&oacute;n.</li>
  </ul><p style="margin-top:8px"><b>No vendemos tus datos. No usamos publicidad personalizada. No cedemos datos a terceros para marketing.</b></p></div>
  <div class="priv-section"><h3>5. Seguridad</h3>
    <p>Todos los datos se transmiten mediante HTTPS. Las contrase&ntilde;as se almacenan cifradas. Los datos del portfolio se almacenan en servidores seguros.</p>
  </div>
  <div class="priv-section"><h3>6. Tus derechos (RGPD)</h3><ul>
    <li><b>Acceso:</b> puedes solicitar una copia de tus datos.</li>
    <li><b>Rectificaci&oacute;n:</b> puedes corregir datos incorrectos.</li>
    <li><b>Borrado:</b> puedes eliminar tu cuenta y todos tus datos desde Configuraci&oacute;n o escribiendo a hola@finasset.app.</li>
    <li><b>Portabilidad:</b> puedes solicitar exportar tus datos en formato JSON/CSV.</li>
  </ul></div>
  <div class="priv-section"><h3>7. Cookies</h3>
    <p>Usamos &uacute;nicamente cookies de sesi&oacute;n necesarias para el funcionamiento (autenticaci&oacute;n). No usamos cookies de seguimiento ni publicidad.</p>
  </div>
  <div class="priv-section"><h3>8. Cambios en esta pol&iacute;tica</h3>
    <p>Notificaremos cualquier cambio relevante mediante un aviso en la app o por email.</p>
  </div>
  <div class="priv-section"><h3>9. Contacto</h3>
    <p>Para consultas sobre privacidad o para ejercer tus derechos RGPD:</p>
    <a class="priv-contact-btn" href="mailto:hola@finasset.app">hola@finasset.app</a>
  </div>
  <div class="legal-footer" style="margin-bottom:0">
    <button class="legal-footer-link" onclick="showScreen('terms')">T&eacute;rminos de Uso</button>
    <div class="legal-footer-copy">&copy; 2026 Finasset</div>
  </div>
</div>

<!-- ============ TERMS OF USE ============ -->
<div id="screen-terms" class="screen">
  <button class="priv-back" onclick="showScreen('home')">&#8592; Volver</button>
  <div class="priv-title">T&eacute;rminos de Uso</div>
  <div class="priv-updated">&#218;ltima actualizaci&oacute;n: 18 de marzo de 2026</div>
  <div class="priv-highlight">Al usar Finasset aceptas estos t&eacute;rminos. Si no est&aacute;s de acuerdo, no uses la aplicaci&oacute;n.</div>
  <div class="priv-section"><h3>1. Descripci&oacute;n del servicio</h3>
    <p>Finasset es una herramienta personal de seguimiento de carteras de inversi&oacute;n. Permite registrar posiciones, visualizar rentabilidades y obtener datos p&uacute;blicos de mercado. <b>No es un servicio de asesoramiento financiero, ni una plataforma de inversi&oacute;n, ni un broker.</b></p>
  </div>
  <div class="priv-section"><h3>2. Exenci&oacute;n de responsabilidad financiera</h3>
    <p>Toda la informaci&oacute;n mostrada en Finasset es meramente orientativa. Los datos de precios y rentabilidades provienen de fuentes externas (EODHD) y pueden no ser exactos ni actualizados en tiempo real.</p>
    <p style="margin-top:8px"><b>Finasset no es responsable de ninguna decisi&oacute;n de inversi&oacute;n que tomes bas&aacute;ndote en la informaci&oacute;n de la app. Toda inversi&oacute;n conlleva riesgos, incluida la p&eacute;rdida total del capital invertido.</b></p>
  </div>
  <div class="priv-section"><h3>3. Uso aceptable</h3><ul>
    <li>Solo para uso personal, no comercial.</li>
    <li>No intentar manipular, hackear o alterar el servicio.</li>
    <li>No compartir tu cuenta con terceros.</li>
  </ul></div>
  <div class="priv-section"><h3>4. Precisi&oacute;n de los datos</h3>
    <p>Los datos de mercado se obtienen de EODHD y pueden tener retrasos. Finasset no garantiza la exactitud, completitud o actualidad de los datos mostrados.</p>
  </div>
  <div class="priv-section"><h3>5. Modificaciones del servicio</h3>
    <p>Podemos modificar, suspender o discontinuar el servicio en cualquier momento. Notificaremos cambios importantes con antelaci&oacute;n razonable.</p>
  </div>
  <div class="priv-section"><h3>6. Legislaci&oacute;n aplicable</h3>
    <p>Estos t&eacute;rminos se rigen por la legislaci&oacute;n espa&ntilde;ola. Para cualquier disputa, las partes se someten a los juzgados y tribunales competentes de Espa&ntilde;a.</p>
  </div>
  <div class="priv-section"><h3>7. Contacto</h3>
    <a class="priv-contact-btn" href="mailto:hola@finasset.app">hola@finasset.app</a>
  </div>
  <div class="legal-footer" style="margin-bottom:0">
    <button class="legal-footer-link" onclick="showScreen('privacy')">Pol&iacute;tica de Privacidad</button>
    <div class="legal-footer-copy">&copy; 2026 Finasset</div>
  </div>
</div>

`;
replace('Privacy+Terms screens',
  '<!-- TAB BAR -->',
  privacyTermsHTML + '<!-- TAB BAR -->'
);

// ── 9. showScreen: handle privacy/terms without tab highlight ─────────────────
replace('showScreen privacy/terms',
  'function showScreen(name,keepTab=false){',
  `function showScreen(name,keepTab=false){
  if(name==='privacy'||name==='terms'){
    document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
    const s=document.getElementById('screen-'+name);
    if(s){s.classList.add('active');s.scrollTop=0;}
    return;
  }`
);

// ── Summary ───────────────────────────────────────────────────────────────────
if(errors.length){
  console.error('\nERRORS:\n', errors.join('\n'));
  process.exit(1);
}
console.log('\nAll replacements OK');
console.log('Original:', origLen, '| New:', html.length, '| Added:', html.length - origLen, 'chars');
fs.writeFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', html, 'utf8');
console.log('Saved.');
