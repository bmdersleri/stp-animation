import type { Denetim } from '../../core/plot/check-list';
import { zincirle } from '../../core/plot/check-list';
import type { HttpIstek, HttpYanit } from '../../core/plot/http-cards';
import type { Message } from '../../core/plot/sequence';
import { DERS_SIMDI, payloadKur, tokenUret } from '../jwt-akisi/jwt';
import { API_KOKENI, sunucuYaniti, type SunucuTuru } from './sunucu';

export type Koken = 'kutuphane' | 'localhost' | 'kotu' | 'http-kutuphane' | 'ayni';
export const KOKEN_URL: Readonly<Record<Koken, string>> = {
  kutuphane: 'https://kutuphane.mehmetakif.edu.tr',
  localhost: 'http://localhost:5173',
  kotu: 'https://kotu-niyetli-site.com',
  'http-kutuphane': 'http://kutuphane.mehmetakif.edu.tr',
  ayni: API_KOKENI,
};

export type Istemci = 'tarayici' | 'curl' | 'curl-origin';
export type IstekTuru = 'get-kitaplar' | 'post-giris' | 'get-yetkili' | 'delete';
export interface CorsSenaryo {
  koken: Koken;
  istemci: Istemci;
  istek: IstekTuru;
  kimlik: 'include' | 'omit';
  sunucu: SunucuTuru;
}

interface Asama {
  istek: HttpIstek;
  yanit: HttpYanit;
  denetimler: Denetim[];
}
export interface CorsIzi {
  preflight?: Asama;
  asil?: Asama;
  betik: { okudu: boolean; metin: string };
  olaylar: Message[];
  sunucuIsledi: boolean;
  terminal: string[];
}

const HATA_METNI = 'TypeError: Failed to fetch';
const GUVENLI_METOTLAR = ['GET', 'HEAD', 'POST'];
const GUVENLI_ICERIK_TURLERI = ['text/plain', 'multipart/form-data', 'application/x-www-form-urlencoded'];
/** Request headers the browser sets itself or that the safelist allows: they never trigger a preflight. */
const TARAYICI_BASLIKLARI = ['origin', 'cookie', 'accept', 'accept-language', 'content-language'];
const GIRIS_GOVDESI = '{"kullaniciAdi":"elif","parola":"ogrenci-Parola1"}';

function baslikOku(liste: readonly [string, string][] | undefined, ad: string): string | undefined {
  return liste?.find(([k]) => k.toLowerCase() === ad.toLowerCase())?.[1];
}

/** Lowercase names of the headers that are not CORS-safelisted (content-type counts only when its value is unsafe). */
function guvensizBasliklar(istek: HttpIstek): string[] {
  const adlar: string[] = [];
  for (const [k, v] of istek.basliklar ?? []) {
    const ad = k.toLowerCase();
    if (TARAYICI_BASLIKLARI.includes(ad)) continue;
    if (ad === 'content-type' && GUVENLI_ICERIK_TURLERI.includes(v.split(';')[0].trim().toLowerCase())) continue;
    adlar.push(ad);
  }
  return adlar.sort();
}

/** Fetch rule 3: a method outside GET/HEAD/POST, or a header outside the safelist, needs a preflight. */
export function preflightGerekli(istek: HttpIstek): boolean {
  return !GUVENLI_METOTLAR.includes(istek.metot) || guvensizBasliklar(istek).length > 0;
}

function istekKur(s: CorsSenaryo): HttpIstek {
  const origin = KOKEN_URL[s.koken];
  const basliklar: [string, string][] = [];
  let metot: HttpIstek['metot'] = 'GET';
  let yol = '/api/kitaplar';
  let govde: string | undefined;
  if (s.istek === 'post-giris') {
    metot = 'POST';
    yol = '/api/giris';
    basliklar.push(['Content-Type', 'application/json']);
    govde = GIRIS_GOVDESI;
  } else if (s.istek === 'get-yetkili') {
    basliklar.push(['Authorization', `Bearer ${tokenUret(payloadKur('elif', DERS_SIMDI)).token}`]);
  } else if (s.istek === 'delete') {
    metot = 'DELETE';
    yol = '/api/kitaplar/1';
  }
  const tarayici = s.istemci === 'tarayici';
  // Browsers send Origin on cross-origin requests and on same-origin non-GET ones; curl only when told to.
  const originGider = tarayici ? s.koken !== 'ayni' || metot !== 'GET' : s.istemci === 'curl-origin';
  if (originGider) basliklar.unshift(['Origin', origin]);
  if (tarayici && s.kimlik === 'include') basliklar.push(['Cookie', 'oturum=…']);
  return { metot, kaynak: tarayici ? origin : 'curl', yol, basliklar, ...(govde ? { govde } : {}) };
}

function preflightIstegi(asil: HttpIstek, origin: string): HttpIstek {
  const adlar = guvensizBasliklar(asil);
  const basliklar: [string, string][] = [['Origin', origin], ['Access-Control-Request-Method', asil.metot]];
  if (adlar.length) basliklar.push(['Access-Control-Request-Headers', adlar.join(',')]);
  return { metot: 'OPTIONS', kaynak: origin, yol: asil.yol, basliklar };
}

const liste = (v: string | undefined): string[] => (v ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

function allowOrigin(yanit: HttpYanit, origin: string): Denetim {
  const v = baslikOku(yanit.basliklar, 'Access-Control-Allow-Origin');
  if (v === undefined) return { ad: 'Allow-Origin', durum: 'kaldi', ayrinti: 'başlık yok' };
  if (v === origin || v === '*') return { ad: 'Allow-Origin', durum: 'gecti', ayrinti: v };
  return { ad: 'Allow-Origin', durum: 'kaldi', ayrinti: `${v} ≠ ${origin}` };
}

function allowCredentials(yanit: HttpYanit, kimlik: 'include' | 'omit'): Denetim {
  if (kimlik === 'omit') return { ad: 'Allow-Credentials', durum: 'atlandi', ayrinti: 'kimlik bilgisi yok' };
  const v = baslikOku(yanit.basliklar, 'Access-Control-Allow-Credentials');
  if (v === undefined) return { ad: 'Allow-Credentials', durum: 'kaldi', ayrinti: 'başlık yok' };
  if (v !== 'true') return { ad: 'Allow-Credentials', durum: 'kaldi', ayrinti: `${v} ≠ true` };
  if (baslikOku(yanit.basliklar, 'Access-Control-Allow-Origin') === '*') {
    return { ad: 'Allow-Credentials', durum: 'kaldi', ayrinti: 'kimlik bilgisiyle Allow-Origin * olamaz' };
  }
  return { ad: 'Allow-Credentials', durum: 'gecti', ayrinti: 'true' };
}

function allowMethods(yanit: HttpYanit, metot: string, kimlik: 'include' | 'omit'): Denetim {
  if (GUVENLI_METOTLAR.includes(metot)) return { ad: 'Allow-Methods', durum: 'gecti', ayrinti: `${metot} güvenli metot` };
  const v = baslikOku(yanit.basliklar, 'Access-Control-Allow-Methods');
  if (v === undefined) return { ad: 'Allow-Methods', durum: 'kaldi', ayrinti: 'başlık yok' };
  const l = liste(v);
  if (l.includes(metot.toLowerCase()) || (kimlik === 'omit' && l.includes('*'))) return { ad: 'Allow-Methods', durum: 'gecti', ayrinti: v };
  return { ad: 'Allow-Methods', durum: 'kaldi', ayrinti: `${metot} listede yok` };
}

function allowHeaders(yanit: HttpYanit, istenen: string[], kimlik: 'include' | 'omit'): Denetim {
  if (istenen.length === 0) return { ad: 'Allow-Headers', durum: 'atlandi', ayrinti: 'istek başlığı yok' };
  const v = baslikOku(yanit.basliklar, 'Access-Control-Allow-Headers');
  if (v === undefined) return { ad: 'Allow-Headers', durum: 'kaldi', ayrinti: 'başlık yok' };
  const l = liste(v);
  const eksik = istenen.filter((a) => !(l.includes(a) || (kimlik === 'omit' && l.includes('*') && a !== 'authorization')));
  if (eksik.length === 0) return { ad: 'Allow-Headers', durum: 'gecti', ayrinti: v };
  return { ad: 'Allow-Headers', durum: 'kaldi', ayrinti: `${eksik.join(', ')} listede yok` };
}

/** Header the first failed check needed but the response lacks (the card lists it as `ad: yok`). */
const ISTENEN_BASLIK: Readonly<Record<string, string>> = {
  'Allow-Origin': 'Access-Control-Allow-Origin',
  'Allow-Credentials': 'Access-Control-Allow-Credentials',
  'Allow-Methods': 'Access-Control-Allow-Methods',
  'Allow-Headers': 'Access-Control-Allow-Headers',
};

function eksikIsaretle(yanit: HttpYanit, denetimler: readonly Denetim[]): HttpYanit {
  const kalan = denetimler.find((d) => d.durum === 'kaldi');
  const baslik = kalan && ISTENEN_BASLIK[kalan.ad];
  if (!baslik || baslikOku(yanit.basliklar, baslik) !== undefined) return yanit;
  return { ...yanit, eksikBasliklar: [baslik] };
}

function preflightDenetimleri(yanit: HttpYanit, origin: string, istek: HttpIstek, istenen: string[], kimlik: 'include' | 'omit'): Denetim[] {
  const ok = yanit.durumKodu >= 200 && yanit.durumKodu < 300;
  return zincirle([
    { ad: 'Durum 2xx', durum: ok ? 'gecti' : 'kaldi', ayrinti: `HTTP ${yanit.durumKodu}` },
    allowOrigin(yanit, origin),
    allowCredentials(yanit, kimlik),
    allowMethods(yanit, istek.metot, kimlik),
    allowHeaders(yanit, istenen, kimlik),
  ]);
}

function asilDenetimleri(yanit: HttpYanit, origin: string, kimlik: 'include' | 'omit'): Denetim[] {
  return zincirle([allowOrigin(yanit, origin), allowCredentials(yanit, kimlik)]);
}

function atlananlar(ayrinti: string, adlar: string[]): Denetim[] {
  return adlar.map((ad) => ({ ad, durum: 'atlandi' as const, ayrinti }));
}

function okunanMetin(yanit: HttpYanit): string {
  return `HTTP ${yanit.durumKodu}${yanit.govde ? ` · ${yanit.govde}` : ''}`;
}

export function calistir(s: CorsSenaryo): CorsIzi {
  const origin = KOKEN_URL[s.koken];
  const asilIstek = istekKur(s);
  const curl = s.istemci !== 'tarayici';
  const istekEtiketi = `${asilIstek.metot} ${asilIstek.yol}`;
  const olaylar: Message[] = [
    { id: 'fetch', from: 'betik', to: 'tarayici', label: curl ? `curl ${asilIstek.yol}` : `fetch(${asilIstek.yol})`, kind: 'request' },
  ];

  // Curl and same-origin requests skip the CORS checks entirely.
  if (curl || s.koken === 'ayni') {
    const gonder = sunucuYaniti(s.sunucu, asilIstek);
    const neden = curl ? 'curl CORS uygulamaz' : 'aynı köken: CORS denetimi yok';
    olaylar.push(
      { id: 'istek', from: 'tarayici', to: 'sunucu', label: istekEtiketi, kind: 'request' },
      { id: 'yanit', from: 'sunucu', to: 'tarayici', label: String(gonder.yanit.durumKodu), kind: 'response' },
      { id: 'sonuc', from: 'tarayici', to: 'betik', label: curl ? 'çıktı' : 'yanıt', kind: 'response', tone: 'ok' },
    );
    return {
      asil: { istek: asilIstek, yanit: gonder.yanit, denetimler: atlananlar(neden, ['Allow-Origin', 'Allow-Credentials']) },
      betik: { okudu: true, metin: okunanMetin(gonder.yanit) },
      olaylar,
      sunucuIsledi: gonder.isledi,
      terminal: gonder.terminal,
    };
  }

  const bloke = (sunucuIsledi: boolean, terminal: string[], izler: Pick<CorsIzi, 'preflight' | 'asil'>): CorsIzi => {
    olaylar.push({ id: 'sonuc', from: 'tarayici', to: 'betik', label: 'TypeError', kind: 'response', tone: 'alarm' });
    return { ...izler, betik: { okudu: false, metin: HATA_METNI }, olaylar, sunucuIsledi, terminal };
  };

  let preflight: Asama | undefined;
  if (preflightGerekli(asilIstek)) {
    const istek = preflightIstegi(asilIstek, origin);
    const g = sunucuYaniti(s.sunucu, istek);
    const istenen = guvensizBasliklar(asilIstek);
    const denetimler = preflightDenetimleri(g.yanit, origin, asilIstek, istenen, s.kimlik);
    const yanit = eksikIsaretle(g.yanit, denetimler);
    preflight = { istek, yanit, denetimler };
    const gecti = !denetimler.some((d) => d.durum === 'kaldi');
    olaylar.push(
      { id: 'pre-istek', from: 'tarayici', to: 'sunucu', label: `OPTIONS ${asilIstek.yol}`, kind: 'request' },
      { id: 'pre-yanit', from: 'sunucu', to: 'tarayici', label: String(yanit.durumKodu), kind: 'response', tone: gecti ? 'ok' : 'alarm' },
    );
    if (!gecti) return bloke(g.isledi, g.terminal, { preflight });
  }

  const g = sunucuYaniti(s.sunucu, asilIstek);
  const denetimler = asilDenetimleri(g.yanit, origin, s.kimlik);
  const yanit = eksikIsaretle(g.yanit, denetimler);
  const gecti = !denetimler.some((d) => d.durum === 'kaldi');
  olaylar.push(
    { id: 'istek', from: 'tarayici', to: 'sunucu', label: istekEtiketi, kind: 'request' },
    { id: 'yanit', from: 'sunucu', to: 'tarayici', label: String(yanit.durumKodu), kind: 'response', tone: gecti ? 'ok' : 'alarm' },
  );
  const asil: Asama = { istek: asilIstek, yanit, denetimler };
  if (!gecti) return bloke(g.isledi, g.terminal, { preflight, asil });
  olaylar.push({ id: 'sonuc', from: 'tarayici', to: 'betik', label: 'yanıt', kind: 'response', tone: 'ok' });
  return { preflight, asil, betik: { okudu: true, metin: okunanMetin(yanit) }, olaylar, sunucuIsledi: g.isledi, terminal: g.terminal };
}
