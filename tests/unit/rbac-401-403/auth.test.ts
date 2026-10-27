import { scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  authMiddleware,
  girisYap,
  istegiIsle,
  kayitlar,
  kitapEkle,
  kitapSilYanlisKod,
  LISTINGS,
  tokenDogrulaKisa,
} from '../../../src/concepts/rbac-401-403/auth';
import { HASHLER, PAROLA, SALT_ELIF, SALT_YASEMIN, YANLIS_PAROLA } from '../../../src/concepts/rbac-401-403/degerler';
import { DERS_SIMDI, SURE_MS, payloadKur, tokenUret } from '../../../src/concepts/jwt-akisi/jwt';
import { listing } from '../../../src/core/listing';
import { nodeInspect } from '../../../src/core/node-inspect';

const HATA = '401: Kullanıcı adı veya parola hatalı.';

function tokenAl(ad: 'yasemin' | 'elif'): string {
  const s = girisYap(kayitlar(), ad, PAROLA[ad], DERS_SIMDI);
  if (!('token' in s)) throw new Error('giriş başarısız');
  return s.token;
}

describe('degerler', () => {
  it('hashes equal node scryptSync', () => {
    const girdiler: [string, string][] = [
      [PAROLA.yasemin, SALT_YASEMIN],
      [PAROLA.elif, SALT_ELIF],
      [YANLIS_PAROLA, SALT_YASEMIN],
      [YANLIS_PAROLA, SALT_ELIF],
    ];
    expect(Object.keys(HASHLER)).toHaveLength(4);
    for (const [p, s] of girdiler) expect(HASHLER[`${p}|${s}`]).toBe(scryptSync(p, s, 64).toString('hex'));
  });
});

describe('Kod 10.7', () => {
  it('book output L1254-1256', () => {
    const cikti = [
      nodeInspect(kitapEkle(tokenAl('yasemin'), DERS_SIMDI).yanit),
      nodeInspect(kitapEkle(tokenAl('elif'), DERS_SIMDI).yanit),
      nodeInspect(kitapEkle('gecersiz.token.deger', DERS_SIMDI).yanit),
    ];
    const kitap = listing(LISTINGS, 'kod-10-7').lines.slice(-3).map((l) => l.replace('// Çıktı: ', ''));
    expect(cikti).toEqual(kitap);
    expect(cikti[0]).toBe("{ durumKodu: 201, mesaj: 'Kitap eklendi.' }");
  });

  it('elif token equals jwt-akisi ders token', () => {
    expect(tokenAl('elif')).toBe(tokenUret(payloadKur('elif', DERS_SIMDI)).token);
    expect(tokenAl('yasemin')).toBe(tokenUret(payloadKur('yasemin', DERS_SIMDI)).token);
  });

  it('records come in book order', () => {
    expect(kayitlar().map((k) => [k.kullaniciAdi, k.salt, k.rol])).toEqual([
      ['yasemin', SALT_YASEMIN, 'kutuphaneci'],
      ['elif', SALT_ELIF, 'ogrenci'],
    ]);
  });

  it('invalid token skips the role check', () => {
    const iz = kitapEkle('gecersiz.token.deger', DERS_SIMDI);
    expect(iz.denetimler.map((d) => d.durum)).toEqual(['kaldi', 'atlandi']);
    expect(iz.denetimler[0].sonuc).toBe('401');
    expect(iz.olaylar.some((m) => m.to === 'sadeceKutuphaneci' || m.from === 'sadeceKutuphaneci')).toBe(false);
    expect(iz.yanit).toEqual({ durumKodu: 401, mesaj: '401' });
  });

  it('ogrenci passes identity and fails the role check with 403', () => {
    const iz = kitapEkle(tokenAl('elif'), DERS_SIMDI);
    expect(iz.denetimler.map((d) => d.durum)).toEqual(['gecti', 'kaldi']);
    expect(iz.denetimler[1].sonuc).toBe('403');
    expect(iz.olaylar.at(-1)).toMatchObject({ from: 'kitapEkle', to: 'cagiran', tone: 'alarm' });
    expect(iz.olaylar.some((m) => m.from === 'kitapEkle' && m.to === 'sadeceKutuphaneci')).toBe(true);
  });

  it('unknown user and wrong password give the same message', () => {
    expect(girisYap(kayitlar(), 'ahmet', 'herhangi', DERS_SIMDI)).toEqual({ hata: HATA });
    expect(girisYap(kayitlar(), 'elif', YANLIS_PAROLA, DERS_SIMDI)).toEqual({ hata: HATA });
  });

  it('throws for a combination missing from HASHLER', () => {
    expect(() => girisYap(kayitlar(), 'elif', 'baska-parola', DERS_SIMDI)).toThrow();
  });

  it('empty token fails at L1171', () => {
    const r = tokenDogrulaKisa('', DERS_SIMDI);
    expect(r.hata).toBe('401');
    expect(r.ayrinti).toBe('L1171: imza eşleşmedi');
    expect(r.satir).toBe(1171 - 1118 + 1);
    expect(tokenDogrulaKisa('gecersiz.token.deger', DERS_SIMDI).hata).toBe('401');
  });

  it('expired token after 15 minutes is 401', () => {
    const t = tokenAl('yasemin');
    expect(tokenDogrulaKisa(t, DERS_SIMDI + SURE_MS).payload?.kullaniciAdi).toBe('yasemin');
    const r = tokenDogrulaKisa(t, DERS_SIMDI + SURE_MS + 1);
    expect(r.hata).toBe('401');
    expect(r.ayrinti).toBe('L1175: süre doldu');
    expect(kitapEkle(t, DERS_SIMDI + SURE_MS + 1).yanit).toEqual({ durumKodu: 401, mesaj: '401' });
  });

  it('ikisi roles lets ogrenci add', () => {
    const iz = kitapEkle(tokenAl('elif'), DERS_SIMDI, 'ikisi');
    expect(iz.yanit).toEqual({ durumKodu: 201, mesaj: 'Kitap eklendi.' });
    expect(iz.denetimler.map((d) => d.durum)).toEqual(['gecti', 'gecti']);
  });

  it('decision lines come from the listing', () => {
    const l = listing(LISTINGS, 'kod-10-7').lines;
    const iz = kitapEkle('x.y.z', DERS_SIMDI);
    for (const n of iz.satirlar) expect(l[n - 1]).toBeDefined();
    expect(l[tokenDogrulaKisa('x', DERS_SIMDI).satir - 1]).toContain('imza !==');
  });
});

describe('Kod 10.4', () => {
  it('two 401 messages and next', () => {
    expect(authMiddleware(undefined)).toEqual({ next: false, durumKodu: 401, mesaj: 'Token bulunamadı.' });
    expect(authMiddleware('Bearer x')).toEqual({ next: false, durumKodu: 401, mesaj: 'Token geçersiz veya süresi dolmuş.' });
    expect(authMiddleware('Bearer gecerli-token')).toEqual({ next: true, kullanici: { kullaniciAdi: 'elif', rol: 'ogrenci' } });
    expect(authMiddleware('gecerli-token')).toMatchObject({ next: false, mesaj: 'Token bulunamadı.' });
  });
});

describe('Kod 10.6', () => {
  it('output L912-917', () => {
    const cikti = [
      nodeInspect(istegiIsle(null, null)),
      nodeInspect(istegiIsle('gecerli-token', 'ogrenci')),
      nodeInspect(istegiIsle('gecerli-token', 'kutuphaneci')),
    ].join('\n');
    expect(cikti).toBe(listing(LISTINGS, 'kod-10-6-cikti').lines.join('\n'));
    expect(istegiIsle('t', null)).toEqual({ durumKodu: 401, mesaj: 'Kimlik doğrulanamadı: token geçersiz.' });
  });
});

describe('code-012', () => {
  it('returns 401 for ogrenci', () => {
    expect(kitapSilYanlisKod('ogrenci')).toEqual({ durumKodu: 401 });
    expect(kitapSilYanlisKod('kutuphaneci')).toEqual({ durumKodu: 200 });
  });
});

describe('listings', () => {
  it('match book', () => {
    expect(LISTINGS.map((l) => l.id)).toEqual(['kod-10-7', 'kod-10-4', 'kod-10-5', 'kod-10-5-cikti', 'kod-10-6', 'kod-10-6-cikti', 'code-012']);
    const k = listing(LISTINGS, 'kod-10-7');
    expect(k.lines).toHaveLength(139);
    expect(k.lines.at(-1)).toBe("// Çıktı: { durumKodu: 401, mesaj: '401' }");
    expect(listing(LISTINGS, 'kod-10-5-cikti').lines).toHaveLength(2);
  });
});
