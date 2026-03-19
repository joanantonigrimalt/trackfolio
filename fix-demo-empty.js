/**
 * fix-demo-empty.js — handles CRLF line endings
 */
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Empty DEMO_ASSETS_RAW — find by unique start/end markers
const demoStart = html.indexOf('const DEMO_ASSETS_RAW = [');
if (demoStart === -1) { console.error('DEMO_ASSETS_RAW start not found'); process.exit(1); }
const demoEnd = html.indexOf('];', demoStart) + 2; // find the closing ];
const oldDemo = html.slice(demoStart, demoEnd);
console.log('Demo array found, length:', oldDemo.length, 'chars');
html = html.slice(0, demoStart) + 'const DEMO_ASSETS_RAW = [];' + html.slice(demoEnd);
console.log('OK: DEMO_ASSETS_RAW emptied');

// 2. Replace enterDemo asset body — find by unique lines
const assetsBuildStart = html.indexOf('  // Build demo assets');
if (assetsBuildStart === -1) { console.error('Build demo assets comment not found'); process.exit(1); }

// Find 'dataReady=true;' that follows this block
const dataReadyIdx = html.indexOf('dataReady=true;', assetsBuildStart);
if (dataReadyIdx === -1) { console.error('dataReady=true not found after demo build'); process.exit(1); }
const dataReadyEnd = dataReadyIdx + 'dataReady=true;'.length;

const oldBody = html.slice(assetsBuildStart, dataReadyEnd);
console.log('Demo body found:', JSON.stringify(oldBody.slice(0, 60)));

const newBody = '  // Demo starts empty — user adds their own assets (saved in localStorage)\n  _rawSeedAssets = [];\n  loadCustomIntoAssets();\n  dataReady=true;';
html = html.slice(0, assetsBuildStart) + newBody + html.slice(dataReadyEnd);
console.log('OK: enterDemo body replaced');

fs.writeFileSync('index.html', html);
console.log('\nAll fixes applied.');
