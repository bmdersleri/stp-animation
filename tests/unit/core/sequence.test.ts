// @vitest-environment jsdom
import { select } from 'd3-selection';
import { describe, expect, it } from 'vitest';
import '../svg-stubs';
import { SequenceLayer, type Message, type SequenceSpec } from '../../../src/core/plot/sequence';
import { TextMeasure } from '../../../src/core/plot/text-measure';

const NS = 'http://www.w3.org/2000/svg';
const BOX = { left: 0, top: 0, width: 800, height: 500 };

function setup(): { svg: SVGSVGElement; layer: SequenceLayer } {
  const svg = document.createElementNS(NS, 'svg');
  const probe = document.createElementNS(NS, 'text');
  svg.append(probe);
  const g = document.createElementNS(NS, 'g');
  svg.append(g);
  document.body.append(svg);
  return { svg, layer: new SequenceLayer(select(g) as never, new TextMeasure(probe)) };
}

const lanes = [
  { id: 'a', label: ['Tarayıcı'] },
  { id: 'b', label: ['Sunucu'], sub: ':8000' },
  { id: 'c', label: ['Veritabanı'] },
  { id: 'd', label: ['Disk'] },
];
const msg = (id: string, from: string, to: string, kind: Message['kind'] = 'request', extra: Partial<Message> = {}): Message => ({ id, from, to, label: id, kind, ...extra });
const spec = (extra: Partial<SequenceSpec> = {}): SequenceSpec => ({ lanes, messages: [msg('m1', 'a', 'b'), msg('m2', 'b', 'a', 'response')], ...extra });
const ids = (svg: Element, sel: string): string[] => [...svg.querySelectorAll(sel)].map((e) => e.getAttribute('data-id')!);

describe('SequenceLayer', () => {
  it('draws one lane per id in order', () => {
    const { svg, layer } = setup();
    layer.draw(spec(), BOX, 0, 14);
    expect(ids(svg, 'g.seq-lane')).toEqual(['a', 'b', 'c', 'd']);
    const xs = ['a', 'b', 'c', 'd'].map((i) => layer.laneX(i));
    expect(xs.every((x, i) => i === 0 || x > xs[i - 1])).toBe(true);
    expect(svg.querySelectorAll('g.seq-lane text.seq-lane-label').length).toBeGreaterThanOrEqual(4);
    expect(svg.querySelectorAll('g.seq-lane line.seq-lifeline')).toHaveLength(4);
  });

  it('draw twice keeps one lane per id', () => {
    const { svg, layer } = setup();
    layer.draw(spec(), BOX, 0, 14);
    layer.draw(spec(), BOX, 0, 14);
    expect(ids(svg, 'g.seq-lane')).toEqual(['a', 'b', 'c', 'd']);
    expect(svg.querySelectorAll('g.seq-msg')).toHaveLength(2);
  });

  it('request is solid, response dashed', () => {
    const { svg, layer } = setup();
    layer.draw(spec(), BOX, 0, 14);
    const arrow = (id: string): Element => svg.querySelector(`g.seq-msg[data-id="${id}"] path.seq-arrow`)!;
    expect(arrow('m1').getAttribute('stroke-dasharray')).toBeNull();
    expect(arrow('m2').getAttribute('stroke-dasharray')).toBeTruthy();
    expect(svg.querySelector('g.seq-msg[data-id="m2"]')!.getAttribute('data-kind')).toBe('response');
    expect(svg.querySelector('g.seq-msg[data-id="m1"] text.seq-msg-label')!.textContent).toContain('m1');
  });

  it('note sits on its lane', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ messages: [msg('n', 'c', 'c', 'note')] }), BOX, 0, 14);
    const g = svg.querySelector('g.seq-msg[data-id="n"]')!;
    expect(g.getAttribute('data-kind')).toBe('note');
    const r = g.querySelector('rect')!;
    const centre = Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2;
    expect(Math.abs(centre - layer.laneX('c'))).toBeLessThanOrEqual(1);
  });

  it('alarm tone and dim lanes get classes', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ messages: [msg('m1', 'a', 'b', 'request', { tone: 'alarm' }), msg('m2', 'b', 'a', 'response')], dim: ['c', 'd'] }), BOX, 0, 14);
    expect(svg.querySelectorAll('g.seq-msg.alarm')).toHaveLength(1);
    expect(svg.querySelector('g.seq-msg[data-id="m1"]')!.classList.contains('alarm')).toBe(true);
    expect(ids(svg, 'g.seq-lane.dim')).toEqual(['c', 'd']);
  });

  it('token only on active message', () => {
    const { svg, layer } = setup();
    layer.draw(spec(), BOX, 0, 14);
    expect(svg.querySelectorAll('circle.seq-token')).toHaveLength(0);
    layer.draw(spec({ active: 'm2' }), BOX, 0, 14);
    expect(svg.querySelectorAll('circle.seq-token')).toHaveLength(1);
    layer.draw(spec(), BOX, 0, 14);
    expect(svg.querySelectorAll('circle.seq-token')).toHaveLength(0);
  });

  it('stopAt draws one stop mark', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ stopAt: 'b' }), BOX, 0, 14);
    expect(svg.querySelectorAll('g.seq-stop')).toHaveLength(1);
    layer.draw(spec(), BOX, 0, 14);
    expect(svg.querySelectorAll('g.seq-stop')).toHaveLength(0);
  });

  it('more than 8 messages keeps 8 rows visible, older marked old', () => {
    const { svg, layer } = setup();
    const messages = Array.from({ length: 11 }, (_, i) => msg(`m${i}`, 'a', 'b'));
    layer.draw(spec({ messages }), BOX, 0, 14);
    const shown = [...svg.querySelectorAll('g.seq-msg')];
    expect(shown.filter((g) => !g.classList.contains('old'))).toHaveLength(8);
    expect(shown.filter((g) => g.classList.contains('old')).map((g) => g.getAttribute('data-id'))).toEqual(['m0', 'm1', 'm2']);
  });

  it('clear removes everything', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ active: 'm1', stopAt: 'b' }), BOX, 0, 14);
    layer.clear();
    expect(svg.querySelectorAll('.seq-lane, .seq-msg, .seq-stop, .seq-token')).toHaveLength(0);
  });

  it('kind change on same id redraws without throwing', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ messages: [msg('x', 'a', 'b')] }), BOX, 0, 14);
    expect(() => layer.draw(spec({ messages: [msg('x', 'c', 'c', 'note')] }), BOX, 0, 14)).not.toThrow();
    expect(svg.querySelectorAll('g.seq-msg')).toHaveLength(1);
    expect(svg.querySelector('g.seq-msg[data-id="x"] rect')).not.toBeNull();
    expect(() => layer.draw(spec({ messages: [msg('x', 'a', 'b', 'response')] }), BOX, 0, 14)).not.toThrow();
    expect(svg.querySelectorAll('g.seq-msg')).toHaveLength(1);
    expect(svg.querySelector('g.seq-msg[data-id="x"] path.seq-arrow')!.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('no token for an active message hidden as old', () => {
    const { svg, layer } = setup();
    const messages = Array.from({ length: 10 }, (_, i) => msg(`m${i}`, 'a', 'b'));
    layer.draw(spec({ messages, active: 'm0' }), BOX, 0, 14);
    expect(svg.querySelectorAll('circle.seq-token')).toHaveLength(0);
  });

  describe('notes and rows', () => {
    const FONT = 14;
    const y = (g: Element): number => Number(/translate\(0,([-\d.]+)\)/.exec(g.getAttribute('transform')!)![1]);
    const rectOf = (g: Element): { x: number; w: number; top: number; bottom: number } => {
      const r = g.querySelector('rect')!;
      const top = y(g) + Number(r.getAttribute('y'));
      return { x: Number(r.getAttribute('x')), w: Number(r.getAttribute('width')), top, bottom: top + Number(r.getAttribute('height')) };
    };
    const longNote = 'Bu uzun bir not metnidir ve birkaç satıra sarılmalıdır';

    it('rows push down two-line notes', () => {
      const { svg, layer } = setup();
      const messages = [
        msg('m0', 'a', 'b'),
        msg('n1', 'b', 'b', 'note', { label: longNote }),
        msg('m2', 'b', 'c'),
        msg('n3', 'c', 'c', 'note', { label: longNote }),
        msg('m4', 'c', 'd'),
        msg('m5', 'd', 'c', 'response'),
      ];
      layer.draw(spec({ messages }), { left: 0, top: 0, width: 800, height: 420 }, 0, FONT);
      const extents = [...svg.querySelectorAll('g.seq-msg')].map((g) => {
        if (g.getAttribute('data-kind') === 'note') { const r = rectOf(g); return [r.top, r.bottom]; }
        return [y(g) - 6 - FONT, y(g)];
      });
      for (let i = 1; i < extents.length; i++) expect(extents[i][0], `row ${i}`).toBeGreaterThanOrEqual(extents[i - 1][1]);
    });

    it('note clamped inside box', () => {
      const { svg, layer } = setup();
      layer.draw(spec({ messages: [msg('n', 'a', 'a', 'note', { label: longNote })] }), BOX, 0, FONT);
      const r = rectOf(svg.querySelector('g.seq-msg[data-id="n"]')!);
      expect(r.x).toBeGreaterThanOrEqual(10);
      expect(r.x + r.w).toBeLessThanOrEqual(BOX.width - 10);
      layer.draw(spec({ messages: [msg('n', 'd', 'd', 'note', { label: longNote })] }), BOX, 0, FONT);
      const q = rectOf(svg.querySelector('g.seq-msg[data-id="n"]')!);
      expect(q.x + q.w).toBeLessThanOrEqual(BOX.width - 10);
    });

    it('note width capped', () => {
      const { svg, layer } = setup();
      layer.draw(spec({ messages: [msg('n', 'b', 'b', 'note', { label: longNote.repeat(3) })] }), BOX, 0, FONT);
      const r = rectOf(svg.querySelector('g.seq-msg[data-id="n"]')!);
      expect(r.w).toBeLessThanOrEqual((BOX.width / 4) * 1.8);
      expect(svg.querySelectorAll('g.seq-msg[data-id="n"] tspan').length).toBeGreaterThan(1);
    });

    it('token on note stays inside box', () => {
      const { svg, layer } = setup();
      layer.draw(spec({ messages: [msg('n', 'a', 'a', 'note', { label: longNote })], active: 'n' }), BOX, 0, FONT);
      const t = svg.querySelector('circle.seq-token')!;
      const cx = Number(t.getAttribute('cx'));
      const r = rectOf(svg.querySelector('g.seq-msg[data-id="n"]')!);
      expect(cx - 6).toBeGreaterThanOrEqual(0);
      expect(cx).toBeCloseTo(r.x, 0);
      expect(Number(t.getAttribute('cy'))).toBeCloseTo(r.top, 0);
    });
  });

  it('stopTone ok draws the ok stop mark', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ stopAt: 'b', stopTone: 'ok' }), BOX, 0, 14);
    expect(svg.querySelectorAll('g.seq-stop.ok')).toHaveLength(1);
    expect(svg.querySelector('g.seq-stop.ok circle')).toBeNull();
    layer.draw(spec({ stopAt: 'b', stopTone: 'alarm' }), BOX, 0, 14);
    expect(svg.querySelectorAll('g.seq-stop.ok')).toHaveLength(0);
    expect(svg.querySelectorAll('g.seq-stop circle')).toHaveLength(1);
  });

  it('ariaLabel sets role and aria-label on the svg', () => {
    const { svg, layer } = setup();
    layer.draw(spec({ ariaLabel: 'Sıra diyagramı' }), BOX, 0, 14);
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Sıra diyagramı');
  });
});
