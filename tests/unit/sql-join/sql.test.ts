import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/sql-join/code-text';
import {
  SORGULAR,
  SORGU_IDS,
  YAZARLAR,
  KITAPLAR,
  calistir,
  esit,
  kosulDegeri,
  ve,
} from '../../../src/concepts/sql-join/sql';

const L = (id: string) => LISTINGS.find((l) => l.id === id)!;

describe('sql-join evaluator', () => {
  it('has seven queries and the fixed data set', () => {
    expect(SORGU_IDS).toHaveLength(7);
    expect(YAZARLAR.map((y) => y.key)).toEqual(['y1', 'y2', 'y3']);
    expect(KITAPLAR.map((k) => k.key)).toEqual(['k1', 'k2']);
  });

  it('cartesian gives 6 rows and 6 pair steps', () => {
    const s = calistir('kartezyen');
    expect(s.satirlar).toHaveLength(6);
    expect(s.adimlar).toHaveLength(6);
    expect(s.adimlar.every((a) => a.on === true)).toBe(true);
  });

  it('inner gives the two matching rows without Bilge Karasu', () => {
    const s = calistir('inner');
    expect(s.satirlar).toEqual([
      ['Yaşar Kemal', 'İnce Memed'],
      ['Adalet Ağaoğlu', 'Ölmeye Yatmak'],
    ]);
    expect(s.sirasiz).toBe(true);
  });

  it('left keeps every author, ordered', () => {
    const s = calistir('left');
    expect(s.satirlar).toEqual([
      ['Adalet Ağaoğlu', 'Ölmeye Yatmak'],
      ['Bilge Karasu', null],
      ['Yaşar Kemal', 'İnce Memed'],
    ]);
    expect(s.sirasiz).toBe(false);
  });

  it('left adds an unmatched step with sagKey null', () => {
    const s = calistir('left');
    expect(s.adimlar).toHaveLength(7);
    const son = s.adimlar[s.adimlar.length - 1];
    expect(son).toEqual({ solKey: 'y3', sagKey: null, on: null, eklenen: ['Bilge Karasu', null] });
  });

  it('is-null finds Bilge Karasu', () => {
    expect(calistir('is-null').satirlar).toEqual([['Bilge Karasu']]);
  });

  it('where on the right table drops the NULL row', () => {
    const s = calistir('where-tuzagi');
    expect(s.satirlar).toEqual([['Adalet Ağaoğlu', 'Ölmeye Yatmak']]);
    expect(s.elenen).toHaveLength(2);
    expect(s.elenen).toContainEqual(['Bilge Karasu', null]);
    const q = SORGULAR['where-tuzagi'];
    expect(kosulDegeri(q.where!, { y: YAZARLAR[2], k: null })).toBeNull();
  });

  it('the same filter in ON keeps three rows', () => {
    expect(calistir('on-filtre').satirlar).toEqual([
      ['Adalet Ağaoğlu', 'Ölmeye Yatmak'],
      ['Bilge Karasu', null],
      ['Yaşar Kemal', null],
    ]);
  });

  it('three-valued equality', () => {
    expect(esit(null, 1)).toBeNull();
    expect(esit(1, 1)).toBe(true);
    expect(esit(1, 2)).toBe(false);
    expect(ve(true, null)).toBeNull();
    expect(ve(false, null)).toBe(false);
    expect(ve(true, true)).toBe(true);
  });

  it('parameter stays out of the text', () => {
    const metin = SORGULAR.parametreli.sql.join('\n');
    expect(metin).toContain('$1');
    expect(metin).not.toMatch(/=\s*3/);
    expect(calistir('parametreli', 3).satirlar).toEqual([['Bilge Karasu', null]]);
    expect(calistir('parametreli', 1).satirlar).toEqual([['Yaşar Kemal', 'İnce Memed']]);
  });

  it('every row the JOIN produces is on its step, WHERE-removed ones too', () => {
    const s = calistir('where-tuzagi');
    const eklenenler = s.adimlar.filter((a) => a.eklenen).map((a) => a.eklenen);
    expect(eklenenler).toHaveLength(s.satirlar.length + s.elenen.length);
    expect(eklenenler).toContainEqual(['Yaşar Kemal', 'İnce Memed']);
    expect(eklenenler).toContainEqual(['Bilge Karasu', null]);
    expect(s.elenen).toContainEqual(['Yaşar Kemal', 'İnce Memed']);
  });

  it('kaynak and ref of every query follow the spec table', () => {
    const beklenen: Record<string, [string, string]> = {
      kartezyen: ['kitap', 'L881-882'],
      inner: ['kitap', 'L777-780'],
      left: ['kitap', 'L782-786'],
      'is-null': ['kitaba-dayali', 'L1936-1938'],
      'where-tuzagi': ['kitaba-dayali', 'L920'],
      'on-filtre': ['kitaba-dayali', 'L920'],
      parametreli: ['kitaba-dayali', 'L1687-1690'],
    };
    for (const id of SORGU_IDS) expect([SORGULAR[id].kaynak, SORGULAR[id].ref], id).toEqual(beklenen[id]);
  });

  it('deger is clamped', () => {
    expect(calistir('parametreli', 9).satirlar).toEqual(calistir('parametreli', 3).satirlar);
    expect(calistir('parametreli', 0).satirlar).toEqual(calistir('parametreli', 1).satirlar);
  });

  it('nested loop order', () => {
    expect(calistir('inner').adimlar.map((a) => `${a.solKey}${a.sagKey}`)).toEqual([
      'y1k1', 'y1k2', 'y2k1', 'y2k2', 'y3k1', 'y3k2',
    ]);
  });

  it('listings match the book', () => {
    expect(L('kod-7-7-cikti').lines.filter((l) => l.includes('(1 row)'))).toHaveLength(2);
    const c = L('code-015').lines;
    expect(c[c.length - 1]).toBe('FROM yazarlar AS y, kitaplar AS k;');
    expect(SORGULAR.inner.sql).toEqual(L('kod-7-7').lines.slice(4, 8));
    expect(SORGULAR.left.sql).toEqual(L('kod-7-7').lines.slice(9, 14));
  });
});
