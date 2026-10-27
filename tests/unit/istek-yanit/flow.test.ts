import { describe, expect, it } from 'vitest';
import { MINI_APP, lineOf } from '../../../src/concepts/istek-yanit/code-text';
import { YOLLAR, notSorgula } from '../../../src/concepts/istek-yanit/flow';

describe('istek-yanit flow', () => {
  it('book output, authorised', () => {
    const iz = notSorgula('/api/notlar/2026001', true);
    expect(iz.cikti).toBe('[200] 2026001 numaralı öğrencinin notu: 88');
    expect(iz.istek).toEqual({ yol: '/api/notlar/2026001', kullaniciAdi: 'ayse', yetkiliMi: true });
    expect(iz.olaylar).toHaveLength(11);
    expect(iz.durduran).toBe('backend');
  });

  it('book output, unauthorised', () => {
    const iz = notSorgula('/api/notlar/2026001', false);
    expect(iz.cikti).toBe('[401] Kimlik doğrulaması gerekli.');
    expect(iz.durduran).toBe('tersVekil');
    for (const o of iz.olaylar) {
      expect([o.from, o.to]).not.toContain('notApi');
      expect([o.from, o.to]).not.toContain('backend');
    }
  });

  it('book output, unknown student', () => {
    const iz = notSorgula('/api/notlar/2026999', true);
    expect(iz.cikti).toBe('[404] Öğrenci kaydı bulunamadı.');
    expect(iz.durduran).toBe('backend');
    expect(iz.olaylar.find((o) => o.kind === 'note' && o.from === 'backend')!.ok).toBe(false);
  });

  it('missing number gives 400 at the API', () => {
    const iz = notSorgula('/api/notlar/', true);
    expect(iz.cikti).toBe('[400] Öğrenci numarası eksik.');
    expect(iz.durduran).toBe('notApi');
    expect(iz.olaylar.find((o) => o.from === 'notApi' && o.kind === 'note')!.label).toBe('yol.split("/")[3] → ""');
  });

  it('foreign path stops at the proxy', () => {
    const iz = notSorgula('/api/odeme', true);
    expect(iz.cikti).toBe('[404] Proxy için uygun yol bulunamadı.');
    expect(iz.durduran).toBe('tersVekil');
  });

  it('auth is checked before the path', () => {
    expect(notSorgula('/api/odeme', false).yanit.durumKodu).toBe(401);
  });

  it('every line points into the listing', () => {
    for (const yol of YOLLAR) {
      for (const yetkili of [true, false]) {
        const iz = notSorgula(yol, yetkili);
        for (const o of iz.olaylar) {
          expect(o.line).toBeGreaterThanOrEqual(1);
          expect(o.line).toBeLessThanOrEqual(MINI_APP.length);
        }
        expect(iz.olaylar[iz.olaylar.length - 1]).toMatchObject({ kind: 'note', from: 'istemci', label: iz.cikti });
      }
    }
    const resp = notSorgula('/api/notlar/2026001', false).olaylar.find((o) => o.kind === 'response')!;
    expect(MINI_APP[resp.line - 1]).toContain('durumKodu: 401');
  });

  it('events follow the book order for the 200 trace', () => {
    const o = notSorgula('/api/notlar/2026001', true).olaylar;
    expect(o.map((e) => `${e.kind}:${e.from}>${e.to}`)).toEqual([
      'request:istemci>tersVekil', 'note:tersVekil>tersVekil', 'note:tersVekil>tersVekil', 'request:tersVekil>notApi',
      'note:notApi>notApi', 'request:notApi>backend', 'note:backend>backend',
      'response:backend>notApi', 'response:notApi>tersVekil', 'response:tersVekil>istemci', 'note:istemci>istemci',
    ]);
    expect(o[0].label).toBe('GET /api/notlar/2026001');
    expect(o[0].line).toBe(lineOf('this.tersVekil.yonlendir(istek)'));
  });

  it('MINI_APP starts and ends like the book', () => {
    expect(MINI_APP[0]).toBe('// File: ChapterMiniApp.ts');
    expect(MINI_APP.join('\n')).toContain('istemci.notSorgula("2026999", true);');
    expect(MINI_APP).toHaveLength(93);
  });
});
