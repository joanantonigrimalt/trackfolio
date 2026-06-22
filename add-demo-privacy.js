const fs = require('fs');
let html = fs.readFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', 'utf8');
let n = 0;
function fix(desc, s, r) {
  if (!html.includes(s)) { console.log('MISS:', desc); return; }
  html = html.replace(s, r); n++;
  console.log('OK ' + n + ': ' + desc);
}

// ══════════════════════════════════════════════════
// 1. DEMO BANNER CSS + AUTH BUTTON CSS
// ══════════════════════════════════════════════════
fix('Add demo banner + auth-btn-sec CSS',
  '.auth-terms a{color:#15803d;font-weight:700;text-decoration:none}',
  `.auth-terms a{color:#15803d;font-weight:700;text-decoration:none}
.auth-btn-sec{width:100%;padding:13px;background:transparent;border:1.5px solid rgba(20,32,24,.18);border-radius:14px;font-family:inherit;font-size:14px;font-weight:700;color:#142018;cursor:pointer;transition:background .15s,border-color .15s;margin-top:0}
.auth-btn-sec:active{background:rgba(20,32,24,.05)}
.auth-privacy-note{text-align:center;font-size:10.5px;color:#a0b0a5;line-height:1.6;margin-top:14px;padding-top:12px;border-top:1px solid rgba(20,32,24,.07)}
.auth-privacy-note a{color:#15803d;font-weight:600;text-decoration:none}
.demoBanner{position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9999;background:#b45309;color:#fff;font-size:12px;font-weight:700;padding:8px 16px 8px 14px;border-radius:0 0 14px 14px;display:none;align-items:center;gap:10px;box-shadow:0 4px 16px rgba(0,0,0,.18);white-space:nowrap;max-width:360px;width:calc(100% - 32px)}
.demoBanner.show{display:flex}
.demoBanner button{background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);color:#fff;font-family:inherit;font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;cursor:pointer;flex-shrink:0}`
);

// ══════════════════════════════════════════════════
// 2. DEMO BANNER HTML (before </div></div> before <script>)
// ══════════════════════════════════════════════════
fix('Add demo banner HTML',
  '\n</div></div>\n<script>',
  `
<!-- Demo mode banner -->
<div id="demoBanner" class="demoBanner">
  <span>👁 Modo Demo · Los datos son de ejemplo</span>
  <button onclick="exitDemo()">Salir</button>
</div>
</div></div>
<script>`
);

// ══════════════════════════════════════════════════
// 3. AUTH SCREEN: demo button + privacy note
// ══════════════════════════════════════════════════
fix('Add demo button and privacy note to auth screen',
  `    <div class="auth-mode-link" id="auth-mode-link" onclick="toggleAuthMode()">
      Don't have an account? <span>Create one</span>
    </div>
  </div>
</div>`,
  `    <div class="auth-mode-link" id="auth-mode-link" onclick="toggleAuthMode()">
      Don't have an account? <span>Create one</span>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin:14px 0 8px">
      <div style="flex:1;height:1px;background:rgba(20,32,24,.08)"></div>
      <span style="font-size:11px;color:#c0cfca;font-weight:600">DEMO</span>
      <div style="flex:1;height:1px;background:rgba(20,32,24,.08)"></div>
    </div>
    <button class="auth-btn-sec" onclick="enterDemo()">Ver demo sin cuenta →</button>
    <div class="auth-privacy-note">
      Al usar esta app aceptas nuestra
      <a href="/privacy.html" target="_blank" rel="noopener">Política de Privacidad</a>
      y <a href="/privacy.html#terms" target="_blank" rel="noopener">Términos de Uso</a>.
    </div>
  </div>
</div>`
);

// ══════════════════════════════════════════════════
// 4. DEMO DATA + FUNCTIONS (after MSCI_WORLD_ANNUAL)
// ══════════════════════════════════════════════════
// Find the MSCI_WORLD_ANNUAL block end and insert after
const DEMO_BLOCK = `
// ========== DEMO MODE ==========
let _isDemo = false;
const _demoLiquidity = [
  {id:'demo-liq-1',name:'Cuenta MyInvestor',type:'savings',amount:5000,currency:'EUR',rate:2.50,since:'2024-01-15'},
  {id:'demo-liq-2',name:'Fondo Monetario Pictet',type:'moneymarket',amount:3000,currency:'EUR',rate:3.40,since:'2024-04-01'},
];
const DEMO_ASSETS_RAW = [
  {isin:'IE00B4L5Y983',name:'iShares Core MSCI World UCITS ETF',shortName:'MSCI World',qty:45,bp:81.20,cp:95.40,type:'etf'},
  {isin:'IE00B3RBWM25',name:'Vanguard FTSE All-World UCITS ETF',shortName:'All-World',qty:28,bp:99.50,cp:119.80,type:'etf'},
  {isin:'IE00BYX5NK04',name:'iShares Core MSCI EM IMI UCITS ETF',shortName:'EM IMI',qty:120,bp:27.50,cp:29.20,type:'etf'},
  {isin:'IE00B4ND3602',name:'iShares Physical Gold ETC',shortName:'Gold ETC',qty:85,bp:42.10,cp:54.30,type:'etc'},
  {isin:'IE00BZ4BMM98',name:'iShares MSCI Europe Dividend ETF',shortName:'EU Dividend',qty:60,bp:21.40,cp:24.10,type:'etf'},
  {isin:'LU0084617165',name:'Fidelity Funds European Growth',shortName:'Fidelity EU',qty:200,bp:14.30,cp:16.90,type:'fund'},
  {isin:'ES0112611001',name:'Bestinver Internacional FI',shortName:'Bestinver',qty:150,bp:9.80,cp:11.20,type:'fund'},
  {isin:'IE00B579F325',name:'iShares Physical Gold CHF ETC',shortName:'Gold CHF',qty:40,bp:18.60,cp:22.40,type:'etc'},
];
function enterDemo(){
  _isDemo=true;
  window._isDemo=true;
  // Build demo assets
  assets=DEMO_ASSETS_RAW.map(p=>{
    const gain=p.qty*(p.cp-p.bp);
    return{
      isin:p.isin,name:p.name,fullName:p.name,
      shortName:p.shortName||(p.name||'').split(' ').slice(0,2).join(' '),
      quantity:p.qty,buyPrice:p.bp,currentPrice:p.cp,
      invested:p.qty*p.bp,value:p.qty*p.cp,gain,
      gainPct:((p.cp-p.bp)/p.bp)*100,
      mapping:{type:p.type||'etf',yahooSymbol:null},
      costCurrency:'EUR',history:[],hasRealHistory:false,
      _rawQty:p.qty,_rawBuyPrice:p.bp,
      coverageStatus:'MISSING',coverage:{status:'MISSING'},
      provider:null
    };
  });
  dataReady=true;
  // Enter app
  document.querySelectorAll('.cover-screen').forEach(el=>el.classList.remove('cs-active'));
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-home').classList.add('active');
  const db=document.getElementById('demoBanner');if(db)db.classList.add('show');
  // Fetch FX rates and render
  fetchGlobalFxRates().then(()=>render()).catch(()=>render());
}
function exitDemo(){
  _isDemo=false;window._isDemo=false;assets=[];dataReady=false;
  const db=document.getElementById('demoBanner');if(db)db.classList.remove('show');
  showAuthScreen();
}
`;

fix('Add demo data and functions before getLiquidity',
  'function getLiquidity(){ try{',
  DEMO_BLOCK + '\nfunction getLiquidity(){ try{'
);

// ══════════════════════════════════════════════════
// 5. getLiquidity: return demo data in demo mode
// ══════════════════════════════════════════════════
fix('getLiquidity: return demo data in demo mode',
  'function getLiquidity(){ try{const a=JSON.parse(localStorage.getItem(\'fa_liquidity\')||\'[]\');return Array.isArray(a)?a:[];}catch{return[];} }',
  'function getLiquidity(){ if(_isDemo)return _demoLiquidity; try{const a=JSON.parse(localStorage.getItem(\'fa_liquidity\')||\'[]\');return Array.isArray(a)?a:[];}catch{return[];} }'
);

// ══════════════════════════════════════════════════
// 6. enterMainApp: show demo banner if needed
// ══════════════════════════════════════════════════
fix('enterMainApp: show demo banner + skip boot in demo mode',
  `function enterMainApp() {
  // Hide all cover screens and show main app
  document.querySelectorAll('.cover-screen').forEach(el => el.classList.remove('cs-active'));
  // Activate home screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-home').classList.add('active');
  boot().catch(err => { const n = document.getElementById('chartNote'); if(n) n.textContent = 'Error: '+err.message; });
}`,
  `function enterMainApp() {
  // Hide all cover screens and show main app
  document.querySelectorAll('.cover-screen').forEach(el => el.classList.remove('cs-active'));
  // Activate home screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-home').classList.add('active');
  const _db=document.getElementById('demoBanner');if(_db)_db.classList.toggle('show',!!_isDemo);
  if(!_isDemo){
    boot().catch(err => { const n = document.getElementById('chartNote'); if(n) n.textContent = 'Error: '+err.message; });
  }
}`
);

// ══════════════════════════════════════════════════
// 7. authSubmit / signInWithGoogle: clear demo on real login
// ══════════════════════════════════════════════════
fix('authSubmit: clear demo on real login',
  'async function authSubmit(){',
  'async function authSubmit(){_isDemo=false;window._isDemo=false;const _db2=document.getElementById(\'demoBanner\');if(_db2)_db2.classList.remove(\'show\');'
);
fix('signInWithGoogle: clear demo on Google login',
  'async function signInWithGoogle(){',
  'async function signInWithGoogle(){_isDemo=false;window._isDemo=false;const _db3=document.getElementById(\'demoBanner\');if(_db3)_db3.classList.remove(\'show\');'
);

// ══════════════════════════════════════════════════
// 8. saveLiquidity: no-op in demo mode
// ══════════════════════════════════════════════════
fix('saveLiquidity: no-op in demo mode',
  'function saveLiquidity(arr){ localStorage.setItem(\'fa_liquidity\',JSON.stringify(arr)); }',
  'function saveLiquidity(arr){ if(_isDemo)return; localStorage.setItem(\'fa_liquidity\',JSON.stringify(arr)); }'
);

// ══════════════════════════════════════════════════
// 9. Privacy policy link also update in switchLang for auth screen
// ══════════════════════════════════════════════════
fix('switchLang: update demo button text',
  "const _demoBtn=document.getElementById('auth-btn-demo');if(_demoBtn)_demoBtn.style.display='none';",
  "// demo button lang update handled by fixed text"
);

console.log('\nTotal fixes: ' + n);
fs.writeFileSync('C:/Users/Pc/.openclaw/workspace/trackfolio/index.html', html, 'utf8');
console.log('Done!');
