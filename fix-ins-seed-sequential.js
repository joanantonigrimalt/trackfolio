/**
 * fix-ins-seed-sequential.js
 * Changes _insSeedDiscovery to fetch stocks sequentially instead of in parallel.
 * This ensures each Vercel function has time to complete and save to Supabase
 * before the next one starts, avoiding race conditions with fire-and-forget saves.
 */
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const oldStr = `  // Fetch all popular stocks in parallel — each call saves to Supabase L2
  await Promise.allSettled(_INS_POPULAR.map(sym =>
    fetch('/api/insiders?symbol='+sym).catch(()=>{})
  ));`;

const newStr = `  // Fetch popular stocks sequentially — ensures each saves to Supabase before next
  for (const sym of _INS_POPULAR) {
    try { await fetch('/api/insiders?symbol='+sym); } catch(_) {}
  }`;

if (!html.includes(oldStr)) {
  console.error('NOT FOUND — checking existing content...');
  const idx = html.indexOf('Fetch all popular stocks in parallel');
  if (idx === -1) { console.error('parallel comment not found'); }
  else console.log('Context:', JSON.stringify(html.slice(idx - 2, idx + 150)));
  process.exit(1);
}

html = html.replace(oldStr, newStr);
fs.writeFileSync('index.html', html);
console.log('OK: seed changed to sequential.');
