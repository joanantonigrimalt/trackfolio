#!/usr/bin/env node
// Script to generate PNG icons from SVG using sharp (if available)
// Run: node icons/generate-icons.js
// Requires: npm install sharp (optional, local dev only)
//
// If sharp is not available, the SVG files themselves work for many PWA validators.
// For production stores, use https://www.pwabuilder.com/imageGenerator to generate all sizes.

const fs = require('fs');
const path = require('path');

// Logo de finasset.app: cuadrado verde oscuro + gráfico de línea ascendente (trending-up) en verde
const SVG_SOURCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="115" fill="#142018"/>
  <g fill="none" stroke="#4ade80" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(100,100) scale(13)">
    <polyline points="2 17 8.5 10.5 13.5 15.5 22 7"/>
    <polyline points="16 7 22 7 22 13"/>
  </g>
</svg>`;

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = path.join(__dirname);

// Write SVG source
fs.writeFileSync(path.join(outDir, 'icon.svg'), SVG_SOURCE);
console.log('✓ Written icon.svg');

// Try to use sharp for PNG conversion
try {
  const sharp = require('sharp');
  Promise.all(
    SIZES.map(size =>
      sharp(Buffer.from(SVG_SOURCE))
        .resize(size, size)
        .png()
        .toFile(path.join(outDir, `icon-${size}.png`))
        .then(() => console.log(`✓ icon-${size}.png`))
    )
  ).then(() => {
    console.log('\nAll icons generated successfully!');
    console.log('Upload to /icons/ folder in your project.');
  }).catch(err => {
    console.error('Error generating PNGs:', err.message);
    printManualInstructions();
  });
} catch (_) {
  console.log('\nsharp not installed. Generating SVG only.');
  printManualInstructions();
}

function printManualInstructions() {
  console.log(`
Manual icon generation steps:
1. Go to https://www.pwabuilder.com/imageGenerator
2. Upload the icon.svg file from this folder
3. Download the generated icon pack
4. Extract all PNG files to the /icons/ folder in the project
5. Alternatively run: npm install sharp && node icons/generate-icons.js
`);
}
