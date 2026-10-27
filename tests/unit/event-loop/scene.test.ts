// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { framesOf } from '../../../src/concepts/event-loop/programs';
import { findFrame } from '../../../src/concepts/event-loop/scenario';
import { deriveLoopView } from '../../../src/concepts/event-loop/view';
import { go, setup, texts } from './harness';

describe('event-loop scene', () => {
  it('step 5 shows three terminal lines and an empty stack', () => {
    const { el, player } = setup();
    go(player, 'callback');
    expect(texts(el, '.terminal .terminal-satir')).toEqual(['1. Sipariş alınmaya başlandı.', '2. Başka sipariş işleniyor.', '3. Zamanlayıcı tamamlandı.']);
    expect(el.querySelectorAll('.kutu-yigin .is')).toHaveLength(0);
  });

  it('step 3 shows one timer in libuv', () => {
    const { el, player } = setup();
    go(player, 'zamanlayici');
    expect(el.querySelector('.kutu-zamanlayici')!.textContent).toContain('Zamanlayıcılar (libuv)');
    expect(el.querySelectorAll('.kutu-zamanlayici .is')).toHaveLength(1);
    expect(el.querySelector('.saat')!.textContent).toBe('t = 0 ms');
  });

  it('step 8 frame before output shows the continuation in the micro queue', () => {
    const { el, player } = setup();
    go(player, 'cozuldu');
    const i = findFrame('kod-4-5', (f) => f.micro.length === 1);
    player.setParam('kare', i);
    expect(texts(el, '.kutu-mikro .is')).toEqual(['mutfagiYonet devamı']);
    expect(el.querySelectorAll('.kutu-yigin .is')).toHaveLength(framesOf('kod-4-5')[i].stack.length);
  });

  it('step 10 shows five phase nodes, the poll self-loop and hides the board', () => {
    const { el, player } = setup();
    go(player, 'asamalar');
    expect(el.querySelectorAll('svg.plot g.flow-node')).toHaveLength(5);
    expect(el.querySelectorAll('svg.plot path.poll-dongu')).toHaveLength(1);
    expect(el.querySelector<HTMLElement>('.tahta')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.asamalar')!.hidden).toBe(false);
    expect(el.querySelectorAll('.asamalar .not')).toHaveLength(2);
    go(player, 'engelleme');
    expect(el.querySelector<HTMLElement>('.tahta')!.hidden).toBe(false);
    expect(el.querySelector<HTMLElement>('.asamalar')!.hidden).toBe(true);
  });

  it('phase nodes stay inside the drawing area', () => {
    const { el, player } = setup(1280, 540, 'ders');
    go(player, 'asamalar');
    const svg = el.querySelector('svg.plot')!;
    const w = Number(svg.getAttribute('width'));
    const h = Number(svg.getAttribute('height'));
    expect(w).toBeGreaterThan(0);
    for (const g of el.querySelectorAll('g.flow-node')) {
      const m = /translate\(([\d.-]+),([\d.-]+)\)/.exec(g.getAttribute('transform')!)!;
      expect(Number(m[1])).toBeGreaterThan(0);
      expect(Number(m[1])).toBeLessThan(w);
      expect(Number(m[2])).toBeGreaterThan(0);
      expect(Number(m[2])).toBeLessThan(h);
    }
  });

  it('phase nodes stack in one column on a phone', () => {
    const { el, player } = setup(390, 700, 'ders');
    go(player, 'asamalar');
    const pos = [...el.querySelectorAll('g.flow-node')].map((g) => /translate\(([\d.-]+),([\d.-]+)\)/.exec(g.getAttribute('transform')!)!.slice(1).map(Number));
    expect(new Set(pos.map((p) => p[0])).size).toBe(1);
    expect(pos.map((p) => p[1])).toEqual([...pos.map((p) => p[1])].sort((a, b) => a - b));
    expect(el.querySelectorAll('path.poll-dongu')).toHaveLength(1);
  });

  it('step 9 shows the book-based note', () => {
    const { el, player } = setup();
    go(player, 'mikro-once');
    expect(el.querySelector('.kitap-notu')!.textContent).toContain('Kitabın şu cümlesine dayalı örnek');
    go(player, 'tanitim');
    expect(el.querySelector<HTMLElement>('.kitap-notu')!.hidden).toBe(true);
  });

  it('shows the frame note of the engelleme program', () => {
    const { el, player } = setup();
    go(player, 'engelleme');
    player.setParam('kare', findFrame('engelleme', (f) => f.note?.startsWith('gecikme') === true));
    expect(texts(el, '.tahta .not')).toEqual(['gecikme: 1000 ms']);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [10, 0, 10, 4]) player.goto(i);
    expect(el.querySelectorAll('.kutu-yigin')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
    const v = deriveLoopView(player.state.params);
    expect(el.querySelectorAll('.kutu-yigin .is')).toHaveLength(v.frame.stack.length);
    expect(el.querySelectorAll('.kutu-zamanlayici .is')).toHaveLength(v.frame.timers.length);
    expect(el.querySelectorAll('.kutu-mikro .is')).toHaveLength(v.frame.micro.length);
    expect(el.querySelectorAll('.kutu-makro .is')).toHaveLength(v.frame.macro.length);
    expect(el.querySelectorAll('.terminal .terminal-satir')).toHaveLength(v.frame.output.length);
  });

  it('resize twice keeps one board', () => {
    const { el, scene, player } = setup();
    go(player, 'devam');
    scene.resize(500, 700);
    scene.resize(1280, 540);
    expect(el.querySelectorAll('.tahta')).toHaveLength(1);
    expect(el.querySelectorAll('.kutu-yigin')).toHaveLength(1);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
  });

  it('narrow stage stacks the boxes', () => {
    const { el } = setup(500, 700);
    expect(el.querySelector('.loop-stage')!.hasAttribute('data-narrow')).toBe(true);
  });

  it('ders shows a code strip of at most seven lines, lab the full listing in explain extra', () => {
    const ders = setup(1280, 540, 'ders');
    go(ders.player, 'senkron');
    const strip = ders.el.querySelector<HTMLElement>('.code-strip')!;
    expect(strip.hidden).toBe(false);
    expect(strip.querySelectorAll('li').length).toBeLessThanOrEqual(7);
    expect(strip.querySelectorAll('li.active').length).toBe(1);
    const lab = setup(1280, 540, 'lab');
    go(lab.player, 'senkron');
    expect(lab.el.querySelector<HTMLElement>('.code-strip')!.hidden).toBe(true);
    expect(lab.extra.querySelectorAll('.code-trace li')).toHaveLength(12);
  });

  it('records a loop-render measure per render', () => {
    performance.clearMeasures('loop-render');
    const { player } = setup();
    player.goto(3);
    expect(performance.getEntriesByName('loop-render', 'measure').length).toBeGreaterThanOrEqual(2);
  });
});
