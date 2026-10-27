import type { KaynakTuru } from '../../core/plot/source-badge';
import { KITABA_DAYALI, LISTINGS } from './code-text';

export type SorguId = 'kartezyen' | 'inner' | 'left' | 'is-null' | 'where-tuzagi' | 'on-filtre' | 'parametreli';
export const SORGU_IDS: readonly SorguId[] = [
  'kartezyen', 'inner', 'left', 'is-null', 'where-tuzagi', 'on-filtre', 'parametreli',
];

export type Deger = string | number | null;
export type Sutun = 'y.yazar_id' | 'y.ad_soyad' | 'k.kitap_adi' | 'k.yazar_id';
export interface Kosul { sutun: Sutun; op: '=' | '<>' | 'IS NULL'; deger?: Deger | '$1' }

export interface YazarSatiri { key: string; yazar_id: number; ad_soyad: string }
export interface KitapSatiri { key: string; kitap_adi: string; yazar_id: number }

export const YAZARLAR: readonly YazarSatiri[] = [
  { key: 'y1', yazar_id: 1, ad_soyad: 'Yaşar Kemal' },
  { key: 'y2', yazar_id: 2, ad_soyad: 'Adalet Ağaoğlu' },
  { key: 'y3', yazar_id: 3, ad_soyad: 'Bilge Karasu' },
];
export const KITAPLAR: readonly KitapSatiri[] = [
  { key: 'k1', kitap_adi: 'İnce Memed', yazar_id: 1 },
  { key: 'k2', kitap_adi: 'Ölmeye Yatmak', yazar_id: 2 },
];

export interface Sorgu {
  id: SorguId;
  sql: readonly string[];
  tur: 'kartezyen' | 'inner' | 'left';
  ekOn?: Kosul;
  where?: Kosul;
  orderBy?: 'ad_soyad';
  secim: readonly Sutun[];
  parametreler?: readonly Deger[];
  kaynak: KaynakTuru;
  ref?: string;
}

export interface CiftAdimi {
  solKey: string;
  sagKey: string | null;
  on: boolean | null;
  /** The `secim` values of the row this step added to the result (absent when none, or when WHERE removed it). */
  eklenen?: readonly Deger[];
}
export interface SorguSonucu {
  adimlar: CiftAdimi[];
  satirlar: Deger[][];
  /** Rows that passed ON but were removed by WHERE. */
  elenen: Deger[][];
  sirasiz: boolean;
}

/** Three-valued `=`: NULL on either side gives unknown (null). */
export function esit(a: Deger, b: Deger): boolean | null {
  if (a === null || b === null) return null;
  return a === b;
}
/** Three-valued `<>`. */
function farkli(a: Deger, b: Deger): boolean | null {
  const e = esit(a, b);
  return e === null ? null : !e;
}
/** Three-valued AND: false dominates, then unknown. */
export function ve(a: boolean | null, b: boolean | null): boolean | null {
  if (a === false || b === false) return false;
  if (a === null || b === null) return null;
  return true;
}

export interface SatirCifti { y: YazarSatiri; k: KitapSatiri | null }

function sutunDegeri(s: Sutun, c: SatirCifti): Deger {
  switch (s) {
    case 'y.yazar_id': return c.y.yazar_id;
    case 'y.ad_soyad': return c.y.ad_soyad;
    case 'k.kitap_adi': return c.k ? c.k.kitap_adi : null;
    case 'k.yazar_id': return c.k ? c.k.yazar_id : null;
  }
}

/** Evaluate a condition on a row pair; `$1` is bound from `parametreler`, never from the query text. */
export function kosulDegeri(k: Kosul, c: SatirCifti, parametreler: readonly Deger[] = []): boolean | null {
  const sol = sutunDegeri(k.sutun, c);
  if (k.op === 'IS NULL') return sol === null;
  const sag: Deger = k.deger === '$1' ? (parametreler[0] ?? null) : (k.deger ?? null);
  return k.op === '=' ? esit(sol, sag) : farkli(sol, sag);
}

const lines = (id: string): readonly string[] => LISTINGS.find((l) => l.id === id)!.lines;
const kod77 = lines('kod-7-7');
const code015 = lines('code-015');
const AD_KITAP: readonly Sutun[] = ['y.ad_soyad', 'k.kitap_adi'];
const INCE_MEMED_DEGIL: Kosul = { sutun: 'k.kitap_adi', op: '<>', deger: 'İnce Memed' };

export const SORGULAR: Readonly<Record<SorguId, Sorgu>> = {
  kartezyen: { id: 'kartezyen', sql: code015.slice(4, 6), tur: 'kartezyen', secim: AD_KITAP, kaynak: 'kitap', ref: 'L877-882' },
  inner: { id: 'inner', sql: kod77.slice(4, 8), tur: 'inner', secim: AD_KITAP, kaynak: 'kitap', ref: 'L777-780' },
  left: { id: 'left', sql: kod77.slice(9, 14), tur: 'left', orderBy: 'ad_soyad', secim: AD_KITAP, kaynak: 'kitap', ref: 'L782-786' },
  'is-null': {
    id: 'is-null', sql: KITABA_DAYALI['is-null'], tur: 'left',
    where: { sutun: 'k.yazar_id', op: 'IS NULL' }, secim: ['y.ad_soyad'], kaynak: 'kitaba-dayali', ref: 'L1936-1938',
  },
  'where-tuzagi': {
    id: 'where-tuzagi', sql: KITABA_DAYALI['where-tuzagi'], tur: 'left',
    where: INCE_MEMED_DEGIL, orderBy: 'ad_soyad', secim: AD_KITAP, kaynak: 'kitaba-dayali', ref: 'L920',
  },
  'on-filtre': {
    id: 'on-filtre', sql: KITABA_DAYALI['on-filtre'], tur: 'left',
    ekOn: INCE_MEMED_DEGIL, orderBy: 'ad_soyad', secim: AD_KITAP, kaynak: 'kitaba-dayali', ref: 'L920',
  },
  parametreli: {
    id: 'parametreli', sql: KITABA_DAYALI.parametreli, tur: 'left',
    where: { sutun: 'y.yazar_id', op: '=', deger: '$1' }, secim: AD_KITAP,
    parametreler: [3], kaynak: 'kitaba-dayali', ref: 'L1686-1691',
  },
};

/** Runs a ready-made query as a nested loop; `deger` (clamped to 1..3, default 3) is the bound `$1`. */
export function calistir(id: SorguId, deger = 3): SorguSonucu {
  const sorgu = SORGULAR[id];
  const d = Math.min(3, Math.max(1, Math.round(Number.isFinite(deger) ? deger : 3)));
  const parametreler: readonly Deger[] | undefined = sorgu.parametreler ? [d] : undefined;
  const adimlar: CiftAdimi[] = [];
  const gelen: Deger[][] = [];
  const elenen: Deger[][] = [];

  const ekle = (c: SatirCifti, adim: CiftAdimi): void => {
    const secim = sorgu.secim.map((s) => sutunDegeri(s, c));
    if (sorgu.where && kosulDegeri(sorgu.where, c, parametreler) !== true) {
      elenen.push(secim);
    } else {
      gelen.push(secim);
      adim.eklenen = secim;
    }
  };

  for (const y of YAZARLAR) {
    let eslesen = false;
    for (const k of KITAPLAR) {
      const c: SatirCifti = { y, k };
      let on: boolean | null = true;
      if (sorgu.tur !== 'kartezyen') {
        on = esit(k.yazar_id, y.yazar_id);
        if (sorgu.ekOn) on = ve(on, kosulDegeri(sorgu.ekOn, c));
      }
      const adim: CiftAdimi = { solKey: y.key, sagKey: k.key, on };
      adimlar.push(adim);
      if (on === true) {
        eslesen = true;
        ekle(c, adim);
      }
    }
    if (sorgu.tur === 'left' && !eslesen) {
      const adim: CiftAdimi = { solKey: y.key, sagKey: null, on: null };
      adimlar.push(adim);
      ekle({ y, k: null }, adim);
    }
  }

  const satirlar = sorgu.orderBy
    ? [...gelen].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'tr'))
    : gelen;
  return { adimlar, satirlar, elenen, sirasiz: !sorgu.orderBy && satirlar.length > 1 };
}
