import { lineOf, listing } from '../../core/listing';
import { nodeInspect } from '../../core/node-inspect';
import type { CheckListSpec, Denetim } from '../../core/plot/check-list';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { DataTableSpec, TabloSatiri } from '../../core/plot/data-table';
import type { TerminalSatir } from '../../core/plot/http-cards';
import type { Rozet } from '../../core/plot/source-badge';
import { LISTINGS } from './code-text';
import { desenIstekleri, loginOynat, oynat, type Istek, type IstekSonucu } from './desenler';
import { DAL_SATIRI, type Dal } from './limiter';
import { ELLE_SINIRI, type RateParams } from './scenario';

export interface Nokta { t: number; ip: string; izin: boolean; yigin: number; etkin: boolean }
export interface Bant { ip: string; bas: number; son: number }
export interface TimelineSpec { noktalar: readonly Nokta[]; bantlar: readonly Bant[]; xMax: number; ipler: readonly string[] }

export interface RateView {
  timeline: TimelineSpec;
  tablo: DataTableSpec;
  terminal: readonly TerminalSatir[];
  /** Checks of the last visible login call; null for every other pattern. */
  denetim: CheckListSpec | null;
  code: CodeTraceSpec;
  ozet: boolean;
}

const K5 = listing(LISTINGS, 'kod-11-5');
const K5_CIKTI = listing(LISTINGS, 'kod-11-5-cikti').lines;
const K7 = listing(LISTINGS, 'kod-11-7');
/** The lines Kod 11.7 prints (L1207-1208), without the `// Çıktı: ` prefix. */
const K7_CIKTI: readonly string[] = K7.lines.filter((s) => s.startsWith('// Çıktı: ')).map((s) => s.replace('// Çıktı: ', ''));

const TABLO_BASLIK = 'Sınırlayıcı kayıtları';
const TABLO_SUTUNLARI: DataTableSpec['sutunlar'] = [{ ad: 'anahtar' }, { ad: 'sayac' }, { ad: 'pencereBaslangici' }];

const kodSeridi = (l: { title: string; lines: readonly string[] }, active: readonly number[]): CodeTraceSpec => ({ title: l.title, lines: l.lines, active });

/** "t = 0 s" (R11): a window start shows as seconds. */
const saniye = (ms: number): string => `t = ${String(ms / 1000).replace('.', ',')} s`;

/** Intro and summary views: the empty timeline, table, terminal and check list, and a code strip with no active line. */
function bosGorunum(ozet: boolean, kod: CodeTraceSpec = kodSeridi(K5, [])): RateView {
  return {
    timeline: { noktalar: [], bantlar: [], xMax: 0, ipler: [] },
    tablo: { baslik: TABLO_BASLIK, sutunlar: TABLO_SUTUNLARI, satirlar: [] },
    terminal: [],
    denetim: null,
    code: kod,
    ozet,
  };
}

/** The request results of one pattern; `login` has fixed limiter settings (3, 60 s) and carries the check lists. */
type Sonuc = Omit<IstekSonucu, 'dal' | 'izin'> & { dal?: Dal; denetimler?: Denetim[]; satir?: number };

function sonuclariBul(p: RateParams): { sonuclar: Sonuc[]; pencereMs: number } {
  if (p.desen === 'login') return { sonuclar: loginOynat().sonuclar, pencereMs: 60_000 };
  const pencereMs = p.pencereSn * 1000;
  const istekler: Istek[] = p.desen === 'elle'
    ? [...p.elle].slice(0, ELLE_SINIRI).sort((a, b) => a.t - b.t)
    : desenIstekleri(p.desen);
  return { sonuclar: oynat(istekler, p.maksimumIstek, pencereMs), pencereMs };
}

/** The limiter's verdict. A call refused by CORS (403) never reached the limiter (`dal` absent), so it is not allowed either. */
const izinli = (s: Sonuc): boolean => s.dal !== undefined && s.dal !== 'sinirda';

/**
 * Everything the scene draws for one parameter set; no DOM. `kitapCiktisi` true (the scene passes it while the step's own
 * badge shows) prints the lines the book prints (Kod 11.5 L756-760 for the `kitap` pattern with 3 requests per 60 s; Kod 11.7
 * L1207-1208 for the `login` pattern); otherwise the terminal shows the lines the run computed, in the same format.
 */
export function deriveRateView(p: RateParams, kitapCiktisi = false): RateView {
  if (p.asama === 'tanitim') return bosGorunum(false);
  if (p.asama === 'ozet') return bosGorunum(true);

  const login = p.desen === 'login';
  const { sonuclar, pencereMs } = sonuclariBul(p);
  const gorunen = Math.min(Math.max(p.istek, 1), sonuclar.length);
  const gorunur: readonly Sonuc[] = sonuclar.slice(0, gorunen);
  if (gorunur.length === 0) return bosGorunum(false);
  const son = gorunur[gorunur.length - 1];

  // Dots: the same (ip, t) stack vertically, 0, 1, 2...
  const sayilar = new Map<string, number>();
  const noktalar: Nokta[] = gorunur.map((s, i) => {
    const anahtar = `${s.ip}|${s.t}`;
    const yigin = sayilar.get(anahtar) ?? 0;
    sayilar.set(anahtar, yigin + 1);
    return { t: s.t, ip: s.ip, izin: izinli(s), yigin, etkin: i === gorunur.length - 1 };
  });

  // Bands: a window opens at every request that took the new-window branch; CORS-refused calls open none.
  const bantlar: Bant[] = gorunur.filter((s) => s.dal === 'yeni-pencere').map((s) => ({ ip: s.ip, bas: s.t, son: s.t + pencereMs }));
  const ipler = [...new Set(gorunur.map((s) => s.ip))];
  const xMax = Math.max(...sonuclar.map((s) => s.t)) + pencereMs;

  // Table: the limiter's record per key after the visible requests; a CORS-refused call changes nothing.
  const kayit = new Map<string, { sayac: number; pencereBaslangici: number }>();
  let onceki: { sayac: number; pencereBaslangici: number } | undefined;
  for (const [i, s] of gorunur.entries()) {
    if (s.dal === undefined) continue;
    if (i === gorunur.length - 1) onceki = kayit.get(s.ip);
    kayit.set(s.ip, { sayac: s.sayac, pencereBaslangici: s.pencereBaslangici });
  }
  const satirlar: TabloSatiri[] = [...kayit].map(([ip, k]) => {
    const satir: TabloSatiri = { key: ip, cells: [ip, k.sayac, saniye(k.pencereBaslangici)] };
    if (son.dal === undefined || son.ip !== ip) return satir;
    if (!onceki) return { ...satir, state: 'yeni' };
    const changed = [...(onceki.sayac !== k.sayac ? [1] : []), ...(onceki.pencereBaslangici !== k.pencereBaslangici ? [2] : [])];
    return changed.length > 0 ? { ...satir, state: 'degisti', changed } : satir;
  });

  // Terminal: Kod 11.5 format for the Deneme n lines; nodeInspect of the response for each login call.
  const kitapCagrisi = p.desen === 'kitap' && p.maksimumIstek === 3 && p.pencereSn === 60;
  let metinler: string[];
  if (login) {
    metinler = gorunur.map((s, i) => (kitapCiktisi && i < K7_CIKTI.length ? K7_CIKTI[i] : nodeInspect({ durumKodu: s.durumKodu, mesaj: s.mesaj })));
  } else {
    metinler = gorunur.map((s, i) => (kitapCiktisi && kitapCagrisi && i < K5_CIKTI.length ? K5_CIKTI[i] : `Deneme ${i + 1}: ${izinli(s) ? 'kabul edildi' : '429 Too Many Requests'}`));
  }

  const denetim: CheckListSpec | null = login && son.denetimler ? { baslik: 'Denetim zinciri', denetimler: son.denetimler } : null;
  const code: CodeTraceSpec = login
    ? kodSeridi(K7, [son.satir!])
    : kodSeridi(K5, [DAL_SATIRI[son.dal as Dal]]);

  return {
    timeline: { noktalar, bantlar, xMax: Math.max(xMax, pencereMs), ipler },
    tablo: { baslik: TABLO_BASLIK, sutunlar: TABLO_SUTUNLARI, satirlar },
    terminal: metinler.map((metin) => ({ metin })),
    denetim,
    code,
    ozet: false,
  };
}

/** Always the book's code on the reader's own requests. */
export function rateLabRozet(_p: RateParams): Rozet {
  return { tur: 'kitap-kodu' };
}
