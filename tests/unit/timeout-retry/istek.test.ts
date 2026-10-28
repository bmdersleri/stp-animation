import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/timeout-retry/code-text';
import {
  BEKLEME_TABANI_MS,
  HIZLI_MS,
  KITAP_ZAMAN_ASIMI_MS,
  OZET_173,
  OZET_175,
  YAVAS_MS,
  beklemeMs,
  kitapCagrilari173,
  kitapCagrilari175,
  ozetiAl,
  type Davranis,
  type IstekAyar,
} from '../../../src/concepts/timeout-retry/istek';
import { listing } from '../../../src/core/listing';

const ayar = (o: Partial<IstekAyar> = {}): IstekAyar => ({
  zamanAsimiMs: KITAP_ZAMAN_ASIMI_MS,
  maksRetry: 0,
  beklemeTabanMs: BEKLEME_TABANI_MS,
  surum: '17.5',
  ...o,
});
const yavas: Davranis = { gecikmeMs: YAVAS_MS, sonuc: 'ok' };
const hizli: Davranis = { gecikmeMs: HIZLI_MS, sonuc: 'ok' };
const tur = (r: ReturnType<typeof ozetiAl>, t: string) => r.olaylar.filter((o) => o.tur === t);
const zamanlar = (r: ReturnType<typeof ozetiAl>, t: string) => tur(r, t).map((o) => o.t);

describe('timeout-retry istek modeli', () => {
  it('book output L405-407', () => {
    expect(kitapCagrilari173()).toEqual(listing(LISTINGS, 'kod-17-3-cikti').lines);
  });
  it('book output L772-776', () => {
    expect(kitapCagrilari175()).toEqual(listing(LISTINGS, 'kod-17-5-cikti').lines);
  });
  it('slow 8000 retry 0', () => {
    const r = ozetiAl([yavas], ayar());
    expect(zamanlar(r, 'iptal')).toEqual([5000]);
    expect(r.ozet).toBeNull();
    expect(r.bitisMs).toBe(5000);
  });
  it('fast 1200 retry 0', () => {
    const r = ozetiAl([hizli], ayar());
    expect(zamanlar(r, 'yanit')).toEqual([1200]);
    expect(r.ozet).toBe(OZET_175);
    expect(r.bitisMs).toBe(1200);
  });
  it('17.3 success returns its own text', () => {
    const r = ozetiAl([hizli], ayar({ surum: '17.3' }));
    expect(r.ozet).toBe(OZET_173);
    expect(r.konsol).toEqual([OZET_173]);
  });
  it('transient then fast, retry 1', () => {
    const r = ozetiAl([yavas, hizli], ayar({ maksRetry: 1 }));
    expect(zamanlar(r, 'iptal')).toEqual([5000]);
    expect(zamanlar(r, 'bekle')).toEqual([5000]);
    expect(zamanlar(r, 'istek')).toEqual([0, 6000]);
    expect(zamanlar(r, 'yanit')).toEqual([7200]);
    expect(r.ozet).toBe(OZET_175);
    expect(r.bitisMs).toBe(7200);
  });
  it('slow retry 1', () => {
    const r = ozetiAl([yavas], ayar({ maksRetry: 1 }));
    expect(zamanlar(r, 'istek')).toEqual([0, 6000]);
    expect(zamanlar(r, 'iptal')).toEqual([5000, 11000]);
    expect(zamanlar(r, 'bekle')).toEqual([5000]);
    expect(r.ozet).toBeNull();
    expect(r.bitisMs).toBe(11000);
  });
  it('slow retry 3 base 1000', () => {
    const r = ozetiAl([yavas], ayar({ maksRetry: 3 }));
    expect(tur(r, 'bekle').map((o) => o.metin)).toEqual(['1000 ms', '2000 ms', '4000 ms']);
    expect(tur(r, 'iptal')).toHaveLength(4);
    expect(r.ozet).toBeNull();
    expect(r.bitisMs).toBe(27000);
  });
  it('slow retry 3 base 0', () => {
    const r = ozetiAl([yavas], ayar({ maksRetry: 3, beklemeTabanMs: 0 }));
    expect(tur(r, 'iptal')).toHaveLength(4);
    expect(tur(r, 'bekle')).toHaveLength(0);
    expect(r.ozet).toBeNull();
    expect(r.bitisMs).toBe(20000);
  });
  it('slow retry 2 base 500', () => {
    const r = ozetiAl([yavas], ayar({ maksRetry: 2, beklemeTabanMs: 500 }));
    expect(tur(r, 'bekle').map((o) => o.metin)).toEqual(['500 ms', '1000 ms']);
    expect(r.ozet).toBeNull();
    expect(r.bitisMs).toBe(16500);
  });
  it('5000 of 5000 aborts, 4999 answers', () => {
    expect(zamanlar(ozetiAl([{ gecikmeMs: 5000, sonuc: 'ok' }], ayar()), 'iptal')).toEqual([5000]);
    const r = ozetiAl([{ gecikmeMs: 4999, sonuc: 'ok' }], ayar());
    expect(zamanlar(r, 'yanit')).toEqual([4999]);
    expect(tur(r, 'iptal')).toHaveLength(0);
  });
  it('timeout 10000 with 8000 answers', () => {
    const r = ozetiAl([yavas], ayar({ zamanAsimiMs: 10000 }));
    expect(r.ozet).toBe(OZET_175);
    expect(r.bitisMs).toBe(8000);
  });
  it('finally clears on every path', () => {
    const yollar: Davranis[] = [
      yavas,
      hizli,
      { gecikmeMs: 100, sonuc: 'http-500' },
      { gecikmeMs: 100, sonuc: 'bos-ozet' },
    ];
    for (const d of yollar) {
      const r = ozetiAl([d], ayar());
      const son = r.olaylar.find((o) => o.tur === 'iptal' || o.tur === 'yanit')!;
      const temizle = tur(r, 'temizle');
      expect(temizle).toHaveLength(1);
      expect(temizle[0].t).toBe(son.t);
    }
    const r = ozetiAl([yavas, hizli], ayar({ maksRetry: 1 }));
    expect(zamanlar(r, 'temizle')).toEqual([5000, 7200]);
  });
  it('retry only after abort', () => {
    for (const sonuc of ['http-500', 'bos-ozet', 'bozuk-govde'] as const) {
      const r = ozetiAl([{ gecikmeMs: 100, sonuc }], ayar({ maksRetry: 3 }));
      expect(tur(r, 'istek')).toHaveLength(1);
      expect(tur(r, 'bekle')).toHaveLength(0);
      expect(r.ozet).toBeNull();
    }
  });
  it('beklemeMs doubles', () => {
    expect(beklemeMs(1, 1000)).toBe(1000);
    expect(beklemeMs(2, 1000)).toBe(2000);
    expect(beklemeMs(3, 1000)).toBe(4000);
  });
  it('17.3 maps a 500 to KaliciAiHatasi', () => {
    const r = ozetiAl([{ gecikmeMs: 100, sonuc: 'http-500' }], ayar({ surum: '17.3' }));
    expect(r.konsol).toEqual([
      'Özet alınamadı, kitap bilgisi özetsiz gösterilecek: AI servisi kalıcı bir hata döndürdü.',
      'null',
    ]);
    expect(r.ozet).toBeNull();
  });
  it('17.5 rethrows a 500', () => {
    const r = ozetiAl([{ gecikmeMs: 100, sonuc: 'http-500' }], ayar());
    expect(r.konsol).toEqual(['Özet alınamadı: AI servisi hata döndürdü: 500', 'null']);
    expect(r.ozet).toBeNull();
  });
  it('empty or broken summary falls to null with the book log', () => {
    for (const sonuc of ['bos-ozet', 'bozuk-govde'] as const) {
      const r = ozetiAl([{ gecikmeMs: 100, sonuc }], ayar());
      expect(r.konsol).toEqual(['AI servisi geçersiz/boş özet döndürdü, özet gösterilmeyecek.', 'null']);
      expect(r.ozet).toBeNull();
      expect(tur(r, 'dogrulama')).toHaveLength(1);
    }
  });
  it('exhausted retry logs once', () => {
    const r = ozetiAl([yavas], ayar({ maksRetry: 1 }));
    expect(r.konsol).toEqual(['Özet alınamadı: AI servisi zaman aşımına uğradı.', 'null']);
  });
  it('17.3 timeout log carries the isolation text', () => {
    const r = ozetiAl([yavas], ayar({ surum: '17.3' }));
    expect(r.konsol).toEqual([
      'Özet alınamadı, kitap bilgisi özetsiz gösterilecek: AI servisi zaman aşımına uğradı.',
      'null',
    ]);
  });
  it('listings match book', () => {
    const k173 = listing(LISTINGS, 'kod-17-3');
    expect(k173.lines).toHaveLength(44);
    expect(k173.lines[0]).toBe('class GeciciAiHatasi extends Error {}');
    expect(listing(LISTINGS, 'kod-17-5').lines).toHaveLength(70);
    const c6 = listing(LISTINGS, 'code-006').lines;
    expect(c6[c6.length - 1]).toBe(
      "// Doğru: sınırlı sayıda deneme (2-3) ve artan bekleme süresiyle, code_005'teki gibi.",
    );
    expect(LISTINGS.map((l) => l.id)).toEqual([
      'kod-17-3',
      'kod-17-3-cikti',
      'kod-17-5',
      'kod-17-5-cikti',
      'code-002',
      'code-006',
    ]);
  });
});
