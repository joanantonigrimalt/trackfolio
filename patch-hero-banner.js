const fs = require('fs');

const bannerSrc = fs.readFileSync('C:/Users/Pc/Downloads/finasset_banner.html', 'utf8');
const indexPath = 'index.html';
let index = fs.readFileSync(indexPath, 'utf8');

// ── 1. Extract banner CSS (lines 22–128) ─────────────────────────────────
const cssStart = bannerSrc.indexOf('  .banner {');
const cssEnd   = bannerSrc.indexOf('</style>');
const bannerCSS = bannerSrc.slice(cssStart, cssEnd).trim();

// ── 2. Extract first banner <div> block ──────────────────────────────────
const bannerHTMLStart = bannerSrc.indexOf('  <div class="banner">');
const bannerHTMLEnd   = bannerSrc.indexOf('  </div>\n\n  <!-- ROW 2 -->');
const bannerHTML = bannerSrc.slice(bannerHTMLStart, bannerHTMLEnd + '  </div>'.length).trim();

// ── 3. Build adapted CSS for index.html ──────────────────────────────────
// Replace fixed width:920px with responsive max-width
const adaptedCSS = bannerCSS
  .replace('width: 920px;', 'width: 100%; max-width: 920px;')
  .replace(/^  /gm, ''); // remove 2-space indent (banner file uses 2-space, index uses none)

const bannerCSSBlock = `\n/* BANNER / PHONE MOCKUPS */\n${adaptedCSS}\n`;

// ── 4. Wrap banner in hero-compatible div ────────────────────────────────
const bannerSection = `\n  <div style="position:relative;z-index:2;width:100%;margin:32px auto 0;display:flex;justify-content:center">\n  ${bannerHTML.replace(/\n/g, '\n  ')}\n  </div>`;

// ── 5. Remove old .cards-scene CSS ──────────────────────────────────────
const cardsSceneCSS = /\/\* FLOATING CARDS \*\/[\s\S]*?@media \(max-width: 760px\)[^}]+\}/;
index = index.replace(cardsSceneCSS, '/* hero visual: see BANNER section below */');

// ── 6. Add banner CSS before </style> ───────────────────────────────────
index = index.replace('</style>', bannerCSSBlock + '</style>');

// ── 7. Add DM Sans font import after existing googleapis link ────────────
if (!index.includes('DM+Sans')) {
  index = index.replace(
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans',
    '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=DM+Serif+Display&display=swap" rel="stylesheet">\n<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans'
  );
}

// ── 8. Replace cards-scene HTML with banner ──────────────────────────────
const cardsSceneHTML = /<div class="cards-scene">[\s\S]*?<\/div>\n  <\/div>\n<\/section>/;
const newHeroClose = bannerSection + '\n</section>';

if (!cardsSceneHTML.test(index)) {
  console.error('ERROR: could not find cards-scene block');
  process.exit(1);
}
index = index.replace(cardsSceneHTML, newHeroClose);

fs.writeFileSync(indexPath, index);
console.log('OK: index.html patched with banner');
