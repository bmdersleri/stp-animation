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
});
