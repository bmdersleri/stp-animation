import { lineOf, listing } from '../../core/listing';
import type { CheckListSpec } from '../../core/plot/check-list';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { HttpCardsSpec, HttpIstek, HttpYanit } from '../../core/plot/http-cards';
import type { Lane, Message, SequenceSpec } from '../../core/plot/sequence';
import type { Rozet } from '../../core/plot/source-badge';
import { LISTINGS } from './code-text';
import type { CorsParams } from './scenario';
import { API_KOKENI } from './sunucu';
import { calistir, KOKEN_URL } from './tarayici';

export interface CorsView {
  sequence: SequenceSpec;
  http: HttpCardsSpec;
  /** Checks of the last visible response; null while no response shows. */
  denetim: CheckListSpec | null;
  code: CodeTraceSpec;
  /** Origin of the page script and of the API server. Empty on the summary step (a book figure shows no computed value). */
  kokenler: { sayfa: string; api: string };
  aciklama: string | null;
  ozet: boolean;
}

/** The three lanes of a CORS call (R18: the order of the calls). */
export const CORS_LANES: Lane[] = [
  { id: 'betik', label: ['Sayfa betiği (köken)'] },
  { id: 'tarayici', label: ['Tarayıcı'] },
  { id: 'sunucu', label: ['API sunucusu'] },
];

const K4 = listing(LISTINGS, 'kod-11-4');
const K8 = listing(LISTINGS, 'code-008');
const K7 = listing(LISTINGS, 'kod-11-7');
const SATIR = {
  karar: lineOf(K4, 'if (!istekKokeni ||'),
  wildcard: lineOf(K8, '"Access-Control-Allow-Origin": "*"'),
  reddet: lineOf(K7, 'if (!izinVerilenKokenler.includes(kaynakKoken))'),
};
/** The lines Kod 11.7 prints (L1207-1208), without the `// Çıktı: ` prefix. */
const KOD7_CIKTILARI: readonly string[] = K7.lines.filter((s) => s.startsWith('// Çıktı: ')).map((s) => s.replace('// Çıktı: ', ''));

const CURL_NOTU = 'Kitap bu çağrıyı doğrudan fonksiyonla yapar (L1201-1206); burada aynı istek curl ile Origin başlığı verilerek gönderilir.';
const OKUMA_ENGELI = 'Tarayıcı yanıtı betiğe vermedi; sunucu isteği işledi.';
const OKUMA_ENGELI_ISLENMEDI = 'Tarayıcı yanıtı betiğe vermedi.';
const ASIL_YOK = 'Asıl istek hiç gönderilmedi.';
const COR_NOTU = 'preflight’ı `cors` paketi yanıtlar (L646)';

const kodSeridi = (l: { title: string; lines: readonly string[] }, active: readonly number[], notes?: Readonly<Record<number, string>>): CodeTraceSpec => ({
  title: l.title,
  lines: l.lines,
  active,
  ...(notes ? { notes } : {}),
});

function kodSeridiSec(p: CorsParams): CodeTraceSpec {
  if (p.asama !== 'akis') return kodSeridi(K4, []);
  switch (p.sunucu) {
    case 'wildcard':
      return kodSeridi(K8, [SATIR.wildcard]);
    case 'kitap-11-7':
      return kodSeridi(K7, [SATIR.reddet]);
    case 'cors-paketi':
      return kodSeridi(K4, [SATIR.karar], { [SATIR.karar]: COR_NOTU });
    default:
      return kodSeridi(K4, [SATIR.karar]);
  }
}

/** Lanes of the page: while curl calls, the first lane is named "curl" (the browser lane is dimmed by the caller). */
function seritler(curl: boolean): Lane[] {
  return curl ? [{ id: 'betik', label: ['curl'] }, ...CORS_LANES.slice(1)] : CORS_LANES;
}

const bosHttp: HttpCardsSpec = { yanitlar: [], terminal: [] };

/** Intro and summary views: the lanes and nothing computed. */
function bosGorunum(p: CorsParams): CorsView {
  const ozet = p.asama === 'ozet';
  return {
    sequence: { lanes: CORS_LANES, messages: [], ariaLabel: 'CORS sıra diyagramı' },
    http: bosHttp,
    denetim: null,
    code: kodSeridi(K4, []),
    kokenler: ozet ? { sayfa: '', api: '' } : { sayfa: KOKEN_URL[p.koken], api: API_KOKENI },
    aciklama: null,
    ozet,
  };
}

/**
 * Everything the scene draws for one parameter set; no DOM. `kitapCiktisi` true (the scene passes it while the step's own
 * badge shows) prints the lines Kod 11.7 prints (L1207-1208) for the book's two calls; otherwise the terminal shows the
 * lines the run computed for these params.
 */
export function deriveCorsView(p: CorsParams, kitapCiktisi = false): CorsView {
  if (p.asama !== 'akis') return bosGorunum(p);

  const iz = calistir(p);
  const curl = p.istemci !== 'tarayici';
  const gorunen = Math.min(Math.max(p.olay, 1), iz.olaylar.length);
  // Preflight arrows get their own (info) tone; a failed preflight response stays alarm.
  const olaylar: Message[] = iz.olaylar
    .slice(0, gorunen)
    .map((m) => (m.id === 'pre-istek' || (m.id === 'pre-yanit' && m.tone !== 'alarm') ? { ...m, tone: 'bilgi' as const } : m));
  const gorunur = (id: string): boolean => olaylar.some((m) => m.id === id);
  const tamami = gorunen === iz.olaylar.length;

  // Request card: the last visible request; responses: the visible ones (preflight is 1, the real one 2 when a preflight exists).
  let istek: HttpIstek | undefined;
  if (gorunur('pre-istek')) istek = iz.preflight!.istek;
  if (gorunur('istek')) istek = iz.asil!.istek;
  const yanitlar: HttpYanit[] = [];
  if (gorunur('pre-yanit')) yanitlar.push({ ...iz.preflight!.yanit, sira: 1 });
  if (gorunur('yanit')) yanitlar.push(iz.preflight ? { ...iz.asil!.yanit, sira: 2 } : iz.asil!.yanit);

  let denetim: CheckListSpec | null = null;
  if (gorunur('yanit')) denetim = { baslik: 'Tarayıcı denetimi (asıl yanıt)', denetimler: iz.asil!.denetimler };
  else if (gorunur('pre-yanit')) denetim = { baslik: 'Tarayıcı denetimi (preflight)', denetimler: iz.preflight!.denetimler };

  // While the book badge shows, Kod 11.7's own printed line (L1207 allowed origin, L1208 refused) replaces the model's line; otherwise the page's computed lines.
  const kitapSatiri = p.sunucu === 'kitap-11-7' && p.istemci === 'curl-origin' && p.istek === 'post-giris' ? KOD7_CIKTILARI[p.koken === 'kutuphane' ? 0 : p.koken === 'kotu' ? 1 : -1] : undefined;
  const terminal = yanitlar.length === 0 ? [] : kitapCiktisi && kitapSatiri !== undefined && iz.terminal.length > 0 ? [kitapSatiri] : iz.terminal;

  let aciklama: string | null = null;
  if (tamami && !iz.betik.okudu) aciklama = iz.asil ? (iz.sunucuIsledi ? OKUMA_ENGELI : OKUMA_ENGELI_ISLENMEDI) : ASIL_YOK;
  else if (p.istemci === 'curl-origin' && p.sunucu === 'kitap-11-7') aciklama = CURL_NOTU;

  const sonuc = olaylar.find((m) => m.id === 'sonuc');
  const sequence: SequenceSpec = {
    lanes: seritler(curl),
    messages: olaylar,
    active: olaylar[olaylar.length - 1].id,
    ...(curl ? { dim: ['tarayici'] } : {}),
    ...(sonuc ? (iz.betik.okudu ? { stopAt: 'betik', stopTone: 'ok' as const } : { stopAt: 'tarayici', stopTone: 'alarm' as const }) : {}),
    ariaLabel: 'CORS sıra diyagramı',
  };

  return {
    sequence,
    http: { ...(istek ? { istek } : {}), yanitlar, terminal: terminal.map((metin) => ({ metin })) },
    denetim,
    code: kodSeridiSec(p),
    kokenler: { sayfa: KOKEN_URL[p.koken], api: API_KOKENI },
    aciklama,
    ozet: false,
  };
}

/** Standard (Fetch) when a preflight ran for these params; otherwise the book's code on the reader's own input. */
export function corsLabRozet(p: CorsParams): Rozet {
  if (p.asama === 'akis' && calistir(p).preflight) return { tur: 'standart', ref: 'Fetch' };
  return { tur: 'kitap-kodu' };
}
