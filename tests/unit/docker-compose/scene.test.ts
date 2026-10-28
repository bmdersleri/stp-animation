// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { composeScenario } from '../../../src/concepts/docker-compose/scenario';
import { deriveComposeView } from '../../../src/concepts/docker-compose/view';
import { go, setup, texts } from './harness';

const rozetler = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];

describe('docker-compose scene', () => {
  it('step 8 shows one rejected attempt and api başladı', () => {
    const { el, player } = setup();
    go(player, 'depends-on-sira');
    expect([...el.querySelectorAll('.data-table tbody tr')].map((r) => texts(r, 'td'))).toEqual([['kutuphane-db', 'starting', 't = 0 s'], ['kutuphane-api', 'başladı', 't = 0 s']]);
    expect(el.querySelectorAll('svg.plot g.seq-msg[data-id="deneme-1"]')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot g.seq-msg[data-id="deneme-1-ret"]')).toHaveLength(1);
    expect(el.querySelector<HTMLElement>('.denetim-yeri')!.hidden).toBe(true);
  });

  it('step 9 shows two probe rows', () => {
    const { el, player } = setup();
    go(player, 'healthcheck-bekle');
    expect(el.querySelector<HTMLElement>('.denetim-yeri')!.hidden).toBe(false);
    expect(el.querySelectorAll('.denetim-yeri .denetim')).toHaveLength(2);
    expect(el.querySelectorAll('svg.plot g.seq-msg[data-id^="prob-"]')).toHaveLength(2);
  });

  it('steps 2-7 hide the diagram and keep the table', () => {
    const { el, player } = setup();
    go(player, 'cok-asamali');
    expect(el.querySelector<HTMLElement>('.compose-diyagram')!.hidden).toBe(true);
    expect(el.querySelectorAll('.data-table')).toHaveLength(1);
  });

  it('intro and summary show the book block in place of the diagram', () => {
    const { el, player } = setup();
    const blok = el.querySelector<HTMLElement>('.kitap-blok')!;
    expect(blok.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('.compose-govde')!.hidden).toBe(true);
    expect(blok.querySelector('.tanim-metin')!.textContent).toContain('Docker Compose, birden fazla container');
    go(player, 'ozet');
    expect(blok.querySelectorAll('tbody tr')).toHaveLength(7);
    go(player, 'healthcheck-bekle');
    expect(blok.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.compose-govde')!.hidden).toBe(false);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [10, 0, 9, 3, 8, 1, 9]) player.goto(i);
    const v = deriveComposeView(player.state.params, true);
    expect(el.querySelectorAll('svg.plot g.seq-msg')).toHaveLength(v.sequence!.messages.length);
    expect(el.querySelector<HTMLElement>('.denetim-yeri')!.hidden).toBe(v.problar === null);
    if (v.problar) expect(el.querySelectorAll('.denetim-yeri .denetim')).toHaveLength(v.problar.denetimler.length);
    expect(el.querySelectorAll('.terminal-satir')).toHaveLength(v.terminal.length);
    expect(el.querySelectorAll('.data-table')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
    expect(el.querySelectorAll('.http-cards')).toHaveLength(1);
    expect(el.querySelectorAll('.compose-not')).toHaveLength(v.notlar.length);
  });

  it('extreme lab parameters keep the probe list at five rows', () => {
    const { el, player } = setup();
    player.setParams({ asama: 'compose', mod: 'saglikli', dbHazirMs: 30_000, retries: 10, maksimumDeneme: 10, hostAdi: 'localhost' });
    expect(el.querySelectorAll('.denetim-yeri .denetim').length).toBeLessThanOrEqual(5);
    expect(texts(el, '.terminal-satir')).toHaveLength(1);
  });

  it('badge follows lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'yeniden-deneme');
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    go(player, 'healthcheck-bekle');
    expect(rozetler(el)[0].classList.contains('kaynak-standart')).toBe(true);
    player.setParam('dbHazirMs', 8000);
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    go(player, 'healthcheck-bekle');
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-standart')).toBe(true);
  });

  it('every step shows exactly one badge', () => {
    const { el, player } = setup();
    composeScenario.steps.forEach((_, i) => {
      player.goto(i);
      expect(el.querySelectorAll('.kaynak-rozeti'), `step ${i + 1}`).toHaveLength(1);
    });
  });

  it('a lab change drops the book terminal line', () => {
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'yeniden-deneme');
    const kitap = texts(el, '.terminal-satir');
    player.setParam('maksimumDeneme', 1);
    expect(texts(el, '.terminal-satir')).toHaveLength(1);
    expect(texts(el, '.terminal-satir')).not.toEqual(kitap);
  });
});
