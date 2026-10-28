import { listing, type Listing } from '../../core/listing';
import type { CheckListSpec } from '../../core/plot/check-list';
import type { CodeTraceSpec } from '../../core/plot/code-trace';
import type { DataTableSpec } from '../../core/plot/data-table';
import type { HttpCardsSpec, HttpYanit } from '../../core/plot/http-cards';
import type { KitapBlok } from '../../core/plot/kitap-blok';
import type { Message, SequenceSpec } from '../../core/plot/sequence';
import type { Rozet } from '../../core/plot/source-badge';
import { LISTINGS } from './code-text';
import {
  BEKLEME_TABANI_MS,
  HIZLI_MS,
  YAVAS_MS,
  kitapCagrilari173,
  kitapCagrilari175,
  ozetiAl,
  type Davranis,
  type IstekOlayi,
} from './istek';
import type { Senaryo, TimeoutParams } from './scenario';

/** One attempt on the time axis. `kesik`: the bar runs past the axis edge; `sonsuz`: it never ends (step 2). */
export interface Cubuk {
  deneme: number;
  bas: number;
  son: number;
  uc: 'iptal' | 'yanit' | 'kesik' | 'sonsuz';
}
/** The wait between two attempts. */
export interface Bosluk {
  bas: number;
  son: number;
  etiket: string;
}
export interface ZamanSpec {
  cubuklar: readonly Cubuk[];
  bosluklar: readonly Bosluk[];
  /** The vertical timeout line; null where no timeout is set. */
  zamanAsimiMs: number | null;
  /** P1: 10 000 to 30 000 ms. Bars and gaps never pass it; the total label states the real total. */
  eksenMs: number;
  toplamEtiket: string | null;
}
export interface TimeoutView {
  /** The book block of the intro and summary steps; null on every other step. */
  kitap: KitapBlok | null;
  zaman: ZamanSpec | null;
  sequence: SequenceSpec | null;
  kartlar: HttpCardsSpec;
  denetim: CheckListSpec | null;
  hataTablosu: DataTableSpec | null;
  /** Book sentences and the page's own sentences (`SAYFA_NOTLARI`), in reading order. */
  notlar: readonly string[];
  uyari: string | null;
  code: CodeTraceSpec;
}

const L = (id: string): Listing => listing(LISTINGS, id);
const K2 = L('code-002');
const K6 = L('code-006');
const K173 = L('kod-17-3');
const K175 = L('kod-17-5');

/** Index (1-based, within the listing) of book line `satir`. */
const kitapSatiri = (l: Listing, satir: number): number => satir - l.satirlar[0] + 1;
const kodSeridi = (l: Listing, kitapSatirlari: readonly number[]): CodeTraceSpec =>
  ({ title: l.title, lines: l.lines, active: kitapSatirlari.map((s) => kitapSatiri(l, s)) });

const MIN_EKSEN_MS = 10_000;
const MAKS_EKSEN_MS = 30_000;

/** The book's sentences, verbatim without code ticks, bold marks and emoji (final.md line in the comment). */
const TANIM = "Timeout, bir AI servisinden belirli bir süre içinde yanıt gelmezse isteğin iptal edilmesidir. Retry, geçici bir hatada isteğin sınırlı sayıda tekrar denenmesidir. Hata izolasyonu ise AI servisinin tamamen kullanılamaz hâle gelmesi durumunda, bu durumun backend'in diğer işlevlerini (kitap arama, ödünç alma) etkilememesidir."; // L316
const NEDEN_VARDIR = "Neden vardır? Bu üç mekanizma vardır çünkü AI servisleri, sıradan REST API'lerden daha değişken gecikme ve daha yüksek geçici hata oranına sahiptir. Timeout olmadan bir kullanıcı isteği süresiz bekleyebilir; retry olmadan geçici bir yükleme gecikmesi kalıcı bir hataya dönüşür; hata izolasyonu olmadan ise AI servisindeki bir sorun, ilgisiz özelliklerin de çalışmamasına yol açar."; // L318
const NASIL_KULLANILIR = 'Nasıl kullanılır? Aşağıdaki örnek, dayanıklılık zincirinin iki halkasını kodlar: AbortController ile zaman aşımı ve AI servisi kullanılamadığında özet olmadan devam eden hata izolasyonu. Örnek, hatayı GeciciAiHatasi ve KaliciAiHatasi olarak ayırır; bu ayrım, yeniden denemenin yalnızca geçici hatalarda anlamlı olduğu için gereklidir.'; // L337
const FINALLY_NOTU = 'Dikkat noktası: finally { clearTimeout(zamanlayici); } olmasaydı, istek zamanında tamamlansa bile zamanlayıcı çalışmaya devam eder ve gereksiz yere bellekte asılı kalırdı; bu yüzden zamanlayıcının temizlenmesi hem başarılı hem hata yolunda çalışan finally bloğuna konmuştur.'; // L419
const AGRESIF_RETRY_NOTU = "Yaygın hatalar. En yaygın hata, retry mantığını AI servisi için de Bölüm 12'deki gibi agresif biçimde (çok sayıda deneme, kısa bekleme) uygulamaktır; bir dil modeli zaten yavaşken art arda retry göndermek, servisin yükünü daha da artırabilir."; // L448, first two sentences
const KAPSAM_NOTU = 'Bu üç halkanın hangisinin kodlandığını ayırt etmek önemlidir. Bölümün kod örnekleri zaman aşımını, geçici/kalıcı hata ayrımını, hata izolasyonunu ve çıktı doğrulamasını çalışır biçimde gösterir. Sınırlı retry ve önbellek ise yalnızca Şekil 17.2\'de akış düzeyinde gösterilir; kodlanmaları "Bu programı geliştirin" görevlerine bırakılmıştır. Circuit breaker ve fallback cache desenleri karşılaştırma tablosunda tanıtılır, bu bölümde uygulanmaz. Model eğitimi ve LLM ince ayarı (fine-tuning) ayrıntıları da kapsam dışıdır.'; // L806

/** The page's own sentences (R29, R30, R31), never attributed to the book; the scene styles them apart. */
export const SINYAL_NOTU = 'Kitabın örnek çağrıları sinyali kullanmaz; bu adımın servisi sinyali dinler.';
export const RETRY_NOTU = 'Kod 17.3/17.5 tek deneme yapar (L339); yeniden deneme bu sayfanın uzantısıdır';
export const VARSAYIM_NOTU = `sayfa varsayımı: bekleme tabanı ${BEKLEME_TABANI_MS} ms, yavaş servis ${YAVAS_MS} ms, hızlı servis ${HIZLI_MS} ms`;
export const SAYFA_NOTLARI: readonly string[] = [SINYAL_NOTU, RETRY_NOTU, VARSAYIM_NOTU];

const UYARI = "bekleme yok: code_006'nın deseni (L448)";
const OZET_VAR = '200 OK (özet var)';
const OZET_YOK = '200 OK (özet yok, temel veri korunur)';

const ALTERNATIFLER: DataTableSpec = {
  baslik: 'Alternatifler', // L438
  sutunlar: ['Yaklaşım', 'Avantajı', 'Dezavantajı', 'Uygun kullanım'].map((ad) => ({ ad })), // L440
  satirlar: [ // L442-446
    { key: 'timeout-null', cells: ["Timeout + null'a düşme (Kod 17.3'te kodlanan)", 'Ana işlevi AI servisinden bağımsız korur; en az kod gerektirir', 'Geçici bir hatada bile özet üretilemez', 'İsteğe bağlı AI zenginleştirmeleri (özet, öneri)'] },
    { key: 'timeout-retry-null', cells: ["Timeout + sınırlı retry + null'a düşme (Şekil 17.2'de gösterilen, alıştırmada geliştirilen)", 'Geçici hatalara bir şans daha tanır', 'Ek gecikme ve yük getirir; yalnızca GeciciAiHatasi için uygulanmalıdır', 'Geçici hatanın sık görüldüğü AI servisleri'] },
    { key: 'circuit-breaker', cells: ['Circuit breaker (devre kesici) deseni', 'Sürekli başarısız olan servise istek göndermeyi geçici olarak durdurur', 'Ek durum yönetimi ve eşik ayarı gerektirir', 'Yüksek trafikli, sık çağrılan AI servisleri'] },
    { key: 'fallback-cache', cells: ['Önceden hesaplanmış sonuçları önbellekten sunma (fallback cache)', 'AI servisi tamamen kullanılamaz olsa bile eski ama makul bir sonuç gösterilebilir', 'Önbellekteki sonuç güncel olmayabilir', 'Değişimi yavaş olan içerikler (örn. bir kitabın özeti nadiren değişir)'] },
    { key: 'tek-deneme', cells: ['Retry olmadan tek deneme', 'En basit yaklaşım', 'Geçici, kısa süreli sorunlarda bile hemen başarısız olur', 'Çok düşük öncelikli, kritik olmayan çağrılar'] },
  ],
};

const HATA_TURLERI: DataTableSpec = {
  baslik: 'Hata türleri',
  sutunlar: [{ ad: 'gelen hata' }, { ad: 'dönüşen tür' }],
  satirlar: [
    { key: 'abort', cells: ['AbortError', 'GeciciAiHatasi'] },
    { key: 'http-500', cells: ['AI servisi hata döndürdü: 500', 'KaliciAiHatasi'] },
  ],
};

const TANITIM_BLOK: KitapBlok = { tanim: TANIM, paragraflar: [NEDEN_VARDIR], tablolar: [], notlar: [] };
const OZET_BLOK: KitapBlok = { tablolar: [ALTERNATIFLER], notlar: [KAPSAM_NOTU] };

/** The service's answers per attempt (the last one repeats): `hizli` 1200 ms, `yavas` the slow leg, `gecici` slow then fast. */
export function davranislar(senaryo: Senaryo, servisGecikmesiMs: number): Davranis[] {
  switch (senaryo) {
    case 'hizli': return [{ gecikmeMs: HIZLI_MS, sonuc: 'ok' }];
    case 'yavas': return [{ gecikmeMs: servisGecikmesiMs, sonuc: 'ok' }];
    case 'gecici': return [{ gecikmeMs: servisGecikmesiMs, sonuc: 'ok' }, { gecikmeMs: HIZLI_MS, sonuc: 'ok' }];
    default: return [{ gecikmeMs: HIZLI_MS, sonuc: senaryo }];
  }
}

const BOS_KARTLAR: HttpCardsSpec = { yanitlar: [], terminal: [] };
const terminalSatirlari = (metinler: readonly string[]): HttpCardsSpec['terminal'] => metinler.map((metin) => ({ metin }));

const bos = (code: CodeTraceSpec, kitap: KitapBlok | null = null): TimeoutView => ({
  kitap, zaman: null, sequence: null, kartlar: BOS_KARTLAR, denetim: null, hataTablosu: null, notlar: [], uyari: null, code,
});

type Sonuc = 'iptal' | 'http-500' | 'gecersiz' | 'basari';

/** How the last attempt ended, read from the model's events. */
function sonuclan(olaylar: readonly IstekOlayi[]): Sonuc {
  const son = [...olaylar].reverse().find((o) => o.tur !== 'temizle' && o.tur !== 'sonuc')!;
  if (son.tur === 'iptal') return 'iptal';
  if (son.tur === 'dogrulama') return son.metin === 'geçerli' ? 'basari' : 'gecersiz';
  return son.metin === 'http-500' ? 'http-500' : 'basari';
}

/** P1: attempts and waits drawn on the axis; what passes the edge is cut there (`kesik`), what starts beyond it is left out. */
function zamanKur(p: TimeoutParams, olaylar: readonly IstekOlayi[], bitisMs: number): ZamanSpec {
  const eksenMs = Math.min(MAKS_EKSEN_MS, Math.max(MIN_EKSEN_MS, bitisMs));
  const cubuklar: Cubuk[] = [];
  const bosluklar: Bosluk[] = [];
  const baslangic = (deneme: number): number => olaylar.find((o) => o.tur === 'istek' && o.deneme === deneme)!.t;
  for (const o of olaylar) {
    if (o.tur === 'istek') {
      const bitis = olaylar.find((e) => (e.tur === 'iptal' || e.tur === 'yanit') && e.deneme === o.deneme)!;
      if (o.t >= eksenMs) continue;
      cubuklar.push(bitis.t > eksenMs ? { deneme: o.deneme, bas: o.t, son: eksenMs, uc: 'kesik' } : { deneme: o.deneme, bas: o.t, son: bitis.t, uc: bitis.tur === 'iptal' ? 'iptal' : 'yanit' });
    } else if (o.tur === 'bekle') {
      if (o.t >= eksenMs) continue;
      bosluklar.push({ bas: o.t, son: Math.min(eksenMs, baslangic(o.deneme + 1)), etiket: `bekle ${o.metin}` });
    }
  }
  return { cubuklar, bosluklar, zamanAsimiMs: p.zamanAsimiMs, eksenMs, toplamEtiket: `toplam ${bitisMs} ms` };
}

/** Every attempt is `api -> servis`; the service answers or does not (the alarm); 17.5 ends with the answer to the client (P4). */
function siraKur(p: TimeoutParams, olaylar: readonly IstekOlayi[], ozet: string | null, ders: boolean): SequenceSpec {
  const messages: Message[] = [];
  for (const o of olaylar) {
    if (o.tur === 'istek') messages.push({ id: `istek-${o.deneme}`, from: 'api', to: 'servis', label: 'POST /predict', kind: 'request' });
    else if (o.tur === 'iptal') messages.push({ id: `iptal-${o.deneme}`, from: 'servis', to: 'api', label: 'yanıt gelmedi', kind: 'response', tone: 'alarm' });
    else if (o.tur === 'yanit') {
      const hata = o.metin === 'http-500';
      messages.push({ id: `yanit-${o.deneme}`, from: 'servis', to: 'api', label: hata ? '500' : '200', kind: 'response', tone: hata ? 'alarm' : 'ok' });
    }
  }
  // spec: in Ders the closing arrow belongs to step 8 (no summary); Lab always draws it
  if (p.surum === '17.5' && (!ders || ozet === null)) {
    messages.push({ id: 'istemci-yaniti', from: 'api', to: 'istemci', label: ozet === null ? OZET_YOK : OZET_VAR, kind: 'response', tone: ozet === null ? 'bilgi' : 'ok' });
  }
  return {
    lanes: [
      { id: 'istemci', label: ['İstemci'] },
      { id: 'api', label: ['Node.js API'] },
      { id: 'servis', label: ['FastAPI çıkarım servisi'] },
    ],
    messages,
    ariaLabel: 'Zaman aşımı ve yeniden deneme sıra diyagramı',
  };
}

/**
 * The listing that runs comes first: Kod 17.3 (steps 3 and 4, also in Lab mode before any change) or Kod 17.5. Ders: the
 * table's focus (code_006 where retries run out). Lab: the line that decided the result.
 */
function akisKodu(p: TimeoutParams, olaylar: readonly IstekOlayi[], ders: boolean): CodeTraceSpec {
  const sonuc = sonuclan(olaylar);
  const iptalli = olaylar.some((o) => o.tur === 'iptal');
  if (p.surum === '17.3') {
    if (sonuc === 'iptal') return kodSeridi(K173, ders ? [365, 369, 370] : [369, 370]);
    if (sonuc === 'http-500') return kodSeridi(K173, [372]);
    return kodSeridi(K173, ders ? [374] : [367]);
  }
  if (ders && sonuc === 'iptal' && p.maksRetry > 0) return kodSeridi(K6, [461, 465]);
  if (ders && iptalli) return kodSeridi(K175, [724, 725]);
  switch (sonuc) {
    case 'iptal': return kodSeridi(K175, [724, 725]);
    case 'gecersiz': return kodSeridi(K175, [744, 745]);
    case 'http-500': return kodSeridi(K175, [727, 740]);
    case 'basari': return kodSeridi(K175, [749]);
  }
}

function akisNotlari(p: TimeoutParams, sonuc: Sonuc): string[] {
  if (p.surum === '17.3') {
    if (p.senaryo === 'yavas') return [SINYAL_NOTU];
    if (p.senaryo === 'hizli') return [FINALLY_NOTU];
    return [];
  }
  return [RETRY_NOTU, VARSAYIM_NOTU, ...(sonuc === 'iptal' && p.maksRetry > 0 ? [AGRESIF_RETRY_NOTU] : [])];
}

function akisGorunumu(p: TimeoutParams, ders: boolean): TimeoutView {
  const r = ozetiAl(davranislar(p.senaryo, p.servisGecikmesiMs), p);
  const yanit: HttpYanit = { durumKodu: 200, govde: r.ozet === null ? 'özet yok' : `özet: ${r.ozet}` };
  return {
    ...bos(akisKodu(p, r.olaylar, ders)),
    zaman: zamanKur(p, r.olaylar, r.bitisMs),
    sequence: siraKur(p, r.olaylar, r.ozet, ders),
    kartlar: { yanitlar: [yanit], terminal: terminalSatirlari(r.konsol) },
    notlar: akisNotlari(p, sonuclan(r.olaylar)),
    uyari: p.beklemeTabanMs === 0 && r.olaylar.filter((o) => o.tur === 'istek').length >= 3 ? UYARI : null,
  };
}

/** Step 2 (code_002): the request has no timeout, so the bar never ends. */
function zamansizGorunumu(): TimeoutView {
  const zaman: ZamanSpec = { cubuklar: [{ deneme: 1, bas: 0, son: MIN_EKSEN_MS, uc: 'sonsuz' }], bosluklar: [], zamanAsimiMs: null, eksenMs: MIN_EKSEN_MS, toplamEtiket: null };
  return { ...bos(kodSeridi(K2, [175])), zaman };
}

/** Step 6: Kod 17.3 maps the caught error to a type; the console is its `http-500` run. */
function hataTurleriGorunumu(): TimeoutView {
  const r = ozetiAl(davranislar('http-500', 0), { surum: '17.3', zamanAsimiMs: 5000, maksRetry: 0, beklemeTabanMs: 0 });
  return {
    ...bos(kodSeridi(K173, [369, 370, 371, 372])),
    hataTablosu: HATA_TURLERI,
    kartlar: { yanitlar: [], terminal: terminalSatirlari(r.konsol) },
    notlar: [NASIL_KULLANILIR],
  };
}

/** Steps 5 and 9: the book's own example calls; their output is the book's, shown only while a Ders badge shows. */
function kitapCagrilariGorunumu(surum: TimeoutParams['surum'], kitapCiktisi: boolean): TimeoutView {
  const cikti = surum === '17.3' ? kitapCagrilari173 : kitapCagrilari175;
  const gorunum: TimeoutView = {
    ...bos(surum === '17.3' ? kodSeridi(K173, [384, 385, 386]) : kodSeridi(K175, [744, 745])),
    kartlar: { yanitlar: [{ durumKodu: 200 }], terminal: kitapCiktisi ? terminalSatirlari(cikti()) : [] },
  };
  if (surum === '17.3') return gorunum;
  return {
    ...gorunum,
    denetim: {
      baslik: 'Kod 17.5 çağrıları',
      denetimler: [
        { ad: 'Zaman aşımı', durum: 'gecti', ayrinti: 'ikinci çağrı: yanıt zamanında geldi' },
        { ad: 'Doğrulama', durum: 'kaldi', ayrinti: 'ikinci çağrı: özet boş' },
      ],
    },
  };
}

/** Everything the scene draws for one parameter set; no DOM. `kitapCiktisi` is true in Ders and false in Lab. */
export function deriveTimeoutView(p: TimeoutParams, kitapCiktisi = false): TimeoutView {
  switch (p.asama) {
    case 'tanitim': return bos(kodSeridi(K173, []), TANITIM_BLOK);
    case 'ozet': return bos(kodSeridi(K173, []), OZET_BLOK);
    case 'zamansiz': return zamansizGorunumu();
    case 'akis': return akisGorunumu(p, kitapCiktisi);
    case 'izolasyon': return kitapCagrilariGorunumu('17.3', kitapCiktisi);
    case 'dogrulama': return kitapCagrilariGorunumu('17.5', kitapCiktisi);
    case 'hata-turleri': return hataTurleriGorunumu();
  }
}

/** The book's code on the reader's own settings; a second attempt is the page's extension, so it rests on the book's sentence. */
export function timeoutLabRozet(p: TimeoutParams): Rozet {
  const r = ozetiAl(davranislar(p.senaryo, p.servisGecikmesiMs), p);
  return { tur: r.olaylar.some((o) => o.tur === 'istek' && o.deneme > 1) ? 'kitaba-dayali' : 'kitap-kodu' };
}
