// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MINI_APP } from '../../../src/concepts/istek-yanit/code-text';
import { deriveIstekView } from '../../../src/concepts/istek-yanit/view';
import { go, setup, texts } from './harness';

describe('istek-yanit scene', () => {
  it('step 7 shows four lanes, the 200 badge and the book line in the terminal', () => {
    const { el, player } = setup();
    go(player, 'yanit-200');
    expect(el.querySelectorAll('svg.plot g.seq-lane')).toHaveLength(4);
    const badge = el.querySelector('.yanit-karti .durum-kodu')!;
    expect(badge.textContent).toBe('200');
    expect(badge.classList.contains('ok')).toBe(true);
    expect(texts(el, '.terminal .terminal-satir')).toEqual(['[200] 2026001 numaralı öğrencinin notu: 88']);
    expect(el.querySelector('.istek-karti')!.textContent).toContain('GET /api/notlar/2026001');
    expect(el.querySelector('.istek-karti')!.textContent).toContain('ayse');
  });

  it('step 8 dims two lanes and shows 401 alarm', () => {
    const { el, player } = setup();
    go(player, 'yanit-401');
    expect(el.querySelectorAll('g.seq-lane.dim')).toHaveLength(2);
    const badge = el.querySelector('.yanit-karti .durum-kodu')!;
    expect(badge.textContent).toBe('401');
    expect(badge.classList.contains('alarm')).toBe(true);
  });

  it('resize twice keeps four lanes', () => {
    const { el, scene, player } = setup();
    go(player, 'yanit-200');
    scene.resize(500, 700);
    scene.resize(1280, 540);
    expect(el.querySelectorAll('g.seq-lane')).toHaveLength(4);
    expect(el.querySelectorAll('svg.plot')).toHaveLength(1);
  });

  it('narrow stage stacks the cards under the diagram', () => {
    const { el } = setup(500, 700);
    expect(el.querySelector('.istek-stage')!.hasAttribute('data-narrow')).toBe(true);
  });

  it('rapid step jumps leave no duplicates', () => {
    const { el, player } = setup();
    for (const i of [9, 0, 9, 4]) player.goto(i);
    expect(el.querySelectorAll('g.seq-lane')).toHaveLength(4);
    const want = deriveIstekView(player.state.params).sequence.messages.length;
    expect(el.querySelectorAll('g.seq-msg')).toHaveLength(want);
    expect(el.querySelectorAll('.seq-token').length).toBeLessThanOrEqual(1);
  });

  it('ders mode shows the code strip, lab mode the full listing in explain extra', () => {
    const ders = setup(1280, 540, 'ders');
    go(ders.player, 'kimlik');
    const strip = ders.el.querySelector<HTMLElement>('.code-strip')!;
    expect(strip.hidden).toBe(false);
    const n = strip.querySelectorAll('li').length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(5);
    expect(strip.querySelectorAll('li.active').length).toBeGreaterThan(0);

    const lab = setup(1280, 540, 'lab');
    go(lab.player, 'kimlik');
    expect(lab.el.querySelector<HTMLElement>('.code-strip')!.hidden).toBe(true);
    expect(lab.extra.querySelectorAll('.code-trace li')).toHaveLength(MINI_APP.length);
    expect(lab.extra.querySelectorAll('.code-trace li.active').length).toBeGreaterThan(0);
  });

  it('switching to lab hides the strip', () => {
    const { el, scene } = setup(1280, 540, 'ders');
    scene.setMode('lab');
    expect(el.querySelector<HTMLElement>('.code-strip')!.hidden).toBe(true);
  });

  it('ozet step shows the three-row table', () => {
    const { el, player } = setup();
    go(player, 'ozet');
    const table = el.querySelector('table.ozet-tablosu')!;
    expect(table.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(texts(table, 'thead th')).toEqual(['Yol', 'Yetki', 'Durduran katman', 'Kod', 'Mesaj']);
    expect(texts(table, 'tbody tr td:nth-child(4)')).toEqual(['200', '401', '404']);
    expect(el.querySelector<HTMLElement>('.yanit-karti')!.hidden).toBe(true);
    expect(el.querySelector<HTMLElement>('.istek-karti')!.hidden).toBe(true);
    expect(el.querySelectorAll('g.seq-lane')).toHaveLength(4);
  });

  it('the table is gone again on a flow step', () => {
    const { el, player } = setup();
    go(player, 'ozet');
    go(player, 'yanit-200');
    expect(el.querySelector('table.ozet-tablosu')).toBeNull();
    expect(el.querySelector<HTMLElement>('.yanit-karti')!.hidden).toBe(false);
  });
});
