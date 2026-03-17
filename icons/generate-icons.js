#!/usr/bin/env node
// Script to generate PNG icons from SVG using sharp (if available)
// Run: node icons/generate-icons.js
// Requires: npm install sharp (optional, local dev only)
//
// If sharp is not available, the SVG files themselves work for many PWA validators.
// For production stores, use https://www.pwabuilder.com/imageGenerator to generate all sizes.

const fs = require('fs');
const path = require('path');

const SVG_SOURCE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="115" fill="#142018"/>
  <!-- F letter mark -->
  <text x="256" y="340" font-family="system-ui, -apple-system, sans-serif"
    font-size="280" font-weight="900" fill="#f5fbf6"
    text-anchor="middle" dominant-baseline="auto">F</text>
  <!-- Green accent dot -->
  <circle cx="340" cy="180" r="40" fill="#22c55e"/>
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
