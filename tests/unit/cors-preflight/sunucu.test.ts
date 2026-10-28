import { describe, expect, it } from 'vitest';
import { nodeInspect } from '../../../src/core/node-inspect';
import { listing } from '../../../src/core/listing';
import type { HttpIstek } from '../../../src/core/plot/http-cards';
import { LISTINGS } from '../../../src/concepts/cors-preflight/code-text';
import { corsKarariVer, sunucuYaniti, API_KOKENI } from '../../../src/concepts/cors-preflight/sunucu';

const KUTUPHANE = 'https://kutuphane.mehmetakif.edu.tr';
const KOTU = 'https://kotu-niyetli-site.com';

function istek(metot: HttpIstek['metot'], yol: string, origin?: string, ek: [string, string][] = []): HttpIstek {
  return { metot, yol, basliklar: [...(origin ? ([['Origin', origin]] as [string, string][]) : []), ...ek] };
}
const baslik = (b: readonly [string, string][] | undefined, ad: string) => b?.find(([k]) => k === ad)?.[1];

describe('cors-preflight server model', () => {
  it('exports the API origin', () => {
    expect(API_KOKENI).toBe('https://api.kutuphane.mehmetakif.edu.tr');
  });

  it('book output L614-621', () => {
    const cikti = [nodeInspect(corsKarariVer(KUTUPHANE)), nodeInspect(corsKarariVer(KOTU))].join('\n');
    expect(cikti.split('\n')).toEqual(listing(LISTINGS, 'kod-11-4-cikti').lines);
    expect(corsKarariVer(undefined)).toEqual({ izinliMi: false });
  });

  it('cors package reflects request headers', () => {
    const r = sunucuYaniti('cors-paketi', istek('OPTIONS', '/api/giris', KUTUPHANE, [['Access-Control-Request-Method', 'POST'], ['Access-Control-Request-Headers', 'authorization,content-type']]));
    expect(r.yanit.durumKodu).toBe(204);
    expect(r.isledi).toBe(false);
    expect(baslik(r.yanit.basliklar, 'Access-Control-Allow-Headers')).toBe('authorization,content-type');
    expect(baslik(r.yanit.basliklar, 'Access-Control-Allow-Methods')).toBe('GET,HEAD,PUT,PATCH,POST,DELETE');
    expect(baslik(r.yanit.basliklar, 'Access-Control-Allow-Origin')).toBe(KUTUPHANE);
    expect(baslik(r.yanit.basliklar, 'Access-Control-Allow-Credentials')).toBe('true');
    expect(baslik(r.yanit.basliklar, 'Vary')).toBe('Origin');
    const kotu = sunucuYaniti('cors-paketi', istek('GET', '/api/kitaplar', KOTU));
    expect(kotu.yanit.durumKodu).toBe(200);
    expect((kotu.yanit.basliklar ?? []).some(([k]) => k.startsWith('Access-Control'))).toBe(false);
  });

  it('kitap-karari OPTIONS is 200 with Allow and two CORS headers', () => {
    const r = sunucuYaniti('kitap-karari', istek('OPTIONS', '/api/giris', KUTUPHANE, [['Access-Control-Request-Method', 'POST']]));
    expect(r.yanit.durumKodu).toBe(200);
    expect(r.yanit.govde).toBe('POST');
    expect(r.isledi).toBe(false);
    expect(baslik(r.yanit.basliklar, 'Allow')).toBe('POST');
    expect(r.yanit.basliklar?.map(([k]) => k).sort()).toEqual(['Access-Control-Allow-Credentials', 'Access-Control-Allow-Origin', 'Allow']);
    expect(r.terminal).toEqual([nodeInspect(corsKarariVer(KUTUPHANE))]);
    const d = sunucuYaniti('kitap-karari', istek('OPTIONS', '/api/kitaplar/1', KUTUPHANE));
    expect(baslik(d.yanit.basliklar, 'Allow')).toBe('DELETE');
  });

  it('kitap-11-7 rejects foreign origin with 403 L1208', () => {
    for (const metot of ['POST', 'OPTIONS'] as const) {
      const r = sunucuYaniti('kitap-11-7', istek(metot, '/api/giris', KOTU));
      expect(r.yanit.durumKodu).toBe(403);
      expect(r.yanit.govde).toBe('{"mesaj":"Bu köken için CORS izni yoktur."}');
      expect(r.isledi).toBe(false);
      expect(r.terminal).toEqual(["{ durumKodu: 403, mesaj: 'Bu köken için CORS izni yoktur.' }"]);
    }
    const son = listing(LISTINGS, 'kod-11-7').lines.at(-1);
    expect(son).toBe("// Çıktı: { durumKodu: 403, mesaj: 'Bu köken için CORS izni yoktur.' }");
  });

  it('kitap-11-7 adds headers for allowed origin', () => {
    const r = sunucuYaniti('kitap-11-7', istek('POST', '/api/giris', KUTUPHANE, [['Content-Type', 'application/json']]));
    expect(r.yanit.durumKodu).toBe(200);
    expect(r.isledi).toBe(true);
    expect(r.yanit.govde).toBe('{"mesaj":"Giriş başarılı."}');
    expect(r.terminal).toEqual(["{ durumKodu: 200, mesaj: 'Giriş başarılı.' }"]);
    expect(baslik(r.yanit.basliklar, 'Access-Control-Allow-Origin')).toBe(KUTUPHANE);
    expect(baslik(r.yanit.basliklar, 'Access-Control-Allow-Credentials')).toBe('true');
    // Kod 11.7 lists one origin only; localhost (Kod 11.4's second) is refused there.
    expect(sunucuYaniti('kitap-11-7', istek('GET', '/api/kitaplar', 'http://localhost:5173')).yanit.durumKodu).toBe(403);
    const opt = sunucuYaniti('kitap-11-7', istek('OPTIONS', '/api/giris', KUTUPHANE));
    expect(opt.yanit.durumKodu).toBe(200);
    expect(baslik(opt.yanit.basliklar, 'Allow')).toBe('POST');
  });

  it('curl without Origin is 403 on kitap-11-7', () => {
    const r = sunucuYaniti('kitap-11-7', istek('GET', '/api/kitaplar'));
    expect(r.yanit.durumKodu).toBe(403);
    expect(r.isledi).toBe(false);
  });

  it('wildcard answers * with credentials; DELETE returns 204 without body', () => {
    const r = sunucuYaniti('wildcard', istek('GET', '/api/kitaplar', KOTU));
    expect(baslik(r.yanit.basliklar, 'Access-Control-Allow-Origin')).toBe('*');
    expect(baslik(r.yanit.basliklar, 'Access-Control-Allow-Credentials')).toBe('true');
    const d = sunucuYaniti('kitap-karari', istek('DELETE', '/api/kitaplar/1', KUTUPHANE));
    expect(d.yanit.durumKodu).toBe(204);
    expect(d.yanit.govde).toBeNull();
    expect(d.isledi).toBe(true);
  });
});
