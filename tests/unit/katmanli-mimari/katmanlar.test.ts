import { describe, expect, it } from 'vitest';
import { listing } from '../../../src/core/listing';
import { LISTINGS } from '../../../src/concepts/katmanli-mimari/code-text';
import {
  BASLANGIC,
  istekKarsila,
  kurulumOlaylari,
  type Durum,
  type KatmanIzi,
} from '../../../src/concepts/katmanli-mimari/katmanlar';

const KITAP_CIKTI = [
  '{',
  '  durumKodu: 201,',
  "  mesaj: 'Java ile Programlama başarıyla ödünç verildi.'",
  '}',
];
const BOOK = { ogrenciNumarasi: '2024001', kitapKodu: 'JAVA-101' };
const kod = listing(LISTINGS, 'kod-9-5');

function dondur<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(dondur);
    Object.freeze(o);
  }
  return o;
}
function durumla(kitap: Partial<Durum['kitaplar'][number]>, ogrenci: Partial<Durum['ogrenciler'][number]> = {}): Durum {
  return {
    kitaplar: [{ ...BASLANGIC.kitaplar[0], ...kitap }],
    ogrenciler: [{ ...BASLANGIC.ogrenciler[0], ...ogrenci }],
  };
}
function mesaj(iz: KatmanIzi) {
  return `${iz.yanit.durumKodu} ${iz.yanit.mesaj}`;
}

describe('katmanlar', () => {
  it('book call gives the book output', () => {
    const iz = istekKarsila(BASLANGIC, BOOK);
    expect(iz.yanit.durumKodu).toBe(201);
    expect(iz.cikti).toEqual(KITAP_CIKTI);
  });

  it('success changes both repositories', () => {
    const { durum } = istekKarsila(BASLANGIC, BOOK);
    expect(durum.kitaplar[0].uygunMu).toBe(false);
    expect(durum.ogrenciler[0].mevcutOduncSayisi).toBe(1);
  });

  it('second call fails with Kitap uygun değildir.', () => {
    const ilk = istekKarsila(BASLANGIC, BOOK);
    const iz = istekKarsila(ilk.durum, BOOK);
    expect(iz.yanit).toEqual({ durumKodu: 400, mesaj: 'Kitap uygun değildir.' });
    const f = iz.olaylar.filter((o) => o.tur === 'firlat');
    expect(f).toHaveLength(1);
    expect([f[0].from, f[0].to]).toEqual(['service', 'controller']);
    expect(iz.cikti).toEqual(["{ durumKodu: 400, mesaj: 'Kitap uygun değildir.' }"]);
    expect(iz.durum).toEqual(ilk.durum);
  });

  it('missing field never reaches the service', () => {
    const iz = istekKarsila(BASLANGIC, { ogrenciNumarasi: '2024001', kitapKodu: '' });
    expect(mesaj(iz)).toBe('400 Zorunlu alanlar eksiktir.');
    expect(iz.olaylar.some((o) => o.from === 'service' || o.to === 'service')).toBe(false);
    expect(iz.olaylar[iz.olaylar.length - 1]).toMatchObject({ tur: 'not', from: 'cagiran', to: 'cagiran' });
    expect(mesaj(istekKarsila(BASLANGIC, { ogrenciNumarasi: '', kitapKodu: 'JAVA-101' }))).toBe(
      '400 Zorunlu alanlar eksiktir.',
    );
  });

  it('four error branches in code order', () => {
    expect(mesaj(istekKarsila(BASLANGIC, { ...BOOK, kitapKodu: 'TS-201' }))).toBe('400 Kitap bulunamadı.');
    expect(mesaj(istekKarsila(BASLANGIC, { ...BOOK, ogrenciNumarasi: '2024999' }))).toBe('400 Öğrenci bulunamadı.');
    expect(mesaj(istekKarsila(durumla({ uygunMu: false }), BOOK))).toBe('400 Kitap uygun değildir.');
    expect(mesaj(istekKarsila(durumla({}, { mevcutOduncSayisi: 3 }), BOOK))).toBe('400 Öğrenci limitine ulaştı.');
    expect(mesaj(istekKarsila(durumla({}, { mevcutOduncSayisi: 2 }), BOOK))).toMatch(/^201/);
    expect(mesaj(istekKarsila(BASLANGIC, { ogrenciNumarasi: '2024999', kitapKodu: 'TS-201' }))).toBe(
      '400 Kitap bulunamadı.',
    );
    expect(mesaj(istekKarsila(durumla({ uygunMu: false }, { mevcutOduncSayisi: 3 }), BOOK))).toBe(
      '400 Kitap uygun değildir.',
    );
  });

  it('reads come before the rule checks', () => {
    for (const istek of [BOOK, { ...BOOK, kitapKodu: 'TS-201' }, { ...BOOK, ogrenciNumarasi: '2024999' }]) {
      const o = istekKarsila(BASLANGIC, istek).olaylar;
      const kitapBul = o.findIndex((e) => e.tur === 'cagri' && e.etiket.startsWith('kitapBul('));
      const ogrenciBul = o.findIndex((e) => e.tur === 'cagri' && e.etiket.startsWith('ogrenciBul('));
      const ilkKural = o.findIndex((e) => e.from === 'service' && (e.tur === 'not' || e.tur === 'firlat'));
      expect(kitapBul).toBeGreaterThan(-1);
      expect(ogrenciBul).toBeGreaterThan(kitapBul);
      expect(ilkKural).toBeGreaterThan(ogrenciBul);
    }
  });

  it('success event order follows the code', () => {
    const o = istekKarsila(BASLANGIC, BOOK).olaylar;
    expect(`${o[0].tur}:${o[0].from}>${o[0].to}`).toBe('cagri:cagiran>controller');
    expect(o[o.length - 2]).toMatchObject({ tur: 'donus', from: 'controller', to: 'cagiran', etiket: '201' });
    expect(o[o.length - 1]).toMatchObject({ tur: 'not', from: 'cagiran' });
    expect(o.some((e) => e.tur === 'not' && e.from === 'kitapRepo' && e.etiket.startsWith('kitapBul('))).toBe(true);
    const sira = o.filter((e) => e.tur === 'cagri').map((e) => e.etiket.split('(')[0]);
    expect(sira).toEqual([
      'istekKarsila',
      'oduncAl',
      'kitapBul',
      'ogrenciBul',
      'kitabiOduncteIsaretle',
      'oduncSayisiniArtir',
    ]);
  });

  it('setup lists four constructor calls', () => {
    const k = kurulumOlaylari();
    expect(k).toHaveLength(4);
    expect(k.map((e) => kod.lines[e.satir - 1].trim())).toEqual([
      'const kitapRepository = new KitapRepository();',
      'const ogrenciRepository = new OgrenciRepository();',
      'const oduncAlmaService = new OduncAlmaService(kitapRepository, ogrenciRepository);',
      'const oduncAlmaController = new OduncAlmaController(oduncAlmaService);',
    ]);
  });

  it('input state is not mutated', () => {
    const girdi = dondur(structuredClone(BASLANGIC));
    const iz = istekKarsila(girdi, BOOK);
    expect(girdi).toEqual(BASLANGIC);
    expect(iz.durum).not.toBe(girdi);
  });

  it('every event line points into Kod 9.5', () => {
    for (const durum of [BASLANGIC, durumla({ uygunMu: false })]) {
      for (const istek of [BOOK, { ...BOOK, kitapKodu: '' }, { ...BOOK, kitapKodu: 'X' }]) {
        for (const e of istekKarsila(durum, istek).olaylar) {
          expect(e.satir).toBeGreaterThanOrEqual(1);
          expect(e.satir).toBeLessThanOrEqual(kod.lines.length);
        }
      }
    }
  });

  it('listings match the book', () => {
    expect(kod.lines[0]).toBe('// File: ChapterMiniApp.ts');
    expect(kod.satirlar).toEqual([953, 1048]);
    expect(listing(LISTINGS, 'kod-9-5-cikti').lines).toEqual(KITAP_CIKTI);
  });
});
