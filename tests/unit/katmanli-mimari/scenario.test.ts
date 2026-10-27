import { describe, expect, it } from 'vitest';
import { StepPlayer, stepIndex } from '../../../src/core/player';
import { istekKarsila } from '../../../src/concepts/katmanli-mimari/katmanlar';
import { KATMAN_ROZET, TUMU, katmanScenario as sc } from '../../../src/concepts/katmanli-mimari/scenario';
import { baslangicDurumu } from '../../../src/concepts/katmanli-mimari/view';
import { labTextTests } from '../lab-text';

const IDS = [
  'tanitim',
  'kurulum',
  'dogrulama',
  'okuma',
  'kurallar',
  'yan-etki',
  'yanit-201',
  'ikinci-istek',
  'eksik-alan',
  'yasam-dongusu',
  'ozet',
];
const TURLER = ['kitap', 'kitap', 'kitap-kodu', 'kitap-kodu', 'kitap-kodu', 'kitap-kodu', 'kitap', 'kitap-kodu', 'kitap', 'kitap', 'kitap'];

describe('katmanli-mimari scenario', () => {
  it('has the eleven steps of the spec', () => {
    expect(sc.steps.map((s) => s.id)).toEqual(IDS);
    IDS.forEach((id, i) => expect(stepIndex(sc, id)).toBe(i));
  });

  it('KATMAN_ROZET covers every step with the table kind and refs', () => {
    IDS.forEach((id, i) => expect(KATMAN_ROZET[id]?.tur, id).toBe(TURLER[i]));
    expect(KATMAN_ROZET['tanitim'].ref).toBe('L39');
    expect(KATMAN_ROZET['kurulum'].ref).toBe('L173, L1039-1042');
    expect(KATMAN_ROZET['yanit-201'].ref).toBe('L1052-1055');
    expect(KATMAN_ROZET['eksik-alan'].ref).toBe('L1297');
    expect(KATMAN_ROZET['yasam-dongusu'].ref).toBe('L1072-1086');
    expect(KATMAN_ROZET['ozet'].ref).toBe('L76-80, L95, L1089');
  });

  it('olay values come from the trace', () => {
    const p = new StepPlayer(sc);
    const olay = (i: number) => {
      p.goto(i);
      return p.state.params.olay;
    };
    const iz = istekKarsila(baslangicDurumu(sc.defaults), { ogrenciNumarasi: '2024001', kitapKodu: 'JAVA-101' }).olaylar;
    expect(olay(0)).toBe(0);
    expect(olay(2)).toBe(iz.findIndex((o) => o.tur === 'not' && o.etiket.startsWith('zorunlu alanlar')) + 1);
    expect(olay(3)).toBe(iz.findIndex((o) => o.tur === 'donus' && o.etiket.startsWith('Öğrenci')) + 1);
    expect(olay(4)).toBe(iz.findIndex((o) => o.etiket === '0 < 3') + 1);
    expect(olay(5)).toBe(iz.findIndex((o) => o.tur === 'donus' && o.etiket.startsWith('mevcutOduncSayisi')) + 1);
    expect(olay(6)).toBe(TUMU);
  });

  it('view modes and repeats', () => {
    const p = new StepPlayer(sc);
    const gor = (i: number) => {
      p.goto(i);
      return [p.state.params.gorunum, p.state.params.tekrar];
    };
    expect(gor(1)).toEqual(['kurulum', 1]);
    expect(gor(7)).toEqual(['akis', 2]);
    expect(gor(9)).toEqual(['yasam', 1]);
    expect(gor(10)).toEqual(['ozet', 1]);
  });

  it('going back from 9 to 8 restores JAVA-101', () => {
    const p = new StepPlayer(sc);
    p.goto(8);
    expect(p.state.params.kitapKodu).toBe('');
    p.goto(7);
    expect(p.state.params.kitapKodu).toBe('JAVA-101');
    expect(p.state.params.tekrar).toBe(2);
  });

  labTextTests(sc.steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], ['3', '201', '400']);
});
