// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { iotScenario } from '../../../src/concepts/iot-zaman-serisi/scenario';
import { BIRLESTIRME_NOTU, KITAP_NOT_SATIRI, deriveIotView } from '../../../src/concepts/iot-zaman-serisi/view';
import { go, setup, texts } from './harness';

const rozetler = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];

describe('iot-zaman-serisi scene', () => {
  it('every Ders note is the page note or a book note tagged with its book line', () => {
    const { el, player } = setup();
    const satirlar: Record<string, number[]> = {};
    for (const s of iotScenario.steps) {
      go(player, s.id);
      for (const n of deriveIotView(player.state.params, true).notlar) expect(n === BIRLESTIRME_NOTU || KITAP_NOT_SATIRI.has(n), n).toBe(true);
      const notlar = [...el.querySelectorAll<HTMLElement>('.iot-not')];
      for (const n of notlar) expect(n.classList.contains('iot-sayfa-notu'), n.textContent!).toBe(n.dataset.kitapSatir === undefined);
      satirlar[s.id] = notlar.filter((n) => n.dataset.kitapSatir).map((n) => Number(n.dataset.kitapSatir));
    }
    expect(satirlar).toMatchObject({ 'govde-degisti': [434], 'pencere-ici-tekrar': [433, 770], 'sunucu-zamani-kayit': [554, 558], 'tampon-saatlik': [761] });
  });

  it('step 6 shows two strips', () => {
    const { el, player } = setup();
    go(player, 'govde-degisti');
    expect(el.querySelectorAll('.imza-yeri .segment-strip')).toHaveLength(2);
    expect(texts(el, '.segment-strip-title')).toEqual(['gelen imza', 'beklenen imza']);
    expect(el.querySelectorAll('.imza-yeri .fark').length).toBeGreaterThan(0);
    expect(el.querySelectorAll('.iot-seri circle.seri-nokta')).toHaveLength(1);
  });

  it('step 8 hides the chart', () => {
    const { el, player } = setup();
    go(player, 'aralik-dogrulama');
    expect(el.querySelector<HTMLElement>('.iot-seri')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.arguman-yeri')!.hidden).toBe(true);
    expect(el.querySelectorAll('.denetim-yeri .denetim')).toHaveLength(2);
    expect(texts(el, '.terminal-satir').join('\n')).toContain('sicaklik aralık dışı');
  });

  it('step 10 shows the summary and buffer tables', () => {
    const { el, player } = setup();
    go(player, 'tampon-saatlik');
    expect(el.querySelectorAll('.ozet-yeri tbody tr')).toHaveLength(3);
    expect(el.querySelectorAll('.tampon-yeri tbody tr')).toHaveLength(2);
    expect(el.querySelector<HTMLElement>('.iot-seri')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.iot-diyagram')!.hidden).toBe(true);
  });

  it('step 7 draws two points, the diagram has four messages', () => {
    const { el, player } = setup();
    go(player, 'pencere-ici-tekrar');
    expect(el.querySelectorAll('.iot-seri circle.seri-nokta')).toHaveLength(2);
    expect(el.querySelectorAll('.iot-diyagram g.seq-msg')).toHaveLength(4);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(2);
  });

  it('lab param change leaves one Lab point', () => {
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'pencere-ici-tekrar');
    expect(el.querySelectorAll('.iot-seri circle.seri-nokta')).toHaveLength(2);
    player.setParams({ asama: 'istek', tekrar: false, sicaklik: 22 });
    for (const t of [23, 24, -999, 30]) player.setParam('sicaklik', t);
    expect(el.querySelectorAll('.iot-seri circle.seri-nokta')).toHaveLength(1);
    expect(el.querySelector('.iot-seri .seri-deger')).toBeNull();
    player.setParam('sicaklik', 90);
    expect(el.querySelectorAll('.iot-seri circle.seri-nokta')).toHaveLength(1);
    expect(el.querySelector('.iot-seri .seri-deger')!.textContent).toContain('90 °C');
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [10, 0, 9, 3, 8, 1, 5, 6]) player.goto(i);
    const v = deriveIotView(player.state.params, true);
    expect(el.querySelectorAll('.iot-diyagram g.seq-msg')).toHaveLength(v.sequence?.messages.length ?? 0);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(2);
    expect(el.querySelectorAll('.iot-seri circle.seri-nokta')).toHaveLength(v.seri?.noktalar.length ?? 0);
    expect(el.querySelectorAll('.imza-yeri .segment-strip')).toHaveLength(v.imzalar.length);
    expect(el.querySelectorAll('.iot-not')).toHaveLength(v.notlar.length);
    expect(el.querySelectorAll('.denetim-yeri .denetim')).toHaveLength(v.denetim?.denetimler.length ?? 0);
  });

  it('badge follows lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'pencere-ici-tekrar');
    expect(rozetler(el)[0].classList.contains('kaynak-kitaba-dayali')).toBe(true);
    player.setParam('sicaklik', 25);
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    go(player, 'pencere-ici-tekrar');
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitaba-dayali')).toBe(true);
  });

  it('every step shows exactly one badge', () => {
    const { el, player } = setup();
    iotScenario.steps.forEach((_, i) => {
      player.goto(i);
      expect(el.querySelectorAll('.kaynak-rozeti'), `step ${i + 1}`).toHaveLength(1);
    });
  });

  it('intro and summary show the book block', () => {
    const { el, player } = setup();
    const blok = el.querySelector<HTMLElement>('.kitap-blok')!;
    expect(blok.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('.iot-govde')!.hidden).toBe(true);
    expect(blok.querySelector('.tanim-metin')!.textContent).toContain('IoT backend geliştirme');
    go(player, 'ozet');
    expect(blok.hidden).toBe(false);
    expect(blok.querySelectorAll('.data-table')).toHaveLength(1);
    expect(blok.querySelectorAll('.kitap-not')).toHaveLength(2);
    go(player, 'imza-uret');
    expect(blok.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.iot-govde')!.hidden).toBe(false);
  });

  it('the code strip is hidden on the intro and summary', () => {
    const { el, player } = setup();
    expect(el.querySelector<HTMLElement>('.code-strip')!.hidden).toBe(true);
    go(player, 'ozet');
    expect(el.querySelector<HTMLElement>('.code-strip')!.hidden).toBe(true);
    go(player, 'imza-uret');
    expect(el.querySelector<HTMLElement>('.code-strip')!.hidden).toBe(false);
  });

  it('the page sentence (R24) is styled apart from the book notes', () => {
    const { el, player } = setup();
    go(player, 'govde-degisti');
    const sayfa = el.querySelectorAll('.iot-sayfa-notu');
    expect(sayfa).toHaveLength(1);
    expect(sayfa[0].textContent).toBe(BIRLESTIRME_NOTU);
    expect(el.querySelectorAll('.iot-not:not(.iot-sayfa-notu)')).toHaveLength(1);
  });
});
