import { describe, expect, it } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { MW_ROZET, TUMU, mwScenario as sc } from '../../../src/concepts/middleware-zinciri/scenario';
import { mwIz } from '../../../src/concepts/middleware-zinciri/view';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'json', 'gunluk', 'anahtar', 'isleyici', 'yetkisiz', 'eslesmeyen', 'next-unutma', 'cift-yanit', 'hata', 'ozet'];
const TURLER = ['kitap', 'kitap-kodu', 'kitap', 'kitap-kodu', 'kitap-kodu', 'kitap', 'kitaba-dayali', 'kitap', 'kitap-kodu', 'kitaba-dayali', 'kitap'];

describe('middleware-zinciri scenario', () => {
  it('has the eleven steps of the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('MW_ROZET covers every step with the table kind', () => {
    IDS.forEach((id, i) => expect(MW_ROZET[id]?.tur, id).toBe(TURLER[i]));
    expect(MW_ROZET['eslesmeyen'].ref).toBe('L558');
    expect(MW_ROZET['hata'].ref).toBe('L682, L1814-1818');
  });

  it('olay values come from the trace', () => {
    const p = new StepPlayer(sc);
    const olay = (i: number) => {
      p.goto(i);
      return p.state.params.olay;
    };
    const iz = mwIz(sc.defaults).olaylar;
    expect(olay(1)).toBe(iz.findIndex((o) => o.tur === 'next' && o.katman === 'json') + 1);
    expect(olay(2)).toBe(iz.findIndex((o) => o.tur === 'next' && o.katman === 'gunluk') + 1);
    expect(olay(3)).toBe(iz.findIndex((o) => o.tur === 'next' && o.katman === 'anahtar') + 1);
    expect(olay(4)).toBe(TUMU);
  });

  it('step 7 params', () => {
    const p = new StepPlayer(sc);
    p.goto(6);
    expect(p.state.params.yol).toBe('/baska');
    expect(p.state.params.anahtar).toBe('yok');
  });

  it('going back from 8 to 7 restores kod-5-5', () => {
    const p = new StepPlayer(sc);
    p.goto(7);
    expect(p.state.params.program).toBe('next-unutma');
    p.goto(6);
    expect(p.state.params.program).toBe('kod-5-5');
    expect(p.state.params.yol).toBe('/baska');
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});
