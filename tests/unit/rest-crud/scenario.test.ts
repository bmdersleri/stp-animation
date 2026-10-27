import { describe, expect, it } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { REST_ROZET, TUMU, restScenario as sc } from '../../../src/concepts/rest-crud/scenario';
import { labTextTests } from '../lab-text';

const IDS = ['tanitim', 'olustur', 'listele', 'guncelle', 'bulunamadi', 'gecersiz', 'sil', 'mutlak-goreli', 'idempotency-key', 'ozet'];
const TURLER = ['kitap', 'kitap', 'kitap', 'kitap', 'kitap', 'kitap-kodu', 'kitap', 'kitap', 'kitap', 'kitap'];

describe('rest-crud scenario', () => {
  it('has the ten steps of the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('REST_ROZET covers every step with the table kind', () => {
    IDS.forEach((id, i) => expect(REST_ROZET[id]?.tur, id).toBe(TURLER[i]));
    expect(REST_ROZET['tanitim'].ref).toBe('L300-301');
    expect(REST_ROZET['sil'].ref).toBe('L643-644');
    expect(REST_ROZET['mutlak-goreli'].ref).toBe('L641-642');
    expect(REST_ROZET['idempotency-key'].ref).toBe('L645-646');
    expect(REST_ROZET['ozet'].ref).toBe('L529-535');
  });

  it('flow steps give every request param explicitly', () => {
    for (const s of sc.steps.slice(1, 9)) {
      expect(Object.keys(s.params ?? {}).sort(), s.id).toEqual(['gonderim', 'gorunum', 'istek', 'onceki', 'program', 'tekrar']);
      expect(s.params?.gonderim).toBe(TUMU);
      expect(s.params?.gorunum).toBe('akis');
    }
  });

  it('step 8 and 9 params', () => {
    const p = new StepPlayer(sc);
    p.goto(7);
    expect(p.state.params).toMatchObject({ program: 'idempotentlik', onceki: ['stok-ayarla-5', 'stok-ayarla-5'], istek: 'stok-artir-1', tekrar: 2 });
    p.goto(8);
    expect(p.state.params).toMatchObject({ onceki: ['post-anahtar-7', 'post-anahtar-7'], istek: 'post-anahtar-9', tekrar: 1 });
  });

  it('going back from 7 to 6 restores laboratuvar-api', () => {
    const p = new StepPlayer(sc);
    p.goto(6);
    expect(p.state.params.program).toBe('idempotentlik');
    p.goto(5);
    expect(p.state.params.program).toBe('laboratuvar-api');
    expect(p.state.params.istek).toBe('post-bos');
    expect(p.state.params.onceki).toEqual([]);
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], ['201', '204', '404']);
});
