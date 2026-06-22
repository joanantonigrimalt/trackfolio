const fs = require('fs');

let html = fs.readFileSync('mobile.html', 'utf8');

// ── 1. Title & meta ───────────────────────────────────────────────────────
html = html.replace(
  '<title>Finasset – Gestión de Cartera</title>',
  '<title>Finasset – Versión Web</title>'
);
html = html.replace(
  'maximum-scale=1.0, viewport-fit=cover',
  'viewport-fit=cover'
);

// ── 2. Desktop CSS overrides ──────────────────────────────────────────────
const desktopCSS = `
/* ═══════════════ DESKTOP LAYOUT ═══════════════ */
body{display:flex;height:100vh;padding:0;overflow:hidden;background:#f2f5f3;justify-content:flex-start;align-items:stretch}
.shell,.phone{all:unset;display:contents}
.notch,.status,.tab{display:none!important}
.screen{display:none;height:100%;overflow-y:auto;padding:28px 36px 48px;box-sizing:border-box}
.screen.active{display:block}
.screen::-webkit-scrollbar{width:6px}.screen::-webkit-scrollbar-track{background:transparent}.screen::-webkit-scrollbar-thumb{background:rgba(20,32,24,.15);border-radius:4px}
/* Fix overlays from absolute→fixed */
.cover-screen{position:fixed!important;z-index:200}
.liqOverlay,.alertOverlay,.authOverlay{position:fixed!important;z-index:210}
.liqSheet,.alertSheet,.authSheet{position:fixed!important;z-index:211}
/* Desktop layout */
.d-layout{display:flex;width:100%;height:100vh;overflow:hidden}
.d-sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid rgba(20,32,24,.08);display:flex;flex-direction:column;height:100vh;overflow-y:auto}
.d-logo{display:flex;align-items:center;gap:10px;padding:20px 16px 16px;border-bottom:1px solid rgba(20,32,24,.06)}
.d-logo-mark{width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#142018,#1a3f2c);display:flex;align-items:center;justify-content:center;color:#f5fbf6;font-size:16px;font-weight:800;flex-shrink:0}
.d-logo span{font-size:15px;font-weight:800;color:#142018;letter-spacing:-.02em}
.d-nav{flex:1;padding:10px 8px;display:flex;flex-direction:column;gap:1px}
.d-nav-section{font-size:9px;font-weight:800;color:#b0c0b5;letter-spacing:.1em;text-transform:uppercase;padding:12px 8px 5px}
.d-nav-item{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border-radius:10px;border:none;background:transparent;font-family:inherit;font-size:13px;font-weight:600;color:#5a6e5e;cursor:pointer;text-align:left;transition:all .15s}
.d-nav-item:hover{background:#f4f7f5;color:#142018}
.d-nav-item.active{background:#e6faf3;color:#15803d;font-weight:700}
.d-nav-ico{font-size:16px;width:22px;text-align:center;flex-shrink:0}
.d-nav-badge{background:#15803d;color:#fff;font-size:10px;font-weight:800;padding:2px 6px;border-radius:10px;margin-left:auto}
.d-sidebar-footer{padding:12px 10px;border-top:1px solid rgba(20,32,24,.06);flex-shrink:0}
.d-user-info{display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px;border-radius:10px;transition:background .15s}
.d-user-info:hover{background:#f4f7f5}
.d-user-av{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#142018,#1a3f2c);color:#f5fbf6;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.d-user-name{font-size:13px;font-weight:700;color:#142018;line-height:1.2}
.d-user-plan{font-size:11px;color:#15803d;font-weight:600}
.d-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.d-topbar{height:56px;background:#fff;border-bottom:1px solid rgba(20,32,24,.08);display:flex;align-items:center;padding:0 24px;gap:14px;flex-shrink:0}
.d-topbar-title{font-size:15px;font-weight:800;color:#142018;letter-spacing:-.02em}
.d-topbar-sep{width:1px;height:18px;background:rgba(20,32,24,.1)}
.d-topbar-sub{font-size:13px;color:#8fa090;font-weight:500;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.d-topbar-right{margin-left:auto;display:flex;align-items:center;gap:8px;flex-shrink:0}
.d-badge-ok{background:#e6faf3;color:#15803d;border:1px solid rgba(21,128,61,.2);font-size:11px;font-weight:700;padding:5px 10px;border-radius:20px;display:flex;align-items:center;gap:6px;white-space:nowrap}
.d-badge-ok::before{content:'●';font-size:7px}
.d-search-btn{display:flex;align-items:center;gap:7px;padding:7px 14px;border:1px solid rgba(20,32,24,.12);border-radius:10px;background:#f4f7f5;font:inherit;font-size:13px;font-weight:600;color:#8fa090;cursor:pointer;transition:all .15s;white-space:nowrap}
.d-search-btn:hover{border-color:#15803d;color:#15803d}
.d-new-pos-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;background:#15803d;color:#fff;font:inherit;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:background .15s;white-space:nowrap}
.d-new-pos-btn:hover{background:#127034}
.d-content{flex:1;overflow:hidden;display:flex;flex-direction:column}
`;

html = html.replace('</style>', desktopCSS + '</style>');

// ── 3. Replace phone shell open with desktop layout ───────────────────────
const sidebarHTML = `<div class="d-layout">
<aside class="d-sidebar">
  <div class="d-logo">
    <div class="d-logo-mark">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
    </div>
    <span>Finasset</span>
  </div>
  <nav class="d-nav">
    <div class="d-nav-section">PRINCIPAL</div>
    <button class="d-nav-item active" data-screen="home"><span class="d-nav-ico">⌂</span>Inicio</button>
    <button class="d-nav-item" data-screen="portfolio"><span class="d-nav-ico">≡</span>Cartera</button>
    <button class="d-nav-item" data-screen="analysis"><span class="d-nav-ico">◈</span>Análisis</button>
    <button class="d-nav-item" data-screen="dividends"><span class="d-nav-ico">◎</span>Dividendos</button>
    <div class="d-nav-section">HERRAMIENTAS</div>
    <button class="d-nav-item" data-screen="ia"><span class="d-nav-ico">✦</span>IA — Vera</button>
    <button class="d-nav-item" data-screen="impuestos"><span class="d-nav-ico">◫</span>Fiscal</button>
    <button class="d-nav-item" data-screen="topinvestors"><span class="d-nav-ico">◆</span>Insiders</button>
    <button class="d-nav-item" data-screen="alerts"><span class="d-nav-ico">◉</span>Alertas <span class="d-nav-badge" id="deskAlertBadge" style="display:none"></span></button>
  </nav>
  <div class="d-sidebar-footer">
    <div class="d-user-info" onclick="document.getElementById('btnSettings').click()">
      <div class="d-user-av" id="deskUserAv">JM</div>
      <div>
        <div class="d-user-name" id="deskUserName">—</div>
        <div class="d-user-plan" id="deskUserPlan">Plan Free</div>
      </div>
    </div>
  </div>
</aside>
<div class="d-main">
  <div class="d-topbar">
    <span class="d-topbar-title" id="dTopbarTitle">Dashboard</span>
    <span class="d-topbar-sep"></span>
    <span class="d-topbar-sub" id="dTopbarSub">—</span>
    <div class="d-topbar-right">
      <div class="d-badge-ok" id="dBadgeOk" style="display:none"></div>
      <button class="d-search-btn" onclick="openSearchModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Buscar activo
      </button>
      <button class="d-new-pos-btn" onclick="openAddModal()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nueva posición
      </button>
    </div>
  </div>
  <div class="d-content">`;

html = html.replace('<div class="shell"><div class="phone">', sidebarHTML);

// ── 4. Remove notch and status bar (handle CRLF) ─────────────────────────
html = html.replace(/<div class="notch"><\/div>\r?\n/, '');
html = html.replace(
  /<div class="status">[\s\S]*?<\/div>\r?\n/,
  '<button id="btnSettings" style="display:none"></button>\n'
);

// ── 5. Fix closing </div></div> before <script> (handle CRLF) ────────────
html = html.replace(
  /(<\/div><\/div>)\r?\n<script>/,
  '$1</div></div>\r\n<script>'
);

// ── 6. Desktop JS patches ─────────────────────────────────────────────────
const desktopJS = `
// ── Desktop sidebar navigation ──────────────────────────────────────────
(function(){
  const SCREEN_META = {
    home:      { title:'Dashboard' },
    portfolio: { title:'Cartera' },
    analysis:  { title:'Análisis' },
    dividends: { title:'Dividendos' },
    ia:        { title:'IA — Vera' },
    impuestos: { title:'Fiscal' },
    topinvestors:{ title:'Insiders' },
    alerts:    { title:'Alertas' },
    asset:     { title:'Detalle de activo' },
    privacy:   { title:'Privacidad' },
    terms:     { title:'Términos' },
  };

  // Wire sidebar buttons
  document.querySelectorAll('.d-nav-item[data-screen]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.screen));
  });

  // Patch showScreen to sync sidebar + topbar
  const _orig = showScreen;
  window.showScreen = function(name, keepTab=false) {
    _orig(name, keepTab);
    document.querySelectorAll('.d-nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.screen === name);
    });
    const meta = SCREEN_META[name] || {};
    const titleEl = document.getElementById('dTopbarTitle');
    if (titleEl && meta.title) titleEl.textContent = meta.title;
    // Update subtitle from homeSub if home
    const subEl = document.getElementById('dTopbarSub');
    if (subEl) {
      if (name === 'home') subEl.textContent = t('homeSub');
      else subEl.textContent = '';
    }
  };

  // Sync user info in sidebar from supabase session
  function syncDeskUser(session) {
    if (!session) return;
    const email = session.user?.email || '';
    const meta  = session.user?.user_metadata || {};
    const name  = meta.full_name || meta.name || email.split('@')[0] || '—';
    const av    = name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
    const nameEl = document.getElementById('deskUserName');
    const avEl   = document.getElementById('deskUserAv');
    if (nameEl) nameEl.textContent = name;
    if (avEl)   avEl.textContent   = av;
  }

  // Try to hook into supabase session after boot
  setTimeout(() => {
    try {
      _supabase.auth.getSession().then(({data}) => {
        if (data?.session) syncDeskUser(data.session);
      });
      _supabase.auth.onAuthStateChange((_, session) => syncDeskUser(session));
    } catch(e) {}
  }, 1500);

  // Update topbar subtitle from homeSub i18n after boot
  setTimeout(() => {
    const subEl = document.getElementById('dTopbarSub');
    if (subEl && !subEl.textContent) subEl.textContent = t('homeSub');
    // Badge for active assets
    setTimeout(() => {
      const total = window.assets ? window.assets.filter(a=>a.currentPrice>0).length : 0;
      const all   = window.assets ? window.assets.length : 0;
      const badge = document.getElementById('dBadgeOk');
      if (badge && all > 0) {
        badge.textContent = total + '/' + all + ' activos OK';
        badge.style.display = 'flex';
      }
    }, 3000);
  }, 2000);
})();
`;

html = html.replace(/\r?\n<\/script>\r?\n<\/body>/, '\n' + desktopJS + '\n</script>\n</body>');

fs.writeFileSync('desktop.html', html);
console.log('OK: desktop.html created (' + Math.round(html.length/1024) + 'KB)');
