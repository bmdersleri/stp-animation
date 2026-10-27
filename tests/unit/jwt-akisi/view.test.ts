import { describe, expect, it } from 'vitest';
import { LISTINGS } from '../../../src/concepts/jwt-akisi/code-text';
import { jwtScenario as sc, type JwtParams } from '../../../src/concepts/jwt-akisi/scenario';
import { deriveJwtView, jwtLabRozet } from '../../../src/concepts/jwt-akisi/view';
import { lineOf, listing } from '../../../src/core/listing';

const step = (n: number): JwtParams => sc.steps[n - 1].params as JwtParams;
const view = (n: number) => deriveJwtView(step(n));
const kitapCikti = listing(LISTINGS, 'kod-10-3-cikti').lines;
const KOD = listing(LISTINGS, 'kod-10-3');

describe('jwt-akisi view', () => {
  it('step 7 imza kaldi and later checks atlandi', () => {
    const d = view(7).denetim!.denetimler;
    expect(d.map((x) => x.durum)).toEqual(['gecti', 'kaldi', 'atlandi', 'atlandi', 'atlandi']);
    expect(d[1].sonuc).toBe('401');
  });

  it('step 8 incoming and expected signatures differ', () => {
    const [gelen, beklenen] = view(8).imzalar;
    expect(gelen.baslik).toBe('Gelen imza');
    expect(beklenen.baslik).toBe('Beklenen imza');
    expect(gelen.parcalar[0].metin).not.toBe(beklenen.parcalar[0].metin);
    expect(gelen.parcalar[0].fark!.length).toBeGreaterThan(0);
    expect(view(6).imzalar[0].parcalar[0].fark ?? []).toEqual([]);
  });

  it('step 10 Biçim kaldi and token strip has four parts', () => {
    const v = view(10);
    expect(v.denetim!.denetimler.map((x) => x.durum)).toEqual(['kaldi', 'atlandi', 'atlandi', 'atlandi', 'atlandi']);
    expect(v.token!.parcalar.map((p) => p.metin).at(-1)).toBe('fazladan');
    expect(v.token!.parcalar.map((p) => p.ton)).toEqual([0, 1, 2, 3]);
    expect(v.imzalar).toEqual([]);
  });

  it('step 6 terminal equals first book line', () => {
    expect(view(6).terminal).toEqual([{ metin: kitapCikti[0] }]);
    expect(view(6).denetim!.denetimler.every((d) => d.durum === 'gecti')).toBe(true);
  });

  it('step 10 terminal equals four book lines', () => {
    expect(view(10).terminal.map((t) => t.metin)).toEqual(kitapCikti);
    expect(view(7).terminal).toHaveLength(2);
    expect(view(9).terminal).toHaveLength(3);
  });

  it('step 8 terminal is only its own call', () => {
    expect(view(8).terminal).toEqual([{ metin: '401: Token imzası geçersiz.' }]);
  });

  it('token strip follows the stage', () => {
    expect(view(2).token!.parcalar).toHaveLength(1);
    expect(view(3).token!.parcalar).toHaveLength(2);
    expect(view(5).token!.parcalar).toHaveLength(3);
    expect(view(2).payload).toBeNull();
    expect(view(3).payload).toContain('"kullaniciAdi": "elif"');
    expect(view(2).header).toBe('{\n  "alg": "HS256",\n  "tip": "JWT"\n}');
  });

  it('okunur shows the code_006 body and its terminal line', () => {
    const v = view(4);
    expect(v.payload).toBe(listing(LISTINGS, 'code-006-cikti').lines[0]);
    expect(v.terminal.map((t) => t.metin)).toEqual([v.payload]);
    expect(v.code.title).toBe(listing(LISTINGS, 'code-006').title);
  });

  it('lab dakika 16 fails Süre', () => {
    const v = deriveJwtView({ ...step(6), dakika: 16 });
    const d = v.denetim!.denetimler;
    expect(d[4]).toMatchObject({ ad: 'Süre', durum: 'kaldi', sonuc: '401' });
    expect(v.terminal).toEqual([{ metin: '401: Token süresi dolmuş.' }]);
    expect(deriveJwtView({ ...step(6), dakika: 15 }).denetim!.denetimler[4].durum).toBe('gecti');
  });

  it('lab success prints the payload of the chosen user', () => {
    const v = deriveJwtView({ ...step(6), kullanici: 'yasemin' });
    expect(v.terminal).toHaveLength(1);
    expect(v.terminal[0].metin).toContain("rol: 'kutuphaneci'");
  });

  it('bozuk-json writes stderr', () => {
    const v = deriveJwtView({ ...step(6), bozulma: 'bozuk-json' });
    expect(v.terminal).toHaveLength(1);
    expect(v.terminal[0].akis).toBe('stderr');
    expect(v.terminal[0].metin).toMatch(/^SyntaxError/);
    expect(v.denetim!.denetimler[2].durum).toBe('kaldi');
  });

  it('akis has two lanes and five messages', () => {
    const s = view(11).sequence!;
    expect(s.lanes.map((l) => l.id)).toEqual(['istemci', 'sunucu']);
    expect(s.messages).toHaveLength(5);
    expect(s.messages.map((m) => m.kind)).toEqual(['request', 'response', 'request', 'note', 'response']);
    expect(s.ariaLabel).toBe('JWT akışı sıra diyagramı');
    expect(view(6).sequence).toBeNull();
  });

  it('code strip line follows decision', () => {
    expect(view(2).code.active).toEqual([lineOf(KOD, 'const header = base64UrlKodla')]);
    expect(view(3).code.active).toEqual([lineOf(KOD, 'const govde = base64UrlKodla')]);
    expect(view(5).code.active).toEqual([lineOf(KOD, 'const imza = imzaOlustur')]);
    expect(view(6).code.active).toEqual([lineOf(KOD, 'return payload;')]);
    expect(view(7).code.active).toEqual([lineOf(KOD, '401: Token imzası geçersiz.')]);
    expect(view(9).code.active).toEqual([lineOf(KOD, '401: Token süre alanı eksik.')]);
    expect(view(10).code.active).toEqual([lineOf(KOD, '401: Token biçimi geçersiz.')]);
    expect(deriveJwtView({ ...step(6), dakika: 16 }).code.active).toEqual([lineOf(KOD, '401: Token süresi dolmuş.')]);
  });

  it('lab badge is always kitap-kodu', () => {
    expect(jwtLabRozet(step(6))).toEqual({ tur: 'kitap-kodu' });
  });
});
