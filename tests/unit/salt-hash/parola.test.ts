import { createHash, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/salt-hash/code-text';
import { SALT_1, SALT_2, SCRYPT_ONBELLEK, SHA_123456 } from '../../../src/concepts/salt-hash/degerler';
import {
  guvensizHashle,
  karsilastirmaAdimi,
  parolaDogrula,
  parolaHashle,
} from '../../../src/concepts/salt-hash/parola';
import { listing } from '../../../src/core/listing';

const G = 'guclu-Parola123';
const Y = 'yanlis-parola';
const HASH_G1 = SCRYPT_ONBELLEK[`${G}|${SALT_1}`];
const HASH_G2 = SCRYPT_ONBELLEK[`${G}|${SALT_2}`];
const HASH_Y1 = SCRYPT_ONBELLEK[`${Y}|${SALT_1}`];

describe('salt-hash parola modeli', () => {
  it('ders constants equal node scryptSync', () => {
    for (const [anahtar, hash] of Object.entries(SCRYPT_ONBELLEK)) {
      const [parola, salt] = anahtar.split('|');
      expect(hash).toBe(scryptSync(parola, salt, 64).toString('hex'));
      expect(hash).toHaveLength(128);
    }
    expect(Object.keys(SCRYPT_ONBELLEK)).toHaveLength(4);
    expect(HASH_G1.startsWith('cc62223a327ab808')).toBe(true);
    expect(HASH_G2.startsWith('d3d03cc76308e4e4')).toBe(true);
    expect(HASH_Y1.startsWith('188d49cb0f92460a')).toBe(true);
  });

  it('SHA_123456 equals createHash', () => {
    expect(SHA_123456).toBe(createHash('sha256').update('123456').digest('hex'));
  });

  it('book output L303-304', async () => {
    const kayit = await parolaHashle(G, SALT_1);
    const dogru = await parolaDogrula(G, kayit);
    const yanlis = await parolaDogrula(Y, kayit);
    expect(dogru.sonuc).toBe(true);
    expect(dogru.ilkFark).toBe(-1);
    expect(yanlis.sonuc).toBe(false);
    expect(yanlis.ilkFark).toBe(0);
    expect([String(dogru.sonuc), String(yanlis.sonuc)]).toEqual(listing(LISTINGS, 'kod-10-2-cikti').lines);
  });

  it('code-004 output L371', () => {
    const cikti = String(guvensizHashle('123456') === guvensizHashle('123456'));
    expect(cikti).toBe(listing(LISTINGS, 'code-004-cikti').lines[0]);
    expect(guvensizHashle('123456')).toBe(SHA_123456);
  });

  it('same password two salts differ', async () => {
    const a = await parolaHashle(G, SALT_1);
    const b = await parolaHashle(G, SALT_2);
    expect(a.hash).not.toBe(b.hash);
  });

  it('karsilastirmaAdimi', () => {
    expect(karsilastirmaAdimi(HASH_G1, HASH_Y1, 'esittir')).toBe(1);
    expect(karsilastirmaAdimi(HASH_G1, HASH_Y1, 'timingSafeEqual')).toBe(64);
    expect(karsilastirmaAdimi(HASH_G1, HASH_G1, 'esittir')).toBe(128);
    expect(karsilastirmaAdimi(HASH_G1, HASH_G1, 'timingSafeEqual')).toBe(64);
  });

  it('uncached input falls back to scrypt', async () => {
    const k = await parolaHashle('x', SALT_1);
    expect(k.hash).toBe(scryptSync('x', SALT_1, 64).toString('hex'));
  }, 20000);

  it('listings match book', () => {
    const k = listing(LISTINGS, 'kod-10-2').lines;
    expect(k).toHaveLength(30);
    expect(k[0]).toBe('// Dosya: ParolaHashleme.ts');
    expect(k[k.length - 1]).toBe('// Çıktı: false');
    const c = listing(LISTINGS, 'code-004').lines;
    expect(c[c.length - 1]).toBe('// Çıktı: true (salt yokluğu nedeniyle her zaman aynı sonuç)');
  });
});
