import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../../src/core/player';
import { SALT_1, SCRYPT_ONBELLEK } from '../../../src/concepts/salt-hash/degerler';
import { SALT_ROZET, saltScenario as sc, type SaltParams } from '../../../src/concepts/salt-hash/scenario';
import { deriveSaltView } from '../../../src/concepts/salt-hash/view';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'tuzsuz', 'salt-uret', 'ayni-parola', 'dogru-parola', 'yanlis-parola', 'zamanlama', 'yavas', 'ozet'];
const ROZET: [string, string | undefined][] = [
  ['kitap', 'L240, L243'],
  ['kitap-kodu', 'L344, L371'],
  ['kitap-kodu', 'L282-283'],
  ['kitap-kodu', 'L246, L331'],
  ['kitap', 'L303'],
  ['kitap', 'L303-304'],
  ['kitaba-dayali', 'L316, L331'],
  ['kitap', 'L249, L312, L337-342'],
  ['kitap', 'L311-313, L374'],
];

describe('salt-hash scenario', () => {
  it('has 9 steps with spec ids', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('badges match table', () => {
    IDS.forEach((id, i) => expect([SALT_ROZET[id]?.tur, SALT_ROZET[id]?.ref], id).toEqual(ROZET[i]));
  });

  it('every step gives every param and the documented defaults hold', () => {
    expect(sc.defaults).toEqual({
      yontem: 'scrypt', parola: 'guclu-Parola123', deneme: 'yanlis-parola', salt: 'sabit-1',
      yeniSalt: '', ikinciKullanici: false, gorunum: 'hat',
    });
    for (const s of sc.steps) expect(Object.keys(s.params!).sort(), s.id).toEqual(Object.keys(sc.defaults).sort());
  });

  it('no Ders step waits for a hash', () => {
    const onbellek = new Map(Object.entries(SCRYPT_ONBELLEK));
    for (const s of sc.steps) expect(deriveSaltView(s.params as SaltParams, onbellek).bekliyor, s.id).toEqual([]);
  });

  it('uses the cached SALT_1 value for the default record', () => {
    expect(SCRYPT_ONBELLEK[`guclu-Parola123|${SALT_1}`]).toBeTruthy();
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
