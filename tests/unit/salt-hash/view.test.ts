import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/salt-hash/code-text';
import { SALT_1, SALT_2, SCRYPT_ONBELLEK, SHA_123456 } from '../../../src/concepts/salt-hash/degerler';
import { saltScenario as sc, type SaltParams } from '../../../src/concepts/salt-hash/scenario';
import { deriveSaltView, saltAnahtarlari, saltLabRozet } from '../../../src/concepts/salt-hash/view';
import { lineOf, listing } from '../../../src/core/listing';

const ONBELLEK = new Map(Object.entries(SCRYPT_ONBELLEK));
const step = (n: number): SaltParams => sc.steps[n - 1].params as SaltParams;
const view = (n: number) => deriveSaltView(step(n), ONBELLEK);
const hashParca = (v: ReturnType<typeof view>, i: number) => v.seritler[i].parcalar.find((p) => p.etiket === 'hash')!;

describe('salt-hash view', () => {
  it('step 2 two identical strips', () => {
    const v = view(2);
    expect(v.seritler).toHaveLength(2);
    expect(hashParca(v, 0).metin).toBe(SHA_123456);
    expect(hashParca(v, 1).metin).toBe(SHA_123456);
    expect(hashParca(v, 1).fark ?? []).toEqual([]);
    expect(v.terminal).toEqual([{ metin: 'true' }]);
  });

  it('step 4 second strip differs almost everywhere', () => {
    const v = view(4);
    expect(hashParca(v, 0).metin).toBe(SCRYPT_ONBELLEK[`guclu-Parola123|${SALT_1}`]);
    expect(hashParca(v, 1).metin).toBe(SCRYPT_ONBELLEK[`guclu-Parola123|${SALT_2}`]);
    expect(hashParca(v, 1).fark!.length).toBeGreaterThan(100);
    expect(v.tablo.satirlar.map((r) => r.key)).toEqual(['elif', 'ahmet']);
  });

  it('step 6 terminal is book L303-304', () => {
    expect(view(6).terminal.map((t) => t.metin)).toEqual(['true', 'false']);
    expect(view(5).terminal.map((t) => t.metin)).toEqual(['true']);
    expect(view(6).sonuc).toBe(false);
    expect(view(5).sonuc).toBe(true);
  });

  it('lab wrong attempt prints only the attempt line', () => {
    const v = deriveSaltView({ ...step(6), parola: 'yanlis-parola', deneme: 'guclu-Parola123' }, ONBELLEK);
    expect(v.terminal.map((t) => t.metin)).toEqual(['false']);
  });

  it('step 7 counters 1 and 64', () => {
    const k = view(7).karsilastirma!;
    expect(k.esittir).toBe(1);
    expect(k.timingSafeEqual).toBe(64);
    expect(k.ilkFark).toBe(0);
    expect(view(6).karsilastirma).toBeNull();
  });

  it('missing hash shows hesaplanıyor and is listed in bekliyor', () => {
    const p: SaltParams = { ...step(3), salt: 'yeni', yeniSalt: 'abc' };
    const v = deriveSaltView(p, new Map());
    expect(v.bekliyor).toEqual(['guclu-Parola123|abc']);
    expect(saltAnahtarlari(p)).toEqual(['guclu-Parola123|abc']);
    expect(hashParca(v, 0).metin).toBe('hesaplanıyor…');
    expect(v.tablo.satirlar[0].cells[2]).toBe('hesaplanıyor…');
  });

  it('empty yeniSalt falls back to SALT_1 and second user gets SALT_2', () => {
    const v = deriveSaltView({ ...step(4), salt: 'yeni', yeniSalt: '' }, ONBELLEK);
    expect(v.tablo.satirlar.map((r) => r.cells[1])).toEqual([SALT_1, SALT_2]);
  });

  it('table hash is the first 16 characters and an ellipsis', () => {
    const r = view(3).tablo.satirlar[0];
    expect(r.cells).toEqual(['elif', SALT_1, `${SCRYPT_ONBELLEK[`guclu-Parola123|${SALT_1}`].slice(0, 16)}…`]);
    expect(view(3).tablo.sutunlar.map((s) => s.ad)).toEqual(['kullaniciAdi', 'salt', 'hash']);
  });

  it('sha256 hides salt column value', () => {
    const v = view(2);
    expect(v.tablo.satirlar.map((r) => r.cells[1])).toEqual(['—', '—']);
    expect(v.tablo.satirlar[0].cells[2]).toBe(`${SHA_123456.slice(0, 16)}…`);
    expect(v.seritler[0].parcalar.some((p) => p.etiket === 'salt')).toBe(false);
    expect(v.bekliyor).toEqual([]);
  });

  it('flags and summary follow gorunum', () => {
    expect(view(8).yavasTablo).toBe(true);
    expect(view(7).yavasTablo).toBe(false);
    expect(view(9).ozet!.length).toBeGreaterThan(0);
    expect(view(8).ozet).toBeNull();
  });

  it('code strip line follows gorunum', () => {
    const k = listing(LISTINGS, 'kod-10-2');
    const c4 = listing(LISTINGS, 'code-004');
    expect(view(3).code.active).toEqual([lineOf(k, 'scryptSync(duzMetinParola, salt')]);
    expect(view(3).code.active[0] + 268).toBe(283);
    expect(view(5).code.active[0] + 268).toBe(288);
    expect(view(7).code.active[0] + 268).toBe(290);
    expect(view(2).code.lines).toEqual(c4.lines);
    expect(view(2).code.active).toEqual([lineOf(c4, 'createHash("sha256")')]);
  });

  it('saltLabRozet is always kitap-kodu without ref', () => {
    expect(saltLabRozet(step(3))).toEqual({ tur: 'kitap-kodu' });
    expect(saltLabRozet(step(2))).toEqual({ tur: 'kitap-kodu' });
  });
});
