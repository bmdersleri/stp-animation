import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { CORS_ROZET, corsScenario as sc, TUMU, type CorsParams } from '../../../src/concepts/cors-preflight/scenario';
import { deriveCorsView } from '../../../src/concepts/cors-preflight/view';
import { KOKEN_URL } from '../../../src/concepts/cors-preflight/tarayici';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'izinli', 'izinsiz', 'sunucu-reddi', 'curl', 'wildcard', 'preflight-gerekli', 'preflight-eksik', 'preflight-tamam', 'ozet'];
const ROZET: [string, string][] = [
  ['kitaba-dayali', 'L540'],
  ['kitap-kodu', 'L614-620'],
  ['kitap-kodu', 'L621, L552-556'],
  ['kitap-kodu', 'L1116, L1208'],
  ['kitaba-dayali', 'L543, L670'],
  ['kitaba-dayali', 'L633, L649'],
  ['standart', 'Fetch'],
  ['standart', 'Fetch, L624, L646'],
  ['standart', 'Fetch, cors'],
  ['kitap', 'L550-554, L644-647'],
];

describe('cors-preflight scenario', () => {
  it('has 10 steps with spec ids', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('badges match table', () => {
    IDS.forEach((id, i) => expect([CORS_ROZET[id]?.tur, CORS_ROZET[id]?.ref], id).toEqual(ROZET[i]));
  });

  it('every step gives every param and the documented defaults hold', () => {
    expect(sc.defaults).toEqual({ koken: 'kutuphane', istemci: 'tarayici', istek: 'get-kitaplar', kimlik: 'include', sunucu: 'kitap-karari', asama: 'akis', olay: TUMU });
    for (const s of sc.steps) expect(Object.keys(s.params!).sort(), s.id).toEqual(Object.keys(sc.defaults).sort());
  });

  it('step params differ from the defaults as the table says', () => {
    const p = (id: string) => sc.steps[stepIndex(sc, id)].params as CorsParams;
    expect(p('sunucu-reddi')).toMatchObject({ koken: 'kotu', istemci: 'curl-origin', istek: 'post-giris', sunucu: 'kitap-11-7' });
    expect(p('preflight-gerekli')).toMatchObject({ istek: 'post-giris', olay: 2 });
    expect(p('preflight-tamam')).toMatchObject({ istek: 'post-giris', sunucu: 'cors-paketi' });
  });

  it('kitap-badged steps show no computed values', () => {
    const kitap = sc.steps.filter((s) => CORS_ROZET[s.id].tur === 'kitap');
    expect(kitap.map((s) => s.id)).toEqual(['ozet']);
    for (const s of kitap) {
      const v = deriveCorsView(s.params as CorsParams, true);
      // the book block is the book's own printed text (its tables name Access-Control-Allow-Origin); everything else must be empty
      const metin = JSON.stringify({ ...v, code: undefined, kitap: undefined });
      expect(v.sequence.messages, s.id).toEqual([]);
      expect(v.http, s.id).toEqual({ yanitlar: [], terminal: [] });
      expect(v.denetim, s.id).toBeNull();
      expect(v.aciklama, s.id).toBeNull();
      expect(v.kokenler, s.id).toEqual({ sayfa: '', api: '' });
      for (const url of Object.values(KOKEN_URL)) expect(metin, s.id).not.toContain(url);
      expect(metin, s.id).not.toContain('Access-Control');
    }
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
