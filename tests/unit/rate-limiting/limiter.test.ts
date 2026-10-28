import { describe, expect, it } from 'vitest';
import { nodeInspect } from '../../../src/core/node-inspect';
import { listing } from '../../../src/core/listing';
import { LISTINGS } from '../../../src/concepts/rate-limiting/code-text';
import { istegeIzinVer, loginIsteginiIsle, yeniLimiter } from '../../../src/concepts/rate-limiting/limiter';
import { desenIstekleri, LOGIN_CAGRILARI, loginOynat, oynat } from '../../../src/concepts/rate-limiting/desenler';

const IP10 = '203.0.113.10';
const IP20 = '203.0.113.20';
const kayit = (d: { kayitlar: readonly [string, { sayac: number }][] }, ip: string) => d.kayitlar.find(([k]) => k === ip)?.[1];

describe('rate-limiting model', () => {
  it('book output L756-760', () => {
    const satirlar = oynat(desenIstekleri('kitap'), 3, 60_000).map(
      ({ izin }, i) => `Deneme ${i + 1}: ${izin ? 'kabul edildi' : '429 Too Many Requests'}`,
    );
    expect(satirlar).toEqual(listing(LISTINGS, 'kod-11-5-cikti').lines);
  });

  it('branches follow the code', () => {
    expect(oynat(desenIstekleri('kitap'), 3, 60_000).map((r) => r.dal)).toEqual(['yeni-pencere', 'artir', 'artir', 'sinirda', 'sinirda']);
  });

  it('window resets at exactly pencereMs', () => {
    let d = yeniLimiter(1, 60_000);
    d = istegeIzinVer(d, IP10, 0).durum;
    const once = istegeIzinVer(d, IP10, 59_999);
    expect(once.dal).toBe('sinirda');
    expect(once.izin).toBe(false);
    const tam = istegeIzinVer(d, IP10, 60_000);
    expect(tam.dal).toBe('yeni-pencere');
    expect(tam.izin).toBe(true);
  });

  it('keys are independent', () => {
    const r = oynat(desenIstekleri('ayri-ip'), 3, 60_000);
    const son = r[r.length - 1];
    expect(son.ip).toBe(IP20);
    expect(son.izin).toBe(true);
    expect(son.sayac).toBe(1);
  });

  it('boundary burst accepts five in 58–61 s', () => {
    const r = oynat(desenIstekleri('sinir'), 3, 60_000);
    expect(r.map((x) => x.t)).toEqual([0, 58_000, 59_000, 60_000, 60_500, 61_000]);
    const icinde = r.filter((x) => x.t >= 58_000 && x.t <= 61_000 && x.izin);
    expect(icinde).toHaveLength(5);
    expect(r.every((x) => x.izin)).toBe(true);
  });

  it('other patterns have the specified shape', () => {
    expect(desenIstekleri('kitap')).toEqual(Array.from({ length: 5 }, () => ({ t: 0, ip: IP10 })));
    expect(desenIstekleri('pencere').map((x) => x.t)).toEqual([0, 0, 0, 0, 0, 60_000]);
    expect(desenIstekleri('duzenli').map((x) => x.t)).toEqual(Array.from({ length: 12 }, (_, i) => i * 10_000));
    const iki = desenIstekleri('iki-ip');
    expect(iki.map((x) => x.t)).toEqual(Array.from({ length: 10 }, (_, i) => i * 1000));
    expect(iki.map((x) => x.ip)).toEqual(Array.from({ length: 10 }, (_, i) => (i % 2 ? IP20 : IP10)));
  });

  it('state is immutable', () => {
    const d0 = yeniLimiter(3, 60_000);
    const d1 = istegeIzinVer(d0, IP10, 0).durum;
    const d2 = istegeIzinVer(d1, IP10, 1).durum;
    expect(d0.kayitlar).toEqual([]);
    expect(kayit(d1, IP10)?.sayac).toBe(1);
    expect(kayit(d2, IP10)?.sayac).toBe(2);
  });
});

describe('login flow (Kod 11.7)', () => {
  it('login order: CORS failure does not touch the limiter', () => {
    const { sonuclar, durum } = loginOynat();
    expect(sonuclar[1].durumKodu).toBe(403);
    expect(sonuclar[1].sayac).toBe(1);
    expect(sonuclar[1].dal).toBeUndefined();
    expect(sonuclar[1].denetimler.map((d) => d.durum)).toEqual(['kaldi', 'atlandi', 'atlandi', 'atlandi', 'atlandi']);
    expect(sonuclar[1].denetimler.map((d) => d.ad)).toEqual(['CORS', 'Rate limit', 'Validation', 'Secret', 'Kimlik bilgisi']);
    expect(kayit(durum, IP20)?.sayac).toBe(3);
  });

  it('login book output L1207-1208', () => {
    const { sonuclar } = loginOynat();
    const cikti = sonuclar.slice(0, 2).map((r) => nodeInspect({ durumKodu: r.durumKodu, mesaj: r.mesaj }));
    const kitap = listing(LISTINGS, 'kod-11-7').lines.filter((s) => s.startsWith('// Çıktı: ')).map((s) => s.replace('// Çıktı: ', ''));
    expect(cikti).toEqual(kitap);
  });

  it('fourth successful login is 429 with book message', () => {
    const { sonuclar } = loginOynat();
    expect(sonuclar.map((r) => r.durumKodu)).toEqual([200, 403, 200, 200, 429]);
    expect(sonuclar[4].mesaj).toBe('Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.');
    expect(sonuclar[4].denetimler.map((d) => d.durum)).toEqual(['gecti', 'kaldi', 'atlandi', 'atlandi', 'atlandi']);
    expect(sonuclar[0].denetimler.every((d) => d.durum === 'gecti')).toBe(true);
  });

  it('missing secret gives 500', () => {
    const c = LOGIN_CAGRILARI[0];
    const { sonuc } = loginIsteginiIsle(yeniLimiter(3, 60_000), c, {});
    expect(sonuc.yanit).toEqual({ durumKodu: 500, mesaj: 'Sunucu yapılandırma hatası: JWT_SECRET eksik.' });
    expect(sonuc.denetimler.map((d) => d.durum)).toEqual(['gecti', 'gecti', 'gecti', 'kaldi', 'atlandi']);
  });

  it('validation and credential messages', () => {
    const ortam = { JWT_SECRET: 's' };
    const c = LOGIN_CAGRILARI[0];
    const msg = (govde: unknown) => loginIsteginiIsle(yeniLimiter(3, 60_000), { ...c, govde }, ortam).sonuc.yanit;
    expect(msg(null)).toEqual({ durumKodu: 400, mesaj: 'İstek gövdesi bir nesne olmalıdır.' });
    expect(msg({ kullaniciAdi: ' ', parola: 'x' })).toEqual({ durumKodu: 400, mesaj: 'kullaniciAdi zorunludur.' });
    expect(msg({ kullaniciAdi: 'elif', parola: '' })).toEqual({ durumKodu: 400, mesaj: 'parola zorunludur.' });
    expect(msg({ kullaniciAdi: 'elif', parola: 'yanlis' })).toEqual({ durumKodu: 401, mesaj: 'Kullanıcı adı veya parola hatalı.' });
  });

  it('listings match book', () => {
    const k = listing(LISTINGS, 'kod-11-5');
    expect(k.lines).toHaveLength(49);
    expect(k.lines[0]).toBe('// Dosya: RateLimiter.ts');
    expect(listing(LISTINGS, 'kod-11-5-cikti').lines).toHaveLength(5);
  });
});
