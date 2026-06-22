const fs = require('fs');
const banner = fs.readFileSync('C:/Users/Pc/Downloads/finasset_banner.html', 'utf8');
let index = fs.readFileSync('index.html', 'utf8');

// Extract ROW 2 banner div
const row2Marker = '  <!-- ROW 2 -->\n  <div class="banner">';
const row2Start = banner.indexOf(row2Marker) + '  <!-- ROW 2 -->\n'.length;
const row2End = banner.indexOf('</body>');
const row2HTML = banner.slice(row2Start, row2End).trim();

// Insert second banner before </section> (after the first banner wrapper </div>)
const needle = '</div>\n</section>';
const replacement =
  '</div>\n' +
  '  <div style="position:relative;z-index:2;width:100%;margin:16px auto 0;display:flex;justify-content:center">\n' +
  '  ' + row2HTML.split('\n').join('\n  ') + '\n' +
  '  </div>\n' +
  '</section>';

if (!index.includes(needle)) {
  console.error('ERROR: insertion point not found');
  process.exit(1);
}

index = index.replace(needle, replacement);
fs.writeFileSync('index.html', index);
console.log('OK: second banner row added');
