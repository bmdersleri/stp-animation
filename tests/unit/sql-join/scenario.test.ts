import { describe, expect, it } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { SQL_ROZET, TUMU, sqlScenario as sc } from '../../../src/concepts/sql-join/scenario';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'veri', 'kartezyen', 'on-kosulu', 'inner-sonuc', 'left', 'is-null', 'where-tuzagi', 'parametreli', 'ozet'];
const TURLER = ['kitap', 'kitaba-dayali', 'kitap', 'kitap', 'kitap', 'kitap', 'kitaba-dayali', 'kitaba-dayali', 'kitaba-dayali', 'kitap'];
const REFLER = ['L536, L744', 'L1936-1938', 'L879, L887-890', 'L748', 'L804', 'L741, L804', 'L920', 'L920', 'L454, L1456', 'L860-865'];

describe('sql-join scenario', () => {
  it('has the ten steps of the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('SQL_ROZET covers every step with kind and ref', () => {
    IDS.forEach((id, i) => expect(SQL_ROZET[id], id).toEqual({ tur: TURLER[i], ref: REFLER[i] }));
  });

  it('defaults and step params', () => {
    expect(sc.defaults).toEqual({ sorgu: 'kartezyen', deger: 3, cift: TUMU, gorunum: 'tanitim' });
    for (const s of sc.steps.slice(2, 9)) {
      expect(s.params?.gorunum, s.id).toBe('sorgu');
      expect(s.params?.sorgu, s.id).toBe(s.id === 'on-kosulu' || s.id === 'inner-sonuc' ? 'inner' : s.id);
    }
    expect(sc.steps[3].params?.cift).toBe(4);
    expect(sc.steps[4].params?.cift).toBe(TUMU);
  });

  it('going back from step 4 to step 3 restores the full cartesian view', () => {
    const p = new StepPlayer(sc);
    p.goto(3);
    expect(p.state.params).toMatchObject({ sorgu: 'inner', cift: 4 });
    p.goto(2);
    expect(p.state.params).toMatchObject({ sorgu: 'kartezyen', cift: TUMU });
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ['1', '2', '3', '6']);
});
