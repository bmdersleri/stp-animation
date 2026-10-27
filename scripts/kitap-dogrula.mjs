// Compares the on-screen listings (src/concepts/*/code-text.ts LISTINGS) with the book's final.md.
// Local use only (not part of `npm run check`). Exit 1 on any difference.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { karsilastir, kitapDizini } from './kitap-dogrula-lib.mjs';

const kok = kitapDizini();
if (!existsSync(kok)) {
  console.log('kitap bulunamadı, atlandı');
  process.exit(0);
}

const kavramlar = join(import.meta.dirname, '..', 'src', 'concepts');
const cache = new Map();
let fark = 0;

for (const kavram of readdirSync(kavramlar).sort()) {
  const dosya = join(kavramlar, kavram, 'code-text.ts');
  if (!existsSync(dosya)) continue;
  const { LISTINGS } = await import(pathToFileURL(dosya).href);
  if (!Array.isArray(LISTINGS)) continue;
  for (const l of LISTINGS) {
    const yol = `${kok}/chapters/${l.bolum}/content/final.md`;
    if (!cache.has(yol)) cache.set(yol, existsSync(yol) ? readFileSync(yol, 'utf8').split('\n') : null);
    const kitap = cache.get(yol);
    if (!kitap) {
      console.log(`FARK  ${kavram}/${l.id} kitap dosyası yok: ${yol}`);
      fark++;
      continue;
    }
    const f = karsilastir(kitap, l);
    if (!f) {
      console.log(`tamam  ${kavram}/${l.id}`);
    } else {
      fark++;
      console.log(`FARK  ${kavram}/${l.id} satır ${f.satir}`);
      console.log(`  beklenen: ${f.beklenen}`);
      console.log(`  bulunan:  ${f.bulunan}`);
    }
  }
}
process.exit(fark ? 1 : 0);
