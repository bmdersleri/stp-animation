import { listing } from '../../core/listing';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { DataTableSpec, Hucre, TabloSatiri } from '../../core/plot/data-table';
import type { Rozet } from '../../core/plot/source-badge';
import { LISTINGS } from './code-text';
import type { SqlParams } from './scenario';
import {
  KITAPLAR,
  SORGULAR,
  YAZARLAR,
  calistir,
  kosulDegeri,
  type CiftAdimi,
  type Deger,
  type Kosul,
  type SatirCifti,
  type Sorgu,
} from './sql';

/** The condition badge between the active pair: `metin` reads "2 = 2 → doğru"; `deger` null means NULL. */
export interface KosulRozeti {
  metin: string;
  deger: boolean | null;
}

export interface SqlView {
  yazarlar: DataTableSpec;
  kitaplar: DataTableSpec;
  /** The result table (query view only). */
  sonuc: DataTableSpec | null;
  /** The ON version of the WHERE trap (step 8, whole result only). */
  ikinci: DataTableSpec | null;
  kosul: KosulRozeti | null;
  code: CodeTraceSpec;
  /** The bound parameters shown beside the SQL text (`parametreli` only). */
  parametreler: readonly Deger[] | null;
  siraNotu: string | null;
  ozet: { satirlar: readonly (readonly string[])[]; sayilar: readonly [string, number][] } | null;
}

const SIRA_NOTU = 'ORDER BY yoksa satır sırası garanti değildir';
const VERI_NOTU = 'Kaynak: Kod 7.5 (Yaşar Kemal, İnce Memed), Kod 7.6 (Adalet Ağaoğlu, Ölmeye Yatmak), alıştırma L1938 (Bilge Karasu)';

/** The book's JOIN type table (L860-865) without its header; backticks dropped. */
const JOIN_TURLERI: readonly (readonly string[])[] = [
  ['INNER JOIN', 'Sadece eşleşenler', 'Kitabı olan yazarlar', 'Eksik ilişkiler görünmez'],
  ['LEFT JOIN', 'Sol tablonun tamamı', 'Tüm yazarlar', 'NULL değerleri yönetilmelidir'],
  ['RIGHT JOIN', 'Sağ tablonun tamamı', 'Nadir kullanım', 'Okunabilirlik azalabilir'],
  ['FULL OUTER JOIN', 'Her iki tarafın tamamı', 'Veri uzlaştırma', 'Sonuç yorumlamak zorlaşabilir'],
];

const sonucAd = (s: string): string => s.slice(s.indexOf('.') + 1);
const yazarOf = (key: string) => YAZARLAR.find((y) => y.key === key)!;
const kitapOf = (key: string | null) => (key === null ? null : KITAPLAR.find((k) => k.key === key)!);

function tablolar(bos: boolean, etkin?: { y?: string; k?: string | null }): Pick<SqlView, 'yazarlar' | 'kitaplar'> {
  const yazarlar: TabloSatiri[] = bos ? [] : YAZARLAR.map((y) => ({
    key: y.key,
    cells: [y.yazar_id, y.ad_soyad],
    ...(etkin?.y === y.key ? { state: 'etkin' as const } : {}),
  }));
  const kitaplar: TabloSatiri[] = bos ? [] : KITAPLAR.map((k) => ({
    key: k.key,
    cells: [k.kitap_adi, k.yazar_id],
    ...(etkin?.k === k.key ? { state: 'etkin' as const } : {}),
  }));
  return {
    yazarlar: { baslik: 'yazarlar', sutunlar: [{ ad: 'yazar_id', anahtar: 'PK' }, { ad: 'ad_soyad' }], satirlar: yazarlar },
    kitaplar: { baslik: 'kitaplar', sutunlar: [{ ad: 'kitap_adi' }, { ad: 'yazar_id', anahtar: 'FK' }], satirlar: kitaplar },
  };
}

const hucreMetni = (d: Deger): string => (d === null ? 'NULL' : typeof d === 'string' ? `'${d}'` : String(d));
const sonuc3 = (b: boolean | null): string => (b === null ? 'NULL' : b ? 'doğru' : 'yanlış');

/** "NULL <> 'İnce Memed' → NULL": a WHERE condition evaluated on one row pair. */
function whereRozeti(k: Kosul, c: SatirCifti, parametreler: readonly Deger[]): KosulRozeti {
  const deger = kosulDegeri(k, c, parametreler);
  const sol = k.sutun === 'y.yazar_id' ? c.y.yazar_id : k.sutun === 'y.ad_soyad' ? c.y.ad_soyad : k.sutun === 'k.kitap_adi' ? (c.k?.kitap_adi ?? null) : (c.k?.yazar_id ?? null);
  const sag: Deger = k.deger === '$1' ? (parametreler[0] ?? null) : (k.deger ?? null);
  const metin = k.op === 'IS NULL' ? `${hucreMetni(sol)} IS NULL` : `${hucreMetni(sol)} ${k.op} ${hucreMetni(sag)}`;
  return { metin: `${metin} → ${sonuc3(deger)}`, deger };
}

function adimRozeti(s: Sorgu, a: CiftAdimi): KosulRozeti {
  if (s.tur === 'kartezyen') return { metin: 'koşul yok → eklenir', deger: true };
  if (a.sagKey === null) return { metin: 'eşleşme yok → NULL ile eklenir', deger: null };
  const y = yazarOf(a.solKey);
  const k = kitapOf(a.sagKey)!;
  let metin = `${k.yazar_id} = ${y.yazar_id}`;
  if (s.ekOn) metin += ` AND ${whereRozeti(s.ekOn, { y, k }, []).metin.split(' → ')[0]}`;
  return { metin: `${metin} → ${sonuc3(a.on)}`, deger: a.on };
}

const ayni = (a: readonly Deger[], b: readonly Deger[]): boolean => JSON.stringify(a) === JSON.stringify(b);

function codeOf(s: Sorgu, active: 'on' | 'where' | 'yok'): CodeTraceSpec {
  const baslik = s.kaynak === 'kitap' ? listing(LISTINGS, s.id === 'kartezyen' ? 'code-015' : 'kod-7-7').title : 'Kitaba dayalı sorgu';
  const bul = (re: RegExp): number[] => {
    const i = s.sql.findIndex((l) => re.test(l));
    return i < 0 ? [] : [i + 1];
  };
  let act: number[] = [];
  if (active === 'on') act = bul(/\bON\b/).length > 0 ? bul(/\bON\b/) : bul(/^FROM\b/);
  if (active === 'where') act = bul(/^WHERE\b/).length > 0 ? bul(/^WHERE\b/) : bul(/\bON\b/);
  return { title: baslik, lines: s.sql, active: act };
}

/** Everything the scene draws for one parameter set; no DOM. */
export function deriveSqlView(p: SqlParams): SqlView {
  const bos: Omit<SqlView, 'yazarlar' | 'kitaplar' | 'code'> = {
    sonuc: null, ikinci: null, kosul: null, parametreler: null, siraNotu: null, ozet: null,
  };

  if (p.gorunum === 'tanitim') {
    const lst = listing(LISTINGS, 'kod-7-5');
    return { ...tablolar(true), ...bos, code: { title: lst.title, lines: lst.lines, active: [] } };
  }
  if (p.gorunum === 'veri') {
    const lst = listing(LISTINGS, 'kod-7-5');
    const t = tablolar(false);
    return {
      ...t,
      yazarlar: { ...t.yazarlar, not: VERI_NOTU },
      ...bos,
      code: { title: lst.title, lines: lst.lines, active: lst.lines.flatMap((l, i) => (l.includes('INSERT INTO') ? [i + 1] : [])) },
    };
  }
  if (p.gorunum === 'ozet') {
    const lst = listing(LISTINGS, 'kod-7-7');
    return {
      ...tablolar(false),
      ...bos,
      code: { title: lst.title, lines: lst.lines, active: [] },
      ozet: {
        satirlar: JOIN_TURLERI,
        sayilar: [
          ['Kartezyen', calistir('kartezyen').satirlar.length],
          ['INNER JOIN', calistir('inner').satirlar.length],
          ['LEFT JOIN', calistir('left').satirlar.length],
        ],
      },
    };
  }

  const sorgu = SORGULAR[p.sorgu];
  const deger = Math.min(3, Math.max(1, Math.round(Number.isFinite(p.deger) ? p.deger : 3)));
  const sonuc = calistir(p.sorgu, deger);
  const n = sonuc.adimlar.length;
  const k = Math.max(0, Math.min(n, Math.trunc(p.cift) || 0));
  const parametreler = sorgu.parametreler ? [deger] : null;
  const sutunlar = sorgu.secim.map((s) => ({ ad: sonucAd(s) }));
  const tam = k === n;

  // Rows the JOIN produced, keyed by the step that produced them; WHERE-removed ones are told apart at the end.
  const uretilen = sonuc.adimlar.flatMap((a, i) => (a.eklenen ? [{ i, hucreler: a.eklenen }] : []));
  const kalan = sonuc.satirlar.map((r) => ({ r, key: '' }));
  const silinenler = new Set(uretilen.map((u) => u.i));
  for (const kr of kalan) {
    const u = uretilen.find((x) => silinenler.has(x.i) && ayni(x.hucreler, kr.r));
    if (u) {
      kr.key = `a${u.i}`;
      silinenler.delete(u.i);
    }
  }

  let satirlar: TabloSatiri[];
  if (tam) {
    satirlar = [
      ...kalan.map(({ r, key }): TabloSatiri => ({ key, cells: r as readonly Hucre[] })),
      ...uretilen.filter((u) => silinenler.has(u.i)).map((u): TabloSatiri => ({ key: `a${u.i}`, cells: u.hucreler as readonly Hucre[], state: 'silindi' })),
    ];
  } else {
    const ilk = uretilen.filter((u) => u.i < k);
    satirlar = ilk.map((u): TabloSatiri => ({
      key: `a${u.i}`,
      cells: u.hucreler as readonly Hucre[],
      ...(u.i === k - 1 ? { state: 'yeni' as const } : {}),
    }));
  }

  let kosul: KosulRozeti | null = null;
  let etkin: { y?: string; k?: string | null } | undefined;
  let aktif: 'on' | 'where' | 'yok' = 'yok';
  if (k > 0 && !tam) {
    const a = sonuc.adimlar[k - 1];
    etkin = { y: a.solKey, k: a.sagKey };
    kosul = adimRozeti(sorgu, a);
    aktif = 'on';
  } else if (tam) {
    const elenenAdimlar = uretilen.filter((u) => silinenler.has(u.i)).map((u) => sonuc.adimlar[u.i]);
    if (sorgu.where && elenenAdimlar.length > 0) {
      const rozetler = elenenAdimlar.map((a) => whereRozeti(sorgu.where!, { y: yazarOf(a.solKey), k: kitapOf(a.sagKey) }, parametreler ?? []));
      kosul = rozetler.find((r) => r.deger === null) ?? rozetler[0];
      aktif = 'where';
    } else {
      kosul = adimRozeti(sorgu, sonuc.adimlar[n - 1]);
      aktif = sorgu.where ? 'where' : 'on';
    }
  }

  const ikinci: DataTableSpec | null =
    tam && p.sorgu === 'where-tuzagi'
      ? {
          baslik: "Koşul ON'a taşınınca",
          sutunlar,
          satirlar: calistir('on-filtre').satirlar.map((r, i): TabloSatiri => ({ key: `o${i}`, cells: r as readonly Hucre[] })),
        }
      : null;

  return {
    ...tablolar(false, etkin),
    sonuc: { baslik: 'sonuç', sutunlar, satirlar },
    ikinci,
    kosul,
    code: codeOf(sorgu, aktif),
    parametreler,
    siraNotu: sonuc.sirasiz ? SIRA_NOTU : null,
    ozet: null,
  };
}

/** The source badge of the chosen query: the book's for book queries, the example one otherwise. */
export function sqlLabRozet(p: SqlParams): Rozet {
  const s = SORGULAR[p.sorgu];
  // Redundant today (parametreli is always kitaba-dayali); kept explicit so a changed $1 never reads as the book's own output.
  if (p.sorgu === 'parametreli' && p.deger !== 3) return { tur: 'kitaba-dayali', ref: s.ref };
  return { tur: s.kaynak, ...(s.ref ? { ref: s.ref } : {}) };
}
