import { b64urlCoz } from '../../core/kripto';
import { lineOf, listing } from '../../core/listing';
import { nodeInspect } from '../../core/node-inspect';
import type { CheckListSpec } from '../../core/plot/check-list';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { TerminalSatir } from '../../core/plot/http-cards';
import { farkIndeksleri, type Parca, type SegmentStripSpec } from '../../core/plot/segment-strip';
import type { SequenceSpec } from '../../core/plot/sequence';
import type { Rozet } from '../../core/plot/source-badge';
import { LISTINGS } from './code-text';
import { bozukToken, DERS_SIMDI, tokenDogrula, type Bozulma } from './jwt';
import type { JwtAsama, JwtParams } from './scenario';

export interface JwtView {
  token: SegmentStripSpec | null;
  /** "Gelen imza" and "beklenen imza" strips once the signature check ran (dogrula); else empty. */
  imzalar: readonly SegmentStripSpec[];
  /** Pretty JSON text of the decoded header; null when not shown. */
  header: string | null;
  /** Pretty JSON text of the decoded payload (the code_006 body on `okunur`); null when not shown. */
  payload: string | null;
  denetim: CheckListSpec | null;
  terminal: readonly TerminalSatir[];
  code: CodeTraceSpec;
  sequence: SequenceSpec | null;
}

const KOD = listing(LISTINGS, 'kod-10-3');
const KOD_CIKTI = listing(LISTINGS, 'kod-10-3-cikti');
const KOD_OKU = listing(LISTINGS, 'code-006');
const KOD_OKU_CIKTI = listing(LISTINGS, 'code-006-cikti');
const SATIR = {
  header: lineOf(KOD, 'const header = base64UrlKodla'),
  payload: lineOf(KOD, 'const govde = base64UrlKodla'),
  imza: lineOf(KOD, 'const imza = imzaOlustur'),
  oku: lineOf(KOD_OKU, 'console.log(Buffer.from(govde'),
};

/** The book's output (L512-515) accumulates over the Ders steps that run the page's own call: how many lines per Bozulma. */
const KITAP_CIKTI: Partial<Record<Bozulma, number>> = { yok: 1, 'imza-bozuk': 2, 'sure-alani-yok': 3, 'fazla-segment': 4 };

const SEQUENCE: SequenceSpec = {
  lanes: [
    { id: 'istemci', label: ['İstemci'] },
    { id: 'sunucu', label: ['Sunucu'] },
  ],
  messages: [
    { id: 'giris', from: 'istemci', to: 'sunucu', label: 'POST /giris (kullaniciAdi, parola)', kind: 'request' },
    { id: 'token', from: 'sunucu', to: 'istemci', label: 'token', kind: 'response' },
    { id: 'korumali', from: 'istemci', to: 'sunucu', label: 'GET /korumali + Authorization: Bearer token', kind: 'request' },
    { id: 'denetim', from: 'sunucu', to: 'sunucu', label: 'imza + süre denetimi', kind: 'note' },
    { id: 'yanit', from: 'sunucu', to: 'istemci', label: '200', kind: 'response', tone: 'ok' },
  ],
  ariaLabel: 'JWT akışı sıra diyagramı',
};

/** Decoded base64url part as 2-space JSON; the raw decoded text when it is not JSON, the part itself when it is not base64url. */
function cozulmus(parca: string): string {
  let metin: string;
  try {
    metin = b64urlCoz(parca);
  } catch {
    return parca;
  }
  try {
    return JSON.stringify(JSON.parse(metin), null, 2);
  } catch {
    return metin;
  }
}

/** Stages that show no computed token (a book-only view or the diagram). */
const hesapsiz = (a: JwtAsama): boolean => a === 'tanitim' || a === 'okunur' || a === 'akis';

function kodSeridi(p: JwtParams, satir: number): CodeTraceSpec {
  if (p.asama === 'okunur') return { title: KOD_OKU.title, lines: KOD_OKU.lines, active: [SATIR.oku] };
  const active =
    p.asama === 'header' ? [SATIR.header]
    : p.asama === 'payload' ? [SATIR.payload]
    : p.asama === 'imza' ? [SATIR.imza]
    : p.asama === 'dogrula' ? [satir]
    : [];
  return { title: KOD.title, lines: KOD.lines, active };
}

/** `kitapCiktisi` true (the scene passes it while a book step's own badge shows) prints the book's accumulated L512-515 output; otherwise only the line of the call that ran. */
export function deriveJwtView(p: JwtParams, kitapCiktisi = false): JwtView {
  const bos: Omit<JwtView, 'code'> = { token: null, imzalar: [], header: null, payload: null, denetim: null, terminal: [], sequence: null };

  if (p.asama === 'okunur') {
    return { ...bos, payload: KOD_OKU_CIKTI.lines[0], terminal: [{ metin: KOD_OKU_CIKTI.lines[0] }], code: kodSeridi(p, 0) };
  }
  if (hesapsiz(p.asama)) {
    return { ...bos, sequence: p.asama === 'akis' ? SEQUENCE : null, code: kodSeridi(p, 0) };
  }

  const token = bozukToken(p.kullanici, p.bozulma, DERS_SIMDI);
  const parcalar = token.split('.');
  const iz = tokenDogrula(token, DERS_SIMDI + p.dakika * 60000);
  const [h, g, i] = parcalar;

  const gorunen: Parca[] = [{ metin: h, etiket: 'header', ton: 0 }];
  if (p.asama !== 'header') gorunen.push({ metin: g, etiket: 'govde', ton: 1 });
  if (p.asama !== 'header' && p.asama !== 'payload') {
    gorunen.push({ metin: i, etiket: 'imza', ton: 2 });
    if (parcalar.length > 3) gorunen.push({ metin: parcalar.slice(3).join('.'), etiket: 'fazladan', ton: 3 });
  }
  const view: JwtView = {
    ...bos,
    token: { baslik: 'Token', parcalar: gorunen, ayirici: '.' },
    header: cozulmus(h),
    payload: p.asama === 'header' ? null : cozulmus(g),
    code: kodSeridi(p, iz.satir),
  };
  if (p.asama !== 'dogrula') return view;

  const beklenen = iz.beklenenImza;
  if (beklenen !== undefined) {
    view.imzalar = [
      { baslik: 'Gelen imza', parcalar: [{ metin: i, ton: 2, fark: farkIndeksleri(i, beklenen) }] },
      { baslik: 'Beklenen imza', parcalar: [{ metin: beklenen, ton: 2, fark: farkIndeksleri(beklenen, i) }] },
    ];
  }
  view.denetim = { baslik: 'Doğrulama denetimleri', denetimler: iz.denetimler };

  const kitapSatiri = KITAP_CIKTI[p.bozulma];
  if (kitapCiktisi && p.kullanici === 'elif' && p.dakika === 0 && kitapSatiri !== undefined) {
    view.terminal = KOD_CIKTI.lines.slice(0, kitapSatiri).map((metin) => ({ metin }));
  } else if ('payload' in iz.sonuc) {
    view.terminal = [{ metin: nodeInspect(iz.sonuc.payload) }];
  } else {
    view.terminal = [{ metin: iz.sonuc.hata, ...(iz.sonuc.yakalanmamis ? { akis: 'stderr' as const } : {}) }];
  }
  return view;
}

/** The Lab always runs the book's code on the reader's own input. */
export function jwtLabRozet(_p: JwtParams): Rozet {
  return { tur: 'kitap-kodu' };
}
