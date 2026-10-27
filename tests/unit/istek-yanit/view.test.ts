import { describe, expect, it } from 'vitest';
import { MINI_APP, lineOf } from '../../../src/concepts/istek-yanit/code-text';
import { notSorgula } from '../../../src/concepts/istek-yanit/flow';
import { LANES, deriveIstekView, type IstekParams } from '../../../src/concepts/istek-yanit/view';

const base: IstekParams = { yol: '/api/notlar/2026001', yetkiliMi: true, olay: 0, gorunum: 'akis' };
const all = notSorgula(base.yol, true).olaylar.length;

describe('istek-yanit view', () => {
  it('lanes carry the book class names', () => {
    expect(LANES.map((l) => l.id)).toEqual(['istemci', 'tersVekil', 'notApi', 'backend']);
    expect(LANES[0]).toMatchObject({ label: ['İstemci'], sub: 'TarayiciIstemcisi' });
    expect(LANES[3]).toMatchObject({ label: ['Backend servisi'], sub: 'NotBackendServisi' });
  });

  it('step 1 shows lanes only', () => {
    const v = deriveIstekView(base);
    expect(v.sequence.lanes).toHaveLength(4);
    expect(v.sequence.messages).toHaveLength(0);
    expect(v.istekKarti).toBeNull();
    expect(v.yanit).toBeNull();
    expect(v.terminal).toEqual([]);
    expect(v.code.active).toEqual([]);
  });

  it('step 7 shows the 200 response', () => {
    const v = deriveIstekView({ ...base, olay: all });
    expect(v.yanit?.durumKodu).toBe(200);
    expect(v.terminal).toEqual(['[200] 2026001 numaralı öğrencinin notu: 88']);
    expect(v.sequence.dim).toEqual([]);
    expect(v.istekKarti).toEqual({ yol: base.yol, kullaniciAdi: 'ayse', yetkiliMi: true });
  });

  it('step 8 dims API and backend', () => {
    const n = notSorgula(base.yol, false).olaylar.length;
    const v = deriveIstekView({ ...base, yetkiliMi: false, olay: n });
    expect(v.sequence.dim).toEqual(['notApi', 'backend']);
    expect(v.sequence.stopAt).toBe('tersVekil');
    expect(v.sequence.messages.filter((m) => m.tone === 'alarm').length).toBeGreaterThan(0);
  });

  it('stopAt appears with the first response, failed notes are alarms', () => {
    const yol = '/api/notlar/2026999';
    const firstResp = notSorgula(yol, true).olaylar.findIndex((o) => o.kind === 'response');
    expect(deriveIstekView({ ...base, yol, olay: firstResp }).sequence.stopAt).toBeUndefined();
    const v = deriveIstekView({ ...base, yol, olay: firstResp + 1 });
    expect(v.sequence.stopAt).toBe('backend');
    expect(v.sequence.messages[firstResp - 1].tone).toBe('alarm');
    expect(v.sequence.messages[firstResp].tone).toBe('alarm');
    expect(v.sequence.active).toBe(`m${firstResp}`);
  });

  it('olay is clamped to the trace length', () => {
    expect(deriveIstekView({ ...base, olay: 999 })).toEqual(deriveIstekView({ ...base, olay: all }));
    expect(deriveIstekView({ ...base, olay: -3 })).toEqual(deriveIstekView({ ...base, olay: 0 }));
  });

  it('ozet lists the three book calls', () => {
    const v = deriveIstekView({ ...base, gorunum: 'ozet' });
    expect(v.ozet).toHaveLength(3);
    expect(v.ozet!.map((r) => r.yanit.durumKodu)).toEqual([200, 401, 404]);
    expect(v.ozet!.map((r) => r.durduran)).toEqual(['backend', 'tersVekil', 'backend']);
    expect(v.terminal).toEqual([
      '[200] 2026001 numaralı öğrencinin notu: 88',
      '[401] Kimlik doğrulaması gerekli.',
      '[404] Öğrenci kaydı bulunamadı.',
    ]);
    expect(v.sequence.messages).toHaveLength(all);
    expect(deriveIstekView(base).ozet).toBeNull();
  });

  it('ozet card shows 200 request', () => {
    const v = deriveIstekView({ ...base, yol: '/api/notlar/2026999', yetkiliMi: false, gorunum: 'ozet' });
    expect(v.istekKarti).toEqual({ yol: '/api/notlar/2026001', kullaniciAdi: 'ayse', yetkiliMi: true });
  });

  it('NaN olay counts as 0', () => {
    expect(deriveIstekView({ ...base, olay: NaN })).toEqual(deriveIstekView({ ...base, olay: 0 }));
  });

  it('code highlights the active event line', () => {
    const v = deriveIstekView({ ...base, olay: 1 });
    expect(v.code.active).toEqual([lineOf('this.tersVekil.yonlendir(istek)')]);
    expect(v.code.lines).toBe(MINI_APP);
    expect(v.code.title).toBe('ChapterMiniApp.ts');
  });

  it('step 7 stops with the ok tone', () => {
    const v = deriveIstekView({ ...base, olay: all });
    expect(v.sequence.stopTone).toBe('ok');
    expect(v.sequence.ariaLabel).toBe('İstek-yanıt sıra diyagramı');
  });

  it('step 8 stops with the alarm tone', () => {
    const n = notSorgula(base.yol, false).olaylar.length;
    expect(deriveIstekView({ ...base, yetkiliMi: false, olay: n }).sequence.stopTone).toBe('alarm');
  });
});
