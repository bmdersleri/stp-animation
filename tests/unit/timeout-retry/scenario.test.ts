import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { TIMEOUT_ROZET, timeoutScenario as sc, type TimeoutParams } from '../../../src/concepts/timeout-retry/scenario';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'zamansiz', 'abort', 'basarili', 'izolasyon', 'gecici-kalici', 'retry-bekle', 'retry-tukendi', 'dogrulama', 'ozet'];
const ROZET: [string, string][] = [
  ['kitap', 'L316, L318'],
  ['kitaba-dayali', 'L162, L175'],
  ['kitap-kodu', 'L360-376'],
  ['kitap-kodu', 'L373-375, L405'],
  ['kitap', 'L405-407'],
  ['kitap-kodu', 'L337, L369-372'],
  ['kitaba-dayali', 'L335, L443, L794'],
  ['kitaba-dayali', 'L335, L448, L471'],
  ['kitap', 'L772-776'],
  ['kitap', 'L440-446, L806'],
];
const LAB: TimeoutParams = { asama: 'akis', surum: '17.5', zamanAsimiMs: 5000, senaryo: 'gecici', maksRetry: 1, beklemeTabanMs: 1000, servisGecikmesiMs: 8000 };

describe('timeout-retry scenario', () => {
  it('has 10 steps with spec ids', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('badges match table', () => {
    IDS.forEach((id, i) => expect([TIMEOUT_ROZET[id]?.tur, TIMEOUT_ROZET[id]?.ref], id).toEqual(ROZET[i]));
  });

  it('every step gives every param and the defaults are the Lab values', () => {
    expect(sc.defaults).toEqual(LAB);
    for (const s of sc.steps) expect(Object.keys(s.params!).sort(), s.id).toEqual(Object.keys(LAB).sort());
  });

  it('step params differ from the defaults as the table says', () => {
    const p = (id: string) => sc.steps[stepIndex(sc, id)].params as TimeoutParams;
    expect(p('tanitim')).toEqual({ ...LAB, asama: 'tanitim' });
    expect(p('zamansiz')).toEqual({ ...LAB, asama: 'zamansiz' });
    expect(p('abort')).toEqual({ ...LAB, surum: '17.3', senaryo: 'yavas', maksRetry: 0 });
    expect(p('basarili')).toEqual({ ...LAB, surum: '17.3', senaryo: 'hizli', maksRetry: 0 });
    expect(p('izolasyon')).toEqual({ ...LAB, asama: 'izolasyon' });
    expect(p('gecici-kalici')).toEqual({ ...LAB, asama: 'hata-turleri' });
    expect(p('retry-bekle')).toEqual(LAB);
    expect(p('retry-tukendi')).toEqual({ ...LAB, senaryo: 'yavas' });
    expect(p('dogrulama')).toEqual({ ...LAB, asama: 'dogrulama' });
    expect(p('ozet')).toEqual({ ...LAB, asama: 'ozet' });
  });

  labTextTests(sc.steps, [3, 4, 7, 8]);
});
