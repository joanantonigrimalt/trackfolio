// Fix CP1252 mojibake in index.html — smart approach:
// Detects multi-byte UTF-8 sequences that were misread as CP1252/Latin-1
// and re-assembles them, leaving already-correct characters untouched.
const fs = require('fs');

// CP1252 special chars: Unicode codepoint (key) → original byte value (value)
const CP1252_REV = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C],
  [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93],
  [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F],
]);

// Get the original byte that a char represents in a mojibake sequence.
// Latin-1: U+0000-U+00FF → byte = codepoint directly.
// CP1252 specials: known Unicode chars above U+00FF → their byte value.
function origByte(cp) {
  if (cp === undefined || cp < 0) return -1;
  if (cp <= 0xFF) return cp;          // Latin-1 direct (covers C1 controls too)
  return CP1252_REV.get(cp) ?? -1;   // CP1252 special chars
}

// Detect and fix mojibake sequences in-place.
// A mojibake occurs when a multi-byte UTF-8 sequence was read byte-by-byte as
// Latin-1/CP1252 and each byte became a separate Unicode character.
// We detect this by checking if adjacent chars (as original bytes) form a valid
// multi-byte UTF-8 sequence.
function fixMojibake(str) {
  let out = '';
  let i = 0;

  while (i < str.length) {
    const c1 = str.codePointAt(i);
    const b1 = origByte(c1);

    // ── 4-byte UTF-8 sequence (b1 in 0xF0-0xF7) ──────────────────────────
    if (b1 >= 0xF0 && b1 <= 0xF7 && i + 3 < str.length) {
      const b2 = origByte(str.codePointAt(i + 1));
      const b3 = origByte(str.codePointAt(i + 2));
      const b4 = origByte(str.codePointAt(i + 3));
      if (b2 >= 0x80 && b2 <= 0xBF && b3 >= 0x80 && b3 <= 0xBF && b4 >= 0x80 && b4 <= 0xBF) {
        const decoded = Buffer.from([b1, b2, b3, b4]).toString('utf8');
        if (!decoded.includes('\uFFFD')) {
          out += decoded;
          i += 4;
          continue;
        }
      }
    }

    // ── 3-byte UTF-8 sequence (b1 in 0xE0-0xEF) ──────────────────────────
    if (b1 >= 0xE0 && b1 <= 0xEF && i + 2 < str.length) {
      const b2 = origByte(str.codePointAt(i + 1));
      const b3 = origByte(str.codePointAt(i + 2));
      if (b2 >= 0x80 && b2 <= 0xBF && b3 >= 0x80 && b3 <= 0xBF) {
        const decoded = Buffer.from([b1, b2, b3]).toString('utf8');
        if (!decoded.includes('\uFFFD')) {
          out += decoded;
          i += 3;
          continue;
        }
      }
    }

    // ── 2-byte UTF-8 sequence (b1 in 0xC2-0xDF) ──────────────────────────
    // Note: 0xC0 and 0xC1 would be overlong encodings — skip them intentionally
    if (b1 >= 0xC2 && b1 <= 0xDF && i + 1 < str.length) {
      const b2 = origByte(str.codePointAt(i + 1));
      if (b2 >= 0x80 && b2 <= 0xBF) {
        const decoded = Buffer.from([b1, b2]).toString('utf8');
        if (!decoded.includes('\uFFFD')) {
          out += decoded;
          i += 2;
          continue;
        }
      }
    }

    // Not a mojibake sequence — keep as-is
    out += String.fromCodePoint(c1);
    i += c1 > 0xFFFF ? 2 : 1;
  }
  return out;
}

// ── Apply to the original backup ───────────────────────────────────────────
const backup  = 'C:/Users/Pc/.openclaw/workspace/trackfolio/index.html.bak';
const outFile = 'C:/Users/Pc/.openclaw/workspace/trackfolio/index.html';

let content = fs.readFileSync(backup, 'utf8');
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1); // strip BOM

const fixed = fixMojibake(content);

// ── Sanity checks ─────────────────────────────────────────────────────────
const checks = {
  'No U+FFFD':          !fixed.includes('\uFFFD'),
  'Evolución':           fixed.includes('Evolución'),
  'Análisis':            fixed.includes('Análisis'),
  'Español':             fixed.includes('Español'),
  'Tamaño':              fixed.includes('Tamaño'),
  'Distribución':        fixed.includes('Distribución'),
  'Índice':              fixed.includes('Índice'),
  'Réplica':             fixed.includes('Réplica'),
  'Euro €':              fixed.includes('€'),
  'House icon ⌂':        fixed.includes('⌂'),
  'Search icon 🔍':      fixed.includes('🔍'),
  'Flag ES 🇪🇸':         fixed.includes('🇪🇸'),
  'Flag GB 🇬🇧':         fixed.includes('🇬🇧'),
};

let allOk = true;
for (const [label, ok] of Object.entries(checks)) {
  console.log((ok ? '✓' : '✗'), label);
  if (!ok) allOk = false;
}

if (!allOk) {
  console.error('\nSanity checks failed — NOT writing file');
  process.exit(1);
}

// Apply the €0 → — placeholder cleanups from before
const result = fixed
  .replace(/<div class="valueLarge" id="total">€0<\/div>/, '<div class="valueLarge" id="total">—</div>')
  .replace(/<div class="pill pos" id="totalGainPill">\+€0 · 0%<\/div>/, '<div class="pill pos" id="totalGainPill">—</div>')
  .replace(/<div class="n" id="investedTotal">€0<\/div>/, '<div class="n" id="investedTotal">—</div>')
  .replace(/<div class="n" id="profitPercent">0%<\/div>/, '<div class="n" id="profitPercent">—</div>')
  .replace(/<div class="n" id="count">0<\/div>/, '<div class="n" id="count">—</div>')
  .replace(/<div class="chartValue" id="chartRangeValue">€0<\/div>/, '<div class="chartValue" id="chartRangeValue">—</div>')
  .replace(/<div class="value" id="summaryInvested">€0<\/div>/, '<div class="value" id="summaryInvested">—</div>')
  .replace(/<div class="value" id="summaryGainPct">0%<\/div>/, '<div class="value" id="summaryGainPct">—</div>')
  .replace(/<div class="adPrice" id="adPrice">€0<\/div>/, '<div class="adPrice" id="adPrice">—</div>')
  .replace(/<div class="adGainBadge" id="adGainBadge">\+0%<\/div>/, '<div class="adGainBadge" id="adGainBadge">—</div>');

fs.writeFileSync(outFile, result, 'utf8');
console.log('\nWritten to', outFile);
