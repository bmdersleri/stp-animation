// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { jwtScenario } from '../../../src/concepts/jwt-akisi/scenario';
import { go, setup, texts } from './harness';

const rozetler = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.rozet-yeri .kaynak-rozeti')];
const gorunur = (el: HTMLElement, sel: string): boolean => {
  const e = el.querySelector<HTMLElement>(sel)!;
  return !e.hidden && !e.closest('[hidden]');
};

describe('jwt-akisi scene', () => {
  it('step 7 shows imza kaldi row and denenmedi rows', () => {
    const { el, player } = setup();
    go(player, 'bozuk-imza');
    const satirlar = [...el.querySelectorAll('.check-list .denetim')];
    expect(satirlar).toHaveLength(5);
    expect(satirlar[0].classList.contains('denetim-gecti')).toBe(true);
    expect(satirlar[1].classList.contains('denetim-kaldi')).toBe(true);
    expect(satirlar.slice(2).map((s) => s.classList.contains('denetim-atlandi'))).toEqual([true, true, true]);
    expect(texts(el, '.denetim-ayrinti').filter((t) => t === 'denenmedi')).toHaveLength(3);
    expect(texts(el, '.terminal-satir')).toHaveLength(2);
  });

  it('step 8 shows two signature strips with fark', () => {
    const { el, player } = setup();
    go(player, 'rol-degisti');
    expect(texts(el, '.imzalar .segment-strip-title')).toEqual(['Gelen imza', 'Beklenen imza']);
    for (const s of el.querySelectorAll('.imzalar .segment-strip')) expect(s.querySelectorAll('.fark').length).toBeGreaterThan(0);
    expect(texts(el, '.terminal-satir')).toEqual(['401: Token imzası geçersiz.']);
  });

  it('step 11 shows sequence, hides strip', () => {
    const { el, player } = setup();
    go(player, 'akis');
    expect(gorunur(el, 'svg.plot')).toBe(true);
    expect(el.querySelectorAll('svg.plot .seq-lane').length).toBe(2);
    expect(gorunur(el, '.token-yeri')).toBe(false);
    expect(gorunur(el, '.json-kutular')).toBe(false);
    expect(gorunur(el, '.imzalar')).toBe(false);
    go(player, 'dogrula');
    expect(gorunur(el, 'svg.plot')).toBe(false);
    expect(gorunur(el, '.token-yeri')).toBe(true);
  });

  it('steps 1 and 4 hide the token strip and show book text', () => {
    const { el, player } = setup();
    expect(gorunur(el, '.token-yeri')).toBe(false);
    expect(el.querySelector('.tanim')!.textContent).toContain('JWT (JSON Web Token), üç bölümden oluşan');
    go(player, 'okunur');
    expect(gorunur(el, '.token-yeri')).toBe(false);
    expect(el.querySelectorAll('.json-kutu:not([hidden]) pre')).toHaveLength(1);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [7, 0, 10, 2, 5]) player.goto(i);
    expect(el.querySelectorAll('.token-yeri .segment-strip')).toHaveLength(1);
    expect(el.querySelectorAll('.imzalar .segment-strip')).toHaveLength(2);
    expect(el.querySelectorAll('.check-list')).toHaveLength(1);
    expect(el.querySelectorAll('.http-cards')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
  });

  it('badge follows lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'rol-degisti');
    expect(rozetler(el)[0].classList.contains('kaynak-kitaba-dayali')).toBe(true);
    player.setParam('dakika', 3);
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    player.next();
    expect(rozetler(el)).toHaveLength(1);
    expect(rozetler(el)[0].classList.contains('kaynak-kitaba-dayali')).toBe(false);
  });

  it('every step shows exactly one badge', () => {
    const { el, player } = setup();
    jwtScenario.steps.forEach((_, i) => {
      player.goto(i);
      expect(el.querySelectorAll('.kaynak-rozeti'), `step ${i + 1}`).toHaveLength(1);
    });
  });

  it('ders step 10 accumulates the four book lines', () => {
    const { el, player } = setup();
    go(player, 'fazla-segment');
    expect(texts(el, '.terminal-satir')).toHaveLength(4);
  });

  it('lab param change drops accumulated book lines', () => {
    const { el, player } = setup(1280, 540, 'lab');
    go(player, 'fazla-segment');
    expect(texts(el, '.terminal-satir')).toHaveLength(4);
    player.setParam('dakika', 5);
    expect(texts(el, '.terminal-satir')).toHaveLength(1);
  });
});
