const fs = require('fs');
const path = require('path');

// ── 1. Extract the 3 base64 images from index.html and save as files ─────
const indexHtml = fs.readFileSync('index.html', 'utf8');
const imgRe = /<img src="(data:image\/[^;]+;base64,[^"]+)"/g;
let match, imgs = [];
while ((match = imgRe.exec(indexHtml)) !== null && imgs.length < 3) {
  imgs.push(match[1]);
}

if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');

imgs.forEach((dataUri, i) => {
  const ext = dataUri.startsWith('data:image/png') ? 'png' : 'jpg';
  const b64 = dataUri.split(',')[1];
  fs.writeFileSync(`screenshots/app-screen-${i+1}.${ext}`, Buffer.from(b64, 'base64'));
  console.log(`Saved screenshots/app-screen-${i+1}.${ext}`);
});

// Detect actual extensions
const exts = imgs.map(d => d.startsWith('data:image/png') ? 'png' : 'jpg');

// ── 2. Build lightweight banner CSS ──────────────────────────────────────
const bannerCSS = `
<style>
.seo-banner-section{padding:48px 20px 20px;display:flex;flex-direction:column;align-items:center;gap:10px;background:var(--bg,#f7faf8)}
.seo-banner-eyebrow{font-size:.7rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#17a864;margin-bottom:4px;text-align:center}
.seo-banner-title{font-size:1.25rem;font-weight:800;color:#111c16;letter-spacing:-.03em;text-align:center;margin-bottom:16px}
.seo-phones{display:flex;align-items:flex-end;justify-content:center;gap:16px;width:100%;max-width:760px}
.seo-phone-wrap{display:flex;flex-direction:column;align-items:center;gap:10px;position:relative;z-index:1;transition:z-index 0s}
.seo-phone-wrap:hover{z-index:5}
.seo-phone-label{font-size:.72rem;font-weight:700;color:#1a3d2b;text-align:center;line-height:1.3;letter-spacing:-.01em}
.seo-card-phone{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.13);flex-shrink:0;transition:transform .35s ease,box-shadow .35s ease}
.seo-card-phone img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
.seo-phone-wrap.seo-left .seo-card-phone{width:148px;height:278px;transform:rotate(-3deg) translateY(8px)}
.seo-phone-wrap.seo-left:hover .seo-card-phone{transform:rotate(-1deg) translateY(0) scale(1.03);box-shadow:0 20px 50px rgba(0,0,0,.2)}
.seo-phone-wrap.seo-center .seo-card-phone{width:172px;height:314px;box-shadow:0 16px 50px rgba(0,0,0,.18)}
.seo-phone-wrap.seo-center:hover .seo-card-phone{transform:translateY(-6px) scale(1.02);box-shadow:0 24px 60px rgba(0,0,0,.22)}
.seo-phone-wrap.seo-right .seo-card-phone{width:148px;height:278px;transform:rotate(3deg) translateY(8px)}
.seo-phone-wrap.seo-right:hover .seo-card-phone{transform:rotate(1deg) translateY(0) scale(1.03);box-shadow:0 20px 50px rgba(0,0,0,.2)}
.seo-banner-cta{display:inline-flex;align-items:center;gap:8px;margin-top:20px;padding:13px 24px;background:#22c47a;color:#fff;border-radius:12px;font-size:.88rem;font-weight:700;text-decoration:none;transition:all .2s}
.seo-banner-cta:hover{background:#17a864;transform:translateY(-2px)}
@media(max-width:520px){.seo-phone-wrap.seo-left .seo-card-phone{width:110px;height:208px}.seo-phone-wrap.seo-center .seo-card-phone{width:130px;height:238px}.seo-phone-wrap.seo-right .seo-card-phone{width:110px;height:208px}.seo-phones{gap:10px}}
</style>`;

// ── 3. Build banner HTML ──────────────────────────────────────────────────
function buildBannerHTML() {
  return `
<section class="seo-banner-section">
  <div class="seo-banner-eyebrow">Así funciona la app</div>
  <div class="seo-banner-title">Todo tu portfolio, siempre contigo</div>
  <div class="seo-phones">
    <div class="seo-phone-wrap seo-left">
      <div class="seo-phone-label">IA a tu<br>Cartera</div>
      <div class="seo-card-phone"><img src="/screenshots/app-screen-1.${exts[0]}" alt="Análisis IA Finasset" loading="lazy" width="148" height="278"></div>
    </div>
    <div class="seo-phone-wrap seo-center">
      <div class="seo-phone-label">Análisis<br>detallado</div>
      <div class="seo-card-phone"><img src="/screenshots/app-screen-2.${exts[1]}" alt="Análisis cartera Finasset" loading="lazy" width="172" height="314"></div>
    </div>
    <div class="seo-phone-wrap seo-right">
      <div class="seo-phone-label">Análisis<br>Impuestos</div>
      <div class="seo-card-phone"><img src="/screenshots/app-screen-3.${exts[2]}" alt="Impuestos Finasset" loading="lazy" width="148" height="278"></div>
    </div>
  </div>
  <a class="seo-banner-cta" href="/desktop">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    Probar gratis — Abrir Web
  </a>
</section>`;
}

// ── 4. SEO pages to update ────────────────────────────────────────────────
const SEO_PAGES = [
  'tracker-dividendos.html','app-dividendos.html','como-controlar-dividendos.html',
  'calendario-dividendos-cartera.html','seguimiento-ingresos-pasivos.html',
  'control-dividendos-acciones.html','como-llevar-mis-dividendos.html',
  'mejor-app-para-dividendos.html','excel-dividendos-vs-app.html',
  'gestor-cartera-etf.html','como-controlar-una-cartera-de-etfs.html',
  'mejor-app-para-etfs.html','gestor-cartera-inversion.html',
  'app-seguimiento-cartera.html','seguimiento-portfolio.html',
  'software-seguimiento-inversiones.html','como-hacer-seguimiento-de-mi-cartera.html',
  'controlar-cartera-de-inversion.html','herramienta-para-seguir-mi-cartera.html',
  'seguimiento-de-inversiones-para-particulares.html',
  'seguimiento-cartera-acciones-etfs.html','control-cartera-etf-y-acciones.html',
  'alternativa-portfolio-performance.html','alternativas-a-portfolio-performance.html',
  'portfolio-performance-espanol.html',
];

// ── 5. Inject into each SEO page ─────────────────────────────────────────
const bannerHTML = buildBannerHTML();
let updated = 0, skipped = 0;

SEO_PAGES.forEach(file => {
  if (!fs.existsSync(file)) { console.log(`SKIP (not found): ${file}`); skipped++; return; }

  let html = fs.readFileSync(file, 'utf8');

  // Skip if already injected
  if (html.includes('seo-banner-section')) { console.log(`SKIP (already has banner): ${file}`); skipped++; return; }

  // Add CSS before </head>
  html = html.replace('</head>', bannerCSS + '\n</head>');

  // Insert banner before <footer or before </main> or before the internal-links section
  // Try to insert before the internal-links section (most SEO pages have this)
  if (html.includes('<div class="internal-links">')) {
    html = html.replace('<div class="internal-links">', bannerHTML + '\n<div class="internal-links">');
  } else if (html.includes('<footer')) {
    html = html.replace('<footer', bannerHTML + '\n<footer');
  } else {
    html = html.replace('</main>', bannerHTML + '\n</main>');
  }

  fs.writeFileSync(file, html);
  console.log(`OK: ${file}`);
  updated++;
});

console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
