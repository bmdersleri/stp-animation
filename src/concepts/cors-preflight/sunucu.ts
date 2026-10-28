import { nodeInspect } from '../../core/node-inspect';
import type { HttpIstek, HttpYanit } from '../../core/plot/http-cards';

export const API_KOKENI = 'https://api.kutuphane.mehmetakif.edu.tr';

/** Kod 11.4 L582-583. */
export const izinVerilenKokenler: readonly string[] = ['https://kutuphane.mehmetakif.edu.tr', 'http://localhost:5173'];

/** Kod 11.7's own list (L1112): one origin, unlike Kod 11.4's two. */
const KOD_11_7_KOKENLERI: readonly string[] = ['https://kutuphane.mehmetakif.edu.tr'];

type CorsBasligi = { 'Access-Control-Allow-Origin': string; 'Access-Control-Allow-Credentials': string };

/** Kod 11.4, L591-603. */
export function corsKarariVer(istekKokeni: string | undefined): { izinliMi: boolean; baslik?: CorsBasligi } {
  if (!istekKokeni || !izinVerilenKokenler.includes(istekKokeni)) {
    return { izinliMi: false };
  }

  return {
    izinliMi: true,
    baslik: {
      'Access-Control-Allow-Origin': istekKokeni,
      'Access-Control-Allow-Credentials': 'true',
    },
  };
}

export type SunucuTuru = 'kitap-karari' | 'cors-paketi' | 'wildcard' | 'kitap-11-7';

type Basliklar = [string, string][];

const DURUM_METNI: Readonly<Record<number, string>> = { 200: 'OK', 204: 'No Content', 404: 'Not Found' };
const CORS_YOK = 'Bu köken için CORS izni yoktur.';
const GIRIS_BASARILI = 'Giriş başarılı.';

function baslikOku(istek: HttpIstek, ad: string): string | undefined {
  return istek.basliklar?.find(([k]) => k.toLowerCase() === ad.toLowerCase())?.[1];
}

/** Express's automatic OPTIONS answer names the methods of the matched route (R25). */
function izinVerilenMetotlar(yol: string): string {
  if (yol === '/api/giris') return 'POST';
  if (yol.startsWith('/api/kitaplar/')) return 'DELETE';
  return 'GET,HEAD';
}

function kitapBasliklari(origin: string | undefined): Basliklar {
  const baslik = corsKarariVer(origin).baslik;
  return baslik ? [['Access-Control-Allow-Origin', baslik['Access-Control-Allow-Origin']], ['Access-Control-Allow-Credentials', baslik['Access-Control-Allow-Credentials']]] : [];
}

/** Express's automatic OPTIONS reply: 200, `Allow`, body = the Allow text, plus whatever CORS headers the middleware added. */
function expressOptions(istek: HttpIstek, cors: Basliklar): HttpYanit {
  const allow = izinVerilenMetotlar(istek.yol);
  return { durumKodu: 200, durumMetni: DURUM_METNI[200], basliklar: [['Allow', allow], ...cors], govde: allow };
}

/** The endpoints' own answer. `POST /api/giris` is Kod 11.7's result object (L1207), so it carries no HTTP status text. */
function uygulama(istek: HttpIstek): { yanit: HttpYanit; terminal?: string } {
  if (istek.metot === 'GET' && istek.yol === '/api/kitaplar') {
    return { yanit: { durumKodu: 200, durumMetni: DURUM_METNI[200], govde: 'kitap listesi (JSON)' } };
  }
  if (istek.metot === 'POST' && istek.yol === '/api/giris') {
    return { yanit: { durumKodu: 200, govde: JSON.stringify({ mesaj: GIRIS_BASARILI }) }, terminal: nodeInspect({ durumKodu: 200, mesaj: GIRIS_BASARILI }) };
  }
  if (istek.metot === 'DELETE' && istek.yol === '/api/kitaplar/1') {
    return { yanit: { durumKodu: 204, durumMetni: DURUM_METNI[204], govde: null } };
  }
  return { yanit: { durumKodu: 404, durumMetni: DURUM_METNI[404], govde: null } };
}

function ekle(yanit: HttpYanit, cors: Basliklar): HttpYanit {
  return cors.length ? { ...yanit, basliklar: [...(yanit.basliklar ?? []), ...cors] } : yanit;
}

export function sunucuYaniti(tur: SunucuTuru, istek: HttpIstek): { yanit: HttpYanit; isledi: boolean; terminal: string[] } {
  const origin = baslikOku(istek, 'Origin');
  const options = istek.metot === 'OPTIONS';

  switch (tur) {
    case 'kitap-karari': {
      const terminal = [nodeInspect(corsKarariVer(origin))];
      if (options) return { yanit: expressOptions(istek, kitapBasliklari(origin)), isledi: false, terminal };
      return { yanit: ekle(uygulama(istek).yanit, kitapBasliklari(origin)), isledi: true, terminal };
    }
    case 'cors-paketi': {
      const izinli = origin !== undefined && izinVerilenKokenler.includes(origin);
      const cors: Basliklar = izinli
        ? [['Access-Control-Allow-Origin', origin], ['Access-Control-Allow-Credentials', 'true'], ['Vary', 'Origin']]
        : [];
      if (options) {
        const ek: Basliklar = [];
        const istenen = baslikOku(istek, 'Access-Control-Request-Headers');
        if (izinli) {
          ek.push(['Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE']);
          if (istenen) ek.push(['Access-Control-Allow-Headers', istenen]);
        }
        return { yanit: { durumKodu: 204, durumMetni: DURUM_METNI[204], basliklar: [...cors, ...ek], govde: null }, isledi: false, terminal: [] };
      }
      const u = uygulama(istek);
      return { yanit: ekle(u.yanit, cors), isledi: true, terminal: u.terminal ? [u.terminal] : [] };
    }
    case 'wildcard': {
      const cors: Basliklar = [['Access-Control-Allow-Origin', '*'], ['Access-Control-Allow-Credentials', 'true']];
      if (options) return { yanit: expressOptions(istek, cors), isledi: false, terminal: [] };
      const u = uygulama(istek);
      return { yanit: ekle(u.yanit, cors), isledi: true, terminal: u.terminal ? [u.terminal] : [] };
    }
    case 'kitap-11-7': {
      // corsKontrolEt (L1114-1118): an origin outside Kod 11.7's list is refused, OPTIONS included; no Origin counts as outside.
      if (origin === undefined || !KOD_11_7_KOKENLERI.includes(origin)) {
        return {
          yanit: { durumKodu: 403, govde: JSON.stringify({ mesaj: CORS_YOK }) },
          isledi: false,
          terminal: [nodeInspect({ durumKodu: 403, mesaj: CORS_YOK })],
        };
      }
      // R24: Kod 11.7 adds no header itself; the allowed origin gets Kod 11.4's two.
      const cors = kitapBasliklari(origin);
      if (options) return { yanit: expressOptions(istek, cors), isledi: false, terminal: [nodeInspect(corsKarariVer(origin))] };
      const u = uygulama(istek);
      return { yanit: ekle(u.yanit, cors), isledi: true, terminal: [u.terminal ?? nodeInspect(corsKarariVer(origin))] };
    }
  }
}
