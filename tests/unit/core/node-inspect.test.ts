import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { nodeInspect } from '../../../src/core/node-inspect';

const santrifuj = { durumKodu: 201, basarili: true, veri: { kimlik: 3, ad: 'Santrifüj', durum: 'musait' }, mesaj: 'Ekipman oluşturuldu.' };
const fixtures: Record<string, unknown> = {
  'Santrifüj 201': santrifuj,
  'liste 200': {
    durumKodu: 200,
    basarili: true,
    veri: [
      { kimlik: 1, ad: 'Mikroskop', durum: 'musait' },
      { kimlik: 2, ad: 'Spektrometre', durum: 'rezerve' },
    ],
    metadata: { sayfa: 1, sayfaBoyutu: 2, toplamKayit: 3 },
  },
  'durum güncelleme': { durumKodu: 200, basarili: true, veri: { kimlik: 1, ad: 'Mikroskop', durum: 'rezerve' }, mesaj: 'Ekipman durumu güncellendi.' },
  'bulunamadı 404': { durumKodu: 404, basarili: false, hataKodu: 'EKIPMAN_BULUNAMADI', mesaj: 'İstenen ekipman bulunamadı.' },
  GECERSIZ_AD: { durumKodu: 400, basarili: false, hataKodu: 'GECERSIZ_AD', mesaj: 'Ekipman adı boş olamaz.' },
  GECERSIZ_SAYFA: { durumKodu: 400, basarili: false, hataKodu: 'GECERSIZ_SAYFA', mesaj: 'Sayfa numarası 1 veya daha büyük bir tam sayı olmalıdır.' },
  ödünç: { durumKodu: 201, mesaj: 'Java ile Programlama başarıyla ödünç verildi.' },
  uygunDeğil: { durumKodu: 400, mesaj: 'Kitap uygun değildir.' },
  'boş dizi': [],
  'boş nesne': {},
  'iç içe dizi': [[1, 2], [3, [4, [5, [6]]]]],
  null: null,
  undefined: undefined,
  'tek tırnaklı dize': "Ali'nin kitabı",
  'iki tırnaklı dize': `Ali'nin "kitabı"`,
  kaçış: 'a\nb\t\\c',
  sayılar: Array.from({ length: 27 }, (_, i) => i + 1),
  dizeler: ['elma', 'armut', 'kiraz', 'üzüm', 'incir', 'nar', 'erik', 'muz', 'portakal'],
  'sayı ve bool': { a: 1.5, b: -0, c: false, d: undefined, 'e-f': null },
  'derin nesne': { a: { b: { c: { d: 1 } } } },
  'uzun satır': { alan1: 'x'.repeat(30), alan2: 'y'.repeat(30), alan3: 'z'.repeat(30) },
  'sürekli iç içe': { a: { b: { c: {} } }, x: 1 },
  'nesne dizisi': [{ a: 1 }, { b: 2 }],
  'uzun dize': { s: 'satır bir\nsatır iki\nsatır üç\nsatır dört\nsatır beş\nsatır altı\nsatır yedi' },
};

describe('nodeInspect', () => {
  for (const [name, value] of Object.entries(fixtures)) {
    it(`matches util.inspect on fixtures: ${name}`, () => {
      expect(nodeInspect(value)).toBe(inspect(value));
    });
  }

  it('book block', () => {
    // Kitap b06, laboratuvar-api çıktısı, L1432-1437
    expect(nodeInspect(santrifuj)).toBe(
      [
        '{',
        '  durumKodu: 201,',
        '  basarili: true,',
        "  veri: { kimlik: 3, ad: 'Santrifüj', durum: 'musait' },",
        "  mesaj: 'Ekipman oluşturuldu.'",
        '}',
      ].join('\n'),
    );
  });
});
