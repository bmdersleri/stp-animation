import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/jwt-akisi/code-text';
import {
  DERS_SIMDI,
  GIZLI_ANAHTAR,
  SURE_MS,
  bozukToken,
  payloadKur,
  tokenDogrula,
  tokenUret,
} from '../../../src/concepts/jwt-akisi/jwt';
import { b64urlCoz } from '../../../src/core/kripto';
import { listing } from '../../../src/core/listing';
import { nodeInspect } from '../../../src/core/node-inspect';

const b64 = (s: string): string => Buffer.from(s).toString('base64url');
const HEADER = 'eyJhbGciOiJIUzI1NiIsInRpcCI6IkpXVCJ9';
const GOVDE = 'eyJrdWxsYW5pY2lBZGkiOiJlbGlmIiwicm9sIjoib2dyZW5jaSIsInNvbkdlY2VybGlsaWsiOjE3ODg2MDc0Mjg2MDB9';
const IMZA = 'p1aKZ8iwwpShCIkzPs1HH23xYmZSUhwPknpJRwVpavM';
/** Elif's payload without the expiry field (sure-alani-yok) and with the role changed (rol-degisti), re-derived from their JSON. */
const SURESIZ_GOVDE = b64('{"kullaniciAdi":"elif","rol":"ogrenci"}');
const ROL_GOVDE = b64('{"kullaniciAdi":"elif","rol":"kutuphaneci","sonGecerlilik":1788607428600}');
const SURESIZ_IMZA = 'Nbua2B5HZZaFd1FQ6I_KfnJwFs2vKArT1EX0HUl0dmg';

const imzaNode = (veri: string, anahtar = GIZLI_ANAHTAR): string => createHmac('sha256', anahtar).update(veri).digest('base64url');
const KOD = listing(LISTINGS, 'kod-10-3');
const token = (): string => tokenUret(payloadKur('elif', DERS_SIMDI)).token;
const adlar = (t: string, simdi = DERS_SIMDI): string[] => tokenDogrula(t, simdi).denetimler.map((d) => `${d.ad}:${d.durum}`);

describe('jwt-akisi model', () => {
  it('ders token parts equal node createHmac', () => {
    const t = tokenUret(payloadKur('elif', DERS_SIMDI));
    expect(t.header).toBe(HEADER);
    expect(t.govde).toBe(GOVDE);
    expect(t.imza).toBe(IMZA);
    expect(t.token).toBe(`${HEADER}.${GOVDE}.${IMZA}`);
    expect(t.header).toBe(b64('{"alg":"HS256","tip":"JWT"}'));
    expect(t.govde).toBe(b64('{"kullaniciAdi":"elif","rol":"ogrenci","sonGecerlilik":1788607428600}'));
    expect(t.imza).toBe(imzaNode(`${t.header}.${t.govde}`));
    expect(payloadKur('yasemin', DERS_SIMDI).rol).toBe('kutuphaneci');
    expect(DERS_SIMDI + SURE_MS).toBe(1788607428600);
  });

  it('book output L512-515', () => {
    const metin = (s: string): string => {
      const r = tokenDogrula(s, DERS_SIMDI).sonuc;
      return 'hata' in r ? r.hata : nodeInspect(r.payload);
    };
    const satirlar = [
      metin(token()),
      metin(bozukToken('elif', 'imza-bozuk', DERS_SIMDI)),
      metin(bozukToken('elif', 'sure-alani-yok', DERS_SIMDI)),
      metin(bozukToken('elif', 'fazla-segment', DERS_SIMDI)),
    ];
    expect(satirlar).toEqual(listing(LISTINGS, 'kod-10-3-cikti').lines);
    expect(satirlar[0]).toBe("{ kullaniciAdi: 'elif', rol: 'ogrenci', sonGecerlilik: 1788607428600 }");
  });

  it('code-006 output L575', () => {
    expect(listing(LISTINGS, 'code-006').lines).toHaveLength(16);
    const govde = b64('{"kullaniciAdi":"elif","parola":"guclu-Parola123"}');
    expect(b64urlCoz(govde)).toBe(listing(LISTINGS, 'code-006-cikti').lines[0]);
  });

  it('all five checks pass for a fresh token', () => {
    const iz = tokenDogrula(token(), DERS_SIMDI);
    expect(adlar(token())).toEqual([
      'Biçim (3 parça):gecti',
      'İmza:gecti',
      'Payload JSON:gecti',
      'Süre alanı:gecti',
      'Süre:gecti',
    ]);
    expect(iz.beklenenImza).toBe(IMZA);
    expect(KOD.lines[iz.satir - 1]).toBe('  return payload;');
  });

  it('role change keeps old signature and fails at imza', () => {
    const t = bozukToken('elif', 'rol-degisti', DERS_SIMDI);
    const [h, g, i] = t.split('.');
    expect(h).toBe(HEADER);
    expect(g).toBe(ROL_GOVDE);
    expect(i).toBe(IMZA);
    const iz = tokenDogrula(t, DERS_SIMDI);
    expect(iz.sonuc).toEqual({ hata: '401: Token imzası geçersiz.' });
    expect(iz.beklenenImza).toBe(imzaNode(`${HEADER}.${ROL_GOVDE}`));
    expect(iz.beklenenImza).not.toBe(IMZA);
    expect(adlar(t)).toEqual([
      'Biçim (3 parça):gecti',
      'İmza:kaldi',
      'Payload JSON:atlandi',
      'Süre alanı:atlandi',
      'Süre:atlandi',
    ]);
    expect(bozukToken('yasemin', 'rol-degisti', DERS_SIMDI).split('.')[1]).toBe(
      b64('{"kullaniciAdi":"yasemin","rol":"ogrenci","sonGecerlilik":1788607428600}'),
    );
  });

  it('missing expiry passes imza and fails at Süre alanı', () => {
    const t = bozukToken('elif', 'sure-alani-yok', DERS_SIMDI);
    const [, g, i] = t.split('.');
    expect(g).toBe(SURESIZ_GOVDE);
    expect(i).toBe(SURESIZ_IMZA);
    expect(i).toBe(imzaNode(`${HEADER}.${SURESIZ_GOVDE}`));
    expect(tokenDogrula(t, DERS_SIMDI).sonuc).toEqual({ hata: '401: Token süre alanı eksik.' });
    expect(adlar(t)).toEqual([
      'Biçim (3 parça):gecti',
      'İmza:gecti',
      'Payload JSON:gecti',
      'Süre alanı:kaldi',
      'Süre:atlandi',
    ]);
  });

  it('extra segment fails Biçim and skips the rest', () => {
    const t = bozukToken('elif', 'fazla-segment', DERS_SIMDI);
    expect(t).toBe(`${token()}.fazladan`);
    const iz = tokenDogrula(t, DERS_SIMDI);
    expect(iz.sonuc).toEqual({ hata: '401: Token biçimi geçersiz.' });
    expect(iz.parcalar).toHaveLength(4);
    expect(iz.beklenenImza).toBeUndefined();
    expect(adlar(t)).toEqual([
      'Biçim (3 parça):kaldi',
      'İmza:atlandi',
      'Payload JSON:atlandi',
      'Süre alanı:atlandi',
      'Süre:atlandi',
    ]);
  });

  it('tampered signature fails at imza', () => {
    const t = bozukToken('elif', 'imza-bozuk', DERS_SIMDI);
    expect(t).toBe(`${token()}bozuk`);
    expect(tokenDogrula(t, DERS_SIMDI).sonuc).toEqual({ hata: '401: Token imzası geçersiz.' });
  });

  it('foreign key fails at imza', () => {
    const t = bozukToken('elif', 'baska-anahtar', DERS_SIMDI);
    const [h, g, i] = t.split('.');
    expect([h, g]).toEqual([HEADER, GOVDE]);
    expect(i).toBe(imzaNode(`${HEADER}.${GOVDE}`, 'saldirgan-sirri'));
    expect(adlar(t)[1]).toBe('İmza:kaldi');
  });

  it('expiry boundary uses strict greater-than', () => {
    const t = token();
    expect(tokenDogrula(t, DERS_SIMDI + 15 * 60000).sonuc).toHaveProperty('payload');
    const iz = tokenDogrula(t, DERS_SIMDI + 15 * 60000 + 1);
    expect(iz.sonuc).toEqual({ hata: '401: Token süresi dolmuş.' });
    expect(adlar(t, DERS_SIMDI + 15 * 60000 + 1)[4]).toBe('Süre:kaldi');
  });

  it('broken JSON is not caught', () => {
    const t = bozukToken('elif', 'bozuk-json', DERS_SIMDI);
    const [h, g, i] = t.split('.');
    expect(b64urlCoz(g)).toBe('{bozuk');
    expect(i).toBe(imzaNode(`${h}.${g}`));
    const iz = tokenDogrula(t, DERS_SIMDI);
    expect(iz.sonuc).toMatchObject({ yakalanmamis: true });
    expect((iz.sonuc as { hata: string }).hata.startsWith('SyntaxError: ')).toBe(true);
    expect(adlar(t)).toEqual([
      'Biçim (3 parça):gecti',
      'İmza:gecti',
      'Payload JSON:kaldi',
      'Süre alanı:atlandi',
      'Süre:atlandi',
    ]);
  });

  it('satir points into kod-10-3', () => {
    const girdiler = ['yok', 'imza-bozuk', 'rol-degisti', 'sure-alani-yok', 'fazla-segment', 'baska-anahtar', 'bozuk-json'] as const;
    const beklenen = [
      'return payload',
      'Token imzası geçersiz',
      'Token imzası geçersiz',
      'Token süre alanı eksik',
      'Token biçimi geçersiz',
      'Token imzası geçersiz',
      'JSON.parse',
    ];
    girdiler.forEach((b, n) => {
      const { satir } = tokenDogrula(bozukToken('elif', b, DERS_SIMDI), DERS_SIMDI);
      expect(satir).toBeGreaterThanOrEqual(1);
      expect(satir).toBeLessThanOrEqual(KOD.lines.length);
      expect(KOD.lines[satir - 1]).toContain(beklenen[n]);
    });
    const dolmus = tokenDogrula(token(), DERS_SIMDI + SURE_MS + 1);
    expect(KOD.lines[dolmus.satir - 1]).toContain('Token süresi dolmuş');
  });

  it('listings match book', () => {
    expect(KOD.lines).toHaveLength(87);
    expect(KOD.lines[0]).toBe('// Dosya: BasitJWT.ts');
    expect(KOD.title).toBe('Kod 10.3 · BasitJWT.ts');
    expect(KOD.satirlar).toEqual([421, 507]);
    expect(listing(LISTINGS, 'code-006').title).toBe("Yanlış: payload'da parola");
    expect(listing(LISTINGS, 'kod-10-3-cikti').lines).toHaveLength(4);
  });
});
