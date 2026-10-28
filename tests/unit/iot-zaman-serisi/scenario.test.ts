import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { IOT_ROZET, iotScenario as sc, type IotParams } from '../../../src/concepts/iot-zaman-serisi/scenario';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'dogrulamasiz', 'imza-uret', 'zaman-penceresi', 'imza-dogrula', 'govde-degisti', 'pencere-ici-tekrar', 'aralik-dogrulama', 'sunucu-zamani-kayit', 'tampon-saatlik', 'ozet'];
const ROZET: [string, string][] = [
  ['kitap', 'L81, L84'],
  ['kitaba-dayali', 'L203, L572'],
  ['kitap-kodu', 'L360, L409-411'],
  ['kitap-kodu', 'L399-401'],
  ['kitap-kodu', 'L404-423'],
  ['kitap-kodu', 'L420, L434'],
  ['kitaba-dayali', 'L398, L433, L770'],
  ['kitap', 'L544-546'],
  ['kitap-kodu', 'L521, L554, L558'],
  ['kitap-kodu', 'L716-734, L740-749, L761'],
  ['kitap', 'L448, L462, L565-572, L998'],
];
const LAB = { asama: 'istek', saatFarki: 0, sicaklik: 21.5, nem: 45.2, govde: 'saglam', tekrar: false };

describe('iot-zaman-serisi scenario', () => {
  it('has 11 steps with spec ids', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('badges match table', () => {
    IDS.forEach((id, i) => expect([IOT_ROZET[id]?.tur, IOT_ROZET[id]?.ref], id).toEqual(ROZET[i]));
  });

  it('every step gives every param and the defaults are the Lab values', () => {
    expect(sc.defaults).toEqual(LAB);
    for (const s of sc.steps) expect(Object.keys(s.params!).sort(), s.id).toEqual(Object.keys(LAB).sort());
  });

  it('step params differ from the defaults as the table says', () => {
    const p = (id: string) => sc.steps[stepIndex(sc, id)].params as IotParams;
    expect(p('tanitim')).toEqual({ ...LAB, asama: 'tanitim' });
    expect(p('dogrulamasiz')).toEqual({ ...LAB, asama: 'dogrulamasiz', sicaklik: -999 });
    expect(p('imza-uret')).toEqual({ ...LAB, asama: 'imza' });
    expect(p('zaman-penceresi')).toEqual({ ...LAB, saatFarki: -61 });
    expect(p('imza-dogrula')).toEqual({ ...LAB, asama: 'hmac' });
    expect(p('govde-degisti')).toEqual({ ...LAB, govde: 'degismis' });
    expect(p('pencere-ici-tekrar')).toEqual({ ...LAB, tekrar: true });
    expect(p('aralik-dogrulama')).toEqual({ ...LAB, asama: 'aralik' });
    expect(p('sunucu-zamani-kayit')).toEqual({ ...LAB, saatFarki: -45 });
    expect(p('tampon-saatlik')).toEqual({ ...LAB, asama: 'tampon' });
    expect(p('ozet')).toEqual({ ...LAB, asama: 'ozet' });
  });

  labTextTests(sc.steps, [4, 6, 7, 9]);
});
