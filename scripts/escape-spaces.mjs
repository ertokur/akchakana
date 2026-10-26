// Заменяет неразрывные пробелы в исходниках на escape-последовательности (их не видно в редакторе).
import fs from 'node:fs';
import path from 'node:path';

const NBSP = String.fromCharCode(0xa0);
const NNBSP = String.fromCharCode(0x202f);
const BS = String.fromCharCode(0x5c);
const map = { [NBSP]: BS + 'u00a0', [NNBSP]: BS + 'u202f' };
const pattern = new RegExp(`[${NBSP}${NNBSP}]`, 'g');

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(p)) {
      const s = fs.readFileSync(p, 'utf8');
      const out = s.replace(pattern, (c) => map[c]);
      if (out !== s) {
        fs.writeFileSync(p, out);
        console.log('fixed', p);
      }
    }
  }
}
for (const d of process.argv.slice(2)) walk(d);
