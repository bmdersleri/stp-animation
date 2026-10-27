import { describe, expect, it } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { notSorgula } from '../../../src/concepts/istek-yanit/flow';
import { istekScenario as sc } from '../../../src/concepts/istek-yanit/scenario';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'istek', 'kimlik', 'yol', 'ayristir', 'veri', 'yanit-200', 'yanit-401', 'yanit-404', 'ozet'];

describe('istek-yanit scenario', () => {
  it('has the ten steps of the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
    expect(sc.defaults).toEqual({ yol: '/api/notlar/2026001', yetkiliMi: true, olay: 0, gorunum: 'akis' });
  });

  it('olay values come from the trace', () => {
    const olay = (id: string) => sc.steps[stepIndex(sc, id)].params?.olay;
    expect(olay('istek')).toBe(1);
    expect(olay('yanit-200')).toBe(notSorgula('/api/notlar/2026001', true).olaylar.length);
    expect(olay('yanit-401')).toBe(notSorgula('/api/notlar/2026001', false).olaylar.length);
    expect(olay('yanit-404')).toBe(notSorgula('/api/notlar/2026999', true).olaylar.length);
  });

  it('steps 3-6 stop after the expected events', () => {
    const o = notSorgula('/api/notlar/2026001', true).olaylar;
    const through = (pred: (e: (typeof o)[number]) => boolean) => o.findIndex(pred) + 1;
    const olay = (id: string) => sc.steps[stepIndex(sc, id)].params?.olay;
    expect(olay('kimlik')).toBe(through((e) => e.kind === 'note' && e.label === 'Kimlik denetimi'));
    expect(olay('yol')).toBe(through((e) => e.kind === 'request' && e.to === 'notApi'));
    expect(olay('ayristir')).toBe(through((e) => e.kind === 'note' && e.from === 'notApi'));
    expect(olay('veri')).toBe(through((e) => e.kind === 'note' && e.from === 'backend'));
    expect([olay('kimlik'), olay('yol'), olay('ayristir'), olay('veri')]).toEqual([2, 4, 5, 7]);
  });

  it('step 10 ends with the book sentence', () => {
    expect(sc.steps[9].text.endsWith('Hata kodu, isteği durduran katmanda üretilir.')).toBe(true);
  });

  it('step 5 opens with the book sentence (b01 Kod 1.5, kritik satır 2), not an own "uç nokta" claim', () => {
    expect(sc.steps[4].text.startsWith("NotApi yoldan öğrenci numarasını ayrıştırıp NotBackendServisi'ne devreder.")).toBe(true);
    expect(sc.steps[4].text).not.toContain('son parçasını');
  });

  it('step 8 sets yetkiliMi false; back from 10 to 9 restores the flow view', () => {
    const p = new StepPlayer(sc);
    p.goto(7);
    expect(p.state.params.yetkiliMi).toBe(false);
    p.goto(9);
    expect(p.state.params.gorunum).toBe('ozet');
    p.goto(8);
    expect(p.state.params.gorunum).toBe('akis');
    expect(p.state.params.yetkiliMi).toBe(true);
    expect(p.state.params.yol).toBe('/api/notlar/2026999');
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});
