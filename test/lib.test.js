// Tests de utilidades de servidor (caché KV y conversión FX). Ejecuta: npm test
const test = require('node:test');
const assert = require('node:assert');
const cache = require('../lib/cache.js');
const { toEur } = require('../lib/fx.js');

test('cache KV: set/get devuelve el valor almacenado', () => {
  cache.setCache('k1', { a: 1 }, 60);
  assert.deepStrictEqual(cache.getCache('k1'), { a: 1 });
});

test('cache KV: una clave inexistente devuelve null', () => {
  assert.strictEqual(cache.getCache('no-existe'), null);
});

test('cache KV: expira con TTL negativo (ya caducado)', () => {
  cache.setCache('k2', 'v', -1);
  assert.strictEqual(cache.getCache('k2'), null);
});

test('cache KV: invalidateCache elimina la clave', () => {
  cache.setCache('k3', 'v', 60);
  cache.invalidateCache('k3');
  assert.strictEqual(cache.getCache('k3'), null);
});

test('fx.toEur: EUR pasa sin cambios y no negativos', async () => {
  assert.strictEqual(await toEur(100, 'EUR'), 100);
  assert.strictEqual(await toEur(0, 'USD'), 0);
  assert.strictEqual(await toEur(-5, 'USD'), 0);
});

test('fx.toEur: GBP/GBp usan la tasa proporcionada (sin red)', async () => {
  assert.strictEqual(await toEur(100, 'GBP', 1.18), 118);
  // GBp (peniques): /100 → GBP → EUR
  assert.ok(Math.abs((await toEur(100, 'GBp', 1.18)) - 1.18) < 1e-9);
});

test('fx.toEur: divisa desconocida se devuelve tal cual', async () => {
  assert.strictEqual(await toEur(42, 'XYZ'), 42);
});
