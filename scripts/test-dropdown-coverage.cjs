const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../src');
const failures = [];
let controls = 0;
function inspect(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) inspect(file);
    else if (file.endsWith('.tsx')) {
      const source = fs.readFileSync(file, 'utf8');
      if (!file.endsWith('/app-dropdown.tsx') && /<select\b/.test(source)) failures.push(`${file}: native select bypasses shared dropdown`);
      if (/data-dropdown-native/.test(source)) failures.push(`${file}: obsolete dropdown opt-out`);
      controls += (source.match(/<AppSelect\b/g) || []).length;
    }
  }
}
inspect(root);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
if (controls < 40) throw Error('Unexpected loss of shared dropdown coverage');
console.log(`PASS: ${controls} shared dropdowns; no native-select or opt-out bypasses.`);
