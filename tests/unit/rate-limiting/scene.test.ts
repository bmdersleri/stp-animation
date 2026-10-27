// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { rateScenario } from '../../../src/concepts/rate-limiting/scenario';
import { go, setup, texts } from './harness';

const rozetler = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];

describe('rate-limiting scene', () => {
  it('step 4 draws two 429 dots', () => {
    const { el, player } = setup();
    go(player, 'sinir');
    expect(el.querySelectorAll('svg.plot .rate-dot')).toHaveLength(5);
    expect(el.querySelectorAll('svg.plot .rate-nokta.red')).toHaveLength(2);
    expect(el.querySelectorAll('svg.plot .rate-nokta.izin')).toHaveLength(3);
    expect(el.querySelectorAll('svg.plot .rate-halka:not([display])')).toHaveLength(1);
    expect(texts(el, 'svg.plot .rate-ip')).toEqual(['203.0.113.10']);
  });

  it('step 7 draws two bands', () => {
    const { el, player } = setup();
    go(player, 'sinirda-patlama');
    expect(el.querySelectorAll('svg.plot .rate-bant')).toHaveLength(2);
  });

  it('resize twice keeps one axis', () => {
    const { el, player, scene } = setup();
    go(player, 'sinir');
    scene.resize(1000, 500);
    scene.resize(1280, 540);
    expect(el.querySelectorAll('svg.plot .rate-axis')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot .rate-taban')).toHaveLength(1);
    const once = el.querySelectorAll('svg.plot .rate-tick').length;
    scene.resize(1280, 540);
    expect(el.querySelectorAll('svg.plot .rate-tick')).toHaveLength(once);
    expect(el.querySelectorAll('svg.plot .rate-dot')).toHaveLength(5);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [7, 0, 9, 2, 5, 1, 8, 3]) player.goto(i);
    expect(el.querySelectorAll('.check-list')).toHaveLength(1);
    expect(el.querySelectorAll('.http-cards')).toHaveLength(1);
    expect(el.querySelectorAll('.data-table')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot .rate-axis')).toHaveLength(1);
  });

  it('badge follows lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'ilk-istek');
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    player.setParam('maksimumIstek', 4);
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    go(player, 'tanitim');
    expect(rozetler(el)[0].classList.contains('kaynak-kitap')).toBe(true);
    player.next();
    expect(rozetler(el)).toHaveLength(1);
  });

  it('book terminal lines show with the step badge and drop on a lab change', () => {
    const { el, player } = setup();
    go(player, 'sinir');
    const kitap = texts(el, '.terminal-satir');
    expect(kitap).toHaveLength(5);
    player.setParam('maksimumIstek', 2);
    expect(texts(el, '.terminal-satir')).not.toEqual(kitap);
  });

  it('login step shows the check list', () => {
    const { el, player } = setup();
    go(player, 'login-429');
    expect(el.querySelector<HTMLElement>('.denetim-yeri')!.hidden).toBe(false);
    expect(el.querySelectorAll('.denetim').length).toBeGreaterThan(0);
  });

  it('every step shows exactly one badge', () => {
    const { el, player } = setup();
    rateScenario.steps.forEach((_, i) => {
      player.goto(i);
      expect(el.querySelectorAll('.kaynak-rozeti'), `step ${i + 1}`).toHaveLength(1);
    });
  });
});
