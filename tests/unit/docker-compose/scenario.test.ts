import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { COMPOSE_ROZET, composeScenario as sc, type ComposeParams } from '../../../src/concepts/docker-compose/scenario';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'image-container', 'cok-asamali', 'volume-yok', 'volume-var', 'ag-dns', 'localhost-hatasi', 'depends-on-sira', 'healthcheck-bekle', 'yeniden-deneme', 'ozet'];
const ROZET: [string, string][] = [
  ['kitap', 'L564, L1014'],
  ['kitap', 'L351, L395-396'],
  ['kitap', 'L293-334'],
  ['kitaba-dayali', 'L468, L550'],
  ['kitaba-dayali', 'L523, L720'],
  ['kitaba-dayali', 'L516-517, L520'],
  ['kitap', 'L868-870, L886'],
  ['kitaba-dayali', 'L567, L612, L892'],
  ['standart', 'Compose; L657, L683'],
  ['kitap-kodu', 'L986, L990, L1002'],
  ['kitap', 'L67-77, L683'],
];
const LAB = { asama: 'compose', mod: 'saglikli', dbHazirMs: 4000, retries: 10, maksimumDeneme: 5, hostAdi: 'kutuphane-db' };

describe('docker-compose scenario', () => {
  it('has 11 steps with spec ids', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('badges match table', () => {
    IDS.forEach((id, i) => expect([COMPOSE_ROZET[id]?.tur, COMPOSE_ROZET[id]?.ref], id).toEqual(ROZET[i]));
  });

  it('every step gives every param and the defaults are the Lab values', () => {
    expect(sc.defaults).toEqual(LAB);
    for (const s of sc.steps) expect(Object.keys(s.params!).sort(), s.id).toEqual(Object.keys(LAB).sort());
  });

  it('step params differ from the defaults as the table says', () => {
    const p = (id: string) => sc.steps[stepIndex(sc, id)].params as ComposeParams;
    const asama = ['tanitim', 'image', 'cok-asamali', 'volume-yok', 'volume-var', 'ag', 'localhost'];
    asama.forEach((a, i) => expect(p(IDS[i]), IDS[i]).toEqual({ ...LAB, asama: a }));
    expect(p('depends-on-sira')).toEqual({ ...LAB, mod: 'sira', maksimumDeneme: 1 });
    expect(p('healthcheck-bekle')).toEqual(LAB);
    expect(p('yeniden-deneme')).toEqual({ ...LAB, asama: 'kod-14-9', mod: 'sira', dbHazirMs: 1000 });
    expect(p('ozet')).toEqual({ ...LAB, asama: 'ozet' });
  });

  labTextTests(sc.steps, [8, 9, 10]);
});
