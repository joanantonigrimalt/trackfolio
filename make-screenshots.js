// Genera 4 screenshots de la app (modo demo) para la Play Store.
// Uso: node make-screenshots.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'screenshots');
const URL = 'https://www.finasset.app/mobile';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 400, height: 800 },
    deviceScaleFactor: 3,          // → 1200 x 2400 px (ratio 2:1, válido Play Store)
    isMobile: true, hasTouch: true,
    locale: 'es-ES',
  });
  const page = await ctx.newPage();
  console.log('Cargando', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(2500);

  // Entrar en modo demo (cartera de ejemplo, sin login)
  await page.evaluate(() => { try { enterDemo(); } catch (e) { console.log('enterDemo err', e.message); } });
  console.log('Modo demo iniciado, esperando a que carguen los precios…');
  await sleep(12000); // esperar coverage (precios reales + histórico)
  // El modo demo no marca _pricesLive; lo forzamos para que se muestre el valor total
  const forced = await page.evaluate(() => {
    try { _pricesLive = true; } catch (e) { return 'no-lex:' + e.message; }
    try { render(); } catch (e) {}
    return (document.body.innerText || '').includes('Actualizando') ? 'sigue-actualizando' : 'ok';
  });
  console.log('  _pricesLive forzado →', forced);
  await sleep(2500);

  // Ocultar el banner "Modo Demo" para capturas limpias
  await page.evaluate(() => { const b = document.getElementById('demoBanner'); if (b) b.style.display = 'none'; });

  async function shot(name) {
    await sleep(1800);
    await page.screenshot({ path: path.join(OUT, name), fullPage: false });
    console.log('  ✓', name);
  }

  // 1) Inicio (valor total + gráfico + posiciones)
  await page.evaluate(() => { try { showScreen('home'); } catch (e) {} window.scrollTo(0, 0); });
  await shot('1-inicio.png');

  // 2) Análisis
  await page.evaluate(() => { try { showScreen('analysis'); } catch (e) {} window.scrollTo(0, 0); });
  await sleep(2500);
  await shot('2-analisis.png');

  // 3) Impuestos (Fiscal) — resumen fiscal con las plusvalías/minusvalías
  await page.evaluate(() => { try { showScreen('impuestos'); } catch (e) {} try { if (typeof renderImpuestos==='function') renderImpuestos(); } catch (e) {} window.scrollTo(0, 0); });
  await sleep(4000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('3-fiscal.png');

  // 4) Detalle de un activo (con gráfico + ficha)
  await page.evaluate(() => {
    try {
      showScreen('home');
      // click en la primera posición para abrir su detalle
      const row = document.querySelector('#list [onclick*="showAssetDetail"], #list [data-isin], #list > div');
      if (row) row.click();
    } catch (e) {}
    window.scrollTo(0, 0);
  });
  await sleep(3500);
  await shot('4-detalle-activo.png');

  await browser.close();
  console.log('\nListo → carpeta screenshots/');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
