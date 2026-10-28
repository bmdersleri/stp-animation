import { describe, expect, it } from 'vitest';
import { listing } from '../../../src/core/listing';
import type { HttpIstek } from '../../../src/core/plot/http-cards';
import { LISTINGS } from '../../../src/concepts/cors-preflight/code-text';
import type { SunucuTuru } from '../../../src/concepts/cors-preflight/sunucu';
import { API_KOKENI } from '../../../src/concepts/cors-preflight/sunucu';
import { calistir, KOKEN_URL, preflightGerekli, type CorsSenaryo, type Istemci, type IstekTuru, type Koken } from '../../../src/concepts/cors-preflight/tarayici';

const sen = (o: Partial<CorsSenaryo> = {}): CorsSenaryo => ({ koken: 'kutuphane', istemci: 'tarayici', istek: 'get-kitaplar', kimlik: 'omit', sunucu: 'kitap-karari', ...o });
const ad = (d: { ad: string; durum: string }[] | undefined) => d?.map((x) => `${x.ad}:${x.durum}`);

describe('cors-preflight browser model', () => {
  it('KOKEN_URL values', () => {
    expect(KOKEN_URL).toEqual({
      kutuphane: 'https://kutuphane.mehmetakif.edu.tr',
      localhost: 'http://localhost:5173',
      kotu: 'https://kotu-niyetli-site.com',
      'http-kutuphane': 'http://kutuphane.mehmetakif.edu.tr',
      ayni: API_KOKENI,
    });
  });

  it('simple GET has no preflight', () => {
    const iz = calistir(sen());
    expect(iz.preflight).toBeUndefined();
    expect(iz.asil?.yanit.durumKodu).toBe(200);
    expect(iz.betik.okudu).toBe(true);
    expect(ad(iz.asil?.denetimler)).toEqual(['Allow-Origin:gecti', 'Allow-Credentials:atlandi']);
    expect(iz.asil?.denetimler[1].ayrinti).toBe('kimlik bilgisi yok');
    expect(iz.asil?.istek.basliklar).toContainEqual(['Origin', KOKEN_URL.kutuphane]);
    expect(iz.sunucuIsledi).toBe(true);
  });

  it('JSON POST, Authorization and DELETE need preflight', () => {
    const base = { metot: 'POST', yol: '/api/giris' } as const;
    const j: HttpIstek = { ...base, basliklar: [['Content-Type', 'application/json']] };
    expect(preflightGerekli(j)).toBe(true);
    expect(preflightGerekli({ ...base, basliklar: [['Content-Type', 'text/plain; charset=utf-8']] })).toBe(false);
    expect(preflightGerekli({ metot: 'GET', yol: '/x', basliklar: [['Authorization', 'Bearer x']] })).toBe(true);
    expect(preflightGerekli({ metot: 'DELETE', yol: '/x' })).toBe(true);
    expect(preflightGerekli({ metot: 'GET', yol: '/x' })).toBe(false);
    for (const [istek, bekle] of [['post-giris', true], ['get-yetkili', true], ['delete', true], ['get-kitaplar', false]] as const) {
      expect(Boolean(calistir(sen({ istek, sunucu: 'cors-paketi' })).preflight), istek).toBe(bekle);
    }
  });

  it('kitap-karari JSON POST fails Allow-Headers and never sends POST', () => {
    const iz = calistir(sen({ istek: 'post-giris', kimlik: 'include' }));
    expect(iz.preflight?.istek.metot).toBe('OPTIONS');
    expect(iz.preflight?.istek.basliklar).toEqual([
      ['Origin', KOKEN_URL.kutuphane],
      ['Access-Control-Request-Method', 'POST'],
      ['Access-Control-Request-Headers', 'content-type'],
    ]);
    expect(ad(iz.preflight?.denetimler)).toEqual([
      'Durum 2xx:gecti', 'Allow-Origin:gecti', 'Allow-Credentials:gecti', 'Allow-Methods:gecti', 'Allow-Headers:kaldi',
    ]);
    expect(iz.preflight?.yanit.eksikBasliklar).toEqual(['Access-Control-Allow-Headers']);
    expect(iz.asil).toBeUndefined();
    expect(iz.sunucuIsledi).toBe(false);
    expect(iz.betik).toEqual({ okudu: false, metin: 'TypeError: Failed to fetch' });
  });

  it('cors-paketi passes and POST returns L1207', () => {
    const iz = calistir(sen({ istek: 'post-giris', kimlik: 'include', sunucu: 'cors-paketi' }));
    expect(iz.preflight?.yanit.durumKodu).toBe(204);
    expect(iz.preflight?.denetimler.every((d) => d.durum === 'gecti')).toBe(true);
    expect(iz.asil?.istek.basliklar).toContainEqual(['Cookie', 'oturum=…']);
    expect(iz.preflight?.istek.basliklar?.some(([k]) => k === 'Cookie')).toBe(false);
    expect(iz.asil?.yanit.govde).toBe('{"mesaj":"Giriş başarılı."}');
    expect(iz.terminal).toEqual(["{ durumKodu: 200, mesaj: 'Giriş başarılı.' }"]);
    expect(iz.betik.okudu).toBe(true);
    expect(iz.sunucuIsledi).toBe(true);
    expect(iz.olaylar.map((o) => `${o.from}>${o.to}`)).toEqual([
      'betik>tarayici', 'tarayici>sunucu', 'sunucu>tarayici', 'tarayici>sunucu', 'sunucu>tarayici', 'tarayici>betik',
    ]);
  });

  it('authorization header carries the Ders token and is listed in the preflight', () => {
    const iz = calistir(sen({ istek: 'get-yetkili', sunucu: 'cors-paketi' }));
    const a = iz.asil?.istek.basliklar?.find(([k]) => k === 'Authorization')?.[1];
    expect(a).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    expect(iz.preflight?.istek.basliklar).toContainEqual(['Access-Control-Request-Headers', 'authorization']);
  });

  it('wildcard with include fails Allow-Credentials; wildcard with omit passes for GET', () => {
    const a = calistir(sen({ sunucu: 'wildcard', kimlik: 'include' }));
    expect(ad(a.asil?.denetimler)).toEqual(['Allow-Origin:gecti', 'Allow-Credentials:kaldi']);
    expect(a.betik.okudu).toBe(false);
    expect(a.sunucuIsledi).toBe(true);
    const b = calistir(sen({ sunucu: 'wildcard', kimlik: 'omit' }));
    expect(ad(b.asil?.denetimler)).toEqual(['Allow-Origin:gecti', 'Allow-Credentials:atlandi']);
    expect(b.betik.okudu).toBe(true);
  });

  it('foreign origin simple GET: server processed, script blocked', () => {
    const iz = calistir(sen({ koken: 'kotu' }));
    expect(iz.asil?.yanit.durumKodu).toBe(200);
    expect(iz.sunucuIsledi).toBe(true);
    expect(iz.betik).toEqual({ okudu: false, metin: 'TypeError: Failed to fetch' });
    expect(iz.asil?.yanit.eksikBasliklar).toEqual(['Access-Control-Allow-Origin']);
    expect(iz.terminal).toEqual(['{ izinliMi: false }']);
  });

  it('curl reads regardless', () => {
    for (const istemci of ['curl', 'curl-origin'] as const) {
      const iz = calistir(sen({ istemci, koken: 'kotu', istek: 'post-giris', sunucu: 'kitap-karari' }));
      expect(iz.preflight).toBeUndefined();
      expect(iz.betik.okudu).toBe(true);
      expect(iz.asil?.denetimler.every((d) => d.durum === 'atlandi' && d.ayrinti === 'curl CORS uygulamaz')).toBe(true);
      const origin = iz.asil?.istek.basliklar?.find(([k]) => k === 'Origin');
      expect(Boolean(origin)).toBe(istemci === 'curl-origin');
    }
    expect(calistir(sen({ istemci: 'curl', sunucu: 'kitap-11-7' })).asil?.yanit.durumKodu).toBe(403);
  });

  it('same origin skips CORS', () => {
    const iz = calistir(sen({ koken: 'ayni', sunucu: 'kitap-karari' }));
    expect(iz.preflight).toBeUndefined();
    expect(iz.betik.okudu).toBe(true);
    expect(iz.asil?.istek.basliklar?.some(([k]) => k === 'Origin')).toBe(false);
    expect(iz.asil?.denetimler.every((d) => d.durum === 'atlandi')).toBe(true);
    const del = calistir(sen({ koken: 'ayni', istek: 'delete' }));
    expect(del.preflight).toBeUndefined();
    expect(del.betik.okudu).toBe(true);
    expect(del.asil?.istek.basliklar).toContainEqual(['Origin', API_KOKENI]);
  });

  it('http vs https is a different origin', () => {
    const iz = calistir(sen({ koken: 'http-kutuphane', sunucu: 'cors-paketi' }));
    expect(iz.betik.okudu).toBe(false);
    expect(iz.asil?.yanit.eksikBasliklar).toEqual(['Access-Control-Allow-Origin']);
    expect(calistir(sen({ koken: 'kutuphane', sunucu: 'cors-paketi' })).betik.okudu).toBe(true);
  });

  it('every lab combination yields a defined trace', () => {
    const kokenler: Koken[] = ['kutuphane', 'localhost', 'kotu', 'http-kutuphane', 'ayni'];
    const istemciler: Istemci[] = ['tarayici', 'curl', 'curl-origin'];
    const istekler: IstekTuru[] = ['get-kitaplar', 'post-giris', 'get-yetkili', 'delete'];
    const sunucular: SunucuTuru[] = ['kitap-karari', 'cors-paketi', 'wildcard', 'kitap-11-7'];
    let n = 0;
    for (const koken of kokenler)
      for (const istemci of istemciler)
        for (const istek of istekler)
          for (const kimlik of ['include', 'omit'] as const)
            for (const sunucu of sunucular) {
              const iz = calistir({ koken, istemci, istek, kimlik, sunucu });
              n++;
              if (iz.betik.metin.length === 0 || iz.olaylar.length < 2) throw new Error(`bad trace ${koken}/${istemci}/${istek}/${kimlik}/${sunucu}`);
            }
    expect(n).toBe(480);
  });

  it('listings match book', () => {
    expect(listing(LISTINGS, 'kod-11-4').lines).toHaveLength(33);
    const k = listing(LISTINGS, 'kod-11-7').lines;
    expect(k).toHaveLength(119);
    expect(k.at(-1)).toBe("// Çıktı: { durumKodu: 403, mesaj: 'Bu köken için CORS izni yoktur.' }");
    expect(LISTINGS.map((l) => l.id)).toEqual(['kod-11-4', 'kod-11-4-cikti', 'code-008', 'kod-11-7']);
  });
});
