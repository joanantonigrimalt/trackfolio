// Tests del parser del catálogo MyInvestor. Ejecuta: npm test
const test = require('node:test');
const assert = require('node:assert');
const { parseCSV, parsePct, parseTer, normHeader } = require('../lib/myinvestor-catalog.js')._test;

test('parsePct: normaliza comas, porcentajes y guiones', () => {
  assert.strictEqual(parsePct('12,5%'), 12.5);
  assert.strictEqual(parsePct(' 3.14 '), 3.14);
  assert.strictEqual(parsePct('-'), null);
  assert.strictEqual(parsePct(''), null);
  assert.strictEqual(parsePct(null), null);
});

test('parseTer: quita "p.a." y % y redondea a 4 decimales', () => {
  assert.strictEqual(parseTer('0,20% p.a.'), 0.2);
  assert.strictEqual(parseTer('0.0725'), 0.0725);
  assert.strictEqual(parseTer('-'), null);
});

test('normHeader: minúsculas, sin acentos, espacios colapsados', () => {
  assert.strictEqual(normHeader('  1  Año  % '), '1 ano %');
  assert.strictEqual(normHeader('Distribución'), 'distribucion');
});

test('parseCSV: resuelve columnas por NOMBRE de cabecera (orden estándar)', () => {
  const csv = [
    'ID,Nombre,ISIN,Ticker,Divisa,Pais,Mercado Cod,Mercado,Precio,Fecha Precio,1 mes %,3 meses %,6 meses %,YTD %,1 anio %,3 anios %,5 anios %,Tipo,TER anual,Distribucion',
    '1,iShares Core MSCI World,IE00B4L5Y983,SWDA,USD,IE,XY,LSE,100,2024,1,2,3,4,"18,50",30,60,ETF,"0,20%",Acumulacion',
  ].join('\n');
  const p = parseCSV(csv);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].isin, 'IE00B4L5Y983');
  assert.strictEqual(p[0].nombre, 'iShares Core MSCI World');
  assert.strictEqual(p[0].divisa, 'USD');
  assert.strictEqual(p[0].tipo, 'ETF');
  assert.strictEqual(p[0].rent1a, 18.5);
  assert.strictEqual(p[0].ter, 0.2);
});

test('parseCSV: sigue correcto aunque se REORDENEN las columnas (regresión #15)', () => {
  // ISIN y Nombre movidos al final; 1 anio % antes que Divisa.
  const csv = [
    'ID,1 anio %,Divisa,Tipo,TER anual,Nombre,ISIN',
    '1,"7,25",EUR,Fondo,"0,15%",Amundi MSCI World,LU1681043599',
  ].join('\n');
  const p = parseCSV(csv);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].isin, 'LU1681043599');
  assert.strictEqual(p[0].nombre, 'Amundi MSCI World');
  assert.strictEqual(p[0].divisa, 'EUR');
  assert.strictEqual(p[0].tipo, 'Fondo');
  assert.strictEqual(p[0].rent1a, 7.25);
  assert.strictEqual(p[0].ter, 0.15);
});

test('parseCSV: descarta ISIN inválidos y deduplica', () => {
  const csv = [
    'Nombre,ISIN',
    'Malo,XX',                    // ISIN demasiado corto → descartado
    'Bueno,IE00B4L5Y983',
    'Duplicado,IE00B4L5Y983',     // repetido → deduplicado
  ].join('\n');
  const p = parseCSV(csv);
  assert.strictEqual(p.length, 1);
  assert.strictEqual(p[0].nombre, 'Bueno');
});
