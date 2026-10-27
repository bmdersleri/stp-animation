import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { JWT_ROZET, jwtScenario as sc, type JwtParams } from '../../../src/concepts/jwt-akisi/scenario';
import { deriveJwtView } from '../../../src/concepts/jwt-akisi/view';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'header', 'payload', 'okunur', 'imza', 'dogrula', 'bozuk-imza', 'rol-degisti', 'sure-alani', 'fazla-segment', 'akis'];
const ROZET: [string, string][] = [
  ['kitap', 'L382'],
  ['kitap-kodu', 'L446'],
  ['kitap-kodu', 'L447'],
  ['kitap', 'L544, L575'],
  ['kitap-kodu', 'L441-448'],
  ['kitap-kodu', 'L512'],
  ['kitap-kodu', 'L513'],
  ['kitaba-dayali', 'L528'],
  ['kitap-kodu', 'L514'],
  ['kitap-kodu', 'L515'],
  ['kitaba-dayali', 'L385, L399, L401'],
];

describe('jwt-akisi scenario', () => {
  it('has 11 steps with spec ids', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('badges match table', () => {
    IDS.forEach((id, i) => expect([JWT_ROZET[id]?.tur, JWT_ROZET[id]?.ref], id).toEqual(ROZET[i]));
  });

  it('every step gives every param and the documented defaults hold', () => {
    expect(sc.defaults).toEqual({ kullanici: 'elif', bozulma: 'yok', dakika: 0, asama: 'dogrula' });
    for (const s of sc.steps) expect(Object.keys(s.params!).sort(), s.id).toEqual(Object.keys(sc.defaults).sort());
  });

  it('kitap-badged steps show no computed values', () => {
    const kitap = sc.steps.filter((s) => JWT_ROZET[s.id].tur === 'kitap');
    expect(kitap.map((s) => s.id)).toEqual(['tanitim', 'okunur']);
    for (const s of kitap) {
      const v = deriveJwtView(s.params as JwtParams);
      expect(v.token, s.id).toBeNull();
      expect(v.imzalar.length, s.id).toBe(0);
    }
  });

  it('the akis step says the diagram is a simplified summary', () => {
    expect(sc.steps[10].text).toContain('sadeleştirilmiş özet');
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});
