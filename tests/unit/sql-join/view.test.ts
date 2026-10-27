import { describe, expect, it } from 'vitest';
import { SORGULAR, SORGU_IDS, calistir } from '../../../src/concepts/sql-join/sql';
import { TUMU, sqlScenario, type SqlParams } from '../../../src/concepts/sql-join/scenario';
import { deriveSqlView, sqlLabRozet } from '../../../src/concepts/sql-join/view';

const adim = (id: string): SqlParams => ({ ...sqlScenario.defaults, ...sqlScenario.steps.find((s) => s.id === id)!.params });
const durumlar = (rows: readonly { state?: string }[] | undefined, d: string): number => (rows ?? []).filter((r) => r.state === d).length;
const NOT = 'ORDER BY yoksa satır sırası garanti değildir';

describe('sql-join view', () => {
  it('step 1 tables have headers only', () => {
    const v = deriveSqlView(adim('tanitim'));
    expect(v.yazarlar.satirlar).toEqual([]);
    expect(v.kitaplar.satirlar).toEqual([]);
    expect(v.yazarlar.sutunlar).toEqual([{ ad: 'yazar_id', anahtar: 'PK' }, { ad: 'ad_soyad' }]);
    expect(v.kitaplar.sutunlar).toEqual([{ ad: 'kitap_adi' }, { ad: 'yazar_id', anahtar: 'FK' }]);
    expect(v.sonuc).toBeNull();
    expect(v.kosul).toBeNull();
  });

  it('step 2 fills the rows with their sources', () => {
    const v = deriveSqlView(adim('veri'));
    expect(v.yazarlar.satirlar).toHaveLength(3);
    expect(v.kitaplar.satirlar).toHaveLength(2);
    const not = [v.yazarlar.not, v.kitaplar.not].join(' ');
    expect(not).toContain('Kaynak: Kod 7.5 (Yaşar Kemal, İnce Memed), Kod 7.6 (Adalet Ağaoğlu, Ölmeye Yatmak), alıştırma L1938 (Bilge Karasu)');
    expect(v.code.title).toBe('Kod 7.5 · Yaşar Kemal ve İnce Memed');
    expect(v.code.active.length).toBeGreaterThan(0);
    expect(v.code.active.every((n) => v.code.lines[n - 1].includes('INSERT INTO'))).toBe(true);
  });

  it('step 3 shows six rows and the order note', () => {
    const v = deriveSqlView(adim('kartezyen'));
    expect(v.sonuc!.satirlar).toHaveLength(6);
    expect(v.code.title).toBe('Yanlış: JOIN koşulu yok');
    expect(v.siraNotu).toBe(NOT);
  });

  it('step 4 highlights pair y2/k2 with 2 = 2 → doğru', () => {
    const v = deriveSqlView(adim('on-kosulu'));
    expect(v.kosul).toEqual({ metin: '2 = 2 → doğru', deger: true });
    expect(v.yazarlar.satirlar.filter((r) => r.state === 'etkin').map((r) => r.key)).toEqual(['y2']);
    expect(v.kitaplar.satirlar.filter((r) => r.state === 'etkin').map((r) => r.key)).toEqual(['k2']);
    expect(v.sonuc!.satirlar).toHaveLength(2);
    expect(durumlar(v.sonuc!.satirlar, 'yeni')).toBe(1);
    expect(v.code.lines[v.code.active[0] - 1]).toContain('ON');
  });

  it('walks pairs: a false pair adds nothing, cift 0 shows nothing', () => {
    const v = deriveSqlView({ ...adim('on-kosulu'), cift: 2 });
    expect(v.kosul).toEqual({ metin: '2 = 1 → yanlış', deger: false });
    expect(v.sonuc!.satirlar).toHaveLength(1);
    const v0 = deriveSqlView({ ...adim('on-kosulu'), cift: 0 });
    expect(v0.kosul).toBeNull();
    expect(v0.sonuc!.satirlar).toEqual([]);
    expect(v0.code.active).toEqual([]);
  });

  it('step 5 has the order note, step 6 not', () => {
    const v = deriveSqlView(adim('inner-sonuc'));
    expect(v.siraNotu).toBe(NOT);
    expect(deriveSqlView(adim('left')).siraNotu).toBeNull();
    expect(v.sonuc!.satirlar.map((r) => r.cells)).toEqual([['Yaşar Kemal', 'İnce Memed'], ['Adalet Ağaoğlu', 'Ölmeye Yatmak']]);
  });

  it('step 6 shows a NULL cell for Bilge Karasu', () => {
    const v = deriveSqlView(adim('left'));
    expect(v.sonuc!.satirlar.map((r) => r.cells)).toContainEqual(['Bilge Karasu', null]);
    expect(v.sonuc!.satirlar).toHaveLength(3);
  });

  it('LEFT walk names the unmatched step', () => {
    const v = deriveSqlView({ ...adim('left'), sorgu: 'on-filtre', cift: 3 });
    expect(v.kosul).toEqual({ metin: 'eşleşme yok → NULL ile eklenir', deger: null });
    expect(durumlar(v.sonuc!.satirlar, 'yeni')).toBe(1);
  });

  it('step 7 finds Bilge Karasu next to the struck rows', () => {
    const v = deriveSqlView(adim('is-null'));
    expect(v.sonuc!.satirlar.filter((r) => r.state !== 'silindi').map((r) => r.cells)).toEqual([['Bilge Karasu']]);
    expect(v.code.lines[v.code.active[0] - 1]).toContain('WHERE');
  });

  it('step 8 strikes out two rows and shows the ON version with three rows', () => {
    const v = deriveSqlView(adim('where-tuzagi'));
    expect(durumlar(v.sonuc!.satirlar, 'silindi')).toBe(2);
    expect(v.sonuc!.satirlar.filter((r) => r.state !== 'silindi')).toHaveLength(1);
    expect(v.ikinci!.baslik).toBe("Koşul ON'a taşınınca");
    expect(v.ikinci!.satirlar).toHaveLength(3);
    expect(v.kosul).toEqual({ metin: "NULL <> 'İnce Memed' → NULL", deger: null });
    expect(v.code.lines[v.code.active[0] - 1]).toContain('WHERE');
    expect(deriveSqlView(adim('left')).ikinci).toBeNull();
  });

  it('a removed row appears during the walk and is struck out at the end', () => {
    const p = adim('where-tuzagi');
    const n = calistir('where-tuzagi').adimlar.length;
    const yurume = deriveSqlView({ ...p, cift: 1 });
    expect(yurume.sonuc!.satirlar).toHaveLength(1);
    expect(durumlar(yurume.sonuc!.satirlar, 'silindi')).toBe(0);
    const son = deriveSqlView({ ...p, cift: n });
    expect(durumlar(son.sonuc!.satirlar, 'silindi')).toBe(2);
    expect(yurume.sonuc!.satirlar[0].key).toBe(son.sonuc!.satirlar.find((r) => r.state === 'silindi')!.key);
  });

  it('step 9 shows $1 and [3]', () => {
    const v = deriveSqlView(adim('parametreli'));
    expect(v.code.title).toBe('Kitaba dayalı sorgu');
    expect(v.code.lines.join('\n')).toContain('$1');
    expect(v.code.lines.join('\n')).not.toMatch(/=\s*3/);
    expect(v.parametreler).toEqual([3]);
    expect(deriveSqlView({ ...adim('parametreli'), deger: 1 }).parametreler).toEqual([1]);
    expect(deriveSqlView(adim('left')).parametreler).toBeNull();
  });

  it('cift is clamped', () => {
    const n = calistir('inner').adimlar.length;
    expect(deriveSqlView({ ...adim('on-kosulu'), cift: -1 })).toEqual(deriveSqlView({ ...adim('on-kosulu'), cift: 0 }));
    expect(deriveSqlView({ ...adim('on-kosulu'), cift: TUMU })).toEqual(deriveSqlView({ ...adim('on-kosulu'), cift: n }));
  });

  it('ozet counts come from the evaluator', () => {
    const v = deriveSqlView(adim('ozet'));
    expect(v.ozet!.sayilar).toEqual([
      ['Kartezyen', calistir('kartezyen').satirlar.length],
      ['INNER JOIN', calistir('inner').satirlar.length],
      ['LEFT JOIN', calistir('left').satirlar.length],
    ]);
    expect(v.ozet!.sayilar.map(([, n]) => n)).toEqual([6, 2, 3]);
    expect(v.ozet!.satirlar).toHaveLength(4);
    expect(v.ozet!.satirlar[0]).toEqual(['INNER JOIN', 'Sadece eşleşenler', 'Kitabı olan yazarlar', 'Eksik ilişkiler görünmez']);
    expect(v.ozet!.satirlar.flat().join('').includes('`')).toBe(false);
    expect(deriveSqlView(adim('left')).ozet).toBeNull();
  });

  it('lab badge follows the query source', () => {
    for (const id of SORGU_IDS) {
      expect(sqlLabRozet({ ...adim('left'), sorgu: id })).toEqual({ tur: SORGULAR[id].kaynak, ref: SORGULAR[id].ref });
    }
    expect(sqlLabRozet({ ...adim('left') }).tur).toBe('kitap');
    expect(sqlLabRozet({ ...adim('parametreli'), deger: 1 }).tur).toBe('kitaba-dayali');
  });
});
