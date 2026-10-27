import { listing } from '../../core/listing';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { DataTableSpec, TabloSatiri } from '../../core/plot/data-table';
import type { HttpCardsSpec, HttpYanit, TerminalSatir } from '../../core/plot/http-cards';
import type { Lane, Message, SequenceSpec } from '../../core/plot/sequence';
import type { Rozet } from '../../core/plot/source-badge';
import {
  calistirSira,
  idemTerminal,
  IDEM_BASLANGIC,
  type Gonderim,
  type IdemDurum,
  type LabDurum,
  type ProgramId,
} from './api';
import { LISTINGS } from './code-text';
import type { IstekId } from './rota';
import { REST_ROZET, restScenario, type RestParams } from './scenario';

export interface RestView {
  sequence: SequenceSpec;
  http: HttpCardsSpec;
  tablo: DataTableSpec | null;
  code: CodeTraceSpec;
  /** Summary tables of the book (step 10); null elsewhere. */
  ozet: { metotlar: readonly (readonly string[])[]; basarilar: readonly string[] } | null;
  sira: readonly IstekId[];
}

/** The four lanes of the book's Sekil 6.5 (the service lane's subtitle names the lab program, see `seritler`). */
export const REST_LANES: Lane[] = [
  { id: 'istemci', label: ['İstemci'] },
  { id: 'rota', label: ['Rota katmanı'] },
  { id: 'servis', label: ['Servis'], sub: 'LaboratuvarApi' },
  { id: 'veri', label: ['Veri kaynağı'], sub: 'bellek içi liste' },
];

const seritler = (program: ProgramId): Lane[] =>
  REST_LANES.map((l) => (l.id === 'servis' && program === 'idempotentlik' ? { ...l, sub: 'Idempotentlik.ts' } : { ...l }));

/** The requests sent in order: the earlier ones, then the Lab request `tekrar` times. */
export function restSira(p: RestParams): IstekId[] {
  return [...p.onceki, ...Array<IstekId>(p.tekrar).fill(p.istek)];
}

/** The book's method table (L531-535) without its header; backticks dropped. */
const METOTLAR: readonly (readonly string[])[] = [
  ['GET', 'Evet', 'Evet', 'Kaynak yeniden okunur; durum değişmez'],
  ['PUT', 'Hayır', 'Evet', 'Aynı tam temsil yeniden yazılır; son durum aynıdır'],
  ['DELETE', 'Hayır', 'Evet', 'Kaynak zaten silinmiştir; yanıt 404 olabilir'],
  ['PATCH', 'Hayır', 'Garanti edilmez', 'Gövdenin anlamına bağlıdır: mutlak atama mı, göreli değişiklik mi?'],
  ['POST', 'Hayır', 'Hayır', 'Her çağrı yeni bir kaynak oluşturabilir'],
];

/** The six `belgeSatirlari` strings of Kod 6.5, read from the listing. */
function belgeSatirlari(): string[] {
  const lines = listing(LISTINGS, 'kod-6-5').lines;
  const bas = lines.findIndex((s) => s.startsWith('const belgeSatirlari'));
  const son = lines.findIndex((s, i) => i > bas && s.startsWith(']'));
  return lines.slice(bas + 1, son).map((s) => s.trim().replace(/^"/, '').replace(/",?$/, ''));
}

const ikiYuz = (kod: number): boolean => kod >= 200 && kod < 300;

function labTablo(g: number, durumlar: readonly (LabDurum | IdemDurum)[], gon: Gonderim): DataTableSpec {
  const durum = durumlar[g - 1] as LabDurum;
  const kod = gon.yanit?.durumKodu ?? 0;
  const etkin = new Set<number>();
  if (kod === 200 && gon.istek?.metot === 'GET') {
    if (gon.istekId === 'get-1') etkin.add(1);
    else if (gon.istekId === 'get-liste-1-2') durum.ekipmanListesi.slice(0, 2).forEach((e) => etkin.add(e.kimlik));
  }
  const yeniKimlik = gon.istekId === 'post-santrifuj' && kod === 201 ? durum.sonrakiKimlik - 1 : -1;
  const degisen = gon.istekId === 'patch-1-rezerve' && kod === 200 ? 1 : -1;
  const satirlar: TabloSatiri[] = durum.ekipmanListesi.map((e) => ({
    key: String(e.kimlik),
    cells: [e.kimlik, e.ad, e.durum],
    ...(e.kimlik === yeniKimlik
      ? { state: 'yeni' as const }
      : e.kimlik === degisen
        ? { state: 'degisti' as const, changed: [2] }
        : etkin.has(e.kimlik)
          ? { state: 'etkin' as const }
          : {}),
  }));
  return {
    baslik: 'ekipmanListesi',
    sutunlar: [{ ad: 'kimlik', anahtar: 'PK' }, { ad: 'ad' }, { ad: 'durum' }],
    satirlar,
  };
}

function idemTablo(g: number, durumlar: readonly (LabDurum | IdemDurum)[], gon: Gonderim): DataTableSpec {
  const durum = durumlar[g - 1] as IdemDurum;
  const onceki = g > 1 ? (durumlar[g - 2] as IdemDurum) : IDEM_BASLANGIC;
  if (gon.istekId === 'stok-ayarla-5' || gon.istekId === 'stok-artir-1') {
    const degisti = durum.stok !== onceki.stok;
    return {
      baslik: 'stok',
      sutunlar: [{ ad: 'ürün' }, { ad: 'miktar' }],
      satirlar: [{ key: 'mikroskop', cells: ['mikroskop', durum.stok], ...(degisti ? { state: 'degisti' as const, changed: [1] } : {}) }],
    };
  }
  if (gon.istekId === 'delete-12') {
    const satirlar: TabloSatiri[] = durum.ekipmanlar.map(([k, ad]) => ({ key: String(k), cells: [k, ad] }));
    for (const [k, ad] of onceki.ekipmanlar) {
      if (!durum.ekipmanlar.some(([x]) => x === k)) satirlar.push({ key: String(k), cells: [k, ad], state: 'silindi' });
    }
    return { baslik: 'ekipmanlar', sutunlar: [{ ad: 'kimlik', anahtar: 'PK' }, { ad: 'ad' }], satirlar };
  }
  return {
    baslik: 'rezervasyonlar',
    sutunlar: [{ ad: 'kimlik', anahtar: 'PK' }, { ad: 'ekipmanKimligi' }, { ad: 'ogrenci' }],
    satirlar: durum.rezervasyonlar.map((r, i) => ({
      key: String(r.kimlik),
      cells: [r.kimlik, r.ekipmanKimligi, r.ogrenci],
      ...(i >= onceki.rezervasyonlar.length ? { state: 'yeni' as const } : {}),
    })),
    not: 'islenmisAnahtarlar: rzv-7f3a',
  };
}

/** Everything the scene draws for one parameter set; no DOM. */
export function deriveRestView(p: RestParams): RestView {
  const sira = restSira(p);
  const lanes = seritler(p.program);

  if (p.gorunum === 'tanitim') {
    const cikti = listing(LISTINGS, 'kod-6-1-cikti').lines;
    const lst = listing(LISTINGS, 'kod-6-1');
    return {
      sequence: { lanes, messages: [], ariaLabel: 'REST isteği sıra diyagramı' },
      http: { yanitlar: [], terminal: cikti.map((metin): TerminalSatir => ({ metin })) },
      tablo: null,
      code: { title: lst.title, lines: lst.lines, active: [] },
      ozet: null,
      sira,
    };
  }

  if (p.gorunum === 'ozet') {
    const lst = listing(LISTINGS, 'kod-6-5');
    return {
      sequence: { lanes, messages: [], ariaLabel: 'REST isteği sıra diyagramı' },
      http: { yanitlar: [], terminal: [] },
      tablo: null,
      code: { title: lst.title, lines: lst.lines, active: [] },
      ozet: { metotlar: METOTLAR, basarilar: belgeSatirlari() },
      sira,
    };
  }

  const { durumlar, gonderimler } = calistirSira(p.program, sira);
  const g = Math.max(1, Math.min(sira.length, Math.trunc(p.gonderim) || 1));
  const gon = gonderimler[g - 1];

  const messages: Message[] = gon.olaylar;
  const kod = gon.yanit?.durumKodu;
  const sequence: SequenceSpec = {
    lanes,
    messages,
    ...(messages.length > 0 ? { active: messages[messages.length - 1].id } : {}),
    stopAt: gon.istek ? 'istemci' : 'servis',
    stopTone: kod === undefined || ikiYuz(kod) ? 'ok' : 'alarm',
    ariaLabel: 'REST isteği sıra diyagramı',
  };

  const yanitlar: HttpYanit[] = [];
  gonderimler.slice(0, g).forEach((x) => {
    if (x.yanit) yanitlar.push({ ...x.yanit, sira: yanitlar.length + 1 });
  });
  const terminalMetni = p.program === 'laboratuvar-api' ? gon.cikti : idemTerminal(sira.slice(0, g), gonderimler.slice(0, g));
  const http: HttpCardsSpec = {
    ...(gon.istek ? { istek: gon.istek } : {}),
    yanitlar: yanitlar.slice(-3),
    terminal: terminalMetni.map((metin): TerminalSatir => ({ metin })),
  };

  const lst = listing(LISTINGS, p.program);
  return {
    sequence,
    http,
    tablo: p.program === 'laboratuvar-api' ? labTablo(g, durumlar, gon) : idemTablo(g, durumlar, gon),
    code: { title: lst.title, lines: lst.lines, active: gon.satirlar },
    ozet: null,
    sira,
  };
}

/** The source badge a Lab-changed parameter set earns: the badge of the book step it equals, else `kitap-kodu`. */
export function restLabRozet(p: RestParams): Rozet {
  const sec = (x: RestParams): string => JSON.stringify([x.program, x.onceki, x.istek, x.tekrar]);
  const adim = restScenario.steps.find((s) => s.params?.gorunum === 'akis' && sec({ ...restScenario.defaults, ...s.params }) === sec(p));
  return adim ? REST_ROZET[adim.id] : { tur: 'kitap-kodu' };
}
