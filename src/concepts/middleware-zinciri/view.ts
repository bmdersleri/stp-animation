import { listing } from '../../core/listing';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import { DURUM_METNI, type HttpCardsSpec, type HttpYanit, type TerminalSatir } from '../../core/plot/http-cards';
import type { Lane, Message, SequenceSpec } from '../../core/plot/sequence';
import type { Rozet } from '../../core/plot/source-badge';
import { kod010, kod017, kod55 } from './apps';
import { HATA_ORNEGI, LISTINGS } from './code-text';
import { dispatch, HEADERS_SENT, VARSAYILAN, type Istek, type Iz, type Katman } from './express-sim';
import type { MwParams } from './scenario';

export interface OzetSatiri { katman: string; ne: string; sonuc: string }
export interface MwView {
  sequence: SequenceSpec;
  http: HttpCardsSpec;
  code: CodeTraceSpec;
  iz: Iz;
  /** Lines of code_011's output, shown beside the hanging run of code_010; null elsewhere. */
  karsilastirma: readonly string[] | null;
  ozet: readonly OzetSatiri[] | null;
}

const ANAHTAR_DEGERI = { gecerli: 'kitap-api-2026', yanlis: 'yanlis-anahtar' } as const;
const ISTEMCI = 'istemci';

/** The summary table of the book's layers (step 11). */
const OZET: readonly OzetSatiri[] = [
  { katman: 'express.json()', ne: 'JSON gövdeyi ayrıştırır', sonuc: 'next()' },
  { katman: 'istekGunlugu', ne: 'metodu ve yolu yazar', sonuc: 'next()' },
  { katman: 'apiAnahtariKontrolu', ne: 'x-api-anahtari başlığını denetler', sonuc: 'geçerliyse next(), değilse 401 yanıtı' },
  { katman: 'Route işleyicisi', ne: 'yanıtı üretir', sonuc: '200 yanıtı' },
  { katman: "Hata middleware'i", ne: 'hatayı yakalar', sonuc: '500 yanıtı' },
];

function app(p: MwParams): Katman[] {
  if (p.program === 'next-unutma') return kod010();
  if (p.program === 'cift-yanit') return kod017();
  return kod55(p);
}

function istek(p: MwParams): Istek {
  const basliklar: Record<string, string> = {};
  if (p.anahtar !== 'yok') basliklar['x-api-anahtari'] = ANAHTAR_DEGERI[p.anahtar];
  const yol = p.program === 'next-unutma' ? '/kitaplar' : p.program === 'cift-yanit' ? '/kitaplar/99' : p.yol;
  return { metot: 'GET', yol, basliklar };
}

/** The program's app run against the request built from `p`. */
export function mwIz(p: MwParams): Iz {
  return dispatch(app(p), istek(p));
}

function seritler(p: MwParams): Lane[] {
  const istemci: Lane = { id: ISTEMCI, label: ['İstemci'] };
  if (p.program === 'next-unutma') {
    return [
      istemci,
      { id: 'gunluk', label: ['hataliGunluk'] },
      { id: 'isleyici', label: ['Route işleyicisi'], sub: 'GET /kitaplar' },
    ];
  }
  if (p.program === 'cift-yanit') return [istemci, { id: 'isleyici', label: ['Route işleyicisi'], sub: 'GET /kitaplar/99' }];
  if (p.yol === '/hata-ornegi') {
    return [
      istemci,
      { id: 'json', label: ['express.json()'] },
      { id: 'gunluk', label: ['istekGunlugu'] },
      { id: 'hataRoute', label: ['GET /hata-ornegi'] },
      { id: 'hataMw', label: ["Hata middleware'i"] },
    ];
  }
  return [
    istemci,
    { id: 'json', label: ['express.json()'] },
    { id: 'gunluk', label: ['istekGunlugu'] },
    { id: 'anahtar', label: ['apiAnahtariKontrolu'], ...(p.kontrolGenel ? { sub: 'use' } : {}) },
    { id: 'isleyici', label: ['Route işleyicisi'], sub: 'GET /korumali-durum' },
  ];
}

function listingOf(p: MwParams) {
  if (p.program === 'next-unutma') return listing(LISTINGS, 'code-010');
  if (p.program === 'cift-yanit') return listing(LISTINGS, 'code-017');
  return p.yol === '/hata-ornegi' ? HATA_ORNEGI : listing(LISTINGS, 'kod-5-5');
}

const durumEtiketi = (kod: number): string => `${kod} ${DURUM_METNI[kod] ?? ''}`.trim();
const ikiYuz = (kod: number): boolean => kod >= 200 && kod < 300;

/** Everything the scene draws for one parameter set; no DOM. */
export function deriveMwView(params: MwParams): MwView {
  const ozet = params.gorunum === 'ozet';
  // The summary view always shows the complete 200 trace of the book's Kod 5.5.
  const p: MwParams = ozet
    ? { ...params, program: 'kod-5-5', yol: '/korumali-durum', anahtar: 'gecerli', gunlukNext: true, kontrolGenel: false, hataKatmani: true }
    : params;
  const iz = mwIz(p);
  const toplam = iz.olaylar.length;
  const olay = ozet ? toplam : Math.max(0, Math.min(toplam, Math.trunc(p.olay) || 0));
  const tamam = olay === toplam;
  const gorunen = iz.olaylar.slice(0, olay);

  const lanes = seritler(p);
  const gorunur = new Set(lanes.map((l) => l.id));
  const req = istek(p);

  // The final handler has no lane of its own: it is drawn on the lane that ran last.
  const serit = (i: number): string => {
    const o = iz.olaylar[i];
    if (o.katman !== VARSAYILAN) return o.katman;
    for (let j = i - 1; j >= 0; j--) {
      const e = iz.olaylar[j];
      if (e.tur !== 'atla' && e.katman !== VARSAYILAN && gorunur.has(e.katman)) return e.katman;
    }
    return lanes[1].id;
  };
  const stderr = (i: number): boolean => iz.terminal.some((t) => t.olay === i && t.akis === 'stderr');

  const messages: Message[] = [];
  let onceki = ISTEMCI;
  let hataSonrasi = false;
  let yanitSerit: string | undefined;
  let yanitKodu: number | undefined;
  let askidaSerit: string | undefined;
  gorunen.forEach((o, i) => {
    const id = serit(i);
    if (!gorunur.has(id)) return;
    const mid = `m${i}`;
    if (o.tur === 'gir') {
      messages.push({
        id: mid,
        from: onceki,
        to: id,
        label: messages.length === 0 ? `${req.metot} ${req.yol}` : hataSonrasi ? 'next(err)' : 'next()',
        kind: 'request',
      });
      onceki = id;
      hataSonrasi = false;
    } else if (o.tur === 'log') {
      messages.push({ id: mid, from: id, to: id, label: o.metin ?? '', kind: 'note', ...(stderr(i) ? { tone: 'alarm' as const } : {}) });
    } else if (o.tur === 'hata') {
      const etiket = o.metin === HEADERS_SENT ? 'ERR_HTTP_HEADERS_SENT' : `throw: ${o.metin ?? ''}`;
      messages.push({ id: mid, from: id, to: id, label: etiket, kind: 'note', tone: 'alarm' });
      hataSonrasi = true;
    } else if (o.tur === 'yanit') {
      const kod = iz.yanit?.durumKodu ?? 0;
      messages.push({ id: mid, from: id, to: ISTEMCI, label: durumEtiketi(kod), kind: 'response', tone: ikiYuz(kod) ? 'ok' : 'alarm' });
      yanitSerit = id;
      yanitKodu = kod;
    } else if (o.tur === 'askida') {
      messages.push({ id: mid, from: id, to: id, label: 'yanıt yok', kind: 'note', tone: 'alarm' });
      askidaSerit = id;
    }
  });

  // A sent response ends dispatch, so lanes that never got a 'gir' event stay faded once the trace is complete.
  const girenler = new Set(iz.olaylar.filter((o) => o.tur === 'gir').map((o) => o.katman));
  const dim = tamam ? lanes.filter((l) => l.id !== ISTEMCI && !girenler.has(l.id)).map((l) => l.id) : [];
  const durak = yanitSerit ?? askidaSerit;
  const sequence: SequenceSpec = {
    lanes,
    messages,
    ...(messages.length > 0 ? { active: messages[messages.length - 1].id } : {}),
    ...(durak ? { stopAt: durak, stopTone: yanitKodu !== undefined && ikiYuz(yanitKodu) ? ('ok' as const) : ('alarm' as const) } : {}),
    ariaLabel: 'Middleware zinciri sıra diyagramı',
    dim,
  };

  const yanitlar: HttpYanit[] = [];
  const yanitOlayi = gorunen.some((o) => o.tur === 'yanit');
  if (yanitOlayi && iz.yanit) {
    yanitlar.push({ durumKodu: iz.yanit.durumKodu, durumMetni: DURUM_METNI[iz.yanit.durumKodu], govde: iz.yanit.govde });
  } else if (gorunen.some((o) => o.tur === 'askida')) {
    yanitlar.push({ durumKodu: 0, askida: true });
  }
  const terminal: TerminalSatir[] = iz.terminal.filter((t) => t.olay < olay).map((t) => ({ metin: t.metin, akis: t.akis }));
  const nextUnutma = p.program === 'next-unutma' && tamam;
  if (nextUnutma) terminal.push({ metin: 'zincir surdu mu: false', akis: 'stdout' });
  const basliklar = Object.entries(req.basliklar) as [string, string][];
  const http: HttpCardsSpec = {
    ...(olay > 0 ? { istek: { metot: req.metot, yol: req.yol, ...(basliklar.length > 0 ? { basliklar } : {}) } } : {}),
    yanitlar,
    terminal,
  };

  // Highlight the last shown event's line, but only when its lane belongs to the listing on screen.
  const kodSeritleri = new Set(p.program === 'kod-5-5' && p.yol === '/hata-ornegi' ? ['hataRoute', 'hataMw'] : lanes.map((l) => l.id));
  const son = gorunen[gorunen.length - 1];
  const aktif = son && son.satir > 0 && kodSeritleri.has(son.katman) ? [son.satir] : [];
  const lst = listingOf(p);

  return {
    sequence,
    http,
    code: { title: lst.title, lines: lst.lines, active: aktif },
    iz,
    karsilastirma: nextUnutma ? listing(LISTINGS, 'code-011-cikti').lines : null,
    ozet: ozet ? OZET : null,
  };
}

/** The source badge a Lab-changed parameter set earns (the first matching rule wins). */
export function mwLabRozet(p: MwParams): Rozet {
  if (p.yol === '/hata-ornegi') return { tur: 'kitaba-dayali', ref: 'L1814-1818' };
  if (p.yol === '/baska') return { tur: 'kitaba-dayali', ref: 'L558' };
  if (p.kontrolGenel) return { tur: 'kitaba-dayali', ref: 'L674' };
  if (!p.gunlukNext) return { tur: 'kitaba-dayali', ref: 'L1189' };
  if (p.anahtar !== 'gecerli') return { tur: 'kitap', ref: 'L668' };
  return { tur: 'kitap-kodu' };
}
