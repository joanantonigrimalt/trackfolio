// Estampa el número de versión en los 3 sitios: desktop.html, mobile.html y sw.js
// Uso:  node bump-version.js 300
const fs = require('fs');

const v = (process.argv[2] || '').trim();
if (!/^\d+$/.test(v)) {
  console.error('Uso: node bump-version.js <numero>   (ej: node bump-version.js 300)');
  process.exit(1);
}

function repl(file, re, rep) {
  const s = fs.readFileSync(file, 'utf8');
  const n = s.replace(re, rep);
  if (n === s) { console.error('  ⚠ No se encontró el patrón de versión en ' + file + ' (revisar manualmente)'); process.exit(1); }
  fs.writeFileSync(file, n);
  console.log('  ✓ ' + file);
}

repl('desktop.html', /FA_BUILD=window\.FA_BUILD='\d+'/, "FA_BUILD=window.FA_BUILD='" + v + "'");
repl('mobile.html',  /var FA_BUILD='\d+'/,               "var FA_BUILD='" + v + "'");
repl('sw.js',        /finasset-v\d+/,                    'finasset-v' + v);

console.log('Versión actualizada a v' + v + ' en desktop.html, mobile.html y sw.js');
