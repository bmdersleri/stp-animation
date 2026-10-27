// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { deriveMwView } from '../../../src/concepts/middleware-zinciri/view';
import { LISTINGS } from '../../../src/concepts/middleware-zinciri/code-text';
import { go, setup, texts } from './harness';

const badges = (el: HTMLElement): HTMLElement[] => [...el.querySelectorAll<HTMLElement>('.kaynak-rozeti')];

describe('middleware-zinciri scene', () => {
  it('step 5 shows five lanes, 200 and the response arrow to the client', () => {
    const { el, player } = setup();
    go(player, 'isleyici');
    expect(el.querySelectorAll('svg.plot g.seq-lane')).toHaveLength(5);
    const code = el.querySelector('.yanit-karti .durum-kodu')!;
    expect(code.textContent).toBe('200');
    expect(code.classList.contains('ok')).toBe(true);
    expect(texts(el, 'svg.plot text').some((t) => t.startsWith('200'))).toBe(true);
  });

  it('step 6 dims the handler lane', () => {
    const { el, player } = setup();
    go(player, 'yetkisiz');
    const dim = [...el.querySelectorAll('g.seq-lane.dim')].map((g) => g.textContent ?? '');
    expect(dim).toHaveLength(1);
    expect(dim[0]).toContain('Route işleyicisi');
  });

  it('step 8 shows the hanging mark and yanıt yok', () => {
    const { el, player } = setup();
    go(player, 'next-unutma');
    expect(el.querySelectorAll('svg.plot g.seq-lane')).toHaveLength(3);
    expect(texts(el, 'svg.plot text')).toContain('yanıt yok');
    expect(el.querySelector('.yanit-yok')).not.toBeNull();
    expect(el.querySelector('.karsilastirma')!.textContent).toContain('code_011 · next çağrılır');
  });

  it('step 10 shows the thrown error and 500', () => {
    const { el, player } = setup();
    go(player, 'hata');
    // the error example draws only the lanes it uses; the skipped normal layers are not lanes at all
    expect(el.querySelectorAll('g.seq-lane')).toHaveLength(5);
    expect(texts(el, 'svg.plot text').some((t) => t.startsWith('throw:'))).toBe(true);
    expect(el.querySelector('.yanit-karti .durum-kodu')!.textContent).toBe('500');
  });

  it('resize twice keeps five lanes', () => {
    const { el, scene, player } = setup();
    go(player, 'isleyici');
    scene.resize(500, 700);
    scene.resize(1280, 540);
    expect(el.querySelectorAll('g.seq-lane')).toHaveLength(5);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [9, 0, 9, 4]) player.goto(i);
    expect(el.querySelectorAll('g.seq-lane')).toHaveLength(5);
    const want = deriveMwView(player.state.params).sequence.messages.length;
    expect(el.querySelectorAll('g.seq-msg')).toHaveLength(want);
    expect(el.querySelectorAll('.seq-token').length).toBeLessThanOrEqual(1);
  });

  it('ders mode shows the code strip, lab mode the full listing in explain extra', () => {
    const ders = setup(1280, 540, 'ders');
    go(ders.player, 'anahtar');
    const strip = ders.el.querySelector<HTMLElement>('.code-strip')!;
    expect(strip.hidden).toBe(false);
    const n = strip.querySelectorAll('li').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(5);
    expect(strip.querySelectorAll('li.active').length).toBeGreaterThan(0);

    const lab = setup(1280, 540, 'lab');
    go(lab.player, 'anahtar');
    expect(lab.el.querySelector<HTMLElement>('.code-strip')!.hidden).toBe(true);
    const kod = LISTINGS.find((l) => l.id === 'kod-5-5')!;
    expect(lab.extra.querySelectorAll('.code-trace li')).toHaveLength(kod.lines.length);
    expect(lab.extra.querySelectorAll('.code-trace li.active').length).toBeGreaterThan(0);
  });

  it('ozet step shows the five-row table', () => {
    const { el, player } = setup();
    go(player, 'ozet');
    const table = el.querySelector('table.ozet-tablosu')!;
    expect(table.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(texts(table, 'thead th')).toEqual(['Katman', 'Ne yapar', 'Sonuç']);
    expect(el.querySelector<HTMLElement>('.yanit-karti')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.istek-karti')!.hidden).toBe(true);
  });

  it('badge follows a lab change and returns on step change', () => {
    const { el, player } = setup();
    go(player, 'isleyici');
    expect(badges(el)).toHaveLength(1);
    expect(badges(el)[0].classList.contains('kaynak-kitap-kodu')).toBe(true);
    player.setParam('yol', '/baska');
    expect(badges(el)).toHaveLength(1);
    expect(badges(el)[0].classList.contains('kaynak-kitaba-dayali')).toBe(true);
    player.next();
    expect(badges(el)).toHaveLength(1);
    expect(badges(el)[0].classList.contains('kaynak-kitap')).toBe(true);
  });

  it('every step shows exactly one badge', () => {
    const { el, player } = setup();
    for (let i = 0; i < player.state.count; i++) {
      player.goto(i);
      expect(badges(el), `step ${i + 1}`).toHaveLength(1);
      expect(el.querySelectorAll('.rozet-yeri .kaynak-rozeti')).toHaveLength(1);
    }
  });
});
