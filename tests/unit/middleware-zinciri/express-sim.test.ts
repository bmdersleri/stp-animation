import { describe, expect, it } from 'vitest';
import { listing } from '../../../src/core/listing';
import { ANAHTAR, kod010, kod017, kod55, type LabSecenek } from '../../../src/concepts/middleware-zinciri/apps';
import { HATA_ORNEGI, LISTINGS } from '../../../src/concepts/middleware-zinciri/code-text';
import { dispatch, HEADERS_SENT, type Iz, type Katman } from '../../../src/concepts/middleware-zinciri/express-sim';

const DEF: LabSecenek = { gunlukNext: true, kontrolGenel: false, hataKatmani: true };
const get = (yol: string, anahtar?: string) => ({
  metot: 'GET' as const,
  yol,
  basliklar: anahtar ? { 'x-api-anahtari': anahtar } : ({} as Record<string, string>),
});
const metinler = (iz: Iz) => iz.terminal.map((t) => t.metin);
const girenler = (iz: Iz) => iz.olaylar.filter((o) => o.tur === 'gir').map((o) => o.katman);
const atlananlar = (iz: Iz) => iz.olaylar.filter((o) => o.tur === 'atla').map((o) => o.katman);

describe('express-sim dispatch', () => {
  it('valid key reaches the handler', () => {
    const iz = dispatch(kod55(DEF), get('/korumali-durum', ANAHTAR));
    expect(iz.yanit).toEqual({ durumKodu: 200, govde: '{"mesaj":"Korumalı bilgiye erişildi."}' });
    expect(metinler(iz)).toEqual(['GET /korumali-durum']);
    expect(iz.askida).toBe(false);
  });

  it('missing key gives the book 401', () => {
    const iz = dispatch(kod55(DEF), get('/korumali-durum'));
    expect(iz.yanit).toEqual({ durumKodu: 401, govde: '{"mesaj":"Yetkisiz istek."}' });
    expect(metinler(iz)).toEqual(['GET /korumali-durum']);
    expect(girenler(iz)).not.toContain('isleyici');
  });

  it('wrong key gives 401', () => {
    const iz = dispatch(kod55(DEF), get('/korumali-durum', 'yanlis-anahtar'));
    expect(iz.yanit?.durumKodu).toBe(401);
    expect(girenler(iz)).not.toContain('isleyici');
  });

  it('layers run in registration order', () => {
    const iz = dispatch(kod55(DEF), get('/korumali-durum', ANAHTAR));
    expect(girenler(iz)).toEqual(['json', 'gunluk', 'anahtar', 'isleyici']);
  });

  it('unmatched path runs global middleware then 404', () => {
    const iz = dispatch(kod55(DEF), get('/baska'));
    expect(metinler(iz)).toEqual(['GET /baska']);
    expect(iz.yanit).toEqual({ durumKodu: 404, govde: 'Cannot GET /baska' });
    expect(girenler(iz)).toEqual(['json', 'gunluk']);
    expect(atlananlar(iz)).toEqual(expect.arrayContaining(['anahtar', 'isleyici']));
  });

  it('global key check makes /baska 401', () => {
    const iz = dispatch(kod55({ ...DEF, kontrolGenel: true }), get('/baska'));
    expect(iz.yanit?.durumKodu).toBe(401);
    expect(girenler(iz)).toEqual(['json', 'gunluk', 'anahtar']);
  });

  it('forgotten next hangs', () => {
    const iz = dispatch(kod55({ ...DEF, gunlukNext: false }), get('/korumali-durum', ANAHTAR));
    expect(iz.askida).toBe(true);
    expect(iz.yanit).toBeUndefined();
    expect(iz.olaylar.at(-1)?.tur).toBe('askida');
    expect(iz.olaylar.at(-1)?.katman).toBe('gunluk');
  });

  it('code_010 prints the book lines', () => {
    const iz = dispatch(kod010(), get('/kitaplar'));
    expect(metinler(iz)).toEqual(['/kitaplar']);
    expect(iz.askida).toBe(true);
    expect(iz.yanit).toBeUndefined();
  });

  it('double response', () => {
    const iz = dispatch(kod017(), get('/kitaplar/99'));
    expect(iz.yanit?.durumKodu).toBe(404);
    expect(iz.yanit?.govde).toBe('{"mesaj":"Kitap bulunamadı."}');
    expect(iz.terminal.at(-1)).toMatchObject({ metin: HEADERS_SENT, akis: 'stderr' });
    expect(iz.olaylar.filter((o) => o.tur === 'yanit')).toHaveLength(1);
  });

  it('thrown error skips normal layers and reaches the error layer', () => {
    const iz = dispatch(kod55(DEF), get('/hata-ornegi'));
    expect(iz.yanit).toEqual({ durumKodu: 500, govde: '{"mesaj":"Sunucuda beklenmeyen bir hata oluştu."}' });
    expect(iz.terminal.at(-1)).toMatchObject({ metin: 'Beklenmeyen durum', akis: 'stderr' });
    const i = iz.olaylar.findIndex((o) => o.tur === 'hata' && o.katman === 'hataRoute');
    expect(i).toBeGreaterThan(0);
    expect(girenler({ ...iz, olaylar: iz.olaylar.slice(i) })).toEqual(['hataMw']);
  });

  it('no error layer gives the default 500', () => {
    const iz = dispatch(kod55({ ...DEF, hataKatmani: false }), get('/hata-ornegi'));
    expect(iz.yanit).toEqual({ durumKodu: 500, govde: 'Internal Server Error' });
    expect(iz.terminal.at(-1)).toMatchObject({ metin: 'Error: Beklenmeyen durum', akis: 'stderr' });
  });

  it('error layer is skipped without an error', () => {
    // A response ends the chain (real Express), so the error layer shows as skipped only when the request reaches it: /baska.
    const iz = dispatch(kod55(DEF), get('/baska'));
    expect(iz.olaylar).toContainEqual(expect.objectContaining({ tur: 'atla', katman: 'hataMw' }));
    expect(girenler(iz)).not.toContain('hataMw');
  });

  it('event limit', () => {
    const app: Katman[] = Array.from({ length: 30 }, (_, i) => ({
      tur: 'use' as const,
      fn: { ad: `f${i}`, arity: 3 as const, satir: 1, govde: (c) => c.next() },
    }));
    expect(() => dispatch(app, get('/'))).toThrow('dispatch: olay sınırı');
  });

  it('every event line points into its listing', () => {
    const kod = listing(LISTINGS, 'kod-5-5').lines;
    const cases: [Iz, readonly string[]][] = [
      [dispatch(kod55(DEF), get('/korumali-durum', ANAHTAR)), kod],
      [dispatch(kod55(DEF), get('/korumali-durum')), kod],
      [dispatch(kod55(DEF), get('/baska')), kod],
      [dispatch(kod55({ ...DEF, gunlukNext: false }), get('/baska')), kod],
      [dispatch(kod010(), get('/kitaplar')), listing(LISTINGS, 'code-010').lines],
      [dispatch(kod017(), get('/kitaplar/99')), listing(LISTINGS, 'code-017').lines],
    ];
    for (const [iz, lines] of cases) {
      for (const o of iz.olaylar) {
        if (o.katman === 'varsayilan') continue;
        expect(lines[o.satir - 1], `${o.tur} ${o.katman} line ${o.satir}`).toBeTruthy();
      }
    }
    const hata = dispatch(kod55(DEF), get('/hata-ornegi'));
    for (const o of hata.olaylar) {
      if (o.katman === 'hataRoute' || o.katman === 'hataMw') {
        expect(HATA_ORNEGI.lines[o.satir - 1], `${o.tur} ${o.katman}`).toBeTruthy();
      } else if (o.katman !== 'varsayilan') expect(kod[o.satir - 1]).toBeTruthy();
    }
  });
});

describe('middleware-zinciri listings', () => {
  it('listings match the book', () => {
    const k = listing(LISTINGS, 'kod-5-5').lines;
    expect(k[0]).toBe('import express, { NextFunction, Request, Response } from "express";');
    expect(k.at(-1)).toBe('// Çıktı: Geçersiz anahtarda 401 {"mesaj":"Yetkisiz istek."}');
    expect(listing(LISTINGS, 'code-010-cikti').lines).toEqual(['/kitaplar', 'zincir surdu mu: false']);
    expect(listing(LISTINGS, 'code-011-cikti').lines.at(-1)).toBe('zincir surdu mu: true');
    expect(LISTINGS.map((l) => l.id)).toEqual([
      'kod-5-5',
      'code-010',
      'code-010-cikti',
      'code-011',
      'code-011-cikti',
      'code-017',
    ]);
    expect(HATA_ORNEGI.lines).toHaveLength(8);
  });
});
