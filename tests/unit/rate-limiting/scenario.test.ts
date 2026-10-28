import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { RATE_ROZET, rateScenario as sc, TUMU, type RateParams } from '../../../src/concepts/rate-limiting/scenario';
import { deriveRateView } from '../../../src/concepts/rate-limiting/view';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'ilk-istek', 'artir', 'sinir', 'pencere-doldu', 'ayri-anahtar', 'sinirda-patlama', 'login-sira', 'login-429', 'ozet'];
const ROZET: [string, string][] = [
  ['kitap', 'L675, L678'],
  ['kitap-kodu', 'L756'],
  ['kitap-kodu', 'L757-758'],
  ['kitap-kodu', 'L759-760, L793'],
  ['kitap-kodu', 'L763'],
  ['kitap-kodu', 'L793'],
  ['kitap-kodu', 'L771'],
  ['kitap-kodu', 'L158, L1207-1208'],
  ['kitap-kodu', 'L1171-1172'],
  ['kitap', 'L763, L771-774'],
];

describe('rate-limiting scenario', () => {
  it('has 10 steps with spec ids', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('badges match table', () => {
    IDS.forEach((id, i) => expect([RATE_ROZET[id]?.tur, RATE_ROZET[id]?.ref], id).toEqual(ROZET[i]));
  });

  it('every step gives every param and the documented defaults hold', () => {
    expect(sc.defaults).toEqual({ desen: 'kitap', maksimumIstek: 3, pencereSn: 60, elle: [], istek: TUMU, asama: 'akis' });
    for (const s of sc.steps) expect(Object.keys(s.params!).sort(), s.id).toEqual(Object.keys(sc.defaults).sort());
  });

  it('step params differ from the defaults as the table says', () => {
    const p = (id: string) => sc.steps[stepIndex(sc, id)].params as RateParams;
    expect(p('tanitim').asama).toBe('tanitim');
    expect(p('ilk-istek').istek).toBe(1);
    expect(p('artir').istek).toBe(3);
    expect(p('sinir')).toEqual(sc.defaults);
    expect(p('pencere-doldu').desen).toBe('pencere');
    expect(p('ayri-anahtar').desen).toBe('ayri-ip');
    expect(p('sinirda-patlama').desen).toBe('sinir');
    expect(p('login-sira')).toMatchObject({ desen: 'login', istek: 2 });
    expect(p('login-429')).toMatchObject({ desen: 'login', istek: TUMU });
    expect(p('ozet').asama).toBe('ozet');
  });

  it('kitap-badged steps show no computed values', () => {
    const kitap = sc.steps.filter((s) => RATE_ROZET[s.id].tur === 'kitap');
    expect(kitap.map((s) => s.id)).toEqual(['tanitim', 'ozet']);
    for (const s of kitap) {
      const v = deriveRateView(s.params as RateParams, true);
      expect(v.timeline.noktalar, s.id).toEqual([]);
      expect(v.timeline.bantlar, s.id).toEqual([]);
      expect(v.timeline.ipler, s.id).toEqual([]);
      expect(v.tablo.satirlar, s.id).toEqual([]);
      expect(v.terminal, s.id).toEqual([]);
      expect(v.denetim, s.id).toBeNull();
      expect(v.code.active, s.id).toEqual([]);
    }
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
