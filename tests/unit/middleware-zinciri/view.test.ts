import { describe, expect, it } from 'vitest';
import { lineOf } from '../../../src/core/listing';
import { HATA_ORNEGI, LISTINGS } from '../../../src/concepts/middleware-zinciri/code-text';
import { HEADERS_SENT } from '../../../src/concepts/middleware-zinciri/express-sim';
import { TUMU, type MwParams } from '../../../src/concepts/middleware-zinciri/scenario';
import { deriveMwView, mwIz, mwLabRozet } from '../../../src/concepts/middleware-zinciri/view';

const base: MwParams = {
  program: 'kod-5-5',
  yol: '/korumali-durum',
  anahtar: 'gecerli',
  gunlukNext: true,
  kontrolGenel: false,
  hataKatmani: true,
  olay: 0,
  gorunum: 'akis',
};
const tam = (p: Partial<MwParams>): MwParams => ({ ...base, ...p, olay: TUMU });
const son = <T>(a: readonly T[]): T => a[a.length - 1];

describe('middleware-zinciri view', () => {
  it('step 1 shows lanes only', () => {
    const v = deriveMwView(base);
    expect(v.sequence.lanes.map((l) => l.id)).toEqual(['istemci', 'json', 'gunluk', 'anahtar', 'isleyici']);
    expect(v.sequence.messages).toHaveLength(0);
    expect(v.http.istek).toBeUndefined();
    expect(v.http.yanitlar).toEqual([]);
    expect(v.code.active).toEqual([]);
  });

  it('builds the request with the key header', () => {
    const v = deriveMwView({ ...base, olay: 1 });
    expect(v.http.istek).toEqual({ metot: 'GET', yol: '/korumali-durum', basliklar: [['x-api-anahtari', 'kitap-api-2026']] });
    expect(deriveMwView({ ...base, anahtar: 'yanlis', olay: 1 }).http.istek?.basliklar).toEqual([['x-api-anahtari', 'yanlis-anahtar']]);
    expect(deriveMwView({ ...base, anahtar: 'yok', olay: 1 }).http.istek?.basliklar).toBeUndefined();
    expect(mwIz({ ...base, program: 'next-unutma' }).olaylar.length).toBeGreaterThan(0);
  });

  it('step 5 response goes straight to the client', () => {
    const v = deriveMwView(tam({}));
    const m = son(v.sequence.messages);
    expect([m.from, m.to, m.label, m.kind]).toEqual(['isleyici', 'istemci', '200 OK', 'response']);
    expect(v.sequence.stopAt).toBe('isleyici');
    expect(v.sequence.stopTone).toBe('ok');
    expect(v.sequence.dim).toEqual([]);
    expect(v.http.terminal.map((t) => t.metin)).toEqual(['GET /korumali-durum']);
    expect(v.http.yanitlar[0]).toMatchObject({ durumKodu: 200, durumMetni: 'OK' });
    expect(v.sequence.messages[0].label).toBe('GET /korumali-durum');
    expect(v.sequence.messages[1].label).toBe('next()');
  });

  it('step 6 dims the handler', () => {
    const v = deriveMwView(tam({ anahtar: 'yok' }));
    expect(v.sequence.dim).toEqual(expect.arrayContaining(['isleyici']));
    expect(son(v.sequence.messages).label).toBe('401 Unauthorized');
    expect(v.sequence.stopAt).toBe('anahtar');
    expect(v.sequence.stopTone).toBe('alarm');
  });

  it('step 7 runs the global layers', () => {
    const v = deriveMwView(tam({ yol: '/baska', anahtar: 'yok' }));
    expect(v.http.terminal.map((t) => t.metin)).toEqual(['GET /baska']);
    expect(v.http.yanitlar[0]).toMatchObject({ durumKodu: 404, durumMetni: 'Not Found', govde: 'Cannot GET /baska' });
    expect(v.sequence.dim).toEqual(['anahtar', 'isleyici']);
    const m = son(v.sequence.messages);
    expect([m.from, m.to]).toEqual(['gunluk', 'istemci']);
    expect(v.code.active).toEqual([]);
  });

  it('step 8 hangs with the book output', () => {
    const v = deriveMwView(tam({ program: 'next-unutma', anahtar: 'yok' }));
    expect(v.http.terminal.map((t) => t.metin)).toEqual(['/kitaplar', 'zincir surdu mu: false']);
    expect(v.http.yanitlar).toEqual([{ durumKodu: 0, askida: true }]);
    expect(son(v.karsilastirma!)).toBe('zincir surdu mu: true');
    expect(son(v.sequence.messages).label).toBe('yanıt yok');
    expect(v.sequence.stopAt).toBe('gunluk');
    expect(v.sequence.lanes.map((l) => l.id)).toEqual(['istemci', 'gunluk', 'isleyici']);
    expect(v.code.title).toBe('Yaygın hata · next() unutuldu');
    expect(deriveMwView({ ...base, program: 'next-unutma', olay: 1 }).karsilastirma).toBeNull();
  });

  it('step 9 keeps the first response', () => {
    const v = deriveMwView(tam({ program: 'cift-yanit', anahtar: 'yok' }));
    expect(v.http.yanitlar).toHaveLength(1);
    expect(v.http.yanitlar[0].durumKodu).toBe(404);
    expect(son(v.http.terminal)).toEqual({ metin: HEADERS_SENT, akis: 'stderr' });
    expect(v.http.istek?.yol).toBe('/kitaplar/99');
    expect(v.sequence.stopAt).toBe('isleyici');
  });

  it('step 10 skips to the error layer', () => {
    const v = deriveMwView(tam({ yol: '/hata-ornegi' }));
    expect(v.sequence.lanes.map((l) => l.id)).toEqual(['istemci', 'json', 'gunluk', 'hataRoute', 'hataMw']);
    expect(v.http.yanitlar[0]).toMatchObject({ durumKodu: 500 });
    expect(v.http.terminal.filter((t) => t.akis === 'stderr').map((t) => t.metin)).toEqual(['Beklenmeyen durum']);
    expect(v.code.title).toBe(HATA_ORNEGI.title);
    expect(v.code.lines).toBe(HATA_ORNEGI.lines);
    const girisler = v.sequence.messages.filter((m) => m.kind === 'request').map((m) => m.label);
    expect(girisler).toContain('next(err)');
    expect(son(v.sequence.messages)).toMatchObject({ from: 'hataMw', to: 'istemci', label: '500 Internal Server Error' });
    expect(v.sequence.dim).toEqual([]);
  });

  it('final 500 without error layer is drawn on the lane that ran last', () => {
    const v = deriveMwView(tam({ yol: '/hata-ornegi', hataKatmani: false }));
    expect(son(v.sequence.messages)).toMatchObject({ from: 'hataRoute', to: 'istemci' });
    expect(v.sequence.dim).toEqual(['hataMw']);
  });

  it('summary shows the five rows and the full 200 trace', () => {
    const v = deriveMwView({ ...base, yol: '/hata-ornegi', gorunum: 'ozet', olay: 0 });
    expect(v.ozet).toHaveLength(5);
    expect(v.ozet![3]).toEqual({ katman: 'Route işleyicisi', ne: 'yanıtı üretir', sonuc: '200 yanıtı' });
    expect(son(v.sequence.messages).label).toBe('200 OK');
    expect(deriveMwView(base).ozet).toBeNull();
  });

  it('olay is clamped to the trace length', () => {
    const n = mwIz(base).olaylar.length;
    expect(deriveMwView({ ...base, olay: TUMU })).toEqual(deriveMwView({ ...base, olay: n }));
    expect(deriveMwView({ ...base, olay: -3 })).toEqual(deriveMwView({ ...base, olay: 0 }));
  });

  it('lab badge priority', () => {
    expect(mwLabRozet({ ...base, yol: '/hata-ornegi', kontrolGenel: true })).toEqual({ tur: 'kitaba-dayali', ref: 'L1814-1818' });
    expect(mwLabRozet({ ...base, yol: '/baska', kontrolGenel: true })).toEqual({ tur: 'kitaba-dayali', ref: 'L558' });
    expect(mwLabRozet({ ...base, kontrolGenel: true, gunlukNext: false })).toEqual({ tur: 'kitaba-dayali', ref: 'L674' });
    expect(mwLabRozet({ ...base, gunlukNext: false, anahtar: 'yok' })).toEqual({ tur: 'kitaba-dayali', ref: 'L1189' });
    expect(mwLabRozet({ ...base, anahtar: 'yanlis' })).toEqual({ tur: 'kitap', ref: 'L668' });
    expect(mwLabRozet(base)).toEqual({ tur: 'kitap-kodu' });
  });

  it('code highlights the last shown event line', () => {
    const kod = LISTINGS.find((l) => l.id === 'kod-5-5')!;
    const iz = mwIz(base);
    const i = iz.olaylar.findIndex((o) => o.tur === 'log' && o.katman === 'gunluk');
    expect(deriveMwView({ ...base, olay: i + 1 }).code.active).toEqual([lineOf(kod, 'console.log(`${istek.method}')]);
    const j = iz.olaylar.findIndex((o) => o.tur === 'gir' && o.katman === 'json');
    expect(deriveMwView({ ...base, olay: j + 1 }).code.active).toEqual([lineOf(kod, 'uygulama.use(express.json())')]);
    // events of lanes outside the shown listing never highlight
    const h = deriveMwView(tam({ yol: '/hata-ornegi' }));
    expect(h.code.active).toEqual([lineOf(HATA_ORNEGI, 'yanit.status(500)')]);
    const e = mwIz({ ...base, yol: '/hata-ornegi' }).olaylar.findIndex((o) => o.tur === 'gir' && o.katman === 'json');
    expect(deriveMwView({ ...base, yol: '/hata-ornegi', olay: e + 1 }).code.active).toEqual([]);
  });
});
